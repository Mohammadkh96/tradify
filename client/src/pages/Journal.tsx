import { useTrades, useDeleteTrade } from "@/hooks/use-trades";
import { Navigation, MobileNav } from "@/components/Navigation";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Trash2, Search, Filter, Calendar, TrendingUp, Target, Activity, Share2 } from "lucide-react";
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
    const netPl = filteredTrades.reduce((acc, t) => acc + (t.netPl || 0), 0);
    const winRate = total > 0 ? (wins / total * 100).toFixed(1) : "0.0";
    return { total, winRate, netPl };
  }, [filteredTrades]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Trade Journal</h1>
            <p className="text-slate-400 mt-1">Review outcomes</p>
          </div>
          <Link href="/new-entry">
            <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase">
              + New Entry
            </button>
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Total Trades</span>
            <div className="text-2xl font-black text-white">{stats.total}</div>
          </div>
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Win Rate</span>
            <div className="text-2xl font-black text-white">{stats.winRate}%</div>
          </div>
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Net P&L</span>
            <div className="text-2xl font-black text-white">${stats.netPl.toLocaleString()}</div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredTrades.map((trade: any) => (
            <div key={trade.id} className="bg-[#0b1120] border border-slate-800 rounded-2xl p-6 flex justify-between items-center">
              <div>
                <div className="text-xl font-black text-white">{trade.pair}</div>
                <div className="text-[10px] text-slate-500 uppercase">{trade.source} | {trade.direction}</div>
              </div>
              <div className="text-right">
                <div className={cn("text-lg font-bold", trade.outcome === "Win" ? "text-emerald-500" : "text-rose-500")}>
                  {trade.outcome}
                </div>
                <div className="text-xs text-slate-600">
                  {trade.closeTime ? format(new Date(trade.closeTime), 'MMM d, HH:mm') : '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
