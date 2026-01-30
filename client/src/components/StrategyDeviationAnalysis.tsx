import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlan } from "@/hooks/usePlan";
import { Link } from "react-router-dom";
import { 
  Target, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2,
  XCircle,
  BarChart3,
  Shield,
  Zap,
  Lock
} from "lucide-react";

interface ComplianceGroup {
  count: number;
  totalPnL: number;
  avgPnL: number;
  winRate: number;
}

interface ViolatedRule {
  ruleType: string;
  ruleLabel: string;
  violationCount: number;
  affectedTrades: number;
}

interface RulePerformanceImpact {
  ruleType: string;
  ruleLabel: string;
  tradesViolating: number;
  avgPnLWhenViolated: number;
  avgPnLWhenCompliant: number;
  performanceDifference: number;
}

interface StrategyBreakdown {
  strategyId: number;
  strategyName: string;
  totalEvaluated: number;
  compliantCount: number;
  nonCompliantCount: number;
  complianceRate: number;
  compliantPnL: number;
  nonCompliantPnL: number;
}

interface StrategyDeviationData {
  hasData: boolean;
  message?: string;
  summary?: {
    totalEvaluatedTrades: number;
    compliantTrades: ComplianceGroup;
    nonCompliantTrades: ComplianceGroup;
    performanceDifference: {
      pnlDifference: number;
      avgPnLDifference: number;
      winRateDifference: number;
    };
    overallComplianceRate: number;
  };
  mostViolatedRules?: ViolatedRule[];
  rulePerformanceImpact?: RulePerformanceImpact[];
  strategyBreakdown?: StrategyBreakdown[];
}

interface StrategyDeviationAnalysisProps {
  userId: string;
}

