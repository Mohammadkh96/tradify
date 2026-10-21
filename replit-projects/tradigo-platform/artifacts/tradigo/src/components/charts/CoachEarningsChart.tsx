import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, TrendingUp, Calendar, Users, Award } from 'lucide-react';
import { cn } from '../../lib/utils';

// Generate 30 days of realistic coach earnings data
const generate30DayEarnings = () => {
  const data = [];
  const today = new Date();
  let cumulative = 3200;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Random daily earnings between $150 and $950
    const dailyRevenue = Math.floor(Math.random() * 800) + 150;
    const sessionsCount = Math.floor(Math.random() * 4) + 1;
    cumulative += dailyRevenue;

    data.push({
      date: dateStr,
      revenue: dailyRevenue,
      cumulativeRevenue: cumulative,
      sessions: sessionsCount,
    });
  }
  return data;
};

const mockEarningsData = generate30DayEarnings();

export const CoachEarningsChart: React.FC<{ className?: string }> = ({ className }) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [timeframe, setTimeframe] = useState<'30D' | '14D' | '7D'>('30D');

  const filteredData = timeframe === '7D' 
    ? mockEarningsData.slice(-7) 
    : timeframe === '14D' 
    ? mockEarningsData.slice(-14) 
    : mockEarningsData;

  const totalRevenue = filteredData.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalSessions = filteredData.reduce((acc, curr) => acc + curr.sessions, 0);
  const avgPerSession = Math.round(totalRevenue / (totalSessions || 1));

  return (
    <div className={cn("bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl text-slate-100 flex flex-col space-y-6 backdrop-blur-md", className)}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold tracking-tight text-slate-100">Coach Earnings & Revenue History</h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-3 h-3 mr-1" /> +18.4% vs last period
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Historical session payout & mentorship subscription tracking</p>
        </div>

        {/* View & Timeframe Controls */}
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setChartType('area')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                chartType === 'area' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Area
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
                chartType === 'bar' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Bar
            </button>
          </div>

          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {(['7D', '14D', '30D'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                  timeframe === tf ? "bg-slate-800 text-indigo-300 border border-slate-700" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Revenue</span>
            <div className="text-xl font-black text-slate-100 mt-0.5">${totalRevenue.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Completed Sessions</span>
            <div className="text-xl font-black text-slate-100 mt-0.5">{totalSessions} Sessions</div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Avg. per Session</span>
            <div className="text-xl font-black text-slate-100 mt-0.5">${avgPerSession}</div>
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" textAnchor="end" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#312e81',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  fontSize: '12px',
                }}
                formatter={(value: any) => [`$${value}`, 'Revenue']}
                labelStyle={{ color: '#818cf8', fontWeight: 'bold', marginBottom: '4px' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          ) : (
            <BarChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#312e81',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  fontSize: '12px',
                }}
                formatter={(value: any) => [`$${value}`, 'Revenue']}
                labelStyle={{ color: '#818cf8', fontWeight: 'bold', marginBottom: '4px' }}
              />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
