import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  customerWatchlistSymbol,
  customerAccessPolicySnapshot,
  createDefaultCustomerAccessPolicy,
  DEFAULT_CUSTOMER_ACCESS_POLICY,
  FREE_STARTER_SYMBOLS,
  hasFeatureAccess,
  hasMarketAccess,
  installCustomerAccessPolicy,
  MT5_MARKET_SYMBOLS,
  requiredFeatureTier,
  requiredMarketTier,
  watchlistIdentity,
  watchlistLimit,
} from "./market-access";

const coreSymbols = new Set([
  "XAUUSD",
  "XAGUSD",
  "USOIL",
  "US100",
  "US30",
  "US500",
  "GER40",
  "UK100",
  "JP225",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "USDCHF",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "AUDJPY",
  "BTCUSD",
  "ETHUSD",
]);
const aliases: Record<string, string> = { NDX: "US100", SP500: "US500", USTEC: "US100" };
const canonicalize = (symbol: string) =>
  coreSymbols.has(symbol) ? symbol : (aliases[symbol] ?? null);

describe("shared customer access policy", { concurrency: false }, () => {
  test("market tiers preserve the starter, core, and quote-only boundaries", () => {
    assert.equal(MT5_MARKET_SYMBOLS.size, 61);
    assert.deepEqual(FREE_STARTER_SYMBOLS, ["USOIL", "BTCUSD", "ETHUSD"]);
    assert.equal(requiredMarketTier("USOIL", coreSymbols, canonicalize), "Free");
    assert.equal(requiredMarketTier("XAUUSD", coreSymbols, canonicalize), "Pro");
    assert.equal(requiredMarketTier("US100", coreSymbols, canonicalize), "Pro");
    assert.equal(requiredMarketTier("AMD", coreSymbols, canonicalize), "VIP");
    assert.equal(requiredMarketTier("NDX", coreSymbols, canonicalize), "VIP");
    assert.equal(requiredMarketTier("USTEC", coreSymbols, canonicalize), "Pro");
    assert.equal(requiredMarketTier("NOT_A_MARKET", coreSymbols, canonicalize), null);
  });

  test("market access is cumulative by membership tier", () => {
    assert.equal(hasMarketAccess("ETHUSD", "Free", coreSymbols, canonicalize), true);
    assert.equal(hasMarketAccess("EURUSD", "Free", coreSymbols, canonicalize), false);
    assert.equal(hasMarketAccess("EURUSD", "Pro", coreSymbols, canonicalize), true);
    assert.equal(hasMarketAccess("AMD", "Pro", coreSymbols, canonicalize), false);
    assert.equal(hasMarketAccess("AMD", "VIP", coreSymbols, canonicalize), true);
  });

  test("plan features are gated by the lowest tier that explicitly includes them", () => {
    assert.equal(hasFeatureAccess("Free", "signalContext"), false);
    assert.equal(hasFeatureAccess("Free", "trustedSetupLevels"), false);
    assert.equal(hasFeatureAccess("Free", "performanceContext"), false);
    assert.equal(hasFeatureAccess("Free", "priceAlerts"), false);
    assert.equal(hasFeatureAccess("Pro", "signalContext"), true);
    assert.equal(hasFeatureAccess("Pro", "trustedSetupLevels"), true);
    assert.equal(hasFeatureAccess("Pro", "performanceContext"), true);
    assert.equal(hasFeatureAccess("Pro", "priceAlerts"), true);
    assert.equal(hasFeatureAccess("VIP", "fullDepthReview"), true);
    assert.equal(requiredFeatureTier("fullDepthReview"), "VIP");
  });

  test("watchlist normalization keeps quote-only MT5 symbols separate from core aliases", () => {
    assert.equal(customerWatchlistSymbol("AMD", coreSymbols, canonicalize), "AMD");
    assert.equal(customerWatchlistSymbol("NDX", coreSymbols, canonicalize), "NDX");
    assert.equal(customerWatchlistSymbol("USTEC", coreSymbols, canonicalize), "US100");
    assert.equal(customerWatchlistSymbol("NOT_A_MARKET", coreSymbols, canonicalize), null);
    assert.equal(watchlistIdentity("NDX", coreSymbols, canonicalize), "NDX");
    assert.equal(watchlistIdentity("USTEC", coreSymbols, canonicalize), "US100");
    assert.equal(watchlistLimit("Free"), 3);
    assert.equal(watchlistLimit("Pro"), 22);
    assert.ok(watchlistLimit("VIP") > MT5_MARKET_SYMBOLS.size);
  });

  test("persisted access rules drive feature, market, and watchlist decisions", () => {
    const defaults = createDefaultCustomerAccessPolicy([...coreSymbols], ["AMD"]);
    const custom = {
      ...defaults,
      featureMinimumTiers: {
        ...defaults.featureMinimumTiers,
        signalContext: "Free" as const,
      },
      marketTiers: {
        ...defaults.marketTiers,
        EURUSD: "Free" as const,
        AMD: "Pro" as const,
      },
      watchlistLimits: { Free: 5, Pro: 40, VIP: null },
    };

    try {
      installCustomerAccessPolicy(custom, 4);
      assert.equal(requiredFeatureTier("signalContext"), "Free");
      assert.equal(hasFeatureAccess("Free", "signalContext"), true);
      assert.equal(requiredMarketTier("EURUSD", coreSymbols, canonicalize), "Free");
      assert.equal(hasMarketAccess("EURUSD", "Free", coreSymbols, canonicalize), true);
      assert.equal(requiredMarketTier("AMD", coreSymbols, canonicalize), "Pro");
      assert.equal(hasMarketAccess("AMD", "Pro", coreSymbols, canonicalize), true);
      assert.equal(watchlistLimit("Free"), 5);
      assert.equal(watchlistLimit("Pro"), 40);
      assert.equal(customerAccessPolicySnapshot().rowVersion, 4);
    } finally {
      installCustomerAccessPolicy(DEFAULT_CUSTOMER_ACCESS_POLICY, 0);
    }
  });
});
