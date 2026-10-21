ALTER TABLE tradigo_coaches
  ADD COLUMN IF NOT EXISTS approval_source text NOT NULL DEFAULT 'TRADIGO_MODERATION',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_verification_source text;

ALTER TABLE tradigo_coach_applications
  ADD COLUMN IF NOT EXISTS reviewer_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;