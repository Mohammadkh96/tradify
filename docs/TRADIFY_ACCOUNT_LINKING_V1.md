# Tradify Journal ↔ Tradify Signals Account-Linking Contract

**Contract version:** `tradify-account-linking-v1`

**Status:** Journal accepts and implements the exact versioned revocation retry rule `tradify-account-linking-v1/revocation-retry-v1`. The Signals Agent reports that Signals has implemented and tested the same rule and independently accepts it. The Journal focused isolated test passes. This protocol acceptance does not authorize live cross-service testing or production use. The active Journal linking code is development/test-only; production enablement has not been implemented.

**Important compatibility note:** Journal linking remains default-off. Both projects have accepted the `revocation-retry-v1` rule, but that is not acceptance of every account-linking V1 detail or approval for real cross-service testing. Secure development trust configuration and the remaining product/API decisions must be reviewed first. No production migration, key exchange, Signals API call, or deployment is authorized here.

## 1. Purpose and security boundaries

V1 associates one independently authenticated Journal account with one independently authenticated Signals account. It is an account association only—not shared login, SSO, shared authorization, entitlement synchronization, or a payment integration.

- Journal is authoritative for Journal identities, sessions, trades, challenges, billing, Journal entitlements, and Journal administration.
- Signals is authoritative for Signals identities, sessions, strategies, signal events, Signals entitlements, and Signals administration.
- Each service stores its own local account ID. Neither service receives the other service's password, password hash, session, reset token, email address, billing data, or database credentials.
- The only cross-product account key is a server-generated opaque subject, scoped to the issuing product and environment. It is not a database ID or client-supplied registration `userId`.
- Never match or merge accounts by email, name, phone number, payment information, or other profile fields.
- Linking or unlinking never copies or deletes the other product's account, trades, MT5 data, entitlements, subscriptions, payment state, or Admin permissions.
- Each product may modify only its own repository, database, keys, and deployments.

## 2. Responsibilities

| Responsibility | Journal | Signals |
| --- | --- | --- |
| Authenticate account | Own Journal session and recovery | Own Signals session and recovery |
| Local identity | Keep Journal user-role ID private; bind it to the authorization code | Create and persist a stable opaque Signals subject server-side; never accept it from the browser |
| Consent | Record versioned initiation and final confirmation | Record its own versioned consent after showing the exact pairing |
| Link state | Store Journal's local link row and opaque Signals subject | Store Signals' local link row and opaque Journal reference |
| Claim validation | Verify Signals signature, environment, subject, consent, code, and replay state | Sign only after authenticating the current Signals user and recording consent |
| Unlink | Immediately disable the local association; send a signed revocation event | Immediately disable the local association; send a signed revocation event |
| Account lifecycle | Revoke on Journal deletion/suspension; retain a minimal audit tombstone | Revoke on Signals deletion/suspension; retain a minimal audit tombstone |

Neither product is allowed to query the other's database or reuse the other's session or credentials.

## 3. Proposed identifiers, consent versions, and state machine

Signals has approved the isolated-development policy direction. Identifiers that Signals has not explicitly confirmed remain provisional and block cross-service testing and activation until confirmed.

- Contract: `tradify-account-linking-v1`
- Journal initiation consent: `tradify-journal-link-initiation-v1`
- Journal final-confirmation consent: `tradify-journal-link-confirmation-v1`
- Signals consent: `tradify-signals-link-consent-v1`
- Signals development issuer: `https://linking-dev.signals.tradifyapp.com`.
- Journal development issuer: `https://linking-dev.journal.tradifyapp.com`.
- Audience for Signals assertions to Journal: `tradify-journal-link-v1-dev`.
- Audience for Journal assertions to Signals: `tradify-signals-link-v1-dev`.
- These are logical JWT identities, not service deployment URLs. Journal API origin: `https://d249d3f6-43db-41f6-9a74-d7c50aa6969b-00-1iqop82skn7hh.spock.replit.dev`. Signals API origin: `https://d67af0fa-9005-434c-9479-931727bf214f-00-2mllvk6m6eyma.pike.replit.dev`.
- Read-only reachability checks on 2026-10-19: `GET /api/health` returned HTTP 200 from both API origins without an External Access Token. The Journal response was `healthy`; the Signals response was `ok`. Health only confirms endpoint reachability, not database readiness or account-linking route availability.
- The Signals API origin, Journal development issuer/audience, and Signals development issuer are configured in the Journal Development environment only. Verify the origins again before any later integration run because Replit development origins may change.
- Reserved Journal development `kid`: `journal-dev-20261015-5814c6a3c529416a`. It is not yet attached to a key or configured; Signals must not pin it until the matching public key is generated and verified.
- No Journal private signing key, Journal signing `kid`, Signals public verification key, or Signals signing `kid` is configured. `DEV_PRODUCT_LINKING_ENABLED` is unset, so account-linking routes remain disabled. Key material is never stored in this document.
- If an isolated development signer is later configured, the private key variable is `DEV_TRADIFY_JOURNAL_PRIVATE_KEY`. Production startup fails closed if either that development-only variable or the legacy `TRADIFY_JOURNAL_PRIVATE_KEY` variable is present. Replit documents that development secrets may sync into deployment settings at publish time, so a development secret must still be explicitly absent from the Production deployment configuration before publishing; a variable name or runtime guard alone cannot prevent the platform from copying it.
- Revocation retry rule: `tradify-account-linking-v1/revocation-retry-v1`. Journal and Signals have independently accepted this exact rule; secure key exchange and API configuration are still required before real cross-service testing.
- Staging and production issuers, audiences, and keys are out of scope and are not defined by this development contract.

