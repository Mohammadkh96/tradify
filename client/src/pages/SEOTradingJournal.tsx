import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  FileText,
  MonitorSmartphone,
  Brain,
  Target,
  Trophy,
  ChevronRight,
  Upload,
  HeartPulse
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

export default function SEOTradingJournal() {
  const { t } = useTranslation("common");
  const ts = (k: string) => t(`seo.${k}`);

  const features = [
    { titleKey: "journalFeat1Title", descKey: "journalFeat1Desc", icon: <MonitorSmartphone className="text-cyan-500" /> },
    { titleKey: "journalFeat2Title", descKey: "journalFeat2Desc", icon: <ShieldCheck className="text-blue-500" /> },
    { titleKey: "journalFeat3Title", descKey: "journalFeat3Desc", icon: <Brain className="text-emerald-500" /> },
    { titleKey: "journalFeat4Title", descKey: "journalFeat4Desc", icon: <HeartPulse className="text-pink-500" /> },
    { titleKey: "journalFeat5Title", descKey: "journalFeat5Desc", icon: <Upload className="text-teal-500" /> },
    { titleKey: "journalFeat6Title", descKey: "journalFeat6Desc", icon: <BarChart3 className="text-purple-500" /> },
  ];

  const steps = [
    { step: "01", titleKey: "journalStep1Title", descKey: "journalStep1Desc" },
    { step: "02", titleKey: "journalStep2Title", descKey: "journalStep2Desc" },
    { step: "03", titleKey: "journalStep3Title", descKey: "journalStep3Desc" },
  ];

  const personas = [
    {
      titleKey: "journalPersona1Title", descKey: "journalPersona1Desc",
      icon: <TrendingUp className="text-emerald-500" size={28} />,
      featKeys: ["journalPersona1Feat1","journalPersona1Feat2","journalPersona1Feat3","journalPersona1Feat4"]
    },
    {
      titleKey: "journalPersona2Title", descKey: "journalPersona2Desc",
      icon: <Target className="text-amber-500" size={28} />,
      featKeys: ["journalPersona2Feat1","journalPersona2Feat2","journalPersona2Feat3","journalPersona2Feat4"]
    },
    {
      titleKey: "journalPersona3Title", descKey: "journalPersona3Desc",
      icon: <Trophy className="text-blue-500" size={28} />,
      featKeys: ["journalPersona3Feat1","journalPersona3Feat2","journalPersona3Feat3","journalPersona3Feat4"]
    },
  ];

  const faqs = [1,2,3,4,5].map(i => ({ q: `journalFaq${i}Q`, a: `journalFaq${i}A` }));

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title={ts("journalTitle")}
        description={ts("journalDesc")}
        canonical="https://tradifyapp.com/trading-journal"
        ogImage="https://tradifyapp.com/images/tradify-promo-1.png"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "TradifyApp Trading Journal",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "Automated MT5 trading journal with rule validation, AI analytics, psychology tracking, and performance insights.",
            "url": "https://tradifyapp.com/trading-journal",
            "offers": [
              { "@type": "Offer", "price": "0", "priceCurrency": "USD", "name": "Free Plan" },
              { "@type": "Offer", "price": "29", "priceCurrency": "USD", "name": "Pro Plan" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tradifyapp.com" },
              { "@type": "ListItem", "position": 2, "name": "Trading Journal", "item": "https://tradifyapp.com/trading-journal" }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              { "@type": "Question", "name": "What is a trading journal?", "acceptedAnswer": { "@type": "Answer", "text": "A trading journal is a systematic record of all your trades, including entry/exit prices, position sizes, strategy used, emotional state, and outcome. It helps traders identify patterns in their behavior and performance to improve decision-making over time." } },
              { "@type": "Question", "name": "Why do I need an automated trading journal?", "acceptedAnswer": { "@type": "Answer", "text": "Manual journaling is time-consuming and prone to errors. An automated trading journal like TradifyApp syncs directly with MT5, capturing every trade instantly with accurate data. This eliminates manual entry errors and ensures you never miss logging a trade." } },
              { "@type": "Question", "name": "How does TradifyApp's MT5 journal sync work?", "acceptedAnswer": { "@type": "Answer", "text": "TradifyApp uses a free Expert Advisor (EA) installed on your MT5 platform. It runs in the background, reading your trade data in real-time and sending it to your TradifyApp journal automatically. The EA is strictly read-only and never places trades." } },
              { "@type": "Question", "name": "Can I use TradifyApp as a forex trading journal?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. TradifyApp is designed for forex, gold, indices, and any instrument traded on MT5. It tracks all currency pairs, provides instrument-specific analytics, and supports multi-account journaling for traders who trade across multiple brokers." } }
            ]
          }
        ]}
      />
      <PublicNavbar />

      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <FileText size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{ts("journalHeroBadge")}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]" data-testid="text-seo-journal-heading">
            {ts("journalHeroTitle1")}<br />
            <span className="text-emerald-500">{ts("journalHeroTitle2")}</span><br />
            {ts("journalHeroTitle3")}
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {ts("journalHeroSub")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/signup" data-testid="link-seo-journal-signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20" data-testid="button-seo-journal-signup">
                {ts("journalHeroCtaPrimary")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/features" data-testid="link-seo-journal-features">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted" data-testid="button-seo-journal-features">
                {ts("journalHeroCtaSecondary")}
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            {ts("journalHeroDisclaimer")}
          </p>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-journal-why">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {ts("journalWhyTitle1")} <span className="text-emerald-500">{ts("journalWhyTitle2")}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {ts("journalWhySub")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-journal-feature-${i}`}>
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-2">{ts(feature.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ts(feature.descKey)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-journal-how-it-works">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {ts("journalHowTitle1")} <span className="text-emerald-500">{ts("journalHowTitle2")}</span> {ts("journalHowTitle3")}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {ts("journalHowSub")}
            </p>
          </div>

          <div className="space-y-8">
            {steps.map((item, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-black text-sm shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{ts(item.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ts(item.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-journal-who">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {ts("journalWhoTitle1")} <span className="text-emerald-500">{ts("journalWhoTitle2")}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {personas.map((persona, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-journal-persona-${i}`}>
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6">
                    {persona.icon}
                  </div>
                  <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-3">{ts(persona.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{ts(persona.descKey)}</p>
                  <div className="space-y-2">
                    {persona.featKeys.map((fk, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        {ts(fk)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-journal-faq">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {ts("journalFaqTitle1")} <span className="text-emerald-500">{ts("journalFaqTitle2")}</span>
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl overflow-hidden" data-testid={`faq-journal-${i}`}>
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

      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-journal-cta">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase mb-6">
            {ts("journalCtaTitle1")}<br />{ts("journalCtaTitle2")} <span className="text-emerald-500">{ts("journalCtaTitle3")}</span>.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            {ts("journalCtaSub")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup" data-testid="link-journal-cta-signup">
              <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400" data-testid="button-journal-cta-signup">
                {ts("journalCtaPrimary")}
              </Button>
            </Link>
            <Link to="/pricing" data-testid="link-journal-cta-pricing">
              <Button variant="ghost" className="h-14 px-8 text-foreground font-bold uppercase tracking-widest text-xs group" data-testid="button-journal-cta-pricing">
                {ts("ctaCompare")} <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 border-t border-border" data-testid="section-journal-related">
        <div className="max-w-4xl mx-auto px-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6 text-center">{ts("relatedToolsHeading")}</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/prop-firm-tracker" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-prop">
              {ts("relatedProp")}
            </Link>
            <span className="text-border">|</span>
            <Link to="/mt5-trading-analytics" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-analytics">
              {ts("relatedAnalytics")}
            </Link>
            <span className="text-border">|</span>
            <Link to="/features" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-features">
              {ts("relatedFeatures")}
            </Link>
            <span className="text-border">|</span>
            <Link to="/pricing" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-pricing">
              {ts("relatedPricing")}
            </Link>
            <span className="text-border">|</span>
            <Link to="/blog" className="text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest" data-testid="link-journal-related-blog">
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
