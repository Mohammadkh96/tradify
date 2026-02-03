import { useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Check, Zap, Gift, Users, ArrowRight, Sparkles, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PublicNavbar } from "@/components/PublicNavbar";

const benefits = [
  {
    icon: Zap,
    title: "Early Pro Access",
    description: "Full access to Pro features during the early launch phase. No upfront commitment required."
  },
  {
    icon: Gift,
    title: "Founding Member Pricing",
    description: "Secure a 30% discounted subscription rate, maintained for as long as your subscription remains active."
  },
  {
    icon: Users,
    title: "Influence the Roadmap",
    description: "Provide structured feedback, help prioritize features, and contribute to the product's early development cycle."
  },
  {
    icon: Shield,
    title: "Founding Member Identification",
    description: "A permanent founding member identifier displayed on your profile."
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
          title: "Request Received",
          description: "We'll be in touch with your access details.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Request Failed",
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
              <span className="text-amber-400 text-sm font-bold uppercase tracking-widest">Early Access — Limited Availability</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black text-foreground uppercase italic tracking-tighter mb-6">
              Founding Member <span className="text-emerald-500">Access</span>
            </h1>
            
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              Gain early access to Tradify and participate in the initial launch cohort.
            </p>
            <p className="text-muted-foreground max-w-2xl mx-auto mt-2">
              Founding members receive extended access, preferential pricing, and the opportunity to influence product direction.
            </p>
          </div>

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

          <Card className="bg-gradient-to-b from-card to-card/50 border-emerald-500/20 overflow-hidden">
            <CardContent className="p-8">
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <Check className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Request Confirmed</h3>
                  <p className="text-muted-foreground mb-6">
                    We'll follow up with your founding member access details shortly.
                  </p>
                  <Link to="/login">
                    <Button className="bg-emerald-500 text-slate-950 font-black uppercase tracking-widest">
                      Continue to Login
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-foreground mb-2">Request Founding Access</h3>
                    <p className="text-sm text-muted-foreground">
                      Enter your details to join the founding member cohort
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
                      {isSubmitting ? "Processing..." : "Request Founding Access"}
                    </Button>
                  </form>

                  <p className="text-center text-xs text-muted-foreground mt-4">
                    Your information is kept confidential.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-8">
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
          <p className="text-sm text-muted-foreground">
            Rule-based trading journal for disciplined traders
          </p>
        </div>
      </footer>
    </div>
  );
}
