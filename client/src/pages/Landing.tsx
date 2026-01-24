import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Activity, 
  ArrowRight, 
  Lock, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  BookOpen
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <TrendingUp size={24} strokeWidth={3} />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tighter text-white uppercase italic leading-none">Tradify</span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">Terminal</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-400 hover:text-white font-bold uppercase tracking-widest text-xs">
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest text-xs px-6">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Institutional Performance Engine</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic uppercase mb-6 leading-[0.9]">
            Execution-linked<br />
            <span className="text-emerald-500">performance intelligence</span><br />
            for MT5 traders
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-12 leading-relaxed">
            Eliminate psychological variance and bridge the gap between analysis and execution. 
            Tradify provides the data-driven discipline, risk control, and post-trade feedback 
            required for professional-grade trading.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20">
                Create Account
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-slate-800 text-slate-400 font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-900">
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 border-y border-white/5 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase italic mb-8">
                Why most traders <span className="text-rose-500">fail</span>
              </h2>
              <div className="space-y-6">
                {[
                  {
                    title: "Execution Inconsistency",
                    desc: "Perfect analysis followed by hesitant or impulsive entries. Without hard rules, your brain becomes the bottleneck.",
                    icon: <AlertCircle className="text-rose-500" />
                  },
                  {
                    title: "Systematic Overtrading",
                    desc: "Losses aren't usually caused by bad setups, but by trades taken outside of your strategy boundaries.",
                    icon: <Zap className="text-amber-500" />
                  },
                  {
                    title: "The Feedback Vacuum",
                    desc: "Most journals track 'What' happened. Tradify tracks 'Why' it happened by linking execution to your rules.",
                    icon: <Search className="text-blue-500" />
                  }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl border border-white/5 bg-slate-950/50">
                    <div className="mt-1">{item.icon}</div>
                    <div>
                      <h4 className="font-bold text-white uppercase text-sm tracking-widest mb-1">{item.title}</h4>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center p-12 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(244,63,94,0.1),transparent)]" />
                <Activity size={200} className="text-rose-500/20 animate-pulse" />
                <div className="absolute bottom-8 left-8 right-8 p-6 rounded-2xl bg-slate-950 border border-rose-500/20 backdrop-blur-xl">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-2">System Alert</div>
                  <div className="text-sm font-bold text-white">Rule Violation Detected: GR-05 (Entry Confirmation) Missing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase italic mb-16">
            The Tradify <span className="text-emerald-500">Workflow</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent hidden md:block" />
            
            {[
              { step: "01", title: "MT5 Sync", desc: "Connect your terminal via our secure read-only bridge.", icon: <Zap /> },
              { step: "02", title: "Secure Sync", desc: "Trades are automatically pulled into your private vault.", icon: <Lock /> },
              { step: "03", title: "Rules & Metrics", desc: "Grade trades based on predefined strategy rules.", icon: <ShieldCheck /> },
              { step: "04", title: "Insights", desc: "Analyze session efficiency and expectancy metrics.", icon: <BarChart3 /> }
            ].map((item, i) => (
              <div key={i} className="relative z-10 group">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center mb-6 mx-auto group-hover:border-emerald-500/50 transition-colors">
                  <div className="text-emerald-500">{item.icon}</div>
                </div>
                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">{item.step}</div>
                <h4 className="font-bold text-white uppercase tracking-widest text-sm mb-2">{item.title}</h4>
                <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="py-24 bg-slate-900/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase italic mb-4">
              Core <span className="text-emerald-500">Capabilities</span>
            </h2>
            <p className="text-slate-400 uppercase tracking-widest text-[10px] font-bold">Built for serious operators</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: "Live MT5 Sync",
                desc: "Real-time P&L, equity curve, and position monitoring directly from your MT5 terminal.",
                icon: <Zap className="text-amber-500" />
              },
              {
                title: "Risk & Drawdown",
                desc: "Advanced recovery factors and expectancy metrics usually reserved for institutional desk software.",
                icon: <Activity className="text-emerald-500" />
              },
              {
                title: "Rule-Based Journal",
                desc: "Grade every trade against your trading plan rules. Identify exactly where your discipline breaks down.",
                icon: <BookOpen className="text-blue-500" />
              },
              {
                title: "Execution Metrics",
                desc: "Track Best Session, Best Day, and R:R efficiency to optimize your trading schedule.",
                icon: <TrendingUp className="text-purple-500" />
              }
            ].map((feature, i) => (
              <Card key={i} className="bg-slate-950 border-white/5 hover:border-emerald-500/20 transition-all duration-300 group">
                <CardContent className="p-8 flex items-start gap-6">
                  <div className="h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-white/5 group-hover:bg-emerald-500/10 transition-colors">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2 italic">{feature.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8">
            <Lock className="text-emerald-500" size={32} />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase italic mb-8">
            Trust & <span className="text-emerald-500">Reliability</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              "No broker credentials stored",
              "Read-only trade data",
              "No signals, no execution"
            ].map((text, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{text}</span>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm text-slate-500 leading-relaxed">
            Tradify operates on a zero-trust architecture. We do not have access to your funds, 
            and we do not provide investment advice or automated signals. Our only mission is 
            to provide the analytics you need to master your own execution.
          </p>
        </div>
      </section>

      {/* Pricing CTA Section */}
      <section className="py-24 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-[#0b1120] border border-white/10 rounded-[32px] p-8 md:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/5 blur-[120px] rounded-full" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic mb-6">
                  Ready to <span className="text-emerald-500">professionalize</span><br />your execution?
                </h2>
                <p className="text-slate-400 mb-8 max-w-md">
                  Join hundreds of traders using Tradify to build systematic discipline and institutional-grade analytics.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link href="/signup">
                    <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400">
                      Start Journaling Now
                    </Button>
                  </Link>
                  <Link href="/pricing">
                    <Button variant="ghost" className="h-14 px-8 text-white font-bold uppercase tracking-widest text-xs group">
                      Compare Plans <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl bg-slate-950/50 border border-white/5">
                  <div className="text-3xl font-black text-white mb-1">FREE</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Core Essentials</div>
                  <ul className="space-y-2">
                    <li className="text-[10px] text-slate-400 flex items-center gap-2"><CheckCircle2 size={10} className="text-emerald-500" /> Basic Journal</li>
                    <li className="text-[10px] text-slate-400 flex items-center gap-2"><CheckCircle2 size={10} className="text-emerald-500" /> 1 MT5 Sync</li>
                  </ul>
                </div>
                <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
                  <div className="text-3xl font-black text-emerald-500 mb-1">PRO</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4">$19/mo</div>
                  <ul className="space-y-2">
                    <li className="text-[10px] text-slate-200 flex items-center gap-2"><CheckCircle2 size={10} className="text-emerald-500" /> Intelligence Layer</li>
                    <li className="text-[10px] text-slate-200 flex items-center gap-2"><CheckCircle2 size={10} className="text-emerald-500" /> Unlimited Sync</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">
          &copy; 2026 Tradify Intelligence Systems. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
