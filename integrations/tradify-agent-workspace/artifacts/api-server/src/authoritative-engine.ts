import {
  bridgeStore,
  catalogItem,
  getCandles,
  getQuotes,
  type Candle,
  type DataState,
  type Quote,
} from "./tradify-runtime";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  tradifyEvaluationHistory,
  tradifyGeneratedSignals,
  tradifyStrategyAssignments,
  tradifyStrategies,
  tradifySymbols,
} from "@workspace/db";
import { FallbackMap } from "./zip-engine/market/FallbackMap";
import { SeriesValidator, type SeriesValidationResult } from "./zip-engine/market/SeriesValidator";
import { marketCatalog } from "./zip-engine/market/MarketCatalog";
import { SymbolMapper } from "./zip-engine/market/SymbolMapper";
import { mt5WatchlistSymbolIdentity } from "./zip-engine/market/MT5WatchlistCatalog";
import { strategyRouter } from "./zip-engine/strategy/StrategyRouter";
import type { StrategySignal } from "./zip-engine/strategy/types";
import type { ProviderProvenance } from "./zip-engine/market/types";
import { engineState } from "./engine-state";
import {
  ensureControlPlaneReady,
  listEffectiveMarkets,
  resolveEvaluationControl,
  STRATEGY_TIMEFRAME,
} from "./control-plane";
import { syncSignalOutcomeHistory } from "./signal-outcomes";
import { persistTrustedSignalLifecycle } from "./signal-lifecycle-ledger";

export type RequestedStrategy = "DGV8" | "DGV8_FX" | "BBB" | "BBB_GOLD_3S";

export interface AuthoritativeEvaluation {
  symbol: string;
  strategy: RequestedStrategy | string;
  strategyVersion: string;
  assignmentId: string | null;
  evaluationId: string;
  result: string;
  rejectionReason: string | null;
  signalGenerated: boolean;
  signal: StrategySignal;
  quote?: Quote;
  candles: Candle[];
  provider: string;
  providerSymbol: string;
  dataState: DataState;
  referenceState?: Quote["referenceState"];
  sourceAgeSeconds?: number;
  referenceCondition?: Quote["referenceCondition"];
  validation: SeriesValidationResult;
  provenance: {
    source: string;
    provider: string;
    providerSymbol: string;
    timeframe: "M15";
    candleCount: number;
    firstCandleTime: number | null;
    lastCandleTime: number | null;
    closedCandleCount: number;
    validation: SeriesValidationResult;
    marketDataTrusted: boolean;
    authority: ProviderProvenance | null;
  };
}

function evaluationSymbolIdentity(rawSymbol: string): string {
  const watchlistSymbol = mt5WatchlistSymbolIdentity(rawSymbol);
  if (watchlistSymbol) return watchlistSymbol;
  return SymbolMapper.toCanonical(rawSymbol).canonical ?? rawSymbol.trim().toUpperCase();
}

function normalizeStrategy(value: string | undefined | null): RequestedStrategy | undefined {
  const normalized = value?.trim().toUpperCase().replace(/[- ]+/g, "_");
  if (
    normalized === "DGV8" ||
    normalized === "DGV8_FX" ||
    normalized === "BBB" ||
    normalized === "BBB_GOLD_3S"
  )
    return normalized;
  return undefined;
}

