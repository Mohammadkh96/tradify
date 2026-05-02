/**
 * Manual / ad-hoc database backup CLI.
 *
 * Usage:
 *   npx tsx scripts/backup-db.ts
 *
 * This is the same code path the daily scheduler uses. It will:
 *   1. Run pg_dump against NEON_DATABASE_URL or DATABASE_URL
 *   2. Gzip-compress the output
 *   3. Upload to Replit Object Storage under db-backups/YYYY/MM/
 *   4. Record the run in the `database_backups` table
 *   5. Prune backups outside the retention window
 *      (last 30 daily + last 12 monthly)
 *   6. Email ADMIN_EMAIL on failure
 *
 * Exits with code 0 on success, 1 on failure.
 */
import { runBackup } from "../server/backup-service";

(async () => {
  try {
    const result = await runBackup({ trigger: "manual" });
    if (result.status === "success") {
      console.log(
        `Backup OK: ${result.storageKey} (${result.sizeBytes} bytes, ${result.durationMs}ms)`,
      );
      process.exit(0);
    } else {
      console.error(`Backup FAILED: ${result.errorMessage}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Backup invocation crashed:", err);
    process.exit(1);
  }
})();
