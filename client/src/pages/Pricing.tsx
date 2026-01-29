import { ShieldCheck, Check, X, ArrowRight, ExternalLink, Crown, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { usePlan } from "@/hooks/usePlan";
import { PLAN_CONFIGS } from "@shared/plans";

const features = [
  { name: "Live MT5 Data Connection", free: true, pro: true, elite: true },
  { name: "Open Positions & Account Health", free: true, pro: true, elite: true },
  { name: "Risk & Position Size Calculator", free: true, pro: true, elite: true },
  { name: "30-Day Trade Journal History", free: true, pro: true, elite: true },
  { name: "Institutional Knowledge Base", free: true, pro: true, elite: true },
  { name: "1 Trading Strategy", free: true, pro: false, elite: false },
  { name: "Unlimited Trading Strategies", free: false, pro: true, elite: true },
  { name: "Performance Intelligence Layer", free: false, pro: true, elite: true },
  { name: "6-Month Trade History (Pro)", free: false, pro: true, elite: false },
  { name: "Unlimited Trade History (Elite)", free: false, pro: false, elite: true },
  { name: "AI Instrument Analysis", free: false, pro: true, elite: true },
  { name: "CSV Data Export", free: false, pro: true, elite: true },
  { name: "Session Performance Analytics", free: false, pro: false, elite: true },
  { name: "Time Pattern Analysis", free: false, pro: false, elite: true },
  { name: "PDF Report Generation", free: false, pro: false, elite: true },
  { name: "Priority Support", free: false, pro: false, elite: true },
  { name: "Elite Member Badge", free: false, pro: false, elite: true },
];

export default function Pricing() {
  const { isPro, isElite, isPaid, tier } = usePlan();
  const proConfig = PLAN_CONFIGS.PRO;
  const eliteConfig = PLAN_CONFIGS.ELITE;

  const handleManageSubscription = () => {
    window.open('https://www.paypal.com/myaccount/billing/subscriptions', '_blank');
  };

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-6xl mx-auto">
        <header className="text-center mb-16">
          <p className="text-muted-foreground max-w-2xl mx-auto uppercase text-[10px] font-bold tracking-[0.2em] mb-4">
            Not financial advice. Trading involves risk.
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase italic mb-4">
            Simple Pricing. <span className="text-emerald-500">No Hype.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start free. Upgrade only when you need deeper insights to master your trading discipline.
          </p>
        </header>

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
                  <span className="text-4xl font-black text-foreground">$19</span>
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">/ Month</span>
                </div>
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
                  Current: Elite
                </Button>
              ) : (
                <Link href="/checkout?plan=PRO">
                  <Button 
                    className="w-full h-12 bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-xs"
                    data-testid="button-upgrade-pro"
                  >
                    Upgrade to Pro
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
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
                  <span className="text-4xl font-black text-foreground">$39</span>
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs">/ Month</span>
                </div>
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
                <Link href="/checkout?plan=ELITE">
                  <Button 
                    className="w-full h-12 bg-amber-500 text-white font-black uppercase tracking-[0.15em] text-xs"
                    data-testid="button-upgrade-elite"
                  >
                    Upgrade to Elite
                    <Crown className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comparison Section */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10 uppercase tracking-widest">Full Comparison</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest">Feature</th>
                  <th className="p-4 text-xs font-black text-muted-foreground uppercase tracking-widest text-center">Free</th>
                  <th className="p-4 text-xs font-black text-emerald-500 uppercase tracking-widest text-center">Pro</th>
                  <th className="p-4 text-xs font-black text-amber-500 uppercase tracking-widest text-center">Elite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {features.map((f, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-sm text-muted-foreground font-medium">{f.name}</td>
                    <td className="p-4 text-center">
                      {f.free ? <Check size={16} className="text-emerald-500 mx-auto" /> : <X size={16} className="text-muted-foreground mx-auto" />}
                    </td>
                    <td className="p-4 text-center">
                      {f.pro ? <Check size={16} className="text-emerald-500 mx-auto" /> : <X size={16} className="text-muted-foreground mx-auto" />}
                    </td>
                    <td className="p-4 text-center">
                      {f.elite ? <Check size={16} className="text-amber-500 mx-auto" /> : <X size={16} className="text-muted-foreground mx-auto" />}
                    </td>
                  </tr>
                ))}
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
            <Link href="/checkout?plan=PRO">
              <Button 
                className="h-14 px-10 bg-emerald-500 text-white font-black uppercase tracking-[0.15em] text-xs shadow-xl shadow-emerald-500/20"
                data-testid="button-start-pro-trial"
              >
                Start Your Pro Journey
              </Button>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
