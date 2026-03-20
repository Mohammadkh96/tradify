import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Zap, Gift, Users, ArrowRight, Sparkles, Shield, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicNavbar } from "@/components/PublicNavbar";
import { SEO } from "@/components/SEO";

const benefits = [
  {
    icon: Zap,
    title: "1 Month Free Pro Access",
    description: "Full access to Pro features automatically granted when you sign up. No upfront commitment required."
  },
  {
    icon: Gift,
    title: "30% Lifetime Discount",
    description: "Secure a 30% discounted subscription rate, maintained for as long as your subscription remains active."
  },
  {
    icon: Users,
    title: "Influence the Roadmap",
    description: "Provide structured feedback, help prioritize features, and contribute to the product's early development cycle."
  },
  {
    icon: Shield,
    title: "Permanent Founder Badge",
    description: "A permanent founding member identifier displayed on your profile — locked in forever."
  }
];

interface FounderCount {
  claimed: number;
  remaining: number;
  total: number;
  isFull: boolean;
}

export default function EarlyAccess() {
  const [founderCount, setFounderCount] = useState<FounderCount | null>(null);

  useEffect(() => {
    fetch("/api/founding-members/count")
      .then(r => r.json())
      .then(d => setFounderCount(d))
      .catch(() => {});
  }, []);

  const progressPct = founderCount ? (founderCount.claimed / founderCount.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Founding Member Program - Early Access | Tradify"
        description="Join Tradify's Founding Member program. Get 1 month free Pro access, 30% lifetime discount, influence the roadmap, and earn your permanent founder badge. First 500 users only."
        canonical="https://tradifyapp.com/early-access"
      />
      <PublicNavbar />
      
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-bold uppercase tracking-widest">Founding Member Program</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black text-foreground uppercase italic tracking-tighter mb-6">
              Founding Member <span className="text-emerald-500">Access</span>
            </h1>
            
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              The first <span className="text-foreground font-bold">500 users</span> who sign up automatically become Founding Members — no form, no waitlist. Just create your account before spots run out.
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
                      ? "All Spots Claimed"
                      : `${founderCount.remaining} Spots Remaining`
                    : "Loading..."}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {founderCount
                    ? `${founderCount.claimed} of ${founderCount.total} founding member spots claimed`
                    : "Fetching live count..."}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  <span>0</span>
                  <span>{founderCount ? Math.round(progressPct) : 0}% Claimed</span>
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
                    {founderCount ? founderCount.claimed : "—"} claimed
                  </span>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    {founderCount ? founderCount.remaining : "—"} left
                  </span>
                </div>
              </div>

              {founderCount?.isFull ? (
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-4">The founding member program is now closed. You can still create a free account.</p>
                  <Link to="/signup">
                    <Button className="bg-muted text-foreground font-black uppercase tracking-widest px-10 h-12" data-testid="button-signup-after-cap">
                      Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-5">
                    No email submission needed — just sign up and founding member status is <span className="text-amber-500 font-bold">applied automatically</span>.
                  </p>
                  <Link to="/signup">
                    <Button className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-sm px-10 h-14 shadow-xl shadow-amber-500/20" data-testid="button-claim-founding-spot">
                      <Crown className="mr-2 h-4 w-4" />
                      Claim Your Founding Spot
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <p className="text-[10px] text-muted-foreground mt-3 font-bold uppercase tracking-widest">
                    Free to start · No credit card required
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
              Already have an account?{" "}
              <Link to="/login" className="text-emerald-500 font-bold hover:underline">
                Sign in
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
            Trading Discipline Platform — Your Rules. Enforced.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/terms" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Terms</Link>
            <Link to="/privacy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Privacy</Link>
            <Link to="/risk-disclaimer" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Risk Disclaimer</Link>
            <Link to="/cookie-policy" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-emerald-500 transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
