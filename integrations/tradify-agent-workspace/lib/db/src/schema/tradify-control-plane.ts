import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tradifyStrategies = pgTable(
  "tradify_strategies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    lifecycleStatus: text("lifecycle_status").notNull(),
    timeframe: text("timeframe").notNull(),
    assetClasses: jsonb("asset_classes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    updatedBy: text("updated_by"),
    rowVersion: integer("row_version").notNull().default(1),
  },
  (table) => ({
    lifecycleCheck: check(
      "tradify_strategies_lifecycle_status_check",
      sql`${table.lifecycleStatus} in ('DRAFT', 'TESTING', 'ACTIVE', 'PAUSED', 'ARCHIVED')`,
    ),
    idVersionUnique: uniqueIndex("tradify_strategies_id_version_idx").on(table.id, table.version),
    statusIdx: index("tradify_strategies_status_idx").on(table.lifecycleStatus),
  }),
);

export const tradifySymbols = pgTable(
  "tradify_symbols",
  {
    canonicalSymbol: text("canonical_symbol").primaryKey(),
    displaySymbol: text("display_symbol").notNull(),
    provider: text("provider").notNull(),
    providerSymbol: text("provider_symbol").notNull(),
    assetClass: text("asset_class").notNull(),
    digits: integer("digits").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    visibleToUsers: boolean("visible_to_users").notNull().default(true),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archiveEnabled: boolean("archive_enabled"),
    archiveVisibleToUsers: boolean("archive_visible_to_users"),
    supportedTimeframes: jsonb("supported_timeframes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by"),
    rowVersion: integer("row_version").notNull().default(1),
  },
  (table) => ({
    enabledIdx: index("tradify_symbols_enabled_idx").on(table.enabled, table.canonicalSymbol),
    providerSymbolIdx: index("tradify_symbols_provider_symbol_idx").on(
      table.provider,
      table.providerSymbol,
    ),
  }),
);

export const tradifyStrategyAssignments = pgTable(
  "tradify_strategy_assignments",
  {
    id: text("id").primaryKey(),
    strategyId: text("strategy_id")
      .notNull()
      .references(() => tradifyStrategies.id),
    strategyVersion: text("strategy_version").notNull(),
    symbol: text("symbol")
      .notNull()
      .references(() => tradifySymbols.canonicalSymbol),
    timeframe: text("timeframe").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    rowVersion: integer("row_version").notNull().default(1),
  },
  (table) => ({
    tupleUnique: uniqueIndex("tradify_strategy_assignments_tuple_idx").on(
      table.strategyId,
      table.strategyVersion,
      table.symbol,
      table.timeframe,
    ),
    activeDefaultUnique: uniqueIndex("tradify_strategy_assignments_default_idx")
      .on(table.symbol, table.timeframe)
      .where(sql`${table.enabled} = true and ${table.isDefault} = true`),
    strategyLookupIdx: index("tradify_strategy_assignments_strategy_idx").on(
      table.strategyId,
      table.timeframe,
      table.enabled,
    ),
    symbolLookupIdx: index("tradify_strategy_assignments_symbol_idx").on(
      table.symbol,
      table.timeframe,
      table.enabled,
    ),
  }),
);

export const tradifyEvaluationHistory = pgTable(
  "tradify_evaluation_history",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    origin: text("origin").notNull(),
    strategyId: text("strategy_id"),
    strategyVersion: text("strategy_version"),
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    assignmentId: text("assignment_id").references(() => tradifyStrategyAssignments.id),
    marketDataAt: timestamp("market_data_at", { withTimezone: true }),
    dataState: text("data_state").notNull(),
    marketDataTrusted: boolean("market_data_trusted").notNull(),
    result: text("result").notNull(),
    signalGenerated: boolean("signal_generated").notNull(),
    signalId: text("signal_id"),
    reason: text("reason"),
    errorCategory: text("error_category"),
    processingDurationMs: integer("processing_duration_ms").notNull(),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => ({
    createdIdx: index("tradify_evaluation_history_created_idx").on(table.createdAt),
    symbolCreatedIdx: index("tradify_evaluation_history_symbol_created_idx").on(
      table.symbol,
      table.createdAt,
    ),
    strategyCreatedIdx: index("tradify_evaluation_history_strategy_created_idx").on(
      table.strategyId,
      table.createdAt,
    ),
    assignmentCreatedIdx: index("tradify_evaluation_history_assignment_created_idx").on(
      table.assignmentId,
      table.createdAt,
    ),
    resultCreatedIdx: index("tradify_evaluation_history_result_created_idx").on(
      table.result,
      table.createdAt,
    ),
    signalIdx: index("tradify_evaluation_history_signal_idx").on(table.signalId),
    errorIdx: index("tradify_evaluation_history_error_idx").on(
      table.errorCategory,
      table.createdAt,
    ),
  }),
);

