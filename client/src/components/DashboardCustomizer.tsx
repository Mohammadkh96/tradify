import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Settings2, LayoutDashboard, Activity, BarChart3, Clock, Brain, ShieldCheck, FileText, GripVertical, HeartPulse, Trophy, Calendar } from "lucide-react";

export type DashboardConfig = {
  widgets: {
    stats: boolean;
    equityCurve: boolean;
    aiInstrument: boolean;
    recentTrades: boolean;
    sessionAnalytics: boolean;
    timePatterns: boolean;
    behavioralRisks: boolean;
    strategyDeviation: boolean;
    monthlyReview: boolean;
    psychologyReview: boolean;
    achievements: boolean;
    heatmap: boolean;
  };
};

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  widgets: {
    stats: true,
    equityCurve: true,
    aiInstrument: true,
    recentTrades: true,
    sessionAnalytics: true,
    timePatterns: true,
    behavioralRisks: true,
    strategyDeviation: true,
    monthlyReview: true,
    psychologyReview: true,
    achievements: true,
    heatmap: true,
  },
};

const WIDGET_INFO = [
  { key: "stats", label: "Performance Stats", icon: LayoutDashboard, description: "Win rate, P&L, trades overview" },
  { key: "equityCurve", label: "Equity Curve", icon: Activity, description: "Growth performance chart" },
  { key: "aiInstrument", label: "AI Instrument Analysis", icon: BarChart3, description: "AI-powered instrument insights" },
  { key: "recentTrades", label: "Recent Trades", icon: Clock, description: "Latest trade entries" },
  { key: "sessionAnalytics", label: "Session Analytics", icon: Clock, description: "Trading session breakdown" },
  { key: "timePatterns", label: "Time Patterns", icon: Clock, description: "Best/worst trading times" },
  { key: "behavioralRisks", label: "Behavioral Risk Flags", icon: Brain, description: "Psychology-based risk alerts" },
  { key: "strategyDeviation", label: "Strategy Deviation", icon: ShieldCheck, description: "Rule compliance tracking" },
  { key: "monthlyReview", label: "Monthly Review", icon: FileText, description: "AI-generated monthly report" },
  { key: "psychologyReview", label: "Psychology Review", icon: HeartPulse, description: "AI mood & mistake analysis" },
  { key: "achievements", label: "Achievements", icon: Trophy, description: "Badges, streaks & XP progress" },
  { key: "heatmap", label: "Trading Heatmap", icon: Calendar, description: "When you trade and how each slot performs" },
] as const;

export function useDashboardConfig() {
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"] });
  const config: DashboardConfig = user?.dashboardConfig || DEFAULT_DASHBOARD_CONFIG;
  return config;
}

export default function DashboardCustomizer() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"] });
  const currentConfig: DashboardConfig = user?.dashboardConfig || DEFAULT_DASHBOARD_CONFIG;
  const [localConfig, setLocalConfig] = useState<DashboardConfig>(currentConfig);

  useEffect(() => {
    if (user?.dashboardConfig) {
      setLocalConfig(user.dashboardConfig);
    }
  }, [user?.dashboardConfig]);

  const saveMutation = useMutation({
    mutationFn: async (config: DashboardConfig) => {
      return apiRequest("PATCH", "/api/user/dashboard-config", { dashboardConfig: config });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setOpen(false);
    },
  });

  const toggleWidget = (key: string) => {
    setLocalConfig(prev => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        [key]: !prev.widgets[key as keyof typeof prev.widgets],
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full border-border bg-card text-muted-foreground"
          data-testid="button-customize-dashboard"
        >
          <Settings2 size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-emerald-500" />
            Customize Dashboard
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-[400px] overflow-auto pr-1">
          {WIDGET_INFO.map(({ key, label, icon: Icon, description }) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-background/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Icon size={16} className="text-emerald-500/70 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{description}</p>
                </div>
              </div>
              <Switch
                checked={localConfig.widgets[key as keyof typeof localConfig.widgets] !== false}
                onCheckedChange={() => toggleWidget(key)}
                data-testid={`toggle-widget-${key}`}
              />
            </div>
          ))}
        </div>
        <Button
          onClick={() => saveMutation.mutate(localConfig)}
          disabled={saveMutation.isPending}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold uppercase mt-2"
          data-testid="button-save-dashboard-config"
        >
          {saveMutation.isPending ? "Saving..." : "Save Layout"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}