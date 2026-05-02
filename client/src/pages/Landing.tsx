import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Activity, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  BookOpen,
  Sparkles,
  Crown,
  Target,
  Calculator,
  Users,
  Brain,
  Clock,
  Trophy,
  MonitorSmartphone,
  Shield,
  X,
  ChevronRight,
  Flame,
  Upload,
  HeartPulse,
  Mail,
  Download,
  FileText,
  Loader2,
  Star
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";
import { captureUTMParams, getStoredUTM } from "@/lib/utm";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);
  
  return <span>{count.toLocaleString()}{suffix}</span>;
}

export default function Landing() {
  const { t } = useTranslation();
  const [activeScreenshotTab, setActiveScreenshotTab] = useState(0);
  const [checklistEmail, setChecklistEmail] = useState("");
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistSubmitted, setChecklistSubmitted] = useState(false);

  const [calcAccountSize, setCalcAccountSize] = useState("");
  const [calcDrawdown, setCalcDrawdown] = useState("");
  const [calcProfitTarget, setCalcProfitTarget] = useState("");
  const [calcEmail, setCalcEmail] = useState("");
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcSaved, setCalcSaved] = useState(false);

  const [founderCount, setFounderCount] = useState<{ claimed: number; remaining: number; total: number; isFull: boolean } | null>(null);
  const [topBannerDismissed, setTopBannerDismissed] = useState(() => sessionStorage.getItem("top_banner_dismissed") === "1");

  useEffect(() => {
    captureUTMParams();
    fetch("/api/founding-members/count", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setFounderCount(d))
      .catch(() => {});
  }, []);

  const handleChecklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecklistLoading(true);
    try {
      const utm = getStoredUTM();
      const res = await fetch("/api/leads/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: checklistEmail, ...(utm || {}) }),
      });
      if (res.ok) {
        setChecklistSubmitted(true);
      }
    } catch {
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleCalcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalcLoading(true);
    try {
      const utm = getStoredUTM();
      const res = await fetch("/api/leads/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: calcEmail,
          accountSize: calcAccountSize,
          drawdownPercent: calcDrawdown,
          profitTarget: calcProfitTarget,
          ...(utm || {}),
        }),
      });
      if (res.ok) {
        setCalcSaved(true);
      }
    } catch {
    } finally {
      setCalcLoading(false);
    }
  };

  const heroTags = [
    t("landing.heroTag1"),
    t("landing.heroTag2"),
    t("landing.heroTag3"),
    t("landing.heroTag4"),
  ];

  const personas = [
    {
      title: t("landing.persona1Title"),
      desc: t("landing.persona1Body"),
      icon: <Trophy className="text-amber-500" size={28} />,
      features: [
        t("landing.persona1Feature1"),
        t("landing.persona1Feature2"),
        t("landing.persona1Feature3"),
        t("landing.persona1Feature4"),
      ],
    },
    {
      title: t("landing.persona2Title"),
      desc: t("landing.persona2Body"),
      icon: <ShieldCheck className="text-blue-500" size={28} />,
      features: [
        t("landing.persona2Feature1"),
        t("landing.persona2Feature2"),
        t("landing.persona2Feature3"),
        t("landing.persona2Feature4"),
      ],
    },
    {
      title: t("landing.persona3Title"),
      desc: t("landing.persona3Body"),
      icon: <Zap className="text-emerald-500" size={28} />,
      features: [
        t("landing.persona3Feature1"),
        t("landing.persona3Feature2"),
        t("landing.persona3Feature3"),
        t("landing.persona3Feature4"),
      ],
    },
  ];

  const checklistItems = [
    { text: t("landing.leadMagnetItem1"), num: "01" },
    { text: t("landing.leadMagnetItem2"), num: "02" },
    { text: t("landing.leadMagnetItem3"), num: "03" },
    { text: t("landing.leadMagnetItem4"), num: "04" },
  ];

  const comparisonRows = [
    { feature: t("landing.comparisonRow1"), tradify: true, tradersync: false, edgewonk: false, tradezella: false },
    { feature: t("landing.comparisonRow2"), tradify: true, tradersync: false, edgewonk: false, tradezella: "partial" },
    { feature: t("landing.comparisonRow3"), tradify: true, tradersync: false, edgewonk: false, tradezella: false },
    { feature: t("landing.comparisonRow4"), tradify: true, tradersync: false, edgewonk: false, tradezella: false },
    { feature: t("landing.comparisonRow5"), tradify: true, tradersync: true, edgewonk: true, tradezella: true },
    { feature: t("landing.comparisonRow6"), tradify: true, tradersync: false, edgewonk: false, tradezella: false },
    { feature: t("landing.comparisonRow7"), tradify: true, tradersync: false, edgewonk: false, tradezella: false },
    { feature: t("landing.comparisonRow8"), tradify: t("landing.comparisonFreeText"), tradersync: "$29.95/mo", edgewonk: "$169 once", tradezella: "$49/mo" },
  ];

  const features = [
    { problem: t("landing.feat_lazy_q"), title: t("landing.feat_lazy_t"), desc: t("landing.feat_lazy_d"), icon: <MonitorSmartphone className="text-cyan-500" />, tier: null },
    { problem: t("landing.feat_rules_q"), title: t("landing.feat_rules_t"), desc: t("landing.feat_rules_d"), icon: <ShieldCheck className="text-blue-500" />, tier: null },
    { problem: t("landing.feat_dd_q"), title: t("landing.feat_dd_t"), desc: t("landing.feat_dd_d"), icon: <Trophy className="text-amber-500" />, tier: "Pro" },
    { problem: t("landing.feat_revenge_q"), title: t("landing.feat_revenge_t"), desc: t("landing.feat_revenge_d"), icon: <Activity className="text-rose-500" />, tier: "Elite" },
    { problem: t("landing.feat_size_q"), title: t("landing.feat_size_t"), desc: t("landing.feat_size_d"), icon: <Calculator className="text-amber-500" />, tier: null },
    { problem: t("landing.feat_when_q"), title: t("landing.feat_when_t"), desc: t("landing.feat_when_d"), icon: <Clock className="text-purple-500" />, tier: "Elite" },
    { problem: t("landing.feat_what_q"), title: t("landing.feat_what_t"), desc: t("landing.feat_what_d"), icon: <Brain className="text-emerald-500" />, tier: "Pro" },
    { problem: t("landing.feat_emo_q"), title: t("landing.feat_emo_t"), desc: t("landing.feat_emo_d"), icon: <HeartPulse className="text-pink-500" />, tier: null },
    { problem: t("landing.feat_blow_q"), title: t("landing.feat_blow_t"), desc: t("landing.feat_blow_d"), icon: <AlertCircle className="text-rose-500" />, tier: "Elite" },
    { problem: t("landing.feat_start_q"), title: t("landing.feat_start_t"), desc: t("landing.feat_start_d"), icon: <BookOpen className="text-cyan-500" />, tier: "3 free lessons" },
  ];

  const propSpotlightItems = [
    t("landing.propSpotlightItem1"),
    t("landing.propSpotlightItem2"),
    t("landing.propSpotlightItem3"),
    t("landing.propSpotlightItem4"),
    t("landing.propSpotlightItem5"),
    t("landing.propSpotlightItem6"),
  ];

  const testimonials = [
    { name: t("landing.test1Name"), title: t("landing.test1Title"), quote: t("landing.test1Quote"), badge: t("landing.test1Badge"), stars: 5 },
    { name: t("landing.test2Name"), title: t("landing.test2Title"), quote: t("landing.test2Quote"), badge: t("landing.test2Badge"), stars: 5 },
    { name: t("landing.test3Name"), title: t("landing.test3Title"), quote: t("landing.test3Quote"), badge: t("landing.test3Badge"), stars: 5 },
  ];

  const industryStats = [
    { stat: t("landing.ind1Stat"), label: t("landing.ind1Label"), desc: t("landing.ind1Desc"), source: t("landing.ind1Source"), icon: <AlertCircle className="text-rose-500" size={24} /> },
    { stat: t("landing.ind2Stat"), label: t("landing.ind2Label"), desc: t("landing.ind2Desc"), source: t("landing.ind2Source"), icon: <Shield className="text-amber-500" size={24} /> },
    { stat: t("landing.ind3Stat"), label: t("landing.ind3Label"), desc: t("landing.ind3Desc"), source: t("landing.ind3Source"), icon: <Flame className="text-orange-500" size={24} /> },
  ];

  const industrySolveItems = [
    t("landing.industrySolveItem1"),
    t("landing.industrySolveItem2"),
    t("landing.industrySolveItem3"),
    t("landing.industrySolveItem4"),
    t("landing.industrySolveItem5"),
  ];

  const trustItems = [
    { text: t("landing.trustItem1"), icon: <Lock size={18} /> },
    { text: t("landing.trustItem2"), icon: <ShieldCheck size={18} /> },
    { text: t("landing.trustItem3"), icon: <AlertCircle size={18} /> },
    { text: t("landing.trustItem4"), icon: <CheckCircle2 size={18} /> },
  ];

  const fmBenefits = [
    { title: t("landing.fmBenefit1Title"), desc: t("landing.fmBenefit1Desc"), icon: <Sparkles className="text-amber-400" size={24} /> },
    { title: t("landing.fmBenefit2Title"), desc: t("landing.fmBenefit2Desc"), icon: <Target className="text-amber-400" size={24} /> },
    { title: t("landing.fmBenefit3Title"), desc: t("landing.fmBenefit3Desc"), icon: <Users className="text-amber-400" size={24} /> },
    { title: t("landing.fmBenefit4Title"), desc: t("landing.fmBenefit4Desc"), icon: <Crown className="text-amber-400" size={24} /> },
  ];

  const notForYouItems = [
    { headline: t("landing.nfy1Head"), body: t("landing.nfy1Body") },
    { headline: t("landing.nfy2Head"), body: t("landing.nfy2Body") },
    { headline: t("landing.nfy3Head"), body: t("landing.nfy3Body") },
    { headline: t("landing.nfy4Head"), body: t("landing.nfy4Body") },
    { headline: t("landing.nfy5Head"), body: t("landing.nfy5Body") },
    { headline: t("landing.nfy6Head"), body: t("landing.nfy6Body") },
  ];

  const faqs = Array.from({ length: 18 }, (_, i) => ({
    q: t(`landing.faq${i + 1}q`),
    a: t(`landing.faq${i + 1}a`),
  }));

  const screenshotTabs = [
    { label: t("landing.ssDashboard"), icon: <Activity size={12} /> },
    { label: t("landing.ssPropTracker"), icon: <Target size={12} /> },
    { label: t("landing.ssRulesJournal"), icon: <BookOpen size={12} /> },
    { label: t("landing.ssAnalytics"), icon: <Brain size={12} /> },
  ];

  const screenshotImgs = [
    { src: "/images/screenshots/dashboard.png", alt: t("landing.ssDashboardAlt") },
    { src: "/images/screenshots/prop-firm.png", alt: t("landing.ssPropFirmAlt") },
    { src: "/images/screenshots/journal.png", alt: t("landing.ssJournalAlt") },
    { src: "/images/screenshots/analytics.png", alt: t("landing.ssAnalyticsAlt") },
  ];

  const topBannerText = founderCount
    ? founderCount.remaining <= 10
      ? t("landing.bannerSpotsLeft", { count: founderCount.remaining })
      : founderCount.remaining <= 50
      ? t("landing.bannerSpotsFilling", { count: founderCount.remaining })
      : t("landing.bannerSpotsNormal", { count: founderCount.remaining, total: founderCount.total })
    : "";

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO 
        title="TradifyApp - Trading Discipline Platform | Enforce Your Rules, Pass Prop Challenges"
        description="80% of traders fail prop challenges because they break their own rules. TradifyApp enforces your trading rules, tracks drawdown in real time, and stops revenge trading before it starts. Free plan available."
        canonical="https://tradifyapp.com/"
        ogImage="https://tradifyapp.com/images/tradify-promo-1.png"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "TradifyApp",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "Trading discipline platform that enforces your rules, auto-syncs MT5 trades, tracks prop firm drawdown in real time, and flags behavioral mistakes before they cost you.",
            "url": "https://tradifyapp.com",
            "offers": [
              { "@type": "Offer", "price": "0", "priceCurrency": "USD", "name": "Free Plan" },
              { "@type": "Offer", "price": "29", "priceCurrency": "USD", "name": "Pro Plan", "billingIncrement": "month" },
              { "@type": "Offer", "price": "59", "priceCurrency": "USD", "name": "Elite Plan", "billingIncrement": "month" }
            ],
            "applicationSubCategory": "Trading Discipline Platform"
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqs.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } }))
          }
        ]}
      />
      <PublicNavbar topOffset={!topBannerDismissed && founderCount && !founderCount.isFull ? 36 : 0} />

      {/* Top Announcement Bar */}
      {!topBannerDismissed && founderCount && !founderCount.isFull && (
        <div
          className={`fixed top-0 left-0 right-0 h-9 z-[60] flex items-center justify-center px-10 text-center ${
            founderCount.remaining <= 50
              ? "bg-red-600 border-b border-red-400/30"
              : "bg-amber-500 border-b border-amber-400/30"
          }`}
          data-testid="banner-top-announcement"
        >
          <div className="flex items-center gap-2">
            {founderCount.remaining <= 50 ? (
              <Flame className={`h-3.5 w-3.5 text-white shrink-0 ${founderCount.remaining <= 10 ? "animate-pulse" : ""}`} />
            ) : (
              <Crown className="h-3.5 w-3.5 text-slate-950 shrink-0" />
            )}
            <span className={`text-[11px] font-black uppercase tracking-[0.12em] ${founderCount.remaining <= 50 ? "text-white" : "text-slate-950"}`}>
              {topBannerText}
            </span>
            <Link to="/signup" data-testid="link-top-banner-cta">
              <span className={`text-[10px] font-black uppercase tracking-widest underline underline-offset-2 ${founderCount.remaining <= 50 ? "text-white/90 hover:text-white" : "text-slate-900/80 hover:text-slate-900"}`}>
                {t("landing.bannerClaimYours")}
              </span>
            </Link>
          </div>
          <button
            onClick={() => {
              setTopBannerDismissed(true);
              sessionStorage.setItem("top_banner_dismissed", "1");
            }}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${founderCount.remaining <= 50 ? "text-white/70 hover:text-white" : "text-slate-900/60 hover:text-slate-900"}`}
            data-testid="button-dismiss-top-banner"
            aria-label={t("landing.bannerDismiss")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Bottom Sticky Banner */}
      {(() => {
        const urgent = founderCount && founderCount.remaining <= 50 && !founderCount.isFull;
        const critical = founderCount && founderCount.remaining <= 10 && !founderCount.isFull;
        return (
          <div
            className={`fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md border-t shadow-2xl shadow-black/40 ${
              critical
                ? "bg-red-950/96 border-red-500/30"
                : urgent
                ? "bg-orange-950/96 border-orange-500/25"
                : "bg-[#0A0F1E]/96 border-amber-500/25"
            }`}
            data-testid="banner-founding-member"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  critical ? "bg-red-500/20 border border-red-500/40"
                  : urgent ? "bg-orange-500/20 border border-orange-500/40"
                  : "bg-amber-500/15 border border-amber-500/30"
                }`}>
                  {critical
                    ? <Flame className={`h-4 w-4 text-red-400 animate-pulse`} />
                    : urgent
                    ? <Flame className="h-4 w-4 text-orange-400" />
                    : <Crown className="h-4 w-4 text-amber-500" />
                  }
                </div>
                <div className="min-w-0">
                  <div className={`text-[10px] font-black uppercase tracking-[0.15em] mb-0.5 ${
                    critical ? "text-red-400" : urgent ? "text-orange-400" : "text-amber-500"
                  }`}>
                    {critical ? t("landing.bottomCriticalLabel") : urgent ? t("landing.bottomUrgentLabel") : t("landing.bottomNormalLabel")}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium leading-none">
                    {founderCount
                      ? founderCount.isFull
                        ? t("landing.bottomFullSubtitle")
                        : t("landing.bottomWithCountSubtitle", { count: founderCount.remaining, total: founderCount.total })
                      : t("landing.bottomNormalSubtitle")}
                  </div>
                </div>
              </div>
              <Link to="/signup" className="shrink-0" data-testid="button-sticky-founding-cta">
                <Button size="sm" className={`font-black uppercase tracking-widest text-[10px] rounded-lg px-5 h-8 whitespace-nowrap ${
                  critical ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20"
                  : urgent ? "bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20"
                }`}>
                  {founderCount?.isFull ? t("landing.bottomCTACreate") : t("landing.bottomCTAClaim")} <ArrowRight className="ml-1.5 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        );
      })()}
      
      {/* Hero Section */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <Flame size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500" data-testid="text-hero-tagline">{t("landing.heroTagline")}</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]" data-testid="text-hero-title">
            {t("landing.heroTitle")}
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8" data-testid="text-hero-subtitle">
            {t("landing.heroSubtitle")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {heroTags.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-muted/50 border-border text-muted-foreground text-[10px] font-bold uppercase tracking-widest py-1 px-3">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link to="/signup" data-testid="link-hero-signup">
              <Button className="w-full sm:w-auto h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20" data-testid="button-hero-signup">
                {t("landing.ctaPrimary")}
              </Button>
            </Link>
            <Link to="/demo" data-testid="link-hero-demo">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted" data-testid="button-hero-demo">
                {t("landing.ctaSecondary")}
              </Button>
            </Link>
          </div>
          
          <p className="text-xs text-muted-foreground mb-16">
            {t("landing.freeForever")} · {t("landing.noCardRequired")}
          </p>

          <div className="max-w-5xl mx-auto" data-testid="hero-dashboard-preview">
            <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-emerald-500/5 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground ml-2">{t("landing.dashLabel")}</span>
              </div>

              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">{t("landing.dashBalance")}</div>
                    <div className="text-sm sm:text-lg font-black text-foreground font-mono">$104,280</div>
                    <div className="text-[9px] text-emerald-500 font-bold">+4.28%</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">{t("landing.dashWinRate")}</div>
                    <div className="text-sm sm:text-lg font-black text-emerald-500 font-mono">62.4%</div>
                    <div className="text-[9px] text-muted-foreground font-bold">{t("landing.dashTrades")}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">{t("landing.dashRuleCompliance")}</div>
                    <div className="text-sm sm:text-lg font-black text-amber-500 font-mono">87%</div>
                    <div className="text-[9px] text-rose-400 font-bold">{t("landing.dashViolations")}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">{t("landing.dashMaxDrawdown")}</div>
                    <div className="text-sm sm:text-lg font-black text-foreground font-mono">4.2%</div>
                    <div className="text-[9px] text-muted-foreground font-bold">{t("landing.dashOfLimit")}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("landing.dashEquityCurve")}</span>
                      <span className="text-[9px] font-bold text-emerald-500">+$4,280</span>
                    </div>
                    <div className="h-24 sm:h-32 flex items-end gap-[2px]">
                      {[40,42,38,45,43,48,46,52,50,55,53,58,56,61,59,64,62,58,63,67,65,70,68,73,71,76,74,72,78,80,77,82,85,83,88,86,90,88,92,95].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-emerald-500/40 hover:bg-emerald-500/70 transition-colors"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">{t("landing.dashPropChallenge")}</div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] uppercase tracking-widest text-muted-foreground">{t("landing.dashProfitTarget")}</span>
                          <span className="text-[10px] font-black text-emerald-500">72%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: "72%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] uppercase tracking-widest text-muted-foreground">{t("landing.dashDrawdownUsed")}</span>
                          <span className="text-[10px] font-black text-amber-500">42%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: "42%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] uppercase tracking-widest text-muted-foreground">{t("landing.dashConsistency")}</span>
                          <span className="text-[10px] font-black text-blue-400">91%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: "91%" }} />
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] uppercase tracking-widest text-muted-foreground">{t("landing.dashDaysLeft")}</span>
                          <span className="text-xs font-black text-foreground">18</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry Pain Stats */}
      <section className="py-12 border-y border-border bg-muted/20" data-testid="section-social-proof">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 80, suffix: "%+", label: t("landing.stat1Label"), source: t("landing.stat1Source"), icon: <AlertCircle size={20} className="text-rose-500" /> },
              { value: 92, suffix: "%", label: t("landing.stat2Label"), source: t("landing.stat2Source"), icon: <ShieldCheck size={20} className="text-amber-500" /> },
              { value: 3, suffix: "x", label: t("landing.stat3Label"), source: t("landing.stat3Source"), icon: <Flame size={20} className="text-orange-500" /> },
              { value: 47, suffix: "%", label: t("landing.stat4Label"), source: t("landing.stat4Source"), icon: <Target size={20} className="text-red-500" /> }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                {stat.icon}
                <div className="text-2xl sm:text-3xl font-black text-foreground">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</div>
                <div className="text-[8px] italic text-muted-foreground/60">{stat.source}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who Is TradifyApp For? */}
      <section className="py-24 overflow-hidden" data-testid="section-who-is-it-for">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.soundFamiliar")} <span className="text-emerald-500">{t("landing.soundFamiliarHighlight")}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("landing.soundFamiliarSub")}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {personas.map((persona, i) => (
              <Card key={i} className="bg-background border-border hover:border-emerald-500/20 transition-all duration-300 overflow-hidden group" data-testid={`card-persona-${i}`}>
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 group-hover:bg-emerald-500/10 transition-colors">
                    {persona.icon}
                  </div>
                  <h3 className="text-lg font-black text-foreground tracking-wide mb-3">{persona.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{persona.desc}</p>
                  <div className="space-y-2">
                    {persona.features.map((f, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Magnet: Pre-Trade Checklist */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-checklist-lead">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <Download size={12} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{t("landing.leadMagnetFreeDownloadBadge")}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
                {t("landing.leadMagnetTitleLine1")}<br /><span className="text-emerald-500">{t("landing.leadMagnetTitleLine2")}</span>
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {t("landing.leadMagnetDesc")}
              </p>
              <div className="space-y-2 mb-6">
                {checklistItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 group" data-testid={`checklist-preview-${i}`}>
                    <div className="h-7 w-7 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-black text-emerald-500 font-mono">{item.num}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.text}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-dashed border-border/30 opacity-50">
                  <div className="h-7 w-7 rounded bg-muted/30 border border-border/30 flex items-center justify-center shrink-0">
                    <Lock size={12} className="text-muted-foreground/50" />
                  </div>
                  <span className="text-sm text-muted-foreground/60 italic">{t("landing.leadMagnetMore")}</span>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-background border border-border">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <FileText className="text-emerald-500" size={28} />
              </div>
              <h3 className="text-lg font-black text-foreground text-center uppercase tracking-widest mb-2">
                {t("landing.leadMagnetEnterEmail")}
              </h3>
              <p className="text-xs text-muted-foreground text-center mb-6">
                {t("landing.leadMagnetNoSpam")}
              </p>
              {checklistSubmitted ? (
                <div className="text-center space-y-4" data-testid="checklist-success">
                  <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="text-emerald-500" size={28} />
                  </div>
                  <p className="text-sm font-bold text-emerald-500">{t("landing.leadMagnetReady")}</p>
                  <Link to="/checklist" target="_blank">
                    <Button className="w-full h-12 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-400" data-testid="button-download-checklist">
                      <Download className="mr-2 h-4 w-4" />
                      {t("landing.leadMagnetView")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleChecklistSubmit} className="space-y-3" data-testid="form-checklist">
                  <Input
                    type="email"
                    placeholder={t("landing.leadMagnetEmailPlaceholder")}
                    value={checklistEmail}
                    onChange={(e) => setChecklistEmail(e.target.value)}
                    required
                    className="h-12 bg-muted/50 border-border text-foreground rounded-xl"
                    data-testid="input-checklist-email"
                  />
                  <Button
                    type="submit"
                    disabled={checklistLoading}
                    className="w-full h-12 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-xl hover:bg-emerald-400"
                    data-testid="button-checklist-submit"
                  >
                    {checklistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        {t("landing.leadMagnetGetButton")}
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Competitive Comparison Table */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-comparison">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.comparisonH2Pre")} <span className="text-emerald-500">{t("landing.comparisonH2Highlight")}</span> {t("landing.comparisonH2Post")}
            </h2>
            <p className="text-muted-foreground">{t("landing.comparisonSub")}</p>
          </div>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[640px] text-left border-collapse" data-testid="table-comparison">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-4 pr-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[200px]">{t("landing.comparisonFeatureCol")}</th>
                  <th className="py-4 px-3 text-center">
                    <div className="text-sm font-black text-emerald-500 uppercase tracking-widest">TradifyApp</div>
                  </th>
                  <th className="py-4 px-3 text-center">
                    <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">TraderSync</div>
                  </th>
                  <th className="py-4 px-3 text-center">
                    <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">Edgewonk</div>
                  </th>
                  <th className="py-4 px-3 text-center">
                    <div className="text-sm font-black text-muted-foreground uppercase tracking-widest">TradeZella / Tradervue</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50" data-testid={`row-comparison-${i}`}>
                    <td className="py-3.5 pr-4 text-xs font-bold text-foreground">{row.feature}</td>
                    {(["tradify", "tradersync", "edgewonk", "tradezella"] as const).map((col) => {
                      const val = row[col];
                      return (
                        <td key={col} className={`py-3.5 px-3 text-center ${col === "tradify" ? "bg-emerald-500/5" : ""}`}>
                          {val === true ? (
                            <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                          ) : val === false ? (
                            <X size={16} className="text-rose-500/60 mx-auto" />
                          ) : val === "partial" ? (
                            <span className="text-[10px] font-bold text-amber-500 uppercase">{t("landing.comparisonPartialLabel")}</span>
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-muted-foreground/50 text-center mt-6 italic">{t("landing.comparisonNote")}</p>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
            {t("landing.stepsH2Pre")} <span className="text-emerald-500">{t("landing.stepsH2Highlight")}</span>
          </h2>
          <p className="text-muted-foreground mb-16 max-w-xl mx-auto">{t("landing.stepsSub")}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent hidden md:block" />
            
            <div className="relative z-10 group">
              <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 mx-auto">
                <div className="text-emerald-500"><Users /></div>
              </div>
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">01</div>
              <h4 className="font-bold text-foreground uppercase tracking-widest text-sm mb-2">{t("landing.step1Title")}</h4>
              <p className="text-xs text-muted-foreground max-w-[250px] mx-auto leading-relaxed mb-4">{t("landing.step1Body")}</p>
              <div className="mx-auto max-w-[200px] p-3 rounded-xl bg-card border border-border" data-testid="mockup-step-1">
                <div className="flex items-center justify-center">
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-500">
                    <span className="text-[8px] font-black text-slate-950 uppercase tracking-widest">{t("landing.step1Mockup")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 group">
              <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 mx-auto">
                <div className="text-emerald-500"><MonitorSmartphone /></div>
              </div>
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">02</div>
              <h4 className="font-bold text-foreground uppercase tracking-widest text-sm mb-2">{t("landing.step2Title")}</h4>
              <p className="text-xs text-muted-foreground max-w-[250px] mx-auto leading-relaxed mb-4">{t("landing.step2Body")}</p>
              <div className="mx-auto max-w-[200px] p-3 rounded-xl bg-card border border-border font-mono" data-testid="mockup-step-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[8px] text-emerald-500 font-bold">{t("landing.step2MockupConnected")}</span>
                </div>
                <div className="text-[8px] text-muted-foreground space-y-1">
                  <div>{t("landing.step2MockupAccount")}: <span className="text-foreground">12345678</span></div>
                  <div>{t("landing.step2MockupStatus")}: <span className="text-emerald-500">{t("landing.step2MockupSyncing")}</span></div>
                  <div>{t("landing.step2MockupTradesLabel")}: <span className="text-foreground">{t("landing.step2MockupTradesImported")}</span></div>
                </div>
              </div>
            </div>

            <div className="relative z-10 group sm:col-span-2 md:col-span-1">
              <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 mx-auto">
                <div className="text-emerald-500"><TrendingUp /></div>
              </div>
              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">03</div>
              <h4 className="font-bold text-foreground uppercase tracking-widest text-sm mb-2">{t("landing.step3Title")}</h4>
              <p className="text-xs text-muted-foreground max-w-[250px] mx-auto leading-relaxed mb-4">{t("landing.step3Body")}</p>
              <div className="mx-auto max-w-[200px] p-3 rounded-xl bg-card border border-border" data-testid="mockup-step-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{t("landing.step3MockupEquity")}</span>
                  <span className="text-[8px] font-bold text-emerald-500">+$4,280</span>
                </div>
                <div className="h-12 flex items-end gap-[1px]">
                  {[40,42,38,45,43,48,46,52,50,55,53,58,56,61,59,64,62,58,63,67,65,70,68,73,71,76,74,72,78,80,77,82,85,83,88,86,90,88,92,95].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-emerald-500/40" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-24 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.featuresH2Pre")} <span className="text-emerald-500">{t("landing.featuresH2Highlight")}</span>
            </h2>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">{t("landing.featuresSub")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="bg-background border-border hover:border-emerald-500/20 transition-all duration-300 group" data-testid={`card-feature-${i}`}>
                <CardContent className="p-6 flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border group-hover:bg-emerald-500/10 transition-colors">
                      {feature.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-emerald-500 mb-1">{feature.problem}</p>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">{feature.title}</h3>
                        {feature.tier === "Pro" && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0 uppercase tracking-widest shrink-0">{t("landing.tierProBadge")}</Badge>
                        )}
                        {feature.tier === "Elite" && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] py-0 uppercase tracking-widest shrink-0">{t("landing.tierEliteBadge")}</Badge>
                        )}
                        {feature.tier === "3 free lessons" && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[9px] py-0 uppercase tracking-widest shrink-0">{t("landing.tier3FreeBadge")}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Prop Firm Spotlight */}
      <section className="py-24 overflow-hidden" data-testid="section-prop-firm-spotlight">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase tracking-widest mb-6">
                {t("landing.propSpotlightBadge")}
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-6">
                {t("landing.propSpotlightH2Pre")} <span className="text-amber-500">{t("landing.propSpotlightH2Highlight")}</span> {t("landing.propSpotlightH2Post")}
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                {t("landing.propSpotlightDesc")}
              </p>
              <div className="space-y-4">
                {propSpotlightItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-gradient-to-br from-amber-500/5 to-background border border-amber-500/20 p-8 overflow-hidden">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">{t("landing.propSpotlightCardLabel")}</div>
                      <div className="text-xl font-black text-foreground">{t("landing.propSpotlightCardAccount")}</div>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] uppercase tracking-widest">{t("landing.propSpotlightCardActive")}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-background/50 border border-border">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">{t("landing.dashProfitTarget")}</div>
                      <div className="text-2xl font-black text-emerald-500">72%</div>
                      <div className="w-full h-1.5 bg-muted rounded-full mt-2">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: "72%" }} />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-background/50 border border-border">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">{t("landing.dashMaxDrawdown")}</div>
                      <div className="text-2xl font-black text-amber-500">34%</div>
                      <div className="w-full h-1.5 bg-muted rounded-full mt-2">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: "34%" }} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-background/50 border border-border">
                      <div className="text-lg font-black text-foreground">18</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("landing.dashDaysLeft")}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background/50 border border-border">
                      <div className="text-lg font-black text-emerald-500">87%</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("landing.dashConsistency")}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background/50 border border-border">
                      <div className="text-lg font-black text-foreground">12</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("landing.dashPropChallenge")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-testimonials">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.testimonialsH2Pre")} <span className="text-emerald-500">{t("landing.testimonialsH2Highlight")}</span>
            </h2>
            <p className="text-muted-foreground">{t("landing.testimonialsSub")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-testimonial-${i}`}>
                <CardContent className="p-8">
                  <div className="flex items-center gap-0.5 mb-4">
                    {Array.from({ length: testimonial.stars }).map((_, j) => (
                      <Star key={j} size={14} className="text-emerald-500 fill-emerald-500" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 italic">"{testimonial.quote}"</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-foreground">{testimonial.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{testimonial.title}</div>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] uppercase tracking-widest">
                      {testimonial.badge}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Magnet: Prop Firm Challenge Calculator */}
      <section className="py-24 bg-gradient-to-b from-background via-blue-500/5 to-background border-y border-border" data-testid="section-calculator-lead">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <Calculator size={12} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">{t("landing.calcFreeToolBadge")}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.calcH2Line1")}<br /><span className="text-blue-400">{t("landing.calcH2Line2")}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("landing.calcDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-6">{t("landing.calcChallengeDetails")}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">{t("landing.calcAccountSizeLabel")}</label>
                  <Input
                    type="number"
                    placeholder="100000"
                    value={calcAccountSize}
                    onChange={(e) => setCalcAccountSize(e.target.value)}
                    className="h-12 bg-muted/50 border-border text-foreground rounded-xl font-mono"
                    data-testid="input-calc-account-size"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">{t("landing.calcMaxDrawdownLabel")}</label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={calcDrawdown}
                    onChange={(e) => setCalcDrawdown(e.target.value)}
                    className="h-12 bg-muted/50 border-border text-foreground rounded-xl font-mono"
                    data-testid="input-calc-drawdown"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">{t("landing.calcProfitTargetLabel")}</label>
                  <Input
                    type="number"
                    placeholder="8"
                    value={calcProfitTarget}
                    onChange={(e) => setCalcProfitTarget(e.target.value)}
                    className="h-12 bg-muted/50 border-border text-foreground rounded-xl font-mono"
                    data-testid="input-calc-profit-target"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border">
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-6">{t("landing.calcYourNumbers")}</h3>
              {calcAccountSize && calcDrawdown && calcProfitTarget ? (() => {
                const acctSize = parseFloat(calcAccountSize) || 0;
                const dd = parseFloat(calcDrawdown) || 0;
                const pt = parseFloat(calcProfitTarget) || 0;
                const maxLoss = acctSize * (dd / 100);
                const profitNeeded = acctSize * (pt / 100);
                const riskPerTrade = maxLoss * 0.02;
                const riskPercent = (riskPerTrade / acctSize) * 100;
                const avgRR = 2;
                const avgWin = riskPerTrade * avgRR;
                const avgLoss2 = riskPerTrade;
                const minWinRate = avgRR > 0 ? (1 / (1 + avgRR)) * 100 : 50;
                const safeWinRate = Math.ceil(minWinRate + 5);
                const expectancy = (safeWinRate / 100) * avgWin - ((100 - safeWinRate) / 100) * avgLoss2;
                const tradesNeeded = expectancy > 0 ? Math.ceil(profitNeeded / expectancy) : 0;
                const tradingDays = 22;
                const dailyTarget = profitNeeded / tradingDays;

                const difficultyRatio = dd > 0 ? pt / dd : 99;
                const difficultyLabel = difficultyRatio <= 0.6 ? t("landing.calcDiffAchievable") : difficultyRatio <= 1.0 ? t("landing.calcDiffModerate") : difficultyRatio <= 1.5 ? t("landing.calcDiffAggressive") : t("landing.calcDiffVeryHard");
                const difficultyColor = difficultyRatio <= 0.6 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : difficultyRatio <= 1.0 ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-rose-400 bg-rose-400/10 border-rose-400/20";

                const resultRows = [
                  { label: t("landing.calcRowMaxDDAmount"), value: `$${maxLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-rose-400" },
                  { label: t("landing.calcRowProfitTarget"), value: `$${profitNeeded.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "text-emerald-500" },
                  { label: t("landing.calcRowSuggestedRisk"), value: `$${riskPerTrade.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${riskPercent.toFixed(2)}%)`, color: "text-blue-400" },
                  { label: t("landing.calcRowMinWinRate"), value: `${safeWinRate}%`, color: "text-violet-400" },
                  { label: t("landing.calcRowEstTrades"), value: tradesNeeded > 0 ? `~${tradesNeeded} ${t("landing.calcRowTradesUnit")}` : "—", color: "text-amber-400" },
                  { label: t("landing.calcRowDailyPL"), value: `$${dailyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })}${t("landing.calcRowDayUnit")}`, color: "text-emerald-500" },
                ];

                const isUnlocked = calcSaved;

                return (
                  <div className="space-y-4">
                    <div className={`relative ${!isUnlocked ? "select-none" : ""}`}>
                      <div className={!isUnlocked ? "blur-[6px] pointer-events-none" : ""}>
                        <div className="space-y-3">
                          {resultRows.map((row, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                              <span className="text-xs text-muted-foreground">{row.label}</span>
                              <span className={`text-sm font-black font-mono ${row.color}`}>{row.value}</span>
                            </div>
                          ))}
                        </div>

                        <div className={`mt-3 flex items-center justify-between p-3 rounded-xl border ${difficultyColor}`}>
                          <span className="text-xs font-bold uppercase tracking-widest">{t("landing.calcDifficultyLabel")}</span>
                          <span className="text-sm font-black">{difficultyLabel}</span>
                        </div>
                      </div>

                      {!isUnlocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-[2px] rounded-xl">
                          <Lock className="text-blue-400 mb-2" size={24} />
                          <p className="text-sm font-black text-foreground uppercase tracking-widest mb-1">{t("landing.calcUnlockTitle")}</p>
                          <p className="text-[10px] text-muted-foreground">{t("landing.calcUnlockSub")}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border">
                      {isUnlocked ? (
                        <div className="space-y-4">
                          <div className="text-center space-y-2" data-testid="calculator-success">
                            <div className="flex items-center justify-center gap-2">
                              <CheckCircle2 className="text-emerald-500" size={18} />
                              <span className="text-sm font-bold text-emerald-500">{t("landing.calcUnlocked")}</span>
                            </div>
                          </div>
                          <Link to="/signup" className="block">
                            <Button className="w-full h-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-emerald-400" data-testid="button-calc-signup">
                              {t("landing.calcCtaSignup")}
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <form onSubmit={handleCalcSubmit} className="space-y-3" data-testid="form-calculator">
                          <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest font-bold">{t("landing.calcEnterEmailUnlock")}</p>
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              placeholder={t("landing.leadMagnetEmailPlaceholder")}
                              value={calcEmail}
                              onChange={(e) => setCalcEmail(e.target.value)}
                              required
                              className="h-10 bg-muted/50 border-border text-foreground rounded-xl text-sm"
                              data-testid="input-calc-email"
                            />
                            <Button
                              type="submit"
                              disabled={calcLoading}
                              className="h-10 px-6 bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-blue-400 shrink-0"
                              data-testid="button-calc-submit"
                            >
                              {calcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("landing.calcUnlockButton")}
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Calculator className="text-muted-foreground/30 mb-4" size={48} />
                  <p className="text-sm text-muted-foreground">{t("landing.calcEnterDetails")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Industry Reality & Why Discipline Matters */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-industry-proof">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.industryH2Pre")} <span className="text-emerald-500">{t("landing.industryH2Highlight")}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t("landing.industrySub")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {industryStats.map((item, i) => (
              <Card key={i} className="bg-background border-border" data-testid={`card-industry-stat-${i}`}>
                <CardContent className="p-8 flex flex-col gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-foreground">{item.stat}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{item.label}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  <p className="text-[8px] italic text-muted-foreground/60">{t("landing.sourceLabel")}: {item.source}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-emerald-500/5 to-background border border-emerald-500/20 p-8 sm:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] uppercase tracking-widest mb-6">
                  {t("landing.industrySolveBadge")}
                </Badge>
                <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight uppercase mb-4">
                  {t("landing.industrySolveH3Pre")} <span className="text-emerald-500">{t("landing.industrySolveH3Highlight")}</span>
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {t("landing.industrySolveDesc")}
                </p>
                <div className="space-y-3 mb-6">
                  {industrySolveItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <Link to="/early-access">
                  <Button className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-full px-8 hover:bg-emerald-400" data-testid="button-proof-founding-cta">
                    {t("landing.industrySolveCTA")} <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </Link>
              </div>
              <div>
                <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-emerald-500/5 overflow-hidden" data-testid="screenshot-gallery">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                    </div>
                    <div className="flex gap-0 ml-3 -mb-[1px] relative z-10" role="tablist">
                      {screenshotTabs.map((tab, idx) => (
                        <button
                          key={tab.label}
                          role="tab"
                          aria-selected={activeScreenshotTab === idx}
                          aria-controls="screenshot-panel"
                          onClick={() => setActiveScreenshotTab(idx)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-t-lg transition-colors ${
                            activeScreenshotTab === idx
                              ? "bg-card text-emerald-500 border border-border border-b-card"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          data-testid={`tab-screenshot-${idx}`}
                        >
                          {tab.icon}
                          <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative overflow-hidden" role="tabpanel" id="screenshot-panel">
                    {screenshotImgs.map((screenshot, idx) => (
                      <img
                        key={idx}
                        src={screenshot.src}
                        alt={screenshot.alt}
                        loading={idx === 0 ? "eager" : "lazy"}
                        className={`max-w-full h-auto object-contain transition-all duration-300 ${
                          activeScreenshotTab === idx
                            ? "relative opacity-100"
                            : "absolute top-0 left-0 opacity-0 pointer-events-none"
                        }`}
                        style={{ width: "100%" }}
                        data-testid={`screenshot-img-${idx}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Traders Choose TradifyApp */}
      <section className="py-24 overflow-hidden" data-testid="section-why-traders-choose">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.whyH2Pre")} <span className="text-emerald-500">{t("landing.whyH2Highlight")}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t("landing.whySub")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            <div>
              <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-4 flex items-center gap-3">
                <ShieldCheck className="text-emerald-500 shrink-0" size={22} />
                {t("landing.whyTitle1")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {t("landing.whyBody1")}
              </p>

              <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-4 flex items-center gap-3">
                <MonitorSmartphone className="text-cyan-500 shrink-0" size={22} />
                {t("landing.whyTitle2")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("landing.whyBody2")}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-4 flex items-center gap-3">
                <Brain className="text-emerald-500 shrink-0" size={22} />
                {t("landing.whyTitle3")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {t("landing.whyBody3")}
              </p>

              <h3 className="text-lg font-black text-foreground uppercase tracking-widest mb-4 flex items-center gap-3">
                <BookOpen className="text-blue-500 shrink-0" size={22} />
                {t("landing.whyTitle4")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("landing.whyBody4")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-muted/30 border border-border">
              <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <HeartPulse className="text-pink-500 shrink-0" size={18} />
                {t("landing.whyCard1Title")}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("landing.whyCard1Body")}
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-muted/30 border border-border">
              <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <Calculator className="text-amber-500 shrink-0" size={18} />
                {t("landing.whyCard2Title")}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("landing.whyCard2Body")}
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-muted/30 border border-border">
              <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <Upload className="text-teal-500 shrink-0" size={18} />
                {t("landing.whyCard3Title")}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("landing.whyCard3Body")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How TradifyApp Helps You Pass Your Prop Firm Challenge */}
      <section className="py-24 bg-muted/30 border-y border-border" data-testid="section-prop-firm-guide">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase tracking-widest mb-6">
              {t("landing.guideBadge")}
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.guideH2Pre")} <span className="text-amber-500">{t("landing.guideH2Highlight")}</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t("landing.guideSub")}
            </p>
          </div>

          <div className="space-y-12">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex gap-6 items-start">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-black text-amber-500">{n}</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground uppercase tracking-widest mb-2">{t(`landing.guideStep${n}Title`)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(`landing.guideStep${n}Body`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link to="/prop-firm-tracker" data-testid="link-prop-firm-learn-more">
              <Button variant="outline" className="h-12 px-8 border-amber-500/20 text-amber-400 font-bold uppercase tracking-widest text-xs rounded-2xl" data-testid="button-prop-firm-learn-more">
                {t("landing.guideCTA")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Founding Member Section - Enhanced */}
      <section className="py-24 bg-gradient-to-b from-background via-amber-500/5 to-background border-y border-border relative overflow-hidden" data-testid="section-founding-member">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(245,158,11,0.08),transparent_70%)]" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8 animate-pulse">
            <Flame size={14} className="text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">{t("landing.fmEarlyBadge")}</span>
          </div>
          
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-amber-500/30">
            <Crown className="text-slate-900" size={40} />
          </div>
          
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-foreground tracking-tight uppercase mb-4">
            {t("landing.fmH2Pre")} <span className="text-amber-500">{t("landing.fmH2Highlight")}</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t("landing.fmDesc")}
          </p>

          {founderCount && !founderCount.isFull && (
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 mb-10">
              <Crown size={16} className="text-amber-500 shrink-0" />
              <span className="text-amber-500 font-black text-sm uppercase tracking-widest">
                {t("landing.fmSpotsRemaining", { count: founderCount.remaining, total: founderCount.total })}
              </span>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {fmBenefits.map((benefit, i) => (
              <div key={i} className="p-6 rounded-2xl bg-background/80 border border-amber-500/20 hover:border-amber-500/40 transition-colors backdrop-blur-sm">
                <div className="mb-4">{benefit.icon}</div>
                <h4 className="font-black text-foreground text-sm uppercase tracking-widest mb-2">{benefit.title}</h4>
                <p className="text-xs text-muted-foreground">{benefit.desc}</p>
              </div>
            ))}
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <Link to="/early-access" data-testid="link-founding-member-cta">
              <Button className="h-16 px-12 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black uppercase tracking-widest text-sm rounded-2xl hover:from-amber-400 hover:to-amber-500 shadow-2xl shadow-amber-500/30 transition-all hover:scale-105" data-testid="button-founding-member-cta">
                <Crown className="mr-2 h-5 w-5" />
                {t("landing.fmCTA")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="text-xs text-amber-500/60">{t("landing.fmCTASub")}</p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8">
            <Shield className="text-emerald-500" size={32} />
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-8">
            {t("landing.trustH2Pre")} <span className="text-emerald-500">{t("landing.trustH2Highlight")}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {trustItems.map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border">
                <div className="text-emerald-500">{item.icon}</div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">{item.text}</span>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm text-muted-foreground leading-relaxed">
            {t("landing.trustFooter")}
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gradient-to-b from-background to-muted mb-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-card border border-border rounded-[32px] p-8 md:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/5 blur-[120px] rounded-full" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
              <div>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase mb-6">
                  {t("landing.ctaFinalH2Line1")}<br />{t("landing.ctaFinalH2Line2")}
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  {t("landing.ctaFinalDesc")}
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link to="/signup" data-testid="link-cta-signup">
                    <Button className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400" data-testid="button-cta-signup">
                      {t("landing.ctaFinalStartFree")}
                    </Button>
                  </Link>
                  <Link to="/pricing" data-testid="link-cta-pricing">
                    <Button variant="ghost" className="h-14 px-8 text-foreground font-bold uppercase tracking-widest text-xs group" data-testid="button-cta-pricing">
                      {t("landing.ctaFinalCompare")} <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={16} />
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 sm:p-6 rounded-2xl bg-background/50 border border-border">
                  <div className="text-2xl sm:text-3xl font-black text-foreground mb-1">{t("landing.ctaFinalFreeLabel")}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">{t("landing.ctaFinalFreeSub")}</div>
                  <ul className="space-y-2">
                    {[1,2,3,4,5].map((n) => (
                      <li key={n} className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> {t(`landing.ctaFinalFreeItem${n}`)}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-500 text-slate-950 border-emerald-400 text-[9px] font-black uppercase tracking-widest px-3 py-0.5 shadow-lg shadow-emerald-500/30" data-testid="badge-most-popular">
                      {t("landing.ctaFinalMostPopular")}
                    </Badge>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-500 mb-1 mt-2">{t("landing.ctaFinalProLabel")}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4">{t("landing.ctaFinalProSub")}</div>
                  <ul className="space-y-2">
                    {[1,2,3,4,5].map((n) => (
                      <li key={n} className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> {t(`landing.ctaFinalProItem${n}`)}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 sm:p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 shadow-2xl shadow-amber-500/10">
                  <div className="text-2xl sm:text-3xl font-black text-amber-500 mb-1">{t("landing.ctaFinalEliteLabel")}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-4">{t("landing.ctaFinalEliteSub")}</div>
                  <ul className="space-y-2">
                    {[1,2,3,4,5].map((n) => (
                      <li key={n} className="text-[10px] sm:text-xs text-foreground flex items-center gap-2"><CheckCircle2 size={12} className="text-amber-500 shrink-0" /> {t(`landing.ctaFinalEliteItem${n}`)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Not For You If Section */}
      <section className="py-24 border-b border-border" data-testid="section-not-for-you">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-full px-4 py-1.5 mb-6">
              <X size={12} className="text-rose-400" />
              <span className="text-xs font-black uppercase tracking-widest text-rose-400">{t("landing.notForYouBadge")}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.notForYouH2Pre")} <span className="text-rose-400">{t("landing.notForYouH2Highlight")}</span> {t("landing.notForYouH2Post")}
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              {t("landing.notForYouSub")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
            {notForYouItems.map((item, i) => (
              <div
                key={i}
                className="flex gap-4 p-5 bg-card border border-border rounded-2xl hover:border-rose-500/30 transition-colors"
                data-testid={`not-for-you-item-${i}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-6 h-6 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <X size={10} className="text-rose-400" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground mb-1">{item.headline}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-4">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span className="text-xs font-black uppercase tracking-widest text-emerald-500">{t("landing.notForYouButForYouBadge")}</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t("landing.notForYouButForYouBody")}
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 border-b border-border" data-testid="section-faq">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("landing.faqH2Pre")} <span className="text-emerald-500">{t("landing.faqH2Highlight")}</span>
            </h2>
            <p className="text-muted-foreground">{t("landing.faqSub")}</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group bg-card border border-border rounded-2xl overflow-hidden" data-testid={`faq-item-${i}`}>
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <span className="text-sm font-bold text-foreground pr-4">{faq.q}</span>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-border" data-testid="section-footer">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">{t("landing.footerProduct")}</h4>
              <div className="space-y-3">
                <Link to="/features" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-features">{t("landing.footerFeatures")}</Link>
                <Link to="/pricing" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-pricing">{t("landing.footerPricing")}</Link>
                <Link to="/how-it-works" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-how-it-works">{t("landing.footerHowItWorks")}</Link>
                <Link to="/resources" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-resources">{t("landing.footerResources")}</Link>
                <Link to="/early-access" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-early-access">{t("landing.footerEarlyAccess")}</Link>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">{t("landing.footerSolutions")}</h4>
              <div className="space-y-3">
                <Link to="/trading-journal" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-trading-journal">{t("landing.footerTradingJournal")}</Link>
                <Link to="/prop-firm-tracker" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-prop-firm-tracker">{t("landing.footerPropFirmTracker")}</Link>
                <Link to="/mt5-trading-analytics" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-mt5-analytics">{t("landing.footerMT5Analytics")}</Link>
                <Link to="/blog" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-blog">{t("landing.footerBlog")}</Link>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Free Tools</h4>
              <div className="space-y-3">
                <Link to="/free-tools" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-free-tools">All Free Tools</Link>
                <Link to="/calculator" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-calculator">Risk Calculator</Link>
                <Link to="/checklist" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-checklist">Pre-Trade Checklist</Link>
                <Link to="/prop-firms" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-prop-firms">Prop Firm Trackers</Link>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">{t("landing.footerCompany")}</h4>
              <div className="space-y-3">
                <Link to="/about" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-about">{t("landing.footerAbout")}</Link>
                <a href="mailto:support@tradify.app?subject=TradifyApp Support Request" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-contact-us-footer">{t("landing.footerContactUs")}</a>
                <CookieSettingsButton />
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">{t("landing.footerLegal")}</h4>
              <div className="space-y-3">
                <Link to="/terms" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-terms">{t("landing.footerTerms")}</Link>
                <Link to="/privacy" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-privacy">{t("landing.footerPrivacy")}</Link>
                <Link to="/risk-disclaimer" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-risk">{t("landing.footerRisk")}</Link>
                <Link to="/cookie-policy" className="block text-xs text-muted-foreground hover:text-emerald-500 transition-colors" data-testid="link-footer-cookie">{t("landing.footerCookie")}</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
              {t("landing.footerCopy", { year: 2026 })}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
