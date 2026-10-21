import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileText, Info, MessageCircleQuestion, XCircle } from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { Button } from '../../../components/ui/Button';
import { auth } from '../../../lib/firebase';
import { trackEvent } from '../../../lib/analytics';

export type CoachApplicationStatusData = {
  id: string;
  status: string;
  attemptNumber?: number;
  isResubmission?: boolean;
  currentStep?: number;
  submittedAt?: string | null;
  decidedAt?: string | null;
  reviewerNote?: string | null;
  attemptHistory?: CoachApplicationAttemptData[];
};

type CoachApplicationClarificationData = {
  id: string;
  applicationId: string;
  status: 'SUBMITTED' | 'ANSWERED' | 'CLOSED' | string;
  message: string;
  submittedAt?: string | null;
  response?: string | null;
  respondedAt?: string | null;
  closedAt?: string | null;
};

type CoachApplicationAttemptData = {
  id: string;
  status: string;
  attemptNumber: number;
  isCurrent?: boolean;
  currentStep?: number;
  submittedAt?: string | null;
  decidedAt?: string | null;
  reviewerNote?: string | null;
  profile?: {
    headline?: string;
    bio?: string;
    teachingMethod?: string;
    coachingBoundaries?: string;
    languages?: string[];
    hourlyRateCents?: number | null;
    instantRatePerMinuteCents?: number | null;
  };
  markets?: Record<string, unknown>;
  experience?: Record<string, unknown>;
  compliance?: Record<string, unknown>;
  assessmentAttempts?: Array<{
    id: string;
    type: string;
    status: string;
    score?: number;
    maxScore?: number;
    attemptNumber?: number;
    submittedAt?: string | null;
    answers?: Array<{
      questionText?: string;
      answer?: string;
      isCorrect?: boolean;
    }>;
  }>;
  documents?: Array<{
    id: string;
    name: string;
    type?: string;
    description?: string | null;
    issuer?: string | null;
    status?: string;
    fileAvailable?: boolean;
    submittedAt?: string | null;
  }>;
  clarificationRequests?: CoachApplicationClarificationData[];
};

const statusCopy: Record<string, {
  label: string;
  title: string;
  description: string;
  nextAction: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  icon: typeof Info;
}> = {
  DRAFT: {
    label: 'Draft',
    title: 'Finish your coach application',
    description: 'Your application is saved privately, but it has not been sent to the review team yet.',
    nextAction: 'Continue the application and submit it when all evidence categories are complete.',
    tone: 'neutral',
    icon: FileText,
  },
  UNDER_REVIEW: {
    label: 'Under review',
    title: 'Your application is under review',
    description: 'The review team has your application and is checking your teaching profile, assessments, declarations, and evidence.',
    nextAction: 'No action is needed right now. Keep using Tradigo as a trader while the review is in progress.',
    tone: 'warning',
    icon: Clock3,
  },
  SUBMITTED: {
    label: 'Under review',
    title: 'Your application is under review',
    description: 'The review team has your application and is checking your teaching profile, assessments, declarations, and evidence.',
    nextAction: 'No action is needed right now. Keep using Tradigo as a trader while the review is in progress.',
    tone: 'warning',
    icon: Clock3,
  },
  PENDING: {
    label: 'Under review',
    title: 'Your application is under review',
    description: 'The review team has your application and is checking your teaching profile, assessments, declarations, and evidence.',
    nextAction: 'No action is needed right now. Keep using Tradigo as a trader while the review is in progress.',
    tone: 'warning',
    icon: Clock3,
  },
  APPROVED: {
    label: 'Approved',
    title: 'You’re approved to coach',
    description: 'Your coach profile has been approved. You can now use the coach workspace to prepare your profile and manage sessions.',
    nextAction: 'Open the coach workspace to start your coach journey.',
    tone: 'success',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Needs improvement',
    title: 'Your application needs improvement',
    description: 'The review team could not approve this application yet. You remain a trader and can continue learning and booking coaching.',
    nextAction: 'Read the reviewer feedback below, then use it to improve the areas that need more evidence before applying again.',
    tone: 'danger',
    icon: XCircle,
  },
};

