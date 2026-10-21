import { env } from "@workspace/config";
import crypto from "node:crypto";
import { ReplitConnectors, type ProxyOptions } from "@replit/connectors-sdk";

export type BillingMembership = "Free" | "Pro" | "VIP";
export type BillingStatus =
  "ACTIVE" | "TRIALING" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | "INACTIVE" | "UNAVAILABLE";

export interface RevenueCatBillingState {
  membership: BillingMembership;
  status: BillingStatus;
  expiresAt: string | null;
  willRenew: boolean;
}

type RevenueCatList = { items?: unknown[] };
export interface RevenueCatBillingPayload {
  entitlements: RevenueCatList;
  subscriptions: RevenueCatList;
}

export interface RevenueCatWebhookEvent {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  transferred_from?: unknown;
  transferred_to?: unknown;
  entitlement_ids?: unknown;
  event_timestamp_ms?: unknown;
  purchased_at_ms?: unknown;
  expiration_at_ms?: unknown;
  period_type?: unknown;
}

export interface RevenueCatWebhookPayload {
  event?: RevenueCatWebhookEvent;
}

export interface RevenueCatWebhookState extends RevenueCatBillingState {
  eventId: string;
  eventTimestampMs: number | null;
}

export interface RevenueCatTransferState {
  eventId: string;
  eventTimestampMs: number | null;
  previousAppUserIds: string[];
  destinationAppUserIds: string[];
}

export class RevenueCatProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevenueCatProviderUnavailableError";
  }
}

export interface RevenueCatProxy {
  proxy(service: string, path: string, init?: ProxyOptions): Promise<Response>;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function entitlementKey(item: Record<string, unknown>): string {
  return String(
    item.lookup_key ?? item.entitlement_identifier ?? item.identifier ?? "",
  ).toLowerCase();
}

function recordItems(items: unknown[] | undefined): Array<Record<string, unknown>> {
  return Array.isArray(items)
    ? items.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && !Array.isArray(item),
      )
    : [];
}

function isPastDue(status: string): boolean {
  return status.includes("past_due") || status.includes("billing");
}

