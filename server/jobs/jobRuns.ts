import type { Pool } from "pg";

export interface JobRunClaim {
  id: string;
  attempts: number;
}

export interface JobRunOutcome {
  status: "succeeded" | "failed";
  result?: unknown;
  error?: string;
}

export interface JobRunResult {
  claimed: boolean;
  status: "succeeded" | "failed" | "uncertain" | "duplicate" | "blocked";
  attempts?: number;
  error?: string;
}

const DEFAULT_LEASE_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000];

export async function markExpiredJobRunsUncertain(pool: Pool): Promise<number> {
  const result = await pool.query(
    `UPDATE background_job_runs
     SET status = 'uncertain',
         finished_at = NOW(),
         updated_at = NOW(),
         error_message = COALESCE(
           error_message,
           'Worker lease expired; inspect side effects before manually retrying.'
         )
     WHERE status = 'running' AND lease_expires_at <= NOW()`,
  );
  return result.rowCount ?? 0;
}

export async function claimBackgroundJob(
  pool: Pool,
  jobName: string,
  runKey: string,
  options: { leaseMs?: number; maxAttempts?: number } = {},
): Promise<JobRunClaim | null> {
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!jobName || !runKey || !Number.isInteger(leaseMs) || leaseMs < 1000) {
    throw new Error("A job name, run key, and lease of at least one second are required.");
  }

  const result = await pool.query(
    `INSERT INTO background_job_runs
       (job_name, run_key, status, attempts, started_at, lease_expires_at)
     VALUES ($1, $2, 'running', 1, NOW(), NOW() + ($3::bigint * INTERVAL '1 millisecond'))
     ON CONFLICT (job_name, run_key) DO UPDATE
       SET status = 'running',
           attempts = background_job_runs.attempts + 1,
           started_at = NOW(),
           lease_expires_at = NOW() + ($3::bigint * INTERVAL '1 millisecond'),
           finished_at = NULL,
           next_retry_at = NULL,
           duration_ms = NULL,
           result = NULL,
           error_message = NULL,
           updated_at = NOW()
       WHERE background_job_runs.status = 'failed'
         AND background_job_runs.attempts < $4
         AND (background_job_runs.next_retry_at IS NULL OR background_job_runs.next_retry_at <= NOW())
     RETURNING id::text AS id, attempts`,
    [jobName, runKey, leaseMs, maxAttempts],
  );
  return result.rows[0] ?? null;
}

export async function finishBackgroundJob(
  pool: Pool,
  claim: JobRunClaim,
  startedAt: number,
  outcome: JobRunOutcome,
): Promise<void> {
  const error = outcome.error?.slice(0, 4000) ?? null;
  const resultJson =
    outcome.status === "succeeded" && outcome.result !== undefined
      ? JSON.stringify(outcome.result)
      : null;
  const retryDelay = outcome.status === "failed"
    ? RETRY_DELAYS_MS[claim.attempts - 1] ?? null
    : null;

  await pool.query(
    `UPDATE background_job_runs
     SET status = $2,
         finished_at = NOW(),
         lease_expires_at = NOW(),
         next_retry_at = CASE
           WHEN $2 = 'failed' AND $3::bigint IS NOT NULL AND attempts < $4
             THEN NOW() + ($3::bigint * INTERVAL '1 millisecond')
           ELSE NULL
         END,
         duration_ms = $5,
         result = $6::jsonb,
         error_message = $7,
         updated_at = NOW()
     WHERE id = $1`,
    [
      claim.id,
      outcome.status,
      retryDelay,
      DEFAULT_MAX_ATTEMPTS,
      Math.max(0, Date.now() - startedAt),
      resultJson,
      error,
    ],
  );
}

export async function runClaimedJob(
  pool: Pool,
  jobName: string,
  runKey: string,
  run: () => Promise<unknown>,
): Promise<JobRunResult> {
  const claim = await claimBackgroundJob(pool, jobName, runKey);
  if (!claim) return { claimed: false, status: "duplicate" };

  const startedAt = Date.now();
  try {
    const result = await run();
    await finishBackgroundJob(pool, claim, startedAt, { status: "succeeded", result });
    return { claimed: true, status: "succeeded", attempts: claim.attempts };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishBackgroundJob(pool, claim, startedAt, { status: "failed", error: message });
    return { claimed: true, status: "failed", attempts: claim.attempts, error: message };
  }
}
