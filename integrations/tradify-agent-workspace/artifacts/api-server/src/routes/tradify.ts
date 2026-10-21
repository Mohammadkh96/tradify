import { Router, type NextFunction, type Request, type Response } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { env } from "@workspace/config";
import { customerChartContext } from "../customer-chart-context";
import { fetchWithRetry } from "../lib/fetch-with-retry";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  db,
  tradifyAdminAuditEvents,
  tradifyExpoPushDeliveries,
  tradifyExpoPushSubscriptions,
  tradifyEvaluationHistory,
  tradifyGeneratedSignals,
  tradifyMt5CustomerFeeds,
  tradifyOperationalAlertWindows,
  tradifyNotificationPreferences,
  tradifyRevenueCatTransfers,
  tradifySignalLifecycleEvents,
  tradifyStaffAccess,
  tradifyStrategies,
  tradifyStrategyAssignments,
  tradifySymbols,
  tradifyWebPushDeliveries,
  tradifyUserNotifications,
  tradifyUsers,
  tradifyProductLinks,
  tradifyWebPushSubscriptions,
} from "@workspace/db";
import {
  CreateAdminSessionBody,
  CreateAdminSessionResponse,
  CompletePasswordResetBody,
  CompletePasswordResetResponse,
  GetAdminSessionResponse,
  LogoutAdminSessionResponse,
  RequestAdminUserPasswordResetParams,
  RequestAdminUserPasswordResetResponse,
  RequestPasswordResetBody,
  RequestPasswordResetResponse,
} from "@workspace/api-zod";
import {
  authenticate,
  bridgeStore,
  adminStats,
  adminUsers,
  adminUsersPage,
  canonicalSymbol,
  chartTimeframes,
  catalogItem,
  getCandles,
  getCatalog,
  getLiveQuotes,
  getMT5WatchlistQuotes,
  getQuotes,
  getSignals,
  getUserById,
  getAdminAuditLog,
  getAdminUserAuditLog,
  getAdminUserDetail,
  getAdminUserNotes,
  getLatestAdminUserDecision,
  ensureRuntimeReady,
  getRevenueCatTransferUsers,
  persistUser,
  persistLastSeen,
  adminTradeMetrics,
  PRO_ENTITLEMENTS,
  recordAdminAudit,
  customerText,
  completeAccountDeletion,
  publicUser,
  createPasswordResetToken,
  completePasswordReset,
  revokePasswordResetToken,
  revokeUserSessions,
  createRevenueCatTransferLockDiagnostics,
  discardUnpersistedUser,
  CustomerStateNotFoundError,
  EmailInUseError,
  updateCustomerState,
  withRevenueCatTransferLock,
  userAlerts,
  userFromToken,
  userNotifications,
  userTrades,
  type PriceAlert,
  type ServerUser,
  type SubscriptionStatus,
  type Trade,
  type Quote,
  type RevenueCatTransferLockDiagnostics,
  UserIdInUseError,
} from "../tradify-runtime";
import {
  PasswordResetEmailDeliveryError,
  passwordResetEmailProvider,
} from "../password-reset-email";
import { createProductLinkingRouter } from "../product-linking.routes";
import { queueSignalsLinkRevocations } from "../product-linking";
import { canReceiveTrustedSignalEvent, notificationCategory } from "../signal-lifecycle-ledger";
import {
  customerWatchlistSymbol,
  customerAccessPolicySnapshot,
  hasFeatureAccess,
  hasMarketAccess,
  MT5_MARKET_SYMBOLS,
  requiredFeatureTier,
  requiredMarketTier,
  watchlistIdentity,
  watchlistLimit,
  type CustomerFeature,
  type CustomerMembershipTier,
} from "../market-access";
import {
  AccessPolicyConflictError,
  AccessPolicyValidationError,
  customerAccessPolicyDefaultForMarketSet,
  getEstimatedCustomerMembershipTierCounts,
  getEstimatedWatchlistSizeDistribution,
  refreshCustomerAccessPolicy,
  startCustomerAccessPolicyRefreshLoop,
  updateCustomerAccessPolicy,
  validateCustomerAccessPolicy,
} from "../access-policy";
import { MT5_WATCHLIST_QUOTE_SYMBOLS } from "../zip-engine/market/MT5WatchlistSubscriptions";
import {
  mt5WatchlistAssetClass,
  mt5WatchlistDigits,
  mt5WatchlistMarketNames,
} from "../zip-engine/market/MT5WatchlistCatalog";
import {
  assignedStrategy,
  assignedStrategies,
  diagnosticFor,
  evaluateSymbol,
  toSignalCard,
} from "../authoritative-engine";
import {
  capabilitiesForAccess,
  getStaffAccess,
  getStrategy,
  getSymbolControl,
  hasCapability,
  listAssignments,
  listEffectiveMarkets,
  listStaffAccess,
  listStrategies,
  mt5StrategyBrokerSymbols,
  STAFF_CAPABILITIES,
  STAFF_ROLES,
  strategyRegistry,
  type StaffCapability,
  type StaffRole,
} from "../control-plane";
import { mt5WatchlistQuoteSymbols } from "../zip-engine/market/MT5WatchlistSubscriptions";
import { MT5BridgeStore, mt5BridgeStore } from "../zip-engine/market/providers/MT5BridgeStore";
import { marketCatalog } from "../zip-engine/market/MarketCatalog";
import { findMissingMt5M15Intervals } from "../zip-engine/market/Mt5HistoryCoverage";
import { mt5ServerWallTimeFromUtc } from "../zip-engine/market/CandleTime";
import { marketDataRegistry } from "../zip-engine/market/ProviderRegistry";
import { listRecentAuthorityTransitions } from "../zip-engine/market/MarketAuthorityPersistence";
import { sanitizeDiagnosticValue } from "../zip-engine/market/ProviderDiagnosticSanitizer";
import { ConcurrentUpdateError, engineState } from "../engine-state";
import { logger } from "../lib/logger";
import { getWebPushPublicKey } from "../web-push-delivery";
import {
  fetchDevelopmentMarketCandles,
  fetchDevelopmentMarketQuotes,
  mergeDevelopmentMarketQuotes,
} from "../market-data-proxy";
import {
  getRevenueCatBillingState,
  isRevenueCatWebhookAuthorized,
  mapRevenueCatTransferEvent,
  mapRevenueCatWebhookEvent,
  RevenueCatProviderUnavailableError,
  type RevenueCatWebhookEvent,
  type RevenueCatTransferState,
} from "../revenuecat-billing";
import { fetchAdminRevenueCatPriceSummary } from "../revenuecat-catalog";

const router = Router();
const sseClients = new Map<Response, CustomerMembershipTier>();

function defaultCustomerAccessPolicy() {
  const coreSymbols = getCatalog().map((item) => item.symbol.trim().toUpperCase());
  const coreSet = new Set(coreSymbols);
  const quoteOnlySymbols = MT5_WATCHLIST_QUOTE_SYMBOLS.filter((symbol) => !coreSet.has(symbol));
  return customerAccessPolicyDefaultForMarketSet(coreSymbols, quoteOnlySymbols);
}

function pathUsesCustomerAccessPolicy(path: string): boolean {
  return (
    path.startsWith("/auth/") ||
    path.startsWith("/market/") ||
    path.startsWith("/markets/") ||
    path.startsWith("/signals") ||
    path.startsWith("/user/") ||
    path.startsWith("/watchlist") ||
    path.startsWith("/membership/") ||
    path.startsWith("/admin/access-policy") ||
    path.startsWith("/admin/market-access") ||
    path.startsWith("/admin/market-inventory")
  );
}

if (env.isProduction || process.env.TRADIFY_DEV_DATABASE_POLLING === "1") {
  startCustomerAccessPolicyRefreshLoop(defaultCustomerAccessPolicy, (error) => {
    logger.error({ error }, "Shared customer access policy refresh failed");
  });
}

router.use(async (req, res, next) => {
  if (!pathUsesCustomerAccessPolicy(req.path)) {
    next();
    return;
  }
  try {
    await refreshCustomerAccessPolicy(defaultCustomerAccessPolicy());
    next();
  } catch (error) {
    logger.error({ error }, "Shared customer access policy is unavailable");
    res.status(503).json({ error: "ACCESS_POLICY_UNAVAILABLE" });
  }
});
export const revenueCatBillingProvider = { get: getRevenueCatBillingState };
export const revenueCatCatalogProvider = { get: fetchAdminRevenueCatPriceSummary };
const revenueCatWebhookQueues = new Map<string, Promise<void>>();
const pendingRevenueCatTransfers = new Map<string, RevenueCatTransferState>();

export const PENDING_TRANSFER_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const REVENUECAT_RETRY_BASE_DELAY_MS = 60 * 1_000;
export const REVENUECAT_RETRY_MAX_DELAY_MS = 60 * 60 * 1_000;
const REVENUECAT_AUDIT_ACTOR_ID = "system:revenuecat";
const REVENUECAT_AUDIT_ACTOR_EMAIL = "revenuecat-webhook";
const REVENUECAT_TRANSFER_AUDIT_PAGE_SIZE = 200;
type RevenueCatTransferFailureCategory = "PROVIDER_UNAVAILABLE" | "RECONCILIATION_FAILED";
type RevenueCatTransferFailurePhase = "LOCK" | "RECONCILIATION";
export type RevenueCatTransferRecoveryState =
  "WAIT_FOR_PROVIDER" | "RETRY_SAFE" | "DEFERRED_RETRY" | "ESCALATE" | "NO_ACTION";
type RevenueCatTransferResult = "processed" | "duplicate" | "stale" | "ignored" | "deferred";
type RevenueCatTransferRecoveryOutcome = "recovered" | "already-recovered" | "provider-deferred";
type RevenueCatTransferRetentionState = "WITHIN_RETENTION" | "EXPIRED" | "UNKNOWN";
type RevenueCatLifecycleEventType =
  | "INITIAL_PURCHASE"
  | "NON_RENEWING_PURCHASE"
  | "RENEWAL"
  | "UNCANCELLATION"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "BILLING_ISSUE"
  | "SUBSCRIPTION_PAUSED"
  | "EXPIRATION"
  | "UNKNOWN";
type RevenueCatLifecycleOutcome = "processed" | "duplicate" | "stale" | "ignored";

function billingTransferIncludesAnyAccount(
  accountIds: string[] | undefined,
  appUserIds: unknown,
): boolean {
  if (!accountIds?.length) return true;
  return (
    Array.isArray(appUserIds) &&
    appUserIds.some((id) => typeof id === "string" && accountIds.includes(id))
  );
}

type BillingAccountMatch = { accountId: string; side: "source" | "destination" };

function billingTransferAccountMatches(
  accountIds: string[] | undefined,
  sourceAppUserIds: unknown,
  destinationAppUserIds: unknown,
): BillingAccountMatch[] | undefined {
  if (!accountIds?.length) return undefined;
  const requestedAccountIds = new Set(accountIds);
  const matches: BillingAccountMatch[] = [];
  const addMatches = (value: unknown, side: BillingAccountMatch["side"]) => {
    if (!Array.isArray(value)) return;
    const seen = new Set<string>();
    for (const accountId of value) {
      if (
        typeof accountId !== "string" ||
        seen.has(accountId) ||
        !requestedAccountIds.has(accountId)
      )
        continue;
      seen.add(accountId);
      matches.push({ accountId, side });
    }
  };
  addMatches(sourceAppUserIds, "source");
  addMatches(destinationAppUserIds, "destination");
  return matches;
}

function parseBillingAccountIds(value: unknown): { accountIds?: string[]; invalid: boolean } {
  if (value === undefined) return { invalid: false };
  const values = Array.isArray(value) ? value : [value];
  const accountIds: string[] = [];
  for (const item of values) {
    if (typeof item !== "string") return { invalid: true };
    const parts = item.split(",");
    if (parts.some((part) => part.trim().length === 0)) return { invalid: true };
    accountIds.push(...parts.map((part) => part.trim()));
  }
  const uniqueAccountIds = [...new Set(accountIds)];
  return uniqueAccountIds.length
    ? { accountIds: uniqueAccountIds, invalid: false }
    : { invalid: true };
}

function billingHandoffText(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim() : "";
}

function billingHandoffIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map(billingHandoffText)
    : [];
}

type AdminBillingTransferHandoff = {
  eventId: string;
  status: "pending" | "processed" | "duplicate" | "stale" | "ignored" | "failed";
  transferTimestamp: string | null;
  previousAppUserIds: string[];
  destinationAppUserIds: string[];
  pendingDestinationAppUserIds: string[];
  matchedAccounts: BillingAccountMatch[];
  receivedAt: string | null;
  expiresAt: string | null;
  recordedAt: string | null;
  failureCategory: RevenueCatTransferFailureCategory | null;
  recoveryState: RevenueCatTransferRecoveryState | null;
  supportGuidance: string;
  summary: string;
};

function createBillingTransferHandoff(
  input: Omit<AdminBillingTransferHandoff, "summary">,
): AdminBillingTransferHandoff {
  const sourceAccounts = input.previousAppUserIds.length ? input.previousAppUserIds : ["—"];
  const destinationAccounts = input.destinationAppUserIds.length
    ? input.destinationAppUserIds
    : ["—"];
  const matchedAccounts = input.matchedAccounts.length
    ? input.matchedAccounts.map(
        ({ accountId, side }) => `${billingHandoffText(accountId)} (${side} side)`,
      )
    : ["No account filter match supplied"];
  const lines = [
    "Tradify transfer incident handoff",
    `Event ID: ${billingHandoffText(input.eventId)}`,
    `Status: ${input.status.toUpperCase()}`,
    `Transfer timestamp: ${input.transferTimestamp ?? "unavailable"}`,
    `Received at: ${input.receivedAt ?? "unavailable"}`,
    `Recorded at: ${input.recordedAt ?? "unavailable"}`,
    `Retention ends: ${input.expiresAt ?? "unavailable"}`,
    "",
    "Source account side:",
    ...sourceAccounts.map((accountId) => `- ${billingHandoffText(accountId)}`),
    "Destination account side:",
    ...destinationAccounts.map((accountId) => `- ${billingHandoffText(accountId)}`),
    "Matched account explanation:",
    ...matchedAccounts.map((match) => `- ${match}`),
    ...(input.pendingDestinationAppUserIds.length
      ? [
          "Pending destination accounts:",
          ...input.pendingDestinationAppUserIds.map(
            (accountId) => `- ${billingHandoffText(accountId)}`,
          ),
        ]
      : []),
    "",
    `Recovery guidance: ${billingHandoffText(input.supportGuidance)}`,
    "Internal administrator handoff. No provider credentials or entitlement data included.",
  ];
  return { ...input, summary: lines.join("\n") };
}

export const REVENUECAT_STALE_DELIVERY_ALERT_WINDOW_MS = 15 * 60 * 1_000;
export const REVENUECAT_STALE_DELIVERY_ALERT_MIN_COUNT = 3;
export const REVENUECAT_STALE_DELIVERY_ALERT_MIN_RATE = 0.5;
export const REVENUECAT_STALE_DELIVERY_ALERT_CHECK_INTERVAL_MS = 60 * 1_000;
const REVENUECAT_STALE_DELIVERY_ALERT_PAGE_SIZE = 200;
const REVENUECAT_STALE_DELIVERY_ALERT_MAX_ENTRIES = 1_000;
export const REVENUECAT_STALE_DELIVERY_ALERT_KEY = "REVENUECAT_STALE_DELIVERY_SURGE";

export type RevenueCatLifecycleAuditEntry = {
  createdAt: string;
  details: unknown;
};

export type RevenueCatStaleDeliveryAlertSummary = {
  triggered: boolean;
  windowMs: number;
  totalOutcomeCount: number;
  staleCount: number;
  staleRate: number;
  staleByEventType: Partial<Record<RevenueCatLifecycleEventType, number>>;
  outcomeCounts: Record<RevenueCatLifecycleOutcome, number>;
};

function isRevenueCatLifecycleEventType(value: unknown): value is RevenueCatLifecycleEventType {
  return (
    typeof value === "string" &&
    [
      "INITIAL_PURCHASE",
      "NON_RENEWING_PURCHASE",
      "RENEWAL",
      "UNCANCELLATION",
      "PRODUCT_CHANGE",
      "CANCELLATION",
      "BILLING_ISSUE",
      "SUBSCRIPTION_PAUSED",
      "EXPIRATION",
      "UNKNOWN",
    ].includes(value)
  );
}

function isRevenueCatLifecycleOutcome(value: unknown): value is RevenueCatLifecycleOutcome {
  return value === "processed" || value === "duplicate" || value === "stale" || value === "ignored";
}

export function evaluateRevenueCatStaleDeliveryAlert(
  entries: RevenueCatLifecycleAuditEntry[],
  now = Date.now(),
  requestedWindowMs = REVENUECAT_STALE_DELIVERY_ALERT_WINDOW_MS,
): RevenueCatStaleDeliveryAlertSummary {
  const windowMs = Number.isFinite(requestedWindowMs)
    ? Math.max(1, Math.min(requestedWindowMs, 24 * 60 * 60 * 1_000))
    : REVENUECAT_STALE_DELIVERY_ALERT_WINDOW_MS;
  const nowMs = Number.isFinite(now) ? now : Date.now();
  const windowStartMs = nowMs - windowMs;
  const outcomeCounts: Record<RevenueCatLifecycleOutcome, number> = {
    processed: 0,
    duplicate: 0,
    stale: 0,
    ignored: 0,
  };
  const staleByEventType: Partial<Record<RevenueCatLifecycleEventType, number>> = {};

  for (const entry of entries) {
    const createdAtMs = Date.parse(entry.createdAt);
    if (!Number.isFinite(createdAtMs) || createdAtMs < windowStartMs || createdAtMs > nowMs)
      continue;
    if (!entry.details || typeof entry.details !== "object" || Array.isArray(entry.details))
      continue;
    const details = entry.details as Record<string, unknown>;
    if (!isRevenueCatLifecycleOutcome(details.outcome)) continue;
    outcomeCounts[details.outcome] += 1;
    if (details.outcome !== "stale") continue;
    const eventType = isRevenueCatLifecycleEventType(details.eventType)
      ? details.eventType
      : "UNKNOWN";
    staleByEventType[eventType] = (staleByEventType[eventType] ?? 0) + 1;
  }

  const totalOutcomeCount = Object.values(outcomeCounts).reduce((total, count) => total + count, 0);
  const staleCount = outcomeCounts.stale;
  const staleRate = totalOutcomeCount > 0 ? staleCount / totalOutcomeCount : 0;
  return {
    triggered:
      staleCount >= REVENUECAT_STALE_DELIVERY_ALERT_MIN_COUNT &&
      staleRate >= REVENUECAT_STALE_DELIVERY_ALERT_MIN_RATE,
    windowMs,
    totalOutcomeCount,
    staleCount,
    staleRate,
    staleByEventType,
    outcomeCounts,
  };
}

let revenueCatStaleDeliveryAlertCheckInFlight = false;

async function claimRevenueCatStaleDeliveryAlert(nowMs: number): Promise<boolean> {
  const alertTimestamp = new Date(nowMs).toISOString();
  const suppressionWindowStart = new Date(
    nowMs - REVENUECAT_STALE_DELIVERY_ALERT_WINDOW_MS,
  ).toISOString();
  const claimed = await db
    .insert(tradifyOperationalAlertWindows)
    .values({
      alertKey: REVENUECAT_STALE_DELIVERY_ALERT_KEY,
      lastAlertAt: alertTimestamp,
    })
    .onConflictDoUpdate({
      target: tradifyOperationalAlertWindows.alertKey,
      set: { lastAlertAt: alertTimestamp },
      where: lte(tradifyOperationalAlertWindows.lastAlertAt, suppressionWindowStart),
    })
    .returning({ alertKey: tradifyOperationalAlertWindows.alertKey });

  return claimed.length > 0;
}

export async function checkRevenueCatStaleDeliveryAlert(
  now = Date.now(),
): Promise<RevenueCatStaleDeliveryAlertSummary> {
  const nowMs = Number.isFinite(now) ? now : Date.now();
  const from = new Date(nowMs - REVENUECAT_STALE_DELIVERY_ALERT_WINDOW_MS).toISOString();
  const to = new Date(nowMs).toISOString();
  const entries: RevenueCatLifecycleAuditEntry[] = [];

  for (let page = 1; entries.length < REVENUECAT_STALE_DELIVERY_ALERT_MAX_ENTRIES; page += 1) {
    const pageEntries = await getAdminAuditLog({
      actorId: REVENUECAT_AUDIT_ACTOR_ID,
      action: "BILLING_WEBHOOK_OUTCOME",
      from,
      to,
      page,
      pageSize: REVENUECAT_STALE_DELIVERY_ALERT_PAGE_SIZE,
    });
    entries.push(
      ...pageEntries.map((entry) => ({ createdAt: entry.createdAt, details: entry.details })),
    );
    if (pageEntries.length < REVENUECAT_STALE_DELIVERY_ALERT_PAGE_SIZE) break;
  }

  const summary = evaluateRevenueCatStaleDeliveryAlert(
    entries.slice(0, REVENUECAT_STALE_DELIVERY_ALERT_MAX_ENTRIES),
    nowMs,
  );
  if (summary.triggered && (await claimRevenueCatStaleDeliveryAlert(nowMs))) {
    logger.warn(
      {
        alert: "REVENUECAT_STALE_DELIVERY_SURGE",
        windowMs: summary.windowMs,
        totalOutcomeCount: summary.totalOutcomeCount,
        staleCount: summary.staleCount,
        staleRate: summary.staleRate,
        eventCategories: summary.staleByEventType,
        outcomeCounts: summary.outcomeCounts,
      },
      "RevenueCat stale billing delivery threshold exceeded",
    );
  }
  return summary;
}

export async function runRevenueCatStaleDeliveryAlertCheck(
  now = Date.now(),
): Promise<RevenueCatStaleDeliveryAlertSummary | null> {
  if (revenueCatStaleDeliveryAlertCheckInFlight) return null;

  revenueCatStaleDeliveryAlertCheckInFlight = true;
  try {
    return await checkRevenueCatStaleDeliveryAlert(now);
  } catch (error) {
    // Operational alert checks must not affect webhook acknowledgement,
    // entitlement behavior, or the next scheduled check.
    logger.error({ error }, "RevenueCat scheduled stale delivery alert check failed");
    return null;
  } finally {
    revenueCatStaleDeliveryAlertCheckInFlight = false;
  }
}

class RevenueCatTransferFailure extends Error {
  constructor(readonly category: RevenueCatTransferFailureCategory) {
    super("RevenueCat transfer reconciliation failed");
    this.name = "RevenueCatTransferFailure";
  }
}

function revenueCatTransferFailureCategory(error: unknown): RevenueCatTransferFailureCategory {
  if (error instanceof RevenueCatTransferFailure) return error.category;
  if (error instanceof RevenueCatProviderUnavailableError) return "PROVIDER_UNAVAILABLE";
  return "RECONCILIATION_FAILED";
}

function revenueCatTransferRecoveryOutcome(
  result: RevenueCatTransferResult,
): RevenueCatTransferRecoveryOutcome {
  if (result === "processed") return "recovered";
  if (result === "deferred") return "provider-deferred";
  return "already-recovered";
}

function revenueCatRetryDelayMs(attempt: number): number {
  const exponent = Math.max(0, Math.min(30, Math.floor(attempt) - 1));
  return Math.min(REVENUECAT_RETRY_MAX_DELAY_MS, REVENUECAT_RETRY_BASE_DELAY_MS * 2 ** exponent);
}

type RevenueCatTransferRetryState = {
  failureCount: number;
  retryAfter: string | null;
};

async function revenueCatTransferRetryState(
  eventId: string,
): Promise<RevenueCatTransferRetryState> {
  const entries = await getAdminAuditLog({
    actorId: REVENUECAT_AUDIT_ACTOR_ID,
    action: "BILLING_TRANSFER_OUTCOME",
    page: 1,
    pageSize: REVENUECAT_TRANSFER_AUDIT_PAGE_SIZE,
  });
  const failures = entries.filter(
    (entry) => entry.details.eventId === eventId && entry.details.outcome === "failed",
  );
  const latest = failures[0];
  if (!latest) return { failureCount: 0, retryAfter: null };
  const retryAfter =
    typeof latest.details.retryAfter === "string" &&
    Number.isFinite(Date.parse(latest.details.retryAfter))
      ? latest.details.retryAfter
      : null;
  return { failureCount: failures.length, retryAfter };
}

export function revenueCatTransferRecovery(
  outcome: string,
  failureCategory: RevenueCatTransferFailureCategory | null,
  transferTimestamp: string | null,
  recordedAt: string,
  now = Date.now(),
  retryAttempt: number | null = null,
  retryAfter: string | null = null,
): {
  recoveryState: RevenueCatTransferRecoveryState;
  safeToRetry: boolean;
  escalationRequired: boolean;
  transferAgeMs: number | null;
  retentionState: RevenueCatTransferRetentionState;
  retentionExpiresAt: string | null;
  retryAttempt: number | null;
  retryAfter: string | null;
  supportGuidance: string;
} {
  const transferTime = transferTimestamp ? Date.parse(transferTimestamp) : Date.parse(recordedAt);
  const validTransferTime = Number.isFinite(transferTime);
  const transferAgeMs = validTransferTime ? Math.max(0, now - transferTime) : null;
  const retentionExpiresAt = validTransferTime
    ? new Date(transferTime + PENDING_TRANSFER_RETENTION_MS).toISOString()
    : null;
  const retentionState: RevenueCatTransferRetentionState = !validTransferTime
    ? "UNKNOWN"
    : now >= transferTime + PENDING_TRANSFER_RETENTION_MS
      ? "EXPIRED"
      : "WITHIN_RETENTION";

  if (outcome !== "failed") {
    return {
      recoveryState: "NO_ACTION",
      safeToRetry: false,
      escalationRequired: false,
      transferAgeMs,
      retentionState,
      retentionExpiresAt,
      retryAttempt,
      retryAfter,
      supportGuidance: "No retry is needed for this recorded outcome.",
    };
  }

  if (retentionState !== "WITHIN_RETENTION") {
    return {
      recoveryState: "ESCALATE",
      safeToRetry: false,
      escalationRequired: true,
      transferAgeMs,
      retentionState,
      retentionExpiresAt,
      retryAttempt,
      retryAfter,
      supportGuidance:
        "The retention window has elapsed or the transfer age is unknown. Do not retry; escalate for manual review.",
    };
  }

  if (retryAfter && Number.isFinite(Date.parse(retryAfter)) && now < Date.parse(retryAfter)) {
    return {
      recoveryState: "DEFERRED_RETRY",
      safeToRetry: false,
      escalationRequired: false,
      transferAgeMs,
      retentionState,
      retentionExpiresAt,
      retryAttempt,
      retryAfter,
      supportGuidance: `Retry deferred until ${retryAfter}. The existing delivery path will remain the only entitlement-changing path.`,
    };
  }

  if (failureCategory === "PROVIDER_UNAVAILABLE") {
    return {
      recoveryState: "WAIT_FOR_PROVIDER",
      safeToRetry: false,
      escalationRequired: false,
      transferAgeMs,
      retentionState,
      retentionExpiresAt,
      retryAttempt,
      retryAfter,
      supportGuidance:
        "Wait for the billing provider to recover, then retry through the existing delivery path. Do not change entitlements manually.",
    };
  }

  if (failureCategory === "RECONCILIATION_FAILED") {
    return {
      recoveryState: "RETRY_SAFE",
      safeToRetry: true,
      escalationRequired: false,
      transferAgeMs,
      retentionState,
      retentionExpiresAt,
      retryAttempt,
      retryAfter,
      supportGuidance:
        "Retry through the existing delivery or reconciliation path while the transfer remains within retention. Do not change entitlements manually.",
    };
  }

  return {
    recoveryState: "ESCALATE",
    safeToRetry: false,
    escalationRequired: true,
    transferAgeMs,
    retentionState,
    retentionExpiresAt,
    retryAttempt,
    retryAfter,
    supportGuidance:
      "The failure category is not trusted. Do not retry; escalate for manual review.",
  };
}

function pendingTransferFromRow(
  row: typeof tradifyRevenueCatTransfers.$inferSelect,
): RevenueCatTransferState | undefined {
  const isValidAccountIdList = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((id) => typeof id === "string" && id.length > 0 && id.trim() === id) &&
    new Set(value).size === value.length;
  if (
    !isValidAccountIdList(row.previousAppUserIds) ||
    !isValidAccountIdList(row.destinationAppUserIds) ||
    row.previousAppUserIds.some((id) => row.destinationAppUserIds.includes(id))
  ) {
    return undefined;
  }
  const eventTimestampMs = row.eventTimestampMs === null ? null : Number(row.eventTimestampMs);
  return {
    eventId: row.eventId,
    eventTimestampMs:
      row.eventTimestampMs === null || !Number.isFinite(eventTimestampMs) ? null : eventTimestampMs,
    previousAppUserIds: row.previousAppUserIds,
    destinationAppUserIds: row.destinationAppUserIds,
  };
}

function pendingTransferExpiryMs(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const expiresAt = Date.parse(value);
  return Number.isFinite(expiresAt) ? expiresAt : undefined;
}

async function removePendingRevenueCatTransfer(eventId: string, database = db): Promise<void> {
  await database
    .delete(tradifyRevenueCatTransfers)
    .where(eq(tradifyRevenueCatTransfers.eventId, eventId));
  pendingRevenueCatTransfers.delete(eventId);
}

async function persistPendingRevenueCatTransfer(
  transfer: RevenueCatTransferState,
  database = db,
): Promise<void> {
  const now = new Date();
  await database
    .insert(tradifyRevenueCatTransfers)
    .values({
      eventId: transfer.eventId,
      eventTimestampMs:
        transfer.eventTimestampMs === null ? null : String(transfer.eventTimestampMs),
      previousAppUserIds: transfer.previousAppUserIds,
      destinationAppUserIds: transfer.destinationAppUserIds,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PENDING_TRANSFER_RETENTION_MS).toISOString(),
    })
    .onConflictDoNothing({ target: tradifyRevenueCatTransfers.eventId });
  pendingRevenueCatTransfers.set(transfer.eventId, transfer);
}

async function recordRevenueCatTransferOutcome(
  transfer: RevenueCatTransferState,
  outcome: "processed" | "duplicate" | "stale" | "ignored" | "failed",
  failureCategory: RevenueCatTransferFailureCategory | null = null,
  lock: RevenueCatTransferLockDiagnostics | null = null,
  failurePhase: RevenueCatTransferFailurePhase | null = null,
  retryAttempt: number | null = null,
  retryAfter: string | null = null,
): Promise<void> {
  try {
    await recordAdminAudit({
      actorId: REVENUECAT_AUDIT_ACTOR_ID,
      actorEmail: REVENUECAT_AUDIT_ACTOR_EMAIL,
      action: "BILLING_TRANSFER_OUTCOME",
      details: {
        eventId: transfer.eventId,
        outcome,
        transferTimestamp:
          transfer.eventTimestampMs === null
            ? null
            : new Date(transfer.eventTimestampMs).toISOString(),
        previousAppUserIds: [...transfer.previousAppUserIds],
        destinationAppUserIds: [...transfer.destinationAppUserIds],
        pendingDestinationAppUserIds: transfer.destinationAppUserIds.filter(
          (id) => !getUserById(id),
        ),
        failureCategory,
        failurePhase,
        retryAttempt,
        retryAfter,
        lock,
      },
    });
  } catch (error) {
    // Billing reconciliation must not be reported as failed only because the
    // operational audit sink is temporarily unavailable.
    logger.error(
      { errorType: error instanceof Error ? error.name : typeof error },
      "RevenueCat transfer outcome audit failed",
    );
  }
}

function revenueCatLifecycleEventType(event: RevenueCatWebhookEvent): RevenueCatLifecycleEventType {
  const type = typeof event.type === "string" ? event.type.trim().toUpperCase() : "";
  const knownTypes: RevenueCatLifecycleEventType[] = [
    "INITIAL_PURCHASE",
    "NON_RENEWING_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "CANCELLATION",
    "BILLING_ISSUE",
    "SUBSCRIPTION_PAUSED",
    "EXPIRATION",
  ];
  return knownTypes.includes(type as RevenueCatLifecycleEventType)
    ? (type as RevenueCatLifecycleEventType)
    : "UNKNOWN";
}

