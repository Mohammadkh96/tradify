ALTER TABLE tradigo_sessions
  ADD COLUMN IF NOT EXISTS symbol text,
  ADD COLUMN IF NOT EXISTS coach_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS coach_claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS trader_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS trader_declined_at timestamptz;