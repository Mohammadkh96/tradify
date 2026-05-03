import { useEffect, useState } from "react";
import { Plus, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "NAS100", "US30", "SPX500", "OIL"];
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];

interface QuickTrade {
  pair: string;
  customPair: string;
  direction: "Buy" | "Sell";
  timeframe: string;
  outcome: "Win" | "Loss" | "Breakeven";
  netPl: string;
  notes: string;
}

const DEFAULT: QuickTrade = {
  pair: "EURUSD", customPair: "", direction: "Buy", timeframe: "H1", outcome: "Win", netPl: "", notes: "",
};

export default function QuickAddTradeFab() {
  const [open, setOpen] = useState(false);
  const [trade, setTrade] = useState<QuickTrade>(DEFAULT);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Press "n" anywhere outside an input to open. Escape closes (handled by Dialog).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const create = useMutation({
    mutationFn: async () => {
      const pair = trade.pair === "__custom__" ? trade.customPair.trim().toUpperCase() : trade.pair;
      if (!pair) throw new Error("Please enter an instrument symbol");
      const body = {
        pair,
        direction: trade.direction,
        timeframe: trade.timeframe,
        // Quick add defaults — full discipline checks happen in the full form.
        htfBias: "Neutral",
        htfBiasClear: true,
        zoneValid: true,
        zoneValidity: "Valid",
        liquidityTaken: true,
        liquidityStatus: "Taken",
        structureConfirmed: true,
        structureState: "BOS",
        entryConfirmed: true,
        outcome: trade.outcome,
        netPl: trade.netPl || undefined,
        notes: trade.notes || undefined,
        isRuleCompliant: true,
      };
      return (await apiRequest("POST", "/api/trades", body)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/heatmap"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Trade logged", description: "Saved to your journal." });
      setTrade(DEFAULT);
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Could not save trade", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-2xl shadow-emerald-500/30"
        title="Quick add trade  ·  press N"
        data-testid="button-quick-add-trade-fab"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]" data-testid="dialog-quick-add-trade">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-emerald-500" />Quick add trade</DialogTitle>
            <DialogDescription>The fast path. For a full discipline checklist, open the journal.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Instrument</Label>
                <Select value={trade.pair} onValueChange={(v) => setTrade(t => ({ ...t, pair: v }))}>
                  <SelectTrigger data-testid="select-quick-pair"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAIRS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <SelectItem value="__custom__">Other…</SelectItem>
                  </SelectContent>
                </Select>
                {trade.pair === "__custom__" && (
                  <Input
                    value={trade.customPair}
                    onChange={(e) => setTrade(t => ({ ...t, customPair: e.target.value }))}
                    placeholder="e.g. NZDCAD"
                    className="mt-2"
                    data-testid="input-quick-custom-pair"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Timeframe</Label>
                <Select value={trade.timeframe} onValueChange={(v) => setTrade(t => ({ ...t, timeframe: v }))}>
                  <SelectTrigger data-testid="select-quick-timeframe"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMEFRAMES.map(tf => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Direction</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={trade.direction === "Buy" ? "default" : "outline"}
                  className={trade.direction === "Buy" ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                  onClick={() => setTrade(t => ({ ...t, direction: "Buy" }))}
                  data-testid="button-quick-direction-buy"
                ><TrendingUp className="h-4 w-4 mr-2" />Buy</Button>
                <Button
                  type="button"
                  variant={trade.direction === "Sell" ? "default" : "outline"}
                  className={trade.direction === "Sell" ? "bg-rose-500 hover:bg-rose-600" : ""}
                  onClick={() => setTrade(t => ({ ...t, direction: "Sell" }))}
                  data-testid="button-quick-direction-sell"
                ><TrendingDown className="h-4 w-4 mr-2" />Sell</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Outcome</Label>
                <Select value={trade.outcome} onValueChange={(v) => setTrade(t => ({ ...t, outcome: v as any }))}>
                  <SelectTrigger data-testid="select-quick-outcome"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Win">Win</SelectItem>
                    <SelectItem value="Loss">Loss</SelectItem>
                    <SelectItem value="Breakeven">Breakeven</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Net P/L</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={trade.netPl}
                  onChange={(e) => setTrade(t => ({ ...t, netPl: e.target.value }))}
                  placeholder="e.g. 124.50"
                  data-testid="input-quick-netpl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
              <Textarea
                value={trade.notes}
                onChange={(e) => setTrade(t => ({ ...t, notes: e.target.value }))}
                placeholder="What was the setup, the emotion, the lesson?"
                rows={2}
                data-testid="textarea-quick-notes"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => { setOpen(false); setLocation("/journal"); }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
                data-testid="link-quick-open-full-journal"
              >
                Open full journal →
              </button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)} data-testid="button-quick-cancel">Cancel</Button>
                <Button
                  onClick={() => create.mutate()}
                  disabled={create.isPending}
                  className="bg-emerald-500 hover:bg-emerald-600"
                  data-testid="button-quick-save"
                >
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save trade
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
