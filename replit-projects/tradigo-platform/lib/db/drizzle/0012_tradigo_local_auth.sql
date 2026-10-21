ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS email_normalized text;
ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS local_session_version integer NOT NULL DEFAULT 0;
ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS consent_accepted_at timestamp with time zone;
ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS consent_version text;

UPDATE tradigo_users
SET email_normalized = LOWER(TRIM(email))
WHERE email_normalized IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tradigo_users_email_normalized_idx
  ON tradigo_users(email_normalized);