import { useState } from "react";

import "./_group.css";

function TradigoMark() {
  return (
    <svg className="logo-mark-large" viewBox="0 0 120 120" fill="none" role="img" aria-label="Tradigo companion journey mark">
      <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="1.5" opacity=".45" />
      <path
        d="M24 83C30 64 40 52 54 52c4.5 0 7.5 2.8 7.5 7.1 0 4.2-3.2 7.2-7.5 7.2-10.6 0-19.2 6.4-23 16.7"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M70 29.5 91 37l-14 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M96 30C82 31 71 39 64 51.5c-2.2 3.9-2.1 7.2.6 9.8 2.9 2.8 7.1 2.6 10-.2" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="61" cy="60" r="4.5" fill="#b86756" />
    </svg>
  );
}

export function Logo() {
  const [markOnly, setMarkOnly] = useState(false);

  return (
    <main className="logo-shell" aria-labelledby="logo-title">
      <div className="logo-stage">
        <header className="logo-topline">
          <div>
            <p className="passport-kicker">Tradigo identity study</p>
            <h1 id="logo-title" className="passport-heading tg-serif">
              A mark for the <em>long way around.</em>
            </h1>
          </div>
          <p className="passport-helper">
            Guidance that respects the work. Progress you can name. A journey, not a shortcut.
          </p>
        </header>

        <section className="logo-card" aria-label="Tradigo logo lockup presentation">
          <div className="logo-card-main">
            <div className="logo-ink-panel">
              <p className="passport-kicker">The journey mark</p>
              <TradigoMark />
              <p className="logo-panel-copy">
                 Two paths meet at one waypoint: a trader and a coach moving forward together. The coral point is a lesson kept.
              </p>
            </div>

            <div className="logo-lockup-panel">
              <p className="passport-kicker">Primary wordmark</p>
              {!markOnly ? (
                <div className="wordmark" aria-label="Tradigo">
                  tradi<em>go</em>
                </div>
              ) : (
                <div style={{ color: "var(--tg-ink)" }}>
                  <TradigoMark />
                </div>
              )}
              <p className="wordmark-tagline">
                Learn with a person.<br />
                Leave with a clearer process.
              </p>
              <div className="logo-controls">
                <div className="logo-toggle" role="group" aria-label="Choose logo presentation">
                  <button
                    type="button"
                    className={!markOnly ? "active" : ""}
                    aria-pressed={!markOnly}
                    onClick={() => setMarkOnly(false)}
                  >
                    Full lockup
                  </button>
                  <button
                    type="button"
                    className={markOnly ? "active" : ""}
                    aria-pressed={markOnly}
                    onClick={() => setMarkOnly(true)}
                  >
                    Mark only
                  </button>
                </div>
                <p className="logo-control-note">Guidance, without the clichés.</p>
              </div>
            </div>
          </div>

          <dl className="logo-meta">
             <div className="logo-meta-item">
              <dt>Form</dt>
               <dd>Two paths, one waypoint</dd>
            </div>
            <div className="logo-meta-item">
              <dt>Voice</dt>
              <dd>Personal · earned · calm</dd>
            </div>
            <div className="logo-meta-item">
              <dt>Guardrail</dt>
              <dd>No signals. No promises.</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}

export default Logo;