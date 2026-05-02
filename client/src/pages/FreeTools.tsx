import { Link } from "react-router-dom";
import { ArrowRight, Calculator, ClipboardCheck, Trophy, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNavbar } from "@/components/PublicNavbar";
import { SEO } from "@/components/SEO";

const tools = [
  {
    href: "/calculator",
    icon: Calculator,
    title: "Risk & Position Size Calculator",
    body: "Position-sizing, risk/reward, drawdown recovery and rule-violation cost — all in one calculator. Free, no signup.",
    cta: "Open the calculator",
    testid: "card-tool-calculator",
    accent: "emerald",
  },
  {
    href: "/checklist",
    icon: ClipboardCheck,
    title: "Pre-Trade Checklist",
    body: "Print-ready 16-point checklist that forces a 30-second sanity check before every entry. Used by 1,000+ prop traders.",
    cta: "Get the checklist",
    testid: "card-tool-checklist",
    accent: "cyan",
  },
  {
    href: "/prop-firms",
    icon: Trophy,
    title: "Prop Firm Trackers",
    body: "Live challenge trackers for FTMO, MyFundedFX, FundedNext, Topstep, Apex and more. Every rule, every account size.",
    cta: "Pick your firm",
    testid: "card-tool-prop-firms",
    accent: "amber",
  },
];

const accentMap: Record<string, { ring: string; bg: string; text: string }> = {
  emerald: { ring: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-500" },
  cyan: { ring: "border-cyan-500/30", bg: "bg-cyan-500/5", text: "text-cyan-500" },
  amber: { ring: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-500" },
};

export default function FreeTools() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title="Free Trading Tools — Calculator, Checklist & Prop Firm Trackers | TradifyApp"
        description="Free tools for prop firm traders. Position-size calculator, pre-trade checklist, and live prop firm challenge trackers. No signup required."
        canonical="https://tradifyapp.com/free-tools"
        ogImage="https://tradifyapp.com/images/tradify-promo-1.png"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://tradifyapp.com" },
              { "@type": "ListItem", position: 2, name: "Free Tools", item: "https://tradifyapp.com/free-tools" },
            ],
          },
        ]}
      />
      <PublicNavbar />

      <section className="relative pt-40 pb-16 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-6">
            <Link to="/" className="hover:text-emerald-500" data-testid="link-breadcrumb-home">Home</Link>
            <ChevronRight size={12} />
            <span className="text-foreground">Free Tools</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Sparkles size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Free, no signup needed</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase mb-4 leading-[0.95]" data-testid="text-tools-heading">
            Free tools for <span className="text-emerald-500">disciplined</span> traders.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Three tools we built because we needed them ourselves. Zero gates, zero email walls — use them, share them, fork them.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {tools.map((t) => {
            const a = accentMap[t.accent];
            const Icon = t.icon;
            return (
              <Link key={t.href} to={t.href} data-testid={t.testid}>
                <Card className={`bg-card border-border hover-elevate active-elevate-2 cursor-pointer transition-all h-full ${a.ring}`}>
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${a.bg}`}>
                      <Icon className={a.text} size={24} />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight mb-2">{t.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">{t.body}</p>
                    <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${a.text}`}>
                      {t.cta} <ArrowRight size={11} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="py-20 border-t border-border bg-muted/20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-4">Want this automatically?</h2>
          <p className="text-muted-foreground mb-6">Connect MT5 and TradifyApp runs all three for you — every trade, every day.</p>
          <Link to="/signup?utm_source=freetools&utm_medium=organic&utm_campaign=tools_page" data-testid="link-tools-signup">
            <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-black uppercase tracking-widest text-xs h-12 px-8" data-testid="button-tools-signup">
              Start free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-12 border-t border-border text-center">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
          © {new Date().getFullYear()} TradifyApp
        </p>
      </footer>
    </div>
  );
}
