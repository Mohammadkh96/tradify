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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <TrendingUp size={24} strokeWidth={3} />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tighter text-foreground uppercase italic leading-none">Tradify</span>
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Terminal</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest text-xs">
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest text-xs px-6">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <ShieldCheck size={14} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Institutional Performance Engine</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]">
            Standardize your<br />
            <span className="text-primary">execution logic</span><br />
            with MT5 sync
          </h1>
          
          <div className="bg-card border border-border rounded-2xl p-6 mb-12 max-w-2xl mx-auto text-left shadow-lg">
            <h3 className="text-primary font-bold uppercase tracking-widest text-sm mb-2">Designed for Discipline</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Tradify is for MT5 traders who want execution discipline and performance clarity. 
              <span className="block mt-2 text-destructive font-bold">NOT FOR: Signal seekers, shortcut beginners, or copy traders.</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-primary/90 shadow-xl shadow-primary/20">
                Create Account
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-accent hover:text-foreground">
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
                Execution <span className="text-destructive">Variance</span>
              </h2>
              <div className="space-y-6">
                {[
                  {
                    title: "Execution Inconsistency",
                    desc: "Impulsive entries outside of strategy parameters. Tradify identifies deviations from your defined logic.",
                    icon: <AlertCircle className="text-destructive" />
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
                  <div key={i} className="flex gap-4 p-4 rounded-2xl border border-border bg-card shadow-sm">
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
              <div className="aspect-square rounded-3xl bg-card border border-border flex items-center justify-center p-12 overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--destructive)/0.05),transparent)]" />
                <Activity size={200} className="text-destructive/10 animate-pulse" />
                <div className="absolute bottom-8 left-8 right-8 p-6 rounded-2xl bg-background border border-destructive/20 shadow-xl">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive mb-2">System Alert</div>
                  <div className="text-sm font-bold text-foreground">Rule Violation Detected: GR-05 (Entry Confirmation) Missing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-16">
            System <span className="text-primary">Architecture</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-border hidden md:block" />
            
            {[
              { step: "01", title: "MT5 Integration", desc: "Terminal connection via secure local bridge.", icon: <Zap /> },
              { step: "02", title: "Data Ingestion", desc: "Automated read-only trade log retrieval.", icon: <Lock /> },
              { step: "03", title: "Rule Validation", desc: "Objective grading against strategy parameters.", icon: <ShieldCheck /> },
              { step: "04", title: "Analytics", desc: "Session efficiency and expectancy calculation.", icon: <BarChart3 /> }
            ].map((item, i) => (
              <div key={i} className="relative z-10 group">
                <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-6 mx-auto shadow-md group-hover:border-primary/50 transition-colors">
                  <div className="text-primary">{item.icon}</div>
                </div>
                <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">{item.step}</div>
                <h4 className="font-bold text-foreground uppercase tracking-widest text-sm mb-2">{item.title}</h4>
                <p className="text-xs text-muted-foreground max-w-[200px] mx-auto leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border text-center">
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          <Link href="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors">Terms</Link>
          <Link href="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors">Privacy</Link>
          <Link href="/risk" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors">Risk Disclaimer</Link>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em]">
          &copy; 2026 Tradify Intelligence Systems. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
