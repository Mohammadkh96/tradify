import { AlertTriangle } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

type Item = { boldKey?: string; textKey: string };
type Section = { titleKey: string; bodyKey?: string; bodyBold?: boolean; boxed?: boolean; items?: Item[]; contact?: boolean };

export default function RiskDisclaimer() {
  const { t } = useTranslation("common", { keyPrefix: "legal" });

  const sections: Section[] = [
    { titleKey: "riskS1Title", items: [
      { textKey: "riskS1Item1" }, { textKey: "riskS1Item2" }, { textKey: "riskS1Item3" }, { textKey: "riskS1Item4" }, { textKey: "riskS1Item5" },
    ]},
    { titleKey: "riskS2Title", bodyKey: "riskS2Body", boxed: true, items: [
      { textKey: "riskS2Item1" }, { textKey: "riskS2Item2" }, { textKey: "riskS2Item3" }, { textKey: "riskS2Item4" }, { textKey: "riskS2Item5" },
    ]},
    { titleKey: "riskS3Title", items: [
      { textKey: "riskS3Item1" }, { textKey: "riskS3Item2" }, { textKey: "riskS3Item3" },
      { textKey: "riskS3Item4" }, { textKey: "riskS3Item5" }, { textKey: "riskS3Item6" },
    ]},
    { titleKey: "riskS4Title", items: [
      { boldKey: "riskS4Item1Bold", textKey: "riskS4Item1" },
      { boldKey: "riskS4Item2Bold", textKey: "riskS4Item2" },
      { boldKey: "riskS4Item3Bold", textKey: "riskS4Item3" },
      { boldKey: "riskS4Item4Bold", textKey: "riskS4Item4" },
    ]},
    { titleKey: "riskS5Title", items: [
      { textKey: "riskS5Item1" }, { textKey: "riskS5Item2" }, { textKey: "riskS5Item3" }, { textKey: "riskS5Item4" }, { textKey: "riskS5Item5" },
    ]},
    { titleKey: "riskS6Title", items: [
      { boldKey: "riskS6Item1Bold", textKey: "riskS6Item1" },
      { boldKey: "riskS6Item2Bold", textKey: "riskS6Item2" },
      { boldKey: "riskS6Item3Bold", textKey: "riskS6Item3" },
      { boldKey: "riskS6Item4Bold", textKey: "riskS6Item4" },
      { boldKey: "riskS6Item5Bold", textKey: "riskS6Item5" },
    ]},
    { titleKey: "riskS7Title", items: [
      { textKey: "riskS7Item1" }, { textKey: "riskS7Item2" }, { textKey: "riskS7Item3" }, { textKey: "riskS7Item4" }, { textKey: "riskS7Item5" },
    ]},
    { titleKey: "riskS8Title", items: [
      { textKey: "riskS8Item1" }, { textKey: "riskS8Item2" }, { textKey: "riskS8Item3" }, { textKey: "riskS8Item4" }, { textKey: "riskS8Item5" },
    ]},
    { titleKey: "riskS9Title", items: [
      { textKey: "riskS9Item1" }, { textKey: "riskS9Item2" }, { textKey: "riskS9Item3" }, { textKey: "riskS9Item4" }, { textKey: "riskS9Item5" },
    ]},
    { titleKey: "riskS10Title", items: [
      { textKey: "riskS10Item1" }, { textKey: "riskS10Item2" }, { textKey: "riskS10Item3" }, { textKey: "riskS10Item4" },
    ]},
    { titleKey: "riskS11Title", items: [
      { textKey: "riskS11Item1" }, { textKey: "riskS11Item2" }, { textKey: "riskS11Item3" }, { textKey: "riskS11Item4" }, { textKey: "riskS11Item5" },
    ]},
    { titleKey: "riskS12Title", bodyKey: "riskS12Body", boxed: true, items: [
      { textKey: "riskS12Item1" }, { textKey: "riskS12Item2" }, { textKey: "riskS12Item3" }, { textKey: "riskS12Item4" },
    ]},
    { titleKey: "riskS13Title", bodyKey: "riskS13Body", items: [
      { textKey: "riskS13Item1" }, { textKey: "riskS13Item2" }, { textKey: "riskS13Item3" }, { textKey: "riskS13Item4" }, { textKey: "riskS13Item5" },
    ]},
    { titleKey: "riskS14Title", bodyKey: "riskS14Body", items: [
      { textKey: "riskS14Item1" }, { textKey: "riskS14Item2" }, { textKey: "riskS14Item3" }, { textKey: "riskS14Item4" }, { textKey: "riskS14Item5" },
    ]},
    { titleKey: "riskS15Title", bodyKey: "riskS15Body", contact: true },
  ];

  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <SEO title={t("riskSeoTitle")} description={t("riskSeoDesc")} canonical="https://tradifyapp.com/risk-disclaimer" />
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="text-rose-500 h-8 w-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">{t("riskTitle")}</h1>
      </div>

      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-sm text-slate-500">{t("lastUpdated", { date: "February 3, 2026" })}</p>

        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl mb-8">
          <p className="text-rose-500 font-bold uppercase tracking-widest text-sm mb-2">{t("riskWarningLabel")}</p>
          <p className="text-white font-medium">{t("riskWarningBody")}</p>
        </div>

        {sections.map((sec, i) => (
          <section key={i}>
            <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t(sec.titleKey)}</h2>
            {sec.boxed && sec.bodyKey ? (
              <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
                <p className="font-semibold text-white mb-3">{t(sec.bodyKey)}</p>
                <ul className="list-disc pl-6 space-y-2">
                  {sec.items?.map((item, j) => (
                    <li key={j}>
                      {item.boldKey && <strong className="text-white">{t(item.boldKey)}</strong>}{item.boldKey ? " " : ""}{t(item.textKey)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                {sec.bodyKey && <p className={sec.bodyBold ? "font-semibold text-white" : ""}>{t(sec.bodyKey)}</p>}
                {sec.items && sec.items.length > 0 && (
                  <ul className={`list-disc pl-6 ${sec.bodyKey ? "mt-3" : ""} space-y-2`}>
                    {sec.items.map((item, j) => (
                      <li key={j}>
                        {item.boldKey && <strong className="text-white">{t(item.boldKey)}</strong>}{item.boldKey ? " " : ""}{t(item.textKey)}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {sec.contact && (
              <>
                <p className="mt-2"><strong className="text-white">{t("contactEmailLabel")}</strong> {t("supportEmail")}</p>
                <p><strong className="text-white">{t("contactWebsiteLabel")}</strong> {t("websiteUrl")}</p>
              </>
            )}
          </section>
        ))}

        <div className="border-t border-rose-500/20 pt-6 mt-8">
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg">
            <p className="text-rose-400 font-semibold text-sm uppercase tracking-wide">{t("riskFinalLabel")}</p>
            <p className="text-white mt-2">{t("riskFinalBody")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
