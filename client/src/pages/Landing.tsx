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
  Shield
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO 
        title="Tradify - Rule-Based Trading Journal | MT5 Auto-Sync & Prop Firm Tracker"
        description="Enforce disciplined trading with Tradify. Auto-sync trades from MT5, validate strategies against rules, track prop firm challenges, and analyze performance with AI-powered insights. Free plan available."
        canonical="https://tradifyapp.com/"
      />
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
          
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]">
            Standardize your<br />
            <span className="text-emerald-500">execution logic</span><br />
            with MT5 sync
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Auto-sync trades from MetaTrader 5, validate strategies against rules, track prop firm challenges, and master your discipline with AI-powered analytics.
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

          <Link to="/early-access" className="inline-block mb-6">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-5 py-2 hover:bg-amber-500/20 transition-colors cursor-pointer group">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-bold uppercase tracking-widest">Founding Member Early Access</span>
              <ArrowRight className="h-4 w-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20" data-testid="button-hero-signup">
                Create Free Account
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted" data-testid="button-hero-pricing">
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-8">
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
                    title: "Strategy Drift",
                    desc: "Track when trades deviate from your documented strategy rules. Measure consistency over time.",
                    icon: <TrendingUp className="text-blue-500" />
                  },
                  {
                    title: "Challenge Rule Violations",
                    desc: "Prop firm traders risk failing challenges from unmonitored drawdowns. Tradify tracks every limit in real time.",
                    icon: <Trophy className="text-purple-500" />
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
                <div className="absolute bottom-8 left-8 right-8 p-6 rounded-2xl bg-background border border-border backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Performance Snapshot</div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-black text-emerald-500">67%</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Win Rate</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-foreground">1:2.4</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">R:R Ratio</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-amber-500">3</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Today</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-16">
            System <span className="text-emerald-500">Architecture</span>
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent hidden md:block" />
            
            {[
              { step: "01", title: "MT5 Integration", desc: "Multi-account terminal connection via secure local bridge.", icon: <MonitorSmartphone /> },
              { step: "02", title: "Data Ingestion", desc: "Automated read-only trade log retrieval and equity snapshots.", icon: <Lock /> },
              { step: "03", title: "Rule Validation", desc: "Objective grading against strategy parameters and prop firm rules.", icon: <ShieldCheck /> },
              { step: "04", title: "AI Analytics", desc: "Session efficiency, expectancy calculation, and AI performance review.", icon: <Brain /> }
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

      {/* Core Features - Expanded */}
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
                desc: "Connect multiple MetaTrader 5 accounts simultaneously. Auto-sync trades, equity curves, and open positions across all your trading accounts.",
                icon: <MonitorSmartphone className="text-cyan-500" />,
                tier: null
              },
              {
                title: "Trade Journal",
                desc: "Chronological trade tracking with filtering by account, date range, and instrument. Log manual trades or auto-import from MT5.",
                icon: <FileText className="text-emerald-500" />,
                tier: null
              },
              {
                title: "Strategy Validation",
                desc: "Build custom trading frameworks with rule-based entry and exit criteria. Validate every trade against your strategy rules automatically.",
                icon: <ShieldCheck className="text-blue-500" />,
                tier: null
              },
              {
                title: "Risk & Position Calculators",
                desc: "Built-in risk calculators for position sizing, stop loss placement, and risk-reward analysis before entering any trade.",
                icon: <Calculator className="text-amber-500" />,
                tier: null
              },
              {
                title: "Interactive Dashboard",
                desc: "Customizable performance metrics, equity curves, win rate analysis, profit factor, and expectancy all in one command center.",
                icon: <BarChart3 className="text-purple-500" />,
                tier: null
              },
              {
                title: "Education Hub",
                desc: "20 comprehensive lessons covering trading psychology, price action, smart money concepts, order blocks, FVGs, and advanced strategies.",
                icon: <BookOpen className="text-cyan-500" />,
                tier: "3 free lessons"
              },
              {
                title: "Prop Firm Challenge Tracker",
                desc: "Track FTMO, MyFundedFX, The Funded Trader, and custom challenges. Monitor profit targets, drawdown limits, consistency scores, and days remaining.",
                icon: <Trophy className="text-amber-500" />,
                tier: "Pro"
              },
              {
                title: "AI Instrument Analysis",
                desc: "Get AI-powered analysis of your trading performance on specific instruments. Understand what you trade best and where to improve.",
                icon: <Brain className="text-emerald-500" />,
                tier: "Pro"
              },
              {
                title: "Performance Intelligence",
                desc: "Advanced metrics including profit factor, expectancy, recovery factor, max drawdown analysis, and full historical equity curves.",
                icon: <LineChart className="text-blue-500" />,
                tier: "Pro"
              },
              {
                title: "AI Challenge Risk Warnings",
                desc: "Before you place a trade, check it against your active prop firm challenge rules. See potential drawdown impact and get safer stop loss suggestions.",
                icon: <AlertCircle className="text-rose-500" />,
                tier: "Elite"
              },
              {
                title: "Session & Time Analytics",
                desc: "Performance breakdown by trading session (Asian, London, New York), day of week, and hour. Discover your optimal trading windows.",
                icon: <Clock className="text-purple-500" />,
                tier: "Elite"
              },
              {
                title: "Behavioral Risk Flags",
                desc: "Automated detection of revenge trading, overtrading, risk creep, and strategy deviation patterns with monthly AI performance reviews.",
                icon: <Activity className="text-rose-500" />,
                tier: "Elite"
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
                Prop Firm <span className="text-amber-500">Challenge Tracker</span>
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Never lose a prop firm challenge due to unmonitored drawdowns again. Tradify tracks every rule, every limit, and every metric in real time.
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
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">FTMO Challenge</div>
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

      {/* Founding Member Section */}
      <section className="py-24 bg-gradient-to-b from-background to-amber-500/5 border-y border-border" data-testid="section-founding-member">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-8">
            <Crown className="text-amber-500" size={32} />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
            Founding <span className="text-amber-500">Member Program</span>
          </h2>
          <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join the founding members and shape the future of Tradify. Get exclusive benefits that last forever.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { title: "3 Months Free", desc: "Pro access at no cost", icon: <Sparkles className="text-amber-400" size={20} /> },
              { title: "30% Off Forever", desc: "Lifetime discount on all plans", icon: <Target className="text-amber-400" size={20} /> },
              { title: "Feature Influence", desc: "Vote on upcoming features", icon: <Users className="text-amber-400" size={20} /> },
              { title: "Exclusive Badge", desc: "Founding member crown badge", icon: <Crown className="text-amber-400" size={20} /> }
            ].map((benefit, i) => (
              <div key={i} className="p-5 rounded-2xl bg-background/50 border border-amber-500/20">
                <div className="mb-3">{benefit.icon}</div>
                <h4 className="font-bold text-foreground text-sm uppercase tracking-widest mb-1">{benefit.title}</h4>
                <p className="text-xs text-muted-foreground">{benefit.desc}</p>
              </div>
            ))}
          </div>
          <Link to="/early-access">
            <Button className="h-14 px-10 bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-amber-400 shadow-xl shadow-amber-500/20" data-testid="button-founding-member-cta">
              Claim Founding Member Spot
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8">
            <Shield className="text-emerald-500" size={32} />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase italic mb-8">
            Trust & <span className="text-emerald-500">Reliability</span>
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
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase mb-6">
                  Standardize your<br />execution.
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  Deploy Tradify to enforce systematic discipline and utilize institutional-grade analytics. Start free, upgrade when ready.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link to="/signup">
                    <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400" data-testid="button-cta-signup">
                      Access Terminal
                    </Button>
                  </Link>
                  <Link to="/pricing">
                    <Button variant="ghost" className="h-14 px-8 text-foreground font-bold uppercase tracking-widest text-xs group" data-testid="button-cta-pricing">
                      Subscription Tiers <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
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
          <Link to="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Terms</Link>
          <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Privacy</Link>
          <Link to="/risk-disclaimer" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Risk Disclaimer</Link>
          <Link to="/cookie-policy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Cookie Policy</Link>
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
