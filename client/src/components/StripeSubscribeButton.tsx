import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { BillingPeriod } from "@shared/plans";

type PlanTier = "PRO" | "ELITE" | "COACH";

interface Props {
  tier?: PlanTier;
  period?: BillingPeriod;
}

export default function StripeSubscribeButton({ tier = "PRO", period = "monthly" }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/subscribe", { tier, period });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: any) {
      console.error("Stripe subscription error:", error);
      toast({
        title: "Checkout error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSubscribe}
      disabled={isLoading}
      variant="outline"
      className="w-full h-12 font-black uppercase tracking-widest text-xs border-foreground/20 hover:border-foreground/40"
      data-testid={`button-stripe-subscribe-${tier.toLowerCase()}`}
    >
      {isLoading ? (
        <Loader2 className="animate-spin h-4 w-4" />
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          Pay with card
        </>
      )}
    </Button>
  );
}
