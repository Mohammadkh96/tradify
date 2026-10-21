ALTER TABLE tradigo_sessions
  ADD COLUMN IF NOT EXISTS match_group_id text;

CREATE INDEX IF NOT EXISTS tradigo_sessions_match_group_idx
  ON tradigo_sessions(match_group_id, status);