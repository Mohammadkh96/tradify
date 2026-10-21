import { MT5_WATCHLIST_QUOTE_SYMBOLS } from "./MT5WatchlistSubscriptions";
import type { MarketCatalogItem } from "./MarketCatalog";

const watchlistSymbolSet = new Set<string>(MT5_WATCHLIST_QUOTE_SYMBOLS);
const watchlistSymbolsByLength = [...MT5_WATCHLIST_QUOTE_SYMBOLS].sort(
  (left, right) => right.length - left.length,
);

export function mt5WatchlistSymbolIdentity(rawSymbol: string): string | null {
  const normalized = rawSymbol.trim().toUpperCase();
  if (watchlistSymbolSet.has(normalized)) return normalized;
  for (const symbol of watchlistSymbolsByLength) {
    if (!normalized.startsWith(symbol)) continue;
    const suffix = normalized.slice(symbol.length);
    if (/^[._-][A-Z0-9][A-Z0-9._-]*$/.test(suffix)) return symbol;
  }
  return null;
}

export const mt5WatchlistMarketNames: Record<string, string> = {
  USDSEK: "US Dollar / Swedish Krona",
  AMD: "Advanced Micro Devices",
  MSFT: "Microsoft",
  INTC: "Intel",
  NVDA: "NVIDIA",
  XTIUSD: "WTI Crude Oil",
  SP500: "S&P 500 Index",
  NDX: "Nasdaq 100 Index",
  DOW: "Dow Jones Industrial Average",
  NI225: "Nikkei 225",
  AUS200: "S&P/ASX 200",
  FCHI40: "CAC 40",
  STOXX50E: "Euro Stoxx 50",
  SPA35: "IBEX 35",
  AAPL: "Apple",
  AXP: "American Express",
  BA: "Boeing",
  CAT: "Caterpillar",
  CSCO: "Cisco",
  CVX: "Chevron",
  DIS: "Walt Disney",
  GE: "GE Aerospace",
  GS: "Goldman Sachs",
  HD: "Home Depot",
  IBM: "IBM",
  JNJ: "Johnson & Johnson",
  JPM: "JPMorgan Chase",
  KO: "Coca-Cola",
  MCD: "McDonald's",
  MMM: "3M",
  MRK: "Merck",
  NKE: "Nike",
  PFE: "Pfizer",
  PG: "Procter & Gamble",
  TRV: "Travelers",
  V: "Visa",
  UNH: "UnitedHealth Group",
  VZ: "Verizon",
  WMT: "Walmart",
  XOM: "Exxon Mobil",
  GBPCHF: "British Pound / Swiss Franc",
  GBPCAD: "British Pound / Canadian Dollar",
  GBPAUD: "British Pound / Australian Dollar",
  GBPMXN: "British Pound / Mexican Peso",
  GBPNOK: "British Pound / Norwegian Krone",
  GBPNZD: "British Pound / New Zealand Dollar",
  GBPSEK: "British Pound / Swedish Krona",
};

const indexSymbols = new Set([
  "SP500",
  "NDX",
  "DOW",
  "NI225",
  "AUS200",
  "FCHI40",
  "STOXX50E",
  "SPA35",
]);
const stockSymbols = new Set([
  "AMD",
  "MSFT",
  "INTC",
  "NVDA",
  "AAPL",
  "AXP",
  "BA",
  "CAT",
  "CSCO",
  "CVX",
  "DIS",
  "GE",
  "GS",
  "HD",
  "IBM",
  "JNJ",
  "JPM",
  "KO",
  "MCD",
  "MMM",
  "MRK",
  "NKE",
  "PFE",
  "PG",
  "TRV",
  "V",
  "UNH",
  "VZ",
  "WMT",
  "XOM",
]);
const currencyCodes = new Set([
  "AUD",
  "CAD",
  "CHF",
  "EUR",
  "GBP",
  "JPY",
  "MXN",
  "NOK",
  "NZD",
  "SEK",
  "USD",
]);

export function mt5WatchlistAssetClass(symbol: string): MarketCatalogItem["assetClass"] {
  if (indexSymbols.has(symbol)) return "INDICES";
  if (stockSymbols.has(symbol)) return "STOCKS";
  if (symbol === "XTIUSD") return "COMMODITIES";
  if (
    /^[A-Z]{6}$/.test(symbol) &&
    currencyCodes.has(symbol.slice(0, 3)) &&
    currencyCodes.has(symbol.slice(3, 6))
  )
    return "FOREX";
  return "OTHER";
}

export function mt5WatchlistDigits(symbol: string): number {
  return mt5WatchlistAssetClass(symbol) === "FOREX" ? (symbol.endsWith("JPY") ? 3 : 5) : 2;
}

function strategiesForAssetClass(assetClass: MarketCatalogItem["assetClass"]): string[] {
  switch (assetClass) {
    case "FOREX":
      return ["DGV8_FX", "BBB"];
    case "INDICES":
      return ["BBB"];
    // The existing core USOIL market uses DGV8 for the same commodity class.
    case "COMMODITIES":
      return ["DGV8"];
    default:
      return [];
  }
}

export function createMt5WatchlistCatalogItem(symbol: string): MarketCatalogItem {
  const normalized = symbol.trim().toUpperCase();
  const assetClass = mt5WatchlistAssetClass(normalized);
  return {
    id: normalized,
    provider: "MT5",
    providerSymbol: normalized,
    canonicalSymbol: normalized,
    displaySymbol: normalized,
    description: mt5WatchlistMarketNames[normalized] ?? normalized,
    assetClass,
    digits: mt5WatchlistDigits(normalized),
    quoteAvailable: false,
    candlesAvailable: false,
    strategyId: null,
    strategyConfigured: false,
    availableStrategies: strategiesForAssetClass(assetClass),
    defaultStrategyId: null,
    enabled: true,
    visibleToUsers: true,
    seedStrategyAssignments: false,
  };
}

export function addMt5WatchlistCatalogItems(catalog: Map<string, MarketCatalogItem>): void {
  for (const symbol of MT5_WATCHLIST_QUOTE_SYMBOLS) {
    if (catalog.has(symbol)) continue;
    catalog.set(symbol, createMt5WatchlistCatalogItem(symbol));
  }
}
