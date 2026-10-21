import type {
  Candle,
  CandleResponse,
  IMarketDataProvider,
  MarketDataContext,
  ProviderHealthSnapshot,
  QuoteData,
} from "../types";
import { marketCatalog } from "../MarketCatalog";
import { mt5ChartCandleFreshnessWindowMs, timeframeDurationSeconds } from "../CandleTime";
import { mt5BridgeStore } from "./MT5BridgeStore";

export class MT5ProviderAdapter implements IMarketDataProvider {
  public readonly name = "MT5";

  constructor(private readonly bridgeStore = mt5BridgeStore) {}

  private resolveProviderSymbol(canonicalSymbol: string, overrideProviderSymbol?: string): string {
    const mappedBrokerSymbol = this.bridgeStore.getMappings()[canonicalSymbol];
    const catalogProviderSymbol =
      marketCatalog.get(canonicalSymbol)?.providerSymbol ?? canonicalSymbol;
    if (
      mappedBrokerSymbol &&
      (!overrideProviderSymbol ||
        overrideProviderSymbol === canonicalSymbol ||
        overrideProviderSymbol === catalogProviderSymbol)
    ) {
      return mappedBrokerSymbol;
    }
    return overrideProviderSymbol ?? mappedBrokerSymbol ?? canonicalSymbol;
  }

  public supportsSymbol(symbol: string): boolean {
    return Boolean(marketCatalog.get(symbol));
  }

  public async getQuote(
    symbol: string,
    overrideProviderSymbol?: string,
  ): Promise<QuoteData | null> {
    await this.bridgeStore.hydrateFromPersistence();
    const providerSymbol = this.resolveProviderSymbol(symbol, overrideProviderSymbol);
    const quote = await this.bridgeStore.getQuoteForBrokerSymbolPersisted(providerSymbol);
    if (!quote) return null;
    return {
      symbol,
      provider: this.name,
      providerSymbol: quote.symbol,
      instrumentType: marketCatalog.get(symbol)?.assetClass ?? "UNKNOWN",
      priceBasis: "BROKER",
      price: quote.strategyPrice,
      bid: quote.bid,
      ask: quote.ask,
      last: quote.last,
      mid: quote.mid,
      chartMode: quote.chartMode,
      strategyPrice: quote.strategyPrice,
      displayPrice: quote.displayPrice,
      change: quote.change,
      changePercent: quote.changePercent,
      timestamp: new Date(quote.time * 1000).toISOString(),
      receivedAt: new Date(quote.receivedAt).toISOString(),
      status: "LIVE",
      dataState: "LIVE",
    };
  }

