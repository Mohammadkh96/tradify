import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  db,
  tradifyExpoPushDeliveries,
  tradifyExpoPushSubscriptions,
  tradifyNotificationPreferences,
  tradifySignalLifecycleEvents,
  tradifyUserNotifications,
  tradifyUsers,
} from "@workspace/db";
import { logger } from "./lib/logger";
import {
  canReceiveTrustedSignalEvent,
  notificationCategory,
} from "./signal-lifecycle-ledger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 20;
const LEASE_MS = 2 * 60_000;
const RECEIPT_POLL_INTERVAL_MS = 15 * 60_000;
const TICK_MS = 10_000;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeProviderCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value)
    ? value
    : null;
}

function retryDelay(attempt: number): Date {
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(attempt - 1, 7));
  return new Date(Date.now() + delaySeconds * 1000);
}

function eventCopy(eventType: string, symbol: string, price: number | null, targetIndex: unknown) {
  const atPrice = price === null ? "" : ` at ${price}`;
  if (eventType === "NEW_SIGNAL") {
    return {
      title: `New ${symbol} signal`,
      body: "A new validated signal is available.",
    };
  }
  if (eventType === "ENTRY_TRIGGERED") {
    return { title: `${symbol} entry level reached`, body: `Signal entry level reached${atPrice}.` };
  }
  if (/^TP\d+_REACHED$/.test(eventType)) {
    const target = typeof targetIndex === "number" ? targetIndex : Number(eventType.match(/\d+/)?.[0] ?? 0);
    return {
      title: `${symbol} take-profit update`,
      body: `Take-profit target ${target} reached${atPrice}.`,
    };
  }
  if (eventType === "STOP_LOSS_HIT") {
    return { title: `${symbol} stop-loss update`, body: `Stop-loss level reached${atPrice}.` };
  }
  const messages: Record<string, { title: string; body: string }> = {
    BREAKEVEN_ACTIVATED: { title: `${symbol} signal update`, body: "Breakeven protection activated." },
    STOP_MODIFIED: { title: `${symbol} signal update`, body: "The signal stop level changed." },
    SIGNAL_CANCELLED: { title: `${symbol} signal update`, body: "The signal was cancelled." },
    SIGNAL_INVALIDATED: { title: `${symbol} signal update`, body: "The signal is no longer valid." },
    SIGNAL_EXPIRED: { title: `${symbol} signal update`, body: "The signal expired." },
    SIGNAL_COMPLETED: { title: `${symbol} signal update`, body: "The signal lifecycle is complete." },
  };
  return messages[eventType] ?? { title: `${symbol} signal update`, body: "A validated signal status changed." };
}

function expoHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}

