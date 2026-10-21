# Tradify Signals ↔ Journal V1 Test Readiness

**Reviewed:** 2026-10-19
**Decision:** Signals Phase B is ready on an isolated local database. **Cross-service requests remain blocked** until Journal confirms its Phase B API is running with the Signals pin.

## Latest Journal session handoff

The previous Journal handoff supplied origin `https://d249d3f6-43db-41f6-9a74-d7c50aa6969b-00-1iqop82skn7hh.spock.replit.dev`, claim route `/api/v1/product-links/signals/claim`, issuer `https://linking-dev.journal.tradifyapp.com`, audience `tradify-signals-link-v1-dev`, and test `kid` `journal-link-test-20261019T082657Z-5f3db8da7e4c4aa9`. Its expiry was **2026-10-19 10:26:57 UTC**. This is the old session and must not be used for the new two-phase bootstrap.

The first Signals Phase B signer was retired after the reciprocal-bootstrap instructions arrived. Signals then generated a fresh keypair and held the private key in the Phase A supervisor. The new Journal public key and `kid` were validated and pinned locally; the API started without regenerating the Signals key. The earlier false predicate was an audience-direction mismatch in `linkingConfigurationReady()`: incoming Journal assertions must target the Signals audience, while outgoing Signals assertions must target the Journal audience. This is fixed without weakening the feature gate.

The first diagnostic also revealed that the generic test runner removed `NEON_DATABASE_URL` but not `NEON_DEVELOPMENT_DATABASE_URL`. That diagnostic's app-side pool therefore used the configured Neon development connection for a read-only `SELECT current_database()`; it issued no writes. The earlier pre-fix linking run cannot be certified as isolated, and writes from it cannot be ruled out. The disposable test runners now remove both Neon overrides. A fresh readiness diagnostic and the linking suite then passed against disposable database `tradify_test_5357_401e8f31`, which the runner dropped afterward. A follow-up check of Neon branch metrics and query logs found no recorded write bytes or log rows in the reviewed window, but does not prove the earlier run made no writes; the secret-to-project mapping was not inspected, and no customer rows were queried.

The active Signals identity is `signals-link-test-20261019T101821Z-c6f8d3979d2e`, issuer `https://linking-dev.signals.tradifyapp.com`, audience `tradify-journal-link-v1-dev`. The new pinned Journal identity is `journal-link-test-20261019T103948Z-4424898016c6a893`. Journal expires at **2026-10-19 12:06:00 UTC**; Signals expires earlier, so the effective deadline is **2026-10-19 11:18:21.376 UTC**. The existing Signals private key was retained across the Phase A→B transition.

## Verified in this workspace

- `pnpm --filter @workspace/api-server run test:product-linking` passed.
- After the Neon override fix, the guarded runner verified `heliumdb`, created a disposable `tradify_test_*` database, applied schema, ran the diagnostic and linking test, and dropped it. The earlier pre-fix run is not accepted as isolation evidence.
- The test covers inbound Journal revocation assertion validation, replay/conflict handling, duplicate-event behavior, acknowledgement hash validation, revocation queueing, and the database-name fail-closed check.
- The test is **not** a cross-service test: it creates temporary keys inside the test process and calls Signals over loopback HTTP. It does not contact Journal or establish reciprocal trust.
- No production environment, deployment, Journal repository, or Journal database was changed.

## Signals endpoints and authentication

Use the Signals development HTTPS origin with this API prefix:

`/api/v1`

| Method and path | Purpose | Authentication |
| --- | --- | --- |
| `GET /api/v1/product-links/journal` | Read current link status | Authenticated Signals customer session: `Authorization: Bearer …` or the customer session cookie |
| `POST /api/v1/product-links/journal/preview` | Preview a Journal code and labels | Same customer authentication; cookie mutations require same-origin checks. JSON: `contractVersion`, 64-character lowercase-hex `authorizationCode` |
| `POST /api/v1/product-links/journal/claim` | Record consent and claim the pairing | Same customer authentication and same-origin checks for cookie sessions. JSON additionally requires `consent: true` and `consentVersion: "tradify-signals-link-consent-v1"` |
| `DELETE /api/v1/product-links/journal/{linkId}` | Queue unlink/revocation | Same customer authentication and same-origin checks for cookie sessions |
| `POST /api/v1/product-links/journal/revocations` | Receive Journal service revocation | Journal-signed RS256 Bearer assertion; product-session cookies are rejected |

