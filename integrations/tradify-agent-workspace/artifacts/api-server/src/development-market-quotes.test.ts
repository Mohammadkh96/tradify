import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { developmentMarketDataOrigin } from "./market-data-proxy";

const upstreamOrigin = "https://market.example.test";
const originalFetch = globalThis.fetch;
const originalNodeEnv = process.env.NODE_ENV;
const originalUpstreamUrl = process.env.TRADIFY_MARKET_DATA_UPSTREAM_URL;

test("development quotes use the public live source without exposing it as a local bridge or trusted strategy feed", async () => {
  process.env.NODE_ENV = "development";
  process.env.TRADIFY_MARKET_DATA_UPSTREAM_URL = upstreamOrigin;
  assert.equal(developmentMarketDataOrigin(), upstreamOrigin);

  const { pool } = await import("@workspace/db");
  const { default: app } = await import("./app");
  const { updateCustomerState } = await import("./tradify-runtime");
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  let upstreamQuoteRequests = 0;
  try {
    const registrationResponse = await originalFetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `development-market-quotes-${Date.now()}@example.test`,
        password: "development-market-quotes-pass",
      }),
    });
    assert.equal(registrationResponse.status, 201);
    const registration = (await registrationResponse.json()) as {
      token: string;
      user: { id: string };
    };
    await updateCustomerState(registration.user.id, (user) => {
      user.profile.membership = "Pro";
    });
    const authHeaders = { authorization: `Bearer ${registration.token}` };

    globalThis.fetch = (async (input, init) => {
      const url = new URL(String(input));
      if (url.origin === new URL(baseUrl).origin) {
        return originalFetch(input, init);
      }
      if (url.origin === upstreamOrigin && url.pathname === "/api/market/candles") {
        const time = Math.floor(Date.now() / 1000) - 900;
        return new Response(
          JSON.stringify({
            symbol: "XAGUSD",
            timeframe: "M15",
            timezone: "UTC",
            dataState: "LIVE",
            displayOnly: false,
            candles: [{ time, open: 28, high: 28.4, low: 27.8, close: 28.2, volume: 12 }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.origin === upstreamOrigin && url.pathname === "/api/market/quotes") {
        upstreamQuoteRequests += 1;
        const price = 4128;
        return new Response(
          JSON.stringify({
            bridge: { connected: true, activeSymbols: ["USOIL"] },
            quotes: {
              USOIL: {
                symbol: "USOIL",
                bid: price - 0.1,
                ask: price + 0.1,
                last: price,
                price,
                displayPrice: price,
                strategyPrice: price,
                change: 0,
                changePercent: 0,
                time: Math.floor(Date.now() / 1000),
                receivedAt: Date.now(),
                status: "LIVE",
                dataState: "LIVE",
                provider: "PRIVATE_PROVIDER_DETAIL",
                brokerSymbol: "PRIVATE_BROKER_ALIAS",
                lastError: "PRIVATE_DIAGNOSTIC",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("unavailable", { status: 503 });
    }) as typeof fetch;

    const response = await fetch(`${baseUrl}/market/quotes`, { headers: authHeaders });
    assert.equal(response.status, 200);
    assert.equal(upstreamQuoteRequests, 1);
    const payload = (await response.json()) as {
      bridge: { connected: boolean };
      quotes: Record<string, Record<string, unknown>>;
    };
    assert.equal(payload.quotes.USOIL.price, 4128);
    assert.equal(payload.quotes.USOIL.dataState, "LIVE");
    assert.equal(payload.bridge.connected, false);
    assert.equal(Object.hasOwn(payload.quotes.USOIL, "provider"), false);
    assert.equal(Object.hasOwn(payload.quotes.USOIL, "brokerSymbol"), false);
    assert.equal(Object.hasOwn(payload.quotes.USOIL, "strategyPrice"), false);
    assert.equal(Object.hasOwn(payload.quotes.USOIL, "lastError"), false);

    const catalogResponse = await fetch(`${baseUrl}/markets/catalog`, { headers: authHeaders });
    assert.equal(catalogResponse.status, 200);
    const catalog = (await catalogResponse.json()) as Array<Record<string, unknown>>;
    const oil = catalog.find((item) => item.symbol === "USOIL");
    assert.equal(oil?.currentPrice, 4128);
    assert.equal(oil?.quoteState, "LIVE");

    const candlesResponse = await fetch(
      `${baseUrl}/market/candles?symbol=XAGUSD&timeframe=M15&limit=80`,
      { headers: authHeaders },
    );
    assert.equal(candlesResponse.status, 200);
    const candles = (await candlesResponse.json()) as {
      symbol: string;
      timeframe: string;
      dataState: string;
      displayOnly: boolean;
      candles: Array<{ close: number }>;
    };
    assert.equal(candles.symbol, "XAGUSD");
    assert.equal(candles.timeframe, "M15");
    assert.equal(candles.dataState, "FALLBACK");
    assert.equal(candles.displayOnly, true);
    assert.equal(candles.candles.at(-1)?.close, 28.2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalUpstreamUrl === undefined) delete process.env.TRADIFY_MARKET_DATA_UPSTREAM_URL;
    else process.env.TRADIFY_MARKET_DATA_UPSTREAM_URL = originalUpstreamUrl;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await pool.end();
  }
});
