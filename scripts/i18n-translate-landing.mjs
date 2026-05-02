import OpenAI from "openai";
import fs from "node:fs/promises";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const newEnLanding = {
  heroTag1: "Stop Revenge Trading",
  heroTag2: "Pass Prop Challenges",
  heroTag3: "Follow Your Rules",
  heroTag4: "Track Drawdown Live",

  bannerSpotsLeft: "Only {{count}} founding spots left — almost gone",
  bannerSpotsFilling: "{{count}} founding spots remaining — filling fast",
  bannerSpotsNormal: "Founding Member Program · {{count}} of {{total}} spots remaining",
  bannerClaimYours: "Claim yours →",
  bannerDismiss: "Dismiss",

  bottomCriticalLabel: "Almost Gone — Last Spots",
  bottomUrgentLabel: "Filling Fast",
  bottomNormalLabel: "Founding Member Program",
  bottomFullSubtitle: "All 500 founding spots have been claimed.",
  bottomNormalSubtitle: "1 month free Pro · 30% lifetime discount · Limited to 500 members",
  bottomWithCountSubtitle: "1 month free Pro · 30% lifetime discount · {{count}} of {{total}} spots remaining",
  bottomCTACreate: "Create Account",
  bottomCTAClaim: "Claim Your Spot",

  dashLabel: "TradifyApp Dashboard",
  dashBalance: "Balance",
  dashWinRate: "Win Rate",
  dashRuleCompliance: "Rule Compliance",
  dashMaxDrawdown: "Max Drawdown",
  dashTrades: "78 trades",
  dashViolations: "3 violations",
  dashOfLimit: "of 10% limit",
  dashEquityCurve: "Equity Curve",
  dashPropChallenge: "Prop Challenge",
  dashProfitTarget: "Profit Target",
  dashDrawdownUsed: "Drawdown Used",
  dashConsistency: "Consistency",
  dashDaysLeft: "Days Left",

  stat1Label: "Prop Firm Failure Rate",
  stat1Source: "FTMO Transparency Report",
  stat2Label: "Traders Break Their Own Rules",
  stat2Source: "Steenbarger, Trading Psychology 2.0",
  stat3Label: "More Likely to Overtrade After a Loss",
  stat3Source: "Douglas, Trading in the Zone",
  stat4Label: "Of Losses Come From Rule Violations",
  stat4Source: "Journal of Behavioral Finance",

  soundFamiliarSub: "Every trader hits these walls. TradifyApp was built to break through them.",

  leadMagnetFreeDownloadBadge: "Free Download",
  leadMagnetTitleLine1: "Get the Free",
  leadMagnetTitleLine2: "Pre-Trade Checklist",
  leadMagnetDesc: "The same checklist disciplined traders use before every single trade. Print it, pin it to your monitor, and stop making impulsive entries.",
  leadMagnetItem1: "HTF bias confirmation with rule enforcement check",
  leadMagnetItem2: "Drawdown status vs current prop firm limit",
  leadMagnetItem3: "Behavioral discipline trigger review",
  leadMagnetItem4: "Emotional readiness audit",
  leadMagnetMore: "+ 20 more items — enter email to unlock",
  leadMagnetEnterEmail: "Enter Your Email",
  leadMagnetNoSpam: "Get instant access — no spam, ever.",
  leadMagnetReady: "Checklist ready!",
  leadMagnetView: "View & Print Checklist",
  leadMagnetEmailPlaceholder: "your@email.com",
  leadMagnetGetButton: "Get Free Checklist",

  comparisonH2Pre: "Why traders choose",
  comparisonH2Highlight: "TradifyApp",
  comparisonH2Post: "over the alternatives",
  comparisonSub: "See how TradifyApp compares to the most popular trading journals.",
  comparisonFeatureCol: "Feature",
  comparisonPartialLabel: "Partial",
  comparisonRow1: "MT5 Auto-Sync (Real-Time)",
  comparisonRow2: "Prop Firm Challenge Tracking",
  comparisonRow3: "Pre-Trade Rule Enforcement",
  comparisonRow4: "AI Behavioral Analysis",
  comparisonRow5: "Psychology & Mood Tracking",
  comparisonRow6: "Education Hub (Structured)",
  comparisonRow7: "Free Plan Available",
  comparisonRow8: "Starting Price",
  comparisonFreeText: "Free",
  comparisonNote: "Comparison based on publicly available feature lists as of 2026. Features may change.",

  stepsH2Pre: "Ready in",
  stepsH2Highlight: "3 Steps",
  stepsSub: "No complex setup. No broker credentials shared. Just connect and start tracking.",
  step1Title: "Create Account",
  step1Body: "Sign up free in 30 seconds. No credit card required. Pick your plan later.",
  step1Mockup: "Start Free",
  step2Title: "Connect MT5",
  step2Body: "Install our free Expert Advisor on MT5. It reads your trades automatically - read-only, no broker access needed.",
  step2MockupConnected: "EA Connected",
  step2MockupAccount: "Account",
  step2MockupStatus: "Status",
  step2MockupSyncing: "Syncing...",
  step2MockupTradesImported: "78 imported",
  step2MockupTradesLabel: "Trades",
  step3Title: "Trade & Track",
  step3Body: "Every trade auto-syncs. Set your rules. Track your prop firm. Watch your discipline improve.",
  step3MockupEquity: "Equity",

  featuresH2Pre: "Every Problem.",
  featuresH2Highlight: "Solved.",
  featuresSub: "Real trader problems. Real solutions. No fluff.",
  feat_lazy_q: "Too lazy to journal?",
  feat_lazy_t: "Auto-Sync Trade Journal",
  feat_lazy_d: "MT5 syncs every trade instantly across multiple accounts. Import from any platform via CSV. Zero manual entry, zero excuses.",
  feat_rules_q: "Keep breaking your rules?",
  feat_rules_t: "Strategy Validation",
  feat_rules_d: "Define your rules once. Every trade gets validated against them before entry. Pure accountability — no signals, no opinions.",
  feat_dd_q: "Lost track of drawdown?",
  feat_dd_t: "Prop Firm Challenge Tracker",
  feat_dd_d: "Real-time gauges for drawdown limits, profit targets, and consistency scores. FTMO, MFF presets or custom configs. Never fail from a preventable mistake.",
  feat_revenge_q: "Revenge trading again?",
  feat_revenge_t: "Behavioral Risk Flags",
  feat_revenge_d: "AI detects revenge trading, overtrading, and tilt patterns before they damage your account. Get flagged before you blow up, not after.",
  feat_size_q: "Guessing your position size?",
  feat_size_t: "Risk & Position Calculators",
  feat_size_d: "Pre-trade risk calculations aligned with your challenge rules and strategy. Know your exact risk before every trade.",
  feat_when_q: "No idea when you trade best?",
  feat_when_t: "Session & Time Analytics",
  feat_when_d: "Discover your best sessions, days, and hours. Stop trading during your worst times and double down on what works.",
  feat_what_q: "Don't know what's actually working?",
  feat_what_t: "AI Performance Intelligence",
  feat_what_d: "AI analyzes your results by instrument, finds your real edge, and shows equity curves, profit factors, and expectancy in one view.",
  feat_emo_q: "Trading on emotion?",
  feat_emo_t: "Psychology & Mood Tracking",
  feat_emo_d: "Tag every trade with your emotional state and mistake category. See exactly how your psychology is costing you money.",
  feat_blow_q: "About to blow your challenge?",
  feat_blow_t: "AI Challenge Risk Warnings",
  feat_blow_d: "Before you place a trade, check it against your active challenge rules. Get safer stop-loss suggestions and avoid catastrophic losses.",
  feat_start_q: "Don't know where to start?",
  feat_start_t: "Education Hub",
  feat_start_d: "19 structured lessons across 8 phases. Go from gambler to systematic trader with quizzes, strategy builders, and risk management fundamentals.",
  tierProBadge: "Pro",
  tierEliteBadge: "Elite",
  tier3FreeBadge: "3 Free",

  propSpotlightBadge: "Pro + Elite Feature",
  propSpotlightH2Pre: "Never Fail a",
  propSpotlightH2Highlight: "Prop Firm Challenge",
  propSpotlightH2Post: "Again",
  propSpotlightDesc: "Most traders fail prop firm challenges because they lose track of their drawdown limits. TradifyApp monitors every rule in real time so you always know exactly where you stand.",
  propSpotlightItem1: "FTMO, MyFundedFX, The Funded Trader presets + custom configs",
  propSpotlightItem2: "Real-time profit target & drawdown gauges with visual progress",
  propSpotlightItem3: "Trailing drawdown with high water mark tracking",
  propSpotlightItem4: "Consistency scoring and days remaining countdown",
  propSpotlightItem5: "MT5 auto-sync for automated daily stats logging",
  propSpotlightItem6: "AI risk check: analyze trade impact before you enter (Elite)",
  propSpotlightCardLabel: "Prop Firm Challenge",
  propSpotlightCardAccount: "$100,000 Account",
  propSpotlightCardActive: "Active",

  testimonialsH2Pre: "What Traders Are",
  testimonialsH2Highlight: "Saying",
  testimonialsSub: "Early feedback from traders using TradifyApp to enforce their discipline.",
  test1Name: "Alex M.",
  test1Title: "FTMO Trader",
  test1Quote: "I failed 3 FTMO challenges before TradifyApp. The real-time drawdown tracking alone saved me — I always know exactly how much room I have left. Passed Phase 1 on my next attempt.",
  test1Badge: "Passed $100K FTMO Phase 1",
  test2Name: "Sarah K.",
  test2Title: "Funded Trader",
  test2Quote: "I knew my rules worked but kept breaking them under pressure. The pre-trade validation forces me to slow down and follow my plan. My consistency score went from 60% to 91% in one month.",
  test2Badge: "91% Consistency Score",
  test3Name: "James R.",
  test3Title: "Prop Firm Challenger",
  test3Quote: "The psychology tracking changed everything. I could finally see the pattern — I was revenge trading every Monday after weekend gaps. Once I saw the data, I stopped doing it.",
  test3Badge: "Eliminated Revenge Trading",

  calcFreeToolBadge: "Free Tool",
  calcH2Line1: "Prop Firm Challenge",
  calcH2Line2: "Calculator",
  calcDesc: "Find out exactly what you need to pass your prop firm challenge. Enter your numbers below.",
  calcChallengeDetails: "Your Challenge Details",
  calcAccountSizeLabel: "Account Size ($)",
  calcMaxDrawdownLabel: "Max Drawdown (%)",
  calcProfitTargetLabel: "Profit Target (%)",
  calcYourNumbers: "Your Numbers",
  calcRowMaxDDAmount: "Max Drawdown Amount",
  calcRowProfitTarget: "Profit Target Amount",
  calcRowSuggestedRisk: "Suggested Risk/Trade (2% of DD)",
  calcRowMinWinRate: "Min Win Rate Required (at 2R)",
  calcRowEstTrades: "Est. Trades Needed",
  calcRowDailyPL: "Daily P&L Target (22 days)",
  calcRowTradesUnit: "trades",
  calcRowDayUnit: "/day",
  calcDifficultyLabel: "Difficulty Score",
  calcDiffAchievable: "Achievable",
  calcDiffModerate: "Moderate",
  calcDiffAggressive: "Aggressive",
  calcDiffVeryHard: "Very Hard",
  calcUnlockTitle: "Unlock Your Results",
  calcUnlockSub: "Enter your email below",
  calcUnlocked: "Results unlocked!",
  calcCtaSignup: "TradifyApp Tracks These Metrics Automatically. Start Free →",
  calcEnterEmailUnlock: "Enter your email to unlock results",
  calcUnlockButton: "Unlock",
  calcEnterDetails: "Enter your challenge details to see your numbers",

  industryH2Pre: "The Problem Is",
  industryH2Highlight: "Clear",
  industrySub: "The trading industry has a discipline crisis. These numbers explain why most traders never become consistent — and why TradifyApp exists.",
  ind1Stat: "80%+",
  ind1Label: "Prop Firm Failure Rate",
  ind1Desc: "The vast majority of traders fail prop firm challenges — not from bad strategy, but from untracked drawdowns and broken rules.",
  ind1Source: "FTMO Transparency Report",
  ind2Stat: "92%",
  ind2Label: "Break Their Own Rules",
  ind2Desc: "Nearly all traders have rules they know work. The problem isn't knowledge — it's enforcement. Without accountability, discipline collapses under pressure.",
  ind2Source: "Steenbarger, Trading Psychology 2.0",
  ind3Stat: "3x",
  ind3Label: "More Likely to Overtrade After a Loss",
  ind3Desc: "Revenge trading is the most expensive habit in the market. Traders triple their position frequency after losses, compounding damage.",
  ind3Source: "Douglas, Trading in the Zone",
  industrySolveBadge: "Built to Solve This",
  industrySolveH3Pre: "Real Capabilities.",
  industrySolveH3Highlight: "Real Discipline.",
  industrySolveDesc: "TradifyApp doesn't promise overnight results. It gives you the systems and enforcement tools that professional traders rely on — so every trade has a reason, every rule is tracked, and every mistake becomes visible.",
  industrySolveItem1: "Real-time drawdown monitoring across multiple MT5 accounts",
  industrySolveItem2: "Pre-trade rule validation — no trade logged without a setup",
  industrySolveItem3: "AI behavioral detection catches revenge trading patterns",
  industrySolveItem4: "Prop firm challenge tracking with FTMO, MFF & custom presets",
  industrySolveItem5: "19-lesson education curriculum built on discipline, not signals",
  industrySolveCTA: "Become a Founding Member",
  ssDashboard: "Dashboard",
  ssPropTracker: "Prop Tracker",
  ssRulesJournal: "Rules & Journal",
  ssAnalytics: "Analytics",
  sourceLabel: "Source",

  whyH2Pre: "How It",
  whyH2Highlight: "Actually Works",
  whySub: "TradifyApp isn't a trade logger. It's a discipline enforcement system. Every feature exists to solve one problem: the gap between knowing your rules and actually following them.",
  whyTitle1: "You Break Rules Under Pressure",
  whyBody1: "You know your rules. You wrote them. But when the market moves against you, pressure overrides logic and you enter trades that violate your own plan. TradifyApp forces you to validate every trade against your strategy rules before it's logged. Maximum risk per trade, required confirmations, session restrictions, instrument limits — you define them, TradifyApp enforces them. No exceptions. No \"just this once.\"",
  whyTitle2: "You Skip Journaling Because It's Tedious",
  whyBody2: "You know you should journal. You've tried spreadsheets. But after the third day of copy-pasting trades from MT5, you stopped. TradifyApp eliminates manual entry entirely. Install a free Expert Advisor once, and every trade from every connected account flows into your dashboard in real time. No copy-pasting. No missed trades. No excuses. The EA is strictly read-only — it never touches your broker credentials or places orders.",
  whyTitle3: "You Don't Know Why You're Losing",
  whyBody3: "You look at your P&L and see red, but you don't know if it's your strategy, your timing, or your emotions causing the damage. TradifyApp's AI breaks down your performance by instrument, session, time of day, and behavioral patterns. It shows you which pairs actually make you money, when you trade best, and exactly where your discipline breaks down. No signals, no predictions — just the uncomfortable truth about your own execution.",
  whyTitle4: "You Learned Trading From Random YouTube Videos",
  whyBody4: "Scattered indicator tutorials and \"secret strategy\" videos don't build real traders. TradifyApp includes 19 structured lessons across 8 progressive phases that teach what actually matters: market structure, risk management, position sizing, trading psychology, and system building. Each lesson includes quizzes to test understanding. The goal isn't to give you a strategy — it's to teach you how to build, test, and execute your own.",
  whyCard1Title: "Psychology Tracking",
  whyCard1Body: "Every trade captures your emotional state, confidence level, and mistake categories. Over weeks and months, this data reveals the psychological patterns behind your wins and losses — helping you recognize and correct emotional trading before it costs you money.",
  whyCard2Title: "Pre-Trade Risk Calculators",
  whyCard2Body: "Calculate your position size, risk-reward ratio, and potential impact on your prop firm challenge before entering any trade. These aren't generic calculators — they integrate with your active challenge rules to show you exactly how much risk you're taking relative to your remaining drawdown allowance.",
  whyCard3Title: "Universal Trade Import",
  whyCard3Body: "Not on MT5? No problem. Import trades from MT4, TradingView, cTrader, or any platform via CSV with automatic column detection. TradifyApp maps your data intelligently so you can start analyzing your performance immediately, regardless of which broker or platform you use.",

  guideBadge: "Educational Guide",
  guideH2Pre: "How TradifyApp Helps You",
  guideH2Highlight: "Pass Your Prop Firm Challenge",
  guideSub: "Over 80% of traders fail their first prop firm challenge. The #1 reason isn't bad trading — it's poor risk management and losing track of challenge rules. Here's how TradifyApp changes that.",
  guideStep1Title: "Know Your Numbers at All Times",
  guideStep1Body: "The moment you connect your MT5 account and set up your challenge parameters, TradifyApp begins tracking every metric that matters: current drawdown vs. maximum allowed, profit progress toward your target, daily loss limits, and trading day count. These aren't delayed calculations — they update in real time as your trades sync. Most traders who fail challenges don't even realize they're close to their drawdown limit until it's too late. TradifyApp makes it impossible to lose track.",
  guideStep2Title: "Pre-Trade Risk Assessment",
  guideStep2Body: "Before you place a trade, TradifyApp's risk calculators show you exactly how that position will impact your challenge. If you're running an FTMO $100K challenge with a 10% max drawdown and you've already used 6%, the calculator will show you that a 2-lot EUR/USD position with a 50-pip stop loss would use 1% of your remaining buffer. Elite users get AI-powered risk warnings that analyze whether the trade is worth taking given your current challenge status, and suggest safer stop loss levels when your remaining margin is thin.",
  guideStep3Title: "Catch Behavioral Red Flags Early",
  guideStep3Body: "The biggest threat to your prop firm challenge isn't the market — it's your own behavior under pressure. TradifyApp's behavioral analysis detects revenge trading patterns (entering trades immediately after a loss), overtrading (exceeding your planned number of daily trades), and emotional decision-making (trading outside your defined sessions or instruments). These flags appear before the damage is done, giving you the awareness to step away and protect your challenge. Elite users get AI-generated behavioral risk reports that quantify exactly how much these patterns are costing them.",
  guideStep4Title: "Build Consistency That Firms Reward",
  guideStep4Body: "Most prop firms don't just want profit — they want consistent profit. A trader who makes 8% in one day and nothing for the rest of the month will often fail consistency requirements. TradifyApp tracks your consistency score across your challenge, showing you how evenly distributed your profits are across trading days. It also monitors your lot size consistency, session adherence, and strategy compliance — all factors that prop firms evaluate. By the time you pass your challenge, you'll have built the systematic habits that make you a profitable funded trader, not just someone who got lucky.",
  guideCTA: "Learn More About Prop Firm Tracking",

  fmEarlyBadge: "Early Access - Limited Spots Remaining",
  fmH2Pre: "Become a",
  fmH2Highlight: "Founding Member",
  fmDesc: "Join the first wave of TradifyApp traders and lock in benefits that will never be offered again. Founding members get permanent privileges and shape the future of the platform.",
  fmSpotsRemaining: "{{count}} of {{total}} founding spots remaining",
  fmBenefit1Title: "1 Month Free",
  fmBenefit1Desc: "Full Pro access at zero cost",
  fmBenefit2Title: "30% Off Forever",
  fmBenefit2Desc: "Permanent lifetime discount",
  fmBenefit3Title: "Feature Influence",
  fmBenefit3Desc: "Vote on what gets built next",
  fmBenefit4Title: "Founding Badge",
  fmBenefit4Desc: "Exclusive crown badge forever",
  fmCTA: "Claim Your Founding Member Spot",
  fmCTASub: "This offer disappears once we reach capacity",

  trustH2Pre: "Your Data is",
  trustH2Highlight: "Safe",
  trustItem1: "No broker credentials stored",
  trustItem2: "Read-only trade data",
  trustItem3: "No signals, no execution",
  trustItem4: "Email verified accounts",
  trustFooter: "TradifyApp operates on a zero-trust architecture. We never access your funds, never provide investment advice, and never execute trades on your behalf. Our mission is to give you the analytics and discipline tools to master your own execution.",

  ctaFinalH2Line1: "Your next trade",
  ctaFinalH2Line2: "deserves a system.",
  ctaFinalDesc: "Every winning trader has a process. TradifyApp is yours. Start free, upgrade when you're ready, and never look at a spreadsheet again.",
  ctaFinalStartFree: "Start Free Now",
  ctaFinalCompare: "Compare Plans",
  ctaFinalFreeLabel: "FREE",
  ctaFinalFreeSub: "Core Tools",
  ctaFinalProLabel: "PRO",
  ctaFinalProSub: "From $29/mo",
  ctaFinalEliteLabel: "ELITE",
  ctaFinalEliteSub: "From $59/mo",
  ctaFinalMostPopular: "Most Popular",
  ctaFinalFreeItem1: "MT5 Multi-Account Sync",
  ctaFinalFreeItem2: "Trade Journal (30 Days)",
  ctaFinalFreeItem3: "Psychology & Mood Tracking",
  ctaFinalFreeItem4: "CSV Trade Import",
  ctaFinalFreeItem5: "3 Education Lessons",
  ctaFinalProItem1: "AI Psychology Review",
  ctaFinalProItem2: "AI Instrument Analysis",
  ctaFinalProItem3: "Full Education Hub",
  ctaFinalProItem4: "Prop Firm Tracker",
  ctaFinalProItem5: "PDF & CSV Export",
  ctaFinalEliteItem1: "AI Challenge Risk Warnings",
  ctaFinalEliteItem2: "Session Analytics",
  ctaFinalEliteItem3: "Behavioral Risk Flags",
  ctaFinalEliteItem4: "Strategy Deviation Analysis",
  ctaFinalEliteItem5: "Monthly AI Review",

  notForYouButForYouBadge: "But it is for you if...",
  notForYouButForYouBody: "You have a trading approach you believe in — and you know the gap between your strategy and your results is your own behavior. You're ready to track it, face it, and fix it.",

  faqH2Pre: "Frequently Asked",
  faqH2Highlight: "Questions",
  faqSub: "Everything you need to know before getting started.",
  faq1q: "Is TradifyApp free to use?",
  faq1a: "Yes! TradifyApp has a free forever plan that includes MT5 multi-account sync, trade journal with 30-day history, psychology tracking, CSV import, risk calculators, and 3 education lessons. No credit card required.",
  faq2q: "Does TradifyApp place trades or access my broker?",
  faq2a: "No. TradifyApp is strictly read-only. We never access your broker credentials, place trades, or modify orders. Our MT5 Expert Advisor only reads your trade data — nothing else.",
  faq3q: "How does the MT5 auto-sync work?",
  faq3a: "You install a free Expert Advisor (EA) on your MetaTrader 5 platform. It runs in the background and automatically sends your trade data to TradifyApp in real time. It takes about 2 minutes to set up.",
  faq4q: "Can I track multiple MT5 accounts?",
  faq4a: "Yes! TradifyApp supports multi-account connectivity. You can connect and independently track trades, equity, and analytics for each of your MT5 accounts from one dashboard.",
  faq5q: "What is the Prop Firm Challenge Tracker?",
  faq5a: "It's a tool that monitors your prop firm challenge rules in real time — profit targets, drawdown limits, consistency scores, and days remaining. Supports FTMO, MyFundedFX, The Funded Trader, and custom configurations.",
  faq6q: "What's the difference between Pro and Elite?",
  faq6a: "Pro includes AI instrument analysis, prop firm tracker, full education hub, and psychology review. Elite adds session analytics, behavioral risk flags, AI challenge risk warnings, strategy deviation analysis, and monthly AI review reports.",
  faq7q: "What is the Founding Member program?",
  faq7a: "Founding Members are early adopters who get 1 month of free Pro access, a permanent 30% lifetime discount on all plans, feature voting rights, and an exclusive crown badge. This offer is limited and won't be available once we reach capacity.",
  faq8q: "Can I cancel my subscription anytime?",
  faq8a: "Yes, you can cancel your Pro or Elite subscription at any time. You'll continue to have access until the end of your billing period, then you'll be downgraded to the free plan.",
  faq9q: "What is a trading journal and why do I need one?",
  faq9a: "A trading journal is a structured record of every trade you take, including entry/exit prices, position sizes, emotions, and rule compliance. It helps you identify patterns in your behavior, track your edge over time, and build the discipline needed for consistent profitability. Without a journal, you're trading blind — repeating mistakes without ever knowing what's actually working.",
  faq10q: "How do I track drawdown in prop firm challenges?",
  faq10a: "TradifyApp's Prop Firm Challenge Tracker monitors your drawdown in real time by syncing directly with your MT5 account. It calculates both daily and overall drawdown against your challenge rules, tracks trailing drawdown with high water mark, and shows visual gauges so you always know exactly how much room you have left. You can set up presets for FTMO, MyFundedFX, The Funded Trader, or create custom configurations.",
  faq11q: "Can I use TradifyApp with multiple MT5 accounts?",
  faq11a: "Yes, TradifyApp supports unlimited MT5 account connections. You can track personal accounts, prop firm challenge accounts, and funded accounts all from one dashboard. Each account syncs independently with its own analytics, equity curve, and trade history. This is available on all plans including the free tier.",
  faq12q: "What makes TradifyApp different from other trading journals?",
  faq12a: "TradifyApp is built specifically for disciplined trading, not just trade logging. Unlike generic journals, it enforces your trading rules before you can enter a trade, auto-syncs from MT5 so you never miss a trade, tracks prop firm challenge rules in real time, and includes a structured education hub with 19 lessons. It's designed to change your trading behavior, not just record it.",
  faq13q: "Is my trading data secure with TradifyApp?",
  faq13a: "Absolutely. TradifyApp operates on a zero-trust security model. We never store your broker credentials, never access your funds, and never execute trades on your behalf. Our MT5 Expert Advisor is strictly read-only — it only reads trade data from your terminal. Your account is protected with email verification and encrypted data storage.",
  faq14q: "How does TradifyApp help me become a more disciplined trader?",
  faq14a: "TradifyApp enforces discipline through three mechanisms: rule validation that requires you to log your setup and confirm rule compliance before entering trades, psychology tracking that records your emotional state and identifies patterns like revenge trading or overtrading, and a structured education hub that teaches systematic trading from the ground up. The AI-powered analytics then show you exactly where discipline breaks down in your trading.",
  faq15q: "Who is TradifyApp best for?",
  faq15a: "TradifyApp is designed for MT5 traders who want to improve their discipline — especially prop firm challenge traders, day traders, and swing traders. Whether you're trying to pass an FTMO challenge, track drawdown on a funded account, or simply stop breaking your own rules, TradifyApp gives you the enforcement tools and analytics to trade consistently.",
  faq16q: "Is TradifyApp useful for discretionary traders?",
  faq16a: "Absolutely. TradifyApp doesn't impose a fixed strategy — it enforces YOUR rules, whatever they are. You define your own entry criteria, risk limits, session restrictions, and instrument rules. The platform validates each trade against your personal plan, making it ideal for discretionary traders who have a system but struggle to follow it under pressure.",
  faq17q: "Does TradifyApp work with prop firm challenges?",
  faq17a: "Yes — prop firm challenge tracking is one of TradifyApp's core features. It monitors your profit target progress, daily and overall drawdown, trailing drawdown with high water mark, consistency score, and days remaining in real time. It includes presets for FTMO, MyFundedFX, The Funded Trader, and supports fully custom challenge configurations.",
  faq18q: "How is TradifyApp different from TraderSync or Edgewonk?",
  faq18a: "TradifyApp is built around discipline enforcement, not just trade logging. Unlike TraderSync or Edgewonk, TradifyApp enforces your rules before trades are logged (pre-trade validation), auto-syncs from MT5 in real time so you never miss a trade, includes dedicated prop firm challenge tracking with live drawdown gauges, and offers AI-powered behavioral analysis that detects revenge trading and overtrading patterns. It also includes a structured 19-lesson education hub and a free forever plan.",

  footerProduct: "Product",
  footerSolutions: "Solutions",
  footerCompany: "Company",
  footerLegal: "Legal",
  footerFeatures: "Features",
  footerPricing: "Pricing",
  footerHowItWorks: "How It Works",
  footerResources: "Resources",
  footerEarlyAccess: "Early Access",
  footerTradingJournal: "Trading Journal",
  footerPropFirmTracker: "Prop Firm Tracker",
  footerMT5Analytics: "MT5 Analytics",
  footerBlog: "Blog",
  footerAbout: "About",
  footerContactUs: "Contact Us",
  footerTerms: "Terms of Service",
  footerPrivacy: "Privacy Policy",
  footerRisk: "Risk Disclaimer",
  footerCookie: "Cookie Policy",
  footerCopy: "© {{year}} TradifyApp Intelligence Systems. All Rights Reserved.",
};

