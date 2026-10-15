import { createHash, createPublicKey, randomBytes, randomUUID, verify } from "node:crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import { pool } from "./db";

export const PRODUCT_LINK_CONSENT_VERSION = "tradify-account-linking-v1";
const ASSERTION_AUDIENCE = "tradify-journal-link-v1";
const AUTHORIZATION_LIFETIME_MS = 5 * 60 * 1000;
const MAX_ASSERTION_LIFETIME_SECONDS = 120;
const LINK_BASE = "/api/v1/product-links/signals";

type LinkingConfig = {
  issuer: string;
  keyId: string;
  publicKey: ReturnType<typeof createPublicKey>;
};

type SignalsAssertion = {
  iss: string;
  aud: string | string[];
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  consent: boolean;
  consent_at: number;
  consent_version: string;
  code_sha256: string;
};

function getLinkingConfig(): LinkingConfig | null {
  const featureEnabled = process.env.NODE_ENV === "production"
    ? process.env.PRODUCT_LINKING_ENABLED === "true" &&
      process.env.PRODUCT_LINKING_VERIFIED === "true"
    : process.env.DEV_PRODUCT_LINKING_ENABLED === "true";
  if (!featureEnabled) return null;

  const issuer = process.env.TRADIFY_SIGNALS_ISSUER?.trim();
  const keyId = process.env.TRADIFY_SIGNALS_KEY_ID?.trim();
  const publicKeyPem = process.env.TRADIFY_SIGNALS_PUBLIC_KEY?.replace(/\\n/g, "\n").trim();
  if (!issuer || !keyId || !publicKeyPem) return null;

  try {
    const parsedIssuer = new URL(issuer);
    if (parsedIssuer.protocol !== "https:" || parsedIssuer.toString().replace(/\/$/, "") !== issuer.replace(/\/$/, "")) {
      return null;
    }
    return { issuer, keyId, publicKey: createPublicKey(publicKeyPem) };
  } catch {
    return null;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function decodeJsonPart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

function verifySignalsAssertion(
  token: string | undefined,
  config: LinkingConfig,
  authorizationCode: string,
): SignalsAssertion | null {
  if (!token || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const header = decodeJsonPart<{ alg?: string; typ?: string; kid?: string }>(parts[0]);
    const claims = decodeJsonPart<SignalsAssertion>(parts[1]);
    if (header.alg !== "RS256" || header.typ !== "JWT" || header.kid !== config.keyId) return null;
    const signature = Buffer.from(parts[2], "base64url");
    const validSignature = verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`, "utf8"),
      config.publicKey,
      signature,
    );
    if (!validSignature) return null;

    const now = Math.floor(Date.now() / 1000);
    const audMatches = claims.aud === ASSERTION_AUDIENCE ||
      (Array.isArray(claims.aud) && claims.aud.includes(ASSERTION_AUDIENCE));
    if (
      claims.iss !== config.issuer ||
      !audMatches ||
      typeof claims.sub !== "string" ||
      claims.sub.length < 1 ||
      claims.sub.length > 255 ||
      claims.sub.includes("@") ||
      !Number.isInteger(claims.iat) ||
      !Number.isInteger(claims.exp) ||
      claims.iat > now + 30 ||
      claims.iat < now - MAX_ASSERTION_LIFETIME_SECONDS ||
      claims.exp <= now ||
      claims.exp - claims.iat > MAX_ASSERTION_LIFETIME_SECONDS ||
      typeof claims.jti !== "string" ||
      !/^[A-Za-z0-9._~-]{16,128}$/.test(claims.jti) ||
      claims.consent !== true ||
      !Number.isInteger(claims.consent_at) ||
      claims.consent_at > now + 30 ||
      claims.consent_at < now - MAX_ASSERTION_LIFETIME_SECONDS ||
      claims.consent_at > claims.iat + 30 ||
      claims.consent_version !== PRODUCT_LINK_CONSENT_VERSION ||
      claims.code_sha256 !== sha256(authorizationCode)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

function disabled(res: Response) {
  return res.status(503).json({ message: "Tradify Signals account linking is not enabled." });
}

export function registerProductLinkingRoutes(app: Express, requireAuth: RequestHandler): void {
  app.get(`${LINK_BASE}`, requireAuth, async (req: Request, res: Response) => {
    const config = getLinkingConfig();
    if (!config) return disabled(res);
    try {
      const result = await pool.query<{ linked_at: Date }>(
        `SELECT link.linked_at
         FROM product_account_links link
         JOIN user_role journal_user ON journal_user.id = link.journal_user_role_id
         WHERE journal_user.user_id = $1
           AND link.partner_issuer = $2
           AND link.revoked_at IS NULL
         LIMIT 1`,
        [req.session.userId, config.issuer],
      );
      const link = result.rows[0];
      if (!link) return res.json({ linked: false });
      return res.json({ linked: true, linkedAt: link.linked_at });
    } catch {
      return res.status(500).json({ message: "Could not read account-link status." });
    }
  });

  app.post(`${LINK_BASE}/authorization`, requireAuth, async (req: Request, res: Response) => {
    const config = getLinkingConfig();
    if (!config) return disabled(res);
    if (
      req.body?.consent !== true ||
      req.body?.consentVersion !== PRODUCT_LINK_CONSENT_VERSION
    ) {
      return res.status(400).json({ message: "Explicit Journal account-linking consent is required." });
    }

    try {
      const id = randomUUID();
      const authorizationCode = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + AUTHORIZATION_LIFETIME_MS);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const account = await client.query<{ id: number }>(
          `SELECT id
           FROM user_role
           WHERE user_id = $1 AND email_verified = TRUE
           LIMIT 1
           FOR SHARE`,
          [req.session.userId],
        );
        if (!account.rows[0]) {
          await client.query("ROLLBACK");
          return res.status(401).json({ message: "Verified Journal sign-in is required." });
        }
        const journalUserRoleId = account.rows[0].id;
        await client.query(
          `UPDATE product_link_authorizations
           SET revoked_at = NOW()
           WHERE journal_user_role_id = $1
             AND consumed_at IS NULL
             AND revoked_at IS NULL`,
          [journalUserRoleId],
        );
        await client.query(
          `INSERT INTO product_link_authorizations
             (id, journal_user_role_id, authorization_code_sha256, consent_version, journal_consent_at, created_at, expires_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)`,
          [id, journalUserRoleId, sha256(authorizationCode), PRODUCT_LINK_CONSENT_VERSION, expiresAt],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return res.status(201).json({
        authorizationCode,
        expiresAt: expiresAt.toISOString(),
        consentVersion: PRODUCT_LINK_CONSENT_VERSION,
      });
    } catch {
      return res.status(500).json({ message: "Could not create an account-link authorization." });
    }
  });

  app.post(`${LINK_BASE}/claim`, async (req: Request, res: Response) => {
    const config = getLinkingConfig();
    if (!config) return disabled(res);
    const authorizationCode = req.body?.authorizationCode;
    if (typeof authorizationCode !== "string" || !/^[a-f0-9]{64}$/.test(authorizationCode)) {
      return res.status(400).json({ message: "A valid authorization code is required." });
    }

    const codeDigest = sha256(authorizationCode);
    const bearer = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const assertion = verifySignalsAssertion(bearer, config, authorizationCode);
    if (!assertion) return res.status(401).json({ message: "Signals authorization could not be verified." });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const replay = await client.query<{
        code_sha256: string;
        link_id: string;
        partner_subject: string;
        linked_at: Date;
      }>(
        `SELECT replay.authorization_code_sha256 AS code_sha256,
                replay.link_id,
                link.partner_subject,
                link.linked_at
         FROM product_link_assertion_replays replay
         JOIN product_account_links link ON link.id = replay.link_id
         WHERE replay.partner_issuer = $1 AND replay.assertion_jti = $2
         LIMIT 1`,
        [config.issuer, assertion.jti],
      );
      if (replay.rows[0]) {
        const prior = replay.rows[0];
        if (prior.code_sha256 !== codeDigest || prior.partner_subject !== assertion.sub) {
          await client.query("ROLLBACK");
          return res.status(409).json({ message: "This Signals assertion was already used." });
        }
        await client.query("COMMIT");
        return res.json({ linkId: prior.link_id, status: "linked", linkedAt: prior.linked_at });
      }

      const authorization = await client.query<{
        id: string;
        journal_user_role_id: number;
        consent_version: string;
        journal_consent_at: Date;
      }>(
        `UPDATE product_link_authorizations
         SET consumed_at = NOW()
         WHERE authorization_code_sha256 = $1
           AND consumed_at IS NULL
           AND revoked_at IS NULL
           AND expires_at > NOW()
         RETURNING id, journal_user_role_id, consent_version, journal_consent_at`,
        [codeDigest],
      );
      if (!authorization.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "This authorization code is expired, revoked, or already used." });
      }
      const request = authorization.rows[0];
      const linkId = randomUUID();
      const linked = await client.query<{ id: string; linked_at: Date }>(
        `INSERT INTO product_account_links
           (id, journal_user_role_id, partner_issuer, partner_subject, consent_version,
            journal_consent_at, partner_consent_at, linked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id, linked_at`,
        [
          linkId,
          request.journal_user_role_id,
          config.issuer,
          assertion.sub,
          request.consent_version,
          request.journal_consent_at,
          new Date(assertion.consent_at * 1000),
        ],
      );
      await client.query(
        `INSERT INTO product_link_assertion_replays
           (partner_issuer, assertion_jti, authorization_id, authorization_code_sha256, link_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [config.issuer, assertion.jti, request.id, codeDigest, linkId],
      );
      await client.query("COMMIT");
      return res.status(201).json({
        linkId: linked.rows[0].id,
        status: "linked",
        linkedAt: linked.rows[0].linked_at,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string })?.code === "23505") {
        return res.status(409).json({ message: "One of these product accounts is already linked." });
      }
      return res.status(500).json({ message: "Could not complete the account link." });
    } finally {
      client.release();
    }
  });
}
