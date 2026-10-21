# Tradify Journal ↔ Tradify Signals Account-Linking Contract

**Contract version:** `tradify-account-linking-v1`

**Status:** Isolated-development coordination draft. The Signals product owner has approved the revocation retry rule in Section 5.7: fresh signed assertion, same immutable event ID and payload. Journal's independent acceptance of that rule remains pending, so the shared protocol is not finalized. Both development audience strings were reported acceptable by Signals. A stable HTTPS-formatted development issuer is proposed below as a JWT identity string; it is not a deployed endpoint, nor has it been approved by both owners. Exact key ID/public key, consent-copy approval, and written contract acceptance remain pending. This is not production approval and does not authorize enabling the existing Journal feature.

**Important compatibility note:** The current Journal code is a disabled-by-default prototype of the earlier draft. It does not implement this revised two-sided confirmation, preview, bidirectional unlink, or lifecycle contract. Do not enable it or apply its existing migration. Journal implementation must wait for Signals to confirm the development audience and provide the exact development issuer, key ID, and public key through secure configuration, followed by final written acceptance and Journal-owner approval.

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

Signals has approved the isolated-development policy direction. Identifiers that Signals has not explicitly confirmed remain provisional and block implementation until confirmed.

- Contract: `tradify-account-linking-v1`
- Journal initiation consent: `tradify-journal-link-initiation-v1`
- Journal final-confirmation consent: `tradify-journal-link-confirmation-v1`
- Signals consent: `tradify-signals-link-consent-v1`
- Development audience for Signals assertions to Journal: `tradify-journal-link-v1-dev` (reported acceptable by Signals for development; final contract acceptance pending).
- Development audience for Journal-signed requests to Signals: `tradify-signals-link-v1-dev` (reported acceptable by Signals for development; final contract acceptance pending).
- Proposed Signals development JWT issuer (identity only): `https://linking-dev.signals.tradifyapp.com` — a fixed identifier to be approved, **not** an existing host, deployed API, or a URL to call.
- Proposed Journal development JWT issuer for reverse requests (identity only): `https://linking-dev.journal.tradifyapp.com` — likewise only a proposed fixed identifier.
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

A code is single-use and expires five minutes after Journal issues it. A pending confirmation expires at the same authorization's original `expiresAt`; it receives no additional post-claim time. Journal must reject final confirmation at or after that deadline, even if the claim was accepted earlier. All preview, claim, and pending-link responses must return the unchanged original authorization `expiresAt`. A revoked, cancelled, or expired link cannot be reactivated; the customer starts a fresh two-sided flow.

## 4. Customer flow and safe code transfer

1. The customer signs in to Journal using Journal's own authentication. Journal displays the current local account label and explains that linking does not share sign-in or entitlements.

   Proposed customer wording from the Signals review (final UI copy still requires product-owner approval):

   > Connect your Tradify Journal and Tradify Signals accounts. You will continue signing in to each product separately. Your subscriptions, trading records, and account permissions will remain separate. You can disconnect the accounts later.

   Proposed Signals-specific consent wording (awaiting explicit product-owner approval; do not display as final approved copy):

   > Connect this Tradify Signals account to the Tradify Journal account for attempt **{journalAttemptLabel}** and Signals attempt **{signalsAttemptLabel}**. You will continue signing in to each product separately. This link does not share passwords, trading records, subscriptions, entitlements, or permissions. You can disconnect the accounts later. By selecting “Connect accounts,” you authorize Signals to send Journal a short-lived signed linking request for this account pair.

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

It does not accept or return a client-supplied `userId`, `sub`, email, or internal account mapping. The returned `expiresAt` is inherited from the original Journal authorization; a claim never extends it. Journal final confirmation must be completed before that timestamp.

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

