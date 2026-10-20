-- Journal-local durable revocation retry contract. Apply only to an approved
-- isolated development database; it is not part of ordinary app startup.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE product_link_revocation_outbox
  ADD COLUMN IF NOT EXISTS canonical_payload TEXT,
  ADD COLUMN IF NOT EXISTS payload_hash CHAR(64);

UPDATE product_link_revocation_outbox
   SET canonical_payload =
         '{"contractVersion":"tradify-account-linking-v1","eventId":' ||
         to_json(event_id::text)::text ||
         ',"linkId":' || to_json(link_id::text)::text ||
         ',"reason":' || to_json(reason)::text || '}'
 WHERE canonical_payload IS NULL OR payload_hash IS NULL;

UPDATE product_link_revocation_outbox
   SET payload_hash = encode(digest(canonical_payload, 'sha256'), 'hex')
 WHERE payload_hash IS NULL;

ALTER TABLE product_link_revocation_outbox
  ALTER COLUMN canonical_payload SET NOT NULL,
  ALTER COLUMN payload_hash SET NOT NULL;

ALTER TABLE product_link_revocation_outbox
  DROP CONSTRAINT IF EXISTS product_link_revocation_outbox_state_check;

ALTER TABLE product_link_revocation_outbox
  ADD CONSTRAINT product_link_revocation_outbox_state_check
  CHECK (state IN ('pending', 'retry', 'delivered', 'blocked'));

ALTER TABLE product_link_revocation_inbox
  ADD COLUMN IF NOT EXISTS canonical_payload TEXT,
  ADD COLUMN IF NOT EXISTS payload_hash CHAR(64);

UPDATE product_link_revocation_inbox
   SET canonical_payload =
         '{"contractVersion":"tradify-account-linking-v1","eventId":' ||
         to_json(event_id::text)::text ||
         ',"linkId":' || to_json(link_id::text)::text ||
         ',"reason":' || to_json(reason)::text || '}'
 WHERE canonical_payload IS NULL OR payload_hash IS NULL;

UPDATE product_link_revocation_inbox
   SET payload_hash = encode(digest(canonical_payload, 'sha256'), 'hex')
 WHERE payload_hash IS NULL;

ALTER TABLE product_link_revocation_inbox
  ALTER COLUMN canonical_payload SET NOT NULL,
  ALTER COLUMN payload_hash SET NOT NULL;

CREATE TABLE IF NOT EXISTS product_link_revocation_mismatches (
  id BIGSERIAL PRIMARY KEY,
  partner_issuer TEXT NOT NULL,
  event_id UUID NOT NULL,
  link_id UUID NOT NULL,
  expected_payload_hash CHAR(64) NOT NULL,
  received_payload_hash CHAR(64) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_link_revocation_mismatches_event_idx
  ON product_link_revocation_mismatches (partner_issuer, event_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION reject_product_link_revocation_payload_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.link_id IS DISTINCT FROM OLD.link_id
     OR NEW.partner_issuer IS DISTINCT FROM OLD.partner_issuer
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.canonical_payload IS DISTINCT FROM OLD.canonical_payload
     OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash THEN
    RAISE EXCEPTION 'Revocation event payload is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_link_revocation_payload_immutable
  ON product_link_revocation_outbox;

CREATE TRIGGER product_link_revocation_payload_immutable
BEFORE UPDATE ON product_link_revocation_outbox
FOR EACH ROW EXECUTE FUNCTION reject_product_link_revocation_payload_change();

COMMIT;