function isExpired(status: string): boolean {
  return status.includes("expired") || status.includes("terminated");
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

/**
 * RevenueCat sends the configured webhook authorization value in the
 * Authorization header. Accepting the configured value with or without the
 * conventional Bearer prefix keeps the server compatible with both forms
 * shown by RevenueCat while never falling back to a development secret.
 */
export function isRevenueCatWebhookAuthorized(
  authorization: string | undefined,
  configuredSecret = env.revenueCatWebhookSecret,
): boolean {
  const secret = configuredSecret?.trim();
  if (!secret || !authorization) return false;
  const expected = secret.toLowerCase().startsWith("bearer ") ? secret : `Bearer ${secret}`;
  return safeEqual(authorization.trim(), expected) || safeEqual(authorization.trim(), secret);
}

function finiteMilliseconds(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isoFromMilliseconds(value: unknown): string | null {
  const milliseconds = finiteMilliseconds(value);
  if (milliseconds === null) return null;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function eventEntitlements(event: RevenueCatWebhookEvent): string[] {
  return Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : [];
}

function membershipFromEntitlements(
  entitlements: string[],
  fallback: BillingMembership,
): BillingMembership {
  if (entitlements.includes("vip")) return "VIP";
  if (entitlements.includes("pro")) return "Pro";
  return fallback;
}

function eventTimestamp(event: RevenueCatWebhookEvent): number | null {
  return finiteMilliseconds(event.event_timestamp_ms) ?? finiteMilliseconds(event.purchased_at_ms);
}

function transferAppUserIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (ids.length !== value.length || ids.length === 0) return null;
  return new Set(ids).size === ids.length ? ids : null;
}

/**
 * Transfer events do not carry enough trustworthy entitlement information to
 * apply directly. Their user lists are validated here; the route must still
 * resolve every destination to a local account and fetch its billing state
 * from RevenueCat before granting access.
 */
export function mapRevenueCatTransferEvent(
  event: RevenueCatWebhookEvent,
): RevenueCatTransferState | null {
  const eventId = typeof event.id === "string" ? event.id.trim() : "";
  const type = typeof event.type === "string" ? event.type.trim().toUpperCase() : "";
  if (!eventId || type !== "TRANSFER") return null;

  const previousAppUserIds = transferAppUserIds(event.transferred_from);
  const destinationAppUserIds = transferAppUserIds(event.transferred_to);
  if (!previousAppUserIds || !destinationAppUserIds) return null;
  if (previousAppUserIds.some((id) => destinationAppUserIds.includes(id))) return null;

  const appUserId = stringValue(event.app_user_id)?.trim();
  if (!appUserId || !destinationAppUserIds.includes(appUserId)) return null;

  return {
    eventId,
    eventTimestampMs: eventTimestamp(event),
    previousAppUserIds,
    destinationAppUserIds,
  };
}

/**
 * Convert a signed RevenueCat event into a state that is safe to apply to a
 * server user. Events without a supported lifecycle meaning are intentionally
 * ignored rather than guessing at access.
 */
export function mapRevenueCatWebhookEvent(
  event: RevenueCatWebhookEvent,
  currentMembership: BillingMembership = "Free",
): RevenueCatWebhookState | null {
  const eventId = typeof event.id === "string" ? event.id.trim() : "";
  const type = typeof event.type === "string" ? event.type.trim().toUpperCase() : "";
  if (!eventId) return null;

  const entitlements = eventEntitlements(event);
  const expiresAt = isoFromMilliseconds(event.expiration_at_ms);
  let membership: BillingMembership;
  let status: BillingStatus;
  let willRenew: boolean;

  switch (type) {
    case "INITIAL_PURCHASE":
    case "NON_RENEWING_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
      membership = membershipFromEntitlements(entitlements, currentMembership);
      status = String(event.period_type ?? "").toUpperCase() === "TRIAL" ? "TRIALING" : "ACTIVE";
      willRenew = type !== "NON_RENEWING_PURCHASE";
      break;
    case "CANCELLATION":
      membership = membershipFromEntitlements(entitlements, currentMembership);
      status = "CANCELLED";
      willRenew = false;
      break;
    case "BILLING_ISSUE":
    case "SUBSCRIPTION_PAUSED":
      membership = "Free";
      status = "PAST_DUE";
      willRenew = false;
      break;
    case "EXPIRATION":
      membership = "Free";
      status = "EXPIRED";
      willRenew = false;
      break;
    default:
      return null;
  }

  return {
    eventId,
    eventTimestampMs: eventTimestamp(event),
    membership,
    status,
    expiresAt,
    willRenew,
  };
}

function subscriptionStatus(
  rawStatus: string,
  hasSubscriptions: boolean,
  willRenew: boolean,
): BillingStatus {
  if (isPastDue(rawStatus)) return "PAST_DUE";
  if (isExpired(rawStatus)) return "EXPIRED";
  if (!hasSubscriptions) return "INACTIVE";
  if (["active", "trialing", "in_grace_period"].some((value) => rawStatus.includes(value))) {
    return willRenew ? "ACTIVE" : "CANCELLED";
  }
  if (rawStatus.includes("cancel")) return "CANCELLED";
  return "INACTIVE";
}

export function mapRevenueCatBillingState({
  entitlements,
  subscriptions,
}: RevenueCatBillingPayload): RevenueCatBillingState {
  const active = recordItems(entitlements.items);
  const subscriptionItems = recordItems(subscriptions.items);
  const accessSubscription = subscriptionItems.find((item) => item.gives_access === true);
  const subscriptionForMetadata = accessSubscription ?? subscriptionItems[0];
  const renewal = String(subscriptionForMetadata?.auto_renewal_status ?? "").toLowerCase();
  const rawStatus = String(subscriptionForMetadata?.status ?? "").toLowerCase();
  const willRenew = ["will_renew", "active"].includes(renewal);
  const status = subscriptionStatus(rawStatus, subscriptionItems.length > 0, willRenew);
  const knownEntitlement = active.some((item) => ["pro", "vip"].includes(entitlementKey(item)));
  const hasSafePaidAccess =
    accessSubscription !== undefined &&
    knownEntitlement &&
    !isPastDue(rawStatus) &&
    !isExpired(rawStatus) &&
    status !== "INACTIVE";
  const membership: BillingMembership =
    hasSafePaidAccess && active.some((item) => entitlementKey(item) === "vip")
      ? "VIP"
      : hasSafePaidAccess && active.some((item) => entitlementKey(item) === "pro")
        ? "Pro"
        : "Free";
  const expiresAt =
    stringValue(subscriptionForMetadata?.current_period_ends_at) ??
    stringValue(subscriptionForMetadata?.expires_at) ??
    null;

  return { membership, status, expiresAt, willRenew };
}

export async function getRevenueCatBillingState(
  appUserId: string,
  client?: RevenueCatProxy,
): Promise<RevenueCatBillingState> {
  const projectId = env.revenueCatProjectId;
  if (!projectId) {
    return { membership: "Free", status: "UNAVAILABLE", expiresAt: null, willRenew: false };
  }

  const proxy = client ?? new ReplitConnectors();
  const customerPath = `/v2/projects/${projectId}/customers/${encodeURIComponent(appUserId)}`;
  let entitlementsResponse: Response;
  let subscriptionsResponse: Response;
  try {
    [entitlementsResponse, subscriptionsResponse] = await Promise.all([
      proxy.proxy("revenuecat", `${customerPath}/active_entitlements`, { method: "GET" }),
      proxy.proxy("revenuecat", `${customerPath}/subscriptions`, { method: "GET" }),
    ]);
  } catch {
    throw new RevenueCatProviderUnavailableError("RevenueCat verification unavailable");
  }

  if (entitlementsResponse.status === 404 || subscriptionsResponse.status === 404) {
    return { membership: "Free", status: "INACTIVE", expiresAt: null, willRenew: false };
  }
  if (!entitlementsResponse.ok || !subscriptionsResponse.ok) {
    throw new RevenueCatProviderUnavailableError(
      `RevenueCat verification failed (${entitlementsResponse.status}/${subscriptionsResponse.status})`,
    );
  }

  const entitlements = (await entitlementsResponse.json()) as RevenueCatList;
  const subscriptions = (await subscriptionsResponse.json()) as RevenueCatList;
  return mapRevenueCatBillingState({ entitlements, subscriptions });
}
