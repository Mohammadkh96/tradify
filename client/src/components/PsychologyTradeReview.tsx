import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlan } from "@/hooks/usePlan";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Brain,
  RefreshCw,
  Lock,
  HeartPulse,
  Sparkles,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PsychologyReviewData {
  id?: number;
  insightText: string;
  cached?: boolean;
  hasData?: boolean;
  metadata?: {
    totalTrades: number;
    taggedMood: number;
    taggedMistake: number;
    moodStats: Record<string, { count: number; wins: number; losses: number; totalPnl: number }>;
    mistakeStats: Record<string, { count: number; totalPnl: number; avgPnl: number }>;
    generatedAt: string;
  };
}

interface PsychologyTradeReviewProps {
  userId: string;
}

const MOOD_LABELS: Record<string, string> = {
  confident: "Confident",
  calm: "Calm",
  neutral: "Neutral",
  anxious: "Anxious",
  fearful: "Fearful",
  greedy: "Greedy",
  frustrated: "Frustrated",
  revenge: "Revenge",
};

const MOOD_COLORS: Record<string, string> = {
  confident: "text-emerald-500",
  calm: "text-blue-400",
  neutral: "text-muted-foreground",
  anxious: "text-amber-500",
  fearful: "text-orange-500",
  greedy: "text-rose-500",
  frustrated: "text-red-400",
  revenge: "text-red-600",
};

