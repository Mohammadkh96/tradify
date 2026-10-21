import { randomUUID } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  tradifyAccessPolicies,
  tradifyAdminAuditEvents,
  tradifyStaffAccess,
  tradifyUsers,
} from "@workspace/db";
import {
  CUSTOMER_FEATURES,
  createDefaultCustomerAccessPolicy,
  customerAccessPolicySnapshot,
  installCustomerAccessPolicy,
  type CustomerAccessPolicyDocument,
  type CustomerFeature,
  type CustomerMembershipTier,
} from "./market-access";

const POLICY_KEY = "global";
export const CUSTOMER_ACCESS_POLICY_REFRESH_INTERVAL_MS = 1_000;
const MAX_MARKET_SYMBOLS = 1_000;
const tiers = new Set<CustomerMembershipTier>(["Free", "Pro", "VIP"]);
const membershipTiers = ["Free", "Pro", "VIP"] as const;

export type EstimatedCustomerMembershipTierCounts = Record<CustomerMembershipTier, number>;

export type EstimatedWatchlistSizeBucket = {
  membershipTier: CustomerMembershipTier;
  savedSymbolCount: number;
  customerCount: number;
};

function estimatedMembershipTier(membership: string): CustomerMembershipTier {
  return membershipTiers.includes(membership as CustomerMembershipTier)
    ? (membership as CustomerMembershipTier)
    : "Free";
}

export async function getEstimatedCustomerMembershipTierCounts(): Promise<EstimatedCustomerMembershipTierCounts> {
  const groupedCounts = await db
    .select({
      membership: tradifyUsers.membership,
      customerCount: count(),
    })
    .from(tradifyUsers)
    .leftJoin(
      tradifyStaffAccess,
      and(eq(tradifyStaffAccess.userId, tradifyUsers.id), eq(tradifyStaffAccess.active, true)),
    )
    .where(
      and(
        eq(tradifyUsers.role, "user"),
        eq(tradifyUsers.status, "active"),
        isNull(tradifyUsers.deletedAt),
        isNull(tradifyStaffAccess.userId),
      ),
    )
    .groupBy(tradifyUsers.membership);

  const result: EstimatedCustomerMembershipTierCounts = { Free: 0, Pro: 0, VIP: 0 };
  for (const row of groupedCounts) {
    const tier = estimatedMembershipTier(row.membership);
    result[tier] += row.customerCount;
  }
  return result;
}

export async function getEstimatedWatchlistSizeDistribution(): Promise<
  EstimatedWatchlistSizeBucket[]
> {
  const savedSymbolCount = sql<number>`(
    SELECT count(DISTINCT item.value #>> '{}')
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(${tradifyUsers.watchlist}) = 'array' THEN ${tradifyUsers.watchlist}
        ELSE '[]'::jsonb
      END
    ) AS item(value)
    WHERE jsonb_typeof(item.value) = 'string'
      AND item.value #>> '{}' <> ''
  )`;
  const groupedSizes = await db
    .select({
      membership: tradifyUsers.membership,
      savedSymbolCount,
      customerCount: count(),
    })
    .from(tradifyUsers)
    .leftJoin(
      tradifyStaffAccess,
      and(eq(tradifyStaffAccess.userId, tradifyUsers.id), eq(tradifyStaffAccess.active, true)),
    )
    .where(
      and(
        eq(tradifyUsers.role, "user"),
        eq(tradifyUsers.status, "active"),
        isNull(tradifyUsers.deletedAt),
        isNull(tradifyStaffAccess.userId),
      ),
    )
    .groupBy(tradifyUsers.membership, savedSymbolCount);

  const distribution = new Map<string, EstimatedWatchlistSizeBucket>();
  for (const row of groupedSizes) {
    const membershipTier = estimatedMembershipTier(row.membership);
    const size = Number(row.savedSymbolCount);
    const key = `${membershipTier}:${size}`;
    const existing = distribution.get(key);
    if (existing) existing.customerCount += row.customerCount;
    else {
      distribution.set(key, {
        membershipTier,
        savedSymbolCount: size,
        customerCount: row.customerCount,
      });
    }
  }

  return [...distribution.values()].sort(
    (left, right) =>
      membershipTiers.indexOf(left.membershipTier) -
        membershipTiers.indexOf(right.membershipTier) ||
      left.savedSymbolCount - right.savedSymbolCount,
  );
}

