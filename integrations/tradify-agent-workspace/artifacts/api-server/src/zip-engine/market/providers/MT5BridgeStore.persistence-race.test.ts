import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, tradifyMt5BridgeState, tradifyMt5Candles } from "@workspace/db";
import { MT5BridgeStore } from "./MT5BridgeStore";
import { marketCatalog } from "../MarketCatalog";

const fixtureSymbol = "xAuUsd.s";
const fixtureStateId = `TEST_MT5_PERSISTENCE_RACE_${Date.now()}`;

async function clearFixture(): Promise<void> {
  await db.delete(tradifyMt5Candles).where(eq(tradifyMt5Candles.brokerSymbol, fixtureSymbol));
  await db.delete(tradifyMt5BridgeState).where(eq(tradifyMt5BridgeState.id, fixtureStateId));
}

const storeA = new MT5BridgeStore(fixtureStateId);
const storeB = new MT5BridgeStore(fixtureStateId);
const refreshingStore = new MT5BridgeStore(fixtureStateId);

await clearFixture();
try {
  await Promise.all([
    storeA.hydrateFromPersistence(),
    storeB.hydrateFromPersistence(),
    refreshingStore.hydrateFromPersistence(),
  ]);

  storeA.setMapping("XAUUSD", fixtureSymbol);
  const specificationUtcTime = Math.floor(Date.now() / 1000);
  assert.equal(
    await storeA.updateSpecifications([
      {
        brokerSymbol: fixtureSymbol,
        tradeContractSize: 100,
        tradeTickSize: 0.01,
        tradeTickValue: 1,
        volumeMin: 0.01,
        volumeMax: 100,
        volumeStep: 0.01,
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
    ]),
    1,
    "a mapped MT5 specification should persist with its original receipt time",
  );
  marketCatalog.clearBrokerSpecifications();
  await refreshingStore.refreshBrokerSpecificationsFromPersistence(true);
  assert.ok(
    marketCatalog.getCurrentBrokerTradingSessions("XAUUSD", fixtureSymbol),
    "an already-hydrated API instance must load a fresh session schedule from shared state",
  );

  assert.equal(
    storeB.updateQuotes([
      {
        symbol: fixtureSymbol,
        bid: 2640.1,
        ask: 2640.6,
        last: 2640.3,
        chartMode: "BID",
        time: Math.floor(Date.now() / 1000) + 3 * 3600,
      },
    ]),
    1,
  );
  const staleQuote = storeB.getQuoteForBrokerSymbol(fixtureSymbol);
  assert.ok(staleQuote);
  staleQuote.receivedAt -= 60_000;
  await storeB.flushPersistence();

  storeA.setMapping("XAUUSD", fixtureSymbol);
  storeA.updateHeartbeat({
    bridgeId: "current-instance-a",
    server: "current-mt5-server",
    connected: true,
    symbols: [fixtureSymbol],
    activeSymbols: [fixtureSymbol],
    subscriptionVersion: 7,
  });
  assert.equal(
    storeA.updateQuotes([
      {
        symbol: fixtureSymbol,
        bid: 2650.1,
        ask: 2650.6,
        last: 2650.3,
        chartMode: "BID",
        time: Math.floor(Date.now() / 1000) + 3 * 3600,
      },
    ]),
    1,
  );
  await storeA.flushPersistence();
  const newestHeartbeat = storeA.getStatus().lastHeartbeat;
  assert.ok(newestHeartbeat > 0);

  // Both writes below intentionally carry B's stale local snapshot. The
  // direct heartbeat assignment models a delayed persistence callback without
  // depending on wall-clock scheduling.
  assert.equal(
    storeB.updateCandles(fixtureSymbol, "M1", [
      {
        time: Math.floor(Date.now() / 1000) + 3 * 3600,
        open: 120,
        high: 122,
        low: 119,
        close: 121,
        volume: 10,
      },
    ]),
    1,
  );
  const staleInternals = storeB as unknown as {
    connected: boolean;
    lastHeartbeat: number;
  };
  staleInternals.connected = false;
  staleInternals.lastHeartbeat = 0;
  await storeB.flushPersistence();

  storeB.updateHeartbeat({
    bridgeId: "stale-instance-b",
    connected: false,
  });
  staleInternals.lastHeartbeat = 0;
  await storeB.flushPersistence();

  const freshStore = new MT5BridgeStore(fixtureStateId);
  const freshQuote = await freshStore.getQuoteForBrokerSymbolPersisted("XAUUSD");
  assert.ok(freshQuote, "a fresh instance must retain a quote committed by another instance");
  assert.equal(freshQuote.bid, 2650.1);
  assert.equal(freshQuote.ask, 2650.6);
  assert.equal(freshQuote.last, 2650.3);
  assert.equal(freshQuote.receivedAt, newestHeartbeat);
  const freshStatus = freshStore.getStatus();
  assert.equal(
    freshStatus.connected,
    true,
    "a stale disconnected writer must not make the live bridge unusable",
  );
  assert.equal(freshStatus.bridgeId, "current-instance-a");
  assert.equal(freshStatus.server, "current-mt5-server");
  assert.deepEqual(freshStatus.availableSymbols, [fixtureSymbol]);
  assert.deepEqual(freshStatus.activeSymbols, [fixtureSymbol]);
  assert.equal(freshStatus.subscriptionVersion, 7);
  assert.equal(freshStatus.mappings.XAUUSD, fixtureSymbol);
  assert.equal(
    freshStatus.lastHeartbeat,
    newestHeartbeat,
    "a stale candle or heartbeat write must not move the shared heartbeat backwards",
  );
  assert.ok(
    marketCatalog.getCurrentBrokerTradingSessions("XAUUSD", fixtureSymbol),
    "stale state writes and a process restart must preserve the trusted schedule receipt",
  );
} finally {
  await Promise.all([
    storeA.flushPersistence(),
    storeB.flushPersistence(),
    refreshingStore.flushPersistence(),
  ]);
  await clearFixture();
}

console.log("MT5 bridge persistence race check passed.");
