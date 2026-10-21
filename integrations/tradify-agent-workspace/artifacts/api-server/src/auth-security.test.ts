import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { tradifyPasswordResetTokens, tradifyUsers } from "@workspace/db/schema";
import app from "./app";
import {
  PasswordResetEmailDeliveryError,
  passwordResetEmailProvider,
} from "./password-reset-email";
import { PostgreSqlRateLimitStore, type RateLimitScope } from "./sign-in-rate-limit-store";

const server = app.listen(0);
const port = (server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}/api`;
const testRunId = `${process.pid}-${Date.now()}`;
const authSecurityTestIp = `198.22.${process.pid % 250}.${(Date.now() % 253) + 1}`;
const email = `auth-security-${testRunId}@example.test`;
const browserEmail = `auth-browser-${testRunId}@example.test`;
const unknownEmail = `auth-unknown-${testRunId}@example.test`;
const legacyEmail = `auth-legacy-${testRunId}@example.test`;
const tsxCliPath = fileURLToPath(
  new URL("../../../node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const rateLimitServerScriptPath = fileURLToPath(
  new URL("./auth-rate-limit-test-server.ts", import.meta.url),
);

type RateLimitInstance = {
  child: ChildProcess;
  baseUrl: string;
};

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", authSecurityTestIp);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body, headers: response.headers };
}

function credentials(email: string, password: string): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  };
}

async function startRateLimitInstance(): Promise<RateLimitInstance> {
  const child = spawn(process.execPath, [tsxCliPath, rateLimitServerScriptPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`Timed out waiting for auth rate-limit test process to start.\n${output}`));
    }, 45_000);

    const finish = (error?: Error, instance?: RateLimitInstance) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(instance!);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/AUTH_RATE_LIMIT_TEST_SERVER_READY:(\d+)/);
      if (match) {
        finish(undefined, {
          child,
          baseUrl: `http://127.0.0.1:${match[1]}/api`,
        });
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code, signal) => {
      finish(
        new Error(
          `Auth rate-limit test process exited before readiness (code=${code}, signal=${signal}).\n${output}`,
        ),
      );
    });
  });
}

