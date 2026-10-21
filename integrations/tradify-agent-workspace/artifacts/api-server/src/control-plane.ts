import { and, asc, eq, isNull } from "drizzle-orm";
import {
  db,
  tradifyGeneratedSignals,
  tradifyStaffAccess,
  tradifyStrategies,
  tradifyStrategyAssignments,
  tradifySymbols,
  tradifyUsers,
  type TradifyStrategy,
  type TradifyStrategyAssignment,
  type TradifySymbol,
} from "@workspace/db";
import { marketCatalog, type MarketCatalogItem } from "./zip-engine/market/MarketCatalog";
import { mt5WatchlistSymbolIdentity } from "./zip-engine/market/MT5WatchlistCatalog";
import { mt5BridgeStore } from "./zip-engine/market/providers/MT5BridgeStore";

export const STRATEGY_TIMEFRAME = "M15";
export const SUPPORTED_STRATEGY_TIMEFRAMES = [STRATEGY_TIMEFRAME] as const;
export const STAFF_ROLES = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "SUPPORT",
  "FINANCE",
  "READ_ONLY",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_CAPABILITIES = [
  "users.read",
  "users.manage",
  "memberships.read",
  "memberships.manage",
  "payments.read",
  "payments.manage",
  "strategies.read",
  "strategies.manage",
  "strategies.deploy",
  "symbols.read",
  "symbols.manage",
  "signals.read",
  "market_data.read",
  "market_data.manage",
  "notifications.read",
  "notifications.manage",
  "audit.read",
  "staff.read",
  "staff.manage",
  "configuration.read",
  "configuration.manage",
] as const;
export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<StaffRole, readonly StaffCapability[]> = {
  SUPER_ADMIN: STAFF_CAPABILITIES,
  OPERATIONS: [
    "strategies.read",
    "strategies.manage",
    "strategies.deploy",
    "symbols.read",
    "symbols.manage",
    "signals.read",
    "market_data.read",
    "market_data.manage",
    "audit.read",
    "configuration.read",
    "configuration.manage",
  ],
  SUPPORT: ["users.read", "memberships.read", "notifications.read", "audit.read"],
  FINANCE: [
    "users.read",
    "memberships.read",
    "memberships.manage",
    "payments.read",
    "payments.manage",
    "audit.read",
  ],
  READ_ONLY: [
    "users.read",
    "memberships.read",
    "payments.read",
    "strategies.read",
    "symbols.read",
    "signals.read",
    "market_data.read",
    "notifications.read",
    "audit.read",
    "staff.read",
    "configuration.read",
  ],
};

const strategySeeds = [
  {
    id: "DGV8",
    name: "DGV8",
    version: "8.0.0",
    timeframe: "M15",
    assetClasses: ["METALS", "CRYPTO", "COMMODITIES"],
    description: "Session breakout gates with pivot-confirmed levels.",
  },
  {
    id: "DGV8_FX",
    name: "DGV8 FX",
    version: "8.0.0",
    timeframe: "M15",
    assetClasses: ["FOREX"],
    description: "Foreign-exchange session breakout and retest engine.",
  },
  {
    id: "BBB",
    name: "BBB",
    version: "BBB-LONDON-1.0",
    timeframe: "M15",
    assetClasses: ["FOREX", "INDICES"],
    description: "London breakout state machine for index and currency markets.",
  },
  {
    id: "BBB_GOLD_3S",
    name: "BBB Gold 3S",
    version: "BBB-GOLD-3S-1.0",
    timeframe: "M15",
    assetClasses: ["METALS"],
    description: "Three-stage gold breakout and confirmation engine.",
  },
] as const;

const strategySeedById = new Map<string, (typeof strategySeeds)[number]>(
  strategySeeds.map((strategy) => [strategy.id, strategy]),
);
const CHART_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];
let readyPromise: Promise<void> | undefined;

function createId(): string {
  return globalThis.crypto.randomUUID();
}

export function strategyRegistry() {
  return strategySeeds;
}

export function capabilitiesForAccess(
  role: string,
  customPermissions: string[] = [],
): StaffCapability[] {
  if (!STAFF_ROLES.includes(role as StaffRole)) return [];
  const allowed = new Set<StaffCapability>(ROLE_CAPABILITIES[role as StaffRole]);
  for (const capability of customPermissions) {
    if (STAFF_CAPABILITIES.includes(capability as StaffCapability))
      allowed.add(capability as StaffCapability);
  }
  return [...allowed];
}

export function hasCapability(
  access: { role: string; customPermissions: string[]; active: boolean } | undefined,
  capability: StaffCapability,
): boolean {
  if (capability === "staff.manage" && access?.role !== "SUPER_ADMIN") return false;
  return Boolean(
    access?.active &&
    capabilitiesForAccess(access.role, access.customPermissions).includes(capability),
  );
}

