# TradifyApp Production Restoration Plan

**Project:** Original TradifyApp Journal — `tradifyapp.com`

**Review date:** 14 October 2026

**Status:** **NO-GO for production release.** Development verification is complete; the production host, TLS, database identity/allowance, and live service configuration are not yet verified.

## 1. Scope and safety boundary

This review did not connect to, wake, or query production Neon; create a snapshot; start the production application; change DNS; publish a deployment; run migrations; start a worker; send email; or call live payment services. No Tradify Signals or Tradigo files were changed.

Write tests used a unique PostgreSQL cluster and database under `/tmp`, bound only to `127.0.0.1`, with synthetic `example.invalid` identities. The temporary database and cluster are removed after verification. The existing `DATABASE_URL`, `NEON_DATABASE_URL`, and development database configuration are not changed.

The previously accepted security remediation remains development-only; this report does not approve its production release.

## 2. Current hosting and public availability

### Observations

- `tradifyapp.com` currently resolves to **`34.111.179.208`**.
- `www.tradifyapp.com` is a CNAME to the root domain and resolves to the same address.
- The authoritative nameservers are `dns1.registrar-servers.com` and `dns2.registrar-servers.com`.
- The address is in Google's cloud network (AS396982). This identifies the network provider, not the exact Google Cloud product, account, or running application.
- Plain HTTP redirects to HTTPS. A TLS connection to the HTTPS endpoint for this hostname closed before returning a certificate (`unexpected eof while reading` / `SSL_ERROR_SYSCALL`). A control HTTPS request to an unrelated public site succeeded from the same environment.
- Replit deployment metadata reports **no active deployment** for this workspace.
- The project is configured for Replit **Autoscale**, but that configuration is not itself a published deployment.
- An earlier owner-provided Neon screenshot showed the production branch archived and Primary compute idle. That is historical evidence only; its current state was not checked.

### Finding

The domain is not currently pointed at an active Replit deployment. It points at a Google Cloud network address, plausibly a Google Cloud load-balancer/front-end address, but passive DNS and connection results cannot identify the underlying service or account. The public HTTPS endpoint was unavailable from this verification environment; this is not proof that every visitor worldwide receives the same result.

Because the TLS handshake failed before an application response, the currently served TradifyApp version—and whether it contains the vulnerable pre-remediation code—**could not be confirmed**. Treat the old endpoint as unresolved risk until its owning host/account is identified. No exploit, private route, customer API, or customer record was accessed. No DNS or hosting change was made.

If the owning host confirms that a vulnerable old instance is active, the safest containment is to disable or restrict that specific backend at its hosting edge, after the owner identifies it and approves the change. Do not redirect traffic blindly: the current DNS target has not been identified as a recoverable application.

## 3. Intended deployment architecture and Vercel decision

### Replit Autoscale is the configured target

The workspace configuration specifies:

```text
Build: npm run build
Run:   node ./dist/index.cjs
```

The build produces the client under `dist/public`, the server entry under `dist/index.cjs`, and a separate `dist/worker.cjs`. The Replit deployment run command starts only the web server; it does not start the worker. `server/index.ts` registers routes, serves static files in production, and explicitly reports that scheduled work belongs to a separate worker entry point.

The app selects `DATABASE_URL` when built/run with `NODE_ENV=production`. It does not perform automatic schema migrations at startup; the schema-repair function throws rather than applying changes. Do not run `npm run db:migrate` as part of an initial restoration.

### Vercel is not part of the configured Replit release

- The Replit build entry is `server/index.ts`; the built `dist/index.cjs` contains no Vercel `api/index.ts` adapter.
- `vercel.json` exists in the repository, but its build command expects `client/package.json`, which is absent.
- No Vercel account or deployment metadata was available, so an independent Vercel deployment cannot be ruled out.
- The legacy `api/index.ts` adapter has not been made production-ready. Its registration path can establish a session without the verification gate used by the main server. Do not route customer traffic to that adapter; if a live Vercel deployment is discovered, contain it at its host only with approval and harden it before any future use.

No Vercel or Replit production deployment was created or changed.

