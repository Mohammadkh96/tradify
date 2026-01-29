import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ExternalLink, ShieldCheck, AlertCircle, CheckCircle2, Crown, Star } from "lucide-react";
import { SiPaypal } from "react-icons/si";
import PayPalSubscriptionButton from "@/components/PayPalSubscriptionButton";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

type PlanTier = 'PRO' | 'ELITE';

const PLAN_DETAILS: Record<PlanTier, { name: string; price: string; color: string; icon: any }> = {
  PRO: { name: 'Pro', price: '$19', color: 'emerald', icon: Star },
  ELITE: { name: 'Elite', price: '$39', color: 'amber', icon: Crown },
};

export default function Checkout() {
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useQuery<any>({ queryKey: ["/api/user"] });
  const [isActivating, setIsActivating] = useState(false);
  
  // Get plan from URL params
  const params = new URLSearchParams(window.location.search);
  const urlPlan = params.get('plan')?.toUpperCase();
  const selectedTier: PlanTier = urlPlan === 'ELITE' ? 'ELITE' : 'PRO';
  const planDetails = PLAN_DETAILS[selectedTier];

  // Handle subscription return URLs
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionStatus = params.get('subscription');
    // Get tier from URL first, then from sessionStorage
    let tier = params.get('tier') as PlanTier;
    if (!tier) {
      tier = (sessionStorage.getItem('pending_paypal_tier') as PlanTier) || 'PRO';
    }
    let subscriptionId = params.get('subscription_id');
    if (!subscriptionId) {
      subscriptionId = sessionStorage.getItem('pending_paypal_subscription_id');
    }
    
    const activateSubscription = async () => {
      if (subscriptionStatus === 'success' && subscriptionId && !isActivating) {
        setIsActivating(true);
        sessionStorage.removeItem('pending_paypal_subscription_id');
        sessionStorage.removeItem('pending_paypal_tier');
        
        try {
          // Server determines actual tier from PayPal plan_id, tier is just a hint
          const res = await apiRequest("POST", "/api/paypal/subscription/activate", { subscriptionId, tier });
          const result = await res.json();
          
          const tierName = tier === 'ELITE' ? 'Elite' : 'Pro';
          if (result.success) {
            toast({
              title: "Subscription Activated!",
              description: `Welcome to Tradify ${tierName}! Your subscription is now active.`,
            });
          } else {
            toast({
              title: "Subscription Pending",
              description: "Your subscription is being processed. It may take a moment to activate.",
            });
          }
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        } catch (error) {
          console.error("Activation error:", error);
          toast({
            title: "Subscription Processing",
            description: "Your subscription is being set up. Please refresh in a moment.",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        } finally {
          setIsActivating(false);
        }
        window.history.replaceState({}, '', '/checkout');
      } else if (subscriptionStatus === 'success' && !subscriptionId) {
        toast({
          title: "Subscription Processing",
          description: "Your subscription is being processed. Please wait a moment.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        window.history.replaceState({}, '', '/checkout');
      } else if (subscriptionStatus === 'cancelled') {
        sessionStorage.removeItem('pending_paypal_subscription_id');
        sessionStorage.removeItem('pending_paypal_tier');
        toast({
          title: "Subscription Cancelled",
          description: "You cancelled the subscription process.",
          variant: "destructive",
        });
        window.history.replaceState({}, '', '/checkout');
      }
    };
    
    activateSubscription();
  }, [toast, isActivating]);

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const subscription = user?.subscriptionTier?.toUpperCase() || "FREE";
  const isPro = subscription === "PRO";
  const isElite = subscription === "ELITE";
  const isPaid = isPro || isElite;

  const PlanIcon = planDetails.icon;
  const isElitePlan = selectedTier === 'ELITE';

  return (
    <div className="flex-1 bg-background text-foreground min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase italic mb-2">
            Billing & <span className={isElitePlan ? "text-amber-500" : "text-emerald-500"}>Subscription</span>
          </h1>
          <p className="text-muted-foreground font-medium">Manage your payment methods and subscription status.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Current Status */}
          <Card className="bg-card border-border shadow-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border">
              <CardTitle className="text-lg font-black text-foreground uppercase tracking-widest">Current Plan</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Your subscription tier and cycle.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Plan</p>
                  <p className={`text-xl font-black uppercase tracking-tight italic ${isElite ? 'text-amber-500' : isPro ? 'text-emerald-500' : 'text-foreground'}`}>
                    {subscription}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                  <p className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    isElite ? "bg-amber-500/10 text-amber-500" : isPro ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                  }`}>
                    {isPaid ? "Active" : "INACTIVE"}
                  </p>
                </div>
              </div>

              {isPaid && (
                <div className={`p-4 rounded-xl border ${isElite ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                  <div className="flex items-start gap-3">
                    <ShieldCheck className={`w-5 h-5 mt-0.5 ${isElite ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <div>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">
                        {isElite ? 'Elite' : 'Pro'} Features Enabled
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-bold leading-tight">
                        {isElite 
                          ? 'You have full access to all features including priority support and advanced analytics.'
                          : 'You have full access to performance intelligence, unlimited journal history, and priority MT5 sync.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isPaid ? (
                <Button 
                  onClick={() => window.location.href = '/profile'}
                  className={`w-full h-12 text-white font-black uppercase tracking-widest text-xs shadow-lg ${
                    isElite ? 'bg-amber-500 shadow-amber-500/20' : 'bg-emerald-500 shadow-emerald-500/20'
                  }`}
                  data-testid="button-manage-subscription"
                >
                  Manage Subscription in Profile
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <p className="text-[10px] text-muted-foreground text-center font-black uppercase tracking-widest opacity-50">
                  Upgrade to unlock institutional tools.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment Method / Upgrade */}
          <Card className={`bg-card shadow-2xl overflow-hidden ${
            isElitePlan ? 'border-amber-500/30' : 'border-emerald-500/30'
          }`}>
            <CardHeader className="bg-muted/30 border-b border-border">
              <div className="flex items-center gap-2">
                <PlanIcon className={isElitePlan ? "w-5 h-5 text-amber-500" : "w-5 h-5 text-emerald-500"} />
                <CardTitle className={isElitePlan ? "text-lg font-black uppercase tracking-widest text-amber-500" : "text-lg font-black uppercase tracking-widest text-emerald-500"}>
                  {isPaid ? "Subscription Details" : `Upgrade to ${planDetails.name}`}
                </CardTitle>
              </div>
              <CardDescription className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                {isPaid ? "Current provider info." : `${planDetails.price}/month - Cancel anytime.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {isPaid ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
                    <SiPaypal className="text-[#0070ba] w-6 h-6" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Provider</p>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight font-mono">PayPal</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                    isElite ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
                  }`}>
                    <CheckCircle2 className={`w-4 h-4 ${isElite ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <span className={`text-xs font-bold ${isElite ? 'text-amber-500' : 'text-emerald-500'}`}>Subscription Active</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] leading-relaxed text-center opacity-50 italic">
                    Manage your subscription in Profile.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border">
                    <SiPaypal className="text-[#0070ba] w-6 h-6" />
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Payment Method</p>
                      <p className="text-sm font-black text-foreground uppercase tracking-tight">PayPal Subscription</p>
                    </div>
                  </div>

                  <PayPalSubscriptionButton tier={selectedTier} />

                  {/* Plan Toggle */}
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant={selectedTier === 'PRO' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => window.location.href = '/checkout?plan=PRO'}
                      className={selectedTier === 'PRO' ? 'bg-emerald-500' : ''}
                      data-testid="button-select-pro"
                    >
                      <Star className="w-3 h-3 mr-1" /> Pro $19
                    </Button>
                    <Button
                      variant={selectedTier === 'ELITE' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => window.location.href = '/checkout?plan=ELITE'}
                      className={selectedTier === 'ELITE' ? 'bg-amber-500' : ''}
                      data-testid="button-select-elite"
                    >
                      <Crown className="w-3 h-3 mr-1" /> Elite $39
                    </Button>
                  </div>

                  <div className="flex items-start gap-2 text-[9px] text-muted-foreground font-black uppercase tracking-widest bg-muted/30 p-3 rounded-lg border border-border/50 italic">
                    <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                    <span>Recurring monthly billing. Cancel anytime via Profile.</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
