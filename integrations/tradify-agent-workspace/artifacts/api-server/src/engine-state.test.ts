import assert from "node:assert/strict";
import { engineState, engineStateReady } from "./engine-state";
import { strategyRouter } from "./zip-engine/strategy/StrategyRouter";
import type { Candle } from "./zip-engine/market/types";

const candles: Candle[] = Array.from({ length: 60 }, (_, index) => {
  const time = 1_700_000_000 + index * 900;
  const close = 100 + index * 0.1;
  return { time, open: close - 0.1, high: close + 0.2, low: close - 0.2, close, volume: 100 };
});

await engineStateReady;
await engineState.resume("engine-state-test");
await engineState.persist();
assert.equal(engineState.get().mode, "ACTIVE");
assert.equal(engineState.isActive(), true);

const paused = engineState.pause("Maintenance verification", "admin@test");
assert.equal(paused.mode, "PAUSED_MANUAL");
assert.equal(engineState.isActive(), false);

const blocked = strategyRouter.evaluate("XAUUSD", "XAUUSD", "MT5", candles, false, "DGV8");
assert.equal(blocked.lifecycleStatus, "DATA_UNTRUSTED");
assert.equal(blocked.action, "DATA_UNTRUSTED");

const resumed = engineState.resume("admin@test");
assert.equal(resumed.mode, "ACTIVE");
assert.equal(engineState.isActive(), true);

console.log(
  "Engine state checks passed: pause blocks trusted signals and resume restores active mode.",
);
