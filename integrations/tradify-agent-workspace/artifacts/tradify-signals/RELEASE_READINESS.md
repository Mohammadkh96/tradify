# Tradify Signals release readiness

**Review date:** 2026-10-14
**Decision:** **NO-GO for Google Play submission and the Admin production page**  
**Replit web deployment:** Public and active at `https://tradify-signals.replit.app`

## Verified

- Production API health returned HTTP 200.
- Production `POST /api/ai/commentary` returned 404; the AI route removal is live.
- Public privacy, terms, account-deletion, and support pages each returned HTTP 200.
- Chart API contract test passed against a disposable test database.
- Mobile stale-quote guard tests passed (17 tests); mobile TypeScript check passed.
- Customer app metadata is set to `Tradify Signals`, version `1.0.0`, Android package candidate `com.tradifysignals.app`, and deep-link scheme `tradify-signals`. The iOS bundle ID remains `com.tradify.signals`.
- A 1024 × 1024 app icon is configured.
- Admin is a separate static web artifact at `/tradify-admin/` on the same deployment domain.
- Admin artifact configuration now registers a static production service and supplies the build port and base path. Its production build and typecheck passed locally.
- The current source hydrates and persists MT5 bridge state through PostgreSQL for autoscaled API instances.

## PWA installation and update verification (2026-10-20)

**Overall status: BLOCKED for real-device and interactive installation checks.** No Android phone or iPhone is attached to this environment. A desktop preview is available, but its browser install controls and installed-app window were not exercised. Do not treat desktop rendering or the automated route test as evidence of a successful install, standalone launch, persisted session, or update.

| Platform / flow | Status | Observed result |
| --- | --- | --- |
| PWA resources and desktop preview | **Automated / preview only** | The Signals preview rendered the sign-in screen and “Install Tradify Signals” action. The service worker and manifest endpoints responded, and `server/serve.integration.test.js` passed 3/3 tests for app routes and PWA assets. These checks do not install the app. The preview browser also logged HTTP 502 responses for API requests; authenticated API behavior was not verified. A separate live-quote validation first returned HTTP 502 while the API workflow was stopped, then HTTP 404 after restart because that workflow was running the isolated link-test supervisor rather than the normal API. This does not establish whether live quotes are healthy. |
| Chrome on Android | **BLOCKED** | No physical Android device or interactive Chrome session was available. Install, standalone launch, sign-in/session persistence, in-app navigation, and update after a new service-worker release are all untested. Google documents installation through Chrome’s menu (“Install and create shortcut”); the available option and wording can vary by browser/version. |
| iPhone Add to Home Screen | **BLOCKED** | No physical iPhone was available. Safari Add to Home Screen, standalone relaunch, session persistence, navigation, and update behavior are untested. Apple documents opening a saved website as a web app from Safari. Chrome on iOS documents adding a Home Screen shortcut; if the site is not available as a web app, that shortcut opens in the default browser. No minimum iOS version was established by this check, so do not infer a version floor or equivalent behavior across browsers. |
| Desktop install | **BLOCKED (interactive install)** | Google documents installing web apps in desktop Chrome from “Cast, save, and share” → “Install page as app” (or the address-bar Install button when shown). The preview was rendered, but no desktop browser install control, installed window, relaunch, session, or update was tested. Browsers without an install control can still use the site as a regular browser page; Firefox and desktop Safari installation behavior was not evaluated here. |

The current manifest requests `display: standalone` and starts at `/app/`. The service worker uses a versioned app-shell cache, calls `skipWaiting()` on installation, removes older `tradify-app-shell-*` caches on activation, and claims clients. This describes the configured update path only; an installed client receiving an update has not been observed. The test result above covers routing and resource responses, not those lifecycle steps.

Reference guidance:

- [Google Chrome Help: Use web apps on Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en-GB)
- [Google Chrome Help: Use web apps on a computer](https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DDesktop)
- [Google Chrome Help: Use web apps on iPhone and iPad](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DiOS&hl=en)
- [Apple Support: Turn a website into an app in Safari on iPhone](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)

## Must close before Google Play launch

