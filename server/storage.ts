import { db } from "./db";
import {
  tradeJournal,
  mt5Data,
  mt5History,
  dailyEquitySnapshots,
  userRole,
  adminAuditLog,
  aiPerformanceInsights,
  aiInsightLogs,
  type InsertTrade,
  type UpdateTradeRequest,
  type Trade,
  type MT5Data,
  type AdminAuditLog,
  type AIPerformanceInsight,
  type AIInsightLog
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
  getUserRole(userId: string): Promise<any>;
  updateUserSubscription(userId: string, tier: string): Promise<void>;
  createAdminAuditLog(log: { adminId: number | string; actionType: string; targetUserId: string; details: any }): Promise<AdminAuditLog>;
  getAdminAuditLogs(userId?: string): Promise<AdminAuditLog[]>;
  getAIInsights(userId: string, timeframe: string): Promise<AIPerformanceInsight[]>;
  saveAIInsight(insight: { userId: string; timeframe: string; insightText: string; metadata: any }): Promise<AIPerformanceInsight>;
  logAIRequest(log: { userId: string; prompt: string; response: string }): Promise<AIInsightLog>;
}

export class DatabaseStorage implements IStorage {
  async getUserRole(userId: string): Promise<any> {
    const [role] = await db.select().from(userRole).where(eq(userRole.userId, userId)).limit(1);
    return role;
  }

  async createUserRole(role: any): Promise<any> {
    const [newUserRole] = await db.insert(userRole).values(role).returning();
    return newUserRole;
  }

  async updateUserSubscription(userId: string, tier: string): Promise<void> {
    const [existing] = await db.select().from(userRole).where(eq(userRole.userId, userId)).limit(1);
    if (existing) {
      await db.update(userRole)
        .set({ subscriptionTier: tier, updatedAt: new Date() })
        .where(eq(userRole.userId, userId));
    } else {
      await db.insert(userRole).values({
        userId,
        role: "TRADER",
        subscriptionTier: tier,
      });
    }
  }

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
    
    const now = new Date();
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
      lastUpdate: now,
    };

    console.log(`[MT5 Sync] HEARTBEAT: Received data from ${data.userId} at ${now.toISOString()}`);

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
    console.log(`[MT5 Storage] Syncing history for ${userId}. Received ${trades.length} trades.`);
    for (const trade of trades) {
      try {
        const ticketStr = trade.ticket.toString();
        const [existing] = await db.select().from(mt5History)
          .where(and(eq(mt5History.userId, userId), eq(mt5History.ticket, ticketStr)))
          .limit(1);

        if (!existing) {
          console.log(`[MT5 Storage] Inserting new trade ticket ${ticketStr} for ${userId}`);
          const openTime = new Date(trade.open_time * 1000);
          const closeTime = new Date(trade.close_time * 1000);
          
          await db.insert(mt5History).values({
            userId,
            ticket: ticketStr,
            symbol: trade.symbol,
            direction: trade.type === 0 || trade.type === "Buy" ? "Buy" : "Sell",
            volume: trade.volume.toString(),
            entryPrice: trade.price?.toString() || "0",
            exitPrice: trade.price?.toString() || "0",
            sl: trade.sl?.toString(),
            tp: trade.tp?.toString(),
            openTime,
            closeTime,
            duration: trade.close_time - trade.open_time,
            grossPl: trade.profit.toString(),
            commission: trade.commission?.toString() || "0",
            swap: trade.swap?.toString() || "0",
            netPl: (parseFloat(trade.profit || 0) + parseFloat(trade.commission || 0) + parseFloat(trade.swap || 0)).toString(),
          });

          // Also auto-log to journal for manual rule verification if needed
          await this.createTrade({
            userId,
            pair: trade.symbol,
            direction: (trade.type === 0 || trade.type === "Buy") ? "Long" : "Short",
            timeframe: "MT5_SYNC",
            entryPrice: trade.price?.toString() || "0",
            outcome: parseFloat(trade.profit) >= 0 ? "Win" : "Loss",
            notes: `[MT5 Auto-Sync] Ticket: ${ticketStr}`,
            htfBiasClear: true,
            zoneValid: true,
            entryConfirmed: true,
            riskReward: "0",
            htfBias: "Bullish",
            structureState: "None",
            liquidityStatus: "None",
            zoneValidity: "Valid",
            liquidityTaken: true,
            structureConfirmed: true,
          });
        }
      } catch (err) {
        console.error(`[MT5 Storage] Error syncing trade ${trade.ticket}:`, err);
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

  async createAdminAuditLog(log: { adminId: number; actionType: string; targetUserId: string; details: any }): Promise<AdminAuditLog> {
    const [inserted] = await db.insert(adminAuditLog).values({
      adminId: log.adminId.toString(),
      actionType: log.actionType,
      targetUserId: log.targetUserId,
      details: log.details,
    }).returning();
    return inserted;
  }

  async getAdminAuditLogs(userId?: string): Promise<AdminAuditLog[]> {
    const query = db.select().from(adminAuditLog);
    if (userId) {
      return await query.where(eq(adminAuditLog.targetUserId, userId)).orderBy(desc(adminAuditLog.timestamp));
    }
    return await query.orderBy(desc(adminAuditLog.timestamp));
  }

  async getAIInsights(userId: string, timeframe: string): Promise<AIPerformanceInsight[]> {
    return await db.select()
      .from(aiPerformanceInsights)
      .where(and(eq(aiPerformanceInsights.userId, userId), eq(aiPerformanceInsights.timeframe, timeframe)))
      .orderBy(desc(aiPerformanceInsights.createdAt))
      .limit(5);
  }

  async saveAIInsight(insight: { userId: string; timeframe: string; insightText: string; metadata: any }): Promise<AIPerformanceInsight> {
    const [inserted] = await db.insert(aiPerformanceInsights).values(insight).returning();
    return inserted;
  }

  async logAIRequest(log: { userId: string; prompt: string; response: string }): Promise<AIInsightLog> {
    const [inserted] = await db.insert(aiInsightLogs).values(log).returning();
    return inserted;
  }

  async getTrades(): Promise<Trade[]> {
    return await db.select().from(tradeJournal).orderBy(desc(tradeJournal.createdAt));
  }

  async getTrade(id: number): Promise<Trade | undefined> {
    const [trade] = await db.select().from(tradeJournal).where(eq(tradeJournal.id, id)).limit(1);
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
