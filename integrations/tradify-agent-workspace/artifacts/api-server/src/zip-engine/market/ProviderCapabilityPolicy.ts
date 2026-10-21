import { CANONICAL_SYMBOLS, CANONICAL_METADATA, type CanonicalSymbol } from "./SymbolMapper";
import { marketCatalog } from "./MarketCatalog";
import { mt5ChartCandleFreshnessWindowMs } from "./CandleTime";
import type { InstrumentClass } from "./FallbackMap";
import type {
  MarketDataContext,
  ProviderApproval,
  ProviderHealthSnapshot,
  ProviderRole,
} from "./types";
import type { ProviderQualityReport } from "./ProviderQuality";
import type {
  ProviderSeriesReadinessState,
  ProviderSeriesReadinessStore,
} from "./ProviderSeriesReadiness";

export type CapabilityUsage = "AUTHORITY" | "SHADOW" | "REFERENCE" | "HISTORICAL_ONLY";
export type EntitlementState = "VERIFIED" | "PLAN_RESTRICTED" | "UNAVAILABLE" | "UNVERIFIED";
export type CapabilityQualityState = "VERIFIED" | "PENDING" | "INVALID";
export type StructuralSuitabilityState = "SUITABLE" | "NOT_REQUIRED" | "PENDING" | "UNSUITABLE";
export type CapabilityPriceBasis = "USD" | "USDT" | "BROKER";

export interface ProviderCapability {
  providerId: string;
  canonicalSymbol: string;
  providerSymbol: string;
  instrumentClass: InstrumentClass;
  priceBasis?: CapabilityPriceBasis;
  timeframe: string;
  nativeM15: boolean;
  entitlement: EntitlementState;
  approval: ProviderApproval;
  allowedUsages: CapabilityUsage[];
  freshnessThresholdMs: number;
  minimumHistory: number;
  requiresFullSynchronization: boolean;
  qualityState: CapabilityQualityState;
  structuralSuitability: StructuralSuitabilityState;
  technicalCapability: boolean;
  authorityEligibilityReason?: string;
}

export interface CapabilityEvaluation {
  eligible: boolean;
  capability?: ProviderCapability;
  readiness?: ProviderSeriesReadinessState;
  reasons: string[];
}

function instrumentClassFor(canonicalSymbol: string): InstrumentClass | undefined {
  const item = marketCatalog.get(canonicalSymbol);
  if (!item) return undefined;
  if (item.assetClass === "CRYPTO") return "CRYPTO_SPOT";
  if (item.assetClass === "INDICES") return "INDEX_CASH";
  return "SPOT";
}

function canonicalProviderSymbol(symbol: CanonicalSymbol): string {
  return marketCatalog.get(symbol)?.providerSymbol ?? symbol;
}

function m15Capability(
  providerId: string,
  canonicalSymbol: CanonicalSymbol,
  providerSymbol: string,
  options: Partial<ProviderCapability> = {},
): ProviderCapability {
  return {
    providerId,
    canonicalSymbol,
    providerSymbol,
    instrumentClass: instrumentClassFor(canonicalSymbol) ?? "SPOT",
    timeframe: "M15",
    nativeM15: true,
    entitlement: "VERIFIED",
    approval: "NOT_APPROVED",
    allowedUsages: ["SHADOW", "REFERENCE"],
    freshnessThresholdMs: 30 * 60_000,
    minimumHistory: 50,
    requiresFullSynchronization: true,
    qualityState: "VERIFIED",
    structuralSuitability: "NOT_REQUIRED",
    technicalCapability: true,
    ...options,
  };
}

function historicalCapability(
  providerId: string,
  canonicalSymbol: CanonicalSymbol,
  providerSymbol: string,
  options: Partial<ProviderCapability> = {},
): ProviderCapability {
  return {
    providerId,
    canonicalSymbol,
    providerSymbol,
    instrumentClass: instrumentClassFor(canonicalSymbol) ?? "SPOT",
    timeframe: "D1",
    nativeM15: false,
    entitlement: "VERIFIED",
    approval: "NOT_APPROVED",
    allowedUsages: ["REFERENCE", "HISTORICAL_ONLY"],
    freshnessThresholdMs: 3 * 24 * 60 * 60_000,
    minimumHistory: 1,
    requiresFullSynchronization: false,
    qualityState: "VERIFIED",
    structuralSuitability: "NOT_REQUIRED",
    technicalCapability: false,
    ...options,
  };
}