export async function ensureControlPlaneReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const now = new Date();
      await db
        .insert(tradifyStrategies)
        .values(
          strategySeeds.map((strategy) => ({
            ...strategy,
            assetClasses: [...strategy.assetClasses],
            lifecycleStatus: "ACTIVE",
            createdAt: now,
            updatedAt: now,
            activatedAt: now,
          })),
        )
        .onConflictDoNothing();

      const dgv8Seed = strategySeedById.get("DGV8")!;
      const [existingDgv8] = await db
        .select({
          assetClasses: tradifyStrategies.assetClasses,
          rowVersion: tradifyStrategies.rowVersion,
        })
        .from(tradifyStrategies)
        .where(eq(tradifyStrategies.id, dgv8Seed.id))
        .limit(1);
      if (existingDgv8 && !existingDgv8.assetClasses.includes("COMMODITIES")) {
        await db
          .update(tradifyStrategies)
          .set({
            assetClasses: [...existingDgv8.assetClasses, "COMMODITIES"],
            updatedAt: now,
            rowVersion: existingDgv8.rowVersion + 1,
          })
          .where(
            and(
              eq(tradifyStrategies.id, dgv8Seed.id),
              eq(tradifyStrategies.rowVersion, existingDgv8.rowVersion),
            ),
          );
      }

      const catalogItems = marketCatalog.getAll();
      await mt5BridgeStore.hydrateFromPersistence();
      const bridgeMappings = mt5BridgeStore.getMappings();
      await db
        .insert(tradifySymbols)
        .values(
          catalogItems.map((item) => ({
            canonicalSymbol: item.canonicalSymbol,
            displaySymbol: item.displaySymbol,
            provider: item.provider,
            providerSymbol: bridgeMappings[item.canonicalSymbol] ?? item.providerSymbol,
            assetClass: item.assetClass,
            digits: item.digits,
            enabled: item.enabled,
            visibleToUsers: item.visibleToUsers,
            supportedTimeframes: CHART_TIMEFRAMES,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoNothing();

      const persistedSymbols = await db
        .select({
          canonicalSymbol: tradifySymbols.canonicalSymbol,
          providerSymbol: tradifySymbols.providerSymbol,
          rowVersion: tradifySymbols.rowVersion,
        })
        .from(tradifySymbols);
      for (const persisted of persistedSymbols) {
        const watchlistIdentity = mt5WatchlistSymbolIdentity(persisted.providerSymbol);
        if (!watchlistIdentity || watchlistIdentity === persisted.canonicalSymbol.toUpperCase())
          continue;
        const catalogItem = marketCatalog.get(persisted.canonicalSymbol);
        if (!catalogItem) continue;
        await db
          .update(tradifySymbols)
          .set({
            providerSymbol: bridgeMappings[persisted.canonicalSymbol] ?? catalogItem.providerSymbol,
            updatedAt: now,
            rowVersion: persisted.rowVersion + 1,
          })
          .where(eq(tradifySymbols.canonicalSymbol, persisted.canonicalSymbol));
      }

      const assignments = catalogItems.flatMap((item) => {
        if (item.seedStrategyAssignments === false) return [];
        const strategyIds = [
          ...new Set([
            ...(item.availableStrategies ?? []),
            ...(item.defaultStrategyId ? [item.defaultStrategyId] : []),
          ]),
        ].filter((id) => strategySeedById.has(id));
        return strategyIds.map((strategyId) => {
          const strategy = strategySeedById.get(strategyId)!;
          const isDefault = item.defaultStrategyId === strategyId;
          return {
            id: `seed:${strategyId}:${item.canonicalSymbol}:${strategy.timeframe}`,
            strategyId,
            strategyVersion: strategy.version,
            symbol: item.canonicalSymbol,
            timeframe: strategy.timeframe,
            enabled: true,
            isDefault,
            activatedAt: now,
            createdAt: now,
            updatedAt: now,
          };
        });
      });
      if (assignments.length) {
        await db.insert(tradifyStrategyAssignments).values(assignments).onConflictDoNothing();
      }

      // Import legacy administrators only while the separate staff table is
      // empty. After bootstrap, customer roles can never recreate staff access.
      const [existingStaffAccess] = await db
        .select({ userId: tradifyStaffAccess.userId })
        .from(tradifyStaffAccess)
        .limit(1);
      if (!existingStaffAccess) {
        const legacyAdmins = await db
          .select({ id: tradifyUsers.id })
          .from(tradifyUsers)
          .where(eq(tradifyUsers.role, "admin"));
        if (legacyAdmins.length) {
          await db
            .insert(tradifyStaffAccess)
            .values(
              legacyAdmins.map(({ id }) => ({
                userId: id,
                role: "SUPER_ADMIN",
                active: true,
                createdAt: now,
                updatedAt: now,
              })),
            )
            .onConflictDoNothing();
        }
      }
    })().catch((error) => {
      readyPromise = undefined;
      throw error;
    });
  }
  await readyPromise;
}

