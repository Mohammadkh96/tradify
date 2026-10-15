-- Journal-local storage for the proposed, versioned Signals account-linking contract.
-- This migration is not applied automatically. Production linking remains disabled.

CREATE TABLE IF NOT EXISTS product_link_authorizations (
  id UUID PRIMARY KEY,
  journal_user_role_id INTEGER NOT NULL REFERENCES user_role(id) ON DELETE CASCADE,
  authorization_code_sha256 CHAR(64) NOT NULL UNIQUE,
  consent_version VARCHAR(64) NOT NULL,
  journal_consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS product_link_authorizations_user_expiry_idx
  ON product_link_authorizations (journal_user_role_id, expires_at);

CREATE TABLE IF NOT EXISTS product_account_links (
  id UUID PRIMARY KEY,
  journal_user_role_id INTEGER NOT NULL REFERENCES user_role(id) ON DELETE CASCADE,
  partner_issuer TEXT NOT NULL,
  partner_subject VARCHAR(255) NOT NULL,
  consent_version VARCHAR(64) NOT NULL,
  journal_consent_at TIMESTAMPTZ NOT NULL,
  partner_consent_at TIMESTAMPTZ NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS product_account_links_journal_active_idx
  ON product_account_links (journal_user_role_id, partner_issuer)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_account_links_partner_active_idx
  ON product_account_links (partner_issuer, partner_subject)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS product_account_links_user_idx
  ON product_account_links (journal_user_role_id, linked_at DESC);

CREATE TABLE IF NOT EXISTS product_link_assertion_replays (
  id BIGSERIAL PRIMARY KEY,
  partner_issuer TEXT NOT NULL,
  assertion_jti VARCHAR(128) NOT NULL,
  authorization_id UUID NOT NULL REFERENCES product_link_authorizations(id) ON DELETE CASCADE,
  authorization_code_sha256 CHAR(64) NOT NULL,
  link_id UUID NOT NULL REFERENCES product_account_links(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_issuer, assertion_jti)
);
