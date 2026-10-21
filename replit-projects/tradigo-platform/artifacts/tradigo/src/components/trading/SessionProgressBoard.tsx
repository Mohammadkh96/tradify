import React from 'react';
import { CheckCircle2, Clock, PlayCircle, ShieldCheck, Flame } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SessionState = 'MATCHED' | 'AUTHORIZED' | 'LIVE' | 'COMPLETED';

interface SessionProgressBoardProps {
  currentState: SessionState;
  coachName?: string;
  market?: string;
  className?: string;
}

const steps: { id: SessionState; label: string; description: string; icon: React.ElementType }[] = [
  {
    id: 'MATCHED',
    label: 'Matched',
    description: 'Coach & trader paired',
    icon: Clock,
  },
  {
    id: 'AUTHORIZED',
    label: 'Authorized',
    description: 'Risk limits & permissions verified',
    icon: ShieldCheck,
  },
  {
    id: 'LIVE',
    label: 'Live Session',
    description: 'Active voice & chart stream',
    icon: PlayCircle,
  },
  {
    id: 'COMPLETED',
    label: 'Completed',
    description: 'Ledger audit & debrief saved',
    icon: CheckCircle2,
  },
];

export const SessionProgressBoard: React.FC<SessionProgressBoardProps> = ({
  currentState,
  coachName = 'Marcus Sterling',
  market = 'EUR/USD Pro',
  className,
}) => {
  const stateOrder: SessionState[] = ['MATCHED', 'AUTHORIZED', 'LIVE', 'COMPLETED'];
  const currentIndex = stateOrder.indexOf(currentState);

  return (
    <div className={cn("bg-card border border-border rounded-xl p-5 shadow-sm space-y-4", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold tracking-tight">Active Session Status</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Flame className="w-3 h-3 mr-1 text-indigo-400 animate-pulse" /> {market}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Coached by <span className="font-medium text-foreground">{coachName}</span>
          </p>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-secondary/80 border border-border self-start sm:self-auto text-foreground">
          Phase: <span className="text-indigo-400 font-bold">{currentState}</span>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < currentIndex;
          const isCurrent = step.id === currentState;
          const isUpcoming = idx > currentIndex;

          return (
            <div
              key={step.id}
              className={cn(
                "relative flex flex-col p-3 rounded-xl border transition-all",
                isCurrent
                  ? "bg-indigo-500/10 border-indigo-500/40 shadow-sm"
                  : isDone
                  ? "bg-emerald-500/5 border-emerald-500/30 text-muted-foreground"
                  : "bg-secondary/30 border-border/50 opacity-60"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs",
                    isCurrent
                      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                      : isDone
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-secondary text-muted-foreground border border-border"
                  )}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded",
                    isCurrent
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : isDone
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {isCurrent ? 'Active' : isDone ? 'Done' : 'Pending'}
                </span>
              </div>

              <div className="font-semibold text-xs text-foreground">{step.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{step.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
