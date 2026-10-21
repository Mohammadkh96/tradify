import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  tradifyExpoPushDeliveries,
  tradifyExpoPushSubscriptions,
  tradifyNotificationPreferences,
  tradifySignalLifecycleEvents,
  tradifySignalLifecycleStates,
  tradifyWebPushDeliveries,
  tradifyWebPushSubscriptions,
  tradifyUserNotifications,
  tradifyUsers,
} from "@workspace/db";
import type { AuthoritativeEvaluation } from "./authoritative-engine";
import {
  hasFeatureAccess,
  hasMarketAccess,
  MT5_MARKET_SYMBOLS,
  type CustomerMembershipTier,
} from "./market-access";
import { CANONICAL_SYMBOLS, SymbolMapper } from "./zip-engine/market/SymbolMapper";
import { mt5WatchlistSymbolIdentity } from "./zip-engine/market/MT5WatchlistCatalog";

type SignalEventType =
  | "NEW_SIGNAL"
  | "ENTRY_TRIGGERED"
  | `TP${number}_REACHED`
  | "STOP_LOSS_HIT"
  | "BREAKEVEN_ACTIVATED"
  | "STOP_MODIFIED"
  | "SIGNAL_CANCELLED"
  | "SIGNAL_INVALIDATED"
  | "SIGNAL_EXPIRED"
  | "SIGNAL_COMPLETED";

interface EventCandidate {
  eventType: SignalEventType;
  occurredAt: Date;
  price: number | null;
  key: string;
  details: Record<string, unknown>;
}

export function notificationCategory(eventType: string): string {
  if (eventType === "NEW_SIGNAL") return "newSignals";
  if (eventType === "ENTRY_TRIGGERED") return "entries";
  if (eventType.startsWith("TP") && eventType.endsWith("_REACHED")) return "takeProfits";
  if (eventType === "STOP_LOSS_HIT") return "stopLosses";
  return "breakevenAndChanges";
}

type SignalNotificationAccount = {
  status: string;
  membership: string;
  membershipSource: string;
  subscriptionStatus: string | null;
  billingExpiresAt: string | null;
  trialEndsAt: string | null;
  overrideEndsAt: string | null;
};

export function hasCurrentSignalEntitlement(
  user: SignalNotificationAccount,
): boolean {
  if (
    user.status !== "active" ||
    !hasFeatureAccess(user.membership as CustomerMembershipTier, "signalContext")
  ) {
    return false;
  }
  const now = Date.now();
  if (user.membershipSource === "ADMIN_OVERRIDE") {
    const expiry = Date.parse(user.overrideEndsAt ?? user.trialEndsAt ?? "");
    return !user.overrideEndsAt && !user.trialEndsAt ? true : Number.isFinite(expiry) && expiry > now;
  }
  if (user.membershipSource === "REVENUECAT") {
    if (!["ACTIVE", "TRIALING", "CANCELLED"].includes(user.subscriptionStatus ?? "")) return false;
    if (user.billingExpiresAt) {
      const expiry = Date.parse(user.billingExpiresAt);
      if (!Number.isFinite(expiry) || expiry <= now) return false;
    }
  }
  return true;
}

const coreMarketSymbols = new Set<string>(CANONICAL_SYMBOLS);

function canonicalizeSignalMarket(rawSymbol: string): string | null {
  const quoteOnlySymbol = mt5WatchlistSymbolIdentity(rawSymbol);
  if (quoteOnlySymbol) return quoteOnlySymbol;
  return SymbolMapper.toCanonical(rawSymbol).canonical;
}

export function canReceiveTrustedSignalEvent(
  user: SignalNotificationAccount,
  rawSymbol: string,
): boolean {
  return (
    hasCurrentSignalEntitlement(user) &&
    hasMarketAccess(
      rawSymbol,
      user.membership as CustomerMembershipTier,
      coreMarketSymbols,
      canonicalizeSignalMarket,
    )
  );
}

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function epochDate(value: number): Date {
  return new Date(value > 10_000_000_000 ? value : value * 1000);
}

