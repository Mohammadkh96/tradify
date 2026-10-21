import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  tradifyMt5BridgeState,
  tradifyMt5Candles,
  tradifyMt5CustomerFeeds,
  tradifyEvaluationHistory,
  tradifyGeneratedSignals,
  tradifyProductLinks,
} from "@workspace/db";
import app from "./app";
import { MT5BridgeStore } from "./zip-engine/market/providers/MT5BridgeStore";

assert.match(process.env.PGDATABASE ?? "", /^tradify_test_/);

const suffix = crypto.randomUUID();
const brokerSymbol = "XAUUSD.s";
const userAEmail = `mt5-feed-a-${suffix}@example.test`;
const userBEmail = `mt5-feed-b-${suffix}@example.test`;
const password = "feed-isolation-test-password";
let tokenA = crypto.randomBytes(32).toString("base64url");
const tokenB = crypto.randomBytes(32).toString("base64url");
const linkIdA = crypto.randomUUID();
const linkIdB = crypto.randomUUID();
let feedIdA: string = crypto.randomUUID();
const feedIdB = crypto.randomUUID();
let scopeA = `CUSTOMER:${feedIdA}`;
const scopeB = `CUSTOMER:${feedIdB}`;
const candleTime = Math.floor(Date.now() / 900_000) * 900;

async function request(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json() as Record<string, unknown>;
  return { status: response.status, body };
}

