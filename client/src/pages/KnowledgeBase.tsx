import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, BookOpen, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const modules = [
  {
    id: 1,
    title: "Market Foundations",
    sections: [
      {
        title: "Core Market Truths",
        content: [
          "Price moves because of liquidity and order flow.",
          "Institutions accumulate → manipulate → distribute.",
          "Indicators lag; price is the source.",
          "Every trade must answer: Who is trapped? Where is liquidity? Where is value?"
        ]
      }
    ]
  },
  {
    id: 2,
    title: "Market Structure",
    sections: [
      {
        title: "Structure Definitions",
        content: [
          "HH / HL → Uptrend",
          "LL / LH → Downtrend",
          "Range → Liquidity building"
        ]
      },
      {
        title: "Break Types",
        content: [
          "BOS (Break of Structure) → Continuation signal",
          "CHOCH (Change of Character) → Reversal warning"
        ]
      },
      {
        title: "Structure Rules",
        content: [
          "HTF structure overrides everything.",
          "Never trade against HTF structure.",
          "LTF is for execution only."
        ]
      }
    ]
  },
  {
    id: 3,
    title: "Supply & Demand",
    sections: [
      {
        title: "Zone Types",
        content: [
          "RBR – Rally → Base → Rally (Demand)",
          "DBD – Drop → Base → Drop (Supply)",
          "RBD / DBR – Continuation zones"
        ]
      },
      {
        title: "Valid Zone Criteria",
        content: [
          "Strong impulsive exit",
          "Minimal basing",
          "Fresh / untested",
          "Breaks structure or creates imbalance"
        ]
      },
      {
        title: "Zone Invalidation",
        content: [
          "Demand invalid → candle closes below",
          "Supply invalid → candle closes above",
          "Invalid zone = NO TRADE"
        ]
      }
    ]
  },
  {
    id: 4,
    title: "Liquidity Theory",
    sections: [
      {
        title: "Liquidity Pools",
        content: [
          "Equal highs / equal lows",
          "Trendline stops",
          "Range highs & lows",
          "Previous day high/low",
          "Session highs/lows"
        ]
      },
      {
        title: "Liquidity Rules",
        content: [
          "Price must take liquidity before real move.",
          "Liquidity grab ≠ reversal (needs confirmation).",
          "Entries are taken after the sweep."
        ]
      }
    ]
  },
  {
    id: 5,
    title: "Order Blocks",
    sections: [
      {
        title: "Definition",
        content: [
          "The last opposite candle before an impulsive move that breaks structure."
        ]
      },
      {
        title: "Valid OB Conditions",
        content: [
          "Leads to BOS / CHOCH",
          "Clear imbalance",
          "Untested",
          "Located at premium/discount"
        ]
      },
      {
        title: "Entry Logic",
        content: [
          "HTF OB → bias",
          "LTF OB → execution",
          "SL beyond OB extreme"
        ]
      }
    ]
  },
  {
    id: 6,
    title: "Fair Value Gap",
    sections: [
      {
        title: "Definition",
        content: [
          "A 3-candle imbalance where price moves too fast."
        ]
      },
      {
        title: "Rules",
        content: [
          "Price tends to rebalance.",
          "Best used with: OB, Structure, Liquidity sweep."
        ]
      }
    ]
  },
  {
    id: 7,
    title: "Fibonacci Rules",
    sections: [
      {
        title: "Retracement Levels",
        content: [
          "23.6% → aggressive",
          "38.2% – 50% → optimal",
          "61.8% → last valid",
          "61.8% → setup invalid (for continuation)"
        ]
      },
      {
        title: "Fib Rules",
        content: [
          "Draw only after impulse.",
          "Confluence required (zone, OB, structure).",
          "Never fib random swings."
        ]
      }
    ]
  },
  {
    id: 8,
    title: "Price Action",
    sections: [
      {
        title: "Candle Psychology",
        content: [
          "Long wick → rejection",
          "Large body → momentum",
          "Small candles → absorption"
        ]
      },
      {
        title: "Confirmation Types",
        content: [
          "Pin bar at level",
          "Engulfing after sweep",
          "Micro BOS on LTF",
          "Failed breakdown / breakout"
        ]
      }
    ]
  },
  {
    id: 9,
    title: "Forbidden Trades",
    sections: [
      {
        title: "Hard Rules",
        content: [
          "Inside HTF opposing zone",
          "Against HTF structure",
          "Before liquidity sweep",
          "Without confirmation",
          "News volatility (optional filter)"
        ]
      }
    ]
  },
  {
    id: 10,
    title: "Execution Checklist",
    sections: [
      {
        title: "Final Gate",
        content: [
          "HTF bias clear",
          "Zone valid",
          "Liquidity taken",
          "Structure confirmed",
          "Entry confirmed",
          "RR acceptable",
          "SL logical"
        ]
      }
    ]
  }
];

