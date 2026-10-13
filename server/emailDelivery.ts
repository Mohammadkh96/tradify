import type { Pool } from "pg";
import { createHash } from "node:crypto";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

export interface EmailTransport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    html: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId?: string }>;
}

export interface DeliveryResult {
  status: "sent" | "retry" | "failed" | "uncertain" | "queued";
  attempt: number;
  error?: string;
}

const MAX_ATTEMPTS = 3;
const LEASE_MS = 10 * 60 * 1000;
const RETRY_DELAYS_MS = [5 * 60 * 1000, 15 * 60 * 1000];

export function emailIdempotencyKey(scope: string, stableValue: string): string {
  const digest = createHash("sha256").update(stableValue).digest("hex");
  return `${scope}:${digest}`;
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 4000);
}

function responseCode(error: any): number | null {
  const code = Number(error?.responseCode ?? error?.statusCode);
  return Number.isInteger(code) ? code : null;
}

function classifyFailure(error: any, attempt: number): {
  status: "retry" | "failed" | "uncertain";
  delayMs?: number;
} {
  const smtpCode = responseCode(error);
  if (smtpCode !== null && smtpCode >= 400 && smtpCode < 500) {
    return attempt < MAX_ATTEMPTS
      ? { status: "retry", delayMs: RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1) }
      : { status: "failed" };
  }
  if (
    smtpCode !== null ||
    error?.code === "EAUTH" ||
    error?.code === "EENVELOPE"
  ) {
    return { status: "failed" };
  }
  // A socket timeout/disconnect may happen after the SMTP server accepted
  // DATA. Do not retry automatically when acceptance is ambiguous.
  return { status: "uncertain" };
}

async function logAttempt(
  pool: Pool,
  row: { recipient: string; subject: string; idempotency_key: string },
  success: boolean,
  error?: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO sent_emails (recipient, subject, template_name, success, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        row.recipient,
        row.subject,
        `outbox:${row.idempotency_key}`.slice(0, 255),
        success,
        error ?? null,
      ],
    );
  } catch (logError) {
    // The outbox row remains the primary durable record if the legacy
    // sent_emails audit table is unavailable.
    console.error("[EMAIL-OUTBOX] Could not append legacy delivery log:", errorText(logError));
  }
}

async function sendClaimedRow(
  pool: Pool,
  transport: EmailTransport,
  from: string,
  row: {
    id: string;
    idempotency_key: string;
    recipient: string;
    subject: string;
    html: string | null;
    headers: Record<string, string> | null;
    attempt_count: number;
  },
): Promise<DeliveryResult> {
  try {
    if (row.html === null) {
      throw new Error("Outbox message body is missing.");
    }
    const response = await transport.sendMail({
      from,
      to: row.recipient,
      subject: row.subject,
      html: row.html,
      headers: row.headers ?? undefined,
    });
    await pool.query(
      `UPDATE email_delivery_outbox
       SET status = 'sent', sent_at = NOW(), updated_at = NOW(),
           lease_expires_at = NULL, provider_message_id = $2, last_error = NULL,
           html = NULL, headers = '{}'::jsonb
       WHERE id = $1 AND status = 'sending'`,
      [row.id, response.messageId ?? null],
    );
    await logAttempt(pool, row, true);
    return { status: "sent", attempt: row.attempt_count };
  } catch (error) {
    const message = errorText(error);
    const disposition = classifyFailure(error, row.attempt_count);
    await pool.query(
      `UPDATE email_delivery_outbox
       SET status = $2,
           next_attempt_at = CASE WHEN $2 = 'retry'
             THEN NOW() + ($3::bigint * INTERVAL '1 millisecond')
             ELSE next_attempt_at END,
           lease_expires_at = NULL, updated_at = NOW(), last_error = $4
       WHERE id = $1 AND status = 'sending'`,
      [row.id, disposition.status, disposition.delayMs ?? 0, message],
    );
    await logAttempt(pool, row, false, message);
    if (disposition.status === "failed") {
      console.error(`[EMAIL-OUTBOX] Delivery exhausted/permanent failure for ${row.idempotency_key}: ${message}`);
    } else if (disposition.status === "uncertain") {
      console.error(`[EMAIL-OUTBOX] Delivery outcome uncertain for ${row.idempotency_key}; automatic resend suppressed: ${message}`);
    }
    return { status: disposition.status, attempt: row.attempt_count, error: message };
  }
}

