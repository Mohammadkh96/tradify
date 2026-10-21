import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  BookOpen,
  CalendarDays,
  Check,
  Compass,
  LockKeyhole,
  RotateCcw,
} from "lucide-react";

import "./_group.css";

const lesson = {
  learner: "Maya Chen",
  coach: "Sofia Reyes",
  topic: "Market Structure",
  duration: "25 minutes",
  date: "August 25, 2026",
  goal: "Read a clean change of character without rushing the entry.",
  concepts: "Swing points, liquidity sweep, and the difference between a break and a retest.",
  evidence: "We revisited the 4H example from Maya’s journal and marked where structure held after the sweep.",
  practice: "Annotate three past charts. Label the swing, the sweep, and the confirmation — no predictions.",
};

const noteFields = [
  { key: "goal", label: "Today’s goal", value: lesson.goal, wide: true },
  { key: "concepts", label: "Concepts reviewed", value: lesson.concepts },
  { key: "evidence", label: "Evidence discussed", value: lesson.evidence },
] as const;

const writingSteps = [
  ...noteFields,
  { key: "practice", label: "next practice step", value: lesson.practice },
] as const;

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function JourneyMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={compact ? "passport-cover-mark" : "logo-mark-large"}
      viewBox="0 0 150 139"
      fill="none"
    >
      <path fill="#2F8DED" d="m127 23c-6.6-6.4-14.5-10.5-28.5-10.6-14.5 0-32.2 5.3-48.5 17.5l-6.1 3.9 6.2 5.9 2.2-1.7c11.3-8.5 22.4-13.4 34.9-15.8 9.9-1.6 20.5-2.2 28.8 2.8 7.2 4.4 13 11.7 12.9 23 0 9.5-3.7 18.5-7.7 25.3-4.6 7.7-10.6 14.5-17.5 20.6-9 8.1-19.9 14.4-30.9 19.1-11 3.7-22.8 6-33.8 2.9-4.6-1.3-7.8-3.1-10.7-6-4.3-4.3-7-10.7-7.2-18.8 0-12 6.2-26.1 17.9-40.1l2.3-2.7-6.2-6.7-3 3.2c-11.1 11.7-20.1 28.1-20.1 45.8.1 9 3.1 17.4 8.8 23.7s13.3 10.3 24.1 12.2c9 0.9 17.6 0.2 27.9-2.8 13.3-4 26.4-11.1 36.9-20.1 3.7-3.2 7-6.7 10.2-10.3 7.5-8.8 17.8-25.3 18-44.4.2-11.1-4.8-20-10.9-25.9z"/>
      <path fill="#F66B5D" d="m74.9 50.2c-9.9-0.1-19.1 8.1-19.1 18.9-0.1 10.2 7.6 19.5 19.3 19.4 9.9 0 19-8 19-18.8.2-10.5-9.2-19.6-19.2-19.5z"/>
    </svg>
  );
}

