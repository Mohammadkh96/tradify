import assert from "node:assert/strict";
import { MT5BridgeStore } from "./MT5BridgeStore";

const store = new MT5BridgeStore("QUOTE_ONLY_TEST");
(store as any).enqueuePersistence = () => {};

store.updateHeartbeat({
  bridgeId: "QUOTE_ONLY_TEST",
  connected: true,
  symbols: ["XAUUSD.pro", "XAUUSD"],
  activeSymbols: ["XAUUSD.pro"],
});

const accepted = store.updateQuotes([
  {
    symbol: "XAUUSD",
    bid: 2300,
    ask: 2300.5,
    last: 2300.25,
    chartMode: "BID",
    time: Math.floor(Date.now() / 1000) + 3 * 3600,
    quoteOnly: true,
  },
]);

assert.equal(accepted, 1);
assert.equal(
  store.getMappings().XAUUSD,
  "XAUUSD.pro",
  "quote-only updates must not replace the strategy broker mapping",
);
assert.equal(
  store.getQuoteForBrokerSymbol("XAUUSD"),
  null,
  "strategy quote lookup must ignore quote-only data",
);
assert.equal(store.getFreshQuoteForExactBrokerSymbol("XAUUSD")?.quoteOnly, true);

console.log("MT5 quote-only updates stay out of strategy mappings and quote lookups.");
