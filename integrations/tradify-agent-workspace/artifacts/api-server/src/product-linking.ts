import crypto from "node:crypto";
import { and, eq, inArray, lte } from "drizzle-orm";
import {
  db,
  tradifyLinkAssertionReplays,
  tradifyLinkAttempts,
  tradifyLinkConsents,
  tradifyLinkRevocationInbox,
  tradifyLinkRevocationMismatches,
  tradifyLinkRevocationOutbox,
  tradifyLinkSubjects,
  tradifyProductLinks,
} from "@workspace/db";

export const LINK_CONTRACT = "tradify-account-linking-v1";
export const SIGNALS_ISSUER = "https://linking-dev.signals.tradifyapp.com";
export const JOURNAL_ISSUER = "https://linking-dev.journal.tradifyapp.com";
export const JOURNAL_AUDIENCE = "tradify-journal-link-v1-dev";
export const SIGNALS_AUDIENCE = "tradify-signals-link-v1-dev";
export const SIGNALS_CONSENT = "tradify-signals-link-consent-v1";
export const JOURNAL_INITIATION_CONSENT = "tradify-journal-link-initiation-v1";
const JOURNAL_SERVICE_SUBJECT = "tradify-journal-link-service";
const ASSERTION_LIFETIME_SECONDS = 120;

export type LinkState =
  | "awaiting_journal_confirmation"
  | "active"
  | "revocation_pending"
  | "revoked"
  | "unlinked";

export function linkingEnabled(): boolean {
  const deadline = process.env.TRADIFY_LINK_TEST_DEADLINE;
  const deadlineTimestamp = deadline ? Date.parse(deadline) : Number.NaN;
  const deadlineAllowsRequests = !deadline ||
    (Number.isFinite(deadlineTimestamp) &&
      new Date(deadlineTimestamp).toISOString() === deadline &&
      Date.now() < deadlineTimestamp);
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.TRADIFY_ACCOUNT_LINKING_ENABLED === "true" &&
    process.env.TRADIFY_ACCOUNT_LINKING_TEST_MODE === "true" &&
    /^tradify_test_[0-9]+_[a-f0-9]{8}$/.test(process.env.PGDATABASE ?? "") &&
    deadlineAllowsRequests
  );
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("LINKING_CONFIGURATION_MISSING");
  return value;
}

function partnerUrl(path: string): URL {
  const base = new URL(required("JOURNAL_LINK_API_URL"));
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error("LINKING_CONFIGURATION_INVALID");
  }
  return new URL(path, base);
}

function privateKey(): string {
  return required("SIGNALS_LINKING_PRIVATE_KEY").replaceAll("\\n", "\n");
}

function publicPartnerKey(): string {
  return required("JOURNAL_LINKING_PUBLIC_KEY").replaceAll("\\n", "\n");
}

export function linkingConfigurationReady(): boolean {
  try {
    if (!linkingEnabled()) return false;
    // These are contract proposals until both product owners finish written
    // acceptance. Never trust them implicitly from source defaults.
    if (
      required("SIGNALS_LINKING_ISSUER") !== SIGNALS_ISSUER ||
      required("JOURNAL_LINKING_ISSUER") !== JOURNAL_ISSUER ||
      required("JOURNAL_LINKING_AUDIENCE") !== SIGNALS_AUDIENCE ||
      required("SIGNALS_LINKING_AUDIENCE") !== JOURNAL_AUDIENCE
    ) return false;
    required("JOURNAL_LINK_API_URL");
    required("SIGNALS_LINKING_KEY_ID");
    required("JOURNAL_LINKING_KEY_ID");
    required("JOURNAL_LINKING_PUBLIC_KEY");
    const signingKey = crypto.createPrivateKey(privateKey());
    const verificationKey = crypto.createPublicKey(publicPartnerKey());
    if (
      signingKey.asymmetricKeyType !== "rsa" ||
      (signingKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
      verificationKey.asymmetricKeyType !== "rsa" ||
      (verificationKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    ) return false;
    return true;
  } catch {
    return false;
  }
}

function b32Label(prefix: "SIG" | "JRN"): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(8);
  let bits = 0;
  let value = 0;
  let encoded = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && encoded.length < 12) {
      encoded += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (encoded.length < 12 && bits > 0) encoded += alphabet[(value << (5 - bits)) & 31];
  return `${prefix}-${encoded.slice(0, 12)}`;
}

function jwtEncode(payload: Record<string, unknown>, kid: string, key: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${header}.${body}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), key).toString("base64url");
  return `${signingInput}.${signature}`;
}

