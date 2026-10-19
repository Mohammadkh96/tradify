import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import pg from "pg";
import Stripe from "stripe";
import { registerRoutes } from "./routes";
import { pool as applicationPool } from "./db";
import { paypalService } from "./paypalService";
import { capturePaypalOrder } from "./paypal";
import {
  JOURNAL_DEV_ISSUER,
  JOURNAL_LINK_SERVICE_SUBJECT,
  LINK_CONTRACT_VERSION,
  JOURNAL_INITIATION_CONSENT_VERSION,
  JOURNAL_CONFIRMATION_CONSENT_VERSION,
  SIGNALS_CONSENT_VERSION,
  SIGNALS_DEV_ISSUER,
  SIGNALS_LINK_AUDIENCE,
  SIGNALS_LINK_SERVICE_SUBJECT,
  assertDevelopmentSigningKeyNotInProduction,
  canonicalizeRevocationPayload,
  getJournalSigningConfig,
  sha256,
} from "./product-linking-assertions";
import {
  boundedRevocationRetryDelayMs,
  drainProductLinkOutboxOnce,
} from "./product-linking-outbox";
import { prepareProductLinkAccountLifecycle } from "./product-linking-routes";

const { isolatedEmailService, capturedPasswordResetLink } = vi.hoisted(() => {
  process.env.DEV_PAYPAL_CLIENT_ID = "local-only-security-test-client";
  process.env.DEV_PAYPAL_CLIENT_SECRET = "local-only-security-test-secret";
  process.env.DEV_PAYPAL_WEBHOOK_ID = "WH-local-only-security-test-id";
  process.env.DEV_STRIPE_WEBHOOK_SECRET = "whsec_local_only_test";
  const capturedPasswordResetLink = { value: "" };
  return {
    capturedPasswordResetLink,
    isolatedEmailService: new Proxy({}, {
      get: (_target, property: string | symbol) => vi.fn(async (...args: unknown[]) => {
        if (property === "sendPasswordResetEmail" && typeof args[2] === "string") {
          capturedPasswordResetLink.value = args[2];
        }
        return false;
      }),
    }),
  };
});

vi.mock("./stripeClient", async () => {
  const stripeModule = await vi.importActual<typeof import("stripe")>("stripe");
  const stripe = new stripeModule.default("sk_test_local_mock_only");
  return {
    getUncachableStripeClient: async () => stripe,
    getStripeSecretKey: async () => "sk_test_local_mock_only",
    getStripePublishableKey: async () => "pk_test_local_mock_only",
  };
});

vi.mock("./emailService", () => ({ emailService: isolatedEmailService }));

vi.mock("./paypal", () => ({
  createPaypalOrder: vi.fn(),
  capturePaypalOrder: vi.fn(),
  loadPaypalDefault: vi.fn(),
}));

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error("TEST_DATABASE_URL must point to a unique disposable local database.");
}
const parsedTestUrl = new URL(connectionString);
if (
  !["127.0.0.1", "localhost", "::1"].includes(parsedTestUrl.hostname) ||
  !parsedTestUrl.pathname.startsWith("/tradify_security_") ||
  parsedTestUrl.pathname === "/neondb"
) {
  throw new Error("Application security integration tests only run against a local tradify_security_* database.");
}

const testPool = new pg.Pool({ connectionString, max: 5 });
const nativeFetch = globalThis.fetch.bind(globalThis);
const testRunId = `${process.pid}-${Date.now()}`;
const emailPrefix = `replit-security-${testRunId}`;
const aliceEmail = `${emailPrefix}-alice@example.invalid`;
const bobEmail = `${emailPrefix}-bob@example.invalid`;
const adminEmail = `${emailPrefix}-admin@example.invalid`;
const journalOwnerEmail = `${emailPrefix}-journal-owner@example.invalid`;
const journalOtherEmail = `${emailPrefix}-journal-other@example.invalid`;
const recoveryEmail = `${emailPrefix}-password-recovery@example.invalid`;
const linkingEmail = `${emailPrefix}-account-linking@example.invalid`;
const testPassword = "Local-only-security-test-password-1";
const stripeWebhookSecret = "whsec_local_only_test";
const originalReplitDevDomain = process.env.REPLIT_DEV_DOMAIN;

let appServer: Server | undefined;
let origin = "";
let forwardedIp = 1;

async function request(
  path: string,
  options: RequestInit & { json?: unknown; cookie?: string } = {},
): Promise<Response> {
  const { json, cookie, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("x-forwarded-for", `192.0.2.${(forwardedIp++ % 250) + 1}`);
  if (cookie) headers.set("cookie", cookie);
  if (path.startsWith("/api/v1/product-links") && !headers.has("origin")) {
    headers.set("origin", origin);
  }
  let body = init.body;
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(json);
  } else if (typeof body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return nativeFetch(`${origin}${path}`, { ...init, headers, body });
}

async function registerAndVerify(email: string, fullName: string): Promise<void> {
  const registration = await request("/api/auth/register", {
    method: "POST",
    json: { email, password: testPassword, fullName, country: "US", timezone: "UTC" },
  });
  expect(registration.status).toBe(201);
  const registrationBody = await registration.json();
  expect(registrationBody.requiresVerification).toBe(true);
  expect(registration.headers.get("set-cookie")).toBeNull();

  const result = await testPool.query<{ token: string }>(
    "SELECT email_verification_token AS token FROM user_role WHERE user_id = $1",
    [email.toLowerCase()],
  );
  expect(result.rows[0]?.token).toMatch(/^[a-f0-9]{64}$/);
  const verification = await request(
    `/api/auth/verify-email?token=${encodeURIComponent(result.rows[0].token)}`,
    { redirect: "manual" },
  );
  expect(verification.status).toBe(302);
  expect(verification.headers.get("location")).toContain("verified=true");
}

async function login(email: string, password = testPassword): Promise<{ cookie: string; user: any }> {
  const response = await request("/api/auth/login", {
    method: "POST",
    json: { email, password },
  });
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  return {
    cookie: setCookie!.split(";")[0],
    user: await response.json(),
  };
}

beforeAll(async () => {
  process.env.REPLIT_DEV_DOMAIN = "journal-test.replit.dev";
  const existingSchema = await testPool.query<{ table_name: string | null }>(
    "SELECT to_regclass('public.user_role')::text AS table_name",
  );
  if (!existingSchema.rows[0]?.table_name) {
    const baseline = await readFile("migrations/0000_tradifyapp_dev_baseline.sql", "utf8");
    await testPool.query(baseline);
  }
  const outboxMigration = await readFile("migrations/0001_background_jobs_and_email_outbox.sql", "utf8");
  await testPool.query(outboxMigration);
  const productLinkingMigration = await readFile("migrations/0002_tradify_account_linking_v1.sql", "utf8");
  await testPool.query(productLinkingMigration);
  const revocationRetryMigration = await readFile("migrations/0003_product_link_revocation_retry_v1.sql", "utf8");
  await testPool.query(revocationRetryMigration);

  const app = express();
  app.use(express.json({
    limit: "50mb",
    verify: (req, _res, body) => {
      if (req.url?.startsWith("/api/v1/product-links") && body.length > 8 * 1024) {
        throw Object.assign(new Error("Product-link request body is too large."), {
          status: 413,
          statusCode: 413,
        });
      }
      (req as any).rawBody = Buffer.from(body);
    },
  }));
  app.use(express.urlencoded({ extended: false }));
  appServer = createServer(app);
  await registerRoutes(appServer, app);
  expect(app.get("trust proxy")).toBe(1);
  await new Promise<void>((resolve, reject) => {
    appServer!.once("error", reject);
    appServer!.listen(0, "127.0.0.1", resolve);
  });
  const address = appServer.address();
  if (!address || typeof address === "string") throw new Error("Could not bind the isolated test application.");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (appServer?.listening) {
    appServer.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      appServer!.close((error) => error ? reject(error) : resolve()),
    );
  }
  await testPool.end();
  await applicationPool.end();
  if (originalReplitDevDomain === undefined) delete process.env.REPLIT_DEV_DOMAIN;
  else process.env.REPLIT_DEV_DOMAIN = originalReplitDevDomain;
});

