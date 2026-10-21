# Tradify Signals — unified app identity and motion handoff

Upload this folder or ZIP to your existing Tradify Signals Replit project. Paste the prompt below into Replit Agent. Open `Tradify-Preview.html` in a browser to try the design. The `screens/` images are vector-rendered design references (not browser screenshots), and `Tradify-Screen-Overview.png` shows all five screens.

## Prompt to paste into Replit Agent

Unify our ENTIRE existing Tradify Signals Expo / React Native application around the attached visual concept, with consistent branding and purposeful animation. Implement the onboarding/auth reference and carry the same design system through all application screens, components and states. Deliver the working change, not a plan. Treat the supplied HTML as a clickable visual and interaction reference. Rebuild it with native React Native components, not an HTML screen inside a WebView. Keep the existing app architecture and auth/session behavior.

### Read the app before changing it

Inspect `artifacts/tradify-signals/app/onboarding.tsx`, `app/auth.tsx`, root and tab layouts, the app store in `lib/tradify-store.tsx`, the actual auth functions and schemas, existing button/input/theme components, and `__tests__/auth.test.tsx`. Paths are relative to `artifacts/tradify-signals/` unless noted. Confirm where onboarding completion and auth hydration are handled. Source and installed dependencies are authoritative; the overview document is a snapshot, not the current repository.

The project is an Expo Router mobile application, not a new marketing website. Existing ordinary account endpoints are `POST /api/auth/sign-in` and `POST /api/auth/register`. Reuse the existing API client and account context. Inspect request/response schemas rather than guessing fields. Sign-in currently produces sessions; native tokens belong in the existing SecureStore integration. Web token persistence is currently memory-only. Do not change these policies in this UI task. Never store credentials or tokens in AsyncStorage, browser localStorage, logs, analytics, or the onboarding record.

### Build these five entry screens, then complete the app-wide rollout

1. **Discover / onboarding page one.** Brand top left, Skip top right. Example market card illustration. Eyebrow: “THE RIGHT PERSPECTIVE”. Headline: “Less noise. More clarity.” Supporting copy: “Explore market setups in one focused feed, with data status clearly shown.” Continue moves to page two. Log in opens the sign-in form directly.
2. **Risk / onboarding page two.** Same structure, risk-plan illustration. Eyebrow: “THINK RISK FIRST”. Headline: “A plan before every trade.” Supporting copy: “Review entry, target and stop levels when market data is validated. Explore your risk before you act.” Continue moves to page three. Log in opens sign-in.
3. **Watchlist / onboarding page three.** Watchlist and sample alert illustration. Eyebrow: “MAKE IT YOURS”. Headline: “Your markets. Within reach.” Supporting copy: “Build your watchlist, set price alerts and keep your trade records in one place.” Main CTA: “Create your account”. Secondary: “Already have an account? Log in”.
4. **Sign in.** Brand, back navigation, compact brand tile, headline “Welcome back.” and description “Your markets. Your plans. All here.” Labeled email and password inputs, accessible Show/Hide password button, Log in CTA, Create account link, existing legal links and a short risk statement.
5. **Create account.** Eyebrow “YOUR NEXT CHAPTER”. Headline “Make room for a clearer view.” Supporting copy “Create your Tradify Signals account.” Display name, email, password, consent checkbox, Create account CTA and Log in link. Match registration field names, supported profile updates, password requirements and legal requirements to the actual implementation. If display name is not accepted by registration, use the existing supported profile update flow after successful auth; do not invent a payload field.

### Visual direction

Match the supplied HTML and vector-rendered design references closely. Use dark forest-charcoal surfaces, warm off-white text and restrained lime accents. Crisp, quiet, modern finance UI: generous space, large left-aligned headlines, small uppercase eyebrow text, subtle borders, rounded cards, friendly illustrations using UI elements, no stock photos or cartoon mascots. No unnecessary splash delay or full-screen promotional paywall.

Tokens:

| Token | Value |
| --- | --- |
| Screen background | `#101714` |
| Card surface | `#1B2520` |
| Raised surface | `#222E27` |
| Border | `#354238` |
| Primary text | `#F4F5ED` |
| Secondary text | `#ADB8AC` |
| Primary lime | `#D1F57A` |
| Primary button text | `#172012` |
| Supporting teal | `#97CCB1` |
| Error text | `#FFB7A7` |
| Content horizontal inset | 24–25 dp |
| Primary button | Minimum 52 dp high; 15 dp radius |
| Input | Minimum 51 dp high; 12 dp radius; 16 dp editable text |
| Illustration card | 20 dp radius |
| Heading | Approximately 36–40 dp, medium weight, tight tracking |
| Body | 13–14 dp, approximately 1.6 line height |

Use the current app font if suitable. Otherwise use the native platform system font. Do not add a font package or delay first render just for this handoff. The proposed lime design is a direction, not a claim about the existing brand. Use the supplied three-bar concept mark consistently, subject to any explicit documented brand requirement found in the project. Do not mix old and new logo systems. The device border, fake status bar, desktop preview navigation, and “design preview” dialogs are PRESENTATION ONLY: do not ship them inside the mobile app.

### Unify the ENTIRE application around this concept

This is an application-wide design rollout. The five welcome/auth screens are the visual starting point. Continue through every existing route, shared component, overlay and state until the app uses one coherent identity. Do not consider the work finished after onboarding/auth or a global background-color replacement. Keep all working features, role checks, data-trust gates, session behavior and account state intact.

First inventory routes, theme providers, reusable primitives, icons, chart configuration, platform-specific components and logo assets. Extend or consolidate the existing theme architecture. Build a route/state checklist and mark each item as migrated, verified or concretely blocked. Additional routes discovered in the repository are included in the inventory. A blocker in one route does not stop independent migration work.

#### One source for visual decisions

Use `brand/design-tokens.json` as the supplied design specification, then implement a typed theme in the app's existing structure. All UI components must consume shared semantic tokens, not copies of hex values. Keep the five-screen visual reference and existing product semantics aligned.

- **Brand:** Tradify Signals. Use the supplied lime three-bar mark as the concept's canonical logo, with the same proportions and the same lowercase `tradify` / `signals` wordmark throughout. Inventory any official assets already in the project; use one canonical implementation, never a mixture of old and new marks. Respect an explicit existing brand requirement if one is documented and explain the specific conflict. Do not change the legal entity name, bundle identifier, URL scheme, notification channel IDs or backend identity as part of the rebrand.
- **Logo assets:** Centralize a `BrandLogo` component with mark-only and wordmark variants, a compact header size and a larger authentication size. Reuse the same geometry in app-icon, adaptive-icon, monochrome-icon, web-favicon and splash assets as supported by the existing Expo config. The supplied SVG mark is the geometry reference; supplied wordmark SVGs use text and should be rendered with the app's chosen font or converted to paths for final asset export. Generate native-required raster sizes from the shared source; do not stretch a small PNG. Use an opaque full-square icon source and let each platform apply its mask. Verify platform safe areas and real build outputs; don't merely rename the old icon file.
- **Colors:** Forest-charcoal backgrounds, off-white text, lime primary actions, muted teal supporting accents, coral errors/losses, amber warnings and a distinct neutral reference-data state. Lime denotes brand/selection, not proof that a price is live or a trade is good. Use text and/or symbols alongside status colors.
- **Theme preferences:** Dark is the reference direction. If the app already supports Light/System choices, preserve them and implement the complete supplied light palette through the same semantic keys. Do not replace an existing choice with hardcoded dark styles. If the app only supports dark, do not add a new light-mode feature for this task.
- **Typography:** One family, a small consistent type scale, medium-weight headings, restrained eyebrow labels, tabular numerals for prices and metrics. Use approximately 36–40 dp headings for introductory screens and 24–28 dp for working screens. Keep prices and table numbers aligned. Important body/label text must remain readable at normal and enlarged system font sizes.
- **Spacing and shape:** A shared spacing scale; consistent 24 dp screen insets where density allows; 12–16 dp form/control corners; approximately 20 dp cards; one divider, shadow and elevation language. Dense screens may use compact components while retaining the same tokens and hierarchy.
- **Icons:** Reuse the project's existing vector icon family if suitable. Keep one stroke style and consistent optical sizes. Use the supplied brand mark only for branding; use ordinary UI icons for actions. No emoji-based navigation or arbitrary mixed icon packs.
- **Layers:** Solid readable surfaces for charts, forms and dense data. A small amount of translucent treatment can remain on an already-supported native tab bar or an overlay, provided contrast, performance and accessibility fallbacks work. Do not spread blur/glass behind market values or charts.

