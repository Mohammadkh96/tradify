import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

type ReconciliationItem = {
  id: string;
  event_id: string;
  event_type: string;
  status: string;
  error?: string | null;
  session_id?: string | null;
  payment_status?: string | null;
  payout_status?: string | null;
  retry_count?: number;
  last_retry_at?: string | null;
  retry_history?: Array<{ attempt: number; status: string; error?: string | null; completedAt?: string; startedAt?: string }>;
};

type AuthorizationHealthItem = {
  id: string;
  trader_id: string;
  coach_id: string;
  scheduled_at?: string | null;
  paypal_authorization_status?: string | null;
  paypal_authorization_expires_at?: string | null;
  expired: boolean;
  nextAction: string;
};

type NoShowFailureItem = {
  id: number;
  session_id: string;
  actor_id: string;
  details?: {
    message?: string;
    paymentStatus?: string;
    retryable?: boolean;
    nextAction?: string;
  } | null;
  created_at: string;
  trader_id: string;
  coach_id: string;
  status: string;
  payment_status: string;
  payout_status: string;
  needsAttention: boolean;
};

type QueueItem = {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  summary?: string | null;
  createdAt: string;
  targetId: string;
  reporterId?: string | null;
  sessionId?: string | null;
  evidenceReference?: string | null;
  paymentStatus?: string | null;
  payoutStatus?: string | null;
  actions: string[];
};

const statusTone = (status: string) => {
  if (status === 'RECONCILED') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'RETRYING' || status === 'PENDING') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
};

