import { useState } from "react";
import { Calculator, Target, TrendingDown, DollarSign, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CalculatorCategory = "risk" | "planning" | "discipline";

interface CalculatorInput {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  suffix?: string;
  prefix?: string;
}

function CalculatorField({ label, value, onChange, type = "number", step, suffix, prefix }: CalculatorInput) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">{prefix}</span>
        )}
        <input 
          type={type}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full bg-background border border-border rounded-lg px-4 py-3 text-lg text-foreground font-black font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all",
            prefix && "pl-8",
            suffix && "pr-12"
          )}
          data-testid={`input-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, value, variant = "default", large = false }: { label: string; value: string; variant?: "default" | "success" | "danger" | "warning"; large?: boolean }) {
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
  const testId = `result-${label.toLowerCase().replace(/[\s\/]+/g, '-')}`;
  return (
    <div className={cn("p-4 rounded-lg border", variantStyles[variant])} data-testid={testId}>
      <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</span>
      <span className={cn("font-black font-mono", textStyles[variant], large ? "text-3xl" : "text-xl")} data-testid={`${testId}-value`}>{value}</span>
    </div>
  );
}

function PositionSizeCalculator() {
  const [accountSize, setAccountSize] = useState<string>("10000");
  const [riskPercent, setRiskPercent] = useState<string>("1.0");
  const [stopLossPips, setStopLossPips] = useState<string>("10");

  const riskAmount = (parseFloat(accountSize) * parseFloat(riskPercent)) / 100;
  const standardLotPipValue = 10;
  const lotSize = parseFloat(stopLossPips) > 0 ? (riskAmount / (parseFloat(stopLossPips) * standardLotPipValue)).toFixed(2) : "0.00";

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Calculator size={20} className="text-emerald-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Position Size Calculator</CardTitle>
            <p className="text-xs text-muted-foreground">Calculate lot size based on risk tolerance</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CalculatorField label="Account Balance" value={accountSize} onChange={setAccountSize} prefix="$" />
        <div className="grid grid-cols-2 gap-4">
          <CalculatorField label="Risk %" value={riskPercent} onChange={setRiskPercent} step="0.1" suffix="%" />
          <CalculatorField label="Stop Loss (Pips)" value={stopLossPips} onChange={setStopLossPips} />
        </div>
        <div className="h-px bg-border my-2" />
        <div className="grid grid-cols-2 gap-4">
          <ResultCard label="Risk Amount" value={`$${riskAmount.toFixed(2)}`} variant="danger" />
          <ResultCard label="Position Size" value={`${lotSize} lots`} variant="success" large />
        </div>
      </CardContent>
    </Card>
  );
}

function RiskRewardCalculator() {
  const [entryPrice, setEntryPrice] = useState<string>("1.0850");
  const [stopLoss, setStopLoss] = useState<string>("1.0800");
  const [takeProfit, setTakeProfit] = useState<string>("1.0950");
  const [positionSize, setPositionSize] = useState<string>("1.0");

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
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Target size={20} className="text-cyan-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Risk-Reward Calculator</CardTitle>
            <p className="text-xs text-muted-foreground">Evaluate trade expectancy before execution</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CalculatorField label="Entry Price" value={entryPrice} onChange={setEntryPrice} step="0.0001" />
        <div className="grid grid-cols-2 gap-4">
          <CalculatorField label="Stop Loss" value={stopLoss} onChange={setStopLoss} step="0.0001" />
          <CalculatorField label="Take Profit" value={takeProfit} onChange={setTakeProfit} step="0.0001" />
        </div>
        <CalculatorField label="Position Size (Lots)" value={positionSize} onChange={setPositionSize} step="0.01" />
        <div className="h-px bg-border my-2" />
        <div className="grid grid-cols-3 gap-4">
          <ResultCard label="Risk" value={`$${riskDollars.toFixed(2)}`} variant="danger" />
          <ResultCard label="Reward" value={`$${rewardDollars.toFixed(2)}`} variant="success" />
          <ResultCard label="R:R Ratio" value={`${rrRatio}:1`} variant={rrVariant} large />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className={cn(
            parseFloat(rrRatio) >= 2 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
            parseFloat(rrRatio) >= 1 ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
            "bg-destructive/10 text-destructive border-destructive/30"
          )}>
            {parseFloat(rrRatio) >= 2 ? "Good Setup" : parseFloat(rrRatio) >= 1 ? "Acceptable" : "High Risk"}
          </Badge>
          <span>{riskPips.toFixed(1)} pips risk for {rewardPips.toFixed(1)} pips reward</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TradeOutcomeCalculator() {
  const [accountBalance, setAccountBalance] = useState<string>("10000");
  const [positionSize, setPositionSize] = useState<string>("1.0");
  const [entryPrice, setEntryPrice] = useState<string>("1.0850");
  const [exitPrice, setExitPrice] = useState<string>("1.0900");
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
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <DollarSign size={20} className="text-violet-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Trade Outcome Calculator</CardTitle>
            <p className="text-xs text-muted-foreground">Simulate P&L before you execute</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CalculatorField label="Account Balance" value={accountBalance} onChange={setAccountBalance} prefix="$" />
        <CalculatorField label="Position Size (Lots)" value={positionSize} onChange={setPositionSize} step="0.01" />
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Direction</label>
          <div className="flex gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "cursor-pointer px-4 py-2 toggle-elevate",
                direction === "long" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 toggle-elevated"
              )}
              onClick={() => setDirection("long")}
              data-testid="badge-direction-long"
            >
              Long
            </Badge>
            <Badge 
              variant="outline" 
              className={cn(
                "cursor-pointer px-4 py-2 toggle-elevate",
                direction === "short" && "bg-rose-500/10 text-rose-500 border-rose-500/30 toggle-elevated"
              )}
              onClick={() => setDirection("short")}
              data-testid="badge-direction-short"
            >
              Short
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CalculatorField label="Entry Price" value={entryPrice} onChange={setEntryPrice} step="0.0001" />
          <CalculatorField label="Exit Price" value={exitPrice} onChange={setExitPrice} step="0.0001" />
        </div>
        <div className="h-px bg-border my-2" />
        <div className="grid grid-cols-2 gap-4">
          <ResultCard 
            label="Profit / Loss" 
            value={`${isProfit ? '+' : ''}$${profitLoss.toFixed(2)}`} 
            variant={isProfit ? "success" : "danger"} 
            large 
          />
          <ResultCard 
            label="Account Change" 
            value={`${isProfit ? '+' : ''}${percentChange.toFixed(2)}%`} 
            variant={isProfit ? "success" : "danger"} 
          />
        </div>
        <p className="text-xs text-muted-foreground text-center" data-testid="text-pips-summary">
          {Math.abs(pipDiff).toFixed(1)} pips {isProfit ? 'gained' : 'lost'} ({direction}) at {lots} lot{lots !== 1 ? 's' : ''}
        </p>
      </CardContent>
    </Card>
  );
}

function DrawdownCalculator() {
  const [accountBalance, setAccountBalance] = useState<string>("10000");
  const [drawdownPercent, setDrawdownPercent] = useState<string>("20");

  const balance = parseFloat(accountBalance);
  const drawdown = parseFloat(drawdownPercent);
  
  const remainingBalance = balance * (1 - drawdown / 100);
  const recoveryPercent = drawdown > 0 && drawdown < 100 
    ? ((balance / remainingBalance) - 1) * 100 
    : 0;

  const drawdownExamples = [
    { percent: 10, recovery: 11.1 },
    { percent: 20, recovery: 25.0 },
    { percent: 30, recovery: 42.9 },
    { percent: 40, recovery: 66.7 },
    { percent: 50, recovery: 100.0 },
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
            <TrendingDown size={20} className="text-rose-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Drawdown Calculator</CardTitle>
            <p className="text-xs text-muted-foreground">Understand how losses compound against you</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CalculatorField label="Account Balance" value={accountBalance} onChange={setAccountBalance} prefix="$" />
        <CalculatorField label="Drawdown %" value={drawdownPercent} onChange={setDrawdownPercent} step="1" suffix="%" />
        <div className="h-px bg-border my-2" />
        <div className="grid grid-cols-2 gap-4">
          <ResultCard label="Remaining Balance" value={`$${remainingBalance.toFixed(2)}`} variant="danger" />
          <ResultCard label="To Recover" value={`${recoveryPercent.toFixed(1)}%`} variant="warning" large />
        </div>
        <div className="bg-muted/20 rounded-lg p-4 border border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Recovery Reference</p>
          <div className="space-y-2">
            {drawdownExamples.map((ex) => (
              <div key={ex.percent} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">-{ex.percent}% drawdown</span>
                <ChevronRight size={14} className="text-muted-foreground" />
                <span className="font-mono font-semibold text-foreground">+{ex.recovery}% to recover</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center italic">
          The deeper you fall, the harder you climb.
        </p>
      </CardContent>
    </Card>
  );
}

function RuleViolationCalculator() {
  const [avgLoss, setAvgLoss] = useState<string>("100");
  const [violationsPerMonth, setViolationsPerMonth] = useState<string>("4");

  const loss = parseFloat(avgLoss);
  const violations = parseFloat(violationsPerMonth);
  
  const monthlyCost = loss * violations;
  const annualCost = monthlyCost * 12;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Rule Violation Cost</CardTitle>
            <p className="text-xs text-muted-foreground">The true price of breaking your rules</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CalculatorField label="Average Loss per Violation" value={avgLoss} onChange={setAvgLoss} prefix="$" />
        <CalculatorField label="Violations per Month" value={violationsPerMonth} onChange={setViolationsPerMonth} />
        <div className="h-px bg-border my-2" />
        <div className="grid grid-cols-2 gap-4">
          <ResultCard label="Monthly Cost" value={`$${monthlyCost.toFixed(2)}`} variant="danger" />
          <ResultCard label="Annual Cost" value={`$${annualCost.toFixed(2)}`} variant="danger" large />
        </div>
        <div className="bg-amber-500/5 rounded-lg p-4 border border-amber-500/20">
          <p className="text-sm text-foreground">
            <span className="font-bold">Breaking your rules {violations} times/month</span> costs you{' '}
            <span className="font-mono font-bold text-amber-500">${annualCost.toFixed(0)}</span> per year.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Discipline is not optional—it's profitable.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RiskCalculator() {
  const [activeCategory, setActiveCategory] = useState<CalculatorCategory>("risk");

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background min-h-screen">
      <main className="p-6 lg:p-10 max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-foreground tracking-tight uppercase italic">Calculators</h1>
          <p className="text-muted-foreground mt-2">Quantify risk, discipline, and exposure. No guessing—just math.</p>
        </header>

        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as CalculatorCategory)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger 
              value="risk" 
              className="py-3 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500"
              data-testid="tab-risk-positioning"
            >
              <Calculator size={16} className="mr-2" />
              Risk & Position
            </TabsTrigger>
            <TabsTrigger 
              value="planning" 
              className="py-3 data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-500"
              data-testid="tab-trade-planning"
            >
              <Target size={16} className="mr-2" />
              Trade Planning
            </TabsTrigger>
            <TabsTrigger 
              value="discipline" 
              className="py-3 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              data-testid="tab-discipline"
            >
              <AlertTriangle size={16} className="mr-2" />
              Discipline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="risk" className="space-y-6">
            <PositionSizeCalculator />
          </TabsContent>

          <TabsContent value="planning" className="space-y-6">
            <RiskRewardCalculator />
            <TradeOutcomeCalculator />
          </TabsContent>

          <TabsContent value="discipline" className="space-y-6">
            <DrawdownCalculator />
            <RuleViolationCalculator />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
