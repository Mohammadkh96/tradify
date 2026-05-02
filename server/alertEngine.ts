import { db, pool } from "./db";
import * as schema from "@shared/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { sendRiskAlertEmail } from "./emailService";

export interface AlertEvent {
  type: string;
  severity: "low" | "medium" | "high";
  title: string;
  body: string;
  payload: Record<string, unknown>;
  linkUrl?: string;
  dedupeKey: string;
  cooldownMinutes: number;
  inAppEligible: boolean;
  emailEligible: boolean;
}

interface ResolvedPrefs {
  userId: string;
  drawdownEnabled: boolean;
  drawdownInApp: boolean;
  drawdownEmail: boolean;
  drawdownWarnThreshold: number;
  drawdownCriticalThreshold: number;
  revengeEnabled: boolean;
  revengeInApp: boolean;
  revengeEmail: boolean;
  overtradingEnabled: boolean;
  overtradingInApp: boolean;
  overtradingEmail: boolean;
  overtradingDailyCap: number;
  strategyDeviationEnabled: boolean;
  strategyDeviationInApp: boolean;
  strategyDeviationEmail: boolean;
  cooldownMinutes: number;
}

const DEFAULT_PREFS: Omit<ResolvedPrefs, "userId"> = {
  drawdownEnabled: true,
  drawdownInApp: true,
  drawdownEmail: true,
  drawdownWarnThreshold: 70,
  drawdownCriticalThreshold: 90,
  revengeEnabled: true,
  revengeInApp: true,
  revengeEmail: true,
  overtradingEnabled: true,
  overtradingInApp: true,
  overtradingEmail: false,
  overtradingDailyCap: 10,
  strategyDeviationEnabled: true,
  strategyDeviationInApp: true,
  strategyDeviationEmail: false,
  cooldownMinutes: 60,
};

async function getPrefs(userId: string): Promise<ResolvedPrefs> {
  try {
    const [row] = await db.select().from(schema.alertPreferences).where(eq(schema.alertPreferences.userId, userId));
    if (row) {
      return {
        userId,
        drawdownEnabled: row.drawdownEnabled ?? DEFAULT_PREFS.drawdownEnabled,
        drawdownInApp: row.drawdownInApp ?? DEFAULT_PREFS.drawdownInApp,
        drawdownEmail: row.drawdownEmail ?? DEFAULT_PREFS.drawdownEmail,
        drawdownWarnThreshold: row.drawdownWarnThreshold ?? DEFAULT_PREFS.drawdownWarnThreshold,
        drawdownCriticalThreshold: row.drawdownCriticalThreshold ?? DEFAULT_PREFS.drawdownCriticalThreshold,
        revengeEnabled: row.revengeEnabled ?? DEFAULT_PREFS.revengeEnabled,
        revengeInApp: row.revengeInApp ?? DEFAULT_PREFS.revengeInApp,
        revengeEmail: row.revengeEmail ?? DEFAULT_PREFS.revengeEmail,
        overtradingEnabled: row.overtradingEnabled ?? DEFAULT_PREFS.overtradingEnabled,
        overtradingInApp: row.overtradingInApp ?? DEFAULT_PREFS.overtradingInApp,
        overtradingEmail: row.overtradingEmail ?? DEFAULT_PREFS.overtradingEmail,
        overtradingDailyCap: row.overtradingDailyCap ?? DEFAULT_PREFS.overtradingDailyCap,
        strategyDeviationEnabled: row.strategyDeviationEnabled ?? DEFAULT_PREFS.strategyDeviationEnabled,
        strategyDeviationInApp: row.strategyDeviationInApp ?? DEFAULT_PREFS.strategyDeviationInApp,
        strategyDeviationEmail: row.strategyDeviationEmail ?? DEFAULT_PREFS.strategyDeviationEmail,
        cooldownMinutes: row.cooldownMinutes ?? DEFAULT_PREFS.cooldownMinutes,
      };
    }
  } catch (e) {
    console.error("[AlertEngine] getPrefs error:", e);
  }
  return { userId, ...DEFAULT_PREFS };
}

