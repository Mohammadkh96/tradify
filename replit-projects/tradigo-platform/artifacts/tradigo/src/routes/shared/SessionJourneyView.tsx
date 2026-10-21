import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Loader2, CheckCircle2, ShieldCheck, CreditCard, 
  Video, Clock, ArrowLeft, XCircle, AlertCircle, ShieldAlert, Play
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { PostSessionFeedback } from '../../components/trading/PostSessionFeedback';
import { TraderJourneyPassport } from '../../components/trading/TraderJourneyPassport';

// Session Type
interface Session {
  id: string;
  coachId: string;
  traderId: string;
  mode: string;
  status: 'REQUESTED' | 'COACH_CLAIMED' | 'PAYMENT_READY' | 'ROOM_READY' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: string;
  durationMinutes: number;
  amountCents: number;
  paymentStatus: string;
  paymentApprovalUrl: string | null;
  paypalAuthorizationExpiresAt?: string | null;
  paypalAuthorizationExpired?: boolean;
  paypalAuthorizationExpiringSoon?: boolean;
  coachClaimExpiresAt?: string | null;
  paymentNextAction?: string | null;
  paymentSetupStatus?: 'RETRYING' | null;
  paymentSetupNextAction?: string | null;
  roomName: string | null;
  createdAt: string;
  updatedAt?: string;
  review?: any;
  topic?: string;
  coachName?: string;
  finalAmountCents?: number | null;
  billableSeconds?: number;
  platformFeeCents?: number;
  disputeStatus?: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  noShowType?: string | null;
  noShowResolutionFailure?: NoShowResolutionFailure | null;
  rescheduledFrom?: string | null;
  learningRecord?: LearningRecord | null;
  conductReport?: ConductReport | null;
}

interface ConductReport {
  id: string;
  reason: string;
  details: string;
  evidenceReference?: string | null;
  status: string;
  createdAt: string;
}

interface LearningRecord {
  learningGoal: string;
  conceptsReviewed?: string | null;
  evidenceDiscussed?: string | null;
  sharedArtifact?: string | null;
  unresolvedQuestions?: string | null;
  practiceSteps?: string | null;
  traderReflection?: string | null;
  status: string;
}

