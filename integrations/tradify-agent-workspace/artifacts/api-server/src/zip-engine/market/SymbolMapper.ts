import { logger } from "../../lib/logger";
/**
 * Single source of truth for Symbol Mapping & Normalization
 * Strictly covering the 22 canonical instruments, bidirectional resolution,
 * suffix stripping, alias matching, and unmapped symbol diagnostics.
 */

export const CANONICAL_SYMBOLS = [
  // Metals / Commodities (3)
  "XAUUSD",
  "XAGUSD",
  "USOIL",

  // Indices (6)
  "US100",
  "US30",
  "US500",
  "GER40",
  "UK100",
  "JP225",

  // Forex (11)
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "USDCHF",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "AUDJPY",

  // Crypto (2)
  "BTCUSD",
  "ETHUSD",
] as const;

export type CanonicalSymbol = (typeof CANONICAL_SYMBOLS)[number];

export interface CanonicalMetadata {
  symbol: CanonicalSymbol;
  name: string;
  category: "Metals" | "Commodities" | "Indices" | "Forex" | "Crypto";
  pricePrecision: number;
  pipSize: number;
  contractSize: number;
}

export const CANONICAL_METADATA: Record<CanonicalSymbol, CanonicalMetadata> = {
  // Metals & Commodities
  XAUUSD: {
    symbol: "XAUUSD",
    name: "Gold (Spot / USD)",
    category: "Metals",
    pricePrecision: 2,
    pipSize: 0.01,
    contractSize: 100,
  },
  XAGUSD: {
    symbol: "XAGUSD",
    name: "Silver (Spot / USD)",
    category: "Metals",
    pricePrecision: 3,
    pipSize: 0.001,
    contractSize: 5000,
  },
  USOIL: {
    symbol: "USOIL",
    name: "Crude Oil (Spot / USD)",
    category: "Commodities",
    pricePrecision: 2,
    pipSize: 0.01,
    contractSize: 1000,
  },

  // Indices
  US100: {
    symbol: "US100",
    name: "Nasdaq 100",
    category: "Indices",
    pricePrecision: 2,
    pipSize: 1.0,
    contractSize: 1,
  },
  US30: {
    symbol: "US30",
    name: "Dow Jones 30",
    category: "Indices",
    pricePrecision: 2,
    pipSize: 1.0,
    contractSize: 1,
  },
  US500: {
    symbol: "US500",
    name: "S&P 500",
    category: "Indices",
    pricePrecision: 2,
    pipSize: 0.1,
    contractSize: 1,
  },
  GER40: {
    symbol: "GER40",
    name: "DAX 40",
    category: "Indices",
    pricePrecision: 2,
    pipSize: 1.0,
    contractSize: 1,
  },
  UK100: {
    symbol: "UK100",
    name: "FTSE 100",
    category: "Indices",
    pricePrecision: 2,
    pipSize: 1.0,
    contractSize: 1,
  },
  JP225: {
    symbol: "JP225",
    name: "Nikkei 225",
    category: "Indices",
    pricePrecision: 1,
    pipSize: 1.0,
    contractSize: 1,
  },

  // Forex
  EURUSD: {
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    category: "Forex",
    pricePrecision: 5,
    pipSize: 0.0001,
    contractSize: 100000,
  },
  GBPUSD: {
    symbol: "GBPUSD",
    name: "British Pound / US Dollar",
    category: "Forex",
    pricePrecision: 5,
    pipSize: 0.0001,
    contractSize: 100000,
  },
  USDJPY: {
    symbol: "USDJPY",
    name: "US Dollar / Japanese Yen",
    category: "Forex",
    pricePrecision: 3,
    pipSize: 0.01,
    contractSize: 100000,
  },
  AUDUSD: {
    symbol: "AUDUSD",
    name: "Australian Dollar / US Dollar",
    category: "Forex",
    pricePrecision: 5,
    pipSize: 0.0001,
    contractSize: 100000,
  },
  USDCAD: {
    symbol: "USDCAD",
    name: "US Dollar / Canadian Dollar",
    category: "Forex",
    pricePrecision: 5,
    pipSize: 0.0001,
    contractSize: 100000,
  },
  USDCHF: {
    symbol: "USDCHF",
    name: "US Dollar / Swiss Franc",
    category: "Forex",
    pricePrecision: 5,
    pipSize: 0.0001,
    contractSize: 100000,
  },
  NZDUSD: {
    symbol: "NZDUSD",
    name: "New Zealand Dollar / US Dollar",
    category: "Forex",
    pricePrecision: 5,
    pipSize: 0.0001,
    contractSize: 100000,
  },
  EURGBP: {
    symbol: "EURGBP",
    name: "Euro / British Pound",
    category: "Forex",
    pricePrecision: 5,
    pipSize: 0.0001,
    contractSize: 100000,
  },
  EURJPY: {
    symbol: "EURJPY",
    name: "Euro / Japanese Yen",
    category: "Forex",
    pricePrecision: 3,
    pipSize: 0.01,
    contractSize: 100000,
  },
  GBPJPY: {
    symbol: "GBPJPY",
    name: "British Pound / Japanese Yen",
    category: "Forex",
    pricePrecision: 3,
    pipSize: 0.01,
    contractSize: 100000,
  },
  AUDJPY: {
    symbol: "AUDJPY",
    name: "Australian Dollar / Japanese Yen",
    category: "Forex",
    pricePrecision: 3,
    pipSize: 0.01,
    contractSize: 100000,
  },

  // Crypto
  BTCUSD: {
    symbol: "BTCUSD",
    name: "Bitcoin / US Dollar",
    category: "Crypto",
    pricePrecision: 2,
    pipSize: 1.0,
    contractSize: 1,
  },
  ETHUSD: {
    symbol: "ETHUSD",
    name: "Ethereum / US Dollar",
    category: "Crypto",
    pricePrecision: 2,
    pipSize: 0.1,
    contractSize: 1,
  },
};

