import { db } from "./db";
import { userAchievements, userStreaks, tradeJournal, mt5History } from "@shared/schema";
import { eq, and, gte, sql, desc, count } from "drizzle-orm";

export interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: "milestones" | "discipline" | "streaks" | "education" | "performance";
  tier: "bronze" | "silver" | "gold" | "platinum";
  xpReward: number;
  requirement: {
    type: string;
    target: number;
  };
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    key: "first_trade",
    name: "First Steps",
    description: "Log your first trade",
    icon: "footprints",
    category: "milestones",
    tier: "bronze",
    xpReward: 10,
    requirement: { type: "trade_count", target: 1 },
  },
  {
    key: "trades_10",
    name: "Getting Started",
    description: "Log 10 trades",
    icon: "trending-up",
    category: "milestones",
    tier: "bronze",
    xpReward: 25,
    requirement: { type: "trade_count", target: 10 },
  },
  {
    key: "trades_50",
    name: "Committed Trader",
    description: "Log 50 trades",
    icon: "bar-chart-3",
    category: "milestones",
    tier: "silver",
    xpReward: 75,
    requirement: { type: "trade_count", target: 50 },
  },
  {
    key: "trades_100",
    name: "Century Club",
    description: "Log 100 trades",
    icon: "award",
    category: "milestones",
    tier: "silver",
    xpReward: 150,
    requirement: { type: "trade_count", target: 100 },
  },
  {
    key: "trades_500",
    name: "Veteran Trader",
    description: "Log 500 trades",
    icon: "medal",
    category: "milestones",
    tier: "gold",
    xpReward: 500,
    requirement: { type: "trade_count", target: 500 },
  },
  {
    key: "trades_1000",
    name: "Trading Legend",
    description: "Log 1,000 trades",
    icon: "crown",
    category: "milestones",
    tier: "platinum",
    xpReward: 1000,
    requirement: { type: "trade_count", target: 1000 },
  },
  {
    key: "first_win",
    name: "Winner's Circle",
    description: "Record your first winning trade",
    icon: "trophy",
    category: "milestones",
    tier: "bronze",
    xpReward: 15,
    requirement: { type: "first_win", target: 1 },
  },
  {
    key: "win_streak_3",
    name: "Hat Trick",
    description: "Win 3 trades in a row",
    icon: "flame",
    category: "performance",
    tier: "bronze",
    xpReward: 30,
    requirement: { type: "win_streak", target: 3 },
  },
  {
    key: "win_streak_5",
    name: "On Fire",
    description: "Win 5 trades in a row",
    icon: "flame",
    category: "performance",
    tier: "silver",
    xpReward: 75,
    requirement: { type: "win_streak", target: 5 },
  },
  {
    key: "win_streak_10",
    name: "Unstoppable",
    description: "Win 10 trades in a row",
    icon: "flame",
    category: "performance",
    tier: "gold",
    xpReward: 200,
    requirement: { type: "win_streak", target: 10 },
  },
  {
    key: "risk_manager_7",
    name: "Risk Aware",
    description: "7 consecutive trades with proper risk management (R:R >= 1:1)",
    icon: "shield",
    category: "discipline",
    tier: "bronze",
    xpReward: 40,
    requirement: { type: "risk_managed_streak", target: 7 },
  },
  {
    key: "risk_manager_30",
    name: "Risk Master",
    description: "30 consecutive trades with proper risk management",
    icon: "shield-check",
    category: "discipline",
    tier: "silver",
    xpReward: 150,
    requirement: { type: "risk_managed_streak", target: 30 },
  },
  {
    key: "rule_follower_7",
    name: "Disciplined",
    description: "7 consecutive rule-compliant trades",
    icon: "check-circle",
    category: "discipline",
    tier: "bronze",
    xpReward: 50,
    requirement: { type: "compliance_streak", target: 7 },
  },
  {
    key: "rule_follower_30",
    name: "Iron Discipline",
    description: "30 consecutive rule-compliant trades",
    icon: "check-circle",
    category: "discipline",
    tier: "gold",
    xpReward: 250,
    requirement: { type: "compliance_streak", target: 30 },
  },
  {
    key: "journal_streak_7",
    name: "Consistent Journaler",
    description: "Log trades for 7 days in a row",
    icon: "calendar",
    category: "streaks",
    tier: "bronze",
    xpReward: 35,
    requirement: { type: "journal_streak", target: 7 },
  },
  {
    key: "journal_streak_30",
    name: "Monthly Dedication",
    description: "Log trades for 30 days in a row",
    icon: "calendar-check",
    category: "streaks",
    tier: "silver",
    xpReward: 150,
    requirement: { type: "journal_streak", target: 30 },
  },
  {
    key: "journal_streak_90",
    name: "Quarter Master",
    description: "Log trades for 90 days in a row",
    icon: "calendar-heart",
    category: "streaks",
    tier: "gold",
    xpReward: 500,
    requirement: { type: "journal_streak", target: 90 },
  },
  {
    key: "education_phase1",
    name: "Student",
    description: "Complete Phase 1 of the Knowledge Base",
    icon: "book-open",
    category: "education",
    tier: "bronze",
    xpReward: 30,
    requirement: { type: "education_phase", target: 1 },
  },
  {
    key: "education_all",
    name: "Graduate",
    description: "Complete all Education phases",
    icon: "graduation-cap",
    category: "education",
    tier: "platinum",
    xpReward: 500,
    requirement: { type: "education_phase", target: 8 },
  },
  {
    key: "quiz_master",
    name: "Quiz Master",
    description: "Score 100% on 5 quizzes",
    icon: "brain",
    category: "education",
    tier: "gold",
    xpReward: 200,
    requirement: { type: "perfect_quizzes", target: 5 },
  },
  {
    key: "profit_factor_2",
    name: "Edge Finder",
    description: "Achieve a profit factor above 2.0 over 30+ trades",
    icon: "target",
    category: "performance",
    tier: "gold",
    xpReward: 300,
    requirement: { type: "profit_factor", target: 2 },
  },
  {
    key: "winrate_60",
    name: "Sharpshooter",
    description: "Maintain 60%+ win rate over 50+ trades",
    icon: "crosshair",
    category: "performance",
    tier: "silver",
    xpReward: 200,
    requirement: { type: "win_rate", target: 60 },
  },
  {
    key: "winrate_70",
    name: "Sniper",
    description: "Maintain 70%+ win rate over 50+ trades",
    icon: "crosshair",
    category: "performance",
    tier: "gold",
    xpReward: 400,
    requirement: { type: "win_rate", target: 70 },
  },
  {
    key: "mt5_connected",
    name: "Plugged In",
    description: "Connect your MT5 account for the first time",
    icon: "zap",
    category: "milestones",
    tier: "bronze",
    xpReward: 20,
    requirement: { type: "mt5_connected", target: 1 },
  },
  {
    key: "recovery_king",
    name: "Recovery King",
    description: "Recover from a 5-trade losing streak with 5 consecutive wins",
    icon: "rotate-ccw",
    category: "performance",
    tier: "gold",
    xpReward: 300,
    requirement: { type: "recovery", target: 5 },
  },
];

