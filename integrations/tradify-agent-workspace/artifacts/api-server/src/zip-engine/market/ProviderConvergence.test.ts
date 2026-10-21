import assert from "node:assert/strict";
import type {
  CandleResponse,
  IMarketDataProvider,
  MarketDataContext,
  ProviderHealthSnapshot,
  QuoteData,
} from "./types";
import { ProviderCapabilityPolicy } from "./ProviderCapabilityPolicy";
import { ProviderRegistry } from "./ProviderRegistry";

const now = Date.now();
const candles = Array.from({ length: 80 }, (_, index) => ({
  time: Math.floor((now / 1000 - (80 - index) * 900) / 900) * 900,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100.5 + index,
  volume: 10,
}));

function fakeProvider(
  name: string,
  health: () => "HEALTHY" | "UNAVAILABLE",
  fullSync: () => boolean = () => true,
): IMarketDataProvider {
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
    getHealth: async (context): Promise<ProviderHealthSnapshot> => ({
      health: health(),
      reasons: [],
      observedAt: Date.now(),
      seriesReadiness: {
        providerId: name,
        canonicalSymbol: context.canonicalSymbol,
        timeframe: context.timeframe,
        enoughHistoryLoaded: true,
        latestRequiredClosedBarPresent: true,
        continuityValid: true,
        fullSynchronizationComplete: fullSync(),
        freshnessValid: true,
        observedAt: Date.now(),
      },
    }),
  };
}

const eurusdContext: MarketDataContext = {
  canonicalSymbol: "EURUSD",
  timeframe: "M15",
  strategyId: "DGV8_FX",
  purpose: "STRATEGY",
};

function policyWithAlternate(
  options: {
    approved?: boolean;
    symbols?: string[];
    fullSync?: boolean;
  } = {},
): ProviderCapabilityPolicy {
  const policy = new ProviderCapabilityPolicy();
  for (const symbol of options.symbols ?? ["EURUSD"]) {
    const primary = policy.get("PRIMARY_MT5", symbol, "M15");
    assert.ok(primary);
    policy.set({
      ...primary,
      providerId: "ALTERNATE_TEST",
      approval: options.approved ? "APPROVED" : "NOT_APPROVED",
      allowedUsages: options.approved ? ["AUTHORITY"] : ["SHADOW"],
      structuralSuitability: options.approved ? "SUITABLE" : "PENDING",
      requiresFullSynchronization: true,
    });
  }
  return policy;
}

function makeRegistry(
  primaryHealthy: () => boolean,
  alternate: { approved: boolean; symbols?: string[]; fullSync?: () => boolean } = {
    approved: false,
  },
  transitions: string[] = [],
): ProviderRegistry {
  const policy = policyWithAlternate({
    approved: alternate.approved,
    symbols: alternate.symbols,
    fullSync: alternate.fullSync?.() ?? true,
  });
  return new ProviderRegistry(
    { failoverAfterMs: 100, alternateStableMs: 100, primaryRecoveryMs: 300 },
    async (_context, previous, decision) => {
      transitions.push(
        `${previous ?? "NONE"}>${decision.selectedProviderId ?? "NONE"}:${decision.reason}`,
      );
    },
    async () => null,
    async () => undefined,
    policy,
  );
}

function registerProviders(
  registry: ProviderRegistry,
  primaryHealthy: () => boolean,
  alternate: { fullSync?: () => boolean } = {},
): void {
  registry.register({
    id: "PRIMARY_MT5",
    displayName: "MT5",
    provider: fakeProvider("MT5", () => (primaryHealthy() ? "HEALTHY" : "UNAVAILABLE")),
    role: "PRIMARY",
    approval: "APPROVED",
    priority: 0,
    enabled: true,
  });
  registry.register({
    id: "ALTERNATE_TEST",
    displayName: "Approved test alternate",
    provider: fakeProvider("ALTERNATE", () => "HEALTHY", alternate.fullSync),
    role: "ALTERNATE",
    approval: "APPROVED",
    priority: 10,
    enabled: true,
  });
}