async function stopRateLimitInstance(instance: RateLimitInstance): Promise<void> {
  const { child } = instance;
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const forceKill = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("close", () => {
      clearTimeout(forceKill);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function testSharedApiRateLimitAcrossProcessesAndRestart(): Promise<void> {
  let first: RateLimitInstance | undefined;
  let second: RateLimitInstance | undefined;
  const testIp = `198.16.${Math.floor(process.pid / 255) % 255}.${(process.pid % 255) + 1}`;
  const store = new PostgreSqlRateLimitStore("api");
  const rateLimitKey = crypto
    .createHash("sha256")
    .update(`tradify-api-rate-limit:v1:${testIp}`)
    .digest("hex");

  async function attempt(instance: RateLimitInstance): Promise<number> {
    const response = await fetch(`${instance.baseUrl}/healthz`, {
      headers: { "x-forwarded-for": testIp },
    });
    return response.status;
  }

  try {
    // Position this IP at the final slot without sending 1,799 setup requests.
    await pool.query(
      `INSERT INTO tradify_sign_in_rate_limits (rate_limit_key, total_hits, reset_at)
       VALUES ($1, 1799, NOW() + INTERVAL '60 seconds')
       ON CONFLICT (rate_limit_key) DO UPDATE
       SET total_hits = 1799, reset_at = NOW() + INTERVAL '60 seconds'`,
      [rateLimitKey],
    );

    first = await startRateLimitInstance();
    second = await startRateLimitInstance();
    assert.equal(
      await attempt(first),
      200,
      "the final request inside the shared 1,800/minute budget should pass",
    );
    assert.equal(
      await attempt(second),
      429,
      "a second API process must enforce the same source-IP budget",
    );

    await stopRateLimitInstance(second);
    second = await startRateLimitInstance();
    assert.equal(
      await attempt(second),
      429,
      "restarting an API process must not restore the shared source-IP budget",
    );
    assert.equal(
      (await store.get(testIp))?.totalHits,
      1_802,
      "the shared counter should include allowed and blocked requests across processes and restart",
    );
  } finally {
    if (second) await stopRateLimitInstance(second);
    if (first) await stopRateLimitInstance(first);
    await store.resetKey(testIp);
  }
}

async function testSharedAuthRateLimitsAcrossProcessesAndRestart(): Promise<void> {
  let first: RateLimitInstance | undefined;
  let second: RateLimitInstance | undefined;
  const testIp = `198.18.${Math.floor(process.pid / 255) % 255}.${(process.pid % 255) + 1}`;
  const scenarios: Array<{
    scope: RateLimitScope;
    path: string;
    limit: number;
    expectedStatus: number;
    body: Record<string, string>;
  }> = [
    {
      scope: "sign-in",
      path: "/auth/sign-in",
      limit: 15,
      expectedStatus: 401,
      body: { email: `rate-limit-shared-${testRunId}@example.test`, password: "wrong-password" },
    },
    {
      scope: "registration",
      path: "/auth/register",
      limit: 40,
      expectedStatus: 400,
      body: { email: "not-an-email", password: "x" },
    },
    {
      scope: "password-reset-request",
      path: "/auth/password-reset/request",
      limit: 5,
      expectedStatus: 400,
      body: { email: "not-an-email" },
    },
    {
      scope: "password-reset-complete",
      path: "/auth/password-reset/complete",
      limit: 10,
      expectedStatus: 400,
      body: { token: "invalid", password: "too-short" },
    },
    {
      scope: "admin-password-reset",
      path: "/admin/users/nonexistent/password-reset",
      limit: 10,
      expectedStatus: 401,
      body: {},
    },
  ];

  async function attempt(
    instance: RateLimitInstance,
    path: string,
    body: Record<string, string>,
  ): Promise<number> {
    const response = await fetch(`${instance.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testIp,
      },
      body: JSON.stringify(body),
    });
    return response.status;
  }

  try {
    first = await startRateLimitInstance();
    second = await startRateLimitInstance();

    for (const scenario of scenarios) {
      const firstProcessAttempts = Math.floor(scenario.limit / 2);
      const secondProcessAttempts = scenario.limit - firstProcessAttempts;
      for (let i = 0; i < firstProcessAttempts; i += 1) {
        assert.equal(
          await attempt(first, scenario.path, scenario.body),
          scenario.expectedStatus,
          `${scenario.scope}: attempts on the first process should remain under the cap`,
        );
      }
      for (let i = 0; i < secondProcessAttempts; i += 1) {
        assert.equal(
          await attempt(second, scenario.path, scenario.body),
          scenario.expectedStatus,
          `${scenario.scope}: attempts on the second process should share the remaining allowance`,
        );
      }
      assert.equal(
        await attempt(second, scenario.path, scenario.body),
        429,
        `${scenario.scope}: a second API process must enforce the shared cap of ${scenario.limit}`,
      );
    }

    await stopRateLimitInstance(second);
    second = await startRateLimitInstance();
    for (const scenario of scenarios) {
      assert.equal(
        await attempt(second, scenario.path, scenario.body),
        429,
        `${scenario.scope}: restarting an API process must not restore the exhausted allowance`,
      );
    }
  } finally {
    if (second) await stopRateLimitInstance(second);
    if (first) await stopRateLimitInstance(first);
    for (const scenario of scenarios) {
      await new PostgreSqlRateLimitStore(scenario.scope).resetKey(testIp);
    }
  }
}

async function testConcurrentAuthRateLimitsAtFinalSlotsAcrossProcesses(): Promise<void> {
  let first: RateLimitInstance | undefined;
  let second: RateLimitInstance | undefined;
  const testIp = `198.17.${Math.floor(process.pid / 255) % 255}.${(process.pid % 255) + 1}`;
  const scenarios: Array<{
    scope: Extract<RateLimitScope, "registration" | "password-reset-request">;
    path: string;
    limit: number;
    allowedStatus: number;
    body: Record<string, string>;
  }> = [
    {
      scope: "registration",
      path: "/auth/register",
      limit: 40,
      allowedStatus: 400,
      body: { email: "not-an-email", password: "x" },
    },
    {
      scope: "password-reset-request",
      path: "/auth/password-reset/request",
      limit: 5,
      allowedStatus: 400,
      body: { email: "not-an-email" },
    },
  ];

  async function attempt(
    instance: RateLimitInstance,
    path: string,
    body: Record<string, string>,
  ): Promise<number> {
    const response = await fetch(`${instance.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testIp,
      },
      body: JSON.stringify(body),
    });
    return response.status;
  }

  try {
    first = await startRateLimitInstance();
    second = await startRateLimitInstance();

    for (const scenario of scenarios) {
      const finalSlots = Math.min(3, scenario.limit);
      const burstSize = 16;

      for (let i = 0; i < scenario.limit - finalSlots; i += 1) {
        assert.equal(
          await attempt(first, scenario.path, scenario.body),
          scenario.allowedStatus,
          `${scenario.scope}: requests should consume the allowance before the final slots`,
        );
      }

      const burstStatuses = await Promise.all(
        Array.from({ length: burstSize }, (_, index) =>
          attempt(index % 2 === 0 ? first! : second!, scenario.path, scenario.body),
        ),
      );
      const admitted = burstStatuses.filter((status) => status === scenario.allowedStatus).length;
      const blocked = burstStatuses.filter((status) => status === 429).length;

      assert.ok(
        burstStatuses.every((status) => status === scenario.allowedStatus || status === 429),
        `${scenario.scope}: concurrent requests should either reach the endpoint or be rate limited`,
      );
      assert.equal(
        admitted,
        finalSlots,
        `${scenario.scope}: only the ${finalSlots} remaining slots should be admitted across concurrent API processes`,
      );
      assert.equal(
        blocked,
        burstSize - finalSlots,
        `${scenario.scope}: every request after the shared cap should be blocked`,
      );
      assert.equal(
        (await new PostgreSqlRateLimitStore(scenario.scope).get(testIp))?.totalHits,
        scenario.limit + burstSize - finalSlots,
        `${scenario.scope}: each concurrent request should be reflected in the shared counter`,
      );
    }
  } finally {
    try {
      await Promise.all([
        ...(second ? [stopRateLimitInstance(second)] : []),
        ...(first ? [stopRateLimitInstance(first)] : []),
      ]);
    } finally {
      await Promise.all(
        scenarios.map((scenario) => new PostgreSqlRateLimitStore(scenario.scope).resetKey(testIp)),
      );
    }
  }
}

async function testConcurrentAuthRateLimitsAtWindowRolloverAcrossProcesses(): Promise<void> {
  let first: RateLimitInstance | undefined;
  let second: RateLimitInstance | undefined;
  const testIp = `198.24.${Math.floor(process.pid / 255) % 255}.${(process.pid % 255) + 1}`;
  const scenarios: Array<{
    scope: Extract<RateLimitScope, "registration" | "password-reset-request">;
    path: string;
    limit: number;
    windowMs: number;
    allowedStatus: number;
    body: Record<string, string>;
  }> = [
    {
      scope: "registration",
      path: "/auth/register",
      limit: 40,
      windowMs: 60 * 60_000,
      allowedStatus: 400,
      body: { email: "not-an-email", password: "x" },
    },
    {
      scope: "password-reset-request",
      path: "/auth/password-reset/request",
      limit: 5,
      windowMs: 15 * 60_000,
      allowedStatus: 400,
      body: { email: "not-an-email" },
    },
  ];

  async function attempt(
    instance: RateLimitInstance,
    path: string,
    body: Record<string, string>,
  ): Promise<number> {
    const response = await fetch(`${instance.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testIp,
      },
      body: JSON.stringify(body),
    });
    return response.status;
  }

  function persistedKey(scope: RateLimitScope): string {
    return crypto
      .createHash("sha256")
      .update(`tradify-auth-rate-limit:v1:${scope}:${testIp}`)
      .digest("hex");
  }

  try {
    first = await startRateLimitInstance();
    second = await startRateLimitInstance();

    for (const scenario of scenarios) {
      await pool.query(
        `INSERT INTO tradify_sign_in_rate_limits (rate_limit_key, total_hits, reset_at)
         VALUES ($1, $2, NOW() - INTERVAL '1 millisecond')
         ON CONFLICT (rate_limit_key) DO UPDATE
         SET total_hits = EXCLUDED.total_hits, reset_at = EXCLUDED.reset_at`,
        [persistedKey(scenario.scope), scenario.limit + 1],
      );

      const burstSize = scenario.limit * 2;
      const statuses = await Promise.all(
        Array.from({ length: burstSize }, (_, index) =>
          attempt(index % 2 === 0 ? first! : second!, scenario.path, scenario.body),
        ),
      );
      const admitted = statuses.filter((status) => status === scenario.allowedStatus).length;
      const blocked = statuses.filter((status) => status === 429).length;

      assert.ok(
        statuses.every((status) => status === scenario.allowedStatus || status === 429),
        `${scenario.scope}: concurrent rollover requests should either reach the endpoint or be rate limited`,
      );
      assert.equal(
        admitted,
        scenario.limit,
        `${scenario.scope}: exactly the configured allowance should pass across concurrent API processes`,
      );
      assert.equal(
        blocked,
        burstSize - scenario.limit,
        `${scenario.scope}: requests beyond the fresh allowance should be blocked`,
      );

      const counter = await new PostgreSqlRateLimitStore(scenario.scope).get(testIp);
      assert.ok(counter, `${scenario.scope}: the renewed counter should be persisted`);
      assert.equal(
        counter.totalHits,
        burstSize,
        `${scenario.scope}: the new-window counter should include every concurrent request`,
      );
      const remainingWindowMs = counter.resetTime.getTime() - Date.now();
      assert.ok(
        remainingWindowMs > scenario.windowMs - 30_000 &&
          remainingWindowMs <= scenario.windowMs + 5_000,
        `${scenario.scope}: the persisted counter should use a fresh ${scenario.windowMs}ms window (remaining ${remainingWindowMs}ms)`,
      );
    }
  } finally {
    try {
      await Promise.all([
        ...(second ? [stopRateLimitInstance(second)] : []),
        ...(first ? [stopRateLimitInstance(first)] : []),
      ]);
    } finally {
      await Promise.all(
        scenarios.map((scenario) => new PostgreSqlRateLimitStore(scenario.scope).resetKey(testIp)),
      );
    }
  }
}

async function testSignInRateLimitExpires(): Promise<void> {
  const store = new PostgreSqlRateLimitStore("sign-in");
  const testIp = `198.19.${process.pid % 250}.${(Date.now() % 253) + 1}`;
  const limit = 15;
  let first: RateLimitInstance | undefined;
  let second: RateLimitInstance | undefined;
  const rateLimitKey = crypto
    .createHash("sha256")
    .update(`tradify-sign-in-rate-limit:v1:${testIp}`)
    .digest("hex");

  async function attempt(instance: RateLimitInstance): Promise<number> {
    const response = await fetch(`${instance.baseUrl}/auth/sign-in`, {
      ...credentials(`rate-limit-expiry-${testRunId}@example.test`, "wrong-password"),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testIp,
      },
    });
    return response.status;
  }

  try {
    first = await startRateLimitInstance();
    for (let i = 0; i < limit; i += 1) {
      assert.equal(
        await attempt(first),
        401,
        "sign-in attempts should remain available below the limit on the first process",
      );
    }
    assert.equal(
      await attempt(first),
      429,
      "the first process should block the same IP after the fifteenth failed sign-in",
    );

    const blockedCounter = await store.get(testIp);
    assert.ok(blockedCounter, "the blocked IP should have a persisted rate-limit counter");
    assert.equal(blockedCounter.totalHits, limit + 1);
    const remainingWindowMs = blockedCounter.resetTime.getTime() - Date.now();
    assert.ok(
      remainingWindowMs > 14 * 60_000 && remainingWindowMs <= 15 * 60_000,
      `the blocked IP should remain inside its configured 15-minute window (remaining ${remainingWindowMs}ms)`,
    );

    second = await startRateLimitInstance();
    assert.equal(
      await attempt(second),
      429,
      "a separate API process should see the persisted sign-in block for the same IP",
    );
    assert.equal(
      (await store.get(testIp))?.totalHits,
      limit + 2,
      "the second process should update the shared blocked-attempt counter",
    );

    await stopRateLimitInstance(second);
    second = undefined;
    await stopRateLimitInstance(first);
    first = undefined;

    const expiredCounter = await pool.query(
      `UPDATE tradify_sign_in_rate_limits
       SET reset_at = NOW() - INTERVAL '1 millisecond'
       WHERE rate_limit_key = $1
       RETURNING rate_limit_key`,
      [rateLimitKey],
    );
    assert.equal(
      expiredCounter.rowCount,
      1,
      "the shared sign-in window should be expired in storage",
    );
    assert.equal(
      await store.get(testIp),
      undefined,
      "the expired block should no longer be active in storage",
    );

    first = await startRateLimitInstance();
    assert.equal(
      await attempt(first),
      401,
      "a fresh API process should allow the same IP to try again after the persisted window expires",
    );
    assert.equal(
      (await store.get(testIp))?.totalHits,
      1,
      "the fresh process should restart the expired counter at one hit",
    );
  } finally {
    try {
      await Promise.all([
        ...(second ? [stopRateLimitInstance(second)] : []),
        ...(first ? [stopRateLimitInstance(first)] : []),
      ]);
    } finally {
      await store.resetKey(testIp);
    }
  }
}

async function testRegistrationAndPasswordResetLimitsExpireAcrossRestart(): Promise<void> {
  const testIp = `198.21.${process.pid % 250}.${(Date.now() % 253) + 1}`;
  const scenarios: Array<{
    scope: Extract<
      RateLimitScope,
      "registration" | "password-reset-request" | "password-reset-complete" | "admin-password-reset"
    >;
    path: string;
    limit: number;
    windowMs: number;
    body: Record<string, string>;
    allowedStatus: number;
  }> = [
    {
      scope: "registration",
      path: "/auth/register",
      limit: 40,
      windowMs: 60 * 60_000,
      body: { email: "not-an-email", password: "x" },
      allowedStatus: 400,
    },
    {
      scope: "password-reset-request",
      path: "/auth/password-reset/request",
      limit: 5,
      windowMs: 15 * 60_000,
      body: { email: "not-an-email" },
      allowedStatus: 400,
    },
    {
      scope: "password-reset-complete",
      path: "/auth/password-reset/complete",
      limit: 10,
      windowMs: 15 * 60_000,
      body: { token: "invalid", password: "too-short" },
      allowedStatus: 400,
    },
    {
      scope: "admin-password-reset",
      path: "/admin/users/nonexistent/password-reset",
      limit: 10,
      windowMs: 15 * 60_000,
      body: {},
      allowedStatus: 401,
    },
  ];
  let instance: RateLimitInstance | undefined;

  async function attempt(
    target: RateLimitInstance,
    path: string,
    body: Record<string, string>,
  ): Promise<number> {
    const response = await fetch(`${target.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testIp,
      },
      body: JSON.stringify(body),
    });
    return response.status;
  }

  function persistedKey(scope: RateLimitScope): string {
    return crypto
      .createHash("sha256")
      .update(`tradify-auth-rate-limit:v1:${scope}:${testIp}`)
      .digest("hex");
  }

  try {
    instance = await startRateLimitInstance();
    for (const scenario of scenarios) {
      for (let i = 0; i < scenario.limit; i += 1) {
        assert.equal(
          await attempt(instance, scenario.path, scenario.body),
          scenario.allowedStatus,
          `${scenario.scope}: requests should reach the endpoint below the configured cap`,
        );
      }
      assert.equal(
        await attempt(instance, scenario.path, scenario.body),
        429,
        `${scenario.scope}: the configured cap of ${scenario.limit} should still be enforced`,
      );

      const counter = await new PostgreSqlRateLimitStore(scenario.scope).get(testIp);
      assert.ok(counter, `${scenario.scope}: an exhausted counter should be persisted`);
      assert.equal(counter.totalHits, scenario.limit + 1);
      const remainingWindowMs = counter.resetTime.getTime() - Date.now();
      assert.ok(
        remainingWindowMs > scenario.windowMs - 30_000 &&
          remainingWindowMs <= scenario.windowMs + 5_000,
        `${scenario.scope}: the configured ${scenario.windowMs}ms window should be retained (remaining ${remainingWindowMs}ms)`,
      );
    }

    await stopRateLimitInstance(instance);
    instance = await startRateLimitInstance();

    for (const scenario of scenarios) {
      await pool.query(
        "UPDATE tradify_sign_in_rate_limits SET reset_at = NOW() - INTERVAL '1 millisecond' WHERE rate_limit_key = $1",
        [persistedKey(scenario.scope)],
      );
      assert.equal(
        await attempt(instance, scenario.path, scenario.body),
        scenario.allowedStatus,
        `${scenario.scope}: a fresh API process should allow a request after its persisted window expires`,
      );
      assert.equal(
        (await new PostgreSqlRateLimitStore(scenario.scope).get(testIp))?.totalHits,
        1,
        `${scenario.scope}: the expired counter should restart at one hit`,
      );
    }
  } finally {
    if (instance) await stopRateLimitInstance(instance);
    for (const scenario of scenarios) {
      await new PostgreSqlRateLimitStore(scenario.scope).resetKey(testIp);
    }
  }
}

async function testAuthRouteBlocksWhenRateLimitStoreWriteFails(
  scope: RateLimitScope,
  path: string,
  requestBody: Record<string, string>,
): Promise<void> {
  const store = new PostgreSqlRateLimitStore(scope);
  const testIp = `198.20.${process.pid % 250}.${(Date.now() % 253) + 1}`;
  const rateLimitKey = crypto
    .createHash("sha256")
    .update(
      scope === "sign-in"
        ? `tradify-sign-in-rate-limit:v1:${testIp}`
        : `tradify-auth-rate-limit:v1:${scope}:${testIp}`,
    )
    .digest("hex");
  const originalPoolQuery = pool.query;
  const boundPoolQuery = pool.query.bind(pool);
  let writeFailureInjected = false;
  pool.query = new Proxy(boundPoolQuery, {
    apply(target, thisArg, args: unknown[]) {
      const [query] = args;
      const values = args[1];
      if (
        typeof query === "string" &&
        query.startsWith("INSERT INTO tradify_sign_in_rate_limits") &&
        Array.isArray(values) &&
        values[0] === rateLimitKey
      ) {
        writeFailureInjected = true;
        return Promise.reject(new Error("database connection details must not reach the response"));
      }
      return Reflect.apply(target, thisArg, args);
    },
  }) as typeof pool.query;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testIp,
      },
      body: JSON.stringify(requestBody),
    });
    const responseBody = (await response.json()) as Record<string, unknown>;

    assert.equal(
      writeFailureInjected,
      true,
      "the shared rate-limit counter write should be forced to fail",
    );
    assert.equal(
      response.status,
      503,
      `${scope} must remain blocked when its shared counter cannot be saved`,
    );
    const { requestId, ...safeResponseBody } = responseBody;
    assert.ok(Number.isSafeInteger(requestId));
    assert.deepEqual(safeResponseBody, {
      error: "RATE_LIMIT_UNAVAILABLE",
      message: "The request could not be completed. Try again later.",
    });
  } finally {
    pool.query = originalPoolQuery;
  }

  try {
    assert.equal(
      await store.get(testIp),
      undefined,
      `${scope}: the failed counter write must not be treated as a decision`,
    );
    assert.ok(
      await new PostgreSqlRateLimitStore("api").get(testIp),
      `${scope}: the API-wide counter should save successfully before the scoped counter fails`,
    );
  } finally {
    await Promise.all([
      store.resetKey(testIp),
      new PostgreSqlRateLimitStore("api").resetKey(testIp),
    ]);
  }
}

