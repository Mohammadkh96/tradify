ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS tradigo_auth_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  token_hash text NOT NULL,
  token_kind text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  activated_at timestamp with time zone,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE tradigo_auth_tokens ADD COLUMN IF NOT EXISTS activated_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS tradigo_auth_tokens_hash_idx
  ON tradigo_auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS tradigo_auth_tokens_user_kind_idx
  ON tradigo_auth_tokens(user_id, token_kind, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS tradigo_auth_tokens_one_active_idx
  ON tradigo_auth_tokens(user_id, token_kind)
  WHERE activated_at IS NOT NULL AND consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS tradigo_auth_email_outbox (
  id text PRIMARY KEY,
  token_id text NOT NULL,
  user_id text NOT NULL,
  email_kind text NOT NULL,
  recipient text NOT NULL,
  recipient_name text NOT NULL,
  encrypted_token text NOT NULL,
  action_base_url text NOT NULL,
  expires_in_hours integer NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tradigo_auth_email_outbox_pending_idx
  ON tradigo_auth_email_outbox(next_attempt_at, created_at)
  WHERE sent_at IS NULL;