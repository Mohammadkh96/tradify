ALTER TABLE tradigo_coaches
  ADD COLUMN IF NOT EXISTS availability_timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS availability_min_notice_minutes integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS availability_booking_horizon_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS availability_buffer_minutes integer NOT NULL DEFAULT 10;
ALTER TABLE tradigo_sessions
  ADD COLUMN IF NOT EXISTS coaching_category text NOT NULL DEFAULT 'GENERAL_EDUCATION',
  ADD COLUMN IF NOT EXISTS instrument_class text NOT NULL DEFAULT 'GENERAL';

CREATE TABLE IF NOT EXISTS tradigo_coach_availability_rules (
  id text PRIMARY KEY,
  coach_id text NOT NULL,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440 AND end_minute > start_minute),
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, weekday, start_minute, end_minute)
);
CREATE INDEX IF NOT EXISTS tradigo_coach_availability_rules_coach_idx
  ON tradigo_coach_availability_rules(coach_id, weekday, start_minute);
CREATE TABLE IF NOT EXISTS tradigo_coach_availability_exceptions (
  id text PRIMARY KEY,
  coach_id text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  kind text NOT NULL DEFAULT 'BLACKOUT',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tradigo_coach_availability_exceptions_coach_idx
  ON tradigo_coach_availability_exceptions(coach_id, starts_at, ends_at);
CREATE TABLE IF NOT EXISTS tradigo_coaching_policy_versions (
  id text PRIMARY KEY,
  version text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE',
  supported_countries text[] NOT NULL,
  allowed_categories text[] NOT NULL,
  blocked_terms text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tradigo_session_policy_decisions (
  id text PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  policy_version text NOT NULL,
  country_code text NOT NULL,
  coaching_category text NOT NULL,
  instrument_class text NOT NULL,
  decision text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'BOOKING',
  recorded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tradigo_marketplace_events (
  id text PRIMARY KEY,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  session_id text,
  actor_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS tradigo_marketplace_events_type_time_idx
  ON tradigo_marketplace_events(event_type, occurred_at);
CREATE INDEX IF NOT EXISTS tradigo_marketplace_events_session_time_idx
  ON tradigo_marketplace_events(session_id, occurred_at);