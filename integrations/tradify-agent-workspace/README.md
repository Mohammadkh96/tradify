# Tradify Signals

Tradify Signals is a mobile-first trading intelligence product for active
traders. It provides market quotes and charts, strategy signals, trade
planning, watchlists, price alerts, performance views, membership, and an
MT5-connected market-data workflow. A separate staff portal is used to manage
customers, access, strategies, market data, billing operations, and audits.

## Architecture

- **Mobile/customer app:** Expo, React Native, Expo Router, and TypeScript in
  `artifacts/tradify-signals`.
- **Staff portal:** React, Vite, and TypeScript in `artifacts/tradify-admin`.
- **API:** Express 5 and TypeScript in `artifacts/api-server`. The API handles
  authentication, customer state, billing webhooks, market data, signals,
  provider authority, and operational checks.
- **Contracts:** `lib/api-spec/openapi.yaml` is the API contract source.
  Generated React Query clients and Zod schemas live in the shared `lib/`
  packages.
- **Persistence:** Replit-managed PostgreSQL, Drizzle ORM, and `pg`, with
  schema definitions in `lib/db/src/schema/`.
- **Market connectivity:** the API accepts MT5 bridge updates and also has
  provider adapters for configured external market-data services.
- **Operations:** Replit artifact services serve the API, static Admin portal,
  and Expo web build. The API also runs periodic operational checks.

The MT5 bridge and some market-provider runtime state are process-local. Run
the API as a **single always-on Reserved VM**; do not autoscale it or run
multiple API instances until that state is moved to shared persistence.

## Run locally

Use the workspace's pinned Node.js and pnpm versions:

```sh
pnpm install --frozen-lockfile
```

Configure the development database and the required local secrets through
Replit's Secrets tooling. Do not place secret values in this file or commit
them. The preconfigured workspace workflow starts the local services. To run
one service directly:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/tradify-admin run dev
pnpm --filter @workspace/tradify-signals run dev
```

The development API, Admin portal, and Expo app use their artifact-managed
ports and paths. The API is exposed under `/api`; its readiness endpoint is
`/api/health` and its lightweight liveness endpoint is `/api/healthz`.

## Environment variables

Values are intentionally omitted. Store private values in Replit Secrets.
`DATABASE_URL` and the related `PG*` variables are supplied by Replit's
managed database and should not be entered manually. The API runtime prefers
the `NEON_DATABASE_URL` secret when present; schema tooling and isolated test
setup continue to use `DATABASE_URL`. Store private values in Replit Secrets.
The `EXPO_PUBLIC_*` variables are embedded in client builds and must never
contain private keys.

| Name                                        | Purpose                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                  | Node runtime mode; production services use `production`.                                            |
| `APP_ENV`                                   | Application environment label used by API error monitoring.                                         |
| `PORT`                                      | Port supplied to each artifact service.                                                             |
| `BASE_PATH`                                 | Artifact route prefix used by the web build and preview.                                            |
| `DATABASE_URL`                              | Replit-managed PostgreSQL connection string.                                                        |
| `NEON_DATABASE_URL`                         | Optional direct Neon connection used by the API runtime when configured.                            |
| `PGDATABASE`                                | Database name used by PostgreSQL tooling and the isolated test runner.                              |
| `SESSION_SECRET`                            | Signs and verifies customer/admin session tokens.                                                   |
| `MT5_BRIDGE_SECRET`                         | Authenticates the MT5 Expert Advisor to the API.                                                    |
| `SENTRY_DSN`                                | Optional Sentry project DSN; enables API error reporting when set.                                  |
| `LOG_LEVEL`                                 | API structured-log threshold; defaults to `info`.                                                   |
| `TRADIFY_ADMIN_EMAILS`                      | Email allow-list used for initial administrator access.                                             |
| `TRADIFY_ADMIN_PUBLIC_ORIGIN`               | Public Admin portal origin, when a distinct origin is used.                                         |
| `TRADIFY_CORS_ORIGINS`                      | Additional allowed browser origins, comma-separated.                                                |
| `TRADIFY_PASSWORD_RESET_FROM_EMAIL`         | Sender address for account recovery email.                                                          |
| `REVENUECAT_WEBHOOK_SECRET`                 | Verifies RevenueCat webhook authorization. Required before production billing webhooks are enabled. |
| `REVENUECAT_PROJECT_ID`                     | RevenueCat project identifier used by catalog tooling.                                              |
| `REVENUECAT_APPLE_APP_STORE_APP_ID`         | RevenueCat's Apple app identifier for catalog tooling.                                              |
| `REVENUECAT_GOOGLE_PLAY_STORE_APP_ID`       | RevenueCat's Google Play app identifier for catalog tooling.                                        |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`        | Public RevenueCat SDK key embedded in the iOS app.                                                  |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`    | Public RevenueCat SDK key embedded in the Android app.                                              |
| `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY` | Public test-store SDK key, if the test store is enabled.                                            |
| `EXPO_PUBLIC_API_URL`                       | API origin embedded in the Expo build.                                                              |
| `EXPO_PUBLIC_DOMAIN`                        | Public app domain embedded in the Expo build.                                                       |
| `EXPO_PUBLIC_REPL_ID`                       | Replit app identifier embedded by the Expo development build.                                       |
| `REPL_ID`                                   | Replit app identifier used by development tooling and Expo build defaults.                          |
| `ALPHAVANTAGE_API_KEY`                      | Optional Alpha Vantage reference market-data provider.                                              |
| `EODHD_API_KEY`                             | Optional EODHD reference market-data provider.                                                      |
| `MASSIVE_API_KEY`                           | Optional Massive historical market-data provider.                                                   |
| `TWELVE_DATA_API_KEY`                       | Optional Twelve Data market-data provider.                                                          |
| `TWELVE_DATA_INGESTION_ENABLED`             | Explicitly enables Twelve Data background ingestion.                                                |
| `TWELVE_DATA_MAX_REQUESTS_PER_MINUTE`       | Verified request budget required for Twelve Data ingestion.                                         |
| `TRADIFY_PROFILE_MARKET_SNAPSHOT`           | Enables the optional profile market snapshot feature when set to `1`.                               |
| `TRADIFY_MARKET_DATA_UPSTREAM_URL`          | Development-only upstream API used by the market-data proxy.                                        |
| `TRADIFY_ALLOW_DEV_SEED`                    | Explicit development-only opt-in for the reference-data seed.                                       |
| `REPLIT_EXPO_SESSION_SECRET`                | Replit Expo tooling credential used only by the development workflow.                               |
| `REPLIT_DEV_DOMAIN`                         | Replit development hostname used by local preview tooling.                                          |
| `REPLIT_EXPO_DEV_DOMAIN`                    | Expo development hostname used by local preview tooling.                                            |
| `REPLIT_INTERNAL_APP_DOMAIN`                | Internal Replit app hostname allowed by development CORS.                                           |
| `REPLIT_DEPLOYMENT`, `REPLIT_DEPLOYMENT_ID` | Replit deployment markers used to prevent running the development seed in a deployment.             |
| `STATIC_BUILD_DIR`                          | Optional static build output directory override for the Expo web build/server.                      |
| `LIVE_QUOTES_URL`                           | Optional URL override for the live-quote validation script.                                         |
| `LIVE_QUOTES_SAMPLES`                       | Optional sample-count override for live-quote validation.                                           |
| `LIVE_QUOTES_INTERVAL_MS`                   | Optional interval override for live-quote validation.                                               |
| `LIVE_QUOTES_TIMEOUT_MS`                    | Optional request-timeout override for live-quote validation.                                        |
| `LIVE_QUOTES_MAX_AGE_MS`                    | Optional quote-freshness limit for live-quote validation.                                           |

Values used only by integration tests, billing restart probes, and load-test
helpers are not production configuration and should not be copied into
deployment settings.

## Tests and checks

The root test runner verifies the development database target, creates a unique
disposable test database, runs the suites against it, and drops it afterward:

```sh
pnpm test
```

Do not point database-mutating tests at production or the shared development
database directly. Other useful checks:

```sh
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/tradify-admin run build
pnpm --filter @workspace/tradify-signals run build
pnpm --filter @workspace/scripts run check:live-quotes
```

The live-quote check requires a reachable live feed and can fail when the
provider is stale or unavailable; that is a market-data status, not a unit
test failure.

## Schema changes and seed data

Drizzle schema source lives in `lib/db/src/schema/`. Apply a schema change to
the development database with:

```sh
pnpm --filter @workspace/db run push
```

Post-merge setup applies the schema to development with `push-force`. On
Publish, Replit compares development and production schemas and applies the
production diff. Review rename and destructive-change prompts in the Publish
UI. Never run `push`, `push-force`, custom DDL, or schema migration code
against production or from an application startup hook.

The opt-in seed initializes reference/control-plane data only; it does not add
sample customer accounts:

```sh
NODE_ENV=development TRADIFY_ALLOW_DEV_SEED=1 \
  pnpm --filter @workspace/api-server run db:seed:dev
