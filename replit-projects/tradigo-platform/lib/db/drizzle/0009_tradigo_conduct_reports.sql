CREATE TABLE IF NOT EXISTS tradigo_conduct_reports (
  id text PRIMARY KEY,
  reporter_id text NOT NULL,
  subject_user_id text NOT NULL,
  session_id text,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  evidence_reference text,
  idempotency_key text,
  status text NOT NULL DEFAULT 'OPEN',
  resolved_by text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE tradigo_conduct_reports ADD COLUMN IF NOT EXISTS evidence_reference text;
ALTER TABLE tradigo_conduct_reports ADD COLUMN IF NOT EXISTS idempotency_key text;
UPDATE tradigo_conduct_reports SET idempotency_key = id WHERE idempotency_key IS NULL;
ALTER TABLE tradigo_conduct_reports ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tradigo_conduct_reports_idempotency_key_idx
  ON tradigo_conduct_reports(idempotency_key);
CREATE INDEX IF NOT EXISTS tradigo_conduct_reports_queue_idx
  ON tradigo_conduct_reports(status, created_at DESC);
