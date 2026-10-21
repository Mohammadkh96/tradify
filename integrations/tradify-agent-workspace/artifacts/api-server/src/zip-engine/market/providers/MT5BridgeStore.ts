import { env } from "@workspace/config";
import crypto from "crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { tradifyMt5BridgeState, tradifyMt5Candles } from "@workspace/db/schema";
import { Candle, QuoteData } from "../types";
import { marketCatalog, type BrokerSymbolSpecification } from "../MarketCatalog";
import { SymbolMapper, CanonicalSymbol } from "../SymbolMapper";
import { mt5WatchlistSymbolIdentity } from "../MT5WatchlistCatalog";
import { normalizeBridgeCandleTime, normalizeBrokerTime } from "../CandleTime";
import { findMissingMt5M15Intervals } from "../Mt5HistoryCoverage";
import { logger } from "../../../lib/logger";

export interface MT5Quote {
  symbol: string; // Broker symbol (e.g., XAUUSD, GOLD, USTEC)
  quoteOnly?: boolean;
  bid: number;
  ask: number;
  last: number;
  mid: number;
  chartMode: "BID" | "LAST" | "MID";
  strategyPrice: number;
  displayPrice: number;
  change: number;
  changePercent: number;
  time: number; // Unix seconds
  timeMsc?: number;
  receivedAt: number; // Date.now()
}

export type MT5OperationalHealth = "CONNECTED" | "STALE" | "DEGRADED" | "CRITICAL";

export interface MT5BridgeStatus {
  bridgeId: string;
  server: string;
  serverGenerationId: string;
  connected: boolean;
  lastHeartbeat: number;
  status: "CONNECTED" | "DISCONNECTED" | "BROKER_DISCONNECTED";
  availableSymbols: string[];
  activeSymbols: string[];
  discoveredCount: number;
  activeCount: number;
  subscriptionVersion: number;
  mappings: Record<string, string>; // Canonical -> Broker Symbol
  quoteCount: number;
  rejectedCandleCount: number;
  healthState: MT5OperationalHealth;
  healthReasons: string[];
}

const MT5_PERSISTENCE_LOCK_KEY = 218_000_005;
const MT5_BROKER_SPECIFICATIONS_REFRESH_INTERVAL_MS = 5_000;
let mt5BatchSequence = 0;

function nextBatchUpdatedAt(now: number): string {
  mt5BatchSequence += 1;
  return `${new Date(now).toISOString()}|${String(mt5BatchSequence).padStart(12, "0")}`;
}

function positiveNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function safeInteger(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}

function brokerSpecificationReceivedAt(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const receivedAt = (value as { receivedAt?: unknown }).receivedAt;
  const number = typeof receivedAt === "number" ? receivedAt : Number(receivedAt);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function mergeBrokerSpecificationSnapshots(
  ...sources: unknown[]
): Record<string, Record<string, unknown>> {
  const merged: Record<string, Record<string, unknown>> = {};
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const normalizedKey = key.trim().toUpperCase();
      if (!normalizedKey) continue;
      const current = merged[normalizedKey];
      if (
        !current ||
        brokerSpecificationReceivedAt(value) >= brokerSpecificationReceivedAt(current)
      ) {
        merged[normalizedKey] = value as Record<string, unknown>;
      }
    }
  }
  return merged;
}

