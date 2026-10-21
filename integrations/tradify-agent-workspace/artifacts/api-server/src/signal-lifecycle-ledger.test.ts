import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomUUID } from "node:crypto";
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
  tradifyWebPushDeliveries,
  tradifyWebPushSubscriptions,
} from "@workspace/db";
import type { AuthoritativeEvaluation } from "./authoritative-engine";
import { persistTrustedSignalLifecycle } from "./signal-lifecycle-ledger";
import { expireOverdueWebPushDeliveries } from "./web-push-delivery";

function evaluation(overrides: Partial<AuthoritativeEvaluation> = {}): AuthoritativeEvaluation {
  const timestamp = Date.now();
  return {
    symbol: "EURUSD",
    strategy: "DGV8",
    strategyVersion: "DGV8-1",
    assignmentId: null,
    evaluationId: randomUUID(),
    result: "SIGNAL_GENERATED",
    rejectionReason: null,
    signalGenerated: true,
    signal: {
      id: `signal-${timestamp}`,
      strategy: "DGV8",
      strategyVersion: "DGV8-1",
      symbol: "EURUSD",
      tradingDay: "2026-10-13",
      timeframe: "M15",
      direction: "LONG",
      action: "BUY",
      lifecycleStatus: "DETECTED",
      activeTradeState: "NOT_ENTERED",
      detectedAt: Math.floor(timestamp / 1000),
      entry: 1.1,
      stopLoss: 1.09,
      targets: [{ label: "TP1", price: 1.12 }],
      marketDataSnapshot: { provider: "MT5", providerSymbol: "EURUSD", latestConfirmedCandleTime: timestamp },
      strategyFacts: {},
      reasons: [],
    },
    candles: [],
    provider: "MT5",
    providerSymbol: "EURUSD",
    dataState: "LIVE",
    validation: { valid: true } as AuthoritativeEvaluation["validation"],
    provenance: {
      source: "MT5",
      provider: "MT5",
      providerSymbol: "EURUSD",
      timeframe: "M15",
      candleCount: 100,
      firstCandleTime: timestamp - 100 * 900_000,
      lastCandleTime: timestamp,
      closedCandleCount: 100,
      validation: { valid: true } as AuthoritativeEvaluation["validation"],
      marketDataTrusted: true,
      authority: null,
    },
    ...overrides,
  } as AuthoritativeEvaluation;
}

