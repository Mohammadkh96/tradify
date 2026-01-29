import { useTrades } from "@/hooks/use-trades";
import { usePlan } from "@/hooks/usePlan";
import { StatCard } from "@/components/StatCard";
import { SessionAnalytics } from "@/components/SessionAnalytics";
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
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Link } from "wouter";
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, startOfMonth, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Dashboard() {
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [selectedInstrument, setSelectedInstrument] = useState<string>("");
  
  const { data: trades, isLoading } = useTrades();
  const { data: user } = useQuery<any>({ 
    queryKey: ["/api/user"],
    staleTime: 0,
  });
  
  const userId = user?.userId;
  
  const { data: mt5, refetch: refetchStatus } = useQuery<any>({
    queryKey: [`/api/mt5/status/${userId}`],
    refetchInterval: 5000,
    enabled: !!userId,
    staleTime: 0,
  });

  const { data: intelligence } = useQuery<any>({
    queryKey: [`/api/performance/intelligence/${userId}`],
    staleTime: 0,
  });

  // Equity curve from cumulative trade P&L (SINGLE SOURCE OF TRUTH)
  const { data: equityCurveData } = useQuery<any[]>({
    queryKey: [`/api/equity-curve/${userId}`],
    staleTime: 0,
    enabled: !!userId,
  });

  const { isPaid: isPro, isElite, canAccess } = usePlan();

  const { data: insights, isLoading: isInsightsLoading } = useQuery<any>({
    queryKey: [`/api/ai/insights/${userId}`],
    enabled: !!userId && isPro,
  });

  // Fetch available instruments from MT5 history
  const { data: instrumentsData } = useQuery<{ symbols: string[] }>({
    queryKey: [`/api/instruments/${userId}`],
    enabled: !!userId,
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
  });

  const allTrades = trades || [];
  
  // Date filtering helper - define as a callback for useMemo to use
  const isWithinDateRange = (dateStr: string | Date | null) => {
    if (!dateStr) return true;
    if (dateFilter === "all") return true;
    
    const tradeDate = new Date(dateStr);
    const now = new Date();
    
    if (dateFilter === "today") {
      return isWithinInterval(tradeDate, { start: startOfDay(now), end: endOfDay(now) });
    } else if (dateFilter === "week") {
      return isWithinInterval(tradeDate, { start: startOfWeek(now), end: endOfDay(now) });
    } else if (dateFilter === "month") {
      return isWithinInterval(tradeDate, { start: startOfMonth(now), end: endOfDay(now) });
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      const start = startOfDay(parseISO(customStartDate));
      const end = endOfDay(parseISO(customEndDate));
      return isWithinInterval(tradeDate, { start, end });
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

  const stats = [
    { 
      label: "Balance", 
      value: mt5?.status === "CONNECTED" && mt5.metrics ? `$${parseFloat(mt5.metrics.balance).toLocaleString()}` : "$0", 
      icon: <Wallet size={18} />, 
      subtext: mt5?.status === "CONNECTED" ? "CONNECTED" : "OFFLINE",
      trend: mt5?.status === "CONNECTED" ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Equity", 
      value: mt5?.status === "CONNECTED" && mt5.metrics ? `$${parseFloat(mt5.metrics.equity).toLocaleString()}` : "$0", 
      icon: <Activity size={18} />, 
      subtext: mt5?.status === "CONNECTED" ? "CONNECTED" : "OFFLINE",
      trend: mt5?.status === "CONNECTED" ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Period P&L", 
      value: `$${filteredStats.totalPl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      icon: <DollarSign size={18} />, 
      subtext: dateFilter === "all" ? "ALL TIME" : dateFilter.toUpperCase(),
      trend: filteredStats.totalPl >= 0 ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Win Rate", 
      value: `${filteredStats.winRate}%`, 
      icon: <Percent size={18} />, 
      subtext: `${filteredStats.wins}W / ${filteredStats.losses}L`,
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
      .map(t => ({
        symbol: t.symbol,
        netPl: t.netPl,
        date: t.date,
        source: t.source,
        outcome: t.netPl > 0 ? "Win" : t.netPl < 0 ? "Loss" : "Break-even"
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
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <LayoutDashboard className="text-emerald-500" />
              Trader Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Market Overview & Performance Metrics</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
              {['all', 'today', 'week', 'month'].map((filter) => (
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
                  {filter === 'all' ? 'All Time' : filter}
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
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Custom Date Range</div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">From</label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="text-sm"
                          data-testid="dashboard-input-start-date"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">To</label>
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
                      Apply Filter
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full h-10 w-10 border-border bg-card hover:bg-accent text-muted-foreground"
              onClick={() => refetchStatus()}
            >
              <RefreshCw size={16} />
            </Button>
            {mt5?.status === "CONNECTED" ? (
              <div className="flex items-center gap-4 bg-card border border-border rounded-full px-5 py-2.5 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">MT5 Live Sync</span>
                </div>
                <div className="w-px h-5 bg-border" />
                <div className="text-[10px] text-muted-foreground font-mono font-bold uppercase">
                  ACTIVE
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-4 bg-card border border-border rounded-full px-5 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">Terminal Offline</span>
                  </div>
                  {mt5?.lastSync && (
                    <>
                      <div className="w-px h-5 bg-border" />
                      <div className="text-[10px] text-muted-foreground font-mono font-bold">
                        Last: {format(new Date(mt5.lastSync), 'MMM d, HH:mm')}
                      </div>
                    </>
                  )}
                </div>
                {mt5?.error && (
                  <span className="text-[9px] text-amber-500 font-bold uppercase tracking-tighter pr-4">
                    Status: {mt5.error}
                  </span>
                )}
                {!mt5?.lastSync && (
                  <Link href="/traders-hub">
                    <Button variant="ghost" className="text-[10px] text-emerald-500 h-auto p-0 font-bold uppercase hover:bg-transparent">Setup Bridge →</Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </header>

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Activity size={18} className="text-emerald-500" />
                  Equity Curve
                </h3>
                <p className="text-xs text-muted-foreground">Growth performance over time</p>
              </div>
            </div>
            <div className="h-[300px] w-full relative">
              {chartData.length < 2 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/20 backdrop-blur-[1px] rounded-xl border border-dashed border-border/50">
                  <Activity className="text-muted-foreground/30 mb-2 animate-pulse" size={32} />
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">Awaiting trade history</p>
                  <span className="text-[9px] text-muted-foreground/50 mt-1 italic">Curve populates from cumulative trade P&L</span>
                </div>
              )}
              {!isPro && chartData.length >= 30 && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
                  <Lock className="text-emerald-500 mb-2" size={24} />
                  <p className="text-sm font-bold text-foreground uppercase tracking-widest">30-Day Limit (FREE)</p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase font-bold">Upgrade to PRO for full history</p>
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
                AI Instrument Analysis
              </h3>
            </div>
            
            {/* Instrument Selector */}
            <div className="mb-4">
              <Select value={selectedInstrument} onValueChange={handleInstrumentSelect}>
                <SelectTrigger 
                  className="w-full bg-background/50 border-border"
                  data-testid="select-instrument"
                >
                  <SelectValue placeholder="Select an instrument to analyze..." />
                </SelectTrigger>
                <SelectContent>
                  {instrumentsData?.symbols && instrumentsData.symbols.length > 0 ? (
                    instrumentsData.symbols.map((symbol) => (
                      <SelectItem key={symbol} value={symbol} data-testid={`instrument-${symbol}`}>
                        {symbol}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No instruments found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4">
              {instrumentAnalysisMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <div className="animate-spin text-emerald-500"><RefreshCw size={24} /></div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Analyzing {selectedInstrument}...</p>
                </div>
              ) : instrumentAnalysis?.analysisText ? (
                <div className="space-y-4">
                  {/* Stats Grid */}
                  {instrumentAnalysis.tradeCount > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-background/50 p-2.5 rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Trades</span>
                        <span className="text-sm font-black text-foreground">{instrumentAnalysis.tradeCount}</span>
                      </div>
                      <div className="bg-background/50 p-2.5 rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Win Rate</span>
                        <span className="text-sm font-black text-emerald-500">{instrumentAnalysis.winRate}%</span>
                      </div>
                      <div className="bg-background/50 p-2.5 rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Avg P&L</span>
                        <span className={cn(
                          "text-sm font-black",
                          parseFloat(instrumentAnalysis.avgProfitLoss) >= 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          ${instrumentAnalysis.avgProfitLoss}
                        </span>
                      </div>
                      <div className="bg-background/50 p-2.5 rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Total P&L</span>
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
                      Performance review only. Not financial advice.
                    </p>
                  </div>
                </div>
              ) : selectedInstrument ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground italic">Select an instrument to see AI-powered analysis of your trading performance.</p>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <BarChart3 size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground italic">Select an instrument from your MT5 history to analyze your performance.</p>
                  {(!instrumentsData?.symbols || instrumentsData.symbols.length === 0) && (
                    <p className="text-[10px] text-muted-foreground/50 mt-2">Connect MT5 and sync trades to unlock this feature.</p>
                  )}
                </div>
              )}
            </div>

            {!isPro && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                <Lock className="text-emerald-500 mb-3" size={24} />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-tighter mb-1">AI Analyst Locked</h4>
                <p className="text-[10px] text-muted-foreground mb-4">Subscribe to PRO to unlock instrument analysis.</p>
              </div>
            )}
          </div>

          <div className="bg-card border border-emerald-500/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap size={80} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-500" />
              Performance Intelligence
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Best Session</span>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-emerald-500" />
                    <span className="text-xs font-bold text-foreground">{intelligence?.bestSession || "..."}</span>
                  </div>
                </div>
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Best Day</span>
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-emerald-500" />
                    <span className="text-xs font-bold text-foreground">{intelligence?.bestDay || "..."}</span>
                  </div>
                </div>
              </div>

              <div className="bg-background/50 p-3 rounded-xl border border-border">
                <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Profit Factor</span>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-emerald-500">{filteredStats.profitFactor}</span>
                  <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min((parseFloat(filteredStats.profitFactor) / 3) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Total Trades</span>
                  <span className="text-sm font-black text-foreground">{filteredStats.total}</span>
                </div>
                <div className="p-3 text-right">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Expectancy</span>
                  <span className={cn("text-sm font-black", filteredStats.expectancy >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    ${filteredStats.expectancy.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {!isPro && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                <Lock className="text-emerald-500 mb-3" size={24} />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-tighter mb-1">Intelligence Layer Locked</h4>
                <p className="text-[10px] text-muted-foreground mb-4">Subscribe to PRO to unlock advanced session and expectancy analytics.</p>
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
              Strategy Compliance
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
                <div className="grid grid-cols-2 gap-3">
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
                          <span className="text-sm font-bold text-emerald-500" data-testid="text-compliance-trend">Improving</span>
                        </>
                      )}
                      {complianceScore.trendDirection === 'declining' && (
                        <>
                          <ArrowDown size={12} className="text-rose-500" />
                          <span className="text-sm font-bold text-rose-500" data-testid="text-compliance-trend">Declining</span>
                        </>
                      )}
                      {complianceScore.trendDirection === 'stable' && (
                        <>
                          <Minus size={12} className="text-muted-foreground" />
                          <span className="text-sm font-bold text-muted-foreground" data-testid="text-compliance-trend">Stable</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trades Evaluated */}
                <div className="text-center pt-2 border-t border-border">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                    Based on last {complianceScore.tradesEvaluated} evaluated trades
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No active strategy found</p>
                <Link href="/strategies">
                  <Button variant="ghost" className="text-[10px] font-bold uppercase text-emerald-500 hover:bg-transparent" data-testid="link-create-strategy">
                    Create Strategy
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
              Trade Statistics
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Avg Win</span>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={12} className="text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-500">+${filteredStats.avgWin.toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-background/50 p-3 rounded-xl border border-border">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Avg Loss</span>
                  <div className="flex items-center gap-2">
                    <TrendingDown size={12} className="text-rose-500" />
                    <span className="text-xs font-bold text-rose-500">-${filteredStats.avgLoss.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Best Trade</span>
                  <span className="text-sm font-black text-emerald-500">+${filteredStats.bestTrade.toFixed(2)}</span>
                </div>
                <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Worst Trade</span>
                  <span className="text-sm font-black text-rose-500">${filteredStats.worstTrade.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Wins</span>
                  <span className="text-xs font-mono font-bold text-emerald-500">{filteredStats.wins}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Losses</span>
                  <span className="text-xs font-mono font-bold text-rose-500">{filteredStats.losses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Break-even</span>
                  <span className="text-xs font-mono font-bold text-muted-foreground">{filteredStats.breakeven}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Session Analytics - Elite Only */}
        {userId && (
          <div className="mb-8">
            <SessionAnalytics userId={userId} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <Percent size={18} className="text-emerald-500" />
              Open Positions
            </h3>
            <div className="space-y-4 overflow-y-auto max-h-[400px]">
              {mt5?.metrics?.positions && mt5.metrics.positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">Symbol</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium text-right">Lots</th>
                        <th className="pb-2 font-medium text-right">Entry</th>
                        <th className="pb-2 font-medium text-right font-bold text-foreground">P&L</th>
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
                  <p className="text-xs">No active open positions</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-6">Account Health</h3>
            <div className="space-y-4">
              <div className="flex justify-between p-3 bg-background rounded-xl border border-border">
                <span className="text-xs text-muted-foreground">Margin Level</span>
                <span className={cn(
                  "text-sm font-mono font-bold",
                  parseFloat(mt5?.metrics?.marginLevel || "0") > 300 ? "text-emerald-500" :
                  parseFloat(mt5?.metrics?.marginLevel || "0") > 150 ? "text-amber-500" : "text-rose-500"
                )}>
                  {parseFloat(mt5?.metrics?.marginLevel || "0").toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between p-3 bg-background rounded-xl border border-border">
                <span className="text-xs text-muted-foreground">Free Margin %</span>
                <span className="text-sm font-mono font-bold text-emerald-500">
                  {mt5?.metrics ? ((parseFloat(mt5.metrics.freeMargin) / parseFloat(mt5.metrics.equity)) * 100).toFixed(1) : "0"}%
                </span>
              </div>
              <div className="flex justify-between p-3 bg-background rounded-xl border border-border">
                <span className="text-xs text-muted-foreground">Margin Used</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  ${parseFloat(mt5?.metrics?.margin || "0").toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-6">Recent Entries</h3>
            <div className="space-y-4">
              {recentTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No trades in selected period
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
                        <div className="text-xs font-bold text-foreground">{trade.symbol || "Unknown"}</div>
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
                        {trade.outcome.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <Link href="/journal">
                <Button variant="ghost" className="w-full text-[10px] font-bold uppercase text-muted-foreground hover:text-emerald-500">View Full Journal →</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
