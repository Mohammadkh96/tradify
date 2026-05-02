import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  Plug,
  Activity,
  ListChecks,
  Target,
  Brain,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNavbar } from "@/components/PublicNavbar";
import { SEO } from "@/components/SEO";

const stepIcons = [TrendingUp, Plug, Activity, ListChecks, Target, Brain];

function StepMockup({ index }: { index: number }) {
  const mockups = [
    (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-3 max-w-sm">
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Sign up</div>
        <div className="h-9 rounded-md bg-slate-800/60 border border-slate-700 px-3 flex items-center text-xs text-slate-400">you@example.com</div>
        <div className="h-9 rounded-md bg-slate-800/60 border border-slate-700 px-3 flex items-center text-xs text-slate-400">••••••••</div>
        <div className="h-9 rounded-md bg-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-widest flex items-center justify-center">Create Account</div>
      </div>
    ),
    (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-3 max-w-sm">
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">MT5 Bridge</div>
        <div className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />Connected to FTMO-Demo</div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
          <span>Account #5102837</span><span>Sync token ✓</span>
        </div>
      </div>
    ),
    (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-2 max-w-sm">
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Live Trades</div>
        {[
          { p: "EURUSD", pnl: "+$182.40", win: true },
          { p: "GBPJPY", pnl: "−$94.10", win: false },
          { p: "XAUUSD", pnl: "+$310.00", win: true },
        ].map((t) => (
          <div key={t.p} className="flex justify-between text-xs border-b border-slate-800/60 pb-2">
            <span className="text-slate-300">{t.p}</span>
            <span className={t.win ? "text-emerald-400" : "text-rose-400"}>{t.pnl}</span>
          </div>
        ))}
      </div>
    ),
    (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-3 max-w-sm">
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Your Rules</div>
        {["Max 2 trades/day", "Risk per trade ≤ 1%", "London session only"].map((r) => (
          <div key={r} className="flex items-center gap-2 text-xs text-slate-300">
            <CheckCircle2 size={14} className="text-emerald-500" /> {r}
          </div>
        ))}
      </div>
    ),
    (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-3 max-w-sm">
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">FTMO Challenge</div>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1"><span>Profit Target</span><span>62%</span></div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: "62%" }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1"><span>Daily Drawdown</span><span>34%</span></div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-amber-500" style={{ width: "34%" }} /></div>
          </div>
        </div>
      </div>
    ),
    (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-2 max-w-sm">
        <div className="text-[10px] font-bold uppercase tracking-widest text-rose-500">⚠ Risk Pattern</div>
        <div className="text-xs text-slate-300">3 losing trades in 90 minutes. Position size up 240% on the last entry.</div>
        <div className="text-[11px] text-slate-500 italic">Looks like revenge trading — pause for 30 minutes?</div>
      </div>
    ),
  ];
  return mockups[index];
}

export default function Demo() {
  const { t } = useTranslation();
  const steps = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: t(`demo.step${n}Title`),
    body: t(`demo.step${n}Body`),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={`${t("demo.title")} | TradifyApp`}
        description={t("demo.subtitle")}
        canonical="https://tradifyapp.com/demo"
        breadcrumbs={[
          { name: "Home", url: "https://tradifyapp.com" },
          { name: "Demo", url: "https://tradifyapp.com/demo" },
        ]}
      />
      <PublicNavbar />
      <main className="pt-32 pb-24 px-6 max-w-5xl mx-auto">
        <header className="text-center mb-16">
          <h1
            className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic mb-6"
            data-testid="text-demo-title"
          >
            {t("demo.title")}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-testid="text-demo-subtitle">
            {t("demo.subtitle")}
          </p>
        </header>

        <div className="space-y-12">
          {steps.map((step, i) => {
            const Icon = stepIcons[i];
            return (
              <Card
                key={i}
                className="bg-card border-border overflow-hidden"
                data-testid={`card-demo-step-${i + 1}`}
              >
                <CardContent className="p-8 grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                        {i + 1}
                      </div>
                      <Icon className="text-emerald-500" size={22} />
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight italic mb-3">
                      {step.title}
                    </h2>
                    <p className="text-muted-foreground">{step.body}</p>
                  </div>
                  <div className="flex justify-center md:justify-end">
                    <StepMockup index={i} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <section className="mt-20 text-center bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-12">
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic mb-4">
            {t("demo.ctaTitle")}
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">{t("demo.ctaSubtitle")}</p>
          <Link to="/signup">
            <Button
              size="lg"
              className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest"
              data-testid="button-demo-cta"
            >
              {t("demo.ctaButton")} <ArrowRight className="ml-2" size={18} />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
