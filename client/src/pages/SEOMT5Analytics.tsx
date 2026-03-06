import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Brain,
  Clock,
  Target,
  ChevronRight,
  Activity,
  LineChart,
  MonitorSmartphone,
  Gauge,
  PieChart
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";

export default function SEOMT5Analytics() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title="MT5 Trading Analytics & Performance Tracker - AI-Powered Insights | TradifyApp"
        description="Track your MT5 trading performance with AI-powered analytics. Equity curves, win rate by instrument, session analysis, drawdown tracking, and behavioral insights. Auto-syncs from MetaTrader 5."
        canonical="https://tradifyapp.com/mt5-trading-analytics"
        ogImage="https://tradifyapp.com/images/tradify-promo-1.png"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "TradifyApp MT5 Trading Analytics",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "AI-powered MT5 trading analytics with equity curves, session analysis, behavioral insights, and performance tracking.",
            "url": "https://tradifyapp.com/mt5-trading-analytics",
            "offers": [
              { "@type": "Offer", "price": "0", "priceCurrency": "USD", "name": "Free Plan" },
              { "@type": "Offer", "price": "29", "priceCurrency": "USD", "name": "Pro Plan" },
              { "@type": "Offer", "price": "59", "priceCurrency": "USD", "name": "Elite Plan" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tradifyapp.com" },
              { "@type": "ListItem", "position": 2, "name": "MT5 Trading Analytics", "item": "https://tradifyapp.com/mt5-trading-analytics" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "What trading analytics does TradifyApp provide?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp provides comprehensive trading analytics including equity curves, win rate by instrument and session, risk-to-reward analysis, drawdown tracking, profit factor calculation, expectancy metrics, behavioral pattern detection, and AI-powered performance insights — all auto-synced from MT5." } },
              { "@type": "Question", "name": "How does MT5 performance tracking work?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp installs a free Expert Advisor on your MT5 platform that reads your trade data in real time. Every trade is automatically captured and analyzed — entries, exits, lot sizes, instruments, and P&L. The analytics dashboard updates continuously as new trades come in." } },
              { "@type": "Question", "name": "Can I track multiple MT5 accounts?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. TradifyApp supports multi-account connectivity. You can connect and independently track trades, equity curves, and analytics for each of your MT5 accounts from one unified dashboard." } },
              { "@type": "Question", "name": "What is session analytics in trading?", "acceptedAnswer": { "@type": "Answer", "text": "Session analytics breaks down your trading performance by market session (London, New York, Tokyo, Sydney), day of week, and hour of day. This helps you identify when you trade best and when you should avoid trading, based on your actual historical data." } }
            ]
          }
        ]}
      />
      <PublicNavbar />

      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
            <BarChart3 size={14} className="text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Trading Analytics</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]" data-testid="text-seo-analytics-heading">
            MT5 Trading<br />
            <span className="text-blue-500">Analytics &</span><br />
            Performance Tracker
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Transform raw MT5 trade data into actionable insights. TradifyApp's AI-powered analytics
            reveal your true edge — which instruments make you money, when you trade best,
            and where your discipline breaks down.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {[
              "Equity Curves",
              "Win Rate Analysis",
              "Session Breakdown",
              "AI Insights",
              "Drawdown Tracking",
              "Multi-Account"
            ].map((tag) => (
              <Badge key={tag} variant="outline" className="bg-muted/50 border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest py-1 px-3">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/signup" data-testid="link-seo-analytics-signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20" data-testid="button-seo-analytics-signup">
                Start Free Analytics <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/features" data-testid="link-seo-analytics-features">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted" data-testid="button-seo-analytics-features">
                See All Features
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Free plan includes performance dashboard and equity tracking. Pro and Elite unlock advanced analytics.
          </p>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-analytics-features">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Complete <span className="text-blue-500">Analytics Suite</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From basic win/loss tracking to AI-powered behavioral analysis — TradifyApp gives you
              the complete picture of your trading performance at every tier.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Equity Curve Tracking",
                desc: "Visualize your account growth over time with interactive equity curves. Track cumulative P&L, identify growth phases, and spot drawdown periods at a glance. Available for each MT5 account independently.",
                icon: <LineChart className="text-emerald-500" />,
                tier: "Free"
              },
              {
                title: "Win Rate by Instrument",
                desc: "See exactly which currency pairs, commodities, or indices make you money and which ones cost you. Break down performance by instrument to focus on your strongest markets.",
                icon: <PieChart className="text-blue-500" />,
                tier: "Free"
              },
              {
                title: "Risk-to-Reward Analysis",
                desc: "Track your average risk-to-reward ratio across all trades. Identify whether your winners are large enough relative to your losers and whether your expectancy is positive.",
                icon: <Target className="text-amber-500" />,
                tier: "Free"
              },
              {
                title: "AI Instrument Analysis",
                desc: "AI analyzes your performance patterns across instruments. Discover which pairs have positive expectancy, which to avoid, and how your performance changes across different market conditions.",
                icon: <Brain className="text-emerald-500" />,
                tier: "Pro"
              },
              {
                title: "Session & Time Analytics",
                desc: "Break down your performance by London, New York, Tokyo, and Sydney sessions. Discover which day of the week and hour of the day you trade best — based on your actual data, not general advice.",
                icon: <Clock className="text-purple-500" />,
                tier: "Elite"
              },
              {
                title: "Behavioral Risk Detection",
                desc: "AI monitors your trading patterns for revenge trading, overtrading, inconsistent sizing, and other behavioral risks. Get flagged before destructive patterns damage your account.",
                icon: <Activity className="text-rose-500" />,
                tier: "Elite"
              }
            ].map((feature, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-analytics-feature-${i}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
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
                        {feature.tier === "Free" && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[9px] py-0 uppercase tracking-widest shrink-0">Free</Badge>
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

      <section className="py-24" data-testid="section-analytics-how-data-works">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              From <span className="text-blue-500">Raw Data</span> to Actionable Insights
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              TradifyApp transforms every MT5 trade into meaningful analytics that help you improve.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-lg font-bold text-foreground uppercase tracking-widest mb-6">What Gets Tracked</h3>
              <div className="space-y-4">
                {[
                  "Every entry and exit price across all instruments",
                  "Lot sizes and position values for risk analysis",
                  "Trade duration and holding periods",
                  "Profit and loss in both pips and currency",
                  "Trading session and time-of-day data",
                  "Sequential trade patterns and streaks",
                  "Account equity at every trade checkpoint",
                  "Strategy and rule compliance per trade"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground uppercase tracking-widest mb-6">Insights You Get</h3>
              <div className="space-y-4">
                {[
                  "Your most profitable instruments ranked by expectancy",
                  "Best and worst trading sessions for your style",
                  "Optimal day-of-week and time-of-day patterns",
                  "Risk-to-reward consistency across trade types",
                  "Drawdown depth and recovery time analysis",
                  "Behavioral patterns that hurt your performance",
                  "Profit factor and Sharpe ratio calculations",
                  "Monthly and weekly performance trends"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <BarChart3 size={14} className="text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-analytics-multi-account">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-8">
            <MonitorSmartphone className="text-cyan-500" size={32} />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
            Multi-Account <span className="text-cyan-500">Analytics</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Trading across multiple brokers or accounts? TradifyApp connects to all your MT5 accounts simultaneously.
            Each account gets independent analytics, or view your consolidated performance across all accounts.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { title: "Independent Tracking", desc: "Separate equity curves, drawdowns, and analytics for each account" },
              { title: "Simultaneous Sync", desc: "All accounts sync in real time through individual MT5 Expert Advisors" },
              { title: "Unified Dashboard", desc: "Switch between accounts or view aggregate performance metrics" }
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-background border border-border">
                <h4 className="text-sm font-bold text-foreground uppercase tracking-widest mb-2">{item.title}</h4>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-analytics-faq">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Analytics <span className="text-blue-500">FAQ</span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "What trading analytics does TradifyApp provide?",
                a: "TradifyApp provides comprehensive trading analytics including equity curves, win rate by instrument and session, risk-to-reward analysis, drawdown tracking, profit factor calculation, expectancy metrics, behavioral pattern detection, and AI-powered performance insights. Free users get core metrics; Pro and Elite unlock advanced analytics."
              },
              {
                q: "How does MT5 performance tracking work?",
                a: "TradifyApp uses a free Expert Advisor (EA) installed on your MT5 platform that reads your trade data in real time. Every trade is automatically captured — entries, exits, lot sizes, instruments, and P&L. The analytics dashboard updates continuously as new trades come in. The EA is strictly read-only."
              },
              {
                q: "What is session analytics in trading?",
                a: "Session analytics breaks down your performance by market session (London, New York, Tokyo, Sydney), day of week, and hour of day. Instead of following general advice about when to trade, you can see exactly when YOU trade best based on your actual historical data. This is an Elite feature in TradifyApp."
              },
              {
                q: "Can I track my trading performance for free?",
                a: "Yes. TradifyApp's free plan includes the performance dashboard with equity tracking, basic win/loss analytics, P&L calendar, and risk metrics. The free plan covers core analytics for up to 30 days of trade history. Pro and Elite plans unlock AI analysis, session analytics, and behavioral insights."
              },
              {
                q: "How is TradifyApp different from MT5's built-in reports?",
                a: "MT5's built-in reports are basic and static. TradifyApp provides dynamic, interactive analytics with AI-powered insights, session breakdowns, behavioral pattern detection, psychology tracking, and rule validation — all in a modern dashboard. Plus, TradifyApp works across multiple MT5 accounts in one place."
              }
            ].map((faq, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl overflow-hidden" data-testid={`faq-analytics-${i}`}>
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

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-analytics-cta">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase mb-6">
            Stop guessing.<br /><span className="text-blue-500">Start measuring.</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            The difference between guessing and knowing is data. Connect your MT5 and let TradifyApp
            show you exactly what's working and what isn't.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup" data-testid="link-analytics-cta-signup">
              <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400" data-testid="button-analytics-cta-signup">
                Start Free Analytics
              </Button>
            </Link>
            <Link to="/pricing" data-testid="link-analytics-cta-pricing">
              <Button variant="ghost" className="h-14 px-8 text-foreground font-bold uppercase tracking-widest text-xs group" data-testid="button-analytics-cta-pricing">
                Compare Plans <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border" data-testid="section-analytics-related">
        <div className="max-w-4xl mx-auto px-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6 text-center">Related Tools</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/trading-journal" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-journal">
              MT5 Trading Journal
            </Link>
            <span className="text-border">|</span>
            <Link to="/prop-firm-tracker" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-prop">
              Prop Firm Challenge Tracker
            </Link>
            <span className="text-border">|</span>
            <Link to="/features" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-features">
              All Features
            </Link>
            <span className="text-border">|</span>
            <Link to="/pricing" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-pricing">
              Pricing
            </Link>
            <span className="text-border">|</span>
            <Link to="/blog" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-blog">
              Blog
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-border text-center">
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          <Link to="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Terms</Link>
          <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Privacy</Link>
          <Link to="/risk-disclaimer" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Risk Disclaimer</Link>
          <Link to="/cookie-policy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Cookie Policy</Link>
          <Link to="/blog" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Blog</Link>
          <CookieSettingsButton />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
          &copy; 2026 TradifyApp Intelligence Systems. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
