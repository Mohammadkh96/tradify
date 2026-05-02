# Tradify Database Backup & Restore

This document describes how Tradify protects production data and how to
restore from a backup if disaster strikes.

> **Out of scope.** Point-in-time recovery (PITR), per-user data exports, and
> any UI that downloads or restores backups are **not** part of this safety
> net. Restores are intentionally a manual server-side operation.

## What runs automatically

- **Schedule.** A daily job runs at **03:30 UTC** from inside the main
  Express server (`server/backup-service.ts` → `startBackupScheduler()`).
  The scheduler is armed once on boot in `server/index.ts`.
- **What it does.**
  1. `pg_dump` against `NEON_DATABASE_URL` (falls back to `DATABASE_URL`)
     with `--no-owner --no-privileges --no-comments --clean --if-exists`.
  2. Streams the output through `gzip` (level 6).
  3. Uploads the compressed dump to Replit Object Storage at
     `db-backups/YYYY/MM/tradify-YYYY-MM-DD_HH-MM-SS.sql.gz`.
  4. Records the run in the `database_backups` table (status, size,
     duration, trigger, monthly flag, error).
  5. Prunes anything outside the retention window (see below).
- **Retention.**
  - Last **30 daily** successful backups.
  - Last **12 monthly** successful backups (the first successful backup
    of each calendar month is flagged `is_monthly=true` and exempt
    from daily expiry).
  - Failure rows are capped at the most recent 50.
- **Failure alerts.** Any failure sends an email to `ADMIN_EMAIL`. Two or
  more **consecutive** failures escalate the subject line to
  `[ESCALATION] N consecutive Tradify backup failures`.

## Observability

- Admin → **Database Backups** (`/admin/backups`) shows last run,
  status, size, duration, latest error message, and the most recent
  10 attempts. There is **no** download or restore UI by design.
- The same data is available via `GET /api/admin/backups/status`
  (admin-only).

## Manual operations

### Run an extra backup right now

From the admin UI: **Database Backups → "Run Now"**.

From a server shell:

```bash
npx tsx scripts/backup-db.ts
```

The CLI is idempotent: if the daily scheduler is already running a
backup, the second invocation joins the in-flight promise.

### Inspect the dumps in object storage

The bucket configured in `.replit` (`[objectStorage] defaultBucketID`)
holds all dumps under the prefix `db-backups/`. Use the Replit Object
Storage UI to download a specific `.sql.gz` file when you need to
restore.

## Restoring a backup

> **Caution.** Restoring overwrites the target database. Always restore
> into a **fresh** database first, verify the data, and only then cut
> over production traffic.

1. **Download the dump** from object storage to a server shell:

   ```bash
   # Path is what you see in the admin Backups table -> "Storage Key" column
   npx tsx -e 'import("@replit/object-storage").then(async m => { \
     const c = new m.Client(); \
     const r = await c.downloadAsBytes("db-backups/2026/05/tradify-2026-05-02_03-30-00.sql.gz"); \
     if (!r.ok) throw r.error; \
     require("fs").writeFileSync("/tmp/restore.sql.gz", r.value[0]); \
     console.log("downloaded", r.value[0].length, "bytes"); \
   })'
   ```

2. **Decompress** the dump:

   ```bash
   gunzip -k /tmp/restore.sql.gz   # produces /tmp/restore.sql
   ```

3. **Provision a target database.** Create a fresh empty Neon database
   (or a local Postgres) and capture its connection string as
   `RESTORE_TARGET_URL`.

4. **Apply the dump.** Because it was taken with `--clean --if-exists`,
   it will drop and recreate every object before inserting data:

   ```bash
   psql "$RESTORE_TARGET_URL" -v ON_ERROR_STOP=1 -f /tmp/restore.sql
   ```

5. **Smoke-test the restore.** At minimum:

   ```sql
   SELECT COUNT(*) FROM user_role;
   SELECT COUNT(*) FROM trade_journal;
   SELECT MAX(run_at) FROM database_backups;
   ```

   Compare the row counts and most recent timestamps against the
   broken production database (or against your last known good
   admin-overview snapshot).

6. **Cut over.** Once verified, point the production deployment's
   `NEON_DATABASE_URL` / `DATABASE_URL` at the restored instance and
   restart the workflow.

## Known limitations & next steps

- **Single region.** Object storage is regional. For true geo-redundancy,
  add a secondary off-platform copy (S3 / R2) — out of scope here.
- **No PITR.** This is a daily snapshot system. Up to ~24 hours of data
  loss is possible. Neon's own PITR (where available) covers shorter
  windows.
- **No automated restore drills.** Schedule a manual restore drill at
  least quarterly to confirm dumps are usable.
- **In-memory buffering.** `runBackup()` currently buffers the
  compressed dump before uploading. If dumps grow past a few hundred
  MB, switch to a streaming upload (`uploadFromStream`) to avoid
  memory pressure.
