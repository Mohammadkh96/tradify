# Tradify Integration Contracts

**Status:** A Journal-only development implementation of account linking is proposed in `TRADIFY_ACCOUNT_LINKING_V1.md`; no cross-project contract is jointly approved or production-enabled.
**Last reviewed:** 15 October 2026

This document describes Journal interfaces verified in this repository and proposals for future review. The local account-linking implementation is disabled by default and does not authorize changes to the separate Signals project. Compare the contract with the Signals project's report before activation.

## Existing Journal interfaces

These are Journal-local interfaces; none is a confirmed Signals or Tradigo API:

| Area | Current interface | Ownership |
| --- | --- | --- |
| Account access | `POST /api/auth/register`, `POST /api/auth/login`, email verification/reset routes, and an HTTP-only Express session persisted in Journal PostgreSQL | Journal owns its accounts and session authorization |
| MT5 ingestion | `POST /api/mt5/sync` accepts user/account snapshot and history data with the Journal sync token | Journal owns received account, position snapshot, and MT5 history records |
| Journal analysis | Authenticated Journal routes expose MT5 history, equity curves, performance intelligence, behavioral/strategy-risk checks, and prop-firm challenge state | Journal owns the calculations and resulting Journal/challenge data |
| Stripe billing | Journal-local subscribe, activation, portal, and `/api/stripe/webhook` routes | Journal owns its customer/provider links and Journal entitlement state |
| PayPal billing | Journal-local order/subscription/cancellation routes and `/api/paypal/webhook` | Journal owns its PayPal subscription link and Journal entitlement state |
| Admin operations | Protected `/api/admin/*` routes with Journal admin authorization and audit records | Each product must authorize and audit actions against its own records |
| Email | Journal account and notification flows using Journal email delivery/outbox controls | Journal owns its message triggers and delivery state |

The Journal schema also contains provider-profile, receiver, provider-subscription, and dispute tables. No matching public route family was found in the current route audit. These are Journal-local records, not a cross-product contract, and should be reviewed before reuse.

## Data ownership and provenance

- Journal PostgreSQL is authoritative for Journal identities, sessions, manual trades, MT5 accounts and imported MT5 history, challenge configuration/progress, Journal risk notifications, billing-provider references, and Journal admin audits.
- Signals is authoritative for its strategy configuration, published signal events, signal lifecycle state, notification state, and Signals entitlements.
- A future integration may store an explicit reference between a Journal trade and a Signals event. It must not copy or rewrite either product's authoritative records.
- Actual MT5 executions must not be assumed to have originated from a Signals event. A trade may be associated with a signal only through an explicit customer-confirmed link or a separately approved, auditable integration that supplies reliable provenance.
- Preserve source identifiers, account context, timestamps, and linkage actor. Do not infer an execution from matching symbol, side, or approximate timestamp alone.

## Proposed contracts for review — not approved

### Shared customer login

Consider a standards-based identity provider and versioned identity-claims contract. Products should map an external stable subject to their own local user records, require consent for account linking, and continue enforcing product-local authorization. Never share password hashes, session cookies, reset tokens, or secrets.

### Journal/Signals account association

The Journal-only development protocol is specified in [`TRADIFY_ACCOUNT_LINKING_V1.md`](TRADIFY_ACCOUNT_LINKING_V1.md). It associates opaque account identifiers after separate authentication and consent; it is not SSO. It remains disabled until Signals and both product owners approve the issuer, signing key/rotation, consent UX, and unlink/recovery lifecycle.

### Subscription bundles

If bundles are introduced, define product-scoped entitlement claims and a signed/versioned event or API contract for grant, renewal, grace, cancellation, and refund. Journal remains the authority for Journal access; Signals remains the authority for Signals access. A bundle must not silently convert one product's tier into another's.

### Central Admin Portal

A future `admin.tradifyapp.com` should use distinct service identities and narrow, auditable APIs. Each product validates the caller's role and scope, applies its own policy, and records the actor and action locally. Do not connect a central portal directly to either production database.

### MT5 trades linked to Signals events

Use an optional link record or field only after product owners approve the schema and API. The Journal trade/MT5 ticket remains the execution source of truth; the Signals event remains the signal source of truth. Require an explicit signal-event identifier from an approved connector or a customer-confirmed match, preserve provenance, and represent unmatched trades as unmatched. Never label a trade as automatically executed from a signal based only on market/time similarity.

### Cross-product navigation

Navigation may link to the other product with clear product labels. Until SSO is approved, each destination performs its own sign-in and authorization; navigation alone must not imply a shared session or entitlement.

## Approval and compatibility checklist

Before exposing or activating any cross-project contract, jointly approve:

1. The owning project, business purpose, data owner, and data minimization rules.
2. Versioned request/response schemas, stable identifiers, idempotency, and error semantics.
3. Authentication, authorization scopes, user consent, secret rotation, and audit requirements.
4. Entitlement and billing ownership, including renewals, grace periods, cancellations, and refunds.
5. Backward compatibility, contract tests, rollout/rollback order, observability, and incident ownership.
6. Any required changes in each repository, with explicit approval from both project owners.

Do not merge databases, reuse credentials, write directly into the other product's tables, or publish coordinated changes before this review.
