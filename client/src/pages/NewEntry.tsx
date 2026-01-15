import { useState } from "react";
import { useCreateTrade } from "@/hooks/use-trades";
import { Navigation, MobileNav } from "@/components/Navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertTradeSchema } from "@shared/schema";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useLocation } from "wouter";

// Need to handle number strings from inputs
const formSchema = insertTradeSchema.extend({
  entryPrice: z.string().optional(),
  stopLoss: z.string().optional(),
  takeProfit: z.string().optional(),
  riskReward: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewEntry() {
  const [, setLocation] = useLocation();
  const createTrade = useCreateTrade();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      direction: "Long",
      outcome: "Pending",
      htfBiasClear: false,
      zoneValid: false,
      liquidityTaken: false,
      structureConfirmed: false,
      entryConfirmed: false,
    }
  });

  // Watch critical checklist items for visual feedback
  const checklist = form.watch([
    "htfBiasClear", 
    "zoneValid", 
    "liquidityTaken", 
    "structureConfirmed", 
    "entryConfirmed"
  ]);
  
  const allChecksPassed = checklist.every(Boolean);

  const onSubmit = (data: FormValues) => {
    if (!allChecksPassed) {
      // Allow saving drafts, but maybe warn? 
      // For this app, let's enforce checklist discipline visually but allow submission
    }
    createTrade.mutate(data, {
      onSuccess: () => setLocation('/journal')
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20 md:pb-0">
      <Navigation />
      <MobileNav />
      
      <main className="md:ml-64 p-6 lg:p-10 max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">New Trade Entry</h1>
          <p className="text-slate-400 mt-1">Execute your edge with discipline.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Pair & Direction */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Pair / Asset</label>
                    <input 
                      {...form.register("pair")}
                      placeholder="EURUSD" 
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono uppercase"
                    />
                    {form.formState.errors.pair && (
                      <span className="text-xs text-rose-500">{form.formState.errors.pair.message}</span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Direction</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => form.setValue("direction", "Long")}
                        className={cn(
                          "py-3 rounded-lg font-bold transition-all border",
                          form.watch("direction") === "Long"
                            ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"
                        )}
                      >
                        LONG
                      </button>
                      <button
                        type="button"
                        onClick={() => form.setValue("direction", "Short")}
                        className={cn(
                          "py-3 rounded-lg font-bold transition-all border",
                          form.watch("direction") === "Short"
                            ? "bg-rose-500 text-white border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                            : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"
                        )}
                      >
                        SHORT
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Checklist - THE GATEKEEPER */}
              <div className={cn(
                "border rounded-xl p-6 transition-all duration-300",
                allChecksPassed 
                  ? "bg-emerald-950/20 border-emerald-900/50" 
                  : "bg-slate-900 border-slate-800"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle2 size={18} className={allChecksPassed ? "text-emerald-500" : "text-slate-500"} />
                    Execution Checklist
                  </h3>
                  {!allChecksPassed && (
                    <span className="text-xs font-bold text-rose-500 bg-rose-500/10 px-2 py-1 rounded animate-pulse">
                      NO TRADE
                    </span>
                  )}
                </div>
                
                <div className="space-y-3">
                  {[
                    { id: "htfBiasClear", label: "HTF Bias & Narrative Clear" },
                    { id: "zoneValid", label: "Price in Premium/Discount Zone" },
                    { id: "liquidityTaken", label: "Liquidity Sweep / Inducement" },
                    { id: "structureConfirmed", label: "Lower TF Structure Shift (MSS)" },
                    { id: "entryConfirmed", label: "Entry Model Confirmed (FVG/OB)" },
                  ].map((item) => (
                    <label 
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors group"
                    >
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox"
                          {...form.register(item.id as any)}
                          className="peer h-5 w-5 appearance-none rounded border border-slate-600 bg-slate-900 checked:bg-emerald-500 checked:border-emerald-500 transition-all"
                        />
                        <CheckCircle2 size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                      </div>
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Details */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Trade Parameters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">Entry</label>
                    <input 
                      type="number" step="0.00001"
                      {...form.register("entryPrice")}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">Stop Loss</label>
                    <input 
                      type="number" step="0.00001"
                      {...form.register("stopLoss")}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-rose-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-500 uppercase">Take Profit</label>
                    <input 
                      type="number" step="0.00001"
                      {...form.register("takeProfit")}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500 outline-none"
                    />
                  </div>
                  
                  <div className="space-y-2 sm:col-span-3">
                    <label className="text-xs font-medium text-slate-500 uppercase">Risk : Reward</label>
                    <input 
                      type="number" step="0.1"
                      {...form.register("riskReward")}
                      placeholder="e.g. 2.5"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
                <label className="text-sm font-medium text-slate-400 mb-2 block">Journal Notes</label>
                <textarea 
                  {...form.register("notes")}
                  className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-4 text-white resize-none focus:outline-none focus:border-emerald-500"
                  placeholder="Describe your thought process, emotions, and management..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={createTrade.isPending}
                  className={cn(
                    "flex-1 py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                    allChecksPassed
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-900/30"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  )}
                >
                  {createTrade.isPending ? "Logging Trade..." : allChecksPassed ? "Log Valid Trade" : "Complete Checklist First"}
                </button>
              </div>

            </form>
          </div>

          {/* Sidebar Guidelines */}
          <div className="space-y-6">
            <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-6">
              <div className="flex items-center gap-2 text-rose-500 mb-3">
                <AlertTriangle size={20} />
                <h3 className="font-bold">FORBIDDEN TRADES</h3>
              </div>
              <ul className="space-y-3 text-sm text-rose-200/70 list-disc list-inside">
                <li>No trade during high-impact news (±15 mins).</li>
                <li>Never trade against HTF structure without confirmation.</li>
                <li>Do not force trades in "choppy" price action.</li>
                <li>Never risk more than 1% per trade.</li>
                <li>No revenge trading after a loss.</li>
              </ul>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="font-semibold text-slate-300 mb-4">Mental Check</h3>
              <div className="space-y-4 text-sm text-slate-400">
                <p>Are you calm and focused?</p>
                <p>Are you accepting the risk fully before entering?</p>
                <p>Are you trying to be right, or trying to trade well?</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