The incoming Journal assertion must pin `kid` and verify issuer `https://linking-dev.journal.tradifyapp.com`, audience `tradify-signals-link-v1-dev`, subject `tradify-journal-link-service`, action `revoke`, contract `tradify-account-linking-v1`, a unique `jti`, and a maximum 120-second assertion lifetime.

Signals outbound assertions use issuer `https://linking-dev.signals.tradifyapp.com` and audience `tradify-journal-link-v1-dev`. These are current code constants, not confirmation of Journal's acceptance.

## Safety gate and disposable HTTPS setup

The linking feature is enabled only when all of these hold: non-production runtime, `TRADIFY_ACCOUNT_LINKING_ENABLED=true`, `TRADIFY_ACCOUNT_LINKING_TEST_MODE=true`, and `PGDATABASE` matching `tradify_test_[0-9]+_[a-f0-9]{8}`. The issuer/audience gate now maps Journal-to-Signals inbound values and Signals-to-Journal outbound values to the correct service constants. Do not remove or relax this gate.

The current `lib/db/run-test-suite.mjs` safely provisions a uniquely named `tradify_test_*` database from the verified development connection, removes both Neon URL overrides from child environments, directs schema setup and tests to the disposable database, and drops it afterward. It is suitable for bounded automated tests, **not** for a coordinated test that needs an API to remain available.

Phase B created local database `tradify_test_7255_b9ef49ac` in a temporary PostgreSQL cluster under `/tmp`, bound only to `127.0.0.1`. Both Neon URL overrides are absent from the API child; it receives a minimal environment with the local-only `DATABASE_URL`. Pre-migration, post-migration, and in-process database checks passed. The parent supervisor stops the API and removes this database at the effective deadline. Do not publish or use the normal Neon-backed API.

Peer keys were accepted only over the local Unix socket inside a mode-0700 directory; the socket itself was mode 0600. The health route is HTTPS and the account API is now running. `GET /api/v1/product-links/journal` and unauthenticated `POST /api/v1/product-links/journal/preview` returned 401, confirming route registration and authentication. No claim, consent, or other cross-service request was sent.

## Authenticated visual verification

The existing isolated browser harness can register a synthetic `@example.test` customer and confirm an authenticated session against its disposable database. It routes the preview app and API to local test processes and blocks other external hosts, so it can support a visual check without real customer data.

It currently provisions `tradify_browser_*`, while the linking feature deliberately requires `tradify_test_*`; therefore the live link API remains disabled in that harness. The harness also does not currently navigate to `/app/journal-link`. A signed-in visual check is feasible with a dedicated visual-only fixture for the link-status response, clearly marked as mocked, or with a real isolated linking API after trust setup. No authenticated screenshot was taken in this run, and a mocked visual fixture must not be reported as endpoint or cross-service verification.

## Route and retry review

- Preview returns an existing attempt's stored expiry and rejects an expired attempt. New preview responses are rejected if the expiry is expired or more than five minutes ahead.
- Claim checks the stored original attempt expiry before recording consent, uses a persisted claim `jti`/issue time on retries, and validates that Journal returns the same expiry. UI expiry is not the security boundary.
- Authenticated status reads are account-scoped; suspended and banned accounts are denied by the shared customer-auth middleware.
- Unlink marks the link `revocation_pending` and queues a canonical event. The link remains unusable pending acknowledgement.
- The outbox retries failed sends with bounded exponential backoff (30 seconds up to 60 minutes) and accepts delivery only when the Journal acknowledgement event ID and payload hash match.
- No `revocation-retry-v1` identifier was found in the Signals source. The behavior present is the outbox retry mechanism described above.
- The current automated linking suite does **not** cover preview/claim consent and five-minute deadline behavior, a live HTTPS call, or retry scheduling against Journal. Those remain unverified.

## Blockers and Journal Agent actions

1. Journal must confirm its Phase B API is running with the exact Signals public PEM and `kid` from Phase A.
2. Keep both APIs running only until the effective deadline. Do not restart either one.
3. Only after both projects explicitly confirm READY, run the coordinated synthetic-account HTTPS flow. Never export private material or put it in Shared/Production secrets.
4. Extend isolated tests to cover preview, consent/claim, expiry, account-status denial, unlink, and retry scheduling before treating those behaviors as verified end to end.

No cross-service request has been sent. The Signals public PEM and immutable `kid` were provided to the user for Journal's pin. The private key exists only in the active isolated runtime and is destroyed at expiry or process stop.

The Phase B API has both exact peer identities configured before startup; its active signer self-test and database isolation checks passed. Keep private signing material only in the active isolated supervisor/API process; never export it or store it in Shared/Production secrets.
