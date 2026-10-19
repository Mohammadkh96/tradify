# Tradify Journal–Signals V1 Linking: Journal Implementation Plan

**Status:** Journal accepts and implements `tradify-account-linking-v1/revocation-retry-v1`. The Signals Agent reports that Signals has implemented and tested the same rule and independently accepts it. Live cross-service testing remains blocked by development signing-key isolation and secure trust configuration.

**Scope:** Journal repository only. Signals changes remain the responsibility of the Signals Agent in the Signals project.

## 1. Interoperability preconditions

1. Use the agreed development identities: Signals issuer `https://linking-dev.signals.tradifyapp.com`, Journal issuer `https://linking-dev.journal.tradifyapp.com`, Signals-to-Journal audience `tradify-journal-link-v1-dev`, and Journal-to-Signals audience `tradify-signals-link-v1-dev`. These non-secret identifiers are configured in Journal Development only.
2. Signals' public signing key and `kid`, and Journal's public signing key and `kid`, still require secure exchange. The Signals HTTPS API origin is configured in Journal Development and both `/api/health` endpoints returned HTTP 200 on 2026-10-19; revalidate the origins and verify authenticated linking routes before integration tests. Issuer URLs are not API URLs. No Journal signing key is configured. Replit may sync Development secrets into deployment settings when publishing; verify the Production deployment secret list explicitly before any future Development private-key configuration.
3. Both Journal and Signals have independently confirmed the exact version `tradify-account-linking-v1/revocation-retry-v1`. No live cross-service request is authorized until the development trust configuration and API endpoint are securely verified.
4. Use isolated development databases and synthetic `.invalid` accounts for contract testing. No production connection or customer records.
5. Store development-only configuration outside Git. Keep runtime feature flags default-off; never reuse production issuers, keys, audiences, or credentials.

Before bidirectional revocation tests, Journal must create a synthetic Development keypair with a new immutable `kid`, verify the private key is absent from Production deployment settings, and share only the corresponding public key with Signals through the approved secure configuration exchange. Do not configure a permanent Journal private key for this test milestone.

The API, schema source, profile UI, and explicit manual outbox drain are implemented. Until these interoperability preconditions are met, keep the feature disabled and do not send service requests or expose the linking UI.

## 2. Work packages

### A. Freeze the development contract and fixtures

- Use `TRADIFY_ACCOUNT_LINKING_V1.md` as the shared source of truth.
- Use only the agreed development audience values; never substitute a guessed value.
- Create sanitized shared request/assertion fixtures after both agents agree on field names, error codes, and responses.
- Keep production/staging issuers, audiences, key sets, retention, and rollout outside this development plan.

### B. Replace the Journal prototype's data model

- `migrations/0002_tradify_account_linking_v1.sql` and `migrations/0003_product_link_revocation_retry_v1.sql` are Journal-only source migrations for authorization digests, consent, link states, replay protection, lifecycle records, immutable canonical revocation payloads and hashes, mismatch auditing, and deletion-safe tombstones. Tests apply them only to a disposable local database.
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
- Present separate initiation and final-confirmation consent using the approved shared copy in Section 3 of the contract. The Signals Agent owns the Signals UI implementation. Keep the Journal UI absent until all development trust gates are satisfied and linking is explicitly enabled for isolated testing.
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

- Journal and Signals have independently confirmed the exact retry-v1 version.
- Both development public keys and immutable key IDs are securely exchanged and pinned. The Signals API origin is revalidated, and authenticated linking routes are verified over HTTPS before any real cross-service test.
- The reviewed Journal migration has been applied only to an isolated development database.
- Journal and Signals contract tests pass with synthetic data, and default-off behavior is verified before and after testing.
- Manual/deterministic revocation draining is tested without a production worker.
- Both products show matching status, and logs/network traces contain no codes, JWTs, keys, cross-product emails, or local account IDs.

Completion does not authorize production configuration, feature activation, production migrations, customer-data changes, deployment, DNS changes, billing/email activity, or background jobs. Those require separate approval and a separate plan.

## 4. Current production status and future gate plan

### Current implementation

