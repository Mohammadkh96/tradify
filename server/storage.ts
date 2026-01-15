import { db } from "./db";
import {
  tradeJournal,
  type InsertTrade,
  type UpdateTradeRequest,
  type Trade
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getTrades(): Promise<Trade[]>;
  getTrade(id: number): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, updates: UpdateTradeRequest): Promise<Trade>;
  deleteTrade(id: number): Promise<void>;
  validateTradeRules(trade: InsertTrade): { valid: boolean; reason?: string; matchedSetup?: string; violations?: string[] };
}

export class DatabaseStorage implements IStorage {
  async getTrades(): Promise<Trade[]> {
    return await db.select().from(tradeJournal).orderBy(desc(tradeJournal.createdAt));
  }

  async getTrade(id: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(tradeJournal).where(eq(tradeJournal.id, id));
    return trade;
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const validation = this.validateTradeRules(insertTrade);
    const finalTrade = {
      ...insertTrade,
      isRuleCompliant: validation.valid,
      violationReason: validation.reason || null,
      matchedSetup: validation.matchedSetup || null,
    };
    const [trade] = await db.insert(tradeJournal).values(finalTrade).returning();
    return trade;
  }

  async updateTrade(id: number, updates: UpdateTradeRequest): Promise<Trade> {
    const [updated] = await db.update(tradeJournal)
      .set(updates)
      .where(eq(tradeJournal.id, id))
      .returning();
    return updated;
  }

  async deleteTrade(id: number): Promise<void> {
    await db.delete(tradeJournal).where(eq(tradeJournal.id, id));
  }

  validateTradeRules(trade: InsertTrade) {
    const violations: string[] = [];

    // Global Hard Rules
    if (!trade.htfBiasClear) violations.push("HTF bias not clear");
    if (!trade.zoneValid) violations.push("Zone not valid");
    if (!trade.liquidityTaken) violations.push("Liquidity not taken");
    if (!trade.structureConfirmed) violations.push("Structure not confirmed");
    if (!trade.entryConfirmed) violations.push("Entry not confirmed");
    
    // Logic-based checks
    if (trade.direction === "Long" && trade.htfBias === "Bearish") {
      violations.push("Against HTF structure (Bearish bias on Long trade)");
    }
    if (trade.direction === "Short" && trade.htfBias === "Bullish") {
      violations.push("Against HTF structure (Bullish bias on Short trade)");
    }
    if (trade.zoneValidity === "Invalid") {
      violations.push("Zone invalidated");
    }

    // RR Check
    if (trade.riskReward && parseFloat(trade.riskReward) < 1.5) {
      violations.push("RR too small (Minimum 1:1.5)");
    }

    // Setup Matching
    let matchedSetup: string | undefined;
    if (violations.length === 0) {
      if (trade.structureState === "BOS") {
        matchedSetup = trade.direction === "Long" ? "Bullish Continuation" : "Bearish Continuation";
      } else if (trade.structureState === "CHOCH") {
        matchedSetup = "Liquidity Sweep Reversal";
      }
    }

    return {
      valid: violations.length === 0,
      reason: violations.join(", "),
      violations,
      matchedSetup
    };
  }
}

export const storage = new DatabaseStorage();
