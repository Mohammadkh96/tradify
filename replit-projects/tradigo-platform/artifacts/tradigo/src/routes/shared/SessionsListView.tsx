import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { BookOpen, CalendarClock, Clock, Loader2, Video } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';

type SessionListItem = {
  id: string;
  mode: string;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
  amountCents: number;
  finalAmountCents?: number | null;
  paymentStatus: string;
  paypalAuthorizationExpiresAt?: string | null;
  paypalAuthorizationExpired?: boolean;
  paypalAuthorizationExpiringSoon?: boolean;
  paymentNextAction?: string | null;
  topic?: string | null;
  createdAt: string;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  noShowType?: string | null;
  noShowResolutionFailure?: {
    id: number | string;
    createdAt?: string | null;
    message: string;
    paymentStatus?: string | null;
    retryable: boolean;
    nextAction: string;
  } | null;
  rescheduledFrom?: string | null;
  learningGoal?: string | null;
  learningStatus?: string | null;
};

const statusLabel = (session: SessionListItem) => {
  if (session.noShowType) {
    const who = session.noShowType === 'MUTUAL' ? 'both absent' : `${session.noShowType.toLowerCase()} absent`;
    return `No-show · ${who}`;
  }
  if (session.status === 'CANCELLED') return 'Cancelled · payment released';
  return session.status.replaceAll('_', ' ');
};

const paymentLabel = (paymentStatus: string) => {
  if (['VOIDED', 'CANCELLED', 'REFUNDED'].includes(paymentStatus)) return 'Payment released';
  if (paymentStatus === 'REFUND_PENDING') return 'Payment release pending';
  return null;
};

const paymentAccessibleLabel = (paymentStatus: string) => {
  const label = paymentLabel(paymentStatus);
  if (!label) return null;
  return label === 'Payment released'
    ? `${label}. Authorized funds are no longer being held for this session.`
    : `${label}. Authorized funds are still being reviewed for release.`;
};

const noShowFailureNeedsAttention = (session: Pick<SessionListItem, 'status' | 'paymentStatus' | 'noShowResolutionFailure'>) =>
  Boolean(
    session.noShowResolutionFailure
    && (
      session.status !== 'CANCELLED'
      || ['PAYPAL_AUTHORIZED', 'PAYPAL_SETTLED', 'REFUND_PENDING', 'REFUND_FAILED'].includes(session.paymentStatus)
    ),
  );

