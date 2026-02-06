import { useState } from "react";
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
} from "lucide-react";
import type { PropFirmChallenge, PropFirmDailyStat } from "@shared/schema";

type ViewState = "list" | "create" | "detail";

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
  uniqueTradingDays: number;
  minTradingDays: number;
  daysElapsed: number;
  daysRemaining: number | null;
  consistencyScore: number;
  worstDayProfitPercent: number;
  status: string;
};

type ChallengeDetail = {
  challenge: PropFirmChallenge;
  dailyStats: PropFirmDailyStat[];
  progress: ChallengeProgress;
};

const PRESETS: Record<string, Partial<Record<string, any>>> = {
  FTMO: {
    firmName: "FTMO",
    accountSize: "100000",
    profitTarget: "10",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "10",
    trailingDrawdown: true,
    minTradingDays: 10,
    maxTradingDays: 30,
  },
  MyFundedFX: {
    firmName: "MyFundedFX",
    accountSize: "100000",
    profitTarget: "8",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "8",
    trailingDrawdown: true,
    minTradingDays: 5,
    maxTradingDays: 30,
  },
  "The Funded Trader": {
    firmName: "The Funded Trader",
    accountSize: "100000",
    profitTarget: "8",
    dailyDrawdownLimit: "5",
    maxDrawdownLimit: "10",
    trailingDrawdown: true,
    minTradingDays: 5,
    maxTradingDays: 30,
  },
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

function formatCurrency(val: number | string | null | undefined) {
  const n = typeof val === "string" ? parseFloat(val) : (val ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function PropFirmTracker() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewState>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  const [formData, setFormData] = useState({
    firmName: "",
    challengeName: "",
    phase: "Phase 1",
    accountSize: "",
    profitTarget: "",
    dailyDrawdownLimit: "",
    maxDrawdownLimit: "",
    trailingDrawdown: false,
    minTradingDays: 0,
    maxTradingDays: 30,
    consistencyRule: false,
    maxDayProfitPercent: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });

  const [dailyForm, setDailyForm] = useState({
    startingBalance: "",
    endingBalance: "",
    tradesCount: 0,
  });

  const { data: challenges, isLoading: isLoadingList } = useQuery<PropFirmChallenge[]>({
    queryKey: ["/api/prop-firm/challenges"],
  });

  const { data: detailData, isLoading: isLoadingDetail } = useQuery<ChallengeDetail>({
    queryKey: ["/api/prop-firm/challenges", selectedId],
    enabled: view === "detail" && selectedId !== null,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/prop-firm/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create challenge");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prop-firm/challenges"] });
      toast({ title: "Challenge created", description: "Your prop firm challenge has been set up." });
      setView("list");
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create challenge.", variant: "destructive" });
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
      profitProgress: number;
      currentProfit: number;
      remainingToTarget: number;
      suggestedMaxSL: string | null;
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
      profitTarget: "",
      dailyDrawdownLimit: "",
      maxDrawdownLimit: "",
      trailingDrawdown: false,
      minTradingDays: 0,
      maxTradingDays: 30,
      consistencyRule: false,
      maxDayProfitPercent: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
    });
    setSelectedPreset("");
  }

  function applyPreset(name: string) {
    if (name === "Custom") {
      resetForm();
      setSelectedPreset("Custom");
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
        minTradingDays: p.minTradingDays || 0,
        maxTradingDays: p.maxTradingDays || 30,
      }));
      setSelectedPreset(name);
    }
  }

  function handleCreateSubmit() {
    if (!formData.firmName || !formData.accountSize || !formData.profitTarget) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...formData,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      minTradingDays: Number(formData.minTradingDays),
      maxTradingDays: Number(formData.maxTradingDays),
    });
  }

  function handleDailySubmit() {
    if (!dailyForm.startingBalance || !dailyForm.endingBalance) {
      toast({ title: "Missing fields", description: "Starting and ending balance required.", variant: "destructive" });
      return;
    }
    dailyStatMutation.mutate({
      challengeId: selectedId,
      date: new Date().toISOString(),
      startingBalance: dailyForm.startingBalance,
      endingBalance: dailyForm.endingBalance,
      dayPl: String(parseFloat(dailyForm.endingBalance) - parseFloat(dailyForm.startingBalance)),
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Select Prop Firm Preset</CardTitle>
            <CardDescription>Choose a preset or configure a custom challenge</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {["FTMO", "MyFundedFX", "The Funded Trader", "Custom"].map((name) => (
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Firm Name</label>
                <Input
                  data-testid="input-firm-name"
                  value={formData.firmName}
                  onChange={(e) => setFormData((p) => ({ ...p, firmName: e.target.value }))}
                  placeholder="e.g. FTMO"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Challenge Name</label>
                <Input
                  data-testid="input-challenge-name"
                  value={formData.challengeName}
                  onChange={(e) => setFormData((p) => ({ ...p, challengeName: e.target.value }))}
                  placeholder="e.g. 100K Phase 1"
                />
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
                <label className="text-sm font-medium text-muted-foreground">Account Size ($)</label>
                <Input
                  data-testid="input-account-size"
                  type="number"
                  value={formData.accountSize}
                  onChange={(e) => setFormData((p) => ({ ...p, accountSize: e.target.value }))}
                  placeholder="100000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Profit Target (%)</label>
                <Input
                  data-testid="input-profit-target"
                  type="number"
                  value={formData.profitTarget}
                  onChange={(e) => setFormData((p) => ({ ...p, profitTarget: e.target.value }))}
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Daily Drawdown Limit (%)</label>
                <Input
                  data-testid="input-daily-dd"
                  type="number"
                  value={formData.dailyDrawdownLimit}
                  onChange={(e) => setFormData((p) => ({ ...p, dailyDrawdownLimit: e.target.value }))}
                  placeholder="5"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Max Drawdown Limit (%)</label>
                <Input
                  data-testid="input-max-dd"
                  type="number"
                  value={formData.maxDrawdownLimit}
                  onChange={(e) => setFormData((p) => ({ ...p, maxDrawdownLimit: e.target.value }))}
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Min Trading Days</label>
                <Input
                  data-testid="input-min-days"
                  type="number"
                  value={formData.minTradingDays}
                  onChange={(e) => setFormData((p) => ({ ...p, minTradingDays: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Max Trading Days</label>
                <Input
                  data-testid="input-max-days"
                  type="number"
                  value={formData.maxTradingDays}
                  onChange={(e) => setFormData((p) => ({ ...p, maxTradingDays: parseInt(e.target.value) || 30 }))}
                />
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
                <label className="text-sm font-medium text-muted-foreground">End Date (optional)</label>
                <Input
                  data-testid="input-end-date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Max Day Profit % (consistency)</label>
                <Input
                  data-testid="input-max-day-profit"
                  type="number"
                  value={formData.maxDayProfitPercent}
                  onChange={(e) => setFormData((p) => ({ ...p, maxDayProfitPercent: e.target.value }))}
                  placeholder="e.g. 40"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  data-testid="checkbox-trailing-dd"
                  type="checkbox"
                  checked={formData.trailingDrawdown}
                  onChange={(e) => setFormData((p) => ({ ...p, trailingDrawdown: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">Trailing Drawdown</span>
              </label>
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
            </div>
          </CardContent>
          <CardFooter className="flex gap-3 flex-wrap">
            <Button
              data-testid="button-create-challenge"
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending}
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

    return (
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
                {challenge.challengeName} &middot; {challenge.phase} &middot; {formatCurrency(acctSize)}
              </p>
            </div>
            <Badge
              data-testid={`badge-status-${challenge.status}`}
              variant="outline"
              className={statusBadgeClass(challenge.status)}
            >
              {challenge.status.toUpperCase()}
            </Badge>
          </div>
          {challenge.status === "active" && (
            <div className="flex gap-2 flex-wrap">
              <Button
                data-testid="button-pass-challenge"
                variant="outline"
                onClick={() => updateStatusMutation.mutate({ id: challenge.id, status: "passed" })}
                disabled={updateStatusMutation.isPending}
              >
                <CheckCircle2 className="text-blue-400" />
                Pass
              </Button>
              <Button
                data-testid="button-fail-challenge"
                variant="destructive"
                onClick={() => updateStatusMutation.mutate({ id: challenge.id, status: "failed" })}
                disabled={updateStatusMutation.isPending}
              >
                <XCircle />
                Fail
              </Button>
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
                sublabel={`${formatCurrency(progress.currentProfit)} / ${formatCurrency(profitTargetAmt)}`}
              />
              <p className="text-xs text-muted-foreground">
                Remaining: {formatCurrency(profitTargetAmt - progress.currentProfit)}
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
              <p className="text-xs text-muted-foreground">
                Remaining: {formatCurrency(progress.dailyDDRemaining)} of {formatCurrency(progress.dailyDDAmount)}
              </p>
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
                <p>HWM: {formatCurrency(progress.highWaterMark)}</p>
                {challenge.trailingDrawdown && <p>Floor: {formatCurrency(progress.trailingDDFloor)}</p>}
                <p>Buffer: {formatCurrency(progress.maxDDRemaining)}</p>
              </div>
            </CardContent>
          </Card>

          {challenge.consistencyRule && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Consistency</CardTitle>
                <ShieldCheck size={16} className="text-emerald-500" />
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-2">
                <CircularGauge
                  value={progress.consistencyScore}
                  color={progress.consistencyScore >= 70 ? "#10b981" : progress.consistencyScore >= 40 ? "#f59e0b" : "#f43f5e"}
                  label={`${progress.consistencyScore.toFixed(0)}%`}
                  sublabel="consistency score"
                />
                <p className="text-xs text-muted-foreground">
                  Worst day: {progress.worstDayProfitPercent.toFixed(1)}%
                </p>
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
              <p className="text-xs text-muted-foreground text-center">
                {progress.daysElapsed} days elapsed
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
            <TrendingUp size={16} className="text-emerald-500" />
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-black tracking-tighter">{formatCurrency(progress.currentBalance)}</span>
            <span className={cn(
              "ml-3 text-sm font-semibold",
              progress.currentProfit >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {progress.currentProfit >= 0 ? "+" : ""}{formatCurrency(progress.currentProfit)}
            </span>
          </CardContent>
        </Card>

        {challenge.status === "active" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Log Daily Results</CardTitle>
              <CardDescription>Record today's trading performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Starting Balance</label>
                  <Input
                    data-testid="input-daily-start-balance"
                    type="number"
                    value={dailyForm.startingBalance}
                    onChange={(e) => setDailyForm((p) => ({ ...p, startingBalance: e.target.value }))}
                    placeholder={String(progress.currentBalance)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Ending Balance</label>
                  <Input
                    data-testid="input-daily-end-balance"
                    type="number"
                    value={dailyForm.endingBalance}
                    onChange={(e) => setDailyForm((p) => ({ ...p, endingBalance: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Trades Count</label>
                  <Input
                    data-testid="input-daily-trades-count"
                    type="number"
                    value={dailyForm.tradesCount}
                    onChange={(e) => setDailyForm((p) => ({ ...p, tradesCount: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
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
                <div className="space-y-3 pt-2">
                  {riskResult.warnings.length > 0 ? (
                    <div className="space-y-2">
                      {riskResult.warnings.map((w, i) => (
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
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm" data-testid="risk-clear">
                      <CheckCircle2 size={18} />
                      <span>Trade is within safe risk parameters for this challenge.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="text-center p-2 rounded-md bg-muted/20">
                      <p className="text-xs text-muted-foreground">Potential Loss</p>
                      <p className="font-bold text-rose-400">{formatCurrency(riskResult.metrics.potentialLoss)}</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-muted/20">
                      <p className="text-xs text-muted-foreground">Daily DD Left</p>
                      <p className="font-bold">{formatCurrency(riskResult.metrics.dailyDDRemaining)}</p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-muted/20">
                      <p className="text-xs text-muted-foreground">Max DD Left</p>
                      <p className="font-bold">{formatCurrency(riskResult.metrics.maxDDRemaining)}</p>
                    </div>
                    {riskResult.metrics.suggestedMaxSL && (
                      <div className="text-center p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <p className="text-xs text-amber-400">Suggested SL</p>
                        <p className="font-bold text-amber-300">{riskResult.metrics.suggestedMaxSL}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                          <td className="py-2 pr-4">{formatCurrency(stat.startingBalance)}</td>
                          <td className="py-2 pr-4">{formatCurrency(stat.endingBalance)}</td>
                          <td className={cn("py-2 pr-4 font-semibold", pl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {pl >= 0 ? "+" : ""}{formatCurrency(pl)}
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
                    <CardDescription>{c.challengeName} &middot; {c.phase}</CardDescription>
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
