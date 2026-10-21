# Tradify Signals PWA launch-readiness audit

**Audit date:** 2026-10-14  
**Scope:** Read-only launch audit of the Signals development app and publicly reachable Signals routes. No production configuration, DNS, database, billing, or Journal project was changed.

**Update:** This initial audit is superseded by [the PWA stabilization and release-blocker report](./TRADIFY_SIGNALS_PWA_STABILIZATION.md), which rechecks custom-domain paths with browser headers and separates fresh quote delivery from strategy market readiness.

## Summary

**Status: not ready for release.** The Profile product-information section is implemented in the Expo customer app and the Expo web/iOS/Android static bundles build. The current public host does not serve the PWA's configured install/start routes, strategy readiness currently returns unavailable, the previous live-quotes check recorded an HTTP 502, and web purchases are intentionally unavailable.

The signed-in Profile and account flows were not exercised in a real browser session because the available preview is unauthenticated. No credentials were requested or used. Physical iOS/Android devices and PWA installation were not tested.

## Findings

| Area | Status | Evidence and impact |
| --- | --- | --- |
| Profile addition | **Implemented** | Signals `Profile` includes an informational Tradify Journal card, description, explicit separate sign-in/account/subscription wording, and `Destination pending confirmation`. It has no press action or URL and does not add a tab. Existing settings, data export/deletion, session controls, palette, `TradifyBrand`, Inter typography, and navigation remain in place. |
| Typecheck and web/native export | **Pass, with warning** | `pnpm --filter @workspace/tradify-signals run typecheck` passed. `pnpm --filter @workspace/tradify-signals run build` generated and promoted web, iOS, and Android static exports and verified referenced assets. Expo logged a non-fatal React Native DevTools startup error because `libglib-2.0.so.0` is absent; Metro and all three exports completed. This is not an EAS or signed native-device build. |
| Installability on the public domain | **Blocker** | On 2026-10-14, `https://signals.tradifyapp.com/` returned HTTP 200 HTML, but `/manifest.webmanifest`, `/service-worker.js`, `/app/`, and `/auth` returned 404. The built manifest's `start_url` is `/app/`, and the build registers `/service-worker.js`; neither is reachable on the public host, so installability and deep-link launch are not established. The configured Replit host also returned 404 for `/app/`. |
| Sign-in, registration, logout, recovery | **Code/tests present; live flow unverified** | App routes and UI cover sign-in, registration, logout, and password-reset requests. Existing auth tests cover registration routing, reset requests, role handling, and safe errors. Browser capture reached the sign-in screen and showed two HTTP 401 responses while unauthenticated; no live account was used to exercise the flows. |
| Customer Profile/settings | **Code/test pass; signed-in visual check blocked** | Focused Profile tests passed, including the new informational/non-interactive Journal row. Screenshot capture of `/profile` redirected to the sign-in screen in both viewport sizes, so the actual signed-in Profile rendering is not represented by those screenshots. |
| Strategies, signal history/details/lifecycle | **Implementation and automated tests exist; live customer journey unverified** | The client and API include strategy, signal detail, historical outcome, and lifecycle handling, with existing test suites. A real signed-in journey against the development API was not performed. |
| API and database | **Basic health pass** | Public `GET /api/health` returned `{"status":"ok"}`. The health handler runs `SELECT 1` through the application's configured `@workspace/db` pool (`env.databaseUrl`), so this confirms the app's current database connection at the time of the request. No database query beyond health, migration, or write was run. The app uses its existing configured PostgreSQL connection; no Neon migration was made. |
| Market data | **Blocker / unresolved reliability** | The recorded `live-quotes` workflow failed with “quote endpoint returned HTTP 502” at 2026-10-14 06:46 UTC. During this audit, `/api/market/quotes` returned HTTP 200, but `/api/market-ready` returned HTTP 503 with `MARKET_UNAVAILABLE`. A single successful quote response does not resolve the prior 502 or satisfy the strategy-ready gate. |
| Public custom-domain routing | **Blocker** | The custom domain serves root HTML and `/api/health`, but not the manifest, service worker, or configured PWA start/auth routes. The repository's Expo production config still points legal/API origins at `tradify-signals.replit.app`; no routing or DNS changes were made. |
| RevenueCat web purchases | **Unavailable by design** | `selectRevenueCatApiKey("web", …)` returns no key, so the native RevenueCat purchase/restore SDK is unavailable in browsers. Web membership purchase/restore needs a separately approved billing design; no Stripe, Whop, or other web billing was added. |
| Staff Admin | **API authorization exists; browser accessibility not verified** | Staff UI is a separate Admin artifact, and API code/tests cover admin sessions and role-protected operations. Its configured workspace web workflow currently fails to start because its assigned port is already in use. The Signals mobile Admin route redirects to Profile. No Admin code or production Admin behavior was changed. |

## Screenshots

The requested desktop (1440×1000) and mobile (402×874) browser captures are saved under `generated-artifacts/`. Both show the unauthenticated sign-in screen because the browser has no Signals session. They document the current preview access boundary, **not** the changed signed-in Profile; a signed-in Profile screenshot remains outstanding.

## Proposed release sequence

1. **Keep this change in development.** Resolve the public PWA static-route/manifest/service-worker mismatch in an explicitly approved deployment configuration change; verify start URL, deep links, updates, and installation on the public host.
2. **Clear launch blockers.** Diagnose the recorded quote HTTP 502, obtain a passing strategy market-readiness check over a sustained period, and decide whether browser users need a separately approved web-purchase route.
3. **Complete authenticated and device QA.** Exercise login, registration, logout, recovery, Profile/settings, membership, strategy and signal lifecycle flows using approved test accounts; verify installation/updates on real Android and iPhone devices and verify Staff Admin with a staff account.
4. **Production release only after explicit approval.** Review the exact production build, routing, and customer-facing legal details; publish only after the owner approves. No production deployment is authorized by this audit.
5. **Post-release monitoring.** Check PWA installation and route health, API/database health, market readiness and quote freshness, auth failures, and Admin access. Keep web billing disabled unless separately approved and implemented.

## Rollback plan

- Before release, keep the current production deployment untouched.
- If an approved release regresses, restore the last known-good application build through Replit deployment history (or revert the feature commit and publish only with explicit approval).
- This Profile change has no database schema or data changes, so it requires no database rollback. Do not roll back customer data or change DNS as part of an app-code rollback.
- Validate `/`, `/app/`, manifest, service worker, API health, and sign-in entry again after restoration.
