import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import type { PoolClient } from "pg";
import { pool } from "./db";
import {
  JOURNAL_CONFIRMATION_CONSENT_VERSION,
  JOURNAL_INITIATION_CONSENT_VERSION,
  JOURNAL_LINK_AUDIENCE,
  LINK_CONTRACT_VERSION,
  SIGNALS_CONSENT_VERSION,
  SIGNALS_DEV_ISSUER,
  constantTimeHexEqual,
  createAttemptLabel,
  getSignalsKeyring,
  isAttemptLabel,
  isRevocationReason,
  isUuid,
  sha256,
  verifySignalsAssertion,
  type RevocationReason,
  type VerifiedSignalsAssertion,
} from "./product-linking-assertions";

const LINK_BASE = "/api/v1/product-links/signals";
const AUTHORIZATION_LIFETIME_MS = 5 * 60 * 1000;
const CODE_FORMAT = /^[a-f0-9]{64}$/;
const FIXED_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { resetAt: number; count: number }>();

type LinkState =
  | "awaiting_journal_confirmation"
  | "active"
  | "revocation_pending"
  | "revoked"
  | "expired"
  | "cancelled";

type LinkRow = {
  id: string;
  journal_user_role_id: number;
  authorization_id: string;
  partner_issuer: string;
  partner_subject: string | null;
  journal_attempt_label: string;
  signals_attempt_label: string;
  state: LinkState;
  expires_at: Date;
  linked_at: Date | null;
  revoked_at: Date | null;
};

function noStore(_req: Request, res: Response, next: () => void): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
}

function errorResponse(
  res: Response,
  status: number,
  code: string,
  message: string,
): Response {
  return res.status(status).json({ error: { code, message } });
}

function disabled(res: Response): Response {
  return errorResponse(res, 503, "LINKING_DISABLED", "Account linking is not enabled.");
}

function isEnabled(): boolean {
  return Boolean(getSignalsKeyring());
}

function exactObjectKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isLoopback(req: Request): boolean {
  const ip = req.ip?.toLowerCase();
  const hostname = req.hostname?.toLowerCase();
  return ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
}

function hasSecureServiceTransport(req: Request): boolean {
  return req.secure ||
    (req.app.get("trust proxy") && req.get("x-forwarded-proto")?.split(",")[0].trim() === "https") ||
    isLoopback(req);
}

function sameOrigin(req: Request): boolean {
  const supplied = req.get("origin");
  const host = req.get("host");
  if (!supplied || !host) return false;
  try {
    const parsedOrigin = new URL(supplied);
    const expectedOrigin = new URL(`${req.protocol}://${host}`);
    return parsedOrigin.origin === supplied && parsedOrigin.origin === expectedOrigin.origin;
  } catch {
    return false;
  }
}

function safeTokenEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function csrfToken(req: Request): string {
  const session = req.session as typeof req.session & { productLinkCsrfToken?: string };
  if (!session.productLinkCsrfToken) {
    session.productLinkCsrfToken = randomBytes(32).toString("base64url");
  }
  return session.productLinkCsrfToken;
}

function browserMutationAllowed(req: Request, res: Response): boolean {
  if (!sameOrigin(req)) {
    errorResponse(res, 403, "CSRF_ORIGIN_FAILED", "The request could not be verified.");
    return false;
  }
  const session = req.session as typeof req.session & { productLinkCsrfToken?: string };
  if (!safeTokenEqual(session.productLinkCsrfToken, req.get("x-csrf-token"))) {
    errorResponse(res, 403, "CSRF_ORIGIN_FAILED", "The request could not be verified.");
    return false;
  }
  return true;
}

function browserRateLimit(name: string, maximum: number): RequestHandler {
  return (req, res, next) => {
    const identity = req.session?.userId || req.ip || "unknown";
    const key = `${name}:${sha256(identity)}`;
    const now = Date.now();
    let bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { resetAt: now + FIXED_WINDOW_MS, count: 0 };
      rateBuckets.set(key, bucket);
    }
    bucket.count += 1;
    if (rateBuckets.size > 5000) {
      for (const [currentKey, current] of rateBuckets) {
        if (current.resetAt <= now) rateBuckets.delete(currentKey);
      }
    }
    if (bucket.count > maximum) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return errorResponse(res, 429, "RATE_LIMITED", "Please wait before trying again.");
    }
    next();
  };
}

function serviceRequestAllowed(req: Request, res: Response): boolean {
  if (!hasSecureServiceTransport(req)) {
    errorResponse(res, 400, "INVALID_REQUEST", "A secure service request is required.");
    return false;
  }
  if (req.get("cookie")) {
    errorResponse(res, 401, "ASSERTION_INVALID", "The service request could not be verified.");
    return false;
  }
  return true;
}

function bearerToken(req: Request): string | undefined {
  return req.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
}

function localAccountLabel(name: unknown): string {
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 100) : "Journal account";
}

