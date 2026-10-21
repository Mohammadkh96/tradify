import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

// Use a generated fixture credential, never the workspace bridge credential.
const bridgeSecret = randomUUID();
process.env.MT5_BRIDGE_SECRET = bridgeSecret;
const { pool } = await import("@workspace/db");
const realNow = Date.now;
let server: ReturnType<(typeof import("./app"))["default"]["listen"]> | undefined;
let verifiedDisposableDatabase = false;

try {
  const { rows } = await pool.query("SELECT current_database() AS name");
  assert.match(
    rows[0].name,
    /^tradify_test_[a-z0-9_]+$/,
    "Bridge tests must run against a disposable tradify_test_ database",
  );
  verifiedDisposableDatabase = true;
  // Other suites may have left bridge history in this disposable database.
  await pool.query("TRUNCATE tradify_mt5_candles, tradify_mt5_bridge_state");
  const { default: app } = await import("./app");
  const { bridgeStore } = await import("./tradify-runtime");
  const { mt5BridgeStore } = await import("./zip-engine/market/providers/MT5BridgeStore");
  const { mt5ProviderAdapter } = await import("./zip-engine/market/providers/MT5ProviderAdapter");
  const { SeriesValidator } = await import("./zip-engine/market/SeriesValidator");

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server!.once("listening", resolve);
    server!.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function post(path: string, body: unknown) {
    const response = await fetch(`${baseUrl}/mt5/bridge/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-secret": bridgeSecret },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 200, `${path} should cross the authenticated bridge boundary`);
    const result = await response.json() as {
      ok: boolean;
      accepted?: number;
      isBackfilled?: boolean;
    };
    assert.equal(result.ok, true);
    return result;
  }

  // Independent fixture literals ensure changes to the production offset are caught.
  const brokerOffset = 10_800;
  const currentOpen = Math.floor(realNow() / 900_000) * 900;
  let nowMs = (currentOpen + 300) * 1000;
  Date.now = () => nowMs;
  const brokerSymbol = "USTEC.pro";
  const symbol = "US100";
  await post("heartbeat", {
    bridgeId: "broker-time-regression",
    connected: true,
    symbols: [brokerSymbol],
    activeSymbols: [brokerSymbol],
  });

  const specificationUtcTime = Math.floor(nowMs / 1000);
  await post("specs", {
    bridgeId: "broker-time-regression",
    specs: [{
      brokerSymbol,
      digits: 2,
      point: 0.01,
      profitCurrency: "USD",
      tradingSessions: {
        source: "MT5_SYMBOL_INFO_SESSION_TRADE",
        complete: true,
        serverTime: specificationUtcTime + brokerOffset,
        utcTime: specificationUtcTime,
        sessions: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          dayOfWeek,
          fromSeconds: 0,
          toSeconds: 86_400,
        })),
      },
    }],
  });
  const coverageRange = {
    endUtc: currentOpen + 900,
    startUtc: currentOpen + 900 - 10 * 86_400,
  };
  const fullHistory = Array.from({ length: 960 }, (_, index) => {
    const time = coverageRange.startUtc + index * 900;
    const close = 20_000 + index;
    return {
      time,
      open: close - 1,
      high: close + 2,
      low: close - 2,
      close,
      volume: 100,
    };
  });
  const expectedCandles = fullHistory.slice(-61);
  const serializeCandles = (
    candles: typeof expectedCandles,
    field: "time" | "timestamp" | "openTime" | "open_time",
    milliseconds: boolean,
    numericString: boolean,
  ) =>
    candles.map(({ time, ...ohlc }) => {
      const brokerTime = (time + brokerOffset) * (milliseconds ? 1000 : 1);
      return { ...ohlc, [field]: numericString ? String(brokerTime) : brokerTime };
    });
  const context = {
    canonicalSymbol: symbol,
    timeframe: "M15",
    strategyId: "BBB",
    purpose: "STRATEGY" as const,
  };

  for (const [field, milliseconds, numericString] of [
    ["time", false, false],
    ["timestamp", true, true],
    ["openTime", false, true],
    ["open_time", true, false],
  ] as const) {
    const utcQuoteTime = Math.floor(nowMs / 1000);
    const brokerQuoteTime = (utcQuoteTime + brokerOffset) * (milliseconds ? 1000 : 1);
    const quoteResult = await post("quotes", {
      quotes: [{
        symbol: brokerSymbol,
        bid: 20_060,
        ask: 20_062,
        last: 20_061,
        chartMode: "BID",
        time: numericString ? String(brokerQuoteTime) : brokerQuoteTime,
        timeMsc: (utcQuoteTime + brokerOffset) * 1000,
      }],
    });
    assert.equal(quoteResult.accepted, 1);
    const historyResult = await post("candles", {
      symbol: brokerSymbol,
      timeframe: "m15",
      syncMode: "PARTIAL",
      candles: serializeCandles(fullHistory.slice(0, -61), field, milliseconds, numericString),
    });
    assert.equal(historyResult.accepted, 899);
    const candleResult = await post("candles", {
      symbol: brokerSymbol,
      timeframe: "m15",
      syncMode: "FULL",
      coverageRange,
      candles: serializeCandles(expectedCandles, field, milliseconds, numericString),
    });
    assert.equal(candleResult.accepted, 61, `${field} should preserve the full batch`);
    assert.equal(candleResult.isBackfilled, true);
    assert.equal(mt5BridgeStore.getMappings()[symbol], brokerSymbol);

    const publicQuote = bridgeStore.getQuote(symbol)!;
    assert.equal(publicQuote.symbol, symbol);
    assert.equal(publicQuote.brokerSymbol, brokerSymbol);
    assert.equal(publicQuote.provider, "MT5");
    assert.equal(publicQuote.time, utcQuoteTime, "Quote broker time must become UTC seconds");
    assert.equal(publicQuote.receivedAt, nowMs);
    assert.equal(publicQuote.status, "LIVE");
    assert.equal(publicQuote.dataState, "LIVE");
    assert.equal(mt5BridgeStore.isQuoteFresh(brokerSymbol), true);
    const providerQuote = (await mt5ProviderAdapter.getQuote(symbol))!;
    assert.equal(providerQuote.timestamp, new Date(utcQuoteTime * 1000).toISOString());
    assert.equal(providerQuote.providerSymbol, brokerSymbol);
    assert.equal(providerQuote.dataState, "LIVE");

    const series = (await mt5ProviderAdapter.getCandles(symbol, "M15", 61))!;
    assert.equal(series.symbol, symbol);
    assert.equal(series.provider, "MT5");
    assert.equal(series.providerSymbol, brokerSymbol);
    assert.equal(series.timezone, "UTC");
    assert.equal(series.priceBasis, "BROKER");
    assert.equal(series.freshness, "LIVE");
    assert.equal(series.dataState, "LIVE");
    assert.deepEqual(series.candles, expectedCandles, `${field} must normalize exactly once`);
    assert.deepEqual(
      bridgeStore.getCandles(symbol, "M15").slice(-expectedCandles.length),
      expectedCandles,
    );
    assert.equal(mt5BridgeStore.isCandleFresh(brokerSymbol), true);
    const health = await mt5ProviderAdapter.getHealth(context);
    assert.equal(health.health, "HEALTHY");
    assert.equal(health.seriesReadiness?.freshnessValid, true);
    assert.equal(health.seriesReadiness?.fullSynchronizationComplete, true);
    const validation = SeriesValidator.validateM15Series(
      symbol, "MT5", brokerSymbol, series.candles, Math.floor(nowMs / 1000),
      { connected: true, health: health.health },
    );
    assert.equal(validation.valid, true);
    assert.deepEqual(validation.closedCandles, expectedCandles.slice(0, -1));
  }

  // Exact inclusive freshness boundary, then one millisecond beyond it.
  nowMs = (currentOpen + 1800) * 1000;
  assert.equal(mt5BridgeStore.isCandleFresh(brokerSymbol), true);
  assert.equal((await mt5ProviderAdapter.getCandles(symbol, "M15", 61))?.dataState, "LIVE");
  nowMs += 1;
  // A newly received old batch must not become LIVE merely because transport is healthy.
  const staleResult = await post("candles", {
    symbol: brokerSymbol,
    timeframe: "M15",
    syncMode: "FULL",
    candles: expectedCandles.map(({ time, ...ohlc }) => ({
      ...ohlc, time: time + brokerOffset,
    })),
  });
  assert.equal(staleResult.accepted, 61);
  assert.equal(mt5BridgeStore.getStatus().connected, true);
  assert.equal(mt5BridgeStore.isCandleFresh(brokerSymbol), false);
  const staleSeries = (await mt5ProviderAdapter.getCandles(symbol, "M15", 100))!;
  assert.equal(staleSeries.lastUpdated, currentOpen);
  assert.equal(staleSeries.dataState, "STALE");
  assert.equal(staleSeries.freshness, "STALE");
  const staleHealth = await mt5ProviderAdapter.getHealth(context);
  assert.equal(staleHealth.health, "STALE", "Stale history must be rejected for strategy readiness");
  assert.equal(staleHealth.seriesReadiness?.freshnessValid, false);
  assert.ok(staleHealth.reasons.some((reason) => reason.includes("stale")));
  console.log("MT5 broker-time HTTP checks passed: mapping, UTC, LIVE provenance, M15 validation, and stale boundary.");
} finally {
  Date.now = realNow;
  try {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()),
      );
    }
    if (verifiedDisposableDatabase) {
      await pool.query("TRUNCATE tradify_mt5_candles, tradify_mt5_bridge_state");
    }
  } finally {
    await pool.end();
  }
}
