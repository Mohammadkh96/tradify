import { useTrades } from "@/hooks/use-trades";
import { StatCard } from "@/components/StatCard";
import { Navigation, MobileNav } from "@/components/Navigation";
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
  ZapOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Link } from "wouter";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: trades, isLoading } = useTrades();
  const userId = "demo_user";
  
  const { data: mt5 } = useQuery<{
    status: string;
    lastSync?: string;
    isLive?: boolean;
    error?: string;
    metrics?: {
      balance: string;
      equity: string;
      floatingPl: string;
      marginLevel: string;
      margin: string;
      freeMargin: string;
      leverage: number;
      currency: string;
      positions: any[];
    };
    lastUpdate?: string;
  }>({
    queryKey: [`/api/mt5/status/${userId}`],
    refetchInterval: 2000,
  });

  const { data: intelligence } = useQuery<any>({
    queryKey: [`/api/performance/intelligence/${userId}`],
  });

  const { data: snapshots } = useQuery<any[]>({
    queryKey: [`/api/mt5/snapshots/${userId}`],
  });

  const { data: userRoleData } = useQuery<any>({
    queryKey: [`/api/traders-hub/user-role/${localStorage.getItem("user_id") || "demo_user"}`],
  });

  const subscription = userRoleData?.subscriptionTier || "FREE";
  const isPro = subscription === "PRO";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin text-emerald-500"><Activity size={32} /></div>
      </div>
    );
  }

  const allTrades = trades || [];
  const wins = allTrades.filter(t => t.outcome === "Win").length;
  const losses = allTrades.filter(t => t.outcome === "Loss").length;
  const total = allTrades.length;
  
  const winRate = total >= 20 ? ((wins / total) * 100).toFixed(1) : "N/A";
  const winRateStatus = total >= 20 ? "🟡 DERIVED" : "⚪ WAITING (min 20)";
  
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
      subtext: "🟢 MT5 LIVE",
      trend: mt5?.status === "CONNECTED" ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Equity", 
      value: mt5?.status === "CONNECTED" && mt5.metrics ? `$${parseFloat(mt5.metrics.equity).toLocaleString()}` : "$0", 
      icon: <Activity size={18} />, 
      subtext: "🟢 MT5 LIVE",
      trend: mt5?.status === "CONNECTED" ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Win Rate", 
      value: intelligence?.winRate ? `${intelligence.winRate}%` : "0%", 
      icon: <Target size={18} />, 
      subtext: "ALL TIME",
      trend: parseFloat(intelligence?.winRate || "0") > 50 ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Expectancy", 
      value: intelligence?.expectancy ? `$${intelligence.expectancy}` : "$0", 
      icon: <TrendingUp size={18} />, 
      subtext: "PER TRADE",
      trend: parseFloat(intelligence?.expectancy || "0") > 0 ? "up" : "down" as "up" | "down"
    },
  ];

  const recentTrades = [...allTrades].sort((a, b) => 
    new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
  ).slice(0, 5);

  const pieData = total >= 20 ? [
    { name: 'Wins', value: wins, color: '#10b981' },
    { name: 'Losses', value: losses, color: '#f43f5e' },
  ] : [
    { name: 'Placeholder', value: 1, color: '#1e293b' }
  ];

  return (
    <div className="flex-1 text-slate-50 pb-20 md:pb-0">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <LayoutDashboard className="text-emerald-500" />
              Trader Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Market Overview & Performance Metrics</p>
          </div>
          {mt5?.status === "CONNECTED" ? (
            <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-full px-5 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">MT5 Live</span>
              </div>
              <div className="w-px h-5 bg-slate-800" />
              <div className="text-[10px] text-slate-400 font-mono font-bold">
                Last Sync: {mt5?.lastSync ? format(new Date(mt5.lastSync), 'HH:mm:ss') : 'N/A'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-full px-5 py-2.5 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">Terminal Offline</span>
                </div>
                {mt5?.lastSync && (
                  <>
                    <div className="w-px h-5 bg-slate-800" />
                    <div className="text-[10px] text-slate-400 font-mono font-bold">
                      Last: {format(new Date(mt5.lastSync), 'MMM d, HH:mm')}
                    </div>
                  </>
                )}
              </div>
              {mt5?.error && (
                <span className="text-[9px] text-rose-500/80 font-bold uppercase tracking-tighter pr-4">
                  Error: {mt5.error}
                </span>
              )}
            </div>
          )}
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
          <div className="lg:col-span-2 bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity size={18} className="text-emerald-500" />
                  Equity Curve
                </h3>
                <p className="text-xs text-slate-500">Growth performance over time</p>
              </div>
            </div>
            {/* Equity Curve Chart */}
            <div className="h-[300px] w-full relative">
              {chartData.length < 2 && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/20 backdrop-blur-[1px] rounded-xl border border-dashed border-slate-800/50">
                  <Activity className="text-slate-700 mb-2 animate-pulse" size={32} />
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Awaiting historical equity snapshots</p>
                  <span className="text-[9px] text-slate-600 mt-1 italic">Curve populates after periodic sync intervals</span>
                </div>
              )}
              {!isPro && chartData.length >= 30 && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm rounded-xl">
                  <Lock className="text-emerald-500 mb-2" size={24} />
                  <p className="text-sm font-bold text-white uppercase tracking-widest">30-Day Limit (FREE)</p>
                  <Button variant="ghost" asChild className="text-emerald-500 text-xs h-auto p-0 mt-1 hover:bg-transparent">
                    <Link href="/pricing">Upgrade to PRO for full history</Link>
                  </Button>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => `$${v/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#f8fafc' }}
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
                    stroke="#64748b" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="none" 
                    name="Balance"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#0b1120] border border-emerald-500/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap size={80} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-500" />
              Performance Intelligence
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Best Session</span>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-emerald-500" />
                    <span className="text-xs font-bold text-white">{intelligence?.bestSession || "..."}</span>
                  </div>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Best Day</span>
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-emerald-500" />
                    <span className="text-xs font-bold text-white">{intelligence?.bestDay || "..."}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Profit Factor</span>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-emerald-500">{intelligence?.profitFactor || "0.00"}</span>
                  <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min((parseFloat(intelligence?.profitFactor || "0") / 3) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Avg R:R</span>
                  <span className="text-sm font-black text-white">{intelligence?.avgRR || "0.00"}</span>
                </div>
                <div className="p-3 text-right">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Expectancy</span>
                  <span className="text-sm font-black text-emerald-500">${intelligence?.expectancy || "0.00"}</span>
                </div>
              </div>

              <div className="border-t border-slate-800/50 pt-4 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Max Drawdown</span>
                  <span className="text-xs font-mono font-bold text-rose-500">${intelligence?.maxDrawdown || "0.00"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Recovery Factor</span>
                  <span className="text-xs font-mono font-bold text-blue-500">{intelligence?.recoveryFactor || "0.00"}</span>
                </div>
              </div>
            </div>

            {!isPro && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                <Lock className="text-emerald-500 mb-3" size={24} />
                <h4 className="text-sm font-bold text-white uppercase tracking-tighter mb-1">Intelligence Layer Locked</h4>
                <p className="text-[10px] text-slate-400 mb-4">Upgrade to PRO to unlock advanced session and expectancy analytics.</p>
                <Link href="/pricing">
                  <Button className="bg-emerald-500 text-slate-950 font-black text-[10px] uppercase h-8 px-4">Unlock Intelligence</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Percent size={18} className="text-emerald-500" />
              Open Positions
            </h3>
            <div className="space-y-4 overflow-y-auto max-h-[400px]">
              {mt5?.metrics?.positions && mt5.metrics.positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800">
                        <th className="pb-2 font-medium">Symbol</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium text-right">Lots</th>
                        <th className="pb-2 font-medium text-right">Entry</th>
                        <th className="pb-2 font-medium text-right font-bold text-slate-300">P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {mt5.metrics.positions.map((pos: any) => (
                        <tr key={pos.ticket} className="group">
                          <td className="py-3 font-bold text-white">{pos.symbol}</td>
                          <td className="py-3">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                              pos.type === "Buy" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                            )}>
                              {pos.type}
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono text-slate-400">{pos.volume}</td>
                          <td className="py-3 text-right font-mono text-slate-400">{parseFloat(pos.price).toFixed(5)}</td>
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
                <div className="py-10 flex flex-col items-center justify-center text-slate-500 opacity-50">
                  <Activity size={32} className="mb-2" />
                  <p className="text-xs">No active open positions</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-6">Account Health</h3>
            <div className="space-y-4">
              <div className="flex justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Margin Level</span>
                <span className={cn(
                  "text-sm font-mono font-bold",
                  parseFloat(mt5?.metrics?.marginLevel || "0") > 300 ? "text-emerald-500" :
                  parseFloat(mt5?.metrics?.marginLevel || "0") > 150 ? "text-amber-500" : "text-rose-500"
                )}>
                  {parseFloat(mt5?.metrics?.marginLevel || "0").toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Free Margin %</span>
                <span className="text-sm font-mono font-bold text-emerald-500">
                  {mt5?.metrics ? ((parseFloat(mt5.metrics.freeMargin) / parseFloat(mt5.metrics.equity)) * 100).toFixed(1) : "0"}%
                </span>
              </div>
              <div className="flex justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Margin Used</span>
                <span className="text-sm font-mono font-bold text-slate-200">
                  ${parseFloat(mt5?.metrics?.margin || "0").toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Free Margin</span>
                <span className="text-sm font-mono font-bold text-emerald-500">
                  ${parseFloat(mt5?.metrics?.freeMargin || "0").toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Leverage</span>
                <span className="text-sm font-mono font-bold text-slate-200">
                  1:{mt5?.metrics?.leverage || 100}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <HistoryIcon size={18} className="text-emerald-500" />
              Recent Entries
            </h3>
            <div className="space-y-4">
              {recentTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-white">{trade.pair}</div>
                    <div className="text-[10px] text-slate-500">{trade.outcome}</div>
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
