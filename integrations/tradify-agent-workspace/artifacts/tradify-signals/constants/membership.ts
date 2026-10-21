import type { Feather } from "@expo/vector-icons";
import type { CustomerAccessPolicy } from "@workspace/api-client-react";

export type MembershipTier = "Free" | "Pro" | "VIP";
export type PaidMembershipTier = Exclude<MembershipTier, "Free">;
export type MembershipFeature =
  | "signalContext"
  | "trustedSetupLevels"
  | "performanceContext"
  | "priceAlerts"
  | "fullDepthReview";

const membershipRank: Record<MembershipTier, number> = { Free: 0, Pro: 1, VIP: 2 };

const defaultMarketTiers: CustomerAccessPolicy["marketTiers"] = {
  USOIL: "Free",
  BTCUSD: "Free",
  ETHUSD: "Free",
  XAUUSD: "Pro",
  XAGUSD: "Pro",
  US100: "Pro",
  US30: "Pro",
  US500: "Pro",
  GER40: "Pro",
  UK100: "Pro",
  JP225: "Pro",
  EURUSD: "Pro",
  GBPUSD: "Pro",
  USDJPY: "Pro",
  AUDUSD: "Pro",
  USDCAD: "Pro",
  USDCHF: "Pro",
  NZDUSD: "Pro",
  EURGBP: "Pro",
  EURJPY: "Pro",
  GBPJPY: "Pro",
  AUDJPY: "Pro",
};

export const DEFAULT_ACCESS_POLICY: CustomerAccessPolicy = {
  rowVersion: 0,
  featureMinimumTiers: {
    signalContext: "Pro",
    trustedSetupLevels: "Pro",
    performanceContext: "Pro",
    priceAlerts: "Pro",
    fullDepthReview: "VIP",
  },
  marketTiers: defaultMarketTiers,
  watchlistLimits: { Free: 3, Pro: 22, VIP: null },
};

export function membershipMeetsTier(tier: MembershipTier, requiredTier: MembershipTier): boolean {
  return membershipRank[tier] >= membershipRank[requiredTier];
}

export function hasMembershipFeature(
  tier: MembershipTier,
  feature: MembershipFeature,
  accessPolicy: CustomerAccessPolicy = DEFAULT_ACCESS_POLICY,
): boolean {
  return membershipMeetsTier(tier, accessPolicy.featureMinimumTiers[feature]);
}

export function membershipMarketCounts(accessPolicy: CustomerAccessPolicy): {
  free: number;
  pro: number;
  vip: number;
  total: number;
} {
  const counts = { free: 0, pro: 0, vip: 0, total: 0 };
  for (const tier of Object.values(accessPolicy.marketTiers)) {
    counts.total += 1;
    if (tier === "Free") counts.free += 1;
    else if (tier === "Pro") counts.pro += 1;
    else counts.vip += 1;
  }
  if (accessPolicy.rowVersion === 0) {
    counts.total = 83;
    counts.vip = Math.max(0, counts.total - counts.free - counts.pro);
  }
  return counts;
}

export function membershipWatchlistLimit(
  tier: MembershipTier,
  accessPolicy: CustomerAccessPolicy,
): number {
  return accessPolicy.watchlistLimits[tier] ?? Number.POSITIVE_INFINITY;
}

export interface MembershipBenefit {
  label: string;
  detail: string;
  included: boolean;
  feature?: MembershipFeature;
}

export interface MembershipPlan {
  id: MembershipTier;
  eyebrow: string;
  cadence: string;
  bestFor: string;
  tagline: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  accent: "success" | "warning" | "chart";
  benefits: MembershipBenefit[];
}