async function recordRevenueCatLifecycleOutcome(
  event: RevenueCatWebhookEvent,
  outcome: "processed" | "duplicate" | "stale" | "ignored",
): Promise<void> {
  try {
    await recordAdminAudit({
      actorId: REVENUECAT_AUDIT_ACTOR_ID,
      actorEmail: REVENUECAT_AUDIT_ACTOR_EMAIL,
      action: "BILLING_WEBHOOK_OUTCOME",
      details: {
        eventType: revenueCatLifecycleEventType(event),
        outcome,
      },
    });
  } catch (error) {
    // Billing entitlement behavior must not depend on the operational audit
    // sink being available.
    logger.error(
      { errorType: error instanceof Error ? error.name : typeof error },
      "RevenueCat lifecycle outcome audit failed",
    );
  }
  await runRevenueCatStaleDeliveryAlertCheck();
}

const pendingRevenueCatTransfersReady = (async () => {
  const now = new Date();
  const rows = await db.select().from(tradifyRevenueCatTransfers);
  for (const row of rows) {
    const expiresAt = pendingTransferExpiryMs(row.expiresAt);
    const transfer = pendingTransferFromRow(row);
    if (!transfer || expiresAt === undefined || expiresAt <= now.getTime()) {
      await removePendingRevenueCatTransfer(row.eventId);
      continue;
    }
    pendingRevenueCatTransfers.set(transfer.eventId, transfer);
  }
})();

async function ensurePendingRevenueCatTransfersReady(): Promise<void> {
  await pendingRevenueCatTransfersReady;
  const expiredRows = await db
    .select({ eventId: tradifyRevenueCatTransfers.eventId })
    .from(tradifyRevenueCatTransfers)
    .where(lte(tradifyRevenueCatTransfers.expiresAt, new Date().toISOString()));
  for (const row of expiredRows) {
    await removePendingRevenueCatTransfer(row.eventId);
  }
}

const ADMIN_SESSION_COOKIE = "__Host-tradify-admin";
const ADMIN_WEB_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const CUSTOMER_WEB_SESSION_COOKIE = "__Host-tradify-session";
const CUSTOMER_WEB_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function requestsBrowserSession(req: Request): boolean {
  return req.header("x-tradify-web-session") === "1";
}

function setCustomerWebSession(req: Request, res: Response, token: string): boolean {
  if (!requestsBrowserSession(req)) return false;
  if (!requestIsSameOrigin(req)) return false;
  res.cookie(CUSTOMER_WEB_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_WEB_SESSION_TTL_MS,
  });
  return true;
}

function isAdminCookieRoute(req: Request): boolean {
  return (
    req.path === "/auth/admin-session" ||
    req.path === "/signals/diagnostic" ||
    req.path.startsWith("/admin/")
  );
}

function requestIsSameOrigin(req: Request): boolean {
  const origin = req.header("origin");
  const host = req.header("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).origin === new URL(`${req.protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

function tokenFromRequest(req: Request) {
  const value = req.header("authorization");
  const bearer = value?.startsWith("Bearer ") ? value.slice(7) : undefined;
  if (bearer) return bearer;
  const customerCookie = req.cookies?.[CUSTOMER_WEB_SESSION_COOKIE];
  if (typeof customerCookie === "string") return customerCookie;
  if (!isAdminCookieRoute(req)) return undefined;
  const cookie = req.cookies?.[ADMIN_SESSION_COOKIE];
  return typeof cookie === "string" ? cookie : undefined;
}

async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  await ensureRuntimeReady();
  const hasBearer = Boolean(req.header("authorization")?.startsWith("Bearer "));
  const adminCookie =
    !hasBearer && isAdminCookieRoute(req) ? req.cookies?.[ADMIN_SESSION_COOKIE] : undefined;
  const customerCookie = !hasBearer ? req.cookies?.[CUSTOMER_WEB_SESSION_COOKIE] : undefined;
  if (
    typeof customerCookie === "string" &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase()) &&
    !requestIsSameOrigin(req)
  ) {
    res.status(403).json({ error: "CSRF_REJECTED" });
    return;
  }
  if (
    typeof adminCookie === "string" &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase()) &&
    !requestIsSameOrigin(req)
  ) {
    res.status(403).json({ error: "CSRF_REJECTED" });
    return;
  }
  let user = await userFromToken(tokenFromRequest(req));
  if (!user) {
    res.status(401).json({ error: "AUTH_REQUIRED" });
    return;
  }
  if (user.membershipSource === "ADMIN_OVERRIDE" && !hasActiveAdminMembershipOverride(user)) {
    user = await expireAdminMembershipOverride(user);
  }
  if (user.status === "suspended" || user.status === "banned") {
    res.status(403).json({ error: "USER_SUSPENDED" });
    return;
  }
  if (user.status === "deleted") {
    res.status(403).json({ error: "ACCOUNT_DELETED" });
    return;
  }
  await persistLastSeen(user);
  (req as Request & { tradifyUser: ServerUser }).tradifyUser = user;
  next();
}

function requireStaff(req: Request, res: Response, next: NextFunction): void {
  const user = requestUser(req);
  if (!user) {
    res.status(403).json({ error: "STAFF_ACCESS_REQUIRED" });
    return;
  }
  void getStaffAccess(user.id)
    .then((access) => {
      if (!access?.active) {
        res.status(403).json({ error: "STAFF_ACCESS_REQUIRED" });
        return;
      }
      next();
    })
    .catch(next);
}

function requireCapability(capability: StaffCapability) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = requestUser(req);
    if (!user) {
      res.status(403).json({ error: "STAFF_ACCESS_REQUIRED" });
      return;
    }
    const access = await getStaffAccess(user.id);
    if (!hasCapability(access, capability)) {
      res.status(403).json({ error: "PERMISSION_DENIED", capability });
      return;
    }
    next();
  };
}

function staffAccessSummary(
  access: {
    userId: string;
    role: string;
    customPermissions: string[];
    active: boolean;
    rowVersion: number;
    updatedAt: Date | string;
    updatedBy?: string | null;
    email?: string;
    name?: string;
  },
  fallback?: { email: string; name: string },
) {
  return {
    userId: access.userId,
    email: access.email ?? fallback?.email ?? "",
    name: access.name ?? fallback?.name ?? "",
    role: access.role,
    customPermissions: access.customPermissions,
    capabilities: capabilitiesForAccess(access.role, access.customPermissions),
    active: access.active,
    rowVersion: access.rowVersion,
    updatedAt: access.updatedAt instanceof Date ? access.updatedAt.toISOString() : access.updatedAt,
    updatedBy: access.updatedBy ?? null,
  };
}

type AdminAuditDateFilters = {
  from?: string;
  to?: string;
};

/**
 * Audit date filters are normalized before they reach the database. Invalid
 * bounds and reversed ranges are documented 400 responses for both audit
 * history endpoints.
 */
function parseAdminAuditDateFilters(
  req: Request,
  res: Response,
): AdminAuditDateFilters | undefined {
  const parsed: AdminAuditDateFilters = {};
  const timestamps: Partial<Record<keyof AdminAuditDateFilters, number>> = {};

  for (const field of ["from", "to"] as const) {
    const value = req.query[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.trim().length === 0) {
      res.status(400).json({
        error: "INVALID_AUDIT_DATE",
        field,
        message: `${field} must be a valid timestamp`,
      });
      return undefined;
    }

    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      res.status(400).json({
        error: "INVALID_AUDIT_DATE",
        field,
        message: `${field} must be a valid timestamp`,
      });
      return undefined;
    }

    parsed[field] = new Date(timestamp).toISOString();
    timestamps[field] = timestamp;
  }

  if (
    timestamps.from !== undefined &&
    timestamps.to !== undefined &&
    timestamps.from > timestamps.to
  ) {
    res.status(400).json({
      error: "INVALID_AUDIT_DATE_RANGE",
      message: "from must be earlier than or equal to to",
    });
    return undefined;
  }

  return parsed;
}

function requireBridge(req: Request, res: Response, next: NextFunction): void {
  if (!bridgeStore.validateSecret(req.header("x-bridge-secret"))) {
    res.status(401).json({ error: "BRIDGE_AUTH_REQUIRED" });
    return;
  }
  next();
}

function requestUser(req: Request) {
  return (req as Request & { tradifyUser: ServerUser }).tradifyUser;
}

const CUSTOMER_MT5_FEED_CONSENT_VERSION = "tradify-journal-mt5-feed-consent-v1";

type CustomerMt5FeedGrant = typeof tradifyMt5CustomerFeeds.$inferSelect;

function customerMt5Store(feedId: string): MT5BridgeStore {
  return MT5BridgeStore.getInstance(`CUSTOMER:${feedId}`);
}

async function activeCustomerMt5Feed(userId: string): Promise<CustomerMt5FeedGrant | undefined> {
  const [feed] = await db
    .select()
    .from(tradifyMt5CustomerFeeds)
    .where(and(eq(tradifyMt5CustomerFeeds.userId, userId), isNull(tradifyMt5CustomerFeeds.revokedAt)))
    .limit(1);
  if (!feed) return undefined;
  const [link] = await db
    .select({ linkId: tradifyProductLinks.linkId })
    .from(tradifyProductLinks)
    .where(
      and(
        eq(tradifyProductLinks.linkId, feed.linkId),
        eq(tradifyProductLinks.userId, userId),
        eq(tradifyProductLinks.state, "active"),
      ),
    )
    .limit(1);
  return link ? feed : undefined;
}

async function authorizeCustomerMt5Bridge(
  req: Request,
  res: Response,
): Promise<{ feed: CustomerMt5FeedGrant; store: MT5BridgeStore } | undefined> {
  const token = req.header("x-customer-feed-token");
  if (!token || token.length > 256) {
    res.status(401).json({ error: "CUSTOMER_FEED_AUTH_REQUIRED" });
    return undefined;
  }
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const [feed] = await db
    .select()
    .from(tradifyMt5CustomerFeeds)
    .where(
      and(
        eq(tradifyMt5CustomerFeeds.tokenHash, tokenHash),
        isNull(tradifyMt5CustomerFeeds.revokedAt),
      ),
    )
    .limit(1);
  if (!feed || !(await activeCustomerMt5Feed(feed.userId))) {
    res.status(401).json({ error: "CUSTOMER_FEED_AUTH_REQUIRED" });
    return undefined;
  }
  return { feed, store: customerMt5Store(feed.feedId) };
}

router.use(createProductLinkingRouter({
  requireUser,
  requestUser,
  requestIsSameOrigin,
}));

function customerStateMutationError(res: Response, error: unknown): void {
  if (error instanceof CustomerStateNotFoundError) {
    res.status(404).json({ error: "CUSTOMER_STATE_NOT_FOUND" });
    return;
  }
  if (error instanceof ConcurrentUpdateError) {
    res.status(409).json({ error: "CUSTOMER_STATE_CONFLICT" });
    return;
  }
  res.status(503).json({ error: "CUSTOMER_STATE_UNAVAILABLE" });
}

function setVersionEtag(res: Response, version: number): void {
  res.setHeader("ETag", `"${version}"`);
}

function mutationVersion(req: Request, fallback: number): number | undefined {
  const body = req.body;
  const bodyVersion =
    body && typeof body === "object" && "version" in body
      ? (body as Record<string, unknown>).version
      : undefined;
  const raw = bodyVersion ?? req.header("if-match");
  if (raw === undefined) return Number.isInteger(fallback) && fallback > 0 ? fallback : undefined;
  const normalized =
    typeof raw === "string"
      ? raw
          .trim()
          .replace(/^W\//, "")
          .replace(/^"(.*)"$/, "$1")
      : raw;
  const version = Number(normalized);
  return Number.isInteger(version) && version > 0 ? version : undefined;
}

function brokerSizingState(spec?: ReturnType<typeof marketCatalog.get>) {
  const brokerSpec = spec?.brokerSpec;
  const missing: string[] = [];
  if (!(brokerSpec?.contractSize && brokerSpec.contractSize > 0)) missing.push("contract size");
  if (!brokerSpec?.quoteCurrency) missing.push("quote currency");
  if (!brokerSpec?.volumeStep || brokerSpec.volumeStep <= 0) missing.push("volume step");
  return missing.length
    ? {
        status: "REVIEW_REQUIRED" as const,
        reason: "Complete market specifications are unavailable.",
      }
    : { status: "READY" as const, reason: "Complete market specifications received." };
}

function customerQuote(quote: Quote) {
  return {
    symbol: quote.symbol,
    bid: quote.bid,
    ask: quote.ask,
    last: quote.last,
    price: quote.price,
    displayPrice: quote.displayPrice,
    change: quote.change,
    changePercent: quote.changePercent,
    changeBasis: quote.changeBasis,
    time: quote.time,
    receivedAt: quote.receivedAt,
    status: quote.status,
    dataState: quote.dataState,
    sourceTimestamp: quote.sourceTimestamp,
    sourceAgeSeconds: quote.sourceAgeSeconds,
    referenceState: quote.referenceState,
    referenceCondition: quote.referenceCondition,
    referenceType: quote.referenceType,
    referenceBasis: quote.referenceBasis,
  };
}

function customerSignal(signal: Record<string, unknown>) {
  const targets = Array.isArray(signal.targets)
    ? signal.targets.filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
      )
    : [];
  const symbol = typeof signal.symbol === "string" ? signal.symbol : "MARKET";
  const levels = {
    direction: signal.direction,
    entry: signal.entry,
    buyEntry: signal.buyGate,
    sellEntry: signal.sellGate,
    ...customerChartContext(signal),
    stop: signal.stop,
    targets,
  };
  return {
    id: `opportunity-${symbol.toLowerCase()}`,
    symbol,
    name: signal.name,
    market: signal.market,
    direction: signal.direction,
    grade: signal.grade,
    action: customerText(String(signal.action ?? "")),
    lifecycleStatus: signal.lifecycleStatus,
    qualified: signal.qualified,
    price: signal.price,
    entry: signal.entry,
    stop: signal.stop,
    tp1: signal.tp1,
    tp2: signal.tp2,
    tp3: signal.tp3,
    targets,
    session: signal.session,
    age: signal.age,
    dataState: signal.dataState,
    ...(customerSetupLabel(signal.strategy)
      ? { setupLabel: customerSetupLabel(signal.strategy) }
      : {}),
    referenceState: signal.referenceState,
    sourceAgeSeconds: signal.sourceAgeSeconds,
    referenceCondition: signal.referenceCondition,
    levels,
  };
}

function customerSetupLabel(
  strategy: unknown,
): "Gold setup" | "FX setup" | "BBB setup" | "BBB Gold 3S" | null {
  switch (strategy) {
    case "DGV8":
      return "Gold setup";
    case "DGV8_FX":
      return "FX setup";
    case "BBB":
      return "BBB setup";
    case "BBB_GOLD_3S":
      return "BBB Gold 3S";
    default:
      return null;
  }
}

function customerCandles(result: {
  symbol: string;
  provider?: string;
  providerSymbol?: string;
  timeframe: string;
  timezone: string;
  candles: unknown[];
  dataState: string;
  displayOnly: boolean;
  validation?: unknown;
}) {
  if (!result) return undefined;
  return {
    symbol: result.symbol,
    timeframe: result.timeframe,
    timezone: result.timezone,
    candles: result.candles,
    dataState: result.dataState,
    displayOnly: result.displayOnly,
    validation: {
      valid: result.dataState === "LIVE" && !result.displayOnly,
      candleCount: result.candles.length,
      ...(result.displayOnly ? { reason: "Reference data is display-only." } : {}),
    },
  };
}

function customerBridgeStatus() {
  return { connected: bridgeStore.isConnected() };
}

function sendConcurrentUpdate(res: Response, error: ConcurrentUpdateError, latest?: object): void {
  res
    .status(409)
    .json({ error: error.code, message: error.message, ...(latest ? { latest } : {}) });
}

function broadcast(event: unknown) {
  const message = event && typeof event === "object" ? (event as Record<string, unknown>) : {};
  const symbol = typeof message.symbol === "string" ? message.symbol : "";
  const coreSymbols = coreMarketSymbolSet();
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const [client, membership] of sseClients) {
    if (
      (message.type === "QUOTE_UPDATE" || message.type === "CANDLE_UPDATE") &&
      (!symbol || !hasMarketAccess(symbol, membership, coreSymbols, canonicalSymbol))
    )
      continue;
    if (message.type === "CANDLE_UPDATE" && isQuoteOnlyMT5Symbol(symbol)) continue;
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

bridgeStore.onQuote((quote) =>
  broadcast({ type: "QUOTE_UPDATE", ...customerQuote(quote), timestamp: Date.now() }),
);
bridgeStore.onCandle((symbol, timeframe, candles) =>
  broadcast({
    type: "CANDLE_UPDATE",
    symbol,
    timeframe,
    dataState: "LIVE",
    displayOnly: false,
    candles,
    timestamp: Date.now(),
  }),
);
bridgeStore.onStatus(() =>
  broadcast({ type: "BRIDGE_STATUS", ...customerBridgeStatus(), timestamp: Date.now() }),
);

router.post("/auth/sign-in", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (requestsBrowserSession(req) && !requestIsSameOrigin(req)) {
    res.status(403).json({ error: "CSRF_REJECTED" });
    return;
  }
  try {
    await ensureRuntimeReady();
    const result = await authenticate(
      String(req.body?.email ?? ""),
      String(req.body?.password ?? ""),
    );
    try {
      await persistUser(result.user);
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError)) throw error;
      await persistLastSeen(result.user);
    }
    const browserSession = setCustomerWebSession(req, res, result.token);
    res.json({
      ok: true,
      ...(browserSession ? {} : { token: result.token }),
      user: customerPublicUser(result.user),
    });
  } catch {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
});

router.post("/auth/password-reset/request", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = RequestPasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_PASSWORD_RESET_REQUEST" });
    return;
  }
  if (!passwordResetEmailProvider.isConfigured()) {
    res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  let candidate: { id: string; status: string; deletedAt: string | null } | undefined;
  try {
    await ensureRuntimeReady();
    [candidate] = await db
      .select({
        id: tradifyUsers.id,
        status: tradifyUsers.status,
        deletedAt: tradifyUsers.deletedAt,
      })
      .from(tradifyUsers)
      .where(eq(tradifyUsers.email, email))
      .limit(1);
    if (!candidate || candidate.status !== "active" || candidate.deletedAt) {
      res.json(RequestPasswordResetResponse.parse({ ok: true }));
      return;
    }
  } catch {
    req.log.error(
      { code: "PASSWORD_RESET_LOOKUP_FAILED" },
      "Password reset request could not be processed",
    );
    res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
    return;
  }

  let reset: Awaited<ReturnType<typeof createPasswordResetToken>>;
  try {
    reset = await createPasswordResetToken(candidate.id);
  } catch {
    req.log.error(
      { code: "PASSWORD_RESET_TOKEN_ISSUE_FAILED" },
      "Password reset request could not be processed",
    );
    res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
    return;
  }

  if (reset) {
    try {
      await passwordResetEmailProvider.send(reset.email, reset.token);
    } catch (error) {
      const deliveryError = error instanceof PasswordResetEmailDeliveryError ? error : undefined;
      req.log.warn(
        {
          code: "PASSWORD_RESET_EMAIL_DELIVERY_FAILED",
          providerStatus: deliveryError?.providerStatus,
          providerCode: deliveryError?.providerCode,
        },
        "Password reset email could not be delivered",
      );
      try {
        await revokePasswordResetToken(reset.token);
      } catch {
        req.log.error(
          { code: "PASSWORD_RESET_TOKEN_REVOKE_FAILED" },
          "Undelivered password reset token could not be revoked",
        );
      }
    }
  }
  res.json(RequestPasswordResetResponse.parse({ ok: true }));
});

router.post("/auth/password-reset/complete", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = CompletePasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_PASSWORD_RESET" });
    return;
  }

  try {
    await ensureRuntimeReady();
    const completed = await completePasswordReset(parsed.data.token, parsed.data.password);
    if (!completed) {
      res.status(400).json({ error: "PASSWORD_RESET_INVALID_OR_EXPIRED" });
      return;
    }
    res.json(CompletePasswordResetResponse.parse({ ok: true }));
  } catch {
    req.log.error(
      { code: "PASSWORD_RESET_COMPLETION_FAILED" },
      "Password reset could not be completed",
    );
    res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
  }
});

router.post(
  "/admin/users/:id/password-reset",
  requireUser,
  requireCapability("users.manage"),
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const params = RequestAdminUserPasswordResetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "INVALID_USER_ID" });
      return;
    }

    let target: { id: string; email: string; role: string; deletedAt: string | null } | undefined;
    try {
      await ensureRuntimeReady();
      [target] = await db
        .select({
          id: tradifyUsers.id,
          email: tradifyUsers.email,
          role: tradifyUsers.role,
          deletedAt: tradifyUsers.deletedAt,
        })
        .from(tradifyUsers)
        .where(eq(tradifyUsers.id, params.data.id))
        .limit(1);
    } catch {
      req.log.error(
        { code: "ADMIN_PASSWORD_RESET_LOOKUP_FAILED" },
        "Customer password reset could not be processed",
      );
      res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
      return;
    }

    if (!target || target.role !== "user") {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    if (target.deletedAt) {
      res.status(409).json({ error: "USER_ACCOUNT_DELETED" });
      return;
    }

    try {
      const staff = await getStaffAccess(target.id);
      if (staff?.active) {
        res.status(404).json({ error: "USER_NOT_FOUND" });
        return;
      }
    } catch {
      req.log.error(
        { code: "ADMIN_PASSWORD_RESET_LOOKUP_FAILED", targetUserId: target.id },
        "Customer password reset could not be processed",
      );
      res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
      return;
    }

    if (!passwordResetEmailProvider.isConfigured()) {
      res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
      return;
    }

    let reset: Awaited<ReturnType<typeof createPasswordResetToken>>;
    try {
      reset = await createPasswordResetToken(target.id, { allowInactive: true });
    } catch {
      req.log.error(
        { code: "ADMIN_PASSWORD_RESET_TOKEN_ISSUE_FAILED", targetUserId: target.id },
        "Customer password reset token could not be issued",
      );
      res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
      return;
    }
    if (!reset) {
      res.status(409).json({ error: "USER_ACCOUNT_NOT_ACTIVE" });
      return;
    }

    const actor = requestUser(req);
    try {
      await recordAdminAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CUSTOMER_PASSWORD_RESET_EMAIL_REQUESTED",
        targetUserId: target.id,
        targetEmail: target.email,
        details: { delivery: "email" },
      });
    } catch {
      req.log.error(
        { code: "ADMIN_PASSWORD_RESET_AUDIT_FAILED", targetUserId: target.id },
        "Customer password reset request could not be audited",
      );
      try {
        await revokePasswordResetToken(reset.token);
      } catch {
        req.log.error(
          { code: "ADMIN_PASSWORD_RESET_TOKEN_REVOKE_FAILED", targetUserId: target.id },
          "Unaudited customer password reset token could not be revoked",
        );
      }
      res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
      return;
    }

    try {
      await passwordResetEmailProvider.send(reset.email, reset.token);
    } catch (error) {
      const deliveryError = error instanceof PasswordResetEmailDeliveryError ? error : undefined;
      req.log.warn(
        {
          code: "ADMIN_PASSWORD_RESET_EMAIL_DELIVERY_FAILED",
          targetUserId: target.id,
          providerStatus: deliveryError?.providerStatus,
          providerCode: deliveryError?.providerCode,
        },
        "Customer password reset email could not be delivered",
      );
      try {
        await revokePasswordResetToken(reset.token);
      } catch {
        req.log.error(
          { code: "ADMIN_PASSWORD_RESET_TOKEN_REVOKE_FAILED", targetUserId: target.id },
          "Undelivered customer password reset token could not be revoked",
        );
      }
      res.status(503).json({ error: "PASSWORD_RESET_UNAVAILABLE" });
      return;
    }

    try {
      await recordAdminAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CUSTOMER_PASSWORD_RESET_LINK_SENT",
        targetUserId: target.id,
        targetEmail: target.email,
        details: { delivery: "email" },
      });
    } catch {
      req.log.error(
        { code: "ADMIN_PASSWORD_RESET_AUDIT_FAILED", targetUserId: target.id },
        "Customer password reset audit event could not be recorded",
      );
    }
    res.json(RequestAdminUserPasswordResetResponse.parse({ ok: true }));
  },
);

router.get("/auth/admin-session", requireUser, requireStaff, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = requestUser(req);
  const staff = await getStaffAccess(user.id);
  if (!staff?.active) {
    res.status(403).json({ error: "STAFF_ACCESS_REQUIRED" });
    return;
  }
  res.json(
    GetAdminSessionResponse.parse({
      ok: true,
      user: publicUser(user),
      staff: staffAccessSummary(staff, { email: user.email, name: user.profile.name }),
    }),
  );
});

router.post("/auth/admin-session", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  if (!requestIsSameOrigin(req)) {
    res.status(403).json({ error: "CSRF_REJECTED" });
    return;
  }
  const parsed = CreateAdminSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  let result: Awaited<ReturnType<typeof authenticate>>;
  try {
    await ensureRuntimeReady();
    result = await authenticate(
      parsed.data.email,
      parsed.data.password,
      false,
      undefined,
      ADMIN_WEB_SESSION_TTL_MS,
    );
  } catch {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }

  try {
    await persistUser(result.user);
  } catch (error) {
    if (!(error instanceof ConcurrentUpdateError)) {
      res.status(503).json({ error: "SESSION_UNAVAILABLE" });
      return;
    }
    await persistLastSeen(result.user);
  }

  const user = await userFromToken(result.token);
  if (!user || user.status !== "active") {
    res.status(403).json({ error: "ACCOUNT_UNAVAILABLE" });
    return;
  }
  const staffAccess = await getStaffAccess(user.id);
  if (!staffAccess?.active) {
    res.status(403).json({ error: "STAFF_ACCESS_REQUIRED" });
    return;
  }

  res.cookie(ADMIN_SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_WEB_SESSION_TTL_MS,
  });
  res.json(
    CreateAdminSessionResponse.parse({
      ok: true,
      user: publicUser(user),
      staff: staffAccessSummary(staffAccess, { email: user.email, name: user.profile.name }),
    }),
  );
});

router.delete("/auth/admin-session", requireUser, async (req, res): Promise<void> => {
  const user = requestUser(req);
  await revokeUserSessions(user);
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
  });
  res.setHeader("Cache-Control", "no-store");
  res.json(LogoutAdminSessionResponse.parse({ ok: true }));
});

const CURRENT_RISK_DISCLAIMER_VERSION = "2026-10-13-v1";

router.post("/auth/register", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (requestsBrowserSession(req) && !requestIsSameOrigin(req)) {
    res.status(403).json({ error: "CSRF_REJECTED" });
    return;
  }
  const requestedUserId = req.body?.userId;
  try {
    await ensureRuntimeReady();
    const result = await authenticate(
      String(req.body?.email ?? ""),
      String(req.body?.password ?? ""),
      true,
      req.body?.userId,
    );
    if (
      req.body?.acceptRiskDisclaimer === true &&
      req.body?.riskDisclaimerVersion === CURRENT_RISK_DISCLAIMER_VERSION
    ) {
      result.user.riskDisclaimerVersion = CURRENT_RISK_DISCLAIMER_VERSION;
      result.user.riskDisclaimerAcceptedAt = new Date().toISOString();
    }
    try {
      await persistUser(result.user);
    } catch (error) {
      // The database primary key is authoritative across API instances. A
      // process-local user map can miss a concurrent registration, so turn
      // the losing insert into the same stable collision response.
      discardUnpersistedUser(result.user);
      if (
        error instanceof UserIdInUseError &&
        typeof requestedUserId === "string" &&
        requestedUserId.trim()
      ) {
        res.status(409).json({ error: "USER_ID_IN_USE" });
        return;
      }
      if (error instanceof EmailInUseError) {
        res.status(409).json({ error: "EMAIL_IN_USE" });
        return;
      }
      throw error;
    }
    let recovery: RevenueCatTransferRecoveryOutcome = "already-recovered";
    // A transfer may have arrived before this account was present. Recovery is
    // best-effort here so a provider outage never turns a successful signup
    // into a failed signup; the explicit reconciliation route remains available
    // once the account is ready.
    try {
      recovery = revenueCatTransferRecoveryOutcome(
        await reconcilePendingRevenueCatTransfers(result.user.id),
      );
    } catch (error) {
      req.log.warn({ error }, "RevenueCat transfer recovery deferred after registration");
    }
    const browserSession = setCustomerWebSession(req, res, result.token);
    res.status(201).json({
      ok: true,
      ...(browserSession ? {} : { token: result.token }),
      user: customerPublicUser(result.user),
      recovery,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_USER_ID") {
      res.status(400).json({ error: "INVALID_USER_ID" });
      return;
    }
    if (error instanceof Error && error.message === "USER_ID_IN_USE") {
      res.status(409).json({ error: "USER_ID_IN_USE" });
      return;
    }
    if (
      error instanceof EmailInUseError ||
      (error instanceof Error && error.message === "EMAIL_IN_USE")
    ) {
      res.status(409).json({ error: "EMAIL_IN_USE" });
      return;
    }
    res.status(400).json({ error: "INVALID_REGISTRATION" });
  }
});

router.post("/auth/logout", requireUser, async (req, res) => {
  await revokeUserSessions(requestUser(req));
  res.clearCookie(CUSTOMER_WEB_SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true });
});

router.delete("/user/account", requireUser, async (req, res) => {
  if (req.body?.confirmation !== "DELETE") {
    res.status(400).json({ error: "ACCOUNT_DELETION_CONFIRMATION_REQUIRED" });
    return;
  }
  try {
    const user = requestUser(req);
    const result = await completeAccountDeletion(user);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      requestId: result.requestId,
      completedAt: result.completedAt,
      subscriptionAction:
        "Store subscriptions must be cancelled separately in Apple App Store or Google Play account settings.",
    });
  } catch (error) {
    if (error instanceof ConcurrentUpdateError) {
      res.status(409).json({ error: "ACCOUNT_CHANGED_RETRY" });
      return;
    }
    req.log.error({ error }, "Account deletion failed");
    res.status(503).json({ error: "ACCOUNT_DELETION_UNAVAILABLE" });
  }
});

function webhookEventId(event: RevenueCatWebhookEvent): string | undefined {
  return typeof event.id === "string" && event.id.trim() ? event.id.trim() : undefined;
}

function webhookUserId(event: RevenueCatWebhookEvent): string | undefined {
  return typeof event.app_user_id === "string" && event.app_user_id.trim()
    ? event.app_user_id.trim()
    : undefined;
}

function billingEntitlements(user: ServerUser, membership: "Free" | "Pro" | "VIP"): string[] {
  return membership === "Free"
    ? [...user.entitlementGrants].filter((item) => !user.entitlementDenies.includes(item))
    : [...new Set([...PRO_ENTITLEMENTS, ...user.entitlementGrants])].filter(
        (item) => !user.entitlementDenies.includes(item),
      );
}

