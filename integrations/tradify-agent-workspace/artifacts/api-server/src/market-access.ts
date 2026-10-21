import { MT5_WATCHLIST_QUOTE_SYMBOLS } from "./zip-engine/market/MT5WatchlistSubscriptions";

export type CustomerMembershipTier = "Free" | "Pro" | "VIP";
export type MarketSymbolCanonicalizer = (symbol: string) => string | null;
export type CustomerFeature =
  | "signalContext"
  | "trustedSetupLevels"
  | "performanceContext"
  | "priceAlerts"
  | "fullDepthReview";

export const FREE_STARTER_SYMBOLS = ["USOIL", "BTCUSD", "ETHUSD"] as const;
export const FREE_WATCHLIST_LIMIT = 3;
export const PRO_WATCHLIST_LIMIT = 22;
export const MT5_MARKET_SYMBOLS = new Set<string>(MT5_WATCHLIST_QUOTE_SYMBOLS);

const membershipRank: Record<CustomerMembershipTier, number> = {
  Free: 0,
  Pro: 1,
  VIP: 2,
};
export const CUSTOMER_FEATURES: readonly CustomerFeature[] = [
  "signalContext",
  "trustedSetupLevels",
  "performanceContext",
  "priceAlerts",
  "fullDepthReview",
] as const;

export type CustomerAccessPolicyDocument = {
  featureMinimumTiers: Record<CustomerFeature, CustomerMembershipTier>;
  marketTiers: Record<string, CustomerMembershipTier>;
  watchlistLimits: Record<CustomerMembershipTier, number | null>;
};

export const DEFAULT_CUSTOMER_ACCESS_POLICY: CustomerAccessPolicyDocument = {
  featureMinimumTiers: {
    signalContext: "Pro",
    trustedSetupLevels: "Pro",
    performanceContext: "Pro",
    priceAlerts: "Pro",
    fullDepthReview: "VIP",
  },
  marketTiers: {},
  watchlistLimits: { Free: FREE_WATCHLIST_LIMIT, Pro: PRO_WATCHLIST_LIMIT, VIP: null },
};

let activeAccessPolicy: CustomerAccessPolicyDocument = DEFAULT_CUSTOMER_ACCESS_POLICY;
let activePolicyVersion = 0;

export function createDefaultCustomerAccessPolicy(
  coreSymbols: readonly string[],
  quoteOnlySymbols: readonly string[],
): CustomerAccessPolicyDocument {
  const starterSymbols = new Set<string>(FREE_STARTER_SYMBOLS);
  const marketTiers: Record<string, CustomerMembershipTier> = {};
  for (const symbol of coreSymbols) {
    const normalized = symbol.trim().toUpperCase();
    if (normalized) marketTiers[normalized] = starterSymbols.has(normalized) ? "Free" : "Pro";
  }
  for (const symbol of quoteOnlySymbols) {
    const normalized = symbol.trim().toUpperCase();
    if (normalized && !marketTiers[normalized]) marketTiers[normalized] = "VIP";
  }
  return {
    featureMinimumTiers: { ...DEFAULT_CUSTOMER_ACCESS_POLICY.featureMinimumTiers },
    marketTiers,
    watchlistLimits: { ...DEFAULT_CUSTOMER_ACCESS_POLICY.watchlistLimits },
  };
}

export function installCustomerAccessPolicy(
  policy: CustomerAccessPolicyDocument,
  version: number,
): void {
  activeAccessPolicy = {
    featureMinimumTiers: { ...policy.featureMinimumTiers },
    marketTiers: { ...policy.marketTiers },
    watchlistLimits: { ...policy.watchlistLimits },
  };
  activePolicyVersion = version;
}

export function customerAccessPolicySnapshot(): CustomerAccessPolicyDocument & {
  rowVersion: number;
} {
  return {
    featureMinimumTiers: { ...activeAccessPolicy.featureMinimumTiers },
    marketTiers: { ...activeAccessPolicy.marketTiers },
    watchlistLimits: { ...activeAccessPolicy.watchlistLimits },
    rowVersion: activePolicyVersion,
  };
}

export function currentFreeStarterSymbols(): string[] {
  if (activePolicyVersion > 0) {
    return Object.entries(activeAccessPolicy.marketTiers)
      .filter(([, tier]) => tier === "Free")
      .map(([symbol]) => symbol);
  }
  return [...FREE_STARTER_SYMBOLS];
}

export function requiredFeatureTier(feature: CustomerFeature): CustomerMembershipTier {
  return activeAccessPolicy.featureMinimumTiers[feature];
}

export function hasFeatureAccess(
  membership: CustomerMembershipTier,
  feature: CustomerFeature,
): boolean {
  return membershipRank[membership] >= membershipRank[requiredFeatureTier(feature)];
}

export function requiredMarketTier(
  rawSymbol: string,
  coreSymbols: ReadonlySet<string>,
  canonicalize: MarketSymbolCanonicalizer,
): CustomerMembershipTier | null {
  const normalized = rawSymbol.trim().toUpperCase();
  if (!normalized) return null;

  const directPolicyTier = activeAccessPolicy.marketTiers[normalized];
  if (directPolicyTier) return directPolicyTier;

  // Keep broker-specific quote-only symbols distinct even when a provider alias
  // points at the same underlying core market (for example, NDX → US100).
  if (!coreSymbols.has(normalized) && MT5_MARKET_SYMBOLS.has(normalized)) return "VIP";

  const canonical = canonicalize(normalized);
  const coreSymbol = canonical && coreSymbols.has(canonical) ? canonical : null;
  if (coreSymbol) {
    return (
      activeAccessPolicy.marketTiers[coreSymbol] ??
      (FREE_STARTER_SYMBOLS.includes(coreSymbol as (typeof FREE_STARTER_SYMBOLS)[number])
        ? "Free"
        : "Pro")
    );
  }
  if (MT5_MARKET_SYMBOLS.has(normalized)) return "VIP";
  return null;
}

export function hasMarketAccess(
  rawSymbol: string,
  membership: CustomerMembershipTier,
  coreSymbols: ReadonlySet<string>,
  canonicalize: MarketSymbolCanonicalizer,
): boolean {
  const required = requiredMarketTier(rawSymbol, coreSymbols, canonicalize);
  return required !== null && membershipRank[membership] >= membershipRank[required];
}

export function customerWatchlistSymbol(
  rawSymbol: string,
  coreSymbols: ReadonlySet<string>,
  canonicalize: MarketSymbolCanonicalizer,
): string | null {
  const normalized = rawSymbol.trim().toUpperCase();
  if (!normalized) return null;

  // Preserve broker-specific quote-only symbols as their own watchlist items.
  if (MT5_MARKET_SYMBOLS.has(normalized)) return normalized;

  const canonical = canonicalize(normalized);
  return canonical && coreSymbols.has(canonical) ? canonical : null;
}

export function watchlistIdentity(
  rawSymbol: string,
  coreSymbols: ReadonlySet<string>,
  canonicalize: MarketSymbolCanonicalizer,
): string {
  const normalized = rawSymbol.trim().toUpperCase();
  if (MT5_MARKET_SYMBOLS.has(normalized)) return normalized;
  const canonical = canonicalize(normalized);
  return canonical && coreSymbols.has(canonical) ? canonical : normalized;
}

export function watchlistLimit(membership: CustomerMembershipTier): number {
  return activeAccessPolicy.watchlistLimits[membership] ?? Number.MAX_SAFE_INTEGER;
}
