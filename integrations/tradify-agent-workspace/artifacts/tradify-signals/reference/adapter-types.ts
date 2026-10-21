export type StrategyType = "DGV8" | "DGV8_FX" | "BBB" | "BBB_GOLD_3S" | "NONE";

export interface VisualLevel {
  id: string;
  label: string; // e.g. "BUY GATE", "S·TP1", "ASIA HIGH", "SL"
  price: number;
  type: "GATE" | "ENTRY" | "TARGET" | "STOP" | "RANGE" | "PIVOT";
  style: "STRONG" | "THIN" | "DASHED" | "DOTTED";
  color: string;
  side?: "BUY" | "SELL" | "NEUTRAL";
  distancePts?: number;
  rRatio?: number;
  isHit?: boolean;
}

export interface VisualZone {
  id: string;
  label: string;
  high: number;
  low: number;
  color: string;
  fillOpacity?: number;
}

export interface VisualMarker {
  time?: number;
  position: "aboveBar" | "belowBar" | "inBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
  text: string;
}

export interface VisualDiagnostic {
  label: string;
  value: string | number;
  passed?: boolean;
  info?: string;
}

export interface VisualLifecycle {
  status:
    | "ACTIVE"
    | "TP_HIT"
    | "STOP_HIT"
    | "NOT_STARTED"
    | "CLOSED"
    | "INVALIDATED"
    | "INTRABAR_AMBIGUOUS";
  entry: number;
  stop: number;
  target: number;
  progressPercent?: number;
  outcomeR?: number;
}

export interface ScenarioPlan {
  side: "BUY" | "SELL";
  gateOrEntry: number | null;
  gateLabel: string;
  sl: number | null;
  targets: Array<{ label: string; price: number; distancePts?: number; rRatio?: number }>;
  isActiveScenario?: boolean;
}

export interface VisualTradePlan {
  strategyId: StrategyType;
  strategyName: string;
  symbol: string;
  currentActionLabel: string;
  marketStateLabel: string;
  isMonitoringOnly: boolean;
  scenarios: ScenarioPlan[];
  bbbDetails?: {
    asiaHigh: number | null;
    asiaLow: number | null;
    asiaRangePts: number | null;
    entry: number | null;
    stopLoss: number | null;
    target: number | null;
    signalType: string | null;
    activeTrade?: {
      entry: number;
      stopLoss: number;
      target: number;
      direction: "LONG" | "SHORT";
      originLabel: string;
      sourceSession: string;
      sourceRangePts?: number;
      progressPct: number;
      rMultiple?: number;
    } | null;
    developingSession?: {
      name: string;
      high: number | null;
      low: number | null;
      rangePts: number | null;
      status: string;
    } | null;
  };
  reasons: {
    positive: string[];
    risks: string[];
    invalidationCriteria: string;
  };
  diagnostics: VisualDiagnostic[];
}

export interface StrategyVisualModel {
  strategyId: StrategyType;
  strategyName: string;
  symbol: string;
  currentState: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  hasActiveTradeEvent: boolean;

  primaryLevels: VisualLevel[];
  targetLevels: VisualLevel[];
  stopLevels: VisualLevel[];
  sourceLevels: VisualLevel[];
  pivotLevels: VisualLevel[];
  zones: VisualZone[];
  markers: VisualMarker[];

  diagnostics: VisualDiagnostic[];
  lifecycle: VisualLifecycle | null;
  tradePlan: VisualTradePlan;
}
