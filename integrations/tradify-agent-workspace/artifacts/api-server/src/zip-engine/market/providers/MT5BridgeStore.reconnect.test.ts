import assert from "node:assert/strict";
import { eq, like, or } from "drizzle-orm";
import { db, tradifyMt5Candles } from "@workspace/db";
import { MT5BridgeStore, mt5BridgeStore } from "./MT5BridgeStore";
import { MT5ProviderAdapter, mt5ProviderAdapter } from "./MT5ProviderAdapter";
import { mt5ServerWallTimeToUtc } from "../CandleTime";
import { marketCatalog } from "../MarketCatalog";
import { bridgeStore, getCandles } from "../../../tradify-runtime";
import { evaluateSymbol } from "../../../authoritative-engine";
import { engineState, engineStateReady } from "../../../engine-state";

function makeBrokerCandles(
  count: number,
  startTime: number,
  intervalSeconds = 900,
  closeBase = 2000,
) {
  return Array.from({ length: count }, (_, index) => {
    const close = closeBase + index;
    return {
      time: startTime + index * intervalSeconds,
      open: close - 1,
      high: close + 2,
      low: close - 2,
      close,
      volume: 100 + index,
    };
  });
}

const PERSISTENCE_FIXTURE_MARKERS = [
  "MT5_RECONNECT_FIXTURE_",
  // Legacy prefixes are retained only to remove rows created by earlier test runs.
  "XAUUSD_PERSIST_",
  "XAGUSD_PERSIST_",
  "USOIL_PERSIST_",
  "XAGUSD_CONCURRENT_",
] as const;

const reconnectBrokerSymbol = "xAuUsd.s";

async function clearPersistenceFixtureRows(): Promise<void> {
  await db
    .delete(tradifyMt5Candles)
    .where(
      or(
        eq(tradifyMt5Candles.brokerSymbol, reconnectBrokerSymbol),
        ...PERSISTENCE_FIXTURE_MARKERS.map((marker) =>
          like(tradifyMt5Candles.brokerSymbol, `${marker}%`),
        ),
      ),
    );
}

const firstGeneration = mt5BridgeStore.getServerGenerationId();
await engineStateReady;
if (!engineState.isActive()) engineState.resume("bridge reconnect regression fixture");
await mt5BridgeStore.reset();
await clearPersistenceFixtureRows();
const restartedGeneration = mt5BridgeStore.getServerGenerationId();
assert.notEqual(
  restartedGeneration,
  firstGeneration,
  "a restarted bridge process must have a new generation ID",
);

bridgeStore.updateHeartbeat({
  bridgeId: "reconnect-test",
  connected: false,
});
assert.equal(mt5BridgeStore.getStatus().status, "BROKER_DISCONNECTED");
assert.equal(
  mt5BridgeStore.getStatus().healthState,
  "STALE",
  "a recent broker disconnect should be stale, not critical",
);

bridgeStore.updateHeartbeat({
  bridgeId: "reconnect-test",
  connected: true,
  symbols: [reconnectBrokerSymbol, "USTEC"],
  activeSymbols: [reconnectBrokerSymbol, "USTEC"],
});
assert.deepEqual(
  bridgeStore.getStatus().activeSymbols,
  [reconnectBrokerSymbol, "USTEC"],
  "the API status must expose the ZIP store subscriptions",
);
assert.equal(
  bridgeStore.getStatus().connected,
  true,
  "the API status must use the ZIP store connection state",
);
assert.equal(
  bridgeStore.getMappings().XAUUSD,
  reconnectBrokerSymbol,
  "a broker heartbeat must map canonical XAUUSD to its discovered symbol",
);
assert.deepEqual(
  mt5BridgeStore.getPendingBackfillSymbols(),
  [reconnectBrokerSymbol, "USTEC"],
  "the bridge should identify the exact active symbols still awaiting full M15 history",
);
assert.ok(
  Object.values(bridgeStore.getMappings()).includes(reconnectBrokerSymbol),
  "the next bridge subscription must request the discovered XAUUSD broker symbol",
);

