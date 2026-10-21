import { env } from "@workspace/config";
import { fetchWithRetry } from "../../../lib/fetch-with-retry";
import type {
  Candle,
  CandleResponse,
  IMarketDataProvider,
  MarketDataContext,
  ProviderHealthSnapshot,
  ProviderRequestAudit,
  ProviderRequestMetadata,
  ProviderRuntimeMetrics,
  QuoteData,
} from "../types";
import { normalizeExternalCandleOpenTime } from "../CandleTime";
import {
  sanitizeDiagnosticEndpoint,
  sanitizeDiagnosticText,
  sanitizeDiagnosticValue,
} from "../ProviderDiagnosticSanitizer";

type ExternalProviderName = "MASSIVE" | "TWELVE_DATA";
type CanonicalSymbol =
  | "EURUSD"
  | "GBPUSD"
  | "USDJPY"
  | "AUDUSD"
  | "USDCAD"
  | "USDCHF"
  | "NZDUSD"
  | "EURGBP"
  | "EURJPY"
  | "GBPJPY"
  | "AUDJPY"
  | "XAUUSD"
  | "BTCUSD"
  | "ETHUSD";

interface ProviderResponse {
  status: number;
  body: unknown;
  headers: Headers;
}

interface ParsedQuote {
  price: number;
  sourceTimestamp: number;
  instrumentType: string;
  status: QuoteData["status"];
  change?: number;
  changePercent?: number;
  priceBasis?: "USD" | "USDT";
}

const ALL_SUPPORTED: CanonicalSymbol[] = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "USDCHF",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "AUDJPY",
  "XAUUSD",
  "BTCUSD",
  "ETHUSD",
];

const TWELVE_DATA_SYMBOLS: Partial<Record<CanonicalSymbol, string>> = {
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  AUDUSD: "AUD/USD",
  USDCAD: "USD/CAD",
  USDCHF: "USD/CHF",
  NZDUSD: "NZD/USD",
  EURGBP: "EUR/GBP",
  EURJPY: "EUR/JPY",
  GBPJPY: "GBP/JPY",
  AUDJPY: "AUD/JPY",
  XAUUSD: "XAU/USD",
  BTCUSD: "BTC/USD",
  ETHUSD: "ETH/USD",
};

const MASSIVE_SYMBOLS: Partial<Record<CanonicalSymbol, string>> = {
  EURUSD: "C:EURUSD",
  GBPUSD: "C:GBPUSD",
  USDJPY: "C:USDJPY",
  AUDUSD: "C:AUDUSD",
  USDCAD: "C:USDCAD",
  USDCHF: "C:USDCHF",
  NZDUSD: "C:NZDUSD",
  EURGBP: "C:EURGBP",
  EURJPY: "C:EURJPY",
  GBPJPY: "C:GBPJPY",
  AUDJPY: "C:AUDJPY",
  BTCUSD: "X:BTCUSD",
  ETHUSD: "X:ETHUSD",
};

const QUOTE_CACHE_MS = 30_000;
const CANDLE_CACHE_MS = 14 * 60_000;
const TWELVE_QUOTE_FRESHNESS_MS = 5 * 60_000;
const TWELVE_CANDLE_FRESHNESS_MS = 45 * 60_000;
const MASSIVE_EOD_FRESHNESS_MS = 3 * 24 * 60 * 60_000;
const TWELVE_AUTHORITY_SYMBOLS: CanonicalSymbol[] = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "USDCHF",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "AUDJPY",
  "XAUUSD",
];

