export type PlanTier = "FREE" | "PRO" | "ELITE";

export interface PlanFeatures {
  maxStrategies: number;
  historyDays: number;
  aiAnalysis: boolean;
  sessionAnalytics: boolean;
  timePatternAnalysis: boolean;
  pdfReports: boolean;
  csvExport: boolean;
  prioritySupport: boolean;
  eliteBadge: boolean;
  advancedEquityCurve: boolean;
  performanceIntelligence: boolean;
}

export interface PlanConfig {
  id: PlanTier;
  name: string;
  price: number;
  billingPeriod: string;
  description: string;
  features: PlanFeatures;
  displayFeatures: string[];
  excludedFeatures: string[];
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  FREE: {
    maxStrategies: 1,
    historyDays: 30,
    aiAnalysis: false,
    sessionAnalytics: false,
    timePatternAnalysis: false,
    pdfReports: false,
    csvExport: false,
    prioritySupport: false,
    eliteBadge: false,
    advancedEquityCurve: false,
    performanceIntelligence: false,
  },
  PRO: {
    maxStrategies: -1,
    historyDays: 180,
    aiAnalysis: true,
    sessionAnalytics: false,
    timePatternAnalysis: false,
    pdfReports: false,
    csvExport: true,
    prioritySupport: false,
    eliteBadge: false,
    advancedEquityCurve: true,
    performanceIntelligence: true,
  },
  ELITE: {
    maxStrategies: -1,
    historyDays: -1,
    aiAnalysis: true,
    sessionAnalytics: true,
    timePatternAnalysis: true,
    pdfReports: true,
    csvExport: true,
    prioritySupport: true,
    eliteBadge: true,
    advancedEquityCurve: true,
    performanceIntelligence: true,
  },
};

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Free",
    price: 0,
    billingPeriod: "forever",
    description: "Get started with essential trading tools",
    features: PLAN_FEATURES.FREE,
    displayFeatures: [
      "Live MT5 Data Connection",
      "Open Positions & Account Health",
      "Risk & Position Size Calculator",
      "30-Day Trade Journal History",
      "Institutional Knowledge Base",
      "1 Trading Strategy",
    ],
    excludedFeatures: [
      "Unlimited Trading Strategies",
      "Performance Intelligence",
      "Full Equity Curve",
      "AI Instrument Analysis",
      "CSV Data Export",
      "Session Analytics",
      "Time Pattern Analysis",
      "PDF Reports",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 19,
    billingPeriod: "month",
    description: "Advanced analytics for serious traders",
    features: PLAN_FEATURES.PRO,
    displayFeatures: [
      "Everything in Free",
      "Unlimited Trading Strategies",
      "Performance Intelligence Layer",
      "6-Month Trade History",
      "Full Equity Curve (All-Time)",
      "AI Instrument Analysis",
      "CSV Data Export",
      "Priority MT5 Sync Intervals",
    ],
    excludedFeatures: [
      "Session Analytics",
      "Time Pattern Analysis",
      "PDF Reports",
      "Priority Support",
      "Elite Badge",
    ],
  },
  ELITE: {
    id: "ELITE",
    name: "Elite",
    price: 39,
    billingPeriod: "month",
    description: "Complete toolkit for professional traders",
    features: PLAN_FEATURES.ELITE,
    displayFeatures: [
      "Everything in Pro",
      "Unlimited Trade History",
      "Session Performance Analytics",
      "Time Pattern Analysis",
      "PDF Report Generation",
      "Priority Support",
      "Elite Member Badge",
    ],
    excludedFeatures: [],
  },
};

export function getPlanFeatures(tier: string | null | undefined): PlanFeatures {
  const normalizedTier = (tier?.toUpperCase() || "FREE") as PlanTier;
  return PLAN_FEATURES[normalizedTier] || PLAN_FEATURES.FREE;
}

export function getPlanConfig(tier: string | null | undefined): PlanConfig {
  const normalizedTier = (tier?.toUpperCase() || "FREE") as PlanTier;
  return PLAN_CONFIGS[normalizedTier] || PLAN_CONFIGS.FREE;
}

export function canAccessFeature(
  tier: string | null | undefined,
  feature: keyof PlanFeatures
): boolean {
  const features = getPlanFeatures(tier);
  const value = features[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return false;
}

export function getMaxStrategies(tier: string | null | undefined): number {
  const features = getPlanFeatures(tier);
  return features.maxStrategies;
}

export function getHistoryDays(tier: string | null | undefined): number {
  const features = getPlanFeatures(tier);
  return features.historyDays;
}

export function isPaidTier(tier: string | null | undefined): boolean {
  const normalizedTier = tier?.toUpperCase();
  return normalizedTier === "PRO" || normalizedTier === "ELITE";
}

export function isEliteTier(tier: string | null | undefined): boolean {
  return tier?.toUpperCase() === "ELITE";
}

export function getUpgradeTarget(tier: string | null | undefined): PlanTier | null {
  const normalizedTier = tier?.toUpperCase();
  if (normalizedTier === "ELITE") return null;
  if (normalizedTier === "PRO") return "ELITE";
  return "PRO";
}

export const FEATURE_DESCRIPTIONS: Record<keyof PlanFeatures, { name: string; description: string }> = {
  maxStrategies: {
    name: "Trading Strategies",
    description: "Number of custom trading strategies you can create",
  },
  historyDays: {
    name: "Trade History",
    description: "How far back your trade journal data is retained",
  },
  aiAnalysis: {
    name: "AI Instrument Analysis",
    description: "AI-powered analysis of your trading performance on specific instruments",
  },
  sessionAnalytics: {
    name: "Session Analytics",
    description: "Performance breakdown by trading session (Asian, London, NY)",
  },
  timePatternAnalysis: {
    name: "Time Pattern Analysis",
    description: "Analysis of your performance by day of week and hour",
  },
  pdfReports: {
    name: "PDF Reports",
    description: "Generate professional PDF reports of your trading performance",
  },
  csvExport: {
    name: "CSV Export",
    description: "Export your trade data to CSV format",
  },
  prioritySupport: {
    name: "Priority Support",
    description: "Direct support channel with faster response times",
  },
  eliteBadge: {
    name: "Elite Badge",
    description: "Visual distinction showing your Elite member status",
  },
  advancedEquityCurve: {
    name: "Advanced Equity Curve",
    description: "Full historical equity curve with all-time data",
  },
  performanceIntelligence: {
    name: "Performance Intelligence",
    description: "Advanced metrics like profit factor, expectancy, and more",
  },
};