## 4. Regression verification

Verification used only synthetic records and the isolated local database. No external SMTP, Stripe, PayPal, OpenAI, or production database calls were made.

| Area | Result |
|---|---|
| TypeScript check (`npm run check`) | Passed |
| Production build (`npm run build`) | Passed |
| Existing focused security/unit tests | 51 passed |
| Real route-registration integration tests | 7 passed |
| Background-job state tests | 3 passed |
| Email outbox/delivery tests | 3 passed |
| **Total tests reported** | **64 passed** |

The integration suite exercised:

- Registration without a session, email-verification gating, verified login, session cookie, logout invalidation, and safe user projection.
- A Free-tier user being denied a Pro-only PDF-report route.
- MT5 token generation/reveal, invalid token rejection, a synthetic valid bridge sync, and cross-user account/status/role denial.
- Prop-firm challenge owner access and cross-user read/update/delete denial.
- Admin authorization, Owner-role promotion denial, and redaction of synthetic credential canaries in audit logs.
- Forged Stripe signature rejection and entitlement remaining unchanged; a locally signed Stripe test event updates only the synthetic user's entitlement.
- PayPal signature-verification failure without entitlement change, followed by a successful synthetic event using a mocked PayPal HTTP transport.
- Retired AI route returning HTTP 410 before an inference provider is called.

The Stripe webhook now uses the exact bytes captured by the global JSON parser when present, and the PayPal webhook uses those same raw bytes for signature verification. The tests reproduce the production parser order and confirmed both webhook flows. These are local application tests, not a live checkout, webhook, email, MT5 terminal, or production startup test.

The MT5 sync test exposed an alert-history fallback query that referenced a `profit` column absent from the declared `mt5_history` schema. It now reads the schema's `net_pl` and `gross_pl` fields. A subsequent synthetic sync exercised the fallback without the PostgreSQL column error; no API response shape changed.

The build also reports a client chunk over 500 kB and `import.meta` warnings while emitting CommonJS. The production branch serves `dist/public`; Vite is only dynamically imported by the development branch. These are build/performance warnings, not evidence that a production Vite dev server starts.

## 5. Dependency exposure and remaining risks

### Production server artifact

The configured production entry is `dist/index.cjs`. Production-reachable external packages include the PostgreSQL client, Stripe client, PayPal server SDK, Replit object storage, and backup/archive support. The separately built worker is not launched by the Autoscale run command.

Vite, its React plugin, and the Replit Vite error overlay appear in the bundle's lazy development-only branch. The build substitutes `NODE_ENV="production"` and the production path uses `server/static.ts`; it does not execute the Vite branch. Vite/Tailwind/PostCSS/TypeScript/test tooling and the mockup sandbox are not production server functionality. Some build/test packages are nevertheless classified under the root `dependencies` list (including `vitest` and `tailwindcss-animate`), which unnecessarily enlarges the installed/audited dependency graph. That packaging cleanup was not made in this restoration change to avoid altering the dependency lock/install behavior.

### Root audit

`npm audit --omit=dev` reports **0 critical, 5 high, 9 moderate, and 1 low** findings in the install graph.

- The high findings are in the Tailwind/build-tool chain (`braces`, `chokidar`, `fast-glob`, `micromatch`, and Tailwind/PostCSS-related packages). They are not imported by the production server artifact. Some do not have a safe in-place fix in the current dependency tree; a major Tailwind migration is not justified solely to clear the audit.
- The production-reachable risk is the Replit object-storage chain used by backup and trade-chart storage: `@replit/object-storage` → Google Cloud Storage and related packages (`gaxios`, `retry-request`, `teeny-request`, `uuid`). The audit has no safe fix for the top-level Replit storage package/current chain. Replacing or overriding it could affect stored backups/charts, so it was not changed.
- The low `esbuild` advisory concerns the development server on Windows; it is not loaded by the Linux production server path.

### Separate mockup sandbox

The separate `artifacts/mockup-sandbox` dependency tree is not included in TradifyApp's Replit production build. Its own audit reports **0 critical, 10 high, 1 moderate, and 2 low** findings, mostly in Vite and build tooling. No sandbox packages were changed as part of restoring TradifyApp; these findings should not be confused with the production server's reachable dependency risk.

