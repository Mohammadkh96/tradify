import type { Signal, WatchItem } from "./tradify-store";

export interface LiveCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveCandleUpdate {
  type?: "CANDLE_UPDATE";
  symbol: string;
  timeframe: string;
  provider?: string;
  providerSymbol?: string;
  dataState?: string;
  displayOnly?: boolean;
  validation?: Record<string, unknown>;
  candles: LiveCandle[];
}

export interface CandleSeries {
  symbol: string;
  provider?: string;
  providerSymbol?: string;
  timeframe: string;
  timezone: string;
  candles: LiveCandle[];
  dataState: string;
  displayOnly: boolean;
  validation?: object;
}

export interface LiveQuote {
  price?: number;
  changePercent?: number;
  changeBasis?: "STREAM" | "PREVIOUS_CLOSE" | "24H";
  provider?: string;
  brokerSymbol?: string;
  dataState?: WatchItem["dataState"];
  status?: string;
  receivedAt?: number;
}

export interface LiveQuoteResponse {
  timestamp?: string;
  bridge: { connected?: unknown; activeSymbols?: unknown };
  quotes: Record<string, LiveQuote>;
}

const DEFAULT_RATE_LIMIT_BACKOFF_MS = 30_000;
const MAX_RATE_LIMIT_BACKOFF_MS = 5 * 60_000;
const MAX_LIVE_QUOTE_AGE_MS = 30_000;

function isRateLimitError(
  error: unknown,
): error is { status: 429; headers?: { get?: (name: string) => string | null } } {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 429);
}

function retryAfterMs(
  error: { headers?: { get?: (name: string) => string | null } },
  now: number,
): number | undefined {
  const value = error.headers?.get?.("Retry-After")?.trim();
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0 && Number.isFinite(seconds * 1000)) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - now) : undefined;
}

function isValidCandle(candle: LiveCandle | undefined): candle is LiveCandle {
  return Boolean(
    candle &&
    Number.isFinite(candle.time) &&
    candle.time > 0 &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume) &&
    candle.open > 0 &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close &&
    candle.volume >= 0,
  );
}

function dedupeCandles(candles: LiveCandle[]): LiveCandle[] {
  const byTime = new Map<number, LiveCandle>();
  candles.filter(isValidCandle).forEach((candle) => byTime.set(candle.time, candle));
  return Array.from(byTime.values())
    .sort((a, b) => a.time - b.time)
    .slice(-1000);
}

/**
 * Merge a refreshed series without ever appending candles from another
 * data state or timeframe.
 */
export function mergeMarketCandleSeries<T extends CandleSeries>(current: T | null, next: T): T {
  const nextCandles = dedupeCandles(next.candles);
  const sameSeries = Boolean(
    current &&
    current.symbol === next.symbol &&
    current.timeframe.toUpperCase() === next.timeframe.toUpperCase(),
  );

  // Keep the last real frame during a transient empty refresh. The chart can
  // continue drawing known candles, but LIVE must be downgraded to STALE.
  if (current && sameSeries && nextCandles.length === 0) {
    return {
      ...current,
      dataState: current.dataState === "LIVE" ? "STALE" : current.dataState,
      validation: next.validation ?? current.validation,
    } as T;
  }

  if (
    !current ||
    current.symbol !== next.symbol ||
    current.timeframe.toUpperCase() !== next.timeframe.toUpperCase() ||
    (current.provider !== undefined &&
      next.provider !== undefined &&
      current.provider !== next.provider) ||
    (current.providerSymbol !== undefined &&
      next.providerSymbol !== undefined &&
      current.providerSymbol !== next.providerSymbol)
  ) {
    return { ...next, candles: nextCandles } as T;
  }

  return {
    ...next,
    candles: dedupeCandles([...current.candles, ...nextCandles]),
  } as T;
}

/**
 * Apply live candle events only to a live chart. Reference/display-only charts
 * stay untouched until their next full refresh.
 */
export function mergeLiveCandleUpdate<T extends CandleSeries>(
  current: T,
  update: LiveCandleUpdate,
): T {
  if (
    current.dataState !== "LIVE" ||
    current.displayOnly ||
    update.dataState !== "LIVE" ||
    update.symbol !== current.symbol ||
    update.timeframe.toUpperCase() !== current.timeframe.toUpperCase() ||
    (current.provider !== undefined &&
      update.provider !== undefined &&
      current.provider !== update.provider) ||
    (current.providerSymbol !== undefined &&
      update.providerSymbol !== undefined &&
      update.providerSymbol !== current.providerSymbol)
  ) {
    return current;
  }

  return {
    ...current,
    candles: dedupeCandles([...current.candles, ...update.candles]),
    validation: update.validation ?? current.validation,
  };
}

function isUsableLiveQuote(
  quote: LiveQuote | undefined,
): quote is LiveQuote & { price: number; dataState: "LIVE" } {
  const quoteAgeMs =
    quote && typeof quote.receivedAt === "number" && Number.isFinite(quote.receivedAt)
      ? Date.now() - quote.receivedAt
      : Number.POSITIVE_INFINITY;
  return Boolean(
    quote &&
    quote.dataState === "LIVE" &&
    (quote.status === undefined || quote.status === "LIVE") &&
    quoteAgeMs >= 0 &&
    quoteAgeMs <= MAX_LIVE_QUOTE_AGE_MS &&
    typeof quote.price === "number" &&
    Number.isFinite(quote.price) &&
    quote.price > 0,
  );
}

