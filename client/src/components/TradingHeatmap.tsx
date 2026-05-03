import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Cell = { trades: number; wins: number; netPl: number };
type HeatmapData = {
  grid: Cell[][]; // [day 0-6 (Sun)][hour 0-23]
  totalTrades: number;
  rangeDays: number;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function cellColor(cell: Cell, metric: "winrate" | "pnl" | "volume", maxVolume: number): string {
  if (cell.trades === 0) return "bg-muted/20";
  if (metric === "volume") {
    const ratio = cell.trades / Math.max(maxVolume, 1);
    if (ratio > 0.75) return "bg-emerald-500/80";
    if (ratio > 0.5) return "bg-emerald-500/60";
    if (ratio > 0.25) return "bg-emerald-500/40";
    return "bg-emerald-500/20";
  }
  if (metric === "winrate") {
    const wr = (cell.wins / cell.trades) * 100;
    if (wr >= 70) return "bg-emerald-500/80";
    if (wr >= 55) return "bg-emerald-500/50";
    if (wr >= 45) return "bg-amber-500/50";
    if (wr >= 30) return "bg-rose-500/50";
    return "bg-rose-500/80";
  }
  // pnl
  if (cell.netPl > 0) {
    if (cell.netPl > 500) return "bg-emerald-500/80";
    if (cell.netPl > 100) return "bg-emerald-500/60";
    return "bg-emerald-500/30";
  }
  if (cell.netPl < 0) {
    if (cell.netPl < -500) return "bg-rose-500/80";
    if (cell.netPl < -100) return "bg-rose-500/60";
    return "bg-rose-500/30";
  }
  return "bg-muted/40";
}

export default function TradingHeatmap() {
  const [metric, setMetric] = useState<"winrate" | "pnl" | "volume">("winrate");
  const { data, isLoading } = useQuery<HeatmapData>({ queryKey: ["/api/analytics/heatmap"] });

  if (isLoading) {
    return (
      <Card data-testid="card-heatmap">
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-emerald-500" />Trading Heatmap</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent>
      </Card>
    );
  }

  const grid = data?.grid || Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ trades: 0, wins: 0, netPl: 0 })));
  const maxVolume = Math.max(...grid.flat().map(c => c.trades), 1);
  const total = data?.totalTrades || 0;

  return (
    <TooltipProvider delayDuration={150}>
      <Card data-testid="card-heatmap">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-emerald-500" />Trading Heatmap</CardTitle>
              <CardDescription className="mt-1">
                When are you trading and how are those trades performing? {total > 0 ? `Last ${data?.rangeDays || 90} days, ${total} trades.` : "Log trades to see your patterns."}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {(["winrate", "pnl", "volume"] as const).map(m => (
                <Button
                  key={m}
                  size="sm"
                  variant={metric === m ? "default" : "outline"}
                  className={metric === m ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                  onClick={() => setMetric(m)}
                  data-testid={`button-heatmap-metric-${m}`}
                >
                  {m === "winrate" ? "Win rate" : m === "pnl" ? "Net P/L" : "Volume"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* hours header */}
              <div className="flex items-center gap-1 mb-1 pl-10">
                {HOURS.map(h => (
                  <div key={h} className="w-5 text-[9px] text-center text-muted-foreground font-mono">
                    {h % 3 === 0 ? h.toString().padStart(2, "0") : ""}
                  </div>
                ))}
              </div>
              {grid.map((row, dayIdx) => (
                <div key={dayIdx} className="flex items-center gap-1 mb-1">
                  <div className="w-9 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{DAYS[dayIdx]}</div>
                  {row.map((cell, hour) => {
                    const wr = cell.trades > 0 ? Math.round((cell.wins / cell.trades) * 100) : 0;
                    return (
                      <Tooltip key={hour}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-5 h-5 rounded-sm ${cellColor(cell, metric, maxVolume)} cursor-pointer transition-transform hover:scale-125`}
                            data-testid={`heatmap-cell-${dayIdx}-${hour}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-semibold">{DAYS[dayIdx]} {hour.toString().padStart(2, "0")}:00</div>
                          {cell.trades === 0 ? <div className="text-muted-foreground">No trades</div> : (
                            <>
                              <div>{cell.trades} trades · {wr}% win rate</div>
                              <div className={cell.netPl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                {cell.netPl >= 0 ? "+" : ""}{cell.netPl.toFixed(2)} net P/L
                              </div>
                            </>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
              <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                <span>Times in your local timezone</span>
                <div className="flex items-center gap-1">
                  <span>Less</span>
                  <div className="w-3 h-3 rounded-sm bg-muted/20" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-500/20" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-500/40" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-500/80" />
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
