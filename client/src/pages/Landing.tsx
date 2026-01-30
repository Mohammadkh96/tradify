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

import { PublicNavbar } from "@/components/PublicNavbar";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <PublicNavbar />
      
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
          
          <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]">
            Standardize your<br />
            <span className="text-emerald-500">execution logic</span><br />
            with MT5 sync
          </h1>
          
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-12 max-w-2xl mx-auto text-left">
            <h3 className="text-emerald-500 font-bold uppercase tracking-widest text-sm mb-2">Designed for Discipline</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Tradify is for MT5 traders who want execution discipline and performance clarity. 
              <span className="block mt-2 text-rose-500 font-bold">NOT FOR: Signal seekers, shortcut beginners, or copy traders.</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20">
                Create Account
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted">
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 border-y border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-8">
                Execution <span className="text-rose-500">Variance</span>
              </h2>
              <div className="space-y-6">
                {[
                  {
                    title: "Execution Inconsistency",
                    desc: "Impulsive entries outside of strategy parameters. Tradify identifies deviations from your defined logic.",
                    icon: <AlertCircle className="text-rose-500" />
                  },
                  {
                    title: "Overtrading",
                    desc: "Capital depletion through excessive trade frequency. Monitor position count relative to session rules.",
                    icon: <Zap className="text-amber-500" />
                  },
                  {
                    title: "Post-Trade Feedback",
                    desc: "Linking terminal execution directly to strategy rules for objective performance auditing.",
                    icon: <Search className="text-blue-500" />
                  }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl border border-border bg-background/50">
                    <div className="mt-1">{item.icon}</div>
                    <div>
                      <h4 className="font-bold text-foreground uppercase text-sm tracking-widest mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-muted to-background border border-border flex items-center justify-center p-12 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(244,63,94,0.1),transparent)]" />
                <Activity size={200} className="text-rose-500/20 animate-pulse" />
                <div className="absolute bottom-8 left-8 right-8 p-6 rounded-2xl bg-background border border-rose-500/20 backdrop-blur-xl">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-2">System Alert</div>
                  <div className="text-sm font-bold text-foreground">Rule Violation Detected: GR-05 (Entry Confirmation) Missing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-16">
            System <span className="text-emerald-500">Architecture</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent hidden md:block" />
            
            {[
              { step: "01", title: "MT5 Integration", desc: "Terminal connection via secure local bridge.", icon: <Zap /> },
              { step: "02", title: "Data Ingestion", desc: "Automated read-only trade log retrieval.", icon: <Lock /> },
              { step: "03", title: "Rule Validation", desc: "Objective grading against strategy parameters.", icon: <ShieldCheck /> },
              { step: "04", title: "Analytics", desc: "Session efficiency and expectancy calculation.", icon: <BarChart3 /> }
            ].map((item, i) => (
              <div key={i} className="relative z-10 group">
                <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 mx-auto transition-colors">
                  <div className="text-emerald-500">{item.icon}</div>
                </div>
                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">{item.step}</div>
                <h4 className="font-bold text-foreground uppercase tracking-widest text-sm mb-2">{item.title}</h4>
                <p className="text-xs text-muted-foreground max-w-[200px] mx-auto leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="py-24 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Functional <span className="text-emerald-500">Specifications</span>
            </h2>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Terminal integration architecture</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: "MT5 Local Bridge",
                desc: "Secure read-only terminal polling for real-time equity and position tracking.",
                icon: <Zap className="text-amber-500" />
              },
              {
                title: "Risk Parameters",
                desc: "Calculation of Max Drawdown, Recovery Factor, and expectancy metrics.",
                icon: <Activity className="text-emerald-500" />
              },
              {
                title: "Logic Validation",
                desc: "Post-trade auditing against predefined strategy rules and execution parameters.",
                icon: <BookOpen className="text-blue-500" />
              },
              {
                title: "Operational Metrics",
                desc: "Efficiency analysis by session, day, and risk-reward ratios.",
                icon: <TrendingUp className="text-purple-500" />
              }
            ].map((feature, i) => (
              <Card key={i} className="bg-background border-border hover:border-emerald-500/20 transition-all duration-300 group">
                <CardContent className="p-8 flex items-start gap-6">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border group-hover:bg-emerald-500/10 transition-colors">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground uppercase tracking-widest mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8">
            <Lock className="text-emerald-500" size={32} />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase italic mb-8">
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
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{text}</span>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm text-muted-foreground leading-relaxed">
            Tradify operates on a zero-trust architecture. We do not have access to your funds, 
            and we do not provide investment advice or automated signals. Our only mission is 
            to provide the analytics you need to master your own execution.
          </p>
        </div>
      </section>

      {/* Pricing CTA Section */}
      <section className="py-24 bg-gradient-to-b from-background to-muted">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-card border border-border rounded-[32px] p-8 md:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/5 blur-[120px] rounded-full" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <h2 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase mb-6">
                  Standardize your<br />execution.
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  Deploy Tradify to enforce systematic discipline and utilize institutional-grade analytics.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link href="/signup">
                    <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400">
                      Access Terminal
                    </Button>
                  </Link>
                  <Link href="/pricing">
                    <Button variant="ghost" className="h-14 px-8 text-foreground font-bold uppercase tracking-widest text-xs group">
                      Subscription Tiers <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="p-6 rounded-2xl bg-background/50 border border-border">
                  <div className="text-3xl font-black text-foreground mb-1">FREE</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Core Implementation</div>
                  <ul className="space-y-2">
                    <li className="text-[10px] text-muted-foreground flex items-center gap-2"><CheckCircle2 size={10} className="text-emerald-500" /> 1 Terminal Sync</li>
                    <li className="text-[10px] text-muted-foreground flex items-center gap-2"><CheckCircle2 size={10} className="text-emerald-500" /> Operational Log</li>
                  </ul>
                </div>
                <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
                  <div className="text-3xl font-black text-emerald-500 mb-1">PRO</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4">$29/mo</div>
                  <ul className="space-y-2">
                    <li className="text-[10px] text-foreground flex items-center gap-2"><CheckCircle2 size={10} className="text-emerald-500" /> Intelligence Layer</li>
                    <li className="text-[10px] text-foreground flex items-center gap-2"><CheckCircle2 size={10} className="text-emerald-500" /> Multi-Terminal Sync</li>
                  </ul>
                </div>
                <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 shadow-2xl shadow-amber-500/10">
                  <div className="text-3xl font-black text-amber-500 mb-1">ELITE</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-4">$59/mo</div>
                  <ul className="space-y-2">
                    <li className="text-[10px] text-foreground flex items-center gap-2"><CheckCircle2 size={10} className="text-amber-500" /> Session Analytics</li>
                    <li className="text-[10px] text-foreground flex items-center gap-2"><CheckCircle2 size={10} className="text-amber-500" /> Behavioral Risk Flags</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border text-center">
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          <Link href="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Terms</Link>
          <Link href="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Privacy</Link>
          <Link href="/risk-disclaimer" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Risk Disclaimer</Link>
          <a 
            href="mailto:support@tradify.app?subject=Tradify Support Request" 
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-contact-us-footer"
          >
            Contact Us
          </a>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
          &copy; 2026 Tradify Intelligence Systems. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