function identityFor(evaluation: AuthoritativeEvaluation): string | null {
  const signal = evaluation.signal;
  const detectedAt = signal.lastSignalEvent?.detectedAt ?? signal.detectedAt;
  if (typeof detectedAt !== "number" || !Number.isFinite(detectedAt)) return null;
  const detectedAtSeconds = Math.floor(
    detectedAt > 10_000_000_000 ? detectedAt / 1000 : detectedAt,
  );
  const identity = [
    evaluation.strategy,
    evaluation.strategyVersion,
    evaluation.symbol.trim().toUpperCase(),
    "M15",
    signal.direction,
    String(detectedAtSeconds),
  ].join("|");
  return createHash("sha256").update(identity).digest("hex");
}

function eventId(signalId: string, candidate: EventCandidate): string {
  return createHash("sha256")
    .update(`${signalId}|${candidate.eventType}|${candidate.key}`)
    .digest("hex");
}

function candidateEvents(
  evaluation: AuthoritativeEvaluation,
  previous: Record<string, unknown> | undefined,
  signalId: string,
): EventCandidate[] {
  const signal = evaluation.signal;
  const lifecycle = signal.tradeLifecycle;
  const marketTime = evaluation.provenance.lastCandleTime;
  const marketDate =
    typeof marketTime === "number" && Number.isFinite(marketTime) ? epochDate(marketTime) : null;
  if (!marketDate || Number.isNaN(marketDate.getTime())) return [];

  const detectedTime = signal.lastSignalEvent?.detectedAt ?? signal.detectedAt ?? marketTime!;
  const detectedDate = epochDate(detectedTime);
  const entry = finitePositive(signal.entry ?? lifecycle?.entry);
  const stop = finitePositive(signal.stopLoss ?? lifecycle?.stop);
  const targets = signal.targets
    .map((target, index) => ({ index, label: target.label || `TP${index + 1}`, price: target.price }))
    .filter((target) => finitePositive(target.price) !== null);
  const candidates: EventCandidate[] = [];
  const add = (
    eventType: SignalEventType,
    key: string,
    occurredAt: Date,
    price: number | null,
    details: Record<string, unknown> = {},
  ) => {
    if (!Number.isNaN(occurredAt.getTime())) {
      candidates.push({ eventType, key, occurredAt, price, details: { ...details, signalId } });
    }
  };

  if (evaluation.signalGenerated) {
    add(
      "NEW_SIGNAL",
      "created",
      Number.isNaN(detectedDate.getTime()) ? marketDate : detectedDate,
      entry,
      { direction: signal.direction, action: signal.action },
    );
  }

  const previousTradeState = previous?.activeTradeState;
  const isEntered =
    signal.activeTradeState === "ACTIVE" ||
    (lifecycle?.status !== undefined && lifecycle.status !== "NOT_STARTED");
  if (isEntered && previousTradeState !== "ACTIVE") {
    add("ENTRY_TRIGGERED", "entry", marketDate, entry, { direction: signal.direction });
  }

  const action = signal.action.trim().toUpperCase();
  const actionTargetMatch = action.match(/^TP([1-9]\d*)_HIT$/);
  let reachedTargetIndex = actionTargetMatch ? Number(actionTargetMatch[1]) - 1 : -1;
  if (reachedTargetIndex < 0 && lifecycle?.status === "TP_HIT") {
    reachedTargetIndex = targets.findIndex((target) => target.price === lifecycle.target);
  }
  if (
    reachedTargetIndex >= 0 &&
    reachedTargetIndex < targets.length &&
    lifecycle?.status !== "INTRABAR_AMBIGUOUS"
  ) {
    const target = targets[reachedTargetIndex];
    add(
      `TP${reachedTargetIndex + 1}_REACHED`,
      `target-${reachedTargetIndex + 1}`,
      lifecycle?.firstTpTouchTime
        ? epochDate(lifecycle.firstTpTouchTime)
        : marketDate,
      target.price,
      { targetIndex: reachedTargetIndex + 1, targetLabel: target.label },
    );
  }

  if (
    lifecycle?.status === "STOP_HIT" &&
    lifecycle.firstSlTouchTime
  ) {
    add(
      "STOP_LOSS_HIT",
      "stop-hit",
      epochDate(lifecycle.firstSlTouchTime),
      finitePositive(lifecycle.exitPrice) ?? stop,
    );
  }

  const previousStop = finitePositive(previous?.stopLoss);
  if (stop !== null && previousStop !== null && stop !== previousStop) {
    const atBreakeven = entry !== null && stop === entry;
    add(
      atBreakeven ? "BREAKEVEN_ACTIVATED" : "STOP_MODIFIED",
      `${marketDate.toISOString()}|${stop}`,
      marketDate,
      stop,
      { previousStop, stop, entry },
    );
  }

  if (signal.activeTradeState === "CANCELLED") {
    add("SIGNAL_CANCELLED", "cancelled", marketDate, null);
  }
  if (signal.lifecycleStatus === "EXPIRED") {
    add("SIGNAL_EXPIRED", "expired", marketDate, null);
  }
  if (action === "INVALIDATED") {
    add("SIGNAL_INVALIDATED", "invalidated", marketDate, null);
  }
  if (
    action === "EXITED" ||
    (signal.lifecycleStatus === "CLOSED" && lifecycle?.status === "TP_HIT")
  ) {
    add("SIGNAL_COMPLETED", "completed", marketDate, finitePositive(lifecycle?.exitPrice));
  }
  return candidates;
}

