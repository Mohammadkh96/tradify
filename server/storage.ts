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
    // Implement server-side rule validation as a secondary check
    const { isValid, reason } = this.validateRules(insertTrade);
    const finalTrade = {
      ...insertTrade,
      isRuleCompliant: isValid,
      violationReason: reason || null,
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

  private validateRules(trade: any): { isValid: boolean; reason?: string } {
    if (!trade.htfBiasClear) return { isValid: false, reason: "HTF bias not clear" };
    if (!trade.zoneValid) return { isValid: false, reason: "Zone not valid" };
    if (!trade.liquidityTaken) return { isValid: false, reason: "Liquidity not taken" };
    if (!trade.structureConfirmed) return { isValid: false, reason: "Structure not confirmed" };
    if (!trade.entryConfirmed) return { isValid: false, reason: "Entry not confirmed" };
    
    // Additional logic-based checks
    if (trade.direction === "Long" && trade.htfBias === "Bearish") {
      return { isValid: false, reason: "Against HTF structure (Bearish bias on Long trade)" };
    }
    if (trade.direction === "Short" && trade.htfBias === "Bullish") {
      return { isValid: false, reason: "Against HTF structure (Bullish bias on Short trade)" };
    }
    if (trade.zoneValidity === "Invalid") return { isValid: false, reason: "Zone invalidated" };
    
    return { isValid: true };
  }
}

export const storage = new DatabaseStorage();
