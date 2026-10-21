import { marketCatalog } from "./MarketCatalog";

export type InstrumentType =
  "spot" | "forex" | "CFD" | "cash index" | "futures" | "crypto" | "token" | "proxy";

export interface InstrumentDefinition {
  symbol: string;
  displayName: string;
  assetClass: string;
  instrumentType: InstrumentType;
  providerSymbol: string;
  providerName: string;
  pricePrecision: number;
  tickSize: number;
  tradingTimezone: string;
  quoteCapability: boolean;
  candleCapability: boolean;
  volumeCapability: boolean;
  liveStatus: "LIVE" | "DELAYED" | "UNAVAILABLE";
}

export class SymbolRegistry {
  static get(symbol: string): InstrumentDefinition | null {
    if (!symbol) return null;

    const item = marketCatalog.get(symbol);
    if (item) {
      const isJpy = item.canonicalSymbol.includes("JPY") || item.providerSymbol.includes("JPY");
      const digits = item.digits || (item.assetClass === "FOREX" ? (isJpy ? 3 : 5) : 2);
      const tickSize =
        item.tickSize || (item.assetClass === "FOREX" ? (isJpy ? 0.001 : 0.00001) : 0.01);

      return {
        symbol: item.canonicalSymbol,
        displayName: item.description || item.canonicalSymbol,
        assetClass: item.assetClass,
        instrumentType:
          item.assetClass === "FOREX"
            ? "forex"
            : item.assetClass === "INDICES"
              ? "cash index"
              : item.assetClass === "METALS"
                ? "spot"
                : "CFD",
        providerSymbol: item.providerSymbol,
        providerName: item.provider,
        pricePrecision: digits,
        tickSize: tickSize,
        tradingTimezone: "UTC",
        quoteCapability: true,
        candleCapability: true,
        volumeCapability: true,
        liveStatus: "LIVE",
      };
    }

    return null;
  }

  static getAll(): InstrumentDefinition[] {
    const catItems = marketCatalog.getAll();
    const list: InstrumentDefinition[] = [];
    for (const cat of catItems) {
      const def = this.get(cat.canonicalSymbol);
      if (def) list.push(def);
    }
    return list;
  }
}
