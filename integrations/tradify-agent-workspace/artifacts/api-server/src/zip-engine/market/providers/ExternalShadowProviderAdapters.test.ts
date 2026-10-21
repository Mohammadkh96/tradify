import assert from "node:assert/strict";
import { massiveShadowProvider, twelveDataShadowProvider } from "./ExternalShadowProviderAdapters";
import { ProviderRegistry } from "../ProviderRegistry";
import type { MarketDataContext } from "../types";

const originalFetch = globalThis.fetch;
const originalTwelveKey = process.env.TWELVE_DATA_API_KEY;
const originalMassiveKey = process.env.MASSIVE_API_KEY;
const now = Date.now();
const alignedNow = Math.floor(now / 900_000) * 900_000;
const capturedRequests: Array<{ url: string; authorization: string | null }> = [];

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function m15Values() {
  return Array.from({ length: 100 }, (_, index) => {
    const time = new Date(alignedNow - (99 - index) * 900_000)
      .toISOString()
      .slice(0, 16)
      .replace("T", " ");
    return {
      datetime: time,
      open: "100",
      high: "101",
      low: "99",
      close: "100.5",
      volume: "1",
    };
  });
}

try {
  process.env.TWELVE_DATA_API_KEY = "test-twelve-key";
  process.env.MASSIVE_API_KEY = "test-massive-key";

  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    capturedRequests.push({
      url,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    if (url.includes("api.twelvedata.com")) {
      if (url.includes("/quote")) {
        return response({
          symbol: "EUR/USD",
          close: "1.1625",
          last_quote_at: Math.floor(now / 1000),
          datetime: "2026-09-10",
          is_market_open: true,
        });
      }
      return response({ values: m15Values() });
    }
    return response({
      status: "OK",
      results: [
        {
          T: "X:BTCUSD",
          c: 65000,
          o: 64000,
          h: 65500,
          l: 63500,
          t: Math.floor((now - 60_000) / 1000) * 1000,
        },
      ],
    });
  }) as typeof fetch;

  const twelveQuote = await twelveDataShadowProvider.getQuote("EURUSD");
  assert.ok(twelveQuote);
  assert.equal(twelveQuote.providerSymbol, "EUR/USD");
  assert.equal(twelveQuote.instrumentType, "SPOT");
  assert.equal(twelveQuote.status, "LIVE");
  assert.equal(
    capturedRequests.find((request) => request.url.includes("api.twelvedata.com/quote"))
      ?.authorization,
    "apikey test-twelve-key",
  );
  assert.equal(
    capturedRequests
      .find((request) => request.url.includes("api.twelvedata.com/quote"))
      ?.url.includes("test-twelve-key"),
    false,
  );

  const twelveCandles = await twelveDataShadowProvider.getCandles("EURUSD", "M15", 100);
  assert.ok(twelveCandles);
  assert.equal(twelveCandles.providerSymbol, "EUR/USD");
  assert.equal(twelveCandles.candles.length, 100);
  assert.equal(twelveCandles.timezone, "UTC");
  assert.ok(twelveCandles.candles.every((candle) => candle.time % 900 === 0));
  const twelveSeriesRequest = capturedRequests.find((request) =>
    request.url.includes("api.twelvedata.com/time_series"),
  );
  assert.equal(twelveSeriesRequest?.authorization, "apikey test-twelve-key");
  assert.equal(twelveSeriesRequest?.url.includes("test-twelve-key"), false);
  const requestsBeforeCoalescing = twelveDataShadowProvider.getMetrics().requestCount;
  const [coalescedFirst, coalescedSecond] = await Promise.all([
    twelveDataShadowProvider.getCandles("GBPUSD", "M15", 100, undefined, {
      caller: "readiness",
      reason: "coalescing test",
    }),
    twelveDataShadowProvider.getCandles("GBPUSD", "M15", 100, undefined, {
      caller: "strategy-evaluation",
      reason: "coalescing test",
    }),
  ]);
  assert.ok(coalescedFirst);
  assert.ok(coalescedSecond);
  const twelveMetrics = twelveDataShadowProvider.getMetrics();
  assert.equal(twelveMetrics.requestCount - requestsBeforeCoalescing, 1);
  assert.ok(twelveMetrics.cacheHitCount >= 1);
  assert.ok(
    twelveMetrics.requestAudit?.some(
      (entry) => entry.caller === "readiness" && entry.cache === "MISS",
    ),
  );
  assert.ok(
    twelveMetrics.requestAudit?.some(
      (entry) => entry.caller === "strategy-evaluation" && entry.cache === "HIT",
    ),
  );
  assert.equal(
    JSON.stringify(twelveMetrics).includes("test-twelve-key"),
    false,
    "provider request diagnostics must not expose the configured key",
  );
  assert.equal(await twelveDataShadowProvider.getQuote("XAGUSD"), null);
  assert.equal(await twelveDataShadowProvider.getCandles("EURUSD", "H1", 100), null);

  const massiveQuote = await massiveShadowProvider.getQuote("BTCUSD");
  assert.ok(massiveQuote);
  assert.equal(massiveQuote.providerSymbol, "X:BTCUSD");
  assert.equal(massiveQuote.status, "DELAYED");
  const massiveRequest = capturedRequests.find((request) =>
    request.url.includes("api.massive.com"),
  );
  assert.equal(massiveRequest?.authorization, "Bearer test-massive-key");
  assert.equal(massiveRequest?.url.includes("test-massive-key"), false);
  assert.equal(
    JSON.stringify(massiveShadowProvider.getMetrics()).includes("test-massive-key"),
    false,
    "Massive request diagnostics must not expose the configured key",
  );
  assert.equal(await massiveShadowProvider.getCandles("BTCUSD", "M15", 100), null);
  const massiveDaily = await massiveShadowProvider.getCandles("BTCUSD", "D1", 1);
  assert.ok(massiveDaily);
  assert.equal(massiveDaily.timeframe, "D1");

  const registry = new ProviderRegistry(
    { failoverAfterMs: 0, alternateStableMs: 0, primaryRecoveryMs: 0 },
    async () => undefined,
    async () => null,
    async () => undefined,
  );
  const context: MarketDataContext = {
    canonicalSymbol: "EURUSD",
    timeframe: "M15",
    strategyId: "DGV8",
    purpose: "STRATEGY",
  };
  registry.register({
    id: "MASSIVE",
    displayName: "Massive",
    provider: massiveShadowProvider,
    role: "SHADOW",
    approval: "NOT_APPROVED",
    priority: 30,
    enabled: true,
  });
  registry.register({
    id: "TWELVE_DATA",
    displayName: "Twelve Data",
    provider: twelveDataShadowProvider,
    role: "SHADOW",
    approval: "NOT_APPROVED",
    priority: 31,
    enabled: true,
  });
  const candidates = await registry.getCandidates(context);
  assert.equal(candidates.find((candidate) => candidate.providerId === "MASSIVE")?.eligible, false);
  assert.equal(
    candidates.find((candidate) => candidate.providerId === "TWELVE_DATA")?.eligible,
    false,
  );
  assert.equal((await registry.resolveAuthority(context)).selectedProviderId, null);

  globalThis.fetch = (async () =>
    response(
      {
        message: "rate limited at https://feeds.example.invalid/quote?apikey=test-twelve-key",
        "api-credits-left": 0,
      },
      429,
    )) as typeof fetch;
  const rateLimitStart = twelveDataShadowProvider.getMetrics().requestCount;
  assert.equal(
    await twelveDataShadowProvider.getCandles("XAUUSD", "M15", 100, undefined, {
      caller: "provider-health",
      reason: "429 backoff test",
    }),
    null,
  );
  const afterRateLimit = twelveDataShadowProvider.getMetrics();
  assert.equal(
    JSON.stringify(afterRateLimit).includes("test-twelve-key"),
    false,
    "provider health metrics must redact credentials echoed by error messages",
  );
  assert.equal(afterRateLimit.requestCount - rateLimitStart, 1);
  assert.equal(afterRateLimit.rateLimitEvents >= 1, true);
  assert.equal(
    await twelveDataShadowProvider.getCandles("BTCUSD", "M15", 100, undefined, {
      caller: "readiness",
      reason: "429 backoff test",
    }),
    null,
  );
  assert.equal(twelveDataShadowProvider.getMetrics().requestCount, rateLimitStart + 1);
  const rateLimitedHealth = await twelveDataShadowProvider.getHealth({
    canonicalSymbol: "BTCUSD",
    timeframe: "M15",
    strategyId: "DGV8",
    purpose: "STRATEGY",
  });
  assert.equal(rateLimitedHealth.health, "DEGRADED");
} finally {
  globalThis.fetch = originalFetch;
  if (originalTwelveKey === undefined) delete process.env.TWELVE_DATA_API_KEY;
  else process.env.TWELVE_DATA_API_KEY = originalTwelveKey;
  if (originalMassiveKey === undefined) delete process.env.MASSIVE_API_KEY;
  else process.env.MASSIVE_API_KEY = originalMassiveKey;
}

console.log(
  "External shadow provider checks passed: verified mappings, M15 normalization, EOD-only Massive, and authority exclusion.",
);
