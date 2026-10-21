export type AssetMarket = "FOREX" | "METALS" | "CRYPTO" | "INDICES";

export type SessionName = "ASIA" | "LONDON" | "NEW_YORK" | "OVERLAP";

export type SignalDirection = "LONG" | "SHORT";

export type SignalStatus =
  | "WAITING"
  | "PENDING"
  | "DETECTED"
  | "FORMING"
  | "QUALIFIED"
  | "WAITING_FOR_RETEST"
  | "WAITING_FOR_TRIGGER"
  | "TRIGGERED"
  | "ACTIVE"
  | "PARTIALLY_CLOSED"
  | "CLOSED"
  | "CLOSED_WIN"
  | "CLOSED_LOSS"
  | "CLOSED_MANUAL"
  | "STOPPED"
  | "INVALIDATED"
  | "MISSED"
  | "EXPIRED"
  | "NO_QUALIFIED_SETUP"
  | "DATA_UNTRUSTED"
  | "DATA_ERROR";

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
  | "EXITED"
  | "SIGNAL_ALREADY_FIRED"
  | "RETRACTED_INSIDE_RANGE"
  | "POST_BREAKOUT_HOLDING"
  | "AWAITING_BREAKOUT"
  | "MT5 DATA SYNCING"
  | "NO_DATA";

export type QualityGrade = "A+" | "A" | "B" | "C" | "REJECTED";

export interface PriceCandle {
  timestamp: number;
  timeLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  session?: SessionName;
}

export interface SessionGate {
  session: SessionName;
  high: number;
  low: number;
  label: string;
  isBroken?: boolean;
  brokenDirection?: SignalDirection;
}

export interface DGv8PivotProvenance {
  price: number | null;
  pivotBarTime: number | null;
  pivotBarISO: string | null;
  confirmationTime: number | null;
  confirmationIndex: number | null;
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
  range: number;
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

export interface TargetLevel {
  label: string;
  price: number;
  isHit: boolean;
  hitTimestamp?: number;
  partialPercent?: number | null; // e.g. 40, 30, 30 or null
}

export interface SetupReason {
  positive: string[];
  risks: string[];
  invalidationCriteria: string;
}

export interface SignalTimelineEvent {
  timestamp: number;
  timeLabel: string;
  status: SignalStatus;
  title: string;
  description: string;
  priceAtEvent?: number;
}

export interface TradingSignal {
  id: string;
  _shifted?: boolean;
  symbol: string;
  symbolName: string;
  market: AssetMarket;
  direction: SignalDirection;
  primaryTimeframe: string; // e.g., 'M15'
  confirmationTimeframe: string; // e.g., 'M1'
  session: SessionName;

  status: SignalStatus;
  currentAction: StrategyAction;
  qualityGrade?: QualityGrade | null;

  currentPrice: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  idealEntryPrice: number;
  stopLoss: number;
  targets: TargetLevel[];

  currentStrategyState?: string;
  strategyState?: {
    currentState: string;
    insideAsiaRange: boolean;
    closeAboveAsiaHigh: boolean;
    closeBelowAsiaLow: boolean;
  };
  activeTradeState?: "NOT_ENTERED" | "ACTIVE" | "CLOSED" | "CANCELLED";
  lastSignalEvent?: {
    type: "BREAKOUT_BUY" | "BREAKOUT_SELL";
    detectedAt: number;
    entry: number;
    stopLoss: number;
    targets: Array<{ label: string; price: number }>;
    breakoutCandle: any;
  } | null;
  tradeLifecycle?: {
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
  };
  currentBarState?: {
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
  };
  dataSourceInfo?: {
    dataSource: string;
    broker: string;
    brokerSymbol: string;
    timeframe: string;
  };

  targetGateLabel?: string | null; // e.g., "New York Session High"
  targetGatePrice?: number | null;
  breakGatePrice?: number | null;

  riskRewardToTp1?: number | null;
  riskRewardToTp3?: number | null;

  detectedAt: number;
  qualifiedAt?: number;
  triggeredAt?: number;
  closedAt?: number;
  setupAgeMinutes: number;

  reasons: SetupReason;
  timeline: SignalTimelineEvent[];

  candles: PriceCandle[];
  gates: SessionGate[];

  // Rules alignment
  breakType?: "DECISIVE_BODY_CLOSE" | "LIQUIDITY_SWEEP_REJECTED" | "PENDING" | null;
  isChasingRisk?: boolean; // True if > 1.5 ATR extended
  isAggressive?: boolean;

  // Execution tracking
  userFollowed?: boolean;
  userEntryPrice?: number;
  userExitPrice?: number;
  userResultR?: number;
  officialResultR?: number;

  dgv8ChartLevels?: DGv8ChartLevels;
  dgv8LevelMap?: DGv8LevelMap;
  aiCommentary?: string;
  strategy?: string;
  strategyFacts?: any;
}

export interface UserProfile {
  name: string;
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PRO";
  accountSize: number;
  riskPerTradePercent: number; // e.g. 0.5%
  maxDailyLossPercent: number; // e.g. 2.0%
  maxConcurrentTrades: number; // e.g. 3
  allowAggressiveSetups: boolean;
  preferredMarkets: AssetMarket[];
  preferredSessions: SessionName[];
  tradingStyle: "DAY_TRADER" | "SWING" | "SCALPER";
}

export type DataState = "LIVE" | "FALLBACK" | "STALE" | "ERROR";

export interface WatchlistItem {
  symbol: string;
  name: string;
  market: AssetMarket;
  currentPrice: number;
  change24h: number;
  activeSession: SessionName;
  currentStatus: SignalStatus;
  providerStatus?:
    "LIVE" | "DELAYED" | "STALE" | "MARKET_CLOSED" | "RECONNECTING" | "UNAVAILABLE" | "DEMO";
  dataState?: DataState;
  lastError?: string | null;
  currentAction: StrategyAction;
  alertsEnabled: boolean;
  volatilityWarning?: string;
  lastValidSignalId?: string;
}

export interface PerformanceStats {
  totalSignals: number;
  wins: number;
  losses: number;
  invalidated: number;
  missed: number;
  expired: number;
  winRatePercent: number;
  netR: number;
  avgWinnerR: number;
  avgLoserR: number;
  profitFactor: number;
  expectancyR: number;
  maxDrawdownR: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  byMarket: Record<AssetMarket, { count: number; netR: number; winRate: number }>;
  bySession: Record<SessionName, { count: number; netR: number; winRate: number }>;
  byGrade: Record<QualityGrade, { count: number; netR: number; winRate: number }>;
}

export interface NotificationItem {
  id: string;
  timestamp: number;
  timeLabel: string;
  symbol: string;
  type:
    | "NEW_SETUP"
    | "STATUS_CHANGE"
    | "RETEST_READY"
    | "TRIGGERED"
    | "TP_HIT"
    | "SL_HIT"
    | "INVALIDATED"
    | "MARKET_WARNING";
  title: string;
  message: string;
  actionRequired?: StrategyAction;
  isRead: boolean;
  signalId?: string;
}

export interface StrategyRuleCheck {
  ruleName: string;
  passed: boolean;
  detail: string;
}

export type AlertCondition = "CROSSES_ABOVE" | "CROSSES_BELOW" | "REACHES_EXACT";

export * from "./types/membership";

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: AlertCondition;
  createdAt: number;
  status: "ACTIVE" | "TRIGGERED" | "CANCELLED";
  triggeredAt?: number;
  note?: string;
  label?: string;
  notifyPush?: boolean;
  notifySound?: boolean;
}