export async function persistTrustedSignalLifecycle(evaluation: AuthoritativeEvaluation): Promise<void> {
  if (
    !evaluation.provenance.marketDataTrusted ||
    !evaluation.validation.valid ||
    evaluation.provenance.timeframe !== "M15" ||
    evaluation.signal.direction === "NONE"
  ) {
    return;
  }

  const signalId = identityFor(evaluation);
  if (!signalId) return;
  const marketTimestamp = evaluation.provenance.lastCandleTime;
  if (typeof marketTimestamp !== "number" || !Number.isFinite(marketTimestamp)) return;
  const lastMarketDataAt = new Date(
    marketTimestamp > 10_000_000_000 ? marketTimestamp : marketTimestamp * 1000,
  );
  if (Number.isNaN(lastMarketDataAt.getTime())) return;

  await db.transaction(async (tx) => {
    const [prior] = await tx
      .select()
      .from(tradifySignalLifecycleStates)
      .where(eq(tradifySignalLifecycleStates.signalId, signalId))
      .for("update");
    const priorTime = prior?.lastMarketDataAt.getTime() ?? 0;
    if (lastMarketDataAt.getTime() < priorTime) return;
    const previous = prior?.snapshot;
    const candidates = candidateEvents(evaluation, previous, signalId);
    const snapshot: Record<string, unknown> = {
      lifecycleStatus: evaluation.signal.lifecycleStatus,
      activeTradeState: evaluation.signal.activeTradeState ?? null,
      action: evaluation.signal.action,
      entry: finitePositive(evaluation.signal.entry ?? evaluation.signal.tradeLifecycle?.entry),
      stopLoss: finitePositive(evaluation.signal.stopLoss ?? evaluation.signal.tradeLifecycle?.stop),
      tradeLifecycle: evaluation.signal.tradeLifecycle ?? null,
    };
    await tx
      .insert(tradifySignalLifecycleStates)
      .values({
        signalId,
        strategyVersion: evaluation.strategyVersion,
        symbol: evaluation.symbol,
        direction: evaluation.signal.direction,
        snapshot,
        lastMarketDataAt,
      })
      .onConflictDoUpdate({
        target: tradifySignalLifecycleStates.signalId,
        set: {
          strategyVersion: evaluation.strategyVersion,
          symbol: evaluation.symbol,
          direction: evaluation.signal.direction,
          snapshot,
          lastMarketDataAt,
          updatedAt: new Date(),
        },
      });

    if (candidates.length) {
      const insertedEvents = await tx
        .insert(tradifySignalLifecycleEvents)
        .values(
          candidates.map((candidate) => ({
            id: eventId(signalId, candidate),
            signalId,
            eventType: candidate.eventType,
            occurredAt: candidate.occurredAt,
            price: candidate.price,
            strategyVersion: evaluation.strategyVersion,
            symbol: evaluation.symbol,
            sourceEvaluationId: evaluation.evaluationId,
            details: candidate.details,
          })),
        )
        .onConflictDoNothing()
        .returning();
      if (insertedEvents.length) {
        const recipients = await tx
          .select({
            id: tradifyUsers.id,
            status: tradifyUsers.status,
            membership: tradifyUsers.membership,
            membershipSource: tradifyUsers.membershipSource,
            subscriptionStatus: tradifyUsers.subscriptionStatus,
            billingExpiresAt: tradifyUsers.billingExpiresAt,
            trialEndsAt: tradifyUsers.trialEndsAt,
            overrideEndsAt: tradifyUsers.overrideEndsAt,
            categories: tradifyNotificationPreferences.categories,
          })
          .from(tradifyUsers)
          .leftJoin(
            tradifyNotificationPreferences,
            eq(tradifyNotificationPreferences.userId, tradifyUsers.id),
          )
          .where(eq(tradifyUsers.status, "active"));
        const notificationRows = insertedEvents.flatMap((event) => {
          const category = notificationCategory(event.eventType);
          return recipients
            .filter(
              (recipient) =>
                canReceiveTrustedSignalEvent(recipient, event.symbol) &&
                recipient.categories?.[category] === true,
            )
            .map((recipient) => ({
              id: createHash("sha256")
                .update(`${recipient.id}|${event.id}`)
                .digest("hex"),
              userId: recipient.id,
              eventId: event.id,
              category,
            }));
        });
        if (notificationRows.length) {
          const savedNotifications = await tx
            .insert(tradifyUserNotifications)
            .values(notificationRows)
            .onConflictDoNothing()
            .returning();
          const eventExpiryById = new Map(
            insertedEvents.map((event) => [
              event.id,
              new Date(event.occurredAt.getTime() + 24 * 60 * 60 * 1_000),
            ]),
          );
          const userIds = [...new Set(savedNotifications.map((notification) => notification.userId))];
          if (userIds.length) {
            const [webSubscriptions, expoSubscriptions] = await Promise.all([
              tx
              .select({
                id: tradifyWebPushSubscriptions.id,
                userId: tradifyWebPushSubscriptions.userId,
              })
              .from(tradifyWebPushSubscriptions)
              .where(
                and(
                  inArray(tradifyWebPushSubscriptions.userId, userIds),
                  eq(tradifyWebPushSubscriptions.status, "ACTIVE"),
                ),
              ),
              tx
                .select({
                  id: tradifyExpoPushSubscriptions.id,
                  userId: tradifyExpoPushSubscriptions.userId,
                })
                .from(tradifyExpoPushSubscriptions)
                .where(
                  and(
                    inArray(tradifyExpoPushSubscriptions.userId, userIds),
                    eq(tradifyExpoPushSubscriptions.status, "ACTIVE"),
                  ),
                ),
            ]);
            const webDeliveryRows = savedNotifications.flatMap((notification) =>
              webSubscriptions
                .filter((subscription) => subscription.userId === notification.userId)
                .map((subscription) => ({
                  id: createHash("sha256")
                    .update(`${notification.id}|${subscription.id}`)
                    .digest("hex"),
                  notificationId: notification.id,
                  subscriptionId: subscription.id,
                    expiresAt: eventExpiryById.get(notification.eventId),
                })),
            );
            if (webDeliveryRows.length) {
              await tx.insert(tradifyWebPushDeliveries).values(webDeliveryRows).onConflictDoNothing();
            }
            const expoDeliveryRows = savedNotifications.flatMap((notification) =>
              expoSubscriptions
                .filter((subscription) => subscription.userId === notification.userId)
                .map((subscription) => ({
                  id: createHash("sha256")
                    .update(`${notification.id}|expo|${subscription.id}`)
                    .digest("hex"),
                  notificationId: notification.id,
                  subscriptionId: subscription.id,
                })),
            );
            if (expoDeliveryRows.length) {
              await tx.insert(tradifyExpoPushDeliveries).values(expoDeliveryRows).onConflictDoNothing();
            }
          }
        }
      }
    }
  });
}