function initialCapabilities(): ProviderCapability[] {
  const capabilities: ProviderCapability[] = CANONICAL_SYMBOLS.flatMap((symbol) => {
    const providerSymbol = canonicalProviderSymbol(symbol);
    const m15 = m15Capability("PRIMARY_MT5", symbol, providerSymbol, {
      approval: "APPROVED",
      allowedUsages: ["AUTHORITY"],
      priceBasis: "BROKER",
      qualityState: "VERIFIED",
    });
    const chartTimeframes = ["M1", "M5", "M30", "H1", "H4", "D1", "W1", "MN1"];
    const nonStrategyChartCapabilities = chartTimeframes.map((timeframe) => ({
      ...m15,
      timeframe,
      nativeM15: false,
      freshnessThresholdMs: mt5ChartCandleFreshnessWindowMs(timeframe),
      requiresFullSynchronization: false,
    }));
    return [m15, ...nonStrategyChartCapabilities];
  });

  const twelveSymbols: Partial<Record<CanonicalSymbol, string>> = {
    EURUSD: "EUR/USD",
    GBPUSD: "GBP/USD",
    USDJPY: "USD/JPY",
    AUDUSD: "AUD/USD",
    USDCAD: "USD/CAD",
    USDCHF: "USD/CHF",
    NZDUSD: "NZD/USD",
    EURGBP: "EUR/GBP",
    EURJPY: "EUR/JPY",
    GBPJPY: "GBP/JPY",
    AUDJPY: "AUD/JPY",
    XAUUSD: "XAU/USD",
    BTCUSD: "BTC/USD",
    ETHUSD: "ETH/USD",
  };
  for (const [symbol, providerSymbol] of Object.entries(twelveSymbols)) {
    capabilities.push(
      m15Capability("TWELVE_DATA", symbol as CanonicalSymbol, providerSymbol!, {
        priceBasis: symbol === "BTCUSD" || symbol === "ETHUSD" ? "USD" : undefined,
        approval: "NOT_APPROVED",
        allowedUsages: ["SHADOW", "REFERENCE"],
        authorityEligibilityReason: "ENTITLEMENT_CAPACITY_INSUFFICIENT",
      }),
    );
  }

  for (const [providerId, symbols] of [
    ["SHADOW_BINANCE", { BTCUSD: "BTCUSDT", ETHUSD: "ETHUSDT" }],
    ["SHADOW_COINBASE", { BTCUSD: "BTC-USD", ETHUSD: "ETH-USD" }],
  ] as const) {
    for (const [symbol, providerSymbol] of Object.entries(symbols)) {
      capabilities.push(
        m15Capability(providerId, symbol as CanonicalSymbol, providerSymbol, {
          priceBasis: providerId === "SHADOW_BINANCE" ? "USDT" : "USD",
          approval: "APPROVED",
          allowedUsages: ["AUTHORITY"],
        }),
      );
    }
  }

  const massiveSymbols: Partial<Record<CanonicalSymbol, string>> = {
    EURUSD: "C:EURUSD",
    GBPUSD: "C:GBPUSD",
    USDJPY: "C:USDJPY",
    AUDUSD: "C:AUDUSD",
    USDCAD: "C:USDCAD",
    USDCHF: "C:USDCHF",
    NZDUSD: "C:NZDUSD",
    EURGBP: "C:EURGBP",
    EURJPY: "C:EURJPY",
    GBPJPY: "C:GBPJPY",
    AUDJPY: "C:AUDJPY",
    BTCUSD: "X:BTCUSD",
    ETHUSD: "X:ETHUSD",
  };
  for (const [symbol, providerSymbol] of Object.entries(massiveSymbols)) {
    capabilities.push(
      historicalCapability("MASSIVE", symbol as CanonicalSymbol, providerSymbol!, {
        priceBasis: symbol === "BTCUSD" || symbol === "ETHUSD" ? "USD" : undefined,
      }),
    );
  }

  const eodhdSymbols: Partial<Record<CanonicalSymbol, string>> = {
    XAUUSD: "XAUUSD.FOREX",
    XAGUSD: "XAGUSD.FOREX",
    USOIL: "WTI",
    US100: "NDX.INDX",
    US30: "DJI.INDX",
    US500: "GSPC.INDX",
    GER40: "GDAXI.INDX",
    JP225: "N225.INDX",
    EURUSD: "EURUSD.FOREX",
    GBPUSD: "GBPUSD.FOREX",
    USDJPY: "USDJPY.FOREX",
    AUDUSD: "AUDUSD.FOREX",
    USDCAD: "USDCAD.FOREX",
    USDCHF: "USDCHF.FOREX",
    NZDUSD: "NZDUSD.FOREX",
    EURGBP: "EURGBP.FOREX",
    EURJPY: "EURJPY.FOREX",
    GBPJPY: "GBPJPY.FOREX",
    AUDJPY: "AUDJPY.FOREX",
    BTCUSD: "BTC-USD.CC",
    ETHUSD: "ETH-USD.CC",
  };
  for (const [symbol, providerSymbol] of Object.entries(eodhdSymbols)) {
    capabilities.push(historicalCapability("EODHD", symbol as CanonicalSymbol, providerSymbol!));
  }

  for (const symbol of ["XAUUSD", "XAGUSD"] as const) {
    capabilities.push({
      ...historicalCapability("ALPHA_VANTAGE", symbol, symbol === "XAUUSD" ? "XAUUSD" : "XAGUSD", {
        timeframe: "QUOTE",
        nativeM15: false,
        allowedUsages: ["REFERENCE"],
        freshnessThresholdMs: 10 * 60_000,
      }),
      instrumentClass: "SPOT",
    });
  }

  return capabilities;
}

