import { Candle } from "../market/types";
import {
  IStrategy,
  StrategySignal,
  DGv8ChartLevels,
  DGv8LevelMap,
  DGv8PivotDebugInfo,
  DGv8PivotProvenance,
  DGv8TimestampBreakdown,
} from "./types";

export class DGv8Engine implements IStrategy {
  private readonly timezone = "GMT+3";
  private readonly pivotLeft = 3;
  private readonly pivotRight = 3;
  private readonly breakoutBuffer = 0.5;
  private readonly correctionTolerance = 3;
  private readonly reversalBuffer = 1;
  private readonly maxReversalBars = 12;

  // Cache of immutable completed session level maps by key: `${symbol}-${tradingDay}-${sourceSession}`
  private completedSnapshots: Map<string, DGv8LevelMap> = new Map();
  private lastValidLevelMapBySymbol: Map<string, DGv8LevelMap> = new Map();

  /**
   * Helper to normalize timestamps (seconds or milliseconds) to milliseconds
   */
  public toMs(timestamp: number): number {
    return timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  }

  /**
   * Helper to format a timestamp into full diagnostic breakdowns (raw, ms, sec, UTC ISO, GMT+3)
   */
  public formatTimestampBreakdown(timestamp: number): DGv8TimestampBreakdown {
    const rawMs = this.toMs(timestamp);
    const unixSeconds = Math.floor(rawMs / 1000);
    const utcISO = new Date(rawMs).toISOString();
    const info = this.getUTC3TimeInfo(rawMs);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const gmt3ISO = `${info.dateStr}T${pad(info.hours)}:${pad(info.minutes)}:00+03:00`;
    return {
      rawTimestamp: timestamp,
      normalizedMs: rawMs,
      unixSeconds,
      utcISO,
      gmt3ISO,
    };
  }

  /**
   * Helper to convert time (ms or s) into minutes since start of day in UTC+3, and trading day string "YYYY-MM-DD"
   */
  public getUTC3TimeInfo(timestamp: number) {
    const rawMs = this.toMs(timestamp);
    const utc3Ms = rawMs + 3 * 3600 * 1000;
    const date = new Date(utc3Ms);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const minuteOfDay = hours * 60 + minutes;
    const dateStr = date.toISOString().slice(0, 10);
    return { minuteOfDay, dateStr, hours, minutes, rawMs };
  }

  /**
   * Calculates 50 EMA on candle close prices
   */
  private calculateEMA50(candles: Candle[]): number[] {
    const period = 50;
    const ema: number[] = new Array(candles.length).fill(0);
    if (candles.length < period) {
      return ema;
    }

    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += candles[i].close;
    }
    ema[period - 1] = sum / period;

