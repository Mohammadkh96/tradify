# Tradify Signals PWA stabilization and release blockers

**Audit date:** 2026-10-14  
**Decision:** **NO-GO for release**  
**Scope:** Development fixes and read-only inspection of the current public deployment. No publishing, DNS changes, production/shared-development DB writes or migrations, provider configuration, payment integration, notification release, or Journal changes were performed. DB-mutating tests used unique disposable databases and dropped them after completion.

## Executive summary

The current development PWA export and static server pass their route/asset tests. A confirmed development fix now redirects browser requests at `/` to the customer PWA at `/app/`, keeps native Expo manifest requests intact, and preserves the Expo Go launch page at `/open-in-expo`. The build also emits `/release.json` with the source commit, dirty-tree flag, and build time. The live deployment has not been changed: both public hosts were observed serving the old Expo Go landing page and returning 404 for the PWA assets. Replit reports an active public Autoscale deployment with a successful build, but its metadata does not identify the running artifact's commit.

The previous HTTP 502 is not currently reproducible. The configured five-sample live-quotes workflow passes through `http://localhost:80/api/market/quotes`, with two advancing quote streams. The EURUSD M15 503 now has a confirmed provider-series cause: production bridge health, approval, EURUSD subscription, full-sync, and current quote are present, but six recent missing-candle intervals overlap the broker's declared open sessions. The provider is rejected for M15 continuity; the 503 is therefore fail-closed, not evidence of a market-closed window or missing approval. Development independently lacks a current EURUSD subscription and candles.

## Evidence by priority

### 1. PWA routing and deployed version

**Local development build — verified**

- The committed build completed successfully for web, iOS, and Android. It verified 22 referenced asset groups, copied 42 asset variants, and received HTTP 200 for 78 production-server checks; no EAS build was run.
- The current `artifacts/tradify-signals/static-build/` contains `index.html`, `manifest.webmanifest`, `service-worker.js`, and both PWA icons.
- The generated manifest has `start_url: "/app/"`, `scope: "/"`; the generated HTML points to `/manifest.webmanifest` and registers `/service-worker.js` with scope `/`.
- `BASE_PATH="/"` is consistent across the current artifact's development and production configuration.
- `server/serve.js` now redirects browser requests at `/` to `/app/`, while requests carrying `expo-platform: ios|android` still receive their native manifests. The Expo Go launch page remains available at `/open-in-expo`. API paths are excluded from the SPA fallback.
- `scripts/build.js` now writes `/release.json` inside the staging directory before atomic promotion. It records the full Git commit, whether the source tree has tracked/untracked source changes (ignoring attached uploads), and the build timestamp. A build fails explicitly if commit/tree state cannot be determined.
- The static-server integration tests exercise the root redirect, `/app/` SPA fallback for auth, registration, Profile, strategies, signal detail, chart, and settings URLs; manifest, worker, icons, native manifests; `/api` exclusion; and release metadata.
- A direct check against the promoted static bundle confirmed `/` returns 302 to `/app/`; eight customer/deep-link routes and five PWA files return 200; the iOS manifest returns 200; `/api/health` is not swallowed by the static server; and `/release.json` reports the committed source with `sourceDirty: false`.

**Public deployment — blocked**

Read-only checks on both `https://signals.tradifyapp.com` and `https://tradify-signals.replit.app` found:

| Route | Result |
| --- | --- |
| `/` | HTTP 200, Expo Go launch page (before the development fix) |
| `/app/` | HTTP 404 |
| `/auth` and `/profile` | HTTP 404 |
| `/manifest.webmanifest` | HTTP 404 |
| `/service-worker.js` | HTTP 404 |
| `/icons/tradify-192.png` | HTTP 404 |
| `/api/health` | HTTP 200 |

The 404s persist with a browser-style `Accept: text/html` header, so they are not just curl's default content negotiation. The old root HTML contains a `bundle-1791871896276` release identifier, which corresponds to **2026-10-13 06:11:36 UTC**. Replit metadata reports the deployment is public, Autoscale, active, and has a successful build, but returns no deployed commit or build identifier to compare with the local source. The artifact's production config already runs `scripts/build.js` and `server/serve.js`, with the public API/domain set to `tradify-signals.replit.app`.

**Root-cause assessment:** The old source deliberately routed non-native `/` requests to the Expo Go landing page, so the PWA was not the primary browser experience. That routing defect is fixed in development. The current source also had working SPA fallback, PWA files, and production run/build commands. The public hosts still serve the old bundle and omit the static files; because the deployed commit is unavailable, a stale artifact versus a production routing mismatch cannot be distinguished without publishing. No DNS or production routing change was made.

### 2. Market data and readiness

**Live quote check — passed on retry**

