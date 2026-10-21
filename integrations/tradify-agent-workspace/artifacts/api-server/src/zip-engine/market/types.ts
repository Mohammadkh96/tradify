export type DataState = "LIVE" | "FALLBACK" | "STALE" | "ERROR";

export type ProviderRole = "PRIMARY" | "ALTERNATE" | "SHADOW" | "REFERENCE";
export type ProviderApproval = "APPROVED" | "NOT_APPROVED";
export type ProviderHealth = "HEALTHY" | "DEGRADED" | "STALE" | "UNAVAILABLE" | "REJECTED";
export type PriceBasis = "USD" | "USDT" | "BROKER";

export interface MarketDataContext {
  canonicalSymbol: string;
  timeframe: string;
  strategyId: string;
  purpose?: "QUOTE" | "CANDLE" | "STRATEGY";
  requestMetadata?: ProviderRequestMetadata;
}

export interface ProviderRequestMetadata {
  caller: string;
  reason: string;
}

export interface ProviderHealthSnapshot {
  health: ProviderHealth;
  reasons: string[];
  observedAt: number;
  checks?: ProviderQualityCheck[];
  metrics?: ProviderRuntimeMetrics;
  seriesReadiness?: import("./ProviderSeriesReadiness").ProviderSeriesReadinessState;
}

export interface ProviderRuntimeMetrics {
  requestCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  errorCount: number;
  rateLimitEvents: number;
  reconnectCount: number;
  sourceTimestampAdvances: number;
  lastSourceTimestamp?: string;
  lastReceivedAt?: string;
  sourceAgeMs?: number;
  lastStatusCode?: number;
  lastError?: string;
  lastRateLimitRemaining?: number;
  lastRateLimitLimit?: number;
  lastRetryAfterMs?: number;
  backoffUntil?: string;
  requestAudit?: ProviderRequestAudit[];
}

export interface ProviderRequestAudit {
  endpoint: string;
  canonicalSymbol: string;
  requestTimestamp: string;
  status?: number;
  creditsConsumed?: number;
  creditsRemaining?: number;
  cache: "HIT" | "MISS";
  caller: string;
  reason: string;
}

export interface ProviderQualityCheck {
  name: string;
  passed: boolean;
  reason?: string;
  observedAt: number;
}

export interface ProviderProvenance {
  providerId: string;
  providerSymbol?: string;
  canonicalSymbol?: string;
  instrumentClass?: string;
  timeframe?: string;
  role: ProviderRole;
  approval: ProviderApproval;
  health: ProviderHealth;
  authority: boolean;
  authorityReason?: string;
  authorityContext?: string;
  capabilityApproval?: ProviderApproval;
  capabilityState?: string;
  seriesReady?: boolean;
  sourceTimestamp?: number;
  transitionTimestamp?: number;
}

export interface QuoteData {
  symbol: string;
  provider: string;
  providerSymbol: string;
  instrumentType: string;
  price: number;
  bid?: number;
  ask?: number;
  last?: number;
  mid?: number;
  chartMode?: "BID" | "LAST" | "MID";
  strategyPrice?: number;
  displayPrice?: number;
  change?: number;
  changePercent?: number;
  priceBasis?: PriceBasis;
  timestamp: string;
  receivedAt: string;
  status: "LIVE" | "DELAYED" | "STALE" | "MARKET_CLOSED" | "RECONNECTING" | "UNAVAILABLE" | "DEMO";
  dataState?: DataState;
  lastError?: string;
  delaySeconds?: number;
  provenance?: ProviderProvenance;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandleResponse {
  symbol: string;
  provider: string;
  providerSymbol: string;
  instrumentType: string;
  priceBasis?: PriceBasis;
  timeframe: string;
  timezone: "UTC";
  candles: Candle[];
  lastUpdated?: number;
  freshness?: "LIVE" | "FALLBACK" | "STALE" | "ERROR";
  dataState?: DataState;
  isEquivalentInstrument?: boolean;
  sourceTimestamp?: number;
  receivedAt?: number;
  provenance?: ProviderProvenance;
}

export interface IMarketDataProvider {
  name: string;
  supportsSymbol(symbol: string): boolean;
  getQuote(
    symbol: string,
    overrideProviderSymbol?: string,
    requestMetadata?: ProviderRequestMetadata,
  ): Promise<QuoteData | null>;
  getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
    overrideProviderSymbol?: string,
    requestMetadata?: ProviderRequestMetadata,
  ): Promise<CandleResponse | null>;
  getHealth?(context: MarketDataContext): Promise<ProviderHealthSnapshot>;
}