Signals must create the stable `sub` on its server using 32 cryptographically random bytes encoded as unpadded base64url. It must persist that subject against the authenticated Signals account and reuse it on later link attempts. It must never derive `sub` from or accept it as a client-provided `userId`, email, or profile value. Journal stores that opaque subject with the exact configured Signals issuer.

For the confirmation UI, each attempt has:

- `journalAttemptLabel`: `JRN-` plus 12 CSPRNG-generated characters from `[A-Z2-7]`, generated by Journal and shown on both products for this attempt.
- `signalsAttemptLabel`: `SIG-` plus 12 CSPRNG-generated characters from `[A-Z2-7]`, generated by Signals and shown on both products for this attempt.

These temporary labels identify the pair to the customer; they are not account IDs and must not be reused as stable identifiers. Each product displays its own account's local sign-in label only within that product. The Signals page shows its current local account and the Journal attempt label. The final Journal confirmation shows the Journal local account and the Signals attempt label. The customer must confirm the pair on both products before the link becomes active. No email or internal user ID crosses the boundary.

State transitions:

```text
unlinked
  -> awaiting_signals_consent
  -> awaiting_journal_confirmation
  -> active

awaiting_* -> cancelled | expired
active -> revocation_pending -> revoked
```

A code is single-use and expires five minutes after Journal issues it. A pending confirmation expires at the same authorization's original `expiresAt`; it receives no additional post-claim time. A revoked, cancelled, or expired link cannot be reactivated; the customer starts a fresh two-sided flow.

## 4. Customer flow and safe code transfer

1. The customer signs in to Journal using Journal's own authentication. Journal displays the current local account label and explains that linking does not share sign-in or entitlements.

   Proposed customer wording from the Signals review (final UI copy still requires product-owner approval):

   > Connect your Tradify Journal and Tradify Signals accounts. You will continue signing in to each product separately. Your subscriptions, trading records, and account permissions will remain separate. You can disconnect the accounts later.

2. The customer gives Journal consent to initiate a link. Journal records `tradify-journal-link-initiation-v1`, its timestamp, and the current internal Journal account ID. Journal creates a random 32-byte code, stores only its SHA-256 digest, and returns the code and `journalAttemptLabel` in a `Cache-Control: no-store` response.
3. Journal renders the code only in the active page's memory. It does not put the code in a URL, redirect, browser storage, cookie, referrer, analytics event, browser log, server log, tracing span, or error report. The UI does not copy the code to the clipboard automatically.
4. The customer opens the Signals linking page separately, signs in to Signals, and manually pastes or enters the code into a form. The code is submitted only in a JSON request body. The page uses `autocomplete="off"`, clears the input after submission, and does not persist the value in local/session storage, IndexedDB, a service-worker cache, or navigation state.
5. The Signals server sends the code to Journal's preview endpoint over HTTPS in a POST body. The preview returns only the Journal attempt label and expiry—not an email, Journal user ID, or database ID.
6. Signals displays its own current account label and both attempt labels. The customer explicitly consents to that pairing. Signals records its own consent version and timestamp, then creates the signed assertion using the subject loaded from its own authenticated account record.
7. Signals sends the code and signed assertion to Journal's claim endpoint. Journal validates them and atomically consumes the authorization into `awaiting_journal_confirmation`; it does not yet mark the link active.
8. Journal shows its current local account and the Signals attempt label. The customer gives final Journal consent (`tradify-journal-link-confirmation-v1`) to this exact pair. Journal stores the final consent record and changes the link to `active`.
9. Signals learns the final state through its signed status call. Both products show the link status without exposing the other product's subject or local account ID.

All browser-facing state-changing requests require that product's own authenticated session, CSRF protection, and an exact allowed `Origin`. Service-to-service calls use HTTPS and signed assertions, never browser session cookies. CORS must not allow arbitrary origins.

## 5. Versioned API contracts

All dates are UTC ISO-8601 strings. JSON request bodies are size-limited, validated against exact schemas, and never logged. All endpoints below are proposed; the current disabled prototype does not implement the complete set.

### 5.1 Journal: start authorization

`POST /api/v1/product-links/signals/authorization`

Owner: Journal. Requires a verified Journal session, a session-bound CSRF token, and exact same-origin validation.

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "consent": true,
  "consentVersion": "tradify-journal-link-initiation-v1"
}
```

Success (`201`):

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "authorizationCode": "<64 lowercase hex characters>",
  "journalAttemptLabel": "JRN-7M4PK9D2W3QF",
  "expiresAt": "2026-10-15T12:05:00.000Z"
}
```

The response contains no Journal ID or email. Issuing a new code revokes any previous unconsumed authorization for that Journal account.

### 5.2 Journal: preview the Journal-side account

`POST /api/v1/product-links/signals/preview`

Owner: Journal. Called server-to-server by Signals after the customer submits the code. The code is a 256-bit, short-lived bearer credential; the endpoint is TLS-only, rate-limited, body-only, and must never log the request body.

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "authorizationCode": "<code returned by Journal>"
}
```

Success (`200`):

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "state": "awaiting_signals_consent",
  "journalAttemptLabel": "JRN-7M4PK9D2W3QF",
  "expiresAt": "2026-10-15T12:05:00.000Z"
}
```

