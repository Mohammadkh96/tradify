import { logger } from "../../lib/logger";
import type {
  CandleResponse,
  IMarketDataProvider,
  MarketDataContext,
  ProviderApproval,
  ProviderHealth,
  ProviderHealthSnapshot,
  ProviderProvenance,
  ProviderRequestMetadata,
  ProviderRole,
  QuoteData,
} from "./types";
import { evaluateProviderQuality, type ProviderQualityReport } from "./ProviderQuality";
import {
  marketDataCapabilityPolicy,
  type ProviderCapability,
  type CapabilityEvaluation,
  ProviderCapabilityPolicy,
} from "./ProviderCapabilityPolicy";
import { ProviderSeriesReadinessStore } from "./ProviderSeriesReadiness";
import {
  loadPersistedAuthority,
  persistAuthorityTransition,
  persistProviderRegistration,
} from "./MarketAuthorityPersistence";
import { mt5ProviderAdapter } from "./providers/MT5ProviderAdapter";
import {
  binanceShadowProvider,
  coinbaseShadowProvider,
} from "./providers/CryptoShadowProviderAdapter";
import {
  massiveShadowProvider,
  twelveDataShadowProvider,
} from "./providers/ExternalShadowProviderAdapters";
import { sanitizeDiagnosticValue } from "./ProviderDiagnosticSanitizer";

export interface ProviderRegistration {
  id: string;
  displayName: string;
  provider: IMarketDataProvider;
  role: ProviderRole;
  approval: ProviderApproval;
  priority: number;
  enabled: boolean;
}

export interface AuthorityPolicy {
  failoverAfterMs: number;
  alternateStableMs: number;
  primaryRecoveryMs: number;
}

export const DEFAULT_AUTHORITY_POLICY: AuthorityPolicy = {
  failoverAfterMs: 60_000,
  alternateStableMs: 30_000,
  primaryRecoveryMs: 300_000,
};

export interface ProviderCandidate {
  providerId: string;
  role: ProviderRole;
  approval: ProviderApproval;
  priority: number;
  health: ProviderHealthSnapshot;
  quality?: ProviderQualityReport;
  capability?: ProviderCapability;
  capabilityReasons?: string[];
  seriesReadiness?: ProviderQualityReport["seriesReadiness"];
  providerSymbol?: string;
  instrumentClass?: string;
  sourceTimestamp?: number;
  eligible: boolean;
}

export interface AuthorityDecision {
  contextKey: string;
  selectedProviderId: string | null;
  reason: string;
  candidates: ProviderCandidate[];
  provenance?: ProviderProvenance;
}

interface AuthorityState {
  selectedProviderId: string | null;
  unhealthySince?: number;
  alternateHealthySince?: number;
  alternateCandidateId?: string;
  primaryRecoverySince?: number;
}

type PersistTransition = (
  context: MarketDataContext,
  previousProviderId: string | null,
  decision: AuthorityDecision,
) => Promise<void>;
type PersistProvider = (registration: ProviderRegistration) => Promise<void>;

function contextKey(context: MarketDataContext): string {
  const baseKey = `${context.canonicalSymbol.toUpperCase()}:${context.timeframe.toUpperCase()}:${context.strategyId.toUpperCase()}`;
  // Strategy/candle authority keys predate purpose and are persisted in this
  // shape. Keep those keys stable for persistence compatibility, while
  // giving quote authority its own state so a quote-only health check cannot
  // select or persist an authority for the strategy path.
  return context.purpose === "QUOTE" ? `${baseKey}:QUOTE` : baseKey;
}

function roleRank(role: ProviderRole): number {
  return role === "PRIMARY" ? 0 : role === "ALTERNATE" ? 1 : 2;
}

