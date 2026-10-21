import React, { useState, useEffect } from 'react';
import { Clock, Video, Calendar, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';

interface SessionCountdownProps {
  coachName?: string;
  sessionTopic?: string;
  market?: string;
  sessionTime?: Date; // Target start time
  sessionId?: string;
  className?: string;
}

export const SessionCountdown: React.FC<SessionCountdownProps> = ({
  coachName = 'Marcus Sterling',
  sessionTopic = 'Advanced Price Action & Liquidity Sweep',
  market = 'EUR/USD Pro',
  sessionTime,
  sessionId = 'session-live-101',
  className,
}) => {
  // Default to 18 minutes from now if not specified
  const targetTime = sessionTime || new Date(Date.now() + 18 * 60 * 1000 + 45 * 1000);

  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isLive: boolean }>({
    hours: 0,
    minutes: 18,
    seconds: 45,
    isLive: false,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetTime.getTime() - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isLive: true });
        clearInterval(timer);
      } else {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isLive: false });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTime]);

  return (
    <div className={cn(
      "bg-slate-900 border rounded-2xl p-6 shadow-xl text-slate-100 relative overflow-hidden backdrop-blur-md transition-all",
      timeLeft.isLive ? "border-emerald-500/60 shadow-emerald-500/10" : "border-indigo-500/30",
      className
    )}>
      {/* Background glow ambient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        {/* Session details */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2.5">
            <Badge variant={timeLeft.isLive ? "success" : "warning"}>
              {timeLeft.isLive ? "🔴 Session Active Now" : "Upcoming Booked Session"}
            </Badge>
            <span className="text-xs text-slate-400 bg-slate-950/80 px-2.5 py-0.5 rounded-lg border border-slate-800 font-mono">
              {market}
            </span>
          </div>

          <h3 className="text-lg font-black tracking-tight text-slate-100">{sessionTopic}</h3>
          
          <p className="text-xs text-slate-400 flex items-center space-x-2">
            <span className="text-slate-200 font-medium">Coach: {coachName}</span>
            <span>•</span>
            <span className="flex items-center text-indigo-400"><Calendar className="w-3.5 h-3.5 mr-1" /> Today, 02:00 PM EST</span>
          </p>
        </div>

        {/* Countdown timer & action */}
        <div className="flex items-center space-x-4 self-start md:self-auto">
          {!timeLeft.isLive ? (
            <div className="flex items-center space-x-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
              <div>
                <span className="block text-xl font-mono font-black text-indigo-400">
                  {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Starts in</span>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs animate-pulse">
              Room is live and waiting
            </div>
          )}

          <Link to={`/app/sessions/${sessionId}/live`}>
            <button
              className={cn(
                "px-5 py-3 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center space-x-2 active:scale-[0.98]",
                timeLeft.isLive
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
              )}
            >
              <Video className="w-4 h-4" />
              <span>{timeLeft.isLive ? "Join Live Room Now" : "Pre-Session Briefing"}</span>
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};