Signals retries an identical claim with the same code and exact signed assertion and receives `200` with the same `linkId` and current state. It must not create a second link. The pending link inherits the original authorization expiry, and any claim or final-confirmation attempt at or after that deadline is rejected.

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
  "reason": "user_unlinked"
}
```

Allowed `reason` values are `user_unlinked`, `account_deleted`, `account_suspended`, and `security_action`. Each logical revocation creates exactly one permanent `eventId` and one immutable body containing `contractVersion`, `linkId`, `eventId`, and `reason`. Persist that payload and its SHA-256 hash before delivery. Canonicalize the payload using RFC 8785 JSON Canonicalization Scheme (JCS), UTF-8 encode the result, and hash those exact bytes. Never regenerate or alter the payload when retrying.

**Revocation retry rule ID:** `tradify-account-linking-v1/revocation-retry-v1`. This identifies the shared protocol behavior for implementation and acceptance; it does not add a request-body field or change the payload shown above.

Every delivery attempt signs the same event payload with a **fresh RS256 assertion**: generate a new unique `jti` for each attempt and set `exp = iat + 120` seconds. The assertion has `action: "revoke"` and claims matching the payload's `linkId`, `eventId`, and `reason`; issuer, audience, and `kid` must be the exact pinned values. An exact JWT replay (a previously used `(issuer, audience, jti)`) is rejected normally. A retry is not a JWT replay: it carries the same immutable event ID and canonical payload but a new assertion and `jti`.

The receiver verifies the assertion on every request—including signature, pinned `kid`, issuer, audience, timestamps/expiry, operation claims, and unused `jti`—before processing the event. It then deduplicates by `eventId` and canonical payload SHA-256, not by `jti`, compact JWT, or signature. If that event ID and hash were already applied, return the same idempotent acknowledgment without repeating side effects. If an event ID is already associated with a different canonical payload hash, reject with `409 REPLAY_CONFLICT` and record a security-relevant mismatch containing only the event ID and conflicting hashes. A valid acknowledgment identifies the event ID and payload hash so the sender can verify it acknowledges the immutable event it sent.

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
  "reason": "user_unlinked"
}
```

Journal-to-Signals uses the same shape signed by Journal, with the exact Journal development issuer, `sub: "tradify-journal-link-service"`, and the Signals-recommended reverse development audience `tradify-signals-link-v1-dev` only after Signals explicitly confirms it. Both directions use their own pinned development key IDs. The service `sub` identifies the signing service, not a customer. A receiver compares the signed claims with the POST body before applying the event.

A successful service revocation returns `200` with `{ "linkId": "<opaque UUID>", "state": "revoked", "eventId": "<same UUID>", "payloadSha256": "<64 lowercase hex characters>" }`. A repeat with the same event ID and canonical payload hash returns the same acknowledgment without repeating side effects, even though the retry uses a fresh `jti` and signature. The same event ID with a different payload hash returns `409 REPLAY_CONFLICT` and records the mismatch as a security event. An exact assertion replay with a previously used `jti` is rejected before event deduplication.

If the receiver is unavailable or returns a transient failure, the sender keeps its own link unusable in `revocation_pending` and retries the exact stored payload with a fresh assertion. Use bounded exponential backoff with a finite, explicitly configured base delay and cap for each environment (`delay = min(base × 2^attempt, cap)`; any jitter must also be bounded). Retry until a valid acknowledgment arrives and alert operators on sustained failures. Do not discard the event or mark the association `revoked` before the acknowledgment's event ID and payload hash match the outbox record. Concrete production retry values remain a separate approval.

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

**Development issuer proposal — explicit approval required:**

| Direction | Fixed JWT `iss` proposal | Fixed JWT `aud` | Approval status |
| --- | --- | --- | --- |
| Signals → Journal | `https://linking-dev.signals.tradifyapp.com` | `tradify-journal-link-v1-dev` | Audiences reported acceptable; issuer proposed only |
| Journal → Signals | `https://linking-dev.journal.tradifyapp.com` | `tradify-signals-link-v1-dev` | Audiences reported acceptable; issuer proposed only |

