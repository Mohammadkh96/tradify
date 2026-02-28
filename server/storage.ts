import { db } from "./db";
import {
  tradeJournal,
  mt5Data,
  mt5History,
  mt5Accounts,
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
  marketingBrandSettings,
  marketingContent,
  marketingCampaigns,
  marketingAdStrategies,
  marketingEmailSequences,
  type HubPost,
  type HubComment,
  type HubReport,
  type CreatorProfile,
  type CreatorApplication,
  type InsertTrade,
  type UpdateTradeRequest,
  type Trade,
  type MT5Data,
  type MT5Account,
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
  type InsertTradeRuleEvaluation,
  type MarketingBrandSettings,
  type InsertMarketingBrandSettings,
  type MarketingContent,
  type InsertMarketingContent,
  type MarketingCampaign,
  type InsertMarketingCampaign,
  type MarketingAdStrategy,
  type InsertMarketingAdStrategy,
  type MarketingEmailSequence,
  type InsertMarketingEmailSequence,
  aiUsageLogs,
  manualCosts,
  costBudgetAlerts,
  type AiUsageLog,
  type InsertAiUsageLog,
  type ManualCost,
  type InsertManualCost,
  type CostBudgetAlert,
  type InsertCostBudgetAlert
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or, gte, lte, between } from "drizzle-orm";

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
    mt5AccountId?: string;
  }): Promise<MT5Data>;
  syncMT5History(userId: string, trades: any[]): Promise<void>;
  getMT5History(userId: string, from?: Date, to?: Date): Promise<any[]>;
  getMT5HistoryByAccount(userId: string, accountNumber: string): Promise<any[]>;
  getDailySnapshots(userId: string): Promise<any[]>;
  getDailySnapshotsByAccount(userId: string, accountNumber: string): Promise<any[]>;
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
  // Admin User Management
  getAllUsers(): Promise<any[]>;
  createUserRole(role: any): Promise<any>;
  updateUserRole(userId: string, updates: any): Promise<any>;
  deleteUser(userId: string): Promise<void>;
  // MT5 Account Management
  getMT5Accounts(userId: string): Promise<any[]>;
  getMT5Account(userId: string, accountNumber: string): Promise<any | undefined>;
  getActiveMT5Account(userId: string): Promise<any | undefined>;
  createMT5Account(account: { userId: string; accountNumber: string; accountName?: string; broker?: string; server?: string; currency?: string }): Promise<any>;
  updateMT5Account(userId: string, accountNumber: string, updates: any): Promise<any>;
  setActiveMT5Account(userId: string, accountNumber: string): Promise<void>;
  getMT5HistoryByAccount(userId: string, accountNumber: string): Promise<any[]>;
  syncMT5HistoryWithAccount(userId: string, accountNumber: string, trades: any[]): Promise<void>;
  // Marketing Hub Methods
  getMarketingBrandSettings(userId: string): Promise<MarketingBrandSettings | undefined>;
  upsertMarketingBrandSettings(settings: InsertMarketingBrandSettings): Promise<MarketingBrandSettings>;
  createMarketingContent(content: InsertMarketingContent): Promise<MarketingContent>;
  listMarketingContent(filters?: { type?: string; platform?: string; campaignId?: number; status?: string; search?: string }): Promise<MarketingContent[]>;
  getMarketingContent(id: number): Promise<MarketingContent | undefined>;
  updateMarketingContent(id: number, updates: Partial<InsertMarketingContent>): Promise<MarketingContent>;
  deleteMarketingContent(id: number): Promise<void>;
  searchMarketingContent(query: string): Promise<MarketingContent[]>;
  getRecentMarketingContentByType(type: string, limit?: number): Promise<MarketingContent[]>;
  createMarketingCampaign(campaign: InsertMarketingCampaign): Promise<MarketingCampaign>;
  listMarketingCampaigns(): Promise<MarketingCampaign[]>;
  getMarketingCampaign(id: number): Promise<MarketingCampaign | undefined>;
  updateMarketingCampaign(id: number, updates: Partial<InsertMarketingCampaign>): Promise<MarketingCampaign>;
  deleteMarketingCampaign(id: number): Promise<void>;
  createMarketingAdStrategy(strategy: InsertMarketingAdStrategy): Promise<MarketingAdStrategy>;
  listMarketingAdStrategies(campaignId?: number): Promise<MarketingAdStrategy[]>;
  getMarketingAdStrategy(id: number): Promise<MarketingAdStrategy | undefined>;
  updateMarketingAdStrategy(id: number, updates: Partial<InsertMarketingAdStrategy>): Promise<MarketingAdStrategy>;
  deleteMarketingAdStrategy(id: number): Promise<void>;
  createMarketingEmailSequence(sequence: InsertMarketingEmailSequence): Promise<MarketingEmailSequence>;
  listMarketingEmailSequences(campaignId?: number): Promise<MarketingEmailSequence[]>;
  getMarketingEmailSequence(id: number): Promise<MarketingEmailSequence | undefined>;
  updateMarketingEmailSequence(id: number, updates: Partial<InsertMarketingEmailSequence>): Promise<MarketingEmailSequence>;
  deleteMarketingEmailSequence(id: number): Promise<void>;
  // AI Usage Logs
  createAiUsageLog(log: InsertAiUsageLog): Promise<AiUsageLog>;
  getAiUsageLogsByDateRange(from: Date, to: Date): Promise<AiUsageLog[]>;
  getAiUsageLogsByUser(userId: string): Promise<AiUsageLog[]>;
  aggregateAiUsageByTier(from?: Date, to?: Date, userId?: string): Promise<{ userTier: string; totalCost: string; count: number }[]>;
  aggregateAiUsageByFeature(from?: Date, to?: Date, userId?: string): Promise<{ feature: string; totalCost: string; count: number }[]>;
  aggregateAiUsageByModel(from?: Date, to?: Date, userId?: string): Promise<{ model: string; totalCost: string; count: number }[]>;
  getAiUsageDailyTotals(days: number, from?: Date, to?: Date, userId?: string): Promise<{ date: string; totalCost: string; count: number }[]>;
  getAiUsageTopUsers(limit: number, from?: Date, to?: Date): Promise<{ userId: string; userTier: string; totalCost: string; count: number }[]>;
  searchAiUsageLogs(filters: {
    userId?: string;
    userTier?: string;
    feature?: string;
    model?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: AiUsageLog[]; total: number; page: number; totalPages: number }>;
  getAiUsageByUser(userId: string, dateFrom?: Date, dateTo?: Date): Promise<{
    totalCost: string;
    requestCount: number;
    byFeature: { feature: string; totalCost: string; count: number }[];
    byModel: { model: string; totalCost: string; count: number }[];
    dailyTrend: { date: string; totalCost: string; count: number }[];
    recentLogs: AiUsageLog[];
  }>;
  // Manual Costs
  createManualCost(cost: InsertManualCost): Promise<ManualCost>;
  listManualCosts(): Promise<ManualCost[]>;
  updateManualCost(id: number, updates: Partial<InsertManualCost>): Promise<ManualCost>;
  deleteManualCost(id: number): Promise<void>;
  // Budget Alerts
  getCostBudgetAlert(): Promise<CostBudgetAlert | undefined>;
  upsertCostBudgetAlert(alert: InsertCostBudgetAlert): Promise<CostBudgetAlert>;
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

  async getAllUsers(): Promise<any[]> {
    const users = await db.select().from(userRole).orderBy(userRole.createdAt);
    return users;
  }

  async updateUserRole(userId: string, updates: any): Promise<any> {
    const [updated] = await db.update(userRole)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userRole.userId, userId))
      .returning();
    return updated;
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(userRole).where(eq(userRole.userId, userId));
  }

  async updateUserSubscriptionInfo(userId: string, info: {
    subscriptionStatus?: string;
    subscriptionTier?: string;
    subscriptionProvider?: string;
    currentPlan?: string;
    renewalDate?: Date;
    paypalSubscriptionId?: string;
    syncToken?: string;
    billingPeriod?: string;
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
    mt5AccountId?: string;
  }): Promise<MT5Data> {
    const [existing] = await db.select().from(mt5Data).where(eq(mt5Data.userId, data.userId)).limit(1);
    
    const now = new Date();
    const values = {
      userId: data.userId,
      mt5AccountId: data.mt5AccountId || "default",
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

    // Update Daily Snapshot (with account ID for separation)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Use UTC for consistency
    const accountId = data.mt5AccountId || "default";
    const [existingSnapshot] = await db.select().from(dailyEquitySnapshots)
      .where(and(
        eq(dailyEquitySnapshots.userId, data.userId), 
        eq(dailyEquitySnapshots.date, today),
        eq(dailyEquitySnapshots.mt5AccountId, accountId)
      ))
      .limit(1);

    if (existingSnapshot) {
      await db.update(dailyEquitySnapshots)
        .set({ equity: values.equity, balance: values.balance })
        .where(eq(dailyEquitySnapshots.id, existingSnapshot.id));
    } else {
      await db.insert(dailyEquitySnapshots).values({
        userId: data.userId,
        mt5AccountId: accountId,
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
          
          const ep = parseFloat(trade.price?.toString() || "0");
          let oldDirection: string;
          if (trade.direction && typeof trade.direction === "string") {
            oldDirection = trade.direction.toLowerCase().includes("sell") || trade.direction.toLowerCase().includes("short") ? "Sell" : "Buy";
          } else {
            oldDirection = (trade.type === 1 || trade.type === "Sell" || trade.type === "DEAL_TYPE_SELL") ? "Sell" : "Buy";
          }
          
          await db.insert(mt5History).values({
            userId,
            ticket: ticketStr,
            symbol: trade.symbol,
            direction: oldDirection,
            volume: String(trade.volume || 0),
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
    const rows = await db.select().from(mt5History)
      .where(eq(mt5History.userId, userId))
      .orderBy(desc(mt5History.closeTime), desc(mt5History.id));
    const seen = new Map<string, any>();
    for (const r of rows) {
      if (!seen.has(r.ticket)) {
        seen.set(r.ticket, r);
      }
    }
    return Array.from(seen.values()).sort((a, b) => 
      new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime()
    );
  }

  async getDailySnapshots(userId: string): Promise<any[]> {
    return await db.select().from(dailyEquitySnapshots).where(eq(dailyEquitySnapshots.userId, userId)).orderBy(dailyEquitySnapshots.date);
  }

  async getDailySnapshotsByAccount(userId: string, accountNumber: string): Promise<any[]> {
    return await db.select().from(dailyEquitySnapshots)
      .where(and(eq(dailyEquitySnapshots.userId, userId), eq(dailyEquitySnapshots.mt5AccountId, accountNumber)))
      .orderBy(dailyEquitySnapshots.date);
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

  // MT5 Account Management Methods
  async getMT5Accounts(userId: string): Promise<any[]> {
    return await db.select().from(mt5Accounts)
      .where(eq(mt5Accounts.userId, userId))
      .orderBy(desc(mt5Accounts.lastSyncAt));
  }

  async getMT5Account(userId: string, accountNumber: string): Promise<any | undefined> {
    const [account] = await db.select().from(mt5Accounts)
      .where(and(eq(mt5Accounts.userId, userId), eq(mt5Accounts.accountNumber, accountNumber)))
      .limit(1);
    return account;
  }

  async getActiveMT5Account(userId: string): Promise<any | undefined> {
    const [account] = await db.select().from(mt5Accounts)
      .where(and(eq(mt5Accounts.userId, userId), eq(mt5Accounts.isActive, true)))
      .limit(1);
    return account;
  }

  async createMT5Account(account: { userId: string; accountNumber: string; accountName?: string; broker?: string; server?: string; currency?: string }): Promise<any> {
    // First, check if account already exists
    const existing = await this.getMT5Account(account.userId, account.accountNumber);
    if (existing) {
      // Update last sync time
      await db.update(mt5Accounts)
        .set({ lastSyncAt: new Date() })
        .where(and(eq(mt5Accounts.userId, account.userId), eq(mt5Accounts.accountNumber, account.accountNumber)));
      return existing;
    }
    
    // Create new account
    const [newAccount] = await db.insert(mt5Accounts).values({
      userId: account.userId,
      accountNumber: account.accountNumber,
      accountName: account.accountName || `Account ${account.accountNumber}`,
      broker: account.broker,
      server: account.server,
      currency: account.currency || "USD",
      isActive: true, // New accounts are active by default
      lastSyncAt: new Date(),
    }).returning();
    
    // Deactivate other accounts for this user
    await db.update(mt5Accounts)
      .set({ isActive: false })
      .where(and(
        eq(mt5Accounts.userId, account.userId),
        sql`${mt5Accounts.accountNumber} != ${account.accountNumber}`
      ));
    
    return newAccount;
  }

  async updateMT5Account(userId: string, accountNumber: string, updates: any): Promise<any> {
    const [updated] = await db.update(mt5Accounts)
      .set(updates)
      .where(and(eq(mt5Accounts.userId, userId), eq(mt5Accounts.accountNumber, accountNumber)))
      .returning();
    return updated;
  }

  async setActiveMT5Account(userId: string, accountNumber: string): Promise<void> {
    // First deactivate all accounts for this user
    await db.update(mt5Accounts)
      .set({ isActive: false })
      .where(eq(mt5Accounts.userId, userId));
    
    // Then activate the selected account
    await db.update(mt5Accounts)
      .set({ isActive: true })
      .where(and(eq(mt5Accounts.userId, userId), eq(mt5Accounts.accountNumber, accountNumber)));
  }

  async getMT5HistoryByAccount(userId: string, accountNumber: string): Promise<any[]> {
    const rows = await db.select().from(mt5History)
      .where(and(eq(mt5History.userId, userId), eq(mt5History.mt5AccountId, accountNumber)))
      .orderBy(desc(mt5History.closeTime), desc(mt5History.id));
    const seen = new Map<string, any>();
    for (const r of rows) {
      if (!seen.has(r.ticket)) {
        seen.set(r.ticket, r);
      }
    }
    return Array.from(seen.values()).sort((a, b) => 
      new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime()
    );
  }

  async syncMT5HistoryWithAccount(userId: string, accountNumber: string, trades: any[]): Promise<void> {
    console.log(`[MT5 Sync] Syncing history for ${userId} account ${accountNumber}. Count: ${trades.length}`);
    if (trades.length > 0) {
      console.log(`[MT5 Sync] Sample trade fields:`, JSON.stringify(Object.keys(trades[0])));
      console.log(`[MT5 Sync] Sample trade data:`, JSON.stringify(trades[0]));
    }

    const existingRows = await db.select({
      id: mt5History.id,
      ticket: mt5History.ticket,
      direction: mt5History.direction,
      entryPrice: mt5History.entryPrice,
      exitPrice: mt5History.exitPrice,
      openTime: mt5History.openTime,
      closeTime: mt5History.closeTime,
      duration: mt5History.duration,
    }).from(mt5History)
      .where(and(eq(mt5History.userId, userId), eq(mt5History.mt5AccountId, accountNumber)));
    
    const existingMap = new Map<string, typeof existingRows[0]>();
    for (const row of existingRows) {
      existingMap.set(row.ticket, row);
    }

    let inserted = 0;
    let updated = 0;

    for (const trade of trades) {
      try {
        if (!trade || !trade.ticket || !trade.symbol) {
          console.warn(`[MT5 Sync] Skipping invalid trade (missing ticket/symbol):`, JSON.stringify(trade));
          continue;
        }
        const ticketStr = String(trade.ticket);
        const existing = existingMap.get(ticketStr);

        const rawOpenTime = trade.open_time || trade.openTime || trade.time;
        const rawCloseTime = trade.close_time || trade.closeTime || trade.time;
        if (!rawOpenTime || !rawCloseTime) {
          console.warn(`[MT5 Sync] Skipping trade #${ticketStr} — missing timestamps`);
          continue;
        }
        const openTime = typeof rawOpenTime === 'number' ? new Date(rawOpenTime * 1000) : new Date(rawOpenTime);
        const closeTime = typeof rawCloseTime === 'number' ? new Date(rawCloseTime * 1000) : new Date(rawCloseTime);
        
        if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) {
          console.warn(`[MT5 Sync] Skipping trade #${ticketStr} — invalid timestamps`);
          continue;
        }
        
        const entryPrice = (trade.open_price || trade.entry_price || trade.price_open || trade.price || 0).toString();
        const exitPrice = (trade.close_price || trade.exit_price || trade.price_close || trade.price || 0).toString();
        
        const durationSecs = typeof rawCloseTime === 'number' && typeof rawOpenTime === 'number'
          ? rawCloseTime - rawOpenTime
          : Math.floor((closeTime.getTime() - openTime.getTime()) / 1000);
        
        const commission = parseFloat(trade.commission || 0);
        const swap = parseFloat(trade.swap || 0);
        const profit = parseFloat(trade.profit || 0);
        if (isNaN(commission) || isNaN(swap) || isNaN(profit)) {
          console.warn(`[MT5 Sync] Skipping trade #${ticketStr} — invalid numeric values`);
          continue;
        }
        const netPlNum = profit + commission + swap;
        const netPl = netPlNum.toFixed(2);

        const entryNum = parseFloat(entryPrice);
        const exitNum = parseFloat(exitPrice);
        const priceDiff = exitNum - entryNum;

        let direction: string;
        if (Math.abs(priceDiff) > 0.000001 && Math.abs(profit) > 0.001) {
          direction = (priceDiff > 0 && profit > 0) || (priceDiff < 0 && profit < 0) ? "Buy" : "Sell";
        } else if (trade.direction && typeof trade.direction === "string") {
          direction = trade.direction.toLowerCase().includes("sell") || trade.direction.toLowerCase().includes("short") ? "Sell" : "Buy";
        } else {
          direction = (trade.type === 1 || trade.type === "Sell" || trade.type === "DEAL_TYPE_SELL") ? "Sell" : "Buy";
        }

        if (!existing) {
          await db.insert(mt5History).values({
            userId,
            mt5AccountId: accountNumber,
            ticket: ticketStr,
            symbol: trade.symbol,
            direction,
            volume: String(trade.volume || 0),
            entryPrice,
            exitPrice,
            sl: trade.sl?.toString(),
            tp: trade.tp?.toString(),
            openTime,
            closeTime,
            duration: durationSecs,
            grossPl: profit.toString(),
            commission: commission.toString(),
            swap: swap.toString(),
            netPl,
          }).onConflictDoNothing();
          inserted++;
        } else {
          const directionWrong = existing.direction !== direction;
          const needsUpdate = directionWrong
            || existing.entryPrice === existing.exitPrice && entryPrice !== exitPrice
            || (existing.duration === 0 || existing.duration === null) && durationSecs > 0
            || existing.openTime?.getTime() === existing.closeTime?.getTime() && openTime.getTime() !== closeTime.getTime();
          
          if (needsUpdate) {
            await db.update(mt5History)
              .set({
                direction,
                entryPrice,
                exitPrice,
                openTime,
                closeTime,
                duration: durationSecs,
              })
              .where(eq(mt5History.id, existing.id));
            updated++;
          }
        }
      } catch (err) {
        console.error(`[MT5 Sync] Error syncing trade ${trade.ticket}:`, err);
      }
    }
    if (inserted > 0 || updated > 0) {
      console.log(`[MT5 Sync] Completed: ${inserted} inserted, ${updated} updated out of ${trades.length} trades`);
    }
  }

  // ==================== MARKETING HUB METHODS ====================

  async getMarketingBrandSettings(userId: string): Promise<MarketingBrandSettings | undefined> {
    const [settings] = await db.select().from(marketingBrandSettings)
      .where(eq(marketingBrandSettings.userId, userId))
      .limit(1);
    return settings;
  }

  async upsertMarketingBrandSettings(settings: InsertMarketingBrandSettings): Promise<MarketingBrandSettings> {
    const [existing] = await db.select().from(marketingBrandSettings)
      .where(eq(marketingBrandSettings.userId, settings.userId))
      .limit(1);

    if (existing) {
      const [updated] = await db.update(marketingBrandSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(marketingBrandSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(marketingBrandSettings).values(settings).returning();
    return created;
  }

  async createMarketingContent(content: InsertMarketingContent): Promise<MarketingContent> {
    const [created] = await db.insert(marketingContent).values(content).returning();
    return created;
  }

  async listMarketingContent(filters?: { type?: string; platform?: string; campaignId?: number; status?: string; search?: string }): Promise<MarketingContent[]> {
    const conditions: any[] = [];

    if (filters?.type) {
      conditions.push(eq(marketingContent.type, filters.type));
    }
    if (filters?.platform) {
      conditions.push(eq(marketingContent.platform, filters.platform));
    }
    if (filters?.campaignId) {
      conditions.push(eq(marketingContent.campaignId, filters.campaignId));
    }
    if (filters?.status) {
      conditions.push(eq(marketingContent.status, filters.status));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(marketingContent.content, `%${filters.search}%`),
          ilike(marketingContent.title, `%${filters.search}%`),
          ilike(marketingContent.hook, `%${filters.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      return db.select().from(marketingContent)
        .where(and(...conditions))
        .orderBy(desc(marketingContent.createdAt));
    }
    return db.select().from(marketingContent).orderBy(desc(marketingContent.createdAt));
  }

  async getMarketingContent(id: number): Promise<MarketingContent | undefined> {
    const [content] = await db.select().from(marketingContent)
      .where(eq(marketingContent.id, id))
      .limit(1);
    return content;
  }

  async updateMarketingContent(id: number, updates: Partial<InsertMarketingContent>): Promise<MarketingContent> {
    const [updated] = await db.update(marketingContent)
      .set(updates)
      .where(eq(marketingContent.id, id))
      .returning();
    return updated;
  }

  async deleteMarketingContent(id: number): Promise<void> {
    await db.delete(marketingContent).where(eq(marketingContent.id, id));
  }

  async searchMarketingContent(query: string): Promise<MarketingContent[]> {
    return db.select().from(marketingContent)
      .where(
        or(
          ilike(marketingContent.content, `%${query}%`),
          ilike(marketingContent.title, `%${query}%`),
          ilike(marketingContent.hook, `%${query}%`)
        )
      )
      .orderBy(desc(marketingContent.createdAt));
  }

  async getRecentMarketingContentByType(type: string, limit: number = 20): Promise<MarketingContent[]> {
    return db.select().from(marketingContent)
      .where(eq(marketingContent.type, type))
      .orderBy(desc(marketingContent.createdAt))
      .limit(limit);
  }

  async createMarketingCampaign(campaign: InsertMarketingCampaign): Promise<MarketingCampaign> {
    const [created] = await db.insert(marketingCampaigns).values(campaign).returning();
    return created;
  }

  async listMarketingCampaigns(): Promise<MarketingCampaign[]> {
    return db.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.createdAt));
  }

  async getMarketingCampaign(id: number): Promise<MarketingCampaign | undefined> {
    const [campaign] = await db.select().from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, id))
      .limit(1);
    return campaign;
  }

  async updateMarketingCampaign(id: number, updates: Partial<InsertMarketingCampaign>): Promise<MarketingCampaign> {
    const [updated] = await db.update(marketingCampaigns)
      .set(updates)
      .where(eq(marketingCampaigns.id, id))
      .returning();
    return updated;
  }

  async deleteMarketingCampaign(id: number): Promise<void> {
    await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
  }

  async createMarketingAdStrategy(strategy: InsertMarketingAdStrategy): Promise<MarketingAdStrategy> {
    const [created] = await db.insert(marketingAdStrategies).values(strategy).returning();
    return created;
  }

  async listMarketingAdStrategies(campaignId?: number): Promise<MarketingAdStrategy[]> {
    if (campaignId) {
      return db.select().from(marketingAdStrategies)
        .where(eq(marketingAdStrategies.campaignId, campaignId))
        .orderBy(desc(marketingAdStrategies.createdAt));
    }
    return db.select().from(marketingAdStrategies).orderBy(desc(marketingAdStrategies.createdAt));
  }

  async getMarketingAdStrategy(id: number): Promise<MarketingAdStrategy | undefined> {
    const [strategy] = await db.select().from(marketingAdStrategies)
      .where(eq(marketingAdStrategies.id, id))
      .limit(1);
    return strategy;
  }

  async updateMarketingAdStrategy(id: number, updates: Partial<InsertMarketingAdStrategy>): Promise<MarketingAdStrategy> {
    const [updated] = await db.update(marketingAdStrategies)
      .set(updates)
      .where(eq(marketingAdStrategies.id, id))
      .returning();
    return updated;
  }

  async deleteMarketingAdStrategy(id: number): Promise<void> {
    await db.delete(marketingAdStrategies).where(eq(marketingAdStrategies.id, id));
  }

  async createMarketingEmailSequence(sequence: InsertMarketingEmailSequence): Promise<MarketingEmailSequence> {
    const [created] = await db.insert(marketingEmailSequences).values(sequence).returning();
    return created;
  }

  async listMarketingEmailSequences(campaignId?: number): Promise<MarketingEmailSequence[]> {
    if (campaignId) {
      return db.select().from(marketingEmailSequences)
        .where(eq(marketingEmailSequences.campaignId, campaignId))
        .orderBy(desc(marketingEmailSequences.createdAt));
    }
    return db.select().from(marketingEmailSequences).orderBy(desc(marketingEmailSequences.createdAt));
  }

  async getMarketingEmailSequence(id: number): Promise<MarketingEmailSequence | undefined> {
    const [sequence] = await db.select().from(marketingEmailSequences)
      .where(eq(marketingEmailSequences.id, id))
      .limit(1);
    return sequence;
  }

  async updateMarketingEmailSequence(id: number, updates: Partial<InsertMarketingEmailSequence>): Promise<MarketingEmailSequence> {
    const [updated] = await db.update(marketingEmailSequences)
      .set(updates)
      .where(eq(marketingEmailSequences.id, id))
      .returning();
    return updated;
  }

  async deleteMarketingEmailSequence(id: number): Promise<void> {
    await db.delete(marketingEmailSequences).where(eq(marketingEmailSequences.id, id));
  }

  // ==================== AI USAGE & COST TRACKING METHODS ====================

  async createAiUsageLog(log: InsertAiUsageLog): Promise<AiUsageLog> {
    const [created] = await db.insert(aiUsageLogs).values(log).returning();
    return created;
  }

  async getAiUsageLogsByDateRange(from: Date, to: Date): Promise<AiUsageLog[]> {
    return db.select().from(aiUsageLogs)
      .where(and(gte(aiUsageLogs.createdAt, from), lte(aiUsageLogs.createdAt, to)))
      .orderBy(desc(aiUsageLogs.createdAt));
  }

  async getAiUsageLogsByUser(userId: string): Promise<AiUsageLog[]> {
    return db.select().from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, userId))
      .orderBy(desc(aiUsageLogs.createdAt));
  }

  async aggregateAiUsageByTier(from?: Date, to?: Date, userId?: string): Promise<{ userTier: string; totalCost: string; count: number }[]> {
    const conditions: any[] = [];
    if (from) conditions.push(gte(aiUsageLogs.createdAt, from));
    if (to) conditions.push(lte(aiUsageLogs.createdAt, to));
    if (userId) conditions.push(ilike(aiUsageLogs.userId, `%${userId}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db.select({
      userTier: aiUsageLogs.userTier,
      totalCost: sql<string>`COALESCE(SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)), 0)::TEXT`,
      count: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs)
      .where(whereClause)
      .groupBy(aiUsageLogs.userTier);

    return result;
  }

  async aggregateAiUsageByFeature(from?: Date, to?: Date, userId?: string): Promise<{ feature: string; totalCost: string; count: number }[]> {
    const conditions: any[] = [];
    if (from) conditions.push(gte(aiUsageLogs.createdAt, from));
    if (to) conditions.push(lte(aiUsageLogs.createdAt, to));
    if (userId) conditions.push(ilike(aiUsageLogs.userId, `%${userId}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db.select({
      feature: aiUsageLogs.feature,
      totalCost: sql<string>`COALESCE(SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)), 0)::TEXT`,
      count: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs)
      .where(whereClause)
      .groupBy(aiUsageLogs.feature);

    return result;
  }

  async aggregateAiUsageByModel(from?: Date, to?: Date, userId?: string): Promise<{ model: string; totalCost: string; count: number }[]> {
    const conditions: any[] = [];
    if (from) conditions.push(gte(aiUsageLogs.createdAt, from));
    if (to) conditions.push(lte(aiUsageLogs.createdAt, to));
    if (userId) conditions.push(ilike(aiUsageLogs.userId, `%${userId}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db.select({
      model: aiUsageLogs.model,
      totalCost: sql<string>`COALESCE(SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)), 0)::TEXT`,
      count: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs)
      .where(whereClause)
      .groupBy(aiUsageLogs.model);

    return result;
  }

  async getAiUsageDailyTotals(days: number, from?: Date, to?: Date, userId?: string): Promise<{ date: string; totalCost: string; count: number }[]> {
    const conditions: any[] = [];
    if (from) {
      conditions.push(gte(aiUsageLogs.createdAt, from));
    } else {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      conditions.push(gte(aiUsageLogs.createdAt, fromDate));
    }
    if (to) conditions.push(lte(aiUsageLogs.createdAt, to));
    if (userId) conditions.push(ilike(aiUsageLogs.userId, `%${userId}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db.select({
      date: sql<string>`DATE(${aiUsageLogs.createdAt})::TEXT`,
      totalCost: sql<string>`COALESCE(SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)), 0)::TEXT`,
      count: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs)
      .where(whereClause)
      .groupBy(sql`DATE(${aiUsageLogs.createdAt})`)
      .orderBy(sql`DATE(${aiUsageLogs.createdAt})`);

    return result;
  }

  async getAiUsageTopUsers(limit: number, from?: Date, to?: Date): Promise<{ userId: string; userTier: string; totalCost: string; count: number }[]> {
    const conditions: any[] = [];
    if (from) conditions.push(gte(aiUsageLogs.createdAt, from));
    if (to) conditions.push(lte(aiUsageLogs.createdAt, to));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db.select({
      userId: aiUsageLogs.userId,
      userTier: sql<string>`MAX(${aiUsageLogs.userTier})`,
      totalCost: sql<string>`COALESCE(SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)), 0)::TEXT`,
      count: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs)
      .where(whereClause)
      .groupBy(aiUsageLogs.userId)
      .orderBy(sql`SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)) DESC`)
      .limit(limit);

    return result;
  }

  async searchAiUsageLogs(filters: {
    userId?: string;
    userTier?: string;
    feature?: string;
    model?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: AiUsageLog[]; total: number; page: number; totalPages: number }> {
    const conditions: any[] = [];
    if (filters.userId) conditions.push(ilike(aiUsageLogs.userId, `%${filters.userId}%`));
    if (filters.userTier) conditions.push(eq(aiUsageLogs.userTier, filters.userTier));
    if (filters.feature) conditions.push(eq(aiUsageLogs.feature, filters.feature));
    if (filters.model) conditions.push(eq(aiUsageLogs.model, filters.model));
    if (filters.dateFrom) conditions.push(gte(aiUsageLogs.createdAt, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(aiUsageLogs.createdAt, filters.dateTo));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const offset = (page - 1) * limit;

    const sortExpr = filters.sortBy === 'cost' ? sql`CAST(${aiUsageLogs.costUsd} AS NUMERIC)`
      : filters.sortBy === 'tokens' ? sql`COALESCE(${aiUsageLogs.totalTokens}, 0)`
      : filters.sortBy === 'duration' ? sql`COALESCE(${aiUsageLogs.requestDuration}, 0)`
      : filters.sortBy === 'user' ? sql`${aiUsageLogs.userId}`
      : filters.sortBy === 'feature' ? sql`${aiUsageLogs.feature}`
      : filters.sortBy === 'model' ? sql`${aiUsageLogs.model}`
      : sql`${aiUsageLogs.createdAt}`;

    const [countResult] = await db.select({
      count: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs).where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const logs = await db.select().from(aiUsageLogs)
      .where(whereClause)
      .orderBy(filters.sortOrder === 'asc' ? sql`${sortExpr} ASC` : sql`${sortExpr} DESC`)
      .limit(limit)
      .offset(offset);

    return { logs, total, page, totalPages };
  }

  async getAiUsageByUser(userId: string, dateFrom?: Date, dateTo?: Date): Promise<{
    totalCost: string;
    requestCount: number;
    byFeature: { feature: string; totalCost: string; count: number }[];
    byModel: { model: string; totalCost: string; count: number }[];
    dailyTrend: { date: string; totalCost: string; count: number }[];
    recentLogs: AiUsageLog[];
  }> {
    const conditions: any[] = [eq(aiUsageLogs.userId, userId)];
    if (dateFrom) conditions.push(gte(aiUsageLogs.createdAt, dateFrom));
    if (dateTo) conditions.push(lte(aiUsageLogs.createdAt, dateTo));

    const whereClause = and(...conditions);

    const [totals] = await db.select({
      totalCost: sql<string>`COALESCE(SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)), 0)::TEXT`,
      requestCount: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs).where(whereClause);

    const byFeature = await db.select({
      feature: aiUsageLogs.feature,
      totalCost: sql<string>`COALESCE(SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)), 0)::TEXT`,
      count: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs)
      .where(whereClause)
      .groupBy(aiUsageLogs.feature)
      .orderBy(sql`SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)) DESC`);

    const byModel = await db.select({
      model: aiUsageLogs.model,
      totalCost: sql<string>`COALESCE(SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)), 0)::TEXT`,
      count: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs)
      .where(whereClause)
      .groupBy(aiUsageLogs.model)
      .orderBy(sql`SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)) DESC`);

    const dailyTrend = await db.select({
      date: sql<string>`DATE(${aiUsageLogs.createdAt})::TEXT`,
      totalCost: sql<string>`COALESCE(SUM(CAST(${aiUsageLogs.costUsd} AS NUMERIC)), 0)::TEXT`,
      count: sql<number>`COUNT(*)::INTEGER`,
    }).from(aiUsageLogs)
      .where(whereClause)
      .groupBy(sql`DATE(${aiUsageLogs.createdAt})`)
      .orderBy(sql`DATE(${aiUsageLogs.createdAt})`);

    const recentLogs = await db.select().from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, userId))
      .orderBy(desc(aiUsageLogs.createdAt))
      .limit(50);

    return {
      totalCost: totals?.totalCost || "0",
      requestCount: totals?.requestCount || 0,
      byFeature,
      byModel,
      dailyTrend,
      recentLogs,
    };
  }

  // ==================== MANUAL COSTS METHODS ====================

  async createManualCost(cost: InsertManualCost): Promise<ManualCost> {
    const [created] = await db.insert(manualCosts).values(cost).returning();
    return created;
  }

  async listManualCosts(): Promise<ManualCost[]> {
    return db.select().from(manualCosts).orderBy(desc(manualCosts.createdAt));
  }

  async updateManualCost(id: number, updates: Partial<InsertManualCost>): Promise<ManualCost> {
    const [updated] = await db.update(manualCosts)
      .set(updates)
      .where(eq(manualCosts.id, id))
      .returning();
    return updated;
  }

  async deleteManualCost(id: number): Promise<void> {
    await db.delete(manualCosts).where(eq(manualCosts.id, id));
  }

  // ==================== BUDGET ALERTS METHODS ====================

  async getCostBudgetAlert(): Promise<CostBudgetAlert | undefined> {
    const [alert] = await db.select().from(costBudgetAlerts)
      .orderBy(desc(costBudgetAlerts.createdAt))
      .limit(1);
    return alert;
  }

  async upsertCostBudgetAlert(alert: InsertCostBudgetAlert): Promise<CostBudgetAlert> {
    const existing = await this.getCostBudgetAlert();
    if (existing) {
      const [updated] = await db.update(costBudgetAlerts)
        .set(alert)
        .where(eq(costBudgetAlerts.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(costBudgetAlerts).values(alert).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