#### Shared components before page-by-page migration

Consolidate theme-aware equivalents of Screen, Header, BrandLogo, Text, Primary/Secondary/Ghost buttons, IconButton, TextField, PasswordField, Checkbox, Switch, Select/SegmentedControl, MarketCard, StatusBadge, Metric, EmptyState, LoadingState, ErrorState, BottomSheet, Dialog, Toast and navigation chrome. Reuse existing components and names where possible; the listed names describe responsibilities, not a demand for duplicate files. Define each component's normal, focused, pressed, selected, disabled, busy and error states where applicable.

These components must work in iOS, Android and the Expo web preview. Provide visible keyboard focus on web. Preserve correct roles, labels, accessibility values and touch targets. Keep destructive actions visually distinct and confirm them through the existing flow. Prefer standard navigator behavior over reimplementing native back gestures.

#### Required route coverage

| Existing route / area | Migration requirements |
| --- | --- |
| `/onboarding`, `/auth` | Implement the supplied five-screen direction, motion and all auth/first-run/replay states. |
| `/` Opportunities | Shared header, market/session filters, setup cards, data-state badges, connecting/no-qualified-setup states, stale/offline/error states and refresh feedback. Preserve the feed's actual filtering and freshness logic. |
| `/watchlist` | Matching catalog/watchlist tabs, search, symbol rows, empty states, add/remove actions, loading/error and sync states. Keep symbol names and values easy to scan. |
| `/signal/[id]` | Matching header, setup chooser, timeframe controls, chart tools, trust/data-state notices, entry/target/stop legends, plan workspace and membership gates. Keep chart interaction and historical loading intact. |
| Chart renderer / WebView | Pass theme tokens through the existing chart options/bridge so native/WebView/web backgrounds, axes, labels, gridlines, overlays, tooltips and candle colors match. Preserve candle-versus-Heikin-Ashi behavior, zoom state, older-history loading and price precision. Do not rebuild the chart engine for a cosmetic migration. |
| `/trades` | Consistent trade-record cards, detail/actions, partial-lock/close UI and confirmation/error states. Do not introduce actual broker order execution. |
| `/performance` | Consistent metric typography, period controls, performance charts, legends and no-history states. Preserve metric definitions and ensure losses/drawdown remain visually unambiguous. |
| `/notifications` and `/alerts` | Same visual family, with clear difference between the Alerts tab/inbox and price-alert management. Unify unread states, mark-read behavior, create/delete forms, target/condition controls, sync and permission states. |
| `/risk` | Shared numeric fields, percentage selectors, currency controls, result layout and readiness/estimate disclosures. Preserve calculations and data requirements. |
| `/profile`, `/settings` | Matching avatar, membership summary, rows, switches, display preferences, account fields, onboarding replay, sign-out, account deletion and persistence-retry UI. |
| `/membership` | Same brand for Free/Pro/VIP comparison, purchase/restore, sync, unavailable/recovery and sign-in states. Keep server-confirmed entitlements authoritative; no fake discounts or purchase success. |
| `/legal`, `+not-found` | Consistent readable typography, safe-area layout, legal links, deletion information and clear return navigation. Preserve legal content. |
| `/admin`, `/lab` | Same brand tokens, controls, tables, panels and status colors, with denser operational layouts where needed. Preserve roles, diagnostics boundaries, filters and workflows; no admin information in customer UI. |
| Global surfaces | NativeTabs/classic-tabs variants, modals, bottom sheets, selectors, permission/error messages, offline banners, skeletons, keyboard handling, safe areas, splash, icon and web favicon. |

