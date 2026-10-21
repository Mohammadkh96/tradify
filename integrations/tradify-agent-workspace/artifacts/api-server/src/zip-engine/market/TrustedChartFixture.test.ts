import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SeriesValidator } from "./SeriesValidator";
import { DGv8Engine } from "../strategy/DGv8Engine";
// Read shared test data without importing sibling application source into the
// API's TypeScript project (which has its own src root).
const fixture = JSON.parse(readFileSync(new URL(
  "../../../../tradify-signals/__tests__/fixtures/trusted-mt5-m15.json", import.meta.url,
), "utf8")) as {
  nowSeconds: number; closedCandleCount: number; intervalSeconds: number;
  basePrice: number; priceStep: number;
};
const fixtureNowSeconds = fixture.nowSeconds;
const currentBarOpen = Math.floor(fixtureNowSeconds / fixture.intervalSeconds) * fixture.intervalSeconds;
const trustedM15Candles = Array.from({ length: fixture.closedCandleCount }, (_, index) => ({
  time: currentBarOpen - (fixture.closedCandleCount - index) * fixture.intervalSeconds,
  open: fixture.basePrice + index * fixture.priceStep,
  high: fixture.basePrice + 1 + index * fixture.priceStep,
  low: fixture.basePrice - 1 + index * fixture.priceStep,
  close: fixture.basePrice + 0.5 + index * fixture.priceStep,
  volume: 10 + index,
}));

// Pure validator checks: no bridge heartbeat, persistence, or database writes.
const validate = (candles = trustedM15Candles) =>
  SeriesValidator.validateM15Series(
    "XAUUSD",
    "MT5",
    "XAUUSD",
    candles,
    fixtureNowSeconds,
    { connected: true, health: "HEALTHY" },
  );

const trusted = validate();
assert.equal(trusted.valid, true);
assert.equal(trusted.closedCandles?.length, 80);
assert.ok(trusted.closedCandles!.every((bar) => bar.time + 900 <= fixtureNowSeconds));
assert.equal(validate(trustedM15Candles.slice(-50)).valid, true);
assert.equal(validate(trustedM15Candles.slice(-49)).checkName, "SUFFICIENCY");

const forming = {
  ...trustedM15Candles[79],
  time: Math.floor(fixtureNowSeconds / 900) * 900,
};
assert.equal(validate([...trustedM15Candles, forming]).closedCandles?.length, 80);
assert.equal(validate([...trustedM15Candles.slice(-49), forming]).checkName, "SUFFICIENCY");

const malformed = trustedM15Candles.map((bar, index) =>
  index === 40 ? { ...bar, high: bar.low - 1 } : bar,
);
assert.equal(validate(malformed).checkName, "GEOMETRY");
const misaligned = trustedM15Candles.map((bar) => ({ ...bar, time: bar.time + 60 }));
assert.equal(validate(misaligned).checkName, "TIMEZONE_GRID");
assert.equal(validate([...trustedM15Candles, trustedM15Candles[79]]).checkName, "DUPLICATE_BARS");
assert.equal(
  SeriesValidator.validateM15Series(
    "XAUUSD", "Yahoo", "GC=F", trustedM15Candles, fixtureNowSeconds,
  ).checkName,
  "INSTRUMENT_CLASS",
);
// Real strategy evaluations, with a completed Asia source session containing
// confirmed high/low pivots and a London breakout in each direction.
const directionalNowSeconds = Date.parse("2027-01-15T09:15:00Z") / 1000 + 60;
const directionalBarOpen = Math.floor(directionalNowSeconds / 900) * 900;
for (const direction of ["LONG", "SHORT"] as const) {
  const series = Array.from({ length: 80 }, (_, index) => {
    const time = directionalBarOpen - (80 - index) * 900;
    const london = time >= Date.parse("2027-01-15T07:00:00Z") / 1000;
    const close = london
      ? direction === "LONG" ? 5060 + index * 0.1 : 4940 - index * 0.1
      : 5000 + Math.sin(index * Math.PI / 6) * 12;
    return { time, open: close - 0.2, high: close + 1, low: close - 1, close, volume: 100 };
  });
  const validation = SeriesValidator.validateM15Series(
    "XAUUSD", "MT5", "XAUUSD", series, directionalNowSeconds,
    { connected: true, health: "HEALTHY" },
  );
  assert.equal(validation.valid, true);
  assert.equal(validation.closedCandles?.length, 80);
  const result = new DGv8Engine().evaluate("XAUUSD", "XAUUSD", "MT5", validation.closedCandles!, true);
  assert.equal(result.direction, direction);
  const context = result.dgv8ChartLevels!;
  for (const price of [context.sourceHigh, context.sourceLow, context.pivotResistance, context.pivotSupport]) {
    assert.ok(typeof price === "number" && Number.isFinite(price) && price > 0);
  }
  assert.equal(result.stopLoss, direction === "LONG" ? context.buyStop : context.sellStop);
  assert.deepEqual(result.targets.map((target) => target.price),
    direction === "LONG" ? context.buyTargets : context.sellTargets);
  const blocked = new DGv8Engine().evaluate("XAUUSD", "XAUUSD", "MT5", series, false);
  assert.equal(blocked.direction, "NONE");
  assert.equal(blocked.dgv8ChartLevels, undefined);
  assert.deepEqual(blocked.targets, []);
}
console.log("Trusted chart fixture passed: 80 closed MT5 M15 bars, 50/49 boundary, forming exclusion, invalid geometry/grid/duplicates and fallback rejection.");