function linkResponse(link: LinkRow, accountLabel: string): Record<string, unknown> {
  const base = {
    state: link.state,
    linkId: link.id,
    journalAttemptLabel: link.journal_attempt_label,
    signalsAttemptLabel: link.signals_attempt_label,
    journalAccountLabel: accountLabel,
  };
  if (link.state === "active") return { ...base, linkedAt: link.linked_at?.toISOString() };
  if (
    link.state === "awaiting_journal_confirmation" ||
    link.state === "revocation_pending"
  ) {
    return { ...base, expiresAt: link.expires_at.toISOString() };
  }
  if (link.state === "revoked") return { ...base, revokedAt: link.revoked_at?.toISOString() };
  return base;
}

async function ensureSchemaAvailable(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ links: string | null; outbox: string | null }>(
    `SELECT to_regclass('public.product_account_links')::text AS links,
            to_regclass('public.product_link_revocation_outbox')::text AS outbox`,
  );
  return Boolean(result.rows[0]?.links && result.rows[0]?.outbox);
}

async function getAuthenticatedJournalRole(
  req: Request,
  requireVerified: boolean,
): Promise<{ id: number; full_name: string | null } | null> {
  const result = await pool.query<{ id: number; full_name: string | null }>(
    `SELECT id, full_name
       FROM user_role
      WHERE user_id = $1
        AND role <> 'DEACTIVATED'
        AND ($2::boolean = FALSE OR email_verified = TRUE)
      LIMIT 1`,
    [req.session.userId, requireVerified],
  );
  return result.rows[0] ?? null;
}

function checkClaimAgainstAuthorization(
  assertion: Extract<VerifiedSignalsAssertion, { action: "claim" }>,
  authorization: {
    journal_attempt_label: string;
    journal_initiation_consent_version: string;
  },
  authorizationCode: string,
): boolean {
  return (
    assertion.journalAttemptLabel === authorization.journal_attempt_label &&
    assertion.journalInitiationConsentVersion === authorization.journal_initiation_consent_version &&
    constantTimeHexEqual(assertion.codeSha256, sha256(authorizationCode))
  );
}

async function saveReplay(
  client: PoolClient,
  assertion: VerifiedSignalsAssertion,
  linkId: string,
  codeSha256: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO product_link_assertion_replays
       (partner_issuer, audience, assertion_jti, action, assertion_sha256,
        authorization_code_sha256, link_id, key_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      assertion.issuer,
      assertion.audience,
      assertion.jti,
      assertion.action,
      assertion.fingerprint,
      codeSha256,
      linkId,
      assertion.keyId,
    ],
  );
}

async function createRevocationOutboxEvent(
  client: PoolClient,
  linkId: string,
  partnerIssuer: string,
  reason: RevocationReason,
): Promise<string> {
  const previous = await client.query<{ event_id: string }>(
    `SELECT event_id
       FROM product_link_revocation_outbox
      WHERE link_id = $1 AND partner_issuer = $2
        AND state IN ('pending', 'retry')
        AND reason = $3
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE`,
    [linkId, partnerIssuer, reason],
  );
  if (previous.rows[0]) return previous.rows[0].event_id;
  const eventId = randomUUID();
  await client.query(
    `INSERT INTO product_link_revocation_outbox
       (event_id, link_id, partner_issuer, reason)
     VALUES ($1, $2, $3, $4)`,
    [eventId, linkId, partnerIssuer, reason],
  );
  return eventId;
}

function normalizedLinkState(row: LinkRow): LinkState {
  if (
    row.state === "awaiting_journal_confirmation" &&
    row.expires_at.getTime() <= Date.now()
  ) {
    return "expired";
  }
  return row.state;
}

