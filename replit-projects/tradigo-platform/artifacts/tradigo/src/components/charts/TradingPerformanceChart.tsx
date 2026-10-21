import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ArrowUpRight, Calendar, DollarSign } from 'lucide-react';
import { cn } from '../../lib/utils';

const performanceData = {
  '1W': [
    { date: 'Mon', equity: 24500, pnl: +450 },
    { date: 'Tue', equity: 24900, pnl: +400 },
    { date: 'Wed', equity: 24650, pnl: -250 },
    { date: 'Thu', equity: 25300, pnl: +650 },
    { date: 'Fri', equity: 25840, pnl: +540 },
  ],
  '1M': [
    { date: 'Week 1', equity: 22000, pnl: +1200 },
    { date: 'Week 2', equity: 23500, pnl: +1500 },
    { date: 'Week 3', equity: 24100, pnl: +600 },
    { date: 'Week 4', equity: 25840, pnl: +1740 },
  ],
  '3M': [
    { date: 'Jun', equity: 18500, pnl: +1800 },
    { date: 'Jul', equity: 21200, pnl: +2700 },
    { date: 'Aug', equity: 25840, pnl: +4640 },
  ],
  'YTD': [
    { date: 'Jan', equity: 10000, pnl: +800 },
    { date: 'Feb', equity: 11500, pnl: +1500 },
    { date: 'Mar', equity: 14200, pnl: +2700 },
    { date: 'Apr', equity: 13800, pnl: -400 },
    { date: 'May', equity: 16700, pnl: +2900 },
    { date: 'Jun', equity: 18500, pnl: +1800 },
    { date: 'Jul', equity: 21200, pnl: +2700 },
    { date: 'Aug', equity: 25840, pnl: +4640 },
  ],
};

type TimeRange = '1W' | '1M' | '3M' | 'YTD';

export const TradingPerformanceChart: React.FC<{ className?: string }> = ({ className }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const data = performanceData[timeRange];

  const currentEquity = data[data.length - 1].equity;
  const startEquity = data[0].equity;
  const totalGrowth = (((currentEquity - startEquity) / startEquity) * 100).toFixed(2);
  const totalPnl = data.reduce((acc, curr) => acc + curr.pnl, 0);

  return (
    <div className={cn("bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col", className)}>
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold tracking-tight">Account Growth</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> +{totalGrowth}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time equity curve & PnL performance</p>
        </div>

        {/* Timeframe Switcher */}
        <div className="flex items-center bg-secondary/60 p-1 rounded-lg border border-border/60 self-start sm:self-auto">
          {(['1W', '1M', '3M', 'YTD'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                timeRange === range
                  ? "bg-background text-foreground shadow-sm border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 p-4 rounded-lg bg-secondary/30 border border-border/50">
        <div>
          <span className="text-xs text-muted-foreground font-medium">Current Equity</span>
          <div className="text-xl font-bold text-foreground mt-0.5">
            ${currentEquity.toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground font-medium">Period P&L</span>
          <div className={cn("text-xl font-bold mt-0.5", totalPnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-xs text-muted-foreground font-medium">Win Ratio</span>
          <div className="text-xl font-bold text-cyan-400 mt-0.5">68.4%</div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="tradigoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
            <XAxis
              dataKey="date"
              stroke="currentColor"
              className="text-muted-foreground text-xs"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="currentColor"
              className="text-muted-foreground text-xs"
              tickLine={false}
              axisLine={false}
              domain={['dataMin - 1000', 'dataMax + 1000']}
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-card/95 backdrop-blur-md border border-border/80 p-3 rounded-xl shadow-xl text-xs space-y-1">
                      <div className="font-semibold text-foreground">{label}</div>
                      <div className="text-indigo-400 font-medium">
                        Equity: ${item.equity.toLocaleString()}
                      </div>
                      <div className={cn("font-medium", item.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        PnL: {item.pnl >= 0 ? '+' : ''}${item.pnl}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#6366f1"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#tradigoGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