Preview does not consume or extend the authorization. It returns no account ID, email, profile, or other Journal data.

### 5.3 Signals: preview and accept the customer's code

Proposed Signals-owned browser preview route: `POST /api/v1/product-links/journal/preview`.

The request requires the customer's Signals session and CSRF token. The only customer-supplied field is the Journal code:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "authorizationCode": "<code entered by the customer>"
}
```

Signals obtains the subject and account label from its authenticated server-side account record. It must ignore/reject any client-supplied `userId`, `sub`, email, or account mapping. After previewing and showing the pair, Signals records its separate consent before making the service-to-service claim.

The preview route calls Journal's preview endpoint from the Signals server and returns:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "state": "awaiting_signals_consent",
  "journalAttemptLabel": "JRN-7M4PK9D2W3QF",
  "signalsAttemptLabel": "SIG-6P8TR2K5M9WX",
  "expiresAt": "2026-10-15T12:05:00.000Z"
}
```

This preview is not consent and does not create a link. The Signals UI displays both attempt labels beside the current local Signals account label. The code remains only in transient page memory until the customer submits or cancels.

After the customer gives explicit Signals consent, the Signals UI calls `POST /api/v1/product-links/journal/claim` with the same local session and CSRF protection:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "authorizationCode": "<code entered by the customer>",
  "consent": true,
  "consentVersion": "tradify-signals-link-consent-v1"
}
```

Signals records that separate consent, obtains `sub` from its authenticated server-side account record, signs the claim assertion, and calls Journal's service-to-service claim endpoint. The Signals browser endpoint returns:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "state": "awaiting_journal_confirmation",
  "signalsAttemptLabel": "SIG-6P8TR2K5M9WX",
  "expiresAt": "2026-10-15T12:05:00.000Z"
}
```

It does not accept or return a client-supplied `userId`, `sub`, email, or internal account mapping.

### 5.4 Journal: claim the authorization

`POST /api/v1/product-links/signals/claim`

Owner: Journal; called only by the Signals server over HTTPS. It accepts no Journal user ID, email, or Signals subject in the JSON body.

```http
Authorization: Bearer <short-lived-Signals-signed-JWT>
Content-Type: application/json
```

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "authorizationCode": "<code returned by Journal>"
}
```

Success (`201`) creates a pending link, not an active one:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "linkId": "<opaque Journal-generated UUID>",
  "state": "awaiting_journal_confirmation",
  "signalsAttemptLabel": "SIG-6P8TR2K5M9WX",
  "expiresAt": "2026-10-15T12:05:00.000Z"
}
```

Signals retries an identical claim with the same code and exact signed assertion and receives `200` with the same `linkId` and current state. It must not create a second link.

### 5.5 Journal: final confirmation and customer status

`POST /api/v1/product-links/signals/confirm`

Owner: Journal. Requires the same authenticated Journal account that initiated the authorization, a session-bound CSRF token, and explicit final consent:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "linkId": "<opaque Journal-generated UUID>",
  "consent": true,
  "consentVersion": "tradify-journal-link-confirmation-v1"
}
```

Success (`200`):

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "linkId": "<opaque Journal-generated UUID>",
  "state": "active",
  "linkedAt": "2026-10-15T12:01:00.000Z"
}
```

`GET /api/v1/product-links/signals` requires the Journal session and returns only the current user's state:

```json
{ "state": "unlinked" }
```

or:

```json
{
  "state": "active",
  "linkId": "<opaque Journal-generated UUID>",
  "linkedAt": "2026-10-15T12:01:00.000Z",
  "signalsAttemptLabel": "SIG-6P8TR2K5M9WX"
}
```

Pending confirmation is returned only to the initiating Journal session:

```json
{
  "state": "awaiting_journal_confirmation",
  "linkId": "<opaque Journal-generated UUID>",
  "signalsAttemptLabel": "SIG-6P8TR2K5M9WX",
  "expiresAt": "2026-10-15T12:05:00.000Z"
}
```

The response never returns either product's local user ID, email, subject, or credentials.

`DELETE /api/v1/product-links/signals/authorization` cancels the current user's unconsumed authorization. It requires that user's Journal session and CSRF token, returns `204`, and cannot cancel another account's code.

### 5.6 Service status

Signals checks the final Journal state using a signed service request:

`POST /api/v1/product-links/signals/status`

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "linkId": "<opaque Journal-generated UUID>"
}
```

The request's signed assertion uses `action: "status"` and the same strict issuer, audience, key, clock, and replay rules. A successful response (`200`) contains only:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "linkId": "<opaque Journal-generated UUID>",
  "state": "active",
  "linkedAt": "2026-10-15T12:01:00.000Z"
}
```

It does not return a local user ID or email.

Signals exposes `GET /api/v1/product-links/journal` to its own signed-in customer for local status. It returns the same state vocabulary and only that user's link state; it never returns a Journal user ID, email, or subject.

Example (`200`):

```json
{
  "state": "active",
  "signalsAttemptLabel": "SIG-6P8TR2K5M9WX",
  "linkedAt": "2026-10-15T12:01:00.000Z"
}
```

