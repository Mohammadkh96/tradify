import { Candle } from "../market/types";
import { IStrategy, StrategySignal, SignalEvent, TradeLifecycle } from "./types";

export interface BBBGold3SConfig {
  breakBufferPct: number; // 0.15 (15%)
  useStrongBreakFilter: boolean; // true
  minBodyPctOfBar: number; // 0.5 (50%)
  minBodyVsSessionRange: number; // 0.4 (40%)
  useATRBodyFilter: boolean; // false
  atrBodyK: number; // 0.5
  riskReward: number; // 2.0
  allowRepeatedDirectionPerWindow: boolean; // false (One signal per direction per window)
}

export const DEFAULT_BBB_GOLD_3S_CONFIG: BBBGold3SConfig = {
  breakBufferPct: 0.15,
  useStrongBreakFilter: true,
  minBodyPctOfBar: 0.5,
  minBodyVsSessionRange: 0.4,
  useATRBodyFilter: false,
  atrBodyK: 0.5,
  riskReward: 2.0,
  allowRepeatedDirectionPerWindow: false,
};

export class BBBGold3SEngine implements IStrategy {
  private config: BBBGold3SConfig;

  constructor(config: Partial<BBBGold3SConfig> = {}) {
    this.config = { ...DEFAULT_BBB_GOLD_3S_CONFIG, ...config };
  }

