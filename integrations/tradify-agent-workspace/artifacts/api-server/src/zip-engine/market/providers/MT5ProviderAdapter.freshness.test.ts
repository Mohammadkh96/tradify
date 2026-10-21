import assert from "node:assert/strict";
import { mt5ChartCandleFreshnessWindowMs } from "../CandleTime";
import type { Candle } from "../types";
import type { MT5BridgeStore } from "./MT5BridgeStore";
import { MT5ProviderAdapter } from "./MT5ProviderAdapter";

const capturedWindows = new Map<string, number>();
const nowSeconds = Math.floor(Date.now() / 1000);
const candles: Candle[] = Array.from({ length: 60 }, (_, index) => ({
  time: nowSeconds - (60 - index) * 900,
  open: 2_000 + index,
  high: 2_001 + index,
  low: 1_999 + index,
  close: 2_000.5 + index,
  volume: 1,
}));
let healthCandles = candles;

const fakeBridgeStore = {
  hydrateFromPersistence: async () => undefined,
  getMappings: () => ({ XAUUSD: "XAUUSD" }),
  getCandlesForBrokerSymbolPersisted: async () => healthCandles,
  isCandleFresh: (_symbol: string, timeframe: string, maxAgeMs: number) => {
    capturedWindows.set(timeframe.toUpperCase(), maxAgeMs);
    return true;
  },
  getStatus: () => ({
    bridgeId: "freshness-test",
    server: "test",
    serverGenerationId: "freshness-test",
    connected: true,
    lastHeartbeat: Date.now(),
    status: "CONNECTED" as const,
    availableSymbols: ["XAUUSD"],
    activeSymbols: ["XAUUSD"],
    discoveredCount: 1,
    activeCount: 1,
    subscriptionVersion: 1,
    mappings: { XAUUSD: "XAUUSD" },
    quoteCount: 0,
    rejectedCandleCount: 0,
    healthState: "CONNECTED" as const,
    healthReasons: [],
  }),
  isBackfillCompleted: () => true,
  isQuoteFresh: () => true,
} as unknown as MT5BridgeStore;

const adapter = new MT5ProviderAdapter(fakeBridgeStore);

for (const timeframe of ["M15", "H4", "D1", "W1", "MN1"] as const) {
  const result = await adapter.getCandles("XAUUSD", timeframe, 60);
  assert.ok(result);
  assert.equal(result.dataState, "LIVE");
  assert.equal(
    capturedWindows.get(timeframe),
    mt5ChartCandleFreshnessWindowMs(timeframe),
    `${timeframe} chart reads should use their timeframe-aware freshness window`,
  );
}

const m15StrategyHealth = await adapter.getHealth({
  canonicalSymbol: "XAUUSD",
  timeframe: "M15",
  strategyId: "DGV8",
  purpose: "STRATEGY",
});
assert.equal(m15StrategyHealth.health, "HEALTHY");
assert.equal(
  capturedWindows.get("M15"),
  30 * 60 * 1000,
  "M15 strategy freshness must remain 30 minutes",
);

healthCandles = [
  ...candles,
  {
    ...candles.at(-1)!,
    time: nowSeconds,
  },
];
const openBarStrategyHealth = await adapter.getHealth({
  canonicalSymbol: "XAUUSD",
  timeframe: "M15",
  strategyId: "DGV8",
  purpose: "STRATEGY",
});
assert.equal(
  openBarStrategyHealth.health,
  "HEALTHY",
  "an open M15 candle must not hide the preceding closed candle from strategy readiness",
);

for (const [timeframe, expectedWindow] of [
  ["H4", 2 * 4 * 60 * 60 * 1000],
  ["D1", 2 * 24 * 60 * 60 * 1000],
  ["W1", 2 * 7 * 24 * 60 * 60 * 1000],
  ["MN1", 2 * 31 * 24 * 60 * 60 * 1000],
] as const) {
  assert.equal(
    mt5ChartCandleFreshnessWindowMs(timeframe),
    expectedWindow,
    `${timeframe} should allow the open candle duration plus the existing one-interval grace`,
  );
}

console.log(
  "MT5 freshness checks passed: higher-timeframe chart windows and M15 strategy freshness.",
);
