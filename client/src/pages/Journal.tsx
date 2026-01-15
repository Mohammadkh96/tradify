import { useTrades, useDeleteTrade } from "@/hooks/use-trades";
import { Navigation, MobileNav } from "@/components/Navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Trash2, Search, Filter } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Journal() {
  const { data: trades, isLoading } = useTrades();
  const deleteTrade = useDeleteTrade();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOutcome, setFilterOutcome] = useState<string>("all");

  const filteredTrades = trades?.filter(trade => {
    const matchesSearch = trade.pair.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterOutcome === "all" || trade.outcome === filterOutcome;
    return matchesSearch && matchesFilter;
  }) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Trade Journal</h1>
            <p className="text-slate-400 mt-1">Review your execution and outcomes</p>
          </div>
          <Link href="/new-entry">
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-emerald-900/20 transition-all active:scale-95">
              + New Entry
            </button>
          </Link>
        </header>

        {/* Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search pairs..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Filter size={16} className="text-slate-500 mr-2 flex-shrink-0" />
            {["all", "Win", "Loss", "BE", "Pending"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterOutcome(status)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-all whitespace-nowrap",
                  filterOutcome === status 
                    ? "bg-slate-800 border-slate-600 text-white" 
                    : "bg-transparent border-slate-800 text-slate-500 hover:border-slate-700"
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Trade Grid */}
        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="text-center py-20 text-slate-500">Loading journal entries...</div>
          ) : filteredTrades.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
              <p className="text-slate-500">No trades found matching criteria.</p>
            </div>
          ) : (
            filteredTrades.map((trade) => (
              <div 
                key={trade.id}
                className="group bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all flex flex-col md:flex-row gap-6 relative overflow-hidden"
              >
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  trade.outcome === "Win" ? "bg-emerald-500" : 
                  trade.outcome === "Loss" ? "bg-rose-500" :
                  trade.outcome === "BE" ? "bg-slate-500" : "bg-amber-500"
                )} />

                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold font-numeric text-white">{trade.pair}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider",
                        trade.direction === "Long" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      )}>
                        {trade.direction}
                      </span>
                      <span className="text-xs text-slate-500">
                        {trade.createdAt ? format(new Date(trade.createdAt), 'MMM d, yyyy • HH:mm') : ''}
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => {
                        if (confirm('Delete this trade?')) {
                          deleteTrade.mutate(trade.id);
                        }
                      }}
                      className="text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Checklist indicators - mini */}
                  <div className="flex gap-1.5 mb-4">
                    {[
                      { l: 'HTF', v: trade.htfBiasClear },
                      { l: 'Zone', v: trade.zoneValid },
                      { l: 'Liq', v: trade.liquidityTaken },
                      { l: 'Struct', v: trade.structureConfirmed },
                    ].map((item, idx) => (
                      <span 
                        key={idx}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border",
                          item.v 
                            ? "bg-slate-800/50 border-emerald-900/50 text-emerald-600" 
                            : "bg-slate-950 border-slate-800 text-slate-600 line-through decoration-slate-600"
                        )}
                      >
                        {item.l}
                      </span>
                    ))}
                  </div>

                  {trade.notes && (
                    <p className="text-sm text-slate-400 line-clamp-2">{trade.notes}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-8 md:border-l md:border-slate-800 md:pl-8 min-w-[200px]">
                  <div>
                    <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Risk:Reward</span>
                    <span className="text-lg font-mono text-white">{trade.riskReward || '-'}R</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Result</span>
                    <span className={cn(
                      "text-lg font-bold",
                      trade.outcome === "Win" && "text-emerald-500",
                      trade.outcome === "Loss" && "text-rose-500",
                      trade.outcome === "BE" && "text-slate-400",
                      trade.outcome === "Pending" && "text-amber-500",
                    )}>
                      {trade.outcome}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
