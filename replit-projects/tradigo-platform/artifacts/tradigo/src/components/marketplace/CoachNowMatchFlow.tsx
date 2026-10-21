import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Globe2,
  Layers3,
  MapPin,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { CoachMarketplaceDTO } from '../../types';
import { apiClient } from '../../lib/apiClient';
import './CoachNowMatchFlow.css';

type MatchMode = 'FAST' | 'CHOOSE';
type MatchVisualState =
  | 'idle'
  | 'finding'
  | 'contacting'
  | 'expanding'
  | 'found'
  | 'no-live-match'
  | 'cancelled'
  | 'error';

interface CoachNowMatchResponse {
  matchGroupId?: string;
  id?: string;
  state?: string;
  status?: string;
  sessionId?: string;
  session?: { id?: string; sessionId?: string };
  coach?: CoachMarketplaceDTO;
  matchedCoach?: CoachMarketplaceDTO;
  match?: { coach?: CoachMarketplaceDTO; sessionId?: string };
  acceptedSessionId?: string | null;
  claimedSessionId?: string | null;
  claimExpiresAt?: string | null;
  claimExpired?: boolean;
  rematchAttempts?: number;
  maxRematchAttempts?: number;
  rematchAvailable?: boolean;
  items?: Array<{ state?: string; sessionId?: string; session?: { id?: string }; coach?: CoachMarketplaceDTO }>;
  candidates?: Array<{ sessionId?: string | null; coach?: CoachMarketplaceDTO; reasonCodes?: string[] }>;
  fallback?: { nextAction?: string; message?: string };
  message?: string;
}

export interface CoachNowMatchFlowProps {
  coaches: CoachMarketplaceDTO[];
  onNavigateToScheduled: () => void;
  onSessionReady: (sessionId: string) => void;
  preselectedCoachId?: string;
}

interface MatchForm {
  instrumentClass: string;
  symbol: string;
  topic: string;
  language: string;
  experienceLevel: string;
  durationMinutes: 10 | 25 | 50;
  maxRateCents: number;
  learningGoal: string;
  agenda: string;
}

const initialForm: MatchForm = {
  instrumentClass: 'FOREX',
  symbol: 'EURUSD',
  topic: 'MARKET_STRUCTURE',
  language: 'English',
  experienceLevel: 'INTERMEDIATE',
  durationMinutes: 25,
  maxRateCents: 300,
  learningGoal: '',
  agenda: '',
};

const learningIntentOptions = [
  ['PROCESS_REVIEW', 'Review a process I already use'],
  ['BUILD_FRAMEWORK', 'Build a repeatable learning framework'],
  ['UNDERSTAND_CONCEPT', 'Understand a market concept'],
  ['REFLECT_ON_DECISION', 'Reflect on a recent decision'],
  ['PRACTICE_SKILL', 'Practice one skill with feedback'],
  ['CUSTOM', 'Write my own intent'],
] as const;

const stateLabels: Record<MatchVisualState, string> = {
  idle: 'Ready to open a live route',
  finding: 'Reading the live coach network',
  contacting: 'Contacting coaches who fit your route',
  expanding: 'Expanding the search across time zones',
  found: 'A live coach is ready',
  'no-live-match': 'No live coach found right now',
  cancelled: 'Live search cancelled',
  error: 'The live route needs another try',
};

const stateCopy: Record<MatchVisualState, string> = {
  idle: 'Set a topic and open a low-friction learning route.',
  finding: 'Checking availability, teaching fit, and your rate cap.',
  contacting: 'A few nearby signals are being sent. No one is charged yet.',
  expanding: 'The first route was quiet. We are widening the atlas now.',
  found: 'Review your coach before authorizing payment and opening the shared room.',
  'no-live-match': 'No approved coach is live for this route at the moment.',
  cancelled: 'Nothing was charged. You can try again or choose a time.',
  error: 'We could not keep the live route open. Your authorization was not used.',
};

const terminalStatuses = new Set([
  'NO_COACH_FOUND',
  'EXPIRED',
  'CANCELLED',
  'TRADER_CANCELLED',
  'COACH_CANCELLED',
]);