  public async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
    overrideProviderSymbol?: string,
  ): Promise<CandleResponse | null> {
    await this.bridgeStore.hydrateFromPersistence();
    const providerSymbol = this.resolveProviderSymbol(symbol, overrideProviderSymbol);
    const candles = await this.bridgeStore.getCandlesForBrokerSymbolPersisted(
      providerSymbol,
      timeframe,
    );
    if (!candles?.length) return null;
    const fresh = this.bridgeStore.isCandleFresh(
      providerSymbol,
      timeframe,
      mt5ChartCandleFreshnessWindowMs(timeframe),
    );
    return {
      symbol,
      provider: this.name,
      providerSymbol,
      instrumentType: marketCatalog.get(symbol)?.assetClass ?? "UNKNOWN",
      priceBasis: "BROKER",
      timeframe: timeframe.toUpperCase(),
      timezone: "UTC",
      candles: candles.slice(-limit),
      lastUpdated: candles.at(-1)?.time,
      freshness: fresh ? "LIVE" : "STALE",
      dataState: fresh ? "LIVE" : "STALE",
    };
  }

  public async getHealth(context: MarketDataContext): Promise<ProviderHealthSnapshot> {
    await this.bridgeStore.hydrateFromPersistence();
    const status = this.bridgeStore.getStatus();
    const providerSymbol = status.mappings[context.canonicalSymbol] ?? context.canonicalSymbol;
    const reasons: string[] = [];
    const checks: NonNullable<ProviderHealthSnapshot["checks"]> = [];
    const readiness = (
      candles: Candle[] | undefined,
      freshnessValid: boolean,
    ): ProviderHealthSnapshot["seriesReadiness"] => {
      const intervalSeconds = timeframeDurationSeconds(context.timeframe);
      const latestClosed =
        intervalSeconds > 0
          ? [...(candles ?? [])]
              .reverse()
              .find((candle) => candle.time <= Math.floor(Date.now() / 1000) - intervalSeconds)
          : undefined;
      const latestRequiredClosedBarPresent = Boolean(latestClosed);
      return {
        providerId: "PRIMARY_MT5",
        canonicalSymbol: context.canonicalSymbol,
        timeframe: context.timeframe.toUpperCase(),
        enoughHistoryLoaded: (candles?.length ?? 0) >= 50,
        latestRequiredClosedBarPresent,
        continuityValid: (candles?.length ?? 0) > 1,
        fullSynchronizationComplete: this.bridgeStore.isBackfillCompleted(),
        freshnessValid,
        observedAt: Date.now(),
      };
    };
    if (!status.connected) {
      reasons.push(...status.healthReasons);
      return {
        health: status.lastHeartbeat > 0 ? "STALE" : "UNAVAILABLE",
        reasons,
        observedAt: Date.now(),
        checks,
        seriesReadiness: readiness(undefined, false),
      };
    }
    if (
      !status.availableSymbols.some(
        (symbol) => symbol.toUpperCase() === providerSymbol.toUpperCase(),
      ) &&
      status.availableSymbols.length > 0
    ) {
      reasons.push(`Provider symbol ${providerSymbol} is not available.`);
      return {
        health: "UNAVAILABLE",
        reasons,
        observedAt: Date.now(),
        checks,
        seriesReadiness: readiness(undefined, false),
      };
    }
    if (context.purpose === "QUOTE") {
      if (!this.bridgeStore.isQuoteFresh(providerSymbol, 30_000)) {
        reasons.push(`Quote ${providerSymbol} is not fresh.`);
        return { health: "STALE", reasons, observedAt: Date.now(), checks };
      }
    } else {
      const candles = await this.bridgeStore.getCandlesForBrokerSymbolPersisted(
        providerSymbol,
        context.timeframe,
      );
      if (!candles?.length) {
        reasons.push(`No ${context.timeframe} candles are available for ${providerSymbol}.`);
        return {
          health: "DEGRADED",
          reasons,
          observedAt: Date.now(),
          checks,
          seriesReadiness: readiness(candles ?? undefined, false),
        };
      }
      const freshnessWindow = mt5ChartCandleFreshnessWindowMs(context.timeframe);
      const fresh = this.bridgeStore.isCandleFresh(
        providerSymbol,
        context.timeframe,
        freshnessWindow,
      );
      if (!fresh) {
        reasons.push(`The latest ${context.timeframe} candle is stale.`);
        return {
          health: "STALE",
          reasons,
          observedAt: Date.now(),
          checks,
          seriesReadiness: readiness(candles, false),
        };
      }
    }
    if (
      context.purpose === "STRATEGY" &&
      context.timeframe.toUpperCase() === "M15" &&
      !this.bridgeStore.isBackfillCompleted()
    ) {
      const reason = "Full M15 synchronization is required for every active strategy symbol.";
      reasons.push(reason);
      checks.push({
        name: "M15_FULL_SYNC",
        passed: false,
        observedAt: Date.now(),
        reason,
      });
      return {
        health: "DEGRADED",
        reasons,
        observedAt: Date.now(),
        checks,
        seriesReadiness: readiness(
          (await this.bridgeStore.getCandlesForBrokerSymbolPersisted(
            providerSymbol,
            context.timeframe,
          )) ?? undefined,
          false,
        ),
      };
    }
    return {
      health: "HEALTHY",
      reasons: ["MT5 bridge is connected and the requested market data is available."],
      observedAt: Date.now(),
      checks,
      seriesReadiness: readiness(
        (await this.bridgeStore.getCandlesForBrokerSymbolPersisted(
          providerSymbol,
          context.timeframe,
        )) ?? undefined,
        true,
      ),
    };
  }
}

export const mt5ProviderAdapter = new MT5ProviderAdapter();
