import { describe, expect, it } from "vitest";
import {
  canAccessFeature,
  getHistoryDays,
  getMaxStrategies,
  isCoachTier,
  isEliteTier,
  isPaidTier,
} from "./plans";

describe("Journal plan access matrix", () => {
  it("keeps Free, Pro, Elite, and Coach limits distinct", () => {
    expect(getHistoryDays("FREE")).toBe(30);
    expect(getHistoryDays("PRO")).toBe(180);
    expect(getHistoryDays("ELITE")).toBe(-1);
    expect(getHistoryDays("COACH")).toBe(-1);

    expect(getMaxStrategies("FREE")).toBe(1);
    expect(getMaxStrategies("PRO")).toBe(-1);
    expect(getMaxStrategies("ELITE")).toBe(-1);
    expect(getMaxStrategies("COACH")).toBe(-1);
  });

  it("gates premium analytics and coach-only capabilities by tier", () => {
    expect(canAccessFeature("FREE", "sessionAnalytics")).toBe(false);
    expect(canAccessFeature("PRO", "sessionAnalytics")).toBe(false);
    expect(canAccessFeature("ELITE", "sessionAnalytics")).toBe(true);
    expect(canAccessFeature("COACH", "sessionAnalytics")).toBe(true);

    expect(canAccessFeature("FREE", "pdfReports")).toBe(false);
    expect(canAccessFeature("PRO", "pdfReports")).toBe(true);
    expect(canAccessFeature("ELITE", "pdfReports")).toBe(true);
    expect(canAccessFeature("COACH", "pdfReports")).toBe(true);

    expect(canAccessFeature("FREE", "coachDashboard")).toBe(false);
    expect(canAccessFeature("PRO", "coachDashboard")).toBe(false);
    expect(canAccessFeature("ELITE", "coachDashboard")).toBe(false);
    expect(canAccessFeature("COACH", "coachDashboard")).toBe(true);
    expect(canAccessFeature("COACH", "studentFeedback")).toBe(true);
  });

  it("classifies provider-entitled tiers without treating Free as paid", () => {
    expect(isPaidTier("FREE")).toBe(false);
    expect(isPaidTier("PRO")).toBe(true);
    expect(isPaidTier("ELITE")).toBe(true);
    expect(isPaidTier("COACH")).toBe(true);
    expect(isEliteTier("PRO")).toBe(false);
    expect(isEliteTier("ELITE")).toBe(true);
    expect(isEliteTier("COACH")).toBe(true);
    expect(isCoachTier("ELITE")).toBe(false);
    expect(isCoachTier("COACH")).toBe(true);
  });
});
