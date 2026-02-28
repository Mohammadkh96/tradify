import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, RefreshCw,
  Plus, Trash2, Pencil, AlertTriangle, Activity,
  Cpu, Users, Layers, Search, Filter, X, Download,
  ChevronLeft, ChevronRight, Eye, Calendar
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
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";

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

interface UsageLog {
  id: number;
  userId: string;
  userTier: string;
  feature: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: string;
  requestDuration: number | null;
  createdAt: string;
}

interface LogSearchResult {
  logs: UsageLog[];
  total: number;
  page: number;
  totalPages: number;
}

interface UserProfile {
  totalCost: string;
  requestCount: number;
  byFeature: { feature: string; totalCost: string; count: number }[];
  byModel: { model: string; totalCost: string; count: number }[];
  dailyTrend: { date: string; totalCost: string; count: number }[];
  recentLogs: UsageLog[];
}

const tierColors: Record<string, string> = {
  free: "border-muted-foreground/30 text-muted-foreground",
  FREE: "border-muted-foreground/30 text-muted-foreground",
  pro: "border-emerald-500/30 text-emerald-500",
  PRO: "border-emerald-500/30 text-emerald-500",
  elite: "border-amber-500/30 text-amber-500",
  ELITE: "border-amber-500/30 text-amber-500",
  ADMIN: "border-purple-500/30 text-purple-500",
};

const categoryColors: Record<string, string> = {
  hosting: "border-blue-500/30 text-blue-500",
  domain: "border-purple-500/30 text-purple-500",
  database: "border-cyan-500/30 text-cyan-500",
  email: "border-pink-500/30 text-pink-500",
  replit_deployment: "border-orange-500/30 text-orange-500",
  replit_compute: "border-yellow-500/30 text-yellow-500",
  replit_agent: "border-violet-500/30 text-violet-500",
  replit_storage: "border-teal-500/30 text-teal-500",
  other: "border-muted-foreground/30 text-muted-foreground",
};

const PERIOD_PRESETS = [
  { label: "Today", value: "today" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "3 Months", value: "3m" },
  { label: "6 Months", value: "6m" },
  { label: "This Year", value: "this_year" },
  { label: "All Time", value: "all" },
];

const FEATURE_OPTIONS = [
  "performance_insights", "psychology_review", "monthly_review",
  "instrument_analysis", "education_ai", "compliance_analysis",
  "marketing_content", "chat", "voice_chat", "image_generation", "transcription"
];

const MODEL_OPTIONS = [
  "gpt-4o-mini", "gpt-4o", "gpt-5.1", "gpt-image-1", "gpt-audio-mini", "gpt-4o-mini-transcribe"
];

const COST_PRESETS = [
  { name: "Replit Reserved VM", category: "replit_compute", amount: "25", frequency: "monthly" },
  { name: "Replit Deployment", category: "replit_deployment", amount: "7", frequency: "monthly" },
  { name: "Replit Agent Usage", category: "replit_agent", amount: "", frequency: "monthly" },
  { name: "Neon Database", category: "database", amount: "19", frequency: "monthly" },
  { name: "Domain Registration", category: "domain", amount: "12", frequency: "annual" },
];

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

