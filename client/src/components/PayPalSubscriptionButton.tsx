import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, Star } from "lucide-react";
import { SiPaypal } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type PlanTier = 'PRO' | 'ELITE';

interface PayPalSubscriptionButtonProps {
  tier?: PlanTier;
}

export default function PayPalSubscriptionButton({ tier = 'PRO' }: PayPalSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/paypal/subscribe", { tier });
      const data = await response.json();
      
      if (data.approvalUrl && data.subscriptionId) {
        sessionStorage.setItem('pending_paypal_subscription_id', data.subscriptionId);
        sessionStorage.setItem('pending_paypal_tier', tier);
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
  const PlanIcon = isElite ? Crown : Star;
  const tierName = isElite ? 'Elite' : 'Pro';
  const price = isElite ? '$59' : '$29';

  return (
    <Button
      onClick={handleSubscribe}
      disabled={isLoading}
      className={`w-full h-12 text-white font-black uppercase tracking-widest text-xs shadow-lg ${
        isElite 
          ? 'bg-amber-500' 
          : 'bg-[#0070ba]'
      }`}
      data-testid="button-paypal-subscribe"
    >
      {isLoading ? (
        <Loader2 className="animate-spin h-4 w-4" />
      ) : (
        <>
          <SiPaypal className="mr-2 h-4 w-4" />
          Subscribe to {tierName} ({price}/mo)
        </>
      )}
    </Button>
  );
}