export const XP_LEVELS = [
  { level: 1, name: "Beginner", xpRequired: 0 },
  { level: 2, name: "Apprentice", xpRequired: 50 },
  { level: 3, name: "Journeyman", xpRequired: 150 },
  { level: 4, name: "Skilled", xpRequired: 350 },
  { level: 5, name: "Expert", xpRequired: 700 },
  { level: 6, name: "Master", xpRequired: 1200 },
  { level: 7, name: "Grandmaster", xpRequired: 2000 },
  { level: 8, name: "Legend", xpRequired: 3500 },
  { level: 9, name: "Mythic", xpRequired: 5500 },
  { level: 10, name: "Immortal", xpRequired: 8000 },
];

export function getLevelFromXp(totalXp: number) {
  let currentLevel = XP_LEVELS[0];
  for (const level of XP_LEVELS) {
    if (totalXp >= level.xpRequired) {
      currentLevel = level;
    } else {
      break;
    }
  }
  const nextLevel = XP_LEVELS.find((l) => l.level === currentLevel.level + 1);
  return {
    ...currentLevel,
    totalXp,
    nextLevelXp: nextLevel?.xpRequired || currentLevel.xpRequired,
    nextLevelName: nextLevel?.name || "Max Level",
    progress: nextLevel
      ? Math.round(
          ((totalXp - currentLevel.xpRequired) /
            (nextLevel.xpRequired - currentLevel.xpRequired)) *
            100
        )
      : 100,
  };
}

