export const CANDLE_FRESHNESS_GRACE_MS = 30 * 60 * 1000;
const NEW_YORK_TIME_ZONE = "America/New_York";
const SERVER_WALL_AHEAD_OF_NEW_YORK_SECONDS = 7 * 60 * 60;
const newYorkFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: NEW_YORK_TIME_ZONE,
  calendar: "iso8601",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zonedCivilEpochMilliseconds(instantMs: number): number {
  const values = Object.fromEntries(
    newYorkFormatter
      .formatToParts(new Date(instantMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
}

/** Darwinex New York-close server offset at an actual UTC instant (+2/+3). */
export function mt5ServerUtcOffsetSeconds(utcSeconds: number): number {
  if (!Number.isSafeInteger(utcSeconds) || utcSeconds <= 0) return 0;
  const instantMs = utcSeconds * 1000;
  return (
    SERVER_WALL_AHEAD_OF_NEW_YORK_SECONDS +
    (zonedCivilEpochMilliseconds(instantMs) - instantMs) / 1000
  );
}

/** Convert a real UTC instant to MT5's naive server-wall epoch representation. */
export function mt5ServerWallTimeFromUtc(utcSeconds: number): number {
  const offset = mt5ServerUtcOffsetSeconds(utcSeconds);
  return offset ? utcSeconds + offset : 0;
}

/**
 * Convert a naive MT5 server-wall epoch to UTC. Nonexistent and repeated
 * New York wall times are rejected instead of guessed.
 */
export function mt5ServerWallTimeToUtc(rawServerTime: number): number {
  const sourceSeconds = Math.floor(
    rawServerTime > 10_000_000_000 ? rawServerTime / 1000 : rawServerTime,
  );
  if (!Number.isSafeInteger(sourceSeconds) || sourceSeconds <= 0) return 0;
  const targetNyCivilMs =
    (sourceSeconds - SERVER_WALL_AHEAD_OF_NEW_YORK_SECONDS) * 1000;
  const offsets = new Set<number>();
  for (let probe = targetNyCivilMs - 36 * 3_600_000; probe <= targetNyCivilMs + 36 * 3_600_000; probe += 6 * 3_600_000) {
    offsets.add(zonedCivilEpochMilliseconds(probe) - probe);
  }
  const matches = [...offsets]
    .map((offset) => targetNyCivilMs - offset)
    .filter((candidateMs) => zonedCivilEpochMilliseconds(candidateMs) === targetNyCivilMs);
  return matches.length === 1 ? matches[0] / 1000 : 0;
}

const timeframeSeconds: Record<string, number> = {
  M1: 60,
  M5: 5 * 60,
  M15: 15 * 60,
  M30: 30 * 60,
  H1: 60 * 60,
  H4: 4 * 60 * 60,
  D1: 24 * 60 * 60,
  W1: 7 * 24 * 60 * 60,
  MN1: 31 * 24 * 60 * 60,
};

export function timeframeDurationSeconds(timeframe: string): number {
  return timeframeSeconds[timeframe.toUpperCase()] ?? 0;
}

/**
 * MT5 timestamps identify candle opens, so a current higher-timeframe candle
 * can be older than the short M15 freshness threshold while still updating.
 * Keep the established 30-minute M15 window used by strategy evaluation and
 * retain the existing one-interval chart grace for higher timeframes.
 */
export function mt5ChartCandleFreshnessWindowMs(timeframe: string): number {
  const normalizedTimeframe = timeframe.toUpperCase();
  if (
    normalizedTimeframe === "M1" ||
    normalizedTimeframe === "M5" ||
    normalizedTimeframe === "M15"
  ) {
    return CANDLE_FRESHNESS_GRACE_MS;
  }
  const durationMs = timeframeDurationSeconds(normalizedTimeframe) * 1000;
  return durationMs + Math.max(CANDLE_FRESHNESS_GRACE_MS, durationMs);
}

export type ExternalTimestampUnit = "SECONDS" | "MILLISECONDS" | "ISO_UTC";
export type ExternalTimestampSemantics = "OPEN" | "CLOSE";

/**
 * Convert a provider timestamp whose semantics are known into the canonical
 * UTC candle-open representation. This intentionally does not bucket or
 * floor the result; SeriesValidator must reject an actually off-grid value.
 */
export function normalizeExternalCandleOpenTime(
  rawTime: unknown,
  unit: ExternalTimestampUnit,
  semantics: ExternalTimestampSemantics,
  timeframe: string,
): number {
  const interval = timeframeDurationSeconds(timeframe);
  if (!interval) return 0;

  let milliseconds: number;
  if (unit === "ISO_UTC") {
    if (typeof rawTime !== "string") return 0;
    const value = rawTime.includes("T") ? rawTime : rawTime.replace(" ", "T");
    const parsed = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    milliseconds = parsed;
  } else {
    const numeric =
      typeof rawTime === "string" && rawTime.trim() !== "" ? Number(rawTime) : rawTime;
    if (
      typeof numeric !== "number" ||
      !Number.isFinite(numeric) ||
      numeric <= 0 ||
      !Number.isInteger(numeric)
    )
      return 0;
    milliseconds = unit === "MILLISECONDS" ? numeric : numeric * 1000;
  }

  if (!Number.isInteger(milliseconds) || milliseconds % 1000 !== 0) return 0;
  const seconds = milliseconds / 1000;
  return semantics === "CLOSE" ? seconds - interval : seconds;
}

/**
 * Normalize broker-server epoch seconds or milliseconds to UTC seconds.
 * Quotes retain their exact second; candle ingestion applies grid bucketing separately.
 */
export function normalizeBrokerTime(rawTime: number): number {
  return mt5ServerWallTimeToUtc(rawTime);
}

/**
 * Bucket broker timestamps to the requested candle opening time at ingestion.
 * SeriesValidator still owns strict grid, geometry, closed-bar, and sufficiency checks.
 */
export function normalizeBrokerCandleTime(rawTime: number, timeframe: string): number {
  const time = normalizeBrokerTime(rawTime);
  const interval = timeframeDurationSeconds(timeframe);
  return interval ? Math.floor(time / interval) * interval : time;
}

/**
 * MT5 bridge builds in the wild use both `time` and `timestamp`, and may
 * serialize either value as a number or numeric string. Reject missing times
 * instead of substituting the receipt time, which creates off-grid candles.
 */
export function normalizeBridgeCandleTime(
  input: Record<string, unknown>,
  timeframe: string,
): number {
  const candidate = input.time ?? input.timestamp ?? input.openTime ?? input.open_time;
  const rawTime = Number(candidate);
  return Number.isFinite(rawTime) && rawTime > 0
    ? normalizeBrokerCandleTime(rawTime, timeframe)
    : 0;
}
