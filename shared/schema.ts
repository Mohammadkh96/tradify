import { pgTable, text, serial, timestamp, boolean, numeric, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tradeJournal = pgTable("trade_journal", {
  id: serial("id").primaryKey(),
  pair: text("pair").notNull(),
  direction: text("direction", { enum: ["Long", "Short"] }).notNull(),
  timeframe: text("timeframe").notNull(),
  
  // Detection Rules (Manual Inputs)
  htfBias: text("htf_bias", { enum: ["Bullish", "Bearish", "Range"] }).notNull(),
  structureState: text("structure_state", { enum: ["BOS", "CHOCH", "None"] }).notNull(),
  liquidityStatus: text("liquidity_status", { enum: ["Taken", "Pending", "None"] }).notNull(),
  zoneValidity: text("zone_validity", { enum: ["Valid", "Invalid"] }).notNull(),
  
  // Execution Checklist (Booleans)
  htfBiasClear: boolean("htf_bias_clear").notNull().default(false),
  zoneValid: boolean("zone_valid").notNull().default(false),
  liquidityTaken: boolean("liquidity_taken").notNull().default(false),
  structureConfirmed: boolean("structure_confirmed").notNull().default(false),
  entryConfirmed: boolean("entry_confirmed").notNull().default(false),
  
  // Rule Engine Output
  isRuleCompliant: boolean("is_rule_compliant").notNull().default(false),
  violationReason: text("violation_reason"),
  matchedSetup: text("matched_setup"),
  
  // Trade Parameters
  entryPrice: text("entry_price"), 
  stopLoss: text("stop_loss"),
  takeProfit: text("take_profit"),
  riskReward: text("risk_reward"),
  
  // Outcome
  outcome: text("outcome", { enum: ["Win", "Loss", "BE", "Pending"] }).notNull().default("Pending"),
  notes: text("notes"),
  chartImageUrl: text("chart_image_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mt5Data = pgTable("mt5_data", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  balance: text("balance").notNull().default("0"),
  equity: text("equity").notNull().default("0"),
  margin: text("margin").notNull().default("0"),
  freeMargin: text("free_margin").notNull().default("0"),
  marginLevel: text("margin_level").notNull().default("0"),
  floatingPl: text("floating_pl").notNull().default("0"),
  positions: jsonb("positions").notNull().default([]),
  lastUpdate: timestamp("last_update").defaultNow().notNull(),
  syncToken: text("sync_token").notNull(),
});

export const userRole = pgTable("user_role", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  role: text("role").notNull(), // "PROVIDER" or "RECEIVER"
  kycVerified: boolean("kyc_verified").notNull().default(false),
  kycVerificationDate: timestamp("kyc_verification_date"),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
  riskAcknowledged: boolean("risk_acknowledged").notNull().default(false),
  syncToken: text("sync_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const signalProviderProfile = pgTable("signal_provider_profile", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  providerName: text("provider_name").notNull(),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  tradingStyle: text("trading_style"),
  marketsTraded: text("markets_traded"),
  signalType: text("signal_type"),
  yearsOfExperience: integer("years_of_experience"),
  telegramHandle: text("telegram_handle"),
  whatsappLink: text("whatsapp_link"),
  discordServer: text("discord_server"),
  customPlatform: text("custom_platform"),
  monthlyReturnPercentage: numeric("monthly_return_percentage", { precision: 10, scale: 2 }),
  winRate: numeric("win_rate", { precision: 5, scale: 2 }),
  performanceHistory: text("performance_history"),
  performanceVerified: boolean("performance_verified").notNull().default(false),
  verificationBadgeType: text("verification_badge_type"),
  pricingModel: text("pricing_model"),
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }),
  yearlyPrice: numeric("yearly_price", { precision: 10, scale: 2 }),
  priceDescription: text("price_description"),
  isActive: boolean("is_active").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  suspendedUntil: timestamp("suspended_until"),
  suspensionReason: text("suspension_reason"),
  disclaimerAcknowledged: boolean("disclaimer_acknowledged").notNull().default(false),
  noGuaranteeAcknowledged: boolean("no_guarantee_acknowledged").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  viewCount: integer("view_count").notNull().default(0),
  subscriberCount: integer("subscriber_count").notNull().default(0),
});

export const signalReceiver = pgTable("signal_receiver", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  receiverName: text("receiver_name").notNull(),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  interestedMarkets: text("interested_markets"),
  experience: text("experience"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerSubscription = pgTable("provider_subscription", {
  id: serial("id").primaryKey(),
  receiverId: text("receiver_id").notNull(),
  providerId: text("provider_id").notNull(),
  subscriptionStatus: text("subscription_status").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  cancelledAt: timestamp("cancelled_at"),
  externalPlatform: text("external_platform"),
  externalUserId: text("external_user_id"),
});

export const dispute = pgTable("dispute", {
  id: serial("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  reportedProviderId: text("reported_provider_id").notNull(),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence"),
  status: text("status").notNull().default("PENDING"),
  resolution: text("resolution"),
  action: text("action"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const platformDisclaimer = pgTable("platform_disclaimer", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  disclaimerVersion: text("disclaimer_version").notNull(),
  disclaimerText: text("disclaimer_text").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
});

export const insertTradeSchema = createInsertSchema(tradeJournal, {
  pair: z.string().min(1, "Pair is required"),
}).omit({
  id: true,
  createdAt: true,
  isRuleCompliant: true,
  violationReason: true,
  matchedSetup: true
});

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradeJournal.$inferSelect;
export type MT5Data = typeof mt5Data.$inferSelect;

export const updateTradeSchema = createInsertSchema(tradeJournal).partial();
export type UpdateTradeRequest = z.infer<typeof updateTradeSchema>;

export type ValidationResult = {
  valid: boolean;
  reason?: string;
  violations?: string[];
  matchedSetup?: string;
};

export const validationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  violations: z.array(z.string()).optional(),
  matchedSetup: z.string().optional(),
});
