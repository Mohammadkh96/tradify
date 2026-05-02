import { Cookie, Shield, BarChart3, Megaphone, Lock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CookiePreferencesModal } from "@/components/CookiePreferencesModal";
import { CookiePreferences, setCookiePreferences } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

export default function CookiePolicy() {
  const { t } = useTranslation("common", { keyPrefix: "legal" });
  const [showPreferences, setShowPreferences] = useState(false);

  const handleSavePreferences = (prefs: CookiePreferences) => {
    setCookiePreferences(prefs);
    setShowPreferences(false);
  };

  return (
    <div className="flex-1 text-slate-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <SEO title={t("cookiesSeoTitle")} description={t("cookiesSeoDesc")} canonical="https://tradifyapp.com/cookie-policy" />
      <div className="flex items-center gap-3 mb-6">
        <Cookie className="text-amber-500 h-8 w-8" />
        <h1 className="text-3xl font-bold uppercase tracking-tighter">{t("cookiesTitle")}</h1>
      </div>

      <div className="prose prose-invert max-w-none text-slate-400 space-y-6">
        <p className="text-sm text-slate-500">{t("lastUpdated", { date: "February 4, 2026" })}</p>

        <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl mb-8">
          <p className="text-amber-500 font-bold uppercase tracking-widest text-sm mb-2">{t("cookiesIntroLabel")}</p>
          <p className="text-white font-medium">{t("cookiesIntro")}</p>
        </div>

        <Button onClick={() => setShowPreferences(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white mb-6" data-testid="button-manage-cookies">
          <Settings className="h-4 w-4 mr-2" />
          {t("cookiesManageBtn")}
        </Button>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t("cookiesS1Title")}</h2>
          <p>{t("cookiesS1Body1")}</p>
          <p className="mt-3">{t("cookiesS1Body2")}</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t("cookiesS2Title")}</h2>

          <div className="space-y-4 mt-4">
            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg"><Lock className="h-4 w-4 text-emerald-500" /></div>
                <h3 className="font-semibold text-white">{t("cookiesEssentialTitle")}</h3>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase">{t("cookiesEssentialBadge")}</span>
              </div>
              <p className="text-sm">{t("cookiesEssentialBody")}</p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                <li><strong className="text-white">{t("cookiesEssentialItem1Bold")}</strong> {t("cookiesEssentialItem1")}</li>
                <li><strong className="text-white">{t("cookiesEssentialItem2Bold")}</strong> {t("cookiesEssentialItem2")}</li>
                <li><strong className="text-white">{t("cookiesEssentialItem3Bold")}</strong> {t("cookiesEssentialItem3")}</li>
                <li><strong className="text-white">{t("cookiesEssentialItem4Bold")}</strong> {t("cookiesEssentialItem4")}</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/10 rounded-lg"><BarChart3 className="h-4 w-4 text-blue-500" /></div>
                <h3 className="font-semibold text-white">{t("cookiesAnalyticsTitle")}</h3>
                <span className="text-[9px] bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full font-bold uppercase">{t("cookiesAnalyticsBadge")}</span>
              </div>
              <p className="text-sm">{t("cookiesAnalyticsBody")}</p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                <li><strong className="text-white">{t("cookiesAnalyticsItem1Bold")}</strong> {t("cookiesAnalyticsItem1")}</li>
                <li><strong className="text-white">{t("cookiesAnalyticsItem2Bold")}</strong> {t("cookiesAnalyticsItem2")}</li>
                <li><strong className="text-white">{t("cookiesAnalyticsItem3Bold")}</strong> {t("cookiesAnalyticsItem3")}</li>
              </ul>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/10 rounded-lg"><Megaphone className="h-4 w-4 text-purple-500" /></div>
                <h3 className="font-semibold text-white">{t("cookiesMarketingTitle")}</h3>
                <span className="text-[9px] bg-purple-500/20 text-purple-500 px-2 py-0.5 rounded-full font-bold uppercase">{t("cookiesMarketingBadge")}</span>
              </div>
              <p className="text-sm">{t("cookiesMarketingBody")}</p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                <li><strong className="text-white">{t("cookiesMarketingItem1Bold")}</strong> {t("cookiesMarketingItem1")}</li>
                <li><strong className="text-white">{t("cookiesMarketingItem2Bold")}</strong> {t("cookiesMarketingItem2")}</li>
                <li><strong className="text-white">{t("cookiesMarketingItem3Bold")}</strong> {t("cookiesMarketingItem3")}</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t("cookiesS3Title")}</h2>
          <p>{t("cookiesS3Body1")}</p>
          <p className="mt-3">{t("cookiesS3Body2")}</p>
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg mt-4">
            <p className="font-semibold text-white mb-2">{t("cookiesBrowserTitle")}</p>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li><strong className="text-white">Chrome:</strong> {t("cookiesBrowserChrome")}</li>
              <li><strong className="text-white">Firefox:</strong> {t("cookiesBrowserFirefox")}</li>
              <li><strong className="text-white">Safari:</strong> {t("cookiesBrowserSafari")}</li>
              <li><strong className="text-white">Edge:</strong> {t("cookiesBrowserEdge")}</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t("cookiesS4Title")}</h2>
          <p>{t("cookiesS4Body")}</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li><strong className="text-white">{t("cookiesS4Item1Bold")}</strong> {t("cookiesS4Item1")}</li>
            <li><strong className="text-white">{t("cookiesS4Item2Bold")}</strong> {t("cookiesS4Item2")}</li>
            <li><strong className="text-white">{t("cookiesS4Item3Bold")}</strong> {t("cookiesS4Item3")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t("cookiesS5Title")}</h2>
          <p>{t("cookiesS5Body")}</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li><strong className="text-white">Google:</strong> <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">{t("cookiesS5LinkGoogle")}</a></li>
            <li><strong className="text-white">Facebook:</strong> <a href="https://www.facebook.com/policies/cookies/" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">{t("cookiesS5LinkFacebook")}</a></li>
            <li><strong className="text-white">PayPal:</strong> <a href="https://www.paypal.com/webapps/mpp/ua/cookie-full" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">{t("cookiesS5LinkPaypal")}</a></li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t("cookiesS6Title")}</h2>
          <p>{t("cookiesS6Body")}</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tight">{t("cookiesS7Title")}</h2>
          <p>{t("cookiesS7Body")}</p>
          <p className="mt-2"><strong className="text-white">{t("contactEmailLabel")}</strong> {t("supportEmail")}</p>
          <p><strong className="text-white">{t("contactWebsiteLabel")}</strong> {t("websiteUrl")}</p>
        </section>

        <div className="border-t border-amber-500/20 pt-6 mt-8">
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex items-center gap-4">
            <Shield className="h-8 w-8 text-amber-500 shrink-0" />
            <div>
              <p className="text-amber-400 font-semibold text-sm uppercase tracking-wide">{t("cookiesGdprLabel")}</p>
              <p className="text-white mt-1 text-sm">{t("cookiesGdprBody")}</p>
            </div>
          </div>
        </div>
      </div>

      <CookiePreferencesModal isOpen={showPreferences} onClose={() => setShowPreferences(false)} onSave={handleSavePreferences} />
    </div>
  );
}
