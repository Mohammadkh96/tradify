import { describe, it, expect } from "vitest";
import {
  computeDailyDD,
  computeMaxDD,
  classifyDDSeverity,
  detectRevengeCluster,
  classifyOvertrading,
  isStrategyDeviation,
  isAlertWithinCooldown,
  type RevengeTrade,
} from "./alertEngine";

describe("computeDailyDD", () => {
  it("returns zero usage when balance equals dayStart", () => {
    const r = computeDailyDD(10_000, 10_000, 5);
    expect(r.dailyLoss).toBe(0);
    expect(r.dailyDDAmount).toBe(500);
    expect(r.dailyPct).toBe(0);
  });

  it("computes percent of allowed daily DD consumed", () => {
    const r = computeDailyDD(10_000, 9_750, 5);
    expect(r.dailyLoss).toBe(250);
    expect(r.dailyDDAmount).toBe(500);
    expect(r.dailyPct).toBe(50);
  });

  it("clamps loss to >= 0 when account is in profit", () => {
    const r = computeDailyDD(10_000, 10_500, 5);
    expect(r.dailyLoss).toBe(0);
    expect(r.dailyPct).toBe(0);
  });

  it("guards against zero dayStart balance", () => {
    const r = computeDailyDD(0, 0, 5);
    expect(r.dailyDDAmount).toBe(0);
    expect(r.dailyPct).toBe(0);
  });
});

describe("computeMaxDD", () => {
  const accountSize = 100_000;
  const limit = 10;

  it("static: anchors floor at accountSize - limit%", () => {
    const r = computeMaxDD(accountSize, 95_000, limit, false, 105_000);
    expect(r.maxDDFloor).toBe(90_000);
    expect(r.maxDDPct).toBe(50);
  });

  it("trailing: anchors floor at highWaterMark - limit%", () => {
    const r = computeMaxDD(accountSize, 95_000, limit, true, 105_000);
    expect(r.maxDDFloor).toBe(94_500);
    expect(r.maxDDPct).toBeCloseTo((10_000 / 10_500) * 100, 4);
  });

  it("trailing vs static diverge once HWM exceeds account size", () => {
    const stat = computeMaxDD(accountSize, 99_000, limit, false, 110_000);
    const trail = computeMaxDD(accountSize, 99_000, limit, true, 110_000);
    expect(stat.maxDDPct).toBeLessThan(trail.maxDDPct);
  });

  it("returns 0 when balance is at or above the anchor", () => {
    const r = computeMaxDD(accountSize, 100_000, limit, false, 100_000);
    expect(r.maxDDPct).toBe(0);
  });
});

describe("classifyDDSeverity", () => {
  it("none below warn threshold", () => {
    expect(classifyDDSeverity(70, 75, 100)).toBe("none");
  });
  it("warn at exactly the warn threshold", () => {
    expect(classifyDDSeverity(75, 75, 100)).toBe("warn");
  });
  it("critical at exactly the critical threshold", () => {
    expect(classifyDDSeverity(100, 75, 100)).toBe("critical");
  });
  it("critical wins over warn when both fire", () => {
    expect(classifyDDSeverity(120, 75, 100)).toBe("critical");
  });
});

