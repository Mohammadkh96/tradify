import { Candle } from "../market/types";

export interface StrategyConfig {
  breakoutBufferPct: number;
  minBodyPercent: number;
  minBodyVsAsia: number;
  maxExtensionPct: number;
  waitRetest: boolean;
  atrPeriod: number;
}

export interface AsiaRange {
  high: number;
  low: number;
  range: number;
  startTime: number;
  endTime: number;
  isComplete: boolean;
}

export type StrategyAction =
  | "WAITING_FOR_ASIA_RANGE"
  | "WAITING_FOR_SIGNAL_WINDOW"
  | "NO_QUALIFIED_SETUP"
  | "LIQUIDITY_SWEEP"
  | "WEAK_BREAKOUT"
  | "BREAKOUT_BUY"
  | "BREAKOUT_SELL"
  | "BREAKOUT_TOO_EXTENDED"
  | "WAIT_FOR_RETEST"
  | "RETEST_CONFIRMED"
  | "INVALIDATED"
  | "ACTIVE"
  | "TP1_HIT"
  | "TP2_HIT"
  | "TP3_HIT"
  | "STOPPED"
  | "EXITED";

export class BBBStrategy {
  config: StrategyConfig = {
    breakoutBufferPct: 0.0,
    minBodyPercent: 0.5,
    minBodyVsAsia: 0.1,
    maxExtensionPct: 1.5,
    waitRetest: false,
    atrPeriod: 14,
  };

  /**
   * Convert UTC timestamp to UTC+3 hours
   */
  static getHourUTC3(timestamp: number) {
    const d = new Date(timestamp);
    // getUTCHours + 3
    return (d.getUTCHours() + 3) % 24;
  }

  static getMinuteUTC3(timestamp: number) {
    const d = new Date(timestamp);
    return d.getUTCMinutes();
  }

  static getDecimalHourUTC3(timestamp: number) {
    return this.getHourUTC3(timestamp) + this.getMinuteUTC3(timestamp) / 60;
  }

  /**
   * Calculate Asia Range for the most recent day in the candles array.
   */
  calculateAsiaRange(candles: Candle[]): AsiaRange {
    if (candles.length === 0) {
      return { high: 0, low: 0, range: 0, startTime: 0, endTime: 0, isComplete: false };
    }

    const lastCandleTime = candles[candles.length - 1].time;
    // We only want candles from the "current" trading day.
    // Let's filter candles that are within the last 24 hours of the most recent candle
    const dayCutoff = lastCandleTime - 24 * 60 * 60 * 1000;
    const recentCandles = candles.filter((c) => c.time >= dayCutoff);

    let high = -Infinity;
    let low = Infinity;
    let startTime = 0;
    let endTime = 0;

    // find candles within 03:00 to 09:45 UTC+3
    const asiaCandles = recentCandles.filter((c) => {
      const h = BBBStrategy.getDecimalHourUTC3(c.time);
      return h >= 3.0 && h < 9.75;
    });

    if (asiaCandles.length > 0) {
      startTime = asiaCandles[0].time;
      endTime = asiaCandles[asiaCandles.length - 1].time;
      for (const c of asiaCandles) {
        if (c.high > high) high = c.high;
        if (c.low < low) low = c.low;
      }
    } else {
      return { high: 0, low: 0, range: 0, startTime: 0, endTime: 0, isComplete: false };
    }

    const lastDecimalHour = BBBStrategy.getDecimalHourUTC3(lastCandleTime);

    // We assume it's complete if the latest candle in the array is >= 9:45 UTC+3
    // Also complete if it's the next day (hour < 3.0)
    const isComplete = lastDecimalHour >= 9.75 || lastDecimalHour < 3.0;

    return {
      high,
      low,
      range: high - low,
      startTime,
      endTime,
      isComplete,
    };
  }