async function claimOne(
  pool: Pool,
  idempotencyKey: string,
): Promise<{
  id: string;
  idempotency_key: string;
  recipient: string;
  subject: string;
  html: string | null;
  headers: Record<string, string> | null;
  attempt_count: number;
  status: DeliveryResult["status"];
} | null> {
  const result = await pool.query(
    `UPDATE email_delivery_outbox
     SET status = 'sending', attempt_count = attempt_count + 1,
         lease_expires_at = NOW() + ($2::bigint * INTERVAL '1 millisecond'),
         updated_at = NOW()
     WHERE idempotency_key = $1
       AND status IN ('queued', 'retry')
       AND next_attempt_at <= NOW()
       AND attempt_count < $3
     RETURNING id, idempotency_key, recipient, subject, html, headers, attempt_count, status`,
    [idempotencyKey, LEASE_MS, MAX_ATTEMPTS],
  );
  return result.rows[0] ?? null;
}

export async function enqueueAndSendEmail(
  pool: Pool,
  transport: EmailTransport,
  from: string,
  message: EmailMessage,
  idempotencyKey: string,
): Promise<DeliveryResult> {
  await pool.query(
    `INSERT INTO email_delivery_outbox
       (idempotency_key, recipient, subject, html, headers, status, next_attempt_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'queued', NOW())
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      idempotencyKey,
      message.to,
      message.subject,
      message.html,
      JSON.stringify(message.headers ?? {}),
    ],
  );

  const existing = await pool.query(
    `SELECT idempotency_key, recipient, subject, status, attempt_count
     FROM email_delivery_outbox WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  const prior = existing.rows[0];
  if (!prior) throw new Error("Email outbox insert could not be read back.");
  if (prior.recipient !== message.to || prior.subject !== message.subject) {
    throw new Error("Email idempotency key was reused for a different message.");
  }
  if (prior.status === "sent") return { status: "sent", attempt: prior.attempt_count };
  if (prior.status === "failed" || prior.status === "uncertain") {
    return { status: prior.status, attempt: prior.attempt_count };
  }

  const claimed = await claimOne(pool, idempotencyKey);
  if (!claimed) {
    return {
      status: prior.status === "sending" ? "uncertain" : prior.status,
      attempt: prior.attempt_count,
    };
  }
  return sendClaimedRow(pool, transport, from, claimed);
}

export async function processEmailOutbox(
  pool: Pool,
  transport: EmailTransport,
  from: string,
  limit = 10,
): Promise<{ claimed: number; sent: number; retry: number; failed: number; uncertain: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Outbox batch limit must be between 1 and 100.");
  }

  const stale = await pool.query(
    `UPDATE email_delivery_outbox
     SET status = 'uncertain', lease_expires_at = NULL, updated_at = NOW(),
         last_error = COALESCE(last_error, 'Worker lease expired during send; inspect provider before retrying.')
     WHERE status = 'sending' AND lease_expires_at <= NOW()
     RETURNING id`,
  );
  if (stale.rowCount) {
    console.error(`[EMAIL-OUTBOX] ${stale.rowCount} expired send lease(s) require manual review; no automatic resend.`);
  }

  const claimed = await pool.query(
    `WITH candidates AS (
       SELECT id
       FROM email_delivery_outbox
       WHERE status IN ('queued', 'retry')
         AND next_attempt_at <= NOW()
         AND attempt_count < $1
       ORDER BY next_attempt_at, id
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     UPDATE email_delivery_outbox AS outbox
     SET status = 'sending', attempt_count = outbox.attempt_count + 1,
         lease_expires_at = NOW() + ($3::bigint * INTERVAL '1 millisecond'),
         updated_at = NOW()
     FROM candidates
     WHERE outbox.id = candidates.id
     RETURNING outbox.id, outbox.idempotency_key, outbox.recipient, outbox.subject,
               outbox.html, outbox.headers, outbox.attempt_count, outbox.status`,
    [MAX_ATTEMPTS, limit, LEASE_MS],
  );

  const result = { claimed: claimed.rows.length, sent: 0, retry: 0, failed: 0, uncertain: 0 };
  // Deliberately serial. Gmail SMTP has already returned 454 throttling
  // failures; concurrency bursts would make that worse.
  for (const row of claimed.rows) {
    const delivery = await sendClaimedRow(pool, transport, from, row);
    if (delivery.status in result) {
      (result as any)[delivery.status]++;
    }
  }
  return result;
}