The status assertion is an RS256 JWT with `iss`, `aud`, `sub`, `iat`, `exp`, `jti`, `action: "status"`, `contract_version`, and `link_id`. It is signed by Signals for Journal's exact environment audience. Journal rejects a status token with a claim action, or one whose subject does not match the Signals subject on that link.

### 5.7 Unlink endpoints

- Journal customer: `DELETE /api/v1/product-links/signals/{linkId}` with Journal session and CSRF protection.
- Signals customer: `DELETE /api/v1/product-links/journal/{linkId}` with Signals session and CSRF protection.
- Signals-to-Journal service notification: `POST /api/v1/product-links/signals/revocations`.
- Journal-to-Signals service notification: `POST /api/v1/product-links/journal/revocations`.

An authenticated customer delete returns `202`:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "linkId": "<opaque Journal-generated UUID>",
  "state": "revocation_pending",
  "eventId": "<UUID generated once by the initiating product>"
}
```

Service revocation body:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "linkId": "<opaque Journal-generated UUID>",
  "eventId": "<UUID generated once by the sending product>",
  "reason": "user_unlinked",
  "payloadHash": "<lowercase SHA-256 hex of the canonical four-field event payload>"
}
```

Allowed `reason` values are `user_unlinked`, `account_deleted`, `account_suspended`, and `security_action`. Every logical revocation gets one permanent `eventId`; retries must not create a replacement event.

### Versioned retry rule: `tradify-account-linking-v1/revocation-retry-v1`

The canonical event payload is exactly this object, with no additional members:

```json
{
  "contractVersion": "tradify-account-linking-v1",
  "eventId": "<permanent UUID for this logical revocation>",
  "linkId": "<opaque UUID>",
  "reason": "user_unlinked"
}
```

Serialize that object using RFC 8785 JSON Canonicalization Scheme (JCS). `payloadHash` is the lowercase hexadecimal SHA-256 digest of the UTF-8 canonical JSON bytes. Persist both the exact canonical payload and its hash with the outbox event before delivery; retries reuse both unchanged. The HTTP request body contains the four fields above plus `payloadHash`. Receivers reject unknown/missing fields, recompute the JCS serialization and hash, and compare it with the supplied hash.

Every delivery attempt creates a new RS256 assertion with a unique `jti` and exactly 120 seconds between `iat` and `exp`. The assertion includes the same `link_id`, `event_id`, `reason`, and `payload_sha256` as the request body. Every attempt must still pass normal signature, pinned-`kid`, exact issuer/audience, time, and `jti` replay validation. A previously used `jti` is rejected; a retry uses a new one. Event idempotency is separate from JWT replay protection.

After validating the assertion and recomputed hash:

- A previously unseen `(issuer, eventId)` with this hash is processed once, and the receiver records the event and hash durably.
- A repeat with the same event ID and hash returns the same idempotent acknowledgement without repeating side effects, even though the new attempt has a different valid assertion and `jti`.
- Reuse of an event ID with a different payload hash returns `409` and records a security-relevant mismatch using only non-sensitive event/hash metadata. It must not change the existing event or link state.

The successful `200` acknowledgement contains `contractVersion`, `eventId`, `linkId`, `payloadHash`, and `state: "revoked"`. The sender verifies that the acknowledgement matches its persisted event ID and payload hash before changing its local link from `revocation_pending` to `revoked`. Transient network errors and retryable HTTP statuses use bounded exponential backoff with a finite base and cap; permanent conflicts or invalid acknowledgements remain pending and are blocked for manual reconciliation. Production retry values require separate approval. Do not weaken any authentication, expiry, or replay checks to support retries.

Sanitized Signals-to-Journal revocation assertion claims:

```json
{
  "iss": "<exact configured HTTPS Signals issuer for this environment>",
  "aud": "tradify-journal-link-v1-dev",
  "sub": "tradify-signals-link-service",
  "iat": 1792065600,
  "exp": 1792065720,
  "jti": "<16-128 URL-safe random characters>",
  "action": "revoke",
  "contract_version": "tradify-account-linking-v1",
  "link_id": "<opaque Journal-generated UUID>",
  "event_id": "<UUID generated once by Signals>",
  "reason": "user_unlinked",
  "payload_sha256": "<same hash as request body payloadHash>"
}
```

Journal-to-Signals uses the same shape signed by Journal, with the exact Journal development issuer, `sub: "tradify-journal-link-service"`, and audience `tradify-signals-link-v1-dev`. Both directions use their own pinned development key IDs. The service `sub` identifies the signing service, not a customer. A receiver compares the signed claims, recomputed payload hash, and POST body before applying the event.

A service revocation returns `200` with the matching `eventId`, `linkId`, `payloadHash`, contract version, and `state: "revoked"`. If the receiver is unavailable, the sender keeps its own link unusable and its durable outbox retries; browser unlink requests return `202`.

### 5.8 Standard error envelope

Proposed error response:

```json
{
  "error": {
    "code": "LINK_AUTHORIZATION_EXPIRED",
    "message": "This linking request expired. Start a new request."
  }
}
```

Use the HTTP status table in Section 7. Messages remain generic and never include the code, token, subject, email, or whether a particular account exists.

## 6. Signed assertions and environment configuration

Signals signs assertions on its server using RS256. Journal verifies them on its server using public keys pinned out of band. No key discovery from the token, request, DNS, or an untrusted `jku`/`x5u` URL is permitted.

