import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  tradifyExpoPushDeliveries,
  tradifyExpoPushSubscriptions,
  tradifyNotificationPreferences,
  tradifySignalLifecycleEvents,
  tradifySignalLifecycleStates,
  tradifyUserNotifications,
  tradifyUsers,
} from "@workspace/db";
import { runExpoPushDeliverySweep } from "./expo-push-delivery";

assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/tradify_test_/);

test("Expo push retries transient errors and records provider tickets and receipts", async () => {
  const userId = `expo-delivery-${randomUUID()}`;
  const signalId = `expo-signal-${randomUUID()}`;
  const privateSignalId = `expo-private-signal-${randomUUID()}`;
  const eventId = `expo-event-${randomUUID()}`;
  const privateEventId = `expo-private-event-${randomUUID()}`;
  const notificationId = `expo-notification-${randomUUID()}`;
  const privateNotificationId = `expo-private-notification-${randomUUID()}`;
  const acceptedSubscriptionId = randomUUID();
  const retrySubscriptionId = randomUUID();
  const acceptedToken = `ExponentPushToken[${randomUUID().replaceAll("-", "")}]`;
  const retryToken = `ExpoPushToken[${randomUUID().replaceAll("-", "")}]`;
  try {
    await db.insert(tradifyUsers).values({
      id: userId,
      email: `${userId}@example.test`,
      passwordHash: "test-only",
      name: "Expo push test",
      accountSize: 10_000,
      riskPercent: 1,
      maxDailyLoss: 500,
      maxTrades: 3,
      aggressive: false,
      membership: "Pro",
      role: "user",
      status: "active",
      entitlements: [],
      entitlementGrants: [],
      entitlementDenies: [],
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
    await db.insert(tradifyNotificationPreferences).values({
      userId,
      categories: { newSignals: true },
    });
    await db.insert(tradifySignalLifecycleStates).values({
      signalId,
      strategyVersion: "DGV8-1",
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
      strategyVersion: "DGV8-1",
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
    await db.insert(tradifyExpoPushSubscriptions).values([
      {
        id: acceptedSubscriptionId,
        userId,
        pushToken: acceptedToken,
        tokenHash: createHash("sha256").update(acceptedToken).digest("hex"),
        platform: "ios",
      },
      {
        id: retrySubscriptionId,
        userId,
        pushToken: retryToken,
        tokenHash: createHash("sha256").update(retryToken).digest("hex"),
        platform: "android",
      },
    ]);
    const acceptedDeliveryId = randomUUID();
    const retryDeliveryId = randomUUID();
    await db.insert(tradifyExpoPushDeliveries).values([
      {
        id: acceptedDeliveryId,
        notificationId,
        subscriptionId: acceptedSubscriptionId,
      },
      {
        id: retryDeliveryId,
        notificationId,
        subscriptionId: retrySubscriptionId,
      },
    ]);

    let shouldRetryFail = true;
    let shouldReturnProviderReceipt = false;
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/push/send")) {
        const messages = JSON.parse(String(init?.body)) as Array<{ to: string }>;
        if (messages[0]?.to === retryToken && shouldRetryFail) {
          return new Response("rate limited", { status: 503 });
        }
        return new Response(
          JSON.stringify({
            data: [
              {
                status: "ok",
                id: messages[0]?.to === retryToken ? "expo-ticket-retry" : "expo-ticket-accepted",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/push/getReceipts")) {
        if (!shouldReturnProviderReceipt) {
          return new Response(JSON.stringify({ data: {} }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ data: { "expo-ticket-accepted": { status: "ok" } } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`Unexpected Expo endpoint: ${url}`);
    };

    await runExpoPushDeliverySweep(fetcher);
    const [accepted] = await db
      .select()
      .from(tradifyExpoPushDeliveries)
      .where(eq(tradifyExpoPushDeliveries.id, acceptedDeliveryId));
    const [retry] = await db
      .select()
      .from(tradifyExpoPushDeliveries)
      .where(eq(tradifyExpoPushDeliveries.id, retryDeliveryId));
    assert.equal(accepted.status, "ACCEPTED");
    assert.equal(accepted.expoTicketId, "expo-ticket-accepted");
    assert.equal(accepted.receiptStatus, null, "provider acceptance is not a device receipt");
    assert.equal(retry.status, "RETRY");
    assert.equal(retry.attempts, 1);

    shouldRetryFail = false;
    await db
      .update(tradifyExpoPushDeliveries)
      .set({ nextAttemptAt: new Date(Date.now() - 1_000) })
      .where(eq(tradifyExpoPushDeliveries.id, retryDeliveryId));
    await runExpoPushDeliverySweep(fetcher);
    const [retried] = await db
      .select()
      .from(tradifyExpoPushDeliveries)
      .where(eq(tradifyExpoPushDeliveries.id, retryDeliveryId));
    assert.equal(retried.status, "ACCEPTED");
    assert.equal(retried.attempts, 2);

    shouldReturnProviderReceipt = true;
    await db
      .update(tradifyExpoPushDeliveries)
      .set({ receiptCheckedAt: new Date(Date.now() - 16 * 60_000) })
      .where(eq(tradifyExpoPushDeliveries.id, acceptedDeliveryId));
    await runExpoPushDeliverySweep(fetcher);
    const [receiptChecked] = await db
      .select()
      .from(tradifyExpoPushDeliveries)
      .where(eq(tradifyExpoPushDeliveries.id, acceptedDeliveryId));
    assert.equal(receiptChecked.status, "RECEIPT_OK");
    assert.equal(receiptChecked.receiptStatus, "ok");
    assert.equal(receiptChecked.receiptError, null);
    assert.notEqual(receiptChecked.status, "DELIVERED");

    await db.insert(tradifySignalLifecycleStates).values({
      signalId: privateSignalId,
      strategyVersion: "DGV8-1",
      symbol: "NDX",
      direction: "LONG",
      snapshot: {},
      lastMarketDataAt: new Date(),
    });
    await db.insert(tradifySignalLifecycleEvents).values({
      id: privateEventId,
      signalId: privateSignalId,
      eventType: "NEW_SIGNAL",
      occurredAt: new Date(),
      price: 1.1,
      strategyVersion: "DGV8-1",
      symbol: "NDX",
      sourceEvaluationId: randomUUID(),
      details: { signalId: privateSignalId, direction: "LONG" },
    });
    await db.insert(tradifyUserNotifications).values({
      id: privateNotificationId,
      userId,
      eventId: privateEventId,
      category: "newSignals",
    });
    const blockedDeliveryId = randomUUID();
    await db.insert(tradifyExpoPushDeliveries).values({
      id: blockedDeliveryId,
      notificationId: privateNotificationId,
      subscriptionId: acceptedSubscriptionId,
    });
    await runExpoPushDeliverySweep(async () => {
      throw new Error("An inaccessible market notification must not reach Expo.");
    });
    const [blocked] = await db
      .select()
      .from(tradifyExpoPushDeliveries)
      .where(eq(tradifyExpoPushDeliveries.id, blockedDeliveryId));
    assert.equal(blocked.status, "SKIPPED_NOT_AUTHORIZED");
  } finally {
    await db.delete(tradifyUsers).where(eq(tradifyUsers.id, userId));
    await db
      .delete(tradifySignalLifecycleStates)
      .where(eq(tradifySignalLifecycleStates.signalId, signalId));
    await db
      .delete(tradifySignalLifecycleStates)
      .where(eq(tradifySignalLifecycleStates.signalId, privateSignalId));
  }
});
