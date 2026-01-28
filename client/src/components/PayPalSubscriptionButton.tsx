import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { SiPaypal } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function PayPalSubscriptionButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/paypal/subscribe");
      const data = await response.json();
      
      if (data.approvalUrl && data.subscriptionId) {
        // Store subscription ID before redirecting to PayPal
        // This ensures we can activate even if PayPal doesn't pass it in URL
        sessionStorage.setItem('pending_paypal_subscription_id', data.subscriptionId);
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

  return (
    <Button
      onClick={handleSubscribe}
      disabled={isLoading}
      className="w-full h-12 bg-[#0070ba] hover:bg-[#003087] text-white font-black uppercase tracking-widest text-xs shadow-lg"
      data-testid="button-paypal-subscribe"
    >
      {isLoading ? (
        <Loader2 className="animate-spin h-4 w-4" />
      ) : (
        <>
          <SiPaypal className="mr-2 h-4 w-4" />
          Subscribe with PayPal
        </>
      )}
    </Button>
  );
}
