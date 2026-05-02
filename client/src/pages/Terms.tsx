import { FileText } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

export default function Terms() {
  const { t } = useTranslation("common", { keyPrefix: "legal" });

  const sections = [
    { titleKey: "termsS1Title", bodyKey: "termsS1Body", items: [
      { textKey: "termsS1Item1" }, { textKey: "termsS1Item2" }, { textKey: "termsS1Item3" }, { textKey: "termsS1Item4" },
    ]},
    { titleKey: "termsS2Title", bodyKey: "termsS2Body", items: [
      { boldKey: "termsS2Item1Bold", textKey: "termsS2Item1" },
      { boldKey: "termsS2Item2Bold", textKey: "termsS2Item2" },
      { boldKey: "termsS2Item3Bold", textKey: "termsS2Item3" },
      { boldKey: "termsS2Item4Bold", textKey: "termsS2Item4" },
      { boldKey: "termsS2Item5Bold", textKey: "termsS2Item5" },
    ]},
    { titleKey: "termsS3Title", bodyKey: "termsS3Body", boxed: true, items: [
      { textKey: "termsS3Item1" }, { textKey: "termsS3Item2" }, { textKey: "termsS3Item3" },
      { textKey: "termsS3Item4" }, { textKey: "termsS3Item5" }, { textKey: "termsS3Item6" },
    ]},
    { titleKey: "termsS4Title", items: [
      { textKey: "termsS4Item1" }, { textKey: "termsS4Item2" }, { textKey: "termsS4Item3" },
      { textKey: "termsS4Item4" }, { textKey: "termsS4Item5" },
    ]},
    { titleKey: "termsS5Title", items: [
      { boldKey: "termsS5Item1Bold", textKey: "termsS5Item1" },
      { boldKey: "termsS5Item2Bold", textKey: "termsS5Item2" },
      { boldKey: "termsS5Item3Bold", textKey: "termsS5Item3" },
      { boldKey: "termsS5Item4Bold", textKey: "termsS5Item4" },
      { textKey: "termsS5Item5" }, { textKey: "termsS5Item6" }, { textKey: "termsS5Item7" },
      { textKey: "termsS5Item8" }, { textKey: "termsS5Item9" },
    ]},
    { titleKey: "termsS6Title", items: [
      { textKey: "termsS6Item1" }, { textKey: "termsS6Item2" }, { textKey: "termsS6Item3" },
      { textKey: "termsS6Item4" }, { textKey: "termsS6Item5" },
    ]},
    { titleKey: "termsS7Title", items: [
      { textKey: "termsS7Item1" }, { textKey: "termsS7Item2" }, { textKey: "termsS7Item3" }, { textKey: "termsS7Item4" },
    ]},
    { titleKey: "termsS8Title", bodyKey: "termsS8Body", items: [
      { textKey: "termsS8Item1" }, { textKey: "termsS8Item2" }, { textKey: "termsS8Item3" }, { textKey: "termsS8Item4" },
      { textKey: "termsS8Item5" }, { textKey: "termsS8Item6" }, { textKey: "termsS8Item7" }, { textKey: "termsS8Item8" },
    ]},
    { titleKey: "termsS9Title", bodyKey: "termsS9Body", boxed: true, items: [
      { textKey: "termsS9Item1" }, { textKey: "termsS9Item2" }, { textKey: "termsS9Item3" },
      { textKey: "termsS9Item4" }, { textKey: "termsS9Item5" },
    ]},
    { titleKey: "termsS10Title", bodyKey: "termsS10Body", items: [
      { textKey: "termsS10Item1" }, { textKey: "termsS10Item2" }, { textKey: "termsS10Item3" }, { textKey: "termsS10Item4" },
    ]},
    { titleKey: "termsS11Title", items: [
      { textKey: "termsS11Item1" }, { textKey: "termsS11Item2" }, { textKey: "termsS11Item3" },
    ]},
    { titleKey: "termsS12Title", items: [
      { textKey: "termsS12Item1" }, { textKey: "termsS12Item2" }, { textKey: "termsS12Item3" }, { textKey: "termsS12Item4" },
    ]},
    { titleKey: "termsS13Title", bodyKey: "termsS13Body", boxed: true, items: [
      { textKey: "termsS13Item1" }, { textKey: "termsS13Item2" }, { textKey: "termsS13Item3" }, { textKey: "termsS13Item4" },
    ]},
    { titleKey: "termsS14Title", items: [
      { textKey: "termsS14Item1" }, { textKey: "termsS14Item2" }, { textKey: "termsS14Item3" }, { textKey: "termsS14Item4" },
    ]},
    { titleKey: "termsS15Title", bodyKey: "termsS15Body", items: [] },
    { titleKey: "termsS16Title", items: [
      { boldKey: "termsS16Item1Bold", textKey: "termsS16Item1" },
      { boldKey: "termsS16Item2Bold", textKey: "termsS16Item2" },
      { boldKey: "termsS16Item3Bold", textKey: "termsS16Item3" },
      { boldKey: "termsS16Item4Bold", textKey: "termsS16Item4" },
    ]},
    { titleKey: "termsS17Title", bodyKey: "termsS17Body", items: [] },
    { titleKey: "termsS18Title", bodyKey: "termsS18Body", items: [] },
    { titleKey: "termsS19Title", bodyKey: "termsS19Body", items: [] },
    { titleKey: "termsS20Title", bodyKey: "termsS20Body", items: [], contact: true },
  ];

  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <SEO title={t("termsSeoTitle")} description={t("termsSeoDesc")} canonical="https://tradifyapp.com/terms" />
      <div className="flex items-center gap-3 mb-6">
        <FileText className="text-primary h-8 w-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">{t("termsTitle")}</h1>
      </div>

      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-sm text-slate-500">{t("lastUpdated", { date: "February 3, 2026" })}</p>

        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl mb-8">
          <p className="text-white font-medium">{t("termsIntro")}</p>
        </div>

        {sections.map((sec, i) => (
          <section key={i}>
            <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t(sec.titleKey)}</h2>
            {sec.bodyKey && !sec.boxed && (
              <p className={sec.titleKey === "termsS3Title" || sec.titleKey === "termsS9Title" || sec.titleKey === "termsS13Title" ? "font-semibold text-white" : ""}>
                {t(sec.bodyKey)}
              </p>
            )}
            {sec.boxed && sec.bodyKey && (
              <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
                <p className="font-semibold text-white mb-3">{t(sec.bodyKey)}</p>
                <ul className="list-disc pl-6 space-y-2">
                  {sec.items.map((item, j) => (
                    <li key={j}>
                      {item.boldKey && <strong className="text-white">{t(item.boldKey)}</strong>}{item.boldKey ? " " : ""}{t(item.textKey)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!sec.boxed && sec.items.length > 0 && (
              <ul className={`list-disc pl-6 ${sec.bodyKey ? "mt-3" : ""} space-y-2`}>
                {sec.items.map((item, j) => (
                  <li key={j}>
                    {item.boldKey && <strong className="text-white">{t(item.boldKey)}</strong>}{item.boldKey ? " " : ""}{t(item.textKey)}
                  </li>
                ))}
              </ul>
            )}
            {sec.contact && (
              <>
                <p className="mt-2"><strong className="text-white">{t("contactEmailLabel")}</strong> {t("supportEmail")}</p>
                <p><strong className="text-white">{t("contactWebsiteLabel")}</strong> {t("websiteUrl")}</p>
              </>
            )}
          </section>
        ))}

        <div className="border-t border-slate-700 pt-6 mt-8">
          <p className="text-sm text-slate-500">{t("termsAcknowledgment")}</p>
        </div>
      </div>
    </div>
  );
}
