import crypto from "node:crypto";
import { compare as compareBcrypt, hash as hashBcrypt } from "bcryptjs";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { env } from "@workspace/config";
import { db } from "@workspace/db";
import { fetchWithRetry } from "./lib/fetch-with-retry";
import {
  tradifyAccountDeletionRequests,
  tradifyAdminAuditEvents,
  tradifyLinkRevocationOutbox,
  tradifyLinkAttempts,
  tradifyPasswordResetTokens,
  tradifyProductLinks,
  tradifyUsers,
} from "@workspace/db/schema";
import {
  LINK_CONTRACT,
  canonicalRevocationPayload,
  queueSignalsLinkRevocations,
  revocationPayloadHash,
} from "./product-linking";
import { mt5BridgeStore, type MT5Quote } from "./zip-engine/market/providers/MT5BridgeStore";
import {
  mt5ChartCandleFreshnessWindowMs,
  normalizeBridgeCandleTime,
  normalizeBrokerTime,
  normalizeExternalCandleOpenTime,
} from "./zip-engine/market/CandleTime";
import { SymbolMapper } from "./zip-engine/market/SymbolMapper";
import { marketCatalog } from "./zip-engine/market/MarketCatalog";
import { mt5WatchlistQuoteSymbols } from "./zip-engine/market/MT5WatchlistSubscriptions";
import { mt5WatchlistSymbolIdentity } from "./zip-engine/market/MT5WatchlistCatalog";
import { marketDataRegistry } from "./zip-engine/market/ProviderRegistry";
import { FallbackMap, type FallbackRoute } from "./zip-engine/market/FallbackMap";
import {
  assignedStrategies,
  assignedStrategy,
  evaluateCurrentSignals,
  toSignalCard,
} from "./authoritative-engine";
import { ConcurrentUpdateError, engineStateReady } from "./engine-state";
import { ensureControlPlaneReady } from "./control-plane";
import { FREE_STARTER_SYMBOLS, currentFreeStarterSymbols } from "./market-access";

export type AssetClass =
  "FOREX" | "METALS" | "INDICES" | "CRYPTO" | "COMMODITIES" | "STOCKS" | "OTHER";
export type DataState = "LIVE" | "FALLBACK" | "STALE" | "ERROR";
export type ReferenceState = "REFERENCE" | "STALE" | "UNAVAILABLE";
export type ReferenceCondition = "ACTIVE_SOURCE" | "MARKET_CLOSED" | "STALE_SOURCE" | "UNAVAILABLE";
export type ChangeBasis = "STREAM" | "PREVIOUS_CLOSE" | "24H";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  brokerSymbol: string;
  provider: string;
  bid: number;
  ask: number;
  last: number;
  price: number;
  strategyPrice: number;
  displayPrice: number;
  change: number;
  changePercent: number;
  time: number;
  receivedAt: number;
  status: "LIVE" | "FALLBACK" | "STALE" | "UNAVAILABLE";
  dataState: DataState;
  sourceTimestamp?: number;
  sourceAgeSeconds?: number;
  referenceState?: ReferenceState;
  referenceCondition?: ReferenceCondition;
  referenceType?: "REGULAR_MARKET_PRICE" | "LAST_TRADE" | "SPOT_REFERENCE";
  referenceBasis?: "PREVIOUS_CLOSE" | "USDT" | "XAU_USD";
  changeBasis?: ChangeBasis;
  priceBasis?: "USD" | "USDT" | "BROKER";
  provenance?: import("./zip-engine/market/types").ProviderProvenance;
  lastError?: string;
}

export interface CatalogItem {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  providerSymbol: string;
  digits: number;
}

export interface UserProfile {
  name: string;
  email: string;
  accountSize: number;
  riskPercent: number;
  maxDailyLoss: number;
  maxTrades: number;
  aggressive: boolean;
  membership: "Free" | "Pro" | "VIP";
}

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended" | "banned" | "deleted";
export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "CANCELLED" | "EXPIRED" | "PAST_DUE";
export const PRO_ENTITLEMENTS = [
  "REALTIME_SIGNALS",
  "DGV8_CHART_LEVELS",
  "UNLIMITED_ALERTS",
] as const;

export interface Trade {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stop: number;
  target: number;
  progress: number;
  r: number;
  status: "ACTIVE" | "TP1 HIT" | "CLOSED";
  createdAt: string;
  closedAt?: string;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: "ABOVE" | "BELOW" | "EXACT";
  target: number;
  label: string;
  active: boolean;
  createdAt: string;
}

export type NotificationType =
  | "NEW_SETUP"
  | "STATUS_CHANGE"
  | "RETEST_READY"
  | "TRIGGERED"
  | "TP_HIT"
  | "SL_HIT"
  | "INVALIDATED"
  | "MARKET_WARNING";

export interface UserNotification {
  id: string;
  timestamp: number;
  timeLabel: string;
  symbol: string;
  type: NotificationType;
  title: string;
  message: string;
  actionRequired?: string;
  isRead: boolean;
  signalId?: string;
}

export interface ServerUser {
  id: string;
  email: string;
  passwordHash: string;
  profile: UserProfile;
  membershipSource?: "UNKNOWN" | "REVENUECAT" | "ADMIN_OVERRIDE";
  subscriptionStatus?: SubscriptionStatus;
  billingExpiresAt?: string | null;
  billingWillRenew?: boolean;
  billingEventId?: string;
  billingEventTimestamp?: string;
  trialEndsAt?: string | null;
  overrideEndsAt?: string | null;
  entitlementGrants: string[];
  entitlementDenies: string[];
  role: UserRole;
  status: UserStatus;
  riskDisclaimerVersion?: string | null;
  riskDisclaimerAcceptedAt?: string | null;
  entitlements: string[];
  createdAt: string;
  lastSeenAt: string;
  authInvalidBefore?: string;
  deletedAt?: string;
  watchlist: Set<string>;
  alertSymbols: Set<string>;
  alerts: PriceAlert[];
  notifications: UserNotification[];
  trades: Trade[];
  adminUpdatedBy?: string;
  adminUpdatedAt?: string;
  version: number;
}

const catalogs: CatalogItem[] = [
  ["XAUUSD", "Gold", "METALS", "XAUUSD", 2],
  ["XAGUSD", "Silver", "METALS", "XAGUSD", 3],
  ["USOIL", "WTI Oil", "METALS", "USOIL", 2],
  ["US100", "Nasdaq 100", "INDICES", "USTEC", 2],
  ["US30", "Dow Jones", "INDICES", "US30", 2],
  ["US500", "S&P 500", "INDICES", "US500", 2],
  ["GER40", "DAX Index", "INDICES", "GER40", 2],
  ["UK100", "FTSE 100", "INDICES", "UK100", 2],
  ["JP225", "Nikkei 225", "INDICES", "JP225", 1],
  ["EURUSD", "Euro / Dollar", "FOREX", "EURUSD", 5],
  ["GBPUSD", "Pound / Dollar", "FOREX", "GBPUSD", 5],
  ["USDJPY", "Dollar / Yen", "FOREX", "USDJPY", 3],
  ["AUDUSD", "Aussie / Dollar", "FOREX", "AUDUSD", 5],
  ["USDCAD", "Dollar / CAD", "FOREX", "USDCAD", 5],
  ["USDCHF", "Dollar / Franc", "FOREX", "USDCHF", 5],
  ["NZDUSD", "Kiwi / Dollar", "FOREX", "NZDUSD", 5],
  ["EURGBP", "Euro / Pound", "FOREX", "EURGBP", 5],
  ["EURJPY", "Euro / Yen", "FOREX", "EURJPY", 3],
  ["GBPJPY", "Pound / Yen", "FOREX", "GBPJPY", 3],
  ["AUDJPY", "Aussie / Yen", "FOREX", "AUDJPY", 3],
  ["BTCUSD", "Bitcoin / Dollar", "CRYPTO", "BTCUSDT", 2],
  ["ETHUSD", "Ether / Dollar", "CRYPTO", "ETHUSDT", 2],
].map(([symbol, name, assetClass, providerSymbol, digits]) => ({
  symbol: symbol as string,
  name: name as string,
  assetClass: assetClass as AssetClass,
  providerSymbol: providerSymbol as string,
  digits: digits as number,
}));

const aliases: Record<string, string> = {
  GOLD: "XAUUSD",
  XAU: "XAUUSD",
  SILVER: "XAGUSD",
  XAG: "XAGUSD",
  WTI: "USOIL",
  CL: "USOIL",
  NAS100: "US100",
  USTEC: "US100",
  NDX: "US100",
  NQ: "US100",
  DJ30: "US30",
  WS30: "US30",
  DOW: "US30",
  YM: "US30",
  SPX500: "US500",
  SP500: "US500",
  SPX: "US500",
  ES: "US500",
  GER30: "GER40",
  DAX40: "GER40",
  DE40: "GER40",
  DAX: "GER40",
  FTSE100: "UK100",
  FTSE: "UK100",
  JPN225: "JP225",
  NIKKEI: "JP225",
  BTCUSDT: "BTCUSD",
  XBTUSD: "BTCUSD",
  ETHUSDT: "ETHUSD",
};
const blockedSymbols = new Set(["GC", "GC=F", "PAXG", "PAXGUSDT", "SI"]);

export function canonicalSymbol(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const watchlistSymbol = mt5WatchlistSymbolIdentity(raw);
  if (watchlistSymbol) return watchlistSymbol;
  const result = SymbolMapper.toCanonical(raw);
  return result.canonical;
}

export function catalogItem(symbol: string): CatalogItem | undefined {
  const canonical = canonicalSymbol(symbol);
  const item = marketCatalog.get(canonical ?? symbol);
  if (item) {
    return {
      symbol: item.canonicalSymbol,
      name: item.description || item.displaySymbol,
      assetClass: item.assetClass,
      providerSymbol: item.providerSymbol,
      digits: item.digits,
    };
  }
  return catalogs.find((catalog) => catalog.symbol === canonical);
}

export function getCatalog(): CatalogItem[] {
  return catalogs.map((item) => ({ ...item }));
}

class BridgeStore {
  private secret = env.mt5BridgeSecret ?? "";
  private connected = false;
  private bridgeId = "laptop-dev-primary";
  private server = "MT5-Broker";
  private lastHeartbeat = 0;
  private availableSymbols: string[] = [];
  private activeSymbols: string[] = [];
  private subscriptionVersion = 0;
  private mappings: Record<string, string> = Object.fromEntries(
    catalogs.map((item) => [item.symbol, item.providerSymbol]),
  );
  private quotes = new Map<string, Quote>();
  private candles = new Map<string, Candle[]>();
  private quoteListeners = new Set<(quote: Quote) => void>();
  private statusListeners = new Set<() => void>();
  private candleListeners = new Set<
    (symbol: string, timeframe: string, candles: Candle[]) => void
  >();

  validateSecret(value: unknown): boolean {
    return typeof value === "string" && mt5BridgeStore.validateSecret(value);
  }

  private toPublicQuote(symbol: string, quote: MT5Quote): Quote {
    const ageMs = Date.now() - quote.receivedAt;
    const stale = ageMs > 30_000;
    const canonical = canonicalSymbol(symbol) ?? symbol.toUpperCase();
    return {
      symbol: canonical,
      brokerSymbol: quote.symbol,
      provider: "MT5",
      bid: quote.bid,
      ask: quote.ask,
      last: quote.last,
      price: quote.strategyPrice,
      strategyPrice: quote.strategyPrice,
      displayPrice: quote.displayPrice,
      change: quote.change,
      changePercent: quote.changePercent,
      time: quote.time,
      receivedAt: quote.receivedAt,
      status: stale ? "STALE" : "LIVE",
      dataState: stale ? "STALE" : "LIVE",
      changeBasis: "STREAM",
    };
  }

  updateHeartbeat(body: Record<string, unknown>): void {
    mt5BridgeStore.updateHeartbeat({
      bridgeId: typeof body.bridgeId === "string" ? body.bridgeId : this.bridgeId,
      server: typeof body.server === "string" ? body.server : undefined,
      connected: typeof body.connected === "boolean" ? body.connected : undefined,
      symbols: Array.isArray(body.symbols)
        ? body.symbols.filter((value): value is string => typeof value === "string")
        : undefined,
      activeSymbols: Array.isArray(body.activeSymbols)
        ? body.activeSymbols.filter((value): value is string => typeof value === "string")
        : undefined,
      discovered: typeof body.discovered === "number" ? body.discovered : undefined,
      active: typeof body.active === "number" ? body.active : undefined,
      subscriptionVersion:
        typeof body.subscriptionVersion === "number" ? body.subscriptionVersion : undefined,
    });
    if (typeof body.bridgeId === "string") this.bridgeId = body.bridgeId;
    if (typeof body.server === "string") this.server = body.server;
    if (typeof body.connected === "boolean") this.connected = body.connected;
    this.lastHeartbeat = Date.now();
    if (Array.isArray(body.symbols)) {
      this.availableSymbols = body.symbols.filter(
        (value): value is string => typeof value === "string",
      );
      for (const broker of this.availableSymbols) {
        const canonical = canonicalSymbol(broker);
        if (canonical) this.mappings[canonical] = broker;
      }
    }
    if (Array.isArray(body.activeSymbols))
      this.activeSymbols = body.activeSymbols.filter(
        (value): value is string => typeof value === "string",
      );
    for (const activeBrokerSymbol of this.activeSymbols) {
      const canonical = canonicalSymbol(activeBrokerSymbol);
      if (canonical) this.mappings[canonical] = activeBrokerSymbol;
    }
    if (typeof body.subscriptionVersion === "number")
      this.subscriptionVersion = body.subscriptionVersion;
    this.statusListeners.forEach((listener) => listener());
  }

