// Deterministic sample trading data used to populate the dashboard for new
// users who haven't connected MT5 yet. The goal is to let a user "feel" the
// product within seconds of signing up — equity curve, behavioural flags,
// prop firm progress, all populated with realistic numbers.
//
// IMPORTANT: This data is purely client-side. It never reaches the database
// and never bleeds into reports/analytics for users with real trades.

export const SAMPLE_ACCOUNT_NUMBER = "SAMPLE-50000";
export const SAMPLE_ACCOUNT_NAME = "Sample Account";
export const SAMPLE_BROKER = "Tradify Demo";
export const SAMPLE_SERVER = "Tradify-Demo";

export interface SampleTrade {
  id: number;
  ticket: string;
  symbol: string;
  direction: "Long" | "Short";
  volume: number;
  entryPrice: number;
  exitPrice: number;
  netPl: number;
  openTime: string;
  closeTime: string;
  duration: number;
  source: "sample";
  outcome: "Win" | "Loss" | "Break-even";
  mood?: string;
  mistakeCategory?: string;
  notes?: string;
}

export interface SampleEquityPoint {
  date: string;
  netPl: number;
  symbol: string;
  source: "sample";
}

export interface SampleMt5Metrics {
  balance: string;
  equity: string;
  floatingPl: string;
  margin: string;
  freeMargin: string;
  marginLevel: string;
  positions: Array<{
    ticket: number;
    symbol: string;
    type: string;
    volume: number;
    price: number;
    profit: number;
  }>;
}

export interface SamplePropFirmChallenge {
  id: number;
  firmName: string;
  challengeName: string;
  phase: string;
  accountSize: string;
  currency: string;
  profitTarget: string;
  dailyDrawdownLimit: string;
  maxDrawdownLimit: string;
  startDate: string;
  status: string;
  currentBalance: string;
  highWaterMark: string;
  source: "sample";
}

const SYMBOLS = ["EURUSD", "GBPJPY", "XAUUSD", "USDJPY", "NAS100", "GBPUSD"];

