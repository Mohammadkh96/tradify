# Tradify Signals — Application Details

**Document scope:** Source-based overview of the Tradify Signals mobile application and its API. It describes behavior implemented in this repository and configured workspace services; it does not claim that a particular production deployment, provider entitlement, store product, or external integration is currently active.

**Security note:** This document intentionally contains no passwords, session tokens, API-key values, bridge secrets, customer records, or production database contents. Configuration names may be listed, but secret values belong in Replit Secrets.

## Contents

1. [Product overview](#product-overview)
2. [System architecture](#system-architecture)
3. [Repository and workspace artifacts](#repository-and-workspace-artifacts)
4. [Mobile application screens](#mobile-application-screens)
5. [Market data and strategy evaluation](#market-data-and-strategy-evaluation)
6. [Customer data and trust boundaries](#customer-data-and-trust-boundaries)
7. [Authentication, accounts, and administration](#authentication-accounts-and-administration)
8. [Subscriptions and billing](#subscriptions-and-billing)
9. [API route inventory](#api-route-inventory)
10. [Persistence and synchronization](#persistence-and-synchronization)
11. [Integrations and configuration](#integrations-and-configuration)
12. [Development, build, and test commands](#development-build-and-test-commands)
13. [Known limitations and release checks](#known-limitations-and-release-checks)
14. [Important source references](#important-source-references)

## Product overview

Tradify Signals is a trading-market monitoring and decision-support application. It presents market opportunities, live or reference prices, watchlists, charts, strategy setup labels, risk planning, trade records, notifications, account features, and an operations console.

The core customer flow is:

1. Browse the opportunity feed or market watchlist.
2. Open a symbol’s detail view.
3. Review its assigned setup and choose another setup from that symbol’s approved choices.
4. Inspect price history, signal direction, and risk information.
5. See strategy trade levels only when the server and client trust checks confirm fresh, validated market data.
6. Save alerts, watchlist changes, and trade records through the account features.

The application is not an identified brokerage order-entry system. The inspected customer routes support signals, planning, monitoring, and trade records; no customer order-placement route was identified in the inspected API surface.

The UI distinguishes live data from reference, stale, or otherwise untrusted data. A displayed price or chart is not by itself evidence that strategy levels are validated.

## System architecture

```text
MT5 bridge ──quotes/candles/specs──▶ API ingestion and persistence
                                          │
External provider adapters ──────────────┤
                                          ▼
                          symbol mapping, quality checks,
                          source authority and validation
                                          │
                              trusted M15 evaluation
                                          │
                         sanitized customer API responses
                                          │
                                          ▼
                               Expo mobile application
                                          │
                     authenticated account/billing actions
                                          ▼
                              PostgreSQL-backed API state
```

### Main components

| Component | Responsibility |
| --- | --- |
| Expo mobile app | Customer screens, local preferences, chart presentation, account flows, membership UI, and admin console UI. |
| Express API server | Market-data intake and reads, strategy evaluation, user/session routes, account state, notifications, admin operations, billing reconciliation, and customer DTO sanitization. |
| PostgreSQL and Drizzle schema | Persistent user, account, audit, market-authority, bridge/candle, and billing data represented by the server schema. |
| Shared OpenAPI/client packages | API contract, generated request functions and schemas used by the app. |
| MT5 bridge | Authenticated ingestion path for broker-connected quotes, candles, specifications, heartbeats, and subscriptions. |
| External market adapters | Source adapters that may provide reference or shadow data; adapter presence does not prove that the source is entitled, available, authoritative, or safe for strategy evaluation. |
| RevenueCat | Store purchase and webhook integration for membership state and transfer reconciliation. |

The local API bridge store and production persistence are separate runtime contexts. Do not assume that development contains the same candle history, provider state, or account data as a deployed instance.

## Repository and workspace artifacts

This is a pnpm workspace. The `pnpm-lock.yaml` uses a v9 lockfile format; the repository does not pin an exact pnpm version with a `packageManager` declaration. The configured Replit environment uses Node 24.

| Artifact | Directory | Purpose | Configured service |
| --- | --- | --- | --- |
| Tradify Signals | `artifacts/tradify-signals/` | Expo mobile/web preview and static build | `artifacts/tradify-signals: expo`; preview at `/`; Expo dev service uses injected `$PORT`. |
| API Server | `artifacts/api-server/` | Shared Express backend | `artifacts/api-server: API Server`; API is mounted under `/api`; artifact configuration maps local port 8080 and the process reads injected `PORT`. |
| Canvas / component preview | `artifacts/mockup-sandbox/` | Isolated UI component previews | `artifacts/mockup-sandbox: Component Preview Server`; preview path `/__mockup`, local service port 8081. |

The `live-quotes` workflow runs `pnpm --filter @workspace/scripts run check:live-quotes`. It is a validation/check workflow, not the mobile UI or API service.

## Mobile application screens

The Expo Router screens are under `artifacts/tradify-signals/app/`.

### Main tabs

| Route | Tab label | Main behavior |
| --- | --- | --- |
| `/` | Opportunities | Filters the setup feed by market and session, refreshes market state, opens signal details, and provides an honest empty/monitoring state when no qualified opportunity is available. |
| `/watchlist` | Watchlist | Switches between watchlist and market catalog, searches and filters symbols, adds/removes symbols, refreshes data, and opens a symbol’s detail view. |
| `/trades` | Active Trades | Shows trade records and progress information; supports plan inspection, local partial-lock state, and close actions. |
| `/performance` | Performance | Summarizes closed-trade results, including return, win rate, profit factor, expectancy/drawdown, and breakdowns. |
| `/notifications` | Alerts | Shows notifications, read state and sync status; opens related signals and supports marking notifications read. |

The `/notifications` route is presented with an “Alerts” tab label; price alerts are managed separately at `/alerts`.

### Additional routes

| Route | Purpose |
| --- | --- |
| `/signal/[id]` | Symbol/signal detail, setup chooser, live/reference price state, multi-timeframe chart, validation snapshot, trade-plan workspace, proximity display, and commentary action. |
| `/alerts` | Create, view, and delete price alerts with ABOVE, BELOW, or EXACT conditions, target price, and label. Can be opened with a symbol/target from a signal. |
| `/risk` | Position-sizing and risk calculator with balance, risk percentage, currency, entry and stop inputs plus readiness/estimate disclosures. |
| `/profile` | Profile, membership, preferences, sign-in/out, onboarding replay, account deletion, and auth-token persistence retry. |
| `/settings` | Display name, account size, risk percentage, maximum daily loss, and aggressive-setup preference. |
| `/onboarding` | Three-step product guide with continue and skip actions. |
| `/auth` | Sign-in and ordinary trader registration. Admin registration is not offered in this UI. |
| `/membership` | Free/Pro/VIP comparison, purchase/restore controls, membership sync, billing recovery and sign-in paths. |
| `/admin` | Role-gated Operations console for CRM, account/membership/role changes, audit, engine controls, market controls, diagnostics and lab access. |
| `/lab` | Admin-only strategy diagnostics screen. |
| `/legal` | Risk/data notices and privacy, terms, and account-deletion links. |
| `+not-found` | Unknown-route fallback with a route back to the app. |

`/profile` and `/lab` are registered as hidden-tab routes rather than additional visible tab buttons. The tab layout uses NativeTabs when the required iOS liquid-glass capability is available, and falls back to classic tabs for other supported cases.

### Signal detail and setup selection

The detail screen obtains a symbol’s catalog entry, default setup, and available setup labels. The selected setup precedence is:

1. Saved choice for that symbol.
2. Catalog default.
3. Setup label from the signal.
4. Existing signal strategy label.

Only curated labels present in that symbol’s catalog options appear in the picker. A selection is stored per symbol, then triggers a new evaluation request for that symbol/setup. The API rejects a disabled setup or one not assigned as available for the requested symbol.

The screen supports the following chart timeframes: M1, M5, M15, M30, H1, H4, D1, W1, and MN1. It also supports Candles/Heikin-Ashi, entry/target/stop layer toggles, zoom/reset, expansion, and older-history loading. The chart renderer uses an HTML/web renderer on web and a React Native WebView on native, with a message bridge for chart data and controls.

## Market data and strategy evaluation

### Data path

1. The bridge posts quotes, candle batches, symbol specifications, and health/heartbeat data through bridge-protected routes.
2. The server maps broker/source symbols to canonical customer symbols.
3. Provider adapters report candidate data; provider capability, entitlement, quality, freshness, authority and series checks determine what is usable.
4. The server creates market snapshots and chart responses, with display-only/reference states retained when data is not strategy-authoritative.
5. Strategy evaluation uses trusted data and returns a sanitized signal projection.
6. The app independently gates visible strategy levels on the response’s live state and candle-validation evidence.

The source includes provider registry, capability/quality policy, series validator, fallback mapping, authority persistence, diagnostic sanitization, MT5 bridge storage/provider code, external shadow adapters, and a crypto shadow adapter.

### Trust and level visibility

Strategy levels are not unlocked merely because a quote exists or a chart can be rendered. At the detail-screen level, the M15 series must be LIVE, not display-only, and have successful validation; the evaluated signal must also remain in a live/trusted state. Reference and stale data remain clearly identified and do not satisfy this gate.

The customer chart can display reference candles without treating them as trusted strategy inputs. The detail screen also keeps its plan workspace membership gate separate from its market-data trust gate; the exact desired entitlement policy for chart overlays should be reviewed before changing either gate.

### Setup labels

Customer-facing labels are allow-listed:

- Gold setup
- FX setup
- BBB setup
- BBB Gold 3S

The API returns friendly labels and per-symbol available options. The app maps a selected label to a constrained evaluation request; the server validates that request against the enabled symbol catalog. Raw strategy identifiers and engine facts are not included in customer response DTOs.

## Customer data and trust boundaries

### Public data

Public market and signal DTOs may include customer-useful fields such as:

- Canonical symbol/name and asset class.
- Quote and candle values with explicit state/validation metadata.
- Signal direction/grade/action/status and price.
- Friendly setup label and available friendly setup labels.
- Level values only when authorized by the market-data trust gate.

Public DTOs omit provider/broker identity, broker symbols/specifications, strategy engine identifiers, strategy facts, provenance, raw bridge ticks, and operational diagnostics.

### Operational/admin data

Provider health, authority evidence, bridge state, raw or nested diagnostics, engine information, and provider-specific facts belong on authenticated/admin or bridge-protected routes. Diagnostic payloads are sanitized at customer boundaries.

### Risk notices

The app includes risk calculator and legal/risk information. It should be treated as decision support; a signal, score, chart, or reference price is not a guarantee of performance and is not a substitute for independently checking risk and market conditions.

## Authentication, accounts, and administration

### Customer accounts

- Self-registration creates an active ordinary `user` account; registration does not make an account an administrator.
- Sign-in/registration issue HMAC-signed session tokens with a 30-day expiry.
- Auth middleware checks the signature, expiry, persisted account, revocation timestamp, and account status. Suspended, banned, and deleted users are rejected.
- Logout advances the persisted invalidation boundary so existing sessions can be revoked.
- Native auth tokens use SecureStore with legacy migration. The web app uses memory-only token persistence; do not assume a web refresh retains an authenticated session.
- User profile, watchlist, alerts, trades, notification and membership operations use authenticated API routes where applicable.

### Admin access

Admin APIs require both an authenticated account and the `admin` role. Self-registration does not create an admin account, and the mobile auth screen does not provide admin registration. An existing admin can promote another account through the admin user-management routes. Self-demotion is rejected by the server.

No production first-admin/bootstrap procedure was confirmed from the inspected implementation. There is no shared default admin username/password documented here. Do not put administrator passwords or tokens in this file.

### Admin console features

The console’s source UI includes:

- User search/filtering and member CRM views.
- Account state, membership, entitlements, and role actions.
- User notes and audit history.
- Engine status and pause/resume controls.
- Market controls and setup assignment controls.
- Market-data matrix and operational health views.
- Signal/candle diagnostics and strategy lab access.
- Billing transfer/recovery views.

## Subscriptions and billing

The app exposes Free, Pro, and VIP membership tiers. The Expo client contains RevenueCat purchase/restore integration. Source gates native purchases on authenticated users and platform configuration; client selection or a purchase attempt alone is not authoritative membership confirmation. Membership is synchronized with server state.

The API includes RevenueCat webhook verification and event reconciliation, as well as account-transfer recovery paths. Reconciliation is intended to grant or transfer access only to known local accounts, with persisted event identity/timing and cross-instance locking/order controls.

**Availability caveat:** A server-side membership upgrade route currently refuses checkout, and actual store products, offers, billing keys, and deployed RevenueCat configuration were not verified. Do not assume end-to-end purchases are live solely because the UI or integration package exists. Native store release readiness also includes external product/legal configuration work.

## API route inventory

The Express router is mounted under `/api`. The inventory below reflects runtime route implementation. It is broader than the current OpenAPI document, which does not yet describe every runtime route or all Bearer/user/admin security.

### Public routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/healthz` | Service health. |
| `GET` | `/api/market-ready` | Market service readiness. |
| `GET` | `/api/market/snapshot` | Customer-safe snapshot, quotes, signals, and setup assignments. |
| `GET` | `/api/market/quotes` | Customer-safe quote feed. |
| `GET` | `/api/market/stream` | Server-sent live quote/bridge updates. |
| `GET` | `/api/market/candles` | Canonical-symbol candle series with data state and validation fields. |
| `GET` | `/api/markets/catalog` | Symbol catalog, current quote summary, and curated setup options. |
| `GET` | `/api/signals/current` | Current signal(s), optionally for a symbol. |
| `GET` | `/api/signals/evaluate` | Evaluation for a symbol and optional constrained setup selection. |
| `GET` | `/api/legal/privacy` | Privacy information. |
| `GET` | `/api/legal/terms` | Terms information. |
| `GET` | `/api/legal/account-deletion` | Account-deletion information. |
| `POST` | `/api/legal/account-deletion/request` | Account-deletion request. |

### Authenticated user routes

`POST /api/auth/register` and `POST /api/auth/sign-in` establish ordinary sessions. `POST /api/auth/logout` and `GET /api/auth/me` require an authenticated session.

| Methods | Path | Purpose |
| --- | --- | --- |
| `GET`, `PATCH` | `/api/user/profile` | Read/update profile. |
| `DELETE` | `/api/user/account` | Delete the current user account. |
| `GET` | `/api/membership/status` | Read server-confirmed membership state. |
| `POST` | `/api/membership/sync` | Synchronize membership state. |
| `POST` | `/api/membership/upgrade` | Membership upgrade endpoint; checkout is currently unavailable in server implementation. |
| `POST` | `/api/user/sync` | Synchronize user-facing account state. |
| `GET`, `POST` | `/api/user/alerts` | Read/create price alerts. |
| `DELETE` | `/api/user/alerts/:id` | Delete a user alert. |
| `GET` | `/api/user/notifications` | Read notification history. |
| `PATCH` | `/api/user/notifications/:id/read` | Mark one notification read. |
| `POST` | `/api/user/notifications/read-all` | Mark all notifications read. |
| `GET`, `POST` | `/api/user/trades` | Read/create user trade records. |
| `POST` | `/api/user/trades/:id/actions` | Apply a trade-record action. |
| `GET`, `POST` | `/api/watchlist` | Read/update the watchlist. |
| `DELETE` | `/api/watchlist/:symbol` | Remove a symbol from the watchlist. |
| `PUT` | `/api/user/watchlist/:symbol/alert` | Update a watchlist alert. |
| `POST` | `/api/billing/revenuecat/reconcile` | Request account billing reconciliation. |

### Admin, bridge, and webhook routes

| Access | Methods and route families |
| --- | --- |
| Admin | `GET /api/admin/overview`, `/engine/status`, `/users`, `/audit-log`, `/crm/summary`, `/crm/audit-logs`, `/operations/health`, `/market-data/matrix`, `/controls`, `/strategies`, `/diagnostics`, `/diagnostics/candles`, `/lab`. |
| Admin | `POST /api/admin/engine/pause`, `/engine/resume`, and `/users/:id/notes`. |
| Admin | `PATCH /api/admin/users/:id`, `/api/admin/crm/users/:id/{membership,entitlements,role,account-state}`, and `/api/admin/controls/markets/:symbol[/strategies]`. |
| Admin | `GET /api/admin/crm/users/:id`, `/:id/trades`, `/:id/audit-logs`, and `/api/admin/users/:id/notes`. |
| Admin | `GET /api/admin/billing/transfers` and `/api/admin/billing/transfers/handoff`. |
| Admin | `GET /api/signals/diagnostic` and `GET /api/mt5/bridge/status`. |
| Bridge secret | `GET /api/mt5/bridge/subscriptions`, `/config`, `/mappings`; `POST /api/mt5/bridge/heartbeat`, `/quotes`, `/candles`, `/specs`. |
| RevenueCat webhook | `POST /api/billing/revenuecat/webhook`, verified with the configured webhook authorization mechanism. |

Admin routes require a user session plus admin role. Bridge routes use a separate bridge-secret boundary, except bridge status, which is admin-only. The API contract currently documents only some of these paths and does not fully express runtime Bearer authorization or admin checks; treat route implementation as authoritative until the contract is completed.

## Persistence and synchronization

### Server-side persistence

Drizzle schema and runtime code represent PostgreSQL persistence for application accounts, profiles, watchlists, alerts, trade records, notifications, audit history, billing/provider state, market authority, and bridge/candle data. Exact production retention, backup, and scaling configuration were not inspected.

### Client-side persistence

The Expo app hydrates the `tradify-signals-local-v1` AsyncStorage record. The explicitly persisted local fields include selected strategy, per-symbol setup choices, the MT5-connected UI flag, and onboarding completion. Other initial/demo state is held in memory unless synchronized through the authenticated API.

The app polls market snapshots approximately every 15 seconds, live quotes approximately every second on the detail screen, and signal/candle evaluation approximately every 10 seconds there. Authenticated notification polling runs approximately every 30 seconds.

**Persistence wording caveat:** Some legal/UI wording about on-device decisions is broader than the specific AsyncStorage payload visible in the client store. For guarantees about account data, use the server-backed authenticated routes and confirm the relevant storage path.

## Integrations and configuration

### Code-declared integrations and providers

- **RevenueCat:** Mobile purchase/restore and server webhook/reconciliation code. The workspace reports RevenueCat integration installed; actual store products and production credentials were not inspected.
- **Market providers:** MT5 bridge is the intended authoritative path. Source also includes external provider/shadow adapters and capability/fallback/quality code. Provider catalog presence does not prove entitlement or live availability.
- **Twelve Data:** Source exposes optional ingestion configuration and describes background ingestion as disabled until its request budget is explicitly configured.

### Configuration names

The following names appear in workspace context, source, or service wiring. This is a name-only reference; it does not assert that every value is currently present or required in every environment:

- Runtime/database/session/bridge: `PORT`, `DATABASE_URL`, `SESSION_SECRET`, `MT5_BRIDGE_SECRET`.
- Expo/dev preview: `REPLIT_EXPO_SESSION_SECRET`, `REPLIT_EXPO_DEV_DOMAIN`, `REPLIT_DEV_DOMAIN`, `REPLIT_INTERNAL_APP_DOMAIN`, `REPL_ID`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_REPL_ID`, `BASE_PATH`.
- CORS: `TRADIFY_CORS_ORIGINS`.
- Market providers: `ALPHAVANTAGE_API_KEY`, `EODHD_API_KEY`, `MASSIVE_API_KEY`, `TWELVE_DATA_API_KEY`, `TWELVE_DATA_INGESTION_ENABLED`, `TWELVE_DATA_MAX_REQUESTS_PER_MINUTE`.

Never place the values of these variables in source code, documentation, issue reports, or chat. Use Replit Secrets/environment configuration for sensitive values.

Expo development defaults its API base to the local Replit development API domain, with an explicit API URL override available. Expo web preview and API host are separate browser origins; local API CORS must allow the Expo preview origin as well as the API development origin.

## Development, build, and test commands

Run commands from the workspace root.

### Run services

```bash
pnpm --filter @workspace/tradify-signals run dev
pnpm --filter @workspace/api-server run dev
```

The API `dev` command builds and starts the server. For a direct API `start`, build first and provide the injected `PORT`.

### Build and typecheck

```bash
pnpm run build
pnpm run typecheck
pnpm run typecheck:libs

pnpm --filter @workspace/tradify-signals run build
pnpm --filter @workspace/tradify-signals run serve
pnpm --filter @workspace/tradify-signals run typecheck

pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run typecheck
```

The mobile build creates the configured static Expo deployment and `serve` hosts it. The repository does not declare an EAS/native store-binary build command. API build/typecheck commands are package-scoped.

### OpenAPI client generation

```bash
pnpm --filter @workspace/api-spec run codegen
```

The API specification is the contract source for generated client/Zod artifacts. After endpoint or schema changes, regenerate the client before validating the Expo app. The current OpenAPI document does not cover every runtime route or all runtime security rules.

### Tests

```bash
# All mobile Jest tests
pnpm --filter @workspace/tradify-signals run test

# Focused symbol-detail/chart tests
pnpm --filter @workspace/tradify-signals exec jest \
  --config jest.config.js --runInBand __tests__/signal-chart.test.tsx

# API customer-boundary check
pnpm --filter @workspace/api-server run test:customer-boundary

# Live quote workflow check and associated test
pnpm --filter @workspace/scripts run check:live-quotes
pnpm --filter @workspace/scripts run test:live-quotes
```

The API package exposes focused test scripts rather than one aggregate full-suite command. Named groups include fallback, parity, bridge reconnect, MT5 freshness, symbol mapping, provider quality/diagnostics, engine state, admin/admin persistence, customer boundary/state, auth security, account deletion, and billing. Some test files do not have a corresponding named package script; consult `artifacts/api-server/package.json` for the current runnable list.

The Replit post-merge script installs dependencies and performs a forced database schema push. It mutates database schema and is not a read-only validation command.

## Known limitations and release checks

These items are source-level or environment observations, not claims about production state:

1. **Admin bootstrap:** Ordinary registration creates a non-admin account. Promotion is available to an existing admin, but no first-admin production bootstrap procedure was confirmed.
2. **OpenAPI completeness:** Runtime routes extend beyond the paths/security definitions in `lib/api-spec/openapi.yaml`; generated clients do not currently describe the complete server surface.
3. **Billing availability:** RevenueCat wiring exists, but configured products, store offers, credentials, and production billing behavior are unverified. The server upgrade endpoint currently refuses checkout.
4. **Test status snapshot (2026-10-01):** Mobile typecheck passed; the focused signal/chart suite passed 14 tests; API typecheck and customer-boundary tests passed. The full mobile suite passed 90 tests and failed 5 auth-routing tests in `__tests__/auth.test.tsx`. Those failures were not changed in the strategy-visibility work.
5. **Preview state snapshot (2026-10-01):** Expo and API workflows restarted successfully; a local API CORS request from the Expo preview origin returned the expected allow-origin header. A browser screenshot still captured the Opportunities page in its “Connecting to the live setup feed” state, and the `live-quotes` workflow was reported failed. This does not establish that the production feed is unavailable.
6. **Port documentation:** `replit.md` references API port 5000, while the API artifact maps local port 8080 and the service reads injected `PORT`. Prefer artifact/workflow configuration over the stale documentation value.
7. **Mobile type declarations:** Root documentation and package declarations differ on TypeScript version; use the package/workspace lockfile as the current dependency source.
8. **No production data review:** No production database, external account, provider entitlement, or secret value was inspected in preparing this document.

Before a native store release, verify account/admin provisioning, privacy/terms/deletion behavior, membership products and RevenueCat configuration, trusted-data gates, supported symbol/provider entitlements, and the complete mobile/API test suites.

## Important source references

| Area | Main files |
| --- | --- |
| Mobile route registration | `artifacts/tradify-signals/app/(tabs)/_layout.tsx` |
| Opportunities and watchlist | `artifacts/tradify-signals/app/(tabs)/index.tsx`, `artifacts/tradify-signals/app/(tabs)/watchlist.tsx` |
| Signal detail, strategy selection, and trust gate | `artifacts/tradify-signals/app/signal/[id].tsx` |
| App context, hydration, local state, and API synchronization | `artifacts/tradify-signals/lib/tradify-store.tsx` |
| Chart renderer | `artifacts/tradify-signals/components/TradingViewChart.tsx`, `artifacts/tradify-signals/components/trading-view-chart.ts` |
| Membership and RevenueCat client | `artifacts/tradify-signals/app/membership.tsx`, `artifacts/tradify-signals/lib/revenuecat.tsx` |
| Admin UI | `artifacts/tradify-signals/app/admin.tsx`, `artifacts/tradify-signals/app/(tabs)/lab.tsx` |
| Express app, security headers, CORS, and route mount | `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/index.ts` |
| API route implementation | `artifacts/api-server/src/routes/tradify.ts`, `artifacts/api-server/src/routes/health.ts` |
| Strategy/market authority and providers | `artifacts/api-server/src/authoritative-engine.ts`, `artifacts/api-server/src/zip-engine/market/` |
| Billing reconciliation | `artifacts/api-server/src/revenuecat-billing.ts` |
| Database schema | `lib/db/src/schema/` |
| API contract and codegen | `lib/api-spec/openapi.yaml`, `lib/api-spec/orval.config.ts` |
| Package commands | Root `package.json`, `artifacts/tradify-signals/package.json`, `artifacts/api-server/package.json` |