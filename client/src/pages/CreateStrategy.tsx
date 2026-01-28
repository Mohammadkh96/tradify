import { useState, useEffect, useRef } from "react";
import { useCreateTrade } from "@/hooks/use-trades";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertTradeSchema } from "@shared/schema";
import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2,
  TrendingUp,
  TrendingDown,
  Upload,
  X,
  ShieldAlert,
  Image as ImageIcon
} from "lucide-react";
import { useLocation } from "wouter";
import { api } from "@shared/routes";

const formSchema = insertTradeSchema.extend({
  entryPrice: z.string().optional(),
  stopLoss: z.string().optional(),
  takeProfit: z.string().optional(),
  riskReward: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateStrategy() {
  const [, setLocation] = useLocation();
  const createTrade = useCreateTrade();
  const [validation, setValidation] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      direction: "Long",
      outcome: "Pending",
      timeframe: "M15",
      htfBias: "Bullish",
      structureState: "None",
      liquidityStatus: "None",
      zoneValidity: "Valid",
      htfBiasClear: false,
      zoneValid: false,
      liquidityTaken: false,
      structureConfirmed: false,
      entryConfirmed: false,
    }
  });

  const formValues = form.watch();

  useEffect(() => {
    const validate = async () => {
      setIsValidating(true);
      try {
        const response = await fetch(api.trades.validate.path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues),
        });
        const result = await response.json();
        setValidation(result);
      } catch (error) {
        console.error("Validation failed", error);
      } finally {
        setIsValidating(false);
      }
    };

    const timeout = setTimeout(validate, 500);
    return () => clearTimeout(timeout);
  }, [formValues]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (data: FormValues) => {
    if (validation?.valid || confirm("Trade violates rules. Log anyway for review?")) {
      createTrade.mutate(data, {
        onSuccess: () => setLocation('/journal')
      });
    }
  };

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">New Trade Entry</h1>
            <p className="text-muted-foreground mt-1">Rule-based execution engine v1.0</p>
          </div>
          <div className="hidden lg:block">
            <div className={cn(
              "px-4 py-2 rounded-lg border flex items-center gap-3 transition-all duration-500",
              validation?.valid 
                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" 
                : "bg-destructive/10 border-destructive/50 text-destructive"
            )}>
              {isValidating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : validation?.valid ? (
                <CheckCircle2 size={18} />
              ) : (
                <XCircle size={18} />
              )}
              <span className="font-bold uppercase tracking-widest text-xs">
                {isValidating ? "Validating..." : validation?.valid ? "VALID SETUP" : "NO TRADE"}
              </span>
            </div>
          </div>
        </header>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {/* Core Parameters */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Asset Pair</label>
                  <input 
                    {...form.register("pair")}
                    placeholder="EURUSD" 
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono uppercase"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Timeframe</label>
                  <select 
                    {...form.register("timeframe")}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {["M1", "M5", "M15", "H1", "H4", "D1"].map(tf => (
                      <option key={tf} value={tf}>{tf}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Direction</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => form.setValue("direction", "Long")}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg font-bold transition-all border flex items-center justify-center gap-2",
                        form.watch("direction") === "Long"
                          ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20"
                          : "bg-background text-muted-foreground border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <TrendingUp size={16} /> LONG
                    </button>
                    <button
                      type="button"
                      onClick={() => form.setValue("direction", "Short")}
                      className={cn(
                        "flex-1 py-2.5 rounded-lg font-bold transition-all border flex items-center justify-center gap-2",
                        form.watch("direction") === "Short"
                          ? "bg-destructive text-white border-destructive shadow-lg shadow-destructive/20"
                          : "bg-background text-muted-foreground border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <TrendingDown size={16} /> SHORT
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Layer 2: Detection Rules */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                Layer 2: Detection Rules (Inputs)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">HTF Trend / Bias</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Bullish", "Bearish", "Range"].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => form.setValue("htfBias", val as any)}
                          className={cn(
                            "py-2 text-xs font-bold rounded border transition-colors",
                            form.watch("htfBias") === val 
                              ? "bg-accent border-accent-foreground/20 text-foreground" 
                              : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Structure State</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["BOS", "CHOCH", "None"].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => form.setValue("structureState", val as any)}
                          className={cn(
                            "py-2 text-xs font-bold rounded border transition-colors",
                            form.watch("structureState") === val 
                              ? "bg-accent border-accent-foreground/20 text-foreground" 
                              : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Liquidity Status</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Taken", "Pending", "None"].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => form.setValue("liquidityStatus", val as any)}
                          className={cn(
                            "py-2 text-xs font-bold rounded border transition-colors",
                            form.watch("liquidityStatus") === val 
                              ? "bg-accent border-accent-foreground/20 text-foreground" 
                              : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Zone Validity</label>
                    <div className="grid grid-cols-2 gap-2">
                      {["Valid", "Invalid"].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => form.setValue("zoneValidity", val as any)}
                          className={cn(
                            "py-2 text-xs font-bold rounded border transition-colors",
                            form.watch("zoneValidity") === val 
                              ? "bg-accent border-accent-foreground/20 text-foreground" 
                              : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Execution Checklist */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                Execution Checklist (Non-negotiables)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                {[
                  { id: "htfBiasClear", label: "HTF Bias clear & narrative confirmed" },
                  { id: "zoneValid", label: "Price currently in valid S/D zone" },
                  { id: "liquidityTaken", label: "Liquidity swept prior to entry" },
                  { id: "structureConfirmed", label: "Structure shift confirmed on LTF" },
                  { id: "entryConfirmed", label: "Entry confirmation model printed" },
                ].map((item) => (
                  <label 
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-muted-foreground/30 cursor-pointer transition-colors group"
                  >
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                    <div className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <input 
                        type="checkbox"
                        {...form.register(item.id as any)}
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-emerald-600" />
                      <div className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 shadow-sm" />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-6">Trade Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {["entryPrice", "stopLoss", "takeProfit", "riskReward"].map((field) => (
                  <div key={field} className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {field.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <input 
                      type="number" 
                      step="0.00001" 
                      {...form.register(field as any)} 
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <label className="text-sm font-bold text-foreground uppercase tracking-widest mb-4 block">Screenshot Reference</label>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group relative overflow-hidden",
                  previewUrl 
                    ? "border-emerald-500/50 bg-emerald-500/5" 
                    : "border-border bg-background hover:border-emerald-500/50 hover:bg-muted/30"
                )}
              >
                {previewUrl ? (
                  <div className="relative aspect-video w-full max-w-md mx-auto rounded-lg overflow-hidden border border-emerald-500/20 shadow-lg">
                    <img src={previewUrl} alt="Chart preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={clearImage}
                      className="absolute top-2 right-2 bg-destructive text-white p-1 rounded-full shadow-lg hover:bg-destructive/90 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="mx-auto text-muted-foreground group-hover:text-emerald-500 transition-colors mb-4" size={48} />
                    <div className="space-y-1">
                      <p className="text-sm text-foreground font-bold">Click to upload chart screenshot</p>
                      <p className="text-xs text-muted-foreground">Supports JPG, PNG, WEBP (Max 5MB)</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={createTrade.isPending}
              className={cn(
                "w-full py-5 rounded-xl font-bold text-xl shadow-2xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-3",
                validation?.valid
                  ? "bg-primary text-primary-foreground hover:shadow-primary/40"
                  : "bg-muted text-muted-foreground border border-border"
              )}
            >
              {createTrade.isPending ? <Loader2 className="animate-spin" /> : null}
              {validation?.valid ? "EXECUTE & LOG TRADE" : "RULES NOT MET - LOG ANYWAY?"}
            </button>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className={cn(
              "sticky top-10 border rounded-xl p-6 shadow-2xl transition-all duration-500",
              validation?.valid 
                ? "bg-emerald-500/5 border-emerald-500/30" 
                : "bg-destructive/5 border-destructive/30"
            )}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground">Rule Engine v1.0</h3>
                <div className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  validation?.valid ? "bg-emerald-500" : "bg-destructive"
                )} />
              </div>

              <div className="mb-8">
                <div className={cn(
                  "text-4xl font-black mb-2",
                  validation?.valid ? "text-emerald-500" : "text-destructive"
                )}>
                  {isValidating ? "..." : validation?.valid ? "TRADE" : "NO TRADE"}
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {isValidating ? "Processing inputs..." : validation?.valid ? "All criteria satisfied" : "Global hard rules violated"}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold border-b border-border pb-2">
                  <span className="text-muted-foreground uppercase tracking-widest">Strategy Match</span>
                  <span className="text-foreground">{validation?.matchedSetup || "None"}</span>
                </div>

                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Violations ({validation?.violations?.length || 0})</span>
                  {validation?.violations && validation.violations.length > 0 ? (
                    validation.violations.map((v: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-background border border-destructive/20 rounded-lg">
                        <XCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                        <span className="text-xs text-destructive font-mono leading-tight">{v}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-background border border-emerald-500/20 rounded-lg">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-xs text-emerald-500 font-mono leading-tight">Zero violations detected.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 p-4 bg-background rounded-lg border border-border shadow-inner">
                <div className="flex items-center gap-2 text-amber-500 mb-2">
                  <ShieldAlert size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Compliance Audit</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                  Deterministic engine output based on current market knowledge ruleset. No AI probabilistic guessing involved.
                </p>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
