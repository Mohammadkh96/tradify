export interface LessonSection {
  title: string;
  content: string[];
}

export interface Lesson {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  isFree: boolean;
  sections: LessonSection[];
  keyPoints: string[];
}

export interface LessonCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const LESSON_CATEGORIES: LessonCategory[] = [
  {
    id: "fundamentals",
    name: "Trading Fundamentals",
    description: "Essential concepts every trader must master",
    icon: "BookOpen",
  },
  {
    id: "price-action",
    name: "Price Action",
    description: "Reading charts and price movements like a pro",
    icon: "TrendingUp",
  },
  {
    id: "smart-money",
    name: "Smart Money Concepts",
    description: "Understanding institutional trading patterns",
    icon: "Brain",
  },
  {
    id: "strategies",
    name: "Trading Strategies",
    description: "Proven strategies for consistent profits",
    icon: "Target",
  },
  {
    id: "psychology",
    name: "Trading Psychology",
    description: "Master your mindset for trading success",
    icon: "Heart",
  },
  {
    id: "advanced",
    name: "Advanced Techniques",
    description: "Expert-level analysis and execution methods",
    icon: "Zap",
  },
];

export const EDUCATION_LESSONS: Lesson[] = [
  {
    id: 1,
    title: "4 Things I Wish I Knew When I Started Trading",
    description: "Essential wisdom for every new trader - the lessons that took years to learn, now available from day one.",
    category: "psychology",
    difficulty: "Beginner",
    duration: "15 min",
    isFree: true,
    sections: [
      {
        title: "Trade Small",
        content: [
          "Do not risk significant capital when you first start trading",
          "Focus on learning the skill, not making money",
          "Large losses early on cause emotional damage that affects future trading",
          "Small positions allow you to focus on process over outcome",
        ],
      },
      {
        title: "Trading Takes Time",
        content: [
          "Trading is a game of probability and needs a HUGE sample size",
          "Do not expect to become successful after just 2-3 months of trading",
          "It is an aggressive estimate at BEST to start seeing consistent results before 1 year",
          "Focus on learning and improving, not on getting rich quick",
        ],
      },
      {
        title: "No One Has All The Answers",
        content: [
          "Not every trade is going to go in your direction, the outcome of each trade is uncertain",
          "Despite what others may portray, nobody has a 100% win rate",
          "Focus on your own journey and improvement",
          "What works for someone else may not work for you",
        ],
      },
      {
        title: "Trading Is Boring",
        content: [
          "Most of your time will be spent waiting for setups and doing nothing",
          "Trading is like taking exams in school, but you get to pick the questions",
          "If you are patient enough to wait for the right opportunity, results will speak for themselves",
          "Discipline and patience beat excitement every time",
        ],
      },
    ],
    keyPoints: [
      "Start with small position sizes to focus on learning",
      "Expect at least 1 year before seeing consistent results",
      "No strategy works 100% of the time - accept uncertainty",
      "Patience and discipline are more important than excitement",
      "Focus on your own journey, not others' results",
    ],
  },
  {
    id: 2,
    title: "Trading with Price Action",
    description: "Master the art of reading raw price charts without indicators - understand what price is telling you.",
    category: "price-action",
    difficulty: "Beginner",
    duration: "25 min",
    isFree: true,
    sections: [
      {
        title: "What is Price Action?",
        content: [
          "Price action is the study of price movement without indicators",
          "All information is contained within the price itself",
          "Indicators are derivatives of price - they lag behind",
          "Price action reveals the battle between buyers and sellers in real-time",
        ],
      },
      {
        title: "How to Trade with Olampos Price Action",
        content: [
          "Identify the trend direction using swing highs and lows",
          "Wait for pullbacks to key levels before entering",
          "Use candlestick patterns at key levels for confirmation",
          "Set stops beyond structure, not at arbitrary levels",
        ],
      },
      {
        title: "Key Price Action Concepts",
        content: [
          "Support: Levels where buying pressure exceeds selling pressure",
          "Resistance: Levels where selling pressure exceeds buying pressure",
          "Trend: The overall direction of price movement (HH/HL or LH/LL)",
          "Range: When price consolidates between support and resistance",
        ],
      },
      {
        title: "Trading Range Breakouts",
        content: [
          "Ranges form when price consolidates - neither buyers nor sellers are in control",
          "Breakouts occur when one side finally wins the battle",
          "Wait for a close outside the range before trading the breakout",
          "False breakouts are common - use confirmation before entering",
        ],
      },
    ],
    keyPoints: [
      "Price action eliminates indicator lag",
      "All you need is price - no indicators required",
      "Identify trend using swing highs and lows",
      "Trade pullbacks to key levels, not breakouts",
      "Use candlestick confirmation at key levels",
    ],
  },
  {
    id: 3,
    title: "Smart Money Concepts Introduction",
    description: "Understand how institutional traders move markets and learn to trade alongside them, not against them.",
    category: "smart-money",
    difficulty: "Beginner",
    duration: "30 min",
    isFree: true,
    sections: [
      {
        title: "What Are Smart Money Concepts?",
        content: [
          "Smart Money refers to institutional traders: banks, hedge funds, large investors",
          "They have the capital to move markets and create trends",
          "Retail traders often trade against smart money and lose",
          "SMC teaches you to identify and follow institutional order flow",
        ],
      },
      {
        title: "The Accumulation-Manipulation-Distribution Cycle",
        content: [
          "ACCUMULATION: Institutions quietly build positions in a range",
          "MANIPULATION: Price is pushed against the intended direction to trap retail traders",
          "DISTRIBUTION: Institutions sell their positions as retail chases the move",
          "Understanding this cycle helps you trade with smart money, not against it",
        ],
      },
      {
        title: "Key SMC Concepts",
        content: [
          "Order Blocks: The last opposite candle before an impulsive move",
          "Fair Value Gaps: Imbalances in price where price moved too fast",
          "Liquidity: Areas where stop losses cluster (equal highs/lows)",
          "Break of Structure (BOS): Confirmation of trend continuation",
          "Change of Character (CHOCH): Warning of potential trend reversal",
        ],
      },
      {
        title: "Why Retail Traders Lose",
        content: [
          "Retail traders place stops at obvious levels - smart money hunts these",
          "Retail buys breakouts - smart money sells into this liquidity",
          "Retail uses lagging indicators - smart money reads order flow",
          "Understanding this dynamic is the first step to profitability",
        ],
      },
    ],
    keyPoints: [
      "Smart money (institutions) moves markets",
      "Accumulation → Manipulation → Distribution cycle",
      "Order blocks mark institutional entry points",
      "Fair value gaps are imbalances price tends to fill",
      "Liquidity sweeps trap retail before real moves",
    ],
  },
  {
    id: 4,
    title: "Intraday Open High Open Low Strategy",
    description: "A powerful intraday strategy based on opening price patterns used by professional day traders.",
    category: "strategies",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    sections: [
      {
        title: "What is Open High Open Low?",
        content: [
          "OHOL refers to candlestick patterns where Open equals High or Open equals Low",
          "Open = High (bearish): Price opened at the high and moved down all day",
          "Open = Low (bullish): Price opened at the low and moved up all day",
          "These patterns indicate strong directional intent from the market open",
        ],
      },
      {
        title: "How to Trade the Strategy",
        content: [
          "Wait for the first 15-30 minutes to establish the pattern",
          "If Open = High develops, look for short entries on pullbacks",
          "If Open = Low develops, look for long entries on pullbacks",
          "Set stops above/below the opening candle",
        ],
      },
      {
        title: "Best Practices",
        content: [
          "Works best on major indices and forex pairs",
          "Avoid trading during major news events",
          "Use the 5-minute or 15-minute chart for entries",
          "Target previous day high/low or key support/resistance levels",
        ],
      },
      {
        title: "Risk Management",
        content: [
          "Risk no more than 1% per trade",
          "Use a minimum 1:2 risk-reward ratio",
          "Exit if the pattern fails (price closes above high or below low)",
          "Take partial profits at 1:1 and trail the rest",
        ],
      },
    ],
    keyPoints: [
      "Open = High suggests bearish day",
      "Open = Low suggests bullish day",
      "Trade in direction of the opening pattern",
      "Enter on pullbacks, not at the open",
      "Stop loss beyond the opening candle",
    ],
  },
  {
    id: 5,
    title: "Market Structure Mastery",
    description: "Learn to read market structure like a professional - identify trends, reversals, and key turning points.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "40 min",
    isFree: false,
    sections: [
      {
        title: "Understanding Market Structure",
        content: [
          "Market structure is the foundation of technical analysis",
          "It shows you who is in control - buyers or sellers",
          "Structure is fractal - it repeats on all timeframes",
          "Higher timeframe structure overrides lower timeframe",
        ],
      },
      {
        title: "Uptrend Structure",
        content: [
          "Higher Highs (HH): Each peak is higher than the previous",
          "Higher Lows (HL): Each pullback holds above the previous low",
          "As long as HH and HL continue, the uptrend is intact",
          "A break below a Higher Low signals potential trend change",
        ],
      },
      {
        title: "Downtrend Structure",
        content: [
          "Lower Lows (LL): Each low is lower than the previous",
          "Lower Highs (LH): Each rally fails below the previous high",
          "As long as LL and LH continue, the downtrend is intact",
          "A break above a Lower High signals potential trend change",
        ],
      },
      {
        title: "Break of Structure (BOS) vs Change of Character (CHOCH)",
        content: [
          "BOS: A continuation break that confirms the current trend",
          "CHOCH: A reversal break that signals potential trend change",
          "BOS in uptrend = new Higher High made",
          "CHOCH in uptrend = price breaks below most recent Higher Low",
          "Always wait for confirmation before trading reversals",
        ],
      },
    ],
    keyPoints: [
      "Uptrend = Higher Highs + Higher Lows",
      "Downtrend = Lower Lows + Lower Highs",
      "BOS confirms trend continuation",
      "CHOCH warns of potential reversal",
      "HTF structure overrides LTF",
    ],
  },
  {
    id: 6,
    title: "Order Blocks Explained",
    description: "Master order block identification and trading - the institutional footprints that reveal where smart money enters.",
    category: "smart-money",
    difficulty: "Intermediate",
    duration: "45 min",
    isFree: false,
    sections: [
      {
        title: "What is an Order Block?",
        content: [
          "An order block is the last opposite candle before an impulsive move",
          "It represents the price level where institutions placed orders",
          "When price returns to this level, it often reacts",
          "Order blocks are like support/resistance but based on order flow",
        ],
      },
      {
        title: "Identifying Valid Order Blocks",
        content: [
          "Must lead to a Break of Structure or Change of Character",
          "The move away should be impulsive (strong momentum)",
          "Should create an imbalance or Fair Value Gap",
          "Located at premium/discount levels (above/below equilibrium)",
        ],
      },
      {
        title: "Trading Order Blocks",
        content: [
          "Wait for price to return to the order block zone",
          "Look for confirmation on lower timeframe before entering",
          "Set stop loss beyond the order block extreme",
          "Target the next liquidity pool or opposite order block",
        ],
      },
      {
        title: "Order Block Invalidation",
        content: [
          "An order block is invalidated if price closes through it",
          "Partial touches are fine - full closes through are not",
          "Invalidated OBs become new potential zones on the opposite side",
          "Never trade an invalidated order block",
        ],
      },
    ],
    keyPoints: [
      "Order block = last opposite candle before impulsive move",
      "Must lead to BOS or CHOCH to be valid",
      "Wait for price to return to the OB for entry",
      "Get LTF confirmation before entering",
      "Invalidated if price closes through the zone",
    ],
  },
  {
    id: 7,
    title: "Fair Value Gaps (FVG)",
    description: "Understand imbalances in price and how to trade the gaps that institutions create.",
    category: "smart-money",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    sections: [
      {
        title: "What is a Fair Value Gap?",
        content: [
          "A 3-candle pattern where the middle candle creates a gap",
          "The gap occurs between the high of candle 1 and low of candle 3 (or vice versa)",
          "It represents an imbalance where price moved too quickly",
          "Price tends to return and fill (or partially fill) these gaps",
        ],
      },
      {
        title: "Types of Fair Value Gaps",
        content: [
          "Bullish FVG: Gap between candle 1 high and candle 3 low (in an up move)",
          "Bearish FVG: Gap between candle 1 low and candle 3 high (in a down move)",
          "The size of the FVG indicates the strength of the move",
          "Larger FVGs suggest stronger institutional activity",
        ],
      },
      {
        title: "Trading Fair Value Gaps",
        content: [
          "Wait for price to return to the FVG zone",
          "The 50% level of the FVG is often the optimal entry point",
          "Combine with order blocks for higher probability setups",
          "Stop loss beyond the FVG or the order block that created it",
        ],
      },
      {
        title: "FVG Rules",
        content: [
          "Not all FVGs get filled - trend strength matters",
          "FVGs in the direction of the trend are more reliable",
          "Old FVGs lose their significance over time",
          "Use FVGs as confluence, not as standalone entries",
        ],
      },
    ],
    keyPoints: [
      "FVG = 3-candle imbalance where price moved too fast",
      "Price tends to revisit and fill these gaps",
      "50% of the FVG is often optimal entry point",
      "Combine with order blocks for confluence",
      "FVGs in trend direction are more reliable",
    ],
  },
  {
    id: 8,
    title: "Liquidity Concepts",
    description: "Master liquidity theory - understand where stops are placed and how institutions hunt them.",
    category: "smart-money",
    difficulty: "Advanced",
    duration: "50 min",
    isFree: false,
    sections: [
      {
        title: "What is Liquidity?",
        content: [
          "Liquidity in trading refers to pending orders in the market",
          "Stop losses are liquidity - they become market orders when triggered",
          "Institutions need liquidity to fill their large orders",
          "They often push price to liquidity pools before the real move",
        ],
      },
      {
        title: "Types of Liquidity",
        content: [
          "Buy-side liquidity: Stop losses from shorts (above highs)",
          "Sell-side liquidity: Stop losses from longs (below lows)",
          "Equal highs/lows: Obvious levels where retail places stops",
          "Trendline liquidity: Stops placed below/above trendlines",
        ],
      },
      {
        title: "Liquidity Sweeps",
        content: [
          "A sweep occurs when price takes out a liquidity pool and reverses",
          "This is how institutions fill orders and trap retail traders",
          "The sweep often creates a sharp wick (rejection candle)",
          "After a sweep, expect price to move in the opposite direction",
        ],
      },
      {
        title: "Trading Liquidity",
        content: [
          "Identify obvious liquidity pools (equal highs/lows, trendlines)",
          "Wait for price to sweep the liquidity",
          "Enter after the sweep when price shows reversal signs",
          "Target the opposite liquidity pool",
        ],
      },
    ],
    keyPoints: [
      "Liquidity = stop losses and pending orders",
      "Institutions need liquidity to fill large orders",
      "Equal highs/lows are obvious liquidity pools",
      "Sweeps trap retail before the real move",
      "Trade after the sweep, not before",
    ],
  },
  {
    id: 9,
    title: "Supply and Demand Zones",
    description: "Learn to identify and trade institutional supply and demand zones for high-probability setups.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "40 min",
    isFree: false,
    sections: [
      {
        title: "Understanding Supply and Demand",
        content: [
          "Supply zones: Areas where selling pressure exceeds buying pressure",
          "Demand zones: Areas where buying pressure exceeds selling pressure",
          "These zones form where institutions placed large orders",
          "Price often reacts when returning to these zones",
        ],
      },
      {
        title: "Zone Formation Patterns",
        content: [
          "RBR (Rally-Base-Rally): Demand zone in an uptrend",
          "DBD (Drop-Base-Drop): Supply zone in a downtrend",
          "RBD (Rally-Base-Drop): Supply zone at a top",
          "DBR (Drop-Base-Rally): Demand zone at a bottom",
        ],
      },
      {
        title: "Valid Zone Criteria",
        content: [
          "Strong impulsive exit from the zone (momentum)",
          "Minimal time spent in the base (quick accumulation)",
          "Fresh and untested (first return to the zone)",
          "Creates imbalance or breaks structure",
        ],
      },
      {
        title: "Zone Invalidation",
        content: [
          "Demand zone invalid if candle body closes below it",
          "Supply zone invalid if candle body closes above it",
          "Wicks through the zone are okay - bodies are not",
          "Once invalidated, do not trade the zone again",
        ],
      },
    ],
    keyPoints: [
      "Supply = selling pressure area",
      "Demand = buying pressure area",
      "RBR/DBD = continuation zones",
      "RBD/DBR = reversal zones",
      "Zone invalid if body closes through it",
    ],
  },
  {
    id: 10,
    title: "Candlestick Psychology",
    description: "Understand the psychology behind candlestick patterns - what each candle tells you about buyer/seller dynamics.",
    category: "price-action",
    difficulty: "Beginner",
    duration: "30 min",
    isFree: false,
    sections: [
      {
        title: "Reading Candlestick Bodies",
        content: [
          "Large body = strong momentum in that direction",
          "Small body = indecision or absorption",
          "Bullish body (green/white) = buyers in control",
          "Bearish body (red/black) = sellers in control",
        ],
      },
      {
        title: "Reading Candlestick Wicks",
        content: [
          "Long upper wick = rejection of higher prices",
          "Long lower wick = rejection of lower prices",
          "No wicks = pure momentum, no rejection",
          "Wick length relative to body matters",
        ],
      },
      {
        title: "Key Reversal Patterns",
        content: [
          "Pin bar / Hammer: Long wick, small body - rejection of prices",
          "Engulfing: Current candle completely engulfs previous - momentum shift",
          "Doji: Open equals close - pure indecision",
          "Inside bar: Candle completely inside previous - consolidation",
        ],
      },
      {
        title: "Context Matters",
        content: [
          "A pin bar means nothing in the middle of a range",
          "Patterns at key levels are significant",
          "Patterns against the trend are less reliable",
          "Always combine candle patterns with structure",
        ],
      },
    ],
    keyPoints: [
      "Large body = momentum, small body = indecision",
      "Long wicks = rejection of those prices",
      "Pin bars/hammers at key levels = reversal signal",
      "Engulfing patterns show momentum shift",
      "Context (where it forms) matters more than pattern",
    ],
  },
  {
    id: 11,
    title: "Fibonacci Retracement Trading",
    description: "Master Fibonacci levels for optimal trade entries and profit targets.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "40 min",
    isFree: false,
    sections: [
      {
        title: "Understanding Fibonacci Levels",
        content: [
          "Key retracement levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%",
          "Derived from the Fibonacci sequence (mathematical relationship)",
          "Price often reacts at these levels during pullbacks",
          "Used to find optimal entry points in trending markets",
        ],
      },
      {
        title: "The Optimal Trade Entry (OTE) Zone",
        content: [
          "OTE zone is typically between 61.8% and 79% retracement",
          "This is where smart money often enters on pullbacks",
          "Offers the best risk-reward ratio",
          "Beyond 79% suggests the move may be invalidated",
        ],
      },
      {
        title: "How to Draw Fibonacci",
        content: [
          "In uptrend: Draw from swing low to swing high",
          "In downtrend: Draw from swing high to swing low",
          "Only draw after an impulsive move completes",
          "Use significant swings, not minor fluctuations",
        ],
      },
      {
        title: "Fibonacci Rules",
        content: [
          "Always combine Fib levels with other confluence",
          "Fib + Order Block = high probability setup",
          "Don't trade Fib levels in isolation",
          "Use extensions (127.2%, 161.8%) for profit targets",
        ],
      },
    ],
    keyPoints: [
      "Key levels: 38.2%, 50%, 61.8%, 79%",
      "OTE zone: 61.8% - 79% retracement",
      "Draw from swing low to high (uptrend) or high to low (downtrend)",
      "Always combine with other confluence",
      "Beyond 79% may invalidate the setup",
    ],
  },
  {
    id: 12,
    title: "Multi-Timeframe Analysis",
    description: "Learn to analyze multiple timeframes for higher probability trades and better risk management.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "45 min",
    isFree: false,
    sections: [
      {
        title: "The Power of Multiple Timeframes",
        content: [
          "Higher timeframes show the bigger picture (trend direction)",
          "Lower timeframes show detail (entry timing)",
          "Trading with HTF bias significantly increases win rate",
          "Never trade against the higher timeframe trend",
        ],
      },
      {
        title: "Timeframe Relationships",
        content: [
          "Each timeframe is roughly 4-6x the next lower one",
          "Daily → 4H → 1H → 15M is a common progression",
          "Weekly → Daily → 4H for swing traders",
          "4H → 1H → 15M for intraday traders",
        ],
      },
      {
        title: "Top-Down Analysis Process",
        content: [
          "Step 1: Identify trend and key levels on HTF",
          "Step 2: Find areas of interest on intermediate TF",
          "Step 3: Execute entries on LTF",
          "Step 4: Manage trade based on all timeframes",
        ],
      },
      {
        title: "Common Mistakes",
        content: [
          "Trading LTF signals against HTF trend",
          "Ignoring HTF structure breaks",
          "Over-analyzing too many timeframes",
          "Not waiting for LTF confirmation",
        ],
      },
    ],
    keyPoints: [
      "HTF = trend direction and bias",
      "LTF = entry timing and execution",
      "Never trade against HTF trend",
      "Use top-down analysis approach",
      "3 timeframes maximum for analysis",
    ],
  },
  {
    id: 13,
    title: "Trading Session Dynamics",
    description: "Understand how different trading sessions behave and when to trade for maximum opportunity.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    sections: [
      {
        title: "The Three Major Sessions",
        content: [
          "Asian Session (00:00 - 07:00 UTC): Range building, low volatility",
          "London Session (07:00 - 12:00 UTC): Trend initiation, breakouts",
          "New York Session (12:00 - 21:00 UTC): Continuation or reversal",
          "Each session has unique characteristics",
        ],
      },
      {
        title: "Session Characteristics",
        content: [
          "Asian: Consolidation, range formation, liquidity building",
          "London: Often breaks Asian range, highest breakout success",
          "London/NY Overlap: Maximum volatility, major moves",
          "New York: Continuation of London move or reversal",
        ],
      },
      {
        title: "Killzones",
        content: [
          "Killzones are optimal trading windows within sessions",
          "London Killzone: First 2-3 hours of London open",
          "NY Killzone: First 2-3 hours of NY open",
          "These are when institutions are most active",
        ],
      },
      {
        title: "Session Strategy",
        content: [
          "Mark Asian session high and low",
          "Watch for London to sweep Asian liquidity",
          "Enter in direction of London move during NY killzone",
          "Avoid trading during off-hours (21:00 - 00:00 UTC)",
        ],
      },
    ],
    keyPoints: [
      "Asian builds range, London breaks it",
      "London/NY overlap has highest volatility",
      "Killzones = first 2-3 hours of each session",
      "Mark Asian range for London breakout opportunities",
      "Avoid trading during off-hours",
    ],
  },
  {
    id: 14,
    title: "Risk Management Fundamentals",
    description: "The most important skill in trading - how to protect your capital and survive to trade another day.",
    category: "psychology",
    difficulty: "Beginner",
    duration: "40 min",
    isFree: false,
    sections: [
      {
        title: "Why Risk Management Matters",
        content: [
          "You can't trade if you've blown your account",
          "Even the best strategy fails without proper risk management",
          "Losses are inevitable - managing them is the key",
          "Consistent small losses are okay; large losses are account killers",
        ],
      },
      {
        title: "Position Sizing",
        content: [
          "Risk 1-2% of account per trade maximum",
          "Calculate position size based on stop loss distance",
          "Formula: Position Size = (Account × Risk%) / Stop Loss (in pips/points)",
          "Smaller positions = longer survival = more learning opportunities",
        ],
      },
      {
        title: "Risk-Reward Ratio",
        content: [
          "Minimum 1:2 risk-reward for every trade",
          "This means target is at least 2x your stop loss",
          "With 1:2 RR, you can be profitable with 40% win rate",
          "Higher RR allows for lower win rate requirements",
        ],
      },
      {
        title: "Drawdown Management",
        content: [
          "Set maximum daily loss limit (e.g., 3%)",
          "Set maximum weekly loss limit (e.g., 5%)",
          "Stop trading when limits are hit",
          "This prevents revenge trading and emotional decisions",
        ],
      },
    ],
    keyPoints: [
      "Risk 1-2% per trade maximum",
      "Minimum 1:2 risk-reward ratio",
      "Calculate position size based on stop distance",
      "Set daily and weekly loss limits",
      "Stop trading when limits are hit",
    ],
  },
  {
    id: 15,
    title: "Trading Psychology Mastery",
    description: "Control your emotions and develop the mindset of a professional trader.",
    category: "psychology",
    difficulty: "Advanced",
    duration: "50 min",
    isFree: false,
    sections: [
      {
        title: "The Trading Mindset",
        content: [
          "Trading is 80% psychology, 20% strategy",
          "Your edge is meaningless if you can't execute it",
          "The market is designed to make you feel wrong",
          "Acceptance of uncertainty is essential",
        ],
      },
      {
        title: "Common Emotional Traps",
        content: [
          "FOMO (Fear of Missing Out): Chasing entries after the move started",
          "Revenge Trading: Increasing risk after losses to 'get back' money",
          "Overconfidence: Increasing position sizes after wins",
          "Fear: Not taking valid setups due to recent losses",
        ],
      },
      {
        title: "Building Discipline",
        content: [
          "Create a detailed trading plan and follow it",
          "Journal every trade - wins AND losses",
          "Review your performance weekly",
          "Accept that some trades will lose - it's part of the process",
        ],
      },
      {
        title: "Pre and Post Trade Routines",
        content: [
          "Pre-trade: Check bias, identify key levels, wait for setup",
          "During trade: Monitor but don't micro-manage",
          "Post-trade: Journal the trade, note lessons learned",
          "End of day: Review all trades, assess emotional state",
        ],
      },
    ],
    keyPoints: [
      "Trading is 80% psychology",
      "FOMO and revenge trading destroy accounts",
      "Journal every trade for continuous improvement",
      "Follow your trading plan without exception",
      "Accept uncertainty as part of the process",
    ],
  },
  {
    id: 16,
    title: "Breakout vs Fakeout",
    description: "Learn to distinguish real breakouts from false ones and stop getting trapped.",
    category: "strategies",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    sections: [
      {
        title: "Why Breakouts Fail",
        content: [
          "Most breakouts are designed to trap retail traders",
          "Institutions use breakouts to fill orders from trapped traders",
          "A true breakout requires momentum and follow-through",
          "False breakouts are opportunities when you know what to look for",
        ],
      },
      {
        title: "Signs of a True Breakout",
        content: [
          "Strong impulsive candle with full body close beyond level",
          "Increased volume (if available)",
          "Follow-through in subsequent candles",
          "Lower timeframe structure confirming the break",
        ],
      },
      {
        title: "Signs of a Fakeout",
        content: [
          "Wick beyond level but body closes back inside",
          "Quick reversal after the break",
          "No follow-through momentum",
          "Occurs at obvious liquidity levels",
        ],
      },
      {
        title: "Trading Fakeouts",
        content: [
          "Wait for the fakeout to complete before entering",
          "Enter in the opposite direction after confirmation",
          "Stop loss beyond the fakeout wick",
          "Target the opposite side of the range",
        ],
      },
    ],
    keyPoints: [
      "Most breakouts are traps",
      "True breakouts have momentum and follow-through",
      "Fakeouts show wicks but no body close beyond level",
      "Trade fakeouts in the opposite direction",
      "Wait for confirmation before entering",
    ],
  },
  {
    id: 17,
    title: "Chart Pattern Recognition",
    description: "Master the classic chart patterns that repeat in all markets and timeframes.",
    category: "price-action",
    difficulty: "Intermediate",
    duration: "45 min",
    isFree: false,
    sections: [
      {
        title: "Reversal Patterns",
        content: [
          "Head and Shoulders: Three peaks with middle peak highest",
          "Double Top/Bottom: Two peaks/troughs at same level",
          "Triple Top/Bottom: Three peaks/troughs at same level",
          "Wedges: Converging trendlines against the trend",
        ],
      },
      {
        title: "Continuation Patterns",
        content: [
          "Flags: Parallel channel against the trend",
          "Pennants: Small symmetrical triangles",
          "Triangles: Ascending, descending, or symmetrical",
          "Rectangles: Horizontal consolidation",
        ],
      },
      {
        title: "Pattern Trading Rules",
        content: [
          "Wait for pattern completion (neckline break)",
          "Measure pattern height for target",
          "Higher timeframe patterns are more reliable",
          "Combine patterns with other confluence",
        ],
      },
      {
        title: "Pattern Failure",
        content: [
          "Not all patterns complete - some fail",
          "Failed patterns often lead to strong moves opposite",
          "Use stop loss beyond pattern structure",
          "Don't force patterns that aren't clear",
        ],
      },
    ],
    keyPoints: [
      "Head & shoulders = reversal pattern",
      "Flags and pennants = continuation patterns",
      "Wait for pattern to complete before trading",
      "Measure pattern height for price target",
      "Failed patterns can be powerful trade signals",
    ],
  },
  {
    id: 18,
    title: "Entry Techniques",
    description: "Master precise entry techniques for optimal risk-reward on every trade.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "45 min",
    isFree: false,
    sections: [
      {
        title: "Types of Entries",
        content: [
          "Aggressive: Enter at zone without LTF confirmation",
          "Moderate: Enter with LTF structure shift",
          "Conservative: Enter after full confirmation and retest",
          "Each has trade-offs between hit rate and risk-reward",
        ],
      },
      {
        title: "Lower Timeframe Confirmation",
        content: [
          "Mark your zone on HTF",
          "Drop to LTF when price reaches the zone",
          "Wait for CHOCH or BOS on LTF",
          "Enter after the shift with stop beyond the zone",
        ],
      },
      {
        title: "Entry Refinement",
        content: [
          "Zoom into smaller timeframes for precise entry",
          "Find order blocks within your zone for tighter stops",
          "The better your entry, the better your risk-reward",
          "Don't sacrifice quality for speed",
        ],
      },
      {
        title: "Common Entry Mistakes",
        content: [
          "Entering before price reaches the zone",
          "Not waiting for LTF confirmation",
          "Chasing entries after the move started",
          "Entering against HTF bias",
        ],
      },
    ],
    keyPoints: [
      "Aggressive entries = higher RR, lower hit rate",
      "Wait for LTF structure shift for confirmation",
      "Refine entries using smaller timeframes",
      "Better entries = better risk-reward",
      "Never enter against HTF bias",
    ],
  },
  {
    id: 19,
    title: "Trade Management",
    description: "Learn how to manage trades from entry to exit for maximum profitability.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "50 min",
    isFree: false,
    sections: [
      {
        title: "After Entry",
        content: [
          "Set stop loss immediately - never trade without one",
          "Define your take profit levels before entering",
          "Don't move stop loss to breakeven too early",
          "Let the trade breathe - don't micro-manage",
        ],
      },
      {
        title: "Partial Profit Taking",
        content: [
          "Take 50% off at 1:1 risk-reward",
          "Move stop to breakeven after first partial",
          "Let remainder run to full target",
          "This locks in profit while keeping upside",
        ],
      },
      {
        title: "Trailing Stops",
        content: [
          "Trail stop below/above structure as trade progresses",
          "Use swing lows (longs) or swing highs (shorts)",
          "Don't trail too tight - give the trade room",
          "Structure-based trails are better than fixed distance",
        ],
      },
      {
        title: "When to Exit Early",
        content: [
          "HTF structure changes against your trade",
          "Price shows clear rejection at a key level",
          "Major news event approaching",
          "Your original thesis is invalidated",
        ],
      },
    ],
    keyPoints: [
      "Always set stop loss immediately",
      "Take partial profits at 1:1",
      "Move to breakeven after first partial",
      "Trail stops using structure, not fixed distance",
      "Exit early if thesis is invalidated",
    ],
  },
  {
    id: 20,
    title: "Building Your Trading Plan",
    description: "Create a comprehensive trading plan that gives you an edge in the markets.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "55 min",
    isFree: false,
    sections: [
      {
        title: "Why You Need a Trading Plan",
        content: [
          "A plan removes emotion from trading decisions",
          "It provides consistency in your approach",
          "You can measure and improve what you define",
          "Trading without a plan is gambling",
        ],
      },
      {
        title: "Trading Plan Components",
        content: [
          "Markets: What instruments will you trade?",
          "Timeframes: What timeframes will you analyze?",
          "Setup: What specific conditions trigger a trade?",
          "Entry: How exactly will you enter?",
          "Stop Loss: Where will you place your stop?",
          "Take Profit: What are your targets?",
          "Risk: How much will you risk per trade?",
        ],
      },
      {
        title: "Rules and Guidelines",
        content: [
          "Define your trading hours",
          "Set maximum trades per day",
          "Establish loss limits (daily, weekly)",
          "Create a checklist for every trade",
        ],
      },
      {
        title: "Plan Execution",
        content: [
          "Follow your plan without exception",
          "Journal deviations and their outcomes",
          "Review and update plan monthly",
          "Only change plan based on data, not emotions",
        ],
      },
    ],
    keyPoints: [
      "Trading plan removes emotional decision-making",
      "Define: markets, timeframes, setup, entry, stop, target",
      "Set daily/weekly loss limits",
      "Follow plan without exception",
      "Update plan based on data, not emotions",
    ],
  },
];