These are *proposed stable issuer identifiers*, not verified DNS names or deployed endpoints. Under the contract's explicit public-key pinning (no remote key discovery), JWT `iss` is compared as an exact string and **need not be fetched over HTTPS or resolve in DNS**. Development **API transport URLs are separate settings**: test services must actually reach each other over authorized HTTPS and must never default to production URLs. The changing Replit development preview must not be used as an issuer. These candidate names must be approved by both project owners and recorded consistently in both environments before use. If either Agent's implementation depends on a live issuer discovery endpoint, stop and request a different architecture/host approval rather than treating these identifiers as reachable services.

- For isolated development, Signals must approve the fixed development `iss` identifier (proposal above), generate a development-only signing key and `kid`, and provide its public signing key and `kid` through an approved secure configuration exchange. Both audience strings were reported acceptable; final written acceptance still controls configuration.
- Journal accepts only the exact confirmed development issuer, `kid`, and single-string audience. Reject audience arrays, aliases, prefixes, wildcards, unknown keys, and any production/staging trust material.
- The reverse development audience for Journal-signed requests to Signals is `tradify-signals-link-v1-dev`, reported acceptable by Signals; its corresponding Journal development issuer and signing public key must be approved and pinned separately.
- Development issuer, audience, `kid`, and public key are fixed by development-only configuration, never derived from request headers or client payloads. Do not put key material in Git, this document, or application logs.
- Staging and production trust configuration, key sets, and audiences require separate review and are not approved or specified here.

### Exact time rules

All times are integer Unix seconds and both services must use synchronized UTC clocks.

- `exp` must be strictly greater than verifier `now`; there is no post-expiration grace period.
- `exp` must be greater than `iat`; `exp - iat` must be at most 120 seconds.
- `iat` must be no earlier than `now - 120` and no later than `now + 30`.
- `consent_at` must be no earlier than `now - 120`, no later than `now + 30`, and no later than `iat + 30`.
- Any missing/non-integer timestamp, expired assertion, or value outside these bounds is rejected.

Signals approved the 30-second future issuance tolerance, 120-second maximum assertion lifetime, and zero expiration grace for isolated development. Production policy remains a separate decision.

### Key custody, rotation, and emergency revocation

- Each product owns its private key. Private keys remain in that product's managed secret store and are never exported to the other product.
- Use separate RSA keys of at least 2048 bits for each environment and direction. Share only the public key through an authenticated out-of-band configuration change.
- `kid` values are unique, immutable, and pinned to an exact public key and environment. Do not trust keys supplied in requests.
- For isolated development, Signals approved a maximum seven-day key overlap; publish and pin the next public key out of band, switch the signer, then remove the old key. Never overlap development and production keys.
- Emergency revocation is immediate: remove the compromised `kid`, reject its assertions, cancel pending authorizations and pending links signed with it, and review links created during the suspected compromise window. Record the event in each product's own audit log.
- Key rotation and emergency-revocation procedures must be exercised with synthetic keys before activation.

## 7. Replay, substitution, CSRF, and failure behavior

