import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { pool } from "@workspace/db";

const IDENTITY_DECISIONS = ["VERIFIED", "DECLINED", "PENDING", "EXPIRED", "UNAVAILABLE"] as const;
const IDENTITY_CHECK_KEYS = ["documentNameMatch", "documentValidity", "liveness", "sanctionsScreening"] as const;
const IDENTITY_CHECK_VALUES = ["PASS", "FAIL", "REVIEW", "NOT_CHECKED"] as const;
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000;

type IdentityDecision = typeof IDENTITY_DECISIONS[number];

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function nestedObjects(body: Record<string, any>): Record<string, any>[] {
  return [
    body,
    ...(isObject(body.data) ? [body.data] : []),
    ...(isObject(body.result) ? [body.result] : []),
    ...(isObject(body.verification) ? [body.verification] : []),
    ...(isObject(body.resource) ? [body.resource] : []),
  ];
}

function valueFrom(objects: Record<string, any>[], ...keys: string[]): unknown {
  for (const object of objects) {
    for (const key of keys) {
      if (object[key] !== undefined && object[key] !== null) return object[key];
    }
  }
  return undefined;
}

function normalizeDecision(value: unknown): IdentityDecision | null {
  const normalized = cleanText(value, 80).toUpperCase().replace(/[\s-]+/g, "_");
  if (IDENTITY_DECISIONS.includes(normalized as IdentityDecision)) return normalized as IdentityDecision;
  if (["APPROVED", "PASSED", "CLEAR", "SUCCESS", "COMPLETED"].includes(normalized)) return "VERIFIED";
  if (["REJECTED", "FAILED", "FAILURE", "DENIED", "NOT_VERIFIED"].includes(normalized)) return "DECLINED";
  if (["IN_REVIEW", "UNDER_REVIEW", "PROCESSING", "REVIEW"].includes(normalized)) return "PENDING";
  return null;
}

function normalizeChecks(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  const aliases: Record<string, typeof IDENTITY_CHECK_KEYS[number]> = {
    documentNameMatch: "documentNameMatch",
    document_name_match: "documentNameMatch",
    nameMatch: "documentNameMatch",
    documentValidity: "documentValidity",
    document_validity: "documentValidity",
    documentCheck: "documentValidity",
    liveness: "liveness",
    livenessCheck: "liveness",
    sanctionsScreening: "sanctionsScreening",
    sanctions_screening: "sanctionsScreening",
    sanctions: "sanctionsScreening",
  };
  const checks: Record<string, string> = {};
  for (const [key, outputKey] of Object.entries(aliases)) {
    const valueText = cleanText(value[key], 40).toUpperCase().replace(/[\s-]+/g, "_");
    const normalized = valueText === "PASSED" || valueText === "CLEAR" ? "PASS"
      : valueText === "FAILED" ? "FAIL"
        : valueText === "UNAVAILABLE" ? "NOT_CHECKED"
          : valueText;
    if (IDENTITY_CHECK_VALUES.includes(normalized as typeof IDENTITY_CHECK_VALUES[number])) checks[outputKey] = normalized;
  }
  return checks;
}

function normalizeReasonCodes(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return [...new Set(values
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim().toUpperCase().replace(/[^A-Z0-9:_-]/g, "_").slice(0, 120))
    .filter(Boolean))].slice(0, 12);
}

function normalizedDate(value: unknown): string | null {
  const text = cleanText(value, 80);
  if (!text || !Number.isFinite(Date.parse(text))) return null;
  return new Date(text).toISOString();
}

function webhookSecret(): string {
  return process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET
    || process.env.IDENTITY_PROVIDER_WEBHOOK_SECRET
    || process.env.TRADIGO_PROVIDER_WEBHOOK_SECRET
    || "";
}

function signaturesFromHeader(value: string): string[] {
  return value
    .split(",")
    .map(part => part.trim())
    .flatMap(part => {
      const [, candidate] = part.split("=", 2);
      return candidate || part;
    })
    .filter(Boolean);
}