async function isAlertSuppressed(userId: string, dedupeKey: string): Promise<boolean> {
  try {
    const now = new Date();
    const [existing] = await db.select()
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.dedupeKey, dedupeKey),
      ))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(1);
    if (!existing) return false;
    if (existing.cooldownUntil && new Date(existing.cooldownUntil) > now) return true;
    return false;
  } catch (e) {
    console.error("[AlertEngine] isAlertSuppressed error:", e);
    return false;
  }
}

async function persistAlert(
  userId: string,
  ev: AlertEvent,
  channelInApp: boolean,
  channelEmail: boolean,
): Promise<schema.Notification | null> {
  try {
    const cooldownUntil = new Date(Date.now() + ev.cooldownMinutes * 60 * 1000);
    const [row] = await db.insert(schema.notifications).values({
      userId,
      type: ev.type,
      severity: ev.severity,
      title: ev.title,
      body: ev.body,
      payload: ev.payload,
      linkUrl: ev.linkUrl,
      channelInApp,
      channelEmail,
      emailSent: false,
      dedupeKey: ev.dedupeKey,
      cooldownUntil,
    }).returning();
    return row || null;
  } catch (e) {
    console.error("[AlertEngine] persistAlert error:", e);
    return null;
  }
}

async function emitAlert(userId: string, ev: AlertEvent): Promise<void> {
  // If neither channel is enabled for this alert type, nothing to do.
  if (!ev.inAppEligible && !ev.emailEligible) return;
  if (await isAlertSuppressed(userId, ev.dedupeKey)) return;

  // Critical-severity alerts (e.g. drawdown breach imminent) bypass marketing
  // unsubscribe inside sendRiskAlertEmail so the user never misses an account-
  // protecting notice. The transactional flag is honored downstream.
  const notif = await persistAlert(userId, ev, ev.inAppEligible, ev.emailEligible);
  if (!notif) return;

  if (ev.emailEligible) {
    sendRiskAlertEmail(userId, {
      type: ev.type,
      severity: ev.severity,
      title: ev.title,
      body: ev.body,
      linkUrl: ev.linkUrl,
      payload: ev.payload,
    }).then(async (sent) => {
      if (sent) {
        try {
          await db.update(schema.notifications)
            .set({ emailSent: true })
            .where(eq(schema.notifications.id, notif.id));
        } catch {}
      }
    }).catch(err => console.error("[AlertEngine] email send error:", err));
  }
}

// ==================== EVALUATORS ====================

interface SyncContext {
  userId: string;
  accountId: string;
  balance: number;
  equity: number;
  todayHistory: Array<{
    ticket?: string | number;
    closeTime?: string | Date;
    openTime?: string | Date;
    profit?: number | string;
    netPl?: number | string;
    grossPl?: number | string;
    volume?: number | string;
    symbol?: string;
  }>;
}

