import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Mail, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface AlertVolumeData {
  totals: {
    total_24h: number;
    unread_24h: number;
    emailed_24h: number;
    users_24h: number;
  };
  byType: Array<{ type: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  last7Days: Array<{ day: string; count: number }>;
  topUsers: Array<{
    userId: string;
    total: number;
    high: number;
    unread: number;
    lastAlertAt: string;
  }>;
}

const TYPE_LABEL: Record<string, string> = {
  daily_dd_critical: "Daily DD — Critical",
  daily_dd_warn: "Daily DD — Warning",
  max_dd_critical: "Max DD — Critical",
  max_dd_warn: "Max DD — Warning",
  revenge_trade: "Revenge Trading",
  overtrading: "Overtrading",
  strategy_deviation: "Strategy Deviation",
};

function severityColor(s: string) {
  if (s === "high") return "bg-red-500/10 text-red-500 border-red-500/30";
  if (s === "medium") return "bg-amber-500/10 text-amber-500 border-amber-500/30";
  return "bg-blue-500/10 text-blue-500 border-blue-500/30";
}

export function AdminAlertVolumeWidget() {
  const { data, isLoading } = useQuery<AlertVolumeData>({
    queryKey: ["/api/admin/alert-volume"],
    refetchInterval: 60_000,
  });

  const max7 = Math.max(1, ...(data?.last7Days.map((d) => d.count) || [0]));

  return (
    <Card className="bg-card border-border" data-testid="card-admin-alert-volume">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Bell size={14} /> Risk Alert Volume
            </CardTitle>
            <CardDescription className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
              Last 24 hours · 7-day trend
            </CardDescription>
          </div>
          {data && (
            <Badge variant="outline" className="text-[10px]">
              {data.totals.total_24h} alerts / 24h
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : !data ? (
          <p className="text-xs text-muted-foreground" data-testid="text-alert-volume-empty">No data available</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-background/50 rounded-md p-3 border border-border" data-testid="stat-total-24h">
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                  <TrendingUp size={10} /> Total
                </div>
                <div className="text-2xl font-black">{data.totals.total_24h}</div>
              </div>
              <div className="bg-background/50 rounded-md p-3 border border-border" data-testid="stat-unread-24h">
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                  <AlertTriangle size={10} /> Unread
                </div>
                <div className="text-2xl font-black text-amber-500">{data.totals.unread_24h}</div>
              </div>
              <div className="bg-background/50 rounded-md p-3 border border-border" data-testid="stat-emailed-24h">
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                  <Mail size={10} /> Emailed
                </div>
                <div className="text-2xl font-black text-emerald-500">{data.totals.emailed_24h}</div>
              </div>
              <div className="bg-background/50 rounded-md p-3 border border-border" data-testid="stat-users-24h">
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                  <Users size={10} /> Users
                </div>
                <div className="text-2xl font-black">{data.totals.users_24h}</div>
              </div>
            </div>

            {data.byType.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">By type (24h)</h4>
                <div className="space-y-1.5">
                  {data.byType.map((t) => {
                    const pct = data.totals.total_24h > 0 ? (t.count / data.totals.total_24h) * 100 : 0;
                    return (
                      <div key={t.type} className="flex items-center gap-2 text-xs" data-testid={`row-alert-type-${t.type}`}>
                        <div className="w-44 flex-shrink-0 truncate text-muted-foreground">{TYPE_LABEL[t.type] || t.type}</div>
                        <div className="flex-1 h-2 bg-background rounded overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-8 text-right font-mono">{t.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data.bySeverity.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.bySeverity.map((s) => (
                  <Badge
                    key={s.severity}
                    variant="outline"
                    className={`${severityColor(s.severity)} text-[10px] uppercase tracking-wider`}
                    data-testid={`badge-severity-${s.severity}`}
                  >
                    {s.severity}: {s.count}
                  </Badge>
                ))}
              </div>
            )}

            {data.last7Days.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">7-day volume</h4>
                <div className="flex items-end gap-1 h-16">
                  {data.last7Days.map((d) => {
                    const h = (d.count / max7) * 100;
                    return (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-1" data-testid={`bar-day-${d.day}`}>
                        <div className="w-full bg-background rounded-t flex items-end" style={{ height: "48px" }}>
                          <div className="w-full bg-primary/60 rounded-t" style={{ height: `${h}%` }} title={`${d.count}`} />
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {new Date(d.day).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div data-testid="section-top-users">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Top users by alert volume (7d)
              </h4>
              {data.topUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="text-top-users-empty">
                  No alerts in the last 7 days
                </p>
              ) : (
                <div className="space-y-1">
                  {data.topUsers.map((u, i) => (
                    <div
                      key={u.userId}
                      className="flex items-center gap-3 text-xs py-1.5 border-b border-border last:border-0"
                      data-testid={`row-top-user-${i}`}
                    >
                      <span className="w-5 text-right text-[10px] text-muted-foreground font-mono">
                        {i + 1}.
                      </span>
                      <span className="flex-1 truncate font-medium" data-testid={`text-top-user-id-${i}`}>
                        {u.userId}
                      </span>
                      {u.high > 0 && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-[9px] h-4 px-1.5">
                          {u.high} high
                        </Badge>
                      )}
                      {u.unread > 0 && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[9px] h-4 px-1.5">
                          {u.unread} unread
                        </Badge>
                      )}
                      <span className="w-10 text-right font-mono font-bold" data-testid={`text-top-user-total-${i}`}>
                        {u.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
