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

const { isolatedEmailService } = vi.hoisted(() => ({
  isolatedEmailService: new Proxy({}, {
    get: () => vi.fn(async () => false),
  }),
}));

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

async function login(email: string): Promise<{ cookie: string; user: any }> {
  const response = await request("/api/auth/login", {
    method: "POST",
    json: { email, password: testPassword },
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
      process.env.NODE_ENV = "production";
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

    const validSync = await request("/api/mt5/sync", {
      method: "POST",
      json: {
        userId: aliceEmail,
        token,
        accountNumber: "SYNTHETIC-MT5-1",
        broker: "Synthetic Broker",
        server: "Synthetic Demo",
        currency: "USD",
        balance: 10000,
        equity: 10000,
        margin: 0,
        freeMargin: 10000,
        marginLevel: 0,
        floatingPl: 0,
        leverage: 100,
        history: [],
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
