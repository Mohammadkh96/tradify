import { useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Check, Zap, Gift, Users, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PublicNavbar } from "@/components/PublicNavbar";

const benefits = [
  {
    icon: Gift,
    title: "Free Pro for 3 Months",
    description: "Full access to all Pro features, no credit card required"
  },
  {
    icon: Sparkles,
    title: "Lifetime 30% Discount",
    description: "Lock in exclusive pricing that never expires"
  },
  {
    icon: Users,
    title: "Shape the Product",
    description: "Direct access to founders, vote on features, influence roadmap"
  },
  {
    icon: Zap,
    title: "Founding Member Badge",
    description: "Exclusive badge displayed on your profile forever"
  }
];

export default function EarlyAccess() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/early-access/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        toast({
          title: "You're on the list!",
          description: "We'll reach out soon with your exclusive access.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Signup Failed",
          description: data.message || "Please try again.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      
      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-bold uppercase tracking-widest">Limited to First 100 Users</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black text-foreground uppercase italic tracking-tighter mb-4">
              Join the <span className="text-emerald-500">Founding</span> Circle
            </h1>
            
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Be among the first to experience TRADIFY. Early users get exclusive benefits 
              and help shape the future of disciplined trading.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {benefits.map((benefit, index) => (
              <Card key={index} className="bg-card/50 border-border">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">{benefit.title}</h3>
                      <p className="text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-gradient-to-b from-card to-card/50 border-emerald-500/20 overflow-hidden">
            <CardContent className="p-8">
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <Check className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">You're In!</h3>
                  <p className="text-muted-foreground mb-6">
                    Check your inbox for next steps. Welcome to the founding circle.
                  </p>
                  <Link to="/login">
                    <Button className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest">
                      Go to Login
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-foreground mb-2">Get Early Access</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your email to secure your spot as a Founding Member
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
                    <div>
                      <Input
                        type="text"
                        placeholder="Your name (optional)"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-muted border-border h-12"
                        data-testid="input-early-access-name"
                      />
                    </div>
                    <div>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-muted border-border h-12"
                        data-testid="input-early-access-email"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isSubmitting || !email}
                      className="w-full h-12 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest"
                      data-testid="button-early-access-submit"
                    >
                      {isSubmitting ? "Joining..." : "Join the Founding Circle"}
                    </Button>
                  </form>

                  <p className="text-center text-xs text-muted-foreground mt-4">
                    No spam, ever. Unsubscribe anytime.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-8">
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link to="/login" className="text-emerald-500 font-bold hover:underline">
                Log in
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
          <p className="text-sm text-muted-foreground">
            Rule-based trading journal for disciplined traders
          </p>
        </div>
      </footer>
    </div>
  );
}
