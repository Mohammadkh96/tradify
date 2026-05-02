import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { useSampleMode } from "@/hooks/useSampleMode";
import { SampleDataBanner } from "@/components/SampleDataBanner";
import { getSamplePropFirm } from "@/lib/sampleData";

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
  The5ers: {
    firmName: "The5ers",
    accountSize: "100000",
    profitTarget: "8",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "4",
    trailingDrawdown: false,
    drawdownType: "balance",
    minTradingDays: 6,
    maxTradingDays: 999,
    consistencyRule: false,
  },
  Topstep: {
    firmName: "Topstep",
    accountSize: "100000",
    profitTarget: "6",
    dailyDrawdownLimit: "2",
    maxDrawdownLimit: "3",
    trailingDrawdown: true,
    drawdownType: "trailing_equity",
    trailingStopBehavior: "locks_at_breakeven",
    minTradingDays: 5,
    maxTradingDays: 999,
    consistencyRule: false,
  },
  FundedNext: {
    firmName: "FundedNext",
    accountSize: "100000",
    profitTarget: "8",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "10",
    trailingDrawdown: false,
    drawdownType: "balance",
    minTradingDays: 5,
    maxTradingDays: 999,
    consistencyRule: true,
    maxDayProfitPercent: "40",
  },
  "E8 Funding": {
    firmName: "E8 Funding",
    accountSize: "100000",
    profitTarget: "8",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "8",
    trailingDrawdown: false,
    drawdownType: "balance",
    minTradingDays: 5,
    maxTradingDays: 999,
    consistencyRule: true,
    maxDayProfitPercent: "50",
  },
  "Funding Pips": {
    firmName: "Funding Pips",
    accountSize: "100000",
    profitTarget: "8",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "10",
    trailingDrawdown: false,
    drawdownType: "equity",
    minTradingDays: 3,
    maxTradingDays: 999,
    consistencyRule: true,
    maxDayProfitPercent: "50",
  },
  "Lux Trading Firm": {
    firmName: "Lux Trading Firm",
    accountSize: "100000",
    profitTarget: "10",
    dailyDrawdownLimit: "6",
    maxDrawdownLimit: "10",
    trailingDrawdown: false,
    drawdownType: "balance",
    minTradingDays: 0,
    maxTradingDays: 999,
    consistencyRule: false,
  },
  "Alpha Capital Group": {
    firmName: "Alpha Capital Group",
    accountSize: "100000",
    profitTarget: "8",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "10",
    trailingDrawdown: false,
    drawdownType: "balance",
    minTradingDays: 3,
    maxTradingDays: 999,
    consistencyRule: false,
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
  The5ers: [
    { label: "Profit Target", value: "8% (Phase 1)" },
    { label: "Daily Drawdown", value: "5% (balance-based)" },
    { label: "Max Drawdown", value: "4% (static, High Stakes)" },
    { label: "Min Trading Days", value: "6" },
    { label: "Max Trading Days", value: "Unlimited" },
    { label: "Trailing DD", value: "No" },
    { label: "Consistency Rule", value: "No (Hyper Growth) / 50% (High Stakes)" },
  ],
  Topstep: [
    { label: "Profit Target", value: "$6,000 ($100K Combine)" },
    { label: "Daily Drawdown", value: "$2,000 ($100K)" },
    { label: "Max Drawdown", value: "$3,000 trailing ($100K)" },
    { label: "Min Trading Days", value: "5 winning days for first payout" },
    { label: "Max Trading Days", value: "Unlimited (subscription)" },
    { label: "Trailing DD", value: "Yes (locks at start balance)" },
    { label: "Consistency Rule", value: "No (position-size based)" },
  ],
  FundedNext: [
    { label: "Profit Target", value: "8% / 5%" },
    { label: "Daily Drawdown", value: "5% (incl. floating P/L)" },
    { label: "Max Drawdown", value: "10% static" },
    { label: "Min Trading Days", value: "5 (Stellar) / 0 (Express)" },
    { label: "Max Trading Days", value: "Unlimited" },
    { label: "Trailing DD", value: "No" },
    { label: "Consistency Rule", value: "Yes (max 40% per day, Stellar)" },
  ],
  "E8 Funding": [
    { label: "Profit Target", value: "8% / 5%" },
    { label: "Daily Drawdown", value: "5% (balance-based)" },
    { label: "Max Drawdown", value: "8% static" },
    { label: "Min Trading Days", value: "5" },
    { label: "Max Trading Days", value: "Unlimited" },
    { label: "Trailing DD", value: "No" },
    { label: "Consistency Rule", value: "Yes (max 50% per day)" },
  ],
  "Funding Pips": [
    { label: "Profit Target", value: "8% / 5%" },
    { label: "Daily Drawdown", value: "5% (equity-based)" },
    { label: "Max Drawdown", value: "10% static" },
    { label: "Min Trading Days", value: "3" },
    { label: "Max Trading Days", value: "Unlimited" },
    { label: "Trailing DD", value: "No" },
    { label: "Consistency Rule", value: "Yes (max 50% per day, funded)" },
  ],
  "Lux Trading Firm": [
    { label: "Profit Target", value: "10% (no time limit)" },
    { label: "Daily Drawdown", value: "n/a (6% exposure cap)" },
    { label: "Max Drawdown", value: "10% static" },
    { label: "Min Trading Days", value: "None (4 months to scale)" },
    { label: "Max Trading Days", value: "Unlimited (subscription)" },
    { label: "Trailing DD", value: "No" },
    { label: "Consistency Rule", value: "Risk-based (2% per trade max)" },
  ],
  "Alpha Capital Group": [
    { label: "Profit Target", value: "8% / 5%" },
    { label: "Daily Drawdown", value: "5% (balance-based)" },
    { label: "Max Drawdown", value: "10% static" },
    { label: "Min Trading Days", value: "3" },
    { label: "Max Trading Days", value: "Unlimited" },
    { label: "Trailing DD", value: "No" },
    { label: "Consistency Rule", value: "No (Standard) / 25% (Pro)" },
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
  const { t } = useTranslation("propfirm");
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
            {t("mt5LivePositions")}
            {data.connected ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                <Wifi size={8} className="mr-1" /> {t("live").toUpperCase()}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-muted text-[10px]">
                <WifiOff size={8} className="mr-1" /> {t("offline").toUpperCase()}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {t("mt5LiveDesc")}
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
            <p className="text-xs text-muted-foreground font-medium">{t("openPositions", { n: data.positionsCount })}</p>
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
                    <span className="text-muted-foreground">{pos.volume} {t("lots")}</span>
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
              <p className="text-xs text-muted-foreground">{t("dailyDDUsed")}</p>
              <p className={cn("font-bold text-sm",
                data.metrics.dailyDDUsedPercent > 70 ? "text-rose-400" :
                  data.metrics.dailyDDUsedPercent > 40 ? "text-amber-400" : "text-emerald-400"
              )}>
                {data.metrics.dailyDDUsedPercent.toFixed(0)}%
              </p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">{t("dailyDDLeft")}</p>
              <p className="font-bold text-sm">{fc(data.metrics.dailyDDRemaining)}</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/20">
              <p className="text-xs text-muted-foreground">{t("maxDDLeft")}</p>
              <p className="font-bold text-sm">{fc(data.metrics.maxDDRemaining)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PropFirmTracker() {
  const { t } = useTranslation("propfirm");
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
      toast({ title: t("challengeCreated"), description: t("challengeCreatedDesc") });
      setView("list");
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: t("errorTitle"), description: error?.message || t("failedCreateChallenge"), variant: "destructive" });
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
      toast({ title: t("statusUpdated") });
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
      toast({ title: t("challengeDeleted") });
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
      toast({ title: t("dailyStatsRecorded") });
      setDailyForm({ startingBalance: "", endingBalance: "", tradesCount: 0 });
    },
    onError: () => {
      toast({ title: t("errorTitle"), description: t("failedRecordDaily"), variant: "destructive" });
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
      toast({ title: t("errorTitle"), description: t("failedAnalyzeRisk"), variant: "destructive" });
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
    formWarnings.push({ level: "warning", message: t("warnProfitOverDD") });
  }
  if (formData.minTradingDays > 0 && formData.maxTradingDays > 0 && formData.minTradingDays > formData.maxTradingDays) {
    formWarnings.push({ level: "error", message: t("warnMinOverMax") });
  }
  if (formData.startDate && formData.endDate && formData.maxTradingDays > 0) {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const daysBetween = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysBetween < formData.maxTradingDays) {
      formWarnings.push({ level: "warning", message: t("warnEndDateShort", { days: daysBetween, max: formData.maxTradingDays }) });
    }
  }
  const hasBlockingError = formWarnings.some((w) => w.level === "error");

  function handleCreateSubmit() {
    const missing: string[] = [];
    if (!formData.firmName) missing.push(t("field_firmName"));
    if (!formData.challengeName) missing.push(t("field_challengeName"));
    if (!formData.accountSize) missing.push(t("field_accountSize"));
    if (!formData.profitTarget) missing.push(t("field_profitTarget"));
    if (!formData.dailyDrawdownLimit) missing.push(t("field_dailyDrawdown"));
    if (!formData.maxDrawdownLimit) missing.push(t("field_maxDrawdown"));
    if (!formData.startDate) missing.push(t("field_startDate"));
    if (missing.length > 0) {
      toast({ title: t("missingFields"), description: t("missingFieldsDesc", { fields: missing.join(", ") }), variant: "destructive" });
      return;
    }
    if (hasBlockingError) {
      toast({ title: t("cannotCreate"), description: t("cannotCreateDesc"), variant: "destructive" });
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
      toast({ title: t("missingFields"), description: t("endingBalanceRequired"), variant: "destructive" });
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
          <h1 className="font-black text-2xl tracking-tighter uppercase italic">{t("newChallengeHeading")}</h1>
        </div>

        {mt5Accounts && mt5Accounts.length > 0 && (
          <Card className="border-cyan-500/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Monitor size={16} className="text-cyan-400" />
                {t("linkMt5Account")}
              </CardTitle>
              <CardDescription>{t("linkMt5Description")}</CardDescription>
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
                            <Wifi size={8} className="mr-1" /> {t("live")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            <WifiOff size={8} className="mr-1" /> {t("offline")}
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
                    <span className="text-sm">{t("autoSyncDaily")}</span>
                  </label>
                  <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/20">
                    <Link2 size={8} className="mr-1" /> {t("linked")}
                  </Badge>
                </div>
              )}
              {!formData.mt5AccountId && (
                <p className="text-xs text-muted-foreground">
                  {t("selectMt5Hint")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">{t("selectPropFirmPreset")}</CardTitle>
            <CardDescription>{t("selectPropFirmPresetDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {["FTMO", "The5ers", "Topstep", "FundedNext", "E8 Funding", "Funding Pips", "Lux Trading Firm", "Alpha Capital Group", "Custom Firm"].map((name) => (
                <Button
                  key={name}
                  data-testid={`button-preset-${name.toLowerCase().replace(/\s+/g, "-")}`}
                  variant={selectedPreset === name ? "default" : "outline"}
                  onClick={() => applyPreset(name)}
                >
                  {name === "Custom Firm" ? t("customFirm") : name}
                </Button>
              ))}
            </div>

            {selectedPreset && selectedPreset !== "Custom Firm" && PRESET_RULES[selectedPreset] && (
              <Card className="bg-muted/20 border-muted">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {t("rulesSummary", { name: selectedPreset })}
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
                <label className="text-sm font-medium text-muted-foreground">{t("firmName")}</label>
                <Input
                  data-testid="input-firm-name"
                  value={formData.firmName}
                  onChange={(e) => setFormData((p) => ({ ...p, firmName: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{t("firmNameHint")}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("challengeName")}</label>
                <Input
                  data-testid="input-challenge-name"
                  value={formData.challengeName}
                  onChange={(e) => setFormData((p) => ({ ...p, challengeName: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{t("challengeNameHint")}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("phase")}</label>
                <Select
                  value={formData.phase}
                  onValueChange={(v) => setFormData((p) => ({ ...p, phase: v }))}
                >
                  <SelectTrigger data-testid="select-phase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Phase 1">{t("phase1")}</SelectItem>
                    <SelectItem value="Phase 2">{t("phase2")}</SelectItem>
                    <SelectItem value="Funded">{t("funded")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("currency")}</label>
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
                <label className="text-sm font-medium text-muted-foreground">{t("accountSize", { symbol: currSymbol })}</label>
                <Input
                  data-testid="input-account-size"
                  type="number"
                  value={formData.accountSize}
                  onChange={(e) => setFormData((p) => ({ ...p, accountSize: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{t("accountSizeHint")}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("profitTargetLabel")}</label>
                <Input
                  data-testid="input-profit-target"
                  type="number"
                  value={formData.profitTarget}
                  onChange={(e) => setFormData((p) => ({ ...p, profitTarget: e.target.value }))}
                />
                {acctSizeNum > 0 && profitTargetNum > 0 && (
                  <p className="text-xs text-emerald-400">
                    {t("targetEquity", { value: `${currSymbol}${(acctSizeNum + acctSizeNum * profitTargetNum / 100).toLocaleString()}` })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t("profitTargetHint")}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("dailyDrawdownLimitLabel")}</label>
                <Input
                  data-testid="input-daily-dd"
                  type="number"
                  value={formData.dailyDrawdownLimit}
                  onChange={(e) => setFormData((p) => ({ ...p, dailyDrawdownLimit: e.target.value }))}
                />
                {acctSizeNum > 0 && dailyDDNum > 0 && (
                  <p className="text-xs text-amber-400">
                    {t("maxDailyLoss", { value: `${currSymbol}${(acctSizeNum * dailyDDNum / 100).toLocaleString()}` })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t("dailyDrawdownLimitHint")}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("maxDrawdownLimitLabel")}</label>
                <Input
                  data-testid="input-max-dd"
                  type="number"
                  value={formData.maxDrawdownLimit}
                  onChange={(e) => setFormData((p) => ({ ...p, maxDrawdownLimit: e.target.value }))}
                />
                {acctSizeNum > 0 && maxDDNum > 0 && (
                  <p className="text-xs text-rose-400">
                    {t("maxTotalLossText", { loss: `${currSymbol}${(acctSizeNum * maxDDNum / 100).toLocaleString()}`, breach: `${currSymbol}${(acctSizeNum - acctSizeNum * maxDDNum / 100).toLocaleString()}` })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t("maxDrawdownLimitHint")}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t("drawdownCalcType")}</label>
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
                    <SelectItem value="static">{t("ddStatic")}</SelectItem>
                    <SelectItem value="balance">{t("ddBalance")}</SelectItem>
                    <SelectItem value="equity">{t("ddEquity")}</SelectItem>
                    <SelectItem value="trailing_balance">{t("ddTrailingBalance")}</SelectItem>
                    <SelectItem value="trailing_equity">{t("ddTrailingEquity")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.drawdownType === "static" && t("ddStaticDesc")}
                  {formData.drawdownType === "balance" && t("ddBalanceDesc")}
                  {formData.drawdownType === "equity" && t("ddEquityDesc")}
                  {formData.drawdownType === "trailing_balance" && t("ddTrailingBalanceDesc")}
                  {formData.drawdownType === "trailing_equity" && t("ddTrailingEquityDesc")}
                </p>
              </div>

              {formData.trailingDrawdown && (
                <div className="space-y-2 pl-4 border-l-2 border-amber-500/30">
                  <label className="text-sm font-medium text-muted-foreground">{t("trailingStopBehavior")}</label>
                  <Select
                    value={formData.trailingStopBehavior}
                    onValueChange={(v) => setFormData((p) => ({ ...p, trailingStopBehavior: v }))}
                  >
                    <SelectTrigger data-testid="select-trailing-behavior">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always_trails">{t("alwaysTrails")}</SelectItem>
                      <SelectItem value="locks_at_breakeven">{t("locksAtBreakeven")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.trailingStopBehavior === "always_trails"
                      ? t("alwaysTrailsDesc")
                      : t("locksAtBreakevenDesc")}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("minTradingDaysLabel")}</label>
                <Input
                  data-testid="input-min-days"
                  type="number"
                  value={formData.minTradingDays}
                  onChange={(e) => setFormData((p) => ({ ...p, minTradingDays: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">{t("minTradingDaysHint")}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("maxTradingDaysLabel")}</label>
                <Input
                  data-testid="input-max-days"
                  type="number"
                  value={formData.maxTradingDays}
                  onChange={(e) => setFormData((p) => ({ ...p, maxTradingDays: parseInt(e.target.value) || 30 }))}
                />
                <p className="text-xs text-muted-foreground">{t("maxTradingDaysHint")}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("startDate")}</label>
                <Input
                  data-testid="input-start-date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{t("endDate")}</label>
                <Input
                  data-testid="input-end-date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  {t("endDateHint")}
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
                  <span className="text-sm">{t("consistencyRule")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    data-testid="checkbox-phase-link"
                    type="checkbox"
                    checked={formData.phaseLink}
                    onChange={(e) => setFormData((p) => ({ ...p, phaseLink: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="text-sm">{t("linksNextPhase")}</span>
                </label>
              </div>

              {formData.consistencyRule && (
                <div className="space-y-2 pl-4 border-l-2 border-cyan-500/30">
                  <label className="text-sm font-medium text-muted-foreground">{t("maxSingleDayProfit")}</label>
                  <Input
                    data-testid="input-max-day-profit"
                    type="number"
                    value={formData.maxDayProfitPercent}
                    onChange={(e) => setFormData((p) => ({ ...p, maxDayProfitPercent: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("maxSingleDayDesc")}
                  </p>
                  {acctSizeNum > 0 && profitTargetNum > 0 && consistencyPctNum > 0 && (
                    <p className="text-xs text-cyan-400">
                      {t("maxAllowedDailyProfit", { value: `${currSymbol}${((acctSizeNum * profitTargetNum / 100) * consistencyPctNum / 100).toLocaleString()}` })}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{t("maxSingleDayHint")}</p>
                </div>
              )}

              {formData.phaseLink && (
                <div className="pl-4 border-l-2 border-blue-500/30">
                  <p className="text-xs text-blue-400">
                    {t("phaseLinkInfo")}
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
                    {t("challengePreview")}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-md bg-background/50">
                      <p className="text-xs text-muted-foreground">{t("previewProfitTarget")}</p>
                      <p className="font-bold text-emerald-400">{currSymbol}{(acctSizeNum * profitTargetNum / 100).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{t("previewToReach", { value: `${currSymbol}${(acctSizeNum + acctSizeNum * profitTargetNum / 100).toLocaleString()}` })}</p>
                    </div>
                    <div className="text-center p-3 rounded-md bg-background/50">
                      <p className="text-xs text-muted-foreground">{t("previewMaxDailyLoss")}</p>
                      <p className="font-bold text-amber-400">{currSymbol}{(acctSizeNum * dailyDDNum / 100).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{t("perDay")}</p>
                    </div>
                    <div className="text-center p-3 rounded-md bg-background/50">
                      <p className="text-xs text-muted-foreground">{t("previewMaxTotalLoss")}</p>
                      <p className="font-bold text-rose-400">{currSymbol}{(acctSizeNum * maxDDNum / 100).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{t("previewBreachAt", { value: `${currSymbol}${(acctSizeNum - acctSizeNum * maxDDNum / 100).toLocaleString()}` })}</p>
                    </div>
                    <div className="text-center p-3 rounded-md bg-background/50">
                      <p className="text-xs text-muted-foreground">{t("previewTradingWindow")}</p>
                      <p className="font-bold">{formData.minTradingDays}–{formData.maxTradingDays}</p>
                      <p className="text-xs text-muted-foreground">{t("days")}</p>
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
              {t("createChallenge")}
            </Button>
            <Button
              data-testid="button-cancel-create"
              variant="ghost"
              onClick={() => { setView("list"); resetForm(); }}
            >
              {t("cancel")}
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
          <p className="text-muted-foreground">{t("challengeNotFound")}</p>
          <Button data-testid="button-back-not-found" variant="ghost" className="mt-4" onClick={() => setView("list")}>
            {t("backToList")}
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
                {challenge.mt5AutoSync && ` ${t("mt5Auto")}`}
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
                    {t("eligiblePass")}
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
                    {t("shareResult")}
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
                  {t("passManual")}
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
                  {t("ruleBreachFail")}
                </Button>
              ) : (
                <Button
                  data-testid="button-fail-challenge"
                  variant="destructive"
                  onClick={() => updateStatusMutation.mutate({ id: challenge.id, status: "failed" })}
                  disabled={updateStatusMutation.isPending}
                >
                  <XCircle />
                  {t("failManual")}
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

        {(challenge.status === "passed" || challenge.status === "failed") && (
          <div className="flex gap-2 flex-wrap mb-4">
            <Button
              data-testid="button-share-challenge-result"
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
                  status: challenge.status as "passed" | "failed",
                };
                setChallengeShareData(cardData);
                setChallengeShareOpen(true);
              }}
            >
              <Share2 size={14} />
              {t("shareResult")}
            </Button>
          </div>
        )}

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
                {t("passEligible")}
              </Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("profitTarget")}</CardTitle>
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
                {t("remaining", { value: fc(progress.distanceToProfitTarget) })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("dailyDrawdown")}</CardTitle>
              <TrendingDown size={16} className="text-amber-500" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              <CircularGauge
                value={progress.dailyDDUsedPercent}
                color={getGaugeColor(progress.dailyDDUsedPercent)}
                label={`${progress.dailyDDUsedPercent.toFixed(1)}%`}
                sublabel={t("ofDailyLimit")}
              />
              <div className="text-xs text-muted-foreground text-center space-y-0.5">
                <p>{t("dailyRemainingOf", { r: fc(progress.dailyDDRemaining), a: fc(progress.dailyDDAmount) })}</p>
                <p className="text-[10px] opacity-70">{t("resetsAtClose")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {challenge.trailingDrawdown ? t("trailingDD") : t("maxDD")}
              </CardTitle>
              <Activity size={16} className="text-rose-500" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              <CircularGauge
                value={progress.maxDDUsedPercent}
                color={getGaugeColor(progress.maxDDUsedPercent)}
                label={`${progress.maxDDUsedPercent.toFixed(1)}%`}
                sublabel={t("ofMaxLimit")}
              />
              <div className="text-xs text-muted-foreground text-center space-y-0.5">
                <p>{t("hwm", { value: fc(progress.highWaterMark) })}</p>
                {challenge.trailingDrawdown && <p>{t("floor", { value: fc(progress.trailingDDFloor) })}</p>}
                <p>{t("buffer", { value: fc(progress.maxDDRemaining) })}</p>
              </div>
            </CardContent>
          </Card>

          {challenge.consistencyRule && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("consistency")}</CardTitle>
                <ShieldCheck size={16} className="text-emerald-500" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col items-center gap-2">
                  <CircularGauge
                    value={progress.consistencyScore}
                    color={progress.consistencyScore >= 70 ? "#10b981" : progress.consistencyScore >= 40 ? "#f59e0b" : "#f43f5e"}
                    label={`${progress.consistencyScore.toFixed(0)}%`}
                    sublabel={t("consistencyScore")}
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/50">
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span>{t("maxDailyContribution")}</span>
                    <span className="font-semibold text-foreground">{fc(progress.consistencyMaxAllowedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>{t("todayUsed")}</span>
                    <span className={cn("font-semibold", progress.consistencyTodayUsed > progress.consistencyMaxAllowedAmount ? "text-rose-400" : "text-foreground")}>
                      {fc(progress.consistencyTodayUsed)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>{t("remainingShort")}</span>
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
              <CardTitle className="text-sm font-medium">{t("tradingDays")}</CardTitle>
              <Calendar size={16} className="text-emerald-500" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <span className="text-3xl font-black tracking-tighter">
                  {progress.uniqueTradingDays}
                </span>
                <span className="text-muted-foreground text-sm"> {t("daysOfMin", { min: progress.minTradingDays })}</span>
              </div>
              <div className="w-full bg-muted/30 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((progress.uniqueTradingDays / Math.max(progress.minTradingDays, 1)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{progress.minDaysMet ? <CheckCircle2 size={12} className="inline text-emerald-400 mr-1" /> : <Clock size={12} className="inline text-amber-400 mr-1" />}{progress.minDaysMet ? t("minDaysMet") : t("daysRemainingCount", { n: Math.max(0, progress.minTradingDays - progress.uniqueTradingDays) })}</span>
                <span>{t("daysElapsed", { n: progress.daysElapsed })}</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 text-center">
                {t("tradingDayHint")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("daysRemainingTitle")}</CardTitle>
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
                  <p className="text-xs text-muted-foreground">{t("daysLeft")}</p>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">{t("noDeadlineSet")}</span>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("currentBalance")}</CardTitle>
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
                <span className="text-xs text-muted-foreground">{t("toProfitTarget")}</span>
                <span className={cn("text-sm font-bold", progress.distanceToProfitTarget <= 0 ? "text-emerald-400" : "text-foreground")}>
                  {progress.distanceToProfitTarget <= 0 ? t("targetMet") : `+${fc(progress.distanceToProfitTarget)}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/20">
                <span className="text-xs text-muted-foreground">{challenge.trailingDrawdown ? t("toTrailFloor") : t("toMaxLoss")}</span>
                <span className={cn("text-sm font-bold", progress.distanceToMaxLoss < acctSize * 0.02 ? "text-rose-400" : "text-foreground")}>
                  -{fc(progress.distanceToMaxLoss)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-muted/20">
                <span className="text-xs text-muted-foreground">{t("dailyDDLeft")}</span>
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
                {t("logDailyResults")}
                {challenge.mt5AutoSync && (
                  <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">
                    <Link2 size={8} className="mr-1" /> {t("autoSyncedFromMt5")}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {challenge.mt5AutoSync
                  ? t("logDailyAutoDesc")
                  : t("logDailyManualDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock size={10} /> {t("startingBalanceAuto")}
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
                  <label className="text-xs text-muted-foreground">{t("endingBalance")}</label>
                  <Input
                    data-testid="input-daily-end-balance"
                    type="number"
                    value={dailyForm.endingBalance}
                    onChange={(e) => setDailyForm((p) => ({ ...p, endingBalance: e.target.value }))}
                    placeholder={t("endingBalancePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("tradesCount")}</label>
                  <Input
                    data-testid="input-daily-trades-count"
                    type="number"
                    value={dailyForm.tradesCount}
                    onChange={(e) => setDailyForm((p) => ({ ...p, tradesCount: parseInt(e.target.value) || 0 }))}
                    placeholder={t("tradesPlaceholder")}
                  />
                </div>
              </div>
              {dailyForm.endingBalance && (
                <div className="mt-3 p-3 rounded-md bg-muted/20 text-xs text-muted-foreground">
                  <span className="font-medium">{t("previewLabel")}</span>
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
                {t("recordDailyStats")}
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
                  {t("aiRiskAnalysis")}
                </CardTitle>
                <CardDescription>{t("aiRiskDesc")}</CardDescription>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                {t("elite")}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("pair")}</label>
                  <Input
                    data-testid="input-risk-pair"
                    value={riskCheckForm.pair}
                    onChange={(e) => setRiskCheckForm((p) => ({ ...p, pair: e.target.value.toUpperCase() }))}
                    placeholder="EURUSD"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("direction")}</label>
                  <Select
                    value={riskCheckForm.tradeDirection}
                    onValueChange={(v) => setRiskCheckForm((p) => ({ ...p, tradeDirection: v }))}
                  >
                    <SelectTrigger data-testid="select-risk-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Long">{t("long")}</SelectItem>
                      <SelectItem value="Short">{t("short")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t("entryPrice")}</label>
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
                  <label className="text-xs text-muted-foreground">{t("stopLoss")}</label>
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
                  <label className="text-xs text-muted-foreground">{t("lotSize")}</label>
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
                  <label className="text-xs text-muted-foreground">{t("openPL")}</label>
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
                {t("analyzeRisk")}
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
                          ? t("verdictBreach")
                          : riskResult.warnings.some((w: any) => w.level === "warning")
                            ? t("verdictRisks")
                            : t("verdictSafe")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {riskResult.warnings.length === 0
                          ? t("allLimitsSafe")
                          : t("issuesDetected", { count: riskResult.warnings.length })}
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
                      <p className="text-xs text-muted-foreground">{t("potentialLoss")}</p>
                      <p className="font-bold text-rose-400" data-testid="text-potential-loss">{fc(riskResult.metrics.potentialLoss)}</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-muted/20">
                      <p className="text-xs text-muted-foreground">{t("dailyDDLeft")}</p>
                      <p className="font-bold" data-testid="text-daily-dd-left">{fc(riskResult.metrics.dailyDDRemaining)}</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-muted/20">
                      <p className="text-xs text-muted-foreground">{t("maxDDLeft")}</p>
                      <p className="font-bold" data-testid="text-max-dd-left">{fc(riskResult.metrics.maxDDRemaining)}</p>
                    </div>
                    {riskResult.metrics.suggestedMaxSL && (
                      <div className="text-center p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <p className="text-xs text-amber-400">{t("suggestedSL")}</p>
                        <p className="font-bold text-amber-300" data-testid="text-suggested-sl">{riskResult.metrics.suggestedMaxSL}</p>
                      </div>
                    )}
                    {riskResult.metrics.suggestedTP && (
                      <div className="text-center p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-xs text-emerald-400">{t("suggestedTP")}</p>
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
                            {t("ifYouLose")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground">{t("newBalance")}</p>
                              <p className="font-bold text-rose-400">
                                {fc(progress.currentBalance - riskResult.metrics.potentialLoss)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t("newDDBuffer", { label: challenge.trailingDrawdown ? t("labelTrail") : t("labelMax") })}</p>
                              <p className={cn("font-bold",
                                progress.distanceToMaxLoss - riskResult.metrics.potentialLoss <= 0 ? "text-rose-400" : "text-amber-400"
                              )}>
                                {fc(Math.max(0, progress.distanceToMaxLoss - riskResult.metrics.potentialLoss))}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t("dailyDDRemaining")}</p>
                              <p className={cn("font-bold",
                                progress.distanceToDailyDDLimit - riskResult.metrics.potentialLoss <= 0 ? "text-rose-400" : "text-amber-400"
                              )}>
                                {fc(Math.max(0, progress.distanceToDailyDDLimit - riskResult.metrics.potentialLoss))}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t("challengeStatus")}</p>
                              <p className={cn("font-bold",
                                progress.distanceToMaxLoss - riskResult.metrics.potentialLoss <= 0
                                  ? "text-rose-400" : progress.distanceToDailyDDLimit - riskResult.metrics.potentialLoss <= 0
                                    ? "text-rose-400" : "text-emerald-400"
                              )}>
                                {progress.distanceToMaxLoss - riskResult.metrics.potentialLoss <= 0
                                  ? t("statusFailed")
                                  : progress.distanceToDailyDDLimit - riskResult.metrics.potentialLoss <= 0
                                    ? t("statusDailyBreach")
                                    : t("statusSafe")}
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
                              {t("ifYouHitTP")}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-muted-foreground">{t("newBalance")}</p>
                                <p className="font-bold text-emerald-400" data-testid="text-win-balance">
                                  {fc(progress.currentBalance + riskResult.metrics.potentialProfit)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{t("profitFromTrade")}</p>
                                <p className="font-bold text-emerald-400" data-testid="text-win-profit">
                                  +{fc(riskResult.metrics.potentialProfit)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{t("targetProgress")}</p>
                                <p className="font-bold text-emerald-400" data-testid="text-win-progress">
                                  {(() => {
                                    const total = riskResult.metrics.currentProfit + riskResult.metrics.remainingToTarget;
                                    if (total <= 0) return "100%";
                                    return Math.min(100, ((riskResult.metrics.currentProfit + riskResult.metrics.potentialProfit) / total * 100)).toFixed(0) + "%";
                                  })()}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">{t("remainingToTarget")}</p>
                                <p className={cn("font-bold",
                                  riskResult.metrics.remainingToTarget - riskResult.metrics.potentialProfit <= 0
                                    ? "text-emerald-400" : "text-amber-400"
                                )} data-testid="text-win-remaining">
                                  {riskResult.metrics.remainingToTarget - riskResult.metrics.potentialProfit <= 0
                                    ? t("targetHit")
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
                {t("ruleEvents")}
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
              <CardTitle className="text-sm font-medium">{t("dailyStatsHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-2 pr-4">{t("colDate")}</th>
                      <th className="pb-2 pr-4">{t("colStart")}</th>
                      <th className="pb-2 pr-4">{t("colEnd")}</th>
                      <th className="pb-2 pr-4">{t("colPL")}</th>
                      <th className="pb-2">{t("colTrades")}</th>
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
          title={t("shareResultTitle")}
          subtitle={`${challengeShareData.firmName} · ${challengeShareData.challengeName}`}
          userName={currentUser?.fullName}
          data={challengeShareData}
        />
      )}
      </>
    );
  }

  const sampleMode = useSampleMode();
  const showSampleChallenge =
    sampleMode.active && (!challenges || challenges.length === 0);
  const sampleChallenge = showSampleChallenge ? getSamplePropFirm() : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {sampleMode.active && (
        <SampleDataBanner surface="this prop firm tracker" />
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-2xl tracking-tighter uppercase italic">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button
          data-testid="button-new-challenge"
          onClick={() => setView("create")}
        >
          <Plus />
          {t("newChallenge")}
        </Button>
      </div>

      {showSampleChallenge && sampleChallenge ? (
        <Card
          className="border-emerald-500/30 bg-emerald-500/5"
          data-testid="card-sample-challenge"
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  {sampleChallenge.firmName}
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  >
                    {t("sample")}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {sampleChallenge.challengeName} · {sampleChallenge.phase}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">
                ${parseFloat(sampleChallenge.accountSize).toLocaleString()}{" "}
                {t("accountSuffix")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t("profitTarget")}</span>
                <span>{t("samplePctReached", { pct: 62 })}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: "62%" }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t("sampleDDUsed")}</span>
                <span>34%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500"
                  style={{ width: "34%" }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("sampleReplacedHint")}
            </p>
          </CardContent>
        </Card>
      ) : isLoadingList ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
        </div>
      ) : !challenges || challenges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <BarChart3 size={48} className="text-muted-foreground/40" />
            <p className="text-muted-foreground text-center">{t("noChallenges")}</p>
            <Button
              data-testid="button-new-challenge-empty"
              onClick={() => setView("create")}
            >
              <Plus />
              {t("createChallenge")}
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
                    <span className="text-muted-foreground">{t("account")}</span>
                    <span className="font-semibold">{formatCurrency(acct)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{t("target")}</span>
                    <span className="font-semibold">{target}%</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{t("progress")}</span>
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