const initialSpecificationUtcTime = Math.floor(Date.now() / 1000);
const initialTradingSessions = {
  source: "MT5_SYMBOL_INFO_SESSION_TRADE",
  complete: true,
  serverTime: initialSpecificationUtcTime + 10_800,
  utcTime: initialSpecificationUtcTime,
  sessions: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    fromSeconds: 0,
    toSeconds: 86_400,
  })),
};
assert.equal(
  await mt5BridgeStore.updateSpecifications([
    { brokerSymbol: reconnectBrokerSymbol, tradingSessions: initialTradingSessions },
    { brokerSymbol: "USTEC", tradingSessions: initialTradingSessions },
  ]),
  2,
  "the bridge must have fresh broker-session schedules before a FULL M15 sync",
);
const coverageRange = {
  endUtc: Math.floor(Date.now() / 900_000) * 900 + 900,
  startUtc: Math.floor(Date.now() / 900_000) * 900 + 900 - 10 * 86_400,
};
const brokerStart = coverageRange.startUtc + 10_800;
const fullM15History = makeBrokerCandles(960, brokerStart);
bridgeStore.updateCandles({
  symbol: reconnectBrokerSymbol,
  timeframe: "M15",
  candles: fullM15History,
  syncMode: "FULL",
  coverageRange,
});
assert.equal(
  mt5BridgeStore.isBackfillCompleted(),
  false,
  "one symbol must not complete the multi-symbol backfill",
);
assert.deepEqual(
  mt5BridgeStore.getPendingBackfillSymbols(),
  ["USTEC"],
  "a completed XAU M15 sync should leave only the other active symbol pending",
);
const partialStrategyHealth = await mt5ProviderAdapter.getHealth({
  canonicalSymbol: "XAUUSD",
  timeframe: "M15",
  strategyId: "DGV8",
  purpose: "STRATEGY",
});
assert.equal(
  partialStrategyHealth.health,
  "DEGRADED",
  "partial M15 sync must block trusted strategy health",
);
assert.match(partialStrategyHealth.reasons.join(" "), /full m15 synchronization/i);
assert.equal(
  partialStrategyHealth.checks?.some((check) => check.name === "M15_FULL_SYNC" && !check.passed),
  true,
);

bridgeStore.updateCandles({
  symbol: "USTEC",
  timeframe: "M15",
  candles: fullM15History,
  syncMode: "FULL",
  coverageRange,
});
assert.equal(
  mt5BridgeStore.isBackfillCompleted(),
  true,
  "all active symbols need complete strategy history",
);
const completeStrategyHealth = await mt5ProviderAdapter.getHealth({
  canonicalSymbol: "XAUUSD",
  timeframe: "M15",
  strategyId: "DGV8",
  purpose: "STRATEGY",
});
assert.equal(
  completeStrategyHealth.health,
  "HEALTHY",
  "complete M15 sync should restore trusted strategy health",
);

const specificationUtcTime = Math.floor(Date.now() / 1000);
assert.equal(
  await mt5BridgeStore.updateSpecifications([
    {
      brokerSymbol: reconnectBrokerSymbol,
      tradeContractSize: 100,
      tradeTickSize: 0.01,
      tradeTickValue: 1,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
      digits: 2,
      point: 0.01,
      profitCurrency: "USD",
      tradingSessions: {
        source: "MT5_SYMBOL_INFO_SESSION_TRADE",
        complete: true,
        serverTime: specificationUtcTime + 10_800,
        utcTime: specificationUtcTime,
        sessions: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          fromSeconds: 0,
          toSeconds: 86_400,
        })),
      },
    },
    {
      brokerSymbol: "USTEC",
      tradeContractSize: 1,
      tradeTickSize: 0.01,
      tradeTickValue: 0.01,
      volumeMin: 0.1,
      volumeMax: 100,
      volumeStep: 0.1,
      profitCurrency: "USD",
    },
  ]),
  2,
  "complete MT5 specifications should be accepted for mapped symbols",
);
assert.equal(marketCatalog.get("XAUUSD")?.brokerSpec?.contractSize, 100);
assert.equal(marketCatalog.get("XAUUSD")?.brokerSpec?.quoteCurrency, "USD");
assert.equal(marketCatalog.get("XAUUSD")?.brokerSpec?.volumeStep, 0.01);
assert.ok(
  marketCatalog.getCurrentBrokerTradingSessions("XAUUSD", reconnectBrokerSymbol),
  "complete MT5 session metadata with a current UTC clock should be retained for the mapped broker symbol",
);