  updateQuotes(body: Record<string, unknown>): number {
    const rawQuotes = Array.isArray(body.quotes) ? body.quotes : [];
    const allowedQuoteOnlySymbols = new Set(
      mt5WatchlistQuoteSymbols(this.availableSymbols, this.activeSymbols, this.connected).map(
        (symbol) => symbol.trim().toUpperCase(),
      ),
    );
    const quotes: Array<{
      symbol: string;
      bid: number;
      ask: number;
      last: number;
      chartMode: string;
      time: number;
      timeMsc: number;
      quoteOnly: boolean;
    }> = [];

    for (const value of rawQuotes) {
      if (!value || typeof value !== "object") continue;
      const input = value as Record<string, unknown>;
      const symbol = typeof input.symbol === "string" ? input.symbol.trim() : "";
      const quoteOnly = input.quoteOnly === true;
      if (!symbol || (quoteOnly && !allowedQuoteOnlySymbols.has(symbol.toUpperCase()))) continue;
      quotes.push({
        symbol,
        bid: Number(input.bid),
        ask: Number(input.ask),
        last: Number(input.last),
        chartMode: typeof input.chartMode === "string" ? input.chartMode : "BID",
        time: Number(input.time),
        timeMsc: Number(input.timeMsc),
        quoteOnly,
      });
    }

    mt5BridgeStore.updateQuotes(quotes);
    let accepted = 0;
    for (const input of quotes) {
      const brokerSymbol = input.symbol;
      if (input.quoteOnly) {
        const quote = getMT5WatchlistQuotes([brokerSymbol])[brokerSymbol];
        if (!quote) continue;
        accepted += 1;
        this.connected = true;
        this.lastHeartbeat = quote.receivedAt;
        this.quoteListeners.forEach((listener) => listener(quote));
        continue;
      }

      const symbol = canonicalSymbol(brokerSymbol);
      const bid = input.bid;
      const ask = input.ask;
      if (
        !symbol ||
        !brokerSymbol ||
        !Number.isFinite(bid) ||
        !Number.isFinite(ask) ||
        bid <= 0 ||
        ask <= 0
      )
        continue;
      const last = input.last > 0 ? input.last : (bid + ask) / 2;
      const chartMode =
        input.chartMode === "LAST" ? "LAST" : input.chartMode === "MID" ? "MID" : "BID";
      const strategyPrice =
        chartMode === "LAST" ? last : chartMode === "MID" ? (bid + ask) / 2 : bid;
      const timeValue = input.time;
      const time =
        Number.isFinite(timeValue) && timeValue > 0
          ? normalizeBrokerTime(timeValue)
          : Math.floor(Date.now() / 1000);
      const prior = this.quotes.get(symbol);
      const change = prior ? strategyPrice - prior.price : 0;
      const changePercent = prior?.price ? (change / prior.price) * 100 : 0;
      const quote: Quote = {
        symbol,
        brokerSymbol,
        provider: "MT5",
        bid,
        ask,
        last,
        price: strategyPrice,
        strategyPrice,
        displayPrice: strategyPrice,
        change,
        changePercent,
        time,
        receivedAt: Date.now(),
        status: "LIVE",
        dataState: "LIVE",
        changeBasis: "STREAM",
      };
      this.mappings[symbol] = brokerSymbol;
      this.quotes.set(symbol, quote);
      accepted += 1;
      this.connected = true;
      this.lastHeartbeat = quote.receivedAt;
      this.quoteListeners.forEach((listener) => listener(quote));
    }
    if (accepted > 0) this.statusListeners.forEach((listener) => listener());
    return accepted;
  }

  updateCandles(body: Record<string, unknown>): number {
    const rawSymbol = typeof body.symbol === "string" ? body.symbol : "";
    const symbol = canonicalSymbol(rawSymbol);
    const timeframe = typeof body.timeframe === "string" ? body.timeframe.toUpperCase() : "M15";
    const rawCandles = Array.isArray(body.candles) ? body.candles : [];
    const syncMode =
      body.syncMode === "FULL"
        ? "FULL"
        : body.syncMode === "PARTIAL"
          ? "PARTIAL"
          : body.syncMode === "INCREMENTAL"
            ? "INCREMENTAL"
            : "PARTIAL";
    const rawCoverageRange =
      body.coverageRange && typeof body.coverageRange === "object"
        ? (body.coverageRange as Record<string, unknown>)
        : undefined;
    const coverageRange =
      rawCoverageRange &&
      Number.isSafeInteger(Number(rawCoverageRange.startUtc)) &&
      Number.isSafeInteger(Number(rawCoverageRange.endUtc))
        ? {
            startUtc: Number(rawCoverageRange.startUtc),
            endUtc: Number(rawCoverageRange.endUtc),
          }
        : undefined;
    if (!symbol) return 0;
    const accepted = mt5BridgeStore.updateCandles(
      rawSymbol,
      timeframe,
      rawCandles,
      syncMode,
      coverageRange,
    );
    if (accepted === 0) return 0;
    const parsed = rawCandles
      .map((value) => {
        if (!value || typeof value !== "object") return null;
        const input = value as Record<string, unknown>;
        const time = normalizeBridgeCandleTime(input, timeframe);
        return {
          time,
          open: Number(input.open),
          high: Number(input.high),
          low: Number(input.low),
          close: Number(input.close),
          volume: Number(input.volume) || 0,
        };
      })
      .filter((c): c is Candle =>
        Boolean(
          c &&
          c.time > 0 &&
          c.open > 0 &&
          c.high >= c.low &&
          c.high >= c.open &&
          c.high >= c.close &&
          c.low <= c.open &&
          c.low <= c.close,
        ),
      );
    const key = `${symbol}:${timeframe}`;
    const merged = new Map((this.candles.get(key) ?? []).map((candle) => [candle.time, candle]));
    parsed.forEach((candle) => merged.set(candle.time, candle));
    this.candles.set(
      key,
      Array.from(merged.values())
        .sort((a, b) => a.time - b.time)
        .slice(-1000),
    );
    this.connected = true;
    this.lastHeartbeat = Date.now();
    const snapshot = this.candles.get(key) ?? [];
    this.candleListeners.forEach((listener) =>
      listener(
        symbol,
        timeframe,
        snapshot.map((candle) => ({ ...candle })),
      ),
    );
    this.statusListeners.forEach((listener) => listener());
    return parsed.length;
  }

  async updateSpecifications(body: Record<string, unknown>): Promise<number> {
    return mt5BridgeStore.updateSpecifications(body.specs);
  }

  getQuote(symbol: string): Quote | undefined {
    const canonical = canonicalSymbol(symbol) ?? symbol.toUpperCase();
    const brokerSymbol = mt5BridgeStore.getMappings()[canonical] ?? symbol;
    const quote = mt5BridgeStore.getQuoteForBrokerSymbol(brokerSymbol);
    return quote ? this.toPublicQuote(canonical, quote) : undefined;
  }

  getCandles(symbol: string, timeframe: string): Candle[] {
    const canonical = canonicalSymbol(symbol) ?? symbol.toUpperCase();
    const brokerSymbol = mt5BridgeStore.getMappings()[canonical] ?? symbol;
    return (
      mt5BridgeStore.getCandlesForBrokerSymbol(brokerSymbol, timeframe.toUpperCase()) ?? []
    ).map((candle) => ({ ...candle, volume: candle.volume ?? 0 }));
  }

  onCandle(listener: (symbol: string, timeframe: string, candles: Candle[]) => void) {
    this.candleListeners.add(listener);
    return () => this.candleListeners.delete(listener);
  }

  isConnected(): boolean {
    return mt5BridgeStore.isConnected();
  }

  getStatus() {
    return { ...mt5BridgeStore.getStatus(), isBackfilled: mt5BridgeStore.isBackfillCompleted() };
  }

  getLiveQuotes(): Record<string, Quote> {
    if (!mt5BridgeStore.isConnected()) return {};
    const result: Record<string, Quote> = {};
    for (const item of catalogs) {
      const quote = this.getQuote(item.symbol);
      if (
        quote?.provider === "MT5" &&
        quote.status === "LIVE" &&
        quote.dataState === "LIVE" &&
        quote.price > 0
      ) {
        result[item.symbol] = quote;
      }
    }
    return result;
  }

  getMappings() {
    return mt5BridgeStore.getMappings();
  }

  setMappings(mappings: Record<string, string>) {
    mt5BridgeStore.setMappings(mappings);
  }

  onQuote(listener: (quote: Quote) => void) {
    this.quoteListeners.add(listener);
    return () => this.quoteListeners.delete(listener);
  }

  onStatus(listener: () => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
}

export const bridgeStore = new BridgeStore();

export const chartTimeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;
export type ChartTimeframe = (typeof chartTimeframes)[number];
export const MINIMUM_COMPLETE_CANDLES = 50;

export const REFERENCE_FRESHNESS_THRESHOLDS_SECONDS: Record<AssetClass, number> = {
  METALS: 10 * 60,
  INDICES: 15 * 60,
  FOREX: 5 * 60,
  CRYPTO: 2 * 60,
  COMMODITIES: 15 * 60,
  STOCKS: 15 * 60,
  OTHER: 15 * 60,
};

type SupportedFallbackRoute = FallbackRoute & { provider: "Yahoo" | "Binance" };

function fallbackRoute(item: CatalogItem): SupportedFallbackRoute | undefined {
  const route = FallbackMap.getValidFallbacks(item.symbol).find(
    (candidate) => candidate.provider === "Yahoo" || candidate.provider === "Binance",
  );
  return route as SupportedFallbackRoute | undefined;
}

function classifyReference(
  item: CatalogItem,
  sourceAgeSeconds: number,
  marketState?: string,
): { referenceState: ReferenceState; referenceCondition: ReferenceCondition } {
  if (sourceAgeSeconds <= REFERENCE_FRESHNESS_THRESHOLDS_SECONDS[item.assetClass]) {
    return {
      referenceState: "REFERENCE",
      referenceCondition: marketState === "CLOSED" ? "MARKET_CLOSED" : "ACTIVE_SOURCE",
    };
  }
  return {
    referenceState: "STALE",
    referenceCondition: marketState === "CLOSED" ? "MARKET_CLOSED" : "STALE_SOURCE",
  };
}

const fallbackCache = new Map<
  string,
  {
    expiresAt: number;
    value?: { provider: "Yahoo" | "Binance"; providerSymbol: string; candles: Candle[] };
  }
>();
const FALLBACK_CACHE_TTL_MS = 30_000;
const FALLBACK_FAILURE_TTL_MS = 8_000;
let goldReferenceCache: { expiresAt: number; value?: Quote } | undefined;
let goldReferenceInFlight: Promise<Quote | undefined> | undefined;
const eodhdRowsCache = new Map<string, { expiresAt: number; value: EodhdDailyRow[] }>();
const eodhdRowsInFlight = new Map<string, Promise<EodhdDailyRow[]>>();

type EodhdDailyRow = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const EODHD_REFERENCE_SYMBOLS: Partial<Record<"XAUUSD" | "XAGUSD", string>> = {
  XAUUSD: "XAUUSD.FOREX",
  XAGUSD: "XAGUSD.FOREX",
};

function eodhdDateTimestamp(date: string): number | undefined {
  const timestamp = Date.parse(`${date}T21:00:00.000Z`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : undefined;
}

async function eodhdDailyRows(item: CatalogItem): Promise<EodhdDailyRow[]> {
  const providerSymbol =
    EODHD_REFERENCE_SYMBOLS[item.symbol as keyof typeof EODHD_REFERENCE_SYMBOLS];
  const key = env.eodhdApiKey;
  if (!providerSymbol || !key) return [];
  const cached = eodhdRowsCache.get(item.symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const inFlight = eodhdRowsInFlight.get(item.symbol);
  if (inFlight) return inFlight;

  const request = (async () => {
    const from = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const url = new URL(`https://eodhd.com/api/eod/${providerSymbol}`);
    url.searchParams.set("api_token", key);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("limit", "1000");
    const body = await fetchJson(url.toString(), 7_000);
    if (!Array.isArray(body)) return [];
    return body
      .flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const value = row as Record<string, unknown>;
        const date = typeof value.date === "string" ? value.date : "";
        const open = Number(value.open);
        const high = Number(value.high);
        const low = Number(value.low);
        const close = Number(value.close);
        const volume = Number(value.volume);
        if (
          !date ||
          ![open, high, low, close].every((number) => Number.isFinite(number) && number > 0)
        )
          return [];
        if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) return [];
        return [
          {
            date,
            open,
            high,
            low,
            close,
            volume: Number.isFinite(volume) && volume >= 0 ? volume : 0,
          },
        ];
      })
      .sort((left, right) => left.date.localeCompare(right.date));
  })()
    .catch(() => [])
    .then((value) => {
      eodhdRowsCache.set(item.symbol, { expiresAt: Date.now() + FALLBACK_CACHE_TTL_MS, value });
      return value;
    })
    .finally(() => {
      eodhdRowsInFlight.delete(item.symbol);
    });
  eodhdRowsInFlight.set(item.symbol, request);
  return request;
}

