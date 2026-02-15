import { ShieldCheck, Check, X, ArrowRight, ExternalLink, Crown, Zap, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";
import { useQuery } from "@tanstack/react-query";
import { PLAN_CONFIGS, type BillingPeriod } from "@shared/plans";
import type { UserRole } from "@shared/schema";
import { SEO } from "@/components/SEO";
import { useState } from "react";

const features = [
  { name: "MT5 Multi-Account Sync", free: true, pro: true, elite: true },
  { name: "Open Positions & Account Health", free: true, pro: true, elite: true },
  { name: "Risk & Position Size Calculator", free: true, pro: true, elite: true },
  { name: "Psychology & Mood Tracking", free: true, pro: true, elite: true },
  { name: "CSV Trade Import", free: true, pro: true, elite: true },
  { name: "Dashboard Customization", free: true, pro: true, elite: true },
  { name: "1 Trading Strategy", free: true, pro: true, elite: true },
  { name: "Trade History", free: "30 Days", pro: "6 Months", elite: "Unlimited" },
  { name: "Education Access", free: "3 Lessons", pro: "Full Hub (20)", elite: "Full Hub (20)" },
  { name: "Unlimited Trading Strategies", free: false, pro: true, elite: true },
  { name: "Performance Intelligence Layer", free: false, pro: true, elite: true },
  { name: "Full Equity Curve (All-Time)", free: false, pro: true, elite: true },
  { name: "AI Instrument Analysis", free: false, pro: true, elite: true },
  { name: "AI Psychology Review", free: false, pro: true, elite: true },
  { name: "Prop Firm Challenge Tracker", free: false, pro: true, elite: true },
  { name: "CSV Data Export", free: false, pro: true, elite: true },
  { name: "PDF Report Generation", free: false, pro: true, elite: true },
  { name: "AI Challenge Risk Warnings", free: false, pro: false, elite: true },
  { name: "Session Performance Analytics", free: false, pro: false, elite: true },
  { name: "Time Pattern Analysis", free: false, pro: false, elite: true },
  { name: "Behavioral Risk Flags", free: false, pro: false, elite: true },
  { name: "Strategy Deviation Analysis", free: false, pro: false, elite: true },
  { name: "Monthly AI Performance Review", free: false, pro: false, elite: true },
  { name: "Priority Support", free: false, pro: false, elite: true },
  { name: "Elite Member Badge", free: false, pro: false, elite: true },
];

export default function Pricing() {
  const { isPro, isElite, isPaid, tier } = usePlan();
  const proConfig = PLAN_CONFIGS.PRO;
  const eliteConfig = PLAN_CONFIGS.ELITE;
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
  const proOriginalMonthly = proConfig.pricing.monthly;
  const eliteOriginalMonthly = eliteConfig.pricing.monthly;

  const handleManageSubscription = () => {
    window.open('https://www.paypal.com/myaccount/autopay', '_blank');
  };

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <SEO 
        title="Pricing - Free, Pro & Elite Plans | Tradify"
        description="Choose your Tradify plan. Free MT5 sync, Pro analytics at $29/mo, or Elite with AI insights at $59/mo. Founding members get 30% off forever."
        canonical="https://tradifyapp.com/pricing"
      />
      <main className="p-6 lg:p-10 max-w-6xl mx-auto">
        <header className="text-center mb-10">
          <p className="text-muted-foreground max-w-2xl mx-auto uppercase text-[10px] font-bold tracking-[0.2em] mb-4">
            Not financial advice. Trading involves risk.
          </p>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase italic mb-4">
            Simple Pricing. <span className="text-emerald-500">No Hype.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start free. Upgrade only when you need deeper insights to master your trading discipline.
          </p>
          {isFoundingMember && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Crown size={16} className="text-amber-500" />
              <span className="text-amber-500 font-bold text-sm uppercase tracking-widest">
                Founding Member: 30% Lifetime Discount Applied
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
              Monthly
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
              Annual
              <span className={`absolute -top-2.5 -right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                isAnnual ? "bg-amber-500 text-white" : "bg-emerald-500/20 text-emerald-500"
              }`}>
                SAVE
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {/* Free Plan */}
          <Card className="bg-card border-border shadow-2xl relative overflow-hidden group">
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={20} className="text-muted-foreground" />
                  <h3 className="text-lg font-bold text-muted-foreground uppercase tracking-widest">Free</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-foreground">$0</span>
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">/ Forever</span>
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
                {tier === "FREE" ? "Current Plan" : "Downgrade"}
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="bg-card border-emerald-500/30 shadow-2xl relative overflow-hidden group scale-[1.02]">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 uppercase tracking-widest rounded-bl-lg">
              Popular
            </div>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={20} className="text-emerald-500" />
                  <h3 className="text-lg font-bold text-emerald-500 uppercase tracking-widest">Pro</h3>
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
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">/ Month</span>
                </div>
                {isAnnual && (
                  <p className="text-emerald-500 text-xs font-bold mt-1">
                    ${isFoundingMember ? proAnnualPrice : proConfig.pricing.annual}/yr — Save ${isFoundingMember ? Math.round(proConfig.pricing.annualSavings * (1 - discountRate)) : proConfig.pricing.annualSavings}/yr
                  </p>
                )}
                {isFoundingMember && (
                  <Badge className="mt-2 bg-amber-500/20 text-amber-500 border-amber-500/30 text-[9px] uppercase tracking-widest">
                    <Crown size={10} className="mr-1" /> Founder Discount
                  </Badge>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <div className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest mb-2">Everything in Free, plus:</div>
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
                  Manage Subscription
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              ) : isElite ? (
                <Button 
                  variant="outline"
                  className="w-full h-12 font-bold uppercase tracking-widest text-xs border-border"
                  disabled
                  data-testid="button-downgrade-pro"
                >
                  Downgrade
                </Button>
              ) : (
                <Button 
                  className="w-full h-12 bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-xs"
                  data-testid="button-upgrade-pro"
                  onClick={() => window.location.href = `/checkout?plan=PRO&period=${billingPeriod}`}
                >
                  Upgrade to Pro
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Elite Plan */}
          <Card className="bg-gradient-to-b from-amber-500/10 to-card border-amber-500/30 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black px-3 py-1 uppercase tracking-widest rounded-bl-lg">
              Elite
            </div>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={20} className="text-amber-500" />
                  <h3 className="text-lg font-bold text-amber-500 uppercase tracking-widest">Elite</h3>
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
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">/ Month</span>
                </div>
                {isAnnual && (
                  <p className="text-amber-500 text-xs font-bold mt-1">
                    ${isFoundingMember ? eliteAnnualPrice : eliteConfig.pricing.annual}/yr — Save ${isFoundingMember ? Math.round(eliteConfig.pricing.annualSavings * (1 - discountRate)) : eliteConfig.pricing.annualSavings}/yr
                  </p>
                )}
                {isFoundingMember && (
                  <Badge className="mt-2 bg-amber-500/20 text-amber-500 border-amber-500/30 text-[9px] uppercase tracking-widest">
                    <Crown size={10} className="mr-1" /> Founder Discount
                  </Badge>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <div className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest mb-2">Everything in Pro, plus:</div>
                {features.filter(f => f.elite && !f.pro).map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check size={14} className="text-amber-500 flex-shrink-0" />
                    <span className="text-sm text-foreground font-medium">{f.name}</span>
                  </div>
                ))}
              </div>

              {isElite ? (
                <Button 
                  onClick={handleManageSubscription}
                  className="w-full h-12 bg-amber-500 text-white font-black uppercase tracking-[0.15em] text-xs"
                  data-testid="button-manage-elite"
                >
                  Manage Subscription
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  className="w-full h-12 bg-amber-500 text-white font-black uppercase tracking-[0.15em] text-xs"
                  data-testid="button-upgrade-elite"
                  onClick={() => window.location.href = `/checkout?plan=ELITE&period=${billingPeriod}`}
                >
                  Upgrade to Elite
                  <Crown className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comparison Section */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10 uppercase tracking-widest">Full Comparison</h2>
          <div className="bg-card border border-border rounded-2xl overflow-x-auto shadow-2xl">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest">Feature</th>
                  <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest text-center">Free</th>
                  <th className="p-4 text-xs font-black text-emerald-500 uppercase tracking-widest text-center">Pro</th>
                  <th className="p-4 text-xs font-black text-amber-500 uppercase tracking-widest text-center">Elite</th>
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
            { title: "No Credentials Needed", desc: "We never access your broker login. MT5 runs locally via terminal sync." },
            { title: "Cancel Anytime", desc: "No long-term contracts. Pause or downgrade whenever you choose." },
            { title: "Data Transparency", desc: "Your data belongs to you. Export your history at any time with Pro." }
          ].map((item, i) => (
            <div key={i} className="bg-card border border-border p-6 rounded-2xl text-center">
              <ShieldCheck size={24} className="text-emerald-500 mx-auto mb-4" />
              <h4 className="font-bold text-foreground mb-2">{item.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center pb-20">
          <h3 className="text-2xl font-bold text-foreground mb-6">Ready to upgrade your trading edge?</h3>
          {isPaid ? (
            <Button 
              onClick={handleManageSubscription}
              className="h-14 px-10 bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-xs shadow-xl shadow-emerald-500/20"
              data-testid="button-manage-account"
            >
              Manage Your Account
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              className="h-14 px-10 bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-xs shadow-xl shadow-emerald-500/20"
              data-testid="button-start-pro-trial"
              onClick={() => window.location.href = `/checkout?plan=PRO&period=${billingPeriod}`}
            >
              Start Your Pro Journey
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
