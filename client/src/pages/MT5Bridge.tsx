import { useQuery } from "@tanstack/react-query";
import { Navigation, MobileNav } from "@/components/Navigation";
import { 
  Activity, 
  Wallet, 
  BarChart3, 
  RefreshCw, 
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function MT5Bridge() {
  const { data: mt5, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/mt5/status"],
    refetchInterval: 2000, // Poll every 2 seconds
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-3xl font-bold text-white tracking-tight">MT5 Bridge</h1>
            </div>
            <p className="text-slate-400">Real-time MetaTrader 5 Synchronization</p>
          </div>
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
            Sync Now
          </button>
        </header>

        {error ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-8 text-center">
            <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Bridge Connection Error</h3>
            <p className="text-slate-400">Could not establish connection to the MT5 export bridge.</p>
          </div>
        ) : !mt5 ? (
          <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-12 text-center">
            <Zap size={48} className="mx-auto text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Waiting for MT5 Data</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-6">
              Launch your MetaTrader 5 and ensure the TRADIFY Bridge Expert Advisor is active.
            </p>
            <div className="flex justify-center gap-4">
              <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-all">
                Download EA
              </button>
              <button className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-lg font-medium transition-all">
                Setup Guide
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Account Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Balance</span>
                  <Wallet className="text-emerald-500" size={18} />
                </div>
                <div className="text-2xl font-mono font-bold text-white">
                  ${mt5.accountInfo?.balance?.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-2">
                  Equity: ${mt5.accountInfo?.equity?.toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Floating P&L</span>
                  <Activity className={cn(mt5.accountInfo?.profit >= 0 ? "text-emerald-500" : "text-rose-500")} size={18} />
                </div>
                <div className={cn(
                  "text-2xl font-mono font-bold",
                  mt5.accountInfo?.profit >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {mt5.accountInfo?.profit >= 0 ? "+" : ""}${mt5.accountInfo?.profit?.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">
                  Margin Level: {mt5.accountInfo?.margin_level}%
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bridge Status</span>
                  <ShieldCheck className="text-emerald-500" size={18} />
                </div>
                <div className="text-2xl font-bold text-white">ACTIVE</div>
                <div className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">
                  Last Sync: {formatDistanceToNow(new Date(mt5.lastUpdate))} ago
                </div>
              </div>
            </div>

            {/* Live Positions */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest">
                  <BarChart3 size={16} className="text-slate-500" />
                  Live Positions ({mt5.positions?.length || 0})
                </h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold">REAL-TIME</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-950/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <th className="px-6 py-3">Symbol</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Lots</th>
                      <th className="px-6 py-3">Entry</th>
                      <th className="px-6 py-3 text-right">Profit</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {mt5.positions?.map((pos: any, idx: number) => (
                      <tr key={idx} className="group hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-sm text-white font-bold">{pos.symbol}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                            pos.type === "Buy" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                          )}>
                            {pos.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-300">{pos.volume}</td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-300">{pos.price_open}</td>
                        <td className={cn(
                          "px-6 py-4 font-mono text-sm text-right font-bold",
                          pos.profit >= 0 ? "text-emerald-500" : "text-rose-500"
                        )}>
                          {pos.profit >= 0 ? "+" : ""}${pos.profit?.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500 hover:text-emerald-400">
                            <ExternalLink size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!mt5.positions || mt5.positions.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500 italic">
                          No active positions found on MT5 terminal.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
