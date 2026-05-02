import { Link } from "react-router-dom";
import { ArrowRight, Trophy, ChevronRight, MapPin, Calendar, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import { SEO } from "@/components/SEO";
import { propFirms } from "@/data/propFirms";

export default function PropFirmsIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title="Prop Firm Trackers — Live Rule Monitoring for FTMO, MFF, FundedNext & More | TradifyApp"
        description="Live challenge trackers for every major prop firm. Real-time drawdown, consistency, and profit-target monitoring. Pick your firm and start free."
        canonical="https://tradifyapp.com/prop-firms"
        ogImage="https://tradifyapp.com/api/og/prop-firms.svg"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://tradifyapp.com" },
              { "@type": "ListItem", position: 2, name: "Prop Firms", item: "https://tradifyapp.com/prop-firms" },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: propFirms.map((f, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: f.name,
              url: `https://tradifyapp.com/prop-firms/${f.slug}`,
            })),
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
            <span className="text-foreground">Prop Firms</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Trophy size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Prop Firm Tracker Library</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase mb-4 leading-[0.95]" data-testid="text-index-heading">
            Every prop firm. <span className="text-emerald-500">Every rule.</span> Tracked live.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-8">
            Pick your firm to see a free live challenge tracker, every account size, the consistency math, and the exact reasons most traders fail.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {propFirms.map((f) => (
            <Link key={f.slug} to={`/prop-firms/${f.slug}`} data-testid={`link-firm-${f.slug}`}>
              <Card className="bg-card border-border hover-elevate active-elevate-2 cursor-pointer transition-all h-full">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-lg font-black uppercase tracking-tight" data-testid={`text-firm-name-${f.slug}`}>{f.name}</span>
                    <Badge variant="outline" className="text-[9px] uppercase tracking-widest">
                      {f.drawdownType} DD
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{f.tagline}</p>
                  <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
                    <div className="flex items-center gap-2"><MapPin size={11} className="text-emerald-500/70" /> {f.headquarters}</div>
                    <div className="flex items-center gap-2"><Calendar size={11} className="text-emerald-500/70" /> Founded {f.founded}</div>
                    <div className="flex items-center gap-2"><Shield size={11} className="text-emerald-500/70" /> {f.accounts.length} account sizes</div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-500 mt-4">
                    See {f.shortName} tracker <ArrowRight size={11} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-20 border-t border-border bg-muted/20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-4">Don't see your firm?</h2>
          <p className="text-muted-foreground mb-6">TradifyApp also supports fully custom challenge configurations — set your own rules in 2 minutes.</p>
          <Link to="/signup?utm_source=propfirm&utm_medium=organic&utm_campaign=index_page" data-testid="link-index-signup">
            <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-black uppercase tracking-widest text-xs h-12 px-8" data-testid="button-index-signup">
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
