import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer, ArrowLeft, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";

const sections = [
  {
    title: "1. HTF Bias & Rule Enforcement",
    items: [
      "Confirmed daily/4H trend direction aligns with my rule set",
      "Checked TradifyApp rule engine — no active session restrictions triggered",
      "Verified no high-impact news within my restricted news window",
      "HTF bias is clear and matches my allowed trading direction rules",
    ],
  },
  {
    title: "2. Entry & Exit Validation Against Session Rules",
    items: [
      "Entry setup matches one of my pre-defined strategy templates",
      "Stop loss is placed beyond structure — not an arbitrary round number",
      "Take profit is at the next key level with minimum acceptable R:R",
      "This trade passes my TradifyApp entry checklist rule (if configured)",
    ],
  },
  {
    title: "3. Prop Firm Drawdown Awareness Check",
    items: [
      "Checked current drawdown distance in TradifyApp Prop Tracker",
      "This trade's risk will NOT push me within 50% of my daily drawdown limit",
      "Total open risk across all positions stays within max drawdown threshold",
      "If trailing drawdown: verified high-water mark and current cushion",
    ],
  },
  {
    title: "4. Position Size & Risk Calculator Input",
    items: [
      "Calculated position size using TradifyApp risk calculator (not mental math)",
      "Risk per trade is ≤ 2% of current drawdown allowance (not account balance)",
      "No correlated positions open that double my effective exposure",
      "Lot size matches my pre-committed session rule — no manual override",
    ],
  },
  {
    title: "5. Psychological & Emotional State Audit",
    items: [
      "Logged my pre-session mood in TradifyApp (calm / anxious / frustrated / confident)",
      "Not revenge trading after a previous loss this session",
      "Not FOMO entering because I missed the initial move",
      "I slept enough, I'm not fatigued, and I can think clearly right now",
    ],
  },
  {
    title: "6. Behavioral Discipline Trigger Review",
    items: [
      "I have not exceeded my max trades per session rule",
      "My session loss limit has NOT been hit — TradifyApp confirms green status",
      "I am trading within my defined session hours (not outside my window)",
      "This is a planned trade from my watchlist — not a spontaneous impulse entry",
    ],
  },
];

export default function PreTradeChecklist() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Free Pre-Trade Checklist for Disciplined Traders | TradifyApp"
        description="Download the free pre-trade checklist used by disciplined traders. Covers HTF bias, entry validation, risk management, and psychology checks. Print and use before every trade."
        canonical="https://tradifyapp.com/checklist"
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
            Pre-Trade <span className="text-emerald-500">Discipline</span> Checklist
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

        <div className="mt-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center print:hidden">
          <div className="h-14 w-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="text-emerald-500" size={28} />
          </div>
          <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-2">
            This Checklist Is Automated Inside TradifyApp
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
            Every item you just checked is enforced automatically when you connect your MT5 account. 
            Drawdown tracking, rule enforcement, position sizing, session limits — all running in real time.
          </p>
          <Link to="/signup" data-testid="link-checklist-signup">
            <Button className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs hover:bg-emerald-400 h-12 px-8" data-testid="button-checklist-signup">
              Start Free — Your Rules. Enforced.
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
