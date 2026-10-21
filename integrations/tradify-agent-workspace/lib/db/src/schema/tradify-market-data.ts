import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tradifyMt5BridgeState = pgTable("tradify_mt5_bridge_state", {
  id: text("id").primaryKey(),
  bridgeId: text("bridge_id").notNull(),
  serverName: text("server_name").notNull(),
  serverGenerationId: text("server_generation_id").notNull(),
  connected: boolean("connected").notNull(),
  lastHeartbeat: bigint("last_heartbeat", { mode: "number" }).notNull(),
  availableSymbols: jsonb("available_symbols").$type<string[]>().notNull(),
  activeSymbols: jsonb("active_symbols").$type<string[]>().notNull(),
  subscriptionVersion: integer("subscription_version").notNull(),
  mappings: jsonb("mappings").$type<Record<string, string>>().notNull(),
  brokerSpecifications: jsonb("broker_specifications")
    .$type<Record<string, Record<string, unknown>>>()
    .notNull()
    .default({}),
  quotes: jsonb("quotes").$type<Record<string, unknown>>().notNull(),
  fullSyncKeys: jsonb("full_sync_keys").$type<string[]>().notNull(),
  rejectedCandleCount: integer("rejected_candle_count").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tradifyMt5Candles = pgTable(
  "tradify_mt5_candles",
  {
    scopeId: text("scope_id").notNull().default("PRIMARY"),
    brokerSymbol: text("broker_symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    time: integer("time").notNull(),
    open: real("open").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(),
    volume: real("volume").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({
      columns: [table.scopeId, table.brokerSymbol, table.timeframe, table.time],
      name: "tradify_mt5_candles_pk",
    }),
  }),
);

export const tradifyMt5CustomerFeeds = pgTable(
  "tradify_mt5_customer_feeds",
  {
    userId: text("user_id").primaryKey(),
    feedId: text("feed_id").notNull(),
    linkId: text("link_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    consentVersion: text("consent_version").notNull(),
    consentedAt: text("consented_at").notNull(),
    revokedAt: text("revoked_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    feedIdUnique: uniqueIndex("tradify_mt5_customer_feed_id_idx").on(table.feedId),
    tokenHashUnique: uniqueIndex("tradify_mt5_customer_feed_token_idx").on(table.tokenHash),
    linkIdIdx: index("tradify_mt5_customer_feed_link_idx").on(table.linkId),
  }),
);

export type TradifyMt5BridgeState = typeof tradifyMt5BridgeState.$inferSelect;
export type TradifyMt5Candle = typeof tradifyMt5Candles.$inferSelect;