/**
 * Common Broker Suffixes to strip during normalization
 * Order: Longer or specific suffixes first
 */
const KNOWN_SUFFIXES = [
  ".CASH",
  ".RAW",
  ".ECN",
  ".PRO",
  ".STP",
  ".STD",
  ".MINI",
  ".MIC",
  ".S",
  "_CASH",
  "_RAW",
  "_ECN",
  "_PRO",
  "_SB",
  ".A",
  ".M",
  ".C",
  ".I",
  ".F",
  ".X",
  "_A",
  "_M",
  "_C",
];

/**
 * Base Alias Dictionary: maps alternative names to Canonical Symbols
 */
const ALIASES: Record<string, CanonicalSymbol> = {
  // Spot Gold
  GOLD: "XAUUSD",
  XAU: "XAUUSD",
  XAUUSD: "XAUUSD",

  // Spot Silver
  SILVER: "XAGUSD",
  XAG: "XAGUSD",
  XAGUSD: "XAGUSD",

  // Spot Crude Oil / WTI
  WTI: "USOIL",
  WTICRUDE: "USOIL",
  CRUDE: "USOIL",
  USOIL: "USOIL",
  SPOTCRUDE: "USOIL",
  CL: "USOIL",

  // Indices
  NAS100: "US100",
  USTEC: "US100",
  NDX: "US100",
  NQ: "US100",
  US100: "US100",
  US100CASH: "US100",
  NAS100CASH: "US100",

  US30: "US30",
  DJ30: "US30",
  WS30: "US30",
  DOW: "US30",
  YM: "US30",
  US30CASH: "US30",

  US500: "US500",
  SPX500: "US500",
  SP500: "US500",
  SPX: "US500",
  ES: "US500",
  US500CASH: "US500",

  GER40: "GER40",
  GER30: "GER40",
  DAX40: "GER40",
  DAX30: "GER40",
  DE40: "GER40",
  DE30: "GER40",
  DAX: "GER40",
  GER40CASH: "GER40",

  UK100: "UK100",
  FTSE100: "UK100",
  FTSE: "UK100",
  UK100CASH: "UK100",

  JP225: "JP225",
  JPN225: "JP225",
  NIKKEI: "JP225",
  JP225CASH: "JP225",

  // Forex
  EURUSD: "EURUSD",
  GBPUSD: "GBPUSD",
  USDJPY: "USDJPY",
  AUDUSD: "AUDUSD",
  USDCAD: "USDCAD",
  USDCHF: "USDCHF",
  NZDUSD: "NZDUSD",
  EURGBP: "EURGBP",
  EURJPY: "EURJPY",
  GBPJPY: "GBPJPY",
  AUDJPY: "AUDJPY",

  // Crypto
  BTCUSD: "BTCUSD",
  BTCUSDT: "BTCUSD",
  XBTUSD: "BTCUSD",
  ETHUSD: "ETHUSD",
  ETHUSDT: "ETHUSD",
};

/**
 * Strictly blocked futures/token mappings that must NOT coerce to spot instruments
 */
