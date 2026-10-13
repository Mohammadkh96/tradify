BEGIN;

CREATE TABLE IF NOT EXISTS background_job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  run_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'uncertain')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expires_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  duration_ms BIGINT,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT background_job_runs_name_key_unique UNIQUE (job_name, run_key)
);

CREATE INDEX IF NOT EXISTS background_job_runs_status_retry_idx
  ON background_job_runs (status, next_retry_at);

CREATE TABLE IF NOT EXISTS email_delivery_outbox (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'retry', 'sent', 'failed', 'uncertain')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expires_at TIMESTAMPTZ,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS email_delivery_outbox_due_idx
  ON email_delivery_outbox (next_attempt_at, id)
  WHERE status IN ('queued', 'retry');

COMMIT;
