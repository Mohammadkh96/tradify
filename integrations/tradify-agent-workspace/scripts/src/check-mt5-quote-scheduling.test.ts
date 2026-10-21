import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source-contract checks only: MetaEditor is required to compile/run the EA.
const source = readFileSync(
  new URL("../../artifacts/tradify-signals/reference/TradifyBridge.mq5", import.meta.url),
  "utf8",
);
function body(name: string) {
  const start = source.indexOf(`void ${name}()`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 1;
  const opening = source.indexOf("{", start);
  let end = opening + 1;
  for (; depth && end < source.length; end++) {
    if (source[end] === "{") depth++;
    if (source[end] === "}") depth--;
  }
  return source.slice(opening + 1, end - 1);
}
const sync = body("SyncCandles");
assert.equal((sync.match(/SyncTimeframeHistory\(/g) ?? []).length, 1);
assert.doesNotMatch(sync, /\b(for|while)\s*\(/, "history must yield after a single batch");
assert.match(sync, /candleTimeframeCursor\+\+/);
assert.match(sync, /candleTimeframeCursor >= 9/);
assert.match(sync, /candleSymbolCursor >= targetSymbolCount/);
for (const frame of ["M15", "H4", "D1", "W1", "M1", "M5", "M30", "H1", "MN1"]) {
  assert.ok(sync.includes(`"${frame}"`), `${frame} history must remain supported`);
}
const timer = body("OnTimer");
assert.ok(timer.indexOf("SendQuotes();") < timer.indexOf("SyncCandles();"));
assert.match(timer, /SendHeartbeat\(\);[\s\S]*?return;/);
assert.match(timer, /SendSpecifications\(\);[\s\S]*?return;/);
assert.match(timer, /FetchSubscriptions\(\);[\s\S]*?return;/);
assert.doesNotMatch(timer, /TimeCurrent\(/, "scheduling must not depend on market ticks");
assert.match(
  source,
  /return resCode == 200 \? copied : 0;/,
  "failed uploads are not delivered history",
);
console.log("MT5 quote scheduling source-contract checks passed (not an MQL compilation).");