1. **Confirm the Android package name and create a supported release package.** The previous ID, `com.tradify.signals`, is already used by another publisher. The source now uses the candidate `com.tradifysignals.app`, but a public Play Store search does not reserve it; Google's package-name registration and signing-key checks must confirm eligibility. Replit's current mobile publishing flow does not publish directly to Google Play, and this workspace has no `.aab` or `.apk` deliverable. An Android release build, signing, and Play Console upload still need a supported external process.
2. **Prove market data remains fresh.** A 12-sample production check found BTC and ETH quotes aged 31–69 seconds during seven samples even though the API still labeled them `LIVE`. A later snapshot was fresh, so sustained feed stability remains unverified.
3. **Fix public stale-quote labels.** The mobile app now rejects missing or older-than-30-second receipt timestamps as live and preserves the last-known price as stale. That safeguard is local and not published. The public API still returns the upstream `LIVE` label for stale quotes.
4. **Repair and republish Admin.** The currently published `/tradify-admin/` route returns HTTP 500. Deployment logs reported zero static services. The artifact configuration is corrected locally, but the published page cannot be considered fixed until a user-initiated publish and production HTTP check.
5. **Complete billing setup.** `REVENUECAT_WEBHOOK_SECRET` is absent from the production environment. Reverify Google Play credentials and sandbox purchases in RevenueCat before enabling paid access.
6. **Finish the Play listing package.** The repository currently has onboarding and sign-up screenshots, but no final screenshots of the main customer experience. Prepare the Play listing copy, feature screenshots, and required Play Console declarations.
7. **Remove unused OpenAI secrets.** `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` remain in Replit Secrets even though the application no longer uses AI.

## Separate Admin page

Admin is a distinct web artifact with its own build and route, not a separate domain. It remains protected by Admin authentication. After publishing the corrected artifact configuration, verify `/tradify-admin/` returns the sign-in page and that authorized Admin API calls work.

## Important distinction

The public Replit web deployment is already live. That does not mean the Android app is published to Google Play, that the latest local mobile safeguard is live, or that the Admin production route is working. Do not describe the Google Play or Admin release as complete until the gates above are verified.

## Admin-to-mobile and notification audit

| Capability | Current status | What it means |
| --- | --- | --- |
| Customer account and access management | **Implemented in the local Admin/API** | Staff can manage supported account state, membership overrides, entitlements, and related audit history through authenticated, capability-checked routes. Actual subscription purchases remain provider-authoritative. |
| Market and strategy controls | **Implemented in the local Admin/API** | Symbol availability/visibility, strategy assignments, and runtime pause/resume are server-backed. Changes affect later API reads/evaluations; they do not rewrite prior generated signals. |
| Customer refresh | **Implemented through API reads and refresh paths** | The mobile client consumes the shared API and refreshes customer state. No separate Play release is needed for server-side data changes; visibility timing depends on the screen's refresh/foreground path and connectivity. |
| Signal diagnostics and evaluation history | **Implemented as observation** | These views help staff inspect evaluations and data trust. They are not a general-purpose tool for manually publishing, editing, or invalidating an individual live signal. |
| Signal outcome analysis | **Implemented with limits** | Stored outcomes are resolved from trusted M15 history. If one candle touches both a target and stop, the result is marked ambiguous rather than guessed. This is not a complete push-producing signal lifecycle service. |
| In-app notification history | **Implemented locally** | Authenticated users can read durable notification history and synchronize read state. Signal lifecycle events, per-user inbox entries, and read state are persisted. |
| Notification preferences | **Implemented locally** | Customer preference storage and controls are present. Quiet-hour and policy behavior still needs end-to-end validation. |
| Web Push | **Implemented locally; delivery blocked** | Web Push subscription routes, a persistent delivery queue/worker, and service-worker handling exist. The API startup log reports incomplete VAPID configuration. No successful receipt on a real device has been confirmed. |
| Admin Notification Center | **Not implemented** | Staff notification queue, announcement controls, and related Admin workflows are not wired. |
| Production verification | **Blocked** | No production publish or production data/configuration change is authorized. The published Admin route and a signed-in physical Android client have not been verified for this work. |

### Release boundary

Admin operational changes are intended to use the shared backend and require no mobile-store release. Admin/API code changes require the relevant web/API deployment. Push registration, notification handling, permissions, icons, and Android channels require native app configuration; whether a new signed Android binary is required must be checked against the final Expo configuration and release process. Replit's current mobile publishing flow does not produce or submit a Google Play Android package.

### Current production readiness

**Admin-to-mobile data controls:** locally implemented, production route verification still blocked.  
**Reliable signal lifecycle push notifications:** not production-ready; the push pipeline, preferences, and Admin notification controls are absent.  
**Google Play release:** no-go until package identity, Android build/signing, provider configuration, and real-device verification are complete.

### Local verification for this audit

- API, Admin, and mobile TypeScript checks passed.
- Six API suites passed against a disposable test database, covering signal-outcome rules, customer data boundaries, notification history/restart behavior, Admin routes, and Admin persistence/concurrency.
- The scheduled live-quote smoke check failed because its quote endpoint returned HTTP 502. This is not evidence that the signal notification work is complete or that production quotes are healthy.
- Admin and Expo development workflows were running locally; this did not verify the published Admin route or a signed-in physical Android client.

## Task 381 pause record

