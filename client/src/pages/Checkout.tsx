import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CreditCard, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";
import { SiPaypal } from "react-icons/si";
import { useState } from "react";
import { cn } from "@/lib/utils";
import PayPalButton from "@/components/PayPalButton";

export default function Checkout() {
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useQuery<any>({ queryKey: ["/api/user"] });
  const { data: products } = useQuery<any[]>({ queryKey: ["/api/billing/products"] });
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "paypal">("stripe");

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return await res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Portal Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/billing/checkout", { priceId });
      return await res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to initiate checkout",
        variant: "destructive",
      });
    }
  });

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  const isPro = user?.subscriptionTier === "PRO" || user?.subscriptionTier === "pro";
  const proProduct = products?.find(p => p.metadata?.plan === 'PRO' || p.name === 'Pro Plan');
  const monthlyPrice = proProduct?.prices?.find((p: any) => p.recurring?.interval === 'month');

  return (
    <div className="flex-1 bg-background text-foreground min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase italic mb-2">
            Billing & <span className="text-primary">Subscription</span>
          </h1>
          <p className="text-muted-foreground">Manage your payment methods and subscription status.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Current Status */}
          <Card className="bg-card border-border shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-foreground uppercase tracking-widest text-muted-foreground">Current Plan</CardTitle>
              <CardDescription className="text-muted-foreground">Your current subscription tier and billing cycle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                <div>
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Plan</p>
                  <p className="text-xl font-bold text-foreground uppercase">{user?.subscriptionTier || "FREE"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                  <p className={cn(
                    "text-sm font-bold uppercase",
                    isPro ? "text-primary" : "text-muted-foreground"
                  )}>
                    {isPro ? "Active" : "No Active Subscription"}
                  </p>
                </div>
              </div>

              {isPro && (
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="text-primary w-5 h-5 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-foreground">Pro Features Enabled</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        You have full access to performance intelligence, unlimited journal history, and priority MT5 sync.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isPro ? (
                <Button 
                  onClick={() => {
                    if (user?.subscriptionProvider === 'paypal') {
                      window.open('https://www.paypal.com/myaccount/billing/subscriptions', '_blank');
                    } else {
                      portalMutation.mutate();
                    }
                  }}
                  disabled={portalMutation.isPending}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs"
                >
                  {portalMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : (
                    <>
                      {user?.subscriptionProvider === 'paypal' ? "Manage on PayPal" : "Manage Billing Portal"}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground text-center italic">
                  Upgrade to unlock professional trading tools and deep performance analytics.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment Method / Upgrade */}
          <Card className="bg-card border-border shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-foreground uppercase tracking-widest text-muted-foreground">
                {isPro ? "Subscription Details" : "Upgrade to Pro"}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {isPro ? "Details of your current provider." : "Select your preferred payment method."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isPro ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                    {user?.subscriptionProvider === 'paypal' ? (
                      <SiPaypal className="text-[#0070ba] w-6 h-6" />
                    ) : (
                      <CreditCard className="text-primary w-6 h-6" />
                    )}
                    <div>
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Provider</p>
                      <p className="text-sm font-bold text-foreground uppercase">{user?.subscriptionProvider || "Stripe"}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] leading-relaxed">
                    Subscription management is handled securely through the provider's official portal.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2 p-1 bg-muted/50 rounded-lg border border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPaymentMethod("stripe")}
                      className={cn(
                        "flex-1 gap-2 text-[10px] font-bold uppercase tracking-widest h-8",
                        paymentMethod === "stripe" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"
                      )}
                    >
                      <CreditCard size={12} />
                      Stripe
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPaymentMethod("paypal")}
                      className={cn(
                        "flex-1 gap-2 text-[10px] font-bold uppercase tracking-widest h-8",
                        paymentMethod === "paypal" ? "bg-[#0070ba] text-white hover:bg-[#005ea6]" : "text-muted-foreground"
                      )}
                    >
                      <SiPaypal size={12} />
                      PayPal
                    </Button>
                  </div>

                  {paymentMethod === "stripe" ? (
                    <Button 
                      onClick={() => monthlyPrice && checkoutMutation.mutate(monthlyPrice.id)}
                      disabled={checkoutMutation.isPending || !monthlyPrice}
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs"
                    >
                      {checkoutMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "Subscribe with Stripe"}
                    </Button>
                  ) : (
                    <div className="w-full bg-white rounded-md p-1">
                      <PayPalButton amount="19.00" currency="USD" intent="subscription" />
                    </div>
                  )}

                  <div className="flex items-start gap-2 text-[10px] text-muted-foreground uppercase tracking-widest bg-muted/30 p-3 rounded border border-border/50">
                    <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                    <span>Subscriptions automatically renew. Cancel anytime in your billing settings.</span>
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
