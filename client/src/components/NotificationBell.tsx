import { useState } from "react";
import { Bell, AlertTriangle, AlertCircle, TrendingDown, Activity, Compass, Check, CheckCheck } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface AppNotification {
  id: number;
  type: string;
  severity: "low" | "medium" | "high";
  title: string;
  body: string;
  payload?: Record<string, any>;
  linkUrl?: string | null;
  channelInApp: boolean;
  channelEmail: boolean;
  emailSent: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

const ICONS: Record<string, any> = {
  daily_dd_critical: AlertCircle,
  daily_dd_warn: AlertTriangle,
  max_dd_critical: AlertCircle,
  max_dd_warn: TrendingDown,
  revenge_trade: AlertCircle,
  overtrading: Activity,
  strategy_deviation: Compass,
};

function severityColor(sev: string) {
  if (sev === "high") return "text-red-500";
  if (sev === "medium") return "text-amber-500";
  return "text-blue-500";
}

function severityBg(sev: string) {
  if (sev === "high") return "bg-red-500/10 border-red-500/30";
  if (sev === "medium") return "bg-amber-500/10 border-amber-500/30";
  return "bg-blue-500/10 border-blue-500/30";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/notifications/mark-all-read`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleClick = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.linkUrl) {
      setOpen(false);
      setLocation(n.linkUrl);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-bell"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0"
        align="end"
        data-testid="popover-notifications"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="font-semibold text-sm" data-testid="text-notifications-title">Notifications</h3>
            <p className="text-xs text-muted-foreground" data-testid="text-notifications-subtitle">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              data-testid="button-mark-all-read"
              className="h-7 text-xs gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[420px]">
          {notifications.length === 0 ? (
            <div className="px-4 py-12 text-center" data-testid="empty-notifications">
              <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Risk alerts will appear here when detected
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                const isUnread = !n.readAt;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex gap-3 ${isUnread ? "bg-accent/20" : ""}`}
                    data-testid={`notification-item-${n.id}`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${severityBg(n.severity)}`}>
                      <Icon className={`h-4 w-4 ${severityColor(n.severity)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className={`text-sm leading-tight ${isUnread ? "font-semibold" : "font-medium"}`} data-testid={`text-notification-title-${n.id}`}>
                          {n.title}
                        </p>
                        {isUnread && (
                          <span className="flex-shrink-0 mt-1 w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-snug" data-testid={`text-notification-body-${n.id}`}>
                        {n.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted-foreground" data-testid={`text-notification-time-${n.id}`}>
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                        {n.channelEmail && n.emailSent && (
                          <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5">
                            <Check className="h-2.5 w-2.5" />
                            Emailed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => { setOpen(false); setLocation("/profile"); }}
            data-testid="button-alert-settings"
          >
            Alert settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
