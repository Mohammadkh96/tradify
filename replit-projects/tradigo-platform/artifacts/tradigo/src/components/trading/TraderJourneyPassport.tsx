import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownRight, BookOpen, CalendarDays, Check, Compass, LockKeyhole, MapPin, RotateCcw, Route } from 'lucide-react';
import { TradigoMark } from './TradigoLogo';
import './tradigo-passport.css';

type PassportSession = {
  coachName?: string;
  topic?: string;
  durationMinutes: number;
  scheduledAt: string;
  learningRecord?: {
    learningGoal?: string | null;
    conceptsReviewed?: string | null;
    evidenceDiscussed?: string | null;
    sharedArtifact?: string | null;
    unresolvedQuestions?: string | null;
    practiceSteps?: string | null;
    traderReflection?: string | null;
  } | null;
};

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}

export function TraderJourneyPassport({ session }: { session: PassportSession }) {
  const [isOpen, setIsOpen] = useState(true);
  const [writingProgress, setWritingProgress] = useState(4);
  const [stampVisible, setStampVisible] = useState(true);
  const [writingStatus, setWritingStatus] = useState('Learning notes are ready. Your coach’s stamp is on the record.');
  const reducedMotion = useReducedMotion();
  const sequenceTimers = useRef<number[]>([]);
  const record = session.learningRecord;
  const date = new Date(session.scheduledAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  const topic = session.topic || 'Coaching session';
  const coach = session.coachName || 'Your coach';
  const goal = record?.learningGoal || topic;
  const noteFields = [
    { key: 'goal', label: 'Departure · Session goal', value: goal },
    { key: 'concepts', label: 'Waypoints · Concepts reviewed', value: record?.conceptsReviewed || 'Your coach has not added observations yet.' },
    { key: 'artifact', label: 'Shared artifact · Kept together', value: record?.sharedArtifact || 'Not added yet.' },
    { key: 'evidence', label: 'Arrival · What became clearer', value: record?.evidenceDiscussed || 'Not added yet.' },
    { key: 'questions', label: 'Open questions · To revisit', value: record?.unresolvedQuestions || 'None recorded.' },
    { key: 'practice', label: 'Next stop · Practice step', value: record?.practiceSteps || 'Your coach can add a practice step to this record.' },
  ];

  const clearSequenceTimers = useCallback(() => {
    sequenceTimers.current.forEach((timer) => window.clearTimeout(timer));
    sequenceTimers.current = [];
  }, []);

  const beginWritingSequence = useCallback(() => {
    clearSequenceTimers();
    if (reducedMotion) {
      setWritingProgress(noteFields.length);
      setStampVisible(true);
      setWritingStatus(`Learning notes are ready. ${coach}’s stamp is on the record.`);
      return;
    }
    setWritingProgress(0);
    setStampVisible(false);
    setWritingStatus(`${coach} is writing the learning notes…`);
    noteFields.forEach((field, index) => {
      const timer = window.setTimeout(() => {
        setWritingProgress(index + 1);
        if (index === noteFields.length - 1) {
          setWritingStatus(`Notes complete. ${coach} is placing the stamp…`);
          const stampTimer = window.setTimeout(() => {
            setStampVisible(true);
            setWritingStatus(`${coach} · lesson recorded.`);
          }, 550);
          sequenceTimers.current.push(stampTimer);
        } else {
          setWritingStatus(`${coach} is writing ${field.label.toLowerCase()}…`);
        }
      }, 720 * (index + 1));
      sequenceTimers.current.push(timer);
    });
  }, [clearSequenceTimers, coach, noteFields.length, reducedMotion]);

  useEffect(() => {
    beginWritingSequence();
    return clearSequenceTimers;
  }, [beginWritingSequence, clearSequenceTimers]);

  const replayStamp = () => {
    if (reducedMotion) {
      setStampVisible(true);
      setWritingStatus(`${coach} · lesson recorded.`);
      return;
    }
    setStampVisible(false);
    const timer = window.setTimeout(() => {
      setStampVisible(true);
      setWritingStatus(`${coach} · lesson recorded.`);
    }, 120);
    sequenceTimers.current.push(timer);
  };

  const replayWriting = () => {
    setIsOpen(true);
    beginWritingSequence();
  };

  const toggle = () => {
    setIsOpen((open) => !open);
  };

  return (
    <section className="tg-passport-shell" aria-labelledby="trader-passport-title">
      <div className="tg-passport-stage">
        <header className="tg-passport-topline">
          <div>
            <p className="tg-passport-kicker">Trader Journey Passport · private learning keepsake</p>
            <h2 id="trader-passport-title" className="tg-passport-heading">Keep what you <em>learn.</em></h2>
          </div>
          <p className="tg-passport-helper">A quiet record of the route your thinking took — never a report of returns or performance.</p>
        </header>

        <div className={`tg-passport-book ${isOpen ? 'is-open' : 'is-closed'}`}>
          <div className="tg-passport-cover">
            <div className="tg-passport-cover-top"><span>Tradigo / Learning Passport</span><span>Issue 01</span></div>
            <div>
                <TradigoMark className="tg-passport-cover-mark" decorative />
              <p className="tg-passport-cover-kicker">A record of the places your thinking has been</p>
              <h3 className="tg-passport-cover-title">Trade<br />routes<span>Learning atlas · private passport</span></h3>
            </div>
            <div className="tg-passport-cover-footer"><span>Educational coaching only</span><span>{new Date(session.scheduledAt).getFullYear()}</span></div>
          </div>

          <div className="tg-passport-interior">
            <div className="tg-passport-page tg-passport-left">
              <div className="tg-page-meta"><span>Folio 01 / recto</span><span>Learning visa</span></div>
              <p className="tg-page-eyebrow">A lesson worth keeping</p>
              <h3 className="tg-page-name">{topic}</h3>
              <p className="tg-page-date"><CalendarDays size={13} aria-hidden="true" />{date}</p>
              <div className="tg-passport-profile"><span className="tg-profile-initial" aria-hidden="true">{coach.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><p className="tg-profile-label">With your coach</p><p className="tg-profile-name">{coach}</p></div></div>
              <div className="tg-route-map" role="img" aria-label="Learning route from the session goal through concepts and evidence to the next practice step">
                <div className="tg-route-station tg-route-station-start">
                  <span className="tg-route-pin"><MapPin size={13} aria-hidden="true" /></span>
                  <div><p className="tg-entry-label">Departure · Session goal</p><p className="tg-entry-value">{goal}</p></div>
                </div>
                <div className="tg-route-leg">
                  <span className="tg-route-leg-mark"><Route size={13} aria-hidden="true" /></span>
                  <div><p className="tg-entry-label">Waypoints · Concepts reviewed</p><p className="tg-entry-value">{record?.conceptsReviewed || 'Your coach has not added observations yet.'}</p></div>
                </div>
                <div className="tg-route-station tg-route-station-arrival">
                  <span className="tg-route-pin"><MapPin size={13} aria-hidden="true" /></span>
                  <div><p className="tg-entry-label">Arrival · What became clearer</p><p className="tg-entry-value">{record?.evidenceDiscussed || 'Not added yet.'}</p></div>
                </div>
                <div className="tg-route-station tg-route-station-next">
                  <span className="tg-route-pin"><ArrowDownRight size={13} aria-hidden="true" /></span>
                  <div><p className="tg-entry-label">Next stop · Practice step</p><p className="tg-entry-value">{record?.practiceSteps || 'Your coach can add a practice step to this record.'}</p></div>
                </div>
              </div>
              <div className="tg-route-duration"><span>Shared time</span><strong>{session.durationMinutes} minutes</strong><small>Enough time to slow down and look again.</small></div>
              <p className="tg-page-folio">TRADIGO · LEARNING RECORD <span>01</span></p>
            </div>

            <div className="tg-passport-page tg-passport-right">
              <div className="tg-page-meta"><span>Folio 01 / verso</span><span>Coach verified</span></div>
              <div className="tg-record-heading"><div><p className="tg-page-eyebrow">Completed session</p><h3>Notes from the route</h3><p className="tg-record-subtitle">The concepts, evidence, and arrival worth revisiting.</p></div><div className={`tg-stamp ${stampVisible ? '' : 'is-hidden'}`} role="status" aria-live="polite" aria-label={stampVisible ? `${coach} lesson recorded stamp` : `${coach} stamp is being placed`}><span>{coach}<br />· lesson<br />recorded</span></div></div>
              <div className="tg-writing-status" role="status" aria-live="polite" aria-atomic="true"><span className={`tg-writing-status-dot ${stampVisible ? 'is-complete' : ''}`} aria-hidden="true" />{writingStatus}</div>
              <dl className="tg-record-list">
                {noteFields.slice(0, 3).map((field, index) => (
                  <div key={field.key} className={`tg-record-item ${field.key === 'goal' ? 'wide' : ''} ${index >= writingProgress ? 'is-writing' : ''}`} aria-hidden={index >= writingProgress}>
                    <dt>{field.label}</dt>
                    {index < writingProgress ? <dd className="tg-note-copy-reveal">{field.value}</dd> : <dd className="tg-writing-placeholder" aria-hidden="true"><span /><span /><span /></dd>}
                  </div>
                ))}
              </dl>
               <div className={`tg-practice-card ${writingProgress < 4 ? 'is-writing' : ''}`} aria-hidden={writingProgress < 4}><ArrowDownRight size={18} aria-hidden="true" /><p><strong>Next stop · Practice step</strong>{writingProgress < 4 ? `${coach} is writing the next step…` : noteFields[3].value}</p></div>
              <div className="tg-passport-actions"><p className="tg-passport-action-note"><Check size={14} aria-hidden="true" />{writingProgress === 4 ? 'Saved to your private learning record' : 'Coach is adding this to your private record'}</p><div className="tg-passport-button-row"><button type="button" className="tg-passport-button secondary" onClick={replayWriting}><RotateCcw size={14} aria-hidden="true" />Replay notes</button><button type="button" className="tg-passport-button secondary" onClick={replayStamp}><RotateCcw size={14} aria-hidden="true" />Replay stamp</button></div></div>
              <p className="tg-passport-privacy"><LockKeyhole size={13} aria-hidden="true" />Valid for learning progress only — no signals, promises, or performance claims.</p>
            </div>
          </div>
        </div>

        <div className="tg-passport-actions"><p className="tg-passport-action-note"><Compass size={14} aria-hidden="true" />{isOpen ? 'Take a moment with the record.' : 'Your completed lesson is tucked away safely.'}</p><button type="button" className="tg-passport-button" onClick={toggle} aria-expanded={isOpen}><BookOpen size={15} aria-hidden="true" />{isOpen ? 'Close passport' : 'Open passport'}</button></div>
      </div>
    </section>
  );
}