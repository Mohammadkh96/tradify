import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, Star, GraduationCap } from "lucide-react";
import { SiPaypal } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { BillingPeriod } from "@shared/plans";

type PlanTier = 'PRO' | 'ELITE' | 'COACH';

interface PayPalSubscriptionButtonProps {
  tier?: PlanTier;
  period?: BillingPeriod;
}

export default function PayPalSubscriptionButton({ tier = 'PRO', period = 'monthly' }: PayPalSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/paypal/subscribe", { tier, period });
      const data = await response.json();
      
      if (data.approvalUrl && data.subscriptionId) {
        sessionStorage.setItem('pending_paypal_subscription_id', data.subscriptionId);
        sessionStorage.setItem('pending_paypal_tier', tier);
        sessionStorage.setItem('pending_paypal_period', period);
        window.location.href = data.approvalUrl;
      } else {
        throw new Error("No approval URL received");
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      toast({
        title: "Subscription Error",
        description: error.message || "Failed to start subscription. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const isElite = tier === 'ELITE';
  const isCoach = tier === 'COACH';
  const PlanIcon = isCoach ? GraduationCap : isElite ? Crown : Star;
  const tierName = isCoach ? 'Coach' : isElite ? 'Elite' : 'Pro';
  const isAnnual = period === 'annual';
  
  const prices = {
    PRO: { monthly: 29, annual: 290, annualMonthly: 24 },
    ELITE: { monthly: 59, annual: 590, annualMonthly: 49 },
    COACH: { monthly: 99, annual: 990, annualMonthly: 82 },
  };
  
  const priceDisplay = isAnnual 
    ? `$${prices[tier].annualMonthly}/mo — $${prices[tier].annual}/yr`
    : `$${prices[tier].monthly}/mo`;

  return (
    <Button
      onClick={handleSubscribe}
      disabled={isLoading}
      className={`w-full h-12 text-white font-black uppercase tracking-widest text-xs shadow-lg ${
        isCoach ? 'bg-violet-500 hover:bg-violet-600' : isElite ? 'bg-amber-500' : 'bg-[#0070ba]'
      }`}
      data-testid="button-paypal-subscribe"
    >
      {isLoading ? (
        <Loader2 className="animate-spin h-4 w-4" />
      ) : (
        <>
          <SiPaypal className="mr-2 h-4 w-4" />
          Subscribe to {tierName} ({priceDisplay})
        </>
      )}
    </Button>
  );
}