  /**
   * Converts timestamp into GMT+3 components.
   * GMT+3 is UTC + 3 hours.
   */
  public getGMT3Info(timestamp: number) {
    const isSeconds = timestamp < 10000000000;
    const ms = isSeconds ? timestamp * 1000 : timestamp;
    const gmt3Date = new Date(ms + 3 * 3600 * 1000);
    const hours = gmt3Date.getUTCHours();
    const minutes = gmt3Date.getUTCMinutes();
    const minuteOfDay = hours * 60 + minutes;
    const dateStr = gmt3Date.toISOString().slice(0, 10);
    const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    // Session classification in GMT+3 for candle OPEN time:
    // ASIA: 03:00 to 10:00 GMT+3 (minuteOfDay 180 to 599)
    // LONDON: 10:00 to 16:00 GMT+3 (minuteOfDay 600 to 959)
    // NEW_YORK: 16:00 to 23:00 GMT+3 (minuteOfDay 960 to 1379)
    // OFF_HOURS: 23:00 to 03:00 GMT+3 (minuteOfDay >= 1380 or < 180)
    let session: "ASIA" | "LONDON" | "NEW_YORK" | "OFF_HOURS" = "OFF_HOURS";
    if (minuteOfDay >= 180 && minuteOfDay < 600) {
      session = "ASIA";
    } else if (minuteOfDay >= 600 && minuteOfDay < 960) {
      session = "LONDON";
    } else if (minuteOfDay >= 960 && minuteOfDay < 1380) {
      session = "NEW_YORK";
    } else {
      session = "OFF_HOURS";
    }

    return { ms, minuteOfDay, dateStr, timeStr, hours, minutes, session };
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
    const uppercaseSymbol = symbol ? symbol.toUpperCase() : "XAUUSD";
    const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
    const latestConfirmedTime = latestCandle
      ? latestCandle.time < 10000000000
        ? latestCandle.time * 1000
        : latestCandle.time
      : Date.now();
    const timeInfo = this.getGMT3Info(latestConfirmedTime);

    if (!marketDataTrusted) {
      return this.createEmptySignal(
        uppercaseSymbol,
        providerSymbol,
        provider,
        timeInfo,
        latestConfirmedTime,
        "DATA INTEGRITY ERROR",
        ["Market data integrity check failed or untrusted feed."],
      );
    }

    if (!candles || candles.length === 0) {
      return this.createEmptySignal(
        uppercaseSymbol,
        providerSymbol,
        provider,
        timeInfo,
        latestConfirmedTime,
        "WAITING FOR CANDLE DATA",
        ["No candle data available for BBB Gold 3S evaluation."],
      );
    }

    // Sort candles chronologically
    const sortedCandles = [...candles].sort((a, b) => {
      const ta = a.time < 10000000000 ? a.time * 1000 : a.time;
      const tb = b.time < 10000000000 ? b.time * 1000 : b.time;
      return ta - tb;
    });

    const atr = this.calculateATR(sortedCandles, 14);

    // Track active building ranges
    let currAsiaHigh = -Infinity;
    let currAsiaLow = Infinity;
    let currAsiaDate = "";

    let currLondonHigh = -Infinity;
    let currLondonLow = Infinity;
    let currLondonDate = "";

    let currNyHigh = -Infinity;
    let currNyLow = Infinity;
    let currNyDate = "";

    // Locked completed ranges
    let lockedAsia: { high: number; low: number; range: number; dateStr: string } | null = null;
    let lockedLondon: { high: number; low: number; range: number; dateStr: string } | null = null;
    let lockedNy: { high: number; low: number; range: number; dateStr: string } | null = null;

    // Track signals fired per window session
    // Window key format: `${session}_${dateStr}`
    const windowSignalsFired = new Map<string, { buy: boolean; sell: boolean }>();

    let lastActiveSignalEvent: SignalEvent | null = null;
    let activeTradeStatus: "NOT_STARTED" | "ACTIVE" | "TP_HIT" | "STOP_HIT" | "INTRABAR_AMBIGUOUS" =
      "NOT_STARTED";
    let activeEntryPrice = 0;
    let activeStopLossPrice = 0;
    let activeTakeProfitPrice = 0;
    let activeTradeLifecycle: TradeLifecycle | null = null;

    let currentState = "WAITING FOR SETUP";
    let activeSessionName: "ASIA" | "LONDON" | "NEW_YORK" | "OFF_HOURS" = "OFF_HOURS";
    let currentSourceSessionName: string = "NONE";
    let currentSourceRange: { high: number; low: number; range: number } | null = null;

    let previousCandleSession: "ASIA" | "LONDON" | "NEW_YORK" | "OFF_HOURS" | "INIT" = "INIT";

    for (let i = 0; i < sortedCandles.length; i++) {
      const c = sortedCandles[i];
      const cAtr = atr[i];
      const cTime = this.getGMT3Info(c.time);
      const session = cTime.session;
      const dateStr = cTime.dateStr;
      const windowKey = `${session}_${dateStr}`;

      if (!windowSignalsFired.has(windowKey)) {
        windowSignalsFired.set(windowKey, { buy: false, sell: false });
      }
      const windowTracker = windowSignalsFired.get(windowKey)!;

      // Handle session boundaries / transitions
      if (session === "ASIA") {
        // If we just entered Asia or day rolled
        if (currAsiaDate !== dateStr) {
          currAsiaHigh = -Infinity;
          currAsiaLow = Infinity;
          currAsiaDate = dateStr;
        }
        // Accumulate Asia high/low
        currAsiaHigh = Math.max(currAsiaHigh, c.high);
        currAsiaLow = Math.min(currAsiaLow, c.low);

        // Breakout source for Asia is prior NY range
        if (lockedNy && lockedNy.range > 0) {
          currentSourceSessionName = "NEW_YORK";
          currentSourceRange = lockedNy;
        } else {
          currentSourceSessionName = "NONE";
          currentSourceRange = null;
        }
      } else if (session === "LONDON") {
        // When in London, lock Asia range if not locked yet for today
        if (currAsiaHigh !== -Infinity && currAsiaLow !== Infinity && currAsiaHigh > currAsiaLow) {
          lockedAsia = {
            high: currAsiaHigh,
            low: currAsiaLow,
            range: currAsiaHigh - currAsiaLow,
            dateStr: currAsiaDate,
          };
        }

        if (currLondonDate !== dateStr) {
          currLondonHigh = -Infinity;
          currLondonLow = Infinity;
          currLondonDate = dateStr;
        }
        // Accumulate London high/low
        currLondonHigh = Math.max(currLondonHigh, c.high);
        currLondonLow = Math.min(currLondonLow, c.low);

        // Breakout source for London is Asia range
        if (lockedAsia && lockedAsia.range > 0) {
          currentSourceSessionName = "ASIA";
          currentSourceRange = lockedAsia;
        } else {
          currentSourceSessionName = "NONE";
          currentSourceRange = null;
        }
      } else if (session === "NEW_YORK") {
        // When in NY, lock London range if not locked yet
        if (
          currLondonHigh !== -Infinity &&
          currLondonLow !== Infinity &&
          currLondonHigh > currLondonLow
        ) {
          lockedLondon = {
            high: currLondonHigh,
            low: currLondonLow,
            range: currLondonHigh - currLondonLow,
            dateStr: currLondonDate,
          };
        }

        if (currNyDate !== dateStr) {
          currNyHigh = -Infinity;
          currNyLow = Infinity;
          currNyDate = dateStr;
        }
        // Accumulate NY high/low
        currNyHigh = Math.max(currNyHigh, c.high);
        currNyLow = Math.min(currNyLow, c.low);

        // Breakout source for NY is London range
        if (lockedLondon && lockedLondon.range > 0) {
          currentSourceSessionName = "LONDON";
          currentSourceRange = lockedLondon;
        } else {
          currentSourceSessionName = "NONE";
          currentSourceRange = null;
        }
      } else if (session === "OFF_HOURS") {
        // Lock NY range when entering off-hours
        if (currNyHigh !== -Infinity && currNyLow !== Infinity && currNyHigh > currNyLow) {
          lockedNy = {
            high: currNyHigh,
            low: currNyLow,
            range: currNyHigh - currNyLow,
            dateStr: currNyDate,
          };
        }
        currentSourceSessionName = "NONE";
        currentSourceRange = null;
      }

      activeSessionName = session;
      previousCandleSession = session;

      // Track active trade outcome (SL / TP)
      if (activeTradeStatus === "ACTIVE" && lastActiveSignalEvent) {
        const isBuy = lastActiveSignalEvent.type === "BREAKOUT_BUY";
        if (isBuy) {
          const slHit = c.low <= activeStopLossPrice;
          const tpHit = c.high >= activeTakeProfitPrice;
          if (slHit && tpHit) {
            activeTradeStatus = "INTRABAR_AMBIGUOUS";
            if (activeTradeLifecycle) {
              activeTradeLifecycle.status = "INTRABAR_AMBIGUOUS";
              activeTradeLifecycle.closedAt = cTime.ms;
              activeTradeLifecycle.closedAtUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.exitPrice = activeStopLossPrice;
            }
          } else if (slHit) {
            activeTradeStatus = "STOP_HIT";
            if (activeTradeLifecycle) {
              activeTradeLifecycle.status = "STOP_HIT";
              activeTradeLifecycle.firstSlTouchTime = cTime.ms;
              activeTradeLifecycle.firstSlTouchUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.closedAt = cTime.ms;
              activeTradeLifecycle.closedAtUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.exitPrice = activeStopLossPrice;
            }
          } else if (tpHit) {
            activeTradeStatus = "TP_HIT";
            if (activeTradeLifecycle) {
              activeTradeLifecycle.status = "TP_HIT";
              activeTradeLifecycle.firstTpTouchTime = cTime.ms;
              activeTradeLifecycle.firstTpTouchUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.closedAt = cTime.ms;
              activeTradeLifecycle.closedAtUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.exitPrice = activeTakeProfitPrice;
            }
          }
        } else {
          // Short
          const slHit = c.high >= activeStopLossPrice;
          const tpHit = c.low <= activeTakeProfitPrice;
          if (slHit && tpHit) {
            activeTradeStatus = "INTRABAR_AMBIGUOUS";
            if (activeTradeLifecycle) {
              activeTradeLifecycle.status = "INTRABAR_AMBIGUOUS";
              activeTradeLifecycle.closedAt = cTime.ms;
              activeTradeLifecycle.closedAtUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.exitPrice = activeStopLossPrice;
            }
          } else if (slHit) {
            activeTradeStatus = "STOP_HIT";
            if (activeTradeLifecycle) {
              activeTradeLifecycle.status = "STOP_HIT";
              activeTradeLifecycle.firstSlTouchTime = cTime.ms;
              activeTradeLifecycle.firstSlTouchUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.closedAt = cTime.ms;
              activeTradeLifecycle.closedAtUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.exitPrice = activeStopLossPrice;
            }
          } else if (tpHit) {
            activeTradeStatus = "TP_HIT";
            if (activeTradeLifecycle) {
              activeTradeLifecycle.status = "TP_HIT";
              activeTradeLifecycle.firstTpTouchTime = cTime.ms;
              activeTradeLifecycle.firstTpTouchUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.closedAt = cTime.ms;
              activeTradeLifecycle.closedAtUtc3 = `${cTime.dateStr} ${cTime.timeStr}`;
              activeTradeLifecycle.exitPrice = activeTakeProfitPrice;
            }
          }
        }
      }

      // Check for New Breakout Signal in the active window
      // Signals can fire during ASIA (breaking NY), LONDON (breaking Asia), or NY (breaking London)
      if (session !== "OFF_HOURS" && currentSourceRange && currentSourceRange.range > 0) {
        const sourceHigh = currentSourceRange.high;
        const sourceLow = currentSourceRange.low;
        const sourceRange = currentSourceRange.range;

        const body = Math.abs(c.close - c.open);
        const candleRange = Math.max(c.high - c.low, 1e-10);
        const bodyPctOfBar = body / candleRange;
        const bodyVsSessionRange = body / sourceRange;

        // Break buffer = 15% of session range
        const bufferAmount = sourceRange * this.config.breakBufferPct;
        const buyThreshold = sourceHigh + bufferAmount;
        const sellThreshold = sourceLow - bufferAmount;

        // Candle direction rule
        const isBullishCandle = c.close > c.open;
        const isBearishCandle = c.close < c.open;

        // Strong break filter: body >= 50% candle range AND body >= 40% session range
        const strongBreakOk =
          !this.config.useStrongBreakFilter ||
          (bodyPctOfBar >= this.config.minBodyPctOfBar &&
            bodyVsSessionRange >= this.config.minBodyVsSessionRange);

        // ATR body filter (default OFF)
        const atrOk = !this.config.useATRBodyFilter || body >= cAtr * this.config.atrBodyK;

        const filterPassed = strongBreakOk && atrOk;

        const buyTrigger = filterPassed && isBullishCandle && c.close > buyThreshold;
        const sellTrigger =
          filterPassed && isBearishCandle && c.close < sellThreshold && !buyTrigger;

        const canFireBuy =
          buyTrigger && (!windowTracker.buy || this.config.allowRepeatedDirectionPerWindow);
        const canFireSell =
          sellTrigger && (!windowTracker.sell || this.config.allowRepeatedDirectionPerWindow);

        if (canFireBuy || canFireSell) {
          const isBuy = canFireBuy;
          if (isBuy) windowTracker.buy = true;
          else windowTracker.sell = true;

          activeEntryPrice = c.close;
          const slDistance = sourceRange; // SL basis = SessionRange (1.0x)

          if (isBuy) {
            activeStopLossPrice = activeEntryPrice - slDistance;
            activeTakeProfitPrice = activeEntryPrice + this.config.riskReward * slDistance;
          } else {
            activeStopLossPrice = activeEntryPrice + slDistance;
            activeTakeProfitPrice = activeEntryPrice - this.config.riskReward * slDistance;
          }

          activeTradeStatus = "ACTIVE";
          currentState = isBuy ? "BREAKOUT BUY" : "BREAKOUT SELL";

          lastActiveSignalEvent = {
            type: isBuy ? "BREAKOUT_BUY" : "BREAKOUT_SELL",
            detectedAt: cTime.ms,
            entry: activeEntryPrice,
            stopLoss: activeStopLossPrice,
            targets: [
              { label: `TP ${this.config.riskReward.toFixed(1)}R`, price: activeTakeProfitPrice },
            ],
            breakoutCandle: {
              broker: provider,
              brokerSymbol: providerSymbol,
              timeframe: "M15",
              time: c.time,
              utc3Time: `${cTime.dateStr} ${cTime.timeStr}`,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              asiaHigh: sourceHigh,
              asiaLow: sourceLow,
              asiaRange: sourceRange,
              barBody: body,
              barRange: candleRange,
              bodyPct: bodyPctOfBar,
              bodyVsAsiaRange: bodyVsSessionRange,
              bodyPctOk: bodyPctOfBar >= this.config.minBodyPctOfBar,
              bodyVsRangeOk: bodyVsSessionRange >= this.config.minBodyVsSessionRange,
              strongBreakOk,
              closeAboveAsiaHigh: c.close > sourceHigh,
              closeBelowAsiaLow: c.close < sourceLow,
              bullBreak: isBuy,
              bearBreak: !isBuy,
            },
          };

          activeTradeLifecycle = {
            status: "ACTIVE",
            entry: activeEntryPrice,
            stop: activeStopLossPrice,
            target: activeTakeProfitPrice,
            firstSlTouchTime: null,
            firstSlTouchUtc3: null,
            firstTpTouchTime: null,
            firstTpTouchUtc3: null,
            closedAt: null,
            closedAtUtc3: null,
            exitPrice: null,
          };
        }
      }
    }

    // Determine current display action string
    if (activeSessionName === "OFF_HOURS") {
      currentState = "OFF HOURS (23:00 - 03:00 GMT+3)\nWAITING FOR ASIA";
    } else if (activeTradeStatus === "ACTIVE") {
      currentState =
        lastActiveSignalEvent?.type === "BREAKOUT_BUY"
          ? "BREAKOUT BUY (ACTIVE)"
          : "BREAKOUT SELL (ACTIVE)";
    } else if (activeTradeStatus === "TP_HIT") {
      currentState = "TP HIT";
    } else if (activeTradeStatus === "STOP_HIT") {
      currentState = "STOP HIT";
    } else if (currentSourceRange && currentSourceRange.range > 0) {
      currentState = `WAITING FOR ${activeSessionName} BREAKOUT OF ${currentSourceSessionName}`;
    } else {
      currentState = `BUILDING ${activeSessionName} RANGE`;
    }

    let lifecycleStatus: any = "WAITING";
    if (activeTradeStatus === "ACTIVE") {
      lifecycleStatus = "ACTIVE";
    } else if (["TP_HIT", "STOP_HIT", "INTRABAR_AMBIGUOUS"].includes(activeTradeStatus)) {
      lifecycleStatus = "CLOSED";
    } else if (currentState.includes("WAITING FOR")) {
      lifecycleStatus = "NO_QUALIFIED_SETUP";
    }

    return {
      id: `BBB-GOLD-3S-${uppercaseSymbol}-${timeInfo.dateStr}-${Date.now()}`,
      strategy: "BBB_GOLD_3S" as any,
      strategyVersion: "BBB-GOLD-3S-1.0",
      symbol: uppercaseSymbol,
      tradingDay: timeInfo.dateStr,
      timeframe: "M15",
      direction: lastActiveSignalEvent
        ? lastActiveSignalEvent.type === "BREAKOUT_BUY"
          ? "LONG"
          : "SHORT"
        : "NONE",
      action: currentState,
      lifecycleStatus,
      detectedAt: lastActiveSignalEvent ? lastActiveSignalEvent.detectedAt : latestConfirmedTime,
      targets: lastActiveSignalEvent ? lastActiveSignalEvent.targets : [],
      entry: lastActiveSignalEvent ? lastActiveSignalEvent.entry : undefined,
      stopLoss: lastActiveSignalEvent ? lastActiveSignalEvent.stopLoss : undefined,
      tradeLifecycle: activeTradeLifecycle || undefined,
      lastSignalEvent: lastActiveSignalEvent,
      marketDataSnapshot: {
        provider,
        providerSymbol,
        latestConfirmedCandleTime: latestConfirmedTime,
      },
      strategyFacts: {
        activeSession: activeSessionName,
        sourceSession: currentSourceSessionName,
        sourceRange: currentSourceRange,
        breakBufferPct: this.config.breakBufferPct,
        riskReward: this.config.riskReward,
        sessions: {
          asia: {
            currentHigh: currAsiaHigh === -Infinity ? null : currAsiaHigh,
            currentLow: currAsiaLow === Infinity ? null : currAsiaLow,
            locked: lockedAsia,
          },
          london: {
            currentHigh: currLondonHigh === -Infinity ? null : currLondonHigh,
            currentLow: currLondonLow === Infinity ? null : currLondonLow,
            locked: lockedLondon,
          },
          ny: {
            currentHigh: currNyHigh === -Infinity ? null : currNyHigh,
            currentLow: currNyLow === Infinity ? null : currNyLow,
            locked: lockedNy,
          },
        },
        tradeStatus: activeTradeStatus,
      },
      reasons: [
        `Cascade active: Source [${currentSourceSessionName}] -> Breakout in [${activeSessionName}]. Buffer: ${(this.config.breakBufferPct * 100).toFixed(0)}%, R:R: ${this.config.riskReward.toFixed(1)}.`,
      ],
    };
  }

  private createEmptySignal(
    symbol: string,
    providerSymbol: string,
    provider: string,
    timeInfo: { dateStr: string },
    latestConfirmedTime: number,
    action: string,
    reasons: string[] = [],
  ): StrategySignal {
    return {
      id: `BBB-GOLD-3S-${symbol}-${timeInfo.dateStr}-${Date.now()}`,
      strategy: "BBB_GOLD_3S" as any,
      strategyVersion: "BBB-GOLD-3S-1.0",
      symbol,
      tradingDay: timeInfo.dateStr,
      timeframe: "M15",
      direction: "NONE",
      action,
      lifecycleStatus: "NO_QUALIFIED_SETUP",
      detectedAt: latestConfirmedTime,
      targets: [],
      marketDataSnapshot: {
        provider,
        providerSymbol,
        latestConfirmedCandleTime: latestConfirmedTime,
      },
      strategyFacts: {},
      reasons,
    };
  }
}
