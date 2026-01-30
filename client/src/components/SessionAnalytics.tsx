import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Crown,
  AlertTriangle,
  Percent,
  DollarSign,
  BarChart3
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  CartesianGrid,
  ReferenceLine
} from "recharts";

interface SessionMetric {
  session: string;
  displayName: string;
  color: string;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  breakEvenCount: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  avgRisk: number;
  totalVolume: number;
}

interface SessionAnalyticsData {
  sessions: SessionMetric[];
  totalTrades: number;
  bestSession: string | null;
  worstSession: string | null;
}

interface SessionAnalyticsProps {
  userId: string;
  dateFilter?: string;
  startDate?: string;
  endDate?: string;
}

export function SessionAnalytics({ userId, dateFilter, startDate, endDate }: SessionAnalyticsProps) {
  const { isElite, canAccess } = usePlan();

  // Build query string for date filtering
  const queryParams = new URLSearchParams();
  if (dateFilter && dateFilter !== "all") queryParams.set("dateFilter", dateFilter);
  if (dateFilter === "custom" && startDate) queryParams.set("startDate", startDate);
  if (dateFilter === "custom" && endDate) queryParams.set("endDate", endDate);
  const queryString = queryParams.toString();
  const apiUrl = `/api/session-analytics/${userId}${queryString ? `?${queryString}` : ""}`;

  // Use separate query key segments to ensure proper cache invalidation
  const { data, isLoading, error } = useQuery<SessionAnalyticsData>({
    queryKey: ["/api/session-analytics", userId, dateFilter || "all", startDate || "", endDate || ""],
    queryFn: async () => {
      const res = await fetch(apiUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch session analytics");
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
      <Card className="bg-card border-border shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock size={20} className="text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-foreground uppercase italic tracking-tight font-black flex items-center gap-2">
                  Session Analytics
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
              Unlock Session Analytics
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Analyze your trading performance by market session. Discover which sessions work best for your strategy.
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
      <Card className="bg-card border-border shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg animate-pulse">
              <Clock size={20} className="text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black">
                Session Analytics
              </CardTitle>
              <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">
                Loading session data...
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-muted/50 rounded-lg" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-20 bg-muted/50 rounded-lg" />
              <div className="h-20 bg-muted/50 rounded-lg" />
              <div className="h-20 bg-muted/50 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-card border-border shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock size={20} className="text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black">
                Session Analytics
              </CardTitle>
              <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">
                Performance by market session
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle size={32} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Unable to load session data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.sessions.length === 0) {
    return (
      <Card className="bg-card border-border shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock size={20} className="text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black">
                Session Analytics
              </CardTitle>
              <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">
                Performance by market session
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <BarChart3 size={32} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">
              No trade data available yet. Start trading to see session analytics.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const bestSessionData = data.sessions.find(s => s.session === data.bestSession);
  const worstSessionData = data.sessions.find(s => s.session === data.worstSession);

  const pnlChartData = data.sessions.map(s => ({
    name: s.displayName,
    pnl: s.totalPnL,
    color: s.color,
  }));

  const winRateChartData = data.sessions.map(s => ({
    name: s.displayName,
    winRate: s.winRate,
    color: s.color,
  }));

  const radarData = data.sessions.map(s => ({
    session: s.displayName,
    winRate: s.winRate,
    trades: (s.tradeCount / data.totalTrades) * 100,
    pnl: s.totalPnL > 0 ? Math.min(s.totalPnL, 100) : 0,
  }));

  return (
    <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="card-session-analytics">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock size={20} className="text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black flex items-center gap-2">
                Session Analytics
                <Crown size={14} className="text-amber-500" />
              </CardTitle>
              <CardDescription className="text-muted-foreground uppercase text-[10px] font-black tracking-widest opacity-70">
                Performance by market session (UTC)
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span 
              className="text-[10px] font-black text-cyan-500 uppercase tracking-widest bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20"
              data-testid="session-analytics-date-range"
            >
              {getDateRangeLabel()}
            </span>
            <span 
              className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-1 rounded"
              data-testid="session-analytics-trade-count"
            >
              {data.totalTrades} trades
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-amber-500" />
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                P&L by Session
              </h4>
            </div>
            <div className="h-56 bg-gradient-to-br from-background to-muted/20 rounded-xl border border-border/50 p-4 shadow-inner">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={1}/>
                    </linearGradient>
                    <linearGradient id="lossGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} horizontal={false} />
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.3 }}
                    tickLine={false}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} 
                    width={90}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} strokeDasharray="3 3" />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'P&L']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.4)',
                      padding: '10px 14px'
                    }}
                    labelStyle={{ fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  />
                  <Bar dataKey="pnl" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {pnlChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.pnl >= 0 ? 'url(#profitGradient)' : 'url(#lossGradient)'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Percent size={14} className="text-amber-500" />
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Win Rate by Session
              </h4>
            </div>
            <div className="h-56 bg-gradient-to-br from-background to-muted/20 rounded-xl border border-border/50 p-4 shadow-inner">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={winRateChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="winRateAsian" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#d97706" stopOpacity={0.7}/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={1}/>
                    </linearGradient>
                    <linearGradient id="winRateLondon" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.7}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={1}/>
                    </linearGradient>
                    <linearGradient id="winRateOverlap" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.7}/>
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={1}/>
                    </linearGradient>
                    <linearGradient id="winRateNY" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.7}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={1}/>
                    </linearGradient>
                    <linearGradient id="winRateOff" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#4b5563" stopOpacity={0.7}/>
                      <stop offset="100%" stopColor="#6b7280" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} horizontal={false} />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.3 }}
                    tickLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }} 
                    width={90}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine x={50} stroke="#f59e0b" strokeOpacity={0.5} strokeDasharray="5 5" label={{ value: '50%', position: 'top', fontSize: 9, fill: '#f59e0b' }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Rate']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.4)',
                      padding: '10px 14px'
                    }}
                    labelStyle={{ fontWeight: 700, marginBottom: '4px', color: 'hsl(var(--foreground))' }}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  />
                  <Bar dataKey="winRate" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {winRateChartData.map((entry, index) => {
                      const gradientMap: Record<string, string> = {
                        'Asian': 'url(#winRateAsian)',
                        'London': 'url(#winRateLondon)',
                        'London/NY Overlap': 'url(#winRateOverlap)',
                        'New York': 'url(#winRateNY)',
                        'Off Hours': 'url(#winRateOff)'
                      };
                      return (
                        <Cell key={`cell-${index}`} fill={gradientMap[entry.name] || entry.color} />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {data.sessions.map((session) => (
            <div 
              key={session.session}
              className={`relative p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] ${
                session.session === data.bestSession 
                  ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 shadow-lg shadow-emerald-500/10' 
                  : session.session === data.worstSession
                    ? 'border-red-500/50 bg-gradient-to-br from-red-500/10 to-red-500/5 shadow-lg shadow-red-500/10'
                    : 'border-border/50 bg-gradient-to-br from-background to-muted/20 hover:border-border'
              }`}
              data-testid={`session-card-${session.session}`}
            >
              {session.session === data.bestSession && (
                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg">
                  Best
                </div>
              )}
              {session.session === data.worstSession && session.session !== data.bestSession && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg">
                  Needs Work
                </div>
              )}
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: session.color }}
                  />
                  <span 
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: session.color }}
                  >
                    {session.displayName}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground uppercase font-medium">Trades</span>
                  <span className="text-sm font-black text-foreground">{session.tradeCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground uppercase font-medium">Win Rate</span>
                  <span className={`text-sm font-black ${
                    session.winRate >= 50 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {session.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-[9px] text-muted-foreground uppercase font-medium">P&L</span>
                  <span className={`text-sm font-black ${
                    session.totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    ${session.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground uppercase font-medium">Avg P&L</span>
                  <span className={`text-xs font-bold ${
                    session.avgPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    ${session.avgPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {(bestSessionData || worstSessionData) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
            {bestSessionData && (
              <div className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <TrendingUp size={16} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Best Session</p>
                  <p className="text-sm font-black text-emerald-500 uppercase">{bestSessionData.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {bestSessionData.winRate.toFixed(1)}% win rate • ${bestSessionData.totalPnL.toFixed(2)} total
                  </p>
                </div>
              </div>
            )}
            {worstSessionData && worstSessionData.session !== bestSessionData?.session && (
              <div className="flex items-center gap-3 p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <TrendingDown size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Needs Work</p>
                  <p className="text-sm font-black text-red-500 uppercase">{worstSessionData.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {worstSessionData.winRate.toFixed(1)}% win rate • ${worstSessionData.totalPnL.toFixed(2)} total
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">
            Session Times (UTC)
          </h4>
          <div className="flex flex-wrap gap-2">
            <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
              Asian: 00:00 - 07:00
            </span>
            <span className="text-[9px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded">
              London: 07:00 - 12:00
            </span>
            <span className="text-[9px] font-bold text-purple-500 bg-purple-500/10 px-2 py-1 rounded">
              Overlap: 12:00 - 16:00
            </span>
            <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
              New York: 16:00 - 21:00
            </span>
            <span className="text-[9px] font-bold text-gray-500 bg-gray-500/10 px-2 py-1 rounded">
              Off Hours: 21:00 - 00:00
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
