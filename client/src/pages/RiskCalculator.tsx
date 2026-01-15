import { useState } from "react";
import { Navigation, MobileNav } from "@/components/Navigation";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RiskCalculator() {
  const [accountSize, setAccountSize] = useState<string>("10000");
  const [riskPercent, setRiskPercent] = useState<string>("1.0");
  const [stopLossPips, setStopLossPips] = useState<string>("10");
  const [pair, setPair] = useState("EURUSD");

  const riskAmount = (parseFloat(accountSize) * parseFloat(riskPercent)) / 100;
  // Simplified calculation (assuming $10/lot for majors approx)
  // Lot Size = RiskAmount / (SL * PipValue)
  // Assuming standard lot pip value = $10
  const standardLotPipValue = 10;
  const lotSize = parseFloat(stopLossPips) > 0 ? (riskAmount / (parseFloat(stopLossPips) * standardLotPipValue)).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-md">
          <header className="mb-8 text-center">
            <div className="inline-flex p-4 bg-emerald-500/10 rounded-2xl mb-4 text-emerald-500">
              <Calculator size={48} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Position Sizer</h1>
            <p className="text-slate-400 mt-2">Protect your capital. Calculate precision.</p>
          </header>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl relative overflow-hidden">
             {/* Gradient Accent Top */}
             <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-700" />

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase">Account Balance ($)</label>
                <input 
                  type="number"
                  value={accountSize}
                  onChange={(e) => setAccountSize(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-lg text-white font-mono focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase">Risk %</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-lg text-white font-mono focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase">Stop Loss (Pips)</label>
                  <input 
                    type="number"
                    value={stopLossPips}
                    onChange={(e) => setStopLossPips(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-lg text-white font-mono focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="h-px bg-slate-800 my-4" />

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                  <span className="block text-xs text-slate-500 mb-1">Risk Amount</span>
                  <span className="text-xl font-mono text-rose-500">${riskAmount.toFixed(2)}</span>
                </div>
                <div className="bg-emerald-950/20 p-4 rounded-lg border border-emerald-900/30">
                  <span className="block text-xs text-emerald-500/70 mb-1">Position Size (Lots)</span>
                  <span className="text-3xl font-bold font-mono text-emerald-400">{lotSize}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
