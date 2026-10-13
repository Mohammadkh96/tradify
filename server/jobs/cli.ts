import { pool } from "../db";
import { dispatchScheduledJobs, runManualJob } from "./worker";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, jobName] = args;
  if (process.env.NODE_ENV === "production") {
    if (process.env.BACKGROUND_JOBS_ENABLED !== "true" || !args.includes("--confirm-live")) {
      throw new Error(
        "Refusing production job execution without BACKGROUND_JOBS_ENABLED=true and --confirm-live.",
      );
    }
  }

  if (command === "dispatch") {
    const result = await dispatchScheduledJobs(pool);
    console.log(JSON.stringify(result));
    if (result.failed > 0 || result.uncertain > 0 || result.blocked > 0) process.exitCode = 1;
    return;
  }
  if (command === "run" && jobName) {
    const result = await runManualJob(pool, jobName);
    console.log(JSON.stringify({ name: jobName, ...result }));
    if (result.status === "failed" || result.status === "uncertain") process.exitCode = 1;
    return;
  }
  throw new Error("Usage: node dist/worker.cjs dispatch|run <job-name> [--confirm-live]");
}

main()
  .catch((error) => {
    console.error("[jobs] Worker stopped:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
