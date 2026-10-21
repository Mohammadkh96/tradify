ALTER TABLE tradigo_sessions
  ADD COLUMN IF NOT EXISTS booking_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS tradigo_sessions_booking_idempotency_key_idx
  ON tradigo_sessions(booking_idempotency_key);