function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function responseSessionId(response: CoachNowMatchResponse) {
  return response.acceptedSessionId
    || response.claimedSessionId
    || response.sessionId
    || response.session?.id
    || response.session?.sessionId
    || response.match?.sessionId
    || response.items?.find((item) => item.state === 'ACCEPTED' || item.state === 'CLAIMED')?.sessionId
    || response.items?.find((item) => item.state === 'ACCEPTED' || item.state === 'CLAIMED')?.session?.id;
}

function responseCoach(response: CoachNowMatchResponse) {
  return response.coach
    || response.matchedCoach
    || response.match?.coach
    || response.items?.find((item) => item.state === 'ACCEPTED' || item.state === 'CLAIMED')?.coach;
}

function visualStateFromStatus(status?: string): MatchVisualState {
  const normalized = status?.toUpperCase();
  if (!normalized) return 'finding';
  if (['FOUND', 'COACH_CLAIMED', 'CLAIMED', 'MATCHED', 'ACCEPTED', 'PAYMENT_READY', 'PAYMENT_AUTHORIZED', 'ROOM_READY', 'ACTIVE'].includes(normalized)) {
    return 'found';
  }
  if (['NO_COACH_FOUND', 'NO_LIVE_MATCH', 'EXPIRED'].includes(normalized)) return 'no-live-match';
  if (['FOUND', 'SEARCHING'].includes(normalized)) return normalized === 'FOUND' ? 'found' : 'contacting';
  if (['CANCELLED', 'TRADER_CANCELLED', 'COACH_CANCELLED'].includes(normalized)) return 'cancelled';
  if (['CONTACTING', 'COACH_CONTACTING'].includes(normalized)) return 'contacting';
  if (['EXPANDING', 'SEARCH_EXPANDED'].includes(normalized)) return 'expanding';
  return 'finding';
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function isLive(coach: CoachMarketplaceDTO) {
  return coach.availability === 'AVAILABLE';
}

function labelReasonCode(code: string) {
  return code.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (value) => value.toUpperCase());
}