- Authorization codes contain 32 random bytes, are sent only in POST bodies over HTTPS, are stored as SHA-256 digests, expire after five minutes, and are consumed once.
- Journal consumes the code, creates the pending link, and stores the replay record in one database transaction with a row lock. Concurrent claims cannot both succeed.
- The assertion replay table has a unique key on `(issuer, audience, jti)`. Store only the SHA-256 fingerprint of the exact compact signed assertion, never the raw bearer JWT. Every use of an already-consumed `jti` is rejected, including an otherwise identical bearer-token replay.
- Revocation retries preserve one permanent event ID, the exact canonical payload bytes, and its SHA-256 hash. Each delivery gets a fresh RS256 assertion with a new unique `jti` and exactly 120 seconds of validity. Verify every assertion and consume its `jti` before event deduplication.
- The revocation inbox deduplicates on event ID plus canonical payload hash. Same event ID and hash returns an idempotent acknowledgment without repeating side effects; same event ID with a different hash returns `409` and creates a security-relevant mismatch record. Never deduplicate revocations by JWT fingerprint or `jti`.
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
- Each product owns delivery of its own outbound events and its authenticated inbound revocation handler. Persist the immutable canonical payload and hash in the outbox with the permanent event ID. Retry the same payload and event ID asynchronously with a fresh, valid assertion and unique `jti` on each attempt. Use bounded exponential backoff with an explicit finite base and cap; retain pending events and alert on sustained failure. Concrete production retry values and worker deployment remain separate decisions.
- For isolated development tests, use a deterministic outbox drain or an explicitly started manual development worker. Never start a worker by default in the Journal web process, and do not activate production background jobs.
- Account deletion must not wait for the other product: disable the local association, persist the signed revocation event and minimal pseudonymous audit tombstone, then continue the local deletion/anonymization. Retry remote delivery asynchronously. Do not rely on an account foreign-key cascade that silently erases the event.
- Account suspension immediately disables the link and sends a revocation event. Unsuspension does not automatically relink; both products require a new consent flow.
- Account recovery remains product-local. Signals cannot recover Journal access and Journal cannot recover Signals access. Recovery never uses email matching or transfers reset tokens. Any lost-access recovery or suspected-compromise recovery revokes active links and invalidates pending authorizations; ordinary authenticated password changes do not count as recovery. Require fresh linking consent after the owner regains access.
- Interrupted linking creates no active link. Authorization and pending-confirmation state expire no later than the original five-minute authorization-code deadline; the customer starts over. A new code invalidates the previous one.
- Keep synthetic development audit data minimal and remove it during test-environment teardown. Production retention and any customer-data retention periods remain undecided and require a separate review.
- Reconciliation compares only versioned link/event states by `linkId` and event ID. It never copies account data or entitlements. Conflicts fail closed and require both owners to review.

## 9. Required schema changes (proposal only)

No migration is included or applied by this document.

**Journal database changes expected after acceptance:**

- Authorization record: local Journal foreign key, code digest, Journal consent version/time, attempt label, creation/expiry/consume/revoke times, and state. Never store the raw code.
- Link record: opaque `linkId`, Journal local foreign key, exact Signals issuer and opaque subject, both attempt labels, separate consent versions/times, pinned signing `kid`, state (`awaiting_journal_confirmation`, `active`, `revocation_pending`, `revoked`), and lifecycle timestamps.
- Replay record: issuer, audience, `jti`, exact assertion fingerprint, code digest, link/event references, `kid`, and creation time; unique constraint on issuer/audience/`jti`.
- Transactional outbox: permanent event ID, canonical immutable payload bytes, payload SHA-256, link ID, operation, delivery state, retry timestamps, and acknowledgment. Generate a new assertion per attempt; never store a raw JWT.
- Revocation inbox/deduplication: unique event ID with canonical payload SHA-256, application result, and acknowledgment data. Same ID/hash is idempotent; same ID/different hash creates a security-relevant mismatch record and is rejected.
- Assertion replay ledger: unique `(issuer, audience, jti)` with the exact assertion fingerprint and expiry/creation data. Keep this independent from event deduplication so fresh-`jti` retries pass while bearer-token replays fail.
- Deletion-safe audit tombstone: minimal pseudonymous link/event reference and revocation time. Replace any cascade behavior that would erase an unsent revocation.
- Partial uniqueness constraints for one active/pending Journal account per issuer and one active/pending partner subject per issuer.

**Signals database changes expected after acceptance:**

