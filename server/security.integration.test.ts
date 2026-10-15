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

const { isolatedEmailService, capturedPasswordResetLink } = vi.hoisted(() => {
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

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({
    limit: "50mb",
    verify: (req, _res, body) => {
      (req as any).rawBody = Buffer.from(body);
    },
  }));
  app.use(express.urlencoded({ extended: false }));
  appServer = createServer(app);
  await registerRoutes(appServer, app);
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

  it("keeps Signals linking disabled by default and requires a signed, consented, single-use assertion", async () => {
    await registerAndVerify(linkingEmail, "Synthetic Linking User");
    const journalSession = await login(linkingEmail);
    const envKeys = [
      "NODE_ENV",
      "DEV_PRODUCT_LINKING_ENABLED",
      "PRODUCT_LINKING_ENABLED",
      "PRODUCT_LINKING_VERIFIED",
      "TRADIFY_SIGNALS_ISSUER",
      "TRADIFY_SIGNALS_KEY_ID",
      "TRADIFY_SIGNALS_PUBLIC_KEY",
    ] as const;
    const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    const crypto = await import("node:crypto");
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const issuer = "https://signals.test.invalid";
    const keyId = "synthetic-key-1";
    const consentVersion = "tradify-account-linking-v1";
    const createAssertion = (claims: Record<string, unknown>) => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: keyId })).toString("base64url");
      const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
      const signingInput = `${header}.${payload}`;
      const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
      return `${signingInput}.${signature}`;
    };
    const buildClaims = (authorizationCode: string, jti = crypto.randomUUID()) => {
      const now = Math.floor(Date.now() / 1000);
      return {
        iss: issuer,
        aud: "tradify-journal-link-v1",
        sub: "signals-user-opaque-001",
        iat: now,
        exp: now + 90,
        jti,
        consent: true,
        consent_at: now,
        consent_version: consentVersion,
        code_sha256: crypto.createHash("sha256").update(authorizationCode).digest("hex"),
      };
    };

    try {
      process.env.NODE_ENV = "test";
      delete process.env.DEV_PRODUCT_LINKING_ENABLED;
      expect((await request("/api/v1/product-links/signals", {
        cookie: journalSession.cookie,
      })).status).toBe(503);
      expect((await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: journalSession.cookie,
        json: { consent: true, consentVersion },
      })).status).toBe(503);
      expect((await request("/api/v1/product-links/signals/claim", {
        method: "POST",
        headers: { authorization: "Bearer not-a-real-assertion" },
        json: { authorizationCode: "a".repeat(64) },
      })).status).toBe(503);

      process.env.NODE_ENV = "production";
      process.env.PRODUCT_LINKING_ENABLED = "true";
      process.env.PRODUCT_LINKING_VERIFIED = "false";
      expect((await request("/api/v1/product-links/signals", {
        cookie: journalSession.cookie,
      })).status).toBe(503);

      process.env.NODE_ENV = "test";
      process.env.DEV_PRODUCT_LINKING_ENABLED = "true";
      delete process.env.PRODUCT_LINKING_ENABLED;
      delete process.env.PRODUCT_LINKING_VERIFIED;
      process.env.TRADIFY_SIGNALS_ISSUER = issuer;
      process.env.TRADIFY_SIGNALS_KEY_ID = keyId;
      process.env.TRADIFY_SIGNALS_PUBLIC_KEY = publicKey.export({
        type: "spki",
        format: "pem",
      }).toString();
      expect((await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: journalSession.cookie,
        json: { consent: false, consentVersion },
      })).status).toBe(400);

      const authorizationResponse = await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: journalSession.cookie,
        json: { consent: true, consentVersion },
      });
      expect(authorizationResponse.status).toBe(201);
      const authorization = await authorizationResponse.json();
      expect(authorization.authorizationCode).toMatch(/^[a-f0-9]{64}$/);
      expect(new Date(authorization.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const invalidAssertion = createAssertion({
        ...buildClaims(authorization.authorizationCode),
        code_sha256: crypto.createHash("sha256").update("not-the-authorization-code").digest("hex"),
      });
      expect((await request("/api/v1/product-links/signals/claim", {
        method: "POST",
        headers: { authorization: `Bearer ${invalidAssertion}` },
        json: { authorizationCode: authorization.authorizationCode },
      })).status).toBe(401);

      const assertion = createAssertion(buildClaims(authorization.authorizationCode));
      const claimResponse = await request("/api/v1/product-links/signals/claim", {
        method: "POST",
        headers: { authorization: `Bearer ${assertion}` },
        json: { authorizationCode: authorization.authorizationCode },
      });
      expect(claimResponse.status).toBe(201);
      const linked = await claimResponse.json();
      expect(linked).toMatchObject({ status: "linked" });
      expect(linked.linkId).toBeTruthy();
      expect(JSON.stringify(linked)).not.toContain(linkingEmail);
      expect(JSON.stringify(linked)).not.toContain("signals-user-opaque-001");

      const replayedAssertion = await request("/api/v1/product-links/signals/claim", {
        method: "POST",
        headers: { authorization: `Bearer ${assertion}` },
        json: { authorizationCode: authorization.authorizationCode },
      });
      expect(replayedAssertion.status).toBe(200);
      expect(await replayedAssertion.json()).toMatchObject({ linkId: linked.linkId, status: "linked" });

      const linkStatus = await request("/api/v1/product-links/signals", {
        cookie: journalSession.cookie,
      });
      expect(linkStatus.status).toBe(200);
      expect(await linkStatus.json()).toMatchObject({ linked: true });

      const expiredAuthorizationResponse = await request("/api/v1/product-links/signals/authorization", {
        method: "POST",
        cookie: journalSession.cookie,
        json: { consent: true, consentVersion },
      });
      const expiredAuthorization = await expiredAuthorizationResponse.json();
      const expiredDigest = crypto.createHash("sha256").update(expiredAuthorization.authorizationCode).digest("hex");
      await testPool.query(
        `UPDATE product_link_authorizations
         SET created_at = NOW() - INTERVAL '10 minutes',
             expires_at = NOW() - INTERVAL '1 second'
         WHERE authorization_code_sha256 = $1`,
        [expiredDigest],
      );
      const expiredAssertion = createAssertion(buildClaims(expiredAuthorization.authorizationCode));
      expect((await request("/api/v1/product-links/signals/claim", {
        method: "POST",
        headers: { authorization: `Bearer ${expiredAssertion}` },
        json: { authorizationCode: expiredAuthorization.authorizationCode },
      })).status).toBe(409);
    } finally {
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
