export interface LessonSection {
  title: string;
  content: string;
  bullets?: string[];
  tradingExample?: {
    setup: string;
    entry: string;
    management: string;
    outcome: string;
  };
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export type DiagramType = "order-block" | "fvg" | "liquidity-sweep" | "bos-choch" | "candlestick-patterns" | "sessions" | "risk-reward";

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
  commonMistakes: string[];
  relatedLessons: number[];
  quiz: QuizQuestion[];
  diagrams?: DiagramType[];
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
    title: "The 4 Trading Truths Every Beginner Must Accept",
    description: "Essential wisdom that separates successful traders from the 90% who fail. These are the hard truths that took professional traders years to learn.",
    category: "psychology",
    difficulty: "Beginner",
    duration: "25 min",
    isFree: true,
    sections: [
      {
        title: "Truth #1: Trade Small Until You're Consistently Profitable",
        content: "The biggest mistake new traders make is risking significant capital before they've developed their skills. Think of it like learning to drive - you wouldn't buy a Ferrari for your first car. When you're learning to trade, your only goal should be to survive long enough to develop your edge. Every dollar you lose in the learning phase is tuition, but that tuition shouldn't bankrupt you.\n\nProfessional traders recommend risking no more than 0.5% of your account per trade when starting out. This means on a $10,000 account, you'd risk just $50 per trade. Yes, your wins will be small, but so will your losses. This allows you to take 200 losing trades in a row before blowing your account - giving you the runway you need to learn.",
        bullets: [
          "Risk 0.5% or less per trade when learning",
          "Focus on executing your plan, not making money",
          "Large early losses cause psychological damage that's hard to recover from",
          "Small positions remove the emotional attachment that clouds judgment"
        ],
        tradingExample: {
          setup: "A new trader with a $5,000 account sees what looks like a perfect setup on EUR/USD",
          entry: "Instead of risking $500 (10%) like many beginners do, they risk just $25 (0.5%)",
          management: "The trade goes against them by 50 pips",
          outcome: "They lose $25 - a small lesson fee. They analyze what went wrong without emotional damage. Had they risked $500, they'd be down 10% and likely revenge trading."
        }
      },
      {
        title: "Truth #2: Consistent Profitability Takes 1-3 Years",
        content: "Social media is filled with traders showing off massive gains after 'just 6 months.' What they don't show you is the funded accounts they blew, the money they borrowed, or that most of these posts are fabricated. Trading is a skill that requires thousands of hours to master, just like becoming a doctor or lawyer.\n\nThe data is clear: it takes most traders 1-3 years of dedicated practice to become consistently profitable. This isn't discouraging - it's liberating. It means you don't need to pressure yourself to be profitable in month three. Your job in year one is to learn, journal, and slowly improve your process.",
        bullets: [
          "Trading proficiency requires 10,000+ hours of screen time",
          "Most successful traders weren't profitable for 2+ years",
          "The pressure to be profitable quickly causes reckless behavior",
          "Track your improvement in process execution, not P&L"
        ]
      },
      {
        title: "Truth #3: Nobody Knows What Will Happen Next",
        content: "Every guru, signal provider, and analyst you follow is guessing. Some guess better than others based on probabilities, but nobody truly knows where price will go next. The best traders in the world have win rates between 40-60%. They don't predict - they react to what the market shows them and manage risk accordingly.\n\nThis truth is actually freeing. It means you don't need to be right most of the time. You need to be right sometimes and manage your losers properly. A 40% win rate with 2:1 reward-to-risk is still profitable. Stop searching for the holy grail that predicts every move - it doesn't exist.",
        bullets: [
          "Professional traders have 40-60% win rates, not 90%+",
          "Profitability comes from risk management, not prediction",
          "Anyone claiming 100% win rates is lying or selling something",
          "Focus on probabilities and edge, not certainty"
        ]
      },
      {
        title: "Truth #4: You Are Your Own Worst Enemy",
        content: "The market isn't out to get you. Your broker isn't hunting your stop losses. The reason you're losing is almost always YOU. Fear, greed, revenge trading, overconfidence after wins, depression after losses - these psychological traps destroy more traders than bad strategy ever could.\n\nThe most profitable traders spend more time working on their psychology than their technical analysis. They meditate, they journal, they take breaks. They understand that the battle is internal. Until you master your emotions, no strategy will save you.",
        bullets: [
          "95% of trading mistakes are psychological, not technical",
          "Revenge trading after losses accelerates account destruction",
          "Overconfidence after winning streaks leads to oversizing",
          "Daily journaling is the single best tool for improvement"
        ]
      }
    ],
    keyPoints: [
      "Risk 0.5% or less per trade while learning - survival is the priority",
      "Give yourself 1-3 years to become profitable - this is normal",
      "Nobody predicts the market - trade probabilities, not predictions",
      "Your psychology is more important than your strategy"
    ],
    commonMistakes: [
      "Risking 5-10% per trade because 'this one is a sure thing'",
      "Quitting after 3 months because you're not profitable yet",
      "Following signal providers expecting 90%+ win rates",
      "Blaming the market, broker, or indicators instead of yourself",
      "Skipping the trading journal because it 'takes too much time'"
    ],
    relatedLessons: [2, 17, 18],
    quiz: [
      {
        id: 1,
        question: "What percentage of your account should you risk per trade when learning?",
        options: ["5% for faster growth", "0.5% or less", "1-2% is standard", "10% on high-confidence trades"],
        correctAnswer: 1,
        explanation: "When learning, risking 0.5% or less gives you the runway to make 200+ mistakes without blowing your account. Survival is the priority in the learning phase."
      },
      {
        id: 2,
        question: "How long does it typically take to become a consistently profitable trader?",
        options: ["1-3 months", "6 months", "1-3 years", "1 week with the right course"],
        correctAnswer: 2,
        explanation: "Research and trader testimonials consistently show that 1-3 years of dedicated practice is needed for consistent profitability. This is comparable to other professional skills."
      },
      {
        id: 3,
        question: "What win rate do most professional traders have?",
        options: ["80-90%", "95-100%", "40-60%", "20-30%"],
        correctAnswer: 2,
        explanation: "Professional traders typically have win rates between 40-60%. They're profitable because of risk management and reward-to-risk ratios, not because they predict every move correctly."
      }
    ]
  },
  {
    id: 2,
    title: "Market Structure: The Foundation of All Analysis",
    description: "Learn to read the 'story' that price tells through higher highs, lower lows, and structural shifts. This is the backbone of all technical trading.",
    category: "price-action",
    difficulty: "Beginner",
    duration: "30 min",
    isFree: true,
    sections: [
      {
        title: "What Is Market Structure?",
        content: "Market structure is simply the pattern of highs and lows that price creates as it moves. Just like a story has a beginning, middle, and end, price action tells a story through its structure. Learning to read this story is the foundation of all technical analysis.\n\nAt its core, market structure answers one question: 'Is price making higher highs and higher lows (uptrend), or lower highs and lower lows (downtrend)?' This simple observation determines the direction you should be trading and where you should look for entries.",
        bullets: [
          "Uptrend = Higher Highs (HH) + Higher Lows (HL)",
          "Downtrend = Lower Highs (LH) + Lower Lows (LL)",
          "Consolidation = Equal highs and lows, price moving sideways",
          "Structure tells you the trend direction on any timeframe"
        ]
      },
      {
        title: "Identifying Swing Points",
        content: "Swing highs and swing lows are the key turning points in price. A swing high is formed when price makes a high, then reverses and makes at least one lower high on each side. A swing low is the opposite - price makes a low, then reverses and makes at least one higher low on each side.\n\nThink of swing points like mountains and valleys on a landscape. The peaks are swing highs, and the valleys are swing lows. These points become your reference for determining trend direction and potential support/resistance levels.",
        bullets: [
          "Swing High: The peak between two lower candles on each side",
          "Swing Low: The trough between two higher candles on each side",
          "Major swing points are visible on higher timeframes",
          "Minor swing points form within the major structure"
        ],
        tradingExample: {
          setup: "On EUR/USD 4H chart, you identify three consecutive higher lows forming over 2 weeks",
          entry: "Price pulls back to the most recent higher low area with a bullish engulfing candle",
          management: "Stop loss below the swing low, target the previous swing high",
          outcome: "Price respects the uptrend structure and moves to target, giving you a 2:1 winner"
        }
      },
      {
        title: "Break of Structure (BOS)",
        content: "A Break of Structure occurs when price breaks through a significant swing point, indicating a potential continuation of the trend. In an uptrend, a BOS happens when price breaks above the most recent swing high. In a downtrend, it happens when price breaks below the most recent swing low.\n\nBOS is a confirmation signal. When you see a BOS in the direction of the trend, it tells you that momentum is continuing and the trend is healthy. Smart money traders use BOS as confirmation before entering trades in the trend direction.",
        bullets: [
          "Bullish BOS: Price breaks and closes above a swing high",
          "Bearish BOS: Price breaks and closes below a swing low",
          "BOS confirms trend continuation",
          "Wait for the candle to CLOSE beyond the level for confirmation"
        ]
      },
      {
        title: "Change of Character (CHoCH)",
        content: "A Change of Character is the first sign that a trend might be reversing. It occurs when price breaks structure in the opposite direction for the first time. In an uptrend, a CHoCH happens when price breaks below the most recent swing low. In a downtrend, it happens when price breaks above the most recent swing high.\n\nCHoCH is not a reversal confirmation - it's an early warning sign. It tells you that the current trend is weakening and you should be cautious. Many traders wait for a CHoCH followed by a BOS in the new direction before considering the trend reversed.",
        bullets: [
          "CHoCH in uptrend: First break below a swing low",
          "CHoCH in downtrend: First break above a swing high",
          "CHoCH = caution, not confirmation of reversal",
          "Look for CHoCH + BOS in new direction for trend change"
        ],
        tradingExample: {
          setup: "GBP/USD has been in a strong uptrend. Suddenly, price drops and closes below the last swing low - a CHoCH",
          entry: "You wait. Price then creates a lower high and breaks below the CHoCH low - confirming BOS bearish",
          management: "Now you look for short entries on pullbacks to the new lower highs",
          outcome: "The trend has shifted. Your patience prevented you from buying into a failing uptrend"
        }
      }
    ],
    keyPoints: [
      "Market structure = the pattern of highs and lows price creates",
      "Uptrend: Higher Highs + Higher Lows | Downtrend: Lower Highs + Lower Lows",
      "BOS confirms trend continuation | CHoCH warns of potential reversal",
      "Always wait for candle CLOSE for valid structure breaks"
    ],
    commonMistakes: [
      "Trading against the structure (shorting in clear uptrends)",
      "Calling a BOS before the candle closes",
      "Treating every small swing as significant structure",
      "Ignoring higher timeframe structure when trading lower timeframes",
      "Assuming CHoCH means immediate reversal (it's just a warning)"
    ],
    relatedLessons: [3, 5, 6],
    quiz: [
      {
        id: 1,
        question: "What defines an uptrend in market structure terms?",
        options: ["Price moving up", "Higher Highs and Higher Lows", "Green candles", "Volume increasing"],
        correctAnswer: 1,
        explanation: "An uptrend is defined by price making Higher Highs (HH) and Higher Lows (HL). This structure shows buyers are in control and willing to buy at increasingly higher prices."
      },
      {
        id: 2,
        question: "What is a Change of Character (CHoCH)?",
        options: ["A new all-time high", "The first break of structure against the trend", "A reversal pattern", "A trend continuation signal"],
        correctAnswer: 1,
        explanation: "CHoCH is the first break of structure against the current trend. In an uptrend, it's when price first breaks below a swing low. It's a warning sign, not confirmation of reversal."
      },
      {
        id: 3,
        question: "When is a Break of Structure (BOS) confirmed?",
        options: ["When price touches the level", "When the wick goes beyond", "When the candle closes beyond the level", "Immediately on break"],
        correctAnswer: 2,
        explanation: "A BOS is only confirmed when the candle CLOSES beyond the swing point. Wicks can be fakeouts, so waiting for the close prevents false signals."
      }
    ]
  },
  {
    id: 3,
    title: "Support & Resistance: Where Price Reacts",
    description: "Master the art of identifying key price levels where buying and selling pressure collide. These zones are where profitable trades are born.",
    category: "price-action",
    difficulty: "Beginner",
    duration: "25 min",
    isFree: true,
    sections: [
      {
        title: "Understanding Support and Resistance",
        content: "Support and resistance are price levels where buying or selling pressure has historically been strong enough to stop or reverse price movement. Think of support as a floor that catches falling prices, and resistance as a ceiling that caps rising prices.\n\nThese levels exist because traders remember where price reversed before and place orders there again. If EUR/USD bounced strongly from 1.0800 three times in the past month, traders will place buy orders near 1.0800 expecting it to bounce again. This collective memory creates self-fulfilling zones.",
        bullets: [
          "Support: Level where buying pressure exceeds selling pressure",
          "Resistance: Level where selling pressure exceeds buying pressure",
          "These levels work because traders remember and act on them",
          "The more times a level is tested, the more significant it becomes"
        ]
      },
      {
        title: "Zones vs. Exact Lines",
        content: "New traders make the mistake of drawing exact lines and expecting price to reverse at precise points. The market doesn't work that way. Instead, think of support and resistance as ZONES - areas where price is likely to react, not exact prices.\n\nA better approach is to draw a zone that captures the highs and lows of previous reactions. If price reversed at 1.0795, 1.0802, and 1.0798 on three occasions, your zone should encompass all three points (roughly 1.0790-1.0805). This gives you realistic expectations about where reactions might occur.",
        bullets: [
          "Draw zones, not exact lines",
          "Zones should capture the wicks and bodies of reaction candles",
          "Typical zone width: 10-30 pips on major pairs (4H/Daily)",
          "Smaller timeframes = smaller zones, but less reliable"
        ],
        tradingExample: {
          setup: "You identify a resistance zone on Gold (XAU/USD) between 1985-1992 where price has reversed 3 times",
          entry: "Price approaches 1988, within the zone. You wait for a bearish rejection candle (long upper wick)",
          management: "Stop loss at 1997 (above the zone), target the previous swing low at 1955",
          outcome: "Price respects the zone and drops. Your zone approach gave you a clear risk-defined entry."
        }
      },
      {
        title: "Role Reversal: Support Becomes Resistance",
        content: "One of the most powerful concepts in price action is role reversal. When price breaks through a support level, that support often becomes resistance. When price breaks through resistance, that resistance often becomes support.\n\nWhy does this happen? Traders who bought at support and watched price fall are now underwater. When price returns to that level, they're looking to exit at breakeven. This selling pressure at the old support level creates new resistance. Understanding this dynamic gives you high-probability trade entries.",
        bullets: [
          "Broken support becomes resistance (and vice versa)",
          "Traders look to exit at breakeven creating this flip",
          "These 'flip zones' provide excellent trade entries",
          "Wait for price to return and show rejection before entering"
        ]
      },
      {
        title: "Fresh vs. Tested Levels",
        content: "Not all support and resistance levels are created equal. A 'fresh' level that hasn't been tested recently tends to produce stronger reactions than a level that's been tested multiple times. Each time a level is tested, some of the orders at that level are filled, weakening the level.\n\nThink of it like a wall. Each test chips away at the wall until eventually it breaks. This is why you often see price break through on the third or fourth test of a level. Smart traders prefer trading the first or second test of a fresh level.",
        bullets: [
          "Fresh levels = stronger reaction potential",
          "Each test 'uses up' some of the orders at that level",
          "By the 3rd-4th test, a break is more likely",
          "Prioritize first/second tests of clear levels"
        ]
      }
    ],
    keyPoints: [
      "Support and resistance are ZONES, not exact lines",
      "Broken support becomes resistance, broken resistance becomes support",
      "Fresh levels produce stronger reactions than heavily tested ones",
      "Wait for rejection candles within the zone before entering"
    ],
    commonMistakes: [
      "Drawing too many levels - focus on the most obvious ones",
      "Expecting price to reverse at exact prices instead of zones",
      "Trading the 5th test of a level (it's likely to break)",
      "Ignoring higher timeframe levels when trading lower timeframes",
      "Not waiting for confirmation (rejection candles) before entering"
    ],
    relatedLessons: [2, 5, 8],
    quiz: [
      {
        id: 1,
        question: "Why should you draw zones instead of exact lines for support/resistance?",
        options: ["It looks more professional", "Price rarely reverses at exact levels", "Zones are easier to draw", "Lines don't work"],
        correctAnswer: 1,
        explanation: "Price action is messy. It rarely reverses at exact levels because orders are placed across a range of prices. Zones capture this reality and give you realistic expectations."
      },
      {
        id: 2,
        question: "What happens when a support level is broken?",
        options: ["It becomes irrelevant", "It often becomes resistance", "Price always returns to it", "It gets stronger"],
        correctAnswer: 1,
        explanation: "When support breaks, trapped buyers look to exit at breakeven when price returns. This selling pressure turns the old support into new resistance - called role reversal."
      },
      {
        id: 3,
        question: "Which level test typically provides the strongest reaction?",
        options: ["The 4th or 5th test", "The 1st or 2nd test", "They're all equal", "Only the final test before break"],
        correctAnswer: 1,
        explanation: "Fresh levels (1st or 2nd test) tend to produce stronger reactions because more orders are waiting there. Each subsequent test 'uses up' some of those orders."
      }
    ]
  },
  {
    id: 4,
    title: "Candlestick Patterns That Actually Work",
    description: "Cut through the noise of 100+ candlestick patterns. Learn the 5 patterns that institutional traders actually use to make decisions.",
    category: "price-action",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    sections: [
      {
        title: "Why Most Candlestick Patterns Fail",
        content: "Trading books list dozens of candlestick patterns with exotic names - morning stars, three black crows, abandoned babies. The reality? Most of these patterns have little predictive value in modern markets. Algorithms and high-frequency trading have made many classical patterns unreliable.\n\nThe patterns that DO work share common characteristics: they show clear rejection of a price level, they form at significant support/resistance zones, and they align with the higher timeframe trend. Context matters more than the pattern itself.",
        bullets: [
          "Most textbook patterns have <50% accuracy in isolation",
          "Patterns only matter at key levels with trend alignment",
          "Focus on what the candle SHOWS (rejection, momentum) not the name",
          "Higher timeframe patterns are more reliable than lower timeframe"
        ]
      },
      {
        title: "Pattern #1: Engulfing Candles",
        content: "An engulfing candle completely 'engulfs' the body of the previous candle. A bullish engulfing has a large green body that swallows the previous red candle's body. A bearish engulfing has a large red body that swallows the previous green candle's body.\n\nEngulfing patterns show a clear shift in control. The side that was winning (previous candle) got completely overwhelmed. When this happens at a key support/resistance zone in the direction of the trend, it's one of the highest probability setups available.",
        bullets: [
          "Body must completely engulf the previous candle's body",
          "The larger the engulfing candle, the stronger the signal",
          "Look for these at S/R zones with trend alignment",
          "Works on any timeframe but most reliable on 4H/Daily"
        ],
        tradingExample: {
          setup: "EUR/USD is in an uptrend. Price pulls back to a clear support zone at 1.0850",
          entry: "A bullish engulfing candle forms on the 4H chart, completely swallowing the previous bearish candle",
          management: "Stop below the engulfing candle's low, target previous swing high",
          outcome: "Strong confirmation of buyers stepping in. Price rallies 80 pips to target."
        }
      },
      {
        title: "Pattern #2: Pin Bars / Rejection Wicks",
        content: "A pin bar (or rejection wick) has a long wick and small body, showing that price tested a level but was strongly rejected. The wick should be at least 2-3x the length of the body. A bullish pin bar has a long lower wick (buyers rejected lower prices). A bearish pin bar has a long upper wick (sellers rejected higher prices).\n\nPin bars are powerful because they show the actual battle between buyers and sellers. The long wick represents an attempted move that failed. This failure often leads to a move in the opposite direction.",
        bullets: [
          "Wick should be 2-3x the body length minimum",
          "The wick shows which price level was rejected",
          "Pin bars at key levels are high probability trades",
          "The longer the wick, the stronger the rejection signal"
        ]
      },
      {
        title: "Pattern #3: Inside Bars (Consolidation)",
        content: "An inside bar is a candle whose high and low are completely within the range of the previous candle. It shows consolidation and decreasing volatility - often before a breakout move. Inside bars are not entry signals themselves; they're alerts that a move is coming.\n\nSmart traders use inside bars to plan breakout trades. You can place orders above and below the mother candle (the large candle containing the inside bar), ready to catch whichever direction price breaks.",
        bullets: [
          "Inside bar fits entirely within the previous candle's range",
          "Shows consolidation and building pressure",
          "Trade the breakout of the mother candle's range",
          "More powerful when forming at key S/R levels"
        ]
      },
      {
        title: "Pattern #4: Doji and Indecision",
        content: "A doji candle has a very small body (open and close are nearly equal) with wicks on both sides. It shows complete indecision - neither buyers nor sellers could gain control. Dojis at key levels signal that a reversal or continuation decision is imminent.\n\nDon't trade dojis in isolation. They're warning flags that say 'pay attention.' Wait for the next candle to confirm direction. A doji followed by a strong directional candle at a key level is a powerful setup.",
        bullets: [
          "Small body with wicks showing rejection on both sides",
          "Represents indecision between buyers and sellers",
          "Wait for the next candle to confirm direction",
          "Most powerful at key support/resistance zones"
        ]
      },
      {
        title: "Pattern #5: Three-Candle Momentum Sequences",
        content: "Strong trends often begin or continue with three consecutive candles in the same direction, each with growing bodies. This 'three white soldiers' (bullish) or 'three black crows' (bearish) pattern shows accelerating momentum.\n\nUnlike the other patterns which show reversals, this pattern confirms continuation. When you see three strong candles in a row after a pullback, it confirms that the trend is resuming with force.",
        bullets: [
          "Three consecutive candles in the same direction",
          "Each candle should have a body (not dojis)",
          "Shows building momentum and commitment",
          "Use this to confirm trend continuation entries"
        ]
      }
    ],
    keyPoints: [
      "Context > Pattern: Only trade patterns at key levels with trend alignment",
      "Engulfing and Pin Bars are the most reliable reversal signals",
      "Inside Bars signal incoming volatility - trade the breakout",
      "Wait for confirmation after dojis before taking action"
    ],
    commonMistakes: [
      "Trading patterns in isolation without checking the trend",
      "Looking for patterns on very low timeframes (noisy)",
      "Memorizing exotic pattern names instead of understanding price action",
      "Entering immediately on a doji without waiting for confirmation",
      "Ignoring the location (S/R zone) where the pattern forms"
    ],
    relatedLessons: [2, 3, 12],
    quiz: [
      {
        id: 1,
        question: "What makes candlestick patterns actually reliable?",
        options: ["The pattern name", "The pattern forming at key levels with trend alignment", "Trading on 1-minute charts", "Seeing multiple patterns at once"],
        correctAnswer: 1,
        explanation: "Patterns only become reliable when they form at significant support/resistance zones and align with the higher timeframe trend. Context is everything."
      },
      {
        id: 2,
        question: "What does a long lower wick on a pin bar indicate?",
        options: ["Sellers are strong", "Buyers rejected lower prices", "The trend will continue down", "Volume was high"],
        correctAnswer: 1,
        explanation: "A long lower wick shows that price tested lower but buyers strongly rejected those prices, pushing price back up. It's a bullish signal at support."
      },
      {
        id: 3,
        question: "How should you trade an inside bar?",
        options: ["Enter immediately in the trend direction", "Trade the breakout of the mother candle", "Wait for three more inside bars", "Inside bars can't be traded"],
        correctAnswer: 1,
        explanation: "Inside bars show consolidation. The smart approach is to wait for price to break out of the mother candle's range and trade in the breakout direction."
      }
    ],
    diagrams: ["candlestick-patterns"]
  },
  {
    id: 5,
    title: "Order Blocks: Where Institutions Place Their Trades",
    description: "Discover the footprints that banks and hedge funds leave on charts. Order blocks reveal where big money entered the market.",
    category: "smart-money",
    difficulty: "Intermediate",
    duration: "40 min",
    isFree: false,
    sections: [
      {
        title: "What Are Order Blocks?",
        content: "Order blocks are price zones where institutional traders (banks, hedge funds) have placed significant buy or sell orders. Because these players trade such large volumes, they can't fill their positions all at once. They leave orders at specific price levels and need price to return to those levels to fill the rest of their position.\n\nWhen price returns to an order block, those unfilled orders get activated, causing price to react. This is why old highs and lows often act as support and resistance - there are literally unfilled orders waiting there.",
        bullets: [
          "Order blocks = zones of unfilled institutional orders",
          "Institutions can't fill positions in one go due to size",
          "Price returns to order blocks to fill remaining orders",
          "These zones create reliable support and resistance"
        ]
      },
      {
        title: "Identifying Bullish Order Blocks",
        content: "A bullish order block is the last BEARISH candle before a strong move up. Think about it: if institutions wanted to buy, they would accumulate as price was dropping (buying from retail sellers). The last red candle before price exploded upward is where they made their final purchases.\n\nTo identify a bullish order block: 1) Find a strong move up that broke structure, 2) Go back to find the last bearish (red) candle before that move, 3) Mark the high and low of that candle as your order block zone. When price returns to this zone, expect buyers to step in again.",
        bullets: [
          "Bullish OB = Last bearish candle before impulse up",
          "Look for strong moves that broke structure (BOS)",
          "Mark the entire candle range as your zone",
          "These zones act as high-probability support"
        ],
        tradingExample: {
          setup: "GBP/JPY makes a strong move from 185.50 to 187.00, breaking the previous high. The last red candle before this move was at 185.60-185.80",
          entry: "Price retraces back to 185.70 (within the order block). You wait for a bullish reaction candle",
          management: "Stop loss below the order block (185.50), target previous high 187.00",
          outcome: "Institutional orders at the OB get filled, price reverses and rallies. Risk:Reward of 1:2.5"
        }
      },
      {
        title: "Identifying Bearish Order Blocks",
        content: "A bearish order block is the last BULLISH candle before a strong move down. This is where institutions sold into retail buying. The last green candle before price dropped aggressively is where smart money distributed their positions.\n\nTo identify a bearish order block: 1) Find a strong move down that broke structure, 2) Go back to find the last bullish (green) candle before that move, 3) Mark the high and low of that candle. When price returns to this zone, expect sellers to step in.",
        bullets: [
          "Bearish OB = Last bullish candle before impulse down",
          "Look for moves that broke structure to the downside",
          "The entire candle range is your zone",
          "These zones act as high-probability resistance"
        ]
      },
      {
        title: "Order Block Quality and Mitigation",
        content: "Not all order blocks are created equal. The best order blocks are 'unmitigated' - meaning price hasn't returned to them yet. Once price returns to an order block and reacts, that block has been 'mitigated' and its power is reduced.\n\nQuality checklist for order blocks: 1) Did the move from the OB break structure? 2) Was the impulse move strong and with large candles? 3) Is the OB unmitigated (fresh)? 4) Does it align with higher timeframe trend? The more boxes checked, the higher the probability.",
        bullets: [
          "Unmitigated (fresh) OBs are strongest",
          "Once price returns and reacts, the OB is 'used'",
          "Look for OBs that caused structural breaks",
          "Higher timeframe OBs are more reliable"
        ]
      },
      {
        title: "Trading Order Blocks with Confluence",
        content: "Order blocks work best when combined with other confluences: 1) They align with the higher timeframe trend, 2) They sit within a support/resistance zone, 3) They coincide with Fibonacci levels (especially 61.8% or 70.5%), 4) They're in a discount zone for buys or premium zone for sells.\n\nNever trade an order block in isolation. The more confluences you stack, the higher your probability. A fresh order block at a key support level in an uptrend at the 61.8% Fibonacci retracement is a high-probability setup.",
        bullets: [
          "Stack multiple confluences for highest probability",
          "Trend alignment is non-negotiable",
          "Fibonacci levels often coincide with good OBs",
          "Higher timeframe OBs trump lower timeframe OBs"
        ]
      }
    ],
    keyPoints: [
      "Order blocks are zones where institutions placed unfilled orders",
      "Bullish OB = last bearish candle before strong up move",
      "Bearish OB = last bullish candle before strong down move",
      "Fresh (unmitigated) order blocks are the most powerful"
    ],
    commonMistakes: [
      "Marking every red/green candle as an order block",
      "Trading mitigated (already tested) order blocks",
      "Ignoring the impulse move quality that followed the OB",
      "Trading OBs against the higher timeframe trend",
      "Not waiting for confirmation candles at the OB"
    ],
    relatedLessons: [2, 6, 7, 11],
    quiz: [
      {
        id: 1,
        question: "What is a bullish order block?",
        options: ["The last green candle before a move down", "The last red candle before a strong move up", "Any support zone", "A cluster of buy orders visible on the chart"],
        correctAnswer: 1,
        explanation: "A bullish order block is the last bearish (red) candle before a strong impulsive move upward. This is where institutions accumulated their long positions."
      },
      {
        id: 2,
        question: "What makes an order block 'unmitigated'?",
        options: ["Price has tested it multiple times", "Price hasn't returned to it yet", "It's on the daily timeframe", "It has high volume"],
        correctAnswer: 1,
        explanation: "An unmitigated order block is fresh - price hasn't returned to it yet. These are the most powerful because the institutional orders are still waiting to be filled."
      },
      {
        id: 3,
        question: "When should you NOT trade an order block?",
        options: ["When it's fresh", "When it aligns with the trend", "When it's against the higher timeframe trend", "When it caused a structural break"],
        correctAnswer: 2,
        explanation: "Trading order blocks against the higher timeframe trend significantly reduces probability. Always ensure the OB aligns with the dominant trend direction."
      }
    ],
    diagrams: ["order-block", "bos-choch"]
  },
  {
    id: 6,
    title: "Fair Value Gaps: The Imbalance Traders Seek",
    description: "Learn to spot and trade the price imbalances that algorithms and institutions are programmed to fill. FVGs are among the most reliable trading concepts.",
    category: "smart-money",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    sections: [
      {
        title: "Understanding Fair Value Gaps",
        content: "A Fair Value Gap (FVG) is a three-candle pattern where the middle candle moves so aggressively that it leaves a gap between the wicks of the first and third candles. This gap represents a price imbalance - an area where very few orders were transacted because price moved too fast.\n\nMarkets naturally seek balance. When an imbalance (FVG) is created, there's a tendency for price to return to that area to 'fill the gap' and restore equilibrium. This retracement into FVGs provides excellent trade entry opportunities.",
        bullets: [
          "FVG = gap between candle 1's wick and candle 3's wick",
          "Created by aggressive moves with insufficient orders",
          "Markets tend to retrace and fill these imbalances",
          "FVGs act as magnets that attract price"
        ]
      },
      {
        title: "Identifying Bullish FVGs",
        content: "A bullish FVG forms during an upward move. You need three candles: 1) Candle 1 creates a high, 2) Candle 2 is a large bullish candle, 3) Candle 3's low is HIGHER than Candle 1's high. The gap between Candle 1's high and Candle 3's low is your bullish FVG.\n\nThis zone represents an area where price 'flew through' without much trading. When price returns to this zone, buyers are likely to step in, making it an excellent entry point for long trades.",
        bullets: [
          "Three consecutive candles required",
          "Gap between Candle 1 high and Candle 3 low",
          "This zone = potential support for longs",
          "Mark from Candle 1 high to Candle 3 low"
        ],
        tradingExample: {
          setup: "USD/JPY rallies strongly on 4H chart. Candle 1 high: 149.50, large green Candle 2, Candle 3 low: 149.70. FVG zone: 149.50-149.70",
          entry: "Price retraces into the FVG at 149.60. You enter long with a buy limit order",
          management: "Stop loss below Candle 1's low, target the recent swing high",
          outcome: "Price respects the FVG as support and continues higher. Clean 1:2 risk-reward trade."
        }
      },
      {
        title: "Identifying Bearish FVGs",
        content: "A bearish FVG forms during a downward move. You need: 1) Candle 1 creates a low, 2) Candle 2 is a large bearish candle, 3) Candle 3's high is LOWER than Candle 1's low. The gap between Candle 1's low and Candle 3's high is your bearish FVG.\n\nThis zone is where price dropped too fast for orders to fill. When price returns to this zone, sellers often step in, making it resistance for short trades.",
        bullets: [
          "Three consecutive candles with impulsive move down",
          "Gap between Candle 1 low and Candle 3 high",
          "This zone = potential resistance for shorts",
          "Mark from Candle 3 high to Candle 1 low"
        ]
      },
      {
        title: "FVG Mitigation and Inversion",
        content: "Like order blocks, FVGs can be 'mitigated' when price returns and fills them. Once price fully passes through an FVG, its role changes. A bullish FVG that was support may become resistance once price breaks below it (inversion).\n\nTraders have different approaches: some look for price to tap into the FVG and reverse (traditional use), while others wait for FVG inversion to find entries in the new direction. Both are valid strategies depending on market context.",
        bullets: [
          "Mitigation = price returns to fill the gap",
          "Full mitigation = price completely fills the FVG",
          "Inverted FVGs can act as new S/R after breaking",
          "Many traders aim for 50% fill of the FVG for entry"
        ]
      },
      {
        title: "FVG Quality and Trade Selection",
        content: "Not all FVGs are worth trading. High-quality FVGs share these characteristics: 1) They form during impulsive moves (not choppy price action), 2) They're created during structural breaks (BOS), 3) They align with the higher timeframe trend, 4) They're fresh and unmitigated, 5) They coincide with other confluences like order blocks or liquidity levels.\n\nThe best setups occur when an FVG overlaps with an order block in the direction of the trend. This confluence dramatically increases the probability of a reaction.",
        bullets: [
          "Impulsive moves create more reliable FVGs",
          "FVGs from structural breaks are high probability",
          "Trend alignment is essential",
          "FVG + Order Block overlap = high confluence"
        ]
      }
    ],
    keyPoints: [
      "FVG = gap between Candle 1 wick and Candle 3 wick caused by imbalance",
      "Markets tend to fill FVGs as they seek balance",
      "Bullish FVG = support zone | Bearish FVG = resistance zone",
      "Best FVGs form during impulse moves with structural breaks"
    ],
    commonMistakes: [
      "Marking tiny FVGs that won't attract price",
      "Trading FVGs against the dominant trend",
      "Expecting exact fills - price often respects 50% of FVG",
      "Ignoring whether the FVG was created during a structural break",
      "Trading already mitigated FVGs expecting another reaction"
    ],
    relatedLessons: [2, 5, 7, 11],
    quiz: [
      {
        id: 1,
        question: "What creates a Fair Value Gap?",
        options: ["High volume candles", "An aggressive price move that leaves a gap between two candles' wicks", "A news announcement", "Price hitting support"],
        correctAnswer: 1,
        explanation: "An FVG is created when price moves so aggressively that it leaves a gap between the first candle's wick and the third candle's wick - an imbalance the market tends to fill."
      },
      {
        id: 2,
        question: "Where do you mark a bullish FVG?",
        options: ["Between Candle 2 high and low", "Between Candle 1 high and Candle 3 low", "At the Candle 2 open and close", "At the highest point"],
        correctAnswer: 1,
        explanation: "A bullish FVG is marked from Candle 1's high to Candle 3's low - this gap represents the imbalance created during the upward move."
      },
      {
        id: 3,
        question: "What happens when an FVG is fully mitigated?",
        options: ["It becomes stronger", "It may invert and change role", "It always holds again", "Nothing, it disappears"],
        correctAnswer: 1,
        explanation: "Once price completely fills (mitigates) an FVG, the gap may invert - a bullish FVG that was support may become resistance if price breaks below it."
      }
    ],
    diagrams: ["fvg"]
  },
  {
    id: 7,
    title: "Liquidity: Understanding Where Stop Losses Live",
    description: "Banks hunt retail stop losses for liquidity. Learn to identify these pools and position yourself on the right side of the hunt.",
    category: "smart-money",
    difficulty: "Advanced",
    duration: "45 min",
    isFree: false,
    sections: [
      {
        title: "What Is Liquidity?",
        content: "Liquidity in trading refers to the availability of orders at specific price levels that institutions need to fill their large positions. The most accessible pools of liquidity are retail stop losses. When hundreds of traders place stops in the same area, that creates a pool of orders that smart money can use.\n\nThink about it: if a bank needs to buy 100 million euros, they need sellers. Where do they find sellers? At the prices where retail traders have their sell stop losses. This is why price often spikes to hit 'obvious' stop loss levels before reversing.",
        bullets: [
          "Liquidity = pools of orders at specific price levels",
          "Retail stop losses create predictable liquidity pools",
          "Institutions need liquidity to fill large positions",
          "Price is drawn to liquidity before making real moves"
        ]
      },
      {
        title: "Where Liquidity Pools Form",
        content: "Liquidity pools form in predictable locations because retail traders place stops in predictable ways: 1) Above obvious swing highs (buy-side liquidity), 2) Below obvious swing lows (sell-side liquidity), 3) Above/below equal highs and equal lows, 4) Above/below trendlines.\n\nWhen you can identify where retail traders have their stops, you can anticipate where price might spike before reversing. This understanding transforms you from being hunted to being the hunter.",
        bullets: [
          "Above swing highs: Buy-side liquidity (shorts' stops)",
          "Below swing lows: Sell-side liquidity (longs' stops)",
          "Equal highs/lows are high-probability targets",
          "Trendline breaks also trigger stop clusters"
        ],
        tradingExample: {
          setup: "EUR/USD has three equal lows at 1.0750 over two weeks. Retail traders are long with stops just below 1.0750",
          entry: "You anticipate a liquidity grab. Price drops to 1.0740, triggering stops. You see a strong rejection candle",
          management: "You go long at 1.0755 with stop at 1.0730, targeting the liquidity above at 1.0850",
          outcome: "The 'stop hunt' provided the liquidity for institutions to buy. Price reverses and rallies 100 pips."
        }
      },
      {
        title: "The Liquidity Grab Pattern",
        content: "A liquidity grab (or stop hunt) occurs when price briefly pierces a key level to trigger stops, then immediately reverses. You'll see a wick that sweeps through support/resistance, takes out stops, and closes back within the range.\n\nThis is one of the most powerful setups in trading. When you see price grab liquidity and show a strong rejection, you're witnessing institutions filling orders. Enter in the direction of the rejection for high-probability trades.",
        bullets: [
          "Price briefly breaks key level then reverses sharply",
          "Long wicks often indicate liquidity grabs",
          "Wait for rejection before entering",
          "These setups often lead to strong directional moves"
        ]
      },
      {
        title: "Buy-Side vs. Sell-Side Liquidity",
        content: "Buy-side liquidity (BSL) sits above swing highs and equal highs. This is where traders who are short have their stop losses (buy stops). When price sweeps BSL, it triggers these buy stops, creating buying pressure.\n\nSell-side liquidity (SSL) sits below swing lows and equal lows. This is where traders who are long have their stop losses (sell stops). When price sweeps SSL, it triggers these sell stops, creating selling pressure.\n\nUnderstanding this dynamic helps you anticipate where price is likely to go and which side of the market will be targeted.",
        bullets: [
          "BSL (Buy-Side Liquidity) = above highs, shorts' stops",
          "SSL (Sell-Side Liquidity) = below lows, longs' stops",
          "Price often sweeps one side before reversing",
          "Identify which liquidity pool price is likely targeting"
        ]
      },
      {
        title: "Trading with Liquidity Concepts",
        content: "Smart money trading often follows this sequence: 1) Price takes liquidity (grabs stops), 2) Creates a displacement move (strong directional candles), 3) Leaves behind an FVG and/or order block, 4) Returns to fill the FVG/OB, 5) Continues in the intended direction.\n\nYour job is to identify where liquidity has been taken and then look for entry opportunities in the FVGs/OBs created by the displacement move. This puts you in alignment with institutional order flow.",
        bullets: [
          "Watch for liquidity grabs at obvious levels",
          "After the grab, look for displacement (impulse move)",
          "Wait for retracement to FVG/OB for entry",
          "Trade in the direction of the post-grab move"
        ]
      }
    ],
    keyPoints: [
      "Liquidity pools form where retail traders place stop losses predictably",
      "Price is drawn to liquidity before making significant moves",
      "Liquidity grabs (stop hunts) create high-probability reversal setups",
      "After liquidity is taken, look for FVG/OB entries in the reversal direction"
    ],
    commonMistakes: [
      "Placing stops at obvious levels without considering the hunt",
      "Entering before the liquidity grab completes",
      "Not waiting for rejection confirmation after a sweep",
      "Assuming every level break is a liquidity grab (sometimes it's real breakout)",
      "Fighting the direction after liquidity is taken"
    ],
    relatedLessons: [5, 6, 8, 11],
    quiz: [
      {
        id: 1,
        question: "Where does buy-side liquidity typically form?",
        options: ["Below swing lows", "Above swing highs", "At round numbers only", "At the market open"],
        correctAnswer: 1,
        explanation: "Buy-side liquidity forms above swing highs where short traders have their stop losses (buy stops). When price sweeps this level, it triggers these buy orders."
      },
      {
        id: 2,
        question: "What indicates a liquidity grab has occurred?",
        options: ["High volume", "Price briefly pierces a key level then reverses sharply", "Many small candles", "A gap on the chart"],
        correctAnswer: 1,
        explanation: "A liquidity grab is identified when price briefly breaks through a key support/resistance level to trigger stops, then immediately reverses - often creating a long wick."
      },
      {
        id: 3,
        question: "After a liquidity grab, what should you look for?",
        options: ["Another liquidity grab", "Entry at the FVG/Order Block created by the displacement move", "Exit the market entirely", "Add to losing positions"],
        correctAnswer: 1,
        explanation: "After a liquidity grab, price typically creates a displacement move that leaves FVGs and order blocks. Wait for price to retrace to these zones for high-probability entries."
      }
    ],
    diagrams: ["liquidity-sweep"]
  },
  {
    id: 8,
    title: "Premium and Discount Zones: Where to Buy and Sell",
    description: "Use institutional pricing logic to always buy low and sell high. Learn the Fibonacci-based framework that defines fair value.",
    category: "smart-money",
    difficulty: "Intermediate",
    duration: "30 min",
    isFree: false,
    sections: [
      {
        title: "The Concept of Fair Value",
        content: "Every price range has a 'fair value' - the equilibrium point where price is neither cheap nor expensive. In Smart Money Concepts, we use the 50% level of any range as fair value. Anything below 50% is a 'discount' (cheap). Anything above 50% is a 'premium' (expensive).\n\nSmart money buys in discount zones and sells in premium zones. Retail traders do the opposite - they chase price into premiums when buying and sell into discounts out of fear. This simple framework helps you align with institutional trading logic.",
        bullets: [
          "Fair Value = 50% of the price range (equilibrium)",
          "Discount Zone = below 50% of range (cheap, buy here)",
          "Premium Zone = above 50% of range (expensive, sell here)",
          "Smart money buys discounts, sells premiums"
        ]
      },
      {
        title: "Defining the Range",
        content: "To apply premium and discount concepts, you first need to define your range. The most common approach uses the swing high to swing low of the current leg: 1) Identify the most recent significant swing high, 2) Identify the most recent significant swing low, 3) Draw a Fibonacci retracement from swing low to swing high (for uptrends) or swing high to swing low (for downtrends).\n\nThe 50% level is fair value. For buys, you want entries below 50% (discount). For sells, you want entries above 50% (premium). The best entries are often in the 61.8-79% zone, sometimes called the 'Optimal Trade Entry' (OTE) zone.",
        bullets: [
          "Measure from swing high to swing low",
          "50% = fair value (equilibrium point)",
          "Discount = below 50% | Premium = above 50%",
          "Optimal Trade Entry often in 61.8-79% zone"
        ],
        tradingExample: {
          setup: "GBP/USD rallied from 1.2500 (swing low) to 1.2700 (swing high). Fair value is 1.2600. Discount zone below 1.2600",
          entry: "Price retraces to 1.2560 (70% retracement, deep discount). You see a bullish order block here",
          management: "Stop below swing low 1.2500, target new high above 1.2700",
          outcome: "Buying in discount with OB confluence leads to 3:1 reward-to-risk trade"
        }
      },
      {
        title: "Why Premium/Discount Matters for Entry",
        content: "Entering in discount (for longs) or premium (for shorts) automatically improves your risk-to-reward. If you buy at the 70% retracement, your stop loss can be tighter and your profit target larger compared to chasing price near highs.\n\nThis concept also helps filter setups. If you're looking for long trades, skip setups that form in premium zones. If you're looking for shorts, skip setups in discount zones. This simple filter eliminates many low-probability trades.",
        bullets: [
          "Discount entries = better risk-to-reward for longs",
          "Premium entries = better risk-to-reward for shorts",
          "Filter out setups in the 'wrong' zone",
          "This alone improves trading results significantly"
        ]
      },
      {
        title: "Combining with Order Blocks and FVGs",
        content: "The most powerful setups occur when order blocks or FVGs form within the correct zone. A bullish order block in a discount zone is higher probability than one in a premium zone. A bearish FVG in a premium zone is higher probability than one in a discount zone.\n\nUse premium/discount as a filter: identify your POIs (points of interest like OBs and FVGs), then check if they're in the right zone for your trade direction. If everything aligns, you have a high-confluence setup.",
        bullets: [
          "Bullish OB/FVG in discount = high confluence",
          "Bearish OB/FVG in premium = high confluence",
          "Zone location acts as a filter for your POIs",
          "More confluences = higher probability trade"
        ]
      }
    ],
    keyPoints: [
      "Fair Value = 50% of range | Discount = below 50% | Premium = above 50%",
      "Buy in discounts, sell in premiums like institutions do",
      "The 61.8-79% retracement zone is often optimal for entries",
      "Use zone logic to filter OB/FVG setups for higher probability"
    ],
    commonMistakes: [
      "Buying in premium zones (chasing price near highs)",
      "Selling in discount zones (panicking near lows)",
      "Using wrong swing points to define the range",
      "Not waiting for price to reach discount/premium before entry",
      "Ignoring the zone filter when looking for trade setups"
    ],
    relatedLessons: [5, 6, 11, 12],
    quiz: [
      {
        id: 1,
        question: "What percentage of a range is considered 'fair value'?",
        options: ["25%", "50%", "75%", "100%"],
        correctAnswer: 1,
        explanation: "Fair value is the 50% level of any range - the equilibrium point. Anything below is discount, anything above is premium."
      },
      {
        id: 2,
        question: "Where should you look for long (buy) trade entries?",
        options: ["In premium zones", "In discount zones", "Anywhere price is moving up", "Only at exact highs"],
        correctAnswer: 1,
        explanation: "Long trade entries should be sought in discount zones (below 50% of range) where price is cheap. This aligns with institutional buying logic."
      },
      {
        id: 3,
        question: "What is the 'Optimal Trade Entry' zone often considered to be?",
        options: ["0-25%", "25-50%", "61.8-79%", "90-100%"],
        correctAnswer: 2,
        explanation: "The 61.8-79% retracement zone is often called the Optimal Trade Entry zone because it offers excellent risk-to-reward while price is still in discount/premium."
      }
    ]
  },
  {
    id: 9,
    title: "Trading Sessions: Time Your Trades Like Institutions",
    description: "Not all trading hours are equal. Learn when London and New York create the volatility you need and when to stay away.",
    category: "strategies",
    difficulty: "Intermediate",
    duration: "30 min",
    isFree: false,
    sections: [
      {
        title: "The Four Major Trading Sessions",
        content: "The forex market operates 24/5, but not all hours are created equal. Trading is divided into four major sessions: Sydney (22:00-07:00 GMT), Tokyo (00:00-09:00 GMT), London (08:00-17:00 GMT), and New York (13:00-22:00 GMT).\n\nEach session has different characteristics. Sydney and Tokyo are typically lower volatility. London is the highest volume session. New York overlaps with London, creating the most volatile period of the day. Understanding these sessions helps you trade when conditions favor your strategy.",
        bullets: [
          "Sydney/Tokyo: Lower volatility, range-bound conditions",
          "London: Highest volume, tends to establish daily direction",
          "New York: Overlaps with London for peak volatility",
          "Each session has distinct behavior patterns"
        ]
      },
      {
        title: "London Session: Where Trends Begin",
        content: "The London session (08:00-17:00 GMT) handles about 35% of all forex trading volume. This is when European institutions and banks are active. Key characteristics: 1) Often reverses Asian session moves, 2) Establishes the daily high or low early, 3) Creates strong directional moves with follow-through.\n\nThe 'London Open Kill Zone' (08:00-11:00 GMT) is particularly important. This is when smart money makes their moves for the day. Many traders focus exclusively on this window because of its consistency.",
        bullets: [
          "08:00-17:00 GMT (adjust for daylight savings)",
          "Often reverses Asian session moves at open",
          "London Open Kill Zone: 08:00-11:00 GMT",
          "Usually establishes daily high or low during this session"
        ],
        tradingExample: {
          setup: "Asian session pushed EUR/USD up to 1.0850. You notice this is into a bearish order block from the daily chart",
          entry: "At London open, price sweeps 1.0855 (Asian high), takes buy-side liquidity, and shows strong rejection",
          management: "Short at 1.0845 with stop above sweep, target sell-side liquidity at 1.0780",
          outcome: "Classic London reversal pattern. Price drops 70 pips during London session."
        }
      },
      {
        title: "New York Session: Continuation or Reversal",
        content: "The New York session (13:00-22:00 GMT) is the second most important for forex. The 'NY Open Kill Zone' (13:00-16:00 GMT) often provides: 1) Continuation of London moves, OR 2) Reversal if London overextended.\n\nThe London-New York overlap (13:00-17:00 GMT) is the most volatile period. When both sessions are active simultaneously, major moves occur. Economic releases during this overlap (like US data at 13:30 GMT) can cause massive volatility.",
        bullets: [
          "13:00-22:00 GMT (adjust for daylight savings)",
          "NY Open Kill Zone: 13:00-16:00 GMT",
          "London-NY overlap = highest volatility period",
          "Often continues or reverses London's move"
        ]
      },
      {
        title: "Session Highs and Lows as Targets",
        content: "Each session creates highs and lows that act as liquidity pools and targets. Asian session high/low often gets taken during London. London session high/low often gets taken during New York. These session levels provide: 1) Entry points (when swept), 2) Profit targets (high probability targets).\n\nA powerful strategy: Note the Asian session high and low before London opens. If price sweeps one level and reverses, target the other side. If Asian range was 1.0800-1.0830, and London sweeps 1.0830 and reverses, target 1.0800.",
        bullets: [
          "Each session creates defined high and low",
          "These levels are liquidity pools",
          "London often targets Asian session levels",
          "Session sweeps + reversal = high probability trades"
        ]
      },
      {
        title: "When to Avoid Trading",
        content: "Not all times are worth trading. Avoid: 1) The 'dead zone' between NY close and Asian open (22:00-00:00 GMT), 2) Mid-Asian session (very low volatility), 3) Before major news releases (spreads widen), 4) Friday afternoon NY (reduced liquidity), 5) Major holidays.\n\nQuality over quantity. Trading only during London Open and NY Open kill zones gives you the highest probability conditions. Many successful traders take just 1-2 setups per day during these windows.",
        bullets: [
          "Avoid 22:00-00:00 GMT 'dead zone'",
          "Avoid trading right before major news",
          "Friday NY afternoon has low liquidity",
          "Focus on kill zones for highest probability"
        ]
      }
    ],
    keyPoints: [
      "London and New York sessions have 80%+ of daily volume",
      "Kill Zones: London Open 08:00-11:00 | NY Open 13:00-16:00 GMT",
      "Session highs/lows are liquidity targets",
      "Quality over quantity - focus on the best hours only"
    ],
    commonMistakes: [
      "Trading during low-volume Asian session expecting breakouts",
      "Ignoring session context (trying London strategies in NY)",
      "Not adjusting for daylight savings time shifts",
      "Overtrading during dead zones due to boredom",
      "Missing the London/NY kill zones and then forcing trades"
    ],
    relatedLessons: [7, 10, 14],
    quiz: [
      {
        id: 1,
        question: "Which session handles the highest forex trading volume?",
        options: ["Sydney", "Tokyo", "London", "New York"],
        correctAnswer: 2,
        explanation: "The London session handles approximately 35% of all forex trading volume, making it the most important session for trading opportunities."
      },
      {
        id: 2,
        question: "What is the 'London Open Kill Zone'?",
        options: ["When markets are closed", "08:00-11:00 GMT", "The last hour of London session", "Only during news releases"],
        correctAnswer: 1,
        explanation: "The London Open Kill Zone is 08:00-11:00 GMT, when smart money makes their major moves for the day. This is a high-probability trading window."
      },
      {
        id: 3,
        question: "What often happens to Asian session highs/lows during London?",
        options: ["They're never touched", "They're often swept (taken) by London moves", "They become irrelevant", "Price always reverses before reaching them"],
        correctAnswer: 1,
        explanation: "Asian session highs and lows are often swept during London session as they represent liquidity pools. This sweep-and-reverse pattern is a common trading opportunity."
      }
    ]
  },
  {
    id: 10,
    title: "Multi-Timeframe Analysis: The Top-Down Approach",
    description: "Learn to align your trades with the bigger picture. Understand how higher timeframe bias creates lower timeframe opportunities.",
    category: "strategies",
    difficulty: "Intermediate",
    duration: "35 min",
    isFree: false,
    sections: [
      {
        title: "Why Multiple Timeframes Matter",
        content: "Imagine you're in a forest (5-minute chart) and see a clear path forward. But from a helicopter (daily chart), you'd see that path leads to a cliff. This is why multi-timeframe analysis matters. Lower timeframes show noise and detail; higher timeframes show the true trend and key levels.\n\nTrading without multi-timeframe analysis is like driving while only looking 10 feet ahead. You might dodge immediate obstacles but miss the bigger picture. The best traders use higher timeframes for bias and lower timeframes for precision entries.",
        bullets: [
          "Higher TF = trend direction and key levels",
          "Lower TF = precision entries and timing",
          "Trading against HTF trend = fighting the current",
          "Align all timeframes for highest probability"
        ]
      },
      {
        title: "The Three-Timeframe Framework",
        content: "A proven framework uses three timeframes: 1) Higher Timeframe (HTF) - for overall bias and major levels, 2) Intermediate Timeframe (ITF) - for structure and setup identification, 3) Lower Timeframe (LTF) - for precise entry execution.\n\nCommon combinations: Day traders might use Daily (HTF), 4H (ITF), 15M (LTF). Swing traders might use Weekly (HTF), Daily (ITF), 4H (LTF). Each timeframe should be 4-6x larger than the next for optimal balance.",
        bullets: [
          "HTF: Daily or Weekly for bias",
          "ITF: 4H or Daily for structure/setup",
          "LTF: 15M or 1H for entry timing",
          "Each timeframe 4-6x larger than the next"
        ],
        tradingExample: {
          setup: "Daily chart shows GBP/USD in clear uptrend with price pulling back to daily FVG. 4H shows CHoCH warning. 15M shows bullish BOS within the daily FVG",
          entry: "Daily bias is bullish. 4H showing retracement. 15M confirming reversal. You enter long on the 15M BOS",
          management: "Stop below 15M swing low (tight), target the 4H swing high",
          outcome: "Multi-timeframe alignment gave a high-probability entry with tight stop and large target (4:1 R:R)"
        }
      },
      {
        title: "Establishing Higher Timeframe Bias",
        content: "Before looking at lower timeframes, establish your HTF bias. Ask: 1) What is the trend? (HH/HL or LH/LL), 2) Where are the key levels? (major support/resistance), 3) Where are the HTF order blocks and FVGs?, 4) Is price in premium or discount?\n\nYour HTF bias determines which direction you'll trade on lower timeframes. If Daily is bullish, only look for long setups on 4H and 15M. If Daily is bearish, only look for shorts. This filter alone dramatically improves win rate.",
        bullets: [
          "Determine HTF trend first",
          "Mark HTF levels, OBs, and FVGs",
          "Only trade in the HTF direction",
          "This filter eliminates many losing trades"
        ]
      },
      {
        title: "Refining Entries on Lower Timeframes",
        content: "Once you have HTF bias and ITF setup, drop to LTF for entry. On the lower timeframe, look for: 1) Break of Structure confirming direction, 2) Order blocks forming in the direction of HTF bias, 3) FVGs to enter on, 4) Rejection candles showing reversal.\n\nThe LTF entry should align with everything above. If HTF is bullish, ITF is pulling back to support, and LTF shows bullish BOS - that's maximum alignment. Enter with confidence.",
        bullets: [
          "Wait for LTF confirmation of HTF direction",
          "Look for BOS in the direction of your bias",
          "Use LTF OBs/FVGs for precise entry",
          "Rejection candles confirm the reversal"
        ]
      },
      {
        title: "When Timeframes Conflict",
        content: "Sometimes timeframes conflict - maybe Daily is bullish but 4H is bearish. Rules for conflict: 1) HTF always wins for bias, 2) Conflicting timeframes = wait for alignment, 3) ITF against HTF often means retracement (not reversal), 4) Don't force trades when unclear.\n\nPatience pays. If Daily is bullish but 4H is pulling back, wait. Either 4H will confirm the pullback is over (opportunity), or it will change Daily bias (avoid longs). Don't trade uncertainty.",
        bullets: [
          "HTF bias takes priority over LTF moves",
          "Conflicting TFs = wait for clarity",
          "ITF against HTF usually = retracement",
          "No alignment = no trade"
        ]
      }
    ],
    keyPoints: [
      "Always establish HTF bias before looking at lower timeframes",
      "Use 3 timeframes: HTF (bias), ITF (structure), LTF (entry)",
      "Only trade in the direction of HTF trend",
      "When timeframes conflict, wait for alignment or stay out"
    ],
    commonMistakes: [
      "Trading LTF setups against HTF trend",
      "Skipping HTF analysis and jumping straight to 15M",
      "Using too many timeframes (analysis paralysis)",
      "Ignoring HTF levels when placing stops",
      "Forcing trades when timeframes don't align"
    ],
    relatedLessons: [2, 5, 6, 9],
    quiz: [
      {
        id: 1,
        question: "What is the purpose of the Higher Timeframe in multi-timeframe analysis?",
        options: ["Finding precise entries", "Determining overall bias and key levels", "Day trading scalps", "Identifying exact stop loss placement"],
        correctAnswer: 1,
        explanation: "The Higher Timeframe (HTF) is used to determine overall market bias and identify major support/resistance levels. It tells you which direction to trade."
      },
      {
        id: 2,
        question: "If the Daily chart shows a bullish trend but the 4H is bearish, what should you do?",
        options: ["Go short following 4H", "Go long ignoring 4H", "Wait for alignment or see it as a pullback opportunity", "Switch to 1-minute chart"],
        correctAnswer: 2,
        explanation: "When timeframes conflict, either wait for alignment or recognize the ITF move as a retracement within the HTF trend. The HTF bias takes priority."
      },
      {
        id: 3,
        question: "What's a typical ratio between timeframes in multi-timeframe analysis?",
        options: ["2x larger", "4-6x larger", "10x larger", "100x larger"],
        correctAnswer: 1,
        explanation: "Each timeframe should be approximately 4-6x larger than the next for optimal balance. For example: Daily (6x), 4H, 15-30M."
      }
    ]
  },
  {
    id: 11,
    title: "Building a Complete Trade Setup",
    description: "Put all the pieces together. Learn the step-by-step process from analysis to entry to exit that professional traders follow.",
    category: "strategies",
    difficulty: "Advanced",
    duration: "45 min",
    isFree: false,
    sections: [
      {
        title: "The 7-Step Trade Setup Process",
        content: "Professional traders follow a systematic process for every trade. This isn't about finding 'one weird trick' - it's about consistently applying a framework. Here's the proven 7-step process: 1) HTF Bias, 2) Key Levels, 3) Wait for Price in Zone, 4) LTF Confirmation, 5) Entry Execution, 6) Stop Loss Placement, 7) Target Setting.\n\nEach step filters out bad trades. By the time you reach step 5, you've eliminated 90% of low-probability setups. This systematic approach is what separates professionals from gamblers.",
        bullets: [
          "Step 1: Establish Higher Timeframe Bias",
          "Step 2: Mark Key Levels (OBs, FVGs, S/R)",
          "Step 3: Wait for Price to Reach Your Zone",
          "Step 4-7: Confirm, Enter, Stop, Target"
        ]
      },
      {
        title: "Step 1-2: HTF Analysis and Level Marking",
        content: "Start fresh each day with a clean HTF chart. Ask yourself: 1) Is price making HH/HL (bullish) or LH/LL (bearish)?, 2) Where was the last significant order block?, 3) Are there any unmitigated FVGs?, 4) Where are the obvious liquidity pools?\n\nMark only the MOST significant levels. If your chart is cluttered with 20 zones, you've marked too many. Focus on 2-3 high-quality POIs (points of interest) that align with your bias. These are your 'areas of interest' for the day.",
        bullets: [
          "Start with clean charts each session",
          "Identify trend structure first",
          "Mark 2-3 high-quality POIs maximum",
          "Less is more - cluttered charts = confusion"
        ],
        tradingExample: {
          setup: "Daily EUR/USD: Bullish trend (HH/HL). Fresh bullish order block at 1.0820-1.0840. Unmitigated bullish FVG at 1.0850-1.0865. Buy-side liquidity above 1.0950",
          entry: "Your bias is bullish. Your entry zones are the OB (1.0820-1.0840) and FVG (1.0850-1.0865). Your target is the BSL at 1.0950",
          management: "Now you wait. You don't force trades. You wait for price to come to you.",
          outcome: "Having a clear plan before price arrives keeps you objective and prevents impulsive trades."
        }
      },
      {
        title: "Step 3-4: Waiting and LTF Confirmation",
        content: "This is where most traders fail - they can't wait. Once you've marked your zones, you WAIT for price to arrive. No chasing, no FOMO. You've identified where institutions are likely to act, and you wait for them.\n\nWhen price reaches your zone, drop to LTF for confirmation. You're looking for: 1) Break of Structure in your direction, 2) Rejection candles (pin bars, engulfing), 3) Mini order blocks/FVGs forming, 4) Shift in momentum. Without confirmation, you don't enter.",
        bullets: [
          "Patience: Wait for price to reach your zones",
          "No zone touch = no trade (no exceptions)",
          "LTF confirmation prevents false entries",
          "Look for BOS, rejection candles, momentum shift"
        ]
      },
      {
        title: "Step 5-6: Entry and Stop Loss",
        content: "Entry methods: 1) Limit order in the zone (aggressive - higher risk, better R:R), 2) Wait for LTF confirmation then market enter (safer - lower R:R), 3) Stop entry above/below LTF structure (catches momentum).\n\nStop loss placement: Your stop goes at the level where your trade idea is WRONG. If you're buying an order block, your stop goes below the order block (if price reaches there, the OB failed). Add a few pips buffer for spread and wicks. Never use arbitrary pip values.",
        bullets: [
          "Entry: Limit (aggressive) or Market after confirmation",
          "Stop Loss: Where your trade idea is invalidated",
          "Place stops beyond the structure/zone",
          "Add buffer for spread and wicks (5-10 pips)"
        ]
      },
      {
        title: "Step 7: Target Setting and Trade Management",
        content: "Targets should be based on structure, not arbitrary R:R. Common targets: 1) Next significant swing high/low, 2) Unmitigated OB/FVG on the other side, 3) Obvious liquidity pool (equal highs/lows), 4) HTF level that hasn't been tested.\n\nTrade management: Once in profit, you have options. 1) Ride to target (higher R:R but may give back profit), 2) Move stop to breakeven after 1R gained, 3) Take partials at key levels. There's no 'right' answer - find what fits your psychology.",
        bullets: [
          "Targets: Swing points, OBs/FVGs, liquidity pools",
          "Aim for minimum 2:1 reward-to-risk",
          "Move stop to breakeven after +1R (optional)",
          "Take partials at significant levels (optional)"
        ]
      }
    ],
    keyPoints: [
      "Follow a systematic 7-step process for every trade",
      "Mark only 2-3 high-quality zones - less is more",
      "Wait for price to come to you - never chase",
      "No LTF confirmation = no entry (ever)"
    ],
    commonMistakes: [
      "Skipping the HTF analysis and jumping to entries",
      "Marking too many zones (cluttered charts)",
      "Entering without LTF confirmation (hope trading)",
      "Placing stops based on pip values not structure",
      "Having no clear target before entering"
    ],
    relatedLessons: [5, 6, 7, 8, 10],
    quiz: [
      {
        id: 1,
        question: "How many high-quality POIs (Points of Interest) should you mark on your chart?",
        options: ["As many as possible", "2-3 maximum", "10-15", "Only 1"],
        correctAnswer: 1,
        explanation: "Less is more. Marking only 2-3 high-quality zones keeps your analysis clean and focused. Too many zones create confusion and analysis paralysis."
      },
      {
        id: 2,
        question: "What should determine your stop loss placement?",
        options: ["A fixed number of pips", "The level where your trade idea is invalidated", "Half of your target", "Your account size"],
        correctAnswer: 1,
        explanation: "Stop loss should be placed at the level where your trade idea is proven wrong - below an order block for longs, above for shorts. Structure determines stops, not arbitrary pips."
      },
      {
        id: 3,
        question: "What do you do if price reaches your zone but shows no LTF confirmation?",
        options: ["Enter anyway", "Add to your position", "Do NOT enter", "Use a larger stop loss"],
        correctAnswer: 2,
        explanation: "No confirmation = no entry. Even at a good zone, you need LTF confirmation (BOS, rejection candles) before entering. This prevents many false entries."
      }
    ]
  },
  {
    id: 12,
    title: "Risk Management: The Only Thing That Matters",
    description: "Learn why position sizing and risk control separate winners from losers. Master the math that keeps you in the game.",
    category: "fundamentals",
    difficulty: "Beginner",
    duration: "35 min",
    isFree: false,
    sections: [
      {
        title: "Why Risk Management Is Everything",
        content: "Here's a harsh truth: you can have a 70% win rate and still blow your account. How? By risking 20% on winners and 30% on losers. Conversely, you can have a 40% win rate and be consistently profitable by risking 1% with a 3:1 reward-to-risk ratio.\n\nRisk management isn't about avoiding losses - losses are inevitable. It's about ensuring that your losses are controlled and your wins more than compensate. This is the ONLY thing that determines long-term profitability.",
        bullets: [
          "Win rate alone doesn't determine profitability",
          "Risk management = controlled losses + adequate wins",
          "1% risk with 3:1 R:R beats 5% risk with 1:1 R:R",
          "This is the #1 skill that separates pros from amateurs"
        ]
      },
      {
        title: "The 1-2% Rule",
        content: "The industry standard is to risk 1-2% of your account per trade. On a $10,000 account, this means risking $100-$200 per trade. Why these numbers? Because even with 10 consecutive losses (rare but possible), you've only lost 10-20% of your account and can recover.\n\nRisking more than 2% creates exponential drawdown problems. A 50% loss requires a 100% gain to recover. A 20% loss only requires a 25% gain. The math strongly favors smaller risk percentages.",
        bullets: [
          "Risk 1-2% of account per trade maximum",
          "10 losses at 2% = 20% drawdown (recoverable)",
          "10 losses at 10% = 65% drawdown (devastating)",
          "Lower risk = easier recovery from drawdowns"
        ],
        tradingExample: {
          setup: "$10,000 account. You find a setup on EUR/USD with stop loss 30 pips away",
          entry: "At 1% risk ($100), you calculate position size: $100 / 30 pips = $3.33 per pip = 0.33 lots",
          management: "Target is 60 pips away. Potential profit: 60 x $3.33 = $200 (2% gain)",
          outcome: "Whether you win or lose, the impact is measured. 10 trades like this won't make or break your account."
        }
      },
      {
        title: "Position Sizing Calculation",
        content: "Position size = (Account Size × Risk %) / (Stop Loss in Pips × Pip Value). Example: $10,000 account, 1% risk = $100. Stop loss is 50 pips. For EUR/USD, pip value per standard lot is $10. Position size = $100 / (50 × $10) = 0.2 lots.\n\nAlways calculate position size BEFORE entering a trade. Never enter first and figure out size later. This calculation ensures that every trade has the same risk impact on your account, regardless of the stop loss distance.",
        bullets: [
          "Calculate size BEFORE entering",
          "Risk Amount = Account × Risk %",
          "Position Size = Risk Amount / (Stop × Pip Value)",
          "Use a position size calculator until it's automatic"
        ]
      },
      {
        title: "Reward-to-Risk Ratio",
        content: "Reward-to-Risk (R:R) ratio compares your potential profit to your potential loss. A 2:1 R:R means you're targeting twice as much as you're risking. A 3:1 means three times.\n\nThe minimum recommended R:R is 2:1. At this ratio, you only need to win 34% of trades to break even. At 3:1, you only need 25%. This is why smart money traders don't need high win rates - their R:R compensates.",
        bullets: [
          "R:R = Target Distance / Stop Distance",
          "Minimum 2:1 recommended (better: 3:1+)",
          "At 2:1, breakeven win rate is 34%",
          "At 3:1, breakeven win rate is 25%",
          "Higher R:R = more forgiveness for losses"
        ]
      },
      {
        title: "The Expectancy Formula",
        content: "Expectancy tells you the average amount you'll make (or lose) per trade. Formula: Expectancy = (Win Rate × Average Win) - (Loss Rate × Average Loss). If positive, you're profitable over time. If negative, you're losing money.\n\nExample: 50% win rate, average win $200, average loss $100. Expectancy = (0.5 × 200) - (0.5 × 100) = 100 - 50 = $50 per trade. Over 100 trades, that's $5,000 profit. This is why you journal and track statistics.",
        bullets: [
          "Expectancy = (WR × Avg Win) - (LR × Avg Loss)",
          "Positive expectancy = long-term profitability",
          "Track your real numbers to know your expectancy",
          "Even modest positive expectancy compounds over time"
        ]
      }
    ],
    keyPoints: [
      "Risk 1-2% of account per trade - never more",
      "Calculate position size BEFORE entering based on stop distance",
      "Minimum 2:1 reward-to-risk ratio (aim for 3:1+)",
      "Track your stats to know your true expectancy"
    ],
    commonMistakes: [
      "Risking 5-10% because you're 'confident' in the trade",
      "Using the same lot size regardless of stop distance",
      "Taking 1:1 trades regularly (mediocre even at 60% WR)",
      "Not knowing your actual win rate and average R:R",
      "Increasing risk after losses to 'make it back'"
    ],
    relatedLessons: [1, 17, 18, 19],
    quiz: [
      {
        id: 1,
        question: "What is the recommended risk per trade?",
        options: ["5-10%", "1-2%", "0.1%", "10-20%"],
        correctAnswer: 1,
        explanation: "The industry standard is risking 1-2% per trade. This allows you to survive losing streaks and recover from drawdowns without devastating your account."
      },
      {
        id: 2,
        question: "With a 3:1 reward-to-risk ratio, what win rate do you need to break even?",
        options: ["50%", "75%", "25%", "10%"],
        correctAnswer: 2,
        explanation: "At 3:1 R:R, you only need to win 25% of trades to break even. Winning 1 out of 4 trades at 3:1 means: (1 × 3) - (3 × 1) = 0. Any higher win rate is profitable."
      },
      {
        id: 3,
        question: "When should you calculate position size?",
        options: ["After entering the trade", "When the trade is in profit", "Before entering based on stop distance", "It doesn't matter"],
        correctAnswer: 2,
        explanation: "Position size should be calculated BEFORE entering based on your risk percentage and stop loss distance. This ensures consistent risk across all trades."
      }
    ],
    diagrams: ["risk-reward"]
  },
  {
    id: 13,
    title: "The Trading Journal: Your Path to Improvement",
    description: "Learn how to document your trades effectively and extract the insights that lead to consistent improvement.",
    category: "fundamentals",
    difficulty: "Beginner",
    duration: "25 min",
    isFree: false,
    sections: [
      {
        title: "Why Journaling Is Non-Negotiable",
        content: "Would you try to improve at chess without reviewing your games? Would a basketball player skip watching game tape? Trading journaling is the same - it's how you identify patterns in your behavior, find weaknesses, and reinforce strengths.\n\nWithout a journal, you're trading blind. You might make the same mistakes for years without realizing it. With a journal, those patterns become obvious within weeks. Every professional trader keeps detailed records.",
        bullets: [
          "Journals reveal patterns you can't see in real-time",
          "Same mistakes repeat until you document and analyze them",
          "Professionals treat journaling as seriously as trading itself",
          "No journal = no improvement path"
        ]
      },
      {
        title: "What to Record for Every Trade",
        content: "Essential trade data: 1) Date and time, 2) Pair/instrument, 3) Direction (long/short), 4) Entry price, 5) Stop loss, 6) Take profit, 7) Position size, 8) Actual exit price, 9) P&L in pips and dollars, 10) R multiple (how many R you made/lost).\n\nBeyond the basics: 11) The setup that triggered entry (OB, FVG, etc.), 12) Higher timeframe bias, 13) Screenshot of the setup, 14) What went right, 15) What went wrong, 16) Emotional state before/during/after, 17) Rule violations (if any).",
        bullets: [
          "Basic: Date, pair, direction, entry, SL, TP, exit, P&L",
          "Advanced: Setup type, HTF bias, screenshots",
          "Critical: What went right/wrong, emotions, rule violations",
          "Take screenshots - you'll want to review visuals"
        ],
        tradingExample: {
          setup: "Trade Journal Entry Example - EUR/USD Long, March 15, 2024",
          entry: "Setup: 4H bullish OB in daily discount zone. Entry: 1.0820 after 15M BOS. Stop: 1.0780 (-40 pips). Target: 1.0900 (+80 pips). Size: 0.5 lots",
          management: "Result: Hit TP at 1.0900. +80 pips, +$400, +2R. What went right: Followed the plan exactly, waited for LTF confirmation. Emotion: Calm, confident in the setup.",
          outcome: "This entry teaches you to trust your process. Reviewing winning trades reinforces good habits."
        }
      },
      {
        title: "Tracking Emotions and Psychology",
        content: "The psychological data in your journal is often more valuable than the trade data. Track: 1) How you felt before the trade (confident? anxious? bored?), 2) Did you follow your rules or deviate?, 3) Did you move your stop or exit early?, 4) How did you feel after (regardless of outcome)?\n\nPatterns emerge quickly: 'I notice I take bad trades when bored in the afternoon.' 'I move my stop when I'm anxious.' 'My best trades happen when I feel calm and patient.' These insights are gold.",
        bullets: [
          "Track emotional state before, during, and after",
          "Note any rule violations honestly",
          "Record if you deviated from the plan",
          "Look for correlations between emotions and results"
        ]
      },
      {
        title: "Weekly and Monthly Reviews",
        content: "Daily entries are just raw data. The magic happens in reviews. Weekly review (15-20 min): 1) How many trades? 2) Win rate this week? 3) Total R gained/lost? 4) Best trade and why? 5) Worst trade and why? 6) Patterns noticed?\n\nMonthly review (1 hour): Deep analysis of stats, common mistakes, best setups, worst setups, emotional patterns, goals for next month. This regular review cycle is what drives improvement.",
        bullets: [
          "Weekly: Quick stats, best/worst trades, patterns",
          "Monthly: Deep dive into all statistics",
          "Look for recurring mistakes to eliminate",
          "Identify your most profitable setups to focus on"
        ]
      },
      {
        title: "Using Journal Data to Improve",
        content: "After a month of journaling, you'll have data to analyze. Sort by: setup type (which setups are most profitable?), session (do you perform better in London or NY?), emotional state (do calm trades outperform anxious trades?), day of week, and more.\n\nThe data will tell you what to do more of and what to eliminate. If your OB trades are 60% winners but your FVG trades are 35%, focus on OBs. This is data-driven improvement, not guessing.",
        bullets: [
          "Analyze by setup type, session, emotion, day",
          "Identify your highest-probability setups",
          "Cut setups with poor historical results",
          "Double down on what's working"
        ]
      }
    ],
    keyPoints: [
      "Journal every trade - no exceptions",
      "Track both trade data AND psychological state",
      "Weekly and monthly reviews transform data into insights",
      "Use your data to focus on high-probability setups"
    ],
    commonMistakes: [
      "Only journaling winning trades (survivorship bias)",
      "Journaling but never reviewing",
      "Not tracking emotional state (missing key insights)",
      "Waiting too long between reviews (lose the context)",
      "Not taking screenshots (visual review is powerful)"
    ],
    relatedLessons: [1, 17, 18],
    quiz: [
      {
        id: 1,
        question: "What's the main purpose of a trading journal?",
        options: ["To show off wins", "To track taxes", "To identify patterns and improve systematically", "To remember old trades"],
        correctAnswer: 2,
        explanation: "The primary purpose of a trading journal is to identify patterns in your trading behavior - both good and bad - so you can systematically improve over time."
      },
      {
        id: 2,
        question: "What should you include beyond basic trade data?",
        options: ["Nothing else is needed", "Emotional state and rule violations", "Just screenshots", "Only winning trades"],
        correctAnswer: 1,
        explanation: "Recording emotional state and any rule violations is crucial. These psychological elements often reveal patterns that explain why trades went right or wrong."
      },
      {
        id: 3,
        question: "How often should you conduct in-depth reviews?",
        options: ["Only when losing", "Never - just enter trades", "Weekly (quick) and Monthly (deep)", "Once a year"],
        correctAnswer: 2,
        explanation: "Weekly quick reviews (15-20 min) and monthly deep reviews (1 hour) transform raw journal data into actionable insights for improvement."
      }
    ]
  },
  {
    id: 14,
    title: "Entry Techniques: Timing Your Entries Precisely",
    description: "Master the art of precise entries that maximize reward-to-risk. Learn limit orders, confirmation entries, and when to use each.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "40 min",
    isFree: false,
    sections: [
      {
        title: "The Three Entry Methods",
        content: "There are three main entry methods, each with trade-offs: 1) Aggressive (limit order in the zone), 2) Confirmation (market order after LTF confirmation), 3) Breakout (stop order beyond structure). Aggressive entries give the best R:R but lowest win rate. Confirmation entries sacrifice some R:R for higher probability. Breakout entries catch momentum but often have wider stops.",
        bullets: [
          "Aggressive: Limit order, best R:R, more losses",
          "Confirmation: Market after signal, balanced approach",
          "Breakout: Stop order, catches momentum, wider stops",
          "Choose based on your psychology and strategy"
        ]
      },
      {
        title: "Aggressive Entries with Limit Orders",
        content: "With limit orders, you're entering the moment price touches your zone - no waiting for confirmation. Place a buy limit at your bullish OB/FVG, or sell limit at bearish OB/FVG. This gives the tightest stops and best R:R.\n\nThe catch: many limit orders get triggered just before price continues against you. You're betting on the zone without confirmation. This works well with high-quality zones and strong confluence, but expect a lower win rate (often 40-45%).",
        bullets: [
          "Place order at the zone edge (or 50% of zone)",
          "Stop just beyond the zone",
          "Best for high-confidence zones with multiple confluences",
          "Accept lower win rate for better R:R"
        ],
        tradingExample: {
          setup: "Daily bullish OB at 1.0820-1.0840 in an uptrend. FVG overlaps. Premium/discount in deep discount",
          entry: "Buy limit at 1.0830 (middle of OB). Stop at 1.0815 (-15 pips). Target 1.0900 (+70 pips)",
          management: "If filled, R:R is 4.6:1. If price doesn't reach, no trade. If stopped out, loss is predefined",
          outcome: "High confluence zone justifies aggressive approach. The R:R compensates for miss rate."
        }
      },
      {
        title: "Confirmation Entries",
        content: "Confirmation entries wait for a Lower Timeframe signal before entering. When price reaches your zone, you wait for: 1) Break of Structure in your direction, 2) Engulfing candle or strong rejection, 3) Mini order block formation. Then you enter with a market order.\n\nThis approach has higher win rate but sacrifices some R:R because you enter after price has already moved from the zone. The trade-off is often worth it, especially when learning.",
        bullets: [
          "Wait for price to reach zone",
          "Drop to LTF and wait for confirmation signal",
          "Enter with market order after BOS or rejection",
          "Higher win rate, slightly worse R:R"
        ]
      },
      {
        title: "Breakout Entries",
        content: "Breakout entries use stop orders placed beyond a key level. A buy stop above a swing high enters you if price breaks up. A sell stop below a swing low enters you if price breaks down.\n\nThese catch momentum moves but often have larger stops (placed beyond the level that just broke). Best for trading structural breaks (BOS) when you want to catch the move rather than catch the retracement.",
        bullets: [
          "Stop order beyond key level",
          "Triggered when price breaks through",
          "Good for BOS plays and momentum",
          "Larger stops but high momentum trades"
        ]
      },
      {
        title: "Choosing Your Entry Style",
        content: "Your personality determines the best entry style: 1) If you can handle more losses for bigger wins: Aggressive, 2) If you need confirmation for confidence: Confirmation, 3) If you hate retracements: Breakout.\n\nMany traders combine: aggressive on A+ setups, confirmation on B+ setups, breakout on structural break plays. There's no single 'best' method - only what fits your psychology and produces positive expectancy.",
        bullets: [
          "Match entry style to your psychology",
          "Track results by entry type in your journal",
          "Can use different styles for different setups",
          "What matters is positive expectancy, not style"
        ]
      }
    ],
    keyPoints: [
      "Three entry methods: Aggressive (limit), Confirmation (market), Breakout (stop)",
      "Aggressive = best R:R, lower win rate | Confirmation = balanced | Breakout = momentum",
      "Choose based on your psychology and track results",
      "High confluence zones deserve aggressive entries"
    ],
    commonMistakes: [
      "Always using the same entry method regardless of setup quality",
      "Entering aggressively on low-confidence zones",
      "Not tracking which entry type works best for you",
      "Waiting too long for confirmation and missing the move",
      "Breakout entering without checking for FVG retest potential"
    ],
    relatedLessons: [5, 6, 11, 15],
    quiz: [
      {
        id: 1,
        question: "What is the trade-off with aggressive limit order entries?",
        options: ["Better win rate, worse R:R", "Worse win rate, better R:R", "Same as other methods", "They never work"],
        correctAnswer: 1,
        explanation: "Aggressive entries with limit orders give better R:R because you enter at the edge of the zone, but lower win rate because you're not waiting for confirmation."
      },
      {
        id: 2,
        question: "What do you wait for with confirmation entries?",
        options: ["Higher timeframe signal", "A week of price action", "LTF Break of Structure or rejection", "News release"],
        correctAnswer: 2,
        explanation: "Confirmation entries wait for Lower Timeframe signals like Break of Structure, engulfing candles, or strong rejection before entering with a market order."
      },
      {
        id: 3,
        question: "When are breakout entries most appropriate?",
        options: ["On every trade", "When trading structural breaks (BOS)", "Only in ranging markets", "Never"],
        correctAnswer: 1,
        explanation: "Breakout entries work well for trading structural breaks when you want to catch momentum rather than wait for a retracement. They're best for BOS plays."
      }
    ]
  },
  {
    id: 15,
    title: "Trade Management: From Entry to Exit",
    description: "Learn when to hold, when to move stops, when to take profits, and when to let winners run. The art of managing open positions.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "40 min",
    isFree: false,
    sections: [
      {
        title: "The Set-It-and-Forget-It Approach",
        content: "The simplest management style: enter trade, set stop loss, set take profit, walk away. Don't watch the trade. Don't move anything. Either your stop gets hit or your target does.\n\nThis eliminates emotional interference. You made the analysis when calm; now let the trade play out. Many professionals prefer this approach because it removes the temptation to meddle with trades mid-flight.",
        bullets: [
          "Set SL and TP, then step away",
          "Removes emotional decision-making",
          "Best for those who tend to interfere with trades",
          "Requires confidence in your original analysis"
        ]
      },
      {
        title: "Active Management: Moving Stops",
        content: "Active management involves adjusting your stop as the trade progresses. Common approaches: 1) Move to breakeven after 1R profit, 2) Trail stop behind swing points, 3) Trail below/above order blocks as they form.\n\nThe risk: moving stops too tight can get you stopped out of winning trades. The benefit: you lock in profits and can't turn a winner into a loser. Balance is key.",
        bullets: [
          "Breakeven after +1R is a common rule",
          "Trail behind swing points on LTF",
          "Trail behind new OBs that form",
          "Don't trail so tight you get stopped by noise"
        ],
        tradingExample: {
          setup: "Long EUR/USD from 1.0830, stop 1.0800, target 1.0920. Entry risk: 30 pips. 3:1 R:R potential.",
          entry: "Price moves to 1.0860 (+30 pips = 1R). You move stop to 1.0835 (just above entry, slight profit locked)",
          management: "Price makes a new swing low at 1.0850. You trail stop to 1.0845 (below new swing). Trade continues.",
          outcome: "Active management locked in profits while letting the trade run. Final exit at 1.0905 for +2.5R."
        }
      },
      {
        title: "Taking Partial Profits",
        content: "Partial profit-taking splits your position at key levels. Example: Take 50% at first structural target, let 50% run to full target. This locks in some profit while keeping upside potential.\n\nThe psychology is powerful - you've already won something. The math is mixed - if the trade goes to full target, you left money on the table. If it reverses, you protected profits. It depends on whether you prioritize win rate feeling or optimal R:R.",
        bullets: [
          "Take 50% at first target, let 50% run",
          "Reduces stress and locks profits",
          "Sacrifices some R:R for certainty",
          "Good for building confidence while learning"
        ]
      },
      {
        title: "When to Cut Losses Early",
        content: "Sometimes the market shows you that your trade is wrong before your stop is hit. Signs to consider early exit: 1) Price shows strong momentum against you, 2) Structure breaks against your trade, 3) News changes the fundamental picture, 4) You see a high-probability setup in the opposite direction.\n\nEarly exits are controversial. Some say never exit before stop (removes emotional decisions). Others say adapting to new information is smart. If you exit early, have a clear reason written in your journal.",
        bullets: [
          "Consider early exit if structure breaks against you",
          "Strong opposing momentum is a warning sign",
          "Only exit early with a clear, logical reason",
          "Document every early exit in your journal"
        ]
      },
      {
        title: "Letting Winners Run",
        content: "The opposite mistake of cutting winners early is cutting losers late. Winning trades should be given room to run to target. Don't exit just because you're in profit and scared of giving it back.\n\nTrust your original analysis. You identified the target for a reason (structure, liquidity, key level). Let price work toward it. The best trades often look scary in the middle before reaching target.",
        bullets: [
          "Trust your original target analysis",
          "Don't exit just because you're nervous",
          "Big R multiples come from letting winners run",
          "Use trailing stops if you can't resist interfering"
        ]
      }
    ],
    keyPoints: [
      "Set-and-forget removes emotional interference",
      "Move stop to breakeven after 1R profit (optional but common)",
      "Partial profits lock gains but reduce potential R:R",
      "Exit early only with clear logical reason (document it)"
    ],
    commonMistakes: [
      "Moving stop to breakeven immediately (getting stopped by noise)",
      "Exiting winners early out of fear",
      "Not exiting losers even when structure clearly breaks against you",
      "Constantly adjusting stops and targets (overtrading)",
      "No clear exit rules - making it up as you go"
    ],
    relatedLessons: [11, 12, 14, 16],
    quiz: [
      {
        id: 1,
        question: "What's the main benefit of set-and-forget trade management?",
        options: ["Higher R:R", "Removes emotional interference", "More trades per day", "Guarantees profit"],
        correctAnswer: 1,
        explanation: "Set-and-forget management removes the emotional decision-making that often causes traders to cut winners early or let losers run."
      },
      {
        id: 2,
        question: "When is a common time to move stop to breakeven?",
        options: ["Immediately after entry", "After 1R of profit", "Only at the end of the day", "Never move stops"],
        correctAnswer: 1,
        explanation: "Moving stop to breakeven after 1R (1x risk) of profit is a common rule. This ensures you can't turn a winner into a loser while giving the trade room to run."
      },
      {
        id: 3,
        question: "When should you consider exiting a trade early (before stop)?",
        options: ["Whenever you're nervous", "Only when structure clearly breaks against you", "Every time you're in profit", "Never, stops are sacred"],
        correctAnswer: 1,
        explanation: "Early exits should only be considered when there's a clear, logical reason - like structure breaking against your trade. Document every early exit in your journal."
      }
    ]
  },
  {
    id: 16,
    title: "Backtesting: Prove Your Edge Before Risking Real Money",
    description: "Learn systematic backtesting methods to validate your strategy before going live. Build confidence with historical data.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "35 min",
    isFree: false,
    sections: [
      {
        title: "Why Backtesting Matters",
        content: "Backtesting is replaying historical price data to see how your strategy would have performed. It's like a flight simulator for traders - you practice without real risk. A strategy that looks good on paper might fail miserably in real conditions. Backtesting reveals this before you lose real money.\n\nEvery serious strategy should have at least 100 backtested trades before going live. This gives you statistical significance and builds confidence in your approach.",
        bullets: [
          "Test strategies on historical data before risking money",
          "Reveals whether your 'edge' actually exists",
          "Minimum 100 trades for statistical significance",
          "Builds confidence in your system"
        ]
      },
      {
        title: "Manual Backtesting Process",
        content: "Manual backtesting: 1) Open a chart and go back 6-12 months, 2) Hide future price (many platforms have a 'replay' feature), 3) Advance candle by candle, 4) When you see a setup, note entry, stop, and target, 5) Advance to see outcome, 6) Record results.\n\nThis takes time but teaches you more than automated backtesting. You're forced to see the setups in real-time conditions without hindsight bias.",
        bullets: [
          "Use chart replay feature to hide future price",
          "Advance candle by candle",
          "Record every trade as if live",
          "Time-consuming but invaluable for learning"
        ],
        tradingExample: {
          setup: "You want to backtest 'Bullish Order Blocks at Daily FVG with 4H confirmation' strategy",
          entry: "Go back 12 months on EUR/USD. Use replay mode. Every time you see this setup, record it",
          management: "After 100+ setups, you have: 52 winners, 48 losers (52% WR). Average win: 2.5R. Average loss: 1R",
          outcome: "Expectancy = (0.52 × 2.5) - (0.48 × 1) = 1.3 - 0.48 = +0.82R per trade. Edge confirmed."
        }
      },
      {
        title: "What to Track During Backtesting",
        content: "Track everything you would in live trading: date, pair, direction, entry, stop, target, result, R multiple. Additionally track: 1) What confluence was present?, 2) What was the session?, 3) What was the HTF trend?, 4) Any notes about the setup.\n\nAfter 100 trades, analyze by filters: Which confluences produced best results? Which sessions? Which trends? This tells you exactly how to filter your live trading for highest probability.",
        bullets: [
          "Track all trade data same as live trading",
          "Note confluences, sessions, trend direction",
          "Filter results to find highest probability conditions",
          "Use data to refine your rules"
        ]
      },
      {
        title: "Avoiding Backtesting Pitfalls",
        content: "Common backtesting mistakes: 1) Hindsight bias - seeing setups that are only obvious because you see the outcome, 2) Cherry-picking - only counting wins, 3) Too few trades - 20 trades isn't statistically significant, 4) Curve fitting - tweaking rules until past data 'works' (won't work forward).\n\nBe brutally honest. Use strict rules. Take every setup that meets criteria, not just the winners. This is practice for real trading discipline.",
        bullets: [
          "Use replay mode to prevent hindsight bias",
          "Take EVERY setup that meets criteria",
          "Minimum 100 trades for significance",
          "Don't keep changing rules to fit past data"
        ]
      },
      {
        title: "From Backtesting to Forward Testing",
        content: "After successful backtesting, move to forward testing (demo or small real account). Backtesting proves the strategy can work; forward testing proves YOU can execute it. The psychological element is absent in backtesting.\n\nForward test for at least 1-2 months with the same discipline. If results match backtesting, you're ready for live trading. If they differ significantly, the issue is your execution, not the strategy.",
        bullets: [
          "Backtesting = strategy validation",
          "Forward testing = execution validation",
          "Demo or small live account for 1-2 months",
          "Results should roughly match backtest"
        ]
      }
    ],
    keyPoints: [
      "Never trade a strategy live without 100+ backtested trades",
      "Use replay mode to prevent hindsight bias",
      "Track and analyze by confluence, session, and trend",
      "Forward test to validate your ability to execute"
    ],
    commonMistakes: [
      "Backtesting with full chart visible (hindsight bias)",
      "Stopping at 20-30 trades (not statistically significant)",
      "Only counting winning trades",
      "Constantly changing rules to fit historical data",
      "Skipping forward testing and going straight to live"
    ],
    relatedLessons: [11, 12, 13],
    quiz: [
      {
        id: 1,
        question: "How many backtested trades minimum for statistical significance?",
        options: ["10-20", "30-50", "100+", "500+"],
        correctAnswer: 2,
        explanation: "A minimum of 100 trades is needed for statistical significance. Fewer trades could show results skewed by luck rather than genuine edge."
      },
      {
        id: 2,
        question: "What is 'hindsight bias' in backtesting?",
        options: ["Trading only in hindsight", "Seeing setups that are only obvious because you know the outcome", "A useful feature", "Looking at weekly charts"],
        correctAnswer: 1,
        explanation: "Hindsight bias is when you 'see' setups that are only obvious because you can see how price moved afterward. It artificially inflates backtest results."
      },
      {
        id: 3,
        question: "What does forward testing validate that backtesting cannot?",
        options: ["The strategy's edge", "Your ability to execute the strategy", "Historical price data", "Indicator settings"],
        correctAnswer: 1,
        explanation: "Forward testing validates your ability to execute the strategy in real-time conditions. Backtesting removes the psychological element that affects real trading."
      }
    ]
  },
  {
    id: 17,
    title: "Trading Psychology: Mastering Your Mind",
    description: "The markets will test your emotions like nothing else. Learn to recognize and overcome the psychological traps that destroy traders.",
    category: "psychology",
    difficulty: "Intermediate",
    duration: "40 min",
    isFree: false,
    sections: [
      {
        title: "Why Psychology Is 80% of Trading",
        content: "You can have the best strategy in the world, but if you can't execute it consistently, you'll lose money. The gap between 'knowing what to do' and 'actually doing it' is entirely psychological. Fear, greed, hope, and revenge - these emotions hijack your rational brain.\n\nProfessional traders spend more time on psychology than technical analysis. They understand that the real edge isn't in the strategy - it's in the ability to execute the strategy flawlessly, trade after trade.",
        bullets: [
          "Strategy is 20%, psychology is 80%",
          "The gap between knowing and doing is psychological",
          "Emotions hijack rational decision-making",
          "Execution consistency is the real edge"
        ]
      },
      {
        title: "Fear: The Trade Killer",
        content: "Fear manifests in several destructive ways: 1) Fear of losing - you don't take valid setups, 2) Fear of being wrong - you exit winners too early, 3) Fear of missing out (FOMO) - you chase trades you missed, 4) Fear of giving back profits - you close trades prematurely.\n\nThe antidote is process focus. When you focus on executing your process correctly (regardless of outcome), fear diminishes. You're not afraid of this one trade because you know it's just one of thousands.",
        bullets: [
          "Fear of losing prevents taking valid setups",
          "Fear of being wrong kills winning trades",
          "FOMO leads to chasing and bad entries",
          "Focus on process, not individual outcomes"
        ]
      },
      {
        title: "Greed: Overtrading and Overleveraging",
        content: "Greed shows up as: 1) Overtrading - taking marginal setups because you want more profits, 2) Overleveraging - sizing up because you're 'confident', 3) Holding losers - hoping they'll turn around, 4) Moving targets - wanting 'just a little more.'\n\nGreed is often masked as confidence. 'I'm confident in this trade' often means 'I'm greedy and want bigger profits.' True confidence doesn't require oversizing. Stick to your rules regardless of how 'good' a setup looks.",
        bullets: [
          "Overtrading = taking marginal setups",
          "Overleveraging = sizing up on 'confident' trades",
          "Holding losers = hoping they'll turn around",
          "Greed disguises itself as confidence"
        ],
        tradingExample: {
          setup: "You have a solid strategy that averages +4R per week. But you're impatient and want more.",
          entry: "You start taking 'B-grade' setups, oversizing on 'sure things,' and trading during low-probability hours",
          management: "Week 1: +2R (less than usual). Week 2: -5R (overtrading caused bad entries). Week 3: -8R (revenge trading)",
          outcome: "Greed turned a winning trader into a losing one. Back to A-grade setups only, proper sizing. Results return."
        }
      },
      {
        title: "Revenge Trading: The Account Killer",
        content: "Revenge trading is the most destructive pattern: after a loss (especially a painful one), you immediately take another trade to 'make it back.' This trade is usually larger than normal, against the rules, and emotionally driven.\n\nRevenge trading causes small drawdowns to become catastrophic. One bad trade becomes five. A 3% loss becomes 15%. The solution: after any loss, step away. Take a break. Come back with a clear head. NEVER trade immediately after a loss.",
        bullets: [
          "Triggered by painful losses",
          "Usually larger size, against the rules",
          "Turns small drawdowns into catastrophic ones",
          "Rule: NEVER trade immediately after a loss"
        ]
      },
      {
        title: "Building Psychological Resilience",
        content: "Resilience isn't about not having emotions - it's about managing them. Practical techniques: 1) Daily meditation (even 5 minutes helps), 2) Pre-trade checklist that includes mental state check, 3) Maximum trades per day rule, 4) 'Three strikes' rule - three losses and you're done for the day, 5) Regular breaks from screens.\n\nTreat your psychology like a muscle. It needs training, recovery, and care. The traders who last decades are the ones who prioritize mental health.",
        bullets: [
          "Meditation builds focus and calm",
          "Pre-trade mental state checklist",
          "Maximum trades and 'three strikes' rules",
          "Regular screen breaks and self-care"
        ]
      }
    ],
    keyPoints: [
      "Psychology is 80% of trading success",
      "Fear prevents taking setups; greed prevents following rules",
      "NEVER trade immediately after a loss (revenge trading)",
      "Build resilience through meditation, rules, and breaks"
    ],
    commonMistakes: [
      "Thinking you can 'willpower' through emotions",
      "Not taking breaks after losses",
      "Ignoring the 'three strikes' warning",
      "Trading when tired, stressed, or distracted",
      "Not having a daily mental state check routine"
    ],
    relatedLessons: [1, 13, 18],
    quiz: [
      {
        id: 1,
        question: "What percentage of trading success is psychological?",
        options: ["20%", "50%", "80%", "100%"],
        correctAnswer: 2,
        explanation: "Psychology is estimated to be 80% of trading success. Having a winning strategy means nothing if you can't execute it consistently due to emotional interference."
      },
      {
        id: 2,
        question: "What is 'revenge trading'?",
        options: ["Trading for revenge on a competitor", "Taking trades immediately after losses to 'make it back'", "A profitable strategy", "Trading against the trend"],
        correctAnswer: 1,
        explanation: "Revenge trading is taking trades immediately after a loss to recoup the loss. These trades are typically emotionally driven, larger than normal, and against the rules."
      },
      {
        id: 3,
        question: "What should you do immediately after a losing trade?",
        options: ["Take another trade to make it back", "Double your next position size", "Step away, take a break, return with clear head", "Quit trading"],
        correctAnswer: 2,
        explanation: "After a loss, the best practice is to step away and take a break. Return with a clear head. Never trade immediately after a loss - this leads to revenge trading."
      }
    ]
  },
  {
    id: 18,
    title: "Developing Discipline: The Daily Routine",
    description: "Create the habits and routines that keep you consistent day after day. Discipline is built, not born.",
    category: "psychology",
    difficulty: "Intermediate",
    duration: "30 min",
    isFree: false,
    sections: [
      {
        title: "Why Routines Create Consistency",
        content: "Willpower is a limited resource. If you rely on willpower to follow your rules, you'll eventually fail. Routines automate good behavior - you don't have to decide to do the right thing; you just follow the routine.\n\nEvery successful trader has a routine. Morning analysis, specific trading hours, pre-trade checklist, post-trade review. These routines remove decisions and create automatic discipline.",
        bullets: [
          "Willpower depletes; routines don't",
          "Routines automate good behavior",
          "Removes the need for moment-to-moment decisions",
          "Creates sustainable discipline"
        ]
      },
      {
        title: "The Morning Routine",
        content: "Before markets open or before your trading session: 1) Review the higher timeframe (mark levels, determine bias), 2) Identify 2-3 POIs for the day, 3) Check economic calendar (avoid trading major news), 4) Mental state check (are you calm, focused, ready?), 5) Journal yesterday's trades if not done.\n\nThis takes 15-30 minutes but sets you up for success. You enter the session with a plan instead of reacting to every move.",
        bullets: [
          "HTF analysis and bias determination",
          "Mark 2-3 POIs for the session",
          "Check economic calendar",
          "Mental state check before trading",
          "15-30 minutes investment pays dividends"
        ],
        tradingExample: {
          setup: "Morning Routine Example - 7:30 AM before London session",
          entry: "Daily chart: EUR/USD bullish, pullback to daily OB at 1.0820. 4H: Waiting for LTF confirmation. Economic calendar: No major news until NY session",
          management: "Plan: Wait for price to enter the 1.0820-1.0840 zone. If 15M shows BOS bullish, enter long. If no setup by 11:00, done for the day.",
          outcome: "Clear plan, defined zones, specific rules. No guessing, no impulsive trades."
        }
      },
      {
        title: "The Pre-Trade Checklist",
        content: "Before every single trade, run through a checklist: 1) Is this a valid setup per my rules?, 2) Is it in the direction of HTF bias?, 3) Is it at a POI I identified?, 4) Is my risk correct (1-2%)?, 5) Is there major news soon?, 6) Am I calm and focused?\n\nIf any answer is 'no,' you don't trade. This simple checklist prevents most impulsive, revenge, or FOMO trades. Print it and keep it visible.",
        bullets: [
          "Valid setup per written rules?",
          "Aligned with HTF bias?",
          "At a pre-marked POI?",
          "Correct position size?",
          "No major news imminent?",
          "Calm and focused mental state?"
        ]
      },
      {
        title: "The Post-Trade Routine",
        content: "After every trade (win or loss): 1) Screenshot the trade, 2) Record in journal immediately (not later), 3) Note emotional state, 4) Rate your execution (did you follow rules?), 5) Identify one lesson.\n\nThis takes 5 minutes per trade but creates the feedback loop for improvement. Don't skip this - it's as important as the trade itself.",
        bullets: [
          "Screenshot and journal immediately",
          "Record emotional state honestly",
          "Rate execution (separate from outcome)",
          "Extract one lesson from every trade"
        ]
      },
      {
        title: "Building the Routine Habit",
        content: "Routines don't stick immediately. Use these techniques: 1) Start small - begin with just the pre-trade checklist, 2) Stack habits - attach new routine to existing habit, 3) Track compliance - check off when you complete routine, 4) Forgive slip-ups - one missed day isn't failure.\n\nIt takes 30-60 days to solidify a habit. Be patient. The traders who build strong routines are the ones who last.",
        bullets: [
          "Start with one routine element",
          "Stack onto existing habits",
          "Track your compliance",
          "Allow for imperfection while building"
        ]
      }
    ],
    keyPoints: [
      "Routines > willpower for sustainable discipline",
      "Morning routine: HTF analysis, mark POIs, mental check",
      "Pre-trade checklist prevents impulsive trades",
      "Post-trade journal within minutes, not hours"
    ],
    commonMistakes: [
      "Trying to implement all routines at once (overwhelm)",
      "Skipping routine because 'you don't need it today'",
      "Not having a written pre-trade checklist",
      "Journaling at end of week instead of after each trade",
      "No specific trading hours (trading all day)"
    ],
    relatedLessons: [1, 13, 17],
    quiz: [
      {
        id: 1,
        question: "Why are routines more effective than willpower?",
        options: ["They aren't", "Willpower depletes; routines automate behavior", "Routines are faster", "Willpower is for beginners"],
        correctAnswer: 1,
        explanation: "Willpower is a limited resource that depletes throughout the day. Routines automate good behavior, removing the need for constant decision-making."
      },
      {
        id: 2,
        question: "What should be included in a pre-trade checklist?",
        options: ["Only entry price", "Setup validity, HTF alignment, POI check, risk size, news check, mental state", "Just stop loss", "Nothing - trade by feel"],
        correctAnswer: 1,
        explanation: "A comprehensive pre-trade checklist includes setup validity, HTF alignment, POI check, proper risk sizing, news check, and mental state assessment."
      },
      {
        id: 3,
        question: "When should you journal a trade?",
        options: ["End of week", "End of month", "Immediately after the trade", "Only if it was a loss"],
        correctAnswer: 2,
        explanation: "Journal each trade immediately after closing it. Details are fresh in your mind, and you capture accurate emotional data before it fades."
      }
    ]
  },
  {
    id: 19,
    title: "Common Trading Mistakes and How to Avoid Them",
    description: "Learn from others' failures. Avoid the mistakes that cause 90% of traders to fail by recognizing and preventing them.",
    category: "psychology",
    difficulty: "Beginner",
    duration: "30 min",
    isFree: false,
    sections: [
      {
        title: "Mistake #1: Trading Without a Plan",
        content: "The most common mistake: entering trades without a clear plan. 'It looks like it's going up' is not a plan. A real plan includes: specific entry criteria, exact stop loss level, defined target, position size calculation.\n\nWithout a plan, you're gambling. Every trade should be planned before you enter. Write it down. If you can't articulate why you're in the trade, get out.",
        bullets: [
          "Every trade needs a written plan",
          "'It looks like it's going up' is not a plan",
          "Plan includes: entry criteria, SL, TP, size",
          "No plan = gambling"
        ]
      },
      {
        title: "Mistake #2: Risking Too Much",
        content: "New traders often risk 5-10% or more per trade, thinking bigger risk = bigger profits. This is backwards. Bigger risk = faster account destruction. A few losing trades at 10% risk puts you in a 50% drawdown, requiring 100% return to recover.\n\nStick to 1-2% risk maximum. This keeps you in the game long enough to learn and improve. Capital preservation is more important than capital growth when starting.",
        bullets: [
          "Never risk more than 1-2% per trade",
          "5 losses at 10% = 50% drawdown",
          "Large drawdowns are extremely hard to recover",
          "Preserve capital first, grow it second"
        ]
      },
      {
        title: "Mistake #3: Trading Too Many Pairs/Markets",
        content: "Spreading attention across 20 pairs means mastering none. Each pair has its own 'personality' - how it reacts to sessions, levels, and patterns. You can't learn these nuances if you're jumping between instruments.\n\nStart with 1-3 pairs and study them deeply. Learn their average daily range, how they react in London vs. NY, which levels they respect. Mastery of few beats surface knowledge of many.",
        bullets: [
          "Focus on 1-3 pairs when learning",
          "Each pair has unique behavior patterns",
          "Mastery requires deep focus",
          "Expand only after mastering your chosen pairs"
        ],
        tradingExample: {
          setup: "A trader tries to watch EUR/USD, GBP/USD, USD/JPY, Gold, and Bitcoin simultaneously",
          entry: "They miss a perfect EUR/USD setup while distracted by noise on Gold. Take a mediocre GBP/USD trade because 'they need to trade something'",
          management: "The mediocre trade loses. Meanwhile, the EUR/USD setup would have been a 3R winner.",
          outcome: "Lesson: Focus on fewer pairs. Quality over quantity. The EUR/USD expert beats the 'watch everything' trader."
        }
      },
      {
        title: "Mistake #4: Ignoring Higher Timeframes",
        content: "Trading 15-minute charts without checking the daily is like sailing without looking at the weather. That perfect bullish setup on the 15M means nothing if the daily trend is strongly bearish. You're fighting the current.\n\nAlways establish higher timeframe bias before looking for trades. If daily is bearish, only look for shorts. If daily is bullish, only look for longs. This single filter eliminates half of losing trades.",
        bullets: [
          "Always check HTF before trading LTF",
          "LTF setups against HTF trend usually fail",
          "HTF = the 'weather' for your trading day",
          "This filter alone improves results dramatically"
        ]
      },
      {
        title: "Mistake #5: Expecting Quick Riches",
        content: "Trading is a skill that takes years to develop. The 'get rich quick' mentality leads to overleveraging, gambling, and account destruction. Those social media traders showing Lamborghinis are either lying or lucky (and luck runs out).\n\nAdopt a long-term mindset. Your goal in year one is to survive and learn. Year two, become breakeven. Year three, become consistently profitable. This timeline is realistic and sustainable.",
        bullets: [
          "Trading mastery takes 1-3 years minimum",
          "Social media success stories are usually fake or lucky",
          "Get-rich-quick mentality leads to gambling",
          "Year 1: survive. Year 2: breakeven. Year 3: profitable"
        ]
      }
    ],
    keyPoints: [
      "Every trade needs a written plan before entry",
      "Risk 1-2% maximum - capital preservation is priority #1",
      "Focus on 1-3 pairs deeply instead of 20 superficially",
      "Always check HTF bias before trading LTF setups"
    ],
    commonMistakes: [
      "All of the above - they're listed because they're the most common",
      "Thinking 'this won't happen to me'",
      "Not learning from mistakes (no journal)",
      "Switching strategies every week",
      "Trading to escape problems instead of solve them"
    ],
    relatedLessons: [1, 12, 17],
    quiz: [
      {
        id: 1,
        question: "What should every trade have before entry?",
        options: ["Just confidence", "A written plan with entry, SL, TP, and size", "Social media confirmation", "Nothing specific"],
        correctAnswer: 1,
        explanation: "Every trade needs a written plan including specific entry criteria, stop loss level, target, and position size. Without this, you're gambling, not trading."
      },
      {
        id: 2,
        question: "How many currency pairs should you focus on when learning?",
        options: ["As many as possible", "1-3 pairs for deep mastery", "At least 10", "Only Bitcoin"],
        correctAnswer: 1,
        explanation: "Focus on 1-3 pairs when learning. Each pair has unique behavior that requires deep study. Mastery of few beats surface knowledge of many."
      },
      {
        id: 3,
        question: "What's a realistic timeline for becoming consistently profitable?",
        options: ["1-2 months", "1-3 years", "1 week", "It happens instantly"],
        correctAnswer: 1,
        explanation: "Consistent profitability typically takes 1-3 years of dedicated practice. Year 1: survive and learn. Year 2: breakeven. Year 3: profitable."
      }
    ]
  },
  {
    id: 20,
    title: "Building Your Personal Trading System",
    description: "Bring everything together. Create a complete, rule-based trading system customized to your personality and schedule.",
    category: "advanced",
    difficulty: "Advanced",
    duration: "50 min",
    isFree: false,
    sections: [
      {
        title: "What Is a Trading System?",
        content: "A trading system is a complete set of rules that defines every aspect of your trading: what you trade, when you trade, how you identify setups, how you enter, where you place stops, where you take profits, how you size positions. It removes discretion and emotion.\n\nThink of it as a business operating procedure. A McDonald's franchise works because every step is systematized. Your trading should be the same - anyone should be able to follow your rules and get similar results.",
        bullets: [
          "Complete set of rules for all trading decisions",
          "Removes discretion and emotional interference",
          "Like a business operating procedure",
          "Anyone following the rules should get similar results"
        ]
      },
      {
        title: "System Component 1: Market and Timeframes",
        content: "Define exactly: 1) What pairs/instruments you trade (and why), 2) What timeframes you use for HTF, ITF, LTF, 3) What trading sessions you trade (London? NY? Both?), 4) Maximum trades per day.\n\nBe specific. Not 'I trade forex' but 'I trade EUR/USD and GBP/USD during London session, using Daily for HTF, 4H for ITF, 15M for LTF, maximum 2 trades per day.'",
        bullets: [
          "List specific pairs (1-3 maximum)",
          "Define exact timeframe framework",
          "Specify trading sessions/hours",
          "Set maximum trades per day"
        ]
      },
      {
        title: "System Component 2: Setup Criteria",
        content: "Define your exact setups with no ambiguity: 1) What constitutes a valid setup (OB + FVG + discount zone?), 2) What confirmation do you need (LTF BOS?), 3) What disqualifies a setup (against HTF trend? Near major news?).\n\nWrite these as if-then rules: 'If price is at unmitigated bullish OB, AND in discount zone, AND HTF is bullish, AND 15M shows BOS bullish, THEN I enter long.'",
        bullets: [
          "Define exact setup criteria",
          "Specify required confirmations",
          "List disqualifying factors",
          "Write as if-then rules"
        ],
        tradingExample: {
          setup: "Example System Setup Rules:",
          entry: "Valid long setup: Price at fresh bullish OB or FVG, price in discount (<50% of range), Daily trend bullish (HH/HL), 4H pullback to POI, 15M BOS bullish confirmation",
          management: "Disqualifiers: Major news within 30 min, Friday afternoon, against weekly trend, POI already mitigated",
          outcome: "These rules are specific, measurable, and remove discretion. Any trade I take meets ALL criteria."
        }
      },
      {
        title: "System Component 3: Risk and Execution",
        content: "Define: 1) Risk per trade (1%? 0.5%?), 2) Maximum daily risk (2-3%?), 3) Entry method (limit? confirmation?), 4) Stop placement rules, 5) Target selection rules, 6) Trade management approach (set-and-forget? trail?).\n\nThese rules ensure consistency regardless of how you 'feel' about a trade. You don't get to size up because you're confident - the rules dictate sizing.",
        bullets: [
          "Fixed risk percentage per trade",
          "Maximum daily risk cap",
          "Defined entry method for each setup",
          "Clear SL and TP placement rules"
        ]
      },
      {
        title: "System Component 4: Review and Improvement",
        content: "A system isn't static - it evolves. Include: 1) Weekly review process, 2) Monthly deep analysis, 3) When you'll consider rule changes (after 50+ new trades), 4) How you'll test changes (backtest first).\n\nNever change rules based on a few trades. Wait for significant sample sizes. And always backtest changes before implementing them live.",
        bullets: [
          "Weekly and monthly review schedule",
          "Minimum sample size before rule changes",
          "Backtest all proposed changes",
          "Document all rule modifications"
        ]
      },
      {
        title: "Documenting Your System",
        content: "Write your system down in a document you can reference. Include: 1) Market/timeframe/session rules, 2) Setup definitions with examples, 3) Entry/stop/target rules, 4) Risk management rules, 5) Review schedule.\n\nThis becomes your trading 'constitution.' When in doubt, you refer to the document. Print it and keep it at your trading desk. The act of writing it down also clarifies your thinking.",
        bullets: [
          "Write everything in one document",
          "Include examples and screenshots",
          "Print and keep at your trading desk",
          "Reference when in doubt"
        ]
      }
    ],
    keyPoints: [
      "A system removes discretion and creates consistency",
      "Define everything: pairs, timeframes, setups, entry, risk, review",
      "Write rules as specific if-then statements",
      "Document your system and reference it constantly"
    ],
    commonMistakes: [
      "Having vague rules that allow too much discretion",
      "Changing rules after every losing trade",
      "Not writing the system down",
      "Having no review process for improvement",
      "Making the system too complex (simpler is better)"
    ],
    relatedLessons: [11, 12, 13, 16],
    quiz: [
      {
        id: 1,
        question: "What is the purpose of a trading system?",
        options: ["To complicate trading", "To remove discretion and create consistency", "To follow social media signals", "To trade randomly"],
        correctAnswer: 1,
        explanation: "A trading system's purpose is to remove discretion and emotional decision-making, creating consistent execution trade after trade."
      },
      {
        id: 2,
        question: "How should setup criteria be written?",
        options: ["Vaguely so there's flexibility", "As specific if-then rules", "Only in your head", "As feelings"],
        correctAnswer: 1,
        explanation: "Setup criteria should be written as specific if-then rules with no ambiguity. This removes discretion and ensures consistent identification of valid setups."
      },
      {
        id: 3,
        question: "When should you change your system rules?",
        options: ["After every loss", "Never", "After significant sample size (50+ trades) and backtesting", "Based on feelings"],
        correctAnswer: 2,
        explanation: "Rule changes should only be considered after a significant sample size (50+ trades minimum) and any proposed changes should be backtested before live implementation."
      }
    ]
  }
];

export function canAccessLesson(lessonId: number, hasFullAccess: boolean): boolean {
  const lesson = EDUCATION_LESSONS.find(l => l.id === lessonId);
  if (!lesson) return false;
  return lesson.isFree || hasFullAccess;
}
