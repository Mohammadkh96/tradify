import { pgTable, text, serial, boolean, timestamp, numeric, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tradeJournal = pgTable("trade_journal", {
  id: serial("id").primaryKey(),
  pair: text("pair").notNull(),
  direction: text("direction").notNull(), // "Long" | "Short"
  timeframe: text("timeframe").notNull(),
  
  // Detection Rules (Manual Inputs)
  htfBias: text("htf_bias").notNull(), // "Bullish" | "Bearish" | "Range"
  structureState: text("structure_state").notNull(), // "BOS" | "CHOCH" | "None"
  liquidityStatus: text("liquidity_status").notNull(), // "Taken" | "Pending" | "None"
  zoneValidity: text("zone_validity").notNull(), // "Valid" | "Invalid"
  
  // Execution Checklist (Non-negotiables)
  htfBiasClear: boolean("htf_bias_clear").default(false).notNull(),
  zoneValid: boolean("zone_valid").default(false).notNull(),
  liquidityTaken: boolean("liquidity_taken").default(false).notNull(),
  structureConfirmed: boolean("structure_confirmed").default(false).notNull(),
  entryConfirmed: boolean("entry_confirmed").default(false).notNull(),
  
  // Rule Engine Results
  isRuleCompliant: boolean("is_rule_compliant").default(false).notNull(),
  violationReason: text("violation_reason"),
  matchedSetup: text("matched_setup"), // e.g. "Bullish Continuation"
  
  // Trade Details
  entryPrice: numeric("entry_price"),
  stopLoss: numeric("stop_loss"),
  takeProfit: numeric("take_profit"),
  riskReward: numeric("risk_reward"),
  
  outcome: text("outcome"), // "Pending", "Win", "Loss", "BE"
  notes: text("notes"),
  chartImageUrl: text("chart_image_url"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTradeSchema = createInsertSchema(tradeJournal).omit({ 
  id: true, 
  createdAt: true 
});

export type Trade = typeof tradeJournal.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type CreateTradeRequest = InsertTrade;
export type UpdateTradeRequest = Partial<InsertTrade>;

// Rule Engine Types
export const validationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  matchedSetup: z.string().optional(),
  violations: z.array(z.string()).optional()
});

export type ValidationResult = z.infer<typeof validationResultSchema>;
