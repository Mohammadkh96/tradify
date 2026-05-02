import { db, pool } from "./db";
import * as schema from "@shared/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { sendRiskAlertEmail } from "./emailService";
import { notificationBus } from "./notificationBus";

// ==================== PURE HELPERS (testable, no DB) ====================

/**
 * Compute today's drawdown in absolute and percent-of-allowed terms.
 * `dailyDDLimitPct` is the firm's daily limit as a percent (e.g. 5 → 5%).
 * `dailyPct` is what % of that allowance has been used (0..N), so 100
 * means the limit is exactly hit.
 */
export function computeDailyDD(
  dayStartBalance: number,
  currentBalance: number,
  dailyDDLimitPct: number,
): { dailyLoss: number; dailyDDAmount: number; dailyPct: number } {
  const dailyDDAmount = dayStartBalance * (dailyDDLimitPct / 100);
  const dailyLoss = Math.max(0, dayStartBalance - currentBalance);
  const dailyPct = dailyDDAmount > 0 ? (dailyLoss / dailyDDAmount) * 100 : 0;
  return { dailyLoss, dailyDDAmount, dailyPct };
}

/**
 * Compute the max-drawdown breach math, supporting both static (anchored
 * to `accountSize`) and trailing (anchored to `highWaterMark`) variants.
 * Returns the floor (account value at which breach occurs) and the
 * percent of the allowed buffer that has been consumed so far.
 */
export function computeMaxDD(
  accountSize: number,
  currentBalance: number,
  maxDDLimitPct: number,
  trailingDrawdown: boolean,
  highWaterMark: number,
): { maxDDFloor: number; maxDDPct: number } {
  const anchor = trailingDrawdown ? highWaterMark : accountSize;
  const maxDDFloor = anchor * (1 - maxDDLimitPct / 100);
  const maxDDDenominator = anchor * (maxDDLimitPct / 100);
  const maxDDLossSoFar = Math.max(0, anchor - currentBalance);
  const maxDDPct = maxDDDenominator > 0 ? (maxDDLossSoFar / maxDDDenominator) * 100 : 0;
  return { maxDDFloor, maxDDPct };
}

export type DDSeverity = "none" | "warn" | "critical";

/**
 * Maps a percent-of-allowance reading to alert severity using the
 * configured warn/critical thresholds.
 *
 * IMPORTANT: thresholds are inclusive — `pct === critT` is critical,
 * matching the production behavior. Critical takes precedence over warn
 * when both fire.
 */
export function classifyDDSeverity(
  pct: number,
  warnThreshold: number,
  criticalThreshold: number,
): DDSeverity {
  if (pct >= criticalThreshold) return "critical";
  if (pct >= warnThreshold) return "warn";
  return "none";
}

export interface RevengeTrade {
  closeTime: Date;
  openTime: Date;
  netPl: number;
}

/**
 * Detects a "revenge trading" cluster — 3+ trades opened within
 * `windowMs` after a losing trade closed. Returns the index of the
 * triggering loss + the cluster size, or null when no cluster fits.
 *
 * Trades are expected sorted oldest → newest by closeTime.
 */
export function detectRevengeCluster(
  trades: RevengeTrade[],
  windowMs: number = 15 * 60 * 1000,
  minClusterSize: number = 3,
): { triggerIndex: number; clusterSize: number } | null {
  if (trades.length < minClusterSize + 1) return null;
  for (let i = 0; i < trades.length; i++) {
    if (trades[i].netPl >= 0) continue;
    const lossClose = trades[i].closeTime.getTime();
    const cluster = trades
      .slice(i + 1)
      .filter((t) => {
        const delta = t.openTime.getTime() - lossClose;
        return delta >= 0 && delta <= windowMs;
      });
    if (cluster.length >= minClusterSize) {
      return { triggerIndex: i, clusterSize: cluster.length };
    }
  }
  return null;
}

