import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { pool } from "@workspace/db";

// Fail before importing the application (which initializes persisted state).
assert.match(process.env.PGDATABASE ?? "", /^tradify_test_\d+_[a-f0-9]+$/);
assert.equal(new URL(process.env.DATABASE_URL!).pathname, `/${process.env.PGDATABASE}`);
assert.equal(process.env.NODE_ENV, "development");

const { default: app } = await import("./app");
const { bridgeStore, getCandles, updateCustomerState } = await import("./tradify-runtime");
const { GetMarketCandlesResponse, RegisterResponse } = await import("@workspace/api-zod");
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
const originalFetch = globalThis.fetch;
let providerRequests = 0;
const start = Math.floor(Date.now() / 1000 / 900) * 900 - 59 * 900;
const candles = Array.from({ length: 60 }, (_, index) => ({
  time: start + index * 900,
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index,
  volume: 10 + index,
}));

async function request(path: string, token?: string, body?: object) {
  const response = await originalFetch(`${baseUrl}${path}`, {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  return { response, body: await response.json() };
}

function assertSeries(
  result: Awaited<ReturnType<typeof request>>,
  symbol: string,
  timeframe: string,
  state: "LIVE" | "FALLBACK",
) {
  assert.equal(result.response.status, 200);
  assert.match(result.response.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(result.response.headers.get("cache-control"), "no-store");
  const series = GetMarketCandlesResponse.strict().parse(result.body);
  assert.equal(series.symbol, symbol);
  assert.equal(series.timeframe, timeframe);
  assert.equal(series.timezone, "UTC");
  assert.equal(series.dataState, state);
  assert.equal(series.displayOnly, state === "FALLBACK");
  assert.equal(series.validation.valid, state === "LIVE");
  assert.equal(series.validation.candleCount, series.candles.length);
  assert.equal(series.count, series.candles.length);
  assert.equal(series.firstTime, series.candles[0].time);
  const lastCandle = series.candles.at(-1);
  assert.ok(lastCandle);
  assert.equal(series.lastTime, lastCandle.time);
  assert.equal(series.count, 60);
  for (const key of ["provider", "providerSymbol", "provenance"]) {
    assert.equal(Object.hasOwn(result.body as object, key), false, `${key} must remain internal`);
  }
  for (const [index, candle] of series.candles.entries()) {
    for (const key of ["time", "open", "high", "low", "close", "volume"] as const) {
      assert.equal(Number.isFinite(candle[key]), true, `candle ${index}.${key}`);
    }
    if (index > 0) assert.ok(candle.time > series.candles[index - 1].time);
    assert.ok(candle.high >= Math.max(candle.open, candle.close));
    assert.ok(candle.low <= Math.min(candle.open, candle.close));
  }
  return series;
}

function assertError(
  result: Awaited<ReturnType<typeof request>>,
  status: number,
  error: string,
  timeframe: string,
) {
  assert.equal(result.response.status, status);
  const { message, requestId, ...details } = result.body as Record<string, unknown>;
  assert.ok(typeof message === "string");
  assert.ok(message.length > 0);
  assert.ok(requestId != null);
  assert.deepEqual(details, {
    error, dataState: "ERROR", displayOnly: false, symbol: "XAUUSD", timeframe,
  });
}

try {
  // No real provider HTTP calls; only Yahoo has a deterministic reference series.
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.startsWith(baseUrl)) return originalFetch(input, init);
    providerRequests++;
    if (url.includes("finance/chart/") && url.includes("%5ENDX")) {
      return new Response(JSON.stringify({
        chart: { result: [{
          timestamp: candles.map((bar) => bar.time),
          indicators: { quote: [{
            open: candles.map((bar) => bar.open),
            high: candles.map((bar) => bar.high),
            low: candles.map((bar) => bar.low),
            close: candles.map((bar) => bar.close),
            volume: candles.map((bar) => bar.volume),
          }] },
        }] },
      }));
    }
    return new Response("{}", { status: 503 });
  }) as typeof fetch;

  const signup = await request("/auth/register", undefined, {
    email: `chart-contract-${process.pid}@example.test`,
    password: "chart-contract-test-password",
  });
  assert.equal(signup.response.status, 201);
  const registered = RegisterResponse.parse(signup.body);
  const token = registered.token;
  await updateCustomerState(registered.user.id, (user) => {
    user.profile.membership = "Pro";
    user.membershipSource = "REVENUECAT";
    user.subscriptionStatus = "ACTIVE";
  });

  const invalid = await request("/market/candles?symbol=XAUUSD&timeframe=M2", token);
  assertError(invalid, 400, "INVALID_TIMEFRAME", "M2");
  assert.equal(providerRequests, 0, "invalid timeframe must not query providers");

  const unavailable = await request("/market/candles?symbol=XAUUSD&timeframe=M15", token);
  assertError(unavailable, 404, "NO_CANDLE_DATA", "M15");

  bridgeStore.updateHeartbeat({
    bridgeId: "chart-contract-test", server: "test", connected: true,
    symbols: ["XAUUSD"], activeSymbols: ["XAUUSD"],
  });
  bridgeStore.updateCandles({
    symbol: "XAUUSD", timeframe: "M15",
    candles: candles.map(({ time, ...bar }) => ({
      ...bar, timestamp: String(time + 3 * 3600),
    })),
  });
  const internalLive = await getCandles("XAUUSD", "M15", 60);
  assert.ok(internalLive);
  assert.equal(internalLive.provider, "MT5");
  assert.equal(typeof internalLive.providerSymbol, "string");
  assert.ok(internalLive.providerSymbol.length > 0);
  assertSeries(await request("/market/candles?symbol=XAUUSD&limit=60", token), "XAUUSD", "M15", "LIVE");
  assertSeries(await request("/market/candles?symbol=XAUUSD&interval=15m&limit=60", token), "XAUUSD", "M15", "LIVE");

  const fallback = await request("/market/candles?symbol=US100&timeframe=M15&limit=60", token);
  const series = assertSeries(fallback, "US100", "M15", "FALLBACK");
  assert.equal(series.validation.reason, "Reference data is display-only.");
  assert.deepEqual(series.candles, candles);
  const internalFallback = await getCandles("US100", "M15", 60);
  assert.ok(internalFallback);
  assert.equal(internalFallback.provider, "Yahoo");
  assert.equal(internalFallback.providerSymbol, "^NDX");
  console.log("Chart HTTP contract checks passed: live, aliases/defaults, invalid timeframe, unavailable source, and fallback.");
} finally {
  globalThis.fetch = originalFetch;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
  await pool.end();
}
