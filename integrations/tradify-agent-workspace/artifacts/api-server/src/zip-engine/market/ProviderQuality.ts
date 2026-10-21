import type {
  Candle,
  MarketDataContext,
  ProviderHealth,
  ProviderHealthSnapshot,
  ProviderQualityCheck,
  QuoteData,
} from "./types";
import { SeriesValidator, type SeriesValidationSource } from "./SeriesValidator";
import type { ProviderSeriesReadinessState } from "./ProviderSeriesReadiness";
import { mt5ChartCandleFreshnessWindowMs } from "./CandleTime";

const TIMEFRAME_SECONDS: Record<string, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D1: 86400,
  W1: 604800,
  MN1: 2592000,
};

export interface ProviderQualityInput {
  context: MarketDataContext;
  providerName: string;
  providerSymbol?: string;
  providerHealth: ProviderHealthSnapshot;
  candles?: Candle[];
  quote?: QuoteData | null;
  quoteReceivedAt?: number;
  nowMs?: number;
}

export interface ProviderQualityReport extends ProviderHealthSnapshot {
  checks: ProviderQualityCheck[];
  closedCandleCount?: number;
  validationReason?: string;
  seriesReadiness?: ProviderSeriesReadinessState;
}

function check(
  name: string,
  passed: boolean,
  observedAt: number,
  reason?: string,
): ProviderQualityCheck {
  return { name, passed, observedAt, ...(reason ? { reason } : {}) };
}

function healthFromChecks(
  providerHealth: ProviderHealth,
  checks: ProviderQualityCheck[],
): ProviderHealth {
  if (providerHealth === "REJECTED") return providerHealth;
  if (providerHealth === "UNAVAILABLE") return providerHealth;
  if (providerHealth === "DEGRADED") return providerHealth;
  if (checks.some((item) => !item.passed)) {
    return providerHealth === "STALE" ? "STALE" : "DEGRADED";
  }
  return providerHealth === "STALE" ? "STALE" : "HEALTHY";
}