```

The seed refuses to run in a Replit deployment.

## Deploy

The project is configured for a **Reserved VM** deployment. The API must remain
single-instance because bridge and provider state is process-local. Admin is
served as a static SPA; the Expo web build is served by its production static
server. Their build and run commands are declared in each artifact's
`.replit-artifact/artifact.toml`.

1. Confirm production Replit Secrets and build-time public app variables are
   configured (see the table above).
2. Open **Publish** and verify the deployment target is Reserved VM.
3. Review any development-to-production database diff before approving it.
4. Publish, then verify the API health route and the customer/Admin routes.
5. Configure an external uptime check against the public
   `/api/health` endpoint.

Replit supplies deployment TLS and health checks. For a custom domain, add it
in Publishing, copy the exact DNS records Replit provides to the domain
registrar, and wait for validation and certificate provisioning. If a proxy
such as Cloudflare is used, leave the DNS record in DNS-only mode during
certificate validation. If the mobile build should call the custom domain,
update `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_DOMAIN`, then rebuild and
republish the app.

## Back up and restore PostgreSQL

Use the Replit Database pane's production restore controls to select a
restore point or point-in-time timestamp within the retention available to the
workspace's plan. Confirm the production database and recovery time before
restoring. Preserve any newer records that must survive. A database restore
does not roll back application code; publish or revert code separately.

## Known limitations and recommended next improvements

- MT5 bridge and some market-provider state are process-local; moving them to
  shared persistence is required before autoscaling or running multiple API
  instances.
- Production RevenueCat webhooks fail closed unless `REVENUECAT_WEBHOOK_SECRET`
  is configured both in Replit Secrets and the provider's webhook settings.
- Sentry API instrumentation is optional and remains inactive until
  `SENTRY_DSN` is configured. Replit deployment logs and monitoring remain
  available in the meantime.
- Live market-data availability and provider entitlements depend on external
  broker/provider services; a configured key does not guarantee symbol or
  timeframe access.
- The legal pages still contain template-review warnings and the support
  contact is a placeholder. Replace them with reviewed terms, privacy text,
  and a monitored support address before public launch.
- Product analytics are not added. Prefer deployment-level traffic/health
  metrics first; add customer analytics only after choosing a privacy policy,
  consent model, retention period, and event allow-list that excludes trading
  details and other sensitive account data.