function parseBrokerTradingSessions(
  value: unknown,
  receivedAt: number,
): BrokerSymbolSpecification["tradingSessions"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  if (input.source !== "MT5_SYMBOL_INFO_SESSION_TRADE" || input.complete !== true) return undefined;
  const serverTime = safeInteger(input.serverTime);
  const utcTime = safeInteger(input.utcTime);
  if (!serverTime || !utcTime || Math.abs(utcTime * 1000 - receivedAt) > 120_000) return undefined;

  const serverUtcOffsetSeconds = serverTime - utcTime;
  if (Math.abs(serverUtcOffsetSeconds) > 14 * 60 * 60 || serverUtcOffsetSeconds % 60 !== 0)
    return undefined;
  if (!Array.isArray(input.sessions) || input.sessions.length === 0 || input.sessions.length > 84)
    return undefined;

  const sessions: NonNullable<BrokerSymbolSpecification["tradingSessions"]>["sessions"] = [];
  const seen = new Set<string>();
  for (const value of input.sessions) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const session = value as Record<string, unknown>;
    const dayOfWeek = safeInteger(session.dayOfWeek);
    const fromSeconds = safeInteger(session.fromSeconds);
    const toSeconds = safeInteger(session.toSeconds);
    if (
      dayOfWeek === undefined ||
      dayOfWeek < 0 ||
      dayOfWeek > 6 ||
      fromSeconds === undefined ||
      fromSeconds < 0 ||
      fromSeconds >= 86_400 ||
      toSeconds === undefined ||
      toSeconds < 0 ||
      toSeconds > 86_400 ||
      fromSeconds === toSeconds
    )
      return undefined;
    const key = `${dayOfWeek}:${fromSeconds}:${toSeconds}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    sessions.push({ dayOfWeek, fromSeconds, toSeconds });
  }

  return {
    source: "MT5_SYMBOL_INFO_SESSION_TRADE",
    serverTime,
    utcTime,
    serverUtcOffsetSeconds,
    sessions,
  };
}

function parsePersistedBrokerSpecification(value: unknown): BrokerSymbolSpecification | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const brokerSymbol = typeof input.brokerSymbol === "string" ? input.brokerSymbol.trim() : "";
  const receivedAt = safeInteger(input.receivedAt);
  if (!brokerSymbol || receivedAt === undefined || receivedAt <= 0) return undefined;

  let tradingSessions: BrokerSymbolSpecification["tradingSessions"];
  if (
    input.tradingSessions &&
    typeof input.tradingSessions === "object" &&
    !Array.isArray(input.tradingSessions)
  ) {
    const storedSchedule = input.tradingSessions as Record<string, unknown>;
    const parsedSchedule = parseBrokerTradingSessions(
      {
        source: storedSchedule.source,
        complete: true,
        serverTime: storedSchedule.serverTime,
        utcTime: storedSchedule.utcTime,
        sessions: storedSchedule.sessions,
      },
      receivedAt,
    );
    const storedOffset = safeInteger(storedSchedule.serverUtcOffsetSeconds);
    if (parsedSchedule && storedOffset === parsedSchedule.serverUtcOffsetSeconds) {
      tradingSessions = parsedSchedule;
    }
  }

  const digits = safeInteger(input.digits);
  const quoteCurrency =
    typeof input.quoteCurrency === "string" ? input.quoteCurrency.trim().toUpperCase() : undefined;
  return {
    brokerSymbol,
    contractSize: positiveNumber(input.contractSize),
    tickSize: positiveNumber(input.tickSize),
    tickValue: positiveNumber(input.tickValue),
    tickValueProfit: positiveNumber(input.tickValueProfit),
    tickValueLoss: positiveNumber(input.tickValueLoss),
    volumeMin: positiveNumber(input.volumeMin),
    volumeMax: positiveNumber(input.volumeMax),
    volumeStep: positiveNumber(input.volumeStep),
    digits: digits !== undefined && digits >= 0 ? digits : undefined,
    point: positiveNumber(input.point),
    quoteCurrency: quoteCurrency || undefined,
    receivedAt,
    ...(tradingSessions ? { tradingSessions } : {}),
  };
}

function quoteReceivedAt(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const receivedAt = (value as { receivedAt?: unknown }).receivedAt;
  const number = typeof receivedAt === "number" ? receivedAt : Number(receivedAt);
  return Number.isFinite(number) ? number : 0;
}

export class MT5BridgeStore {
  private static readonly instances = new Map<string, MT5BridgeStore>();

  constructor(private readonly stateId = "PRIMARY") {}

  private get isCustomerScoped(): boolean {
    return this.stateId.startsWith("CUSTOMER:");
  }

  private bridgeId = "laptop-dev-primary";
  private secret = env.mt5BridgeSecret ?? "";
  private serverName = "MT5-Broker";
  private connected = false;
  private lastHeartbeat = 0;
  private availableSymbols: string[] = [];
  private activeSymbols: string[] = [];
  private discoveredCount: number = 0;
  private activeCount: number = 0;
  private subscriptionVersion: number = 0;
  private serverGenerationId: string = crypto.randomUUID();
  private fullSyncKeys = new Set<string>();
  private rejectedCandleCount = 0;
  private brokerSpecifications = new Map<string, BrokerSymbolSpecification>();

  // Mappings: Tradify Canonical Symbol -> MT5 Broker Symbol
  private mappings: Record<string, string> = {
    XAUUSD: "XAUUSD",
    XAGUSD: "XAGUSD",
    USOIL: "USOIL",
    US100: "US100",
    US30: "US30",
    US500: "US500",
    GER40: "GER40",
    UK100: "UK100",
    JP225: "JP225",
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
    BTCUSD: "BTCUSD",
    ETHUSD: "ETHUSD",
  };

  // Quotes keyed by MT5 broker symbol (lowercase or exact string)
  private quotes: Map<string, MT5Quote> = new Map();

  // Candles keyed by `${brokerSymbol}:${timeframe}`
  private candles: Map<string, Candle[]> = new Map();

  // Event Listeners for SSE Stream
  private quoteListeners: Set<(quote: MT5Quote, canonicalSymbol: string) => void> = new Set();
  private statusListeners: Set<(status: MT5BridgeStatus) => void> = new Set();
  private candleListeners: Set<(symbol: string, timeframe: string, candles: Candle[]) => void> =
    new Set();
  private hydrated = false;
  private hydrationPromise: Promise<void> | undefined;
  private persistenceQueue: Promise<void> = Promise.resolve();
  private brokerSpecificationsRefreshPromise: Promise<void> | undefined;
  private lastBrokerSpecificationsRefreshAt = 0;

  public subscribeQuotes(fn: (quote: MT5Quote, canonicalSymbol: string) => void) {
    this.quoteListeners.add(fn);
    return () => this.quoteListeners.delete(fn);
  }

  public subscribeStatus(fn: (status: MT5BridgeStatus) => void) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  public subscribeCandles(fn: (symbol: string, timeframe: string, candles: Candle[]) => void) {
    this.candleListeners.add(fn);
    return () => this.candleListeners.delete(fn);
  }

  public static getInstance(stateId = "PRIMARY"): MT5BridgeStore {
    let instance = MT5BridgeStore.instances.get(stateId);
    if (!instance) {
      instance = new MT5BridgeStore(stateId);
      MT5BridgeStore.instances.set(stateId, instance);
    }
    return instance;
  }

  /**
   * Load the shared bridge snapshot and candle rows before serving a request.
   * The local maps remain a cache for synchronous bridge callbacks and tests,
   * while PostgreSQL is the source of truth across API instances.
   */
  public async hydrateFromPersistence(): Promise<void> {
    if (this.hydrated) {
      await this.refreshBrokerSpecificationsFromPersistence();
      return;
    }
    if (this.hydrationPromise) return this.hydrationPromise;

    this.hydrationPromise = (async () => {
      const [state] = await db
        .select()
        .from(tradifyMt5BridgeState)
        .where(eq(tradifyMt5BridgeState.id, this.stateId))
        .limit(1);

      if (state) {
        this.bridgeId = state.bridgeId;
        this.serverName = state.serverName;
        this.serverGenerationId = state.serverGenerationId;
        this.connected = state.connected;
        this.lastHeartbeat = state.lastHeartbeat;
        this.availableSymbols = state.availableSymbols;
        this.activeSymbols = state.activeSymbols;
        this.subscriptionVersion = state.subscriptionVersion;
        this.mappings = { ...this.mappings, ...state.mappings };
        this.fullSyncKeys = new Set(state.fullSyncKeys);
        this.rejectedCandleCount = state.rejectedCandleCount;
        this.quotes.clear();
        for (const quote of Object.values(state.quotes)) {
          if (!quote || typeof quote !== "object" || Array.isArray(quote)) continue;
          const record = quote as MT5Quote;
          if (typeof record.symbol === "string") {
            this.quotes.set(record.symbol, record);
            this.quotes.set(record.symbol.toUpperCase(), record);
            const canonical = record.quoteOnly ? "" : this.resolveCanonicalSymbol(record.symbol);
            if (canonical) this.quotes.set(canonical, record);
          }
        }
        for (const [canonical, brokerSymbol] of Object.entries(this.mappings)) {
          const keyIdentity = this.resolveCanonicalSymbol(canonical);
          const brokerIdentity = this.resolveCanonicalSymbol(brokerSymbol);
          if (brokerIdentity !== keyIdentity && marketCatalog.get(brokerIdentity)) {
            delete this.mappings[canonical];
            this.mappings[brokerIdentity] = brokerSymbol;
            this.registerBrokerMappingIfCanonical(brokerIdentity, brokerSymbol);
            continue;
          }
          this.mappings[keyIdentity] = brokerSymbol;
          this.registerBrokerMappingIfCanonical(keyIdentity, brokerSymbol);
        }
        this.replaceBrokerSpecifications(state.brokerSpecifications);
      }

      const rows = await db
        .select()
        .from(tradifyMt5Candles)
        .where(eq(tradifyMt5Candles.scopeId, this.stateId))
        .orderBy(asc(tradifyMt5Candles.time));
      this.candles.clear();
      for (const row of rows) {
        this.setCandleAliases(row.brokerSymbol, row.timeframe, [
          {
            time: row.time,
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
            volume: row.volume,
          },
        ]);
      }
      this.lastBrokerSpecificationsRefreshAt = Date.now();
      this.hydrated = true;
    })().catch((error) => {
      this.hydrationPromise = undefined;
      logger.error({ error }, "Unable to hydrate MT5 bridge state");
      throw error;
    });

    return this.hydrationPromise;
  }

  public async refreshBrokerSpecificationsFromPersistence(force = false): Promise<void> {
    if (!this.hydrated) {
      await this.hydrateFromPersistence();
      return;
    }
    if (
      !force &&
      Date.now() - this.lastBrokerSpecificationsRefreshAt <
        MT5_BROKER_SPECIFICATIONS_REFRESH_INTERVAL_MS
    ) {
      return;
    }
    if (this.brokerSpecificationsRefreshPromise) return this.brokerSpecificationsRefreshPromise;

    this.brokerSpecificationsRefreshPromise = (async () => {
      const [state] = await db
        .select({ brokerSpecifications: tradifyMt5BridgeState.brokerSpecifications })
        .from(tradifyMt5BridgeState)
        .where(eq(tradifyMt5BridgeState.id, this.stateId))
        .limit(1);
      this.replaceBrokerSpecifications(state?.brokerSpecifications ?? {});
      this.lastBrokerSpecificationsRefreshAt = Date.now();
    })()
      .catch((error) => {
        logger.error({ error }, "Unable to refresh shared MT5 broker specifications");
        throw error;
      })
      .finally(() => {
        this.brokerSpecificationsRefreshPromise = undefined;
      });

    return this.brokerSpecificationsRefreshPromise;
  }

  private replaceBrokerSpecifications(snapshot: unknown): void {
    const specifications = mergeBrokerSpecificationSnapshots(snapshot);
    const restored = new Map<string, BrokerSymbolSpecification>();
    for (const [key, value] of Object.entries(specifications)) {
      const specification = parsePersistedBrokerSpecification(value);
      if (!specification) continue;
      const canonical =
        mt5WatchlistSymbolIdentity(specification.brokerSymbol) ??
        this.resolveCanonicalSymbol(key) ??
        this.resolveCanonicalSymbol(specification.brokerSymbol);
      if (!canonical || !marketCatalog.get(canonical)) continue;
      const current = restored.get(canonical);
      if (!current || specification.receivedAt >= current.receivedAt) {
        restored.set(canonical, specification);
      }
    }
    this.brokerSpecifications = restored;
    if (!this.isCustomerScoped) marketCatalog.clearBrokerSpecifications();
    for (const [canonical, specification] of restored.entries()) {
      this.mappings[canonical] = specification.brokerSymbol;
      this.registerBrokerMappingIfCanonical(canonical, specification.brokerSymbol);
    }
    if (!this.isCustomerScoped && restored.size > 0) {
      marketCatalog.syncBrokerSpecifications([...restored.values()]);
    }
  }

  private snapshotBrokerSpecifications(): Record<string, Record<string, unknown>> {
    return Object.fromEntries(this.brokerSpecifications.entries()) as unknown as Record<
      string,
      Record<string, unknown>
    >;
  }

  public flushPersistence(): Promise<void> {
    return this.persistenceQueue;
  }

  private enqueuePersistence(work: () => Promise<void>): void {
    const nextPersistence = this.persistenceQueue.catch(() => undefined).then(work);
    nextPersistence.catch((error) => {
      logger.error({ error }, "Unable to persist MT5 bridge state");
    });
    this.persistenceQueue = nextPersistence;
  }

  private snapshotQuotes(): Record<string, unknown> {
    return Object.fromEntries(this.getAllQuotesEntries());
  }

  private getAllQuotesEntries(): Array<[string, MT5Quote]> {
    const entries: Array<[string, MT5Quote]> = [];
    for (const [key, quote] of this.quotes.entries()) {
      if (key === key.toUpperCase()) entries.push([key, quote]);
    }
    return entries;
  }

  private async persistState(rejectedCandleDelta = 0): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${MT5_PERSISTENCE_LOCK_KEY})`);
      await this.persistStateWithinTransaction(tx, rejectedCandleDelta);
    });
  }

  private async persistStateWithinTransaction(
    database: any,
    rejectedCandleDelta: number,
  ): Promise<void> {
    const [existingState] = await database
      .select({
        bridgeId: tradifyMt5BridgeState.bridgeId,
        serverName: tradifyMt5BridgeState.serverName,
        serverGenerationId: tradifyMt5BridgeState.serverGenerationId,
        connected: tradifyMt5BridgeState.connected,
        availableSymbols: tradifyMt5BridgeState.availableSymbols,
        activeSymbols: tradifyMt5BridgeState.activeSymbols,
        subscriptionVersion: tradifyMt5BridgeState.subscriptionVersion,
        mappings: tradifyMt5BridgeState.mappings,
        brokerSpecifications: tradifyMt5BridgeState.brokerSpecifications,
        fullSyncKeys: tradifyMt5BridgeState.fullSyncKeys,
        rejectedCandleCount: tradifyMt5BridgeState.rejectedCandleCount,
        lastHeartbeat: tradifyMt5BridgeState.lastHeartbeat,
        quotes: tradifyMt5BridgeState.quotes,
      })
      .from(tradifyMt5BridgeState)
      .where(eq(tradifyMt5BridgeState.id, this.stateId))
      .limit(1);

    const fullSyncKeys = new Set<string>(existingState?.fullSyncKeys ?? []);
    for (const key of this.fullSyncKeys) fullSyncKeys.add(key);

    // Candle and heartbeat writes can come from an instance whose local quote
    // cache predates a quote already committed by another instance. Keep the
    // newest record for each persisted symbol instead of replacing the shared
    // snapshot with that stale local cache.
    const mergedQuotes: Record<string, unknown> = {};
    const mergeQuotes = (source: unknown) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) return;
      for (const [key, quote] of Object.entries(source as Record<string, unknown>)) {
        const normalizedKey = key.toUpperCase();
        const previous = mergedQuotes[normalizedKey];
        if (previous === undefined || quoteReceivedAt(quote) > quoteReceivedAt(previous)) {
          mergedQuotes[normalizedKey] = quote;
        }
      }
    };
    mergeQuotes(existingState?.quotes);
    mergeQuotes(this.snapshotQuotes());
    const brokerSpecifications = mergeBrokerSpecificationSnapshots(
      existingState?.brokerSpecifications,
      this.snapshotBrokerSpecifications(),
    );

    const existingHeartbeat = Number(existingState?.lastHeartbeat);
    const localHeartbeat = Number(this.lastHeartbeat);
    const localHeartbeatIsNewest =
      !existingState || (Number.isFinite(localHeartbeat) && localHeartbeat > existingHeartbeat);
    const lastHeartbeat = Math.max(
      Number.isFinite(existingHeartbeat) ? existingHeartbeat : 0,
      Number.isFinite(localHeartbeat) ? localHeartbeat : 0,
    );
    // Keep bridge status as one coherent heartbeat snapshot. In particular,
    // do not let a stale process's disconnected/default metadata accompany a
    // newer heartbeat. Subscription version and mappings are part of that
    // administrative snapshot, so they must follow the same writer.
    const bridgeId = localHeartbeatIsNewest ? this.bridgeId : existingState.bridgeId;
    const serverName = localHeartbeatIsNewest ? this.serverName : existingState.serverName;
    const serverGenerationId = localHeartbeatIsNewest
      ? this.serverGenerationId
      : existingState.serverGenerationId;
    const connected = localHeartbeatIsNewest ? this.connected : existingState.connected;
    const availableSymbols = localHeartbeatIsNewest
      ? this.availableSymbols
      : existingState.availableSymbols;
    const activeSymbols = localHeartbeatIsNewest ? this.activeSymbols : existingState.activeSymbols;
    const subscriptionVersion = localHeartbeatIsNewest
      ? this.subscriptionVersion
      : existingState.subscriptionVersion;
    const mappings = localHeartbeatIsNewest ? this.mappings : existingState.mappings;

    await database
      .insert(tradifyMt5BridgeState)
      .values({
        id: this.stateId,
        bridgeId,
        serverName,
        serverGenerationId,
        connected,
        lastHeartbeat,
        availableSymbols,
        activeSymbols,
        subscriptionVersion,
        mappings,
        brokerSpecifications,
        quotes: mergedQuotes,
        fullSyncKeys: [...fullSyncKeys],
        rejectedCandleCount: existingState
          ? existingState.rejectedCandleCount + rejectedCandleDelta
          : this.rejectedCandleCount,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: tradifyMt5BridgeState.id,
        set: {
          bridgeId,
          serverName,
          serverGenerationId,
          connected,
          lastHeartbeat,
          availableSymbols,
          activeSymbols,
          subscriptionVersion,
          mappings,
          brokerSpecifications,
          quotes: mergedQuotes,
          fullSyncKeys: [...fullSyncKeys],
          rejectedCandleCount: existingState
            ? existingState.rejectedCandleCount + rejectedCandleDelta
            : this.rejectedCandleCount,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  private setCandleAliases(symbol: string, timeframe: string, candles: Candle[]): void {
    const mappedBrok = this.getMappedBrokerSymbol(symbol);
    const canonical = this.resolveCanonicalSymbol(symbol);
    const keys = [
      `${symbol}:${timeframe}`,
      `${symbol.toUpperCase()}:${timeframe}`,
      `${mappedBrok}:${timeframe}`,
      `${canonical}:${timeframe}`,
    ];
    for (const key of keys) {
      this.candles.set(key, candles.slice(-1000));
    }
  }

  private async persistCandles(
    symbol: string,
    timeframe: string,
    candles: Candle[],
    rejectedCandleDelta: number,
    batchUpdatedAt: string,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Serialize the upsert and retention query so concurrent API instances
      // cannot prune rows that another instance committed moments earlier.
      await tx.execute(sql`select pg_advisory_xact_lock(${MT5_PERSISTENCE_LOCK_KEY})`);

      if (candles.length > 0) {
        await tx
          .insert(tradifyMt5Candles)
          .values(
            candles.map((candle) => ({
              scopeId: this.stateId,
              brokerSymbol: symbol,
              timeframe,
              time: candle.time,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume ?? 0,
              updatedAt: batchUpdatedAt,
            })),
          )
          .onConflictDoUpdate({
            target: [
              tradifyMt5Candles.scopeId,
              tradifyMt5Candles.brokerSymbol,
              tradifyMt5Candles.timeframe,
              tradifyMt5Candles.time,
            ],
            set: {
              open: sql`CASE WHEN excluded.updated_at >= ${tradifyMt5Candles.updatedAt} THEN excluded.open ELSE ${tradifyMt5Candles.open} END`,
              high: sql`CASE WHEN excluded.updated_at >= ${tradifyMt5Candles.updatedAt} THEN excluded.high ELSE ${tradifyMt5Candles.high} END`,
              low: sql`CASE WHEN excluded.updated_at >= ${tradifyMt5Candles.updatedAt} THEN excluded.low ELSE ${tradifyMt5Candles.low} END`,
              close: sql`CASE WHEN excluded.updated_at >= ${tradifyMt5Candles.updatedAt} THEN excluded.close ELSE ${tradifyMt5Candles.close} END`,
              volume: sql`CASE WHEN excluded.updated_at >= ${tradifyMt5Candles.updatedAt} THEN excluded.volume ELSE ${tradifyMt5Candles.volume} END`,
              updatedAt: sql`CASE WHEN excluded.updated_at >= ${tradifyMt5Candles.updatedAt} THEN excluded.updated_at ELSE ${tradifyMt5Candles.updatedAt} END`,
            },
          });
      }

      const staleRows = await tx
        .select({ time: tradifyMt5Candles.time })
        .from(tradifyMt5Candles)
        .where(
          and(
            eq(tradifyMt5Candles.scopeId, this.stateId),
            eq(tradifyMt5Candles.brokerSymbol, symbol),
            eq(tradifyMt5Candles.timeframe, timeframe),
          ),
        )
        .orderBy(asc(tradifyMt5Candles.time));
      if (staleRows.length > 1000) {
        await tx.delete(tradifyMt5Candles).where(
          and(
            eq(tradifyMt5Candles.scopeId, this.stateId),
            eq(tradifyMt5Candles.brokerSymbol, symbol),
            eq(tradifyMt5Candles.timeframe, timeframe),
            inArray(
              tradifyMt5Candles.time,
              staleRows.slice(0, staleRows.length - 1000).map((row) => row.time),
            ),
          ),
        );
      }

      await this.persistStateWithinTransaction(tx, rejectedCandleDelta);
    });
  }

  public async getCandlesForBrokerSymbolPersisted(
    brokerSymbol: string,
    timeframe: string,
  ): Promise<Candle[] | null> {
    await this.hydrateFromPersistence();
    const normalizedTimeframe = timeframe.toUpperCase();
    const mappedBrok = this.getMappedBrokerSymbol(brokerSymbol);
    const canonical = this.resolveCanonicalSymbol(brokerSymbol);
    const candidates = [
      ...new Set([brokerSymbol, brokerSymbol.toUpperCase(), mappedBrok, canonical].filter(Boolean)),
    ];
    const rows = await db
      .select()
      .from(tradifyMt5Candles)
      .where(
        and(
          eq(tradifyMt5Candles.scopeId, this.stateId),
          inArray(tradifyMt5Candles.brokerSymbol, candidates),
          eq(tradifyMt5Candles.timeframe, normalizedTimeframe),
        ),
      )
      .orderBy(asc(tradifyMt5Candles.time));
    if (rows.length === 0) return this.getCandlesForBrokerSymbol(brokerSymbol, normalizedTimeframe);

    const grouped = new Map<string, Candle[]>();
    for (const row of rows) {
      const list = grouped.get(row.brokerSymbol) ?? [];
      list.push({
        time: row.time,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      });
      grouped.set(row.brokerSymbol, list);
    }
    const activeBrokerSource = grouped.get(mappedBrok) ?? grouped.get(mappedBrok.toUpperCase());
    const localActiveBrokerSource =
      this.candles.get(`${mappedBrok}:${normalizedTimeframe}`) ??
      this.candles.get(`${mappedBrok.toUpperCase()}:${normalizedTimeframe}`);
    const localActiveBrokerIsNewer = Boolean(
      localActiveBrokerSource?.at(-1) &&
      localActiveBrokerSource.at(-1)!.time > (activeBrokerSource?.at(-1)?.time ?? 0),
    );
    const source =
      (localActiveBrokerIsNewer ? localActiveBrokerSource : undefined) ??
      activeBrokerSource ??
      localActiveBrokerSource ??
      [...grouped.values()].sort((left, right) => right.length - left.length)[0] ??
      [];
    this.setCandleAliases(canonical || brokerSymbol, normalizedTimeframe, source);
    return source;
  }

  public async getQuoteForBrokerSymbolPersisted(brokerSymbol: string): Promise<MT5Quote | null> {
    await this.hydrateFromPersistence();
    const [state] = await db
      .select({ quotes: tradifyMt5BridgeState.quotes, mappings: tradifyMt5BridgeState.mappings })
      .from(tradifyMt5BridgeState)
      .where(eq(tradifyMt5BridgeState.id, this.stateId))
      .limit(1);
    if (state) {
      this.mappings = { ...this.mappings, ...state.mappings };
      for (const quote of Object.values(state.quotes)) {
        if (!quote || typeof quote !== "object" || Array.isArray(quote)) continue;
        const record = quote as MT5Quote;
        if (typeof record.symbol === "string") {
          const canonical = this.resolveCanonicalSymbol(record.symbol);
          const current = [
            this.quotes.get(record.symbol),
            this.quotes.get(record.symbol.toUpperCase()),
            canonical ? this.quotes.get(canonical) : undefined,
          ].reduce<MT5Quote | undefined>(
            (newest, candidate) =>
              candidate && quoteReceivedAt(candidate) > quoteReceivedAt(newest)
                ? candidate
                : newest,
            undefined,
          );
          if (!current || quoteReceivedAt(record) >= quoteReceivedAt(current)) {
            this.quotes.set(record.symbol, record);
            this.quotes.set(record.symbol.toUpperCase(), record);
            if (canonical) this.quotes.set(canonical, record);
          }
        }
      }
    }
    return this.getQuoteForBrokerSymbol(brokerSymbol);
  }

  public clearQuotes() {
    this.quotes.clear();
  }

  public async reset(): Promise<void> {
    if (this.brokerSpecificationsRefreshPromise) await this.brokerSpecificationsRefreshPromise;
    this.quotes.clear();
    this.candles.clear();
    this.availableSymbols = [];
    this.activeSymbols = [];
    this.discoveredCount = 0;
    this.activeCount = 0;
    this.subscriptionVersion = 0;
    this.fullSyncKeys.clear();
    this.rejectedCandleCount = 0;
    this.brokerSpecifications.clear();
    if (!this.isCustomerScoped) marketCatalog.clearBrokerSpecifications();
    this.lastBrokerSpecificationsRefreshAt = Date.now();
    this.serverGenerationId = crypto.randomUUID();
    this.lastHeartbeat = 0;
    this.connected = false;
    this.hydrated = false;
    this.hydrationPromise = undefined;

    await this.flushPersistence();
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${MT5_PERSISTENCE_LOCK_KEY})`);
      await tx
        .update(tradifyMt5BridgeState)
        .set({ brokerSpecifications: {}, updatedAt: new Date().toISOString() })
        .where(eq(tradifyMt5BridgeState.id, this.stateId));
    });
    this.lastBrokerSpecificationsRefreshAt = Date.now();
  }

  public validateSecret(providedSecret?: string): boolean {
    if (!providedSecret || typeof providedSecret !== "string") return false;
    const expectedSecret = this.secret;
    if (!expectedSecret) return false;

    try {
      const a = Buffer.from(providedSecret, "utf8");
      const b = Buffer.from(expectedSecret, "utf8");
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  public updateHeartbeat(data: {
    bridgeId: string;
    server?: string;
    connected?: boolean;
    symbols?: string[];
    activeSymbols?: string[];
    discovered?: number;
    active?: number;
    subscriptionVersion?: number;
  }) {
    this.hydrated = true;
    if (data.bridgeId) this.bridgeId = data.bridgeId;
    if (data.server) this.serverName = data.server;
    this.connected = data.connected !== undefined ? data.connected : true;
    this.lastHeartbeat = Date.now();

    if (data.discovered !== undefined) this.discoveredCount = data.discovered;
    if (data.active !== undefined) this.activeCount = data.active;
    if (data.subscriptionVersion !== undefined) this.subscriptionVersion = data.subscriptionVersion;

    if (Array.isArray(data.activeSymbols)) {
      this.activeSymbols = data.activeSymbols;
    }

    if (Array.isArray(data.symbols) && data.symbols.length > 0) {
      this.availableSymbols = data.symbols;
      this.discoveredCount = data.symbols.length; // fallback
      if (!this.isCustomerScoped) marketCatalog.syncDiscoveredSymbols(data.symbols);
      for (const brokerSymbol of data.symbols) {
        const canonical = this.resolveCanonicalSymbol(brokerSymbol);
        if (marketCatalog.get(canonical)) {
          this.mappings[canonical] = brokerSymbol;
          this.registerBrokerMappingIfCanonical(canonical, brokerSymbol);
        }
      }
    }

    for (const activeBrokerSymbol of this.activeSymbols) {
      const canonical = this.resolveCanonicalSymbol(activeBrokerSymbol);
      if (!marketCatalog.get(canonical)) continue;
      this.mappings[canonical] = activeBrokerSymbol;
      this.registerBrokerMappingIfCanonical(canonical, activeBrokerSymbol);
    }

    const currentStatus = this.getStatus();
    this.statusListeners.forEach((fn) => {
      try {
        fn(currentStatus);
      } catch (e: any) {
        logger.warn(
          { errorType: e instanceof Error ? e.name : typeof e },
          "MT5 bridge status listener failed",
        );
      }
    });
    this.enqueuePersistence(() => this.persistState());
  }

  public async updateSpecifications(rawSpecifications: unknown): Promise<number> {
    if (!Array.isArray(rawSpecifications)) return 0;

    await this.hydrateFromPersistence();
    const receivedAt = Date.now();
    const specifications: BrokerSymbolSpecification[] = rawSpecifications.flatMap(
      (value): BrokerSymbolSpecification[] => {
        if (!value || typeof value !== "object") return [];
        const input = value as Record<string, unknown>;
        const brokerSymbol =
          typeof input.brokerSymbol === "string" ? input.brokerSymbol.trim() : "";
        if (!brokerSymbol) return [];

        const quoteCurrency =
          typeof input.profitCurrency === "string"
            ? input.profitCurrency.trim().toUpperCase()
            : typeof input.quoteCurrency === "string"
              ? input.quoteCurrency.trim().toUpperCase()
              : undefined;
        const digits = positiveNumber(input.digits);
        return [
          {
            brokerSymbol,
            contractSize: positiveNumber(input.tradeContractSize ?? input.contractSize),
            tickSize: positiveNumber(input.tradeTickSize ?? input.tickSize),
            tickValue: positiveNumber(input.tradeTickValue ?? input.tickValue),
            tickValueProfit: positiveNumber(input.tradeTickValueProfit ?? input.tickValueProfit),
            tickValueLoss: positiveNumber(input.tradeTickValueLoss ?? input.tickValueLoss),
            volumeMin: positiveNumber(input.volumeMin),
            volumeMax: positiveNumber(input.volumeMax),
            volumeStep: positiveNumber(input.volumeStep),
            digits,
            point: positiveNumber(input.point),
            quoteCurrency,
            tradingSessions: parseBrokerTradingSessions(input.tradingSessions, receivedAt),
            receivedAt,
          },
        ];
      },
    );

    const accepted =
      !this.isCustomerScoped
        ? marketCatalog.syncBrokerSpecifications(specifications)
        : specifications.filter((specification) => {
            const canonical = this.resolveCanonicalSymbol(specification.brokerSymbol);
            return Boolean(canonical && marketCatalog.get(canonical));
          }).length;
    let changed = false;
    for (const specification of specifications) {
      const canonical = this.resolveCanonicalSymbol(specification.brokerSymbol);
      if (!canonical || !marketCatalog.get(canonical)) continue;
      const current = this.brokerSpecifications.get(canonical);
      if (!current || specification.receivedAt >= current.receivedAt) {
        this.brokerSpecifications.set(canonical, specification);
        changed = true;
      }
    }

    if (changed) {
      this.lastBrokerSpecificationsRefreshAt = Date.now();
      this.enqueuePersistence(() => this.persistState());
      await this.flushPersistence();
    }
    return accepted;
  }

  public isConnected(): boolean {
    if (!this.connected) return false;
    if (this.lastHeartbeat === 0) return false;
    const ageMs = Date.now() - this.lastHeartbeat;
    return ageMs < 15000; // 15 seconds threshold
  }

  public getStatus(): MT5BridgeStatus {
    const isConn = this.isConnected();
    let status: "CONNECTED" | "DISCONNECTED" | "BROKER_DISCONNECTED" = "DISCONNECTED";
    const heartbeatAgeMs =
      this.lastHeartbeat > 0 ? Math.max(0, Date.now() - this.lastHeartbeat) : null;
    if (isConn) {
      status = "CONNECTED";
    } else if (!this.connected && heartbeatAgeMs !== null && heartbeatAgeMs < 15_000) {
      status = "BROKER_DISCONNECTED";
    }

    const healthReasons: string[] = [];
    let healthState: MT5OperationalHealth;
    if (this.lastHeartbeat === 0) {
      healthState = "CRITICAL";
      healthReasons.push("No MT5 bridge heartbeat has been received.");
    } else if (!isConn) {
      healthState = heartbeatAgeMs !== null && heartbeatAgeMs <= 60_000 ? "STALE" : "CRITICAL";
      healthReasons.push(
        healthState === "STALE"
          ? "The MT5 bridge heartbeat is stale."
          : "The MT5 bridge is disconnected and its heartbeat has expired.",
      );
    } else {
      healthState = "CONNECTED";
      if (this.activeSymbols.length === 0 && this.activeCount === 0) {
        healthState = "DEGRADED";
        healthReasons.push("The bridge is connected but has no active subscriptions.");
      }
      if (this.quotes.size === 0) {
        healthState = "DEGRADED";
        healthReasons.push("The bridge is connected but has not delivered a quote.");
      }
      if (!this.isBackfillCompleted()) {
        healthState = "DEGRADED";
        healthReasons.push(
          "The bridge is connected but M15 history is not complete for every active symbol.",
        );
      }
    }

    return {
      bridgeId: this.bridgeId,
      server: this.serverName,
      serverGenerationId: this.serverGenerationId,
      connected: isConn,
      lastHeartbeat: this.lastHeartbeat,
      status,
      availableSymbols: this.availableSymbols,
      activeSymbols: this.activeSymbols,
      discoveredCount: this.discoveredCount,
      activeCount: this.activeCount,
      subscriptionVersion: this.subscriptionVersion,
      mappings: { ...this.mappings },
      quoteCount: this.quotes.size,
      rejectedCandleCount: this.rejectedCandleCount,
      healthState,
      healthReasons,
    };
  }

  public updateQuotes(
    quotesList: Array<{
      symbol: string;
      bid: number;
      ask: number;
      last?: number;
      chartMode?: "BID" | "LAST" | "MID" | string;
      time?: number;
      timeMsc?: number;
      quoteOnly?: boolean;
    }>,
  ): number {
    this.hydrated = true;
    const now = Date.now();
    let accepted = 0;
    for (const q of quotesList) {
      if (!q.symbol) continue;
      const bid = q.bid || 0;
      const ask = q.ask || 0;
      const lastInput = q.last || 0;
      if (![bid, ask, lastInput].some((value) => Number.isFinite(value) && value > 0)) continue;
      const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : q.last || bid || ask;
      const last = q.last || mid;

      const chartMode: "BID" | "LAST" | "MID" =
        q.chartMode === "LAST" ? "LAST" : q.chartMode === "MID" ? "MID" : "BID";

      // Determine strategy / chart reference price according to MT5 broker SYMBOL_CHART_MODE
      let strategyPrice: number;
      if (chartMode === "LAST") {
        strategyPrice = last > 0 ? last : bid > 0 ? bid : mid;
      } else if (chartMode === "MID") {
        strategyPrice = mid;
      } else {
        // SYMBOL_CHART_MODE_BID
        strategyPrice = bid > 0 ? bid : last > 0 ? last : mid;
      }

      const displayPrice = strategyPrice;
      const canonical = q.quoteOnly ? q.symbol : this.resolveCanonicalSymbol(q.symbol);

      let t = Math.floor(now / 1000);
      if (typeof q.time === "number" && Number.isFinite(q.time) && q.time > 0) {
        t = normalizeBrokerTime(q.time);
      }

      const previous = this.quotes.get(q.quoteOnly ? q.symbol.toUpperCase() : canonical);
      const change = previous ? strategyPrice - previous.strategyPrice : 0;
      const changePercent = previous?.strategyPrice ? (change / previous.strategyPrice) * 100 : 0;
      const record: MT5Quote = {
        symbol: q.symbol,
        bid,
        ask,
        last,
        mid,
        chartMode,
        strategyPrice,
        displayPrice,
        change,
        changePercent,
        time: t,
        timeMsc: q.timeMsc,
        receivedAt: now,
        ...(q.quoteOnly ? { quoteOnly: true } : {}),
      };

      if (!q.quoteOnly && canonical) {
        this.mappings[canonical] = q.symbol;
        this.registerBrokerMappingIfCanonical(canonical, q.symbol);
      }

      this.quotes.set(q.symbol, record);
      this.quotes.set(q.symbol.toUpperCase(), record);
      if (!q.quoteOnly) this.quotes.set(canonical, record);
      accepted += 1;

      if (q.quoteOnly) continue;
      this.quoteListeners.forEach((fn) => {
        try {
          fn(record, canonical);
        } catch (e: any) {
          logger.warn(
            { errorType: e instanceof Error ? e.name : typeof e },
            "MT5 bridge quote listener failed",
          );
        }
      });
    }
    if (accepted > 0) {
      this.connected = true;
      this.lastHeartbeat = now;
      this.enqueuePersistence(() => this.persistState());
    }
    return accepted;
  }

  public resolveCanonicalSymbol(rawSymbol: string): string {
    if (!rawSymbol) return "";
    const watchlistIdentity = mt5WatchlistSymbolIdentity(rawSymbol);
    if (watchlistIdentity && marketCatalog.get(watchlistIdentity)) return watchlistIdentity;
    const normalized = rawSymbol.trim().toUpperCase();
    const exact = marketCatalog.get(normalized);
    if (exact?.canonicalSymbol.toUpperCase() === normalized) return exact.canonicalSymbol;
    const providerMapped = marketCatalog
      .getAll()
      .find((item) => item.providerSymbol.trim().toUpperCase() === normalized);
    if (providerMapped) return providerMapped.canonicalSymbol;
    const result = SymbolMapper.toCanonical(rawSymbol);
    if (result.canonical) {
      return result.canonical;
    }
    // Return empty or raw without guessing
    return rawSymbol.trim();
  }

  public getQuoteForBrokerSymbol(brokerSymbol: string): MT5Quote | null {
    if (!brokerSymbol) return null;
    const mapped = this.getMappedBrokerSymbol(brokerSymbol);
    const canonical = this.resolveCanonicalSymbol(brokerSymbol);

    const q = [
      this.quotes.get(brokerSymbol),
      this.quotes.get(brokerSymbol.toUpperCase()),
      mapped ? this.quotes.get(mapped) : null,
      canonical ? this.quotes.get(canonical) : null,
    ].find((quote) => quote && !quote.quoteOnly);

    if (!q) return null;
    const ageMs = Date.now() - q.receivedAt;
    if (ageMs > 30000) return null; // Stale quote after 30s
    return q;
  }

  public getFreshQuoteForExactBrokerSymbol(brokerSymbol: string): MT5Quote | null {
    const symbol = brokerSymbol.trim();
    if (!symbol) return null;

    const discoveredSymbols = new Set(
      this.availableSymbols.map((value) => value.trim().toUpperCase()),
    );
    if (!discoveredSymbols.has(symbol.toUpperCase())) return null;

    const quote = this.quotes.get(symbol) ?? this.quotes.get(symbol.toUpperCase());
    if (!quote || Date.now() - quote.receivedAt > 30_000) return null;
    return quote;
  }

  public getMappedBrokerSymbol(canonicalSymbol: string): string {
    if (!canonicalSymbol) return "";
    return (
      this.mappings[canonicalSymbol] ??
      marketCatalog.get(canonicalSymbol)?.providerSymbol ??
      SymbolMapper.toBroker(canonicalSymbol)
    );
  }

  public setMapping(canonicalSymbol: string, brokerSymbol: string) {
    const identity = this.resolveCanonicalSymbol(canonicalSymbol);
    this.mappings[identity] = brokerSymbol;
    this.registerBrokerMappingIfCanonical(identity, brokerSymbol);
  }

  public setMappings(newMappings: Record<string, string>) {
    for (const [symbol, brokerSymbol] of Object.entries(newMappings)) {
      const identity = this.resolveCanonicalSymbol(symbol);
      this.mappings[identity] = brokerSymbol;
      this.registerBrokerMappingIfCanonical(identity, brokerSymbol);
    }
  }

  private registerBrokerMappingIfCanonical(symbol: string, brokerSymbol: string): void {
    if (this.isCustomerScoped) return;
    const canonical = SymbolMapper.toCanonical(symbol).canonical;
    if (canonical === symbol) {
      SymbolMapper.registerBrokerMapping(canonical, brokerSymbol);
    }
  }

  public getMappings(): Record<string, string> {
    return { ...this.mappings };
  }

  public updateCandles(
    symbol: string,
    timeframe: string,
    rawCandles: any[],
    syncMode: "FULL" | "PARTIAL" | "INCREMENTAL" = "PARTIAL",
    coverageRange?: { startUtc: number; endUtc: number },
  ): number {
    if (!symbol || !rawCandles || !Array.isArray(rawCandles)) return 0;
    this.hydrated = true;
    const now = Date.now();
    const batchUpdatedAt = nextBatchUpdatedAt(now);
    let rejectedCandleDelta = 0;

    const parsed: Candle[] = rawCandles.flatMap((c): Candle[] => {
      if (!c || typeof c !== "object") {
        this.rejectedCandleCount += 1;
        rejectedCandleDelta += 1;
        return [];
      }
      const t = normalizeBridgeCandleTime(c as Record<string, unknown>, timeframe);
      const candle: Candle = {
        time: t,
        open: Number(c.open) || 0,
        high: Number(c.high) || 0,
        low: Number(c.low) || 0,
        close: Number(c.close) || 0,
        volume: Number(c.volume) || 0,
      };
      const valid =
        candle.time > 0 &&
        candle.open > 0 &&
        candle.high >= candle.low &&
        candle.high >= candle.open &&
        candle.high >= candle.close &&
        candle.low <= candle.open &&
        candle.low <= candle.close;
      if (!valid) this.rejectedCandleCount += 1;
      if (!valid) rejectedCandleDelta += 1;
      return valid ? [candle] : [];
    });
    if (parsed.length > 0) {
      this.connected = true;
      this.lastHeartbeat = now;
    }

    const mappedBrok = this.getMappedBrokerSymbol(symbol);
    const canonical = this.resolveCanonicalSymbol(symbol);

    const key1 = `${symbol}:${timeframe}`;
    const key2 = `${symbol.toUpperCase()}:${timeframe}`;
    const key3 = `${mappedBrok}:${timeframe}`;
    const key4 = `${canonical}:${timeframe}`;

    const existing1 = this.candles.get(key1) || [];
    const existing2 = this.candles.get(key2) || [];
    const existing3 = this.candles.get(key3) || [];
    const existing4 = this.candles.get(key4) || [];
    const existing = [existing1, existing2, existing3, existing4].reduce(
      (max, arr) => (arr.length > max.length ? arr : max),
      [],
    );

    const map = new Map<number, Candle>();
    for (const c of existing) {
      map.set(c.time, c);
    }
    for (const c of parsed) {
      map.set(c.time, c); // Upsert / update by open time
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.time - b.time);

    // Keep up to 1000 bars per symbol/timeframe
    const trimmed = sorted.slice(-1000);

    this.setCandleAliases(symbol, timeframe, trimmed);

    // A FULL M15 claim is trusted only after verifying the exact ten-day
    // session-open range against the merged stored series. Track each symbol
    // separately so one complete symbol cannot make the bridge report ready.
    if (timeframe.toUpperCase() === "M15" && syncMode === "FULL") {
      const key = `${canonical.toUpperCase()}:M15`;
      const schedule = marketCatalog.getCurrentBrokerTradingSessions(
        canonical,
        symbol,
        now,
      );
      let verified = false;
      try {
        if (
          coverageRange &&
          Number.isSafeInteger(coverageRange.startUtc) &&
          Number.isSafeInteger(coverageRange.endUtc) &&
          coverageRange.endUtc - coverageRange.startUtc === 10 * 86_400 &&
          schedule
        ) {
          verified =
            findMissingMt5M15Intervals(
              coverageRange.startUtc,
              coverageRange.endUtc,
              trimmed.map((candle) => candle.time),
              schedule,
            ).length === 0;
        }
      } catch (error) {
        logger.warn(
          {
            symbol,
            errorType: error instanceof Error ? error.name : typeof error,
          },
          "MT5 FULL batch coverage verification failed",
        );
      }
      if (verified && trimmed.length >= 50) this.fullSyncKeys.add(key);
      else {
        this.fullSyncKeys.delete(key);
        logger.warn(
          { symbol, hasSchedule: Boolean(schedule), hasCoverageRange: Boolean(coverageRange) },
          "MT5 M15 FULL readiness withheld because complete ten-day coverage was not verified",
        );
      }
    }

    this.candleListeners.forEach((fn) => {
      try {
        fn(symbol, timeframe, trimmed);
      } catch (e: any) {
        logger.warn(
          { errorType: e instanceof Error ? e.name : typeof e },
          "MT5 bridge candle listener failed",
        );
      }
      if (canonical !== symbol.toUpperCase()) {
        try {
          fn(canonical, timeframe, trimmed);
        } catch (e: any) {
          logger.warn(
            { errorType: e instanceof Error ? e.name : typeof e },
            "MT5 bridge canonical candle listener failed",
          );
        }
      }
    });
    this.enqueuePersistence(() =>
      this.persistCandles(symbol, timeframe, trimmed, rejectedCandleDelta, batchUpdatedAt),
    );
    return parsed.length;
  }

  public getCandlesForBrokerSymbol(brokerSymbol: string, timeframe: string): Candle[] | null {
    if (!brokerSymbol) return null;
    const mappedBrok = this.getMappedBrokerSymbol(brokerSymbol);
    const canonical = this.resolveCanonicalSymbol(brokerSymbol);
    const key1 = `${brokerSymbol}:${timeframe}`;
    const key2 = `${brokerSymbol.toUpperCase()}:${timeframe}`;
    const key3 = `${mappedBrok}:${timeframe}`;
    const key4 = `${canonical}:${timeframe}`;
    return (
      this.candles.get(key1) ||
      this.candles.get(key2) ||
      (mappedBrok ? this.candles.get(key3) : null) ||
      (canonical ? this.candles.get(key4) : null) ||
      null
    );
  }

  public isQuoteFresh(brokerSymbol: string, maxAgeMs: number = 5000): boolean {
    const q = this.getQuoteForBrokerSymbol(brokerSymbol);
    if (!q) return false;
    return Date.now() - q.receivedAt <= maxAgeMs;
  }

  public isCandleFresh(
    brokerSymbol: string,
    timeframe: string = "M15",
    maxAgeMs: number = 1800000,
  ): boolean {
    const candles = this.getCandlesForBrokerSymbol(brokerSymbol, timeframe);
    if (!candles || candles.length === 0) return false;
    const lastBar = candles[candles.length - 1];
    const barTimeMs = lastBar.time * 1000;
    return Date.now() - barTimeMs <= maxAgeMs;
  }

  public getAllQuotes(): Record<string, MT5Quote> {
    const result: Record<string, MT5Quote> = {};
    for (const [key, quote] of this.getAllQuotesEntries()) result[key] = quote;
    return result;
  }

  public getCandleKeys(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, candles] of this.candles.entries()) {
      if (key === key.toUpperCase()) {
        result[key] = candles.length;
      }
    }
    return result;
  }

  public getServerGenerationId(): string {
    return this.serverGenerationId;
  }

  public isBackfillCompleted(): boolean {
    if (this.activeSymbols.length === 0) return false;
    return this.getPendingBackfillSymbols().length === 0;
  }

  public isSymbolBackfillCompleted(symbol: string): boolean {
    const canonical = this.resolveCanonicalSymbol(symbol);
    return Boolean(canonical) && this.fullSyncKeys.has(`${canonical.toUpperCase()}:M15`);
  }

  public getPendingBackfillSymbols(): string[] {
    return this.activeSymbols.filter((symbol) => !this.isSymbolBackfillCompleted(symbol));
  }

  /**
   * Preserve the legacy test/admin hook while keeping readiness keyed by
   * active symbol. A positive override represents the currently active set;
   * a negative override starts a fresh recovery cycle.
   */
  public setBackfillCompleted(completed: boolean): void {
    if (!completed) {
      this.fullSyncKeys.clear();
      return;
    }
    for (const symbol of this.activeSymbols) {
      const canonical = this.resolveCanonicalSymbol(symbol);
      if (canonical) this.fullSyncKeys.add(`${canonical.toUpperCase()}:M15`);
    }
  }
}

export const mt5BridgeStore = MT5BridgeStore.getInstance();