For every route, inspect loaded, loading, empty, error and disabled states that actually exist. Use safe fixture data or the existing preview system to inspect unavailable states; do not fabricate a production state. Preserve existing supported languages, long labels and RTL behavior if present. Avoid hardcoded English strings outside the app's current localization pattern.

### Motion direction: controlled, tactile and fast

Motion should make the app feel responsive and connect related elements. It should finish and leave the screen quiet. The HTML demonstrates a subset: one-time brand-bar reveal, staggered onboarding illustration, card/badge arrivals, swipe-drag feedback, directional page entry, press feedback, form entry, bottom-sheet entry and system/manual reduced motion. The full application behavior below must be implemented in native components; it is not all demonstrated in the five-screen prototype.

| Interaction | Proposed motion | Constraints |
| --- | --- | --- |
| First branded view | Three logo bars settle into place over about 400–500 ms, once per cold start. | Never extend the native splash or block ready content to finish an animation. Returning from background should not replay it. |
| Onboarding swipe | Native horizontal paging follows the finger. Separate illustration layers can translate at different small rates, capped at about 12–24 dp. Indicator responds to page progress and settles with the page. | Honor vertical scrolling and screen readers. No gyroscope dependency, forced autoplay or automatic account navigation. |
| Illustration entry | Market candles reveal left-to-right; the risk rows enter in order; the example alert card slides into place. Entire sequence settles within roughly 650 ms. | Only the explicitly labeled example illustrations get decorative chart animation. No fabricated moving live feed. |
| Main button press | Compress to about 0.98 for 120–160 ms, then settle promptly. Optional light haptic for a deliberate action. | Never shift the surrounding layout or delay the action. Match the touch target to the visible button. |
| Tabs and filter selection | Brief color/indicator transition (about 160–220 ms); native selection behavior remains familiar. | Maintain platform navigation. Don't add a custom glass tab bar over a working native one just to imitate the preview. |
| Sheet/modal | Short vertical arrival with backdrop fade, approximately 240–320 ms; dismiss reverses naturally. | Keep focus management, Android Back, keyboard behavior, screen-reader access and unsaved-input rules. |
| New screen | Small 8–16 dp entry or the existing platform navigator transition, about 220–320 ms. | Do not double-animate navigator and content. No replay on polling, tab refocus or irrelevant rerenders. |
| First real load | Low-contrast skeleton blocks shaped like the real content. Optional gentle shimmer only while genuinely pending and motion is enabled. | Stop on completion/error; don't re-skeletonize every background poll. For longer waits, show meaningful status/retry behavior rather than an endless animation. |
| Watchlist save / alert created | A small icon/state change and concise confirmation; optional success haptic only after server confirmation. | Never celebrate before success. Handle rollback/failure honestly. No confetti for trading or gains. |
| Refresh / new quote | Keep rows and number widths stable; optionally use a brief subtle background change on the value that updated. | No animated number counting, rolling digits, dramatic flashing or moving targets/stops. Status changes must reflect actual data. Avoid presenting animation as a feed-health signal. |
| Error / offline | Clear message, icon and recovery action. A short fade is sufficient. | No shaking forms, flashing red panels, inaccessible color-only feedback or haptics on every failed poll. |

Centralize duration/easing/press-scale values. Suggested presets: fast 140 ms, standard 240 ms, enter 420 ms, hero 620 ms; ease-out curve `[0.22, 1, 0.36, 1]`. Use spring settling only where it improves direct manipulation. Avoid noticeable oscillation. These are design targets, not permission to add artificial request latency.