function matchesSignature(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function verifySignature(req: Request, rawBody: Buffer, provider: string): boolean {
  const secret = webhookSecret();
  const isPayPalContract = provider === "PAYPAL";
  const signatureHeader = isPayPalContract
    ? req.header("x-paypal-identity-signature")
    : req.header("x-tradigo-identity-signature")
      || req.header("x-provider-signature");
  if (!secret || !signatureHeader) return false;

  const timestamp = firstText(
    ...(isPayPalContract
      ? [req.header("x-paypal-identity-timestamp")]
      : [
        req.header("x-tradigo-identity-timestamp"),
        req.header("x-provider-timestamp"),
        req.header("x-signature-timestamp"),
      ]),
  );
  const parsedTimestamp = timestamp ? Number(timestamp) : NaN;
  const timestampFormat = isPayPalContract ? /^\d{10}$/ : /^(?:\d{10}|\d{13})$/;
  if (!timestampFormat.test(timestamp) || !Number.isFinite(parsedTimestamp)) return false;
  const timestampMs = parsedTimestamp < 10_000_000_000 ? parsedTimestamp * 1000 : parsedTimestamp;
  if (Math.abs(Date.now() - timestampMs) > MAX_SIGNATURE_AGE_MS) return false;

  if (isPayPalContract) {
    const expected = createHmac("sha256", secret)
      .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
      .digest("hex");
    const normalized = signatureHeader.trim();
    return /^sha256=[0-9a-f]{64}$/i.test(normalized)
      && matchesSignature(normalized.slice("sha256=".length), expected);
  }

  const signedBody = Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]);
  const candidates = [
    createHmac("sha256", secret).update(signedBody).digest("hex"),
    createHmac("sha256", secret).update(signedBody).digest("base64"),
    createHmac("sha256", secret).update(signedBody).digest("base64url"),
  ];
  return signaturesFromHeader(signatureHeader).some(actual =>
    candidates.some(expected => matchesSignature(actual.replace(/^sha256=/i, ""), expected)));
}

