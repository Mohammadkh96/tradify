import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  ShieldCheck,
  Lock,
  Eye,
  Target,
  Users,
  ArrowRight,
  CheckCircle2,
  Brain,
  BarChart3,
  Code2,
  Globe,
  Lightbulb,
  Heart,
  Layers,
  Server,
} from "lucide-react";
import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";

export default function About() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title="About TradifyApp - Our Mission, Story & Team"
        description="Learn about TradifyApp's mission to help traders build discipline through data. Founded by traders, for traders. Read-only MT5 integration, no signals, no predictions — just clarity."
        canonical="https://tradifyapp.com/about"
        breadcrumbs={[
          { name: "Home", url: "https://tradifyapp.com" },
          { name: "About", url: "https://tradifyapp.com/about" }
        ]}
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": "TradifyApp Founder",
            "jobTitle": "Founder & CEO",
            "worksFor": {
              "@type": "Organization",
              "name": "TradifyApp"
            },
            "description": "Trader and technologist focused on building discipline-first tools for the trading community."
          }
        ]}
      />
      <PublicNavbar />

      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <Lightbulb size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500" data-testid="text-about-badge">Why We Exist</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]" data-testid="text-about-heading">
            Discipline is the<br />
            <span className="text-emerald-500">edge.</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8" data-testid="text-about-subheading">
            Most traders don't fail because of bad strategies — they fail because they can't stick to them.
            TradifyApp was built to solve that problem with data, rules, and accountability.
          </p>
        </div>
      </section>

      <section className="py-24 border-y border-border bg-muted/20" data-testid="section-mission">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Our <span className="text-emerald-500">Mission</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed" data-testid="text-mission-statement">
              To give every trader — from beginner to professional — the tools to understand their
              own performance, enforce their own rules, and improve through data instead of guesswork.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Target className="text-emerald-500" size={24} />,
                title: "Discipline First",
                desc: "We don't sell signals, predictions, or shortcuts. TradifyApp is built around one principle: consistent execution of your own strategy leads to long-term results."
              },
              {
                icon: <BarChart3 className="text-blue-500" size={24} />,
                title: "Data Over Opinion",
                desc: "Every insight on TradifyApp comes from your own trading data. We show you what happened, why it matters, and what patterns emerge — never what to do next."
              },
              {
                icon: <Users className="text-purple-500" size={24} />,
                title: "Trader Empowerment",
                desc: "Our goal is to make you a better, more self-aware trader. We provide the mirror — you decide what to change. No dependency, no lock-in, no manipulation."
              }
            ].map((item, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-mission-${i}`}>
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6">
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-why-tradify">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Why <span className="text-emerald-500">TradifyApp</span> Was Built
            </h2>
          </div>

          <div className="space-y-8">
            <div className="p-8 rounded-3xl bg-muted/30 border border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Lightbulb className="text-emerald-500" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground uppercase tracking-tight mb-2">The Problem We Saw</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-problem-statement">
                    Most traders fail not because they lack strategy knowledge, but because they lack discipline.
                    They overtrade, ignore their own rules, lose track of drawdowns, and make emotional decisions
                    after losses. The tools available were either too complex, too expensive, or focused on the wrong
                    things — like signals and predictions instead of self-improvement.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Brain className="text-blue-500" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground uppercase tracking-tight mb-2">The Solution We Built</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-solution-statement">
                    TradifyApp was created to be the discipline partner every trader needs. Instead of telling you what
                    to trade, we help you understand how you trade. Instead of promising profits, we help you identify
                    patterns in your own behavior. Instead of complex setups, we auto-sync your trades from MT5 and
                    do the analysis for you.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20">
                <h4 className="text-xs font-black uppercase tracking-widest text-rose-400 mb-4">What TradifyApp Is NOT</h4>
                <div className="space-y-3">
                  {[
                    "Not a signal service or copy trading platform",
                    "Not an automated trading bot",
                    "Not a 'get rich quick' scheme",
                    "Not investment advice or financial guidance"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheck size={14} className="text-rose-400 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-4">What TradifyApp IS</h4>
                <div className="space-y-3">
                  {[
                    "A rule-based trading journal with auto-sync",
                    "A discipline and accountability platform",
                    "A data-driven performance analytics tool",
                    "A prop firm challenge management system"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 border-y border-border bg-muted/20" data-testid="section-philosophy">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Product <span className="text-emerald-500">Philosophy</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Every design decision at TradifyApp is guided by these core principles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: <Eye className="text-cyan-500" size={20} />,
                title: "Read-Only by Design",
                desc: "TradifyApp never accesses your broker credentials, never places trades, and never modifies orders. Our MT5 Expert Advisor is strictly read-only — it reads your trade data and nothing else. Your funds are never at risk from our platform."
              },
              {
                icon: <Lock className="text-amber-500" size={20} />,
                title: "Security First",
                desc: "We operate on a zero-trust architecture. User data is isolated, encrypted, and never shared with third parties. We don't store broker passwords. We don't have access to your trading capital. Period."
              },
              {
                icon: <Brain className="text-emerald-500" size={20} />,
                title: "Responsible AI",
                desc: "Our AI features analyze your historical performance data to surface patterns and insights. They never predict market direction, never recommend specific trades, and never make promises about future results. AI is explanatory, never directive."
              },
              {
                icon: <Layers className="text-purple-500" size={20} />,
                title: "Transparency Over Hype",
                desc: "We don't use fake testimonials, inflated statistics, or misleading marketing. Our pricing is clear, our features are honest, and our limitations are stated upfront. We believe trust is earned through transparency."
              }
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-background border border-border" data-testid={`card-philosophy-${i}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-widest">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-technology">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Technology & <span className="text-emerald-500">Trust</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built with modern, reliable technology to ensure your data is always safe and your experience is always fast.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Server size={20} />, label: "Cloud Infrastructure" },
              { icon: <Lock size={20} />, label: "Encrypted Data" },
              { icon: <Globe size={20} />, label: "Global Access" },
              { icon: <Code2 size={20} />, label: "Modern Stack" }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-muted/30 border border-border text-center" data-testid={`card-tech-${i}`}>
                <div className="text-emerald-500">{item.icon}</div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 text-center">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight mb-4">Our Commitment</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto" data-testid="text-commitment">
              TradifyApp is committed to providing accurate, unbiased, and reliable trading analytics.
              We will never compromise user data for profit, never sell trading signals disguised as
              analytics, and never make promises about trading outcomes. Our success is measured by
              how much more disciplined and self-aware our users become — not by how much they trade.
            </p>
          </div>
        </div>
      </section>

      <section className="py-24 border-y border-border bg-muted/20" data-testid="section-founder">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              Meet the <span className="text-emerald-500">Founder</span>
            </h2>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="bg-background border-border">
              <CardContent className="p-8 text-center">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                  <TrendingUp size={40} className="text-slate-950" />
                </div>

                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase tracking-widest mb-4">
                  Founder & CEO
                </Badge>

                <h3 className="text-xl font-black text-foreground uppercase tracking-tight mb-2" data-testid="text-founder-name">
                  TradifyApp Founder
                </h3>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6" data-testid="text-founder-role">
                  Trader & Technologist
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-6" data-testid="text-founder-bio">
                  As a trader who experienced firsthand the frustration of inconsistent execution and lack of
                  accountability tools, I built TradifyApp to solve the problems I faced every day. Too many
                  platforms focus on giving traders signals and predictions — but the real edge comes from
                  understanding your own behavior, enforcing your own rules, and learning from your own data.
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  TradifyApp was born from the belief that trading success is a process, not a product.
                  We're building the platform I wish existed when I started trading — one that respects traders'
                  intelligence, protects their data, and helps them grow at their own pace.
                </p>

                <div className="pt-6 border-t border-border">
                  <p className="text-xs text-muted-foreground italic">
                    "The best traders don't predict markets. They master themselves.
                    TradifyApp is the tool that makes that mastery measurable."
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-b from-background to-muted">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tighter uppercase mb-6">
            Ready to trade with <span className="text-emerald-500">discipline</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join traders who are taking control of their performance with data-driven analytics,
            automated journaling, and real-time prop firm tracking.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" data-testid="link-about-signup">
              <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20" data-testid="button-about-signup">
                Start Free Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/features" data-testid="link-about-features">
              <Button variant="outline" className="h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted" data-testid="button-about-features">
                Explore Features
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-border text-center">
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          <Link to="/features" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-features">Features</Link>
          <Link to="/pricing" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-pricing">Pricing</Link>
          <Link to="/how-it-works" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-how-it-works">How It Works</Link>
          <Link to="/blog" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-blog">Blog</Link>
          <Link to="/resources" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-resources">Resources</Link>
          <Link to="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-terms">Terms</Link>
          <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-privacy">Privacy</Link>
          <Link to="/risk-disclaimer" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-risk">Risk Disclaimer</Link>
          <Link to="/cookie-policy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors" data-testid="link-footer-cookie">Cookie Policy</Link>
          <CookieSettingsButton />
          <a
            href="mailto:support@tradify.app?subject=TradifyApp Support Request"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-contact-us-footer"
          >
            Contact Us
          </a>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
          &copy; 2026 TradifyApp Intelligence Systems. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