function eodhdQuote(
  item: CatalogItem,
  rows: EodhdDailyRow[],
  providerSymbol: string,
  realtime?: Record<string, unknown>,
): Quote | undefined {
  const close = Number(realtime?.close);
  const realtimeTimestamp = Number(realtime?.timestamp);
  const row = rows.at(-1);
  const price = close > 0 ? close : row?.close;
  const sourceTimestamp =
    realtimeTimestamp > 0 ? realtimeTimestamp : row ? eodhdDateTimestamp(row.date) : undefined;
  if (!(price && price > 0 && sourceTimestamp && sourceTimestamp > 0)) return undefined;
  const previous =
    Number(realtime?.previousClose) > 0
      ? Number(realtime?.previousClose)
      : (rows.at(-2)?.close ?? price);
  const receivedAt = Date.now();
  const sourceAgeSeconds = Math.max(0, Math.floor(receivedAt / 1000 - sourceTimestamp));
  const { referenceState, referenceCondition } = classifyReference(item, sourceAgeSeconds);
  return {
    symbol: item.symbol,
    brokerSymbol: providerSymbol,
    provider: "EODHD",
    bid: price,
    ask: price,
    last: price,
    price,
    strategyPrice: price,
    displayPrice: price,
    change: price - previous,
    changePercent:
      Number(realtime?.change_p) || (previous ? ((price - previous) / previous) * 100 : 0),
    time: sourceTimestamp,
    receivedAt,
    status: referenceState === "STALE" ? "STALE" : "FALLBACK",
    dataState: referenceState === "STALE" ? "STALE" : "FALLBACK",
    sourceTimestamp,
    sourceAgeSeconds,
    referenceState,
    referenceCondition,
    referenceType: "REGULAR_MARKET_PRICE",
    referenceBasis: "PREVIOUS_CLOSE",
    changeBasis: "PREVIOUS_CLOSE",
  };
}

async function eodhdReferenceQuote(item: CatalogItem): Promise<Quote | undefined> {
  const providerSymbol =
    EODHD_REFERENCE_SYMBOLS[item.symbol as keyof typeof EODHD_REFERENCE_SYMBOLS];
  const key = env.eodhdApiKey;
  if (!providerSymbol || !key) return undefined;
  try {
    let realtime: Record<string, unknown> | undefined;
    if (item.symbol === "XAGUSD") {
      const url = new URL(`https://eodhd.com/api/real-time/${providerSymbol}`);
      url.searchParams.set("api_token", key);
      url.searchParams.set("fmt", "json");
      const body = await fetchJson(url.toString(), 5_000);
      if (body && typeof body === "object" && !Array.isArray(body))
        realtime = body as Record<string, unknown>;
    }
    const rows = await eodhdDailyRows(item);
    return eodhdQuote(item, rows, providerSymbol, realtime);
  } catch {
    return undefined;
  }
}

async function eodhdReferenceCandles(
  item: CatalogItem,
  timeframe: ChartTimeframe,
  limit: number,
): Promise<
  | {
      provider: string;
      providerSymbol: string;
      timeframe: string;
      candles: Candle[];
    }
  | undefined
> {
  const providerSymbol =
    EODHD_REFERENCE_SYMBOLS[item.symbol as keyof typeof EODHD_REFERENCE_SYMBOLS];
  if (!providerSymbol) return undefined;
  if (timeframe !== "D1" && timeframe !== "W1" && timeframe !== "MN1") return undefined;
  const rows = await eodhdDailyRows(item);
  const daily = normalizeProviderCandles(
    rows.flatMap((row) => {
      const time = eodhdDateTimestamp(row.date);
      return time
        ? [
            {
              time,
              open: row.open,
              high: row.high,
              low: row.low,
              close: row.close,
              volume: row.volume,
            },
          ]
        : [];
    }),
  );
  if (!daily.length) return undefined;
  const aggregationSeconds =
    timeframe === "W1" ? 7 * 24 * 60 * 60 : timeframe === "MN1" ? 31 * 24 * 60 * 60 : 0;
  const candles = aggregateCandles(daily, aggregationSeconds).slice(-limit);
  return {
    provider: "EODHD",
    providerSymbol,
    timeframe,
    candles,
  };
}

const isChartTimeframe = (value: string): value is ChartTimeframe =>
  chartTimeframes.includes(value.toUpperCase() as ChartTimeframe);

function normalizeCandleLimit(limit: number): number {
  return Math.min(Math.max(Number.isFinite(limit) ? Math.floor(limit) : 500, 1), 1000);
}

function candleFreshnessWindowMs(timeframe: ChartTimeframe): number {
  return mt5ChartCandleFreshnessWindowMs(timeframe);
}

function fallbackPlan(timeframe: ChartTimeframe, provider: "Yahoo" | "Binance") {
  const plans: Record<ChartTimeframe, { range: string; interval: string; bucketSeconds?: number }> =
    {
      M1: { range: "7d", interval: "1m" },
      M5: { range: "60d", interval: "5m" },
      M15: { range: "60d", interval: "15m" },
      M30: { range: "60d", interval: "30m" },
      H1: { range: "730d", interval: provider === "Yahoo" ? "60m" : "1h" },
      H4: {
        range: "730d",
        interval: provider === "Yahoo" ? "60m" : "4h",
        bucketSeconds: provider === "Yahoo" ? 4 * 60 * 60 : undefined,
      },
      D1: { range: "10y", interval: provider === "Yahoo" ? "1d" : "1d" },
      W1: { range: "10y", interval: provider === "Yahoo" ? "1wk" : "1w" },
      MN1: { range: "20y", interval: provider === "Yahoo" ? "1mo" : "1M" },
    };
  return plans[timeframe];
}

