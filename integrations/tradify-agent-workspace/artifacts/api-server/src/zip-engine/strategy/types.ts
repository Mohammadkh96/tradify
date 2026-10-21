import { Candle } from "../market/types";

export type StrategyName = "DGV8" | "DGV8_FX" | "BBB" | "BBB_GOLD_3S";

export type SignalStatus =
  | "DETECTED"
  | "PENDING"
  | "ACTIVE"
  | "EXPIRED"
  | "WAITING"
  | "NO_QUALIFIED_SETUP"
  | "DATA INTEGRITY ERROR"
  | "DATA_UNTRUSTED"
  | "CLOSED";

export interface DGv8TimestampBreakdown {
  rawTimestamp: number;
  normalizedMs: number;
  unixSeconds: number;
  utcISO: string;
  gmt3ISO: string;
}

export interface DGv8PivotProvenance {
  price: number | null;
  pivotBarIndex?: number | null;
  pivotBarTime: number | null;
  pivotBarISO: string | null;
  pivotBarGMT3?: string | null;
  pivotBarTimestampBreakdown?: DGv8TimestampBreakdown | null;
  confirmationIndex: number | null;
  indexDelta?: number | null;
  confirmationTime: number | null;
  confirmationISO?: string | null;
  confirmationGMT3?: string | null;
  confirmationTimestampBreakdown?: DGv8TimestampBreakdown | null;
  sourceSession: string | null;
  sourceTradingDay: string | null;
  selectionMode: "LATEST_CONFIRMED_PIVOT" | "WICK_FALLBACK";
}

export interface DGv8PivotDebugInfo {
  type: "HIGH" | "LOW";
  price: number;
  pivotBarIndex: number;
  pivotBarTime: number;
  pivotBarISO: string;
  confirmationIndex: number;
  confirmationTime: number;
  confirmationISO: string;
  session: string;
  tradingDay: string;
  accepted: boolean;
  reason?: string;
}

export interface DGv8LevelMap {
  symbol: string;
  activeSession: string;
  sourceSession: string;
  sourceCompleted?: boolean;
  source: {
    wickHigh: number | null;
    wickLow: number | null;
    bodyHigh?: number | null;
    bodyLow?: number | null;
    pivotResistance: number | null;
    pivotSupport: number | null;
    fallbackResistance: boolean;
    fallbackSupport: boolean;
    candleCount?: number;
    selectedBuySource?: "PIVOT_RESISTANCE" | "WICK_HIGH";
    selectedSellSource?: "PIVOT_SUPPORT" | "WICK_LOW";
    rangeFilterBasis?: "PIVOT" | "WICK";
    buyPivotProvenance?: DGv8PivotProvenance;
    sellPivotProvenance?: DGv8PivotProvenance;
  };
  buy: {
    gate: number | null;
    sl: number | null;
    targets: [number, number, number, number, number];
  };
  sell: {
    gate: number | null;
    sl: number | null;
    targets: [number, number, number, number, number];
  };
  buyPivotProvenance?: DGv8PivotProvenance;
  sellPivotProvenance?: DGv8PivotProvenance;
  ema50: number | null;
  range: number; // rangeFilterValue
  sourceSessionRange?: number;
  gateSeparation?: number;
  rangeFilterValue?: number;
  rangePass: boolean;
  sessionHasGates: boolean;
  updatedAt: number;
  distanceToBuyGate?: number | null;
  distanceToSellGate?: number | null;
  pivotsDebug?: DGv8PivotDebugInfo[];
  isStale?: boolean;
  freshnessState?: "LIVE" | "STALE" | "CACHED_SESSION";
}

export interface DGv8ChartLevels {
  activeSession: "ASIA" | "LONDON" | "NEW_YORK" | "NONE";
  sourceSession: "ASIA" | "LONDON" | "NEW_YORK" | "NONE";

  buyGate: number | null;
  sellGate: number | null;

