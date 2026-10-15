import { pool } from "./db";
import {
  LINK_CONTRACT_VERSION,
  SIGNALS_DEV_ISSUER,
  SIGNALS_LINK_AUDIENCE,
  canonicalizeRevocationPayload,
  getJournalSigningConfig,
  sha256,
  signJournalAssertion,
  type RevocationReason,
} from "./product-linking-assertions";

type DueEvent = {
  event_id: string;
  link_id: string;
  partner_issuer: string;
  reason: RevocationReason;
  attempt_count: number;
  canonical_payload: string;
  payload_hash: string;
};

type DrainOptions = {
  limit?: number;
  fetchImpl?: typeof fetch;
};

export type ProductLinkOutboxResult = {
  claimed: number;
  delivered: number;
  retried: number;
};

const MAX_BATCH_SIZE = 25;
const DELIVERY_LEASE_MS = 2 * 60 * 1000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

export function boundedRevocationRetryDelayMs(attemptCount: number): number {
  const attempt = Number.isFinite(attemptCount) ? Math.trunc(attemptCount) : 1;
  const exponent = Math.min(Math.max(attempt - 1, 0), 12);
  return Math.min(MAX_BACKOFF_MS, 10_000 * (2 ** exponent));
}

function assertManualDevelopmentContext(): void {
  if (!["development", "test"].includes(process.env.NODE_ENV ?? "")) {
    throw new Error("Product-link outbox delivery is restricted to development and test.");
  }
  if (process.env.DEV_PRODUCT_LINKING_ENABLED !== "true") {
    throw new Error("Product linking is disabled; no outbox events were sent.");
  }
}

async function claimDueEvents(limit: number): Promise<DueEvent[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rows = await client.query<DueEvent>(
      `WITH due AS (
         SELECT event_id
           FROM product_link_revocation_outbox
          WHERE state IN ('pending', 'retry')
            AND next_attempt_at <= NOW()
          ORDER BY next_attempt_at, created_at
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       UPDATE product_link_revocation_outbox AS outbox
          SET state = 'retry',
              attempt_count = outbox.attempt_count + 1,
              next_attempt_at = NOW() + ($2::bigint * INTERVAL '1 millisecond')
         FROM due
        WHERE outbox.event_id = due.event_id
       RETURNING outbox.event_id, outbox.link_id, outbox.partner_issuer,
                  outbox.reason, outbox.attempt_count, outbox.canonical_payload,
                  outbox.payload_hash`,
      [limit, DELIVERY_LEASE_MS],
    );
    await client.query("COMMIT");
    return rows.rows;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function recordDelivery(event: DueEvent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const markedDelivered = await client.query(
      `UPDATE product_link_revocation_outbox
          SET state = 'delivered', delivered_at = NOW(), last_error_code = NULL
        WHERE event_id = $1 AND payload_hash = $2
          AND canonical_payload = $3 AND state = 'retry'
        RETURNING event_id`,
      [event.event_id, event.payload_hash, event.canonical_payload],
    );
    if (markedDelivered.rowCount !== 1) {
      throw new Error("Revocation outbox event changed before acknowledgement was committed.");
    }
    await client.query(
      `UPDATE product_account_links
          SET state = 'revoked', partner_subject = NULL, revoked_at = NOW()
        WHERE id = $1 AND partner_issuer = $2 AND state = 'revocation_pending'`,
      [event.link_id, event.partner_issuer],
    );
    await client.query(
      `INSERT INTO product_link_tombstones (link_id, partner_issuer, event_id, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (link_id) DO NOTHING`,
      [event.link_id, event.partner_issuer, event.event_id, event.reason],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function scheduleRetry(event: DueEvent, errorCode: string): Promise<void> {
  const backoffMs = boundedRevocationRetryDelayMs(event.attempt_count);
  await pool.query(
    `UPDATE product_link_revocation_outbox
        SET state = 'retry',
            next_attempt_at = NOW() + ($2::bigint * INTERVAL '1 millisecond'),
            last_error_code = $3
      WHERE event_id = $1 AND state <> 'delivered'`,
    [event.event_id, backoffMs, errorCode],
  );
}

/**
 * One explicit outbox pass. The normal Journal web process never schedules
 * this function. Each delivery attempt signs a fresh short-lived assertion,
 * while retaining the event ID and immutable revocation body for idempotency.
 */
export async function drainProductLinkOutboxOnce(
  options: DrainOptions = {},
): Promise<ProductLinkOutboxResult> {
  assertManualDevelopmentContext();
  const config = getJournalSigningConfig();
  if (!config) {
    throw new Error("Journal signing key, Signals API URL, and development trust configuration are required.");
  }
  if (config.audience !== SIGNALS_LINK_AUDIENCE) {
    throw new Error("The configured Signals audience is not an approved development audience.");
  }

  const limit = Math.max(1, Math.min(options.limit ?? MAX_BATCH_SIZE, MAX_BATCH_SIZE));
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const events = await claimDueEvents(limit);
  let delivered = 0;
  let retried = 0;

  for (const event of events) {
    if (event.partner_issuer !== SIGNALS_DEV_ISSUER) {
      await scheduleRetry(event, "UNAPPROVED_PARTNER_ISSUER");
      retried += 1;
      continue;
    }

    let body: {
      contractVersion: typeof LINK_CONTRACT_VERSION;
      linkId: string;
      eventId: string;
      reason: RevocationReason;
      payloadHash: string;
    };
    try {
      const persistedPayload = JSON.parse(event.canonical_payload) as Omit<typeof body, "payloadHash">;
      const canonicalPayload = canonicalizeRevocationPayload(persistedPayload);
      if (
        canonicalPayload !== event.canonical_payload ||
        sha256(canonicalPayload) !== event.payload_hash ||
        persistedPayload.eventId !== event.event_id ||
        persistedPayload.linkId !== event.link_id ||
        persistedPayload.reason !== event.reason ||
        persistedPayload.contractVersion !== LINK_CONTRACT_VERSION
      ) {
        await scheduleRetry(event, "OUTBOX_PAYLOAD_INTEGRITY_FAILURE");
        retried += 1;
        continue;
      }
      body = { ...persistedPayload, payloadHash: event.payload_hash };
      const assertion = signJournalAssertion(config, "revoke", {
        linkId: event.link_id,
        eventId: event.event_id,
        reason: event.reason,
        payloadHash: event.payload_hash,
      });
      const endpoint = new URL("/api/v1/product-links/journal/revocations", config.apiBaseUrl);
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${assertion}`,
          "cache-control": "no-store",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }
      const validAcknowledgement = Boolean(
        response.status === 200 &&
        responseBody &&
        typeof responseBody === "object" &&
        (responseBody as Record<string, unknown>).contractVersion === LINK_CONTRACT_VERSION &&
        (responseBody as Record<string, unknown>).linkId === event.link_id &&
        (responseBody as Record<string, unknown>).eventId === event.event_id &&
        (responseBody as Record<string, unknown>).payloadHash === event.payload_hash &&
        (responseBody as Record<string, unknown>).state === "revoked",
      );
      if (validAcknowledgement) {
        await recordDelivery(event);
        delivered += 1;
      } else {
        await scheduleRetry(event, response.status === 409 ? "PARTNER_CONFLICT" : "PARTNER_UNAVAILABLE");
        retried += 1;
      }
    } catch {
      await scheduleRetry(event, "PARTNER_UNAVAILABLE");
      retried += 1;
    }
  }

  return { claimed: events.length, delivered, retried };
}
