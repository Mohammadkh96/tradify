import { createHash } from "node:crypto";
import webpush from "web-push";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import {
  db,
  tradifyNotificationPreferences,
  tradifySignalLifecycleEvents,
  tradifyUserNotifications,
  tradifyUsers,
  tradifyWebPushDeliveries,
  tradifyWebPushSubscriptions,
} from "@workspace/db";
import { logger } from "./lib/logger";
import { canReceiveTrustedSignalEvent } from "./signal-lifecycle-ledger";

const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 20;
const LEASE_MS = 2 * 60_000;
const TICK_MS = 10_000;

function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function getWebPushPublicKey(): string | null {
  return vapidConfig()?.publicKey ?? null;
}

export async function expireOverdueWebPushDeliveries(now = new Date()): Promise<number> {
  const expired = await db
    .update(tradifyWebPushDeliveries)
    .set({
      status: "EXPIRED",
      lastError: "Delivery window expired.",
      leaseUntil: null,
      updatedAt: now,
    })
    .where(
      and(
        inArray(tradifyWebPushDeliveries.status, ["QUEUED", "RETRY", "SENDING"]),
        lte(tradifyWebPushDeliveries.expiresAt, now),
      ),
    )
    .returning({ id: tradifyWebPushDeliveries.id });
  return expired.length;
}

