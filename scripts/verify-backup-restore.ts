import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { Pool } from "pg";

const REQUIRED_TABLES = [
  "session",
  "trade_journal",
  "strategies",
  "alert_preferences",
  "mt5_accounts",
  "database_backups",
  "leads",
] as const;

function getRestoreTarget(): { connectionString: string; databaseName: string } {
  const connectionString = process.env.RESTORE_TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set RESTORE_TEST_DATABASE_URL to an empty, disposable local restore_verify_* database.");
  }

  const url = new URL(connectionString);
  const hostIsLoopback = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  const port = Number(url.port);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!hostIsLoopback || port < 55000 || port > 55999 || !databaseName.startsWith("restore_verify_")) {
    throw new Error(
      "Restore verification is restricted to loopback PostgreSQL on port 55000-55999 and a restore_verify_* database name.",
    );
  }
  return { connectionString, databaseName };
}

async function restoreDump(archivePath: string, connectionString: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "psql",
      ["--no-psqlrc", "--set=ON_ERROR_STOP=1", "--dbname", connectionString],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(message));
    };

    child.stderr.on("data", () => {
      // Do not echo restore errors: SQL diagnostics can contain customer data.
    });
    child.on("error", () => fail("Could not start psql for isolated restore verification."));
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) resolve();
      else reject(new Error(`psql restore failed with exit code ${code}; SQL output was suppressed.`));
    });

    const source = createReadStream(archivePath);
    const gunzip = createGunzip();
    source.on("error", () => fail("Could not read the compressed backup file."));
    gunzip.on("error", () => fail("Backup is not a valid gzip stream."));
    source.pipe(gunzip).pipe(child.stdin);
  });
}

async function main() {
  const archivePath = process.argv[2];
  if (!archivePath) {
    throw new Error("Usage: npm run verify:backup-restore -- /path/to/backup.sql.gz");
  }
  const { connectionString, databaseName } = getRestoreTarget();
  const pool = new Pool({ connectionString, max: 1 });
  let restoreStarted = false;

  try {
    const target = await pool.query<{ current_database: string; current_user: string }>(
      "SELECT current_database(), current_user",
    );
    if (target.rows[0]?.current_database !== databaseName) {
      throw new Error("Connected database name does not match the restore target URL.");
    }
    const existing = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    `);
    if (Number(existing.rows[0]?.count ?? 0) !== 0) {
      throw new Error("Restore target is not empty; refusing to apply the dump.");
    }

    restoreStarted = true;
    await restoreDump(archivePath, connectionString);
    const presence = await pool.query<{ table_name: string; exists: boolean }>(
      `SELECT name AS table_name, to_regclass('public.' || name) IS NOT NULL AS exists
       FROM unnest($1::text[]) AS t(name)`,
      [REQUIRED_TABLES],
    );
    const missing = presence.rows.filter((row) => !row.exists).map((row) => row.table_name);
    if (missing.length) {
      throw new Error(`Restore completed but required tables are missing: ${missing.join(", ")}`);
    }

    const counts: Record<string, number> = {};
    for (const table of REQUIRED_TABLES) {
      const result = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM public."${table}"`);
      counts[table] = Number(result.rows[0]?.count ?? 0);
    }
    console.log(`Restore verification passed for ${databaseName}. Required-table row counts:`, counts);
  } finally {
    if (restoreStarted) {
      await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public").catch(() => {
        console.error("Automatic cleanup failed. The isolated restore database may still contain copied data.");
      });
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Restore verification failed.");
  process.exitCode = 1;
});