const langMeta = {
  es: "Spanish (Spain)",
  fr: "French (France)",
  de: "German",
  zh: "Simplified Chinese",
  ar: "Arabic (Modern Standard, RTL)",
};

async function translateChunk(lang, payload, label) {
  const langName = langMeta[lang];
  const prompt = `You are a professional UI translator for a trading-discipline SaaS app called TradifyApp.
Translate the following English UI strings (${label}) into ${langName}.

CRITICAL RULES:
1. Return ONLY a JSON object with the EXACT same keys as input.
2. Keep proper nouns ("TradifyApp", "MT5", "MT4", "MetaTrader", "FTMO", "MyFundedFX", "The Funded Trader", "TraderSync", "Edgewonk", "TradeZella", "Tradervue", "TradingView", "cTrader", "AI", "P&L", "CSV", "EA", "EUR/USD", "Pro", "Elite", "FREE", "PRO", "ELITE", "Steenbarger", "Douglas", "Trading in the Zone", "Trading Psychology 2.0", "Journal of Behavioral Finance", "Sarah K.", "Alex M.", "James R.", "$100,000", "$100K", "$29/mo", "$59/mo", "30%", "10%", "8%", "6%") untranslated.
3. Preserve placeholders like {{count}}, {{total}}, {{year}} EXACTLY as written.
4. Preserve tone: serious, expert, no-fluff, financial.
5. Keep punctuation feel (em-dashes, ellipses, arrows like →) for the target language.
6. Short labels stay short. Do NOT add quotation marks around values.
7. Slashes / numerals / percentages stay as-is.
${lang === "ar" ? "8. Arabic must read naturally right-to-left and use Arabic punctuation (e.g. comma '،'). Numbers stay Western (Arabic-Indic optional but Western preferred for finance)." : ""}

Source JSON:
${JSON.stringify(payload, null, 2)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(completion.choices[0].message.content);
}

function chunkObject(obj, chunkSize) {
  const entries = Object.entries(obj);
  const chunks = [];
  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(Object.fromEntries(entries.slice(i, i + chunkSize)));
  }
  return chunks;
}

const langs = ["es", "fr", "de", "zh", "ar"];
const chunks = chunkObject(newEnLanding, 60);
console.log(`Translating landing.* additions (${Object.keys(newEnLanding).length} keys, ${chunks.length} chunks per lang)...`);

const allTranslations = {};
for (const lang of langs) allTranslations[lang] = {};

await Promise.all(
  langs.flatMap((lang) =>
    chunks.map(async (chunk, ci) => {
      const result = await translateChunk(lang, chunk, `landing chunk ${ci + 1}/${chunks.length}`);
      Object.assign(allTranslations[lang], result);
    })
  )
);

for (const lang of langs) {
  const missing = Object.keys(newEnLanding).filter((k) => !(k in allTranslations[lang]));
  console.log(`  landing ${lang}: ${Object.keys(allTranslations[lang]).length} keys, missing: ${missing.length}${missing.length ? " " + missing.slice(0, 5).join(",") : ""}`);
}

async function patchLocale(lang, addLanding) {
  const path = `client/src/locales/${lang}/common.json`;
  const json = JSON.parse(await fs.readFile(path, "utf8"));
  json.landing = { ...json.landing, ...addLanding };
  await fs.writeFile(path, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  wrote ${path}`);
}

await patchLocale("en", newEnLanding);
for (const lang of langs) {
  await patchLocale(lang, allTranslations[lang]);
}
console.log("Done.");
