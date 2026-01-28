import { useTrades } from "@/hooks/use-trades";
import { StatCard } from "@/components/StatCard";
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
  Percent
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
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

  const { data: snapshots } = useQuery<any[]>({
    queryKey: [`/api/mt5/snapshots/${userId}`],
    staleTime: 0,
  });

  const { data: userRoleData } = useQuery<any>({
    queryKey: [`/api/traders-hub/user-role/${localStorage.getItem("user_id") || "demo_user"}`],
  });

  const subscription = userRoleData?.subscriptionTier || "FREE";
  const isPro = subscription === "PRO";

  const { data: insights, isLoading: isInsightsLoading } = useQuery<any>({
    queryKey: [`/api/ai/insights/${userId}`],
    enabled: !!userId && isPro,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin text-emerald-500"><Activity size={32} /></div>
      </div>
    );
  }

  const allTrades = trades || [];
  const total = allTrades.length;
  
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
    new Date(b.createdAt || b.openTime || 0).getTime() - new Date(a.createdAt || a.openTime || 0).getTime()
  ).slice(0, 5);

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <LayoutDashboard className="text-emerald-500" />
              Trader Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground text-sm">Market Overview & Performance Metrics</p>
              <Link href="/risk-disclaimer" className="text-[10px] text-muted-foreground hover:text-emerald-500 uppercase font-bold tracking-widest transition-colors">Risk Disclaimer</Link>
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
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">Awaiting historical equity snapshots</p>
                  <span className="text-[9px] text-muted-foreground/50 mt-1 italic">Curve populates after periodic sync intervals</span>
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
                  <Area 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="none" 
                    name="Balance"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-emerald-500/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap size={80} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-500" />
              AI Performance Insights
            </h3>
            
            <div className="space-y-4">
              {isInsightsLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <div className="animate-spin text-emerald-500"><RefreshCw size={24} /></div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Generating Analyst Report...</p>
                </div>
              ) : insights?.insightText ? (
                <div className="space-y-4">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="text-xs text-foreground leading-relaxed whitespace-pre-line border-l-2 border-emerald-500/30 pl-4 py-1">
                      {insights.insightText}
                    </div>
                  </div>
                  
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 flex items-start gap-2">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground italic leading-tight">
                        Note: These insights are generated based on your historical MT5 and Journal data using strictly analytical rules.
                      </p>
                      <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-tighter">
                        Not financial advice. <Link href="/risk-disclaimer" className="text-emerald-500/50 hover:underline">View Disclaimer</Link>
                      </p>
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
                <Lock className="text-emerald-500 mb-3" size={24} />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-tighter mb-1">AI Analyst Locked</h4>
                <p className="text-[10px] text-muted-foreground mb-4">Subscribe to PRO to unlock contextual AI performance insights.</p>
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
                  <span className="text-lg font-black text-emerald-500">{intelligence?.profitFactor || "0.00"}</span>
                  <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min((parseFloat(intelligence?.profitFactor || "0") / 3) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Avg R:R</span>
                  <span className="text-sm font-black text-foreground">{intelligence?.avgRR || "0.00"}</span>
                </div>
                <div className="p-3 text-right">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Expectancy</span>
                  <span className="text-sm font-black text-emerald-500">${intelligence?.expectancy || "0.00"}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Max Drawdown</span>
                  <span className="text-xs font-mono font-bold text-rose-500">${intelligence?.maxDrawdown || "0.00"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Recovery Factor</span>
                  <span className="text-xs font-mono font-bold text-blue-500">{intelligence?.recoveryFactor || "0.00"}</span>
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
        </div>

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
              {recentTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-border group hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] border",
                      trade.outcome === "Win" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    )}>
                      {trade.pair.substring(0, 3)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">{trade.pair}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">{trade.direction}</div>
                    </div>
                  </div>
                  <div className={cn(
                    "text-xs font-mono font-bold",
                    trade.outcome === "Win" ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {trade.outcome === "Win" ? "WIN" : "LOSS"}
                  </div>
                </div>
              ))}
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
