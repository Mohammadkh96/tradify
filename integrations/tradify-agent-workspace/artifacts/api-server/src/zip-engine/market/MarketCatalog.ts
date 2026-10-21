import { SymbolRegistry } from "./SymbolRegistry";
import { SymbolMapper, CanonicalSymbol, CANONICAL_METADATA } from "./SymbolMapper";
import { mt5ServerUtcOffsetSeconds } from "./CandleTime";
import { addMt5WatchlistCatalogItems, mt5WatchlistSymbolIdentity } from "./MT5WatchlistCatalog";

export interface MarketCatalogItem {
  id: string;
  provider: string; // 'MT5' | 'BINANCE' | etc.
  providerSymbol: string;
  canonicalSymbol: string;
  displaySymbol: string;
  description: string;
  assetClass: "METALS" | "INDICES" | "FOREX" | "CRYPTO" | "COMMODITIES" | "STOCKS" | "OTHER";
  digits: number;
  point?: number;
  tickSize?: number;
  currencyBase?: string;
  currencyProfit?: string;
  tradeMode?: string;
  chartMode?: string;
  quoteAvailable: boolean;
  candlesAvailable: boolean;
  strategyId: string | null;
  strategyConfigured: boolean;
  availableStrategies?: string[];
  defaultStrategyId?: string | null;
  seedStrategyAssignments?: boolean;
  enabled: boolean;
  visibleToUsers: boolean;
  /**
   * Authoritative trading specifications received from the MT5 bridge.
   * Keep these separate from the catalog defaults above: defaults are only
   * suitable for display and must never drive order sizing.
   */
  brokerSpec?: BrokerSymbolSpecification;
}

export interface BrokerSymbolSpecification {
  brokerSymbol: string;
  contractSize?: number;
  tickSize?: number;
  tickValue?: number;
  tickValueProfit?: number;
  tickValueLoss?: number;
  volumeMin?: number;
  volumeMax?: number;
  volumeStep?: number;
  digits?: number;
  point?: number;
  quoteCurrency?: string;
  receivedAt: number;
  tradingSessions?: BrokerTradingSessionSchedule;
}

export interface BrokerTradingSessionWindow {
  dayOfWeek: number;
  fromSeconds: number;
  toSeconds: number;
}

export interface BrokerTradingSessionSchedule {
  source: "MT5_SYMBOL_INFO_SESSION_TRADE";
  serverTime: number;
  utcTime: number;
  serverUtcOffsetSeconds: number;
  sessions: BrokerTradingSessionWindow[];
}

export class MarketCatalog {
  private static instance: MarketCatalog;

  // Catalog keyed by canonical symbol (e.g. XAUUSD, US100, EURUSD)
  private catalog: Map<string, MarketCatalogItem> = new Map();

  private constructor() {
    this.initDefaultCatalog();
  }

  public static getInstance(): MarketCatalog {
    if (!MarketCatalog.instance) {
      MarketCatalog.instance = new MarketCatalog();
    }
    return MarketCatalog.instance;
  }

