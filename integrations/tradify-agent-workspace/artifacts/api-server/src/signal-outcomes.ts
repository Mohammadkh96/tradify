import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  tradifyEvaluationHistory,
  tradifyGeneratedSignals,
  tradifySignalOutcomes,
  type TradifySignalOutcome,
  type TradifySignalTargetOutcome,
} from "@workspace/db";
import type { AuthoritativeEvaluation } from "./authoritative-engine";
import type { Candle } from "./zip-engine/market/types";

export const SIGNAL_OUTCOME_RESOLUTION_VERSION = "M15_FIRST_TOUCH_V1";

type SignalDirection = "LONG" | "SHORT";
type OutcomeStatus = "TRACKING" | "COMPLETE" | "INELIGIBLE";

type SignalSnapshot = {
  direction?: unknown;
  detectedAt?: unknown;
  entry?: unknown;
  stopLoss?: unknown;
  targets?: unknown;
};

type SignalRecord = {
  id: string;
  evaluationId: string;
  marketDataAt: Date | null;
  strategyId: string;
  strategyVersion: string;
  symbol: string;
  timeframe: string;
  snapshot: Record<string, unknown>;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function epochSeconds(value: unknown): number | null {
  let raw: number;
  if (typeof value === "number") {
    raw = value;
  } else if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    raw = Number.isFinite(numeric) ? numeric : Date.parse(value) / 1000;
  } else {
    return null;
  }
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw > 10_000_000_000 ? raw / 1000 : raw);
}

function signalIdentity(
  record: SignalRecord,
  snapshot: SignalSnapshot,
  detectedAtSeconds: number | null,
): string {
  const identity = [
    record.strategyId,
    record.strategyVersion,
    record.symbol,
    record.timeframe,
    typeof snapshot.direction === "string" ? snapshot.direction : "UNKNOWN",
    detectedAtSeconds === null
      ? `invalid:${String(snapshot.detectedAt ?? record.id)}`
      : String(detectedAtSeconds),
  ];
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

function targetRows(rawTargets: unknown): Array<{ label: string; price: number }> | null {
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) return null;
  const targets: Array<{ label: string; price: number }> = [];
  for (const [index, value] of rawTargets.entries()) {
    if (!value || typeof value !== "object") return null;
    const target = value as Record<string, unknown>;
    const price = finiteNumber(target.price);
    if (price === null || price <= 0) return null;
    const label =
      typeof target.label === "string" && target.label.trim()
        ? target.label.trim().slice(0, 100)
        : `TP${index + 1}`;
    targets.push({ label, price });
  }
  return targets;
}

