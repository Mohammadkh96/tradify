import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import app from "../app";
import { pool } from "@workspace/db";

const secret = process.env.SESSION_SECRET ?? "admin-operations-test-secret";
process.env.SESSION_SECRET ??= secret;
let server: Server;
let baseUrl = "";
const userId = `admin_ops_test_${randomUUID()}`;

function signedToken(id: string, role: "ADMIN" | "MODERATOR"): string {
  const expiresAt = Date.now() + 60_000;
  const payload = `${id}.${role}.${expiresAt}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

async function request(path: string, role: "ADMIN" | "MODERATOR", init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${signedToken(`admin_ops_${role.toLowerCase()}`, role)}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}/api${path}`, { ...init, headers });
  const body = response.status === 204 ? {} : await response.json() as Record<string, any>;
  return { response, body };
}

describe("admin operations control plane", () => {
  before(async () => {
    await pool.query(
      `INSERT INTO tradigo_users (id, firebase_uid, email, display_name, role, status)
       VALUES ($1,$2,$3,$4,'TRADER','ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [userId, userId, `${userId}@test.invalid`, "Operations test user"],
    );
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await pool.query("DELETE FROM tradigo_admin_audit_logs WHERE target_id=$1 OR actor_id LIKE 'admin_ops_%'", [userId]);
    await pool.query("DELETE FROM tradigo_users WHERE id=$1", [userId]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("lets moderators read live counts but keeps account status mutations admin-only", async () => {
    const dashboard = await request("/admin/dashboard", "MODERATOR");
    assert.equal(dashboard.response.status, 200);
    assert.equal(typeof dashboard.body.metrics.openComplianceCasesCount, "number");

    const forbidden = await request(`/admin/users/${userId}/suspend`, "MODERATOR", {
      method: "POST",
      body: JSON.stringify({ reasonCode: "SAFETY_REVIEW", reasonText: "Moderator cannot change account status" }),
    });
    assert.equal(forbidden.response.status, 403);
    const unchanged = await pool.query("SELECT status FROM tradigo_users WHERE id=$1", [userId]);
    assert.equal(unchanged.rows[0].status, "ACTIVE");
  });

  it("rejects unreasoned actions and records one idempotent audit for a successful action", async () => {
    const missingReason = await request(`/admin/users/${userId}/suspend`, "ADMIN", { method: "POST", body: JSON.stringify({}) });
    assert.equal(missingReason.response.status, 400);

    const key = `admin-operations-test:${userId}`;
    const first = await request(`/admin/users/${userId}/suspend`, "ADMIN", {
      method: "POST",
      headers: { "idempotency-key": key },
      body: JSON.stringify({ reasonCode: "SAFETY_REVIEW", reasonText: "Review the reported account activity" }),
    });
    assert.equal(first.response.status, 200);
    const repeated = await request(`/admin/users/${userId}/suspend`, "ADMIN", {
      method: "POST",
      headers: { "idempotency-key": key },
      body: JSON.stringify({ reasonCode: "SAFETY_REVIEW", reasonText: "Review the reported account activity" }),
    });
    assert.equal(repeated.response.status, 200);
    assert.equal(repeated.body.idempotent, true);
    const audit = await pool.query("SELECT actor_id, actor_role, reason_text, occurred_at FROM tradigo_admin_audit_logs WHERE idempotency_key=$1", [key]);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].actor_role, "ADMIN");
    assert.equal(audit.rows[0].reason_text, "Review the reported account activity");
    assert.ok(audit.rows[0].occurred_at);
  });

  it("keeps preview identities out of admin analytics and mutations", async () => {
    const adminPreview = await fetch(`${baseUrl}/api/auth/demo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "ADMIN" }),
    });
    assert.equal(adminPreview.status, 404);
    const preview = await fetch(`${baseUrl}/api/auth/demo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "TRADER" }),
    });
    assert.equal(preview.status, 200);
    const { previewToken } = await preview.json() as { previewToken: string };
    const analytics = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { "x-tradigo-preview-session": previewToken },
    });
    assert.equal(analytics.status, 403);
    const response = await fetch(`${baseUrl}/api/admin/users/${userId}/restore`, {
      method: "POST",
      headers: { authorization: `Bearer ${previewToken}`, "content-type": "application/json" },
      body: JSON.stringify({ reasonCode: "PREVIEW", reasonText: "Preview must not mutate production data" }),
    });
    assert.equal(response.status, 403);
    const unchanged = await pool.query("SELECT status FROM tradigo_users WHERE id=$1", [userId]);
    assert.equal(unchanged.rows[0].status, "SUSPENDED");
  });
});