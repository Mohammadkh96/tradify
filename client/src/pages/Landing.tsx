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
  BarChart3,
  BookOpen,
  Sparkles,
  Crown,
  Target,
  Calculator,
  LineChart,
  Users,
  Brain,
  Clock,
  Trophy,
  MonitorSmartphone,
  FileText,
  Shield,
  X,
  ChevronRight,
  Flame,
  Star,
  Upload,
  Settings2,
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
        title="Tradify - Rule-Based Trading Journal | MT5 Auto-Sync & Prop Firm Tracker"
        description="Stop losing prop firm challenges to untracked drawdowns. Tradify auto-syncs your MT5 trades, validates every entry against your rules, and tracks prop firm limits in real time. Free plan available."
        canonical="https://tradifyapp.com/"
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
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Built for Disciplined Traders</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]">
            Stop guessing.<br />
            <span className="text-emerald-500">Start tracking.</span><br />
            Win more trades.
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            The trading journal that auto-syncs from MT5, enforces your rules before you trade, 
            and makes sure you never blow a prop firm challenge from an untracked drawdown.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {[
              "MT5 Auto-Sync",
              "Prop Firm Tracker",
              "AI Analysis",
              "Rule Validation",
              "Education Hub",
              "Risk Calculators"
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
          
          <p className="text-xs text-muted-foreground">
            Free forever plan available. No credit card needed. Set up in under 2 minutes.
          </p>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="py-12 border-y border-border bg-muted/20" data-testid="section-social-proof">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 19, suffix: "", label: "Trading Lessons", icon: <BookOpen size={20} className="text-emerald-500" /> },
              { value: 8, suffix: "", label: "Learning Phases", icon: <Target size={20} className="text-blue-500" /> },
              { value: 12, suffix: "+", label: "Rule Types", icon: <ShieldCheck size={20} className="text-purple-500" /> },
              { value: 100, suffix: "%", label: "Free MT5 Sync", icon: <MonitorSmartphone size={20} className="text-amber-500" /> }
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

      {/* Who Is Tradify For? */}
      <section className="py-24 overflow-hidden" data-testid="section-who-is-it-for">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Built for <span className="text-emerald-500">Your Trading Style</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Whether you trade prop firm challenges, personal accounts, or both - Tradify adapts to your workflow.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Prop Firm Traders",
                desc: "Track every challenge rule automatically. Know your drawdown, profit target progress, and consistency score in real time. Never fail a challenge from a preventable mistake.",
                icon: <Trophy className="text-amber-500" size={28} />,
                features: ["Real-time drawdown tracking", "Profit target gauges", "AI risk check before trades", "FTMO, MFF & custom presets"]
              },
              {
                title: "Forex & Gold Traders",
                desc: "Auto-sync every trade from MT5. See your win rate, best sessions, and which pairs actually make you money. Let the data tell the truth.",
                icon: <TrendingUp className="text-emerald-500" size={28} />,
                features: ["MT5 multi-account sync", "Session performance analytics", "Instrument breakdown", "Equity curve tracking"]
              },
              {
                title: "Developing Traders",
                desc: "Learn disciplined trading from scratch with 19 structured lessons. Build strategies based on rules, not guesses. Graduate from gambler to systematic trader.",
                icon: <BookOpen className="text-blue-500" size={28} />,
                features: ["19 progressive lessons", "Quiz-based progression", "Strategy builder with rules", "Risk calculators"]
              }
            ].map((persona, i) => (
              <Card key={i} className="bg-background border-border hover:border-emerald-500/20 transition-all duration-300 overflow-hidden group" data-testid={`card-persona-${i}`}>
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 group-hover:bg-emerald-500/10 transition-colors">
                    {persona.icon}
                  </div>
                  <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-3">{persona.title}</h3>
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

      {/* Tradify vs Spreadsheets Comparison */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-comparison">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Why traders <span className="text-emerald-500">switch</span> to Tradify
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
                <h3 className="font-black uppercase tracking-widest text-sm text-emerald-400">Tradify</h3>
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
              Complete <span className="text-emerald-500">Feature Set</span>
            </h2>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Everything you need to master disciplined trading</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "MT5 Multi-Account Bridge",
                desc: "Connect and sync multiple MT5 accounts in real time. All your trades, one dashboard.",
                icon: <MonitorSmartphone className="text-cyan-500" />,
                tier: null
              },
              {
                title: "Trade Journal",
                desc: "Your complete execution log. Every trade, every account, with full P&L tracking.",
                icon: <FileText className="text-emerald-500" />,
                tier: null
              },
              {
                title: "Strategy Validation",
                desc: "Validate every trade against your own rules. No signals. No opinions. Pure accountability.",
                icon: <ShieldCheck className="text-blue-500" />,
                tier: null
              },
              {
                title: "Risk & Position Calculators",
                desc: "Pre-trade risk calculations aligned with your challenge and strategy rules.",
                icon: <Calculator className="text-amber-500" />,
                tier: null
              },
              {
                title: "Performance Dashboard",
                desc: "One view of equity, risk, compliance, and performance metrics with live updates.",
                icon: <BarChart3 className="text-purple-500" />,
                tier: null
              },
              {
                title: "Education Hub",
                desc: "19 structured lessons across 8 phases. Learn discipline, execution, and risk management.",
                icon: <BookOpen className="text-cyan-500" />,
                tier: "3 free lessons"
              },
              {
                title: "Prop Firm Challenge Tracker",
                desc: "Track any prop firm challenge with real-time gauges, drawdown alerts, and consistency scoring.",
                icon: <Trophy className="text-amber-500" />,
                tier: "Pro"
              },
              {
                title: "AI Instrument Analysis",
                desc: "AI analyzes your performance by instrument. Find your edge and eliminate your weaknesses.",
                icon: <Brain className="text-emerald-500" />,
                tier: "Pro"
              },
              {
                title: "Performance Intelligence",
                desc: "Advanced equity analysis, profit factor tracking, and expectancy calculations.",
                icon: <LineChart className="text-blue-500" />,
                tier: "Pro"
              },
              {
                title: "AI Challenge Risk Warnings",
                desc: "Before you place a trade, check it against your active challenge rules. Get safer SL suggestions.",
                icon: <AlertCircle className="text-rose-500" />,
                tier: "Elite"
              },
              {
                title: "Session & Time Analytics",
                desc: "Discover when you trade best by session, day, and hour. Optimize your trading schedule.",
                icon: <Clock className="text-purple-500" />,
                tier: "Elite"
              },
              {
                title: "Behavioral Risk Flags",
                desc: "AI detects revenge trading, overtrading, and other behavioral patterns before they damage your account.",
                icon: <Activity className="text-rose-500" />,
                tier: "Elite"
              },
              {
                title: "Psychology & Mood Tracking",
                desc: "Tag every trade with your emotional state and mistake category. Discover how your psychology impacts results.",
                icon: <HeartPulse className="text-pink-500" />,
                tier: null
              },
              {
                title: "CSV Trade Import",
                desc: "Import trades from MT4, TradingView, or any platform via CSV. Supports automatic column detection.",
                icon: <Upload className="text-teal-500" />,
                tier: null
              },
              {
                title: "Customizable Dashboard",
                desc: "Toggle widgets on and off. Show only what matters to your trading workflow.",
                icon: <Settings2 className="text-indigo-500" />,
                tier: null
              }
            ].map((feature, i) => (
              <Card key={i} className="bg-background border-border hover:border-emerald-500/20 transition-all duration-300 group" data-testid={`card-feature-${i}`}>
                <CardContent className="p-6 flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border group-hover:bg-emerald-500/10 transition-colors">
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
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
                Tradify monitors every rule in real time so you always know exactly where you stand.
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
            Join the first wave of Tradify traders and lock in benefits that will never be offered again. 
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
            Tradify operates on a zero-trust architecture. We never access your funds, 
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
                  Every winning trader has a process. Tradify is yours. Start free, upgrade when you're ready, 
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
                    <li className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Risk Calculators</li>
                    <li className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> 3 Education Lessons</li>
                  </ul>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
                  <div className="text-2xl sm:text-3xl font-black text-emerald-500 mb-1">PRO</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4">$29/mo</div>
                  <ul className="space-y-2">
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Prop Firm Tracker</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> AI Instrument Analysis</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Full Education Hub</li>
                    <li className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> PDF & CSV Export</li>
                  </ul>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 shadow-2xl shadow-amber-500/10">
                  <div className="text-2xl sm:text-3xl font-black text-amber-500 mb-1">ELITE</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-4">$59/mo</div>
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

      {/* Footer */}
      <footer className="py-12 border-t border-border text-center">
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          <Link to="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-terms">Terms</Link>
          <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-privacy">Privacy</Link>
          <Link to="/risk-disclaimer" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-risk">Risk Disclaimer</Link>
          <Link to="/cookie-policy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-cookie">Cookie Policy</Link>
          <CookieSettingsButton />
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