export async function assignedStrategies(
  symbols: string[],
): Promise<Map<string, RequestedStrategy | null>> {
  await ensureControlPlaneReady();
  const canonicalSymbols = [...new Set(symbols.map(evaluationSymbolIdentity))];
  if (!canonicalSymbols.length) return new Map();
  const rows = await db
    .select({
      symbol: tradifyStrategyAssignments.symbol,
      strategyId: tradifyStrategyAssignments.strategyId,
    })
    .from(tradifyStrategyAssignments)
    .innerJoin(tradifyStrategies, eq(tradifyStrategies.id, tradifyStrategyAssignments.strategyId))
    .innerJoin(
      tradifySymbols,
      eq(tradifySymbols.canonicalSymbol, tradifyStrategyAssignments.symbol),
    )
    .where(
      and(
        inArray(tradifyStrategyAssignments.symbol, canonicalSymbols),
        eq(tradifyStrategyAssignments.timeframe, STRATEGY_TIMEFRAME),
        eq(tradifyStrategyAssignments.enabled, true),
        eq(tradifyStrategyAssignments.isDefault, true),
        eq(tradifyStrategies.lifecycleStatus, "ACTIVE"),
        eq(tradifySymbols.enabled, true),
      ),
    );
  const assignments = new Map<string, RequestedStrategy | null>(
    canonicalSymbols.map((symbol) => [symbol, null]),
  );
  for (const row of rows) {
    assignments.set(row.symbol, (row.strategyId as RequestedStrategy | undefined) ?? null);
  }
  return assignments;
}

export async function assignedStrategy(symbol: string): Promise<RequestedStrategy | null> {
  const canonical = evaluationSymbolIdentity(symbol);
  return (await assignedStrategies([canonical])).get(canonical) ?? null;
}

function noDataValidation(reason: string): SeriesValidationResult {
  return { valid: false, checkFailed: 7, checkName: "SUFFICIENCY", reason };
}

function isGeneratedSignal(signal: StrategySignal): boolean {
  return (
    ["DETECTED", "PENDING", "ACTIVE"].includes(signal.lifecycleStatus) &&
    signal.direction !== "NONE"
  );
}

function evaluationResult(
  evaluation: Pick<
    AuthoritativeEvaluation,
    "signal" | "dataState" | "candles" | "validation" | "provenance"
  >,
  blockedReason?: string,
): string {
  if (blockedReason === "SYMBOL_DISABLED") return "SYMBOL_DISABLED";
  if (blockedReason === "ASSIGNMENT_DISABLED" || blockedReason === "UNKNOWN_SYMBOL")
    return "ASSIGNMENT_DISABLED";
  if (blockedReason === "STRATEGY_DISABLED") return "STRATEGY_DISABLED";
  if (blockedReason === "INVALID_STRATEGY") return "VALIDATION_REJECTED";
  if (blockedReason === "ENGINE_PAUSED") return "ENGINE_PAUSED";
  if (blockedReason === "ENGINE_ERROR") return "ENGINE_ERROR";
  if (isGeneratedSignal(evaluation.signal)) return "SIGNAL_GENERATED";
  if (evaluation.dataState === "STALE") return "STALE_DATA";
  if (evaluation.candles.length === 0) return "INSUFFICIENT_DATA";
  if (!evaluation.validation.valid) return "VALIDATION_REJECTED";
  if (!evaluation.provenance.marketDataTrusted) return "STALE_DATA";
  return "NO_SETUP";
}

