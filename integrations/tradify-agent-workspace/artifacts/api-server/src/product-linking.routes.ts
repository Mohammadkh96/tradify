import crypto from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  tradifyLinkAttempts,
  tradifyLinkConsents,
  tradifyLinkRevocationOutbox,
  tradifyProductLinks,
  tradifyUsers,
} from "@workspace/db";
import {
  authorizationCodeHash,
  createAttemptId,
  JOURNAL_INITIATION_CONSENT,
  JOURNAL_ISSUER,
  getOrCreateSignalsSubject,
  journalPost,
  LINK_CONTRACT,
  canonicalRevocationPayload,
  linkingConfigurationReady,
  linkingEnabled,
  makeSignalsAssertion,
  newSignalsAttemptLabel,
  recordJournalRevocation,
  revocationPayloadHash,
  SIGNALS_CONSENT,
} from "./product-linking";

type User = { id: string };
type Dependencies = {
  requireUser: RequestHandler;
  requestUser: (req: Request) => User;
  requestIsSameOrigin: (req: Request) => boolean;
};

const CODE_PATTERN = /^[a-f0-9]{64}$/;
const LABEL_PATTERN = /^(?:JRN|SIG)-[A-Z2-7]{12}$/;
const LINK_ID_PATTERN = /^[0-9a-f-]{36}$/i;

