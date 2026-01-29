import { useQuery } from "@tanstack/react-query";
import { UserRole } from "@shared/schema";
import { 
  getPlanFeatures, 
  getPlanConfig, 
  canAccessFeature, 
  isPaidTier, 
  isEliteTier,
  getMaxStrategies,
  getHistoryDays,
  getUpgradeTarget,
  type PlanFeatures,
  type PlanConfig,
  type PlanTier
} from "@shared/plans";

export function usePlan() {
  const { data: user, isLoading } = useQuery<UserRole>({
    queryKey: ["/api/user"],
  });

  const tier = user?.subscriptionTier?.toUpperCase() as PlanTier | undefined;
  const features = getPlanFeatures(tier);
  const config = getPlanConfig(tier);

  return {
    tier: tier || "FREE" as PlanTier,
    features,
    config,
    isLoading,
    isPaid: isPaidTier(tier),
    isElite: isEliteTier(tier),
    isFree: !isPaidTier(tier),
    isPro: tier === "PRO",
    maxStrategies: getMaxStrategies(tier),
    historyDays: getHistoryDays(tier),
    upgradeTarget: getUpgradeTarget(tier),
    canAccess: (feature: keyof PlanFeatures) => canAccessFeature(tier, feature),
  };
}