- `server/routes.ts` mounts `registerProductLinkingRoutes` from `server/product-linking-routes.ts`.
- The active route `isEnabled()` calls `getSignalsKeyring()`. Both `getSignalsKeyring()` and `getJournalSigningConfig()` in `server/product-linking-assertions.ts` require `NODE_ENV=development` or `test`, `APP_ENV` not equal to `production`, and `DEV_PRODUCT_LINKING_ENABLED=true`.
- `assertManualDevelopmentContext()` in `server/product-linking-outbox.ts` rejects production and requires the same development flag. The web process does not schedule the outbox drain.
- `assertDevelopmentSigningKeyNotInProduction()` in `server/index.ts` rejects a production startup that contains the development-prefixed or legacy Journal private-key variable.
- Consequently, the active V1 route/keyring/signing/outbox path is development/test-only and returns/behaves disabled in production. The earlier contract wording that `PRODUCT_LINKING_ENABLED=true`, `PRODUCT_LINKING_VERIFIED=true`, and `TRADIFY_SIGNALS_*` values enable production is inaccurate. The active V1 code does not read those production flags. Do not set them expecting linking to work.

### Exact code changes required for a future production release

These are planning notes only. Do not implement, configure, or activate them as part of this documentation change.

1. **Add a separate production configuration path** in `server/product-linking-assertions.ts`, rather than loosening `enabledForIsolatedDevelopment()`. Require production runtime, two explicitly approved production enablement/verification controls, the exact production issuer and directional audiences, pinned production partner key IDs/public keys, and a separate Production-only Journal signing key. Do not fall back to Development values. The production secret variable names and the meaning/owner of the verification control must be approved before implementation.
2. **Keep the route fail-closed** in `server/product-linking-routes.ts`: resolve a complete environment-specific config, return disabled when either gate is off or any required value is absent/mismatched, and prevent Development and Production trust sets from mixing.
3. **Preserve and extend startup checks** in `server/index.ts`: keep rejecting development/legacy private keys in Production; if production linking is explicitly enabled, validate the complete Production trust configuration before serving requests. Never log key material.
4. **Keep outbox execution separately controlled** in `server/product-linking-outbox.ts`: the current manual drain remains development/test-only. A future production dispatcher requires a separately reviewed and approved execution mechanism, bounded retry, idempotent leasing, monitoring, and an operator stop control. Do not add a web-process timer.
5. **Add an isolated production-config test matrix** in `server/security.integration.test.ts`: default-off production behavior; missing/invalid flag and trust values; no dev-key fallback; development key rejected in production; valid synthetic production configuration; route and dispatcher behavior. Use synthetic keys and no production database.
6. **Review operations separately:** approve reviewed migrations, recovery/rollback, retention, alerting, key rotation/revocation, and rollout. Apply no production migration until the recovery plan and explicit approval are in place.

The flag names previously shown in this contract (`PRODUCT_LINKING_ENABLED` and `PRODUCT_LINKING_VERIFIED`) are candidate names only; they are not implemented controls today. Do not configure them until the future production gate is implemented, tested, and approved.

## 5. Development-to-production checklist

### Development integration — still blocked

- [x] Product owner approved the consent, pairing, separate-authentication/subscription, metadata-sharing, and disconnect/revocation wording for isolated development in both products on 2026-10-19. The Signals Agent owns its UI implementation; recovery-flow details remain outside this copy approval.
- [ ] Generate a synthetic Journal Development keypair with a new immutable `kid`, verify its private key is absent from Production deployment settings before use, and exchange only the public key with Signals. Obtain and pin Signals' development public key and immutable `kid`. Do not configure a permanent Journal signing key for this milestone.
- [x] Configure the Signals development HTTPS API origin and non-secret development issuer/audience values in Journal Development only. Both API health endpoints returned HTTP 200 on 2026-10-19; revalidate the origins before integration testing.
- [ ] Verify authenticated linking routes over HTTPS and complete the reciprocal public-key/`kid` exchange. Issuer values identify signers; they are not API endpoints.
- [ ] Run real Journal↔Signals contract tests using separate isolated development databases and synthetic accounts. Preserve the five-minute authorization deadline and accepted retry-v1 behavior; verify consent, expiry, replay, matching acknowledgements, changed-hash 409/audit, and lifecycle revocations.
- [ ] Fix the unrelated MT5 bridge and PayPal test-fixture failures documented in Section 10 of `TRADIFY_ACCOUNT_LINKING_V1.md`; do not weaken or bypass those checks.

### Production — future approval required

- [ ] Implement and review the explicit Production gate and tests listed above. Leave all production controls unset and linking disabled until that work is approved.
- [ ] Provision distinct Production trust identities and keys through secure Production configuration; verify Development keys and endpoints cannot be selected by Production.
- [ ] Approve production migrations, recovery point, rollback procedure, audit retention, monitoring, and an operator-controlled outbox dispatcher.
- [ ] Obtain separate owner approval before configuring Production secrets/flags, applying migrations, enabling the feature, starting any worker, or deploying.

This plan preserves the accepted `tradify-account-linking-v1/revocation-retry-v1` rule and the original five-minute authorization deadline. It does not authorize feature activation, production changes, or changes to Signals.
