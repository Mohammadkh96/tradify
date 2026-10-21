import { fetchWithRetry } from "../../../lib/fetch-with-retry";
import type {
  Candle,
  CandleResponse,
  IMarketDataProvider,
  MarketDataContext,
  ProviderHealthSnapshot,
  ProviderRuntimeMetrics,
  QuoteData,
} from "../types";
import { normalizeExternalCandleOpenTime } from "../CandleTime";
import { sanitizeDiagnosticText } from "../ProviderDiagnosticSanitizer";

type CryptoCanonicalSymbol = "BTCUSD" | "ETHUSD";
type ShadowProviderName = "BINANCE" | "COINBASE";

interface ProviderResponse {
  response: Response;
  json: unknown;
}

interface CryptoShadowConfig {
  name: ShadowProviderName;
  displayName: string;
  symbols: Record<CryptoCanonicalSymbol, string>;
  baseUrl: string;
  tickerPath: (providerSymbol: string) => string;
  candlesPath: (providerSymbol: string, limit: number) => string;
  parseTicker: (
    json: unknown,
    providerSymbol: string,
  ) =>
    | {
        price: number;
        bid?: number;
        ask?: number;
        sourceTimestamp: number;
        priceBasis: "USD" | "USDT";
      }
    | undefined;
  parseCandles: (json: unknown) => Candle[];
}

const SYMBOLS: CryptoCanonicalSymbol[] = ["BTCUSD", "ETHUSD"];
const QUOTE_FRESHNESS_MS = 30_000;
const CANDLE_FRESHNESS_MS = 30 * 60_000;
const M15_SECONDS = 15 * 60;

