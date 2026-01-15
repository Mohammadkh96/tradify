import { pgTable, text, serial, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tradeJournal = pgTable("trade_journal", {
  id: serial("id").primaryKey(),
  pair: text("pair").notNull(), // e.g., EURUSD
  direction: text("direction").notNull(), // "Long" | "Short"
  
  // Execution Checklist (Non-negotiables)
  htfBiasClear: boolean("htf_bias_clear").default(false).notNull(),
  zoneValid: boolean("zone_valid").default(false).notNull(),
  liquidityTaken: boolean("liquidity_taken").default(false).notNull(),
  structureConfirmed: boolean("structure_confirmed").default(false).notNull(),
  entryConfirmed: boolean("entry_confirmed").default(false).notNull(),
  
  // Trade Details
  entryPrice: numeric("entry_price"),
  stopLoss: numeric("stop_loss"),
  takeProfit: numeric("take_profit"),
  riskReward: numeric("risk_reward"),
  
  outcome: text("outcome"), // "Pending", "Win", "Loss", "BE"
  notes: text("notes"),
  
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