function hasActiveAdminMembershipOverride(user: ServerUser): boolean {
  if (user.membershipSource !== "ADMIN_OVERRIDE") return false;
  const expiresAt = user.overrideEndsAt !== undefined ? user.overrideEndsAt : user.trialEndsAt;
  if (!expiresAt) return true;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

async function expireAdminMembershipOverride(user: ServerUser): Promise<ServerUser> {
  return withRevenueCatTransferLock([user.id], async (database) => {
    const latest = (await getRevenueCatTransferUsers([user.id], database)).get(user.id);
    if (!latest) return user;
    if (latest.status !== "active") return latest;
    if (latest.membershipSource !== "ADMIN_OVERRIDE" || hasActiveAdminMembershipOverride(latest))
      return latest;
    const expiredUser = {
      ...latest,
      profile: { ...latest.profile, membership: "Free" as const },
      membershipSource: "UNKNOWN" as const,
      subscriptionStatus: "EXPIRED" as const,
      trialEndsAt: null,
      overrideEndsAt: null,
      billingExpiresAt: null,
      billingWillRenew: false,
      entitlements: billingEntitlements(latest, "Free"),
    };
    await persistUser(expiredUser, latest.version, undefined, database);
    return (await getRevenueCatTransferUsers([user.id], database)).get(user.id) ?? expiredUser;
  });
}

function applyBillingState(
  user: ServerUser,
  state: {
    membership: "Free" | "Pro" | "VIP";
    status:
      "ACTIVE" | "TRIALING" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | "INACTIVE" | "UNAVAILABLE";
    expiresAt: string | null;
    willRenew: boolean;
  },
  eventId: string,
  timestamp: number | null,
): ServerUser {
  const keepAdminOverride = hasActiveAdminMembershipOverride(user);
  const membership = keepAdminOverride ? user.profile.membership : state.membership;
  return {
    ...user,
    profile: { ...user.profile, membership },
    membershipSource: keepAdminOverride ? "ADMIN_OVERRIDE" : "REVENUECAT",
    subscriptionStatus:
      state.status === "INACTIVE" || state.status === "UNAVAILABLE" ? "EXPIRED" : state.status,
    billingExpiresAt: state.expiresAt,
    billingWillRenew: state.willRenew,
    billingEventId: eventId,
    ...(timestamp !== null ? { billingEventTimestamp: String(timestamp) } : {}),
    entitlements: billingEntitlements(user, membership),
  };
}

function revokeTransferredBilling(
  user: ServerUser,
  eventId: string,
  timestamp: number | null,
): ServerUser {
  return applyBillingState(
    user,
    {
      membership: "Free",
      status: "EXPIRED",
      expiresAt: null,
      willRenew: false,
    },
    eventId,
    timestamp,
  );
}

/**
 * Lifecycle and transfer deliveries share the same participant lock. For a
 * given account, lock acquisition establishes the database ordering boundary;
 * the handler then reloads the row and applies the event-timestamp check
 * inside that transaction. The process-local queue is only an optimization
 * and is never the source of ordering truth across API instances.
 */
export async function applyRevenueCatWebhook(
  event: RevenueCatWebhookEvent,
): Promise<"processed" | "duplicate" | "stale" | "ignored"> {
  const id = webhookEventId(event);
  const userId = webhookUserId(event);
  if (!id || !userId) return "ignored";
  return withRevenueCatTransferLock([userId], async (database) => {
    const user = (await getRevenueCatTransferUsers([userId], database)).get(userId);
    if (!user) return "ignored";
    if (user.status === "deleted") return "ignored";

    const previousId = user.billingEventId;
    if (previousId === id) return "duplicate";

    const state = mapRevenueCatWebhookEvent(event, user.profile.membership);
    if (!state) return "ignored";
    const timestamp = state.eventTimestampMs;
    if (timestamp === null) return "ignored";
    const previousTimestamp = user.billingEventTimestamp ? Number(user.billingEventTimestamp) : NaN;
    if (timestamp !== null && Number.isFinite(previousTimestamp) && timestamp < previousTimestamp)
      return "stale";

    const updatedUser = applyBillingState(user, state, id, timestamp);
    await persistUser(updatedUser, user.version, undefined, database);
    return "processed";
  });
}

async function applyRevenueCatTransfer(
  event: RevenueCatWebhookEvent,
  transfer: RevenueCatTransferState,
  lockDiagnostics: RevenueCatTransferLockDiagnostics,
): Promise<"processed" | "duplicate" | "stale" | "ignored"> {
  const participantIds = [
    ...new Set([...transfer.previousAppUserIds, ...transfer.destinationAppUserIds]),
  ];
  return withRevenueCatTransferLock(
    participantIds,
    async (database) => {
      const transferUsers = await getRevenueCatTransferUsers(participantIds, database);
      const destinationUsers = transfer.destinationAppUserIds
        .map((id) => transferUsers.get(id))
        .filter((user): user is ServerUser => user !== undefined && user.status !== "deleted");
      const hasMissingDestination = transfer.destinationAppUserIds.some((id) => {
        const destination = transferUsers.get(id);
        return !destination;
      });
      if (hasMissingDestination) {
        // Keep the validated transfer, not an entitlement snapshot. It can be
        // retried after a destination account is created and will still be
        // checked against RevenueCat before access is granted.
        await persistPendingRevenueCatTransfer(transfer, database);
      }

      const participantUsers = participantIds
        .map((id) => transferUsers.get(id))
        .filter((user): user is ServerUser => user !== undefined);
      if (!participantUsers.length) return "ignored";

      if (participantUsers.every((user) => user.billingEventId === transfer.eventId)) {
        if (!hasMissingDestination)
          await removePendingRevenueCatTransfer(transfer.eventId, database);
        return "duplicate";
      }

      const timestamp = transfer.eventTimestampMs;
      if (
        timestamp !== null &&
        participantUsers.some((user) => {
          const previousTimestamp = user.billingEventTimestamp
            ? Number(user.billingEventTimestamp)
            : NaN;
          return Number.isFinite(previousTimestamp) && timestamp < previousTimestamp;
        })
      ) {
        if (!hasMissingDestination)
          await removePendingRevenueCatTransfer(transfer.eventId, database);
        return "stale";
      }

      // A transfer can name an anonymous or not-yet-registered destination.
      // Never create that account or grant access based on the webhook alone.
      const destinationStates = new Map<
        string,
        Awaited<ReturnType<typeof revenueCatBillingProvider.get>>
      >();
      for (const destination of destinationUsers) {
        const state = await revenueCatBillingProvider.get(destination.id);
        // An unavailable provider is not an authoritative Free result. Retrying
        // keeps a legitimate destination from losing access during an outage.
        if (state.status === "UNAVAILABLE") {
          throw new RevenueCatTransferFailure("PROVIDER_UNAVAILABLE");
        }
        destinationStates.set(destination.id, state);
      }

      for (const destination of destinationUsers) {
        const state = destinationStates.get(destination.id);
        if (!state) continue;
        await persistUser(
          applyBillingState(destination, state, transfer.eventId, timestamp),
          destination.version,
          undefined,
          database,
        );
      }
      for (const previousId of transfer.previousAppUserIds) {
        const previous = transferUsers.get(previousId);
        if (
          !previous ||
          previous.status === "deleted" ||
          previous.billingEventId === transfer.eventId
        )
          continue;
        await persistUser(
          revokeTransferredBilling(previous, transfer.eventId, timestamp),
          previous.version,
          undefined,
          database,
        );
      }
      if (
        transfer.destinationAppUserIds.every((id) => {
          const destination = transferUsers.get(id);
          return (
            destination?.status === "deleted" || destination?.billingEventId === transfer.eventId
          );
        })
      ) {
        await removePendingRevenueCatTransfer(transfer.eventId, database);
      }
      return "processed";
    },
    lockDiagnostics,
  );
}

async function queueRevenueCatWebhook(
  event: RevenueCatWebhookEvent,
): Promise<RevenueCatTransferResult> {
  await ensurePendingRevenueCatTransfersReady();
  const transfer = mapRevenueCatTransferEvent(event);
  const userIds = transfer
    ? [...new Set([...transfer.previousAppUserIds, ...transfer.destinationAppUserIds])]
    : [webhookUserId(event)].filter((id): id is string => Boolean(id));
  if (!userIds.length) return "ignored";
  const previous = Promise.all(
    userIds.map((userId) => revenueCatWebhookQueues.get(userId) ?? Promise.resolve()),
  );
  const lockDiagnostics = transfer ? createRevenueCatTransferLockDiagnostics(userIds) : null;
  let result: RevenueCatTransferResult = "ignored";
  let current!: Promise<void>;
  current = previous
    .catch(() => undefined)
    .then(async () => {
      if (transfer) {
        const retryState = await revenueCatTransferRetryState(transfer.eventId);
        if (
          retryState.retryAfter &&
          Number.isFinite(Date.parse(retryState.retryAfter)) &&
          Date.now() < Date.parse(retryState.retryAfter)
        ) {
          // Do not call RevenueCat or add another audit row while this
          // transfer is inside its persisted backoff window.
          result = "deferred";
          return;
        }
      }
      result = transfer
        ? await applyRevenueCatTransfer(event, transfer, lockDiagnostics!)
        : await applyRevenueCatWebhook(event);
      if (transfer) await recordRevenueCatTransferOutcome(transfer, result, null, lockDiagnostics);
      else await recordRevenueCatLifecycleOutcome(event, result);
    })
    .finally(() => {
      for (const userId of userIds) {
        if (revenueCatWebhookQueues.get(userId) === current) revenueCatWebhookQueues.delete(userId);
      }
    });
  for (const userId of userIds) revenueCatWebhookQueues.set(userId, current);
  try {
    await current;
    return result;
  } catch (error) {
    if (transfer) {
      let retryAttempt = 1;
      try {
        retryAttempt = (await revenueCatTransferRetryState(transfer.eventId)).failureCount + 1;
      } catch (retryStateError) {
        logger.warn(
          {
            errorType:
              retryStateError instanceof Error ? retryStateError.name : typeof retryStateError,
          },
          "RevenueCat transfer retry state unavailable",
        );
      }
      const retryAfter = new Date(Date.now() + revenueCatRetryDelayMs(retryAttempt)).toISOString();
      await recordRevenueCatTransferOutcome(
        transfer,
        "failed",
        revenueCatTransferFailureCategory(error),
        lockDiagnostics,
        lockDiagnostics?.outcome === "FAILED" ? "LOCK" : "RECONCILIATION",
        retryAttempt,
        retryAfter,
      );
    }
    throw error;
  }
}

/**
 * Reconcile transfers that were safely recorded while their destination
 * account did not exist. The destination must already be a local account;
 * this function never creates an account or trusts a caller-supplied ID.
 */
export async function reconcilePendingRevenueCatTransfers(
  destinationUserId: string,
): Promise<RevenueCatTransferResult> {
  await ensurePendingRevenueCatTransfersReady();
  const pending = [...pendingRevenueCatTransfers.values()].filter((transfer) =>
    transfer.destinationAppUserIds.includes(destinationUserId),
  );
  if (!pending.length || !getUserById(destinationUserId)) return "ignored";

  let result: RevenueCatTransferResult = "ignored";
  for (const transfer of pending) {
    let transferResult: RevenueCatTransferResult;
    try {
      transferResult = await queueRevenueCatWebhook({
        id: transfer.eventId,
        type: "TRANSFER",
        app_user_id: destinationUserId,
        transferred_from: transfer.previousAppUserIds,
        transferred_to: transfer.destinationAppUserIds,
        event_timestamp_ms: transfer.eventTimestampMs ?? undefined,
      });
    } catch (error) {
      if (revenueCatTransferFailureCategory(error) !== "PROVIDER_UNAVAILABLE") throw error;
      transferResult = "deferred";
    }
    if (transferResult === "processed") result = "processed";
    else if (result === "ignored" && transferResult !== "ignored") result = transferResult;
  }
  return result;
}

router.post("/billing/revenuecat/webhook", async (req, res) => {
  if (!isRevenueCatWebhookAuthorized(req.header("authorization"))) {
    res.status(401).json({ error: "BILLING_WEBHOOK_UNAUTHORIZED" });
    return;
  }
  const event = req.body?.event;
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    res.status(400).json({ error: "INVALID_BILLING_WEBHOOK" });
    return;
  }
  const typedEvent = event as RevenueCatWebhookEvent;
  const isTransfer =
    typeof typedEvent.type === "string" && typedEvent.type.trim().toUpperCase() === "TRANSFER";
  if (!webhookEventId(typedEvent) || (!webhookUserId(typedEvent) && !isTransfer)) {
    res.status(400).json({ error: "INVALID_BILLING_WEBHOOK" });
    return;
  }
  if (isTransfer && !mapRevenueCatTransferEvent(typedEvent)) {
    res.status(400).json({ error: "INVALID_BILLING_WEBHOOK" });
    return;
  }
  try {
    await ensureRuntimeReady();
    const result = await queueRevenueCatWebhook(typedEvent);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, eventId: webhookEventId(typedEvent), result });
  } catch (error) {
    req.log.error({ error }, "RevenueCat webhook processing failed");
    res.status(503).json({ error: "BILLING_WEBHOOK_RETRY" });
  }
});

router.post("/billing/revenuecat/reconcile", requireUser, async (req, res) => {
  try {
    await ensureRuntimeReady();
    const result = await reconcilePendingRevenueCatTransfers(requestUser(req).id);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, result, recovery: revenueCatTransferRecoveryOutcome(result) });
  } catch (error) {
    req.log.error({ error }, "RevenueCat transfer recovery failed");
    res.status(503).json({ error: "BILLING_WEBHOOK_RETRY" });
  }
});

router.get(
  "/admin/billing/transfers/handoff",
  requireUser,
  requireCapability("payments.read"),
  async (req, res): Promise<void> => {
    const eventId = typeof req.query.eventId === "string" ? req.query.eventId.trim() : "";
    if (!eventId) {
      res.status(400).json({ error: "INVALID_EVENT_ID" });
      return;
    }
    const parsedAccountIds = parseBillingAccountIds(req.query.accountIds ?? req.query.accountId);
    if (parsedAccountIds.invalid) {
      res.status(400).json({ error: "INVALID_ACCOUNT_ID" });
      return;
    }
    const accountIds = parsedAccountIds.accountIds;
    await ensurePendingRevenueCatTransfersReady();
    const rows = await db.select().from(tradifyRevenueCatTransfers);
    const pendingRow = rows.find((row) => row.eventId === eventId);
    const pendingTransfer = pendingRow ? pendingTransferFromRow(pendingRow) : undefined;
    if (pendingRow && pendingTransfer) {
      const pendingDestinationAppUserIds = pendingTransfer.destinationAppUserIds.filter(
        (id) => !getUserById(id),
      );
      const matchedAccounts =
        billingTransferAccountMatches(
          accountIds,
          pendingTransfer.previousAppUserIds,
          pendingDestinationAppUserIds,
        ) ?? [];
      if (!pendingDestinationAppUserIds.length || (accountIds && !matchedAccounts.length)) {
        res.status(404).json({ error: "BILLING_TRANSFER_NOT_FOUND" });
        return;
      }
      const transferTimestamp =
        pendingTransfer.eventTimestampMs === null
          ? null
          : new Date(pendingTransfer.eventTimestampMs).toISOString();
      res.setHeader("Cache-Control", "no-store");
      res.json(
        createBillingTransferHandoff({
          eventId: pendingTransfer.eventId,
          status: "pending",
          transferTimestamp,
          previousAppUserIds: pendingTransfer.previousAppUserIds,
          destinationAppUserIds: pendingDestinationAppUserIds,
          pendingDestinationAppUserIds,
          matchedAccounts,
          receivedAt: pendingRow.createdAt,
          expiresAt: pendingRow.expiresAt,
          recordedAt: null,
          failureCategory: null,
          recoveryState: null,
          supportGuidance:
            "Wait for the destination account or use the existing delivery path before retention ends. Do not change entitlements manually.",
        }),
      );
      return;
    }

    let outcomeEntry: Awaited<ReturnType<typeof getAdminAuditLog>>[number] | undefined;
    for (let page = 1; ; page += 1) {
      const pageEntries = await getAdminAuditLog({
        actorId: REVENUECAT_AUDIT_ACTOR_ID,
        action: "BILLING_TRANSFER_OUTCOME",
        page,
        pageSize: REVENUECAT_TRANSFER_AUDIT_PAGE_SIZE,
      });
      outcomeEntry = pageEntries.find((entry) => entry.details.eventId === eventId);
      if (outcomeEntry || pageEntries.length < REVENUECAT_TRANSFER_AUDIT_PAGE_SIZE) break;
    }
    if (!outcomeEntry) {
      res.status(404).json({ error: "BILLING_TRANSFER_NOT_FOUND" });
      return;
    }

    const outcome =
      outcomeEntry.details.outcome === "processed" ||
      outcomeEntry.details.outcome === "duplicate" ||
      outcomeEntry.details.outcome === "stale" ||
      outcomeEntry.details.outcome === "ignored" ||
      outcomeEntry.details.outcome === "failed"
        ? outcomeEntry.details.outcome
        : "failed";
    const previousAppUserIds = billingHandoffIds(outcomeEntry.details.previousAppUserIds);
    const destinationAppUserIds = billingHandoffIds(outcomeEntry.details.destinationAppUserIds);
    const pendingDestinationAppUserIds = billingHandoffIds(
      outcomeEntry.details.pendingDestinationAppUserIds,
    );
    const matchedAccounts =
      billingTransferAccountMatches(accountIds, previousAppUserIds, destinationAppUserIds) ?? [];
    if (accountIds && !matchedAccounts.length) {
      res.status(404).json({ error: "BILLING_TRANSFER_NOT_FOUND" });
      return;
    }
    const transferTimestamp =
      typeof outcomeEntry.details.transferTimestamp === "string" &&
      Number.isFinite(Date.parse(outcomeEntry.details.transferTimestamp))
        ? outcomeEntry.details.transferTimestamp
        : null;
    const failureCategory =
      outcomeEntry.details.failureCategory === "PROVIDER_UNAVAILABLE" ||
      outcomeEntry.details.failureCategory === "RECONCILIATION_FAILED"
        ? outcomeEntry.details.failureCategory
        : null;
    const retryAttempt =
      typeof outcomeEntry.details.retryAttempt === "number" &&
      Number.isInteger(outcomeEntry.details.retryAttempt) &&
      outcomeEntry.details.retryAttempt > 0
        ? outcomeEntry.details.retryAttempt
        : null;
    const retryAfter =
      typeof outcomeEntry.details.retryAfter === "string" &&
      Number.isFinite(Date.parse(outcomeEntry.details.retryAfter))
        ? outcomeEntry.details.retryAfter
        : null;
    const recovery = revenueCatTransferRecovery(
      outcome,
      failureCategory,
      transferTimestamp,
      outcomeEntry.createdAt,
      Date.now(),
      retryAttempt,
      retryAfter,
    );
    res.setHeader("Cache-Control", "no-store");
    res.json(
      createBillingTransferHandoff({
        eventId,
        status: outcome,
        transferTimestamp,
        previousAppUserIds,
        destinationAppUserIds,
        pendingDestinationAppUserIds,
        matchedAccounts,
        receivedAt: null,
        expiresAt: recovery.retentionExpiresAt,
        recordedAt: outcomeEntry.createdAt,
        failureCategory,
        recoveryState: recovery.recoveryState,
        supportGuidance: recovery.supportGuidance,
      }),
    );
  },
);

router.get(
  "/admin/billing/catalog",
  requireUser,
  requireCapability("payments.read"),
  async (req, res): Promise<void> => {
    try {
      const summary = await revenueCatCatalogProvider.get();
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json(summary);
    } catch (error) {
      req.log.error({ error }, "RevenueCat catalog summary read failed");
      res.status(503).json({ error: "REVENUECAT_CATALOG_UNAVAILABLE" });
    }
  },
);

router.get(
  "/admin/billing/transfers",
  requireUser,
  requireCapability("payments.read"),
  async (req, res) => {
    const requestedFailureCategory = req.query.failureCategory;
    if (
      requestedFailureCategory !== undefined &&
      requestedFailureCategory !== "PROVIDER_UNAVAILABLE" &&
      requestedFailureCategory !== "RECONCILIATION_FAILED"
    ) {
      res.status(400).json({ error: "INVALID_FAILURE_CATEGORY" });
      return;
    }
    const failureCategory = requestedFailureCategory as
      RevenueCatTransferFailureCategory | undefined;
    const requestedEventId = req.query.eventId;
    if (
      requestedEventId !== undefined &&
      (typeof requestedEventId !== "string" || requestedEventId.trim().length === 0)
    ) {
      res.status(400).json({ error: "INVALID_EVENT_ID" });
      return;
    }
    const eventId = typeof requestedEventId === "string" ? requestedEventId.trim() : undefined;
    const parsedAccountIds = parseBillingAccountIds(req.query.accountIds ?? req.query.accountId);
    if (parsedAccountIds.invalid) {
      res.status(400).json({ error: "INVALID_ACCOUNT_ID" });
      return;
    }
    const accountIds = parsedAccountIds.accountIds;
    await ensurePendingRevenueCatTransfersReady();
    const rows = await db.select().from(tradifyRevenueCatTransfers);
    const pending = rows
      .map((row) => {
        const transfer = pendingTransferFromRow(row);
        if (!transfer) return undefined;
        const matchedAccounts = billingTransferAccountMatches(
          accountIds,
          transfer.previousAppUserIds,
          transfer.destinationAppUserIds,
        );
        if (accountIds && !matchedAccounts?.length) return undefined;
        const destinationAppUserIds = transfer.destinationAppUserIds.filter(
          (id) => !getUserById(id),
        );
        if (!destinationAppUserIds.length) return undefined;
        return {
          eventId: transfer.eventId,
          previousAppUserIds: transfer.previousAppUserIds,
          destinationAppUserIds,
          transferTimestamp:
            transfer.eventTimestampMs === null
              ? null
              : new Date(transfer.eventTimestampMs).toISOString(),
          receivedAt: row.createdAt,
          expiresAt: row.expiresAt,
          ...(matchedAccounts ? { matchedAccounts } : {}),
        };
      })
      .filter((transfer): transfer is NonNullable<typeof transfer> => Boolean(transfer))
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
    const auditPageSize =
      failureCategory === undefined && !accountIds && eventId === undefined
        ? 50
        : REVENUECAT_TRANSFER_AUDIT_PAGE_SIZE;
    const auditEntries: Awaited<ReturnType<typeof getAdminAuditLog>> = [];
    for (let page = 1; ; page += 1) {
      const pageEntries = await getAdminAuditLog({
        actorId: REVENUECAT_AUDIT_ACTOR_ID,
        action: "BILLING_TRANSFER_OUTCOME",
        detailsFailureCategory: failureCategory,
        page,
        pageSize: auditPageSize,
      });
      auditEntries.push(...pageEntries);
      if (
        (failureCategory === undefined && !accountIds && eventId === undefined) ||
        pageEntries.length < auditPageSize
      )
        break;
    }
    const outcomes = auditEntries
      .filter(
        (entry) => typeof entry.details.eventId === "string" && entry.details.eventId.length > 0,
      )
      .filter((entry) => eventId === undefined || entry.details.eventId === eventId)
      .filter(
        (entry) =>
          failureCategory === undefined || entry.details.failureCategory === failureCategory,
      )
      .filter(
        (entry) =>
          !accountIds ||
          billingTransferIncludesAnyAccount(accountIds, entry.details.previousAppUserIds) ||
          billingTransferIncludesAnyAccount(accountIds, entry.details.destinationAppUserIds),
      )
      .map((entry) => {
        const outcome =
          typeof entry.details.outcome === "string" ? entry.details.outcome : "failed";
        const transferTimestamp =
          typeof entry.details.transferTimestamp === "string"
            ? entry.details.transferTimestamp
            : null;
        const previousAppUserIds = Array.isArray(entry.details.previousAppUserIds)
          ? entry.details.previousAppUserIds.filter((id): id is string => typeof id === "string")
          : [];
        const destinationAppUserIds = Array.isArray(entry.details.destinationAppUserIds)
          ? entry.details.destinationAppUserIds.filter((id): id is string => typeof id === "string")
          : [];
        const matchedAccounts = billingTransferAccountMatches(
          accountIds,
          previousAppUserIds,
          destinationAppUserIds,
        );
        const failureCategory =
          entry.details.failureCategory === "PROVIDER_UNAVAILABLE" ||
          entry.details.failureCategory === "RECONCILIATION_FAILED"
            ? entry.details.failureCategory
            : null;
        const retryAttempt =
          typeof entry.details.retryAttempt === "number" &&
          Number.isInteger(entry.details.retryAttempt) &&
          entry.details.retryAttempt > 0
            ? entry.details.retryAttempt
            : null;
        const retryAfter =
          typeof entry.details.retryAfter === "string" &&
          Number.isFinite(Date.parse(entry.details.retryAfter))
            ? entry.details.retryAfter
            : null;
        return {
          ...entry,
          details: {
            eventId: typeof entry.details.eventId === "string" ? entry.details.eventId : "",
            outcome,
            transferTimestamp,
            previousAppUserIds,
            destinationAppUserIds,
            pendingDestinationAppUserIds: Array.isArray(entry.details.pendingDestinationAppUserIds)
              ? entry.details.pendingDestinationAppUserIds.filter(
                  (id): id is string => typeof id === "string",
                )
              : [],
            ...(matchedAccounts ? { matchedAccounts } : {}),
            failureCategory,
            failurePhase:
              entry.details.failurePhase === "LOCK" ||
              entry.details.failurePhase === "RECONCILIATION"
                ? entry.details.failurePhase
                : null,
            lock: (() => {
              const lock = entry.details.lock;
              if (!lock || typeof lock !== "object" || Array.isArray(lock)) return null;
              const diagnostic = lock as Record<string, unknown>;
              const lockOutcome = diagnostic.outcome;
              const waitMs = diagnostic.waitMs;
              const participantCount = diagnostic.participantCount;
              if (
                (lockOutcome !== "ACQUIRED" &&
                  lockOutcome !== "WAITED" &&
                  lockOutcome !== "FAILED") ||
                typeof waitMs !== "number" ||
                !Number.isFinite(waitMs) ||
                waitMs < 0 ||
                typeof participantCount !== "number" ||
                !Number.isInteger(participantCount) ||
                participantCount < 0
              )
                return null;
              return { outcome: lockOutcome, waitMs, participantCount };
            })(),
            ...revenueCatTransferRecovery(
              outcome,
              failureCategory,
              transferTimestamp,
              entry.createdAt,
              Date.now(),
              retryAttempt,
              retryAfter,
            ),
          },
        };
      });
    res.setHeader("Cache-Control", "no-store");
    res.json({ pending, outcomes });
  },
);

router.get("/auth/me", requireUser, (req, res) =>
  res.json({ user: customerPublicUser(requestUser(req)) }),
);
router.post("/user/risk-disclaimer/acknowledge", requireUser, async (req, res) => {
  if (req.body?.version !== CURRENT_RISK_DISCLAIMER_VERSION) {
    res.status(409).json({ error: "RISK_DISCLAIMER_VERSION_CHANGED" });
    return;
  }
  const user = requestUser(req);
  user.riskDisclaimerVersion = CURRENT_RISK_DISCLAIMER_VERSION;
  user.riskDisclaimerAcceptedAt = new Date().toISOString();
  await persistUser(user);
  res.json({ ok: true, user: customerPublicUser(user) });
});
router.post("/user/sync", requireUser, (req, res) =>
  res.json({ ok: true, user: customerPublicUser(requestUser(req)) }),
);

let lastDevelopmentMarketProxyWarningAt = 0;

function coreMarketSymbolSet(): ReadonlySet<string> {
  return new Set(getCatalog().map((item) => item.symbol));
}

function isQuoteOnlyMT5Symbol(rawSymbol: string): boolean {
  const normalized = rawSymbol.trim().toUpperCase();
  return MT5_MARKET_SYMBOLS.has(normalized) && !coreMarketSymbolSet().has(normalized);
}

async function customerMembershipForRequest(req: Request): Promise<CustomerMembershipTier> {
  const token = tokenFromRequest(req);
  if (!token) return "Free";
  try {
    await ensureRuntimeReady();
    let user = await userFromToken(token);
    if (!user || user.status !== "active") return "Free";
    if (user.membershipSource === "ADMIN_OVERRIDE" && !hasActiveAdminMembershipOverride(user)) {
      user = await expireAdminMembershipOverride(user);
    }
    return user.profile.membership;
  } catch {
    // An unavailable or invalid session never grants paid market data.
    return "Free";
  }
}

function customerPublicUser(user: ServerUser) {
  const customer = publicUser(user);
  return hasFeatureAccess(user.profile.membership, "priceAlerts")
    ? customer
    : { ...customer, alertSymbols: [] };
}

function sendFeatureTierRequired(res: Response, feature: CustomerFeature): void {
  res.status(403).json({
    error: "FEATURE_TIER_REQUIRED",
    feature,
    requiredTier: requiredFeatureTier(feature),
  });
}

function customerTradeForMembership(trade: Trade, membership: CustomerMembershipTier) {
  if (hasMarketAccess(trade.symbol, membership, coreMarketSymbolSet(), canonicalSymbol)) {
    return { ...trade, locked: false };
  }
  return {
    id: trade.id,
    symbol: trade.symbol,
    direction: trade.direction,
    status: trade.status,
    locked: true,
  };
}

function customerMarketQuotes(
  quotes: Record<string, Quote>,
  membership: CustomerMembershipTier,
): Record<string, Quote> {
  const coreSymbols = coreMarketSymbolSet();
  return Object.fromEntries(
    Object.entries(quotes).filter(([symbol]) =>
      hasMarketAccess(symbol, membership, coreSymbols, canonicalSymbol),
    ),
  );
}

function withMt5WatchlistQuotes(quotes: Record<string, Quote>): Record<string, Quote> {
  return {
    ...getMT5WatchlistQuotes(MT5_WATCHLIST_QUOTE_SYMBOLS),
    ...quotes,
  };
}

async function addDevelopmentLiveMarketQuotes(
  localQuotes: Record<string, Quote>,
): Promise<Record<string, Quote>> {
  const upstream = await fetchDevelopmentMarketQuotes();
  if (upstream.kind === "unavailable") {
    const now = Date.now();
    if (now - lastDevelopmentMarketProxyWarningAt >= 30_000) {
      lastDevelopmentMarketProxyWarningAt = now;
      logger.warn("Development market-data upstream is unavailable; returning local quote state.");
    }
    return localQuotes;
  }
  return upstream.kind === "available"
    ? mergeDevelopmentMarketQuotes(localQuotes, upstream.quotes)
    : localQuotes;
}

type CustomerSnapshotMarketData = {
  displayQuotes: Record<string, Quote>;
  signals: Awaited<ReturnType<typeof getSignals>>;
  profile: Record<string, number>;
};

let customerSnapshotMarketDataInFlight: Promise<CustomerSnapshotMarketData> | undefined;

function getCustomerSnapshotMarketData(
  profileEnabled: boolean,
): Promise<CustomerSnapshotMarketData> {
  if (customerSnapshotMarketDataInFlight) return customerSnapshotMarketDataInFlight;

  const profile: Record<string, number> = {};
  const measure = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    if (!profileEnabled) return operation();
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      profile[name] = performance.now() - startedAt;
    }
  };
  const computation = (async () => {
    const quotes = await measure("quotes", () => getQuotes());
    // Signals continue to use the local-authority quote set. Remote and MT5
    // display quotes are merged only after strategy evaluation.
    const signals = await measure("signals", () => getSignals(quotes));
    const liveQuotes = await measure("live_quotes", () => getLiveQuotes());
    const liveDisplayQuotes = mergeDevelopmentMarketQuotes(
      quotes,
      withMt5WatchlistQuotes(liveQuotes),
    );
    const displayQuotes = await measure("development_upstream", () =>
      addDevelopmentLiveMarketQuotes(liveDisplayQuotes),
    );
    return { displayQuotes, signals, profile };
  })();
  customerSnapshotMarketDataInFlight = computation;
  const clearInFlight = () => {
    if (customerSnapshotMarketDataInFlight === computation) {
      customerSnapshotMarketDataInFlight = undefined;
    }
  };
  void computation.then(clearInFlight, clearInFlight);
  return computation;
}

