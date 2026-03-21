import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Target,
  TrendingDown,
  TrendingUp,
  Calendar,
  Clock,
  ShieldCheck,
  Plus,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  BarChart3,
  Loader2,
  Trash2,
  Activity,
  AlertTriangle,
  Brain,
  ShieldAlert,
  Info,
  Zap,
  OctagonAlert,
  History,
  Lock,
  DollarSign,
  Award,
  Gauge,
  Link2,
  Wifi,
  WifiOff,
  Monitor,
  Share2,
} from "lucide-react";
import type { PropFirmChallenge, PropFirmDailyStat } from "@shared/schema";
import { MilestoneShareModal } from "@/components/MilestoneShareModal";
import type { ChallengeCardData } from "@/components/MilestoneShareCard";

type ViewState = "list" | "create" | "detail";

type RuleEvent = {
  date: string;
  event: string;
  severity: string;
};

type ChallengeProgress = {
  currentBalance: number;
  currentProfit: number;
  profitTargetAmount: number;
  profitProgress: number;
  highWaterMark: number;
  trailingDDFloor: number;
  maxDDRemaining: number;
  maxDDUsedPercent: number;
  dailyDDUsedPercent: number;
  dailyDDRemaining: number;
  dailyDDAmount: number;
  dailyStartBalance: number;
  uniqueTradingDays: number;
  minTradingDays: number;
  daysElapsed: number;
  daysRemaining: number | null;
  consistencyScore: number;
  worstDayProfitPercent: number;
  consistencyTodayUsed: number;
  consistencyMaxAllowedAmount: number;
  todayPl: number;
  distanceToProfitTarget: number;
  distanceToMaxLoss: number;
  distanceToDailyDDLimit: number;
  healthStatus: "healthy" | "caution" | "at_risk";
  healthMessage: string;
  passEligible: boolean;
  failTriggered: boolean;
  profitTargetMet: boolean;
  minDaysMet: boolean;
  ruleEvents: RuleEvent[];
  status: string;
};

type ChallengeDetail = {
  challenge: PropFirmChallenge;
  dailyStats: PropFirmDailyStat[];
  progress: ChallengeProgress;
};

type MT5AccountInfo = {
  accountNumber: string;
  accountName: string;
  broker: string | null;
  server: string | null;
  currency: string;
  isActive: boolean;
  balance: string | null;
  equity: string | null;
  lastSync: string | null;
  isOnline: boolean;
};

const PRESETS: Record<string, Partial<Record<string, any>>> = {
  FTMO: {
    firmName: "FTMO",
    accountSize: "100000",
    profitTarget: "10",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "10",
    trailingDrawdown: false,
    drawdownType: "balance",
    minTradingDays: 4,
    maxTradingDays: 30,
    consistencyRule: false,
  },
  MyFundedFX: {
    firmName: "MyFundedFX",
    accountSize: "100000",
    profitTarget: "8",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "8",
    trailingDrawdown: true,
    drawdownType: "trailing_balance",
    trailingStopBehavior: "locks_at_breakeven",
    minTradingDays: 5,
    maxTradingDays: 30,
    consistencyRule: false,
  },
  "The Funded Trader": {
    firmName: "The Funded Trader",
    accountSize: "100000",
    profitTarget: "8",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "10",
    trailingDrawdown: true,
    drawdownType: "trailing_equity",
    trailingStopBehavior: "always_trails",
    minTradingDays: 5,
    maxTradingDays: 30,
    consistencyRule: true,
    maxDayProfitPercent: "40",
  },
};

const PRESET_RULES: Record<string, { label: string; value: string }[]> = {
  FTMO: [
    { label: "Profit Target", value: "10%" },
    { label: "Daily Drawdown", value: "5% (balance-based)" },
    { label: "Max Drawdown", value: "10% (static)" },
    { label: "Min Trading Days", value: "4" },
    { label: "Max Trading Days", value: "30" },
    { label: "Trailing DD", value: "No" },
    { label: "Consistency Rule", value: "No" },
  ],
  MyFundedFX: [
    { label: "Profit Target", value: "8%" },
    { label: "Daily Drawdown", value: "5% (balance-based)" },
    { label: "Max Drawdown", value: "8% (trailing, locks at breakeven)" },
    { label: "Min Trading Days", value: "5" },
    { label: "Max Trading Days", value: "30" },
    { label: "Trailing DD", value: "Yes" },
    { label: "Consistency Rule", value: "No" },
  ],
  "The Funded Trader": [
    { label: "Profit Target", value: "8%" },
    { label: "Daily Drawdown", value: "5% (equity-based)" },
    { label: "Max Drawdown", value: "10% (trailing equity)" },
    { label: "Min Trading Days", value: "5" },
    { label: "Max Trading Days", value: "30" },
    { label: "Trailing DD", value: "Yes (always trails)" },
    { label: "Consistency Rule", value: "Yes (max 40% of target per day)" },
  ],
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "\u20AC",
  GBP: "\u00A3",
};

function CircularGauge({
  value,
  max = 100,
  size = 100,
  strokeWidth = 8,
  color,
  label,
  sublabel,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(value, 0), max);
  const offset = circumference - (clamped / max) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-sm font-bold">{label}</span>
      {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
    </div>
  );
}

function getGaugeColor(percent: number, invert = false): string {
  if (invert) {
    if (percent > 80) return "#f43f5e";
    if (percent > 50) return "#f59e0b";
    return "#10b981";
  }
  if (percent < 50) return "#10b981";
  if (percent < 80) return "#f59e0b";
  return "#f43f5e";
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "passed":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "failed":
      return "bg-rose-500/20 text-rose-400 border-rose-500/30";
    default:
      return "";
  }
}

