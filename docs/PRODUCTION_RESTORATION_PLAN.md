# TradifyApp Production Restoration Plan

**Project:** Original TradifyApp Journal — `tradifyapp.com`

**Review date:** 14 October 2026

**Status:** **NO-GO for production release.** Development verification and the approved read-only Neon identity/count check are complete. Public TLS, the current host owner, and live service configuration remain unresolved.

## 1. Scope and safety boundary

The initial review did not connect to production Neon. After conditional approval, Neon control-plane metadata was checked and one read-only transaction was run against the identified production branch. No snapshot was created; no database writes, migrations, application startup, DNS changes, deployment, worker, email, or live payment activity occurred. No Tradify Signals or Tradigo files were changed.

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
- Neon control-plane metadata identifies project **Tradify** (`green-art-19890518`), branch **production** (`br-empty-wildflower-ahbsfyzr`), database **`neondb`**, role **`tradify_app`**, and endpoint **`ep-sparkling-moon-ahtc0gbu`** in `aws-us-east-1`.
- The branch metadata reports `ready`; the endpoint was `idle` before the approved SQL check and `active` afterward. An earlier owner-provided screenshot showed an archived-branch banner, so the archive-state discrepancy remains unexplained. No branch archive/unarchive or endpoint-management operation was invoked.

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

