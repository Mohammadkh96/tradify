import { Shield } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

type Item = { boldKey?: string; textKey: string };
type Section = { titleKey: string; bodyKey?: string; bodyBold?: boolean; items?: Item[]; subSections?: { titleKey: string; items: Item[] }[]; noteKey?: string; contact?: boolean };

export default function Privacy() {
  const { t } = useTranslation("common", { keyPrefix: "legal" });

  const sections: Section[] = [
    {
      titleKey: "privacyS1Title",
      subSections: [
        { titleKey: "privacyS1aTitle", items: [
          { boldKey: "privacyS1aItem1Bold", textKey: "privacyS1aItem1" },
          { boldKey: "privacyS1aItem2Bold", textKey: "privacyS1aItem2" },
          { boldKey: "privacyS1aItem3Bold", textKey: "privacyS1aItem3" },
          { boldKey: "privacyS1aItem4Bold", textKey: "privacyS1aItem4" },
          { boldKey: "privacyS1aItem5Bold", textKey: "privacyS1aItem5" },
        ]},
        { titleKey: "privacyS1bTitle", items: [
          { boldKey: "privacyS1bItem1Bold", textKey: "privacyS1bItem1" },
          { boldKey: "privacyS1bItem2Bold", textKey: "privacyS1bItem2" },
          { boldKey: "privacyS1bItem3Bold", textKey: "privacyS1bItem3" },
          { boldKey: "privacyS1bItem4Bold", textKey: "privacyS1bItem4" },
          { boldKey: "privacyS1bItem5Bold", textKey: "privacyS1bItem5" },
        ]},
      ],
    },
    { titleKey: "privacyS2Title", bodyKey: "privacyS2Body", items: [
      { boldKey: "privacyS2Item1Bold", textKey: "privacyS2Item1" },
      { boldKey: "privacyS2Item2Bold", textKey: "privacyS2Item2" },
      { boldKey: "privacyS2Item3Bold", textKey: "privacyS2Item3" },
      { boldKey: "privacyS2Item4Bold", textKey: "privacyS2Item4" },
      { boldKey: "privacyS2Item5Bold", textKey: "privacyS2Item5" },
      { boldKey: "privacyS2Item6Bold", textKey: "privacyS2Item6" },
      { boldKey: "privacyS2Item7Bold", textKey: "privacyS2Item7" },
    ]},
    { titleKey: "privacyS3Title", bodyKey: "privacyS3Body", bodyBold: true, items: [
      { boldKey: "privacyS3Item1Bold", textKey: "privacyS3Item1" },
      { boldKey: "privacyS3Item2Bold", textKey: "privacyS3Item2" },
      { boldKey: "privacyS3Item3Bold", textKey: "privacyS3Item3" },
      { boldKey: "privacyS3Item4Bold", textKey: "privacyS3Item4" },
      { boldKey: "privacyS3Item5Bold", textKey: "privacyS3Item5" },
    ]},
    { titleKey: "privacyS4Title", bodyKey: "privacyS4Body", items: [
      { boldKey: "privacyS4Item1Bold", textKey: "privacyS4Item1" },
      { boldKey: "privacyS4Item2Bold", textKey: "privacyS4Item2" },
      { boldKey: "privacyS4Item3Bold", textKey: "privacyS4Item3" },
      { boldKey: "privacyS4Item4Bold", textKey: "privacyS4Item4" },
      { boldKey: "privacyS4Item5Bold", textKey: "privacyS4Item5" },
    ], noteKey: "privacyS4Note" },
    { titleKey: "privacyS5Title", items: [
      { boldKey: "privacyS5Item1Bold", textKey: "privacyS5Item1" },
      { boldKey: "privacyS5Item2Bold", textKey: "privacyS5Item2" },
      { boldKey: "privacyS5Item3Bold", textKey: "privacyS5Item3" },
      { boldKey: "privacyS5Item4Bold", textKey: "privacyS5Item4" },
      { boldKey: "privacyS5Item5Bold", textKey: "privacyS5Item5" },
    ]},
    { titleKey: "privacyS6Title", bodyKey: "privacyS6Body", items: [
      { boldKey: "privacyS6Item1Bold", textKey: "privacyS6Item1" },
      { boldKey: "privacyS6Item2Bold", textKey: "privacyS6Item2" },
      { boldKey: "privacyS6Item3Bold", textKey: "privacyS6Item3" },
      { boldKey: "privacyS6Item4Bold", textKey: "privacyS6Item4" },
      { boldKey: "privacyS6Item5Bold", textKey: "privacyS6Item5" },
      { boldKey: "privacyS6Item6Bold", textKey: "privacyS6Item6" },
      { boldKey: "privacyS6Item7Bold", textKey: "privacyS6Item7" },
    ], noteKey: "privacyS6Note" },
    { titleKey: "privacyS7Title", items: [
      { boldKey: "privacyS7Item1Bold", textKey: "privacyS7Item1" },
      { boldKey: "privacyS7Item2Bold", textKey: "privacyS7Item2" },
      { boldKey: "privacyS7Item3Bold", textKey: "privacyS7Item3" },
    ], noteKey: "privacyS7Note" },
    { titleKey: "privacyS8Title", bodyKey: "privacyS8Body", items: [
      { boldKey: "privacyS8Item1Bold", textKey: "privacyS8Item1" },
      { boldKey: "privacyS8Item2Bold", textKey: "privacyS8Item2" },
      { boldKey: "privacyS8Item3Bold", textKey: "privacyS8Item3" },
    ], noteKey: "privacyS8Note" },
    { titleKey: "privacyS9Title", bodyKey: "privacyS9Body", items: [
      { boldKey: "privacyS9Item1Bold", textKey: "privacyS9Item1" },
      { boldKey: "privacyS9Item2Bold", textKey: "privacyS9Item2" },
      { boldKey: "privacyS9Item3Bold", textKey: "privacyS9Item3" },
      { boldKey: "privacyS9Item4Bold", textKey: "privacyS9Item4" },
    ]},
    { titleKey: "privacyS10Title", bodyKey: "privacyS10Body", items: [
      { textKey: "privacyS10Item1" }, { textKey: "privacyS10Item2" }, { textKey: "privacyS10Item3" },
    ]},
    { titleKey: "privacyS11Title", bodyKey: "privacyS11Body" },
    { titleKey: "privacyS12Title", bodyKey: "privacyS12Body" },
    { titleKey: "privacyS13Title", bodyKey: "privacyS13Body", items: [
      { textKey: "privacyS13Item1" }, { textKey: "privacyS13Item2" }, { textKey: "privacyS13Item3" },
    ]},
    { titleKey: "privacyS14Title", items: [
      { textKey: "privacyS14Item1" }, { textKey: "privacyS14Item2" }, { textKey: "privacyS14Item3" }, { textKey: "privacyS14Item4" },
    ]},
    { titleKey: "privacyS15Title", bodyKey: "privacyS15Body", contact: true, noteKey: "privacyS15Note" },
  ];

  const renderItems = (items: Item[]) => (
    <ul className="list-disc pl-6 space-y-2">
      {items.map((item, j) => (
        <li key={j}>
          {item.boldKey && <strong className="text-white">{t(item.boldKey)}</strong>}{item.boldKey ? " " : ""}{t(item.textKey)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <SEO title={t("privacySeoTitle")} description={t("privacySeoDesc")} canonical="https://tradifyapp.com/privacy" />
      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-primary h-8 w-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">{t("privacyTitle")}</h1>
      </div>

      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-sm text-slate-500">{t("lastUpdated", { date: "February 3, 2026" })}</p>

        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl mb-8">
          <p className="text-white font-medium">{t("privacyIntro")}</p>
        </div>

        {sections.map((sec, i) => (
          <section key={i}>
            <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t(sec.titleKey)}</h2>
            {sec.subSections && sec.subSections.map((sub, k) => (
              <div key={k}>
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">{t(sub.titleKey)}</h3>
                {renderItems(sub.items)}
              </div>
            ))}
            {sec.bodyKey && (
              <p className={sec.bodyBold ? "font-semibold text-white" : ""}>{t(sec.bodyKey)}</p>
            )}
            {sec.titleKey === "privacyS11Title" && (
              <>
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">{t("privacyS11GdprTitle")}</h3>
                {renderItems([
                  { boldKey: "privacyS11GdprItem1Bold", textKey: "privacyS11GdprItem1" },
                  { boldKey: "privacyS11GdprItem2Bold", textKey: "privacyS11GdprItem2" },
                  { boldKey: "privacyS11GdprItem3Bold", textKey: "privacyS11GdprItem3" },
                ])}
                <h3 className="text-lg font-semibold text-white mt-4 mb-2">{t("privacyS11CcpaTitle")}</h3>
                {renderItems([
                  { boldKey: "privacyS11CcpaItem1Bold", textKey: "privacyS11CcpaItem1" },
                  { boldKey: "privacyS11CcpaItem2Bold", textKey: "privacyS11CcpaItem2" },
                  { boldKey: "privacyS11CcpaItem3Bold", textKey: "privacyS11CcpaItem3" },
                  { boldKey: "privacyS11CcpaItem4Bold", textKey: "privacyS11CcpaItem4" },
                ])}
                <p className="mt-3">{t("privacyS11Note")}</p>
              </>
            )}
            {sec.items && sec.items.length > 0 && !sec.subSections && (
              <ul className={`list-disc pl-6 ${sec.bodyKey ? "mt-3" : ""} space-y-2`}>
                {sec.items.map((item, j) => (
                  <li key={j}>
                    {item.boldKey && <strong className="text-white">{t(item.boldKey)}</strong>}{item.boldKey ? " " : ""}{t(item.textKey)}
                  </li>
                ))}
              </ul>
            )}
            {sec.noteKey && <p className="mt-3 text-sm">{t(sec.noteKey)}</p>}
            {sec.contact && (
              <>
                <p className="mt-2"><strong className="text-white">{t("contactEmailLabel")}</strong> {t("supportEmail")}</p>
                <p><strong className="text-white">{t("contactWebsiteLabel")}</strong> {t("websiteUrl")}</p>
              </>
            )}
          </section>
        ))}

        <div className="border-t border-slate-700 pt-6 mt-8">
          <p className="text-sm text-slate-500">{t("privacyAcknowledgment")}</p>
        </div>
      </div>
    </div>
  );
}
