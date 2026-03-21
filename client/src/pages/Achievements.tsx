import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Flame,
  Shield,
  ShieldCheck,
  Target,
  Crosshair,
  BookOpen,
  GraduationCap,
  Brain,
  Award,
  Medal,
  Crown,
  Zap,
  RotateCcw,
  CheckCircle,
  Calendar,
  CalendarCheck,
  Heart,
  TrendingUp,
  BarChart3,
  Footprints,
  Lock,
  Sparkles,
  Star,
  Share2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { MilestoneShareModal } from "@/components/MilestoneShareModal";
import { parseTier } from "@/components/MilestoneShareCard";
import type { AchievementCardData, StreakCardData, MilestoneCardVariant } from "@/components/MilestoneShareCard";

const ICON_MAP: Record<string, any> = {
  footprints: Footprints,
  "trending-up": TrendingUp,
  "bar-chart-3": BarChart3,
  award: Award,
  medal: Medal,
  crown: Crown,
  trophy: Trophy,
  flame: Flame,
  shield: Shield,
  "shield-check": ShieldCheck,
  "check-circle": CheckCircle,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  "calendar-heart": Heart,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  brain: Brain,
  target: Target,
  crosshair: Crosshair,
  zap: Zap,
  "rotate-ccw": RotateCcw,
};

const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-700 to-amber-900 text-amber-200",
  silver: "from-slate-300 to-slate-500 text-slate-900",
  gold: "from-yellow-400 to-yellow-600 text-yellow-900",
  platinum: "from-cyan-300 to-cyan-500 text-cyan-900",
};

const TIER_BORDER: Record<string, string> = {
  bronze: "border-amber-700/50",
  silver: "border-slate-400/50",
  gold: "border-yellow-500/50",
  platinum: "border-cyan-400/50",
};

const TIER_GLOW: Record<string, string> = {
  bronze: "shadow-amber-700/20",
  silver: "shadow-slate-400/20",
  gold: "shadow-yellow-500/30",
  platinum: "shadow-cyan-400/30",
};

const CATEGORY_LABELS: Record<string, { label: string; icon: any }> = {
  milestones: { label: "Milestones", icon: Trophy },
  discipline: { label: "Discipline", icon: Shield },
  streaks: { label: "Streaks", icon: Flame },
  education: { label: "Education", icon: BookOpen },
  performance: { label: "Performance", icon: Target },
};

interface AchievementData {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  xpReward: number;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
}

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

interface AchievementsResponse {
  achievements: AchievementData[];
  streaks: Record<string, StreakInfo>;
  totalXp: number;
  level: {
    level: number;
    name: string;
    xpRequired: number;
    totalXp: number;
    nextLevelXp: number;
    nextLevelName: string;
    progress: number;
  };
}

interface ShareState {
  open: boolean;
  variant: MilestoneCardVariant;
  title: string;
  subtitle?: string;
  data: AchievementCardData | StreakCardData | null;
}

const LS_KEY = "tradify_shown_milestones";