function objectBody(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function hasOnly(body: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(body).every((key) => allowed.includes(key));
}

function unwrap(value: Record<string, unknown>): Record<string, unknown> {
  const data = value.data;
  return data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : value;
}

function noStore(res: import("express").Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function error(res: import("express").Response, status: number, code: string, message: string): void {
  noStore(res);
  res.status(status).json({ error: { code, message } });
}

function allowedAndReady(res: import("express").Response): boolean {
  if (!linkingEnabled()) {
    error(res, 503, "LINKING_DISABLED", "Account linking is unavailable.");
    return false;
  }
  if (!linkingConfigurationReady()) {
    error(res, 503, "LINKING_DISABLED", "Account linking is unavailable.");
    return false;
  }
  return true;
}

function sameOrigin(res: import("express").Response, req: Request, check: Dependencies["requestIsSameOrigin"]): boolean {
  if (check(req)) return true;
  error(res, 403, "CSRF_ORIGIN_FAILED", "The request could not be verified.");
  return false;
}

export function createProductLinkingRouter(deps: Dependencies) {
  const router = Router();

  router.post("/product-links/journal/preview", deps.requireUser, async (req, res) => {
    noStore(res);
    if (!sameOrigin(res, req, deps.requestIsSameOrigin) || !allowedAndReady(res)) return;
    const body = objectBody(req.body);
    if (!body || !hasOnly(body, ["contractVersion", "authorizationCode"]) ||
        body.contractVersion !== LINK_CONTRACT ||
        typeof body.authorizationCode !== "string" || !CODE_PATTERN.test(body.authorizationCode)) {
      error(res, 400, "INVALID_REQUEST", "Enter a valid linking code.");
      return;
    }
    try {
      const codeHash = authorizationCodeHash(body.authorizationCode);
      const localAccount = (await db.select({ name: tradifyUsers.name })
        .from(tradifyUsers).where(eq(tradifyUsers.id, deps.requestUser(req).id)).limit(1))[0];
      if (!localAccount) throw new Error("LINK_STORAGE_UNAVAILABLE");
      const existing = (await db.select().from(tradifyLinkAttempts)
        .where(and(eq(tradifyLinkAttempts.userId, deps.requestUser(req).id), eq(tradifyLinkAttempts.codeHash, codeHash)))
        .limit(1))[0];
      if (existing) {
        if (existing.expiresAt.getTime() <= Date.now() || existing.state === "EXPIRED") {
          error(res, 409, "AUTHORIZATION_EXPIRED", "This linking request expired. Start a new request.");
          return;
        }
        res.json({
          contractVersion: LINK_CONTRACT,
          state: "awaiting_signals_consent",
          accountLabel: localAccount.name,
          journalAttemptLabel: existing.journalAttemptLabel,
          signalsAttemptLabel: existing.signalsAttemptLabel,
          expiresAt: existing.expiresAt.toISOString(),
        });
        return;
      }
      const response = unwrap(await journalPost("/api/v1/product-links/signals/preview", {
        contractVersion: LINK_CONTRACT,
        authorizationCode: body.authorizationCode,
      }));
      if (
        response.contractVersion !== LINK_CONTRACT ||
        response.state !== "awaiting_signals_consent" ||
        typeof response.journalAttemptLabel !== "string" ||
        !LABEL_PATTERN.test(response.journalAttemptLabel) ||
        typeof response.expiresAt !== "string"
      ) throw new Error("PARTNER_UNAVAILABLE");
      const expiresAt = new Date(response.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() ||
          expiresAt.getTime() > Date.now() + 5 * 60_000) {
        throw new Error("PARTNER_UNAVAILABLE");
      }
      const signalsAttemptLabel = newSignalsAttemptLabel();
      await db.insert(tradifyLinkAttempts).values({
        id: createAttemptId(),
        userId: deps.requestUser(req).id,
        codeHash,
        journalAttemptLabel: response.journalAttemptLabel,
        signalsAttemptLabel,
        expiresAt,
      });
      res.json({
        contractVersion: LINK_CONTRACT,
        state: "awaiting_signals_consent",
        accountLabel: localAccount.name,
        journalAttemptLabel: response.journalAttemptLabel,
        signalsAttemptLabel,
        expiresAt: expiresAt.toISOString(),
      });
    } catch {
      error(res, 503, "PARTNER_UNAVAILABLE", "The linking service is unavailable.");
    }
  });

  router.post("/product-links/journal/claim", deps.requireUser, async (req, res) => {
    noStore(res);
    if (!sameOrigin(res, req, deps.requestIsSameOrigin) || !allowedAndReady(res)) return;
    const body = objectBody(req.body);
    if (!body || !hasOnly(body, ["contractVersion", "authorizationCode", "consent", "consentVersion"]) ||
        body.contractVersion !== LINK_CONTRACT ||
        typeof body.authorizationCode !== "string" || !CODE_PATTERN.test(body.authorizationCode) ||
        body.consent !== true || body.consentVersion !== SIGNALS_CONSENT) {
      error(res, 400, "CONSENT_REQUIRED", "Confirm the account pairing to continue.");
      return;
    }
    try {
      const user = deps.requestUser(req);
      const codeHash = authorizationCodeHash(body.authorizationCode);
      const attempt = (await db.select().from(tradifyLinkAttempts)
        .where(and(eq(tradifyLinkAttempts.userId, user.id), eq(tradifyLinkAttempts.codeHash, codeHash)))
        .limit(1))[0];
      if (!attempt || attempt.expiresAt.getTime() <= Date.now()) {
        error(res, 409, "AUTHORIZATION_EXPIRED", "This linking request expired. Start a new request.");
        return;
      }
      if (attempt.partnerLinkId) {
        const linked = (await db.select().from(tradifyProductLinks)
          .where(eq(tradifyProductLinks.linkId, attempt.partnerLinkId)).limit(1))[0];
        if (linked) {
          res.json({
            contractVersion: LINK_CONTRACT,
            state: linked.state,
            signalsAttemptLabel: linked.signalsAttemptLabel,
            expiresAt: linked.expiresAt?.toISOString() ?? attempt.expiresAt.toISOString(),
          });
          return;
        }
      }
      const current = await db.select().from(tradifyProductLinks)
        .where(and(eq(tradifyProductLinks.userId, user.id), eq(tradifyProductLinks.state, "active")))
        .limit(1);
      if (current.length) {
        error(res, 409, "LINK_EXISTS", "This account already has a linked account.");
        return;
      }

      const consentAt = attempt.consentAt ?? new Date();
      const consentId = attempt.consentId ?? crypto.randomUUID();
      const claimJti = attempt.claimJti ?? crypto.randomBytes(18).toString("base64url");
      const claimIssuedAt = attempt.claimIssuedAt ?? new Date(Math.floor(Date.now() / 1000) * 1000);
      const subject = await getOrCreateSignalsSubject(user.id);
      await db.transaction(async (tx) => {
        if (!attempt.consentId) {
          await tx.insert(tradifyLinkConsents).values({
            id: consentId,
            userId: user.id,
            attemptId: attempt.id,
            contractVersion: LINK_CONTRACT,
            consentVersion: SIGNALS_CONSENT,
            consentAt,
            journalAttemptLabel: attempt.journalAttemptLabel,
            signalsAttemptLabel: attempt.signalsAttemptLabel,
          }).onConflictDoNothing();
        }
        await tx.update(tradifyLinkAttempts).set({
          state: "CONSENTED",
          consentId,
          consentAt,
          claimJti,
          claimIssuedAt,
        }).where(eq(tradifyLinkAttempts.id, attempt.id));
      });

      const assertion = makeSignalsAssertion({
        sub: subject,
        action: "claim",
        consent: true,
        consent_at: Math.floor(consentAt.getTime() / 1000),
        consent_version: SIGNALS_CONSENT,
        journal_initiation_consent_version: JOURNAL_INITIATION_CONSENT,
        journal_attempt_label: attempt.journalAttemptLabel,
        signals_attempt_label: attempt.signalsAttemptLabel,
        code_sha256: codeHash,
      }, Math.floor(claimIssuedAt.getTime() / 1000), claimJti);
      const response = unwrap(await journalPost("/api/v1/product-links/signals/claim", {
        contractVersion: LINK_CONTRACT,
        authorizationCode: body.authorizationCode,
      }, assertion.token));
      if (
        response.contractVersion !== LINK_CONTRACT ||
        response.state !== "awaiting_journal_confirmation" ||
        typeof response.linkId !== "string" ||
        !LINK_ID_PATTERN.test(response.linkId) ||
        response.signalsAttemptLabel !== attempt.signalsAttemptLabel ||
        response.expiresAt !== attempt.expiresAt.toISOString()
      ) throw new Error("PARTNER_UNAVAILABLE");

      await db.transaction(async (tx) => {
        await tx.insert(tradifyProductLinks).values({
          linkId: response.linkId as string,
          userId: user.id,
          partnerIssuer: JOURNAL_ISSUER,
          signalsAttemptLabel: attempt.signalsAttemptLabel,
          journalAttemptLabel: attempt.journalAttemptLabel,
          state: "awaiting_journal_confirmation",
          expiresAt: attempt.expiresAt,
        }).onConflictDoNothing();
        await tx.update(tradifyLinkAttempts).set({
          state: "CLAIMED",
          partnerLinkId: response.linkId as string,
        }).where(eq(tradifyLinkAttempts.id, attempt.id));
      });
      res.json({
        contractVersion: LINK_CONTRACT,
        state: "awaiting_journal_confirmation",
        signalsAttemptLabel: attempt.signalsAttemptLabel,
        expiresAt: attempt.expiresAt.toISOString(),
      });
    } catch {
      error(res, 503, "PARTNER_UNAVAILABLE", "The linking service is unavailable.");
    }
  });

  router.get("/product-links/journal", deps.requireUser, async (req, res) => {
    noStore(res);
    if (!allowedAndReady(res)) return;
    try {
      const user = deps.requestUser(req);
      const link = (await db.select().from(tradifyProductLinks)
        .where(eq(tradifyProductLinks.userId, user.id))
        .orderBy(tradifyProductLinks.updatedAt)
        .limit(1))[0];
      if (!link || link.state === "revoked") {
        res.json({ state: "unlinked" });
        return;
      }
      if (link.state === "revocation_pending") {
        res.json({
          state: link.state,
          linkId: link.linkId,
          signalsAttemptLabel: link.signalsAttemptLabel,
        });
        return;
      }
      if (link.state === "awaiting_journal_confirmation") {
        if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
          await db.update(tradifyProductLinks).set({ state: "revoked", revokedAt: new Date(), updatedAt: new Date() })
            .where(eq(tradifyProductLinks.linkId, link.linkId));
          res.json({ state: "unlinked" });
          return;
        }
      }
      const subject = await getOrCreateSignalsSubject(user.id);
      const assertion = makeSignalsAssertion({
        sub: subject,
        action: "status",
        link_id: link.linkId,
      });
      const partner = unwrap(await journalPost("/api/v1/product-links/signals/status", {
        contractVersion: LINK_CONTRACT,
        linkId: link.linkId,
      }, assertion.token));
      if (
        partner.linkId !== link.linkId ||
        !["active", "revoked", "awaiting_journal_confirmation"].includes(String(partner.state))
      ) {
        throw new Error("PARTNER_UNAVAILABLE");
      }
      if (partner.state === "awaiting_journal_confirmation") {
        if (link.state !== "awaiting_journal_confirmation") {
          throw new Error("PARTNER_UNAVAILABLE");
        }
        res.json({
          state: link.state,
          linkId: link.linkId,
          signalsAttemptLabel: link.signalsAttemptLabel,
          expiresAt: link.expiresAt?.toISOString(),
        });
        return;
      }
      if (partner.state === "revoked") {
        await db.update(tradifyProductLinks).set({ state: "revoked", revokedAt: new Date(), updatedAt: new Date() })
          .where(and(
            eq(tradifyProductLinks.linkId, link.linkId),
            eq(tradifyProductLinks.userId, user.id),
          ));
        res.json({ state: "unlinked" });
        return;
      }
      const linkedAt =
        typeof partner.linkedAt === "string"
          ? new Date(partner.linkedAt)
          : link.linkedAt ?? new Date();
      if (!Number.isFinite(linkedAt.getTime())) throw new Error("PARTNER_UNAVAILABLE");
      const [updated] = await db.update(tradifyProductLinks)
        .set({ state: "active", linkedAt, updatedAt: new Date() })
        .where(and(
          eq(tradifyProductLinks.linkId, link.linkId),
          eq(tradifyProductLinks.userId, user.id),
          inArray(tradifyProductLinks.state, ["awaiting_journal_confirmation", "active"]),
        ))
        .returning({ state: tradifyProductLinks.state });
      if (!updated) {
        const [current] = await db.select({ state: tradifyProductLinks.state })
          .from(tradifyProductLinks)
          .where(and(
            eq(tradifyProductLinks.linkId, link.linkId),
            eq(tradifyProductLinks.userId, user.id),
          ))
          .limit(1);
        if (current?.state === "revoked") {
          res.json({ state: "unlinked" });
          return;
        }
        if (current?.state === "revocation_pending") {
          res.json({
            state: current.state,
            linkId: link.linkId,
            signalsAttemptLabel: link.signalsAttemptLabel,
          });
          return;
        }
        throw new Error("PARTNER_UNAVAILABLE");
      }
      res.json({
        state: "active",
        signalsAttemptLabel: link.signalsAttemptLabel,
        linkedAt: linkedAt.toISOString(),
      });
    } catch {
      error(res, 503, "PARTNER_UNAVAILABLE", "The linking service is unavailable.");
    }
  });

  router.delete("/product-links/journal/:linkId", deps.requireUser, async (req, res) => {
    noStore(res);
    if (!sameOrigin(res, req, deps.requestIsSameOrigin) || !allowedAndReady(res)) return;
    const linkId = String(req.params.linkId ?? "");
    if (!LINK_ID_PATTERN.test(linkId)) {
      error(res, 400, "INVALID_REQUEST", "The request could not be processed.");
      return;
    }
    const userId = deps.requestUser(req).id;
    const result = await db.transaction(async (tx) => {
      const link = (await tx.select().from(tradifyProductLinks)
        .where(and(eq(tradifyProductLinks.linkId, linkId), eq(tradifyProductLinks.userId, userId)))
        .limit(1))[0];
      if (!link) return undefined;
      if (link.state === "revoked") return { eventId: null };
      if (link.state === "revocation_pending") {
        const pending = (await tx.select().from(tradifyLinkRevocationOutbox)
          .where(and(
            eq(tradifyLinkRevocationOutbox.linkId, linkId),
            eq(tradifyLinkRevocationOutbox.state, "PENDING"),
          )).limit(1))[0];
        return { eventId: pending?.eventId ?? null };
      }
      const eventId = crypto.randomUUID();
      await tx.update(tradifyProductLinks)
        .set({ state: "revocation_pending", updatedAt: new Date() })
        .where(eq(tradifyProductLinks.linkId, linkId));
      await tx.insert(tradifyLinkRevocationOutbox).values({
        eventId,
        linkId,
        userId,
        reason: "user_unlinked",
        canonicalPayload: canonicalRevocationPayload({
          contractVersion: LINK_CONTRACT, linkId, eventId, reason: "user_unlinked",
        }),
        payloadSha256: revocationPayloadHash(canonicalRevocationPayload({
          contractVersion: LINK_CONTRACT, linkId, eventId, reason: "user_unlinked",
        })),
      });
      return { eventId };
    });
    if (!result) {
      error(res, 404, "LINK_NOT_FOUND", "The link was not found.");
      return;
    }
    res.status(202).json({
      contractVersion: LINK_CONTRACT,
      linkId,
      state: "revocation_pending",
      ...(result.eventId ? { eventId: result.eventId } : {}),
    });
  });

  router.post("/product-links/journal/revocations", async (req, res) => {
    noStore(res);
    if (!linkingEnabled()) {
      error(res, 503, "LINKING_DISABLED", "Account linking is unavailable.");
      return;
    }
    if (req.cookies?.["__Host-tradify-session"] || req.cookies?.["__Host-tradify-admin"]) {
      error(res, 401, "ASSERTION_INVALID", "The request could not be verified.");
      return;
    }
    const token = req.header("authorization")?.startsWith("Bearer ")
      ? req.header("authorization")!.slice(7)
      : "";
    const body = objectBody(req.body);
    if (!body || !hasOnly(body, ["contractVersion", "linkId", "eventId", "reason"]) ||
        typeof body.linkId !== "string" || !LINK_ID_PATTERN.test(body.linkId)) {
      error(res, 400, "INVALID_REQUEST", "The request could not be processed.");
      return;
    }
    try {
      const outcome = await recordJournalRevocation({ token, body });
      res.json({
        contractVersion: LINK_CONTRACT,
        linkId: body.linkId,
        state: "revoked",
        eventId: body.eventId,
        payloadSha256: revocationPayloadHash(canonicalRevocationPayload({
          contractVersion: LINK_CONTRACT,
          linkId: body.linkId,
          eventId: String(body.eventId),
          reason: String(body.reason),
        })),
        duplicate: outcome === "duplicate",
      });
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "";
      error(res, code === "REPLAY_CONFLICT" ? 409 : code === "LINK_NOT_FOUND" ? 404 : 401,
        code === "REPLAY_CONFLICT" ? "REPLAY_CONFLICT" : "ASSERTION_INVALID",
        "The request could not be verified.");
    }
  });

  return router;
}
