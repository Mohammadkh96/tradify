# Tradify Journal ↔ Tradify Signals Account-Linking Contract

**Contract version:** `tradify-account-linking-v1`

**Status:** Journal-side development implementation; proposed for Signals review. Not jointly approved, not enabled by default, and not approved for production.

**Scope:** Associate one Journal account with one Signals account using explicit consent and opaque identifiers. This is not shared login or single sign-on.

## Ownership and non-goals

- Journal remains authoritative for Journal accounts, sessions, trades, challenges, billing and Journal entitlements.
- Signals remains authoritative for Signals accounts, sessions, strategies, signal events and Signals entitlements.
- Each product authenticates its own user. Neither product receives the other's password, password hash, session cookie, reset token, email address, billing details, or database credentials.
- V1 stores only Journal's internal `user_role.id` key (not its email-based session identifier), the Signals issuer and opaque Signals subject, consent version, consent timestamps, and link lifecycle timestamps.
- V1 does not synchronize customer data, trades, MT5 records, subscriptions, entitlements, payments, or admin permissions.
- Never match users by email, name, phone number, or similar profile fields.
- No Journal change authorizes a change to the Signals codebase or database.

## User flow

1. The customer is signed in to Journal and explicitly approves linking in Journal.
2. Journal creates a cryptographically random, single-use authorization code, valid for five minutes. Journal stores only its SHA-256 digest.
3. The customer signs in to Signals independently and explicitly approves linking there.
4. Signals sends the authorization code and a short-lived signed assertion to Journal over HTTPS.
5. Journal verifies the pinned Signals key and assertion, then consumes the authorization and creates the link in one database transaction.
6. A repeated delivery with the same assertion ID is idempotent. Reuse with different contents, an expired code, or a second competing link is rejected.
7. Journal's signed-in status endpoint reports only whether a link exists and when it was created. It does not return either product's user identifier.

The UI wording and consent text must be reviewed by both product owners before the feature is exposed. The Journal consent version in this development contract is `tradify-account-linking-v1`.

## Journal endpoints

Base path: `/api/v1/product-links/signals`

### Read the current user's link status

`GET /api/v1/product-links/signals`

Requires the user's Journal session. Returns either:

```json
{ "linked": false }
```

or:

```json
{ "linked": true, "linkedAt": "2026-10-15T12:00:00.000Z" }
```

The response intentionally contains no email, Signals subject, or Journal user ID.

### Create a Journal-approved authorization

`POST /api/v1/product-links/signals/authorization`

Requires the user's Journal session and an explicit consent body:

```json
{
  "consent": true,
  "consentVersion": "tradify-account-linking-v1"
}
```

Success (`201`) returns:

```json
{
  "authorizationCode": "<32 random bytes encoded as 64 lowercase hex characters>",
  "expiresAt": "2026-10-15T12:05:00.000Z",
  "consentVersion": "tradify-account-linking-v1"
}
```

The authorization code must be sent only in the HTTPS request body to the claim endpoint, never in a URL, analytics event, browser log, or application log. A new authorization invalidates the user's previous unconsumed authorization.

### Claim the authorization from Signals

`POST /api/v1/product-links/signals/claim`

Service-to-service HTTPS request. It does not accept a Journal user ID or email:

```http
Authorization: Bearer <short-lived-Signals-signed-JWT>
Content-Type: application/json
```

```json
{ "authorizationCode": "<code returned by Journal>" }
```

Success (`201`, or `200` for an identical retry) returns only:

```json
{
  "linkId": "<opaque Journal link ID>",
  "status": "linked",
  "linkedAt": "2026-10-15T12:00:00.000Z"
}
```

## Signals assertion

The current Journal implementation accepts an RS256 JWT with:

| Header/claim | Requirement |
| --- | --- |
| `alg` | Exactly `RS256` |
| `typ` | Exactly `JWT` |
| `kid` | Matches the operator-pinned `TRADIFY_SIGNALS_KEY_ID` |
| `iss` | Exact match for the operator-pinned HTTPS `TRADIFY_SIGNALS_ISSUER` |
| `aud` | `tradify-journal-link-v1` |
| `sub` | Stable, opaque Signals account ID; 1–255 characters; must not be an email address |
| `iat`, `exp` | Integer Unix seconds; assertion lifetime at most 120 seconds; reject expired or materially future-dated assertions |
| `jti` | Unique random assertion ID, 16–128 URL-safe characters; used for replay protection |
| `consent` | `true`, set only after Signals has authenticated the user and recorded their explicit approval |
| `consent_at` | Integer Unix seconds for the Signals approval, within the short assertion window |
| `consent_version` | `tradify-account-linking-v1` |
| `code_sha256` | Lowercase hex SHA-256 of the exact authorization code in the request body |

The private signing key stays in Signals. Journal receives only the verified public key through its environment configuration. Key rotation, key overlap, and emergency revocation must be agreed before production activation.

## Errors and security behavior

| HTTP status | Meaning |
| --- | --- |
| `400` | Missing/malformed request or missing explicit Journal consent |
| `401` | Missing or invalid Signals assertion, signature, issuer, audience, key ID, consent, or code digest |
| `409` | Expired/revoked/consumed authorization, replay conflict, or an already-linked account |
| `503` | Feature is disabled or required verified configuration is absent |

The claim endpoint consumes the authorization and stores the link and assertion ID in one transaction. Journal stores its internal numeric user-role primary key rather than the email address used as the session identifier. A database uniqueness constraint prevents one active Signals subject or one active Journal account from being linked twice under the same issuer. Replaying the same assertion ID with the same code and subject returns the original link result; changing any of those values is rejected.

## Journal configuration and migration

The Journal code requires all of the following:

- Development: `DEV_PRODUCT_LINKING_ENABLED=true`.
- Production: both `PRODUCT_LINKING_ENABLED=true` and `PRODUCT_LINKING_VERIFIED=true`.
- Both modes: `TRADIFY_SIGNALS_ISSUER`, `TRADIFY_SIGNALS_KEY_ID`, and `TRADIFY_SIGNALS_PUBLIC_KEY`.

Missing configuration fails closed with `503`. These flags are not enabled in the project configuration. The Journal schema migration is `migrations/0002_tradify_account_linking_v1.sql`; it is reviewed source only and is not run automatically or applied to production.

## Approval and remaining contract decisions

**Approved for this Journal development task:** develop a local, disabled-by-default Journal implementation; preserve independent product authentication; use explicit consent, opaque identifiers, signed assertions, short-lived one-time authorization, and replay protection.

**Awaiting Signals Agent and product-owner approval:** Signals' issuer and stable subject definition; its consent UX and wording; signing-key custody/rotation; error and retry handling; account unlink/revocation and recovery behavior; retention and cleanup policy; whether any user-facing link UI is wanted; and the migration/activation plan. The current implementation intentionally provides no unlink endpoint or user-facing linking UI until the two-sided lifecycle is agreed.

Until these items are reviewed and the counterpart is independently verified, do not configure the production flags, apply the production migration, display linking controls, or treat an account as linked in either product.