export const FREE_LESSON_COUNT = 3;

export function getFreeLessons(): Lesson[] {
  return EDUCATION_LESSONS.filter((lesson) => lesson.isFree);
}

export function getPaidLessons(): Lesson[] {
  return EDUCATION_LESSONS.filter((lesson) => !lesson.isFree);
}

export function getLessonsByCategory(categoryId: string): Lesson[] {
  return EDUCATION_LESSONS.filter((lesson) => lesson.category === categoryId);
}

export function getLessonById(id: number): Lesson | undefined {
  return EDUCATION_LESSONS.find((lesson) => lesson.id === id);
}

export function canAccessLesson(lessonId: number, hasFullAccess: boolean): boolean {
  const lesson = getLessonById(lessonId);
  if (!lesson) return false;
  return lesson.isFree || hasFullAccess;
}

export const TRADING_KNOWLEDGE_FOR_AI = `
## Trading Knowledge Base for Analysis

### Market Structure
- HH/HL = Uptrend, LL/LH = Downtrend
- BOS (Break of Structure) = Continuation signal
- CHOCH (Change of Character) = Reversal warning
- HTF structure overrides LTF

### Smart Money Concepts
- Institutions accumulate → manipulate → distribute
- Order Blocks: Last opposite candle before impulsive move
- Fair Value Gaps: 3-candle imbalances where price moves too fast
- Liquidity: Equal highs/lows, trendline stops, session highs/lows

### Entry Criteria
- Valid zone (supply/demand)
- Liquidity sweep occurred
- Structure confirmation (BOS/CHOCH on LTF)
- Clear risk-reward (minimum 1:2)

### Risk Management
- Risk 1-2% per trade maximum
- Place stops beyond structure/zone
- Partial profits at key levels
- Never average into losing positions

### Session Timing (UTC)
- Asian: 00:00 - 07:00 (range building)
- London: 07:00 - 12:00 (trend initiation)
- NY Overlap: 12:00 - 16:00 (highest volatility)
- New York: 16:00 - 21:00 (trend continuation)

### Pattern Recognition
- Pin bars at key levels = reversal signal
- Engulfing after sweep = strong confirmation
- Double tops/bottoms need volume confirmation
- Head & shoulders require neckline break

### Zone Validation
- Fresh/untested zones are strongest
- Strong impulsive exit from zone
- Minimal basing = better zone
- Zone invalid if body closes through it
`;