const rejectedBefore = mt5BridgeStore.getStatus().rejectedCandleCount;
const rejected = bridgeStore.updateCandles({
  symbol: reconnectBrokerSymbol,
  timeframe: "M15",
  candles: [{ time: "not-a-timestamp", open: 0, high: 0, low: 0, close: 0 }],
});
assert.equal(rejected, 0, "malformed candle batches must not be accepted");
assert.equal(mt5BridgeStore.getStatus().rejectedCandleCount, rejectedBefore + 1);
assert.equal(
  mt5BridgeStore.isConnected(),
  true,
  "an invalid batch must not replace an existing healthy heartbeat",
);

const offGrid = bridgeStore.updateCandles({
  symbol: reconnectBrokerSymbol,
  timeframe: "M15",
  candles: makeBrokerCandles(1, brokerStart + 37),
  syncMode: "INCREMENTAL",
});
assert.equal(offGrid, 1);
const normalizedOffGrid = mt5BridgeStore
  .getCandlesForBrokerSymbol(reconnectBrokerSymbol, "M15")
  ?.at(-1);
assert.ok(normalizedOffGrid);
assert.equal(
  normalizedOffGrid.time % 900,
  0,
  "MT5 candle ingestion must normalize opening times to the M15 grid",
);

const apiHistory = await getCandles("XAUUSD", "M15", 500);
assert.ok(apiHistory);
assert.equal(apiHistory.provider, "MT5");
assert.equal(
  apiHistory.providerSymbol,
  reconnectBrokerSymbol,
  "the chart provider should read the discovered broker symbol",
);
assert.equal(apiHistory.dataState, "LIVE");
assert.equal(apiHistory.displayOnly, false);
assert.ok(
  apiHistory.candles.length >= 60,
  "the API should expose the complete recovered strategy history",
);

const beforeIncremental = mt5BridgeStore.getCandlesForBrokerSymbol(
  reconnectBrokerSymbol,
  "M15",
)?.length;
const incrementalAccepted = bridgeStore.updateCandles({
  symbol: reconnectBrokerSymbol,
  timeframe: "M15",
  candles: makeBrokerCandles(5, brokerStart + 60 * 900),
  syncMode: "INCREMENTAL",
});
assert.equal(
  incrementalAccepted,
  5,
  "incremental updates should accept the recovered candle batch",
);
assert.ok(
  (mt5BridgeStore.getCandlesForBrokerSymbol(reconnectBrokerSymbol, "M15")?.length ?? 0) >=
    (beforeIncremental ?? 0),
  "incremental updates should resume after full history is ready",
);
assert.equal(mt5BridgeStore.isBackfillCompleted(), true);