async function testSignInBlocksWhenRateLimitStoreReturnsNoRows(
  email: string,
  password: string,
): Promise<void> {
  const store = new PostgreSqlRateLimitStore("sign-in");
  const testIp = `198.23.${process.pid % 250}.${(Date.now() % 253) + 1}`;
  const originalPoolQuery = pool.query;
  const boundPoolQuery = pool.query.bind(pool);
  let emptyCounterResultReturned = false;
  pool.query = new Proxy(boundPoolQuery, {
    apply(target, thisArg, args: unknown[]) {
      const [query] = args;
      if (
        typeof query === "string" &&
        query.startsWith("INSERT INTO tradify_sign_in_rate_limits")
      ) {
        emptyCounterResultReturned = true;
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Reflect.apply(target, thisArg, args);
    },
  }) as typeof pool.query;

  try {
    const response = await fetch(`${baseUrl}/auth/sign-in`, {
      ...credentials(email, password),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testIp,
      },
    });
    const responseBody = (await response.json()) as Record<string, unknown>;

    assert.equal(
      emptyCounterResultReturned,
      true,
      "the counter insert should succeed without returning a row",
    );
    assert.equal(
      response.status,
      503,
      "sign-in must remain blocked without a recorded rate-limit decision",
    );
    const { requestId, ...safeResponseBody } = responseBody;
    assert.ok(Number.isSafeInteger(requestId));
    assert.deepEqual(safeResponseBody, {
      error: "RATE_LIMIT_UNAVAILABLE",
      message: "The request could not be completed. Try again later.",
    });
    assert.equal(
      response.headers.get("set-cookie"),
      null,
      "a blocked sign-in must not create a session",
    );
  } finally {
    pool.query = originalPoolQuery;
  }

  try {
    assert.equal(
      await store.get(testIp),
      undefined,
      "an empty insert result must not be treated as a saved decision",
    );
    const validSignIn = await fetch(`${baseUrl}/auth/sign-in`, {
      ...credentials(email, password),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testIp,
      },
    });
    assert.equal(
      validSignIn.status,
      200,
      "the same valid credentials should reach sign-in when the counter can be recorded",
    );
  } finally {
    await store.resetKey(testIp);
  }
}