const BLOCKED_FUTURES: Record<string, string> = {
  GC: "CME Gold Futures (Not Spot XAUUSD)",
  "GC=F": "Yahoo Gold Futures",
  PAXG: "PAX Gold Token",
  PAXGUSDT: "Crypto Gold Token",
  SI: "CME Silver Futures",
};

export class SymbolMapper {
  // Store bidirectional discovered broker symbols (Canonical -> Broker)
  private static canonicalToBrokerMap: Map<CanonicalSymbol, string> = new Map();
  // Track logged unmapped symbols to prevent log spamming
  private static loggedUnmappedSymbols: Set<string> = new Set();

  /**
   * Check if a symbol is one of the 22 canonical symbols
   */
  public static isCanonical(symbol: string): symbol is CanonicalSymbol {
    return CANONICAL_SYMBOLS.includes(symbol as CanonicalSymbol);
  }

  /**
   * Converts a broker or raw symbol into a CanonicalSymbol.
   * Deterministic, case-insensitive, strips suffixes, and checks alias tables.
   */
  public static toCanonical(rawSymbol: string): {
    canonical: CanonicalSymbol | null;
    isUnmapped: boolean;
    raw: string;
  } {
    if (!rawSymbol || typeof rawSymbol !== "string") {
      return { canonical: null, isUnmapped: false, raw: "" };
    }

    const trimmed = rawSymbol.trim().toUpperCase();

    // 1. Direct canonical check
    if (this.isCanonical(trimmed)) {
      return { canonical: trimmed, isUnmapped: false, raw: rawSymbol };
    }

    // 2. Reject blocked futures/derivatives from coercing to spot
    if (BLOCKED_FUTURES[trimmed]) {
      return { canonical: null, isUnmapped: true, raw: rawSymbol };
    }

    // 3. Strip known broker suffixes
    let base = trimmed;
    for (const suffix of KNOWN_SUFFIXES) {
      if (base.endsWith(suffix)) {
        base = base.slice(0, -suffix.length);
        break;
      }
    }

    // Also strip generic trailing punctuation like '.' or '_'
    base = base.replace(/[\._\-]+$/, "");

    // 4. Direct check after suffix stripping
    if (this.isCanonical(base)) {
      return { canonical: base, isUnmapped: false, raw: rawSymbol };
    }

    // 5. Lookup in alias dictionary
    if (ALIASES[base]) {
      return { canonical: ALIASES[base], isUnmapped: false, raw: rawSymbol };
    }

    // 6. Handle currency pair formatting like EUR/USD or EUR_USD
    const cleanSeparators = base.replace(/[\/\-_]/g, "");
    if (this.isCanonical(cleanSeparators)) {
      return { canonical: cleanSeparators, isUnmapped: false, raw: rawSymbol };
    }
    if (ALIASES[cleanSeparators]) {
      return { canonical: ALIASES[cleanSeparators], isUnmapped: false, raw: rawSymbol };
    }

    // 7. Unknown / Unmapped Symbol handling: Log once without guessing
    if (!this.loggedUnmappedSymbols.has(trimmed)) {
      this.loggedUnmappedSymbols.add(trimmed);
      logger.warn(
        { rawSymbol, normalizedSymbol: base },
        "Broker symbol did not map to a canonical instrument",
      );
    }

    return { canonical: null, isUnmapped: true, raw: rawSymbol };
  }

  /**
   * Registers a discovered broker symbol for a canonical instrument (Bidirectional)
   */
  public static registerBrokerMapping(canonical: CanonicalSymbol, brokerSymbol: string): void {
    if (!this.isCanonical(canonical)) return;
    this.canonicalToBrokerMap.set(canonical, brokerSymbol);
  }

  /**
   * Resolves canonical symbol to the active broker-specific symbol.
   * If broker symbol is not yet discovered from bridge, returns the canonical name.
   */
  public static toBroker(canonicalSymbol: CanonicalSymbol | string): string {
    const canonical = this.toCanonical(canonicalSymbol).canonical;
    if (canonical && this.canonicalToBrokerMap.has(canonical)) {
      return this.canonicalToBrokerMap.get(canonical)!;
    }
    return canonical || canonicalSymbol;
  }

  /**
   * Clears in-memory registered broker mappings
   */
  public static clearBrokerMappings(): void {
    this.canonicalToBrokerMap.clear();
  }

  /**
   * Get list of all registered canonical instruments
   */
  public static getAllCanonical(): readonly CanonicalSymbol[] {
    return CANONICAL_SYMBOLS;
  }
}