  private initDefaultCatalog() {
    const defaults: MarketCatalogItem[] = [
      {
        id: "XAUUSD",
        provider: "MT5",
        providerSymbol: "XAUUSD",
        canonicalSymbol: "XAUUSD",
        displaySymbol: "XAUUSD",
        description: "Gold / US Dollar",
        assetClass: "METALS",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "XAU",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8",
        strategyConfigured: true,
        availableStrategies: ["DGV8", "BBB_GOLD_3S"],
        defaultStrategyId: "DGV8",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "XAGUSD",
        provider: "MT5",
        providerSymbol: "XAGUSD",
        canonicalSymbol: "XAGUSD",
        displaySymbol: "XAGUSD",
        description: "Silver / US Dollar",
        assetClass: "METALS",
        digits: 3,
        tickSize: 0.001,
        currencyBase: "XAG",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8",
        strategyConfigured: true,
        availableStrategies: ["DGV8"],
        defaultStrategyId: "DGV8",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "USOIL",
        provider: "MT5",
        providerSymbol: "USOIL",
        canonicalSymbol: "USOIL",
        displaySymbol: "USOIL",
        description: "WTI Crude Oil",
        assetClass: "COMMODITIES",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "USD",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8",
        strategyConfigured: true,
        availableStrategies: ["DGV8"],
        defaultStrategyId: "DGV8",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "US100",
        provider: "MT5",
        providerSymbol: "USTEC",
        canonicalSymbol: "US100",
        displaySymbol: "US100",
        description: "NASDAQ 100 Index",
        assetClass: "INDICES",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "USD",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "BBB",
        strategyConfigured: true,
        availableStrategies: ["BBB"],
        defaultStrategyId: "BBB",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "US30",
        provider: "MT5",
        providerSymbol: "US30",
        canonicalSymbol: "US30",
        displaySymbol: "US30",
        description: "Dow Jones Industrial Average",
        assetClass: "INDICES",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "USD",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "BBB",
        strategyConfigured: true,
        availableStrategies: ["BBB"],
        defaultStrategyId: "BBB",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "US500",
        provider: "MT5",
        providerSymbol: "US500",
        canonicalSymbol: "US500",
        displaySymbol: "US500",
        description: "S&P 500 Index",
        assetClass: "INDICES",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "USD",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "BBB",
        strategyConfigured: true,
        availableStrategies: ["BBB"],
        defaultStrategyId: "BBB",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "GER40",
        provider: "MT5",
        providerSymbol: "GER40",
        canonicalSymbol: "GER40",
        displaySymbol: "GER40",
        description: "DAX 40 Germany Index",
        assetClass: "INDICES",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "EUR",
        currencyProfit: "EUR",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "BBB",
        strategyConfigured: true,
        availableStrategies: ["BBB"],
        defaultStrategyId: "BBB",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "UK100",
        provider: "MT5",
        providerSymbol: "UK100",
        canonicalSymbol: "UK100",
        displaySymbol: "UK100",
        description: "FTSE 100 UK Index",
        assetClass: "INDICES",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "GBP",
        currencyProfit: "GBP",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "BBB",
        strategyConfigured: true,
        availableStrategies: ["BBB"],
        defaultStrategyId: "BBB",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "JP225",
        provider: "MT5",
        providerSymbol: "JP225",
        canonicalSymbol: "JP225",
        displaySymbol: "JP225",
        description: "Nikkei 225 Japan Index",
        assetClass: "INDICES",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "JPY",
        currencyProfit: "JPY",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "BBB",
        strategyConfigured: true,
        availableStrategies: ["BBB"],
        defaultStrategyId: "BBB",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "EURUSD",
        provider: "MT5",
        providerSymbol: "EURUSD",
        canonicalSymbol: "EURUSD",
        displaySymbol: "EURUSD",
        description: "Euro / US Dollar",
        assetClass: "FOREX",
        digits: 5,
        tickSize: 0.00001,
        currencyBase: "EUR",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "GBPUSD",
        provider: "MT5",
        providerSymbol: "GBPUSD",
        canonicalSymbol: "GBPUSD",
        displaySymbol: "GBPUSD",
        description: "British Pound / US Dollar",
        assetClass: "FOREX",
        digits: 5,
        tickSize: 0.00001,
        currencyBase: "GBP",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "USDJPY",
        provider: "MT5",
        providerSymbol: "USDJPY",
        canonicalSymbol: "USDJPY",
        displaySymbol: "USDJPY",
        description: "US Dollar / Japanese Yen",
        assetClass: "FOREX",
        digits: 3,
        tickSize: 0.001,
        currencyBase: "USD",
        currencyProfit: "JPY",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "AUDUSD",
        provider: "MT5",
        providerSymbol: "AUDUSD",
        canonicalSymbol: "AUDUSD",
        displaySymbol: "AUDUSD",
        description: "Australian Dollar / US Dollar",
        assetClass: "FOREX",
        digits: 5,
        tickSize: 0.00001,
        currencyBase: "AUD",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "USDCAD",
        provider: "MT5",
        providerSymbol: "USDCAD",
        canonicalSymbol: "USDCAD",
        displaySymbol: "USDCAD",
        description: "US Dollar / Canadian Dollar",
        assetClass: "FOREX",
        digits: 5,
        tickSize: 0.00001,
        currencyBase: "USD",
        currencyProfit: "CAD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "USDCHF",
        provider: "MT5",
        providerSymbol: "USDCHF",
        canonicalSymbol: "USDCHF",
        displaySymbol: "USDCHF",
        description: "US Dollar / Swiss Franc",
        assetClass: "FOREX",
        digits: 5,
        tickSize: 0.00001,
        currencyBase: "USD",
        currencyProfit: "CHF",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "NZDUSD",
        provider: "MT5",
        providerSymbol: "NZDUSD",
        canonicalSymbol: "NZDUSD",
        displaySymbol: "NZDUSD",
        description: "New Zealand Dollar / US Dollar",
        assetClass: "FOREX",
        digits: 5,
        tickSize: 0.00001,
        currencyBase: "NZD",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "EURGBP",
        provider: "MT5",
        providerSymbol: "EURGBP",
        canonicalSymbol: "EURGBP",
        displaySymbol: "EURGBP",
        description: "Euro / British Pound",
        assetClass: "FOREX",
        digits: 5,
        tickSize: 0.00001,
        currencyBase: "EUR",
        currencyProfit: "GBP",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "EURJPY",
        provider: "MT5",
        providerSymbol: "EURJPY",
        canonicalSymbol: "EURJPY",
        displaySymbol: "EURJPY",
        description: "Euro / Japanese Yen",
        assetClass: "FOREX",
        digits: 3,
        tickSize: 0.001,
        currencyBase: "EUR",
        currencyProfit: "JPY",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "GBPJPY",
        provider: "MT5",
        providerSymbol: "GBPJPY",
        canonicalSymbol: "GBPJPY",
        displaySymbol: "GBPJPY",
        description: "British Pound / Japanese Yen",
        assetClass: "FOREX",
        digits: 3,
        tickSize: 0.001,
        currencyBase: "GBP",
        currencyProfit: "JPY",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "AUDJPY",
        provider: "MT5",
        providerSymbol: "AUDJPY",
        canonicalSymbol: "AUDJPY",
        displaySymbol: "AUDJPY",
        description: "Australian Dollar / Japanese Yen",
        assetClass: "FOREX",
        digits: 3,
        tickSize: 0.001,
        currencyBase: "AUD",
        currencyProfit: "JPY",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8_FX",
        strategyConfigured: true,
        availableStrategies: ["DGV8_FX", "BBB"],
        defaultStrategyId: "DGV8_FX",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "BTCUSD",
        provider: "MT5",
        providerSymbol: "BTCUSDT",
        canonicalSymbol: "BTCUSD",
        displaySymbol: "BTCUSD",
        description: "Bitcoin / US Dollar",
        assetClass: "CRYPTO",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "BTC",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8",
        strategyConfigured: true,
        availableStrategies: ["DGV8", "BBB"],
        defaultStrategyId: "DGV8",
        enabled: true,
        visibleToUsers: true,
      },
      {
        id: "ETHUSD",
        provider: "MT5",
        providerSymbol: "ETHUSDT",
        canonicalSymbol: "ETHUSD",
        displaySymbol: "ETHUSD",
        description: "Ethereum / US Dollar",
        assetClass: "CRYPTO",
        digits: 2,
        tickSize: 0.01,
        currencyBase: "ETH",
        currencyProfit: "USD",
        quoteAvailable: true,
        candlesAvailable: true,
        strategyId: "DGV8",
        strategyConfigured: true,
        availableStrategies: ["DGV8", "BBB"],
        defaultStrategyId: "DGV8",
        enabled: true,
        visibleToUsers: true,
      },
    ];

    for (const item of defaults) {
      this.catalog.set(item.canonicalSymbol.toUpperCase(), item);
    }
    addMt5WatchlistCatalogItems(this.catalog);
  }

