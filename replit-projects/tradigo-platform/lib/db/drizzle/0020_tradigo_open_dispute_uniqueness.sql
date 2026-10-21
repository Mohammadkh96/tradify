CREATE UNIQUE INDEX IF NOT EXISTS tradigo_disputes_one_open_per_session_idx
  ON tradigo_disputes (session_id)
  WHERE status = 'OPEN';