async function sendBatch(): Promise<void> {
  const vapid = vapidConfig();
  if (!vapid) return;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const now = new Date();
  await expireOverdueWebPushDeliveries(now);
  const due = await db
    .select({ id: tradifyWebPushDeliveries.id })
    .from(tradifyWebPushDeliveries)
    .where(
      or(
        and(
          inArray(tradifyWebPushDeliveries.status, ["QUEUED", "RETRY"]),
          lte(tradifyWebPushDeliveries.nextAttemptAt, now),
          sql`${tradifyWebPushDeliveries.expiresAt} > ${now}`,
        ),
        and(
          eq(tradifyWebPushDeliveries.status, "SENDING"),
          lte(tradifyWebPushDeliveries.leaseUntil, now),
          sql`${tradifyWebPushDeliveries.expiresAt} > ${now}`,
        ),
      ),
    )
    .orderBy(tradifyWebPushDeliveries.nextAttemptAt)
    .limit(BATCH_SIZE);

  for (const item of due) {
    const [claimed] = await db
      .update(tradifyWebPushDeliveries)
      .set({
        status: "SENDING",
        attempts: sql`${tradifyWebPushDeliveries.attempts} + 1`,
        leaseUntil: new Date(Date.now() + LEASE_MS),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tradifyWebPushDeliveries.id, item.id),
          or(
            and(
              inArray(tradifyWebPushDeliveries.status, ["QUEUED", "RETRY"]),
              lte(tradifyWebPushDeliveries.nextAttemptAt, now),
              sql`${tradifyWebPushDeliveries.expiresAt} > ${now}`,
            ),
            and(
              eq(tradifyWebPushDeliveries.status, "SENDING"),
              lte(tradifyWebPushDeliveries.leaseUntil, now),
              sql`${tradifyWebPushDeliveries.expiresAt} > ${now}`,
            ),
          ),
        ),
      )
      .returning({ id: tradifyWebPushDeliveries.id, attempts: tradifyWebPushDeliveries.attempts });
    if (!claimed) continue;

    const [delivery] = await db
      .select({
        deliveryId: tradifyWebPushDeliveries.id,
        subscriptionId: tradifyWebPushSubscriptions.id,
        endpoint: tradifyWebPushSubscriptions.endpoint,
        p256dh: tradifyWebPushSubscriptions.p256dh,
        auth: tradifyWebPushSubscriptions.auth,
        subscriptionStatus: tradifyWebPushSubscriptions.status,
        userId: tradifyUserNotifications.userId,
        membership: tradifyUsers.membership,
        accountStatus: tradifyUsers.status,
        membershipSource: tradifyUsers.membershipSource,
        subscriptionStatusAccount: tradifyUsers.subscriptionStatus,
        billingExpiresAt: tradifyUsers.billingExpiresAt,
        trialEndsAt: tradifyUsers.trialEndsAt,
        overrideEndsAt: tradifyUsers.overrideEndsAt,
        preferences: tradifyNotificationPreferences.categories,
        notificationId: tradifyUserNotifications.id,
        expiresAt: tradifyWebPushDeliveries.expiresAt,
        eventId: tradifySignalLifecycleEvents.id,
        signalId: tradifySignalLifecycleEvents.signalId,
        eventType: tradifySignalLifecycleEvents.eventType,
        symbol: tradifySignalLifecycleEvents.symbol,
        price: tradifySignalLifecycleEvents.price,
        occurredAt: tradifySignalLifecycleEvents.occurredAt,
        details: tradifySignalLifecycleEvents.details,
      })
      .from(tradifyWebPushDeliveries)
      .innerJoin(
        tradifyUserNotifications,
        eq(tradifyUserNotifications.id, tradifyWebPushDeliveries.notificationId),
      )
      .innerJoin(
        tradifyWebPushSubscriptions,
        and(
          eq(tradifyWebPushSubscriptions.id, tradifyWebPushDeliveries.subscriptionId),
          eq(tradifyWebPushSubscriptions.userId, tradifyUserNotifications.userId),
        ),
      )
      .innerJoin(tradifyUsers, eq(tradifyUsers.id, tradifyUserNotifications.userId))
      .leftJoin(
        tradifyNotificationPreferences,
        eq(tradifyNotificationPreferences.userId, tradifyUsers.id),
      )
      .innerJoin(
        tradifySignalLifecycleEvents,
        eq(tradifySignalLifecycleEvents.id, tradifyUserNotifications.eventId),
      )
      .where(eq(tradifyWebPushDeliveries.id, claimed.id));
    if (!delivery) {
      await db
        .update(tradifyWebPushDeliveries)
        .set({ status: "FAILED", lastError: "Referenced delivery data is missing.", leaseUntil: null, updatedAt: new Date() })
        .where(eq(tradifyWebPushDeliveries.id, claimed.id));
      continue;
    }
    if (delivery.expiresAt.getTime() <= Date.now()) {
      await db
        .update(tradifyWebPushDeliveries)
        .set({
          status: "EXPIRED",
          lastError: "Delivery window expired.",
          leaseUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(tradifyWebPushDeliveries.id, claimed.id));
      continue;
    }
    const category =
      delivery.eventType === "NEW_SIGNAL"
        ? "newSignals"
        : delivery.eventType === "ENTRY_TRIGGERED"
          ? "entries"
          : delivery.eventType.startsWith("TP") && delivery.eventType.endsWith("_REACHED")
            ? "takeProfits"
            : delivery.eventType === "STOP_LOSS_HIT"
              ? "stopLosses"
              : "breakevenAndChanges";
    const canDeliver =
      delivery.subscriptionStatus === "ACTIVE" &&
      delivery.preferences?.[category] === true &&
      canReceiveTrustedSignalEvent(
        {
          status: delivery.accountStatus,
          membership: delivery.membership,
          membershipSource: delivery.membershipSource,
          subscriptionStatus: delivery.subscriptionStatusAccount,
          billingExpiresAt: delivery.billingExpiresAt,
          trialEndsAt: delivery.trialEndsAt,
          overrideEndsAt: delivery.overrideEndsAt,
        },
        delivery.symbol,
      );
    if (!canDeliver) {
      await db
        .update(tradifyWebPushDeliveries)
        .set({
          status: "SKIPPED_NOT_AUTHORIZED",
          lastError: "Recipient entitlement, category preference, or subscription is no longer active.",
          leaseUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(tradifyWebPushDeliveries.id, claimed.id));
      continue;
    }

    const targetIndex = delivery.details.targetIndex;
    const title =
      delivery.eventType === "NEW_SIGNAL"
        ? `New ${String(delivery.details.direction ?? "")} ${delivery.symbol} signal`
        : /^TP\d+_REACHED$/.test(delivery.eventType)
          ? `TP${String(targetIndex ?? "")} reached · ${delivery.symbol}`
          : `${delivery.symbol} signal update`;
    const payload = JSON.stringify({
      id: delivery.eventId,
      title,
      body: delivery.price === null ? delivery.eventType.replaceAll("_", " ") : `${delivery.eventType.replaceAll("_", " ")} at ${delivery.price}`,
      url: `/signal/${delivery.signalId}?symbol=${encodeURIComponent(delivery.symbol)}`,
      timestamp: delivery.occurredAt.toISOString(),
    });

    try {
      const result = await webpush.sendNotification(
        {
          endpoint: delivery.endpoint,
          keys: { p256dh: delivery.p256dh, auth: delivery.auth },
        },
        payload,
        {
          TTL: Math.max(
            1,
            Math.min(60 * 60, Math.ceil((delivery.expiresAt.getTime() - Date.now()) / 1000)),
          ),
        },
      );
      await db
        .update(tradifyWebPushDeliveries)
        .set({
          status: "ACCEPTED",
          lastStatusCode: result.statusCode,
          lastError: null,
          leaseUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(tradifyWebPushDeliveries.id, claimed.id));
    } catch (error) {
      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;
      if (statusCode === 404 || statusCode === 410) {
        await db.transaction(async (tx) => {
          await tx
            .update(tradifyWebPushSubscriptions)
            .set({ status: "EXPIRED", lastSeenAt: new Date() })
            .where(eq(tradifyWebPushSubscriptions.id, delivery.subscriptionId));
          await tx
            .update(tradifyWebPushDeliveries)
            .set({
              status: "SUBSCRIPTION_EXPIRED",
              lastStatusCode: statusCode,
              lastError: "Push service reports this subscription has expired.",
              leaseUntil: null,
              updatedAt: new Date(),
            })
            .where(eq(tradifyWebPushDeliveries.id, claimed.id));
        });
        continue;
      }
      const retryable = statusCode === 429 || statusCode === null || statusCode >= 500;
      const status = retryable && claimed.attempts < MAX_ATTEMPTS ? "RETRY" : "FAILED";
      const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(claimed.attempts - 1, 7));
      const safeError =
        error instanceof Error
          ? error.message.replace(/https?:\/\/\S+/g, "[push endpoint]").slice(0, 500)
          : "Unknown Web Push provider error.";
      await db
        .update(tradifyWebPushDeliveries)
        .set({
          status,
          lastStatusCode: Number.isFinite(statusCode) ? statusCode : null,
          lastError: safeError,
          nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
          leaseUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(tradifyWebPushDeliveries.id, claimed.id));
      logger.warn(
        { deliveryId: createHash("sha256").update(claimed.id).digest("hex").slice(0, 12), status, statusCode },
        "Web Push delivery attempt failed",
      );
    }
  }
}

export function startWebPushDeliveryWorker(): NodeJS.Timeout | null {
  if (!vapidConfig()) {
    logger.warn(
      { required: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] },
      "Web Push delivery is paused until VAPID configuration is complete",
    );
  }
  const timer = setInterval(() => void sendBatch().catch((error: unknown) => {
    logger.error({ errorType: error instanceof Error ? error.name : typeof error }, "Web Push queue worker failed");
  }), TICK_MS);
  timer.unref();
  void sendBatch().catch((error: unknown) => {
    logger.error({ errorType: error instanceof Error ? error.name : typeof error }, "Web Push queue worker failed");
  });
  return timer;
}