function preferenceRank(providerId: string, canonicalSymbol: string): number {
  const symbol = canonicalSymbol.toUpperCase();
  if (symbol === "BTCUSD" || symbol === "ETHUSD") {
    if (providerId === "PRIMARY_MT5") return 0;
    if (providerId === "SHADOW_COINBASE") return 1;
    if (providerId === "SHADOW_BINANCE") return 2;
    if (providerId === "TWELVE_DATA") return 3;
    return 20;
  }
  if (providerId === "PRIMARY_MT5") return 0;
  if (providerId === "TWELVE_DATA") return 1;
  return 20;
}

function healthyForAuthority(candidate: ProviderCandidate): boolean {
  return candidate.eligible && candidate.health.health === "HEALTHY";
}

export class ProviderRegistry {
  private readonly registrations = new Map<string, ProviderRegistration>();
  private readonly authorities = new Map<string, AuthorityState>();
  private readonly hydrated = new Set<string>();
  private readonly persistedRegistrations = new Set<string>();

  constructor(
    private readonly policy: AuthorityPolicy = DEFAULT_AUTHORITY_POLICY,
    private readonly persistTransition: PersistTransition = persistAuthorityTransition,
    private readonly loadAuthority: (
      contextKey: string,
    ) => Promise<string | null> = loadPersistedAuthority,
    private readonly persistProvider: PersistProvider = persistProviderRegistration,
    private readonly capabilityPolicy: ProviderCapabilityPolicy = marketDataCapabilityPolicy,
    private readonly seriesReadiness: ProviderSeriesReadinessStore = new ProviderSeriesReadinessStore(),
  ) {}

  public register(registration: ProviderRegistration): void {
    this.registrations.set(registration.id, registration);
  }

  public getRegistration(providerId: string): ProviderRegistration | undefined {
    return this.registrations.get(providerId);
  }

  public listRegistrations(): ProviderRegistration[] {
    return [...this.registrations.values()];
  }

