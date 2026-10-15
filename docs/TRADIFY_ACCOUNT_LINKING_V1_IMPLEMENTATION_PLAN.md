# Tradify Journal–Signals V1 Linking: Journal Implementation Plan

**Status:** The Journal owner approves `tradify-account-linking-v1/revocation-retry-v1`. Signals previously reported acceptance, but both products must independently confirm this exact version before it is finalized. Journal's default-off implementation still requires schema, delivery, inbox, audit, and acknowledgement changes to comply.

**Scope:** Journal repository only. Signals changes remain the responsibility of the Signals Agent in the Signals project.

## 1. Interoperability preconditions

1. Use the agreed development identities: Signals issuer `https://linking-dev.signals.tradifyapp.com`, Journal issuer `https://linking-dev.journal.tradifyapp.com`, Signals-to-Journal audience `tradify-journal-link-v1-dev`, and Journal-to-Signals audience `tradify-signals-link-v1-dev`.
2. Signals' public signing key and `kid`, Journal's public signing key and `kid`, and the actual Signals HTTPS API base URL still require a secure exchange. Issuer URLs are not API URLs.
3. Both Journal and Signals independently confirm the exact version `tradify-account-linking-v1/revocation-retry-v1`; no real cross-service testing occurs before confirmation.
4. Use isolated development databases and synthetic `.invalid` accounts for contract testing. No production connection or customer records.
5. Store development-only configuration outside Git. Keep runtime feature flags default-off; never reuse production issuers, keys, audiences, or credentials.

Before bidirectional revocation tests, Journal must also establish its own exact development issuer and key ID, keep its private key in Journal's development secret store, and share only the corresponding public key with Signals through the approved secure configuration exchange.

The API, schema source, profile UI, and explicit manual outbox drain are implemented. Until these interoperability preconditions are met, keep the feature disabled and do not send service requests or expose the linking UI.

## 2. Work packages

### A. Freeze the development contract and fixtures

- Use `TRADIFY_ACCOUNT_LINKING_V1.md` as the shared source of truth.
- Use only the agreed development audience values; never substitute a guessed value.
- Create sanitized shared request/assertion fixtures after both agents agree on field names, error codes, and responses.
- Keep production/staging issuers, audiences, key sets, retention, and rollout outside this development plan.

### B. Replace the Journal prototype's data model

- `migrations/0002_tradify_account_linking_v1.sql` is the Journal-only source migration for authorization digests, separate initiation/final consent, link states, attempt labels, replay fingerprints, lifecycle timestamps, inbound/outbound revocation records, and deletion-safe tombstones. Tests apply it only to a disposable local database.
- Remove cascade behavior that could erase a pending revocation or replay/audit record when a Journal user is deleted.
- Store no raw authorization code, bearer assertion, private key, or Signals account data beyond the scoped opaque subject required by the contract.
- Enforce one active/pending association per Journal account and partner subject with database constraints.
- Set pending confirmation expiry no later than the original five-minute authorization expiry.

### C. Implement Journal server endpoints and validation

The default-off routes live in `server/product-linking-routes.ts`; assertion validation/signing lives in `server/product-linking-assertions.ts`. Keep the feature disabled by default and fail closed if development trust configuration is incomplete.

Implement the Journal-owned contract operations:

- Start authorization: verified Journal session, exact-origin/CSRF protection, explicit initiation consent, one-time code, digest-only persistence.
- Preview: validate the unconsumed code and return only the Journal attempt label and expiry; do not consume or extend it.
- Claim: validate the Signals RS256 assertion against the exact development issuer, confirmed audience, pinned `kid`, subject, consent, labels, code digest, and clock rules; atomically consume the code and create `awaiting_journal_confirmation`, not an active link.
- Final confirmation: require the initiating Journal account, exact pending link and pair, CSRF/origin checks, and separate final consent before activating.
- Customer status and service status: return only the scoped link state and timestamps; never disclose Journal IDs or email.
- Customer unlink and authenticated inbound revocation: transition locally to unusable `revocation_pending`, verify event replay/idempotency, and mark `revoked` only after the counterpart acknowledges.