// JSON.parse silently accepts duplicate object keys. JWT headers and claims are
// parsed with this strict walker so a signed ambiguous representation fails closed.
function parseUniqueJson(source: string): unknown {
  let i = 0;
  const ws = () => { while (/\s/.test(source[i] ?? "")) i += 1; };
  const string = (): string => {
    const start = i;
    if (source[i++] !== '"') throw new Error("invalid JSON string");
    while (i < source.length) {
      if (source[i] === "\\") { i += 2; continue; }
      if (source[i++] === '"') return JSON.parse(source.slice(start, i)) as string;
    }
    throw new Error("unterminated JSON string");
  };
  const value = (): unknown => {
    ws();
    if (source[i] === "{") {
      i += 1;
      ws();
      const object: Record<string, unknown> = {};
      if (source[i] === "}") { i += 1; return object; }
      while (i < source.length) {
        ws();
        const key = string();
        if (Object.hasOwn(object, key)) throw new Error("duplicate JSON key");
        ws();
        if (source[i++] !== ":") throw new Error("invalid JSON object");
        object[key] = value();
        ws();
        const delimiter = source[i++];
        if (delimiter === "}") return object;
        if (delimiter !== ",") throw new Error("invalid JSON object");
      }
      throw new Error("unterminated JSON object");
    }
    if (source[i] === "[") {
      i += 1;
      ws();
      const array: unknown[] = [];
      if (source[i] === "]") { i += 1; return array; }
      while (i < source.length) {
        array.push(value());
        ws();
        const delimiter = source[i++];
        if (delimiter === "]") return array;
        if (delimiter !== ",") throw new Error("invalid JSON array");
      }
      throw new Error("unterminated JSON array");
    }
    if (source[i] === '"') return string();
    const match = source.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if (!match) throw new Error("invalid JSON value");
    i += match[0].length;
    return JSON.parse(match[0]) as unknown;
  };
  const result = value();
  ws();
  if (i !== source.length) throw new Error("trailing JSON data");
  return result;
}

export type VerifiedAssertion = Record<string, unknown> & {
  jti: string;
  action: string;
  link_id?: string;
  event_id?: string;
  reason?: string;
};

export function verifyJournalAssertion(token: string, action: "revoke"): VerifiedAssertion {
  if (token.length > 12_000) throw new Error("ASSERTION_INVALID");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error("ASSERTION_INVALID");
  }
  const header = parseUniqueJson(Buffer.from(parts[0], "base64url").toString("utf8"));
  const claims = parseUniqueJson(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (!header || typeof header !== "object" || Array.isArray(header)) throw new Error("ASSERTION_INVALID");
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) throw new Error("ASSERTION_INVALID");
  const h = header as Record<string, unknown>;
  const c = claims as Record<string, unknown>;
  if (
    h.alg !== "RS256" ||
    h.typ !== "JWT" ||
    h.kid !== required("JOURNAL_LINKING_KEY_ID") ||
    Object.keys(h).some((key) => !["alg", "typ", "kid"].includes(key)) ||
    c.iss !== JOURNAL_ISSUER ||
    c.aud !== SIGNALS_AUDIENCE ||
    c.sub !== JOURNAL_SERVICE_SUBJECT ||
    c.action !== action ||
    c.contract_version !== LINK_CONTRACT ||
    typeof c.jti !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(c.jti)
  ) throw new Error("ASSERTION_INVALID");
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(c.iat) ||
    !Number.isSafeInteger(c.exp) ||
    (c.iat as number) < now - 120 ||
    (c.iat as number) > now + 30 ||
    (c.exp as number) <= now ||
    (c.exp as number) <= (c.iat as number) ||
    (c.exp as number) - (c.iat as number) > 120
  ) throw new Error("ASSERTION_INVALID");
  const signingInput = `${parts[0]}.${parts[1]}`;
  if (!crypto.verify("RSA-SHA256", Buffer.from(signingInput), publicPartnerKey(), Buffer.from(parts[2], "base64url"))) {
    throw new Error("ASSERTION_INVALID");
  }
  return c as VerifiedAssertion;
}