  public async getCandidates(context: MarketDataContext): Promise<ProviderCandidate[]> {
    const candidates = await Promise.all(
      [...this.registrations.values()].map(async (registration) => {
        if (!this.persistedRegistrations.has(registration.id)) {
          try {
            await this.persistProvider(registration);
            this.persistedRegistrations.add(registration.id);
          } catch (error) {
            logger.error(
              {
                providerId: registration.id,
                errorType: error instanceof Error ? error.name : typeof error,
              },
              "Unable to persist market provider registration",
            );
          }
        }
        const health = registration.provider.getHealth
          ? await registration.provider.getHealth({
              ...context,
              requestMetadata: {
                caller: "provider-health",
                reason: `Authority health check for ${context.canonicalSymbol} ${context.timeframe}.`,
              },
            })
          : {
              health: "UNAVAILABLE" as const,
              reasons: ["Provider does not expose a health contract."],
              observedAt: Date.now(),
            };
        const configuredCapability = this.capabilityPolicy.get(
          registration.id,
          context.canonicalSymbol,
          context.timeframe,
        );
        const quoteResponse =
          context.purpose === "QUOTE"
            ? await registration.provider.getQuote(
                context.canonicalSymbol,
                configuredCapability?.providerSymbol,
                {
                  caller: "readiness",
                  reason: `Authority quote validation for ${context.canonicalSymbol} ${context.timeframe}.`,
                },
              )
            : null;
        const candleResponse =
          context.purpose === "QUOTE"
            ? null
            : await registration.provider.getCandles(
                context.canonicalSymbol,
                context.timeframe,
                500,
                undefined,
                {
                  caller: "readiness",
                  reason: `Authority candidate series validation for ${context.canonicalSymbol} ${context.timeframe}.`,
                },
              );
        const quality = evaluateProviderQuality({
          context,
          providerName: registration.provider.name,
          providerSymbol: quoteResponse?.providerSymbol ?? candleResponse?.providerSymbol,
          providerHealth: health,
          candles: candleResponse?.candles,
          quote: quoteResponse,
          quoteReceivedAt: quoteResponse ? Date.parse(quoteResponse.receivedAt) : undefined,
        });
        // Quote checks must not overwrite the M15 series readiness tracked by
        // strategy/candle authority. A quote is eligible on its own freshness
        // and approved capability; it does not prove candle readiness.
        const readiness =
          context.purpose === "QUOTE"
            ? this.seriesReadiness.get(registration.id, context.canonicalSymbol, context.timeframe)
            : this.seriesReadiness.updateFromQuality(
                registration.id,
                context.canonicalSymbol,
                context.timeframe,
                quality,
                health,
              );
        const capability: CapabilityEvaluation = this.capabilityPolicy.evaluateAuthority(
          registration.id,
          context.canonicalSymbol,
          context.timeframe,
          registration,
          quality,
          { ...quality, seriesReadiness: readiness },
          this.seriesReadiness,
          quoteResponse?.instrumentType ?? candleResponse?.instrumentType,
          quoteResponse?.priceBasis ?? candleResponse?.priceBasis,
          context.purpose,
        );
        const quoteEligible =
          context.purpose !== "QUOTE" ||
          (quality.checks.find((item) => item.name === "QUOTE_RESPONSE_VALID")?.passed === true &&
            quality.checks.find((item) => item.name === "QUOTE_FRESHNESS")?.passed === true);
        const eligible =
          registration.enabled &&
          registration.approval === "APPROVED" &&
          (registration.role === "PRIMARY" || registration.role === "ALTERNATE") &&
          registration.provider.supportsSymbol(context.canonicalSymbol) &&
          capability.eligible &&
          quoteEligible;
        return {
          providerId: registration.id,
          role: registration.role,
          approval: registration.approval,
          priority: registration.priority,
          health: quality,
          quality,
          capability: capability.capability,
          capabilityReasons: capability.reasons,
          seriesReadiness: readiness,
          providerSymbol: quoteResponse?.providerSymbol ?? candleResponse?.providerSymbol,
          instrumentClass: quoteResponse?.instrumentType ?? candleResponse?.instrumentType,
          sourceTimestamp: quoteResponse
            ? (() => {
                const timestamp = Date.parse(quoteResponse.timestamp);
                return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : undefined;
              })()
            : (candleResponse?.sourceTimestamp ?? candleResponse?.lastUpdated),
          eligible,
        };
      }),
    );
    return candidates.sort(
      (left, right) =>
        roleRank(left.role) - roleRank(right.role) ||
        preferenceRank(left.providerId, context.canonicalSymbol) -
          preferenceRank(right.providerId, context.canonicalSymbol) ||
        left.priority - right.priority ||
        left.providerId.localeCompare(right.providerId),
    );
  }