router.get("/market/snapshot", async (req, res) => {
  const profileEnabled = env.profileMarketSnapshotEnabled;
  const profile: Record<string, number> = {};
  const membershipPromise = (async () => {
    if (!profileEnabled) return customerMembershipForRequest(req);
    const startedAt = performance.now();
    try {
      return await customerMembershipForRequest(req);
    } finally {
      profile.membership = performance.now() - startedAt;
    }
  })();
  const snapshotPromise = getCustomerSnapshotMarketData(profileEnabled);
  const [membership, snapshotData] = await Promise.all([membershipPromise, snapshotPromise]);
  if (profileEnabled) {
    Object.assign(profile, snapshotData.profile);
  }
  const coreSymbols = coreMarketSymbolSet();
  const canViewSignalContext = hasFeatureAccess(membership, "signalContext");
  const { displayQuotes, signals } = snapshotData;
  const responseStartedAt = profileEnabled ? performance.now() : 0;
  const customerQuotes = Object.fromEntries(
    Object.entries(customerMarketQuotes(displayQuotes, membership)).map(([symbol, quote]) => [
      symbol,
      customerQuote(quote),
    ]),
  );
  const customerSignals = (canViewSignalContext ? signals : [])
    .filter((signal) => hasMarketAccess(signal.symbol, membership, coreSymbols, canonicalSymbol))
    .map((signal) => customerSignal(signal as unknown as Record<string, unknown>));
  const marketSetups = (canViewSignalContext ? marketCatalog.getVisible() : [])
    .filter((item) =>
      hasMarketAccess(item.canonicalSymbol, membership, coreSymbols, canonicalSymbol),
    )
    .map((item) => ({
      symbol: item.canonicalSymbol,
      setupLabel: item.strategyConfigured ? customerSetupLabel(item.defaultStrategyId) : null,
      availableSetups: (item.availableStrategies ?? [])
        .map(customerSetupLabel)
        .filter(
          (label): label is NonNullable<ReturnType<typeof customerSetupLabel>> => label !== null,
        ),
    }));
  if (profileEnabled) {
    profile.response_shape = performance.now() - responseStartedAt;
    res.setHeader(
      "Server-Timing",
      Object.entries(profile)
        .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
        .join(", "),
    );
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    timestamp: new Date().toISOString(),
    bridge: customerBridgeStatus(),
    quotes: customerQuotes,
    signals: customerSignals,
    marketSetups,
  });
});

router.get("/market/quotes", async (req, res) => {
  const membership = await customerMembershipForRequest(req);
  res.setHeader("Cache-Control", "no-store");
  const quotes = await addDevelopmentLiveMarketQuotes(
    withMt5WatchlistQuotes(await getLiveQuotes()),
  );
  res.json({
    timestamp: new Date().toISOString(),
    bridge: customerBridgeStatus(),
    quotes: Object.fromEntries(
      Object.entries(customerMarketQuotes(quotes, membership)).map(([symbol, quote]) => [
        symbol,
        customerQuote(quote),
      ]),
    ),
  });
});

router.get("/market/stream", async (req, res) => {
  const membership = await customerMembershipForRequest(req);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  sseClients.set(res, membership);
  res.write(
    `data: ${JSON.stringify({ type: "BRIDGE_STATUS", ...customerBridgeStatus(), timestamp: Date.now() })}\n\n`,
  );
  const sendQuotes = (quotes: Record<string, Quote>) => {
    for (const quote of Object.values(customerMarketQuotes(quotes, membership))) {
      res.write(
        `data: ${JSON.stringify({ type: "QUOTE_UPDATE", ...customerQuote(quote), timestamp: Date.now() })}\n\n`,
      );
    }
  };
  void getQuotes()
    .then((quotes) => addDevelopmentLiveMarketQuotes(withMt5WatchlistQuotes(quotes)))
    .then(sendQuotes)
    .catch(() => undefined);
  const refresh = setInterval(() => {
    void getLiveQuotes()
      .then((quotes) => addDevelopmentLiveMarketQuotes(withMt5WatchlistQuotes(quotes)))
      .then(sendQuotes)
      .catch(() => undefined);
  }, 15_000);
  const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(refresh);
    clearInterval(ping);
    sseClients.delete(res);
  });
});

router.get("/market/candles", async (req, res) => {
  const symbol = String(req.query.symbol ?? "");
  const timeframe = String(req.query.timeframe ?? req.query.interval ?? "M15")
    .toUpperCase()
    .replace("15M", "M15")
    .replace("1H", "H1")
    .replace("4H", "H4")
    .replace("1D", "D1")
    .replace("1W", "W1")
    .replace("1MO", "MN1");
  if (isQuoteOnlyMT5Symbol(symbol)) {
    res.status(403).json({ error: "QUOTE_ONLY_MARKET" });
    return;
  }
  if (!catalogItem(symbol)) {
    res.status(400).json({ error: "INVALID_SYMBOL" });
    return;
  }
  const membership = await customerMembershipForRequest(req);
  const coreSymbols = coreMarketSymbolSet();
  if (!hasMarketAccess(symbol, membership, coreSymbols, canonicalSymbol)) {
    res.status(403).json({
      error: "MARKET_TIER_REQUIRED",
      requiredTier: requiredMarketTier(symbol, coreSymbols, canonicalSymbol),
    });
    return;
  }
  if (!hasFeatureAccess(membership, "trustedSetupLevels")) {
    sendFeatureTierRequired(res, "trustedSetupLevels");
    return;
  }
  if (!chartTimeframes.includes(timeframe as (typeof chartTimeframes)[number])) {
    res.status(400).json({
      error: "INVALID_TIMEFRAME",
      dataState: "ERROR",
      displayOnly: false,
      symbol,
      timeframe,
    });
    return;
  }
  const limit = Math.min(Number(req.query.limit) || 500, 1000);
  const result = await getCandles(symbol, timeframe, limit);
  if (!result || result.dataState !== "LIVE" || result.displayOnly) {
    const upstream = await fetchDevelopmentMarketCandles(symbol, timeframe, limit);
    if (upstream.kind === "available") {
      const localLastTime = result?.candles.at(-1)?.time ?? 0;
      const upstreamLastTime = upstream.series.candles.at(-1)?.time ?? 0;
      const shouldUseUpstream =
        !result || upstream.series.sourceDataState === "LIVE" || upstreamLastTime > localLastTime;
      if (shouldUseUpstream) {
        const referenceCandles = {
          ...upstream.series,
          dataState: "FALLBACK" as const,
          displayOnly: true,
          validation: {
            valid: false,
            candleCount: upstream.series.candles.length,
            reason:
              "Development upstream candles are reference-only and never used for strategy evaluation.",
          },
        };
        res.setHeader("Cache-Control", "no-store");
        res.json({
          ...customerCandles(referenceCandles),
          count: referenceCandles.candles.length,
          firstTime: referenceCandles.candles[0]?.time ?? null,
          lastTime: referenceCandles.candles.at(-1)?.time ?? null,
        });
        return;
      }
    }
  }
  if (!result) {
    res
      .status(404)
      .json({ error: "NO_CANDLE_DATA", dataState: "ERROR", displayOnly: false, symbol, timeframe });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ...customerCandles(result),
    count: result.candles.length,
    firstTime: result.candles[0]?.time ?? null,
    lastTime: result.candles.at(-1)?.time ?? null,
  });
});

router.get("/markets/catalog", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const membership = await customerMembershipForRequest(req);
  const coreSymbols = coreMarketSymbolSet();
  const canViewSetups = hasFeatureAccess(membership, "trustedSetupLevels");
  const marketQuotes = await getQuotes();
  const quoteOnlyQuotes = withMt5WatchlistQuotes(await getLiveQuotes());
  const quotes = await addDevelopmentLiveMarketQuotes(
    mergeDevelopmentMarketQuotes(marketQuotes, quoteOnlyQuotes),
  );
  const catalog = getCatalog().map((item) => {
    const catalogEntry = marketCatalog.get(item.symbol);
    const requiredTier = requiredMarketTier(item.symbol, coreSymbols, canonicalSymbol) ?? "Pro";
    const accessible = hasMarketAccess(item.symbol, membership, coreSymbols, canonicalSymbol);
    const quote = accessible ? quotes[item.symbol] : undefined;
    const availableSetups = (catalogEntry?.availableStrategies ?? [])
      .map(customerSetupLabel)
      .filter(
        (label): label is NonNullable<ReturnType<typeof customerSetupLabel>> => label !== null,
      );
    return {
      symbol: item.symbol,
      name: item.name,
      assetClass: item.symbol === "USOIL" ? "COMMODITIES" : item.assetClass,
      digits: item.digits,
      sizingStatus: brokerSizingState(catalogEntry ?? undefined).status,
      currentPrice: quote?.price ?? 0,
      bid: quote?.bid ?? 0,
      ask: quote?.ask ?? 0,
      quoteState:
        quote?.dataState === "LIVE"
          ? "LIVE"
          : quote?.dataState === "FALLBACK"
            ? "REFERENCE"
            : "DISCONNECTED",
      opportunityState: accessible ? "ACTIVE" : "PAUSED",
      availableSetups: accessible && canViewSetups ? availableSetups : [],
      defaultSetupLabel:
        accessible && canViewSetups && catalogEntry?.strategyConfigured
          ? customerSetupLabel(catalogEntry.defaultStrategyId)
          : null,
      requiredTier,
      accessible,
      strategySupported: true,
    };
  });
  const quoteOnlyMarkets = MT5_WATCHLIST_QUOTE_SYMBOLS.filter(
    (symbol) => !coreSymbols.has(symbol),
  ).map((symbol) => {
    const requiredTier = "VIP" as const;
    const accessible = hasMarketAccess(symbol, membership, coreSymbols, canonicalSymbol);
    const quote = accessible ? quotes[symbol] : undefined;
    return {
      symbol,
      name: mt5WatchlistMarketNames[symbol] ?? symbol,
      assetClass: mt5WatchlistAssetClass(symbol),
      digits: mt5WatchlistDigits(symbol),
      sizingStatus: "REVIEW_REQUIRED",
      currentPrice: quote?.price ?? 0,
      bid: quote?.bid ?? 0,
      ask: quote?.ask ?? 0,
      quoteState:
        quote?.dataState === "LIVE"
          ? "LIVE"
          : quote?.dataState === "FALLBACK"
            ? "REFERENCE"
            : "DISCONNECTED",
      opportunityState: "PAUSED",
      availableSetups: [],
      defaultSetupLabel: null,
      requiredTier,
      accessible,
      strategySupported: false,
    };
  });
  res.json([...catalog, ...quoteOnlyMarkets]);
});

router.get("/signals/current", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const membership = await customerMembershipForRequest(req);
  const coreSymbols = coreMarketSymbolSet();
  const rawSymbol = req.query.symbol ? String(req.query.symbol) : undefined;
  if (rawSymbol && isQuoteOnlyMT5Symbol(rawSymbol)) {
    res.status(403).json({ error: "QUOTE_ONLY_MARKET" });
    return;
  }
  const symbol = rawSymbol ? canonicalSymbol(rawSymbol) : undefined;
  if (rawSymbol && !symbol) {
    res.status(400).json({ error: "INVALID_SYMBOL" });
    return;
  }
  if (symbol) {
    if (!hasMarketAccess(rawSymbol ?? symbol, membership, coreSymbols, canonicalSymbol)) {
      res.status(403).json({
        error: "MARKET_TIER_REQUIRED",
        requiredTier: requiredMarketTier(rawSymbol ?? symbol, coreSymbols, canonicalSymbol),
      });
      return;
    }
    if (!hasFeatureAccess(membership, "signalContext")) {
      sendFeatureTierRequired(res, "signalContext");
      return;
    }
    const evaluation = await evaluateSymbol(symbol);
    if (!evaluation) {
      res.status(404).json({ error: "SIGNAL_NOT_FOUND" });
      return;
    }
    res.json(customerSignal(toSignalCard(evaluation) as unknown as Record<string, unknown>));
    return;
  }
  res.json(
    (hasFeatureAccess(membership, "signalContext") ? await getSignals() : [])
      .filter((signal) => hasMarketAccess(signal.symbol, membership, coreSymbols, canonicalSymbol))
      .map((signal) => customerSignal(signal as unknown as Record<string, unknown>)),
  );
});

router.get("/signals/evaluate", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const rawSymbol = String(req.query.symbol ?? "");
  if (isQuoteOnlyMT5Symbol(rawSymbol)) {
    res.status(403).json({ error: "QUOTE_ONLY_MARKET" });
    return;
  }
  const symbol = canonicalSymbol(rawSymbol);
  if (!symbol) {
    res.status(400).json({ error: "INVALID_SYMBOL" });
    return;
  }
  const membership = await customerMembershipForRequest(req);
  const coreSymbols = coreMarketSymbolSet();
  if (!hasMarketAccess(rawSymbol, membership, coreSymbols, canonicalSymbol)) {
    res.status(403).json({
      error: "MARKET_TIER_REQUIRED",
      requiredTier: requiredMarketTier(rawSymbol, coreSymbols, canonicalSymbol),
    });
    return;
  }
  if (!hasFeatureAccess(membership, "signalContext")) {
    sendFeatureTierRequired(res, "signalContext");
    return;
  }
  const requestedStrategy = typeof req.query.strategy === "string" ? req.query.strategy : undefined;
  if (requestedStrategy) {
    const requestedStrategyId = requestedStrategy.trim().toUpperCase().replace(/[- ]+/g, "_");
    const item = marketCatalog.get(symbol);
    const available =
      item?.availableStrategies ?? (item?.defaultStrategyId ? [item.defaultStrategyId] : []);
    if (!item?.enabled || !available.includes(requestedStrategyId)) {
      res.status(400).json({ error: "SETUP_NOT_AVAILABLE_FOR_SYMBOL" });
      return;
    }
  }
  const evaluation = await evaluateSymbol(symbol, requestedStrategy);
  if (!evaluation) {
    res.status(404).json({ error: "SIGNAL_NOT_FOUND" });
    return;
  }
  res.json({
    signal: customerSignal(toSignalCard(evaluation) as unknown as Record<string, unknown>),
    quote: evaluation.quote ? customerQuote(evaluation.quote) : null,
    candles: customerCandles({
      symbol: evaluation.symbol,
      provider: evaluation.provider,
      providerSymbol: evaluation.providerSymbol,
      timeframe: "M15",
      timezone: "UTC",
      candles: evaluation.candles,
      dataState: evaluation.dataState,
      displayOnly: evaluation.provider !== "MT5" || evaluation.dataState === "FALLBACK",
      validation: evaluation.validation,
    }),
  });
});

router.get(
  "/signals/diagnostic",
  requireUser,
  requireCapability("signals.read"),
  async (req, res) => {
    const symbol = canonicalSymbol(String(req.query.symbol ?? ""));
    if (!symbol) {
      res.status(400).json({ error: "INVALID_SYMBOL" });
      return;
    }
    const evaluation = await evaluateSymbol(
      symbol,
      typeof req.query.strategy === "string" ? req.query.strategy : undefined,
    );
    if (!evaluation) {
      res.status(404).json({ error: "SIGNAL_NOT_FOUND" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(diagnosticFor(evaluation));
  },
);

router.get("/mt5/bridge/status", requireUser, requireCapability("market_data.read"), (_req, res) =>
  res.json(bridgeStore.getStatus()),
);
router.get("/mt5/bridge/subscriptions", requireBridge, async (_req, res) => {
  const markets = await listEffectiveMarkets();
  const symbols = mt5StrategyBrokerSymbols(markets, mt5BridgeStore.getMappings());
  const bridge = bridgeStore.getStatus();
  const quoteSymbols = mt5WatchlistQuoteSymbols(bridge.availableSymbols, symbols, bridge.connected);
  const isBackfilled = mt5BridgeStore.isBackfillCompleted();
  res.json({
    version: bridge.subscriptionVersion,
    symbols,
    quoteSymbols,
    generationId: mt5BridgeStore.getServerGenerationId(),
    isBackfilled,
    requireFullSync: !isBackfilled,
  });
});
router.get("/mt5/bridge/config", requireBridge, async (_req, res) => {
  const markets = await listEffectiveMarkets();
  const symbols = mt5StrategyBrokerSymbols(markets, mt5BridgeStore.getMappings());
  const bridge = bridgeStore.getStatus();
  const quoteSymbols = mt5WatchlistQuoteSymbols(bridge.availableSymbols, symbols, bridge.connected);
  const isBackfilled = mt5BridgeStore.isBackfillCompleted();
  res.json({
    serverGenerationId: mt5BridgeStore.getServerGenerationId(),
    requireFullSync: !isBackfilled,
    isBackfilled,
    symbols,
    quoteSymbols,
  });
});
router.get("/mt5/bridge/mappings", requireBridge, (_req, res) =>
  res.json(bridgeStore.getMappings()),
);

router.get("/admin/overview", requireUser, requireCapability("configuration.read"), (_req, res) => {
  setVersionEtag(res, engineState.getVersion());
  res.json({
    engine: engineState.get(),
    bridge: bridgeStore.getStatus(),
    stats: adminStats(),
    catalogSize: getCatalog().length,
    health: {
      database: { status: "READY", latencyMs: null },
      billing: { status: "NOT_CONFIGURED", mode: "SANDBOX", credentialsConfigured: false },
      activeSseConnections: sseClients.size,
      brokerSpecifications: {
        status: "MT5_BRIDGE",
        count: marketCatalog.getAll().filter((item) => item.brokerSpec).length,
      },
      engine: {
        mode: engineState.get().mode,
        lastBootAt: engineState.get().updatedAt,
        autoRecovery: "READY",
      },
      mt5: {
        status: bridgeStore.getStatus().status,
        lastHeartbeat: bridgeStore.getStatus().lastHeartbeat,
        lastHeartbeatAgeSeconds: bridgeStore.getStatus().lastHeartbeat
          ? Math.max(0, Math.floor((Date.now() - bridgeStore.getStatus().lastHeartbeat) / 1000))
          : null,
        activeSubscribedSymbols: bridgeStore.getStatus().activeCount,
      },
      validator: {
        guardCount: 7,
        status: bridgeStore.getStatus().connected ? "RUNNING" : "PAUSED",
      },
    },
  });
});

router.get(
  "/admin/engine/status",
  requireUser,
  requireCapability("configuration.read"),
  (_req, res) => {
    setVersionEtag(res, engineState.getVersion());
    res.json(engineState.get());
  },
);

router.post(
  "/admin/engine/pause",
  requireUser,
  requireCapability("configuration.manage"),
  async (req, res) => {
    const actor = requestUser(req);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const expectedVersion = mutationVersion(req, engineState.getVersion());
    if (expectedVersion === undefined) {
      res.status(400).json({ error: "INVALID_VERSION" });
      return;
    }
    let state;
    try {
      state = await engineState.pauseIfVersion(
        reason || "Paused by an administrator",
        actor.email,
        expectedVersion,
      );
    } catch (error) {
      if (error instanceof ConcurrentUpdateError) {
        sendConcurrentUpdate(res, error, engineState.get());
        return;
      }
      throw error;
    }
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ENGINE_PAUSED",
      details: { reason: state.reason },
    });
    broadcast({ type: "ENGINE_STATUS", ...state, timestamp: Date.now() });
    setVersionEtag(res, engineState.getVersion());
    res.json(state);
  },
);

router.post(
  "/admin/engine/resume",
  requireUser,
  requireCapability("configuration.manage"),
  async (req, res) => {
    const actor = requestUser(req);
    const expectedVersion = mutationVersion(req, engineState.getVersion());
    if (expectedVersion === undefined) {
      res.status(400).json({ error: "INVALID_VERSION" });
      return;
    }
    let state;
    try {
      state = await engineState.resumeIfVersion(actor.email, expectedVersion);
    } catch (error) {
      if (error instanceof ConcurrentUpdateError) {
        sendConcurrentUpdate(res, error, engineState.get());
        return;
      }
      throw error;
    }
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ENGINE_RESUMED",
      details: {},
    });
    broadcast({ type: "ENGINE_STATUS", ...state, timestamp: Date.now() });
    setVersionEtag(res, engineState.getVersion());
    res.json(state);
  },
);

router.get("/admin/users", requireUser, requireCapability("users.read"), async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(req.query.pageSize) || 50)));
  const role = req.query.role === "admin" || req.query.role === "user" ? req.query.role : undefined;
  const status =
    req.query.status === "active" ||
    req.query.status === "suspended" ||
    req.query.status === "banned"
      ? req.query.status
      : undefined;
  const membership =
    req.query.membership === "Free" ||
    req.query.membership === "Pro" ||
    req.query.membership === "VIP"
      ? req.query.membership
      : undefined;
  const subscriptionStatus = ["ACTIVE", "TRIALING", "CANCELLED", "EXPIRED", "PAST_DUE"].includes(
    String(req.query.subscriptionStatus),
  )
    ? (String(req.query.subscriptionStatus) as
        "ACTIVE" | "TRIALING" | "CANCELLED" | "EXPIRED" | "PAST_DUE")
    : undefined;
  res.json(
    await adminUsersPage({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      role,
      status,
      membership,
      subscriptionStatus,
    }, page, pageSize),
  );
});

const ADMIN_NOTIFICATION_STATUSES = ["QUEUED", "ACCEPTED", "FAILED", "SUPPRESSED", "EXPIRED"] as const;
type AdminNotificationStatus = (typeof ADMIN_NOTIFICATION_STATUSES)[number];

function adminNotificationStatus(status: string): AdminNotificationStatus {
  if (["QUEUED", "RETRY", "SENDING"].includes(status)) return "QUEUED";
  if (status === "ACCEPTED") return "ACCEPTED";
  if (status === "EXPIRED") return "EXPIRED";
  if (["SKIPPED_NOT_AUTHORIZED", "SUBSCRIPTION_EXPIRED"].includes(status)) return "SUPPRESSED";
  return "FAILED";
}

router.get(
  "/admin/notifications",
  requireUser,
  requireCapability("notifications.read"),
  async (req, res): Promise<void> => {
    if (
      typeof req.query.status === "string" &&
      !ADMIN_NOTIFICATION_STATUSES.includes(req.query.status as AdminNotificationStatus)
    ) {
      res.status(400).json({ error: "INVALID_NOTIFICATION_STATUS" });
      return;
    }
    const requestedStatus =
      typeof req.query.status === "string" &&
      ADMIN_NOTIFICATION_STATUSES.includes(req.query.status as AdminNotificationStatus)
        ? (req.query.status as AdminNotificationStatus)
        : undefined;
    const requestedPage = Number(req.query.page);
    const requestedPageSize = Number(req.query.pageSize);
    const page = Number.isFinite(requestedPage)
      ? Math.min(100_000, Math.max(1, Math.floor(requestedPage)))
      : 1;
    const pageSize = Number.isFinite(requestedPageSize)
      ? Math.min(100, Math.max(1, Math.floor(requestedPageSize)))
      : 50;
    const loadChannel = async (channel: "WEB" | "EXPO") => {
      const deliveries =
        channel === "WEB" ? tradifyWebPushDeliveries : tradifyExpoPushDeliveries;
      const subscriptions =
        channel === "WEB" ? tradifyWebPushSubscriptions : tradifyExpoPushSubscriptions;
      return db
        .select({
          id: deliveries.id,
          notificationId: tradifyUserNotifications.id,
          userId: tradifyUserNotifications.userId,
          status: deliveries.status,
          attempts: deliveries.attempts,
          lastStatusCode: deliveries.lastStatusCode,
          updatedAt: deliveries.updatedAt,
          createdAt: tradifyUserNotifications.createdAt,
          category: tradifyUserNotifications.category,
          eventType: tradifySignalLifecycleEvents.eventType,
          symbol: tradifySignalLifecycleEvents.symbol,
        })
        .from(deliveries)
        .innerJoin(
          tradifyUserNotifications,
          eq(tradifyUserNotifications.id, deliveries.notificationId),
        )
        .innerJoin(subscriptions, eq(subscriptions.id, deliveries.subscriptionId))
        .innerJoin(
          tradifySignalLifecycleEvents,
          eq(tradifySignalLifecycleEvents.id, tradifyUserNotifications.eventId),
        )
        .orderBy(desc(deliveries.updatedAt))
        .limit(500);
    };

    const [webResult, expoResult] = await Promise.allSettled([
      loadChannel("WEB"),
      loadChannel("EXPO"),
    ]);
    const unavailableChannels: string[] = [];
    const rows: Array<{
      id: string;
      notificationId: string;
      userId: string;
      channel: "WEB" | "EXPO";
      status: AdminNotificationStatus;
      attempts: number;
      lastStatusCode: number | null;
      category: string;
      eventType: string;
      symbol: string;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    for (const [channel, result] of [
      ["WEB", webResult],
      ["EXPO", expoResult],
    ] as const) {
      if (result.status === "rejected") {
        unavailableChannels.push(channel);
        req.log.error({ channel }, "Notification center channel query failed");
        continue;
      }
      rows.push(
        ...result.value.map((row) => ({
          ...row,
          channel,
          status: adminNotificationStatus(row.status),
        })),
      );
    }
    const filtered = rows
      .filter((row) => !requestedStatus || row.status === requestedStatus)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    res.json({
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total: filtered.length,
      page,
      pageSize,
      partial: unavailableChannels.length > 0,
      unavailableChannels,
    });
  },
);

router.post(
  "/admin/notifications/:channel/:id/retry",
  requireUser,
  requireCapability("notifications.manage"),
  async (req, res): Promise<void> => {
    const channel = Array.isArray(req.params.channel) ? req.params.channel[0] : req.params.channel;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
    if ((channel !== "WEB" && channel !== "EXPO") || !id || !reason) {
      res.status(400).json({ error: "INVALID_NOTIFICATION_RETRY" });
      return;
    }

    const actor = requestUser(req);
    const table = (channel === "WEB"
      ? tradifyWebPushDeliveries
      : tradifyExpoPushDeliveries) as typeof tradifyWebPushDeliveries;
    const outcome = await db.transaction(async (transaction) => {
      const [locked] = await transaction
        .select({ id: table.id, status: table.status })
        .from(table)
        .where(eq(table.id, id))
        .for("update");
      if (!locked) return { kind: "missing" as const };
      if (locked.status !== "FAILED") return { kind: "conflict" as const };
      if (channel === "WEB") {
        const [webDelivery] = await transaction
          .select({ expiresAt: tradifyWebPushDeliveries.expiresAt })
          .from(tradifyWebPushDeliveries)
          .where(eq(tradifyWebPushDeliveries.id, id))
          .for("update");
        if (!webDelivery) return { kind: "missing" as const };
        if (webDelivery.expiresAt.getTime() <= Date.now()) {
          await transaction
            .update(tradifyWebPushDeliveries)
            .set({
              status: "EXPIRED",
              lastError: "Delivery window expired.",
              leaseUntil: null,
              updatedAt: new Date(),
            })
            .where(eq(tradifyWebPushDeliveries.id, id));
          return { kind: "expired" as const };
        }
      }

      const [recipient] = await transaction
        .select({
          notificationId: tradifyUserNotifications.id,
          userId: tradifyUsers.id,
          accountStatus: tradifyUsers.status,
          deletedAt: tradifyUsers.deletedAt,
          membership: tradifyUsers.membership,
          membershipSource: tradifyUsers.membershipSource,
          accountSubscriptionStatus: tradifyUsers.subscriptionStatus,
          billingExpiresAt: tradifyUsers.billingExpiresAt,
          trialEndsAt: tradifyUsers.trialEndsAt,
          overrideEndsAt: tradifyUsers.overrideEndsAt,
          category: tradifyUserNotifications.category,
          eventType: tradifySignalLifecycleEvents.eventType,
          preferences: tradifyNotificationPreferences.categories,
          symbol: tradifySignalLifecycleEvents.symbol,
          subscriptionId: channel === "WEB" ? tradifyWebPushSubscriptions.id : tradifyExpoPushSubscriptions.id,
          deviceStatus: channel === "WEB" ? tradifyWebPushSubscriptions.status : tradifyExpoPushSubscriptions.status,
        })
        .from(table)
        .innerJoin(
          tradifyUserNotifications,
          eq(tradifyUserNotifications.id, table.notificationId),
        )
        .innerJoin(
          (channel === "WEB"
            ? tradifyWebPushSubscriptions
            : tradifyExpoPushSubscriptions) as typeof tradifyWebPushSubscriptions,
          eq(
            channel === "WEB"
              ? tradifyWebPushSubscriptions.id
              : tradifyExpoPushSubscriptions.id,
            table.subscriptionId,
          ),
        )
        .innerJoin(tradifyUsers, eq(tradifyUsers.id, tradifyUserNotifications.userId))
        .leftJoin(
          tradifyNotificationPreferences,
          eq(tradifyNotificationPreferences.userId, tradifyUsers.id),
        )
        .innerJoin(
          tradifySignalLifecycleEvents,
          eq(tradifySignalLifecycleEvents.id, tradifyUserNotifications.eventId),
        )
        .where(eq(table.id, id));
      if (!recipient || !recipient.subscriptionId || recipient.deletedAt) {
        return { kind: "ineligible" as const };
      }
      const eligible =
        recipient.accountStatus === "active" &&
        recipient.deviceStatus === "ACTIVE" &&
        recipient.preferences?.[notificationCategory(recipient.eventType)] === true &&
        canReceiveTrustedSignalEvent(
          {
            status: recipient.accountStatus,
            membership: recipient.membership,
            membershipSource: recipient.membershipSource,
            subscriptionStatus: recipient.accountSubscriptionStatus,
            billingExpiresAt: recipient.billingExpiresAt,
            trialEndsAt: recipient.trialEndsAt,
            overrideEndsAt: recipient.overrideEndsAt,
          },
          recipient.symbol,
        );
      if (!eligible) return { kind: "ineligible" as const };

      const now = new Date();
      const [updated] = await transaction
        .update(table)
        .set({
          status: "RETRY",
          nextAttemptAt: now,
          leaseUntil: null,
          updatedAt: now,
        })
        .where(and(eq(table.id, id), eq(table.status, "FAILED")))
        .returning({ id: table.id, notificationId: table.notificationId });
      if (!updated) return { kind: "conflict" as const };
      await transaction.insert(tradifyAdminAuditEvents).values({
        id: globalThis.crypto.randomUUID(),
        actorId: actor.id,
        actorEmail: actor.email,
        action: "NOTIFICATION_DELIVERY_RETRIED",
        targetUserId: recipient.userId,
        details: {
          channel,
          deliveryId: id,
          notificationId: updated.notificationId,
          reason,
        },
        createdAt: now.toISOString(),
      });
      return { kind: "retried" as const, id: updated.id };
    });

    if (outcome.kind === "missing") {
      res.status(404).json({ error: "NOTIFICATION_DELIVERY_NOT_FOUND" });
      return;
    }
    if (outcome.kind === "ineligible") {
      res.status(409).json({ error: "NOTIFICATION_RECIPIENT_NOT_ELIGIBLE" });
      return;
    }
    if (outcome.kind === "expired") {
      res.status(409).json({ error: "NOTIFICATION_DELIVERY_EXPIRED" });
      return;
    }
    if (outcome.kind === "conflict") {
      res.status(409).json({ error: "NOTIFICATION_DELIVERY_ALREADY_CHANGED" });
      return;
    }
    res.json({ ok: true, id: outcome.id, status: "QUEUED" });
  },
);

router.get("/admin/audit-log", requireUser, requireCapability("audit.read"), async (req, res) => {
  const dateFilters = parseAdminAuditDateFilters(req, res);
  if (!dateFilters) return;
  const limit = Number(req.query.limit);
  res.json(
    await getAdminAuditLog({
      limit: Number.isFinite(limit) ? limit : undefined,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || undefined,
      actorId: typeof req.query.actorId === "string" ? req.query.actorId : undefined,
      targetUserId: typeof req.query.targetUserId === "string" ? req.query.targetUserId : undefined,
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      ...dateFilters,
    }),
  );
});

router.patch(
  "/admin/users/:id",
  requireUser,
  requireCapability("users.manage"),
  async (req, res) => {
    const actor = requestUser(req);
    const target = getUserById(String(req.params.id));
    if (!target) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    const patch = req.body ?? {};
    if (patch.status !== undefined) {
      res.status(400).json({ error: "USE_ACCOUNT_STATE_ENDPOINT" });
      return;
    }
    if (patch.membership !== undefined || patch.entitlements !== undefined) {
      res.status(400).json({ error: "USE_DEDICATED_MEMBERSHIP_ENDPOINT" });
      return;
    }
    const expectedVersion = mutationVersion(req, target.version);
    if (expectedVersion === undefined) {
      res.status(400).json({ error: "INVALID_VERSION" });
      return;
    }
    const nextTarget = {
      ...target,
      profile: { ...target.profile },
      entitlements: [...target.entitlements],
    };
    const changes: Record<string, unknown> = {};
    if (patch.role !== undefined) {
      if (patch.role === "admin") {
        res.status(403).json({ error: "STAFF_ACCESS_MANAGED_SEPARATELY" });
        return;
      }
      if (patch.role !== "user") {
        res.status(400).json({ error: "INVALID_ROLE" });
        return;
      }
      nextTarget.role = patch.role;
      changes.role = patch.role;
    }
    if (patch.status !== undefined) {
      if (patch.status !== "active" && patch.status !== "suspended" && patch.status !== "banned") {
        res.status(400).json({ error: "INVALID_STATUS" });
        return;
      }
      if (target.id === actor.id && patch.status !== "active") {
        res.status(400).json({ error: "CANNOT_SUSPEND_SELF" });
        return;
      }
      if (
        patch.status !== target.status &&
        (typeof patch.reason !== "string" || !patch.reason.trim())
      ) {
        res.status(400).json({ error: "REASON_REQUIRED" });
        return;
      }
      nextTarget.status = patch.status;
      changes.status = patch.status;
      if (typeof patch.reason === "string" && patch.reason.trim())
        changes.reason = patch.reason.trim().slice(0, 500);
    }
    if (patch.membership !== undefined) {
      if (patch.membership !== "Free" && patch.membership !== "Pro" && patch.membership !== "VIP") {
        res.status(400).json({ error: "INVALID_MEMBERSHIP" });
        return;
      }
      nextTarget.profile.membership = patch.membership;
      nextTarget.entitlements = patch.membership === "Free" ? [] : [...PRO_ENTITLEMENTS];
      changes.membership = patch.membership;
      changes.entitlements = [...nextTarget.entitlements];
    }
    if (patch.entitlements !== undefined) {
      if (
        !Array.isArray(patch.entitlements) ||
        patch.entitlements.some((item: unknown) => typeof item !== "string")
      ) {
        res.status(400).json({ error: "INVALID_ENTITLEMENTS" });
        return;
      }
      const requestedEntitlements: string[] = (patch.entitlements as unknown[]).filter(
        (item: unknown): item is string => typeof item === "string",
      );
      nextTarget.entitlements = [
        ...new Set(requestedEntitlements.map((item) => item.trim()).filter(Boolean)),
      ];
      changes.entitlements = [...nextTarget.entitlements];
    }
    if (typeof patch.name === "string" && patch.name.trim()) {
      nextTarget.profile.name = patch.name.trim();
      changes.name = nextTarget.profile.name;
    }
    if (!Object.keys(changes).length) {
      res.status(400).json({ error: "NO_CHANGES" });
      return;
    }
    const decisionAt = new Date().toISOString();
    try {
      await persistUser(nextTarget, expectedVersion, {
        updatedBy: actor.email,
        updatedAt: decisionAt,
      });
    } catch (error) {
      if (error instanceof ConcurrentUpdateError) {
        sendConcurrentUpdate(res, error, await getLatestAdminUserDecision(target.id));
        return;
      }
      throw error;
    }
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "USER_UPDATED",
      targetUserId: target.id,
      targetEmail: target.email,
      details: changes,
      createdAt: decisionAt,
    });
    setVersionEtag(res, nextTarget.version);
    res.json({ user: (await adminUsers()).find((user) => user.id === target.id) });
  },
);