export default function KnowledgeBase() {
  const [activeModule, setActiveModule] = useState<number | null>(1);

  const currentModule = modules.find(m => m.id === activeModule);

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="text-primary" size={28} />
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Market Foundations</h1>
          </div>
          <p className="text-muted-foreground mt-1 italic">Structured rule systems for deterministic trading.</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-2 border-l-2 border-primary/50 pl-2">
            Educational content only. Not financial advice. <Link href="/risk" className="ml-1 text-primary/70 hover:underline">View Risk Disclaimer</Link>
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar List */}
          <div className="space-y-2 h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
            {modules.map((module) => (
              <button 
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className={cn(
                  "w-full p-4 rounded-lg border text-left transition-all duration-200 flex justify-between items-center group",
                  activeModule === module.id
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "flex items-center justify-center min-w-[24px] h-6 rounded text-xs font-bold",
                    activeModule === module.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {module.id}
                  </span>
                  <span className="font-medium text-sm">{module.title}</span>
                </div>
                {activeModule === module.id ? <ChevronRight size={16} /> : <ChevronDown size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {currentModule && (
                <motion.div
                  key={currentModule.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-card border border-border rounded-xl p-8 shadow-xl min-h-[600px] border-t-4 border-t-primary"
                >
                  <div className="flex items-center justify-between mb-8 border-b border-border pb-6">
                    <div>
                      <span className="text-primary text-xs font-bold tracking-[0.2em] uppercase mb-1 block">Layer 1: Static Knowledge</span>
                      <h2 className="text-3xl font-bold text-foreground">{currentModule.title}</h2>
                    </div>
                    <div className="hidden sm:block">
                      <div className="px-3 py-1 bg-muted rounded-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest border border-border">
                        Rule System v1.0
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-10">
                    {currentModule.sections.map((section, idx) => (
                      <div key={idx} className="relative">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-1.5 h-6 bg-primary rounded-full" />
                          <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3 ml-4">
                          {section.content.map((item, i) => (
                            <div 
                              key={i} 
                              className="group flex items-start gap-3 p-4 bg-background/50 border border-border rounded-lg hover:border-primary/30 transition-colors"
                            >
                              <div className="mt-1">
                                {currentModule.id === 9 ? (
                                  <XCircle size={14} className="text-destructive" />
                                ) : currentModule.id === 10 ? (
                                  <CheckCircle2 size={14} className="text-primary" />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors mt-1" />
                                )}
                              </div>
                              <p className="text-muted-foreground text-sm leading-relaxed font-mono">
                                {item}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {currentModule.id === 9 && (
                    <div className="mt-12 p-6 bg-destructive/5 border border-destructive/20 rounded-xl flex items-start gap-4">
                      <ShieldAlert className="text-destructive shrink-0" size={24} />
                      <div>
                        <h4 className="text-destructive font-bold text-sm uppercase tracking-wider mb-1">Hard Filter Warning</h4>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Violating any of these rules results in an immediate NO TRADE decision, regardless of other confirmations.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-12 pt-8 border-t border-border flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
                    <span>Market Knowledge Engine</span>
                    <span>Deterministic Execution</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.4);
        }
      `}</style>
    </div>
  );
}
