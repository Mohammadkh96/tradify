import assert from "node:assert/strict";
import { customerChartContext } from "./customer-chart-context";

const prices = {
  sourceHigh: 105.8, sourceLow: 100.2, pivotResistance: 106, pivotSupport: 100.6,
};
assert.deepEqual(customerChartContext({ ...prices, dataState: "LIVE", provenance: "PRIVATE" }), prices);
const withheld = Object.fromEntries(Object.keys(prices).map((key) => [key, null]));
for (const dataState of ["STALE", "FALLBACK", "ERROR", undefined]) {
  assert.deepEqual(customerChartContext({ ...prices, dataState }), withheld);
}
for (const value of [NaN, Infinity, -Infinity, 0, -1, "106", { price: 106 }, undefined]) {
  assert.equal(customerChartContext({ dataState: "LIVE", sourceHigh: value }).sourceHigh, null);
}
assert.deepEqual(Object.keys(customerChartContext({ ...prices, dataState: "LIVE" })).sort(),
  Object.keys(prices).sort());
console.log("Customer chart context passed: approved numeric fields only, non-live and malformed values withheld.");