export function SessionsListView() {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/coach') ? '/coach' : '/app';
  const isCoach = basePath === '/coach';
  const { firebaseUser, canonicalUser } = useAuthStore();
  const identityKey = firebaseUser?.uid ?? canonicalUser?.id ?? 'anonymous';
  const [items, setItems] = useState<SessionListItem[]>([]);
  const [passport, setPassport] = useState<SessionListItem[]>([]);
  const [dataIdentity, setDataIdentity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const requestedIdentity = identityKey;
    try {
      const [data, passportData] = await Promise.all([
        apiClient.get('/api/sessions'),
        isCoach ? Promise.resolve({ records: [] }) : apiClient.get('/api/learning/passport'),
      ]);
      if (requestedIdentity !== (useAuthStore.getState().firebaseUser?.uid ?? useAuthStore.getState().canonicalUser?.id ?? 'anonymous')) return;
      setItems(data.items ?? []);
      setPassport(passportData.records ?? []);
      setDataIdentity(requestedIdentity);
      setError(null);
    } catch (err: any) {
      if (requestedIdentity !== (useAuthStore.getState().firebaseUser?.uid ?? useAuthStore.getState().canonicalUser?.id ?? 'anonymous')) return;
      setError(err.message || 'Unable to load sessions.');
    } finally {
      if (requestedIdentity === (useAuthStore.getState().firebaseUser?.uid ?? useAuthStore.getState().canonicalUser?.id ?? 'anonymous')) {
        setLoading(false);
      }
    }
  }, [identityKey, isCoach]);

  useEffect(() => {
    setItems([]);
    setPassport([]);
    setDataIdentity(null);
    setError(null);
    setLoading(true);
    load();
  }, [load]);

  const sections = useMemo(() => ({
    active: items.filter((item) => ['REQUESTED', 'COACH_CLAIMED', 'PAYMENT_READY', 'ROOM_READY', 'ACTIVE'].includes(item.status)),
    history: items.filter((item) => ['COMPLETED', 'CANCELLED'].includes(item.status)),
  }), [items]);

  const money = (cents: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);

  if (loading || dataIdentity !== identityKey) {
    return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <main className="min-w-0 space-y-7" aria-labelledby="sessions-list-title">
      <header>
        <h1 id="sessions-list-title" className="text-3xl font-black tracking-tight">{isCoach ? 'Coaching sessions' : 'Your sessions'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isCoach ? 'Manage accepted requests, room handoffs, and completed student consultations.' : 'Rejoin active rooms and review your receipts and coaching history.'}
        </p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {!isCoach && passport.length > 0 && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5" aria-labelledby="learning-passport-title">
          <h2 id="learning-passport-title" className="text-sm font-bold uppercase tracking-wider text-primary">Your learning passport</h2>
          <p className="mt-1 text-sm text-muted-foreground">After a session ends, come back here to reopen its private learning passport.</p>
          <ul className="mt-4 space-y-3">
            {passport.slice(0, 3).map((record: any) => (
              <li key={record.id}>
                <Link
                  to={record.sessionId ? `${basePath}/sessions/${record.sessionId}` : `${basePath}/sessions`}
                  className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 lg:flex-row lg:items-center lg:justify-between"
                  aria-label={`${record.learningGoal || record.topic || 'Learning session'}. ${record.status === 'COMPLETE' ? 'Summary complete' : 'Waiting for coach summary'}. Open passport`}
                >
                  <div className="min-w-0">
                    <p className="font-bold">{record.learningGoal || record.topic || 'Learning session'}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {record.status === 'COMPLETE' ? 'Summary complete' : 'Waiting for coach summary'}
                      {record.scheduledAt ? ` · ${new Date(record.scheduledAt).toLocaleDateString()}` : ''}
                    </p>
                    {record.practiceSteps && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground"><strong className="text-foreground">Next practice: </strong>{record.practiceSteps}</p>}
                  </div>
                  <span className="inline-flex max-w-full min-w-0 items-center gap-2 break-words whitespace-normal text-sm font-bold text-primary lg:shrink-0">
                    <BookOpen aria-hidden="true" className="h-4 w-4" /> Open passport
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">This tracks learning progress, not trading returns or investment performance.</p>
        </section>
      )}

      {(['active', 'history'] as const).map((section) => (
        <section key={section} className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {section === 'active' ? 'Open and upcoming' : 'History'}
          </h2>
          {sections[section].length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-9 text-center text-sm text-muted-foreground">
              <CalendarClock className="mx-auto mb-3 h-8 w-8" />
              No {section === 'active' ? 'open sessions' : 'completed sessions'} yet.
            </div>
           ) : (
            <ul aria-label={`${section === 'active' ? 'Open and upcoming' : 'Session history'} list`} className="grid gap-3">
              {sections[section].map((session) => (
                 <li key={session.id}>
                   <Link
                     to={`${basePath}/sessions/${session.id}`}
                      aria-label={`${session.topic || (session.mode === 'SCHEDULED' ? 'Scheduled consultation' : 'Coach Now consultation')}. Status: ${statusLabel(session)}.${paymentAccessibleLabel(session.paymentStatus) ? ` ${paymentAccessibleLabel(session.paymentStatus)}` : ''} ${session.status === 'COMPLETED' ? 'Open passport.' : 'Open session.'}`}
                      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 lg:flex-row lg:items-center lg:justify-between"
                   >
                     <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{session.topic || (session.mode === 'SCHEDULED' ? 'Scheduled consultation' : 'Coach Now consultation')}</strong>
                       <span
                         role="status"
                         aria-live="polite"
                         aria-atomic="true"
                         aria-label={`Session status: ${statusLabel(session)}`}
                          className="max-w-full rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground break-words whitespace-normal"
                       >
                         {statusLabel(session)}
                       </span>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                       <span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="h-4 w-4" /> {session.durationMinutes} minutes</span>
                      <span>{session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : 'Next available slot'}</span>
                      <span>{money(session.finalAmountCents ?? session.amountCents)}</span>
                    </p>
                     {session.rescheduledFrom && (
                        <p
                          className="mt-2 text-xs font-semibold text-amber-700"
                          aria-label={`Session rescheduled from ${new Date(session.rescheduledFrom).toLocaleString()} to ${session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : 'a new time'}.`}
                        >
                         Rescheduled from {new Date(session.rescheduledFrom).toLocaleString()}
                       </p>
                     )}
                     {paymentLabel(session.paymentStatus) && (
                        <p
                          className="mt-1 text-xs font-medium text-muted-foreground"
                          aria-label={paymentAccessibleLabel(session.paymentStatus) ?? undefined}
                        >
                         {paymentLabel(session.paymentStatus)}
                       </p>
                     )}
                     {session.paymentNextAction && (
                        <p className={`mt-1 break-words whitespace-pre-wrap text-xs font-semibold ${session.paypalAuthorizationExpired ? 'text-red-700' : 'text-amber-700'}`}>
                         {session.paypalAuthorizationExpired ? 'Payment hold expired — contact support.' : `Payment hold expires ${session.paypalAuthorizationExpiresAt ? new Date(session.paypalAuthorizationExpiresAt).toLocaleString() : 'soon'} — start the session or contact support.`}
                       </p>
                     )}
                      {noShowFailureNeedsAttention(session) && (
                         <p className="mt-1 break-words whitespace-pre-wrap text-xs font-semibold text-red-700">
                          No-show settlement needs attention — Tradigo is retrying the payment release.
                        </p>
                      )}
                    </div>
                      <span className="inline-flex max-w-full min-w-0 items-center gap-2 break-words whitespace-normal text-sm font-bold text-primary">
                       {session.status === 'COMPLETED' ? <BookOpen aria-hidden="true" className="h-4 w-4" /> : <Video aria-hidden="true" className="h-4 w-4" />}
                       {session.status === 'COMPLETED' ? 'Open passport' : 'Open session'}
                    </span>
                   </Link>
                 </li>
              ))}
             </ul>
          )}
        </section>
      ))}
    </main>
  );
}