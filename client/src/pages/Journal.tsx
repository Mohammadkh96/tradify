import { useTrades, useDeleteTrade } from "@/hooks/use-trades";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Trash2, History as HistoryIcon, Plus, Calendar, Monitor, Brain, AlertTriangle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CsvImportDialog from "@/components/CsvImportDialog";
import { useSampleMode } from "@/hooks/useSampleMode";
import { getSampleTrades } from "@/lib/sampleData";
import { SampleDataBanner } from "@/components/SampleDataBanner";
import { useTranslation } from "react-i18next";

const MOOD_OPTIONS = [
  { value: "confident", labelKey: "journal.moodConfident", color: "text-emerald-500" },
  { value: "calm", labelKey: "journal.moodCalm", color: "text-blue-400" },
  { value: "neutral", labelKey: "journal.moodNeutral", color: "text-muted-foreground" },
  { value: "anxious", labelKey: "journal.moodAnxious", color: "text-amber-500" },
  { value: "fearful", labelKey: "journal.moodFearful", color: "text-orange-500" },
  { value: "greedy", labelKey: "journal.moodGreedy", color: "text-rose-500" },
  { value: "frustrated", labelKey: "journal.moodFrustrated", color: "text-red-400" },
  { value: "revenge", labelKey: "journal.moodRevenge", color: "text-red-600" },
];

const MISTAKE_OPTIONS = [
  { value: "none", labelKey: "journal.mistakeNone" },
  { value: "early_entry", labelKey: "journal.mistakeEarlyEntry" },
  { value: "late_entry", labelKey: "journal.mistakeLateEntry" },
  { value: "no_stop_loss", labelKey: "journal.mistakeNoStopLoss" },
  { value: "moved_stop_loss", labelKey: "journal.mistakeMovedStopLoss" },
  { value: "oversized", labelKey: "journal.mistakeOversized" },
  { value: "fomo", labelKey: "journal.mistakeFomo" },
  { value: "revenge_trade", labelKey: "journal.mistakeRevenge" },
  { value: "ignored_rules", labelKey: "journal.mistakeIgnoredRules" },
  { value: "poor_risk_reward", labelKey: "journal.mistakePoorRR" },
  { value: "early_exit", labelKey: "journal.mistakeEarlyExit" },
  { value: "overtrading", labelKey: "journal.mistakeOvertrading" },
];

type MT5Account = {
  id: number;
  accountNumber: string;
  accountName: string | null;
  broker: string | null;
  server: string | null;
  currency: string;
  isActive: boolean;
};