async function run() {
  {
    const registry = makeRegistry(() => true, { approved: true });
    registerProviders(registry, () => true);
    const decision = await registry.resolveAuthority(eurusdContext, 0);
    assert.equal(decision.selectedProviderId, "PRIMARY_MT5");
    assert.equal(decision.reason, "INITIAL_APPROVED_HEALTHY_SELECTION");
    assert.equal(decision.provenance?.providerId, "PRIMARY_MT5");
  }

  {
    const transitions: string[] = [];
    let primaryHealthy = true;
    const registry = makeRegistry(() => primaryHealthy, { approved: false }, transitions);
    registerProviders(registry, () => primaryHealthy);
    const initial = await registry.resolveAuthority(eurusdContext, 0);
    assert.equal(initial.selectedProviderId, "PRIMARY_MT5");
    primaryHealthy = false;
    const withinFailureWindow = await registry.resolveAuthority(eurusdContext, 100);
    assert.equal(withinFailureWindow.selectedProviderId, "PRIMARY_MT5");
    const decision = await registry.resolveAuthority(eurusdContext, 201);
    assert.equal(decision.selectedProviderId, null);
    assert.equal(decision.reason, "NO_APPROVED_HEALTHY_PROVIDER");
    assert.equal(decision.provenance, undefined);
    assert.deepEqual(transitions, [
      "NONE>PRIMARY_MT5:INITIAL_APPROVED_HEALTHY_SELECTION",
      "PRIMARY_MT5>NONE:NO_APPROVED_HEALTHY_PROVIDER",
    ]);
  }

  {
    let primaryHealthy = true;
    const registry = makeRegistry(() => primaryHealthy, { approved: true });
    registerProviders(registry, () => primaryHealthy);
    assert.equal(
      (await registry.resolveAuthority(eurusdContext, 0)).selectedProviderId,
      "PRIMARY_MT5",
    );
    primaryHealthy = false;
    assert.equal(
      (await registry.resolveAuthority(eurusdContext, 100)).selectedProviderId,
      "PRIMARY_MT5",
    );
    const failedOver = await registry.resolveAuthority(eurusdContext, 201);
    assert.equal(failedOver.selectedProviderId, "ALTERNATE_TEST");
    assert.equal(failedOver.reason, "SUSTAINED_UNHEALTHY_AUTHORITY_AND_STABLE_APPROVED_ALTERNATE");
    assert.equal(failedOver.provenance?.providerId, "ALTERNATE_TEST");
  }

  {
    let primaryHealthy = false;
    const registry = makeRegistry(() => primaryHealthy, { approved: true, symbols: ["EURUSD"] });
    registerProviders(registry, () => primaryHealthy);
    assert.equal(
      (await registry.resolveAuthority(eurusdContext, 0)).selectedProviderId,
      "ALTERNATE_TEST",
    );
    assert.equal(
      (await registry.resolveAuthority({ ...eurusdContext, canonicalSymbol: "XAUUSD" }, 0))
        .selectedProviderId,
      null,
    );
  }

  {
    const registry = makeRegistry(() => false, { approved: true });
    registerProviders(registry, () => false, { fullSync: () => false });
    assert.equal((await registry.resolveAuthority(eurusdContext, 0)).selectedProviderId, null);
  }

  {
    const registry = makeRegistry(() => false, { approved: false });
    registry.register({
      id: "YAHOO_REFERENCE",
      displayName: "Yahoo Reference",
      provider: fakeProvider("YAHOO", () => "HEALTHY"),
      role: "REFERENCE",
      approval: "NOT_APPROVED",
      priority: 50,
      enabled: true,
    });
    assert.equal((await registry.resolveAuthority(eurusdContext, 0)).selectedProviderId, null);
  }

  {
    const registry = makeRegistry(() => false, { approved: false });
    registerProviders(registry, () => false);
    for (const providerId of ["SHADOW_TWELVE_DATA", "SHADOW_BINANCE", "SHADOW_COINBASE"]) {
      registry.register({
        id: providerId,
        displayName: providerId,
        provider: fakeProvider(providerId, () => "HEALTHY"),
        role: "SHADOW",
        approval: "NOT_APPROVED",
        priority: 20,
        enabled: true,
      });
    }
    const decision = await registry.resolveAuthority(eurusdContext, 0);
    assert.equal(decision.selectedProviderId, null);
    assert.equal(decision.reason, "NO_APPROVED_HEALTHY_PROVIDER");
    const shadowCandidates = decision.candidates.filter((candidate) =>
      candidate.providerId.startsWith("SHADOW_"),
    );
    assert.equal(shadowCandidates.length, 3);
    assert.ok(shadowCandidates.every((candidate) => candidate.health.health === "HEALTHY"));
    assert.ok(decision.candidates.every((candidate) => !candidate.eligible));
  }

  {
    let primaryHealthy = false;
    const registry = makeRegistry(() => primaryHealthy, { approved: true });
    registerProviders(registry, () => primaryHealthy);
    assert.equal(
      (await registry.resolveAuthority(eurusdContext, 0)).selectedProviderId,
      "ALTERNATE_TEST",
    );
    primaryHealthy = true;
    assert.equal(
      (await registry.resolveAuthority(eurusdContext, 200)).selectedProviderId,
      "ALTERNATE_TEST",
    );
    assert.equal(
      (await registry.resolveAuthority(eurusdContext, 501)).selectedProviderId,
      "PRIMARY_MT5",
    );
  }
}

await run();
console.log(
  "Provider convergence checks passed: scoped capability, readiness, failover, reference isolation, and recovery hysteresis.",
);
