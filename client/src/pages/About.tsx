import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  ShieldCheck,
  Lock,
  Eye,
  Target,
  Users,
  ArrowRight,
  CheckCircle2,
  Brain,
  BarChart3,
  Code2,
  Globe,
  Lightbulb,
  Layers,
  Server,
} from "lucide-react";
import { PublicNavbar } from "@/components/PublicNavbar";
import { CookieSettingsButton } from "@/components/CookieConsent";
import { SEO } from "@/components/SEO";

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-emerald-500/30">
      <SEO
        title="About TradifyApp - Trading Discipline Platform"
        description="TradifyApp is a discipline enforcement platform for serious traders. Auto-sync MT5 trades, validate rules before every entry, and track prop firm challenges in real time. No signals, no predictions — just discipline."
        canonical="https://tradifyapp.com/about"
        breadcrumbs={[
          { name: "Home", url: "https://tradifyapp.com" },
          { name: "About", url: "https://tradifyapp.com/about" },
        ]}
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": "TradifyApp Founder",
            "jobTitle": "Founder & CEO",
            "worksFor": {
              "@type": "Organization",
              "name": "TradifyApp",
            },
            "description":
              "Trader and technologist focused on building discipline-first tools for the trading community.",
          },
        ]}
      />
      <PublicNavbar />

      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[128px] animate-pulse" />
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <Lightbulb size={14} className="text-emerald-500" />
            <span
              className="text-[10px] font-black uppercase tracking-widest text-emerald-500"
              data-testid="text-about-badge"
            >
              {t("about.badge")}
            </span>
          </div>

          <h1
            className="text-3xl sm:text-5xl md:text-7xl font-black text-foreground tracking-tighter uppercase mb-6 leading-[0.9]"
            data-testid="text-about-heading"
          >
            {t("about.heroLine1")}
            <br />
            <span className="text-emerald-500">{t("about.heroLine2")}</span>
          </h1>

          <p
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
            data-testid="text-about-subheading"
          >
            {t("about.heroSubtitle")}
          </p>
        </div>
      </section>

      <section
        className="py-24 border-y border-border bg-muted/20"
        data-testid="section-mission"
      >
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("about.missionTitle")}{" "}
              <span className="text-emerald-500">{t("about.missionTitleHighlight")}</span>
            </h2>
            <p
              className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed"
              data-testid="text-mission-statement"
            >
              {t("about.missionStatement")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Target className="text-emerald-500" size={24} />,
                title: t("about.valueDiscFirstTitle"),
                desc: t("about.valueDiscFirstDesc"),
              },
              {
                icon: <BarChart3 className="text-blue-500" size={24} />,
                title: t("about.valueDataTitle"),
                desc: t("about.valueDataDesc"),
              },
              {
                icon: <Users className="text-purple-500" size={24} />,
                title: t("about.valueEmpowerTitle"),
                desc: t("about.valueEmpowerDesc"),
              },
            ].map((item, i) => (
              <Card
                key={i}
                className="bg-background border-border"
                data-testid={`card-mission-${i}`}
              >
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6">
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-widest mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-why-tradify">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("about.whyTitle")}{" "}
              <span className="text-emerald-500">{t("about.whyTitleHighlight")}</span>{" "}
              {t("about.whyTitleEnd")}
            </h2>
          </div>

          <div className="space-y-8">
            <div className="p-8 rounded-3xl bg-muted/30 border border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Lightbulb className="text-emerald-500" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground uppercase tracking-tight mb-2">
                    {t("about.problemTitle")}
                  </h3>
                  <p
                    className="text-sm text-muted-foreground leading-relaxed"
                    data-testid="text-problem-statement"
                  >
                    {t("about.problemBody")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Brain className="text-blue-500" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground uppercase tracking-tight mb-2">
                    {t("about.solutionTitle")}
                  </h3>
                  <p
                    className="text-sm text-muted-foreground leading-relaxed"
                    data-testid="text-solution-statement"
                  >
                    {t("about.solutionBody")}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20">
                <h4 className="text-xs font-black uppercase tracking-widest text-rose-400 mb-4">
                  {t("about.isNotTitle")}
                </h4>
                <div className="space-y-3">
                  {[
                    t("about.isNot1"),
                    t("about.isNot2"),
                    t("about.isNot3"),
                    t("about.isNot4"),
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <ShieldCheck size={14} className="text-rose-400 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-4">
                  {t("about.isTitle")}
                </h4>
                <div className="space-y-3">
                  {[
                    t("about.is1"),
                    t("about.is2"),
                    t("about.is3"),
                    t("about.is4"),
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="py-24 border-y border-border bg-muted/20"
        data-testid="section-philosophy"
      >
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("about.philosophyTitle")}{" "}
              <span className="text-emerald-500">{t("about.philosophyTitleHighlight")}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("about.philosophySubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: <Eye className="text-cyan-500" size={20} />,
                title: t("about.phReadOnlyTitle"),
                desc: t("about.phReadOnlyDesc"),
              },
              {
                icon: <Lock className="text-amber-500" size={20} />,
                title: t("about.phSecurityTitle"),
                desc: t("about.phSecurityDesc"),
              },
              {
                icon: <Brain className="text-emerald-500" size={20} />,
                title: t("about.phAITitle"),
                desc: t("about.phAIDesc"),
              },
              {
                icon: <Layers className="text-purple-500" size={20} />,
                title: t("about.phTransTitle"),
                desc: t("about.phTransDesc"),
              },
            ].map((item, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-background border border-border"
                data-testid={`card-philosophy-${i}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-widest">
                    {item.title}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" data-testid="section-technology">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("about.techTitle")}{" "}
              <span className="text-emerald-500">{t("about.techTitleHighlight")}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("about.techSubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Server size={20} />, label: t("about.techCloud") },
              { icon: <Lock size={20} />, label: t("about.techEncrypted") },
              { icon: <Globe size={20} />, label: t("about.techGlobal") },
              { icon: <Code2 size={20} />, label: t("about.techStack") },
            ].map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-muted/30 border border-border text-center"
                data-testid={`card-tech-${i}`}
              >
                <div className="text-emerald-500">{item.icon}</div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-12 p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 text-center">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight mb-4">
              {t("about.commitmentTitle")}
            </h3>
            <p
              className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto"
              data-testid="text-commitment"
            >
              {t("about.commitmentBody")}
            </p>
          </div>
        </div>
      </section>

      <section
        className="py-24 border-y border-border bg-muted/20"
        data-testid="section-founder"
      >
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight uppercase mb-4">
              {t("about.founderTitle")}{" "}
              <span className="text-emerald-500">{t("about.founderTitleHighlight")}</span>
            </h2>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="bg-background border-border">
              <CardContent className="p-8 text-center">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                  <TrendingUp size={40} className="text-slate-950" />
                </div>

                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase tracking-widest mb-4"
                >
                  {t("about.founderRole")}
                </Badge>

                <h3
                  className="text-xl font-black text-foreground uppercase tracking-tight mb-2"
                  data-testid="text-founder-name"
                >
                  {t("about.founderName")}
                </h3>
                <p
                  className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6"
                  data-testid="text-founder-role"
                >
                  {t("about.founderTitleSub")}
                </p>

                <p
                  className="text-sm text-muted-foreground leading-relaxed mb-6"
                  data-testid="text-founder-bio"
                >
                  {t("about.founderBio1")}
                </p>

                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {t("about.founderBio2")}
                </p>

                <div className="pt-6 border-t border-border">
                  <p className="text-xs text-muted-foreground italic">
                    &ldquo;{t("about.founderQuote")}&rdquo;
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-b from-background to-muted">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tighter uppercase mb-6">
            {t("about.ctaTitle")}{" "}
            <span className="text-emerald-500">{t("about.ctaTitleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            {t("about.ctaSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" data-testid="link-about-signup">
              <Button
                className="h-14 px-10 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-emerald-400 shadow-xl shadow-emerald-500/20"
                data-testid="button-about-signup"
              >
                {t("about.ctaPrimary")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/features" data-testid="link-about-features">
              <Button
                variant="outline"
                className="h-14 px-10 bg-transparent border-border text-muted-foreground font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-muted"
                data-testid="button-about-features"
              >
                {t("about.ctaSecondary")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-border text-center">
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          <Link
            to="/features"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-footer-features"
          >
            {t("footer.features")}
          </Link>
          <Link
            to="/pricing"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-footer-pricing"
          >
            {t("footer.pricing")}
          </Link>
          <Link
            to="/how-it-works"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-footer-how-it-works"
          >
            {t("footer.howItWorks")}
          </Link>
          <Link
            to="/blog"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-footer-blog"
          >
            {t("footer.blog")}
          </Link>
          <Link
            to="/resources"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-footer-resources"
          >
            {t("footer.resources")}
          </Link>
          <Link
            to="/terms"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-footer-terms"
          >
            {t("footer.terms")}
          </Link>
          <Link
            to="/privacy"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-footer-privacy"
          >
            {t("footer.privacy")}
          </Link>
          <Link
            to="/risk-disclaimer"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-footer-risk"
          >
            {t("footer.riskDisclaimer")}
          </Link>
          <Link
            to="/cookie-policy"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-footer-cookie"
          >
            {t("footer.cookies")}
          </Link>
          <CookieSettingsButton />
          <a
            href="mailto:support@tradify.app?subject=TradifyApp Support Request"
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors"
            data-testid="link-contact-us-footer"
          >
            {t("footer.contactUs")}
          </a>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">
          {t("footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </footer>
    </div>
  );
}