**Requested state:** ON HOLD / BLOCKED, not completed.
**Current task-feed state:** The latest task update reports Task 381 as **CANCELLED**. This does not match the requested ON HOLD / BLOCKED state; this document does not change task state. The work and existing code have not been discarded or reverted.

No one-off test process was left running. The API, Admin, Signals preview, and mockup-sandbox workflows are ordinary development services and remain available; the `chart-api-contract` check finished. The latest `live-quotes` check failed with HTTP 502 from its quote endpoint and is not evidence of notification delivery.

## Environment and service configuration

Do not copy secret values into this file, source control, logs, or chat. Configure secrets through Replit Secrets, separately for Development and Production as appropriate.

| Name | Purpose | Current pause status / action |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | Public key used by the browser to subscribe to Web Push | Not configured in the current development API process. Configure alongside the matching private key. |
| `VAPID_PRIVATE_KEY` | Signs Web Push requests | Secret; not configured in the current development API process. Generate/store through the secure secrets flow. Never print or commit it. |
| `VAPID_SUBJECT` | VAPID contact identifier, typically a `mailto:` URI | Not configured in the current development API process. Set to a monitored project contact. |
| `TRADIFY_PASSWORD_RESET_FROM_EMAIL` | Sender address for account-recovery messages | Development has a sender setting; verify that the chosen sender/domain is authorized before production email use. |
| `TRADIFY_ADMIN_PUBLIC_ORIGIN` | HTTPS origin used to construct Admin recovery links | Set to the approved public Admin origin before production recovery flows; do not change DNS as part of this pause. |
| `SESSION_SECRET` | Signs Tradify sessions | Required in production. Do not rotate casually: rotation invalidates active sessions. |
| `MT5_BRIDGE_SECRET` | Authenticates the MT5 bridge | Required by the connected bridge. Do not rotate during this pause; a change must be coordinated with the bridge configuration. |
| `REVENUECAT_WEBHOOK_SECRET` | Verifies RevenueCat webhooks | Production absence remains a separate billing launch blocker from the earlier audit. Do not change production secrets without approval. |
| `DATABASE_URL` | Replit-managed PostgreSQL connection | Retained for schema tooling and fallback; do not copy, override, or expose it. |
| `NEON_DATABASE_URL` | Neon PostgreSQL runtime connection | Store the direct Neon URI as a Replit Secret; never expose or commit it. The API prefers this when set. |
| `EXPO_TOKEN`, `REPLIT_EXPO_SESSION_SECRET` | Expo/EAS or Replit Expo tooling | Not needed for this Web Push pause; no EAS build is authorized or required now. |

## Schema and deployment procedure

- The current schema already contains lifecycle state/events, user notifications, notification preferences, Web Push subscriptions, and Web Push delivery queue tables. No schema change was made for this pause.
- Schema source of truth is the Drizzle schema under `lib/db/src/schema/`. For future development-only schema changes, use the workspace DB flow (`pnpm --filter @workspace/db run push`, or the documented `push-force` flow when required) and verify against a disposable test database.
- Do not run production DDL or hand-written production migrations. For Replit-managed PostgreSQL, an approved Publish operation reviews the development/production schema diff and applies production schema changes. **Do not publish now**; the user has expressly prohibited production changes.
- Before any future deployment: review the artifact build and schema diff; verify sender/VAPID configuration in the intended environment; run API typecheck and isolated-database notification/auth tests; confirm no paid EAS build or paid deployment is being triggered; obtain explicit approval before publishing or changing production secrets, database, or DNS.
- `signals.tradifyapp.com` is the requested project domain, but this pause performs no DNS or domain verification/change. The existing release note’s published Replit URL and the requested custom domain must not be treated as interchangeable without a later approved check.

## Access-key security note

A source scan found no configured or committed `access_key` credential. The only matching source reference is the generic diagnostic sanitizer that redacts fields named `access_key`; the Development secret-name inventory also contains no `access_key` secret. A field name alone does not identify a provider or establish that a live key was exposed, so no rotation was initiated. If an incident report identifies the provider, create a replacement key in that provider, update the matching Replit secret through the secure Secrets UI, validate the affected integration, then revoke the old key. Never paste either value into chat or commit it.

## Task 381 resume checklist

1. Confirm the task is restored to ON HOLD / BLOCKED (the task feed currently reports CANCELLED).
2. Configure the VAPID values securely in Development and verify the sender/origin settings needed for recovery.
3. Run the notification queue/restart tests against a disposable database; then test subscription, delivery, and receipt on a real Android device using a disposable account.
4. Finish and verify the Admin Notification Center and its backend authorization/audit behavior.
5. Recheck production Admin and notification behavior only after explicit approval to publish or change production.
6. Do not start EAS Android builds, paid deployments, DNS changes, or production-secret/database changes without separate approval.