function finitePositive(value: unknown): number | undefined {
  const number =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  const number =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function timestampMilliseconds(value: unknown): number | undefined {
  if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  const number = finitePositive(value);
  if (!number) return undefined;
  return number < 10_000_000_000 ? number * 1000 : number;
}

function parseTwelveDatetime(value: unknown): number | undefined {
  const seconds = normalizeExternalCandleOpenTime(value, "ISO_UTC", "OPEN", "M15");
  return seconds > 0 ? seconds * 1000 : undefined;
}

function normalizeCandles(rows: Candle[]): Candle[] {
  const normalized: Candle[] = [];
  const seen = new Set<number>();
  let previousTime: number | undefined;
  for (const candle of rows) {
    if (
      !Number.isFinite(candle.time) ||
      candle.time <= 0 ||
      candle.time % 900 !== 0 ||
      ![candle.open, candle.high, candle.low, candle.close].every(
        (value) => Number.isFinite(value) && value > 0,
      ) ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close) ||
      candle.high < candle.low
    )
      continue;
    if (seen.has(candle.time) || (previousTime !== undefined && candle.time <= previousTime))
      return [];
    seen.add(candle.time);
    previousTime = candle.time;
    normalized.push({ ...candle, volume: candle.volume ?? 0 });
  }
  return normalized;
}

function instrumentTypeFor(symbol: CanonicalSymbol): string {
  if (symbol === "XAUUSD") return "SPOT";
  if (symbol === "BTCUSD" || symbol === "ETHUSD") return "CRYPTO_SPOT";
  return "SPOT";
}

function priceBasisFor(symbol: CanonicalSymbol): "USD" | "USDT" | undefined {
  return symbol === "BTCUSD" || symbol === "ETHUSD" ? "USD" : undefined;
}

abstract class AuthenticatedExternalShadowAdapter implements IMarketDataProvider {
  public abstract readonly name: ExternalProviderName;
  public abstract readonly displayName: string;
  protected abstract readonly symbols: Partial<Record<CanonicalSymbol, string>>;
  protected abstract readonly supportedTimeframe: string;
  private readonly quoteCache = new Map<string, { expiresAt: number; value: QuoteData | null }>();
  private readonly candleCache = new Map<
    string,
    { expiresAt: number; value: CandleResponse | null }
  >();
  private readonly quoteInFlight = new Map<string, Promise<QuoteData | null>>();
  private readonly candleInFlight = new Map<string, Promise<CandleResponse | null>>();
  private previousRequestFailed = false;
  private nextRequestAllowedAt = 0;
  private metrics: ProviderRuntimeMetrics = {
    requestCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    errorCount: 0,
    rateLimitEvents: 0,
    reconnectCount: 0,
    sourceTimestampAdvances: 0,
  };

  public supportsSymbol(symbol: string): boolean {
    return Boolean(this.symbols[symbol.toUpperCase() as CanonicalSymbol]);
  }

  public getMetrics(): ProviderRuntimeMetrics {
    return { ...this.metrics };
  }

  public async getQuote(
    symbol: string,
    overrideProviderSymbol?: string,
    requestMetadata?: ProviderRequestMetadata,
  ): Promise<QuoteData | null> {
    const canonical = symbol.toUpperCase() as CanonicalSymbol;
    const providerSymbol = overrideProviderSymbol ?? this.symbols[canonical];
    if (!providerSymbol) return null;
    const metadata = requestMetadata ?? {
      caller: "direct-provider-access",
      reason: "Unclassified provider quote read.",
    };
    const endpoint = this.quoteEndpoint(providerSymbol);
    const cached = this.quoteCache.get(canonical);
    if (cached && cached.expiresAt > Date.now()) {
      this.metrics.cacheHitCount += 1;
      this.recordAudit({
        endpoint,
        canonicalSymbol: canonical,
        requestTimestamp: new Date().toISOString(),
        cache: "HIT",
        caller: metadata.caller,
        reason: metadata.reason,
      });
      return cached.value;
    }
    const inFlight = this.quoteInFlight.get(canonical);
    if (inFlight) {
      this.metrics.cacheHitCount += 1;
      this.recordAudit({
        endpoint,
        canonicalSymbol: canonical,
        requestTimestamp: new Date().toISOString(),
        cache: "HIT",
        caller: metadata.caller,
        reason: `${metadata.reason} (coalesced in-flight request).`,
      });
      return inFlight;
    }

    this.metrics.cacheMissCount += 1;
    const request = this.fetchQuote(canonical, providerSymbol, metadata)
      .then((value) => {
        const retained = value ?? (cached?.value ? this.staleQuote(cached.value) : null);
        this.quoteCache.set(canonical, { expiresAt: Date.now() + QUOTE_CACHE_MS, value: retained });
        return retained;
      })
      .finally(() => this.quoteInFlight.delete(canonical));
    this.quoteInFlight.set(canonical, request);
    return request;
  }

