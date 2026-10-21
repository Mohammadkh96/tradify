import assert from "node:assert/strict";
import { FallbackMap } from "./market/FallbackMap";
import { SeriesValidator } from "./market/SeriesValidator";
import { SymbolMapper } from "./market/SymbolMapper";
import { mt5BridgeStore } from "./market/providers/MT5BridgeStore";
import { normalizeBrokerCandleTime } from "./market/CandleTime";
import { strategyRouter } from "./strategy/StrategyRouter";
import type { Candle } from "./market/types";

const alignedStart = Math.floor((Math.floor(Date.now() / 1000) - 24 * 60 * 60) / 900) * 900;
const candles: Candle[] = Array.from({ length: 96 }, (_, index) => {
  const close = 100 + Math.sin(index / 5) * 2 + index * 0.02;
  return {
    time: alignedStart + index * 900,
    open: close - 0.2,
    high: close + 0.4,
    low: close - 0.4,
    close,
    volume: 100,
  };
});

async function runParityChecks() {
  assert.equal(SymbolMapper.getAllCanonical().length, 22);
  assert.equal(SymbolMapper.toCanonical("USTEC.pro").canonical, "US100");
  assert.equal(SymbolMapper.toCanonical("EUR/USD").canonical, "EURUSD");
  assert.equal(SymbolMapper.toCanonical("GC=F").canonical, null);
  assert.equal(SymbolMapper.toCanonical("PAXGUSDT").canonical, null);
  assert.equal(normalizeBrokerCandleTime(1787920394, "M15") % 900, 0);

  assert.equal(FallbackMap.getValidFallbacks("XAUUSD").length, 0);
  assert.ok(
    FallbackMap.getValidFallbacks("US100").every((route) => route.fallbackClass === "INDEX_CASH"),
  );
  assert.ok(
    FallbackMap.getValidFallbacks("EURUSD").every((route) => route.fallbackClass === "SPOT"),
  );
  assert.ok(
    FallbackMap.getValidFallbacks("BTCUSD").every((route) => route.fallbackClass === "CRYPTO_SPOT"),
  );

  await mt5BridgeStore.reset();
  mt5BridgeStore.updateHeartbeat({
    bridgeId: "parity",
    connected: true,
    symbols: ["XAUUSD", "USTEC", "EURUSD", "BTCUSD"],
  });
  const valid = SeriesValidator.validateM15Series("XAUUSD", "MT5", "XAUUSD", candles);
  assert.equal(valid.valid, true);
  assert.equal(valid.closedCandles?.length, candles.length);

  const misaligned = SeriesValidator.validateM15Series("XAUUSD", "MT5", "XAUUSD", [
    ...candles.slice(0, 2),
    { ...candles[2], time: candles[2].time + 60 },
  ]);
  assert.equal(misaligned.valid, false);
  assert.equal(misaligned.checkName, "TIMEZONE_GRID");

  const engines = [
    ["XAUUSD", "DGV8"],
    ["EURUSD", "DGV8_FX"],
    ["US100", "BBB"],
    ["XAUUSD", "BBB_GOLD_3S"],
  ] as const;
  for (const [symbol, engine] of engines) {
    const result = strategyRouter.evaluate(symbol, symbol, "MT5", candles, true, engine);
    assert.equal(result.strategy, engine);
    assert.equal(result.marketDataSnapshot.providerSymbol, symbol);
    assert.ok(Array.isArray(result.reasons));
  }

  const untrusted = strategyRouter.evaluate("XAUUSD", "GC=F", "Yahoo", candles, false, "DGV8");
  assert.equal(untrusted.lifecycleStatus, "DATA_UNTRUSTED");
  assert.equal(untrusted.action, "DATA_UNTRUSTED");
  assert.equal(untrusted.entry ?? 0, 0);
  assert.equal(untrusted.stopLoss ?? 0, 0);
  assert.deepEqual(untrusted.targets ?? [], []);

  const staleReference = strategyRouter.evaluate("JP225", "^N225", "Yahoo", candles, false, "DGV8");
  assert.equal(staleReference.lifecycleStatus, "DATA_UNTRUSTED");
  assert.equal(staleReference.entry ?? 0, 0);
  assert.equal(staleReference.stopLoss ?? 0, 0);
  assert.deepEqual(staleReference.targets ?? [], []);
}

runParityChecks()
  .then(() =>
    console.log(
      "ZIP parity checks passed: symbols, fallback policy, series validation, and four strategy engines.",
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
