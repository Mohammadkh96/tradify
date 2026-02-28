import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, RefreshCw,
  Plus, Trash2, Pencil, AlertTriangle, Check, X, Activity,
  Cpu, Users, Layers
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CostOverview {
  today: string;
  week: string;
  month: string;
  allTime: string;
  totalRequests: number;
}

interface TierBreakdown {
  tier: string;
  totalCost: string;
  requestCount: number;
  percentage: string;
}

interface FeatureBreakdown {
  feature: string;
  totalCost: string;
  requestCount: number;
  percentage: string;
}

interface ModelBreakdown {
  model: string;
  totalCost: string;
  requestCount: number;
  percentage: string;
}

interface DailyCost {
  date: string;
  totalCost: string;
  requestCount: number;
}

interface TopUser {
  userId: string;
  userTier: string;
  totalCost: string;
  requestCount: number;
}

interface PerUserTier {
  tier: string;
  avgCost: string;
  userCount: number;
  totalCost: string;
}

interface RevenueData {
  estimatedMonthlyRevenue: string;
  proUsers: number;
  eliteUsers: number;
  proRevenue: string;
  eliteRevenue: string;
}

interface ManualCostEntry {
  id: number;
  name: string;
  category: string;
  amount: string;
  frequency: string;
  notes: string | null;
  createdAt: string;
}

interface BudgetAlert {
  id: number;
  monthlyBudget: string;
  alertThreshold: number;
  isActive: boolean;
}

const tierColors: Record<string, string> = {
  free: "border-muted-foreground/30 text-muted-foreground",
  FREE: "border-muted-foreground/30 text-muted-foreground",
  pro: "border-emerald-500/30 text-emerald-500",
  PRO: "border-emerald-500/30 text-emerald-500",
  elite: "border-amber-500/30 text-amber-500",
  ELITE: "border-amber-500/30 text-amber-500",
};

const categoryColors: Record<string, string> = {
  hosting: "border-blue-500/30 text-blue-500",
  domain: "border-purple-500/30 text-purple-500",
  database: "border-cyan-500/30 text-cyan-500",
  email: "border-pink-500/30 text-pink-500",
  other: "border-muted-foreground/30 text-muted-foreground",
};