Use only the agreed development audiences. Enforce the five-minute code expiry, 120-second assertion maximum, 30-second future issuance tolerance, strict expiration with zero grace, and operation-specific assertions. Reject audience arrays, unknown keys, incorrect actions, mismatched subjects, duplicate JSON keys, and altered replays.

### D. Add Journal customer experience

- Keep all linking UI absent unless the isolated development feature is explicitly enabled after the preconditions above are met.
- Show the Journal account locally, then show the Signals account using authenticated context and the paired attempt labels. Never display or request the other product's email or internal ID.
- Present separate initiation and final-confirmation consent. Use the Signals-reviewed wording from the contract, subject to product-owner copy approval.
- Transfer the code through manual entry/paste only. Do not place it in a URL, storage, cookie, analytics, logs, or automatic clipboard action; clear the input after submission.
- State clearly that each product has separate sign-in, subscriptions, trading records, and permissions, and that customers can disconnect later.

### E. Implement Journal-owned revocation delivery

- Journal owns its outbound transactional outbox and its authenticated inbound revocation handler. Signals owns its corresponding systems in its own repository.
- Persist the event and minimal tombstone before local account deletion/anonymization continues. Deletion must not wait for the remote service; do not cascade away the event.
- Keep the association unusable while `revocation_pending`; block replacement linking until acknowledgement/reconciliation.
- For development tests, use `drainProductLinkOutboxOnce` or the explicit `scripts/drain-product-link-outbox.ts` command. Do not add a timer to the web process or configure production background jobs. Persist the immutable JCS event payload/hash, issue a new 120-second assertion with a unique `jti` per attempt, deduplicate by event ID plus payload hash, and require matching hash acknowledgements.
- Keep synthetic audit data minimal and remove it at test-environment teardown. Do not choose production retention periods in this implementation.

### F. Verify with isolated development tests

Use two isolated development databases, synthetic `.invalid` accounts, ephemeral RSA keys, and mocked service-to-service calls. No live provider calls or production database access.

Required coverage:

- Default-off behavior and fail-closed behavior with missing trust configuration.
- Separate consent, exact account pairing, and Journal final confirmation required before activation.
- Authorization code expiry, one-time use, concurrent claims, exact retry, changed-claim replay, and code/subject substitution.
- Exact issuer/audience/`kid`/action validation; signature, clock-boundary, expiry, and maximum-lifetime failures.
- CSRF, origin, local-session, account-mismatch, rate-limit, response-redaction, and log-redaction checks.
- Unlink from either side, same-hash duplicate and changed-hash revocation events, mismatch audit, unavailable counterpart, fresh assertion per retry, mismatched acknowledgements, bounded backoff, suspension, account deletion without waiting, and recovery.
- Test teardown removes synthetic links, authorization data, replay records, and audit artifacts from the disposable environment.

The Signals Agent must run the matching contract tests against its own isolated database. Compare only sanitized contract fixtures and outcomes; do not access the Signals repository or database from Journal.

## 3. Completion gates

Journal development work is ready for review only when:

- Journal and Signals have independently confirmed the exact retry-v1 version; development keys, key IDs, and the Signals API base URL have been exchanged securely.
- The reviewed Journal migration has been applied only to an isolated development database.
- Journal and Signals contract tests pass with synthetic data, and default-off behavior is verified before and after testing.
- Manual/deterministic revocation draining is tested without a production worker.
- Both products show matching status, and logs/network traces contain no codes, JWTs, keys, cross-product emails, or local account IDs.

Completion does not authorize production configuration, feature activation, production migrations, customer-data changes, deployment, DNS changes, billing/email activity, or background jobs. Those require separate approval and a separate plan.
