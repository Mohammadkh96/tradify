import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Zap, Gift, Users, ArrowRight, Sparkles, Shield, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNavbar } from "@/components/PublicNavbar";
import { SEO } from "@/components/SEO";
import { useTranslation, Trans } from "react-i18next";

interface FounderCount {
  claimed: number;
  remaining: number;
  total: number;
  isFull: boolean;
}

export default function EarlyAccess() {
  const { t } = useTranslation("common", { keyPrefix: "earlyAccess" });
  const [founderCount, setFounderCount] = useState<FounderCount | null>(null);

  useEffect(() => {
    fetch("/api/founding-members/count", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setFounderCount(d))
      .catch(() => {});
  }, []);

  const progressPct = founderCount ? (founderCount.claimed / founderCount.total) * 100 : 0;

  const benefits = [
    { icon: Zap, title: t("benefit1Title"), description: t("benefit1Desc") },
    { icon: Gift, title: t("benefit2Title"), description: t("benefit2Desc") },
    { icon: Users, title: t("benefit3Title"), description: t("benefit3Desc") },
    { icon: Shield, title: t("benefit4Title"), description: t("benefit4Desc") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("seoTitle")}
        description={t("seoDesc")}
        canonical="https://tradifyapp.com/early-access"
      />
      <PublicNavbar />

      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-bold uppercase tracking-widest">{t("programBadge")}</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-foreground uppercase italic tracking-tighter mb-6">
              {t("headlinePart1")} <span className="text-emerald-500">{t("headlineHighlight")}</span>
            </h1>

            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              <Trans i18nKey="subheading" ns="earlyAccess" components={{ strong: <span className="text-foreground font-bold" /> }} />
            </p>
          </div>

          {/* Live Countdown Card */}
          <Card className="bg-gradient-to-b from-amber-500/10 to-card border-amber-500/30 overflow-hidden mb-10">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <Crown className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                <h3 className="text-2xl font-black text-foreground uppercase tracking-tight mb-1">
                  {founderCount
                    ? founderCount.isFull
                      ? t("allClaimed")
                      : t("spotsRemaining", { count: founderCount.remaining })
                    : t("loading")}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {founderCount
                    ? t("spotsClaimedOf", { claimed: founderCount.claimed, total: founderCount.total })
                    : t("fetchingCount")}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  <span>0</span>
                  <span>{t("percentClaimed", { percent: founderCount ? Math.round(progressPct) : 0 })}</span>
                  <span>500</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">
                    {t("claimedLabel", { count: founderCount ? founderCount.claimed : "—" })}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    {t("leftLabel", { count: founderCount ? founderCount.remaining : "—" })}
                  </span>
                </div>
              </div>

              {founderCount?.isFull ? (
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-4">{t("fullDesc")}</p>
                  <Link to="/signup">
                    <Button className="bg-muted text-foreground font-black uppercase tracking-widest px-10 h-12" data-testid="button-signup-after-cap">
                      {t("btnSignupAfterCap")} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-5">
                    <Trans i18nKey="noEmailNeeded" ns="earlyAccess" components={{ strong: <span className="text-amber-500 font-bold" /> }} />
                  </p>
                  <Link to="/signup">
                    <Button className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-sm px-10 h-14 shadow-xl shadow-amber-500/20" data-testid="button-claim-founding-spot">
                      <Crown className="mr-2 h-4 w-4" />
                      {t("btnClaimSpot")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <p className="text-[10px] text-muted-foreground mt-3 font-bold uppercase tracking-widest">
                    {t("freeNoCard")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Benefits Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {benefits.map((benefit, index) => (
              <Card key={index} className="bg-card/50 border-border">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              {t("alreadyHaveAccount")}{" "}
              <Link to="/login" className="text-emerald-500 font-bold hover:underline">
                {t("signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-border py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-slate-950" />
            </div>
            <span className="font-black text-xl text-foreground uppercase italic tracking-tighter">TRADIFY</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("footerTagline")}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">{t("linkTerms")}</Link>
            <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">{t("linkPrivacy")}</Link>
            <Link to="/risk-disclaimer" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">{t("linkRiskDisclaimer")}</Link>
            <Link to="/cookie-policy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">{t("linkCookiePolicy")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
