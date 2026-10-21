import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { CalendarClock, CheckCircle2, CircleDot, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { Button } from '../../components/ui/Button';

type SessionRequest = {
  id: string;
  mode: string;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
  amountCents: number;
  symbol?: string | null;
  instrumentClass?: string | null;
  topic?: string | null;
  language?: string | null;
  rateSnapshotCents?: number;
  coachClaimExpiresAt?: string | null;
  paymentStatus: string;
  createdAt: string;
  learningGoal?: string | null;
};

type CoachQualityFeedback = {
  availability: {
    state: string;
    timezone: string;
    openRequestCount: number;
  };
  reliability: {
    requestCount: number;
    acceptedCount: number;
    completedCount: number;
    cancelledCount: number;
    coachDeclinedCount: number;
    claimExpiredCount: number;
    coachNoShowCount: number;
    responseRate: number | null;
    completionRate: number | null;
  };
  guidance: string;
};

export function CoachRequestsView() {
  const [requests, setRequests] = useState<SessionRequest[]>([]);
  const [quality, setQuality] = useState<CoachQualityFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const basePath = location.pathname.startsWith('/preview/coach') ? '/preview/coach' : '/coach';

  const load = useCallback(async () => {
    try {
      const [data, qualityData] = await Promise.all([
        apiClient.get('/api/coach-now/requests/incoming'),
        apiClient.get('/api/coach-now/quality'),
      ]);
      setRequests(data.items ?? []);
      setQuality(qualityData.feedback ?? null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to load incoming requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const accept = async (id: string) => {
    setActionId(id);
    setError(null);
    try {
      await apiClient.post(`/api/coach-now/requests/${id}/accept`);
      await load();
    } catch (err: any) {
      setError(err.message || 'This request could not be accepted.');
    } finally {
      setActionId(null);
    }
  };

  const decline = async (id: string) => {
    setActionId(id);
    setError(null);
    try {
      await apiClient.post(`/api/coach-now/requests/${id}/decline`);
      await load();
    } catch (err: any) {
      setError(err.message || 'This request could not be declined.');
    } finally {
      setActionId(null);
    }
  };

  const money = (cents: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
  const requestAge = (createdAt: string) => {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
    return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <CircleDot className="h-3.5 w-3.5" /> Coach desk
            </div>
            <h1 className="text-3xl font-black tracking-tight">Incoming requests</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
               Review the learning route, then claim a request. The trader confirms your claim before any payment authorization is created.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
            {basePath === '/preview/coach' && <Link to="/preview/coach/dashboard" className="hover:underline">Coach dashboard</Link>}
            {basePath === '/preview/coach' && <Link to="/preview/coach/earnings" className="hover:underline">Earnings</Link>}
            {basePath === '/preview/coach' && <Link to="/preview" className="hover:underline">Open trader preview</Link>}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm font-medium text-destructive">{error}</div>
      )}

      {quality && (
        <section className="rounded-2xl border border-primary/15 bg-card p-5 shadow-sm md:p-6" aria-labelledby="coach-quality-title">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Private route feedback · last 30 days</p>
              <h2 id="coach-quality-title" className="mt-1 text-xl font-bold">Keep your availability useful</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{quality.guidance}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${quality.availability.state === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-secondary text-muted-foreground'}`}>
              {quality.availability.state.replaceAll('_', ' ')}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-secondary/60 p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Open now</span>
              <strong className="mt-1 block text-xl">{quality.availability.openRequestCount}</strong>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Response rate</span>
              <strong className="mt-1 block text-xl">{quality.reliability.responseRate === null ? 'N/A' : `${Math.round(quality.reliability.responseRate * 100)}%`}</strong>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completed</span>
              <strong className="mt-1 block text-xl">{quality.reliability.completedCount}</strong>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coach no-shows</span>
              <strong className="mt-1 block text-xl">{quality.reliability.coachNoShowCount}</strong>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Your local availability timezone: {quality.availability.timezone}. This feedback is not shown as a public score.
          </p>
        </section>
      )}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center rounded-2xl border border-border bg-card">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-bold">No requests waiting</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">New Coach Now and scheduled requests appear here automatically while you are available.</p>
        </section>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md md:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-primary/10 p-3 text-primary"><UserRound className="h-5 w-5" /></div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{request.mode === 'SCHEDULED' ? 'Scheduled coaching request' : 'Coach Now request'}</h2>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{request.status.replaceAll('_', ' ')}</span>
                    </div>
                     <p className="mt-1 text-sm text-muted-foreground">
                      {request.scheduledAt
                        ? new Date(request.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                        : 'Requested for the next available coaching slot'} · {request.durationMinutes} minutes · {money(request.amountCents)}
                    </p>
                    <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Learning goal</span>
                      <p className="mt-1 font-medium text-foreground">{request.learningGoal || 'The trader has not added a separate goal yet.'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Received {requestAge(request.createdAt)} · payment: {request.paymentStatus.replaceAll('_', ' ').toLowerCase()}</p>
                    </div>
                     <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                       <div className="rounded-lg bg-secondary/60 px-3 py-2">
                         <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Instrument</span>
                         <strong>{request.symbol || request.instrumentClass || 'General'}</strong>
                       </div>
                       <div className="rounded-lg bg-secondary/60 px-3 py-2">
                         <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Language</span>
                         <strong>{request.language || 'English'}</strong>
                       </div>
                       <div className="rounded-lg bg-secondary/60 px-3 py-2">
                         <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Topic</span>
                         <strong>{(request.topic || 'General coaching').replaceAll('_', ' ')}</strong>
                       </div>
                       <div className="rounded-lg bg-secondary/60 px-3 py-2">
                         <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rate</span>
                         <strong>{money(request.rateSnapshotCents ?? 0)}/min</strong>
                       </div>
                       <div className="rounded-lg bg-secondary/60 px-3 py-2">
                         <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trader rating</span>
                         <strong>Learning request</strong>
                       </div>
                     </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {request.status === 'REQUESTED' && (
                    <>
                      <Button variant="outline" onClick={() => decline(request.id)} disabled={actionId === request.id} className="font-bold">
                        Decline
                      </Button>
                      <Button onClick={() => accept(request.id)} disabled={actionId === request.id} className="font-bold">
                        {actionId === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        Accept request
                      </Button>
                    </>
                  )}
                   {request.status !== 'REQUESTED' && (
                    <Link to={`${basePath}/sessions/${request.id}`} className="inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-bold hover:bg-secondary">
                       <ShieldCheck className="mr-2 h-4 w-4 text-primary" /> {request.status === 'COACH_CLAIMED' ? 'Awaiting trader confirmation' : 'View handoff'}
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}