describe("application security boundaries against a disposable local PostgreSQL database", () => {
  it("supports owner-scoped journal trade create, read, update, list, and delete", async () => {
    await registerAndVerify(journalOwnerEmail, "Synthetic Journal Owner");
    await registerAndVerify(journalOtherEmail, "Synthetic Journal Other");
    const owner = await login(journalOwnerEmail);
    const other = await login(journalOtherEmail);

    const createdResponse = await request("/api/trades", {
      method: "POST",
      cookie: owner.cookie,
      json: {
        pair: "EURUSD",
        direction: "Buy",
        timeframe: "M15",
        htfBias: "Bullish",
        outcome: "Win",
        netPl: "25.00",
        notes: "Synthetic CRUD verification",
      },
    });
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    const tradeId = Number(created.id);
    expect(created).toMatchObject({
      userId: journalOwnerEmail,
      pair: "EURUSD",
      direction: "Buy",
      netPl: "25.00",
    });

    const ownerList = await request("/api/trades", { cookie: owner.cookie });
    expect(ownerList.status).toBe(200);
    expect(await ownerList.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: tradeId })]),
    );
    const otherList = await request("/api/trades", { cookie: other.cookie });
    expect(otherList.status).toBe(200);
    expect(await otherList.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: tradeId })]),
    );

    expect((await request(`/api/trades/${tradeId}`, { method: "PUT", json: { notes: "unauthenticated" } })).status).toBe(401);
    expect((await request(`/api/trades/${tradeId}`, { method: "DELETE" })).status).toBe(401);
    expect((await request(`/api/trades/${tradeId}`, { cookie: other.cookie })).status).toBe(403);
    expect((await request(`/api/trades/${tradeId}`, {
      method: "PUT",
      cookie: other.cookie,
      json: { notes: "cross-user mutation" },
    })).status).toBe(404);
    expect((await request(`/api/trades/${tradeId}`, {
      method: "DELETE",
      cookie: other.cookie,
    })).status).toBe(404);

    const updatedResponse = await request(`/api/trades/${tradeId}`, {
      method: "PUT",
      cookie: owner.cookie,
      json: { notes: "Owner update confirmed", netPl: "30.00" },
    });
    expect(updatedResponse.status).toBe(200);
    expect(await updatedResponse.json()).toMatchObject({
      id: tradeId,
      userId: journalOwnerEmail,
      notes: "Owner update confirmed",
      netPl: "30.00",
    });

    const heatmapResponse = await request("/api/analytics/heatmap?days=30", {
      cookie: owner.cookie,
    });
    expect(heatmapResponse.status).toBe(200);
    const heatmap = await heatmapResponse.json();
    expect(heatmap.grid).toHaveLength(7);
    expect(heatmap.grid.every((day: unknown[]) => day.length === 24)).toBe(true);
    expect(heatmap.totalTrades).toBe(1);
    const heatmapCells = heatmap.grid.flat();
    expect(heatmapCells.reduce((total: number, cell: any) => total + cell.trades, 0)).toBe(1);
    expect(heatmapCells.reduce((total: number, cell: any) => total + cell.wins, 0)).toBe(1);
    expect(heatmapCells.reduce((total: number, cell: any) => total + cell.netPl, 0)).toBe(30);

    const deletedResponse = await request(`/api/trades/${tradeId}`, {
      method: "DELETE",
      cookie: owner.cookie,
    });
    expect(deletedResponse.status).toBe(204);
    expect((await request(`/api/trades/${tradeId}`, { cookie: owner.cookie })).status).toBe(404);
  });

  it("requires email verification and returns no credential fields to the signed-in user", async () => {
    const registration = await request("/api/auth/register", {
      method: "POST",
      json: {
        email: aliceEmail,
        password: testPassword,
        fullName: "Synthetic Alice",
        country: "US",
        timezone: "UTC",
      },
    });
    expect(registration.status).toBe(201);
    expect((await registration.json()).requiresVerification).toBe(true);
    expect(registration.headers.get("set-cookie")).toBeNull();

    const unverifiedLogin = await request("/api/auth/login", {
      method: "POST",
      json: { email: aliceEmail, password: testPassword },
    });
    expect(unverifiedLogin.status).toBe(403);
    expect(await unverifiedLogin.json()).toMatchObject({ requiresVerification: true });
    expect(unverifiedLogin.headers.get("set-cookie")).toBeNull();

    const verificationRow = await testPool.query<{ token: string }>(
      "SELECT email_verification_token AS token FROM user_role WHERE user_id = $1",
      [aliceEmail],
    );
    const verified = await request(
      `/api/auth/verify-email?token=${encodeURIComponent(verificationRow.rows[0].token)}`,
      { redirect: "manual" },
    );
    expect(verified.status).toBe(302);

    const alice = await login(aliceEmail);
    const ownUser = await request("/api/user", { cookie: alice.cookie });
    expect(ownUser.status).toBe(200);
    const userJson = await ownUser.json();
    expect(userJson).toMatchObject({ userId: aliceEmail, emailVerified: true });
    const coachInfo = await request("/api/student/coach", { cookie: alice.cookie });
    expect(coachInfo.status).toBe(200);
    expect(await coachInfo.json()).toEqual({
      invites: [],
      activeCoach: null,
      recentFeedback: [],
    });
    for (const field of [
      "password",
      "syncToken",
      "emailVerificationToken",
      "passwordResetToken",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "paypalSubscriptionId",
    ]) {
      expect(userJson).not.toHaveProperty(field);
    }

    await testPool.query(
      "UPDATE user_role SET subscription_tier = 'FREE' WHERE user_id = $1",
      [aliceEmail],
    );
    const blockedPremiumReport = await request(
      `/api/pdf-report/${encodeURIComponent(aliceEmail)}`,
      { cookie: alice.cookie },
    );
    expect(blockedPremiumReport.status).toBe(403);
    expect(await blockedPremiumReport.json()).toMatchObject({ requiredTier: "PRO" });
    await testPool.query(
      "UPDATE user_role SET subscription_tier = 'PRO' WHERE user_id = $1",
      [aliceEmail],
    );

    const logout = await request("/api/logout", {
      method: "POST",
      cookie: alice.cookie,
    });
    expect(logout.status).toBe(200);
    expect((await request("/api/user", { cookie: alice.cookie })).status).toBe(401);
  });

  it("completes password recovery through a local email mock and consumes the reset token once", async () => {
    await registerAndVerify(recoveryEmail, "Synthetic Recovery User");
    capturedPasswordResetLink.value = "";

    const requestReset = await request("/api/user/reset-password-request", {
      method: "POST",
      json: { email: recoveryEmail },
    });
    expect(requestReset.status).toBe(200);
    expect(await requestReset.json()).toMatchObject({
      message: "If an account exists with that email, a password reset link has been sent.",
    });
    expect(capturedPasswordResetLink.value).toContain("/reset-password?token=");

    const resetUrl = new URL(capturedPasswordResetLink.value);
    const token = resetUrl.searchParams.get("token");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const { createHash } = await import("node:crypto");
    const savedReset = await testPool.query<{
      password_reset_token: string;
      password_reset_expiry: Date;
    }>(
      "SELECT password_reset_token, password_reset_expiry FROM user_role WHERE user_id = $1",
      [recoveryEmail],
    );
    expect(savedReset.rows[0]?.password_reset_token).toBe(
      createHash("sha256").update(token!).digest("hex"),
    );
    expect(savedReset.rows[0]?.password_reset_expiry.getTime()).toBeGreaterThan(Date.now());

    const newPassword = "Synthetic-recovery-password-2";
    const completeReset = await request("/api/auth/reset-password-with-token", {
      method: "POST",
      json: { token, newPassword },
    });
    expect(completeReset.status).toBe(200);
    expect(await completeReset.json()).toMatchObject({ success: true });

    const consumedReset = await testPool.query<{
      password_reset_token: string | null;
      password_reset_expiry: Date | null;
    }>(
      "SELECT password_reset_token, password_reset_expiry FROM user_role WHERE user_id = $1",
      [recoveryEmail],
    );
    expect(consumedReset.rows[0]).toMatchObject({
      password_reset_token: null,
      password_reset_expiry: null,
    });
    expect((await request("/api/auth/reset-password-with-token", {
      method: "POST",
      json: { token, newPassword },
    })).status).toBe(400);

    const oldPasswordLogin = await request("/api/auth/login", {
      method: "POST",
      json: { email: recoveryEmail, password: testPassword },
    });
    expect(oldPasswordLogin.status).toBe(401);
    const recoveredSession = await login(recoveryEmail, newPassword);
    expect((await request("/api/user", { cookie: recoveredSession.cookie })).status).toBe(200);
    expect((await request("/api/logout", {
      method: "POST",
      cookie: recoveredSession.cookie,
    })).status).toBe(200);
    expect((await request("/api/user", { cookie: recoveredSession.cookie })).status).toBe(401);
  });

  it("keeps Journal linking default-off and enforces the two-consent V1 contract", async () => {
    const { randomBytes, generateKeyPairSync, sign, verify, createHash } = await import("node:crypto");
    const envKeys = [
      "NODE_ENV",
      "APP_ENV",
      "DEV_PRODUCT_LINKING_ENABLED",
      "PRODUCT_LINKING_ENABLED",
      "PRODUCT_LINKING_VERIFIED",
      "TRADIFY_SIGNALS_ISSUER",
      "TRADIFY_SIGNALS_KEY_ID",
      "TRADIFY_SIGNALS_PUBLIC_KEY",
      "TRADIFY_SIGNALS_PREVIOUS_KEY_ID",
      "TRADIFY_SIGNALS_PREVIOUS_PUBLIC_KEY",
      "TRADIFY_SIGNALS_PREVIOUS_KEY_EXPIRES_AT",
      "TRADIFY_JOURNAL_ISSUER",
      "TRADIFY_JOURNAL_AUDIENCE",
      "TRADIFY_JOURNAL_KEY_ID",
      "DEV_TRADIFY_JOURNAL_PRIVATE_KEY",
      "TRADIFY_JOURNAL_PRIVATE_KEY",
      "TRADIFY_SIGNALS_API_BASE_URL",
      "DEV_PRODUCT_LINKING_CSRF_DIAGNOSTICS",
    ] as const;
    const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    const csrfDiagnosticLines: string[] = [];
    const csrfDiagnosticSpy = vi.spyOn(console, "info").mockImplementation((...args) => {
      const line = args[0];
      if (typeof line === "string" && line.startsWith("[product-link-csrf] ")) {
        csrfDiagnosticLines.push(line.slice("[product-link-csrf] ".length));
      }
    });
    const signalsKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const journalKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const signalsKid = "signals-local-test-key";
    const journalKid = "journal-local-test-key";
    const signalsSubject = () => randomBytes(32).toString("base64url");
    const signalsPublicPem = signalsKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
    const journalPrivatePem = journalKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const signSignalsAssertion = (claims: Record<string, unknown>, privateKey = signalsKeys.privateKey) => {
      const header = b64({ alg: "RS256", typ: "JWT", kid: signalsKid });
      const payload = b64(claims);
      const signingInput = `${header}.${payload}`;
      const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
      return `${signingInput}.${signature}`;
    };
    const baseClaims = (sub: string, action: string, additions: Record<string, unknown> = {}) => {
      const now = Math.floor(Date.now() / 1000);
      return {
        iss: SIGNALS_DEV_ISSUER,
        aud: "tradify-journal-link-v1-dev",
        sub,
        iat: now,
        exp: now + 90,
        jti: randomBytes(24).toString("base64url"),
        action,
        contract_version: LINK_CONTRACT_VERSION,
        ...additions,
      };
    };
    const claimAssertion = (
      code: string,
      journalAttemptLabel: string,
      sub: string,
      overrides: Record<string, unknown> = {},
    ) => {
      const now = Math.floor(Date.now() / 1000);
      return signSignalsAssertion({
        ...baseClaims(sub, "claim"),
        consent: true,
        consent_at: now,
        consent_version: SIGNALS_CONSENT_VERSION,
        journal_initiation_consent_version: JOURNAL_INITIATION_CONSENT_VERSION,
        journal_attempt_label: journalAttemptLabel,
        signals_attempt_label: "SIG-ABCDEFG23456",
        code_sha256: createHash("sha256").update(code).digest("hex"),
        ...overrides,
      });
    };
    const setCsrf = async (cookie: string) => {
      const response = await request("/api/v1/product-links/signals/csrf", { cookie });
      expect(response.status).toBe(200);
      return (await response.json()).csrfToken as string;
    };
    const servicePost = (path: string, body: unknown, assertion: string, extraHeaders: Record<string, string> = {}) =>
      request(path, {
        method: "POST",
        headers: { authorization: `Bearer ${assertion}`, ...extraHeaders },
        json: body,
      });
    const createActiveLink = async (email: string, name: string) => {
      await registerAndVerify(email, name);
      const session = await login(email);
      const csrfToken = await setCsrf(session.cookie);
      const authorizationResponse = await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: session.cookie,
        headers: { "x-csrf-token": csrfToken },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          consent: true,
          consentVersion: JOURNAL_INITIATION_CONSENT_VERSION,
        },
      });
      expect(authorizationResponse.status).toBe(201);
      const authorization = await authorizationResponse.json();
      const subject = signalsSubject();
      const assertion = claimAssertion(
        authorization.authorizationCode,
        authorization.journalAttemptLabel,
        subject,
      );
      const claim = await servicePost(
        "/api/v1/product-links/signals/claim",
        { contractVersion: LINK_CONTRACT_VERSION, authorizationCode: authorization.authorizationCode },
        assertion,
      );
      expect(claim.status).toBe(201);
      const pending = await claim.json();
      const confirm = await request("/api/v1/product-links/signals/confirm", {
        method: "POST",
        cookie: session.cookie,
        headers: { "x-csrf-token": csrfToken },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: pending.linkId,
          consent: true,
          consentVersion: JOURNAL_CONFIRMATION_CONSENT_VERSION,
        },
      });
      expect(confirm.status).toBe(200);
      return { session, csrfToken, linkId: pending.linkId, subject };
    };

    try {
      expect(boundedRevocationRetryDelayMs(1)).toBe(10_000);
      expect(boundedRevocationRetryDelayMs(2)).toBe(20_000);
      expect(boundedRevocationRetryDelayMs(10_000)).toBe(6 * 60 * 60 * 1000);
      process.env.NODE_ENV = "test";
      delete process.env.DEV_PRODUCT_LINKING_ENABLED;
      const disabledResponse = await request("/api/v1/product-links/signals/configuration");
      expect(disabledResponse.status).toBe(401);
      await registerAndVerify(linkingEmail, "Synthetic Linking User");
      const journalSession = await login(linkingEmail);
      expect(await (await request("/api/v1/product-links/signals/configuration", {
        cookie: journalSession.cookie,
      })).json()).toEqual({ enabled: false });
      expect((await request("/api/v1/product-links/signals", {
        cookie: journalSession.cookie,
      })).status).toBe(503);

      process.env.DEV_PRODUCT_LINKING_ENABLED = "true";
      process.env.NODE_ENV = "production";
      process.env.TRADIFY_JOURNAL_ISSUER = JOURNAL_DEV_ISSUER;
      process.env.TRADIFY_JOURNAL_AUDIENCE = SIGNALS_LINK_AUDIENCE;
      process.env.TRADIFY_JOURNAL_KEY_ID = journalKid;
      process.env.DEV_TRADIFY_JOURNAL_PRIVATE_KEY = journalPrivatePem;
      expect(getJournalSigningConfig()).toBeNull();
      expect(() => assertDevelopmentSigningKeyNotInProduction()).toThrow(
        /development-only Journal signing key/,
      );
      expect(await (await request("/api/v1/product-links/signals/configuration", {
        cookie: journalSession.cookie,
      })).json()).toEqual({ enabled: false });
      expect((await request("/api/v1/product-links/signals", {
        cookie: journalSession.cookie,
      })).status).toBe(503);

      process.env.NODE_ENV = "test";
      process.env.APP_ENV = "test";
      process.env.TRADIFY_SIGNALS_ISSUER = SIGNALS_DEV_ISSUER;
      process.env.TRADIFY_SIGNALS_KEY_ID = signalsKid;
      process.env.TRADIFY_SIGNALS_PUBLIC_KEY = signalsPublicPem;
      process.env.TRADIFY_JOURNAL_ISSUER = JOURNAL_DEV_ISSUER;
      process.env.TRADIFY_JOURNAL_AUDIENCE = SIGNALS_LINK_AUDIENCE;
      process.env.TRADIFY_JOURNAL_KEY_ID = journalKid;
      process.env.DEV_TRADIFY_JOURNAL_PRIVATE_KEY = journalPrivatePem;
      process.env.TRADIFY_SIGNALS_API_BASE_URL = "https://signals.test.invalid";
      process.env.DEV_PRODUCT_LINKING_CSRF_DIAGNOSTICS = "true";
      expect(await (await request("/api/v1/product-links/signals/configuration", {
        cookie: journalSession.cookie,
      })).json()).toEqual({ enabled: true });

      const csrfToken = await setCsrf(journalSession.cookie);
      const noCsrf = await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: journalSession.cookie,
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          consent: true,
          consentVersion: JOURNAL_INITIATION_CONSENT_VERSION,
        },
      });
      expect(noCsrf.status).toBe(403);
      const noCsrfDiagnostic = JSON.parse(csrfDiagnosticLines.at(-1) ?? "{}");
      expect(noCsrfDiagnostic).toMatchObject({
        origin_header_present: "PASS",
        trusted_protocol_host_match: "PASS",
        session_csrf_token_present: "PASS",
        csrf_header_present: "FAIL",
        csrf_token_match: "FAIL",
      });
      const wrongOrigin = await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: journalSession.cookie,
        headers: { origin: "https://attacker.invalid", "x-csrf-token": csrfToken },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          consent: true,
          consentVersion: JOURNAL_INITIATION_CONSENT_VERSION,
        },
      });
      expect(wrongOrigin.status).toBe(403);
      const wrongOriginDiagnostic = JSON.parse(csrfDiagnosticLines.at(-1) ?? "{}");
      expect(wrongOriginDiagnostic).toMatchObject({
        origin_header_present: "PASS",
        origin_canonical: "PASS",
        trusted_protocol_host_match: "FAIL",
        csrf_token_match: "NOT_EVALUATED",
      });
      const noConsent = await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: journalSession.cookie,
        headers: { "x-csrf-token": csrfToken },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          consent: false,
          consentVersion: JOURNAL_INITIATION_CONSENT_VERSION,
        },
      });
      expect(noConsent.status).toBe(400);
      const proxyOrigin = origin.replace(/^http:/, "https:");
      const invalidCsrf = await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: journalSession.cookie,
        headers: {
          origin: proxyOrigin,
          "x-forwarded-proto": "https",
          "x-csrf-token": "invalid-local-csrf-token",
        },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          consent: true,
          consentVersion: JOURNAL_INITIATION_CONSENT_VERSION,
        },
      });
      expect(invalidCsrf.status).toBe(403);
      const invalidCsrfDiagnostic = JSON.parse(csrfDiagnosticLines.at(-1) ?? "{}");
      expect(invalidCsrfDiagnostic).toMatchObject({
        trusted_protocol_host_match: "PASS",
        session_csrf_token_present: "PASS",
        csrf_header_present: "PASS",
        csrf_token_match: "FAIL",
      });

      const authorizationResponse = await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: journalSession.cookie,
        headers: {
          origin: proxyOrigin,
          "x-forwarded-proto": "https",
          "x-csrf-token": csrfToken,
        },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          consent: true,
          consentVersion: JOURNAL_INITIATION_CONSENT_VERSION,
        },
      });
      expect(authorizationResponse.status).toBe(201);
      const validProxyDiagnostic = JSON.parse(csrfDiagnosticLines.at(-1) ?? "{}");
      expect(validProxyDiagnostic).toMatchObject({
        origin_header_present: "PASS",
        host_header_present: "PASS",
        origin_syntax_valid: "PASS",
        origin_canonical: "PASS",
        trusted_protocol_host_match: "PASS",
        session_csrf_token_present: "PASS",
        csrf_header_present: "PASS",
        csrf_token_match: "PASS",
      });
      expect(csrfDiagnosticLines.join(" ")).not.toContain(journalSession.cookie);
      expect(csrfDiagnosticLines.join(" ")).not.toContain(csrfToken);
      const authorization = await authorizationResponse.json();
      expect(authorization.authorizationCode).toMatch(/^[a-f0-9]{64}$/);
      expect(authorization.journalAttemptLabel).toMatch(/^JRN-[A-Z2-7]{12}$/);
      expect(authorization.journalAccountLabel).toBe("Journal account");
      expect(JSON.stringify(authorization)).not.toContain("Synthetic Linking User");
      expect(JSON.stringify(authorization)).not.toContain(linkingEmail);
      const authorizationStatusResponse = await request("/api/v1/product-links/signals", {
        cookie: journalSession.cookie,
      });
      expect(authorizationStatusResponse.status).toBe(200);
      const authorizationStatus = await authorizationStatusResponse.json();
      expect(authorizationStatus.journalAccountLabel).toBe("Journal account");
      expect(JSON.stringify(authorizationStatus)).not.toContain("Synthetic Linking User");
      expect(JSON.stringify(authorizationStatus)).not.toContain(linkingEmail);
      const authDigest = sha256(authorization.authorizationCode);
      const storedAuthorization = await testPool.query<{
        created_at: Date;
        expires_at: Date;
        authorization_code_sha256: string;
      }>(
        `SELECT created_at, expires_at, authorization_code_sha256
           FROM product_link_authorizations WHERE authorization_code_sha256 = $1`,
        [authDigest],
      );
      expect(storedAuthorization.rows[0]?.authorization_code_sha256).toBe(authDigest);
      expect(storedAuthorization.rows[0].expires_at.getTime() - storedAuthorization.rows[0].created_at.getTime()).toBeLessThanOrEqual(5 * 60_000);
      expect(storedAuthorization.rows[0].expires_at.getTime() - storedAuthorization.rows[0].created_at.getTime()).toBeGreaterThan(0);

      const preview = await servicePost(
        "/api/v1/product-links/signals/preview",
        {
          contractVersion: LINK_CONTRACT_VERSION,
          authorizationCode: authorization.authorizationCode,
        },
        "unused-preview-bearer-not-required",
      );
      expect(preview.status).toBe(200);
      expect(await preview.json()).toMatchObject({
        state: "awaiting_signals_consent",
        journalAttemptLabel: authorization.journalAttemptLabel,
      });

      const subject = signalsSubject();
      const badDigestAssertion = claimAssertion(
        authorization.authorizationCode,
        authorization.journalAttemptLabel,
        subject,
        { code_sha256: sha256("different-code") },
      );
      const badDigestResponse = await servicePost(
        "/api/v1/product-links/signals/claim",
        {
          contractVersion: LINK_CONTRACT_VERSION,
          authorizationCode: authorization.authorizationCode,
        },
        badDigestAssertion,
      );
      expect(badDigestResponse.status).toBe(401);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiredAssertion = claimAssertion(
        authorization.authorizationCode,
        authorization.journalAttemptLabel,
        subject,
        { iat: nowSeconds - 90, exp: nowSeconds - 1 },
      );
      expect((await servicePost(
        "/api/v1/product-links/signals/claim",
        { contractVersion: LINK_CONTRACT_VERSION, authorizationCode: authorization.authorizationCode },
        expiredAssertion,
      )).status).toBe(401);
      const excessiveLifetimeAssertion = claimAssertion(
        authorization.authorizationCode,
        authorization.journalAttemptLabel,
        subject,
        { iat: nowSeconds, exp: nowSeconds + 121 },
      );
      expect((await servicePost(
        "/api/v1/product-links/signals/claim",
        { contractVersion: LINK_CONTRACT_VERSION, authorizationCode: authorization.authorizationCode },
        excessiveLifetimeAssertion,
      )).status).toBe(401);
      const arrayAudienceAssertion = claimAssertion(
        authorization.authorizationCode,
        authorization.journalAttemptLabel,
        subject,
        { aud: ["tradify-journal-link-v1-dev"] },
      );
      expect((await servicePost(
        "/api/v1/product-links/signals/claim",
        { contractVersion: LINK_CONTRACT_VERSION, authorizationCode: authorization.authorizationCode },
        arrayAudienceAssertion,
      )).status).toBe(401);
      const clientSuppliedIdentity = await servicePost(
        "/api/v1/product-links/signals/claim",
        {
          contractVersion: LINK_CONTRACT_VERSION,
          authorizationCode: authorization.authorizationCode,
          userId: linkingEmail,
        },
        claimAssertion(authorization.authorizationCode, authorization.journalAttemptLabel, subject),
      );
      expect(clientSuppliedIdentity.status).toBe(400);

      const claimAssertionToken = claimAssertion(
        authorization.authorizationCode,
        authorization.journalAttemptLabel,
        subject,
      );
      const claimResponse = await servicePost(
        "/api/v1/product-links/signals/claim",
        {
          contractVersion: LINK_CONTRACT_VERSION,
          authorizationCode: authorization.authorizationCode,
        },
        claimAssertionToken,
      );
      expect(claimResponse.status).toBe(201);
      const pending = await claimResponse.json();
      expect(pending).toMatchObject({
        state: "awaiting_journal_confirmation",
        signalsAttemptLabel: "SIG-ABCDEFG23456",
      });
      expect(JSON.stringify(pending)).not.toContain(linkingEmail);
      const exactClaimRetry = await servicePost(
        "/api/v1/product-links/signals/claim",
        {
          contractVersion: LINK_CONTRACT_VERSION,
          authorizationCode: authorization.authorizationCode,
        },
        claimAssertionToken,
      );
      expect(exactClaimRetry.status).toBe(200);
      expect(await exactClaimRetry.json()).toMatchObject({
        linkId: pending.linkId,
        state: "awaiting_journal_confirmation",
      });
      const originalJti = JSON.parse(
        Buffer.from(claimAssertionToken.split(".")[1], "base64url").toString("utf8"),
      ).jti;
      const changedSameJti = claimAssertion(
        authorization.authorizationCode,
        authorization.journalAttemptLabel,
        subject,
        { jti: originalJti, signals_attempt_label: "SIG-BCDEFG234567" },
      );
      expect((await servicePost(
        "/api/v1/product-links/signals/claim",
        { contractVersion: LINK_CONTRACT_VERSION, authorizationCode: authorization.authorizationCode },
        changedSameJti,
      )).status).toBe(409);

      const otherEmail = `${emailPrefix}-wrong-link-owner@example.invalid`;
      await registerAndVerify(otherEmail, "Synthetic Different Account");
      const otherSession = await login(otherEmail);
      const otherCsrf = await setCsrf(otherSession.cookie);
      const otherConfirm = await request("/api/v1/product-links/signals/confirm", {
        method: "POST",
        cookie: otherSession.cookie,
        headers: { "x-csrf-token": otherCsrf },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: pending.linkId,
          consent: true,
          consentVersion: JOURNAL_CONFIRMATION_CONSENT_VERSION,
        },
      });
      expect(otherConfirm.status).toBe(404);
      const missingFinalConsent = await request("/api/v1/product-links/signals/confirm", {
        method: "POST",
        cookie: journalSession.cookie,
        headers: { "x-csrf-token": csrfToken },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: pending.linkId,
          consent: false,
          consentVersion: JOURNAL_CONFIRMATION_CONSENT_VERSION,
        },
      });
      expect(missingFinalConsent.status).toBe(400);
      const finalConfirmation = await request("/api/v1/product-links/signals/confirm", {
        method: "POST",
        cookie: journalSession.cookie,
        headers: { "x-csrf-token": csrfToken },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: pending.linkId,
          consent: true,
          consentVersion: JOURNAL_CONFIRMATION_CONSENT_VERSION,
        },
      });
      expect(finalConfirmation.status).toBe(200);
      expect(await finalConfirmation.json()).toMatchObject({ linkId: pending.linkId, state: "active" });

      const statusToken = signSignalsAssertion(baseClaims(subject, "status", { link_id: pending.linkId }));
      const serviceStatus = await servicePost(
        "/api/v1/product-links/signals/status",
        { contractVersion: LINK_CONTRACT_VERSION, linkId: pending.linkId },
        statusToken,
      );
      expect(serviceStatus.status).toBe(200);
      expect(await serviceStatus.json()).toMatchObject({ linkId: pending.linkId, state: "active" });
      const wrongStatusSubject = signSignalsAssertion(baseClaims(signalsSubject(), "status", { link_id: pending.linkId }));
      expect((await servicePost(
        "/api/v1/product-links/signals/status",
        { contractVersion: LINK_CONTRACT_VERSION, linkId: pending.linkId },
        wrongStatusSubject,
      )).status).toBe(404);

      const unlink = await request(`/api/v1/product-links/signals/${pending.linkId}`, {
        method: "DELETE",
        cookie: journalSession.cookie,
        headers: { "x-csrf-token": csrfToken },
      });
      expect(unlink.status).toBe(202);
      const unlinkBody = await unlink.json();
      expect(unlinkBody).toMatchObject({
        linkId: pending.linkId,
        state: "revocation_pending",
      });
      const pendingStatus = await request("/api/v1/product-links/signals", { cookie: journalSession.cookie });
      expect(await pendingStatus.json()).toMatchObject({ state: "revocation_pending" });

      const outboundAttempts: Array<{ token: string; body: string }> = [];
      const captureDelivery = async (_input: RequestInfo | URL, init?: RequestInit) => {
        const authorizationHeader = new Headers(init?.headers).get("authorization") ?? "";
        const token = authorizationHeader.replace(/^Bearer /, "");
        outboundAttempts.push({ token, body: String(init?.body) });
        if (outboundAttempts.length === 1) {
          return new Response("{}", { status: 503, headers: { "content-type": "application/json" } });
        }
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: body.linkId,
          state: "revoked",
          eventId: body.eventId,
          payloadHash: body.payloadHash,
        }), { status: 200, headers: { "content-type": "application/json" } });
      };
      const firstPass = await drainProductLinkOutboxOnce({ fetchImpl: captureDelivery as typeof fetch });
      expect(firstPass).toEqual({ claimed: 1, delivered: 0, retried: 1, blocked: 0 });
      const afterFailure = await testPool.query<{ state: string; attempt_count: number; canonical_payload: string; payload_hash: string }>(
        `SELECT state, attempt_count, canonical_payload, payload_hash
           FROM product_link_revocation_outbox WHERE event_id = $1`,
        [unlinkBody.eventId],
      );
      expect(afterFailure.rows[0]).toMatchObject({ state: "retry", attempt_count: 1 });
      const storedOutboundPayload = {
        contractVersion: LINK_CONTRACT_VERSION,
        eventId: unlinkBody.eventId,
        linkId: pending.linkId,
        reason: "user_unlinked",
      };
      expect(afterFailure.rows[0].canonical_payload).toBe(canonicalizeRevocationPayload(storedOutboundPayload));
      expect(afterFailure.rows[0].payload_hash).toBe(sha256(afterFailure.rows[0].canonical_payload));
      await expect(testPool.query(
        `UPDATE product_link_revocation_outbox
            SET reason = 'security_action' WHERE event_id = $1`,
        [unlinkBody.eventId],
      )).rejects.toThrow(/immutable/i);
      const retryDelay = await testPool.query<{ milliseconds: number }>(
        `SELECT EXTRACT(EPOCH FROM (next_attempt_at - NOW())) * 1000 AS milliseconds
           FROM product_link_revocation_outbox WHERE event_id = $1`,
        [unlinkBody.eventId],
      );
      expect(Number(retryDelay.rows[0].milliseconds)).toBeGreaterThan(8_000);
      expect((await testPool.query<{ state: string }>(
        "SELECT state FROM product_account_links WHERE id = $1",
        [pending.linkId],
      )).rows[0].state).toBe("revocation_pending");
      await testPool.query(
        `UPDATE product_link_revocation_outbox SET next_attempt_at = NOW() WHERE event_id = $1`,
        [unlinkBody.eventId],
      );
      const secondPass = await drainProductLinkOutboxOnce({ fetchImpl: captureDelivery as typeof fetch });
      expect(secondPass).toEqual({ claimed: 1, delivered: 1, retried: 0, blocked: 0 });
      expect(outboundAttempts).toHaveLength(2);
      expect(outboundAttempts[0].body).toBe(outboundAttempts[1].body);
      const parseJwt = (token: string) => {
        const [headerPart, claimPart, signaturePart] = token.split(".");
        const claims = JSON.parse(Buffer.from(claimPart, "base64url").toString("utf8"));
        expect(verify(
          "RSA-SHA256",
          Buffer.from(`${headerPart}.${claimPart}`),
          journalKeys.publicKey,
          Buffer.from(signaturePart, "base64url"),
        )).toBe(true);
        return claims;
      };
      const firstOutgoingClaims = parseJwt(outboundAttempts[0].token);
      const secondOutgoingClaims = parseJwt(outboundAttempts[1].token);
      expect(firstOutgoingClaims).toMatchObject({
        iss: JOURNAL_DEV_ISSUER,
        aud: SIGNALS_LINK_AUDIENCE,
        sub: JOURNAL_LINK_SERVICE_SUBJECT,
        action: "revoke",
        link_id: pending.linkId,
        event_id: unlinkBody.eventId,
        reason: "user_unlinked",
      });
      expect(secondOutgoingClaims.event_id).toBe(firstOutgoingClaims.event_id);
      expect(secondOutgoingClaims.link_id).toBe(firstOutgoingClaims.link_id);
      expect(secondOutgoingClaims.reason).toBe(firstOutgoingClaims.reason);
      expect(secondOutgoingClaims.jti).not.toBe(firstOutgoingClaims.jti);
      expect(secondOutgoingClaims.exp - secondOutgoingClaims.iat).toBe(120);
      expect(firstOutgoingClaims.payload_sha256).toBe(afterFailure.rows[0].payload_hash);
      const revoked = await testPool.query<{ state: string; partner_subject: string | null }>(
        `SELECT state, partner_subject FROM product_account_links WHERE id = $1`,
        [pending.linkId],
      );
      expect(revoked.rows[0]).toEqual({ state: "revoked", partner_subject: null });

      const invalidAckLink = await createActiveLink(
        `${emailPrefix}-mismatched-ack@example.invalid`,
        "Synthetic Mismatched Acknowledgement User",
      );
      const invalidAckUnlink = await request(`/api/v1/product-links/signals/${invalidAckLink.linkId}`, {
        method: "DELETE",
        cookie: invalidAckLink.session.cookie,
        headers: { "x-csrf-token": invalidAckLink.csrfToken },
      });
      expect(invalidAckUnlink.status).toBe(202);
      const mismatchedAckDelivery = async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({
          contractVersion: LINK_CONTRACT_VERSION,
          linkId: body.linkId,
          eventId: body.eventId,
          payloadHash: "0".repeat(64),
          state: "revoked",
        }), { status: 200, headers: { "content-type": "application/json" } });
      };
      const invalidAckPass = await drainProductLinkOutboxOnce({
        fetchImpl: mismatchedAckDelivery as typeof fetch,
      });
      expect(invalidAckPass).toEqual({ claimed: 1, delivered: 0, retried: 0, blocked: 1 });
      expect((await testPool.query<{ state: string }>(
        "SELECT state FROM product_account_links WHERE id = $1",
        [invalidAckLink.linkId],
      )).rows[0].state).toBe("revocation_pending");
      expect((await testPool.query<{ state: string }>(
        "SELECT state FROM product_link_revocation_outbox WHERE event_id = $1",
        [(await invalidAckUnlink.json()).eventId],
      )).rows[0].state).toBe("blocked");

      const inboundLink = await createActiveLink(
        `${emailPrefix}-inbound-revoke@example.invalid`,
        "Synthetic Inbound User",
      );
      const eventId = (await import("node:crypto")).randomUUID();
      const reason = "security_action";
      const revokePayload = (eventReason: string) => ({
        contractVersion: LINK_CONTRACT_VERSION,
        eventId,
        linkId: inboundLink.linkId,
        reason: eventReason,
      });
      const revokePayloadHash = (eventReason: string) =>
        sha256(canonicalizeRevocationPayload(revokePayload(eventReason)));
      const revokeClaims = (eventReason: string) => baseClaims(
        SIGNALS_LINK_SERVICE_SUBJECT,
        "revoke",
        {
          link_id: inboundLink.linkId,
          event_id: eventId,
          reason: eventReason,
          payload_sha256: revokePayloadHash(eventReason),
        },
      );
      const firstRevocationAssertion = signSignalsAssertion(revokeClaims(reason));
      const revocationBody = {
        ...revokePayload(reason),
        payloadHash: revokePayloadHash(reason),
      };
      const invalidPayloadHash = await servicePost(
        "/api/v1/product-links/signals/revocations",
        { ...revocationBody, payloadHash: "0".repeat(64) },
        firstRevocationAssertion,
      );
      expect(invalidPayloadHash.status).toBe(400);
      const firstRevocation = await servicePost(
        "/api/v1/product-links/signals/revocations",
        revocationBody,
        firstRevocationAssertion,
      );
      expect(firstRevocation.status).toBe(200);
      expect(await firstRevocation.json()).toMatchObject({
        contractVersion: LINK_CONTRACT_VERSION,
        linkId: inboundLink.linkId,
        state: "revoked",
        eventId,
        payloadHash: revocationBody.payloadHash,
      });
      const replayedJwt = await servicePost(
        "/api/v1/product-links/signals/revocations",
        revocationBody,
        firstRevocationAssertion,
      );
      expect(replayedJwt.status).toBe(409);
      const retriedRevocation = await servicePost(
        "/api/v1/product-links/signals/revocations",
        revocationBody,
        signSignalsAssertion(revokeClaims(reason)),
      );
      expect(retriedRevocation.status).toBe(200);
      const changedEventBody = await servicePost(
        "/api/v1/product-links/signals/revocations",
        {
          ...revokePayload("user_unlinked"),
          payloadHash: revokePayloadHash("user_unlinked"),
        },
        signSignalsAssertion(revokeClaims("user_unlinked")),
      );
      expect(changedEventBody.status).toBe(409);
      expect((await testPool.query(
        `SELECT 1 FROM product_link_revocation_mismatches
          WHERE partner_issuer = $1 AND event_id = $2
            AND expected_payload_hash = $3 AND received_payload_hash = $4`,
        [SIGNALS_DEV_ISSUER, eventId, revocationBody.payloadHash, revokePayloadHash("user_unlinked")],
      )).rowCount).toBe(1);

      const deletionLink = await createActiveLink(
        `${emailPrefix}-deleted-link@example.invalid`,
        "Synthetic Deleted Account",
      );
      const deletionRole = await testPool.query<{ id: number }>(
        "SELECT id FROM user_role WHERE user_id = $1 LIMIT 1",
        [`${emailPrefix}-deleted-link@example.invalid`],
      );
      await prepareProductLinkAccountLifecycle(deletionRole.rows[0].id, "account_deleted");
      expect((await testPool.query(
        "SELECT 1 FROM product_account_links WHERE id = $1",
        [deletionLink.linkId],
      )).rowCount).toBe(0);
      expect((await testPool.query(
        `SELECT 1 FROM product_link_revocation_outbox
          WHERE link_id = $1 AND reason = 'account_deleted' AND state = 'pending'`,
        [deletionLink.linkId],
      )).rowCount).toBe(1);
      expect((await testPool.query(
        "SELECT 1 FROM product_link_tombstones WHERE link_id = $1",
        [deletionLink.linkId],
      )).rowCount).toBe(1);

      const suspensionLink = await createActiveLink(
        `${emailPrefix}-suspended-link@example.invalid`,
        "Synthetic Suspended Account",
      );
      await prepareProductLinkAccountLifecycle(
        (await testPool.query<{ id: number }>(
          "SELECT id FROM user_role WHERE user_id = $1 LIMIT 1",
          [`${emailPrefix}-suspended-link@example.invalid`],
        )).rows[0].id,
        "account_suspended",
      );
      expect((await testPool.query<{ state: string }>(
        "SELECT state FROM product_account_links WHERE id = $1",
        [suspensionLink.linkId],
      )).rows[0].state).toBe("revocation_pending");
      expect((await testPool.query(
        `SELECT 1 FROM product_link_revocation_outbox
          WHERE link_id = $1 AND reason = 'account_suspended' AND state = 'pending'`,
        [suspensionLink.linkId],
      )).rowCount).toBe(1);

      const expiryEmail = `${emailPrefix}-expired-authorization@example.invalid`;
      await registerAndVerify(expiryEmail, "Synthetic Expiring Authorization");
      const expirySession = await login(expiryEmail);
      const expiryCsrf = await setCsrf(expirySession.cookie);
      const expiringAuthorizationResponse = await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: expirySession.cookie,
        headers: { "x-csrf-token": expiryCsrf },
        json: {
          contractVersion: LINK_CONTRACT_VERSION,
          consent: true,
          consentVersion: JOURNAL_INITIATION_CONSENT_VERSION,
        },
      });
      expect(expiringAuthorizationResponse.status).toBe(201);
      const expiringAuthorization = await expiringAuthorizationResponse.json();
      const expiredDigest = sha256(expiringAuthorization.authorizationCode);
      await testPool.query(
        `UPDATE product_link_authorizations
            SET created_at = NOW() - INTERVAL '10 minutes',
                expires_at = NOW() - INTERVAL '6 minutes'
          WHERE authorization_code_sha256 = $1`,
        [expiredDigest],
      );
      const expiredCodeAssertion = claimAssertion(
        expiringAuthorization.authorizationCode,
        expiringAuthorization.journalAttemptLabel,
        signalsSubject(),
      );
      const expiredCodeClaim = await servicePost(
        "/api/v1/product-links/signals/claim",
        {
          contractVersion: LINK_CONTRACT_VERSION,
          authorizationCode: expiringAuthorization.authorizationCode,
        },
        expiredCodeAssertion,
      );
      expect(expiredCodeClaim.status).toBe(409);
    } finally {
      csrfDiagnosticSpy.mockRestore();
      for (const key of envKeys) {
        const value = savedEnv[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("preserves legacy null-status PRO and labels new founding-member access explicitly", async () => {
    const legacyEmail = `${emailPrefix}-legacy-pro-null-status@example.invalid`;
    await registerAndVerify(legacyEmail, "Synthetic Legacy Founder");
    const legacy = await login(legacyEmail);

    const signupState = await testPool.query<{
      founding_member: boolean;
      subscription_status: string | null;
      founding_member_pro_expiry: Date | null;
      created_at: Date;
    }>(
      `SELECT founding_member, subscription_status, founding_member_pro_expiry, created_at
       FROM user_role WHERE user_id = $1`,
      [legacyEmail],
    );
    if (signupState.rows[0]?.founding_member) {
      expect(signupState.rows[0].subscription_status).toBe("founding_member_access");
      expect(signupState.rows[0].founding_member_pro_expiry).toBeTruthy();
      const grantDuration =
        new Date(signupState.rows[0].founding_member_pro_expiry!).getTime() -
        new Date(signupState.rows[0].created_at).getTime();
      expect(grantDuration).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000 - 10_000);
      expect(grantDuration).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 10_000);
    }

    await testPool.query(
      `UPDATE user_role
       SET subscription_tier = 'PRO',
           founding_member = TRUE,
           founding_member_pro_expiry = NOW() - INTERVAL '1 day',
           subscription_status = NULL
       WHERE user_id = $1`,
      [legacyEmail],
    );

    try {
      const profile = await request("/api/user", { cookie: legacy.cookie });
      expect(profile.status).toBe(200);
      expect(await profile.json()).toMatchObject({
        subscriptionTier: "PRO",
        subscriptionStatus: null,
      });

      const preserved = await testPool.query<{
        subscription_tier: string;
        subscription_status: string | null;
      }>(
        "SELECT subscription_tier, subscription_status FROM user_role WHERE user_id = $1",
        [legacyEmail],
      );
      expect(preserved.rows[0]).toEqual({
        subscription_tier: "PRO",
        subscription_status: null,
      });

      // Once a new grant is explicitly identified, its elapsed 30-day expiry
      // still downgrades it; the legacy-null exception is not a blanket grant.
      await testPool.query(
        `UPDATE user_role
         SET subscription_status = 'founding_member_access',
             founding_member_pro_expiry = NOW() - INTERVAL '1 day'
         WHERE user_id = $1`,
        [legacyEmail],
      );
      const expiredFounder = await request("/api/user", { cookie: legacy.cookie });
      expect(expiredFounder.status).toBe(200);
      expect(await expiredFounder.json()).toMatchObject({ subscriptionTier: "FREE" });
    } finally {
      await testPool.query(
        `UPDATE user_role
         SET subscription_tier = 'FREE',
             founding_member = FALSE,
             founding_member_pro_expiry = NULL,
             subscription_status = NULL
         WHERE user_id = $1`,
        [legacyEmail],
      );
    }
  });

  it("does not let profile data or request headers alter entitlements and preserves paid cancellation grace", async () => {
    await testPool.query(
      `UPDATE user_role
       SET subscription_tier = 'FREE',
           subscription_status = NULL,
           subscription_provider = NULL,
           founding_member = FALSE,
           founding_member_pro_expiry = NULL,
           stripe_subscription_id = NULL,
           paypal_subscription_id = NULL
       WHERE user_id = $1`,
      [aliceEmail],
    );
    const alice = await login(aliceEmail);
    try {
      const forgedProfile = await request("/api/user/update-profile", {
        method: "POST",
        cookie: alice.cookie,
        headers: { "x-user-id": bobEmail },
        json: {
          country: "US",
          subscriptionTier: "PRO",
          subscriptionStatus: "active",
          foundingMember: true,
          foundingMemberProExpiry: "2099-01-01T00:00:00.000Z",
          subscriptionProvider: "stripe",
        },
      });
      expect(forgedProfile.status).toBe(200);

      const afterProfileAttempt = await testPool.query<{
        subscription_tier: string;
        subscription_status: string | null;
        founding_member: boolean;
        founding_member_pro_expiry: Date | null;
        subscription_provider: string | null;
      }>(
        `SELECT subscription_tier, subscription_status, founding_member,
                founding_member_pro_expiry, subscription_provider
         FROM user_role WHERE user_id = $1`,
        [aliceEmail],
      );
      expect(afterProfileAttempt.rows[0]).toEqual({
        subscription_tier: "FREE",
        subscription_status: null,
        founding_member: false,
        founding_member_pro_expiry: null,
        subscription_provider: null,
      });

      const forgedRead = await request(
        "/api/user?subscriptionTier=PRO&subscriptionStatus=active&foundingMemberProExpiry=2099-01-01",
        {
          cookie: alice.cookie,
          headers: { "x-user-id": bobEmail, "x-subscription-tier": "PRO" },
        },
      );
      expect(forgedRead.status).toBe(200);
      expect(await forgedRead.json()).toMatchObject({
        userId: aliceEmail,
        subscriptionTier: "FREE",
        subscriptionStatus: null,
      });

      // An expired founder grant cannot override a still-current paid
      // subscription, including the provider's cancellation grace period.
      await testPool.query(
        `UPDATE user_role
         SET subscription_tier = 'PRO',
             subscription_status = 'active',
             subscription_provider = 'stripe',
             founding_member = TRUE,
             founding_member_pro_expiry = NOW() - INTERVAL '1 day',
             stripe_subscription_id = $2
         WHERE user_id = $1`,
        [aliceEmail, `sub_active_${testRunId}`],
      );
      const paidActive = await request("/api/user", { cookie: alice.cookie });
      expect((await paidActive.json()).subscriptionTier).toBe("PRO");

      await testPool.query(
        `UPDATE user_role
         SET subscription_status = 'cancelled',
             subscription_provider = 'paypal',
             paypal_subscription_id = $2
         WHERE user_id = $1`,
        [aliceEmail, `I-cancelled-${testRunId}`],
      );
      const paidCancelled = await request("/api/user", { cookie: alice.cookie });
      expect((await paidCancelled.json())).toMatchObject({
        subscriptionTier: "PRO",
        subscriptionStatus: "cancelled",
      });

      await testPool.query(
        `UPDATE user_role
         SET subscription_tier = 'FREE',
             subscription_status = NULL,
             founding_member = FALSE,
             founding_member_pro_expiry = NULL,
             subscription_provider = NULL,
             paypal_subscription_id = NULL
         WHERE user_id = $1`,
        [aliceEmail],
      );
      const originalNodeEnv = process.env.NODE_ENV;
      const originalBillingFlag = process.env.LIVE_BILLING_ENABLED;
      process.env.NODE_ENV = "production";
      process.env.LIVE_BILLING_ENABLED = "true";
      vi.mocked(capturePaypalOrder).mockImplementationOnce(async (_req, res) => {
        res.status(200).json({ status: "COMPLETED", id: `ORDER-${testRunId}` });
      });
      try {
        const completedOneTimeOrder = await request(
          `/api/paypal/order/ORDER-${testRunId}/capture`,
          { method: "POST", cookie: alice.cookie, json: {} },
        );
        expect(completedOneTimeOrder.status).toBe(200);
        expect((await testPool.query(
          "SELECT subscription_tier, subscription_status FROM user_role WHERE user_id = $1",
          [aliceEmail],
        )).rows[0]).toEqual({
          subscription_tier: "FREE",
          subscription_status: null,
        });
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalBillingFlag === undefined) delete process.env.LIVE_BILLING_ENABLED;
        else process.env.LIVE_BILLING_ENABLED = originalBillingFlag;
        vi.mocked(capturePaypalOrder).mockReset();
      }
    } finally {
      await testPool.query(
        `UPDATE user_role
         SET subscription_tier = 'FREE',
             subscription_status = NULL,
             subscription_provider = NULL,
             founding_member = FALSE,
             founding_member_pro_expiry = NULL,
             stripe_subscription_id = NULL,
             paypal_subscription_id = NULL
         WHERE user_id = $1`,
        [aliceEmail],
      );
    }
  });

  it("keeps production billing, MT5 sync, registration, and email recovery off by default", async () => {
    const alice = await login(aliceEmail);
    const envKeys = [
      "NODE_ENV",
      "LIVE_BILLING_ENABLED",
      "EMAIL_DELIVERY_ENABLED",
      "SMTP_USER",
      "SMTP_APP_PASSWORD",
      "MT5_SYNC_ENABLED",
    ] as const;
    const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    const disabledEmail = `${emailPrefix}-signup-disabled@example.invalid`;
    try {
      process.env.NODE_ENV = "production";
      process.env.LIVE_BILLING_ENABLED = "false";
      process.env.EMAIL_DELIVERY_ENABLED = "false";
      process.env.MT5_SYNC_ENABLED = "false";
      delete process.env.SMTP_USER;
      delete process.env.SMTP_APP_PASSWORD;

      const registration = await request("/api/auth/register", {
        method: "POST",
        json: {
          email: disabledEmail,
          password: testPassword,
          fullName: "Registration Disabled",
          country: "US",
          timezone: "UTC",
        },
      });
      expect(registration.status).toBe(503);
      expect((await testPool.query(
        "SELECT user_id FROM user_role WHERE user_id = $1",
        [disabledEmail],
      )).rowCount).toBe(0);

      expect((await request("/api/auth/resend-verification", {
        method: "POST",
        json: { email: aliceEmail },
      })).status).toBe(503);
      expect((await request("/api/user/reset-password-request", {
        method: "POST",
        json: { email: aliceEmail },
      })).status).toBe(503);

      expect((await request("/api/stripe/subscribe", {
        method: "POST",
        cookie: alice.cookie,
        json: { tier: "PRO", period: "monthly" },
      })).status).toBe(503);
      expect((await request("/api/paypal/subscribe", {
        method: "POST",
        cookie: alice.cookie,
        json: { tier: "PRO", period: "monthly" },
      })).status).toBe(503);
      expect((await request("/api/paypal/setup", {
        cookie: alice.cookie,
      })).status).toBe(503);
      expect((await request("/api/paypal/order", {
        method: "POST",
        cookie: alice.cookie,
        json: { amount: "1.00", currency: "USD", intent: "CAPTURE" },
      })).status).toBe(503);
      expect((await request(`/api/paypal/order/ORDER-${testRunId}/capture`, {
        method: "POST",
        cookie: alice.cookie,
        json: {},
      })).status).toBe(503);
      expect((await request("/api/mt5/sync", {
        method: "POST",
        json: { userId: aliceEmail, token: "synthetic-token" },
      })).status).toBe(503);
    } finally {
      for (const key of envKeys) {
        const value = savedEnv[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("provisions a private MT5 token, permits valid bridge sync, and blocks cross-user account reads", async () => {
    const originalDevMt5SyncEnabled = process.env.DEV_MT5_SYNC_ENABLED;
    process.env.DEV_MT5_SYNC_ENABLED = "true";
    try {
    await registerAndVerify(bobEmail, "Synthetic Bob");
    const alice = await login(aliceEmail);
    const bob = await login(bobEmail);

    const generated = await request("/api/traders-hub/generate-token", {
      method: "POST",
      cookie: alice.cookie,
      json: {},
    });
    expect(generated.status).toBe(200);
    const token = (await generated.json()).token as string;
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    const revealed = await request("/api/traders-hub/reveal-token", {
      method: "POST",
      cookie: alice.cookie,
      json: {},
    });
    expect(revealed.status).toBe(200);
    expect((await revealed.json()).syncToken).toBe(token);

    for (const path of [
      `/api/mt5/status/${encodeURIComponent(bobEmail)}`,
      `/api/mt5/accounts/${encodeURIComponent(bobEmail)}`,
      `/api/traders-hub/user-role/${encodeURIComponent(bobEmail)}`,
    ]) {
      const response = await request(path, { cookie: alice.cookie });
      expect(response.status).toBe(403);
    }

    const rejectedSync = await request("/api/mt5/sync", {
      method: "POST",
      json: {
        userId: aliceEmail,
        token: "incorrect-local-token",
        accountNumber: "SYNTHETIC-MT5-1",
        balance: 10000,
        equity: 10000,
        history: [],
        positions: [],
      },
    });
    expect(rejectedSync.status).toBe(403);

    const syntheticTicket = `${testRunId}-MT5-1`;
    const syncTime = Math.floor(Date.now() / 1000);
    const validSync = await request("/api/mt5/sync", {
      method: "POST",
      json: {
        userId: aliceEmail,
        token,
        accountNumber: "SYNTHETIC-MT5-1",
        broker: "Synthetic Broker",
        server: "Synthetic Demo",
        currency: "USD",
        balance: 10012.5,
        equity: 10012.5,
        margin: 0,
        freeMargin: 10012.5,
        marginLevel: 0,
        floatingPl: 0,
        leverage: 100,
        history: [{
          ticket: syntheticTicket,
          symbol: "EURUSD",
          direction: "Buy",
          volume: "0.25",
          price: "1.08500",
          open_time: syncTime - 3600,
          close_time: syncTime - 1800,
          profit: "12.50",
          commission: "-1.00",
          swap: "-0.25",
          sl: "1.08000",
          tp: "1.09500",
        }],
        positions: [],
      },
    });
    expect(validSync.status).toBe(200);

    const accounts = await request(`/api/mt5/accounts/${encodeURIComponent(aliceEmail)}`, {
      cookie: alice.cookie,
    });
    expect(accounts.status).toBe(200);
    expect(await accounts.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ accountNumber: "SYNTHETIC-MT5-1" })]),
    );

    const historyResponse = await request(`/api/mt5/history/${encodeURIComponent(aliceEmail)}`, {
      cookie: alice.cookie,
    });
    expect(historyResponse.status).toBe(200);
    const importedHistory = await historyResponse.json();
    expect(importedHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticket: syntheticTicket,
          userId: aliceEmail,
          symbol: "EURUSD",
          direction: "Buy",
          volume: "0.25",
          entryPrice: "1.08500",
          exitPrice: "1.08500",
          grossPl: "12.5",
          commission: "-1",
          swap: "-0.25",
          netPl: "11.25",
          mt5AccountId: "SYNTHETIC-MT5-1",
        }),
      ]),
    );
    } finally {
      if (originalDevMt5SyncEnabled === undefined) {
        delete process.env.DEV_MT5_SYNC_ENABLED;
      } else {
        process.env.DEV_MT5_SYNC_ENABLED = originalDevMt5SyncEnabled;
      }
    }
  });

  it("keeps prop-firm challenges private to their owner", async () => {
    const alice = await login(aliceEmail);
    const bob = await login(bobEmail);
    const created = await request("/api/prop-firm/challenges", {
      method: "POST",
      cookie: alice.cookie,
      json: {
        firmName: "Synthetic Firm",
        challengeName: "Disposable ownership check",
        accountSize: "100000",
        profitTarget: "10",
        dailyDrawdownLimit: "5",
        maxDrawdownLimit: "10",
        startDate: new Date().toISOString(),
      },
    });
    expect(created.status).toBe(201);
    const challenge = await created.json();
    const challengeId = challenge.id as number;

    const riskCheck = await request("/api/prop-firm/risk-check", {
      method: "POST",
      cookie: alice.cookie,
      json: {
        challengeId,
        tradeDirection: "Buy",
        pair: "EURUSD",
        entryPrice: "1.10000",
        stopLoss: "1.04000",
        lotSize: "1",
        currentPl: "0",
      },
    });
    expect(riskCheck.status).toBe(200);
    const riskResult = await riskCheck.json();
    expect(riskResult.metrics).toMatchObject({
      dailyDDRemaining: 5000,
      maxDDRemaining: 10000,
    });
    expect(riskResult.metrics.potentialLoss).toBeCloseTo(6000, 5);
    expect(riskResult.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "critical" }),
      ]),
    );
    expect((await request("/api/prop-firm/risk-check", {
      method: "POST",
      cookie: bob.cookie,
      json: {
        challengeId,
        tradeDirection: "Buy",
        pair: "EURUSD",
        entryPrice: "1.10000",
        stopLoss: "1.04000",
        lotSize: "1",
      },
    })).status).toBe(404);

    expect((await request(`/api/prop-firm/challenges/${challengeId}`, {
      cookie: alice.cookie,
    })).status).toBe(200);
    expect((await request(`/api/prop-firm/challenges/${challengeId}`, {
      cookie: bob.cookie,
    })).status).toBe(404);
    expect((await request(`/api/prop-firm/challenges/${challengeId}`, {
      method: "PATCH",
      cookie: bob.cookie,
      json: { currentBalance: "999999" },
    })).status).toBe(404);
    expect((await request(`/api/prop-firm/challenges/${challengeId}`, {
      method: "DELETE",
      cookie: bob.cookie,
    })).status).toBe(404);

    const unchanged = await testPool.query<{ current_balance: string }>(
      "SELECT current_balance FROM prop_firm_challenges WHERE id = $1 AND user_id = $2",
      [challengeId, aliceEmail],
    );
    expect(unchanged.rows[0]?.current_balance).toBe("100000");

    expect((await request(`/api/prop-firm/challenges/${challengeId}`, {
      method: "DELETE",
      cookie: alice.cookie,
    })).status).toBe(204);
  });

  it("restricts admin actions and redacts historical audit credentials", async () => {
    await registerAndVerify(adminEmail, "Synthetic Admin");
    const alice = await login(aliceEmail);
    const admin = await login(adminEmail);
    await testPool.query(
      "INSERT INTO admin_access (email, access_key, label, is_active) VALUES ($1, $2, $3, true)",
      [adminEmail, "local-only-admin-key", "Disposable integration test"],
    );

    const originalEnv = {
      NODE_ENV: process.env.NODE_ENV,
      EMAIL_DELIVERY_ENABLED: process.env.EMAIL_DELIVERY_ENABLED,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_APP_PASSWORD: process.env.SMTP_APP_PASSWORD,
    };
    const resetStateBefore = await testPool.query<{
      password_reset_token: string | null;
      password_reset_expiry: Date | null;
    }>(
      "SELECT password_reset_token, password_reset_expiry FROM user_role WHERE user_id = $1",
      [aliceEmail],
    );
    try {
      process.env.NODE_ENV = "production";
      process.env.EMAIL_DELIVERY_ENABLED = "false";
      delete process.env.SMTP_USER;
      delete process.env.SMTP_APP_PASSWORD;

      const disabledAdminReset = await request(
        `/api/admin/users/${encodeURIComponent(aliceEmail)}/send-password-reset`,
        { method: "POST", cookie: admin.cookie },
      );
      expect(disabledAdminReset.status).toBe(503);
      expect(await disabledAdminReset.json()).toMatchObject({
        message: "Password recovery is temporarily unavailable.",
      });
      const resetStateAfter = await testPool.query<{
        password_reset_token: string | null;
        password_reset_expiry: Date | null;
      }>(
        "SELECT password_reset_token, password_reset_expiry FROM user_role WHERE user_id = $1",
        [aliceEmail],
      );
      expect(resetStateAfter.rows[0]?.password_reset_token).toBe(
        resetStateBefore.rows[0]?.password_reset_token,
      );
      expect(resetStateAfter.rows[0]?.password_reset_expiry?.getTime()).toBe(
        resetStateBefore.rows[0]?.password_reset_expiry?.getTime(),
      );
    } finally {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }

    const blockedList = await request("/api/admin/users", { cookie: alice.cookie });
    expect(blockedList.status).toBe(403);
    const blockedPlanChange = await request("/api/admin/update-user", {
      method: "POST",
      cookie: alice.cookie,
      json: { targetUserId: aliceEmail, updates: { subscriptionTier: "ELITE" } },
    });
    expect(blockedPlanChange.status).toBe(403);

    const blockedPromotion = await request("/api/admin/update-user", {
      method: "POST",
      cookie: admin.cookie,
      json: { targetUserId: aliceEmail, updates: { role: "OWNER" } },
    });
    expect(blockedPromotion.status).toBe(403);

    await testPool.query(
      `INSERT INTO admin_audit_log (admin_id, action_type, target_user_id, details)
       VALUES ($1, 'TEST_REDACTION', $2, $3::jsonb)`,
      [
        adminEmail,
        aliceEmail,
        JSON.stringify({
          syncToken: "synthetic-sync-canary",
          passwordHash: "synthetic-password-canary",
          stripeCustomerId: "synthetic-customer-canary",
          nested: { paypalSubscriptionId: "synthetic-paypal-canary", visible: "kept" },
        }),
      ],
    );
    const logsResponse = await request("/api/admin/audit-logs", { cookie: admin.cookie });
    expect(logsResponse.status).toBe(200);
    const logs = await logsResponse.json();
    const logsText = JSON.stringify(logs);
    for (const canary of [
      "synthetic-sync-canary",
      "synthetic-password-canary",
      "synthetic-customer-canary",
      "synthetic-paypal-canary",
    ]) {
      expect(logsText).not.toContain(canary);
    }
    expect(logsText).toContain("[REDACTED]");
  });

  it("grants Stripe entitlement only after a locally signed test event and verifies the raw request bytes", async () => {
    await testPool.query(
      "UPDATE user_role SET subscription_tier = 'FREE', subscription_status = 'active' WHERE user_id = $1",
      [aliceEmail],
    );
    const event = {
      id: `evt_local_${testRunId}`,
      object: "event",
      api_version: "2025-11-17.clover",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: `cs_local_${testRunId}`,
          object: "checkout.session",
          mode: "subscription",
          subscription: `sub_local_${testRunId}`,
          customer: `cus_local_${testRunId}`,
          metadata: { tradify_user_id: aliceEmail, tradify_tier: "PRO" },
        },
      },
      livemode: false,
      pending_webhooks: 0,
      type: "checkout.session.completed",
    };
    const payload = JSON.stringify(event, null, 2);

    const forged = await request("/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=not-a-valid-signature" },
      body: payload,
    });
    expect(forged.status).toBe(400);
    const afterForged = await testPool.query<{ subscription_tier: string }>(
      "SELECT subscription_tier FROM user_role WHERE user_id = $1",
      [aliceEmail],
    );
    expect(afterForged.rows[0]?.subscription_tier).toBe("FREE");

    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: stripeWebhookSecret,
    });
    const accepted = await request("/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload,
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ received: true });
    const afterSigned = await testPool.query<{
      subscription_tier: string;
      subscription_status: string;
      stripe_customer_id: string;
      stripe_subscription_id: string;
    }>(
      "SELECT subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id FROM user_role WHERE user_id = $1",
      [aliceEmail],
    );
    expect(afterSigned.rows[0]).toMatchObject({
      subscription_tier: "PRO",
      subscription_status: "active",
      stripe_customer_id: `cus_local_${testRunId}`,
      stripe_subscription_id: `sub_local_${testRunId}`,
    });

    const deletedEvent = {
      id: `evt_local_deleted_${testRunId}`,
      object: "event",
      api_version: "2025-11-17.clover",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: `sub_local_${testRunId}`,
          object: "subscription",
          status: "canceled",
        },
      },
      livemode: false,
      pending_webhooks: 0,
      type: "customer.subscription.deleted",
    };
    const deletedPayload = JSON.stringify(deletedEvent);
    const invalidDeletion = await request("/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=not-a-valid-signature" },
      body: deletedPayload,
    });
    expect(invalidDeletion.status).toBe(400);
    expect((await testPool.query(
      "SELECT subscription_tier FROM user_role WHERE user_id = $1",
      [aliceEmail],
    )).rows[0]?.subscription_tier).toBe("PRO");

    const deletionSignature = Stripe.webhooks.generateTestHeaderString({
      payload: deletedPayload,
      secret: stripeWebhookSecret,
    });
    const verifiedDeletion = await request("/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": deletionSignature },
      body: deletedPayload,
    });
    expect(verifiedDeletion.status).toBe(200);
    expect((await testPool.query(
      "SELECT subscription_tier, subscription_status FROM user_role WHERE user_id = $1",
      [aliceEmail],
    )).rows[0]).toEqual({
      subscription_tier: "FREE",
      subscription_status: "canceled",
    });
  });

  it("passes the exact PayPal raw body to signature verification while mocking provider HTTP", async () => {
    await testPool.query(
      "UPDATE user_role SET subscription_tier = 'FREE', subscription_status = 'active', subscription_provider = NULL, paypal_subscription_id = NULL WHERE user_id = $1",
      [bobEmail],
    );
    const payload = {
      id: `WH-local-${testRunId}`,
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      resource: {
        id: `I-local-${testRunId}`,
        status: "ACTIVE",
        custom_id: bobEmail,
        plan_id: `P-local-${testRunId}`,
        billing_info: { next_billing_time: "2026-11-14T00:00:00Z" },
      },
    };
    const rawBody = `${JSON.stringify(payload, null, 2)}\n`;
    const providerCalls: string[] = [];
    let verificationStatus: "SUCCESS" | "FAILURE" = "FAILURE";
    let expectedWebhookEvent: typeof payload = payload;
    const paypalFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.startsWith("https://api-m.sandbox.paypal.com/")) {
        throw new Error("Unexpected outbound request in local payment test.");
      }
      providerCalls.push(url);
      if (url.endsWith("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "local-only-mock-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/v1/notifications/verify-webhook-signature")) {
        const body = JSON.parse(String(init?.body));
        expect(body.webhook_event).toEqual(expectedWebhookEvent);
        return new Response(JSON.stringify({ verification_status: verificationStatus }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error("Unexpected PayPal endpoint in local payment test.");
    });
    const handler = vi.spyOn(paypalService, "handleWebhook");
    vi.stubGlobal("fetch", paypalFetch);
    try {
      const rejected = await request("/api/paypal/webhook", {
        method: "POST",
        headers: {
          "paypal-auth-algo": "SHA256withRSA",
          "paypal-cert-url": "https://example.invalid/test-cert",
          "paypal-transmission-id": `transmission-${testRunId}`,
          "paypal-transmission-sig": "synthetic-signature",
          "paypal-transmission-time": "2026-10-14T12:00:00Z",
        },
        body: rawBody,
      });
      expect(rejected.status).toBe(500);
      const afterRejected = await testPool.query<{ subscription_tier: string; paypal_subscription_id: string | null }>(
        "SELECT subscription_tier, paypal_subscription_id FROM user_role WHERE user_id = $1",
        [bobEmail],
      );
      expect(afterRejected.rows[0]).toMatchObject({
        subscription_tier: "FREE",
        paypal_subscription_id: null,
      });

      verificationStatus = "SUCCESS";
      const response = await request("/api/paypal/webhook", {
        method: "POST",
        headers: {
          "paypal-auth-algo": "SHA256withRSA",
          "paypal-cert-url": "https://example.invalid/test-cert",
          "paypal-transmission-id": `transmission-${testRunId}`,
          "paypal-transmission-sig": "synthetic-signature",
          "paypal-transmission-time": "2026-10-14T12:00:00Z",
        },
        body: rawBody,
      });
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[0][0]).toEqual(payload);
      expect(handler.mock.calls[0][2]).toBe(rawBody);
      expect(handler.mock.calls[1][2]).toBe(rawBody);
      expect(providerCalls).toHaveLength(4);

      const entitlement = await testPool.query<{
        subscription_tier: string;
        subscription_provider: string;
        paypal_subscription_id: string;
      }>(
        "SELECT subscription_tier, subscription_provider, paypal_subscription_id FROM user_role WHERE user_id = $1",
        [bobEmail],
      );
      expect(entitlement.rows[0]).toMatchObject({
        subscription_tier: "PRO",
        subscription_provider: "paypal",
        paypal_subscription_id: `I-local-${testRunId}`,
      });

      const deliverVerifiedEvent = async (
        eventType: "BILLING.SUBSCRIPTION.CANCELLED" | "BILLING.SUBSCRIPTION.EXPIRED",
        status: "CANCELLED" | "EXPIRED",
      ) => {
        const event = {
          id: `WH-local-${status}-${testRunId}`,
          event_type: eventType,
          resource: {
            id: `I-local-${testRunId}`,
            status,
            custom_id: bobEmail,
            plan_id: `P-local-${testRunId}`,
          },
        };
        expectedWebhookEvent = event as typeof payload;
        return request("/api/paypal/webhook", {
          method: "POST",
          headers: {
            "paypal-auth-algo": "SHA256withRSA",
            "paypal-cert-url": "https://example.invalid/test-cert",
            "paypal-transmission-id": `transmission-${status}-${testRunId}`,
            "paypal-transmission-sig": "synthetic-signature",
            "paypal-transmission-time": "2026-10-14T12:00:00Z",
          },
          body: JSON.stringify(event),
        });
      };

      const cancellation = await deliverVerifiedEvent(
        "BILLING.SUBSCRIPTION.CANCELLED",
        "CANCELLED",
      );
      expect(cancellation.status).toBe(200);
      expect((await testPool.query(
        "SELECT subscription_tier, subscription_status FROM user_role WHERE user_id = $1",
        [bobEmail],
      )).rows[0]).toEqual({
        subscription_tier: "PRO",
        subscription_status: "cancelled",
      });

      const expiration = await deliverVerifiedEvent(
        "BILLING.SUBSCRIPTION.EXPIRED",
        "EXPIRED",
      );
      expect(expiration.status).toBe(200);
      expect((await testPool.query(
        "SELECT subscription_tier, subscription_status FROM user_role WHERE user_id = $1",
        [bobEmail],
      )).rows[0]).toEqual({
        subscription_tier: "FREE",
        subscription_status: "expired",
      });
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("returns 410 for retired AI routes before any legacy inference handler", async () => {
    const response = await request(`/api/ai/insights/${encodeURIComponent(aliceEmail)}`);
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ message: "AI features have been removed." });
  });
});
