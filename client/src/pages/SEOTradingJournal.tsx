import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  BookOpen,
  FileText,
  MonitorSmartphone,
  Brain,
  Clock,
  Target,
  Calculator,
  Trophy,
  ChevronRight,
  Zap,
  Activity,
  Upload,
  HeartPulse
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";

export default function SEOTradingJournal() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title="Best MT5 Trading Journal Software - Auto-Sync & Rule Validation | TradifyApp"
        description="The #1 MT5 trading journal that auto-syncs every trade, validates entries against your rules, and tracks performance with AI analytics. Free plan available. No manual logging."
        canonical="https://tradifyapp.com/trading-journal"
        ogImage="https://tradifyapp.com/images/tradify-promo-1.png"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "TradifyApp Trading Journal",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "Automated MT5 trading journal with rule validation, AI analytics, psychology tracking, and performance insights.",
            "url": "https://tradifyapp.com/trading-journal",
            "offers": [
              { "@type": "Offer", "price": "0", "priceCurrency": "USD", "name": "Free Plan" },
              { "@type": "Offer", "price": "29", "priceCurrency": "USD", "name": "Pro Plan" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tradifyapp.com" },
              { "@type": "ListItem", "position": 2, "name": "Trading Journal", "item": "https://tradifyapp.com/trading-journal" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "What is a trading journal?", "acceptedAnswer": { "@type": "Answer", "text": "A trading journal is a systematic record of all your trades, including entry/exit prices, position sizes, strategy used, emotional state, and outcome. It helps traders identify patterns in their behavior and performance to improve decision-making over time." } },
              { "@type": "Question", "name": "Why do I need an automated trading journal?", "acceptedAnswer": { "@type": "Answer", "text": "Manual journaling is time-consuming and prone to errors. An automated trading journal like TradifyApp syncs directly with MT5, capturing every trade instantly with accurate data. This eliminates manual entry errors and ensures you never miss logging a trade." } },
              { "@type": "Question", "name": "How does TradifyApp's MT5 journal sync work?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp uses a free Expert Advisor (EA) installed on your MT5 platform. It runs in the background, reading your trade data in real-time and sending it to your TradifyApp journal automatically. The EA is strictly read-only and never places trades." } },
              { "@type": "Question", "name": "Can I use TradifyApp as a forex trading journal?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. TradifyApp is designed for forex, gold, indices, and any instrument traded on MT5. It tracks all currency pairs, provides instrument-specific analytics, and supports multi-account journaling for traders who trade across multiple brokers." } }
            ]
          }
        ]}
      />
      <PublicNavbar />

      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <FileText size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Trading Journal Software</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]" data-testid="text-seo-journal-heading">
            The Best MT5<br />
            <span className="text-emerald-500">Trading Journal</span><br />
            Software
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Stop manually logging trades in spreadsheets. TradifyApp auto-syncs every trade from MetaTrader 5,
            validates entries against your strategy rules, and delivers AI-powered performance insights —
            so you can focus on becoming a better trader.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/signup" data-testid="link-seo-journal-signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20" data-testid="button-seo-journal-signup">
                Start Your Free Journal <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/features" data-testid="link-seo-journal-features">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted" data-testid="button-seo-journal-features">
                See All Features
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Free forever plan. No credit card required. Set up in under 2 minutes.
          </p>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-journal-why">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Why Traders Choose TradifyApp <span className="text-emerald-500">Over Spreadsheets</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Manual journaling fails because it relies on willpower. TradifyApp automates the hard part so you can
              focus on the insights that actually improve your trading.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Automatic MT5 Trade Sync",
                desc: "Every trade from MetaTrader 5 is captured instantly — entries, exits, lot sizes, and P&L. No copy-paste, no missed trades, no errors. Works with multiple MT5 accounts simultaneously.",
                icon: <MonitorSmartphone className="text-cyan-500" />
              },
              {
                title: "Rule-Based Validation",
                desc: "Define your trading rules once. TradifyApp validates every trade against your strategy — position sizing, risk limits, allowed instruments, and session times. Know instantly when you deviate.",
                icon: <ShieldCheck className="text-blue-500" />
              },
              {
                title: "AI Performance Analytics",
                desc: "Go beyond basic win/loss counting. TradifyApp analyzes your performance by instrument, session, time of day, and risk-to-reward ratio to reveal what actually works in your trading.",
                icon: <Brain className="text-emerald-500" />
              },
              {
                title: "Psychology & Mood Tracking",
                desc: "Tag every trade with your emotional state — confident, anxious, revenge trading, or disciplined. Discover how your psychology impacts your bottom line with hard data.",
                icon: <HeartPulse className="text-pink-500" />
              },
              {
                title: "CSV Import Support",
                desc: "Trading on MT4, TradingView, or another platform? Import your trades via CSV with automatic column detection. Your complete trading history in one place.",
                icon: <Upload className="text-teal-500" />
              },
              {
                title: "Performance Dashboard",
                desc: "Equity curves, drawdown charts, win rate by instrument, and risk metrics — all updating in real time as your trades sync. One view of your complete trading performance.",
                icon: <BarChart3 className="text-purple-500" />
              }
            ].map((feature, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-journal-feature-${i}`}>
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-journal-how-it-works">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              How the <span className="text-emerald-500">Trading Journal</span> Works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From MT5 to actionable insights in three simple steps.
            </p>
          </div>

          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Install the Free MT5 Expert Advisor",
                desc: "Download and install TradifyApp's free Expert Advisor on your MetaTrader 5 platform. It takes less than 2 minutes. The EA is strictly read-only — it never places trades, modifies orders, or accesses your broker credentials."
              },
              {
                step: "02",
                title: "Trades Sync Automatically",
                desc: "Every trade you take on MT5 is automatically captured in your TradifyApp journal. Entry price, exit price, lot size, instrument, profit/loss, and timestamps — all logged instantly without any manual input."
              },
              {
                step: "03",
                title: "Review, Analyze, and Improve",
                desc: "Use the performance dashboard to review your equity curve, analyze your win rate by instrument and session, track your psychology patterns, and validate that you're following your strategy rules. The data tells you exactly where to improve."
              }
            ].map((item, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-black text-sm shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-journal-who">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Built for <span className="text-emerald-500">Every MT5 Trader</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Forex Traders",
                desc: "Track every currency pair trade with session-specific analytics. See which pairs make you money and which sessions deliver your best results.",
                icon: <TrendingUp className="text-emerald-500" size={28} />,
                features: ["Multi-pair tracking", "Session analytics", "Pip-based P&L", "Equity curves"]
              },
              {
                title: "Gold & Commodity Traders",
                desc: "XAUUSD, XAGUSD, oil — track all commodity trades with instrument-specific insights and risk analysis tailored to volatile markets.",
                icon: <Target className="text-amber-500" size={28} />,
                features: ["Instrument breakdown", "Volatility tracking", "Risk-to-reward analysis", "Drawdown monitoring"]
              },
              {
                title: "Prop Firm Traders",
                desc: "Journal every trade while simultaneously tracking your prop firm challenge rules. Never fail a challenge because you lost track of your limits.",
                icon: <Trophy className="text-blue-500" size={28} />,
                features: ["Challenge rule tracking", "Drawdown alerts", "Consistency scoring", "Daily stats logging"]
              }
            ].map((persona, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-journal-persona-${i}`}>
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6">
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

      <section className="py-24" data-testid="section-journal-faq">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Trading Journal <span className="text-emerald-500">FAQ</span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "What is a trading journal?",
                a: "A trading journal is a systematic record of all your trades, including entry/exit prices, position sizes, strategy used, emotional state, and outcome. It helps traders identify patterns in their behavior and performance to improve decision-making over time. Professional traders consider it an essential tool for consistent profitability."
              },
              {
                q: "Why do I need an automated trading journal?",
                a: "Manual journaling is time-consuming and prone to errors. Studies show that traders who journal consistently improve their win rate by 10-20%. An automated trading journal like TradifyApp removes the friction by syncing directly with MT5, capturing every trade instantly with 100% accurate data."
              },
              {
                q: "How does TradifyApp compare to other trading journals?",
                a: "TradifyApp combines automatic MT5 sync, rule-based trade validation, AI analytics, psychology tracking, and prop firm challenge monitoring in one platform. Most competitors offer only basic logging. TradifyApp enforces discipline, not just documentation."
              },
              {
                q: "Can I use TradifyApp as a forex trading journal?",
                a: "Yes. TradifyApp is built for forex, gold, indices, and any instrument traded on MT5. It tracks all currency pairs, provides instrument-specific analytics, session performance breakdowns, and supports multi-account journaling."
              },
              {
                q: "Is there a free trading journal option?",
                a: "Yes. TradifyApp's free plan includes MT5 multi-account sync, 30-day trade journal history, psychology tracking, CSV import, risk calculators, and 3 education lessons. No credit card required to start."
              }
            ].map((faq, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl overflow-hidden" data-testid={`faq-journal-${i}`}>
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

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-journal-cta">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase mb-6">
            Start journaling<br />your trades <span className="text-emerald-500">today</span>.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Every profitable trader keeps a journal. Make yours automatic, intelligent, and
            impossible to skip. Free forever plan available.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup" data-testid="link-journal-cta-signup">
              <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400" data-testid="button-journal-cta-signup">
                Start Free Journal
              </Button>
            </Link>
            <Link to="/pricing" data-testid="link-journal-cta-pricing">
              <Button variant="ghost" className="h-14 px-8 text-foreground font-bold uppercase tracking-widest text-xs group" data-testid="button-journal-cta-pricing">
                Compare Plans <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border" data-testid="section-journal-related">
        <div className="max-w-4xl mx-auto px-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6 text-center">Related Tools</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/prop-firm-tracker" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-prop">
              Prop Firm Challenge Tracker
            </Link>
            <span className="text-border">|</span>
            <Link to="/mt5-trading-analytics" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-analytics">
              MT5 Trading Analytics
            </Link>
            <span className="text-border">|</span>
            <Link to="/features" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-features">
              All Features
            </Link>
            <span className="text-border">|</span>
            <Link to="/pricing" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-pricing">
              Pricing
            </Link>
            <span className="text-border">|</span>
            <Link to="/blog" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-blog">
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
