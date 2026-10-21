import assert from "node:assert/strict";
import { validateLiveQuoteSamples, type LiveQuoteResponse } from "./check-live-quotes";

let sampleTimestamp = Date.now();

function sample(price: number, overrides: Partial<LiveQuoteResponse> = {}): LiveQuoteResponse {
  return {
    bridge: { connected: true, activeSymbols: ["XAUUSD"] },
    quotes: {
      XAUUSD: {
        provider: "MT5",
        dataState: "LIVE",
        status: "LIVE",
        price,
        receivedAt: sampleTimestamp++,
      },
    },
    ...overrides,
  };
}

const startupEmpty: LiveQuoteResponse = {
  bridge: { connected: false, activeSymbols: [] },
  quotes: {},
};

const ready = validateLiveQuoteSamples([startupEmpty, sample(2300), sample(2301), sample(2302)]);
assert.equal(
  ready.checkedSamples,
  3,
  "leading startup samples should not fail a feed that becomes ready",
);
assert.deepEqual(ready.subscribedSymbols, ["XAUUSD"]);
assert.deepEqual(ready.changedSymbols, ["XAUUSD"]);
assert.deepEqual(ready.advancedSymbols, ["XAUUSD"]);

const publicReady = validateLiveQuoteSamples([
  {
    bridge: { connected: true },
    quotes: {
      XAUUSD: { dataState: "LIVE", status: "LIVE", price: 2300, receivedAt: sampleTimestamp++ },
    },
  },
  {
    bridge: { connected: true },
    quotes: {
      XAUUSD: { dataState: "LIVE", status: "LIVE", price: 2301, receivedAt: sampleTimestamp++ },
    },
  },
]);
assert.deepEqual(
  publicReady.subscribedSymbols,
  ["XAUUSD"],
  "the public customer contract should use live quote keys as observations",
);
assert.deepEqual(publicReady.changedSymbols, ["XAUUSD"]);
assert.deepEqual(publicReady.advancedSymbols, ["XAUUSD"]);

assert.doesNotThrow(
  () => validateLiveQuoteSamples([sample(2300), sample(2300), sample(2300)]),
  "fresh quote ingestion must pass even when the market price is unchanged",
);

const frozenTimestamp = Date.now();
assert.throws(
  () =>
    validateLiveQuoteSamples([
      sample(2300, {
        quotes: {
          XAUUSD: {
            provider: "MT5",
            dataState: "LIVE",
            status: "LIVE",
            price: 2300,
            receivedAt: frozenTimestamp,
          },
        },
      }),
      sample(2301, {
        quotes: {
          XAUUSD: {
            provider: "MT5",
            dataState: "LIVE",
            status: "LIVE",
            price: 2301,
            receivedAt: frozenTimestamp,
          },
        },
      }),
    ]),
  /quote ingestion timestamps did not advance/,
  "price movement without advancing ingestion timestamps must not pass",
);

assert.throws(
  () => validateLiveQuoteSamples([startupEmpty, startupEmpty, startupEmpty]),
  /no active market subscriptions/,
  "an empty subscription response must fail clearly when it never recovers",
);

const disconnectedAfterReady = sample(2301, {
  bridge: { connected: false, activeSymbols: [] },
  quotes: {},
});
assert.throws(
  () => validateLiveQuoteSamples([sample(2300), disconnectedAfterReady, sample(2302)]),
  /sample 2: market data bridge is not connected/,
  "a real disconnect after startup must not be ignored",
);

console.log(
  "Live quote health checks passed: startup timing, empty subscriptions, and disconnects.",
);
