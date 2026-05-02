import { ShieldCheck, Check, X, ArrowRight, ExternalLink, Crown, Zap, Star, Sparkles, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePlan } from "@/hooks/usePlan";
import { useQuery } from "@tanstack/react-query";
import { PLAN_CONFIGS, type BillingPeriod } from "@shared/plans";
import type { UserRole } from "@shared/schema";
import { SEO } from "@/components/SEO";
import { useState } from "react";

export default function Pricing() {
  const { t } = useTranslation();
  const { isPro, isElite, isPaid, tier } = usePlan();

  const features = [
    { name: t("pricing.feat_mt5Sync"), free: true, pro: true, elite: true },
    { name: t("pricing.feat_openPositions"), free: true, pro: true, elite: true },
    { name: t("pricing.feat_riskCalc"), free: true, pro: true, elite: true },
    { name: t("pricing.feat_psychology"), free: true, pro: true, elite: true },
    { name: t("pricing.feat_csvImport"), free: true, pro: true, elite: true },
    { name: t("pricing.feat_dashboardCustom"), free: true, pro: true, elite: true },
    { name: t("pricing.feat_oneStrategy"), free: true, pro: true, elite: true },
    { name: t("pricing.feat_tradeHistory"), free: t("pricing.feat_30days"), pro: t("pricing.feat_6months"), elite: t("pricing.feat_unlimited") },
    { name: t("pricing.feat_education"), free: t("pricing.feat_3lessons"), pro: t("pricing.feat_fullHub"), elite: t("pricing.feat_fullHub") },
    { name: t("pricing.feat_unlimitedStrategies"), free: false, pro: true, elite: true },
    { name: t("pricing.feat_perfIntel"), free: false, pro: true, elite: true },
    { name: t("pricing.feat_equityCurve"), free: false, pro: true, elite: true },
    { name: t("pricing.feat_aiInstrument"), free: false, pro: true, elite: true },
    { name: t("pricing.feat_aiPsych"), free: false, pro: true, elite: true },
    { name: t("pricing.feat_propFirm"), free: false, pro: true, elite: true },
    { name: t("pricing.feat_csvExport"), free: false, pro: true, elite: true },
    { name: t("pricing.feat_pdfReport"), free: false, pro: true, elite: true },
    { name: t("pricing.feat_aiRiskWarn"), free: false, pro: false, elite: true },
    { name: t("pricing.feat_sessionAnalytics"), free: false, pro: false, elite: true },
    { name: t("pricing.feat_timePattern"), free: false, pro: false, elite: true },
    { name: t("pricing.feat_behavioralFlags"), free: false, pro: false, elite: true },
    { name: t("pricing.feat_strategyDeviation"), free: false, pro: false, elite: true },
    { name: t("pricing.feat_monthlyReview"), free: false, pro: false, elite: true },
    { name: t("pricing.feat_prioritySupport"), free: false, pro: false, elite: true },
    { name: t("pricing.feat_eliteBadge"), free: false, pro: false, elite: true },
  ];

  const proConfig = PLAN_CONFIGS.PRO;
  const eliteConfig = PLAN_CONFIGS.ELITE;
  const coachConfig = PLAN_CONFIGS.COACH;
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  const { data: user } = useQuery<UserRole>({
    queryKey: ["/api/user"],
  });

  const isFoundingMember = user?.foundingMember === true;
  const discountRate = 0.30;

  const isAnnual = billingPeriod === "annual";
  const proMonthlyPrice = isFoundingMember ? Math.round(proConfig.pricing.monthly * (1 - discountRate)) : proConfig.pricing.monthly;
  const proAnnualPrice = isFoundingMember ? Math.round(proConfig.pricing.annual * (1 - discountRate)) : proConfig.pricing.annual;
  const proAnnualMonthly = isFoundingMember ? Math.round(proConfig.pricing.annualMonthly * (1 - discountRate)) : proConfig.pricing.annualMonthly;
  const eliteMonthlyPrice = isFoundingMember ? Math.round(eliteConfig.pricing.monthly * (1 - discountRate)) : eliteConfig.pricing.monthly;
  const eliteAnnualPrice = isFoundingMember ? Math.round(eliteConfig.pricing.annual * (1 - discountRate)) : eliteConfig.pricing.annual;
  const eliteAnnualMonthly = isFoundingMember ? Math.round(eliteConfig.pricing.annualMonthly * (1 - discountRate)) : eliteConfig.pricing.annualMonthly;

  const proDisplayPrice = isAnnual ? proAnnualMonthly : proMonthlyPrice;
  const eliteDisplayPrice = isAnnual ? eliteAnnualMonthly : eliteMonthlyPrice;
  const coachDisplayPrice = isAnnual ? coachConfig.pricing.annualMonthly : coachConfig.pricing.monthly;
  const isCoachUser = tier === "COACH";
  const proOriginalMonthly = proConfig.pricing.monthly;
  const eliteOriginalMonthly = eliteConfig.pricing.monthly;

  const handleManageSubscription = () => {
    window.open('https://www.paypal.com/myaccount/autopay', '_blank');
  };

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <SEO 
        title="Pricing - Free, Pro & Elite Plans | TradifyApp"
        description="Choose your TradifyApp plan. Free MT5 sync, Pro analytics at $29/mo, or Elite with AI insights at $59/mo. Founding members get 30% off forever."
        canonical="https://tradifyapp.com/pricing"
        breadcrumbs={[
          { name: "Home", url: "https://tradifyapp.com" },
          { name: "Pricing", url: "https://tradifyapp.com/pricing" }
        ]}
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "TradifyApp Pro",
            "description": "Professional trading journal with prop firm tracker, AI instrument analysis, full education hub, and 6-month trade history. Includes MT5 auto-sync, unlimited strategies, and CSV export.",
            "brand": { "@type": "Brand", "name": "TradifyApp" },
            "url": "https://tradifyapp.com/pricing",
            "offers": {
              "@type": "Offer",
              "price": "29",
              "priceCurrency": "USD",
              "priceValidUntil": "2026-12-31",
              "availability": "https://schema.org/InStock",
              "url": "https://tradifyapp.com/pricing"
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "TradifyApp Elite",
            "description": "Elite trading journal with session analytics, behavioral risk flags, strategy deviation analysis, AI monthly performance reviews, unlimited trade history, and priority support.",
            "brand": { "@type": "Brand", "name": "TradifyApp" },
            "url": "https://tradifyapp.com/pricing",
            "offers": {
              "@type": "Offer",
              "price": "59",
              "priceCurrency": "USD",
              "priceValidUntil": "2026-12-31",
              "availability": "https://schema.org/InStock",
              "url": "https://tradifyapp.com/pricing"
            }
          }
        ]}
      />
      <main className="p-6 lg:p-10 max-w-6xl mx-auto">
        <header className="text-center mb-10">
          <p className="text-muted-foreground max-w-2xl mx-auto uppercase text-[10px] font-bold tracking-[0.2em] mb-4">
            {t("pricing.disclaimer")}
          </p>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase italic mb-4">
            {t("pricing.headerTitle")} <span className="text-emerald-500">{t("pricing.headerTitleHighlight")}</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("pricing.headerSubtitle")}
          </p>
          {isFoundingMember && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Crown size={16} className="text-amber-500" />
              <span className="text-amber-500 font-bold text-sm uppercase tracking-widest">
                {t("pricing.foundingMemberBanner")}
              </span>
              <Sparkles size={14} className="text-amber-500" />
            </div>
          )}
        </header>

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-card border border-border rounded-xl p-1 shadow-lg" data-testid="billing-toggle">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                !isAnnual
                  ? "bg-emerald-500 text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-billing-monthly"
            >
              {t("pricing.monthly")}
            </button>
            <button
              onClick={() => setBillingPeriod("annual")}
              className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all relative ${
                isAnnual
                  ? "bg-emerald-500 text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-billing-annual"
            >
              {t("pricing.annual")}
              <span className={`absolute -top-2.5 -right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                isAnnual ? "bg-amber-500 text-white" : "bg-emerald-500/20 text-emerald-500"
              }`}>
                {t("pricing.save")}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {/* Free Plan */}
          <Card className="bg-card border-border shadow-2xl relative overflow-hidden group">
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={20} className="text-muted-foreground" />
                  <h3 className="text-lg font-bold text-muted-foreground uppercase tracking-widest">{t("pricing.freePlanLabel")}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-foreground">$0</span>
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">{t("pricing.perForever")}</span>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {features.filter(f => f.free).map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check size={14} className="text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{f.name}</span>
                  </div>
                ))}
              </div>

              <Button 
                variant="outline" 
                className="w-full h-12 font-bold uppercase tracking-widest text-xs border-border"
                disabled
                data-testid="button-current-free"
              >
                {tier === "FREE" ? t("pricing.currentPlan") : t("pricing.downgrade")}
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="bg-card border-emerald-500/30 shadow-2xl relative overflow-hidden group scale-[1.02]">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 uppercase tracking-widest rounded-bl-lg">
              {t("pricing.popularBadge")}
            </div>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={20} className="text-emerald-500" />
                  <h3 className="text-lg font-bold text-emerald-500 uppercase tracking-widest">{t("pricing.proPlanLabel")}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  {isFoundingMember ? (
                    <>
                      <span className="text-4xl font-black text-emerald-500">${proDisplayPrice}</span>
                      <span className="text-lg text-muted-foreground line-through ml-1">${isAnnual ? proConfig.pricing.annualMonthly : proOriginalMonthly}</span>
                    </>
                  ) : (
                    <span className="text-4xl font-black text-foreground">${proDisplayPrice}</span>
                  )}
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">{t("pricing.perMonth")}</span>
                </div>
                {isAnnual && (
                  <p className="text-emerald-500 text-xs font-bold mt-1">
                    ${isFoundingMember ? proAnnualPrice : proConfig.pricing.annual}{t("pricing.yearSuffix")} — {t("pricing.saveSuffix")} ${isFoundingMember ? Math.round(proConfig.pricing.annualSavings * (1 - discountRate)) : proConfig.pricing.annualSavings}{t("pricing.yearSuffix")}
                  </p>
                )}
                {isFoundingMember && (
                  <Badge className="mt-2 bg-amber-500/20 text-amber-500 border-amber-500/30 text-[9px] uppercase tracking-widest">
                    <Crown size={10} className="mr-1" /> {t("pricing.founderDiscount")}
                  </Badge>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <div className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest mb-2">{t("pricing.everythingInFree")}</div>
                {features.filter(f => f.pro && !f.free).map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check size={14} className="text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-foreground font-medium">{f.name}</span>
                  </div>
                ))}
              </div>

              {isPro ? (
                <Button 
                  onClick={handleManageSubscription}
                  className="w-full h-12 bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-xs"
                  data-testid="button-manage-pro"
                >
                  {t("pricing.manageSubscription")}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              ) : isElite ? (
                <Button 
                  variant="outline"
                  className="w-full h-12 font-bold uppercase tracking-widest text-xs border-border"
                  disabled
                  data-testid="button-downgrade-pro"
                >
                  {t("pricing.downgrade")}
                </Button>
              ) : (
                <Button 
                  className="w-full h-12 bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-xs"
                  data-testid="button-upgrade-pro"
                  onClick={() => window.location.href = `/checkout?plan=PRO&period=${billingPeriod}`}
                >
                  {t("pricing.upgradeToPro")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Elite Plan */}
          <Card className="bg-gradient-to-b from-amber-500/10 to-card border-amber-500/30 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black px-3 py-1 uppercase tracking-widest rounded-bl-lg">
              {t("pricing.eliteBadge")}
            </div>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={20} className="text-amber-500" />
                  <h3 className="text-lg font-bold text-amber-500 uppercase tracking-widest">{t("pricing.elitePlanLabel")}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  {isFoundingMember ? (
                    <>
                      <span className="text-4xl font-black text-amber-500">${eliteDisplayPrice}</span>
                      <span className="text-lg text-muted-foreground line-through ml-1">${isAnnual ? eliteConfig.pricing.annualMonthly : eliteOriginalMonthly}</span>
                    </>
                  ) : (
                    <span className="text-4xl font-black text-foreground">${eliteDisplayPrice}</span>
                  )}
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">{t("pricing.perMonth")}</span>
                </div>
                {isAnnual && (
                  <p className="text-amber-500 text-xs font-bold mt-1">
                    ${isFoundingMember ? eliteAnnualPrice : eliteConfig.pricing.annual}{t("pricing.yearSuffix")} — {t("pricing.saveSuffix")} ${isFoundingMember ? Math.round(eliteConfig.pricing.annualSavings * (1 - discountRate)) : eliteConfig.pricing.annualSavings}{t("pricing.yearSuffix")}
                  </p>
                )}
                {isFoundingMember && (
                  <Badge className="mt-2 bg-amber-500/20 text-amber-500 border-amber-500/30 text-[9px] uppercase tracking-widest">
                    <Crown size={10} className="mr-1" /> {t("pricing.founderDiscount")}
                  </Badge>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <div className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest mb-2">{t("pricing.everythingInPro")}</div>
                {features.filter(f => f.elite && !f.pro).map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check size={14} className="text-amber-500 flex-shrink-0" />
                    <span className="text-sm text-foreground font-medium">{f.name}</span>
                  </div>
                ))}
              </div>

              {tier === "ELITE" ? (
                <Button 
                  onClick={handleManageSubscription}
                  className="w-full h-12 bg-amber-500 text-white font-black uppercase tracking-[0.15em] text-xs"
                  data-testid="button-manage-elite"
                >
                  {t("pricing.manageSubscription")}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              ) : isCoachUser ? (
                <Button variant="outline" className="w-full h-12 font-bold uppercase tracking-widest text-xs border-border" disabled data-testid="button-downgrade-elite">
                  {t("pricing.downgrade")}
                </Button>
              ) : (
                <Button 
                  className="w-full h-12 bg-amber-500 text-white font-black uppercase tracking-[0.15em] text-xs"
                  data-testid="button-upgrade-elite"
                  onClick={() => window.location.href = `/checkout?plan=ELITE&period=${billingPeriod}`}
                >
                  {t("pricing.upgradeToElite")}
                  <Crown className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Coach Plan */}
          <Card className="bg-gradient-to-b from-violet-500/10 to-card border-violet-500/30 shadow-2xl relative overflow-hidden group" data-testid="card-coach-plan">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white text-[10px] font-black px-3 py-1 uppercase tracking-widest rounded-bl-lg">
              For Mentors
            </div>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap size={20} className="text-violet-500" />
                  <h3 className="text-lg font-bold text-violet-500 uppercase tracking-widest">{coachConfig.name}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-foreground">${coachDisplayPrice}</span>
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">{t("pricing.perMonth")}</span>
                </div>
                {isAnnual && (
                  <p className="text-violet-500 text-xs font-bold mt-1">
                    ${coachConfig.pricing.annual}{t("pricing.yearSuffix")} — {t("pricing.saveSuffix")} ${coachConfig.pricing.annualSavings}{t("pricing.yearSuffix")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">{coachConfig.description}</p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="text-[10px] font-black text-violet-500/70 uppercase tracking-widest mb-2">Everything in Elite, plus</div>
                {coachConfig.displayFeatures.slice(1).map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check size={14} className="text-violet-500 flex-shrink-0" />
                    <span className="text-sm text-foreground font-medium">{f}</span>
                  </div>
                ))}
              </div>

              {isCoachUser ? (
                <Button 
                  onClick={handleManageSubscription}
                  className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-white font-black uppercase tracking-[0.15em] text-xs"
                  data-testid="button-manage-coach"
                >
                  {t("pricing.manageSubscription")}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  className="w-full h-12 bg-violet-500 hover:bg-violet-600 text-white font-black uppercase tracking-[0.15em] text-xs"
                  data-testid="button-upgrade-coach"
                  onClick={() => window.location.href = `/checkout?plan=COACH&period=${billingPeriod}`}
                >
                  Become a Coach
                  <GraduationCap className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comparison Section */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10 uppercase tracking-widest">{t("pricing.fullComparison")}</h2>
          <div className="bg-card border border-border rounded-2xl overflow-x-auto shadow-2xl">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest">{t("pricing.compareFeatures")}</th>
                  <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest text-center">{t("pricing.freePlanLabel")}</th>
                  <th className="p-4 text-xs font-black text-emerald-500 uppercase tracking-widest text-center">{t("pricing.proPlanLabel")}</th>
                  <th className="p-4 text-xs font-black text-amber-500 uppercase tracking-widest text-center">{t("pricing.elitePlanLabel")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {features.map((f, i) => {
                  const renderValue = (val: boolean | string, isElite = false) => {
                    if (typeof val === 'string') {
                      return <span className={`text-xs font-medium ${isElite ? 'text-amber-500' : 'text-emerald-500'}`}>{val}</span>;
                    }
                    return val 
                      ? <Check size={16} className={`${isElite ? 'text-amber-500' : 'text-emerald-500'} mx-auto`} /> 
                      : <X size={16} className="text-muted-foreground mx-auto" />;
                  };
                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 text-sm text-muted-foreground font-medium">{f.name}</td>
                      <td className="p-4 text-center">{renderValue(f.free)}</td>
                      <td className="p-4 text-center">{renderValue(f.pro)}</td>
                      <td className="p-4 text-center">{renderValue(f.elite, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trust Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            { title: t("pricing.trustNoCreds"), desc: t("pricing.trustNoCredsDesc") },
            { title: t("pricing.trustCancel"), desc: t("pricing.trustCancelDesc") },
            { title: t("pricing.trustData"), desc: t("pricing.trustDataDesc") },
          ].map((item, i) => (
            <div key={i} className="bg-card border border-border p-6 rounded-2xl text-center">
              <ShieldCheck size={24} className="text-emerald-500 mx-auto mb-4" />
              <h4 className="font-bold text-foreground mb-2">{item.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center pb-20">
          <h3 className="text-2xl font-bold text-foreground mb-6">{t("pricing.ctaTitle")}</h3>
          {isPaid ? (
            <Button 
              onClick={handleManageSubscription}
              className="h-14 px-10 bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-xs shadow-xl shadow-emerald-500/20"
              data-testid="button-manage-account"
            >
              {t("pricing.manageAccount")}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              className="h-14 px-10 bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-xs shadow-xl shadow-emerald-500/20"
              data-testid="button-start-pro-trial"
              onClick={() => window.location.href = `/checkout?plan=PRO&period=${billingPeriod}`}
            >
              {t("pricing.ctaButton")}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
