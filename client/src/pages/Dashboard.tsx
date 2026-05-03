import { usePlan } from "@/hooks/usePlan";
import { useSampleMode } from "@/hooks/useSampleMode";
import {
  getSampleEquityCurve,
  getSampleMt5Status,
  getSampleTodayStats,
  SAMPLE_ACCOUNT_NUMBER,
  SAMPLE_ACCOUNT_NAME,
  SAMPLE_BROKER,
  SAMPLE_SERVER,
} from "@/lib/sampleData";
import { SampleDataBanner } from "@/components/SampleDataBanner";
import { MyCoachBanner } from "@/components/MyCoachBanner";
import { CoachQuickAccessCard } from "@/components/CoachQuickAccessCard";
import { FoundingMemberBadge } from "@/components/FoundingMemberBadge";
import { StatCard } from "@/components/StatCard";
import { SessionAnalytics } from "@/components/SessionAnalytics";
import { TimePatterns } from "@/components/TimePatterns";
import { BehavioralRiskFlags } from "@/components/BehavioralRiskFlags";
import { StrategyDeviationAnalysis } from "@/components/StrategyDeviationAnalysis";
import { MonthlyReviewReport } from "@/components/MonthlyReviewReport";
import { PdfExportButton } from "@/components/PdfExportButton";
import DashboardCustomizer, { useDashboardConfig } from "@/components/DashboardCustomizer";
import { PsychologyTradeReview } from "@/components/PsychologyTradeReview";
import { 
  Activity, 
  Wallet,
  DollarSign,
  LayoutDashboard,
  Lock,
  Zap,
  Calendar,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Percent,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronDown,
  BarChart3,
  CircleCheck,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Link } from "react-router-dom";
