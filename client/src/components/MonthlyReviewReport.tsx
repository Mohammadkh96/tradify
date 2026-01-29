import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlan } from "@/hooks/usePlan";
import { Link } from "wouter";
import { 
  FileText, 
  Calendar,
  Download,
  RefreshCw,
  Lock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles
} from "lucide-react";

interface MonthlyReviewData {
  id?: number;
  insightText: string;
  month: number;
  year: number;
  cached?: boolean;
  hasData?: boolean;
  message?: string;
  metrics?: {
    current: {
      tradeCount: number;
      wins: number;
      losses: number;
      totalPnL: number;
      winRate: number;
      avgWin: number;
      avgLoss: number;
      profitFactor: string;
    };
    previous: {
      tradeCount: number;
      wins: number;
      losses: number;
      totalPnL: number;
      winRate: number;
      avgWin: number;
      avgLoss: number;
      profitFactor: string;
    };
  };
}

interface AvailableMonth {
  year: number;
  month: number;
  key: string;
}

interface MonthlyReviewReportProps {
  userId: string;
}

const monthNames = ["January", "February", "March", "April", "May", "June", 
                    "July", "August", "September", "October", "November", "December"];

export function MonthlyReviewReport({ userId }: MonthlyReviewReportProps) {
  const { isElite } = usePlan();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  
  const { data: availableMonths } = useQuery<{ availableMonths: AvailableMonth[] }>({
    queryKey: [`/api/monthly-review/${userId}/available`],
    enabled: !!userId && isElite,
  });

  const currentSelection = selectedMonth ? selectedMonth.split('-') : null;
  const queryMonth = currentSelection ? currentSelection[1] : undefined;
  const queryYear = currentSelection ? currentSelection[0] : undefined;

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (queryMonth) params.set('month', queryMonth);
    if (queryYear) params.set('year', queryYear);
    return `/api/monthly-review/${userId}${params.toString() ? `?${params}` : ''}`;
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery<MonthlyReviewData>({
    queryKey: ['/api/monthly-review', userId, queryMonth, queryYear],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(buildUrl(), { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!userId && isElite,
  });

  const handleExport = () => {
    if (!data?.insightText) return;
    
    const monthName = monthNames[data.month - 1];
    const content = `# Monthly Self-Review: ${monthName} ${data.year}\n\n${data.insightText}`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-review-${data.year}-${String(data.month).padStart(2, '0')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isElite) {
    return (
      <Card className="border-border/50" data-testid="monthly-review-upgrade">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Monthly Self-Review
            </CardTitle>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30" data-testid="badge-elite">
              <Lock className="h-3 w-3 mr-1" />
              ELITE
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-amber-500/50" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-elite-title">Elite Feature</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto" data-testid="text-elite-description">
              Get AI-generated monthly performance reviews that reflect on your trading journey, highlight improvements, and identify areas for growth.
            </p>
            <Link href="/profile">
              <Button variant="outline" data-testid="button-upgrade-elite">
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
      <Card className="border-border/50" data-testid="monthly-review-loading">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Monthly Self-Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/50" data-testid="monthly-review-error">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Monthly Self-Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p data-testid="text-error-message">Unable to load monthly review</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderMetricComparison = () => {
    if (!data?.metrics?.current || !data?.metrics?.previous) return null;
    
    const { current, previous } = data.metrics;
    const pnlChange = current.totalPnL - previous.totalPnL;
    const winRateChange = current.winRate - previous.winRate;
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="metrics-comparison">
        <div className="p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Trades</p>
          <p className="text-lg font-bold" data-testid="text-trade-count">{current.tradeCount}</p>
          {previous.tradeCount > 0 && (
            <p className={`text-xs ${current.tradeCount > previous.tradeCount ? 'text-green-500' : current.tradeCount < previous.tradeCount ? 'text-red-500' : 'text-muted-foreground'}`} data-testid="text-trade-change">
              {current.tradeCount > previous.tradeCount ? '+' : ''}{current.tradeCount - previous.tradeCount} vs prev
            </p>
          )}
        </div>
        
        <div className="p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
          <p className="text-lg font-bold" data-testid="text-win-rate">{current.winRate.toFixed(1)}%</p>
          {previous.tradeCount > 0 && (
            <p className={`text-xs flex items-center gap-1 ${winRateChange > 0 ? 'text-green-500' : winRateChange < 0 ? 'text-red-500' : 'text-muted-foreground'}`} data-testid="text-winrate-change">
              {winRateChange > 0 ? <TrendingUp className="h-3 w-3" /> : winRateChange < 0 ? <TrendingDown className="h-3 w-3" /> : null}
              {winRateChange > 0 ? '+' : ''}{winRateChange.toFixed(1)}%
            </p>
          )}
        </div>
        
        <div className="p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">P&L</p>
          <p className={`text-lg font-bold ${current.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-pnl">
            ${current.totalPnL.toFixed(2)}
          </p>
          {previous.tradeCount > 0 && (
            <p className={`text-xs flex items-center gap-1 ${pnlChange > 0 ? 'text-green-500' : pnlChange < 0 ? 'text-red-500' : 'text-muted-foreground'}`} data-testid="text-pnl-change">
              {pnlChange > 0 ? <TrendingUp className="h-3 w-3" /> : pnlChange < 0 ? <TrendingDown className="h-3 w-3" /> : null}
              {pnlChange > 0 ? '+' : ''}${pnlChange.toFixed(2)}
            </p>
          )}
        </div>
        
        <div className="p-3 rounded-lg bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">Profit Factor</p>
          <p className="text-lg font-bold" data-testid="text-profit-factor">{current.profitFactor}</p>
          <p className="text-xs text-muted-foreground" data-testid="text-prev-profit-factor">prev: {previous.profitFactor}</p>
        </div>
      </div>
    );
  };

  const renderReviewContent = () => {
    if (!data?.insightText) return null;
    
    const lines = data.insightText.split('\n');
    
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="review-content">
        {lines.map((line, i) => {
          if (line.startsWith('## ')) {
            return <h2 key={i} className="text-xl font-bold mt-0 mb-4 text-foreground" data-testid={`text-heading-${i}`}>{line.replace('## ', '')}</h2>;
          }
          if (line.startsWith('### ')) {
            return <h3 key={i} className="text-lg font-semibold mt-6 mb-3 text-foreground flex items-center gap-2" data-testid={`text-subheading-${i}`}>
              {line.includes('Improved') && <TrendingUp className="h-4 w-4 text-green-500" />}
              {line.includes('Attention') && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              {line.includes('Behavioral') && <Sparkles className="h-4 w-4 text-primary" />}
              {line.includes('Best') && <TrendingUp className="h-4 w-4 text-emerald-500" />}
              {line.replace('### ', '')}
            </h3>;
          }
          if (line.startsWith('- ')) {
            return <p key={i} className="text-sm text-muted-foreground ml-4 mb-2 flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>{line.replace('- ', '')}</span>
            </p>;
          }
          if (line.startsWith('*') && line.endsWith('*')) {
            return <p key={i} className="text-xs text-muted-foreground italic mt-4 border-t border-border/50 pt-4" data-testid="text-disclaimer">
              {line.replace(/\*/g, '')}
            </p>;
          }
          if (line.startsWith('---')) {
            return <hr key={i} className="my-4 border-border/50" />;
          }
          if (line.trim()) {
            return <p key={i} className="text-sm text-foreground mb-2">{line}</p>;
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <Card className="border-border/50" data-testid="monthly-review-report">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Monthly Self-Review
          </CardTitle>
          <div className="flex items-center gap-2">
            {availableMonths?.availableMonths && availableMonths.availableMonths.length > 0 && (
              <Select
                value={selectedMonth || undefined}
                onValueChange={setSelectedMonth}
              >
                <SelectTrigger className="w-40" data-testid="select-month">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.availableMonths.map((m) => (
                    <SelectItem key={m.key} value={m.key} data-testid={`select-item-month-${m.key}`}>
                      {monthNames[m.month - 1]} {m.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {data?.insightText && (
              <>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  data-testid="button-refresh-review"
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExport}
                  data-testid="button-export-review"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isFetching && !data ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : data?.hasData === false ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm" data-testid="text-no-data">{data.message || "No data available for this month"}</p>
            <p className="text-xs mt-2 opacity-75">
              You need at least 5 trades in a month to generate a review
            </p>
          </div>
        ) : (
          <>
            {data?.cached && (
              <Badge variant="outline" className="mb-4 text-xs" data-testid="badge-cached">
                <Sparkles className="h-3 w-3 mr-1" />
                Cached report from {data.month && monthNames[data.month - 1]} {data.year}
              </Badge>
            )}
            
            {renderMetricComparison()}
            {renderReviewContent()}
          </>
        )}
      </CardContent>
    </Card>
  );
}