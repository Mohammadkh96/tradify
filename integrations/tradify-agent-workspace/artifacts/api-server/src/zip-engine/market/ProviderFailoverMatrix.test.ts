import assert from "node:assert/strict";
import type {
  CandleResponse,
  IMarketDataProvider,
  MarketDataContext,
  ProviderHealthSnapshot,
  QuoteData,
} from "./types";
import { ProviderCapabilityPolicy, marketDataCapabilityPolicy } from "./ProviderCapabilityPolicy";
import { ProviderRegistry } from "./ProviderRegistry";
import { CANONICAL_SYMBOLS } from "./SymbolMapper";

const now = Math.floor(Date.now() / 1000);
const candles = Array.from({ length: 80 }, (_, index) => {
  const time = Math.floor((now - (80 - index) * 900) / 900) * 900;
  return {
    time,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100.5 + index,
    volume: 10,
  };
});

const cryptoSymbols = new Set(["BTCUSD", "ETHUSD"]);
const twelveTechnicalSymbols = new Set([
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
  "XAUUSD",
  "BTCUSD",
  "ETHUSD",
]);

function fakeProvider(
  name: string,
  supports: (symbol: string) => boolean,
  health: () => ProviderHealthSnapshot["health"],
  providerSymbols: Record<string, string>,
  priceBasis?: "USD" | "USDT" | "BROKER",
): IMarketDataProvider {
  return {
    name,
    supportsSymbol: supports,
    getQuote: async (symbol, overrideProviderSymbol): Promise<QuoteData | null> => {
      if (!supports(symbol)) return null;
      return {
        symbol,
        provider: name,
        providerSymbol: overrideProviderSymbol ?? providerSymbols[symbol],
        instrumentType: cryptoSymbols.has(symbol) ? "CRYPTO_SPOT" : "SPOT",
        price: 100,
        bid: 99.9,
        ask: 100.1,
        last: 100,
        priceBasis,
        timestamp: new Date(candles.at(-1)!.time * 1000).toISOString(),
        receivedAt: new Date().toISOString(),
        status: "LIVE",
        dataState: "LIVE",
      };
    },
    getCandles: async (
      symbol,
      timeframe,
      _limit,
      overrideProviderSymbol,
    ): Promise<CandleResponse | null> => {
      if (!supports(symbol)) return null;
      return {
        symbol,
        provider: name,
        providerSymbol: overrideProviderSymbol ?? providerSymbols[symbol],
        instrumentType: cryptoSymbols.has(symbol) ? "CRYPTO_SPOT" : "SPOT",
        priceBasis,
        timeframe,
        timezone: "UTC",
        candles,
        dataState: "LIVE",
        sourceTimestamp: candles.at(-1)!.time,
        receivedAt: Date.now(),
      };
    },
    getHealth: async (context): Promise<ProviderHealthSnapshot> => ({
      health: supports(context.canonicalSymbol) ? health() : "UNAVAILABLE",
      reasons: [],
      observedAt: Date.now(),
      seriesReadiness: {
        providerId: name,
        canonicalSymbol: context.canonicalSymbol,
        timeframe: context.timeframe,
        enoughHistoryLoaded: true,
        latestRequiredClosedBarPresent: true,
        continuityValid: true,
        fullSynchronizationComplete: true,
        freshnessValid: true,
        observedAt: Date.now(),
      },
    }),
  };
}

function context(symbol: string): MarketDataContext {
  return {
    canonicalSymbol: symbol,
    timeframe: "M15",
    strategyId: "DGV8_FX",
    purpose: "STRATEGY",
  };
}

function matrixRegistry(state: {
  mt5: ProviderHealthSnapshot["health"];
  coinbase: ProviderHealthSnapshot["health"];
  binance: ProviderHealthSnapshot["health"];
  twelve: ProviderHealthSnapshot["health"];
}): ProviderRegistry {
  const registry = new ProviderRegistry(
    { failoverAfterMs: 100, alternateStableMs: 100, primaryRecoveryMs: 300 },
    async () => undefined,
    async () => null,
    async () => undefined,
    marketDataCapabilityPolicy,
  );
  const allSymbols = Object.fromEntries(CANONICAL_SYMBOLS.map((symbol) => [symbol, symbol]));
  registry.register({
    id: "PRIMARY_MT5",
    displayName: "MT5",
    provider: fakeProvider(
      "PRIMARY_MT5",
      () => true,
      () => state.mt5,
      allSymbols,
      "BROKER",
    ),
    role: "PRIMARY",
    approval: "APPROVED",
    priority: 0,
    enabled: true,
  });
  registry.register({
    id: "SHADOW_COINBASE",
    displayName: "Coinbase",
    provider: fakeProvider(
      "COINBASE",
      (symbol) => cryptoSymbols.has(symbol),
      () => state.coinbase,
      { BTCUSD: "BTC-USD", ETHUSD: "ETH-USD" },
      "USD",
    ),
    role: "ALTERNATE",
    approval: "APPROVED",
    priority: 1,
    enabled: true,
  });
  registry.register({
    id: "SHADOW_BINANCE",
    displayName: "Binance",
    provider: fakeProvider(
      "BINANCE",
      (symbol) => cryptoSymbols.has(symbol),
      () => state.binance,
      { BTCUSD: "BTCUSDT", ETHUSD: "ETHUSDT" },
      "USDT",
    ),
    role: "ALTERNATE",
    approval: "APPROVED",
    priority: 2,
    enabled: true,
  });
  registry.register({
    id: "TWELVE_DATA",
    displayName: "Twelve Data",
    provider: fakeProvider(
      "TWELVE_DATA",
      (symbol) => twelveTechnicalSymbols.has(symbol),
      () => state.twelve,
      Object.fromEntries([...twelveTechnicalSymbols].map((symbol) => [symbol, symbol])),
      "USD",
    ),
    role: "SHADOW",
    approval: "NOT_APPROVED",
    priority: 3,
    enabled: true,
  });
  return registry;
}