function getShownMilestones(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markMilestoneShown(key: string) {
  try {
    const set = getShownMilestones();
    set.add(key);
    localStorage.setItem(LS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

const STREAK_MILESTONES = [7, 30, 100];

function computeStreakMeta(data: AchievementsResponse, type: "journaling" | "trading" | "compliance") {
  const complianceStreak = data.streaks?.compliance?.currentStreak || 0;
  const longestCompliance = data.streaks?.compliance?.longestStreak || 1;
  const complianceRate = Math.min(Math.round((complianceStreak / Math.max(longestCompliance, 7)) * 100), 100);
  const levelProgress = data.level?.progress || 0;
  const accountHealth: StreakCardData["accountHealth"] =
    levelProgress >= 66 ? "healthy" : levelProgress >= 33 ? "caution" : "needs-attention";
  return { complianceRate, accountHealth };
}

export default function Achievements() {
  const { toast } = useToast();

  const [shareState, setShareState] = useState<ShareState>({
    open: false,
    variant: "achievement",
    title: "",
    data: null,
  });

  const prevUnlockedKeysRef = useRef<Set<string>>(new Set());

  const { data, isLoading } = useQuery<AchievementsResponse>({
    queryKey: ["/api/achievements"],
  });

  const { data: user } = useQuery<{ fullName?: string }>({
    queryKey: ["/api/user"],
  });

  const userName = user?.fullName || undefined;

  useEffect(() => {
    if (!data) return;

    const currentUnlocked = new Set(
      data.achievements.filter((a) => a.unlocked).map((a) => a.key)
    );
    const shown = getShownMilestones();
    const isInitialLoad = prevUnlockedKeysRef.current.size === 0;
    let triggered = false;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    currentUnlocked.forEach((key) => {
      if (triggered) return;
      const isNew = isInitialLoad ? false : !prevUnlockedKeysRef.current.has(key);
      const achDef = data.achievements.find((a) => a.key === key);

      const isRecent = achDef?.unlockedAt
        ? now - new Date(achDef.unlockedAt).getTime() < oneDayMs
        : false;

      const shouldPop = isNew || (isInitialLoad && isRecent);
      if (!shouldPop) return;

      const lsKey = `ach_${key}`;
      if (shown.has(lsKey)) return;

      if (achDef) {
        const cardData: AchievementCardData = {
          achievementName: achDef.name,
          achievementDescription: achDef.description,
          tier: parseTier(achDef.tier),
          xpEarned: achDef.xpReward,
          totalXp: (data.totalXp || 0) + achDef.xpReward,
          levelName: data.level?.name || "Beginner",
          levelNumber: data.level?.level || 1,
          complianceStreak: data.streaks?.compliance?.currentStreak,
        };
        markMilestoneShown(lsKey);
        setShareState({
          open: true,
          variant: "achievement",
          title: "Achievement Unlocked",
          subtitle: "Share your progress with the trading community",
          data: cardData,
        });
        triggered = true;
      }
    });

    prevUnlockedKeysRef.current = currentUnlocked;
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const shown = getShownMilestones();
    const LAST_STREAK_PREFIX = "tradify_last_streak_";

    const streakTypes = ["journaling", "trading", "compliance"] as const;
    for (const type of streakTypes) {
      const streak = data.streaks?.[type];
      if (!streak) continue;
      const current = streak.currentStreak;

      const lastSeenRaw = localStorage.getItem(`${LAST_STREAK_PREFIX}${type}`);
      const lastSeen = lastSeenRaw !== null ? parseInt(lastSeenRaw, 10) : -1;

      localStorage.setItem(`${LAST_STREAK_PREFIX}${type}`, String(current));

      for (const threshold of STREAK_MILESTONES) {
        const crossed = lastSeen < threshold && current >= threshold;
        if (!crossed) continue;

        const key = `streak_${type}_${threshold}`;
        if (shown.has(key)) continue;

        markMilestoneShown(key);
        const { complianceRate, accountHealth } = computeStreakMeta(data, type);
        const cardData: StreakCardData = {
          streakType: type,
          currentStreak: current,
          longestStreak: streak.longestStreak,
          levelName: data.level?.name || "Beginner",
          levelNumber: data.level?.level || 1,
          totalXp: data.totalXp || 0,
          complianceRate,
          accountHealth,
        };
        setShareState({
          open: true,
          variant: "streak",
          title: `${threshold}-Day Streak!`,
          subtitle: `${type.charAt(0).toUpperCase() + type.slice(1)} — ${current} consecutive days`,
          data: cardData,
        });
        return;
      }
    }
  }, [data]);

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/achievements/check");
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      if (result.newlyUnlocked?.length > 0) {
        toast({
          title: "Achievements Unlocked!",
          description: `You unlocked ${result.newlyUnlocked.length} new achievement${result.newlyUnlocked.length > 1 ? "s" : ""}!`,
        });
        const shown = getShownMilestones();
        const firstNew = result.newlyUnlocked[0] as string;
        const key = `ach_${firstNew}`;
        if (!shown.has(key)) {
          const currentData = data;
          if (currentData) {
            const achDef = currentData.achievements.find((a) => a.key === firstNew);
            if (achDef) {
              const cardData: AchievementCardData = {
                achievementName: achDef.name,
                achievementDescription: achDef.description,
                tier: parseTier(achDef.tier),
                xpEarned: achDef.xpReward,
                totalXp: (currentData.totalXp || 0) + achDef.xpReward,
                levelName: currentData.level?.name || "Beginner",
                levelNumber: currentData.level?.level || 1,
                complianceStreak: currentData.streaks?.compliance?.currentStreak,
              };
              markMilestoneShown(key);
              setShareState({
                open: true,
                variant: "achievement",
                title: "Achievement Unlocked",
                subtitle: "Share your progress with the trading community",
                data: cardData,
              });
            }
          }
        }
      } else {
        toast({
          title: "Achievements Checked",
          description: "Your progress has been updated.",
        });
      }
    },
  });

  function openAchievementShare(achievement: AchievementData) {
    if (!data) return;
    const cardData: AchievementCardData = {
      achievementName: achievement.name,
      achievementDescription: achievement.description,
      tier: parseTier(achievement.tier),
      xpEarned: achievement.xpReward,
      totalXp: data.totalXp || 0,
      levelName: data.level?.name || "Beginner",
      levelNumber: data.level?.level || 1,
      complianceStreak: data.streaks?.compliance?.currentStreak,
    };
    setShareState({
      open: true,
      variant: "achievement",
      title: "Share Achievement",
      subtitle: achievement.name,
      data: cardData,
    });
  }

  function openStreakShare(type: "journaling" | "trading" | "compliance", streak: StreakInfo) {
    if (!data) return;
    const { complianceRate, accountHealth } = computeStreakMeta(data, type);
    const cardData: StreakCardData = {
      streakType: type,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      levelName: data.level?.name || "Beginner",
      levelNumber: data.level?.level || 1,
      totalXp: data.totalXp || 0,
      complianceRate,
      accountHealth,
    };
    setShareState({
      open: true,
      variant: "streak",
      title: "Share Streak",
      subtitle: `${streak.currentStreak}-day streak`,
      data: cardData,
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6" data-testid="achievements-loading">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const achievements = data?.achievements || [];
  const streaks = data?.streaks || {};
  const level = data?.level;
  const totalXp = data?.totalXp || 0;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const categories = ["milestones", "discipline", "streaks", "education", "performance"];

  return (
    <div className="min-h-screen bg-background p-6" data-testid="achievements-page">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter italic text-foreground" data-testid="achievements-title">
              Achievements
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {unlockedCount} of {achievements.length} unlocked
            </p>
          </div>
          <button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-emerald-500 transition-colors disabled:opacity-50"
            data-testid="button-check-achievements"
          >
            <Sparkles className="w-4 h-4" />
            {checkMutation.isPending ? "Checking..." : "Sync Progress"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-5" data-testid="xp-level-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Star className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Level {level?.level || 1}</p>
                <p className="text-lg font-bold text-foreground">{level?.name || "Beginner"}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{totalXp} XP</span>
                <span>{level?.nextLevelXp || 50} XP</span>
              </div>
              <Progress value={level?.progress || 0} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Next: {level?.nextLevelName || "Apprentice"}
              </p>
            </div>
          </div>

          {(["journaling", "trading", "compliance"] as const).map((type) => {
            const streak = streaks[type];
            const labels: Record<string, string> = {
              journaling: "Journal Streak",
              trading: "Trading Streak",
              compliance: "Compliance Streak",
            };
            const icons: Record<string, any> = {
              journaling: Calendar,
              trading: TrendingUp,
              compliance: ShieldCheck,
            };
            const Icon = icons[type];
            const current = streak?.currentStreak || 0;
            const longest = streak?.longestStreak || 0;

            return (
              <div
                key={type}
                className="bg-card border border-border rounded-xl p-5"
                data-testid={`streak-card-${type}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      current > 0 ? "bg-orange-500/10" : "bg-muted"
                    )}>
                      {current > 0 ? (
                        <Flame className="w-5 h-5 text-orange-500" />
                      ) : (
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        {labels[type]}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-foreground" data-testid={`streak-count-${type}`}>
                          {current}
                        </span>
                        <span className="text-sm text-muted-foreground">days</span>
                      </div>
                    </div>
                  </div>
                  {current >= 7 && (
                    <button
                      onClick={() => openStreakShare(type, streak)}
                      className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-500/60 hover:text-emerald-500 transition-colors"
                      title="Share this streak"
                      data-testid={`button-share-streak-${type}`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Best: {longest} days
                </p>
              </div>
            );
          })}
        </div>

        {categories.map((category) => {
          const categoryAchievements = achievements.filter(
            (a) => a.category === category
          );
          if (categoryAchievements.length === 0) return null;

          const catInfo = CATEGORY_LABELS[category];
          const CatIcon = catInfo?.icon || Trophy;
          const unlockedInCat = categoryAchievements.filter((a) => a.unlocked).length;

          return (
            <div key={category} className="space-y-4" data-testid={`category-${category}`}>
              <div className="flex items-center gap-3">
                <CatIcon className="w-5 h-5 text-emerald-500" />
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                  {catInfo?.label || category}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {unlockedInCat}/{categoryAchievements.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {categoryAchievements.map((achievement) => {
                  const Icon = ICON_MAP[achievement.icon] || Trophy;
                  const isUnlocked = achievement.unlocked;
                  const tierColor = TIER_COLORS[achievement.tier] || TIER_COLORS.bronze;
                  const tierBorder = TIER_BORDER[achievement.tier] || TIER_BORDER.bronze;
                  const tierGlow = TIER_GLOW[achievement.tier] || TIER_GLOW.bronze;

                  return (
                    <div
                      key={achievement.key}
                      className={cn(
                        "relative bg-card border rounded-xl p-4 transition-all duration-300",
                        isUnlocked
                          ? `${tierBorder} shadow-lg ${tierGlow}`
                          : "border-border opacity-60"
                      )}
                      data-testid={`achievement-${achievement.key}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            isUnlocked
                              ? `bg-gradient-to-br ${tierColor}`
                              : "bg-muted"
                          )}
                        >
                          {isUnlocked ? (
                            <Icon className="w-5 h-5" />
                          ) : (
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-foreground truncate">
                              {achievement.name}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {achievement.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        {!isUnlocked && achievement.progress > 0 && (
                          <Progress value={achievement.progress} className="h-1.5" />
                        )}
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            isUnlocked ? "text-emerald-500" : "text-muted-foreground"
                          )}>
                            {isUnlocked ? "Unlocked" : `${achievement.progress}%`}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground">
                            +{achievement.xpReward} XP
                          </span>
                        </div>
                      </div>

                      {isUnlocked && (
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <button
                            onClick={() => openAchievementShare(achievement)}
                            className="p-1 rounded-md hover:bg-emerald-500/10 text-emerald-500/50 hover:text-emerald-500 transition-colors"
                            title="Share this achievement"
                            data-testid={`button-share-achievement-${achievement.key}`}
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                          <div className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-gradient-to-r",
                            tierColor
                          )}>
                            {achievement.tier}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {shareState.data && (
        <MilestoneShareModal
          open={shareState.open}
          onOpenChange={(open) => setShareState((s) => ({ ...s, open }))}
          variant={shareState.variant}
          title={shareState.title}
          subtitle={shareState.subtitle}
          userName={userName}
          data={shareState.data}
        />
      )}
    </div>
  );
}
