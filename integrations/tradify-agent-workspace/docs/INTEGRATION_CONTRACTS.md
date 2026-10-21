# Tradify integration contracts

**Last reviewed:** 2026-10-19
**Contract status:** Journal ↔ Signals V1 customer-facing copy and isolated-development scope are approved by the Signals product owner; partner-side technical acceptance and key verification remain pending. Production linking is not approved.

This document distinguishes existing Signals interfaces from possible future Tradify ecosystem integrations. A proposal below is not permission to connect systems or change another product.

## Existing Signals interfaces

| Interface                       | Current owner                                       | Status                                                          | Boundary                                                                                                                   |
| ------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Signals customer/Admin REST API | Tradify Signals API Server                          | Implemented; contract maintained in `lib/api-spec/openapi.yaml` | Signals clients use the shared API. Backend authorization and Signals entitlements remain authoritative.                   |
| RevenueCat billing webhook      | Signals API Server                                  | Implemented                                                     | Verifies provider events and updates Signals-specific membership state. It is not a Journal billing contract.              |
| MT5 bridge API                  | Signals API Server                                  | Implemented for Signals market-data ingestion                   | Uses a Signals-specific bridge credential and market-data validation. Do not reuse its credential in another product.      |
| Customer account-recovery email | Signals API Server via Resend connector             | Implemented, subject to sender/origin configuration             | Recovery messages must use the approved Signals sender and public origin.                                                  |
| Web Push                        | Signals API, database queue, and PWA service worker | Partially implemented; delivery blocked                         | Requires VAPID configuration and successful device receipt verification. Native push is not implied by this web interface. |

## Proposed future cross-product interfaces

### Journal ↔ Signals

**Status: V1 customer consent and account-pair review approved for isolated development only; cross-service verification remains incomplete.**

See [Tradify Account Linking V1](./TRADIFY_ACCOUNT_LINKING_V1.md) for the approved scope, consent wording, privacy boundaries, and deadline behavior. The approval does not authorize production linking, deployment, paid infrastructure, or access to real customer data. Do not share PostgreSQL databases, copy customer credentials, or let either product query the other's tables directly.

The contract must define:

- Which product owns the signal, trade, user identity mapping, and any linked-record identifier.
- A narrowly scoped authentication mechanism and authorization checks for each operation.
- Explicit customer authorization for linking or transferring account/trade data.
- The minimum fields required; do not transfer MT5 credentials, full account histories, or unrelated personal data.
- Idempotency, event ordering, retries, deletion/unlink behavior, retention, and audit requirements.
- Versioning, backward-compatibility guarantees, contract tests, rollout order, and rollback behavior.
- Independent deployments and explicit approval from both project owners before implementation.

No shared SSO, identity database, subscription bundle, or cross-product entitlement endpoint is currently approved.

### Tradigo

**Status: future product; no Signals integration approved.**

Any future marketplace relationship must be defined in a separate contract. Do not create accounts, APIs, tables, or deployment configuration for Tradigo from this workspace.

### Central Admin Portal

**Status: roadmap concept only.**

Signals Admin remains a separate staff portal with Signals backend capabilities. A future central portal must not bypass per-product authorization, audit, data ownership, or independent release boundaries.

## Change approval and handoff

Before a proposed change crosses a product boundary:

1. Identify the owning projects and the data/API dependency.
2. Draft or revise this contract, including scope, security, versioning, and failure behavior.
3. Add contract tests and document the rollout/rollback order.
4. Get explicit approval before changing another project, its production systems, DNS, databases, or secrets.
5. Report exactly which repositories and environments were changed or verified; never claim work on a project that was not accessed.