export function mergeLiveQuotes(
  watchlist: WatchItem[],
  signals: Signal[],
  response: LiveQuoteResponse,
): { watchlist: WatchItem[]; signals: Signal[]; connected: boolean } {
  const activeSymbols = Array.isArray(response.bridge.activeSymbols)
    ? response.bridge.activeSymbols.filter(
        (symbol): symbol is string => typeof symbol === "string" && symbol.trim().length > 0,
      )
    : undefined;
  const bridgeConnected =
    response.bridge.connected === true && (activeSymbols === undefined || activeSymbols.length > 0);
  const bridgeExplicitlyHasNoSubscriptions =
    response.bridge.connected === true && activeSymbols !== undefined && activeSymbols.length === 0;
  const hasUsableAuthorityQuote =
    !bridgeExplicitlyHasNoSubscriptions &&
    Object.values(response.quotes).some((quote) => isUsableLiveQuote(quote));
  const connected = bridgeConnected || hasUsableAuthorityQuote;
  let watchChanged = false;
  const nextWatchlist = watchlist.map((item) => {
    const quote = response.quotes[item.symbol];
    if (!bridgeExplicitlyHasNoSubscriptions && isUsableLiveQuote(quote)) {
      const nextItem: WatchItem = {
        ...item,
        price: quote.price,
        ...(typeof quote.changePercent === "number" ? { change: quote.changePercent } : {}),
        dataState: "LIVE",
        ...(quote.changeBasis ? { changeBasis: quote.changeBasis } : {}),
        ...(quote.brokerSymbol ? { provider: "MT5", brokerSymbol: quote.brokerSymbol } : {}),
      };
      if (
        nextItem.price !== item.price ||
        nextItem.change !== item.change ||
        nextItem.dataState !== item.dataState
      ) {
        watchChanged = true;
        return nextItem;
      }
      return item;
    }
    // A response can still contain another symbol's live quote while this
    // symbol is absent or stale. Do not let the bridge-wide connection state
    // make an unquoted symbol look live.
    // Preserve a valid reference quote while the broker stream is offline.
    // The snapshot refresh owns fallback/reference data; this fast poll only
    // owns the MT5 live state.
    if (
      item.dataState === "FALLBACK" &&
      typeof item.price === "number" &&
      Number.isFinite(item.price) &&
      item.price > 0
    ) {
      return item;
    }
    const nextItem: WatchItem = { ...item, dataState: "STALE" };
    if (nextItem.dataState !== item.dataState) {
      watchChanged = true;
      return nextItem;
    }
    return item;
  });

  let signalsChanged = false;
  const nextSignals = signals.map((signal) => {
    const quote = response.quotes[signal.symbol];
    if (
      bridgeExplicitlyHasNoSubscriptions ||
      !isUsableLiveQuote(quote) ||
      quote.price === signal.price
    )
      return signal;
    signalsChanged = true;
    return { ...signal, price: quote.price };
  });

  return {
    watchlist: watchChanged ? nextWatchlist : watchlist,
    signals: signalsChanged ? nextSignals : signals,
    connected,
  };
}

export function startLiveQuotePolling(
  fetchQuotes: () => Promise<LiveQuoteResponse>,
  onQuotes: (response: LiveQuoteResponse) => void,
  intervalMs = 1000,
  onRateLimited?: (retryAt: number) => void,
): () => void {
  let active = true;
  let requestInFlight = false;
  let nextRequestAt = 0;
  let rateLimitCount = 0;
  const pollIntervalMs = Math.max(1, intervalMs);

  const refresh = async () => {
    if (!active || requestInFlight || Date.now() < nextRequestAt) return;
    requestInFlight = true;
    try {
      let response: LiveQuoteResponse;
      try {
        response = await fetchQuotes();
      } catch (error) {
        if (active && isRateLimitError(error)) {
          rateLimitCount += 1;
          const fallbackDelay = Math.min(
            DEFAULT_RATE_LIMIT_BACKOFF_MS * 2 ** Math.min(rateLimitCount - 1, 5),
            MAX_RATE_LIMIT_BACKOFF_MS,
          );
          const delay = retryAfterMs(error, Date.now()) ?? fallbackDelay;
          nextRequestAt = Date.now() + Math.max(pollIntervalMs, delay);
          try {
            onRateLimited?.(nextRequestAt);
          } catch {
            // A status callback must not interrupt polling cleanup.
          }
        }
        return;
      }

      if (!active) return;
      rateLimitCount = 0;
      nextRequestAt = 0;
      try {
        onQuotes(response);
      } catch {
        // Keep the polling loop alive if a consumer callback fails.
      }
    } finally {
      requestInFlight = false;
    }
  };

  void refresh();
  const timer = setInterval(() => {
    void refresh();
  }, pollIntervalMs);
  return () => {
    active = false;
    clearInterval(timer);
  };
}
