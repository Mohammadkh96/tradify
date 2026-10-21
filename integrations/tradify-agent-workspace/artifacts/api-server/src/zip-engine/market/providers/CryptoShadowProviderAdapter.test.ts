import assert from "node:assert/strict";
import { binanceShadowProvider, coinbaseShadowProvider } from "./CryptoShadowProviderAdapter";
import { ProviderRegistry } from "../ProviderRegistry";
import type { MarketDataContext } from "../types";

const originalFetch = globalThis.fetch;
const nowSeconds = Math.floor(Date.now() / 1000);
const alignedNowSeconds = Math.floor(nowSeconds / 900) * 900;

function response(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

try {
  let binanceRequests = 0;
  let coinbaseRequests = 0;
  let failRequestsRemaining = 0;
  let rateLimitNextRequest = false;
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    if (failRequestsRemaining > 0) {
      failRequestsRemaining -= 1;
      throw new Error("simulated public API disconnect");
    }
    if (rateLimitNextRequest) {
      rateLimitNextRequest = false;
      return response({ code: -1003, msg: "Too many requests" }, 429);
    }
    if (url.includes("data-api.binance.vision")) {
      binanceRequests += 1;
      if (url.includes("ticker")) {
        return response({
          symbol: "BTCUSDT",
          lastPrice: "65000",
          bidPrice: "64999",
          askPrice: "65001",
          closeTime: Date.now(),
        });
      }
      return response(
        Array.from({ length: 80 }, (_, index) => [
          (alignedNowSeconds - (79 - index) * 900) * 1000,
          "64900",
          "65100",
          "64800",
          "65000",
          "10",
        ]),
      );
    }
    coinbaseRequests += 1;
    if (url.includes("/ticker")) {
      return response({
        product_id: "BTC-USD",
        price: "65010",
        bid: "65009",
        ask: "65011",
        time: new Date().toISOString(),
      });
    }
    return response(
      Array.from({ length: 80 }, (_, index) => [
        alignedNowSeconds - (79 - index) * 900,
        64800,
        65100,
        64900,
        65000,
        10,
      ]).reverse(),
    );
  }) as typeof fetch;

  const binanceQuote = await binanceShadowProvider.getQuote("BTCUSD");
  assert.ok(binanceQuote);
  assert.equal(binanceQuote.providerSymbol, "BTCUSDT");
  assert.equal(binanceQuote.priceBasis, "USDT");
  assert.equal(binanceQuote.status, "LIVE");
  const binanceCandles = await binanceShadowProvider.getCandles("BTCUSD", "M15", 80);
  assert.ok(binanceCandles);
  assert.equal(binanceCandles.providerSymbol, "BTCUSDT");
  assert.equal(binanceCandles.timezone, "UTC");
  assert.equal(binanceCandles.candles.length, 80);
  assert.ok(binanceCandles.candles.every((candle) => candle.time % 900 === 0));

  const coinbaseQuote = await coinbaseShadowProvider.getQuote("ETHUSD");
  assert.ok(coinbaseQuote);
  assert.equal(coinbaseQuote.providerSymbol, "ETH-USD");
  assert.equal(coinbaseQuote.priceBasis, "USD");
  const coinbaseCandles = await coinbaseShadowProvider.getCandles("ETHUSD", "M15", 80);
  assert.ok(coinbaseCandles);
  assert.equal(coinbaseCandles.providerSymbol, "ETH-USD");
  assert.equal(coinbaseCandles.isEquivalentInstrument, true);
  assert.ok(coinbaseCandles.candles.every((candle) => candle.time % 900 === 0));
  assert.ok(binanceRequests > 0 && coinbaseRequests > 0);

  const beforeRecovery = binanceShadowProvider.getMetrics();
  failRequestsRemaining = 2;
  assert.equal(await binanceShadowProvider.getQuote("BTCUSD"), null);
  rateLimitNextRequest = true;
  assert.equal(await binanceShadowProvider.getQuote("BTCUSD"), null);
  const recovered = await binanceShadowProvider.getQuote("BTCUSD");
  assert.ok(recovered);
  const afterRecovery = binanceShadowProvider.getMetrics();
  assert.equal(afterRecovery.errorCount, beforeRecovery.errorCount + 2);
  assert.equal(afterRecovery.rateLimitEvents, beforeRecovery.rateLimitEvents + 1);
  assert.equal(afterRecovery.reconnectCount, beforeRecovery.reconnectCount + 1);

  const registry = new ProviderRegistry(
    { failoverAfterMs: 0, alternateStableMs: 0, primaryRecoveryMs: 0 },
    async () => undefined,
    async () => null,
    async () => undefined,
  );
  registry.register({
    id: "PRIMARY_MT5",
    displayName: "MT5",
    provider: {
      name: "MT5",
      supportsSymbol: () => true,
      getQuote: async () => null,
      getCandles: async () => null,
      getHealth: async () => ({
        health: "UNAVAILABLE",
        reasons: ["offline"],
        observedAt: Date.now(),
      }),
    },
    role: "PRIMARY",
    approval: "APPROVED",
    priority: 0,
    enabled: true,
  });
  registry.register({
    id: "SHADOW_BINANCE",
    displayName: "Binance",
    provider: binanceShadowProvider,
    role: "SHADOW",
    approval: "NOT_APPROVED",
    priority: 20,
    enabled: true,
  });
  registry.register({
    id: "SHADOW_COINBASE",
    displayName: "Coinbase",
    provider: coinbaseShadowProvider,
    role: "SHADOW",
    approval: "NOT_APPROVED",
    priority: 21,
    enabled: true,
  });
  const context: MarketDataContext = {
    canonicalSymbol: "BTCUSD",
    timeframe: "M15",
    strategyId: "DGV8",
    purpose: "STRATEGY",
  };
  const decision = await registry.resolveAuthority(context);
  assert.equal(decision.selectedProviderId, null);
  const candidates = await registry.getCandidates(context);
  assert.equal(
    candidates.find((candidate) => candidate.providerId === "SHADOW_BINANCE")?.eligible,
    false,
  );
  assert.equal(
    candidates.find((candidate) => candidate.providerId === "SHADOW_COINBASE")?.eligible,
    false,
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Crypto shadow provider checks passed: provenance, UTC M15, and authority exclusion.");
