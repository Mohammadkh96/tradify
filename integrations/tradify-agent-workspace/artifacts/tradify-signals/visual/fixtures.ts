import type { Page } from "@playwright/test";
import { fixtureNowSeconds, trustedM15Response } from "../__tests__/fixtures/trusted-mt5-m15";
import { DEFAULT_ACCESS_POLICY } from "../constants/membership";

export const now = new Date(fixtureNowSeconds * 1000);
const user = {
  id: "visual-trader",
  name: "Visual Trader",
  email: "trader@example.test",
  accountSize: 10000,
  riskPercent: 0.5,
  maxDailyLoss: 2,
  maxTrades: 3,
  aggressive: false,
  membership: "VIP",
  role: "user",
  status: "active",
  entitlements: ["vip"],
  createdAt: now.toISOString(),
  lastSeenAt: now.toISOString(),
  watchlist: ["XAUUSD", "EURUSD"],
  alertSymbols: ["XAUUSD"],
};
export const signal = {
  id: "visual-gold",
  symbol: "XAUUSD",
  market: "Metals",
  direction: "LONG",
  strategy: "Gold setup",
  setupLabel: "Gold setup",
  grade: "A+",
  action: "BUY",
  qualified: true,
  lifecycleStatus: "QUALIFIED",
  price: 106.1,
  entry: 106.3,
  stop: 104.8,
  tp1: 107.2,
  tp2: 108.1,
  tp3: 109.4,
  session: "London",
  age: "2m",
  note: "Price holds above the entry gate.",
  dataState: "LIVE",
  targets: [107.2, 108.1, 109.4],
};
const quotes = {
  XAUUSD: { price: 106.1, changePercent: 0.42, dataState: "LIVE", changeBasis: "PREVIOUS_CLOSE" },
  EURUSD: { price: 1.0852, changePercent: -0.12, dataState: "LIVE", changeBasis: "PREVIOUS_CLOSE" },
};
const snapshot = {
  timestamp: now.toISOString(),
  bridge: { connected: true },
  quotes,
  signals: [signal],
  marketSetups: [{ symbol: "XAUUSD", setupLabel: "Gold setup" }],
};
const catalog = [
  {
    symbol: "XAUUSD",
    name: "Gold",
    assetClass: "Metals",
    digits: 2,
    currentPrice: 106.1,
    defaultSetupLabel: "Gold setup",
  },
  {
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    assetClass: "Forex",
    digits: 5,
    currentPrice: 1.0852,
    defaultSetupLabel: "FX setup",
  },
].map((market) => ({
  ...market,
  sizingStatus: "READY",
  bid: market.currentPrice,
  ask: market.currentPrice,
  quoteState: "LIVE",
  opportunityState: "READY",
  availableSetups: [market.defaultSetupLabel],
  requiredTier: "Pro",
  accessible: true,
  strategySupported: true,
}));
const notifications = [
  {
    id: "visual-notification",
    timestamp: now.getTime() - 120000,
    timeLabel: "2m ago",
    symbol: "XAUUSD",
    type: "NEW_SETUP",
    title: "Gold setup validated",
    message: "A new London session opportunity is ready to review.",
    read: false,
  },
];
const alerts = [
  {
    id: "visual-alert",
    symbol: "XAUUSD",
    target: 107.2,
    label: "Gold first target",
    enabled: true,
    createdAt: now.toISOString(),
  },
];
const trades = [
  {
    id: "visual-trade",
    symbol: "XAUUSD",
    direction: "LONG",
    entry: 106.3,
    stop: 104.8,
    target: 107.2,
    progress: 60,
    r: 0.6,
    status: "ACTIVE",
    locked: false,
    createdAt: now.toISOString(),
  },
];

// Browser interception only. No app test route, authentication bypass, real
// credentials, provider calls, or database writes are used by this suite.
export async function installFixtures(page: Page) {
  const unexpected: string[] = [];
  await page.clock.setFixedTime(now);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const responses: Record<string, unknown> = {
      "/api/market/snapshot": snapshot,
      "/api/market/quotes": {
        timestamp: now.toISOString(),
        bridge: { connected: true, activeSymbols: ["XAUUSD", "EURUSD"] },
        quotes,
      },
      "/api/markets/catalog": catalog,
      "/api/market/candles": trustedM15Response,
      "/api/signals/evaluate": { signal, candles: trustedM15Response },
      "/api/auth/sign-in": { ok: true, token: "synthetic-visual-session", user },
      "/api/auth/me": { user },
      "/api/user/profile": { user },
      "/api/watchlist": user.watchlist,
      "/api/user/alerts": alerts,
      "/api/user/trades": trades,
      "/api/user/notifications": notifications,
      "/api/membership/status": {
        membership: "VIP",
        source: "ADMIN",
        entitlements: ["vip"],
        billingStatus: "ACTIVE",
        expiresAt: null,
        willRenew: false,
        provider: "NONE",
        accessPolicy: DEFAULT_ACCESS_POLICY,
      },
    };
    if (!(path in responses)) {
      unexpected.push(`${route.request().method()} ${path}`);
      await route.fulfill({ status: 501, json: { error: "Unmocked visual fixture request" } });
      return;
    }
    await route.fulfill({ json: responses[path] });
  });
  return unexpected;
}