  public async resolveAuthority(
    context: MarketDataContext,
    now = Date.now(),
  ): Promise<AuthorityDecision> {
    const key = contextKey(context);
    if (!this.hydrated.has(key)) {
      const persisted = await this.loadAuthority(key).catch((error) => {
        logger.error(
          { contextKey: key, errorType: error instanceof Error ? error.name : typeof error },
          "Unable to load persisted market authority",
        );
        return null;
      });
      if (persisted) this.authorities.set(key, { selectedProviderId: persisted });
      this.hydrated.add(key);
    }

    const candidates = await this.getCandidates(context);
    const eligibleHealthy = candidates.filter(healthyForAuthority);
    const preferred = eligibleHealthy[0];
    const state = this.authorities.get(key) ?? { selectedProviderId: null };
    const current = candidates.find(
      (candidate) => candidate.providerId === state.selectedProviderId,
    );
    const currentHealthy = current ? healthyForAuthority(current) : false;
    let nextProviderId = state.selectedProviderId;
    let reason = currentHealthy
      ? "CURRENT_AUTHORITY_REMAINS_HEALTHY"
      : "NO_APPROVED_HEALTHY_PROVIDER";

    if (!state.selectedProviderId && preferred) {
      nextProviderId = preferred.providerId;
      reason = "INITIAL_APPROVED_HEALTHY_SELECTION";
    } else if (current && currentHealthy) {
      state.unhealthySince = undefined;
      state.alternateHealthySince = undefined;
      state.alternateCandidateId = undefined;
      const primary = candidates.find(
        (candidate) => candidate.role === "PRIMARY" && healthyForAuthority(candidate),
      );
      if (current.role !== "PRIMARY" && primary && primary.providerId !== current.providerId) {
        state.primaryRecoverySince ??= now;
        if (now - state.primaryRecoverySince >= this.policy.primaryRecoveryMs) {
          nextProviderId = primary.providerId;
          reason = "PRIMARY_RECOVERY_STABILITY_WINDOW_SATISFIED";
          state.primaryRecoverySince = undefined;
        } else {
          reason = "WAITING_FOR_PRIMARY_RECOVERY_STABILITY";
        }
      } else {
        state.primaryRecoverySince = undefined;
      }
    } else if (current) {
      state.unhealthySince ??= now;
      const replacement = eligibleHealthy.find(
        (candidate) => candidate.providerId !== current.providerId,
      );
      if (replacement) {
        if (state.alternateCandidateId !== replacement.providerId) {
          state.alternateCandidateId = replacement.providerId;
          state.alternateHealthySince = now;
        }
        const unhealthyStable = now - state.unhealthySince >= this.policy.failoverAfterMs;
        const alternateStable =
          now - (state.alternateHealthySince ?? now) >= this.policy.alternateStableMs;
        if (unhealthyStable && alternateStable) {
          nextProviderId = replacement.providerId;
          reason = "SUSTAINED_UNHEALTHY_AUTHORITY_AND_STABLE_APPROVED_ALTERNATE";
          state.unhealthySince = undefined;
          state.alternateHealthySince = undefined;
          state.alternateCandidateId = undefined;
        } else if (!unhealthyStable) {
          reason = "WAITING_FOR_CURRENT_AUTHORITY_FAILURE_WINDOW";
        } else {
          reason = "WAITING_FOR_ALTERNATE_HEALTH_STABILITY";
        }
      } else if (now - (state.unhealthySince ?? now) >= this.policy.failoverAfterMs) {
        nextProviderId = null;
        reason = "NO_APPROVED_HEALTHY_PROVIDER";
        state.unhealthySince = undefined;
        state.alternateHealthySince = undefined;
        state.alternateCandidateId = undefined;
      }
    }

    const decision: AuthorityDecision = {
      contextKey: key,
      selectedProviderId: nextProviderId,
      reason,
      candidates,
    };
    const selected = candidates.find((candidate) => candidate.providerId === nextProviderId);
    if (selected) {
      decision.provenance = {
        providerId: selected.providerId,
        providerSymbol: selected.providerSymbol,
        canonicalSymbol: context.canonicalSymbol,
        instrumentClass: selected.capability?.instrumentClass ?? selected.instrumentClass,
        timeframe: context.timeframe.toUpperCase(),
        role: selected.role,
        approval: selected.approval,
        health: selected.health.health,
        authority: true,
        authorityReason: reason,
        authorityContext: key,
        capabilityApproval: selected.capability?.approval,
        capabilityState: selected.capability
          ? `${selected.capability.entitlement}:${selected.capability.qualityState}:${selected.capability.structuralSuitability}`
          : undefined,
        seriesReady: selected.capability
          ? Boolean(
              selected.seriesReadiness &&
              this.seriesReadiness.isReady(
                selected.seriesReadiness,
                selected.capability.requiresFullSynchronization,
              ),
            )
          : false,
        sourceTimestamp: selected.sourceTimestamp,
        transitionTimestamp: Date.now(),
      };
    }

    if (nextProviderId !== state.selectedProviderId) {
      const previousProviderId = state.selectedProviderId;
      state.selectedProviderId = nextProviderId;
      this.authorities.set(key, state);
      await this.persistTransition(context, previousProviderId, decision).catch((error) => {
        logger.error(
          { contextKey: key, errorType: error instanceof Error ? error.name : typeof error },
          "Unable to persist market authority transition",
        );
      });
    } else {
      this.authorities.set(key, state);
    }
    return decision;
  }

