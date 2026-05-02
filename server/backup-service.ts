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
import { createGzip } from "node:zlib";
import { PassThrough } from "node:stream";
import { readdirSync, existsSync } from "node:fs";
import { Client } from "@replit/object-storage";
import { db, pool } from "./db";
import { databaseBackups, type DatabaseBackup } from "@shared/schema";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { emailService } from "./emailService";

const BUCKET_PREFIX = "db-backups";
const DAILY_RETENTION = 30;
const MONTHLY_RETENTION = 12;

let inFlight: Promise<DatabaseBackup> | null = null;
let storageClient: Client | null = null;
let resolvedPgDump: string | null = null;

/**
 * Locates a pg_dump binary whose major version matches the live database.
 * Resolution order:
 *   1. PG_DUMP_BIN env var (explicit override)
 *   2. The pg_dump on PATH if its major version matches the server
 *   3. Highest matching `pg_dump` found under /nix/store/*postgresql-N*
 * Throws if nothing usable is found.
 */
async function resolvePgDump(): Promise<string> {
  if (resolvedPgDump) return resolvedPgDump;

  const { rows } = await pool.query<{ server_version: string }>("SHOW server_version");
  const serverVersion = rows[0]?.server_version ?? "";
  const serverMajor = parseInt(serverVersion.split(".")[0] ?? "0", 10);
  if (!serverMajor) throw new Error(`Unable to detect server version (got "${serverVersion}")`);

  const candidates: string[] = [];
  if (process.env.PG_DUMP_BIN) candidates.push(process.env.PG_DUMP_BIN);
  candidates.push("pg_dump");

  // Walk /nix/store for postgresql-N.x bin/pg_dump entries and prefer the
  // newest minor matching the server major.
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
    for (const m of matches) candidates.push(m.path);
  } catch (err) {
    console.warn("[backup] /nix/store scan failed:", err);
  }

  for (const bin of candidates) {
    try {
      const out = execFileSync(bin, ["--version"], { stdio: ["ignore", "pipe", "ignore"] }).toString();
      // "pg_dump (PostgreSQL) 17.6"
      const m = /\(PostgreSQL\)\s+(\d+)/.exec(out);
      const major = m ? parseInt(m[1], 10) : 0;
      if (major === serverMajor) {
        resolvedPgDump = bin;
        console.log(`[backup] Using pg_dump ${out.trim()} for server ${serverVersion}`);
        return bin;
      }
    } catch {
      // try the next candidate
    }
  }

  throw new Error(
    `No pg_dump binary matching server major version ${serverMajor} found. ` +
      `Set PG_DUMP_BIN to a pg_dump ${serverMajor}.x binary.`,
  );
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

/**
 * Daily scheduler. Computes ms until next 03:30 UTC then runs once,
 * after which it self-schedules every 24 hours. Idempotent — safe to
 * call multiple times (the inFlight guard inside runBackup prevents
 * concurrent runs).
 */
const TARGET_HOUR_UTC = 3;
const TARGET_MINUTE_UTC = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

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

export function startBackupScheduler() {
  if (schedulerStarted) return;
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
