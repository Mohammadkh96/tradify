import assert from "node:assert/strict";
import { marketCatalog } from "./MarketCatalog";
import { SymbolMapper } from "./SymbolMapper";
import { mt5BridgeStore } from "./providers/MT5BridgeStore";
import { MT5_WATCHLIST_QUOTE_SYMBOLS } from "./MT5WatchlistSubscriptions";
import { mt5WatchlistSymbolIdentity } from "./MT5WatchlistCatalog";

assert.equal(
  MT5_WATCHLIST_QUOTE_SYMBOLS.length,
  61,
  "the managed watchlist should retain all 61 symbols",
);
assert.equal(new Set(MT5_WATCHLIST_QUOTE_SYMBOLS).size, 61, "watchlist identities must be unique");
for (const symbol of MT5_WATCHLIST_QUOTE_SYMBOLS) {
  assert.ok(marketCatalog.get(symbol), `${symbol} should have a managed catalog entry`);
  assert.equal(
    mt5WatchlistSymbolIdentity(symbol),
    symbol,
    `${symbol} should preserve its exact identity`,
  );
}

const ndx = marketCatalog.get("NDX");
const us100 = marketCatalog.get("US100");
assert.ok(ndx);
assert.ok(us100);

assert.equal(
  SymbolMapper.toCanonical("NDX").canonical,
  "US100",
  "the legacy alias still points to the core NASDAQ symbol",
);
assert.equal(mt5WatchlistSymbolIdentity("NDX"), "NDX");
assert.equal(mt5WatchlistSymbolIdentity("NDX.sfx"), "NDX");
assert.equal(mt5BridgeStore.resolveCanonicalSymbol("NDX"), "NDX");
assert.equal(mt5BridgeStore.resolveCanonicalSymbol("NDX.sfx"), "NDX");
assert.equal(
  ndx.seedStrategyAssignments,
  false,
  "watchlist entries must not receive default assignments at bootstrap",
);
assert.deepEqual(
  ndx.availableStrategies,
  ["BBB"],
  "indices should offer only the existing compatible strategy",
);

const originalUs100ProviderSymbol = us100.providerSymbol;
marketCatalog.syncDiscoveredSymbols(["NDX"]);
assert.equal(ndx.providerSymbol, "NDX");
assert.equal(
  us100.providerSymbol,
  originalUs100ProviderSymbol,
  "discovering NDX must not overwrite US100's broker mapping",
);

marketCatalog.syncDiscoveredSymbols(["NDX.sfx"]);
assert.equal(
  ndx.providerSymbol,
  "NDX.sfx",
  "broker suffixes should remain attached to the exact watchlist entry",
);
assert.equal(us100.providerSymbol, originalUs100ProviderSymbol);

const accepted = marketCatalog.syncBrokerSpecifications([
  {
    brokerSymbol: "NDX.sfx",
    digits: 2,
    point: 0.01,
    receivedAt: Date.now(),
  },
]);
assert.equal(accepted, 1);
assert.equal(ndx.brokerSpec?.brokerSymbol, "NDX.sfx");
assert.equal(us100.providerSymbol, originalUs100ProviderSymbol);

process.stdout.write("MT5 watchlist catalog identity checks passed\n");
