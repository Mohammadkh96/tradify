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
  updateMT5Data(data: { account: any; positions: any }): Promise<MT5Data>;
  getMT5Data(): Promise<MT5Data | undefined>;
}

export class DatabaseStorage implements IStorage {
  async updateMT5Data(data: { account: any; positions: any }): Promise<MT5Data> {
    const [existing] = await db.select().from(mt5Data).limit(1);
    if (existing) {
      const [updated] = await db.update(mt5Data)
        .set({ accountInfo: data.account, positions: data.positions, lastUpdate: new Date() })
        .where(eq(mt5Data.id, existing.id))
        .returning();
      return updated;
    }
    const [inserted] = await db.insert(mt5Data)
      .values({ accountInfo: data.account, positions: data.positions })
      .returning();
    return inserted;
  }

  async getMT5Data(): Promise<MT5Data | undefined> {
    const [data] = await db.select().from(mt5Data).limit(1);
    return data;
  }
  async getTrades(): Promise<Trade[]> {
    return await db.select().from(tradeJournal).orderBy(desc(tradeJournal.createdAt));
  }

  async getTrade(id: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(tradeJournal).where(eq(tradeJournal.id, id));
    return trade;
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const validation = this.validateTradeRules(insertTrade);
    
    // Ensure numeric strings are handled safely
    const finalTrade = {
      ...insertTrade,
      entryPrice: insertTrade.entryPrice || null,
      stopLoss: insertTrade.stopLoss || null,
      takeProfit: insertTrade.takeProfit || null,
      riskReward: insertTrade.riskReward || null,
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

    // GR-02: No trade allowed inside opposing HTF supply/demand
    // (This is captured by manual user confirmation 'htfBiasClear')
    if (!trade.htfBiasClear) violations.push("HTF bias not clear");
    
    // GR-03 & GR-06/07: Zone validation
    if (!trade.zoneValid || trade.zoneValidity === "Invalid") {
      violations.push("Zone invalidated or not valid");
    }

    // GR-05: No confirmation → NO TRADE
    if (!trade.entryConfirmed) violations.push("Entry confirmation missing");
    
    // GR-08: Liquidity must be taken before reversal entries
    if (trade.structureState === "CHOCH" && trade.liquidityStatus !== "Taken") {
      violations.push("Liquidity must be taken before reversal (CHOCH)");
    }

    // Directional Alignment
    if (trade.direction === "Long" && trade.htfBias === "Bearish") {
      violations.push("Against HTF structure (Bearish bias on Long trade)");
    }
    if (trade.direction === "Short" && trade.htfBias === "Bullish") {
      violations.push("Against HTF structure (Bullish bias on Short trade)");
    }

    // RR Check (GR-04)
    if (trade.riskReward && parseFloat(trade.riskReward) < 1.5) {
      violations.push("RR too small (Minimum 1:1.5)");
    }

    // Setup Matching (Strategy Table)
    let matchedSetup: string | undefined;
    if (violations.length === 0) {
      if (trade.structureState === "BOS") {
        matchedSetup = "Trend Continuation";
      } else if (trade.structureState === "CHOCH") {
        matchedSetup = "Liquidity Sweep Reversal";
      }
    }

    return {
      valid: violations.length === 0,
      reason: violations.join(" | "),
      violations,
      matchedSetup
    };
  }
}

export const storage = new DatabaseStorage();
