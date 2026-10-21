import { logger } from "../../lib/logger";
export type InstrumentClass = "SPOT" | "FUTURES" | "INDEX_CASH" | "INDEX_FUTURES" | "CRYPTO_SPOT";

export interface FallbackRoute {
  canonical: string;
  provider: "TwelveData" | "Yahoo" | "Binance" | "MT5";
  providerSymbol: string;
  fallbackClass: InstrumentClass;
  isSameInstrument: boolean;
}

export interface SymbolFallbackConfig {
  canonical: string;
  brokerClass: InstrumentClass;
  fallbacks: FallbackRoute[];
}

/**
 * Single source of truth for fallback configuration for all 22 symbols.
 * Enforces same-class fallback routing.
 * Spot XAUUSD has NO futures fallback (GC=F prohibited).
 */
export const FALLBACK_REGISTRY: Record<string, SymbolFallbackConfig> = {
  // Metals & Commodities (SPOT)
  XAUUSD: {
    canonical: "XAUUSD",
    brokerClass: "SPOT",
    // Spot Gold: NO futures (GC=F) or crypto tokens (PAXG). If MT5 down -> STALE.
    fallbacks: [],
  },
  XAGUSD: {
    canonical: "XAGUSD",
    brokerClass: "SPOT",
    // Spot Silver: NO futures (SI=F). If MT5 down -> STALE.
    fallbacks: [],
  },
  USOIL: {
    canonical: "USOIL",
    brokerClass: "SPOT",
    // Spot WTI: NO futures (CL=F). If MT5 down -> STALE.
    fallbacks: [],
  },

  // Indices (Cash)
  US100: {
    canonical: "US100",
    brokerClass: "INDEX_CASH",
    fallbacks: [
      {
        canonical: "US100",
        provider: "TwelveData",
        providerSymbol: "NDX",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
      {
        canonical: "US100",
        provider: "Yahoo",
        providerSymbol: "^NDX",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
    ],
  },
  US30: {
    canonical: "US30",
    brokerClass: "INDEX_CASH",
    fallbacks: [
      {
        canonical: "US30",
        provider: "TwelveData",
        providerSymbol: "DJI",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
      {
        canonical: "US30",
        provider: "Yahoo",
        providerSymbol: "^DJI",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
    ],
  },
  US500: {
    canonical: "US500",
    brokerClass: "INDEX_CASH",
    fallbacks: [
      {
        canonical: "US500",
        provider: "TwelveData",
        providerSymbol: "GSPC",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
      {
        canonical: "US500",
        provider: "Yahoo",
        providerSymbol: "^GSPC",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
    ],
  },
  GER40: {
    canonical: "GER40",
    brokerClass: "INDEX_CASH",
    fallbacks: [
      {
        canonical: "GER40",
        provider: "TwelveData",
        providerSymbol: "GDAXI",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
      {
        canonical: "GER40",
        provider: "Yahoo",
        providerSymbol: "^GDAXI",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
    ],
  },
  UK100: {
    canonical: "UK100",
    brokerClass: "INDEX_CASH",
    fallbacks: [
      {
        canonical: "UK100",
        provider: "TwelveData",
        providerSymbol: "FTSE",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
      {
        canonical: "UK100",
        provider: "Yahoo",
        providerSymbol: "^FTSE",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
    ],
  },
  JP225: {
    canonical: "JP225",
    brokerClass: "INDEX_CASH",
    fallbacks: [
      {
        canonical: "JP225",
        provider: "TwelveData",
        providerSymbol: "N225",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
      {
        canonical: "JP225",
        provider: "Yahoo",
        providerSymbol: "^N225",
        fallbackClass: "INDEX_CASH",
        isSameInstrument: true,
      },
    ],
  },

  // Forex (Spot)
  EURUSD: {
    canonical: "EURUSD",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "EURUSD",
        provider: "TwelveData",
        providerSymbol: "EUR/USD",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "EURUSD",
        provider: "Yahoo",
        providerSymbol: "EURUSD=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  GBPUSD: {
    canonical: "GBPUSD",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "GBPUSD",
        provider: "TwelveData",
        providerSymbol: "GBP/USD",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "GBPUSD",
        provider: "Yahoo",
        providerSymbol: "GBPUSD=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  USDJPY: {
    canonical: "USDJPY",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "USDJPY",
        provider: "TwelveData",
        providerSymbol: "USD/JPY",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "USDJPY",
        provider: "Yahoo",
        providerSymbol: "USDJPY=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  AUDUSD: {
    canonical: "AUDUSD",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "AUDUSD",
        provider: "TwelveData",
        providerSymbol: "AUD/USD",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "AUDUSD",
        provider: "Yahoo",
        providerSymbol: "AUDUSD=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  USDCAD: {
    canonical: "USDCAD",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "USDCAD",
        provider: "TwelveData",
        providerSymbol: "USD/CAD",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "USDCAD",
        provider: "Yahoo",
        providerSymbol: "USDCAD=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  USDCHF: {
    canonical: "USDCHF",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "USDCHF",
        provider: "TwelveData",
        providerSymbol: "USD/CHF",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "USDCHF",
        provider: "Yahoo",
        providerSymbol: "USDCHF=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  NZDUSD: {
    canonical: "NZDUSD",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "NZDUSD",
        provider: "TwelveData",
        providerSymbol: "NZD/USD",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "NZDUSD",
        provider: "Yahoo",
        providerSymbol: "NZDUSD=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  EURGBP: {
    canonical: "EURGBP",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "EURGBP",
        provider: "TwelveData",
        providerSymbol: "EUR/GBP",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "EURGBP",
        provider: "Yahoo",
        providerSymbol: "EURGBP=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  EURJPY: {
    canonical: "EURJPY",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "EURJPY",
        provider: "TwelveData",
        providerSymbol: "EUR/JPY",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "EURJPY",
        provider: "Yahoo",
        providerSymbol: "EURJPY=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  GBPJPY: {
    canonical: "GBPJPY",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "GBPJPY",
        provider: "TwelveData",
        providerSymbol: "GBP/JPY",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "GBPJPY",
        provider: "Yahoo",
        providerSymbol: "GBPJPY=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },
  AUDJPY: {
    canonical: "AUDJPY",
    brokerClass: "SPOT",
    fallbacks: [
      {
        canonical: "AUDJPY",
        provider: "TwelveData",
        providerSymbol: "AUD/JPY",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "AUDJPY",
        provider: "Yahoo",
        providerSymbol: "AUDJPY=X",
        fallbackClass: "SPOT",
        isSameInstrument: true,
      },
    ],
  },

  // Crypto (Spot)
  BTCUSD: {
    canonical: "BTCUSD",
    brokerClass: "CRYPTO_SPOT",
    fallbacks: [
      {
        canonical: "BTCUSD",
        provider: "Binance",
        providerSymbol: "BTCUSDT",
        fallbackClass: "CRYPTO_SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "BTCUSD",
        provider: "TwelveData",
        providerSymbol: "BTC/USD",
        fallbackClass: "CRYPTO_SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "BTCUSD",
        provider: "Yahoo",
        providerSymbol: "BTC-USD",
        fallbackClass: "CRYPTO_SPOT",
        isSameInstrument: true,
      },
    ],
  },
  ETHUSD: {
    canonical: "ETHUSD",
    brokerClass: "CRYPTO_SPOT",
    fallbacks: [
      {
        canonical: "ETHUSD",
        provider: "Binance",
        providerSymbol: "ETHUSDT",
        fallbackClass: "CRYPTO_SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "ETHUSD",
        provider: "TwelveData",
        providerSymbol: "ETH/USD",
        fallbackClass: "CRYPTO_SPOT",
        isSameInstrument: true,
      },
      {
        canonical: "ETHUSD",
        provider: "Yahoo",
        providerSymbol: "ETH-USD",
        fallbackClass: "CRYPTO_SPOT",
        isSameInstrument: true,
      },
    ],
  },
};

export class FallbackMap {
  private static loggedMismatches: Set<string> = new Set();

  static getConfig(canonical: string): SymbolFallbackConfig | null {
    return FALLBACK_REGISTRY[canonical] || null;
  }

  static isValidFallback(canonical: string, route: FallbackRoute): boolean {
    const config = this.getConfig(canonical);
    if (!config) return false;

    if (config.brokerClass !== route.fallbackClass) {
      const key = `${canonical}_${route.provider}_${route.fallbackClass}`;
      if (!this.loggedMismatches.has(key)) {
        this.loggedMismatches.add(key);
        logger.warn(
          {
            canonicalSymbol: canonical,
            expectedClass: config.brokerClass,
            actualClass: route.fallbackClass,
            provider: route.provider,
          },
          "Rejected incompatible market fallback",
        );
      }
      return false;
    }

    return true;
  }

  static getValidFallbacks(canonical: string): FallbackRoute[] {
    const config = this.getConfig(canonical);
    if (!config) return [];
    return config.fallbacks.filter((f) => this.isValidFallback(canonical, f));
  }
}
