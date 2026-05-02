import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer, ArrowLeft, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

export default function PreTradeChecklist() {
  const { t } = useTranslation("common", { keyPrefix: "checklist" });

  const sections = [
    {
      title: t("section1Title"),
      items: [t("section1Item1"), t("section1Item2"), t("section1Item3"), t("section1Item4")],
    },
    {
      title: t("section2Title"),
      items: [t("section2Item1"), t("section2Item2"), t("section2Item3"), t("section2Item4")],
    },
    {
      title: t("section3Title"),
      items: [t("section3Item1"), t("section3Item2"), t("section3Item3"), t("section3Item4")],
    },
    {
      title: t("section4Title"),
      items: [t("section4Item1"), t("section4Item2"), t("section4Item3"), t("section4Item4")],
    },
    {
      title: t("section5Title"),
      items: [t("section5Item1"), t("section5Item2"), t("section5Item3"), t("section5Item4")],
    },
    {
      title: t("section6Title"),
      items: [t("section6Item1"), t("section6Item2"), t("section6Item3"), t("section6Item4")],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={t("seoTitle")}
        description={t("seoDesc")}
        canonical="https://tradifyapp.com/checklist"
      />

      <div className="max-w-3xl mx-auto px-6 py-12 print:py-4 print:px-2">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <Link to="/">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground" data-testid="button-back-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("btnBackHome")}
            </Button>
          </Link>
          <Button
            onClick={() => window.print()}
            className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs hover:bg-emerald-400"
            data-testid="button-print-checklist"
          >
            <Printer className="mr-2 h-4 w-4" />
            {t("btnPrint")}
          </Button>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight uppercase mb-2 print:text-2xl">
            {t("headlinePart1")} <span className="text-emerald-500">{t("headlineDiscipline")}</span> {t("headlinePart2")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
            {t("byline")}
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
            {t("ctaTitle")}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
            {t("ctaDesc")}
          </p>
          <Link to="/signup" data-testid="link-checklist-signup">
            <Button className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs hover:bg-emerald-400 h-12 px-8" data-testid="button-checklist-signup">
              {t("ctaButton")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