- Signals-owned stable opaque subject generated and persisted server-side for each local account.
- Signals-owned consent record with its own consent version, timestamp, authenticated local account reference, contract version, attempt labels, and revocation state.
- Signals-owned link record containing its local account reference, Journal issuer/opaque link reference, state, timestamps, and local audit metadata.
- Signals-owned transactional revocation outbox/inbox and minimal deletion tombstones.

Signals schema names and migration details must be chosen by the Signals Agent in its own project. Do not connect to, inspect, migrate, or write the Signals database from Journal.

The existing Journal migration `migrations/0002_tradify_account_linking_v1.sql` is source only and has not been applied. It does not contain the full state, separate consent versions, two-phase confirmation, or revocation-outbox fields described here, and its account foreign keys use `ON DELETE CASCADE`, which can erase required revocation records. After acceptance, replace or revise it for isolated development so deletion preserves the outbox event and tombstone. Do not apply it to production or change production data.

## 10. Contract-test plan and current coverage

Contract tests must use two isolated development databases, synthetic `.invalid` accounts, ephemeral RSA key pairs, and mocked service-to-service calls. Use a deterministic outbox drain or an explicitly started manual worker in the isolated test environment; never start it automatically. Tear down synthetic audit data with the test environment. Never point tests at production or live customer data.

Required Journal and Signals contract cases before activation:

1. Both services independently require authenticated local sessions and separate versioned consent; missing, false, stale, or wrong-version consent is rejected.
2. Signals ignores a browser-supplied `userId`, `sub`, email, or account mapping and derives its subject from the authenticated server-side account.
3. A customer sees and confirms the exact Journal/Signals attempt-label pair on both consent surfaces; a changed label or account between preview and claim is rejected.
4. Authorization codes never appear in URL, browser storage, cookies, logs, analytics, traces, or error reports; preview does not consume or extend them.
5. Valid RS256 claim, status, and revocation assertions pass only for their exact environment issuer, audience, pinned `kid`, action, and operation.
6. Negative JWT cases: wrong algorithm/type/key/issuer/audience/action, unknown or revoked `kid`, `jku`/`x5u`, invalid signature, malformed or duplicate claims, email-like/client-selected subject, wrong code digest, missing consent, wrong consent version, bad labels, future/expired/malformed timestamps, and lifetime over 120 seconds.
7. Clock boundaries exactly test `iat = now+30`, `iat = now+31`, `iat = now-120`, `iat = now-121`, `exp = now`, `exp = now+1`, and `exp-iat = 120/121`. Also verify a code issued at `12:00` expires at `12:05`: preview, claim, pending status and confirmation never return or accept a `12:15` deadline, and final confirmation at `12:05` fails closed.
8. Single-use and concurrency: two simultaneous claims for one code yield one pending link; replay with the exact same assertion returns that link; same `jti` with any changed claim/body returns `409`.
9. Duplicate Journal or Signals accounts, code substitution, changed subject, changed issuer, and cross-environment assertions cannot create or confirm a link.
10. Journal final confirmation is restricted to the original Journal account and exact pending link. No link becomes active before both consent records exist.
11. Revocation retry: an initial valid delivery and multiple retries use one permanent event ID and byte-identical canonical payload/hash, but each uses a fresh assertion with a unique `jti` and exactly 120-second validity. Each JWT is independently verified; reused `jti` is rejected. A same-ID/same-hash retry returns the acknowledgment without repeating effects; same-ID/different-hash returns `409`, records a security-relevant mismatch, and does not mutate the link.
12. During remote outage, local state remains unusable and `revocation_pending`; bounded exponential retries continue with fresh assertions and never exceed the configured cap. The sender changes state to `revoked` only after receiving a valid acknowledgment matching both event ID and payload hash.
13. Unlink from either side, duplicate revocation, changed event replay, remote outage/retry, suspension, deletion, interrupted flow, recovery, and reconciliation all leave accounts and entitlements unchanged.
14. Responses and logs contain no passwords, emails from the other product, database IDs, raw authorization codes, raw JWTs, or private keys.

