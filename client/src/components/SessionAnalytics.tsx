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
  Legend
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
}

export function SessionAnalytics({ userId }: SessionAnalyticsProps) {
  const { isElite, canAccess } = usePlan();

  const { data, isLoading, error } = useQuery<SessionAnalyticsData>({
    queryKey: [`/api/session-analytics/${userId}`],
    enabled: !!userId && isElite,
    staleTime: 60000,
  });

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
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-1 rounded">
            {data.totalTrades} trades
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              P&L by Session
            </h4>
            <div className="h-48 bg-background rounded-lg border border-border p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlChartData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#888' }} width={80} />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                    {pnlChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Win Rate by Session
            </h4>
            <div className="h-48 bg-background rounded-lg border border-border p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={winRateChartData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#888' }} width={80} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Rate']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {winRateChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {data.sessions.map((session) => (
            <div 
              key={session.session}
              className={`p-3 rounded-lg border ${
                session.session === data.bestSession 
                  ? 'border-emerald-500/50 bg-emerald-500/5' 
                  : session.session === data.worstSession
                    ? 'border-red-500/50 bg-red-500/5'
                    : 'border-border bg-background'
              }`}
              data-testid={`session-card-${session.session}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span 
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: session.color }}
                >
                  {session.displayName}
                </span>
                {session.session === data.bestSession && (
                  <TrendingUp size={12} className="text-emerald-500" />
                )}
                {session.session === data.worstSession && (
                  <TrendingDown size={12} className="text-red-500" />
                )}
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground uppercase">Trades</span>
                  <span className="text-xs font-black text-foreground">{session.tradeCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground uppercase">Win Rate</span>
                  <span className={`text-xs font-black ${
                    session.winRate >= 50 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {session.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground uppercase">P&L</span>
                  <span className={`text-xs font-black ${
                    session.totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    ${session.totalPnL.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground uppercase">Avg P&L</span>
                  <span className={`text-xs font-black ${
                    session.avgPnL >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    ${session.avgPnL.toFixed(2)}
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
