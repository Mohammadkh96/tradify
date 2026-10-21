CREATE TABLE IF NOT EXISTS tradigo_identity_webhook_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  event_id text NOT NULL,
  application_id text,
  provider_reference text,
  decision text NOT NULL,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_at timestamp with time zone,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'RECEIVED',
  error text,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_identity_webhook_events_provider_event_idx
  ON tradigo_identity_webhook_events(provider, event_id);
CREATE INDEX IF NOT EXISTS tradigo_identity_webhook_events_application_idx
  ON tradigo_identity_webhook_events(application_id, received_at);