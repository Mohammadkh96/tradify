import type { ProviderHealthSnapshot } from "./types";
import type { ProviderQualityReport } from "./ProviderQuality";

export interface ProviderSeriesReadinessState {
  providerId: string;
  canonicalSymbol: string;
  timeframe: string;
  enoughHistoryLoaded: boolean;
  latestRequiredClosedBarPresent: boolean;
  continuityValid: boolean;
  fullSynchronizationComplete: boolean;
  freshnessValid: boolean;
  observedAt: number;
}

export class ProviderSeriesReadinessStore {
  private readonly states = new Map<string, ProviderSeriesReadinessState>();

  private key(providerId: string, canonicalSymbol: string, timeframe: string): string {
    return `${providerId}:${canonicalSymbol.toUpperCase()}:${timeframe.toUpperCase()}`;
  }

  public get(
    providerId: string,
    canonicalSymbol: string,
    timeframe: string,
  ): ProviderSeriesReadinessState | undefined {
    return this.states.get(this.key(providerId, canonicalSymbol, timeframe));
  }

  public set(state: ProviderSeriesReadinessState): ProviderSeriesReadinessState {
    this.states.set(this.key(state.providerId, state.canonicalSymbol, state.timeframe), state);
    return state;
  }

  public clear(): void {
    this.states.clear();
  }

  public isReady(
    state: ProviderSeriesReadinessState | undefined,
    requiresFullSynchronization: boolean,
  ): boolean {
    if (!state) return false;
    return (
      state.enoughHistoryLoaded &&
      state.latestRequiredClosedBarPresent &&
      state.continuityValid &&
      state.freshnessValid &&
      (!requiresFullSynchronization || state.fullSynchronizationComplete)
    );
  }

  public updateFromQuality(
    providerId: string,
    canonicalSymbol: string,
    timeframe: string,
    quality: ProviderQualityReport,
    providerHealth: ProviderHealthSnapshot,
  ): ProviderSeriesReadinessState {
    const previous = this.get(providerId, canonicalSymbol, timeframe);
    const derived = quality.seriesReadiness;
    return this.set({
      providerId,
      canonicalSymbol,
      timeframe,
      enoughHistoryLoaded: derived?.enoughHistoryLoaded ?? false,
      latestRequiredClosedBarPresent: derived?.latestRequiredClosedBarPresent ?? false,
      continuityValid: derived?.continuityValid ?? false,
      fullSynchronizationComplete:
        providerHealth.seriesReadiness?.fullSynchronizationComplete ??
        previous?.fullSynchronizationComplete ??
        false,
      freshnessValid: derived?.freshnessValid ?? false,
      observedAt: quality.observedAt,
    });
  }
}
