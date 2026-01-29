export type MarketSession = "asian" | "london" | "new_york" | "overlap_london_ny" | "off_hours";

export interface SessionInfo {
  session: MarketSession;
  displayName: string;
  color: string;
}

export const SESSION_INFO: Record<MarketSession, SessionInfo> = {
  asian: {
    session: "asian",
    displayName: "Asian",
    color: "#f59e0b",
  },
  london: {
    session: "london",
    displayName: "London",
    color: "#3b82f6",
  },
  new_york: {
    session: "new_york",
    displayName: "New York",
    color: "#10b981",
  },
  overlap_london_ny: {
    session: "overlap_london_ny",
    displayName: "London/NY Overlap",
    color: "#8b5cf6",
  },
  off_hours: {
    session: "off_hours",
    displayName: "Off Hours",
    color: "#6b7280",
  },
};

export function classifySession(timestamp: Date | string): MarketSession {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const utcHour = date.getUTCHours();

  if (utcHour >= 0 && utcHour < 7) {
    return "asian";
  }
  if (utcHour >= 7 && utcHour < 12) {
    return "london";
  }
  if (utcHour >= 12 && utcHour < 16) {
    return "overlap_london_ny";
  }
  if (utcHour >= 16 && utcHour < 21) {
    return "new_york";
  }
  return "off_hours";
}

export interface SessionMetrics {
  session: MarketSession;
  displayName: string;
  color: string;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  breakEvenCount: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  avgRisk: number;
  totalVolume: number;
}

export interface SessionAnalyticsResult {
  sessions: SessionMetrics[];
  totalTrades: number;
  bestSession: MarketSession | null;
  worstSession: MarketSession | null;
}

export function getSessionDisplayName(session: MarketSession): string {
  return SESSION_INFO[session]?.displayName || session;
}

export function getSessionColor(session: MarketSession): string {
  return SESSION_INFO[session]?.color || "#6b7280";
}