interface NoShowResolutionFailure {
  id: number | string;
  createdAt?: string | null;
  message: string;
  paymentStatus?: string | null;
  retryable: boolean;
  nextAction: string;
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

const formatEventDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown time';

const paymentReleaseLabel = (paymentStatus: string) => {
  if (['VOIDED', 'CANCELLED', 'REFUNDED'].includes(paymentStatus)) return 'Payment released';
  if (paymentStatus === 'REFUND_PENDING') return 'Payment release pending';
  return null;
};

const paymentReleaseAccessibleLabel = (paymentStatus: string) => {
  const label = paymentReleaseLabel(paymentStatus);
  if (!label) return null;
  return label === 'Payment released'
    ? `${label}. Authorized funds are no longer being held for this session.`
    : `${label}. Authorized funds are still being reviewed for release.`;
};

const cancelledByLabel = (session: Session, currentUserId?: string) => {
  if (!session.cancelledBy) return 'Tradigo';
  if (session.cancelledBy === currentUserId) return 'You';
  if (session.cancelledBy === session.traderId) return 'Trader';
  if (session.cancelledBy === session.coachId) return 'Coach';
  return 'Tradigo';
};

const statusLabel = (session: Session) => {
  if (session.noShowType) {
    const who = session.noShowType === 'MUTUAL' ? 'both participants absent' : `${session.noShowType.toLowerCase()} absent`;
    return `No-show · ${who}`;
  }
  if (session.status === 'CANCELLED') return 'Cancelled · payment released';
  return session.status.replaceAll('_', ' ');
};

const noShowFailureNeedsAttention = (session: Pick<Session, 'status' | 'paymentStatus' | 'noShowResolutionFailure'>) =>
  Boolean(
    session.noShowResolutionFailure
    && (
      session.status !== 'CANCELLED'
      || ['PAYPAL_AUTHORIZED', 'PAYPAL_SETTLED', 'REFUND_PENDING', 'REFUND_FAILED'].includes(session.paymentStatus)
    ),
  );

const StepProgress = ({ status }: { status: string }) => {
  const steps = [
    { id: 'request', label: 'Requested' },
    { id: 'payment', label: 'Payment' },
    { id: 'room', label: 'Ready' },
    { id: 'complete', label: 'Completed' },
  ];

  const currentIndex = (() => {
    switch (status) {
      case 'REQUESTED': return 0;
      case 'COACH_CLAIMED': return 1;
      case 'PAYMENT_READY': return 1;
      case 'ROOM_READY': return 2;
      case 'ACTIVE': return 2;
      case 'COMPLETED': return 3;
      case 'CANCELLED': return 3;
      default: return 0;
    }
  })();

  return (
    <div className="max-w-2xl mx-auto w-full px-8 sm:px-12">
      <div className="relative">
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-border -translate-y-1/2" />
        <div 
          className="absolute top-1/2 left-0 h-[2px] bg-primary -translate-y-1/2 transition-all duration-700 ease-in-out" 
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        />
          <div className="relative flex justify-between">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            
            return (
              <div key={step.id} className="flex w-1/4 min-w-0 flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-[3px] transition-all duration-500 relative z-10 shadow-sm
                    ${isCompleted ? 'bg-primary border-primary text-primary-foreground' : 
                      isCurrent ? 'bg-background border-primary text-primary shadow-[0_0_15px_rgba(0,0,0,0.1)]' :
                      'bg-background border-border text-muted-foreground'}`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-bold">{idx + 1}</span>
                  )}
                </div>
                <span className={`absolute top-10 mt-4 w-full px-1 text-center text-xs font-bold uppercase leading-tight tracking-widest whitespace-normal break-words transition-colors duration-300
                  ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="h-12"></div>
    </div>
  );
};

export const SessionJourneyView = () => {
  const { sessionId: id } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { canonicalUser, firebaseUser } = useAuthStore();
  const identityKey = firebaseUser?.uid ?? canonicalUser?.id ?? 'anonymous';
  const basePath = location.pathname.startsWith('/preview/coach')
    ? '/preview/coach'
    : location.pathname.startsWith('/preview')
      ? '/preview'
    : canonicalUser?.role === 'COACH'
      ? '/coach'
      : '/app';
  
  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [sessionIdentity, setSessionIdentity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [learningDraft, setLearningDraft] = useState({
    conceptsReviewed: '',
    evidenceDiscussed: '',
    sharedArtifact: '',
    unresolvedQuestions: '',
    practiceSteps: '',
  });
  const [traderReflection, setTraderReflection] = useState('');
  const [reportDraft, setReportDraft] = useState({ reason: '', details: '', evidenceReference: '' });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const session = sessionIdentity === identityKey ? sessionData : null;
  
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
    if (session?.learningRecord) {
      setLearningDraft({
        conceptsReviewed: session.learningRecord.conceptsReviewed ?? '',
        evidenceDiscussed: session.learningRecord.evidenceDiscussed ?? '',
        sharedArtifact: session.learningRecord.sharedArtifact ?? '',
        unresolvedQuestions: session.learningRecord.unresolvedQuestions ?? '',
        practiceSteps: session.learningRecord.practiceSteps ?? '',
      });
      setTraderReflection(session.learningRecord.traderReflection ?? '');
    }
  }, [session]);

  const fetchSession = useCallback(async () => {
    if (!id) return;
    const requestedIdentity = identityKey;
    try {
      const data = await apiClient.get(`/api/sessions/${id}`);
      if (identityRef.current !== requestedIdentity) return;
      setSessionData(data.session);
      setSessionIdentity(requestedIdentity);
    } catch (err: any) {
      if (identityRef.current === requestedIdentity) {
        setSessionData(null);
        setSessionIdentity(requestedIdentity);
        setError(err.message || 'Failed to load session details.');
      }
    } finally {
      if (identityRef.current === requestedIdentity) setLoading(false);
    }
  }, [id, identityKey]);

  useEffect(() => {
    setSessionIdentity(null);
    setError(null);
    setLoading(true);
    fetchSession();
    
    pollIntervalRef.current = window.setInterval(() => {
      fetchSession();
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchSession]);

  useEffect(() => {
    if (session?.status === 'COMPLETED' || session?.status === 'CANCELLED') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }
  }, [session?.status]);

  const handleAuthorizePayment = async () => {
    if (!id) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${id}/payment/authorize`);
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'Payment authorization failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshPaymentSetup = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'Payment setup could not be refreshed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!id) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${id}/start`);
      navigate(`${basePath}/sessions/${id}/live`);
    } catch (err: any) {
      setError(err.message || 'Failed to start the session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!id) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${id}/complete`, { reason: 'Consultation concluded properly', confirm: true });
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'Failed to complete the session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!id) return;
    const reason = window.prompt('Describe what should be reviewed. This will freeze payout while a moderator investigates.');
    if (!reason?.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${id}/disputes`, { reason: reason.trim() });
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'The dispute could not be opened.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    const reason = window.prompt('Why should this upcoming consultation be cancelled?');
    if (!reason?.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${id}/cancel`, { reason: reason.trim() });
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'The session could not be cancelled safely.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!id || session?.mode !== 'SCHEDULED') return;
    const value = window.prompt('Enter the new session time in ISO format (for example, 2026-09-01T14:00:00Z).');
    if (!value?.trim()) return;
    const next = new Date(value.trim());
    if (Number.isNaN(next.getTime())) {
      setError('Enter a valid future date and time.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${id}/reschedule`, { scheduledAt: next.toISOString() });
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'The session could not be rescheduled.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNoShow = async () => {
    if (!id) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${id}/no-show`);
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'No-show resolution is not available yet.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveLearningSummary = async () => {
    if (!id) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${id}/learning-record`, learningDraft);
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'The learning summary could not be saved.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveTraderReflection = async () => {
    if (!id || !traderReflection.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/sessions/${id}/learning-record`, { traderReflection: traderReflection.trim() });
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'Your private reflection could not be saved.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitConductReport = async () => {
    if (!id || !reportDraft.reason || reportDraft.details.trim().length < 3) return;
    setActionLoading(true);
    setError(null);
    setReportNotice(null);
    try {
      const result = await apiClient.post(`/api/sessions/${id}/conduct-reports`, {
        reason: reportDraft.reason,
        details: reportDraft.details.trim(),
        evidenceReference: reportDraft.evidenceReference.trim() || undefined,
      });
      setReportDraft({ reason: '', details: '', evidenceReference: '' });
      setReportOpen(false);
      setReportNotice(result?.idempotent
        ? 'This conduct report was already submitted and is in the moderator operations queue.'
        : 'Your conduct report was submitted to Tradigo moderators.');
      await fetchSession();
    } catch (err: any) {
      setError(err.message || 'The conduct report could not be submitted.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-6 text-muted-foreground font-medium tracking-wide">Establishing secure connection...</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-card border border-border rounded-3xl p-12 text-center shadow-sm">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-foreground">Connection Error</h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">{error}</p>
        <Button onClick={() => navigate(basePath)} className="mt-8 px-8" size="lg">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  if (!session) return null;

  const isTrader = canonicalUser?.role === 'TRADER';
  const canSubmitConductReport = ['ACTIVE', 'COMPLETED'].includes(session.status);
  const paymentRelease = paymentReleaseLabel(session.paymentStatus);
  const paymentReleaseAccessible = paymentReleaseAccessibleLabel(session.paymentStatus);
  const noShowFailureVisible = noShowFailureNeedsAttention(session);
  const paymentSetupRetrying = isTrader
    && session.status === 'REQUESTED'
    && session.paymentSetupStatus === 'RETRYING';
  const scheduledWindow = session.mode === 'SCHEDULED' && session.scheduledAt
    ? {
        opensAt: new Date(new Date(session.scheduledAt).getTime() - 15 * 60_000).toISOString(),
        closesAt: new Date(new Date(session.scheduledAt).getTime() + (session.durationMinutes + 10) * 60_000).toISOString(),
      }
    : null;
  const timeline = [
    { label: 'Session requested', date: session.createdAt, detail: 'The coaching request was created.' },
    ...(session.rescheduledFrom ? [{
      label: 'Session rescheduled',
      date: session.updatedAt ?? session.scheduledAt,
      detail: `Moved from ${formatEventDate(session.rescheduledFrom)} to ${formatEventDate(session.scheduledAt)}.`,
    }] : []),
    ...(session.status === 'CANCELLED' ? [{
      label: session.noShowType
        ? `No-show · ${session.noShowType === 'MUTUAL' ? 'both participants' : `${session.noShowType.toLowerCase()} absent`}`
        : 'Session cancelled',
      date: session.cancelledAt ?? session.updatedAt ?? session.createdAt,
      detail: `${cancelledByLabel(session, canonicalUser?.id)} ended this session.`,
    }] : []),
    ...(noShowFailureVisible && session.noShowResolutionFailure ? [{
      label: 'No-show resolution needs attention',
      date: session.noShowResolutionFailure.createdAt ?? session.updatedAt ?? session.createdAt,
      detail: session.noShowResolutionFailure.message,
    }] : []),
  ];

  const renderStatusContent = () => {
    switch (session.status) {
      case 'REQUESTED':
        return (
          <>
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-8 border border-primary/10">
              <Clock className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-4">
              {paymentSetupRetrying ? 'Payment Setup Is Being Retried' : 'Consultation Requested'}
            </h2>
            <p className="text-muted-foreground mb-8 text-center max-w-md leading-relaxed">
              {paymentSetupRetrying
                ? 'Your coach accepted this request, but PayPal did not confirm the checkout response. Tradigo is safely retrying the existing payment setup. Do not start another checkout attempt.'
                : 'Waiting for the professional coach to accept the request. Once approved, the payment gateway will open.'}
            </p>
            {paymentSetupRetrying && (
              <div className="mb-8 w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-amber-900" role="status" aria-live="polite">
                <div className="flex gap-3">
                  <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">Payment setup is in progress</p>
                    <p className="mt-1 text-sm">
                      {session.paymentSetupNextAction ?? 'Tradigo will retry the existing payment setup. Refresh this session to check for the PayPal approval link.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {paymentSetupRetrying && (
              <Button
                size="lg"
                variant="outline"
                onClick={handleRefreshPaymentSetup}
                disabled={actionLoading}
                className="w-full max-w-full whitespace-normal text-center leading-tight sm:w-auto sm:min-w-[240px] font-bold text-base h-14"
                data-testid="button-refresh-payment-setup"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : null}
                {actionLoading ? 'Checking payment setup…' : 'Check for payment setup'}
              </Button>
            )}
            {basePath === '/preview' ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex max-w-full flex-wrap items-center justify-center text-center text-sm font-bold tracking-wide text-primary bg-primary/5 px-6 py-3 rounded-full">
                  <Loader2 className="w-4 h-4 mr-3 animate-spin" />
                  AWAITING COACH ACCEPTANCE...
                </div>
                <Link
                  to="/preview/coach"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  data-testid="link-open-coach-desk"
                >
                  Open coach desk to accept
                </Link>
                <p className="max-w-sm text-center text-xs text-muted-foreground">
                  In this preview, switch to the coach desk, accept the request, then return to the trader preview.
                </p>
              </div>
            ) : (
                <div className="flex max-w-full flex-wrap items-center justify-center text-center text-sm font-bold tracking-wide text-primary bg-primary/5 px-6 py-3 rounded-full border border-primary/10">
                <Loader2 className="w-4 h-4 mr-3 animate-spin" />
                AWAITING COACH APPROVAL
              </div>
            )}
          </>
        );

      case 'COACH_CLAIMED':
        return (
          <>
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-8 border border-primary/10">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-4">Coach claimed this route</h2>
            <p className="text-muted-foreground mb-8 text-center max-w-md leading-relaxed">
              The coach has reserved this Coach Now request. The trader must confirm the match before PayPal authorization or room setup can begin.
            </p>
             <div className="flex max-w-full flex-wrap items-center justify-center text-center text-sm font-bold tracking-wide text-primary bg-primary/5 px-6 py-3 rounded-full border border-primary/10">
              <Loader2 className="w-4 h-4 mr-3 animate-spin" />
              AWAITING TRADER CONFIRMATION
            </div>
          </>
        );

      case 'PAYMENT_READY':
        if (isTrader) {
          return (
            <>
              <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-8 border border-primary/10">
                <CreditCard className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-black tracking-tight mb-4">Secure Your Session</h2>
              <p className="text-muted-foreground mb-10 text-center max-w-md leading-relaxed">
                Please authorize the payment of <strong className="text-foreground">{formatCurrency(session.amountCents)}</strong> to secure your time. Funds are held securely until the session completes.
              </p>
              {session.paymentApprovalUrl && (
                <div className="mb-5 flex flex-col items-center gap-2">
                  <a
                    href={session.paymentApprovalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Open the PayPal sandbox checkout
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Approve the order in PayPal first, then return here to confirm it.
                  </p>
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  className="mb-5 max-w-md rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                >
                  {error}
                </div>
              )}
              <Button 
                size="lg" 
                onClick={handleAuthorizePayment} 
                disabled={actionLoading}
                className="w-full max-w-full whitespace-normal text-center leading-tight sm:w-auto sm:min-w-[240px] font-bold text-base h-14"
                data-testid="button-authorize-payment"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <ShieldCheck className="w-5 h-5 mr-3" />}
                {session.paymentApprovalUrl ? 'Confirm PayPal Authorization' : 'Authorize Consultation Fee'}
              </Button>
            </>
          );
        } else {
          return (
            <>
              <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-8 border border-border">
                <CreditCard className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-black tracking-tight mb-4">Waiting for Payment</h2>
              <p className="text-muted-foreground mb-8 text-center max-w-md leading-relaxed">
                The trader is currently authorizing the consultation fee. Once secured, the live room will be provisioned.
              </p>
              <div className="flex max-w-full flex-wrap items-center justify-center text-center text-sm font-bold tracking-wide text-muted-foreground bg-secondary px-6 py-3 rounded-full border border-border">
                <Loader2 className="w-4 h-4 mr-3 animate-spin" />
                AWAITING FEE AUTHORIZATION
              </div>
            </>
          );
        }

      case 'ROOM_READY':
        return (
          <>
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-8 border border-primary/20 text-primary">
              <Video className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-4">Room Provisioned</h2>
            <p className="text-muted-foreground mb-10 text-center max-w-md leading-relaxed">
              Payment is secured and the professional consultation room is ready. Enter the room when you are prepared.
            </p>
            <Button 
              size="lg" 
              onClick={handleStartSession} 
              disabled={actionLoading}
              className="w-full max-w-full whitespace-normal text-center leading-tight sm:w-auto sm:min-w-[240px] shadow-sm font-bold text-base h-14"
              data-testid="button-enter-room"
            >
              {actionLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Play className="w-5 h-5 mr-3 fill-current" />}
              {isTrader ? 'Start Consultation' : 'Enter Consultation Room'}
            </Button>
          </>
        );

      case 'ACTIVE':
        return (
          <>
            <div className="relative mb-8">
              <div className="absolute -inset-4 bg-emerald-500/10 rounded-full blur-xl animate-pulse"></div>
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center relative border border-emerald-500/20 text-emerald-600">
                <Video className="w-10 h-10" />
              </div>
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-4 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-emerald-500 mr-3 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
              Consultation in Progress
            </h2>
            <p className="text-muted-foreground mb-8 text-center max-w-md leading-relaxed">
              Your professional consultation room is live. You can temporarily leave this page and rejoin whenever you need, or formally conclude it.
            </p>
            
            {session.roomName && (
               <div className="mb-10 w-full max-w-sm p-4 bg-background rounded-lg border border-border text-center shadow-sm">
                 <p className="text-[10px] text-muted-foreground mb-1.5 font-bold uppercase tracking-widest">Active Room Token</p>
                 <code className="text-base font-mono text-foreground font-semibold">{session.roomName}</code>
               </div>
            )}

             <div className="flex w-full min-w-0 flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate(`${basePath}/sessions/${id}/live`)}
                 className="w-full max-w-full whitespace-normal text-center leading-tight sm:w-auto sm:min-w-[220px] font-bold text-base h-14"
                data-testid="button-rejoin-room"
              >
                <Video className="w-5 h-5 mr-3" />
                Rejoin Room
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleCompleteSession}
                disabled={actionLoading}
                 className="w-full max-w-full whitespace-normal text-center leading-tight sm:w-auto sm:min-w-[220px] font-bold text-base h-14"
                data-testid="button-complete-session"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-3" />}
                End Consultation
              </Button>
            </div>
          </>
        );

      case 'COMPLETED':
        return (
          <>
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-8 border border-primary/20 text-primary">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-4">Consultation Completed</h2>
            <p className="text-muted-foreground mb-10 text-center max-w-md leading-relaxed">
              This professional consultation has successfully concluded. A receipt has been issued to your ledger.
            </p>

             <div className="mb-8 grid w-full max-w-xl grid-cols-1 gap-3 rounded-2xl border border-border bg-secondary/30 p-5 text-left sm:grid-cols-4">
               <div className="min-w-0"><p className="break-words text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Authorized</p><p className="mt-1 break-words font-bold">{formatCurrency(session.amountCents)}</p></div>
               <div className="min-w-0"><p className="break-words text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Final charge</p><p className="mt-1 break-words font-bold">{formatCurrency(session.finalAmountCents ?? session.amountCents)}</p></div>
               <div className="min-w-0"><p className="break-words text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Shared time</p><p className="mt-1 break-words font-bold">{Math.ceil((session.billableSeconds ?? 0) / 60)} min</p></div>
               <div className="min-w-0"><p className="break-words text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment</p><p className="mt-1 break-words font-bold">{session.paymentStatus.replaceAll('_', ' ')}</p></div>
            </div>

            {session.disputeStatus === 'OPEN' ? (
              <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700">A moderator is reviewing this session. Coach payout is frozen.</div>
            ) : (
              <Button variant="outline" onClick={handleOpenDispute} disabled={actionLoading} className="mb-8">
                Report a billing or session issue
              </Button>
            )}

            {isTrader && (
              <div className="w-full max-w-xl mb-10 text-left">
                <PostSessionFeedback
                  coachName={session.coachName || "Your Professional Coach"}
                  sessionDate={new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  market={session.topic || "Professional Consultation"}
                  defaultSubmitted={!!session.review}
                  onSubmitFeedback={async (rating, review) => {
                    await apiClient.post(`/api/sessions/${id}/reviews`, { rating, review });
                    await fetchSession();
                  }}
                />
              </div>
            )}

            {isTrader ? (
              <div className="mb-8 w-full min-w-0 max-w-6xl space-y-5 self-stretch">
                {session.learningRecord?.status === 'COMPLETE' ? (
                  <>
                    <TraderJourneyPassport session={session} />
                    <section className="mx-auto w-full max-w-xl rounded-2xl border border-primary/20 bg-primary/5 p-5 text-left" aria-labelledby="trader-reflection-title">
                      <h3 id="trader-reflection-title" className="text-sm font-bold uppercase tracking-wider text-primary">Your private reflection</h3>
                      <p className="mt-2 text-sm text-muted-foreground">Capture what you want to notice or practice next. This stays in your private passport.</p>
                      <textarea
                        value={traderReflection}
                        onChange={(event) => setTraderReflection(event.target.value)}
                        rows={4}
                        maxLength={2000}
                        placeholder="What will you look for the next time you practice this process?"
                        className="mt-4 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <Button variant="outline" className="mt-3" onClick={handleSaveTraderReflection} disabled={actionLoading || !traderReflection.trim()}>
                        {actionLoading ? 'Saving…' : 'Save private reflection'}
                      </Button>
                      <p className="mt-3 text-xs text-muted-foreground">Educational reflection only — no signals, guarantees, returns, or execution instructions.</p>
                    </section>
                  </>
                ) : (
                  <section className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-secondary/20 p-5 text-left" aria-labelledby="learning-record-pending-title">
                    <h3 id="learning-record-pending-title" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Learning passport is being prepared</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Your completed session is recorded, but the coach’s educational recap is not complete yet. It will appear here once the concepts, shared artifact, recap, and next practice step are saved.</p>
                  </section>
                )}
              </div>
            ) : (
            <section className="mb-8 w-full max-w-xl rounded-2xl border border-primary/20 bg-primary/5 p-5 text-left" aria-labelledby="learning-record-title">
              <h3 id="learning-record-title" className="text-sm font-bold uppercase tracking-wider text-primary">Trader learning passport</h3>
              <p className="mt-2 text-sm font-semibold text-foreground">Goal: {session.learningRecord?.learningGoal || session.topic || 'Learning goal not recorded'}</p>
                <div className="mt-4 space-y-3">
                  {([
                    ['conceptsReviewed', 'Concepts reviewed', 'What educational ideas or skills did you cover?'],
                    ['evidenceDiscussed', 'Evidence discussed', 'What chart context, examples, or reasoning did you review?'],
                  ['sharedArtifact', 'Shared learning artifact', 'What did you and the trader build, annotate, or agree to keep?'],
                  ['unresolvedQuestions', 'Open questions', 'What remains worth exploring? Write “None” when nothing is open.'],
                    ['practiceSteps', 'Practice plan', 'What should the trader practice next?'],
                  ] as const).map(([key, label, placeholder]) => (
                    <label key={key} className="block text-sm font-semibold">
                      {label}
                      <textarea
                        value={learningDraft[key]}
                        onChange={(event) => setLearningDraft((draft) => ({ ...draft, [key]: event.target.value }))}
                        rows={3}
                        maxLength={2000}
                        placeholder={placeholder}
                        className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                  ))}
                  <Button variant="outline" onClick={handleSaveLearningSummary} disabled={actionLoading}>
                    {actionLoading ? 'Saving…' : session.learningRecord?.status === 'COMPLETE' ? 'Update learning summary' : 'Save learning summary'}
                  </Button>
                  <p className="text-xs text-muted-foreground">Keep this educational and specific. Do not include signals, guarantees, or performance claims.</p>
                </div>
            </section>
            )}

            <Button 
              size="lg" 
              onClick={() => navigate(basePath)}
               className="w-full max-w-full whitespace-normal text-center leading-tight sm:w-auto sm:min-w-[240px] font-bold text-base h-14"
              data-testid="button-return-dashboard"
            >
              Return to Dashboard
            </Button>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <main className="min-h-[100dvh] min-w-0 bg-secondary-bg text-foreground py-8 px-4 sm:px-6 lg:px-8 flex flex-col" aria-labelledby="session-journey-title">
      <div className={`mx-auto w-full flex-1 flex flex-col ${isTrader && session.status === 'COMPLETED' ? 'max-w-7xl' : 'max-w-4xl'}`}>
        <button 
          onClick={() => navigate(basePath)}
          className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6 group self-start"
          data-testid="link-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Return to Dashboard
        </button>

        <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden flex-1 flex flex-col">
          {/* Header */}
          <div className="p-8 sm:px-12 sm:py-8 border-b border-border bg-card">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                 <h1 id="session-journey-title" className="text-2xl font-bold tracking-tight mb-1.5">Consultation Ledger</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground font-medium text-sm">
                  <span className="flex min-w-0 items-center">
                    <Clock className="w-4 h-4 mr-1.5 opacity-70" />
                    {session.durationMinutes} min allocation
                  </span>
                  <span className="w-1 h-1 rounded-full bg-border" />
                  <span className="font-semibold text-foreground">
                    {formatCurrency(session.amountCents)} fee
                  </span>
                </div>
              </div>
              <div className="flex max-w-full flex-wrap items-center gap-2 bg-secondary px-4 py-2 rounded-lg border border-border shadow-sm">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="break-words text-xs font-bold text-foreground tracking-wide uppercase">Verified Interaction</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="min-w-0 p-5 sm:p-12 flex-1 flex flex-col justify-center">
            
            {error && (
              <div className="mb-10 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center shadow-sm">
                <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                <p className="min-w-0 break-words text-sm font-semibold">{error}</p>
              </div>
            )}

            {session.paymentNextAction && session.status !== 'CANCELLED' && (
              <div className={`mb-6 rounded-xl border p-4 ${session.paypalAuthorizationExpired ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{session.paypalAuthorizationExpired ? 'Payment hold expired' : 'Payment hold expires soon'}</p>
                    <p className="mt-1 text-sm">{session.paymentNextAction}</p>
                    {session.paypalAuthorizationExpiresAt && (
                      <p className="mt-2 text-xs font-semibold">Authorization expiry: {formatEventDate(session.paypalAuthorizationExpiresAt)}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {scheduledWindow && session.status !== 'CANCELLED' && session.status !== 'COMPLETED' && (
              <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-primary">
                <div className="flex gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">Scheduled room window</p>
                    <p className="mt-1 text-sm text-foreground">
                      Your room opens {formatEventDate(scheduledWindow.opensAt)} and closes after the {session.durationMinutes}-minute lesson plus a 10-minute attendance grace period ({formatEventDate(scheduledWindow.closesAt)}).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {noShowFailureVisible && session.noShowResolutionFailure && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
              >
                <div className="flex gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">No-show settlement needs attention</p>
                    <p className="mt-1 text-sm">
                      Tradigo could not safely finish releasing or settling this scheduled session’s payment. The session remains under review while the system retries.
                    </p>
                    <p className="mt-2 text-xs font-semibold">{session.noShowResolutionFailure.nextAction}</p>
                  </div>
                </div>
              </div>
            )}

               <section
               className="mb-10 w-full max-w-3xl rounded-2xl border border-border bg-secondary/20 p-6 text-left"
                aria-labelledby="session-timeline-title"
             >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 id="session-timeline-title" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Session timeline</h2>
                 <span
                   role="status"
                   aria-live="polite"
                   aria-atomic="true"
                   aria-label={`Session status: ${statusLabel(session)}${paymentReleaseAccessible ? `. ${paymentReleaseAccessible}` : ''}`}
                   className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
                 >
                  {statusLabel(session)}
                  </span>
                </div>
                <div
                  className="sr-only"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`Session status updated: ${statusLabel(session)}.${paymentReleaseAccessible ? ` ${paymentReleaseAccessible}` : ''}`}
                >
                 Session status updated: {statusLabel(session)}.
                 {paymentReleaseAccessible ? ` ${paymentReleaseAccessible}` : ''}
                </div>
               <ol aria-label="Session events" className="space-y-4">
                {timeline.map((event, index) => (
                    <li
                      key={`${event.label}-${index}`}
                      className="flex gap-3"
                      aria-label={`${event.label}. ${formatEventDate(event.date)}. ${event.detail}`}
                    >
                     <div aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                      <p className="text-sm font-bold">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{formatEventDate(event.date)} · {event.detail}</p>
                    </div>
                   </li>
                ))}
                {paymentRelease && (
                   <li className="flex gap-3" aria-label={`${paymentRelease}. Authorized funds are not being held for this session.`}>
                     <div aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                      <div className="min-w-0">
                      <p className="text-sm font-bold">{paymentRelease}</p>
                      <p className="text-xs text-muted-foreground">Authorized funds are not being held for this session.</p>
                    </div>
                   </li>
                )}
               </ol>
              </section>

            {session.status === 'CANCELLED' ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-8 border border-border">
                  <XCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-4">Consultation Voided</h2>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                  This engagement has been formally cancelled. {paymentRelease || 'Any authorized funds have been released or voided safely.'}
                </p>
                {session.cancellationReason && (
                  <p className="mx-auto mt-5 max-w-md rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                    {session.noShowType ? `${session.noShowType} no-show: ` : ''}{session.cancellationReason}
                  </p>
                )}
                <Button 
                  onClick={() => navigate(basePath)}
                  className="mt-10 px-8 h-12 font-bold"
                  variant="outline"
                >
                  Return to Dashboard
                </Button>
              </div>
            ) : (
                <div className={`min-w-0 w-full self-stretch space-y-16 mx-auto mt-2 ${isTrader && session.status === 'COMPLETED' ? 'max-w-7xl' : 'max-w-3xl'}`}>
                  {['REQUESTED', 'COACH_CLAIMED', 'PAYMENT_READY', 'ROOM_READY'].includes(session.status) && (
                    <div className="flex flex-wrap justify-center gap-3">
                      {session.mode === 'SCHEDULED' && (
                        <Button variant="outline" onClick={handleReschedule} disabled={actionLoading}>
                          Reschedule
                        </Button>
                      )}
                      <Button variant="outline" onClick={handleCancel} disabled={actionLoading}>
                        Cancel session
                      </Button>
                      {session.mode === 'SCHEDULED' && (
                        <Button variant="ghost" onClick={handleNoShow} disabled={actionLoading}>
                          Resolve no-show
                        </Button>
                      )}
                    </div>
                  )}
                <StepProgress status={session.status} />
                
                <div className={`border border-border rounded-2xl p-5 sm:p-14 bg-card shadow-sm flex flex-col items-center relative ${isTrader && session.status === 'COMPLETED' ? 'overflow-visible' : 'overflow-hidden'}`}>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-secondary/30 pointer-events-none" />
                  
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={session.status}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="w-full min-w-0 self-stretch flex flex-col items-center relative z-10"
                    >
                      {renderStatusContent()}
                    </motion.div>
                  </AnimatePresence>
                </div>
                 {reportNotice && (
                   <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                     {reportNotice}
                   </div>
                 )}
                 {canSubmitConductReport && (
                   <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 text-left" aria-labelledby="conduct-report-title">
                     <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                       <div>
                         <h2 id="conduct-report-title" className="text-sm font-bold uppercase tracking-wider text-amber-900">Report a conduct concern</h2>
                         <p className="mt-2 max-w-2xl text-sm text-amber-900/80">
                           Share a concern about {isTrader ? (session.coachName || 'your coach') : 'the trader'} from this session. Tradigo moderators will review the report privately.
                         </p>
                       </div>
                       {!session.conductReport && !reportOpen && (
                         <Button variant="outline" onClick={() => setReportOpen(true)} disabled={actionLoading} data-testid="button-open-conduct-report">
                           Report conduct
                         </Button>
                       )}
                     </div>
                     {session.conductReport ? (
                       <p className="mt-4 rounded-lg border border-amber-200 bg-background/70 px-3 py-2 text-sm font-semibold text-amber-900">
                         Your report is {session.conductReport.status.toLowerCase()} and is available to the moderator operations queue.
                       </p>
                     ) : reportOpen ? (
                       <div className="mt-5 space-y-4">
                         <label className="block text-sm font-semibold text-foreground" htmlFor="conduct-report-reason">
                           Reason
                           <select
                             id="conduct-report-reason"
                             value={reportDraft.reason}
                             onChange={(event) => setReportDraft((draft) => ({ ...draft, reason: event.target.value }))}
                             className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/30"
                           >
                             <option value="">Choose a reason</option>
                             <option value="Harassment or abusive behavior">Harassment or abusive behavior</option>
                             <option value="Inappropriate or unsafe conduct">Inappropriate or unsafe conduct</option>
                             <option value="Boundary or policy violation">Boundary or policy violation</option>
                             <option value="Other conduct concern">Other conduct concern</option>
                           </select>
                         </label>
                         <label className="block text-sm font-semibold text-foreground" htmlFor="conduct-report-details">
                           What happened?
                           <textarea
                             id="conduct-report-details"
                             value={reportDraft.details}
                             onChange={(event) => setReportDraft((draft) => ({ ...draft, details: event.target.value }))}
                             rows={5}
                             maxLength={4000}
                             placeholder="Describe the conduct and when it happened. Please stick to specific, relevant facts."
                             className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/30"
                           />
                         </label>
                         <label className="block text-sm font-semibold text-foreground" htmlFor="conduct-report-evidence">
                           Evidence reference <span className="font-normal text-muted-foreground">(optional)</span>
                           <input
                             id="conduct-report-evidence"
                             value={reportDraft.evidenceReference}
                             onChange={(event) => setReportDraft((draft) => ({ ...draft, evidenceReference: event.target.value }))}
                             maxLength={2000}
                             placeholder="A relevant message, timestamp, or secure link"
                             className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary/30"
                           />
                         </label>
                         <div className="flex flex-wrap gap-2">
                           <Button
                             onClick={() => void handleSubmitConductReport()}
                             disabled={actionLoading || !reportDraft.reason || reportDraft.details.trim().length < 3}
                             data-testid="button-submit-conduct-report"
                           >
                             {actionLoading ? 'Submitting…' : 'Submit conduct report'}
                           </Button>
                           <Button variant="ghost" onClick={() => setReportOpen(false)} disabled={actionLoading}>
                             Cancel
                           </Button>
                         </div>
                         <p className="text-xs text-muted-foreground">Do not include passwords, payment details, or other sensitive account credentials.</p>
                       </div>
                     ) : (
                       <p className="mt-4 text-xs text-muted-foreground">This report is separate from billing disputes and session reviews.</p>
                     )}
                   </section>
                 )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