export function createSignalOutcomeDraft(record: SignalRecord) {
  const snapshot = record.snapshot as SignalSnapshot;
  const direction =
    snapshot.direction === "LONG" || snapshot.direction === "SHORT"
      ? (snapshot.direction as SignalDirection)
      : null;
  const detectedAtSeconds = epochSeconds(snapshot.detectedAt);
  const detectedAt = detectedAtSeconds === null ? null : new Date(detectedAtSeconds * 1000);
  const entryPrice = finiteNumber(snapshot.entry);
  const stopPrice = finiteNumber(snapshot.stopLoss);
  const targets = targetRows(snapshot.targets);
  const riskDistance =
    direction && entryPrice !== null && stopPrice !== null
      ? direction === "LONG"
        ? entryPrice - stopPrice
        : stopPrice - entryPrice
      : null;

  let eligibilityReason: string | null = null;
  if (record.timeframe.toUpperCase() !== "M15") {
    eligibilityReason = "Only validated M15 signal snapshots are eligible.";
  } else if (detectedAtSeconds === null) {
    eligibilityReason = "The signal has no valid detection timestamp.";
  } else if (!direction) {
    eligibilityReason = "The signal direction is not LONG or SHORT.";
  } else if (entryPrice === null || entryPrice <= 0 || stopPrice === null || stopPrice <= 0) {
    eligibilityReason = "The signal does not contain valid entry and stop prices.";
  } else if (riskDistance === null || riskDistance <= 0) {
    eligibilityReason = "The stop is not on the risk side of the entry.";
  } else if (!targets) {
    eligibilityReason = "The signal does not contain valid target prices.";
  } else if (
    targets.some(({ price }) => (direction === "LONG" ? price <= entryPrice : price >= entryPrice))
  ) {
    eligibilityReason = "At least one target is not on the profit side of the entry.";
  }

  const targetOutcomes: TradifySignalTargetOutcome[] =
    !eligibilityReason && targets && riskDistance && entryPrice && direction
      ? targets.map((target) => ({
          ...target,
          targetR:
            direction === "LONG"
              ? (target.price - entryPrice) / riskDistance
              : (entryPrice - target.price) / riskDistance,
          status: "PENDING",
          resolvedAt: null,
          outcomeR: null,
        }))
      : [];

  return {
    id: signalIdentity(record, snapshot, detectedAtSeconds),
    signalId: record.id,
    lastEvaluationId: record.evaluationId,
    strategyId: record.strategyId,
    strategyVersion: record.strategyVersion,
    symbol: record.symbol,
    timeframe: record.timeframe,
    direction: direction ?? "NONE",
    detectedAt,
    entryPrice,
    stopPrice,
    riskDistance,
    status: (eligibilityReason ? "INELIGIBLE" : "TRACKING") satisfies OutcomeStatus,
    eligibilityReason,
    targetOutcomes,
    lastProcessedCandleTime: epochSeconds(record.marketDataAt?.getTime()) ?? detectedAtSeconds,
    maxFavorableR: eligibilityReason ? null : 0,
    maxAdverseR: eligibilityReason ? null : 0,
    resolutionVersion: SIGNAL_OUTCOME_RESOLUTION_VERSION,
    updatedAt: new Date(),
  };
}

function candleSeconds(candle: Candle): number | null {
  return epochSeconds(candle.time);
}

function isValidCandle(candle: Candle): boolean {
  return (
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    candle.open > 0 &&
    candle.low > 0 &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close
  );
}

function stopTouched(candle: Candle, direction: SignalDirection, stopPrice: number): boolean {
  return direction === "LONG" ? candle.low <= stopPrice : candle.high >= stopPrice;
}

function targetTouched(candle: Candle, direction: SignalDirection, targetPrice: number): boolean {
  return direction === "LONG" ? candle.high >= targetPrice : candle.low <= targetPrice;
}

