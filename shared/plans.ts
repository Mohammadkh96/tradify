export type PlanTier = "FREE" | "PRO" | "ELITE" | "COACH";

export interface PlanFeatures {
  maxStrategies: number;
  historyDays: number;
  aiAnalysis: boolean;
  sessionAnalytics: boolean;
  timePatternAnalysis: boolean;
  behavioralRiskFlags: boolean;
  strategyDeviationAnalysis: boolean;
  monthlyAIReview: boolean;
  pdfReports: boolean;
  csvExport: boolean;
  prioritySupport: boolean;
  eliteBadge: boolean;
  advancedEquityCurve: boolean;
  performanceIntelligence: boolean;
  fullEducationAccess: boolean;
  propFirmTracker: boolean;
  propFirmAiWarnings: boolean;
  coachDashboard: boolean;
  maxStudents: number;
  studentFeedback: boolean;
}

export type BillingPeriod = "monthly" | "annual";

export interface PlanPricing {
  monthly: number;
  annual: number;
  annualMonthly: number; // effective monthly price when billed annually
  annualSavings: number; // total savings per year
}

export interface PlanConfig {
  id: PlanTier;
  name: string;
  price: number;
  pricing: PlanPricing;
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
    behavioralRiskFlags: false,
    strategyDeviationAnalysis: false,
    monthlyAIReview: false,
    pdfReports: false,
    csvExport: false,
    prioritySupport: false,
    eliteBadge: false,
    advancedEquityCurve: false,
    performanceIntelligence: false,
    fullEducationAccess: false,
    propFirmTracker: false,
    propFirmAiWarnings: false,
    coachDashboard: false,
    maxStudents: 0,
    studentFeedback: false,
  },
  PRO: {
    maxStrategies: -1,
    historyDays: 180,
    aiAnalysis: true,
    sessionAnalytics: false,
    timePatternAnalysis: false,
    behavioralRiskFlags: false,
    strategyDeviationAnalysis: false,
    monthlyAIReview: false,
    pdfReports: true,
    csvExport: true,
    prioritySupport: false,
    eliteBadge: false,
    advancedEquityCurve: true,
    performanceIntelligence: true,
    fullEducationAccess: true,
    propFirmTracker: true,
    propFirmAiWarnings: false,
    coachDashboard: false,
    maxStudents: 0,
    studentFeedback: false,
  },
  ELITE: {
    maxStrategies: -1,
    historyDays: -1,
    aiAnalysis: true,
    sessionAnalytics: true,
    timePatternAnalysis: true,
    behavioralRiskFlags: true,
    strategyDeviationAnalysis: true,
    monthlyAIReview: true,
    pdfReports: true,
    csvExport: true,
    prioritySupport: true,
    eliteBadge: true,
    advancedEquityCurve: true,
    performanceIntelligence: true,
    fullEducationAccess: true,
    propFirmTracker: true,
    propFirmAiWarnings: true,
    coachDashboard: false,
    maxStudents: 0,
    studentFeedback: false,
  },
  COACH: {
    maxStrategies: -1,
    historyDays: -1,
    aiAnalysis: true,
    sessionAnalytics: true,
    timePatternAnalysis: true,
    behavioralRiskFlags: true,
    strategyDeviationAnalysis: true,
    monthlyAIReview: true,
    pdfReports: true,
    csvExport: true,
    prioritySupport: true,
    eliteBadge: true,
    advancedEquityCurve: true,
    performanceIntelligence: true,
    fullEducationAccess: true,
    propFirmTracker: true,
    propFirmAiWarnings: true,
    coachDashboard: true,
    maxStudents: 25,
    studentFeedback: true,
  },
};

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Free",
    price: 0,
    pricing: { monthly: 0, annual: 0, annualMonthly: 0, annualSavings: 0 },
    billingPeriod: "forever",
    description: "Get started with essential trading tools",
    features: PLAN_FEATURES.FREE,
    displayFeatures: [
      "Live MT5 Multi-Account Sync",
      "Open Positions & Account Health",
      "Risk & Position Size Calculator",
      "Psychology & Mood Tracking",
      "CSV Trade Import",
      "Dashboard Customization",
      "30-Day Trade Journal History",
      "3 Free Education Lessons",
      "1 Trading Strategy",
    ],
    excludedFeatures: [
      "Unlimited Trading Strategies",
      "Full Education Hub (20 Lessons)",
      "Performance Intelligence Layer",
      "Full Equity Curve (All-Time)",
      "AI Instrument Analysis",
      "AI Psychology Review",
      "Prop Firm Challenge Tracker",
      "CSV Data Export",
      "PDF Report Generation",
      "Session Performance Analytics",
      "Time Pattern Analysis",
      "Behavioral Risk Flags",
      "Strategy Deviation Analysis",
      "AI Challenge Risk Warnings",
      "Monthly AI Performance Review",
      "Unlimited Trade History",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 29,
    pricing: { monthly: 29, annual: 290, annualMonthly: 24, annualSavings: 58 },
    billingPeriod: "month",
    description: "Advanced analytics for serious traders",
    features: PLAN_FEATURES.PRO,
    displayFeatures: [
      "Everything in Free",
      "Unlimited Trading Strategies",
      "Full Education Hub (20 Lessons)",
      "Performance Intelligence Layer",
      "6-Month Trade History",
      "Full Equity Curve (All-Time)",
      "AI Instrument Analysis",
      "AI Psychology Review",
      "Prop Firm Challenge Tracker",
      "CSV Data Export",
      "PDF Report Generation",
    ],
    excludedFeatures: [
      "Unlimited Trade History",
      "Session Performance Analytics",
      "Time Pattern Analysis",
      "Behavioral Risk Flags",
      "Strategy Deviation Analysis",
      "AI Challenge Risk Warnings",
      "Monthly AI Performance Review",
      "Priority Support",
      "Elite Member Badge",
    ],
  },
  ELITE: {
    id: "ELITE",
    name: "Elite",
    price: 59,
    pricing: { monthly: 59, annual: 590, annualMonthly: 49, annualSavings: 118 },
    billingPeriod: "month",
    description: "Complete toolkit for professional traders",
    features: PLAN_FEATURES.ELITE,
    displayFeatures: [
      "Everything in Pro",
      "Unlimited Trade History",
      "AI Challenge Risk Warnings",
      "Session Performance Analytics",
      "Time Pattern Analysis",
      "Behavioral Risk Flags",
      "Strategy Deviation Analysis",
      "Monthly AI Performance Review",
      "Priority Support",
      "Elite Member Badge",
    ],
    excludedFeatures: ["Coach Dashboard", "Up to 25 Linked Students", "Per-Trade Feedback"],
  },
  COACH: {
    id: "COACH",
    name: "Coach",
    price: 99,
    pricing: { monthly: 99, annual: 990, annualMonthly: 82, annualSavings: 198 },
    billingPeriod: "month",
    description: "Mentor up to 25 students with full Elite access",
    features: PLAN_FEATURES.COACH,
    displayFeatures: [
      "Everything in Elite",
      "Coach Dashboard",
      "Up to 25 Linked Students",
      "Read-only access to student trade journals",
      "Per-trade written feedback",
      "Coach badge on profile",
      "Priority onboarding for your students",
    ],
    excludedFeatures: [],
  },
};