export type OvertradingSeverity = "none" | "warn" | "critical";

/**
 * Classifies overtrading severity given today's trade count and the
 * user's daily cap. Critical at 1.5× the cap (matching alert engine).
 */
export function classifyOvertrading(
  tradeCount: number,
  dailyCap: number,
): OvertradingSeverity {
  if (dailyCap <= 0) return "none";
  if (tradeCount >= dailyCap * 1.5) return "critical";
  if (tradeCount >= dailyCap) return "warn";
  return "none";
}

/**
 * Returns true when the symbol does not appear in the user's known
 * (journaled-in-the-last-30-days) symbols. Comparison is case-insensitive.
 *
 * Used for the strategy-deviation heuristic — a "deviation" is a trade
 * whose symbol the user has not journaled against any active strategy.
 */
export function isStrategyDeviation(
  symbol: string,
  knownSymbols: Iterable<string>,
): boolean {
  const target = (symbol || "").trim().toUpperCase();
  if (!target) return false;
  const set = new Set<string>();
  for (const s of knownSymbols) set.add((s || "").toUpperCase());
  return !set.has(target);
}

/**
 * Returns true when a previously-emitted alert with the same dedupeKey
 * is still inside its cooldown window and therefore must NOT be re-emitted.
 *
 * A null/undefined `cooldownUntil` (or one in the past) means the cooldown
 * has expired and a new alert is allowed.
 */
export function isAlertWithinCooldown(
  cooldownUntil: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!cooldownUntil) return false;
  const until = cooldownUntil instanceof Date ? cooldownUntil : new Date(cooldownUntil);
  if (isNaN(until.getTime())) return false;
  return until.getTime() > now.getTime();
}

// ==================== END PURE HELPERS ====================

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

export async function isAlertSuppressed(userId: string, dedupeKey: string): Promise<boolean> {
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

  if (ev.inAppEligible) {
    notificationBus.publish({ userId, notification: notif });
  }

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

    // Helpers (also exercised by alertEngine.test.ts) compute the same
    // numbers as before — kept here so the tested code path matches the
    // production code path.
    const { dailyLoss, dailyDDAmount, dailyPct } = computeDailyDD(
      dayStartBalance,
      ctx.balance,
      dailyDDLimit,
    );
    const { maxDDFloor, maxDDPct } = computeMaxDD(
      accountSize,
      ctx.balance,
      maxDDLimit,
      !!challenge.trailingDrawdown,
      highWaterMark,
    );

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
  if (prefs.revengeEnabled) {
    const cluster = detectRevengeCluster(trades);
    if (cluster) {
      const trigger = trades[cluster.triggerIndex];
      await emitAlert(ctx.userId, {
        type: "revenge_trade",
        severity: "high",
        title: `Revenge trading detected`,
        body: `${cluster.clusterSize} new trades opened within 15 minutes after a $${Math.abs(trigger.netPl).toFixed(0)} loss on ${trigger.symbol}. Step back before sizing up further.`,
        payload: { trigger: trigger.ticket, clusterSize: cluster.clusterSize, symbol: trigger.symbol },
        linkUrl: `/journal`,
        dedupeKey: `revenge_${ctx.userId}_${dateKey}_${trigger.ticket}`,
        cooldownMinutes: prefs.cooldownMinutes,
        inAppEligible: prefs.revengeInApp,
        emailEligible: prefs.revengeEmail,
      });
    }
  }

  // ---- OVERTRADING: trade count >= daily cap ----
  if (prefs.overtradingEnabled) {
    const sev = classifyOvertrading(trades.length, prefs.overtradingDailyCap);
    if (sev !== "none") {
      await emitAlert(ctx.userId, {
        type: "overtrading",
        severity: sev === "critical" ? "high" : "medium",
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
    const knownSymbols = journaled.map(j => j.pair || "");
    if (!isStrategyDeviation(symbol, knownSymbols)) return;
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
