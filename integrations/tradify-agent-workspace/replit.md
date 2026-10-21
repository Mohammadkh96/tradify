# Tradify Signals

Mobile-first trading intelligence app for active traders, with market signals, MT5 feed provenance, watchlists, alerts, trade plans, performance, and trader settings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/tradify-signals run dev` — run the Expo mobile preview
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Replit-managed Postgres connection for schema tooling and tests
- Optional secret: `NEON_DATABASE_URL` — direct Neon connection preferred by the API runtime

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo 57 + Expo Router + React Native 0.86
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/tradify-signals` — Expo mobile app and native-first screens
- `artifacts/tradify-signals/lib/tradify-store.tsx` — local persisted mobile state and CRUD actions
- `artifacts/tradify-signals/components/TradifyUI.tsx` — shared mobile UI primitives
- `artifacts/tradify-signals/app` — tabs and secondary routes
- `artifacts/tradify-signals/reference` — preserved strategy, MT5 bridge, type, and product references from the supplied source archive
- `lib/api-spec/openapi.yaml` — shared API contract
- `lib/db/src/schema` — database schema

## Architecture decisions

- The mobile client is Expo Router with native-safe-area handling and a five-area tab shell.
- First mobile build uses AsyncStorage-backed state so the product is usable in Expo Go without requiring credentials or live third-party services.
- MT5 is represented as the preferred feed and Yahoo/Binance as fallbacks in the product language; strategy terminology is preserved from the supplied reference.
- Mobile interactions use sheets, native alerts, touch feedback, and compact data cards instead of web-style dense tables.

## Product

Tradify Signals helps a trader review live setup opportunities, understand session context, validate entry/stop/target levels, size risk, track active trade lifecycle, maintain a canonical 22-instrument watchlist, configure price alerts, inspect performance, choose between DGv8, BBB, BBB Gold 3S, and Monitoring strategy modes, and manage profile, membership, legal, and restricted operations screens.

## User preferences

- The user explicitly wants this product delivered as a mobile app.
- Persisted admin roles are authoritative; public registration and the development preview account never grant administrator access.

## Operating mode

Treat the project as a company moving toward launch, not as an endless individual contributor backlog. Review decisions through founder/product/engineering/security/QA/marketing/finance lenses:

- Prioritize launch progress, day-one customer value, correctness, reliability, security, data protection, payments, trust, conversion, and operating cost.
- Default to executing decisions within the requested scope. Ask the user only when a choice is irreversible or changes cost, architecture, or user-facing scope.
- Do not suggest or queue tasks by default. Surface a task only when it blocks go-live, creates real security/data-loss/payment/legal/compliance risk, or is likely to cost users or revenue soon after launch.
- Cap any necessary blocker suggestions at three. Suppress polish, speculative features, refactors, and future-proofing unless explicitly requested.
- Every surfaced blocker must be valid and verified against the actual codebase, logs, or a reproduced failure. Include one concrete evidence line; do not report hypothetical or generic risks.
- Classify findings as P0 go-live blocker, P1 high-value pre-launch, P2 post-launch improvement, or ignore/not worth building. Only P0 items must block launch; P1 items delay launch only when the benefit clearly justifies it.
- Fix failing workflows, builds, and APIs before planning additional work.
- Challenge commercially weak, unnecessarily complex, dangerous, confusing, or low-value requests and recommend one stronger alternative when needed.
- For launch readiness, review the complete system: auth, onboarding, permissions, core journey, payments, webhooks, idempotency, failure states, mobile compatibility, database integrity, secrets, API security, monitoring, analytics, support, admin operations, and reconciliation.
- After meaningful implementations or milestones, reassess the complete product and business for blind spots: what exists, what is missing, what matters now, what can wait, what should not be built, and what blocks launch.
- Classify discovered work as MUST DO, SHOULD DO, POST-LAUNCH, or DO NOT BUILD. Only surface MUST DO items and carefully selected SHOULD DO items; the goal is not zero remaining tasks, but a launch where the remainder does not justify delay.
- Separate responses into `MUST FIX BEFORE LAUNCH`; only include `POST-LAUNCH` when explicitly requested.
- End launch-readiness responses with `GO-LIVE READY: YES / NO` and, when `NO`, one specific reason.
- Before responding, remove any suggestion that lacks concrete evidence. If none remain, say `No blockers`.
- After implementation, report what changed, what was verified, remaining known risks, go-live impact, and one clear company-level recommendation. Include a next task only when it has meaningful business or risk-reduction value.

## Gotchas

- Expo preview is reached through the managed mobile workflow and can be scanned into Expo Go.
- Keep `app.json` static; do not replace it with a dynamic Expo config.
- Preserve broker-candle terminology and strategy calculations when wiring the live API in a later pass.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
