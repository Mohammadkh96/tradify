import { useTrades } from "@/hooks/use-trades";
import { StatCard } from "@/components/StatCard";
import { TradingChart } from "@/components/TradingChart";
import { 
  TrendingUp, 
  Activity, 
  DollarSign,
  ArrowRight,
  Wallet,
  Target,
  BarChart3,
  Percent,
  History as HistoryIcon,
  LayoutDashboard,
  Lock,
  Zap,
  Calendar,
  Clock,
  ShieldCheck,
  ZapOff,
  RefreshCw,
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Link } from "wouter";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: trades, isLoading } = useTrades();
  const { data: user } = useQuery<any>({ 
    queryKey: ["/api/user"],
    staleTime: 0,
  });
  
  const userId = user?.id; // Fixed: user schema now uses 'id' not 'userId'
  
  const { data: mt5, refetch: refetchStatus } = useQuery<any>({
    queryKey: [`/api/mt5/status/${userId}`],
    refetchInterval: 5000,
    enabled: !!userId,
    staleTime: 0,
  });

  const { data: intelligence } = useQuery<any>({
    queryKey: [`/api/performance/intelligence/${userId}`],
    enabled: !!userId,
    staleTime: 0,
  });

  const { data: snapshots } = useQuery<any[]>({
    queryKey: [`/api/mt5/snapshots/${userId}`],
    enabled: !!userId,
    staleTime: 0,
  });

  // Fixed: subscription info now comes from user object or separate subscription query
  const subscription = user?.subscriptionTier || "FREE";
  const isPro = subscription === "PRO";

  const { data: insights, isLoading: isInsightsLoading } = useQuery<any>({
    queryKey: [`/api/ai/insights/${userId}`],
    enabled: !!userId && isPro,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin text-primary"><Activity size={32} /></div>
      </div>
    );
  }

  const allTrades = trades || [];
  const wins = allTrades.filter(t => Number(t.profit) > 0).length;
  const losses = allTrades.filter(t => Number(t.profit) < 0).length;
  const total = allTrades.length;
  
  const winRate = total >= 5 ? ((wins / total) * 100).toFixed(1) : "N/A";
  
  const chartData = snapshots?.map(s => ({
    date: format(new Date(s.date), 'MMM d'),
    equity: parseFloat(s.equity),
    balance: parseFloat(s.balance)
  })) || [];

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
      label: "Total P&L", 
      value: intelligence?.totalPl ? `$${parseFloat(intelligence.totalPl).toLocaleString()}` : "$0", 
      icon: <DollarSign size={18} />, 
      subtext: "GROSS NET",
      trend: parseFloat(intelligence?.totalPl || "0") >= 0 ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Profit Factor", 
      value: intelligence?.profitFactor || "0.00", 
      icon: <Percent size={18} />, 
      subtext: "RELIABILITY",
      trend: parseFloat(intelligence?.profitFactor || "0") >= 1.5 ? "up" : "down" as "up" | "down"
    },
  ];

  const recentTrades = [...allTrades].sort((a, b) => 
    new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
  ).slice(0, 5);

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <LayoutDashboard className="text-primary" />
              Trader Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground text-sm">Market Overview & Performance Metrics</p>
              <Link href="/risk" className="text-[10px] text-muted-foreground hover:text-primary uppercase font-bold tracking-widest transition-colors">Risk Disclaimer</Link>
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
                  <div className="w-2.5 h-2.5 rounded-full bg-bullish animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black text-bullish uppercase tracking-[0.2em]">MT5 Live Sync</span>
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
                    <div className="w-2.5 h-2.5 rounded-full bg-bearish" />
                    <span className="text-[10px] font-black text-bearish uppercase tracking-[0.2em]">Terminal Offline</span>
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

        <div className="mb-8">
          <TradingChart symbol="BTC/USD" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Activity size={18} className="text-primary" />
                  Equity Curve
                </h3>
                <p className="text-xs text-muted-foreground">Growth performance over time</p>
              </div>
            </div>
            <div className="h-[300px] w-full relative">
              {chartData.length < 2 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/20 backdrop-blur-[1px] rounded-xl border border-dashed border-border/50">
                  <Activity className="text-muted-foreground/30 mb-2 animate-pulse" size={32} />
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">Awaiting historical equity snapshots</p>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="date" stroke="currentColor" className="text-muted-foreground" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis 
                    stroke="currentColor" 
                    className="text-muted-foreground"
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => `$${v/1000}k`}
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
                    name="Equity"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-primary/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap size={80} className="text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              AI Performance Insights
            </h3>
            
            <div className="space-y-4">
              {isInsightsLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <div className="animate-spin text-primary"><RefreshCw size={24} /></div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Generating Analyst Report...</p>
                </div>
              ) : insights?.insightText ? (
                <div className="space-y-4">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="text-xs text-foreground leading-relaxed whitespace-pre-line border-l-2 border-primary/30 pl-4 py-1">
                      {insights.insightText}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-xs text-muted-foreground italic">No insights available yet. Insights appear after 5+ recorded trades.</p>
                </div>
              )}
            </div>

            {!isPro && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                <Lock className="text-primary mb-3" size={24} />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-tighter mb-1">AI Analyst Locked</h4>
                <p className="text-[10px] text-muted-foreground mb-4">Upgrade to PRO to unlock contextual AI performance insights.</p>
                <Link href="/pricing">
                  <Button className="bg-primary text-primary-foreground font-black text-[10px] uppercase h-8 px-4">Unlock AI Insights</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <Percent size={18} className="text-primary" />
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
                              pos.type === "Buy" ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
                            )}>
                              {pos.type}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono text-muted-foreground">{pos.volume}</td>
                          <td className={cn(
                            "py-3 text-right font-mono font-bold",
                            pos.profit >= 0 ? "text-bullish" : "text-bearish"
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
                  parseFloat(mt5?.metrics?.marginLevel || "0") > 300 ? "text-bullish" :
                  parseFloat(mt5?.metrics?.marginLevel || "0") > 150 ? "text-amber-500" : "text-bearish"
                )}>
                  {parseFloat(mt5?.metrics?.marginLevel || "0").toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between p-3 bg-background rounded-xl border border-border">
                <span className="text-xs text-muted-foreground">Free Margin</span>
                <span className="text-sm font-mono font-bold text-primary">
                  ${mt5?.metrics ? parseFloat(mt5.metrics.freeMargin).toLocaleString() : "0"}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-background rounded-xl border border-border">
                <span className="text-xs text-muted-foreground">Leverage</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  1:{mt5?.metrics?.leverage || 100}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <HistoryIcon size={18} className="text-primary" />
              Recent Entries
            </h3>
            <div className="space-y-4">
              {recentTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-border">
                  <div>
                    <div className="text-xs font-bold text-foreground">{trade.symbol || "N/A"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {Number(trade.profit) >= 0 ? "Win" : "Loss"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
