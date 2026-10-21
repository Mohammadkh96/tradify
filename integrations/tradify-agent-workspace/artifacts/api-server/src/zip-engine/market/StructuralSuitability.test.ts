import assert from "node:assert/strict";
import type { Candle } from "./types";
import { compareStructuralSuitability } from "./StructuralSuitability";

const reference: Candle[] = Array.from({ length: 60 }, (_, index) => {
  const direction = index % 3 === 0 ? -1 : 1;
  const open = 100 + index;
  const close = open + direction;
  return {
    time: 1_700_000_000 + index * 900,
    open,
    high: Math.max(open, close) + 1,
    low: Math.min(open, close) - 1,
    close,
    volume: 1,
  };
});
const scaledComparison: Candle[] = reference.map((candle) => ({
  ...candle,
  open: candle.open * 10,
  high: candle.high * 10,
  low: candle.low * 10,
  close: candle.close * 10,
}));

const report = compareStructuralSuitability(
  "BTCUSD",
  "BINANCE",
  reference,
  "COINBASE",
  scaledComparison,
);
assert.equal(report.alignedBars, 60);
assert.equal(report.directionAgreementPercent, 100);
assert.ok((report.returnCorrelation ?? 0) > 0.99);
assert.equal(report.structurallySuitable, true);
assert.deepEqual(
  compareStructuralSuitability(
    "BTCUSD",
    "MT5",
    reference.slice(0, 20),
    "BINANCE",
    scaledComparison.slice(0, 20),
  ).structurallySuitable,
  false,
);

console.log(
  "Structural suitability checks passed: normalized returns are compared without exact-price equality.",
);