function formatCurrency(val: number | string | null | undefined, curr = "USD") {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: curr, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function MT5PositionsPanel({ challengeId }: { challengeId: number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/prop-firm/mt5-risk/${challengeId}`],
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <Card className="border-cyan-500/20">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="animate-spin text-cyan-400" size={20} />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const fc = (v: number) => formatCurrency(v);

  return (
    <Card className="border-cyan-500/20">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Monitor size={16} className="text-cyan-400" />
            MT5 Live Positions
            {data.connected ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                <Wifi size={8} className="mr-1" /> LIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-muted text-[10px]">
                <WifiOff size={8} className="mr-1" /> OFFLINE
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Real-time position monitoring against challenge rules
          </CardDescription>
        </div>
        {data.floatingPl !== undefined && data.floatingPl !== 0 && (
          <span className={cn("text-lg font-bold", data.floatingPl >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {data.floatingPl >= 0 ? "+" : ""}{fc(data.floatingPl)}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {data.warnings && data.warnings.length > 0 && (
          <div className="space-y-2">
            {data.warnings.map((w: any, i: number) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-md border",
                  w.level === "critical"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : w.level === "warning"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-blue-500/10 border-blue-500/30 text-blue-300"
                )}
                data-testid={`mt5-risk-warning-${i}`}
              >
                {w.level === "critical" ? (
                  <OctagonAlert size={18} className="shrink-0 mt-0.5" />
                ) : w.level === "warning" ? (
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                ) : (
                  <Info size={18} className="shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{w.message}</p>
                  {w.suggestion && (
                    <p className="text-xs opacity-80">{w.suggestion}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {data.positions && data.positions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Open Positions ({data.positionsCount})</p>
            <div className="space-y-1.5">
              {data.positions.map((pos: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/20 text-xs"
                  data-testid={`mt5-position-${i}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[9px] py-0",
                      pos.direction === "Buy" ? "text-emerald-400 border-emerald-500/20" : "text-rose-400 border-rose-500/20"
                    )}>
                      {pos.direction}
                    </Badge>
                    <span className="font-medium">{pos.symbol}</span>
                    <span className="text-muted-foreground">{pos.volume} lots</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {pos.sl && <span className="text-muted-foreground">SL: {pos.sl}</span>}
                    {pos.tp && <span className="text-muted-foreground">TP: {pos.tp}</span>}
                    <span className={cn("font-bold", pos.profit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {pos.profit >= 0 ? "+" : ""}{fc(pos.profit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.metrics && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">Daily DD Used</p>
              <p className={cn("font-bold text-sm",
                data.metrics.dailyDDUsedPercent > 70 ? "text-rose-400" :
                  data.metrics.dailyDDUsedPercent > 40 ? "text-amber-400" : "text-emerald-400"
              )}>
                {data.metrics.dailyDDUsedPercent.toFixed(0)}%
              </p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">Daily DD Left</p>
              <p className="font-bold text-sm">{fc(data.metrics.dailyDDRemaining)}</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">Max DD Left</p>
              <p className="font-bold text-sm">{fc(data.metrics.maxDDRemaining)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PropFirmTracker() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewState>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [challengeShareOpen, setChallengeShareOpen] = useState(false);
  const [challengeShareData, setChallengeShareData] = useState<ChallengeCardData | null>(null);

  const [formData, setFormData] = useState({
    firmName: "",
    challengeName: "",
    phase: "Phase 1",
    accountSize: "",
    currency: "USD",
    profitTarget: "",
    dailyDrawdownLimit: "",
    maxDrawdownLimit: "",
    trailingDrawdown: false,
    drawdownType: "static",
    trailingStopBehavior: "always_trails",
    minTradingDays: 0,
    maxTradingDays: 30,
    consistencyRule: false,
    maxDayProfitPercent: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    phaseLink: false,
    mt5AccountId: "",
    mt5AutoSync: false,
  });

  const [dailyForm, setDailyForm] = useState({
    startingBalance: "",
    endingBalance: "",
    tradesCount: 0,
  });

  const { data: challenges, isLoading: isLoadingList } = useQuery<PropFirmChallenge[]>({
    queryKey: ["/api/prop-firm/challenges"],
  });

  const { data: currentUser } = useQuery<{ fullName?: string }>({
    queryKey: ["/api/user"],
  });

  const { data: detailData, isLoading: isLoadingDetail } = useQuery<ChallengeDetail>({
    queryKey: ["/api/prop-firm/challenges", selectedId],
    enabled: view === "detail" && selectedId !== null,
  });

  const { data: mt5Accounts } = useQuery<MT5AccountInfo[]>({
    queryKey: ["/api/prop-firm/mt5-accounts"],
    enabled: view === "create",
  });

  useEffect(() => {
    if (view !== "detail" || !detailData) return;
    const challenge = detailData.challenge;
    const progress = detailData.progress;
    if (!challenge || !progress || !progress.passEligible) return;

    const key = `pass_eligible_${challenge.id}`;
    try {
      const raw = localStorage.getItem("tradify_shown_milestones");
      const shown: string[] = raw ? JSON.parse(raw) : [];
      if (shown.includes(key)) return;
      shown.push(key);
      localStorage.setItem("tradify_shown_milestones", JSON.stringify(shown));
    } catch {
      return;
    }

    const cardData: ChallengeCardData = {
      challengeName: challenge.challengeName,
      firmName: challenge.firmName,
      profitPercent: progress.profitProgress,
      drawdownUsedPercent: progress.dailyDDUsedPercent,
      tradingDays: progress.uniqueTradingDays,
      accountSize: challenge.accountSize,
      currency: challenge.currency || "USD",
      status: "passed",
    };
    setChallengeShareData(cardData);
    setChallengeShareOpen(true);
  }, [view, detailData]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/prop-firm/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || "Failed to create challenge");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prop-firm/challenges"] });
      toast({ title: "Challenge created", description: "Your prop firm challenge has been set up." });
      setView("list");
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to create challenge.", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/prop-firm/challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prop-firm/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prop-firm/challenges", selectedId] });
      toast({ title: "Status updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/prop-firm/challenges/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prop-firm/challenges"] });
      toast({ title: "Challenge deleted" });
      setView("list");
      setSelectedId(null);
    },
  });

  const dailyStatMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/prop-firm/challenges/${selectedId}/daily-stat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to log daily stat");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prop-firm/challenges", selectedId] });
      toast({ title: "Daily stats recorded" });
      setDailyForm({ startingBalance: "", endingBalance: "", tradesCount: 0 });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record daily stats.", variant: "destructive" });
    },
  });

  const [riskCheckForm, setRiskCheckForm] = useState({
    pair: "",
    tradeDirection: "Long",
    entryPrice: "",
    stopLoss: "",
    lotSize: "0.01",
    currentPl: "0",
  });

  type RiskCheckResult = {
    warnings: { level: string; message: string; suggestion?: string }[];
    metrics: {
      dailyDDUsedPercent: number;
      dailyDDRemaining: number;
      maxDDRemaining: number;
      maxDDUsedPercent: number;
      potentialLoss: number;
      potentialProfit: number;
      profitProgress: number;
      currentProfit: number;
      remainingToTarget: number;
      suggestedMaxSL: string | null;
      suggestedTP: string | null;
      suggestedTPReason: string;
    };
  };

  const [riskResult, setRiskResult] = useState<RiskCheckResult | null>(null);

  const riskCheckMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/prop-firm/ai-risk-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to check risk");
      return res.json() as Promise<RiskCheckResult>;
    },
    onSuccess: (data) => {
      setRiskResult(data);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze trade risk.", variant: "destructive" });
    },
  });

  function handleRiskCheck() {
    if (!selectedId) return;
    riskCheckMutation.mutate({
      challengeId: selectedId,
      ...riskCheckForm,
    });
  }

  function resetForm() {
    setFormData({
      firmName: "",
      challengeName: "",
      phase: "Phase 1",
      accountSize: "",
      currency: "USD",
      profitTarget: "",
      dailyDrawdownLimit: "",
      maxDrawdownLimit: "",
      trailingDrawdown: false,
      drawdownType: "static",
      trailingStopBehavior: "always_trails",
      minTradingDays: 0,
      maxTradingDays: 30,
      consistencyRule: false,
      maxDayProfitPercent: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      phaseLink: false,
      mt5AccountId: "",
      mt5AutoSync: false,
    });
    setSelectedPreset("");
  }

  function selectMT5Account(accountNumber: string) {
    if (!accountNumber) {
      setFormData((p) => ({ ...p, mt5AccountId: "", mt5AutoSync: false }));
      return;
    }
    const account = mt5Accounts?.find((a) => a.accountNumber === accountNumber);
    if (account) {
      setFormData((p) => ({
        ...p,
        mt5AccountId: account.accountNumber,
        mt5AutoSync: true,
        currency: account.currency || "USD",
        accountSize: account.balance ? String(Math.floor(parseFloat(account.balance))) : p.accountSize,
      }));
    }
  }

  function applyPreset(name: string) {
    if (name === "Custom Firm") {
      resetForm();
      setSelectedPreset("Custom Firm");
      return;
    }
    const p = PRESETS[name];
    if (p) {
      setFormData((prev) => ({
        ...prev,
        firmName: p.firmName || "",
        accountSize: p.accountSize || "",
        profitTarget: p.profitTarget || "",
        dailyDrawdownLimit: p.dailyDrawdownLimit || "",
        maxDrawdownLimit: p.maxDrawdownLimit || "",
        trailingDrawdown: p.trailingDrawdown || false,
        drawdownType: p.drawdownType || "static",
        trailingStopBehavior: p.trailingStopBehavior || "always_trails",
        minTradingDays: p.minTradingDays || 0,
        maxTradingDays: p.maxTradingDays || 30,
        consistencyRule: p.consistencyRule || false,
        maxDayProfitPercent: p.maxDayProfitPercent || "",
      }));
      setSelectedPreset(name);
    }
  }

  const acctSizeNum = parseFloat(formData.accountSize) || 0;
  const profitTargetNum = parseFloat(formData.profitTarget) || 0;
  const dailyDDNum = parseFloat(formData.dailyDrawdownLimit) || 0;
  const maxDDNum = parseFloat(formData.maxDrawdownLimit) || 0;
  const consistencyPctNum = parseFloat(formData.maxDayProfitPercent) || 0;
  const currSymbol = CURRENCY_SYMBOLS[formData.currency] || "$";

  const formWarnings: { level: "error" | "warning"; message: string }[] = [];
  if (profitTargetNum > 0 && maxDDNum > 0 && profitTargetNum > maxDDNum) {
    formWarnings.push({ level: "warning", message: "Profit target is larger than max drawdown — this challenge has unfavorable risk-reward." });
  }
  if (formData.minTradingDays > 0 && formData.maxTradingDays > 0 && formData.minTradingDays > formData.maxTradingDays) {
    formWarnings.push({ level: "error", message: "Min trading days cannot exceed max trading days." });
  }
  if (formData.startDate && formData.endDate && formData.maxTradingDays > 0) {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const daysBetween = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysBetween < formData.maxTradingDays) {
      formWarnings.push({ level: "warning", message: `End date allows only ${daysBetween} calendar days, but max trading days is ${formData.maxTradingDays}.` });
    }
  }
  const hasBlockingError = formWarnings.some((w) => w.level === "error");

  function handleCreateSubmit() {
    const missing: string[] = [];
    if (!formData.firmName) missing.push("Firm Name");
    if (!formData.challengeName) missing.push("Challenge Name");
    if (!formData.accountSize) missing.push("Account Size");
    if (!formData.profitTarget) missing.push("Profit Target");
    if (!formData.dailyDrawdownLimit) missing.push("Daily Drawdown Limit");
    if (!formData.maxDrawdownLimit) missing.push("Max Drawdown Limit");
    if (!formData.startDate) missing.push("Start Date");
    if (missing.length > 0) {
      toast({ title: "Missing fields", description: `Please fill in: ${missing.join(", ")}.`, variant: "destructive" });
      return;
    }
    if (hasBlockingError) {
      toast({ title: "Cannot create", description: "Fix the errors before creating.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...formData,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      minTradingDays: Number(formData.minTradingDays) || 0,
      maxTradingDays: Number(formData.maxTradingDays) || null,
      maxDayProfitPercent: formData.maxDayProfitPercent || null,
      mt5AccountId: formData.mt5AccountId || null,
    });
  }

  function handleDailySubmit() {
    if (!dailyForm.endingBalance) {
      toast({ title: "Missing fields", description: "Ending balance is required.", variant: "destructive" });
      return;
    }
    const startBal = dailyForm.startingBalance || String(detailData?.progress?.currentBalance || 0);
    dailyStatMutation.mutate({
      challengeId: selectedId,
      date: new Date().toISOString(),
      startingBalance: startBal,
      endingBalance: dailyForm.endingBalance,
      dayPl: String(parseFloat(dailyForm.endingBalance) - parseFloat(startBal)),
      tradesCount: dailyForm.tradesCount,
    });
  }

  function openDetail(id: number) {
    setSelectedId(id);
    setView("detail");
  }

  if (view === "create") {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            data-testid="button-back-to-list"
            variant="ghost"
            size="icon"
            onClick={() => { setView("list"); resetForm(); }}
          >
            <ArrowLeft />
          </Button>
          <h1 className="font-black text-2xl tracking-tighter uppercase italic">New Challenge</h1>
        </div>

        {mt5Accounts && mt5Accounts.length > 0 && (
          <Card className="border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Monitor size={16} className="text-cyan-400" />
                Link MT5 Account
              </CardTitle>
              <CardDescription>Connect a MetaTrader 5 account for automated daily tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mt5Accounts.map((acct) => (
                  <button
                    key={acct.accountNumber}
                    type="button"
                    data-testid={`button-mt5-account-${acct.accountNumber}`}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-md text-left transition-colors",
                      formData.mt5AccountId === acct.accountNumber
                        ? "bg-cyan-500/15 border border-cyan-500/40"
                        : "bg-muted/20 border border-transparent hover-elevate"
                    )}
                    onClick={() => selectMT5Account(
                      formData.mt5AccountId === acct.accountNumber ? "" : acct.accountNumber
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{acct.accountName}</span>
                        {acct.isOnline ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                            <Wifi size={8} className="mr-1" /> Live
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            <WifiOff size={8} className="mr-1" /> Offline
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>#{acct.accountNumber}</span>
                        {acct.broker && <span>{acct.broker}</span>}
                        {acct.balance && (
                          <span className="font-medium text-foreground">
                            {formatCurrency(acct.balance, acct.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                    {formData.mt5AccountId === acct.accountNumber && (
                      <CheckCircle2 size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
              {formData.mt5AccountId && (
                <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                  <label className="flex items-center gap-2 cursor-pointer" data-testid="label-mt5-auto-sync">
                    <input
                      data-testid="checkbox-mt5-auto-sync"
                      type="checkbox"
                      checked={formData.mt5AutoSync}
                      onChange={(e) => setFormData((p) => ({ ...p, mt5AutoSync: e.target.checked }))}
                      className="rounded border-border"
                    />
                    <span className="text-sm">Auto-sync daily results from MT5</span>
                  </label>
                  <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/20">
                    <Link2 size={8} className="mr-1" /> Linked
                  </Badge>
                </div>
              )}
              {!formData.mt5AccountId && (
                <p className="text-xs text-muted-foreground">
                  Select an MT5 account to auto-fill balance and currency, and enable automated daily tracking.
                  Skip this step for manual tracking.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Select Prop Firm Preset</CardTitle>
            <CardDescription>Choose a preset or configure a custom challenge</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {["FTMO", "MyFundedFX", "The Funded Trader", "Custom Firm"].map((name) => (
                <Button
                  key={name}
                  data-testid={`button-preset-${name.toLowerCase().replace(/\s+/g, "-")}`}
                  variant={selectedPreset === name ? "default" : "outline"}
                  onClick={() => applyPreset(name)}
                >
                  {name}
                </Button>
              ))}
            </div>

            {selectedPreset && selectedPreset !== "Custom Firm" && PRESET_RULES[selectedPreset] && (
              <Card className="bg-muted/20 border-muted">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {selectedPreset} Rules Summary
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                    {PRESET_RULES[selectedPreset].map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm" data-testid={`text-preset-rule-${i}`}>
                        <span className="text-muted-foreground">{rule.label}:</span>
                        <span className="font-medium">{rule.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Firm Name</label>
                <Input
                  data-testid="input-firm-name"
                  value={formData.firmName}
                  onChange={(e) => setFormData((p) => ({ ...p, firmName: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">e.g. FTMO, MyFundedFX</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Challenge Name</label>
                <Input
                  data-testid="input-challenge-name"
                  value={formData.challengeName}
                  onChange={(e) => setFormData((p) => ({ ...p, challengeName: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">e.g. 100K Challenge, 200K Aggressive</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Phase</label>
                <Select
                  value={formData.phase}
                  onValueChange={(v) => setFormData((p) => ({ ...p, phase: v }))}
                >
                  <SelectTrigger data-testid="select-phase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Phase 1">Phase 1</SelectItem>
                    <SelectItem value="Phase 2">Phase 2</SelectItem>
                    <SelectItem value="Funded">Funded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Currency</label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => setFormData((p) => ({ ...p, currency: v }))}
                >
                  <SelectTrigger data-testid="select-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (&euro;)</SelectItem>
                    <SelectItem value="GBP">GBP (&pound;)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Account Size ({currSymbol})</label>
                <Input
                  data-testid="input-account-size"
                  type="number"
                  value={formData.accountSize}
                  onChange={(e) => setFormData((p) => ({ ...p, accountSize: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">e.g. 100000</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Profit Target (%)</label>
                <Input
                  data-testid="input-profit-target"
                  type="number"
                  value={formData.profitTarget}
                  onChange={(e) => setFormData((p) => ({ ...p, profitTarget: e.target.value }))}
                />
                {acctSizeNum > 0 && profitTargetNum > 0 && (
                  <p className="text-xs text-emerald-400">
                    Target equity: {currSymbol}{(acctSizeNum + acctSizeNum * profitTargetNum / 100).toLocaleString()}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">e.g. 10</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Daily Drawdown Limit (%)</label>
                <Input
                  data-testid="input-daily-dd"
                  type="number"
                  value={formData.dailyDrawdownLimit}
                  onChange={(e) => setFormData((p) => ({ ...p, dailyDrawdownLimit: e.target.value }))}
                />
                {acctSizeNum > 0 && dailyDDNum > 0 && (
                  <p className="text-xs text-amber-400">
                    Max daily loss: {currSymbol}{(acctSizeNum * dailyDDNum / 100).toLocaleString()} (based on starting balance)
                  </p>
                )}
                <p className="text-xs text-muted-foreground">e.g. 5</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Max Drawdown Limit (%)</label>
                <Input
                  data-testid="input-max-dd"
                  type="number"
                  value={formData.maxDrawdownLimit}
                  onChange={(e) => setFormData((p) => ({ ...p, maxDrawdownLimit: e.target.value }))}
                />
                {acctSizeNum > 0 && maxDDNum > 0 && (
                  <p className="text-xs text-rose-400">
                    Max total loss: {currSymbol}{(acctSizeNum * maxDDNum / 100).toLocaleString()} — breach at {currSymbol}{(acctSizeNum - acctSizeNum * maxDDNum / 100).toLocaleString()}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">e.g. 10</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Drawdown Calculation Type</label>
                <Select
                  value={formData.drawdownType}
                  onValueChange={(v) => {
                    const isTrailing = v.startsWith("trailing");
                    setFormData((p) => ({ ...p, drawdownType: v, trailingDrawdown: isTrailing }));
                  }}
                >
                  <SelectTrigger data-testid="select-drawdown-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static (balance-based) — fixed from initial balance</SelectItem>
                    <SelectItem value="balance">Balance-based — resets from daily starting balance</SelectItem>
                    <SelectItem value="equity">Equity-based — calculated from real-time equity</SelectItem>
                    <SelectItem value="trailing_balance">Trailing (balance) — DD floor rises with profit</SelectItem>
                    <SelectItem value="trailing_equity">Trailing (equity) — DD floor rises with equity HWM</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.drawdownType === "static" && "Drawdown limit measured from your initial account balance — never changes."}
                  {formData.drawdownType === "balance" && "Daily drawdown measured from each day's opening balance."}
                  {formData.drawdownType === "equity" && "Drawdown measured from real-time equity (includes floating P&L)."}
                  {formData.drawdownType === "trailing_balance" && "Max drawdown floor rises as your balance grows — locks profits into your safety net."}
                  {formData.drawdownType === "trailing_equity" && "Max drawdown floor rises with your equity high-water mark — most restrictive type."}
                </p>
              </div>

              {formData.trailingDrawdown && (
                <div className="space-y-2 pl-4 border-l-2 border-amber-500/30">
                  <label className="text-sm font-medium text-muted-foreground">Trailing Stop Behavior</label>
                  <Select
                    value={formData.trailingStopBehavior}
                    onValueChange={(v) => setFormData((p) => ({ ...p, trailingStopBehavior: v }))}
                  >
                    <SelectTrigger data-testid="select-trailing-behavior">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always_trails">Always trails — DD floor continues rising indefinitely</SelectItem>
                      <SelectItem value="locks_at_breakeven">Locks at breakeven — stops trailing once floor reaches initial balance</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.trailingStopBehavior === "always_trails"
                      ? "The drawdown floor keeps rising as you profit. This is the strictest trailing mode."
                      : "The trailing floor stops moving once it reaches your initial balance — you can't lose the initial capital."}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Min Trading Days</label>
                <Input
                  data-testid="input-min-days"
                  type="number"
                  value={formData.minTradingDays}
                  onChange={(e) => setFormData((p) => ({ ...p, minTradingDays: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">e.g. 4 — minimum days you must trade</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Max Trading Days</label>
                <Input
                  data-testid="input-max-days"
                  type="number"
                  value={formData.maxTradingDays}
                  onChange={(e) => setFormData((p) => ({ ...p, maxTradingDays: parseInt(e.target.value) || 30 }))}
                />
                <p className="text-xs text-muted-foreground">e.g. 30 — calendar days allowed for the challenge</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                <Input
                  data-testid="input-start-date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">End Date</label>
                <Input
                  data-testid="input-end-date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to auto-calculate from start + max days
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    data-testid="checkbox-consistency-rule"
                    type="checkbox"
                    checked={formData.consistencyRule}
                    onChange={(e) => setFormData((p) => ({ ...p, consistencyRule: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Consistency Rule</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    data-testid="checkbox-phase-link"
                    type="checkbox"
                    checked={formData.phaseLink}
                    onChange={(e) => setFormData((p) => ({ ...p, phaseLink: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Links to next phase automatically</span>
                </label>
              </div>

              {formData.consistencyRule && (
                <div className="space-y-2 pl-4 border-l-2 border-cyan-500/30">
                  <label className="text-sm font-medium text-muted-foreground">Max Single Day Profit (%)</label>
                  <Input
                    data-testid="input-max-day-profit"
                    type="number"
                    value={formData.maxDayProfitPercent}
                    onChange={(e) => setFormData((p) => ({ ...p, maxDayProfitPercent: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    No single day can contribute more than this % of your total profit target.
                  </p>
                  {acctSizeNum > 0 && profitTargetNum > 0 && consistencyPctNum > 0 && (
                    <p className="text-xs text-cyan-400">
                      Max allowed daily profit: {currSymbol}{((acctSizeNum * profitTargetNum / 100) * consistencyPctNum / 100).toLocaleString()} per day
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">e.g. 40 means your best day can't exceed 40% of the profit target</p>
                </div>
              )}

              {formData.phaseLink && (
                <div className="pl-4 border-l-2 border-blue-500/30">
                  <p className="text-xs text-blue-400">
                    When this phase is passed, a new challenge will be created for the next phase with inherited rules and carried-over equity.
                  </p>
                </div>
              )}
            </div>

            {formWarnings.length > 0 && (
              <div className="space-y-2">
                {formWarnings.map((w, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-md text-sm",
                      w.level === "error"
                        ? "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                        : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                    )}
                    data-testid={`text-form-warning-${i}`}
                  >
                    {w.level === "error" ? <XCircle size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
                    {w.message}
                  </div>
                ))}
              </div>
            )}

            {acctSizeNum > 0 && profitTargetNum > 0 && dailyDDNum > 0 && maxDDNum > 0 && (
              <Card className="bg-muted/20 border-muted">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Challenge Preview
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-md bg-background/50">
                      <p className="text-xs text-muted-foreground">Profit Target</p>
                      <p className="font-bold text-emerald-400">{currSymbol}{(acctSizeNum * profitTargetNum / 100).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">to reach {currSymbol}{(acctSizeNum + acctSizeNum * profitTargetNum / 100).toLocaleString()}</p>
                    </div>
                    <div className="text-center p-3 rounded-md bg-background/50">
                      <p className="text-xs text-muted-foreground">Max Daily Loss</p>
                      <p className="font-bold text-amber-400">{currSymbol}{(acctSizeNum * dailyDDNum / 100).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">per day</p>
                    </div>
                    <div className="text-center p-3 rounded-md bg-background/50">
                      <p className="text-xs text-muted-foreground">Max Total Loss</p>
                      <p className="font-bold text-rose-400">{currSymbol}{(acctSizeNum * maxDDNum / 100).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">breach at {currSymbol}{(acctSizeNum - acctSizeNum * maxDDNum / 100).toLocaleString()}</p>
                    </div>
                    <div className="text-center p-3 rounded-md bg-background/50">
                      <p className="text-xs text-muted-foreground">Trading Window</p>
                      <p className="font-bold">{formData.minTradingDays}–{formData.maxTradingDays}</p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
          <CardFooter className="flex gap-3 flex-wrap">
            <Button
              data-testid="button-create-challenge"
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending || hasBlockingError}
            >
              {createMutation.isPending && <Loader2 className="animate-spin" />}
              Create Challenge
            </Button>
            <Button
              data-testid="button-cancel-create"
              variant="ghost"
              onClick={() => { setView("list"); resetForm(); }}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (view === "detail" && selectedId !== null) {
    if (isLoadingDetail) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      );
    }

    const challenge = detailData?.challenge;
    const progress = detailData?.progress;
    const dailyStats = detailData?.dailyStats || [];

    if (!challenge || !progress) {
      return (
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Challenge not found.</p>
          <Button data-testid="button-back-not-found" variant="ghost" className="mt-4" onClick={() => setView("list")}>
            Back to list
          </Button>
        </div>
      );
    }

    const acctSize = parseFloat(challenge.accountSize);
    const profitTargetPct = parseFloat(challenge.profitTarget);
    const profitTargetAmt = progress.profitTargetAmount;

    const curr = challenge.currency || "USD";
    const fc = (v: number | string | null | undefined) => formatCurrency(v, curr);

    return (
      <>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <Button
              data-testid="button-back-to-list-detail"
              variant="ghost"
              size="icon"
              onClick={() => { setView("list"); setSelectedId(null); }}
            >
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="font-black text-2xl tracking-tighter uppercase italic">{challenge.firmName}</h1>
              <p className="text-muted-foreground text-sm">
                {challenge.challengeName} &middot; {challenge.phase} &middot; {fc(acctSize)}
              </p>
            </div>
            <Badge
              data-testid={`badge-status-${challenge.status}`}
              variant="outline"
              className={statusBadgeClass(challenge.status)}
            >
              {challenge.status.toUpperCase()}
            </Badge>
            {challenge.mt5AccountId && (
              <Badge
                data-testid="badge-mt5-linked"
                variant="outline"
                className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
              >
                <Link2 size={10} className="mr-1" />
                MT5 #{challenge.mt5AccountId}
                {challenge.mt5AutoSync && " (Auto)"}
              </Badge>
            )}
          </div>
          {challenge.status === "active" && (
            <div className="flex gap-2 flex-wrap">
              {progress.passEligible ? (
                <>
                  <Button
                    data-testid="button-pass-challenge"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-400"
                    onClick={() => updateStatusMutation.mutate({ id: challenge.id, status: "passed" })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <Award size={16} className="text-emerald-400" />
                    Eligible - Pass Challenge
                  </Button>
                  <Button
                    data-testid="button-share-challenge"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-400 gap-2"
                    onClick={() => {
                      const cardData: ChallengeCardData = {
                        challengeName: challenge.challengeName,
                        firmName: challenge.firmName,
                        profitPercent: progress.profitProgress,
                        drawdownUsedPercent: progress.dailyDDUsedPercent,
                        tradingDays: progress.uniqueTradingDays,
                        accountSize: challenge.accountSize,
                        currency: challenge.currency || "USD",
                        status: "passed",
                      };
                      setChallengeShareData(cardData);
                      setChallengeShareOpen(true);
                    }}
                  >
                    <Share2 size={14} />
                    Share Result
                  </Button>
                </>
              ) : (
                <Button
                  data-testid="button-pass-challenge"
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate({ id: challenge.id, status: "passed" })}
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle2 className="text-blue-400" />
                  Pass (Manual)
                </Button>
              )}
              {progress.failTriggered ? (
                <Button
                  data-testid="button-fail-challenge"
                  variant="destructive"
                  onClick={() => updateStatusMutation.mutate({ id: challenge.id, status: "failed" })}
                  disabled={updateStatusMutation.isPending}
                >
                  <OctagonAlert size={16} />
                  Rule Breach - Fail
                </Button>
              ) : (
                <Button
                  data-testid="button-fail-challenge"
                  variant="destructive"
                  onClick={() => updateStatusMutation.mutate({ id: challenge.id, status: "failed" })}
                  disabled={updateStatusMutation.isPending}
                >
                  <XCircle />
                  Fail (Manual)
                </Button>
              )}
              <Button
                data-testid="button-delete-challenge"
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate(challenge.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="text-rose-400" />
              </Button>
            </div>
          )}
        </div>

        {challenge.status === "active" && (
          <div
            data-testid="banner-challenge-health"
            className={cn(
              "flex items-center gap-3 p-4 rounded-md border",
              progress.healthStatus === "healthy"
                ? "bg-emerald-500/10 border-emerald-500/30"
                : progress.healthStatus === "caution"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-rose-500/10 border-rose-500/30"
            )}
          >
            {progress.healthStatus === "healthy" ? (
              <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
            ) : progress.healthStatus === "caution" ? (
              <AlertTriangle size={20} className="text-amber-400 shrink-0" />
            ) : (
              <OctagonAlert size={20} className="text-rose-400 shrink-0" />
            )}
            <span className={cn(
              "font-semibold text-sm",
              progress.healthStatus === "healthy" ? "text-emerald-300" :
                progress.healthStatus === "caution" ? "text-amber-300" : "text-rose-300"
            )} data-testid="text-health-message">
              {progress.healthMessage}
            </span>
            {progress.passEligible && (
              <Badge variant="outline" className="ml-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/20" data-testid="badge-pass-eligible">
                PASS ELIGIBLE
              </Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit Target</CardTitle>
              <Target size={16} className="text-emerald-500" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              <CircularGauge
                value={progress.profitProgress}
                color={getGaugeColor(progress.profitProgress, true)}
                label={`${progress.profitProgress.toFixed(1)}%`}
                sublabel={`${fc(progress.currentProfit)} / ${fc(profitTargetAmt)}`}
              />
              <p className="text-xs text-muted-foreground">
                Remaining: {fc(progress.distanceToProfitTarget)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Drawdown</CardTitle>
              <TrendingDown size={16} className="text-amber-500" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              <CircularGauge
                value={progress.dailyDDUsedPercent}
                color={getGaugeColor(progress.dailyDDUsedPercent)}
                label={`${progress.dailyDDUsedPercent.toFixed(1)}%`}
                sublabel="of daily limit used"
              />
              <div className="text-xs text-muted-foreground text-center space-y-0.5">
                <p>Remaining: {fc(progress.dailyDDRemaining)} of {fc(progress.dailyDDAmount)}</p>
                <p className="text-[10px] opacity-70">Resets at broker day close (00:00 server time)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {challenge.trailingDrawdown ? "Trailing" : "Max"} Drawdown
              </CardTitle>
              <Activity size={16} className="text-rose-500" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              <CircularGauge
                value={progress.maxDDUsedPercent}
                color={getGaugeColor(progress.maxDDUsedPercent)}
                label={`${progress.maxDDUsedPercent.toFixed(1)}%`}
                sublabel="of max limit used"
              />
              <div className="text-xs text-muted-foreground text-center space-y-0.5">
                <p>HWM: {fc(progress.highWaterMark)}</p>
                {challenge.trailingDrawdown && <p>Floor: {fc(progress.trailingDDFloor)}</p>}
                <p>Buffer: {fc(progress.maxDDRemaining)}</p>
              </div>
            </CardContent>
          </Card>

          {challenge.consistencyRule && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Consistency</CardTitle>
                <ShieldCheck size={16} className="text-emerald-500" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col items-center gap-2">
                  <CircularGauge
                    value={progress.consistencyScore}
                    color={progress.consistencyScore >= 70 ? "#10b981" : progress.consistencyScore >= 40 ? "#f59e0b" : "#f43f5e"}
                    label={`${progress.consistencyScore.toFixed(0)}%`}
                    sublabel="consistency score"
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/50">
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span>Max Daily Contribution</span>
                    <span className="font-semibold text-foreground">{fc(progress.consistencyMaxAllowedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Today Used</span>
                    <span className={cn("font-semibold", progress.consistencyTodayUsed > progress.consistencyMaxAllowedAmount ? "text-rose-400" : "text-foreground")}>
                      {fc(progress.consistencyTodayUsed)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Remaining</span>
                    <span className="font-semibold text-foreground">
                      {fc(Math.max(0, progress.consistencyMaxAllowedAmount - progress.consistencyTodayUsed))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trading Days</CardTitle>
              <Calendar size={16} className="text-emerald-500" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <span className="text-3xl font-black tracking-tighter">
                  {progress.uniqueTradingDays}
                </span>
                <span className="text-muted-foreground text-sm"> / {progress.minTradingDays} min</span>
              </div>
              <div className="w-full bg-muted/30 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((progress.uniqueTradingDays / Math.max(progress.minTradingDays, 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{progress.minDaysMet ? <CheckCircle2 size={12} className="inline text-emerald-400 mr-1" /> : <Clock size={12} className="inline text-amber-400 mr-1" />}{progress.minDaysMet ? "Min days met" : `${Math.max(0, progress.minTradingDays - progress.uniqueTradingDays)} days remaining`}</span>
                <span>{progress.daysElapsed}d elapsed</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 text-center">
                A trading day is counted when at least one trade is executed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
              <Clock size={16} className={cn(
                progress.daysRemaining !== null && progress.daysRemaining <= 5 ? "text-rose-500" :
                  progress.daysRemaining !== null && progress.daysRemaining <= 10 ? "text-amber-500" : "text-emerald-500"
              )} />
            </CardHeader>
            <CardContent className="text-center space-y-2">
              {progress.daysRemaining !== null ? (
                <>
                  <span className={cn(
                    "text-4xl font-black tracking-tighter",
                    progress.daysRemaining <= 5 ? "text-rose-400" :
                      progress.daysRemaining <= 10 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {progress.daysRemaining}
                  </span>
                  <p className="text-xs text-muted-foreground">days left</p>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">No deadline set</span>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <DollarSign size={16} className="text-emerald-500" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-3xl font-black tracking-tighter">{fc(progress.currentBalance)}</span>
              <span className={cn(
                "ml-3 text-sm font-semibold",
                progress.currentProfit >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {progress.currentProfit >= 0 ? "+" : ""}{fc(progress.currentProfit)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/20">
                <span className="text-xs text-muted-foreground">To Profit Target</span>
                <span className={cn("text-sm font-bold", progress.distanceToProfitTarget <= 0 ? "text-emerald-400" : "text-foreground")}>
                  {progress.distanceToProfitTarget <= 0 ? "TARGET MET" : `+${fc(progress.distanceToProfitTarget)}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/20">
                <span className="text-xs text-muted-foreground">To {challenge.trailingDrawdown ? "Trail Floor" : "Max Loss"}</span>
                <span className={cn("text-sm font-bold", progress.distanceToMaxLoss < acctSize * 0.02 ? "text-rose-400" : "text-foreground")}>
                  -{fc(progress.distanceToMaxLoss)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/20">
                <span className="text-xs text-muted-foreground">Daily DD Left</span>
                <span className={cn("text-sm font-bold", progress.distanceToDailyDDLimit < progress.dailyDDAmount * 0.3 ? "text-amber-400" : "text-foreground")}>
                  -{fc(progress.distanceToDailyDDLimit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {challenge.status === "active" && (
          <Card className={challenge.mt5AutoSync ? "border-cyan-500/20" : ""}>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Log Daily Results
                {challenge.mt5AutoSync && (
                  <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">
                    <Link2 size={8} className="mr-1" /> Auto-Synced from MT5
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {challenge.mt5AutoSync
                  ? "Daily results are automatically recorded from your MT5 account. You can still log manually if needed."
                  : "Record today's trading performance"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock size={10} /> Starting Balance (auto-filled)
                  </label>
                  <Input
                    data-testid="input-daily-start-balance"
                    type="number"
                    value={dailyForm.startingBalance || String(progress.currentBalance)}
                    readOnly
                    className="opacity-70"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Ending Balance</label>
                  <Input
                    data-testid="input-daily-end-balance"
                    type="number"
                    value={dailyForm.endingBalance}
                    onChange={(e) => setDailyForm((p) => ({ ...p, endingBalance: e.target.value }))}
                    placeholder="Enter today's ending balance"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Trades Count</label>
                  <Input
                    data-testid="input-daily-trades-count"
                    type="number"
                    value={dailyForm.tradesCount}
                    onChange={(e) => setDailyForm((p) => ({ ...p, tradesCount: parseInt(e.target.value) || 0 }))}
                    placeholder="Number of trades executed"
                  />
                </div>
              </div>
              {dailyForm.endingBalance && (
                <div className="mt-3 p-3 rounded-md bg-muted/20 text-xs text-muted-foreground">
                  <span className="font-medium">Preview: </span>
                  P&L = <span className={cn("font-semibold",
                    parseFloat(dailyForm.endingBalance) - progress.currentBalance >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {parseFloat(dailyForm.endingBalance) - progress.currentBalance >= 0 ? "+" : ""}
                    {fc(parseFloat(dailyForm.endingBalance) - progress.currentBalance)}
                  </span>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                data-testid="button-submit-daily-stat"
                onClick={handleDailySubmit}
                disabled={dailyStatMutation.isPending}
              >
                {dailyStatMutation.isPending && <Loader2 className="animate-spin" />}
                Record Daily Stats
              </Button>
            </CardFooter>
          </Card>
        )}

        {challenge.status === "active" && (
          <Card className="border-amber-500/20">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain size={16} className="text-amber-500" />
                  AI Risk Analysis
                </CardTitle>
                <CardDescription>Check trade risk against your challenge rules before entering</CardDescription>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                ELITE
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Pair</label>
                  <Input
                    data-testid="input-risk-pair"
                    value={riskCheckForm.pair}
                    onChange={(e) => setRiskCheckForm((p) => ({ ...p, pair: e.target.value.toUpperCase() }))}
                    placeholder="EURUSD"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Direction</label>
                  <Select
                    value={riskCheckForm.tradeDirection}
                    onValueChange={(v) => setRiskCheckForm((p) => ({ ...p, tradeDirection: v }))}
                  >
                    <SelectTrigger data-testid="select-risk-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Long">Long</SelectItem>
                      <SelectItem value="Short">Short</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Entry Price</label>
                  <Input
                    data-testid="input-risk-entry"
                    type="number"
                    step="0.00001"
                    value={riskCheckForm.entryPrice}
                    onChange={(e) => setRiskCheckForm((p) => ({ ...p, entryPrice: e.target.value }))}
                    placeholder="1.08500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Stop Loss</label>
                  <Input
                    data-testid="input-risk-sl"
                    type="number"
                    step="0.00001"
                    value={riskCheckForm.stopLoss}
                    onChange={(e) => setRiskCheckForm((p) => ({ ...p, stopLoss: e.target.value }))}
                    placeholder="1.08200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Lot Size</label>
                  <Input
                    data-testid="input-risk-lots"
                    type="number"
                    step="0.01"
                    value={riskCheckForm.lotSize}
                    onChange={(e) => setRiskCheckForm((p) => ({ ...p, lotSize: e.target.value }))}
                    placeholder="0.01"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Open P&L</label>
                  <Input
                    data-testid="input-risk-pl"
                    type="number"
                    value={riskCheckForm.currentPl}
                    onChange={(e) => setRiskCheckForm((p) => ({ ...p, currentPl: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <Button
                data-testid="button-run-risk-check"
                onClick={handleRiskCheck}
                disabled={riskCheckMutation.isPending || !riskCheckForm.entryPrice}
                variant="default"
              >
                {riskCheckMutation.isPending ? <Loader2 className="animate-spin" /> : <Zap size={16} />}
                Analyze Risk
              </Button>

              {riskResult && (
                <div className="space-y-4 pt-2">
                  <div className={cn(
                    "flex items-center gap-3 p-4 rounded-md border",
                    riskResult.warnings.some((w: any) => w.level === "critical")
                      ? "bg-rose-500/10 border-rose-500/30"
                      : riskResult.warnings.some((w: any) => w.level === "warning")
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-emerald-500/10 border-emerald-500/30"
                  )} data-testid="risk-verdict">
                    {riskResult.warnings.some((w: any) => w.level === "critical") ? (
                      <OctagonAlert size={22} className="text-rose-400 shrink-0" />
                    ) : riskResult.warnings.some((w: any) => w.level === "warning") ? (
                      <AlertTriangle size={22} className="text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                    )}
                    <div>
                      <p className={cn("font-bold text-sm",
                        riskResult.warnings.some((w: any) => w.level === "critical") ? "text-rose-300" :
                          riskResult.warnings.some((w: any) => w.level === "warning") ? "text-amber-300" : "text-emerald-300"
                      )}>
                        {riskResult.warnings.some((w: any) => w.level === "critical")
                          ? "Trade would breach challenge rules"
                          : riskResult.warnings.some((w: any) => w.level === "warning")
                            ? "Trade risks violating challenge limits"
                            : "Trade complies with all challenge rules"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {riskResult.warnings.length === 0
                          ? "All drawdown limits and rules are within safe parameters."
                          : `${riskResult.warnings.length} issue${riskResult.warnings.length > 1 ? "s" : ""} detected`}
                      </p>
                    </div>
                  </div>

                  {riskResult.warnings.length > 0 && (
                    <div className="space-y-2">
                      {riskResult.warnings.map((w: any, i: number) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-md border",
                            w.level === "critical"
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                              : w.level === "warning"
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                : "bg-blue-500/10 border-blue-500/30 text-blue-300"
                          )}
                          data-testid={`risk-warning-${i}`}
                        >
                          {w.level === "critical" ? (
                            <OctagonAlert size={18} className="shrink-0 mt-0.5" />
                          ) : w.level === "warning" ? (
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                          ) : (
                            <Info size={18} className="shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-1 text-sm">
                            <p className="font-medium">{w.message}</p>
                            {w.suggestion && (
                              <p className="text-xs opacity-80">{w.suggestion}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="text-center p-2 rounded-md bg-muted/20">
                      <p className="text-xs text-muted-foreground">Potential Loss</p>
                      <p className="font-bold text-rose-400" data-testid="text-potential-loss">{fc(riskResult.metrics.potentialLoss)}</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-muted/20">
                      <p className="text-xs text-muted-foreground">Daily DD Left</p>
                      <p className="font-bold" data-testid="text-daily-dd-left">{fc(riskResult.metrics.dailyDDRemaining)}</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-muted/20">
                      <p className="text-xs text-muted-foreground">Max DD Left</p>
                      <p className="font-bold" data-testid="text-max-dd-left">{fc(riskResult.metrics.maxDDRemaining)}</p>
                    </div>
                    {riskResult.metrics.suggestedMaxSL && (
                      <div className="text-center p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <p className="text-xs text-amber-400">Suggested SL</p>
                        <p className="font-bold text-amber-300" data-testid="text-suggested-sl">{riskResult.metrics.suggestedMaxSL}</p>
                      </div>
                    )}
                    {riskResult.metrics.suggestedTP && (
                      <div className="text-center p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-xs text-emerald-400">Suggested TP</p>
                        <p className="font-bold text-emerald-300" data-testid="text-suggested-tp">{riskResult.metrics.suggestedTP}</p>
                      </div>
                    )}
                  </div>

                  {riskResult.metrics.suggestedTPReason && (
                    <p className="text-xs text-muted-foreground px-1" data-testid="text-tp-reason">
                      {riskResult.metrics.suggestedTPReason}
                    </p>
                  )}

                  {riskResult.metrics.potentialLoss > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Card className="border-border/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-medium flex items-center gap-2">
                            <Gauge size={14} className="text-amber-400" />
                            If You Lose This Trade
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground">New Balance</p>
                              <p className="font-bold text-rose-400">
                                {fc(progress.currentBalance - riskResult.metrics.potentialLoss)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">New {challenge.trailingDrawdown ? "Trail" : "Max"} DD Buffer</p>
                              <p className={cn("font-bold",
                                progress.distanceToMaxLoss - riskResult.metrics.potentialLoss <= 0 ? "text-rose-400" : "text-amber-400"
                              )}>
                                {fc(Math.max(0, progress.distanceToMaxLoss - riskResult.metrics.potentialLoss))}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Daily DD Remaining</p>
                              <p className={cn("font-bold",
                                progress.distanceToDailyDDLimit - riskResult.metrics.potentialLoss <= 0 ? "text-rose-400" : "text-amber-400"
                              )}>
                                {fc(Math.max(0, progress.distanceToDailyDDLimit - riskResult.metrics.potentialLoss))}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Challenge Status</p>
                              <p className={cn("font-bold",
                                progress.distanceToMaxLoss - riskResult.metrics.potentialLoss <= 0
                                  ? "text-rose-400" : progress.distanceToDailyDDLimit - riskResult.metrics.potentialLoss <= 0
                                    ? "text-rose-400" : "text-emerald-400"
                              )}>
                                {progress.distanceToMaxLoss - riskResult.metrics.potentialLoss <= 0
                                  ? "FAILED"
                                  : progress.distanceToDailyDDLimit - riskResult.metrics.potentialLoss <= 0
                                    ? "DAILY BREACH"
                                    : "SAFE"}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {riskResult.metrics.potentialProfit > 0 && (
                        <Card className="border-border/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium flex items-center gap-2">
                              <Target size={14} className="text-emerald-400" />
                              If You Hit Suggested TP
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-muted-foreground">New Balance</p>
                                <p className="font-bold text-emerald-400" data-testid="text-win-balance">
                                  {fc(progress.currentBalance + riskResult.metrics.potentialProfit)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Profit from Trade</p>
                                <p className="font-bold text-emerald-400" data-testid="text-win-profit">
                                  +{fc(riskResult.metrics.potentialProfit)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Target Progress</p>
                                <p className="font-bold text-emerald-400" data-testid="text-win-progress">
                                  {(() => {
                                    const total = riskResult.metrics.currentProfit + riskResult.metrics.remainingToTarget;
                                    if (total <= 0) return "100%";
                                    return Math.min(100, ((riskResult.metrics.currentProfit + riskResult.metrics.potentialProfit) / total * 100)).toFixed(0) + "%";
                                  })()}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Remaining to Target</p>
                                <p className={cn("font-bold",
                                  riskResult.metrics.remainingToTarget - riskResult.metrics.potentialProfit <= 0
                                    ? "text-emerald-400" : "text-amber-400"
                                )} data-testid="text-win-remaining">
                                  {riskResult.metrics.remainingToTarget - riskResult.metrics.potentialProfit <= 0
                                    ? "TARGET HIT"
                                    : fc(riskResult.metrics.remainingToTarget - riskResult.metrics.potentialProfit)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {challenge.mt5AccountId && challenge.status === "active" && (
          <MT5PositionsPanel challengeId={challenge.id} />
        )}

        {progress.ruleEvents && progress.ruleEvents.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History size={16} className="text-muted-foreground" />
                Rule Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {progress.ruleEvents.map((evt, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs"
                    data-testid={`rule-event-${i}`}
                  >
                    <span className="text-muted-foreground shrink-0 w-20">{evt.date}</span>
                    <span className={cn(
                      evt.severity === "critical" ? "text-rose-400" : "text-amber-400"
                    )}>
                      {evt.event}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {dailyStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Daily Stats History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Start</th>
                      <th className="pb-2 pr-4">End</th>
                      <th className="pb-2 pr-4">P&L</th>
                      <th className="pb-2">Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dailyStats].reverse().map((stat) => {
                      const pl = parseFloat(stat.dayPl);
                      return (
                        <tr key={stat.id} className="border-b border-border/50" data-testid={`row-daily-stat-${stat.id}`}>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {new Date(stat.date).toLocaleDateString()}
                          </td>
                          <td className="py-2 pr-4">{fc(stat.startingBalance)}</td>
                          <td className="py-2 pr-4">{fc(stat.endingBalance)}</td>
                          <td className={cn("py-2 pr-4 font-semibold", pl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {pl >= 0 ? "+" : ""}{fc(pl)}
                          </td>
                          <td className="py-2">{stat.tradesCount ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {challengeShareData && (
        <MilestoneShareModal
          open={challengeShareOpen}
          onOpenChange={setChallengeShareOpen}
          variant="challenge"
          title="Share Your Result"
          subtitle={`${challengeShareData.firmName} · ${challengeShareData.challengeName}`}
          userName={currentUser?.fullName}
          data={challengeShareData}
        />
      )}
      </>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-2xl tracking-tighter uppercase italic">Prop Firm Tracker</h1>
          <p className="text-muted-foreground text-sm">Manage your prop firm challenges and track progress</p>
        </div>
        <Button
          data-testid="button-new-challenge"
          onClick={() => setView("create")}
        >
          <Plus />
          New Challenge
        </Button>
      </div>

      {isLoadingList ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      ) : !challenges || challenges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <BarChart3 size={48} className="text-muted-foreground/40" />
            <p className="text-muted-foreground text-center">No challenges yet. Create your first prop firm challenge to start tracking.</p>
            <Button
              data-testid="button-new-challenge-empty"
              onClick={() => setView("create")}
            >
              <Plus />
              Create Challenge
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {challenges.map((c) => {
            const acct = parseFloat(c.accountSize);
            const target = parseFloat(c.profitTarget);
            const currentBal = c.currentBalance ? parseFloat(c.currentBalance) : acct;
            const profitPct = acct > 0 ? Math.max(0, ((currentBal - acct) / (acct * target / 100)) * 100) : 0;

            return (
              <Card
                key={c.id}
                className="hover-elevate cursor-pointer"
                onClick={() => openDetail(c.id)}
                data-testid={`card-challenge-${c.id}`}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold">{c.firmName}</CardTitle>
                    <CardDescription className="flex items-center gap-2 flex-wrap">
                      <span>{c.challengeName} &middot; {c.phase}</span>
                      {c.mt5AccountId && (
                        <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[9px] py-0">
                          <Link2 size={8} className="mr-0.5" /> MT5
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusBadgeClass(c.status)}
                    data-testid={`badge-challenge-status-${c.id}`}
                  >
                    {c.status.toUpperCase()}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-semibold">{formatCurrency(acct)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Target</span>
                    <span className="font-semibold">{target}%</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.min(profitPct, 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-1.5">
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          c.status === "passed" ? "bg-blue-500" :
                            c.status === "failed" ? "bg-rose-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.min(profitPct, 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
