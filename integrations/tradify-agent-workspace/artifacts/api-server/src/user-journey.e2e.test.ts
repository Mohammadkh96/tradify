import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import type { AddressInfo } from "node:net";
import app from "./app";
import { pool } from "@workspace/db";

const server = app.listen(0);
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
const clientIp = `fd00:${process.pid.toString(16)}::1`;
const riskDisclaimerVersion = "2026-10-13-v1";

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
  await pool.end();
});

test("signup, save a market to the watchlist, then logout", async () => {
  const email = `journey-${process.pid}-${Date.now()}@example.test`;
  const password = `journey-${randomUUID()}`;
  const request = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("x-forwarded-for", clientIp);
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  };

  const signup = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      acceptRiskDisclaimer: true,
      riskDisclaimerVersion,
    }),
  });
  assert.equal(signup.status, 201);
  const signedIn = (await signup.json()) as {
    token: string;
    user: { riskDisclaimerVersion: string | null; riskDisclaimerAcceptedAt: string | null };
  };
  assert.ok(signedIn.token);
  assert.equal(signedIn.user.riskDisclaimerVersion, riskDisclaimerVersion);
  assert.ok(signedIn.user.riskDisclaimerAcceptedAt);
  const authorization = { authorization: `Bearer ${signedIn.token}` };

  const staleAcknowledgement = await request("/user/risk-disclaimer/acknowledge", {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ version: "outdated-version" }),
  });
  assert.equal(staleAcknowledgement.status, 409);

  const acknowledgement = await request("/user/risk-disclaimer/acknowledge", {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ version: riskDisclaimerVersion }),
  });
  assert.equal(acknowledgement.status, 200);
  const acknowledged = (await acknowledgement.json()) as {
    user: { riskDisclaimerVersion: string; riskDisclaimerAcceptedAt: string };
  };
  assert.equal(acknowledged.user.riskDisclaimerVersion, riskDisclaimerVersion);
  assert.ok(Date.parse(acknowledged.user.riskDisclaimerAcceptedAt));
  const currentUser = await request("/auth/me", { headers: authorization });
  assert.equal(currentUser.status, 200);
  const persisted = (await currentUser.json()) as {
    user: { riskDisclaimerVersion: string; riskDisclaimerAcceptedAt: string };
  };
  assert.equal(persisted.user.riskDisclaimerVersion, riskDisclaimerVersion);
  assert.equal(
    persisted.user.riskDisclaimerAcceptedAt,
    acknowledged.user.riskDisclaimerAcceptedAt,
  );

  const saved = await request("/watchlist", {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ symbol: "ETHUSD" }),
  });
  assert.equal(saved.status, 200);
  assert.ok(((await saved.json()) as { watchlist: string[] }).watchlist.includes("ETHUSD"));

  const logout = await request("/auth/logout", { method: "POST", headers: authorization });
  assert.equal(logout.status, 200);
  const afterLogout = await request("/auth/me", { headers: authorization });
  assert.equal(afterLogout.status, 401);
});
