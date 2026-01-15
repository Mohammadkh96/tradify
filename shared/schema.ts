import { pgTable, text, serial, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
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
  entryPrice: text("entry_price"), // Using text to avoid numeric precision issues in SQLite/Postgres mismatch or empty strings
  stopLoss: text("stop_loss"),
  takeProfit: text("take_profit"),
  riskReward: text("risk_reward"),
  
  // Outcome
  outcome: text("outcome", { enum: ["Win", "Loss", "BE", "Pending"] }).notNull().default("Pending"),
  notes: text("notes"),
  chartImageUrl: text("chart_image_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