  public async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
    overrideProviderSymbol?: string,
    requestMetadata?: ProviderRequestMetadata,
  ): Promise<CandleResponse | null> {
    const canonical = symbol.toUpperCase() as CanonicalSymbol;
    const providerSymbol = overrideProviderSymbol ?? this.symbols[canonical];
    if (!providerSymbol || timeframe.toUpperCase() !== this.supportedTimeframe) return null;
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const cacheKey = `${canonical}:${this.supportedTimeframe}:${providerSymbol}`;
    const metadata = requestMetadata ?? {
      caller: "direct-provider-access",
      reason: "Unclassified provider candle read.",
    };
    const endpoint = this.candleEndpoint(providerSymbol, boundedLimit);
    const cached = this.candleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.metrics.cacheHitCount += 1;
      this.recordAudit({
        endpoint,
        canonicalSymbol: canonical,
        requestTimestamp: new Date().toISOString(),
        cache: "HIT",
        caller: metadata.caller,
        reason: metadata.reason,
      });
      return cached.value
        ? { ...cached.value, candles: cached.value.candles.slice(-boundedLimit) }
        : null;
    }
    const inFlight = this.candleInFlight.get(cacheKey);
    if (inFlight) {
      this.metrics.cacheHitCount += 1;
      this.recordAudit({
        endpoint,
        canonicalSymbol: canonical,
        requestTimestamp: new Date().toISOString(),
        cache: "HIT",
        caller: metadata.caller,
        reason: `${metadata.reason} (coalesced in-flight request).`,
      });
      return inFlight.then((value) =>
        value ? { ...value, candles: value.candles.slice(-boundedLimit) } : null,
      );
    }

    this.metrics.cacheMissCount += 1;
    const refreshLimit = cached?.value ? Math.min(3, boundedLimit) : boundedLimit;
    const request = this.fetchCandles(canonical, providerSymbol, refreshLimit, metadata)
      .then((value) => {
        const merged = value
          ? cached?.value
            ? this.mergeCandleResponses(cached.value, value)
            : value
          : cached?.value
            ? {
                ...cached.value,
                freshness: "STALE" as const,
                dataState: "STALE" as const,
              }
            : null;
        this.candleCache.set(cacheKey, { expiresAt: Date.now() + CANDLE_CACHE_MS, value: merged });
        return merged;
      })
      .finally(() => this.candleInFlight.delete(cacheKey));
    this.candleInFlight.set(cacheKey, request);
    return request.then((value) =>
      value ? { ...value, candles: value.candles.slice(-boundedLimit) } : null,
    );
  }

  public async getHealth(context: MarketDataContext): Promise<ProviderHealthSnapshot> {
    const observedAt = Date.now();
    const data =
      context.purpose === "QUOTE"
        ? await this.getQuote(context.canonicalSymbol, undefined, context.requestMetadata)
        : await this.getCandles(
            context.canonicalSymbol,
            context.timeframe,
            100,
            undefined,
            context.requestMetadata,
          );
    if (!data) {
      const rateLimited = this.metrics.lastStatusCode === 429;
      return {
        health: rateLimited ? "DEGRADED" : "UNAVAILABLE",
        reasons: [
          rateLimited
            ? `${this.name} is rate limited; authority is blocked until retry backoff and freshness recover.`
            : (this.metrics.lastError ?? `${this.name} returned no usable data.`),
        ],
        observedAt,
        metrics: this.getMetrics(),
      };
    }

    const sourceTimestamp =
      "timestamp" in data ? Date.parse(data.timestamp) : (data.sourceTimestamp ?? 0) * 1000;
    const sourceAgeMs = Number.isFinite(sourceTimestamp)
      ? Math.max(0, observedAt - sourceTimestamp)
      : Infinity;
    const freshnessLimit =
      context.purpose === "QUOTE" ? this.quoteFreshnessMs : this.candleFreshnessMs;
    const fresh = sourceAgeMs <= freshnessLimit;
    const checks = [
      {
        name: "SOURCE_TIMESTAMP_PRESENT",
        passed: Number.isFinite(sourceTimestamp) && sourceTimestamp > 0,
        observedAt,
      },
      {
        name: "SOURCE_TIMESTAMP_ADVANCING",
        passed: this.metrics.sourceTimestampAdvances > 0 || this.metrics.requestCount <= 1,
        observedAt,
      },
      {
        name: context.purpose === "QUOTE" ? "QUOTE_FRESHNESS" : "M15_FRESHNESS",
        passed: fresh,
        observedAt,
        reason: fresh ? undefined : `Source age ${sourceAgeMs}ms exceeds ${freshnessLimit}ms.`,
      },
    ];
    return {
      health: fresh ? this.healthWhenFresh : "STALE",
      reasons: [this.healthReason(context)],
      observedAt,
      checks,
      metrics: { ...this.getMetrics(), sourceAgeMs },
      ...(context.purpose === "QUOTE"
        ? {}
        : {
            seriesReadiness: {
              providerId: this.name,
              canonicalSymbol: context.canonicalSymbol,
              timeframe: context.timeframe.toUpperCase(),
              enoughHistoryLoaded: "candles" in data && data.candles.length >= 50,
              latestRequiredClosedBarPresent: fresh,
              continuityValid: true,
              fullSynchronizationComplete: true,
              freshnessValid: fresh,
              observedAt,
            },
          }),
    };
  }

  protected abstract readonly quoteFreshnessMs: number;
  protected abstract readonly candleFreshnessMs: number;
  protected abstract readonly healthWhenFresh: ProviderHealthSnapshot["health"];
  protected abstract healthReason(context: MarketDataContext): string;
  protected abstract fetchQuote(
    canonical: CanonicalSymbol,
    providerSymbol: string,
    requestMetadata: ProviderRequestMetadata,
  ): Promise<QuoteData | null>;
  protected abstract fetchCandles(
    canonical: CanonicalSymbol,
    providerSymbol: string,
    limit: number,
    requestMetadata: ProviderRequestMetadata,
  ): Promise<CandleResponse | null>;

  protected async request(
    url: string,
    canonicalSymbol: CanonicalSymbol,
    requestMetadata: ProviderRequestMetadata,
    headers: Record<string, string> = {},
  ): Promise<ProviderResponse | undefined> {
    const receivedAt = Date.now();
    if (receivedAt < this.nextRequestAllowedAt) {
      this.recordError(
        `Provider request backoff active until ${new Date(this.nextRequestAllowedAt).toISOString()}.`,
      );
      return undefined;
    }
    this.metrics.requestCount += 1;
    try {
      const response = await fetchWithRetry(
        url,
        {
          headers: { accept: "application/json", "user-agent": "TradifySignals/1.0", ...headers },
        },
        { timeoutMs: 8_000 },
      );
      this.metrics.lastStatusCode = response.status;
      if (response.status === 429) this.metrics.rateLimitEvents += 1;
      const body = await response.json().catch(() => null);
      const responseHeaders = response.headers ?? new Headers();
      const creditsConsumed = this.readQuotaNumber(body, responseHeaders, [
        "api-credits-used",
        "x-api-credits-used",
      ]);
      const creditsRemaining = this.readQuotaNumber(body, responseHeaders, [
        "api-credits-left",
        "x-api-credits-left",
        "x-ratelimit-remaining",
      ]);
      const rateLimitLimit = this.readQuotaNumber(body, responseHeaders, [
        "x-ratelimit-limit",
        "x-api-credits-limit",
      ]);
      this.metrics.lastRateLimitRemaining = creditsRemaining;
      this.metrics.lastRateLimitLimit = rateLimitLimit;
      if (response.status === 429) {
        const retryAfterMs = this.readRetryAfterMs(body, responseHeaders);
        this.metrics.lastRetryAfterMs = retryAfterMs;
        this.nextRequestAllowedAt = Math.max(this.nextRequestAllowedAt, receivedAt + retryAfterMs);
        this.metrics.backoffUntil = new Date(this.nextRequestAllowedAt).toISOString();
      }
      this.recordAudit({
        endpoint: this.sanitizedEndpoint(url),
        canonicalSymbol,
        requestTimestamp: new Date(receivedAt).toISOString(),
        status: response.status,
        creditsConsumed,
        creditsRemaining,
        cache: "MISS",
        caller: requestMetadata.caller,
        reason: requestMetadata.reason,
      });
      if (!response.ok) {
        const message =
          body && typeof body === "object" && "message" in body
            ? String((body as { message: unknown }).message)
            : `Provider returned HTTP ${response.status}.`;
        this.recordError(message);
        return undefined;
      }
      if (this.previousRequestFailed) this.metrics.reconnectCount += 1;
      this.previousRequestFailed = false;
      this.metrics.lastReceivedAt = new Date(receivedAt).toISOString();
      return { status: response.status, body, headers: responseHeaders };
    } catch (error) {
      this.recordAudit({
        endpoint: this.sanitizedEndpoint(url),
        canonicalSymbol,
        requestTimestamp: new Date(receivedAt).toISOString(),
        cache: "MISS",
        caller: requestMetadata.caller,
        reason: requestMetadata.reason,
      });
      this.recordError(error instanceof Error ? error.message : "Provider request failed.");
      return undefined;
    }
  }

  protected recordSourceTimestamp(timestamp: number, receivedAt: number): void {
    const previous = this.metrics.lastSourceTimestamp
      ? Date.parse(this.metrics.lastSourceTimestamp)
      : 0;
    if (timestamp > previous) this.metrics.sourceTimestampAdvances += 1;
    this.metrics.lastSourceTimestamp = new Date(timestamp).toISOString();
    this.metrics.lastReceivedAt = new Date(receivedAt).toISOString();
    this.metrics.sourceAgeMs = Math.max(0, receivedAt - timestamp);
    this.metrics.lastError = undefined;
  }

  protected recordError(message: string): void {
    this.metrics.errorCount += 1;
    this.metrics.lastError = sanitizeDiagnosticText(message);
    this.previousRequestFailed = true;
  }

  protected noKeyError(keyName: string): void {
    this.recordError(`${keyName} is not configured.`);
  }

  private quoteEndpoint(providerSymbol: string): string {
    return `/quote?symbol=${encodeURIComponent(providerSymbol)}`;
  }

  private candleEndpoint(providerSymbol: string, limit: number): string {
    return `/time_series?symbol=${encodeURIComponent(providerSymbol)}&interval=15min&outputsize=${limit}&order=ASC&timezone=UTC`;
  }

  private sanitizedEndpoint(url: string): string {
    return sanitizeDiagnosticEndpoint(url);
  }

  private readQuotaNumber(body: unknown, headers: Headers, names: string[]): number | undefined {
    for (const name of names) {
      const value = headers.get(name);
      const numeric = finiteNumber(value);
      if (numeric !== undefined) return numeric;
      if (body && typeof body === "object") {
        const bodyValue = (body as Record<string, unknown>)[name];
        const bodyNumber = finiteNumber(bodyValue);
        if (bodyNumber !== undefined) return bodyNumber;
      }
    }
    return undefined;
  }

  private recordAudit(audit: ProviderRequestAudit): void {
    const history = this.metrics.requestAudit ?? [];
    history.push(
      sanitizeDiagnosticValue({
        ...audit,
        requestTimestamp: audit.requestTimestamp ?? new Date().toISOString(),
      }),
    );
    this.metrics.requestAudit = history.slice(-200);
  }

  private staleQuote(value: QuoteData): QuoteData {
    return {
      ...value,
      status: "STALE",
      dataState: "STALE",
      lastError: this.metrics.lastError,
    };
  }

  private readRetryAfterMs(body: unknown, headers: Headers): number {
    const headerValue = headers.get("retry-after");
    const headerSeconds = finiteNumber(headerValue);
    if (headerSeconds !== undefined && headerSeconds >= 0)
      return Math.max(1_000, headerSeconds * 1_000);
    if (body && typeof body === "object") {
      const retryValue = finiteNumber((body as Record<string, unknown>)["retry_after"]);
      if (retryValue !== undefined && retryValue >= 0) return Math.max(1_000, retryValue * 1_000);
    }
    return 60_000;
  }

  private mergeCandleResponses(previous: CandleResponse, update: CandleResponse): CandleResponse {
    const byTime = new Map<number, Candle>();
    for (const candle of [...previous.candles, ...update.candles]) byTime.set(candle.time, candle);
    const candles = [...byTime.values()].sort((left, right) => left.time - right.time).slice(-100);
    return {
      ...previous,
      ...update,
      candles,
      receivedAt: update.receivedAt ?? previous.receivedAt,
    };
  }
}