function marketTimeAsDate(timestamp: number | null): Date | null {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function persistEvaluation(
  evaluation: Omit<
    AuthoritativeEvaluation,
    "evaluationId" | "result" | "rejectionReason" | "signalGenerated"
  >,
  origin: string,
  startedAt: number,
  blockedReason?: string,
): Promise<AuthoritativeEvaluation> {
  const generated = isGeneratedSignal(evaluation.signal);
  const result = evaluationResult(evaluation, blockedReason);
  const rejectionReason = generated
    ? null
    : evaluation.signal.reasons?.join(" · ") ||
      evaluation.validation.reason ||
      evaluation.signal.action ||
      blockedReason ||
      "No qualifying setup.";
  const id = randomUUID();
  const elapsed = Math.max(0, Math.min(2_147_483_647, Math.round(performance.now() - startedAt)));
  const authority = evaluation.provenance.authority;
  const safeDetails: Record<string, unknown> = {
    provider: evaluation.provider,
    providerSymbol: evaluation.providerSymbol,
    candleCount: evaluation.provenance.candleCount,
    firstCandleTime: evaluation.provenance.firstCandleTime,
    lastCandleTime: evaluation.provenance.lastCandleTime,
    closedCandleCount: evaluation.provenance.closedCandleCount,
    authority: authority
      ? {
          role: authority.role,
          approval: authority.approval,
          health: authority.health,
          seriesReady: authority.seriesReady,
        }
      : null,
    validation: {
      valid: evaluation.validation.valid,
      checkFailed: evaluation.validation.checkFailed,
      checkName: evaluation.validation.checkName,
      reason: evaluation.validation.reason?.slice(0, 1000) ?? null,
    },
    action: evaluation.signal.action,
    lifecycleStatus: evaluation.signal.lifecycleStatus,
    direction: evaluation.signal.direction,
  };
  const signalSnapshot: Record<string, unknown> = {
    direction: evaluation.signal.direction,
    action: evaluation.signal.action,
    lifecycleStatus: evaluation.signal.lifecycleStatus,
    detectedAt: evaluation.signal.detectedAt,
    entry: evaluation.signal.entry ?? null,
    stopLoss: evaluation.signal.stopLoss ?? null,
    targets: evaluation.signal.targets.map((target) => ({
      price: target.price,
      label: target.label,
    })),
    reasons: evaluation.signal.reasons.slice(0, 20).map((reason) => reason.slice(0, 500)),
  };

  await db.transaction(async (tx) => {
    await tx.insert(tradifyEvaluationHistory).values({
      id,
      origin,
      strategyId: evaluation.strategy,
      strategyVersion: evaluation.strategyVersion,
      symbol: evaluation.symbol,
      timeframe: STRATEGY_TIMEFRAME,
      assignmentId: evaluation.assignmentId,
      marketDataAt: marketTimeAsDate(evaluation.provenance.lastCandleTime),
      dataState: evaluation.dataState,
      marketDataTrusted: evaluation.provenance.marketDataTrusted,
      result,
      signalGenerated: generated,
      signalId: generated ? evaluation.signal.id : null,
      reason: rejectionReason?.slice(0, 2000) ?? null,
      errorCategory: ["SIGNAL_GENERATED", "NO_SETUP"].includes(result) ? null : result,
      processingDurationMs: elapsed,
      details: safeDetails,
    });
    if (generated) {
      await tx
        .insert(tradifyGeneratedSignals)
        .values({
          id: evaluation.signal.id,
          evaluationId: id,
          strategyId: evaluation.strategy,
          strategyVersion: evaluation.strategyVersion,
          symbol: evaluation.symbol,
          timeframe: STRATEGY_TIMEFRAME,
          snapshot: signalSnapshot,
        })
        .onConflictDoNothing();
    }
  });
  const persistedEvaluation = {
    ...evaluation,
    evaluationId: id,
    result,
    rejectionReason,
    signalGenerated: generated,
  };
  await syncSignalOutcomeHistory(persistedEvaluation);
  await persistTrustedSignalLifecycle(persistedEvaluation);
  return persistedEvaluation;
}

function blockedSignal(
  symbol: string,
  strategy: string,
  version: string,
  reason: string,
): StrategySignal {
  const now = Date.now();
  return {
    id: `BLOCKED-${symbol}-${now}`,
    strategy: strategy as StrategySignal["strategy"],
    strategyVersion: version,
    symbol,
    tradingDay: new Date(now).toISOString().slice(0, 10),
    timeframe: STRATEGY_TIMEFRAME,
    direction: "NONE",
    action: "EVALUATION_BLOCKED",
    lifecycleStatus: "NO_QUALIFIED_SETUP",
    detectedAt: now,
    targets: [],
    marketDataSnapshot: {
      provider: "Unknown",
      providerSymbol: symbol,
      latestConfirmedCandleTime: now,
    },
    strategyFacts: {},
    reasons: [reason],
  };
}

export async function evaluateSymbol(
  rawSymbol: string,
  requestedStrategy?: string | null,
  existingQuotes?: Record<string, Quote>,
  origin = "RUNTIME_REFRESH",
  options?: {
    customerMarketData?: { quote?: Quote; candles: Candle[]; providerSymbol: string };
    persist?: boolean;
  },
): Promise<AuthoritativeEvaluation | undefined> {
  const startedAt = performance.now();
  await ensureControlPlaneReady();
  const canonical = evaluationSymbolIdentity(rawSymbol);
  if (!marketCatalog.get(canonical)) return undefined;

  const normalizedRequested = normalizeStrategy(requestedStrategy);
  const control = await resolveEvaluationControl(canonical, normalizedRequested);
  const block = requestedStrategy && !normalizedRequested ? "INVALID_STRATEGY" : control.block;
  const strategy = (control.strategy?.id ?? normalizedRequested ?? "UNASSIGNED") as
    RequestedStrategy | string;
  const strategyVersion = control.strategy?.version ?? "unavailable";
  const finishEvaluation = (
    evaluation: Omit<
      AuthoritativeEvaluation,
      "evaluationId" | "result" | "rejectionReason" | "signalGenerated"
    >,
    blockedReason?: string,
  ) => {
    if (options?.persist !== false) {
      return persistEvaluation(evaluation, origin, startedAt, blockedReason);
    }
    const generated = isGeneratedSignal(evaluation.signal);
    return Promise.resolve({
      ...evaluation,
      evaluationId: randomUUID(),
      result: evaluationResult(evaluation, blockedReason),
      rejectionReason: generated
        ? null
        : evaluation.signal.reasons?.join(" · ") ||
          evaluation.validation.reason ||
          evaluation.signal.action ||
          blockedReason ||
          "No qualifying setup.",
      signalGenerated: generated,
    });
  };
  if (block) {
    const reason =
      block === "SYMBOL_DISABLED"
        ? `Symbol ${canonical} is disabled in the control plane.`
        : block === "STRATEGY_DISABLED"
          ? `Strategy ${strategy} is not active.`
          : block === "INVALID_STRATEGY"
            ? `Strategy ${requestedStrategy} is not supported.`
            : `No enabled ${STRATEGY_TIMEFRAME} assignment is configured for ${strategy} on ${canonical}.`;
    const signal = blockedSignal(canonical, strategy, strategyVersion, reason);
    const validation = noDataValidation(reason);
    const provisional: Omit<
      AuthoritativeEvaluation,
      "evaluationId" | "result" | "rejectionReason" | "signalGenerated"
    > = {
      symbol: canonical,
      strategy,
      strategyVersion,
      assignmentId: null,
      signal,
      candles: [],
      provider: control.symbolControl?.provider ?? "Unknown",
      providerSymbol: control.symbolControl?.providerSymbol ?? canonical,
      dataState: "ERROR",
      validation,
      provenance: {
        source: "CONTROL_PLANE",
        provider: control.symbolControl?.provider ?? "Unknown",
        providerSymbol: control.symbolControl?.providerSymbol ?? canonical,
        timeframe: STRATEGY_TIMEFRAME,
        candleCount: 0,
        firstCandleTime: null,
        lastCandleTime: null,
        closedCandleCount: 0,
        validation,
        marketDataTrusted: false,
        authority: null,
      },
    };
    return finishEvaluation(provisional, block);
  }

  const strategyVersionAtStart = control.strategy!.version;
  const quote = options?.customerMarketData
    ? options.customerMarketData.quote
    : (existingQuotes ?? (await getQuotes()))[canonical];
  let response;
  let evaluationError: unknown;
  try {
    response = options?.customerMarketData
      ? {
          symbol: canonical,
          provider: "CUSTOMER_MT5",
          providerSymbol: options.customerMarketData.providerSymbol,
          instrumentType: marketCatalog.get(canonical)?.assetClass ?? "UNKNOWN",
          timeframe: STRATEGY_TIMEFRAME,
          timezone: "UTC" as const,
          candles: options.customerMarketData.candles,
          dataState: "LIVE" as const,
          provenance: {
            providerId: "CUSTOMER_MT5",
            providerSymbol: options.customerMarketData.providerSymbol,
            canonicalSymbol: canonical,
            timeframe: STRATEGY_TIMEFRAME,
            role: "PRIMARY" as const,
            approval: "APPROVED" as const,
            health: "DEGRADED" as const,
            authority: false,
            authorityReason: "Customer feed history is isolated and not shared strategy authority.",
            seriesReady: false,
          },
        }
      : await getCandles(canonical, STRATEGY_TIMEFRAME, 500, strategy);
  } catch (error) {
    evaluationError = error;
  }
  const provider = response?.provider ?? quote?.provider ?? "MT5";
  const providerSymbol =
    response?.providerSymbol ??
    quote?.brokerSymbol ??
    bridgeStore.getMappings()[canonical] ??
    canonical;
  const responseProvenance = response && "provenance" in response ? response.provenance : undefined;
  const candles = (response?.candles ?? []).map((candle) => ({
    ...candle,
    volume: candle.volume ?? 0,
  }));
  const validation: SeriesValidationResult = evaluationError
    ? noDataValidation("The strategy market-data request failed.")
    : response?.dataState === "FALLBACK"
      ? noDataValidation("Fallback candles are display-only and cannot be strategy validated.")
      : response
        ? SeriesValidator.validateM15Series(
            canonical,
            provider,
            providerSymbol,
            candles,
            Math.floor(Date.now() / 1000),
            responseProvenance
              ? {
                  connected: !["UNAVAILABLE", "REJECTED"].includes(responseProvenance.health),
                  health: responseProvenance.health,
                  availabilityReason: responseProvenance.authorityReason,
                }
              : undefined,
          )
        : noDataValidation("No M15 candle feed available.");
  // Fallback candles are display/analysis data only. They are never trusted for
  // a broker execution signal, even when their shape passes the series guards.
  const marketDataTrusted =
    response?.dataState === "LIVE" &&
    quote?.dataState === "LIVE" &&
    responseProvenance?.authority === true &&
    responseProvenance.approval === "APPROVED" &&
    ["PRIMARY", "ALTERNATE"].includes(responseProvenance.role) &&
    responseProvenance.health === "HEALTHY" &&
    responseProvenance.seriesReady === true &&
    validation.valid &&
    engineState.isActive();
  const closedCandles = validation.closedCandles ?? [];
  let signal: StrategySignal;
  try {
    signal = evaluationError
      ? blockedSignal(
          canonical,
          strategy,
          strategyVersionAtStart,
          "Market-data request failed before strategy evaluation.",
        )
      : strategyRouter.evaluate(
          canonical,
          providerSymbol,
          provider,
          marketDataTrusted ? closedCandles : [],
          marketDataTrusted,
          strategy,
        );
  } catch (error) {
    evaluationError = error;
    signal = blockedSignal(
      canonical,
      strategy,
      strategyVersionAtStart,
      "Strategy engine raised an error.",
    );
  }
  const dataState: DataState =
    quote?.referenceState === "STALE"
      ? "STALE"
      : response?.dataState === "FALLBACK"
        ? "FALLBACK"
        : marketDataTrusted
          ? "LIVE"
          : response || quote
            ? validation.valid
              ? "STALE"
              : "ERROR"
            : "ERROR";

  const result: Omit<
    AuthoritativeEvaluation,
    "evaluationId" | "result" | "rejectionReason" | "signalGenerated"
  > = {
    symbol: canonical,
    strategy,
    strategyVersion: strategyVersionAtStart,
    assignmentId: control.assignment?.id ?? null,
    signal,
    quote,
    candles,
    provider,
    providerSymbol,
    dataState,
    referenceState: quote?.referenceState,
    sourceAgeSeconds: quote?.sourceAgeSeconds,
    referenceCondition: quote?.referenceCondition,
    validation,
    provenance: {
      source:
        responseProvenance?.authority === true ? "PROVIDER_AUTHORITY" : "FALLBACK_ANALYSIS_ONLY",
      provider,
      providerSymbol,
      timeframe: "M15",
      candleCount: candles.length,
      firstCandleTime: candles[0]?.time ?? null,
      lastCandleTime: candles.at(-1)?.time ?? null,
      closedCandleCount: closedCandles.length,
      validation,
      marketDataTrusted,
      authority: responseProvenance ?? null,
    },
  };
  return finishEvaluation(result, evaluationError ? "ENGINE_ERROR" : undefined);
}

function ageLabel(timestamp?: number): string {
  if (!timestamp) return "—";
  const seconds = Math.max(
    0,
    Math.floor(Date.now() / 1000 - (timestamp > 10_000_000_000 ? timestamp / 1000 : timestamp)),
  );
  return seconds < 60
    ? `${seconds}s`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m`
      : `${Math.floor(seconds / 3600)}h`;
}

function gradeFor(signal: StrategySignal): "A+" | "A" | "B" {
  if (signal.lifecycleStatus === "ACTIVE" || signal.lifecycleStatus === "DETECTED") return "A+";
  if (signal.lifecycleStatus === "PENDING") return "A";
  return "B";
}

export function toSignalCard(evaluation: AuthoritativeEvaluation) {
  const { signal, quote, dataState } = evaluation;
  const item = marketCatalog.get(evaluation.symbol) ?? catalogItem(evaluation.symbol);
  const levelMap = signal.dgv8LevelMap ?? signal.dgv8ChartLevels?.levelMap;
  const buyGate =
    levelMap?.buy.gate ??
    signal.dgv8ChartLevels?.buyGate ??
    signal.strategyFacts?.asia?.high ??
    signal.strategyFacts?.sessions?.asia?.locked?.high ??
    null;
  const sellGate =
    levelMap?.sell.gate ??
    signal.dgv8ChartLevels?.sellGate ??
    signal.strategyFacts?.asia?.low ??
    signal.strategyFacts?.sessions?.asia?.locked?.low ??
    null;
  const targets = signal.targets.map((target) => target.price);
  const direction =
    signal.direction === "SHORT" ? "SHORT" : signal.direction === "LONG" ? "LONG" : "NONE";
  return {
    id: signal.id,
    symbol: evaluation.symbol,
    name: item ? ("description" in item ? item.description : item.name) : evaluation.symbol,
    market: item?.assetClass ?? "FOREX",
    direction,
    strategy: signal.strategy,
    strategyVersion: signal.strategyVersion,
    grade: gradeFor(signal),
    action: signal.action,
    lifecycleStatus: signal.lifecycleStatus,
    qualified: ["DETECTED", "PENDING", "ACTIVE"].includes(signal.lifecycleStatus),
    price: quote?.price ?? 0,
    entry: signal.entry ?? 0,
    stop: signal.stopLoss ?? 0,
    tp1: targets[0] ?? 0,
    tp2: targets[1] ?? targets[0] ?? 0,
    tp3: targets[2] ?? targets[1] ?? targets[0] ?? 0,
    targets,
    buyGate,
    sellGate,
    sourceHigh: levelMap?.source.wickHigh ?? signal.dgv8ChartLevels?.sourceHigh ?? null,
    sourceLow: levelMap?.source.wickLow ?? signal.dgv8ChartLevels?.sourceLow ?? null,
    pivotResistance: levelMap?.source.pivotResistance ?? signal.dgv8ChartLevels?.pivotResistance ?? null,
    pivotSupport: levelMap?.source.pivotSupport ?? signal.dgv8ChartLevels?.pivotSupport ?? null,
    session:
      signal.activeSession ?? signal.sourceSession ?? signal.strategyFacts?.activeSession ?? "NONE",
    age: ageLabel(signal.detectedAt),
    note: signal.reasons.join(" · ") || signal.action,
    reasons: signal.reasons,
    dataState,
    referenceState: evaluation.referenceState,
    sourceAgeSeconds: evaluation.sourceAgeSeconds,
    referenceCondition: evaluation.referenceCondition,
    provider: evaluation.provider,
    providerSymbol: evaluation.providerSymbol,
    provenance: evaluation.provenance,
    strategyFacts: signal.strategyFacts,
    dgv8ChartLevels: signal.dgv8ChartLevels,
    dgv8LevelMap: signal.dgv8LevelMap,
    rawEngineSignal: signal,
  };
}

export async function evaluateCurrentSignals(
  symbol?: string,
  requestedStrategy?: string | null,
  existingQuotes?: Record<string, Quote>,
) {
  await ensureControlPlaneReady();
  const symbols = symbol
    ? [evaluationSymbolIdentity(symbol)]
    : (await listEffectiveMarkets())
        .filter((item) => item.enabled && item.strategyConfigured)
        .map((item) => item.canonicalSymbol);
  const quotes = existingQuotes ?? (await getQuotes());
  const evaluations = (
    await Promise.all(symbols.map((item) => evaluateSymbol(item, requestedStrategy, quotes)))
  ).filter((value): value is AuthoritativeEvaluation => Boolean(value));
  return evaluations;
}

export function diagnosticFor(evaluation: AuthoritativeEvaluation) {
  const signal = evaluation.signal;
  const levelMap = signal.dgv8LevelMap ?? signal.dgv8ChartLevels?.levelMap;
  const facts = signal.strategyFacts ?? {};
  return {
    symbol: evaluation.symbol,
    evaluationId: evaluation.evaluationId,
    evaluationResult: evaluation.result,
    rejectionReason: evaluation.rejectionReason,
    assignmentId: evaluation.assignmentId,
    strategy: signal.strategy,
    strategyVersion: signal.strategyVersion,
    action: signal.action,
    lifecycleStatus: signal.lifecycleStatus,
    direction: signal.direction,
    activeSession: signal.activeSession ?? facts.activeSession ?? "NONE",
    sourceSession: signal.sourceSession ?? facts.sourceSession ?? "NONE",
    buyGate: levelMap?.buy.gate ?? signal.dgv8ChartLevels?.buyGate ?? facts.asia?.high ?? null,
    sellGate: levelMap?.sell.gate ?? signal.dgv8ChartLevels?.sellGate ?? facts.asia?.low ?? null,
    entry: signal.entry ?? null,
    stopLoss: signal.stopLoss ?? null,
    targets: signal.targets,
    selectedBuySource: levelMap?.source.selectedBuySource ?? null,
    selectedSellSource: levelMap?.source.selectedSellSource ?? null,
    sourceRange:
      levelMap?.sourceSessionRange ?? facts.sourceRange?.range ?? facts.asia?.range ?? null,
    gateSeparation: levelMap?.gateSeparation ?? null,
    rangeFilterValue: levelMap?.rangeFilterValue ?? null,
    rangeFilterPass: levelMap?.rangePass ?? null,
    sourceCandleCount: levelMap?.source.candleCount ?? 0,
    pivots: levelMap?.pivotsDebug ?? [],
    dataState: evaluation.dataState,
    provider: evaluation.provider,
    providerSymbol: evaluation.providerSymbol,
    provenance: evaluation.provenance,
    validation: evaluation.validation,
    reasons: signal.reasons,
  };
}

export function fallbackClassFor(symbol: string) {
  const identity = evaluationSymbolIdentity(symbol);
  return (
    marketCatalog.get(identity)?.assetClass ?? FallbackMap.getConfig(identity)?.brokerClass ?? null
  );
}