Regression tests used only synthetic records and the isolated local database. No external SMTP, Stripe, PayPal, or OpenAI calls were made. Separately, the approved production check selected aggregate counts only; no customer row details were queried.

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
| `DATABASE_URL` | Present as a production secret. Production code selects this name. Its value was not read, so it is not yet confirmed to point to the identified branch. | Preserve its existing value; verify the mapping without exposing it before deployment approval. Do not replace it with a new database. |
| `NEON_DATABASE_URL` | Present as a secret; its value was not read or used for the approved check. | Preserve unchanged. |
| `SESSION_SECRET` | Present as a production secret. | Preserve; never print or rotate during this recovery step. |
| Stripe API access | Replit Stripe integration is installed/configured in the workspace; production connector credentials were not exercised. | Confirm the production connector context without creating a live checkout. The app also requires `STRIPE_WEBHOOK_SECRET`, which was not present in production secret metadata. |
| PayPal | Shared config declares PayPal live mode and contains client/plan configuration (values withheld). `PAYPAL_CLIENT_SECRET` was not present in production secret metadata. | Verify `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and the applicable `PAYPAL_*_PLAN_ID` values in the production environment. Keep live processing disabled until separately approved. |
| Email | Code uses Gmail SMTP at `smtp.gmail.com:587`. `SMTP_USER`, `SMTP_APP_PASSWORD`, and `EMAIL_DELIVERY_ENABLED` were not declared in `.replit` or found in production secret metadata. | Configure the approved production mail account and `EMAIL_DELIVERY_ENABLED=true` only after approval. Until then, production verification/reset emails cannot be relied on. |
| Email links | `APP_URL` is declared in `.replit` (value withheld); `FROM_EMAIL` and `SUPPORT_EMAIL` have code defaults. | Confirm production links and sender configuration before enabling delivery. |
| Worker | Separate command: `npm run jobs` (`node dist/worker.cjs`). | Keep it stopped. Start a worker and set `BACKGROUND_JOBS_ENABLED=true` only after explicit approval and a reviewed schedule. |

`server/emailService.ts` sends only when the process is production, `EMAIL_DELIVERY_ENABLED` is exactly `"true"`, and both SMTP credentials are present. The current development test run disabled email and used test doubles. No real message was sent.

## 7. Staged restoration procedure

### Stage A — identify and verify the existing production database (completed)

1. No new production database or paid snapshot was created.
2. Neon metadata confirmed project `Tradify` (`green-art-19890518`), production branch `br-empty-wildflower-ahbsfyzr`, database `neondb`, role `tradify_app`, and endpoint `ep-sparkling-moon-ahtc0gbu`.
3. The project owner metadata reports the Free plan (`free_v3`). For the 1 October–1 November usage window, the project counters showed 815 compute seconds and 2,924 active seconds; the endpoint's configured maximum is 2 CU. Even at that maximum, the reported active period is about 1.63 CU-hours, well below Neon Free's published 191.9 CU-hours per project per month. These are control-plane counters, not a final invoice.
4. With the owner's conditional approval, one transaction began with `SET TRANSACTION READ ONLY`. A `current_setting('transaction_read_only')` result confirmed `on`. The transaction used only identity/count `SELECT`s. Results: `user_role` 53; `mt5_history` 31,722; `mt5_accounts` 21; `prop_firm_challenges` 8; `trade_journal` 1. Subscription tiers: ELITE 8, FREE 18, PRO 27 (one PRO row has `founding_member_access`; the other 26 have no status value). The four reference counts supplied earlier match.
5. No customer-level rows or secrets were selected. No roles, records, schemas, or permissions were changed. No snapshot, migration, seed, application, or worker was used.
6. The endpoint was still reported `active` 85 seconds after its last recorded activity, despite a zero-second suspend-time setting. No manual suspend/restart was performed. Stop further production activity and obtain separate approval before any endpoint-management action.

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
- Neon documents a Free plan with **191.9 CU-hours per project per month**. The project metadata reports Free (`free_v3`) and low current-period usage as detailed in Stage A. The read-only query did wake the endpoint; it was still reported `active` after 85 seconds, so compute status should be rechecked in the Neon console before any further use. No snapshot or upgrade occurred.
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
3. The original Neon identity and read-only record counts are verified, but the production `DATABASE_URL` secret's mapping to that branch remains unverified; Neon still reported the endpoint active after the check.
4. Production email configuration is not ready/verified, and the production Stripe webhook secret and PayPal client secret are absent from secret metadata.
5. The production-reachable Replit object-storage dependency chain has unresolved moderate audit findings.
6. No production application startup, smoke test, live payment, email, DNS cutover, or worker test is authorized or completed.

The approved read-only identity/count check is complete. No further Neon operation, database write, endpoint change, deployment, DNS edit, or activation of email, payment processing, or workers is approved by that check.

## 10. Development-only entitlement protection verification (15 October 2026)

The development release candidate now expires a founding-member Pro grant only when the account is still marked `founding_member = true`, has tier `PRO`, has the explicit status `founding_member_access`, and its recorded grant expiry has passed. New founding-member registrations receive that explicit status and a 30-day expiry. A legacy null status is not treated as proof of either an active paid subscription or an expired grant, so this route leaves it unchanged pending account-level review.

Paid subscription states use their provider paths instead: verified Stripe checkout events grant the tier and verified subscription-deleted events revoke it; verified PayPal activation events grant the tier, cancellation retains the current tier, and the provider's expired event downgrades it. The founding-grant expiry check does not override an active or cancelled paid state. The legacy one-time PayPal order-capture endpoint no longer grants a subscription tier; only subscription activation and verified webhook paths can do that. Self-service profile updates accept only profile fields; attempts to submit tier, status, provider, founder flag, expiry date, or identity headers do not alter entitlement data.

Verification performed locally with synthetic users, mocked payment transports, and a disposable loopback-only PostgreSQL cluster:

| Check | Result |
|---|---|
| Entitlement/security integration suite | 9 passed |
| TypeScript check (`npm run check`) | Passed |
| Production build (`npm run build`) | Passed; existing large-client-chunk and CommonJS `import.meta` warnings remain |
| Production database, billing, email, DNS, deployment, workers | Not accessed or activated |

The prior approved aggregate-only production check found 27 PRO accounts: 1 with `founding_member_access` and 26 with a null subscription status. No customer-level entitlement/provider rows were reviewed, and this change does not alter production records. The exact legitimate entitlement basis for those 26 null-status accounts therefore remains unverified. Preserve their current access until their provider evidence or original grant records are reviewed; do not infer that null means paid-active, cancelled, or expired. Stripe's current entitlement path handles completed subscription checkout and deletion, but does not reconcile intermediate states such as `past_due` or `unpaid`; define and verify a grace/revocation policy before enabling production billing.

Paid cancellation grace also depends on receiving the provider's expiration event. If that event is delayed or absent, a cancelled paid account may retain its existing tier until provider state is reconciled. This verification did not contact either payment provider or inspect individual production subscriptions.

## 11. Focused hosting preparation (15 October 2026)

### Deployment and runtime

The existing `.replit` target remains Autoscale, with build `npm run build` and run `node ./dist/index.cjs`. The production bundle runs on Node.js 20, listens on `PORT` (configured as `5000`) and binds to `0.0.0.0`. The current deployment service reports no active deployment and no production URL. The application uses the existing external Neon connection; it does not provision a replacement database.

Startup registers routes and serves the production client. It does not call `ensureSchemaColumns`, run migrations, seed sample data, or start the separate worker. The Postgres session store has `createTableIfMissing: false`. The web process logs that scheduled work is separate. `/api/health` is process liveness only, not a database-readiness check. Normal customer requests can write their relevant records; in particular, `/api/user` can downgrade an explicitly expired founding grant when that route is requested.

### Safe production defaults prepared in development

Production environment defaults now set `LIVE_BILLING_ENABLED`, `EMAIL_DELIVERY_ENABLED`, `MT5_SYNC_ENABLED`, and `BACKGROUND_JOBS_ENABLED` to false. Code checks fail closed when the live-billing or MT5 flags are absent. New Stripe/PayPal checkouts and one-time PayPal order operations return 503 while billing is disabled. **This is not a global subscription-write switch:** provider-signed Stripe and PayPal webhooks remain enabled and can update entitlements/statuses for existing subscriptions. Stripe's authenticated success-return activation and PayPal's authenticated provider-lookup activation routes also remain available for a customer's already completed checkout. These paths are intentionally retained to keep existing subscriptions in sync; a verified delayed activation can still grant an entitlement while new checkout is off. MT5 history remains available, but inbound bridge sync returns 503 until explicitly enabled. The worker is not part of the web run command and still requires both its environment flag and `--confirm-live`.

The user explicitly confirmed on 15 October 2026 that provider-verified subscription updates should remain active while new checkout is disabled. Do not add a global webhook/entitlement pause unless the user changes this decision.

Email delivery remains disabled unless the explicit flag and both SMTP credentials are present. While it is off, registration, verification-email resend, and password-recovery requests return 503 before creating accounts or reset tokens. Existing verified users can still log in and use the app; authenticated password changes and consumption of a previously issued valid reset token remain available. These defaults are development-only until a separately approved publish.

The release build and focused local route tests cover authentication/verification, MT5 ownership and disabled sync, Stripe/PayPal entitlement paths, the disabled production gates, and retired AI endpoints. No production app startup or database connection was made for these checks.

### Current public route and hosting choice

Public DNS currently resolves the root to `34.111.179.208`; `www` is a CNAME to the root. The nameservers are `dns1.registrar-servers.com` and `dns2.registrar-servers.com`. The zone has existing verification and mail-related TXT records; preserve them unless their owners explicitly approve a change. A new public check on 15 October 2026 again found HTTP redirecting to HTTPS and the HTTPS connection closing before the server returned a certificate. The DNS address does not identify the application, cloud project, or owner. A Replit verification TXT record exists, but that does not establish an active Replit deployment.

**Recommended target: the already configured Replit Autoscale deployment**, after the owner confirms the destination and approves publication. The Express API serves a stateless web app and connects to external Neon; it does not need a continuously running worker. The old DNS target is not a safe recovery choice until its actual hosting service is identified and its TLS/application health can be confirmed. If the owner identifies and can access that service, compare it again before choosing; do not redirect traffic to it based only on the IP.

Current Replit documentation lists Autoscale charges of `$1/month` base, `$3.20 per million compute units`, `$1.20 per million requests`, and `$0.10/GiB` outbound transfer. Replit says monthly subscription credits are applied automatically and usage charges apply after those credits are exhausted. The account's current remaining credit balance is not available to this workspace, so coverage cannot be confirmed; the owner can check **Settings → Usage**. The minimum billable deployment floor is `$1/month` before credits and usage; actual cost cannot be estimated without expected traffic and the account's remaining credits. These charges exclude Neon usage, Namecheap domain renewal, payment-provider fees, and any legacy host costs.

### Production database URL verification without connecting

No production secret value was read and the existing `DATABASE_URL` mapping remains unverified. At a separately approved time, run a no-network fingerprint in the intended production environment: parse `DATABASE_URL` in memory, print only its hostname/endpoint identifier, port, database name, and role, and compare those fields with the previously verified Neon project `green-art-19890518`, branch `br-empty-wildflower-ahbsfyzr`, endpoint `ep-sparkling-moon-ahtc0gbu`, database `neondb`, and role `tradify_app`. Never print the URL, password, query parameters, or full connection string. Stop on any mismatch. Only a later separately approved database-backed smoke test may open a connection and wake Neon compute.

### Controlled restoration steps

**Development-only work already completed:** preserve the current Autoscale/build/run configuration; keep production feature flags false; test the built artifact and route gates on the isolated development database; do not connect to Neon or create a deployment.

**Requires separate owner approval:**

1. Confirm access to the Namecheap DNS zone and identify any Google Cloud, Vercel, or other hosting account that may own the old endpoint. Do not share credentials; the owner can confirm the account/service and inspect it directly.
2. Choose a Replit publishing geography before the first publish if the account permits it; Replit documents that geography cannot be changed after the first publish. No geography or account plan was inspected.
3. Approve the offline production `DATABASE_URL` fingerprint. Approve separately before any request that would connect to production Neon or wake its compute.
4. Approve publication to the generated Replit URL. Verify build health and production gates there before attaching `tradifyapp.com`.
5. In Replit Publishing → Domains, add the domain and use only the exact A/TXT values Replit supplies. Configure `www` as Replit directs. At Namecheap, first record existing records and TTL; only then, with separate DNS approval, replace conflicting website records. Preserve mail/verification TXT records and retain Replit's required TXT record for certificate renewals.
6. Wait for Replit's TLS certificate status to become valid before routing customers. Check root and `www` over HTTPS, login with an existing verified account, health/liveness, authentication, MT5-disabled response, and payment/email-disabled responses. A database-backed smoke test needs its own Neon-wake approval.
7. Enable billing, email, MT5 sync, or jobs only through separate approvals after the relevant production credentials, webhooks, SMTP sender, and test procedures are verified. Do not enable them as part of the first restoration.

**Rollback:** before any DNS change, save the exact old records and TTL. If a Replit build fails, use Replit's prior successful deployment for rollback. If the app works but domain routing or TLS fails, correct the Replit-provided DNS values; do not assume restoring the old records restores service, because the current endpoint fails TLS and its owner is unknown. Any DNS rollback still requires explicit approval.

### Namecheap DNS change sheet (prepared, not applied)

The current public baseline is root `A` → `34.111.179.208` and `www` `CNAME` → the root domain. The exact Replit replacement values do not exist until the domain is added to the Replit Publishing → Domains tool after publishing; do not substitute guessed IPs or CNAMEs.

After separate publish and DNS approval:

| Namecheap host | Current website record | Approved action after Replit provides values |
|---|---|---|
| `@` (apex) | `A` → `34.111.179.208` | Replace only this website `A` value with the exact Replit-provided apex `A` value. Do not use an apex CNAME. |
| `@` (apex) | Existing TXT records, including mail and verification records | Add the exact Replit-provided TXT verification value if requested. Preserve every existing TXT value; do not replace the TXT set. Keep Replit's required TXT record for certificate renewals. |
| `www` | `CNAME` → `tradifyapp.com` | Add `www` separately in Replit Domains, then change only the `www` record to the exact record/type/value Replit displays. |
| Mail and other subdomains | Existing MX, SPF/DKIM/DMARC, and unrelated records | Leave unchanged. |

No DNS record has been changed. Before any cutover, capture all current records and TTLs; verify Replit's TLS certificate is active before sending visitors to the new target.

### Information still needed

- The owner confirms Namecheap DNS access only. The service/account behind `34.111.179.208` remains unidentified; no hosting-console access has been confirmed.
- Identify whether the current endpoint belongs to a recoverable Google Cloud project, Vercel app, or other host; provide the service name/project identifier, not credentials.
- Choose the desired Replit geography (if available on the account) before first publication.
- Separately approve the offline database URL fingerprint, production compute wake for any actual DB smoke test, and eventually publication/DNS changes.
