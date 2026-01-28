import { useTrades, useDeleteTrade } from "@/hooks/use-trades";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Trash2, History as HistoryIcon, Plus, Calendar } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function Journal() {
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const { data: manualTrades, isLoading: isLoadingManual } = useTrades();
  const { data: mt5History } = useQuery<any[]>({
    queryKey: user?.userId ? [`/api/mt5/history/${user.userId}`] : ["/api/mt5/history/demo"],
    enabled: true,
  });

  const subscription = user?.subscriptionTier || "FREE";
  const isPro = subscription === "PRO";

  const deleteTrade = useDeleteTrade();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const combinedTrades = useMemo(() => {
    // Only show manual trades that are NOT MT5 sync duplicates
    const manual = (manualTrades || [])
      .filter(t => !t.notes?.startsWith("MT5_TICKET_"))
      .map(t => ({
        ...t,
        source: "Manual",
        netPl: typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0),
        closeTime: t.createdAt
      }));
    
    const mt5 = (mt5History || []).map(t => {
      const pl = parseFloat(t.netPl);
      let outcome: string;
      if (pl > 0) outcome = "Win";
      else if (pl < 0) outcome = "Loss";
      else outcome = "Break-even";
      
      return {
        id: t.id,
        ticket: t.ticket,
        pair: t.symbol,
        direction: t.direction,
        timeframe: "MT5",
        createdAt: t.openTime,
        closeTime: t.closeTime,
        duration: t.duration,
        outcome,
        netPl: pl,
        riskReward: "N/A",
        notes: t.notes || `Ticket: ${t.ticket}`,
        tags: t.tags || [],
        source: "MT5",
        isMT5: true
      };
    });

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
        } else if (dateFilter === "custom" && customStartDate && customEndDate) {
          const start = startOfDay(parseISO(customStartDate));
          const end = endOfDay(parseISO(customEndDate));
          matchesDate = isWithinInterval(tradeDate, { start, end });
        }
      }
      return matchesSearch && matchesOutcome && matchesDate;
    });

    if (!isPro) {
      const thirtyDaysAgo = subDays(new Date(), 30);
      base = base.filter(trade => new Date(trade.closeTime || trade.createdAt) >= thirtyDaysAgo);
    }

    return base;
  }, [combinedTrades, searchTerm, filterOutcome, dateFilter, customStartDate, customEndDate, isPro]);

  const stats = useMemo(() => {
    const total = filteredTrades.length;
    const wins = filteredTrades.filter(t => t.outcome === "Win").length;
    const losses = filteredTrades.filter(t => t.outcome === "Loss").length;
    const breakeven = filteredTrades.filter(t => t.outcome === "Break-even").length;
    const netPl = filteredTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0);
    
    // Win rate excludes break-even trades (only count decisive trades)
    const decisiveTrades = wins + losses;
    const winRate = decisiveTrades > 0 ? (wins / decisiveTrades * 100).toFixed(1) : "0.0";
    
    // Average Win / Average Loss
    const winningTrades = filteredTrades.filter(t => t.outcome === "Win");
    const losingTrades = filteredTrades.filter(t => t.outcome === "Loss");
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0) / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0)) / losingTrades.length 
      : 0;
    
    // Expectancy = (Win Rate × Avg Win) − (Loss Rate × Avg Loss)
    const winRateDecimal = decisiveTrades > 0 ? wins / decisiveTrades : 0;
    const lossRateDecimal = decisiveTrades > 0 ? losses / decisiveTrades : 0;
    const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);
    
    // Profit Factor = Gross Profit / Gross Loss
    const grossProfit = winningTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0);
    const grossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";
    
    return { total, winRate, netPl, wins, losses, breakeven, profitFactor, avgWin, avgLoss, expectancy };
  }, [filteredTrades]);

  const statsDerivedLabel = "Derived from history";

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                <HistoryIcon className="text-emerald-500" />
                Trade Journal
              </h1>
              <p className="text-muted-foreground mt-1">Institutional-grade performance logging</p>
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
            <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
              {['all', 'today', 'week', 'month'].map((filter) => (
                <Button
                  key={filter}
                  variant={dateFilter === filter ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDateFilter(filter)}
                  className={cn(
                    "h-8 text-[10px] font-bold uppercase tracking-wider px-4 rounded-lg transition-all",
                    dateFilter === filter ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`filter-${filter}`}
                >
                  {filter === 'all' ? 'All Time' : filter}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateFilter === "custom" ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-8 text-[10px] font-bold uppercase tracking-wider px-4 rounded-lg transition-all",
                      dateFilter === "custom" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-muted-foreground hover:text-foreground"
                    )}
                    data-testid="filter-custom"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Custom Date Range</div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">From</label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="h-9 text-sm"
                          data-testid="input-start-date"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">To</label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="h-9 text-sm"
                          data-testid="input-end-date"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => setDateFilter("custom")}
                      disabled={!customStartDate || !customEndDate}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold uppercase h-9"
                      data-testid="button-apply-custom-date"
                    >
                      Apply Filter
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Link href="/strategies/create">
              <Button 
                data-testid="button-log-trade"
                className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs uppercase transition-all shadow-lg shadow-emerald-500/20 px-6 h-10 rounded-xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                Log Trade
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Total Trades</span>
            <div className="text-3xl font-black text-foreground">{stats.total}</div>
            <div className="text-[9px] text-muted-foreground/50 mt-2 font-bold uppercase tracking-tighter">{statsDerivedLabel}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Win Rate</span>
            <div className="text-3xl font-black text-foreground">{stats.winRate}%</div>
            <div className="text-[9px] text-muted-foreground/50 mt-2 font-bold uppercase tracking-tighter">{statsDerivedLabel}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Net P&L</span>
            <div className={cn("text-3xl font-black", stats.netPl >= 0 ? "text-emerald-500" : "text-rose-500")}>
              ${stats.netPl.toLocaleString()}
            </div>
            <div className="text-[9px] text-muted-foreground/50 mt-2 font-bold uppercase tracking-tighter">{statsDerivedLabel}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Wins / Losses</span>
            <div className="text-3xl font-black text-foreground">{stats.wins}W / {stats.losses}L</div>
            <div className="text-[9px] text-muted-foreground/50 mt-2 font-bold uppercase tracking-tighter">{statsDerivedLabel}</div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredTrades.map((trade: any) => (
            <div key={trade.id} className="bg-card border border-border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-500/30 transition-colors group relative">
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
                    <span className="text-lg font-black text-foreground group-hover:text-emerald-400 transition-colors">{trade.pair}</span>
                    <span className={cn(
                      "text-[9px] font-black px-1.5 py-0.5 rounded border uppercase",
                      trade.direction === "Long" || trade.direction === "Buy" ? "text-emerald-500 border-emerald-500/20" : "text-rose-500 border-rose-500/20"
                    )}>
                      {trade.direction}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase flex items-center gap-2">
                    {trade.source === "MT5" ? <span className="text-sky-500 font-bold">MT5 SYNCED</span> : <span className="text-muted-foreground">MANUAL</span>}
                    {trade.ticket && <span className="text-muted-foreground/50 bg-muted/50 px-1 rounded">#{trade.ticket}</span>}
                  </div>
                  {trade.tags && trade.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {trade.tags.map((tag: string) => (
                        <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-background text-muted-foreground border border-border rounded uppercase font-bold">
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
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Duration</div>
                  <div className="text-sm font-mono text-muted-foreground">
                    {trade.isMT5 ? (
                      (() => {
                        const seconds = trade.duration || 0;
                        const h = Math.floor(seconds / 3600);
                        const m = Math.floor((seconds % 3600) / 60);
                        const s = seconds % 60;
                        return `${h}h ${m}m ${s}s`;
                      })()
                    ) : "Manual"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">P&L</div>
                  <div className={cn(
                    "text-xl font-black font-mono",
                    parseFloat(trade.netPl) >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {trade.netPl !== 0 ? (trade.netPl > 0 ? `+$${parseFloat(trade.netPl).toFixed(2)}` : `-$${Math.abs(parseFloat(trade.netPl)).toFixed(2)}`) : "$0.00"}
                  </div>
                </div>
                <div className="text-right w-24">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Status</div>
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
            <div className="py-20 flex flex-col items-center justify-center text-muted-foreground bg-card border border-border rounded-2xl border-dashed">
              <HistoryIcon size={48} className="mb-4 opacity-20" />
              <p>No trades found for this filter</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
