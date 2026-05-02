/**
 * Database backup service for Tradify.
 *
 * Runs `pg_dump` against the production Neon database, gzip-compresses the
 * output, uploads it to Replit Object Storage, prunes old backups, and
 * records every run in the `database_backups` table.
 *
 * Scheduling: invoked daily by `server/index.ts` at ~03:30 UTC. Can also
 * be invoked manually via the admin panel ("Run Now") or the CLI:
 *
 *     npx tsx scripts/backup-db.ts
 *
 * Retention policy: last 30 daily backups + last 12 monthly backups (the
 * first successful backup of each calendar month is flagged `isMonthly`).
 *
 * Failure handling: any failure is recorded in `database_backups` and
 * triggers an email to ADMIN_EMAIL via emailService. Two consecutive
 * failures escalate the alert subject.
 */

import { spawn, execFileSync } from "node:child_process";
import { createGzip, gunzipSync } from "node:zlib";
import { PassThrough } from "node:stream";
import { readdirSync, existsSync } from "node:fs";
import { Client } from "@replit/object-storage";
import { db, pool } from "./db";
import { databaseBackups, type DatabaseBackup } from "@shared/schema";
import { and, desc, eq, isNotNull, lt, sql } from "drizzle-orm";
import { emailService } from "./emailService";

const BUCKET_PREFIX = "db-backups";
const DAILY_RETENTION = 30;
const MONTHLY_RETENTION = 12;

let inFlight: Promise<DatabaseBackup> | null = null;
let storageClient: Client | null = null;
let resolvedPgDump: string | null = null;

/**
 * Postgres advisory-lock keys. Cross-process / cross-instance mutex so
 * autoscaled or rolling-deploy environments cannot run two concurrent
 * backups (or two concurrent verifications). Picked as arbitrary
 * stable 32-bit ints so they don't collide with anything else in the DB.
 */
const ADVISORY_LOCK_BACKUP = 0x7261_6466; // "Tradf"
const ADVISORY_LOCK_VERIFY = 0x76657266; // "verf"

/**
 * Wraps `fn` in a `pg_try_advisory_lock(key)` so only one process at a
 * time can run it. Returns the wrapped result, or `null` when the lock
 * is held elsewhere (caller should treat as no-op).
 */