export const tradifyGeneratedSignals = pgTable(
  "tradify_generated_signals",
  {
    id: text("id").primaryKey(),
    evaluationId: text("evaluation_id")
      .notNull()
      .unique()
      .references(() => tradifyEvaluationHistory.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    strategyId: text("strategy_id").notNull(),
    strategyVersion: text("strategy_version").notNull(),
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  },
  (table) => ({
    symbolCreatedIdx: index("tradify_generated_signals_symbol_created_idx").on(
      table.symbol,
      table.createdAt,
    ),
    strategyCreatedIdx: index("tradify_generated_signals_strategy_created_idx").on(
      table.strategyId,
      table.createdAt,
    ),
  }),
);

export type TradifySignalTargetOutcome = {
  label: string;
  price: number;
  targetR: number;
  status: "PENDING" | "TARGET_FIRST" | "STOP_FIRST" | "AMBIGUOUS";
  resolvedAt: number | null;
  outcomeR: number | null;
};

export const tradifySignalOutcomes = pgTable(
  "tradify_signal_outcomes",
  {
    id: text("id").primaryKey(),
    signalId: text("signal_id")
      .notNull()
      .references(() => tradifyGeneratedSignals.id),
    lastEvaluationId: text("last_evaluation_id")
      .notNull()
      .references(() => tradifyEvaluationHistory.id),
    strategyId: text("strategy_id").notNull(),
    strategyVersion: text("strategy_version").notNull(),
    symbol: text("symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    direction: text("direction").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }),
    entryPrice: real("entry_price"),
    stopPrice: real("stop_price"),
    riskDistance: real("risk_distance"),
    status: text("status").notNull(),
    eligibilityReason: text("eligibility_reason"),
    targetOutcomes: jsonb("target_outcomes")
      .$type<TradifySignalTargetOutcome[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    lastProcessedCandleTime: bigint("last_processed_candle_time", { mode: "number" }),
    maxFavorableR: real("max_favorable_r"),
    maxAdverseR: real("max_adverse_r"),
    resolutionVersion: text("resolution_version").notNull(),
    trackedAt: timestamp("tracked_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    statusCheck: check(
      "tradify_signal_outcomes_status_check",
      sql`${table.status} in ('TRACKING', 'COMPLETE', 'INELIGIBLE')`,
    ),
    signalIdx: index("tradify_signal_outcomes_signal_idx").on(table.signalId),
    symbolStatusIdx: index("tradify_signal_outcomes_symbol_status_idx").on(
      table.symbol,
      table.timeframe,
      table.status,
      table.trackedAt,
    ),
  }),
);

export const tradifyStaffAccess = pgTable(
  "tradify_staff_access",
  {
    userId: text("user_id").primaryKey(),
    role: text("role").notNull(),
    customPermissions: jsonb("custom_permissions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    active: boolean("active").notNull().default(true),
    rowVersion: integer("row_version").notNull().default(1),
    grantedBy: text("granted_by"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roleCheck: check(
      "tradify_staff_access_role_check",
      sql`${table.role} in ('SUPER_ADMIN', 'OPERATIONS', 'SUPPORT', 'FINANCE', 'READ_ONLY')`,
    ),
    activeRoleIdx: index("tradify_staff_access_active_role_idx").on(table.active, table.role),
  }),
);

export type TradifyStrategy = typeof tradifyStrategies.$inferSelect;
export type TradifySymbol = typeof tradifySymbols.$inferSelect;
export type TradifyStrategyAssignment = typeof tradifyStrategyAssignments.$inferSelect;
export type TradifyEvaluationHistory = typeof tradifyEvaluationHistory.$inferSelect;
export type TradifyGeneratedSignal = typeof tradifyGeneratedSignals.$inferSelect;
export type TradifySignalOutcome = typeof tradifySignalOutcomes.$inferSelect;
export type TradifyStaffAccess = typeof tradifyStaffAccess.$inferSelect;
