import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, TrendingUp, Users, DollarSign, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export const AdminAnalytics = ({ demoMode = false }: { demoMode?: boolean }) => {
  const { firebaseUser } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (demoMode) {
      setLoading(false);
      return () => { active = false; };
    }
    const load = async () => {
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;
      const response = await fetch('/api/admin/analytics', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('Failed to load analytics');
      return response.json();
    };
    load()
      .then(res => {
        if (!active) return;
        setData(res.analytics);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, [demoMode, firebaseUser]);

  if (demoMode) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform &amp; Product Analytics</h1>
          <p className="text-sm text-muted-foreground">Sample-only analytics preview. Live platform data is not available in this walkthrough.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Coach Now requests', '128'],
            ['Room activation rate', '82.4%'],
            ['Completed learning sessions', '96'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">{label}</div>
              <div className="mt-1 text-2xl font-bold">{value}</div>
              <div className="mt-2 text-xs text-muted-foreground">Illustrative preview value</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading admin analytics...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">Error: {error}</div>;
  }

  const funnel = data?.coachNowFunnel || {};
  const rates = data?.rates || {};
  const activity = data?.activitySummary || {};
  const eventSummary = data?.eventSummary || {};
  const outcomes = data?.outcomes || [];
  const segments = data?.segments || [];
  const matchQuality = data?.matchQuality || {};
  const formatRate = (value: number | null | undefined) => value === null || value === undefined ? 'N/A' : `${(value * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform & Product Analytics</h1>
        <p className="text-sm text-muted-foreground">Server-canonical product funnels and engagement telemetry.</p>
        {data?.window && <p className="mt-1 text-xs text-muted-foreground">Window: {new Date(data.window.from).toLocaleDateString()} – {new Date(data.window.to).toLocaleDateString()} · {eventSummary.totalEvents ?? 0} persisted events across {eventSummary.sessionsWithEvents ?? 0} sessions</p>}
      </div>

      {/* Rates Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Coach Now Match Rate</div>
          <div className="text-2xl font-bold mt-1">{formatRate(rates.matchRate)}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Payment Authorization Rate</div>
          <div className="text-2xl font-bold mt-1">{formatRate(rates.paymentAuthRate)}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Room Activation Rate</div>
          <div className="text-2xl font-bold mt-1">{formatRate(rates.roomActivationRate)}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Session Settlement Rate</div>
          <div className="text-2xl font-bold mt-1">{formatRate(rates.settlementRate)}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Review Submission Rate</div>
          <div className="text-2xl font-bold mt-1">{formatRate(rates.reviewSubmissionRate)}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Homework Completion Rate</div>
          <div className="text-2xl font-bold mt-1">{formatRate(rates.homeworkCompletionRate)}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Claim Confirmation Rate</div>
          <div className="text-2xl font-bold mt-1">{formatRate(rates.confirmationRate)}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Room Entry Rate</div>
          <div className="text-2xl font-bold mt-1">{formatRate(rates.roomEntryRate)}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Repeat Learning Rate</div>
          <div className="text-2xl font-bold mt-1">{formatRate(rates.repeatSessionRate)}</div>
        </div>
      </div>

      {/* Coach Now Funnel Stages */}
      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Coach Now request-to-learning funnel</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 text-center">
          <div className="bg-accent/30 p-3 rounded-md">
            <div className="text-xs text-muted-foreground">Requests</div>
            <div className="text-xl font-bold mt-1">{funnel.requests}</div>
          </div>
          <div className="bg-accent/30 p-3 rounded-md">
            <div className="text-xs text-muted-foreground">Matched</div>
            <div className="text-xl font-bold mt-1">{funnel.matched}</div>
          </div>
          <div className="bg-accent/30 p-3 rounded-md">
            <div className="text-xs text-muted-foreground">Confirmed</div>
            <div className="text-xl font-bold mt-1">{funnel.confirmed ?? 0}</div>
          </div>
          <div className="bg-accent/30 p-3 rounded-md">
            <div className="text-xs text-muted-foreground">Authorized</div>
            <div className="text-xl font-bold mt-1">{funnel.paymentAuthorized}</div>
          </div>
          <div className="bg-accent/30 p-3 rounded-md">
            <div className="text-xs text-muted-foreground">Room Ready</div>
            <div className="text-xl font-bold mt-1">{funnel.roomReady}</div>
          </div>
          <div className="bg-accent/30 p-3 rounded-md">
            <div className="text-xs text-muted-foreground">Active</div>
            <div className="text-xl font-bold mt-1">{funnel.active}</div>
          </div>
          <div className="bg-accent/30 p-3 rounded-md">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-xl font-bold mt-1">{funnel.completed}</div>
          </div>
          <div className="bg-accent/30 p-3 rounded-md">
            <div className="text-xs text-muted-foreground">Settled</div>
            <div className="text-xl font-bold mt-1">{funnel.settled}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4 lg:grid-cols-8">
          {[
            ['No live match', funnel.noLiveMatch],
            ['Expired', funnel.expired],
            ['Rematched', funnel.rematched],
            ['Cancelled', funnel.cancelled],
            ['No-show', funnel.noShow],
            ['Refunded', funnel.refunded],
            ['Room entries', funnel.roomEntered],
            ['Reviews avg', matchQuality.averageReviewRating === null || matchQuality.averageReviewRating === undefined ? 'N/A' : `${matchQuality.averageReviewRating}/5`],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-border bg-background p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 text-lg font-semibold">{value ?? 0}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <h2 className="text-lg font-semibold">Why routes stop</h2>
          <p className="mt-1 text-xs text-muted-foreground">Demand, supply, participant, payment, and room outcomes are kept separate.</p>
          <div className="mt-4 space-y-2">
            {outcomes.length === 0 ? <p className="text-sm text-muted-foreground">No outcome events in this window.</p> : outcomes.map((outcome: { failureClass: string; count: number }) => (
              <div key={outcome.failureClass} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 text-sm">
                <span>{outcome.failureClass.replaceAll('_', ' ')}</span>
                <strong>{outcome.count}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <h2 className="text-lg font-semibold">Experiment guardrails</h2>
          <p className="mt-1 text-sm text-muted-foreground">{matchQuality.evaluationGuardrail || 'Rank only on educational outcomes, never financial performance.'}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-secondary/50 p-3">
              <div className="text-xs text-muted-foreground">Repeat sessions</div>
              <div className="mt-1 text-lg font-semibold">{matchQuality.repeatSessions ?? 0}</div>
            </div>
            <div className="rounded-md bg-secondary/50 p-3">
              <div className="text-xs text-muted-foreground">Repeat denominator</div>
              <div className="mt-1 text-lg font-semibold">{matchQuality.repeatEligible ?? 0}</div>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <h2 className="text-lg font-semibold">Privacy-safe match segments</h2>
        <p className="mt-1 text-xs text-muted-foreground">Aggregated dimensions only. No learner names, free text, symbols, or coach identifiers are included.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Route</th><th className="px-2 py-2">Instrument</th><th className="px-2 py-2">Topic</th>
                <th className="px-2 py-2">Language</th><th className="px-2 py-2">Length</th><th className="px-2 py-2">Requests</th>
                <th className="px-2 py-2">Matched</th><th className="px-2 py-2">Entered</th><th className="px-2 py-2">Completed</th>
              </tr>
            </thead>
            <tbody>
              {segments.length === 0 ? <tr><td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">No segmented routes in this window.</td></tr> : segments.map((segment: any, index: number) => (
                <tr key={`${segment.mode}-${segment.instrumentClass}-${segment.topic}-${index}`} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium">{segment.mode}</td>
                  <td className="px-2 py-2">{segment.instrumentClass}</td>
                  <td className="px-2 py-2">{segment.topic}</td>
                  <td className="px-2 py-2">{segment.language}</td>
                  <td className="px-2 py-2">{segment.durationBucket}</td>
                  <td className="px-2 py-2">{segment.requests + segment.noLiveMatch}</td>
                  <td className="px-2 py-2">{segment.matched}</td>
                  <td className="px-2 py-2">{segment.roomEntered}</td>
                  <td className="px-2 py-2">{segment.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Activity Summary */}
      <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Activity Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Journal Entries</div>
            <div className="text-lg font-semibold">{activity.totalJournalEntries}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Trade Reviews</div>
            <div className="text-lg font-semibold">{activity.totalTradeReviews}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Homework Assigned</div>
            <div className="text-lg font-semibold">{activity.totalHomeworkAssigned}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Homework Completed</div>
            <div className="text-lg font-semibold">{activity.totalHomeworkCompleted}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Notifications Delivered</div>
            <div className="text-lg font-semibold">{activity.totalNotificationsDelivered}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
