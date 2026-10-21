import assert from "node:assert/strict";
import test from "node:test";
import type { TradifySignalOutcome } from "@workspace/db";
import type { Candle } from "./zip-engine/market/types";
import { advanceSignalOutcome, createSignalOutcomeDraft, epochSeconds } from "./signal-outcomes";

function signalDraft(overrides: Record<string, unknown> = {}) {
  return createSignalOutcomeDraft({
    id: "engine-signal-id",
    evaluationId: "evaluation-id",
    marketDataAt: new Date(1_700_000_000_000),
    strategyId: "DGV8",
    strategyVersion: "8.0.0",
    symbol: "XAUUSD",
    timeframe: "M15",
    snapshot: {
      direction: "LONG",
      detectedAt: 1_700_000_000,
      entry: 100,
      stopLoss: 95,
      targets: [
        { label: "TP1", price: 105 },
        { label: "TP2", price: 110 },
      ],
      ...overrides,
    },
  });
}

function trackingOutcome(overrides: Partial<TradifySignalOutcome> = {}): TradifySignalOutcome {
  return {
    id: "outcome-id",
    signalId: "signal-id",
    lastEvaluationId: "evaluation-id",
    strategyId: "DGV8",
    strategyVersion: "8.0.0",
    symbol: "XAUUSD",
    timeframe: "M15",
    direction: "LONG",
    detectedAt: new Date(1_700_000_000_000),
    entryPrice: 100,
    stopPrice: 95,
    riskDistance: 5,
    status: "TRACKING",
    eligibilityReason: null,
    targetOutcomes: [
      { label: "TP1", price: 105, targetR: 1, status: "PENDING", resolvedAt: null, outcomeR: null },
      { label: "TP2", price: 110, targetR: 2, status: "PENDING", resolvedAt: null, outcomeR: null },
    ],
    lastProcessedCandleTime: 1_700_000_000,
    maxFavorableR: 0,
    maxAdverseR: 0,
    resolutionVersion: "M15_FIRST_TOUCH_V1",
    trackedAt: new Date(1_700_000_000_000),
    updatedAt: new Date(1_700_000_000_000),
    completedAt: null,
    ...overrides,
  };
}

function candle(time: number, high: number, low: number): Candle {
  return { time, open: 100, high, low, close: 100, volume: 1 };
}

test("normalizes signal timestamps in seconds and milliseconds", () => {
  assert.equal(epochSeconds(1_700_000_000), 1_700_000_000);
  assert.equal(epochSeconds(1_700_000_000_000), 1_700_000_000);
  assert.equal(epochSeconds("2023-11-14T22:13:20.000Z"), 1_700_000_000);
  assert.equal(epochSeconds("not a timestamp"), null);
});

test("deduplicates repeated engine evaluations by signal identity, not transient engine id", () => {
  const first = signalDraft();
  const repeated = createSignalOutcomeDraft({
    id: "different-transient-engine-id",
    evaluationId: "another-evaluation-id",
    marketDataAt: new Date(1_700_000_000_000),
    strategyId: "DGV8",
    strategyVersion: "8.0.0",
    symbol: "XAUUSD",
    timeframe: "M15",
    snapshot: {
      direction: "LONG",
      detectedAt: 1_700_000_000_000,
      entry: 100,
      stopLoss: 95,
      targets: [
        { label: "TP1", price: 105 },
        { label: "TP2", price: 110 },
      ],
    },
  });
  assert.equal(first.id, repeated.id);
});

test("uses the source evaluation candle as the initial processing cursor", () => {
  const draft = signalDraft({ detectedAt: 1_700_000_060 });
  assert.equal(draft.lastProcessedCandleTime, 1_700_000_000);
});

test("rejects malformed entry/stop/target combinations instead of assigning an R result", () => {
  const invalid = signalDraft({ stopLoss: 101 });
  assert.equal(invalid.status, "INELIGIBLE");
  assert.match(invalid.eligibilityReason ?? "", /risk side/i);
  assert.deepEqual(invalid.targetOutcomes, []);
});

test("records a target-first hypothetical result for each take-profit level", () => {
  const outcome = trackingOutcome();
  const update = advanceSignalOutcome(outcome, [
    candle(1_700_000_000, 100, 100),
    candle(1_700_000_900, 105.5, 99),
  ]);
  assert.equal(update?.status, "TRACKING");
  assert.deepEqual(
    update?.targetOutcomes?.map((target) => [target.status, target.outcomeR]),
    [
      ["TARGET_FIRST", 1],
      ["PENDING", null],
    ],
  );
});

test("records stop-first outcomes for targets not reached before the stop", () => {
  const outcome = trackingOutcome();
  const update = advanceSignalOutcome(outcome, [
    candle(1_700_000_000, 100, 100),
    candle(1_700_000_900, 102, 94.5),
  ]);
  assert.equal(update?.status, "COMPLETE");
  assert.deepEqual(
    update?.targetOutcomes?.map((target) => [target.status, target.outcomeR]),
    [
      ["STOP_FIRST", -1],
      ["STOP_FIRST", -1],
    ],
  );
});

test("marks a same-candle stop and target touch ambiguous rather than inventing bar order", () => {
  const outcome = trackingOutcome();
  const update = advanceSignalOutcome(outcome, [
    candle(1_700_000_000, 100, 100),
    candle(1_700_000_900, 111, 94),
  ]);
  assert.equal(update?.status, "COMPLETE");
  assert.deepEqual(
    update?.targetOutcomes?.map((target) => [target.status, target.outcomeR]),
    [
      ["AMBIGUOUS", null],
      ["AMBIGUOUS", null],
    ],
  );
});

test("ignores the detection candle and already-processed bars", () => {
  const outcome = trackingOutcome();
  const update = advanceSignalOutcome(outcome, [
    candle(1_700_000_000, 111, 94),
    candle(1_700_000_900, 102, 99),
  ]);
  assert.equal(update?.lastProcessedCandleTime, 1_700_000_900);
  assert.equal(update?.targetOutcomes?.[0].status, "PENDING");
  assert.equal(update?.maxFavorableR, 0.4);
});

test("calculates short outcomes symmetrically", () => {
  const short = trackingOutcome({
    direction: "SHORT",
    entryPrice: 100,
    stopPrice: 105,
    riskDistance: 5,
    targetOutcomes: [
      { label: "TP1", price: 95, targetR: 1, status: "PENDING", resolvedAt: null, outcomeR: null },
    ],
  });
  const update = advanceSignalOutcome(short, [
    candle(1_700_000_000, 100, 100),
    candle(1_700_000_900, 101, 94),
  ]);
  assert.equal(update?.targetOutcomes?.[0].status, "TARGET_FIRST");
  assert.equal(update?.targetOutcomes?.[0].outcomeR, 1);
  assert.equal(update?.maxFavorableR, 1.2);
  assert.equal(update?.maxAdverseR, 0.2);
});

test("keeps outcomes ineligible instead of resolving across missing retained history", () => {
  const outcome = trackingOutcome();
  const update = advanceSignalOutcome(outcome, [candle(1_700_001_800, 115, 90)]);
  assert.equal(update?.status, "INELIGIBLE");
  assert.match(update?.eligibilityReason ?? "", /no longer contains the last processed candle/i);
  assert.ok(update?.completedAt instanceof Date);
  assert.equal(update?.targetOutcomes, undefined);
});
