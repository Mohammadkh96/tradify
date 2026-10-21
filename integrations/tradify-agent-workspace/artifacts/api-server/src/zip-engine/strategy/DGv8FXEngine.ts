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

export class DGv8FXEngine implements IStrategy {
  private readonly timezone = "GMT+3";
  private readonly pivotLeft = 3;
  private readonly pivotRight = 3;

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
   * Returns pip size based on quote currency.
   * JPY-quoted pairs (ends with JPY) = 0.01, standard FX = 0.0001
   */
  public getPipSize(symbol: string): number {
    const cleanSym = symbol.toUpperCase().replace(/[^A-Z]/g, "");
    return cleanSym.endsWith("JPY") ? 0.01 : 0.0001;
  }

  /**
   * Returns display decimal precision
   */
  public getPrecision(symbol: string): number {
    const cleanSym = symbol.toUpperCase().replace(/[^A-Z]/g, "");
    return cleanSym.endsWith("JPY") ? 3 : 5;
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
    return null;
  }

  /**
   * Computes all confirmed pivots across the candle array using ta.pivothigh(high, 3, 3) and ta.pivotlow(low, 3, 3)
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

    const pipSize = this.getPipSize(symbol);
    const precision = this.getPrecision(symbol);

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

    const allPivots = this.computeAllConfirmedPivots(candles);
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

    const latestPivotHigh =
      sortedPivotHighs.length > 0 ? sortedPivotHighs[sortedPivotHighs.length - 1] : null;
    const latestPivotLow =
      sortedPivotLows.length > 0 ? sortedPivotLows[sortedPivotLows.length - 1] : null;

    const sourcePivotResistance = latestPivotHigh ? latestPivotHigh.price : null;
    const sourcePivotSupport = latestPivotLow ? latestPivotLow.price : null;

    let buyGate: number | null = sourcePivotResistance;
    let fallbackResistance = false;
    let selectedBuySource: "PIVOT_RESISTANCE" | "WICK_HIGH" = "PIVOT_RESISTANCE";
    let buyPivotProvenance: any;

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
    let sellPivotProvenance: any;

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

    const sourceSessionRangePips = Number(((sourceWickHigh - sourceWickLow) / pipSize).toFixed(1));
    const gateSeparationPips = Number(((buyGate - sellGate) / pipSize).toFixed(1));

    const rangeFilterBasis: "PIVOT" | "WICK" =
      sourcePivotResistance !== null && sourcePivotSupport !== null ? "PIVOT" : "WICK";
    const rangeFilterValuePips =
      rangeFilterBasis === "PIVOT"
        ? Number(((sourcePivotResistance! - sourcePivotSupport!) / pipSize).toFixed(1))
        : gateSeparationPips;

    const rangePass = rangeFilterValuePips >= 10 && rangeFilterValuePips <= 80;

    const latestCandle = candles[candles.length - 1];
    const spotPrice = latestCandle ? latestCandle.close : 0;
    const distBuy = spotPrice > 0 ? Number(((buyGate - spotPrice) / pipSize).toFixed(1)) : null;
    const distSell = spotPrice > 0 ? Number(((spotPrice - sellGate) / pipSize).toFixed(1)) : null;

    const slPriceOffset = 12 * pipSize;
    const tp1Offset = 12 * pipSize;
    const tp2Offset = 20 * pipSize;
    const tp3Offset = 27 * pipSize;
    const tp4Offset = 35 * pipSize;
    const tp5Offset = 42 * pipSize;

    const buyTargets: [number, number, number, number, number] = [
      Number((buyGate + tp1Offset).toFixed(precision)),
      Number((buyGate + tp2Offset).toFixed(precision)),
      Number((buyGate + tp3Offset).toFixed(precision)),
      Number((buyGate + tp4Offset).toFixed(precision)),
      Number((buyGate + tp5Offset).toFixed(precision)),
    ];

    const sellTargets: [number, number, number, number, number] = [
      Number((sellGate - tp1Offset).toFixed(precision)),
      Number((sellGate - tp2Offset).toFixed(precision)),
      Number((sellGate - tp3Offset).toFixed(precision)),
      Number((sellGate - tp4Offset).toFixed(precision)),
      Number((sellGate - tp5Offset).toFixed(precision)),
    ];

    const levelMap: DGv8LevelMap = {
      symbol,
      activeSession: activeSessionName,
      sourceSession: sourceSessionName,
      sourceCompleted: true,
      source: {
        wickHigh: sourceWickHigh !== -Infinity ? Number(sourceWickHigh.toFixed(precision)) : null,
        wickLow: sourceWickLow !== Infinity ? Number(sourceWickLow.toFixed(precision)) : null,
        bodyHigh: sourceBodyHigh !== -Infinity ? Number(sourceBodyHigh.toFixed(precision)) : null,
        bodyLow: sourceBodyLow !== Infinity ? Number(sourceBodyLow.toFixed(precision)) : null,
        pivotResistance:
          sourcePivotResistance !== null ? Number(sourcePivotResistance.toFixed(precision)) : null,
        pivotSupport:
          sourcePivotSupport !== null ? Number(sourcePivotSupport.toFixed(precision)) : null,
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
        gate: Number(buyGate.toFixed(precision)),
        sl: Number((buyGate - slPriceOffset).toFixed(precision)),
        targets: buyTargets,
      },
      sell: {
        gate: Number(sellGate.toFixed(precision)),
        sl: Number((sellGate + slPriceOffset).toFixed(precision)),
        targets: sellTargets,
      },
      buyPivotProvenance,
      sellPivotProvenance,
      ema50: latestEMA ? Number(latestEMA.toFixed(precision)) : null,
      range: rangeFilterValuePips,
      sourceSessionRange: sourceSessionRangePips,
      gateSeparation: gateSeparationPips,
      rangeFilterValue: rangeFilterValuePips,
      rangePass,
      sessionHasGates: true,
      updatedAt: Date.now(),
      distanceToBuyGate: distBuy,
      distanceToSellGate: distSell,
      pivotsDebug: allPivots,
      isStale: false,
      freshnessState: "LIVE",
    };

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
      pivotTF: "M15",
      pivotLeft: this.pivotLeft,
      pivotRight: this.pivotRight,
      fallbackWick: true,
      emaFilter: true,
      emaLength: 50,
      rangeFilter: true,
      rangeMinPips: 10,
      rangeMaxPips: 80,
      touchTolerancePips: 2,
      breakBufferPips: 0.5,
      correctionTolerancePips: 3,
      reversalBufferPips: 1,
      reversalMaxBars: 12,
      asiaStart: "03:00",
      asiaEnd: "10:00",
      londonStart: "10:00",
      londonEnd: "16:00",
      nyStart: "16:00",
      nyEnd: "22:00",
      slPips: 12,
      tpPips: [12, 20, 27, 35, 42],
    };
  }

  evaluate(
    symbol: string,
    providerSymbol: string,
    provider: string,
    candles: Candle[],
    marketDataTrusted: boolean = true,
  ): StrategySignal {
    const pipSize = this.getPipSize(symbol);
    const precision = this.getPrecision(symbol);
    const breakBufferPrice = 0.5 * pipSize;
    const touchTolerancePrice = 2 * pipSize;

    const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    const latestConfirmedTime = latestCandle
      ? latestCandle.time < 10000000000
        ? latestCandle.time * 1000
        : latestCandle.time
      : Date.now();
    const timeInfo = this.getUTC3TimeInfo(latestConfirmedTime);
    const sessionCtx = this.getSessionContext(timeInfo.minuteOfDay);

    const activeSessionName = sessionCtx ? sessionCtx.activeSession : "NONE";
    const sourceSessionName = sessionCtx ? sessionCtx.sourceSession : "NEW_YORK";

    const baseFacts: Record<string, any> = {
      gateSource: "sr_pivot",
      normalization: "none",
      pipSize,
      precision,
      pivotTF: "M15",
      pivotLeft: this.pivotLeft,
      pivotRight: this.pivotRight,
      breakoutBufferPips: 0.5,
      correctionTolerancePips: 3,
      reversalBufferPips: 1,
      marketDataTrusted,
      activeSession: activeSessionName,
      sourceSession: sourceSessionName,
    };

    if (!marketDataTrusted) {
      return {
        id: `DGV8_FX-${symbol}-${timeInfo.dateStr}-UNTRUSTED`,
        strategy: "DGV8_FX",
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
        id: `DGV8_FX-${symbol}-${timeInfo.dateStr}-NO-CANDLES`,
        strategy: "DGV8_FX",
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
        dgv8LevelMap: fallbackLevelMap,
        strategyFacts: { ...baseFacts, marketState: "NEUTRAL", barsSinceBreak: 0 },
        reasons: ["No candle data available from MT5 bridge. MT5 DATA SYNCING."],
      };
    }

    let sourceDateStr = timeInfo.dateStr;
    if (sessionCtx && sessionCtx.sourceSessionIsPrevDay) {
      const prevDate = new Date(timeInfo.rawMs - 24 * 3600 * 1000);
      sourceDateStr = prevDate.toISOString().slice(0, 10);
    }

    const ema50Series = this.calculateEMA50(candles);
    const latestEMA = ema50Series.length > 0 ? ema50Series[ema50Series.length - 1] : null;

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
      baseFacts.rangeFilterBasis = effectiveLevelMap.source.rangeFilterBasis;
      baseFacts.sourceSessionRangePips = effectiveLevelMap.sourceSessionRange;
      baseFacts.gateSeparationPips = effectiveLevelMap.gateSeparation;
      baseFacts.rangeFilterValuePips = effectiveLevelMap.rangeFilterValue;
      baseFacts.sessionRangePips = effectiveLevelMap.range;
      baseFacts.rangePass = effectiveLevelMap.rangePass;
      baseFacts.buyGate = effectiveLevelMap.buy.gate;
      baseFacts.sellGate = effectiveLevelMap.sell.gate;
    }

    if (!effectiveLevelMap) {
      return {
        id: `DGV8_FX-${symbol}-${timeInfo.dateStr}-${activeSessionName}-SOURCE-MISSING`,
        strategy: "DGV8_FX",
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
      `Range Basis: ${effectiveLevelMap.source.rangeFilterBasis} | Range Value: ${effectiveLevelMap.rangeFilterValue} pips | Source Session Range: ${effectiveLevelMap.sourceSessionRange} pips`,
    );

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

        if (info.minuteOfDay >= sessionCtx.tradeDeadlineMinute) continue;

        const ema50 = ema50Series[candles.indexOf(c)] || 0;

        if (c.close > buyGate + breakBufferPrice) {
          if (c.close > ema50) {
            marketState = "BULLISH";
            breakoutLevel = buyGate;
            barsSinceBreak = activeCandles.length - 1 - i;
            currentSignalAction = "BREAKOUT BUY";
            currentDirection = "LONG";
            signalDetectedAt = c.time;
            lifecycleStatus = "DETECTED";
            reasons.push(
              `[${new Date(info.rawMs).toISOString()}] M15 candle close (${c.close}) broke Buy Gate (${buyGate}) + EMA50 confirmation (${ema50.toFixed(precision)}).`,
            );
          }
        } else if (c.close < sellGate - breakBufferPrice) {
          if (c.close < ema50) {
            marketState = "BEARISH";
            breakoutLevel = sellGate;
            barsSinceBreak = activeCandles.length - 1 - i;
            currentSignalAction = "BREAKOUT SELL";
            currentDirection = "SHORT";
            signalDetectedAt = c.time;
            lifecycleStatus = "DETECTED";
            reasons.push(
              `[${new Date(info.rawMs).toISOString()}] M15 candle close (${c.close}) broke Sell Gate (${sellGate}) + EMA50 confirmation (${ema50.toFixed(precision)}).`,
            );
          }
        } else if (
          c.low <= sellGate + touchTolerancePrice &&
          c.close > sellGate + breakBufferPrice
        ) {
          currentSignalAction = "REBOUND BUY";
          currentDirection = "LONG";
          signalDetectedAt = c.time;
          lifecycleStatus = "PENDING";
          reasons.push(
            `[${new Date(info.rawMs).toISOString()}] Price touched Sell Gate support (${sellGate}) and rebounded to close at ${c.close}.`,
          );
        } else if (
          c.high >= buyGate - touchTolerancePrice &&
          c.close < buyGate - breakBufferPrice
        ) {
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

    let stopLoss: number | undefined;
    const targets: Array<{ label: string; price: number }> = [];

    if (currentDirection === "LONG" || currentSignalAction.includes("BUY")) {
      stopLoss = effectiveLevelMap.buy.sl!;
      targets.push(
        { label: "TP1 (12p)", price: effectiveLevelMap.buy.targets[0] },
        { label: "TP2 (20p)", price: effectiveLevelMap.buy.targets[1] },
        { label: "TP3 (27p)", price: effectiveLevelMap.buy.targets[2] },
        { label: "TP4 (35p)", price: effectiveLevelMap.buy.targets[3] },
        { label: "TP5 (42p)", price: effectiveLevelMap.buy.targets[4] },
      );
    } else if (currentDirection === "SHORT" || currentSignalAction.includes("SELL")) {
      stopLoss = effectiveLevelMap.sell.sl!;
      targets.push(
        { label: "TP1 (12p)", price: effectiveLevelMap.sell.targets[0] },
        { label: "TP2 (20p)", price: effectiveLevelMap.sell.targets[1] },
        { label: "TP3 (27p)", price: effectiveLevelMap.sell.targets[2] },
        { label: "TP4 (35p)", price: effectiveLevelMap.sell.targets[3] },
        { label: "TP5 (42p)", price: effectiveLevelMap.sell.targets[4] },
      );
    } else {
      targets.push(
        { label: "BUY TP1 (12p)", price: effectiveLevelMap.buy.targets[0] },
        { label: "BUY TP2 (20p)", price: effectiveLevelMap.buy.targets[1] },
        { label: "BUY TP3 (27p)", price: effectiveLevelMap.buy.targets[2] },
        { label: "BUY TP4 (35p)", price: effectiveLevelMap.buy.targets[3] },
        { label: "BUY TP5 (42p)", price: effectiveLevelMap.buy.targets[4] },
        { label: "SELL TP1 (12p)", price: effectiveLevelMap.sell.targets[0] },
        { label: "SELL TP2 (20p)", price: effectiveLevelMap.sell.targets[1] },
        { label: "SELL TP3 (27p)", price: effectiveLevelMap.sell.targets[2] },
        { label: "SELL TP4 (35p)", price: effectiveLevelMap.sell.targets[3] },
        { label: "SELL TP5 (42p)", price: effectiveLevelMap.sell.targets[4] },
      );
    }

    const actionTag = currentSignalAction.replace(/\s+/g, "-");
    const signalId = `DGV8_FX-${symbol}-${timeInfo.dateStr}-${activeSessionName}-${actionTag}-${signalDetectedAt}`;

    return {
      id: signalId,
      strategy: "DGV8_FX",
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
}