export async function getUserAchievements(userId: string) {
  const unlocked = await db
    .select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));

  const unlockedMap = new Map(
    unlocked.map((a) => [a.achievementKey, a])
  );

  return ACHIEVEMENTS.map((def) => {
    const userAch = unlockedMap.get(def.key);
    return {
      ...def,
      unlocked: !!userAch,
      unlockedAt: userAch?.unlockedAt || null,
      progress: userAch?.progress || 0,
    };
  });
}

export async function getUserStreaks(userId: string) {
  const streaks = await db
    .select()
    .from(userStreaks)
    .where(eq(userStreaks.userId, userId));

  const streakMap = new Map(streaks.map((s) => [s.streakType, s]));

  const types = ["journaling", "trading", "compliance"];
  const result: Record<string, any> = {};

  for (const type of types) {
    const streak = streakMap.get(type);
    result[type] = {
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      lastActivityDate: streak?.lastActivityDate || null,
    };
  }

  const totalXp = streaks.reduce((sum, s) => sum + (s.totalXp || 0), 0);
  const level = getLevelFromXp(totalXp);

  return { streaks: result, totalXp, level };
}

export async function updateStreak(
  userId: string,
  streakType: string
): Promise<{ streakUpdated: boolean; currentStreak: number }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [existing] = await db
    .select()
    .from(userStreaks)
    .where(
      and(
        eq(userStreaks.userId, userId),
        eq(userStreaks.streakType, streakType)
      )
    )
    .limit(1);

  if (existing) {
    const lastDate = existing.lastActivityDate
      ? new Date(
          existing.lastActivityDate.getFullYear(),
          existing.lastActivityDate.getMonth(),
          existing.lastActivityDate.getDate()
        )
      : null;

    if (lastDate && lastDate.getTime() === today.getTime()) {
      return { streakUpdated: false, currentStreak: existing.currentStreak || 0 };
    }

    let newStreak: number;
    if (lastDate && lastDate.getTime() === yesterday.getTime()) {
      newStreak = (existing.currentStreak || 0) + 1;
    } else {
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, existing.longestStreak || 0);

    await db
      .update(userStreaks)
      .set({
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActivityDate: now,
      })
      .where(eq(userStreaks.id, existing.id));

    return { streakUpdated: true, currentStreak: newStreak };
  } else {
    await db.insert(userStreaks).values({
      userId,
      streakType,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: now,
      totalXp: 0,
    });
    return { streakUpdated: true, currentStreak: 1 };
  }
}

async function unlockAchievement(
  userId: string,
  achievementKey: string,
  progress: number = 100
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementKey, achievementKey)
      )
    )
    .limit(1);

  if (existing && existing.progress === 100) {
    return false;
  }

  if (existing) {
    await db
      .update(userAchievements)
      .set({ progress, unlockedAt: progress >= 100 ? new Date() : existing.unlockedAt })
      .where(eq(userAchievements.id, existing.id));
  } else {
    await db.insert(userAchievements).values({
      userId,
      achievementKey,
      progress,
    });
  }

  if (progress >= 100) {
    const def = ACHIEVEMENTS.find((a) => a.key === achievementKey);
    if (def) {
      await addXp(userId, def.xpReward);
    }
  }

  return progress >= 100;
}

