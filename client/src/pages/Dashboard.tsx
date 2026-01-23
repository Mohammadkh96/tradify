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
  History,
  LayoutDashboard
} from "lucide-react";
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

  const { data: snapshots } = useQuery<any[]>({
    queryKey: [`/api/mt5/snapshots/${userId}`],
  });

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
  const be = allTrades.filter(t => t.outcome === "BE").length;
  const total = allTrades.length;
  
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
  
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
      subtext: mt5?.status === "CONNECTED" ? "Live from MT5" : (mt5?.status === "SYNCING" ? "Syncing..." : "MT5 Disconnected"),
      trend: mt5?.status === "CONNECTED" ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Equity", 
      value: mt5?.status === "CONNECTED" && mt5.metrics ? `$${parseFloat(mt5.metrics.equity).toLocaleString()}` : "$0", 
      icon: <Activity size={18} />, 
      subtext: "Net Asset Value",
      trend: mt5?.status === "CONNECTED" ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Floating P&L", 
      value: mt5?.status === "CONNECTED" && mt5.metrics ? `$${parseFloat(mt5.metrics.floatingPl).toLocaleString()}` : "$0", 
      icon: <TrendingUp size={18} />, 
      subtext: "Current Open Risk",
      trend: mt5?.status === "CONNECTED" && parseFloat(mt5.metrics?.floatingPl || "0") >= 0 ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Margin Level", 
      value: mt5?.status === "CONNECTED" && mt5.metrics ? `${parseFloat(mt5.metrics.marginLevel).toFixed(2)}%` : "0%", 
      icon: <BarChart3 size={18} />, 
      subtext: "Account Health",
      trend: mt5?.status === "CONNECTED" && parseFloat(mt5.metrics?.marginLevel || "0") > 100 ? "up" : "down" as "up" | "down"
    },
  ];

  const recentTrades = [...allTrades].sort((a, b) => 
    new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
  ).slice(0, 5);

  const pieData = [
    { name: 'Wins', value: wins, color: '#10b981' },
    { name: 'Losses', value: losses, color: '#f43f5e' },
    { name: 'Break Even', value: be, color: '#64748b' },
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <LayoutDashboard className="text-emerald-500" />
              Trader Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Market Overview & Performance Metrics</p>
          </div>
          {mt5?.status === "CONNECTED" && (
            <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-full px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">MT5 Live</span>
              </div>
              <div className="w-px h-4 bg-slate-800" />
              <div className="text-[10px] text-slate-500 font-mono">
                {mt5.lastUpdate ? format(new Date(mt5.lastUpdate), 'HH:mm:ss') : 'N/A'}
              </div>
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
            <div className="h-[300px] w-full">
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
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-6">Win Rate</h3>
            <div className="h-64 w-full relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-black text-white">{winRate}%</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verified</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Percent size={18} className="text-emerald-500" />
              Open Positions
            </h3>
            <div className="space-y-4 overflow-y-auto max-h-[400px]">
              {mt5?.metrics?.positions?.map((pos: any) => (
                <div key={pos.ticket} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-bold text-white">{pos.symbol}</span>
                    <span className={cn(
                      "text-sm font-mono font-bold",
                      pos.profit >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      ${parseFloat(pos.profit).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-6">Account Health</h3>
            <div className="space-y-4">
              <div className="flex justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Margin Level</span>
                <span className="text-sm font-mono font-bold text-slate-200">{parseFloat(mt5?.metrics?.marginLevel || "0").toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <History size={18} className="text-emerald-500" />
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