async function evaluateDrawdownAlerts(ctx: SyncContext, prefs: Awaited<ReturnType<typeof getPrefs>>) {
  if (!prefs.drawdownEnabled) return;

  const challenges = await db.select().from(schema.propFirmChallenges)
    .where(and(
      eq(schema.propFirmChallenges.userId, ctx.userId),
      eq(schema.propFirmChallenges.status, "active"),
      eq(schema.propFirmChallenges.mt5AccountId, ctx.accountId),
    ));

  if (challenges.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateKey = today.toISOString().split("T")[0];

  for (const challenge of challenges) {
    const accountSize = parseFloat(challenge.accountSize);
    const dailyDDLimit = parseFloat(challenge.dailyDrawdownLimit);
    const maxDDLimit = parseFloat(challenge.maxDrawdownLimit);
    const highWaterMark = parseFloat(challenge.highWaterMark || challenge.accountSize);

    // Daily DD: compute today's starting balance
    const stats = await db.select().from(schema.propFirmDailyStats)
      .where(eq(schema.propFirmDailyStats.challengeId, challenge.id))
      .orderBy(desc(schema.propFirmDailyStats.date));
    const todayStat = stats.find(s => {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    const dayStartBalance = todayStat
      ? parseFloat(todayStat.startingBalance)
      : (stats[0] ? parseFloat(stats[0].endingBalance) : parseFloat(challenge.currentBalance || challenge.accountSize));

    const dailyDDAmount = dayStartBalance * (dailyDDLimit / 100);
    const dailyLoss = Math.max(0, dayStartBalance - ctx.balance);
    const dailyPct = dailyDDAmount > 0 ? (dailyLoss / dailyDDAmount) * 100 : 0;

    // Max DD calc (matches /api/prop-firm/challenges/:id)
    const maxDDFloor = challenge.trailingDrawdown
      ? highWaterMark * (1 - maxDDLimit / 100)
      : accountSize * (1 - maxDDLimit / 100);
    const maxDDDenominator = challenge.trailingDrawdown
      ? highWaterMark * (maxDDLimit / 100)
      : accountSize * (maxDDLimit / 100);
    const maxDDLossSoFar = challenge.trailingDrawdown
      ? Math.max(0, highWaterMark - ctx.balance)
      : Math.max(0, accountSize - ctx.balance);
    const maxDDPct = maxDDDenominator > 0 ? (maxDDLossSoFar / maxDDDenominator) * 100 : 0;

    const warnT = prefs.drawdownWarnThreshold;
    const critT = prefs.drawdownCriticalThreshold;
    const link = `/prop-firm`;
    const challengeLabel = `${challenge.firmName} ${challenge.challengeName}`;

    // ---- Daily DD ----
    if (dailyPct >= critT) {
      await emitAlert(ctx.userId, {
        type: "daily_dd_critical",
        severity: "high",
        title: `Critical: ${dailyPct.toFixed(0)}% of daily drawdown used`,
        body: `Your ${challengeLabel} challenge has used ${dailyPct.toFixed(1)}% of its daily drawdown limit ($${dailyLoss.toFixed(0)} of $${dailyDDAmount.toFixed(0)}). Stop trading for today to avoid breach.`,
        payload: { challengeId: challenge.id, dailyPct, dailyLoss, dailyDDAmount, balance: ctx.balance },
        linkUrl: link,
        dedupeKey: `daily_dd_critical_${challenge.id}_${dateKey}`,
        cooldownMinutes: prefs.cooldownMinutes,
        inAppEligible: prefs.drawdownInApp,
        emailEligible: prefs.drawdownEmail,
      });
    } else if (dailyPct >= warnT) {
      await emitAlert(ctx.userId, {
        type: "daily_dd_warn",
        severity: "medium",
        title: `Warning: ${dailyPct.toFixed(0)}% of daily drawdown used`,
        body: `Your ${challengeLabel} challenge has used ${dailyPct.toFixed(1)}% of its daily drawdown limit. Only $${(dailyDDAmount - dailyLoss).toFixed(0)} of buffer remains today.`,
        payload: { challengeId: challenge.id, dailyPct, dailyLoss, dailyDDAmount, balance: ctx.balance },
        linkUrl: link,
        dedupeKey: `daily_dd_warn_${challenge.id}_${dateKey}`,
        cooldownMinutes: prefs.cooldownMinutes,
        inAppEligible: prefs.drawdownInApp,
        emailEligible: prefs.drawdownEmail,
      });
    }

    // ---- Max DD ----
    if (maxDDPct >= critT) {
      await emitAlert(ctx.userId, {
        type: "max_dd_critical",
        severity: "high",
        title: `Critical: ${maxDDPct.toFixed(0)}% of max drawdown used`,
        body: `Your ${challengeLabel} challenge has used ${maxDDPct.toFixed(1)}% of its max drawdown limit. Buffer: $${(ctx.balance - maxDDFloor).toFixed(0)} until breach.`,
        payload: { challengeId: challenge.id, maxDDPct, maxDDFloor, balance: ctx.balance },
        linkUrl: link,
        dedupeKey: `max_dd_critical_${challenge.id}_${dateKey}`,
        cooldownMinutes: prefs.cooldownMinutes,
        inAppEligible: prefs.drawdownInApp,
        emailEligible: prefs.drawdownEmail,
      });
    } else if (maxDDPct >= warnT) {
      await emitAlert(ctx.userId, {
        type: "max_dd_warn",
        severity: "medium",
        title: `Warning: ${maxDDPct.toFixed(0)}% of max drawdown used`,
        body: `Your ${challengeLabel} challenge has used ${maxDDPct.toFixed(1)}% of its max drawdown limit. Buffer: $${(ctx.balance - maxDDFloor).toFixed(0)}.`,
        payload: { challengeId: challenge.id, maxDDPct, maxDDFloor, balance: ctx.balance },
        linkUrl: link,
        dedupeKey: `max_dd_warn_${challenge.id}_${dateKey}`,
        cooldownMinutes: prefs.cooldownMinutes,
        inAppEligible: prefs.drawdownInApp,
        emailEligible: prefs.drawdownEmail,
      });
    }
  }
}

async function evaluateBehavioralAlerts(ctx: SyncContext, prefs: Awaited<ReturnType<typeof getPrefs>>) {
  // Today's trades, sorted oldest -> newest by closeTime
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateKey = today.toISOString().split("T")[0];

  type T = { ticket: any; closeTime: Date; openTime: Date; netPl: number; volume: number; symbol: string };
  const trades: T[] = ctx.todayHistory
    .map(t => {
      const closeTime = t.closeTime ? new Date(t.closeTime) : null;
      const openTime = t.openTime ? new Date(t.openTime) : closeTime;
      if (!closeTime || isNaN(closeTime.getTime())) return null;
      const closeDay = new Date(closeTime); closeDay.setHours(0, 0, 0, 0);
      if (closeDay.getTime() !== today.getTime()) return null;
      return {
        ticket: t.ticket,
        closeTime,
        openTime: openTime || closeTime,
        netPl: parseFloat(String(t.netPl ?? t.profit ?? t.grossPl ?? "0")) || 0,
        volume: parseFloat(String(t.volume ?? "0")) || 0,
        symbol: t.symbol || "Unknown",
      } as T;
    })
    .filter((t): t is T => !!t)
    .sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());

  // ---- REVENGE TRADING: 3+ trades within 15 min after a loss ----
  if (prefs.revengeEnabled && trades.length >= 3) {
    for (let i = 0; i < trades.length; i++) {
      if (trades[i].netPl >= 0) continue;
      const lossClose = trades[i].closeTime.getTime();
      const cluster = trades
        .slice(i + 1)
        .filter(t => (t.openTime.getTime() - lossClose) >= 0 && (t.openTime.getTime() - lossClose) <= 15 * 60 * 1000);
      if (cluster.length >= 3) {
        await emitAlert(ctx.userId, {
          type: "revenge_trade",
          severity: "high",
          title: `Revenge trading detected`,
          body: `${cluster.length} new trades opened within 15 minutes after a $${Math.abs(trades[i].netPl).toFixed(0)} loss on ${trades[i].symbol}. Step back before sizing up further.`,
          payload: { trigger: trades[i].ticket, clusterSize: cluster.length, symbol: trades[i].symbol },
          linkUrl: `/journal`,
          dedupeKey: `revenge_${ctx.userId}_${dateKey}_${trades[i].ticket}`,
          cooldownMinutes: prefs.cooldownMinutes,
          inAppEligible: prefs.revengeInApp,
          emailEligible: prefs.revengeEmail,
        });
        break;
      }
    }
  }

  // ---- OVERTRADING: trade count >= daily cap ----
  if (prefs.overtradingEnabled && prefs.overtradingDailyCap > 0 && trades.length >= prefs.overtradingDailyCap) {
    await emitAlert(ctx.userId, {
      type: "overtrading",
      severity: trades.length >= prefs.overtradingDailyCap * 1.5 ? "high" : "medium",
      title: `Overtrading: ${trades.length} trades today`,
      body: `You've placed ${trades.length} trades today, which meets or exceeds your daily cap of ${prefs.overtradingDailyCap}. High trade frequency often correlates with chasing — consider stopping for the day.`,
      payload: { tradesToday: trades.length, cap: prefs.overtradingDailyCap },
      linkUrl: `/journal`,
      dedupeKey: `overtrading_${ctx.userId}_${dateKey}`,
      cooldownMinutes: prefs.cooldownMinutes,
      inAppEligible: prefs.overtradingInApp,
      emailEligible: prefs.overtradingEmail,
    });
  }
}

/**
 * Strategy-deviation detector (HEURISTIC).
 *
 * IMPORTANT: this is intentionally a lightweight heuristic, not a true
 * strategy-rules engine. The platform's real per-strategy rule engine lives
 * in `strategyRules` + `tradeComplianceResults` and runs only on trades
 * journaled through the in-app journal flow. MT5-imported trades are not
 * automatically linked to a strategy, so we cannot deterministically know
 * whether a freshly-synced trade matched the user's defined criteria.
 *
 * Until a UI exists for mapping MT5 tickets -> strategies (a planned
 * follow-up), this evaluator approximates "trade outside any active
 * strategy" as: the symbol the user just traded does not appear anywhere
 * in their last 30 days of journal entries while at least one strategy is
 * active. That correlates strongly with discretionary one-offs in practice.
 */
async function evaluateStrategyDeviation(ctx: SyncContext, prefs: Awaited<ReturnType<typeof getPrefs>>) {
  if (!prefs.strategyDeviationEnabled) return;
  if (ctx.todayHistory.length === 0) return;

  // Find the most recent closed trade
  const sorted = [...ctx.todayHistory]
    .filter(t => t.closeTime)
    .sort((a, b) => new Date(b.closeTime!).getTime() - new Date(a.closeTime!).getTime());
  if (sorted.length === 0) return;
  const latest = sorted[0];
  const symbol = (latest.symbol || "").trim();
  if (!symbol) return;
  const dateKey = new Date().toISOString().split("T")[0];

  // Check active strategies
  let activeCount = 0;
  try {
    const userStrategies = await db.select().from(schema.strategies)
      .where(and(eq(schema.strategies.userId, ctx.userId), eq(schema.strategies.isActive, true)));
    activeCount = userStrategies.length;
  } catch {
    return;
  }
  if (activeCount === 0) return;

  // See header comment — symbol-presence heuristic over the last 30d journal.
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const journaled = await db.select({ pair: schema.tradeJournal.pair })
      .from(schema.tradeJournal)
      .where(and(
        eq(schema.tradeJournal.userId, ctx.userId),
        gte(schema.tradeJournal.createdAt, cutoff),
      ));
    const knownSymbols = new Set(journaled.map(j => (j.pair || "").toUpperCase()));
    if (knownSymbols.has(symbol.toUpperCase())) return;
  } catch {
    return;
  }

  await emitAlert(ctx.userId, {
    type: "strategy_deviation",
    severity: "medium",
    title: `Trade outside your active strategies`,
    body: `Your latest trade on ${symbol} doesn't match any symbol you've journaled against your active strategies in the last 30 days. Review whether this trade fits your edge or was a discretionary deviation.`,
    payload: { ticket: latest.ticket, symbol, activeStrategies: activeCount, heuristic: "symbol_not_in_30d_journal" },
    linkUrl: `/strategies`,
    dedupeKey: `strategy_deviation_${ctx.userId}_${dateKey}_${latest.ticket || "latest"}`,
    cooldownMinutes: prefs.cooldownMinutes,
    inAppEligible: prefs.strategyDeviationInApp,
    emailEligible: prefs.strategyDeviationEmail,
  });
}

/**
 * Main entrypoint — called from MT5 sync route after data persistence.
 * NEVER throws; all errors swallowed and logged.
 */
export async function evaluateAlertsAfterSync(ctx: SyncContext): Promise<void> {
  try {
    const prefs = await getPrefs(ctx.userId);
    await Promise.allSettled([
      evaluateDrawdownAlerts(ctx, prefs),
      evaluateBehavioralAlerts(ctx, prefs),
      evaluateStrategyDeviation(ctx, prefs),
    ]);
  } catch (err) {
    console.error("[AlertEngine] evaluateAlertsAfterSync error:", err);
  }
}
