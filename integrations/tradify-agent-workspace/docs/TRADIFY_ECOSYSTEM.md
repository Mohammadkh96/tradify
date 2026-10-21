# Tradify ecosystem context

**Last reviewed:** 2026-10-14
**Workspace identity:** Tradify Signals
**Scope:** This repository only. No Journal or Tradigo source, database, deployment, DNS, or secrets were accessed or changed.

## Product responsibilities

### Tradify Signals — this workspace

Signals is the algorithmic trading signals product at the requested domain `https://signals.tradifyapp.com`. It owns its signal strategies and lifecycle, Signals customer identities and entitlements, notification state, and Signals-specific operations.

The workspace contains:

- **Customer app:** `artifacts/tradify-signals`, an Expo Router / React Native app that also supplies the PWA. Native Android/iOS distribution remains a separate future path; the PWA and native clients use the same Signals API and product state.
- **Signals Admin:** `artifacts/tradify-admin`, a separate staff-only web artifact at `/tradify-admin/`. Administrative tools stay on web; staff capabilities are checked by the backend.
- **API Server:** `artifacts/api-server`, the shared Express API for customer and Admin clients, authentication, memberships, billing callbacks, market data, signal lifecycle, notification state, and operational controls.
- **Shared libraries:** `lib/api-spec/openapi.yaml` defines the API contract; generated API types live in `lib/api-zod`. `lib/db/src/schema/` is the Drizzle schema source for the workspace PostgreSQL database.

The current artifact production configuration points the PWA API at `https://tradify-signals.replit.app`. The requested custom domain `signals.tradifyapp.com` has not been independently verified here; no DNS or domain configuration was changed.

## Other Tradify products

The following descriptions come from the user-provided shared context and have not been independently verified in those projects:

- **TradifyApp Journal** (`https://tradifyapp.com`) is a separate trading journal and performance-management product. It owns journal and MT5 account records, risk monitoring, journal billing records, and journal administration.
- **Tradigo** is a future marketplace for coaching sessions and appointments. It is not part of this workspace and is outside the current implementation scope.

The supplied context describes Journal's features as trading journals, MT5 account synchronization, trading analytics, prop-firm challenge monitoring, risk management/alerts, subscriptions/payments, email notifications, and administration. Its direction is deterministic analytics, reduced generative-AI runtime use, continued use of its existing Neon PostgreSQL database, reliable background processing, and restoration/verification of its own production deployment. These are user-provided facts and plans, not independently verified here.

The long-term ecosystem vision includes consistent branding, cross-product navigation, possible shared sign-in, product-specific or bundled entitlements, a central Admin portal, authenticated service APIs, optional Signals/Journal trade reporting, coordinated analytics, and independent deployments. These are roadmap goals only; they do not authorize shared production systems or current integration work.

## Current architecture and integration points

- The products in this workspace are organized as a pnpm monorepo, but Signals customer, API, Admin, and database components have distinct artifact/package boundaries.
- Signals uses the Replit-managed PostgreSQL database attached to this workspace through the runtime-managed database configuration. Do not copy its URL or data into another product.
- The Expo app calls the shared Signals API; the PWA is not a second backend or a second customer database.
- RevenueCat is the Signals store-billing integration. The API verifies its webhooks and stores Signals membership/entitlement state.
- The MT5 bridge supplies broker market data to the Signals API. Market-data providers/fallbacks remain governed by Signals trust and authority rules.
- Resend is used through the configured connector for account-recovery email. Web Push has subscription and queue handling, but delivery is blocked by incomplete VAPID configuration and real-device receipt verification.
- No Journal-to-Signals API, shared database, shared identity/SSO, or cross-product entitlement service is implemented or approved in this workspace.

## Security and isolation boundaries

1. Keep Journal, Signals, and Tradigo source repositories, production databases, secrets, deployment pipelines, and DNS independent.
2. Never connect directly to another product's database or reuse its production URL, authentication secret, webhook secret, or privileged service credential.
3. Cross-product data exchange must use a documented, authenticated, versioned service API with explicit authorization/consent and least-privilege data.
4. Keep product-specific identity and entitlements authoritative in their current product until an explicit, approved SSO/entitlement design exists.
5. Keep Admin actions server-authorized and audited. Do not expose session tokens or credentials in Admin views, logs, or documentation.
6. Independent production releases are required. A change in one product does not authorize deployment, configuration, or data changes in another.

## Current priorities and blockers

- **Current authorized focus:** development work other than Task 381. The specific next development priority was not identified in the supplied context; do not infer one or resume Task 381 automatically.
- Task 381 (notification production/physical-device verification) is **requested ON HOLD / BLOCKED**. Do not resume it without explicit authorization. The task feed reported it as **CANCELLED** on 2026-10-14; that does not match the requested hold state and it must not be treated as completed.
- Web Push delivery still needs Development VAPID configuration and a successful receipt check on a real Android device.
- Admin notification controls are not wired, and production Admin/notification verification remains blocked pending a user-approved publish.
- The last documented production Admin check was HTTP 500; this was not rechecked or changed during this documentation work.
- The last live-quotes smoke check returned HTTP 502. This does not establish current production market-data health.
- Production RevenueCat webhook configuration was recorded as incomplete in the release-readiness audit.
- Account-sharing limits and per-device controls remain unimplemented; the existing security hardening does not satisfy the full device/session policy.
- No production publish, database/schema migration, secret change, EAS build, paid deployment, or DNS change was performed for this context update.

For detailed release blockers, environment variables, schema flow, and the Task 381 resume checklist, see [RELEASE_READINESS.md](../artifacts/tradify-signals/RELEASE_READINESS.md).
