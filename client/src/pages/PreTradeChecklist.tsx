import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "1. Higher Timeframe Bias",
    items: [
      "Checked daily/4H trend direction",
      "Identified key support/resistance zones",
      "Confirmed HTF bias is clear (not ranging/uncertain)",
      "Noted any upcoming high-impact news events",
    ],
  },
  {
    title: "2. Entry Zone Validation",
    items: [
      "Price is at a valid supply/demand zone",
      "Zone has not been previously mitigated",
      "Liquidity has been swept before entry",
      "Structure shift (BOS/CHoCH) confirmed on LTF",
    ],
  },
  {
    title: "3. Entry & Exit Plan",
    items: [
      "Entry trigger confirmed (engulfing, pin bar, order block reaction)",
      "Stop loss placed beyond structure (not arbitrary)",
      "Take profit at next key level (minimum 1:2 RR)",
      "Risk-to-reward ratio acceptable (≥ 1:2)",
    ],
  },
  {
    title: "4. Risk Management",
    items: [
      "Risk per trade ≤ 1-2% of account",
      "Not exceeding max daily drawdown limit",
      "Not over-leveraged on this position",
      "No correlated trades open (double exposure)",
    ],
  },
  {
    title: "5. Psychology & Emotional State",
    items: [
      "Not revenge trading after a loss",
      "Not FOMO entering a move I missed",
      "Emotionally calm and focused",
      "Following my trading plan — not improvising",
    ],
  },
  {
    title: "6. Final Confirmation",
    items: [
      "This trade fits my strategy rules exactly",
      "I would take this same trade 100 times",
      "I can accept the loss if stopped out",
      "Trade logged in journal before execution",
    ],
  },
];

export default function PreTradeChecklist() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Free Pre-Trade Checklist | TradifyApp"
        description="The discipline checklist every serious trader needs. Print it, pin it to your monitor, and stop making impulsive entries."
      />

      <div className="max-w-3xl mx-auto px-6 py-12 print:py-4 print:px-2">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <Link to="/">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground" data-testid="button-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <Button
            onClick={() => window.print()}
            className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs hover:bg-emerald-400"
            data-testid="button-print-checklist"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Checklist
          </Button>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight uppercase mb-2 print:text-2xl">
            Pre-Trade <span className="text-emerald-500">Checklist</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete every item before executing a trade. No exceptions.
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
            by TradifyApp — tradifyapp.com
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section, i) => (
            <div key={i} className="rounded-xl border border-border p-6 print:p-4 print:break-inside-avoid">
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest mb-4 print:text-xs">
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.items.map((item, j) => (
                  <label key={j} className="flex items-start gap-3 cursor-pointer group">
                    <div className="mt-0.5 h-5 w-5 rounded border-2 border-border shrink-0 flex items-center justify-center group-hover:border-emerald-500 transition-colors print:border-gray-400">
                      <CheckCircle2 size={14} className="text-emerald-500 opacity-0 group-hover:opacity-30 transition-opacity print:hidden" />
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors print:text-black print:text-xs">
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center print:hidden">
          <p className="text-xs text-muted-foreground mb-4">
            Want to automate this entire process? TradifyApp validates every trade against your rules automatically.
          </p>
          <Link to="/signup" data-testid="link-checklist-signup">
            <Button className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs hover:bg-emerald-400" data-testid="button-checklist-signup">
              Start Free — Automate Your Discipline
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
