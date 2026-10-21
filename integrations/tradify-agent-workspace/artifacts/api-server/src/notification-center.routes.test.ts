import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  tradifyAdminAuditEvents,
  tradifyExpoPushDeliveries,
  tradifyExpoPushSubscriptions,
  tradifyNotificationPreferences,
  tradifySignalLifecycleEvents,
  tradifySignalLifecycleStates,
  tradifyStaffAccess,
  tradifyUserNotifications,
  tradifyUsers,
} from "@workspace/db";
import app from "./app";
import { createTestAdmin, testAuthClientIp } from "./test-admin";

assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/tradify_test_/);

test("notification center protects reads and retries, checks current audience eligibility, audits and serializes staff actions", async () => {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const fixture = randomUUID();
  const fixtureUserIds: string[] = [];
  const notificationIds: string[] = [];
  const eventIds: string[] = [];
  const signalIds: string[] = [];
  const subscriptionIds: string[] = [];
  const deliveryIds: string[] = [];
  const request = async <T = Record<string, unknown>>(
    path: string,
    token?: string,
    method = "GET",
    body?: unknown,
  ) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testAuthClientIp,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as T };
  };

  async function makeCustomer(key: string, membership: "Free" | "Pro", announcements = true) {
    const id = `${fixture}-${key}`;
    fixtureUserIds.push(id);
    const now = new Date().toISOString();
    await db.insert(tradifyUsers).values({
      id,
      email: `${id}@example.test`,
      passwordHash: "notification-center-test-only",
      name: `Notification test ${key}`,
      accountSize: 10_000,
      riskPercent: 1,
      maxDailyLoss: 500,
      maxTrades: 3,
      aggressive: false,
      membership,
      membershipSource: "UNKNOWN",
      role: "user",
      status: "active",
      entitlements: [],
      entitlementGrants: [],
      entitlementDenies: [],
      createdAt: now,
      lastSeenAt: now,
    });
    await db.insert(tradifyNotificationPreferences).values({
      userId: id,
      categories: { newSignals: announcements },
    });
    return id;
  }

  async function addDelivery(
    key: string,
    userId: string,
    status: "FAILED" | "SKIPPED_NOT_AUTHORIZED" | "QUEUED" | "ACCEPTED",
  ) {
    const signalId = `${fixture}-signal-${key}`;
    const eventId = `${fixture}-event-${key}`;
    const notificationId = `${fixture}-notification-${key}`;
    const subscriptionId = `${fixture}-subscription-${key}`;
    const deliveryId = `${fixture}-delivery-${key}`;
    signalIds.push(signalId);
    eventIds.push(eventId);
    notificationIds.push(notificationId);
    subscriptionIds.push(subscriptionId);
    deliveryIds.push(deliveryId);
    await db.insert(tradifySignalLifecycleStates).values({
      signalId,
      strategyVersion: "DGV8-test",
      symbol: "EURUSD",
      direction: "LONG",
      snapshot: {},
      lastMarketDataAt: new Date(),
    });
    await db.insert(tradifySignalLifecycleEvents).values({
      id: eventId,
      signalId,
      eventType: "NEW_SIGNAL",
      occurredAt: new Date(),
      price: 1.1,
      strategyVersion: "DGV8-test",
      symbol: "EURUSD",
      sourceEvaluationId: randomUUID(),
      details: { signalId, direction: "LONG" },
    });
    await db.insert(tradifyUserNotifications).values({
      id: notificationId,
      userId,
      eventId,
      category: "newSignals",
    });
    await db.insert(tradifyExpoPushSubscriptions).values({
      id: subscriptionId,
      userId,
      pushToken: `ExponentPushToken[${randomUUID().replaceAll("-", "")}]`,
      tokenHash: randomUUID().replaceAll("-", ""),
      platform: "ios",
    });
    await db.insert(tradifyExpoPushDeliveries).values({
      id: deliveryId,
      notificationId,
      subscriptionId,
      status,
    });
    return deliveryId;
  }

  try {
    const admin = await createTestAdmin(baseUrl);
    fixtureUserIds.push(admin.userId);
    const reader = await request<{ token: string; user: { id: string } }>(
      "/auth/register",
      undefined,
      "POST",
      { email: `${fixture}-reader@example.test`, password: "notification-center-reader-password" },
    );
    assert.equal(reader.status, 201);
    const readerUserId = reader.body.user.id;
    fixtureUserIds.push(readerUserId);
    await db.update(tradifyUsers).set({ role: "admin" }).where(eq(tradifyUsers.id, readerUserId));
    await db.insert(tradifyStaffAccess).values({
      userId: readerUserId,
      role: "READ_ONLY",
      active: true,
    });

    const eligibleUserId = await makeCustomer("eligible", "Pro");
    const noLongerEligibleUserId = await makeCustomer("downgraded", "Free");
    const optedOutUserId = await makeCustomer("opted-out", "Pro", false);
    const eligibleDeliveryId = await addDelivery("eligible", eligibleUserId, "FAILED");
    const downgradedDeliveryId = await addDelivery("downgraded", noLongerEligibleUserId, "FAILED");
    const optedOutDeliveryId = await addDelivery("opted-out", optedOutUserId, "FAILED");
    const queuedDeliveryId = await addDelivery("queued", eligibleUserId, "QUEUED");
    const acceptedDeliveryId = await addDelivery("accepted", eligibleUserId, "ACCEPTED");
    const suppressedDeliveryId = await addDelivery(
      "suppressed",
      eligibleUserId,
      "SKIPPED_NOT_AUTHORIZED",
    );

    assert.equal((await request("/admin/notifications")).status, 401);
    assert.equal(
      (await request("/admin/notifications", admin.token)).status,
      200,
      "customer admin role alone does not grant staff access",
    );
    const listed = await request<{
      items: Array<{ id: string; status: string; channel: string }>;
      partial: boolean;
    }>("/admin/notifications", admin.token);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.partial, false);
    assert.ok(listed.body.items.some((row) => row.id === suppressedDeliveryId && row.status === "SUPPRESSED"));
    assert.ok(listed.body.items.some((row) => row.id === eligibleDeliveryId && row.status === "FAILED"));
    assert.ok(listed.body.items.some((row) => row.id === queuedDeliveryId && row.status === "QUEUED"));
    assert.ok(listed.body.items.some((row) => row.id === acceptedDeliveryId && row.status === "ACCEPTED"));
    const acceptedFilter = await request<{ items: Array<{ id: string; status: string }> }>(
      "/admin/notifications?status=ACCEPTED",
      admin.token,
    );
    assert.equal(acceptedFilter.body.items.length, 1);
    assert.equal(acceptedFilter.body.items[0]?.id, acceptedDeliveryId);
    assert.ok(
      !JSON.stringify(listed.body).includes("ExponentPushToken"),
      "provider tokens are never included in the staff response",
    );

    const readOnlyList = await request("/admin/notifications", reader.body.token);
    assert.equal(readOnlyList.status, 200);
    assert.equal(
      (
        await request(
          `/admin/notifications/EXPO/${eligibleDeliveryId}/retry`,
          reader.body.token,
          "POST",
          { reason: "Support requested retry" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          `/admin/notifications/EXPO/${downgradedDeliveryId}/retry`,
          admin.token,
          "POST",
          { reason: "Customer no longer has the required market tier" },
        )
      ).status,
      409,
      "a downgrade blocks retry even though the original notification was eligible",
    );
    assert.equal(
      (
        await request(
          `/admin/notifications/EXPO/${optedOutDeliveryId}/retry`,
          admin.token,
          "POST",
          { reason: "Customer disabled this notification category" },
        )
      ).status,
      409,
      "current notification preference is rechecked before retry",
    );

    const attempts = await Promise.all([
      request(
        `/admin/notifications/EXPO/${eligibleDeliveryId}/retry`,
        admin.token,
        "POST",
        { reason: "Retry after checking the provider incident" },
      ),
      request(
        `/admin/notifications/EXPO/${eligibleDeliveryId}/retry`,
        admin.token,
        "POST",
        { reason: "Retry after checking the provider incident" },
      ),
    ]);
    assert.deepEqual(
      attempts.map((attempt) => attempt.status).sort(),
      [200, 409],
      "only one concurrent staff retry can claim a failed delivery",
    );
    const [retried] = await db
      .select({ status: tradifyExpoPushDeliveries.status })
      .from(tradifyExpoPushDeliveries)
      .where(eq(tradifyExpoPushDeliveries.id, eligibleDeliveryId));
    assert.equal(retried.status, "RETRY");
    const audits = await db
      .select()
      .from(tradifyAdminAuditEvents)
      .where(
        and(
          eq(tradifyAdminAuditEvents.action, "NOTIFICATION_DELIVERY_RETRIED"),
          eq(tradifyAdminAuditEvents.actorId, admin.userId),
        ),
      );
    const retryAudits = audits.filter((audit) => {
      const details = audit.details as { deliveryId?: string };
      return details.deliveryId === eligibleDeliveryId;
    });
    assert.equal(retryAudits.length, 1, "the queue change and one audit event commit together");
    assert.deepEqual(retryAudits[0]?.details, {
      channel: "EXPO",
      deliveryId: eligibleDeliveryId,
      notificationId: `${fixture}-notification-eligible`,
      reason: "Retry after checking the provider incident",
    });
  } finally {
    if (fixtureUserIds.length) {
      await db
        .delete(tradifyAdminAuditEvents)
        .where(
          and(
            eq(tradifyAdminAuditEvents.action, "NOTIFICATION_DELIVERY_RETRIED"),
            inArray(tradifyAdminAuditEvents.targetUserId, fixtureUserIds),
          ),
        );
    }
    if (deliveryIds.length) {
      await db
        .delete(tradifyExpoPushDeliveries)
        .where(inArray(tradifyExpoPushDeliveries.id, deliveryIds));
    }
    if (subscriptionIds.length) {
      await db
        .delete(tradifyExpoPushSubscriptions)
        .where(inArray(tradifyExpoPushSubscriptions.id, subscriptionIds));
    }
    if (notificationIds.length) {
      await db
        .delete(tradifyUserNotifications)
        .where(inArray(tradifyUserNotifications.id, notificationIds));
    }
    if (eventIds.length) {
      await db
        .delete(tradifySignalLifecycleEvents)
        .where(inArray(tradifySignalLifecycleEvents.id, eventIds));
    }
    if (signalIds.length) {
      await db
        .delete(tradifySignalLifecycleStates)
        .where(inArray(tradifySignalLifecycleStates.signalId, signalIds));
    }
    if (fixtureUserIds.length) {
      await db
        .delete(tradifyNotificationPreferences)
        .where(inArray(tradifyNotificationPreferences.userId, fixtureUserIds));
      await db
        .delete(tradifyStaffAccess)
        .where(inArray(tradifyStaffAccess.userId, fixtureUserIds));
      await db.delete(tradifyUsers).where(inArray(tradifyUsers.id, fixtureUserIds));
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
});