**Tests added in this Journal change:** the existing local security integration test now confirms that the Journal status, authorization, and claim endpoints all return `503` while the feature is disabled by default.

**Existing prototype test:** the Journal security integration suite also temporarily enables the earlier prototype inside an isolated test process/database with synthetic accounts. That test is not production configuration, does not apply a migration, and does not establish acceptance of this revised protocol. Its current generic audience and immediate-link behavior do not satisfy this revised contract. Replace/extend those assertions only after Signals accepts the proposal.

**Current runtime gate:** the existing Journal prototype is off unless `DEV_PRODUCT_LINKING_ENABLED=true` in development/test. Production additionally requires `PRODUCT_LINKING_ENABLED=true`, `PRODUCT_LINKING_VERIFIED=true`, and configured `TRADIFY_SIGNALS_ISSUER`, `TRADIFY_SIGNALS_KEY_ID`, and `TRADIFY_SIGNALS_PUBLIC_KEY`. This change sets none of these flags or values. The existing gate is not approval of the revised contract. Signals' gate remains for the Signals Agent to define in its own project.

## 11. Development implementation handoff

The Journal-only implementation sequence is documented in [`TRADIFY_ACCOUNT_LINKING_V1_IMPLEMENTATION_PLAN.md`](TRADIFY_ACCOUNT_LINKING_V1_IMPLEMENTATION_PLAN.md). Implementation is blocked until Signals confirms the exact development audience, securely provides the development issuer/key ID/public key, and gives final written acceptance; the Journal owner must also approve.

The development configuration must be isolated from production and exchanged through secure configuration only. Signals implements Signals-owned work in its own project; Journal implements Journal-owned work in this project. A development-only manual/deterministic outbox drain may run only when explicitly started for tests.

No production deployment, paid service, production database change, DNS change, email, billing, MT5 sync, or production background worker is authorized by this handoff. Production retention and rollout require a separate decision.

## 12. Decisions requiring Signals acceptance

Signals has approved the isolated-development policy direction described in its review: five-minute codes, 120-second maximum assertion lifetime, 30-second future issuance tolerance, zero expiration grace, up to seven days of key overlap, immediate emergency revocation, separate consent, no email matching, no shared credentials or entitlements, and the unlink/deletion/outbox responsibilities recorded above.

The Signals product owner has separately accepted the revocation retry rule in Section 5.7: fresh signed assertion, same immutable event ID and payload. Journal's independent review of `tradify-account-linking-v1/revocation-retry-v1` is **PENDING**: Journal reported implementation gaps and rejected technical acceptance until its code and schema are corrected and tested. This approval remains one-sided and does not finalize the shared protocol.

Before implementation, the remaining development gates are:

- Signals and Journal approve the proposed stable development issuer identifiers recorded in Section 6, or document replacement fixed identities. Do not confuse issuer identity with the changing HTTPS API transport origin.
- Both audience strings are reported acceptable by Signals: `tradify-journal-link-v1-dev` and `tradify-signals-link-v1-dev`. Written final contract acceptance is still required.
- Signals generates its isolated-development RSA signing key and `kid` and supplies only the public verification material to Journal through secure configuration; Journal does the equivalent for reverse-signed requests. Never put private keys in this document or commit them to Git.
- Signals gives final written acceptance of this exact contract, and the Journal owner separately approves implementation and records technical acceptance only after implementation changes and tests pass.
- Both product owners explicitly approve the Journal customer-facing wording and the exact Signals-specific consent text in Section 4; they review the detailed Journal and Signals schemas/API fixtures.

Production/staging trust values, retention periods, migrations, rollout, and background jobs are not approved here and require a separate decision.

Until Signals and the Journal owner accept these items, do not enable the feature, change its runtime behavior, apply any migration, configure production keys/flags, expose linking UI, or treat any account as linked.