export function advanceSignalOutcome(
  outcome: TradifySignalOutcome,
  candles: Candle[],
): Partial<TradifySignalOutcome> | null {
  if (
    outcome.status !== "TRACKING" ||
    (outcome.direction !== "LONG" && outcome.direction !== "SHORT") ||
    outcome.entryPrice === null ||
    outcome.stopPrice === null ||
    outcome.riskDistance === null ||
    outcome.riskDistance <= 0 ||
    outcome.targetOutcomes.length === 0
  )
    return null;

  let cursor = outcome.lastProcessedCandleTime ?? epochSeconds(outcome.detectedAt?.getTime());
  let maxFavorableR = outcome.maxFavorableR ?? 0;
  let maxAdverseR = outcome.maxAdverseR ?? 0;
  const targetOutcomes = outcome.targetOutcomes.map((target) => ({ ...target }));
  let completedAt = outcome.completedAt;
  let changed = false;

  const orderedCandles = [...candles].sort(
    (a, b) => (candleSeconds(a) ?? 0) - (candleSeconds(b) ?? 0),
  );
  const validTimes = orderedCandles
    .filter(isValidCandle)
    .map(candleSeconds)
    .filter((time): time is number => time !== null);
  const latestAvailableTime = validTimes.at(-1);
  if (
    cursor !== null &&
    latestAvailableTime !== undefined &&
    cursor < latestAvailableTime &&
    !validTimes.includes(cursor)
  ) {
    return {
      status: "INELIGIBLE",
      eligibilityReason:
        "Trusted M15 history no longer contains the last processed candle; this outcome cannot be resolved safely.",
      completedAt: new Date(),
      updatedAt: new Date(),
    };
  }
  for (const candle of orderedCandles) {
    const time = candleSeconds(candle);
    if (time === null || (cursor !== null && time <= cursor) || !isValidCandle(candle)) continue;
    changed = true;
    cursor = time;

    const favorableMove =
      outcome.direction === "LONG"
        ? (candle.high - outcome.entryPrice) / outcome.riskDistance
        : (outcome.entryPrice - candle.low) / outcome.riskDistance;
    const adverseMove =
      outcome.direction === "LONG"
        ? (outcome.entryPrice - candle.low) / outcome.riskDistance
        : (candle.high - outcome.entryPrice) / outcome.riskDistance;
    maxFavorableR = Math.max(maxFavorableR, favorableMove, 0);
    maxAdverseR = Math.max(maxAdverseR, adverseMove, 0);

    const slHit = stopTouched(candle, outcome.direction, outcome.stopPrice);
    for (const target of targetOutcomes) {
      if (target.status !== "PENDING") continue;
      const tpHit = targetTouched(candle, outcome.direction, target.price);
      if (slHit && tpHit) {
        target.status = "AMBIGUOUS";
        target.outcomeR = null;
        target.resolvedAt = time;
      } else if (slHit) {
        target.status = "STOP_FIRST";
        target.outcomeR = -1;
        target.resolvedAt = time;
      } else if (tpHit) {
        target.status = "TARGET_FIRST";
        target.outcomeR = target.targetR;
        target.resolvedAt = time;
      }
    }
    if (targetOutcomes.every((target) => target.status !== "PENDING")) {
      completedAt = new Date(time * 1000);
      break;
    }
  }

  if (!changed) return null;
  return {
    status: targetOutcomes.every((target) => target.status !== "PENDING") ? "COMPLETE" : "TRACKING",
    targetOutcomes,
    lastProcessedCandleTime: cursor,
    maxFavorableR,
    maxAdverseR,
    completedAt,
    updatedAt: new Date(),
  };
}

export async function syncSignalOutcomeHistory(evaluation: AuthoritativeEvaluation): Promise<void> {
  if (!evaluation.provenance.marketDataTrusted || !evaluation.validation.valid) return;
  const closedCandles = evaluation.validation.closedCandles ?? [];
  if (closedCandles.length === 0) return;

  await db.transaction(async (tx) => {
    if (evaluation.signalGenerated) {
      const [storedSignal] = await tx
        .select({
          id: tradifyGeneratedSignals.id,
          evaluationId: tradifyGeneratedSignals.evaluationId,
          marketDataAt: tradifyEvaluationHistory.marketDataAt,
          strategyId: tradifyGeneratedSignals.strategyId,
          strategyVersion: tradifyGeneratedSignals.strategyVersion,
          symbol: tradifyGeneratedSignals.symbol,
          timeframe: tradifyGeneratedSignals.timeframe,
          snapshot: tradifyGeneratedSignals.snapshot,
        })
        .from(tradifyGeneratedSignals)
        .innerJoin(
          tradifyEvaluationHistory,
          eq(tradifyEvaluationHistory.id, tradifyGeneratedSignals.evaluationId),
        )
        .where(
          and(
            eq(tradifyGeneratedSignals.id, evaluation.signal.id),
            eq(tradifyEvaluationHistory.marketDataTrusted, true),
          ),
        )
        .limit(1);

      if (storedSignal) {
        const draft = createSignalOutcomeDraft(storedSignal);
        await tx.insert(tradifySignalOutcomes).values(draft).onConflictDoNothing();
      }
    }

    const openOutcomes = await tx
      .select()
      .from(tradifySignalOutcomes)
      .where(
        and(
          eq(tradifySignalOutcomes.symbol, evaluation.symbol),
          eq(tradifySignalOutcomes.timeframe, "M15"),
          eq(tradifySignalOutcomes.status, "TRACKING"),
        ),
      )
      .for("update");

    for (const outcome of openOutcomes) {
      const update = advanceSignalOutcome(outcome, closedCandles);
      if (!update) continue;
      await tx
        .update(tradifySignalOutcomes)
        .set({ ...update, lastEvaluationId: evaluation.evaluationId })
        .where(eq(tradifySignalOutcomes.id, outcome.id));
    }
  });
}
