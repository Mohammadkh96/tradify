CREATE TABLE IF NOT EXISTS tradigo_coach_payout_accounts (
  coach_id text PRIMARY KEY,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'NOT_STARTED',
  provider_account_id text,
  onboarding_reference text,
  onboarding_url text,
  failure_code text,
  failure_message text,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS provider_batch_id text;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS provider_item_id text;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS hold_until timestamp with time zone;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS eligible_at timestamp with time zone;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS next_attempt_at timestamp with time zone;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS last_attempt_at timestamp with time zone;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS failure_code text;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS failure_message text;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS retryable boolean NOT NULL DEFAULT true;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS reversed_at timestamp with time zone;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS reversal_reason text;
ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS tradigo_payouts_execution_idx
  ON tradigo_payouts(status, next_attempt_at, hold_until);
CREATE INDEX IF NOT EXISTS tradigo_payouts_provider_reference_idx
  ON tradigo_payouts(provider_reference);
CREATE INDEX IF NOT EXISTS tradigo_payouts_provider_batch_idx
  ON tradigo_payouts(provider_batch_id);