export class AccessPolicyConflictError extends Error {
  constructor() {
    super("ACCESS_POLICY_CONFLICT");
  }
}

export class AccessPolicyValidationError extends Error {
  constructor(readonly reason: string) {
    super("INVALID_ACCESS_POLICY");
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parsePolicyDocument(
  value: unknown,
  defaultPolicy: CustomerAccessPolicyDocument,
): CustomerAccessPolicyDocument {
  if (!isPlainObject(value)) throw new Error("Persisted access policy must be an object.");
  const featureMinimumTiers = value.featureMinimumTiers;
  const watchlistLimits = value.watchlistLimits;
  const marketTiers = value.marketTiers;
  if (
    !isPlainObject(featureMinimumTiers) ||
    !isPlainObject(watchlistLimits) ||
    !isPlainObject(marketTiers)
  ) {
    throw new Error("Persisted access policy is missing a required section.");
  }

  const parsedFeatures = {} as Record<CustomerFeature, CustomerMembershipTier>;
  for (const feature of CUSTOMER_FEATURES) {
    const tier = featureMinimumTiers[feature];
    if (typeof tier !== "string" || !tiers.has(tier as CustomerMembershipTier)) {
      throw new Error(`Persisted access policy has an invalid tier for ${feature}.`);
    }
    parsedFeatures[feature] = tier as CustomerMembershipTier;
  }

  const parsedLimits = {} as Record<CustomerMembershipTier, number | null>;
  for (const tier of ["Free", "Pro", "VIP"] as const) {
    const limit = watchlistLimits[tier];
    if (
      limit !== null &&
      (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 500)
    ) {
      throw new Error(`Persisted access policy has an invalid ${tier} watchlist limit.`);
    }
    parsedLimits[tier] = limit as number | null;
  }
  if (parsedLimits.VIP !== null) {
    throw new Error("VIP watchlist capacity must remain unlimited.");
  }

  const parsedMarkets: Record<string, CustomerMembershipTier> = { ...defaultPolicy.marketTiers };
  let entryCount = 0;
  for (const [rawSymbol, rawTier] of Object.entries(marketTiers)) {
    const symbol = rawSymbol.trim().toUpperCase();
    if (
      !symbol ||
      symbol !== rawSymbol ||
      typeof rawTier !== "string" ||
      !tiers.has(rawTier as CustomerMembershipTier)
    ) {
      throw new Error("Persisted access policy contains an invalid market rule.");
    }
    parsedMarkets[symbol] = rawTier as CustomerMembershipTier;
    entryCount += 1;
  }
  if (entryCount > MAX_MARKET_SYMBOLS)
    throw new Error("Persisted access policy contains too many market rules.");

  for (const symbol of Object.keys(defaultPolicy.marketTiers)) {
    if (!Object.hasOwn(parsedMarkets, symbol)) {
      parsedMarkets[symbol] = defaultPolicy.marketTiers[symbol];
    }
  }

  return {
    featureMinimumTiers: parsedFeatures,
    marketTiers: parsedMarkets,
    watchlistLimits: parsedLimits,
  };
}

export function validateCustomerAccessPolicy(
  value: unknown,
  defaultPolicy: CustomerAccessPolicyDocument,
  currentPolicy: CustomerAccessPolicyDocument,
): CustomerAccessPolicyDocument {
  if (!isPlainObject(value)) throw new AccessPolicyValidationError("The policy must be an object.");
  if (!isPlainObject(value.marketTiers)) {
    throw new AccessPolicyValidationError("Market tier rules are required.");
  }
  const requiredMarketSymbols = Object.keys(defaultPolicy.marketTiers).sort();
  const submittedMarketSymbols = Object.keys(value.marketTiers).sort();
  if (
    requiredMarketSymbols.length !== submittedMarketSymbols.length ||
    requiredMarketSymbols.some((symbol, index) => symbol !== submittedMarketSymbols[index])
  ) {
    throw new AccessPolicyValidationError(
      "The market list changed. Reload the policy and try again.",
    );
  }
  let parsed: CustomerAccessPolicyDocument;
  try {
    parsed = parsePolicyDocument(value, defaultPolicy);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The policy contains invalid values.";
    throw new AccessPolicyValidationError(reason);
  }
  if (
    parsed.featureMinimumTiers.fullDepthReview !== currentPolicy.featureMinimumTiers.fullDepthReview
  ) {
    throw new AccessPolicyValidationError(
      "Full-depth review is not configurable until its customer feature is implemented.",
    );
  }
  if (parsed.watchlistLimits.VIP !== null) {
    throw new AccessPolicyValidationError("VIP watchlist capacity must remain unlimited.");
  }
  return parsed;
}

let lastRefreshAt = 0;
let refreshInFlight: Promise<void> | null = null;
let cacheGeneration = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

export async function refreshCustomerAccessPolicy(
  defaultPolicy: CustomerAccessPolicyDocument,
  force = false,
): Promise<void> {
  if (!force && Date.now() - lastRefreshAt < CUSTOMER_ACCESS_POLICY_REFRESH_INTERVAL_MS) return;
  if (refreshInFlight) return refreshInFlight;

  const generationAtStart = cacheGeneration;
  refreshInFlight = (async () => {
    let [row] = await db
      .select()
      .from(tradifyAccessPolicies)
      .where(eq(tradifyAccessPolicies.key, POLICY_KEY))
      .limit(1);

    if (!row) {
      await db
        .insert(tradifyAccessPolicies)
        .values({ key: POLICY_KEY, policy: defaultPolicy, rowVersion: 1 })
        .onConflictDoNothing({ target: tradifyAccessPolicies.key });
      [row] = await db
        .select()
        .from(tradifyAccessPolicies)
        .where(eq(tradifyAccessPolicies.key, POLICY_KEY))
        .limit(1);
    }
    if (!row) throw new Error("Unable to initialize the shared customer access policy.");

    const parsed = parsePolicyDocument(row.policy, defaultPolicy);
    if (generationAtStart === cacheGeneration) {
      installCustomerAccessPolicy(parsed, row.rowVersion);
      lastRefreshAt = Date.now();
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export function startCustomerAccessPolicyRefreshLoop(
  defaultPolicy: () => CustomerAccessPolicyDocument,
  onError: (error: unknown) => void,
): void {
  if (refreshTimer) return;
  const refresh = () => {
    void refreshCustomerAccessPolicy(defaultPolicy()).catch(onError);
  };
  refresh();
  refreshTimer = setInterval(refresh, CUSTOMER_ACCESS_POLICY_REFRESH_INTERVAL_MS);
  refreshTimer.unref?.();
}

export function stopCustomerAccessPolicyRefreshLoop(): void {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

export async function updateCustomerAccessPolicy(input: {
  policy: CustomerAccessPolicyDocument;
  expectedVersion: number;
  actorId: string;
  actorEmail: string;
}): Promise<CustomerAccessPolicyDocument & { rowVersion: number }> {
  const now = new Date().toISOString();
  const newVersion = input.expectedVersion + 1;
  const auditId = randomUUID();

  await db.transaction(async (transaction) => {
    const [current] = await transaction
      .select({ policy: tradifyAccessPolicies.policy })
      .from(tradifyAccessPolicies)
      .where(
        and(
          eq(tradifyAccessPolicies.key, POLICY_KEY),
          eq(tradifyAccessPolicies.rowVersion, input.expectedVersion),
        ),
      )
      .limit(1);
    if (!current) throw new AccessPolicyConflictError();

    const [updated] = await transaction
      .update(tradifyAccessPolicies)
      .set({
        policy: input.policy,
        rowVersion: newVersion,
        updatedAt: new Date(now),
        updatedBy: input.actorId,
      })
      .where(
        and(
          eq(tradifyAccessPolicies.key, POLICY_KEY),
          eq(tradifyAccessPolicies.rowVersion, input.expectedVersion),
        ),
      )
      .returning({ rowVersion: tradifyAccessPolicies.rowVersion });
    if (!updated) throw new AccessPolicyConflictError();

    await transaction.insert(tradifyAdminAuditEvents).values({
      id: auditId,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: "ACCESS_POLICY_UPDATED",
      targetUserId: null,
      targetEmail: null,
      details: {
        rowVersion: newVersion,
        before: current.policy,
        after: input.policy,
      },
      createdAt: now,
    });
  });

  cacheGeneration += 1;
  installCustomerAccessPolicy(input.policy, newVersion);
  lastRefreshAt = Date.now();
  return customerAccessPolicySnapshot();
}

export function customerAccessPolicyDefaultForMarketSet(
  coreSymbols: readonly string[],
  quoteOnlySymbols: readonly string[],
): CustomerAccessPolicyDocument {
  return createDefaultCustomerAccessPolicy(coreSymbols, quoteOnlySymbols);
}