assert.equal(
  bridgeStore.updateQuotes({
    quotes: [
      {
        symbol: reconnectBrokerSymbol,
        bid: 2000,
        ask: 2000.5,
        last: 2000.25,
        chartMode: "BID",
        time: Math.floor(Date.now() / 1000),
      },
    ],
  }),
  1,
);
assert.equal(
  bridgeStore.getQuote("XAUUSD")?.brokerSymbol,
  reconnectBrokerSymbol,
  "the canonical live quote should retain its broker symbol",
);
const liveBrokerQuote = await mt5ProviderAdapter.getQuote(
  "XAUUSD",
  marketCatalog.get("XAUUSD")?.providerSymbol,
);
assert.ok(liveBrokerQuote);
assert.equal(
  liveBrokerQuote.providerSymbol,
  reconnectBrokerSymbol,
  "the quote provider should prefer the discovered broker symbol",
);
assert.equal(liveBrokerQuote.dataState, "LIVE");
const liveQuoteHealth = await mt5ProviderAdapter.getHealth({
  canonicalSymbol: "XAUUSD",
  timeframe: "M15",
  strategyId: "DGV8",
  purpose: "QUOTE",
});
assert.equal(
  liveQuoteHealth.health,
  "HEALTHY",
  "fresh quote health should remain available for the discovered broker symbol",
);
assert.equal(
  mt5BridgeStore.getStatus().healthState,
  "CONNECTED",
  "a subscribed, backfilled bridge with live quotes should be healthy",
);

const authoritative = await evaluateSymbol("XAUUSD", "DGV8", {
  XAUUSD: bridgeStore.getQuote("XAUUSD")!,
});
assert.ok(authoritative);
assert.equal(authoritative.provider, "MT5");
assert.equal(
  authoritative.validation.valid,
  true,
  `the authoritative path must validate normalized MT5 history: ${JSON.stringify(authoritative.validation)}`,
);
assert.equal(
  authoritative.provenance.marketDataTrusted,
  authoritative.dataState === "LIVE",
  "MT5 trust must remain aligned with the final live data state",
);

