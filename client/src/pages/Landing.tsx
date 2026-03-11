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
  HeartPulse
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";

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
              { "@type": "Question", "name": "How does TradifyApp help me become a more disciplined trader?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp enforces discipline through three mechanisms: rule validation that requires you to log your setup and confirm rule compliance before entering trades, psychology tracking that records your emotional state and identifies patterns like revenge trading or overtrading, and a structured education hub that teaches systematic trading from the ground up. The AI-powered analytics then show you exactly where discipline breaks down in your trading." } }
            ]
          }
        ]}
      />
      <PublicNavbar />

      {/* Founding Member Sticky Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500/95 to-amber-600/95 backdrop-blur-sm border-t border-amber-400/30 py-3 px-4 shadow-2xl shadow-amber-500/20" data-testid="banner-founding-member">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-slate-900 shrink-0" />
            <span className="text-slate-900 text-xs sm:text-sm font-bold">
              <span className="hidden sm:inline">Founding Member Program: </span>1 month FREE Pro + 30% off forever
            </span>
            <Badge className="bg-slate-900/20 text-slate-900 border-slate-900/30 text-[9px] uppercase tracking-widest animate-pulse shrink-0">
              Limited Spots
            </Badge>
          </div>
          <Link to="/early-access">
            <Button size="sm" className="bg-slate-900 text-amber-500 hover:bg-slate-800 font-black uppercase tracking-widest text-[10px] rounded-full px-6 whitespace-nowrap" data-testid="button-sticky-founding-cta">
              Claim Your Spot <ArrowRight className="ml-1 h-3 w-3" />
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
              { value: 80, suffix: "%+", label: "Prop Firm Failure Rate", icon: <AlertCircle size={20} className="text-rose-500" /> },
              { value: 92, suffix: "%", label: "Traders Break Their Own Rules", icon: <ShieldCheck size={20} className="text-amber-500" /> },
              { value: 3, suffix: "x", label: "More Likely to Overtrade After a Loss", icon: <Flame size={20} className="text-orange-500" /> },
              { value: 47, suffix: "%", label: "Of Losses Come From Rule Violations", icon: <Target size={20} className="text-red-500" /> }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                {stat.icon}
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</div>
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

      {/* TradifyApp vs Spreadsheets Comparison */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-comparison">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Why traders <span className="text-emerald-500">switch</span> to TradifyApp
            </h2>
            <p className="text-muted-foreground">Stop wasting hours on spreadsheets that don't hold you accountable.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl border border-rose-500/20 bg-rose-500/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <X size={20} className="text-rose-500" />
                </div>
                <h3 className="font-black uppercase tracking-widest text-sm text-rose-400">Manual Journaling</h3>
              </div>
              <div className="space-y-4">
                {[
                  "Manually copy-paste every trade from MT5",
                  "No rule enforcement - easy to skip when losing",
                  "No drawdown tracking for prop firm challenges",
                  "Hours wasted building spreadsheet formulas",
                  "No analytics beyond basic win/loss counting",
                  "No education or structured learning path"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <X size={14} className="text-rose-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 shadow-xl shadow-emerald-500/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                </div>
                <h3 className="font-black uppercase tracking-widest text-sm text-emerald-400">TradifyApp</h3>
              </div>
              <div className="space-y-4">
                {[
                  "MT5 auto-syncs every trade instantly",
                  "Rules enforce discipline - validates every entry",
                  "Real-time prop firm drawdown & profit gauges",
                  "Set up in 2 minutes, works automatically",
                  "AI-powered session, time & behavioral analytics",
                  "19 structured lessons from zero to system builder"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
            Ready in <span className="text-emerald-500">3 Steps</span>
          </h2>
          <p className="text-muted-foreground mb-16 max-w-xl mx-auto">No complex setup. No broker credentials shared. Just connect and start tracking.</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent hidden md:block" />
            
            {[
              { step: "01", title: "Create Account", desc: "Sign up free in 30 seconds. No credit card required. Pick your plan later.", icon: <Users /> },
              { step: "02", title: "Connect MT5", desc: "Install our free Expert Advisor on MT5. It reads your trades automatically - read-only, no broker access needed.", icon: <MonitorSmartphone /> },
              { step: "03", title: "Trade & Track", desc: "Every trade auto-syncs. Set your rules. Track your prop firm. Watch your discipline improve.", icon: <TrendingUp /> }
            ].map((item, i) => (
              <div key={i} className="relative z-10 group">
                <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 mx-auto transition-colors">
                  <div className="text-emerald-500">{item.icon}</div>
                </div>
                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">{item.step}</div>
                <h4 className="font-bold text-foreground uppercase tracking-widest text-sm mb-2">{item.title}</h4>
                <p className="text-xs text-muted-foreground max-w-[250px] mx-auto leading-relaxed">{item.desc}</p>
              </div>
            ))}
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
                icon: <AlertCircle className="text-rose-500" size={24} />
              },
              {
                stat: "92%",
                label: "Break Their Own Rules",
                desc: "Nearly all traders have rules they know work. The problem isn't knowledge — it's enforcement. Without accountability, discipline collapses under pressure.",
                icon: <Shield className="text-amber-500" size={24} />
              },
              {
                stat: "3x",
                label: "More Likely to Overtrade After a Loss",
                desc: "Revenge trading is the most expensive habit in the market. Traders triple their position frequency after losses, compounding damage.",
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
                <div className="space-y-3">
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
              </div>
              <div className="text-center lg:text-left">
                <div className="inline-flex flex-col items-center lg:items-start gap-4 p-8 rounded-2xl bg-background/50 border border-border">
                  <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Target className="text-emerald-500" size={28} />
                  </div>
                  <h4 className="text-lg font-black text-foreground uppercase tracking-widest">Join the First Wave</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                    TradifyApp is in its founding phase. Early adopters get free Pro access, a permanent 30% lifetime discount, 
                    and a direct voice in shaping the platform. No fake reviews. No inflated numbers. Just a product built to 
                    enforce the discipline most traders are missing.
                  </p>
                  <Link to="/early-access">
                    <Button className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-full px-8 hover:bg-emerald-400" data-testid="button-proof-founding-cta">
                      Become a Founding Member <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
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
                <div className="p-4 sm:p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
                  <div className="text-2xl sm:text-3xl font-black text-emerald-500 mb-1">PRO</div>
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