export function CoachNowMatchFlow({
  coaches,
  onNavigateToScheduled,
  onSessionReady,
  preselectedCoachId,
}: CoachNowMatchFlowProps) {
  const [mode, setMode] = useState<MatchMode>('FAST');
  const [form, setForm] = useState<MatchForm>(initialForm);
  const [learningIntentPreset, setLearningIntentPreset] = useState('CUSTOM');
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([]);
  const [visualState, setVisualState] = useState<MatchVisualState>('idle');
  const [matchGroupId, setMatchGroupId] = useState<string | null>(null);
  const [matchedCoach, setMatchedCoach] = useState<CoachMarketplaceDTO | null>(null);
  const [matchReasonCodes, setMatchReasonCodes] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availabilityRequested, setAvailabilityRequested] = useState(false);
  const [claimExpiresAt, setClaimExpiresAt] = useState<string | null>(null);
  const [claimSecondsRemaining, setClaimSecondsRemaining] = useState(0);
  const notifiedSessionId = useRef<string | null>(null);
  const expansionRequested = useRef(false);
  const matchStartedAt = useRef<number | null>(null);
  const autoRematchRequested = useRef(false);
  const beginMatchRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const selectedCoaches = useMemo(
    () => selectedCoachIds.map((id) => coaches.find((coach) => coach.id === id)).filter(Boolean) as CoachMarketplaceDTO[],
    [coaches, selectedCoachIds],
  );

  const visibleCoaches = useMemo(
    () => coaches.filter((coach) => coach.approved !== false).slice(0, 9),
    [coaches],
  );

  useEffect(() => {
    if (preselectedCoachId && coaches.some((coach) => coach.id === preselectedCoachId)) {
      setMode('CHOOSE');
      setSelectedCoachIds([preselectedCoachId]);
    }
  }, [coaches, preselectedCoachId]);

  const handleIncomingMatch = useCallback(
    (response: CoachNowMatchResponse) => {
      const nextState = visualStateFromStatus(response.status || response.state);
      const coach = responseCoach(response);
      if (coach) setMatchedCoach(coach);
      const sessionId = responseSessionId(response);
      const candidate = response.candidates?.find((item) => item.sessionId === sessionId)
        || response.candidates?.find((item) => item.coach?.id === coach?.id);
      if (candidate?.reasonCodes) setMatchReasonCodes(candidate.reasonCodes);
      setClaimExpiresAt(response.claimExpiresAt || null);
      setVisualState(nextState);
      const status = (response.status || response.state || '').toUpperCase();
      const paymentReady = ['PAYMENT_READY', 'ROOM_READY', 'ACTIVE', 'PAYMENT_AUTHORIZED'].includes(status);
      if (nextState === 'found' && paymentReady && sessionId && notifiedSessionId.current !== sessionId) {
        notifiedSessionId.current = sessionId;
        onSessionReady(sessionId);
      }
      return nextState;
    },
    [onSessionReady],
  );

  useEffect(() => {
    if (!matchGroupId) return undefined;

    let active = true;
    let intervalId: number | undefined;
    const poll = async () => {
      try {
        const response = (await apiClient.get(`/api/coach-now/match/${matchGroupId}`)) as CoachNowMatchResponse;
        if (!active) return;
        const nextState = handleIncomingMatch(response);
        const status = response.status?.toUpperCase() || response.state?.toUpperCase() || '';
        const foundWithSession = nextState === 'found'
          && ['PAYMENT_READY', 'ROOM_READY', 'ACTIVE', 'PAYMENT_AUTHORIZED'].includes(status)
          && Boolean(responseSessionId(response));
        if ((terminalStatuses.has(status) || foundWithSession) && intervalId) {
          window.clearInterval(intervalId);
        }
        if (response.claimExpired && !autoRematchRequested.current) {
          autoRematchRequested.current = true;
          if (response.rematchAvailable === false) {
            setErrorMessage(response.fallback?.message || 'The live search limit was reached. Choose a scheduled session or request an availability alert.');
            setVisualState('no-live-match');
            if (intervalId) window.clearInterval(intervalId);
            return;
          }
          setErrorMessage('The coach claim expired before confirmation. Looking for another eligible coach…');
          setVisualState('contacting');
          try {
            const rematched = (await apiClient.post(`/api/coach-now/match/${matchGroupId}/rematch`)) as CoachNowMatchResponse;
            if (!active) return;
            const rematchedState = handleIncomingMatch(rematched);
            if (rematched.rematchAvailable === false && rematchedState === 'no-live-match') {
              setErrorMessage(rematched.fallback?.message || 'No other eligible coach is available right now. Choose a scheduled session or request an availability alert.');
              if (intervalId) window.clearInterval(intervalId);
            } else {
              setErrorMessage(null);
              autoRematchRequested.current = false;
              expansionRequested.current = false;
              matchStartedAt.current = Date.now();
            }
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'We could not search for another eligible coach.');
            setVisualState('error');
            if (intervalId) window.clearInterval(intervalId);
          }
          return;
        }
        if (
          nextState === 'contacting'
          && matchStartedAt.current
          && Date.now() - matchStartedAt.current >= 10_000
          && !expansionRequested.current
        ) {
          expansionRequested.current = true;
          setVisualState('expanding');
          try {
            const expanded = (await apiClient.post(`/api/coach-now/match/${matchGroupId}/expand`)) as CoachNowMatchResponse;
            if (!active) return;
            handleIncomingMatch(expanded);
          } catch {
            // The original invitations remain active if expansion is unavailable.
          }
        }
        if (foundWithSession) {
          setMatchGroupId(null);
        }
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : 'The match status could not be read.');
        setVisualState('error');
        if (intervalId) window.clearInterval(intervalId);
      }
    };

    void poll();
    intervalId = window.setInterval(poll, 3000);
    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [handleIncomingMatch, matchGroupId]);

  useEffect(() => {
    if (!claimExpiresAt) {
      setClaimSecondsRemaining(0);
      return undefined;
    }
    const update = () => {
      setClaimSecondsRemaining(Math.max(0, Math.ceil((new Date(claimExpiresAt).getTime() - Date.now()) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [claimExpiresAt]);

  const updateForm = <K extends keyof MatchForm>(key: K, value: MatchForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleCoach = (coachId: string) => {
    setSelectedCoachIds((current) => {
      if (current.includes(coachId)) return current.filter((id) => id !== coachId);
      if (current.length >= 3) return current;
      return [...current, coachId];
    });
  };

  const resetFlow = () => {
    setVisualState('idle');
    setErrorMessage(null);
    setMatchedCoach(null);
    setMatchReasonCodes([]);
    setMatchGroupId(null);
    setAvailabilityRequested(false);
    setClaimExpiresAt(null);
    setClaimSecondsRemaining(0);
    notifiedSessionId.current = null;
    expansionRequested.current = false;
    matchStartedAt.current = null;
    autoRematchRequested.current = false;
  };

  const beginMatch = async () => {
    if (!form.learningGoal.trim()) {
      setErrorMessage('Choose or write one learning intent before opening the route.');
      setVisualState('error');
      return;
    }
    if (mode === 'CHOOSE' && selectedCoachIds.length === 0) {
      setErrorMessage('Choose at least one live coach, or switch back to Fast Match.');
      setVisualState('error');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setMatchedCoach(null);
    setClaimExpiresAt(null);
    setClaimSecondsRemaining(0);
    setVisualState('finding');
    notifiedSessionId.current = null;
    expansionRequested.current = false;
    matchStartedAt.current = Date.now();

    const requestBody = {
      mode,
      instrumentClass: form.instrumentClass,
      symbol: form.symbol.trim().toUpperCase(),
      topic: form.topic,
      language: form.language,
      experienceLevel: form.experienceLevel,
      durationMinutes: form.durationMinutes,
      maxRateCents: form.maxRateCents,
      learningGoal: form.learningGoal.trim(),
        agenda: form.agenda.trim() || form.learningGoal.trim() || 'Review my current process and the questions I want to explore.',
      ...(mode === 'CHOOSE' ? { coachIds: selectedCoachIds } : {}),
    };

    try {
      const response = (await apiClient.post('/api/coach-now/match', requestBody)) as CoachNowMatchResponse;
      const returnedGroupId = response.matchGroupId || response.id;
      const nextState = handleIncomingMatch(response);
      setIsSubmitting(false);
      if (nextState === 'no-live-match') {
        setErrorMessage(response.fallback?.message || null);
        return;
      }
      if (nextState === 'found' && responseSessionId(response) && ['PAYMENT_READY', 'ROOM_READY', 'ACTIVE'].includes((response.status || response.state || '').toUpperCase())) return;
      if (!returnedGroupId) {
        setErrorMessage('The live route returned without a tracking reference.');
        setVisualState('error');
        return;
      }
      setMatchGroupId(returnedGroupId);
    } catch (error) {
      setIsSubmitting(false);
      setVisualState('error');
      setErrorMessage(error instanceof Error ? error.message : 'The live route could not be opened.');
    }
  };

  beginMatchRef.current = beginMatch;

  const confirmCoach = async () => {
    if (!matchGroupId) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = (await apiClient.post(`/api/coach-now/match/${matchGroupId}/confirm`)) as CoachNowMatchResponse;
      handleIncomingMatch(response);
      const sessionId = responseSessionId(response);
      if (sessionId) {
        setMatchGroupId(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'This coach could not be confirmed.');
      setVisualState('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const declineAndRematch = async () => {
    if (!matchGroupId) {
      resetFlow();
      void beginMatchRef.current();
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiClient.post(`/api/coach-now/match/${matchGroupId}/decline`);
      resetFlow();
      void beginMatchRef.current();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not release this coach claim.');
      setVisualState('error');
      setIsSubmitting(false);
    }
  };

  const cancelMatch = async () => {
    if (!matchGroupId) {
      resetFlow();
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/coach-now/match/${matchGroupId}/cancel`);
      setMatchGroupId(null);
      setVisualState('cancelled');
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The live route could not be cancelled.');
      setVisualState('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestAvailability = async () => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/api/coach-now/availability-alert', {
        instrumentClass: form.instrumentClass,
        topic: form.topic,
        language: form.language,
        maxRateCents: form.maxRateCents,
      });
      setAvailabilityRequested(true);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The availability request could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const capCents = form.durationMinutes * form.maxRateCents;
  const showAtlas = visualState !== 'idle' || isSubmitting;
  const canStart = !isSubmitting && visualState !== 'finding' && visualState !== 'contacting' && visualState !== 'expanding' && visualState !== 'found';

  return (
    <section className="coach-now-shell" aria-labelledby="coach-now-title">
      <div className="coach-now-intro">
        <div className="coach-now-eyebrow">
          <span className="coach-now-eyebrow-dot" aria-hidden="true" />
          LIVE POINT / COACH NOW
        </div>
        <div className="coach-now-heading-row">
          <div>
            <h1 id="coach-now-title">Find your next signal.</h1>
            <p>
              A calm, human route to an approved coach who is ready to think with you now.
              Education only. No trade signals or financial advice.
            </p>
          </div>
          <div className="coach-now-route-stamp" aria-label="Coach Now is currently open">
            <Radio size={15} aria-hidden="true" />
            <span>Route open</span>
          </div>
        </div>
      </div>

      <div className="coach-now-grid">
        <div className="coach-now-form-panel">
          <div className="coach-now-mode-switch" role="tablist" aria-label="Coach Now matching mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'FAST'}
              className={mode === 'FAST' ? 'is-active' : ''}
              onClick={() => setMode('FAST')}
              data-testid="button-coach-now-fast-match"
            >
              <Zap size={16} aria-hidden="true" />
              <span>Fast Match</span>
              <small>best fit, fastest route</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'CHOOSE'}
              className={mode === 'CHOOSE' ? 'is-active' : ''}
              onClick={() => setMode('CHOOSE')}
              data-testid="button-coach-now-choose-coaches"
            >
              <Users size={16} aria-hidden="true" />
              <span>Choose coaches</span>
              <small>up to 3 invitations</small>
            </button>
          </div>

          {mode === 'CHOOSE' && (
            <div className="coach-now-picker" aria-label="Choose up to three coaches">
              <div className="coach-now-picker-header">
                <div>
                  <p className="coach-now-field-kicker">TRADE ROUTES</p>
                  <h2>Who should receive the route?</h2>
                </div>
                <span className="coach-now-count" data-testid="text-selected-coach-count">
                  {selectedCoachIds.length}/3 selected
                </span>
              </div>
              <div className="coach-now-coach-list">
                {visibleCoaches.length > 0 ? visibleCoaches.map((coach) => {
                  const selected = selectedCoachIds.includes(coach.id);
                  return (
                    <button
                      type="button"
                      key={coach.id}
                      className={`coach-now-coach-row ${selected ? 'is-selected' : ''}`}
                      onClick={() => toggleCoach(coach.id)}
                      disabled={!selected && selectedCoachIds.length >= 3}
                      aria-pressed={selected}
                      data-testid={`button-select-coach-${coach.id}`}
                    >
                      <span className="coach-now-avatar" aria-hidden="true">
                        {coach.avatarUrl ? <img src={coach.avatarUrl} alt="" /> : initials(coach.displayName)}
                      </span>
                      <span className="coach-now-coach-copy">
                        <strong>{coach.displayName}</strong>
                        <span>{coach.headline}</span>
                      </span>
                      <span className={`coach-now-presence ${isLive(coach) ? 'is-live' : ''}`}>
                        <span aria-hidden="true" />
                        {isLive(coach) ? 'Live' : 'Away'}
                      </span>
                      <span className="coach-now-check" aria-hidden="true">
                        {selected ? <Check size={14} /> : null}
                      </span>
                    </button>
                  );
                }) : (
                  <p className="coach-now-picker-empty">Approved coach routes will appear here when the marketplace is online.</p>
                )}
              </div>
              {selectedCoaches.length > 0 && (
                <p className="coach-now-selected-note" role="status">
                  {selectedCoaches.map((coach) => coach.displayName).join(', ')} will receive your invitation.
                </p>
              )}
            </div>
          )}

          <div className="coach-now-form">
            <div className="coach-now-form-heading">
              <div>
                <p className="coach-now-field-kicker">LEARNING ATLAS</p>
                <h2>Give the route a bearing</h2>
              </div>
              <CircleHelp size={17} aria-label="These details are used to find an educational fit." />
            </div>

            <div className="coach-now-fields coach-now-fields--two">
              <label>
                <span>Instrument class</span>
                <select
                  value={form.instrumentClass}
                  onChange={(event) => updateForm('instrumentClass', event.target.value)}
                  data-testid="select-coach-now-instrument-class"
                >
                  <option value="EQUITIES">Equities</option>
                  <option value="INDICES">Indices</option>
                  <option value="FOREX">Forex</option>
                  <option value="CRYPTO">Crypto</option>
                  <option value="COMMODITIES">Commodities</option>
                </select>
                <ChevronDown className="coach-now-select-icon" size={15} aria-hidden="true" />
              </label>
              <label>
                <span>Symbol or market</span>
                <span className="coach-now-input-prefix">/</span>
                <input
                  value={form.symbol}
                  onChange={(event) => updateForm('symbol', event.target.value)}
                  placeholder="SPY"
                  maxLength={12}
                  data-testid="input-coach-now-symbol"
                />
              </label>
            </div>

            <div className="coach-now-fields coach-now-fields--two">
              <label>
                <span>What would you like to explore?</span>
                <select
                  value={form.topic}
                  onChange={(event) => updateForm('topic', event.target.value)}
                  data-testid="select-coach-now-topic"
                >
                  <option value="MARKET_STRUCTURE">Market structure</option>
                  <option value="RISK_MANAGEMENT">Risk planning</option>
                  <option value="TRADE_REVIEW">Trade review</option>
                  <option value="STRATEGY">Strategy building</option>
                  <option value="PSYCHOLOGY">Trading psychology</option>
                  <option value="ENTRY_TIMING">Entry timing</option>
                </select>
                <ChevronDown className="coach-now-select-icon" size={15} aria-hidden="true" />
              </label>
              <label>
                <span>Experience level</span>
                <select
                  value={form.experienceLevel}
                  onChange={(event) => updateForm('experienceLevel', event.target.value)}
                  data-testid="select-coach-now-experience"
                >
                  <option value="BEGINNER">Building foundations</option>
                  <option value="INTERMEDIATE">Practicing consistently</option>
                  <option value="EXPERIENCED">Refining a process</option>
                </select>
                <ChevronDown className="coach-now-select-icon" size={15} aria-hidden="true" />
              </label>
            </div>

            <div className="coach-now-fields coach-now-fields--three">
              <label>
                <span>Language</span>
                <select
                  value={form.language}
                  onChange={(event) => updateForm('language', event.target.value)}
                  data-testid="select-coach-now-language"
                >
                  <option>English</option>
                  <option>Arabic</option>
                  <option>Mandarin</option>
                  <option>Italian</option>
                  <option>Spanish</option>
                </select>
                <ChevronDown className="coach-now-select-icon" size={15} aria-hidden="true" />
              </label>
              <label>
                <span>Duration</span>
                <select
                  value={form.durationMinutes}
                  onChange={(event) => updateForm('durationMinutes', Number(event.target.value) as MatchForm['durationMinutes'])}
                  data-testid="select-coach-now-duration"
                >
                  <option value={10}>10 min</option>
                  <option value={25}>25 min</option>
                  <option value={50}>50 min</option>
                </select>
                <ChevronDown className="coach-now-select-icon" size={15} aria-hidden="true" />
              </label>
              <label>
                <span>Rate cap / min</span>
                <span className="coach-now-input-prefix">$</span>
                <input
                  type="number"
                  min={0.5}
                  max={25}
                  step={0.25}
                  value={(form.maxRateCents / 100).toFixed(2)}
                  onChange={(event) => updateForm('maxRateCents', Math.max(0, Math.round(Number(event.target.value) * 100)))}
                  data-testid="input-coach-now-rate-cap"
                />
              </label>
            </div>

            <div className="coach-now-fields">
              <label>
                <span>Learning intent</span>
                <select
                  value={learningIntentPreset}
                  onChange={(event) => {
                    const nextPreset = event.target.value;
                    setLearningIntentPreset(nextPreset);
                    if (nextPreset !== 'CUSTOM') {
                      const option = learningIntentOptions.find(([value]) => value === nextPreset);
                      if (option) updateForm('learningGoal', option[1]);
                    } else {
                      updateForm('learningGoal', '');
                    }
                  }}
                  data-testid="select-coach-now-learning-intent"
                >
                  {learningIntentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <ChevronDown className="coach-now-select-icon" size={15} aria-hidden="true" />
              </label>
              <label>
                <span>{learningIntentPreset === 'CUSTOM' ? 'Write your learning intent' : 'Refine the intent (optional)'}</span>
                <input
                  value={form.learningGoal}
                  onChange={(event) => {
                    setLearningIntentPreset('CUSTOM');
                    updateForm('learningGoal', event.target.value);
                  }}
                  placeholder="e.g. Build a repeatable pre-market checklist"
                  maxLength={140}
                  data-testid="input-coach-now-learning-goal"
                />
              </label>
              <label>
                <span>Agenda note <em>optional</em></span>
                <textarea
                  value={form.agenda}
                  onChange={(event) => updateForm('agenda', event.target.value)}
                  placeholder="What should the coach know before joining?"
                  maxLength={400}
                  rows={3}
                  data-testid="textarea-coach-now-agenda"
                />
              </label>
            </div>

            <div className="coach-now-submit-row">
              <div className="coach-now-price-note">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>
                  Authorize up to <strong>{formatMoney(capCents)}</strong> for {form.durationMinutes} minutes.
                  Charged only for shared attendance.
                </span>
              </div>
              <button
                type="button"
                className="coach-now-primary-button"
                onClick={beginMatch}
                disabled={!canStart}
                data-testid="button-start-coach-now"
              >
                {isSubmitting ? 'Opening route…' : visualState === 'found' ? 'Route opened' : 'Open Coach Now'}
                {!isSubmitting && visualState !== 'found' ? <Search size={17} aria-hidden="true" /> : null}
              </button>
            </div>
            <p className="coach-now-terms">
              <ShieldCheck size={13} aria-hidden="true" />
              No charge to search. Authorization cap is released if no coach joins. Education only.
            </p>
          </div>
        </div>

        <aside className={`coach-now-atlas-panel coach-now-atlas-panel--${visualState}`} aria-label="Live matching status">
          <div className="coach-now-atlas-topline">
            <span className="coach-now-atlas-label"><Globe2 size={15} aria-hidden="true" /> LEARNING ATLAS</span>
            <span className="coach-now-atlas-code">TP / 04—NOW</span>
          </div>
          <div className="coach-now-atlas-visual" aria-hidden="true">
            <div className="coach-now-atlas-ring coach-now-atlas-ring--outer" />
            <div className="coach-now-atlas-ring coach-now-atlas-ring--inner" />
            <div className="coach-now-atlas-latitude coach-now-atlas-latitude--one" />
            <div className="coach-now-atlas-latitude coach-now-atlas-latitude--two" />
            <div className="coach-now-atlas-longitude coach-now-atlas-longitude--one" />
            <div className="coach-now-atlas-longitude coach-now-atlas-longitude--two" />
             <span className="coach-now-atlas-scan" />
            <svg className="coach-now-atlas-contours" viewBox="0 0 500 360" fill="none">
              <path d="M51 205C99 174 130 177 169 194C209 212 220 262 274 263C328 264 337 215 389 199C422 189 449 197 469 217" />
              <path d="M26 233C85 195 130 201 163 218C204 239 225 286 276 286C333 286 346 232 400 218C427 211 451 217 481 237" />
              <path d="M88 151C131 128 166 126 204 143C250 163 268 202 312 197C363 191 385 148 436 145" />
              <path d="M131 112C161 96 198 99 227 115C260 133 284 155 319 150C355 145 376 116 407 106" />
            </svg>
            <span className="coach-now-atlas-origin" />
            <span className="coach-now-atlas-signal coach-now-atlas-signal--one" />
            <span className="coach-now-atlas-signal coach-now-atlas-signal--two" />
            <span className="coach-now-atlas-signal coach-now-atlas-signal--three" />
            <div className="coach-now-atlas-center-mark"><Layers3 size={18} /></div>
          </div>

          <div className="coach-now-atlas-status">
            <div className="coach-now-status-icon">
              {visualState === 'found' ? <Check size={20} /> : visualState === 'no-live-match' || visualState === 'error' ? <X size={20} /> : <Sparkles size={19} />}
            </div>
            <div>
              <p className="coach-now-status-kicker" data-testid="status-coach-now-state">{stateLabels[visualState]}</p>
              <h2>{visualState === 'found' && matchedCoach ? `${matchedCoach.displayName} is ready.` : stateLabels[visualState]}</h2>
              <p>{stateCopy[visualState]}</p>
            </div>
          </div>

          <p className="coach-now-status-fallback" role="status" aria-live="polite">
            Status: {stateLabels[visualState]}. {stateCopy[visualState]}
          </p>

          {showAtlas && (visualState === 'finding' || visualState === 'contacting' || visualState === 'expanding' || isSubmitting) && (
            <div className="coach-now-live-progress">
              <span className="coach-now-progress-line" />
              <span>{visualState === 'expanding' ? 'Widening the search' : visualState === 'contacting' ? 'Waiting for coach responses' : 'Opening the live route'}</span>
            </div>
          )}

          {visualState === 'found' && matchedCoach && (
            <div className="coach-now-found-card" data-testid="card-coach-now-match">
              <span className="coach-now-avatar coach-now-avatar--large" aria-hidden="true">
                {matchedCoach.avatarUrl ? <img src={matchedCoach.avatarUrl} alt="" /> : initials(matchedCoach.displayName)}
              </span>
              <div>
                <strong>{matchedCoach.displayName}</strong>
                <span>{matchedCoach.headline}</span>
                <span>
                  {matchedCoach.ratingCount > 0 ? `${matchedCoach.ratingAverage.toFixed(1)} rating` : 'New coach'}
                  {' · '}{matchedCoach.completedSessionCount ?? 0} sessions
                  {' · '}{formatMoney(matchedCoach.instantRatePerMinuteCents)}/min
                </span>
                <small>
                  {matchedCoach.proof?.approval?.label ?? 'Tradigo review'} · {matchedCoach.proof?.serviceRecord?.status === 'NEW' ? 'new service record' : 'learner record available'}
                </small>
                {matchReasonCodes.length > 0 && (
                  <small aria-label="Why this coach matched">
                    Fit: {matchReasonCodes.slice(0, 4).map(labelReasonCode).join(' · ')}
                  </small>
                )}
              </div>
              <MapPin size={15} aria-hidden="true" />
            </div>
          )}

          {visualState === 'found' && matchedCoach && matchGroupId && (
            <div className="coach-now-claim-actions" data-testid="coach-now-claim-actions">
              <p>
                {claimSecondsRemaining > 0
                  ? `This coach is reserved for you for ${claimSecondsRemaining}s.`
                  : 'This coach reservation is being checked.'}
              </p>
              <button type="button" onClick={confirmCoach} disabled={isSubmitting || claimSecondsRemaining === 0} data-testid="button-coach-now-start-session">
                {isSubmitting ? 'Confirming…' : 'Start Session'}
              </button>
              <button type="button" className="coach-now-notify-button" onClick={declineAndRematch} disabled={isSubmitting} data-testid="button-coach-now-find-another">
                Find Another Coach
              </button>
            </div>
          )}

          {(visualState === 'no-live-match' || visualState === 'cancelled' || visualState === 'error') && (
            <div className="coach-now-fallback-card">
              <div>
                <Clock3 size={17} aria-hidden="true" />
                <span>Keep the learning moving</span>
              </div>
              <p>Choose a time with an approved coach instead. Your preferences can carry into a scheduled session.</p>
              <button type="button" onClick={onNavigateToScheduled} data-testid="button-coach-now-schedule">
                Browse scheduled coaching
              </button>
              <button
                type="button"
                className="coach-now-notify-button"
                onClick={requestAvailability}
                disabled={availabilityRequested || isSubmitting}
                data-testid="button-coach-now-notify"
              >
                {availabilityRequested ? 'Availability alert requested' : 'Notify me when a live coach is available'}
              </button>
              <button type="button" className="coach-now-retry-button" onClick={resetFlow} data-testid="button-coach-now-retry">
                <RotateCcw size={14} aria-hidden="true" /> Try Coach Now again
              </button>
            </div>
          )}

          {errorMessage && (
            <p className="coach-now-error" role="alert" data-testid="status-coach-now-error">
              {errorMessage}
            </p>
          )}

          {(visualState === 'finding' || visualState === 'contacting' || visualState === 'expanding' || isSubmitting) && (
            <button
              type="button"
              className="coach-now-cancel-button"
              onClick={cancelMatch}
              disabled={isSubmitting && !matchGroupId}
              data-testid="button-cancel-coach-now"
            >
              <X size={14} aria-hidden="true" /> Cancel live search
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}

export default CoachNowMatchFlow;