export const ModeratorDashboard = () => {
  const { firebaseUser } = useAuthStore();
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [authorizationHealth, setAuthorizationHealth] = useState<AuthorizationHealthItem[]>([]);
  const [noShowFailures, setNoShowFailures] = useState<NoShowFailureItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const unresolvedItems = items.filter((item) => ['FAILED', 'RETRY_REQUIRED', 'RETRYING'].includes(item.status));

  const requestHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    return headers;
  }, []);

  const authenticatedHeaders = useCallback(async () => {
    const headers = requestHeaders();
    const token = firebaseUser ? await firebaseUser.getIdToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [firebaseUser, requestHeaders]);

  const loadReconciliation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/paypal/reconciliation', { headers: await authenticatedHeaders() });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || 'Unable to load reconciliation.');
      setItems(body.items || []);
      const healthResponse = await fetch('/api/admin/paypal/authorization-health', { headers: await authenticatedHeaders() });
      const healthBody = await healthResponse.json();
      if (!healthResponse.ok) throw new Error(healthBody?.error?.message || 'Unable to load authorization health.');
      setAuthorizationHealth(healthBody.items || []);
      const noShowResponse = await fetch('/api/admin/no-show/failures', { headers: await authenticatedHeaders() });
      const noShowBody = await noShowResponse.json();
      if (!noShowResponse.ok) throw new Error(noShowBody?.error?.message || 'Unable to load no-show failures.');
      setNoShowFailures(noShowBody.items || []);
      const queueResponse = await fetch('/api/admin/operations/queue', { headers: await authenticatedHeaders() });
      const queueBody = await queueResponse.json();
      if (!queueResponse.ok) throw new Error(queueBody?.error?.message || 'Unable to load the operations queue.');
      setQueue(queueBody.items || []);
      setQueueCounts(queueBody.counts || {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load reconciliation.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedHeaders]);

  useEffect(() => { void loadReconciliation(); }, [loadReconciliation]);

  const retryRefund = async (item: ReconciliationItem) => {
    if (!window.confirm(`Retry the PayPal refund for session ${item.session_id || 'without a linked session'}? A duplicate ledger entry will not be created.`)) return;
    setRetrying(item.event_id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/paypal/reconciliation/${encodeURIComponent(item.event_id)}/retry`, {
        method: 'POST',
        headers: await authenticatedHeaders(),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || body?.error || 'Refund retry failed.');
      setNotice(`Refund retry ${body.retry?.status === 'PENDING' ? 'submitted and is pending provider confirmation' : 'completed'} for session ${body.session?.id || item.session_id}.`);
      await loadReconciliation();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Refund retry failed.');
      await loadReconciliation();
    } finally {
      setRetrying(null);
    }
  };

  const workQueueItem = async (item: QueueItem, action: string) => {
    const reason = window.prompt(`Reason for ${action.toLowerCase().replaceAll('_', ' ')}:`, 'Moderator reviewed the operational evidence');
    if (!reason?.trim()) return;
    setError(null);
    setNotice(null);
    try {
      let endpoint = '';
      let body: Record<string, string> = { reasonCode: action, reasonText: reason.trim() };
      if (item.type === 'CONDUCT_REPORT') {
        endpoint = `/api/admin/reports/${encodeURIComponent(item.id)}/resolve`;
        body = { ...body, status: 'RESOLVED' };
      } else if (item.type === 'DISPUTE') {
        endpoint = `/api/admin/disputes/${encodeURIComponent(item.id)}/resolve`;
        body = { ...body, resolution: action === 'REFUND' ? 'REFUND' : 'RELEASE' };
      } else if (item.type === 'REVIEW_FLAG') {
        endpoint = `/api/admin/moderation/reviews/${encodeURIComponent(item.id)}`;
        body = { ...body, action: action === 'HIDE_REVIEW' ? 'HIDE' : action === 'RESTORE_REVIEW' ? 'RESTORE' : 'ESCALATE' };
      } else {
        return;
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: await authenticatedHeaders(),
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Queue action failed.');
      setNotice('The queue action was saved and recorded in the audit trail.');
      await loadReconciliation();
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : 'Queue action failed.');
      await loadReconciliation();
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Moderator Overview</h2>
            <p className="text-sm text-muted-foreground">Resolve reports, disputes, and payment exceptions.</p>
          </div>
          <button onClick={() => void loadReconciliation()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-center">
          <span className="text-sm text-muted-foreground font-medium mb-2">Open Reports</span>
          <span className="text-3xl font-bold text-foreground">{queueCounts.CONDUCT_REPORT || 0}</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-center">
          <span className="text-sm text-muted-foreground font-medium mb-2">Active Disputes</span>
          <span className="text-3xl font-bold text-foreground">{queueCounts.DISPUTE || 0}</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-center">
          <span className="text-sm text-muted-foreground font-medium mb-2">Pending Reviews</span>
          <span className="text-3xl font-bold text-foreground">{queueCounts.REVIEW_FLAG || 0}</span>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      {notice && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</div>}

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-4"><AlertTriangle className="mr-2 inline h-5 w-5 text-amber-600" />Authorization hold health</h3>
        {authorizationHealth.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-secondary/20 p-5 text-sm text-muted-foreground">No scheduled PayPal authorizations expire within the next 24 hours.</p>
        ) : (
          <div className="space-y-3">
            {authorizationHealth.map((item) => (
              <div key={item.id} className={`rounded-xl border p-4 ${item.expired ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`font-semibold ${item.expired ? 'text-red-800' : 'text-amber-800'}`}>
                      {item.expired ? 'Authorization expired' : 'Authorization expires soon'} · session {item.id}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Trader {item.trader_id} · Coach {item.coach_id} · {item.paypal_authorization_status || 'Provider status unknown'}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${item.expired ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700'}`}>
                    {item.paypal_authorization_expires_at ? new Date(item.paypal_authorization_expires_at).toLocaleString() : 'No expiry recorded'}
                  </span>
                </div>
                <p className={`mt-3 text-sm ${item.expired ? 'text-red-800' : 'text-amber-800'}`}><strong>Next action:</strong> {item.nextAction}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold"><ShieldAlert className="mr-2 inline h-5 w-5 text-red-600" />No-show settlement failures</h3>
            <p className="mt-1 text-sm text-muted-foreground">Failed no-show resolutions are surfaced here before they can leave an authorization or payout in limbo.</p>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{noShowFailures.filter((item) => item.needsAttention).length} need attention</span>
        </div>
        {loading ? <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Loading no-show failures…</div> :
          noShowFailures.length === 0 ? <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-600" />
            <p className="text-sm font-semibold text-foreground">No no-show settlement failures recorded.</p>
            <p className="mt-1 text-xs text-muted-foreground">The worker will add a visible exception if a safe resolution fails.</p>
          </div> :
          <div className="space-y-4">
            {noShowFailures.map((item) => {
              const details = item.details || {};
              return <div key={item.id} className={`rounded-xl border p-4 ${item.needsAttention ? 'border-red-200 bg-red-50/60' : 'border-border'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className={`mt-0.5 h-5 w-5 ${item.needsAttention ? 'text-red-600' : 'text-amber-600'}`} />
                    <div>
                      <p className="font-semibold text-foreground">No-show resolution failed · session {item.session_id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Recorded {new Date(item.created_at).toLocaleString()} · Trader {item.trader_id} · Coach {item.coach_id}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${item.needsAttention ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700'}`}>
                    {item.needsAttention ? 'Needs attention' : 'Resolved'}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Session status</p><p className="font-semibold">{item.status}</p></div>
                  <div><p className="text-xs text-muted-foreground">Payment</p><p className="font-semibold">{item.payment_status}</p></div>
                  <div><p className="text-xs text-muted-foreground">Payout</p><p className="font-semibold">{item.payout_status}</p></div>
                </div>
                <p className="mt-3 rounded-lg bg-background/70 px-3 py-2 text-xs text-foreground"><strong>Failure:</strong> {details.message || 'No-show settlement could not be completed safely.'}</p>
                <p className="mt-2 text-xs text-muted-foreground"><strong>Next action:</strong> {details.nextAction || 'Retry automatically on the next worker pass; investigate if the failure persists.'}</p>
              </div>;
            })}
          </div>}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Refund reconciliation</h3>
            <p className="mt-1 text-sm text-muted-foreground">PayPal failures stay visible with their retry history and final provider outcome.</p>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{unresolvedItems.length} unresolved</span>
        </div>
        {loading ? <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Loading payment exceptions…</div> :
          items.length === 0 ? <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-600" />
            <p className="text-sm font-semibold text-foreground">No failed refunds need attention.</p>
            <p className="mt-1 text-xs text-muted-foreground">New provider failures will appear here automatically.</p>
          </div> :
          <div className="space-y-4">
            {items.map((item) => {
              const history = item.retry_history || [];
              return <div key={item.event_id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-semibold text-foreground">Refund failed · session {item.session_id || 'unlinked'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Event {item.event_id} · {item.event_type}</p>
                    </div>
                  </div>
                  {['FAILED', 'RETRY_REQUIRED'].includes(item.status) && <button onClick={() => void retryRefund(item)} disabled={retrying === item.event_id} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    <RefreshCw className={`h-4 w-4 ${retrying === item.event_id ? 'animate-spin' : ''}`} />{retrying === item.event_id ? 'Retrying…' : 'Retry refund'}
                  </button>}
                </div>
                <div className="mt-3 flex items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone(item.status)}`}>{item.status}</span>{item.status === 'RECONCILED' && <span className="text-xs font-semibold text-emerald-700">Provider and ledger reconciled</span>}</div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Payment</p><p className="font-semibold">{item.payment_status || 'Unknown'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Payout</p><p className="font-semibold">{item.payout_status || 'Unknown'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Attempts</p><p className="font-semibold">{item.retry_count || 0}</p></div>
                  <div><p className="text-xs text-muted-foreground">Last attempt</p><p className="font-semibold">{item.last_retry_at ? new Date(item.last_retry_at).toLocaleString() : 'None'}</p></div>
                </div>
                {item.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><strong>Provider outcome:</strong> {item.error}</p>}
                {history.length > 0 && <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Retry history</p>
                  <div className="space-y-2">{history.slice(-5).map((attempt, index) => <div key={`${attempt.attempt}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                    <span>Attempt {attempt.attempt}</span><span className={`rounded-full border px-2 py-0.5 font-semibold ${statusTone(attempt.status)}`}>{attempt.status}</span><span className="text-muted-foreground">{attempt.error || attempt.completedAt || 'In progress'}</span>
                  </div>)}</div>
                </div>}
              </div>;
            })}
          </div>}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold"><ShieldAlert className="mr-2 inline h-5 w-5 text-primary" />Unified operations queue</h3>
            <p className="mt-1 text-sm text-muted-foreground">One queue for trust, marketplace, and settlement exceptions. Open each item in its source workflow before taking action.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{queue.length} open items</span>
        </div>
        {loading ? <div className="p-8 text-sm text-muted-foreground">Loading the operations queue…</div> :
          queue.length === 0 ? <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-600" />
            <p className="text-sm font-semibold text-foreground">All operational queues are clear.</p>
          </div> :
          <div className="space-y-3">
            {queue.map((item) => (
              <div key={`${item.type}:${item.id}`} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted-foreground">{item.type.replaceAll('_', ' ')}</span>
                      <span className="text-xs font-semibold text-amber-700">{item.priority}</span>
                    </div>
                    <p className="mt-2 font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.summary || 'No additional context recorded.'}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Target: <strong className="font-mono text-foreground">{item.targetId}</strong></span>
                  {item.sessionId && <span>Session: <strong className="font-mono text-foreground">{item.sessionId}</strong></span>}
                  {item.reporterId && <span>Reporter: <strong className="font-mono text-foreground">{item.reporterId}</strong></span>}
                  {item.evidenceReference && <span>Evidence reference: <strong className="break-all text-foreground">{item.evidenceReference}</strong></span>}
                  {item.paymentStatus && <span>Payment: <strong className="text-foreground">{item.paymentStatus}</strong></span>}
                  {item.payoutStatus && <span>Payout: <strong className="text-foreground">{item.payoutStatus}</strong></span>}
                </div>
                {item.actions.some((action) => ['RESOLVE_REPORT', 'RESOLVE_DISPUTE', 'HIDE_REVIEW', 'ESCALATE_REVIEW', 'RESTORE_REVIEW'].includes(action)) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.type === 'CONDUCT_REPORT' && <button onClick={() => void workQueueItem(item, 'RESOLVE_REPORT')} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">Resolve report</button>}
                    {item.type === 'DISPUTE' && <>
                      <button onClick={() => void workQueueItem(item, 'RELEASE')} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">Release payout</button>
                      <button onClick={() => void workQueueItem(item, 'REFUND')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Refund trader</button>
                    </>}
                    {item.type === 'REVIEW_FLAG' && <>
                      <button onClick={() => void workQueueItem(item, 'HIDE_REVIEW')} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">Hide review</button>
                      <button onClick={() => void workQueueItem(item, 'ESCALATE_REVIEW')} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">Escalate</button>
                      <button onClick={() => void workQueueItem(item, 'RESTORE_REVIEW')} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Restore</button>
                    </>}
                  </div>
                )}
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
};