### JWT header

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "<operator-pinned Signals key ID for this environment>"
}
```

Reject any other algorithm or type, unknown `kid`, duplicate JSON keys, unsupported critical headers, `jku`, `x5u`, or malformed signature.

### Claim request

The following sanitized claim shape is signed only after Signals records the customer's explicit consent:

```json
{
  "iss": "<exact configured HTTPS Signals issuer for this environment>",
  "aud": "tradify-journal-link-v1-dev",
  "sub": "<43-character base64url server-generated opaque Signals subject>",
  "iat": 1792065600,
  "exp": 1792065690,
  "jti": "<16-128 URL-safe random characters>",
  "action": "claim",
  "contract_version": "tradify-account-linking-v1",
  "consent": true,
  "consent_at": 1792065595,
  "consent_version": "tradify-signals-link-consent-v1",
  "journal_initiation_consent_version": "tradify-journal-link-initiation-v1",
  "journal_attempt_label": "JRN-7M4PK9D2W3QF",
  "signals_attempt_label": "SIG-6P8TR2K5M9WX",
  "code_sha256": "<64 lowercase hex characters>"
}
```

For `status` and `revoke`, use a separately scoped `action` and the relevant `link_id`/`event_id`; do not reuse a claim assertion for another operation.

### Status assertion

```json
{
  "iss": "<exact configured HTTPS Signals issuer for this environment>",
  "aud": "tradify-journal-link-v1-dev",
  "sub": "<43-character base64url Signals subject already stored on this link>",
  "iat": 1792065600,
  "exp": 1792065690,
  "jti": "<16-128 URL-safe random characters>",
  "action": "status",
  "contract_version": "tradify-account-linking-v1",
  "link_id": "<opaque Journal-generated UUID>"
}
```

Status assertions contain no consent or authorization-code claims. Journal requires the subject to match the subject already bound to the requested link.

### Revocation assertion

The example in Section 5.7 is the exact proposed revocation claim shape. Its `sub` is the sending service identity, not an end-user subject; the opaque `link_id` identifies the association being revoked.

### Issuer and audience rules

- For isolated development, Journal trusts only the canonical Signals issuer `https://linking-dev.signals.tradifyapp.com` and audience `tradify-journal-link-v1-dev`. Signals supplies its public signing key and `kid` through an approved secure configuration exchange.
- Journal signs outbound requests with issuer `https://linking-dev.journal.tradifyapp.com` and audience `tradify-signals-link-v1-dev`; Journal supplies only its public key and `kid` to Signals through the same secure exchange.
- The Signals API base URL is a separately configured HTTPS service endpoint. It is not inferred from either issuer.
- Journal accepts only the exact confirmed development issuer, `kid`, and single-string audience. Reject audience arrays, aliases, prefixes, wildcards, unknown keys, and any production/staging trust material.
- The reverse development audience for Journal-signed requests to Signals must be provided or explicitly confirmed by Signals. It is intentionally not guessed in this contract.
- Development issuer, audience, `kid`, and public key are fixed by development-only configuration, never derived from request headers or client payloads. Do not put key material in Git, this document, or application logs.
- Staging and production trust configuration, key sets, and audiences require separate review and are not approved or specified here.

### Exact time rules

All times are integer Unix seconds and both services must use synchronized UTC clocks.

- `exp` must be strictly greater than verifier `now`; there is no post-expiration grace period.
- `exp` must be greater than `iat`; `exp - iat` must be at most 120 seconds.
- Revocation retry assertions use exactly 120 seconds between `iat` and `exp`; each attempt has a newly generated, unique `jti`.
- `iat` must be no earlier than `now - 120` and no later than `now + 30`.
- `consent_at` must be no earlier than `now - 120`, no later than `now + 30`, and no later than `iat + 30`.
- Any missing/non-integer timestamp, expired assertion, or value outside these bounds is rejected.

Signals approved the 30-second future issuance tolerance, 120-second maximum assertion lifetime, and zero expiration grace for isolated development. Production policy remains a separate decision.

### Key custody, rotation, and emergency revocation

- Each product owns its private key. Private keys remain in that product's managed secret store and are never exported to the other product.
- For isolated development, use separate RSA key pairs of at least 2048 bits for each product/signing direction. Share only public keys through an authenticated out-of-band configuration change; production/staging key choices are outside this document.
- `kid` values are unique, immutable, and pinned to an exact public key and environment. Do not trust keys supplied in requests.
- For isolated development, Signals approved a maximum seven-day key overlap; publish and pin the next public key out of band, switch the signer, then remove the old key. Never overlap development and production keys.
- Emergency revocation is immediate: remove the compromised `kid`, reject its assertions, cancel pending authorizations and pending links signed with it, and review links created during the suspected compromise window. Record the event in each product's own audit log.
- Key rotation and emergency-revocation procedures must be exercised with synthetic keys before activation.

## 7. Replay, substitution, CSRF, and failure behavior