async function saveDedicatedUserMutation(
  req: Request,
  res: Response,
  target: ServerUser,
  changes: Record<string, unknown>,
  auditAction: string,
  reason: unknown,
): Promise<void> {
  const actor = requestUser(req);
  const trimmedReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
  if (!trimmedReason) {
    res.status(400).json({ error: "REASON_REQUIRED" });
    return;
  }
  changes.reason = trimmedReason;
  const expectedVersion = mutationVersion(req, target.version);
  if (expectedVersion === undefined) {
    res.status(400).json({ error: "INVALID_VERSION" });
    return;
  }
  const decisionAt = new Date().toISOString();
  try {
    await persistUser(target, expectedVersion, { updatedBy: actor.email, updatedAt: decisionAt });
  } catch (error) {
    if (error instanceof ConcurrentUpdateError) {
      sendConcurrentUpdate(res, error, await getLatestAdminUserDecision(target.id));
      return;
    }
    throw error;
  }
  if (
    auditAction === "ACCOUNT_STATE_CHANGE" &&
    changes.previous !== target.status &&
    (target.status === "suspended" || target.status === "banned")
  ) {
    await queueSignalsLinkRevocations(
      target.id,
      target.status === "suspended" ? "account_suspended" : "security_action",
    );
  }
  await recordAdminAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: auditAction,
    targetUserId: target.id,
    targetEmail: target.email,
    details: changes,
    createdAt: decisionAt,
  });
  res.json({ user: (await adminUsers()).find((user) => user.id === target.id) });
}

async function canApplyDedicatedMutation(
  req: Request,
  res: Response,
  target: ServerUser,
): Promise<boolean> {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    res.status(400).json({ error: "REASON_REQUIRED" });
    return false;
  }
  const expectedVersion = mutationVersion(req, target.version);
  if (expectedVersion === undefined) {
    res.status(400).json({ error: "INVALID_VERSION" });
    return false;
  }
  if (expectedVersion !== target.version) {
    sendConcurrentUpdate(
      res,
      new ConcurrentUpdateError("user controls"),
      await getLatestAdminUserDecision(target.id),
    );
    return false;
  }
  return true;
}

router.get("/admin/crm/summary", requireUser, requireCapability("users.read"), (_req, res) => {
  const stats = adminStats();
  res.json({
    ...stats,
    totalUsersThisWeek: stats.newUsersThisWeek,
    accountHealth: {
      active: stats.activeUsers,
      suspended: stats.suspendedUsers,
      banned: stats.bannedUsers,
    },
  });
});

router.get(
  "/admin/crm/users/:id",
  requireUser,
  requireCapability("users.read"),
  async (req, res) => {
    const detail = await getAdminUserDetail(String(req.params.id));
    if (!detail) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    if (!hasCapability(await getStaffAccess(requestUser(req).id), "audit.read")) {
      const { auditLog: _auditLog, ...safeDetail } = detail;
      res.json(safeDetail);
      return;
    }
    res.json(detail);
  },
);

router.get(
  "/admin/crm/users/:id/trades",
  requireUser,
  requireCapability("users.read"),
  async (req, res) => {
    const detail = await getAdminUserDetail(String(req.params.id));
    if (!detail) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    res.json({ trades: detail.trades, metrics: detail.tradeMetrics });
  },
);

router.get(
  "/admin/crm/users/:id/audit-logs",
  requireUser,
  requireCapability("audit.read"),
  async (req, res) => {
    if (!getUserById(String(req.params.id))) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    res.json(await getAdminUserAuditLog(String(req.params.id)));
  },
);

router.patch(
  "/admin/crm/users/:id/membership",
  requireUser,
  requireCapability("memberships.manage"),
  async (req, res) => {
    const target = getUserById(String(req.params.id));
    if (!target) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    const body = req.body ?? {};
    if (!["Free", "Pro", "VIP"].includes(body.membership)) {
      res.status(400).json({ error: "INVALID_MEMBERSHIP" });
      return;
    }
    if (
      body.subscriptionStatus !== undefined &&
      !["ACTIVE", "TRIALING", "CANCELLED", "EXPIRED", "PAST_DUE"].includes(body.subscriptionStatus)
    ) {
      res.status(400).json({ error: "INVALID_SUBSCRIPTION_STATUS" });
      return;
    }
    if (!(await canApplyDedicatedMutation(req, res, target))) return;
    if (body.clearOverride === true) {
      const actor = requestUser(req);
      const expectedVersion = mutationVersion(req, target.version);
      if (expectedVersion === undefined) {
        res.status(400).json({ error: "INVALID_VERSION" });
        return;
      }
      const reason = String(body.reason).trim().slice(0, 500);
      let result:
        | {
            kind: "restored";
            user: ServerUser;
            previous: Record<string, unknown>;
            next: Record<string, unknown>;
            decisionAt: string;
          }
        | { kind: "missing" }
        | { kind: "unavailable" }
        | { kind: "suspended" }
        | { kind: "deleted" }
        | { kind: "conflict"; version: number };
      try {
        result = await withRevenueCatTransferLock([target.id], async (database) => {
          const current = (await getRevenueCatTransferUsers([target.id], database)).get(target.id);
          if (!current) return { kind: "missing" as const };
          if (current.version !== expectedVersion)
            return { kind: "conflict" as const, version: current.version };
          if (current.status === "suspended" || current.status === "banned")
            return { kind: "suspended" as const };
          if (current.status === "deleted") return { kind: "deleted" as const };
          const billing = await revenueCatBillingProvider.get(current.id);
          if (billing.status === "UNAVAILABLE") return { kind: "unavailable" as const };
          const previous = {
            membership: current.profile.membership,
            membershipSource: current.membershipSource ?? "UNKNOWN",
            subscriptionStatus: current.subscriptionStatus,
            entitlements: [...current.entitlements],
            trialEndsAt: current.trialEndsAt,
            overrideEndsAt: current.overrideEndsAt,
          };
          current.profile.membership = billing.membership;
          current.membershipSource = "REVENUECAT";
          current.subscriptionStatus = billing.status === "INACTIVE" ? "EXPIRED" : billing.status;
          current.billingExpiresAt = billing.expiresAt;
          current.billingWillRenew = billing.willRenew;
          current.trialEndsAt = null;
          current.overrideEndsAt = null;
          current.entitlements = billingEntitlements(current, billing.membership);
          const decisionAt = new Date().toISOString();
          await persistUser(
            current,
            current.version,
            { updatedBy: actor.email, updatedAt: decisionAt },
            database,
          );
          return {
            kind: "restored" as const,
            user: current,
            previous,
            next: {
              membership: current.profile.membership,
              membershipSource: current.membershipSource,
              subscriptionStatus: current.subscriptionStatus,
              entitlements: [...current.entitlements],
              trialEndsAt: current.trialEndsAt,
              overrideEndsAt: current.overrideEndsAt,
            },
            decisionAt,
          };
        });
      } catch (error) {
        req.log.warn({ error }, "RevenueCat membership reconciliation failed");
        res.status(503).json({ error: "BILLING_VERIFICATION_UNAVAILABLE" });
        return;
      }
      if (result.kind === "missing") {
        res.status(404).json({ error: "USER_NOT_FOUND" });
        return;
      }
      if (result.kind === "unavailable") {
        res.status(503).json({ error: "BILLING_VERIFICATION_UNAVAILABLE" });
        return;
      }
      if (result.kind === "suspended") {
        res.status(403).json({ error: "USER_SUSPENDED" });
        return;
      }
      if (result.kind === "deleted") {
        res.status(403).json({ error: "ACCOUNT_DELETED" });
        return;
      }
      if (result.kind === "conflict") {
        sendConcurrentUpdate(
          res,
          new ConcurrentUpdateError("customer membership"),
          (await getLatestAdminUserDecision(target.id)) ?? { version: result.version },
        );
        return;
      }
      const changes = { previous: result.previous, next: result.next, reason };
      await recordAdminAudit({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "MEMBERSHIP_SOURCE_RESTORED",
        targetUserId: result.user.id,
        targetEmail: result.user.email,
        details: changes,
        createdAt: result.decisionAt,
      });
      res.json({ user: (await adminUsers()).find((user) => user.id === result.user.id) });
      return;
    }
    const trialDays = body.trialDays === undefined ? undefined : Number(body.trialDays);
    if (
      trialDays !== undefined &&
      (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 3650)
    ) {
      res.status(400).json({ error: "INVALID_TRIAL_DAYS" });
      return;
    }
    const overrideDays =
      body.overrideDays === null || body.overrideDays === undefined
        ? body.overrideDays
        : Number(body.overrideDays);
    if (
      overrideDays !== null &&
      overrideDays !== undefined &&
      (!Number.isInteger(overrideDays) || overrideDays < 1 || overrideDays > 3650)
    ) {
      res.status(400).json({ error: "INVALID_OVERRIDE_DAYS" });
      return;
    }
    const previous = {
      membership: target.profile.membership,
      membershipSource: target.membershipSource ?? "UNKNOWN",
      subscriptionStatus: target.subscriptionStatus,
      entitlements: [...target.entitlements],
      trialEndsAt: target.trialEndsAt,
      overrideEndsAt: target.overrideEndsAt,
    };
    target.profile.membership = body.membership;
    target.membershipSource = "ADMIN_OVERRIDE";
    target.entitlements = billingEntitlements(target, target.profile.membership);
    target.subscriptionStatus =
      (body.subscriptionStatus as SubscriptionStatus | undefined) ??
      (body.membership === "Free" ? "EXPIRED" : "ACTIVE");
    if (trialDays !== undefined) {
      target.trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
      target.subscriptionStatus = "TRIALING";
    }
    if (overrideDays === null) {
      target.overrideEndsAt = null;
    } else if (overrideDays !== undefined) {
      target.overrideEndsAt = new Date(
        Date.now() + overrideDays * 24 * 60 * 60 * 1000,
      ).toISOString();
    } else if (trialDays !== undefined) {
      target.overrideEndsAt = target.trialEndsAt ?? null;
    }
    await saveDedicatedUserMutation(
      req,
      res,
      target,
      {
        previous,
        next: {
          membership: target.profile.membership,
          membershipSource: target.membershipSource,
          subscriptionStatus: target.subscriptionStatus,
          entitlements: [...target.entitlements],
          trialEndsAt: target.trialEndsAt,
          overrideEndsAt: target.overrideEndsAt,
        },
      },
      "MEMBERSHIP_OVERRIDE",
      body.reason,
    );
  },
);

router.patch(
  "/admin/crm/users/:id/entitlements",
  requireUser,
  requireCapability("memberships.manage"),
  async (req, res) => {
    const target = getUserById(String(req.params.id));
    if (!target) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    const body = req.body ?? {};
    if (
      !Array.isArray(body.grants) ||
      !Array.isArray(body.denies) ||
      body.grants.some((v: unknown) => typeof v !== "string") ||
      body.denies.some((v: unknown) => typeof v !== "string")
    ) {
      res.status(400).json({ error: "INVALID_ENTITLEMENTS" });
      return;
    }
    if (!(await canApplyDedicatedMutation(req, res, target))) return;
    const previous = {
      grants: target.entitlementGrants,
      denies: target.entitlementDenies,
      entitlements: target.entitlements,
    };
    target.entitlementGrants = [
      ...new Set((body.grants as string[]).map((v) => v.trim()).filter(Boolean)),
    ];
    target.entitlementDenies = [
      ...new Set((body.denies as string[]).map((v) => v.trim()).filter(Boolean)),
    ];
    target.entitlements = [
      ...new Set([
        ...target.entitlementGrants,
        ...(target.profile.membership === "Free" ? [] : PRO_ENTITLEMENTS),
      ]),
    ].filter((item) => !target.entitlementDenies.includes(item));
    await saveDedicatedUserMutation(
      req,
      res,
      target,
      {
        previous,
        next: {
          grants: target.entitlementGrants,
          denies: target.entitlementDenies,
          entitlements: target.entitlements,
        },
      },
      "ENTITLEMENTS_OVERRIDE",
      body.reason,
    );
  },
);

router.patch(
  "/admin/crm/users/:id/role",
  requireUser,
  requireCapability("users.manage"),
  async (req, res) => {
    const target = getUserById(String(req.params.id));
    if (!target) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    if (req.body?.role === "admin") {
      res.status(403).json({ error: "STAFF_ACCESS_MANAGED_SEPARATELY" });
      return;
    }
    if (req.body?.role !== "user") {
      res.status(400).json({ error: "INVALID_ROLE" });
      return;
    }
    if (!(await canApplyDedicatedMutation(req, res, target))) return;
    const previous = target.role;
    target.role = req.body.role;
    await saveDedicatedUserMutation(
      req,
      res,
      target,
      { previous, next: target.role },
      "ROLE_CHANGE",
      req.body?.reason,
    );
  },
);

router.patch(
  "/admin/crm/users/:id/account-state",
  requireUser,
  requireCapability("users.manage"),
  async (req, res) => {
    const target = getUserById(String(req.params.id));
    const actor = requestUser(req);
    if (!target) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    if (!["active", "suspended", "banned"].includes(req.body?.status)) {
      res.status(400).json({ error: "INVALID_STATUS" });
      return;
    }
    if (target.id === actor.id && req.body.status !== "active") {
      res.status(400).json({ error: "CANNOT_SUSPEND_SELF" });
      return;
    }
    if (!(await canApplyDedicatedMutation(req, res, target))) return;
    const previous = target.status;
    target.status = req.body.status;
    await saveDedicatedUserMutation(
      req,
      res,
      target,
      { previous, next: target.status },
      "ACCOUNT_STATE_CHANGE",
      req.body?.reason,
    );
  },
);

router.get(
  "/admin/crm/audit-logs",
  requireUser,
  requireCapability("audit.read"),
  async (req, res) => {
    const dateFilters = parseAdminAuditDateFilters(req, res);
    if (!dateFilters) return;
    const pageSize = Number(req.query.pageSize) || 50;
    res.json(
      await getAdminAuditLog({
        page: Number(req.query.page) || 1,
        pageSize,
        actorId: typeof req.query.actorId === "string" ? req.query.actorId : undefined,
        targetUserId:
          typeof req.query.targetUserId === "string" ? req.query.targetUserId : undefined,
        action: typeof req.query.action === "string" ? req.query.action : undefined,
        ...dateFilters,
      }),
    );
  },
);

router.get(
  "/admin/operations/health",
  requireUser,
  requireCapability("market_data.read"),
  (_req, res) => {
    const bridge = bridgeStore.getStatus();
    res.json({
      engine: {
        ...engineState.get(),
        lastBootAt: engineState.get().updatedAt,
        autoRecovery: "READY",
      },
      database: { status: "CONNECTED", latencyMs: null },
      mt5: {
        ...bridge,
        heartbeatAgeSeconds: bridge.lastHeartbeat
          ? Math.max(0, Math.floor((Date.now() - bridge.lastHeartbeat) / 1000))
          : null,
      },
      billing: {
        status: "NOT_CONFIGURED",
        mode: "SANDBOX",
        signatureVerification: "NOT_CONFIGURED",
      },
      streaming: { activeConnections: sseClients.size },
      validator: {
        guardCount: 7,
        status: bridge.healthState === "CONNECTED" ? "RUNNING" : "PAUSED",
      },
    });
  },
);

router.get(
  "/admin/market-data/matrix",
  requireUser,
  requireCapability("market_data.read"),
  async (req, res) => {
    const requestedSymbol =
      typeof req.query.symbol === "string" ? canonicalSymbol(req.query.symbol) : undefined;
    const items = (await listEffectiveMarkets()).filter(
      (item) => item.enabled && (!requestedSymbol || item.canonicalSymbol === requestedSymbol),
    );
    const strategiesBySymbol = await assignedStrategies(items.map((item) => item.canonicalSymbol));
    const rows = (
      await Promise.all(
        items.map(async (item) => {
          const fallbackStrategy = strategiesBySymbol.get(item.canonicalSymbol) ?? null;
          const strategies = item.availableStrategies?.length
            ? item.availableStrategies
            : fallbackStrategy
              ? [fallbackStrategy]
              : [];
          return Promise.all(
            strategies.map(async (strategyId) => {
              const diagnostics = await marketDataRegistry.getProviderDiagnostics({
                canonicalSymbol: item.canonicalSymbol,
                timeframe: "M15",
                strategyId,
                purpose: "STRATEGY",
              });
              return {
                symbol: item.canonicalSymbol,
                timeframe: "M15",
                strategyId,
                authority: diagnostics.authority,
                providers: diagnostics.providers,
              };
            }),
          );
        }),
      )
    ).flat();
    res.json(
      sanitizeDiagnosticValue({
        apiStatus: "API_LIVE",
        marketStatus: rows.some((row) => Boolean(row.authority.selectedProviderId))
          ? "MARKET_READY_FOR_SOME_CONTEXTS"
          : "MARKET_UNAVAILABLE",
        providers: marketDataRegistry.getRegistrationDiagnostics(),
        rows,
        transitions: await listRecentAuthorityTransitions(100),
      }),
    );
  },
);

function adminMarketControl(item: ReturnType<typeof marketCatalog.get>) {
  if (!item) return undefined;
  const bufferCounts = Object.fromEntries(
    ["M1", "M5", "M15", "H1", "H4"].map((timeframe) => [
      timeframe,
      mt5BridgeStore.getCandlesForBrokerSymbol(item.providerSymbol, timeframe)?.length ?? 0,
    ]),
  );
  return {
    symbol: item.canonicalSymbol,
    brokerSymbol: item.providerSymbol,
    provider: item.provider,
    enabled: item.enabled,
    visibleToUsers: item.visibleToUsers,
    archived: Boolean("archivedAt" in item && item.archivedAt),
    strategyId: item.strategyId,
    availableStrategies:
      marketCatalog.get(item.canonicalSymbol)?.availableStrategies ??
      item.availableStrategies ??
      [],
    defaultStrategyId: item.defaultStrategyId ?? null,
    rowVersion: (item as typeof item & { rowVersion?: number }).rowVersion ?? 1,
    brokerSpec: item.brokerSpec ?? null,
    bufferCounts,
  };
}

router.get("/admin/controls", requireUser, requireCapability("symbols.read"), async (_req, res) => {
  const markets = await listEffectiveMarkets();
  res.json({
    markets: markets.map((item) => adminMarketControl(item)),
    bridge: {
      ...mt5BridgeStore.getStatus(),
      candleBuffers: mt5BridgeStore.getCandleKeys(),
    },
  });
});

router.patch(
  "/admin/controls/markets/:symbol",
  requireUser,
  requireCapability("symbols.manage"),
  async (req, res) => {
    const patch =
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const symbol = canonicalSymbol(String(req.params.symbol));
    if (!symbol) {
      res.status(400).json({ error: "INVALID_SYMBOL" });
      return;
    }
    const current = await getSymbolControl(symbol);
    if (!current) {
      res.status(404).json({ error: "MARKET_NOT_FOUND" });
      return;
    }
    const expectedVersion = Number(patch.rowVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      res.status(400).json({ error: "INVALID_VERSION" });
      return;
    }
    if (expectedVersion !== current.rowVersion) {
      res
        .status(409)
        .json({ error: "VERSION_CONFLICT", current: { rowVersion: current.rowVersion } });
      return;
    }
    if (patch.enabled !== undefined && typeof patch.enabled !== "boolean") {
      res.status(400).json({ error: "INVALID_ENABLED" });
      return;
    }
    if (patch.visibleToUsers !== undefined && typeof patch.visibleToUsers !== "boolean") {
      res.status(400).json({ error: "INVALID_VISIBILITY" });
      return;
    }
    if (current.archivedAt && (patch.enabled === true || patch.visibleToUsers === true)) {
      res.status(409).json({ error: "SYMBOL_ARCHIVED" });
      return;
    }
    if (patch.defaultStrategyId !== undefined) {
      res.status(400).json({ error: "ASSIGNMENTS_ROUTE_REQUIRED" });
      return;
    }
    const changes: { enabled?: boolean; visibleToUsers?: boolean } = {};
    if (typeof patch.enabled === "boolean") changes.enabled = patch.enabled;
    if (typeof patch.visibleToUsers === "boolean") changes.visibleToUsers = patch.visibleToUsers;
    if (!Object.keys(changes).length) {
      res.status(400).json({ error: "NO_CHANGES" });
      return;
    }
    const actor = requestUser(req);
    const now = new Date();
    const [updated] = await db
      .update(tradifySymbols)
      .set({ ...changes, updatedAt: now, updatedBy: actor.id, rowVersion: current.rowVersion + 1 })
      .where(
        and(
          eq(tradifySymbols.canonicalSymbol, symbol),
          eq(tradifySymbols.rowVersion, expectedVersion),
        ),
      )
      .returning();
    if (!updated) {
      const latest = await getSymbolControl(symbol);
      res
        .status(409)
        .json({ error: "VERSION_CONFLICT", current: { rowVersion: latest?.rowVersion ?? null } });
      return;
    }
    marketCatalog.update(symbol, changes);
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action:
        changes.enabled === undefined
          ? "SYMBOL_CONTROL_UPDATED"
          : changes.enabled
            ? "SYMBOL_ENABLED"
            : "SYMBOL_DISABLED",
      details: {
        resourceType: "symbol",
        resourceId: symbol,
        before: { enabled: current.enabled, visibleToUsers: current.visibleToUsers },
        after: { enabled: updated.enabled, visibleToUsers: updated.visibleToUsers },
        reason: typeof patch.reason === "string" ? patch.reason.slice(0, 1000) : null,
      },
    });
    const effective = (await listEffectiveMarkets()).find(
      (item) => item.canonicalSymbol === symbol,
    );
    if (!effective) {
      res.status(404).json({ error: "MARKET_NOT_FOUND" });
      return;
    }
    res.json(adminMarketControl(effective));
  },
);

router.patch(
  "/admin/controls/markets/:symbol/strategies",
  requireUser,
  requireCapability("strategies.manage"),
  async (req, res) => {
    const symbol = canonicalSymbol(String(req.params.symbol));
    if (!symbol) {
      res.status(400).json({ error: "INVALID_SYMBOL" });
      return;
    }
    const item = marketCatalog.get(symbol);
    const strategies = req.body?.availableStrategies;
    if (!item) {
      res.status(404).json({ error: "MARKET_NOT_FOUND" });
      return;
    }
    if (
      !Array.isArray(strategies) ||
      strategies.some((value: unknown) => typeof value !== "string")
    ) {
      res.status(400).json({ error: "INVALID_STRATEGY_MATRIX" });
      return;
    }
    const requested = [...new Set(strategies as string[])];
    if (requested.some((id) => !(item.availableStrategies ?? []).includes(id))) {
      res.status(400).json({ error: "STRATEGY_NOT_AVAILABLE" });
      return;
    }
    const expectedVersion = Number(req.body?.rowVersion);
    const currentSymbol = await getSymbolControl(symbol);
    if (!currentSymbol) {
      res.status(404).json({ error: "MARKET_NOT_FOUND" });
      return;
    }
    if (currentSymbol.archivedAt) {
      res.status(409).json({ error: "SYMBOL_ARCHIVED" });
      return;
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      res.status(400).json({ error: "INVALID_VERSION" });
      return;
    }
    if (currentSymbol.rowVersion !== expectedVersion) {
      res
        .status(409)
        .json({ error: "VERSION_CONFLICT", current: { rowVersion: currentSymbol.rowVersion } });
      return;
    }
    const actor = requestUser(req);
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        const [symbolUpdated] = await tx
          .update(tradifySymbols)
          .set({ updatedAt: now, updatedBy: actor.id, rowVersion: currentSymbol.rowVersion + 1 })
          .where(
            and(
              eq(tradifySymbols.canonicalSymbol, symbol),
              eq(tradifySymbols.rowVersion, expectedVersion),
            ),
          )
          .returning({ canonicalSymbol: tradifySymbols.canonicalSymbol });
        if (!symbolUpdated) throw new Error("VERSION_CONFLICT");

        const assignments = await tx
          .select()
          .from(tradifyStrategyAssignments)
          .where(
            and(
              eq(tradifyStrategyAssignments.symbol, symbol),
              eq(tradifyStrategyAssignments.timeframe, "M15"),
            ),
          );
        const existing = new Set(assignments.map((assignment) => assignment.strategyId));
        const strategiesById = new Map(
          (await tx.select().from(tradifyStrategies)).map((strategy) => [strategy.id, strategy]),
        );
        for (const assignment of assignments) {
          const shouldEnable = requested.includes(assignment.strategyId);
          if (assignment.enabled !== shouldEnable || (!shouldEnable && assignment.isDefault)) {
            await tx
              .update(tradifyStrategyAssignments)
              .set({
                enabled: shouldEnable,
                isDefault: shouldEnable && assignment.isDefault,
                deactivatedAt: shouldEnable ? null : now,
                activatedAt: shouldEnable
                  ? (assignment.activatedAt ?? now)
                  : assignment.activatedAt,
                updatedAt: now,
                updatedBy: actor.id,
                rowVersion: assignment.rowVersion + 1,
              })
              .where(
                and(
                  eq(tradifyStrategyAssignments.id, assignment.id),
                  eq(tradifyStrategyAssignments.rowVersion, assignment.rowVersion),
                ),
              );
          }
        }
        for (const strategyId of requested) {
          if (existing.has(strategyId)) continue;
          const strategy = strategiesById.get(strategyId);
          if (!strategy || strategy.lifecycleStatus !== "ACTIVE")
            throw new Error("STRATEGY_NOT_ACTIVE");
          await tx.insert(tradifyStrategyAssignments).values({
            id: globalThis.crypto.randomUUID(),
            strategyId,
            strategyVersion: strategy.version,
            symbol,
            timeframe: "M15",
            enabled: true,
            isDefault: false,
            activatedAt: now,
            notes: null,
            createdBy: actor.id,
            updatedBy: actor.id,
            createdAt: now,
            updatedAt: now,
          });
        }
      });
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (error instanceof Error && error.message === "VERSION_CONFLICT") {
        res.status(409).json({ error: "VERSION_CONFLICT" });
        return;
      }
      if (error instanceof Error && error.message === "STRATEGY_NOT_ACTIVE") {
        res.status(409).json({ error: "STRATEGY_NOT_ACTIVE" });
        return;
      }
      if (code === "23505") {
        res.status(409).json({ error: "ASSIGNMENT_CONFLICT" });
        return;
      }
      throw error;
    }
    const updated = (await listEffectiveMarkets()).find(
      (market) => market.canonicalSymbol === symbol,
    );
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "STRATEGY_ASSIGNMENTS_UPDATED",
      details: {
        resourceType: "symbol",
        resourceId: symbol,
        before: item.availableStrategies ?? [],
        after: requested,
        reason: typeof req.body?.reason === "string" ? req.body.reason.slice(0, 1000) : null,
      },
    });
    if (!updated) {
      res.status(404).json({ error: "MARKET_NOT_FOUND" });
      return;
    }
    res.json(adminMarketControl(updated));
  },
);

router.get(
  "/admin/strategies",
  requireUser,
  requireCapability("strategies.read"),
  async (_req, res) => {
    const [strategies, assignments] = await Promise.all([listStrategies(), listAssignments()]);
    const assignedCounts = new Map<string, number>();
    for (const { assignment } of assignments) {
      if (assignment.enabled)
        assignedCounts.set(
          assignment.strategyId,
          (assignedCounts.get(assignment.strategyId) ?? 0) + 1,
        );
    }
    res.json(
      strategies.map((strategy) => ({
        ...strategy,
        createdAt: strategy.createdAt.toISOString(),
        updatedAt: strategy.updatedAt.toISOString(),
        activatedAt: strategy.activatedAt?.toISOString() ?? null,
        pausedAt: strategy.pausedAt?.toISOString() ?? null,
        assignedMarkets: assignedCounts.get(strategy.id) ?? 0,
      })),
    );
  },
);

type EffectiveControlMarket = Awaited<ReturnType<typeof listEffectiveMarkets>>[number];
type AdminAssignmentRow = Awaited<ReturnType<typeof listAssignments>>[number];

function adminSymbolResponse(item: EffectiveControlMarket) {
  return {
    symbol: item.canonicalSymbol,
    displaySymbol: item.displaySymbol,
    provider: item.provider,
    providerSymbol: item.providerSymbol,
    assetClass: item.assetClass,
    digits: item.digits,
    enabled: item.enabled,
    visibleToUsers: item.visibleToUsers,
    archived: Boolean(item.archivedAt),
    supportedTimeframes: ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"],
    assignedStrategies: item.availableStrategies ?? [],
    rowVersion: item.rowVersion,
    updatedAt: item.updatedAt.toISOString(),
  };
}

function adminAssignmentResponse(row: AdminAssignmentRow) {
  const assignment = row.assignment;
  return {
    id: assignment.id,
    strategyId: assignment.strategyId,
    strategyName: row.strategyName,
    strategyVersion: assignment.strategyVersion,
    strategyStatus: row.strategyStatus,
    symbol: assignment.symbol,
    symbolDisplay: row.symbolDisplay,
    symbolEnabled: row.symbolEnabled,
    timeframe: assignment.timeframe,
    enabled: assignment.enabled,
    isDefault: assignment.isDefault,
    notes: assignment.notes,
    rowVersion: assignment.rowVersion,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    activatedAt: assignment.activatedAt?.toISOString() ?? null,
    deactivatedAt: assignment.deactivatedAt?.toISOString() ?? null,
  };
}

const ADMIN_MARKET_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];

