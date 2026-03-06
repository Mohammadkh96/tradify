import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  AlertCircle,
  MonitorSmartphone,
  Brain,
  Clock,
  Target,
  Trophy,
  ChevronRight,
  Activity,
  Gauge,
  Shield
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";

export default function SEOPropFirmTracker() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title="Prop Firm Challenge Tracker - Track Drawdowns & Profit Targets in Real Time | TradifyApp"
        description="Never fail a prop firm challenge again. TradifyApp tracks your drawdown limits, profit targets, consistency scores, and days remaining in real time. Supports FTMO, MFF, TFT & custom configs."
        canonical="https://tradifyapp.com/prop-firm-tracker"
        ogImage="https://tradifyapp.com/images/tradify-promo-1.png"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "TradifyApp Prop Firm Challenge Tracker",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "Real-time prop firm challenge tracking with drawdown monitoring, profit target gauges, consistency scoring, and AI risk warnings.",
            "url": "https://tradifyapp.com/prop-firm-tracker",
            "offers": [
              { "@type": "Offer", "price": "29", "priceCurrency": "USD", "name": "Pro Plan" },
              { "@type": "Offer", "price": "59", "priceCurrency": "USD", "name": "Elite Plan" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tradifyapp.com" },
              { "@type": "ListItem", "position": 2, "name": "Prop Firm Challenge Tracker", "item": "https://tradifyapp.com/prop-firm-tracker" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "How to pass a prop firm challenge?", "acceptedAnswer": { "@type": "Answer", "text": "Passing a prop firm challenge requires strict risk management, consistent position sizing, and tracking your drawdown limits in real time. Most traders fail because they lose track of their daily or trailing drawdown. TradifyApp monitors all challenge rules automatically so you always know exactly where you stand." } },
              { "@type": "Question", "name": "What is a prop firm challenge tracker?", "acceptedAnswer": { "@type": "Answer", "text": "A prop firm challenge tracker monitors your progress against the rules set by proprietary trading firms — profit targets, maximum drawdown limits, daily loss limits, consistency requirements, and time limits. TradifyApp tracks all these metrics in real time with visual gauges and alerts." } },
              { "@type": "Question", "name": "Which prop firms does TradifyApp support?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp includes presets for FTMO, MyFundedFX, The Funded Trader, and other popular prop firms. You can also create fully custom configurations with your own rules for any proprietary trading firm." } },
              { "@type": "Question", "name": "How does trailing drawdown tracking work?", "acceptedAnswer": { "@type": "Answer", "text": "Trailing drawdown tracks your maximum allowed loss from your highest account balance (high water mark). TradifyApp automatically calculates your trailing drawdown in real time, showing you exactly how much room you have before breaching the limit. This is critical for challenges with trailing drawdown rules." } }
            ]
          }
        ]}
      />
      <PublicNavbar />

      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8">
            <Trophy size={14} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Prop Firm Challenge Tracker</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]" data-testid="text-seo-prop-heading">
            Never Fail a<br />
            <span className="text-amber-500">Prop Firm Challenge</span><br />
            Again
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Most traders fail prop firm challenges because they lose track of their drawdown limits.
            TradifyApp monitors every rule in real time — profit targets, daily loss limits, trailing drawdown,
            consistency scores, and days remaining — so you always know exactly where you stand.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {[
              "FTMO Compatible",
              "MFF Presets",
              "Custom Rules",
              "Real-Time Gauges",
              "AI Risk Warnings",
              "MT5 Auto-Sync"
            ].map((tag) => (
              <Badge key={tag} variant="outline" className="bg-muted/50 border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest py-1 px-3">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/signup" data-testid="link-seo-prop-signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-amber-400 shadow-xl shadow-amber-500/20" data-testid="button-seo-prop-signup">
                Start Tracking Your Challenge <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing" data-testid="link-seo-prop-pricing">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted" data-testid="button-seo-prop-pricing">
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-prop-demo">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-6">
                Real-Time <span className="text-amber-500">Challenge Dashboard</span>
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Every metric that matters for your prop firm challenge, updated in real time as your trades sync from MT5.
                Visual progress bars, countdown timers, and color-coded alerts tell you exactly where you stand at a glance.
              </p>
              <div className="space-y-4">
                {[
                  "Profit target progress with percentage and dollar amount",
                  "Maximum drawdown gauge with color-coded risk zones",
                  "Daily loss limit tracking with real-time updates",
                  "Trailing drawdown with high water mark calculation",
                  "Consistency scoring based on daily performance variance",
                  "Days remaining countdown with trading day tracking",
                  "AI pre-trade risk check — analyze impact before entry (Elite)"
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
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">FTMO Challenge</div>
                      <div className="text-xl font-black text-foreground">$100,000 Account</div>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] uppercase tracking-widest">Phase 1</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-background/50 border border-border">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Profit Target</div>
                      <div className="text-2xl font-black text-emerald-500">$7,200</div>
                      <div className="text-[9px] text-muted-foreground mt-1">72% of $10,000 target</div>
                      <div className="w-full h-1.5 bg-muted rounded-full mt-2">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: "72%" }} />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-background/50 border border-border">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Max Drawdown</div>
                      <div className="text-2xl font-black text-amber-500">$3,400</div>
                      <div className="text-[9px] text-muted-foreground mt-1">34% of $10,000 limit used</div>
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
                      <div className="text-lg font-black text-foreground">$1,850</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Daily Limit</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-prop-why-fail">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Why Most Traders <span className="text-rose-500">Fail</span> Prop Firm Challenges
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Research shows that 80-90% of traders fail prop firm challenges. The most common reasons are preventable
              with proper tracking and discipline tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="p-8 rounded-3xl border border-rose-500/20 bg-rose-500/5">
              <h3 className="font-black uppercase tracking-widest text-sm text-rose-400 mb-6">Common Failure Reasons</h3>
              <div className="space-y-4">
                {[
                  "Exceeding daily or overall drawdown limits unknowingly",
                  "Inconsistent position sizing across trades",
                  "Trading too aggressively near the profit target",
                  "Losing track of trailing drawdown calculations",
                  "Not tracking consistency requirements",
                  "Revenge trading after a losing day"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 shadow-xl shadow-emerald-500/5">
              <h3 className="font-black uppercase tracking-widest text-sm text-emerald-400 mb-6">How TradifyApp Prevents This</h3>
              <div className="space-y-4">
                {[
                  "Real-time drawdown tracking with visual alerts",
                  "Position sizing validation against your rules",
                  "Profit target progress gauge with remaining amount",
                  "Automatic trailing drawdown calculation from high water mark",
                  "Daily consistency scoring and variance tracking",
                  "Behavioral risk flags detect revenge trading patterns (Elite)"
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-6">
              TradifyApp doesn't guarantee you'll pass — but it ensures you'll never fail from a preventable tracking mistake.
            </p>
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-prop-firms">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Supported <span className="text-amber-500">Prop Firms</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Pre-built configurations for the most popular prop firms, plus fully customizable rules for any firm.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: "FTMO", rules: "10% profit target, 5% daily loss, 10% max drawdown" },
              { name: "MyFundedFX", rules: "8% profit target, 5% daily loss, 12% max drawdown" },
              { name: "The Funded Trader", rules: "10% profit target, 5% daily loss, 10% trailing drawdown" },
              { name: "Custom Config", rules: "Define your own profit targets, drawdown limits, and rules" }
            ].map((firm, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-prop-firm-${i}`}>
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <Trophy size={20} className="text-amber-500" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-2">{firm.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{firm.rules}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-prop-faq">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Prop Firm <span className="text-amber-500">FAQ</span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "How to pass a prop firm challenge?",
                a: "Passing a prop firm challenge requires strict risk management, consistent position sizing, and tracking your drawdown limits in real time. Key strategies include: trading only high-probability setups, never risking more than 1-2% per trade, tracking your daily and overall drawdown continuously, and maintaining consistency in your lot sizing. TradifyApp automates the tracking so you can focus on execution."
              },
              {
                q: "What is a prop firm challenge tracker?",
                a: "A prop firm challenge tracker monitors your progress against the specific rules set by your proprietary trading firm — profit targets, maximum drawdown limits, daily loss limits, consistency requirements, minimum trading days, and time limits. TradifyApp tracks all these metrics in real time with visual gauges, alerts, and AI-powered risk warnings."
              },
              {
                q: "How does trailing drawdown tracking work?",
                a: "Trailing drawdown tracks your maximum allowed loss from your highest account balance (the high water mark). As your account grows, the trailing drawdown level moves up with it. TradifyApp automatically calculates this in real time, showing you exactly how much room you have before breaching the limit."
              },
              {
                q: "Which prop firms does TradifyApp support?",
                a: "TradifyApp includes presets for FTMO, MyFundedFX, The Funded Trader, and other popular prop firms. You can also create fully custom configurations with your own rules, targets, and limits for any proprietary trading firm."
              },
              {
                q: "Can I track multiple prop firm challenges at once?",
                a: "Yes. TradifyApp supports multi-account connectivity, so you can track multiple prop firm challenges simultaneously. Each account has its own challenge dashboard with independent tracking of drawdown, profit targets, and consistency."
              }
            ].map((faq, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl overflow-hidden" data-testid={`faq-prop-${i}`}>
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

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-prop-cta">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase mb-6">
            Track your challenge.<br /><span className="text-amber-500">Pass with confidence.</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Don't let preventable mistakes cost you another prop firm challenge.
            Start tracking your drawdowns, targets, and consistency today.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup" data-testid="link-prop-cta-signup">
              <Button className="h-14 px-10 bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-amber-400" data-testid="button-prop-cta-signup">
                Start Tracking Now
              </Button>
            </Link>
            <Link to="/pricing" data-testid="link-prop-cta-pricing">
              <Button variant="ghost" className="h-14 px-8 text-foreground font-bold uppercase tracking-widest text-xs group" data-testid="button-prop-cta-pricing">
                Compare Plans <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border" data-testid="section-prop-related">
        <div className="max-w-4xl mx-auto px-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6 text-center">Related Tools</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/trading-journal" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-prop-related-journal">
              MT5 Trading Journal
            </Link>
            <span className="text-border">|</span>
            <Link to="/mt5-trading-analytics" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-prop-related-analytics">
              MT5 Trading Analytics
            </Link>
            <span className="text-border">|</span>
            <Link to="/features" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-prop-related-features">
              All Features
            </Link>
            <span className="text-border">|</span>
            <Link to="/pricing" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-prop-related-pricing">
              Pricing
            </Link>
            <span className="text-border">|</span>
            <Link to="/blog" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-prop-related-blog">
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
