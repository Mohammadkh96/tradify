# Tradify Signals — onboarding and authentication design handoff

Upload this folder or ZIP to your existing Tradify Signals Replit project. Paste the prompt below into Replit Agent. Open `Tradify-Preview.html` in a browser to try the design. The `screens/` images are vector-rendered design references (not browser screenshots), and `Tradify-Screen-Overview.png` shows all five screens.

## Prompt to paste into Replit Agent

Implement the attached Tradify Signals mobile onboarding and authentication design inside our EXISTING Expo / React Native app. Deliver the working change, not a plan. Treat the supplied HTML as a clickable visual and interaction reference. Rebuild it with native React Native components, not an HTML screen inside a WebView. Keep the existing app architecture and auth/session behavior.

### Read the app before changing it

Inspect `artifacts/tradify-signals/app/onboarding.tsx`, `app/auth.tsx`, root and tab layouts, the app store in `lib/tradify-store.tsx`, the actual auth functions and schemas, existing button/input/theme components, and `__tests__/auth.test.tsx`. Paths are relative to `artifacts/tradify-signals/` unless noted. Confirm where onboarding completion and auth hydration are handled. Source and installed dependencies are authoritative; the overview document is a snapshot, not the current repository.

The project is an Expo Router mobile application, not a new marketing website. Existing ordinary account endpoints are `POST /api/auth/sign-in` and `POST /api/auth/register`. Reuse the existing API client and account context. Inspect request/response schemas rather than guessing fields. Sign-in currently produces sessions; native tokens belong in the existing SecureStore integration. Web token persistence is currently memory-only. Do not change these policies in this UI task. Never store credentials or tokens in AsyncStorage, browser localStorage, logs, analytics, or the onboarding record.

### Build these five screens

1. **Discover / onboarding page one.** Brand top left, Skip top right. Example market card illustration. Eyebrow: “THE RIGHT PERSPECTIVE”. Headline: “Less noise. More clarity.” Supporting copy: “Explore market setups in one focused feed, with data status clearly shown.” Continue moves to page two. Log in opens the sign-in form directly.
2. **Risk / onboarding page two.** Same structure, risk-plan illustration. Eyebrow: “THINK RISK FIRST”. Headline: “A plan before every trade.” Supporting copy: “Review entry, target and stop levels when market data is validated. Explore your risk before you act.” Continue moves to page three. Log in opens sign-in.
3. **Watchlist / onboarding page three.** Watchlist and sample alert illustration. Eyebrow: “MAKE IT YOURS”. Headline: “Your markets. Within reach.” Supporting copy: “Build your watchlist, set price alerts and keep your trade records in one place.” Main CTA: “Create your account”. Secondary: “Already have an account? Log in”.
4. **Sign in.** Brand, back navigation, compact brand tile, headline “Welcome back.” and description “Your markets. Your plans. All here.” Labeled email and password inputs, accessible Show/Hide password button, Log in CTA, Create account link, existing legal links and a short risk statement.
5. **Create account.** Eyebrow “YOUR NEXT CHAPTER”. Headline “Make room for a clearer view.” Supporting copy “Create your Tradify Signals account.” Display name, email, password, consent checkbox, Create account CTA and Log in link. Match registration field names, supported profile updates, password requirements and legal requirements to the actual implementation. If display name is not accepted by registration, use the existing supported profile update flow after successful auth; do not invent a payload field.

### Visual direction

Match the supplied HTML and screenshots closely. Use dark forest-charcoal surfaces, warm off-white text and restrained lime accents. Crisp, quiet, modern finance UI: generous space, large left-aligned headlines, small uppercase eyebrow text, subtle borders, rounded cards, friendly illustrations using UI elements, no stock photos or cartoon mascots. No unnecessary splash delay or full-screen promotional paywall.

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

Use the current app font if suitable. Otherwise use the native platform system font. Do not add a font package or delay first render just for this handoff. The proposed lime design is a direction, not a claim about the existing brand. If an official brand asset exists, use it in place of the simple three-bar concept mark. The device border, fake status bar, desktop preview navigation, and “design preview” dialogs are PRESENTATION ONLY: do not ship them inside the mobile app.

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

All market cards in onboarding are STATIC ILLUSTRATIONS and must keep an “EXAMPLE” label. The sample risk card uses a $10,000 account, 1% risk and $100 risk amount; sample entry 2,400, stop 2,385, target 2,430 imply 2:1 gross reward/risk before costs. These are invented teaching values, not current quotes, a forecast, or a strategy recommendation. Do not load live market data merely to render onboarding. Do not call a static illustration “live” or “validated”.

Strategy-level visibility still requires the existing fresh/validated market-data checks. Membership and data-trust gates remain distinct. Customer routes must continue excluding provider/broker identities, raw strategy IDs, engine facts and admin diagnostics. Alert illustrations do not justify requesting OS notification permission during onboarding; use the existing permission/request behavior at the point of need.

### Responsive behavior and accessibility

Use safe-area insets, a keyboard-aware layout and scrollable content for short screens or increased text size. Headlines and descriptions should scale/wrap naturally, not be cut off at a fixed height. Reference widths: 320, 360, 390 and 430 dp, plus tablet/web preview. Center content at a reasonable max width on tablets. Respect reduced motion. Animate page transitions subtly (approximately 180–250 ms), with no endless animations or fake loading delays. Use at least 44 dp touch targets, readable contrast, screen-reader labels and selected-page announcements. Use the screen reader's normal traversal rather than treating the whole screen as one image. Pure illustration internals should not flood the accessibility tree.

### Validation and delivery

The overview reports a prior snapshot with five failing auth-routing tests. Establish the current baseline, then verify this change does not add failures. Where this task changes the affected routing logic, fix the relevant tests/behavior without weakening assertions. Do not claim every test passed if unrelated failures remain.

Verify fresh install, persisted skip/completion, app relaunch, already-authenticated entry, sign-in success/failure, registration success/failure, duplicate-submit protection, keyboard behavior, offline error, legal links, Profile replay, hardware back, and deep-link restoration. Exercise swipes, Continue and dots together. Check small screen widths and increased font size. Run the package's actual typecheck and relevant auth/onboarding tests, then the existing customer-boundary tests if a shared data boundary was touched.

Finish with changed file paths, actual screenshots from the Expo implementation, checks run with pass/fail results, and specific outstanding blockers. Do not run the repository's schema-mutating post-merge/database push workflow for this UI-only change. No database or secret changes are authorized by this prompt.

## What this handoff contains

- `Tradify-Preview.html`: self-contained browser prototype, no external assets, no network requests, no credentials persisted. `?gallery=1` shows the five designs; `?screen=3` opens sign-in; `?screen=4` opens registration. Swipe works in the first three screens. Desktop arrow keys also change the intro page.
- `screens/01-discover.png` to `05-create-account.png`: individual visual references, with editable SVG counterparts. These were rendered from the design vectors, not captured from a browser or native app. The HTML is the interaction reference; small spacing differences are expected.
- `Tradify-Screen-Overview.png`: contact sheet of all five designs.
- This implementation prompt.

The HTML implements design interaction and basic form validation only. It is not a React Native build, has not been connected to the application API, and does not establish that the native auth flow passes tests. The app source was not available in this handoff task; product behavior is based on the supplied application overview. Native implementation and verification happen in the existing Replit repository.


### Verification status of this handoff

The vector designs were rendered and visually inspected. Browser JavaScript syntax and generated markup were checked locally. Browser interaction and responsive-layout tests could not be run: this environment had no browser installed, and the browser download was blocked by network policy. Replit must run the native/browser checks above. No production integration or native test run is claimed.