export async function getStaffAccess(userId: string) {
  await ensureControlPlaneReady();
  const [access] = await db
    .select()
    .from(tradifyStaffAccess)
    .where(eq(tradifyStaffAccess.userId, userId))
    .limit(1);
  return access;
}

export async function listStaffAccess() {
  await ensureControlPlaneReady();
  return db
    .select({
      userId: tradifyStaffAccess.userId,
      role: tradifyStaffAccess.role,
      customPermissions: tradifyStaffAccess.customPermissions,
      active: tradifyStaffAccess.active,
      rowVersion: tradifyStaffAccess.rowVersion,
      updatedAt: tradifyStaffAccess.updatedAt,
      updatedBy: tradifyStaffAccess.updatedBy,
      email: tradifyUsers.email,
      name: tradifyUsers.name,
    })
    .from(tradifyStaffAccess)
    .innerJoin(tradifyUsers, eq(tradifyUsers.id, tradifyStaffAccess.userId))
    .orderBy(asc(tradifyUsers.email));
}

export async function getStrategy(strategyId: string): Promise<TradifyStrategy | undefined> {
  await ensureControlPlaneReady();
  const [strategy] = await db
    .select()
    .from(tradifyStrategies)
    .where(eq(tradifyStrategies.id, strategyId))
    .limit(1);
  return strategy;
}

export async function listStrategies() {
  await ensureControlPlaneReady();
  return db.select().from(tradifyStrategies).orderBy(asc(tradifyStrategies.id));
}

export async function getSymbolControl(symbol: string): Promise<TradifySymbol | undefined> {
  await ensureControlPlaneReady();
  const [control] = await db
    .select()
    .from(tradifySymbols)
    .where(eq(tradifySymbols.canonicalSymbol, symbol.toUpperCase()))
    .limit(1);
  return control;
}

export async function listEffectiveMarkets() {
  await ensureControlPlaneReady();
  const [symbols, assignments, strategies] = await Promise.all([
    db.select().from(tradifySymbols),
    db.select().from(tradifyStrategyAssignments),
    db
      .select({ id: tradifyStrategies.id, lifecycleStatus: tradifyStrategies.lifecycleStatus })
      .from(tradifyStrategies),
  ]);
  const strategyStatus = new Map(
    strategies.map((strategy) => [strategy.id, strategy.lifecycleStatus]),
  );
  const assignmentsBySymbol = new Map<string, TradifyStrategyAssignment[]>();
  for (const assignment of assignments) {
    const list = assignmentsBySymbol.get(assignment.symbol) ?? [];
    list.push(assignment);
    assignmentsBySymbol.set(assignment.symbol, list);
  }
  return symbols.flatMap((control) => {
    const catalogItem = marketCatalog.get(control.canonicalSymbol);
    if (!catalogItem) return [];
    const eligible = (assignmentsBySymbol.get(control.canonicalSymbol) ?? []).filter(
      (assignment) => assignment.enabled && strategyStatus.get(assignment.strategyId) === "ACTIVE",
    );
    const defaultAssignment = eligible.find((assignment) => assignment.isDefault);
    const effective = {
      ...catalogItem,
      provider: control.provider,
      providerSymbol: control.providerSymbol,
      displaySymbol: control.displaySymbol,
      assetClass: control.assetClass as MarketCatalogItem["assetClass"],
      digits: control.digits,
      enabled: control.enabled,
      visibleToUsers: control.visibleToUsers,
      archivedAt: control.archivedAt,
      archiveEnabled: control.archiveEnabled,
      archiveVisibleToUsers: control.archiveVisibleToUsers,
      strategyId: defaultAssignment?.strategyId ?? null,
      defaultStrategyId: defaultAssignment?.strategyId ?? null,
      strategyConfigured: Boolean(defaultAssignment),
      availableStrategies: eligible.map((assignment) => assignment.strategyId),
      rowVersion: control.rowVersion,
      updatedAt: control.updatedAt,
    };
    marketCatalog.update(control.canonicalSymbol, {
      provider: effective.provider,
      providerSymbol: effective.providerSymbol,
      displaySymbol: effective.displaySymbol,
      assetClass: effective.assetClass,
      digits: effective.digits,
      enabled: effective.enabled,
      visibleToUsers: effective.visibleToUsers,
    });
    return [effective];
  });
}