export function Passport() {
  const [isOpen, setIsOpen] = useState(true);
  const [writingProgress, setWritingProgress] = useState(4);
  const [stampVisible, setStampVisible] = useState(true);
  const [writingStatus, setWritingStatus] = useState("Learning notes are ready. Sofia’s stamp is on the record.");
  const reducedMotion = useReducedMotion();
  const sequenceTimers = useRef<number[]>([]);

  const clearSequenceTimers = useCallback(() => {
    sequenceTimers.current.forEach((timer) => window.clearTimeout(timer));
    sequenceTimers.current = [];
  }, []);

  const beginWritingSequence = useCallback(() => {
    clearSequenceTimers();
    if (reducedMotion) {
      setWritingProgress(writingSteps.length);
      setStampVisible(true);
      setWritingStatus("Learning notes are ready. Sofia’s stamp is on the record.");
      return;
    }

    setWritingProgress(0);
    setStampVisible(false);
    setWritingStatus("Sofia is writing the learning notes…");

    writingSteps.forEach((field, index) => {
      const timer = window.setTimeout(() => {
        setWritingProgress(index + 1);
        if (index === writingSteps.length - 1) {
          setWritingStatus("Notes complete. Sofia is placing her stamp…");
          const stampTimer = window.setTimeout(() => {
            setStampVisible(true);
            setWritingStatus("Sofia Reyes · lesson recorded.");
          }, 550);
          sequenceTimers.current.push(stampTimer);
        } else {
          setWritingStatus(`Sofia is writing ${field.label.toLowerCase()}…`);
        }
      }, 720 * (index + 1));
      sequenceTimers.current.push(timer);
    });
  }, [clearSequenceTimers, reducedMotion]);

  useEffect(() => {
    beginWritingSequence();
    return clearSequenceTimers;
  }, [beginWritingSequence, clearSequenceTimers]);

  const replayStamp = () => {
    if (reducedMotion) {
      setStampVisible(true);
      setWritingStatus("Sofia Reyes · lesson recorded.");
      return;
    }
    setStampVisible(false);
    const timer = window.setTimeout(() => {
      setStampVisible(true);
      setWritingStatus("Sofia Reyes · lesson recorded.");
    }, 120);
    sequenceTimers.current.push(timer);
  };

  const replayWriting = () => {
    setIsOpen(true);
    beginWritingSequence();
  };

  const togglePassport = () => {
    setIsOpen((current) => !current);
  };

  return (
    <main className="tradigo-shell" aria-labelledby="passport-title">
      <div className="passport-stage">
        <header className="passport-topline">
          <div>
            <p className="passport-kicker">Trader Journey Passport</p>
            <h1 id="passport-title" className="passport-heading tg-serif">
              Keep what you <em>learn.</em>
            </h1>
          </div>
          <p className="passport-helper">
            A private record of the moments that make your process clearer — never a ledger of returns.
          </p>
        </header>

        <section
          className={`passport-book ${isOpen ? "is-open" : "is-closed"}`}
          aria-label={isOpen ? "Open Trader Journey Passport" : "Closed Trader Journey Passport"}
        >
          <div className="passport-cover">
            <div className="passport-cover-top">
              <span>Tradigo</span>
              <span>Issue 01</span>
            </div>
            <div>
              <JourneyMark compact />
              <p className="passport-cover-kicker">A record of the places your thinking has been</p>
              <h2 className="passport-cover-title tg-serif">
                Trader
                <br />
                journey
                <span>Learning record · private keepsake</span>
              </h2>
            </div>
            <div className="passport-cover-footer">
                <span>Educational coaching only</span>
              <span>2026</span>
            </div>
          </div>

          <div className="passport-interior">
            <div className="passport-page left">
              <div className="page-meta"><span>Entry 01</span><span>Learning visa</span></div>
              <p className="page-eyebrow">A lesson worth keeping</p>
              <h2 className="page-name">{lesson.topic}</h2>
              <p className="page-date">
                <CalendarDays size={13} aria-hidden="true" />
                {lesson.date}
              </p>

              <div className="passport-profile">
                <span className="profile-initial" aria-hidden="true">MC</span>
                <div>
                  <p className="profile-label">Learner</p>
                  <p className="profile-name">{lesson.learner}</p>
                </div>
              </div>

              <div className="journey-line" aria-hidden="true" />
              <div className="journey-entry">
                <p className="entry-label">With your coach</p>
                <p className="entry-value">{lesson.coach}</p>
                <p className="entry-note">A focused conversation, held with room for questions.</p>
              </div>
              <div className="journey-entry">
                <p className="entry-label">Time spent together</p>
                <p className="entry-value">{lesson.duration}</p>
                <p className="entry-note">Enough time to slow down and look again.</p>
              </div>
              <p className="page-folio">TRADIGO · LEARNING RECORD <span>01</span></p>
            </div>

            <div className="passport-page right">
              <div className="page-meta"><span>Entry 01 / verso</span><span>Coach verified</span></div>
              <div className="record-heading">
                <div>
                  <p className="page-eyebrow">Completed session</p>
                  <h2>Notes from the road</h2>
                  <p className="record-subtitle">A considered account of what became clearer.</p>
                </div>
                <div
                  className={`stamp ${stampVisible ? "" : "is-hidden"}`}
                  aria-label={stampVisible ? "Sofia Reyes lesson recorded stamp" : "Sofia Reyes stamp is being placed"}
                  role="status"
                  aria-live="polite"
                >
                  <span className="stamp-copy">Sofia Reyes<br />· lesson<br />recorded</span>
                </div>
              </div>

              <div className="writing-status" role="status" aria-live="polite" aria-atomic="true">
                <span className={`writing-status-dot ${stampVisible ? "is-complete" : ""}`} aria-hidden="true" />
                {writingStatus}
              </div>

              <dl className="record-list">
                {noteFields.map((field, index) => (
                  <div
                    className={`record-item ${field.key === "goal" ? "wide" : ""} ${index >= writingProgress ? "is-writing" : ""}`}
                    key={field.key}
                    aria-hidden={index >= writingProgress}
                  >
                    <dt>{field.label}</dt>
                    {index < writingProgress ? (
                      <dd className="note-copy-reveal">{field.value}</dd>
                    ) : (
                      <dd className="writing-placeholder" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </dd>
                    )}
                  </div>
                ))}
              </dl>

              <div className={`practice-card ${writingProgress < 4 ? "is-writing" : ""}`} aria-hidden={writingProgress < 4}>
                <ArrowDownRight size={18} aria-hidden="true" />
                {writingProgress < 4 ? (
                  <p className="practice-copy-reveal">
                    <strong>Next practice step</strong>
                    Sofia is writing the next step…
                  </p>
                ) : (
                  <p className="practice-copy-reveal">
                    <strong>Next practice step</strong>
                    {lesson.practice}
                  </p>
                )}
              </div>

              <div className="passport-actions">
                <p className="passport-action-note">
                  <Check size={14} aria-hidden="true" />
                  {writingProgress === 4 ? "Saved to Maya’s private learning record" : "Coach is adding this to Maya’s private record"}
                </p>
                <div className="passport-button-row">
                  <button
                    type="button"
                    className="passport-button secondary"
                    onClick={replayWriting}
                    aria-label="Replay the coach writing the learning notes"
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    Replay notes
                  </button>
                  <button
                    type="button"
                    className="passport-button secondary"
                    onClick={replayStamp}
                    aria-label="Replay the Sofia Reyes lesson recorded stamp"
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    Replay stamp
                  </button>
                </div>
              </div>
              <p className="passport-privacy">
                <LockKeyhole size={13} aria-hidden="true" />
                Valid for learning progress only — no signals, promises, or performance claims.
              </p>
            </div>
          </div>
        </section>

        <div className="passport-actions">
          <p className="passport-action-note">
            <Compass size={14} aria-hidden="true" />
            {isOpen ? "Take a moment with the record." : "Your completed lesson is tucked away safely."}
          </p>
          <button
            type="button"
            className="passport-button"
            onClick={togglePassport}
            aria-expanded={isOpen}
            aria-controls="passport-title"
          >
            <BookOpen size={15} aria-hidden="true" />
            {isOpen ? "Close passport" : "Open passport"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default Passport;