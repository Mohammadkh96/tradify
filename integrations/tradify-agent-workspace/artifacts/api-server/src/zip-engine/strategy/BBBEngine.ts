import { Candle } from "../market/types";
import {
  IStrategy,
  StrategySignal,
  SignalEvent,
  CurrentBarState,
  TradeLifecycle,
  BBBStrategyState,
} from "./types";

export class BBBEngine implements IStrategy {
  private getUTCInfo(timestamp: number) {
    const isSeconds = timestamp < 10000000000;
    const ms = isSeconds ? timestamp * 1000 : timestamp;
    const date = new Date(ms);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const minuteOfDay = hours * 60 + minutes;
    const dateStr = date.toISOString().slice(0, 10);
    return { minuteOfDay, dateStr, hours, minutes, ms };
  }

  private calculateATR(candles: Candle[], period: number = 14): number[] {
    const atr = new Array(candles.length).fill(0);
    if (candles.length === 0) return atr;

    const tr = candles.map((c, i) => {
      if (i === 0) return c.high - c.low;
      const prevClose = candles[i - 1].close;
      return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
    });

    if (candles.length < period) return atr;

    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += tr[i];
    }
    atr[period - 1] = sum / period;

    for (let i = period; i < candles.length; i++) {
      atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
    }

    return atr;
  }

  evaluate(
    symbol: string,
    providerSymbol: string,
    provider: string,
    candles: Candle[],
    marketDataTrusted: boolean = true,
  ): StrategySignal {
    const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    const latestConfirmedTime = latestCandle ? latestCandle.time : Date.now();
    const timeInfo = this.getUTCInfo(latestConfirmedTime);

    if (!marketDataTrusted) {
      return this.createEmptySignal(
        symbol,
        providerSymbol,
        provider,
        timeInfo,
        latestConfirmedTime,
        "DATA INTEGRITY ERROR",
      );
    }

    if (!candles || candles.length === 0) {
      return this.createEmptySignal(
        symbol,
        providerSymbol,
        provider,
        timeInfo,
        latestConfirmedTime,
        "MT5 DATA SYNCING",
        ["No candle data available from MT5 bridge. MT5 DATA SYNCING."],
      );
    }

    const atr = this.calculateATR(candles, 14);

    // Pine config
    const useStrongBreakFilter = true;
    const breakBuffer = 0.0;
    const minBodyPctOfBar = 0.6;
    const minBodyVsAsiaRange = 0.3;
    const useATRBodyFilter = false;
    const atrBodyK = 0.5;
    const slBasis: string = "AsiaRange";
    const useSingleRR = false;
    const singleRR = 1.5;
    const tpMultiplier = 1.45;
    const slMultiplier = 1.25;
    const atrKSL = 1.0;
    const pctOfPrice = 0.003;
    const pointsModeValue = 1.0;
    const allowMultipleSignalsPerDay = false;

    const todaysCandlesWithAtr = candles
      .map((c, i) => ({ ...c, atr: atr[i] }))
      .filter((c) => this.getUTCInfo(c.time).dateStr === timeInfo.dateStr);

    let asiaHigh = -Infinity;
    let asiaLow = Infinity;
    let asiaComplete = false;
    let asiaRange = 0;
    let signalFired = false;
    let signalEvent: any = null;

    let tradeStatus: "ACTIVE" | "TP_HIT" | "STOP_HIT" | "INTRABAR_AMBIGUOUS" | "NOT_STARTED" =
      "NOT_STARTED";
    let entryPrice = 0;
    let stopLossPrice = 0;
    let takeProfitPrice = 0;

    let currentState = "WAITING FOR ASIA";

    for (const c of todaysCandlesWithAtr) {
      const cTime = this.getUTCInfo(c.time);
      const isAsia = cTime.minuteOfDay >= 0 && cTime.minuteOfDay < 420; // 00:00 to 07:00

      if (isAsia && !asiaComplete) {
        if (c.high > asiaHigh) asiaHigh = c.high;
        if (c.low < asiaLow) asiaLow = c.low;
        currentState = "BUILDING ASIA RANGE";
      }

      const isPostAsia = cTime.minuteOfDay >= 420;
      if (isPostAsia && !asiaComplete && asiaHigh !== -Infinity && asiaLow !== Infinity) {
        asiaComplete = true;
        asiaRange = asiaHigh - asiaLow;
        currentState = "ASIA RANGE LOCKED\nWAITING FOR SIGNAL WINDOW";
      }

      if (
        asiaComplete &&
        cTime.minuteOfDay >= 420 &&
        cTime.minuteOfDay < 480 &&
        currentState.indexOf("WAITING FOR SIGNAL WINDOW") === -1 &&
        tradeStatus === "NOT_STARTED"
      ) {
        currentState = "ASIA RANGE LOCKED\nWAITING FOR SIGNAL WINDOW";
      }

      const isSignalWindow = cTime.minuteOfDay >= 480; // 08:00
      if (asiaComplete && isSignalWindow && tradeStatus === "NOT_STARTED") {
        currentState = "WAITING FOR BREAKOUT";
      }

      if (tradeStatus === "ACTIVE") {
        // evaluate SL/TP hit
        const isBuy = signalEvent.direction === "LONG";
        if (isBuy) {
          const slHit = c.low <= stopLossPrice;
          const tpHit = c.high >= takeProfitPrice;
          if (slHit && tpHit) tradeStatus = "INTRABAR_AMBIGUOUS";
          else if (slHit) tradeStatus = "STOP_HIT";
          else if (tpHit) tradeStatus = "TP_HIT";
        } else {
          const slHit = c.high >= stopLossPrice;
          const tpHit = c.low <= takeProfitPrice;
          if (slHit && tpHit) tradeStatus = "INTRABAR_AMBIGUOUS";
          else if (slHit) tradeStatus = "STOP_HIT";
          else if (tpHit) tradeStatus = "TP_HIT";
        }
      }

      const canSignal =
        asiaComplete && isSignalWindow && (!signalFired || allowMultipleSignalsPerDay);

      if (canSignal) {
        const body = Math.abs(c.close - c.open);
        const barRange = Math.max(c.high - c.low, 1e-10);
        const bodyPct = body / barRange;
        const bodyAsia = asiaRange > 0 ? body / asiaRange : 0;

        const filterOK =
          !useStrongBreakFilter || (bodyPct >= minBodyPctOfBar && bodyAsia >= minBodyVsAsiaRange);
        const atrOK = !useATRBodyFilter || body >= c.atr * atrBodyK;

        const baseOK = filterOK && atrOK;

        const buyTrigger = baseOK && c.close > asiaHigh + asiaRange * breakBuffer;
        const sellTrigger = baseOK && c.close < asiaLow - asiaRange * breakBuffer && !buyTrigger;

        if (buyTrigger || sellTrigger) {
          signalFired = true;
          entryPrice = c.close;

          let slDistance = 0;
          if (slBasis === "AsiaRange") {
            slDistance = asiaRange * slMultiplier;
          } else if (slBasis === "Asia Edge") {
            // handled later
          } else if (slBasis === "ATR Mode") {
            slDistance = c.atr * atrKSL;
          } else if (slBasis === "% of Price") {
            slDistance = entryPrice * pctOfPrice;
          } else if (slBasis === "Points Mode") {
            slDistance = pointsModeValue;
          }

          if (buyTrigger) {
            if (slBasis === "Asia Edge") stopLossPrice = asiaLow;
            else stopLossPrice = entryPrice - slDistance;

            const actualSLDistance = entryPrice - stopLossPrice;
            takeProfitPrice = useSingleRR
              ? entryPrice + actualSLDistance * singleRR
              : entryPrice + actualSLDistance * tpMultiplier;
          } else {
            if (slBasis === "Asia Edge") stopLossPrice = asiaHigh;
            else stopLossPrice = entryPrice + slDistance;

            const actualSLDistance = stopLossPrice - entryPrice;
            takeProfitPrice = useSingleRR
              ? entryPrice - actualSLDistance * singleRR
              : entryPrice - actualSLDistance * tpMultiplier;
          }

          tradeStatus = "ACTIVE";
          currentState = buyTrigger ? "BREAKOUT BUY" : "BREAKOUT SELL";
          signalEvent = {
            type: buyTrigger ? "BREAKOUT_BUY" : "BREAKOUT_SELL",
            direction: buyTrigger ? "LONG" : "SHORT",
            detectedAt: c.time < 10000000000 ? c.time * 1000 : c.time,
            entry: entryPrice,
            stopLoss: stopLossPrice,
            targets: [{ label: "TP", price: takeProfitPrice }],
            breakoutCandle: {
              time: c.time,
              close: c.close,
              open: c.open,
              high: c.high,
              low: c.low,
              asiaHigh,
              asiaLow,
              asiaRange,
              bodyPct,
              bodyAsia,
              filterOK,
              atrOK,
            },
          };
        }
      }

      if (
        signalFired &&
        tradeStatus === "NOT_STARTED" &&
        !allowMultipleSignalsPerDay &&
        isSignalWindow
      ) {
        currentState = "SIGNAL COMPLETED FOR DAY";
      }
    }

    if (signalFired && tradeStatus !== "ACTIVE" && tradeStatus !== "NOT_STARTED") {
      currentState = "SIGNAL COMPLETED FOR DAY";
    }

    const currentBar =
      todaysCandlesWithAtr.length > 0
        ? todaysCandlesWithAtr[todaysCandlesWithAtr.length - 1]
        : null;

    let lifecycleStatus: any = "WAITING";
    if (tradeStatus === "ACTIVE") lifecycleStatus = "ACTIVE";
    else if (
      tradeStatus === "STOP_HIT" ||
      tradeStatus === "TP_HIT" ||
      tradeStatus === "INTRABAR_AMBIGUOUS"
    )
      lifecycleStatus = "CLOSED";
    else if (currentState === "WAITING FOR BREAKOUT") lifecycleStatus = "NO_QUALIFIED_SETUP";

    return {
      id: `BBB-${symbol}-${timeInfo.dateStr}-${Date.now()}`,
      strategy: "BBB",
      strategyVersion: "BBB-LONDON-1.0",
      symbol,
      tradingDay: timeInfo.dateStr,
      timeframe: "M15",
      direction: signalEvent ? signalEvent.direction : "NONE",
      action: currentState,
      lifecycleStatus,
      detectedAt: signalEvent ? signalEvent.detectedAt : latestConfirmedTime,
      targets: signalEvent ? signalEvent.targets : [],
      entry: signalEvent ? signalEvent.entry : undefined,
      stopLoss: signalEvent ? signalEvent.stopLoss : undefined,
      marketDataSnapshot: {
        provider,
        providerSymbol,
        latestConfirmedCandleTime: latestConfirmedTime,
      },
      strategyFacts: {
        calculationTimeframe: "M15",
        asia: {
          high: asiaHigh !== -Infinity ? asiaHigh : null,
          low: asiaLow !== Infinity ? asiaLow : null,
          range: asiaHigh !== -Infinity && asiaLow !== Infinity ? asiaHigh - asiaLow : 0,
          complete: asiaComplete,
        },
        signal: signalEvent
          ? {
              state: tradeStatus,
              direction: signalEvent.direction,
              entry: signalEvent.entry,
              stopLoss: signalEvent.stopLoss,
              takeProfit: signalEvent.targets[0].price,
              signalTime: signalEvent.detectedAt,
            }
          : null,
        filters: signalEvent
          ? {
              bodyPct: signalEvent.breakoutCandle.bodyPct,
              bodyAsia: signalEvent.breakoutCandle.bodyAsia,
              strongBreakOK: signalEvent.breakoutCandle.filterOK,
              atrOK: signalEvent.breakoutCandle.atrOK,
            }
          : null,
      },
      reasons: [],
    };
  }

  private createEmptySignal(
    symbol: string,
    providerSymbol: string,
    provider: string,
    timeInfo: any,
    time: number,
    action: string,
    reasons: string[] = [],
  ) {
    return {
      id: `BBB-${symbol}-${timeInfo.dateStr}-NO-CANDLES`,
      strategy: "BBB",
      strategyVersion: "BBB-LONDON-1.0",
      symbol,
      tradingDay: timeInfo.dateStr,
      timeframe: "M15",
      direction: "NONE",
      action,
      lifecycleStatus: "WAITING",
      detectedAt: time,
      targets: [],
      marketDataSnapshot: {
        provider,
        providerSymbol,
        latestConfirmedCandleTime: time,
      },
      strategyFacts: {},
      reasons,
    } as any;
  }
}