  evaluate(candles: Candle[]): { action: StrategyAction; details?: any; trace: string[] } {
    const trace: string[] = [];
    if (candles.length === 0) {
      trace.push("No candles available for evaluation.");
      return { action: "NO_QUALIFIED_SETUP", trace };
    }

    const range = this.calculateAsiaRange(candles);
    trace.push(
      `Asia Range (03:00-09:45 UTC+3): High=${range.high.toFixed(5)}, Low=${range.low.toFixed(5)}, Complete=${range.isComplete}`,
    );

    if (!range.isComplete) {
      trace.push("Asia Range is still forming. Waiting.");
      return { action: "WAITING_FOR_ASIA_RANGE", details: { range }, trace };
    }

    const lastCandle = candles[candles.length - 1];
    const decHour = BBBStrategy.getDecimalHourUTC3(lastCandle.time);
    trace.push(
      `Latest candle time UTC+3: ${BBBStrategy.getHourUTC3(lastCandle.time)}:${BBBStrategy.getMinuteUTC3(lastCandle.time).toString().padStart(2, "0")} (decimal: ${decHour.toFixed(2)}).`,
    );
    trace.push(
      `Candle Data: O=${lastCandle.open} H=${lastCandle.high} L=${lastCandle.low} C=${lastCandle.close}`,
    );

    if (decHour < 11.25 || decHour >= 23.0) {
      trace.push("Current time is outside the Signal Window (11:15-23:00 UTC+3).");
      return { action: "WAITING_FOR_SIGNAL_WINDOW", details: { range }, trace };
    }
    trace.push("Inside Signal Window.");

    // Check for breakout
    const isBullishClose =
      lastCandle.close > range.high + range.range * this.config.breakoutBufferPct;
    const isBearishClose =
      lastCandle.close < range.low - range.range * this.config.breakoutBufferPct;

    const isBullishSweep =
      !isBullishClose && lastCandle.high > range.high && lastCandle.close <= range.high;
    const isBearishSweep =
      !isBearishClose && lastCandle.low < range.low && lastCandle.close >= range.low;

    trace.push(
      `Bullish Close: ${isBullishClose} (Close > ${range.high + range.range * this.config.breakoutBufferPct})`,
    );
    trace.push(
      `Bearish Close: ${isBearishClose} (Close < ${range.low - range.range * this.config.breakoutBufferPct})`,
    );

    if (isBullishSweep || isBearishSweep) {
      trace.push("Candle swept liquidity but closed back inside the range.");
      return { action: "LIQUIDITY_SWEEP", details: { range }, trace };
    }

    if (isBullishClose || isBearishClose) {
      trace.push("Valid breakout detected. Checking candle body strength.");
      const body = Math.abs(lastCandle.close - lastCandle.open);
      const barRange = lastCandle.high - lastCandle.low;

      const bodyPercent = barRange === 0 ? 0 : body / barRange;
      const bodyVsAsia = range.range === 0 ? 0 : body / range.range;

      trace.push(
        `Body % of Candle: ${(bodyPercent * 100).toFixed(1)}% (Min: ${(this.config.minBodyPercent * 100).toFixed(1)}%)`,
      );
      trace.push(
        `Body vs Asia Range: ${(bodyVsAsia * 100).toFixed(1)}% (Min: ${(this.config.minBodyVsAsia * 100).toFixed(1)}%)`,
      );

      if (bodyPercent < this.config.minBodyPercent || bodyVsAsia < this.config.minBodyVsAsia) {
        trace.push("Breakout rejected due to weak body strength (WEAK_BREAKOUT).");
        return { action: "WEAK_BREAKOUT", details: { range, bodyPercent, bodyVsAsia }, trace };
      }

      // Check extension
      const extension = isBullishClose
        ? lastCandle.close - range.high
        : range.low - lastCandle.close;
      const extensionPct = extension / range.range;
      trace.push(
        `Breakout Extension: ${(extensionPct * 100).toFixed(1)}% of Asia Range (Max: ${(this.config.maxExtensionPct * 100).toFixed(1)}%)`,
      );

      if (extension > range.range * this.config.maxExtensionPct) {
        trace.push("Breakout is too extended. Waiting for better entry.");
        return { action: "BREAKOUT_TOO_EXTENDED", details: { range, extension }, trace };
      }

      if (this.config.waitRetest) {
        trace.push("Strategy configured to wait for retest.");
        return { action: "WAIT_FOR_RETEST", details: { range }, trace };
      }

      trace.push(`All criteria met. Issuing ${isBullishClose ? "BUY" : "SELL"} signal.`);
      return {
        action: isBullishClose ? "BREAKOUT_BUY" : "BREAKOUT_SELL",
        details: { range, entry: lastCandle.close, sl: isBullishClose ? range.low : range.high },
        trace,
      };
    }

    trace.push("Candle did not break out of the Asia Range (NO_QUALIFIED_SETUP).");
    return { action: "NO_QUALIFIED_SETUP", details: { range }, trace };
  }
}
