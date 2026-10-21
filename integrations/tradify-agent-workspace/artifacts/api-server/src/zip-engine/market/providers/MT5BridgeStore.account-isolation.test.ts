import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import { db, tradifyMt5BridgeState, tradifyMt5Candles } from "@workspace/db";
import { MT5BridgeStore, mt5BridgeStore } from "./MT5BridgeStore";

assert.match(process.env.PGDATABASE ?? "", /^tradify_test_/);

const marker = `CUSTOMER_FEED_ISOLATION_${Date.now()}`;
const scopeA = `CUSTOMER:${marker}:A`;
const scopeB = `CUSTOMER:${marker}:B`;
const brokerSymbol = "XAUUSD.s";
const candleTime = Math.floor(Date.now() / 300_000) * 300;

async function clearFixture(): Promise<void> {
  await db
    .delete(tradifyMt5Candles)
    .where(
      and(
        inArray(tradifyMt5Candles.scopeId, [scopeA, scopeB]),
        eq(tradifyMt5Candles.brokerSymbol, brokerSymbol),
      ),
    );
  await db
    .delete(tradifyMt5BridgeState)
    .where(inArray(tradifyMt5BridgeState.id, [scopeA, scopeB]));
}

const accountA = new MT5BridgeStore(scopeA);
const accountB = new MT5BridgeStore(scopeB);

await clearFixture();
try {
  await Promise.all([
    accountA.hydrateFromPersistence(),
    accountB.hydrateFromPersistence(),
    mt5BridgeStore.hydrateFromPersistence(),
  ]);
  accountA.setMapping("XAUUSD", brokerSymbol);
  accountB.setMapping("XAUUSD", brokerSymbol);

  accountA.updateHeartbeat({
    bridgeId: "same-untrusted-label",
    connected: true,
    symbols: [brokerSymbol],
    activeSymbols: [brokerSymbol],
  });
  accountB.updateHeartbeat({
    bridgeId: "same-untrusted-label",
    connected: true,
    symbols: [brokerSymbol],
    activeSymbols: [brokerSymbol],
  });

  assert.equal(
    accountA.updateQuotes([
      { symbol: brokerSymbol, bid: 2300, ask: 2301, last: 2300.5, time: candleTime },
    ]),
    1,
  );
  assert.equal(
    accountB.updateQuotes([
      { symbol: brokerSymbol, bid: 2400, ask: 2401, last: 2400.5, time: candleTime },
    ]),
    1,
  );

  assert.equal(
    accountA.updateCandles(brokerSymbol, "M5", [
      { time: candleTime, open: 2300, high: 2302, low: 2299, close: 2301, volume: 11 },
    ]),
    1,
  );
  assert.equal(
    accountB.updateCandles(brokerSymbol, "M5", [
      { time: candleTime, open: 2400, high: 2402, low: 2399, close: 2401, volume: 22 },
    ]),
    1,
  );
  await Promise.all([accountA.flushPersistence(), accountB.flushPersistence()]);

  const [quoteA, quoteB, candlesA, candlesB] = await Promise.all([
    accountA.getQuoteForBrokerSymbolPersisted(brokerSymbol),
    accountB.getQuoteForBrokerSymbolPersisted(brokerSymbol),
    accountA.getCandlesForBrokerSymbolPersisted(brokerSymbol, "M5"),
    accountB.getCandlesForBrokerSymbolPersisted(brokerSymbol, "M5"),
  ]);
  assert.equal(quoteA?.bid, 2300);
  assert.equal(quoteB?.bid, 2400);
  assert.equal(candlesA?.[0]?.close, 2301);
  assert.equal(candlesB?.[0]?.close, 2401);

  const restartedA = new MT5BridgeStore(scopeA);
  const restartedB = new MT5BridgeStore(scopeB);
  await Promise.all([restartedA.hydrateFromPersistence(), restartedB.hydrateFromPersistence()]);
  assert.equal((await restartedA.getQuoteForBrokerSymbolPersisted(brokerSymbol))?.bid, 2300);
  assert.equal((await restartedB.getQuoteForBrokerSymbolPersisted(brokerSymbol))?.bid, 2400);
  assert.equal(
    (await restartedA.getCandlesForBrokerSymbolPersisted(brokerSymbol, "M5"))?.[0]?.close,
    2301,
  );
  assert.equal(
    (await restartedB.getCandlesForBrokerSymbolPersisted(brokerSymbol, "M5"))?.[0]?.close,
    2401,
  );

  const storedRows = await db
    .select()
    .from(tradifyMt5Candles)
    .where(
      and(
        inArray(tradifyMt5Candles.scopeId, [scopeA, scopeB]),
        eq(tradifyMt5Candles.brokerSymbol, brokerSymbol),
      ),
    );
  assert.equal(storedRows.length, 2, "identical broker symbol/time keys must coexist by account");
  assert.deepEqual(new Set(storedRows.map((row) => row.scopeId)), new Set([scopeA, scopeB]));

  const primaryQuote = await mt5BridgeStore.getQuoteForBrokerSymbolPersisted(brokerSymbol);
  const primaryCandles = await mt5BridgeStore.getCandlesForBrokerSymbolPersisted(
    brokerSymbol,
    "M5",
  );
  assert.equal(primaryQuote, null, "customer quotes must never appear in the reference feed");
  assert.equal(primaryCandles, null, "customer candles must never appear in the reference feed");
} finally {
  await Promise.all([accountA.flushPersistence(), accountB.flushPersistence()]);
  await clearFixture();
}

console.log("MT5 customer feed isolation check passed.");
