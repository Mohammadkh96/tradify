import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(
  path.join(root, "artifacts/tradify-signals/reference/TradifyBridge.mq5"),
  "utf8",
);

test("EA candidate identifies its build and refuses the production API defaults", () => {
  assert.match(source, /#property version\s+"1\.27"/);
  assert.match(source, /TRADIFY_EA_BUILD_FINGERPRINT/);
  assert.match(source, /Build fingerprint: %s/);
  assert.match(source, /input string TradifyBackendUrl\s*=\s*""/);
  assert.match(source, /input string ReplitExternalAccessToken\s*=\s*""/);
  assert.match(source, /Authorization: Bearer /);
  assert.match(source, /signals\.tradifyapp\.com/);
  assert.match(source, /tradify-signals\.replit\.app/);
});

test("EA quote and OHLC JSON use each broker symbol's declared digit precision", () => {
  assert.match(source, /int PriceDigitsForSymbol\(string sym\)/);
  assert.match(source, /SymbolInfoInteger\(sym, SYMBOL_DIGITS\)/);
  for (const field of ["open", "high", "low", "close"]) {
    assert.match(
      source,
      new RegExp(`\\"${field}\\\\":\\"?\\s*"?\\s*\\+\\s*DoubleToString\\(rates\\[i\\]\\.${field}, priceDigits\\)`),
    );
    assert.doesNotMatch(
      source,
      new RegExp(`\\"${field}\\":\\"?\\s*"?\\s*\\+\\s*DoubleToString\\(rates\\[i\\]\\.${field}, 5\\)`),
    );
  }
  assert.match(source, /DoubleToString\(tick\.bid, priceDigits\)/);
  assert.match(source, /DoubleToString\(tick\.ask, priceDigits\)/);
});

test("date-range repairs use PARTIAL mode; only the coverage-complete path requests FULL", () => {
  assert.match(source, /fullSync \? "FULL" : "PARTIAL"/);
  assert.match(source, /coverageRange/);
  assert.match(source, /rangeStartServerEpoch/);
  assert.match(source, /rangeEndServerEpoch/);
  assert.match(source, /M15 COVERAGE COMPLETE/);
  assert.match(source, /session coverage complete/);
});
