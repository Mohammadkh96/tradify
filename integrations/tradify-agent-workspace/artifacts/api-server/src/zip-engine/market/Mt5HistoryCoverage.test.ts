import assert from "node:assert/strict";
import { findMissingMt5M15Intervals } from "./Mt5HistoryCoverage";
import type { BrokerTradingSessionSchedule } from "./MarketCatalog";

const schedule: BrokerTradingSessionSchedule = {
  source: "MT5_SYMBOL_INFO_SESSION_TRADE",
  serverTime: Date.parse("2026-10-15T03:00:00Z") / 1000,
  utcTime: Date.parse("2026-10-15T00:00:00Z") / 1000,
  serverUtcOffsetSeconds: 10_800,
  sessions: Array.from({ length: 5 }, (_, index) => ({
    dayOfWeek: index + 1,
    fromSeconds: 0,
    toSeconds: 86_400,
  })),
};

const startUtc = Math.floor(Date.parse("2026-10-12T00:00:00Z") / 1000);
const endUtc = startUtc + 86_400;
const allMondayBars = Array.from({ length: 96 }, (_, index) => startUtc + index * 900);

const complete = findMissingMt5M15Intervals(startUtc, endUtc, allMondayBars, schedule);
assert.deepEqual(complete, [], "complete broker-session history should have no missing intervals");

const missingOpen = startUtc + 10 * 3_600 + 15 * 60;
const incomplete = findMissingMt5M15Intervals(
  startUtc,
  endUtc,
  allMondayBars.filter((time) => time !== missingOpen && time !== missingOpen + 900),
  schedule,
);
assert.deepEqual(
  incomplete,
  [{ startUtc: missingOpen, endUtc: missingOpen + 1_800 }],
  "an absent pair of open-session bars must remain an explicit recovery interval",
);

const weekendStart = Math.floor(Date.parse("2026-10-10T00:00:00Z") / 1000);
const weekendEnd = weekendStart + 86_400;
assert.deepEqual(
  findMissingMt5M15Intervals(weekendStart, weekendEnd, [], schedule),
  [],
  "broker-closed Saturday slots must not be treated as missing candles",
);

const overnightSchedule: BrokerTradingSessionSchedule = {
  ...schedule,
  sessions: [{ dayOfWeek: 1, fromSeconds: 22 * 3_600, toSeconds: 2 * 3_600 }],
};
const overnightStart = Math.floor(Date.parse("2026-10-12T19:00:00Z") / 1000);
const overnightEnd = overnightStart + 4 * 3_600;
const overnightBars = Array.from(
  { length: 16 },
  (_, index) => overnightStart + index * 900,
);
assert.deepEqual(
  findMissingMt5M15Intervals(overnightStart, overnightEnd, overnightBars, overnightSchedule),
  [],
  "an overnight broker session must include its post-midnight continuation",
);

assert.throws(
  () =>
    findMissingMt5M15Intervals(startUtc, endUtc, [], {
      ...schedule,
      serverTime: schedule.utcTime,
    }),
  /Invalid M15 history range or unverified broker schedule/,
  "a time-basis mismatch must fail closed",
);

const dstRangeStart = Math.floor(Date.parse("2026-03-05T00:00:00Z") / 1000);
const dstRangeEnd = Math.floor(Date.parse("2026-03-10T00:00:00Z") / 1000);
const dstHistory = Array.from(
  { length: (dstRangeEnd - dstRangeStart) / 900 },
  (_, index) => dstRangeStart + index * 900,
).filter((time) => {
  const serverOffset = time < Date.parse("2026-03-08T07:00:00Z") / 1000 ? 7_200 : 10_800;
  const local = new Date((time + serverOffset) * 1000);
  return local.getUTCDay() >= 1 && local.getUTCDay() <= 5;
});
const dstSchedule: BrokerTradingSessionSchedule = {
  ...schedule,
  sessions: Array.from({ length: 5 }, (_, index) => ({
    dayOfWeek: index + 1,
    fromSeconds: 0,
    toSeconds: 86_400,
  })),
};
assert.deepEqual(
  findMissingMt5M15Intervals(dstRangeStart, dstRangeEnd, dstHistory, dstSchedule),
  [],
  "weekday history on both sides of the spring DST change must use date-specific server offsets",
);

console.log("MT5 history coverage tests passed: complete, missing bars, closed sessions, DST-crossing history, and clock mismatch.");