export function PsychologyTradeReview({ userId }: PsychologyTradeReviewProps) {
  const { t } = useTranslation();
  const { isPro, isElite } = usePlan();
  const hasPlan = isPro || isElite;
  const queryClient = useQueryClient();
  const moodLabelsT: Record<string, string> = {
    confident: t("widgets.psychology.mood.confident"),
    calm: t("widgets.psychology.mood.calm"),
    neutral: t("widgets.psychology.mood.neutral"),
    anxious: t("widgets.psychology.mood.anxious"),
    fearful: t("widgets.psychology.mood.fearful"),
    greedy: t("widgets.psychology.mood.greedy"),
    frustrated: t("widgets.psychology.mood.frustrated"),
    revenge: t("widgets.psychology.mood.revenge"),
  };

  const { data, isLoading, isFetching } = useQuery<PsychologyReviewData>({
    queryKey: [`/api/ai/psychology-review/${userId}`],
    enabled: !!userId && hasPlan,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("GET", `/api/ai/psychology-review/${userId}?period=30&force=1`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai/psychology-review/${userId}`] });
    },
  });

  if (!hasPlan) {
    return (
      <Card className="bg-card border-border shadow-2xl relative overflow-hidden" data-testid="widget-psychology-review">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Brain size={18} className="text-purple-500" />
            {t("widgets.psychology.title")}
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] uppercase tracking-widest ml-2">{t("widgets.psychology.proBadge")}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Lock className="text-muted-foreground/30 mb-3" size={32} />
            <p className="text-sm font-bold text-foreground uppercase tracking-widest mb-1">{t("widgets.psychology.proFeature")}</p>
            <p className="text-xs text-muted-foreground mb-4">{t("widgets.psychology.upgradeDesc")}</p>
            <Link to="/pricing">
              <Button variant="outline" data-testid="button-upgrade-psychology">
                {t("widgets.psychology.upgradeBtn")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-2xl" data-testid="widget-psychology-review">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Brain size={18} className="text-purple-500" />
            {t("widgets.psychology.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  const hasReview = data?.insightText && data.hasData !== false;
  const meta = data?.metadata;

  return (
    <Card className="bg-card border-border shadow-2xl relative overflow-hidden" data-testid="widget-psychology-review">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Brain size={18} className="text-purple-500" />
            {t("widgets.psychology.title")}
            <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[9px] uppercase tracking-widest">
              <Sparkles size={8} className="mr-1" /> AI
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => refreshMutation.mutate()}
            disabled={isFetching || refreshMutation.isPending}
            data-testid="button-refresh-psychology"
          >
            <RefreshCw size={12} className={cn((isFetching || refreshMutation.isPending) && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasReview ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <HeartPulse className="text-muted-foreground/30 mb-3" size={32} />
            <p className="text-sm font-bold text-foreground mb-1">{t("widgets.psychology.noDataTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("widgets.psychology.noDataDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {meta && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-background rounded-lg p-3 text-center border border-border">
                  <div className="text-[9px] text-muted-foreground uppercase font-bold mb-1">{t("widgets.psychology.tradesAnalyzed")}</div>
                  <div className="text-lg font-black text-foreground">{meta.totalTrades}</div>
                </div>
                <div className="bg-background rounded-lg p-3 text-center border border-border">
                  <div className="text-[9px] text-muted-foreground uppercase font-bold mb-1">{t("widgets.psychology.moodTagged")}</div>
                  <div className="text-lg font-black text-purple-400">
                    {meta.taggedMood}
                    <span className="text-[9px] text-muted-foreground font-normal ml-1">
                      ({meta.totalTrades > 0 ? ((meta.taggedMood / meta.totalTrades) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
                <div className="bg-background rounded-lg p-3 text-center border border-border">
                  <div className="text-[9px] text-muted-foreground uppercase font-bold mb-1">{t("widgets.psychology.mistakes")}</div>
                  <div className="text-lg font-black text-amber-400">
                    {meta.taggedMistake}
                  </div>
                </div>
              </div>
            )}

            {meta?.moodStats && Object.keys(meta.moodStats).length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                  <HeartPulse size={10} />
                  {t("widgets.psychology.moodBreakdown")}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(meta.moodStats)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 6)
                    .map(([mood, stats]) => (
                      <div key={mood} className="bg-background/50 rounded-lg p-2 border border-border/50">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-xs font-bold capitalize", MOOD_COLORS[mood] || "text-foreground")}>
                            {moodLabelsT[mood] || mood}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{stats.count} {t("widgets.psychology.tradesShort")}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-emerald-500 font-bold">{stats.wins}W</span>
                          <span className="text-[9px] text-rose-500 font-bold">{stats.losses}L</span>
                          <span className={cn(
                            "text-[9px] font-bold ml-auto",
                            stats.totalPnl >= 0 ? "text-emerald-500" : "text-rose-500"
                          )}>
                            {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {meta?.mistakeStats && Object.keys(meta.mistakeStats).length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  {t("widgets.psychology.topMistakes")}
                </div>
                <div className="space-y-1.5">
                  {Object.entries(meta.mistakeStats)
                    .sort((a, b) => a[1].totalPnl - b[1].totalPnl)
                    .slice(0, 4)
                    .map(([mistake, stats]) => (
                      <div key={mistake} className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2 border border-border/50">
                        <span className="text-xs text-foreground capitalize">{(() => {
                          const map: Record<string, string> = {
                            none: "journal.mistakeNone",
                            early_entry: "journal.mistakeEarlyEntry",
                            late_entry: "journal.mistakeLateEntry",
                            no_stop_loss: "journal.mistakeNoStopLoss",
                            moved_stop_loss: "journal.mistakeMovedStopLoss",
                            oversized: "journal.mistakeOversized",
                            fomo: "journal.mistakeFomo",
                            revenge_trade: "journal.mistakeRevenge",
                            revenge_trading: "journal.mistakeRevenge",
                            ignored_rules: "journal.mistakeIgnoredRules",
                            poor_risk_reward: "journal.mistakePoorRR",
                            early_exit: "journal.mistakeEarlyExit",
                            overtrading: "journal.mistakeOvertrading",
                            loss_chasing: "journal.mistakeFomo",
                          };
                          const key = map[mistake];
                          return key ? t(key) : mistake.replace(/_/g, " ");
                        })()}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] text-muted-foreground">{stats.count}x</span>
                          <span className={cn(
                            "text-xs font-bold",
                            stats.totalPnl >= 0 ? "text-emerald-500" : "text-rose-500"
                          )}>
                            ${stats.totalPnl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="prose prose-sm prose-invert max-w-none [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-xs [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_ul]:text-xs [&_ul]:text-muted-foreground [&_li]:text-xs [&_li]:text-muted-foreground [&_hr]:border-border [&_em]:text-muted-foreground/60 [&_strong]:text-foreground">
              <ReactMarkdown>{data.insightText}</ReactMarkdown>
            </div>

            {meta?.generatedAt && (
              <div className="text-[9px] text-muted-foreground/50 text-right uppercase tracking-wider pt-2 border-t border-border/30">
                {t("widgets.psychology.generated")} {new Date(meta.generatedAt).toLocaleDateString()} {data.cached ? t("widgets.psychology.cached") : ""}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}