## 6. Production configuration readiness

Only configuration names and secret-presence metadata were inspected; secret values were not accessed or printed.

| Configuration | Current evidence | Restoration requirement |
|---|---|---|
| `DATABASE_URL` | Present as a production secret. Production code selects this name. | Preserve its existing value and prove it identifies the original production project/branch only after approval. Do not replace it with a new database. |
| `NEON_DATABASE_URL` | Present as a secret; not queried. | Preserve unchanged. Do not wake or query the branch before the separate approval below. |
| `SESSION_SECRET` | Present as a production secret. | Preserve; never print or rotate during this recovery step. |
| Stripe API access | Replit Stripe integration is installed/configured in the workspace; production connector credentials were not exercised. | Confirm the production connector context without creating a live checkout. The app also requires `STRIPE_WEBHOOK_SECRET`, which was not present in production secret metadata. |
| PayPal | Shared config declares PayPal live mode and contains client/plan configuration (values withheld). `PAYPAL_CLIENT_SECRET` was not present in production secret metadata. | Verify `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and the applicable `PAYPAL_*_PLAN_ID` values in the production environment. Keep live processing disabled until separately approved. |
| Email | Code uses Gmail SMTP at `smtp.gmail.com:587`. `SMTP_USER`, `SMTP_APP_PASSWORD`, and `EMAIL_DELIVERY_ENABLED` were not declared in `.replit` or found in production secret metadata. | Configure the approved production mail account and `EMAIL_DELIVERY_ENABLED=true` only after approval. Until then, production verification/reset emails cannot be relied on. |
| Email links | `APP_URL` is declared in `.replit` (value withheld); `FROM_EMAIL` and `SUPPORT_EMAIL` have code defaults. | Confirm production links and sender configuration before enabling delivery. |
| Worker | Separate command: `npm run jobs` (`node dist/worker.cjs`). | Keep it stopped. Start a worker and set `BACKGROUND_JOBS_ENABLED=true` only after explicit approval and a reviewed schedule. |

`server/emailService.ts` sends only when the process is production, `EMAIL_DELIVERY_ENABLED` is exactly `"true"`, and both SMTP credentials are present. The current development test run disabled email and used test doubles. No real message was sent.

## 7. Staged restoration procedure

### Stage A — identify and verify the existing production database (approval required)

1. Do not create another production database or purchase a snapshot.
2. Before any database connection, confirm the original Neon project ID, production branch ID, database name, role, and compute endpoint from Neon metadata. Compare with the owner's known original TradifyApp branch. Stop if any identity differs or is ambiguous.
3. Confirm the account's current Free-plan allowance without initiating paid usage. If the Free allowance or reactivation cost cannot be confirmed, stop.
4. Obtain approval to wake the existing compute for one short read-only check. No connection before this approval.
5. After approval, use a transaction explicitly set `READ ONLY`; query only schema metadata and counts needed for `user_role`, MT5 history, MT5 accounts, prop-firm challenges, journal records, and subscription records. Compare against the previously reported reference counts (53 user-role rows, 31,722 MT5-history rows, 21 MT5 accounts, 8 challenges); those historical counts were not rechecked in this review.
6. Do not execute migrations, seed data, inspect customer details, modify roles, or run the app/worker. Close the connection after counts and report the branch/compute status. Stop and wait for the next approval.

### Stage B — prepare the Replit release candidate (no production traffic)

1. Keep the original `DATABASE_URL` unchanged and `DEV_DATABASE_URL` separate. Confirm the production secret points to the verified original Neon branch before any app deployment is approved.
2. Use `npm run build`; the configured web command is `node ./dist/index.cjs`.
3. Do not run `npm run db:migrate`, `npm run db:generate`, or startup schema repair. Check existing schema compatibility read-only first; any required schema change needs a separately reviewed migration and explicit approval.
4. Keep `npm run jobs` stopped. Do not activate scheduled tasks, backup jobs, MT5 sync workers, or any external scheduler.
5. Keep email delivery disabled until the production SMTP identity and sender configuration are approved and verified.
6. Keep Stripe and PayPal live processing disabled until production connector/secrets and webhook endpoints are verified. Use only provider test-mode events for release smoke tests.
7. Verify signup, email verification, login/logout, subscriptions, admin routes, MT5 token ownership, and challenge ownership using synthetic accounts. Do not create test users or trades in production.

### Stage C — domain and HTTPS cutover (separate approval required)

1. Identify the current Google Cloud/DNS owner and confirm whether an old backend is still active. The present DNS records and TLS failure are the rollback baseline.
2. Create and verify the Replit Autoscale deployment only after the owner approves publication. Confirm health, production database identity, auth, and service gates on the Replit-provided deployment URL first.
3. Add the custom domain through Replit's deployment settings and wait for Replit to provide the exact required DNS records and certificate status. Do not guess an IP or modify DNS from this plan.
4. Before any DNS change, record the current A/CNAME values and TTL. Obtain explicit approval for each DNS edit. Confirm HTTPS certificate validity and public homepage access after propagation.
5. Do not switch traffic if TLS, production DB identity, email verification, auth, or payment webhook configuration remains unverified.

### Stage D — post-release smoke tests (only after publication approval)

- Check the public homepage and HTTPS certificate from more than one public vantage point.
- Check health/public pages; verify login/session behavior with a synthetic account.
- Verify email in a controlled approved mailbox only after the user authorizes sending.
- Test Stripe/PayPal with provider test modes and signed test webhooks; never use a live charge for the smoke test.
- Confirm MT5 bridge auth using a dedicated synthetic test account before reconnecting customer terminals.
- Confirm the web process did not start a worker, seed records, or apply migrations.
- Compare read-only record counts before/after; investigate any unexpected change and stop further actions.

## 8. Rollback, recovery, and cost

### Rollback and recovery

- If the candidate is unhealthy before DNS cutover, stop or roll back the Replit deployment; leave DNS and the existing database unchanged.
- If traffic has been switched with approval, use the saved DNS values only as an approved rollback. Note: the currently observed old DNS target fails TLS from this environment, so restoring those records may not restore access.
- Do not restore, reset, merge, migrate, or replace the production database as part of this plan. No manual snapshot was created. Any later production write requires a separately approved recovery procedure and reviewed migration.

### Cost

- Replit Autoscale is usage-based. Replit's published Autoscale rate is **$0.60 per million compute units**, with account-plan credits affecting the bill. This account's plan, credits, and actual monthly use were not inspected. No Replit deployment was active during this review.
- Neon documents a Free plan with **191.9 compute hours per project per month** and scale-to-zero behavior; the owner's current plan, remaining allowance, and cost of waking the archived production branch are **not verified**. No snapshot, upgrade, or production compute wake occurred.
- The old Google Cloud resource's billing status is unknown; no Google Cloud account was available.

References:

- Replit Autoscale billing: https://docs.replit.com/billing/deployment-pricing
- Replit usage-based billing: https://docs.replit.com/billing/about-usage-based-billing
- Neon plans: https://neon.tech/pricing
- Neon plan/compute documentation: https://neon.tech/docs/introduction/plans

## 9. Readiness decision

**NO-GO for production deployment or DNS cutover.** Development verification and the production build pass, but:

1. The current public HTTPS endpoint fails TLS from this environment and its owning Google Cloud service is unidentified.
2. No Replit production deployment exists, and a Vercel deployment cannot be ruled out from workspace metadata alone.
3. The original production Neon branch identity and Free-plan compute allowance have not been verified; no production connection was made.
4. Production email configuration is not ready/verified, and the production Stripe webhook secret and PayPal client secret are absent from secret metadata.
5. The production-reachable Replit object-storage dependency chain has unresolved moderate audit findings.
6. No production smoke test, live payment, email, DNS cutover, or worker test is authorized or completed.

The next safe step is a narrowly scoped, read-only identity/count check against the existing Neon production branch, only after the owner approves waking compute and only if the Free allowance is confirmed. No other production action is implied by that approval.
