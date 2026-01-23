import { useTrades, useDeleteTrade } from "@/hooks/use-trades";
import { Navigation, MobileNav } from "@/components/Navigation";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Trash2, Search, Filter, Calendar as CalendarIcon, TrendingUp, Target, Activity, Share2, History as HistoryIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function Journal() {
  const userId = "demo_user";
  const { data: manualTrades, isLoading: isLoadingManual } = useTrades();
  const { data: mt5History, isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: [`/api/mt5/history/${userId}`],
  });
  
  const deleteTrade = useDeleteTrade();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const combinedTrades = useMemo(() => {
    const manual = (manualTrades || []).map(t => ({
      ...t,
      source: "Manual",
      netPl: 0, 
      closeTime: t.createdAt
    }));
    
    const mt5 = (mt5History || []).map(t => ({
      id: `mt5-${t.ticket}`,
      pair: t.symbol,
      direction: t.direction,
      timeframe: "MT5",
      createdAt: t.openTime,
      closeTime: t.closeTime,
      outcome: parseFloat(t.netPl) >= 0 ? "Win" : "Loss",
      netPl: parseFloat(t.netPl),
      riskReward: "N/A",
      notes: `Ticket: ${t.ticket}`,
      source: "MT5",
      isMT5: true
    }));

    return [...manual, ...mt5].sort((a, b) => 
      new Date(b.closeTime!).getTime() - new Date(a.closeTime!).getTime()
    );
  }, [manualTrades, mt5History]);

  const filteredTrades = useMemo(() => {
    return combinedTrades.filter(trade => {
      const matchesSearch = trade.pair.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOutcome = filterOutcome === "all" || trade.outcome === filterOutcome;
      
      let matchesDate = true;
      if (dateFilter !== "all" && trade.closeTime) {
        const tradeDate = new Date(trade.closeTime);
        const now = new Date();
        if (dateFilter === "today") {
          matchesDate = isWithinInterval(tradeDate, { start: startOfDay(now), end: endOfDay(now) });
        } else if (dateFilter === "week") {
          matchesDate = isWithinInterval(tradeDate, { start: startOfWeek(now), end: endOfDay(now) });
        } else if (dateFilter === "month") {
          matchesDate = isWithinInterval(tradeDate, { start: startOfMonth(now), end: endOfDay(now) });
        }
      }
      return matchesSearch && matchesOutcome && matchesDate;
    });
  }, [combinedTrades, searchTerm, filterOutcome, dateFilter]);

  const stats = useMemo(() => {
    const total = filteredTrades.length;
    const wins = filteredTrades.filter(t => t.outcome === "Win").length;
    const losses = filteredTrades.filter(t => t.outcome === "Loss").length;
    const netPl = filteredTrades.reduce((acc, t) => acc + (t.netPl || 0), 0);
    const winRate = total > 0 ? (wins / total * 100).toFixed(1) : "0.0";
    return { total, winRate, netPl, wins, losses };
  }, [filteredTrades]);

  const statsDerivedLabel = "🟡 Derived from history";

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Trade Journal</h1>
            <p className="text-slate-400 mt-1">Review performance history</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
              <Filter size={14} className="text-slate-500" />
              <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-300 focus:outline-none"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <Link href="/new-entry">
              <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase transition-colors shadow-lg shadow-emerald-500/20">
                + New Entry
              </button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-700" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Total Trades</span>
            <div className="text-3xl font-black text-white">{stats.total}</div>
            <div className="text-[9px] text-slate-600 mt-2">{statsDerivedLabel}</div>
          </div>
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Win Rate</span>
            <div className="text-3xl font-black text-white">{stats.winRate}%</div>
            <div className="text-[9px] text-slate-600 mt-2">{statsDerivedLabel}</div>
          </div>
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Net P&L</span>
            <div className={cn("text-3xl font-black", stats.netPl >= 0 ? "text-emerald-500" : "text-rose-500")}>
              ${stats.netPl.toLocaleString()}
            </div>
            <div className="text-[9px] text-slate-600 mt-2">{statsDerivedLabel}</div>
          </div>
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Wins / Losses</span>
            <div className="text-3xl font-black text-white">{stats.wins}W / {stats.losses}L</div>
            <div className="text-[9px] text-slate-600 mt-2">{statsDerivedLabel}</div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredTrades.map((trade: any) => (
            <div key={trade.id} className="bg-[#0b1120] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs border",
                  trade.outcome === "Win" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                )}>
                  {trade.pair.substring(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors">{trade.pair}</span>
                    <span className={cn(
                      "text-[9px] font-black px-1.5 py-0.5 rounded border uppercase",
                      trade.direction === "Long" || trade.direction === "Buy" ? "text-emerald-500 border-emerald-500/20" : "text-rose-500 border-rose-500/20"
                    )}>
                      {trade.direction}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase flex items-center gap-2">
                    {trade.source === "MT5" ? <span className="text-sky-500">🟢 MT5 SYNCED</span> : <span className="text-slate-600">⚪ MANUAL</span>}
                    {trade.notes?.includes("Ticket:") && <span className="opacity-50">#{trade.notes.split("Ticket: ")[1]}</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between md:justify-end gap-10">
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Duration</div>
                  <div className="text-sm font-mono text-slate-300">
                    {trade.source === "MT5" ? "Synced" : "Manual"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">P&L</div>
                  <div className={cn(
                    "text-xl font-black font-mono",
                    parseFloat(trade.netPl) >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {trade.netPl !== 0 ? `$${parseFloat(trade.netPl).toFixed(2)}` : "-"}
                  </div>
                </div>
                <div className="text-right w-24">
                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Status</div>
                  <div className={cn(
                    "text-sm font-bold px-3 py-1 rounded-full border",
                    trade.outcome === "Win" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                  )}>
                    {trade.outcome}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredTrades.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-[#0b1120] border border-slate-800 rounded-2xl border-dashed">
              <HistoryIcon size={48} className="mb-4 opacity-20" />
              <p>No trades found for this filter</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
