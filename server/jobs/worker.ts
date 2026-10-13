import type { Pool } from "pg";
import {
  markExpiredJobRunsUncertain,
  runClaimedJob,
  type JobRunResult,
} from "./jobRuns";

type JobDefinition = {
  name: string;
  requiresEmail: boolean;
  isDue: (now: Date) => boolean;
  runKey: (now: Date) => string;
  run: () => Promise<unknown>;
};

function quarterHourKey(now: Date): string {
  const slot = new Date(now);
  slot.setUTCMinutes(Math.floor(slot.getUTCMinutes() / 15) * 15, 0, 0);
  return slot.toISOString();
}

function halfHourKey(now: Date): string {
  const slot = new Date(now);
  slot.setUTCMinutes(Math.floor(slot.getUTCMinutes() / 30) * 30, 0, 0);
  return slot.toISOString();
}

function sixHourKey(now: Date): string {
  const slot = new Date(now);
  slot.setUTCHours(Math.floor(slot.getUTCHours() / 6) * 6, 0, 0, 0);
  return slot.toISOString();
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isoWeekKey(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function assertLiveExecutionAllowed(args: string[]): void {
  if (process.env.NODE_ENV === "production") {
    if (process.env.BACKGROUND_JOBS_ENABLED !== "true" || !args.includes("--confirm-live")) {
      throw new Error(
        "Production jobs are disabled. Set BACKGROUND_JOBS_ENABLED=true and pass --confirm-live only after approval.",
      );
    }
  }
}

function emailCutover(): Date {
  if (process.env.EMAIL_DELIVERY_ENABLED !== "true") {
    throw new Error("Email jobs are disabled; EMAIL_DELIVERY_ENABLED must be true.");
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) {
    throw new Error("Email jobs require verified SMTP_USER and SMTP_APP_PASSWORD settings.");
  }
  const value = process.env.EMAIL_JOBS_NOT_BEFORE;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error("Email jobs require EMAIL_JOBS_NOT_BEFORE to prevent replaying pre-cutover sequences.");
  }
  return date;
}

export async function createJobDefinitions(): Promise<JobDefinition[]> {
  const [
    { emailService },
    { runDailyDigestSweep },
    { runWeeklyDigestSweep },
    { runBackup, verifyLatestBackup },
  ] = await Promise.all([
    import("../emailService"),
    import("../dailyDigest"),
    import("../weeklyDigest"),
    import("../backup-service"),
  ]);

  return [
    {
      name: "email-outbox",
      requiresEmail: true,
      isDue: () => true,
      runKey: quarterHourKey,
      run: async () => {
        emailCutover();
        return emailService.processPendingEmailOutbox();
      },
    },
    {
      name: "drip-sequences",
      requiresEmail: true,
      isDue: (now) => now.getUTCMinutes() % 30 === 0,
      runKey: halfHourKey,
      run: async () => emailService.processDripSequences({ notBefore: emailCutover() }),
    },
    {
      name: "at-risk-scan",
      requiresEmail: false,
      isDue: (now) => now.getUTCMinutes() === 0 && now.getUTCHours() % 6 === 0,
      runKey: sixHourKey,
      run: () => emailService.scanForAtRiskUsers(),
    },
    {
      name: "daily-risk-digest",
      requiresEmail: true,
      isDue: () => true,
      runKey: quarterHourKey,
      run: async () => runDailyDigestSweep({ notBefore: emailCutover() }),
    },
    {
      name: "weekly-performance-digest",
      requiresEmail: true,
      isDue: (now) => now.getUTCMinutes() % 30 === 0,
      runKey: halfHourKey,
      run: async () => runWeeklyDigestSweep({ notBefore: emailCutover() }),
    },
    {
      name: "daily-backup",
      requiresEmail: false,
      isDue: (now) => now.getUTCHours() === 3 && now.getUTCMinutes() >= 30 && now.getUTCMinutes() < 45,
      runKey: dayKey,
      run: () => runBackup({ trigger: "scheduled" }),
    },
    {
      name: "weekly-backup-structural-check",
      requiresEmail: false,
      isDue: (now) =>
        now.getUTCDay() === 0 &&
        now.getUTCHours() === 4 &&
        now.getUTCMinutes() >= 30 &&
        now.getUTCMinutes() < 45,
      runKey: isoWeekKey,
      run: () => verifyLatestBackup(),
    },
  ];
}

export async function dispatchScheduledJobs(
  pool: Pool,
  now = new Date(),
): Promise<{ results: Array<{ name: string } & JobRunResult>; failed: number; uncertain: number; blocked: number }> {
  const expired = await markExpiredJobRunsUncertain(pool);
  if (expired > 0) {
    console.error(`[jobs] Marked ${expired} expired run lease(s) uncertain; they will not be replayed automatically.`);
  }

  const definitions = await createJobDefinitions();
  const results: Array<{ name: string } & JobRunResult> = [];
  for (const job of definitions) {
    if (!job.isDue(now)) continue;
    if (job.requiresEmail) {
      try {
        emailCutover();
      } catch (error) {
        results.push({
          name: job.name,
          claimed: false,
          status: "blocked",
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }
    const result = await runClaimedJob(pool, job.name, job.runKey(now), job.run);
    results.push({ name: job.name, ...result });
  }
  return {
    results,
    failed: results.filter((result) => result.status === "failed").length,
    uncertain: results.filter((result) => result.status === "uncertain").length,
    blocked: results.filter((result) => result.status === "blocked").length,
  };
}

export async function runManualJob(
  pool: Pool,
  jobName: string,
  now = new Date(),
): Promise<JobRunResult> {
  const definitions = await createJobDefinitions();
  if (jobName === "backfill-email-sequences") {
    if (process.env.EMAIL_BACKFILL_ENABLED !== "true") {
      throw new Error("The historical email backfill is manual-only and requires EMAIL_BACKFILL_ENABLED=true.");
    }
    const { emailService } = await import("../emailService");
    return runClaimedJob(pool, jobName, "manual:backfill", () => emailService.backfillEmailSequences());
  }
  const job = definitions.find((candidate) => candidate.name === jobName);
  if (!job) throw new Error(`Unknown background job: ${jobName}`);
  if (job.requiresEmail) emailCutover();
  return runClaimedJob(pool, job.name, `manual:${job.name}`, job.run);
}
