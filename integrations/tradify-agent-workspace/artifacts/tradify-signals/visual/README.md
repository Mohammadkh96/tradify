# Mobile route visual checks

These tests run the real Expo web routes in Chromium at **375×812** (narrow)
and **430×932**, with fixed UTC time, local fonts, dark mode, reduced motion,
and intercepted synthetic API responses. Authentication uses the normal sign-in
form; the application contains no test bypass. No database or provider is used.

Start the existing `artifacts/tradify-signals: expo` workflow, then run:

```sh
pnpm --filter @workspace/tradify-signals run test:visual
```

`REPLIT_EXPO_DEV_DOMAIN` supplies the preview URL in Replit. Elsewhere set
`VISUAL_BASE_URL` to a running Expo web server. `CHROMIUM_PATH` overrides the
Replit Chromium executable; use the same Chromium version when updating or
comparing baselines. Do not point this suite at production.

Coverage: Opportunities feed, Watchlist, notification Alerts, Performance,
signed-in Profile, populated Signal Detail, sign-in Auth, and Risk Settings.
Each has named header/content/lower-region references. The lower capture scrolls
the real screen, including controls below the fold (Signal Detail compares the
bottom action region separately from its interactive chart). API requests without fixtures
and browser runtime errors fail rather than silently recording fallback screens.

Failures name the route, viewport, and region. Expected/actual/diff images, traces,
and a clickable HTML report are written under
`generated-artifacts/mobile-visual/` (ignored by Git and deployment).

After an intentional visual change:

```sh
pnpm --filter @workspace/tradify-signals run test:visual:update
```

Inspect the changed reference images before committing them. Never regenerate
baselines simply to make a failing test pass. References are small test fixtures,
not release builds. Font and screenshot stability is awaited by Playwright; no
arbitrary timeout masks a loading screen.

This protects Expo web layout, not native iOS/Android rendering, liquid-glass tabs,
keyboard behavior, or device safe areas.
