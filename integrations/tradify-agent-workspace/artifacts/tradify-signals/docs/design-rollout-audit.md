# App-wide design and motion rollout audit

## Shared rules

- Signals' current navy, gold, and teal palette is provisional and product-specific. It is not a finalized parent Tradify design system.
- Semantic state colors distinguish neutral, positive, warning, negative, and reference information. Customer-facing status labels remain visible; color is not the only signal.
- Onboarding illustrations are fixed, labeled examples. They do not imply live prices, recommendations, validated levels, or provider status.
- Motion uses short entrance and press feedback only. Reduced-motion preferences settle entrance values immediately and remove press scaling. Tab refocus does not replay a completed entrance; no polling or status indicator has a decorative loop.
- Web reduced motion follows `prefers-reduced-motion`; native starts from Reanimated's system preference and listens for native preference changes. If the native event source is unavailable, the hook keeps the initial system value.
- Loading screens identify what is loading. Broker disconnection is shown as `OFFLINE`, not as synchronization activity.
- The Strategy Lab's sample component gallery is explicitly labeled, contains no customer or market data, is guarded by `__DEV__`, and does not change the existing administrator access policy.
- Web-only minimum insets are applied to shared screens, auth, and onboarding; native safe areas remain platform-managed.

## Current Signals token reference

This reference documents the existing Signals implementation; it does not approve shared Tradify branding.

| Category | Current values/source |
| --- | --- |
| Brand surfaces | Page `#191F29`, surface `#1F2732`, raised/muted `#28313E`, border `#36404E`, input `#28313E` |
| Brand accents | Gold `#EBB22D`, teal `#55B490`, text `#EEEAE2`, muted text `#9DA4AF` |
| Semantic states | Error `#EB7369`, warning `#E4B16E`, reference `#8C9BB0`; LIVE, REFERENCE, STALE, and UNAVAILABLE also have explicit labels and icon/border treatments |
| Typography | Inter; regular through bold/black weights are represented in the local token map |
| Spacing | Local scale from 1px hairline through 24px spacious; screen padding 18px and shell spacing 22px |
| Radii | 8px cards, 12px controls, 14px inputs, 15px buttons, 24px shells, 28px sheets, plus pill radius |
| Controls | 44px touch target; 48px control/input height; 52px primary button height |
| Appearance | Signals currently maps both system light and dark settings to the same dark palette |

Visual verification on 2026-10-14 used the running Expo web preview at 402 × 874. The unauthenticated sign-in screen showed the navy background and gold brand mark/button; this verifies the current web entry screen only, not authenticated Profile/Settings or native rendering. The previously listed forest/lime screenshots do not match the verified current entry screen and should be recaptured before being used as current visual evidence.

## Proposed product navigation

**Status: prepared for later implementation; not present in the app.**

- Add a low-emphasis `Tradify Products` section in Profile or Settings, outside the primary trading tabs.
- The proposed Journal row is `TradifyApp Journal`, with helper text that it opens a separate application and may require a separate sign-in; it must not imply shared login or subscriptions.
- Open the destination externally. Do not pass Signals session data, credentials, or entitlement state.
- Show the clickable row only after the public Journal destination has been verified as reachable. The current review could not verify `https://tradifyapp.com` (web fetch and screenshot failed; direct TLS connection also failed), so no active link is approved for release.
- This is navigation only. It does not authorize shared identity, billing, API, database, analytics, or account-linking work.

## Route and state inventory

| Route | Important states and boundaries | Automated coverage |
| --- | --- | --- |
| `/` | Saved-feed hydration, guest feed, live/reference/offline quote distinctions, filters, empty/error states | `tabs.test.tsx`, `live-quotes.test.ts`, `trader-data-boundary.test.tsx` |
| `/watchlist` | Saved symbols, market filters, empty list, watchlist actions | `tabs.test.tsx` |
| `/signal/[id]` | Signal details, chart overlays, trusted-level gating, reference-only data, unavailable/error state | `signal-chart.test.tsx`, `trader-data-boundary.test.tsx` |
| `/trades` | Active/history views, empty state, trade actions | `tabs.test.tsx` |
| `/performance` | Performance summary and no-history state | `tabs.test.tsx` |
| `/notifications` | Notification history, read state, empty state | `tabs.test.tsx` |
| `/alerts` | Alert list and alert actions | `tabs.test.tsx` |
| `/profile` | Account, membership, role-aware actions, onboarding replay | `tabs.test.tsx` |
| `/onboarding` | First-run and replay entry, page selection/swipe, Skip, sign-in/register destinations, fixed example illustrations | `onboarding.test.tsx`, `motion.test.tsx` |
| `/auth` | Sign-in/register, password visibility, consent, pending/error states, server-returned role, legal destination | `auth.test.tsx` |
| `/membership` | Membership choices and billing/recovery states | `membership.test.tsx` |
| `/risk` | Risk inputs, calculation, and validation states | No dedicated route regression suite |
| `/settings` | Account and app settings | No dedicated route regression suite |
| `/legal` | Existing legal content; no generated or placeholder legal copy | `auth.test.tsx` |
| `/admin` | Administrator-only operational interface | `admin.test.tsx` |
| `/lab` | Strategy diagnostics and development-only component gallery | `tabs.test.tsx`, `request-diagnostics.test.ts` |
| `+not-found` | Unknown-route fallback | No dedicated route regression suite |

This is a route and state inventory from the current app and its tests, not a claim that every provider, account, or device-specific condition was simulated. Risk, settings, and not-found routes have no dedicated regression suite. Native reduced-motion behavior is implemented but was not measured on a physical iOS or Android device during this review.

## Actual-app screenshots

The following saved captures are retained as historical rollout evidence, not as current palette references:

- `screenshots/after-onboarding-mobile.jpg` — onboarding, 402 × 874.
- `screenshots/after-auth-signin-mobile.jpg` — sign-in, 402 × 874.
- `screenshots/after-auth-signin-wide.jpg` — sign-in, 768 × 1024.
- `screenshots/after-auth-register-mobile.jpg` — registration, 402 × 874.
- `screenshots/after-feed-mobile.jpg` — saved-feed hydration state, 402 × 874.

The earlier `screenshots/before-onboarding.jpg` capture omitted visible text and is not used as evidence. Recapture the listed screens after authenticated visual review.

## Verification

- TypeScript: `pnpm --filter @workspace/tradify-signals run typecheck`.
- Tests: `pnpm --filter @workspace/tradify-signals test`.
- Source hygiene: `git diff --check`; app/component TSX has no hardcoded hex or `rgba()` color literals.
- Result: TypeScript check passed; 12 test suites and 106 tests passed.