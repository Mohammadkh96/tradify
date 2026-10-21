import {
  TradingSignal,
  UserProfile,
  WatchlistItem,
  PerformanceStats,
  NotificationItem,
} from "../types";

export const INITIAL_USER_PROFILE: UserProfile = {
  name: "Trader",
  experienceLevel: "INTERMEDIATE",
  accountSize: 0,
  riskPerTradePercent: 1.0,
  maxDailyLossPercent: 3.0,
  maxConcurrentTrades: 3,
  allowAggressiveSetups: false,
  preferredMarkets: ["FOREX", "METALS", "INDICES"],
  preferredSessions: ["LONDON", "NEW_YORK"],
  tradingStyle: "DAY_TRADER",
};

export const INITIAL_SIGNALS: TradingSignal[] = [];

export const INITIAL_WATCHLIST: WatchlistItem[] = [
  {
    symbol: "XAUUSD",
    name: "Gold / US Dollar",
    market: "METALS",
    currentPrice: 0,
    change24h: 0,
    activeSession: "LONDON",
    currentStatus: "FORMING",
    currentAction: "WAITING_FOR_SIGNAL_WINDOW",
    alertsEnabled: true,
  },
  {
    symbol: "US100",
    name: "Nasdaq 100 Index",
    market: "INDICES",
    currentPrice: 0,
    change24h: 0,
    activeSession: "NEW_YORK",
    currentStatus: "FORMING",
    currentAction: "WAITING_FOR_SIGNAL_WINDOW",
    alertsEnabled: true,
  },
  {
    symbol: "US30",
    name: "Dow Jones Industrial",
    market: "INDICES",
    currentPrice: 0,
    change24h: 0,
    activeSession: "NEW_YORK",
    currentStatus: "FORMING",
    currentAction: "WAITING_FOR_SIGNAL_WINDOW",
    alertsEnabled: true,
  },
  {
    symbol: "US500",
    name: "S&P 500 Index",
    market: "INDICES",
    currentPrice: 0,
    change24h: 0,
    activeSession: "NEW_YORK",
    currentStatus: "FORMING",
    currentAction: "WAITING_FOR_SIGNAL_WINDOW",
    alertsEnabled: true,
  },
];

export const INITIAL_PERFORMANCE: PerformanceStats = {
  totalSignals: 0,
  wins: 0,
  losses: 0,
  invalidated: 0,
  missed: 0,
  expired: 0,
  winRatePercent: 0,
  netR: 0,
  avgWinnerR: 0,
  avgLoserR: 0,
  profitFactor: 0,
  expectancyR: 0,
  maxDrawdownR: 0,
  consecutiveWins: 0,
  consecutiveLosses: 0,
  byMarket: {
    FOREX: { count: 0, netR: 0, winRate: 0 },
    METALS: { count: 0, netR: 0, winRate: 0 },
    INDICES: { count: 0, netR: 0, winRate: 0 },
    CRYPTO: { count: 0, netR: 0, winRate: 0 },
  },
  bySession: {
    LONDON: { count: 0, netR: 0, winRate: 0 },
    NEW_YORK: { count: 0, netR: 0, winRate: 0 },
    ASIA: { count: 0, netR: 0, winRate: 0 },
    OVERLAP: { count: 0, netR: 0, winRate: 0 },
  },
  byGrade: {
    "A+": { count: 0, netR: 0, winRate: 0 },
    A: { count: 0, netR: 0, winRate: 0 },
    B: { count: 0, netR: 0, winRate: 0 },
    C: { count: 0, netR: 0, winRate: 0 },
    REJECTED: { count: 0, netR: 0, winRate: 0 },
  },
};

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
