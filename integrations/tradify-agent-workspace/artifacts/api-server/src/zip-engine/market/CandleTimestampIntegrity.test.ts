import assert from "node:assert/strict";
import {
  mt5ServerUtcOffsetSeconds,
  mt5ServerWallTimeFromUtc,
  normalizeBrokerTime,
  normalizeExternalCandleOpenTime,
} from "./CandleTime";
import { SeriesValidator } from "./SeriesValidator";
import type { Candle } from "./types";

const base = Math.floor((Date.now() / 1000 - 60 * 900) / 900) * 900;

function candles(count = 60): Candle[] {
  return Array.from({ length: count }, (_, index) => ({
    time: base + index * 900,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 1,
  }));
}

const alignedOpen = normalizeExternalCandleOpenTime(
  "2026-09-10 18:15:00",
  "ISO_UTC",
  "OPEN",
  "M15",
);
assert.equal(alignedOpen % 900, 0, "UTC candle-open timestamps must remain on the M15 grid");

const closeConverted = normalizeExternalCandleOpenTime(
  "2026-09-10 18:30:00",
  "ISO_UTC",
  "CLOSE",
  "M15",
);
assert.equal(new Date(closeConverted * 1000).toISOString(), "2026-09-10T18:15:00.000Z");

const timezoneConverted = normalizeExternalCandleOpenTime(
  "2026-09-10T18:15:00+03:00",
  "ISO_UTC",
  "OPEN",
  "M15",
);
assert.equal(new Date(timezoneConverted * 1000).toISOString(), "2026-09-10T15:15:00.000Z");

const offGrid = normalizeExternalCandleOpenTime("2026-09-10 18:15:01", "ISO_UTC", "OPEN", "M15");
assert.equal(offGrid % 900, 1, "normalization must not silently floor an off-grid timestamp");
assert.equal(
  normalizeExternalCandleOpenTime("not-a-timestamp", "ISO_UTC", "OPEN", "M15"),
  0,
  "ambiguous or invalid timestamps must be rejected",
);

const preDstServerWall = Date.parse("2026-03-05T00:00:00Z") / 1000;
const postDstServerWall = Date.parse("2026-03-09T00:00:00Z") / 1000;
assert.equal(
  new Date(normalizeBrokerTime(preDstServerWall) * 1000).toISOString(),
  "2026-03-04T22:00:00.000Z",
  "the March 5 broker wall timestamp maps with Darwinex's winter +2 offset",
);
assert.equal(
  new Date(normalizeBrokerTime(postDstServerWall) * 1000).toISOString(),
  "2026-03-08T21:00:00.000Z",
  "the March 9 broker wall timestamp maps with Darwinex's summer +3 offset",
);
assert.equal(
  mt5ServerUtcOffsetSeconds(Date.parse("2026-03-05T00:00:00Z") / 1000),
  7_200,
);
assert.equal(
  mt5ServerUtcOffsetSeconds(Date.parse("2026-03-09T00:00:00Z") / 1000),
  10_800,
);
assert.equal(
  mt5ServerWallTimeFromUtc(Date.parse("2026-03-08T21:00:00Z") / 1000),
  postDstServerWall,
  "UTC range boundaries convert back to the broker's historical server-wall epoch",
);
assert.equal(
  normalizeBrokerTime(Date.parse("2026-03-08T09:30:00Z") / 1000),
  0,
  "a nonexistent spring-forward server wall time is rejected",
);
assert.equal(
  normalizeBrokerTime(Date.parse("2026-11-01T08:30:00Z") / 1000),
  0,
  "an ambiguous fall-back server wall time is rejected rather than guessed",
);

const valid = candles();
assert.equal(
  SeriesValidator.validateM15Series(
    "EURUSD",
    "TWELVE_DATA",
    "EUR/USD",
    valid,
    Math.floor(Date.now() / 1000),
  ).valid,
  true,
);

const duplicate = [...valid.slice(0, 3), valid[2], ...valid.slice(3)];
const duplicateResult = SeriesValidator.validateM15Series(
  "EURUSD",
  "TWELVE_DATA",
  "EUR/USD",
  duplicate,
  Math.floor(Date.now() / 1000),
);
assert.equal(duplicateResult.checkName, "DUPLICATE_BARS");

const outOfOrder = [valid[0], valid[2], valid[1], ...valid.slice(3)];
const outOfOrderResult = SeriesValidator.validateM15Series(
  "EURUSD",
  "TWELVE_DATA",
  "EUR/USD",
  outOfOrder,
  Math.floor(Date.now() / 1000),
);
assert.equal(outOfOrderResult.checkName, "CONTIGUITY");

const misaligned = [...valid];
misaligned[10] = { ...misaligned[10], time: misaligned[10].time + 1 };
const misalignedResult = SeriesValidator.validateM15Series(
  "EURUSD",
  "TWELVE_DATA",
  "EUR/USD",
  misaligned,
  Math.floor(Date.now() / 1000),
);
assert.equal(misalignedResult.checkName, "TIMEZONE_GRID");

const formingNow = base + 49 * 900 + 600;
const formingResult = SeriesValidator.validateM15Series(
  "EURUSD",
  "TWELVE_DATA",
  "EUR/USD",
  valid.slice(0, 50),
  formingNow,
);
assert.equal(
  formingResult.valid,
  false,
  "a forming M15 candle must not satisfy closed-history sufficiency",
);
assert.match(formingResult.reason ?? "", /Insufficient closed M15 history/);

console.log(
  "Candle timestamp checks passed: provider semantics, MT5 winter/summer mapping, DST ambiguity rejection, strict grid, and closed bars.",
);