describe("detectRevengeCluster", () => {
  const baseLossClose = new Date("2026-05-01T12:00:00Z");

  const make = (offsetMin: number, netPl: number): RevengeTrade => ({
    closeTime: new Date(baseLossClose.getTime() + offsetMin * 60_000 + 30_000),
    openTime: new Date(baseLossClose.getTime() + offsetMin * 60_000),
    netPl,
  });

  it("returns null with too few trades", () => {
    expect(detectRevengeCluster([make(0, -100)])).toBeNull();
  });

  it("detects 3 trades opened within 15 min after a loss", () => {
    const trades: RevengeTrade[] = [
      { closeTime: baseLossClose, openTime: new Date(baseLossClose.getTime() - 60_000), netPl: -100 },
      make(2, 50),
      make(7, -20),
      make(14, 30),
    ];
    const r = detectRevengeCluster(trades);
    expect(r).not.toBeNull();
    expect(r!.triggerIndex).toBe(0);
    expect(r!.clusterSize).toBe(3);
  });

  it("returns null when follow-on trades fall outside the window", () => {
    const trades: RevengeTrade[] = [
      { closeTime: baseLossClose, openTime: new Date(baseLossClose.getTime() - 60_000), netPl: -100 },
      make(20, 50),
      make(30, -20),
      make(40, 30),
    ];
    expect(detectRevengeCluster(trades)).toBeNull();
  });

  it("ignores winners as the trigger trade", () => {
    const trades: RevengeTrade[] = [
      { closeTime: baseLossClose, openTime: new Date(baseLossClose.getTime() - 60_000), netPl: 200 },
      make(2, 10),
      make(5, 20),
      make(8, 30),
    ];
    expect(detectRevengeCluster(trades)).toBeNull();
  });

  it("respects a custom cluster size", () => {
    const trades: RevengeTrade[] = [
      { closeTime: baseLossClose, openTime: new Date(baseLossClose.getTime() - 60_000), netPl: -100 },
      make(2, 10),
      make(5, 20),
    ];
    expect(detectRevengeCluster(trades, 15 * 60_000, 2)).not.toBeNull();
    expect(detectRevengeCluster(trades, 15 * 60_000, 3)).toBeNull();
  });
});

describe("classifyOvertrading", () => {
  it("none below cap", () => {
    expect(classifyOvertrading(4, 10)).toBe("none");
  });
  it("warn at exactly the cap", () => {
    expect(classifyOvertrading(10, 10)).toBe("warn");
  });
  it("warn just below 1.5x cap", () => {
    expect(classifyOvertrading(14, 10)).toBe("warn");
  });
  it("critical at 1.5x the cap", () => {
    expect(classifyOvertrading(15, 10)).toBe("critical");
  });
  it("critical above 1.5x the cap", () => {
    expect(classifyOvertrading(50, 10)).toBe("critical");
  });
  it("none when cap is zero (disabled)", () => {
    expect(classifyOvertrading(99, 0)).toBe("none");
  });
});

describe("isStrategyDeviation", () => {
  const known = ["EURUSD", "GBPUSD", "XAUUSD"];

  it("known symbol is not a deviation", () => {
    expect(isStrategyDeviation("EURUSD", known)).toBe(false);
  });
  it("comparison is case-insensitive", () => {
    expect(isStrategyDeviation("eurusd", known)).toBe(false);
    expect(isStrategyDeviation("EurUsd", known)).toBe(false);
  });
  it("unknown symbol is a deviation", () => {
    expect(isStrategyDeviation("BTCUSD", known)).toBe(true);
  });
  it("empty symbol is not a deviation", () => {
    expect(isStrategyDeviation("", known)).toBe(false);
  });
  it("empty known set treats every non-empty symbol as deviation", () => {
    expect(isStrategyDeviation("EURUSD", [])).toBe(true);
  });
});

describe("isAlertWithinCooldown", () => {
  const now = new Date("2026-05-02T10:00:00Z");

  it("no cooldown -> not within", () => {
    expect(isAlertWithinCooldown(null, now)).toBe(false);
    expect(isAlertWithinCooldown(undefined, now)).toBe(false);
  });
  it("cooldown in the future -> within", () => {
    const future = new Date(now.getTime() + 60_000);
    expect(isAlertWithinCooldown(future, now)).toBe(true);
  });
  it("cooldown in the past -> not within", () => {
    const past = new Date(now.getTime() - 60_000);
    expect(isAlertWithinCooldown(past, now)).toBe(false);
  });
  it("accepts ISO string cooldown values", () => {
    const futureIso = new Date(now.getTime() + 60_000).toISOString();
    expect(isAlertWithinCooldown(futureIso, now)).toBe(true);
  });
  it("invalid date string -> not within (fail open)", () => {
    expect(isAlertWithinCooldown("not-a-date", now)).toBe(false);
  });
});
