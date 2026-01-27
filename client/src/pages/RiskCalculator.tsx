import { useState } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RiskCalculator() {
  const [accountSize, setAccountSize] = useState<string>("10000");
  const [riskPercent, setRiskPercent] = useState<string>("1.0");
  const [stopLossPips, setStopLossPips] = useState<string>("10");

  const riskAmount = (parseFloat(accountSize) * parseFloat(riskPercent)) / 100;
  const standardLotPipValue = 10;
  const lotSize = parseFloat(stopLossPips) > 0 ? (riskAmount / (parseFloat(stopLossPips) * standardLotPipValue)).toFixed(2) : "0.00";

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background min-h-screen">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md">
          <header className="mb-8 text-center">
            <div className="inline-flex p-4 bg-emerald-500/10 rounded-2xl mb-4 text-emerald-500">
              <Calculator size={48} />
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight uppercase italic">Position Sizer</h1>
            <p className="text-muted-foreground mt-2 font-medium">Protect your capital. Calculate precision.</p>
          </header>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-700" />

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Account Balance ($)</label>
                <input 
                  type="number"
                  value={accountSize}
                  onChange={(e) => setAccountSize(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-lg text-foreground font-black font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Risk %</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-lg text-foreground font-black font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Stop Loss (Pips)</label>
                  <input 
                    type="number"
                    value={stopLossPips}
                    onChange={(e) => setStopLossPips(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-lg text-foreground font-black font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="h-px bg-border my-4" />

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-4 rounded-lg border border-border">
                  <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Risk Amount</span>
                  <span className="text-xl font-black font-mono text-destructive">${riskAmount.toFixed(2)}</span>
                </div>
                <div className="bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/20">
                  <span className="block text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Position Size (Lots)</span>
                  <span className="text-3xl font-black font-mono text-emerald-500">{lotSize}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
