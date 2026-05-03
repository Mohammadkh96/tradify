import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Activity, UserPlus, Crown, XCircle, Star, Mail, Filter,
} from "lucide-react";

type FeedEvent = {
  type: "signup" | "upgrade" | "cancel" | "founding" | "email";
  userId: string;
  name?: string;
  at: string;
  meta?: any;
};

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  signup:   { icon: UserPlus, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",       label: "Signup" },
  upgrade:  { icon: Crown,    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",     label: "Upgrade" },
  cancel:   { icon: XCircle,  color: "text-rose-400 bg-rose-500/10 border-rose-500/30",        label: "Cancellation" },
  founding: { icon: Star,     color: "text-purple-400 bg-purple-500/10 border-purple-500/30",  label: "Founding Member" },
  email:    { icon: Mail,     color: "text-muted-foreground bg-muted/30 border-border",        label: "Email" },
};

export default function ActivityFeed() {
  const [days, setDays] = useState(7);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<{ days: number; events: FeedEvent[] }>({
    queryKey: ["/api/admin/activity", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/activity?days=${days}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const events = (data?.events || []).filter(e => typeFilter === "all" || e.type === typeFilter);
  const counts = (data?.events || []).reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-8 space-y-6 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <Activity /> Activity Feed
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">
          Real-time platform-wide event stream · auto-refresh 30s
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1 border border-border">
          {[1, 7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              data-testid={`button-days-${d}`}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors",
                days === d ? "bg-emerald-500 text-slate-950" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d === 1 ? "24h" : `${d} days`}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1 border border-border">
          <button
            onClick={() => setTypeFilter("all")}
            data-testid="button-filter-all"
            className={cn(
              "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors",
              typeFilter === "all" ? "bg-emerald-500 text-slate-950" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Filter size={10} className="inline mr-1" /> All
          </button>
          {Object.entries(TYPE_META).map(([t, meta]) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              data-testid={`button-filter-${t}`}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors",
                typeFilter === t ? "bg-emerald-500 text-slate-950" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {meta.label} {counts[t] ? <span className="ml-1 opacity-70">({counts[t]})</span> : null}
            </button>
          ))}
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No events in this window.
            </div>
          ) : (
            <div data-testid="list-activity-events">
              {events.map((e, i) => {
                const meta = TYPE_META[e.type] || TYPE_META.signup;
                const Icon = meta.icon;
                return (
                  <div
                    key={`${e.type}-${e.userId}-${e.at}-${i}`}
                    className="flex items-start gap-4 p-4 border-b border-border last:border-0 hover:bg-muted/20"
                    data-testid={`event-${e.type}-${i}`}
                  >
                    <div className={cn("h-9 w-9 rounded-lg border flex items-center justify-center shrink-0", meta.color)}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest border", meta.color)}>
                          {meta.label}
                        </Badge>
                        <span className="text-xs font-semibold text-foreground truncate">
                          {e.name || e.userId}
                        </span>
                        {e.type === "upgrade" && e.meta?.tier && (
                          <Badge className="text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            → {e.meta.tier}
                          </Badge>
                        )}
                        {e.type === "cancel" && e.meta?.tier && (
                          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest border-rose-500/30 text-rose-400">
                            {e.meta.tier}
                          </Badge>
                        )}
                      </div>
                      {e.type === "email" && e.meta?.subject && (
                        <div className="text-[11px] text-muted-foreground mt-1 truncate">
                          ✉️ {e.meta.subject}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {e.userId} · {format(new Date(e.at), "MMM d, h:mm a")} · {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
