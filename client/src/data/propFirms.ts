export interface PropFirmAccount {
  size: string;
  fee: string;
  profitTarget: string;
  maxDailyLoss: string;
  maxDrawdown: string;
  profitSplit: string;
}

export interface PropFirm {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  founded: string;
  headquarters: string;
  payoutFrequency: string;
  drawdownType: "static" | "trailing" | "either";
  consistencyRule: string;
  minTradingDays: string;
  maxTradingDays: string;
  newsTrading: "allowed" | "restricted" | "prohibited";
  weekendHolding: "allowed" | "restricted" | "prohibited";
  ea: "allowed" | "restricted" | "prohibited";
  copyTrading: "allowed" | "restricted" | "prohibited";
  platforms: string[];
  accounts: PropFirmAccount[];
  passRateNote: string;
  whyTradersFail: string[];
  howTradifyHelps: string[];
  competitors: string[];
}

export const propFirms: PropFirm[] = [
  {
    slug: "ftmo",
    name: "FTMO",
    shortName: "FTMO",
    tagline: "The original prop firm — strict but battle-tested.",
    founded: "2015",
    headquarters: "Prague, Czech Republic",
    payoutFrequency: "Bi-weekly (every 14 days from first trade)",
    drawdownType: "static",
    consistencyRule: "No single day can exceed 50% of total profit (in funded stage).",
    minTradingDays: "4 days (Challenge)",
    maxTradingDays: "30 days (Challenge), 60 days (Verification)",
    newsTrading: "allowed",
    weekendHolding: "allowed",
    ea: "allowed",
    copyTrading: "restricted",
    platforms: ["MT4", "MT5", "cTrader", "DXtrade"],
    accounts: [
      { size: "$10,000", fee: "$89", profitTarget: "10% / 5%", maxDailyLoss: "5%", maxDrawdown: "10%", profitSplit: "Up to 90%" },
      { size: "$25,000", fee: "$189", profitTarget: "10% / 5%", maxDailyLoss: "5%", maxDrawdown: "10%", profitSplit: "Up to 90%" },
      { size: "$50,000", fee: "$289", profitTarget: "10% / 5%", maxDailyLoss: "5%", maxDrawdown: "10%", profitSplit: "Up to 90%" },
      { size: "$100,000", fee: "$489", profitTarget: "10% / 5%", maxDailyLoss: "5%", maxDrawdown: "10%", profitSplit: "Up to 90%" },
      { size: "$200,000", fee: "$989", profitTarget: "10% / 5%", maxDailyLoss: "5%", maxDrawdown: "10%", profitSplit: "Up to 90%" },
    ],
    passRateNote: "Industry estimates put FTMO Challenge pass rates at ~10% and Verification (combined) at ~7%.",
    whyTradersFail: [
      "Breaching the 5% daily loss limit with a single oversized trade after a losing morning.",
      "Letting overnight swap or weekend gap moves push equity below the 10% max drawdown threshold.",
      "Concentrating profit in one home-run day, then breaching the consistency rule on payout.",
      "Switching strategies mid-Challenge after a drawdown, abandoning the plan that got them green.",
    ],
    howTradifyHelps: [
      "Live FTMO-preset Challenge tracker shows daily loss + max drawdown to the cent, with audible warnings before you breach.",
      "Consistency-rule meter that flags any day approaching 50% of total profit — before you take the next trade.",
      "Strategy Deviation alerts when you trade an instrument outside your declared plan during a Challenge.",
      "Pre-Trade Checklist forces a 30-second pause to confirm risk on every entry.",
    ],
    competitors: ["myfundedfx", "fundednext", "the-funded-trader", "topstep"],
  },
  {
    slug: "myfundedfx",
    name: "MyFundedFX (MFF)",
    shortName: "MFF",
    tagline: "Aggressive scaling and trader-friendly rules.",
    founded: "2022",
    headquarters: "Florida, USA",
    payoutFrequency: "On-demand after first profit (then 14-day cycles)",
    drawdownType: "either",
    consistencyRule: "30% consistency rule on best trading day vs total profit (1-step plans).",
    minTradingDays: "None on Lightning / Standard, 5 days on Rapid",
    maxTradingDays: "Unlimited on most plans",
    newsTrading: "allowed",
    weekendHolding: "restricted",
    ea: "allowed",
    copyTrading: "restricted",
    platforms: ["MT4", "MT5", "cTrader", "DXtrade", "Match-Trader"],
    accounts: [
      { size: "$10,000", fee: "$84", profitTarget: "8% (1-step)", maxDailyLoss: "4%", maxDrawdown: "6% trailing", profitSplit: "Up to 90%" },
      { size: "$25,000", fee: "$199", profitTarget: "8% (1-step)", maxDailyLoss: "4%", maxDrawdown: "6% trailing", profitSplit: "Up to 90%" },
      { size: "$50,000", fee: "$299", profitTarget: "8% (1-step)", maxDailyLoss: "4%", maxDrawdown: "6% trailing", profitSplit: "Up to 90%" },
      { size: "$100,000", fee: "$499", profitTarget: "8% (1-step)", maxDailyLoss: "4%", maxDrawdown: "6% trailing", profitSplit: "Up to 90%" },
      { size: "$200,000", fee: "$899", profitTarget: "8% (1-step)", maxDailyLoss: "4%", maxDrawdown: "6% trailing", profitSplit: "Up to 90%" },
    ],
    passRateNote: "MFF reports an above-average pass rate compared to legacy two-step firms, helped by the 1-step Lightning plan.",
    whyTradersFail: [
      "Misunderstanding the 6% trailing drawdown — it tracks the high water mark, not the start balance.",
      "Holding positions over the weekend on plans that prohibit it (instant breach Monday open).",
      "Hitting 30% consistency limit by stacking one massive day, then having no payout room.",
      "Closing the funded account too soon before the 14-day cycle resets, missing payout eligibility.",
    ],
    howTradifyHelps: [
      "MFF preset with a dedicated Trailing Drawdown gauge that updates live from your high water mark.",
      "Weekend-positions alert closes-out reminder every Friday at 22:00 broker time.",
      "Consistency tracker projects whether your current trade keeps you payout-eligible.",
      "Payout-window countdown widget on the dashboard.",
    ],
    competitors: ["ftmo", "fundednext", "the-funded-trader", "apex-trader-funding"],
  },
  {
    slug: "fundednext",
    name: "FundedNext",
    shortName: "FundedNext",
    tagline: "15% profit share before funding — the only one that pays during evaluation.",
    founded: "2022",
    headquarters: "UAE",
    payoutFrequency: "14-day on Stellar, 7-day on Express",
    drawdownType: "either",
    consistencyRule: "No single day above 40% of total profit on Stellar plans.",
    minTradingDays: "5 days (Stellar 2-step), 0 days (Express)",
    maxTradingDays: "Unlimited",
    newsTrading: "allowed",
    weekendHolding: "allowed",
    ea: "allowed",
    copyTrading: "restricted",
    platforms: ["MT4", "MT5", "cTrader"],
    accounts: [
      { size: "$6,000", fee: "$59", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "Up to 90% + 15% in eval" },
      { size: "$15,000", fee: "$99", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "Up to 90% + 15% in eval" },
      { size: "$25,000", fee: "$179", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "Up to 90% + 15% in eval" },
      { size: "$50,000", fee: "$269", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "Up to 90% + 15% in eval" },
      { size: "$100,000", fee: "$549", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "Up to 90% + 15% in eval" },
      { size: "$200,000", fee: "$1,099", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "Up to 90% + 15% in eval" },
    ],
    passRateNote: "FundedNext's 15% reward during evaluation makes it the most popular 'try-and-earn' option, but consistency rule still trips many traders at payout.",
    whyTradersFail: [
      "Mixing up Express (1-step, no min days) vs Stellar (2-step, 5 min days) rule sets.",
      "Banking the 15% evaluation reward but breaching consistency before reaching the 8% target.",
      "Daily loss is calculated on prev day balance + open floating P/L — many miss the floating leg.",
      "News-trading restrictions vary by plan; some traders get violations on NFP without realising.",
    ],
    howTradifyHelps: [
      "FundedNext preset with separate Stellar / Express rule sets — pick once and the tracker adapts.",
      "Floating-P/L-aware daily loss meter (matches FundedNext's exact calculation).",
      "Consistency projector tells you the maximum profit you can take today and still stay payout-eligible.",
      "AI risk warning before NFP / FOMC / CPI on plans where news trading is restricted.",
    ],
    competitors: ["ftmo", "myfundedfx", "the-funded-trader", "e8-funding"],
  },
  {
    slug: "the-funded-trader",
    name: "The Funded Trader",
    shortName: "TFT",
    tagline: "Trader-led firm with multiple challenge styles.",
    founded: "2021",
    headquarters: "Florida, USA",
    payoutFrequency: "14-day cycles, then on-demand after consistency",
    drawdownType: "either",
    consistencyRule: "20% of total profit on a single day in some plans.",
    minTradingDays: "3 days (Standard), 5 days (Rapid)",
    maxTradingDays: "Unlimited",
    newsTrading: "restricted",
    weekendHolding: "restricted",
    ea: "allowed",
    copyTrading: "restricted",
    platforms: ["MT4", "MT5", "DXtrade", "Match-Trader"],
    accounts: [
      { size: "$10,000", fee: "$99", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% trailing", profitSplit: "Up to 90%" },
      { size: "$25,000", fee: "$209", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% trailing", profitSplit: "Up to 90%" },
      { size: "$50,000", fee: "$309", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% trailing", profitSplit: "Up to 90%" },
      { size: "$100,000", fee: "$499", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% trailing", profitSplit: "Up to 90%" },
      { size: "$200,000", fee: "$999", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "10% trailing", profitSplit: "Up to 90%" },
    ],
    passRateNote: "TFT publishes a higher-than-average payout rate, but the news-trading restriction catches algo and breakout traders.",
    whyTradersFail: [
      "Trading 2 minutes before a high-impact news release (TFT's 5-minute window is strict).",
      "Holding positions through Friday close on plans that prohibit weekend exposure.",
      "Underestimating the 20% consistency rule when one good day skews the distribution.",
      "Using EAs that auto-close at exact times, missing the no-trade news window by seconds.",
    ],
    howTradifyHelps: [
      "TFT preset with built-in economic-calendar awareness — alerts you 6 minutes before any high-impact event.",
      "Friday close-out reminder + automatic weekend-exposure flag if any position is still open.",
      "Consistency rule projection updates after every fill.",
      "Strategy Deviation alerts catch unintended news-window entries.",
    ],
    competitors: ["ftmo", "myfundedfx", "fundednext", "topstep"],
  },
  {
    slug: "topstep",
    name: "Topstep",
    shortName: "Topstep",
    tagline: "The futures-focused prop firm — Combine, Express, and Live accounts.",
    founded: "2012",
    headquarters: "Chicago, USA",
    payoutFrequency: "On-demand after first 5 winning days, then unlimited",
    drawdownType: "trailing",
    consistencyRule: "Max position size based on Combine size; no soft consistency rule.",
    minTradingDays: "5 winning days for first payout",
    maxTradingDays: "Unlimited (subscription based)",
    newsTrading: "allowed",
    weekendHolding: "prohibited",
    ea: "restricted",
    copyTrading: "prohibited",
    platforms: ["TopstepX", "NinjaTrader", "TradingView", "Tradovate"],
    accounts: [
      { size: "$50,000 Combine", fee: "$49/mo", profitTarget: "$3,000", maxDailyLoss: "$1,000", maxDrawdown: "$2,000 trailing", profitSplit: "100% first $5,000, then 90%" },
      { size: "$100,000 Combine", fee: "$99/mo", profitTarget: "$6,000", maxDailyLoss: "$2,000", maxDrawdown: "$3,000 trailing", profitSplit: "100% first $5,000, then 90%" },
      { size: "$150,000 Combine", fee: "$149/mo", profitTarget: "$9,000", maxDailyLoss: "$3,000", maxDrawdown: "$4,500 trailing", profitSplit: "100% first $5,000, then 90%" },
    ],
    passRateNote: "Topstep's Combine to Funded conversion rate is around 8–12%; the trailing drawdown is the #1 reason for blow-ups.",
    whyTradersFail: [
      "Misreading the trailing drawdown — it locks at +$X profit and never trails back down to start equity.",
      "Holding micro futures over a weekend (auto-violation when the platform reopens Sunday).",
      "Oversizing on a Sunday open after a profitable week, breaching the daily loss limit on a single gap.",
      "Trying to scalp through ES news releases without slippage protection.",
    ],
    howTradifyHelps: [
      "Topstep preset with futures-aware drawdown math (handles tick value and contract multipliers correctly).",
      "Trailing-drawdown gauge that distinguishes the 'locks at start' vs 'continues to trail' phases.",
      "Auto-flag for any position open at 16:00 CT Friday on weekend-prohibited plans.",
      "AI risk warning when contract size exceeds your typical 90-day position size.",
    ],
    competitors: ["apex-trader-funding", "ftmo", "earn2trade"],
  },
  {
    slug: "apex-trader-funding",
    name: "Apex Trader Funding",
    shortName: "Apex",
    tagline: "Futures prop firm with up to 20 accounts and lifetime evaluations.",
    founded: "2021",
    headquarters: "North Carolina, USA",
    payoutFrequency: "8 payouts per month after qualification",
    drawdownType: "trailing",
    consistencyRule: "30% rule: largest day cannot exceed 30% of total profit at payout.",
    minTradingDays: "7 days for first payout, 5 days thereafter",
    maxTradingDays: "Unlimited (subscription based)",
    newsTrading: "allowed",
    weekendHolding: "prohibited",
    ea: "restricted",
    copyTrading: "prohibited",
    platforms: ["NinjaTrader", "Rithmic", "Tradovate", "TradingView"],
    accounts: [
      { size: "$25,000", fee: "$147/mo", profitTarget: "$1,500", maxDailyLoss: "n/a", maxDrawdown: "$1,500 trailing", profitSplit: "100% first $25,000, then 90%" },
      { size: "$50,000", fee: "$167/mo", profitTarget: "$3,000", maxDailyLoss: "n/a", maxDrawdown: "$2,500 trailing", profitSplit: "100% first $25,000, then 90%" },
      { size: "$100,000", fee: "$207/mo", profitTarget: "$6,000", maxDailyLoss: "n/a", maxDrawdown: "$3,000 trailing", profitSplit: "100% first $25,000, then 90%" },
      { size: "$150,000", fee: "$297/mo", profitTarget: "$9,000", maxDailyLoss: "n/a", maxDrawdown: "$5,000 trailing", profitSplit: "100% first $25,000, then 90%" },
      { size: "$250,000", fee: "$517/mo", profitTarget: "$15,000", maxDailyLoss: "n/a", maxDrawdown: "$6,500 trailing", profitSplit: "100% first $25,000, then 90%" },
      { size: "$300,000", fee: "$657/mo", profitTarget: "$20,000", maxDailyLoss: "n/a", maxDrawdown: "$7,500 trailing", profitSplit: "100% first $25,000, then 90%" },
    ],
    passRateNote: "Apex's 'no daily loss limit' attracts new traders, but the trailing drawdown plus 30% consistency rule eliminates ~85% of accounts.",
    whyTradersFail: [
      "Confusing 'no daily loss limit' with 'no risk' — the trailing drawdown can blow you out in one trade.",
      "Hitting profit target in one home-run day, then failing the 30% consistency rule on payout request.",
      "Running multiple accounts simultaneously and over-exposing to correlated futures.",
      "Forgetting Apex prohibits weekend exposure — Friday EOD breaches are silent killers.",
    ],
    howTradifyHelps: [
      "Apex preset with trailing drawdown math that mirrors the broker exactly.",
      "Consistency projector at every fill — see your '30% headroom' in real time.",
      "Multi-account aggregation: sees total exposure across all 20 Apex accounts you might run.",
      "Friday close-out alert at user-configurable time before market close.",
    ],
    competitors: ["topstep", "ftmo"],
  },
  {
    slug: "e8-funding",
    name: "E8 Funding",
    shortName: "E8",
    tagline: "European prop firm with flexible scaling.",
    founded: "2021",
    headquarters: "Texas, USA (originally Czechia)",
    payoutFrequency: "14-day cycle, on-demand after consistency",
    drawdownType: "static",
    consistencyRule: "Max single day cannot exceed 50% of total profit (Standard plan).",
    minTradingDays: "5 days",
    maxTradingDays: "Unlimited",
    newsTrading: "allowed",
    weekendHolding: "allowed",
    ea: "allowed",
    copyTrading: "restricted",
    platforms: ["MT4", "MT5"],
    accounts: [
      { size: "$25,000", fee: "$138", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "8% static", profitSplit: "Up to 90%" },
      { size: "$50,000", fee: "$238", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "8% static", profitSplit: "Up to 90%" },
      { size: "$100,000", fee: "$378", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "8% static", profitSplit: "Up to 90%" },
      { size: "$250,000", fee: "$998", profitTarget: "8% / 5%", maxDailyLoss: "5%", maxDrawdown: "8% static", profitSplit: "Up to 90%" },
    ],
    passRateNote: "E8's 8% static drawdown is friendlier than FTMO's 10% trailing for some strategies, but the 50% consistency rule is unforgiving.",
    whyTradersFail: [
      "Treating E8 like FTMO — drawdown is static (8%), not trailing — but consistency is much stricter.",
      "Banking one outsized winner, then failing payout because no other day can catch up to 50%.",
      "Account-management plan auto-closes profitable trades on rule edges.",
      "Missing the 5-day minimum on a hot start to the Challenge.",
    ],
    howTradifyHelps: [
      "E8 preset with static-drawdown math + 50% consistency projector.",
      "Trading-day counter so you never finish too early.",
      "Strategy Validator catches over-correlated entries that artificially inflate one day's P/L.",
    ],
    competitors: ["ftmo", "myfundedfx", "fundednext"],
  },
  {
    slug: "city-traders-imperium",
    name: "City Traders Imperium",
    shortName: "CTI",
    tagline: "London-based, futures + FX, longer-term focused.",
    founded: "2018",
    headquarters: "London, UK",
    payoutFrequency: "Monthly",
    drawdownType: "static",
    consistencyRule: "No single trade can risk more than 2% of account size.",
    minTradingDays: "10 days (Direct Funding), Challenge varies",
    maxTradingDays: "Unlimited",
    newsTrading: "restricted",
    weekendHolding: "allowed",
    ea: "restricted",
    copyTrading: "prohibited",
    platforms: ["MT4", "MT5"],
    accounts: [
      { size: "$10,000", fee: "$66", profitTarget: "10%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "50% scaling to 70%" },
      { size: "$25,000", fee: "$148", profitTarget: "10%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "50% scaling to 70%" },
      { size: "$50,000", fee: "$246", profitTarget: "10%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "50% scaling to 70%" },
      { size: "$100,000", fee: "$416", profitTarget: "10%", maxDailyLoss: "5%", maxDrawdown: "10% static", profitSplit: "50% scaling to 70%" },
    ],
    passRateNote: "CTI's longer-term style and 2% per-trade risk cap make it suit swing traders more than scalpers.",
    whyTradersFail: [
      "Risking more than 2% on a single trade, even if profitable — instant rule violation.",
      "Scalping news on plans where it's restricted.",
      "Missing the 10-day minimum trading-day requirement on Direct Funding.",
      "Using EAs that don't respect the 2% per-trade hard cap.",
    ],
    howTradifyHelps: [
      "CTI preset with hard 2% per-trade risk cap — pre-trade calculator refuses to recommend a size that breaches.",
      "10-day minimum tracker.",
      "News-window blocker for restricted-news plans.",
    ],
    competitors: ["ftmo", "fundednext", "the-funded-trader"],
  },
];

export const propFirmsBySlug: Record<string, PropFirm> = Object.fromEntries(
  propFirms.map((f) => [f.slug, f]),
);

export function getPropFirm(slug: string): PropFirm | undefined {
  return propFirmsBySlug[slug];
}