export function getPlanPrice(tier: string | null | undefined, period: BillingPeriod = "monthly"): number {
  const config = getPlanConfig(tier);
  if (period === "annual") return config.pricing.annual;
  return config.pricing.monthly;
}

export function getFounderPrice(price: number, discountRate: number = 0.30): number {
  return Math.round(price * (1 - discountRate));
}

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
  return normalizedTier === "PRO" || normalizedTier === "ELITE" || normalizedTier === "COACH";
}

export function isEliteTier(tier: string | null | undefined): boolean {
  const t = tier?.toUpperCase();
  return t === "ELITE" || t === "COACH";
}

export function isCoachTier(tier: string | null | undefined): boolean {
  return tier?.toUpperCase() === "COACH";
}

export function getUpgradeTarget(tier: string | null | undefined): PlanTier | null {
  const normalizedTier = tier?.toUpperCase();
  if (normalizedTier === "COACH") return null;
  if (normalizedTier === "ELITE") return "COACH";
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
  behavioralRiskFlags: {
    name: "Behavioral Risk Flags",
    description: "Automated detection of behavioral trading patterns like revenge trading, overtrading, and risk creep",
  },
  strategyDeviationAnalysis: {
    name: "Strategy Deviation Analysis",
    description: "Track how often you deviate from your strategy rules and the impact on performance",
  },
  monthlyAIReview: {
    name: "Monthly AI Performance Review",
    description: "AI-generated monthly summary of your trading performance with insights and recommendations",
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
  fullEducationAccess: {
    name: "Full Education Access",
    description: "Access to all trading education lessons and materials",
  },
  propFirmTracker: {
    name: "Prop Firm Tracker",
    description: "Track prop firm challenge progress with drawdown monitoring, consistency scoring, and deadline tracking",
  },
  propFirmAiWarnings: {
    name: "AI Challenge Warnings",
    description: "AI-powered warnings when approaching challenge rule violations during trade logging",
  },
  coachDashboard: {
    name: "Coach Dashboard",
    description: "Manage your linked students, view their trade journals, and send feedback",
  },
  maxStudents: {
    name: "Linked Students",
    description: "Maximum number of students you can mentor at the same time",
  },
  studentFeedback: {
    name: "Per-Trade Feedback",
    description: "Leave written feedback on individual student trades",
  },
};