import { format, startOfWeek, startOfMonth, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";

// Type for MT5 Account
type MT5Account = {
  id: number;
  userId: string;
  accountNumber: string;
  accountName: string | null;
  broker: string | null;
  server: string | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
};

import { Trophy as TrophyIcon, Flame, Star, Award as AwardIcon, ArrowRight } from "lucide-react";

function AchievementsWidget() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/achievements"],
    staleTime: 30000,
  });

  const { data: defData } = useQuery<any[]>({
    queryKey: ["/api/achievements/definitions"],
    staleTime: 300000,
  });

  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!defData || checked) return;
    setChecked(true);
    apiRequest("POST", "/api/achievements/check")
      .then((res) => res.json())
      .then((result) => {
        if (result?.newlyUnlocked?.length > 0) {
          qc.invalidateQueries({ queryKey: ["/api/achievements"] });
          for (const key of result.newlyUnlocked) {
            const def = defData.find((d: any) => d.key === key);
            if (def) {
              toast({
                title: t("dashboard.achievementUnlockedToast"),
                description: t("dashboard.achievementUnlockedDesc", { name: def.name, xp: def.xpReward }),
              });
            }
          }
        }
      })
      .catch(() => {});
  }, [defData, checked]);

  if (isLoading) {
    return (
      <div className="mb-8 bg-card border border-border rounded-2xl p-6 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg" />)}
        </div>
      </div>
    );
  }

  const level = data?.level;
  const streaks = data?.streaks || {};
  const achievements = data?.achievements || [];
  const recentUnlocked = achievements
    .filter((a: any) => a.unlocked)
    .sort((a: any, b: any) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
    .slice(0, 3);
  const totalXp = data?.totalXp || 0;
  const journalStreak = streaks.journaling?.currentStreak || 0;
  const tradingStreak = streaks.trading?.currentStreak || 0;
  const unlockedCount = achievements.filter((a: any) => a.unlocked).length;

  return (
    <div className="mb-8 bg-card border border-border rounded-2xl p-6 shadow-2xl" data-testid="dashboard-achievements-widget">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <TrophyIcon size={18} className="text-emerald-500" />
          {t("dashboard.achievements")}
        </h3>
        <Link to="/achievements" className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1 hover:text-emerald-400" data-testid="link-view-all-achievements">
          {t("dashboard.viewAll")} <ArrowRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <div className="bg-background/50 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Star size={14} className="text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("dashboard.level", { level: level?.level || 1 })}</span>
          </div>
          <p className="text-sm font-bold text-foreground">{level?.name || t("dashboard.beginner")}</p>
          <Progress value={level?.progress || 0} className="h-1 mt-2" />
          <p className="text-[10px] text-muted-foreground mt-1">{totalXp} XP</p>
        </div>

        <div className="bg-background/50 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={14} className={journalStreak > 0 ? "text-orange-500" : "text-muted-foreground"} />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("dashboard.journalStreak")}</span>
          </div>
          <p className="text-xl font-black text-foreground">{journalStreak}<span className="text-xs text-muted-foreground ml-1">{t("dashboard.daysShort")}</span></p>
        </div>

        <div className="bg-background/50 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className={tradingStreak > 0 ? "text-emerald-500" : "text-muted-foreground"} />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("dashboard.tradingStreak")}</span>
          </div>
          <p className="text-xl font-black text-foreground">{tradingStreak}<span className="text-xs text-muted-foreground ml-1">{t("dashboard.daysShort")}</span></p>
        </div>

        <div className="bg-background/50 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <AwardIcon size={14} className="text-yellow-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("dashboard.badges")}</span>
          </div>
          <p className="text-xl font-black text-foreground">{unlockedCount}<span className="text-xs text-muted-foreground ml-1">{t("dashboard.ofCount", { count: achievements.length })}</span></p>
        </div>
      </div>

      {recentUnlocked.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{t("dashboard.recentAchievements")}</p>
          <div className="flex gap-3 flex-wrap">
            {recentUnlocked.map((ach: any) => (
              <div key={ach.key} className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                <AwardIcon size={14} className="text-emerald-500" />
                <span className="text-xs font-bold text-foreground">{ach.name}</span>
                <span className="text-[9px] text-muted-foreground">+{ach.xpReward} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedInstrument, setSelectedInstrument] = useState<string>("");
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const dashConfig = useDashboardConfig();
  
  const { toast } = useToast();
  const isLoading = false;
  const { data: user } = useQuery<any>({ 
    queryKey: ["/api/user"],
    staleTime: 0,
  });
  
  const userId = user?.userId;
  
  const { data: realMt5, refetch: refetchStatus } = useQuery<any>({
    queryKey: [`/api/mt5/status/${userId}`],
    refetchInterval: 5000,
    enabled: !!userId,
    staleTime: 0,
  });

  // MT5 Accounts for multi-account support
  const { data: realMt5Accounts } = useQuery<MT5Account[]>({
    queryKey: ['/api/mt5/accounts', userId],
    enabled: !!userId,
  });

  const { data: realActiveAccount } = useQuery<MT5Account | null>({
    queryKey: ['/api/mt5/accounts', userId, 'active'],
    enabled: !!userId,
  });

  // Sample mode kicks in when the user has no real trades and no live MT5
  // connection. We swap in deterministic demo data so the dashboard is alive.
  const sampleMode = useSampleMode();
  const mt5 = sampleMode.active
    ? { ...getSampleMt5Status(), status: "CONNECTED" }
    : realMt5;
  const sampleAccount: MT5Account = {
    id: -1,
    userId: userId || "",
    accountNumber: SAMPLE_ACCOUNT_NUMBER,
    accountName: SAMPLE_ACCOUNT_NAME,
    broker: SAMPLE_BROKER,
    server: SAMPLE_SERVER,
    currency: "USD",
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  const mt5Accounts = sampleMode.active ? [sampleAccount] : realMt5Accounts;
  const activeAccount = sampleMode.active ? sampleAccount : realActiveAccount;

  const switchAccountMutation = useMutation({
    mutationFn: async (accountNumber: string) => {
      return apiRequest('POST', `/api/mt5/accounts/${userId}/switch`, { accountNumber });
    },
    onSuccess: () => {
      // Invalidate ALL queries that depend on MT5 account data
      queryClient.invalidateQueries({ queryKey: ['/api/mt5/accounts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/equity-curve/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/mt5/history/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/mt5/status/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/performance/intelligence/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/session-analytics/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/time-patterns/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/behavioral-risks/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/strategy-deviation/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/instruments/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ai/insights/${userId}`] });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (accountNumber: string) => {
      return apiRequest('DELETE', `/api/mt5/accounts/${userId}/${accountNumber}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mt5/accounts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/mt5/status/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/mt5/history/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/equity-curve/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
      queryClient.invalidateQueries({ queryKey: [`/api/performance/intelligence/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/session-analytics/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/time-patterns/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/behavioral-risks/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/strategy-deviation/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/instruments/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ai/insights/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/score'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prop-firm'] });
      toast({
        title: t("dashboard.accountDeletedTitle"),
        description: t("dashboard.accountDeletedDesc"),
      });
      setAccountToDelete(null);
    },
  });

  const { data: intelligence } = useQuery<any>({
    queryKey: [`/api/performance/intelligence/${userId}`],
    staleTime: 0,
    enabled: !!userId,
    refetchInterval: 60000,
  });

  // Equity curve from cumulative trade P&L (SINGLE SOURCE OF TRUTH)
  const { data: realEquityCurveResponse } = useQuery<{ trades: any[], todayStats: { pl: number, count: number } }>({
    queryKey: [`/api/equity-curve/${userId}`],
    queryFn: async () => {
      const tzOffset = new Date().getTimezoneOffset() * -1;
      const res = await fetch(`/api/equity-curve/${userId}?tzOffset=${tzOffset}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (Array.isArray(data)) return { trades: data, todayStats: { pl: 0, count: 0 } };
      return data;
    },
    staleTime: 0,
    enabled: !!userId && !sampleMode.active,
    refetchInterval: 30000,
  });
  const equityCurveData = sampleMode.active
    ? getSampleEquityCurve()
    : realEquityCurveResponse?.trades;
  const todayStats = sampleMode.active
    ? getSampleTodayStats()
    : realEquityCurveResponse?.todayStats;

  const { isPaid: isPro, isElite, isCoach, canAccess } = usePlan();

  const { data: insights, isLoading: isInsightsLoading } = useQuery<any>({
    queryKey: [`/api/ai/insights/${userId}`],
    enabled: !!userId && isPro,
  });

  // Fetch available instruments from MT5 history
  const { data: instrumentsData } = useQuery<{ symbols: string[] }>({
    queryKey: [`/api/instruments/${userId}`],
    enabled: !!userId,
    refetchInterval: 60000,
  });

  // Mutation for generating instrument analysis
  const instrumentAnalysisMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await apiRequest("POST", `/api/ai/instrument-analysis/${userId}`, { symbol });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/ai/instrument-analysis/${userId}`, selectedInstrument], data);
    }
  });

  // Fetch cached analysis for selected instrument
  const { data: instrumentAnalysis } = useQuery<any>({
    queryKey: [`/api/ai/instrument-analysis/${userId}`, selectedInstrument],
    enabled: false, // Only populated via mutation
  });

  const handleInstrumentSelect = (symbol: string) => {
    setSelectedInstrument(symbol);
    if (symbol && isPro) {
      instrumentAnalysisMutation.mutate(symbol);
    }
  };

  // Compliance score for active strategy (aggregated, no rule evaluation)
  const { data: complianceScore, isLoading: isComplianceLoading } = useQuery<{
    strategyId: number;
    strategyName: string;
    compliancePercent: number;
    violationsCount: number;
    trendDirection: 'improving' | 'declining' | 'stable';
    tradesEvaluated: number;
  }>({
    queryKey: ['/api/compliance/score'],
    enabled: !!userId,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleFullRefresh = useCallback(async () => {
    if (!userId) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/mt5/status/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/equity-curve/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/mt5/history/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: ['/api/mt5/accounts', userId] }),
        queryClient.invalidateQueries({ queryKey: [`/api/performance/intelligence/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/session-analytics/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/time-patterns/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/behavioral-risks/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/strategy-deviation/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/instruments/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/ai/insights/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: ['/api/compliance/score'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/trades'] }),
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [userId]);

  // Date filtering helper - define as a callback for useMemo to use
  const isWithinDateRange = (dateStr: string | Date | null) => {
    if (dateFilter === "all") return true;
    if (!dateStr) return false;
    
    const tradeDate = new Date(dateStr);
    if (isNaN(tradeDate.getTime())) return false;
    
    const now = new Date();
    
    const tradeDateUTC = tradeDate.toISOString().slice(0, 10);
    const nowUTC = now.toISOString().slice(0, 10);
    
    if (dateFilter === "today") {
      return tradeDateUTC === nowUTC;
    } else if (dateFilter === "7days") {
      const cutoff = subDays(new Date(nowUTC + "T00:00:00Z"), 7);
      return tradeDate >= cutoff && tradeDate <= now;
    } else if (dateFilter === "30days") {
      const cutoff = subDays(new Date(nowUTC + "T00:00:00Z"), 30);
      return tradeDate >= cutoff && tradeDate <= now;
    } else if (dateFilter === "week") {
      const weekStart = startOfWeek(new Date(nowUTC + "T00:00:00Z"));
      return tradeDate >= weekStart && tradeDate <= now;
    } else if (dateFilter === "month") {
      const monthStart = startOfMonth(new Date(nowUTC + "T00:00:00Z"));
      return tradeDate >= monthStart && tradeDate <= now;
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate + "T00:00:00Z");
      const end = new Date(customEndDate + "T23:59:59.999Z");
      return tradeDate >= start && tradeDate <= end;
    }
    return true;
  };
  
  // Filter equity curve data by date
  const filteredEquityCurve = useMemo(() => {
    if (!equityCurveData) return [];
    const filtered = equityCurveData.filter(point => isWithinDateRange(point.date));
    
    // Recalculate cumulative P&L for filtered data
    let cumulative = 0;
    return filtered.map(point => {
      cumulative += point.netPl;
      return {
        date: format(new Date(point.date), 'MMM d'),
        equity: cumulative,
        tradePl: point.netPl
      };
    });
  }, [equityCurveData, dateFilter, customStartDate, customEndDate]);
  
  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    if (!equityCurveData) return { totalPl: 0, wins: 0, losses: 0, breakeven: 0, total: 0, winRate: "0.0", avgWin: 0, avgLoss: 0, expectancy: 0, profitFactor: "0.00", bestTrade: 0, worstTrade: 0 };
    
    const filtered = equityCurveData.filter(point => isWithinDateRange(point.date));
    const total = filtered.length;
    const wins = filtered.filter(t => t.netPl > 0).length;
    const losses = filtered.filter(t => t.netPl < 0).length;
    const breakeven = filtered.filter(t => t.netPl === 0).length;
    const totalPl = filtered.reduce((acc, t) => acc + t.netPl, 0);
    
    const decisiveTrades = wins + losses;
    const winRate = decisiveTrades > 0 ? (wins / decisiveTrades * 100).toFixed(1) : "0.0";
    
    const winningTrades = filtered.filter(t => t.netPl > 0);
    const losingTrades = filtered.filter(t => t.netPl < 0);
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((acc, t) => acc + t.netPl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((acc, t) => acc + t.netPl, 0)) / losingTrades.length : 0;
    
    const winRateDecimal = decisiveTrades > 0 ? wins / decisiveTrades : 0;
    const lossRateDecimal = decisiveTrades > 0 ? losses / decisiveTrades : 0;
    const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);
    
    const grossProfit = winningTrades.reduce((acc, t) => acc + t.netPl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.netPl, 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";
    
    const bestTrade = filtered.length > 0 ? Math.max(...filtered.map(t => t.netPl)) : 0;
    const worstTrade = filtered.length > 0 ? Math.min(...filtered.map(t => t.netPl)) : 0;
    
    return { totalPl, wins, losses, breakeven, total, winRate, avgWin, avgLoss, expectancy, profitFactor, bestTrade, worstTrade };
  }, [equityCurveData, dateFilter, customStartDate, customEndDate]);
  
  const chartData = filteredEquityCurve;

  const formatPl = (value: number) => {
    const formatted = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const todayPl = todayStats?.pl ?? 0;
  const todayTradeCount = todayStats?.count ?? 0;

  const stats = [
    { 
      label: t("dashboard.statBalance"), 
      value: mt5?.status === "CONNECTED" && mt5.metrics ? `$${parseFloat(mt5.metrics.balance).toLocaleString()}` : "$0", 
      icon: <Wallet size={18} />, 
      subtext: mt5?.status === "CONNECTED" ? t("dashboard.connected") : t("dashboard.offline"),
      trend: mt5?.status === "CONNECTED" ? "up" : "down" as "up" | "down"
    },
    { 
      label: t("dashboard.statEquity"), 
      value: mt5?.status === "CONNECTED" && mt5.metrics ? `$${parseFloat(mt5.metrics.equity).toLocaleString()}` : "$0", 
      icon: <Activity size={18} />, 
      subtext: mt5?.status === "CONNECTED" ? t("dashboard.connected") : t("dashboard.offline"),
      trend: mt5?.status === "CONNECTED" ? "up" : "down" as "up" | "down"
    },
    { 
      label: t("dashboard.statPeriodPL"), 
      value: formatPl(filteredStats.totalPl), 
      icon: <DollarSign size={18} />, 
      subtext: t("dashboard.statTrades", { count: filteredStats.total }),
      trend: filteredStats.totalPl >= 0 ? "up" : "down" as "up" | "down"
    },
    { 
      label: t("dashboard.statWinRate"), 
      value: `${filteredStats.winRate}%`, 
      icon: <Percent size={18} />, 
      subtext: t("dashboard.statWL", { wins: filteredStats.wins, losses: filteredStats.losses }),
      trend: parseFloat(filteredStats.winRate) >= 50 ? "up" : "down" as "up" | "down"
    },
  ];

  // Filter recent trades by date range
  const recentTrades = useMemo(() => {
    if (!equityCurveData) return [];
    return equityCurveData
      .filter(point => isWithinDateRange(point.date))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(tr => ({
        symbol: tr.symbol,
        netPl: tr.netPl,
        date: tr.date,
        source: tr.source,
        outcome: tr.netPl > 0 ? "Win" : tr.netPl < 0 ? "Loss" : "Break-even"
      }));
  }, [equityCurveData, dateFilter, customStartDate, customEndDate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin text-emerald-500"><Activity size={32} /></div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        {sampleMode.active && <SampleDataBanner />}
        <MyCoachBanner />
        {isCoach && <CoachQuickAccessCard />}
        <header className="mb-8 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
                  <LayoutDashboard className="text-emerald-500" />
                  {t("dashboard.title")}
                </h1>
                {sampleMode.active && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-500"
                    data-testid="badge-sample-mode"
                    title="You're viewing sample data. Connect MT5 to see your own."
                  >
                    <Sparkles size={11} className="text-amber-500" />
                    Sample data
                  </span>
                )}
                {user?.foundingMember && <FoundingMemberBadge size="md" />}
              </div>
              <p className="text-muted-foreground text-sm mt-1">{t("dashboard.subtitle")}</p>
            </div>
            {sampleMode.active ? (
              <div
                className="flex items-center gap-4 bg-card border border-amber-500/40 rounded-full px-5 py-2.5 backdrop-blur-sm shrink-0"
                data-testid="status-pill-sample"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Sample mode</span>
                </div>
                <div className="w-px h-5 bg-border" />
                <div className="text-[10px] text-muted-foreground font-mono font-bold uppercase">
                  Demo data
                </div>
              </div>
            ) : mt5?.status === "CONNECTED" ? (
              <div className="flex items-center gap-4 bg-card border border-border rounded-full px-5 py-2.5 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">{t("dashboard.mt5LiveSync")}</span>
                </div>
                <div className="w-px h-5 bg-border" />
                <div className="text-[10px] text-muted-foreground font-mono font-bold uppercase">
                  {t("dashboard.active")}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-4 bg-card border border-border rounded-full px-5 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">{t("dashboard.mt5Offline")}</span>
                  </div>
                  {mt5?.lastSync && (
                    <>
                      <div className="w-px h-5 bg-border" />
                      <div className="text-[10px] text-muted-foreground font-mono font-bold">
                        {t("dashboard.lastSync")}: {format(new Date(mt5.lastSync), 'MMM d, HH:mm')}
                      </div>
                    </>
                  )}
                </div>
                {mt5?.error && (
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-tighter pr-4">
                    {t("dashboard.statusLabel")}: {mt5.error}
                  </span>
                )}
                {!mt5?.lastSync && (
                  <Link to="/traders-hub">
                    <Button variant="ghost" className="text-[10px] text-emerald-500 h-auto p-0 font-bold uppercase">{t("dashboard.setupBridge")}</Button>
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
              {['all', 'today', '7days', '30days'].map((filter) => (
                <Button
                  key={filter}
                  variant={dateFilter === filter ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDateFilter(filter)}
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-3 rounded-lg",
                    dateFilter === filter && "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  )}
                  data-testid={`dashboard-filter-${filter}`}
                >
                  {filter === 'all' ? t("dashboard.filterAll") : filter === '7days' ? t("dashboard.filter7days") : filter === '30days' ? t("dashboard.filter30days") : filter === 'today' ? t("dashboard.filterToday") : filter}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateFilter === "custom" ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-3 rounded-lg",
                      dateFilter === "custom" && "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    )}
                    data-testid="dashboard-filter-custom"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    {t("dashboard.custom")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("dashboard.customDateRange")}</div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{t("dashboard.from")}</label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="text-sm"
                          data-testid="dashboard-input-start-date"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{t("dashboard.to")}</label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="text-sm"
                          data-testid="dashboard-input-end-date"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => setDateFilter("custom")}
                      disabled={!customStartDate || !customEndDate}
                      className="w-full bg-emerald-500 text-white text-xs font-bold uppercase"
                      data-testid="dashboard-button-apply-custom-date"
                    >
                      {t("dashboard.applyFilter")}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            {mt5Accounts && mt5Accounts.length >= 1 && !sampleMode.active && (
              <div className="flex items-center gap-2">
                <Select
                  value={activeAccount?.accountNumber || mt5Accounts[0]?.accountNumber || ""}
                  onValueChange={(value) => {
                    if (value) {
                      switchAccountMutation.mutate(value);
                    }
                  }}
                >
                  <SelectTrigger 
                    className="w-[180px] text-xs border-border bg-background"
                    data-testid="mt5-account-selector"
                  >
                    <SelectValue placeholder={t("dashboard.selectMT5Account")}>
                      {activeAccount ? (
                        <span className="flex items-center gap-2">
                          <CircleCheck className="h-3 w-3 text-emerald-500" />
                          {activeAccount.accountName || activeAccount.accountNumber}
                        </span>
                      ) : mt5Accounts[0] ? (
                        <span className="flex items-center gap-2">
                          <CircleCheck className="h-3 w-3 text-emerald-500" />
                          {mt5Accounts[0].accountName || mt5Accounts[0].accountNumber}
                        </span>
                      ) : (
                        <span>{t("dashboard.selectAccount")}</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {mt5Accounts.map((account) => (
                      <SelectItem 
                        key={account.accountNumber} 
                        value={account.accountNumber}
                        data-testid={`mt5-account-option-${account.accountNumber}`}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {account.accountName || account.accountNumber}
                          </span>
                          {account.broker && (
                            <span className="text-[10px] text-muted-foreground">
                              {account.broker}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => setAccountToDelete(activeAccount?.accountNumber || mt5Accounts[0]?.accountNumber || "")}
                    data-testid="button-delete-mt5-account"
                  >
                    <Trash2 size={14} />
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("dashboard.deleteMT5AccountTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("dashboard.deleteMT5AccountDesc", { account: accountToDelete })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("dashboard.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground"
                        onClick={() => accountToDelete && deleteAccountMutation.mutate(accountToDelete)}
                        data-testid="button-confirm-delete-account"
                      >
                        {deleteAccountMutation.isPending ? t("dashboard.deleting") : t("dashboard.deleteAccount")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {userId && (
                <PdfExportButton 
                  userId={userId} 
                  startDate={dateFilter === "custom" ? customStartDate : undefined}
                  endDate={dateFilter === "custom" ? customEndDate : undefined}
                />
              )}
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full border-border bg-card text-muted-foreground"
                onClick={handleFullRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh-dashboard"
              >
                <RefreshCw size={16} className={cn(isRefreshing && "animate-spin")} />
              </Button>
              <DashboardCustomizer />
            </div>
          </div>
        </header>

        {dashConfig.widgets.stats !== false && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, i) => (
            <StatCard 
              key={i}
              label={stat.label} 
              value={stat.value}
              subtext={stat.subtext}
              icon={stat.icon}
              trend={stat.trend}
            />
          ))}
        </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Activity size={18} className="text-emerald-500" />
                  {t("dashboard.equityCurve")}
                </h3>
                <p className="text-xs text-muted-foreground">{t("dashboard.equityCurveDesc")}</p>
              </div>
            </div>
            <div className="h-[300px] w-full relative">
              {chartData.length < 2 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/20 backdrop-blur-[1px] rounded-xl border border-dashed border-border/50">
                  <Activity className="text-muted-foreground/30 mb-2 animate-pulse" size={32} />
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">{t("dashboard.awaitingHistory")}</p>
                  <span className="text-[9px] text-muted-foreground/50 mt-1 italic">{t("dashboard.curveHint")}</span>
                </div>
              )}
              {!isPro && chartData.length >= 30 && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
                  <Lock className="text-emerald-500 mb-2" size={24} />
                  <p className="text-sm font-bold text-foreground uppercase tracking-widest">{t("dashboard.day30Limit")}</p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase font-bold">{t("dashboard.upgradeForHistory")}</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => v >= 1000 || v <= -1000 ? `$${(v/1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="equity" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorEquity)" 
                    name="Cumulative P&L"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-emerald-500/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap size={80} className="text-emerald-500" />
            </div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-500" />
                {t("dashboard.aiInstrumentAnalysis")}
              </h3>
            </div>
            
            {/* Instrument Selector */}
            <div className="mb-4">
              <Select value={selectedInstrument} onValueChange={handleInstrumentSelect}>
                <SelectTrigger 
                  className="w-full bg-background/50 border-border"
                  data-testid="select-instrument"
                >
                  <SelectValue placeholder={t("dashboard.selectInstrumentPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {instrumentsData?.symbols && instrumentsData.symbols.length > 0 ? (
                    instrumentsData.symbols.map((symbol) => (
                      <SelectItem key={symbol} value={symbol} data-testid={`instrument-${symbol}`}>
                        {symbol}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>{t("dashboard.noInstrumentsFound")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4">
              {instrumentAnalysisMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <div className="animate-spin text-emerald-500"><RefreshCw size={24} /></div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{t("dashboard.analyzing", { symbol: selectedInstrument })}</p>
                </div>
              ) : instrumentAnalysis?.analysisText ? (
                <div className="space-y-4">
                  {/* Stats Grid */}
                  {instrumentAnalysis.tradeCount > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      <div className="bg-background/50 p-2.5 rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">{t("dashboard.colTrades")}</span>
                        <span className="text-sm font-black text-foreground">{instrumentAnalysis.tradeCount}</span>
                      </div>
                      <div className="bg-background/50 p-2.5 rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">{t("dashboard.colWinRate")}</span>
                        <span className="text-sm font-black text-emerald-500">{instrumentAnalysis.winRate}%</span>
                      </div>
                      <div className="bg-background/50 p-2.5 rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">{t("dashboard.colAvgPL")}</span>
                        <span className={cn(
                          "text-sm font-black",
                          parseFloat(instrumentAnalysis.avgProfitLoss) >= 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          ${instrumentAnalysis.avgProfitLoss}
                        </span>
                      </div>
                      <div className="bg-background/50 p-2.5 rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">{t("dashboard.colTotalPL")}</span>
                        <span className={cn(
                          "text-sm font-black",
                          parseFloat(instrumentAnalysis.totalProfitLoss) >= 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          ${instrumentAnalysis.totalProfitLoss}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* AI Analysis Text */}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="text-xs text-foreground leading-relaxed whitespace-pre-line border-l-2 border-emerald-500/30 pl-4 py-1">
                      {instrumentAnalysis.analysisText}
                    </div>
                  </div>
                  
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
                    <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-tighter">
                      {t("dashboard.aiDisclaimer")}
                    </p>
                  </div>
                </div>
              ) : selectedInstrument ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground italic">{t("dashboard.aiInstrumentHint")}</p>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <BarChart3 size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground italic">{t("dashboard.aiSelectInstrumentHint")}</p>
                  {(!instrumentsData?.symbols || instrumentsData.symbols.length === 0) && (
                    <p className="text-[10px] text-muted-foreground/50 mt-2">{t("dashboard.aiConnectMT5Hint")}</p>
                  )}
                </div>
              )}
            </div>

            {!isPro && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                <Lock className="text-emerald-500 mb-3" size={24} />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-tighter mb-1">{t("dashboard.aiAnalystLocked")}</h4>
                <p className="text-[10px] text-muted-foreground mb-4">{t("dashboard.aiAnalystLockedDesc")}</p>
              </div>
            )}
          </div>

          <div className="bg-card border border-emerald-500/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap size={80} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-500" />
              {t("dashboard.performanceIntelligence")}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{t("dashboard.bestSession")}</span>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-emerald-500" />
                    <span className="text-xs font-bold text-foreground">{intelligence?.bestSession || "..."}</span>
                  </div>
                </div>
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{t("dashboard.bestDay")}</span>
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-emerald-500" />
                    <span className="text-xs font-bold text-foreground">{intelligence?.bestDay || "..."}</span>
                  </div>
                </div>
              </div>

              <div className="bg-background/50 p-3 rounded-xl border border-border">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{t("dashboard.profitFactor")}</span>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-emerald-500">{filteredStats.profitFactor}</span>
                  <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min((parseFloat(filteredStats.profitFactor) / 3) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{t("dashboard.totalTrades")}</span>
                  <span className="text-sm font-black text-foreground">{filteredStats.total}</span>
                </div>
                <div className="p-3 sm:text-right">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{t("dashboard.expectancy")}</span>
                  <span className={cn("text-sm font-black", filteredStats.expectancy >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    ${filteredStats.expectancy.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {!isPro && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                <Lock className="text-emerald-500 mb-3" size={24} />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-tighter mb-1">{t("dashboard.intelligenceLocked")}</h4>
                <p className="text-[10px] text-muted-foreground mb-4">{t("dashboard.intelligenceLockedDesc")}</p>
              </div>
            )}
          </div>

          {/* Strategy Compliance Card - Aggregated results only */}
          <div className="bg-card border border-emerald-500/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <CheckCircle2 size={80} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-500" />
              {t("dashboard.strategyCompliance")}
            </h3>
            
            {isComplianceLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <div className="animate-spin text-emerald-500"><RefreshCw size={24} /></div>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Loading...</p>
              </div>
            ) : complianceScore ? (
              <div className="space-y-4">
                {/* Active Strategy Name */}
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Active Strategy</span>
                  <span className="text-sm font-bold text-foreground truncate block" data-testid="text-active-strategy-name">
                    {complianceScore.strategyName}
                  </span>
                </div>

                {/* Compliance Score */}
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Compliance Score</span>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-2xl font-black",
                      complianceScore.compliancePercent >= 80 ? "text-emerald-500" :
                      complianceScore.compliancePercent >= 60 ? "text-amber-500" : "text-rose-500"
                    )} data-testid="text-compliance-score">
                      {complianceScore.compliancePercent.toFixed(1)}%
                    </span>
                    <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all",
                          complianceScore.compliancePercent >= 80 ? "bg-emerald-500" :
                          complianceScore.compliancePercent >= 60 ? "bg-amber-500" : "bg-rose-500"
                        )} 
                        style={{ width: `${complianceScore.compliancePercent}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Violations & Trend */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-background/50 p-3 rounded-xl border border-border">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Violations</span>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={12} className={complianceScore.violationsCount > 0 ? "text-rose-500" : "text-emerald-500"} />
                      <span className={cn(
                        "text-sm font-bold",
                        complianceScore.violationsCount > 0 ? "text-rose-500" : "text-emerald-500"
                      )} data-testid="text-violations-count">
                        {complianceScore.violationsCount}
                      </span>
                    </div>
                  </div>
                  <div className="bg-background/50 p-3 rounded-xl border border-border">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Trend</span>
                    <div className="flex items-center gap-2">
                      {complianceScore.trendDirection === 'improving' && (
                        <>
                          <ArrowUp size={12} className="text-emerald-500" />
                          <span className="text-sm font-bold text-emerald-500" data-testid="text-compliance-trend">{t("dashboard.improving")}</span>
                        </>
                      )}
                      {complianceScore.trendDirection === 'declining' && (
                        <>
                          <ArrowDown size={12} className="text-rose-500" />
                          <span className="text-sm font-bold text-rose-500" data-testid="text-compliance-trend">{t("dashboard.declining")}</span>
                        </>
                      )}
                      {complianceScore.trendDirection === 'stable' && (
                        <>
                          <Minus size={12} className="text-muted-foreground" />
                          <span className="text-sm font-bold text-muted-foreground" data-testid="text-compliance-trend">{t("dashboard.stable")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trades Evaluated */}
                <div className="text-center pt-2 border-t border-border">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                    {t("dashboard.basedOnLastTrades", { count: complianceScore.tradesEvaluated })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">{t("dashboard.noActiveStrategy")}</p>
                <Link to="/strategies">
                  <Button variant="ghost" className="text-[10px] font-bold uppercase text-emerald-500 hover:bg-transparent" data-testid="link-create-strategy">
                    {t("dashboard.createStrategy")}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Target size={80} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <Target size={18} className="text-emerald-500" />
              {t("dashboard.tradeStatistics")}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{t("dashboard.avgWin")}</span>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={12} className="text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-500">+${filteredStats.avgWin.toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{t("dashboard.avgLoss")}</span>
                  <div className="flex items-center gap-2">
                    <TrendingDown size={12} className="text-rose-500" />
                    <span className="text-xs font-bold text-rose-500">-${filteredStats.avgLoss.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{t("dashboard.bestTrade")}</span>
                  <span className="text-sm font-black text-emerald-500">+${filteredStats.bestTrade.toFixed(2)}</span>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{t("dashboard.worstTrade")}</span>
                  <span className="text-sm font-black text-rose-500">${filteredStats.worstTrade.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{t("dashboard.wins")}</span>
                  <span className="text-xs font-mono font-bold text-emerald-500">{filteredStats.wins}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{t("dashboard.losses")}</span>
                  <span className="text-xs font-mono font-bold text-rose-500">{filteredStats.losses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{t("dashboard.breakeven")}</span>
                  <span className="text-xs font-mono font-bold text-muted-foreground">{filteredStats.breakeven}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {dashConfig.widgets.sessionAnalytics !== false && userId && (
          <div className="mb-8">
            <SessionAnalytics 
              userId={userId} 
              dateFilter={dateFilter}
              startDate={dateFilter === "custom" ? customStartDate : undefined}
              endDate={dateFilter === "custom" ? customEndDate : undefined}
            />
          </div>
        )}

        {dashConfig.widgets.timePatterns !== false && userId && (
          <div className="mb-8">
            <TimePatterns 
              userId={userId}
              dateFilter={dateFilter}
              startDate={dateFilter === "custom" ? customStartDate : undefined}
              endDate={dateFilter === "custom" ? customEndDate : undefined}
            />
          </div>
        )}

        {dashConfig.widgets.behavioralRisks !== false && userId && (
          <div className="mb-8">
            <BehavioralRiskFlags userId={userId} />
          </div>
        )}

        {dashConfig.widgets.strategyDeviation !== false && userId && (
          <div className="mb-8">
            <StrategyDeviationAnalysis userId={userId} />
          </div>
        )}

        {dashConfig.widgets.psychologyReview !== false && userId && (
          <div className="mb-8">
            <PsychologyTradeReview userId={userId} />
          </div>
        )}

        {dashConfig.widgets.monthlyReview !== false && userId && (
          <div className="mb-8">
            <MonthlyReviewReport userId={userId} />
          </div>
        )}

        {dashConfig.widgets.achievements !== false && (
          <AchievementsWidget />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <Percent size={18} className="text-emerald-500" />
              {t("dashboard.openPositions")}
            </h3>
            <div className="space-y-4 overflow-y-auto max-h-[400px]">
              {mt5?.metrics?.positions && mt5.metrics.positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">{t("dashboard.colSymbol")}</th>
                        <th className="pb-2 font-medium">{t("dashboard.colType")}</th>
                        <th className="pb-2 font-medium text-right">{t("dashboard.colLots")}</th>
                        <th className="pb-2 font-medium text-right">{t("dashboard.colEntry")}</th>
                        <th className="pb-2 font-medium text-right font-bold text-foreground">{t("dashboard.colPL")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mt5.metrics.positions.map((pos: any) => (
                        <tr key={pos.ticket} className="group">
                          <td className="py-3 font-bold text-foreground">{pos.symbol}</td>
                          <td className="py-3">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                              pos.type === "Buy" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                            )}>
                              {pos.type}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono text-muted-foreground">{pos.volume}</td>
                          <td className="py-3 text-right font-mono text-muted-foreground">{parseFloat(pos.price).toFixed(5)}</td>
                          <td className={cn(
                            "py-3 text-right font-mono font-bold",
                            pos.profit >= 0 ? "text-emerald-500" : "text-rose-500"
                          )}>
                            ${parseFloat(pos.profit).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <Activity size={32} className="mb-2" />
                  <p className="text-xs">{t("dashboard.noOpenPositions")}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-6">{t("dashboard.accountHealth")}</h3>
            <div className="space-y-4">
              <div className="flex justify-between p-3 bg-background rounded-xl border border-border">
                <span className="text-xs text-muted-foreground">{t("dashboard.marginLevel")}</span>
                <span className={cn(
                  "text-sm font-mono font-bold",
                  parseFloat(mt5?.metrics?.marginLevel || "0") > 300 ? "text-emerald-500" :
                  parseFloat(mt5?.metrics?.marginLevel || "0") > 150 ? "text-amber-500" : "text-rose-500"
                )}>
                  {parseFloat(mt5?.metrics?.marginLevel || "0").toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between p-3 bg-background rounded-xl border border-border">
                <span className="text-xs text-muted-foreground">{t("dashboard.freeMarginPct")}</span>
                <span className="text-sm font-mono font-bold text-emerald-500">
                  {mt5?.metrics ? ((parseFloat(mt5.metrics.freeMargin) / parseFloat(mt5.metrics.equity)) * 100).toFixed(1) : "0"}%
                </span>
              </div>
              <div className="flex justify-between p-3 bg-background rounded-xl border border-border">
                <span className="text-xs text-muted-foreground">{t("dashboard.marginUsed")}</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  ${parseFloat(mt5?.metrics?.margin || "0").toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-6">{t("dashboard.recentEntries")}</h3>
            <div className="space-y-4">
              {recentTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t("dashboard.noTradesInPeriod")}
                </div>
              ) : (
                recentTrades.map((trade, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-background rounded-xl border border-border group hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] border",
                        trade.outcome === "Win" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                        trade.outcome === "Loss" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                        "bg-muted text-muted-foreground border-border"
                      )}>
                        {trade.symbol?.substring(0, 3) || "---"}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{trade.symbol || t("dashboard.unknown")}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                          {trade.source} • {format(new Date(trade.date), 'MMM d')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "text-xs font-mono font-bold",
                        trade.netPl >= 0 ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {trade.netPl >= 0 ? "+" : ""}{trade.netPl.toFixed(2)}
                      </div>
                      <div className={cn(
                        "text-[10px] font-mono font-bold px-2 py-1 rounded",
                        trade.outcome === "Win" ? "bg-emerald-500/10 text-emerald-500" : 
                        trade.outcome === "Loss" ? "bg-rose-500/10 text-rose-500" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {trade.outcome === "Win" ? t("dashboard.outcomeWin") : trade.outcome === "Loss" ? t("dashboard.outcomeLoss") : t("dashboard.outcomeBreakeven")}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <Link to="/journal">
                <Button variant="ghost" className="w-full text-[10px] font-bold uppercase text-muted-foreground hover:text-emerald-500">{t("dashboard.viewFullJournal")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
