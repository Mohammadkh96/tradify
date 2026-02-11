import { useState, useEffect, useRef } from "react";
import { Calculator, Target, TrendingDown, DollarSign, AlertTriangle, ChevronRight, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

type CalculatorTab = "position" | "rr" | "outcome" | "drawdown" | "violation";

interface CalculatorInput {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  suffix?: string;
  prefix?: string;
}

function CalcField({ label, value, onChange, type = "number", step, suffix, prefix }: CalculatorInput) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">{prefix}</span>
        )}
        <input
          type={type}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground font-bold font-mono focus:ring-1 focus:ring-primary/30 outline-none transition-all",
            prefix && "pl-7",
            suffix && "pr-10"
          )}
          data-testid={`calc-input-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function CalcResult({ label, value, variant = "default", large = false }: { label: string; value: string; variant?: "default" | "success" | "danger" | "warning"; large?: boolean }) {
  const variantStyles = {
    default: "bg-muted/30 border-border",
    success: "bg-emerald-500/5 border-emerald-500/20",
    danger: "bg-destructive/5 border-destructive/20",
    warning: "bg-amber-500/5 border-amber-500/20",
  };
  const textStyles = {
    default: "text-foreground",
    success: "text-emerald-500",
    danger: "text-destructive",
    warning: "text-amber-500",
  };
  return (
    <div className={cn("p-2.5 rounded-md border", variantStyles[variant])} data-testid={`calc-result-${label.toLowerCase().replace(/[\s\/]+/g, '-')}`}>
      <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">{label}</span>
      <span className={cn("font-black font-mono", textStyles[variant], large ? "text-xl" : "text-base")}>{value}</span>
    </div>
  );
}

function PositionSizeCalc() {
  const [accountSize, setAccountSize] = useState("10000");
  const [riskPercent, setRiskPercent] = useState("1.0");
  const [stopLossPips, setStopLossPips] = useState("10");

  const riskAmount = (parseFloat(accountSize) * parseFloat(riskPercent)) / 100;
  const standardLotPipValue = 10;
  const lotSize = parseFloat(stopLossPips) > 0 ? (riskAmount / (parseFloat(stopLossPips) * standardLotPipValue)).toFixed(2) : "0.00";

  return (
    <div className="space-y-3">
      <CalcField label="Account Balance" value={accountSize} onChange={setAccountSize} prefix="$" />
      <div className="grid grid-cols-2 gap-3">
        <CalcField label="Risk %" value={riskPercent} onChange={setRiskPercent} step="0.1" suffix="%" />
        <CalcField label="Stop Loss (Pips)" value={stopLossPips} onChange={setStopLossPips} />
      </div>
      <div className="h-px bg-border" />
      <div className="grid grid-cols-2 gap-3">
        <CalcResult label="Risk Amount" value={`$${riskAmount.toFixed(2)}`} variant="danger" />
        <CalcResult label="Position Size" value={`${lotSize} lots`} variant="success" large />
      </div>
    </div>
  );
}

function RiskRewardCalc() {
  const [entryPrice, setEntryPrice] = useState("1.0850");
  const [stopLoss, setStopLoss] = useState("1.0800");
  const [takeProfit, setTakeProfit] = useState("1.0950");
  const [positionSize, setPositionSize] = useState("1.0");

  const entry = parseFloat(entryPrice);
  const sl = parseFloat(stopLoss);
  const tp = parseFloat(takeProfit);
  const lots = parseFloat(positionSize);

  const riskPips = Math.abs(entry - sl) * 10000;
  const rewardPips = Math.abs(tp - entry) * 10000;
  const pipValue = 10;
  const riskDollars = riskPips * pipValue * lots;
  const rewardDollars = rewardPips * pipValue * lots;
  const rrRatio = riskPips > 0 ? (rewardPips / riskPips).toFixed(2) : "0.00";
  const rrVariant = parseFloat(rrRatio) >= 2 ? "success" : parseFloat(rrRatio) >= 1 ? "warning" : "danger";

  return (
    <div className="space-y-3">
      <CalcField label="Entry Price" value={entryPrice} onChange={setEntryPrice} step="0.0001" />
      <div className="grid grid-cols-2 gap-3">
        <CalcField label="Stop Loss" value={stopLoss} onChange={setStopLoss} step="0.0001" />
        <CalcField label="Take Profit" value={takeProfit} onChange={setTakeProfit} step="0.0001" />
      </div>
      <CalcField label="Position Size (Lots)" value={positionSize} onChange={setPositionSize} step="0.01" />
      <div className="h-px bg-border" />
      <div className="grid grid-cols-3 gap-2">
        <CalcResult label="Risk" value={`$${riskDollars.toFixed(2)}`} variant="danger" />
        <CalcResult label="Reward" value={`$${rewardDollars.toFixed(2)}`} variant="success" />
        <CalcResult label="R:R" value={`${rrRatio}:1`} variant={rrVariant} large />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className={cn(
          "text-[10px]",
          parseFloat(rrRatio) >= 2 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
          parseFloat(rrRatio) >= 1 ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
          "bg-destructive/10 text-destructive border-destructive/30"
        )}>
          {parseFloat(rrRatio) >= 2 ? "Good Setup" : parseFloat(rrRatio) >= 1 ? "Acceptable" : "High Risk"}
        </Badge>
        <span className="text-[10px]">{riskPips.toFixed(1)} pips risk / {rewardPips.toFixed(1)} reward</span>
      </div>
    </div>
  );
}

function TradeOutcomeCalc() {
  const [accountBalance, setAccountBalance] = useState("10000");
  const [positionSize, setPositionSize] = useState("1.0");
  const [entryPrice, setEntryPrice] = useState("1.0850");
  const [exitPrice, setExitPrice] = useState("1.0900");
  const [direction, setDirection] = useState<"long" | "short">("long");

  const entry = parseFloat(entryPrice);
  const exit = parseFloat(exitPrice);
  const lots = parseFloat(positionSize);
  const balance = parseFloat(accountBalance);

  const priceDiff = direction === "long" ? (exit - entry) : (entry - exit);
  const pipDiff = priceDiff * 10000;
  const pipValue = 10;
  const profitLoss = pipDiff * pipValue * lots;
  const percentChange = balance > 0 ? (profitLoss / balance) * 100 : 0;
  const isProfit = profitLoss >= 0;

  return (
    <div className="space-y-3">
      <CalcField label="Account Balance" value={accountBalance} onChange={setAccountBalance} prefix="$" />
      <CalcField label="Position Size (Lots)" value={positionSize} onChange={setPositionSize} step="0.01" />
      <div className="space-y-1">
        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Direction</label>
        <div className="flex gap-2">
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer px-3 py-1.5 toggle-elevate text-xs",
              direction === "long" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 toggle-elevated"
            )}
            onClick={() => setDirection("long")}
            data-testid="calc-direction-long"
          >
            Long
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer px-3 py-1.5 toggle-elevate text-xs",
              direction === "short" && "bg-rose-500/10 text-rose-500 border-rose-500/30 toggle-elevated"
            )}
            onClick={() => setDirection("short")}
            data-testid="calc-direction-short"
          >
            Short
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CalcField label="Entry Price" value={entryPrice} onChange={setEntryPrice} step="0.0001" />
        <CalcField label="Exit Price" value={exitPrice} onChange={setExitPrice} step="0.0001" />
      </div>
      <div className="h-px bg-border" />
      <div className="grid grid-cols-2 gap-3">
        <CalcResult label="P/L" value={`${isProfit ? '+' : ''}$${profitLoss.toFixed(2)}`} variant={isProfit ? "success" : "danger"} large />
        <CalcResult label="Account Change" value={`${isProfit ? '+' : ''}${percentChange.toFixed(2)}%`} variant={isProfit ? "success" : "danger"} />
      </div>
    </div>
  );
}

function DrawdownCalc() {
  const [accountBalance, setAccountBalance] = useState("10000");
  const [drawdownPercent, setDrawdownPercent] = useState("20");

  const balance = parseFloat(accountBalance);
  const drawdown = parseFloat(drawdownPercent);
  const remainingBalance = balance * (1 - drawdown / 100);
  const recoveryPercent = drawdown > 0 && drawdown < 100 ? ((balance / remainingBalance) - 1) * 100 : 0;

  const examples = [
    { percent: 10, recovery: 11.1 },
    { percent: 20, recovery: 25.0 },
    { percent: 30, recovery: 42.9 },
    { percent: 50, recovery: 100.0 },
  ];

  return (
    <div className="space-y-3">
      <CalcField label="Account Balance" value={accountBalance} onChange={setAccountBalance} prefix="$" />
      <CalcField label="Drawdown %" value={drawdownPercent} onChange={setDrawdownPercent} step="1" suffix="%" />
      <div className="h-px bg-border" />
      <div className="grid grid-cols-2 gap-3">
        <CalcResult label="Remaining" value={`$${remainingBalance.toFixed(2)}`} variant="danger" />
        <CalcResult label="To Recover" value={`${recoveryPercent.toFixed(1)}%`} variant="warning" large />
      </div>
      <div className="bg-muted/20 rounded-md p-3 border border-border">
        <p className="text-[9px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Recovery Reference</p>
        <div className="space-y-1.5">
          {examples.map((ex) => (
            <div key={ex.percent} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">-{ex.percent}%</span>
              <ChevronRight size={10} className="text-muted-foreground" />
              <span className="font-mono font-semibold text-foreground">+{ex.recovery}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ViolationCalc() {
  const [avgLoss, setAvgLoss] = useState("100");
  const [violationsPerMonth, setViolationsPerMonth] = useState("4");

  const loss = parseFloat(avgLoss);
  const violations = parseFloat(violationsPerMonth);
  const monthlyCost = loss * violations;
  const annualCost = monthlyCost * 12;

  return (
    <div className="space-y-3">
      <CalcField label="Avg Loss per Violation" value={avgLoss} onChange={setAvgLoss} prefix="$" />
      <CalcField label="Violations / Month" value={violationsPerMonth} onChange={setViolationsPerMonth} />
      <div className="h-px bg-border" />
      <div className="grid grid-cols-2 gap-3">
        <CalcResult label="Monthly Cost" value={`$${monthlyCost.toFixed(2)}`} variant="danger" />
        <CalcResult label="Annual Cost" value={`$${annualCost.toFixed(2)}`} variant="danger" large />
      </div>
      <div className="bg-amber-500/5 rounded-md p-3 border border-amber-500/20">
        <p className="text-xs text-foreground">
          <span className="font-bold">{violations}x/month</span> = <span className="font-mono font-bold text-amber-500">${annualCost.toFixed(0)}</span>/year lost
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 italic">Discipline is not optional.</p>
      </div>
    </div>
  );
}

const tabs: { id: CalculatorTab; label: string; shortLabel: string; icon: typeof Calculator; color: string }[] = [
  { id: "position", label: "Position Size", shortLabel: "Size", icon: Calculator, color: "text-emerald-500" },
  { id: "rr", label: "Risk/Reward", shortLabel: "R:R", icon: Target, color: "text-cyan-500" },
  { id: "outcome", label: "Trade Outcome", shortLabel: "P/L", icon: DollarSign, color: "text-violet-500" },
  { id: "drawdown", label: "Drawdown", shortLabel: "DD", icon: TrendingDown, color: "text-rose-500" },
  { id: "violation", label: "Rule Cost", shortLabel: "Rules", icon: AlertTriangle, color: "text-amber-500" },
];

export function FloatingCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<CalculatorTab>("position");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        const fab = document.getElementById("calc-fab");
        if (fab && fab.contains(event.target as Node)) return;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setIsMinimized(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const activeTabData = tabs.find(t => t.id === activeTab)!;

  return (
    <>
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-20 right-4 md:right-6 z-[60] w-[360px] max-h-[calc(100vh-120px)] bg-card border border-border rounded-xl shadow-2xl shadow-black/20 flex flex-col overflow-visible"
            data-testid="floating-calculator-panel"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", 
                  activeTab === "position" ? "bg-emerald-500/10" :
                  activeTab === "rr" ? "bg-cyan-500/10" :
                  activeTab === "outcome" ? "bg-violet-500/10" :
                  activeTab === "drawdown" ? "bg-rose-500/10" : "bg-amber-500/10"
                )}>
                  <activeTabData.icon size={14} className={activeTabData.color} />
                </div>
                <span className="text-sm font-black uppercase tracking-tight text-foreground">{activeTabData.label}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsMinimized(true)}
                  data-testid="button-minimize-calculator"
                  className="h-7 w-7"
                >
                  <Minus size={14} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setIsOpen(false); setIsMinimized(false); }}
                  data-testid="button-close-calculator"
                  className="h-7 w-7"
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            <div className="flex gap-1 px-3 py-2 border-b border-border shrink-0 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-all",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    data-testid={`calc-tab-${tab.id}`}
                  >
                    <Icon size={12} className={isActive ? tab.color : ""} />
                    {tab.shortLabel}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              {activeTab === "position" && <PositionSizeCalc />}
              {activeTab === "rr" && <RiskRewardCalc />}
              {activeTab === "outcome" && <TradeOutcomeCalc />}
              {activeTab === "drawdown" && <DrawdownCalc />}
              {activeTab === "violation" && <ViolationCalc />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        id="calc-fab"
        onClick={() => {
          if (isMinimized) {
            setIsMinimized(false);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "fixed bottom-4 right-4 md:right-6 z-[60] h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-all",
          isOpen
            ? "bg-emerald-500 text-slate-950 shadow-emerald-500/30"
            : "bg-card border border-border text-emerald-500 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-emerald-500/30 hover:border-emerald-500/50"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-floating-calculator"
        aria-label="Toggle Calculator"
      >
        {isOpen ? <X size={20} strokeWidth={2.5} /> : <Calculator size={20} strokeWidth={2.5} />}
      </motion.button>
    </>
  );
}