- Authorization codes contain 32 random bytes, are sent only in POST bodies over HTTPS, are stored as SHA-256 digests, expire after five minutes, and are consumed once.
- Journal consumes the code, creates the pending link, and stores the replay record in one database transaction with a row lock. Concurrent claims cannot both succeed.
- The replay table has a unique key on `(issuer, audience, jti)`. Store only the SHA-256 fingerprint of each exact compact signed assertion, never the raw bearer JWT.
- Claim and status retries use the same `jti` and exact assertion; altered claims or bodies under that `jti` return `409`. Each revocation attempt uses a fresh assertion and `jti`; reusing a `jti` is rejected independently of event idempotency.
- Revocation event idempotency is based on `(issuer, eventId, payloadHash)`, where the receiver recomputes the hash from the exact JCS canonical event payload. A repeated event ID with the same hash returns an acknowledgement without repeating side effects. A repeated event ID with a different hash returns `409` and creates a security-relevant mismatch audit record.
- Enforce uniqueness for one active/pending Journal account per Signals issuer and one active/pending Signals subject per issuer. A revoked link cannot be reactivated by replay.
- Signals derives `sub` from the authenticated server-side account record. Journal ignores any client-supplied account IDs, emails, or subjects. The final Journal confirmation is bound to the exact pending `linkId` and both displayed attempt labels.
- Browser mutations require the owning product's session-bound CSRF token, same-origin `Origin` validation, and normal session protections. Service-to-service routes reject browser cookies and require a correctly signed operation-specific assertion.
- Apply rate limits to authorization, preview, claim, status, and revocation. Return generic errors that do not reveal whether a subject or authorization code exists.
- Set `Cache-Control: no-store` and `Referrer-Policy: no-referrer` on linking pages and sensitive API responses. Redact request/response bodies, authorization headers, codes, JWTs, and subjects from all access logs, analytics, traces, and error reporting.

| HTTP status | Meaning |
| --- | --- |
| `400` | `INVALID_REQUEST` or `CONSENT_REQUIRED`: malformed body, unsupported contract version, or invalid consent |
| `401` | `AUTHENTICATION_REQUIRED` or `ASSERTION_INVALID`: missing/invalid local session or signed assertion |
| `403` | `CSRF_ORIGIN_FAILED` or `ACCOUNT_MISMATCH`: failed CSRF/origin check or wrong local account |
| `409` | `AUTHORIZATION_EXPIRED`, `REPLAY_CONFLICT`, or `LINK_EXISTS`: expired/used code, changed replay, or duplicate active link |
| `429` | `RATE_LIMITED`: request limit exceeded |
| `503` | `LINKING_DISABLED` or `PARTNER_UNAVAILABLE`: feature/configuration is unavailable or counterpart cannot be reached |

Errors must not echo the authorization code, JWT, email, subject, or key material.

## 8. Unlinking, deletion, suspension, recovery, and reconciliation

- A customer can unlink from either product while authenticated to that product. Require fresh local authentication for the operation if the product's session policy says the session is stale.
- On customer unlink, the initiating product immediately makes the local association unusable, sets `revocation_pending`, and writes a signed event to its own transactional outbox. Only after the other service acknowledges the event does the initiating product transition it to `revoked`.
- While remote revocation is pending, the association cannot be used and a replacement link for that pair is blocked. A receiver applies the event idempotently and acknowledges it. Do not silently reactivate or discard a pending event.
- Each product owns delivery of its own outbound events and its authenticated inbound revocation handler. If the partner is unavailable, retry the same immutable event ID, canonical payload, and hash with a fresh 120-second assertion and unique `jti` for each attempt. Both agents have accepted `tradify-account-linking-v1/revocation-retry-v1`; secure trust configuration remains a prerequisite for real cross-service testing. Production backoff parameters remain a separate decision.
- For isolated development tests, use a deterministic outbox drain or an explicitly started manual development worker. Never start a worker by default in the Journal web process, and do not activate production background jobs.
- Account deletion must not wait for the other product: disable the local association, persist the signed revocation event and minimal pseudonymous audit tombstone, then continue the local deletion/anonymization. Retry remote delivery asynchronously. Do not rely on an account foreign-key cascade that silently erases the event.
- Account suspension immediately disables the link and sends a revocation event. Unsuspension does not automatically relink; both products require a new consent flow.
- Account recovery remains product-local. Signals cannot recover Journal access and Journal cannot recover Signals access. Recovery never uses email matching or transfers reset tokens. Any lost-access recovery or suspected-compromise recovery revokes active links and invalidates pending authorizations; ordinary authenticated password changes do not count as recovery. Require fresh linking consent after the owner regains access.
- Interrupted linking creates no active link. Authorization and pending-confirmation state expire no later than the original five-minute authorization-code deadline; the customer starts over. A new code invalidates the previous one.
- Keep synthetic development audit data minimal and remove it during test-environment teardown. Production retention and any customer-data retention periods remain undecided and require a separate review.
- Reconciliation compares only versioned link/event states by `linkId` and event ID. It never copies account data or entitlements. Conflicts fail closed and require both owners to review.

## 9. Required schema changes (proposal only)

The Journal migration source is implemented and is applied by integration tests only to a unique disposable local PostgreSQL database. It is not run at application startup and has not been applied to production or Neon.

**Journal database changes expected after acceptance:**

