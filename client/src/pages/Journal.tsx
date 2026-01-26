import { useTrades, useDeleteTrade } from "@/hooks/use-trades";
import { Navigation, MobileNav } from "@/components/Navigation";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Trash2, Search, Filter, Calendar as CalendarIcon, TrendingUp, Target, Activity, Share2, History as HistoryIcon, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export default function Journal() {
  const userId = "demo_user";
  const { data: manualTrades, isLoading: isLoadingManual } = useTrades();
  const { data: mt5History, isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: [`/api/mt5/history/${userId}`],
  });
  
  const { data: userRoleData } = useQuery<any>({
    queryKey: [`/api/traders-hub/user-role/${userId}`],
  });

  const subscription = userRoleData?.subscriptionTier || "FREE";
  const isPro = subscription === "PRO";

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
      id: t.id,
      ticket: t.ticket,
      pair: t.symbol,
      direction: t.direction,
      timeframe: "MT5",
      createdAt: t.openTime,
      closeTime: t.closeTime,
      outcome: parseFloat(t.netPl) >= 0 ? "Win" : "Loss",
      netPl: parseFloat(t.netPl),
      riskReward: "N/A",
      notes: t.notes || `Ticket: ${t.ticket}`,
      tags: t.tags || [],
      source: "MT5",
      isMT5: true
    }));

    return [...manual, ...mt5].sort((a, b) => 
      new Date(b.closeTime!).getTime() - new Date(a.closeTime!).getTime()
    );
  }, [manualTrades, mt5History]);

  const filteredTrades = useMemo(() => {
    let base = combinedTrades.filter(trade => {
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

    // FREE users limited to last 30 days
    if (!isPro) {
      const thirtyDaysAgo = subDays(new Date(), 30);
      base = base.filter(trade => new Date(trade.closeTime || trade.createdAt) >= thirtyDaysAgo);
    }

    return base;
  }, [combinedTrades, searchTerm, filterOutcome, dateFilter, isPro]);

  const stats = useMemo(() => {
    const total = filteredTrades.length;
    const wins = filteredTrades.filter(t => t.outcome === "Win").length;
    const losses = filteredTrades.filter(t => t.outcome === "Loss").length;
    
    // Calculate P&L from filtered set
    const netPl = filteredTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0);
    const winRate = total > 0 ? (wins / total * 100).toFixed(1) : "0.0";

    // Pro metrics
    const profitFactor = losses === 0 ? "∞" : (wins / losses).toFixed(2); // Simplified placeholder
    
    return { total, winRate, netPl, wins, losses, profitFactor };
  }, [filteredTrades]);

  const statsDerivedLabel = "🟡 Derived from history";

  return (
    <div className="flex-1 text-slate-50 pb-20 md:pb-0">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                <HistoryIcon className="text-emerald-500" />
                Trade Journal
              </h1>
              <p className="text-slate-400 mt-1">Institutional-grade performance logging</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!isPro && (
              <Link href="/pricing">
                <Button variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest h-10 px-4">
                  Upgrade to PRO
                </Button>
              </Link>
            )}
            <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
              {['all', 'today', 'week', 'month'].map((filter) => (
                <Button
                  key={filter}
                  variant={dateFilter === filter ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDateFilter(filter)}
                  className={cn(
                    "h-8 text-[10px] font-bold uppercase tracking-wider px-4 rounded-lg transition-all",
                    dateFilter === filter ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:text-white"
                  )}
                >
                  {filter === 'all' ? 'All Time' : filter}
                </Button>
              ))}
            </div>
            <Link href="/new-entry">
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs uppercase transition-all shadow-lg shadow-emerald-500/20 px-6 h-10 rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                New Entry
              </Button>
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
          {isPro && (
            <div className="bg-[#0b1120] border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block mb-1">Profit Factor</span>
              <div className="text-3xl font-black text-white">{stats.profitFactor}</div>
              <div className="text-[9px] text-slate-600 mt-2">PRO Analytics</div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {filteredTrades.map((trade: any) => (
            <div key={trade.id} className="bg-[#0b1120] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-500/30 transition-colors group relative">
              <button 
                onClick={() => deleteTrade.mutate(trade.id)}
                className="absolute top-2 right-2 p-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white z-10"
              >
                <Trash2 size={14} />
              </button>
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
                  <div className="flex flex-col gap-2">
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase flex items-center gap-2">
                    {trade.source === "MT5" ? <span className="text-sky-500">🟢 MT5 SYNCED</span> : <span className="text-slate-600">⚪ MANUAL</span>}
                    {trade.ticket && <span className="opacity-50">#{trade.ticket}</span>}
                  </div>
                  {trade.tags && trade.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {trade.tags.map((tag: string) => (
                        <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded uppercase font-bold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
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
