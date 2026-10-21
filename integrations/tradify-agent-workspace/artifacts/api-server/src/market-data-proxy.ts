import type { Candle, Quote } from "./tradify-runtime";
import { env } from "@workspace/config";

export type DevelopmentMarketQuotesResult =
  | { kind: "disabled" }
  | { kind: "available"; quotes: Record<string, Quote> }
  | { kind: "unavailable" };

export interface DevelopmentMarketCandleSeries {
  symbol: string;
  timeframe: string;
  timezone: string;
  candles: Candle[];
  sourceDataState: "LIVE" | "FALLBACK";
}

export type DevelopmentMarketCandlesResult =
  | { kind: "disabled" }
  | { kind: "available"; series: DevelopmentMarketCandleSeries }
  | { kind: "unavailable" };

type MarketProxyEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, "NODE_ENV" | "TRADIFY_MARKET_DATA_UPSTREAM_URL">
>;

const MAX_LIVE_QUOTE_AGE_MS = 30_000;
const MAX_FUTURE_QUOTE_SKEW_MS = 5_000;
const MAX_CANDLE_FUTURE_SKEW_SECONDS = 300;
const CANDLE_TIMEFRAMES = new Set(["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeCandle(value: unknown): Candle | undefined {
  if (!isRecord(value)) return undefined;
  const { time, open, high, low, close, volume } = value;
  if (
    typeof time !== "number" ||
    !Number.isFinite(time) ||
    time <= 0 ||
    time > Date.now() / 1000 + MAX_CANDLE_FUTURE_SKEW_SECONDS ||
    typeof open !== "number" ||
    !Number.isFinite(open) ||
    open <= 0 ||
    typeof high !== "number" ||
    !Number.isFinite(high) ||
    typeof low !== "number" ||
    !Number.isFinite(low) ||
    typeof close !== "number" ||
    !Number.isFinite(close) ||
    typeof volume !== "number" ||
    !Number.isFinite(volume) ||
    high < low ||
    high < open ||
    high < close ||
    low > open ||
    low > close ||
    volume < 0
  )
    return undefined;
  return { time, open, high, low, close, volume };
}

function isLiveQuote(value: unknown, symbol: string): value is Quote {
  if (!isRecord(value)) return false;
  const receivedAt = value.receivedAt;
  const ageMs =
    typeof receivedAt === "number" && Number.isFinite(receivedAt)
      ? Date.now() - receivedAt
      : Number.POSITIVE_INFINITY;
  return (
    value.symbol === symbol &&
    value.status === "LIVE" &&
    value.dataState === "LIVE" &&
    typeof value.price === "number" &&
    Number.isFinite(value.price) &&
    value.price > 0 &&
    ageMs <= MAX_LIVE_QUOTE_AGE_MS &&
    ageMs >= -MAX_FUTURE_QUOTE_SKEW_MS
  );
}

export function developmentMarketDataOrigin(
  environment: MarketProxyEnvironment = env.developmentMarketProxy,
): string | undefined {
  if (environment.NODE_ENV !== "development") return undefined;
  const configured = environment.TRADIFY_MARKET_DATA_UPSTREAM_URL?.trim();
  if (!configured) return undefined;

  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export async function fetchDevelopmentMarketQuotes(
  environment: MarketProxyEnvironment = env.developmentMarketProxy,
  fetcher: typeof fetch = fetch,
): Promise<DevelopmentMarketQuotesResult> {
  const origin = developmentMarketDataOrigin(environment);
  if (!origin) return { kind: "disabled" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetcher(new URL("/api/market/quotes", origin), {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { kind: "unavailable" };

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.quotes)) {
      return { kind: "unavailable" };
    }
    return {
      kind: "available",
      quotes: payload.quotes as Record<string, Quote>,
    };
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDevelopmentMarketCandles(
  symbol: string,
  timeframe: string,
  limit: number,
  environment: MarketProxyEnvironment = env.developmentMarketProxy,
  fetcher: typeof fetch = fetch,
): Promise<DevelopmentMarketCandlesResult> {
  const origin = developmentMarketDataOrigin(environment);
  if (!origin) return { kind: "disabled" };

  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedTimeframe = timeframe.trim().toUpperCase();
  if (!/^[A-Z0-9._-]{1,24}$/.test(normalizedSymbol) || !CANDLE_TIMEFRAMES.has(normalizedTimeframe))
    return { kind: "unavailable" };
  const requestedLimit = Math.max(
    1,
    Math.min(1000, Math.floor(Number.isFinite(limit) ? limit : 500)),
  );
  const url = new URL("/api/market/candles", origin);
  url.searchParams.set("symbol", normalizedSymbol);
  url.searchParams.set("timeframe", normalizedTimeframe);
  url.searchParams.set("limit", String(requestedLimit));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { kind: "unavailable" };

    const payload: unknown = await response.json();
    if (
      !isRecord(payload) ||
      typeof payload.symbol !== "string" ||
      payload.symbol.toUpperCase() !== normalizedSymbol ||
      typeof payload.timeframe !== "string" ||
      payload.timeframe.toUpperCase() !== normalizedTimeframe ||
      (payload.dataState !== "LIVE" && payload.dataState !== "FALLBACK") ||
      !Array.isArray(payload.candles)
    )
      return { kind: "unavailable" };

    const uniqueCandles = new Map<number, Candle>();
    for (const value of payload.candles) {
      const candle = normalizeCandle(value);
      if (candle) uniqueCandles.set(candle.time, candle);
    }
    const candles = [...uniqueCandles.values()]
      .sort((left, right) => left.time - right.time)
      .slice(-requestedLimit);
    if (candles.length === 0) return { kind: "unavailable" };

    return {
      kind: "available",
      series: {
        symbol: normalizedSymbol,
        timeframe: normalizedTimeframe,
        timezone: "UTC",
        candles,
        sourceDataState: payload.dataState,
      },
    };
  } catch {
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export function mergeDevelopmentMarketQuotes(
  localQuotes: Record<string, Quote>,
  upstreamQuotes: Record<string, Quote>,
): Record<string, Quote> {
  const merged = { ...localQuotes };
  for (const [symbol, quote] of Object.entries(upstreamQuotes)) {
    if (isLiveQuote(quote, symbol) && !isLiveQuote(localQuotes[symbol], symbol)) {
      merged[symbol] = quote;
    }
  }
  return merged;
}
