import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Brain,
  Clock,
  Target,
  ChevronRight,
  Activity,
  LineChart,
  MonitorSmartphone,
  PieChart
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

export default function SEOMT5Analytics() {
  const { t } = useTranslation("common");
  const ts = (k: string) => t(`seo.${k}`);

  const features = [
    { titleKey: "analyticsFeat1Title", descKey: "analyticsFeat1Desc", icon: <LineChart className="text-emerald-500" />, tier: "Free" },
    { titleKey: "analyticsFeat2Title", descKey: "analyticsFeat2Desc", icon: <PieChart className="text-blue-500" />, tier: "Free" },
    { titleKey: "analyticsFeat3Title", descKey: "analyticsFeat3Desc", icon: <Target className="text-amber-500" />, tier: "Free" },
    { titleKey: "analyticsFeat4Title", descKey: "analyticsFeat4Desc", icon: <Brain className="text-emerald-500" />, tier: "Pro" },
    { titleKey: "analyticsFeat5Title", descKey: "analyticsFeat5Desc", icon: <Clock className="text-purple-500" />, tier: "Elite" },
    { titleKey: "analyticsFeat6Title", descKey: "analyticsFeat6Desc", icon: <Activity className="text-rose-500" />, tier: "Elite" },
  ];

  const tracked = ["analyticsTracked1","analyticsTracked2","analyticsTracked3","analyticsTracked4","analyticsTracked5","analyticsTracked6","analyticsTracked7","analyticsTracked8"];
  const insights = ["analyticsInsight1","analyticsInsight2","analyticsInsight3","analyticsInsight4","analyticsInsight5","analyticsInsight6","analyticsInsight7","analyticsInsight8"];
  const tags = ["analyticsHeroTag1","analyticsHeroTag2","analyticsHeroTag3","analyticsHeroTag4","analyticsHeroTag5","analyticsHeroTag6"];
  const multi = [
    { tk: "analyticsMulti1Title", dk: "analyticsMulti1Desc" },
    { tk: "analyticsMulti2Title", dk: "analyticsMulti2Desc" },
    { tk: "analyticsMulti3Title", dk: "analyticsMulti3Desc" },
  ];
  const faqs = [1,2,3,4,5].map(i => ({ q: `analyticsFaq${i}Q`, a: `analyticsFaq${i}A` }));

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title={ts("analyticsTitle")}
        description={ts("analyticsDesc")}
        canonical="https://tradifyapp.com/mt5-trading-analytics"
        ogImage="https://tradifyapp.com/images/tradify-promo-1.png"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "TradifyApp MT5 Trading Analytics",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "AI-powered MT5 trading analytics with equity curves, session analysis, behavioral insights, and performance tracking.",
            "url": "https://tradifyapp.com/mt5-trading-analytics",
            "offers": [
              { "@type": "Offer", "price": "0", "priceCurrency": "USD", "name": "Free Plan" },
              { "@type": "Offer", "price": "29", "priceCurrency": "USD", "name": "Pro Plan" },
              { "@type": "Offer", "price": "59", "priceCurrency": "USD", "name": "Elite Plan" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tradifyapp.com" },
              { "@type": "ListItem", "position": 2, "name": "MT5 Trading Analytics", "item": "https://tradifyapp.com/mt5-trading-analytics" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "What trading analytics does TradifyApp provide?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp provides comprehensive trading analytics including equity curves, win rate by instrument and session, risk-to-reward analysis, drawdown tracking, profit factor calculation, expectancy metrics, behavioral pattern detection, and AI-powered performance insights — all auto-synced from MT5." } },
              { "@type": "Question", "name": "How does MT5 performance tracking work?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp installs a free Expert Advisor on your MT5 platform that reads your trade data in real time. Every trade is automatically captured and analyzed — entries, exits, lot sizes, instruments, and P&L. The analytics dashboard updates continuously as new trades come in." } },
              { "@type": "Question", "name": "Can I track multiple MT5 accounts?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. TradifyApp supports multi-account connectivity. You can connect and independently track trades, equity curves, and analytics for each of your MT5 accounts from one unified dashboard." } },
              { "@type": "Question", "name": "What is session analytics in trading?", "acceptedAnswer": { "@type": "Answer", "text": "Session analytics breaks down your trading performance by market session (London, New York, Tokyo, Sydney), day of week, and hour of day. This helps you identify when you trade best and when you should avoid trading, based on your actual historical data." } }
            ]
          }
        ]}
      />
      <PublicNavbar />

      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
            <BarChart3 size={14} className="text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">{ts("analyticsHeroBadge")}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]" data-testid="text-seo-analytics-heading">
            {ts("analyticsHeroTitle1")}<br />
            <span className="text-blue-500">{ts("analyticsHeroTitle2")}</span><br />
            {ts("analyticsHeroTitle3")}
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {ts("analyticsHeroSub")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-muted/50 border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest py-1 px-3">
                {ts(tag)}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/signup" data-testid="link-seo-analytics-signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20" data-testid="button-seo-analytics-signup">
                {ts("analyticsHeroCtaPrimary")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/features" data-testid="link-seo-analytics-features">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted" data-testid="button-seo-analytics-features">
                {ts("analyticsHeroCtaSecondary")}
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            {ts("analyticsHeroDisclaimer")}
          </p>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-analytics-features">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {ts("analyticsSuiteTitle1")} <span className="text-blue-500">{ts("analyticsSuiteTitle2")}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {ts("analyticsSuiteSub")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-analytics-feature-${i}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">{ts(feature.titleKey)}</h3>
                        {feature.tier === "Pro" && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0 uppercase tracking-widest shrink-0">{ts("tierPro")}</Badge>
                        )}
                        {feature.tier === "Elite" && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] py-0 uppercase tracking-widest shrink-0">{ts("tierElite")}</Badge>
                        )}
                        {feature.tier === "Free" && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[9px] py-0 uppercase tracking-widest shrink-0">{ts("tierFree")}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{ts(feature.descKey)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-analytics-how-data-works">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {ts("analyticsRawTitle1")} <span className="text-blue-500">{ts("analyticsRawTitle2")}</span> {ts("analyticsRawTitle3")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {ts("analyticsRawSub")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-lg font-bold text-foreground uppercase tracking-widest mb-6">{ts("analyticsTrackedHeading")}</h3>
              <div className="space-y-4">
                {tracked.map((k, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{ts(k)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground uppercase tracking-widest mb-6">{ts("analyticsInsightsHeading")}</h3>
              <div className="space-y-4">
                {insights.map((k, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <BarChart3 size={14} className="text-blue-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{ts(k)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-analytics-multi-account">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-8">
            <MonitorSmartphone className="text-cyan-500" size={32} />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
            {ts("analyticsMultiTitle1")} <span className="text-cyan-500">{ts("analyticsMultiTitle2")}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            {ts("analyticsMultiSub")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {multi.map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-background border border-border">
                <h4 className="text-sm font-bold text-foreground uppercase tracking-widest mb-2">{ts(item.tk)}</h4>
                <p className="text-xs text-muted-foreground">{ts(item.dk)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-analytics-faq">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {ts("analyticsFaqTitle1")} <span className="text-blue-500">{ts("analyticsFaqTitle2")}</span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl overflow-hidden" data-testid={`faq-analytics-${i}`}>
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <span className="text-sm font-bold text-foreground pr-4">{ts(faq.q)}</span>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-sm text-muted-foreground leading-relaxed">{ts(faq.a)}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-analytics-cta">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase mb-6">
            {ts("analyticsCtaTitle1")}<br /><span className="text-blue-500">{ts("analyticsCtaTitle2")}</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            {ts("analyticsCtaSub")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup" data-testid="link-analytics-cta-signup">
              <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400" data-testid="button-analytics-cta-signup">
                {ts("analyticsCtaPrimary")}
              </Button>
            </Link>
            <Link to="/pricing" data-testid="link-analytics-cta-pricing">
              <Button variant="ghost" className="h-14 px-8 text-foreground font-bold uppercase tracking-widest text-xs group" data-testid="button-analytics-cta-pricing">
                {ts("ctaCompare")} <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border" data-testid="section-analytics-related">
        <div className="max-w-4xl mx-auto px-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6 text-center">{ts("relatedToolsHeading")}</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/trading-journal" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-journal">
              {ts("relatedJournal")}
            </Link>
            <span className="text-border">|</span>
            <Link to="/prop-firm-tracker" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-prop">
              {ts("relatedProp")}
            </Link>
            <span className="text-border">|</span>
            <Link to="/features" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-features">
              {ts("relatedFeatures")}
            </Link>
            <span className="text-border">|</span>
            <Link to="/pricing" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-pricing">
              {ts("relatedPricing")}
            </Link>
            <span className="text-border">|</span>
            <Link to="/blog" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-analytics-related-blog">
              {ts("relatedBlog")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-border text-center">
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          <Link to="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">{t("footer.terms")}</Link>
          <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">{t("footer.privacy")}</Link>
          <Link to="/risk-disclaimer" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">{t("footer.riskDisclaimer")}</Link>
          <Link to="/cookie-policy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">{t("footer.cookies")}</Link>
          <Link to="/blog" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">{t("footer.blog")}</Link>
          <CookieSettingsButton />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
          {t("footer.copyright", { year: 2026 })}
        </p>
      </footer>
    </div>
  );
}
