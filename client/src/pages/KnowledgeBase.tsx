import { useState } from "react";
import { Navigation, MobileNav } from "@/components/Navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const modules = [
  {
    id: 1,
    title: "Market Structure",
    content: "Understanding swing highs/lows, break of structure (BOS), and change of character (CHoCH). The market moves in trends; identifying the trend is 80% of the battle. Look for displacement."
  },
  {
    id: 2,
    title: "Supply & Demand Zones",
    content: "Price moves from one zone to another. A valid zone must have: 1) Displacement (strong move away), 2) Break of Structure, 3) Imbalance created. We wait for price to return to these zones (mitigation)."
  },
  {
    id: 3,
    title: "Liquidity Concepts",
    content: "The market seeks liquidity. Equal highs/lows (EQH/EQL) are magnets. Retail stop losses cluster above old highs and below old lows. Banks need this liquidity to fill large orders. We trade AFTER the liquidity sweep."
  },
  {
    id: 4,
    title: "Imbalance (FVG)",
    content: "Fair Value Gaps represent inefficiency in the market. Price often returns to fill these gaps to restore balance before continuing the trend. They act as high-probability entry points."
  },
  {
    id: 5,
    title: "Order Blocks",
    content: "The specific candle where institutions placed their orders before a major move. Bullish OB: The last down candle before a strong up move. Bearish OB: The last up candle before a strong down move."
  },
  {
    id: 12,
    title: "Risk Management",
    content: "The holy grail. Never risk more than 1-2% per trade. Your edge plays out over a large sample size of trades. One loss should not wipe out your week. Protect your capital at all costs."
  },
  {
    id: 15,
    title: "Execution Checklist",
    content: "Do not press buy/sell unless ALL criteria are met. 1) HTF Bias, 2) Zone Reached, 3) Liquidity Taken, 4) MSS on LTF. Patience is the filter that separates gamblers from professionals."
  },
  {
    id: 16,
    title: "Trading Psychology",
    content: "Thinking in probabilities. You cannot predict the outcome of any single trade. Accept uncertainty. FOMO and fear of loss are your enemies. Stick to the plan."
  }
];

export default function KnowledgeBase() {
  const [activeModule, setActiveModule] = useState<number | null>(1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Market Foundations</h1>
          <p className="text-slate-400 mt-1">Core curriculum for consistent profitability.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar List */}
          <div className="space-y-2">
            {modules.map((module) => (
              <div 
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className={cn(
                  "p-4 rounded-lg border cursor-pointer transition-all duration-200 flex justify-between items-center group",
                  activeModule === module.id
                    ? "bg-emerald-950/30 border-emerald-900 text-emerald-400"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "flex items-center justify-center w-6 h-6 rounded text-xs font-bold",
                    activeModule === module.id ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-800 text-slate-500"
                  )}>
                    {module.id}
                  </span>
                  <span className="font-medium text-sm">{module.title}</span>
                </div>
                {activeModule === module.id ? <ChevronRight size={16} /> : <ChevronDown size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
              </div>
            ))}
          </div>

          {/* Content Area */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeModule && (
                <motion.div
                  key={activeModule}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-8 min-h-[500px]"
                >
                  <div className="flex items-center gap-3 text-emerald-500 mb-6">
                    <BookOpen size={24} />
                    <span className="text-sm font-bold tracking-widest uppercase">Module {activeModule}</span>
                  </div>
                  
                  <h2 className="text-3xl font-bold text-white mb-6">
                    {modules.find(m => m.id === activeModule)?.title}
                  </h2>
                  
                  <div className="prose prose-invert prose-slate max-w-none">
                    <p className="text-lg text-slate-300 leading-relaxed">
                      {modules.find(m => m.id === activeModule)?.content}
                    </p>
                    
                    <div className="my-8 h-px bg-slate-800 w-full" />
                    
                    <h3 className="text-xl font-semibold text-white mb-4">Key Takeaways</h3>
                    <ul className="space-y-2 text-slate-400">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 mt-1.5">•</span>
                        Identify the concept on the HTF first.
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 mt-1.5">•</span>
                        Wait for price to arrive at your point of interest (POI).
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 mt-1.5">•</span>
                        Don't guess; wait for confirmation (reaction).
                      </li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
