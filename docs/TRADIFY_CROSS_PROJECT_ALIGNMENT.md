# Tradify Cross-Project Alignment Checklist

**Purpose:** Coordinate Tradify Journal and Tradify Signals without combining their services, databases, authentication, billing, or release ownership.

**Authority:** This is a coordination checklist, not a new technical contract. The linked product specifications remain authoritative. Do not infer permission to deploy, share data, or enable a feature from a checked item here.

## Product and ownership boundaries

| Area | Journal | Signals | Shared rule |
| --- | --- | --- | --- |
| Parent identity | Tradify Journal; preserve dark/emerald identity | Tradify Signals; preserve navy/gold/teal identity and its own assets | Parent branding does not merge the products |
| User accounts and sign-in | Journal-owned | Signals-owned | Keep separate authentication and account recovery |
| Database and customer records | Journal database | Signals database | Keep databases separate; do not copy or merge records |
| Billing and entitlements | Journal-owned plans and checkout | Signals-owned plans and checkout | No invented bundle or cross-product entitlement |
| MT5 trade history | Journal-owned, existing all-symbol sync | Not authorized by account linking | Never treat account linking as data-sharing consent |
| Strategy engine and Signals subscriptions | Not owned by Journal | Signals-owned | Signals decides its strategy processing and subscription rules |
| Tradigo | Reserved for future integration | Reserved for future integration | Do not present it as currently available |

## Readiness by workstream

| Workstream | Source of truth | Current status | Gate before advancing |
| --- | --- | --- | --- |
| Parent brand | [Tradify Brand System](TRADIFY_BRAND_SYSTEM.md) and [Signals handoff](TRADIFY_SIGNALS_HANDOFF.md) | Parent direction and Journal prototype are documented. Signals' exact logo and gold/teal values remain owned by Signals; verify them against its source before reuse. | Signals reviews its own asset use. Do not recolor or replace its brand assets from Journal. |
| Account-linking contract | [Account-Linking V1](TRADIFY_ACCOUNT_LINKING_V1.md) and [implementation plan](TRADIFY_ACCOUNT_LINKING_V1_IMPLEMENTATION_PLAN.md) | The docs record both projects' acceptance of `tradify-account-linking-v1/revocation-retry-v1` and product-owner approval of the consent wording for isolated development. | Before a bilateral test, revalidate both HTTPS API origins and authenticated routes; confirm the active, reciprocal development public-key pins and immutable `kid`s through the secure configuration process. Use a fresh time-limited session; never reuse an expired signer or disclose a private key. |
| Account-linking development test | Account-Linking V1 contract | Not a production approval. The exact development session and routes must be checked at test time; health checks alone are insufficient. | Use separate isolated development databases and synthetic accounts. Test separate sign-ins, both consent steps, account-pair labels, the original five-minute deadline, replay rejection, connected status, unlink, fresh assertion per revocation retry, idempotent acknowledgment, changed-payload rejection/audit, and pending-link behavior. |
| Journal market-data capture | [Journal MT5 Market Data development scope](TRADIFY_MT5_MARKET_DATA_DEV.md) | Journal-side customer-bridge capture is implemented and passes synthetic tests. It is default-off and has no Signals feed. The current Journal code does not implement the reference-bridge identity or Signals strategy engine. | Keep capture off until the isolated runtime and migration are reviewed for the specific test. Use a disposable MT5 demo account for terminal validation. |
| Market-data sharing | No approved cross-project contract yet | Separate from account linking; not accepted or implemented as service-to-service sharing. | Journal and Signals must agree on source authentication, customer consent, instrument selection/subscription checks, canonical broker-symbol mapping, freshness, retention, errors/revocation, and test ownership before any transfer. |
| Production restoration and release | Product-specific deployment and database plans | Not authorized by this checklist. | Separate approval is required for production database access or writes, migrations, enabling features, background work, billing/email, deployment, and DNS. |

## Account-linking test gate

The accepted retry rule remains unchanged:

- One immutable `eventId` and canonical payload/hash per logical revocation.
- A new RS256 assertion, unique `jti`, and maximum 120-second validity for every delivery attempt.
- Normal signature, pinned-key, issuer, audience, expiry, and replay verification on every attempt.
- Deduplicate side effects by `eventId` plus canonical payload hash.
- A matching repeat receives an idempotent acknowledgment; the same event ID with a different hash is rejected and audited.
- Keep the local link unusable while revocation is pending; mark it revoked only after a valid matching acknowledgment.
- Retry only transient failures with bounded exponential backoff.

Authorization expiry is not extended by preview, retry, or confirmation. The original five-minute authorization deadline remains authoritative.

Before the test window opens, both agents should record:

- [ ] The exact contract version and consent-copy versions to be tested.
- [ ] The current HTTPS API origins and successful authenticated-route checks.
- [ ] Reciprocal development `kid` and public-key pins verified through secure configuration; no private key in this document, Git, Shared, or Production configuration.
- [ ] Separate disposable development databases and synthetic accounts on both sides.
- [ ] A test window that ends before the temporary signer/session expires.
- [ ] A teardown result confirming synthetic linking and replay data are removed.

If any item is not verified, stop before sending cross-service requests.

## Market-data agreement gate

The current Journal implementation supports only its own customer's selected MT5 feed. It stores raw broker names and metadata, not an agreed canonical symbol mapping. It does not authorize Signals to read the data.

Before any cross-service market-data test, both product owners/agents must approve a separate versioned contract covering:

- Reference-bridge versus customer-bridge source identity and authentication.
- Customer consent, account pairing, instrument selection, and subscription entitlement checks.
- Broker-symbol normalization and the authoritative mapping registry.
- Source timestamps, freshness limits, clock skew, connection health, and stale-data handling.
- Historical-candle request limits, cache retention, deletion, and storage caps.
- Error handling, retries, revocation, audit records, and the owner of each operational action.
- A synthetic end-to-end test and explicit production-exclusion checks.

No item in the account-linking contract grants access to prices, candles, trades, or strategy results.

## Decision and test record

Update this section only with non-secret status and test outcomes. Do not paste keys, authorization codes, JWTs, account emails, internal IDs, credentials, or customer records.

| Decision/test | Owner | Status | Evidence / date |
| --- | --- | --- | --- |
| Account-linking V1 retry rule accepted by both projects | Journal + Signals | Accepted per linked implementation plan | See `TRADIFY_ACCOUNT_LINKING_V1_IMPLEMENTATION_PLAN.md` |
| Isolated-development consent wording approved | Product owner | Approved for development only | See `TRADIFY_ACCOUNT_LINKING_V1.md` |
| Fresh reciprocal development trust and HTTPS route check | Journal + Signals | Revalidate before each test window | Record sanitized result only |
| Bilateral account-linking test | Journal + Signals | Pending fresh readiness check | No production data |
| Journal market-data development capture | Journal | Implemented; synthetic tests pass; default-off | See `TRADIFY_MT5_MARKET_DATA_DEV.md` |
| Separate market-data contract and Signals acceptance | Journal + Signals | Not yet approved | No transfer until accepted |
| Production feature activation or release | Product owner | Not approved by this checklist | Requires separate approval |