async function run() {
  const unavailable = {
    mt5: "UNAVAILABLE" as const,
    coinbase: "HEALTHY" as const,
    binance: "HEALTHY" as const,
    twelve: "HEALTHY" as const,
  };
  const registry = matrixRegistry(unavailable);

  for (const symbol of CANONICAL_SYMBOLS) {
    const decision = await registry.resolveAuthority(context(symbol), 0);
    assert.equal(
      decision.selectedProviderId,
      cryptoSymbols.has(symbol) ? "SHADOW_COINBASE" : null,
      `unexpected MT5-off authority for ${symbol}`,
    );
  }

  const state: {
    mt5: ProviderHealthSnapshot["health"];
    coinbase: ProviderHealthSnapshot["health"];
    binance: ProviderHealthSnapshot["health"];
    twelve: ProviderHealthSnapshot["health"];
  } = {
    mt5: "UNAVAILABLE" as const,
    coinbase: "HEALTHY" as const,
    binance: "HEALTHY" as const,
    twelve: "HEALTHY" as const,
  };
  const cryptoRegistry = matrixRegistry(state);
  assert.equal(
    (await cryptoRegistry.resolveAuthority(context("BTCUSD"), 0)).selectedProviderId,
    "SHADOW_COINBASE",
  );
  state.coinbase = "UNAVAILABLE";
  assert.equal(
    (await cryptoRegistry.resolveAuthority(context("BTCUSD"), 100)).selectedProviderId,
    "SHADOW_COINBASE",
  );
  assert.equal(
    (await cryptoRegistry.resolveAuthority(context("BTCUSD"), 201)).selectedProviderId,
    "SHADOW_BINANCE",
  );

  state.binance = "UNAVAILABLE";
  assert.equal(
    (await cryptoRegistry.resolveAuthority(context("BTCUSD"), 301)).selectedProviderId,
    "SHADOW_BINANCE",
  );
  assert.equal(
    (await cryptoRegistry.resolveAuthority(context("BTCUSD"), 402)).selectedProviderId,
    null,
  );

  const primaryState: {
    mt5: ProviderHealthSnapshot["health"];
    coinbase: ProviderHealthSnapshot["health"];
    binance: ProviderHealthSnapshot["health"];
    twelve: ProviderHealthSnapshot["health"];
  } = {
    mt5: "HEALTHY" as const,
    coinbase: "HEALTHY" as const,
    binance: "HEALTHY" as const,
    twelve: "HEALTHY" as const,
  };
  const recoveryRegistry = matrixRegistry(primaryState);
  assert.equal(
    (await recoveryRegistry.resolveAuthority(context("ETHUSD"), 0)).selectedProviderId,
    "PRIMARY_MT5",
  );
  primaryState.mt5 = "UNAVAILABLE";
  assert.equal(
    (await recoveryRegistry.resolveAuthority(context("ETHUSD"), 201)).selectedProviderId,
    "PRIMARY_MT5",
  );
  assert.equal(
    (await recoveryRegistry.resolveAuthority(context("ETHUSD"), 302)).selectedProviderId,
    "SHADOW_COINBASE",
  );
  primaryState.mt5 = "HEALTHY";
  assert.equal(
    (await recoveryRegistry.resolveAuthority(context("ETHUSD"), 303)).selectedProviderId,
    "SHADOW_COINBASE",
  );
  assert.equal(
    (await recoveryRegistry.resolveAuthority(context("ETHUSD"), 603)).selectedProviderId,
    "PRIMARY_MT5",
  );

  const quote = await cryptoRegistry.getQuote("TWELVE_DATA", context("BTCUSD"));
  assert.equal(quote?.providerSymbol, "BTC/USD");
  assert.equal(quote?.priceBasis, "USD");
  assert.ok(quote?.timestamp);

  const policy = new ProviderCapabilityPolicy();
  const twelveGold = policy.get("TWELVE_DATA", "XAUUSD", "M15");
  assert.equal(twelveGold?.technicalCapability, true);
  assert.equal(twelveGold?.approval, "NOT_APPROVED");
  assert.equal(twelveGold?.authorityEligibilityReason, "ENTITLEMENT_CAPACITY_INSUFFICIENT");
  assert.equal(policy.get("TWELVE_DATA", "XAGUSD", "M15"), undefined);
  assert.equal(policy.get("TWELVE_DATA", "USOIL", "M15"), undefined);
}

await run();
console.log(
  "Provider failover matrix checks passed: MT5-off scope, crypto order, fallback, recovery, provenance, and fail-closed symbols.",
);