const defaultStatusCopy = statusCopy.UNDER_REVIEW;

const authHeaders = async () => ({
  Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
});

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};

const toneClasses = {
  neutral: {
    icon: 'bg-primary/10 text-primary',
    badge: 'border-primary/20 bg-primary/10 text-primary',
    panel: 'border-primary/20 bg-primary/5',
  },
  success: {
    icon: 'bg-emerald-100 text-emerald-700',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    panel: 'border-emerald-200 bg-emerald-50/70',
  },
  warning: {
    icon: 'bg-amber-100 text-amber-700',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    panel: 'border-amber-200 bg-amber-50/70',
  },
  danger: {
    icon: 'bg-red-100 text-red-700',
    badge: 'border-red-200 bg-red-50 text-red-700',
    panel: 'border-red-200 bg-red-50/70',
  },
} as const;

const historyStatusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  UNDER_REVIEW: 'Under review',
  SUBMITTED: 'Under review',
  PENDING: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Needs improvement',
};

const displayValue = (value: unknown) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
};

const formatCents = (value: unknown) => {
  const cents = Number(value);
  return Number.isFinite(cents) && cents > 0 ? `$${(cents / 100).toFixed(2)}` : '';
};

const ApplicantAttemptEvidence = ({ attempt }: { attempt: CoachApplicationAttemptData }) => {
  const profile = attempt.profile ?? {};
  const markets = attempt.markets ?? {};
  const experience = attempt.experience ?? {};
  const compliance = attempt.compliance ?? {};
  const profileFields = [
    ['Headline', profile.headline],
    ['Bio', profile.bio],
    ['Teaching approach', profile.teachingMethod],
    ['Coaching boundaries', profile.coachingBoundaries],
    ['Languages', displayValue(profile.languages)],
    ['Standard rate', formatCents(profile.hourlyRateCents)],
    ['Coach Now rate', formatCents(profile.instantRatePerMinuteCents) ? `${formatCents(profile.instantRatePerMinuteCents)} / minute` : ''],
  ].filter(([, value]) => value);
  const marketFields = [
    ['Markets', displayValue(markets.markets)],
    ['Coaching specialties', displayValue(markets.coachingSpecialties)],
  ].filter(([, value]) => value);
  const experienceFields = [
    ['Years of experience', displayValue(experience.yearsExperience)],
    ['Background', displayValue(experience.background)],
  ].filter(([, value]) => value);
  const declarationCount = Object.values(compliance).filter(Boolean).length;
  const assessments = attempt.assessmentAttempts ?? [];
  const documents = attempt.documents ?? [];

  return (
    <div className="mt-4 space-y-4 border-t border-border/70 pt-4" data-testid={`coach-application-attempt-evidence-${attempt.attemptNumber}`}>
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Your submitted evidence</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[...profileFields, ...marketFields, ...experienceFields].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-secondary/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground">{value}</p>
            </div>
          ))}
          {declarationCount > 0 && (
            <div className="rounded-lg bg-secondary/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Safety declarations</p>
              <p className="mt-1 text-sm text-foreground">{declarationCount} completed</p>
            </div>
          )}
          {!profileFields.length && !marketFields.length && !experienceFields.length && declarationCount === 0 && (
            <p className="text-sm text-muted-foreground">No application details were saved for this attempt.</p>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Assessments</h4>
        {assessments.length ? (
          <div className="mt-3 space-y-2">
            {assessments.map(assessment => (
              <details key={assessment.id} className="rounded-lg border border-border/70 p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                  <span>{assessment.type === 'KNOWLEDGE' ? 'Knowledge assessment' : 'Safety assessment'}</span>
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {historyStatusLabel[assessment.status] ?? assessment.status}
                    {typeof assessment.score === 'number' && typeof assessment.maxScore === 'number' ? ` · ${assessment.score}/${assessment.maxScore}` : ''}
                  </span>
                </summary>
                {!!assessment.answers?.length && (
                  <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
                    {assessment.answers.map((answer, index) => (
                      <div key={`${assessment.id}-${index}`} className="text-sm">
                        <p className="font-medium text-foreground">{answer.questionText || 'Assessment question'}</p>
                        <p className="mt-1 text-muted-foreground">Your answer: {answer.answer || 'No answer recorded'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No assessment attempts were recorded.</p>
        )}
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Supporting evidence</h4>
        {documents.length ? (
          <ul className="mt-3 space-y-2">
            {documents.map(document => (
              <li key={document.id} className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{document.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[document.type, document.issuer, document.status].filter(Boolean).join(' · ')}
                    {document.fileAvailable ? ' · File received' : ''}
                  </p>
                  {document.description && <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No supporting documents were added.</p>
        )}
      </div>
    </div>
  );
};

const clarificationStatusCopy: Record<string, string> = {
  SUBMITTED: 'Submitted',
  ANSWERED: 'Answered',
  CLOSED: 'Closed',
};

const ApplicantClarifications = ({ attempt }: { attempt: CoachApplicationAttemptData }) => {
  const [requests, setRequests] = useState(attempt.clarificationRequests ?? []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 10) {
      setError('Please add at least 10 characters so the review team knows what to clarify.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/coaches/application/${attempt.id}/clarifications`, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmedMessage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Unable to submit your clarification request.');
      setRequests(current => [data, ...current]);
      setMessage('');
      setIsFormOpen(false);
      trackEvent('clarification_request_submitted', {
        surface: 'coach_application_status',
        application_attempt_state: attempt.status,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit your clarification request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3" aria-labelledby={`clarification-${attempt.id}`}>
      <div className="flex items-start gap-3">
        <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 id={`clarification-${attempt.id}`} className="text-xs font-bold uppercase tracking-wide text-primary">Clarification with the review team</h4>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Ask about the feedback shared for this attempt. Your request stays private to you and the review team.
          </p>
          {requests.length > 0 && (
            <div className="mt-3 space-y-2">
              {requests.map(request => (
                <div key={request.id} className="rounded-md border border-border/80 bg-background p-3" data-testid={`clarification-request-${request.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {clarificationStatusCopy[request.status] ?? 'Submitted'}
                    </span>
                    {request.submittedAt && <span className="text-xs text-muted-foreground">{formatDate(request.submittedAt) ?? 'Date unavailable'}</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground">{request.message}</p>
                  {request.status === 'ANSWERED' && request.response && (
                    <div className="mt-2 border-t border-border/70 pt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review team response</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground">{request.response}</p>
                    </div>
                  )}
                  {request.status === 'CLOSED' && (
                    <p className="mt-2 border-t border-border/70 pt-2 text-xs leading-5 text-muted-foreground">
                      This clarification request is closed. You can submit a new focused question if you still need help.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {!isFormOpen && (
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => {
                setError('');
                setIsFormOpen(true);
                trackEvent('clarification_request_opened', {
                  surface: 'coach_application_status',
                  application_attempt_state: attempt.status,
                });
              }}
            >
              Ask for clarification
            </Button>
          )}
          {isFormOpen && (
            <form className="mt-3 space-y-2" onSubmit={submitRequest}>
              <label htmlFor={`clarification-message-${attempt.id}`} className="text-xs font-semibold text-foreground">
                What would you like clarified?
              </label>
              <textarea
                id={`clarification-message-${attempt.id}`}
                value={message}
                onChange={event => setMessage(event.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="For example: Which part of my teaching sample should I expand?"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-5 text-foreground outline-none focus:ring-2 focus:ring-primary"
                disabled={saving}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit clarification'}</Button>
                <Button type="button" variant="ghost" onClick={() => { setIsFormOpen(false); setError(''); }} disabled={saving}>Cancel</Button>
              </div>
            </form>
          )}
          {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}
        </div>
      </div>
    </section>
  );
};

const ApplicantAttemptHistory = ({ attempts }: { attempts?: CoachApplicationAttemptData[] }) => {
  const earlierAttempts = (attempts ?? []).filter(attempt => !attempt.isCurrent);
  if (!earlierAttempts.length) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="coach-application-history">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 id="coach-application-history" className="text-lg font-bold text-foreground">Earlier applications</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            These are your previous attempts, including the evidence you submitted and feedback shared with you. This private history does not include moderator-only investigation details.
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {earlierAttempts.map(attempt => (
          <article key={attempt.id} className="rounded-xl border border-border/80 bg-background p-4" data-testid={`coach-application-attempt-${attempt.attemptNumber}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application attempt {attempt.attemptNumber}</p>
                <h3 className="mt-1 text-base font-bold text-foreground">{historyStatusLabel[attempt.status] ?? attempt.status}</h3>
              </div>
              <div className="text-left text-xs text-muted-foreground sm:text-right">
                {attempt.submittedAt ? <p>Submitted {formatDate(attempt.submittedAt) ?? 'date unavailable'}</p> : <p>Not submitted</p>}
                {attempt.decidedAt && <p className="mt-1">Decision recorded {formatDate(attempt.decidedAt) ?? 'date unavailable'}</p>}
              </div>
            </div>
            {attempt.reviewerNote && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50/70 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-red-900">Reviewer feedback</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-red-800">{attempt.reviewerNote}</p>
              </div>
            )}
            {attempt.status !== 'DRAFT' && <ApplicantClarifications attempt={attempt} />}
            <ApplicantAttemptEvidence attempt={attempt} />
          </article>
        ))}
      </div>
    </section>
  );
};

export const CoachApplicationStatusPanel = ({
  application,
  onReturnHome,
}: {
  application: CoachApplicationStatusData;
  onReturnHome?: () => void;
}) => {
  const navigate = useNavigate();
  const copy = statusCopy[application.status] ?? defaultStatusCopy;
  const classes = toneClasses[copy.tone];
  const StatusIcon = copy.icon;
  const submittedDate = formatDate(application.submittedAt);
  const decidedDate = formatDate(application.decidedAt);
  const isDraft = application.status === 'DRAFT';
  const isApproved = application.status === 'APPROVED';
  const isRejected = application.status === 'REJECTED';
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState('');

  useEffect(() => {
    trackEvent('coach_application_status_viewed', { status: application.status });
  }, [application.status]);

  const handlePrimaryAction = async () => {
    if (isDraft) {
      trackEvent('coach_application_continued', { source: 'status_view' });
      navigate('/coach/apply');
      return;
    }
    if (isApproved) {
      trackEvent('coach_workspace_handoff', { source: 'application_status' });
      void useAuthStore.getState().refreshProfile().finally(() => navigate('/coach'));
      return;
    }
    if (isRejected) {
      setResubmitting(true);
      setResubmitError('');
      try {
        const response = await fetch('/api/coaches/application/resubmit', {
          method: 'POST',
          headers: await authHeaders(),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || 'Unable to start a new application.');
        useAuthStore.getState().setCoachApplicationStatus(data.status);
        trackEvent('coach_application_resubmission_started', {
          source: 'application_status',
          surface: 'coach_application_status',
          application_attempt_state: application.status,
        });
        navigate('/coach/apply');
      } catch (requestError) {
        setResubmitError(requestError instanceof Error ? requestError.message : 'Unable to start a new application.');
      } finally {
        setResubmitting(false);
      }
      return;
    }
    onReturnHome?.();
    if (!onReturnHome) navigate('/app');
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8" data-testid="coach-application-status-view">
      <div className="mx-auto w-full max-w-3xl space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <div className="text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${classes.icon}`}>
            <StatusIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className={`mx-auto mt-5 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${classes.badge}`} data-testid="status-coach-application">
            {copy.label}
          </div>
          <h1 className="mt-3 text-2xl font-bold text-foreground" data-testid="text-coach-application-title">{copy.title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>

        <section className={`rounded-xl border p-4 ${classes.panel}`} aria-labelledby="coach-application-next-action">
          <div className="flex items-start gap-3">
            <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
            <div>
              <h2 id="coach-application-next-action" className="text-sm font-bold text-foreground">Your next step</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground" data-testid="text-coach-application-next-action">{copy.nextAction}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application status</p>
            <p className="mt-2 font-bold text-foreground">{copy.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isDraft
                ? `Saved at step ${Math.min(7, Math.max(1, Number(application.currentStep) || 1))} of 7`
                : submittedDate
                  ? `Submitted ${submittedDate}`
                  : 'Submission date unavailable'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What happens next</p>
            <p className="mt-2 text-sm leading-5 text-foreground">
              {isDraft && 'Complete the remaining steps, then send your application for review.'}
              {isApproved && 'Your coach workspace is ready whenever you are.'}
              {isRejected && 'Your trader account stays active while you work on the feedback.'}
              {!isDraft && !isApproved && !isRejected && 'We will update this page when the review team makes a decision.'}
            </p>
            {decidedDate && <p className="mt-1 text-xs text-muted-foreground">Decision recorded {decidedDate}</p>}
          </div>
        </div>

        {isRejected && (
          <section className="rounded-xl border border-red-200 bg-red-50/70 p-4" aria-labelledby="coach-application-feedback">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
              <div>
                <h2 id="coach-application-feedback" className="text-sm font-bold text-red-900">Reviewer feedback</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-red-800" data-testid="text-coach-application-feedback">
                  {application.reviewerNote || 'No written feedback was included. Review each evidence category and make sure your teaching scope, experience, assessments, declarations, and supporting evidence are complete.'}
                </p>
                <p className="mt-3 text-xs leading-5 text-red-800">Your previous application and its evidence stay on record. A new application will give the review team a separate attempt to assess your improvements.</p>
              </div>
            </div>
          </section>
        )}

        {resubmitError && <p className="text-sm text-destructive" role="alert">{resubmitError}</p>}

        <ApplicantAttemptHistory attempts={application.attemptHistory} />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          {!isApproved && (
            <Button variant="outline" onClick={() => onReturnHome ? onReturnHome() : navigate('/app')} data-testid="button-return-to-trader-dashboard">
              Return to trader dashboard
            </Button>
          )}
          <Button onClick={handlePrimaryAction} disabled={resubmitting} data-testid={`button-coach-application-${isDraft ? 'continue' : isApproved ? 'open-coach' : isRejected ? 'resubmit' : 'return'}`}>
            {isDraft ? 'Continue application' : isApproved ? 'Open coach workspace' : isRejected ? resubmitting ? 'Starting…' : 'Start a new application' : 'Return to Tradigo'}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const CoachApplicationStatus = () => {
  const { canonicalUser, setCoachApplicationStatus } = useAuthStore();
  const [application, setApplication] = useState<CoachApplicationStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/coaches/application/status', { headers: await authHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || 'Unable to load your application status.');
        if (active) {
          setApplication(data);
          setCoachApplicationStatus(data.status);
        }
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load your application status.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadStatus();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground" data-testid="status-coach-application-loading">Loading your application status…</div>;
  if (error) return <div className="p-8 text-center text-sm text-destructive" role="alert" data-testid="status-coach-application-error">{error}</div>;
  if (!canonicalUser || !application) return null;

  return <CoachApplicationStatusPanel application={application} />;
};