function adminMarketAccessRows() {
  const coreSymbols = coreMarketSymbolSet();
  const strategyMarkets = getCatalog().flatMap((item) => {
    const requiredTier = requiredMarketTier(item.symbol, coreSymbols, canonicalSymbol);
    if (!requiredTier) return [];
    return [
      {
        symbol: item.symbol,
        name: item.name,
        requiredTier,
        marketType: "STRATEGY" as const,
      },
    ];
  });
  const quoteOnlyMarkets = MT5_WATCHLIST_QUOTE_SYMBOLS.filter(
    (symbol) => !coreSymbols.has(symbol),
  ).map((symbol) => ({
    symbol,
    name: mt5WatchlistMarketNames[symbol] ?? symbol,
    requiredTier: "VIP" as const,
    marketType: "QUOTE_ONLY" as const,
  }));
  return [...strategyMarkets, ...quoteOnlyMarkets];
}

function adminBrokerSpecification(item: ReturnType<typeof marketCatalog.get>) {
  const spec = item?.brokerSpec;
  if (!spec) return null;
  return {
    brokerSymbol: spec.brokerSymbol,
    contractSize: spec.contractSize ?? null,
    tickSize: spec.tickSize ?? null,
    tickValue: spec.tickValue ?? null,
    tickValueProfit: spec.tickValueProfit ?? null,
    tickValueLoss: spec.tickValueLoss ?? null,
    volumeMin: spec.volumeMin ?? null,
    volumeMax: spec.volumeMax ?? null,
    volumeStep: spec.volumeStep ?? null,
    digits: spec.digits ?? null,
    point: spec.point ?? null,
    quoteCurrency: spec.quoteCurrency ?? null,
    receivedAt: spec.receivedAt,
    tradingSessions: spec.tradingSessions ?? null,
  };
}

function adminMarketInventoryResponse(
  access: ReturnType<typeof adminMarketAccessRows>[number],
  effectiveBySymbol: Map<string, EffectiveControlMarket>,
  catalogBySymbol: Map<string, ReturnType<typeof marketCatalog.get>>,
  coreBySymbol: Map<string, ReturnType<typeof getCatalog>[number]>,
) {
  const key = access.symbol.trim().toUpperCase();
  const catalogItem = catalogBySymbol.get(key) ?? null;
  const strategySupported =
    access.marketType === "STRATEGY" || Boolean(catalogItem?.availableStrategies?.length);
  const effective = effectiveBySymbol.get(key);
  const coreMarket = coreBySymbol.get(key);
  const digits =
    effective?.digits ??
    catalogItem?.digits ??
    coreMarket?.digits ??
    mt5WatchlistDigits(access.symbol);
  const assetClass =
    effective?.assetClass ??
    catalogItem?.assetClass ??
    coreMarket?.assetClass ??
    mt5WatchlistAssetClass(access.symbol);
  const brokerSpec = adminBrokerSpecification(catalogItem);

  return {
    symbol: access.symbol,
    catalogId: catalogItem?.id ?? access.symbol,
    displaySymbol: effective?.displaySymbol ?? catalogItem?.displaySymbol ?? access.symbol,
    description: catalogItem?.description || access.name || access.symbol,
    provider: effective?.provider ?? catalogItem?.provider ?? "MT5",
    providerSymbol: effective?.providerSymbol ?? catalogItem?.providerSymbol ?? access.symbol,
    assetClass,
    digits,
    point: catalogItem?.point ?? null,
    tickSize: catalogItem?.tickSize ?? null,
    currencyBase: catalogItem?.currencyBase ?? null,
    currencyProfit: catalogItem?.currencyProfit ?? null,
    tradeMode: catalogItem?.tradeMode ?? null,
    chartMode: catalogItem?.chartMode ?? null,
    quoteAvailable: catalogItem?.quoteAvailable ?? null,
    candlesAvailable: catalogItem?.candlesAvailable ?? null,
    strategySupported,
    strategyConfigured: effective?.strategyConfigured ?? catalogItem?.strategyConfigured ?? false,
    strategyId: effective?.strategyId ?? catalogItem?.strategyId ?? null,
    availableStrategies: catalogItem?.availableStrategies ?? [],
    assignedStrategies: effective?.availableStrategies ?? [],
    defaultStrategyId: effective?.defaultStrategyId ?? catalogItem?.defaultStrategyId ?? null,
    enabled: effective?.enabled ?? catalogItem?.enabled ?? null,
    visibleToUsers: effective?.visibleToUsers ?? catalogItem?.visibleToUsers ?? null,
    archived: Boolean(effective?.archivedAt),
    supportedTimeframes: catalogItem ? ADMIN_MARKET_TIMEFRAMES : [],
    requiredTier: access.requiredTier,
    marketType: access.marketType,
    controlManaged: Boolean(effective),
    rowVersion: effective?.rowVersion ?? null,
    updatedAt: effective?.updatedAt?.toISOString() ?? null,
    brokerSpec,
  };
}

function databaseErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}

router.patch(
  "/admin/strategies/:strategyId",
  requireUser,
  requireCapability("strategies.manage"),
  async (req, res) => {
    const strategyId = String(req.params.strategyId).toUpperCase();
    const strategy = await getStrategy(strategyId);
    if (!strategy) {
      res.status(404).json({ error: "STRATEGY_NOT_FOUND" });
      return;
    }
    const lifecycleStatus = req.body?.lifecycleStatus;
    const rowVersion = Number(req.body?.rowVersion);
    if (!["ACTIVE", "PAUSED", "ARCHIVED"].includes(lifecycleStatus)) {
      res.status(400).json({ error: "INVALID_LIFECYCLE_STATUS" });
      return;
    }
    if (!Number.isInteger(rowVersion) || rowVersion < 1) {
      res.status(400).json({ error: "INVALID_VERSION" });
      return;
    }
    if (strategy.rowVersion !== rowVersion) {
      res
        .status(409)
        .json({ error: "VERSION_CONFLICT", current: { rowVersion: strategy.rowVersion } });
      return;
    }
    if (strategy.lifecycleStatus === "ARCHIVED" && lifecycleStatus !== "ARCHIVED") {
      res.status(409).json({ error: "ARCHIVED_STRATEGY_IS_TERMINAL" });
      return;
    }
    const actor = requestUser(req);
    if (lifecycleStatus === "ACTIVE") {
      const access = await getStaffAccess(actor.id);
      if (!hasCapability(access, "strategies.deploy")) {
        res.status(403).json({ error: "PERMISSION_DENIED", capability: "strategies.deploy" });
        return;
      }
    }
    const now = new Date();
    const [updated] = await db
      .update(tradifyStrategies)
      .set({
        lifecycleStatus,
        activatedAt: lifecycleStatus === "ACTIVE" ? now : strategy.activatedAt,
        pausedAt: lifecycleStatus === "PAUSED" || lifecycleStatus === "ARCHIVED" ? now : null,
        updatedAt: now,
        updatedBy: actor.id,
        rowVersion: strategy.rowVersion + 1,
      })
      .where(
        and(eq(tradifyStrategies.id, strategyId), eq(tradifyStrategies.rowVersion, rowVersion)),
      )
      .returning();
    if (!updated) {
      const latest = await getStrategy(strategyId);
      res
        .status(409)
        .json({ error: "VERSION_CONFLICT", current: { rowVersion: latest?.rowVersion ?? null } });
      return;
    }
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action:
        lifecycleStatus === "ACTIVE"
          ? "STRATEGY_ACTIVATED"
          : lifecycleStatus === "PAUSED"
            ? "STRATEGY_PAUSED"
            : "STRATEGY_UPDATED",
      details: {
        resourceType: "strategy",
        resourceId: strategyId,
        before: { lifecycleStatus: strategy.lifecycleStatus, rowVersion: strategy.rowVersion },
        after: { lifecycleStatus: updated.lifecycleStatus, rowVersion: updated.rowVersion },
        reason: typeof req.body?.reason === "string" ? req.body.reason.slice(0, 1000) : null,
      },
    });
    const assignmentRows = await listAssignments();
    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      activatedAt: updated.activatedAt?.toISOString() ?? null,
      pausedAt: updated.pausedAt?.toISOString() ?? null,
      assignedMarkets: assignmentRows.filter(
        ({ assignment }) => assignment.enabled && assignment.strategyId === updated.id,
      ).length,
    });
  },
);

router.get("/admin/symbols", requireUser, requireCapability("symbols.read"), async (_req, res) => {
  res.json((await listEffectiveMarkets()).map(adminSymbolResponse));
});

router.get("/admin/market-access", requireUser, requireCapability("symbols.read"), (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(adminMarketAccessRows());
});

async function adminAccessPolicyResponse(policy: ReturnType<typeof customerAccessPolicySnapshot>) {
  const markets = adminMarketAccessRows();
  const [membershipTierCounts, watchlistSizeDistribution] = await Promise.all([
    getEstimatedCustomerMembershipTierCounts(),
    getEstimatedWatchlistSizeDistribution(),
  ]);
  return {
    ...policy,
    estimatedMembershipTierCounts: membershipTierCounts,
    estimatedWatchlistSizeDistribution: watchlistSizeDistribution,
    starterSymbols: markets
      .filter((market) => market.marketType === "STRATEGY" && market.requiredTier === "Free")
      .map((market) => market.symbol),
    markets,
  };
}

router.get(
  "/admin/access-policy",
  requireUser,
  requireCapability("memberships.read"),
  async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await adminAccessPolicyResponse(customerAccessPolicySnapshot()));
  },
);

router.put(
  "/admin/access-policy",
  requireUser,
  requireCapability("memberships.manage"),
  async (req, res) => {
    const body =
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    if (
      typeof body.rowVersion !== "number" ||
      !Number.isSafeInteger(body.rowVersion) ||
      body.rowVersion < 1
    ) {
      res
        .status(400)
        .json({ error: "INVALID_ACCESS_POLICY", details: "A valid policy revision is required." });
      return;
    }

    try {
      await refreshCustomerAccessPolicy(defaultCustomerAccessPolicy(), true);
      const current = customerAccessPolicySnapshot();
      const expectedVersion = Number(body.rowVersion);
      if (expectedVersion !== current.rowVersion) {
        res.status(409).json({ error: "ACCESS_POLICY_CONFLICT", rowVersion: current.rowVersion });
        return;
      }

      const policy = validateCustomerAccessPolicy(
        {
          featureMinimumTiers: body.featureMinimumTiers,
          marketTiers: body.marketTiers,
          watchlistLimits: body.watchlistLimits,
        },
        defaultCustomerAccessPolicy(),
        current,
      );
      const actor = requestUser(req);
      const updated = await updateCustomerAccessPolicy({
        policy,
        expectedVersion,
        actorId: actor.id,
        actorEmail: actor.email,
      });
      res.setHeader("Cache-Control", "no-store");
      res.json(await adminAccessPolicyResponse(updated));
    } catch (error) {
      if (error instanceof AccessPolicyConflictError) {
        const latest = customerAccessPolicySnapshot();
        res.status(409).json({ error: "ACCESS_POLICY_CONFLICT", rowVersion: latest.rowVersion });
        return;
      }
      if (error instanceof AccessPolicyValidationError) {
        res.status(400).json({ error: "INVALID_ACCESS_POLICY", details: error.reason });
        return;
      }
      logger.error({ error }, "Failed to update the customer access policy");
      res.status(503).json({ error: "ACCESS_POLICY_UPDATE_FAILED" });
    }
  },
);

router.get(
  "/admin/market-inventory",
  requireUser,
  requireCapability("symbols.read"),
  async (_req, res): Promise<void> => {
    const effectiveMarkets = await listEffectiveMarkets();
    const effectiveBySymbol = new Map(
      effectiveMarkets.map((item) => [item.canonicalSymbol.toUpperCase(), item]),
    );
    const catalogBySymbol = new Map(
      marketCatalog.getAll().map((item) => [item.canonicalSymbol.toUpperCase(), item]),
    );
    const coreBySymbol = new Map(getCatalog().map((item) => [item.symbol.toUpperCase(), item]));
    const inventory = adminMarketAccessRows().map((access) =>
      adminMarketInventoryResponse(access, effectiveBySymbol, catalogBySymbol, coreBySymbol),
    );

    res.setHeader("Cache-Control", "no-store");
    res.json(inventory);
  },
);

router.get(
  "/admin/symbols/:symbol",
  requireUser,
  requireCapability("symbols.read"),
  async (req, res) => {
    const symbol = canonicalSymbol(String(req.params.symbol));
    if (!symbol) {
      res.status(400).json({ error: "INVALID_SYMBOL" });
      return;
    }
    const item = (await listEffectiveMarkets()).find((market) => market.canonicalSymbol === symbol);
    if (!item) {
      res.status(404).json({ error: "SYMBOL_NOT_FOUND" });
      return;
    }
    res.json(adminSymbolResponse(item));
  },
);

router.patch(
  "/admin/symbols/:symbol",
  requireUser,
  requireCapability("symbols.manage"),
  async (req, res) => {
    const symbol = canonicalSymbol(String(req.params.symbol));
    if (!symbol) {
      res.status(400).json({ error: "INVALID_SYMBOL" });
      return;
    }
    const current = await getSymbolControl(symbol);
    if (!current) {
      res.status(404).json({ error: "SYMBOL_NOT_FOUND" });
      return;
    }
    const rowVersion = Number(req.body?.rowVersion);
    if (!Number.isInteger(rowVersion) || rowVersion < 1) {
      res.status(400).json({ error: "INVALID_VERSION" });
      return;
    }
    if (rowVersion !== current.rowVersion) {
      res
        .status(409)
        .json({ error: "VERSION_CONFLICT", current: { rowVersion: current.rowVersion } });
      return;
    }
    const changes: {
      displaySymbol?: string;
      provider?: string;
      providerSymbol?: string;
      digits?: number;
      enabled?: boolean;
      visibleToUsers?: boolean;
    } = {};
    const body = req.body ?? {};
    if (body.displaySymbol !== undefined) {
      if (
        typeof body.displaySymbol !== "string" ||
        !body.displaySymbol.trim() ||
        body.displaySymbol.trim().length > 48
      ) {
        res.status(400).json({ error: "INVALID_DISPLAY_SYMBOL" });
        return;
      }
      changes.displaySymbol = body.displaySymbol.trim();
    }
    if (body.provider !== undefined) {
      if (body.provider !== current.provider) {
        res.status(400).json({ error: "UNSUPPORTED_PROVIDER" });
        return;
      }
      changes.provider = current.provider;
    }
    if (body.providerSymbol !== undefined) {
      if (
        typeof body.providerSymbol !== "string" ||
        !/^[A-Za-z0-9._-]{1,64}$/.test(body.providerSymbol.trim())
      ) {
        res.status(400).json({ error: "INVALID_PROVIDER_SYMBOL" });
        return;
      }
      changes.providerSymbol = body.providerSymbol.trim();
    }
    if (body.digits !== undefined) {
      if (!Number.isInteger(body.digits) || body.digits < 0 || body.digits > 12) {
        res.status(400).json({ error: "INVALID_DIGITS" });
        return;
      }
      changes.digits = body.digits;
    }
    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") {
        res.status(400).json({ error: "INVALID_ENABLED" });
        return;
      }
      changes.enabled = body.enabled;
    }
    if (body.visibleToUsers !== undefined) {
      if (typeof body.visibleToUsers !== "boolean") {
        res.status(400).json({ error: "INVALID_VISIBILITY" });
        return;
      }
      changes.visibleToUsers = body.visibleToUsers;
    }
    const archiveChanges: {
      archivedAt?: Date | null;
      archiveEnabled?: boolean | null;
      archiveVisibleToUsers?: boolean | null;
    } = {};
    const now = new Date();
    if (body.archived !== undefined) {
      if (typeof body.archived !== "boolean") {
        res.status(400).json({ error: "INVALID_ARCHIVE_STATE" });
        return;
      }
      if (body.enabled !== undefined || body.visibleToUsers !== undefined) {
        res.status(400).json({ error: "ARCHIVE_STATUS_CONFLICT" });
        return;
      }
      if (body.archived) {
        if (current.archivedAt) {
          res.status(409).json({ error: "SYMBOL_ALREADY_ARCHIVED" });
          return;
        }
        changes.enabled = false;
        changes.visibleToUsers = false;
        archiveChanges.archivedAt = now;
        archiveChanges.archiveEnabled = current.enabled;
        archiveChanges.archiveVisibleToUsers = current.visibleToUsers;
      } else {
        if (!current.archivedAt) {
          res.status(409).json({ error: "SYMBOL_NOT_ARCHIVED" });
          return;
        }
        changes.enabled = current.archiveEnabled ?? true;
        changes.visibleToUsers = current.archiveVisibleToUsers ?? true;
        archiveChanges.archivedAt = null;
        archiveChanges.archiveEnabled = null;
        archiveChanges.archiveVisibleToUsers = null;
      }
    } else if (
      current.archivedAt &&
      ((changes.enabled ?? current.enabled) || (changes.visibleToUsers ?? current.visibleToUsers))
    ) {
      res.status(409).json({ error: "SYMBOL_ARCHIVED" });
      return;
    }
    if (!Object.keys(changes).length && !Object.keys(archiveChanges).length) {
      res.status(400).json({ error: "NO_CHANGES" });
      return;
    }
    const actor = requestUser(req);
    const [updated] = await db
      .update(tradifySymbols)
      .set({
        ...changes,
        ...archiveChanges,
        updatedAt: now,
        updatedBy: actor.id,
        rowVersion: current.rowVersion + 1,
      })
      .where(
        and(eq(tradifySymbols.canonicalSymbol, symbol), eq(tradifySymbols.rowVersion, rowVersion)),
      )
      .returning();
    if (!updated) {
      res.status(409).json({ error: "VERSION_CONFLICT" });
      return;
    }
    marketCatalog.update(symbol, changes);
    if (updated.providerSymbol !== current.providerSymbol) {
      mt5BridgeStore.setMapping(symbol, updated.providerSymbol);
    }
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action:
        body.archived === true
          ? "SYMBOL_ARCHIVED"
          : body.archived === false
            ? "SYMBOL_RESTORED"
            : changes.providerSymbol !== undefined
              ? "SYMBOL_MAPPING_UPDATED"
              : changes.enabled === undefined
                ? "SYMBOL_CONTROL_UPDATED"
                : changes.enabled
                  ? "SYMBOL_ENABLED"
                  : "SYMBOL_DISABLED",
      details: {
        resourceType: "symbol",
        resourceId: symbol,
        before: {
          displaySymbol: current.displaySymbol,
          provider: current.provider,
          providerSymbol: current.providerSymbol,
          digits: current.digits,
          enabled: current.enabled,
          visibleToUsers: current.visibleToUsers,
          archived: Boolean(current.archivedAt),
        },
        after: { ...changes, archived: Boolean(updated.archivedAt) },
        rowVersion: updated.rowVersion,
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null,
      },
    });
    const effective = (await listEffectiveMarkets()).find(
      (market) => market.canonicalSymbol === symbol,
    );
    if (!effective) {
      res.status(404).json({ error: "SYMBOL_NOT_FOUND" });
      return;
    }
    res.json(adminSymbolResponse(effective));
  },
);

router.get(
  "/admin/assignments",
  requireUser,
  requireCapability("strategies.read"),
  async (_req, res) => {
    res.json((await listAssignments()).map(adminAssignmentResponse));
  },
);

router.post(
  "/admin/assignments",
  requireUser,
  requireCapability("strategies.manage"),
  async (req, res) => {
    const body = req.body ?? {};
    const strategyId =
      typeof body.strategyId === "string" ? body.strategyId.trim().toUpperCase() : "";
    const strategyVersion =
      typeof body.strategyVersion === "string" ? body.strategyVersion.trim() : "";
    const symbol = typeof body.symbol === "string" ? canonicalSymbol(body.symbol) : "";
    const timeframe = typeof body.timeframe === "string" ? body.timeframe.trim().toUpperCase() : "";
    if (
      !strategyId ||
      !strategyVersion ||
      !symbol ||
      timeframe !== "M15" ||
      typeof body.enabled !== "boolean" ||
      typeof body.isDefault !== "boolean" ||
      (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string")
    ) {
      res.status(400).json({ error: "INVALID_ASSIGNMENT" });
      return;
    }
    const strategy = await getStrategy(strategyId);
    const symbolControl = await getSymbolControl(symbol);
    const catalog = marketCatalog.get(symbol);
    if (!strategy || !symbolControl || !catalog) {
      res.status(404).json({ error: "STRATEGY_OR_SYMBOL_NOT_FOUND" });
      return;
    }
    if (symbolControl.archivedAt) {
      res.status(409).json({ error: "SYMBOL_ARCHIVED" });
      return;
    }
    if (strategy.version !== strategyVersion) {
      res.status(409).json({ error: "STRATEGY_VERSION_MISMATCH" });
      return;
    }
    if (!(catalog.availableStrategies ?? []).includes(strategyId)) {
      res.status(400).json({ error: "UNSUPPORTED_STRATEGY_SYMBOL_PAIR" });
      return;
    }
    if (body.enabled && strategy.lifecycleStatus !== "ACTIVE") {
      res.status(409).json({ error: "STRATEGY_NOT_ACTIVE" });
      return;
    }
    if (body.enabled && !symbolControl.enabled) {
      res.status(409).json({ error: "SYMBOL_DISABLED" });
      return;
    }
    if (body.isDefault && !body.enabled) {
      res.status(400).json({ error: "DEFAULT_ASSIGNMENT_MUST_BE_ENABLED" });
      return;
    }
    if (typeof body.notes === "string" && body.notes.length > 1000) {
      res.status(400).json({ error: "NOTES_TOO_LONG" });
      return;
    }
    if (body.isDefault) {
      const [existingDefault] = await db
        .select({ id: tradifyStrategyAssignments.id })
        .from(tradifyStrategyAssignments)
        .where(
          and(
            eq(tradifyStrategyAssignments.symbol, symbol),
            eq(tradifyStrategyAssignments.timeframe, timeframe),
            eq(tradifyStrategyAssignments.enabled, true),
            eq(tradifyStrategyAssignments.isDefault, true),
          ),
        )
        .limit(1);
      if (existingDefault) {
        res
          .status(409)
          .json({ error: "DEFAULT_ASSIGNMENT_EXISTS", assignmentId: existingDefault.id });
        return;
      }
    }
    const actor = requestUser(req);
    const now = new Date();
    const id = globalThis.crypto.randomUUID();
    try {
      await db.insert(tradifyStrategyAssignments).values({
        id,
        strategyId,
        strategyVersion,
        symbol,
        timeframe,
        enabled: body.enabled,
        isDefault: body.isDefault,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        activatedAt: body.enabled ? now : null,
        deactivatedAt: body.enabled ? null : now,
        createdBy: actor.id,
        updatedBy: actor.id,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (databaseErrorCode(error) === "23505") {
        res.status(409).json({ error: "ASSIGNMENT_CONFLICT" });
        return;
      }
      throw error;
    }
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "STRATEGY_ASSIGNED",
      details: {
        resourceType: "strategy_assignment",
        resourceId: id,
        after: {
          strategyId,
          strategyVersion,
          symbol,
          timeframe,
          enabled: body.enabled,
          isDefault: body.isDefault,
        },
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null,
      },
    });
    const row = (await listAssignments()).find(({ assignment }) => assignment.id === id);
    res.status(201).json(row ? adminAssignmentResponse(row) : { id });
  },
);

router.patch(
  "/admin/assignments/:assignmentId",
  requireUser,
  requireCapability("strategies.manage"),
  async (req, res) => {
    const assignmentId = String(req.params.assignmentId);
    const [current] = await db
      .select()
      .from(tradifyStrategyAssignments)
      .where(eq(tradifyStrategyAssignments.id, assignmentId))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "ASSIGNMENT_NOT_FOUND" });
      return;
    }
    const body = req.body ?? {};
    const rowVersion = Number(body.rowVersion);
    if (!Number.isInteger(rowVersion) || rowVersion < 1) {
      res.status(400).json({ error: "INVALID_VERSION" });
      return;
    }
    if (rowVersion !== current.rowVersion) {
      res
        .status(409)
        .json({ error: "VERSION_CONFLICT", current: { rowVersion: current.rowVersion } });
      return;
    }
    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
      res.status(400).json({ error: "INVALID_ENABLED" });
      return;
    }
    if (body.isDefault !== undefined && typeof body.isDefault !== "boolean") {
      res.status(400).json({ error: "INVALID_DEFAULT" });
      return;
    }
    if (
      body.notes !== undefined &&
      body.notes !== null &&
      (typeof body.notes !== "string" || body.notes.length > 1000)
    ) {
      res.status(400).json({ error: "INVALID_NOTES" });
      return;
    }
    if (body.enabled === undefined && body.isDefault === undefined && body.notes === undefined) {
      res.status(400).json({ error: "NO_CHANGES" });
      return;
    }
    const nextEnabled = body.enabled ?? current.enabled;
    const nextDefault = nextEnabled ? (body.isDefault ?? current.isDefault) : false;
    const strategy = await getStrategy(current.strategyId);
    const symbol = await getSymbolControl(current.symbol);
    const catalog = marketCatalog.get(current.symbol);
    if (!strategy || !symbol || !catalog) {
      res.status(404).json({ error: "STRATEGY_OR_SYMBOL_NOT_FOUND" });
      return;
    }
    if (symbol.archivedAt && (body.enabled === true || body.isDefault === true)) {
      res.status(409).json({ error: "SYMBOL_ARCHIVED" });
      return;
    }
    if (
      (body.enabled === true || body.isDefault === true) &&
      strategy.lifecycleStatus !== "ACTIVE"
    ) {
      res.status(409).json({ error: "STRATEGY_NOT_ACTIVE" });
      return;
    }
    if ((body.enabled === true || body.isDefault === true) && !symbol.enabled) {
      res.status(409).json({ error: "SYMBOL_DISABLED" });
      return;
    }
    if (!(catalog.availableStrategies ?? []).includes(current.strategyId)) {
      res.status(400).json({ error: "UNSUPPORTED_STRATEGY_SYMBOL_PAIR" });
      return;
    }
    if (nextDefault && !nextEnabled) {
      res.status(400).json({ error: "DEFAULT_ASSIGNMENT_MUST_BE_ENABLED" });
      return;
    }
    if (nextDefault) {
      const [otherDefault] = await db
        .select({ id: tradifyStrategyAssignments.id })
        .from(tradifyStrategyAssignments)
        .where(
          and(
            eq(tradifyStrategyAssignments.symbol, current.symbol),
            eq(tradifyStrategyAssignments.timeframe, current.timeframe),
            eq(tradifyStrategyAssignments.enabled, true),
            eq(tradifyStrategyAssignments.isDefault, true),
          ),
        )
        .limit(1);
      if (otherDefault && otherDefault.id !== current.id) {
        res.status(409).json({ error: "DEFAULT_ASSIGNMENT_EXISTS", assignmentId: otherDefault.id });
        return;
      }
    }
    const actor = requestUser(req);
    const now = new Date();
    const [updated] = await db
      .update(tradifyStrategyAssignments)
      .set({
        enabled: nextEnabled,
        isDefault: nextDefault,
        ...(body.notes !== undefined
          ? { notes: typeof body.notes === "string" ? body.notes.trim() || null : null }
          : {}),
        activatedAt: nextEnabled ? (current.activatedAt ?? now) : current.activatedAt,
        deactivatedAt: nextEnabled ? null : now,
        updatedAt: now,
        updatedBy: actor.id,
        rowVersion: current.rowVersion + 1,
      })
      .where(
        and(
          eq(tradifyStrategyAssignments.id, assignmentId),
          eq(tradifyStrategyAssignments.rowVersion, rowVersion),
        ),
      )
      .returning();
    if (!updated) {
      res.status(409).json({ error: "VERSION_CONFLICT" });
      return;
    }
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: !updated.enabled
        ? "STRATEGY_UNASSIGNED"
        : body.enabled === true
          ? "STRATEGY_ASSIGNMENT_ENABLED"
          : "STRATEGY_ASSIGNMENT_UPDATED",
      details: {
        resourceType: "strategy_assignment",
        resourceId: assignmentId,
        before: {
          enabled: current.enabled,
          isDefault: current.isDefault,
          notes: current.notes,
          rowVersion: current.rowVersion,
        },
        after: {
          enabled: updated.enabled,
          isDefault: updated.isDefault,
          notes: updated.notes,
          rowVersion: updated.rowVersion,
        },
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null,
      },
    });
    const row = (await listAssignments()).find(({ assignment }) => assignment.id === assignmentId);
    res.json(row ? adminAssignmentResponse(row) : { id: assignmentId });
  },
);