export function mt5StrategyBrokerSymbols<
  T extends {
    canonicalSymbol: string;
    providerSymbol: string;
    provider: string;
    enabled: boolean;
    strategyConfigured: boolean;
  },
>(markets: readonly T[], mappings: Readonly<Record<string, string>>): string[] {
  const symbols: string[] = [];
  const seen = new Set<string>();
  for (const market of markets) {
    if (!market.enabled || !market.strategyConfigured || market.provider.toUpperCase() !== "MT5")
      continue;
    const brokerSymbol = (mappings[market.canonicalSymbol] ?? market.providerSymbol).trim();
    const normalized = brokerSymbol.toUpperCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    symbols.push(brokerSymbol);
  }
  return symbols;
}

export async function resolveEvaluationControl(symbol: string, requestedStrategy?: string | null) {
  await ensureControlPlaneReady();
  const canonicalSymbol = symbol.toUpperCase();
  const catalogItem = marketCatalog.get(canonicalSymbol);
  const symbolControl = await getSymbolControl(canonicalSymbol);
  if (!catalogItem || !symbolControl)
    return {
      catalogItem,
      symbolControl,
      assignment: undefined,
      strategy: undefined,
      block: "UNKNOWN_SYMBOL" as const,
    };
  marketCatalog.update(canonicalSymbol, {
    provider: symbolControl.provider,
    providerSymbol: mt5BridgeStore.getMappings()[canonicalSymbol] ?? symbolControl.providerSymbol,
    displaySymbol: symbolControl.displaySymbol,
    assetClass: symbolControl.assetClass as MarketCatalogItem["assetClass"],
    digits: symbolControl.digits,
    enabled: symbolControl.enabled,
    visibleToUsers: symbolControl.visibleToUsers,
  });
  if (!symbolControl.enabled)
    return {
      catalogItem,
      symbolControl,
      assignment: undefined,
      strategy: undefined,
      block: "SYMBOL_DISABLED" as const,
    };

  const rows = await db
    .select({ assignment: tradifyStrategyAssignments, strategy: tradifyStrategies })
    .from(tradifyStrategyAssignments)
    .innerJoin(tradifyStrategies, eq(tradifyStrategies.id, tradifyStrategyAssignments.strategyId))
    .where(
      and(
        eq(tradifyStrategyAssignments.symbol, canonicalSymbol),
        eq(tradifyStrategyAssignments.timeframe, STRATEGY_TIMEFRAME),
        eq(tradifyStrategyAssignments.enabled, true),
        ...(requestedStrategy
          ? [eq(tradifyStrategyAssignments.strategyId, requestedStrategy)]
          : [eq(tradifyStrategyAssignments.isDefault, true)]),
      ),
    );
  const active = rows.find((row) => row.strategy.lifecycleStatus === "ACTIVE");
  if (!active) {
    const requestedExists = rows.length > 0;
    return {
      catalogItem,
      symbolControl,
      assignment: undefined,
      strategy: undefined,
      block: requestedExists ? ("STRATEGY_DISABLED" as const) : ("ASSIGNMENT_DISABLED" as const),
    };
  }
  return {
    catalogItem,
    symbolControl,
    assignment: active.assignment,
    strategy: active.strategy,
    block: undefined,
  };
}

export async function getAssignment(
  assignmentId: string,
): Promise<TradifyStrategyAssignment | undefined> {
  await ensureControlPlaneReady();
  const [assignment] = await db
    .select()
    .from(tradifyStrategyAssignments)
    .where(eq(tradifyStrategyAssignments.id, assignmentId))
    .limit(1);
  return assignment;
}

export async function listAssignments() {
  await ensureControlPlaneReady();
  return db
    .select({
      assignment: tradifyStrategyAssignments,
      strategyName: tradifyStrategies.name,
      strategyStatus: tradifyStrategies.lifecycleStatus,
      symbolDisplay: tradifySymbols.displaySymbol,
      symbolEnabled: tradifySymbols.enabled,
    })
    .from(tradifyStrategyAssignments)
    .innerJoin(tradifyStrategies, eq(tradifyStrategies.id, tradifyStrategyAssignments.strategyId))
    .innerJoin(
      tradifySymbols,
      eq(tradifySymbols.canonicalSymbol, tradifyStrategyAssignments.symbol),
    )
    .orderBy(asc(tradifyStrategyAssignments.symbol), asc(tradifyStrategyAssignments.strategyId));
}

export async function getGeneratedSignal(signalId: string) {
  const [signal] = await db
    .select()
    .from(tradifyGeneratedSignals)
    .where(eq(tradifyGeneratedSignals.id, signalId))
    .limit(1);
  return signal;
}
