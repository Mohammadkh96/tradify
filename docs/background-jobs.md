# Background jobs: inventory, safety, and activation plan

**Status (13 October 2026): prepared but not activated.** No production migration was applied, no production job was run, no email was resent, no deployment was published, and no DNS or production customer data was changed. The API workflow remains stopped because the development database connection resolves to the production Neon database; an isolated `DEV_DATABASE_URL` is not configured.

## Architecture

- Keep the current API/webhook app on its existing Autoscale deployment. It no longer starts business schedulers, backup timers, admin bootstrapping, or schema backfills when the web process starts.
- Run scheduled work from a **separate Replit project** using a Scheduled deployment. Replit does not let one project use Autoscale and Scheduled deployment types at the same time. Do not change this project's deployment type.
- Invoke `npm run jobs -- dispatch --confirm-live` from that separate project on a 15-minute cadence. The command also requires `BACKGROUND_JOBS_ENABLED=true`. It does not run unless both safeguards are deliberately set.
- An always-on worker is not currently justified. MT5 data is pushed to the API by the user's EA/client, and the API processes risk events synchronously. There is no server-side MT5 polling loop.
- `background_job_runs` provides a unique job/slot claim, lease, retry count, and completion/error record. A stale run is marked `uncertain` rather than automatically replayed when it may have performed an external side effect.
- `email_delivery_outbox` stores email content and an idempotency key before SMTP delivery. Explicit transient SMTP throttles receive at most three attempts with 5- and 15-minute delays. Permanent errors stop. Ambiguous socket failures and expired in-flight sends are marked `uncertain` and require manual review: SMTP cannot guarantee exactly-once delivery after a lost response.
- The migration `migrations/0001_background_jobs_and_email_outbox.sql` is **not applied**. Review and apply it only to an isolated development database first. Do not use `db:push` or grant DDL to the runtime `tradify_app` role.

## Job inventory

| Work | Trigger / frequency | Runtime and dependencies | Writes / retry safety |
| --- | --- | --- | --- |
| Email outbox delivery | Every 15 minutes | Short, serial SMTP batches; PostgreSQL and configured SMTP credentials | Claims rows with `SKIP LOCKED`; stable idempotency keys; bounded retries; ambiguous sends are held for review. |
| Drip-sequence delivery | Every 30 minutes | Short/variable; PostgreSQL + SMTP | Processes only sequences created at or after `EMAIL_JOBS_NOT_BEFORE`. A sequence step advances only after delivery succeeds. Stable sequence/step key prevents duplicates. |
| At-risk user scan | Every 6 hours | DB scan; no model call and no direct email | Adds/updates at-risk sequence records; job-slot claim prevents duplicate scan for a time bucket. |
| Daily risk digest | Every 15 minutes; per-user local day/time rules | DB aggregation + SMTP | Stable digest key; only includes notifications newer than both the rolling 24-hour window and cutover time. |
| Weekly performance digest | Every 30 minutes; sends only for the user's local weekly window | DB aggregation + SMTP | Stable digest key and notification marker. Unsent markers can be retried without creating another email. |
| Daily database backup | 03:30 UTC | Potentially the longest task; matching-version `pg_dump`, gzip, Replit Object Storage, production Neon connection | Creates a backup record/object and prunes retained backups. Runs only in the separate, approved worker. |
| Weekly backup structure check | Sunday 04:30 UTC | Downloads and gunzips the latest backup; Object Storage + PostgreSQL metadata | Updates verification status. **This checks the SQL file structure, not a real PostgreSQL restore.** |
| Historical email-sequence backfill | Manual only; never in regular dispatch | DB-only operation until delivery is separately enabled | Requires `EMAIL_BACKFILL_ENABLED=true`; must be reviewed because it can create new sequences for existing users. |

### Event-driven work that stays in the API

- **MT5 sync:** initiated by the MT5 EA/client's HTTP push. Server-side frequency depends on that client; there is no periodic server poll. Trade history is keyed by `(user_id, mt5_account_id, ticket)` and duplicate tickets are ignored or updated. A trade omitted from a client batch is not recovered until a later push includes it.
- **Risk calculations and alerts:** deterministic, event-driven processing on trade/sync changes. Existing notification dedupe/cooldown logic remains. Periodic digests are separate jobs.
- **Stripe and PayPal:** webhook/API handlers remain in the web process. Subscription status changes are event-driven; no periodic reconciliation job was found. Email side effects now use provider-event idempotency keys. Stripe rejects unsigned events; PayPal now fails closed in production if its webhook verification is not configured.
- **API housekeeping:** the in-memory rate-limit cleanup timer and per-connection SSE heartbeat are process-local housekeeping, not business jobs. Backup retention pruning runs only as part of the backup task.

## Email and historical failures

- The current sender is Gmail SMTP through Nodemailer. Earlier logs showed SMTP `454` throttling; a dedicated transactional sender is preferable before enabling recurring mail.
- The production environment did not have `SMTP_USER`, `SMTP_APP_PASSWORD`, or `EMAIL_DELIVERY_ENABLED` configured at inspection. Email sending is disabled by default unless `EMAIL_DELIVERY_ENABLED=true` and both SMTP credentials are present.
- Read-only production checks found 603 successful rows and 0 durable failed rows in `sent_emails`, 93 open email sequences, and 0 sequences due at that check. The previously observed 104 SMTP failures were process/log-only and were not durably recorded with enough information to replay safely. **They will not be resent automatically.**
- Existing open sequences are excluded until their creation time is on or after the approved `EMAIL_JOBS_NOT_BEFORE` cutover timestamp. Any desired reactivation should be reviewed and queued intentionally after cutover, not bulk-replayed.

