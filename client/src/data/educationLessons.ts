export interface LessonImage {
  src: string;
  alt: string;
}

export interface Lesson {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  isFree: boolean;
  images: LessonImage[];
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
    title: "Introduction to Trading Mindset",
    description: "Learn the 4 essential things every beginner trader needs to know before risking real money in the markets.",
    category: "psychology",
    difficulty: "Beginner",
    duration: "15 min",
    isFree: true,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.36_(3)_1770025405852.jpeg", alt: "4 Things I Wish I Knew When I Started Trading" },
    ],
    keyPoints: [
      "Trading is a skill that requires time to develop",
      "Risk management is more important than profit targets",
      "Consistency beats aggressive trading",
      "Trading psychology determines 80% of your success",
      "Never risk more than you can afford to lose",
    ],
  },
  {
    id: 2,
    title: "Price Action Fundamentals",
    description: "Master the basics of reading price charts using Olampos Price Action methodology - no indicators needed.",
    category: "price-action",
    difficulty: "Beginner",
    duration: "25 min",
    isFree: true,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.36_1770025405853.jpeg", alt: "Trading with Olampos Price Action" },
    ],
    keyPoints: [
      "Price tells you everything you need to know",
      "Identify key support and resistance levels",
      "Understand candlestick patterns and their meanings",
      "Learn to read market structure through price alone",
      "Why indicators lag behind price action",
    ],
  },
  {
    id: 3,
    title: "Smart Money Concepts Overview",
    description: "Understand how institutional traders move the markets and how to trade alongside them, not against them.",
    category: "smart-money",
    difficulty: "Beginner",
    duration: "30 min",
    isFree: true,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.35_(2)_1770025405854.jpeg", alt: "Smart Money Concepts Introduction" },
    ],
    keyPoints: [
      "Institutions accumulate, manipulate, then distribute",
      "Understanding liquidity pools and stop hunts",
      "Order blocks - where smart money enters",
      "Fair value gaps and imbalances",
      "Break of structure vs change of character",
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
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.35_(3)_1770025405849.jpeg", alt: "Intraday Open High Open Low Strategy" },
    ],
    keyPoints: [
      "Understanding the Open High Open Low concept",
      "Identifying high probability setups at market open",
      "Setting proper stop loss and take profit levels",
      "Best timeframes for this strategy",
      "Risk management rules for intraday trading",
    ],
  },
  {
    id: 5,
    title: "Advanced Price Action Patterns",
    description: "Deep dive into complex price action patterns and how to use them for high-probability entries.",
    category: "price-action",
    difficulty: "Intermediate",
    duration: "40 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.35_(4)_1770025405849.jpeg", alt: "Advanced Price Action Patterns" },
    ],
    keyPoints: [
      "Double tops and bottoms with precision entries",
      "Head and shoulders pattern trading",
      "Triangle patterns and breakout strategies",
      "Wedge patterns and reversal signals",
      "Combining patterns with market structure",
    ],
  },
  {
    id: 6,
    title: "SMC Trading Strategies",
    description: "Learn specific Smart Money trading strategies with entry, exit, and risk management rules.",
    category: "smart-money",
    difficulty: "Intermediate",
    duration: "45 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.35_(5)_1770025405850.jpeg", alt: "SMC Trading Strategies" },
    ],
    keyPoints: [
      "Trading order blocks effectively",
      "Fair value gap entry strategies",
      "Liquidity sweep setups",
      "Combining SMC with higher timeframe bias",
      "Position sizing for SMC trades",
    ],
  },
  {
    id: 7,
    title: "Market Structure Mastery",
    description: "Master market structure analysis to identify trends, reversals, and high-probability trading zones.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.36_(1)_1770025405851.jpeg", alt: "Market Structure Analysis" },
    ],
    keyPoints: [
      "Higher highs and higher lows (uptrend)",
      "Lower highs and lower lows (downtrend)",
      "Break of structure (BOS) identification",
      "Change of character (CHOCH) signals",
      "Multi-timeframe structure analysis",
    ],
  },
  {
    id: 8,
    title: "SMC Entry Techniques",
    description: "Advanced entry techniques using Smart Money Concepts for precise trade execution.",
    category: "smart-money",
    difficulty: "Advanced",
    duration: "50 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.36_(2)_1770025405852.jpeg", alt: "SMC Entry Techniques" },
    ],
    keyPoints: [
      "Optimal trade entry (OTE) zones",
      "Lower timeframe confirmation",
      "Mitigation block entries",
      "Breaker block strategies",
      "Combining multiple SMC elements",
    ],
  },
  {
    id: 9,
    title: "Candlestick Pattern Analysis",
    description: "Comprehensive guide to reading candlestick patterns for market direction and entry signals.",
    category: "price-action",
    difficulty: "Beginner",
    duration: "30 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.28_1770025305686.jpeg", alt: "Candlestick Patterns Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.28_(1)_1770025305691.jpeg", alt: "Candlestick Patterns Part 2" },
    ],
    keyPoints: [
      "Engulfing patterns - bullish and bearish",
      "Pin bar / hammer patterns",
      "Doji and indecision candles",
      "Morning and evening star patterns",
      "Using candle patterns at key levels",
    ],
  },
  {
    id: 10,
    title: "Supply and Demand Zones",
    description: "Learn to identify and trade institutional supply and demand zones for high-probability setups.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "40 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.28_(2)_1770025305691.jpeg", alt: "Supply and Demand Zones Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.28_(3)_1770025305692.jpeg", alt: "Supply and Demand Zones Part 2" },
    ],
    keyPoints: [
      "RBR - Rally Base Rally (demand)",
      "DBD - Drop Base Drop (supply)",
      "Fresh vs tested zones",
      "Zone validation criteria",
      "Trading zone retests",
    ],
  },
  {
    id: 11,
    title: "Trendline Trading Strategies",
    description: "Master the art of drawing and trading trendlines for trend following and reversal setups.",
    category: "price-action",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.28_(4)_1770025305692.jpeg", alt: "Trendline Trading Strategies" },
    ],
    keyPoints: [
      "Proper trendline drawing techniques",
      "Trendline bounce trading",
      "Trendline break strategies",
      "Dynamic support and resistance",
      "Combining trendlines with other tools",
    ],
  },
  {
    id: 12,
    title: "Chart Pattern Trading",
    description: "Complete guide to trading classic chart patterns with entry, stop loss, and target rules.",
    category: "price-action",
    difficulty: "Intermediate",
    duration: "45 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.29_(1)_1770025305687.jpeg", alt: "Chart Patterns Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.29_1770025314345.jpeg", alt: "Chart Patterns Part 2" },
    ],
    keyPoints: [
      "Double top/bottom patterns",
      "Head and shoulders variations",
      "Cup and handle formation",
      "Flag and pennant patterns",
      "Measuring pattern targets",
    ],
  },
  {
    id: 13,
    title: "Order Block Trading",
    description: "Deep dive into order block identification and trading strategies used by institutional traders.",
    category: "smart-money",
    difficulty: "Advanced",
    duration: "50 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.29_(2)_1770025305688.jpeg", alt: "Order Block Trading Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.29_(3)_1770025305689.jpeg", alt: "Order Block Trading Part 2" },
    ],
    keyPoints: [
      "What makes a valid order block",
      "Bullish vs bearish order blocks",
      "Order block refinement techniques",
      "Entry timing strategies",
      "Stop loss placement methods",
    ],
  },
  {
    id: 14,
    title: "Fair Value Gap Strategies",
    description: "Learn to identify and trade fair value gaps (imbalances) for precise market entries.",
    category: "smart-money",
    difficulty: "Advanced",
    duration: "45 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.29_(4)_1770025305690.jpeg", alt: "Fair Value Gap Trading Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.29_(5)_1770025305691.jpeg", alt: "Fair Value Gap Trading Part 2" },
    ],
    keyPoints: [
      "Understanding price imbalances",
      "FVG identification rules",
      "Trading FVG fills",
      "Combining FVG with order blocks",
      "When FVGs get invalidated",
    ],
  },
  {
    id: 15,
    title: "Liquidity Concepts",
    description: "Master liquidity concepts to understand where stop losses are hunted and reversals occur.",
    category: "smart-money",
    difficulty: "Advanced",
    duration: "55 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.30_(1)_1770025314346.jpeg", alt: "Liquidity Concepts Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.30_1770025314342.jpeg", alt: "Liquidity Concepts Part 2" },
    ],
    keyPoints: [
      "Buy-side and sell-side liquidity",
      "Equal highs and equal lows",
      "Liquidity sweeps and grabs",
      "Session highs and lows as targets",
      "Trading after liquidity is taken",
    ],
  },
  {
    id: 16,
    title: "Fibonacci Trading Techniques",
    description: "Use Fibonacci retracements and extensions for optimal entry points and profit targets.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "40 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.30_(2)_1770025314346.jpeg", alt: "Fibonacci Trading Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.30_(3)_1770025314337.jpeg", alt: "Fibonacci Trading Part 2" },
    ],
    keyPoints: [
      "Key Fibonacci levels (38.2%, 50%, 61.8%)",
      "Optimal trade entry zone (OTE)",
      "Fibonacci extensions for targets",
      "Combining Fib with structure",
      "When Fib levels fail",
    ],
  },
  {
    id: 17,
    title: "Multi-Timeframe Analysis",
    description: "Learn to analyze multiple timeframes for higher probability trades and better risk management.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "45 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.30_(4)_1770025314338.jpeg", alt: "Multi-Timeframe Analysis Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.30_(5)_1770025314339.jpeg", alt: "Multi-Timeframe Analysis Part 2" },
    ],
    keyPoints: [
      "HTF for bias, LTF for entry",
      "Timeframe correlation",
      "Top-down analysis approach",
      "Avoiding conflicting signals",
      "Best timeframe combinations",
    ],
  },
  {
    id: 18,
    title: "BPR Trading Strategy",
    description: "Master the Balanced Price Range trading strategy for institutional-level precision.",
    category: "strategies",
    difficulty: "Advanced",
    duration: "50 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.30_(6)_1770025314341.jpeg", alt: "BPR Trading Strategy" },
    ],
    keyPoints: [
      "What is a Balanced Price Range",
      "Identifying BPR zones",
      "Entry techniques using BPR",
      "Stop loss and target setting",
      "BPR in trending vs ranging markets",
    ],
  },
  {
    id: 19,
    title: "Pivot Point Strategies",
    description: "Use pivot points for identifying key support, resistance, and potential reversal zones.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.31_(1)_1770025314343.jpeg", alt: "Pivot Point Strategies Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.31_1770025366966.jpeg", alt: "Pivot Point Strategies Part 2" },
    ],
    keyPoints: [
      "Calculating daily pivot points",
      "Support and resistance levels",
      "Trading pivot bounces",
      "Pivot break strategies",
      "Combining pivots with other tools",
    ],
  },
  {
    id: 20,
    title: "Risk Management Masterclass",
    description: "Essential risk management principles that separate profitable traders from the rest.",
    category: "psychology",
    difficulty: "Beginner",
    duration: "40 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.31_(2)_1770025314344.jpeg", alt: "Risk Management Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.31_(3)_1770025366964.jpeg", alt: "Risk Management Part 2" },
    ],
    keyPoints: [
      "Position sizing fundamentals",
      "Risk per trade rules (1-2%)",
      "Risk-to-reward ratios",
      "Drawdown management",
      "Portfolio heat limits",
    ],
  },
  {
    id: 21,
    title: "Trading Session Analysis",
    description: "Understand the characteristics of different trading sessions and how to trade each one.",
    category: "fundamentals",
    difficulty: "Intermediate",
    duration: "30 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.31_(4)_1770025366965.jpeg", alt: "Trading Sessions Analysis" },
    ],
    keyPoints: [
      "Asian session characteristics",
      "London session opportunities",
      "New York session trading",
      "Session overlaps (killzones)",
      "Best times to trade",
    ],
  },
  {
    id: 22,
    title: "Breakout Trading Strategies",
    description: "Learn to identify and trade breakouts with proper confirmation and risk management.",
    category: "strategies",
    difficulty: "Intermediate",
    duration: "40 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.32_(1)_1770025366955.jpeg", alt: "Breakout Trading Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.32_1770025366963.jpeg", alt: "Breakout Trading Part 2" },
    ],
    keyPoints: [
      "Identifying breakout setups",
      "False breakout protection",
      "Volume confirmation",
      "Breakout entry techniques",
      "Managing breakout trades",
    ],
  },
  {
    id: 23,
    title: "Reversal Trading Mastery",
    description: "Master the art of identifying and trading market reversals at key levels.",
    category: "strategies",
    difficulty: "Advanced",
    duration: "50 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.32_(2)_1770025366957.jpeg", alt: "Reversal Trading Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.32_(3)_1770025366958.jpeg", alt: "Reversal Trading Part 2" },
    ],
    keyPoints: [
      "Reversal vs pullback identification",
      "Key reversal zones",
      "Confirmation candle patterns",
      "Timing reversal entries",
      "Managing reversal trades",
    ],
  },
  {
    id: 24,
    title: "Entry and Exit Optimization",
    description: "Fine-tune your entry and exit techniques for maximum profit and minimum risk.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "45 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.32_(4)_1770025366959.jpeg", alt: "Entry Exit Optimization Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.32_(5)_1770025366960.jpeg", alt: "Entry Exit Optimization Part 2" },
    ],
    keyPoints: [
      "Optimal entry zones",
      "LTF confirmation techniques",
      "Partial profit taking",
      "Trailing stop methods",
      "When to hold vs exit early",
    ],
  },
  {
    id: 25,
    title: "Trading Psychology Deep Dive",
    description: "Advanced trading psychology concepts for maintaining consistency and emotional control.",
    category: "psychology",
    difficulty: "Advanced",
    duration: "55 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.32_(6)_1770025366962.jpeg", alt: "Trading Psychology Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.33_(1)_1770025374001.jpeg", alt: "Trading Psychology Part 2" },
    ],
    keyPoints: [
      "Overcoming fear of missing out",
      "Managing revenge trading urges",
      "Building trading discipline",
      "Pre and post trade routines",
      "Dealing with losing streaks",
    ],
  },
  {
    id: 26,
    title: "Advanced Candlestick Analysis",
    description: "Master advanced candlestick reading for institutional-level market analysis.",
    category: "price-action",
    difficulty: "Advanced",
    duration: "45 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.33_1770025374005.jpeg", alt: "Advanced Candlestick Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.33_(2)_1770025374002.jpeg", alt: "Advanced Candlestick Part 2" },
    ],
    keyPoints: [
      "Reading candle body and wick ratios",
      "Absorption and exhaustion candles",
      "Institutional candle patterns",
      "Candle clusters analysis",
      "Momentum vs reversal candles",
    ],
  },
  {
    id: 27,
    title: "Trade Management Systems",
    description: "Build systematic trade management processes for consistent profitability.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "50 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.33_(3)_1770025374003.jpeg", alt: "Trade Management Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.33_(4)_1770025374004.jpeg", alt: "Trade Management Part 2" },
    ],
    keyPoints: [
      "Trade journaling best practices",
      "Performance metric tracking",
      "Identifying edge leaks",
      "Systematic review process",
      "Continuous improvement methods",
    ],
  },
  {
    id: 28,
    title: "Institutional Trading Concepts",
    description: "Understand how banks and institutions trade to align with smart money flow.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "60 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.34_(1)_1770025374005.jpeg", alt: "Institutional Trading Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.34_1770025373998.jpeg", alt: "Institutional Trading Part 2" },
    ],
    keyPoints: [
      "How institutions place orders",
      "Accumulation and distribution",
      "Institutional price levels",
      "Following money flow",
      "Avoiding institutional traps",
    ],
  },
  {
    id: 29,
    title: "Advanced Market Structure",
    description: "Deep dive into complex market structure patterns for professional-level analysis.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "55 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.34_(2)_1770025374006.jpeg", alt: "Advanced Market Structure Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.34_(3)_1770025373997.jpeg", alt: "Advanced Market Structure Part 2" },
    ],
    keyPoints: [
      "Internal vs external structure",
      "Sub-structure analysis",
      "Structure breaks vs sweeps",
      "Protected vs unprotected levels",
      "Time-based structure analysis",
    ],
  },
  {
    id: 30,
    title: "Complete Trading Framework",
    description: "Putting it all together - a complete trading framework combining all concepts.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "60 min",
    isFree: false,
    images: [
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.35_(1)_1770025374000.jpeg", alt: "Complete Trading Framework Part 1" },
      { src: "/attached_assets/WhatsApp_Image_2025-10-30_at_13.50.35_1770025405851.jpeg", alt: "Complete Trading Framework Part 2" },
    ],
    keyPoints: [
      "Building your trading checklist",
      "Combining multiple confluences",
      "Trade scoring systems",
      "A+ setup identification",
      "Creating your trading edge",
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