export function normalizeProviderCandles(candles: Candle[]): Candle[] {
  const normalized: Candle[] = [];
  const seen = new Set<number>();
  let previousTime: number | undefined;
  for (const candle of Array.isArray(candles) ? candles : []) {
    if (!candle || typeof candle !== "object") continue;
    if (![candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
      continue;
    if (
      candle.time <= 0 ||
      candle.open <= 0 ||
      candle.high <= 0 ||
      candle.low <= 0 ||
      candle.close <= 0
    )
      continue;
    if (
      candle.high < candle.low ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close)
    )
      continue;
    if (seen.has(candle.time) || (previousTime !== undefined && candle.time <= previousTime))
      return [];
    seen.add(candle.time);
    previousTime = candle.time;
    normalized.push({
      ...candle,
      volume: Number.isFinite(candle.volume) && candle.volume >= 0 ? candle.volume : 0,
    });
  }
  return normalized;
}

export function aggregateCandles(candles: Candle[], bucketSeconds: number): Candle[] {
  if (!bucketSeconds) return normalizeProviderCandles(candles);
  const buckets = new Map<number, Candle>();
  for (const candle of normalizeProviderCandles(candles)) {
    const bucketTime = Math.floor(candle.time / bucketSeconds) * bucketSeconds;
    const current = buckets.get(bucketTime);
    if (!current) {
      buckets.set(bucketTime, { ...candle, time: bucketTime });
      continue;
    }
    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    current.close = candle.close;
    current.volume += candle.volume;
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

async function fetchJson(url: string, timeoutMs = 2500): Promise<unknown> {
  const response = await fetchWithRetry(
    url,
    { headers: { accept: "application/json", "user-agent": "TradifySignals/1.0" } },
    { timeoutMs, maxAttempts: 2 },
  );
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.json();
}

export async function fallbackQuote(item: CatalogItem): Promise<Quote | undefined> {
  const route = fallbackRoute(item);
  if (!route) return undefined;
  try {
    if (route.provider === "Binance") {
      const data = (await fetchJson(
        `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${route.providerSymbol}`,
      )) as Record<string, string>;
      const price = Number(data.lastPrice);
      const sourceTimestamp = Number(data.closeTime);
      if (!price || !Number.isFinite(sourceTimestamp) || sourceTimestamp <= 0) return undefined;
      const previous = Number(data.prevClosePrice) || price;
      const receivedAt = Date.now();
      const sourceAgeSeconds = Math.max(0, Math.floor((receivedAt - sourceTimestamp) / 1000));
      const { referenceState, referenceCondition } = classifyReference(item, sourceAgeSeconds);
      const quote: Quote = {
        symbol: item.symbol,
        brokerSymbol: route.providerSymbol,
        provider: "Binance",
        bid: price,
        ask: price,
        last: price,
        price,
        strategyPrice: price,
        displayPrice: price,
        change: price - previous,
        changePercent: Number(data.priceChangePercent) || 0,
        time: Math.floor(sourceTimestamp / 1000),
        receivedAt,
        status: referenceState === "STALE" ? "STALE" : "FALLBACK",
        dataState: referenceState === "STALE" ? "STALE" : "FALLBACK",
        sourceTimestamp: Math.floor(sourceTimestamp / 1000),
        sourceAgeSeconds,
        referenceState,
        referenceCondition,
        referenceType: "LAST_TRADE",
        referenceBasis: "USDT",
        changeBasis: "24H",
      };
      return quote;
    }
    const data = (await fetchJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(route.providerSymbol)}?range=1d&interval=1m`,
    )) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            regularMarketTime?: number;
            marketState?: string;
          };
        }>;
      };
    };
    const meta = data.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const sourceTimestamp = Number(meta?.regularMarketTime);
    if (!price || !Number.isFinite(sourceTimestamp) || sourceTimestamp <= 0) return undefined;
    const previous = Number(meta?.chartPreviousClose) || price;
    const receivedAt = Date.now();
    const sourceAgeSeconds = Math.max(0, Math.floor(receivedAt / 1000 - sourceTimestamp));
    const { referenceState, referenceCondition } = classifyReference(
      item,
      sourceAgeSeconds,
      meta?.marketState,
    );
    return {
      symbol: item.symbol,
      brokerSymbol: route.providerSymbol,
      provider: "Yahoo",
      bid: price,
      ask: price,
      last: price,
      price,
      strategyPrice: price,
      displayPrice: price,
      change: price - previous,
      changePercent: previous ? ((price - previous) / previous) * 100 : 0,
      time: sourceTimestamp,
      receivedAt,
      status: referenceState === "STALE" ? "STALE" : "FALLBACK",
      dataState: referenceState === "STALE" ? "STALE" : "FALLBACK",
      sourceTimestamp,
      sourceAgeSeconds,
      referenceState,
      referenceCondition,
      referenceType: "REGULAR_MARKET_PRICE",
      referenceBasis: "PREVIOUS_CLOSE",
      changeBasis: "PREVIOUS_CLOSE",
    };
  } catch {
    return undefined;
  }
}

async function alphaVantageGoldReference(item: CatalogItem): Promise<Quote | undefined> {
  if (item.symbol !== "XAUUSD") return undefined;
  if (goldReferenceCache && goldReferenceCache.expiresAt > Date.now())
    return goldReferenceCache.value;
  if (goldReferenceInFlight) return goldReferenceInFlight;
  goldReferenceInFlight = (async () => {
    const key = env.alphaVantageApiKey;
    if (!key) return undefined;
    try {
      const url = new URL("https://www.alphavantage.co/query");
      url.searchParams.set("function", "GOLD_SILVER_SPOT");
      url.searchParams.set("symbol", "GOLD");
      url.searchParams.set("apikey", key);
      const body = (await fetchJson(url.toString(), 5_000)) as Record<string, unknown>;
      const price = Number(body.price);
      const sourceTimestampMs = Date.parse(String(body.timestamp ?? ""));
      if (!(price > 0) || !Number.isFinite(sourceTimestampMs)) return undefined;
      const receivedAt = Date.now();
      const sourceTimestamp = Math.floor(sourceTimestampMs / 1000);
      const sourceAgeSeconds = Math.max(0, Math.floor((receivedAt - sourceTimestampMs) / 1000));
      const { referenceState, referenceCondition } = classifyReference(item, sourceAgeSeconds);
      const quote: Quote = {
        symbol: item.symbol,
        brokerSymbol: "XAUUSD",
        provider: "Alpha Vantage",
        bid: price,
        ask: price,
        last: price,
        price,
        strategyPrice: price,
        displayPrice: price,
        change: 0,
        changePercent: 0,
        time: sourceTimestamp,
        receivedAt,
        status: referenceState === "STALE" ? "STALE" : "FALLBACK",
        dataState: referenceState === "STALE" ? "STALE" : "FALLBACK",
        sourceTimestamp,
        sourceAgeSeconds,
        referenceState,
        referenceCondition,
        referenceType: "SPOT_REFERENCE",
        referenceBasis: "XAU_USD",
        changeBasis: "STREAM",
      };
      return quote;
    } catch {
      return undefined;
    }
  })()
    .then((value) => {
      goldReferenceCache = {
        expiresAt: Date.now() + (value ? FALLBACK_CACHE_TTL_MS : FALLBACK_FAILURE_TTL_MS),
        value,
      };
      return value;
    })
    .finally(() => {
      goldReferenceInFlight = undefined;
    });
  return goldReferenceInFlight;
}

export async function referenceQuote(item: CatalogItem): Promise<Quote | undefined> {
  return (
    (await fallbackQuote(item)) ??
    (await alphaVantageGoldReference(item)) ??
    (await eodhdReferenceQuote(item))
  );
}

export async function fallbackCandles(
  item: CatalogItem,
  timeframe: string,
  limit: number,
): Promise<
  { provider: "Yahoo" | "Binance"; providerSymbol: string; candles: Candle[] } | undefined
> {
  const route = fallbackRoute(item);
  if (!route) return undefined;
  const normalizedTimeframe = timeframe.toUpperCase();
  if (!isChartTimeframe(normalizedTimeframe)) return undefined;
  const requestedLimit = normalizeCandleLimit(limit);
  const cacheKey = `${item.symbol}:${normalizedTimeframe}:${requestedLimit}`;
  const cached = fallbackCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
      ? { ...cached.value, candles: cached.value.candles.slice(-requestedLimit) }
      : undefined;
  }
  const plan = fallbackPlan(normalizedTimeframe, route.provider);
  const requestedBars = Math.min(Math.max(requestedLimit, MINIMUM_COMPLETE_CANDLES), 1000);
  const sourceMultiplier = plan.bucketSeconds ? 4 : 1;
  try {
    let rows: unknown;
    if (route.provider === "Binance")
      rows = await fetchJson(
        `https://data-api.binance.vision/api/v3/klines?symbol=${route.providerSymbol}&interval=${plan.interval}&limit=${Math.min(requestedBars * sourceMultiplier + 8, 1000)}`,
      );
    else
      rows = await fetchJson(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(route.providerSymbol)}?range=${plan.range}&interval=${plan.interval}`,
      );
    const sourceCandles: Candle[] =
      route.provider === "Binance"
        ? (Array.isArray(rows) ? rows : []).flatMap((row) => {
            if (!Array.isArray(row)) return [];
            const time =
              normalizeExternalCandleOpenTime(
                row[0],
                "MILLISECONDS",
                "OPEN",
                normalizedTimeframe,
              ) || 0;
            return [
              {
                time,
                open: Number(row[1]),
                high: Number(row[2]),
                low: Number(row[3]),
                close: Number(row[4]),
                volume: Number(row[5]) || 0,
              },
            ];
          })
        : (() => {
            const result =
              rows && typeof rows === "object"
                ? (
                    rows as {
                      chart?: {
                        result?: Array<{
                          timestamp?: number[];
                          indicators?: {
                            quote?: Array<{
                              open?: Array<number | null>;
                              high?: Array<number | null>;
                              low?: Array<number | null>;
                              close?: Array<number | null>;
                              volume?: Array<number | null>;
                            }>;
                          };
                        }>;
                      };
                    }
                  ).chart?.result?.[0]
                : undefined;
            const timestamp = Array.isArray(result?.timestamp) ? result.timestamp : [];
            const quote = result?.indicators?.quote?.[0];
            return timestamp
              .map((time, index) => ({
                time:
                  normalizeExternalCandleOpenTime(time, "SECONDS", "OPEN", normalizedTimeframe) ||
                  0,
                open: Number(quote?.open?.[index]),
                high: Number(quote?.high?.[index]),
                low: Number(quote?.low?.[index]),
                close: Number(quote?.close?.[index]),
                volume: Number(quote?.volume?.[index]) || 0,
              }))
              .filter((c) => c.time > 0 && c.open > 0 && c.high >= c.low && c.close > 0);
          })();
    if (normalizedTimeframe === "M15" && sourceCandles.some((candle) => candle.time % 900 !== 0)) {
      fallbackCache.set(cacheKey, { expiresAt: Date.now() + FALLBACK_FAILURE_TTL_MS });
      return undefined;
    }
    const candles = aggregateCandles(sourceCandles, plan.bucketSeconds ?? 0).slice(-requestedBars);
    const result =
      candles.length >= Math.min(MINIMUM_COMPLETE_CANDLES, requestedBars)
        ? {
            provider: route.provider,
            providerSymbol: route.providerSymbol,
            candles: candles.slice(-requestedLimit),
          }
        : undefined;
    fallbackCache.set(cacheKey, {
      expiresAt: Date.now() + (result ? FALLBACK_CACHE_TTL_MS : FALLBACK_FAILURE_TTL_MS),
      value: result ? { ...result, candles } : undefined,
    });
    return result;
  } catch {
    fallbackCache.set(cacheKey, { expiresAt: Date.now() + FALLBACK_FAILURE_TTL_MS });
    return undefined;
  }
}

export async function getQuotes(includeReferences = true): Promise<Record<string, Quote>> {
  const result: Record<string, Quote> = {};
  const strategies = await assignedStrategies(catalogs.map((item) => item.symbol));
  await Promise.all(
    catalogs.map(async (item) => {
      const context = {
        canonicalSymbol: item.symbol,
        timeframe: "M15",
        strategyId: strategies.get(item.symbol) ?? "UNASSIGNED",
        // Quote display authority is independent from strategy authority. The
        // registry isolates this purpose's authority state so a live quote
        // cannot satisfy or contaminate the strict M15 strategy path.
        purpose: "QUOTE" as const,
        requestMetadata: {
          caller: includeReferences ? "quotes" : "live-quote-stream",
          reason: includeReferences
            ? "Customer quote/snapshot refresh."
            : "Authority-only live quote stream refresh.",
        },
      };
      const authority = await marketDataRegistry.resolveAuthority(context);
      if (authority.selectedProviderId) {
        const providerQuote = await marketDataRegistry.getQuote(
          authority.selectedProviderId,
          context,
        );
        if (providerQuote) {
          const receivedAt = Date.parse(providerQuote.receivedAt);
          const sourceTimestamp = Date.parse(providerQuote.timestamp);
          const quote: Quote = {
            symbol: item.symbol,
            brokerSymbol: providerQuote.providerSymbol,
            provider: providerQuote.provider,
            bid: providerQuote.bid ?? providerQuote.price,
            ask: providerQuote.ask ?? providerQuote.price,
            last: providerQuote.last ?? providerQuote.price,
            price: providerQuote.strategyPrice ?? providerQuote.price,
            strategyPrice: providerQuote.strategyPrice ?? providerQuote.price,
            displayPrice: providerQuote.displayPrice ?? providerQuote.price,
            change: providerQuote.change ?? 0,
            changePercent: providerQuote.changePercent ?? 0,
            time: Number.isFinite(sourceTimestamp)
              ? Math.floor(sourceTimestamp / 1000)
              : Math.floor(Date.now() / 1000),
            receivedAt: Number.isFinite(receivedAt) ? receivedAt : Date.now(),
            status:
              providerQuote.status === "LIVE"
                ? "LIVE"
                : providerQuote.status === "STALE"
                  ? "STALE"
                  : "UNAVAILABLE",
            dataState:
              providerQuote.dataState ?? (providerQuote.status === "LIVE" ? "LIVE" : "STALE"),
            sourceTimestamp: Number.isFinite(sourceTimestamp)
              ? Math.floor(sourceTimestamp / 1000)
              : undefined,
            sourceAgeSeconds: Number.isFinite(sourceTimestamp)
              ? Math.max(0, Math.floor((Date.now() - sourceTimestamp) / 1000))
              : undefined,
            changeBasis: "STREAM",
            priceBasis: providerQuote.priceBasis,
            provenance: authority.provenance,
          };
          if (quote.status === "LIVE" && quote.dataState === "LIVE" && quote.price > 0) {
            result[item.symbol] = quote;
            return;
          }
        }
      }
      const fallback = includeReferences ? await referenceQuote(item) : undefined;
      if (fallback) result[item.symbol] = fallback;
      else
        result[item.symbol] = {
          symbol: item.symbol,
          brokerSymbol: bridgeStore.getMappings()[item.symbol] ?? item.providerSymbol,
          provider: "NONE",
          bid: 0,
          ask: 0,
          last: 0,
          price: 0,
          strategyPrice: 0,
          displayPrice: 0,
          change: 0,
          changePercent: 0,
          time: Math.floor(Date.now() / 1000),
          receivedAt: Date.now(),
          status: "UNAVAILABLE",
          dataState: "ERROR",
          referenceState: "UNAVAILABLE",
          referenceCondition: "UNAVAILABLE",
          lastError: "No approved healthy authority or valid reference available",
        };
    }),
  );
  return result;
}

let liveQuotesCache: { expiresAt: number; value: Record<string, Quote> } | undefined;
let liveQuotesInFlight: Promise<Record<string, Quote>> | undefined;

export async function getLiveQuotes(): Promise<Record<string, Quote>> {
  if (liveQuotesCache && liveQuotesCache.expiresAt > Date.now()) return liveQuotesCache.value;
  if (liveQuotesInFlight) return liveQuotesInFlight;
  liveQuotesInFlight = getQuotes(false)
    .then((quotes) =>
      Object.fromEntries(
        Object.entries(quotes).filter(
          ([, quote]) =>
            quote.provenance?.authority === true &&
            quote.status === "LIVE" &&
            quote.dataState === "LIVE" &&
            quote.price > 0,
        ),
      ),
    )
    .then((quotes) => {
      liveQuotesCache = { expiresAt: Date.now() + 5_000, value: quotes };
      return quotes;
    })
    .finally(() => {
      liveQuotesInFlight = undefined;
    });
  return liveQuotesInFlight;
}

export function getMT5WatchlistQuotes(symbols: readonly string[]): Record<string, Quote> {
  if (!mt5BridgeStore.isConnected()) return {};

  const quotes: Record<string, Quote> = {};
  for (const symbolValue of symbols) {
    const symbol = symbolValue.trim();
    if (!symbol) continue;
    const quote = mt5BridgeStore.getFreshQuoteForExactBrokerSymbol(symbol);
    if (!quote || quote.displayPrice <= 0) continue;

    const now = Date.now();
    const sourceTimestamp = quote.time * 1_000;
    const timestampIsUsable = quote.time > 0 && sourceTimestamp <= now + 5_000;
    const sourceAgeSeconds = timestampIsUsable
      ? Math.max(0, (now - sourceTimestamp) / 1_000)
      : undefined;
    const isLive = sourceAgeSeconds !== undefined && sourceAgeSeconds <= 30;
    quotes[symbol] = {
      symbol,
      brokerSymbol: quote.symbol,
      provider: "MT5",
      bid: quote.bid,
      ask: quote.ask,
      last: quote.last,
      price: quote.displayPrice,
      strategyPrice: quote.strategyPrice,
      displayPrice: quote.displayPrice,
      change: quote.change,
      changePercent: quote.changePercent,
      time: quote.time,
      receivedAt: quote.receivedAt,
      status: isLive ? "LIVE" : "STALE",
      dataState: isLive ? "LIVE" : "STALE",
      ...(!isLive
        ? { referenceState: "STALE" as const, referenceCondition: "STALE_SOURCE" as const }
        : {}),
      ...(timestampIsUsable ? { sourceTimestamp } : {}),
      sourceAgeSeconds,
    };
  }
  return quotes;
}

export async function getCandles(
  symbol: string,
  timeframe: string,
  limit: number,
  strategyId = "DISPLAY",
) {
  const item = catalogItem(symbol);
  if (!item) return undefined;
  const normalizedTimeframe = timeframe.toUpperCase();
  if (!isChartTimeframe(normalizedTimeframe)) return undefined;
  const requestedLimit = normalizeCandleLimit(limit);
  const requestPurpose = strategyId === "DISPLAY" ? ("CANDLE" as const) : ("STRATEGY" as const);
  const authority = await marketDataRegistry.resolveAuthority({
    canonicalSymbol: item.symbol,
    timeframe: normalizedTimeframe,
    strategyId,
    purpose: requestPurpose,
    requestMetadata: {
      caller: strategyId === "DISPLAY" ? "chart" : "strategy-evaluation",
      reason:
        strategyId === "DISPLAY"
          ? `Customer chart request for ${item.symbol} ${normalizedTimeframe}.`
          : `Strategy candle evaluation for ${strategyId} on ${item.symbol} ${normalizedTimeframe}.`,
    },
  });
  if (authority.selectedProviderId) {
    const authoritative = await marketDataRegistry.getCandles(
      authority.selectedProviderId,
      {
        canonicalSymbol: item.symbol,
        timeframe: normalizedTimeframe,
        strategyId,
        purpose: requestPurpose,
      },
      requestedLimit,
      {
        caller: strategyId === "DISPLAY" ? "chart" : "strategy-evaluation",
        reason:
          strategyId === "DISPLAY"
            ? `Customer chart request for ${item.symbol} ${normalizedTimeframe}.`
            : `Strategy candle evaluation for ${strategyId} on ${item.symbol} ${normalizedTimeframe}.`,
      },
    );
    if (authoritative?.dataState === "LIVE") {
      return {
        ...authoritative,
        candles: authoritative.candles.slice(-requestedLimit),
        dataState: "LIVE" as const,
        displayOnly: false,
        validation: {
          valid: true,
          source: "PROVIDER_AUTHORITY",
          candleCount: authoritative.candles.length,
        },
        provenance: authority.provenance,
      };
    }
  }
  const fallback = await fallbackCandles(item, normalizedTimeframe, requestedLimit);
  if (fallback) {
    return {
      symbol: item.symbol,
      provider: fallback.provider,
      providerSymbol: fallback.providerSymbol,
      timeframe: normalizedTimeframe,
      timezone: "UTC",
      candles: fallback.candles.slice(-requestedLimit),
      dataState: "FALLBACK" as const,
      displayOnly: true,
      validation: {
        valid: false,
        source: "FALLBACK_DISPLAY_ONLY",
        reason: "Fallback candles are never used for strategy evaluation.",
        candleCount: fallback.candles.length,
      },
    };
  }
  if (strategyId === "DISPLAY") {
    const reference = await eodhdReferenceCandles(item, normalizedTimeframe, requestedLimit);
    if (reference) {
      return {
        symbol: item.symbol,
        provider: reference.provider,
        providerSymbol: reference.providerSymbol,
        timeframe: reference.timeframe,
        timezone: "UTC",
        candles: reference.candles,
        dataState: "FALLBACK" as const,
        displayOnly: true,
        validation: {
          valid: false,
          source: "REFERENCE_DISPLAY_ONLY",
          reason: "Reference candles are display-only and do not unlock strategy levels.",
          candleCount: reference.candles.length,
        },
      };
    }
  }
  return undefined;
}

export interface SignalCard {
  id: string;
  symbol: string;
  name: string;
  market: AssetClass;
  direction: "LONG" | "SHORT" | "NONE";
  strategy: string;
  strategyVersion?: string;
  grade: "A+" | "A" | "B";
  action: string;
  lifecycleStatus?: string;
  qualified?: boolean;
  price: number;
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  session: string;
  age: string;
  note: string;
  dataState: DataState;
  provider: string;
  providerSymbol?: string;
  buyGate?: number | null;
  sellGate?: number | null;
  targets?: number[];
  reasons?: string[];
  provenance?: Record<string, unknown>;
  strategyFacts?: Record<string, unknown>;
  dgv8ChartLevels?: Record<string, unknown>;
  dgv8LevelMap?: Record<string, unknown>;
  rawEngineSignal?: Record<string, unknown>;
}

export async function getSignals(existingQuotes?: Record<string, Quote>): Promise<SignalCard[]> {
  const quotes = existingQuotes ?? (await getQuotes());
  const evaluations = await evaluateCurrentSignals(undefined, undefined, quotes);
  return evaluations.map((evaluation) => toSignalCard(evaluation) as unknown as SignalCard);
}

const users = new Map<string, ServerUser>();

type StoredUser = typeof tradifyUsers.$inferSelect;
type Database = typeof db;

export class UserIdInUseError extends Error {
  constructor() {
    super("USER_ID_IN_USE");
    this.name = "UserIdInUseError";
  }
}

export class EmailInUseError extends Error {
  constructor() {
    super("EMAIL_IN_USE");
    this.name = "EmailInUseError";
  }
}

export class CustomerStateNotFoundError extends Error {
  constructor() {
    super("CUSTOMER_STATE_NOT_FOUND");
    this.name = "CustomerStateNotFoundError";
  }
}

export function discardUnpersistedUser(user: ServerUser): void {
  if (users.get(user.id) === user) users.delete(user.id);
}

function storedRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> =>
        Boolean(entry && typeof entry === "object" && !Array.isArray(entry)),
      )
    : [];
}

function storedStrings(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return [
    ...new Set(
      value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
    ),
  ];
}

function storedAlerts(value: unknown): PriceAlert[] {
  return storedRecords(value).flatMap((entry) => {
    const condition = entry.condition;
    if (
      typeof entry.id !== "string" ||
      typeof entry.symbol !== "string" ||
      !["ABOVE", "BELOW", "EXACT"].includes(String(condition)) ||
      typeof entry.target !== "number" ||
      !Number.isFinite(entry.target) ||
      typeof entry.label !== "string" ||
      typeof entry.active !== "boolean" ||
      typeof entry.createdAt !== "string"
    )
      return [];
    return [
      {
        id: entry.id,
        symbol: entry.symbol,
        condition: condition as PriceAlert["condition"],
        target: entry.target,
        label: entry.label,
        active: entry.active,
        createdAt: entry.createdAt,
      },
    ];
  });
}

function storedNotifications(value: unknown): UserNotification[] {
  return storedRecords(value).flatMap((entry) => {
    if (
      typeof entry.id !== "string" ||
      typeof entry.timestamp !== "number" ||
      !Number.isFinite(entry.timestamp) ||
      typeof entry.symbol !== "string" ||
      typeof entry.type !== "string" ||
      typeof entry.title !== "string" ||
      typeof entry.message !== "string" ||
      typeof entry.isRead !== "boolean"
    )
      return [];
    if (
      ![
        "NEW_SETUP",
        "STATUS_CHANGE",
        "RETEST_READY",
        "TRIGGERED",
        "TP_HIT",
        "SL_HIT",
        "INVALIDATED",
        "MARKET_WARNING",
      ].includes(entry.type)
    )
      return [];
    return [
      {
        id: entry.id,
        timestamp: entry.timestamp,
        timeLabel:
          typeof entry.timeLabel === "string"
            ? entry.timeLabel
            : notificationTimeLabel(entry.timestamp),
        symbol: entry.symbol,
        type: entry.type as NotificationType,
        title: entry.title,
        message: entry.message,
        ...(typeof entry.actionRequired === "string"
          ? { actionRequired: entry.actionRequired }
          : {}),
        isRead: entry.isRead,
        ...(typeof entry.signalId === "string" ? { signalId: entry.signalId } : {}),
      },
    ];
  });
}

function storedTrades(value: unknown): Trade[] {
  return storedRecords(value).flatMap((entry) => {
    if (
      typeof entry.id !== "string" ||
      typeof entry.symbol !== "string" ||
      !["LONG", "SHORT"].includes(String(entry.direction)) ||
      !["ACTIVE", "TP1 HIT", "CLOSED"].includes(String(entry.status)) ||
      !["number", "number", "number", "number", "number"].every(
        (type, index) => typeof entry[["entry", "stop", "target", "progress", "r"][index]] === type,
      ) ||
      !["entry", "stop", "target", "progress", "r"].every((key) => Number.isFinite(entry[key])) ||
      typeof entry.createdAt !== "string"
    )
      return [];
    return [
      {
        id: entry.id,
        symbol: entry.symbol,
        direction: entry.direction as Trade["direction"],
        entry: entry.entry as number,
        stop: entry.stop as number,
        target: entry.target as number,
        progress: entry.progress as number,
        r: entry.r as number,
        status: entry.status as Trade["status"],
        createdAt: entry.createdAt,
        ...(typeof entry.closedAt === "string" ? { closedAt: entry.closedAt } : {}),
      },
    ];
  });
}

function serverUserFromStored(stored: StoredUser): ServerUser {
  return {
    id: stored.id,
    email: stored.email,
    passwordHash: stored.passwordHash,
    profile: {
      name: stored.name,
      email: stored.email,
      accountSize: stored.accountSize,
      riskPercent: stored.riskPercent,
      maxDailyLoss: stored.maxDailyLoss,
      maxTrades: stored.maxTrades,
      aggressive: stored.aggressive,
      membership:
        stored.membership === "VIP" ? "VIP" : stored.membership === "Pro" ? "Pro" : "Free",
    },
    membershipSource:
      stored.membershipSource === "REVENUECAT" || stored.membershipSource === "ADMIN_OVERRIDE"
        ? stored.membershipSource
        : "UNKNOWN",
    ...(stored.subscriptionStatus
      ? { subscriptionStatus: stored.subscriptionStatus as SubscriptionStatus }
      : {}),
    ...(stored.billingEventId
      ? { billingExpiresAt: stored.billingExpiresAt }
      : stored.billingExpiresAt
        ? { billingExpiresAt: stored.billingExpiresAt }
        : {}),
    ...(stored.billingEventId ? { billingWillRenew: stored.billingWillRenew } : {}),
    ...(stored.billingEventId ? { billingEventId: stored.billingEventId } : {}),
    ...(stored.billingEventTimestamp
      ? { billingEventTimestamp: stored.billingEventTimestamp }
      : {}),
    trialEndsAt: stored.trialEndsAt,
    overrideEndsAt: stored.overrideEndsAt,
    entitlementGrants: Array.isArray(stored.entitlementGrants) ? stored.entitlementGrants : [],
    entitlementDenies: Array.isArray(stored.entitlementDenies) ? stored.entitlementDenies : [],
    role: stored.role === "admin" ? "admin" : "user",
    status:
      stored.status === "deleted"
        ? "deleted"
        : stored.status === "banned"
          ? "banned"
          : stored.status === "suspended"
            ? "suspended"
            : "active",
    riskDisclaimerVersion: stored.riskDisclaimerVersion ?? null,
    riskDisclaimerAcceptedAt: stored.riskDisclaimerAcceptedAt ?? null,
    entitlements: Array.isArray(stored.entitlements) ? stored.entitlements : [],
    createdAt: stored.createdAt,
    lastSeenAt: stored.lastSeenAt,
    ...(stored.authInvalidBefore ? { authInvalidBefore: stored.authInvalidBefore } : {}),
    ...(stored.deletedAt ? { deletedAt: stored.deletedAt } : {}),
    ...(stored.adminUpdatedBy ? { adminUpdatedBy: stored.adminUpdatedBy } : {}),
    ...(stored.adminUpdatedAt ? { adminUpdatedAt: stored.adminUpdatedAt } : {}),
    version: stored.version,
    watchlist: new Set(storedStrings(stored.watchlist, [...FREE_STARTER_SYMBOLS])),
    alertSymbols: new Set(storedStrings(stored.alertSymbols, ["XAUUSD"])),
    alerts: storedAlerts(stored.alerts),
    notifications: storedNotifications(stored.notifications),
    trades: storedTrades(stored.trades),
  };
}

export interface AdminAuditEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetUserId?: string;
  targetEmail?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

function normalizeAdminAuditDetails(details: unknown): Record<string, unknown> {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return { ...(details as Record<string, unknown>) };
}

const revenueCatLifecycleEventTypes = new Set([
  "INITIAL_PURCHASE",
  "NON_RENEWING_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "CANCELLATION",
  "BILLING_ISSUE",
  "SUBSCRIPTION_PAUSED",
  "EXPIRATION",
  "UNKNOWN",
]);
const revenueCatLifecycleOutcomes = new Set(["processed", "duplicate", "stale", "ignored"]);

function normalizeAdminAuditEntryDetails(
  action: string,
  details: unknown,
): Record<string, unknown> {
  const normalized = normalizeAdminAuditDetails(details);
  if (action !== "BILLING_WEBHOOK_OUTCOME") return normalized;

  return {
    eventType:
      typeof normalized.eventType === "string" &&
      revenueCatLifecycleEventTypes.has(normalized.eventType)
        ? normalized.eventType
        : "UNKNOWN",
    ...(typeof normalized.outcome === "string" &&
    revenueCatLifecycleOutcomes.has(normalized.outcome)
      ? { outcome: normalized.outcome }
      : {}),
  };
}

export type AdminNoteCategory = "GENERAL" | "BILLING" | "COMPLIANCE" | "SUPPORT" | "RISK";

export interface AdminUserNote {
  id: string;
  userId: string;
  category: AdminNoteCategory;
  body: string;
  authorEmail: string;
  createdAt: string;
}

const runtimeReady = (async () => {
  await engineStateReady;
  const storedUsers = await db.select().from(tradifyUsers);
  for (const stored of storedUsers) {
    const hydrated = serverUserFromStored(stored);
    users.set(hydrated.id, hydrated);
  }
})();

export async function ensureRuntimeReady(): Promise<void> {
  await runtimeReady;
  await ensureControlPlaneReady();
}

export async function persistUser(
  user: ServerUser,
  expectedVersion = user.version,
  adminDecision?: { updatedBy: string; updatedAt: string },
  database: Database = db,
): Promise<void> {
  if (adminDecision) {
    user.adminUpdatedBy = adminDecision.updatedBy;
    user.adminUpdatedAt = adminDecision.updatedAt;
  }
  const values = {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    name: user.profile.name,
    accountSize: user.profile.accountSize,
    riskPercent: user.profile.riskPercent,
    maxDailyLoss: user.profile.maxDailyLoss,
    maxTrades: user.profile.maxTrades,
    aggressive: user.profile.aggressive,
    membership: user.profile.membership,
    membershipSource: user.membershipSource ?? "UNKNOWN",
    subscriptionStatus: user.subscriptionStatus,
    billingExpiresAt: user.billingExpiresAt,
    billingWillRenew: user.billingWillRenew,
    billingEventId: user.billingEventId,
    billingEventTimestamp: user.billingEventTimestamp,
    trialEndsAt: user.trialEndsAt,
    overrideEndsAt: user.overrideEndsAt,
    role: user.role,
    status: user.status,
    riskDisclaimerVersion: user.riskDisclaimerVersion ?? null,
    riskDisclaimerAcceptedAt: user.riskDisclaimerAcceptedAt ?? null,
    entitlements: [...user.entitlements],
    entitlementGrants: [...user.entitlementGrants],
    entitlementDenies: [...user.entitlementDenies],
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
    authInvalidBefore: user.authInvalidBefore,
    deletedAt: user.deletedAt,
    adminUpdatedBy: user.adminUpdatedBy,
    adminUpdatedAt: user.adminUpdatedAt,
    watchlist: [...user.watchlist],
    alertSymbols: [...user.alertSymbols],
    alerts: user.alerts.map((alert) => ({ ...alert })),
    notifications: user.notifications.map((notification) => ({ ...notification })),
    trades: user.trades.map((trade) => ({ ...trade })),
  };
  const [updated] = await database
    .update(tradifyUsers)
    .set({
      email: values.email,
      passwordHash: values.passwordHash,
      name: values.name,
      accountSize: values.accountSize,
      riskPercent: values.riskPercent,
      maxDailyLoss: values.maxDailyLoss,
      maxTrades: values.maxTrades,
      aggressive: values.aggressive,
      membership: values.membership,
      membershipSource: values.membershipSource,
      subscriptionStatus: values.subscriptionStatus,
      billingExpiresAt: values.billingExpiresAt,
      billingWillRenew: values.billingWillRenew,
      billingEventId: values.billingEventId,
      billingEventTimestamp: values.billingEventTimestamp,
      trialEndsAt: values.trialEndsAt,
      overrideEndsAt: values.overrideEndsAt,
      role: values.role,
      status: values.status,
      riskDisclaimerVersion: values.riskDisclaimerVersion,
      riskDisclaimerAcceptedAt: values.riskDisclaimerAcceptedAt,
      entitlements: values.entitlements,
      entitlementGrants: values.entitlementGrants,
      entitlementDenies: values.entitlementDenies,
      createdAt: values.createdAt,
      lastSeenAt: values.lastSeenAt,
      authInvalidBefore: values.authInvalidBefore,
      deletedAt: values.deletedAt,
      ...(adminDecision
        ? { adminUpdatedBy: values.adminUpdatedBy, adminUpdatedAt: values.adminUpdatedAt }
        : {}),
      watchlist: values.watchlist,
      alertSymbols: values.alertSymbols,
      alerts: values.alerts,
      notifications: values.notifications,
      trades: values.trades,
      version: sql`${tradifyUsers.version} + 1`,
    })
    .where(and(eq(tradifyUsers.id, user.id), eq(tradifyUsers.version, expectedVersion)))
    .returning({ version: tradifyUsers.version });
  if (updated) {
    syncPersistedUser(user, updated.version);
    return;
  }

  const [existing] = await database
    .select({ version: tradifyUsers.version })
    .from(tradifyUsers)
    .where(eq(tradifyUsers.id, user.id))
    .limit(1);
  if (existing) {
    if (expectedVersion === 0) {
      throw new UserIdInUseError();
    }
    throw new ConcurrentUpdateError("user controls");
  }

  let inserted: { version: number } | undefined;
  try {
    [inserted] = await database
      .insert(tradifyUsers)
      .values({ ...values, version: 1 })
      .onConflictDoNothing({ target: tradifyUsers.id })
      .returning({ version: tradifyUsers.version });
  } catch (error) {
    const databaseError = error as { code?: string; constraint?: string };
    if (databaseError.code === "23505" && databaseError.constraint?.includes("email")) {
      throw new EmailInUseError();
    }
    throw error;
  }
  if (!inserted) {
    throw new UserIdInUseError();
  }
  syncPersistedUser(user, inserted.version);
}

function syncPersistedUser(source: ServerUser, version: number): void {
  source.version = version;
  const current = users.get(source.id);
  if (!current || current === source) return;
  current.email = source.email;
  current.passwordHash = source.passwordHash;
  current.profile = { ...source.profile };
  current.membershipSource = source.membershipSource;
  current.subscriptionStatus = source.subscriptionStatus;
  current.billingExpiresAt = source.billingExpiresAt;
  current.billingWillRenew = source.billingWillRenew;
  current.billingEventId = source.billingEventId;
  current.billingEventTimestamp = source.billingEventTimestamp;
  current.trialEndsAt = source.trialEndsAt;
  current.overrideEndsAt = source.overrideEndsAt;
  current.role = source.role;
  current.status = source.status;
  current.riskDisclaimerVersion = source.riskDisclaimerVersion;
  current.riskDisclaimerAcceptedAt = source.riskDisclaimerAcceptedAt;
  current.entitlements = [...source.entitlements];
  current.entitlementGrants = [...source.entitlementGrants];
  current.entitlementDenies = [...source.entitlementDenies];
  current.createdAt = source.createdAt;
  current.lastSeenAt = source.lastSeenAt;
  current.authInvalidBefore = source.authInvalidBefore;
  current.deletedAt = source.deletedAt;
  current.adminUpdatedBy = source.adminUpdatedBy;
  current.adminUpdatedAt = source.adminUpdatedAt;
  current.watchlist = new Set(source.watchlist);
  current.alertSymbols = new Set(source.alertSymbols);
  current.alerts = source.alerts.map((alert) => ({ ...alert }));
  current.notifications = source.notifications.map((notification) => ({ ...notification }));
  current.trades = source.trades.map((trade) => ({ ...trade }));
  current.version = version;
}

export async function updateCustomerState<T>(
  userId: string,
  mutate: (user: ServerUser) => T | Promise<T>,
): Promise<{ user: ServerUser; result: T }> {
  let lastConflict: ConcurrentUpdateError | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const [stored] = await db
      .select()
      .from(tradifyUsers)
      .where(eq(tradifyUsers.id, userId))
      .limit(1);
    if (!stored) throw new CustomerStateNotFoundError();
    const candidate = serverUserFromStored(stored);
    const result = await mutate(candidate);
    try {
      await persistUser(candidate, candidate.version);
      return { user: candidate, result };
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError)) throw error;
      lastConflict = error;
      if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 5 * (attempt + 1)));
    }
  }
  throw lastConflict ?? new ConcurrentUpdateError("customer state");
}

export async function persistLastSeen(user: ServerUser): Promise<void> {
  await db
    .update(tradifyUsers)
    .set({ lastSeenAt: user.lastSeenAt })
    .where(eq(tradifyUsers.id, user.id));
}

function notificationTimeLabel(timestamp: number): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  return `${Math.floor(elapsedHours / 24)}d`;
}

const SCRYPT_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const LEGACY_SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const BCRYPT_PATTERN = /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/u;

function legacyPasswordHash(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function scryptPassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

async function hashPassword(password: string): Promise<string> {
  return hashBcrypt(password, 12);
}

async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; replacementHash?: string }> {
  if (BCRYPT_PATTERN.test(storedHash)) {
    return { valid: await compareBcrypt(password, storedHash) };
  }

  if (storedHash.startsWith(`${SCRYPT_PREFIX}$`)) {
    const [prefix, rawCost, rawBlockSize, rawParallelization, rawSalt, rawHash] =
      storedHash.split("$");
    const cost = Number(rawCost);
    const blockSize = Number(rawBlockSize);
    const parallelization = Number(rawParallelization);
    if (
      prefix !== SCRYPT_PREFIX ||
      cost !== SCRYPT_COST ||
      blockSize !== SCRYPT_BLOCK_SIZE ||
      parallelization !== SCRYPT_PARALLELIZATION ||
      !rawSalt ||
      !rawHash
    ) {
      return { valid: false };
    }
    const expected = Buffer.from(rawHash, "base64url");
    if (expected.length !== SCRYPT_KEY_LENGTH) return { valid: false };
    const actual = await scryptPassword(password, Buffer.from(rawSalt, "base64url"));
    const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    return valid
      ? { valid: true, replacementHash: await hashPassword(password) }
      : { valid: false };
  }

  if (!LEGACY_SHA256_PATTERN.test(storedHash)) return { valid: false };
  const actual = Buffer.from(legacyPasswordHash(password), "hex");
  const expected = Buffer.from(storedHash, "hex");
  const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  return valid ? { valid: true, replacementHash: await hashPassword(password) } : { valid: false };
}

function sessionSecret(): string {
  const configured = env.sessionSecret;
  if (configured) return configured;
  if (env.isProduction) {
    throw new Error("SESSION_SECRET_REQUIRED");
  }
  return "tradify-dev-session";
}

const MAX_REQUESTED_USER_ID_LENGTH = 255;

function normalizeRequestedUserId(requestedId: unknown): string | undefined {
  if (requestedId === undefined) return undefined;
  if (typeof requestedId !== "string") throw new Error("INVALID_USER_ID");
  const normalized = requestedId.trim();
  if (
    !normalized ||
    normalized.length > MAX_REQUESTED_USER_ID_LENGTH ||
    /\s/u.test(normalized) ||
    /[\u0000-\u001F\u007F]/u.test(normalized)
  ) {
    throw new Error("INVALID_USER_ID");
  }
  return normalized;
}

async function userForEmail(email: string): Promise<ServerUser | undefined> {
  const normalized = email.trim().toLowerCase();
  const cached = Array.from(users.values()).find((user) => user.email === normalized);
  if (cached) return cached;
  const [stored] = await db
    .select()
    .from(tradifyUsers)
    .where(eq(tradifyUsers.email, normalized))
    .limit(1);
  if (!stored) return undefined;
  const hydrated = serverUserFromStored(stored);
  users.set(hydrated.id, hydrated);
  return hydrated;
}

function createUser(email: string, requestedId?: unknown): ServerUser {
  const normalized = email.trim().toLowerCase();
  const normalizedRequestedId = normalizeRequestedUserId(requestedId);
  const existingById = normalizedRequestedId ? users.get(normalizedRequestedId) : undefined;
  if (existingById) throw new Error("USER_ID_IN_USE");
  const id = normalizedRequestedId || crypto.randomUUID();
  const now = new Date().toISOString();
  const user: ServerUser = {
    id,
    email: normalized,
    passwordHash: "",
    profile: {
      name: normalized.split("@")[0] || "Trader",
      email: normalized,
      accountSize: 10000,
      riskPercent: 0.5,
      maxDailyLoss: 2,
      maxTrades: 3,
      aggressive: false,
      membership: "Free",
    },
    subscriptionStatus: "TRIALING",
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    entitlementGrants: [],
    entitlementDenies: [],
    role: "user",
    status: "active",
    riskDisclaimerVersion: null,
    riskDisclaimerAcceptedAt: null,
    entitlements: [],
    createdAt: now,
    lastSeenAt: now,
    watchlist: new Set(currentFreeStarterSymbols()),
    alertSymbols: new Set(),
    alerts: [],
    notifications: [],
    trades: [],
    version: 0,
  };
  users.set(id, user);
  return user;
}

export async function authenticate(
  email: string,
  password: string,
  register = false,
  requestedId?: unknown,
  sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000,
): Promise<{ token: string; user: ServerUser }> {
  if (!email.includes("@") || password.length < 6) throw new Error("INVALID_CREDENTIALS");
  const normalizedEmail = email.trim().toLowerCase();
  if (!env.isProduction && normalizedEmail === "preview@tradify.app") {
    throw new Error("INVALID_CREDENTIALS");
  }
  let user = await userForEmail(normalizedEmail);
  if (register) {
    if (user) throw new EmailInUseError();
    user = createUser(normalizedEmail, requestedId);
    user.passwordHash = await hashPassword(password);
  } else {
    if (!user) throw new Error("INVALID_CREDENTIALS");
    const verification = await verifyPassword(password, user.passwordHash);
    if (!verification.valid) throw new Error("INVALID_CREDENTIALS");
    if (verification.replacementHash) user.passwordHash = verification.replacementHash;
  }

  const expiresAt = Date.now() + sessionLifetimeMs;
  const issuedAt = Date.now();
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, exp: expiresAt, iat: issuedAt }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  const token = `${payload}.${signature}`;
  return { token, user };
}

export async function userFromToken(token: string | undefined): Promise<ServerUser | undefined> {
  if (!token) return undefined;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      exp?: unknown;
      iat?: unknown;
    };
    if (
      typeof parsed.sub !== "string" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.iat !== "number" ||
      !Number.isFinite(parsed.exp) ||
      !Number.isFinite(parsed.iat) ||
      parsed.exp <= Date.now()
    )
      return undefined;
    const [stored] = await db
      .select()
      .from(tradifyUsers)
      .where(eq(tradifyUsers.id, parsed.sub))
      .limit(1);
    if (!stored) return undefined;
    const invalidBefore = stored.authInvalidBefore
      ? Date.parse(stored.authInvalidBefore)
      : Number.NaN;
    if (Number.isFinite(invalidBefore) && parsed.iat <= invalidBefore) return undefined;
    const hydrated = serverUserFromStored(stored);
    const current = users.get(hydrated.id);
    const user = current ?? hydrated;
    if (current) syncPersistedUser(hydrated, stored.version);
    else users.set(hydrated.id, hydrated);
    user.lastSeenAt = new Date().toISOString();
    return user;
  } catch {
    return undefined;
  }
}

export async function revokeUserSessions(user: ServerUser): Promise<void> {
  const invalidBefore = new Date().toISOString();
  await db
    .update(tradifyUsers)
    .set({ authInvalidBefore: invalidBefore })
    .where(eq(tradifyUsers.id, user.id));
  user.authInvalidBefore = invalidBefore;
}

const PASSWORD_RESET_TOKEN_TTL_MS = 20 * 60 * 1000;

function passwordResetTokenHash(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createPasswordResetToken(
  userId: string,
  options: { allowInactive?: boolean } = {},
): Promise<{ token: string; email: string } | undefined> {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = passwordResetTokenHash(token);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS).toISOString();

  return db.transaction(async (transaction) => {
    const [stored] = await transaction
      .select()
      .from(tradifyUsers)
      .where(eq(tradifyUsers.id, userId))
      .for("update")
      .limit(1);
    if (!stored || stored.deletedAt || (!options.allowInactive && stored.status !== "active"))
      return undefined;

    await transaction
      .delete(tradifyPasswordResetTokens)
      .where(eq(tradifyPasswordResetTokens.userId, userId));
    await transaction.insert(tradifyPasswordResetTokens).values({
      tokenHash,
      userId,
      createdAt,
      expiresAt,
      consumedAt: null,
    });
    return { token, email: stored.email };
  });
}

export async function revokePasswordResetToken(token: string): Promise<void> {
  const consumedAt = new Date().toISOString();
  await db
    .update(tradifyPasswordResetTokens)
    .set({ consumedAt })
    .where(
      and(
        eq(tradifyPasswordResetTokens.tokenHash, passwordResetTokenHash(token)),
        isNull(tradifyPasswordResetTokens.consumedAt),
      ),
    );
}

export async function completePasswordReset(token: string, password: string): Promise<string | false> {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token) || password.length < 12 || password.length > 128) {
    return false;
  }

  const tokenHash = passwordResetTokenHash(token);
  const now = new Date().toISOString();
  const [candidate] = await db
    .select({ tokenHash: tradifyPasswordResetTokens.tokenHash })
    .from(tradifyPasswordResetTokens)
    .where(
      and(
        eq(tradifyPasswordResetTokens.tokenHash, tokenHash),
        isNull(tradifyPasswordResetTokens.consumedAt),
        gt(tradifyPasswordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);
  if (!candidate) return false;

  const passwordHash = await hashPassword(password);
  const invalidBefore = new Date().toISOString();
  const updated = await db.transaction(async (transaction) => {
    const [consumed] = await transaction
      .update(tradifyPasswordResetTokens)
      .set({ consumedAt: invalidBefore })
      .where(
        and(
          eq(tradifyPasswordResetTokens.tokenHash, tokenHash),
          isNull(tradifyPasswordResetTokens.consumedAt),
          gt(tradifyPasswordResetTokens.expiresAt, invalidBefore),
        ),
      )
      .returning({ userId: tradifyPasswordResetTokens.userId });
    if (!consumed) return undefined;

    const [user] = await transaction
      .update(tradifyUsers)
      .set({
        passwordHash,
        authInvalidBefore: invalidBefore,
        version: sql`${tradifyUsers.version} + 1`,
      })
      .where(and(eq(tradifyUsers.id, consumed.userId), isNull(tradifyUsers.deletedAt)))
      .returning();
    if (!user) return undefined;

    await transaction
      .delete(tradifyPasswordResetTokens)
      .where(eq(tradifyPasswordResetTokens.userId, consumed.userId));
    return user;
  });
  if (!updated) return false;

  const hydrated = serverUserFromStored(updated);
  const current = users.get(hydrated.id);
  if (current) syncPersistedUser(hydrated, updated.version);
  else users.set(hydrated.id, hydrated);
  await queueSignalsLinkRevocations(hydrated.id, "security_action");
  return hydrated.id;
}

export async function completeAccountDeletion(
  user: ServerUser,
  source: "IN_APP" = "IN_APP",
): Promise<{ requestId: string; completedAt: string }> {
  const completedAt = new Date().toISOString();
  const requestId = crypto.randomUUID();
  const anonymizedEmail = `deleted+${user.id}@invalid.tradify`;
  const invalidPassword = `deleted$${crypto.randomBytes(24).toString("base64url")}`;

  await db.transaction(async (transaction) => {
    const links = await transaction
      .select({ linkId: tradifyProductLinks.linkId, state: tradifyProductLinks.state })
      .from(tradifyProductLinks)
      .where(
        and(
          eq(tradifyProductLinks.userId, user.id),
          inArray(tradifyProductLinks.state, ["active", "awaiting_journal_confirmation"]),
        ),
      );
    for (const link of links) {
      const eventId = crypto.randomUUID();
      await transaction
        .update(tradifyProductLinks)
        .set({ state: "revocation_pending", updatedAt: new Date(completedAt) })
        .where(eq(tradifyProductLinks.linkId, link.linkId));
      await transaction.insert(tradifyLinkRevocationOutbox).values({
        eventId,
        linkId: link.linkId,
        userId: user.id,
        reason: "account_deleted",
        canonicalPayload: canonicalRevocationPayload({
          contractVersion: LINK_CONTRACT,
          linkId: link.linkId,
          eventId,
          reason: "account_deleted",
        }),
        payloadSha256: revocationPayloadHash(canonicalRevocationPayload({
          contractVersion: LINK_CONTRACT,
          linkId: link.linkId,
          eventId,
          reason: "account_deleted",
        })),
        state: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(completedAt),
        updatedAt: new Date(completedAt),
      });
    }

    const [updated] = await transaction
      .update(tradifyUsers)
      .set({
        email: anonymizedEmail,
        passwordHash: invalidPassword,
        name: "Deleted account",
        accountSize: 0,
        riskPercent: 0,
        maxDailyLoss: 0,
        maxTrades: 0,
        aggressive: false,
        membership: "Free",
        membershipSource: "UNKNOWN",
        subscriptionStatus: "EXPIRED",
        billingExpiresAt: null,
        billingWillRenew: false,
        billingEventId: null,
        billingEventTimestamp: null,
        trialEndsAt: null,
        overrideEndsAt: null,
        role: "user",
        status: "deleted",
        entitlements: [],
        entitlementGrants: [],
        entitlementDenies: [],
        lastSeenAt: completedAt,
        authInvalidBefore: completedAt,
        deletedAt: completedAt,
        watchlist: [],
        alertSymbols: [],
        alerts: [],
        notifications: [],
        trades: [],
        version: sql`${tradifyUsers.version} + 1`,
      })
      .where(and(eq(tradifyUsers.id, user.id), eq(tradifyUsers.version, user.version)))
      .returning({ version: tradifyUsers.version });
    if (!updated) throw new ConcurrentUpdateError("account deletion");

    await transaction.insert(tradifyAccountDeletionRequests).values({
      id: requestId,
      userId: user.id,
      email: null,
      status: "COMPLETED",
      source,
      requestedAt: completedAt,
      completedAt,
    });
    await transaction.insert(tradifyAdminAuditEvents).values({
      id: crypto.randomUUID(),
      actorId: "system:account-deletion",
      actorEmail: "account-deletion",
      action: "ACCOUNT_DELETION_COMPLETED",
      targetUserId: user.id,
      targetEmail: anonymizedEmail,
      details: {
        source,
        deletedAt: completedAt,
        dataAction: "account data anonymized and customer state cleared",
        retained:
          "billing and security audit records may be retained where required for legal, financial, fraud-prevention, or security obligations",
        subscriptionAction:
          "store subscription cancellation is separate and must be completed by the customer in Apple or Google account settings",
      },
      createdAt: completedAt,
    });
  });

  users.delete(user.id);
  return { requestId, completedAt };
}

export async function createPublicAccountDeletionRequest(
  email: string,
): Promise<{ requestId: string; knownAccount: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (
    !normalizedEmail ||
    normalizedEmail.length > 320 ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(normalizedEmail)
  ) {
    throw new Error("INVALID_EMAIL");
  }
  const existing = await userForEmail(normalizedEmail);
  const requestId = crypto.randomUUID();
  const knownAccount = Boolean(existing && existing.status !== "deleted");
  await db.insert(tradifyAccountDeletionRequests).values({
    id: requestId,
    userId: knownAccount ? (existing?.id ?? null) : null,
    email: normalizedEmail,
    status: "PENDING",
    source: "PUBLIC_WEB",
    requestedAt: new Date().toISOString(),
    completedAt: null,
  });
  return { requestId, knownAccount };
}

export function publicUser(user: ServerUser) {
  return {
    id: user.id,
    ...user.profile,
    role: user.role,
    status: user.status,
    riskDisclaimerVersion: user.riskDisclaimerVersion ?? null,
    riskDisclaimerAcceptedAt: user.riskDisclaimerAcceptedAt ?? null,
    entitlements: [...user.entitlements],
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
    watchlist: [...user.watchlist],
    alertSymbols: [...user.alertSymbols],
    alerts: user.alerts.map((alert) => ({ ...alert })),
    trades: user.trades.map((trade) => ({ ...trade })),
  };
}

export function adminSubscriptionStatus(
  user: Pick<
    ServerUser,
    "profile" | "createdAt" | "subscriptionStatus" | "trialEndsAt" | "overrideEndsAt"
  >,
): SubscriptionStatus {
  if (
    user.subscriptionStatus === "PAST_DUE" ||
    user.subscriptionStatus === "CANCELLED" ||
    user.subscriptionStatus === "EXPIRED"
  )
    return user.subscriptionStatus;
  if (
    user.subscriptionStatus === "TRIALING" &&
    user.trialEndsAt &&
    Date.parse(user.trialEndsAt) > Date.now()
  )
    return "TRIALING";
  if (user.overrideEndsAt && Date.parse(user.overrideEndsAt) > Date.now()) return "ACTIVE";
  if (user.profile.membership === "Pro" || user.profile.membership === "VIP") return "ACTIVE";
  if (user.trialEndsAt && Date.parse(user.trialEndsAt) > Date.now()) return "TRIALING";
  const createdAt = Date.parse(user.createdAt);
  return Number.isFinite(createdAt) && Date.now() - createdAt <= 14 * 24 * 60 * 60 * 1000
    ? "TRIALING"
    : "CANCELLED";
}

export function getUserById(id: string) {
  return users.get(id);
}

export type RevenueCatTransferLockOutcome = "ACQUIRED" | "WAITED" | "FAILED";

export interface RevenueCatTransferLockDiagnostics {
  outcome: RevenueCatTransferLockOutcome;
  waitMs: number;
  participantCount: number;
}

export function createRevenueCatTransferLockDiagnostics(
  participantIds: string[],
): RevenueCatTransferLockDiagnostics {
  return {
    outcome: "ACQUIRED",
    waitMs: 0,
    participantCount: new Set(participantIds.filter(Boolean)).size,
  };
}

/**
 * Acquire the same participant locks for every transfer reconciler, including
 * reconcilers running in different API instances. The lock is transaction
 * scoped so a dropped connection cannot leave a billing account blocked.
 */
export async function withRevenueCatTransferLock<T>(
  participantIds: string[],
  callback: (database: Database) => Promise<T>,
  diagnostics = createRevenueCatTransferLockDiagnostics(participantIds),
): Promise<T> {
  const lockIds = [...new Set(participantIds)].filter(Boolean).sort();
  let locksAcquired = false;
  try {
    return await db.transaction(async (transaction) => {
      try {
        for (const participantId of lockIds) {
          const lockKey = sql`hashtextextended(${`tradify-revenuecat:${participantId}`}, 0)`;
          const probe = await transaction.execute(
            sql`SELECT pg_try_advisory_xact_lock(${lockKey}) AS acquired`,
          );
          const acquired = Boolean(
            (probe as unknown as { rows?: Array<{ acquired?: boolean }> }).rows?.[0]?.acquired,
          );
          if (acquired) continue;
          const waitStartedAt = Date.now();
          await transaction.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
          diagnostics.waitMs += Math.max(0, Date.now() - waitStartedAt);
          diagnostics.outcome = "WAITED";
        }
      } catch (error) {
        diagnostics.outcome = "FAILED";
        throw error;
      }
      if (diagnostics.outcome !== "WAITED") diagnostics.waitMs = 0;
      locksAcquired = true;
      return callback(transaction as unknown as Database);
    });
  } catch (error) {
    // A transaction can fail before its callback runs. Keep that failure
    // visible to the caller without treating callback/provider failures as
    // lock-acquisition failures.
    if (!locksAcquired && diagnostics.outcome !== "FAILED") {
      diagnostics.outcome = "FAILED";
    }
    throw error;
  }
}

/**
 * Read transfer participants after acquiring the shared transfer lock. This
 * refreshes the process-local cache from the database before version checks so
 * an instance with an older snapshot cannot reapply stale membership state.
 */
export async function getRevenueCatTransferUsers(
  participantIds: string[],
  database: Database = db,
): Promise<Map<string, ServerUser>> {
  const ids = [...new Set(participantIds)].filter(Boolean);
  if (!ids.length) return new Map();
  const storedUsers = await database
    .select()
    .from(tradifyUsers)
    .where(inArray(tradifyUsers.id, ids));
  const result = new Map<string, ServerUser>();
  for (const stored of storedUsers) {
    const hydrated = serverUserFromStored(stored);
    const current = users.get(stored.id);
    if (current) {
      syncPersistedUser(hydrated, stored.version);
      result.set(stored.id, current);
    } else {
      users.set(hydrated.id, hydrated);
      result.set(hydrated.id, hydrated);
    }
  }
  return result;
}

export async function getLatestAdminUserDecision(
  userId: string,
): Promise<{ version: number; updatedBy: string; updatedAt: string } | undefined> {
  const [user] = await db
    .select({
      version: tradifyUsers.version,
      updatedBy: tradifyUsers.adminUpdatedBy,
      updatedAt: tradifyUsers.adminUpdatedAt,
    })
    .from(tradifyUsers)
    .where(eq(tradifyUsers.id, userId))
    .limit(1);
  if (!user) return undefined;
  if (user.updatedBy && user.updatedAt) {
    return { version: user.version, updatedBy: user.updatedBy, updatedAt: user.updatedAt };
  }

  // Legacy rows predate the authoritative provenance columns. Keep their
  // existing recovery metadata visible until the next administrator update.
  const [auditEntry] = await db
    .select({
      updatedBy: tradifyAdminAuditEvents.actorEmail,
      updatedAt: tradifyAdminAuditEvents.createdAt,
    })
    .from(tradifyAdminAuditEvents)
    .where(eq(tradifyAdminAuditEvents.targetUserId, userId))
    .orderBy(desc(tradifyAdminAuditEvents.createdAt))
    .limit(1);
  return auditEntry
    ? { version: user.version, updatedBy: auditEntry.updatedBy, updatedAt: auditEntry.updatedAt }
    : undefined;
}

export async function adminUsers(
  filters?: {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  membership?: UserProfile["membership"];
  subscriptionStatus?: "ACTIVE" | "TRIALING" | "CANCELLED" | "EXPIRED" | "PAST_DUE";
  },
  storedUsersOverride?: (typeof tradifyUsers.$inferSelect)[],
) {
  const search = filters?.search?.trim().toLowerCase();
  const storedUsers = storedUsersOverride ?? (await db.select().from(tradifyUsers));
  return storedUsers
    .map((stored) => {
      const current = users.get(stored.id);
      return {
        id: stored.id,
        email: stored.email,
        name: stored.name,
        role: stored.role === "admin" ? ("admin" as const) : ("user" as const),
        status:
          stored.status === "deleted"
            ? ("deleted" as const)
            : stored.status === "banned"
              ? ("banned" as const)
              : stored.status === "suspended"
                ? ("suspended" as const)
                : ("active" as const),
        version: stored.version,
        membership:
          stored.membership === "VIP"
            ? ("VIP" as const)
            : stored.membership === "Pro"
              ? ("Pro" as const)
              : ("Free" as const),
        membershipSource:
          stored.membershipSource === "REVENUECAT" || stored.membershipSource === "ADMIN_OVERRIDE"
            ? stored.membershipSource
            : ("UNKNOWN" as const),
        entitlements: Array.isArray(stored.entitlements) ? [...stored.entitlements] : [],
        entitlementGrants: Array.isArray(stored.entitlementGrants)
          ? [...stored.entitlementGrants]
          : [],
        entitlementDenies: Array.isArray(stored.entitlementDenies)
          ? [...stored.entitlementDenies]
          : [],
        createdAt: stored.createdAt,
        lastSeenAt: stored.lastSeenAt,
        trialEndsAt: stored.trialEndsAt ?? undefined,
        overrideEndsAt: stored.overrideEndsAt ?? undefined,
        ...(stored.adminUpdatedBy && stored.adminUpdatedAt
          ? { updatedBy: stored.adminUpdatedBy, updatedAt: stored.adminUpdatedAt }
          : {}),
        watchlistCount: current?.watchlist.size ?? 0,
        tradeCount: current?.trades.length ?? 0,
        unreadNotificationCount:
          current?.notifications.filter((notification) => !notification.isRead).length ?? 0,
        subscriptionStatus: adminSubscriptionStatus({
          profile: {
            membership:
              stored.membership === "VIP" ? "VIP" : stored.membership === "Pro" ? "Pro" : "Free",
          } as UserProfile,
          createdAt: stored.createdAt,
          subscriptionStatus: stored.subscriptionStatus as SubscriptionStatus | undefined,
          trialEndsAt: stored.trialEndsAt ?? undefined,
          overrideEndsAt: stored.overrideEndsAt ?? undefined,
        }),
        adminNotesCount: 0,
      };
    })
    .filter(
      (user) =>
        !search ||
        user.email.includes(search) ||
        user.name.toLowerCase().includes(search) ||
        user.id.toLowerCase().includes(search),
    )
    .filter((user) => !filters?.role || user.role === filters.role)
    .filter((user) => !filters?.status || user.status === filters.status)
    .filter((user) => !filters?.membership || user.membership === filters.membership)
    .filter(
      (user) =>
        !filters?.subscriptionStatus || user.subscriptionStatus === filters.subscriptionStatus,
    )
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function adminUsersPage(
  filters: Parameters<typeof adminUsers>[0],
  page: number,
  pageSize: number,
) {
  if (filters?.subscriptionStatus) {
    const users = await adminUsers(filters);
    const offset = (page - 1) * pageSize;
    return { items: users.slice(offset, offset + pageSize), total: users.length, page, pageSize };
  }
  const conditions = [];
  const search = filters?.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(tradifyUsers.email, pattern),
        ilike(tradifyUsers.name, pattern),
        ilike(tradifyUsers.id, pattern),
      ),
    );
  }
  if (filters?.role) conditions.push(eq(tradifyUsers.role, filters.role));
  if (filters?.status) conditions.push(eq(tradifyUsers.status, filters.status));
  if (filters?.membership) conditions.push(eq(tradifyUsers.membership, filters.membership));
  const where = and(...conditions);
  const [countRows, storedUsers] = await Promise.all([
    db.select({ total: count() }).from(tradifyUsers).where(where),
    db
      .select()
      .from(tradifyUsers)
      .where(where)
      .orderBy(desc(tradifyUsers.lastSeenAt), asc(tradifyUsers.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const items = await adminUsers(filters, storedUsers);
  return {
    items,
    total: Number(countRows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export async function getAdminUserNotes(userId: string): Promise<AdminUserNote[]> {
  const entries = await db
    .select()
    .from(tradifyAdminAuditEvents)
    .where(eq(tradifyAdminAuditEvents.targetUserId, userId))
    .orderBy(desc(tradifyAdminAuditEvents.createdAt));
  return entries
    .map((entry) => ({ entry, details: normalizeAdminAuditDetails(entry.details) }))
    .filter(
      ({ entry, details }) =>
        entry.action === "ADMIN_NOTE_ADDED" && typeof details.body === "string",
    )
    .map(({ entry, details }) => ({
      id: entry.id,
      userId,
      category: (typeof details.category === "string"
        ? details.category
        : "GENERAL") as AdminNoteCategory,
      body: String(details.body),
      authorEmail: entry.actorEmail,
      createdAt: entry.createdAt,
    }));
}

export function adminTradeMetrics(trades: Trade[]) {
  const closed = trades.filter((trade) => trade.status === "CLOSED");
  const wins = closed.filter((trade) => trade.r > 0);
  const losses = closed.filter((trade) => trade.r < 0);
  const grossWins = wins.reduce((sum, trade) => sum + trade.r, 0);
  const grossLosses = Math.abs(losses.reduce((sum, trade) => sum + trade.r, 0));
  const averageRiskReward = trades.length
    ? trades.reduce((sum, trade) => {
        const risk = Math.abs(trade.entry - trade.stop);
        const reward = Math.abs(trade.target - trade.entry);
        return sum + (risk > 0 ? reward / risk : 0);
      }, 0) / trades.length
    : 0;
  return {
    totalTrades: trades.length,
    trackedTrades: trades.length,
    openTrades: trades.filter((trade) => trade.status !== "CLOSED").length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    profitFactor: grossLosses ? grossWins / grossLosses : grossWins ? Infinity : 0,
    averageRiskReward,
    totalPnL: trades.reduce((sum, trade) => sum + trade.r, 0),
  };
}

export async function getAdminUserAuditLog(userId: string) {
  const entries = await db
    .select()
    .from(tradifyAdminAuditEvents)
    .where(eq(tradifyAdminAuditEvents.targetUserId, userId))
    .orderBy(desc(tradifyAdminAuditEvents.createdAt));
  return entries.map((entry) => ({
    id: entry.id,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    ...(entry.targetUserId ? { targetUserId: entry.targetUserId } : {}),
    ...(entry.targetEmail ? { targetEmail: entry.targetEmail } : {}),
    details: normalizeAdminAuditEntryDetails(entry.action, entry.details),
    createdAt: entry.createdAt,
  }));
}

export async function getAdminUserDetail(userId: string) {
  const user = users.get(userId);
  if (!user) return undefined;
  const [summary] = (await adminUsers()).filter((entry) => entry.id === userId);
  if (!summary) return undefined;
  return {
    ...summary,
    notes: await getAdminUserNotes(userId),
    trades: userTrades(user),
    tradeMetrics: adminTradeMetrics(user.trades),
    auditLog: await getAdminUserAuditLog(userId),
  };
}

export async function recordAdminAudit(
  entry: Omit<AdminAuditEntry, "id" | "createdAt"> & { createdAt?: string },
) {
  const delayMs = entry.action === "USER_UPDATED" ? Number(env.testDelayUserAuditMs) : 0;
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const auditEntry: AdminAuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
  await db.insert(tradifyAdminAuditEvents).values({
    id: auditEntry.id,
    actorId: auditEntry.actorId,
    actorEmail: auditEntry.actorEmail,
    action: auditEntry.action,
    targetUserId: auditEntry.targetUserId,
    targetEmail: auditEntry.targetEmail,
    details: auditEntry.details,
    createdAt: auditEntry.createdAt,
  });
  return { ...auditEntry, details: { ...auditEntry.details } };
}

export async function getAdminAuditLog(
  options:
    | number
    | {
        limit?: number;
        page?: number;
        pageSize?: number;
        actorId?: string;
        targetUserId?: string;
        action?: string;
        from?: string;
        to?: string;
        detailsFailureCategory?: string;
      } = 100,
) {
  const filters = typeof options === "number" ? { limit: options } : options;
  const boundedPageSize = Math.max(
    1,
    Math.min(Math.floor(filters.pageSize ?? filters.limit ?? 100), 200),
  );
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const conditions = [
    filters.actorId ? eq(tradifyAdminAuditEvents.actorId, filters.actorId) : undefined,
    filters.targetUserId
      ? eq(tradifyAdminAuditEvents.targetUserId, filters.targetUserId)
      : undefined,
    filters.action ? eq(tradifyAdminAuditEvents.action, filters.action) : undefined,
    filters.from ? sql`${tradifyAdminAuditEvents.createdAt} >= ${filters.from}` : undefined,
    filters.to ? sql`${tradifyAdminAuditEvents.createdAt} <= ${filters.to}` : undefined,
    filters.detailsFailureCategory
      ? sql`${tradifyAdminAuditEvents.details} ->> 'failureCategory' = ${filters.detailsFailureCategory}`
      : undefined,
  ].filter(Boolean);
  const entries = await db
    .select()
    .from(tradifyAdminAuditEvents)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(tradifyAdminAuditEvents.createdAt))
    .limit(boundedPageSize)
    .offset((page - 1) * boundedPageSize);
  return entries.map((entry) => ({
    id: entry.id,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    ...(entry.targetUserId ? { targetUserId: entry.targetUserId } : {}),
    ...(entry.targetEmail ? { targetEmail: entry.targetEmail } : {}),
    details: normalizeAdminAuditEntryDetails(entry.action, entry.details),
    createdAt: entry.createdAt,
  }));
}

export function adminStats() {
  const all = [...users.values()];
  return {
    totalUsers: all.length,
    activeUsers: all.filter((user) => user.status === "active").length,
    suspendedUsers: all.filter((user) => user.status === "suspended").length,
    proMembers: all.filter((user) => user.profile.membership === "Pro").length,
    vipMembers: all.filter((user) => user.profile.membership === "VIP").length,
    admins: all.filter((user) => user.role === "admin").length,
    activePaidSubscriptions: all.filter(
      (user) => user.profile.membership !== "Free" && user.status === "active",
    ).length,
    trialingAccounts: all.filter((user) => adminSubscriptionStatus(user) === "TRIALING").length,
    mrr: all.reduce(
      (total, user) =>
        total +
        (user.status === "active" && user.profile.membership === "Pro"
          ? 49
          : user.status === "active" && user.profile.membership === "VIP"
            ? 149
            : 0),
      0,
    ),
    newUsersThisWeek: all.filter(
      (user) => Date.now() - Date.parse(user.createdAt) <= 7 * 24 * 60 * 60 * 1000,
    ).length,
    bannedUsers: all.filter((user) => user.status === "banned").length,
  };
}

export function customerText(value: string): string {
  return value
    .replace(/\bINTERNAL_[A-Z0-9_]+\b/g, "market detail")
    .replace(/\b(?:DGV8_FX|DGV8|BBB_GOLD_3S|BBB)\b/gi, "active setup")
    .replace(/\bMT5\b/gi, "live market")
    .replace(/\b(?:Yahoo|Binance)\b/gi, "reference feed")
    .replace(/GC=F/g, "market symbol")
    .replace(/\bBROKER_SYMBOL_[A-Z0-9_]+\b/g, "market symbol")
    .replace(/\b(?:HTTP[_ ]?)?4014\b/gi, "request error")
    .replace(/\btick[_ ]?data\b/gi, "market update");
}

export function userAlerts(user: ServerUser) {
  return user.alerts.map((alert) => ({ ...alert }));
}

export function userTrades(user: ServerUser) {
  return user.trades.map((trade) => ({ ...trade }));
}

export function userNotifications(user: ServerUser) {
  return user.notifications
    .map((notification) => ({
      id: notification.id,
      timestamp: notification.timestamp,
      timeLabel: notificationTimeLabel(notification.timestamp),
      symbol: canonicalSymbol(notification.symbol) ?? "MARKET",
      type: notification.type,
      title: customerText(notification.title),
      message: customerText(notification.message),
      ...(notification.actionRequired
        ? { actionRequired: customerText(notification.actionRequired) }
        : {}),
      isRead: notification.isRead,
      ...(notification.signalId
        ? {
            signalId: `opportunity-${(canonicalSymbol(notification.symbol) ?? "market").toLowerCase()}`,
          }
        : {}),
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}