class TwelveDataShadowAdapter extends AuthenticatedExternalShadowAdapter {
  public readonly name = "TWELVE_DATA" as const;
  public readonly displayName = "Twelve Data Basic Shadow";
  protected readonly symbols = TWELVE_DATA_SYMBOLS;
  protected readonly supportedTimeframe = "M15";
  protected readonly quoteFreshnessMs = TWELVE_QUOTE_FRESHNESS_MS;
  protected readonly candleFreshnessMs = TWELVE_CANDLE_FRESHNESS_MS;
  protected readonly healthWhenFresh = "HEALTHY" as const;
  private ingestionTimer?: ReturnType<typeof setTimeout>;
  private ingestionRunning = false;

  protected healthReason(context: MarketDataContext): string {
    return `Twelve Data returned verified Basic-plan ${context.purpose === "QUOTE" ? "quote" : "M15 candles"} for ${context.canonicalSymbol}.`;
  }

  public startBackgroundIngestion(): { started: boolean; reason: string } {
    if (this.ingestionTimer)
      return { started: true, reason: "Background ingestion is already running." };
    if (!env.twelveDataIngestionEnabled) {
      return {
        started: false,
        reason:
          "Background ingestion is disabled until the entitlement budget is explicitly configured.",
      };
    }
    const maxRequestsPerMinute = Number(env.twelveDataMaxRequestsPerMinute);
    if (!Number.isFinite(maxRequestsPerMinute) || maxRequestsPerMinute <= 0) {
      return {
        started: false,
        reason:
          "TWELVE_DATA_MAX_REQUESTS_PER_MINUTE must be configured from the verified entitlement before ingestion can start.",
      };
    }
    const intervalMs = 15 * 60_000;
    const delayToNextBoundary = Math.max(1_000, intervalMs - (Date.now() % intervalMs) + 30_000);
    const run = () => {
      void this.runBackgroundRefresh(Math.max(1_000, Math.ceil(60_000 / maxRequestsPerMinute)));
      this.ingestionTimer = setTimeout(run, intervalMs);
      this.ingestionTimer.unref?.();
    };
    this.ingestionTimer = setTimeout(run, delayToNextBoundary);
    this.ingestionTimer.unref?.();
    return { started: true, reason: "Controlled M15 ingestion scheduled at the next boundary." };
  }

