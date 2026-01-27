import { useTrades, useDeleteTrade } from "@/hooks/use-trades";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Trash2, History as HistoryIcon, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Journal() {
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const { data: manualTrades, isLoading: isLoadingManual } = useTrades();
  const { data: mt5History, isLoading: isLoadingHistory } = useQuery<any[]>({
    queryKey: user?.id ? [`/api/mt5/history/${user.id}`] : ["/api/mt5/history/demo"],
    enabled: true,
  });

  const subscription = user?.subscriptionTier || "FREE";
  const isPro = subscription === "PRO";

  const deleteTrade = useDeleteTrade();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const combinedTrades = useMemo(() => {
    const manual = (manualTrades || []).map(t => ({
      ...t,
      pair: t.symbol,
      source: "Manual",
      netPl: Number(t.profit) || 0,
      closeTime: t.createdAt,
      outcome: Number(t.profit) >= 0 ? "Win" : "Loss"
    }));
    
    const mt5 = (mt5History || []).map(t => ({
      id: t.id,
      ticket: t.ticketId,
      pair: t.symbol,
      direction: t.direction,
      timeframe: "MT5",
      createdAt: t.openTime,
      closeTime: t.closeTime,
      outcome: Number(t.profit) >= 0 ? "Win" : "Loss",
      netPl: Number(t.profit),
      riskReward: "N/A",
      notes: t.notes || `Ticket: ${t.ticketId}`,
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
      const matchesSearch = (trade.pair || "").toLowerCase().includes(searchTerm.toLowerCase());
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
    const netPl = filteredTrades.reduce((acc, t) => acc + (typeof t.netPl === 'string' ? parseFloat(t.netPl) : (t.netPl || 0)), 0);
    const winRate = total > 0 ? (wins / total * 100).toFixed(1) : "0.0";
    return { total, winRate, netPl, wins, losses };
  }, [filteredTrades]);

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
              <HistoryIcon className="text-primary" />
              Trade Journal
            </h1>
            <p className="text-muted-foreground mt-1">Institutional-grade performance logging</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/new-entry">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase px-6 h-10 rounded-xl shadow-lg shadow-primary/20 transition-all">
                <Plus className="mr-2 h-4 w-4" />
                New Entry
              </Button>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card border-border p-6 shadow-md relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-muted-foreground/30" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Total Trades</span>
            <div className="text-3xl font-black text-foreground">{stats.total}</div>
          </Card>
          <Card className="bg-card border-border p-6 shadow-md relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Win Rate</span>
            <div className="text-3xl font-black text-foreground">{stats.winRate}%</div>
          </Card>
          <Card className="bg-card border-border p-6 shadow-md relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Net P&L</span>
            <div className={cn("text-3xl font-black", stats.netPl >= 0 ? "text-primary" : "text-destructive")}>
              ${stats.netPl.toLocaleString()}
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          {filteredTrades.map((trade: any) => (
            <Card key={trade.id} className="bg-card border-border hover:border-primary/30 transition-colors group relative overflow-visible">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <button 
                  onClick={() => deleteTrade.mutate(trade.id)}
                  className="absolute top-2 right-2 p-1.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground z-10"
                >
                  <Trash2 size={14} />
                </button>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs border",
                    trade.outcome === "Win" ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"
                  )}>
                    {trade.pair ? trade.pair.substring(0, 3) : "???"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-foreground group-hover:text-primary transition-colors">{trade.pair || "Unknown"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase flex items-center gap-2">
                      {trade.source === "MT5" ? <span className="text-primary font-bold">MT5 SYNCED</span> : <span className="opacity-50 text-muted-foreground">MANUAL</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-end gap-10">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">P&L</div>
                    <div className={cn(
                      "text-xl font-black font-mono",
                      parseFloat(trade.netPl) >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {trade.netPl !== 0 ? `$${parseFloat(trade.netPl).toFixed(2)}` : "-"}
                    </div>
                  </div>
                  <div className="text-right w-24">
                    <div className={cn(
                      "text-[10px] font-bold px-3 py-1 rounded-full border text-center uppercase tracking-tighter",
                      trade.outcome === "Win" ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                      {trade.outcome}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