#### Implementation and device behavior

Inspect the actual installed Expo SDK, React Native architecture and animation dependencies first. Prefer an already-installed compatible `react-native-reanimated` for gesture-driven transforms and `expo-haptics` for touch feedback. Use the existing gesture/pager/modal tools. If a dependency is needed, install the version compatible with this app's Expo SDK using its supported installer; do not upgrade the entire app to the “latest” SDK or blindly copy current documentation's package versions. A small entry animation can use the existing native animation API. Avoid adding Rive, Lottie, Skia or a 3D engine solely for these simple shapes.

Use transforms/opacity for decorative movement; avoid animating expensive blur/shadow/layout work on every frame. Target smooth operation on a representative midrange Android device and iPhone. Measure in an appropriate build and report observed performance instead of asserting “60 fps” without evidence. Keep long lists virtualized, chart updates isolated and stable row keys intact. Stop offscreen/background animations and clean up listeners; quote polling must not restart page entrance effects.

All motion must honor the system's Reduce Motion setting. If the app offers a motion preference, it may reduce motion further but may not override the OS restriction. Reduced motion removes parallax, scale, stagger delays, decorative travel and shimmer while leaving states and controls fully usable. Check runtime changes using APIs available in the installed versions: Reanimated's `useReducedMotion` documentation notes that changing the system preference alone does not trigger a rerender. Do not accidentally force `ReduceMotion.Never` globally.

Haptics are optional feedback, not the only confirmation. Respect the device/user settings and any existing app haptics preference, debounce them, and tolerate unsupported or disabled haptics without an error or blocked action. No vibrations on quote updates, app polling, typing each character or every scroll frame. The browser prototype intentionally does not vibrate; native haptics are part of Replit's integration work.

Official implementation references, checked for this handoff (select documentation matching the installed SDK/version):

