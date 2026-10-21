import { logger } from "../../lib/logger";
import { Candle } from "./types";
import { FallbackMap } from "./FallbackMap";
import type { ProviderHealth } from "./types";
import { marketCatalog } from "./MarketCatalog";
import { isMt5SessionOpenAtUtc } from "./Mt5HistoryCoverage";
import { sanitizeDiagnosticText } from "./ProviderDiagnosticSanitizer";

export interface SeriesValidationSource {
  connected?: boolean;
  health?: ProviderHealth;
  availabilityReason?: string;
}

export interface SeriesValidationResult {
  valid: boolean;
  checkFailed?: number;
  checkName?: string;
  reason?: string;
  closedCandles?: Candle[];
}

export interface M15ContinuityResult {
  valid: boolean;
  missingIntervalCount: number;
  reason?: string;
}

export class SeriesValidator {
  private static loggedFailures: Map<string, string> = new Map();

  public static validateMt5M15Continuity(
    symbol: string,
    providerSymbol: string,
    candles: Candle[],
    nowMs = Date.now(),
  ): M15ContinuityResult {
    const gaps: Array<{ start: number; end: number }> = [];
    let missingIntervalCount = 0;
    for (let index = 1; index < candles.length; index += 1) {
      const previousTime = candles[index - 1].time;
      const currentTime = candles[index].time;
      const delta = currentTime - previousTime;
      if (!Number.isFinite(delta) || delta <= 0 || delta % 900 !== 0) {
        return {
          valid: false,
          missingIntervalCount,
          reason: "MT5 M15 candle timestamps are not strictly increasing on the 15-minute grid.",
        };
      }
      if (delta === 900) continue;
      gaps.push({ start: previousTime + 900, end: currentTime });
      missingIntervalCount += delta / 900 - 1;
    }
    if (gaps.length === 0) return { valid: true, missingIntervalCount: 0 };

    const schedule = marketCatalog.getCurrentBrokerTradingSessions(symbol, providerSymbol, nowMs);
    if (!schedule) {
      return {
        valid: false,
        missingIntervalCount,
        reason:
          "Current verified MT5 trading-session metadata is unavailable for the missing M15 intervals.",
      };
    }

    for (const gap of gaps) {
      // A non-empty weekly schedule repeats at least once in any full week.
      // Reject longer gaps directly rather than scanning unbounded history.
      if (
        gap.end - gap.start >= 7 * 86_400 ||
        this.hasTradingSessionOverlap(gap.start, gap.end, schedule)
      ) {
        return {
          valid: false,
          missingIntervalCount,
          reason:
            "The MT5 trading-session schedule shows open-market time inside a missing M15 interval.",
        };
      }
    }
    return { valid: true, missingIntervalCount };
  }

  private static hasTradingSessionOverlap(
    utcStart: number,
    utcEnd: number,
    schedule: NonNullable<ReturnType<typeof marketCatalog.getCurrentBrokerTradingSessions>>,
  ): boolean {
    for (
      let utcTime = Math.ceil(utcStart / 900) * 900;
      utcTime < utcEnd;
      utcTime += 900
    ) {
      if (isMt5SessionOpenAtUtc(utcTime, schedule)) return true;
    }
    return false;
  }