function finitePositive(value: unknown): number | undefined {
  const number =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function toMilliseconds(value: unknown): number | undefined {
  if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  const number = finitePositive(value);
  if (!number) return undefined;
  return number < 10_000_000_000 ? number * 1000 : number;
}

function normalizeCandles(rows: Candle[], rawOrder: "ASC" | "DESC"): Candle[] {
  const normalized: Candle[] = [];
  const seen = new Set<number>();
  let previousTime: number | undefined;
  for (const candle of rows) {
    if (
      !Number.isFinite(candle.time) ||
      candle.time <= 0 ||
      ![candle.open, candle.high, candle.low, candle.close].every(
        (value) => Number.isFinite(value) && value > 0,
      ) ||
      !Number.isFinite(candle.volume ?? 0) ||
      candle.high < candle.low ||
      candle.high < Math.max(candle.open, candle.close) ||
      candle.low > Math.min(candle.open, candle.close)
    )
      continue;
    if (seen.has(candle.time)) return [];
    if (
      previousTime !== undefined &&
      (rawOrder === "ASC" ? candle.time <= previousTime : candle.time >= previousTime)
    )
      return [];
    seen.add(candle.time);
    previousTime = candle.time;
    normalized.push({ ...candle, volume: candle.volume ?? 0 });
  }
  return rawOrder === "DESC" ? normalized.reverse() : normalized;
}

function parseBinanceTicker(json: unknown, providerSymbol: string) {
  if (!json || typeof json !== "object") return undefined;
  const row = json as Record<string, unknown>;
  const price = finitePositive(row.lastPrice);
  const sourceTimestamp = toMilliseconds(row.closeTime);
  if (!price || !sourceTimestamp) return undefined;
  return {
    price,
    bid: finitePositive(row.bidPrice),
    ask: finitePositive(row.askPrice),
    sourceTimestamp,
    priceBasis: "USDT" as const,
  };
}

function parseBinanceCandles(json: unknown): Candle[] {
  if (!Array.isArray(json)) return [];
  return normalizeCandles(
    json.flatMap((row) => {
      if (!Array.isArray(row)) return [];
      const time = normalizeExternalCandleOpenTime(row[0], "MILLISECONDS", "OPEN", "M15");
      const open = finitePositive(row[1]);
      const high = finitePositive(row[2]);
      const low = finitePositive(row[3]);
      const close = finitePositive(row[4]);
      if (!time || !open || !high || !low || !close) return [];
      return [{ time, open, high, low, close, volume: Number(row[5]) || 0 }];
    }),
    "ASC",
  );
}

function parseCoinbaseTicker(json: unknown, providerSymbol: string) {
  if (!json || typeof json !== "object") return undefined;
  const row = json as Record<string, unknown>;
  const price = finitePositive(row.price);
  const sourceTimestamp = toMilliseconds(row.time);
  if (!price || !sourceTimestamp) return undefined;
  return {
    price,
    bid: finitePositive(row.bid),
    ask: finitePositive(row.ask),
    sourceTimestamp,
    priceBasis: "USD" as const,
  };
}

function parseCoinbaseCandles(json: unknown): Candle[] {
  if (!Array.isArray(json)) return [];
  return normalizeCandles(
    json.flatMap((row) => {
      if (!Array.isArray(row) || row.length < 6) return [];
      const time = normalizeExternalCandleOpenTime(row[0], "SECONDS", "OPEN", "M15");
      const low = finitePositive(row[1]);
      const high = finitePositive(row[2]);
      const open = finitePositive(row[3]);
      const close = finitePositive(row[4]);
      if (!time || !low || !high || !open || !close) return [];
      return [{ time, open, high, low, close, volume: Number(row[5]) || 0 }];
    }),
    "DESC",
  );
}

const BINANCE_CONFIG: CryptoShadowConfig = {
  name: "BINANCE",
  displayName: "Binance Public Market Data",
  symbols: { BTCUSD: "BTCUSDT", ETHUSD: "ETHUSDT" },
  baseUrl: "https://data-api.binance.vision",
  tickerPath: (providerSymbol) => `/api/v3/ticker/24hr?symbol=${providerSymbol}`,
  candlesPath: (providerSymbol, limit) =>
    `/api/v3/klines?symbol=${providerSymbol}&interval=15m&limit=${Math.min(limit, 1000)}`,
  parseTicker: parseBinanceTicker,
  parseCandles: parseBinanceCandles,
};

const COINBASE_CONFIG: CryptoShadowConfig = {
  name: "COINBASE",
  displayName: "Coinbase Exchange Public Market Data",
  symbols: { BTCUSD: "BTC-USD", ETHUSD: "ETH-USD" },
  baseUrl: "https://api.exchange.coinbase.com",
  tickerPath: (providerSymbol) => `/products/${providerSymbol}/ticker`,
  candlesPath: (providerSymbol, limit) => `/products/${providerSymbol}/candles?granularity=900`,
  parseTicker: parseCoinbaseTicker,
  parseCandles: parseCoinbaseCandles,
};

function canonicalFor(
  config: CryptoShadowConfig,
  symbol: string,
): CryptoCanonicalSymbol | undefined {
  return SYMBOLS.find(
    (canonical) => canonical === symbol.toUpperCase() && config.symbols[canonical],
  );
}

export class CryptoShadowProviderAdapter implements IMarketDataProvider {
  public readonly name: ShadowProviderName;
  public readonly displayName: string;
  private previousRequestFailed = false;
  private metrics: ProviderRuntimeMetrics = {
    requestCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    errorCount: 0,
    rateLimitEvents: 0,
    reconnectCount: 0,
    sourceTimestampAdvances: 0,
  };

  public constructor(private readonly config: CryptoShadowConfig) {
    this.name = config.name;
    this.displayName = config.displayName;
  }

  public supportsSymbol(symbol: string): boolean {
    return Boolean(canonicalFor(this.config, symbol));
  }

  public getMetrics(): ProviderRuntimeMetrics {
    return { ...this.metrics };
  }

  public async getQuote(
    symbol: string,
    overrideProviderSymbol?: string,
  ): Promise<QuoteData | null> {
    const canonical = canonicalFor(this.config, symbol);
    if (!canonical) return null;
    const providerSymbol = overrideProviderSymbol ?? this.config.symbols[canonical];
    const result = await this.request(this.config.tickerPath(providerSymbol));
    if (!result) return null;
    const parsed = this.config.parseTicker(result.json, providerSymbol);
    if (!parsed) {
      this.recordError("Provider returned an invalid ticker payload.");
      return null;
    }
    const receivedAt = Date.now();
    this.recordSourceTimestamp(parsed.sourceTimestamp, receivedAt);
    const bid = parsed.bid ?? parsed.price;
    const ask = parsed.ask ?? parsed.price;
    return {
      symbol: canonical,
      provider: this.name,
      providerSymbol,
      instrumentType: "CRYPTO_SPOT",
      price: parsed.price,
      bid,
      ask,
      last: parsed.price,
      mid: (bid + ask) / 2,
      chartMode: "LAST",
      strategyPrice: parsed.price,
      displayPrice: parsed.price,
      timestamp: new Date(parsed.sourceTimestamp).toISOString(),
      receivedAt: new Date(receivedAt).toISOString(),
      status: receivedAt - parsed.sourceTimestamp <= QUOTE_FRESHNESS_MS ? "LIVE" : "STALE",
      dataState: receivedAt - parsed.sourceTimestamp <= QUOTE_FRESHNESS_MS ? "LIVE" : "STALE",
      priceBasis: this.name === "BINANCE" ? "USDT" : "USD",
    };
  }

  public async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
    overrideProviderSymbol?: string,
  ): Promise<CandleResponse | null> {
    const canonical = canonicalFor(this.config, symbol);
    if (!canonical || timeframe.toUpperCase() !== "M15") return null;
    const providerSymbol = overrideProviderSymbol ?? this.config.symbols[canonical];
    const result = await this.request(this.config.candlesPath(providerSymbol, limit));
    if (!result) return null;
    const candles = this.config.parseCandles(result.json);
    if (!candles.length) {
      this.recordError("Provider returned no valid M15 candles.");
      return null;
    }
    const latest = candles.at(-1)!;
    const receivedAt = Date.now();
    this.recordSourceTimestamp(latest.time * 1000, receivedAt);
    const fresh = receivedAt - latest.time * 1000 <= CANDLE_FRESHNESS_MS;
    return {
      symbol: canonical,
      provider: this.name,
      providerSymbol,
      instrumentType: "CRYPTO_SPOT",
      priceBasis: this.name === "BINANCE" ? "USDT" : "USD",
      timeframe: "M15",
      timezone: "UTC",
      candles: candles.slice(-Math.min(Math.max(limit, 1), 300)),
      lastUpdated: latest.time,
      freshness: fresh ? "LIVE" : "STALE",
      dataState: fresh ? "LIVE" : "STALE",
      isEquivalentInstrument: this.name === "COINBASE",
      sourceTimestamp: latest.time,
      receivedAt,
    };
  }

  public async getHealth(context: MarketDataContext): Promise<ProviderHealthSnapshot> {
    const now = Date.now();
    const checks: NonNullable<ProviderHealthSnapshot["checks"]> = [];
    if (!this.supportsSymbol(context.canonicalSymbol)) {
      return {
        health: "UNAVAILABLE",
        reasons: [`${this.name} shadow adapter supports BTCUSD and ETHUSD only.`],
        observedAt: now,
        checks,
        metrics: this.getMetrics(),
      };
    }
    const data =
      context.purpose === "QUOTE"
        ? await this.getQuote(context.canonicalSymbol)
        : await this.getCandles(context.canonicalSymbol, context.timeframe, 300);
    if (!data) {
      return {
        health: "UNAVAILABLE",
        reasons: [this.metrics.lastError ?? `${this.name} did not return usable market data.`],
        observedAt: now,
        checks,
        metrics: this.getMetrics(),
      };
    }
    const sourceTimestamp =
      "timestamp" in data ? Date.parse(data.timestamp) : (data.sourceTimestamp ?? 0) * 1000;
    const sourceAgeMs = Math.max(0, Date.now() - sourceTimestamp);
    checks.push({
      name: "SOURCE_TIMESTAMP_PRESENT",
      passed: Number.isFinite(sourceTimestamp) && sourceTimestamp > 0,
      observedAt: now,
    });
    checks.push({
      name: "SOURCE_TIMESTAMP_ADVANCING",
      passed: this.metrics.sourceTimestampAdvances > 0 || this.metrics.requestCount <= 1,
      observedAt: now,
      reason:
        this.metrics.sourceTimestampAdvances > 0
          ? undefined
          : "No later source timestamp has been observed yet.",
    });
    checks.push({
      name: context.purpose === "QUOTE" ? "QUOTE_FRESHNESS" : "M15_FRESHNESS",
      passed:
        sourceAgeMs <= (context.purpose === "QUOTE" ? QUOTE_FRESHNESS_MS : CANDLE_FRESHNESS_MS),
      observedAt: now,
      reason:
        sourceAgeMs > (context.purpose === "QUOTE" ? QUOTE_FRESHNESS_MS : CANDLE_FRESHNESS_MS)
          ? `Source age ${sourceAgeMs}ms exceeds the shadow threshold.`
          : undefined,
    });
    return {
      health:
        sourceAgeMs <= (context.purpose === "QUOTE" ? QUOTE_FRESHNESS_MS : CANDLE_FRESHNESS_MS)
          ? "HEALTHY"
          : "STALE",
      reasons: [
        `${this.displayName} returned ${context.purpose === "QUOTE" ? "a quote" : "M15 candles"} for ${context.canonicalSymbol}.`,
      ],
      observedAt: now,
      checks,
      metrics: this.getMetrics(),
      ...(context.purpose === "QUOTE"
        ? {}
        : {
            seriesReadiness: {
              providerId: this.name,
              canonicalSymbol: context.canonicalSymbol,
              timeframe: context.timeframe.toUpperCase(),
              enoughHistoryLoaded: "candles" in data && data.candles.length >= 50,
              latestRequiredClosedBarPresent: sourceAgeMs <= CANDLE_FRESHNESS_MS,
              continuityValid: true,
              fullSynchronizationComplete: true,
              freshnessValid: sourceAgeMs <= CANDLE_FRESHNESS_MS,
              observedAt: now,
            },
          }),
    };
  }

  private async request(path: string): Promise<ProviderResponse | undefined> {
    const receivedAt = Date.now();
    this.metrics.requestCount += 1;
    try {
      const response = await fetchWithRetry(
        `${this.config.baseUrl}${path}`,
        {
          headers: { accept: "application/json", "user-agent": "TradifySignals/1.0" },
        },
        { timeoutMs: 8_000 },
      );
      this.metrics.lastStatusCode = response.status;
      if (response.status === 429) this.metrics.rateLimitEvents += 1;
      if (!response.ok) {
        this.recordError(`Provider returned HTTP ${response.status}.`);
        return undefined;
      }
      const json = (await response.json()) as unknown;
      if (this.previousRequestFailed) this.metrics.reconnectCount += 1;
      this.previousRequestFailed = false;
      this.metrics.lastReceivedAt = new Date(receivedAt).toISOString();
      return { response, json };
    } catch (error) {
      this.recordError(error instanceof Error ? error.message : "Provider request failed.");
      return undefined;
    }
  }

  private recordSourceTimestamp(timestamp: number, receivedAt: number): void {
    const previous = this.metrics.lastSourceTimestamp
      ? Date.parse(this.metrics.lastSourceTimestamp)
      : 0;
    if (timestamp > previous) this.metrics.sourceTimestampAdvances += 1;
    this.metrics.lastSourceTimestamp = new Date(timestamp).toISOString();
    this.metrics.lastReceivedAt = new Date(receivedAt).toISOString();
    this.metrics.sourceAgeMs = Math.max(0, receivedAt - timestamp);
    this.metrics.lastError = undefined;
  }

  private recordError(message: string): void {
    this.metrics.errorCount += 1;
    this.metrics.lastError = sanitizeDiagnosticText(message);
    this.previousRequestFailed = true;
  }
}

export const binanceShadowProvider = new CryptoShadowProviderAdapter(BINANCE_CONFIG);
export const coinbaseShadowProvider = new CryptoShadowProviderAdapter(COINBASE_CONFIG);
