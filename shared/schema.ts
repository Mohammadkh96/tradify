import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tradeJournal = pgTable("trade_journal", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("dev-user"),
  pair: text("pair").notNull(),
  direction: text("direction").notNull(),
  timeframe: text("timeframe").notNull(),
  htfBias: text("htf_bias").notNull(),
  htfBiasClear: boolean("htf_bias_clear").default(true),
  zoneValid: boolean("zone_valid").default(true),
  zoneValidity: text("zone_validity").default("Valid"),
  liquidityTaken: boolean("liquidity_taken").default(true),
  liquidityStatus: text("liquidity_status").default("Taken"),
  structureConfirmed: boolean("structure_confirmed").default(true),
  structureState: text("structure_state").default("BOS"),
  entryConfirmed: boolean("entry_confirmed").default(true),
  entryPrice: text("entry_price"),
  stopLoss: text("stop_loss"),
  takeProfit: text("take_profit"),
  riskReward: text("risk_reward"),
  outcome: text("outcome").notNull(),
  notes: text("notes"),
  isRuleCompliant: boolean("is_rule_compliant").default(true),
  violationReason: text("violation_reason"),
  matchedSetup: text("matched_setup"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mt5Data = pgTable("mt5_data", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  balance: text("balance").notNull(),
  equity: text("equity").notNull(),
  margin: text("margin").notNull(),
  freeMargin: text("free_margin").notNull(),
  marginLevel: text("margin_level").notNull(),
  floatingPl: text("floating_pl").notNull(),
  leverage: integer("leverage").default(100),
  currency: text("currency").default("USD"),
  positions: jsonb("positions").default([]),
  syncToken: text("sync_token").notNull(),
  lastUpdate: timestamp("last_update").defaultNow(),
});

export const mt5History = pgTable("mt5_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  ticket: text("ticket").notNull(),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(),
  volume: text("volume").notNull(),
  entryPrice: text("entry_price").notNull(),
  exitPrice: text("exit_price").notNull(),
  sl: text("sl"),
  tp: text("tp"),
  openTime: timestamp("open_time").notNull(),
  closeTime: timestamp("close_time").notNull(),
  duration: integer("duration"),
  grossPl: text("gross_pl").notNull(),
  commission: text("commission").default("0"),
  swap: text("swap").default("0"),
  netPl: text("net_pl").notNull(),
  notes: text("notes"),
  tags: text("tags").array().default([]),
});

export const dailyEquitySnapshots = pgTable("daily_equity_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  equity: text("equity").notNull(),
  balance: text("balance").notNull(),
});

export const userRole = pgTable("user_role", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  password: text("password"),
  role: text("role").notNull(),
  termsAccepted: boolean("terms_accepted").default(false),
  riskAcknowledged: boolean("risk_acknowledged").default(false),
  subscriptionTier: text("subscription_tier").default("FREE"),
  syncToken: text("sync_token"),
  country: text("country"), // ISO country name or code as per spec
  phoneNumber: text("phone_number"),
  timezone: text("timezone"), // Added per spec
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const signalProviderProfile = pgTable("signal_provider_profile", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  providerName: text("provider_name").notNull(),
  bio: text("bio"),
  winRate: text("win_rate").default("0"),
  subscriberCount: integer("subscriber_count").default(0),
  viewCount: integer("view_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const signalReceiver = pgTable("signal_receiver", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  receiverName: text("receiver_name").notNull(),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const providerSubscription = pgTable("provider_subscription", {
  id: serial("id").primaryKey(),
  receiverId: text("receiver_id").notNull(),
  providerId: text("provider_id").notNull(),
  subscriptionStatus: text("subscription_status").notNull(),
  externalPlatform: text("external_platform"),
  externalUserId: text("external_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
});

export const dispute = pgTable("dispute", {
  id: serial("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  reportedProviderId: text("reported_provider_id").notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").default("PENDING"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const platformDisclaimer = pgTable("platform_disclaimer", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  disclaimerVersion: text("disclaimer_version").notNull(),
  disclaimerText: text("disclaimer_text").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow(),
});

export const adminAccess = pgTable("admin_access", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  accessKey: text("access_key").notNull(),
  label: text("label"), // e.g. "Mohammad", "Support Team"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiPerformanceInsights = pgTable("ai_performance_insights", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  timeframe: text("timeframe").notNull(), // 'weekly', 'monthly', 'recent'
  insightText: text("insight_text").notNull(),
  metadata: jsonb("metadata"), // Input data summary for audit
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiInsightLogs = pgTable("ai_insight_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  prompt: text("prompt").notNull(),
  response: text("response").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertAdminAccessSchema = createInsertSchema(adminAccess).omit({ id: true, createdAt: true });
export type AdminAccess = typeof adminAccess.$inferSelect;

export type AIPerformanceInsight = typeof aiPerformanceInsights.$inferSelect;
export type AIInsightLog = typeof aiInsightLogs.$inferSelect;

export const insertTradeSchema = createInsertSchema(tradeJournal).omit({ id: true, createdAt: true });
export const updateTradeSchema = insertTradeSchema.partial();
export type Trade = typeof tradeJournal.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type UpdateTradeRequest = z.infer<typeof updateTradeSchema>;
export type MT5Data = typeof mt5Data.$inferSelect;
export type MT5History = typeof mt5History.$inferSelect;
export type DailySnapshot = typeof dailyEquitySnapshots.$inferSelect;

export const validationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  violations: z.array(z.string()).optional(),
  matchedSetup: z.string().optional(),
});
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  actionType: text("action_type").notNull(), // e.g. "DEACTIVATE", "GRANT_PRO"
  targetUserId: text("target_user_id").notNull(),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type UserRole = typeof userRole.$inferSelect;
export type InsertUserRole = typeof userRole.$inferInsert;
