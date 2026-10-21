import assert from "node:assert/strict";
import type {
  CandleResponse,
  IMarketDataProvider,
  MarketDataContext,
  ProviderHealthSnapshot,
  QuoteData,
} from "./types";
import { ProviderRegistry } from "./ProviderRegistry";
import { ProviderCapabilityPolicy } from "./ProviderCapabilityPolicy";

const now = Date.now();
const candles = Array.from({ length: 80 }, (_, index) => ({
  time: Math.floor((now / 1000 - (80 - index) * 900) / 900) * 900,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100.5 + index,
  volume: 10,
}));

function fakeProvider(name: string, health: () => ProviderHealthSnapshot): IMarketDataProvider {
  return {
    name,
    supportsSymbol: () => true,
    getQuote: async (): Promise<QuoteData | null> => null,
    getCandles: async (symbol, timeframe): Promise<CandleResponse> => ({
      symbol,
      provider: name,
      providerSymbol: symbol,
      instrumentType: "FOREX",
      priceBasis: "BROKER",
      timeframe,
      timezone: "UTC",
      candles,
      dataState: "LIVE",
    }),
    getHealth: async () => ({
      ...health(),
      seriesReadiness: {
        providerId: name,
        canonicalSymbol: "EURUSD",
        timeframe: "M15",
        enoughHistoryLoaded: true,
        latestRequiredClosedBarPresent: true,
        continuityValid: true,
        fullSynchronizationComplete: true,
        freshnessValid: true,
        observedAt: Date.now(),
      },
    }),
  };
}

const context: MarketDataContext = {
  canonicalSymbol: "EURUSD",
  timeframe: "M15",
  strategyId: "DGV8_FX",
  purpose: "STRATEGY",
};

