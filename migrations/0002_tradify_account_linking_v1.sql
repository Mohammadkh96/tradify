-- Journal-local schema for the accepted, development-only V1 account-linking
-- contract. This source migration is applied only to isolated test databases.
-- It is never run on application startup; production linking remains disabled.

BEGIN;

CREATE TABLE IF NOT EXISTS product_link_authorizations (
  id UUID PRIMARY KEY,
  journal_user_role_id INTEGER NOT NULL REFERENCES user_role(id) ON DELETE CASCADE,
  authorization_code_sha256 CHAR(64) NOT NULL UNIQUE,
  journal_initiation_consent_version VARCHAR(64) NOT NULL,
  journal_initiation_consent_at TIMESTAMPTZ NOT NULL,
  journal_attempt_label VARCHAR(16) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + INTERVAL '5 minutes')
);

CREATE INDEX IF NOT EXISTS product_link_authorizations_user_expiry_idx
  ON product_link_authorizations (journal_user_role_id, expires_at);

CREATE INDEX IF NOT EXISTS product_link_authorizations_pending_idx
  ON product_link_authorizations (journal_user_role_id, created_at DESC)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS product_account_links (
  id UUID PRIMARY KEY,
  journal_user_role_id INTEGER NOT NULL REFERENCES user_role(id) ON DELETE RESTRICT,
  authorization_id UUID NOT NULL REFERENCES product_link_authorizations(id) ON DELETE CASCADE,
  partner_issuer TEXT NOT NULL,
  partner_subject VARCHAR(64),
  journal_attempt_label VARCHAR(16) NOT NULL,
  signals_attempt_label VARCHAR(16) NOT NULL,
  journal_initiation_consent_version VARCHAR(64) NOT NULL,
  journal_initiation_consent_at TIMESTAMPTZ NOT NULL,
  signals_consent_version VARCHAR(64) NOT NULL,
  signals_consent_at TIMESTAMPTZ NOT NULL,
  journal_confirmation_consent_version VARCHAR(64),
  journal_confirmation_consent_at TIMESTAMPTZ,
  state TEXT NOT NULL CHECK (
    state IN (
      'awaiting_journal_confirmation',
      'active',
      'revocation_pending',
      'revoked',
      'expired',
      'cancelled'
    )
  ),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (
    (state = 'active' AND linked_at IS NOT NULL AND journal_confirmation_consent_version IS NOT NULL
      AND journal_confirmation_consent_at IS NOT NULL)
    OR state <> 'active'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS product_account_links_journal_open_idx
  ON product_account_links (journal_user_role_id, partner_issuer)
  WHERE state IN ('awaiting_journal_confirmation', 'active', 'revocation_pending');

CREATE UNIQUE INDEX IF NOT EXISTS product_account_links_partner_open_idx
  ON product_account_links (partner_issuer, partner_subject)
  WHERE partner_subject IS NOT NULL
    AND state IN ('awaiting_journal_confirmation', 'active', 'revocation_pending');

CREATE INDEX IF NOT EXISTS product_account_links_user_state_idx
  ON product_account_links (journal_user_role_id, state, created_at DESC);

CREATE TABLE IF NOT EXISTS product_link_assertion_replays (
  partner_issuer TEXT NOT NULL,
  audience TEXT NOT NULL,
  assertion_jti VARCHAR(128) NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('claim', 'status', 'revoke')),
  assertion_sha256 CHAR(64) NOT NULL,
  authorization_code_sha256 CHAR(64),
  link_id UUID NOT NULL,
  key_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (partner_issuer, audience, assertion_jti)
);

CREATE INDEX IF NOT EXISTS product_link_assertion_replays_created_idx
  ON product_link_assertion_replays (created_at);

CREATE TABLE IF NOT EXISTS product_link_revocation_outbox (
  event_id UUID PRIMARY KEY,
  link_id UUID NOT NULL,
  partner_issuer TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('user_unlinked', 'account_deleted', 'account_suspended', 'security_action')
  ),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'retry', 'delivered')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  last_error_code VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS product_link_revocation_outbox_due_idx
  ON product_link_revocation_outbox (next_attempt_at, created_at)
  WHERE state IN ('pending', 'retry');

CREATE TABLE IF NOT EXISTS product_link_revocation_inbox (
  partner_issuer TEXT NOT NULL,
  event_id UUID NOT NULL,
  link_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('user_unlinked', 'account_deleted', 'account_suspended', 'security_action')
  ),
  assertion_sha256 CHAR(64) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (partner_issuer, event_id)
);

CREATE TABLE IF NOT EXISTS product_link_tombstones (
  link_id UUID PRIMARY KEY,
  partner_issuer TEXT NOT NULL,
  event_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('user_unlinked', 'account_deleted', 'account_suspended', 'security_action')
  ),
  tombstoned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
