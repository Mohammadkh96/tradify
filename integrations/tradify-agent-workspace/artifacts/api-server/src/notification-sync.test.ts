import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { pool } from "@workspace/db";
import app from "./app";
import { updateCustomerState, type UserNotification } from "./tradify-runtime";

// The workspace test runner provisions a disposable database before this suite.
assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/tradify_test_/);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", resolve));
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

function client(token?: string) {
  return async <T = unknown>(path: string, method = "GET", body?: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, headers: response.headers, body: await response.json() as T };
  };
}

const timestamp = Date.now();
const fixtures: UserNotification[] = [
  { id: "first", timestamp, timeLabel: "Just now", symbol: "XAUUSD", type: "MARKET_WARNING",
    title: "Review position", message: "A market warning", isRead: false },
  { id: "second", timestamp: timestamp + 1, timeLabel: "Just now", symbol: "EURUSD", type: "NEW_SETUP",
    title: "New opportunity", message: "A validated setup", isRead: false },
  { id: "already-read", timestamp: timestamp + 2, timeLabel: "Just now", symbol: "XAGUSD", type: "STATUS_CHANGE",
    title: "Opportunity updated", message: "An earlier update", isRead: true },
];

try {
  const anonymous = client();
  for (const [path, method] of [
    ["/user/notifications", "GET"],
    ["/user/notifications/first/read", "PATCH"],
    ["/user/notifications/read-all", "POST"],
  ]) {
    assert.equal((await anonymous(path!, method)).status, 401, `${method} ${path} requires authentication`);
  }

  const email = `notification-sync-${randomUUID()}@example.test`;
  const password = "notification-sync-test-password";
  const registration = await anonymous<{ token: string; user: { id: string } }>(
    "/auth/register", "POST", { email, password },
  );
  assert.equal(registration.status, 201);
  const firstClient = client(registration.body.token);
  await updateCustomerState(registration.body.user.id, (user) => {
    user.profile.membership = "Pro";
    user.notifications = fixtures.map((entry) => ({ ...entry }));
  });
  const signIn = await anonymous<{ token: string }>("/auth/sign-in", "POST", { email, password });
  assert.equal(signIn.status, 200);
  assert.notEqual(signIn.body.token, registration.body.token, "Devices have independent sessions");
  const secondClient = client(signIn.body.token);
  async function list(request: ReturnType<typeof client>) {
    const result = await request<UserNotification[]>("/user/notifications");
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("cache-control"), "no-store");
    return result.body;
  }
  const before = await list(secondClient);
  assert.deepEqual(before.map(({ id, isRead }) => ({ id, isRead })), [
    { id: "already-read", isRead: true }, { id: "second", isRead: false }, { id: "first", isRead: false },
  ]);
  assert.deepEqual(await list(firstClient), before);

  const read = await firstClient<{ ok: boolean; notification: UserNotification }>(
    "/user/notifications/first/read", "PATCH",
  );
  assert.equal(read.status, 200);
  assert.deepEqual(read.body, {
    ok: true, notification: { ...before.find((entry) => entry.id === "first"), isRead: true },
  });
  const afterSingleRead = await list(secondClient);
  assert.deepEqual(afterSingleRead, before.map((entry) =>
    entry.id === "first" ? { ...entry, isRead: true } : entry,
  ), "The second authenticated client observes a single read on refetch");
  assert.equal((await firstClient("/user/notifications/first/read", "PATCH")).status, 200);
  assert.deepEqual(await list(secondClient), afterSingleRead, "Repeated reads are idempotent");

  const missing = await firstClient<{ error: string }>("/user/notifications/unknown/read", "PATCH");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, "NOTIFICATION_NOT_FOUND");
  assert.deepEqual(await list(secondClient), afterSingleRead, "Unknown IDs do not alter saved state");

  // A different account cannot list or mark this account's notifications.
  const other = await anonymous<{ token: string; user: { id: string } }>(
    "/auth/register", "POST", { email: `notification-other-${randomUUID()}@example.test`, password },
  );
  assert.equal(other.status, 201);
  await updateCustomerState(other.body.user.id, (user) => { user.profile.membership = "Pro"; });
  const otherClient = client(other.body.token);
  assert.deepEqual(await list(otherClient), []);
  assert.equal((await otherClient("/user/notifications/first/read", "PATCH")).status, 404);
  assert.equal((await otherClient("/user/notifications/read-all", "POST")).status, 200);
  assert.deepEqual(await list(secondClient), afterSingleRead);

  const readAll = await secondClient("/user/notifications/read-all", "POST");
  assert.equal(readAll.status, 200);
  assert.deepEqual(readAll.body, { ok: true });
  const allRead = afterSingleRead.map((entry) => ({ ...entry, isRead: true }));
  assert.deepEqual(await list(firstClient), allRead, "Read-all from the second device reaches the first");
  assert.equal((await secondClient("/user/notifications/read-all", "POST")).status, 200);
  assert.deepEqual(await list(firstClient), allRead);
  console.log("Notification authentication, account isolation, single-read, read-all, unknown IDs, and two-client refetch passed.");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
}
