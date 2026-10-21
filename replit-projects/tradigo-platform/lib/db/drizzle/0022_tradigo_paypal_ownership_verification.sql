ALTER TABLE tradigo_coach_payout_accounts
  ADD COLUMN IF NOT EXISTS ownership_verified_at timestamp with time zone;

ALTER TABLE tradigo_coach_payout_accounts
  ADD COLUMN IF NOT EXISTS ownership_verification_source text;