export class ProviderCapabilityPolicy {
  private readonly capabilities = new Map<string, ProviderCapability>();

  public constructor(records: ProviderCapability[] = initialCapabilities()) {
    records.forEach((record) => this.set(record));
  }

  private key(providerId: string, canonicalSymbol: string, timeframe: string): string {
    return `${providerId}:${canonicalSymbol.toUpperCase()}:${timeframe.toUpperCase()}`;
  }

  public set(capability: ProviderCapability): void {
    this.capabilities.set(
      this.key(capability.providerId, capability.canonicalSymbol, capability.timeframe),
      capability,
    );
  }

  public get(
    providerId: string,
    canonicalSymbol: string,
    timeframe: string,
  ): ProviderCapability | undefined {
    return this.capabilities.get(this.key(providerId, canonicalSymbol, timeframe));
  }

  public list(): ProviderCapability[] {
    return [...this.capabilities.values()];
  }

  public evaluateAuthority(
    providerId: string,
    canonicalSymbol: string,
    timeframe: string,
    registration: { role: ProviderRole; approval: ProviderApproval },
    providerHealth: ProviderHealthSnapshot,
    quality: ProviderQualityReport,
    readinessStore: ProviderSeriesReadinessStore,
    providerInstrumentClass?: string,
    providerPriceBasis?: string,
    purpose?: MarketDataContext["purpose"],
  ): CapabilityEvaluation {
    const capability = this.get(providerId, canonicalSymbol, timeframe);
    const reasons: string[] = [];
    if (!capability) {
      return {
        eligible: false,
        reasons: ["No capability record exists for this provider, symbol, and timeframe."],
      };
    }

    const readiness = readinessStore.get(providerId, canonicalSymbol, timeframe);
    const expectedClass = instrumentClassFor(canonicalSymbol);
    const observedClass = providerInstrumentClass?.toUpperCase();
    const normalizedObservedClass =
      observedClass === "FOREX" || observedClass === "METALS" || observedClass === "COMMODITIES"
        ? "SPOT"
        : observedClass === "INDICES"
          ? "INDEX_CASH"
          : observedClass;

    if (registration.role !== "PRIMARY" && registration.role !== "ALTERNATE")
      reasons.push("Provider role is not authority-eligible.");
    if (registration.approval !== "APPROVED" || capability.approval !== "APPROVED")
      reasons.push("Provider or symbol capability is not approved.");
    if (!capability.allowedUsages.includes("AUTHORITY"))
      reasons.push("Capability does not allow AUTHORITY usage.");
    if (capability.entitlement !== "VERIFIED")
      reasons.push(`Entitlement state is ${capability.entitlement}.`);
    if (!capability.nativeM15 && timeframe.toUpperCase() === "M15")
      reasons.push("Native M15 capability is not verified.");
    if (expectedClass && capability.instrumentClass !== expectedClass)
      reasons.push("Capability instrument class does not match the canonical instrument.");
    if (normalizedObservedClass && capability.instrumentClass !== normalizedObservedClass)
      reasons.push("Provider response instrument class does not match the capability.");
    if (capability.priceBasis && !providerPriceBasis)
      reasons.push("Provider response did not declare the required price basis.");
    if (capability.priceBasis && providerPriceBasis && capability.priceBasis !== providerPriceBasis)
      reasons.push("Provider response price basis does not match the capability.");
    // QUOTE authority is deliberately independent of M15 history. Strategy
    // and candle authority retain the strict history/readiness requirements.
    if (purpose !== "QUOTE" && (quality.closedCandleCount ?? 0) < capability.minimumHistory) {
      reasons.push(`Closed history is below the ${capability.minimumHistory}-candle minimum.`);
    }
    if (
      quality.health === "HEALTHY" &&
      quality.metrics?.sourceAgeMs !== undefined &&
      quality.metrics.sourceAgeMs > capability.freshnessThresholdMs
    ) {
      reasons.push("Provider source age exceeds the capability freshness threshold.");
    }
    if (capability.qualityState === "INVALID") reasons.push("Capability quality state is INVALID.");
    if (!["SUITABLE", "NOT_REQUIRED"].includes(capability.structuralSuitability))
      reasons.push("Structural suitability is not approved.");
    if (providerHealth.health !== "HEALTHY")
      reasons.push(`Provider health is ${providerHealth.health}.`);
    const requiresFullSynchronization =
      capability.requiresFullSynchronization && purpose === "STRATEGY";
    if (
      purpose !== "QUOTE" &&
      (!quality.seriesReadiness || !readinessStore.isReady(readiness, requiresFullSynchronization))
    ) {
      reasons.push("Provider series readiness is incomplete.");
    }

    return {
      eligible: reasons.length === 0,
      capability,
      readiness,
      reasons,
    };
  }
}

export const marketDataCapabilityPolicy = new ProviderCapabilityPolicy();