async function run() {
  let primaryHealthy = true;
  const transitions: string[] = [];
  const capabilityPolicy = new ProviderCapabilityPolicy();
  const primaryCapability = capabilityPolicy.get("PRIMARY_MT5", "EURUSD", "M15");
  assert.ok(primaryCapability);
  capabilityPolicy.set({
    ...primaryCapability,
    providerId: "ALTERNATE_TEST",
    approval: "APPROVED",
    allowedUsages: ["AUTHORITY"],
    structuralSuitability: "SUITABLE",
  });
  const registry = new ProviderRegistry(
    { failoverAfterMs: 100, alternateStableMs: 100, primaryRecoveryMs: 300 },
    async (_context, previous, decision) => {
      transitions.push(
        `${previous ?? "NONE"}>${decision.selectedProviderId ?? "NONE"}:${decision.reason}`,
      );
    },
    async () => null,
    async () => undefined,
    capabilityPolicy,
  );
  registry.register({
    id: "PRIMARY_MT5",
    displayName: "MT5",
    provider: fakeProvider("MT5", () => ({
      health: primaryHealthy ? "HEALTHY" : "UNAVAILABLE",
      reasons: [],
      observedAt: Date.now(),
    })),
    role: "PRIMARY",
    approval: "APPROVED",
    priority: 0,
    enabled: true,
  });
  registry.register({
    id: "ALTERNATE_TEST",
    displayName: "Alternate",
    provider: fakeProvider("ALTERNATE", () => ({
      health: "HEALTHY",
      reasons: [],
      observedAt: Date.now(),
    })),
    role: "ALTERNATE",
    approval: "APPROVED",
    priority: 10,
    enabled: true,
  });

  const initial = await registry.resolveAuthority(context, 0);
  assert.equal(initial.selectedProviderId, "PRIMARY_MT5");
  const flicker = await registry.resolveAuthority(context, 50);
  assert.equal(flicker.selectedProviderId, "PRIMARY_MT5");

  primaryHealthy = false;
  const unhealthy = await registry.resolveAuthority(context, 100);
  assert.equal(unhealthy.selectedProviderId, "PRIMARY_MT5");
  const alternateStable = await registry.resolveAuthority(context, 199);
  assert.equal(alternateStable.selectedProviderId, "PRIMARY_MT5");
  const failedOver = await registry.resolveAuthority(context, 201);
  assert.equal(failedOver.selectedProviderId, "ALTERNATE_TEST");

  primaryHealthy = true;
  const recoveredBriefly = await registry.resolveAuthority(context, 250);
  assert.equal(recoveredBriefly.selectedProviderId, "ALTERNATE_TEST");
  const restored = await registry.resolveAuthority(context, 551);
  assert.equal(restored.selectedProviderId, "PRIMARY_MT5");
  assert.equal(transitions.length, 3);
  assert.match(transitions[1], /SUSTAINED_UNHEALTHY/);
  assert.match(transitions[2], /PRIMARY_RECOVERY/);

  {
    const policy = new ProviderCapabilityPolicy();
    const primaryCapability = policy.get("PRIMARY_MT5", "EURUSD", "M15");
    assert.ok(primaryCapability);
    policy.set({
      ...primaryCapability,
      providerId: "UNAPPROVED_QUOTE",
      approval: "NOT_APPROVED",
      allowedUsages: ["AUTHORITY"],
    });
    policy.set({
      ...primaryCapability,
      providerId: "NULL_QUOTE",
      approval: "APPROVED",
      allowedUsages: ["AUTHORITY"],
    });
    const authorityKeys: string[] = [];
    const quoteTimestamp = new Date().toISOString();
    const incompleteCandles = candles.slice(-2);
    const registry = new ProviderRegistry(
      { failoverAfterMs: 100, alternateStableMs: 100, primaryRecoveryMs: 300 },
      async (context, _previous, decision) => {
        authorityKeys.push(`${context.purpose ?? "UNSPECIFIED"}:${decision.contextKey}`);
      },
      async (key) => {
        authorityKeys.push(`LOAD:${key}`);
        return null;
      },
      async () => undefined,
      policy,
    );
    registry.register({
      id: "PRIMARY_MT5",
      displayName: "MT5",
      provider: {
        name: "MT5",
        supportsSymbol: () => true,
        getQuote: async (symbol, providerSymbol): Promise<QuoteData> => ({
          symbol,
          provider: "MT5",
          providerSymbol: providerSymbol ?? symbol,
          instrumentType: "FOREX",
          priceBasis: "BROKER",
          price: 100,
          bid: 99.9,
          ask: 100.1,
          last: 100,
          strategyPrice: 99.9,
          displayPrice: 99.9,
          timestamp: quoteTimestamp,
          receivedAt: quoteTimestamp,
          status: "LIVE",
          dataState: "LIVE",
        }),
        getCandles: async (symbol, timeframe): Promise<CandleResponse> => ({
          symbol,
          provider: "MT5",
          providerSymbol: symbol,
          instrumentType: "FOREX",
          priceBasis: "BROKER",
          timeframe,
          timezone: "UTC",
          candles: incompleteCandles,
          dataState: "LIVE",
        }),
        getHealth: async (context): Promise<ProviderHealthSnapshot> => ({
          health: "HEALTHY",
          reasons: [],
          observedAt: Date.now(),
          ...(context.purpose === "STRATEGY"
            ? {
                seriesReadiness: {
                  providerId: "PRIMARY_MT5",
                  canonicalSymbol: "EURUSD",
                  timeframe: "M15",
                  enoughHistoryLoaded: false,
                  latestRequiredClosedBarPresent: true,
                  continuityValid: true,
                  fullSynchronizationComplete: false,
                  freshnessValid: true,
                  observedAt: Date.now(),
                },
              }
            : {}),
        }),
      },
      role: "PRIMARY",
      approval: "APPROVED",
      priority: 0,
      enabled: true,
    });
    const primaryProvider = registry.getRegistration("PRIMARY_MT5")!.provider;
    registry.register({
      id: "NULL_QUOTE",
      displayName: "Null quote feed",
      provider: {
        ...primaryProvider,
        getQuote: async () => null,
      },
      role: "ALTERNATE",
      approval: "APPROVED",
      priority: 1,
      enabled: true,
    });
    registry.register({
      id: "UNAPPROVED_QUOTE",
      displayName: "Unapproved quote feed",
      provider: primaryProvider,
      role: "ALTERNATE",
      approval: "NOT_APPROVED",
      priority: 1,
      enabled: true,
    });

    const quoteContext: MarketDataContext = {
      ...context,
      purpose: "QUOTE",
    };
    const quoteAuthority = await registry.resolveAuthority(quoteContext, 0);
    assert.equal(
      quoteAuthority.selectedProviderId,
      "PRIMARY_MT5",
      "an approved live quote must remain available while M15 history is incomplete",
    );
    assert.equal(
      quoteAuthority.candidates.find((candidate) => candidate.providerId === "UNAPPROVED_QUOTE")
        ?.eligible,
      false,
      "unapproved providers must not become quote authority",
    );
    assert.equal(
      quoteAuthority.candidates.find((candidate) => candidate.providerId === "NULL_QUOTE")
        ?.eligible,
      false,
      "a null quote response must not become quote authority",
    );
    assert.match(quoteAuthority.contextKey, /:QUOTE$/);
    const quote = await registry.getQuote("PRIMARY_MT5", quoteContext);
    assert.equal(quote?.status, "LIVE");

    const strategyAuthority = await registry.resolveAuthority(context, 0);
    assert.equal(
      strategyAuthority.selectedProviderId,
      null,
      "incomplete M15 history must continue blocking strategy authority",
    );
    assert.equal(strategyAuthority.contextKey, "EURUSD:M15:DGV8_FX");
    assert.ok(authorityKeys.some((key) => key.startsWith("LOAD:EURUSD:M15:DGV8_FX:QUOTE")));
    assert.ok(authorityKeys.some((key) => key.startsWith("LOAD:EURUSD:M15:DGV8_FX")));
    assert.ok(!authorityKeys.some((key) => key.includes("STRATEGY:EURUSD:M15:DGV8_FX:QUOTE")));
  }
}

await run();
console.log(
  "Provider registry checks passed: approval, quote isolation, health, hysteresis, failover, and recovery stability.",
);