  public getAll(): MarketCatalogItem[] {
    return Array.from(this.catalog.values());
  }

  public getEnabled(): MarketCatalogItem[] {
    return Array.from(this.catalog.values()).filter((i) => i.enabled);
  }

  public getVisible(): MarketCatalogItem[] {
    return Array.from(this.catalog.values()).filter((i) => i.enabled && i.visibleToUsers);
  }

  public get(symbolOrBrokerSymbol: string): MarketCatalogItem | null {
    if (!symbolOrBrokerSymbol) return null;
    const symUpper = symbolOrBrokerSymbol.toUpperCase();
    if (this.catalog.has(symUpper)) {
      return this.catalog.get(symUpper)!;
    }

    // Resolve via SymbolMapper
    const res = SymbolMapper.toCanonical(symbolOrBrokerSymbol);
    if (res.canonical && this.catalog.has(res.canonical)) {
      return this.catalog.get(res.canonical)!;
    }

    // Search by providerSymbol
    for (const item of this.catalog.values()) {
      if (item.providerSymbol.toUpperCase() === symUpper) {
        return item;
      }
    }
    return null;
  }

  public update(
    canonicalSymbol: string,
    patch: Partial<MarketCatalogItem>,
  ): MarketCatalogItem | null {
    const existing = this.get(canonicalSymbol);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.catalog.set(updated.canonicalSymbol.toUpperCase(), updated);
    return updated;
  }

