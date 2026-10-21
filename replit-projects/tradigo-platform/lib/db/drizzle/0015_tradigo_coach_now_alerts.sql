CREATE TABLE IF NOT EXISTS tradigo_coach_now_availability_alerts (
  id text PRIMARY KEY,
  trader_id text NOT NULL,
  instrument_class text NOT NULL,
  topic text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT '',
  max_rate_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS tradigo_coach_now_alerts_route_idx
  ON tradigo_coach_now_availability_alerts(trader_id, instrument_class, topic, language);