- The previously captured `live-quotes` failure at 2026-10-14 06:46 UTC says the request to the checker's default `http://localhost:80/api/market/quotes` returned HTTP 502.
- After restarting the configured read-only `live-quotes` check, it passed: **5 samples, 2 streams advanced, 2 prices changed, newest quote age 23,151 ms**. The check's default URL is the local Replit preview proxy, not a provider API URL.
- During follow-up sampling, the public `/api/market/quotes` endpoint returned HTTP 200 with fresh LIVE BTCUSD and ETHUSD entries. The development API endpoint also returned HTTP 200; its bridge state differed from the public endpoint, so those environments are not interchangeable.
- Current API/deployment request logs do not contain a matching quote 502, and the available old workflow record has no upstream request ID or provider trace. Therefore the historical 502's source cannot be proven. Current evidence is consistent with an intermittent preview-proxy failure, not a presently sustained provider outage.

**Strategy readiness — still blocked**

- `/api/market-ready` returned HTTP 503 with `MARKET_UNAVAILABLE` on the custom domain, alternate public host, and development host during this follow-up.
- Read-only production database inspection found the enabled `PRIMARY_MT5` registration is approved, `EURUSD` is active and fully synced at M15, and its bridge quote/heartbeat and session metadata were fresh. The last selected authority record named `PRIMARY_MT5`; provider approval is not the failing gate.
- The latest 500 persisted EURUSD M15 candles had seven gaps over 15 minutes. One aligned with the weekend closure; six weekday gaps ranged from about 14h45m to 17h45m. Current broker metadata declares EURUSD trading each weekday from 00:04 until 24:00 broker time (UTC+3), and the production logs recorded repeated `CONTIGUITY` rejections while keeping the prior series stale.
- The existing validator allows an MT5 history gap only when the fresh, matching broker schedule proves there was no open-market overlap. Here those weekday gaps overlap declared trading sessions, so no provider remains healthy/eligible and the health endpoint correctly returns 503. It is not an expected session-closed condition and is not caused by the unrelated BTC/ETH quote feeds.
- Development is also not ready: its bridge record was stale, had no active/available EURUSD, no EURUSD quote timestamp, and zero EURUSD M15 candles. This is separate from production's current feed-continuity failure.
- **Remaining blocker:** restore/backfill trusted EURUSD M15 data for the open intervals or verify/fix the upstream broker's session metadata with MT5 evidence. Do not relax continuity, freshness, or strategy safeguards to suppress this failure.
- No prices were fabricated, freshness thresholds changed, fallback statuses promoted, or strategy rules modified.

### 3. Authenticated customer verification

- The public development preview loads the real sign-in screen. Existing app tests cover sign-in/registration UI behavior, password-reset requests, logout, Profile controls, and safe error states.
- The current Signals Profile includes the accepted Tradify Products section from commit `4375e2c6d717ad1f5adf7eb6b87996c3ef18020b`.
- A disposable database **is available without adding a paid service**: the repository's existing runner first verifies the current database is the development database (`heliumdb`), creates a uniquely named `tradify_test_*` database on that existing PostgreSQL service, directs schema setup and test processes to it, then terminates connections and drops it in `finally`.
- Across two uniquely named disposable databases, the auth-security, customer-state persistence, Admin route, signal-outcome, market-access, and runtime-fallback suites passed. They used synthetic identities for registration/login/logout and Admin authorization. A read-only check confirmed both test databases were dropped. Signals UI tests passed for Profile and membership/entitlement rendering.
- The real sign-in screen was visually checked at 402×874 and 1440×900. Both rendered correctly; the browser showed the expected unauthenticated 401 for the session check and a non-blocking Expo web notification-listener warning.
- Full authenticated browser screenshots at 320/402/768px and desktop were not completed. The isolated runner does not automatically attach its temporary DB to the live Expo preview, so no live-preview account was created and no auth/session was bypassed. The existing preview remains backed by the shared development DB.

### 4. Admin preview and authorization

- The initial port conflict was caused by another instance of the **same expected Admin Vite service**, running from `artifacts/tradify-admin` on its configured strict port `23486`. The process and command matched the artifact configuration.
- The port owner was not an unrelated service. Restarting the managed `artifacts/tradify-admin: web` workflow recovered it cleanly. It now runs on `0.0.0.0:23486/tradify-admin/`; the preview proxy returns HTTP 200 and serves the private Admin login page. No process was manually terminated.
- The Admin route suite passed against the same unique disposable database and covers staff session/roles, protected operations, recovery/reset, revocation/logout, and audit behavior. The actual Admin browser login page remains available in the development preview.

### 5. Test count and builds

