import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import app from "../app";
import { pool } from "@workspace/db";
import { processAuthEmailOutboxOnce } from "../lib/authEmailOutbox";
import {
  LOCAL_LOGIN_MAX_ATTEMPTS,
  LOCAL_SESSION_TTL_MS,
  createLocalLoginAttemptTracker,
  createAuthToken,
  hashAuthToken,
  hashPassword,
  localLoginAttemptKey,
  signLocalSession,
  verifyLocalSession,
  verifyPassword,
} from "../lib/localAuth";

let server: Server;
let baseUrl = "";

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, init);
  const body = response.status === 204 ? null : await response.json();
  return { response, body: body as Record<string, any> | null };
}

function sessionCookie(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookie = headers.getSetCookie?.().find((cookie) => cookie.startsWith("tradigo_local_session="))
    ?? response.headers.get("set-cookie");
  assert.ok(setCookie, "the local auth response should set a session cookie");
  assert.match(setCookie, /tradigo_local_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  return setCookie.split(";")[0];
}

describe("built-in account authentication", () => {
  before(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("supports signup, duplicate protection, login, current session, protected access, and logout invalidation", async () => {
    const email = `local-auth-${randomUUID()}@example.com`;
    let userId = "";
    try {
      const signup = await request("/auth/local/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Local Trader",
          email: email.toUpperCase(),
          password: "StrongPass1",
          consentAccepted: true,
        }),
      });
      assert.equal(signup.response.status, 201);
      assert.equal(signup.body?.user.email, email);
      assert.equal(signup.body?.user.role, "TRADER");
      assert.equal(signup.body?.verification.available, true);
      assert.equal(signup.body?.verification.status, "PENDING");
      userId = signup.body?.user.id;
      const signupCookie = sessionCookie(signup.response);

      const current = await request("/auth/me", { headers: { cookie: signupCookie } });
      assert.equal(current.response.status, 200);
      assert.equal(current.body?.user.id, userId);

      const protectedResponse = await request("/sessions", { headers: { cookie: signupCookie } });
      assert.notEqual(protectedResponse.response.status, 401);

      const duplicate = await request("/auth/local/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Another Trader",
          email,
          password: "StrongPass1",
          consentAccepted: true,
        }),
      });
      assert.equal(duplicate.response.status, 409);

      const wrongPassword = await request("/auth/local/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "WrongPass1" }),
      });
      assert.equal(wrongPassword.response.status, 401);

      const login = await request("/auth/local/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.toUpperCase(), password: "StrongPass1" }),
      });
      assert.equal(login.response.status, 200);
      const loginCookie = sessionCookie(login.response);

      const logout = await request("/auth/local/logout", {
        method: "POST",
        headers: { cookie: loginCookie },
      });
      assert.equal(logout.response.status, 204);

      const expiredSession = await request("/auth/me", { headers: { cookie: loginCookie } });
      assert.equal(expiredSession.response.status, 401);
    } finally {
      if (userId) {
        await pool.query("DELETE FROM tradigo_auth_tokens WHERE user_id=$1", [userId]);
        await pool.query("DELETE FROM tradigo_trader_profiles WHERE user_id=$1", [userId]);
        await pool.query("DELETE FROM tradigo_users WHERE id=$1", [userId]);
      }
    }
  });

  it("verifies email and resets passwords with hashed, expiring, single-use tokens", async () => {
    const email = `local-recovery-${randomUUID()}@example.com`;
    const previousReplitConnectorsHostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const previousEmailFrom = process.env.FROM_EMAIL;
    process.env.REPLIT_CONNECTORS_HOSTNAME = "test-connectors.replit.com";
    process.env.FROM_EMAIL = "Tradigo <security@example.com>";
    let userId = "";
    try {
      const signup = await request("/auth/local/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Recovery Trader",
          email,
          password: "StrongPass1",
          consentAccepted: true,
        }),
      });
      assert.equal(signup.response.status, 201);
      userId = String(signup.body?.user.id);
      const originalSession = sessionCookie(signup.response);

      const storedTokens = await pool.query(
        "SELECT token_hash FROM tradigo_auth_tokens WHERE user_id=$1 AND token_kind='EMAIL_VERIFICATION'",
        [userId],
      );
      assert.equal(storedTokens.rowCount, 1);
      assert.match(String(storedTokens.rows[0].token_hash), /^[a-f0-9]{64}$/);
      const queuedEmail = await pool.query(
        "SELECT encrypted_token FROM tradigo_auth_email_outbox WHERE user_id=$1 AND email_kind='verification'",
        [userId],
      );
      assert.equal(queuedEmail.rowCount, 1);
      assert.match(String(queuedEmail.rows[0].encrypted_token), /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

      const resendRequests = await Promise.all([
        request("/auth/local/verification/resend", { method: "POST", headers: { cookie: originalSession } }),
        request("/auth/local/verification/resend", { method: "POST", headers: { cookie: originalSession } }),
      ]);
      assert.deepEqual(resendRequests.map(({ response }) => response.status), [200, 200]);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => new Response(null, { status: 200 });
      try {
        assert.equal(await processAuthEmailOutboxOnce(), true);
        assert.equal(await processAuthEmailOutboxOnce(), true);
        assert.equal(await processAuthEmailOutboxOnce(), true);
      } finally {
        globalThis.fetch = originalFetch;
      }
      const activeTokens = await pool.query(
        `SELECT COUNT(*)::int AS count FROM tradigo_auth_tokens
         WHERE user_id=$1 AND token_kind='EMAIL_VERIFICATION' AND activated_at IS NOT NULL AND consumed_at IS NULL`,
        [userId],
      );
      assert.equal(activeTokens.rows[0].count, 1);

      const verificationToken = createAuthToken();
      await pool.query("UPDATE tradigo_auth_tokens SET consumed_at=NOW() WHERE user_id=$1", [userId]);
      await pool.query(
        `INSERT INTO tradigo_auth_tokens (id,user_id,token_hash,token_kind,expires_at,activated_at)
         VALUES ($1,$2,$3,'EMAIL_VERIFICATION',NOW() + interval '1 hour',NOW())`,
        [randomUUID(), userId, hashAuthToken(verificationToken)],
      );
      const verification = await request("/auth/local/verification/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: verificationToken }),
      });
      assert.equal(verification.response.status, 200);
      assert.equal(verification.body?.status, "COMPLETED");
      const verifiedUser = await pool.query("SELECT email_verified_at FROM tradigo_users WHERE id=$1", [userId]);
      assert.ok(verifiedUser.rows[0].email_verified_at);

      const knownResetToken = createAuthToken();
      await pool.query(
        `INSERT INTO tradigo_auth_tokens (id,user_id,token_hash,token_kind,expires_at,activated_at)
         VALUES ($1,$2,$3,'PASSWORD_RESET',NOW() + interval '1 hour',NOW())`,
        [randomUUID(), userId, hashAuthToken(knownResetToken)],
      );
      const reset = await request("/auth/local/password-reset/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: knownResetToken, password: "NewStrongPass2" }),
      });
      assert.equal(reset.response.status, 200);
      assert.equal(reset.body?.status, "COMPLETED");

      const replay = await request("/auth/local/password-reset/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: knownResetToken, password: "AnotherPass3" }),
      });
      assert.equal(replay.response.status, 410);

      const invalidatedSession = await request("/auth/me", { headers: { cookie: originalSession } });
      assert.equal(invalidatedSession.response.status, 401);
      const oldLogin = await request("/auth/local/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "StrongPass1" }),
      });
      assert.equal(oldLogin.response.status, 401);
      const newLogin = await request("/auth/local/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "NewStrongPass2" }),
      });
      assert.equal(newLogin.response.status, 200);

      const existingRequest = await request("/auth/local/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const missingRequest = await request("/auth/local/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: `missing-${randomUUID()}@example.com` }),
      });
      assert.equal(existingRequest.response.status, 202);
      assert.equal(missingRequest.response.status, 202);
      assert.deepEqual(existingRequest.body, missingRequest.body);
    } finally {
      if (userId) {
        await pool.query("DELETE FROM tradigo_auth_email_outbox WHERE user_id=$1", [userId]);
        await pool.query("DELETE FROM tradigo_auth_tokens WHERE user_id=$1", [userId]);
        await pool.query("DELETE FROM tradigo_trader_profiles WHERE user_id=$1", [userId]);
        await pool.query("DELETE FROM tradigo_users WHERE id=$1", [userId]);
      }
      if (previousReplitConnectorsHostname === undefined) delete process.env.REPLIT_CONNECTORS_HOSTNAME;
      else process.env.REPLIT_CONNECTORS_HOSTNAME = previousReplitConnectorsHostname;
      if (previousEmailFrom === undefined) delete process.env.FROM_EMAIL;
      else process.env.FROM_EMAIL = previousEmailFrom;
    }
  });

  it("uses a one-way password hash and rejects expired or tampered sessions", async () => {
    const previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = previousSecret || "local-auth-test-secret";
    try {
      const passwordHash = await hashPassword("StrongPass1");
      assert.notEqual(passwordHash, "StrongPass1");
      assert.match(passwordHash, /^scrypt\$/);
      assert.equal(await verifyPassword("StrongPass1", passwordHash), true);
      assert.equal(await verifyPassword("WrongPass1", passwordHash), false);

      const issuedAt = 10_000;
      const token = signLocalSession("usr_local_test", 0, issuedAt);
      assert.ok(token);
      assert.equal(verifyLocalSession(token!, issuedAt)?.userId, "usr_local_test");
      assert.equal(verifyLocalSession(token!, issuedAt + LOCAL_SESSION_TTL_MS + 1), null);
      assert.equal(verifyLocalSession(`${token}tampered`, issuedAt), null);
    } finally {
      if (previousSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSecret;
    }
  });

  it("locks repeated local login failures, isolates origins, and recovers after expiry or success", () => {
    const tracker = createLocalLoginAttemptTracker({
      maxAttempts: 3,
      failureWindowMs: 100,
      lockoutMs: 200,
      maxTrackedKeys: 2,
    });
    const emailKey = localLoginAttemptKey("  Trader@Example.com ", "198.51.100.10");
    const otherOriginKey = localLoginAttemptKey("trader@example.com", "198.51.100.11");

    assert.equal(tracker.check(emailKey, 0).allowed, true);
    assert.equal(tracker.recordFailure(emailKey, 0).allowed, true);
    assert.equal(tracker.recordFailure(emailKey, 10).allowed, true);
    const locked = tracker.recordFailure(emailKey, 20);
    assert.equal(locked.allowed, false);
    assert.equal(tracker.check(emailKey, 100).allowed, false);
    assert.equal(tracker.check(otherOriginKey, 20).allowed, true);

    assert.equal(tracker.check(emailKey, 221).allowed, true);
    assert.equal(tracker.recordFailure(emailKey, 221).allowed, true);
    tracker.clear(emailKey);
    assert.equal(tracker.check(emailKey, 222).allowed, true);
  });

  it("returns a generic throttled response after repeated login failures", async () => {
    const previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = previousSecret || "local-auth-test-secret";
    const email = `local-throttle-${randomUUID()}@example.com`;
    try {
      const responses = [];
      for (let attempt = 0; attempt < LOCAL_LOGIN_MAX_ATTEMPTS; attempt += 1) {
        const response = await request("/auth/local/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: attempt === LOCAL_LOGIN_MAX_ATTEMPTS - 1 ? email.toUpperCase() : email,
            password: "WrongPass1",
          }),
        });
        responses.push(response);
      }
      assert.deepEqual(responses.map(({ response }) => response.status), Array(LOCAL_LOGIN_MAX_ATTEMPTS).fill(401));

      const secondServer = createServer(app);
      try {
        await new Promise<void>((resolve, reject) => {
          secondServer.once("error", reject);
          secondServer.listen(0, "127.0.0.1", resolve);
        });
        const address = secondServer.address();
        assert.ok(address && typeof address !== "string");
        const blockedResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/local/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password: "WrongPass1" }),
        });
        const blockedBody = await blockedResponse.json();
        assert.equal(blockedResponse.status, 429);
        assert.match(String(blockedResponse.headers.get("retry-after")), /^\d+$/);
        assert.deepEqual(blockedBody, responses[0].body);
      } finally {
        await new Promise<void>((resolve, reject) => {
          secondServer.close((error) => error ? reject(error) : resolve());
        });
      }
    } finally {
      if (previousSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previousSecret;
    }
  });
});
