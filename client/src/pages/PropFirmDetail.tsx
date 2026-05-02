import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle, AlertTriangle, Trophy, ChevronRight, Shield, Zap, Target, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import { SEO } from "@/components/SEO";
import { getPropFirm, propFirms } from "@/data/propFirms";

const ruleIcon = (status: "allowed" | "restricted" | "prohibited") => {
  if (status === "allowed") return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (status === "prohibited") return <XCircle size={14} className="text-rose-500" />;
  return <AlertTriangle size={14} className="text-amber-500" />;
};

const ruleLabel = (status: "allowed" | "restricted" | "prohibited") =>
  status === "allowed" ? "Allowed" : status === "prohibited" ? "Prohibited" : "Restricted";

export default function PropFirmDetail() {
  const { slug } = useParams<{ slug: string }>();
  const firm = slug ? getPropFirm(slug) : undefined;

  if (!firm) {
    return <Navigate to="/prop-firms" replace />;
  }

  const url = `https://tradifyapp.com/prop-firms/${firm.slug}`;
  const title = `${firm.name} Challenge Tracker & Rules (2026) | TradifyApp`;
  const description = `Live ${firm.name} challenge tracker with all rules, account sizes, drawdown math, and consistency monitoring. ${firm.tagline}`;

  const competitors = firm.competitors
    .map((c) => propFirms.find((p) => p.slug === c))
    .filter(Boolean) as typeof propFirms;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title={title}
        description={description}
        canonical={url}
        ogImage={`https://tradifyapp.com/api/og/prop-firm/${firm.slug}.svg`}
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: `TradifyApp ${firm.name} Tracker`,
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            description,
            url,
            offers: [
              { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free Plan" },
              { "@type": "Offer", price: "29", priceCurrency: "USD", name: "Pro Plan" },
              { "@type": "Offer", price: "59", priceCurrency: "USD", name: "Elite Plan" },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://tradifyapp.com" },
              { "@type": "ListItem", position: 2, name: "Prop Firms", item: "https://tradifyapp.com/prop-firms" },
              { "@type": "ListItem", position: 3, name: firm.name, item: url },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: `What is the ${firm.name} drawdown rule?`,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: `${firm.name} uses a ${firm.drawdownType} drawdown model. ${firm.accounts[0]?.maxDrawdown || ""} max drawdown applies on standard accounts, with a ${firm.accounts[0]?.maxDailyLoss || ""} daily loss limit.`,
                },
              },
              {
                "@type": "Question",
                name: `How is ${firm.name} consistency calculated?`,
                acceptedAnswer: { "@type": "Answer", text: firm.consistencyRule },
              },
              {
                "@type": "Question",
                name: `Can I use EAs and copy trading on ${firm.name}?`,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: `EAs are ${ruleLabel(firm.ea).toLowerCase()} on ${firm.name}. Copy trading is ${ruleLabel(firm.copyTrading).toLowerCase()}.`,
                },
              },
              {
                "@type": "Question",
                name: `Why do most traders fail the ${firm.name} challenge?`,
                acceptedAnswer: { "@type": "Answer", text: firm.whyTradersFail.join(" ") },
              },
              {
                "@type": "Question",
                name: `How does TradifyApp help with ${firm.name}?`,
                acceptedAnswer: { "@type": "Answer", text: firm.howTradifyHelps.join(" ") },
              },
            ],
          },
        ]}
      />
      <PublicNavbar />

      {/* Hero */}
      <section className="relative pt-40 pb-16 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-6">
            <Link to="/" className="hover:text-emerald-500" data-testid="link-breadcrumb-home">Home</Link>
            <ChevronRight size={12} />
            <Link to="/prop-firms" className="hover:text-emerald-500" data-testid="link-breadcrumb-prop-firms">Prop Firms</Link>
            <ChevronRight size={12} />
            <span className="text-foreground">{firm.shortName}</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <Trophy size={14} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{firm.name} Challenge Tracker</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase mb-4 leading-[0.95]" data-testid="text-firm-heading">
            Pass the <span className="text-amber-500">{firm.shortName}</span> Challenge — without breaking a single rule.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-8">{firm.tagline} TradifyApp tracks every {firm.name} rule live so you always know exactly where you stand.</p>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <Link to="/signup?utm_source=propfirm&utm_medium=organic&utm_campaign=tracker_page&utm_content=primary" data-testid="link-firm-signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-amber-400 shadow-xl shadow-amber-500/20" data-testid="button-firm-signup">
                Start tracking free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/calculator" data-testid="link-firm-calculator">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border font-bold uppercase tracking-widest text-xs rounded-2xl" data-testid="button-firm-calculator">
                Use the free calculator
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px] uppercase">{firm.headquarters}</Badge>
            <Badge variant="outline" className="text-[10px] uppercase">Founded {firm.founded}</Badge>
            <Badge variant="outline" className="text-[10px] uppercase">{firm.drawdownType} drawdown</Badge>
            <Badge variant="outline" className="text-[10px] uppercase">{firm.payoutFrequency}</Badge>
          </div>
        </div>
      </section>

      {/* Account-size matrix */}
      <section className="py-20 border-y border-border bg-muted/20" data-testid="section-account-table">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2">{firm.name} Account Sizes & Fees</h2>
          <p className="text-sm text-muted-foreground mb-8">Every plan, every drawdown level, every profit split — kept current for {new Date().getFullYear()}.</p>

          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account Size</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fee</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Profit Target</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Max Daily Loss</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Max Drawdown</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Profit Split</th>
                </tr>
              </thead>
              <tbody>
                {firm.accounts.map((a, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30" data-testid={`row-account-${i}`}>
                    <td className="p-4 font-bold text-foreground">{a.size}</td>
                    <td className="p-4 text-muted-foreground">{a.fee}</td>
                    <td className="p-4 text-muted-foreground">{a.profitTarget}</td>
                    <td className="p-4 text-rose-400">{a.maxDailyLoss}</td>
                    <td className="p-4 text-amber-400">{a.maxDrawdown}</td>
                    <td className="p-4 text-emerald-400">{a.profitSplit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4 italic">
            Fees and rules change. Always confirm on the official {firm.name} website before purchasing a Challenge.
          </p>
        </div>
      </section>

      {/* Rules at a glance */}
      <section className="py-20" data-testid="section-rules-glance">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-8">{firm.name} rules at a glance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "News trading", value: firm.newsTrading },
              { label: "Weekend holding", value: firm.weekendHolding },
              { label: "Expert Advisors (EAs)", value: firm.ea },
              { label: "Copy trading", value: firm.copyTrading },
            ].map((r) => (
              <Card key={r.label} className="bg-card border-border" data-testid={`rule-${r.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{r.label}</span>
                  <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    {ruleIcon(r.value)} {ruleLabel(r.value)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Min trading days</div>
                <div className="text-lg font-bold text-foreground">{firm.minTradingDays}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Max trading days</div>
                <div className="text-lg font-bold text-foreground">{firm.maxTradingDays}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Platforms</div>
                <div className="text-sm font-bold text-foreground">{firm.platforms.join(", ")}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-amber-500/5 border-amber-500/30 mt-6">
            <CardContent className="p-5 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Consistency rule</div>
                <p className="text-sm text-muted-foreground">{firm.consistencyRule}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Why traders fail */}
      <section className="py-20 bg-muted/20 border-y border-border" data-testid="section-why-fail">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2 text-rose-500 flex items-center gap-3">
                <TrendingDown size={28} /> Why most traders fail
              </h2>
              <p className="text-sm text-muted-foreground mb-6">{firm.passRateNote}</p>
              <ul className="space-y-3">
                {firm.whyTradersFail.map((f, i) => (
                  <li key={i} className="flex gap-3 text-sm" data-testid={`text-fail-${i}`}>
                    <XCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2 text-emerald-500 flex items-center gap-3">
                <Shield size={28} /> How TradifyApp helps
              </h2>
              <p className="text-sm text-muted-foreground mb-6">A purpose-built {firm.name} preset that tracks every rule live.</p>
              <ul className="space-y-3">
                {firm.howTradifyHelps.map((h, i) => (
                  <li key={i} className="flex gap-3 text-sm" data-testid={`text-help-${i}`}>
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Mid-page CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-amber-500/10 border-emerald-500/30">
            <CardContent className="p-8 sm:p-12 text-center">
              <Zap className="mx-auto text-emerald-500 mb-4" size={40} />
              <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-4">Track your {firm.shortName} challenge in real time.</h3>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">Free forever. No card. Connect your MT5 account in 2 minutes — TradifyApp does the rest.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/signup?utm_source=propfirm&utm_medium=organic&utm_campaign=tracker_page&utm_content=midcta" data-testid="link-mid-cta-signup">
                  <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-black uppercase tracking-widest text-xs h-12 px-8" data-testid="button-mid-cta-signup">
                    Start tracking <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/checklist" data-testid="link-mid-cta-checklist">
                  <Button variant="outline" className="font-bold uppercase tracking-widest text-xs h-12 px-8" data-testid="button-mid-cta-checklist">
                    Free pre-trade checklist
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Compare with competitors */}
      <section className="py-20 bg-muted/20 border-y border-border" data-testid="section-competitors">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2">{firm.name} vs other prop firms</h2>
          <p className="text-sm text-muted-foreground mb-8">Compare {firm.shortName}'s rules side-by-side with the other firms TradifyApp supports.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.map((c) => (
              <Link key={c.slug} to={`/prop-firms/${c.slug}`} data-testid={`link-competitor-${c.slug}`}>
                <Card className="bg-card border-border hover-elevate active-elevate-2 cursor-pointer transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black uppercase tracking-tight">{c.shortName}</span>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{c.tagline}</p>
                    <div className="text-[10px] uppercase tracking-widest text-emerald-500">
                      {c.drawdownType} drawdown · {c.accounts[0]?.profitSplit}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24" data-testid="section-final-cta">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Target className="mx-auto text-emerald-500 mb-6" size={48} />
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4">Stop relying on broker dashboards.</h2>
          <p className="text-muted-foreground mb-8 text-lg">{firm.name} won't tell you when you're one trade away from a violation. TradifyApp will.</p>
          <Link to="/signup?utm_source=propfirm&utm_medium=organic&utm_campaign=tracker_page&utm_content=finalcta" data-testid="link-final-cta-signup">
            <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-black uppercase tracking-widest text-xs h-14 px-10" data-testid="button-final-cta-signup">
              Start free — track {firm.shortName} live <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-4">Free forever. No credit card. Connect MT5 in 2 minutes.</p>
        </div>
      </section>

      <footer className="py-12 border-t border-border text-center">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
          © {new Date().getFullYear()} TradifyApp · Not affiliated with {firm.name}
        </p>
      </footer>
    </div>
  );
}