export function registerProductLinkingRoutes(
  app: Express,
  requireAuth: RequestHandler,
): void {
  app.use(LINK_BASE, noStore);

  app.get(`${LINK_BASE}/configuration`, requireAuth, (_req, res) => {
    return res.json({ enabled: isEnabled() });
  });

  app.get(`${LINK_BASE}/csrf`, requireAuth, (req, res) => {
    if (!isEnabled()) return disabled(res);
    return res.json({ csrfToken: csrfToken(req) });
  });

  app.get(
    LINK_BASE,
    requireAuth,
    browserRateLimit("journal-link-status", 120),
    async (req, res) => {
      if (!isEnabled()) return disabled(res);
      try {
        const role = await getAuthenticatedJournalRole(req, false);
        if (!role) return errorResponse(res, 404, "LINK_NOT_FOUND", "No account link was found.");

        await pool.query(
          `UPDATE product_account_links
              SET state = 'expired', partner_subject = NULL
            WHERE journal_user_role_id = $1
              AND state = 'awaiting_journal_confirmation'
              AND expires_at <= NOW()`,
          [role.id],
        );

        const current = await pool.query<LinkRow>(
          `SELECT id, journal_user_role_id, authorization_id, partner_issuer,
                  partner_subject, journal_attempt_label, signals_attempt_label,
                  state, expires_at, linked_at, revoked_at
             FROM product_account_links
            WHERE journal_user_role_id = $1
            ORDER BY CASE state
              WHEN 'active' THEN 0
              WHEN 'awaiting_journal_confirmation' THEN 1
              WHEN 'revocation_pending' THEN 2
              WHEN 'revoked' THEN 3
              WHEN 'expired' THEN 4
              ELSE 5 END,
              created_at DESC
            LIMIT 1`,
          [role.id],
        );
        if (current.rows[0]) return res.json(linkResponse(current.rows[0], localAccountLabel(role.full_name)));

        const authorization = await pool.query<{
          journal_attempt_label: string;
          expires_at: Date;
        }>(
          `SELECT journal_attempt_label, expires_at
             FROM product_link_authorizations
            WHERE journal_user_role_id = $1
              AND consumed_at IS NULL
              AND revoked_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1`,
          [role.id],
        );
        if (authorization.rows[0]) {
          return res.json({
            state: "awaiting_signals_consent",
            journalAttemptLabel: authorization.rows[0].journal_attempt_label,
            expiresAt: authorization.rows[0].expires_at.toISOString(),
            journalAccountLabel: localAccountLabel(role.full_name),
          });
        }
        return res.json({ state: "unlinked" });
      } catch {
        return errorResponse(res, 500, "LINK_STATUS_FAILED", "Could not read account-link status.");
      }
    },
  );

  app.post(
    `${LINK_BASE}/authorization`,
    requireAuth,
    browserRateLimit("journal-link-authorization", 5),
    async (req, res) => {
      if (!isEnabled()) return disabled(res);
      if (!browserMutationAllowed(req, res)) return;
      if (
        !exactObjectKeys(req.body, ["contractVersion", "consent", "consentVersion"]) ||
        req.body.contractVersion !== LINK_CONTRACT_VERSION ||
        req.body.consent !== true ||
        req.body.consentVersion !== JOURNAL_INITIATION_CONSENT_VERSION
      ) {
        return errorResponse(res, 400, "CONSENT_REQUIRED", "Journal consent to start linking is required.");
      }

      const authorizationCode = randomBytes(32).toString("hex");
      const codeDigest = sha256(authorizationCode);
      const authorizationId = randomUUID();
      const journalAttemptLabel = createAttemptLabel("JRN");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const account = await client.query<{
          id: number;
          full_name: string | null;
        }>(
          `SELECT id, full_name
             FROM user_role
            WHERE user_id = $1 AND email_verified = TRUE AND role <> 'DEACTIVATED'
            LIMIT 1
            FOR UPDATE`,
          [req.session.userId],
        );
        const role = account.rows[0];
        if (!role) {
          await client.query("ROLLBACK");
          return errorResponse(res, 401, "AUTHENTICATION_REQUIRED", "Verified Journal sign-in is required.");
        }

        const existing = await client.query<{ state: LinkState }>(
          `SELECT state
             FROM product_account_links
            WHERE journal_user_role_id = $1
              AND partner_issuer = $2
              AND state IN ('active', 'revocation_pending')
            LIMIT 1`,
          [role.id, SIGNALS_DEV_ISSUER],
        );
        if (existing.rows[0]) {
          await client.query("ROLLBACK");
          return errorResponse(res, 409, "LINK_EXISTS", "An account link already exists or is being disconnected.");
        }

        await client.query(
          `UPDATE product_link_authorizations
              SET revoked_at = NOW()
            WHERE journal_user_role_id = $1
              AND consumed_at IS NULL
              AND revoked_at IS NULL`,
          [role.id],
        );
        await client.query(
          `UPDATE product_account_links
              SET state = 'cancelled', partner_subject = NULL
            WHERE journal_user_role_id = $1
              AND state = 'awaiting_journal_confirmation'`,
          [role.id],
        );
        const inserted = await client.query<{ created_at: Date; expires_at: Date }>(
          `INSERT INTO product_link_authorizations
             (id, journal_user_role_id, authorization_code_sha256,
              journal_initiation_consent_version, journal_initiation_consent_at,
              journal_attempt_label, created_at, expires_at)
           VALUES ($1, $2, $3, $4, NOW(), $5, NOW(), NOW() + INTERVAL '5 minutes')
           RETURNING created_at, expires_at`,
          [
            authorizationId,
            role.id,
            codeDigest,
            JOURNAL_INITIATION_CONSENT_VERSION,
            journalAttemptLabel,
          ],
        );
        await client.query("COMMIT");
        return res.status(201).json({
          contractVersion: LINK_CONTRACT_VERSION,
          authorizationCode,
          journalAttemptLabel,
          journalAccountLabel: localAccountLabel(role.full_name),
          expiresAt: inserted.rows[0].expires_at.toISOString(),
        });
      } catch {
        await client.query("ROLLBACK").catch(() => undefined);
        return errorResponse(res, 500, "LINK_AUTHORIZATION_FAILED", "Could not start account linking.");
      } finally {
        client.release();
      }
    },
  );

  app.delete(
    `${LINK_BASE}/authorization`,
    requireAuth,
    browserRateLimit("journal-link-cancel-authorization", 10),
    async (req, res) => {
      if (!isEnabled()) return disabled(res);
      if (!browserMutationAllowed(req, res)) return;
      try {
        const role = await getAuthenticatedJournalRole(req, false);
        if (!role) return errorResponse(res, 404, "LINK_NOT_FOUND", "No account link was found.");
        await pool.query(
          `UPDATE product_link_authorizations
              SET revoked_at = NOW()
            WHERE journal_user_role_id = $1
              AND consumed_at IS NULL
              AND revoked_at IS NULL`,
          [role.id],
        );
        return res.status(204).end();
      } catch {
        return errorResponse(res, 500, "LINK_CANCEL_FAILED", "Could not cancel the linking request.");
      }
    },
  );

  app.post(
    `${LINK_BASE}/preview`,
    browserRateLimit("journal-link-preview", 30),
    async (req, res) => {
      if (!isEnabled()) return disabled(res);
      if (!serviceRequestAllowed(req, res)) return;
      if (
        !exactObjectKeys(req.body, ["contractVersion", "authorizationCode"]) ||
        req.body.contractVersion !== LINK_CONTRACT_VERSION ||
        typeof req.body.authorizationCode !== "string" ||
        !CODE_FORMAT.test(req.body.authorizationCode)
      ) {
        return errorResponse(res, 400, "INVALID_REQUEST", "A valid authorization code is required.");
      }
      try {
        const result = await pool.query<{
          journal_attempt_label: string;
          expires_at: Date;
        }>(
          `SELECT journal_attempt_label, expires_at
             FROM product_link_authorizations
            WHERE authorization_code_sha256 = $1
              AND consumed_at IS NULL
              AND revoked_at IS NULL
              AND expires_at > NOW()
            LIMIT 1`,
          [sha256(req.body.authorizationCode)],
        );
        if (!result.rows[0]) {
          return errorResponse(res, 409, "AUTHORIZATION_EXPIRED", "This linking request expired. Start a new request.");
        }
        return res.json({
          contractVersion: LINK_CONTRACT_VERSION,
          state: "awaiting_signals_consent",
          journalAttemptLabel: result.rows[0].journal_attempt_label,
          expiresAt: result.rows[0].expires_at.toISOString(),
        });
      } catch {
        return errorResponse(res, 500, "LINK_PREVIEW_FAILED", "Could not verify the linking request.");
      }
    },
  );

  app.post(
    `${LINK_BASE}/claim`,
    browserRateLimit("journal-link-claim", 30),
    async (req, res) => {
      if (!isEnabled()) return disabled(res);
      if (!serviceRequestAllowed(req, res)) return;
      if (
        !exactObjectKeys(req.body, ["contractVersion", "authorizationCode"]) ||
        req.body.contractVersion !== LINK_CONTRACT_VERSION ||
        typeof req.body.authorizationCode !== "string" ||
        !CODE_FORMAT.test(req.body.authorizationCode)
      ) {
        return errorResponse(res, 400, "INVALID_REQUEST", "A valid authorization code is required.");
      }
      const authorizationCode = req.body.authorizationCode as string;
      const codeDigest = sha256(authorizationCode);
      const assertion = verifySignalsAssertion(bearerToken(req), "claim");
      if (!assertion || !constantTimeHexEqual(assertion.codeSha256, codeDigest)) {
        return errorResponse(res, 401, "ASSERTION_INVALID", "Signals authorization could not be verified.");
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const replay = await client.query<{
          assertion_sha256: string;
          authorization_code_sha256: string | null;
          link_id: string;
        }>(
          `SELECT assertion_sha256, authorization_code_sha256, link_id
             FROM product_link_assertion_replays
            WHERE partner_issuer = $1 AND audience = $2
              AND assertion_jti = $3 AND action = 'claim'
            LIMIT 1
            FOR UPDATE`,
          [assertion.issuer, assertion.audience, assertion.jti],
        );
        if (replay.rows[0]) {
          const prior = replay.rows[0];
          if (
            !constantTimeHexEqual(prior.assertion_sha256, assertion.fingerprint) ||
            prior.authorization_code_sha256 !== codeDigest
          ) {
            await client.query("ROLLBACK");
            return errorResponse(res, 409, "REPLAY_CONFLICT", "This signed request was already used.");
          }
          const current = await client.query<LinkRow>(
            `SELECT id, journal_user_role_id, authorization_id, partner_issuer,
                    partner_subject, journal_attempt_label, signals_attempt_label,
                    state, expires_at, linked_at, revoked_at
               FROM product_account_links WHERE id = $1 LIMIT 1`,
            [prior.link_id],
          );
          if (!current.rows[0]) {
            await client.query("ROLLBACK");
            return errorResponse(res, 409, "REPLAY_CONFLICT", "This signed request was already used.");
          }
          const currentState = normalizedLinkState(current.rows[0]);
          if (currentState === "expired" && current.rows[0].state !== "expired") {
            await client.query(
              `UPDATE product_account_links SET state = 'expired', partner_subject = NULL
                WHERE id = $1 AND state = 'awaiting_journal_confirmation'`,
              [prior.link_id],
            );
          }
          await client.query("COMMIT");
          return res.status(200).json({
            contractVersion: LINK_CONTRACT_VERSION,
            linkId: prior.link_id,
            state: currentState,
            signalsAttemptLabel: current.rows[0].signals_attempt_label,
            expiresAt: current.rows[0].expires_at.toISOString(),
          });
        }

        const authorizationResult = await client.query<{
          id: string;
          journal_user_role_id: number;
          journal_initiation_consent_version: string;
          journal_initiation_consent_at: Date;
          journal_attempt_label: string;
          expires_at: Date;
          role: string;
          email_verified: boolean;
        }>(
          `SELECT authorization.id, authorization.journal_user_role_id,
                  authorization.journal_initiation_consent_version,
                  authorization.journal_initiation_consent_at,
                  authorization.journal_attempt_label, authorization.expires_at,
                  user_role.role, user_role.email_verified
             FROM product_link_authorizations authorization
             JOIN user_role ON user_role.id = authorization.journal_user_role_id
            WHERE authorization.authorization_code_sha256 = $1
              AND authorization.consumed_at IS NULL
              AND authorization.revoked_at IS NULL
              AND authorization.expires_at > NOW()
            LIMIT 1
            FOR UPDATE OF authorization, user_role`,
          [codeDigest],
        );
        const authorization = authorizationResult.rows[0];
        if (!authorization) {
          await client.query("ROLLBACK");
          return errorResponse(res, 409, "AUTHORIZATION_EXPIRED", "This linking request expired. Start a new request.");
        }
        if (
          authorization.role === "DEACTIVATED" ||
          !authorization.email_verified ||
          !checkClaimAgainstAuthorization(assertion, authorization, authorizationCode)
        ) {
          await client.query("ROLLBACK");
          return errorResponse(res, 403, "ACCOUNT_MISMATCH", "The account pairing could not be verified.");
        }

        await client.query(
          `UPDATE product_account_links
              SET state = 'cancelled', partner_subject = NULL
            WHERE journal_user_role_id = $1
              AND partner_issuer = $2
              AND state = 'awaiting_journal_confirmation'
              AND expires_at <= NOW()`,
          [authorization.journal_user_role_id, SIGNALS_DEV_ISSUER],
        );
        await client.query(
          `UPDATE product_link_authorizations SET consumed_at = NOW() WHERE id = $1`,
          [authorization.id],
        );
        const linkId = randomUUID();
        await client.query(
          `INSERT INTO product_account_links
             (id, journal_user_role_id, authorization_id, partner_issuer, partner_subject,
              journal_attempt_label, signals_attempt_label,
              journal_initiation_consent_version, journal_initiation_consent_at,
              signals_consent_version, signals_consent_at, state, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                   'awaiting_journal_confirmation', $12)`,
          [
            linkId,
            authorization.journal_user_role_id,
            authorization.id,
            SIGNALS_DEV_ISSUER,
            assertion.subject,
            authorization.journal_attempt_label,
            assertion.signalsAttemptLabel,
            authorization.journal_initiation_consent_version,
            authorization.journal_initiation_consent_at,
            assertion.consentVersion,
            new Date(assertion.consentAt * 1000),
            authorization.expires_at,
          ],
        );
        await saveReplay(client, assertion, linkId, codeDigest);
        await client.query("COMMIT");
        return res.status(201).json({
          contractVersion: LINK_CONTRACT_VERSION,
          linkId,
          state: "awaiting_journal_confirmation",
          signalsAttemptLabel: assertion.signalsAttemptLabel,
          expiresAt: authorization.expires_at.toISOString(),
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if ((error as { code?: string })?.code === "23505") {
          return errorResponse(res, 409, "LINK_EXISTS", "One of these product accounts is already linked.");
        }
        return errorResponse(res, 500, "LINK_CLAIM_FAILED", "Could not complete the account-link request.");
      } finally {
        client.release();
      }
    },
  );

  app.post(
    `${LINK_BASE}/confirm`,
    requireAuth,
    browserRateLimit("journal-link-confirm", 10),
    async (req, res) => {
      if (!isEnabled()) return disabled(res);
      if (!browserMutationAllowed(req, res)) return;
      if (
        !exactObjectKeys(req.body, ["contractVersion", "linkId", "consent", "consentVersion"]) ||
        req.body.contractVersion !== LINK_CONTRACT_VERSION ||
        !isUuid(req.body.linkId) ||
        req.body.consent !== true ||
        req.body.consentVersion !== JOURNAL_CONFIRMATION_CONSENT_VERSION
      ) {
        return errorResponse(res, 400, "CONSENT_REQUIRED", "Final Journal consent is required.");
      }
      try {
        const role = await getAuthenticatedJournalRole(req, true);
        if (!role) return errorResponse(res, 401, "AUTHENTICATION_REQUIRED", "Verified Journal sign-in is required.");
        const result = await pool.query<LinkRow>(
          `UPDATE product_account_links
              SET state = 'active',
                  linked_at = NOW(),
                  journal_confirmation_consent_version = $1,
                  journal_confirmation_consent_at = NOW()
            WHERE id = $2
              AND journal_user_role_id = $3
              AND state = 'awaiting_journal_confirmation'
              AND expires_at > NOW()
            RETURNING id, journal_user_role_id, authorization_id, partner_issuer,
                      partner_subject, journal_attempt_label, signals_attempt_label,
                      state, expires_at, linked_at, revoked_at`,
          [JOURNAL_CONFIRMATION_CONSENT_VERSION, req.body.linkId, role.id],
        );
        if (!result.rows[0]) {
          const expired = await pool.query(
            `UPDATE product_account_links
                SET state = 'expired', partner_subject = NULL
              WHERE id = $1 AND journal_user_role_id = $2
                AND state = 'awaiting_journal_confirmation' AND expires_at <= NOW()`,
            [req.body.linkId, role.id],
          );
          if ((expired.rowCount ?? 0) > 0) {
            return errorResponse(res, 409, "AUTHORIZATION_EXPIRED", "This linking request expired. Start a new request.");
          }
          return errorResponse(res, 404, "LINK_NOT_FOUND", "The pending account link was not found.");
        }
        return res.json({
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: result.rows[0].id,
          state: "active",
          linkedAt: result.rows[0].linked_at?.toISOString(),
        });
      } catch {
        return errorResponse(res, 500, "LINK_CONFIRM_FAILED", "Could not confirm the account link.");
      }
    },
  );

  app.delete(
    `${LINK_BASE}/:linkId`,
    requireAuth,
    browserRateLimit("journal-link-unlink", 10),
    async (req, res) => {
      if (!isEnabled()) return disabled(res);
      if (!browserMutationAllowed(req, res)) return;
      if (!isUuid(req.params.linkId)) {
        return errorResponse(res, 400, "INVALID_REQUEST", "A valid link identifier is required.");
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const role = await getAuthenticatedJournalRole(req, false);
        if (!role) {
          await client.query("ROLLBACK");
          return errorResponse(res, 404, "LINK_NOT_FOUND", "The account link was not found.");
        }
        const selected = await client.query<{
          id: string;
          partner_issuer: string;
          state: LinkState;
        }>(
          `SELECT id, partner_issuer, state
             FROM product_account_links
            WHERE id = $1 AND journal_user_role_id = $2
            LIMIT 1 FOR UPDATE`,
          [req.params.linkId, role.id],
        );
        const link = selected.rows[0];
        if (!link) {
          await client.query("ROLLBACK");
          return errorResponse(res, 404, "LINK_NOT_FOUND", "The account link was not found.");
        }
        if (link.state === "revocation_pending") {
          const event = await client.query<{ event_id: string }>(
            `SELECT event_id FROM product_link_revocation_outbox
              WHERE link_id = $1 AND partner_issuer = $2
                AND reason = 'user_unlinked' AND state IN ('pending', 'retry')
              ORDER BY created_at DESC LIMIT 1`,
            [link.id, link.partner_issuer],
          );
          await client.query("COMMIT");
          return res.status(202).json({
            contractVersion: LINK_CONTRACT_VERSION,
            linkId: link.id,
            state: "revocation_pending",
            eventId: event.rows[0]?.event_id,
          });
        }
        if (!["active", "awaiting_journal_confirmation"].includes(link.state)) {
          await client.query("ROLLBACK");
          return errorResponse(res, 409, "LINK_NOT_ACTIVE", "This account link cannot be disconnected again.");
        }
        const eventId = await createRevocationOutboxEvent(
          client,
          link.id,
          link.partner_issuer,
          "user_unlinked",
        );
        await client.query(
          `UPDATE product_account_links
              SET state = 'revocation_pending', revoked_at = NULL
            WHERE id = $1`,
          [link.id],
        );
        await client.query("COMMIT");
        return res.status(202).json({
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: link.id,
          state: "revocation_pending",
          eventId,
        });
      } catch {
        await client.query("ROLLBACK").catch(() => undefined);
        return errorResponse(res, 500, "LINK_UNLINK_FAILED", "Could not disconnect the account link.");
      } finally {
        client.release();
      }
    },
  );

  app.post(
    `${LINK_BASE}/status`,
    browserRateLimit("signals-link-status", 60),
    async (req, res) => {
      if (!isEnabled()) return disabled(res);
      if (!serviceRequestAllowed(req, res)) return;
      if (
        !exactObjectKeys(req.body, ["contractVersion", "linkId"]) ||
        req.body.contractVersion !== LINK_CONTRACT_VERSION ||
        !isUuid(req.body.linkId)
      ) {
        return errorResponse(res, 400, "INVALID_REQUEST", "A valid account-link status request is required.");
      }
      const assertion = verifySignalsAssertion(bearerToken(req), "status");
      if (!assertion || assertion.linkId !== req.body.linkId) {
        return errorResponse(res, 401, "ASSERTION_INVALID", "The service request could not be verified.");
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existingReplay = await client.query(
          `SELECT 1 FROM product_link_assertion_replays
            WHERE partner_issuer = $1 AND audience = $2 AND assertion_jti = $3`,
          [assertion.issuer, assertion.audience, assertion.jti],
        );
        if (existingReplay.rows[0]) {
          await client.query("ROLLBACK");
          return errorResponse(res, 409, "REPLAY_CONFLICT", "This signed request was already used.");
        }
        const linkResult = await client.query<LinkRow>(
          `SELECT id, journal_user_role_id, authorization_id, partner_issuer,
                  partner_subject, journal_attempt_label, signals_attempt_label,
                  state, expires_at, linked_at, revoked_at
             FROM product_account_links
            WHERE id = $1 AND partner_issuer = $2 AND partner_subject = $3
            LIMIT 1 FOR UPDATE`,
          [assertion.linkId, assertion.issuer, assertion.subject],
        );
        if (!linkResult.rows[0]) {
          await client.query("ROLLBACK");
          return errorResponse(res, 404, "LINK_NOT_FOUND", "The account link was not found.");
        }
        const link = linkResult.rows[0];
        let state = normalizedLinkState(link);
        if (state === "expired" && link.state !== "expired") {
          await client.query(
            `UPDATE product_account_links SET state = 'expired', partner_subject = NULL
              WHERE id = $1`,
            [link.id],
          );
        }
        await saveReplay(client, assertion, link.id, null);
        await client.query("COMMIT");
        const response: Record<string, unknown> = {
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: link.id,
          state,
        };
        if (state === "active" && link.linked_at) response.linkedAt = link.linked_at.toISOString();
        if (state === "awaiting_journal_confirmation" || state === "revocation_pending") {
          response.expiresAt = link.expires_at.toISOString();
        }
        return res.json(response);
      } catch {
        await client.query("ROLLBACK").catch(() => undefined);
        return errorResponse(res, 500, "LINK_STATUS_FAILED", "Could not read account-link status.");
      } finally {
        client.release();
      }
    },
  );

  app.post(
    `${LINK_BASE}/revocations`,
    browserRateLimit("signals-link-revocation", 30),
    async (req, res) => {
      if (!isEnabled()) return disabled(res);
      if (!serviceRequestAllowed(req, res)) return;
      if (
        !exactObjectKeys(req.body, ["contractVersion", "linkId", "eventId", "reason"]) ||
        req.body.contractVersion !== LINK_CONTRACT_VERSION ||
        !isUuid(req.body.linkId) ||
        !isUuid(req.body.eventId) ||
        !isRevocationReason(req.body.reason)
      ) {
        return errorResponse(res, 400, "INVALID_REQUEST", "A valid revocation event is required.");
      }
      const assertion = verifySignalsAssertion(bearerToken(req), "revoke");
      if (
        !assertion ||
        assertion.linkId !== req.body.linkId ||
        assertion.eventId !== req.body.eventId ||
        assertion.reason !== req.body.reason
      ) {
        return errorResponse(res, 401, "ASSERTION_INVALID", "The revocation could not be verified.");
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const replay = await client.query<{
          assertion_sha256: string;
          link_id: string;
          action: string;
        }>(
          `SELECT assertion_sha256, link_id, action
             FROM product_link_assertion_replays
            WHERE partner_issuer = $1 AND audience = $2 AND assertion_jti = $3
            LIMIT 1 FOR UPDATE`,
          [assertion.issuer, assertion.audience, assertion.jti],
        );
        if (
          replay.rows[0] &&
          (
            replay.rows[0].action !== "revoke" ||
            replay.rows[0].link_id !== assertion.linkId ||
            !constantTimeHexEqual(replay.rows[0].assertion_sha256, assertion.fingerprint)
          )
        ) {
          await client.query("ROLLBACK");
          return errorResponse(res, 409, "REPLAY_CONFLICT", "This signed request was already used.");
        }

        const prior = await client.query<{ link_id: string; reason: RevocationReason }>(
          `SELECT link_id, reason
             FROM product_link_revocation_inbox
            WHERE partner_issuer = $1 AND event_id = $2
            LIMIT 1 FOR UPDATE`,
          [assertion.issuer, assertion.eventId],
        );
        if (prior.rows[0]) {
          if (
            prior.rows[0].link_id !== assertion.linkId ||
            prior.rows[0].reason !== assertion.reason
          ) {
            await client.query("ROLLBACK");
            return errorResponse(res, 409, "REPLAY_CONFLICT", "This revocation event was already used.");
          }
          if (!replay.rows[0]) await saveReplay(client, assertion, assertion.linkId, null);
          await client.query("COMMIT");
          return res.json({
            contractVersion: LINK_CONTRACT_VERSION,
            linkId: assertion.linkId,
            state: "revoked",
            eventId: assertion.eventId,
          });
        }

        const linkResult = await client.query<{
          id: string;
          state: LinkState;
        }>(
          `SELECT id, state
             FROM product_account_links
            WHERE id = $1 AND partner_issuer = $2
            LIMIT 1 FOR UPDATE`,
          [assertion.linkId, assertion.issuer],
        );
        const tombstone = await client.query(
          `SELECT 1 FROM product_link_tombstones
            WHERE link_id = $1 AND partner_issuer = $2 LIMIT 1`,
          [assertion.linkId, assertion.issuer],
        );
        if (!linkResult.rows[0] && !tombstone.rows[0]) {
          await client.query("ROLLBACK");
          return errorResponse(res, 404, "LINK_NOT_FOUND", "The account link was not found.");
        }
        await client.query(
          `INSERT INTO product_link_revocation_inbox
             (partner_issuer, event_id, link_id, reason, assertion_sha256)
           VALUES ($1, $2, $3, $4, $5)`,
          [assertion.issuer, assertion.eventId, assertion.linkId, assertion.reason, assertion.fingerprint],
        );
        if (linkResult.rows[0]) {
          await client.query(
            `UPDATE product_account_links
                SET state = 'revoked', partner_subject = NULL, revoked_at = NOW()
              WHERE id = $1`,
            [assertion.linkId],
          );
        }
        await client.query(
          `INSERT INTO product_link_tombstones (link_id, partner_issuer, event_id, reason)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (link_id) DO UPDATE SET
             partner_issuer = EXCLUDED.partner_issuer,
             event_id = EXCLUDED.event_id,
             reason = EXCLUDED.reason,
             tombstoned_at = NOW()`,
          [assertion.linkId, assertion.issuer, assertion.eventId, assertion.reason],
        );
        await saveReplay(client, assertion, assertion.linkId, null);
        await client.query("COMMIT");
        return res.json({
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: assertion.linkId,
          state: "revoked",
          eventId: assertion.eventId,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if ((error as { code?: string })?.code === "23505") {
          return errorResponse(res, 409, "REPLAY_CONFLICT", "This revocation event was already used.");
        }
        return errorResponse(res, 500, "LINK_REVOCATION_FAILED", "Could not apply the revocation.");
      } finally {
        client.release();
      }
    },
  );
}

/**
 * Before deactivation or deletion, disable every open link and durably queue
 * an event. For deletion, only a pseudonymous link tombstone and outbox event
 * survive; no local account ID, email, subject, or raw JWT is retained.
 *
 * This is safe to call before the V1 migration is installed: an absent schema
 * means no V1 links can exist yet, so lifecycle behavior remains unchanged.
 */
export async function prepareProductLinkAccountLifecycle(
  journalUserRoleId: number,
  reason: "account_deleted" | "account_suspended",
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!(await ensureSchemaAvailable(client))) {
      await client.query("ROLLBACK");
      return;
    }
    const links = await client.query<{
      id: string;
      partner_issuer: string;
      state: LinkState;
    }>(
      `SELECT id, partner_issuer, state
         FROM product_account_links
        WHERE journal_user_role_id = $1
          AND state IN ('awaiting_journal_confirmation', 'active', 'revocation_pending')
        FOR UPDATE`,
      [journalUserRoleId],
    );
    for (const link of links.rows) {
      const eventId = await createRevocationOutboxEvent(client, link.id, link.partner_issuer, reason);
      await client.query(
        `INSERT INTO product_link_tombstones (link_id, partner_issuer, event_id, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (link_id) DO UPDATE SET
           partner_issuer = EXCLUDED.partner_issuer,
           event_id = EXCLUDED.event_id,
           reason = EXCLUDED.reason,
           tombstoned_at = NOW()`,
        [link.id, link.partner_issuer, eventId, reason],
      );
      if (reason === "account_deleted") {
        await client.query("DELETE FROM product_account_links WHERE id = $1", [link.id]);
      } else {
        await client.query(
          `UPDATE product_account_links
              SET state = 'revocation_pending', revoked_at = NULL
            WHERE id = $1`,
          [link.id],
        );
      }
    }
    if (reason === "account_deleted") {
      await client.query(
        `DELETE FROM product_link_authorizations
          WHERE journal_user_role_id = $1`,
        [journalUserRoleId],
      );
    } else {
      await client.query(
        `UPDATE product_link_authorizations
            SET revoked_at = NOW()
          WHERE journal_user_role_id = $1
            AND consumed_at IS NULL
            AND revoked_at IS NULL`,
        [journalUserRoleId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
