import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import {
  emailIdempotencyKey,
  enqueueAndSendEmail,
  processEmailOutbox,
  type EmailTransport,
} from "./emailDelivery";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error("TEST_DATABASE_URL must target an isolated local test database.");
}
const parsedUrl = new URL(connectionString);
if (!["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname) || parsedUrl.pathname === "/neondb") {
  throw new Error("Email delivery tests are restricted to a local database, never Neon or the shared development database.");
}

const pool = new Pool({ connectionString });

beforeAll(async () => {
  const migration = await readFile("migrations/0001_background_jobs_and_email_outbox.sql", "utf8");
  await pool.query(migration);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sent_emails (
      id BIGSERIAL PRIMARY KEY,
      recipient TEXT,
      subject TEXT NOT NULL,
      template_name TEXT,
      success BOOLEAN DEFAULT true,
      error_message TEXT,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
});

beforeEach(async () => {
  await pool.query("DELETE FROM email_delivery_outbox WHERE idempotency_key LIKE 'test:%'");
  await pool.query("DELETE FROM sent_emails WHERE template_name LIKE 'outbox:test:%'");
});

afterAll(async () => {
  await pool.end();
});

const message = {
  to: "test-recipient@example.invalid",
  subject: "Isolated delivery test",
  html: "<p>Test only</p>",
};

describe("durable email delivery", () => {
  it("sends an idempotent message only once, including after a retry", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "test-message-1" });
    const transport: EmailTransport = { sendMail };
    const key = emailIdempotencyKey("test", "duplicate-once");

    const first = await enqueueAndSendEmail(pool, transport, "Tradify Test <test@example.invalid>", message, key);
    const duplicate = await enqueueAndSendEmail(pool, transport, "Tradify Test <test@example.invalid>", message, key);

    expect(first.status).toBe("sent");
    expect(duplicate.status).toBe("sent");
    expect(sendMail).toHaveBeenCalledTimes(1);

    const stored = await pool.query(
      "SELECT status, attempt_count, html FROM email_delivery_outbox WHERE idempotency_key = $1",
      [key],
    );
    expect(stored.rows[0]).toMatchObject({ status: "sent", attempt_count: 1, html: null });
  });

  it("backs off transient SMTP throttling and retries only when due", async () => {
    const throttled = Object.assign(new Error("SMTP 454 rate limit"), { responseCode: 454 });
    const firstTransport: EmailTransport = { sendMail: vi.fn().mockRejectedValue(throttled) };
    const retryTransport: EmailTransport = { sendMail: vi.fn().mockResolvedValue({ messageId: "test-message-2" }) };
    const key = emailIdempotencyKey("test", "retry-454");

    const first = await enqueueAndSendEmail(pool, firstTransport, "Tradify Test <test@example.invalid>", message, key);
    expect(first.status).toBe("retry");
    expect(firstTransport.sendMail).toHaveBeenCalledTimes(1);

    const beforeDue = await processEmailOutbox(pool, retryTransport, "Tradify Test <test@example.invalid>");
    expect(beforeDue.claimed).toBe(0);

    await pool.query(
      "UPDATE email_delivery_outbox SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE idempotency_key = $1",
      [key],
    );
    const due = await processEmailOutbox(pool, retryTransport, "Tradify Test <test@example.invalid>");
    expect(due).toMatchObject({ claimed: 1, sent: 1, retry: 0, failed: 0, uncertain: 0 });
    expect(retryTransport.sendMail).toHaveBeenCalledTimes(1);
  });

  it("does not auto-retry an ambiguous socket failure", async () => {
    const timeout = Object.assign(new Error("socket timeout"), { code: "ETIMEDOUT" });
    const sendMail = vi.fn().mockRejectedValue(timeout);
    const key = emailIdempotencyKey("test", "ambiguous-timeout");

    const first = await enqueueAndSendEmail(
      pool,
      { sendMail },
      "Tradify Test <test@example.invalid>",
      message,
      key,
    );
    const later = await processEmailOutbox(
      pool,
      { sendMail: vi.fn().mockResolvedValue({ messageId: "should-not-send" }) },
      "Tradify Test <test@example.invalid>",
    );

    expect(first.status).toBe("uncertain");
    expect(later.claimed).toBe(0);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
