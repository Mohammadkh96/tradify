import assert from "node:assert/strict";
import test from "node:test";
import type { Quote } from "./tradify-runtime";
import {
  fetchDevelopmentMarketCandles,
  developmentMarketDataOrigin,
  fetchDevelopmentMarketQuotes,
  mergeDevelopmentMarketQuotes,
} from "./market-data-proxy";

const liveQuote = (symbol: string, price: number) =>
  ({
    symbol,
    bid: price - 0.1,
    ask: price + 0.1,
    last: price,
    price,
    displayPrice: price,
    change: 0,
    changePercent: 0,
    time: Math.floor(Date.now() / 1000),
    receivedAt: Date.now(),
    status: "LIVE" as const,
    dataState: "LIVE" as const,
  }) as Quote;

test("development market upstream is enabled only for an explicit HTTPS origin", () => {
  assert.equal(
    developmentMarketDataOrigin({
      NODE_ENV: "development",
      TRADIFY_MARKET_DATA_UPSTREAM_URL: "https://market.example.com/",
    }),
    "https://market.example.com",
  );
  assert.equal(
    developmentMarketDataOrigin({
      NODE_ENV: "production",
      TRADIFY_MARKET_DATA_UPSTREAM_URL: "https://market.example.com",
    }),
    undefined,
  );
  assert.equal(
    developmentMarketDataOrigin({
      NODE_ENV: "development",
      TRADIFY_MARKET_DATA_UPSTREAM_URL: "http://market.example.com",
    }),
    undefined,
  );
  assert.equal(
    developmentMarketDataOrigin({
      NODE_ENV: "development",
      TRADIFY_MARKET_DATA_UPSTREAM_URL: "https://market.example.com/path",
    }),
    undefined,
  );
});

test("fetchDevelopmentMarketQuotes reads only the public live-quote endpoint", async () => {
  let requestedUrl = "";
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        quotes: { XAUUSD: liveQuote("XAUUSD", 4128) },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await fetchDevelopmentMarketQuotes(
    {
      NODE_ENV: "development",
      TRADIFY_MARKET_DATA_UPSTREAM_URL: "https://market.example.com",
    },
    fetcher,
  );

  assert.equal(requestedUrl, "https://market.example.com/api/market/quotes");
  assert.equal(result.kind, "available");
  if (result.kind === "available") {
    assert.equal(result.quotes.XAUUSD.price, 4128);
  }
});

test("fetchDevelopmentMarketCandles requests the selected symbol and timeframe and validates the returned series", async () => {
  let requestedUrl = "";
  const now = Math.floor(Date.now() / 1000);
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        symbol: "XAUUSD",
        timeframe: "M15",
        timezone: "UTC",
        dataState: "LIVE",
        displayOnly: false,
        candles: [
          { time: now - 900, open: 4100, high: 4110, low: 4090, close: 4105, volume: 12 },
          { time: now, open: 4105, high: 4120, low: 4100, close: 4115, volume: 18 },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await fetchDevelopmentMarketCandles(
    "XAUUSD",
    "M15",
    80,
    {
      NODE_ENV: "development",
      TRADIFY_MARKET_DATA_UPSTREAM_URL: "https://market.example.com",
    },
    fetcher,
  );

  assert.equal(
    requestedUrl,
    "https://market.example.com/api/market/candles?symbol=XAUUSD&timeframe=M15&limit=80",
  );
  assert.equal(result.kind, "available");
  if (result.kind === "available") {
    assert.equal(result.series.symbol, "XAUUSD");
    assert.equal(result.series.timeframe, "M15");
    assert.equal(result.series.sourceDataState, "LIVE");
    assert.equal(result.series.candles.length, 2);
  }
});

test("fetchDevelopmentMarketCandles rejects mismatched and malformed candle data", async () => {
  const fetcher: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        symbol: "EURUSD",
        timeframe: "H1",
        timezone: "UTC",
        dataState: "LIVE",
        candles: [{ time: 1, open: 10, high: 9, low: 8, close: 9, volume: 1 }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  const result = await fetchDevelopmentMarketCandles(
    "XAUUSD",
    "M15",
    80,
    {
      NODE_ENV: "development",
      TRADIFY_MARKET_DATA_UPSTREAM_URL: "https://market.example.com",
    },
    fetcher,
  );
  assert.equal(result.kind, "unavailable");
});

test("fetchDevelopmentMarketCandles cannot run outside development", async () => {
  let requested = false;
  const result = await fetchDevelopmentMarketCandles(
    "XAUUSD",
    "M15",
    80,
    {
      NODE_ENV: "production",
      TRADIFY_MARKET_DATA_UPSTREAM_URL: "https://market.example.com",
    },
    async () => {
      requested = true;
      return new Response("unexpected");
    },
  );
  assert.equal(result.kind, "disabled");
  assert.equal(requested, false);
});

test("mergeDevelopmentMarketQuotes prefers live upstream quotes but never replaces a live local quote", () => {
  const localStale = {
    ...liveQuote("XAUUSD", 4361.84),
    status: "STALE" as const,
    dataState: "STALE" as const,
  } as Quote;
  const localLive = liveQuote("EURUSD", 1.08);
  const upstreamGold = liveQuote("XAUUSD", 4128);
  const staleUpstream = {
    ...liveQuote("US100", 20_000),
    status: "STALE" as const,
    dataState: "STALE" as const,
  } as Quote;

  const merged = mergeDevelopmentMarketQuotes(
    { XAUUSD: localStale, EURUSD: localLive },
    { XAUUSD: upstreamGold, EURUSD: liveQuote("EURUSD", 1.09), US100: staleUpstream },
  );

  assert.equal(merged.XAUUSD.price, 4128);
  assert.equal(merged.EURUSD.price, 1.08);
  assert.equal(merged.US100, undefined);
});

test("mergeDevelopmentMarketQuotes rejects upstream quotes without a fresh receipt timestamp", () => {
  const local = liveQuote("XAUUSD", 4100);
  const expiredUpstream = {
    ...liveQuote("XAUUSD", 4128),
    receivedAt: Date.now() - 30_001,
  };

  const merged = mergeDevelopmentMarketQuotes(
    { XAUUSD: local },
    { XAUUSD: expiredUpstream as Quote },
  );

  assert.equal(merged.XAUUSD.price, 4100);
});

test("upstream errors fail closed and preserve local quote data", async () => {
  const local = liveQuote("XAUUSD", 4100);
  const fetcher: typeof fetch = async () => new Response("unavailable", { status: 503 });
  const result = await fetchDevelopmentMarketQuotes(
    {
      NODE_ENV: "development",
      TRADIFY_MARKET_DATA_UPSTREAM_URL: "https://market.example.com",
    },
    fetcher,
  );

  assert.equal(result.kind, "unavailable");
  assert.equal(mergeDevelopmentMarketQuotes({ XAUUSD: local }, {}).XAUUSD.price, 4100);
});