- Authorization record: local Journal foreign key, code digest, Journal consent version/time, attempt label, creation/expiry/consume/revoke times, and state. Never store the raw code.
- Link record: opaque `linkId`, Journal local foreign key, exact Signals issuer and opaque subject, both attempt labels, separate consent versions/times, pinned signing `kid`, state (`awaiting_journal_confirmation`, `active`, `revocation_pending`, `revoked`), and lifecycle timestamps.
- Replay record: issuer, audience, `jti`, exact assertion fingerprint, code digest, link/event references, `kid`, and creation time; unique constraint on issuer/audience/`jti`.
- Transactional outbox: one permanent event ID, immutable JCS canonical payload, its SHA-256 hash, delivery state, retry timestamps, and acknowledgement. Inbox idempotency is unique by issuer and event ID and records the canonical payload hash. Never store a raw JWT.
- Security mismatch audit: non-sensitive issuer, event ID, stored hash, received hash, and timestamp when a reused event ID carries a different canonical payload. Do not retain customer email, local account IDs, bearer assertions, or raw payloads containing personal data.
- Deletion-safe audit tombstone: minimal pseudonymous link/event reference and revocation time. Replace any cascade behavior that would erase an unsent revocation.
- Partial uniqueness constraints for one active/pending Journal account per issuer and one active/pending partner subject per issuer.

**Signals database changes expected after acceptance:**

- Signals-owned stable opaque subject generated and persisted server-side for each local account.
- Signals-owned consent record with its own consent version, timestamp, authenticated local account reference, contract version, attempt labels, and revocation state.
- Signals-owned link record containing its local account reference, Journal issuer/opaque link reference, state, timestamps, and local audit metadata.
- Signals-owned transactional revocation outbox/inbox and minimal deletion tombstones.

Signals schema names and migration details must be chosen by the Signals Agent in its own project. Do not connect to, inspect, migrate, or write the Signals database from Journal.

The Journal migrations `migrations/0002_tradify_account_linking_v1.sql` and `migrations/0003_product_link_revocation_retry_v1.sql` contain the V1 schema and are run only by the disposable integration-test setup. The outbox and tombstones are independent of customer-account foreign keys; account lifecycle code records the revocation before removing local links. No production migration has been applied.

## 10. Contract-test plan and current coverage

Contract tests must use two isolated development databases, synthetic `.invalid` accounts, ephemeral RSA key pairs, and mocked service-to-service calls. Use a deterministic outbox drain or an explicitly started manual worker in the isolated test environment; never start it automatically. Tear down synthetic audit data with the test environment. Never point tests at production or live customer data.

Required Journal and Signals contract cases before activation:

1. Both services independently require authenticated local sessions and separate versioned consent; missing, false, stale, or wrong-version consent is rejected.
2. Signals ignores a browser-supplied `userId`, `sub`, email, or account mapping and derives its subject from the authenticated server-side account.
3. A customer sees and confirms the exact Journal/Signals attempt-label pair on both consent surfaces; a changed label or account between preview and claim is rejected.
4. Authorization codes never appear in URL, browser storage, cookies, logs, analytics, traces, or error reports; preview does not consume or extend them.
5. Valid RS256 claim, status, and revocation assertions pass only for their exact environment issuer, audience, pinned `kid`, action, and operation.
6. Negative JWT cases: wrong algorithm/type/key/issuer/audience/action, unknown or revoked `kid`, `jku`/`x5u`, invalid signature, malformed or duplicate claims, email-like/client-selected subject, wrong code digest, missing consent, wrong consent version, bad labels, future/expired/malformed timestamps, and lifetime over 120 seconds.
7. Clock boundaries exactly test `iat = now+30`, `iat = now+31`, `iat = now-120`, `iat = now-121`, `exp = now`, `exp = now+1`, and `exp-iat = 120/121`.
8. Single-use and concurrency: two simultaneous claims for one code yield one pending link; replay with the exact same assertion returns that link; same `jti` with any changed claim/body returns `409`.
9. Revocation retry v1: same event ID and JCS payload/hash with fresh 120-second assertions and unique `jti`s; same ID/hash is acknowledged without repeated effects; changed hash yields `409` and a security audit; mismatched acknowledgement must not revoke the local link.
10. Duplicate Journal or Signals accounts, code substitution, changed subject, changed issuer, and cross-environment assertions cannot create or confirm a link.
11. Journal final confirmation is restricted to the original Journal account and exact pending link. No link becomes active before both consent records exist.
12. Unlink from either side, duplicate revocation, changed event replay, remote outage/retry, suspension, deletion, interrupted flow, recovery, and reconciliation all leave accounts and entitlements unchanged.
13. Responses and logs contain no passwords, emails from the other product, database IDs, raw authorization codes, raw JWTs, or private keys.

**Journal test status:** the full Journal security integration suite passed on 19 October 2026 (13/13) against a disposable loopback PostgreSQL cluster using synthetic accounts, ephemeral RSA/TLS keys, and mocked provider HTTP. The MT5, PayPal, and Stripe webhook tests all exercised their verification paths. Test-only fixtures now supply the development gates and synthetic provider settings; runtime and production gates were not relaxed. This is development/test evidence only and does not establish cross-service interoperability.

### Current implementation: development/test only

The active V1 routes are mounted by `server/routes.ts`. Their `isEnabled()` check in `server/product-linking-routes.ts` calls `getSignalsKeyring()`. Both `getSignalsKeyring()` and `getJournalSigningConfig()` in `server/product-linking-assertions.ts` require `NODE_ENV` to be `development` or `test`, `APP_ENV` not to be `production`, and `DEV_PRODUCT_LINKING_ENABLED=true`. The outbox's `assertManualDevelopmentContext()` also rejects production and requires that development flag. Therefore, the active V1 routes, signer, and manual outbox cannot be enabled in production today.

