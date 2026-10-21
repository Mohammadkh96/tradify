export const MT5_WATCHLIST_QUOTE_SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDCHF",
  "USDJPY",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "USDSEK",
  "AMD",
  "MSFT",
  "INTC",
  "NVDA",
  "XAUUSD",
  "UK100",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "AUDJPY",
  "SP500",
  "NDX",
  "XAGUSD",
  "XTIUSD",
  "NI225",
  "AUS200",
  "FCHI40",
  "STOXX50E",
  "SPA35",
  "AAPL",
  "AXP",
  "BA",
  "CAT",
  "CSCO",
  "CVX",
  "DIS",
  "DOW",
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
  "GBPCHF",
  "GBPCAD",
  "GBPAUD",
  "GBPMXN",
  "GBPNOK",
  "GBPNZD",
  "GBPSEK",
] as const;

export function mt5WatchlistQuoteSymbols(
  discoveredSymbols: readonly string[],
  strategySymbols: readonly string[],
  connected: boolean,
): string[] {
  if (!connected) return [];

  const discoveredByUppercase = new Map<string, string>();
  for (const value of discoveredSymbols) {
    if (typeof value !== "string") continue;
    const symbol = value.trim();
    if (symbol && !discoveredByUppercase.has(symbol.toUpperCase())) {
      discoveredByUppercase.set(symbol.toUpperCase(), symbol);
    }
  }

  const strategySet = new Set(strategySymbols.map((symbol) => symbol.trim().toUpperCase()));
  const result: string[] = [];
  const seen = new Set<string>();
  for (const requestedSymbol of MT5_WATCHLIST_QUOTE_SYMBOLS) {
    const key = requestedSymbol.toUpperCase();
    const discoveredSymbol = discoveredByUppercase.get(key);
    if (!discoveredSymbol || strategySet.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(discoveredSymbol);
  }
  return result;
}
