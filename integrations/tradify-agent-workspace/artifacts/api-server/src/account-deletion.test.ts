import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { tradifyAccountDeletionRequests, tradifyUsers } from "@workspace/db/schema";
import app from "./app";

const server = app.listen(0);
const port = (server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}/api`;
const testRunId = `${process.pid}-${Date.now()}`;

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
}

try {
  const email = `account-deletion-${testRunId}@example.test`;
  const password = "deletion-pass";
  const registration = await requestJson("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(registration.status, 201);
  const token = String(registration.body.token);

  const unauthorized = await requestJson("/user/account", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
  assert.equal(unauthorized.status, 401);

  const missingConfirmation = await requestJson("/user/account", {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "delete" }),
  });
  assert.equal(missingConfirmation.status, 400);
  assert.equal(missingConfirmation.body.error, "ACCOUNT_DELETION_CONFIRMATION_REQUIRED");

  const exportResponse = await fetch(`${baseUrl}/user/export`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(exportResponse.status, 200);
  assert.match(
    exportResponse.headers.get("content-disposition") ?? "",
    /tradify-signals-data-export\.json/u,
  );
  const exported = (await exportResponse.json()) as Record<string, unknown>;
  assert.equal((exported.account as Record<string, unknown>).email, email);
  assert.ok(Array.isArray(exported.watchlist));
  assert.ok(Array.isArray(exported.alerts));
  assert.ok(Array.isArray(exported.notifications));
  assert.ok(Array.isArray(exported.trades));
  assert.equal(Object.hasOwn(exported, "passwordHash"), false);
  assert.equal(exported.account && Object.hasOwn(exported.account, "passwordHash"), false);
  const unauthorizedExport = await requestJson("/user/export");
  assert.equal(unauthorizedExport.status, 401);

  const deletion = await requestJson("/user/account", {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
  assert.equal(deletion.status, 200);
  assert.equal(deletion.body.ok, true);

  const revokedToken = await requestJson("/auth/me", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(revokedToken.status, 401);

  const signInAfterDeletion = await requestJson("/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(signInAfterDeletion.status, 401);

  const [stored] = await db
    .select({
      email: tradifyUsers.email,
      status: tradifyUsers.status,
      name: tradifyUsers.name,
      watchlist: tradifyUsers.watchlist,
      alerts: tradifyUsers.alerts,
      notifications: tradifyUsers.notifications,
      trades: tradifyUsers.trades,
      deletedAt: tradifyUsers.deletedAt,
    })
    .from(tradifyUsers)
    .where(
      eq(
        tradifyUsers.email,
        `deleted+${String(registration.body.user && (registration.body.user as { id: string }).id)}@invalid.tradify`,
      ),
    );
  assert.equal(stored?.status, "deleted");
  assert.equal(stored?.name, "Deleted account");
  assert.notEqual(stored?.email, email);
  assert.equal(stored?.watchlist.length, 0);
  assert.equal(stored?.alerts.length, 0);
  assert.equal(stored?.notifications.length, 0);
  assert.equal(stored?.trades.length, 0);
  assert.ok(stored?.deletedAt);

  const legalPages = await Promise.all([
    fetch(`${baseUrl}/legal/privacy`),
    fetch(`${baseUrl}/legal/terms`),
    fetch(`${baseUrl}/legal/support`),
    fetch(`${baseUrl}/legal/account-deletion`),
  ]);
  for (const [index, response] of legalPages.entries()) {
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.match(text, /Tradify Signals/u);
    assert.match(text, /TEMPLATE — LAWYER REVIEW REQUIRED BEFORE LAUNCH/u);
    if (index < 2) assert.match(text, /TEMPLATE/u);
  }

  const invalidPublicRequest = await fetch(`${baseUrl}/legal/account-deletion/request`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "email=not-an-email",
  });
  assert.equal(invalidPublicRequest.status, 400);

  const publicEmail = `public-deletion-${testRunId}@example.test`;
  const publicRequest = await fetch(`${baseUrl}/legal/account-deletion/request`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `email=${encodeURIComponent(publicEmail)}`,
  });
  assert.equal(publicRequest.status, 202);
  const [pending] = await db
    .select({
      status: tradifyAccountDeletionRequests.status,
      email: tradifyAccountDeletionRequests.email,
    })
    .from(tradifyAccountDeletionRequests)
    .where(
      and(
        eq(tradifyAccountDeletionRequests.email, publicEmail),
        eq(tradifyAccountDeletionRequests.source, "PUBLIC_WEB"),
      ),
    );
  assert.equal(pending?.status, "PENDING");
  assert.equal(pending?.email, publicEmail);

  console.log("account deletion tests passed");
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
  await pool.end();
}