- [Expo Reanimated](https://docs.expo.dev/versions/latest/sdk/reanimated/)
- [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/)
- [Reanimated accessibility and reduced motion](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/)
- [Reanimated useReducedMotion behavior](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/)

### Complete the rollout and prove consistency

Implement in coherent passes: inventory and baseline; shared tokens/logo/primitives; onboarding/auth and app shell; every working route and chart theme; operational/legal/recovery states; then accessibility, performance and regression checks. Keep the app usable after each pass. Follow all passes through to completion without stopping after a plan, foundation files or a few example pages.

Provide a small development-only component gallery or extend the existing `artifacts/mockup-sandbox/` preview to demonstrate the shared primitives and their states. Never expose fixtures, customer data, operational diagnostics or admin controls on a new public production route. Use deterministic synthetic examples clearly labeled as fixtures.

Finish with an audited route/state matrix, before/after screenshots from the actual app for the major routes, a short recording or reproducible steps showing motion, changed files, verification commands/results and any specific remaining blockers. Include both tab implementations, chart theme synchronization, login/register/error, empty/stale data, membership recovery and admin role boundaries in the relevant checks. Validate reduced motion and any existing light/system themes. Search for old brand assets and hardcoded legacy theme colors and remove only confirmed unused remnants. Reuse the repository's checks and add focused behavioral coverage where the migration creates a concrete regression risk; do not add snapshot tests merely to freeze every pixel.

Acceptance: users should encounter one Tradify identity from app icon through onboarding, charts, membership and account settings; all routes should use the shared tokens/components; animations should settle quickly; and existing application behavior must still work. List any unmet item explicitly rather than declaring the whole app unified after partial coverage.


### Onboarding behavior and routing

- Keep the current three-step onboarding concept; implement horizontal paging with native scrolling or the project's existing paging component. Swiping and Continue must change the same page index. Support indicator taps and screen-reader actions. Update the current page after swipe settles. Swiping on the last page must not create an account or launch authentication.
- Always show Skip. In a signed-out FIRST-RUN flow, Skip opens sign-in. The final Create your account button opens registration. Log in is available on every page. Finishing or explicitly skipping persists the existing onboarding-complete state using its current storage key. Opening Log in from onboarding also counts as leaving the intro intentionally. Merely opening the first page does not mark onboarding complete.
- First read the existing onboarding completion policy and preserve account/guest access rules. This proposal does not silently introduce guest access or remove guest access that already exists. If the app already intentionally lets users skip directly to the public feed, retain that product policy and report the small routing deviation from this visual reference.
- Wait for local-state and auth hydration before the route decision. Avoid a flash of onboarding for an existing signed-in user or a redirect loop between onboarding/auth/tabs.
- Returning authenticated users go to the app or their valid intended destination. Returning signed-out users follow the existing auth/access policy without repeating the intro.
- Onboarding replay from Profile remains available. Replay is distinct from first run: Finish, Skip, or Back returns to Profile (or the caller) and never signs out a user, changes memberships, or forces re-registration.
- Use `replace` when leaving a completed intro or auth screen so Android Back does not reopen an obsolete flow. Preserve deep links through auth. A signed-out user opening an account-only destination signs in and then reaches that validated destination; reject external/untrusted return destinations. Preserve the app's authorization checks.
- Back from sign-in can return to the intro when the user entered through first run. Back from registration returns to sign-in. Handle hardware back consistently. Do not erase the onboarding completion flag to replay a screen.
- Do not place a second onboarding-completion flag in storage. Reuse the existing `tradify-signals-local-v1` store and its existing completion field; confirm exact names from source.

### Authentication and form states

- Use the actual sign-in and ordinary registration functions. A successful network request and confirmed session are required before routing to authenticated screens. Never copy the demo's simulated submit completion into production.
- No admin registration or role picker. The server determines the role and entitlements.
- Implement empty, focused, filled, invalid, submitting, server-error, offline and success states. Keep field labels visible. Field errors appear beside their field and are announced to assistive technology. Focus the first invalid input. Preserve email and display name on recoverable failure; do not log passwords.
- Match password requirements to the actual backend/schema. The prototype checks only that a password is nonempty because the application overview does not provide a password policy. Do not invent or weaken one. Show the actual registration rule as helper text. Do not impose new registration rules on sign-in of existing users. Do not trim passwords.
- Disable duplicate submission while a request is pending. Await existing token persistence/session confirmation, handle failures honestly, and preserve the current persistence retry behavior. Map errors to safe client messages rather than raw server stack traces. Existing server account-state decisions remain authoritative.
- Show/Hide must toggle password visibility without changing its value. Use native email keyboard, appropriate autofill/content types, no email auto-capitalization, and keyboard submit actions. Ensure the submit button is reachable with the keyboard open.
- Connect Terms, Privacy and Risk to the existing `/legal` route with whichever navigation parameters the app actually supports. The HTML dialogs are design annotations, not publishable legal text. Confirm terms/privacy content before enabling registration consent in a release.
- The checkbox is a proposed registration UI treatment. If the product needs auditable acceptance, use the existing supported consent/version recording if present; do not claim that a local checkbox creates an audit record. Report any missing backend support rather than inventing a legal guarantee.
- Do not add Google/Apple login, biometric auth, password reset, verification email or OTP screens unless their end-to-end flow already exists and is verified. None is established by the supplied app overview. If a working existing password-reset flow is found, keep a small “Forgot password?” link in sign-in and connect it.
- Do not change API endpoints, session lifetimes, billing or role policies for this design task.

### Honest product content

This application helps monitor markets and plan decisions. It is not a broker or order-execution interface. Do not add “Trade now”, guaranteed results, fabricated win rates, customer counts, testimonials or membership discounts. Do not require a purchase before users see the existing allowed product experience.

All market cards in onboarding use FIXED EXAMPLE DATA; their visual entrance may animate, but values do not simulate a live feed. They are ILLUSTRATIONS and must keep an “EXAMPLE” label. The sample risk card uses a $10,000 account, 1% risk and $100 risk amount; sample entry 2,400, stop 2,385, target 2,430 imply 2:1 gross reward/risk before costs. These are invented teaching values, not current quotes, a forecast, or a strategy recommendation. Do not load live market data merely to render onboarding. Do not call a static illustration “live” or “validated”.

Strategy-level visibility still requires the existing fresh/validated market-data checks. Membership and data-trust gates remain distinct. Customer routes must continue excluding provider/broker identities, raw strategy IDs, engine facts and admin diagnostics. Alert illustrations do not justify requesting OS notification permission during onboarding; use the existing permission/request behavior at the point of need.

### Responsive behavior and accessibility

Use safe-area insets, a keyboard-aware layout and scrollable content for short screens or increased text size. Headlines and descriptions should scale/wrap naturally, not be cut off at a fixed height. Reference widths: 320, 360, 390 and 430 dp, plus tablet/web preview. Center content at a reasonable max width on tablets. Respect reduced motion. Animate page transitions subtly (approximately 180–250 ms), with no continuous decorative loops or fake loading delays. A subdued pending-state indicator may animate only while a real operation is pending; stop it on completion/error and show meaningful recovery for prolonged waits. Use at least 44 dp touch targets, readable contrast, screen-reader labels and selected-page announcements. Use the screen reader's normal traversal rather than treating the whole screen as one image. Pure illustration internals should not flood the accessibility tree.

### Validation and delivery

The overview reports a prior snapshot with five failing auth-routing tests. Establish the current baseline, then verify this change does not add failures. Where this task changes the affected routing logic, fix the relevant tests/behavior without weakening assertions. Do not claim every test passed if unrelated failures remain.

Verify fresh install, persisted skip/completion, app relaunch, already-authenticated entry, sign-in success/failure, registration success/failure, duplicate-submit protection, keyboard behavior, offline error, legal links, Profile replay, hardware back, and deep-link restoration. Exercise swipes, Continue and dots together. Check small screen widths and increased font size. Run the package's actual typecheck and relevant auth/onboarding tests, then the existing customer-boundary tests if a shared data boundary was touched.

Finish with changed file paths, actual screenshots from the Expo implementation, checks run with pass/fail results, and specific outstanding blockers. Do not run the repository's schema-mutating post-merge/database push workflow for this UI-only change. No database or secret changes are authorized by this prompt.

## What this handoff contains

- `Tradify-Preview.html`: self-contained browser prototype, no external assets, no network requests, no credentials persisted. `?gallery=1` shows the five designs; `?screen=3` opens sign-in; `?screen=4` opens registration. The first three screens implement swipe handling and restrained drag response. Desktop arrow keys also change the intro page. Desktop preview controls can replay the welcome animation or reduce motion; the device setting always takes priority.
- `screens/01-discover.png` to `05-create-account.png`: individual visual references, with editable SVG counterparts. These were rendered from the design vectors, not captured from a browser or native app. The HTML is the interaction reference; small spacing differences are expected.
- `Tradify-Screen-Overview.png`: contact sheet of all five designs.
- `brand/`: shared logo SVGs and semantic design/motion tokens.
- This implementation prompt, now covering the full app and its motion system.

The HTML implements design interaction and basic form validation only. It is not a React Native build, has not been connected to the application API, and does not establish that the native auth flow passes tests. The app source was not available in this handoff task; product behavior is based on the supplied application overview. Native implementation and verification happen in the existing Replit repository.


### Verification status of this handoff

The static vector designs were rendered and visually inspected. Browser JavaScript syntax, generated markup and targeted motion-state logic were checked locally. Motion and whole-app styling instructions were expanded in this revision; the PNGs remain static design references. Browser interaction and responsive-layout tests could not be run: this environment had no browser installed, and the browser download was blocked by network policy. Replit must run the native/browser checks above. No production integration or native test run is claimed.
