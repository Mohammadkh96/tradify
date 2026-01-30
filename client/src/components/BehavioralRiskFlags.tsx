import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  AlertTriangle, 
  Crown,
  Shield,
  TrendingUp,
  Zap,
  Clock,
  Activity,
  ChevronRight,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface RiskFlag {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  evidence: string;
  period?: string;
}

interface HistoricalComparison {
  recentPeriod: string;
  priorPeriod: string;
  volumeChange: string;
  frequencyChange: string;
  recentTradeCount: number;
  priorTradeCount: number;
}

interface BehavioralRisksData {
  flags: RiskFlag[];
  summary: {
    totalFlags: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  historicalComparison: HistoricalComparison | null;
  analyzedTrades: number;
  message?: string;
}

interface BehavioralRiskFlagsProps {
  userId: string;
}

const SEVERITY_CONFIG = {
  high: {
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: AlertTriangle,
    label: "High Risk",
  },
  medium: {
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: AlertCircle,
    label: "Medium Risk",
  },
  low: {
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: Activity,
    label: "Low Risk",
  },
};

const FLAG_TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  revenge_trading: Zap,
  session_overtrading: Clock,
  risk_creep: TrendingUp,
  rapid_retry: Activity,
  loss_chasing: TrendingUp,
};

export function BehavioralRiskFlags({ userId }: BehavioralRiskFlagsProps) {
  const { isElite } = usePlan();

  const { data, isLoading, error } = useQuery<BehavioralRisksData>({
    queryKey: [`/api/behavioral-risks/${userId}`],
    enabled: !!userId && isElite,
    staleTime: 60000,
  });

  if (!isElite) {
    return (
      <Card className="bg-card border-border shadow-2xl overflow-hidden" data-testid="behavioral-risks-locked">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Shield size={20} className="text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-foreground uppercase italic tracking-tight font-black flex items-center gap-2">
                  Behavioral Risk Flags
                  <Crown size={14} className="text-amber-500" />
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Elite Feature
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-amber-500/10 rounded-full">
              <Crown size={32} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Unlock Behavioral Risk Detection
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Automatically detect trading patterns like revenge trading, overtrading, 
                and risk creep with data-backed insights.
              </p>
            </div>
            <Link to="/profile">
              <Button className="bg-amber-500 hover:bg-amber-600 text-black font-medium" data-testid="upgrade-elite-behavioral">
                Upgrade to Elite
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-2xl" data-testid="behavioral-risks-loading">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Shield size={20} className="text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black flex items-center gap-2">
                Behavioral Risk Flags
                <Crown size={14} className="text-amber-500" />
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-border shadow-2xl" data-testid="behavioral-risks-error">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <CardTitle className="text-foreground uppercase italic tracking-tight font-black">
              Behavioral Risk Flags
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-red-400 text-sm">Failed to load behavioral risk data</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.message) {
    return (
      <Card className="bg-card border-border shadow-2xl" data-testid="behavioral-risks-empty">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Shield size={20} className="text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black flex items-center gap-2">
                Behavioral Risk Flags
                <Crown size={14} className="text-amber-500" />
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <Activity size={40} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">
              {data?.message || "Insufficient trade data for behavioral analysis."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { flags, summary, historicalComparison, analyzedTrades } = data;

  return (
    <Card className="bg-card border-border shadow-2xl" data-testid="behavioral-risks-container">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Shield size={20} className="text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-foreground uppercase italic tracking-tight font-black flex items-center gap-2">
                Behavioral Risk Flags
                <Crown size={14} className="text-amber-500" />
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                {analyzedTrades} trades analyzed
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {summary.highRisk > 0 && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30" data-testid="badge-high-risk-count">
                {summary.highRisk} High
              </Badge>
            )}
            {summary.mediumRisk > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30" data-testid="badge-medium-risk-count">
                {summary.mediumRisk} Medium
              </Badge>
            )}
            {summary.lowRisk > 0 && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30" data-testid="badge-low-risk-count">
                {summary.lowRisk} Low
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-4">
        {flags.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8" data-testid="no-risk-flags">
            <div className="p-4 bg-green-500/10 rounded-full mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No Behavioral Risks Detected
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Your trading patterns appear consistent. Continue maintaining disciplined execution.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map((flag, index) => {
              const config = SEVERITY_CONFIG[flag.severity];
              const IconComponent = FLAG_TYPE_ICONS[flag.type] || AlertTriangle;
              
              return (
                <div
                  key={`${flag.type}-${index}`}
                  className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}
                  data-testid={`risk-flag-${flag.type}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <IconComponent size={18} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground text-sm">
                          {flag.title}
                        </h4>
                        <Badge className={config.badgeClass} data-testid={`severity-badge-${flag.severity}`}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs mb-2">
                        {flag.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-mono ${config.color}`}>
                          {flag.evidence}
                        </span>
                      </div>
                      {flag.period && (
                        <p className="text-muted-foreground text-xs mt-1 italic">
                          Period: {flag.period}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {historicalComparison && (
          <div className="mt-6 pt-4 border-t border-border" data-testid="historical-comparison">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Activity size={14} className="text-muted-foreground" />
              Historical Comparison
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Volume Change</p>
                <p className={`text-lg font-mono font-bold ${
                  historicalComparison.volumeChange === "N/A" ? "text-muted-foreground" :
                  parseFloat(historicalComparison.volumeChange) > 20 ? "text-amber-500" :
                  parseFloat(historicalComparison.volumeChange) < -20 ? "text-green-500" :
                  "text-foreground"
                }`} data-testid="volume-change-value">
                  {historicalComparison.volumeChange === "N/A" ? "N/A" : 
                    (parseFloat(historicalComparison.volumeChange) > 0 ? "+" : "") + historicalComparison.volumeChange + "%"}
                </p>
                <p className="text-xs text-muted-foreground">vs previous period</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Frequency Change</p>
                <p className={`text-lg font-mono font-bold ${
                  parseFloat(historicalComparison.frequencyChange) > 30 ? "text-amber-500" :
                  parseFloat(historicalComparison.frequencyChange) < -30 ? "text-blue-500" :
                  "text-foreground"
                }`} data-testid="frequency-change-value">
                  {parseFloat(historicalComparison.frequencyChange) > 0 ? "+" : ""}
                  {historicalComparison.frequencyChange}%
                </p>
                <p className="text-xs text-muted-foreground">trades per period</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Comparing {historicalComparison.recentPeriod} ({historicalComparison.recentTradeCount} trades) 
              vs {historicalComparison.priorPeriod} ({historicalComparison.priorTradeCount} trades)
            </p>
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/20 rounded-lg border border-border" data-testid="disclaimer">
          <p className="text-xs text-muted-foreground text-center italic">
            These flags are pattern observations only, not trading advice. 
            All insights are data-backed and derived from your trade history.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