// Fixed seed → deterministic output. Mulberry32 PRNG.
function seededRng(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

let cache:
  | {
      trades: SampleTrade[];
      equityCurve: SampleEquityPoint[];
      mt5Metrics: SampleMt5Metrics;
      propFirm: SamplePropFirmChallenge;
      todayStats: { pl: number; count: number };
      insight: string;
    }
  | null = null;

function generate() {
  const rng = seededRng(2026);
  const trades: SampleTrade[] = [];
  const startBalance = 50000;
  const today = new Date();
  let id = 1;
  let ticket = 100100;

  // Generate ~60 days, ~3-7 trades on trading days. Mix in a revenge-trade
  // cluster around day 22 and a recovery streak in the final week.
  for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    // skip weekends
    const wd = date.getDay();
    if (wd === 0 || wd === 6) continue;

    const isRevengeDay = dayOffset === 38 || dayOffset === 22;
    const isOvertradingDay = dayOffset === 30;
    const isRecoveryDay = dayOffset <= 6;

    let tradesThisDay = 3 + Math.floor(rng() * 4);
    if (isOvertradingDay) tradesThisDay = 14;
    if (isRevengeDay) tradesThisDay = 6;

    for (let i = 0; i < tradesThisDay; i++) {
      const symbol = SYMBOLS[Math.floor(rng() * SYMBOLS.length)];
      const direction: "Long" | "Short" = rng() > 0.5 ? "Long" : "Short";
      const volume = Math.round((0.05 + rng() * 0.5) * 100) / 100;

      // Win probability: baseline 0.55, drop hard on revenge days, rise on recovery
      let winProb = 0.55;
      if (isRevengeDay) winProb = 0.18;
      if (isOvertradingDay) winProb = 0.32;
      if (isRecoveryDay) winProb = 0.7;

      const isWin = rng() < winProb;
      // Sized P&L — winners $80–$420, losers -$60 to -$300, occasional bigger
      const baseR = 80 + rng() * 340;
      const lossR = -(60 + rng() * 240);
      let netPl = isWin ? baseR : lossR;
      // Revenge-day position size escalation: increase loss on later trades
      if (isRevengeDay && !isWin && i > 2) netPl *= 1.6 + rng() * 0.6;
      // Round to 2 decimals
      netPl = Math.round(netPl * 100) / 100;

      const hour = 8 + Math.floor(rng() * 9); // London/NY session
      const minute = Math.floor(rng() * 60);
      const openTime = new Date(date);
      openTime.setHours(hour, minute, 0, 0);
      const duration = 5 + Math.floor(rng() * 90);
      const closeTime = new Date(openTime.getTime() + duration * 60_000);

      const entryPrice = Math.round((1 + rng() * 200) * 100000) / 100000;
      const pipMove = (netPl / 1000) * (rng() * 2 + 1);
      const exitPrice =
        direction === "Long"
          ? entryPrice + pipMove
          : entryPrice - pipMove;

      const outcome: "Win" | "Loss" | "Break-even" =
        netPl > 0 ? "Win" : netPl < 0 ? "Loss" : "Break-even";

      const trade: SampleTrade = {
        id: id++,
        ticket: String(ticket++),
        symbol,
        direction,
        volume,
        entryPrice,
        exitPrice: Math.round(exitPrice * 100000) / 100000,
        netPl,
        openTime: openTime.toISOString(),
        closeTime: closeTime.toISOString(),
        duration,
        source: "sample",
        outcome,
        mood: isRevengeDay && !isWin ? "Frustrated" : isWin ? "Confident" : "Neutral",
        mistakeCategory: isRevengeDay && !isWin ? "Revenge Trading" : isOvertradingDay ? "Overtrading" : undefined,
        notes:
          isRevengeDay && i === 5
            ? "Stop-loss skipped, doubled position to recover prior loss."
            : undefined,
      };
      trades.push(trade);
    }
  }

  // Build equity curve in chronological order
  trades.sort((a, b) => new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime());
  const equityCurve: SampleEquityPoint[] = trades.map((t) => ({
    date: t.closeTime,
    netPl: t.netPl,
    symbol: t.symbol,
    source: "sample",
  }));

  const totalPl = equityCurve.reduce((acc, p) => acc + p.netPl, 0);
  const balance = startBalance + totalPl;
  const equity = balance + 142.6; // a tiny floating P/L on a fake open position

  // Today stats — pick today's trades
  const todayKey = new Date().toISOString().slice(0, 10);
  const todays = equityCurve.filter((p) => p.date.slice(0, 10) === todayKey);
  const todayStats = {
    pl: todays.reduce((acc, p) => acc + p.netPl, 0),
    count: todays.length,
  };

  const mt5Metrics: SampleMt5Metrics = {
    balance: balance.toFixed(2),
    equity: equity.toFixed(2),
    floatingPl: "142.60",
    margin: "1240.00",
    freeMargin: (equity - 1240).toFixed(2),
    marginLevel: ((equity / 1240) * 100).toFixed(2),
    positions: [
      {
        ticket: 100099,
        symbol: "EURUSD",
        type: "BUY",
        volume: 0.25,
        price: 1.0834,
        profit: 142.6,
      },
    ],
  };

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 60);

  const propFirm: SamplePropFirmChallenge = {
    id: -1,
    firmName: "FTMO",
    challengeName: "FTMO $50K Challenge",
    phase: "Phase 1",
    accountSize: "50000",
    currency: "USD",
    profitTarget: "5000",
    dailyDrawdownLimit: "2500",
    maxDrawdownLimit: "5000",
    startDate: startDate.toISOString(),
    status: "active",
    currentBalance: balance.toFixed(2),
    highWaterMark: balance.toFixed(2),
    source: "sample",
  };

  // Build a one-sentence behavioural insight
  const revengeLosses = trades.filter((t) => t.mistakeCategory === "Revenge Trading").length;
  const overtradingDays = trades.filter((t) => t.mistakeCategory === "Overtrading").length;
  const insight =
    revengeLosses > 0
      ? `We spotted ${revengeLosses} likely revenge trades in the last 60 days — your average loss on those was 1.6× larger than your normal losers.`
      : overtradingDays > 0
        ? `We spotted ${overtradingDays} trades on a single overtrading day — limiting yourself to 5 trades/day would have improved win-rate by ~9%.`
        : `Your last 60 days show a 56% win-rate with a 1.4 profit factor — a solid edge to refine.`;

  cache = { trades, equityCurve, mt5Metrics, propFirm, todayStats, insight };
  return cache;
}

export function getSampleData() {
  if (cache) return cache;
  return generate();
}

export function getSampleTrades() {
  return getSampleData().trades;
}

export function getSampleEquityCurve() {
  return getSampleData().equityCurve;
}

export function getSampleMt5Status() {
  const d = getSampleData();
  return {
    status: "SAMPLE" as const,
    metrics: d.mt5Metrics,
  };
}

export function getSampleTodayStats() {
  return getSampleData().todayStats;
}

export function getSamplePropFirm() {
  return getSampleData().propFirm;
}

export function getSampleInsight() {
  return getSampleData().insight;
}

export const SAMPLE_INSIGHT_FALLBACK =
  "We analyzed your last 30 trades — your average winner is 1.4× your average loser, which is a real edge to protect.";