async function withAdvisoryLock<T>(key: number, fn: () => Promise<T>): Promise<T | null> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [key],
    );
    if (!rows[0]?.locked) return null;
    try {
      return await fn();
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [key]);
      } catch (e) {
        console.warn(`[backup] advisory unlock failed for key ${key}:`, e);
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Locates a pg_dump binary whose major version matches the live database.
 *
 * Resolution order (intentionally short and explicit so a Nix GC or
 * environment rebuild fails loudly instead of silently producing
 * unusable backups):
 *   1. `PG_DUMP_BIN` env var (explicit override)
 *   2. `pg_dump` on PATH (this is the canonical path; `.replit` pins
 *      `postgresql-17` so this should always exist and match Neon 17.x)
 *   3. **Last-resort fallback only**: walk `/nix/store` for a matching
 *      postgresql-N.x. Logs a loud warning if this path is taken
 *      because it means the env config has drifted.
 * Throws if nothing usable is found.
 */
async function resolvePgDump(): Promise<string> {
  if (resolvedPgDump) return resolvedPgDump;

  const { rows } = await pool.query<{ server_version: string }>("SHOW server_version");
  const serverVersion = rows[0]?.server_version ?? "";
  const serverMajor = parseInt(serverVersion.split(".")[0] ?? "0", 10);
  if (!serverMajor) throw new Error(`Unable to detect server version (got "${serverVersion}")`);

  const tryCandidate = (bin: string): { major: number; raw: string } | null => {
    try {
      const out = execFileSync(bin, ["--version"], { stdio: ["ignore", "pipe", "ignore"] }).toString();
      // "pg_dump (PostgreSQL) 17.6"
      const m = /\(PostgreSQL\)\s+(\d+)/.exec(out);
      return { major: m ? parseInt(m[1], 10) : 0, raw: out.trim() };
    } catch {
      return null;
    }
  };

  // 1. Explicit override.
  if (process.env.PG_DUMP_BIN) {
    const r = tryCandidate(process.env.PG_DUMP_BIN);
    if (r && r.major === serverMajor) {
      resolvedPgDump = process.env.PG_DUMP_BIN;
      console.log(`[backup] Using pg_dump ${r.raw} (PG_DUMP_BIN) for server ${serverVersion}`);
      return resolvedPgDump;
    }
    console.warn(
      `[backup] PG_DUMP_BIN=${process.env.PG_DUMP_BIN} is unusable or wrong major (got ${r?.major ?? "?"} vs server ${serverMajor}). Falling back.`,
    );
  }

  // 2. PATH (canonical).
  const onPath = tryCandidate("pg_dump");
  if (onPath && onPath.major === serverMajor) {
    resolvedPgDump = "pg_dump";
    console.log(`[backup] Using pg_dump ${onPath.raw} (PATH) for server ${serverVersion}`);
    return resolvedPgDump;
  }
  if (onPath) {
    console.warn(
      `[backup] pg_dump on PATH is ${onPath.major}.x but server is ${serverMajor}.x. ` +
        `Update .replit modules to postgresql-${serverMajor}. Falling back to /nix/store scan.`,
    );
  }

  // 3. Last-resort: walk /nix/store. Loud warning because this means env drift.
  console.warn(
    `[backup] Last-resort /nix/store scan engaged. Pin pg_dump via .replit (postgresql-${serverMajor}) or PG_DUMP_BIN to remove this fragility.`,
  );
  try {
    const entries = readdirSync("/nix/store");
    const matches: { path: string; minor: number }[] = [];
    const re = new RegExp(`^[a-z0-9]+-postgresql-${serverMajor}\\.(\\d+)`);
    for (const e of entries) {
      const m = re.exec(e);
      if (!m) continue;
      const candidate = `/nix/store/${e}/bin/pg_dump`;
      if (existsSync(candidate)) {
        matches.push({ path: candidate, minor: parseInt(m[1], 10) });
      }
    }
    matches.sort((a, b) => b.minor - a.minor);
    for (const m of matches) {
      const r = tryCandidate(m.path);
      if (r && r.major === serverMajor) {
        resolvedPgDump = m.path;
        console.warn(`[backup] Using pg_dump ${r.raw} (/nix/store fallback) for server ${serverVersion}`);
        return resolvedPgDump;
      }
    }
  } catch (err) {
    console.warn("[backup] /nix/store scan failed:", err);
  }

  throw new Error(
    `No pg_dump binary matching server major version ${serverMajor} found. ` +
      `Update .replit modules to postgresql-${serverMajor}, or set PG_DUMP_BIN to a pg_dump ${serverMajor}.x binary.`,
  );
}

/**
 * Verifies that a usable pg_dump binary is reachable. Called once at
 * startup so the backup scheduler doesn't arm against a broken env.
 * Returns the resolved path on success; throws on failure.
 */
export async function ensurePgDumpAvailable(): Promise<string> {
  return resolvePgDump();
}

function getStorageClient(): Client {
  if (!storageClient) {
    storageClient = new Client();
  }
  return storageClient;
}

function cleanConnectionString(url: string | undefined): string | undefined {
  if (!url) return undefined;
  let cleaned = url.trim();
  if (cleaned.startsWith("psql ")) {
    cleaned = cleaned.replace(/^psql\s+['"]?/, "").replace(/['"]$/, "");
  }
  return cleaned;
}

function getBackupConnectionString(): string {
  const url =
    cleanConnectionString(process.env.NEON_DATABASE_URL) ||
    cleanConnectionString(process.env.DATABASE_URL);
  if (!url) {
    throw new Error(
      "No database URL configured (set NEON_DATABASE_URL or DATABASE_URL)",
    );
  }
  return url;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function buildStorageKey(now: Date): string {
  const ts = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}_${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${pad(now.getUTCSeconds())}`;
  return `${BUCKET_PREFIX}/${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/tradify-${ts}.sql.gz`;
}

/**
 * Streams `pg_dump` output through gzip into an in-memory buffer.
 * For Tradify's current data volume this is fine; if backups exceed
 * a few hundred MB this should be migrated to a streaming upload.
 */
async function dumpAndCompress(connectionString: string): Promise<Buffer> {
  const pgDumpBin = await resolvePgDump();
  return new Promise((resolve, reject) => {
    const args = [
      "--no-owner",
      "--no-privileges",
      "--no-comments",
      "--clean",
      "--if-exists",
      connectionString,
    ];

    const dump = spawn(pgDumpBin, args, {
      env: { ...process.env, PGCONNECT_TIMEOUT: "30" },
    });

    const chunks: Buffer[] = [];
    let stderrBuf = "";
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      try {
        dump.kill("SIGKILL");
      } catch {}
      reject(err);
    };

    const gzip = createGzip({ level: 6 });
    const pass = new PassThrough();

    dump.stdout.pipe(gzip).pipe(pass);

    pass.on("data", (c: Buffer) => chunks.push(c));
    pass.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    pass.on("error", fail);
    gzip.on("error", fail);
    dump.stdout.on("error", fail);

    dump.stderr.on("data", (c) => {
      stderrBuf += c.toString();
    });

    dump.on("error", (err) => fail(new Error(`pg_dump spawn error: ${err.message}`)));
    dump.on("close", (code) => {
      if (code !== 0) {
        fail(
          new Error(
            `pg_dump exited with code ${code}: ${stderrBuf.slice(-2000) || "(no stderr)"}`,
          ),
        );
      }
    });
  });
}

async function uploadToStorage(key: string, body: Buffer): Promise<void> {
  const client = getStorageClient();
  const result = await client.uploadFromBytes(key, body);
  if (!result.ok) {
    throw new Error(`Object storage upload failed: ${result.error?.message ?? "unknown error"}`);
  }
}

async function deleteFromStorage(key: string): Promise<void> {
  const client = getStorageClient();
  try {
    const result = await client.delete(key);
    if (!result.ok) {
      console.warn(`[backup] Failed to delete ${key}: ${result.error?.message}`);
    }
  } catch (err) {
    console.warn(`[backup] Delete error for ${key}:`, err);
  }
}

/**
 * Determines if this run should be flagged as the monthly snapshot.
 * Returns true when no successful backup yet exists in the current UTC month.
 */
async function isFirstBackupOfMonth(now: Date): Promise<boolean> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(databaseBackups)
    .where(
      and(
        eq(databaseBackups.status, "success"),
        sql`${databaseBackups.runAt} >= ${monthStart}`,
      ),
    );
  return (row?.count ?? 0) === 0;
}

/**
 * Enforces retention: keep last N daily successful backups, plus last M
 * monthly successful backups. Anything older is deleted from object
 * storage and the row is removed from the database_backups table.
 */
async function pruneOldBackups(): Promise<void> {
  const dailyRows = await db
    .select()
    .from(databaseBackups)
    .where(and(eq(databaseBackups.status, "success"), eq(databaseBackups.isMonthly, false)))
    .orderBy(desc(databaseBackups.runAt));
  const expiredDaily = dailyRows.slice(DAILY_RETENTION);

  const monthlyRows = await db
    .select()
    .from(databaseBackups)
    .where(and(eq(databaseBackups.status, "success"), eq(databaseBackups.isMonthly, true)))
    .orderBy(desc(databaseBackups.runAt));
  const expiredMonthly = monthlyRows.slice(MONTHLY_RETENTION);

  const expired = [...expiredDaily, ...expiredMonthly];
  for (const row of expired) {
    if (row.storageKey) {
      await deleteFromStorage(row.storageKey);
    }
    await db.delete(databaseBackups).where(eq(databaseBackups.id, row.id));
    console.log(`[backup] Pruned ${row.storageKey ?? `id=${row.id}`}`);
  }

  // Also clean up old failure rows so the table doesn't bloat (keep last 50).
  const failureRows = await db
    .select({ id: databaseBackups.id })
    .from(databaseBackups)
    .where(eq(databaseBackups.status, "failure"))
    .orderBy(desc(databaseBackups.runAt));
  const expiredFailures = failureRows.slice(50);
  if (expiredFailures.length > 0) {
    const oldestKept = failureRows[49];
    if (oldestKept) {
      await db
        .delete(databaseBackups)
        .where(
          and(
            eq(databaseBackups.status, "failure"),
            lt(databaseBackups.id, oldestKept.id),
          ),
        );
    }
  }
}

async function countConsecutiveFailures(): Promise<number> {
  const recent = await db
    .select({ status: databaseBackups.status })
    .from(databaseBackups)
    .orderBy(desc(databaseBackups.runAt))
    .limit(10);
  let n = 0;
  for (const r of recent) {
    if (r.status === "failure") n += 1;
    else break;
  }
  return n;
}

export interface RunBackupOptions {
  trigger?: "scheduled" | "manual";
}

export async function runBackup(opts: RunBackupOptions = {}): Promise<DatabaseBackup> {
  if (inFlight) {
    console.log("[backup] Already running, returning in-flight promise");
    return inFlight;
  }
  inFlight = (async () => {
    const trigger = opts.trigger ?? "scheduled";
    const startedAt = Date.now();
    const now = new Date();
    const storageKey = buildStorageKey(now);
    console.log(`[backup] Starting ${trigger} backup -> ${storageKey}`);

    // Cross-instance mutex — if another instance/replica is already
    // mid-backup, exit cleanly without writing a duplicate row.
    const lockOwner = await pool.connect();
    let haveLock = false;
    try {
      const { rows } = await lockOwner.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [ADVISORY_LOCK_BACKUP],
      );
      haveLock = !!rows[0]?.locked;
    } finally {
      if (!haveLock) lockOwner.release();
    }
    if (!haveLock) {
      console.log("[backup] Another instance holds the backup lock — skipping this run.");
      // Return a synthetic skipped row so callers always get a value;
      // do not insert into databaseBackups.
      return {
        id: -1,
        runAt: now,
        status: "success",
        storageKey: null,
        sizeBytes: null,
        durationMs: 0,
        isMonthly: false,
        trigger,
        errorMessage: null,
        restoreVerifiedAt: null,
        restoreVerifiedStatus: null,
        restoreVerifiedMessage: null,
      } as DatabaseBackup;
    }

    try {
      const url = getBackupConnectionString();
      const compressed = await dumpAndCompress(url);
      await uploadToStorage(storageKey, compressed);

      const isMonthly = await isFirstBackupOfMonth(now);
      const durationMs = Date.now() - startedAt;
      const [row] = await db
        .insert(databaseBackups)
        .values({
          status: "success",
          storageKey,
          sizeBytes: compressed.length,
          durationMs,
          isMonthly,
          trigger,
          errorMessage: null,
        })
        .returning();

      console.log(
        `[backup] Success: ${storageKey} (${(compressed.length / 1024 / 1024).toFixed(2)} MB, ${durationMs}ms, monthly=${isMonthly})`,
      );

      try {
        await pruneOldBackups();
      } catch (pruneErr) {
        console.error("[backup] Retention prune failed:", pruneErr);
      }

      return row;
    } catch (err: any) {
      const durationMs = Date.now() - startedAt;
      const message = err?.message || String(err);
      console.error(`[backup] FAILED after ${durationMs}ms:`, message);

      const [row] = await db
        .insert(databaseBackups)
        .values({
          status: "failure",
          storageKey: null,
          sizeBytes: null,
          durationMs,
          isMonthly: false,
          trigger,
          errorMessage: message.slice(0, 4000),
        })
        .returning();

      try {
        const consecutive = await countConsecutiveFailures();
        await emailService.sendBackupFailureAlertEmail({
          errorMessage: message,
          attemptedAt: now,
          trigger,
          consecutiveFailures: consecutive,
          storageKey,
        });
      } catch (alertErr) {
        console.error("[backup] Failure alert email also failed:", alertErr);
      }

      return row;
    } finally {
      try {
        await lockOwner.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_BACKUP]);
      } catch (e) {
        console.warn("[backup] advisory unlock failed:", e);
      }
      lockOwner.release();
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function getLatestBackup(): Promise<DatabaseBackup | undefined> {
  const [row] = await db
    .select()
    .from(databaseBackups)
    .orderBy(desc(databaseBackups.runAt))
    .limit(1);
  return row;
}

export async function getRecentBackups(limit = 30): Promise<DatabaseBackup[]> {
  return db
    .select()
    .from(databaseBackups)
    .orderBy(desc(databaseBackups.runAt))
    .limit(limit);
}

export async function getBackupStatus(): Promise<{
  latest: DatabaseBackup | null;
  latestSuccess: DatabaseBackup | null;
  latestFailure: DatabaseBackup | null;
  consecutiveFailures: number;
  totalSuccessfulBackups: number;
  retention: { daily: number; monthly: number };
  recent: DatabaseBackup[];
}> {
  const [latest] = await db
    .select()
    .from(databaseBackups)
    .orderBy(desc(databaseBackups.runAt))
    .limit(1);

  const [latestSuccess] = await db
    .select()
    .from(databaseBackups)
    .where(eq(databaseBackups.status, "success"))
    .orderBy(desc(databaseBackups.runAt))
    .limit(1);

  const [latestFailure] = await db
    .select()
    .from(databaseBackups)
    .where(eq(databaseBackups.status, "failure"))
    .orderBy(desc(databaseBackups.runAt))
    .limit(1);

  const [counts] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(databaseBackups)
    .where(eq(databaseBackups.status, "success"));

  const recent = await getRecentBackups(10);
  const consecutiveFailures = await countConsecutiveFailures();

  return {
    latest: latest ?? null,
    latestSuccess: latestSuccess ?? null,
    latestFailure: latestFailure ?? null,
    consecutiveFailures,
    totalSuccessfulBackups: counts?.count ?? 0,
    retention: { daily: DAILY_RETENTION, monthly: MONTHLY_RETENTION },
    recent,
  };
}

// ==================== RESTORE VERIFICATION (#41) ====================

/**
 * Tables we expect to find in every backup. If any are missing, the
 * dump is structurally broken and we should not trust it for restore.
 * Picked because they are core to the product surface; any of these
 * being absent indicates either a partial dump or schema rot.
 *
 * Names are matched against `CREATE TABLE public.<name>` produced by
 * pg_dump. Update this list whenever a new core table is introduced
 * (or an old one is renamed).
 */
const REQUIRED_TABLES = [
  "session",
  "trade_journal",
  "strategies",
  "alert_preferences",
  "mt5_accounts",
  "database_backups",
  "leads",
];

const MIN_BACKUP_BYTES_GZ = 4 * 1024; // <4KB gz means almost certainly truncated

export interface VerifyResult {
  backupId: number | null;
  status: "success" | "failure" | "skipped";
  message: string;
  storageKey: string | null;
}

/**
 * Downloads the latest successful backup, gunzips it, and validates
 * structural integrity:
 *   - object-storage download succeeds
 *   - gunzip succeeds (catches CRC corruption)
 *   - SQL header looks like a pg_dump output
 *   - all REQUIRED_TABLES appear in CREATE TABLE statements
 *   - dump is not suspiciously small
 *
 * Result is persisted onto the source backup row's
 * restore_verified_* columns. On failure, fires the verification
 * alert email through the same email service path as backup failures.
 */
export async function verifyLatestBackup(): Promise<VerifyResult> {
  // Cross-instance mutex so two replicas don't both verify (and both
  // potentially fire failure emails) at the same time.
  const locked = await withAdvisoryLock(ADVISORY_LOCK_VERIFY, () => verifyLatestBackupLocked());
  if (locked === null) {
    const message = "Another instance is already running verification — skipped.";
    console.log(`[backup-verify] ${message}`);
    return { backupId: null, status: "skipped", message, storageKey: null };
  }
  return locked;
}

async function verifyLatestBackupLocked(): Promise<VerifyResult> {
  const [latest] = await db
    .select()
    .from(databaseBackups)
    .where(and(eq(databaseBackups.status, "success"), isNotNull(databaseBackups.storageKey)))
    .orderBy(desc(databaseBackups.runAt))
    .limit(1);

  if (!latest || !latest.storageKey) {
    const message = "No successful backup with a storage key available to verify.";
    console.warn(`[backup-verify] ${message}`);
    return { backupId: null, status: "skipped", message, storageKey: null };
  }

  const startedAt = Date.now();
  console.log(`[backup-verify] Verifying backup #${latest.id} (${latest.storageKey})`);

  let status: "success" | "failure" = "success";
  let message = "";

  try {
    const client = getStorageClient();
    const dl = await client.downloadAsBytes(latest.storageKey);
    if (!dl.ok || !dl.value || !dl.value[0]) {
      throw new Error(`download failed: ${dl.error?.message ?? "no payload"}`);
    }
    const compressed = dl.value[0] as Buffer;

    if (compressed.length < MIN_BACKUP_BYTES_GZ) {
      throw new Error(
        `backup is suspiciously small (${compressed.length} bytes gz) — likely truncated`,
      );
    }

    let plain: Buffer;
    try {
      plain = gunzipSync(compressed);
    } catch (err: any) {
      throw new Error(`gunzip failed: ${err?.message || err}`);
    }

    const sql = plain.toString("utf8");

    if (!/PostgreSQL database dump/i.test(sql) && !/pg_dump version/i.test(sql)) {
      throw new Error("dump does not look like pg_dump output (missing header)");
    }

    const missing: string[] = [];
    for (const t of REQUIRED_TABLES) {
      const re = new RegExp(`CREATE TABLE\\s+(?:public\\.)?["\`]?${t}["\`]?\\b`, "i");
      if (!re.test(sql)) missing.push(t);
    }
    if (missing.length > 0) {
      throw new Error(`missing CREATE TABLE for: ${missing.join(", ")}`);
    }

    // pg_dump trailers — both indicate a clean finish.
    if (!/PostgreSQL database dump complete/i.test(sql)) {
      throw new Error('dump appears truncated (no "PostgreSQL database dump complete" trailer)');
    }

    const sizeMb = (compressed.length / 1024 / 1024).toFixed(2);
    const elapsed = Date.now() - startedAt;
    message = `verified ${sizeMb} MB gz / ${(plain.length / 1024 / 1024).toFixed(2)} MB sql in ${elapsed} ms · ${REQUIRED_TABLES.length} required tables present`;
    console.log(`[backup-verify] OK · backup #${latest.id} · ${message}`);
  } catch (err: any) {
    status = "failure";
    message = err?.message || String(err);
    console.error(`[backup-verify] FAILED · backup #${latest.id} · ${message}`);
  }

  await db
    .update(databaseBackups)
    .set({
      restoreVerifiedAt: new Date(),
      restoreVerifiedStatus: status,
      restoreVerifiedMessage: message.slice(0, 4000),
    })
    .where(eq(databaseBackups.id, latest.id));

  if (status === "failure") {
    try {
      await emailService.sendBackupVerificationFailureAlertEmail({
        errorMessage: message,
        attemptedAt: new Date(),
        backupRunAt: latest.runAt,
        storageKey: latest.storageKey,
      });
    } catch (alertErr) {
      console.error("[backup-verify] Verification alert email failed:", alertErr);
    }
  }

  return { backupId: latest.id, status, message, storageKey: latest.storageKey };
}

// ==================== SCHEDULERS ====================

/**
 * Daily scheduler. Computes ms until next 03:30 UTC then runs once,
 * after which it self-schedules every 24 hours. Idempotent — safe to
 * call multiple times (the inFlight guard inside runBackup prevents
 * concurrent runs).
 */
const TARGET_HOUR_UTC = 3;
const TARGET_MINUTE_UTC = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Verification runs Sunday 04:30 UTC (an hour after the daily backup). */
const VERIFY_HOUR_UTC = 4;
const VERIFY_MINUTE_UTC = 30;
const VERIFY_DOW_UTC = 0; // Sunday

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      TARGET_HOUR_UTC,
      TARGET_MINUTE_UTC,
      0,
      0,
    ),
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

let schedulerStarted = false;

export async function startBackupScheduler() {
  if (schedulerStarted) return;

  // Refuse to arm if the env can't even resolve a compatible pg_dump.
  // We'd rather fail loud at boot than discover this silently at 03:30.
  try {
    await ensurePgDumpAvailable();
  } catch (err: any) {
    console.error(
      `[backup] Refusing to arm scheduler — pg_dump unavailable: ${err?.message || err}`,
    );
    return;
  }

  schedulerStarted = true;
  const wait = msUntilNextRun();
  const nextRun = new Date(Date.now() + wait);
  console.log(
    `[backup] Scheduler armed. Next backup at ${nextRun.toISOString()} (in ${(wait / 1000 / 60).toFixed(1)} min)`,
  );
  setTimeout(() => {
    void runBackup({ trigger: "scheduled" });
    setInterval(() => {
      void runBackup({ trigger: "scheduled" });
    }, DAY_MS);
  }, wait);
}

function msUntilNextVerificationRun(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      VERIFY_HOUR_UTC,
      VERIFY_MINUTE_UTC,
      0,
      0,
    ),
  );
  // Roll forward to the next Sunday at 04:30 UTC.
  const dayDelta = (VERIFY_DOW_UTC - next.getUTCDay() + 7) % 7;
  next.setUTCDate(next.getUTCDate() + dayDelta);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 7);
  }
  return next.getTime() - now.getTime();
}

let verificationSchedulerStarted = false;

/**
 * Weekly verifier. Picks the latest successful backup and re-validates
 * it end-to-end (download → gunzip → structural check). Schedules the
 * next run 7 days later. Idempotent.
 */
export function startBackupVerificationScheduler() {
  if (verificationSchedulerStarted) return;
  verificationSchedulerStarted = true;
  const wait = msUntilNextVerificationRun();
  const nextRun = new Date(Date.now() + wait);
  console.log(
    `[backup-verify] Scheduler armed. Next verification at ${nextRun.toISOString()} (in ${(wait / 1000 / 60 / 60).toFixed(1)} h)`,
  );
  setTimeout(() => {
    void verifyLatestBackup().catch((e) =>
      console.error("[backup-verify] Scheduled verify error:", e),
    );
    setInterval(() => {
      void verifyLatestBackup().catch((e) =>
        console.error("[backup-verify] Scheduled verify error:", e),
      );
    }, WEEK_MS);
  }, wait);
}