`assertDevelopmentSigningKeyNotInProduction()` in `server/index.ts` refuses startup if either `DEV_TRADIFY_JOURNAL_PRIVATE_KEY` or the legacy `TRADIFY_JOURNAL_PRIVATE_KEY` is present in a production runtime. This is a safety guard, not a production linking gate.

**Correction to the earlier wording:** `PRODUCT_LINKING_ENABLED`, `PRODUCT_LINKING_VERIFIED`, and `TRADIFY_SIGNALS_*` do not enable the active V1 route. The active code does not read those production flags. Do not set them expecting production linking to work; production linking is not implemented.

### Future production changes required (not implemented or approved)

1. In `server/product-linking-assertions.ts`, add a distinct, fail-closed production configuration path alongside—not instead of—the existing isolated-development path. It must validate the production issuer, exact audiences, pinned partner `kid`/public-key set, and a separate production Journal signer held only in Production secrets. It must never fall back to development issuers, keys, or audiences.
2. Define and approve the exact production flag and configuration names. The previously documented `PRODUCT_LINKING_ENABLED` and `PRODUCT_LINKING_VERIFIED` are only candidate names; no active V1 code reads them. Enabling must require both an explicit feature flag and a separately reviewed verification/approval state, plus complete valid production trust configuration. Missing or inconsistent configuration must remain disabled/fail closed.
3. In `server/product-linking-routes.ts`, change `isEnabled()` to select only the fully validated configuration for the current runtime. Keep development and production keyrings, issuers, audiences, flags, and endpoints disjoint.
4. Preserve the production startup check in `server/index.ts` that rejects development/legacy private keys, and add validation that production configuration is complete only when production linking is explicitly enabled. Do not print or log key material.
5. Keep `assertManualDevelopmentContext()` and `drainProductLinkOutboxOnce()` in `server/product-linking-outbox.ts` development/test-only. Any production dispatcher requires a separately reviewed, explicitly approved production execution mechanism, idempotent leasing, bounded retries, monitoring, and an operator stop control; do not add a web-process timer or enable a worker as part of this plan.
6. Add synthetic tests in `server/security.integration.test.ts` for default-off production behavior, each missing/invalid production setting, environment/key separation, startup refusal when a development key is present, valid production configuration, and production outbox behavior. Test production configuration logic without production credentials or a production database.
7. Review and approve production schema changes, recovery/rollback, audit retention, monitoring, and rollout separately. Any eventual production migration must be a reviewed migration applied only after a verified recovery point and explicit approval; never run it at application startup.

These are documentation-only future requirements. This change does not add the production path, set flags, configure secrets, alter migrations, or enable linking.

## 11. Development implementation handoff

The Journal-only implementation sequence is documented in [`TRADIFY_ACCOUNT_LINKING_V1_IMPLEMENTATION_PLAN.md`](TRADIFY_ACCOUNT_LINKING_V1_IMPLEMENTATION_PLAN.md). The Journal retry-v1 implementation is complete and accepted. Real cross-service tests remain blocked until the broader account-linking consent and API contract is approved and the exact development audience, issuer, key ID/public key, API base URL, and HTTPS transport are securely confirmed.

The development configuration must be isolated from production and exchanged through secure configuration only. Signals implements Signals-owned work in its own project; Journal implements Journal-owned work in this project. A development-only manual/deterministic outbox drain may run only when explicitly started for tests.

No production deployment, paid service, production database change, DNS change, email, billing, MT5 sync, or production background worker is authorized by this handoff. Production retention and rollout require a separate decision.

## 12. Remaining development integration gates

The revocation-retry-v1 rule is accepted by both projects. That acceptance does not approve the complete account-linking customer experience or production use. The following development gates remain:

- Product owners approve the exact separate-consent wording, paired-account confirmation, and recovery/unlink customer experience in both products.
- Signals confirms the exact development issuer, both directional audiences, pinned `kid` and public verification key, and its actual API base URL. Issuer values identify the signer; they are not service URLs.
- Verify a valid HTTPS endpoint and TLS certificate for the development API; service-to-service calls must use HTTPS. Exchange only public verification keys and non-secret identifiers through the approved secure configuration process.
- Before configuring `DEV_TRADIFY_JOURNAL_PRIVATE_KEY`, explicitly verify it is absent from Production deployment secrets. Replit may sync Development secrets into deployment settings during publishing. Use only synthetic ephemeral keys until this isolation is verified; the currently reserved Journal `kid` is not attached to a configured key.
- Run cross-service contract tests against the two separate isolated development databases and synthetic accounts. Preserve the original five-minute authorization deadline, 120-second assertion limit, zero expiration grace, replay checks, revocation-retry-v1 idempotency, mismatch audit, and hash-matched acknowledgement.
- Keep the Journal and Signals databases, repositories, runtime flags, and secrets separate. Do not activate linking UI, a production worker, or production configuration during development testing.

Production/staging trust values, retention periods, migrations, rollout, and background jobs are not approved here and require a separate decision.

Until Signals and the Journal owner accept these items, do not enable the feature, change its runtime behavior, apply any migration, configure production keys/flags, expose linking UI, or treat any account as linked.