function formatUsd(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function formatUsdPrecise(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.000000";
  if (num < 0.01) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(2)}`;
}

export default function CostIntelligence() {
  const { toast } = useToast();
  const [manualCostDialogOpen, setManualCostDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<ManualCostEntry | null>(null);
  const [costName, setCostName] = useState("");
  const [costCategory, setCostCategory] = useState("hosting");
  const [costAmount, setCostAmount] = useState("");
  const [costFrequency, setCostFrequency] = useState("monthly");
  const [costNotes, setCostNotes] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetThreshold, setBudgetThreshold] = useState("80");
  const [budgetActive, setBudgetActive] = useState(true);

  const { data: overview, isLoading: loadingOverview } = useQuery<CostOverview>({
    queryKey: ["/api/admin/costs/overview"],
  });

  const { data: byTier, isLoading: loadingTier } = useQuery<TierBreakdown[]>({
    queryKey: ["/api/admin/costs/by-tier"],
  });

  const { data: byFeature, isLoading: loadingFeature } = useQuery<FeatureBreakdown[]>({
    queryKey: ["/api/admin/costs/by-feature"],
  });

  const { data: byModel, isLoading: loadingModel } = useQuery<ModelBreakdown[]>({
    queryKey: ["/api/admin/costs/by-model"],
  });

  const { data: daily, isLoading: loadingDaily } = useQuery<DailyCost[]>({
    queryKey: ["/api/admin/costs/daily"],
  });

  const { data: topUsers, isLoading: loadingTopUsers } = useQuery<TopUser[]>({
    queryKey: ["/api/admin/costs/top-users"],
  });

  const { data: perUserTier, isLoading: loadingPerUser } = useQuery<PerUserTier[]>({
    queryKey: ["/api/admin/costs/per-user-tier"],
  });

  const { data: revenue, isLoading: loadingRevenue } = useQuery<RevenueData>({
    queryKey: ["/api/admin/costs/revenue"],
  });

  const { data: manualCosts, isLoading: loadingManual } = useQuery<ManualCostEntry[]>({
    queryKey: ["/api/admin/costs/manual"],
  });

  const { data: budget, isLoading: loadingBudget } = useQuery<BudgetAlert>({
    queryKey: ["/api/admin/costs/budget"],
  });

  const addManualCostMutation = useMutation({
    mutationFn: async (data: { name: string; category: string; amount: string; frequency: string; notes: string }) => {
      const res = await apiRequest("POST", "/api/admin/costs/manual", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/manual"] });
      resetCostForm();
      setManualCostDialogOpen(false);
      toast({ title: "Added", description: "Manual cost entry added." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to add cost entry." });
    },
  });

  const updateManualCostMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; category: string; amount: string; frequency: string; notes: string }) => {
      const res = await apiRequest("PUT", `/api/admin/costs/manual/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/manual"] });
      resetCostForm();
      setManualCostDialogOpen(false);
      setEditingCost(null);
      toast({ title: "Updated", description: "Manual cost entry updated." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to update cost entry." });
    },
  });

  const deleteManualCostMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/costs/manual/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/manual"] });
      toast({ title: "Deleted", description: "Manual cost entry removed." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete cost entry." });
    },
  });

  const saveBudgetMutation = useMutation({
    mutationFn: async (data: { monthlyBudget: string; alertThreshold: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", "/api/admin/costs/budget", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/budget"] });
      toast({ title: "Saved", description: "Budget alert settings updated." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save budget settings." });
    },
  });

  function resetCostForm() {
    setCostName("");
    setCostCategory("hosting");
    setCostAmount("");
    setCostFrequency("monthly");
    setCostNotes("");
  }

  function openEditDialog(cost: ManualCostEntry) {
    setEditingCost(cost);
    setCostName(cost.name);
    setCostCategory(cost.category);
    setCostAmount(cost.amount);
    setCostFrequency(cost.frequency);
    setCostNotes(cost.notes || "");
    setManualCostDialogOpen(true);
  }

  function handleSubmitCost() {
    const data = { name: costName, category: costCategory, amount: costAmount, frequency: costFrequency, notes: costNotes };
    if (editingCost) {
      updateManualCostMutation.mutate({ id: editingCost.id, ...data });
    } else {
      addManualCostMutation.mutate(data);
    }
  }

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/costs"] });
  }

  const totalMonthlyFixed = manualCosts?.reduce((sum, c) => {
    const amt = parseFloat(c.amount) || 0;
    if (c.frequency === "monthly") return sum + amt;
    if (c.frequency === "annual") return sum + amt / 12;
    return sum;
  }, 0) || 0;

  const monthlyAICost = parseFloat(overview?.month || "0");
  const monthlyRevenue = parseFloat(revenue?.estimatedMonthlyRevenue || "0");
  const profitMargin = monthlyRevenue > 0 ? ((monthlyRevenue - monthlyAICost - totalMonthlyFixed) / monthlyRevenue * 100) : 0;
  const budgetUsedPercent = budget && parseFloat(budget.monthlyBudget) > 0
    ? (monthlyAICost / parseFloat(budget.monthlyBudget)) * 100
    : 0;
  const budgetExceeded = budget && budgetUsedPercent >= 100;
  const budgetWarning = budget && budget.isActive && budgetUsedPercent >= (budget.alertThreshold || 80);

  const maxDailyCost = daily?.reduce((max, d) => Math.max(max, parseFloat(d.totalCost) || 0), 0) || 1;

  const isLoading = loadingOverview || loadingTier || loadingFeature || loadingModel || loadingDaily || loadingTopUsers || loadingPerUser || loadingRevenue || loadingManual || loadingBudget;

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 bg-background min-h-screen text-foreground" data-testid="cost-intelligence-loading">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[1, 2].map(i => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6 space-y-4">
                {[1, 2, 3].map(j => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground" data-testid="cost-intelligence-dashboard">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-cost-intelligence-title">
            <DollarSign /> Cost Intelligence
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold" data-testid="text-cost-intelligence-subtitle">
            AI Spend & Revenue Analytics
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={refreshAll}
          data-testid="button-refresh-costs"
        >
          <RefreshCw size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border" data-testid="card-spend-today">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-foreground" data-testid="text-spend-today">{formatUsd(overview?.today || "0")}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">AI Spend Today</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <DollarSign size={20} className="text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-spend-week">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-foreground" data-testid="text-spend-week">{formatUsd(overview?.week || "0")}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">This Week</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-blue-500/10 flex items-center justify-center">
                <Activity size={20} className="text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-spend-month">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-foreground" data-testid="text-spend-month">{formatUsd(overview?.month || "0")}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">This Month</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-purple-500/10 flex items-center justify-center">
                <BarChart3 size={20} className="text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-spend-alltime">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-black text-emerald-500" data-testid="text-spend-alltime">{formatUsd(overview?.allTime || "0")}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">All Time</div>
              </div>
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border" data-testid="card-monthly-revenue">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-2xl font-black text-emerald-500" data-testid="text-monthly-revenue">{formatUsd(revenue?.estimatedMonthlyRevenue || "0")}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Est. Monthly Revenue</div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  {revenue?.proUsers || 0} Pro x $29 + {revenue?.eliteUsers || 0} Elite x $59
                </div>
              </div>
              <div className="h-10 w-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp size={20} className="text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-monthly-ai-cost">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-2xl font-black text-foreground" data-testid="text-monthly-ai-cost">{formatUsd(overview?.month || "0")}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Monthly AI Cost</div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  + {formatUsd(totalMonthlyFixed)} fixed costs
                </div>
              </div>
              <div className="h-10 w-10 rounded-md bg-rose-500/10 flex items-center justify-center">
                <Cpu size={20} className="text-rose-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-profit-margin">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className={`text-2xl font-black ${profitMargin >= 0 ? "text-emerald-500" : "text-rose-500"}`} data-testid="text-profit-margin">
                  {profitMargin.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Profit Margin</div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  {formatUsd(monthlyRevenue - monthlyAICost - totalMonthlyFixed)} net
                </div>
              </div>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center ${profitMargin >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                {profitMargin >= 0 ? <TrendingUp size={20} className="text-emerald-500" /> : <TrendingDown size={20} className="text-rose-500" />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border" data-testid="card-cost-by-tier">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Layers size={16} className="text-emerald-500" /> Cost by Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!byTier || byTier.length === 0 ? (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-tier-data">No AI usage data yet.</p>
            ) : (
              <div className="space-y-4">
                {byTier.map((t) => {
                  const pct = parseFloat(t.percentage) || 0;
                  return (
                    <div key={t.tier} className="space-y-1" data-testid={`row-tier-${t.tier}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${tierColors[t.tier] || tierColors.free}`}>
                            {t.tier}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{t.requestCount} requests</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{formatUsdPrecise(t.totalCost)}</span>
                          <span className="text-xs text-muted-foreground">({pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-cost-by-feature">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-500" /> Cost by Feature
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!byFeature || byFeature.length === 0 ? (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-feature-data">No AI usage data yet.</p>
            ) : (
              <div className="space-y-3">
                {byFeature.map((f) => {
                  const pct = parseFloat(f.percentage) || 0;
                  return (
                    <div key={f.feature} className="flex items-center justify-between gap-4" data-testid={`row-feature-${f.feature}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-foreground font-bold truncate">{f.feature.replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-foreground w-16 text-right">{formatUsdPrecise(f.totalCost)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border" data-testid="card-cost-by-model">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Cpu size={16} className="text-emerald-500" /> Cost by Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!byModel || byModel.length === 0 ? (
            <p className="text-sm text-muted-foreground italic" data-testid="text-no-model-data">No AI usage data yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {byModel.map((m) => (
                <div key={m.model} className="p-4 bg-muted rounded-md" data-testid={`card-model-${m.model}`}>
                  <div className="text-lg font-black text-foreground">{formatUsdPrecise(m.totalCost)}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">{m.model}</div>
                  <div className="text-xs text-muted-foreground mt-2">{m.requestCount} requests ({parseFloat(m.percentage || "0").toFixed(1)}%)</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border" data-testid="card-daily-trend">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" /> Daily Cost Trend (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!daily || daily.length === 0 ? (
            <p className="text-sm text-muted-foreground italic" data-testid="text-no-daily-data">No daily cost data available yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-1 h-40" data-testid="chart-daily-costs">
                {daily.map((d, i) => {
                  const cost = parseFloat(d.totalCost) || 0;
                  const heightPct = maxDailyCost > 0 ? (cost / maxDailyCost) * 100 : 0;
                  return (
                    <div
                      key={d.date || i}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                      data-testid={`bar-daily-${i}`}
                    >
                      <div
                        className="w-full bg-emerald-500/80 rounded-t-sm min-h-[2px] transition-all"
                        style={{ height: `${Math.max(2, heightPct)}%` }}
                      />
                      <div className="invisible group-hover:visible absolute bottom-full mb-1 bg-card border border-border rounded-md p-2 text-[10px] z-50 whitespace-nowrap shadow-lg">
                        <div className="font-bold text-foreground">{formatUsdPrecise(d.totalCost)}</div>
                        <div className="text-muted-foreground">{d.date ? format(new Date(d.date), "MMM d") : `Day ${i + 1}`}</div>
                        <div className="text-muted-foreground">{d.requestCount} requests</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{daily[0]?.date ? format(new Date(daily[0].date), "MMM d") : ""}</span>
                <span>{daily[daily.length - 1]?.date ? format(new Date(daily[daily.length - 1].date), "MMM d") : ""}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border" data-testid="card-top-users">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-emerald-500" /> Top 10 Users by Cost
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!topUsers || topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic p-6" data-testid="text-no-top-users">No user cost data yet.</p>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">User</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Tier</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest text-right">Cost</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest text-right">Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsers.map((user, idx) => (
                    <TableRow key={user.userId} className="border-border" data-testid={`row-top-user-${idx}`}>
                      <TableCell className="font-bold text-foreground text-xs truncate max-w-[200px]" data-testid={`text-top-user-email-${idx}`}>{user.userId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${tierColors[user.userTier] || tierColors.free}`}>
                          {user.userTier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground text-xs" data-testid={`text-top-user-cost-${idx}`}>{formatUsdPrecise(user.totalCost)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs" data-testid={`text-top-user-requests-${idx}`}>{user.requestCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-avg-cost-per-tier">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-emerald-500" /> Avg Cost per User by Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!perUserTier || perUserTier.length === 0 ? (
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-per-user-data">No per-user cost data yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {perUserTier.map((t) => (
                  <div key={t.tier} className="p-4 bg-muted rounded-md" data-testid={`card-avg-tier-${t.tier}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest mb-2 ${tierColors[t.tier] || tierColors.free}`}>
                          {t.tier}
                        </Badge>
                        <div className="text-lg font-black text-foreground">{formatUsdPrecise(t.avgCost)}</div>
                        <div className="text-[10px] text-muted-foreground">avg per user</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-foreground">{t.userCount}</div>
                        <div className="text-[10px] text-muted-foreground">users</div>
                        <div className="text-xs text-muted-foreground mt-1">{formatUsdPrecise(t.totalCost)} total</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border" data-testid="card-manual-costs">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-500" /> Manual Fixed Costs
          </CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              Total Monthly: <span className="font-bold text-foreground">{formatUsd(totalMonthlyFixed)}</span>
            </div>
            <Dialog open={manualCostDialogOpen} onOpenChange={(open) => {
              setManualCostDialogOpen(open);
              if (!open) { setEditingCost(null); resetCostForm(); }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-add-manual-cost" onClick={() => { setEditingCost(null); resetCostForm(); }}>
                  <Plus size={14} className="mr-1" /> Add Cost
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-manual-cost">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold uppercase tracking-widest">
                    {editingCost ? "Edit Cost Entry" : "Add Cost Entry"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Name</label>
                    <Input
                      value={costName}
                      onChange={(e) => setCostName(e.target.value)}
                      placeholder="e.g. Replit Hosting"
                      className="bg-muted border-border text-sm"
                      data-testid="input-cost-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Category</label>
                    <Select value={costCategory} onValueChange={setCostCategory}>
                      <SelectTrigger className="bg-muted border-border text-sm" data-testid="select-cost-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hosting">Hosting</SelectItem>
                        <SelectItem value="domain">Domain</SelectItem>
                        <SelectItem value="database">Database</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount (USD)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={costAmount}
                      onChange={(e) => setCostAmount(e.target.value)}
                      placeholder="29.99"
                      className="bg-muted border-border text-sm"
                      data-testid="input-cost-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Frequency</label>
                    <Select value={costFrequency} onValueChange={setCostFrequency}>
                      <SelectTrigger className="bg-muted border-border text-sm" data-testid="select-cost-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="one_time">One Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Notes</label>
                    <Textarea
                      value={costNotes}
                      onChange={(e) => setCostNotes(e.target.value)}
                      placeholder="Optional notes..."
                      className="bg-muted border-border text-sm resize-none"
                      data-testid="input-cost-notes"
                    />
                  </div>
                  <Button
                    className="w-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                    onClick={handleSubmitCost}
                    disabled={addManualCostMutation.isPending || updateManualCostMutation.isPending || !costName || !costAmount}
                    data-testid="button-submit-manual-cost"
                  >
                    {addManualCostMutation.isPending || updateManualCostMutation.isPending ? "Saving..." : editingCost ? "Update Cost" : "Add Cost"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!manualCosts || manualCosts.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground italic" data-testid="text-no-manual-costs">No manual cost entries yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Name</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Category</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest text-right">Amount</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Frequency</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualCosts.map((cost) => (
                  <TableRow key={cost.id} className="border-border" data-testid={`row-manual-cost-${cost.id}`}>
                    <TableCell>
                      <div className="font-bold text-foreground text-xs">{cost.name}</div>
                      {cost.notes && <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{cost.notes}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${categoryColors[cost.category] || categoryColors.other}`}>
                        {cost.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground text-xs">{formatUsd(cost.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-muted-foreground/30 text-muted-foreground">
                        {cost.frequency.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(cost)}
                          data-testid={`button-edit-cost-${cost.id}`}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteManualCostMutation.mutate(cost.id)}
                          disabled={deleteManualCostMutation.isPending}
                          data-testid={`button-delete-cost-${cost.id}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border" data-testid="card-budget-alert">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle size={16} className="text-emerald-500" /> Budget Alert Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {budgetWarning && (
            <div className={`p-4 rounded-md flex items-center gap-3 ${budgetExceeded ? "bg-rose-500/10 border border-rose-500/20" : "bg-amber-500/10 border border-amber-500/20"}`} data-testid="alert-budget-warning">
              <AlertTriangle size={20} className={budgetExceeded ? "text-rose-500" : "text-amber-500"} />
              <div>
                <div className={`text-sm font-bold ${budgetExceeded ? "text-rose-500" : "text-amber-500"}`}>
                  {budgetExceeded ? "Budget Exceeded!" : "Approaching Budget Limit"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Current spend: {formatUsd(monthlyAICost)} / {formatUsd(budget?.monthlyBudget || "0")} ({budgetUsedPercent.toFixed(1)}%)
                </div>
              </div>
            </div>
          )}

          {budget && parseFloat(budget.monthlyBudget) > 0 && (
            <div className="space-y-2" data-testid="budget-progress-section">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Monthly AI Spend vs Budget</span>
                <span className="font-bold text-foreground">{formatUsd(monthlyAICost)} / {formatUsd(budget.monthlyBudget)}</span>
              </div>
              <Progress
                value={Math.min(100, budgetUsedPercent)}
                className={`h-3 ${budgetExceeded ? "[&>div]:bg-rose-500" : budgetWarning ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
                data-testid="progress-budget"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>Alert at {budget.alertThreshold}%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Monthly Budget (USD)</label>
              <Input
                type="number"
                step="1"
                value={budgetAmount || budget?.monthlyBudget || ""}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="100"
                className="bg-muted border-border text-sm"
                data-testid="input-budget-amount"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Alert Threshold (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={budgetThreshold || budget?.alertThreshold?.toString() || "80"}
                onChange={(e) => setBudgetThreshold(e.target.value)}
                placeholder="80"
                className="bg-muted border-border text-sm"
                data-testid="input-budget-threshold"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                onClick={() => saveBudgetMutation.mutate({
                  monthlyBudget: budgetAmount || budget?.monthlyBudget || "0",
                  alertThreshold: parseInt(budgetThreshold || budget?.alertThreshold?.toString() || "80"),
                  isActive: budgetActive,
                })}
                disabled={saveBudgetMutation.isPending}
                data-testid="button-save-budget"
              >
                {saveBudgetMutation.isPending ? "Saving..." : "Save Budget"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}