function ensureSchema(): Promise<void> {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS tradigo_application_audit (
      id text PRIMARY KEY, application_id text NOT NULL, actor_id text NOT NULL,
      action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tradigo_identity_webhook_events (
      id text PRIMARY KEY,
      provider text NOT NULL,
      event_id text NOT NULL,
      application_id text,
      provider_reference text,
      decision text NOT NULL,
      checks jsonb NOT NULL DEFAULT '{}'::jsonb,
      reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
      decided_at timestamptz,
      payload_hash text NOT NULL,
      status text NOT NULL DEFAULT 'RECEIVED',
      error text,
      received_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      attempt_count integer NOT NULL DEFAULT 0,
      last_attempt_at timestamptz,
      last_actor_id text
    );
    ALTER TABLE tradigo_identity_webhook_events ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
    ALTER TABLE tradigo_identity_webhook_events ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
    ALTER TABLE tradigo_identity_webhook_events ADD COLUMN IF NOT EXISTS last_actor_id text;
    CREATE UNIQUE INDEX IF NOT EXISTS tradigo_identity_webhook_events_provider_event_idx
      ON tradigo_identity_webhook_events(provider, event_id);
    CREATE INDEX IF NOT EXISTS tradigo_identity_webhook_events_application_idx
      ON tradigo_identity_webhook_events(application_id, received_at);
    CREATE UNIQUE INDEX IF NOT EXISTS tradigo_application_audit_identity_event_idx
      ON tradigo_application_audit(application_id, action, ((details->>'providerEventId')))
      WHERE action = 'IDENTITY_VERIFICATION_DECISION' AND details->>'providerEventId' IS NOT NULL;
  `).then(() => undefined);
}

function errorMessage(res: Response, status: number, message: string): void {
  res.status(status).json({ error: { message } });
}

export async function handleIdentityProviderWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const body = isObject(req.body) ? req.body : {};
  const objects = nestedObjects(body);
  const provider = firstText(
    req.header("x-identity-provider"),
    valueFrom(objects, "provider", "provider_name", "providerName"),
    "IDENTITY_PROVIDER",
  ).toUpperCase().slice(0, 80);
  if (!verifySignature(req, rawBody, provider)) {
    errorMessage(res, 401, "Identity provider webhook signature verification failed.");
    return;
  }

  const bodyEventId = firstText(valueFrom(objects, "event_id", "eventId", "id"));
  const headerEventId = firstText(req.header("x-provider-event-id"));
  if (!bodyEventId || (headerEventId && headerEventId !== bodyEventId)) {
    errorMessage(res, 400, "A matching provider event ID in the signed payload is required.");
    return;
  }
  const eventId = bodyEventId.slice(0, 200);
  const applicationId = firstText(valueFrom(objects, "application_id", "applicationId", "coach_application_id", "coachApplicationId", "application_reference", "applicationReference", "custom_id", "customId")).slice(0, 200);
  const providerReference = firstText(
    valueFrom(objects, "provider_reference", "providerReference", "verification_id", "verificationId", "review_reference", "reviewReference", "check_id", "checkId", "external_id", "externalId", "reference"),
    valueFrom(objects.slice(1), "id"),
  ).slice(0, 200);
  const decision = normalizeDecision(valueFrom(objects, "decision", "outcome", "status", "verification_status", "verificationStatus", "result"));
  const checks = normalizeChecks(valueFrom(objects, "checks", "check_results", "checkResults"));
  const reasonCodes = normalizeReasonCodes(valueFrom(objects, "reason_codes", "reasonCodes", "reason_code", "reasonCode", "reasons"));
  const decidedAt = normalizedDate(valueFrom(objects, "decided_at", "decidedAt", "occurred_at", "occurredAt", "timestamp", "created_at", "createdAt"));
  const basis = `Provider reported an identity decision of ${decision ?? "UNKNOWN"}.`;

  if (!eventId || !decision) {
    errorMessage(res, 400, "A provider event ID and valid identity decision are required.");
    return;
  }

  await ensureSchema();
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `INSERT INTO tradigo_identity_webhook_events
        (id, provider, event_id, application_id, provider_reference, decision, checks, reason_codes, decided_at, payload_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        provider,
        eventId,
        applicationId || null,
        providerReference || null,
        decision,
        JSON.stringify(checks),
        JSON.stringify(reasonCodes),
        decidedAt,
        payloadHash,
      ],
    );
    if (!claimed.rows[0]) {
      const existing = await client.query(
        "SELECT payload_hash FROM tradigo_identity_webhook_events WHERE provider=$1 AND event_id=$2",
        [provider, eventId],
      );
      await client.query("ROLLBACK");
      if (existing.rows[0]?.payload_hash !== payloadHash) {
        res.status(409).json({ error: { message: "This provider event ID was already used with a different payload." } });
        return;
      }
      res.status(200).json({ received: true, status: "DUPLICATE", provider, eventId });
      return;
    }

    const processed = await processIdentityWebhookEvent(client, eventId, {
      applicationId,
      provider,
      providerReference,
      decision,
      checks,
      reasonCodes,
      decidedAt,
      basis,
      actorId: `provider-webhook:${provider.toLowerCase()}`,
    });
    await client.query("COMMIT");
    if (processed.status === "FAILED") {
      res.status(202).json({
        received: true,
        status: "FAILED",
        provider,
        eventId,
        error: processed.error,
      });
      return;
    }
    res.status(200).json({
      received: true,
      status: "PROCESSED",
      provider,
      eventId,
      applicationId: processed.applicationId,
      decision,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(500).json({ error: { message: "Unable to record the provider identity decision." } });
  } finally {
    client.release();
  }
}

type IdentityWebhookEventInput = {
  applicationId?: string;
  provider?: string;
  providerReference?: string;
  decision?: IdentityDecision;
  checks?: Record<string, string>;
  reasonCodes?: string[];
  decidedAt?: string | null;
  basis?: string;
  actorId?: string;
};

export type IdentityWebhookProcessingResult = {
  status: "PROCESSED" | "FAILED";
  applicationId: string | null;
  error?: string;
  alreadyProcessed?: boolean;
};

type TransactionClient = {
  query: (queryText: string, values?: any[]) => Promise<{ rows: any[] }>;
};

/**
 * Applies one normalized event while the caller owns a transaction.
 * The unique audit index and the event row lock make this safe for webhook
 * delivery, moderator retry, and concurrent retry requests.
 */
export async function processIdentityWebhookEvent(
  client: TransactionClient,
  eventLookup: string,
  input: IdentityWebhookEventInput = {},
): Promise<IdentityWebhookProcessingResult> {
  const eventResult = await client.query(
    `SELECT * FROM tradigo_identity_webhook_events
     WHERE id=$1 OR event_id=$1
     ORDER BY CASE WHEN id=$1 THEN 0 ELSE 1 END
     LIMIT 1 FOR UPDATE`,
    [eventLookup],
  );
  const event = eventResult.rows[0] as Record<string, any> | undefined;
  if (!event) throw new Error("Identity webhook event not found.");
  if (event.status === "PROCESSED") {
    return { status: "PROCESSED", applicationId: event.application_id, alreadyProcessed: true };
  }

  const provider = cleanText(input.provider ?? event.provider, 80).toUpperCase();
  const providerReference = cleanText(input.providerReference ?? event.provider_reference, 200);
  const decision = cleanText(input.decision ?? event.decision, 40).toUpperCase() as IdentityDecision;
  const checks = input.checks ?? (isObject(event.checks) ? event.checks : {});
  const reasonCodes = input.reasonCodes ?? (Array.isArray(event.reason_codes) ? event.reason_codes : []);
  const decidedAt = input.decidedAt ?? (event.decided_at ? new Date(event.decided_at).toISOString() : null);
  const basis = cleanText(input.basis, 2000) || `Provider reported an identity decision of ${decision}.`;
  const actorId = cleanText(input.actorId, 200) || `provider-webhook:${provider.toLowerCase()}`;
  const recordedBy = `provider-webhook:${provider.toLowerCase()}`;
  const attemptedAt = new Date().toISOString();
  const applicationId = cleanText(input.applicationId ?? event.application_id, 200);

  let application: Record<string, any> | undefined;
  if (applicationId) {
    const applicationResult = await client.query(
      "SELECT * FROM tradigo_coach_applications WHERE id=$1 FOR UPDATE",
      [applicationId],
    );
    application = applicationResult.rows[0] as Record<string, any> | undefined;
  } else if (providerReference) {
    const applicationResult = await client.query(
      `SELECT * FROM tradigo_coach_applications
       WHERE verification->>'providerReference'=$1
          OR verification->>'provider_reference'=$1
       LIMIT 1 FOR UPDATE`,
      [providerReference],
    );
    application = applicationResult.rows[0] as Record<string, any> | undefined;
  }

  if (!application) {
    const message = applicationId
      ? "No Tradigo coach application matched the linked identity reference."
      : "This identity event has no linked Tradigo coach application.";
    await client.query(
      `UPDATE tradigo_identity_webhook_events
       SET status='FAILED', error=$1, processed_at=NOW(),
           attempt_count=COALESCE(attempt_count, 0)+1, last_attempt_at=$2, last_actor_id=$3
       WHERE id=$4`,
      [message, attemptedAt, actorId, event.id],
    );
    return { status: "FAILED", applicationId: null, error: message };
  }

  const previousVerification = isObject(application.verification) ? application.verification : {};
  const identityDecision = {
    decision,
    responsibleParty: `${provider} identity verification service`,
    recordedBy,
    recordedAt: attemptedAt,
    decidedAt: decidedAt ?? attemptedAt,
    providerEventId: event.event_id,
    basis,
    source: "PROVIDER_WEBHOOK",
    ...(Object.keys(checks).length ? { checks } : {}),
    ...(reasonCodes.length ? { reasonCodes } : {}),
  };
  const verification = {
    ...previousVerification,
    provider,
    identity: decision,
    identityDecision,
    ...(providerReference ? { providerReference } : {}),
    lastCheckedAt: attemptedAt,
  };
  await client.query(
    "UPDATE tradigo_coach_applications SET verification=$1::jsonb, updated_at=NOW() WHERE id=$2",
    [JSON.stringify(verification), application.id],
  );
  await client.query(
    `INSERT INTO tradigo_application_audit (id, application_id, actor_id, action, details)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     ON CONFLICT DO NOTHING`,
    [
      randomUUID(),
      application.id,
      actorId,
      "IDENTITY_VERIFICATION_DECISION",
      JSON.stringify({
        decision,
        provider,
        responsibleParty: identityDecision.responsibleParty,
        basis,
        source: "PROVIDER_WEBHOOK",
        providerEventId: event.event_id,
        ...(providerReference ? { providerReference } : {}),
        ...(decidedAt ? { decidedAt } : {}),
        ...(Object.keys(checks).length ? { checks } : {}),
        ...(reasonCodes.length ? { reasonCodes } : {}),
      }),
    ],
  );
  await client.query(
    `UPDATE tradigo_identity_webhook_events
     SET application_id=$1, status='PROCESSED', error=NULL, processed_at=NOW(),
         attempt_count=COALESCE(attempt_count, 0)+1, last_attempt_at=$2, last_actor_id=$3
     WHERE id=$4`,
    [application.id, attemptedAt, actorId, event.id],
  );
  return { status: "PROCESSED", applicationId: application.id };
}