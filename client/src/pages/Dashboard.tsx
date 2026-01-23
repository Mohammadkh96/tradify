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
  BarChart3
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Link } from "wouter";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: trades, isLoading } = useTrades();
  const { data: mt5 } = useQuery<{
    status: string;
    metrics?: {
      balance: string;
      equity: string;
      floatingPl: string;
      marginLevel: string;
    };
  }>({
    queryKey: ["/api/mt5/status/demo_user"], // In real app, use current userId
    refetchInterval: 2000,
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
      subtext: mt5?.status === "CONNECTED" ? "Live from MT5" : "Accuracy First",
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
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Trader Dashboard</h1>
          <p className="text-slate-400 mt-1">Market Overview & Performance Metrics</p>
        </header>

        {/* Stats Grid */}
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
          {/* Win/Loss Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-6">Performance Distribution</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-slate-300">Win</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <span className="text-slate-300">Loss</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                <span className="text-slate-300">BE</span>
              </div>
            </div>
          </div>

          {/* Recent Trades List */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Recent Journal Entries</h3>
              <Link href="/journal">
                <span className="text-sm text-emerald-500 hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors">
                  View All <ArrowRight size={14} />
                </span>
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="pb-3 pl-2">Pair</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Outcome</th>
                    <th className="pb-3 text-right pr-2">R:R</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {recentTrades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-2 font-numeric font-medium text-slate-200">{trade.pair}</td>
                      <td className="py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          trade.direction === "Long" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                        )}>
                          {trade.direction}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">{trade.createdAt ? format(new Date(trade.createdAt), 'MMM d, HH:mm') : '-'}</td>
                      <td className="py-3">
                        <span className={cn(
                          "flex items-center gap-1.5",
                          trade.outcome === "Win" && "text-emerald-500",
                          trade.outcome === "Loss" && "text-rose-500",
                          trade.outcome === "BE" && "text-slate-400",
                          trade.outcome === "Pending" && "text-amber-500",
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            trade.outcome === "Win" && "bg-emerald-500",
                            trade.outcome === "Loss" && "bg-rose-500",
                            trade.outcome === "BE" && "bg-slate-400",
                            trade.outcome === "Pending" && "bg-amber-500",
                          )}></span>
                          {trade.outcome}
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2 font-numeric text-slate-300">{trade.riskReward || '-'}R</td>
                    </tr>
                  ))}
                  {recentTrades.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                        No trades logged yet. Start your journal!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick Tips Section */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-700 text-amber-500">
                <Activity size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Pre-Session Reminder</h3>
                <p className="text-slate-300 text-sm leading-relaxed max-w-3xl">
                  Before entering any trade today, verify HTF structure. Don't force trades in the middle of the range.
                  Wait for price to reach premium/discount zones and show displacement. Remember: <span className="text-emerald-400 font-medium">Patience pays.</span>
                </p>
              </div>
            </div>
            {mt5?.status === "CONNECTED" && (
              <div className="hidden lg:block text-right">
                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1 flex items-center justify-end gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live MT5 Link Verified
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Last Sync: {mt5.lastUpdate ? new Date(mt5.lastUpdate).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