try {
  const originalPassword = "original-pass";
  const attackerPassword = "attacker-pass";

  const allowedOrigin = await request("/healthz", {
    headers: { origin: "https://tradify-signals.replit.app" },
  });
  assert.equal(
    allowedOrigin.headers.get("access-control-allow-origin"),
    "https://tradify-signals.replit.app",
  );
  assert.equal(allowedOrigin.headers.get("x-content-type-options"), "nosniff");
  assert.equal(allowedOrigin.headers.get("x-frame-options"), "DENY");
  assert.equal(allowedOrigin.headers.get("x-powered-by"), null);
  const blockedOrigin = await request("/healthz", {
    headers: { origin: "https://untrusted.example.test" },
  });
  assert.equal(blockedOrigin.headers.get("access-control-allow-origin"), null);

  const priorAdminEmails = process.env.TRADIFY_ADMIN_EMAILS;
  process.env.TRADIFY_ADMIN_EMAILS = email;
  const registered = await request("/auth/register", credentials(email, originalPassword));
  if (priorAdminEmails === undefined) delete process.env.TRADIFY_ADMIN_EMAILS;
  else process.env.TRADIFY_ADMIN_EMAILS = priorAdminEmails;
  assert.equal(registered.status, 201);
  assert.equal((registered.body.user as { role?: string }).role, "user");
  const token = String(registered.body.token);
  const browserHeaders = new Headers(credentials(browserEmail, originalPassword).headers);
  browserHeaders.set("origin", new URL(baseUrl).origin);
  browserHeaders.set("x-tradify-web-session", "1");
  const browserRegistration = await request("/auth/register", {
    ...credentials(browserEmail, originalPassword),
    headers: browserHeaders,
  });
  assert.equal(browserRegistration.status, 201);
  assert.equal("token" in browserRegistration.body, false);
  assert.match(browserRegistration.headers.get("set-cookie") ?? "", /^__Host-tradify-session=/u);
  assert.match(browserRegistration.headers.get("set-cookie") ?? "", /HttpOnly/u);
  assert.match(browserRegistration.headers.get("set-cookie") ?? "", /Secure/u);
  assert.match(browserRegistration.headers.get("set-cookie") ?? "", /SameSite=Lax/u);
  assert.match(browserRegistration.headers.get("set-cookie") ?? "", /Path=\//u);

  const browserSignInHeaders = new Headers(credentials(browserEmail, originalPassword).headers);
  browserSignInHeaders.set("origin", new URL(baseUrl).origin);
  browserSignInHeaders.set("x-tradify-web-session", "1");
  const browserSignIn = await request("/auth/sign-in", {
    ...credentials(browserEmail, originalPassword),
    headers: browserSignInHeaders,
  });
  assert.equal(browserSignIn.status, 200);
  assert.equal("token" in browserSignIn.body, false);
  const browserCookie = browserSignIn.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(browserCookie);

  const browserCurrentUser = await request("/auth/me", { headers: { cookie: browserCookie! } });
  assert.equal(browserCurrentUser.status, 200);
  assert.equal(
    (browserCurrentUser.body.user as { email?: string }).email,
    browserEmail,
  );
  const rejectedCookieMutation = await request("/user/sync", {
    method: "POST",
    headers: {
      cookie: browserCookie!,
      origin: "https://untrusted.example.test",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(rejectedCookieMutation.status, 403);
  assert.equal(rejectedCookieMutation.body.error, "CSRF_REJECTED");

  const browserLogout = await request("/auth/logout", {
    method: "POST",
    headers: { cookie: browserCookie!, origin: new URL(baseUrl).origin },
  });
  assert.equal(browserLogout.status, 200);
  assert.match(
    browserLogout.headers.get("set-cookie") ?? "",
    /Expires=Thu, 01 Jan 1970 00:00:00 GMT/u,
  );
  const browserAfterLogout = await request("/auth/me", { headers: { cookie: browserCookie! } });
  assert.equal(browserAfterLogout.status, 401);

  const nonAdminPortalLogin = await request("/auth/admin-session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: new URL(baseUrl).origin,
    },
    body: JSON.stringify({ email, password: originalPassword }),
  });
  assert.equal(nonAdminPortalLogin.status, 403);
  assert.equal(nonAdminPortalLogin.body.error, "STAFF_ACCESS_REQUIRED");
  assert.equal(nonAdminPortalLogin.headers.get("set-cookie"), null);

  const [storedRegistration] = await db
    .select({ passwordHash: tradifyUsers.passwordHash })
    .from(tradifyUsers)
    .where(eq(tradifyUsers.email, email));
  assert.match(storedRegistration?.passwordHash ?? "", /^\$2b\$12\$/u);
  assert.notEqual(
    storedRegistration?.passwordHash,
    crypto.createHash("sha256").update(originalPassword).digest("hex"),
  );

  const duplicateRegistration = await request(
    "/auth/register",
    credentials(email, attackerPassword),
  );
  assert.equal(duplicateRegistration.status, 409);
  assert.equal(duplicateRegistration.body.error, "EMAIL_IN_USE");

  const attackerSignIn = await request("/auth/sign-in", credentials(email, attackerPassword));
  assert.equal(attackerSignIn.status, 401);
  const originalSignIn = await request("/auth/sign-in", credentials(email, originalPassword));
  assert.equal(originalSignIn.status, 200);
  await testAuthRouteBlocksWhenRateLimitStoreWriteFails("sign-in", "/auth/sign-in", {
    email,
    password: originalPassword,
  });
  await testSignInBlocksWhenRateLimitStoreReturnsNoRows(email, originalPassword);

  const unknownSignIn = await request("/auth/sign-in", credentials(unknownEmail, originalPassword));
  assert.equal(unknownSignIn.status, 401);
  const registerAfterFailedSignIn = await request(
    "/auth/register",
    credentials(unknownEmail, originalPassword),
  );
  assert.equal(registerAfterFailedSignIn.status, 201);

  const failedRegistrationEmail = `auth-rate-limit-failure-${testRunId}@example.test`;
  try {
    await testAuthRouteBlocksWhenRateLimitStoreWriteFails("registration", "/auth/register", {
      email: failedRegistrationEmail,
      password: "valid-test-password",
    });
    const failedRegistration = await db
      .select({ id: tradifyUsers.id })
      .from(tradifyUsers)
      .where(eq(tradifyUsers.email, failedRegistrationEmail))
      .limit(1);
    assert.equal(
      failedRegistration.length,
      0,
      "registration must not run without a saved rate-limit decision",
    );
  } finally {
    await db.delete(tradifyUsers).where(eq(tradifyUsers.email, failedRegistrationEmail));
  }

  const invalidResetRequest = await request("/auth/password-reset/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  assert.equal(invalidResetRequest.status, 400);
  const invalidResetCompletion = await request("/auth/password-reset/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "invalid", password: "too-short" }),
  });
  assert.equal(invalidResetCompletion.status, 400);

  const originalIsResetConfigured = passwordResetEmailProvider.isConfigured;
  const originalSendResetEmail = passwordResetEmailProvider.send;
  const sentResetEmails: Array<{ to: string; token: string }> = [];
  const resetCustomerEmail = `auth-reset-customer-${testRunId}@example.test`;
  passwordResetEmailProvider.isConfigured = () => true;
  passwordResetEmailProvider.send = async (to, resetToken) => {
    sentResetEmails.push({ to, token: resetToken });
  };
  try {
    const resetCustomerRegistration = await request(
      "/auth/register",
      credentials(resetCustomerEmail, "before-reset-password"),
    );
    assert.equal(resetCustomerRegistration.status, 201);
    const resetCustomerToken = String(resetCustomerRegistration.body.token);
    const resetCustomer = resetCustomerRegistration.body.user as { id: string; email: string };
    const emailsBeforeCounterFailure = sentResetEmails.length;
    await testAuthRouteBlocksWhenRateLimitStoreWriteFails(
      "password-reset-request",
      "/auth/password-reset/request",
      { email: resetCustomer.email },
    );
    assert.equal(
      sentResetEmails.length,
      emailsBeforeCounterFailure,
      "password-reset email delivery must not run without a saved rate-limit decision",
    );
    const resetTokensBeforeRequest = await db
      .select({ tokenHash: tradifyPasswordResetTokens.tokenHash })
      .from(tradifyPasswordResetTokens)
      .where(eq(tradifyPasswordResetTokens.userId, resetCustomer.id));
    assert.equal(
      resetTokensBeforeRequest.length,
      0,
      "password-reset token creation must not run without a saved rate-limit decision",
    );
    const unknownReset = await request("/auth/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `auth-reset-unknown-${testRunId}@example.test` }),
    });
    const knownReset = await request("/auth/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: resetCustomer.email }),
    });
    assert.equal(unknownReset.status, 200);
    assert.equal(knownReset.status, 200);
    assert.deepEqual(unknownReset.body, knownReset.body);
    assert.deepEqual(knownReset.body, { ok: true });
    assert.equal(sentResetEmails.length, 1);
    assert.equal(sentResetEmails[0].to, resetCustomer.email);

    const [storedResetToken] = await db
      .select({ tokenHash: tradifyPasswordResetTokens.tokenHash })
      .from(tradifyPasswordResetTokens)
      .where(eq(tradifyPasswordResetTokens.userId, resetCustomer.id))
      .limit(1);
    assert.ok(storedResetToken);
    assert.equal(
      storedResetToken.tokenHash,
      crypto.createHash("sha256").update(sentResetEmails[0].token, "utf8").digest("hex"),
    );
    assert.notEqual(storedResetToken.tokenHash, sentResetEmails[0].token);

    await db
      .update(tradifyPasswordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(tradifyPasswordResetTokens.tokenHash, storedResetToken.tokenHash));
    const expiredReset = await request("/auth/password-reset/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: sentResetEmails[0].token,
        password: "new-secure-passphrase-2026!",
      }),
    });
    assert.equal(expiredReset.status, 400);

    const renewedReset = await request("/auth/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: resetCustomer.email }),
    });
    assert.equal(renewedReset.status, 200);
    assert.equal(sentResetEmails.length, 2);
    const [currentResetToken] = await db
      .select({ tokenHash: tradifyPasswordResetTokens.tokenHash })
      .from(tradifyPasswordResetTokens)
      .where(eq(tradifyPasswordResetTokens.userId, resetCustomer.id))
      .limit(1);
    assert.equal(
      currentResetToken?.tokenHash,
      crypto.createHash("sha256").update(sentResetEmails[1].token, "utf8").digest("hex"),
    );

    const newPassword = "new-secure-passphrase-2026!";
    const completedReset = await request("/auth/password-reset/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: sentResetEmails[1].token, password: newPassword }),
    });
    assert.equal(completedReset.status, 200);
    assert.deepEqual(completedReset.body, { ok: true });

    const reusedResetToken = await request("/auth/password-reset/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: sentResetEmails[1].token,
        password: "another-secure-password",
      }),
    });
    assert.equal(reusedResetToken.status, 400);

    const oldSessionAfterReset = await request("/auth/me", {
      headers: { authorization: `Bearer ${resetCustomerToken}` },
    });
    assert.equal(oldSessionAfterReset.status, 401);
    const oldPasswordAfterReset = await request(
      "/auth/sign-in",
      credentials(resetCustomer.email, "before-reset-password"),
    );
    assert.equal(oldPasswordAfterReset.status, 401);
    const newPasswordAfterReset = await request(
      "/auth/sign-in",
      credentials(resetCustomer.email, newPassword),
    );
    assert.equal(newPasswordAfterReset.status, 200);

    const originalSendAfterReset = passwordResetEmailProvider.send;
    passwordResetEmailProvider.send = async () => {
      throw new PasswordResetEmailDeliveryError(422, "validation_error");
    };
    try {
      const undeliveredReset = await request("/auth/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: resetCustomer.email }),
      });
      assert.equal(undeliveredReset.status, 200);
      assert.deepEqual(undeliveredReset.body, { ok: true });
      const revokedResetToken = await db
        .select({ consumedAt: tradifyPasswordResetTokens.consumedAt })
        .from(tradifyPasswordResetTokens)
        .where(eq(tradifyPasswordResetTokens.userId, resetCustomer.id));
      assert.ok(revokedResetToken[0]?.consumedAt);
    } finally {
      passwordResetEmailProvider.send = originalSendAfterReset;
    }
  } finally {
    passwordResetEmailProvider.isConfigured = originalIsResetConfigured;
    passwordResetEmailProvider.send = originalSendResetEmail;
    const [resetCustomer] = await db
      .select({ id: tradifyUsers.id })
      .from(tradifyUsers)
      .where(eq(tradifyUsers.email, resetCustomerEmail))
      .limit(1);
    if (resetCustomer) {
      await db.transaction(async (transaction) => {
        await transaction
          .delete(tradifyPasswordResetTokens)
          .where(eq(tradifyPasswordResetTokens.userId, resetCustomer.id));
        await transaction.delete(tradifyUsers).where(eq(tradifyUsers.id, resetCustomer.id));
      });
    }
  }

  const disabledPreviewSignIn = await request(
    "/auth/sign-in",
    credentials("preview@tradify.app", "preview-pass"),
  );
  assert.equal(disabledPreviewSignIn.status, 401);
  const disabledPreviewRegistration = await request(
    "/auth/register",
    credentials("preview@tradify.app", "preview-pass"),
  );
  assert.equal(disabledPreviewRegistration.status, 400);

  const authorizedBeforeLogout = await request("/auth/me", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(authorizedBeforeLogout.status, 200);
  const logout = await request("/auth/logout", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(logout.status, 200);
  const revoked = await request("/auth/me", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(revoked.status, 401);

  const legacyPassword = "legacy-pass";
  const now = new Date().toISOString();
  await db.insert(tradifyUsers).values({
    id: `auth-legacy-${testRunId}`,
    email: legacyEmail,
    passwordHash: crypto.createHash("sha256").update(legacyPassword).digest("hex"),
    name: "Legacy trader",
    accountSize: 10_000,
    riskPercent: 0.5,
    maxDailyLoss: 2,
    maxTrades: 3,
    aggressive: false,
    membership: "Free",
    role: "user",
    status: "active",
    entitlements: [],
    entitlementGrants: [],
    entitlementDenies: [],
    createdAt: now,
    lastSeenAt: now,
  });
  const legacySignIn = await request("/auth/sign-in", credentials(legacyEmail, legacyPassword));
  assert.equal(legacySignIn.status, 200);
  const [migratedLegacy] = await db
    .select({ passwordHash: tradifyUsers.passwordHash })
    .from(tradifyUsers)
    .where(eq(tradifyUsers.email, legacyEmail));
  assert.match(migratedLegacy?.passwordHash ?? "", /^\$2b\$12\$/u);

  await testSharedApiRateLimitAcrossProcessesAndRestart();
  await testSharedAuthRateLimitsAcrossProcessesAndRestart();
  await testRegistrationAndPasswordResetLimitsExpireAcrossRestart();
  await testConcurrentAuthRateLimitsAtFinalSlotsAcrossProcesses();
  await testConcurrentAuthRateLimitsAtWindowRolloverAcrossProcesses();
  await testSignInRateLimitExpires();

  const failedSignInAttempts = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      request("/auth/sign-in", credentials(`rate-limit-${index}@example.test`, "wrong-password")),
    ),
  );
  assert.ok(failedSignInAttempts.some((attempt) => attempt.status === 429));

  console.log("auth security tests passed");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await db
    .delete(tradifyUsers)
    .where(inArray(tradifyUsers.email, [email, browserEmail, unknownEmail, legacyEmail]));
  await pool.end();
}