  public async getQuote(
    providerId: string,
    context: MarketDataContext,
    requestMetadata?: ProviderRequestMetadata,
  ): Promise<QuoteData | null> {
    const registration = this.registrations.get(providerId);
    if (!registration) return null;
    const capability = this.capabilityPolicy.get(
      providerId,
      context.canonicalSymbol,
      context.timeframe,
    );
    return registration.provider.getQuote(
      context.canonicalSymbol,
      capability?.providerSymbol,
      requestMetadata ??
        context.requestMetadata ?? {
          caller: "provider-quote-read",
          reason: `Provider quote read for ${context.canonicalSymbol}.`,
        },
    );
  }

  public async getCandles(
    providerId: string,
    context: MarketDataContext,
    limit: number,
    requestMetadata?: ProviderRequestMetadata,
  ): Promise<CandleResponse | null> {
    const registration = this.registrations.get(providerId);
    if (!registration) return null;
    const capability = this.capabilityPolicy.get(
      providerId,
      context.canonicalSymbol,
      context.timeframe,
    );
    return registration.provider.getCandles(
      context.canonicalSymbol,
      context.timeframe,
      limit,
      capability?.providerSymbol,
      requestMetadata ??
        context.requestMetadata ?? {
          caller: "provider-candle-read",
          reason: `Provider candle read for ${context.canonicalSymbol} ${context.timeframe}.`,
        },
    );
  }

  public async getProviderDiagnostics(context: MarketDataContext): Promise<{
    context: MarketDataContext;
    authority: AuthorityDecision;
    providers: ProviderCandidate[];
  }> {
    return {
      context,
      authority: await this.resolveAuthority(context),
      providers: await this.getCandidates(context),
    };
  }

  public getRegistrationDiagnostics(): Array<{
    providerId: string;
    displayName: string;
    role: ProviderRole;
    approval: ProviderApproval;
    priority: number;
    enabled: boolean;
  }> {
    return this.listRegistrations().map((registration) => ({
      providerId: registration.id,
      displayName: registration.displayName,
      role: registration.role,
      approval: registration.approval,
      priority: registration.priority,
      enabled: registration.enabled,
    }));
  }
}

export const marketDataRegistry = new ProviderRegistry();
marketDataRegistry.register({
  id: "PRIMARY_MT5",
  displayName: "MetaTrader 5",
  provider: mt5ProviderAdapter,
  role: "PRIMARY",
  approval: "APPROVED",
  priority: 0,
  enabled: true,
});
marketDataRegistry.register({
  id: "SHADOW_BINANCE",
  displayName: "Binance Public Market Data",
  provider: binanceShadowProvider,
  role: "ALTERNATE",
  approval: "APPROVED",
  priority: 2,
  enabled: true,
});
marketDataRegistry.register({
  id: "SHADOW_COINBASE",
  displayName: "Coinbase Exchange Public Market Data",
  provider: coinbaseShadowProvider,
  role: "ALTERNATE",
  approval: "APPROVED",
  priority: 1,
  enabled: true,
});
marketDataRegistry.register({
  id: "MASSIVE",
  displayName: "Massive EOD Shadow",
  provider: massiveShadowProvider,
  role: "SHADOW",
  approval: "NOT_APPROVED",
  priority: 30,
  enabled: true,
});
marketDataRegistry.register({
  id: "TWELVE_DATA",
  displayName: "Twelve Data M15 Alternate",
  provider: twelveDataShadowProvider,
  role: "SHADOW",
  approval: "NOT_APPROVED",
  priority: 3,
  enabled: true,
});