  buyTargets: [number, number, number, number, number];
  sellTargets: [number, number, number, number, number];

  buyStop: number | null;
  sellStop: number | null;

  sourceHigh: number | null;
  sourceLow: number | null;

  pivotResistance: number | null;
  pivotSupport: number | null;

  activeBreakLevel: number | null;

  marketState: "BULLISH" | "BEARISH" | "NEUTRAL";

  currentAction: string;
  levelMap?: DGv8LevelMap;
}

export interface SignalEvent {
  type: "BREAKOUT_BUY" | "BREAKOUT_SELL";
  detectedAt: number;
  entry: number;
  stopLoss: number;
  targets: Array<{ label: string; price: number }>;
  breakoutCandle: {
    broker: string;
    brokerSymbol: string;
    timeframe: string;
    time: number;
    utc3Time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    asiaHigh: number;
    asiaLow: number;
    asiaRange: number;
    barBody: number;
    barRange: number;
    bodyPct: number;
    bodyVsAsiaRange: number;
    bodyPctOk: boolean;
    bodyVsRangeOk: boolean;
    strongBreakOk: boolean;
    closeAboveAsiaHigh: boolean;
    closeBelowAsiaLow: boolean;
    bullBreak: boolean;
    bearBreak: boolean;
  };
}

export interface TradeLifecycle {
  status: "ACTIVE" | "TP_HIT" | "STOP_HIT" | "INTRABAR_AMBIGUOUS" | "NOT_STARTED";
  entry: number;
  stop: number;
  target: number;
  firstSlTouchTime?: number | null;
  firstSlTouchUtc3?: string | null;
  firstTpTouchTime?: number | null;
  firstTpTouchUtc3?: string | null;
  closedAt: number | null;
  closedAtUtc3?: string | null;
  exitPrice: number | null;
  outcomePips?: number;
}

export interface BBBStrategyState {
  currentState: string;
  insideAsiaRange: boolean;
  closeAboveAsiaHigh: boolean;
  closeBelowAsiaLow: boolean;
}

export interface CurrentBarState {
  time: number | null;
  close: number;
  asiaHigh: number | null;
  asiaLow: number | null;
  asiaRange: number;
  closeAboveAsiaHigh: boolean;
  closeBelowAsiaLow: boolean;
  currentBullBreak: boolean;
  currentBearBreak: boolean;
  currentStrategyState: string;
}

export interface StrategySignal {
  id: string;
  strategy: StrategyName;
  strategyVersion: string;
  symbol: string;
  tradingDay: string;
  timeframe: string;
  direction: "LONG" | "SHORT" | "NONE";
  action: string;
  lifecycleStatus: SignalStatus;
  currentStrategyState?: string;
  strategyState?: BBBStrategyState;
  activeTradeState?: "NOT_ENTERED" | "ACTIVE" | "CLOSED" | "CANCELLED";
  lastSignalEvent?: SignalEvent | null;
  tradeLifecycle?: TradeLifecycle;
  currentBarState?: CurrentBarState;
  dataSourceInfo?: {
    dataSource: string;
    broker: string;
    brokerSymbol: string;
    timeframe: string;
  };
  detectedAt?: number;
  sourceSession?: string;
  activeSession?: string;
  entry?: number;
  entryZoneLow?: number;
  entryZoneHigh?: number;
  stopLoss?: number;
  targets: Array<{ label: string; price: number }>;
  marketDataSnapshot: {
    provider: string;
    providerSymbol: string;
    latestConfirmedCandleTime: number;
  };
  dgv8ChartLevels?: DGv8ChartLevels;
  dgv8LevelMap?: DGv8LevelMap;
  strategyFacts: Record<string, any>;
  reasons: string[];
}

export interface IStrategy {
  evaluate(
    symbol: string,
    providerSymbol: string,
    provider: string,
    candles: Candle[],
  ): StrategySignal;
}