## Backups and restore verification

- `server/backup-service.ts` selects `NEON_DATABASE_URL` only in production, `DEV_DATABASE_URL` in development, and `TEST_DATABASE_URL` in tests; it has no `DATABASE_URL` fallback.
- `.replit` is pinned to PostgreSQL 17 so `pg_dump` can match the observed Neon server major version. The backup service checks the version and refuses to run if no matching binary is available.
- Existing backup retention is 30 daily plus 12 monthly backups. The most recent backup/verification records observed during restoration work were old (backup: 2 May 2026; structural check: 7 June 2026). Treat backup freshness and recoverability as unverified until a new backup and a real restore test are approved.
- `verifyLatestBackup()` only validates gzip/SQL headers, required table declarations, trailer, and minimum size. It does **not** restore SQL into PostgreSQL.
- A guarded restore smoke-test command is prepared: `npm run verify:backup-restore -- /local/path/backup.sql.gz`. It requires `RESTORE_TEST_DATABASE_URL` to target an empty database named `restore_verify_*` on loopback port 55000–55999, verifies required tables and aggregate row counts, suppresses SQL error output, and clears the copied schema when finished. It does not download production backups itself. Do not run it with a production URL or a production backup unless the user explicitly approves the data copy.

## AI-credit usage

- No background AI task was found. AI inference routes are retired with HTTP 410, and the server's remaining OpenAI object is a stub that throws before making a provider request.
- The OpenAI Node package was removed from the dependency tree and the OpenAI Replit integration was removed from `.replit`. Deterministic risk calculations, trading statistics, and other non-AI analytics remain.
- Some old AI-oriented admin screens may still be visible but their API calls cannot reach a model. No OpenAI key or secret was read or changed.

## Replit cost estimate

Replit's published Scheduled deployment rate is approximately **$0.60 per million compute units**, plus the Scheduled deployment base fee shown in the billing UI (the pricing page currently shows $2/month). Example only: one 30-second, 1-vCPU/1-GiB run every 15 minutes is about 1.728 million compute units/month, or roughly **$1.04 variable compute + $2 base = $3.04/month**. Billing UI pricing is authoritative and can change.

An always-on Reserved VM is unnecessary for the current push-based MT5/API design. For comparison, the published 0.5-vCPU/2-GiB rate is about $15.18/month and 1-vCPU/4-GiB about $35.48/month at 730 hours. These estimates exclude Neon compute/storage, Replit Object Storage, email-provider charges, and network transfer.

Sources: [Replit Scheduled Deployments](https://docs.replit.com/cloud-services/deployments/scheduled-deployments) and [Replit pricing](https://replit.com/pricing).

## Environment variables and approval gates

| Variable / setting | Purpose | Current status |
| --- | --- | --- |
| `DEV_DATABASE_URL` | Isolated development database only | Missing. Do not substitute the shared `DATABASE_URL`; it resolves to production. |
| `TEST_DATABASE_URL` | Isolated tests | Not configured as a secret; tests were prepared to use loopback PostgreSQL only. |
| `NEON_DATABASE_URL` | Production DB connection for the separately approved worker | Present, but never used by this workflow. |
| `BACKGROUND_JOBS_ENABLED=true` | Required job-worker safety switch | Not enabled. |
| `--confirm-live` | Explicit CLI confirmation for a production worker invocation | Not used. |
| `EMAIL_DELIVERY_ENABLED=true`, `SMTP_USER`, `SMTP_APP_PASSWORD` | Email send gate and SMTP credentials | Missing; no mail can be enabled safely. |
| `EMAIL_JOBS_NOT_BEFORE` | ISO timestamp preventing legacy sequences from being replayed | Must be set and reviewed at cutover. |
| `EMAIL_BACKFILL_ENABLED=true` | Allows one-time, manual historical sequence backfill | Not enabled. |
| `STRIPE_WEBHOOK_SECRET` | Stripe event signature verification | Missing at inspection; configure before live webhook processing. |
| `PAYPAL_WEBHOOK_ID`, `PAYPAL_CLIENT_SECRET` | PayPal webhook verification/API access | Missing at inspection; configure before live PayPal processing. |
| `APP_URL`, Object Storage integration | Unsubscribe links and backup upload/download | Use the production app URL and existing Object Storage connection in the separate worker. |

## Verification and GO / NO-GO

**NO-GO for production activation** until all of these are complete:

1. Provide a truly isolated development Neon branch/database as `DEV_DATABASE_URL`; the app workflow stays stopped until then.
2. Apply the reviewed migration to the isolated database and run `npm run test:jobs`. No migration has been applied to production.
3. Set up an appropriate transactional email sender and test it with a disposable address; decide the cutover timestamp and review the 93 legacy open sequences. Do not replay the 104 undocumented failures.
4. Configure and verify Stripe/PayPal webhook secrets.
5. Create a new backup, then perform a real restore into a disposable local PostgreSQL database and confirm application-level checks before relying on it.
6. Confirm the separate Scheduled deployment's environment and Object Storage access, review the first run, and keep the API deployment type unchanged.

If a worker must be stopped after activation, disable or delete only the separate Scheduled deployment and set its job/email flags off. Do not drop job/outbox history tables as a rollback; retain them for audit. API/webhooks remain independent.