  public getIngestionStatus(): { running: boolean; symbols: string[] } {
    return { running: Boolean(this.ingestionTimer), symbols: [...TWELVE_AUTHORITY_SYMBOLS] };
  }

  public stopBackgroundIngestion(): void {
    if (this.ingestionTimer) clearTimeout(this.ingestionTimer);
    this.ingestionTimer = undefined;
  }

  private async runBackgroundRefresh(requestSpacingMs: number): Promise<void> {
    if (this.ingestionRunning) return;
    this.ingestionRunning = true;
    try {
      for (const symbol of TWELVE_AUTHORITY_SYMBOLS) {
        await this.getCandles(symbol, "M15", 100, undefined, {
          caller: "background-refresh",
          reason: "Controlled provider-owned M15 boundary ingestion.",
        });
        await new Promise((resolve) => setTimeout(resolve, requestSpacingMs));
      }
    } finally {
      this.ingestionRunning = false;
    }
  }

  protected async fetchQuote(
    canonical: CanonicalSymbol,
    providerSymbol: string,
    requestMetadata: ProviderRequestMetadata,
  ): Promise<QuoteData | null> {
    const key = env.twelveDataApiKey;
    if (!key) {
      this.noKeyError("TWELVE_DATA_API_KEY");
      return null;
    }
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(providerSymbol)}`;
    const result = await this.request(url, canonical, requestMetadata, {
      authorization: `apikey ${key}`,
    });
    if (!result || !result.body || typeof result.body !== "object") return null;
    const body = result.body as Record<string, unknown>;
    const price = finitePositive(body.close);
    const sourceTimestamp =
      timestampMilliseconds(body.last_quote_at) ?? parseTwelveDatetime(body.datetime);
    if (!price || !sourceTimestamp) {
      this.recordError("Twelve Data returned an invalid quote payload.");
      return null;
    }
    const receivedAt = Date.now();
    this.recordSourceTimestamp(sourceTimestamp, receivedAt);
    const age = receivedAt - sourceTimestamp;
    const marketOpen = body.is_market_open !== false;
    const status: QuoteData["status"] = !marketOpen
      ? "MARKET_CLOSED"
      : age <= TWELVE_QUOTE_FRESHNESS_MS
        ? "LIVE"
        : "STALE";
    return {
      symbol: canonical,
      provider: this.name,
      providerSymbol,
      instrumentType: instrumentTypeFor(canonical),
      price,
      last: price,
      mid: price,
      chartMode: "LAST",
      strategyPrice: price,
      displayPrice: price,
      change: finiteNumber(body.change),
      changePercent: finiteNumber(body.percent_change),
      priceBasis: priceBasisFor(canonical),
      timestamp: new Date(sourceTimestamp).toISOString(),
      receivedAt: new Date(receivedAt).toISOString(),
      status,
      dataState: status === "LIVE" ? "LIVE" : "STALE",
      delaySeconds: Math.max(0, Math.floor(age / 1000)),
    };
  }

  protected async fetchCandles(
    canonical: CanonicalSymbol,
    providerSymbol: string,
    limit: number,
    requestMetadata: ProviderRequestMetadata,
  ): Promise<CandleResponse | null> {
    const key = env.twelveDataApiKey;
    if (!key) {
      this.noKeyError("TWELVE_DATA_API_KEY");
      return null;
    }
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(providerSymbol)}&interval=15min&outputsize=${limit}&order=ASC&timezone=UTC`;
    const result = await this.request(url, canonical, requestMetadata, {
      authorization: `apikey ${key}`,
    });
    if (!result || !result.body || typeof result.body !== "object") return null;
    const body = result.body as Record<string, unknown>;
    const values = Array.isArray(body.values) ? body.values : [];
    const parsed = normalizeCandles(
      values.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const row = value as Record<string, unknown>;
        const time = parseTwelveDatetime(row.datetime);
        const open = finitePositive(row.open);
        const high = finitePositive(row.high);
        const low = finitePositive(row.low);
        const close = finitePositive(row.close);
        if (!time || !open || !high || !low || !close) return [];
        return [
          {
            time: Math.floor(time / 1000),
            open,
            high,
            low,
            close,
            volume: finiteNumber(row.volume) ?? 0,
          },
        ];
      }),
    );
    if (!parsed.length) {
      this.recordError("Twelve Data returned no valid M15 candles.");
      return null;
    }
    const latest = parsed.at(-1)!;
    const receivedAt = Date.now();
    this.recordSourceTimestamp(latest.time * 1000, receivedAt);
    const fresh = receivedAt - latest.time * 1000 <= TWELVE_CANDLE_FRESHNESS_MS;
    return {
      symbol: canonical,
      provider: this.name,
      providerSymbol,
      instrumentType: instrumentTypeFor(canonical),
      timeframe: "M15",
      timezone: "UTC",
      priceBasis: priceBasisFor(canonical),
      candles: parsed.slice(-limit),
      lastUpdated: latest.time,
      freshness: fresh ? "LIVE" : "STALE",
      dataState: fresh ? "LIVE" : "STALE",
      isEquivalentInstrument: true,
      sourceTimestamp: latest.time,
      receivedAt,
    };
  }
}