router.get(
  "/admin/evaluations",
  requireUser,
  requireCapability("signals.read"),
  async (req, res) => {
    const conditions = [];
    const queryString = (key: string): string | undefined =>
      typeof req.query[key] === "string" ? String(req.query[key]).trim() : undefined;
    const fromRaw = queryString("from");
    const toRaw = queryString("to");
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    if ((fromRaw && Number.isNaN(from?.getTime())) || (toRaw && Number.isNaN(to?.getTime()))) {
      res.status(400).json({ error: "INVALID_DATE_FILTER" });
      return;
    }
    if (from && to && from > to) {
      res.status(400).json({ error: "INVALID_DATE_RANGE" });
      return;
    }
    if (from) conditions.push(gte(tradifyEvaluationHistory.createdAt, from));
    if (to) conditions.push(lte(tradifyEvaluationHistory.createdAt, to));
    const symbol = queryString("symbol");
    const strategy = queryString("strategy");
    const strategyVersion = queryString("strategyVersion");
    const timeframe = queryString("timeframe");
    const result = queryString("result");
    const signalId = queryString("signalId");
    const error = queryString("error");
    if (symbol) {
      const normalizedSymbol = canonicalSymbol(symbol);
      if (!normalizedSymbol) {
        res.status(400).json({ error: "INVALID_SYMBOL" });
        return;
      }
      conditions.push(eq(tradifyEvaluationHistory.symbol, normalizedSymbol));
    }
    if (strategy) conditions.push(eq(tradifyEvaluationHistory.strategyId, strategy.toUpperCase()));
    if (strategyVersion)
      conditions.push(eq(tradifyEvaluationHistory.strategyVersion, strategyVersion));
    if (timeframe) conditions.push(eq(tradifyEvaluationHistory.timeframe, timeframe.toUpperCase()));
    if (result) conditions.push(eq(tradifyEvaluationHistory.result, result.toUpperCase()));
    if (signalId) conditions.push(eq(tradifyEvaluationHistory.signalId, signalId));
    if (error)
      conditions.push(ilike(tradifyEvaluationHistory.errorCategory, `%${error.slice(0, 80)}%`));
    const generatedRaw = req.query.generated;
    if (generatedRaw === "true")
      conditions.push(eq(tradifyEvaluationHistory.signalGenerated, true));
    else if (generatedRaw === "false")
      conditions.push(eq(tradifyEvaluationHistory.signalGenerated, false));
    else if (generatedRaw !== undefined) {
      res.status(400).json({ error: "INVALID_GENERATED_FILTER" });
      return;
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const requestedPage = Number(req.query.page ?? 1);
    const requestedPageSize = Number(req.query.pageSize ?? 25);
    if (
      !Number.isInteger(requestedPage) ||
      requestedPage < 1 ||
      requestedPage > 1_000_000 ||
      !Number.isInteger(requestedPageSize) ||
      requestedPageSize < 1 ||
      requestedPageSize > 100
    ) {
      res.status(400).json({ error: "INVALID_PAGINATION" });
      return;
    }
    const [totalRow, items] = await Promise.all([
      db.select({ total: count() }).from(tradifyEvaluationHistory).where(where),
      db
        .select()
        .from(tradifyEvaluationHistory)
        .where(where)
        .orderBy(desc(tradifyEvaluationHistory.createdAt), desc(tradifyEvaluationHistory.id))
        .limit(requestedPageSize)
        .offset((requestedPage - 1) * requestedPageSize),
    ]);
    res.json({
      items,
      total: totalRow[0]?.total ?? 0,
      page: requestedPage,
      pageSize: requestedPageSize,
    });
  },
);

router.get(
  "/admin/evaluations/:evaluationId",
  requireUser,
  requireCapability("signals.read"),
  async (req, res) => {
    const evaluationId = String(req.params.evaluationId);
    const [evaluation] = await db
      .select()
      .from(tradifyEvaluationHistory)
      .where(eq(tradifyEvaluationHistory.id, evaluationId))
      .limit(1);
    if (!evaluation) {
      res.status(404).json({ error: "EVALUATION_NOT_FOUND" });
      return;
    }
    const [signal] = evaluation.signalId
      ? await db
          .select()
          .from(tradifyGeneratedSignals)
          .where(eq(tradifyGeneratedSignals.id, evaluation.signalId))
          .limit(1)
      : [];
    res.json({ ...evaluation, signal: signal ?? null });
  },
);

router.get("/admin/staff", requireUser, requireCapability("staff.read"), async (_req, res) => {
  res.json((await listStaffAccess()).map((access) => staffAccessSummary(access)));
});

router.post("/admin/staff", requireUser, requireCapability("staff.manage"), async (req, res) => {
  const body = req.body ?? {};
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const customPermissions = body.customPermissions;
  const active = body.active === undefined ? true : body.active;
  if (
    !userId ||
    !STAFF_ROLES.includes(role as StaffRole) ||
    !Array.isArray(customPermissions) ||
    customPermissions.some(
      (permission: unknown) =>
        typeof permission !== "string" ||
        !STAFF_CAPABILITIES.includes(permission as StaffCapability),
    ) ||
    typeof active !== "boolean"
  ) {
    res.status(400).json({ error: "INVALID_STAFF_ACCESS" });
    return;
  }
  const target = getUserById(userId);
  if (!target) {
    res.status(404).json({ error: "USER_NOT_FOUND" });
    return;
  }
  if (await getStaffAccess(userId)) {
    res.status(409).json({ error: "STAFF_ACCESS_EXISTS" });
    return;
  }
  const actor = requestUser(req);
  const now = new Date();
  const permissions = [...new Set(customPermissions as string[])];
  try {
    await db.insert(tradifyStaffAccess).values({
      userId,
      role,
      customPermissions: permissions,
      active,
      rowVersion: 1,
      grantedBy: actor.id,
      updatedBy: actor.id,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (databaseErrorCode(error) === "23505") {
      res.status(409).json({ error: "STAFF_ACCESS_EXISTS" });
      return;
    }
    throw error;
  }
  await recordAdminAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "STAFF_ACCESS_GRANTED",
    targetUserId: target.id,
    targetEmail: target.email,
    details: {
      resourceType: "staff_access",
      resourceId: target.id,
      after: { role, customPermissions: permissions, active },
      reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null,
    },
  });
  const access = await getStaffAccess(userId);
  if (!access) {
    res.status(500).json({ error: "STAFF_ACCESS_UNAVAILABLE" });
    return;
  }
  res
    .status(201)
    .json(staffAccessSummary(access, { email: target.email, name: target.profile.name }));
});

router.patch(
  "/admin/staff/:userId",
  requireUser,
  requireCapability("staff.manage"),
  async (req, res) => {
    const userId = String(req.params.userId);
    const body = req.body ?? {};
    const role = typeof body.role === "string" ? body.role : "";
    const customPermissions = body.customPermissions;
    const rowVersion = Number(body.rowVersion);
    if (
      !STAFF_ROLES.includes(role as StaffRole) ||
      !Array.isArray(customPermissions) ||
      customPermissions.some(
        (permission: unknown) =>
          typeof permission !== "string" ||
          !STAFF_CAPABILITIES.includes(permission as StaffCapability),
      ) ||
      typeof body.active !== "boolean" ||
      !Number.isInteger(rowVersion) ||
      rowVersion < 1
    ) {
      res.status(400).json({ error: "INVALID_STAFF_ACCESS" });
      return;
    }
    const target = getUserById(userId);
    if (!target) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    const current = await getStaffAccess(userId);
    if (!current) {
      res.status(404).json({ error: "STAFF_ACCESS_NOT_FOUND" });
      return;
    }
    if (current.rowVersion !== rowVersion) {
      res
        .status(409)
        .json({ error: "VERSION_CONFLICT", current: { rowVersion: current.rowVersion } });
      return;
    }
    const nextPermissions = [...new Set(customPermissions as string[])];
    const remainingSuperAdmins = (await listStaffAccess()).filter(
      (access) => access.userId !== userId && access.active && access.role === "SUPER_ADMIN",
    ).length;
    if (
      current.active &&
      current.role === "SUPER_ADMIN" &&
      (!body.active || role !== "SUPER_ADMIN") &&
      remainingSuperAdmins === 0
    ) {
      res.status(409).json({ error: "LAST_ACTIVE_SUPER_ADMIN" });
      return;
    }
    const actor = requestUser(req);
    const now = new Date();
    const [updated] = await db
      .update(tradifyStaffAccess)
      .set({
        role,
        customPermissions: nextPermissions,
        active: body.active,
        updatedBy: actor.id,
        updatedAt: now,
        rowVersion: current.rowVersion + 1,
      })
      .where(
        and(eq(tradifyStaffAccess.userId, userId), eq(tradifyStaffAccess.rowVersion, rowVersion)),
      )
      .returning();
    if (!updated) {
      res.status(409).json({ error: "VERSION_CONFLICT" });
      return;
    }
    const roleChanged = current.role !== updated.role;
    const permissionsChanged =
      JSON.stringify(current.customPermissions) !== JSON.stringify(updated.customPermissions);
    await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: roleChanged
        ? "STAFF_ROLE_CHANGED"
        : permissionsChanged
          ? "STAFF_PERMISSIONS_CHANGED"
          : "STAFF_ACCESS_UPDATED",
      targetUserId: target.id,
      targetEmail: target.email,
      details: {
        resourceType: "staff_access",
        resourceId: userId,
        before: {
          role: current.role,
          customPermissions: current.customPermissions,
          active: current.active,
          rowVersion: current.rowVersion,
        },
        after: {
          role: updated.role,
          customPermissions: updated.customPermissions,
          active: updated.active,
          rowVersion: updated.rowVersion,
        },
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null,
      },
    });
    res.json(staffAccessSummary(updated, { email: target.email, name: target.profile.name }));
  },
);

router.get(
  "/admin/diagnostics",
  requireUser,
  requireCapability("market_data.read"),
  async (_req, res) => {
    const bridge = mt5BridgeStore.getStatus();
    const mappings = mt5BridgeStore.getMappings();
    const pendingM15Symbols = mt5BridgeStore.getPendingBackfillSymbols();
    const allActiveM15SyncComplete = mt5BridgeStore.isBackfillCompleted();
    const activeSymbols = new Set(
      bridge.activeSymbols.map(
        (symbol) =>
          Object.entries(bridge.mappings).find(
            ([, brokerSymbol]) => brokerSymbol === symbol,
          )?.[0] ?? symbol.toUpperCase(),
      ),
    );
    const markets = await listEffectiveMarkets();
    res.json(
      markets.map((item) => {
        const configuredBrokerSymbol = mappings[item.canonicalSymbol] ?? item.providerSymbol;
        const observedBrokerSymbol = bridge.mappings[item.canonicalSymbol] ?? null;
        const brokerSymbol = observedBrokerSymbol ?? configuredBrokerSymbol;
        const quote = bridgeStore.getQuote(item.canonicalSymbol);
        const candleBuffers = Object.fromEntries(
          ["M1", "M5", "M15", "H1", "H4"].map((timeframe) => [
            timeframe,
            mt5BridgeStore.getCandlesForBrokerSymbol(brokerSymbol, timeframe)?.length ?? 0,
          ]),
        );
        const requiresMt5Strategy =
          item.enabled && item.strategyConfigured && item.provider.toUpperCase() === "MT5";
        const subscriptionRequired =
          activeSymbols.has(item.canonicalSymbol) || bridge.activeSymbols.includes(brokerSymbol);
        const quoteAgeMs = quote?.receivedAt ? Math.max(0, Date.now() - quote.receivedAt) : -1;
        const hasFreshQuote = Boolean(quote) && quoteAgeMs < 30_000;
        const symbolM15FullSyncComplete = mt5BridgeStore.isSymbolBackfillCompleted(brokerSymbol);
        const tradingSessionsAccepted = Boolean(
          marketCatalog.getCurrentBrokerTradingSessions(item.canonicalSymbol, brokerSymbol),
        );
        const bridgeReadinessBlockers: string[] = [];
        if (requiresMt5Strategy) {
          if (!bridge.connected) bridgeReadinessBlockers.push("MT5 bridge is disconnected");
          if (!subscriptionRequired)
            bridgeReadinessBlockers.push("Strategy symbol is not subscribed by the bridge");
          if (!hasFreshQuote) bridgeReadinessBlockers.push("No fresh MT5 quote");
          if ((candleBuffers.M15 ?? 0) < 50)
            bridgeReadinessBlockers.push(`M15 history is ${candleBuffers.M15 ?? 0}/50 candles`);
          if (!symbolM15FullSyncComplete)
            bridgeReadinessBlockers.push("This symbol's full M15 sync has not been acknowledged");
          if (!allActiveM15SyncComplete) {
            bridgeReadinessBlockers.push(
              pendingM15Symbols.length > 0
                ? `Full M15 sync is still pending for: ${pendingM15Symbols.join(", ")}`
                : "Full M15 sync is not complete for the active bridge symbols",
            );
          }
          if (!tradingSessionsAccepted)
            bridgeReadinessBlockers.push("Fresh, valid broker trading-session schedule is missing");
          if (!item.brokerSpec)
            bridgeReadinessBlockers.push("Broker contract specification is missing");
        }
        const syncState = !bridge.connected
          ? "BRIDGE_DISCONNECTED"
          : !subscriptionRequired
            ? "NOT_SUBSCRIBED"
            : "SUBSCRIBED_UNVALIDATED";
        return {
          symbol: item.canonicalSymbol,
          brokerSymbol,
          observedBrokerSymbol,
          configuredBrokerSymbol,
          configuredProviderSymbol: item.providerSymbol,
          enabled: item.enabled,
          strategyId: item.defaultStrategyId,
          assignmentConfigured: item.strategyConfigured,
          subscriptionRequired,
          quoteExists: Boolean(quote),
          quoteAgeMs,
          candleBuffers,
          requiresMt5Strategy,
          symbolM15FullSyncComplete,
          allActiveM15SyncComplete,
          pendingM15Symbols,
          tradingSessionsAccepted,
          bridgeReadinessBlockers,
          bridgeConnected: bridge.connected,
          lastHeartbeat: bridge.lastHeartbeat ?? null,
          lastHeartbeatAgeSeconds: bridge.lastHeartbeat
            ? Math.max(0, Math.floor((Date.now() - bridge.lastHeartbeat) / 1000))
            : null,
          syncState,
          guards: [
            { id: "ENGINE_ACTIVE", label: "Engine active", passed: engineState.isActive() },
            { id: "BRIDGE_CONNECTED", label: "MT5 bridge connected", passed: bridge.connected },
            { id: "SYMBOL_SUBSCRIBED", label: "Symbol subscribed", passed: subscriptionRequired },
            {
              id: "QUOTE_PRESENT",
              label: "Fresh quote present",
              passed: Boolean(quote) && quoteAgeMs < 30_000,
            },
            {
              id: "M15_HISTORY",
              label: "M15 history available",
              passed: (candleBuffers.M15 ?? 0) >= 50,
            },
            {
              id: "STRATEGY_ASSIGNED",
              label: "Strategy assigned",
              passed: Boolean(item.defaultStrategyId),
            },
            {
              id: "BROKER_CONTRACT",
              label: "Broker contract synced",
              passed: Boolean(item.brokerSpec),
            },
          ],
        };
      }),
    );
  },
);

router.get(
  "/admin/diagnostics/candles",
  requireUser,
  requireCapability("market_data.read"),
  async (req, res) => {
    const symbol = canonicalSymbol(String(req.query.symbol ?? ""));
    const item = symbol
      ? (await listEffectiveMarkets()).find((market) => market.canonicalSymbol === symbol)
      : undefined;
    const timeframe = String(req.query.timeframe ?? "M15").toUpperCase();
    if (!item || !["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"].includes(timeframe)) {
      res.status(400).json({ error: "INVALID_DIAGNOSTIC_QUERY" });
      return;
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const brokerSymbol = mt5BridgeStore.getMappings()[item.canonicalSymbol] ?? item.providerSymbol;
    const candles = mt5BridgeStore.getCandlesForBrokerSymbol(brokerSymbol, timeframe) ?? [];
    res.json({
      symbol: item.canonicalSymbol,
      brokerSymbol,
      timeframe,
      candles: candles.slice(-limit),
      count: candles.length,
    });
  },
);

router.get("/admin/lab", requireUser, requireCapability("signals.read"), async (req, res) => {
  const symbol = canonicalSymbol(String(req.query.symbol ?? ""));
  if (!symbol) {
    res.status(400).json({ error: "INVALID_SYMBOL" });
    return;
  }
  const requestedStrategy = typeof req.query.strategy === "string" ? req.query.strategy : undefined;
  const evaluation = await evaluateSymbol(symbol, requestedStrategy, undefined, "ADMIN_DIAGNOSTIC");
  if (!evaluation) {
    res.status(404).json({ error: "SIGNAL_NOT_FOUND" });
    return;
  }
  const diagnostic = diagnosticFor(evaluation);
  const facts = evaluation.signal.strategyFacts ?? {};
  const bridgeStatus = mt5BridgeStore.getStatus();
  const configuredMapping = mt5BridgeStore.getMappings()[symbol] ?? evaluation.providerSymbol;
  const observedMapping = bridgeStatus.mappings[symbol] ?? null;
  res.json({
    ...diagnostic,
    assignedStrategy: await assignedStrategy(symbol),
    currentAssignmentId: evaluation.assignmentId,
    bridgeEvidence: {
      connected: bridgeStatus.connected,
      lastHeartbeat: bridgeStatus.lastHeartbeat ?? null,
      lastHeartbeatAgeSeconds: bridgeStatus.lastHeartbeat
        ? Math.max(0, Math.floor((Date.now() - bridgeStatus.lastHeartbeat) / 1000))
        : null,
      configuredMapping,
      observedMapping,
      quoteAvailable: Boolean(evaluation.quote),
      quoteAgeSeconds: evaluation.sourceAgeSeconds ?? null,
      m15CandleCount: evaluation.candles.length,
      newestCandleTime: evaluation.candles.at(-1)?.time ?? null,
      marketDataTrusted: evaluation.provenance.marketDataTrusted,
    },
    sessionPivots: facts.sessions ?? facts.pivots ?? {},
    geometry: {
      entry: diagnostic.entry,
      buyGate: diagnostic.buyGate,
      sellGate: diagnostic.sellGate,
      stopLoss: diagnostic.stopLoss,
      targets: diagnostic.targets,
      invalidation: diagnostic.direction === "SHORT" ? diagnostic.buyGate : diagnostic.sellGate,
    },
  });
});

router.get(
  "/admin/users/:id/notes",
  requireUser,
  requireCapability("users.read"),
  async (req, res) => {
    if (!getUserById(String(req.params.id))) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    res.json(await getAdminUserNotes(String(req.params.id)));
  },
);

router.post(
  "/admin/users/:id/notes",
  requireUser,
  requireCapability("users.manage"),
  async (req, res) => {
    const user = getUserById(String(req.params.id));
    if (!user) {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    const category = req.body?.category;
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (
      !["GENERAL", "BILLING", "COMPLIANCE", "SUPPORT", "RISK"].includes(category) ||
      !body ||
      body.length > 2000
    ) {
      res.status(400).json({ error: "INVALID_ADMIN_NOTE" });
      return;
    }
    const actor = requestUser(req);
    const entry = await recordAdminAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ADMIN_NOTE_ADDED",
      targetUserId: user.id,
      targetEmail: user.email,
      details: { category, body },
    });
    res.status(201).json({
      id: entry.id,
      userId: user.id,
      category,
      body,
      authorEmail: actor.email,
      createdAt: entry.createdAt,
    });
  },
);

router.post("/mt5/bridge/heartbeat", requireBridge, async (req, res) => {
  await mt5BridgeStore.hydrateFromPersistence();
  bridgeStore.updateHeartbeat(req.body ?? {});
  await mt5BridgeStore.flushPersistence();
  res.json({ ok: true, status: bridgeStore.getStatus() });
});
router.post("/mt5/bridge/quotes", requireBridge, async (req, res) => {
  await mt5BridgeStore.hydrateFromPersistence();
  const accepted = bridgeStore.updateQuotes(req.body ?? {});
  await mt5BridgeStore.flushPersistence();
  res.json({ ok: true, accepted });
});
router.post("/mt5/bridge/candles", requireBridge, async (req, res) => {
  await mt5BridgeStore.hydrateFromPersistence();
  const accepted = bridgeStore.updateCandles(req.body ?? {});
  await mt5BridgeStore.flushPersistence();
  res.json({
    ok: true,
    accepted,
    isBackfilled: mt5BridgeStore.isBackfillCompleted(),
  });
});
router.post("/mt5/bridge/history/coverage", requireBridge, async (req, res) => {
  const body = req.body as Record<string, unknown> | null;
  const brokerSymbol = typeof body?.symbol === "string" ? body.symbol.trim() : "";
  const startUtc = Number(body?.startUtc);
  const endUtc = Number(body?.endUtc);
  const symbol = brokerSymbol ? canonicalSymbol(brokerSymbol) : null;
  if (
    !symbol ||
    !Number.isSafeInteger(startUtc) ||
    !Number.isSafeInteger(endUtc) ||
    startUtc <= 0 ||
    endUtc <= startUtc ||
    endUtc - startUtc > 10 * 86_400 ||
    startUtc % 900 !== 0 ||
    endUtc % 900 !== 0
  ) {
    res.status(400).json({ error: "INVALID_M15_HISTORY_RANGE" });
    return;
  }

  await mt5BridgeStore.hydrateFromPersistence();
  const schedule = marketCatalog.getCurrentBrokerTradingSessions(symbol, brokerSymbol);
  if (!schedule) {
    res.status(409).json({ error: "VERIFIED_BROKER_SESSIONS_UNAVAILABLE" });
    return;
  }
  const candles = mt5BridgeStore.getCandlesForBrokerSymbol(brokerSymbol, "M15") ?? [];
  try {
    const missingIntervals = findMissingMt5M15Intervals(
      startUtc,
      endUtc,
      candles.map((candle) => candle.time),
      schedule,
    );
    res.setHeader("Cache-Control", "no-store");
    const serverRange = {
      startServerEpoch: mt5ServerWallTimeFromUtc(startUtc),
      endServerEpoch: mt5ServerWallTimeFromUtc(endUtc),
    };
    const serverIntervals = missingIntervals.map((interval) => ({
      ...interval,
      startServerEpoch: mt5ServerWallTimeFromUtc(interval.startUtc),
      endServerEpoch: mt5ServerWallTimeFromUtc(interval.endUtc),
    }));
    if (
      !serverRange.startServerEpoch ||
      !serverRange.endServerEpoch ||
      serverIntervals.some((interval) => !interval.startServerEpoch || !interval.endServerEpoch)
    ) {
      res.status(409).json({ error: "HISTORICAL_SERVER_TIME_UNREPRESENTABLE" });
      return;
    }
    res.json({
      symbol: brokerSymbol,
      timeframe: "M15",
      startUtc,
      endUtc,
      serverUtcOffsetSeconds: schedule.serverUtcOffsetSeconds,
      rangeStartServerEpoch: serverRange.startServerEpoch,
      rangeEndServerEpoch: serverRange.endServerEpoch,
      complete: missingIntervals.length === 0,
      missingIntervals: serverIntervals,
    });
  } catch {
    res.status(400).json({ error: "INVALID_M15_HISTORY_RANGE_OR_SCHEDULE" });
  }
});
router.post("/mt5/bridge/specs", requireBridge, async (req, res) =>
  res.json({ ok: true, accepted: await bridgeStore.updateSpecifications(req.body ?? {}) }),
);

router.get("/mt5/customer/bridge/subscriptions", async (req, res) => {
  const authorization = await authorizeCustomerMt5Bridge(req, res);
  if (!authorization) return;
  const { store } = authorization;
  await store.hydrateFromPersistence();
  const status = store.getStatus();
  res.setHeader("Cache-Control", "no-store");
  res.json({
    version: status.subscriptionVersion,
    symbols: status.activeSymbols,
    quoteSymbols: [],
    generationId: store.getServerGenerationId(),
    isBackfilled: store.isBackfillCompleted(),
    requireFullSync: !store.isBackfillCompleted(),
  });
});

router.get("/mt5/customer/bridge/mappings", async (req, res) => {
  const authorization = await authorizeCustomerMt5Bridge(req, res);
  if (!authorization) return;
  await authorization.store.hydrateFromPersistence();
  res.setHeader("Cache-Control", "no-store");
  res.json(authorization.store.getMappings());
});

router.post("/mt5/customer/bridge/heartbeat", async (req, res) => {
  const authorization = await authorizeCustomerMt5Bridge(req, res);
  if (!authorization) return;
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  await authorization.store.hydrateFromPersistence();
  authorization.store.updateHeartbeat({
    bridgeId: typeof body.bridgeId === "string" ? body.bridgeId.slice(0, 120) : "customer-feed",
    server: typeof body.server === "string" ? body.server.slice(0, 120) : undefined,
    connected: typeof body.connected === "boolean" ? body.connected : undefined,
    symbols: Array.isArray(body.symbols)
      ? body.symbols.filter((value): value is string => typeof value === "string")
      : undefined,
    activeSymbols: Array.isArray(body.activeSymbols)
      ? body.activeSymbols.filter((value): value is string => typeof value === "string")
      : undefined,
    discovered: typeof body.discovered === "number" ? body.discovered : undefined,
    active: typeof body.active === "number" ? body.active : undefined,
    subscriptionVersion:
      typeof body.subscriptionVersion === "number" ? body.subscriptionVersion : undefined,
  });
  await authorization.store.flushPersistence();
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, status: authorization.store.getStatus() });
});

router.post("/mt5/customer/bridge/quotes", async (req, res) => {
  const authorization = await authorizeCustomerMt5Bridge(req, res);
  if (!authorization) return;
  await authorization.store.hydrateFromPersistence();
  const rawQuotes = Array.isArray(req.body?.quotes) ? req.body.quotes : [];
  const quotes = rawQuotes.flatMap((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const quote = value as Record<string, unknown>;
    if (typeof quote.symbol !== "string" || !quote.symbol.trim()) return [];
    return [{
      symbol: quote.symbol.trim(),
      bid: Number(quote.bid),
      ask: Number(quote.ask),
      last: Number(quote.last),
      chartMode:
        quote.chartMode === "LAST" || quote.chartMode === "MID" ? quote.chartMode : "BID",
      time: Number(quote.time),
      timeMsc: Number(quote.timeMsc),
      quoteOnly: quote.quoteOnly === true,
    }];
  });
  const accepted = authorization.store.updateQuotes(quotes);
  await authorization.store.flushPersistence();
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, accepted });
});

router.post("/mt5/customer/bridge/candles", async (req, res) => {
  const authorization = await authorizeCustomerMt5Bridge(req, res);
  if (!authorization) return;
  await authorization.store.hydrateFromPersistence();
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const symbol = typeof body.symbol === "string" ? body.symbol.trim() : "";
  const timeframe = typeof body.timeframe === "string" ? body.timeframe.toUpperCase() : "M15";
  const syncMode =
    body.syncMode === "FULL" || body.syncMode === "PARTIAL" || body.syncMode === "INCREMENTAL"
      ? body.syncMode
      : "PARTIAL";
  const rawRange =
    body.coverageRange && typeof body.coverageRange === "object"
      ? body.coverageRange as Record<string, unknown>
      : undefined;
  const coverageRange =
    rawRange &&
    Number.isSafeInteger(Number(rawRange.startUtc)) &&
    Number.isSafeInteger(Number(rawRange.endUtc))
      ? { startUtc: Number(rawRange.startUtc), endUtc: Number(rawRange.endUtc) }
      : undefined;
  const rawCandles = Array.isArray(body.candles) ? body.candles : [];
  const accepted = authorization.store.updateCandles(
    symbol,
    timeframe,
    rawCandles,
    syncMode,
    coverageRange,
  );
  await authorization.store.flushPersistence();
  res.setHeader("Cache-Control", "no-store");
  res.json({
    ok: true,
    accepted,
    isBackfilled: authorization.store.isBackfillCompleted(),
  });
});

router.post("/mt5/customer/bridge/specs", async (req, res) => {
  const authorization = await authorizeCustomerMt5Bridge(req, res);
  if (!authorization) return;
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const accepted = await authorization.store.updateSpecifications(body.specs);
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, accepted });
});

router.post("/mt5/customer/bridge/history/coverage", async (req, res) => {
  const authorization = await authorizeCustomerMt5Bridge(req, res);
  if (!authorization) return;
  res.setHeader("Cache-Control", "no-store");
  res.status(409).json({ error: "CUSTOMER_FEED_HISTORY_NOT_VERIFIED" });
});

router.get("/user/mt5-feed", requireUser, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const feed = await activeCustomerMt5Feed(requestUser(req).id);
  if (!feed) {
    const [existing] = await db
      .select({ revokedAt: tradifyMt5CustomerFeeds.revokedAt })
      .from(tradifyMt5CustomerFeeds)
      .where(eq(tradifyMt5CustomerFeeds.userId, requestUser(req).id))
      .limit(1);
    res.json({ state: existing?.revokedAt ? "revoked" : "journal_link_required" });
    return;
  }
  const store = customerMt5Store(feed.feedId);
  await store.hydrateFromPersistence();
  const bridgeStatus = store.getStatus();
  res.json({
    state: "active",
    feedId: feed.feedId,
    consentVersion: feed.consentVersion,
    consentedAt: feed.consentedAt,
    bridge: {
      connected: bridgeStatus.connected,
      activeCount: bridgeStatus.activeCount,
      lastHeartbeat: bridgeStatus.lastHeartbeat,
    },
  });
});

router.post("/user/mt5-feed/consent", requireUser, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (
    !req.header("authorization")?.startsWith("Bearer ") &&
    !requestIsSameOrigin(req)
  ) {
    res.status(403).json({ error: "CSRF_ORIGIN_FAILED" });
    return;
  }
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    Object.keys(req.body).some((key) => !["consent", "consentVersion"].includes(key)) ||
    req.body.consent !== true ||
    req.body.consentVersion !== CUSTOMER_MT5_FEED_CONSENT_VERSION
  ) {
    res.status(400).json({ error: "CUSTOMER_FEED_CONSENT_REQUIRED" });
    return;
  }
  const userId = requestUser(req).id;
  const [link] = await db
    .select({ linkId: tradifyProductLinks.linkId })
    .from(tradifyProductLinks)
    .where(and(eq(tradifyProductLinks.userId, userId), eq(tradifyProductLinks.state, "active")))
    .limit(1);
  if (!link) {
    res.status(409).json({ error: "ACTIVE_JOURNAL_LINK_REQUIRED" });
    return;
  }
  const token = randomBytes(32).toString("base64url");
  const feedId = randomUUID();
  const now = new Date().toISOString();
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  await db
    .insert(tradifyMt5CustomerFeeds)
    .values({
      userId,
      feedId,
      linkId: link.linkId,
      tokenHash,
      consentVersion: CUSTOMER_MT5_FEED_CONSENT_VERSION,
      consentedAt: now,
      revokedAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tradifyMt5CustomerFeeds.userId,
      set: {
        feedId,
        linkId: link.linkId,
        tokenHash,
        consentVersion: CUSTOMER_MT5_FEED_CONSENT_VERSION,
        consentedAt: now,
        revokedAt: null,
        updatedAt: now,
      },
    });
  res.status(201).json({
    state: "active",
    feedId,
    bridgeToken: token,
    tokenDisplay: "This token is shown once. Copy it into the TradifyBridge FeedToken input in MT5.",
    consentVersion: CUSTOMER_MT5_FEED_CONSENT_VERSION,
    consentedAt: now,
  });
});

router.delete("/user/mt5-feed", requireUser, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (
    !req.header("authorization")?.startsWith("Bearer ") &&
    !requestIsSameOrigin(req)
  ) {
    res.status(403).json({ error: "CSRF_ORIGIN_FAILED" });
    return;
  }
  const now = new Date().toISOString();
  await db
    .update(tradifyMt5CustomerFeeds)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(tradifyMt5CustomerFeeds.userId, requestUser(req).id),
        isNull(tradifyMt5CustomerFeeds.revokedAt),
      ),
    );
  res.json({ state: "revoked" });
});

router.get("/user/mt5-feed/quote", requireUser, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const feed = await activeCustomerMt5Feed(requestUser(req).id);
  if (!feed) {
    res.status(403).json({ error: "CUSTOMER_FEED_NOT_AUTHORIZED" });
    return;
  }
  const symbol = typeof req.query.symbol === "string" ? canonicalSymbol(req.query.symbol) : null;
  if (!symbol || !marketCatalog.get(symbol)) {
    res.status(400).json({ error: "INVALID_SYMBOL" });
    return;
  }
  const store = customerMt5Store(feed.feedId);
  await store.hydrateFromPersistence();
  const brokerSymbol = store.getMappings()[symbol] ?? symbol;
  const quote = await store.getQuoteForBrokerSymbolPersisted(brokerSymbol);
  res.json({
    symbol,
    quote: quote
      ? {
          bid: quote.bid,
          ask: quote.ask,
          last: quote.last,
          price: quote.strategyPrice,
          time: quote.time,
          receivedAt: quote.receivedAt,
          status: "LIVE",
        }
      : null,
  });
});

router.get("/user/mt5-feed/candles", requireUser, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const feed = await activeCustomerMt5Feed(requestUser(req).id);
  if (!feed) {
    res.status(403).json({ error: "CUSTOMER_FEED_NOT_AUTHORIZED" });
    return;
  }
  const symbol = typeof req.query.symbol === "string" ? canonicalSymbol(req.query.symbol) : null;
  const timeframe = typeof req.query.timeframe === "string" ? req.query.timeframe.toUpperCase() : "M15";
  if (
    !symbol ||
    !marketCatalog.get(symbol) ||
    !chartTimeframes.includes(timeframe as (typeof chartTimeframes)[number])
  ) {
    res.status(400).json({ error: "INVALID_MARKET_SERIES" });
    return;
  }
  const store = customerMt5Store(feed.feedId);
  await store.hydrateFromPersistence();
  const brokerSymbol = store.getMappings()[symbol] ?? symbol;
  const candles =
    (await store.getCandlesForBrokerSymbolPersisted(brokerSymbol, timeframe)) ?? [];
  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
  res.json({ symbol, timeframe, candles: candles.slice(-limit), count: Math.min(candles.length, limit) });
});

router.get("/user/mt5-feed/evaluate", requireUser, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const feed = await activeCustomerMt5Feed(requestUser(req).id);
  if (!feed) {
    res.status(403).json({ error: "CUSTOMER_FEED_NOT_AUTHORIZED" });
    return;
  }
  const symbol = typeof req.query.symbol === "string" ? canonicalSymbol(req.query.symbol) : null;
  if (!symbol || !marketCatalog.get(symbol)) {
    res.status(400).json({ error: "INVALID_SYMBOL" });
    return;
  }
  const store = customerMt5Store(feed.feedId);
  await store.hydrateFromPersistence();
  const brokerSymbol = store.getMappings()[symbol] ?? symbol;
  const [mt5Quote, candles] = await Promise.all([
    store.getQuoteForBrokerSymbolPersisted(brokerSymbol),
    store.getCandlesForBrokerSymbolPersisted(brokerSymbol, "M15"),
  ]);
  const customerCandlesForEvaluation = (candles ?? []).map((candle) => ({
    ...candle,
    volume: candle.volume ?? 0,
  }));
  const quote: Quote | undefined = mt5Quote
    ? {
        symbol,
        brokerSymbol: mt5Quote.symbol,
        provider: "CUSTOMER_MT5",
        bid: mt5Quote.bid,
        ask: mt5Quote.ask,
        last: mt5Quote.last,
        price: mt5Quote.strategyPrice,
        strategyPrice: mt5Quote.strategyPrice,
        displayPrice: mt5Quote.displayPrice,
        change: mt5Quote.change,
        changePercent: mt5Quote.changePercent,
        time: mt5Quote.time,
        receivedAt: mt5Quote.receivedAt,
        status: "LIVE",
        dataState: "LIVE",
        changeBasis: "STREAM",
      }
    : undefined;
  const evaluation = await evaluateSymbol(
    symbol,
    typeof req.query.strategy === "string" ? req.query.strategy : undefined,
    quote ? { [symbol]: quote } : {},
    "CUSTOMER_FEED_PREVIEW",
    {
      customerMarketData: {
        quote,
        candles: customerCandlesForEvaluation,
        providerSymbol: brokerSymbol,
      },
      persist: false,
    },
  );
  if (!evaluation) {
    res.status(404).json({ error: "SIGNAL_NOT_FOUND" });
    return;
  }
  res.json({
    signal: customerSignal(toSignalCard(evaluation) as unknown as Record<string, unknown>),
    quote: evaluation.quote ? customerQuote(evaluation.quote) : null,
    candles: customerCandles({
      symbol: evaluation.symbol,
      provider: evaluation.provider,
      providerSymbol: evaluation.providerSymbol,
      timeframe: "M15",
      timezone: "UTC",
      candles: evaluation.candles,
      dataState: evaluation.dataState,
      displayOnly: true,
      validation: evaluation.validation,
    }),
    scope: "CUSTOMER_FEED_ONLY",
    signalGenerated: false,
    marketDataTrusted: false,
    reason: "Customer-feed previews are isolated and are not published as shared Tradify signals.",
  });
});

