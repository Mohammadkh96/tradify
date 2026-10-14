# Tradify Ecosystem

**Last reviewed:** 14 October 2026

## This project: TradifyApp Journal

**Domain:** https://tradifyapp.com
**Purpose:** Trading journal and performance-management platform.

This repository is the original TradifyApp Journal. It owns customer journal accounts, actual trade records, MT5 account/history data, prop-firm challenge progress, Journal risk monitoring, Journal subscriptions, and Journal administrative actions.

## Journal architecture and responsibilities

### Web application and branding

- A React/Vite client and Express API are served by the same application.
- TradifyApp has its own customer-facing brand, marketing pages, pricing, free tools, prop-firm pages, and blog. Its current visual identity is distinct from the Signals product; no shared navigation or shared login is assumed by this report.
- The original deployment configuration is Autoscale with `npm run build` and `node ./dist/index.cjs`. No deployment is currently active for this Replit workspace; `tradifyapp.com` may be served by another deployment. DNS was not changed.

### Authentication and authorization

- Journal accounts use the Journal's own account records, password verification, email-verification/reset flows, and Express sessions persisted in PostgreSQL.
- Admin routes use Journal-local authorization (`requireAdmin`); admin access and audit records are stored with the Journal's data.
- There is no confirmed shared SSO or identity contract with Signals or Tradigo. Do not reuse password hashes, session secrets, or privileged credentials across products.

### Database and authoritative data

- Production remains the existing Neon project `Tradify` (`green-art-19890518`), branch `production` (`br-empty-wildflower-ahbsfyzr`), database `neondb`, endpoint `ep-sparkling-moon-ahtc0gbu`.
- Development and synthetic tests use the separate `tradifyapp-dev` project through `DEV_DATABASE_URL`; no production records are copied there. Production selects `DATABASE_URL`, which has been preserved and not inspected or replaced.
- Journal-owned records include account/authentication and entitlement state (`user_role`), manual journal entries (`trade_journal`), MT5 accounts/current snapshots/history (`mt5_accounts`, `mt5_data`, `mt5_history`, `daily_equity_snapshots`), prop-firm challenge definitions and daily progress (`prop_firm_challenges`, `prop_firm_daily_stats`), and Journal admin/audit records. The schema also retains Journal-local `signal_provider_profile`, `signal_receiver`, `provider_subscription`, and dispute tables; their names do not establish a connection to the separate Signals product.
- These Journal records remain authoritative in the Journal database. Signals strategy and signal-lifecycle records remain authoritative in the separate Signals product. Neither product should write directly into the other's database.

### MT5 synchronization and risk

- The Journal's `POST /api/mt5/sync` endpoint is the ingestion path for account snapshots and MT5 history; requests are associated with a Journal user and sync token.
- Journal challenge monitoring can use a customer-selected MT5 account to update challenge balance/risk state. Journal analytics and risk/behavior checks operate on Journal manual trades and imported MT5 records.
- There is no server-side MT5 polling loop in the web/API process. The endpoint is disabled in development unless explicitly enabled for an isolated test.
- An MT5 fill is evidence of an actual trade on the connected account. A Signal event is evidence of a published signal and its lifecycle. Neither implies that the other caused it.

### Journal-local signal-provider records

The Journal schema includes provider profiles, receivers, and provider subscriptions that are separate from Tradify Signals. A repository search found no corresponding public route family for these tables, so their current product usage should be verified before extending or migrating them. Do not treat them as a shared Signals API or as authority for Signals events.

### Subscriptions and payments

- Journal tiers (`FREE`, `PRO`, `ELITE`, `COACH`), provider identifiers, billing periods, status, and renewal information are represented in Journal-owned account/entitlement data.
- Stripe and PayPal checkout, webhook, subscription, and cancellation flows are Journal-local. No shared bundle, cross-product entitlement, or shared payment webhook has been approved.
- Development Stripe testing used test mode; PayPal sandbox credentials are not configured. Production billing configuration has not been independently verified.

### Admin operations and email

- The Journal Admin Dashboard manages Journal users, access tiers, content/marketing operations, backups, and support actions through protected Journal routes.
- Admin audit records belong to the Journal. Future central administration must call narrowly scoped service APIs; it must not bypass each product's authorization or audit trail.
- Email delivery and notification state are product-local. Production SMTP and any external delivery jobs require separate verification and approval.

## Other Tradify products

### Tradify Signals

**Domain:** https://signals.tradifyapp.com
**Purpose:** Separate algorithmic trading-signals product.

Signals owns its strategy definitions, signal events and lifecycle, notification state, and Signals entitlements. This Journal workspace has not inspected or modified the Signals repository or database.

### Tradigo

**Purpose:** Future marketplace for coaching sessions and appointments.

Tradigo is outside this workspace and must not be implemented or modified as part of Journal work.

## Future integration opportunities

Potential future work, subject to comparison of both product architecture reports and explicit approval:

1. Federated customer login with a stable cross-product identity mapping and account-linking consent; each product would retain its own authorization decisions.
2. Product-specific subscription bundles backed by an explicit entitlement contract; Journal and Signals remain authoritative for their respective access grants.
3. A central Admin Portal that delegates to audited, least-privilege Journal and Signals APIs instead of sharing databases or admin credentials.
4. Optional, user-confirmed linking between a real MT5 deal and a Signals event, as described in `INTEGRATION_CONTRACTS.md`.
5. Clearly labeled cross-product navigation that preserves independent product identities and does not imply shared sessions before SSO exists.

## Production blockers — Journal

- Replit currently reports no active deployment for this workspace. Published availability and `tradifyapp.com` routing are not verified here; publishing and DNS changes remain unapproved.
- Neon metadata currently reports the original production branch as `ready` and its compute as `idle`. A screenshot showed an archived banner, so that discrepancy must be resolved before connection. No production SQL or data-count query has been run; any compute wake requires prior approval.
- A manual snapshot is not required for a basic read-only check and was not created. The production data counts remain unverified.
- PayPal sandbox checkout cannot be tested until dedicated development sandbox credentials are available. Stripe was tested only in test mode.
- The latest safe dependency audit reported 13 high, 14 moderate, 1 low, and no critical findings. Major-version or upstream issues need separate compatibility review before publishing.

## Production blockers — Signals

Signals is a separate project. Its blockers are not assessed or repeated here; consult its owning project's architecture report. Do not infer that a Journal fix resolves a Signals issue, or restart paused Signals work from this report.

## Isolation and release rules

- Keep source, production databases, secrets, payment webhooks, authentication, and deployments separate by product.
- Keep `tradifyapp-dev` for development. Preserve the original Journal production database and connection configuration.
- Ask before waking production compute for a short read-only check. Do not run migrations, seed data, send email, run MT5 or scheduled jobs, publish, or change DNS without explicit approval.
- Compare both architecture reports and approve a versioned contract before implementing any cross-project integration.