async function markSendRetry(
  deliveryId: string,
  attempts: number,
  statusCode: number | null,
  safeMessage: string,
): Promise<void> {
  const retry = attempts < MAX_ATTEMPTS;
  await db
    .update(tradifyExpoPushDeliveries)
    .set({
      status: retry ? "RETRY" : "FAILED",
      lastStatusCode: statusCode,
      lastError: safeMessage,
      nextAttemptAt: retry ? retryDelay(attempts) : new Date(),
      leaseUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(tradifyExpoPushDeliveries.id, deliveryId));
}

async function sendQueuedBatch(fetcher: typeof fetch): Promise<void> {
  const now = new Date();
  const due = await db
    .select({ id: tradifyExpoPushDeliveries.id })
    .from(tradifyExpoPushDeliveries)
    .where(
      or(
        and(
          inArray(tradifyExpoPushDeliveries.status, ["QUEUED", "RETRY"]),
          lte(tradifyExpoPushDeliveries.nextAttemptAt, now),
        ),
        and(
          eq(tradifyExpoPushDeliveries.status, "SENDING"),
          lte(tradifyExpoPushDeliveries.leaseUntil, now),
        ),
      ),
    )
    .orderBy(tradifyExpoPushDeliveries.nextAttemptAt)
    .limit(BATCH_SIZE);

  for (const item of due) {
    const [claimed] = await db
      .update(tradifyExpoPushDeliveries)
      .set({
        status: "SENDING",
        attempts: sql`${tradifyExpoPushDeliveries.attempts} + 1`,
        leaseUntil: new Date(Date.now() + LEASE_MS),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tradifyExpoPushDeliveries.id, item.id),
          or(
            and(
              inArray(tradifyExpoPushDeliveries.status, ["QUEUED", "RETRY"]),
              lte(tradifyExpoPushDeliveries.nextAttemptAt, now),
            ),
            and(
              eq(tradifyExpoPushDeliveries.status, "SENDING"),
              lte(tradifyExpoPushDeliveries.leaseUntil, now),
            ),
          ),
        ),
      )
      .returning({ id: tradifyExpoPushDeliveries.id, attempts: tradifyExpoPushDeliveries.attempts });
    if (!claimed) continue;

    const [delivery] = await db
      .select({
        deliveryId: tradifyExpoPushDeliveries.id,
        subscriptionId: tradifyExpoPushSubscriptions.id,
        pushToken: tradifyExpoPushSubscriptions.pushToken,
        subscriptionStatus: tradifyExpoPushSubscriptions.status,
        userId: tradifyUserNotifications.userId,
        accountStatus: tradifyUsers.status,
        membership: tradifyUsers.membership,
        membershipSource: tradifyUsers.membershipSource,
        subscriptionStatusAccount: tradifyUsers.subscriptionStatus,
        billingExpiresAt: tradifyUsers.billingExpiresAt,
        trialEndsAt: tradifyUsers.trialEndsAt,
        overrideEndsAt: tradifyUsers.overrideEndsAt,
        preferences: tradifyNotificationPreferences.categories,
        notificationId: tradifyUserNotifications.id,
        signalId: tradifySignalLifecycleEvents.signalId,
        eventType: tradifySignalLifecycleEvents.eventType,
        symbol: tradifySignalLifecycleEvents.symbol,
        price: tradifySignalLifecycleEvents.price,
        occurredAt: tradifySignalLifecycleEvents.occurredAt,
        details: tradifySignalLifecycleEvents.details,
      })
      .from(tradifyExpoPushDeliveries)
      .innerJoin(
        tradifyUserNotifications,
        eq(tradifyUserNotifications.id, tradifyExpoPushDeliveries.notificationId),
      )
      .innerJoin(
        tradifyExpoPushSubscriptions,
        and(
          eq(tradifyExpoPushSubscriptions.id, tradifyExpoPushDeliveries.subscriptionId),
          eq(tradifyExpoPushSubscriptions.userId, tradifyUserNotifications.userId),
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
      .where(eq(tradifyExpoPushDeliveries.id, claimed.id));
    if (!delivery) {
      await db
        .update(tradifyExpoPushDeliveries)
        .set({
          status: "FAILED",
          lastError: "Referenced delivery data is missing.",
          leaseUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(tradifyExpoPushDeliveries.id, claimed.id));
      continue;
    }

    const category = notificationCategory(delivery.eventType);
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
        .update(tradifyExpoPushDeliveries)
        .set({
          status: "SKIPPED_NOT_AUTHORIZED",
          lastError: "Recipient entitlement, market access, category preference, or device registration is no longer active.",
          leaseUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(tradifyExpoPushDeliveries.id, claimed.id));
      continue;
    }

    const copy = eventCopy(
      delivery.eventType,
      delivery.symbol,
      delivery.price,
      delivery.details.targetIndex,
    );
    const data = {
      signalId: delivery.signalId,
      symbol: delivery.symbol,
      occurredAt: delivery.occurredAt.toISOString(),
      url: `/signal/${encodeURIComponent(delivery.signalId)}?symbol=${encodeURIComponent(delivery.symbol)}`,
    };
    try {
      const response = await fetcher(EXPO_PUSH_URL, {
        method: "POST",
        headers: expoHeaders(),
        body: JSON.stringify([
          {
            to: delivery.pushToken,
            title: copy.title,
            body: copy.body,
            sound: "default",
            channelId: "signal-alerts",
            data,
          },
        ]),
        signal: AbortSignal.timeout(12_000),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        await markSendRetry(
          claimed.id,
          claimed.attempts,
          response.status,
          `Expo Push returned HTTP ${response.status}.`,
        );
        if (!retryable) {
          await db
            .update(tradifyExpoPushDeliveries)
            .set({ status: "FAILED", nextAttemptAt: new Date() })
            .where(eq(tradifyExpoPushDeliveries.id, claimed.id));
        }
        continue;
      }
      const ticket = isRecord(responseBody) && Array.isArray(responseBody.data)
        ? responseBody.data[0]
        : null;
      if (!isRecord(ticket)) {
        await markSendRetry(
          claimed.id,
          claimed.attempts,
          response.status,
          "Expo Push returned an unreadable ticket response.",
        );
        continue;
      }
      if (ticket.status === "ok" && typeof ticket.id === "string") {
        await db
          .update(tradifyExpoPushDeliveries)
          .set({
            status: "ACCEPTED",
            expoTicketId: ticket.id,
            lastStatusCode: response.status,
            lastError: null,
            leaseUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(tradifyExpoPushDeliveries.id, claimed.id));
        continue;
      }

      const details = isRecord(ticket.details) ? ticket.details : {};
      const errorCode = safeProviderCode(details.error);
      if (errorCode === "DeviceNotRegistered") {
        await db.transaction(async (tx) => {
          await tx
            .update(tradifyExpoPushSubscriptions)
            .set({ status: "EXPIRED", lastSeenAt: new Date() })
            .where(eq(tradifyExpoPushSubscriptions.id, delivery.subscriptionId));
          await tx
            .update(tradifyExpoPushDeliveries)
            .set({
              status: "SUBSCRIPTION_EXPIRED",
              lastStatusCode: response.status,
              lastError: "Expo reports this device token is no longer registered.",
              leaseUntil: null,
              updatedAt: new Date(),
            })
            .where(eq(tradifyExpoPushDeliveries.id, claimed.id));
        });
      } else if (errorCode === "MessageRateExceeded") {
        await markSendRetry(
          claimed.id,
          claimed.attempts,
          response.status,
          "Expo Push rate limit reached.",
        );
      } else {
        await db
          .update(tradifyExpoPushDeliveries)
          .set({
            status: "FAILED",
            lastStatusCode: response.status,
            lastError: `Expo ticket was rejected${errorCode ? ` (${errorCode})` : ""}.`,
            leaseUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(tradifyExpoPushDeliveries.id, claimed.id));
      }
    } catch {
      await markSendRetry(
        claimed.id,
        claimed.attempts,
        null,
        "Expo Push request could not be completed.",
      );
    }
  }
}

async function checkProviderReceipts(fetcher: typeof fetch): Promise<void> {
  const now = new Date();
  const olderThan = new Date(now.getTime() - RECEIPT_POLL_INTERVAL_MS);
  const receipts = await db
    .select({
      id: tradifyExpoPushDeliveries.id,
      expoTicketId: tradifyExpoPushDeliveries.expoTicketId,
      subscriptionId: tradifyExpoPushDeliveries.subscriptionId,
    })
    .from(tradifyExpoPushDeliveries)
    .where(
      and(
        eq(tradifyExpoPushDeliveries.status, "ACCEPTED"),
        sql`${tradifyExpoPushDeliveries.expoTicketId} IS NOT NULL`,
        or(
          isNull(tradifyExpoPushDeliveries.receiptCheckedAt),
          lte(tradifyExpoPushDeliveries.receiptCheckedAt, olderThan),
        ),
      ),
    )
    .limit(100);
  if (receipts.length === 0) return;

  await db
    .update(tradifyExpoPushDeliveries)
    .set({ receiptCheckedAt: now, updatedAt: now })
    .where(inArray(tradifyExpoPushDeliveries.id, receipts.map((row) => row.id)));

  try {
    const response = await fetcher(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify({ ids: receipts.map((receipt) => receipt.expoTicketId) }),
      signal: AbortSignal.timeout(12_000),
    });
    const responseBody: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(responseBody) || !isRecord(responseBody.data)) {
      await db
        .update(tradifyExpoPushDeliveries)
        .set({
          receiptError: `Expo receipt lookup failed (HTTP ${response.status}).`,
          updatedAt: new Date(),
        })
        .where(inArray(tradifyExpoPushDeliveries.id, receipts.map((row) => row.id)));
      logger.warn(
        { statusCode: response.status, batchSize: receipts.length },
        "Expo Push receipt check failed",
      );
      return;
    }

    for (const receipt of receipts) {
      if (!receipt.expoTicketId) continue;
      const providerReceipt = responseBody.data[receipt.expoTicketId];
      if (!isRecord(providerReceipt) || (providerReceipt.status !== "ok" && providerReceipt.status !== "error")) {
        continue;
      }
      const details = isRecord(providerReceipt.details) ? providerReceipt.details : {};
      const errorCode = safeProviderCode(details.error);
      const receiptStatus = providerReceipt.status === "ok" ? "ok" : "error";
      const receiptError =
        receiptStatus === "error"
          ? errorCode ?? "Expo reported a delivery error."
          : null;
      await db.transaction(async (tx) => {
        if (errorCode === "DeviceNotRegistered") {
          await tx
            .update(tradifyExpoPushSubscriptions)
            .set({ status: "EXPIRED", lastSeenAt: new Date() })
            .where(eq(tradifyExpoPushSubscriptions.id, receipt.subscriptionId));
        }
        await tx
          .update(tradifyExpoPushDeliveries)
          .set({
            status: receiptStatus === "ok" ? "RECEIPT_OK" : "RECEIPT_ERROR",
            receiptStatus,
            receiptError,
            receiptCheckedAt: new Date(),
            lastError: receiptError,
            updatedAt: new Date(),
          })
          .where(eq(tradifyExpoPushDeliveries.id, receipt.id));
      });
    }
  } catch {
    await db
      .update(tradifyExpoPushDeliveries)
      .set({ receiptError: "Expo receipt lookup could not reach the provider.", updatedAt: new Date() })
      .where(inArray(tradifyExpoPushDeliveries.id, receipts.map((row) => row.id)));
    logger.warn({ batchSize: receipts.length }, "Expo Push receipt check could not reach the provider");
  }
}

export async function runExpoPushDeliverySweep(fetcher: typeof fetch = fetch): Promise<void> {
  await sendQueuedBatch(fetcher);
  await checkProviderReceipts(fetcher);
}

export function startExpoPushDeliveryWorker(): NodeJS.Timeout {
  const run = () =>
    void runExpoPushDeliverySweep().catch((error: unknown) => {
      logger.error(
        { errorType: error instanceof Error ? error.name : typeof error },
        "Expo Push queue worker failed",
      );
    });
  const timer = setInterval(run, TICK_MS);
  timer.unref();
  run();
  return timer;
}