export default function Journal() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const userId = user?.userId;

  const { data: mt5Accounts } = useQuery<MT5Account[]>({
    queryKey: ['/api/mt5/accounts', userId],
    enabled: !!userId,
  });

  const { data: activeAccount } = useQuery<MT5Account | null>({
    queryKey: ['/api/mt5/accounts', userId, 'active'],
    enabled: !!userId,
  });

  const switchAccountMutation = useMutation({
    mutationFn: async (accountNumber: string) => {
      return apiRequest('POST', `/api/mt5/accounts/${userId}/switch`, { accountNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mt5/accounts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/mt5/history/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/mt5/status/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/equity-curve/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
      queryClient.invalidateQueries({ queryKey: [`/api/performance/intelligence/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/session-analytics/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/time-patterns/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/behavioral-risks/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/strategy-deviation/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/instruments/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ai/insights/${userId}`] });
    },
  });

  const { data: manualTrades, isLoading: isLoadingManual } = useTrades();
  const { data: mt5History } = useQuery<any[]>({
    queryKey: userId ? [`/api/mt5/history/${userId}`] : ["/api/mt5/history/demo"],
    enabled: true,
  });

  const sampleMode = useSampleMode();

  const subscription = user?.subscriptionTier?.toUpperCase() || "FREE";
  const isPaidUser = subscription === "PRO" || subscription === "ELITE";

  const deleteTrade = useDeleteTrade();

  const annotationMutation = useMutation({
    mutationFn: async ({ tradeId, mood, mistakeCategory, source }: { tradeId: number; mood?: string; mistakeCategory?: string; source: string }) => {
      return apiRequest('PATCH', `/api/trades/${tradeId}/annotations`, { mood, mistakeCategory, source: source === "MT5" ? "mt5" : "manual" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trades'] });
      if (userId) queryClient.invalidateQueries({ queryKey: [`/api/mt5/history/${userId}`] });
    },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const combinedTrades = useMemo(() => {
    // Sample mode: render the deterministic 60-day sample dataset so a brand
    // new user can explore Journal filters/stats without any real trades.
    if (sampleMode.active) {
      return getSampleTrades().map((t) => ({
        id: t.id,
        ticket: t.ticket,
        pair: t.symbol,
        direction: t.direction,
        timeframe: "Sample",
        createdAt: t.openTime,
        closeTime: t.closeTime,
        duration: t.duration,
        outcome: t.outcome,
        netPl: t.netPl,
        riskReward: "N/A",
        notes: t.notes || "",
        tags: [] as string[],
        source: "Sample",
        isMT5: false,
        volume: t.volume,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        commission: 0,
        swap: 0,
        sl: null,
        tp: null,
        mood: t.mood ?? null,
        mistakeCategory: t.mistakeCategory ?? null,
      }));
    }

    // Only show manual trades that are NOT MT5 sync duplicates
    const manual = (manualTrades || [])
      .filter(t => !t.notes?.startsWith("MT5_TICKET_"))
      .map(t => ({
        ...t,
        source: "Manual",
        netPl: typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0),
        closeTime: t.createdAt,
        mood: t.mood || null,
        mistakeCategory: t.mistakeCategory || t.mistake_category || null,
      }));
    
    const mt5 = (mt5History || []).map(t => {
      const pl = parseFloat(t.netPl);
      let outcome: string;
      if (pl > 0) outcome = "Win";
      else if (pl < 0) outcome = "Loss";
      else outcome = "Break-even";
      
      let duration = t.duration || 0;
      if (duration === 0 && t.openTime && t.closeTime) {
        const diffMs = new Date(t.closeTime).getTime() - new Date(t.openTime).getTime();
        if (diffMs > 0) duration = Math.floor(diffMs / 1000);
      }
      
      return {
        id: t.id,
        ticket: t.ticket,
        pair: t.symbol,
        direction: t.direction,
        timeframe: "MT5",
        createdAt: t.openTime,
        closeTime: t.closeTime,
        duration,
        outcome,
        netPl: pl,
        riskReward: "N/A",
        notes: t.notes || `Ticket: ${t.ticket}`,
        tags: t.tags || [],
        source: "MT5",
        isMT5: true,
        volume: t.volume,
        entryPrice: t.entryPrice || t.entry_price,
        exitPrice: t.exitPrice || t.exit_price,
        commission: t.commission ? parseFloat(t.commission) : 0,
        swap: t.swap ? parseFloat(t.swap) : 0,
        sl: t.sl,
        tp: t.tp,
        mood: t.mood || null,
        mistakeCategory: t.mistakeCategory || t.mistake_category || null,
      };
    });

    return [...manual, ...mt5].sort((a, b) => 
      new Date(b.closeTime!).getTime() - new Date(a.closeTime!).getTime()
    );
  }, [manualTrades, mt5History, sampleMode.active]);

  const filteredTrades = useMemo(() => {
    let base = combinedTrades.filter(trade => {
      const matchesSearch = trade.pair.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOutcome = filterOutcome === "all" || trade.outcome === filterOutcome;
      
      let matchesDate = true;
      if (dateFilter !== "all" && trade.closeTime) {
        const tradeDate = new Date(trade.closeTime);
        const now = new Date();
        const tradeDateUTC = tradeDate.toISOString().slice(0, 10);
        const nowUTC = now.toISOString().slice(0, 10);
        if (dateFilter === "today") {
          matchesDate = tradeDateUTC === nowUTC;
        } else if (dateFilter === "7days") {
          const cutoff = subDays(new Date(nowUTC + "T00:00:00Z"), 7);
          matchesDate = tradeDate >= cutoff && tradeDate <= now;
        } else if (dateFilter === "30days") {
          const cutoff = subDays(new Date(nowUTC + "T00:00:00Z"), 30);
          matchesDate = tradeDate >= cutoff && tradeDate <= now;
        } else if (dateFilter === "custom" && customStartDate && customEndDate) {
          const start = new Date(customStartDate + "T00:00:00Z");
          const end = new Date(customEndDate + "T23:59:59.999Z");
          matchesDate = tradeDate >= start && tradeDate <= end;
        }
      }
      return matchesSearch && matchesOutcome && matchesDate;
    });

    if (!isPaidUser) {
      const thirtyDaysAgo = subDays(new Date(), 30);
      base = base.filter(trade => new Date(trade.closeTime || trade.createdAt) >= thirtyDaysAgo);
    }

    return base;
  }, [combinedTrades, searchTerm, filterOutcome, dateFilter, customStartDate, customEndDate, isPaidUser]);

  const stats = useMemo(() => {
    const total = filteredTrades.length;
    const wins = filteredTrades.filter(t => t.outcome === "Win").length;
    const losses = filteredTrades.filter(t => t.outcome === "Loss").length;
    const breakeven = filteredTrades.filter(t => t.outcome === "Break-even").length;
    const netPl = filteredTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0);
    
    // Win rate excludes break-even trades (only count decisive trades)
    const decisiveTrades = wins + losses;
    const winRate = decisiveTrades > 0 ? (wins / decisiveTrades * 100).toFixed(1) : "0.0";
    
    // Average Win / Average Loss
    const winningTrades = filteredTrades.filter(t => t.outcome === "Win");
    const losingTrades = filteredTrades.filter(t => t.outcome === "Loss");
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0)) / losingTrades.length 
      : 0;
    
    // Expectancy = (Win Rate × Avg Win) − (Loss Rate × Avg Loss)
    const winRateDecimal = decisiveTrades > 0 ? wins / decisiveTrades : 0;
    const lossRateDecimal = decisiveTrades > 0 ? losses / decisiveTrades : 0;
    const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);
    
    // Profit Factor = Gross Profit / Gross Loss
    const grossProfit = winningTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0);
    const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";
    
    return { total, winRate, netPl, wins, losses, breakeven, profitFactor, avgWin, avgLoss, expectancy };
  }, [filteredTrades]);

  const statsDerivedLabel = t("journal.derivedFromHistory");
  
  const TRADES_PER_PAGE = 30;
  const [visibleCount, setVisibleCount] = useState(TRADES_PER_PAGE);
  
  useEffect(() => { setVisibleCount(TRADES_PER_PAGE); }, [searchTerm, filterOutcome, dateFilter, customStartDate, customEndDate]);
  
  const paginatedTrades = useMemo(() => filteredTrades.slice(0, visibleCount), [filteredTrades, visibleCount]);
  const hasMore = visibleCount < filteredTrades.length;

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        {sampleMode.active && (
          <SampleDataBanner surface={t("journal.surfaceJournal")} />
        )}
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <HistoryIcon className="text-emerald-500" />
                {t("journal.title")}
              </h1>
              <p className="text-muted-foreground mt-1">{t("journal.subtitle")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {mt5Accounts && mt5Accounts.length >= 1 && (
              <Select
                value={activeAccount?.accountNumber || mt5Accounts[0]?.accountNumber || ""}
                onValueChange={(value) => {
                  if (value) {
                    switchAccountMutation.mutate(value);
                  }
                }}
              >
                <SelectTrigger
                  className="w-[200px] text-xs border-border bg-card"
                  data-testid="journal-mt5-account-selector"
                >
                  <SelectValue placeholder={t("journal.selectMT5Account")}>
                    <span className="flex items-center gap-2">
                      <Monitor size={12} className="text-cyan-400" />
                      {activeAccount
                        ? (activeAccount.accountName || t("journal.accountLabel", { number: activeAccount.accountNumber }))
                        : mt5Accounts[0]
                          ? (mt5Accounts[0].accountName || t("journal.accountLabel", { number: mt5Accounts[0].accountNumber }))
                          : t("journal.selectAccount")}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {mt5Accounts.map((account) => (
                    <SelectItem
                      key={account.accountNumber}
                      value={account.accountNumber}
                      data-testid={`journal-mt5-option-${account.accountNumber}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {account.accountName || t("journal.accountLabel", { number: account.accountNumber })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          #{account.accountNumber} {account.broker ? `- ${account.broker}` : ""}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!isPaidUser && (
              <Link to="/pricing">
                <Button variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest h-10 px-4">
                  {t("journal.upgradeToPro")}
                </Button>
              </Link>
            )}
            <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
              {['all', 'today', '7days', '30days'].map((filter) => (
                <Button
                  key={filter}
                  variant={dateFilter === filter ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDateFilter(filter)}
                  className={cn(
                    "h-8 text-[10px] font-bold uppercase tracking-wider px-4 rounded-lg transition-all",
                    dateFilter === filter ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`filter-${filter}`}
                >
                  {filter === 'all' ? t("journal.filterAll") : filter === 'today' ? t("journal.filterToday") : filter === '7days' ? t("journal.filter7days") : filter === '30days' ? t("journal.filter30days") : filter}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateFilter === "custom" ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-8 text-[10px] font-bold uppercase tracking-wider px-4 rounded-lg transition-all",
                      dateFilter === "custom" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-muted-foreground hover:text-foreground"
                    )}
                    data-testid="filter-custom"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    {t("journal.custom")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("journal.customDateRange")}</div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{t("journal.from")}</label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="h-9 text-sm"
                          data-testid="input-start-date"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{t("journal.to")}</label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="h-9 text-sm"
                          data-testid="input-end-date"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => setDateFilter("custom")}
                      disabled={!customStartDate || !customEndDate}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold uppercase h-9"
                      data-testid="button-apply-custom-date"
                    >
                      {t("journal.applyFilter")}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <CsvImportDialog />
            <Link to="/strategies/validate">
              <Button 
                data-testid="button-log-trade"
                className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs uppercase transition-all shadow-lg shadow-emerald-500/20 px-6 h-10 rounded-xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("journal.logTrade")}
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">{t("journal.totalTrades")}</span>
            <div className="text-3xl font-black text-foreground">{stats.total}</div>
            <div className="text-[9px] text-muted-foreground/50 mt-2 font-bold uppercase tracking-tighter">{statsDerivedLabel}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">{t("journal.winRate")}</span>
            <div className="text-3xl font-black text-foreground">{stats.winRate}%</div>
            <div className="text-[9px] text-muted-foreground/50 mt-2 font-bold uppercase tracking-tighter">{statsDerivedLabel}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">{t("journal.netPL")}</span>
            <div className={cn("text-3xl font-black", stats.netPl >= 0 ? "text-emerald-500" : "text-rose-500")}>
              ${stats.netPl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[9px] text-muted-foreground/50 mt-2 font-bold uppercase tracking-tighter">{statsDerivedLabel}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">{t("journal.winsLosses")}</span>
            <div className="text-3xl font-black text-foreground">{stats.wins}W / {stats.losses}L</div>
            <div className="text-[9px] text-muted-foreground/50 mt-2 font-bold uppercase tracking-tighter">{statsDerivedLabel}</div>
          </div>
        </div>

        <div className="space-y-3">
          {paginatedTrades.map((trade: any) => (
            <div key={trade.id} className="bg-card border border-border rounded-xl p-5 hover:border-emerald-500/30 transition-colors group relative">
              {!sampleMode.active && (
                <button
                  onClick={() => deleteTrade.mutate(trade.id)}
                  className="absolute top-2 right-2 p-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white z-10"
                  data-testid={`button-delete-trade-${trade.id}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
              {sampleMode.active && (
                <span
                  className="absolute top-2 right-2 inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-500"
                  data-testid={`badge-sample-trade-${trade.id}`}
                >
                  {t("journal.sample")}
                </span>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs border shrink-0",
                    trade.outcome === "Win" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : trade.outcome === "Loss" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-muted text-muted-foreground border-border"
                  )}>
                    {trade.pair.substring(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-black text-foreground group-hover:text-emerald-400 transition-colors">{trade.pair}</span>
                      <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded border uppercase",
                        trade.direction === "Long" || trade.direction === "Buy" ? "text-emerald-500 border-emerald-500/20" : "text-rose-500 border-rose-500/20"
                      )}>
                        {trade.direction}
                      </span>
                      {trade.volume && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase">
                          {t("journal.lots", { count: trade.volume })}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase flex items-center gap-2 flex-wrap">
                      {trade.source === "MT5" ? <span className="text-sky-500 font-bold">{t("journal.mt5Synced")}</span> : <span className="text-muted-foreground">{t("journal.manual")}</span>}
                      {trade.ticket && <span className="text-muted-foreground/50 bg-muted/50 px-1 rounded">#{trade.ticket}</span>}
                    </div>
                    {trade.tags && trade.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {trade.tags.map((tag: string) => (
                          <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-background text-muted-foreground border border-border rounded uppercase font-bold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Select
                        value={trade.mood || ""}
                        disabled={sampleMode.active}
                        onValueChange={(val) => {
                          if (sampleMode.active) return;
                          annotationMutation.mutate({ tradeId: trade.id, mood: val, source: trade.source });
                        }}
                      >
                        <SelectTrigger className="h-6 w-auto min-w-[100px] text-[10px] border-border/50 bg-background/50 px-2 gap-1" data-testid={`select-mood-${trade.id}`}>
                          <Brain size={10} className="text-purple-400 shrink-0" />
                          <SelectValue placeholder={t("journal.mood")} />
                        </SelectTrigger>
                        <SelectContent>
                          {MOOD_OPTIONS.map(m => (
                            <SelectItem key={m.value} value={m.value}>
                              <span className={m.color}>{t(m.labelKey)}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={trade.mistakeCategory || ""}
                        disabled={sampleMode.active}
                        onValueChange={(val) => {
                          if (sampleMode.active) return;
                          annotationMutation.mutate({ tradeId: trade.id, mistakeCategory: val, source: trade.source });
                        }}
                      >
                        <SelectTrigger className="h-6 w-auto min-w-[110px] text-[10px] border-border/50 bg-background/50 px-2 gap-1" data-testid={`select-mistake-${trade.id}`}>
                          <AlertTriangle size={10} className="text-amber-400 shrink-0" />
                          <SelectValue placeholder={t("journal.mistake")} />
                        </SelectTrigger>
                        <SelectContent>
                          {MISTAKE_OPTIONS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{t(m.labelKey)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between md:justify-end gap-6 lg:gap-10 flex-wrap">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{t("journal.duration")}</div>
                    <div className="text-sm font-mono text-muted-foreground" data-testid={`text-duration-${trade.id}`}>
                      {trade.duration && trade.duration > 0 ? (
                        (() => {
                          const seconds = trade.duration;
                          const d = Math.floor(seconds / 86400);
                          const h = Math.floor((seconds % 86400) / 3600);
                          const m = Math.floor((seconds % 3600) / 60);
                          if (d > 0) return `${d}d ${h}h ${m}m ${seconds % 60}s`;
                          if (h > 0) return `${h}h ${m}m ${seconds % 60}s`;
                          if (m > 0) return `${m}m ${seconds % 60}s`;
                          return `${seconds}s`;
                        })()
                      ) : (
                        <span className="text-muted-foreground/50">{t("journal.instant")}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{t("journal.pnl")}</div>
                    <div className={cn(
                      "text-xl font-black font-mono",
                      parseFloat(trade.netPl) >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {trade.netPl !== 0 ? (trade.netPl > 0 ? `+$${parseFloat(trade.netPl).toFixed(2)}` : `-$${Math.abs(parseFloat(trade.netPl)).toFixed(2)}`) : "$0.00"}
                    </div>
                  </div>
                  <div className="text-right w-24">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{t("journal.status")}</div>
                    <div className={cn(
                      "text-sm font-bold px-3 py-1 rounded-full border",
                      trade.outcome === "Win" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : trade.outcome === "Loss" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-muted/50 text-muted-foreground border-border"
                    )}>
                      {trade.outcome === "Win" ? t("journal.outcomeWin") : trade.outcome === "Loss" ? t("journal.outcomeLoss") : t("journal.outcomeBreakeven")}
                    </div>
                  </div>
                </div>
              </div>

              {trade.isMT5 && (
                <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <div className="text-[9px] text-muted-foreground/70 uppercase font-bold">{t("journal.entry")}</div>
                    <div className="text-xs font-mono text-foreground">{trade.entryPrice || '--'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground/70 uppercase font-bold">{t("journal.exit")}</div>
                    <div className="text-xs font-mono text-foreground">{trade.exitPrice || '--'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground/70 uppercase font-bold">{t("journal.opened")}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {trade.createdAt ? format(new Date(trade.createdAt), 'MMM dd, HH:mm:ss') : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground/70 uppercase font-bold">{t("journal.closed")}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {trade.closeTime ? format(new Date(trade.closeTime), 'MMM dd, HH:mm:ss') : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground/70 uppercase font-bold">{t("journal.commission")}</div>
                    <div className="text-xs font-mono text-muted-foreground">${(trade.commission || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground/70 uppercase font-bold">{t("journal.swap")}</div>
                    <div className="text-xs font-mono text-muted-foreground">${(trade.swap || 0).toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {paginatedTrades.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-muted-foreground bg-card border border-border rounded-2xl border-dashed">
              <HistoryIcon size={48} className="mb-4 opacity-20" />
              <p>{t("journal.noTradesFound")}</p>
            </div>
          )}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 pt-4">
              <p className="text-xs text-muted-foreground" data-testid="text-trade-count">
                {t("journal.showingOf", { shown: paginatedTrades.length, total: filteredTrades.length })}
              </p>
              <Button
                variant="outline"
                onClick={() => setVisibleCount(prev => prev + TRADES_PER_PAGE)}
                className="px-8"
                data-testid="button-load-more"
              >
                {t("journal.loadMore")}
              </Button>
            </div>
          )}
          {!hasMore && filteredTrades.length > TRADES_PER_PAGE && (
            <p className="text-center text-xs text-muted-foreground pt-4">
              {t("journal.allTradesLoaded", { total: filteredTrades.length })}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
