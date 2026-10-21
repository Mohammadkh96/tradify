ALTER TABLE tradigo_identity_webhook_events ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE tradigo_identity_webhook_events ADD COLUMN IF NOT EXISTS last_attempt_at timestamp with time zone;
ALTER TABLE tradigo_identity_webhook_events ADD COLUMN IF NOT EXISTS last_actor_id text;
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_application_audit_identity_event_idx
  ON tradigo_application_audit(application_id, action, ((details->>'providerEventId')))
  WHERE action = 'IDENTITY_VERIFICATION_DECISION' AND details->>'providerEventId' IS NOT NULL;