export async function journalPost(path: string, body: unknown, token?: string): Promise<Record<string, unknown>> {
  const response = await fetch(partnerUrl(path), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("PARTNER_UNAVAILABLE");
  const json: unknown = await response.json();
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("PARTNER_UNAVAILABLE");
  return json as Record<string, unknown>;
}

export function makeSignalsAssertion(
  claims: Record<string, unknown>,
  issuedAt = Math.floor(Date.now() / 1000),
  jti = crypto.randomBytes(18).toString("base64url"),
): { token: string; issuedAt: number; jti: string } {
  const kid = required("SIGNALS_LINKING_KEY_ID");
  const token = jwtEncode({
    iss: SIGNALS_ISSUER,
    aud: JOURNAL_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + ASSERTION_LIFETIME_SECONDS,
    jti,
    contract_version: LINK_CONTRACT,
    ...claims,
  }, kid, privateKey());
  return { token, issuedAt, jti };
}

export function authorizationCodeHash(code: string): string {
  return crypto.createHash("sha256").update(code, "utf8").digest("hex");
}

export function canonicalRevocationPayload(payload: {
  contractVersion: string;
  linkId: string;
  eventId: string;
  reason: string;
}): string {
  // V1 payload values are strings only; lexicographic key order is RFC 8785 JCS.
  return JSON.stringify({
    contractVersion: payload.contractVersion,
    eventId: payload.eventId,
    linkId: payload.linkId,
    reason: payload.reason,
  });
}

export function revocationPayloadHash(canonicalPayload: string): string {
  return crypto.createHash("sha256").update(Buffer.from(canonicalPayload, "utf8")).digest("hex");
}

export async function getOrCreateSignalsSubject(userId: string): Promise<string> {
  let [row] = await db.select().from(tradifyLinkSubjects).where(eq(tradifyLinkSubjects.userId, userId)).limit(1);
  if (row) return row.subject;
  const subject = crypto.randomBytes(32).toString("base64url");
  await db.insert(tradifyLinkSubjects).values({ userId, subject }).onConflictDoNothing();
  [row] = await db.select().from(tradifyLinkSubjects).where(eq(tradifyLinkSubjects.userId, userId)).limit(1);
  if (!row) throw new Error("LINK_STORAGE_UNAVAILABLE");
  return row.subject;
}

export function newSignalsAttemptLabel(): string {
  return b32Label("SIG");
}

export async function recordJournalRevocation(input: {
  token: string;
  body: Record<string, unknown>;
}): Promise<"revoked" | "duplicate"> {
  const claims = verifyJournalAssertion(input.token, "revoke");
  const { link_id: linkId, event_id: eventId, reason } = claims;
  if (
    typeof linkId !== "string" ||
    typeof eventId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(eventId) ||
    !["user_unlinked", "account_deleted", "account_suspended", "security_action"].includes(String(reason)) ||
    input.body.contractVersion !== LINK_CONTRACT ||
    input.body.linkId !== linkId ||
    input.body.eventId !== eventId ||
    input.body.reason !== reason
  ) throw new Error("ASSERTION_INVALID");

  const canonicalPayload = canonicalRevocationPayload({
    contractVersion: LINK_CONTRACT, linkId, eventId, reason: String(reason),
  });
  const payloadSha256 = revocationPayloadHash(canonicalPayload);
  const tokenFingerprint = crypto.createHash("sha256").update(input.token).digest("hex");
  const result = await db.transaction(async (tx) => {
    const replay = (await tx.select().from(tradifyLinkAssertionReplays)
      .where(and(
        eq(tradifyLinkAssertionReplays.issuer, JOURNAL_ISSUER),
        eq(tradifyLinkAssertionReplays.audience, SIGNALS_AUDIENCE),
        eq(tradifyLinkAssertionReplays.jti, claims.jti),
      )).limit(1))[0];
    if (replay) {
      if (replay.fingerprint !== tokenFingerprint) throw new Error("REPLAY_CONFLICT");
      throw new Error("REPLAY_CONFLICT");
    }
    const link = (await tx.select().from(tradifyProductLinks)
      .where(eq(tradifyProductLinks.linkId, linkId)).limit(1))[0];
    if (!link) throw new Error("LINK_NOT_FOUND");
    const insertedReplay = await tx.insert(tradifyLinkAssertionReplays).values({
      issuer: JOURNAL_ISSUER,
      audience: SIGNALS_AUDIENCE,
      jti: claims.jti,
      fingerprint: tokenFingerprint,
    }).onConflictDoNothing().returning({ jti: tradifyLinkAssertionReplays.jti });
    if (!insertedReplay.length) throw new Error("REPLAY_CONFLICT");
    const existing = (await tx.select().from(tradifyLinkRevocationInbox)
      .where(eq(tradifyLinkRevocationInbox.eventId, eventId)).limit(1))[0];
    if (existing) {
      if (existing.payloadSha256 !== payloadSha256 || existing.linkId !== linkId) {
        await tx.insert(tradifyLinkRevocationMismatches).values({
          id: crypto.randomUUID(),
          eventId,
          storedPayloadSha256: existing.payloadSha256,
          conflictingPayloadSha256: payloadSha256,
        });
        return "mismatch" as const;
      }
      return "duplicate" as const;
    }
    const insertedEvent = await tx.insert(tradifyLinkRevocationInbox)
      .values({ eventId, linkId, reason: String(reason), payloadSha256 })
      .onConflictDoNothing()
      .returning({ eventId: tradifyLinkRevocationInbox.eventId });
    if (!insertedEvent.length) {
      const raced = (await tx.select().from(tradifyLinkRevocationInbox)
        .where(eq(tradifyLinkRevocationInbox.eventId, eventId)).limit(1))[0];
      if (!raced || raced.payloadSha256 !== payloadSha256 || raced.linkId !== linkId) {
        if (raced) {
          await tx.insert(tradifyLinkRevocationMismatches).values({
            id: crypto.randomUUID(),
            eventId,
            storedPayloadSha256: raced.payloadSha256,
            conflictingPayloadSha256: payloadSha256,
          });
        }
        return "mismatch" as const;
      }
      return "duplicate" as const;
    }
    await tx.update(tradifyProductLinks)
      .set({ state: "revoked", revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(tradifyProductLinks.linkId, linkId));
    return "revoked" as const;
  });
  if (result === "mismatch") throw new Error("REPLAY_CONFLICT");
  return result;
}

export async function queueSignalsLinkRevocations(
  userId: string,
  reason: "account_suspended" | "security_action",
): Promise<number> {
  return db.transaction(async (tx) => {
    const links = await tx.select().from(tradifyProductLinks)
      .where(and(
        eq(tradifyProductLinks.userId, userId),
        inArray(tradifyProductLinks.state, ["active", "awaiting_journal_confirmation"]),
      ));
    for (const link of links) {
      const eventId = crypto.randomUUID();
      const canonicalPayload = canonicalRevocationPayload({
        contractVersion: LINK_CONTRACT,
        linkId: link.linkId,
        eventId,
        reason,
      });
      await tx.update(tradifyProductLinks).set({
        state: "revocation_pending",
        updatedAt: new Date(),
      }).where(eq(tradifyProductLinks.linkId, link.linkId));
      await tx.insert(tradifyLinkRevocationOutbox).values({
        eventId,
        linkId: link.linkId,
        userId,
        reason,
        canonicalPayload,
        payloadSha256: revocationPayloadHash(canonicalPayload),
      });
    }
    await tx.update(tradifyLinkAttempts).set({ state: "EXPIRED" })
      .where(and(eq(tradifyLinkAttempts.userId, userId), inArray(tradifyLinkAttempts.state, ["PREVIEWED", "CONSENTED"])));
    return links.length;
  });
}

export async function markOutboxEventDelivered(eventId: string, linkId: string, ackEventId: unknown, ackHash: unknown): Promise<void> {
  const event = (await db.select().from(tradifyLinkRevocationOutbox)
    .where(eq(tradifyLinkRevocationOutbox.eventId, eventId)).limit(1))[0];
  if (!event || ackEventId !== eventId || ackHash !== event.payloadSha256) throw new Error("ACK_MISMATCH");
  await db.transaction(async (tx) => {
    await tx.update(tradifyLinkRevocationOutbox)
      .set({
        state: "DELIVERED",
        acknowledgedEventId: eventId,
        acknowledgedPayloadSha256: event.payloadSha256,
        updatedAt: new Date(),
      })
      .where(eq(tradifyLinkRevocationOutbox.eventId, eventId));
    await tx.update(tradifyProductLinks)
      .set({ state: "revoked", revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tradifyProductLinks.linkId, linkId), eq(tradifyProductLinks.state, "revocation_pending")));
  });
}

export async function drainLinkRevocationOutbox(): Promise<number> {
  if (!linkingConfigurationReady()) return 0;
  const due = await db.select().from(tradifyLinkRevocationOutbox)
    .where(and(eq(tradifyLinkRevocationOutbox.state, "PENDING"), lte(tradifyLinkRevocationOutbox.nextAttemptAt, new Date())))
    .limit(20);
  let delivered = 0;
  for (const event of due) {
    const payload = JSON.parse(event.canonicalPayload) as {
      contractVersion: string; eventId: string; linkId: string; reason: string;
    };
    if (
      payload.contractVersion !== LINK_CONTRACT ||
      payload.eventId !== event.eventId ||
      payload.linkId !== event.linkId ||
      payload.reason !== event.reason ||
      revocationPayloadHash(event.canonicalPayload) !== event.payloadSha256
    ) {
      // A stored immutable event that fails self-validation must remain pending.
      continue;
    }
    const assertion = makeSignalsAssertion({
      sub: "tradify-signals-link-service",
      action: "revoke",
      link_id: payload.linkId,
      event_id: payload.eventId,
      reason: payload.reason,
    });
    try {
      const response = await journalPost("/api/v1/product-links/signals/revocations", payload, assertion.token);
      const ack = response.data && typeof response.data === "object"
        ? response.data as Record<string, unknown> : response;
      await markOutboxEventDelivered(event.eventId, event.linkId, ack.eventId, ack.payloadSha256);
      delivered += 1;
    } catch {
      await db.update(tradifyLinkRevocationOutbox)
        .set({
          attempts: Number(event.attempts) + 1,
          nextAttemptAt: new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(Number(event.attempts), 7))),
          updatedAt: new Date(),
        })
        .where(eq(tradifyLinkRevocationOutbox.eventId, event.eventId));
    }
  }
  return delivered;
}

export async function cancelExpiredLinkAttempts(): Promise<number> {
  const expired = await db.update(tradifyLinkAttempts)
    .set({ state: "EXPIRED" })
    .where(and(eq(tradifyLinkAttempts.state, "PREVIEWED"), lte(tradifyLinkAttempts.expiresAt, new Date())))
    .returning({ id: tradifyLinkAttempts.id });
  return expired.length;
}

export function createAttemptId(): string {
  return crypto.randomUUID();
}

export function newJournalAttemptLabel(): string {
  return b32Label("JRN");
}
