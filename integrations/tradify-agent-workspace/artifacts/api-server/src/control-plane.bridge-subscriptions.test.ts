import assert from "node:assert/strict";
import { mt5StrategyBrokerSymbols } from "./control-plane";
import {
  MT5_WATCHLIST_QUOTE_SYMBOLS,
  mt5WatchlistQuoteSymbols,
} from "./zip-engine/market/MT5WatchlistSubscriptions";

const subscriptions = mt5StrategyBrokerSymbols(
  [
    {
      canonicalSymbol: "XAUUSD",
      providerSymbol: "XAUUSD",
      provider: "MT5",
      enabled: true,
      strategyConfigured: true,
    },
    {
      canonicalSymbol: "US30",
      providerSymbol: "US30.cash",
      provider: "MT5",
      enabled: false,
      strategyConfigured: true,
    },
    {
      canonicalSymbol: "EURUSD",
      providerSymbol: "EURUSD",
      provider: "MT5",
      enabled: true,
      strategyConfigured: false,
    },
    {
      canonicalSymbol: "BTCUSD",
      providerSymbol: "BTCUSD",
      provider: "TwelveData",
      enabled: true,
      strategyConfigured: true,
    },
    {
      canonicalSymbol: "XAGUSD",
      providerSymbol: "XAGUSD",
      provider: "MT5",
      enabled: true,
      strategyConfigured: true,
    },
    {
      canonicalSymbol: "XAUUSD_ALIAS",
      providerSymbol: "XAUUSD.PRO",
      provider: "MT5",
      enabled: true,
      strategyConfigured: true,
    },
  ],
  {
    XAUUSD: "XAUUSD.pro",
  },
);

assert.deepEqual(
  subscriptions,
  ["XAUUSD.pro", "XAGUSD"],
  "only unique broker symbols for enabled MT5 strategies should be subscribed",
);

console.log("MT5 strategy subscription scope tests passed.");

assert.equal(
  MT5_WATCHLIST_QUOTE_SYMBOLS.length,
  61,
  "the imported MT5 watchlist should contain all CSV rows",
);
assert.equal(
  new Set(MT5_WATCHLIST_QUOTE_SYMBOLS).size,
  61,
  "the imported MT5 watchlist should not contain duplicates",
);
assert.deepEqual(
  mt5WatchlistQuoteSymbols(
    ["EURUSD", "XAUUSD", "USDSEK", "NVDA", "AMD", "UNLISTED"],
    ["EURUSD", "XAUUSD"],
    true,
  ),
  ["USDSEK", "AMD", "NVDA"],
  "quote-only subscriptions should include only discovered CSV symbols outside the strategy list",
);
assert.deepEqual(
  mt5WatchlistQuoteSymbols(["AMD", "NVDA"], [], false),
  [],
  "quote-only subscriptions should be empty when the MT5 terminal is disconnected",
);

console.log("MT5 quote-only Market Watch subscription tests passed.");
