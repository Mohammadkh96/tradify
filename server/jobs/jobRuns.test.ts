import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { claimBackgroundJob, finishBackgroundJob, markExpiredJobRunsUncertain } from "./jobRuns";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error("TEST_DATABASE_URL must target an isolated local test database.");
}
const parsedUrl = new URL(connectionString);
if (!["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname) || parsedUrl.pathname === "/neondb") {
  throw new Error("Job-run tests are restricted to a local database, never Neon or the shared development database.");
}

const pool = new Pool({ connectionString });

beforeAll(async () => {
  const migration = await readFile("migrations/0001_background_jobs_and_email_outbox.sql", "utf8");
  await pool.query(migration);
});

beforeEach(async () => {
  await pool.query("DELETE FROM background_job_runs WHERE job_name LIKE 'test:%'");
});

afterAll(async () => {
  await pool.end();
});

describe("background job run claims", () => {
  it("allows one claim per job slot and records success", async () => {
    const first = await claimBackgroundJob(pool, "test:dedupe", "slot-a");
    const duplicate = await claimBackgroundJob(pool, "test:dedupe", "slot-a");
    expect(first).not.toBeNull();
    expect(duplicate).toBeNull();

    await finishBackgroundJob(pool, first!, Date.now(), {
      status: "succeeded",
      result: { done: true },
    });
    const afterSuccess = await claimBackgroundJob(pool, "test:dedupe", "slot-a");
    expect(afterSuccess).toBeNull();
  });

  it("retries a failed run only after its backoff expires and within the attempt limit", async () => {
    const first = await claimBackgroundJob(pool, "test:retry", "slot-b", { maxAttempts: 3 });
    expect(first?.attempts).toBe(1);
    await finishBackgroundJob(pool, first!, Date.now(), {
      status: "failed",
      error: "temporary failure",
    });

    const beforeBackoff = await claimBackgroundJob(pool, "test:retry", "slot-b", { maxAttempts: 3 });
    expect(beforeBackoff).toBeNull();

    await pool.query(
      "UPDATE background_job_runs SET next_retry_at = NOW() - INTERVAL '1 second' WHERE job_name = $1 AND run_key = $2",
      ["test:retry", "slot-b"],
    );
    const retry = await claimBackgroundJob(pool, "test:retry", "slot-b", { maxAttempts: 3 });
    expect(retry?.attempts).toBe(2);
  });

  it("marks an expired worker lease uncertain instead of replaying it", async () => {
    const claim = await claimBackgroundJob(pool, "test:lease", "slot-c", { leaseMs: 1000 });
    expect(claim).not.toBeNull();
    await pool.query(
      "UPDATE background_job_runs SET lease_expires_at = NOW() - INTERVAL '1 second' WHERE id = $1",
      [claim!.id],
    );
    expect(await markExpiredJobRunsUncertain(pool)).toBe(1);
    expect(await claimBackgroundJob(pool, "test:lease", "slot-c")).toBeNull();
  });
});
