import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, Clock3, Compass, FileText, Loader2, Search, Video } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../lib/apiClient';

type DashboardSession = {
  id: string;
  status: string;
  mode: string;
  scheduledAt?: string | null;
  durationMinutes?: number;
  topic?: string | null;
  learningGoal?: string | null;
  learningStatus?: string | null;
  practiceSteps?: string | null;
};

type DashboardPassportRecord = {
  id: string;
  sessionId?: string | null;
  status?: string | null;
  learningGoal?: string | null;
  topic?: string | null;
  practiceSteps?: string | null;
};

type MatchState = {
  request?: {
    status: string;
    instrument?: string;
    specialty?: string;
  } | null;
  coachInfo?: {
    display_name?: string;
    headline?: string;
  } | null;
  session?: {
    id: string;
    status?: string;
    state?: string;
  } | null;
};

const ACTIVE_SESSION_STATUSES = ['REQUESTED', 'MATCHING', 'MATCHED', 'COACH_CLAIMED', 'PAYMENT_READY', 'PAYMENT_AUTHORIZED', 'ROOM_READY', 'ACTIVE'];

const formatSessionDate = (value?: string | null) => {
  if (!value) return 'Next available slot';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Scheduled session' : date.toLocaleString();
};

const sessionTitle = (session: Pick<DashboardSession, 'topic' | 'learningGoal' | 'mode'>) =>
  session.topic || session.learningGoal || (session.mode === 'SCHEDULED' ? 'Scheduled coaching session' : 'Coach Now session');

