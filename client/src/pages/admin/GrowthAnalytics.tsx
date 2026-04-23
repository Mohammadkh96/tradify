import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, Users, Target, Zap, DollarSign, ArrowDown, BarChart2,
  FileDown, Calculator, RefreshCw, ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type DateRange = "7" | "30" | "90";

function StatCard({ label, value, sub, color = "text-foreground", icon: Icon }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: any;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className={cn("text-3xl font-black", color)}>{value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">{label}</div>
            {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
          </div>
          <div className={cn("h-10 w-10 rounded-md flex items-center justify-center", "bg-emerald-500/10")}>
            <Icon size={20} className="text-emerald-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart2 size={32} className="text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground italic">{message}</p>
    </div>
  );
}

function FunnelCard({ days }: { days: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/analytics/funnel", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/funnel?days=${days}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const maxCount = data?.funnel?.reduce((m: number, s: any) => Math.max(m, s.count), 0) || 1;

  return (
    <Card className="bg-card border-border" data-testid="card-funnel">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Target size={16} className="text-emerald-500" /> Conversion Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : !data?.funnel?.some((s: any) => s.count > 0) ? (
          <EmptyState message="No funnel data yet — start driving traffic to your landing page." />
        ) : (
          <div className="space-y-3">
            {data.funnel.map((stage: any, i: number) => {
              const pct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
              const stageColors = ["text-blue-400", "text-purple-400", "text-amber-400", "text-emerald-500"];
              const barColors = ["bg-blue-500/30", "bg-purple-500/30", "bg-amber-500/30", "bg-emerald-500/30"];
              return (
                <div key={stage.stage} data-testid={`funnel-stage-${stage.stage.toLowerCase()}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest w-20", stageColors[i])}>
                        {stage.stage}
                      </span>
                      <span className="text-lg font-black text-foreground">{stage.count.toLocaleString()}</span>
                    </div>
                    {stage.dropPct !== null && stage.dropPct > 0 && (
                      <Badge variant="outline" className="text-[9px] border-rose-500/30 text-rose-400 font-bold">
                        <ArrowDown size={8} className="mr-1" /> {stage.dropPct}% drop
                      </Badge>
                    )}
                    {stage.dropPct === 0 && i > 0 && (
                      <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 font-bold">
                        100% pass
                      </Badge>
                    )}
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", barColors[i])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DailyTrendCard({ days }: { days: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/analytics/daily-trend", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/daily-trend?days=${days}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const trend = data?.trend || [];
  const hasData = trend.some((d: any) => d.signups > 0 || d.leads > 0 || d.paid > 0);

  const formatted = trend.map((d: any) => ({
    ...d,
    label: format(new Date(d.date + "T12:00:00"), "MMM d"),
  }));

  return (
    <Card className="bg-card border-border" data-testid="card-daily-trend">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-500" /> Daily Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !hasData ? (
          <EmptyState message="No daily data yet — traffic and signups will appear here once they start coming in." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={formatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#0e1318", border: "1px solid #1a2330", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e8edf2", fontWeight: "bold" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="leads" name="Leads" stroke="#6366f1" fill="url(#gLeads)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="signups" name="Signups" stroke="#10b981" fill="url(#gSignups)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="paid" name="Paid" stroke="#f59e0b" fill="url(#gPaid)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function SourcesCard({ days }: { days: string }) {
  const [sortBy, setSortBy] = useState<"signups" | "leads" | "paid">("signups");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/analytics/sources", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/sources?days=${days}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const sources: any[] = [...(data?.sources || [])].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <Card className="bg-card border-border" data-testid="card-sources">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Zap size={16} className="text-emerald-500" /> Traffic Sources
        </CardTitle>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="h-7 w-28 text-xs" data-testid="select-sort-sources">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="signups">By Signups</SelectItem>
            <SelectItem value="leads">By Leads</SelectItem>
            <SelectItem value="paid">By Paid</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-32 w-full" /></div>
        ) : sources.length === 0 ? (
          <div className="p-6">
            <EmptyState message='No source data yet — add ?utm_source=instagram to your links to start tracking where traffic comes from.' />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Source</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Campaign</TableHead>
                  <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Leads</TableHead>
                  <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Signups</TableHead>
                  <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Paid</TableHead>
                  <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Conv%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((s: any, i) => (
                  <TableRow key={`${s.source}-${s.campaign}-${i}`} className="border-border hover:bg-muted/30"
                    data-testid={`row-source-${s.source}`}>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-emerald-500/30 text-emerald-400">
                        {s.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{s.campaign || "—"}</TableCell>
                    <TableCell className="text-right font-bold text-foreground text-sm">{s.leads}</TableCell>
                    <TableCell className="text-right font-bold text-foreground text-sm">{s.signups}</TableCell>
                    <TableCell className="text-right font-bold text-amber-400 text-sm">{s.paid}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "text-xs font-black",
                        s.convRate >= 10 ? "text-emerald-500" : s.convRate >= 3 ? "text-amber-400" : "text-muted-foreground"
                      )}>
                        {s.convRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeadMagnetsCard() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/analytics/lead-magnets"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/lead-magnets");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const magnets = [
    {
      icon: FileDown,
      label: "Discipline Checklist",
      key: "checklist",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      data: data?.checklist,
    },
    {
      icon: Calculator,
      label: "Risk Calculator",
      key: "calculator",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      data: data?.calculator,
    },
  ];

  return (
    <Card className="bg-card border-border" data-testid="card-lead-magnets">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <FileDown size={16} className="text-emerald-500" /> Lead Magnet Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !data?.checklist && !data?.calculator ? (
          <EmptyState message="No lead magnet submissions yet." />
        ) : (
          <div className="space-y-4">
            {magnets.map(({ icon: Icon, label, key, color, bg, data: d }) => (
              <div key={key} className="p-4 bg-muted/30 rounded-lg border border-border" data-testid={`magnet-${key}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("h-8 w-8 rounded-md flex items-center justify-center", bg)}>
                    <Icon size={16} className={color} />
                  </div>
                  <span className="font-bold text-sm text-foreground">{label}</span>
                </div>
                {!d || d.total === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No submissions yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-xl font-black text-foreground">{d.total}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Downloads</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-black text-emerald-500">{d.converted}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Registered</div>
                    </div>
                    <div className="text-center">
                      <div className={cn("text-xl font-black", d.convRate >= 10 ? "text-emerald-500" : "text-amber-400")}>
                        {d.convRate}%
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Conv. Rate</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionsCard() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/analytics/subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/subscriptions");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <Card className="bg-card border-border" data-testid="card-subscriptions">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <DollarSign size={16} className="text-emerald-500" /> Subscription Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !data ? (
          <EmptyState message="No subscription data yet." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted rounded-md text-center" data-testid="stat-pro-total">
                <div className="text-2xl font-black text-emerald-500">{data.pro?.total ?? 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">Pro Users</div>
              </div>
              <div className="p-3 bg-muted rounded-md text-center" data-testid="stat-elite-total">
                <div className="text-2xl font-black text-amber-400">{data.elite?.total ?? 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">Elite Users</div>
              </div>
              <div className="p-3 bg-muted rounded-md text-center" data-testid="stat-paid-week">
                <div className="text-2xl font-black text-foreground">{data.newPaidThisWeek ?? 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">New Paid (7d)</div>
              </div>
              <div className="p-3 bg-muted rounded-md text-center" data-testid="stat-paid-month">
                <div className="text-2xl font-black text-foreground">{data.newPaidThisMonth ?? 0}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">New Paid (30d)</div>
              </div>
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-center" data-testid="stat-mrr">
              <div className="text-3xl font-black text-emerald-500">${data.mrrEstimate?.toLocaleString() ?? 0}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">Est. MRR</div>
              <div className="text-[10px] text-muted-foreground mt-1">Pro × $19 + Elite × $39</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GrowthAnalytics() {
  const [days, setDays] = useState<DateRange>("30");

  const { data: funnelData } = useQuery<any>({
    queryKey: ["/api/admin/analytics/funnel", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/funnel?days=${days}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: subsData } = useQuery<any>({
    queryKey: ["/api/admin/analytics/subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/subscriptions");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const totalLeads = funnelData?.funnel?.[0]?.count ?? 0;
  const totalSignups = funnelData?.funnel?.[1]?.count ?? 0;
  const overallConv = totalSignups > 0 && subsData?.totalPaid > 0
    ? ((subsData.totalPaid / totalSignups) * 100).toFixed(1)
    : "0";

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground" data-testid="growth-analytics-page">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500" data-testid="text-analytics-title">
            <TrendingUp /> Growth Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">
            Funnel · Sources · Signups · Revenue
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={days} onValueChange={(v: DateRange) => setDays(v)}>
            <SelectTrigger className="h-9 w-32 text-xs" data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Leads (${days}d)`}
          value={totalLeads}
          icon={Users}
          color="text-blue-400"
        />
        <StatCard
          label={`Signups (${days}d)`}
          value={totalSignups}
          icon={Users}
          color="text-purple-400"
        />
        <StatCard
          label="Total Paid"
          value={subsData?.totalPaid ?? 0}
          sub="all time"
          icon={DollarSign}
          color="text-amber-400"
        />
        <StatCard
          label="Overall Conv."
          value={`${overallConv}%`}
          sub="signups → paid"
          icon={TrendingUp}
          color="text-emerald-500"
        />
      </div>

      {/* Daily trend — full width */}
      <DailyTrendCard days={days} />

      {/* Funnel + Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FunnelCard days={days} />
        <SourcesCard days={days} />
      </div>

      {/* Lead Magnets + Subscriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadMagnetsCard />
        <SubscriptionsCard />
      </div>
    </div>
  );
}
