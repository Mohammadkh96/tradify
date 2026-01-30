import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Calendar, 
  Clock,
  TrendingUp, 
  TrendingDown, 
  Crown,
  BarChart3,
  Hash
} from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell,
  CartesianGrid,
  ReferenceLine
} from "recharts";

interface DayMetric {
  day: number;
  dayName: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  avgPnl: number;
}

interface HourMetric {
  hour: number;
  hourLabel: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  avgPnl: number;
}

interface TimePatternsData {
  byDayOfWeek: DayMetric[];
  byHourOfDay: HourMetric[];
  totalTrades: number;
  bestDay: string | null;
  worstDay: string | null;
  bestHour: string | null;
  worstHour: string | null;
}

interface TimePatternsProps {
  userId: string;
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
}

export function TimePatterns({ userId, dateFilter, startDate, endDate }: TimePatternsProps) {
  const { isElite } = usePlan();

  // Build query string for date filtering
  const queryParams = new URLSearchParams();
  if (dateFilter && dateFilter !== "all") queryParams.set("dateFilter", dateFilter);
  if (dateFilter === "custom" && startDate) queryParams.set("startDate", startDate);
  if (dateFilter === "custom" && endDate) queryParams.set("endDate", endDate);
  const queryString = queryParams.toString();
  const apiUrl = `/api/time-patterns/${userId}${queryString ? `?${queryString}` : ""}`;

  // Use separate query key segments to ensure proper cache invalidation
  const { data, isLoading, error } = useQuery<TimePatternsData>({
    queryKey: ["/api/time-patterns", userId, dateFilter || "all", startDate || "", endDate || ""],
    queryFn: async () => {
      const res = await fetch(apiUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch time patterns");
      return res.json();
    },
    enabled: !!userId && isElite,
    staleTime: 30000, // Reduce stale time to 30 seconds
  });

  // Helper to get date range label
  const getDateRangeLabel = () => {
    if (!dateFilter || dateFilter === "all") return "All Time";
    if (dateFilter === "today") return "Today";
    if (dateFilter === "week") return "This Week";
    if (dateFilter === "month") return "This Month";
    if (dateFilter === "custom" && startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
    }
    return "All Time";
  };

  if (!isElite) {
    return (
      <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="card-time-patterns">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Calendar size={20} className="text-cyan-500" />
              </div>
              <div>
                <CardTitle className="text-foreground uppercase italic tracking-tight font-black flex items-center gap-2">
                  Time Patterns
                  <Crown size={14} className="text-amber-500" />
                </CardTitle>
                <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">
                  Elite Feature
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Crown size={32} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight mb-2">
              Unlock Time Patterns
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Discover your best trading days and hours. Identify patterns in your performance over time.
            </p>
            <Link href="/pricing">
              <Button className="bg-amber-500 text-slate-950 border-amber-500/50 font-black uppercase tracking-widest text-[10px]">
                Upgrade to Elite
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="card-time-patterns">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg animate-pulse">
              <Calendar size={20} className="text-cyan-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black">
                Time Patterns
              </CardTitle>
              <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">
                Loading time data...
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-muted/50 rounded-lg" />
            <div className="h-32 bg-muted/50 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="card-time-patterns">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Calendar size={20} className="text-cyan-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black">
                Time Patterns
              </CardTitle>
              <CardDescription className="text-destructive uppercase text-[10px] font-black tracking-widest">
                Failed to load time patterns
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (data.totalTrades === 0) {
    return (
      <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="card-time-patterns">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Calendar size={20} className="text-cyan-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black">
                Time Patterns
              </CardTitle>
              <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">
                No trade data available
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <Clock size={48} className="mx-auto mb-4 opacity-30" />
            <p>Start trading to see time-based performance patterns</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { byDayOfWeek, byHourOfDay, bestDay, worstDay, bestHour, worstHour } = data;

  const dayColors = {
    positive: "#10b981",
    negative: "#ef4444",
    neutral: "#6b7280"
  };

  const getBarColor = (pnl: number) => {
    if (pnl > 0) return dayColors.positive;
    if (pnl < 0) return dayColors.negative;
    return dayColors.neutral;
  };

  const getHeatmapColor = (trades: number, maxTrades: number, pnl: number) => {
    if (trades === 0) return "bg-muted/20";
    const intensity = Math.min(trades / maxTrades, 1);
    if (pnl > 0) return intensity > 0.5 ? "bg-emerald-500/80" : "bg-emerald-500/40";
    if (pnl < 0) return intensity > 0.5 ? "bg-red-500/80" : "bg-red-500/40";
    return "bg-muted/50";
  };

  const maxHourTrades = Math.max(...byHourOfDay.map(h => h.trades), 1);

  const tradingDays = byDayOfWeek.filter(d => d.trades > 0);
  const shortDayNames = tradingDays.map(d => ({
    ...d,
    shortName: d.dayName.slice(0, 3)
  }));

  return (
    <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="card-time-patterns">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Calendar size={20} className="text-cyan-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black">
                Time Patterns
              </CardTitle>
              <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">
                Performance by Day & Hour (UTC)
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span 
              className="text-[10px] font-black text-cyan-500 uppercase tracking-widest bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20"
              data-testid="time-patterns-date-range"
            >
              {getDateRangeLabel()}
            </span>
            {bestDay && (
              <div className="flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-500" />
                <span className="text-muted-foreground">Best Day:</span>
                <span className="text-emerald-500 font-black">{bestDay}</span>
              </div>
            )}
            {bestHour && (
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-500" />
                <span className="text-muted-foreground">Best Hour:</span>
                <span className="text-emerald-500 font-black">{bestHour}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-foreground uppercase tracking-tight">
              <BarChart3 size={16} className="text-cyan-500" />
              P&L by Day of Week
            </div>
            <div className="h-56 bg-gradient-to-br from-background to-muted/20 rounded-xl border border-border/50 p-4 shadow-inner">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shortDayNames} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="dayProfitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="dayLossGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.15} vertical={false} />
                  <XAxis 
                    dataKey="shortName" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
                    axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.3 }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} strokeDasharray="3 3" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.4)',
                      padding: '10px 14px'
                    }}
                    labelStyle={{ fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name: string) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'P&L']}
                    labelFormatter={(label) => {
                      const day = shortDayNames.find(d => d.shortName === label);
                      return day ? `${day.dayName} (${day.trades} trades)` : label;
                    }}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  />
                  <Bar dataKey="pnl" radius={[6, 6, 0, 0]} maxBarSize={45}>
                    {shortDayNames.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? 'url(#dayProfitGradient)' : 'url(#dayLossGradient)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-foreground uppercase tracking-tight">
              <Hash size={16} className="text-cyan-500" />
              Win Rate by Day
            </div>
            <div className="h-56 bg-gradient-to-br from-background to-muted/20 rounded-xl border border-border/50 p-4 shadow-inner">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shortDayNames} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="winRateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#0891b2" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.15} vertical={false} />
                  <XAxis 
                    dataKey="shortName" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
                    axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.3 }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ReferenceLine y={50} stroke="#f59e0b" strokeOpacity={0.5} strokeDasharray="5 5" label={{ value: '50%', position: 'right', fontSize: 9, fill: '#f59e0b' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.4)',
                      padding: '10px 14px'
                    }}
                    labelStyle={{ fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Rate']}
                    labelFormatter={(label) => {
                      const day = shortDayNames.find(d => d.shortName === label);
                      return day ? `${day.dayName} (${day.wins}W / ${day.losses}L)` : label;
                    }}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  />
                  <Bar dataKey="winRate" fill="url(#winRateGradient)" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-black text-foreground uppercase tracking-tight">
            <Clock size={16} className="text-cyan-500" />
            Hourly Performance Heatmap (UTC)
          </div>
          <div className="bg-gradient-to-br from-background to-muted/20 rounded-xl border border-border/50 p-4 shadow-inner">
            <div className="grid grid-cols-12 gap-1.5">
              {byHourOfDay.map((hourData) => {
                const colorClass = getHeatmapColor(hourData.trades, maxHourTrades, hourData.pnl);
                const intensity = hourData.trades > 0 ? Math.min(hourData.trades / maxHourTrades, 1) : 0;
                return (
                  <div
                    key={hourData.hour}
                    className={`relative group ${colorClass} rounded-lg p-2.5 text-center transition-all duration-200 cursor-pointer hover:scale-105 hover:shadow-lg hover:z-10`}
                    data-testid={`heatmap-hour-${hourData.hour}`}
                    style={{ 
                      boxShadow: intensity > 0.5 ? `0 0 12px ${hourData.pnl >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` : 'none'
                    }}
                  >
                    <div className="text-[11px] font-black text-foreground/90">
                      {String(hourData.hour).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] text-muted-foreground font-semibold">
                      {hourData.trades > 0 ? hourData.trades : '-'}
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-50 pointer-events-none">
                      <div className="bg-popover border border-border rounded-xl shadow-2xl p-4 text-xs whitespace-nowrap backdrop-blur-sm">
                        <div className="font-black text-foreground mb-2 text-sm border-b border-border pb-2">{hourData.hourLabel} UTC</div>
                        <div className="space-y-1.5 text-muted-foreground">
                          <div className="flex justify-between gap-4">
                            <span>Trades:</span>
                            <span className="text-foreground font-bold">{hourData.trades}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>P&L:</span>
                            <span className={`font-bold ${hourData.pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                              ${hourData.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Win Rate:</span>
                            <span className="text-foreground font-bold">{hourData.winRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Avg P&L:</span>
                            <span className={`font-bold ${hourData.avgPnl >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                              ${hourData.avgPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border/30">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-md bg-muted/20 border border-border/30" />
                <span className="font-medium">No trades</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-md bg-gradient-to-br from-emerald-400/60 to-emerald-600/60" />
                <span className="font-medium">Profitable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-md bg-gradient-to-br from-red-400/60 to-red-600/60" />
                <span className="font-medium">Loss</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {bestDay && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-emerald-500 mb-1">
                <TrendingUp size={14} />
                <span className="text-[10px] uppercase tracking-widest font-black">Best Day</span>
              </div>
              <div className="text-lg font-black text-foreground">{bestDay}</div>
            </div>
          )}
          {worstDay && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <TrendingDown size={14} />
                <span className="text-[10px] uppercase tracking-widest font-black">Worst Day</span>
              </div>
              <div className="text-lg font-black text-foreground">{worstDay}</div>
            </div>
          )}
          {bestHour && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-emerald-500 mb-1">
                <Clock size={14} />
                <span className="text-[10px] uppercase tracking-widest font-black">Best Hour</span>
              </div>
              <div className="text-lg font-black text-foreground">{bestHour} UTC</div>
            </div>
          )}
          {worstHour && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <Clock size={14} />
                <span className="text-[10px] uppercase tracking-widest font-black">Worst Hour</span>
              </div>
              <div className="text-lg font-black text-foreground">{worstHour} UTC</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