export function evaluateProviderQuality(input: ProviderQualityInput): ProviderQualityReport {
  const nowMs = input.nowMs ?? Date.now();
  const observedAt = nowMs;
  const timeframe = input.context.timeframe.toUpperCase();
  const intervalSeconds = TIMEFRAME_SECONDS[timeframe] ?? 900;
  const candles = input.candles ?? [];
  const isMt5DisplayCandlePath =
    input.providerName.toUpperCase() === "MT5" && input.context.purpose === "CANDLE";
  const checks: ProviderQualityCheck[] = [
    ...(input.providerHealth.checks ?? []),
    check(
      "PROVIDER_CONNECTION",
      input.providerHealth.health !== "UNAVAILABLE" && input.providerHealth.health !== "REJECTED",
      observedAt,
      input.providerHealth.reasons[0],
    ),
  ];

  if (input.context.purpose === "QUOTE") {
    const quote = input.quote;
    const parsedReceivedAtMs = quote ? Date.parse(quote.receivedAt) : Number.NaN;
    const receivedAtMs = input.quoteReceivedAt ?? parsedReceivedAtMs;
    const sourceTimestampMs = quote ? Date.parse(quote.timestamp) : Number.NaN;
    const responseValid =
      quote !== null &&
      quote !== undefined &&
      quote.status === "LIVE" &&
      (quote.dataState === undefined || quote.dataState === "LIVE") &&
      Number.isFinite(quote.price) &&
      quote.price > 0 &&
      Number.isFinite(parsedReceivedAtMs) &&
      parsedReceivedAtMs > 0 &&
      parsedReceivedAtMs <= nowMs &&
      Number.isFinite(receivedAtMs) &&
      receivedAtMs > 0 &&
      receivedAtMs <= nowMs &&
      Number.isFinite(sourceTimestampMs) &&
      sourceTimestampMs > 0 &&
      sourceTimestampMs <= nowMs;
    checks.push(
      check(
        "QUOTE_RESPONSE_VALID",
        responseValid,
        observedAt,
        responseValid
          ? undefined
          : "Quote response must be LIVE with a finite positive price, parseable timestamps, and live data state.",
      ),
    );
    const ageMs = Number.isFinite(receivedAtMs)
      ? Math.max(0, nowMs - receivedAtMs)
      : Number.POSITIVE_INFINITY;
    checks.push(
      check(
        "QUOTE_FRESHNESS",
        ageMs <= 30_000,
        observedAt,
        ageMs > 30_000
          ? `Quote age ${Number.isFinite(ageMs) ? ageMs : "unknown"}ms exceeds 30000ms.`
          : undefined,
      ),
    );
    return {
      ...input.providerHealth,
      health: healthFromChecks(input.providerHealth.health, checks),
      checks,
    };
  }

  if (candles.length === 0) {
    checks.push(check("CANDLE_AVAILABILITY", false, observedAt, "No candles were returned."));
    return {
      ...input.providerHealth,
      health: healthFromChecks(input.providerHealth.health, checks),
      checks,
      validationReason: "No candles were returned.",
      seriesReadiness: {
        providerId: input.providerName,
        canonicalSymbol: input.context.canonicalSymbol,
        timeframe,
        enoughHistoryLoaded: false,
        latestRequiredClosedBarPresent: false,
        continuityValid: false,
        fullSynchronizationComplete:
          input.providerHealth.seriesReadiness?.fullSynchronizationComplete ?? false,
        freshnessValid: false,
        observedAt,
      },
    };
  }

  const sortedTimes = candles.map((candle) => candle.time);
  const duplicateCount = sortedTimes.length - new Set(sortedTimes).size;
  checks.push(
    check(
      "DUPLICATE_BARS",
      duplicateCount === 0,
      observedAt,
      duplicateCount ? `${duplicateCount} duplicate candle timestamps found.` : undefined,
    ),
  );

  let outOfOrder = false;
  for (let index = 1; index < sortedTimes.length; index += 1) {
    if (sortedTimes[index] <= sortedTimes[index - 1]) {
      outOfOrder = true;
      break;
    }
  }
  checks.push(
    check(
      "OUT_OF_ORDER_UPDATES",
      !outOfOrder,
      observedAt,
      outOfOrder ? "Candle timestamps are not strictly increasing." : undefined,
    ),
  );

  const finitePrices = candles.every((candle) =>
    [candle.open, candle.high, candle.low, candle.close].every(
      (value) => Number.isFinite(value) && value > 0,
    ),
  );
  checks.push(
    check(
      "FINITE_PRICES",
      finitePrices,
      observedAt,
      finitePrices ? undefined : "At least one OHLC value is invalid.",
    ),
  );

  const aligned = candles.every((candle) => candle.time % intervalSeconds === 0);
  checks.push(
    check(
      "TIMESTAMP_ALIGNMENT",
      aligned,
      observedAt,
      aligned ? undefined : `At least one candle is not aligned to ${timeframe}.`,
    ),
  );

  const continuityDeltas = candles
    .slice(1)
    .map((candle, index) => candle.time - candles[index].time)
    .filter((delta) => delta > 0 && delta <= 2 * 3600);
  const expectedDelta = intervalSeconds;
  let missingBars = continuityDeltas.filter((delta) => delta > expectedDelta).length;
  let continuityValid = isMt5DisplayCandlePath || missingBars === 0;
  let continuityReason: string | undefined;
  if (
    timeframe === "M15" &&
    input.providerName.toUpperCase() === "MT5" &&
    input.context.purpose === "STRATEGY"
  ) {
    const continuity = SeriesValidator.validateMt5M15Continuity(
      input.context.canonicalSymbol,
      input.providerSymbol ?? input.context.canonicalSymbol,
      candles,
      nowMs,
    );
    missingBars = continuity.missingIntervalCount;
    continuityValid = continuity.valid;
    continuityReason = continuity.reason;
  }
  checks.push(
    check(
      "CANDLE_CONTINUITY",
      continuityValid,
      observedAt,
      !continuityValid
        ? (continuityReason ?? `${missingBars} intra-session candle gaps found.`)
        : isMt5DisplayCandlePath && missingBars > 0
          ? `${missingBars} candle history gaps are allowed for MT5 chart display.`
          : undefined,
    ),
  );

  const geometryValid = candles.every(
    (candle) =>
      candle.high >= candle.low &&
      candle.high >= candle.open &&
      candle.high >= candle.close &&
      candle.low <= candle.open &&
      candle.low <= candle.close,
  );
  checks.push(
    check(
      "CANDLE_GEOMETRY",
      geometryValid,
      observedAt,
      geometryValid ? undefined : "At least one candle violates OHLC bounds.",
    ),
  );

  const abnormalJump = candles.slice(1).some((candle, index) => {
    const previousClose = candles[index].close;
    return previousClose > 0 && Math.abs(candle.close - previousClose) / previousClose > 0.2;
  });
  checks.push(
    check(
      "ABNORMAL_JUMPS",
      !abnormalJump,
      observedAt,
      abnormalJump ? "A close-to-close move exceeded the 20% integrity threshold." : undefined,
    ),
  );

  const latestCandle = candles.at(-1);
  const candleAgeMs = latestCandle
    ? Math.max(0, nowMs - latestCandle.time * 1000)
    : Number.POSITIVE_INFINITY;
  const candleFreshnessWindowMs = isMt5DisplayCandlePath
    ? mt5ChartCandleFreshnessWindowMs(timeframe)
    : Math.max(intervalSeconds * 1000 * 2, 30 * 60 * 1000);
  checks.push(
    check(
      "CANDLE_FRESHNESS",
      candleAgeMs <= candleFreshnessWindowMs,
      observedAt,
      candleAgeMs > candleFreshnessWindowMs
        ? `Latest candle age ${candleAgeMs}ms exceeds ${candleFreshnessWindowMs}ms.`
        : undefined,
    ),
  );

  let closedCandleCount: number | undefined = isMt5DisplayCandlePath
    ? candles.filter((candle) => candle.time + intervalSeconds <= Math.floor(nowMs / 1000)).length
    : timeframe === "M15"
      ? undefined
      : candles.length;
  let validationReason: string | undefined;
  if (timeframe === "M15" && !isMt5DisplayCandlePath) {
    const source: SeriesValidationSource = {
      connected:
        input.providerHealth.health !== "UNAVAILABLE" && input.providerHealth.health !== "REJECTED",
      health: input.providerHealth.health,
      availabilityReason: input.providerHealth.reasons[0],
    };
    const validation = SeriesValidator.validateM15Series(
      input.context.canonicalSymbol,
      input.providerName,
      input.providerSymbol ?? input.context.canonicalSymbol,
      candles,
      Math.floor(nowMs / 1000),
      source,
    );
    closedCandleCount = validation.closedCandles?.length ?? 0;
    validationReason = validation.reason;
    checks.push(check("M15_SERIES_VALIDATION", validation.valid, observedAt, validation.reason));
  }

  const health = healthFromChecks(input.providerHealth.health, checks);
  const seriesReadiness: ProviderSeriesReadinessState = {
    providerId: input.providerName,
    canonicalSymbol: input.context.canonicalSymbol,
    timeframe,
    enoughHistoryLoaded: (closedCandleCount ?? candles.length) >= 50,
    latestRequiredClosedBarPresent:
      checks.some((item) => item.name === "CANDLE_FRESHNESS" && item.passed) &&
      (timeframe !== "M15" || (closedCandleCount ?? 0) > 0),
    continuityValid: checks.some((item) => item.name === "CANDLE_CONTINUITY" && item.passed),
    fullSynchronizationComplete:
      input.providerHealth.seriesReadiness?.fullSynchronizationComplete ?? false,
    freshnessValid: checks.some((item) => item.name === "CANDLE_FRESHNESS" && item.passed),
    observedAt,
  };
  return {
    ...input.providerHealth,
    health,
    checks,
    closedCandleCount,
    validationReason,
    seriesReadiness,
  };
}
