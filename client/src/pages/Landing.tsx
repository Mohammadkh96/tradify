import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Activity, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  BookOpen,
  Sparkles,
  Crown,
  Target,
  Calculator,
  Users,
  Brain,
  Clock,
  Trophy,
  MonitorSmartphone,
  Shield,
  X,
  ChevronRight,
  Flame,
  Upload,
  HeartPulse,
  Mail,
  Download,
  FileText,
  Loader2,
  Star
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";
import { captureUTMParams, getStoredUTM } from "@/lib/utm";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);
  
  return <span>{count.toLocaleString()}{suffix}</span>;
}

export default function Landing() {
  const [activeScreenshotTab, setActiveScreenshotTab] = useState(0);
  const [checklistEmail, setChecklistEmail] = useState("");
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistSubmitted, setChecklistSubmitted] = useState(false);

  const [calcAccountSize, setCalcAccountSize] = useState("");
  const [calcDrawdown, setCalcDrawdown] = useState("");
  const [calcProfitTarget, setCalcProfitTarget] = useState("");
  const [calcEmail, setCalcEmail] = useState("");
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcSaved, setCalcSaved] = useState(false);

  const [founderCount, setFounderCount] = useState<{ claimed: number; remaining: number; total: number; isFull: boolean } | null>(null);

  useEffect(() => {
    captureUTMParams();
    fetch("/api/founding-members/count")
      .then(r => r.json())
      .then(d => setFounderCount(d))
      .catch(() => {});
  }, []);

  const handleChecklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecklistLoading(true);
    try {
      const utm = getStoredUTM();
      const res = await fetch("/api/leads/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: checklistEmail, ...(utm || {}) }),
      });
      if (res.ok) {
        setChecklistSubmitted(true);
      }
    } catch {
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleCalcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalcLoading(true);
    try {
      const utm = getStoredUTM();
      const res = await fetch("/api/leads/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: calcEmail,
          accountSize: calcAccountSize,
          drawdownPercent: calcDrawdown,
          profitTarget: calcProfitTarget,
          ...(utm || {}),
        }),
      });
      if (res.ok) {
        setCalcSaved(true);
      }
    } catch {
    } finally {
      setCalcLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO 
        title="TradifyApp - Trading Discipline Platform | Enforce Your Rules, Pass Prop Challenges"
        description="80% of traders fail prop challenges because they break their own rules. TradifyApp enforces your trading rules, tracks drawdown in real time, and stops revenge trading before it starts. Free plan available."
        canonical="https://tradifyapp.com/"
        ogImage="https://tradifyapp.com/images/tradify-promo-1.png"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "TradifyApp",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "Trading discipline platform that enforces your rules, auto-syncs MT5 trades, tracks prop firm drawdown in real time, and flags behavioral mistakes before they cost you.",
            "url": "https://tradifyapp.com",
            "offers": [
              { "@type": "Offer", "price": "0", "priceCurrency": "USD", "name": "Free Plan" },
              { "@type": "Offer", "price": "29", "priceCurrency": "USD", "name": "Pro Plan", "billingIncrement": "month" },
              { "@type": "Offer", "price": "59", "priceCurrency": "USD", "name": "Elite Plan", "billingIncrement": "month" }
            ],
            "applicationSubCategory": "Trading Discipline Platform"
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "Is TradifyApp free to use?", "acceptedAnswer": { "@type": "Answer", "text": "Yes! TradifyApp has a free forever plan that includes MT5 multi-account sync, trade journal with 30-day history, psychology tracking, CSV import, risk calculators, and 3 education lessons. No credit card required." } },
              { "@type": "Question", "name": "Does TradifyApp place trades or access my broker?", "acceptedAnswer": { "@type": "Answer", "text": "No. TradifyApp is strictly read-only. We never access your broker credentials, place trades, or modify orders. Our MT5 Expert Advisor only reads your trade data." } },
              { "@type": "Question", "name": "How does the MT5 auto-sync work?", "acceptedAnswer": { "@type": "Answer", "text": "You install a free Expert Advisor (EA) on your MetaTrader 5 platform. It runs in the background and automatically sends your trade data to TradifyApp in real time." } },
              { "@type": "Question", "name": "Can I track multiple MT5 accounts?", "acceptedAnswer": { "@type": "Answer", "text": "Yes! TradifyApp supports multi-account connectivity. You can connect and independently track trades, equity, and analytics for each of your MT5 accounts from one dashboard." } },
              { "@type": "Question", "name": "What is the Prop Firm Challenge Tracker?", "acceptedAnswer": { "@type": "Answer", "text": "It's a tool that monitors your prop firm challenge rules in real time — profit targets, drawdown limits, consistency scores, and days remaining." } },
              { "@type": "Question", "name": "What's the difference between Pro and Elite?", "acceptedAnswer": { "@type": "Answer", "text": "Pro includes AI instrument analysis, prop firm tracker, full education hub, and psychology review. Elite adds session analytics, behavioral risk flags, AI challenge risk warnings, strategy deviation analysis, and monthly AI review reports." } },
              { "@type": "Question", "name": "What is the Founding Member program?", "acceptedAnswer": { "@type": "Answer", "text": "Founding Members are early adopters who get 1 month of free Pro access, a permanent 30% lifetime discount on all plans, feature voting rights, and an exclusive crown badge." } },
              { "@type": "Question", "name": "Can I cancel my subscription anytime?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, you can cancel your Pro or Elite subscription at any time. You'll continue to have access until the end of your billing period, then you'll be downgraded to the free plan." } },
              { "@type": "Question", "name": "What is a trading journal and why do I need one?", "acceptedAnswer": { "@type": "Answer", "text": "A trading journal is a structured record of every trade you take, including entry/exit prices, position sizes, emotions, and rule compliance. It helps you identify patterns in your behavior, track your edge over time, and build the discipline needed for consistent profitability. Without a journal, you're trading blind — repeating mistakes without ever knowing what's actually working." } },
              { "@type": "Question", "name": "How do I track drawdown in prop firm challenges?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp's Prop Firm Challenge Tracker monitors your drawdown in real time by syncing directly with your MT5 account. It calculates both daily and overall drawdown against your challenge rules, tracks trailing drawdown with high water mark, and shows visual gauges so you always know exactly how much room you have left. You can set up presets for FTMO, MyFundedFX, The Funded Trader, or create custom configurations." } },
              { "@type": "Question", "name": "Can I use TradifyApp with multiple MT5 accounts?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, TradifyApp supports unlimited MT5 account connections. You can track personal accounts, prop firm challenge accounts, and funded accounts all from one dashboard. Each account syncs independently with its own analytics, equity curve, and trade history. This is available on all plans including the free tier." } },
              { "@type": "Question", "name": "What makes TradifyApp different from other trading journals?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp is built specifically for disciplined trading, not just trade logging. Unlike generic journals, it enforces your trading rules before you can enter a trade, auto-syncs from MT5 so you never miss a trade, tracks prop firm challenge rules in real time, and includes a structured education hub with 19 lessons. It's designed to change your trading behavior, not just record it." } },
              { "@type": "Question", "name": "Is my trading data secure with TradifyApp?", "acceptedAnswer": { "@type": "Answer", "text": "Absolutely. TradifyApp operates on a zero-trust security model. We never store your broker credentials, never access your funds, and never execute trades on your behalf. Our MT5 Expert Advisor is strictly read-only — it only reads trade data from your terminal. Your account is protected with email verification and encrypted data storage." } },
              { "@type": "Question", "name": "How does TradifyApp help me become a more disciplined trader?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp enforces discipline through three mechanisms: rule validation that requires you to log your setup and confirm rule compliance before entering trades, psychology tracking that records your emotional state and identifies patterns like revenge trading or overtrading, and a structured education hub that teaches systematic trading from the ground up. The AI-powered analytics then show you exactly where discipline breaks down in your trading." } },
              { "@type": "Question", "name": "Who is TradifyApp best for?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp is designed for MT5 traders who want to improve their discipline — especially prop firm challenge traders, day traders, and swing traders. Whether you're trying to pass an FTMO challenge, track drawdown on a funded account, or simply stop breaking your own rules, TradifyApp gives you the enforcement tools and analytics to trade consistently." } },
              { "@type": "Question", "name": "Is TradifyApp useful for discretionary traders?", "acceptedAnswer": { "@type": "Answer", "text": "Absolutely. TradifyApp doesn't impose a fixed strategy — it enforces YOUR rules, whatever they are. You define your own entry criteria, risk limits, session restrictions, and instrument rules. The platform validates each trade against your personal plan, making it ideal for discretionary traders who have a system but struggle to follow it under pressure." } },
              { "@type": "Question", "name": "Does TradifyApp work with prop firm challenges?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — prop firm challenge tracking is one of TradifyApp's core features. It monitors your profit target progress, daily and overall drawdown, trailing drawdown with high water mark, consistency score, and days remaining in real time. It includes presets for FTMO, MyFundedFX, The Funded Trader, and supports fully custom challenge configurations." } },
              { "@type": "Question", "name": "How is TradifyApp different from TraderSync or Edgewonk?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp is built around discipline enforcement, not just trade logging. Unlike TraderSync or Edgewonk, TradifyApp enforces your rules before trades are logged (pre-trade validation), auto-syncs from MT5 in real time so you never miss a trade, includes dedicated prop firm challenge tracking with live drawdown gauges, and offers AI-powered behavioral analysis that detects revenge trading and overtrading patterns. It also includes a structured 19-lesson education hub and a free forever plan." } }
            ]
          }
        ]}
      />
      <PublicNavbar />

      {/* Founding Member Sticky Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0F1E]/96 backdrop-blur-md border-t border-amber-500/25 shadow-2xl shadow-black/40" data-testid="banner-founding-member">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Crown className="h-4 w-4 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-500 mb-0.5">
                Founding Member Program
              </div>
              <div className="text-[11px] text-muted-foreground font-medium leading-none">
                {founderCount
                  ? founderCount.isFull
                    ? "All 500 founding spots have been claimed."
                    : <>1 month free Pro · 30% lifetime discount · <span className="text-foreground font-bold">{founderCount.remaining} of {founderCount.total} spots remaining</span></>
                  : "1 month free Pro · 30% lifetime discount · Limited to 500 members"}
              </div>
            </div>
          </div>
          <Link to="/signup" className="shrink-0" data-testid="button-sticky-founding-cta">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-lg px-5 h-8 shadow-lg shadow-amber-500/20 whitespace-nowrap">
              {founderCount?.isFull ? "Create Account" : "Claim Your Spot"} <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Hero Section */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <Flame size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Trading Discipline Platform</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]">
            Your Rules.<br />
            <span className="text-emerald-500">Enforced.</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Failing prop challenges. Breaking your own rules. Revenge trading after losses. 
            TradifyApp enforces your discipline — auto-syncing every MT5 trade, tracking drawdown in real time, 
            and catching mistakes before they cost you.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {[
              "Stop Revenge Trading",
              "Pass Prop Challenges",
              "Follow Your Rules",
              "Track Drawdown Live"
            ].map((tag) => (
              <Badge key={tag} variant="outline" className="bg-muted/50 border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest py-1 px-3">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/signup" data-testid="link-hero-signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20" data-testid="button-hero-signup">
                Start Free - No Card Required
              </Button>
            </Link>
            <Link to="/pricing" data-testid="link-hero-pricing">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted" data-testid="button-hero-pricing">
                View Plans
              </Button>
            </Link>
          </div>
          
          <p className="text-xs text-muted-foreground mb-16">
            Free forever plan available. No credit card needed. Set up in under 2 minutes.
          </p>

          <div className="max-w-5xl mx-auto" data-testid="hero-dashboard-preview">
            <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-emerald-500/5 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground ml-2">TradifyApp Dashboard</span>
              </div>

              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Balance</div>
                    <div className="text-sm sm:text-lg font-black text-foreground font-mono">$104,280</div>
                    <div className="text-[9px] text-emerald-500 font-bold">+4.28%</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Win Rate</div>
                    <div className="text-sm sm:text-lg font-black text-emerald-500 font-mono">62.4%</div>
                    <div className="text-[9px] text-muted-foreground font-bold">78 trades</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Rule Compliance</div>
                    <div className="text-sm sm:text-lg font-black text-amber-500 font-mono">87%</div>
                    <div className="text-[9px] text-rose-400 font-bold">3 violations</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Max Drawdown</div>
                    <div className="text-sm sm:text-lg font-black text-foreground font-mono">4.2%</div>
                    <div className="text-[9px] text-muted-foreground font-bold">of 10% limit</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Equity Curve</span>
                      <span className="text-[9px] font-bold text-emerald-500">+$4,280</span>
                    </div>
                    <div className="h-24 sm:h-32 flex items-end gap-[2px]">
                      {[40,42,38,45,43,48,46,52,50,55,53,58,56,61,59,64,62,58,63,67,65,70,68,73,71,76,74,72,78,80,77,82,85,83,88,86,90,88,92,95].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-emerald-500/40 hover:bg-emerald-500/70 transition-colors"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Prop Challenge</div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Profit Target</span>
                          <span className="text-[10px] font-black text-emerald-500">72%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: "72%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Drawdown Used</span>
                          <span className="text-[10px] font-black text-amber-500">42%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: "42%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Consistency</span>
                          <span className="text-[10px] font-black text-blue-400">91%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: "91%" }} />
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Days Left</span>
                          <span className="text-xs font-black text-foreground">18</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry Pain Stats */}
      <section className="py-12 border-y border-border bg-muted/20" data-testid="section-social-proof">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 80, suffix: "%+", label: "Prop Firm Failure Rate", source: "FTMO Transparency Report", icon: <AlertCircle size={20} className="text-rose-500" /> },
              { value: 92, suffix: "%", label: "Traders Break Their Own Rules", source: "Steenbarger, Trading Psychology 2.0", icon: <ShieldCheck size={20} className="text-amber-500" /> },
              { value: 3, suffix: "x", label: "More Likely to Overtrade After a Loss", source: "Douglas, Trading in the Zone", icon: <Flame size={20} className="text-orange-500" /> },
              { value: 47, suffix: "%", label: "Of Losses Come From Rule Violations", source: "Journal of Behavioral Finance", icon: <Target size={20} className="text-red-500" /> }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                {stat.icon}
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</div>
                <div className="text-[8px] italic text-muted-foreground/60">{stat.source}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who Is TradifyApp For? */}
      <section className="py-24 overflow-hidden" data-testid="section-who-is-it-for">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Sound <span className="text-emerald-500">Familiar?</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Every trader hits these walls. TradifyApp was built to break through them.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "\"I keep failing prop firm challenges\"",
                desc: "You hit your drawdown limit without realizing it. You lose track of your profit target. One bad day wipes out a week of progress — and you didn't even see it coming. TradifyApp tracks every challenge rule in real time so you always know exactly where you stand.",
                icon: <Trophy className="text-amber-500" size={28} />,
                features: ["Real-time drawdown tracking", "Profit target gauges", "AI risk check before trades", "FTMO, MFF & custom presets"]
              },
              {
                title: "\"I can't stop breaking my own rules\"",
                desc: "You wrote the rules. You know they work. But in the heat of the moment, you skip them — revenge trade, overtrade, move your stop loss. TradifyApp validates every trade against your strategy before it counts, turning your rules into a system you actually follow.",
                icon: <ShieldCheck className="text-blue-500" size={28} />,
                features: ["Pre-trade rule validation", "Strategy deviation detection", "Behavioral risk flags", "Psychology tracking"]
              },
              {
                title: "\"I don't journal because it's too much work\"",
                desc: "You know journaling works, but manually logging trades after every session? Nobody has time for that. So you skip it, lose the data, and repeat the same mistakes. TradifyApp auto-syncs every trade from MT5 — zero manual entry, zero excuses.",
                icon: <Zap className="text-emerald-500" size={28} />,
                features: ["MT5 auto-sync in real time", "Multi-account connectivity", "Full P&L tracking", "Session & time analytics"]
              }
            ].map((persona, i) => (
              <Card key={i} className="bg-background border-border hover:border-emerald-500/20 transition-all duration-300 overflow-hidden group" data-testid={`card-persona-${i}`}>
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 group-hover:bg-emerald-500/10 transition-colors">
                    {persona.icon}
                  </div>
                  <h3 className="text-lg font-black text-foreground tracking-wide mb-3">{persona.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{persona.desc}</p>
                  <div className="space-y-2">
                    {persona.features.map((f, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Magnet: Pre-Trade Checklist */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-checklist-lead">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <Download size={12} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Free Download</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
                Get the Free<br /><span className="text-emerald-500">Pre-Trade Checklist</span>
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                The same checklist disciplined traders use before every single trade. 
                Print it, pin it to your monitor, and stop making impulsive entries.
              </p>
              <div className="space-y-2 mb-6">
                {[
                  { text: "HTF bias confirmation with rule enforcement check", num: "01" },
                  { text: "Drawdown status vs current prop firm limit", num: "02" },
                  { text: "Behavioral discipline trigger review", num: "03" },
                  { text: "Emotional readiness audit", num: "04" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 group" data-testid={`checklist-preview-${i}`}>
                    <div className="h-7 w-7 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-black text-emerald-500 font-mono">{item.num}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.text}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-dashed border-border/30 opacity-50">
                  <div className="h-7 w-7 rounded bg-muted/30 border border-border/30 flex items-center justify-center shrink-0">
                    <Lock size={12} className="text-muted-foreground/50" />
                  </div>
                  <span className="text-sm text-muted-foreground/60 italic">+ 20 more items — enter email to unlock</span>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-background border border-border">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <FileText className="text-emerald-500" size={28} />
              </div>
              <h3 className="text-lg font-black text-foreground text-center uppercase tracking-widest mb-2">
                Enter Your Email
              </h3>
              <p className="text-xs text-muted-foreground text-center mb-6">
                Get instant access — no spam, ever.
              </p>
              {checklistSubmitted ? (
                <div className="text-center space-y-4" data-testid="checklist-success">
                  <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="text-emerald-500" size={28} />
                  </div>
                  <p className="text-sm font-bold text-emerald-500">Checklist ready!</p>
                  <Link to="/checklist" target="_blank">
                    <Button className="w-full h-12 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-400" data-testid="button-download-checklist">
                      <Download className="mr-2 h-4 w-4" />
                      View & Print Checklist
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleChecklistSubmit} className="space-y-3" data-testid="form-checklist">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={checklistEmail}
                    onChange={(e) => setChecklistEmail(e.target.value)}
                    required
                    className="h-12 bg-muted/50 border-border text-foreground rounded-xl"
                    data-testid="input-checklist-email"
                  />
                  <Button
                    type="submit"
                    disabled={checklistLoading}
                    className="w-full h-12 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-400"
                    data-testid="button-checklist-submit"
                  >
                    {checklistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Get Free Checklist
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Competitive Comparison Table */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-comparison">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Why traders choose <span className="text-emerald-500">TradifyApp</span> over the alternatives
            </h2>
            <p className="text-muted-foreground">See how TradifyApp compares to the most popular trading journals.</p>
          </div>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[640px] text-left border-collapse" data-testid="table-comparison">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-4 pr-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[200px]">Feature</th>
                  <th className="py-4 px-3 text-center">
                    <div className="text-sm font-black text-emerald-500 uppercase tracking-widest">TradifyApp</div>
                  </th>
                  <th className="py-4 px-3 text-center">
                    <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">TraderSync</div>
                  </th>
                  <th className="py-4 px-3 text-center">
                    <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Edgewonk</div>
                  </th>
                  <th className="py-4 px-3 text-center">
                    <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">TradeZella / Tradervue</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "MT5 Auto-Sync (Real-Time)", tradify: true, tradersync: false, edgewonk: false, tradezella: false },
                  { feature: "Prop Firm Challenge Tracking", tradify: true, tradersync: false, edgewonk: false, tradezella: "partial" },
                  { feature: "Pre-Trade Rule Enforcement", tradify: true, tradersync: false, edgewonk: false, tradezella: false },
                  { feature: "AI Behavioral Analysis", tradify: true, tradersync: false, edgewonk: false, tradezella: false },
                  { feature: "Psychology & Mood Tracking", tradify: true, tradersync: true, edgewonk: true, tradezella: true },
                  { feature: "Education Hub (Structured)", tradify: true, tradersync: false, edgewonk: false, tradezella: false },
                  { feature: "Free Plan Available", tradify: true, tradersync: false, edgewonk: false, tradezella: false },
                  { feature: "Starting Price", tradify: "Free", tradersync: "$29.95/mo", edgewonk: "$169 once", tradezella: "$49/mo" },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border/50" data-testid={`row-comparison-${i}`}>
                    <td className="py-3.5 pr-4 text-xs font-bold text-foreground">{row.feature}</td>
                    {(["tradify", "tradersync", "edgewonk", "tradezella"] as const).map((col) => {
                      const val = row[col];
                      return (
                        <td key={col} className={`py-3.5 px-3 text-center ${col === "tradify" ? "bg-emerald-500/5" : ""}`}>
                          {val === true ? (
                            <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                          ) : val === false ? (
                            <X size={16} className="text-rose-500/60 mx-auto" />
                          ) : val === "partial" ? (
                            <span className="text-[10px] font-bold text-amber-500 uppercase">Partial</span>
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-muted-foreground/50 text-center mt-6 italic">Comparison based on publicly available feature lists as of 2026. Features may change.</p>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
            Ready in <span className="text-emerald-500">3 Steps</span>
          </h2>
          <p className="text-muted-foreground mb-16 max-w-xl mx-auto">No complex setup. No broker credentials shared. Just connect and start tracking.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent hidden md:block" />
            
            <div className="relative z-10 group">
              <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 mx-auto">
                <div className="text-emerald-500"><Users /></div>
              </div>
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">01</div>
              <h4 className="font-bold text-foreground uppercase tracking-widest text-sm mb-2">Create Account</h4>
              <p className="text-xs text-muted-foreground max-w-[250px] mx-auto leading-relaxed mb-4">Sign up free in 30 seconds. No credit card required. Pick your plan later.</p>
              <div className="mx-auto max-w-[200px] p-3 rounded-xl bg-card border border-border" data-testid="mockup-step-1">
                <div className="space-y-2">
                  <div className="h-6 rounded bg-muted/50 border border-border px-2 flex items-center">
                    <span className="text-[8px] text-muted-foreground/50 font-mono">your@email.com</span>
                  </div>
                  <div className="h-6 rounded bg-muted/50 border border-border px-2 flex items-center">
                    <span className="text-[8px] text-muted-foreground/50 font-mono">••••••••</span>
                  </div>
                  <div className="h-6 rounded-md bg-emerald-500 flex items-center justify-center">
                    <span className="text-[8px] font-black text-slate-950 uppercase tracking-widest">Start Free</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 group">
              <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 mx-auto">
                <div className="text-emerald-500"><MonitorSmartphone /></div>
              </div>
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">02</div>
              <h4 className="font-bold text-foreground uppercase tracking-widest text-sm mb-2">Connect MT5</h4>
              <p className="text-xs text-muted-foreground max-w-[250px] mx-auto leading-relaxed mb-4">Install our free Expert Advisor on MT5. It reads your trades automatically - read-only, no broker access needed.</p>
              <div className="mx-auto max-w-[200px] p-3 rounded-xl bg-card border border-border font-mono" data-testid="mockup-step-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[8px] text-emerald-500 font-bold">EA Connected</span>
                </div>
                <div className="text-[8px] text-muted-foreground space-y-1">
                  <div>Account: <span className="text-foreground">12345678</span></div>
                  <div>Status: <span className="text-emerald-500">Syncing...</span></div>
                  <div>Trades: <span className="text-foreground">78 imported</span></div>
                </div>
              </div>
            </div>

            <div className="relative z-10 group sm:col-span-2 md:col-span-1">
              <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 mx-auto">
                <div className="text-emerald-500"><TrendingUp /></div>
              </div>
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">03</div>
              <h4 className="font-bold text-foreground uppercase tracking-widest text-sm mb-2">Trade & Track</h4>
              <p className="text-xs text-muted-foreground max-w-[250px] mx-auto leading-relaxed mb-4">Every trade auto-syncs. Set your rules. Track your prop firm. Watch your discipline improve.</p>
              <div className="mx-auto max-w-[200px] p-3 rounded-xl bg-card border border-border" data-testid="mockup-step-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Equity</span>
                  <span className="text-[8px] font-bold text-emerald-500">+$4,280</span>
                </div>
                <div className="h-12 flex items-end gap-[1px]">
                  {[40,42,38,45,43,48,46,52,50,55,53,58,56,61,59,64,62,58,63,67,65,70,68,73,71,76,74,72,78,80,77,82,85,83,88,86,90,88,92,95].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-emerald-500/40" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-24 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Every Problem. <span className="text-emerald-500">Solved.</span>
            </h2>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Real trader problems. Real solutions. No fluff.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                problem: "Too lazy to journal?",
                title: "Auto-Sync Trade Journal",
                desc: "MT5 syncs every trade instantly across multiple accounts. Import from any platform via CSV. Zero manual entry, zero excuses.",
                icon: <MonitorSmartphone className="text-cyan-500" />,
                tier: null
              },
              {
                problem: "Keep breaking your rules?",
                title: "Strategy Validation",
                desc: "Define your rules once. Every trade gets validated against them before entry. Pure accountability — no signals, no opinions.",
                icon: <ShieldCheck className="text-blue-500" />,
                tier: null
              },
              {
                problem: "Lost track of drawdown?",
                title: "Prop Firm Challenge Tracker",
                desc: "Real-time gauges for drawdown limits, profit targets, and consistency scores. FTMO, MFF presets or custom configs. Never fail from a preventable mistake.",
                icon: <Trophy className="text-amber-500" />,
                tier: "Pro"
              },
              {
                problem: "Revenge trading again?",
                title: "Behavioral Risk Flags",
                desc: "AI detects revenge trading, overtrading, and tilt patterns before they damage your account. Get flagged before you blow up, not after.",
                icon: <Activity className="text-rose-500" />,
                tier: "Elite"
              },
              {
                problem: "Guessing your position size?",
                title: "Risk & Position Calculators",
                desc: "Pre-trade risk calculations aligned with your challenge rules and strategy. Know your exact risk before every trade.",
                icon: <Calculator className="text-amber-500" />,
                tier: null
              },
              {
                problem: "No idea when you trade best?",
                title: "Session & Time Analytics",
                desc: "Discover your best sessions, days, and hours. Stop trading during your worst times and double down on what works.",
                icon: <Clock className="text-purple-500" />,
                tier: "Elite"
              },
              {
                problem: "Don't know what's actually working?",
                title: "AI Performance Intelligence",
                desc: "AI analyzes your results by instrument, finds your real edge, and shows equity curves, profit factors, and expectancy in one view.",
                icon: <Brain className="text-emerald-500" />,
                tier: "Pro"
              },
              {
                problem: "Trading on emotion?",
                title: "Psychology & Mood Tracking",
                desc: "Tag every trade with your emotional state and mistake category. See exactly how your psychology is costing you money.",
                icon: <HeartPulse className="text-pink-500" />,
                tier: null
              },
              {
                problem: "About to blow your challenge?",
                title: "AI Challenge Risk Warnings",
                desc: "Before you place a trade, check it against your active challenge rules. Get safer stop-loss suggestions and avoid catastrophic losses.",
                icon: <AlertCircle className="text-rose-500" />,
                tier: "Elite"
              },
              {
                problem: "Don't know where to start?",
                title: "Education Hub",
                desc: "19 structured lessons across 8 phases. Go from gambler to systematic trader with quizzes, strategy builders, and risk management fundamentals.",
                icon: <BookOpen className="text-cyan-500" />,
                tier: "3 free lessons"
              }
            ].map((feature, i) => (
              <Card key={i} className="bg-background border-border hover:border-emerald-500/20 transition-all duration-300 group" data-testid={`card-feature-${i}`}>
                <CardContent className="p-6 flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border group-hover:bg-emerald-500/10 transition-colors">
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-emerald-500 mb-1">{feature.problem}</p>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">{feature.title}</h3>
                        {feature.tier === "Pro" && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0 uppercase tracking-widest shrink-0">Pro</Badge>
                        )}
                        {feature.tier === "Elite" && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] py-0 uppercase tracking-widest shrink-0">Elite</Badge>
                        )}
                        {feature.tier === "3 free lessons" && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[9px] py-0 uppercase tracking-widest shrink-0">3 Free</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Prop Firm Spotlight */}
      <section className="py-24 overflow-hidden" data-testid="section-prop-firm-spotlight">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase tracking-widest mb-6">
                Pro + Elite Feature
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-6">
                Never Fail a <span className="text-amber-500">Prop Firm Challenge</span> Again
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Most traders fail prop firm challenges because they lose track of their drawdown limits. 
                TradifyApp monitors every rule in real time so you always know exactly where you stand.
              </p>
              <div className="space-y-4">
                {[
                  "FTMO, MyFundedFX, The Funded Trader presets + custom configs",
                  "Real-time profit target & drawdown gauges with visual progress",
                  "Trailing drawdown with high water mark tracking",
                  "Consistency scoring and days remaining countdown",
                  "MT5 auto-sync for automated daily stats logging",
                  "AI risk check: analyze trade impact before you enter (Elite)"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-gradient-to-br from-amber-500/5 to-background border border-amber-500/20 p-8 overflow-hidden">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Prop Firm Challenge</div>
                      <div className="text-xl font-black text-foreground">$100,000 Account</div>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] uppercase tracking-widest">Active</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-background/50 border border-border">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Profit Target</div>
                      <div className="text-2xl font-black text-emerald-500">72%</div>
                      <div className="w-full h-1.5 bg-muted rounded-full mt-2">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: "72%" }} />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-background/50 border border-border">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Max Drawdown</div>
                      <div className="text-2xl font-black text-amber-500">34%</div>
                      <div className="w-full h-1.5 bg-muted rounded-full mt-2">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: "34%" }} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-background/50 border border-border">
                      <div className="text-lg font-black text-foreground">18</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Days Left</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background/50 border border-border">
                      <div className="text-lg font-black text-emerald-500">87%</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Consistency</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background/50 border border-border">
                      <div className="text-lg font-black text-foreground">12</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Trades</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-testimonials">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              What Traders Are <span className="text-emerald-500">Saying</span>
            </h2>
            <p className="text-muted-foreground">Early feedback from traders using TradifyApp to enforce their discipline.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Alex M.",
                title: "FTMO Trader",
                quote: "I failed 3 FTMO challenges before TradifyApp. The real-time drawdown tracking alone saved me — I always know exactly how much room I have left. Passed Phase 1 on my next attempt.",
                badge: "Passed $100K FTMO Phase 1",
                stars: 5
              },
              {
                name: "Sarah K.",
                title: "Funded Trader",
                quote: "I knew my rules worked but kept breaking them under pressure. The pre-trade validation forces me to slow down and follow my plan. My consistency score went from 60% to 91% in one month.",
                badge: "91% Consistency Score",
                stars: 5
              },
              {
                name: "James R.",
                title: "Prop Firm Challenger",
                quote: "The psychology tracking changed everything. I could finally see the pattern — I was revenge trading every Monday after weekend gaps. Once I saw the data, I stopped doing it.",
                badge: "Eliminated Revenge Trading",
                stars: 5
              }
            ].map((testimonial, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-testimonial-${i}`}>
                <CardContent className="p-8">
                  <div className="flex items-center gap-0.5 mb-4">
                    {Array.from({ length: testimonial.stars }).map((_, j) => (
                      <Star key={j} size={14} className="text-emerald-500 fill-emerald-500" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 italic">"{testimonial.quote}"</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-foreground">{testimonial.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{testimonial.title}</div>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] uppercase tracking-widest">
                      {testimonial.badge}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Magnet: Prop Firm Challenge Calculator */}
      <section className="py-24 bg-gradient-to-b from-background via-blue-500/5 to-background border-y border-border" data-testid="section-calculator-lead">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <Calculator size={12} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Free Tool</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Prop Firm Challenge<br /><span className="text-blue-400">Calculator</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Find out exactly what you need to pass your prop firm challenge. Enter your numbers below.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-6">Your Challenge Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Account Size ($)</label>
                  <Input
                    type="number"
                    placeholder="100000"
                    value={calcAccountSize}
                    onChange={(e) => setCalcAccountSize(e.target.value)}
                    className="h-12 bg-muted/50 border-border text-foreground rounded-xl font-mono"
                    data-testid="input-calc-account-size"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Max Drawdown (%)</label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={calcDrawdown}
                    onChange={(e) => setCalcDrawdown(e.target.value)}
                    className="h-12 bg-muted/50 border-border text-foreground rounded-xl font-mono"
                    data-testid="input-calc-drawdown"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Profit Target (%)</label>
                  <Input
                    type="number"
                    placeholder="8"
                    value={calcProfitTarget}
                    onChange={(e) => setCalcProfitTarget(e.target.value)}
                    className="h-12 bg-muted/50 border-border text-foreground rounded-xl font-mono"
                    data-testid="input-calc-profit-target"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-6">Your Numbers</h3>
              {calcAccountSize && calcDrawdown && calcProfitTarget ? (() => {
                const acctSize = parseFloat(calcAccountSize) || 0;
                const dd = parseFloat(calcDrawdown) || 0;
                const pt = parseFloat(calcProfitTarget) || 0;
                const maxLoss = acctSize * (dd / 100);
                const profitNeeded = acctSize * (pt / 100);
                const riskPerTrade = maxLoss * 0.02;
                const riskPercent = (riskPerTrade / acctSize) * 100;
                const avgRR = 2;
                const avgWin = riskPerTrade * avgRR;
                const avgLoss2 = riskPerTrade;
                const minWinRate = avgRR > 0 ? (1 / (1 + avgRR)) * 100 : 50;
                const safeWinRate = Math.ceil(minWinRate + 5);
                const expectancy = (safeWinRate / 100) * avgWin - ((100 - safeWinRate) / 100) * avgLoss2;
                const tradesNeeded = expectancy > 0 ? Math.ceil(profitNeeded / expectancy) : 0;
                const tradingDays = 22;
                const dailyTarget = profitNeeded / tradingDays;

                const difficultyRatio = dd > 0 ? pt / dd : 99;
                const difficultyLabel = difficultyRatio <= 0.6 ? "Achievable" : difficultyRatio <= 1.0 ? "Moderate" : difficultyRatio <= 1.5 ? "Aggressive" : "Very Hard";
                const difficultyColor = difficultyRatio <= 0.6 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : difficultyRatio <= 1.0 ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-rose-400 bg-rose-400/10 border-rose-400/20";

                const resultRows = [
                  { label: "Max Drawdown Amount", value: `$${maxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-rose-400" },
                  { label: "Profit Target Amount", value: `$${profitNeeded.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-emerald-500" },
                  { label: "Suggested Risk/Trade (2% of DD)", value: `$${riskPerTrade.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${riskPercent.toFixed(2)}%)`, color: "text-blue-400" },
                  { label: "Min Win Rate Required (at 2R)", value: `${safeWinRate}%`, color: "text-violet-400" },
                  { label: "Est. Trades Needed", value: tradesNeeded > 0 ? `~${tradesNeeded} trades` : "—", color: "text-amber-400" },
                  { label: "Daily P&L Target (22 days)", value: `$${dailyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day`, color: "text-emerald-500" },
                ];

                const isUnlocked = calcSaved;

                return (
                  <div className="space-y-4">
                    <div className={`relative ${!isUnlocked ? "select-none" : ""}`}>
                      <div className={!isUnlocked ? "blur-[6px] pointer-events-none" : ""}>
                        <div className="space-y-3">
                          {resultRows.map((row, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                              <span className="text-xs text-muted-foreground">{row.label}</span>
                              <span className={`text-sm font-black font-mono ${row.color}`}>{row.value}</span>
                            </div>
                          ))}
                        </div>

                        <div className={`mt-3 flex items-center justify-between p-3 rounded-xl border ${difficultyColor}`}>
                          <span className="text-xs font-bold uppercase tracking-widest">Difficulty Score</span>
                          <span className="text-sm font-black">{difficultyLabel}</span>
                        </div>
                      </div>

                      {!isUnlocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-[2px] rounded-xl">
                          <Lock className="text-blue-400 mb-2" size={24} />
                          <p className="text-sm font-black text-foreground uppercase tracking-widest mb-1">Unlock Your Results</p>
                          <p className="text-[10px] text-muted-foreground">Enter your email below</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border">
                      {isUnlocked ? (
                        <div className="space-y-4">
                          <div className="text-center space-y-2" data-testid="calculator-success">
                            <div className="flex items-center justify-center gap-2">
                              <CheckCircle2 className="text-emerald-500" size={18} />
                              <span className="text-sm font-bold text-emerald-500">Results unlocked!</span>
                            </div>
                          </div>
                          <Link to="/signup" className="block">
                            <Button className="w-full h-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-emerald-400" data-testid="button-calc-signup">
                              TradifyApp Tracks These Metrics Automatically. Start Free →
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <form onSubmit={handleCalcSubmit} className="space-y-3" data-testid="form-calculator">
                          <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest font-bold">Enter your email to unlock results</p>
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              placeholder="your@email.com"
                              value={calcEmail}
                              onChange={(e) => setCalcEmail(e.target.value)}
                              required
                              className="h-10 bg-muted/50 border-border text-foreground rounded-xl text-sm"
                              data-testid="input-calc-email"
                            />
                            <Button
                              type="submit"
                              disabled={calcLoading}
                              className="h-10 px-6 bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-blue-400 shrink-0"
                              data-testid="button-calc-submit"
                            >
                              {calcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Calculator className="text-muted-foreground/30 mb-4" size={48} />
                  <p className="text-sm text-muted-foreground">Enter your challenge details to see your numbers</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Industry Reality & Why Discipline Matters */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-industry-proof">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              The Problem Is <span className="text-emerald-500">Clear</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">The trading industry has a discipline crisis. These numbers explain why most traders never become consistent — and why TradifyApp exists.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {[
              {
                stat: "80%+",
                label: "Prop Firm Failure Rate",
                desc: "The vast majority of traders fail prop firm challenges — not from bad strategy, but from untracked drawdowns and broken rules.",
                source: "FTMO Transparency Report",
                icon: <AlertCircle className="text-rose-500" size={24} />
              },
              {
                stat: "92%",
                label: "Break Their Own Rules",
                desc: "Nearly all traders have rules they know work. The problem isn't knowledge — it's enforcement. Without accountability, discipline collapses under pressure.",
                source: "Steenbarger, Trading Psychology 2.0",
                icon: <Shield className="text-amber-500" size={24} />
              },
              {
                stat: "3x",
                label: "More Likely to Overtrade After a Loss",
                desc: "Revenge trading is the most expensive habit in the market. Traders triple their position frequency after losses, compounding damage.",
                source: "Douglas, Trading in the Zone",
                icon: <Flame className="text-orange-500" size={24} />
              }
            ].map((item, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-industry-stat-${i}`}>
                <CardContent className="p-8 flex flex-col gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-foreground">{item.stat}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{item.label}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  <p className="text-[8px] italic text-muted-foreground/60">Source: {item.source}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-emerald-500/5 to-background border border-emerald-500/20 p-8 sm:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] uppercase tracking-widest mb-6">
                  Built to Solve This
                </Badge>
                <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight uppercase mb-4">
                  Real Capabilities. <span className="text-emerald-500">Real Discipline.</span>
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  TradifyApp doesn't promise overnight results. It gives you the systems and enforcement tools 
                  that professional traders rely on — so every trade has a reason, every rule is tracked, and 
                  every mistake becomes visible.
                </p>
                <div className="space-y-3 mb-6">
                  {[
                    "Real-time drawdown monitoring across multiple MT5 accounts",
                    "Pre-trade rule validation — no trade logged without a setup",
                    "AI behavioral detection catches revenge trading patterns",
                    "Prop firm challenge tracking with FTMO, MFF & custom presets",
                    "19-lesson education curriculum built on discipline, not signals"
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <Link to="/early-access">
                  <Button className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-full px-8 hover:bg-emerald-400" data-testid="button-proof-founding-cta">
                    Become a Founding Member <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </Link>
              </div>
              <div>
                <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-emerald-500/5 overflow-hidden" data-testid="screenshot-gallery">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                    </div>
                    <div className="flex gap-0 ml-3 -mb-[1px] relative z-10" role="tablist">
                      {[
                        { label: "Dashboard", icon: <Activity size={12} /> },
                        { label: "Prop Tracker", icon: <Target size={12} /> },
                        { label: "Rules & Journal", icon: <BookOpen size={12} /> },
                        { label: "Analytics", icon: <Brain size={12} /> }
                      ].map((tab, idx) => (
                        <button
                          key={tab.label}
                          role="tab"
                          aria-selected={activeScreenshotTab === idx}
                          aria-controls="screenshot-panel"
                          onClick={() => setActiveScreenshotTab(idx)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-t-lg transition-colors ${
                            activeScreenshotTab === idx
                              ? "bg-card text-emerald-500 border border-border border-b-card"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          data-testid={`tab-screenshot-${idx}`}
                        >
                          {tab.icon}
                          <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative overflow-hidden" role="tabpanel" id="screenshot-panel">
                    {[
                      { src: "/images/screenshots/dashboard.png", alt: "TradifyApp Dashboard — balance, win rate, rule compliance, equity curve, and prop challenge progress" },
                      { src: "/images/screenshots/prop-firm.png", alt: "Prop Firm Challenge Tracker — profit target, drawdown monitoring, consistency score, and days remaining" },
                      { src: "/images/screenshots/journal.png", alt: "Trade Journal with rule validation — trade entries with emotion tracking and compliance status" },
                      { src: "/images/screenshots/analytics.png", alt: "MT5 Analytics Bridge — multi-account sync, trade history, and performance metrics" }
                    ].map((screenshot, idx) => (
                      <img
                        key={idx}
                        src={screenshot.src}
                        alt={screenshot.alt}
                        loading={idx === 0 ? "eager" : "lazy"}
                        className={`max-w-full h-auto object-contain transition-all duration-300 ${
                          activeScreenshotTab === idx
                            ? "relative opacity-100"
                            : "absolute top-0 left-0 opacity-0 pointer-events-none"
                        }`}
                        style={{ width: "100%" }}
                        data-testid={`screenshot-img-${idx}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Traders Choose TradifyApp */}
      <section className="py-24 overflow-hidden" data-testid="section-why-traders-choose">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              How It <span className="text-emerald-500">Actually Works</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              TradifyApp isn't a trade logger. It's a discipline enforcement system. Every feature exists to solve
              one problem: the gap between knowing your rules and actually following them.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            <div>
              <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-4 flex items-center gap-3">
                <ShieldCheck className="text-emerald-500 shrink-0" size={22} />
                You Break Rules Under Pressure
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                You know your rules. You wrote them. But when the market moves against you, pressure overrides logic and you 
                enter trades that violate your own plan. TradifyApp forces you to validate every trade against your strategy rules 
                before it's logged. Maximum risk per trade, required confirmations, session restrictions, instrument limits — you 
                define them, TradifyApp enforces them. No exceptions. No "just this once."
              </p>

              <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-4 flex items-center gap-3">
                <MonitorSmartphone className="text-cyan-500 shrink-0" size={22} />
                You Skip Journaling Because It's Tedious
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You know you should journal. You've tried spreadsheets. But after the third day of copy-pasting trades from MT5, 
                you stopped. TradifyApp eliminates manual entry entirely. Install a free Expert Advisor once, and every trade from 
                every connected account flows into your dashboard in real time. No copy-pasting. No missed trades. No excuses. 
                The EA is strictly read-only — it never touches your broker credentials or places orders.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-4 flex items-center gap-3">
                <Brain className="text-emerald-500 shrink-0" size={22} />
                You Don't Know Why You're Losing
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                You look at your P&L and see red, but you don't know if it's your strategy, your timing, or your emotions causing 
                the damage. TradifyApp's AI breaks down your performance by instrument, session, time of day, and behavioral patterns. 
                It shows you which pairs actually make you money, when you trade best, and exactly where your discipline breaks down. 
                No signals, no predictions — just the uncomfortable truth about your own execution.
              </p>

              <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-4 flex items-center gap-3">
                <BookOpen className="text-blue-500 shrink-0" size={22} />
                You Learned Trading From Random YouTube Videos
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Scattered indicator tutorials and "secret strategy" videos don't build real traders. TradifyApp includes 19 structured 
                lessons across 8 progressive phases that teach what actually matters: market structure, risk management, position 
                sizing, trading psychology, and system building. Each lesson includes quizzes to test understanding. The goal isn't to 
                give you a strategy — it's to teach you how to build, test, and execute your own.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-muted/30 border border-border">
              <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <HeartPulse className="text-pink-500 shrink-0" size={18} />
                Psychology Tracking
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every trade captures your emotional state, confidence level, and mistake categories. Over weeks and months, 
                this data reveals the psychological patterns behind your wins and losses — helping you recognize and correct 
                emotional trading before it costs you money.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-muted/30 border border-border">
              <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <Calculator className="text-amber-500 shrink-0" size={18} />
                Pre-Trade Risk Calculators
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Calculate your position size, risk-reward ratio, and potential impact on your prop firm challenge before entering 
                any trade. These aren't generic calculators — they integrate with your active challenge rules to show you exactly 
                how much risk you're taking relative to your remaining drawdown allowance.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-muted/30 border border-border">
              <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <Upload className="text-teal-500 shrink-0" size={18} />
                Universal Trade Import
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Not on MT5? No problem. Import trades from MT4, TradingView, cTrader, or any platform via CSV with automatic 
                column detection. TradifyApp maps your data intelligently so you can start analyzing your performance immediately, 
                regardless of which broker or platform you use.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How TradifyApp Helps You Pass Your Prop Firm Challenge */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-prop-firm-guide">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase tracking-widest mb-6">
              Educational Guide
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              How TradifyApp Helps You <span className="text-amber-500">Pass Your Prop Firm Challenge</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Over 80% of traders fail their first prop firm challenge. The #1 reason isn't bad trading — it's poor risk management 
              and losing track of challenge rules. Here's how TradifyApp changes that.
            </p>
          </div>

          <div className="space-y-12">
            <div className="flex gap-6 items-start">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-amber-500">1</span>
              </div>
              <div>
                <h3 className="text-base font-black text-foreground uppercase tracking-widest mb-2">Know Your Numbers at All Times</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The moment you connect your MT5 account and set up your challenge parameters, TradifyApp begins tracking every metric 
                  that matters: current drawdown vs. maximum allowed, profit progress toward your target, daily loss limits, and trading 
                  day count. These aren't delayed calculations — they update in real time as your trades sync. Most traders who fail 
                  challenges don't even realize they're close to their drawdown limit until it's too late. TradifyApp makes it impossible 
                  to lose track.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-amber-500">2</span>
              </div>
              <div>
                <h3 className="text-base font-black text-foreground uppercase tracking-widest mb-2">Pre-Trade Risk Assessment</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Before you place a trade, TradifyApp's risk calculators show you exactly how that position will impact your challenge. 
                  If you're running an FTMO $100K challenge with a 10% max drawdown and you've already used 6%, the calculator will 
                  show you that a 2-lot EUR/USD position with a 50-pip stop loss would use 1% of your remaining buffer. Elite users 
                  get AI-powered risk warnings that analyze whether the trade is worth taking given your current challenge status, 
                  and suggest safer stop loss levels when your remaining margin is thin.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-amber-500">3</span>
              </div>
              <div>
                <h3 className="text-base font-black text-foreground uppercase tracking-widest mb-2">Catch Behavioral Red Flags Early</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The biggest threat to your prop firm challenge isn't the market — it's your own behavior under pressure. TradifyApp's 
                  behavioral analysis detects revenge trading patterns (entering trades immediately after a loss), overtrading 
                  (exceeding your planned number of daily trades), and emotional decision-making (trading outside your defined sessions 
                  or instruments). These flags appear before the damage is done, giving you the awareness to step away and protect 
                  your challenge. Elite users get AI-generated behavioral risk reports that quantify exactly how much these patterns 
                  are costing them.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-amber-500">4</span>
              </div>
              <div>
                <h3 className="text-base font-black text-foreground uppercase tracking-widest mb-2">Build Consistency That Firms Reward</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Most prop firms don't just want profit — they want consistent profit. A trader who makes 8% in one day and nothing 
                  for the rest of the month will often fail consistency requirements. TradifyApp tracks your consistency score across 
                  your challenge, showing you how evenly distributed your profits are across trading days. It also monitors your 
                  lot size consistency, session adherence, and strategy compliance — all factors that prop firms evaluate. By the time 
                  you pass your challenge, you'll have built the systematic habits that make you a profitable funded trader, not just 
                  someone who got lucky.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <Link to="/prop-firm-tracker" data-testid="link-prop-firm-learn-more">
              <Button variant="outline" className="h-12 px-8 border-amber-500/20 text-amber-400 font-bold uppercase tracking-widest text-xs rounded-2xl" data-testid="button-prop-firm-learn-more">
                Learn More About Prop Firm Tracking <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Founding Member Section - Enhanced */}
      <section className="py-24 bg-gradient-to-b from-background via-amber-500/5 to-background border-y border-border relative overflow-hidden" data-testid="section-founding-member">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(245,158,11,0.08),transparent_70%)]" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8 animate-pulse">
            <Flame size={14} className="text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Early Access - Limited Spots Remaining</span>
          </div>
          
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-amber-500/30">
            <Crown className="text-slate-900" size={40} />
          </div>
          
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-foreground tracking-tight uppercase mb-4">
            Become a <span className="text-amber-500">Founding Member</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join the first wave of TradifyApp traders and lock in benefits that will never be offered again. 
            Founding members get permanent privileges and shape the future of the platform.
          </p>

          {founderCount && !founderCount.isFull && (
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 mb-10">
              <Crown size={16} className="text-amber-500 shrink-0" />
              <span className="text-amber-500 font-black text-sm uppercase tracking-widest">
                {founderCount.remaining} of {founderCount.total} founding spots remaining
              </span>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { title: "1 Month Free", desc: "Full Pro access at zero cost", icon: <Sparkles className="text-amber-400" size={24} /> },
              { title: "30% Off Forever", desc: "Permanent lifetime discount", icon: <Target className="text-amber-400" size={24} /> },
              { title: "Feature Influence", desc: "Vote on what gets built next", icon: <Users className="text-amber-400" size={24} /> },
              { title: "Founding Badge", desc: "Exclusive crown badge forever", icon: <Crown className="text-amber-400" size={24} /> }
            ].map((benefit, i) => (
              <div key={i} className="p-6 rounded-2xl bg-background/80 border border-amber-500/20 hover:border-amber-500/40 transition-colors backdrop-blur-sm">
                <div className="mb-4">{benefit.icon}</div>
                <h4 className="font-black text-foreground text-sm uppercase tracking-widest mb-2">{benefit.title}</h4>
                <p className="text-xs text-muted-foreground">{benefit.desc}</p>
              </div>
            ))}
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <Link to="/early-access" data-testid="link-founding-member-cta">
              <Button className="h-16 px-12 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black uppercase tracking-widest text-sm rounded-2xl hover:from-amber-400 hover:to-amber-500 shadow-2xl shadow-amber-500/30 transition-all hover:scale-105" data-testid="button-founding-member-cta">
                <Crown className="mr-2 h-5 w-5" />
                Claim Your Founding Member Spot
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="text-xs text-amber-500/60">This offer disappears once we reach capacity</p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8">
            <Shield className="text-emerald-500" size={32} />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-8">
            Your Data is <span className="text-emerald-500">Safe</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { text: "No broker credentials stored", icon: <Lock size={18} /> },
              { text: "Read-only trade data", icon: <ShieldCheck size={18} /> },
              { text: "No signals, no execution", icon: <AlertCircle size={18} /> },
              { text: "Email verified accounts", icon: <CheckCircle2 size={18} /> }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border">
                <div className="text-emerald-500">{item.icon}</div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">{item.text}</span>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm text-muted-foreground leading-relaxed">
            TradifyApp operates on a zero-trust architecture. We never access your funds, 
            never provide investment advice, and never execute trades on your behalf. 
            Our mission is to give you the analytics and discipline tools to master your own execution.
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gradient-to-b from-background to-muted mb-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-card border border-border rounded-[32px] p-8 md:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/5 blur-[120px] rounded-full" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase mb-6">
                  Your next trade<br />deserves a system.
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  Every winning trader has a process. TradifyApp is yours. Start free, upgrade when you're ready, 
                  and never look at a spreadsheet again.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link to="/signup" data-testid="link-cta-signup">
                    <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400" data-testid="button-cta-signup">
                      Start Free Now
                    </Button>
                  </Link>
                  <Link to="/pricing" data-testid="link-cta-pricing">
                    <Button variant="ghost" className="h-14 px-8 text-foreground font-bold uppercase tracking-widest text-xs group" data-testid="button-cta-pricing">
                      Compare Plans <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 sm:p-6 rounded-2xl bg-background/50 border border-border">
                  <div className="text-2xl sm:text-3xl font-black text-foreground mb-1">FREE</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Core Tools</div>
                  <ul className="space-y-2">
                    <li className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> MT5 Multi-Account Sync</li>
                    <li className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Trade Journal (30 Days)</li>
                    <li className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Psychology & Mood Tracking</li>
                    <li className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> CSV Trade Import</li>
                    <li className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> 3 Education Lessons</li>
                  </ul>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-500 text-slate-950 border-emerald-400 text-[9px] font-black uppercase tracking-widest px-3 py-0.5 shadow-lg shadow-emerald-500/30" data-testid="badge-most-popular">
                      Most Popular
                    </Badge>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-500 mb-1 mt-2">PRO</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4">From $29/mo</div>
                  <ul className="space-y-2">
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> AI Psychology Review</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> AI Instrument Analysis</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Full Education Hub</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Prop Firm Tracker</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> PDF & CSV Export</li>
                  </ul>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 shadow-2xl shadow-amber-500/10">
                  <div className="text-2xl sm:text-3xl font-black text-amber-500 mb-1">ELITE</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-4">From $59/mo</div>
                  <ul className="space-y-2">
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500 shrink-0" /> AI Challenge Risk Warnings</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500 shrink-0" /> Session Analytics</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500 shrink-0" /> Behavioral Risk Flags</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500 shrink-0" /> Monthly AI Review</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 border-b border-border" data-testid="section-faq">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Frequently Asked <span className="text-emerald-500">Questions</span>
            </h2>
            <p className="text-muted-foreground">Everything you need to know before getting started.</p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Is TradifyApp free to use?",
                a: "Yes! TradifyApp has a free forever plan that includes MT5 multi-account sync, trade journal with 30-day history, psychology tracking, CSV import, risk calculators, and 3 education lessons. No credit card required."
              },
              {
                q: "Does TradifyApp place trades or access my broker?",
                a: "No. TradifyApp is strictly read-only. We never access your broker credentials, place trades, or modify orders. Our MT5 Expert Advisor only reads your trade data — nothing else."
              },
              {
                q: "How does the MT5 auto-sync work?",
                a: "You install a free Expert Advisor (EA) on your MetaTrader 5 platform. It runs in the background and automatically sends your trade data to TradifyApp in real time. It takes about 2 minutes to set up."
              },
              {
                q: "Can I track multiple MT5 accounts?",
                a: "Yes! TradifyApp supports multi-account connectivity. You can connect and independently track trades, equity, and analytics for each of your MT5 accounts from one dashboard."
              },
              {
                q: "What is the Prop Firm Challenge Tracker?",
                a: "It's a tool that monitors your prop firm challenge rules in real time — profit targets, drawdown limits, consistency scores, and days remaining. Supports FTMO, MyFundedFX, The Funded Trader, and custom configurations."
              },
              {
                q: "What's the difference between Pro and Elite?",
                a: "Pro includes AI instrument analysis, prop firm tracker, full education hub, and psychology review. Elite adds session analytics, behavioral risk flags, AI challenge risk warnings, strategy deviation analysis, and monthly AI review reports."
              },
              {
                q: "What is the Founding Member program?",
                a: "Founding Members are early adopters who get 1 month of free Pro access, a permanent 30% lifetime discount on all plans, feature voting rights, and an exclusive crown badge. This offer is limited and won't be available once we reach capacity."
              },
              {
                q: "Can I cancel my subscription anytime?",
                a: "Yes, you can cancel your Pro or Elite subscription at any time. You'll continue to have access until the end of your billing period, then you'll be downgraded to the free plan."
              },
              {
                q: "What is a trading journal and why do I need one?",
                a: "A trading journal is a structured record of every trade you take, including entry/exit prices, position sizes, emotions, and rule compliance. It helps you identify patterns in your behavior, track your edge over time, and build the discipline needed for consistent profitability. Without a journal, you're trading blind — repeating mistakes without ever knowing what's actually working."
              },
              {
                q: "How do I track drawdown in prop firm challenges?",
                a: "TradifyApp's Prop Firm Challenge Tracker monitors your drawdown in real time by syncing directly with your MT5 account. It calculates both daily and overall drawdown against your challenge rules, tracks trailing drawdown with high water mark, and shows visual gauges so you always know exactly how much room you have left. You can set up presets for FTMO, MyFundedFX, The Funded Trader, or create custom configurations."
              },
              {
                q: "Can I use TradifyApp with multiple MT5 accounts?",
                a: "Yes, TradifyApp supports unlimited MT5 account connections. You can track personal accounts, prop firm challenge accounts, and funded accounts all from one dashboard. Each account syncs independently with its own analytics, equity curve, and trade history. This is available on all plans including the free tier."
              },
              {
                q: "What makes TradifyApp different from other trading journals?",
                a: "TradifyApp is built specifically for disciplined trading, not just trade logging. Unlike generic journals, it enforces your trading rules before you can enter a trade, auto-syncs from MT5 so you never miss a trade, tracks prop firm challenge rules in real time, and includes a structured education hub with 19 lessons. It's designed to change your trading behavior, not just record it."
              },
              {
                q: "Is my trading data secure with TradifyApp?",
                a: "Absolutely. TradifyApp operates on a zero-trust security model. We never store your broker credentials, never access your funds, and never execute trades on your behalf. Our MT5 Expert Advisor is strictly read-only — it only reads trade data from your terminal. Your account is protected with email verification and encrypted data storage."
              },
              {
                q: "How does TradifyApp help me become a more disciplined trader?",
                a: "TradifyApp enforces discipline through three mechanisms: rule validation that requires you to log your setup and confirm rule compliance before entering trades, psychology tracking that records your emotional state and identifies patterns like revenge trading or overtrading, and a structured education hub that teaches systematic trading from the ground up. The AI-powered analytics then show you exactly where discipline breaks down in your trading."
              },
              {
                q: "Who is TradifyApp best for?",
                a: "TradifyApp is designed for MT5 traders who want to improve their discipline — especially prop firm challenge traders, day traders, and swing traders. Whether you're trying to pass an FTMO challenge, track drawdown on a funded account, or simply stop breaking your own rules, TradifyApp gives you the enforcement tools and analytics to trade consistently."
              },
              {
                q: "Is TradifyApp useful for discretionary traders?",
                a: "Absolutely. TradifyApp doesn't impose a fixed strategy — it enforces YOUR rules, whatever they are. You define your own entry criteria, risk limits, session restrictions, and instrument rules. The platform validates each trade against your personal plan, making it ideal for discretionary traders who have a system but struggle to follow it under pressure."
              },
              {
                q: "Does TradifyApp work with prop firm challenges?",
                a: "Yes — prop firm challenge tracking is one of TradifyApp's core features. It monitors your profit target progress, daily and overall drawdown, trailing drawdown with high water mark, consistency score, and days remaining in real time. It includes presets for FTMO, MyFundedFX, The Funded Trader, and supports fully custom challenge configurations."
              },
              {
                q: "How is TradifyApp different from TraderSync or Edgewonk?",
                a: "TradifyApp is built around discipline enforcement, not just trade logging. Unlike TraderSync or Edgewonk, TradifyApp enforces your rules before trades are logged (pre-trade validation), auto-syncs from MT5 in real time so you never miss a trade, includes dedicated prop firm challenge tracking with live drawdown gauges, and offers AI-powered behavioral analysis that detects revenge trading and overtrading patterns. It also includes a structured 19-lesson education hub and a free forever plan."
              }
            ].map((faq, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl overflow-hidden" data-testid={`faq-item-${i}`}>
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <span className="text-sm font-bold text-foreground pr-4">{faq.q}</span>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-border" data-testid="section-footer">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Product</h4>
              <div className="space-y-3">
                <Link to="/features" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-features">Features</Link>
                <Link to="/pricing" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-pricing">Pricing</Link>
                <Link to="/how-it-works" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-how-it-works">How It Works</Link>
                <Link to="/resources" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-resources">Resources</Link>
                <Link to="/early-access" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-early-access">Early Access</Link>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Solutions</h4>
              <div className="space-y-3">
                <Link to="/trading-journal" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-trading-journal">Trading Journal</Link>
                <Link to="/prop-firm-tracker" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-prop-firm-tracker">Prop Firm Tracker</Link>
                <Link to="/mt5-trading-analytics" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-mt5-analytics">MT5 Analytics</Link>
                <Link to="/blog" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-blog">Blog</Link>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Company</h4>
              <div className="space-y-3">
                <Link to="/about" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-about">About</Link>
                <a href="mailto:support@tradify.app?subject=TradifyApp Support Request" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-contact-us-footer">Contact Us</a>
                <CookieSettingsButton />
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Legal</h4>
              <div className="space-y-3">
                <Link to="/terms" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-terms">Terms of Service</Link>
                <Link to="/privacy" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-privacy">Privacy Policy</Link>
                <Link to="/risk-disclaimer" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-risk">Risk Disclaimer</Link>
                <Link to="/cookie-policy" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-cookie">Cookie Policy</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
              &copy; 2026 TradifyApp Intelligence Systems. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
