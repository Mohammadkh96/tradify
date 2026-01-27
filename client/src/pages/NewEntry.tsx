import { useState, useEffect, useRef } from "react";
import { useCreateTrade } from "@/hooks/use-trades";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertTradeSchema, type ValidationResult } from "@shared/schema";
import { cn } from "@/lib/utils";
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ShieldAlert, 
  Image as ImageIcon,
  Loader2,
  TrendingUp,
  TrendingDown,
  Upload,
  X
} from "lucide-react";
import { useLocation } from "wouter";
import { api } from "@shared/routes";
import { Card } from "@/components/ui/card";

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
  const [validation, setValidation] = useState<ValidationResult | null>(null);
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
    <div className="flex-1 text-foreground pb-20 md:pb-0">
      <main className="p-6 lg:p-10 max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">New Trade Entry</h1>
            <p className="text-muted-foreground mt-1 text-sm">Rule-based execution engine v1.0</p>
          </div>
          <div className="hidden lg:block">
            <div className={cn(
              "px-4 py-2 rounded-lg border flex items-center gap-3 transition-all duration-500",
              validation?.valid 
                ? "bg-primary/10 border-primary/50 text-primary" 
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
            <Card className="bg-card border-border p-6 shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Asset Pair</label>
                  <input 
                    {...form.register("pair")}
                    placeholder="EURUSD" 
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono uppercase transition-colors"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Timeframe</label>
                  <select 
                    {...form.register("timeframe")}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors"
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
                          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
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
                          ? "bg-destructive text-destructive-foreground border-destructive shadow-lg shadow-destructive/20"
                          : "bg-background text-muted-foreground border-border hover:border-destructive/50"
                      )}
                    >
                      <TrendingDown size={16} /> SHORT
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border-border p-6 shadow-md">
              <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-primary rounded-full" />
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
                              ? "bg-muted border-border text-foreground" 
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
                              ? "bg-muted border-border text-foreground" 
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
            </Card>

            <button
              type="submit"
              disabled={createTrade.isPending}
              className={cn(
                "w-full py-5 rounded-xl font-bold text-xl shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-3",
                validation?.valid
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground border border-border"
              )}
            >
              {createTrade.isPending ? <Loader2 className="animate-spin" /> : null}
              {validation?.valid ? "EXECUTE & LOG TRADE" : "RULES NOT MET - LOG ANYWAY?"}
            </button>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className={cn(
              "sticky top-10 border rounded-xl p-6 shadow-xl transition-all duration-500",
              validation?.valid 
                ? "bg-primary/5 border-primary/20" 
                : "bg-destructive/5 border-destructive/20"
            )}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground">Rule Engine v1.0</h3>
                <div className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  validation?.valid ? "bg-primary" : "bg-destructive"
                )} />
              </div>

              <div className="mb-8">
                <div className={cn(
                  "text-4xl font-black mb-2 tracking-tighter",
                  validation?.valid ? "text-primary" : "text-destructive"
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
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
