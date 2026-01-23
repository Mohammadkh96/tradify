import { db } from "./db";
import {
  tradeJournal,
  mt5Data,
  mt5History,
  dailyEquitySnapshots,
  type InsertTrade,
  type UpdateTradeRequest,
  type Trade,
  type MT5Data
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getTrades(): Promise<Trade[]>;
  getTrade(id: number): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, updates: UpdateTradeRequest): Promise<Trade>;
  deleteTrade(id: number): Promise<void>;
  validateTradeRules(trade: InsertTrade): { valid: boolean; reason?: string; matchedSetup?: string; violations?: string[] };
  updateMT5Data(data: { 
    userId: string;
    balance: string;
    equity: string;
    margin: string;
    freeMargin: string;
    marginLevel: string;
    floatingPl: string;
    leverage?: number;
    currency?: string;
    positions: any[];
    syncToken: string;
  }): Promise<MT5Data>;
  syncMT5History(userId: string, trades: any[]): Promise<void>;
  getMT5History(userId: string, from?: Date, to?: Date): Promise<any[]>;
  getDailySnapshots(userId: string): Promise<any[]>;
  getMT5Data(userId: string): Promise<MT5Data | undefined>;
}

export class DatabaseStorage implements IStorage {
  async updateMT5Data(data: { 
    userId: string;
    balance: string;
    equity: string;
    margin: string;
    freeMargin: string;
    marginLevel: string;
    floatingPl: string;
    leverage?: number;
    currency?: string;
    positions: any[];
    syncToken: string;
  }): Promise<MT5Data> {
    const [existing] = await db.select().from(mt5Data).where(eq(mt5Data.userId, data.userId)).limit(1);
    
    const values = {
      userId: data.userId,
      balance: data.balance.toString(),
      equity: data.equity.toString(),
      margin: data.margin.toString(),
      freeMargin: data.freeMargin.toString(),
      marginLevel: data.marginLevel.toString(),
      floatingPl: data.floatingPl.toString(),
      leverage: data.leverage || 100,
      currency: data.currency || "USD",
      positions: data.positions,
      syncToken: data.syncToken,
      lastUpdate: new Date(),
    };

    // Update Daily Snapshot
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [existingSnapshot] = await db.select().from(dailyEquitySnapshots)
      .where(and(eq(dailyEquitySnapshots.userId, data.userId), eq(dailyEquitySnapshots.date, today)))
      .limit(1);

    if (existingSnapshot) {
      await db.update(dailyEquitySnapshots)
        .set({ equity: values.equity, balance: values.balance })
        .where(eq(dailyEquitySnapshots.id, existingSnapshot.id));
    } else {
      await db.insert(dailyEquitySnapshots).values({
        userId: data.userId,
        date: today,
        equity: values.equity,
        balance: values.balance,
      });
    }

    if (existing) {
      const [updated] = await db.update(mt5Data)
        .set(values)
        .where(eq(mt5Data.userId, data.userId))
        .returning();
      return updated;
    }
    
    const [inserted] = await db.insert(mt5Data)
      .values(values)
      .returning();
    return inserted;
  }

  async syncMT5History(userId: string, trades: any[]): Promise<void> {
    for (const trade of trades) {
      const [existing] = await db.select().from(mt5History).where(eq(mt5History.ticket, trade.ticket.toString())).limit(1);
      if (!existing) {
        await db.insert(mt5History).values({
          userId,
          ticket: trade.ticket.toString(),
          symbol: trade.symbol,
          direction: trade.type,
          volume: trade.volume.toString(),
          entryPrice: trade.price_open.toString(),
          exitPrice: trade.price_close.toString(),
          sl: trade.sl?.toString(),
          tp: trade.tp?.toString(),
          openTime: new Date(trade.open_time * 1000),
          closeTime: new Date(trade.close_time * 1000),
          duration: trade.close_time - trade.open_time,
          grossPl: trade.profit.toString(),
          commission: trade.commission?.toString() || "0",
          swap: trade.swap?.toString() || "0",
          netPl: (trade.profit + (trade.commission || 0) + (trade.swap || 0)).toString(),
        });
      }
    }
  }

  async getMT5History(userId: string, from?: Date, to?: Date): Promise<any[]> {
    return await db.select().from(mt5History).where(eq(mt5History.userId, userId)).orderBy(desc(mt5History.closeTime));
  }

  async getDailySnapshots(userId: string): Promise<any[]> {
    return await db.select().from(dailyEquitySnapshots).where(eq(dailyEquitySnapshots.userId, userId)).orderBy(dailyEquitySnapshots.date);
  }

  async getMT5Data(userId: string): Promise<MT5Data | undefined> {
    const [data] = await db.select().from(mt5Data).where(eq(mt5Data.userId, userId)).limit(1);
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

    if (!trade.htfBiasClear) violations.push("HTF bias not clear");
    
    if (!trade.zoneValid || trade.zoneValidity === "Invalid") {
      violations.push("Zone invalidated or not valid");
    }

    if (!trade.entryConfirmed) violations.push("Entry confirmation missing");
    
    if (trade.structureState === "CHOCH" && trade.liquidityStatus !== "Taken") {
      violations.push("Liquidity must be taken before reversal (CHOCH)");
    }

    if (trade.direction === "Long" && trade.htfBias === "Bearish") {
      violations.push("Against HTF structure (Bearish bias on Long trade)");
    }
    if (trade.direction === "Short" && trade.htfBias === "Bullish") {
      violations.push("Against HTF structure (Bullish bias on Short trade)");
    }

    if (trade.riskReward && parseFloat(trade.riskReward) < 1.5) {
      violations.push("RR too small (Minimum 1:1.5)");
    }

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