function getDateRange(period: string): { from?: string; to?: string } {
  const now = new Date();
  switch (period) {
    case "today": return { from: format(now, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    case "7d": return { from: format(subDays(now, 7), "yyyy-MM-dd") };
    case "30d": return { from: format(subDays(now, 30), "yyyy-MM-dd") };
    case "this_month": return { from: format(startOfMonth(now), "yyyy-MM-dd") };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd") };
    }
    case "3m": return { from: format(subMonths(now, 3), "yyyy-MM-dd") };
    case "6m": return { from: format(subMonths(now, 6), "yyyy-MM-dd") };
    case "this_year": return { from: format(startOfYear(now), "yyyy-MM-dd") };
    case "all": return {};
    default: return {};
  }
}

export default function CostIntelligence() {
  const { toast } = useToast();

  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [filterFeature, setFilterFeature] = useState("");
  const [filterModel, setFilterModel] = useState("");

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

  const [logsPage, setLogsPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(25);
  const [logsSearch, setLogsSearch] = useState("");
  const [logsSort, setLogsSort] = useState("date");
  const [logsSortOrder, setLogsSortOrder] = useState("desc");
  const [showLogs, setShowLogs] = useState(false);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const dateRange = useMemo(() => {
    if (customFrom || customTo) return { from: customFrom || undefined, to: customTo || undefined };
    return getDateRange(period);
  }, [period, customFrom, customTo]);

  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    if (filterTier) params.set("tier", filterTier);
    if (filterFeature) params.set("feature", filterFeature);
    if (filterModel) params.set("model", filterModel);
    return params.toString();
  }, [dateRange, filterTier, filterFeature, filterModel]);

  const hasFilters = period !== "all" || customFrom || customTo || filterTier || filterFeature || filterModel;

  function clearFilters() {
    setPeriod("all");
    setCustomFrom("");
    setCustomTo("");
    setFilterTier("");
    setFilterFeature("");
    setFilterModel("");
  }

  const { data: overview, isLoading: loadingOverview } = useQuery<CostOverview>({
    queryKey: ["/api/admin/costs/overview", filterParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/costs/overview${filterParams ? "?" + filterParams : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: byTier } = useQuery<TierBreakdown[]>({
    queryKey: ["/api/admin/costs/by-tier", filterParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/costs/by-tier${filterParams ? "?" + filterParams : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: byFeature } = useQuery<FeatureBreakdown[]>({
    queryKey: ["/api/admin/costs/by-feature", filterParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/costs/by-feature${filterParams ? "?" + filterParams : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: byModel } = useQuery<ModelBreakdown[]>({
    queryKey: ["/api/admin/costs/by-model", filterParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/costs/by-model${filterParams ? "?" + filterParams : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: daily } = useQuery<DailyCost[]>({
    queryKey: ["/api/admin/costs/daily", filterParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/costs/daily${filterParams ? "?" + filterParams : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: topUsers } = useQuery<TopUser[]>({
    queryKey: ["/api/admin/costs/top-users", filterParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/costs/top-users${filterParams ? "?" + filterParams : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: perUserTier } = useQuery<PerUserTier[]>({
    queryKey: ["/api/admin/costs/per-user-tier"],
  });

  const { data: revenue } = useQuery<RevenueData>({
    queryKey: ["/api/admin/costs/revenue"],
  });

  const { data: manualCosts, isLoading: loadingManual } = useQuery<ManualCostEntry[]>({
    queryKey: ["/api/admin/costs/manual"],
  });

  const { data: budget } = useQuery<BudgetAlert>({
    queryKey: ["/api/admin/costs/budget"],
  });

  const logsFilterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (logsSearch) params.set("userId", logsSearch);
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    if (filterTier) params.set("tier", filterTier);
    if (filterFeature) params.set("feature", filterFeature);
    if (filterModel) params.set("model", filterModel);
    params.set("page", logsPage.toString());
    params.set("limit", logsPerPage.toString());
    params.set("sort", logsSort);
    params.set("order", logsSortOrder);
    return params.toString();
  }, [logsSearch, dateRange, filterTier, filterFeature, filterModel, logsPage, logsPerPage, logsSort, logsSortOrder]);

  const { data: logsData, isLoading: loadingLogs } = useQuery<LogSearchResult>({
    queryKey: ["/api/admin/costs/logs", logsFilterParams],
    queryFn: async () => {
      const res = await fetch(`/api/admin/costs/logs?${logsFilterParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: showLogs,
  });

  const { data: userProfile, isLoading: loadingUserProfile } = useQuery<UserProfile>({
    queryKey: ["/api/admin/costs/user", selectedUser, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set("from", dateRange.from);
      if (dateRange.to) params.set("to", dateRange.to);
      const qs = params.toString();
      const res = await fetch(`/api/admin/costs/user/${encodeURIComponent(selectedUser!)}${qs ? "?" + qs : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedUser,
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

  function applyPreset(preset: typeof COST_PRESETS[0]) {
    setCostName(preset.name);
    setCostCategory(preset.category);
    setCostAmount(preset.amount);
    setCostFrequency(preset.frequency);
    setCostNotes("");
    setEditingCost(null);
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

  function handleLogSort(col: string) {
    if (logsSort === col) {
      setLogsSortOrder(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setLogsSort(col);
      setLogsSortOrder("desc");
    }
    setLogsPage(1);
  }

  function csvQuote(val: string | number | null | undefined): string {
    const s = val == null ? "" : String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function exportCsv() {
    if (!logsData?.logs?.length) return;
    const headers = ["Date", "User", "Tier", "Feature", "Model", "Prompt Tokens", "Completion Tokens", "Total Tokens", "Cost (USD)", "Duration (ms)"];
    const rows = logsData.logs.map(l => [
      l.createdAt ? format(new Date(l.createdAt), "yyyy-MM-dd HH:mm:ss") : "",
      l.userId, l.userTier, l.feature, l.model,
      l.promptTokens, l.completionTokens, l.totalTokens,
      l.costUsd, l.requestDuration ?? ""
    ]);
    const csv = [headers.map(csvQuote).join(","), ...rows.map(r => r.map(csvQuote).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-costs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const filteredTopUsers = useMemo(() => {
    if (!topUsers) return [];
    if (!userSearchQuery) return topUsers;
    return topUsers.filter(u => u.userId.toLowerCase().includes(userSearchQuery.toLowerCase()));
  }, [topUsers, userSearchQuery]);

  if (loadingOverview && !overview) {
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
        <Button variant="outline" size="icon" onClick={refreshAll} data-testid="button-refresh-costs">
          <RefreshCw size={16} />
        </Button>
      </div>

      <Card className="bg-card border-border" data-testid="card-filters">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filters</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 ml-2" data-testid="button-clear-filters">
                <X size={12} className="mr-1" /> Clear All
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2" data-testid="period-presets">
            {PERIOD_PRESETS.map(p => (
              <Button
                key={p.value}
                variant={period === p.value && !customFrom && !customTo ? "default" : "outline"}
                size="sm"
                className={`text-xs h-7 ${period === p.value && !customFrom && !customTo ? "bg-emerald-500 text-slate-950 font-bold" : ""}`}
                onClick={() => { setPeriod(p.value); setCustomFrom(""); setCustomTo(""); setLogsPage(1); }}
                data-testid={`button-period-${p.value}`}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">From</label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPeriod("all"); setLogsPage(1); }}
                className="bg-muted border-border text-xs h-8 w-40"
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">To</label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPeriod("all"); setLogsPage(1); }}
                className="bg-muted border-border text-xs h-8 w-40"
                data-testid="input-date-to"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tier</label>
              <Select value={filterTier} onValueChange={(v) => { setFilterTier(v === "all" ? "" : v); setLogsPage(1); }}>
                <SelectTrigger className="bg-muted border-border text-xs h-8 w-28" data-testid="select-filter-tier">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="PRO">Pro</SelectItem>
                  <SelectItem value="ELITE">Elite</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Feature</label>
              <Select value={filterFeature} onValueChange={(v) => { setFilterFeature(v === "all" ? "" : v); setLogsPage(1); }}>
                <SelectTrigger className="bg-muted border-border text-xs h-8 w-40" data-testid="select-filter-feature">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Features</SelectItem>
                  {FEATURE_OPTIONS.map(f => (
                    <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Model</label>
              <Select value={filterModel} onValueChange={(v) => { setFilterModel(v === "all" ? "" : v); setLogsPage(1); }}>
                <SelectTrigger className="bg-muted border-border text-xs h-8 w-36" data-testid="select-filter-model">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {MODEL_OPTIONS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasFilters && (
            <div className="flex flex-wrap gap-1" data-testid="active-filters">
              {period !== "all" && !customFrom && !customTo && (
                <Badge variant="outline" className="text-[9px] font-bold gap-1">
                  <Calendar size={10} /> {PERIOD_PRESETS.find(p => p.value === period)?.label}
                  <button onClick={() => setPeriod("all")}><X size={10} /></button>
                </Badge>
              )}
              {customFrom && (
                <Badge variant="outline" className="text-[9px] font-bold gap-1">
                  From: {customFrom}
                  <button onClick={() => setCustomFrom("")}><X size={10} /></button>
                </Badge>
              )}
              {customTo && (
                <Badge variant="outline" className="text-[9px] font-bold gap-1">
                  To: {customTo}
                  <button onClick={() => setCustomTo("")}><X size={10} /></button>
                </Badge>
              )}
              {filterTier && (
                <Badge variant="outline" className="text-[9px] font-bold gap-1">
                  Tier: {filterTier}
                  <button onClick={() => setFilterTier("")}><X size={10} /></button>
                </Badge>
              )}
              {filterFeature && (
                <Badge variant="outline" className="text-[9px] font-bold gap-1">
                  Feature: {filterFeature.replace(/_/g, " ")}
                  <button onClick={() => setFilterFeature("")}><X size={10} /></button>
                </Badge>
              )}
              {filterModel && (
                <Badge variant="outline" className="text-[9px] font-bold gap-1">
                  Model: {filterModel}
                  <button onClick={() => setFilterModel("")}><X size={10} /></button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">All Time ({overview?.totalRequests || 0} requests)</div>
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
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
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
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
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
            <Activity size={16} className="text-emerald-500" /> Daily Cost Trend
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
                    <div key={d.date || i} className="flex-1 flex flex-col items-center justify-end h-full group relative" data-testid={`bar-daily-${i}`}>
                      <div className="w-full bg-emerald-500/80 rounded-t-sm min-h-[2px] transition-all" style={{ height: `${Math.max(2, heightPct)}%` }} />
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
              <Users size={16} className="text-emerald-500" /> Top Users by Cost
            </CardTitle>
            <div className="relative mt-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="bg-muted border-border text-xs h-8 pl-8"
                data-testid="input-search-users"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredTopUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic p-6" data-testid="text-no-top-users">No user cost data yet.</p>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">User</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Tier</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest text-right">Cost</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest text-right">Requests</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopUsers.map((user, idx) => (
                    <TableRow key={user.userId} className="border-border hover:bg-muted/30 cursor-pointer" data-testid={`row-top-user-${idx}`} onClick={() => setSelectedUser(user.userId)}>
                      <TableCell className="font-bold text-foreground text-xs truncate max-w-[200px]" data-testid={`text-top-user-email-${idx}`}>{user.userId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest ${tierColors[user.userTier] || tierColors.free}`}>
                          {user.userTier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground text-xs" data-testid={`text-top-user-cost-${idx}`}>{formatUsdPrecise(user.totalCost)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs" data-testid={`text-top-user-requests-${idx}`}>{user.requestCount}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`button-view-user-${idx}`}>
                          <Eye size={14} />
                        </Button>
                      </TableCell>
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

      <Card className="bg-card border-border" data-testid="card-usage-logs">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" /> Usage Logs
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!logsData?.logs?.length} className="text-xs h-7" data-testid="button-export-csv">
              <Download size={12} className="mr-1" /> CSV
            </Button>
            <Button variant={showLogs ? "default" : "outline"} size="sm" onClick={() => setShowLogs(!showLogs)}
              className={`text-xs h-7 ${showLogs ? "bg-emerald-500 text-slate-950" : ""}`} data-testid="button-toggle-logs">
              {showLogs ? "Hide Logs" : "Show Logs"}
            </Button>
          </div>
        </CardHeader>
        {showLogs && (
          <CardContent className="p-0">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by user email..."
                    value={logsSearch}
                    onChange={(e) => { setLogsSearch(e.target.value); setLogsPage(1); }}
                    className="bg-muted border-border text-xs h-8 pl-8"
                    data-testid="input-logs-search"
                  />
                </div>
                <Select value={logsPerPage.toString()} onValueChange={(v) => { setLogsPerPage(parseInt(v)); setLogsPage(1); }}>
                  <SelectTrigger className="bg-muted border-border text-xs h-8 w-24" data-testid="select-logs-per-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 rows</SelectItem>
                    <SelectItem value="25">25 rows</SelectItem>
                    <SelectItem value="50">50 rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {loadingLogs ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !logsData?.logs?.length ? (
              <p className="text-sm text-muted-foreground italic p-6" data-testid="text-no-logs">No usage logs found.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border">
                        {[
                          { key: "date", label: "Date" },
                          { key: "user", label: "User" },
                          { key: "tier", label: "Tier" },
                          { key: "feature", label: "Feature" },
                          { key: "model", label: "Model" },
                          { key: "tokens", label: "Tokens" },
                          { key: "cost", label: "Cost" },
                          { key: "duration", label: "Duration" },
                        ].map(col => (
                          <TableHead
                            key={col.key}
                            className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest cursor-pointer hover:text-foreground"
                            onClick={() => handleLogSort(col.key)}
                            data-testid={`th-logs-${col.key}`}
                          >
                            {col.label} {logsSort === col.key && (logsSortOrder === "desc" ? "↓" : "↑")}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsData.logs.map((log) => (
                        <TableRow key={log.id} className="border-border" data-testid={`row-log-${log.id}`}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {log.createdAt ? format(new Date(log.createdAt), "MMM d, HH:mm") : "-"}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-foreground truncate max-w-[160px]">
                            <button className="hover:underline text-left" onClick={() => setSelectedUser(log.userId)} data-testid={`link-log-user-${log.id}`}>
                              {log.userId}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[8px] font-black uppercase ${tierColors[log.userTier] || tierColors.free}`}>
                              {log.userTier}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-foreground">{log.feature.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.model}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {log.promptTokens}+{log.completionTokens}={log.totalTokens}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-foreground">{formatUsdPrecise(log.costUsd)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.requestDuration ? `${(log.requestDuration / 1000).toFixed(1)}s` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between p-4 border-t border-border">
                  <div className="text-xs text-muted-foreground" data-testid="text-logs-pagination-info">
                    Showing {((logsData.page - 1) * logsPerPage) + 1}-{Math.min(logsData.page * logsPerPage, logsData.total)} of {logsData.total}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={logsData.page <= 1} onClick={() => setLogsPage(p => p - 1)} className="h-7" data-testid="button-logs-prev">
                      <ChevronLeft size={14} />
                    </Button>
                    <span className="text-xs text-muted-foreground">Page {logsData.page} of {logsData.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={logsData.page >= logsData.totalPages} onClick={() => setLogsPage(p => p + 1)} className="h-7" data-testid="button-logs-next">
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

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
                  <div className="flex flex-wrap gap-2" data-testid="cost-presets">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-full">Quick Presets</span>
                    {COST_PRESETS.map(p => (
                      <Button
                        key={p.name}
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-6"
                        onClick={() => { setCostName(p.name); setCostCategory(p.category); setCostAmount(p.amount); setCostFrequency(p.frequency); }}
                        data-testid={`button-preset-${p.name.replace(/\s/g, "-").toLowerCase()}`}
                      >
                        {p.name}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Name</label>
                    <Input value={costName} onChange={(e) => setCostName(e.target.value)} placeholder="e.g. Replit Hosting" className="bg-muted border-border text-sm" data-testid="input-cost-name" />
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
                        <SelectItem value="replit_deployment">Replit Deployment</SelectItem>
                        <SelectItem value="replit_compute">Replit Compute</SelectItem>
                        <SelectItem value="replit_agent">Replit Agent</SelectItem>
                        <SelectItem value="replit_storage">Replit Storage</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount (USD)</label>
                    <Input type="number" step="0.01" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="29.99" className="bg-muted border-border text-sm" data-testid="input-cost-amount" />
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
                    <Textarea value={costNotes} onChange={(e) => setCostNotes(e.target.value)} placeholder="Optional notes..." className="bg-muted border-border text-sm resize-none" data-testid="input-cost-notes" />
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
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {COST_PRESETS.map(p => (
                  <Button key={p.name} variant="outline" size="sm" className="text-xs" onClick={() => applyPreset(p)} data-testid={`button-quick-add-${p.name.replace(/\s/g, "-").toLowerCase()}`}>
                    <Plus size={12} className="mr-1" /> {p.name}
                  </Button>
                ))}
              </div>
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
                        {cost.category.replace(/_/g, " ")}
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
                        <Button size="icon" variant="ghost" onClick={() => openEditDialog(cost)} data-testid={`button-edit-cost-${cost.id}`}>
                          <Pencil size={14} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteManualCostMutation.mutate(cost.id)} disabled={deleteManualCostMutation.isPending} data-testid={`button-delete-cost-${cost.id}`}>
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
              <Input type="number" step="1" value={budgetAmount || budget?.monthlyBudget || ""} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="100" className="bg-muted border-border text-sm" data-testid="input-budget-amount" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Alert Threshold (%)</label>
              <Input type="number" min="0" max="100" value={budgetThreshold || budget?.alertThreshold?.toString() || "80"} onChange={(e) => setBudgetThreshold(e.target.value)} placeholder="80" className="bg-muted border-border text-sm" data-testid="input-budget-threshold" />
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

      <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-user-detail">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-emerald-500" /> User Cost Profile
            </DialogTitle>
          </DialogHeader>
          {loadingUserProfile ? (
            <div className="space-y-4 p-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : userProfile ? (
            <div className="space-y-6">
              <div className="p-4 bg-muted rounded-md" data-testid="user-detail-summary">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">User</div>
                <div className="text-lg font-black text-foreground">{selectedUser}</div>
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <div className="text-2xl font-black text-emerald-500">{formatUsdPrecise(userProfile.totalCost)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total AI Cost</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-foreground">{userProfile.requestCount}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total Requests</div>
                  </div>
                </div>
              </div>

              {userProfile.byFeature.length > 0 && (
                <div data-testid="user-detail-features">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Cost by Feature</div>
                  <div className="space-y-2">
                    {userProfile.byFeature.map(f => (
                      <div key={f.feature} className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-bold">{f.feature.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{f.count} requests</span>
                          <span className="font-bold text-foreground">{formatUsdPrecise(f.totalCost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userProfile.byModel.length > 0 && (
                <div data-testid="user-detail-models">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Cost by Model</div>
                  <div className="grid grid-cols-2 gap-3">
                    {userProfile.byModel.map(m => (
                      <div key={m.model} className="p-3 bg-muted rounded-md">
                        <div className="text-sm font-black text-foreground">{formatUsdPrecise(m.totalCost)}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{m.model}</div>
                        <div className="text-[10px] text-muted-foreground">{m.count} requests</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {userProfile.dailyTrend.length > 0 && (
                <div data-testid="user-detail-trend">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Daily Trend</div>
                  <div className="flex items-end gap-1 h-24">
                    {userProfile.dailyTrend.slice(-30).map((d, i) => {
                      const cost = parseFloat(d.totalCost) || 0;
                      const maxC = userProfile.dailyTrend.reduce((m, dd) => Math.max(m, parseFloat(dd.totalCost) || 0), 0) || 1;
                      const hPct = (cost / maxC) * 100;
                      return (
                        <div key={d.date || i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          <div className="w-full bg-emerald-500/80 rounded-t-sm min-h-[2px]" style={{ height: `${Math.max(2, hPct)}%` }} />
                          <div className="invisible group-hover:visible absolute bottom-full mb-1 bg-card border border-border rounded p-1 text-[9px] z-50 whitespace-nowrap">
                            {formatUsdPrecise(d.totalCost)} - {d.date ? format(new Date(d.date), "MMM d") : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {userProfile.recentLogs.length > 0 && (
                <div data-testid="user-detail-recent-logs">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Recent Logs (Last 50)</div>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground font-bold uppercase text-[9px]">Date</TableHead>
                          <TableHead className="text-muted-foreground font-bold uppercase text-[9px]">Feature</TableHead>
                          <TableHead className="text-muted-foreground font-bold uppercase text-[9px]">Model</TableHead>
                          <TableHead className="text-muted-foreground font-bold uppercase text-[9px] text-right">Tokens</TableHead>
                          <TableHead className="text-muted-foreground font-bold uppercase text-[9px] text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userProfile.recentLogs.map(log => (
                          <TableRow key={log.id} className="border-border">
                            <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {log.createdAt ? format(new Date(log.createdAt), "MMM d, HH:mm") : "-"}
                            </TableCell>
                            <TableCell className="text-[10px] text-foreground">{log.feature.replace(/_/g, " ")}</TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">{log.model}</TableCell>
                            <TableCell className="text-[10px] text-muted-foreground text-right">{log.totalTokens}</TableCell>
                            <TableCell className="text-[10px] font-bold text-foreground text-right">{formatUsdPrecise(log.costUsd)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic p-4">No data available for this user.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
