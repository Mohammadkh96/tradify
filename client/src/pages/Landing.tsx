import { ShieldCheck, BarChart3, Lock, ArrowRight, Zap, Target, History, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-emerald-500/30">
      {/* Navigation Header */}
      <nav className="border-b border-slate-900 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="text-slate-950 fill-slate-950" size={18} />
            </div>
            <span className="text-xl font-black tracking-tighter text-white uppercase italic">Tradify</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white">
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase px-6 h-10 rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="py-24 px-6 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full mb-8">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Institutional-Grade Journaling</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic mb-8 leading-[0.9]">
            Discipline is the <br />
            <span className="text-emerald-500">Ultimate Edge.</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
            Standardize your edge with rule-based journaling and live MT5 terminal synchronization. No hype. No guessing. Just raw performance intelligence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-[0.15em] text-xs shadow-xl shadow-emerald-500/20 rounded-2xl">
                Start Journaling Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-slate-800 text-slate-400 font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-900">
                View Plans
              </Button>
            </Link>
          </div>
        </section>

        {/* Core Pillars */}
        <section className="py-24 border-t border-slate-900 bg-slate-900/20">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
                <Terminal className="text-emerald-500" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">MT5 Native Sync</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Connect your MetaTrader 5 terminal via a standalone read-only bridge. Zero broker credentials required. Your data syncs locally and securely.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
                <Target className="text-emerald-500" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Rule Engine</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Enforce HTF Bias, Zone Validity, and Entry Confirmation rules before logging. Tradify validates every trade against institutional logic.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center">
                <BarChart3 className="text-emerald-500" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Edge Analytics</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Deep dive into Profit Factor, Expectancy, and Session Efficiency. Transform raw logs into actionable intelligence.
              </p>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="py-24 px-6 max-w-7xl mx-auto border-t border-slate-900">
          <div className="bg-[#0b1120] border border-slate-800 rounded-[2.5rem] p-8 md:p-16 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                <Lock size={12} className="text-blue-500" />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Security First</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic">Read-Only. <span className="text-slate-500">Broker Neutral.</span></h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                Tradify utilizes a standalone Python connector that pushes performance data to your dashboard. We never have access to your capital, your execution, or your sensitive broker credentials.
              </p>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="flex items-center gap-3 justify-center md:justify-start">
                  <CheckIcon className="text-emerald-500" /> Zero Trade Execution Access
                </li>
                <li className="flex items-center gap-3 justify-center md:justify-start">
                  <CheckIcon className="text-emerald-500" /> AES-256 Encrypted Sync Tokens
                </li>
                <li className="flex items-center gap-3 justify-center md:justify-start">
                  <CheckIcon className="text-emerald-500" /> Local Python Bridge Implementation
                </li>
              </ul>
            </div>
            <div className="flex-1 bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">MT5 Bridge Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Standby</span>
                  </div>
                </div>
                <div className="font-mono text-[10px] text-slate-600 space-y-1">
                  <div>{`> INITIALIZING TERMINAL_LINK_V2.0`}</div>
                  <div>{`> VERIFYING TOKEN [SHA-256]... SUCCESS`}</div>
                  <div>{`> POLLING HISTORY... 142 ENTRIES FOUND`}</div>
                  <div className="text-emerald-500/50">{`> SYNCING... COMPLETE`}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-slate-900 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
        <div>&copy; 2026 Tradify Intelligence Systems</div>
        <div className="flex items-center gap-8">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Support</Link>
        </div>
      </footer>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
