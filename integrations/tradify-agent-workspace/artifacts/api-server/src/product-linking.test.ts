import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";

assert.match(process.env.PGDATABASE ?? "", /^tradify_test_[0-9]+_[a-f0-9]{8}$/);
process.env.TRADIFY_ACCOUNT_LINKING_ENABLED = "true";
process.env.TRADIFY_ACCOUNT_LINKING_TEST_MODE = "true";
process.env.JOURNAL_LINK_API_URL = "https://journal.example.test";
process.env.SIGNALS_LINKING_ISSUER = "https://linking-dev.signals.tradifyapp.com";
process.env.JOURNAL_LINKING_ISSUER = "https://linking-dev.journal.tradifyapp.com";
process.env.JOURNAL_LINKING_AUDIENCE = "tradify-signals-link-v1-dev";
process.env.SIGNALS_LINKING_AUDIENCE = "tradify-journal-link-v1-dev";
process.env.SIGNALS_LINKING_KEY_ID = "signals-dev-test-1";
process.env.JOURNAL_LINKING_KEY_ID = "journal-dev-test-1";

const { publicKey: journalPublicKey, privateKey: journalPrivateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const { privateKey: signalsPrivateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
process.env.JOURNAL_LINKING_PUBLIC_KEY = journalPublicKey;
process.env.SIGNALS_LINKING_PRIVATE_KEY = signalsPrivateKey;

const [{ default: app }, {
  db,
  pool,
  tradifyLinkRevocationInbox,
  tradifyLinkAssertionReplays,
  tradifyLinkRevocationMismatches,
  tradifyLinkRevocationOutbox,
  tradifyLinkAttempts,
  tradifyLinkSubjects,
  tradifyProductLinks,
}, { eq }, { linkingEnabled }] =
  await Promise.all([
    import("./app"),
    import("@workspace/db"),
    import("drizzle-orm"),
    import("./product-linking"),
  ]);

test("isolated linking requests are disabled at or after the configured session deadline", () => {
  const previous = process.env.TRADIFY_LINK_TEST_DEADLINE;
  try {
    process.env.TRADIFY_LINK_TEST_DEADLINE = new Date(Date.now() + 60_000).toISOString();
    assert.equal(linkingEnabled(), true);
    process.env.TRADIFY_LINK_TEST_DEADLINE = new Date(Date.now() - 1).toISOString();
    assert.equal(linkingEnabled(), false);
    process.env.TRADIFY_LINK_TEST_DEADLINE = "invalid";
    assert.equal(linkingEnabled(), false);
  } finally {
    if (previous === undefined) delete process.env.TRADIFY_LINK_TEST_DEADLINE;
    else process.env.TRADIFY_LINK_TEST_DEADLINE = previous;
  }
});

test("Journal status uses the direct response shape declared for the Signals API", async () => {
  const userId = `link-contract-${crypto.randomUUID()}`;
  const contractApp = express();
  const { createProductLinkingRouter } = await import("./product-linking.routes");
  contractApp.use(
    "/api",
    createProductLinkingRouter({
      requireUser: (_req, _res, next) => next(),
      requestUser: () => ({ id: userId }),
      requestIsSameOrigin: () => true,
    }),
  );

  const server = contractApp.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/product-links/journal`,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json() as Record<string, unknown>;
    assert.deepEqual(body, { state: "unlinked" });
    assert.equal("data" in body, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Journal status refresh signs with the stored Signals subject and persists partner activation", async () => {
  const userId = `link-status-refresh-${crypto.randomUUID()}`;
  const linkId = crypto.randomUUID();
  const subject = `stored-subject-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 60_000);
  const linkedAt = new Date().toISOString();
  await db.insert(tradifyLinkSubjects).values({ userId, subject });
  await db.insert(tradifyProductLinks).values({
    linkId,
    userId,
    partnerIssuer: "https://linking-dev.journal.tradifyapp.com",
    journalAttemptLabel: "JRN-7M4PK9D2W3QF",
    signalsAttemptLabel: "SIG-6P8TR2K5M9WX",
    state: "awaiting_journal_confirmation",
    expiresAt,
  });

  const { createProductLinkingRouter } = await import("./product-linking.routes");
  const statusApp = express();
  statusApp.use(
    "/api",
    createProductLinkingRouter({
      requireUser: (_req, _res, next) => next(),
      requestUser: () => ({ id: userId }),
      requestIsSameOrigin: () => true,
    }),
  );
  const server = statusApp.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const localOrigin = `http://127.0.0.1:${address.port}`;
  const originalFetch = globalThis.fetch;
  let observedJti = "";

  try {
    globalThis.fetch = (async (input, init) => {
      const url = new URL(String(input));
      if (url.origin === localOrigin) return originalFetch(input, init);
      assert.equal(url.origin, "https://journal.example.test");
      assert.equal(url.pathname, "/api/v1/product-links/signals/status");
      assert.equal(init?.method, "POST");
      const headers = new Headers(init?.headers);
      assert.match(headers.get("authorization") ?? "", /^Bearer /);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.deepEqual(body, { contractVersion: "tradify-account-linking-v1", linkId });

      const token = headers.get("authorization")!.slice("Bearer ".length);
      const [headerPart, claimsPart, signaturePart] = token.split(".");
      const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
      const claims = JSON.parse(Buffer.from(claimsPart, "base64url").toString("utf8"));
      assert.equal(header.kid, "signals-dev-test-1");
      assert.equal(header.alg, "RS256");
      assert.equal(
        crypto.verify(
          "RSA-SHA256",
          Buffer.from(`${headerPart}.${claimsPart}`),
          crypto.createPublicKey(signalsPrivateKey),
          Buffer.from(signaturePart, "base64url"),
        ),
        true,
      );
      assert.equal(claims.iss, "https://linking-dev.signals.tradifyapp.com");
      assert.equal(claims.aud, "tradify-journal-link-v1-dev");
      assert.equal(claims.sub, subject);
      assert.equal(claims.action, "status");
      assert.equal(claims.contract_version, "tradify-account-linking-v1");
      assert.equal(claims.link_id, linkId);
      assert.equal(typeof claims.jti, "string");
      assert.ok(claims.exp > claims.iat);
      assert.ok(claims.exp - claims.iat <= 120);
      observedJti = claims.jti;
      return new Response(JSON.stringify({ linkId, state: "active", linkedAt }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const response = await originalFetch(`${localOrigin}/api/product-links/journal`);
    assert.equal(response.status, 200);
    assert.ok(observedJti.length >= 16);
    assert.deepEqual(await response.json(), {
      state: "active",
      signalsAttemptLabel: "SIG-6P8TR2K5M9WX",
      linkedAt,
    });

    const [stored] = await db.select().from(tradifyProductLinks).where(eq(tradifyProductLinks.linkId, linkId));
    assert.equal(stored?.state, "active");
    assert.equal(stored?.linkedAt?.toISOString(), linkedAt);
    assert.equal(stored?.expiresAt?.toISOString(), expiresAt.toISOString());
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(tradifyProductLinks).where(eq(tradifyProductLinks.linkId, linkId));
    await db.delete(tradifyLinkSubjects).where(eq(tradifyLinkSubjects.userId, userId));
  }
});

function journalToken(claims: Record<string, unknown>, header: Record<string, unknown> = {}) {
  const h = Buffer.from(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
    kid: "journal-dev-test-1",
    ...header,
  })).toString("base64url");
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const input = `${h}.${p}`;
  return `${input}.${crypto.sign("RSA-SHA256", Buffer.from(input), journalPrivateKey).toString("base64url")}`;
}

test("Signals linking stays isolated, verifies Journal revocations, and applies idempotent inbox events", async () => {
  assert.equal(process.env.NODE_ENV, "development");
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const linkId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "https://linking-dev.journal.tradifyapp.com",
    aud: "tradify-signals-link-v1-dev",
    sub: "tradify-journal-link-service",
    iat: now,
    exp: now + 120,
    jti: crypto.randomBytes(18).toString("base64url"),
    action: "revoke",
    contract_version: "tradify-account-linking-v1",
    link_id: linkId,
    event_id: eventId,
    reason: "user_unlinked",
  };
  const retryJti = crypto.randomBytes(18).toString("base64url");
  const ackEventId = crypto.randomUUID();
  const ackLinkId = crypto.randomUUID();
  const suspendedLinkId = crypto.randomUUID();
  const suspendedUserId = `link-suspend-test-${crypto.randomUUID()}`;
  const recoveredLinkId = crypto.randomUUID();
  const recoveredUserId = `link-recovery-test-${crypto.randomUUID()}`;
  const token = journalToken(claims);
  const { makeSignalsAssertion, markOutboxEventDelivered, canonicalRevocationPayload, revocationPayloadHash } =
    await import("./product-linking");
  const outbound1 = makeSignalsAssertion({ action: "revoke", sub: "synthetic-test" });
  const outbound2 = makeSignalsAssertion({ action: "revoke", sub: "synthetic-test" });
  const outboundClaims1 = JSON.parse(Buffer.from(outbound1.token.split(".")[1], "base64url").toString("utf8"));
  const outboundClaims2 = JSON.parse(Buffer.from(outbound2.token.split(".")[1], "base64url").toString("utf8"));
  assert.equal(outboundClaims1.exp - outboundClaims1.iat, 120);
  assert.notEqual(outboundClaims1.jti, outboundClaims2.jti);
  try {
    await db.insert(tradifyProductLinks).values({
      linkId,
      userId: `link-test-${crypto.randomUUID()}`,
      partnerIssuer: claims.iss,
      journalAttemptLabel: "JRN-7M4PK9D2W3QF",
      signalsAttemptLabel: "SIG-6P8TR2K5M9WX",
      state: "active",
    });

    const unauthenticatedStatus = await fetch(`${base}/product-links/journal`);
    assert.equal(unauthenticatedStatus.status, 401);

    const request = (body: Record<string, unknown>, bearer = token) =>
      fetch(`${base}/product-links/journal/revocations`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
          "x-forwarded-for": "198.22.88.11",
        },
        body: JSON.stringify(body),
      });
    const body = {
      contractVersion: "tradify-account-linking-v1",
      linkId,
      eventId,
      reason: "user_unlinked",
    };
    const first = await request(body);
    assert.equal(first.status, 200);
    assert.equal((await first.json() as { data: { state: string } }).data.state, "revoked");
    const retryClaims = { ...claims, jti: retryJti };
    const retryToken = journalToken(retryClaims);
    const duplicate = await request(body, retryToken);
    assert.equal(duplicate.status, 200);
    const ack = (await duplicate.json() as { data: { duplicate: boolean; payloadSha256: string; eventId: string } }).data;
    assert.equal(ack.duplicate, true);
    assert.equal(ack.eventId, eventId);
    assert.match(ack.payloadSha256, /^[a-f0-9]{64}$/);

    const conflictToken = journalToken({ ...claims, jti: crypto.randomBytes(18).toString("base64url"), reason: "security_action" });
    const conflict = await request({ ...body, reason: "security_action" }, conflictToken);
    assert.equal(conflict.status, 409);
    assert.equal((await db.select().from(tradifyLinkRevocationMismatches)
      .where(eq(tradifyLinkRevocationMismatches.eventId, eventId))).length, 1);
    assert.equal((await request(body)).status, 409, "an exact assertion replay must fail even when its event was already applied");

    const wrongAudience = journalToken({ ...claims, event_id: crypto.randomUUID(), aud: ["tradify-signals-link-v1-dev"] });
    const rejected = await request({ ...body, eventId: crypto.randomUUID() }, wrongAudience);
    assert.equal(rejected.status, 401);

    const stored = await db.select().from(tradifyProductLinks).where(eq(tradifyProductLinks.linkId, linkId));
    assert.equal(stored[0]?.state, "revoked");
    assert.equal((await db.select().from(tradifyLinkRevocationInbox).where(eq(tradifyLinkRevocationInbox.eventId, eventId))).length, 1);
    assert.equal((await db.select().from(tradifyLinkAssertionReplays).where(eq(tradifyLinkAssertionReplays.jti, String(claims.jti)))).length, 1);

    const canonicalPayload = canonicalRevocationPayload({
      contractVersion: "tradify-account-linking-v1",
      linkId: ackLinkId,
      eventId: ackEventId,
      reason: "user_unlinked",
    });
    const payloadSha256 = revocationPayloadHash(canonicalPayload);
    await db.insert(tradifyProductLinks).values({
      linkId: ackLinkId,
      userId: `link-test-${crypto.randomUUID()}`,
      partnerIssuer: claims.iss,
      journalAttemptLabel: "JRN-7M4PK9D2W3QF",
      signalsAttemptLabel: "SIG-6P8TR2K5M9WX",
      state: "revocation_pending",
    });
    await db.insert(tradifyLinkRevocationOutbox).values({
      eventId: ackEventId,
      linkId: ackLinkId,
      userId: `link-test-${crypto.randomUUID()}`,
      reason: "user_unlinked",
      canonicalPayload,
      payloadSha256,
    });
    await assert.rejects(
      markOutboxEventDelivered(ackEventId, ackLinkId, ackEventId, "0".repeat(64)),
      /ACK_MISMATCH/,
    );
    const pendingAck = (await db.select().from(tradifyLinkRevocationOutbox)
      .where(eq(tradifyLinkRevocationOutbox.eventId, ackEventId)))[0];
    assert.equal(pendingAck?.state, "PENDING");
    await markOutboxEventDelivered(ackEventId, ackLinkId, ackEventId, payloadSha256);
    const confirmedAck = (await db.select().from(tradifyLinkRevocationOutbox)
      .where(eq(tradifyLinkRevocationOutbox.eventId, ackEventId)))[0];
    assert.equal(confirmedAck?.acknowledgedEventId, ackEventId);
    assert.equal(confirmedAck?.acknowledgedPayloadSha256, payloadSha256);

    await db.insert(tradifyProductLinks).values({
      linkId: suspendedLinkId,
      userId: suspendedUserId,
      partnerIssuer: claims.iss,
      journalAttemptLabel: "JRN-7M4PK9D2W3QF",
      signalsAttemptLabel: "SIG-6P8TR2K5M9WX",
      state: "active",
    });
    await db.insert(tradifyLinkAttempts).values({
      id: crypto.randomUUID(),
      userId: suspendedUserId,
      codeHash: crypto.randomBytes(32).toString("hex"),
      journalAttemptLabel: "JRN-7M4PK9D2W3QF",
      signalsAttemptLabel: "SIG-6P8TR2K5M9WX",
      expiresAt: new Date(Date.now() + 60_000),
      state: "PREVIEWED",
    });
    const { queueSignalsLinkRevocations } = await import("./product-linking");
    assert.equal(await queueSignalsLinkRevocations(suspendedUserId, "account_suspended"), 1);
    const suspendedLink = (await db.select().from(tradifyProductLinks)
      .where(eq(tradifyProductLinks.linkId, suspendedLinkId)))[0];
    const suspendedEvent = (await db.select().from(tradifyLinkRevocationOutbox)
      .where(eq(tradifyLinkRevocationOutbox.userId, suspendedUserId)))[0];
    assert.equal(suspendedLink?.state, "revocation_pending");
    assert.equal(suspendedEvent?.reason, "account_suspended");
    assert.equal(suspendedEvent?.payloadSha256, revocationPayloadHash(suspendedEvent!.canonicalPayload));
    assert.equal((await db.select().from(tradifyLinkAttempts)
      .where(eq(tradifyLinkAttempts.userId, suspendedUserId)))[0]?.state, "EXPIRED");

    await db.insert(tradifyProductLinks).values({
      linkId: recoveredLinkId,
      userId: recoveredUserId,
      partnerIssuer: claims.iss,
      journalAttemptLabel: "JRN-7M4PK9D2W3QF",
      signalsAttemptLabel: "SIG-6P8TR2K5M9WX",
      state: "active",
    });
    assert.equal(await queueSignalsLinkRevocations(recoveredUserId, "security_action"), 1);
    assert.equal((await db.select().from(tradifyProductLinks)
      .where(eq(tradifyProductLinks.linkId, recoveredLinkId)))[0]?.state, "revocation_pending");

    process.env.PGDATABASE = "heliumdb";
    const { linkingEnabled } = await import("./product-linking");
    assert.equal(linkingEnabled(), false, "linking must remain disabled on the shared development database");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(tradifyLinkRevocationInbox).where(eq(tradifyLinkRevocationInbox.eventId, eventId));
    await db.delete(tradifyLinkRevocationMismatches).where(eq(tradifyLinkRevocationMismatches.eventId, eventId));
    await db.delete(tradifyLinkAssertionReplays).where(eq(tradifyLinkAssertionReplays.jti, String(claims.jti)));
    await db.delete(tradifyLinkAssertionReplays).where(eq(tradifyLinkAssertionReplays.jti, retryJti));
    await db.delete(tradifyLinkRevocationOutbox).where(eq(tradifyLinkRevocationOutbox.eventId, ackEventId));
    await db.delete(tradifyLinkRevocationOutbox).where(eq(tradifyLinkRevocationOutbox.userId, suspendedUserId));
    await db.delete(tradifyLinkRevocationOutbox).where(eq(tradifyLinkRevocationOutbox.userId, recoveredUserId));
    await db.delete(tradifyLinkAttempts).where(eq(tradifyLinkAttempts.userId, suspendedUserId));
    await db.delete(tradifyProductLinks).where(eq(tradifyProductLinks.linkId, ackLinkId));
    await db.delete(tradifyProductLinks).where(eq(tradifyProductLinks.linkId, suspendedLinkId));
    await db.delete(tradifyProductLinks).where(eq(tradifyProductLinks.linkId, recoveredLinkId));
    await db.delete(tradifyProductLinks).where(eq(tradifyProductLinks.linkId, linkId));
    await pool.end();
  }
});