function jsonHeaders(token?: string) {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function register(baseUrl: string, email: string): Promise<{ token: string; userId: string }> {
  const result = await request(baseUrl, "/auth/register", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  assert.equal(result.status, 201);
  return {
    token: String(result.body.token),
    userId: String((result.body.user as { id: string }).id),
  };
}

async function addGrant(input: {
  userId: string;
  feedId: string;
  linkId: string;
  token: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(tradifyProductLinks).values({
    linkId: input.linkId,
    userId: input.userId,
    partnerIssuer: "https://journal.example.test",
    signalsAttemptLabel: "SIG-7M4PK9D2W3QF",
    journalAttemptLabel: "JRN-6P7TR2K5M7WX",
    state: "active",
    linkedAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(tradifyMt5CustomerFeeds).values({
    userId: input.userId,
    feedId: input.feedId,
    linkId: input.linkId,
    tokenHash: crypto.createHash("sha256").update(input.token, "utf8").digest("hex"),
    consentVersion: "tradify-journal-mt5-feed-consent-v1",
    consentedAt: now,
    revokedAt: null,
    updatedAt: now,
  });
}

const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

try {
  const [userA, userB] = await Promise.all([
    register(baseUrl, userAEmail),
    register(baseUrl, userBEmail),
  ]);
  await Promise.all([
    addGrant({ userId: userA.userId, feedId: feedIdA, linkId: linkIdA, token: tokenA }),
    addGrant({ userId: userB.userId, feedId: feedIdB, linkId: linkIdB, token: tokenB }),
  ]);
  const previousTokenA = tokenA;
  const consent = await request(baseUrl, "/user/mt5-feed/consent", {
    method: "POST",
    headers: jsonHeaders(userA.token),
    body: JSON.stringify({
      consent: true,
      consentVersion: "tradify-journal-mt5-feed-consent-v1",
    }),
  });
  assert.equal(consent.status, 201);
  assert.equal(consent.body.state, "active");
  assert.equal(consent.body.consentVersion, "tradify-journal-mt5-feed-consent-v1");
  tokenA = String(consent.body.bridgeToken);
  feedIdA = String(consent.body.feedId);
  scopeA = `CUSTOMER:${feedIdA}`;
  const storedCustomerFeedA = await db
    .select()
    .from(tradifyMt5CustomerFeeds)
    .where(eq(tradifyMt5CustomerFeeds.userId, userA.userId))
    .limit(1);
  assert.equal(
    storedCustomerFeedA[0]?.tokenHash,
    crypto.createHash("sha256").update(tokenA, "utf8").digest("hex"),
    "only a one-way token hash is persisted",
  );
  assert.equal("bridgeToken" in (storedCustomerFeedA[0] ?? {}), false);
  const rotatedTokenRejected = await request(baseUrl, "/mt5/customer/bridge/subscriptions", {
    headers: { "x-customer-feed-token": previousTokenA },
  });
  assert.equal(rotatedTokenRejected.status, 401);

  for (const [token, bid, close] of [
    [tokenA, 2300, 2301],
    [tokenB, 2400, 2401],
  ] as const) {
    const bridgeHeaders = {
      "content-type": "application/json",
      "x-customer-feed-token": token,
    };
    const heartbeat = await request(baseUrl, "/mt5/customer/bridge/heartbeat", {
      method: "POST",
      headers: bridgeHeaders,
      body: JSON.stringify({
        bridgeId: "same-label-is-not-identity",
        connected: true,
        symbols: [brokerSymbol],
        activeSymbols: [brokerSymbol],
      }),
    });
    assert.equal(heartbeat.status, 200);
    const quote = await request(baseUrl, "/mt5/customer/bridge/quotes", {
      method: "POST",
      headers: bridgeHeaders,
      body: JSON.stringify({
        quotes: [{ symbol: brokerSymbol, bid, ask: bid + 1, last: bid + 0.5, time: candleTime }],
      }),
    });
    assert.equal(quote.status, 200);
    const candles = await request(baseUrl, "/mt5/customer/bridge/candles", {
      method: "POST",
      headers: bridgeHeaders,
      body: JSON.stringify({
        symbol: brokerSymbol,
        timeframe: "M15",
        candles: [{ time: candleTime, open: bid, high: close + 1, low: bid - 1, close, volume: 5 }],
      }),
    });
    assert.equal(candles.status, 200);
  }

  const [ownQuoteA, ownQuoteB, ownCandlesA, ownCandlesB, ignoredForeignScope, evalA, evalB] =
    await Promise.all([
      request(baseUrl, "/user/mt5-feed/quote?symbol=XAUUSD", {
        headers: jsonHeaders(userA.token),
      }),
      request(baseUrl, "/user/mt5-feed/quote?symbol=XAUUSD", {
        headers: jsonHeaders(userB.token),
      }),
      request(baseUrl, `/user/mt5-feed/candles?symbol=XAUUSD&timeframe=M15&feedId=${feedIdA}`, {
        headers: jsonHeaders(userA.token),
      }),
      request(baseUrl, `/user/mt5-feed/candles?symbol=XAUUSD&timeframe=M15&feedId=${feedIdB}`, {
        headers: jsonHeaders(userB.token),
      }),
      request(baseUrl, `/user/mt5-feed/candles?symbol=XAUUSD&timeframe=M15&feedId=${feedIdB}`, {
        headers: jsonHeaders(userA.token),
      }),
      request(baseUrl, "/user/mt5-feed/evaluate?symbol=XAUUSD", {
        headers: jsonHeaders(userA.token),
      }),
      request(baseUrl, "/user/mt5-feed/evaluate?symbol=XAUUSD", {
        headers: jsonHeaders(userB.token),
      }),
    ]);
  assert.equal(ownQuoteA.status, 200);
  assert.equal(ownQuoteB.status, 200);
  assert.equal((ownQuoteA.body.quote as { bid: number }).bid, 2300);
  assert.equal((ownQuoteB.body.quote as { bid: number }).bid, 2400);
  assert.equal((ownCandlesA.body.candles as Array<{ close: number }>)[0]?.close, 2301);
  assert.equal((ownCandlesB.body.candles as Array<{ close: number }>)[0]?.close, 2401);
  assert.equal(
    (ignoredForeignScope.body.candles as Array<{ close: number }>)[0]?.close,
    2301,
    "a client-supplied feedId cannot redirect its read to another account",
  );
  assert.equal(evalA.status, 200);
  assert.equal(evalB.status, 200);
  assert.equal(evalA.body.scope, "CUSTOMER_FEED_ONLY");
  assert.equal(evalB.body.scope, "CUSTOMER_FEED_ONLY");
  assert.equal(evalA.body.marketDataTrusted, false);
  assert.equal(evalB.body.marketDataTrusted, false);
  assert.equal((evalA.body.quote as { bid: number }).bid, 2300);
  assert.equal((evalB.body.quote as { bid: number }).bid, 2400);
  assert.equal(
    (evalA.body.candles as { candles: Array<{ close: number }> }).candles[0]?.close,
    2301,
  );
  assert.equal(
    (evalB.body.candles as { candles: Array<{ close: number }> }).candles[0]?.close,
    2401,
  );
  assert.equal(evalA.body.signalGenerated, false);
  assert.equal(evalB.body.signalGenerated, false);
  assert.equal(
    (await db
      .select()
      .from(tradifyEvaluationHistory)
      .where(eq(tradifyEvaluationHistory.origin, "CUSTOMER_FEED_PREVIEW"))).length,
    0,
    "customer previews must not be saved to shared evaluation history",
  );
  assert.equal(
    (await db.select().from(tradifyGeneratedSignals)).length,
    0,
    "customer previews must not create shared signals",
  );

  const customerTokenOnSharedRoute = await request(baseUrl, "/mt5/bridge/quotes", {
    method: "POST",
    headers: { "x-customer-feed-token": tokenA, "content-type": "application/json" },
    body: JSON.stringify({
      quotes: [{ symbol: brokerSymbol, bid: 2900, ask: 2901, last: 2900.5, time: candleTime }],
    }),
  });
  assert.equal(customerTokenOnSharedRoute.status, 401);

  const primary = MT5BridgeStore.getInstance("PRIMARY");
  await primary.hydrateFromPersistence();
  assert.equal(await primary.getQuoteForBrokerSymbolPersisted(brokerSymbol), null);
  assert.equal(
    await primary.getCandlesForBrokerSymbolPersisted(brokerSymbol, "M15"),
    null,
    "customer bridge ingestion must not populate shared reference candles",
  );
  const revoked = await request(baseUrl, "/user/mt5-feed", {
    method: "DELETE",
    headers: jsonHeaders(userA.token),
  });
  assert.equal(revoked.status, 200);
  const revokedTokenRejected = await request(baseUrl, "/mt5/customer/bridge/heartbeat", {
    method: "POST",
    headers: {
      "x-customer-feed-token": tokenA,
      "content-type": "application/json",
    },
    body: JSON.stringify({ connected: true }),
  });
  assert.equal(revokedTokenRejected.status, 401);
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
  await db
    .delete(tradifyMt5Candles)
    .where(
      and(
        inArray(tradifyMt5Candles.scopeId, [scopeA, scopeB]),
        eq(tradifyMt5Candles.brokerSymbol, brokerSymbol),
      ),
    );
  await db.delete(tradifyMt5BridgeState).where(inArray(tradifyMt5BridgeState.id, [scopeA, scopeB]));
  await db.delete(tradifyMt5CustomerFeeds).where(inArray(tradifyMt5CustomerFeeds.feedId, [feedIdA, feedIdB]));
  await db.delete(tradifyProductLinks).where(inArray(tradifyProductLinks.linkId, [linkIdA, linkIdB]));
  await pool.end();
}

console.log("Customer MT5 bridge route isolation check passed.");