  public updateAllowedStrategies(
    canonicalSymbol: string,
    strategies: string[],
  ): MarketCatalogItem | null {
    const existing = this.get(canonicalSymbol);
    if (!existing) return null;
    const allowed = [...new Set(strategies.map((strategy) => strategy.trim()).filter(Boolean))];
    return this.update(canonicalSymbol, {
      availableStrategies: allowed,
      ...(existing.defaultStrategyId && !allowed.includes(existing.defaultStrategyId)
        ? {
            defaultStrategyId: null,
            strategyId: null,
            strategyConfigured: false,
          }
        : {}),
    });
  }

  public syncDiscoveredSymbols(brokerSymbols: string[]) {
    if (!Array.isArray(brokerSymbols)) return;

    for (const brkSym of brokerSymbols) {
      if (!brkSym || typeof brkSym !== "string") continue;
      const cleanBrk = brkSym.trim();
      const exactSymbol = cleanBrk.toUpperCase();
      const watchlistSymbol = mt5WatchlistSymbolIdentity(cleanBrk);
      const exact = this.catalog.get(watchlistSymbol ?? exactSymbol);
      if (exact && (watchlistSymbol || exact.canonicalSymbol.toUpperCase() === exactSymbol)) {
        exact.providerSymbol = cleanBrk;
        exact.quoteAvailable = true;
        exact.candlesAvailable = true;
        continue;
      }
      const res = SymbolMapper.toCanonical(cleanBrk);

      if (res.canonical) {
        SymbolMapper.registerBrokerMapping(res.canonical, cleanBrk);
        const existing = this.catalog.get(res.canonical);
        if (existing) {
          existing.providerSymbol = cleanBrk;
          existing.quoteAvailable = true;
          existing.candlesAvailable = true;
        }
      }
    }
  }