- `pnpm --filter @workspace/tradify-signals run typecheck`: **pass**.
- Current `pnpm --filter @workspace/tradify-signals run test`: **18 Jest suites / 172 Jest tests pass**, plus **18 Node script/server tests pass**.
- `pnpm --filter @workspace/api-server run typecheck`: **pass**.
- Across the isolated API runs, auth/security, customer-state, Admin routes, signal outcomes, market access, and runtime fallback all passed; both temporary DBs were dropped.
- Existing tests were retained; this stabilization added root-redirect/release-metadata static-server coverage. The project test command reports Jest and Node suites separately; the earlier figure of 173 cannot be reproduced from the available output.
- The final committed Expo export passed its production static-server verification. A prior attempt exposed an outdated build assertion expecting `/` to serve the Expo landing page; the assertion now verifies the new redirect. Expo's non-fatal DevTools library warning did not prevent prior exports. No physical-device test was run.

## GO / NO-GO matrix

| Release dimension | State |
| --- | --- |
| Profile implementation in development | **Fixed and unit-tested** |
| Local PWA assets and SPA fallback | **Verified by build and static-server tests** |
| Development root-to-PWA routing | **Fixed; root redirects to `/app/`** |
| Public custom-domain PWA routes | **Blocked until approved publish; production remains unchanged** |
| Live quote freshness/advancement now | **Verified in one five-sample development-proxy run** |
| Earlier HTTP 502 root cause | **Unconfirmed; not reproduced** |
| EURUSD M15 strategy authority | **Blocked by missing candles during declared open sessions; readiness correctly returns 503** |
| Isolated API authentication/Admin verification | **Passed** |
| Unauthenticated browser layout at phone/desktop sizes | **Verified at 402×874 and 1440×900** |
| Authenticated responsive Profile screenshots | **Not completed; preview is still coupled to shared development DB** |
| Staff Admin preview | **Recovered in development; login page reachable** |
| Admin backend authorization with isolated test identity | **Passed on a disposable database** |
| Production/shared-development PostgreSQL | **No writes or migrations; disposable test DBs created and dropped** |
| RevenueCat web purchases | **Unavailable by design; no web billing implementation** |
| Physical iOS/Android/PWA installation | **Not tested on real devices** |
| VAPID/notification release | **Deferred; no notification work performed** |
| Task 381 | **Deferred; not resumed** |

## Release recommendation and next sequence

**NO-GO. Do not publish this build yet.**

1. The current artifact is configured correctly to build and run its static Node server. No `artifact.toml`, DNS, or API route change is required for this PWA fix. Before publishing, commit the verified source so `/release.json` reports the exact SHA and `sourceDirty: false`.
2. The current Replit deployment is the public Autoscale deployment. A restricted staging deployment would need a separate Repl/deployment target and an isolated staging database/API configuration; changing the visibility of this existing deployment would replace the public app, not create a side-by-side staging copy. Workspace-only/password/invite visibility exists, but publication usage is still billed against subscription credits. Replit documentation describes Autoscale charges by compute, requests, and outbound transfer. No separate service or upgrade was created, and no exact bill can be estimated without the account's live usage/pricing data.
3. **Exact approval required:** explicitly approve publishing the committed SHA as the replacement for the current public `signals.tradifyapp.com` deployment, understanding it will make the PWA live to customers and may incur normal Autoscale usage. If the user wants a restricted staging release instead, first approve a separate staging Repl/deployment and its usage; do not change the current deployment's privacy as a substitute.
4. Pre-publish: confirm the production `DATABASE_URL`, `SESSION_SECRET`, and MT5 bridge configuration are set in the production environment; confirm the existing production schema is compatible; review the committed `/release.json`; verify no schema diff/migration is needed; require the market-data team to address the EURUSD continuity blocker before signaling readiness.
5. No database schema or migration files were changed in this fix. The release only changes static serving/build metadata, so it is schema-compatible with the existing production PostgreSQL. Existing API secrets must remain available; no values are included here. Billing, VAPID/notifications, and market readiness remain separate launch gates.
6. After approval/publish, verify on both hostnames: `/` redirects to `/app/`; `/release.json` equals the approved commit and is clean; login/register/Profile/strategy/signal deep links refresh successfully; manifest, service worker, icons, and bundle assets return 200; `/api/health` still routes to the API; no `/api/*` request returns the SPA HTML. Test a fresh install and a version update on supported mobile browsers.
7. Roll back by restoring the previous known-good deployment from deployment history if the PWA routes, authentication, or API routing regress. No database rollback is required because this release contains no schema/data migration. Rollback limitations: users who installed the service worker may retain cached files until the worker updates; confirm the old assets remain available or bump/expire the worker cache safely. Do not change DNS.
8. Verify install/update behavior on real Android and iPhone devices. Keep web purchases blocked pending separate billing approval. Keep VAPID/notification work and Task 381 deferred.

## Changes and rollback

- Development source now redirects the browser root to the PWA and includes a build/source release manifest. No production/shared-development database, billing, market-data logic, DNS, or production deployment was changed.
- The Admin managed development workflow was restarted after verifying the port was owned by the same Admin artifact; it now serves its login page.
- The `live-quotes` verification workflow was restarted and passed.
- No production rollback is needed because production was not changed. A later approved publication should use the rollback procedure above if route or authentication checks regress.