    const multiplier = 2 / (period + 1);
    for (let i = period; i < candles.length; i++) {
      ema[i] = (candles[i].close - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
  }

  /**
   * Identify active session and source session for a given candle timestamp in UTC+3
   * ASIA: 03:00 (180m) - 10:00 (600m), deadline 09:00 (540m). Source: previous day NEW_YORK
   * LONDON: 10:00 (600m) - 16:00 (960m), deadline 15:00 (900m). Source: today ASIA
   * NEW_YORK: 16:00 (960m) - 22:00 (1320m), deadline 22:00 (1320m). Source: today LONDON
   */
  private getSessionContext(minuteOfDay: number) {
    if (minuteOfDay >= 180 && minuteOfDay < 600) {
      return {
        activeSession: "ASIA",
        sourceSession: "NEW_YORK",
        sourceSessionIsPrevDay: true,
        tradeDeadlineMinute: 540, // 09:00
      };
    } else if (minuteOfDay >= 600 && minuteOfDay < 960) {
      return {
        activeSession: "LONDON",
        sourceSession: "ASIA",
        sourceSessionIsPrevDay: false,
        tradeDeadlineMinute: 900, // 15:00
      };
    } else if (minuteOfDay >= 960 && minuteOfDay < 1320) {
      return {
        activeSession: "NEW_YORK",
        sourceSession: "LONDON",
        sourceSessionIsPrevDay: false,
        tradeDeadlineMinute: 1320, // 22:00
      };
    }
    return null; // OUTSIDE ACTIVE SESSIONS
  }

  /**
   * Computes all confirmed pivots across the full candle array according to Pine Script rules.
   * ta.pivothigh(high, 3, 3) and ta.pivotlow(low, 3, 3)
   * Pivot bar is at index (i - 3). Confirmation happens at index i.
   * Session membership is determined using the PIVOT BAR's timestamp in UTC+3!
   */
  public computeAllConfirmedPivots(candles: Candle[]): DGv8PivotDebugInfo[] {
    const pivots: DGv8PivotDebugInfo[] = [];
    const left = this.pivotLeft; // 3
    const right = this.pivotRight; // 3

    for (let i = left + right; i < candles.length; i++) {
      const pivotIdx = i - right;
      const pivotCandle = candles[pivotIdx];
      const confirmCandle = candles[i];

      // Pivot High Check
      let isHigh = true;
      for (let l = 1; l <= left; l++) {
        // Pine Script ta.pivothigh picks the FIRST identical high: strict greater on left, greater or equal on right
        if (pivotCandle.high <= candles[pivotIdx - l].high) {
          isHigh = false;
          break;
        }
      }
      if (isHigh) {
        for (let r = 1; r <= right; r++) {
          if (pivotCandle.high < candles[pivotIdx + r].high) {
            isHigh = false;
            break;
          }
        }
      }

      if (isHigh) {
        // Evaluate session on the pivot bar itself
        const info = this.getUTC3TimeInfo(pivotCandle.time);
        const sessionInfo = this.getSessionContext(info.minuteOfDay);
        const sessionName = sessionInfo ? sessionInfo.activeSession : "OUTSIDE";

        pivots.push({
          type: "HIGH",
          price: pivotCandle.high,
          pivotBarIndex: pivotIdx,
          pivotBarTime: pivotCandle.time,
          pivotBarISO: new Date(this.getUTC3TimeInfo(pivotCandle.time).rawMs).toISOString(),
          confirmationIndex: i,
          confirmationTime: confirmCandle.time,
          confirmationISO: new Date(this.getUTC3TimeInfo(confirmCandle.time).rawMs).toISOString(),
          session: sessionName,
          tradingDay: info.dateStr,
          accepted: true,
          reason: `Confirmed at index ${i}`,
        });
      }

      // Pivot Low Check
      let isLow = true;
      for (let l = 1; l <= left; l++) {
        // Pine Script ta.pivotlow picks the FIRST identical low: strict lower on left, lower or equal on right
        if (pivotCandle.low >= candles[pivotIdx - l].low) {
          isLow = false;
          break;
        }
      }
      if (isLow) {
        for (let r = 1; r <= right; r++) {
          if (pivotCandle.low > candles[pivotIdx + r].low) {
            isLow = false;
            break;
          }
        }
      }

      if (isLow) {
        // Evaluate session on the pivot bar itself
        const info = this.getUTC3TimeInfo(pivotCandle.time);
        const sessionInfo = this.getSessionContext(info.minuteOfDay);
        const sessionName = sessionInfo ? sessionInfo.activeSession : "OUTSIDE";

        pivots.push({
          type: "LOW",
          price: pivotCandle.low,
          pivotBarIndex: pivotIdx,
          pivotBarTime: pivotCandle.time,
          pivotBarISO: new Date(this.getUTC3TimeInfo(pivotCandle.time).rawMs).toISOString(),
          confirmationIndex: i,
          confirmationTime: confirmCandle.time,
          confirmationISO: new Date(this.getUTC3TimeInfo(confirmCandle.time).rawMs).toISOString(),
          session: sessionName,
          tradingDay: info.dateStr,
          accepted: true,
          reason: `Confirmed at index ${i}`,
        });
      }
    }

    return pivots;
  }

  /**
   * Filter candles belonging to a specific session name and date in UTC+3.
   */
  private filterSessionCandles(
    candles: Candle[],
    sessionName: string,
    targetDateStr: string,
  ): Candle[] {
    const isTargetSession = (info: ReturnType<typeof this.getUTC3TimeInfo>) => {
      if (sessionName === "ASIA") {
        return info.minuteOfDay >= 180 && info.minuteOfDay < 600;
      } else if (sessionName === "LONDON") {
        return info.minuteOfDay >= 600 && info.minuteOfDay < 960;
      } else if (sessionName === "NEW_YORK" || sessionName === "NEW YORK") {
        return info.minuteOfDay >= 960 && info.minuteOfDay < 1320;
      }
      return false;
    };

    let matched = candles.filter((c) => {
      const info = this.getUTC3TimeInfo(c.time);
      return info.dateStr === targetDateStr && isTargetSession(info);
    });

    if (matched.length === 0 && candles.length > 0) {
      const allSessionCandles = candles.filter((c) =>
        isTargetSession(this.getUTC3TimeInfo(c.time)),
      );
      if (allSessionCandles.length > 0) {
        const lastCandleDate = this.getUTC3TimeInfo(
          allSessionCandles[allSessionCandles.length - 1].time,
        ).dateStr;
        matched = allSessionCandles.filter(
          (c) => this.getUTC3TimeInfo(c.time).dateStr === lastCandleDate,
        );
      }
    }

    return matched;
  }

  /**
   * Generates or retrieves the immutable Level Map for a completed source session.
   */
  public generateLevelMap(
    symbol: string,
    activeSessionName: string,
    sourceSessionName: string,
    sourceDateStr: string,
    candles: Candle[],
    evaluationTime: number,
    latestEMA: number | null,
  ): DGv8LevelMap | null {
    const cacheKey = `${symbol}-${sourceDateStr}-${sourceSessionName}`;
    if (this.completedSnapshots.has(cacheKey)) {
      return this.completedSnapshots.get(cacheKey)!;
    }

    const sourceCandles = this.filterSessionCandles(candles, sourceSessionName, sourceDateStr);
    if (sourceCandles.length === 0) {
      return null;
    }

    // Candle wicks and bodies
    let sourceWickHigh = -Infinity;
    let sourceWickLow = Infinity;
    let sourceBodyHigh = -Infinity;
    let sourceBodyLow = Infinity;

    for (const c of sourceCandles) {
      if (c.high > sourceWickHigh) sourceWickHigh = c.high;
      if (c.low < sourceWickLow) sourceWickLow = c.low;
      const bMax = Math.max(c.open, c.close);
      const bMin = Math.min(c.open, c.close);
      if (bMax > sourceBodyHigh) sourceBodyHigh = bMax;
      if (bMin < sourceBodyLow) sourceBodyLow = bMin;
    }

    const sourceStartTimeMs = sourceCandles[0] ? this.toMs(sourceCandles[0].time) : 0;
    const sourceEndTimeMs = sourceCandles[sourceCandles.length - 1]
      ? this.toMs(sourceCandles[sourceCandles.length - 1].time)
      : 0;
    const evalTimeMs = this.toMs(evaluationTime);

    // Compute all pivots confirmed up to evaluationTime
    const allPivots = this.computeAllConfirmedPivots(candles);

    // Always match pivots directly by the exact source candle time window to avoid timezone/day boundary string misses
    let validPivots: DGv8PivotDebugInfo[] = [];
    if (sourceStartTimeMs > 0 && sourceEndTimeMs > 0) {
      validPivots = allPivots.filter((p) => {
        const pTime = this.toMs(p.pivotBarTime);
        const cTime = this.toMs(p.confirmationTime);
        return pTime >= sourceStartTimeMs && pTime <= sourceEndTimeMs && cTime <= evalTimeMs;
      });
    }

    const candidatePivotHighs = validPivots.filter((p) => p.type === "HIGH");
    const candidatePivotLows = validPivots.filter((p) => p.type === "LOW");

    // Sort candidate pivots chronologically by confirmation time / index (and pivot bar time as secondary)
    const sortedPivotHighs = [...candidatePivotHighs].sort((a, b) => {
      const diffConfirm = this.toMs(a.confirmationTime) - this.toMs(b.confirmationTime);
      if (diffConfirm !== 0) return diffConfirm;
      const diffIndex = a.confirmationIndex - b.confirmationIndex;
      if (diffIndex !== 0) return diffIndex;
      return this.toMs(a.pivotBarTime) - this.toMs(b.pivotBarTime);
    });

    const sortedPivotLows = [...candidatePivotLows].sort((a, b) => {
      const diffConfirm = this.toMs(a.confirmationTime) - this.toMs(b.confirmationTime);
      if (diffConfirm !== 0) return diffConfirm;
      const diffIndex = a.confirmationIndex - b.confirmationIndex;
      if (diffIndex !== 0) return diffIndex;
      return this.toMs(a.pivotBarTime) - this.toMs(b.pivotBarTime);
    });

    // Gate Assignment: Select latest valid confirmed pivot belonging to source session
    const latestPivotHigh =
      sortedPivotHighs.length > 0 ? sortedPivotHighs[sortedPivotHighs.length - 1] : null;
    const latestPivotLow =
      sortedPivotLows.length > 0 ? sortedPivotLows[sortedPivotLows.length - 1] : null;

    const sourcePivotResistance = latestPivotHigh ? latestPivotHigh.price : null;
    const sourcePivotSupport = latestPivotLow ? latestPivotLow.price : null;

    // Symmetric Fallback to wick if no confirmed pivot exists
    let buyGate: number | null = sourcePivotResistance;
    let fallbackResistance = false;
    let selectedBuySource: "PIVOT_RESISTANCE" | "WICK_HIGH" = "PIVOT_RESISTANCE";
    let buyPivotProvenance: DGv8PivotProvenance;

    if (latestPivotHigh) {
      const pBreakdown = this.formatTimestampBreakdown(latestPivotHigh.pivotBarTime);
      const cBreakdown = this.formatTimestampBreakdown(latestPivotHigh.confirmationTime);
      buyPivotProvenance = {
        price: latestPivotHigh.price,
        pivotBarIndex: latestPivotHigh.pivotBarIndex,
        pivotBarTime: latestPivotHigh.pivotBarTime,
        pivotBarISO: pBreakdown.utcISO,
        pivotBarGMT3: pBreakdown.gmt3ISO,
        pivotBarTimestampBreakdown: pBreakdown,
        confirmationIndex: latestPivotHigh.confirmationIndex,
        indexDelta:
          latestPivotHigh.confirmationIndex !== null && latestPivotHigh.pivotBarIndex !== null
            ? latestPivotHigh.confirmationIndex - latestPivotHigh.pivotBarIndex
            : null,
        confirmationTime: latestPivotHigh.confirmationTime,
        confirmationISO: cBreakdown.utcISO,
        confirmationGMT3: cBreakdown.gmt3ISO,
        confirmationTimestampBreakdown: cBreakdown,
        sourceSession: latestPivotHigh.session,
        sourceTradingDay: latestPivotHigh.tradingDay,
        selectionMode: "LATEST_CONFIRMED_PIVOT",
      };
    } else {
      buyGate = sourceWickHigh !== -Infinity ? sourceWickHigh : null;
      fallbackResistance = true;
      selectedBuySource = "WICK_HIGH";
      buyPivotProvenance = {
        price: sourceWickHigh !== -Infinity ? sourceWickHigh : null,
        pivotBarIndex: null,
        pivotBarTime: null,
        pivotBarISO: null,
        pivotBarGMT3: null,
        pivotBarTimestampBreakdown: null,
        confirmationIndex: null,
        indexDelta: null,
        confirmationTime: null,
        confirmationISO: null,
        confirmationGMT3: null,
        confirmationTimestampBreakdown: null,
        sourceSession: sourceSessionName,
        sourceTradingDay: sourceDateStr,
        selectionMode: "WICK_FALLBACK",
      };
    }

    let sellGate: number | null = sourcePivotSupport;
    let fallbackSupport = false;
    let selectedSellSource: "PIVOT_SUPPORT" | "WICK_LOW" = "PIVOT_SUPPORT";
    let sellPivotProvenance: DGv8PivotProvenance;

    if (latestPivotLow) {
      const pBreakdown = this.formatTimestampBreakdown(latestPivotLow.pivotBarTime);
      const cBreakdown = this.formatTimestampBreakdown(latestPivotLow.confirmationTime);
      sellPivotProvenance = {
        price: latestPivotLow.price,
        pivotBarIndex: latestPivotLow.pivotBarIndex,
        pivotBarTime: latestPivotLow.pivotBarTime,
        pivotBarISO: pBreakdown.utcISO,
        pivotBarGMT3: pBreakdown.gmt3ISO,
        pivotBarTimestampBreakdown: pBreakdown,
        confirmationIndex: latestPivotLow.confirmationIndex,
        indexDelta:
          latestPivotLow.confirmationIndex !== null && latestPivotLow.pivotBarIndex !== null
            ? latestPivotLow.confirmationIndex - latestPivotLow.pivotBarIndex
            : null,
        confirmationTime: latestPivotLow.confirmationTime,
        confirmationISO: cBreakdown.utcISO,
        confirmationGMT3: cBreakdown.gmt3ISO,
        confirmationTimestampBreakdown: cBreakdown,
        sourceSession: latestPivotLow.session,
        sourceTradingDay: latestPivotLow.tradingDay,
        selectionMode: "LATEST_CONFIRMED_PIVOT",
      };
    } else {
      sellGate = sourceWickLow !== Infinity ? sourceWickLow : null;
      fallbackSupport = true;
      selectedSellSource = "WICK_LOW";
      sellPivotProvenance = {
        price: sourceWickLow !== Infinity ? sourceWickLow : null,
        pivotBarIndex: null,
        pivotBarTime: null,
        pivotBarISO: null,
        pivotBarGMT3: null,
        pivotBarTimestampBreakdown: null,
        confirmationIndex: null,
        indexDelta: null,
        confirmationTime: null,
        confirmationISO: null,
        confirmationGMT3: null,
        confirmationTimestampBreakdown: null,
        sourceSession: sourceSessionName,
        sourceTradingDay: sourceDateStr,
        selectionMode: "WICK_FALLBACK",
      };
    }

    if (buyGate === null || sellGate === null) {
      return null;
    }

    // Range Semantics (Requirement 9)
    const sourceSessionRange = Number((sourceWickHigh - sourceWickLow).toFixed(2));
    const gateSeparation = Number((buyGate - sellGate).toFixed(2));

    const rangeFilterBasis: "PIVOT" | "WICK" =
      sourcePivotResistance !== null && sourcePivotSupport !== null ? "PIVOT" : "WICK";
    const rangeFilterValue =
      rangeFilterBasis === "PIVOT"
        ? Number((sourcePivotResistance! - sourcePivotSupport!).toFixed(2))
        : gateSeparation;

    const rangePass = rangeFilterValue >= 10 && rangeFilterValue <= 80;

    const latestCandle = candles[candles.length - 1];
    const spotPrice = latestCandle ? latestCandle.close : 0;
    const distBuy = spotPrice > 0 ? Number((buyGate - spotPrice).toFixed(2)) : null;
    const distSell = spotPrice > 0 ? Number((spotPrice - sellGate).toFixed(2)) : null;

    const buyTargets: [number, number, number, number, number] = [
      Number((buyGate + 12).toFixed(2)),
      Number((buyGate + 20).toFixed(2)),
      Number((buyGate + 27).toFixed(2)),
      Number((buyGate + 35).toFixed(2)),
      Number((buyGate + 42).toFixed(2)),
    ];

    const sellTargets: [number, number, number, number, number] = [
      Number((sellGate - 12).toFixed(2)),
      Number((sellGate - 20).toFixed(2)),
      Number((sellGate - 27).toFixed(2)),
      Number((sellGate - 35).toFixed(2)),
      Number((sellGate - 42).toFixed(2)),
    ];

    const levelMap: DGv8LevelMap = {
      symbol,
      activeSession: activeSessionName,
      sourceSession: sourceSessionName,
      sourceCompleted: true,
      source: {
        wickHigh: sourceWickHigh !== -Infinity ? Number(sourceWickHigh.toFixed(2)) : null,
        wickLow: sourceWickLow !== Infinity ? Number(sourceWickLow.toFixed(2)) : null,
        bodyHigh: sourceBodyHigh !== -Infinity ? Number(sourceBodyHigh.toFixed(2)) : null,
        bodyLow: sourceBodyLow !== Infinity ? Number(sourceBodyLow.toFixed(2)) : null,
        pivotResistance:
          sourcePivotResistance !== null ? Number(sourcePivotResistance.toFixed(2)) : null,
        pivotSupport: sourcePivotSupport !== null ? Number(sourcePivotSupport.toFixed(2)) : null,
        fallbackResistance,
        fallbackSupport,
        candleCount: sourceCandles.length,
        selectedBuySource,
        selectedSellSource,
        rangeFilterBasis,
        buyPivotProvenance,
        sellPivotProvenance,
      },
      buy: {
        gate: Number(buyGate.toFixed(2)),
        sl: Number((buyGate - 12).toFixed(2)),
        targets: buyTargets,
      },
      sell: {
        gate: Number(sellGate.toFixed(2)),
        sl: Number((sellGate + 12).toFixed(2)),
        targets: sellTargets,
      },
      buyPivotProvenance,
      sellPivotProvenance,
      ema50: latestEMA ? Number(latestEMA.toFixed(2)) : null,
      range: rangeFilterValue,
      sourceSessionRange,
      gateSeparation,
      rangeFilterValue,
      rangePass,
      sessionHasGates: true,
      updatedAt: Date.now(),
      distanceToBuyGate: distBuy,
      distanceToSellGate: distSell,
      pivotsDebug: allPivots,
      isStale: false,
      freshnessState: "LIVE",
    };

    // If source session has completed and its pivot confirmation window has elapsed, cache immutable snapshot
    const evalInfo = this.getUTC3TimeInfo(evaluationTime);
    const activeStartMinute =
      activeSessionName === "ASIA" ? 180 : activeSessionName === "LONDON" ? 600 : 960;
    const confirmationWindowMinutes = (this.pivotRight + 1) * 15; // 60 minutes for pivotRight = 3
    if (evalInfo.minuteOfDay >= activeStartMinute + confirmationWindowMinutes) {
      this.completedSnapshots.set(cacheKey, levelMap);
    }

    return levelMap;
  }

  getConfig() {
    return {
      timezone: this.timezone,
      gateSource: "sr_pivot",
      normalization: "none",
      digitalStep: null,
      hybridWeight: null,
      pivotTF: "M15",
      pivotLeft: this.pivotLeft,
      pivotRight: this.pivotRight,
      fallbackWick: true,
      emaFilter: true,
      emaLength: 50,
      impulseFilter: false,
      impulsePercent: null,
      rangeFilter: true,
      rangeMin: 10,
      rangeMax: 80,
      dailyBias: false,
      touchTolerance: 2,
      breakBuffer: this.breakoutBuffer,
      correctionTolerance: this.correctionTolerance,
      reversalBuffer: this.reversalBuffer,
      reversalMaxBars: this.maxReversalBars,
      requireReclaim: true,
      asiaStart: "03:00",
      asiaEnd: "10:00",
      asiaDeadline: "09:00",
      londonStart: "10:00",
      londonEnd: "16:00",
      londonDeadline: "15:00",
      nyStart: "16:00",
      nyEnd: "22:00",
      nyDeadline: "22:00",
      slMode: "FIXED_POINTS",
      slPoints: 12,
    };
  }

  diagnostic(
    symbol: string,
    providerSymbol: string,
    provider: string,
    candles: Candle[],
    marketDataTrusted: boolean = true,
  ) {
    const result = this.evaluate(symbol, providerSymbol, provider, candles, marketDataTrusted);
    const facts = result.strategyFacts || {};
    const levelMap = result.dgv8LevelMap || result.dgv8ChartLevels?.levelMap;

    return {
      symbol,
      brokerSymbol: providerSymbol,
      runtimeConfig: this.getConfig(),
      m15CandleCount: candles.length,
      currentUTC3Time: this.getUTC3TimeInfo(Date.now()).dateStr,
      activeSession: facts.activeSession || "NONE",
      sourceSession: facts.sourceSession || "NONE",
      sourceCandleCount: facts.sourceCandleCount || 0,
      sourceWickHigh: facts.sourceWickHigh ?? null,
      sourceWickLow: facts.sourceWickLow ?? null,
      sourceBodyHigh: facts.sourceBodyHigh ?? null,
      sourceBodyLow: facts.sourceBodyLow ?? null,
      sourcePivotResistance: facts.sourcePivotResistance ?? null,
      sourcePivotSupport: facts.sourcePivotSupport ?? null,
      selectedBuySource:
        facts.selectedBuySource ?? (facts.sourcePivotResistance ? "PIVOT_RESISTANCE" : "WICK_HIGH"),
      selectedSellSource:
        facts.selectedSellSource ?? (facts.sourcePivotSupport ? "PIVOT_SUPPORT" : "WICK_LOW"),
      buyPivotProvenance: levelMap?.buyPivotProvenance || null,
      sellPivotProvenance: levelMap?.sellPivotProvenance || null,
      rangeFilterBasis: facts.rangeFilterBasis ?? (facts.sourcePivotResistance ? "PIVOT" : "WICK"),
      displaySourceRange: facts.sourceSessionRange ?? 0,
      gateSeparation: facts.gateSeparation ?? 0,
      rangeValue: facts.rangeFilterValue ?? facts.sessionRange ?? 0,
      rangeFilterPass: facts.rangePass ?? false,
      buyGate: facts.buyGate ?? null,
      sellGate: facts.sellGate ?? null,
      levelsTooClose: (facts.rangeFilterValue ?? 0) < 10,
      EMA50: facts.EMA50 ?? null,
      previousClose: facts.previousClose ?? null,
      rawBreakUp: facts.rawBreakUp ?? false,
      rawBreakDown: facts.rawBreakDown ?? false,
      longFilterPass: facts.longFilterPass ?? false,
      shortFilterPass: facts.shortFilterPass ?? false,
      breakoutBuy: facts.breakoutBuy ?? false,
      breakoutSell: facts.breakoutSell ?? false,
      marketState: facts.marketState ?? "NEUTRAL",
      activeBreakLevel: facts.breakoutLevel ?? null,
      barsSinceBreak: facts.barsSinceBreak ?? 0,
      finalAction: result.action,
      reasons: result.reasons,
      dgv8LevelMap: levelMap,
      pivotsDebug: levelMap?.pivotsDebug || [],
      freshnessState: levelMap?.freshnessState || (marketDataTrusted ? "LIVE" : "STALE"),
      isStale: levelMap?.isStale || false,
    };
  }

  evaluate(
    symbol: string,
    providerSymbol: string,
    provider: string,
    candles: Candle[],
    marketDataTrusted: boolean = true,
  ): StrategySignal {
    const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    const latestConfirmedTime = latestCandle ? this.toMs(latestCandle.time) : Date.now();
    const timeInfo = this.getUTC3TimeInfo(latestConfirmedTime);
    const sessionCtx = this.getSessionContext(timeInfo.minuteOfDay);

    const activeSessionName = sessionCtx ? sessionCtx.activeSession : "NONE";
    const sourceSessionName = sessionCtx ? sessionCtx.sourceSession : "NEW_YORK";

    const baseFacts: Record<string, any> = {
      gateSource: "sr_pivot",
      normalization: "none",
      pivotTF: "M15",
      pivotLeft: this.pivotLeft,
      pivotRight: this.pivotRight,
      breakoutBuffer: this.breakoutBuffer,
      correctionTolerance: this.correctionTolerance,
      reversalBuffer: this.reversalBuffer,
      marketDataTrusted,
      activeSession: activeSessionName,
      sourceSession: sourceSessionName,
    };

    if (!marketDataTrusted) {
      return {
        id: `DGV8-${symbol}-${timeInfo.dateStr}-UNTRUSTED`,
        strategy: "DGV8",
        strategyVersion: "8.0.0",
        symbol,
        tradingDay: timeInfo.dateStr,
        timeframe: "M15",
        direction: "NONE",
        action: "DATA_UNTRUSTED",
        lifecycleStatus: "DATA_UNTRUSTED",
        detectedAt: latestConfirmedTime,
        activeSession: activeSessionName,
        sourceSession: sourceSessionName,
        targets: [],
        marketDataSnapshot: {
          provider,
          providerSymbol,
          latestConfirmedCandleTime: latestConfirmedTime,
        },
        strategyFacts: { ...baseFacts, marketState: "NEUTRAL", marketDataTrusted: false },
        reasons: [
          "Market data provider is marked as untrusted or stale. Trade generation suspended.",
        ],
      };
    }

    const lastCachedLevelMap = this.lastValidLevelMapBySymbol.get(symbol) || null;

    if (!candles || candles.length === 0) {
      const fallbackLevelMap = lastCachedLevelMap
        ? { ...lastCachedLevelMap, isStale: true, freshnessState: "STALE" as const }
        : undefined;
      return {
        id: `DGV8-${symbol}-${timeInfo.dateStr}-NO-CANDLES`,
        strategy: "DGV8",
        strategyVersion: "8.0.0",
        symbol,
        tradingDay: timeInfo.dateStr,
        timeframe: "M15",
        direction: "NONE",
        action: "MT5 DATA SYNCING",
        lifecycleStatus: "WAITING",
        detectedAt: latestConfirmedTime,
        activeSession: "NONE",
        targets: [],
        marketDataSnapshot: {
          provider,
          providerSymbol,
          latestConfirmedCandleTime: latestConfirmedTime,
        },
        dgv8ChartLevels: fallbackLevelMap
          ? {
              activeSession: "NONE",
              sourceSession: fallbackLevelMap.sourceSession as any,
              buyGate: fallbackLevelMap.buy.gate,
              sellGate: fallbackLevelMap.sell.gate,
              buyTargets: fallbackLevelMap.buy.targets,
              sellTargets: fallbackLevelMap.sell.targets,
              buyStop: fallbackLevelMap.buy.sl,
              sellStop: fallbackLevelMap.sell.sl,
              sourceHigh: fallbackLevelMap.source.wickHigh,
              sourceLow: fallbackLevelMap.source.wickLow,
              pivotResistance: fallbackLevelMap.source.pivotResistance,
              pivotSupport: fallbackLevelMap.source.pivotSupport,
              activeBreakLevel: null,
              marketState: "NEUTRAL",
              currentAction: "MT5 DATA SYNCING",
              levelMap: fallbackLevelMap,
            }
          : undefined,
        dgv8LevelMap: fallbackLevelMap,
        strategyFacts: { ...baseFacts, marketState: "NEUTRAL", barsSinceBreak: 0 },
        reasons: ["No candle data available from MT5 bridge. MT5 DATA SYNCING."],
      };
    }

    // Determine target source session date string
    let sourceDateStr = timeInfo.dateStr;
    if (sessionCtx && sessionCtx.sourceSessionIsPrevDay) {
      const prevDate = new Date(timeInfo.rawMs - 24 * 3600 * 1000);
      sourceDateStr = prevDate.toISOString().slice(0, 10);
    }

    // Calculate EMA50
    const ema50Series = this.calculateEMA50(candles);
    const latestEMA = ema50Series.length > 0 ? ema50Series[ema50Series.length - 1] : null;

    // Generate Level Map
    const currentLevelMap = this.generateLevelMap(
      symbol,
      activeSessionName,
      sourceSessionName,
      sourceDateStr,
      candles,
      latestConfirmedTime,
      latestEMA,
    );

    if (currentLevelMap) {
      this.lastValidLevelMapBySymbol.set(symbol, currentLevelMap);
    }

    const effectiveLevelMap =
      currentLevelMap ||
      (lastCachedLevelMap
        ? { ...lastCachedLevelMap, isStale: true, freshnessState: "STALE" as const }
        : null);

    if (effectiveLevelMap) {
      baseFacts.sourceCandleCount = effectiveLevelMap.source.candleCount || 0;
      baseFacts.sourceWickHigh = effectiveLevelMap.source.wickHigh;
      baseFacts.sourceWickLow = effectiveLevelMap.source.wickLow;
      baseFacts.sourceBodyHigh = effectiveLevelMap.source.bodyHigh;
      baseFacts.sourceBodyLow = effectiveLevelMap.source.bodyLow;
      baseFacts.sourcePivotResistance = effectiveLevelMap.source.pivotResistance;
      baseFacts.sourcePivotSupport = effectiveLevelMap.source.pivotSupport;
      baseFacts.selectedBuySource = effectiveLevelMap.source.selectedBuySource;
      baseFacts.selectedSellSource = effectiveLevelMap.source.selectedSellSource;
      baseFacts.buyPivotProvenance = effectiveLevelMap.buyPivotProvenance;
      baseFacts.sellPivotProvenance = effectiveLevelMap.sellPivotProvenance;
      baseFacts.rangeFilterBasis = effectiveLevelMap.source.rangeFilterBasis;
      baseFacts.sourceSessionRange = effectiveLevelMap.sourceSessionRange;
      baseFacts.gateSeparation = effectiveLevelMap.gateSeparation;
      baseFacts.rangeFilterValue = effectiveLevelMap.rangeFilterValue;
      baseFacts.sessionRange = effectiveLevelMap.range;
      baseFacts.rangePass = effectiveLevelMap.rangePass;
      baseFacts.buyGate = effectiveLevelMap.buy.gate;
      baseFacts.sellGate = effectiveLevelMap.sell.gate;
    }

    // Handle missing source history
    if (!effectiveLevelMap) {
      const chartLevels: DGv8ChartLevels = {
        activeSession: activeSessionName as any,
        sourceSession: sourceSessionName as any,
        buyGate: null,
        sellGate: null,
        buyTargets: [0, 0, 0, 0, 0],
        sellTargets: [0, 0, 0, 0, 0],
        buyStop: null,
        sellStop: null,
        sourceHigh: null,
        sourceLow: null,
        pivotResistance: null,
        pivotSupport: null,
        activeBreakLevel: null,
        marketState: "NEUTRAL",
        currentAction: "SOURCE HISTORY MISSING",
      };

      return {
        id: `DGV8-${symbol}-${timeInfo.dateStr}-${activeSessionName}-SOURCE-MISSING`,
        strategy: "DGV8",
        strategyVersion: "8.0.0",
        symbol,
        tradingDay: timeInfo.dateStr,
        timeframe: "M15",
        direction: "NONE",
        action: "SOURCE HISTORY MISSING",
        lifecycleStatus: "WAITING",
        detectedAt: latestConfirmedTime,
        activeSession: activeSessionName,
        sourceSession: sourceSessionName,
        targets: [],
        marketDataSnapshot: {
          provider,
          providerSymbol,
          latestConfirmedCandleTime: latestConfirmedTime,
        },
        dgv8ChartLevels: chartLevels,
        strategyFacts: {
          ...baseFacts,
          marketState: "NEUTRAL",
          sourceCandleCount: 0,
          sessionHasGates: false,
        },
        reasons: [
          `SOURCE HISTORY MISSING: Source session (${sourceSessionName}) candles not found in history buffer.`,
          `Active Session: ${activeSessionName}, Source Session: ${sourceSessionName}, Source Date: ${sourceDateStr}.`,
        ],
      };
    }

    const buyGate = effectiveLevelMap.buy.gate!;
    const sellGate = effectiveLevelMap.sell.gate!;

    let marketState: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    let breakoutLevel: number | null = null;
    let barsSinceBreak = 0;
    let currentSignalAction = "WAITING FOR GATE INTERACTION";
    let currentDirection: "LONG" | "SHORT" | "NONE" = "NONE";
    let lifecycleStatus: any = "WAITING";
    let signalDetectedAt = latestConfirmedTime;
    const reasons: string[] = [];

    if (!sessionCtx) {
      currentSignalAction = "WAITING FOR SESSION OPEN";
      reasons.push(
        `Outside active trading session hours (Asia 03:00-10:00, London 10:00-16:00, NY 16:00-22:00 GMT+3). Gate map active.`,
      );
    }

    reasons.push(
      `BUY GATE: ${buyGate} (${effectiveLevelMap.source.selectedBuySource}) | SELL GATE: ${sellGate} (${effectiveLevelMap.source.selectedSellSource})`,
    );
    reasons.push(
      `Range Basis: ${effectiveLevelMap.source.rangeFilterBasis} | Range Value: ${effectiveLevelMap.rangeFilterValue} pts | Source Session Range: ${effectiveLevelMap.sourceSessionRange} pts`,
    );

    // Evaluate candle sequence in active session ONLY AFTER gates & snapshot are verified
    if (sessionCtx && buyGate > 0 && sellGate > 0) {
      const activeCandles = candles.filter((c) => {
        const info = this.getUTC3TimeInfo(c.time);
        return (
          info.dateStr === timeInfo.dateStr &&
          info.minuteOfDay >=
            (sessionCtx.activeSession === "ASIA"
              ? 180
              : sessionCtx.activeSession === "LONDON"
                ? 600
                : 960)
        );
      });

      for (let i = 0; i < activeCandles.length; i++) {
        const c = activeCandles[i];
        const info = this.getUTC3TimeInfo(c.time);

        // Check trading window deadline
        if (info.minuteOfDay >= sessionCtx.tradeDeadlineMinute) continue;

        const ema50 = ema50Series[candles.indexOf(c)] || 0;

        // BULLISH BREAKOUT
        if (c.close > buyGate + this.breakoutBuffer) {
          if (c.close > ema50) {
            marketState = "BULLISH";
            breakoutLevel = buyGate;
            barsSinceBreak = activeCandles.length - 1 - i;
            currentSignalAction = "BREAKOUT BUY";
            currentDirection = "LONG";
            signalDetectedAt = c.time;
            lifecycleStatus = "DETECTED";
            reasons.push(
              `[${new Date(info.rawMs).toISOString()}] M15 candle close (${c.close}) broke Buy Gate (${buyGate}) + EMA50 confirmation (${ema50.toFixed(2)}).`,
            );
          }
        }
        // BEARISH BREAKOUT
        else if (c.close < sellGate - this.breakoutBuffer) {
          if (c.close < ema50) {
            marketState = "BEARISH";
            breakoutLevel = sellGate;
            barsSinceBreak = activeCandles.length - 1 - i;
            currentSignalAction = "BREAKOUT SELL";
            currentDirection = "SHORT";
            signalDetectedAt = c.time;
            lifecycleStatus = "DETECTED";
            reasons.push(
              `[${new Date(info.rawMs).toISOString()}] M15 candle close (${c.close}) broke Sell Gate (${sellGate}) + EMA50 confirmation (${ema50.toFixed(2)}).`,
            );
          }
        }
        // REBOUND / CORRECTION
        else if (c.low <= sellGate + 2 && c.close > sellGate + this.breakoutBuffer) {
          currentSignalAction = "REBOUND BUY";
          currentDirection = "LONG";
          signalDetectedAt = c.time;
          lifecycleStatus = "PENDING";
          reasons.push(
            `[${new Date(info.rawMs).toISOString()}] Price touched Sell Gate support (${sellGate}) and rebounded to close at ${c.close}.`,
          );
        } else if (c.high >= buyGate - 2 && c.close < buyGate - this.breakoutBuffer) {
          currentSignalAction = "REBOUND SELL";
          currentDirection = "SHORT";
          signalDetectedAt = c.time;
          lifecycleStatus = "PENDING";
          reasons.push(
            `[${new Date(info.rawMs).toISOString()}] Price touched Buy Gate resistance (${buyGate}) and rejected to close at ${c.close}.`,
          );
        }
      }
    }

    baseFacts.marketState = marketState;
    baseFacts.breakoutLevel = breakoutLevel;
    baseFacts.barsSinceBreak = barsSinceBreak;

    const dgv8ChartLevels: DGv8ChartLevels = {
      activeSession: activeSessionName as any,
      sourceSession: sourceSessionName as any,
      buyGate: effectiveLevelMap.buy.gate,
      sellGate: effectiveLevelMap.sell.gate,
      buyTargets: effectiveLevelMap.buy.targets,
      sellTargets: effectiveLevelMap.sell.targets,
      buyStop: effectiveLevelMap.buy.sl,
      sellStop: effectiveLevelMap.sell.sl,
      sourceHigh: effectiveLevelMap.source.wickHigh,
      sourceLow: effectiveLevelMap.source.wickLow,
      pivotResistance: effectiveLevelMap.source.pivotResistance,
      pivotSupport: effectiveLevelMap.source.pivotSupport,
      activeBreakLevel: breakoutLevel,
      marketState,
      currentAction: currentSignalAction,
      levelMap: effectiveLevelMap,
    };

    baseFacts.dgv8ChartLevels = dgv8ChartLevels;

    // Generate targets & stop loss (Requirement 16)
    let stopLoss: number | undefined;
    const targets: Array<{ label: string; price: number }> = [];

    if (currentDirection === "LONG" || currentSignalAction.includes("BUY")) {
      stopLoss = effectiveLevelMap.buy.sl!;
      targets.push(
        { label: "TP1 (12pt)", price: effectiveLevelMap.buy.targets[0] },
        { label: "TP2 (20pt)", price: effectiveLevelMap.buy.targets[1] },
        { label: "TP3 (27pt)", price: effectiveLevelMap.buy.targets[2] },
        { label: "TP4 (35pt)", price: effectiveLevelMap.buy.targets[3] },
        { label: "TP5 (42pt)", price: effectiveLevelMap.buy.targets[4] },
      );
    } else if (currentDirection === "SHORT" || currentSignalAction.includes("SELL")) {
      stopLoss = effectiveLevelMap.sell.sl!;
      targets.push(
        { label: "TP1 (12pt)", price: effectiveLevelMap.sell.targets[0] },
        { label: "TP2 (20pt)", price: effectiveLevelMap.sell.targets[1] },
        { label: "TP3 (27pt)", price: effectiveLevelMap.sell.targets[2] },
        { label: "TP4 (35pt)", price: effectiveLevelMap.sell.targets[3] },
        { label: "TP5 (42pt)", price: effectiveLevelMap.sell.targets[4] },
      );
    } else {
      targets.push(
        { label: "BUY TP1", price: effectiveLevelMap.buy.targets[0] },
        { label: "BUY TP2", price: effectiveLevelMap.buy.targets[1] },
        { label: "BUY TP3", price: effectiveLevelMap.buy.targets[2] },
        { label: "BUY TP4", price: effectiveLevelMap.buy.targets[3] },
        { label: "BUY TP5", price: effectiveLevelMap.buy.targets[4] },
        { label: "SELL TP1", price: effectiveLevelMap.sell.targets[0] },
        { label: "SELL TP2", price: effectiveLevelMap.sell.targets[1] },
        { label: "SELL TP3", price: effectiveLevelMap.sell.targets[2] },
        { label: "SELL TP4", price: effectiveLevelMap.sell.targets[3] },
        { label: "SELL TP5", price: effectiveLevelMap.sell.targets[4] },
      );
    }

    const actionTag = currentSignalAction.replace(/\s+/g, "-");
    const signalId = `DGV8-${symbol}-${timeInfo.dateStr}-${activeSessionName}-${actionTag}-${signalDetectedAt}`;

    return {
      id: signalId,
      strategy: "DGV8",
      strategyVersion: "8.0.0",
      symbol,
      tradingDay: timeInfo.dateStr,
      timeframe: "M15",
      direction: currentDirection,
      action: currentSignalAction,
      lifecycleStatus,
      detectedAt: signalDetectedAt,
      sourceSession: sourceSessionName,
      activeSession: activeSessionName,
      entry:
        currentDirection === "LONG" ? buyGate : currentDirection === "SHORT" ? sellGate : undefined,
      stopLoss,
      targets,
      marketDataSnapshot: {
        provider,
        providerSymbol,
        latestConfirmedCandleTime: latestConfirmedTime,
      },
      dgv8ChartLevels,
      dgv8LevelMap: effectiveLevelMap,
      strategyFacts: baseFacts,
      reasons,
    };
  }

  /**
   * Helper to format a runtime diagnostic string directly from the DGv8 LevelMap / Signal
   */
  public formatDiagnostic(signal: StrategySignal): string {
    const map = signal.dgv8LevelMap;
    if (!map) return "No DGv8LevelMap available";

    const buy = map.buyPivotProvenance;
    const sell = map.sellPivotProvenance;

    const bPivotTime = buy?.pivotBarTimestampBreakdown
      ? buy.pivotBarTimestampBreakdown.gmt3ISO
      : buy?.pivotBarISO || "—";
    const bConfTime = buy?.confirmationTimestampBreakdown
      ? buy.confirmationTimestampBreakdown.gmt3ISO
      : buy?.confirmationISO || "—";
    const sPivotTime = sell?.pivotBarTimestampBreakdown
      ? sell.pivotBarTimestampBreakdown.gmt3ISO
      : sell?.pivotBarISO || "—";
    const sConfTime = sell?.confirmationTimestampBreakdown
      ? sell.confirmationTimestampBreakdown.gmt3ISO
      : sell?.confirmationISO || "—";

    return [
      `Symbol: ${signal.symbol}`,
      `Evaluation timestamp: ${new Date(this.toMs(signal.detectedAt ?? Date.now())).toISOString()}`,
      `Active session: ${map.activeSession}`,
      `Source session: ${map.sourceSession}`,
      `Source trading day: ${buy?.sourceTradingDay || sell?.sourceTradingDay || signal.tradingDay}`,
      ``,
      `BUY:`,
      `  gate: ${map.buy.gate}`,
      `  pivot price: ${buy?.price ?? "—"}`,
      `  pivotIndex: ${buy?.pivotBarIndex ?? "—"}`,
      `  confirmationIndex: ${buy?.confirmationIndex ?? "—"}`,
      `  index delta: ${buy?.indexDelta ?? "—"}`,
      `  pivot timestamp: ${bPivotTime}`,
      `  confirmation timestamp: ${bConfTime}`,
      `  selection mode: ${buy?.selectionMode ?? "—"}`,
      `  wick high: ${map.source.wickHigh}`,
      ``,
      `SELL:`,
      `  gate: ${map.sell.gate}`,
      `  pivot price: ${sell?.price ?? "—"}`,
      `  pivotIndex: ${sell?.pivotBarIndex ?? "—"}`,
      `  confirmationIndex: ${sell?.confirmationIndex ?? "—"}`,
      `  index delta: ${sell?.indexDelta ?? "—"}`,
      `  pivot timestamp: ${sPivotTime}`,
      `  confirmation timestamp: ${sConfTime}`,
      `  selection mode: ${sell?.selectionMode ?? "—"}`,
      `  wick low: ${map.source.wickLow}`,
    ].join("\n");
  }
}