const baseMembershipPlans: MembershipPlan[] = [
  {
    id: "Free",
    eyebrow: "START HERE",
    cadence: "forever",
    bestFor: "Explore the radar",
    tagline: "See what is moving before you commit.",
    description:
      "A calm starting point for discovering markets, building a watchlist, and learning the Tradify workflow.",
    icon: "compass",
    accent: "chart",
    benefits: [
      {
        label: "Configured Free-tier markets",
        detail: "Market access follows the active Tradify access rules",
        included: true,
      },
      {
        label: "Full market catalog",
        detail: "Browse configured markets and save within the Free watchlist limit",
        included: true,
      },
      {
        label: "Basic risk guardrails",
        detail: "Set account size and risk preferences",
        included: true,
      },
      {
        label: "Reference-price viewing",
        detail: "Display-only prices when live data is unavailable",
        included: true,
      },
      {
        label: "Markets requiring Pro",
        detail: "Markets assigned to Pro access are included with Pro membership",
        included: false,
      },
      {
        label: "Trusted setup levels",
        detail: "Entry, stop, and target plan workspace",
        included: false,
        feature: "trustedSetupLevels",
      },
      {
        label: "Live signal context",
        detail: "Fresh validated levels for active decisions",
        included: false,
        feature: "signalContext",
      },
    ],
  },
  {
    id: "Pro",
    eyebrow: "MOST POPULAR",
    cadence: "per month",
    bestFor: "Act on qualified setups",
    tagline: "The complete signal workspace for active traders.",
    description:
      "Unlock the decision context behind each qualified opportunity without adding noise to the cockpit.",
    icon: "trending-up",
    accent: "success",
    benefits: [
      {
        label: "Everything in Free",
        detail: "Keep your configured Free-tier markets, watchlist, and guardrails",
        included: true,
      },
      {
        label: "Markets included through Pro",
        detail: "Access markets assigned to Free or Pro membership",
        included: true,
      },
      {
        label: "Trusted setup levels",
        detail: "Entry, stop, and target plan workspace",
        included: true,
        feature: "trustedSetupLevels",
      },
      {
        label: "Live signal context",
        detail: "Fresh validated levels for active decisions",
        included: true,
        feature: "signalContext",
      },
      {
        label: "30-day performance context",
        detail: "Review recent outcomes and session edge",
        included: true,
        feature: "performanceContext",
      },
      {
        label: "Price alerts",
        detail: "Stay close to the levels you are watching",
        included: true,
        feature: "priceAlerts",
      },
    ],
  },
  {
    id: "VIP",
    eyebrow: "ALL MARKETS",
    cadence: "per month",
    bestFor: "Monitor the widest market range",
    tagline: "Broader coverage across every configured market.",
    description: "Everything in Pro, with access to every market configured for this account.",
    icon: "award",
    accent: "warning",
    benefits: [
      {
        label: "Everything in Pro",
        detail: "All qualified setup and alert capabilities",
        included: true,
      },
      {
        label: "All configured markets",
        detail: "Market access follows the active tier rules",
        included: true,
      },
      {
        label: "Full-depth setup review",
        detail: "Not available in the customer app yet",
        included: false,
        feature: "fullDepthReview",
      },
    ],
  },
];

export function membershipPlansFor(
  accessPolicy: CustomerAccessPolicy = DEFAULT_ACCESS_POLICY,
): MembershipPlan[] {
  const counts = membershipMarketCounts(accessPolicy);
  const proAccessibleCount = counts.free + counts.pro;
  return baseMembershipPlans.map((plan) => ({
    ...plan,
    description:
      plan.id === "Free"
        ? `A calm starting point with ${counts.free} configured Free-tier markets and a ${accessPolicy.watchlistLimits.Free}-market watchlist.`
        : plan.id === "Pro"
          ? `Access ${proAccessibleCount} markets assigned to Free or Pro tiers, with a ${accessPolicy.watchlistLimits.Pro}-market watchlist.`
          : `Access all ${counts.total} configured markets, including those assigned to VIP.`,
    benefits: plan.benefits.map((benefit) => {
      if (benefit.label === "Configured Free-tier markets") {
        return {
          ...benefit,
          label: `${counts.free} configured Free-tier markets`,
          detail: `${accessPolicy.watchlistLimits.Free} saved markets maximum`,
        };
      }
      if (benefit.label === "Full market catalog") {
        return {
          ...benefit,
          detail: `Browse ${counts.total} configured markets and save within the Free watchlist limit`,
        };
      }
      if (benefit.label === "Markets requiring Pro") {
        return {
          ...benefit,
          label: `${counts.pro} markets available through Pro`,
          detail:
            counts.pro > 0
              ? "Markets assigned to Free or Pro access"
              : "No markets currently require Pro access",
          included: counts.pro === 0,
        };
      }
      if (benefit.label === "Markets included through Pro") {
        return {
          ...benefit,
          label: `${proAccessibleCount} markets available through Pro`,
          detail: `Up to ${accessPolicy.watchlistLimits.Pro} saved markets`,
        };
      }
      if (benefit.label === "All configured markets") {
        return {
          ...benefit,
          label: `All ${counts.total} configured markets`,
          detail: `${accessPolicy.watchlistLimits.VIP === null ? "Unlimited" : accessPolicy.watchlistLimits.VIP} saved markets`,
        };
      }
      if (benefit.feature === "fullDepthReview") {
        return { ...benefit, included: false, detail: "Not available in the customer app yet" };
      }
      return benefit.feature
        ? { ...benefit, included: hasMembershipFeature(plan.id, benefit.feature, accessPolicy) }
        : benefit;
    }),
  }));
}

export const membershipPlans = membershipPlansFor();

export function membershipPlan(
  tier: MembershipTier,
  accessPolicy: CustomerAccessPolicy = DEFAULT_ACCESS_POLICY,
) {
  return (
    membershipPlansFor(accessPolicy).find((plan) => plan.id === tier) ??
    membershipPlansFor(accessPolicy)[0]
  );
}
