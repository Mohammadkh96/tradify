-- Safe for development databases that may already contain the first migration.
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS agenda text;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS rate_snapshot_cents integer NOT NULL DEFAULT 0;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS authorized_amount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS final_amount_cents integer;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS billable_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS platform_fee_cents integer NOT NULL DEFAULT 0;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS coach_net_cents integer NOT NULL DEFAULT 0;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS attendance_finalized_at timestamp with time zone;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS end_requested_at timestamp with time zone;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS end_requested_by text;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS end_reason text;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS no_show_type text;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS rescheduled_from timestamp with time zone;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'NOT_READY';
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS dispute_status text NOT NULL DEFAULT 'NONE';
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE tradigo_coaches ADD COLUMN IF NOT EXISTS teaching_method text;
ALTER TABLE tradigo_coaches ADD COLUMN IF NOT EXISTS coaching_boundaries text;
ALTER TABLE tradigo_coaches ADD COLUMN IF NOT EXISTS pending_headline text;
ALTER TABLE tradigo_coaches ADD COLUMN IF NOT EXISTS pending_bio text;
ALTER TABLE tradigo_coaches ADD COLUMN IF NOT EXISTS pending_teaching_method text;
ALTER TABLE tradigo_coaches ADD COLUMN IF NOT EXISTS pending_coaching_boundaries text;
ALTER TABLE tradigo_coaches ADD COLUMN IF NOT EXISTS profile_change_status text NOT NULL DEFAULT 'CURRENT';
CREATE TABLE IF NOT EXISTS tradigo_learning_records (
  id text PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  trader_id text NOT NULL,
  coach_id text NOT NULL,
  learning_goal text NOT NULL,
  concepts_reviewed text,
  evidence_discussed text,
  practice_steps text,
  status text NOT NULL DEFAULT 'GOAL_SET',
  coach_completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tradigo_learning_records_trader_idx ON tradigo_learning_records(trader_id, created_at);
CREATE INDEX IF NOT EXISTS tradigo_learning_records_coach_idx ON tradigo_learning_records(coach_id, created_at);

CREATE TABLE IF NOT EXISTS tradigo_rate_snapshots (id text PRIMARY KEY, session_id text NOT NULL, coach_id text NOT NULL, rate_cents integer NOT NULL, currency text NOT NULL, policy jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tradigo_payment_intents (id text PRIMARY KEY, session_id text NOT NULL, provider text NOT NULL, provider_reference text, kind text NOT NULL, amount_cents integer NOT NULL, currency text NOT NULL, status text NOT NULL, idempotency_key text NOT NULL UNIQUE, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tradigo_attendance_events (id text PRIMARY KEY, session_id text NOT NULL, participant_id text NOT NULL, event_type text NOT NULL, occurred_at timestamp with time zone NOT NULL, source text NOT NULL, idempotency_key text NOT NULL UNIQUE, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tradigo_ledger_entries (id text PRIMARY KEY, session_id text NOT NULL, entry_type text NOT NULL, account text NOT NULL, amount_cents integer NOT NULL, currency text NOT NULL, idempotency_key text NOT NULL UNIQUE, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tradigo_reviews (id text PRIMARY KEY, session_id text NOT NULL UNIQUE, trader_id text NOT NULL, coach_id text NOT NULL, rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5), comment text, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tradigo_disputes (id text PRIMARY KEY, session_id text NOT NULL, opened_by text NOT NULL, reason text NOT NULL, status text NOT NULL DEFAULT 'OPEN', resolution text, resolved_by text, resolved_at timestamp with time zone, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tradigo_payouts (id text PRIMARY KEY, session_id text NOT NULL UNIQUE, coach_id text NOT NULL, amount_cents integer NOT NULL, currency text NOT NULL, status text NOT NULL, provider_reference text, created_at timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tradigo_payment_webhook_events (id text PRIMARY KEY, event_id text NOT NULL UNIQUE, event_type text NOT NULL, resource_id text, session_id text, status text NOT NULL, error text, payload jsonb NOT NULL DEFAULT '{}'::jsonb, received_at timestamp with time zone NOT NULL DEFAULT now(), processed_at timestamp with time zone);
CREATE INDEX IF NOT EXISTS tradigo_attendance_events_session_idx ON tradigo_attendance_events(session_id, occurred_at);
CREATE INDEX IF NOT EXISTS tradigo_ledger_entries_session_idx ON tradigo_ledger_entries(session_id);
CREATE INDEX IF NOT EXISTS tradigo_payment_intents_session_idx ON tradigo_payment_intents(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_payment_intents_idempotency_key_idx ON tradigo_payment_intents(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_attendance_events_idempotency_key_idx ON tradigo_attendance_events(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_ledger_entries_idempotency_key_idx ON tradigo_ledger_entries(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_payouts_session_id_idx ON tradigo_payouts(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_reviews_session_id_idx ON tradigo_reviews(session_id);
CREATE INDEX IF NOT EXISTS tradigo_payment_webhook_events_status_idx ON tradigo_payment_webhook_events(status, received_at);
CREATE INDEX IF NOT EXISTS tradigo_payment_webhook_events_session_idx ON tradigo_payment_webhook_events(session_id, received_at);