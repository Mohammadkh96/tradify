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
  hubPosts,
  hubComments,
  hubReports,
  creatorProfiles,
  creatorApplications,
  signalProviderProfile,
  strategies,
  strategyRules,
  tradeComplianceResults,
  tradeRuleEvaluations,
  type HubPost,
  type HubComment,
  type HubReport,
  type CreatorProfile,
  type CreatorApplication,
  type InsertTrade,
  type UpdateTradeRequest,
  type Trade,
  type MT5Data,
  type AdminAuditLog,
  type AIPerformanceInsight,
  type AIInsightLog,
  type Strategy,
  type InsertStrategy,
  type StrategyRule,
  type InsertStrategyRule,
  type TradeComplianceResult,
  type InsertTradeComplianceResult,
  type TradeRuleEvaluation,
  type InsertTradeRuleEvaluation
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

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
  // Trader Hub Methods
  getHubPosts(): Promise<(HubPost & { user?: any, commentCount: number })[]>;
  createHubPost(post: any): Promise<HubPost>;
  deleteHubPost(id: number, userId: string, isAdmin: boolean): Promise<boolean>;
  reportHubPost(report: any): Promise<HubReport>;
  createHubComment(comment: any): Promise<HubComment>;
  getHubComments(postId: number): Promise<HubComment[]>;
  // Creator Program Methods
  getCreatorProfile(userId: string): Promise<CreatorProfile | undefined>;
  createCreatorApplication(app: any): Promise<CreatorApplication>;
  getCreatorApplications(): Promise<CreatorApplication[]>;
  updateCreatorApplicationStatus(id: number, status: string): Promise<void>;
  updateCreatorProfile(userId: string, updates: any): Promise<CreatorProfile>;
  getAllApprovedCreators(): Promise<CreatorProfile[]>;
  // Strategy Methods
  getStrategies(userId: string): Promise<Strategy[]>;
  getStrategy(id: number): Promise<Strategy | undefined>;
  getActiveStrategy(userId: string): Promise<Strategy | undefined>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(id: number, updates: Partial<InsertStrategy>): Promise<Strategy>;
  deleteStrategy(id: number): Promise<void>;
  setActiveStrategy(userId: string, strategyId: number): Promise<void>;
  getStrategyRules(strategyId: number): Promise<StrategyRule[]>;
  createStrategyRule(rule: InsertStrategyRule): Promise<StrategyRule>;
  updateStrategyRule(id: number, updates: Partial<InsertStrategyRule>): Promise<StrategyRule>;
  deleteStrategyRule(id: number): Promise<void>;
  deleteStrategyRules(strategyId: number): Promise<void>;
  // Compliance Evaluation Methods
  saveComplianceResult(result: InsertTradeComplianceResult): Promise<TradeComplianceResult>;
  saveRuleEvaluations(evaluations: InsertTradeRuleEvaluation[]): Promise<TradeRuleEvaluation[]>;
  getTradeComplianceResult(tradeId: number): Promise<(TradeComplianceResult & { evaluations: TradeRuleEvaluation[] }) | undefined>;
  getTradeComplianceHistory(userId: string, limit?: number, strategyId?: number): Promise<TradeComplianceResult[]>;
  getTradeComplianceResultsByTrade(tradeId: number): Promise<(TradeComplianceResult & { evaluations: TradeRuleEvaluation[] })[]>;
  getComplianceScore(userId: string, strategyId: number, tradeCount?: number): Promise<{
    compliancePercent: number;
    violationsCount: number;
    trendDirection: 'improving' | 'declining' | 'stable';
    tradesEvaluated: number;
  }>;
  getDetailedViolations(userId: string, strategyId: number, tradeCount?: number): Promise<{
    results: (TradeComplianceResult & { evaluations: TradeRuleEvaluation[] })[];
    violationsByRule: Record<string, { count: number; ruleLabel: string; reasons: string[] }>;
    patterns: {
      byTimeOfDay: Record<string, { total: number; violations: number }>;
      byDayOfWeek: Record<string, { total: number; violations: number }>;
      riskDrift: { recentViolationRate: number; olderViolationRate: number };
    };
  }>;
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

  async updateUserSubscriptionInfo(userId: string, info: {
    subscriptionStatus?: string;
    subscriptionTier?: string;
    subscriptionProvider?: string;
    currentPlan?: string;
    renewalDate?: Date;
    paypalSubscriptionId?: string;
    syncToken?: string;
  }) {
    const [user] = await db.update(userRole)
      .set({ ...info, updatedAt: new Date() })
      .where(eq(userRole.userId, userId))
      .returning();
    return user;
  }

  async updateCreatorProfile(userId: string, updates: any): Promise<CreatorProfile> {
    const [updated] = await db.update(creatorProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(creatorProfiles.userId, userId))
      .returning();
    return updated;
  }

  async updateUserSubscription(userId: string, tier: string): Promise<void> {
    await this.updateUserSubscriptionInfo(userId, { subscriptionTier: tier });
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
    today.setUTCHours(0, 0, 0, 0); // Use UTC for consistency
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
    console.log(`[MT5 Sync] Updating history for ${userId}. Data Integrity Check: Enforcing unique tickets.`);
    for (const trade of trades) {
      try {
        const ticketStr = trade.ticket.toString();
        // 1. Strict Deduplication: Check for existing ticket in mt5History
        const [existing] = await db.select().from(mt5History)
          .where(and(eq(mt5History.userId, userId), eq(mt5History.ticket, ticketStr)))
          .limit(1);

        if (!existing) {
          console.log(`[MT5 Sync] NEW DEAL: Ticket ${ticketStr} for ${userId}`);
          const openTime = new Date(trade.open_time * 1000);
          const closeTime = new Date(trade.close_time * 1000);
          
          // 2. Accurate P&L: Net P&L = profit + commission + swap
          const commission = parseFloat(trade.commission || 0);
          const swap = parseFloat(trade.swap || 0);
          const profit = parseFloat(trade.profit || 0);
          const netPlNum = profit + commission + swap;
          const netPl = netPlNum.toFixed(2);
          
          await db.insert(mt5History).values({
            userId,
            ticket: ticketStr,
            symbol: trade.symbol,
            direction: (trade.type === 0 || trade.type === "Buy" || trade.type === "DEAL_TYPE_BUY") ? "Buy" : "Sell",
            volume: trade.volume.toString(),
            entryPrice: trade.price?.toString() || "0",
            exitPrice: trade.price?.toString() || "0",
            sl: trade.sl?.toString(),
            tp: trade.tp?.toString(),
            openTime,
            closeTime,
            duration: trade.close_time - trade.open_time,
            grossPl: profit.toString(),
            commission: commission.toString(),
            swap: swap.toString(),
            netPl,
          });

          // 3. Journal Integration: Check if already exists in trade_journal
          const [existingJournal] = await db.select().from(tradeJournal)
            .where(and(eq(tradeJournal.userId, userId), eq(tradeJournal.notes, `MT5_TICKET_${ticketStr}`)))
            .limit(1);

          if (!existingJournal) {
            console.log(`[MT5 Sync] Auto-journaling Ticket ${ticketStr} for ${userId}`);
            const direction = (trade.type === 0 || trade.type === "Buy" || trade.type === "DEAL_TYPE_BUY") ? "Long" : "Short";
            
            await this.createTrade({
              userId,
              pair: trade.symbol,
              direction,
              timeframe: "MT5_SYNC",
              htfBias: "Bullish", // Default for auto-sync, can be edited
              htfBiasClear: true,
              zoneValid: true,
              zoneValidity: "Valid",
              liquidityTaken: true,
              liquidityStatus: "Taken",
              structureConfirmed: true,
              structureState: "BOS",
              entryConfirmed: true,
              entryPrice: trade.price?.toString() || "0",
              stopLoss: trade.sl?.toString() || null,
              takeProfit: trade.tp?.toString() || null,
              riskReward: "0",
              netPl,
              outcome: netPlNum > 0 ? "Win" : netPlNum < 0 ? "Loss" : "Break-even",
              notes: `MT5_TICKET_${ticketStr}`,
            });
          }
        }
      } catch (err) {
        console.error(`[MT5 Sync] Integrity Error on ticket ${trade.ticket}:`, err);
      }
    }
  }

  async getMT5History(userId: string, from?: Date, to?: Date): Promise<any[]> {
    return await db.select().from(mt5History)
      .where(eq(mt5History.userId, userId))
      .orderBy(desc(mt5History.closeTime));
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

  async getTrades(userId?: string): Promise<Trade[]> {
    if (userId) {
      // Return ALL journal trades for this user. 
      // Removed the 30-day filter to ensure 100% visibility of all MT5 synced trades.
      return await db.select().from(tradeJournal)
        .where(eq(tradeJournal.userId, userId))
        .orderBy(desc(tradeJournal.createdAt));
    }
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
      netPl: insertTrade.netPl || "0",
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

  // Trader Hub Implementation
  async getHubPosts(): Promise<(HubPost & { user?: any, commentCount: number })[]> {
    const posts = await db.select().from(hubPosts).orderBy(desc(hubPosts.createdAt));
    const postsWithDetails = await Promise.all(posts.map(async (post) => {
      const user = await this.getUserRole(post.userId);
      const comments = await db.select().from(hubComments).where(eq(hubComments.postId, post.id));
      return {
        ...post,
        user: user ? { userId: user.userId, role: user.role } : undefined,
        commentCount: comments.length
      };
    }));
    return postsWithDetails;
  }

  async createHubPost(post: any): Promise<HubPost> {
    const [newPost] = await db.insert(hubPosts).values(post).returning();
    return newPost;
  }

  async deleteHubPost(id: number, userId: string, isAdmin: boolean): Promise<boolean> {
    if (isAdmin) {
      await db.delete(hubPosts).where(eq(hubPosts.id, id));
      return true;
    }
    const [post] = await db.select().from(hubPosts).where(eq(hubPosts.id, id)).limit(1);
    if (post && post.userId === userId) {
      await db.delete(hubPosts).where(eq(hubPosts.id, id));
      return true;
    }
    return false;
  }

  async reportHubPost(report: any): Promise<HubReport> {
    const [newReport] = await db.insert(hubReports).values(report).returning();
    return newReport;
  }

  async createHubComment(comment: any): Promise<HubComment> {
    const [newComment] = await db.insert(hubComments).values(comment).returning();
    return newComment;
  }

  async getHubComments(postId: number): Promise<HubComment[]> {
    return await db.select().from(hubComments).where(eq(hubComments.postId, postId)).orderBy(desc(hubComments.createdAt));
  }

  // Creator Program Implementation
  async getCreatorProfile(userId: string): Promise<CreatorProfile | undefined> {
    const [profile] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, userId)).limit(1);
    return profile;
  }

  async createCreatorApplication(app: any): Promise<CreatorApplication> {
    const [newApp] = await db.insert(creatorApplications).values(app).returning();
    return newApp;
  }

  async getCreatorApplications(): Promise<CreatorApplication[]> {
    return await db.select().from(creatorApplications).orderBy(desc(creatorApplications.createdAt));
  }

  async updateCreatorApplicationStatus(id: number, status: string): Promise<void> {
    const [app] = await db.update(creatorApplications)
      .set({ status })
      .where(eq(creatorApplications.id, id))
      .returning();
    
    if (status === "APPROVED") {
      const [existing] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, app.userId)).limit(1);
      if (!existing) {
        await db.insert(creatorProfiles).values({
          userId: app.userId,
          displayName: app.userId.split('@')[0],
          status: "APPROVED"
        });
      } else {
        await db.update(creatorProfiles).set({ status: "APPROVED" }).where(eq(creatorProfiles.userId, app.userId));
      }
    }
  }

  async updateUserStripeInfo(userId: string, stripeInfo: any) {
    // Removed Stripe integration
  }

  async getProduct(productId: string) {
    return null;
  }

  async getSubscription(subscriptionId: string) {
    return null;
  }

  async listProductsWithPrices(active = true) {
    return [];
  }

  async getPrice(priceId: string) {
    return null;
  }

  async getSignalProviderProfile(userId: string) {
    const [profile] = await db.select().from(signalProviderProfile).where(eq(signalProviderProfile.userId, userId)).limit(1);
    return profile;
  }

  async getAllApprovedCreators(): Promise<CreatorProfile[]> {
    return await db.select().from(creatorProfiles).where(eq(creatorProfiles.status, "APPROVED"));
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

  // ==================== STRATEGY METHODS ====================

  async getStrategies(userId: string): Promise<Strategy[]> {
    return db.select().from(strategies).where(eq(strategies.userId, userId)).orderBy(desc(strategies.createdAt));
  }

  async getStrategy(id: number): Promise<Strategy | undefined> {
    const [strategy] = await db.select().from(strategies).where(eq(strategies.id, id)).limit(1);
    return strategy;
  }

  async getActiveStrategy(userId: string): Promise<Strategy | undefined> {
    const [strategy] = await db.select().from(strategies)
      .where(and(eq(strategies.userId, userId), eq(strategies.isActive, true)))
      .limit(1);
    return strategy;
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const [created] = await db.insert(strategies).values(strategy).returning();
    return created;
  }

  async updateStrategy(id: number, updates: Partial<InsertStrategy>): Promise<Strategy> {
    const [updated] = await db.update(strategies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(strategies.id, id))
      .returning();
    return updated;
  }

  async deleteStrategy(id: number): Promise<void> {
    await this.deleteStrategyRules(id);
    await db.delete(strategies).where(eq(strategies.id, id));
  }

  async setActiveStrategy(userId: string, strategyId: number): Promise<void> {
    await db.update(strategies)
      .set({ isActive: false })
      .where(eq(strategies.userId, userId));
    
    await db.update(strategies)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(strategies.id, strategyId));
  }

  async getStrategyRules(strategyId: number): Promise<StrategyRule[]> {
    return db.select().from(strategyRules)
      .where(eq(strategyRules.strategyId, strategyId))
      .orderBy(strategyRules.sortOrder);
  }

  async createStrategyRule(rule: InsertStrategyRule): Promise<StrategyRule> {
    const [created] = await db.insert(strategyRules).values(rule).returning();
    return created;
  }

  async updateStrategyRule(id: number, updates: Partial<InsertStrategyRule>): Promise<StrategyRule> {
    const [updated] = await db.update(strategyRules)
      .set(updates)
      .where(eq(strategyRules.id, id))
      .returning();
    return updated;
  }

  async deleteStrategyRule(id: number): Promise<void> {
    await db.delete(strategyRules).where(eq(strategyRules.id, id));
  }

  async deleteStrategyRules(strategyId: number): Promise<void> {
    await db.delete(strategyRules).where(eq(strategyRules.strategyId, strategyId));
  }

  async saveComplianceResult(result: InsertTradeComplianceResult): Promise<TradeComplianceResult> {
    // Preserve history - do not delete old results, just add new ones
    const [created] = await db.insert(tradeComplianceResults).values(result).returning();
    return created;
  }

  async saveRuleEvaluations(evaluations: InsertTradeRuleEvaluation[]): Promise<TradeRuleEvaluation[]> {
    if (evaluations.length === 0) return [];
    const created = await db.insert(tradeRuleEvaluations).values(evaluations).returning();
    return created;
  }

  async getTradeComplianceResult(tradeId: number): Promise<(TradeComplianceResult & { evaluations: TradeRuleEvaluation[] }) | undefined> {
    const [result] = await db.select().from(tradeComplianceResults)
      .where(eq(tradeComplianceResults.tradeId, tradeId))
      .orderBy(desc(tradeComplianceResults.evaluatedAt))
      .limit(1);
    
    if (!result) return undefined;
    
    const evaluations = await db.select().from(tradeRuleEvaluations)
      .where(eq(tradeRuleEvaluations.complianceResultId, result.id));
    
    return { ...result, evaluations };
  }

  async getTradeComplianceHistory(userId: string, limit: number = 50, strategyId?: number): Promise<TradeComplianceResult[]> {
    const conditions = [eq(tradeComplianceResults.userId, userId)];
    if (strategyId) {
      conditions.push(eq(tradeComplianceResults.strategyId, strategyId));
    }
    return db.select().from(tradeComplianceResults)
      .where(and(...conditions))
      .orderBy(desc(tradeComplianceResults.evaluatedAt))
      .limit(limit);
  }

  async getTradeComplianceResultsByTrade(tradeId: number): Promise<(TradeComplianceResult & { evaluations: TradeRuleEvaluation[] })[]> {
    const results = await db.select().from(tradeComplianceResults)
      .where(eq(tradeComplianceResults.tradeId, tradeId))
      .orderBy(desc(tradeComplianceResults.evaluatedAt));
    
    const resultsWithEvaluations: (TradeComplianceResult & { evaluations: TradeRuleEvaluation[] })[] = [];
    
    for (const result of results) {
      const evaluations = await db.select().from(tradeRuleEvaluations)
        .where(eq(tradeRuleEvaluations.complianceResultId, result.id));
      resultsWithEvaluations.push({ ...result, evaluations });
    }
    
    return resultsWithEvaluations;
  }

  async getComplianceScore(userId: string, strategyId: number, tradeCount: number = 10): Promise<{
    compliancePercent: number;
    violationsCount: number;
    trendDirection: 'improving' | 'declining' | 'stable';
    tradesEvaluated: number;
  }> {
    const results = await db.select().from(tradeComplianceResults)
      .where(and(
        eq(tradeComplianceResults.userId, userId),
        eq(tradeComplianceResults.strategyId, strategyId)
      ))
      .orderBy(desc(tradeComplianceResults.evaluatedAt))
      .limit(tradeCount);

    if (results.length === 0) {
      return {
        compliancePercent: 0,
        violationsCount: 0,
        trendDirection: 'stable',
        tradesEvaluated: 0
      };
    }

    const compliantCount = results.filter(r => r.overallCompliant).length;
    const violationsCount = results.length - compliantCount;
    const compliancePercent = Math.round((compliantCount / results.length) * 100);

    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    
    if (results.length >= 4) {
      const halfPoint = Math.floor(results.length / 2);
      const recentHalf = results.slice(0, halfPoint);
      const olderHalf = results.slice(halfPoint);
      
      const recentCompliance = recentHalf.filter(r => r.overallCompliant).length / recentHalf.length;
      const olderCompliance = olderHalf.filter(r => r.overallCompliant).length / olderHalf.length;
      
      const difference = recentCompliance - olderCompliance;
      if (difference > 0.1) {
        trendDirection = 'improving';
      } else if (difference < -0.1) {
        trendDirection = 'declining';
      }
    }

    return {
      compliancePercent,
      violationsCount,
      trendDirection,
      tradesEvaluated: results.length
    };
  }

  async getDetailedViolations(userId: string, strategyId: number, tradeCount: number = 20): Promise<{
    results: (TradeComplianceResult & { evaluations: TradeRuleEvaluation[] })[];
    violationsByRule: Record<string, { count: number; ruleLabel: string; reasons: string[] }>;
    patterns: {
      byTimeOfDay: Record<string, { total: number; violations: number }>;
      byDayOfWeek: Record<string, { total: number; violations: number }>;
      riskDrift: { recentViolationRate: number; olderViolationRate: number };
    };
  }> {
    const complianceResults = await db.select().from(tradeComplianceResults)
      .where(and(
        eq(tradeComplianceResults.userId, userId),
        eq(tradeComplianceResults.strategyId, strategyId)
      ))
      .orderBy(desc(tradeComplianceResults.evaluatedAt))
      .limit(tradeCount);

    const resultsWithEvaluations: (TradeComplianceResult & { evaluations: TradeRuleEvaluation[] })[] = [];
    const violationsByRule: Record<string, { count: number; ruleLabel: string; reasons: string[] }> = {};
    const byTimeOfDay: Record<string, { total: number; violations: number }> = {
      'Morning (6-12)': { total: 0, violations: 0 },
      'Afternoon (12-18)': { total: 0, violations: 0 },
      'Evening (18-24)': { total: 0, violations: 0 },
      'Night (0-6)': { total: 0, violations: 0 }
    };
    const byDayOfWeek: Record<string, { total: number; violations: number }> = {
      'Monday': { total: 0, violations: 0 },
      'Tuesday': { total: 0, violations: 0 },
      'Wednesday': { total: 0, violations: 0 },
      'Thursday': { total: 0, violations: 0 },
      'Friday': { total: 0, violations: 0 }
    };

    for (const result of complianceResults) {
      const evaluations = await db.select().from(tradeRuleEvaluations)
        .where(eq(tradeRuleEvaluations.complianceResultId, result.id));
      
      resultsWithEvaluations.push({ ...result, evaluations });
      
      // Analyze time patterns
      if (result.evaluatedAt) {
        const date = new Date(result.evaluatedAt);
        const hour = date.getHours();
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
        
        let timeSlot: string;
        if (hour >= 6 && hour < 12) timeSlot = 'Morning (6-12)';
        else if (hour >= 12 && hour < 18) timeSlot = 'Afternoon (12-18)';
        else if (hour >= 18 && hour < 24) timeSlot = 'Evening (18-24)';
        else timeSlot = 'Night (0-6)';
        
        byTimeOfDay[timeSlot].total++;
        if (!result.overallCompliant) byTimeOfDay[timeSlot].violations++;
        
        if (byDayOfWeek[dayOfWeek]) {
          byDayOfWeek[dayOfWeek].total++;
          if (!result.overallCompliant) byDayOfWeek[dayOfWeek].violations++;
        }
      }
      
      for (const evaluation of evaluations) {
        if (!evaluation.passed) {
          if (!violationsByRule[evaluation.ruleType]) {
            violationsByRule[evaluation.ruleType] = {
              count: 0,
              ruleLabel: evaluation.ruleLabel,
              reasons: []
            };
          }
          violationsByRule[evaluation.ruleType].count++;
          if (evaluation.violationReason && !violationsByRule[evaluation.ruleType].reasons.includes(evaluation.violationReason)) {
            violationsByRule[evaluation.ruleType].reasons.push(evaluation.violationReason);
          }
        }
      }
    }

    // Calculate risk drift (recent vs older violation rates)
    const halfPoint = Math.floor(resultsWithEvaluations.length / 2);
    const recentHalf = resultsWithEvaluations.slice(0, Math.max(1, halfPoint));
    const olderHalf = resultsWithEvaluations.slice(halfPoint);
    
    const recentViolationRate = recentHalf.length > 0 
      ? Math.round((recentHalf.filter(r => !r.overallCompliant).length / recentHalf.length) * 100) 
      : 0;
    const olderViolationRate = olderHalf.length > 0 
      ? Math.round((olderHalf.filter(r => !r.overallCompliant).length / olderHalf.length) * 100) 
      : 0;

    return { 
      results: resultsWithEvaluations, 
      violationsByRule,
      patterns: {
        byTimeOfDay,
        byDayOfWeek,
        riskDrift: { recentViolationRate, olderViolationRate }
      }
    };
  }
}

export const storage = new DatabaseStorage();
