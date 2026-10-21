import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Clock, Zap, ShieldCheck, ArrowRight, Calendar } from 'lucide-react';
import { CoachMarketplaceDTO } from '../../types';
import { cn } from '../../lib/utils';
import { apiClient } from '../../lib/apiClient';

const learningIntentOptions = [
  ['PROCESS_REVIEW', 'Review a process I already use'],
  ['BUILD_FRAMEWORK', 'Build a repeatable learning framework'],
  ['UNDERSTAND_CONCEPT', 'Understand a market concept'],
  ['REFLECT_ON_DECISION', 'Reflect on a recent decision'],
  ['PRACTICE_SKILL', 'Practice one skill with feedback'],
  ['CUSTOM', 'Write my own intent'],
] as const;

interface CoachBookingPackagesProps {
  coach: CoachMarketplaceDTO;
}

export const CoachBookingPackages: React.FC<CoachBookingPackagesProps> = ({ coach }) => {
  const [mode, setMode] = useState<'instant' | 'scheduled'>(coach.availability === 'AVAILABLE' ? 'instant' : 'scheduled');
  const [durationMinutes, setDurationMinutes] = useState<10 | 25 | 50>(25);
  const [topic, setTopic] = useState('');
  const [learningGoal, setLearningGoal] = useState('');
  const [learningIntentPreset, setLearningIntentPreset] = useState('CUSTOM');
  const [agenda, setAgenda] = useState('');
  const [coachingCategory, setCoachingCategory] = useState('GENERAL_EDUCATION');
  const [instrumentClass, setInstrumentClass] = useState('GENERAL');
  const [policyConfirmed, setPolicyConfirmed] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const bookingIdempotencyKey = useRef<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (mode !== 'scheduled') return;
    let active = true;
    setLoadingSlots(true);
    const from = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    apiClient.get(`/api/marketplace/coaches/${coach.id}/availability?durationMinutes=${durationMinutes}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then((data) => {
        if (!active) return;
        setScheduleData(data);
        setScheduledAt((current) => current && data.slots?.some((slot: any) => slot.startsAt === current) ? current : (data.slots?.[0]?.startsAt ?? ''));
      })
      .catch(() => {
        if (active) setScheduleData({ availability: null, slots: [] });
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => { active = false; };
  }, [coach.id, durationMinutes, mode]);

  const instantRate = coach.instantRatePerMinuteCents;
  const scheduledRate = Math.ceil(coach.hourlyRateCents / 60);
  const selectedRate = mode === 'instant' ? instantRate : scheduledRate;
  const totalCents = selectedRate * durationMinutes;
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: coach.currency,
  }).format(totalCents / 100);

  const handleBook = async () => {
    if (mode === 'scheduled' && !scheduledAt) {
      setBookingError('Choose a date and time before requesting a scheduled session.');
      return;
    }
    if (!agenda.trim()) {
      setBookingError('Add a short agenda so the coach can prepare.');
      return;
    }
    if (!learningGoal.trim()) {
      setBookingError('Add one clear learning goal so the coach knows what success looks like.');
      return;
    }
    if (!policyConfirmed) {
      setBookingError('Confirm the session and payment policy before continuing.');
      return;
    }
    setBooking(true);
    setBookingError(null);
    try {
      // Keep the key stable across a network retry, but create a fresh key
      // when this booking form is mounted for a new request.
      bookingIdempotencyKey.current ??= crypto.randomUUID();
      const data = await apiClient.post('/api/coach-now/requests', {
        coachId: coach.id,
        mode: mode === 'scheduled' ? 'scheduled' : 'instant',
        durationMinutes,
        scheduledAt: mode === 'scheduled' ? new Date(scheduledAt).toISOString() : undefined,
        topic: topic.trim(),
      coachingCategory,
      instrumentClass,
        learningGoal: learningGoal.trim(),
        agenda: agenda.trim(),
      }, { headers: { 'Idempotency-Key': bookingIdempotencyKey.current } });
      const basePath = location.pathname.startsWith('/preview') ? '/preview' : '/app';
      navigate(`${basePath}/sessions/${data.session.id}`);
    } catch (err: any) {
      setBookingError(err.message || 'We could not send this coaching request. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Request a focused coaching session</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Choose a fixed duration, set an agenda, and authorize only the displayed amount</p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-secondary/80 p-1 rounded-xl border border-border">
          <button
            onClick={() => setMode('instant')}
            disabled={coach.availability !== 'AVAILABLE'}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              mode === 'instant' ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:text-foreground",
              coach.availability !== 'AVAILABLE' && "cursor-not-allowed opacity-40",
            )}
          >
            Coach Now
          </button>
          <button
            onClick={() => setMode('scheduled')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              mode === 'scheduled' ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Schedule
          </button>
        </div>
      </div>

      {bookingError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold">
          {bookingError}
        </div>
      )}

      {/* Instant Mode */}
      {mode === 'instant' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center space-x-3">
            <Zap className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>{coach.displayName} is currently available. The coach must accept before payment authorization opens.</span>
          </div>
        </div>
      )}

      {/* Scheduled Mode */}
      {mode === 'scheduled' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-secondary/40 border border-border">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-sm">Schedule a focused session</h4>
               <p className="text-xs text-muted-foreground mt-1">
                   Choose a published slot with {coach.displayName}. Your payment is authorized through PayPal when the booking is confirmed.
                </p>
              </div>
            </div>
            <div className="mt-5">
               <label className="text-xs font-semibold text-muted-foreground">
                 Available time ({scheduleData?.availability?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone})
                 <select
                   value={scheduledAt}
                   onChange={(e) => setScheduledAt(e.target.value)}
                   disabled={loadingSlots || !scheduleData?.slots?.length}
                   className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                 >
                   <option value="">{loadingSlots ? 'Loading published slots…' : 'Select a published slot'}</option>
                   {(scheduleData?.slots ?? []).map((slot: any) => (
                     <option key={slot.startsAt} value={slot.startsAt}>
                       {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(slot.startsAt))}
                     </option>
                   ))}
                 </select>
                 {!loadingSlots && !scheduleData?.slots?.length && (
                   <span className="mt-2 block text-[11px] font-normal text-muted-foreground">No matching slots are open in the next 30 days. Try another duration or check back later.</span>
                 )}
               </label>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([10, 25, 50] as const).map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setDurationMinutes(minutes)}
                className={cn(
                  'rounded-xl border px-3 py-3 text-sm font-bold transition-colors',
                  durationMinutes === minutes ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/30',
                )}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </div>
        <label className="block text-xs font-semibold text-muted-foreground">
          Coaching category
          <select
            value={coachingCategory}
            onChange={(event) => setCoachingCategory(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="GENERAL_EDUCATION">General trading education</option>
            <option value="RISK_EDUCATION">Risk education</option>
            <option value="MARKET_STRUCTURE_EDUCATION">Market structure education</option>
            <option value="TRADING_PSYCHOLOGY">Trading psychology</option>
            <option value="TRADING_JOURNAL_REVIEW">Trading journal review</option>
            <option value="HISTORICAL_TRADE_REVIEW">Historical trade review</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Instrument class
          <select
            value={instrumentClass}
            onChange={(event) => setInstrumentClass(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="GENERAL">General / not instrument-specific</option>
            {coach.markets?.map((market) => <option key={market} value={market}>{market}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Topic
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            maxLength={240}
            placeholder="Example: Review my EUR/USD entry process"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Learning intent
          <select
            value={learningIntentPreset}
            onChange={(event) => {
              const nextPreset = event.target.value;
              setLearningIntentPreset(nextPreset);
              if (nextPreset !== 'CUSTOM') {
                const option = learningIntentOptions.find(([value]) => value === nextPreset);
                if (option) setLearningGoal(option[1]);
              } else {
                setLearningGoal('');
              }
            }}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="select-booking-learning-intent"
          >
            {learningIntentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <span className="mt-3 block">Refine the intent</span>
          <input
            value={learningGoal}
            onChange={(event) => {
              setLearningIntentPreset('CUSTOM');
              setLearningGoal(event.target.value);
            }}
            maxLength={500}
            placeholder="Example: Build a repeatable pre-market checklist"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Progress is measured by the process you build, never by promised returns.</span>
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Preparation agenda
          <textarea
            value={agenda}
            onChange={(event) => setAgenda(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Describe what you want to learn, the context the coach should review, and the outcome you want."
            className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-bold">{durationMinutes}-minute educational consultation</p>
              <p className="mt-1 text-xs text-muted-foreground">Payment is authorized after coach acceptance. Final billing uses verified shared attendance, capped at {durationMinutes} minutes.</p>
            </div>
            <strong className="whitespace-nowrap text-xl">{formattedTotal}</strong>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={policyConfirmed}
              onChange={(event) => setPolicyConfirmed(event.target.checked)}
              className="mt-0.5"
            />
            <span>I understand this is education, not a signal or trade-execution service. A 60-second reconnect grace applies, and disputes pause payout review.</span>
          </label>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <button
          onClick={handleBook}
          disabled={booking}
          className="w-full py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center space-x-2"
        >
          <span>
            {booking
              ? 'Sending request…'
              : `Request ${durationMinutes}-minute ${mode === 'scheduled' ? 'scheduled' : 'Coach Now'} session`}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
