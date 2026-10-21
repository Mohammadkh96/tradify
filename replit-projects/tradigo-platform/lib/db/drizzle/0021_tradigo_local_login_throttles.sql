CREATE TABLE IF NOT EXISTS tradigo_local_login_throttles (
  key_hash text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tradigo_local_login_throttles_updated_idx
  ON tradigo_local_login_throttles (updated_at);