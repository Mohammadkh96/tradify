import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { pool } from "@workspace/db";
import app from "./app";
import { createTestAdmin } from "./test-admin";
import { bridgeStore, getUserById, updateCustomerState } from "./tradify-runtime";

const server = app.listen(0);
const port = (server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}/api`;
const testEmail = `customer-boundary-${process.pid}@example.test`;
const originalFetch = globalThis.fetch;
const forbiddenKeys = [
  "provider",
  "providerSymbol",
  "brokerSymbol",
  "strategy",
  "strategyVersion",
  "provenance",
  "diagnostic",
  "diagnostics",
  "tickData",
  "strategyFacts",
  "rawEngineSignal",
  "dgv8ChartLevels",
  "dgv8LevelMap",
];
const forbiddenValues = [
  "INTERNAL_PROVIDER_YAHOO",
  "GC=F",
  "BROKER_SYMBOL_GC_F",
  "INTERNAL_STRATEGY_DGV8",
  "DGV8",
  "DGv8",
  "DGV8_FX",
  "BBB_GOLD_3S",
  "INTERNAL_PROVENANCE_CONFIRMED",
  "INTERNAL_DIAGNOSTIC_HTTP_4014",
  "INTERNAL_TICK_DATA",
  "MT5",
  "Yahoo",
];

function assertNoOperationalFields(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);
  forbiddenValues.forEach((forbidden) =>
    assert.equal(serialized.includes(forbidden), false, `${label} should not contain ${forbidden}`),
  );
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoOperationalFields(item, `${label}[${index}]`));
    return;
  }
  const record = value as Record<string, unknown>;
  forbiddenKeys.forEach((key) =>
    assert.equal(Object.hasOwn(record, key), false, `${label} should not contain ${key}`),
  );
  Object.entries(record).forEach(([key, child]) =>
    assertNoOperationalFields(child, `${label}.${key}`),
  );
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as unknown;
  return {
    status: response.status,
    body,
    cacheControl: response.headers.get("cache-control"),
  };
}

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

try {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).startsWith(baseUrl)) return originalFetch(input, init);
    return { ok: false, status: 503, json: async () => ({}) } as Response;
  }) as typeof fetch;

  // A real bridge quote gives the public routes data to serialize while its
  // internal broker/provider fields remain available to the admin diagnostics.
  bridgeStore.updateHeartbeat({
    bridgeId: "customer-boundary-test",
    server: "test",
    connected: true,
    symbols: ["XAUUSD"],
    activeSymbols: ["XAUUSD"],
  });
  assert.equal(
    bridgeStore.updateQuotes({
      quotes: [
        {
          symbol: "XAUUSD",
          bid: 100,
          ask: 100.2,
          last: 100.1,
          time: Math.floor(Date.now() / 1000) + 3 * 60 * 60,
          tickData: "INTERNAL_TICK_DATA",
        },
      ],
    }),
    1,
  );

  const registered = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: "boundary-pass" }),
  });
  assert.equal(registered.status, 201);
  const token = String((registered.body as { token: string }).token);
  const userId = String((registered.body as { user: { id: string } }).user.id);
  const proHeaders = authHeader(token);
  assert.deepEqual((registered.body as { user: { alertSymbols: string[] } }).user.alertSymbols, []);
  const initialUserAlerts = await request("/user/alerts", { headers: proHeaders });
  assert.deepEqual(initialUserAlerts.body, []);
  const initialUserNotifications = await request("/user/notifications", { headers: proHeaders });
  assert.deepEqual(initialUserNotifications.body, []);
  const initialUserTrades = await request("/user/trades", { headers: proHeaders });
  assert.deepEqual(initialUserTrades.body, []);
  const removedAiCommentary = await request("/ai/commentary", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({ symbol: "USOIL" }),
  });
  assert.equal(removedAiCommentary.status, 404);

  const freeQuoteResponse = await request("/market/quotes");
  assert.equal(freeQuoteResponse.status, 200);
  assert.equal(
    (freeQuoteResponse.body as { quotes: Record<string, unknown> }).quotes.XAUUSD,
    undefined,
  );
  const freeSignalResponse = await request("/signals/current?symbol=XAUUSD");
  assert.equal(freeSignalResponse.status, 403);
  const freeStarterSignalResponse = await request("/signals/current?symbol=USOIL", {
    headers: proHeaders,
  });
  assert.equal(freeStarterSignalResponse.status, 403);
  assert.equal(
    (freeStarterSignalResponse.body as { error?: string }).error,
    "FEATURE_TIER_REQUIRED",
  );
  const freeSignalList = await request("/signals/current", { headers: proHeaders });
  assert.deepEqual(freeSignalList.body, []);
  const freeSnapshot = await request("/market/snapshot", { headers: proHeaders });
  assert.deepEqual((freeSnapshot.body as { signals: unknown[] }).signals, []);
  assert.deepEqual((freeSnapshot.body as { marketSetups: unknown[] }).marketSetups, []);
  const freeOilCandles = await request("/market/candles?symbol=USOIL", { headers: proHeaders });
  assert.equal(freeOilCandles.status, 403);
  assert.equal((freeOilCandles.body as { error?: string }).error, "FEATURE_TIER_REQUIRED");

  const freeGoldTrade = await request("/user/trades", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      symbol: "XAUUSD",
      direction: "LONG",
      entry: 100,
      stop: 99,
      target: 102,
    }),
  });
  assert.equal(freeGoldTrade.status, 403);
  assert.equal((freeGoldTrade.body as { error?: string }).error, "MARKET_TIER_REQUIRED");

  const freeAlerts = await request("/user/alerts", { headers: proHeaders });
  assert.deepEqual(freeAlerts.body, []);
  const freeAlertCreate = await request("/user/alerts", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({ symbol: "USOIL", condition: "ABOVE", target: 101, label: "Oil price" }),
  });
  assert.equal(freeAlertCreate.status, 403);
  assert.equal((freeAlertCreate.body as { error?: string }).error, "FEATURE_TIER_REQUIRED");
  const freeQuickAlert = await request("/user/watchlist/USOIL/alert", {
    method: "PUT",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({ active: true }),
  });
  assert.equal(freeQuickAlert.status, 403);

  const freeWatchlist = await request("/watchlist", { headers: authHeader(token) });
  assert.deepEqual((freeWatchlist.body as string[]).sort(), ["BTCUSD", "ETHUSD", "USOIL"]);
  const freeWatchlistUpgradeAttempt = await request("/watchlist", {
    method: "POST",
    headers: { ...authHeader(token), "content-type": "application/json" },
    body: JSON.stringify({ symbol: "XAUUSD" }),
  });
  assert.equal(freeWatchlistUpgradeAttempt.status, 403);

  const freeCatalogResponse = await request("/markets/catalog");
  const freeCatalog = freeCatalogResponse.body as Array<Record<string, unknown>>;
  const freeGold = freeCatalog.find((item) => item.symbol === "XAUUSD");
  assert.equal(freeGold?.requiredTier, "Pro");
  assert.equal(freeGold?.accessible, false);
  assert.equal(freeGold?.currentPrice, 0);
  const freeOil = freeCatalog.find((item) => item.symbol === "USOIL");
  assert.deepEqual(freeOil?.availableSetups, []);
  assert.equal(freeOil?.defaultSetupLabel, null);
  const freeStarterTrade = await request("/user/trades", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      id: "tier-boundary-oil-trade",
      symbol: "USOIL",
      direction: "LONG",
      entry: 100,
      stop: 99,
      target: 102,
    }),
  });
  assert.equal(freeStarterTrade.status, 201);
  assert.equal((freeStarterTrade.body as { trade: Record<string, unknown> }).trade.locked, false);

  await updateCustomerState(userId, (candidate) => {
    candidate.profile.membership = "Pro";
    candidate.membershipSource = "REVENUECAT";
    candidate.subscriptionStatus = "ACTIVE";
  });
  const proTradeResponse = await request("/user/trades", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      id: "tier-boundary-gold-trade",
      symbol: "XAUUSD",
      direction: "LONG",
      entry: 100,
      stop: 99,
      target: 102,
    }),
  });
  assert.equal(proTradeResponse.status, 201);
  const createdProTrade = (proTradeResponse.body as { trade: Record<string, unknown> }).trade;
  assert.equal(createdProTrade.locked, false);
  assert.equal(createdProTrade.entry, 100);
  const proAlertResponse = await request("/user/alerts", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      symbol: "XAUUSD",
      condition: "ABOVE",
      target: 101,
      label: "Gold price",
    }),
  });
  assert.equal(proAlertResponse.status, 201);
  const proQuickAlert = await request("/user/watchlist/USOIL/alert", {
    method: "PUT",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({ active: true }),
  });
  assert.equal(proQuickAlert.status, 200);

  const quoteResponse = await request("/market/quotes", { headers: proHeaders });
  assert.equal(quoteResponse.status, 200);
  assertNoOperationalFields(quoteResponse.body, "market quotes");
  const quote = (quoteResponse.body as { quotes: Record<string, Record<string, unknown>> }).quotes
    .XAUUSD;
  assert.ok(quote);
  assert.equal(quote.price, 100);
  assert.equal(Object.hasOwn(quote, "strategyPrice"), false);
  assert.equal(Object.hasOwn(quote, "lastError"), false);

  const catalogResponse = await request("/markets/catalog", { headers: proHeaders });
  assert.equal(catalogResponse.status, 200);
  assert.ok(Array.isArray(catalogResponse.body));
  assert.equal((catalogResponse.body as unknown[]).length, 69);
  const quoteOnlyAmd = (catalogResponse.body as Array<Record<string, unknown>>).find(
    (item) => item.symbol === "AMD",
  );
  assert.equal(quoteOnlyAmd?.requiredTier, "VIP");
  assert.equal(quoteOnlyAmd?.accessible, false);
  assert.equal(quoteOnlyAmd?.strategySupported, false);
  const proQuoteOnlyEvaluation = await request("/signals/evaluate?symbol=NDX", {
    headers: proHeaders,
  });
  assert.equal(proQuoteOnlyEvaluation.status, 403);
  assert.equal((proQuoteOnlyEvaluation.body as { error?: string }).error, "QUOTE_ONLY_MARKET");
  for (const item of catalogResponse.body as Array<Record<string, unknown>>) {
    assert.equal(Object.hasOwn(item, "availableStrategies"), false);
    assert.equal(Object.hasOwn(item, "defaultStrategyId"), false);
  }
  const goldCatalogItem = (catalogResponse.body as Array<Record<string, unknown>>).find(
    (item) => item.symbol === "XAUUSD",
  );
  assert.deepEqual(goldCatalogItem?.availableSetups, ["Gold setup", "BBB Gold 3S"]);
  assert.equal(goldCatalogItem?.defaultSetupLabel, "Gold setup");

  const signalResponse = await request("/signals/current?symbol=XAUUSD", { headers: proHeaders });
  assert.equal(signalResponse.status, 200);
  assert.equal(signalResponse.cacheControl, "private, no-store");
  assertNoOperationalFields(signalResponse.body, "current signal");
  const signal = signalResponse.body as Record<string, unknown>;
  assert.equal(Object.hasOwn(signal, "levels"), true);
  assert.equal(Object.hasOwn(signal, "strategy"), false);
  assert.equal(Object.hasOwn(signal, "note"), false);
  assert.equal(Object.hasOwn(signal, "reasons"), false);
  assert.equal(signal.setupLabel, "Gold setup");
  assert.equal(Object.hasOwn(signal, "entry"), true);
  assert.equal(Object.hasOwn(signal, "stop"), true);
  assert.equal(Object.hasOwn(signal, "targets"), true);

  const evaluationResponse = await request("/signals/evaluate?symbol=XAUUSD", {
    headers: proHeaders,
  });
  assert.equal(evaluationResponse.status, 200);
  assert.equal(evaluationResponse.cacheControl, "private, no-store");
  assertNoOperationalFields(evaluationResponse.body, "signal evaluation");
  assert.equal(
    Object.hasOwn(evaluationResponse.body as Record<string, unknown>, "diagnostic"),
    false,
  );
  const cookieSignalResponse = await request("/signals/current?symbol=XAUUSD", {
    headers: { cookie: `__Host-tradify-session=${token}` },
  });
  assert.equal(cookieSignalResponse.status, 200);
  assert.equal(cookieSignalResponse.cacheControl, "private, no-store");

  const requestedStrategyResponse = await request(
    "/signals/evaluate?symbol=XAUUSD&strategy=BBB_GOLD_3S",
    { headers: proHeaders },
  );
  assert.equal(requestedStrategyResponse.status, evaluationResponse.status);
  assert.equal(
    (requestedStrategyResponse.body as { signal?: { setupLabel?: string } }).signal?.setupLabel,
    "BBB Gold 3S",
  );
  const unavailableStrategyResponse = await request(
    "/signals/evaluate?symbol=XAUUSD&strategy=DGV8_FX",
    { headers: proHeaders },
  );
  assert.equal(unavailableStrategyResponse.status, 400);
  assert.equal(
    (unavailableStrategyResponse.body as { error?: string }).error,
    "SETUP_NOT_AVAILABLE_FOR_SYMBOL",
  );

  const snapshotResponse = await request("/market/snapshot", { headers: proHeaders });
  assert.equal(snapshotResponse.status, 200);
  assertNoOperationalFields(snapshotResponse.body, "market snapshot");
  const snapshot = snapshotResponse.body as {
    marketSetups?: Array<{ symbol: string; setupLabel: string | null }>;
  };
  assert.equal(
    snapshot.marketSetups?.find((item) => item.symbol === "XAUUSD")?.setupLabel,
    "Gold setup",
  );

  const watchlist = await request("/watchlist", { headers: proHeaders });
  assert.equal(watchlist.status, 200);
  assert.ok(Array.isArray(watchlist.body));
  assert.ok((watchlist.body as unknown[]).every((symbol) => typeof symbol === "string"));
  assertNoOperationalFields(watchlist.body, "watchlist");

  const watchlistUpdate = await request("/watchlist", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      symbol: "US30",
      provider: "INTERNAL_PROVIDER_YAHOO",
      brokerSymbol: "BROKER_SYMBOL_US30",
    }),
  });
  assert.equal(watchlistUpdate.status, 200);
  assertNoOperationalFields(watchlistUpdate.body, "watchlist update");

  await updateCustomerState(userId, (candidate) => {
    candidate.profile.membership = "VIP";
  });
  const vipCatalogResponse = await request("/markets/catalog", { headers: proHeaders });
  const vipCatalog = vipCatalogResponse.body as Array<Record<string, unknown>>;
  const vipAmd = vipCatalog.find((item) => item.symbol === "AMD");
  assert.equal(vipAmd?.requiredTier, "VIP");
  assert.equal(vipAmd?.accessible, true);
  assert.equal(vipAmd?.strategySupported, false);
  const quoteOnlyCandles = await request("/market/candles?symbol=NDX", { headers: proHeaders });
  assert.equal(quoteOnlyCandles.status, 403);
  assert.equal((quoteOnlyCandles.body as { error?: string }).error, "QUOTE_ONLY_MARKET");

  const rawAliasWatchlistUpdate = await request("/watchlist", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({ symbol: "NDX" }),
  });
  assert.equal(rawAliasWatchlistUpdate.status, 200);
  const vipWatchlist = await request("/watchlist", { headers: proHeaders });
  assert.ok((vipWatchlist.body as string[]).includes("NDX"));
  assert.equal((vipWatchlist.body as string[]).includes("US100"), false);

  await updateCustomerState(userId, (candidate) => {
    candidate.notifications.push({
      id: "tier-boundary-notification",
      timestamp: Date.now(),
      timeLabel: "1m",
      symbol: "XAUUSD",
      type: "RETEST_READY",
      title: "XAUUSD retest window",
      message: "Price returned to the active entry area. Validate before entry.",
      actionRequired: "RETEST_READY",
      isRead: false,
      signalId: "xau-01",
    });
  });
  const user = getUserById(userId);
  assert.ok(user);
  Object.assign(user.notifications[0], {
    provider: "INTERNAL_PROVIDER_YAHOO",
    brokerSymbol: "BROKER_SYMBOL_GC_F",
    strategy: "INTERNAL_STRATEGY_DGV8",
    provenance: "INTERNAL_PROVENANCE_CONFIRMED",
    diagnostics: "INTERNAL_DIAGNOSTIC_HTTP_4014",
    tickData: "INTERNAL_TICK_DATA",
  });
  const notifications = await request("/user/notifications", { headers: authHeader(token) });
  assert.equal(notifications.status, 200);
  assertNoOperationalFields(notifications.body, "notifications");
  const firstNotification = (notifications.body as Array<Record<string, unknown>>)[0];
  assert.deepEqual(Object.keys(firstNotification).sort(), [
    "actionRequired",
    "id",
    "isRead",
    "message",
    "signalId",
    "symbol",
    "timeLabel",
    "timestamp",
    "title",
    "type",
  ]);

  const markedRead = await request(`/user/notifications/${String(firstNotification.id)}/read`, {
    method: "PATCH",
    headers: authHeader(token),
  });
  assert.equal(markedRead.status, 200);
  assertNoOperationalFields(markedRead.body, "marked notification");

  await updateCustomerState(userId, (candidate) => {
    candidate.profile.membership = "Free";
    candidate.subscriptionStatus = "EXPIRED";
  });
  const downgradedSignals = await request("/signals/current?symbol=XAUUSD", {
    headers: proHeaders,
  });
  assert.equal(downgradedSignals.status, 403);
  const downgradedSnapshot = await request("/market/snapshot", { headers: proHeaders });
  assert.deepEqual((downgradedSnapshot.body as { signals: unknown[] }).signals, []);
  assert.deepEqual((downgradedSnapshot.body as { marketSetups: unknown[] }).marketSetups, []);
  const downgradedNotifications = await request("/user/notifications", { headers: proHeaders });
  assert.deepEqual(downgradedNotifications.body, []);
  const downgradedTrades = await request("/user/trades", { headers: proHeaders });
  assert.equal(downgradedTrades.status, 200);
  const lockedGoldTrade = (downgradedTrades.body as Array<Record<string, unknown>>).find(
    (trade) => trade.id === "tier-boundary-gold-trade",
  );
  assert.ok(lockedGoldTrade);
  assert.deepEqual(Object.keys(lockedGoldTrade).sort(), [
    "direction",
    "id",
    "locked",
    "status",
    "symbol",
  ]);
  assert.equal(lockedGoldTrade.locked, true);
  assert.equal(lockedGoldTrade.symbol, "XAUUSD");

  const blockedTradeEdit = await request("/user/trades/tier-boundary-gold-trade/actions", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({ action: "MOVE_SL", payload: { newStop: 99.5 } }),
  });
  assert.equal(blockedTradeEdit.status, 403);
  assert.equal((blockedTradeEdit.body as { error?: string }).error, "MARKET_TIER_REQUIRED");

  const closedLockedTrade = await request("/user/trades/tier-boundary-gold-trade/actions", {
    method: "POST",
    headers: { ...proHeaders, "content-type": "application/json" },
    body: JSON.stringify({ action: "CLOSE" }),
  });
  assert.equal(closedLockedTrade.status, 200);
  const closedLockedTradeDto = (closedLockedTrade.body as { trade: Record<string, unknown> }).trade;
  assert.equal(closedLockedTradeDto.locked, true);
  assert.deepEqual(Object.keys(closedLockedTradeDto).sort(), [
    "direction",
    "id",
    "locked",
    "status",
    "symbol",
  ]);
  const retainedServerTrade = getUserById(userId)?.trades.find(
    (trade) => trade.id === "tier-boundary-gold-trade",
  );
  assert.equal(retainedServerTrade?.entry, 100);
  assert.equal(retainedServerTrade?.stop, 99);
  assert.equal(retainedServerTrade?.status, "CLOSED");

  const downgradedAlerts = await request("/user/alerts", { headers: proHeaders });
  assert.deepEqual(downgradedAlerts.body, []);
  const downgradedMe = await request("/auth/me", { headers: proHeaders });
  assert.deepEqual(
    (downgradedMe.body as { user: { alertSymbols: string[] } }).user.alertSymbols,
    [],
  );
  const retainedServerUser = getUserById(userId);
  assert.equal(retainedServerUser?.alerts.length, 1);
  assert.ok(retainedServerUser?.alertSymbols.has("USOIL"));

  await updateCustomerState(userId, (candidate) => {
    candidate.profile.membership = "Pro";
    candidate.subscriptionStatus = "ACTIVE";
  });
  const restoredTrade = await request("/user/trades", { headers: proHeaders });
  const restoredGoldTrade = (restoredTrade.body as Array<Record<string, unknown>>).find(
    (trade) => trade.id === "tier-boundary-gold-trade",
  );
  assert.equal(restoredGoldTrade?.locked, false);
  assert.equal(restoredGoldTrade?.entry, 100);
  const restoredAlerts = await request("/user/alerts", { headers: proHeaders });
  assert.equal((restoredAlerts.body as unknown[]).length, 1);

  const forbiddenDiagnostic = await request("/signals/diagnostic?symbol=XAUUSD", {
    headers: authHeader(token),
  });
  assert.equal(forbiddenDiagnostic.status, 403);

  const admin = await createTestAdmin(baseUrl);
  const adminToken = admin.token;
  const diagnostic = await request("/signals/diagnostic?symbol=XAUUSD", {
    headers: authHeader(adminToken),
  });
  assert.equal(diagnostic.status, 200);
  const adminDiagnostic = diagnostic.body as Record<string, unknown>;
  assert.equal(Object.hasOwn(adminDiagnostic, "provider"), true);
  assert.equal(Object.hasOwn(adminDiagnostic, "providerSymbol"), true);
  assert.equal(Object.hasOwn(adminDiagnostic, "provenance"), true);

  console.log(
    "Customer data boundary checks passed: public signal, watchlist, notification, quote, snapshot, and evaluation DTOs are sanitized while admin diagnostics retain detail.",
  );
} finally {
  globalThis.fetch = originalFetch;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
}
