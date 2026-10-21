import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { pool } from "@workspace/db";
import app from "./app";
import { createTestAdmin } from "./test-admin";

const testEmail =
  process.env.ADMIN_PERSISTENCE_TEST_EMAIL ??
  `admin-persistence-${process.pid}-${Date.now()}@example.test`;
const testPassword = "persistence-pass";
const testAdminEmail =
  process.env.ADMIN_PERSISTENCE_TEST_ADMIN_EMAIL ?? "admin-persistence-admin@example.test";
const testAdminPassword = "admin-persistence-pass";
const probeMode = process.argv.includes("--probe");

async function request(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
  return { status: response.status, body, headers: response.headers };
}

function userRows(body: Record<string, unknown> | Array<Record<string, unknown>>) {
  if (Array.isArray(body)) return body;
  return Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : [];
}

async function startServer() {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}/api` };
}

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function runProbe() {
  const { server, baseUrl } = await startServer();
  try {
    const adminAuth = await createTestAdmin(baseUrl, {
      email: testAdminEmail,
      password: testAdminPassword,
    });
    const adminToken = adminAuth.token;
    const headers = { authorization: `Bearer ${adminToken}` };

    const users = await request(baseUrl, `/admin/users?search=${encodeURIComponent(testEmail)}`, {
      headers,
    });
    assert.equal(users.status, 200);
    const target = userRows(users.body).find((user) => user.email === testEmail);
    assert.ok(target);
    assert.equal(target.role, "user", "customer role persistence must not be used as staff access");
    assert.equal(target.status, "suspended");
    assert.equal(target.membership, "Pro");
    assert.deepEqual((target.entitlements as string[]).slice().sort(), [
      "DGV8_CHART_LEVELS",
      "REALTIME_SIGNALS",
      "UNLIMITED_ALERTS",
    ]);

    const engine = await request(baseUrl, "/admin/engine/status", { headers });
    assert.equal(engine.status, 200);
    assert.deepEqual(engine.body, {
      mode: "PAUSED_MANUAL",
      reason: "Restart persistence verification",
      updatedAt: (engine.body as Record<string, unknown>).updatedAt,
      updatedBy: testAdminEmail,
      version: (engine.body as Record<string, unknown>).version,
    });

    const pausedAt = Date.parse(String(process.env.ADMIN_PERSISTENCE_TEST_PAUSED_AT));
    assert.ok(Number.isFinite(pausedAt));
    const auditQuery = new URLSearchParams({
      action: "ENGINE_PAUSED",
      from: new Date(pausedAt - 1_000).toISOString(),
      to: new Date(pausedAt + 1_000).toISOString(),
      limit: "1",
    });
    const audit = await request(baseUrl, `/admin/audit-log?${auditQuery}`, { headers });
    assert.equal(audit.status, 200);
    assert.equal((audit.body as Array<Record<string, unknown>>).length, 1);
    assert.equal((audit.body as Array<Record<string, unknown>>)[0]?.action, "ENGINE_PAUSED");
    console.log("Admin persistence probe passed after a fresh process started.");
  } finally {
    await closeServer(server);
  }
}

async function runSetup() {
  const { server, baseUrl } = await startServer();
  try {
    const adminAuth = await createTestAdmin(baseUrl, {
      email: testAdminEmail,
      password: testAdminPassword,
    });
    const adminToken = adminAuth.token;
    const adminHeaders = {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    };
    const userAuth = await request(baseUrl, "/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    assert.ok(
      userAuth.status === 201 ||
        (userAuth.status === 409 &&
          (userAuth.body as Record<string, unknown>).error === "EMAIL_IN_USE"),
    );
    let userId =
      userAuth.status === 201
        ? String(
            (userAuth.body as Record<string, unknown>).user &&
              ((userAuth.body as Record<string, unknown>).user as Record<string, unknown>).id,
          )
        : "";
    if (!userId) {
      const existingUsers = await request(
        baseUrl,
        `/admin/users?search=${encodeURIComponent(testEmail)}`,
        { headers: adminHeaders },
      );
      assert.equal(existingUsers.status, 200);
      const existing = userRows(existingUsers.body).find((user) => user.email === testEmail);
      assert.ok(existing);
      userId = String(existing.id);
    }

    const userList = await request(
      baseUrl,
      `/admin/users?search=${encodeURIComponent(testEmail)}`,
      { headers: adminHeaders },
    );
    assert.equal(userList.status, 200);
    const userRecord = userRows(userList.body).find((user) => user.id === userId);
    assert.ok(userRecord);
    let version = Number(userRecord.version);
    assert.ok(Number.isInteger(version));

    const membershipUpdate = await request(baseUrl, `/admin/crm/users/${userId}/membership`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        membership: "Pro",
        reason: "Persistence verification membership override",
        version,
      }),
    });
    assert.equal(membershipUpdate.status, 200);
    version = Number(
      ((membershipUpdate.body as Record<string, unknown>).user as Record<string, unknown>).version,
    );

    const entitlementUpdate = await request(baseUrl, `/admin/crm/users/${userId}/entitlements`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        grants: ["REALTIME_SIGNALS", "DGV8_CHART_LEVELS"],
        denies: [],
        reason: "Persistence verification entitlement override",
        version,
      }),
    });
    assert.equal(entitlementUpdate.status, 200);
    version = Number(
      ((entitlementUpdate.body as Record<string, unknown>).user as Record<string, unknown>).version,
    );

    const accountStateUpdate = await request(baseUrl, `/admin/crm/users/${userId}/account-state`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        status: "suspended",
        reason: "Persistence verification account suspension",
        version,
      }),
    });
    assert.equal(accountStateUpdate.status, 200);

    const paused = await request(baseUrl, "/admin/engine/pause", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ reason: "Restart persistence verification" }),
    });
    assert.equal(paused.status, 200);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          fileURLToPath(
            new URL(
              "../../../node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs",
              import.meta.url,
            ),
          ),
          fileURLToPath(import.meta.url),
          "--probe",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            ADMIN_PERSISTENCE_TEST_EMAIL: testEmail,
            ADMIN_PERSISTENCE_TEST_ADMIN_EMAIL: testAdminEmail,
            ADMIN_PERSISTENCE_TEST_PAUSED_AT: String(
              (paused.body as Record<string, unknown>).updatedAt,
            ),
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.once("error", reject);
      child.once("close", (code) => (code === 0 ? resolve() : reject(new Error(output))));
    });
  } finally {
    await closeServer(server);
  }
}

async function runConcurrencyRegression() {
  const { server, baseUrl } = await startServer();
  try {
    const adminAuth = await createTestAdmin(baseUrl, {
      email: testAdminEmail,
      password: testAdminPassword,
    });
    const adminToken = adminAuth.token;
    const headers = { authorization: `Bearer ${adminToken}`, "content-type": "application/json" };
    const email = `admin-concurrency-${Date.now()}@example.test`;
    const registered = await request(baseUrl, "/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "concurrency-pass" }),
    });
    assert.equal(registered.status, 201);
    const userId = String(
      (registered.body as Record<string, unknown>).user &&
        ((registered.body as Record<string, unknown>).user as Record<string, unknown>).id,
    );

    const users = await request(baseUrl, "/admin/users", { headers });
    assert.equal(users.status, 200);
    const userRecord = userRows(users.body).find((user) => user.id === userId);
    const version = Number(userRecord?.version);
    assert.ok(Number.isInteger(version));
    process.env.TRADIFY_TEST_DELAY_USER_AUDIT_MS = "100";
    const userResults = await Promise.all([
      request(baseUrl, `/admin/users/${userId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "First administrator", version }),
      }),
      request(baseUrl, `/admin/users/${userId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "Second administrator", version }),
      }),
    ]);
    delete process.env.TRADIFY_TEST_DELAY_USER_AUDIT_MS;
    assert.deepEqual(userResults.map((result) => result.status).sort(), [200, 409]);
    const userConflict = userResults.find((result) => result.status === 409);
    assert.equal(
      userConflict?.body && (userConflict.body as Record<string, unknown>).error,
      "CONCURRENT_UPDATE",
    );
    const userDecision =
      userConflict?.body &&
      ((userConflict.body as Record<string, unknown>).latest as Record<string, unknown>);
    assert.equal(userDecision?.updatedBy, testAdminEmail);
    assert.equal(typeof userDecision?.updatedAt, "string");
    assert.equal(userDecision?.version, version + 1);
    const refreshedUsers = await request(
      baseUrl,
      `/admin/users?search=${encodeURIComponent(email)}`,
      { headers },
    );
    assert.equal(refreshedUsers.status, 200);
    const refreshedUser = userRows(refreshedUsers.body)[0];
    assert.equal(refreshedUser?.version, version + 1);
    assert.equal(refreshedUser?.updatedBy, testAdminEmail);
    assert.equal(refreshedUser?.updatedAt, userDecision?.updatedAt);

    const engine = await request(baseUrl, "/admin/engine/status", { headers });
    assert.equal(engine.status, 200);
    const engineVersion = Number((engine.headers.get("etag") ?? "").replaceAll('"', ""));
    assert.ok(Number.isInteger(engineVersion));
    const engineResults = await Promise.all([
      request(baseUrl, "/admin/engine/pause", {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: "First administrator decision", version: engineVersion }),
      }),
      request(baseUrl, "/admin/engine/resume", {
        method: "POST",
        headers,
        body: JSON.stringify({ version: engineVersion }),
      }),
    ]);
    assert.deepEqual(engineResults.map((result) => result.status).sort(), [200, 409]);
    const engineConflict = engineResults.find((result) => result.status === 409);
    assert.equal(
      engineConflict?.body && (engineConflict.body as Record<string, unknown>).error,
      "CONCURRENT_UPDATE",
    );
    const engineDecision =
      engineConflict?.body &&
      ((engineConflict.body as Record<string, unknown>).latest as Record<string, unknown>);
    assert.equal(engineDecision?.updatedBy, testAdminEmail);
    assert.equal(typeof engineDecision?.updatedAt, "string");
    assert.equal(engineDecision?.version, engineVersion + 1);
    console.log("Admin concurrency regression passed: stale user and engine writes are rejected.");
  } finally {
    await closeServer(server);
  }
}

try {
  if (probeMode) {
    await runProbe();
  } else {
    await runConcurrencyRegression();
    await runSetup();
    console.log("Admin persistence restart test passed.");
  }
} finally {
  await pool.end();
}