export const TraderDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const traderBase = location.pathname.startsWith('/preview') ? '/preview' : '/app';
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [passport, setPassport] = useState<DashboardPassportRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      const [matchResult, sessionsResult, passportResult] = await Promise.allSettled([
        apiClient.get('/api/coach-now/requests/current'),
        apiClient.get('/api/sessions'),
        apiClient.get('/api/learning/passport'),
      ]);

      if (!active) return;

      if (matchResult.status === 'fulfilled') {
        setMatchState(matchResult.value);
      }

      if (sessionsResult.status === 'fulfilled') {
        setSessions(sessionsResult.value.items ?? []);
      } else {
        setSessionError('We could not load your session history. Try refreshing or open Sessions & Passport to see the full record.');
      }

      if (passportResult.status === 'fulfilled') {
        setPassport(passportResult.value.records ?? []);
      }

      setSessionsLoading(false);
    };

    void loadDashboardData();
    return () => {
      active = false;
    };
  }, []);

  const activeSessions = useMemo(
    () => sessions.filter((session) => ACTIVE_SESSION_STATUSES.includes(session.status)),
    [sessions],
  );
  const completedSessions = useMemo(
    () => sessions.filter((session) => session.status === 'COMPLETED' || session.status === 'SETTLED'),
    [sessions],
  );
  const nextSession = useMemo(
    () => [...activeSessions].sort((a, b) => {
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    })[0],
    [activeSessions],
  );
  const practiceSessions = useMemo(() => {
    const passportPractice = passport
      .filter((record) => Boolean(record.practiceSteps) && record.status !== 'COMPLETE')
      .map((record) => ({
        id: record.sessionId || record.id,
        practiceSteps: record.practiceSteps,
        topic: record.topic,
        learningGoal: record.learningGoal,
        mode: 'PASSPORT',
      }));
    const sessionPractice = sessions.filter((session) => Boolean(session.practiceSteps) && session.learningStatus !== 'COMPLETE');
    return [...passportPractice, ...sessionPractice];
  }, [passport, sessions]);
  const recentSessions = useMemo(
    () => sessions
      .filter((session) => session.status === 'COMPLETED' || session.status === 'SETTLED')
      .slice(0, 3),
    [sessions],
  );

  const cancelSearch = async () => {
    try {
      await apiClient.post('/api/coach-now/requests/current/cancel');
      setMatchState(null);
    } catch {
      setSessionError('We could not cancel the Coach Now search. Please try again.');
    }
  };

  const renderMatchHandoff = () => {
    if (!matchState?.request) return null;

    if (matchState.request.status === 'REQUESTED' || matchState.request.status === 'MATCHING') {
      return (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm" aria-labelledby="active-match-title">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              </div>
              <div>
                <h2 id="active-match-title" className="text-lg font-bold">Searching for your coach</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Finding a teaching fit for {matchState.request.instrument || 'your market'}.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={cancelSearch}>Cancel search</Button>
          </div>
        </section>
      );
    }

    if (matchState.request.status === 'OFFERING') {
      return (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm" aria-labelledby="active-match-title">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 id="active-match-title" className="text-lg font-bold">A coach is ready to review your request</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {matchState.coachInfo?.display_name || 'Your matched coach'} is deciding whether this learning session is a fit.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={cancelSearch}>Cancel search</Button>
          </div>
        </section>
      );
    }

    if (matchState.request.status === 'ACCEPTED' && matchState.session) {
      return (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm" aria-labelledby="active-match-title">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Video className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 id="active-match-title" className="text-lg font-bold text-emerald-900">Your coach accepted</h2>
                <p className="mt-1 text-sm text-emerald-800">Open the session handoff to complete the next step.</p>
              </div>
            </div>
             <Button onClick={() => navigate(`${traderBase}/sessions/${matchState.session?.id}`)}>Open session <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </section>
      );
    }

    if (matchState.session) {
      const isLive = matchState.session.status === 'ACTIVE';
      return (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm" aria-labelledby="active-match-title">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Video className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 id="active-match-title" className="text-lg font-bold">{isLive ? 'Your session is live' : 'Your coaching session is ready'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isLive ? 'Return to the room whenever you are ready.' : 'Open the session handoff to see the next step.'}
                </p>
              </div>
            </div>
             <Button onClick={() => navigate(isLive ? `${traderBase}/sessions/${matchState.session?.id}/live` : `${traderBase}/sessions/${matchState.session?.id}`)}>
              {isLive ? 'Rejoin session' : 'Open session'} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm md:flex-row md:items-end md:justify-between md:p-8">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Trader dashboard</p>
          <h1 className="mt-2 break-words text-3xl font-black tracking-tight sm:text-4xl">Keep your learning moving.</h1>
          <p className="mt-3 break-words max-w-2xl text-sm leading-6 text-muted-foreground">
            See what is next in your coaching journey, return to open practice, and pick up a conversation when you are ready.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <Link to={`${traderBase}/coaches`}>
            <Button variant="outline" className="w-full min-w-0 whitespace-normal sm:w-auto"><Search className="mr-2 h-4 w-4" /> Find a coach</Button>
          </Link>
          <Link to={`${traderBase}/coach-now`}>
            <Button className="w-full min-w-0 whitespace-normal sm:w-auto"><Compass className="mr-2 h-4 w-4" /> Coach Now</Button>
          </Link>
        </div>
      </header>

      {renderMatchHandoff()}

      {!matchState?.request && (
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-sm md:p-8" aria-labelledby="learning-overview-title">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <BookOpen className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="learning-overview-title" className="break-words text-xl font-bold">Your learning workspace</h2>
                <p className="mt-2 break-words max-w-xl text-sm leading-6 text-muted-foreground">
                  Start with a coaching conversation, then keep the useful parts: a recap, a practice step, and a private record of your progress.
                </p>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:shrink-0">
              <Link className="min-w-0" to={`${traderBase}/sessions`}>
                <Button variant="outline" className="w-full min-w-0 whitespace-normal sm:w-auto">Review sessions <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
              <Link className="min-w-0" to={`${traderBase}/coaches`}>
                <Button className="w-full min-w-0 whitespace-normal sm:w-auto">Choose your next coach <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {sessionError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{sessionError}</div>
      )}

      <section aria-label="Learning summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Sessions completed', value: sessionsLoading ? '—' : completedSessions.length, detail: 'Your completed learning conversations', icon: CheckCircle2 },
          { label: 'Open sessions', value: sessionsLoading ? '—' : activeSessions.length, detail: 'Rooms and handoffs needing attention', icon: Video },
          { label: 'Practice to revisit', value: sessionsLoading ? '—' : practiceSessions.length, detail: 'Next steps left by your coaches', icon: FileText },
        ].map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm" aria-labelledby="next-learning-step-title">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Next in your journey</p>
              <h2 id="next-learning-step-title" className="mt-1 text-xl font-bold">Keep the thread going</h2>
            </div>
            <CalendarClock className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          {nextSession ? (
            <Link to={`/app/sessions/${nextSession.id}`} className="mt-5 block rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:border-primary/40">
              <p className="font-bold">{sessionTitle(nextSession)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{formatSessionDate(nextSession.scheduledAt)}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">Open session <ArrowRight className="h-4 w-4" /></span>
            </Link>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-border bg-secondary/20 p-5">
              <p className="text-sm text-muted-foreground">No open session yet. Choose a coach or start Coach Now when you have a learning question.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to={`${traderBase}/coaches`} className="text-sm font-bold text-primary hover:underline">Find a coach</Link>
                <Link to={`${traderBase}/coach-now`} className="text-sm font-bold text-primary hover:underline">Start Coach Now</Link>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm" aria-labelledby="practice-title">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Practice step</p>
              <h2 id="practice-title" className="mt-1 text-xl font-bold">What to revisit</h2>
            </div>
            <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          {practiceSessions.length > 0 ? (
            <Link to={`/app/sessions/${practiceSessions[0].id}`} className="mt-5 block rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:border-primary/40">
              <p className="font-bold">{practiceSessions[0].practiceSteps}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">From {sessionTitle(practiceSessions[0])}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">Open learning record <ArrowRight className="h-4 w-4" /></span>
            </Link>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-border bg-secondary/20 p-5">
              <p className="text-sm text-muted-foreground">Your next practice step will appear here after a coach adds one to your learning record.</p>
              <Link to={`${traderBase}/learning`} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">Open Learning Hub <ArrowRight className="h-4 w-4" /></Link>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm" aria-labelledby="recent-learning-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Learning record</p>
            <h2 id="recent-learning-title" className="mt-1 text-xl font-bold">Recent sessions</h2>
          </div>
          <Link to={`${traderBase}/sessions`} className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">View all sessions <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {recentSessions.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {recentSessions.map((session) => (
              <Link key={session.id} to={`/app/sessions/${session.id}`} className="rounded-xl border border-border bg-secondary/30 p-4 transition-colors hover:border-primary/40">
                <p className="font-bold">{sessionTitle(session)}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatSessionDate(session.scheduledAt)}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">
                  <BookOpen className="h-4 w-4" aria-hidden="true" /> Open passport
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center">
            <Clock3 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 break-words text-sm font-semibold">Your completed learning record will appear here.</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">When a session ends, its recap and private Passport entry stay available from Sessions & Passport.</p>
          </div>
        )}
      </section>
    </div>
  );
};