export function StrategyDeviationAnalysis({ userId }: StrategyDeviationAnalysisProps) {
  const { isElite } = usePlan();
  
  const { data, isLoading, error } = useQuery<StrategyDeviationData>({
    queryKey: ["/api/strategy-deviation", userId],
    enabled: !!userId && isElite,
  });

  // Show upgrade prompt for non-Elite users
  if (!isElite) {
    return (
      <Card className="border-border/50" data-testid="strategy-deviation-upgrade">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Strategy Deviation Analysis
            </CardTitle>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
              <Lock className="h-3 w-3 mr-1" />
              ELITE
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto mb-3 text-amber-500/50" />
            <h3 className="text-lg font-semibold mb-2">Elite Feature</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              See how rule compliance impacts your trading performance. Compare compliant vs non-compliant trades and identify your most violated rules.
            </p>
            <Link to="/profile">
              <Button variant="outline" className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                Upgrade to Elite
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-border/50" data-testid="strategy-deviation-loading">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Strategy Deviation Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/50" data-testid="strategy-deviation-error">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Strategy Deviation Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p>Unable to load deviation analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.hasData) {
    return (
      <Card className="border-border/50" data-testid="strategy-deviation-empty">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Strategy Deviation Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{data?.message || "No validation data available"}</p>
            <p className="text-xs mt-2 opacity-75">
              Validate trades against your strategies to see how rule compliance affects performance
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, mostViolatedRules, rulePerformanceImpact, strategyBreakdown } = data;

  return (
    <Card className="border-border/50" data-testid="strategy-deviation-analysis">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Strategy Deviation Analysis
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {summary?.totalEvaluatedTrades || 0} evaluated trades
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="compliance-summary">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Compliant Trades</span>
                </div>
                <p className="text-2xl font-bold text-green-500" data-testid="compliant-count">
                  {summary.compliantTrades.count}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Win Rate: {summary.compliantTrades.winRate.toFixed(1)}%
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Non-Compliant</span>
                </div>
                <p className="text-2xl font-bold text-red-500" data-testid="non-compliant-count">
                  {summary.nonCompliantTrades.count}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Win Rate: {summary.nonCompliantTrades.winRate.toFixed(1)}%
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Compliance Rate</span>
                </div>
                <p className="text-2xl font-bold" data-testid="compliance-rate">
                  {summary.overallComplianceRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Overall adherence
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  {summary.performanceDifference.avgPnLDifference >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-xs text-muted-foreground">Avg P&L Impact</span>
                </div>
                <p className={`text-2xl font-bold ${
                  summary.performanceDifference.avgPnLDifference >= 0 ? "text-green-500" : "text-red-500"
                }`} data-testid="pnl-impact">
                  {summary.performanceDifference.avgPnLDifference >= 0 ? "+" : ""}
                  ${summary.performanceDifference.avgPnLDifference.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Compliant vs non-compliant
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-border/50 bg-card/50">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Compliant Trade Performance
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total P&L</p>
                    <p className={`text-lg font-mono font-bold ${
                      summary.compliantTrades.totalPnL >= 0 ? "text-green-500" : "text-red-500"
                    }`}>
                      ${summary.compliantTrades.totalPnL.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg P&L</p>
                    <p className={`text-lg font-mono font-bold ${
                      summary.compliantTrades.avgPnL >= 0 ? "text-green-500" : "text-red-500"
                    }`}>
                      ${summary.compliantTrades.avgPnL.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border/50 bg-card/50">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Non-Compliant Trade Performance
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total P&L</p>
                    <p className={`text-lg font-mono font-bold ${
                      summary.nonCompliantTrades.totalPnL >= 0 ? "text-green-500" : "text-red-500"
                    }`}>
                      ${summary.nonCompliantTrades.totalPnL.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg P&L</p>
                    <p className={`text-lg font-mono font-bold ${
                      summary.nonCompliantTrades.avgPnL >= 0 ? "text-green-500" : "text-red-500"
                    }`}>
                      ${summary.nonCompliantTrades.avgPnL.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {mostViolatedRules && mostViolatedRules.length > 0 && (
          <div className="space-y-3" data-testid="most-violated-rules">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Most Violated Rules
            </h4>
            <div className="space-y-2">
              {mostViolatedRules.slice(0, 5).map((rule, index) => (
                <div 
                  key={rule.ruleType}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  data-testid={`violated-rule-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{rule.ruleLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {rule.affectedTrades} trade{rule.affectedTrades !== 1 ? "s" : ""} affected
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                    {rule.violationCount} violation{rule.violationCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {rulePerformanceImpact && rulePerformanceImpact.length > 0 && (
          <div className="space-y-3" data-testid="rule-performance-impact">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Rule Performance Impact
            </h4>
            <div className="space-y-2">
              {rulePerformanceImpact.map((impact, index) => (
                <div 
                  key={impact.ruleType}
                  className="p-3 rounded-lg bg-muted/30"
                  data-testid={`rule-impact-${index}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{impact.ruleLabel}</p>
                    <Badge 
                      variant="outline" 
                      className={impact.performanceDifference > 0 
                        ? "bg-green-500/10 text-green-400 border-green-500/30" 
                        : "bg-red-500/10 text-red-400 border-red-500/30"
                      }
                    >
                      {impact.performanceDifference > 0 ? "+" : ""}${impact.performanceDifference.toFixed(2)} when followed
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">When Violated</p>
                      <p className={`font-mono ${impact.avgPnLWhenViolated >= 0 ? "text-green-500" : "text-red-500"}`}>
                        ${impact.avgPnLWhenViolated.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">When Followed</p>
                      <p className={`font-mono ${impact.avgPnLWhenCompliant >= 0 ? "text-green-500" : "text-red-500"}`}>
                        ${impact.avgPnLWhenCompliant.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Trades Violating</p>
                      <p className="font-mono">{impact.tradesViolating}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {strategyBreakdown && strategyBreakdown.length > 0 && (
          <div className="space-y-3" data-testid="strategy-breakdown">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Strategy Compliance Breakdown
            </h4>
            <div className="space-y-2">
              {strategyBreakdown.map((strategy) => (
                <div 
                  key={strategy.strategyId}
                  className="p-3 rounded-lg border border-border/50 bg-card/50"
                  data-testid={`strategy-breakdown-${strategy.strategyId}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">{strategy.strategyName}</p>
                    <Badge 
                      variant="outline"
                      className={strategy.complianceRate >= 70 
                        ? "bg-green-500/10 text-green-400 border-green-500/30"
                        : strategy.complianceRate >= 50
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-red-500/10 text-red-400 border-red-500/30"
                      }
                    >
                      {strategy.complianceRate.toFixed(1)}% compliant
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Evaluated</p>
                      <p className="font-mono">{strategy.totalEvaluated}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Compliant</p>
                      <p className="font-mono text-green-500">{strategy.compliantCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Non-Compliant</p>
                      <p className="font-mono text-red-500">{strategy.nonCompliantCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">P&L Diff</p>
                      <p className={`font-mono ${
                        strategy.compliantPnL - strategy.nonCompliantPnL >= 0 ? "text-green-500" : "text-red-500"
                      }`}>
                        ${(strategy.compliantPnL - strategy.nonCompliantPnL).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${strategy.complianceRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}