class MassiveShadowAdapter extends AuthenticatedExternalShadowAdapter {
  public readonly name = "MASSIVE" as const;
  public readonly displayName = "Massive EOD Shadow";
  protected readonly symbols = MASSIVE_SYMBOLS;
  protected readonly supportedTimeframe = "D1";
  protected readonly quoteFreshnessMs = MASSIVE_EOD_FRESHNESS_MS;
  protected readonly candleFreshnessMs = MASSIVE_EOD_FRESHNESS_MS;
  protected readonly healthWhenFresh = "DEGRADED" as const;

  protected healthReason(context: MarketDataContext): string {
    return `Massive returned delayed/end-of-day data; this key has no realtime WebSocket or minute entitlement for ${context.canonicalSymbol}.`;
  }

  protected async fetchQuote(
    canonical: CanonicalSymbol,
    providerSymbol: string,
    requestMetadata: ProviderRequestMetadata,
  ): Promise<QuoteData | null> {
    const key = env.massiveApiKey;
    if (!key) {
      this.noKeyError("MASSIVE_API_KEY");
      return null;
    }
    const url = `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(providerSymbol)}/prev?adjusted=true`;
    const result = await this.request(url, canonical, requestMetadata, {
      authorization: `Bearer ${key}`,
    });
    if (!result || !result.body || typeof result.body !== "object") return null;
    const body = result.body as Record<string, unknown>;
    const rows = Array.isArray(body.results) ? body.results : [];
    const row =
      rows[0] && typeof rows[0] === "object" ? (rows[0] as Record<string, unknown>) : undefined;
    const price = finitePositive(row?.c);
    const sourceTimestamp = timestampMilliseconds(row?.t);
    if (!price || !sourceTimestamp) {
      this.recordError("Massive returned an invalid end-of-day aggregate payload.");
      return null;
    }
    const receivedAt = Date.now();
    this.recordSourceTimestamp(sourceTimestamp, receivedAt);
    const age = Math.max(0, receivedAt - sourceTimestamp);
    return {
      symbol: canonical,
      provider: this.name,
      providerSymbol,
      instrumentType: instrumentTypeFor(canonical),
      price,
      last: price,
      mid: price,
      chartMode: "LAST",
      strategyPrice: price,
      displayPrice: price,
      priceBasis: priceBasisFor(canonical),
      timestamp: new Date(sourceTimestamp).toISOString(),
      receivedAt: new Date(receivedAt).toISOString(),
      status: age <= MASSIVE_EOD_FRESHNESS_MS ? "DELAYED" : "STALE",
      dataState: age <= MASSIVE_EOD_FRESHNESS_MS ? "FALLBACK" : "STALE",
      delaySeconds: Math.floor(age / 1000),
    };
  }

  protected async fetchCandles(
    canonical: CanonicalSymbol,
    providerSymbol: string,
    limit: number,
    requestMetadata: ProviderRequestMetadata,
  ): Promise<CandleResponse | null> {
    const quote = await this.fetchQuote(canonical, providerSymbol, {
      ...requestMetadata,
      reason: `${requestMetadata.reason} (synthesized from Massive EOD quote).`,
    });
    if (!quote) return null;
    const time = Math.floor(Date.parse(quote.timestamp) / 1000);
    const price = quote.price;
    return {
      symbol: canonical,
      provider: this.name,
      providerSymbol,
      instrumentType: instrumentTypeFor(canonical),
      timeframe: "D1",
      timezone: "UTC",
      candles: [{ time, open: price, high: price, low: price, close: price, volume: 0 }].slice(
        -limit,
      ),
      lastUpdated: time,
      freshness: quote.status === "DELAYED" ? "FALLBACK" : "STALE",
      dataState: quote.dataState,
      isEquivalentInstrument: true,
      sourceTimestamp: time,
      receivedAt: Date.parse(quote.receivedAt),
    };
  }
}

export const twelveDataShadowProvider = new TwelveDataShadowAdapter();
export const massiveShadowProvider = new MassiveShadowAdapter();
