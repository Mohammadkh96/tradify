import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, uuid, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role_enum", ["user", "admin"]);
export const userStatusEnum = pgEnum("user_status_enum", ["active", "suspended", "deleted"]);
export const subProviderEnum = pgEnum("sub_provider_enum", ["paddle", "stripe", "other"]);
export const subStatusEnum = pgEnum("sub_status_enum", ["active", "trialing", "past_due", "canceled", "expired"]);
export const themeEnum = pgEnum("theme_enum", ["light", "dark"]);
export const directionEnum = pgEnum("direction_enum", ["buy", "sell"]);
export const periodTypeEnum = pgEnum("period_type_enum", ["daily", "weekly", "monthly", "all_time"]);
export const sessionEnum = pgEnum("session_enum", ["asia", "london", "new_york"]);
export const flagTypeEnum = pgEnum("flag_type_enum", ["overtrading", "risk_spike", "revenge_trading", "discipline_break"]);
export const severityEnum = pgEnum("severity_enum", ["low", "medium", "high"]);
export const sourceEnum = pgEnum("source_enum", ["news", "social", "combined"]);

// 1.1 users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(false),
  role: userRoleEnum("role").default("user"),
  status: userStatusEnum("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// 1.2 subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  pspProvider: subProviderEnum("psp_provider").notNull(),
  pspCustomerId: text("psp_customer_id"),
  pspSubscriptionId: text("psp_subscription_id"),
  planCode: text("plan_code"),
  status: subStatusEnum("status").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 1.3 account_settings
export const accountSettings = pgTable("account_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  theme: themeEnum("theme").default("dark"),
  timezone: text("timezone"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 2.1 trades (IMMUTABLE)
export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  mt5AccountId: text("mt5_account_id"),
  ticketId: text("ticket_id"),
  symbol: text("symbol"),
  direction: directionEnum("direction"),
  volume: decimal("volume", { precision: 20, scale: 8 }),
  openPrice: decimal("open_price", { precision: 20, scale: 8 }),
  closePrice: decimal("close_price", { precision: 20, scale: 8 }),
  openTime: timestamp("open_time"),
  closeTime: timestamp("close_time"),
  profit: decimal("profit", { precision: 20, scale: 8 }),
  commission: decimal("commission", { precision: 20, scale: 8 }),
  swap: decimal("swap", { precision: 20, scale: 8 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2.2 performance_aggregates
export const performanceAggregates = pgTable("performance_aggregates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  periodType: periodTypeEnum("period_type").notNull(),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  totalTrades: integer("total_trades"),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }),
  netProfit: decimal("net_profit", { precision: 20, scale: 8 }),
  maxDrawdown: decimal("max_drawdown", { precision: 5, scale: 2 }),
  riskRewardAvg: decimal("risk_reward_avg", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2.3 session_performance
export const sessionPerformance = pgTable("session_performance", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  session: sessionEnum("session").notNull(),
  totalTrades: integer("total_trades"),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }),
  netProfit: decimal("net_profit", { precision: 20, scale: 8 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2.4 strategy_tags
export const strategyTags = pgTable("strategy_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Join table for trades and strategy tags
export const tradeStrategyTags = pgTable("trade_strategy_tags", {
  tradeId: uuid("trade_id").references(() => trades.id).notNull(),
  strategyTagId: uuid("strategy_tag_id").references(() => strategyTags.id).notNull(),
});

// 3.1 behavioral_flags
export const behavioralFlags = pgTable("behavioral_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  flagType: flagTypeEnum("flag_type").notNull(),
  severity: severityEnum("severity").notNull(),
  context: jsonb("context"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3.2 ai_insights
export const aiInsights = pgTable("ai_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  insightType: text("insight_type"),
  summary: text("summary"),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  sourceDataHash: text("source_data_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3.3 sentiment_narratives
export const sentimentNarratives = pgTable("sentiment_narratives", {
  id: uuid("id").primaryKey().defaultRandom(),
  asset: text("asset"),
  topic: text("topic"),
  sentimentScore: decimal("sentiment_score", { precision: 5, scale: 2 }),
  volumeScore: decimal("volume_score", { precision: 5, scale: 2 }),
  source: sourceEnum("source"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 4.1 audit_logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 4.2 error_logs
export const errorLogs = pgTable("error_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  errorCode: text("error_code"),
  message: text("message"),
  stackTrace: text("stack_trace"),
  context: jsonb("context"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Security tokens (existing, keeping for compatibility but could be UUID-ified)
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

// Schemas
export const validationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  violations: z.array(z.string()).optional(),
  matchedSetup: z.string().optional(),
});

export type ValidationResult = z.infer<typeof validationResultSchema>;

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastLoginAt: true 
});
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type AccountSettings = typeof accountSettings.$inferSelect;
export type PerformanceAggregate = typeof performanceAggregates.$inferSelect;
export type SessionPerformance = typeof sessionPerformance.$inferSelect;
export type StrategyTag = typeof strategyTags.$inferSelect;
export type BehavioralFlag = typeof behavioralFlags.$inferSelect;
export type AIInsight = typeof aiInsights.$inferSelect;
export type SentimentNarrative = typeof sentimentNarratives.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ErrorLog = typeof errorLogs.$inferSelect;