await clearPersistenceFixtureRows();
const storesToFlush = [mt5BridgeStore];
try {
  const persistenceRunId = Date.now();
  const persistedSymbols = [
    `${PERSISTENCE_FIXTURE_MARKERS[0]}${persistenceRunId}_XAUUSD`,
    `${PERSISTENCE_FIXTURE_MARKERS[0]}${persistenceRunId}_XAGUSD`,
    `${PERSISTENCE_FIXTURE_MARKERS[0]}${persistenceRunId}_USOIL`,
  ];
  const timeframeDefinitions = [
    { timeframe: "M1", count: 3, intervalSeconds: 60 },
    { timeframe: "M5", count: 3, intervalSeconds: 5 * 60 },
    { timeframe: "M15", count: 60, intervalSeconds: 15 * 60 },
  ] as const;
  const persistenceSeedCloseBase = 10_000 + (Math.floor(Date.now() / 1000) % 100_000);
  const persistenceQuoteSeed = [
    {
      canonicalSymbol: "XAUUSD",
      brokerSymbol: reconnectBrokerSymbol,
      bid: 2650.1,
      ask: 2650.6,
      last: 2650.3,
      chartMode: "BID",
    },
    {
      canonicalSymbol: "XAGUSD",
      brokerSymbol: "XAGUSD",
      bid: 31.21,
      ask: 31.27,
      last: 31.24,
      chartMode: "MID",
    },
    {
      canonicalSymbol: "USOIL",
      brokerSymbol: "USOIL",
      bid: 72.41,
      ask: 72.49,
      last: 72.45,
      chartMode: "LAST",
    },
  ] as const;
  bridgeStore.updateHeartbeat({
    bridgeId: "reconnect-test",
    connected: true,
    symbols: [...persistedSymbols, ...persistenceQuoteSeed.map(({ brokerSymbol }) => brokerSymbol)],
    activeSymbols: [...persistedSymbols],
  });
  assert.equal(
    bridgeStore.updateQuotes({
      quotes: persistenceQuoteSeed.map((quote) => ({
        bid: quote.bid,
        ask: quote.ask,
        last: quote.last,
        chartMode: quote.chartMode,
        time: Math.floor(Date.now() / 1000) + 3 * 3600,
        symbol: quote.brokerSymbol,
      })),
    }),
    persistenceQuoteSeed.length,
    "the bridge write path should accept the persisted quote fixture",
  );
  for (const symbol of persistedSymbols) {
    for (const definition of timeframeDefinitions) {
      const latestBrokerTime =
        Math.floor((Date.now() / 1000 + 7 * 24 * 3600) / definition.intervalSeconds) *
          definition.intervalSeconds +
        3 * 3600;
      const startBrokerTime =
        latestBrokerTime - (definition.count - 1) * definition.intervalSeconds;
      mt5BridgeStore.updateCandles(
        symbol,
        definition.timeframe,
        makeBrokerCandles(
          definition.count,
          startBrokerTime,
          definition.intervalSeconds,
          persistenceSeedCloseBase,
        ),
        definition.timeframe === "M15" ? "FULL" : "INCREMENTAL",
      );
    }
  }
  await mt5BridgeStore.flushPersistence();

  const freshBridgeStore = new MT5BridgeStore();
  const freshProvider = new MT5ProviderAdapter(freshBridgeStore);
  await freshBridgeStore.hydrateFromPersistence();
  assert.equal(
    freshBridgeStore.getMappings().XAUUSD,
    reconnectBrokerSymbol,
    "a fresh API instance should restore the discovered broker mapping",
  );
  for (const expected of persistenceQuoteSeed) {
    const restoredQuote = await freshProvider.getQuote(expected.canonicalSymbol);
    assert.ok(
      restoredQuote,
      `fresh API instance should restore the ${expected.canonicalSymbol} quote`,
    );
    assert.equal(restoredQuote.provider, "MT5");
    assert.equal(restoredQuote.providerSymbol, expected.brokerSymbol);
    assert.equal(restoredQuote.bid, expected.bid);
    assert.equal(restoredQuote.ask, expected.ask);
    assert.equal(restoredQuote.last, expected.last);
    assert.equal(restoredQuote.status, "LIVE");
    assert.equal(restoredQuote.dataState, "LIVE");
  }
  const freshQuoteHealth = await freshProvider.getHealth({
    canonicalSymbol: "XAUUSD",
    timeframe: "M15",
    strategyId: "DGV8",
    purpose: "QUOTE",
  });
  assert.equal(
    freshQuoteHealth.health,
    "HEALTHY",
    "a restored quote should be healthy after a fresh provider starts",
  );
  for (const symbol of persistedSymbols) {
    for (const definition of timeframeDefinitions) {
      const restored = await freshProvider.getCandles(
        "XAUUSD",
        definition.timeframe,
        definition.count,
        symbol,
      );
      assert.ok(
        restored,
        `fresh API instance should restore ${symbol} ${definition.timeframe} candles`,
      );
      assert.equal(restored.provider, "MT5");
      assert.equal(restored.dataState, "LIVE");
      assert.equal(restored.candles.length, definition.count);
      assert.equal(restored.candles.at(-1)?.close, persistenceSeedCloseBase + definition.count - 1);
    }
  }

  freshBridgeStore.setMapping("XAUUSD", persistedSymbols[0]);
  const freshHealth = await freshProvider.getHealth({
    canonicalSymbol: "XAUUSD",
    timeframe: "M15",
    strategyId: "DGV8",
    purpose: "STRATEGY",
  });
  assert.equal(
    freshHealth.health,
    "DEGRADED",
    "persisted M15 history without verified full-sync evidence must not be strategy trusted",
  );
  assert.equal(freshHealth.seriesReadiness?.fullSynchronizationComplete, false);
  assert.match(freshHealth.reasons.join(" "), /full m15 synchronization/i);

  const freshStoreInternals = freshBridgeStore as unknown as { lastHeartbeat: number };
  freshStoreInternals.lastHeartbeat = Date.now() - 61_000;
  const expiredQuoteHealth = await freshProvider.getHealth({
    canonicalSymbol: "XAUUSD",
    timeframe: "M15",
    strategyId: "DGV8",
    purpose: "QUOTE",
  });
  assert.equal(
    expiredQuoteHealth.health,
    "STALE",
    "an expired bridge heartbeat must fail closed for quote health",
  );
  assert.match(expiredQuoteHealth.reasons.join(" "), /heartbeat/i);
  const expiredHeartbeatHealth = await freshProvider.getHealth({
    canonicalSymbol: "XAUUSD",
    timeframe: "M15",
    strategyId: "DGV8",
    purpose: "STRATEGY",
  });
  assert.equal(
    expiredHeartbeatHealth.health,
    "STALE",
    "an expired bridge heartbeat must fail closed even when candles remain persisted",
  );
  assert.match(expiredHeartbeatHealth.reasons.join(" "), /heartbeat/i);

  const rejectedBeforeConcurrentWrites = freshBridgeStore.getStatus().rejectedCandleCount;
  const concurrentSymbol = `${PERSISTENCE_FIXTURE_MARKERS[0]}${Date.now()}_CONCURRENT`;
  const concurrentBase = Math.floor((Date.now() / 1000 + 14 * 24 * 3600) / 900) * 900;
  const normalizedConcurrentBase = mt5ServerWallTimeToUtc(concurrentBase);
  const concurrentStoreA = new MT5BridgeStore();
  const concurrentStoreB = new MT5BridgeStore();
  storesToFlush.push(concurrentStoreA, concurrentStoreB);
  const concurrentM15A = makeBrokerCandles(50, concurrentBase, 900, 12_000);
  const concurrentM15B = makeBrokerCandles(50, concurrentBase + 49 * 900, 900, 13_000);
  concurrentM15B[0] = makeBrokerCandles(1, concurrentBase + 49 * 900, 900, 13_500)[0];

  concurrentStoreA.updateHeartbeat({
    bridgeId: "concurrent-store-a",
    symbols: [concurrentSymbol],
    activeSymbols: [concurrentSymbol],
  });
  concurrentStoreB.updateHeartbeat({
    bridgeId: "concurrent-store-b",
    symbols: [concurrentSymbol],
    activeSymbols: [concurrentSymbol],
  });
  assert.equal(
    concurrentStoreA.updateCandles(
      concurrentSymbol,
      "M1",
      makeBrokerCandles(4, concurrentBase, 60, 12_100),
    ),
    4,
  );
  assert.equal(
    concurrentStoreB.updateCandles(
      concurrentSymbol,
      "M1",
      makeBrokerCandles(4, concurrentBase + 3 * 60, 60, 12_200),
    ),
    4,
  );
  assert.equal(
    concurrentStoreA.updateCandles(
      concurrentSymbol,
      "M5",
      makeBrokerCandles(4, concurrentBase, 300, 12_300),
    ),
    4,
  );
  assert.equal(
    concurrentStoreB.updateCandles(
      concurrentSymbol,
      "M5",
      makeBrokerCandles(4, concurrentBase + 3 * 300, 300, 12_400),
    ),
    4,
  );
  assert.equal(concurrentStoreA.updateCandles(concurrentSymbol, "M15", concurrentM15A, "FULL"), 50);
  assert.equal(concurrentStoreB.updateCandles(concurrentSymbol, "M15", concurrentM15B, "FULL"), 50);
  assert.equal(
    concurrentStoreA.updateCandles(concurrentSymbol, "M1", [
      { time: "bad", open: 0, high: 0, low: 0, close: 0 },
    ]),
    0,
  );
  assert.equal(
    concurrentStoreB.updateCandles(concurrentSymbol, "M5", [
      { time: "bad", open: 0, high: 0, low: 0, close: 0 },
    ]),
    0,
  );
  await Promise.all([concurrentStoreA.flushPersistence(), concurrentStoreB.flushPersistence()]);

  const concurrentPersistedStore = new MT5BridgeStore();
  for (const [timeframe, expectedTimes] of [
    ["M1", new Set([0, 1, 2, 3, 4, 5, 6].map((index) => normalizedConcurrentBase + index * 60))],
    ["M5", new Set([0, 1, 2, 3, 4, 5, 6].map((index) => normalizedConcurrentBase + index * 300))],
    [
      "M15",
      new Set(Array.from({ length: 99 }, (_, index) => normalizedConcurrentBase + index * 900)),
    ],
  ] as const) {
    const persisted = await concurrentPersistedStore.getCandlesForBrokerSymbolPersisted(
      concurrentSymbol,
      timeframe,
    );
    assert.ok(persisted, `concurrent ${timeframe} writes should be readable from a fresh store`);
    assert.deepEqual(new Set(persisted.map((candle) => candle.time)), expectedTimes);
    assert.equal(new Set(persisted.map((candle) => candle.time)).size, persisted.length);
  }
  assert.equal(
    (
      await concurrentPersistedStore.getCandlesForBrokerSymbolPersisted(concurrentSymbol, "M15")
    )?.find((candle) => candle.time === normalizedConcurrentBase + 49 * 900)?.close,
    13_500,
    "the duplicate M15 timestamp should resolve to the last row from its writer batch",
  );
  const concurrentStatus = concurrentPersistedStore.getStatus();
  assert.equal(
    concurrentStatus.rejectedCandleCount,
    rejectedBeforeConcurrentWrites + 2,
    "concurrent rejected batches must be counted without lost increments",
  );
  assert.equal(
    concurrentPersistedStore.isBackfillCompleted(),
    false,
    "concurrent FULL claims without verified session coverage must not survive as ready state",
  );

  for (const symbol of ["XAUUSD"]) {
    for (const definition of timeframeDefinitions.filter(({ timeframe }) => timeframe === "M15")) {
      const customerRead = await freshProvider.getCandles(
        symbol,
        definition.timeframe,
        definition.count,
        persistedSymbols[0],
      );
      assert.ok(
        customerRead,
        `customer candle reads should restore ${symbol} ${definition.timeframe} after an API restart`,
      );
      assert.equal(customerRead.provider, "MT5");
      assert.equal(customerRead.dataState, "LIVE");
      assert.equal(customerRead.candles.length, definition.count);
      assert.equal(
        customerRead.candles.at(-1)?.close,
        persistenceSeedCloseBase + definition.count - 1,
      );
    }
  }
} finally {
  await Promise.all(storesToFlush.map((store) => store.flushPersistence()));
  await clearPersistenceFixtureRows();
}
await mt5BridgeStore.reset();
assert.equal(
  mt5BridgeStore.isBackfillCompleted(),
  false,
  "a new process must require a fresh full sync",
);
assert.equal(
  marketCatalog.get("XAUUSD")?.brokerSpec,
  undefined,
  "a fresh bridge process must not reuse stale broker specifications",
);

const invalidScheduleUtcTime = Math.floor(Date.now() / 1000);
assert.equal(
  await mt5BridgeStore.updateSpecifications([
    {
      brokerSymbol: reconnectBrokerSymbol,
      tradingSessions: {
        source: "MT5_SYMBOL_INFO_SESSION_TRADE",
        complete: true,
        serverTime: invalidScheduleUtcTime + 10_800,
        utcTime: invalidScheduleUtcTime,
        sessions: [{ dayOfWeek: 7, fromSeconds: 0, toSeconds: 3_600 }],
      },
    },
  ]),
  1,
  "invalid session data must not discard an otherwise valid symbol specification",
);
assert.equal(
  marketCatalog.getCurrentBrokerTradingSessions("XAUUSD", reconnectBrokerSymbol),
  null,
  "malformed MT5 trading sessions must never become trusted validation metadata",
);
await mt5BridgeStore.reset();

const initialHealth = mt5BridgeStore.getStatus();
assert.equal(
  initialHealth.healthState,
  "CRITICAL",
  "a bridge without a heartbeat must be critical",
);
assert.match(initialHealth.healthReasons[0] ?? "", /heartbeat/i);
console.log("MT5 bridge reconnect checks passed.");