async function addXp(userId: string, amount: number) {
  const [existing] = await db
    .select()
    .from(userStreaks)
    .where(
      and(
        eq(userStreaks.userId, userId),
        eq(userStreaks.streakType, "journaling")
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(userStreaks)
      .set({ totalXp: (existing.totalXp || 0) + amount })
      .where(eq(userStreaks.id, existing.id));
  } else {
    await db.insert(userStreaks).values({
      userId,
      streakType: "journaling",
      currentStreak: 0,
      longestStreak: 0,
      totalXp: amount,
    });
  }
}

export async function checkAchievements(
  userId: string
): Promise<{ newlyUnlocked: string[] }> {
  const newlyUnlocked: string[] = [];

  const [journalResult] = await db
    .select({ count: count() })
    .from(tradeJournal)
    .where(eq(tradeJournal.userId, userId));

  const [mt5Result] = await db
    .select({ count: count() })
    .from(mt5History)
    .where(eq(mt5History.userId, userId));

  const totalTrades = (journalResult?.count || 0) + (mt5Result?.count || 0);

  const tradeCountAchievements = ACHIEVEMENTS.filter(
    (a) => a.requirement.type === "trade_count"
  );
  for (const ach of tradeCountAchievements) {
    const progress = Math.min(
      100,
      Math.round((totalTrades / ach.requirement.target) * 100)
    );
    const unlocked = await unlockAchievement(userId, ach.key, progress);
    if (unlocked) newlyUnlocked.push(ach.key);
  }

  const journalTrades = await db
    .select({
      outcome: tradeJournal.outcome,
      isRuleCompliant: tradeJournal.isRuleCompliant,
      riskReward: tradeJournal.riskReward,
    })
    .from(tradeJournal)
    .where(eq(tradeJournal.userId, userId))
    .orderBy(desc(tradeJournal.createdAt))
    .limit(100);

  const mt5Trades = await db
    .select({
      profit: mt5History.profit,
    })
    .from(mt5History)
    .where(eq(mt5History.userId, userId))
    .orderBy(desc(mt5History.closeTime))
    .limit(100);

  const allOutcomes = [
    ...journalTrades.map((t) => t.outcome?.toLowerCase()),
    ...mt5Trades.map((t) =>
      t.profit && parseFloat(t.profit) > 0 ? "win" : "loss"
    ),
  ];

  if (allOutcomes.some((o) => o === "win")) {
    const unlocked = await unlockAchievement(userId, "first_win", 100);
    if (unlocked) newlyUnlocked.push("first_win");
  }

  let currentWinStreak = 0;
  let maxWinStreak = 0;
  for (const outcome of allOutcomes) {
    if (outcome === "win") {
      currentWinStreak++;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else {
      currentWinStreak = 0;
    }
  }

  const winStreakAchievements = ACHIEVEMENTS.filter(
    (a) => a.requirement.type === "win_streak"
  );
  for (const ach of winStreakAchievements) {
    const progress = Math.min(
      100,
      Math.round((maxWinStreak / ach.requirement.target) * 100)
    );
    const unlocked = await unlockAchievement(userId, ach.key, progress);
    if (unlocked) newlyUnlocked.push(ach.key);
  }

  let complianceStreak = 0;
  for (const trade of journalTrades) {
    if (trade.isRuleCompliant) {
      complianceStreak++;
    } else {
      break;
    }
  }
  const complianceAchievements = ACHIEVEMENTS.filter(
    (a) => a.requirement.type === "compliance_streak"
  );
  for (const ach of complianceAchievements) {
    const progress = Math.min(
      100,
      Math.round((complianceStreak / ach.requirement.target) * 100)
    );
    const unlocked = await unlockAchievement(userId, ach.key, progress);
    if (unlocked) newlyUnlocked.push(ach.key);
  }

  let riskManagedStreak = 0;
  for (const trade of journalTrades) {
    const rr = parseFloat(trade.riskReward || "0");
    if (rr >= 1) {
      riskManagedStreak++;
    } else {
      break;
    }
  }
  const riskAchievements = ACHIEVEMENTS.filter(
    (a) => a.requirement.type === "risk_managed_streak"
  );
  for (const ach of riskAchievements) {
    const progress = Math.min(
      100,
      Math.round((riskManagedStreak / ach.requirement.target) * 100)
    );
    const unlocked = await unlockAchievement(userId, ach.key, progress);
    if (unlocked) newlyUnlocked.push(ach.key);
  }

  const totalWins = allOutcomes.filter((o) => o === "win").length;
  const totalWithOutcome = allOutcomes.filter(
    (o) => o === "win" || o === "loss"
  ).length;
  if (totalWithOutcome >= 50) {
    const winRate = (totalWins / totalWithOutcome) * 100;
    const winRateAchievements = ACHIEVEMENTS.filter(
      (a) => a.requirement.type === "win_rate"
    );
    for (const ach of winRateAchievements) {
      const progress = Math.min(
        100,
        Math.round((winRate / ach.requirement.target) * 100)
      );
      const unlocked = await unlockAchievement(userId, ach.key, progress);
      if (unlocked) newlyUnlocked.push(ach.key);
    }
  }

  let recoveryDetected = false;
  for (let i = 0; i < allOutcomes.length - 9; i++) {
    const segment = allOutcomes.slice(i, i + 10);
    const first5 = segment.slice(0, 5);
    const last5 = segment.slice(5, 10);
    if (
      first5.every((o) => o === "loss") &&
      last5.every((o) => o === "win")
    ) {
      recoveryDetected = true;
      break;
    }
  }
  if (recoveryDetected) {
    const unlocked = await unlockAchievement(userId, "recovery_king", 100);
    if (unlocked) newlyUnlocked.push("recovery_king");
  }

  const streakData = await getUserStreaks(userId);
  const journalStreak = streakData.streaks.journaling?.currentStreak || 0;
  const journalStreakAchievements = ACHIEVEMENTS.filter(
    (a) => a.requirement.type === "journal_streak"
  );
  for (const ach of journalStreakAchievements) {
    const progress = Math.min(
      100,
      Math.round((journalStreak / ach.requirement.target) * 100)
    );
    const unlocked = await unlockAchievement(userId, ach.key, progress);
    if (unlocked) newlyUnlocked.push(ach.key);
  }

  return { newlyUnlocked };
}

export async function checkMt5Achievement(userId: string): Promise<boolean> {
  const unlocked = await unlockAchievement(userId, "mt5_connected", 100);
  return unlocked;
}

export async function checkEducationAchievement(
  userId: string,
  completedPhases: number,
  perfectQuizzes: number
): Promise<string[]> {
  const newlyUnlocked: string[] = [];

  if (completedPhases >= 1) {
    const unlocked = await unlockAchievement(userId, "education_phase1", 100);
    if (unlocked) newlyUnlocked.push("education_phase1");
  }
  if (completedPhases >= 8) {
    const unlocked = await unlockAchievement(userId, "education_all", 100);
    if (unlocked) newlyUnlocked.push("education_all");
  }

  const progress = Math.min(100, Math.round((completedPhases / 8) * 100));
  await unlockAchievement(userId, "education_all", progress);

  if (perfectQuizzes >= 5) {
    const unlocked = await unlockAchievement(userId, "quiz_master", 100);
    if (unlocked) newlyUnlocked.push("quiz_master");
  }
  const quizProgress = Math.min(100, Math.round((perfectQuizzes / 5) * 100));
  await unlockAchievement(userId, "quiz_master", quizProgress);

  return newlyUnlocked;
}