router.get("/user/export", requireUser, (req, res) => {
  const user = requestUser(req);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", 'attachment; filename="tradify-signals-data-export.json"');
  res.json({
    version: "1",
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
    profile: { ...user.profile },
    watchlist: [...user.watchlist].sort(),
    alertSymbols: [...user.alertSymbols].sort(),
    alerts: userAlerts(user),
    notifications: userNotifications(user),
    trades: userTrades(user),
    membership: {
      tier: user.profile.membership,
      source: user.membershipSource ?? null,
      status: user.subscriptionStatus ?? null,
      expiresAt: user.billingExpiresAt ?? null,
      willRenew: user.billingWillRenew ?? null,
    },
  });
});

router.get("/user/profile", requireUser, (req, res) =>
  res.json(customerPublicUser(requestUser(req))),
);
router.patch("/user/profile", requireUser, async (req, res) => {
  const user = requestUser(req);
  const patch = req.body ?? {};
  if (typeof patch.name === "string" && patch.name.trim()) user.profile.name = patch.name.trim();
  if (typeof patch.accountSize === "number" && patch.accountSize > 0)
    user.profile.accountSize = patch.accountSize;
  if (typeof patch.riskPercent === "number" && patch.riskPercent > 0)
    user.profile.riskPercent = patch.riskPercent;
  if (typeof patch.maxDailyLoss === "number" && patch.maxDailyLoss > 0)
    user.profile.maxDailyLoss = patch.maxDailyLoss;
  if (typeof patch.maxTrades === "number" && patch.maxTrades > 0)
    user.profile.maxTrades = patch.maxTrades;
  if (typeof patch.aggressive === "boolean") user.profile.aggressive = patch.aggressive;
  await persistUser(user);
  res.json({ ok: true, user: customerPublicUser(user) });
});

async function syncBillingMembership(req: Request, res: Response): Promise<void> {
  const user = requestUser(req);
  try {
    const recovery = await reconcilePendingRevenueCatTransfers(user.id);
    const result = await withRevenueCatTransferLock([user.id], async (database) => {
      let authoritativeUser = (await getRevenueCatTransferUsers([user.id], database)).get(user.id);
      if (!authoritativeUser) return { kind: "missing" as const };
      if (authoritativeUser.status === "suspended" || authoritativeUser.status === "banned") {
        return { kind: "suspended" as const };
      }
      if (authoritativeUser.status === "deleted") return { kind: "deleted" as const };
      if (hasActiveAdminMembershipOverride(authoritativeUser)) {
        return { kind: "state" as const, user: authoritativeUser };
      }
      if (recovery === "processed" || recovery === "duplicate") {
        return { kind: "state" as const, user: authoritativeUser };
      }

      if (authoritativeUser.membershipSource === "ADMIN_OVERRIDE") {
        const expiredOverrideUser = {
          ...authoritativeUser,
          profile: { ...authoritativeUser.profile, membership: "Free" as const },
          membershipSource: "UNKNOWN" as const,
          subscriptionStatus: "EXPIRED" as const,
          overrideEndsAt: null,
          billingExpiresAt: null,
          billingWillRenew: false,
          entitlements: billingEntitlements(authoritativeUser, "Free"),
        };
        await persistUser(expiredOverrideUser, authoritativeUser.version, undefined, database);
        authoritativeUser =
          (await getRevenueCatTransferUsers([user.id], database)).get(user.id) ??
          expiredOverrideUser;
      }

      const billing = await revenueCatBillingProvider.get(user.id);
      if (billing.status === "UNAVAILABLE") return { kind: "unavailable" as const };
      const updatedUser = {
        ...authoritativeUser,
        profile: { ...authoritativeUser.profile, membership: billing.membership },
        membershipSource: "REVENUECAT" as const,
        subscriptionStatus: billing.status === "INACTIVE" ? ("EXPIRED" as const) : billing.status,
        billingExpiresAt: billing.expiresAt,
        billingWillRenew: billing.willRenew,
        entitlements: billingEntitlements(authoritativeUser, billing.membership),
      };
      await persistUser(updatedUser, authoritativeUser.version, undefined, database);
      return {
        kind: "state" as const,
        user: (await getRevenueCatTransferUsers([user.id], database)).get(user.id) ?? updatedUser,
      };
    });

    if (result.kind === "missing") {
      res.status(404).json({ error: "USER_NOT_FOUND" });
      return;
    }
    if (result.kind === "suspended") {
      res.status(403).json({ error: "USER_SUSPENDED" });
      return;
    }
    if (result.kind === "deleted") {
      res.status(403).json({ error: "ACCOUNT_DELETED" });
      return;
    }
    if (result.kind === "unavailable") {
      res.status(503).json({ error: "BILLING_VERIFICATION_UNAVAILABLE" });
      return;
    }
    const authoritativeUser = result.user;
    const hasOverride = hasActiveAdminMembershipOverride(authoritativeUser);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      membership: authoritativeUser.profile.membership,
      source: authoritativeUser.membershipSource ?? "UNKNOWN",
      entitlements: [...authoritativeUser.entitlements],
      billingStatus: authoritativeUser.subscriptionStatus ?? "INACTIVE",
      expiresAt: hasOverride
        ? (authoritativeUser.overrideEndsAt ?? authoritativeUser.trialEndsAt ?? null)
        : (authoritativeUser.billingExpiresAt ?? null),
      willRenew: hasOverride ? false : (authoritativeUser.billingWillRenew ?? false),
      provider: "REVENUECAT",
      accessPolicy: customerAccessPolicySnapshot(),
    });
  } catch (error) {
    req.log.error({ error }, "RevenueCat membership verification failed");
    res.status(503).json({ error: "BILLING_VERIFICATION_UNAVAILABLE" });
  }
}

router.get("/membership/status", requireUser, (req, res) => {
  const user = requestUser(req);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    membership: user.profile.membership,
    source: user.membershipSource ?? "UNKNOWN",
    entitlements: [...user.entitlements],
    billingStatus: user.subscriptionStatus ?? "INACTIVE",
    expiresAt: hasActiveAdminMembershipOverride(user)
      ? (user.overrideEndsAt ?? user.trialEndsAt ?? null)
      : (user.billingExpiresAt ?? null),
    willRenew: hasActiveAdminMembershipOverride(user) ? false : (user.billingWillRenew ?? false),
    provider: "REVENUECAT",
    accessPolicy: customerAccessPolicySnapshot(),
  });
});
router.post("/membership/sync", requireUser, syncBillingMembership);
router.post("/membership/upgrade", requireUser, (_req, res) => {
  res.status(409).json({ error: "BILLING_CHECKOUT_REQUIRED" });
});

router.get("/user/alerts", requireUser, (req, res) => {
  const user = requestUser(req);
  res.setHeader("Cache-Control", "no-store");
  res.json(hasFeatureAccess(user.profile.membership, "priceAlerts") ? userAlerts(user) : []);
});
router.post("/user/alerts", requireUser, async (req, res) => {
  const membership = requestUser(req).profile.membership;
  if (!hasFeatureAccess(membership, "priceAlerts")) {
    sendFeatureTierRequired(res, "priceAlerts");
    return;
  }
  const body = req.body ?? {};
  const symbol = canonicalSymbol(String(body.symbol ?? ""));
  const target = Number(body.target);
  const condition = body.condition;
  if (
    !symbol ||
    !Number.isFinite(target) ||
    target <= 0 ||
    !["ABOVE", "BELOW", "EXACT"].includes(condition) ||
    typeof body.label !== "string" ||
    !body.label.trim()
  ) {
    res.status(400).json({ error: "INVALID_ALERT" });
    return;
  }
  try {
    const { result: alert } = await updateCustomerState(requestUser(req).id, (user) => {
      const requestedId = requestedStateId(body.id);
      const existing = requestedId
        ? user.alerts.find((entry) => entry.id === requestedId)
        : undefined;
      if (existing) return existing;
      const alert: PriceAlert = {
        id: requestedId ?? cryptoId(),
        symbol,
        target,
        condition,
        label: body.label.trim(),
        active: body.active !== false,
        createdAt: new Date().toISOString(),
      };
      user.alerts.unshift(alert);
      return alert;
    });
    res.status(201).json({ ok: true, alert });
  } catch (error) {
    customerStateMutationError(res, error);
  }
});
router.delete("/user/alerts/:id", requireUser, async (req, res) => {
  try {
    const { user } = await updateCustomerState(requestUser(req).id, (candidate) => {
      candidate.alerts = candidate.alerts.filter((alert) => alert.id !== req.params.id);
    });
    res.json({ ok: true, alerts: userAlerts(user) });
  } catch (error) {
    customerStateMutationError(res, error);
  }
});

const defaultNotificationPreferences = {
  newSignals: false,
  entries: false,
  takeProfits: false,
  stopLosses: false,
  breakevenAndChanges: false,
  watchlistPriceAlerts: false,
  announcements: false,
};

function signalEventNotification(row: {
  id: string;
  signalId: string;
  eventType: string;
  occurredAt: Date;
  price: number | null;
  symbol: string;
  strategyVersion: string;
  details: Record<string, unknown>;
  isRead: boolean;
}) {
  const labels: Record<
    string,
    {
      type:
        | "NEW_SETUP"
        | "STATUS_CHANGE"
        | "RETEST_READY"
        | "TRIGGERED"
        | "TP_HIT"
        | "SL_HIT"
        | "INVALIDATED"
        | "MARKET_WARNING";
      title: string;
    }
  > = {
    NEW_SIGNAL: { type: "NEW_SETUP", title: "New validated signal" },
    ENTRY_TRIGGERED: { type: "TRIGGERED", title: "Signal entry triggered" },
    STOP_LOSS_HIT: { type: "SL_HIT", title: "Stop-loss hit" },
    BREAKEVEN_ACTIVATED: { type: "STATUS_CHANGE", title: "Stop moved to breakeven" },
    STOP_MODIFIED: { type: "STATUS_CHANGE", title: "Signal stop modified" },
    SIGNAL_CANCELLED: { type: "INVALIDATED", title: "Signal cancelled" },
    SIGNAL_INVALIDATED: { type: "INVALIDATED", title: "Signal invalidated" },
    SIGNAL_EXPIRED: { type: "STATUS_CHANGE", title: "Signal expired" },
    SIGNAL_COMPLETED: { type: "STATUS_CHANGE", title: "Signal completed" },
  };
  const targetIndex = row.details.targetIndex;
  const label = labels[row.eventType] ??
    (/^TP\d+_REACHED$/.test(row.eventType)
      ? { type: "TP_HIT" as const, title: typeof targetIndex === "number" ? `TP${targetIndex} reached` : "Take-profit reached" }
      : { type: "STATUS_CHANGE" as const, title: "Signal update" });
  const price = typeof row.price === "number" ? ` at ${row.price}` : "";
  const direction = typeof row.details.direction === "string" ? ` ${row.details.direction}` : "";
  return {
    id: row.id,
    timestamp: row.occurredAt.getTime(),
    timeLabel: row.occurredAt.toISOString(),
    symbol: row.symbol,
    type: label.type,
    title: label.title,
    message: `${row.symbol}${direction}${price} · ${row.strategyVersion}`,
    isRead: row.isRead,
    signalId: row.signalId,
  };
}

router.get("/user/notification-preferences", requireUser, async (req, res) => {
  const user = requestUser(req);
  const [stored] = await db
    .select({ categories: tradifyNotificationPreferences.categories })
    .from(tradifyNotificationPreferences)
    .where(eq(tradifyNotificationPreferences.userId, user.id));
  res.setHeader("Cache-Control", "no-store");
  res.json({ ...defaultNotificationPreferences, ...(stored?.categories ?? {}), watchlistPriceAlerts: false });
});

router.patch("/user/notification-preferences", requireUser, async (req, res) => {
  const user = requestUser(req);
  const body = req.body as Record<string, unknown>;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: "INVALID_NOTIFICATION_PREFERENCES" });
    return;
  }
  if (body.watchlistPriceAlerts === true) {
    res.status(409).json({ error: "WATCHLIST_ALERTS_NOT_VERIFIED" });
    return;
  }
  const allowedKeys = Object.keys(defaultNotificationPreferences).filter(
    (key) => key !== "watchlistPriceAlerts",
  );
  if (
    Object.keys(body).some((key) => !allowedKeys.includes(key)) ||
    Object.values(body).some((value) => typeof value !== "boolean")
  ) {
    res.status(400).json({ error: "INVALID_NOTIFICATION_PREFERENCES" });
    return;
  }
  const [current] = await db
    .select({ categories: tradifyNotificationPreferences.categories })
    .from(tradifyNotificationPreferences)
    .where(eq(tradifyNotificationPreferences.userId, user.id));
  const categories = {
    ...defaultNotificationPreferences,
    ...(current?.categories ?? {}),
    ...body,
    watchlistPriceAlerts: false,
  };
  await db
    .insert(tradifyNotificationPreferences)
    .values({ userId: user.id, categories, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: tradifyNotificationPreferences.userId,
      set: { categories, updatedAt: new Date() },
    });
  res.setHeader("Cache-Control", "no-store");
  res.json(categories);
});

router.get("/user/web-push/public-key", requireUser, (req, res) => {
  const user = requestUser(req);
  if (!hasFeatureAccess(user.profile.membership, "signalContext")) {
    sendFeatureTierRequired(res, "signalContext");
    return;
  }
  const publicKey = getWebPushPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: "WEB_PUSH_NOT_CONFIGURED" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ publicKey });
});

router.put("/user/web-push/subscriptions", requireUser, async (req, res) => {
  const user = requestUser(req);
  if (!hasFeatureAccess(user.profile.membership, "signalContext")) {
    sendFeatureTierRequired(res, "signalContext");
    return;
  }
  const body = req.body as Record<string, unknown>;
  const keys = body?.keys as Record<string, unknown> | undefined;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys?.auth === "string" ? keys.auth : "";
  const validKey = /^[A-Za-z0-9_-]{16,512}$/;
  let parsedEndpoint: URL | null = null;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    parsedEndpoint = null;
  }
  if (
    !parsedEndpoint ||
    parsedEndpoint.protocol !== "https:" ||
    parsedEndpoint.username.length > 0 ||
    parsedEndpoint.password.length > 0 ||
    (parsedEndpoint.port !== "" && parsedEndpoint.port !== "443") ||
    parsedEndpoint.hash.length > 0 ||
    !(
      parsedEndpoint.hostname === "fcm.googleapis.com" ||
      parsedEndpoint.hostname === "updates.push.services.mozilla.com" ||
      parsedEndpoint.hostname === "push.apple.com" ||
      parsedEndpoint.hostname.endsWith(".push.apple.com")
    ) ||
    endpoint.length > 2048 ||
    !validKey.test(p256dh) ||
    !validKey.test(auth)
  ) {
    res.status(400).json({ error: "INVALID_PUSH_SUBSCRIPTION" });
    return;
  }
  const expirationTime =
    typeof body.expirationTime === "number" && Number.isFinite(body.expirationTime)
      ? new Date(body.expirationTime)
      : null;
  if (expirationTime && Number.isNaN(expirationTime.getTime())) {
    res.status(400).json({ error: "INVALID_PUSH_SUBSCRIPTION" });
    return;
  }
  const endpointHash = createHash("sha256").update(endpoint).digest("hex");
  const [saved] = await db
    .insert(tradifyWebPushSubscriptions)
    .values({
      id: globalThis.crypto.randomUUID(),
      userId: user.id,
      endpoint,
      endpointHash,
      p256dh,
      auth,
      expirationTime,
      status: "ACTIVE",
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tradifyWebPushSubscriptions.endpointHash,
      set: {
        p256dh,
        auth,
        expirationTime,
        status: "ACTIVE",
        lastSeenAt: new Date(),
      },
      where: eq(tradifyWebPushSubscriptions.userId, user.id),
    })
    .returning({ id: tradifyWebPushSubscriptions.id });
  if (!saved) {
    res.status(409).json({ error: "PUSH_SUBSCRIPTION_OWNED_BY_ANOTHER_ACCOUNT" });
    return;
  }
  res.status(201).json({ ok: true, id: saved.id });
});

router.delete("/user/web-push/subscriptions/current", requireUser, async (req, res) => {
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : "";
  let parsedEndpoint: URL | null = null;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    parsedEndpoint = null;
  }
  if (!parsedEndpoint || parsedEndpoint.protocol !== "https:" || endpoint.length > 2048) {
    res.status(400).json({ error: "INVALID_PUSH_SUBSCRIPTION" });
    return;
  }
  const endpointHash = createHash("sha256").update(endpoint).digest("hex");
  const [removed] = await db
    .update(tradifyWebPushSubscriptions)
    .set({ status: "REVOKED", lastSeenAt: new Date() })
    .where(
      and(
        eq(tradifyWebPushSubscriptions.userId, requestUser(req).id),
        eq(tradifyWebPushSubscriptions.endpointHash, endpointHash),
      ),
    )
    .returning({ id: tradifyWebPushSubscriptions.id });
  void removed;
  res.json({ ok: true });
});

router.put("/user/expo-push/device", requireUser, async (req, res) => {
  const user = requestUser(req);
  if (
    user.status !== "active" ||
    !hasFeatureAccess(user.profile.membership, "signalContext")
  ) {
    sendFeatureTierRequired(res, "signalContext");
    return;
  }
  const pushToken =
    typeof req.body?.pushToken === "string" ? req.body.pushToken.trim() : "";
  const platform = req.body?.platform;
  if (
    pushToken.length > 200 ||
    !/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{1,120}\]$/.test(pushToken) ||
    (platform !== "ios" && platform !== "android")
  ) {
    res.status(400).json({ error: "INVALID_EXPO_PUSH_DEVICE" });
    return;
  }
  const tokenHash = createHash("sha256").update(pushToken).digest("hex");
  const [saved] = await db
    .insert(tradifyExpoPushSubscriptions)
    .values({
      id: globalThis.crypto.randomUUID(),
      userId: user.id,
      pushToken,
      tokenHash,
      platform,
      status: "ACTIVE",
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tradifyExpoPushSubscriptions.tokenHash,
      set: {
        platform,
        status: "ACTIVE",
        lastSeenAt: new Date(),
      },
      where: eq(tradifyExpoPushSubscriptions.userId, user.id),
    })
    .returning({ id: tradifyExpoPushSubscriptions.id });
  if (!saved) {
    res.status(409).json({ error: "EXPO_PUSH_DEVICE_OWNED_BY_ANOTHER_ACCOUNT" });
    return;
  }
  res.status(200).json({ ok: true, id: saved.id });
});

router.delete("/user/expo-push/device", requireUser, async (req, res) => {
  const pushToken =
    typeof req.body?.pushToken === "string" ? req.body.pushToken.trim() : "";
  if (
    pushToken.length > 200 ||
    !/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{1,120}\]$/.test(pushToken)
  ) {
    res.status(400).json({ error: "INVALID_EXPO_PUSH_DEVICE" });
    return;
  }
  const tokenHash = createHash("sha256").update(pushToken).digest("hex");
  const [removed] = await db
    .update(tradifyExpoPushSubscriptions)
    .set({ status: "REVOKED", lastSeenAt: new Date() })
    .where(
      and(
        eq(tradifyExpoPushSubscriptions.userId, requestUser(req).id),
        eq(tradifyExpoPushSubscriptions.tokenHash, tokenHash),
      ),
    )
    .returning({ id: tradifyExpoPushSubscriptions.id });
  void removed;
  res.json({ ok: true });
});

router.get("/user/notifications", requireUser, async (req, res) => {
  const user = requestUser(req);
  res.setHeader("Cache-Control", "no-store");
  if (!hasFeatureAccess(user.profile.membership, "signalContext")) {
    res.json([]);
    return;
  }
  const saved = await db
    .select({
      id: tradifyUserNotifications.id,
      isRead: tradifyUserNotifications.isRead,
      signalId: tradifySignalLifecycleEvents.signalId,
      eventType: tradifySignalLifecycleEvents.eventType,
      occurredAt: tradifySignalLifecycleEvents.occurredAt,
      price: tradifySignalLifecycleEvents.price,
      symbol: tradifySignalLifecycleEvents.symbol,
      strategyVersion: tradifySignalLifecycleEvents.strategyVersion,
      details: tradifySignalLifecycleEvents.details,
    })
    .from(tradifyUserNotifications)
    .innerJoin(
      tradifySignalLifecycleEvents,
      eq(tradifySignalLifecycleEvents.id, tradifyUserNotifications.eventId),
    )
    .where(eq(tradifyUserNotifications.userId, user.id))
    .orderBy(desc(tradifySignalLifecycleEvents.occurredAt))
    .limit(200);
  const normalized = saved.map(signalEventNotification);
  res.json([...normalized, ...userNotifications(user)].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200));
});
router.patch("/user/notifications/:id/read", requireUser, async (req, res) => {
  if (!hasFeatureAccess(requestUser(req).profile.membership, "signalContext")) {
    sendFeatureTierRequired(res, "signalContext");
    return;
  }
  const userId = requestUser(req).id;
  const [saved] = await db
    .update(tradifyUserNotifications)
    .set({ isRead: true })
    .where(
      and(
        eq(tradifyUserNotifications.id, String(req.params.id)),
        eq(tradifyUserNotifications.userId, userId),
      ),
    )
    .returning({
      id: tradifyUserNotifications.id,
      isRead: tradifyUserNotifications.isRead,
    });
  if (saved) {
    res.json({ ok: true, notification: saved });
    return;
  }
  try {
    const { result: notification } = await updateCustomerState(userId, (user) => {
      const entry = user.notifications.find((candidate) => candidate.id === req.params.id);
      if (!entry) throw new CustomerStateNotFoundError();
      entry.isRead = true;
      return userNotifications(user).find((candidate) => candidate.id === entry.id);
    });
    res.json({ ok: true, notification });
  } catch (error) {
    if (error instanceof CustomerStateNotFoundError) {
      res.status(404).json({ error: "NOTIFICATION_NOT_FOUND" });
      return;
    }
    customerStateMutationError(res, error);
  }
});
router.post("/user/notifications/read-all", requireUser, async (req, res) => {
  try {
    await db
      .update(tradifyUserNotifications)
      .set({ isRead: true })
      .where(eq(tradifyUserNotifications.userId, requestUser(req).id));
    await updateCustomerState(requestUser(req).id, (user) => {
      user.notifications.forEach((notification) => {
        notification.isRead = true;
      });
    });
    res.json({ ok: true });
  } catch (error) {
    customerStateMutationError(res, error);
  }
});

router.put("/user/watchlist/:symbol/alert", requireUser, async (req, res) => {
  const symbol = canonicalSymbol(String(req.params.symbol));
  if (!symbol) {
    res.status(400).json({ error: "INVALID_SYMBOL" });
    return;
  }
  if (!hasFeatureAccess(requestUser(req).profile.membership, "priceAlerts")) {
    sendFeatureTierRequired(res, "priceAlerts");
    return;
  }
  try {
    const { result: active } = await updateCustomerState(requestUser(req).id, (user) => {
      if (req.body?.active) user.alertSymbols.add(symbol);
      else user.alertSymbols.delete(symbol);
      return user.alertSymbols.has(symbol);
    });
    res.json({ ok: true, active });
  } catch (error) {
    customerStateMutationError(res, error);
  }
});

router.get("/user/trades", requireUser, (req, res) => {
  const user = requestUser(req);
  res.setHeader("Cache-Control", "no-store");
  res.json(
    userTrades(user).map((trade) => customerTradeForMembership(trade, user.profile.membership)),
  );
});
router.post("/user/trades", requireUser, async (req, res) => {
  const body = req.body ?? {};
  const rawSymbol = String(body.symbol ?? "");
  if (isQuoteOnlyMT5Symbol(rawSymbol)) {
    res.status(403).json({ error: "QUOTE_ONLY_MARKET" });
    return;
  }
  const symbol = canonicalSymbol(rawSymbol);
  if (
    !symbol ||
    !["LONG", "SHORT"].includes(body.direction) ||
    !Number.isFinite(Number(body.entry)) ||
    !Number.isFinite(Number(body.stop)) ||
    !Number.isFinite(Number(body.target))
  ) {
    res.status(400).json({ error: "INVALID_TRADE" });
    return;
  }
  const coreSymbols = coreMarketSymbolSet();
  try {
    const { result: trade, user } = await updateCustomerState(requestUser(req).id, (candidate) => {
      if (!hasMarketAccess(rawSymbol, candidate.profile.membership, coreSymbols, canonicalSymbol)) {
        throw new CustomerMarketTierRequiredError(
          requiredMarketTier(rawSymbol, coreSymbols, canonicalSymbol) ?? "Pro",
        );
      }
      const requestedId = requestedStateId(body.id);
      const existing = requestedId
        ? candidate.trades.find((entry) => entry.id === requestedId)
        : undefined;
      if (existing) return existing;
      const trade: Trade = {
        id: requestedId ?? cryptoId(),
        symbol,
        direction: body.direction,
        entry: Number(body.entry),
        stop: Number(body.stop),
        target: Number(body.target),
        progress: 0,
        r: 0,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      };
      candidate.trades.unshift(trade);
      return trade;
    });
    res
      .status(201)
      .json({ ok: true, trade: customerTradeForMembership(trade, user.profile.membership) });
  } catch (error) {
    if (error instanceof CustomerMarketTierRequiredError) {
      res.status(403).json({ error: "MARKET_TIER_REQUIRED", requiredTier: error.requiredTier });
      return;
    }
    customerStateMutationError(res, error);
  }
});
router.post("/user/trades/:id/actions", requireUser, async (req, res) => {
  const coreSymbols = coreMarketSymbolSet();
  try {
    const { result: trade, user } = await updateCustomerState(requestUser(req).id, (candidate) => {
      const entry = candidate.trades.find((item) => item.id === req.params.id);
      if (!entry) throw new CustomerStateNotFoundError();
      if (req.body?.action === "CLOSE") {
        entry.status = "CLOSED";
        entry.progress = 100;
        entry.closedAt = new Date().toISOString();
        if (entry.r === 0) entry.r = -0.4;
      } else if (req.body?.action === "LOCK_PARTIALS") {
        if (
          !hasMarketAccess(entry.symbol, candidate.profile.membership, coreSymbols, canonicalSymbol)
        ) {
          throw new CustomerMarketTierRequiredError(
            requiredMarketTier(entry.symbol, coreSymbols, canonicalSymbol) ?? "Pro",
          );
        }
        entry.status = "TP1 HIT";
      } else if (
        req.body?.action === "MOVE_SL" &&
        Number.isFinite(Number(req.body?.payload?.newStop))
      ) {
        if (
          !hasMarketAccess(entry.symbol, candidate.profile.membership, coreSymbols, canonicalSymbol)
        ) {
          throw new CustomerMarketTierRequiredError(
            requiredMarketTier(entry.symbol, coreSymbols, canonicalSymbol) ?? "Pro",
          );
        }
        entry.stop = Number(req.body.payload.newStop);
      } else throw new Error("UNKNOWN_TRADE_ACTION");
      return entry;
    });
    res.json({ ok: true, trade: customerTradeForMembership(trade, user.profile.membership) });
  } catch (error) {
    if (error instanceof CustomerMarketTierRequiredError) {
      res.status(403).json({ error: "MARKET_TIER_REQUIRED", requiredTier: error.requiredTier });
      return;
    }
    if (error instanceof Error && error.message === "UNKNOWN_TRADE_ACTION") {
      res.status(400).json({ error: "UNKNOWN_TRADE_ACTION" });
      return;
    }
    if (error instanceof CustomerStateNotFoundError) {
      res.status(404).json({ error: "TRADE_NOT_FOUND" });
      return;
    }
    customerStateMutationError(res, error);
  }
});

router.get("/watchlist", requireUser, (req, res) => res.json([...requestUser(req).watchlist]));

class CustomerMarketTierRequiredError extends Error {
  constructor(readonly requiredTier: CustomerMembershipTier) {
    super("MARKET_TIER_REQUIRED");
  }
}

class CustomerWatchlistLimitError extends Error {
  constructor(readonly membership: CustomerMembershipTier) {
    super("WATCHLIST_LIMIT_REACHED");
  }
}

router.post("/watchlist", requireUser, async (req, res) => {
  const coreSymbols = coreMarketSymbolSet();
  const symbol = customerWatchlistSymbol(
    String(req.body?.symbol ?? ""),
    coreSymbols,
    canonicalSymbol,
  );
  if (!symbol) {
    res.status(400).json({ error: "INVALID_SYMBOL" });
    return;
  }
  try {
    const { user } = await updateCustomerState(requestUser(req).id, (candidate) => {
      const membership = candidate.profile.membership;
      const requiredTier = requiredMarketTier(symbol, coreSymbols, canonicalSymbol);
      if (!requiredTier) throw new Error("INVALID_SYMBOL");
      if (!hasMarketAccess(symbol, membership, coreSymbols, canonicalSymbol)) {
        throw new CustomerMarketTierRequiredError(requiredTier);
      }

      const identity = watchlistIdentity(symbol, coreSymbols, canonicalSymbol);
      const accessibleIdentities = new Set(
        [...candidate.watchlist]
          .filter((savedSymbol) =>
            hasMarketAccess(savedSymbol, membership, coreSymbols, canonicalSymbol),
          )
          .map((savedSymbol) => watchlistIdentity(savedSymbol, coreSymbols, canonicalSymbol)),
      );
      if (
        !accessibleIdentities.has(identity) &&
        accessibleIdentities.size >= watchlistLimit(membership)
      ) {
        throw new CustomerWatchlistLimitError(membership);
      }
      candidate.watchlist.add(symbol);
    });
    res.json({ ok: true, watchlist: [...user.watchlist] });
  } catch (error) {
    if (error instanceof CustomerMarketTierRequiredError) {
      res.status(403).json({ error: "MARKET_TIER_REQUIRED", requiredTier: error.requiredTier });
      return;
    }
    if (error instanceof CustomerWatchlistLimitError) {
      res.status(409).json({
        error: "WATCHLIST_LIMIT_REACHED",
        membership: error.membership,
        limit: watchlistLimit(error.membership),
      });
      return;
    }
    customerStateMutationError(res, error);
  }
});
router.delete("/watchlist/:symbol", requireUser, async (req, res) => {
  const symbol = customerWatchlistSymbol(
    String(req.params.symbol),
    coreMarketSymbolSet(),
    canonicalSymbol,
  );
  if (!symbol) {
    res.status(400).json({ error: "INVALID_SYMBOL" });
    return;
  }
  try {
    const { user } = await updateCustomerState(requestUser(req).id, (candidate) => {
      candidate.watchlist.delete(symbol);
    });
    res.json({ ok: true, watchlist: [...user.watchlist] });
  } catch (error) {
    customerStateMutationError(res, error);
  }
});

function cryptoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function requestedStateId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 128 ? normalized : undefined;
}

export default router;
