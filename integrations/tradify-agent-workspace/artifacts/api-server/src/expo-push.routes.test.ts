import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  tradifyExpoPushSubscriptions,
  tradifyUsers,
} from "@workspace/db";
import app from "./app";
import { updateCustomerState } from "./tradify-runtime";

assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/tradify_test_/);

test("Expo push device registration is authenticated, idempotent, revocable, and account-bound", async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const createdUserIds: string[] = [];
  const client = (token?: string) =>
    async <T = unknown>(path: string, method = "GET", body?: unknown) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: (await response.json()) as T };
    };

  try {
    const anonymous = client();
    assert.equal(
      (await anonymous("/user/expo-push/device", "PUT", {
        pushToken: "ExpoPushToken[abcdefghijklmnop]",
        platform: "android",
      })).status,
      401,
    );

    const password = "expo-push-route-test-password";
    const freeAccount = await anonymous<{ token: string; user: { id: string } }>(
      "/auth/register",
      "POST",
      { email: `expo-free-${randomUUID()}@example.test`, password },
    );
    assert.equal(freeAccount.status, 201);
    createdUserIds.push(freeAccount.body.user.id);
    const freeClient = client(freeAccount.body.token);
    assert.equal(
      (await freeClient("/user/expo-push/device", "PUT", {
        pushToken: "ExpoPushToken[abcdefghijklmnop]",
        platform: "android",
      })).status,
      403,
      "Free accounts cannot register for signal push",
    );

    const first = await anonymous<{ token: string; user: { id: string } }>(
      "/auth/register",
      "POST",
      { email: `expo-pro-${randomUUID()}@example.test`, password },
    );
    const second = await anonymous<{ token: string; user: { id: string } }>(
      "/auth/register",
      "POST",
      { email: `expo-other-${randomUUID()}@example.test`, password },
    );
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    createdUserIds.push(first.body.user.id, second.body.user.id);
    await updateCustomerState(first.body.user.id, (user) => {
      user.profile.membership = "Pro";
    });
    await updateCustomerState(second.body.user.id, (user) => {
      user.profile.membership = "Pro";
    });
    const firstClient = client(first.body.token);
    const secondClient = client(second.body.token);
    const pushToken = `ExpoPushToken[${randomUUID().replaceAll("-", "")}]`;
    const registrationBody = { pushToken, platform: "android" };

    assert.equal(
      (await firstClient("/user/expo-push/device", "PUT", { ...registrationBody, platform: "web" })).status,
      400,
    );
    const registered = await firstClient<{ ok: boolean; id: string }>(
      "/user/expo-push/device",
      "PUT",
      registrationBody,
    );
    assert.equal(registered.status, 200);
    assert.equal(registered.body.ok, true);
    const repeated = await firstClient<{ id: string }>(
      "/user/expo-push/device",
      "PUT",
      registrationBody,
    );
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.id, registered.body.id);

    const tokenHash = createHash("sha256").update(pushToken).digest("hex");
    const stored = await db
      .select()
      .from(tradifyExpoPushSubscriptions)
      .where(eq(tradifyExpoPushSubscriptions.tokenHash, tokenHash));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].userId, first.body.user.id);
    assert.equal(stored[0].platform, "android");
    assert.equal(
      (
        await secondClient("/user/expo-push/device", "PUT", registrationBody)
      ).status,
      409,
      "Another account cannot take over an active device token",
    );

    const preferences = await firstClient<Record<string, boolean>>(
      "/user/notification-preferences",
    );
    assert.equal(preferences.status, 200);
    assert.equal(preferences.body.newSignals, false);
    const updated = await firstClient<Record<string, boolean>>(
      "/user/notification-preferences",
      "PATCH",
      { newSignals: true, takeProfits: true },
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.newSignals, true);
    assert.equal(updated.body.takeProfits, true);

    assert.deepEqual(
      (await firstClient("/user/expo-push/device", "DELETE", registrationBody)).body,
      { ok: true },
    );
    const [revoked] = await db
      .select({ status: tradifyExpoPushSubscriptions.status })
      .from(tradifyExpoPushSubscriptions)
      .where(
        and(
          eq(tradifyExpoPushSubscriptions.userId, first.body.user.id),
          eq(tradifyExpoPushSubscriptions.tokenHash, tokenHash),
        ),
      );
    assert.equal(revoked.status, "REVOKED");
    assert.equal(
      (await firstClient("/user/expo-push/device", "DELETE", registrationBody)).status,
      200,
      "Device revocation can safely be retried",
    );
  } finally {
    if (createdUserIds.length) {
      for (const userId of createdUserIds) {
        await db.delete(tradifyUsers).where(eq(tradifyUsers.id, userId));
      }
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
});