async function createUser(userId: string, membership: "Free" | "Pro"): Promise<void> {
  await db.insert(tradifyUsers).values({
    id: userId,
    email: `${userId}@example.test`,
    passwordHash: "test-only",
    name: "Notification test",
    accountSize: 10_000,
    riskPercent: 1,
    maxDailyLoss: 500,
    maxTrades: 3,
    aggressive: false,
    membership,
    role: "user",
    status: "active",
    entitlements: [],
    entitlementGrants: [],
    entitlementDenies: [],
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
}

test("trusted signal events persist once and notify only opted-in entitled users", async () => {
  const proUserId = `signal-event-pro-${randomUUID()}`;
  const freeUserId = `signal-event-free-${randomUUID()}`;
  const subscriptionId = randomUUID();
  const secondSubscriptionId = randomUUID();
  const expoSubscriptionId = randomUUID();
  const endpoint = `https://push.example.test/${randomUUID()}`;
  const secondEndpoint = `https://push.example.test/${randomUUID()}`;
  const symbol = `EURUSD-${randomUUID().slice(0, 8)}`;
  const trusted = evaluation({ symbol });
  try {
    await createUser(proUserId, "Pro");
    await createUser(freeUserId, "Free");
    await db.insert(tradifyNotificationPreferences).values({
      userId: proUserId,
      categories: { newSignals: true },
    });
    await db.insert(tradifyNotificationPreferences).values({
      userId: freeUserId,
      categories: { newSignals: true },
    });
    await db.insert(tradifyWebPushSubscriptions).values({
      id: subscriptionId,
      userId: proUserId,
      endpoint,
      endpointHash: createHash("sha256").update(endpoint).digest("hex"),
      p256dh: "abcdefghijklmnop",
      auth: "abcdefghijklmnop",
    });
    await db.insert(tradifyWebPushSubscriptions).values({
      id: secondSubscriptionId,
      userId: proUserId,
      endpoint: secondEndpoint,
      endpointHash: createHash("sha256").update(secondEndpoint).digest("hex"),
      p256dh: "abcdefghijklmnop",
      auth: "abcdefghijklmnop",
    });
    const expoToken = `ExpoPushToken[${randomUUID().replaceAll("-", "")}]`;
    await db.insert(tradifyExpoPushSubscriptions).values({
      id: expoSubscriptionId,
      userId: proUserId,
      pushToken: expoToken,
      tokenHash: createHash("sha256").update(expoToken).digest("hex"),
      platform: "android",
    });

    await persistTrustedSignalLifecycle(trusted);
    await persistTrustedSignalLifecycle({ ...trusted, evaluationId: randomUUID() });
    await persistTrustedSignalLifecycle({
      ...trusted,
      evaluationId: randomUUID(),
      provenance: { ...trusted.provenance, marketDataTrusted: false },
    });

    const events = await db
      .select()
      .from(tradifySignalLifecycleEvents)
      .where(eq(tradifySignalLifecycleEvents.symbol, symbol));
    const notifications = await db
      .select()
      .from(tradifyUserNotifications)
      .where(eq(tradifyUserNotifications.userId, proUserId));
    const freeNotifications = await db
      .select()
      .from(tradifyUserNotifications)
      .where(eq(tradifyUserNotifications.userId, freeUserId));
    const deliveries = notifications[0]
      ? await db
          .select()
          .from(tradifyWebPushDeliveries)
          .where(eq(tradifyWebPushDeliveries.notificationId, notifications[0].id))
      : [];
    const expoDeliveries = notifications[0]
      ? await db
          .select()
          .from(tradifyExpoPushDeliveries)
          .where(eq(tradifyExpoPushDeliveries.notificationId, notifications[0].id))
      : [];
    assert.equal(events.filter((event) => event.eventType === "NEW_SIGNAL").length, 1);
    assert.equal(notifications.length, 1);
    assert.equal(freeNotifications.length, 0);
    assert.equal(deliveries.length, 2, "each browser installation gets its own Web Push delivery");
    assert.deepEqual(
      deliveries.map((delivery) => delivery.subscriptionId).sort(),
      [subscriptionId, secondSubscriptionId].sort(),
    );
    assert.equal(
      deliveries[0]?.expiresAt.getTime() - events[0]!.occurredAt.getTime(),
      24 * 60 * 60 * 1_000,
      "Web Push expires 24 hours after its verified lifecycle event",
    );
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1_000 + 1);
    assert.equal(await expireOverdueWebPushDeliveries(expiredAt), 2);
    const expiredDeliveries = await db
      .select({ status: tradifyWebPushDeliveries.status })
      .from(tradifyWebPushDeliveries)
      .where(eq(tradifyWebPushDeliveries.notificationId, notifications[0]!.id));
    assert.ok(expiredDeliveries.every((delivery) => delivery.status === "EXPIRED"));
    assert.equal(expoDeliveries.length, 1);
    assert.equal(expoDeliveries[0].subscriptionId, expoSubscriptionId);

    const quoteOnlySignal = evaluation({
      symbol: "NDX",
      signal: { ...trusted.signal, symbol: "NDX", id: `quote-only-${randomUUID()}` },
    });
    await persistTrustedSignalLifecycle(quoteOnlySignal);
    const afterQuoteOnlyEvent = await db
      .select()
      .from(tradifyUserNotifications)
      .where(eq(tradifyUserNotifications.userId, proUserId));
    assert.equal(
      afterQuoteOnlyEvent.length,
      1,
      "Pro users must not receive a signal notification for a VIP-only quote symbol",
    );
  } finally {
    await db.delete(tradifyUsers).where(eq(tradifyUsers.id, proUserId));
    await db.delete(tradifyUsers).where(eq(tradifyUsers.id, freeUserId));
    await db
      .delete(tradifySignalLifecycleStates)
      .where(eq(tradifySignalLifecycleStates.symbol, trusted.symbol));
  }
});

test("ambiguous intrabar target ordering does not create a target event", async () => {
  const symbol = `XAUUSD-${randomUUID().slice(0, 8)}`;
  const ambiguous = evaluation({
    symbol,
    signal: {
      ...evaluation().signal,
      symbol,
      id: `ambiguous-${randomUUID()}`,
      action: "TP1_HIT",
      lifecycleStatus: "CLOSED",
      tradeLifecycle: {
        status: "INTRABAR_AMBIGUOUS",
        entry: 1.1,
        stop: 1.09,
        target: 1.12,
        closedAt: null,
        exitPrice: null,
      },
    },
  });
  try {
    await persistTrustedSignalLifecycle(ambiguous);
    const events = await db
      .select()
      .from(tradifySignalLifecycleEvents)
      .where(eq(tradifySignalLifecycleEvents.symbol, symbol));
    assert.equal(events.some((event) => event.eventType === "TP1_REACHED"), false);
  } finally {
    await db
      .delete(tradifySignalLifecycleStates)
      .where(eq(tradifySignalLifecycleStates.symbol, symbol));
  }
});