  /**
   * Validates an M15 candle series against the 7 mandatory feed guards
   * before it is handed to any strategy engine.
   */
  public static validateM15Series(
    symbol: string,
    provider: string,
    providerSymbol: string,
    rawCandles: Candle[],
    nowSeconds: number = Math.floor(Date.now() / 1000),
    source?: SeriesValidationSource,
  ): SeriesValidationResult {
    // Check 1: Source
    if (
      source?.connected === false ||
      source?.health === "UNAVAILABLE" ||
      source?.health === "REJECTED"
    ) {
      return this.fail(
        symbol,
        1,
        "SOURCE",
        source.availabilityReason ?? `${provider} is not available for ${providerSymbol}.`,
      );
    }

    // Check 2: Instrument Class Equivalence
    const config = FallbackMap.getConfig(symbol);
    const legacyFallbackProvider = ["YAHOO", "BINANCE"].includes(provider.toUpperCase());
    if (config && legacyFallbackProvider) {
      if (provider.toUpperCase() !== "MT5") {
        const matchingFallback = config.fallbacks.find(
          (f) => f.provider.toLowerCase() === provider.toLowerCase(),
        );
        if (!matchingFallback || matchingFallback.fallbackClass !== config.brokerClass) {
          return this.fail(
            symbol,
            2,
            "INSTRUMENT_CLASS",
            `Mismatched fallback instrument class: expected ${config.brokerClass}, provider ${provider} is ${matchingFallback?.fallbackClass || "UNKNOWN"}. Futures for Spot prohibited.`,
          );
        }
      }
    }

    if (!rawCandles || rawCandles.length === 0) {
      return this.fail(symbol, 7, "SUFFICIENCY", "Empty candle series received.");
    }

    // Check 6A: Detect duplicate/out-of-order raw updates before sorting or
    // deduplicating. A provider's documented descending order is normalized at
    // its adapter boundary; this validator only receives canonical order.
    const rawTimes = rawCandles.map((candle) => {
      if (typeof candle.time !== "number" || !Number.isFinite(candle.time)) return undefined;
      const time = Math.floor(candle.time > 10_000_000_000 ? candle.time / 1000 : candle.time);
      return time > 0 ? time : undefined;
    });
    const rawSeen = new Set<number>();
    let previousRawTime: number | undefined;
    for (const rawTime of rawTimes) {
      if (rawTime === undefined) continue;
      if (rawSeen.has(rawTime)) {
        return this.fail(
          symbol,
          6,
          "DUPLICATE_BARS",
          `Duplicate raw candle timestamp ${rawTime} before normalization (provider=${provider}, providerSymbol=${providerSymbol}).`,
        );
      }
      if (previousRawTime !== undefined && rawTime <= previousRawTime) {
        return this.fail(
          symbol,
          6,
          "CONTIGUITY",
          `Raw candle timestamps are not strictly increasing before normalization: ${rawTime} <= ${previousRawTime} (provider=${provider}, providerSymbol=${providerSymbol}).`,
        );
      }
      rawSeen.add(rawTime);
      previousRawTime = rawTime;
    }

    // Sort only after raw ordering has been checked, normalizing to epoch seconds.
    const candleMap = new Map<number, Candle>();
    for (const c of rawCandles) {
      if (typeof c.time === "number" && !isNaN(c.time)) {
        let t = Math.floor(c.time);
        if (t > 10000000000) {
          t = Math.floor(t / 1000);
        }
        candleMap.set(t, { ...c, time: t });
      }
    }
    const dedupedCandles = Array.from(candleMap.values()).sort((a, b) => a.time - b.time);

    // Check 6B: Geometry and strictly increasing timestamps
    for (let i = 0; i < dedupedCandles.length; i++) {
      const bar = dedupedCandles[i];
      if (i > 0 && bar.time <= dedupedCandles[i - 1].time) {
        return this.fail(
          symbol,
          6,
          "CONTIGUITY",
          `Non-strictly increasing timestamp at index ${i}: ${bar.time} <= ${dedupedCandles[i - 1].time}`,
        );
      }

      if (
        typeof bar.open !== "number" ||
        typeof bar.high !== "number" ||
        typeof bar.low !== "number" ||
        typeof bar.close !== "number" ||
        isNaN(bar.open) ||
        isNaN(bar.high) ||
        isNaN(bar.low) ||
        isNaN(bar.close) ||
        bar.open <= 0 ||
        bar.high <= 0 ||
        bar.low <= 0 ||
        bar.close <= 0
      ) {
        return this.fail(symbol, 6, "GEOMETRY", `Invalid bar price values at time ${bar.time}`);
      }

      if (
        bar.high < bar.low ||
        bar.high < bar.open ||
        bar.high < bar.close ||
        bar.low > bar.open ||
        bar.low > bar.close
      ) {
        return this.fail(
          symbol,
          6,
          "GEOMETRY",
          `Violated OHLC bounds at time ${bar.time}: O=${bar.open} H=${bar.high} L=${bar.low} C=${bar.close}`,
        );
      }
    }

    // Check 5: Timezone & 900s Grid Alignment (GMT+3 / UTC epoch modulo 900)
    for (const bar of dedupedCandles) {
      if (bar.time % 900 !== 0) {
        return this.fail(
          symbol,
          5,
          "TIMEZONE_GRID",
          `Bar at timestamp ${bar.time} is misaligned to 15m UTC grid (time % 900 = ${bar.time % 900}; provider=${provider}, providerSymbol=${providerSymbol}, timestampSemantics=UNKNOWN_AT_VALIDATOR_BOUNDARY).`,
        );
      }
    }

    // For MT5, every missing interval must be covered by authoritative broker
    // session closures. Other providers retain their existing intra-session
    // timeframe check because they do not supply this broker schedule.
    if (provider.toUpperCase() === "MT5") {
      const continuity = this.validateMt5M15Continuity(
        symbol,
        providerSymbol,
        dedupedCandles,
        nowSeconds * 1000,
      );
      if (!continuity.valid) {
        return this.fail(
          symbol,
          3,
          "CONTIGUITY",
          continuity.reason ??
            `${continuity.missingIntervalCount} missing M15 intervals are not validated by broker sessions.`,
        );
      }
    } else if (dedupedCandles.length >= 5) {
      const deltas: number[] = [];
      for (let i = 1; i < dedupedCandles.length; i++) {
        const delta = dedupedCandles[i].time - dedupedCandles[i - 1].time;
        // Filter out overnight/weekend session breaks (> 2 hours)
        if (delta > 0 && delta <= 7200) {
          deltas.push(delta);
        }
      }
      if (deltas.length > 0) {
        deltas.sort((a, b) => a - b);
        const medianDelta = deltas[Math.floor(deltas.length / 2)];
        if (medianDelta !== 900) {
          return this.fail(
            symbol,
            3,
            "TIMEFRAME",
            `Series timeframe mismatch: median intra-session interval is ${medianDelta}s, expected 900s for M15`,
          );
        }
      }
    }

    // Check 4: Closed Only — Exclude still-forming current candle
    // An M15 bar opening at T is closed only after T + 900 seconds
    const closedCandles: Candle[] = [];
    for (const bar of dedupedCandles) {
      const barCloseTime = bar.time + 900;
      if (nowSeconds >= barCloseTime) {
        closedCandles.push(bar);
      }
    }

    // Check 7: Sufficiency (>= 50 closed bars for pivot/EMA lookbacks)
    const MIN_REQUIRED_BARS = 50;
    if (closedCandles.length < MIN_REQUIRED_BARS) {
      return this.fail(
        symbol,
        7,
        "SUFFICIENCY",
        `Insufficient closed M15 history: got ${closedCandles.length} closed bars, required >= ${MIN_REQUIRED_BARS}`,
      );
    }

    // Clear any active failure log on success
    this.loggedFailures.delete(symbol);

    return {
      valid: true,
      closedCandles,
    };
  }

  private static fail(
    symbol: string,
    checkFailed: number,
    checkName: string,
    reason: string,
  ): SeriesValidationResult {
    const logKey = `${symbol}_${checkFailed}_${checkName}`;
    const previousReason = this.loggedFailures.get(symbol);

    if (previousReason !== reason) {
      this.loggedFailures.set(symbol, reason);
      logger.warn(
        { symbol, checkFailed, checkName },
        "Rejected market series; keeping prior valid series and marking stale",
      );
    }

    return {
      valid: false,
      checkFailed,
      checkName,
      reason,
    };
  }
}
