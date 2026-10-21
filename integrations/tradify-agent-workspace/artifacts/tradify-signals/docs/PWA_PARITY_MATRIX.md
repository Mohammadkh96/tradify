# Tradify Signals PWA parity audit

## Scope and evidence

This is a source-level audit of the current Expo application and the Replit HTTPS PWA preview. The PWA exports the existing Expo Router application for web; it is not a separate reduced website. This does not establish successful end-to-end behavior for every route, account role, subscription state, browser, or device.

The attached requirement file ends partway through its final testing section (“Create”), so this matrix covers the requirements visible in the supplied text.

Status:

- **Shared source**: the native route/component is included in the Expo Web app; browser behavior still needs validation.
- **Gap**: source inspection found a behavior that does not meet the stated PWA requirement.
- **Unverified**: implementation or integration could not be confirmed from source and preview checks alone.

## Screens and routes

| Requirement | Existing Signals route/source | PWA status | What remains |
|---|---|---|---|
| Splash / onboarding | `/onboarding` | Shared source | Verify first-run and returning-user routing in web and installed mode. |
| Login and registration | `/auth` | Shared source; backend methods are reused | Verify successful web sign-in, registration, role handling, and session continuity. |
| Home dashboard / live opportunities | `/(tabs)` | Shared source; rendered in preview | Verify signed-in and signed-out states and all live-data states. |
| Active signals and details | `/signal/[id]` | Shared source | Verify representative lifecycle states and deep links in web. |
| Strategies and strategy selection/following | Explore, Watchlist, Trades, and the `lab` route | **Unverified**; `lab` currently redirects to Profile | Map each strategy action to its existing backend behavior and test it on web. |
| Supported symbols and price history | `/chart/[symbol]` and Explore | Shared source | Verify symbol list, chart loading, alternate timeframes, and error/empty states. |
| Signal history | Trades and Performance tabs | Shared source | Verify history and per-target outcomes against the development API. |
| Statistics and performance | `/performance` | Shared source | Verify charts and account-specific data on web. |
| Notification center | `/notifications` | Shared source for the in-app inbox | Verify reads, preferences, entries, lifecycle updates, and deep links. |
| Price-alert management | `/alerts` | Shared source | Verify create/delete and tier restrictions on web. |
| Membership / entitlements | `/membership` | Shared source | Verify backend entitlement enforcement and whether a supported web purchase path exists. |
| User profile and settings | `/profile`, `/settings` | Shared source | Verify profile updates, risk settings, logout, and session expiry on web. |
| Support, legal, and risk acknowledgement | `/legal`, `/risk` | Shared source | Verify external links, mandatory acknowledgement, and return routing. |
| Admin dashboard | Separate Tradify Admin artifact | Separate web app; development route returned HTTP 200 | Sign in and test Admin changes against the same development API and the PWA customer view. |

The app uses Expo Router for these routes. Native iOS can use NativeTabs; web uses the shared classic tab layout with responsive sizing. A desktop PWA screenshot was checked, but phone/tablet layouts and all route states have not yet been validated.

## Cross-cutting requirements

| Requirement | Finding | Status |
|---|---|---|
| Reuse existing app and branding | Expo Web exports the existing Signals application and shared React Native components. The preview renders the Tradify UI rather than Expo Go or a standalone install-only site. | **Shared source; visual parity not exhaustively verified** |
| Browser authentication and remembered sign-in | Web auth requests use the shared auth API, but `getAuthToken()` deliberately deletes/does not restore a browser-stored bearer token. No browser-cookie session flow was found in this review. A reload therefore cannot restore the PWA session through this code path. | **Gap; release blocker** |
| Registration, reset, and verification | Sign-in/registration UI and password-reset request API exist. Reset completion/deep-link behavior and any configured email-verification flow still need end-to-end confirmation. | **Partly present; unverified** |
| Protected routing and entitlements | The backend has authenticated routes and server-side role/entitlement logic. The root layout enforces risk acknowledgement but does not globally redirect unauthenticated visitors to auth; the preview currently displays the customer shell while signed out. | **Gap against the stated redirect requirement; access policy needs product confirmation** |
| Database isolation | The Replit preview uses the development environment/database, separate from production. The development-only proxy to the production market-data host was removed. No production data or production database was used for this audit. | **Development/production isolated; no separate staging project/database created** |
| Admin synchronization | Admin and Signals use the shared API architecture. The Admin preview route and unauthenticated API health/auth responses were checked; no signed-in Admin-to-PWA lifecycle scenario was exercised. | **Unverified end to end** |
| PWA installation | Standalone manifest, icons, install UI, and service-worker script are present and served over HTTPS. The service worker caches the app shell/assets and bypasses API requests. | **Install prerequisites present; real-device install/relaunch unverified** |
| Web Push | The service worker has no `push`, `pushsubscriptionchange`, or `notificationclick` handlers; no web push subscription flow was found. | **Gap; not operational** |
| Native push | No Expo Notifications registration/call site was found in the Signals app source searched for this audit. | **Unverified; do not assume an existing native push channel** |
| Full customer journey | API health and expected unauthenticated `401` were checked. No browser test exercised registration, persistent login, role changes, billing, Admin-driven changes, or an installed device. | **Unverified** |
| Separate TradifyApp journal | No files or settings for the separate TradifyApp journal were changed. | **Unchanged** |

## Release blockers from this audit

1. Implement and verify a secure browser session that survives a PWA relaunch without storing a bearer token in readable browser storage.
2. Resolve the unauthenticated-entry requirement: the current app allows the signed-out dashboard shell, whereas the supplied criteria require login/onboarding redirection.
3. Implement PWA Web Push subscription, backend persistence/delivery, and service-worker notification/deep-link handling; verify on an installed device before calling it operational.
4. Run route-by-route web checks and customer journeys for user/admin roles, entitlements, risk acknowledgement, signal lifecycle, and mobile/tablet/desktop layouts.
5. Complete real-device Android and iPhone installation/update checks where supported.

Production remains unpublished and unchanged. The development preview is a validation environment, not evidence that the published PWA meets this matrix.
