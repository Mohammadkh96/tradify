import { pool } from "@workspace/db";
import { decryptAuthToken } from "./localAuth";
import { authEmailDeliveryConfigured, deliverAuthEmail, type AuthEmailKind } from "./emailDelivery";
import { logger } from "./logger";

const OUTBOX_INTERVAL_MS = 5_000;
let workerStarted = false;

export async function processAuthEmailOutboxOnce(): Promise<boolean> {
  if (!authEmailDeliveryConfigured()) return false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT * FROM tradigo_auth_email_outbox
       WHERE sent_at IS NULL AND next_attempt_at <= NOW()
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
    );
    const row = result.rows[0] as Record<string, any> | undefined;
    if (!row) {
      await client.query("COMMIT");
      return false;
    }
    const token = decryptAuthToken(String(row.encrypted_token));
    if (!token) {
      await client.query(
        `UPDATE tradigo_auth_email_outbox
         SET attempt_count=attempt_count+1, last_error='TOKEN_DECRYPTION_FAILED',
             next_attempt_at=NOW() + interval '1 hour'
         WHERE id=$1`,
        [row.id],
      );
      await client.query("COMMIT");
      return true;
    }
    const pendingTokenResult = await client.query(
      "SELECT expires_at, consumed_at FROM tradigo_auth_tokens WHERE id=$1 FOR UPDATE",
      [row.token_id],
    );
    const pendingToken = pendingTokenResult.rows[0] as Record<string, any> | undefined;
    if (!pendingToken || pendingToken.consumed_at || new Date(pendingToken.expires_at).getTime() <= Date.now()) {
      await client.query(
        "UPDATE tradigo_auth_email_outbox SET sent_at=NOW(), last_error='TOKEN_EXPIRED_BEFORE_DELIVERY' WHERE id=$1",
        [row.id],
      );
      await client.query("COMMIT");
      return true;
    }

    const actionPath = row.email_kind === "verification" ? "verify-email" : "reset-password";
    const delivery = await deliverAuthEmail({
      kind: row.email_kind as AuthEmailKind,
      recipient: String(row.recipient),
      recipientName: String(row.recipient_name),
      actionUrl: `${String(row.action_base_url).replace(/\/+$/, "")}/${actionPath}?token=${encodeURIComponent(token)}`,
      expiresInHours: Number(row.expires_in_hours),
    });
    if (!delivery.sent) {
      await client.query(
        `UPDATE tradigo_auth_email_outbox
         SET attempt_count=attempt_count+1, last_error=$2,
             next_attempt_at=NOW() + (LEAST(60, POWER(2, LEAST(attempt_count, 5))) * interval '1 minute')
         WHERE id=$1`,
        [row.id, delivery.reason ?? "provider_error"],
      );
      await client.query("COMMIT");
      return true;
    }

    await client.query("SELECT id FROM tradigo_users WHERE id=$1 FOR UPDATE", [row.user_id]);
    const tokenResult = await client.query(
      "SELECT token_kind, expires_at, consumed_at FROM tradigo_auth_tokens WHERE id=$1 FOR UPDATE",
      [row.token_id],
    );
    const authToken = tokenResult.rows[0] as Record<string, any> | undefined;
    if (!authToken || authToken.consumed_at || new Date(authToken.expires_at).getTime() <= Date.now()) {
      await client.query(
        "UPDATE tradigo_auth_email_outbox SET sent_at=NOW(), last_error='TOKEN_EXPIRED_BEFORE_DELIVERY' WHERE id=$1",
        [row.id],
      );
      await client.query("COMMIT");
      return true;
    }
    await client.query(
      `UPDATE tradigo_auth_tokens SET consumed_at=NOW()
       WHERE user_id=$1 AND token_kind=$2 AND activated_at IS NOT NULL AND consumed_at IS NULL AND id<>$3`,
      [row.user_id, authToken.token_kind, row.token_id],
    );
    await client.query("UPDATE tradigo_auth_tokens SET activated_at=NOW() WHERE id=$1", [row.token_id]);
    await client.query("UPDATE tradigo_auth_email_outbox SET sent_at=NOW(), last_error=NULL WHERE id=$1", [row.id]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    logger.error({ err: error }, "Auth email outbox processing failed");
    return false;
  } finally {
    client.release();
  }
}

export function startAuthEmailOutboxWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  const run = async () => {
    while (await processAuthEmailOutboxOnce()) {
      // Drain all currently ready messages before sleeping.
    }
  };
  setInterval(() => void run(), OUTBOX_INTERVAL_MS).unref();
}