  public syncBrokerSpecifications(specifications: BrokerSymbolSpecification[]): number {
    if (!Array.isArray(specifications)) return 0;

    let accepted = 0;
    for (const specification of specifications) {
      if (!specification?.brokerSymbol || typeof specification.brokerSymbol !== "string") continue;
      const exactSymbol = specification.brokerSymbol.trim().toUpperCase();
      const watchlistSymbol = mt5WatchlistSymbolIdentity(specification.brokerSymbol);
      const exact = this.catalog.get(watchlistSymbol ?? exactSymbol);
      const resolvedSymbol =
        watchlistSymbol ??
        (exact?.canonicalSymbol.toUpperCase() === exactSymbol
          ? exactSymbol
          : SymbolMapper.toCanonical(specification.brokerSymbol).canonical);
      if (!resolvedSymbol) continue;
      const existing = this.catalog.get(resolvedSymbol);
      if (!existing) continue;

      existing.providerSymbol = specification.brokerSymbol;
      existing.brokerSpec = {
        ...specification,
        brokerSymbol: specification.brokerSymbol.trim(),
        receivedAt: Number.isFinite(specification.receivedAt)
          ? specification.receivedAt
          : Date.now(),
      };
      const mapperSymbol = watchlistSymbol
        ? null
        : SymbolMapper.toCanonical(specification.brokerSymbol).canonical;
      if (mapperSymbol === resolvedSymbol) {
        SymbolMapper.registerBrokerMapping(mapperSymbol, existing.providerSymbol);
      }
      accepted += 1;
    }
    return accepted;
  }

  public getCurrentBrokerTradingSessions(
    canonicalSymbol: string,
    brokerSymbol: string,
    nowMs = Date.now(),
  ): BrokerTradingSessionSchedule | null {
    const specification = this.get(canonicalSymbol)?.brokerSpec;
    const schedule = specification?.tradingSessions;
    if (!specification || !schedule || !brokerSymbol) return null;
    if (specification.brokerSymbol.toUpperCase() !== brokerSymbol.trim().toUpperCase()) return null;
    if (
      !Number.isFinite(specification.receivedAt) ||
      specification.receivedAt > nowMs ||
      nowMs - specification.receivedAt > 180_000
    )
      return null;
    if (
      schedule.source !== "MT5_SYMBOL_INFO_SESSION_TRADE" ||
      !Number.isSafeInteger(schedule.serverTime) ||
      !Number.isSafeInteger(schedule.utcTime) ||
      schedule.serverTime <= 0 ||
      schedule.utcTime <= 0 ||
      schedule.serverTime - schedule.utcTime !== schedule.serverUtcOffsetSeconds ||
      schedule.serverUtcOffsetSeconds !== mt5ServerUtcOffsetSeconds(schedule.utcTime) ||
      Math.abs(schedule.utcTime * 1000 - specification.receivedAt) > 120_000
    )
      return null;
    if (
      !Array.isArray(schedule.sessions) ||
      schedule.sessions.length === 0 ||
      schedule.sessions.length > 84
    )
      return null;

    const seen = new Set<string>();
    for (const session of schedule.sessions) {
      if (
        !Number.isInteger(session.dayOfWeek) ||
        session.dayOfWeek < 0 ||
        session.dayOfWeek > 6 ||
        !Number.isInteger(session.fromSeconds) ||
        session.fromSeconds < 0 ||
        session.fromSeconds >= 86_400 ||
        !Number.isInteger(session.toSeconds) ||
        session.toSeconds < 0 ||
        session.toSeconds > 86_400 ||
        session.fromSeconds === session.toSeconds
      )
        return null;
      const key = `${session.dayOfWeek}:${session.fromSeconds}:${session.toSeconds}`;
      if (seen.has(key)) return null;
      seen.add(key);
    }
    return schedule;
  }

  public clearBrokerSpecifications(): void {
    for (const item of this.catalog.values()) {
      delete item.brokerSpec;
    }
  }
}

export const marketCatalog = MarketCatalog.getInstance();
