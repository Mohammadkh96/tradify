import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import tradersHubRouter from "./traders-hub";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, or, desc, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { emailService } from "./emailService";
import { openai } from "./replit_integrations/audio/index";
import { isPaidTier, getMaxStrategies, canAccessFeature, getHistoryDays } from "@shared/plans";

const PostgresStore = connectPg(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: string;
  }
}

// Helper function to get date cutoff based on subscription tier
function getTierDateCutoff(historyDays: number): Date | null {
  // -1 means unlimited (Elite)
  if (historyDays === -1) {
    return null; // No cutoff, return all data
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - historyDays);
  return cutoff;
}

// Filter trades by tier date limits (returns filtered array)
function filterByTierDate<T extends { closeTime?: Date | string | null; createdAt?: Date | string | null }>(
  items: T[],
  historyDays: number
): T[] {
  const cutoff = getTierDateCutoff(historyDays);
  if (!cutoff) return items; // Unlimited access
  
  return items.filter(item => {
    const itemDate = item.closeTime ? new Date(item.closeTime) : 
                     item.createdAt ? new Date(item.createdAt) : null;
    return itemDate && itemDate >= cutoff;
  });
}

// Authentication middleware
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Session expired. Please log in." });
  }
  next();
};

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Session expired" });
  }
  
  const user = await storage.getUserRole(req.session.userId);
  if (user?.role !== "OWNER" && user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "./paypal";
import { paypalService } from "./paypalService";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session setup
  app.use(session({
    store: new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "tradify_secret_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax"
    }
  }));

  // Add body parser limits for MT5 payloads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  
  // Registration Endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const { email, password, country, phoneNumber, timezone } = req.body;
      
      if (!email || !password || !country || !timezone) {
        return res.status(400).json({ message: "Required fields missing" });
      }

      const normalizedEmail = email.toLowerCase();
      const [existing] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, normalizedEmail)).limit(1);
      
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [newUser] = await db.insert(schema.userRole).values({
        userId: normalizedEmail,
        password: hashedPassword,
        role: "TRADER",
        country,
        phoneNumber: phoneNumber || null,
        timezone,
        subscriptionTier: "FREE",
      }).returning();

      req.session.userId = newUser.userId;
      req.session.role = newUser.role;

      // Send signup email
      await emailService.sendTransactionalEmail(newUser.userId, "signup", {});

      res.status(201).json(newUser);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login Endpoint
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.toLowerCase();
      
      const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, normalizedEmail)).limit(1);
      
      if (!user || user.role === "DEACTIVATED") {
        return res.status(401).json({ message: "Account disabled or not found" });
      }

      if (!user.password || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.userId = user.userId;
      req.session.role = user.role;

      res.json(user);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserRole(req.session.userId);
    res.json(user);
  });

  app.get("/api/paypal/setup", requireAuth, async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  app.post("/api/paypal/order", requireAuth, async (req, res) => {
    await createPaypalOrder(req, res);
  });

  app.post("/api/paypal/order/:orderID/capture", requireAuth, async (req, res) => {
    // Store the original json function to intercept the response
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      // If capture was successful (status COMPLETED), upgrade the user
      if (data && data.status === 'COMPLETED') {
        const userId = req.session.userId!;
        storage.updateUserSubscriptionInfo(userId, {
          subscriptionTier: 'PRO',
          subscriptionProvider: 'paypal',
          paypalSubscriptionId: data.id || null,
        }).catch(err => console.error('Failed to upgrade user after PayPal payment:', err));
      }
      return originalJson(data);
    };
    await capturePaypalOrder(req, res);
  });

  app.post("/api/paypal/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const rawBody = req.body.toString();
      const payload = JSON.parse(rawBody);
      await paypalService.handleWebhook(payload, req.headers, rawBody);
      res.sendStatus(200);
    } catch (error) {
      console.error("PayPal webhook error:", error);
      res.sendStatus(500);
    }
  });

  // Activate subscription after PayPal redirect (called from Checkout page)
  app.post("/api/paypal/subscription/activate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { subscriptionId } = req.body;
      
      if (!subscriptionId) {
        return res.status(400).json({ error: "Subscription ID required" });
      }

      const activated = await paypalService.activateSubscriptionByUser(userId, subscriptionId);
      
      if (activated) {
        res.json({ success: true, message: "Subscription activated" });
      } else {
        res.status(400).json({ error: "Failed to activate subscription" });
      }
    } catch (error) {
      console.error("Subscription activation error:", error);
      res.status(500).json({ error: "Failed to activate subscription" });
    }
  });

  // PayPal Subscription endpoints
  app.post("/api/paypal/subscribe", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { tier = 'PRO' } = req.body;
      const validTier = tier === 'ELITE' ? 'ELITE' : 'PRO';
      
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      
      const result = await paypalService.createSubscription(
        userId,
        `${baseUrl}/checkout?subscription=success&tier=${validTier}`,
        `${baseUrl}/checkout?subscription=cancelled`,
        validTier
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("PayPal subscription error:", error);
      res.status(500).json({ error: error.message || "Failed to create subscription" });
    }
  });

  app.get("/api/paypal/subscription", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUserRole(userId);
      
      if (!user?.paypalSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }
      
      const details = await paypalService.getSubscriptionDetails(user.paypalSubscriptionId);
      res.json({
        subscriptionId: details.id,
        status: details.status,
        startTime: details.start_time,
        nextBillingTime: details.billing_info?.next_billing_time,
        lastPayment: details.billing_info?.last_payment,
        planName: details.plan_id,
      });
    } catch (error: any) {
      console.error("Get subscription error:", error);
      res.status(500).json({ error: error.message || "Failed to get subscription details" });
    }
  });

  app.post("/api/paypal/subscription/cancel", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUserRole(userId);
      
      if (!user?.paypalSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }
      
      await paypalService.cancelSubscription(user.paypalSubscriptionId, req.body.reason || 'User requested cancellation');
      
      // Only update status to cancelled - user keeps PRO access until billing period ends
      // The actual downgrade to FREE happens when PayPal sends BILLING.SUBSCRIPTION.EXPIRED webhook
      await storage.updateUserSubscriptionInfo(userId, {
        subscriptionStatus: 'cancelled',
        // Keep subscriptionTier as PRO - user retains access until billing period ends
      });
      
      res.json({ success: true, message: "Subscription cancelled successfully" });
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel subscription" });
    }
  });

  // Traders Hub API
  app.use("/api/traders-hub", requireAuth, tradersHubRouter);
  
  app.get(api.trades.list.path, requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const userRole = await storage.getUserRole(userId);
    const historyDays = getHistoryDays(userRole?.subscriptionTier);
    
    const allTrades = await storage.getTrades(userId);
    const filteredTrades = filterByTierDate(allTrades, historyDays);
    res.json(filteredTrades);
  });

  app.get(api.trades.get.path, requireAuth, async (req, res) => {
    const trade = await storage.getTrade(Number(req.params.id));
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    // Access control: ensure user can only access their own trades
    if (trade.userId !== req.session.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(trade);
  });

  app.post(api.trades.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.trades.create.input.parse(req.body);
      const trade = await storage.createTrade({ ...input, userId: req.session.userId! });
      res.status(201).json(trade);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post(api.trades.validate.path, (req, res) => {
    try {
      const input = api.trades.validate.input.parse(req.body);
      const result = storage.validateTradeRules(input);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.trades.update.path, async (req, res) => {
    try {
      const input = api.trades.update.input.parse(req.body);
      const trade = await storage.updateTrade(Number(req.params.id), input);
      if (!trade) {
        return res.status(404).json({ message: 'Trade not found' });
      }
      res.json(trade);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.trades.delete.path, async (req, res) => {
    await storage.deleteTrade(Number(req.params.id));
    res.status(204).send();
  });

  app.delete("/api/admin/users/:targetUserId", requireAdmin, async (req, res) => {
    try {
      const { targetUserId } = req.params;
      
      const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, targetUserId)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === "OWNER") {
        return res.status(403).json({ message: "Cannot delete the Owner account" });
      }

      await db.delete(schema.userRole).where(eq(schema.userRole.userId, targetUserId));

      // Audit log for deletion
      await db.insert(schema.adminAuditLog).values({
        adminId: req.session.userId!,
        actionType: "DELETE_USER",
        targetUserId: targetUserId,
        details: { timestamp: new Date() }
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/admin/emails", requireAdmin, async (req, res) => {
    try {
      const emails = await db.select().from(schema.sentEmails).orderBy(desc(schema.sentEmails.sentAt));
      res.json(emails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch email logs" });
    }
  });

  app.post("/api/admin/trigger-email", requireAdmin, async (req, res) => {
    try {
      const { userId, type, data } = req.body;
      const success = await emailService.sendTransactionalEmail(userId, type, data || {});
      
      // Audit log for manual trigger
      await db.insert(schema.adminAuditLog).values({
        adminId: req.session.userId!,
        actionType: "MANUAL_EMAIL_TRIGGER",
        targetUserId: userId,
        details: { type, success }
      });

      if (success) {
        res.json({ message: "Email triggered successfully" });
      } else {
        res.status(500).json({ message: "Failed to trigger email" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error triggering email" });
    }
  });

  // MT5 Bridge Sync Endpoint (REST API for Python Connector)
  // SINGLE SOURCE OF TRUTH: This is the ONLY endpoint for MT5 data ingestion
  app.post("/api/mt5/sync", async (req, res) => {
    try {
      const { 
        userId, 
        token, 
        balance, 
        equity, 
        margin, 
        freeMargin, 
        marginLevel, 
        floatingPl, 
        leverage,
        currency,
        positions,
        history
      } = req.body;

      if (!userId || !token) {
        return res.status(401).json({ message: "Authentication required: userId and token" });
      }

      // 1. Identification & Security Check
      const user = await storage.getUserRole(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found", error: "USER_NOT_FOUND" });
      }

      const storedToken = user.syncToken?.trim();
      const providedToken = token?.trim();

      // Enforce strict token validation (403 for mismatch)
      if (storedToken && storedToken !== providedToken) {
        console.warn(`[MT5 Sync] UNAUTHORIZED: Token mismatch for ${userId}.`);
        return res.status(403).json({ 
          message: "Invalid Sync Token.",
          error: "TOKEN_MISMATCH"
        });
      }

      // 2. Atomic Sync Operation: Update metrics, snapshots, and history
      await storage.updateMT5Data({
        userId,
        syncToken: providedToken || "",
        balance: String(balance || 0),
        equity: String(equity || 0),
        margin: String(margin || 0),
        freeMargin: String(freeMargin || 0),
        marginLevel: String(marginLevel || 0),
        floatingPl: String(floatingPl || 0),
        leverage: leverage,
        currency: currency,
        positions: positions || []
      });

      // 3. Update history (Journal Data Integrity)
      if (history && Array.isArray(history) && history.length > 0) {
        console.log(`[MT5 Sync] Syncing history for ${userId}. Count: ${history.length}`);
        await storage.syncMT5History(userId, history);
        
        await db.insert(schema.adminAuditLog).values({
          adminId: "SYSTEM_MT5",
          actionType: "MT5_HISTORY_SYNC",
          targetUserId: userId,
          details: { count: history.length, timestamp: new Date() }
        });
      }

      res.json({ success: true, status: "CONNECTED", timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("[MT5 Sync Error]:", error);
      res.status(500).json({ message: "Synchronization failed" });
    }
  });

  app.get("/api/mt5/status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const data = await storage.getMT5Data(userId);
      
      if (!data || !data.lastUpdate) {
        return res.json({ status: "OFFLINE", isLive: false });
      }
      
      const lastUpdate = new Date(data.lastUpdate);
      const now = new Date();
      // SINGLE SOURCE OF TRUTH: Status is CONNECTED only if sync was received within last 45 seconds
      const isLive = (now.getTime() - lastUpdate.getTime()) < 45000;
      
      res.json({
        status: isLive ? "CONNECTED" : "OFFLINE",
        lastSync: data.lastUpdate,
        isLive,
        metrics: {
          balance: data.balance,
          equity: data.equity,
          floatingPl: data.floatingPl,
          marginLevel: data.marginLevel,
          margin: data.margin,
          freeMargin: data.freeMargin,
          leverage: data.leverage,
          currency: data.currency,
          positions: data.positions
        }
      });
    } catch (error) {
      console.error("MT5 Status Error:", error);
      res.status(500).json({ message: "Failed to fetch status" });
    }
  });

  app.get("/api/mt5/snapshots/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const snapshots = await storage.getDailySnapshots(userId);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch snapshots" });
    }
  });

  // Equity curve from cumulative trade P&L (SINGLE SOURCE OF TRUTH)
  // Combines both MT5 history and manual trades (excluding MT5 duplicates)
  app.get("/api/equity-curve/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own equity curve" });
      }
      
      // Get user's subscription tier for history filtering
      const userRole = await storage.getUserRole(sessionUserId);
      const historyDays = getHistoryDays(userRole?.subscriptionTier);
      
      const allMt5History = await storage.getMT5History(userId);
      const allManualTrades = await storage.getTrades(userId);
      
      // Apply tier-based date filtering
      const mt5History = filterByTierDate(allMt5History, historyDays);
      const manualTrades = filterByTierDate(allManualTrades, historyDays);
      
      // Combine MT5 history and manual trades (excluding MT5 sync duplicates)
      const mt5Trades = (mt5History || []).map(t => ({
        date: t.closeTime,
        netPl: parseFloat(t.netPl || "0"),
        symbol: t.symbol,
        source: "MT5"
      }));
      
      // Only include manual trades that are NOT MT5 sync duplicates
      const manualTradesFiltered = (manualTrades || [])
        .filter(t => !t.notes?.startsWith("MT5_TICKET_"))
        .map(t => ({
          date: t.createdAt,
          netPl: parseFloat(t.netPl || "0"),
          symbol: t.pair,
          source: "Manual"
        }));
      
      const allTrades = [...mt5Trades, ...manualTradesFiltered];
      
      if (allTrades.length === 0) {
        return res.json([]);
      }

      // Sort trades chronologically
      const sortedTrades = allTrades.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate cumulative P&L
      let cumulativePl = 0;
      const equityCurve = sortedTrades.map(trade => {
        cumulativePl += trade.netPl;
        return {
          date: trade.date,
          equity: cumulativePl,
          netPl: trade.netPl,
          symbol: trade.symbol,
          source: trade.source
        };
      });

      res.json(equityCurve);
    } catch (error) {
      console.error("Equity curve error:", error);
      res.status(500).json({ message: "Failed to generate equity curve" });
    }
  });

  app.get("/api/mt5/history/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      
      if (userId === "demo") {
        return res.json([]);
      }
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own MT5 history" });
      }
      
      // Get user's subscription tier for history filtering
      const userRole = await storage.getUserRole(sessionUserId);
      const historyDays = getHistoryDays(userRole?.subscriptionTier);
      
      const allHistory = await storage.getMT5History(userId);
      const filteredHistory = filterByTierDate(allHistory, historyDays);
      res.json(filteredHistory);
    } catch (error) {
      console.error("MT5 History Error:", error);
      res.status(500).json({ message: "Failed to fetch MT5 history" });
    }
  });

  app.get("/api/performance/intelligence/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own performance data" });
      }
      
      // Get user's subscription tier for history filtering
      const userRole = await storage.getUserRole(sessionUserId);
      const historyDays = getHistoryDays(userRole?.subscriptionTier);
      
      // SINGLE SOURCE OF TRUTH: Combine MT5 history + manual trades (excluding duplicates)
      const allMt5History = await storage.getMT5History(userId);
      const allManualTrades = await storage.getTrades(userId);
      
      // Apply tier-based date filtering
      const mt5History = filterByTierDate(allMt5History, historyDays);
      const manualTrades = filterByTierDate(allManualTrades, historyDays);
      
      // MT5 trades
      const mt5Normalized = (mt5History || []).map(t => {
        const pl = parseFloat(t.netPl || "0");
        return {
          netPl: pl,
          outcome: pl > 0 ? "Win" : pl < 0 ? "Loss" : "Break-even",
          direction: t.direction,
          createdAt: t.closeTime,
          riskReward: 0,
          setup: "MT5 Sync"
        };
      });
      
      // Manual trades (excluding MT5 sync duplicates)
      const manualNormalized = (manualTrades || [])
        .filter(t => !t.notes?.startsWith("MT5_TICKET_"))
        .map(t => ({
          netPl: parseFloat(t.netPl || "0"),
          outcome: t.outcome,
          direction: t.direction,
          createdAt: t.createdAt,
          riskReward: parseFloat(t.riskReward || "0"),
          setup: t.matchedSetup || "Manual Entry"
        }));
      
      const normalizedTrades = [...mt5Normalized, ...manualNormalized];

      if (normalizedTrades.length === 0) {
        return res.json({ message: "No data available" });
      }

      // Performance Intelligence Engine
      const sessions = { London: { pl: 0, wins: 0, total: 0 }, NY: { pl: 0, wins: 0, total: 0 }, Asia: { pl: 0, wins: 0, total: 0 } };
      const days = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
      let totalPl = 0;
      let totalGrossProfit = 0;
      let totalGrossLoss = 0;
      let wins = 0;
      let losses = 0;
      let breakeven = 0;
      let totalTradesCount = normalizedTrades.length;
      let totalRR = 0;
      let rrCount = 0;
      let maxDrawdown = 0;
      let peak = 0;
      let currentEquity = 0;
      
      const setups: Record<string, { wins: number, total: number }> = {};
      const violations = {
        overRisk: 0,
        outsideSession: 0,
        noStrategy: 0,
        overtrading: 0
      };

      const dailyTrades: Record<string, number> = {};

      normalizedTrades.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()).forEach(t => {
        const date = new Date(t.createdAt!);
        const hour = date.getUTCHours();
        const day = dayNames[date.getUTCDay()];
        const dateStr = date.toISOString().split('T')[0];
        
        dailyTrades[dateStr] = (dailyTrades[dateStr] || 0) + 1;
        if (dailyTrades[dateStr] > 5) violations.overtrading++;

        const pl = t.netPl;
        totalPl += pl;
        if (pl > 0) totalGrossProfit += pl;
        else totalGrossLoss += Math.abs(pl);

        currentEquity += pl;
        if (currentEquity > peak) peak = currentEquity;
        const dd = peak - currentEquity;
        if (dd > maxDrawdown) maxDrawdown = dd;

        // Session classification (London: 8-16 UTC, NY: 13-21 UTC, Asia: 0-8 UTC)
        let session: "London" | "NY" | "Asia";
        if (hour >= 8 && hour < 13) session = "London"; // Pure London
        else if (hour >= 13 && hour < 16) session = "NY"; // London/NY Overlap (Classified as NY for intensity)
        else if (hour >= 16 && hour < 21) session = "NY"; // Pure NY
        else session = "Asia";

        sessions[session].pl += pl;
        sessions[session].total++;
        if (t.outcome === "Win") sessions[session].wins++;
        
        days[day as keyof typeof days] += pl;

        // Proper outcome classification
        if (pl > 0) wins++;
        else if (pl < 0) losses++;
        else breakeven++;

        if (t.riskReward > 0) {
          totalRR += t.riskReward;
          rrCount++;
        }

        if (hour < 8 || hour >= 21) violations.outsideSession++;
        if (t.setup === "Manual Entry") violations.noStrategy++;

        if (!setups[t.setup]) setups[t.setup] = { wins: 0, total: 0 };
        setups[t.setup].total++;
        if (t.outcome === "Win") setups[t.setup].wins++;
      });

      const bestSessionEntry = Object.entries(sessions).reduce((a, b) => a[1].pl > b[1].pl ? a : b);
      const bestSession = bestSessionEntry[0];
      const bestDay = Object.entries(days).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      
      const setupStats = Object.entries(setups).map(([name, stat]) => ({
        name,
        winRate: (stat.wins / stat.total) * 100
      }));
      const bestSetup = setupStats.length ? setupStats.reduce((a, b) => a.winRate > b.winRate ? a : b).name : "N/A";

      const profitFactor = totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : totalGrossProfit > 0 ? Infinity : 0;
      
      // Win rate excludes break-even trades (only count decisive trades)
      const decisiveTrades = wins + losses;
      const winRateVal = decisiveTrades > 0 ? (wins / decisiveTrades) * 100 : 0;
      const lossRateVal = decisiveTrades > 0 ? (losses / decisiveTrades) * 100 : 0;
      
      // Average Win / Average Loss
      const avgWin = wins > 0 ? totalGrossProfit / wins : 0;
      const avgLoss = losses > 0 ? totalGrossLoss / losses : 0;
      
      // Expectancy = (Win Rate × Avg Win) − (Loss Rate × Avg Loss)
      const winRateDecimal = decisiveTrades > 0 ? wins / decisiveTrades : 0;
      const lossRateDecimal = decisiveTrades > 0 ? losses / decisiveTrades : 0;
      const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);
      
      const recoveryFactor = maxDrawdown > 0 ? totalPl / maxDrawdown : totalPl > 0 ? 1 : 0;

      res.json({
        bestSession,
        bestDay,
        bestSetup,
        winRate: winRateVal.toFixed(1),
        lossRate: lossRateVal.toFixed(1),
        avgWin: avgWin.toFixed(2),
        avgLoss: avgLoss.toFixed(2),
        avgRR: rrCount ? (totalRR / rrCount).toFixed(2) : "0.00",
        expectancy: expectancy.toFixed(2),
        profitFactor: isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞",
        maxDrawdown: maxDrawdown.toFixed(2),
        maxDrawdownPercent: peak > 0 ? ((maxDrawdown / peak) * 100).toFixed(2) : "0.00",
        recoveryFactor: recoveryFactor.toFixed(2),
        totalPl: totalPl.toFixed(2),
        totalTrades: totalTradesCount,
        wins,
        losses,
        breakeven,
        violations,
        sessionMetrics: sessions
      });
    } catch (error) {
      console.error("Intelligence failure:", error);
      res.status(500).json({ message: "Intelligence failure" });
    }
  });

  // Session Performance Analytics (ELITE ONLY)
  app.get("/api/session-analytics/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Elite tier check - get user from session and verify subscription
      const sessionUserId = req.session.userId!;
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own session analytics" });
      }
      
      const currentUser = await storage.getUserRole(sessionUserId);
      const tier = currentUser?.subscriptionTier?.toUpperCase();
      if (tier !== "ELITE") {
        return res.status(403).json({ message: "Session Analytics requires Elite subscription" });
      }

      const mt5History = await storage.getMT5History(userId);
      const manualTrades = await storage.getTrades(userId);

      // Normalize trades from both sources
      type NormalizedTrade = {
        openTime: Date;
        closeTime: Date;
        netPl: number;
        volume: number;
        stopLoss: number | null;
        entryPrice: number | null;
      };

      const mt5Normalized: NormalizedTrade[] = (mt5History || []).map(t => ({
        openTime: new Date(t.openTime),
        closeTime: new Date(t.closeTime),
        netPl: parseFloat(t.netPl || "0"),
        volume: parseFloat(t.volume || "0"),
        stopLoss: t.sl ? parseFloat(t.sl) : null,
        entryPrice: t.entryPrice ? parseFloat(t.entryPrice) : null,
      }));

      const manualNormalized: NormalizedTrade[] = (manualTrades || [])
        .map(t => ({
          openTime: new Date(t.createdAt || new Date()),
          closeTime: new Date(t.createdAt || new Date()),
          netPl: parseFloat(t.netPl || "0"),
          volume: 0,
          stopLoss: t.stopLoss ? parseFloat(t.stopLoss) : null,
          entryPrice: t.entryPrice ? parseFloat(t.entryPrice) : null,
        }));

      const allTrades = [...mt5Normalized, ...manualNormalized];

      if (allTrades.length === 0) {
        return res.json({
          sessions: [],
          totalTrades: 0,
          bestSession: null,
          worstSession: null,
        });
      }

      // Use shared session classification (UTC-based)
      const classifySession = (date: Date): string => {
        const hour = date.getUTCHours();
        if (hour >= 0 && hour < 7) return "asian";
        if (hour >= 7 && hour < 12) return "london";
        if (hour >= 12 && hour < 16) return "overlap_london_ny";
        if (hour >= 16 && hour < 21) return "new_york";
        return "off_hours";
      };

      const sessionData: Record<string, {
        tradeCount: number;
        wins: number;
        losses: number;
        breakeven: number;
        totalPnL: number;
        totalVolume: number;
        totalRisk: number;
        riskCount: number;
      }> = {
        asian: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
        london: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
        overlap_london_ny: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
        new_york: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
        off_hours: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
      };

      allTrades.forEach(trade => {
        const session = classifySession(trade.openTime);
        const data = sessionData[session];
        
        data.tradeCount++;
        data.totalPnL += trade.netPl;
        data.totalVolume += trade.volume;
        
        if (trade.netPl > 0) data.wins++;
        else if (trade.netPl < 0) data.losses++;
        else data.breakeven++;

        // Calculate risk if stop loss and entry price available
        if (trade.stopLoss && trade.entryPrice) {
          const risk = Math.abs(trade.entryPrice - trade.stopLoss);
          data.totalRisk += risk;
          data.riskCount++;
        }
      });

      const sessionInfo: Record<string, { displayName: string; color: string }> = {
        asian: { displayName: "Asian", color: "#f59e0b" },
        london: { displayName: "London", color: "#3b82f6" },
        overlap_london_ny: { displayName: "London/NY Overlap", color: "#8b5cf6" },
        new_york: { displayName: "New York", color: "#10b981" },
        off_hours: { displayName: "Off Hours", color: "#6b7280" },
      };

      const sessions = Object.entries(sessionData)
        .filter(([_, data]) => data.tradeCount > 0)
        .map(([session, data]) => {
          const decisiveTrades = data.wins + data.losses;
          return {
            session,
            displayName: sessionInfo[session].displayName,
            color: sessionInfo[session].color,
            tradeCount: data.tradeCount,
            winCount: data.wins,
            lossCount: data.losses,
            breakEvenCount: data.breakeven,
            winRate: decisiveTrades > 0 ? (data.wins / decisiveTrades) * 100 : 0,
            totalPnL: data.totalPnL,
            avgPnL: data.tradeCount > 0 ? data.totalPnL / data.tradeCount : 0,
            avgRisk: data.riskCount > 0 ? data.totalRisk / data.riskCount : 0,
            totalVolume: data.totalVolume,
          };
        })
        .sort((a, b) => b.tradeCount - a.tradeCount);

      // Find best and worst sessions by P&L
      let bestSession = null;
      let worstSession = null;
      if (sessions.length > 0) {
        const sortedByPnL = [...sessions].sort((a, b) => b.totalPnL - a.totalPnL);
        bestSession = sortedByPnL[0]?.session || null;
        worstSession = sortedByPnL[sortedByPnL.length - 1]?.session || null;
      }

      res.json({
        sessions,
        totalTrades: allTrades.length,
        bestSession,
        worstSession,
      });
    } catch (error) {
      console.error("Session analytics failure:", error);
      res.status(500).json({ message: "Session analytics failure" });
    }
  });

  // Time-Based Performance Analysis (ELITE ONLY)
  app.get("/api/time-patterns/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Elite tier check - get user from session and verify subscription
      const sessionUserId = req.session.userId!;
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own time patterns" });
      }
      
      const currentUser = await storage.getUserRole(sessionUserId);
      const tier = currentUser?.subscriptionTier?.toUpperCase();
      if (tier !== "ELITE") {
        return res.status(403).json({ message: "Time Patterns requires Elite subscription" });
      }

      const mt5History = await storage.getMT5History(userId);
      const manualTrades = await storage.getTrades(userId);

      // Normalize trades from both sources
      type NormalizedTrade = {
        openTime: Date;
        netPl: number;
      };

      const mt5Normalized: NormalizedTrade[] = (mt5History || []).map(t => ({
        openTime: new Date(t.openTime),
        netPl: parseFloat(t.netPl || "0"),
      }));

      const manualNormalized: NormalizedTrade[] = (manualTrades || [])
        .map(t => ({
          openTime: new Date(t.createdAt || new Date()),
          netPl: parseFloat(t.netPl || "0"),
        }));

      const allTrades = [...mt5Normalized, ...manualNormalized];

      if (allTrades.length === 0) {
        return res.json({
          byDayOfWeek: [],
          byHourOfDay: [],
          totalTrades: 0,
          bestDay: null,
          worstDay: null,
          bestHour: null,
          worstHour: null,
        });
      }

      // Day of week analysis (0 = Sunday, 6 = Saturday)
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayData: Record<number, { trades: number; wins: number; losses: number; pnl: number }> = {};
      for (let i = 0; i < 7; i++) {
        dayData[i] = { trades: 0, wins: 0, losses: 0, pnl: 0 };
      }

      // Hour of day analysis (0-23 UTC)
      const hourData: Record<number, { trades: number; wins: number; losses: number; pnl: number }> = {};
      for (let i = 0; i < 24; i++) {
        hourData[i] = { trades: 0, wins: 0, losses: 0, pnl: 0 };
      }

      allTrades.forEach(trade => {
        const day = trade.openTime.getUTCDay();
        const hour = trade.openTime.getUTCHours();

        // Day stats
        dayData[day].trades++;
        dayData[day].pnl += trade.netPl;
        if (trade.netPl > 0) dayData[day].wins++;
        else if (trade.netPl < 0) dayData[day].losses++;

        // Hour stats
        hourData[hour].trades++;
        hourData[hour].pnl += trade.netPl;
        if (trade.netPl > 0) hourData[hour].wins++;
        else if (trade.netPl < 0) hourData[hour].losses++;
      });

      // Format day data
      const byDayOfWeek = Object.entries(dayData).map(([day, data]) => {
        const decisiveTrades = data.wins + data.losses;
        return {
          day: parseInt(day),
          dayName: dayNames[parseInt(day)],
          trades: data.trades,
          wins: data.wins,
          losses: data.losses,
          winRate: decisiveTrades > 0 ? (data.wins / decisiveTrades) * 100 : 0,
          pnl: data.pnl,
          avgPnl: data.trades > 0 ? data.pnl / data.trades : 0,
        };
      });

      // Format hour data
      const byHourOfDay = Object.entries(hourData).map(([hour, data]) => {
        const decisiveTrades = data.wins + data.losses;
        const hourNum = parseInt(hour);
        return {
          hour: hourNum,
          hourLabel: `${hourNum.toString().padStart(2, '0')}:00`,
          trades: data.trades,
          wins: data.wins,
          losses: data.losses,
          winRate: decisiveTrades > 0 ? (data.wins / decisiveTrades) * 100 : 0,
          pnl: data.pnl,
          avgPnl: data.trades > 0 ? data.pnl / data.trades : 0,
        };
      });

      // Find best/worst by P&L (only consider days/hours with trades)
      const activeDays = byDayOfWeek.filter(d => d.trades > 0);
      const activeHours = byHourOfDay.filter(h => h.trades > 0);

      let bestDay = null, worstDay = null, bestHour = null, worstHour = null;

      if (activeDays.length > 0) {
        const sortedDays = [...activeDays].sort((a, b) => b.pnl - a.pnl);
        bestDay = sortedDays[0].dayName;
        worstDay = sortedDays[sortedDays.length - 1].dayName;
      }

      if (activeHours.length > 0) {
        const sortedHours = [...activeHours].sort((a, b) => b.pnl - a.pnl);
        bestHour = sortedHours[0].hourLabel;
        worstHour = sortedHours[sortedHours.length - 1].hourLabel;
      }

      res.json({
        byDayOfWeek,
        byHourOfDay,
        totalTrades: allTrades.length,
        bestDay,
        worstDay,
        bestHour,
        worstHour,
      });
    } catch (error) {
      console.error("Time patterns analysis failure:", error);
      res.status(500).json({ message: "Time patterns analysis failure" });
    }
  });

  // Behavioral Risk Flags (ELITE ONLY)
  app.get("/api/behavioral-risks/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own behavioral risks" });
      }
      
      // Elite tier check
      const currentUser = await storage.getUserRole(sessionUserId);
      const tier = currentUser?.subscriptionTier?.toUpperCase();
      if (tier !== "ELITE") {
        return res.status(403).json({ message: "Behavioral Risk Flags requires Elite subscription" });
      }

      const mt5History = await storage.getMT5History(userId);
      const manualTrades = await storage.getTrades(userId);

      // Normalize trades from both sources
      type NormalizedTrade = {
        openTime: Date;
        closeTime: Date;
        netPl: number;
        volume: number;
        symbol: string;
      };

      const mt5Normalized: NormalizedTrade[] = (mt5History || []).map(t => ({
        openTime: new Date(t.openTime),
        closeTime: new Date(t.closeTime),
        netPl: parseFloat(t.netPl || "0"),
        volume: parseFloat(t.volume || "0"),
        symbol: t.symbol || "Unknown",
      }));

      // For volume-based analysis, only use MT5 trades (manual trades don't have lot size)
      const mt5OnlyTrades = mt5Normalized.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
      
      // For general analysis (frequency, timing), include all trades
      const manualNormalized: NormalizedTrade[] = (manualTrades || [])
        .map(t => ({
          openTime: new Date(t.createdAt!),
          closeTime: new Date(t.createdAt!),
          netPl: parseFloat(t.netPl || "0"),
          volume: 0,
          symbol: t.pair || "Unknown",
        }));

      const allTrades = [...mt5Normalized, ...manualNormalized]
        .sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());

      if (allTrades.length < 5) {
        return res.json({
          flags: [],
          summary: { totalFlags: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 },
          message: "Insufficient trade data. At least 5 trades required for behavioral analysis."
        });
      }

      const flags: Array<{
        type: string;
        severity: "high" | "medium" | "low";
        title: string;
        description: string;
        evidence: string;
        period?: string;
      }> = [];

      // 1. REVENGE TRADING DETECTION (MT5 only - requires position sizes)
      // Pattern: Increased position size on the NEXT trade after consecutive losses
      if (mt5OnlyTrades.length >= 10) {
        let consecutiveLosses = 0;
        let revengeTradeCount = 0;
        let totalPostLossVolumeIncrease = 0;
        let previousVolume = mt5OnlyTrades[0]?.volume || 0;

        for (let i = 1; i < mt5OnlyTrades.length; i++) {
          const prevTrade = mt5OnlyTrades[i - 1];
          const currentTrade = mt5OnlyTrades[i];
          
          if (prevTrade.netPl < 0) {
            consecutiveLosses++;
          } else {
            consecutiveLosses = 0;
          }
          
          // Check if NEXT trade after 2+ losses has increased volume
          if (consecutiveLosses >= 2 && previousVolume > 0) {
            if (currentTrade.volume > previousVolume * 1.3) {
              revengeTradeCount++;
              totalPostLossVolumeIncrease += (currentTrade.volume - previousVolume) / previousVolume * 100;
            }
          }
          
          previousVolume = currentTrade.volume;
        }

        if (revengeTradeCount > 0) {
          const avgIncrease = totalPostLossVolumeIncrease / revengeTradeCount;
          const severity = revengeTradeCount >= 5 ? "high" : revengeTradeCount >= 2 ? "medium" : "low";
          flags.push({
            type: "revenge_trading",
            severity,
            title: "Increased Risk After Losses",
            description: "Position sizes tend to increase following consecutive losing trades.",
            evidence: `Detected ${revengeTradeCount} instances where volume increased by avg ${avgIncrease.toFixed(1)}% after 2+ losses (MT5 trades).`,
          });
        }
      }

      // 2. OVERTRADING DETECTION BY SESSION
      // Group trades by session and detect abnormal trade frequency
      const sessionTradeCounts: Record<string, { dates: Set<string>, trades: number }> = {};
      
      for (const trade of allTrades) {
        const utcHour = trade.openTime.getUTCHours();
        let session = "off_hours";
        if (utcHour >= 0 && utcHour < 7) session = "asian";
        else if (utcHour >= 7 && utcHour < 12) session = "london";
        else if (utcHour >= 12 && utcHour < 16) session = "overlap";
        else if (utcHour >= 16 && utcHour < 21) session = "new_york";
        
        const dateKey = trade.openTime.toISOString().split('T')[0];
        if (!sessionTradeCounts[session]) {
          sessionTradeCounts[session] = { dates: new Set(), trades: 0 };
        }
        sessionTradeCounts[session].dates.add(dateKey);
        sessionTradeCounts[session].trades++;
      }

      const sessionAverages: Record<string, number> = {};
      for (const [session, data] of Object.entries(sessionTradeCounts)) {
        sessionAverages[session] = data.trades / Math.max(1, data.dates.size);
      }

      const overallAvg = Object.values(sessionAverages).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(sessionAverages).length);
      
      for (const [session, avg] of Object.entries(sessionAverages)) {
        if (avg > overallAvg * 1.8 && sessionTradeCounts[session].trades >= 10) {
          const sessionName = session.charAt(0).toUpperCase() + session.slice(1).replace('_', ' ');
          flags.push({
            type: "session_overtrading",
            severity: avg > overallAvg * 2.5 ? "high" : "medium",
            title: `Elevated Trading in ${sessionName} Session`,
            description: `Trade frequency in the ${sessionName} session is significantly higher than other sessions.`,
            evidence: `${avg.toFixed(1)} trades/day in ${sessionName} vs ${overallAvg.toFixed(1)} trades/day average across sessions.`,
          });
        }
      }

      // 3. RISK CREEP OVER TIME (MT5 only - requires position sizes)
      // Detect gradual increase in position sizes over time
      if (mt5OnlyTrades.length >= 20) {
        const firstQuarterTrades = mt5OnlyTrades.slice(0, Math.floor(mt5OnlyTrades.length / 4));
        const lastQuarterTrades = mt5OnlyTrades.slice(-Math.floor(mt5OnlyTrades.length / 4));
        
        const firstQuarterAvgVolume = firstQuarterTrades.reduce((a, t) => a + t.volume, 0) / firstQuarterTrades.length;
        const lastQuarterAvgVolume = lastQuarterTrades.reduce((a, t) => a + t.volume, 0) / lastQuarterTrades.length;
        
        if (firstQuarterAvgVolume > 0 && lastQuarterAvgVolume > firstQuarterAvgVolume * 1.25) {
          const increasePercent = ((lastQuarterAvgVolume - firstQuarterAvgVolume) / firstQuarterAvgVolume) * 100;
          const firstDate = firstQuarterTrades[0].openTime.toISOString().split('T')[0];
          const lastDate = lastQuarterTrades[lastQuarterTrades.length - 1].openTime.toISOString().split('T')[0];
          
          flags.push({
            type: "risk_creep",
            severity: increasePercent > 75 ? "high" : increasePercent > 40 ? "medium" : "low",
            title: "Position Size Increase Over Time",
            description: "Average position sizes have increased compared to earlier trading period.",
            evidence: `Volume increased ${increasePercent.toFixed(1)}% from early period (avg ${firstQuarterAvgVolume.toFixed(2)}) to recent (avg ${lastQuarterAvgVolume.toFixed(2)}) (MT5 trades).`,
            period: `${firstDate} to ${lastDate}`,
          });
        }
      }

      // 4. RAPID TRADING AFTER LOSSES (Same-day revenge)
      const dailyTrades: Record<string, NormalizedTrade[]> = {};
      for (const trade of allTrades) {
        const dateKey = trade.closeTime.toISOString().split('T')[0];
        if (!dailyTrades[dateKey]) dailyTrades[dateKey] = [];
        dailyTrades[dateKey].push(trade);
      }

      let rapidRetryDays = 0;
      for (const [date, trades] of Object.entries(dailyTrades)) {
        if (trades.length < 3) continue;
        
        // Sort trades by time
        trades.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
        
        // Check for rapid trading after losses (multiple trades within 30 mins after a loss)
        for (let i = 0; i < trades.length - 1; i++) {
          if (trades[i].netPl < 0) {
            const nextTrade = trades[i + 1];
            const timeDiff = (nextTrade.openTime.getTime() - trades[i].closeTime.getTime()) / (1000 * 60);
            if (timeDiff < 15) {
              rapidRetryDays++;
              break;
            }
          }
        }
      }

      if (rapidRetryDays >= 3) {
        flags.push({
          type: "rapid_retry",
          severity: rapidRetryDays >= 7 ? "high" : "medium",
          title: "Quick Re-Entry After Losses",
          description: "New trades are often opened within minutes after losing trades close.",
          evidence: `Found ${rapidRetryDays} days where new trades were opened within 15 minutes of a loss.`,
        });
      }

      // 5. LOSS CHASING (Increasing volume on losing days - MT5 only)
      if (mt5OnlyTrades.length >= 10) {
        const mt5DailyTrades: Record<string, NormalizedTrade[]> = {};
        for (const trade of mt5OnlyTrades) {
          const dateKey = trade.closeTime.toISOString().split('T')[0];
          if (!mt5DailyTrades[dateKey]) mt5DailyTrades[dateKey] = [];
          mt5DailyTrades[dateKey].push(trade);
        }

        let lossChasingDays = 0;
        for (const [date, trades] of Object.entries(mt5DailyTrades)) {
          if (trades.length < 3) continue;
          
          trades.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
          
          let runningPnL = 0;
          let increasedVolumeAfterLoss = false;
          let prevVolume = trades[0].volume;
          
          for (let i = 0; i < trades.length; i++) {
            runningPnL += trades[i].netPl;
            if (runningPnL < 0 && trades[i].volume > prevVolume * 1.3) {
              increasedVolumeAfterLoss = true;
            }
            prevVolume = trades[i].volume;
          }
          
          if (increasedVolumeAfterLoss && runningPnL < 0) {
            lossChasingDays++;
          }
        }

        if (lossChasingDays >= 2) {
          flags.push({
            type: "loss_chasing",
            severity: lossChasingDays >= 5 ? "high" : "medium",
            title: "Increased Size on Losing Days",
            description: "Position sizes increased during days that ended with negative P&L.",
            evidence: `Detected ${lossChasingDays} losing days where volume increased mid-session while down (MT5 trades).`,
          });
        }
      }

      // Calculate summary
      const summary = {
        totalFlags: flags.length,
        highRisk: flags.filter(f => f.severity === "high").length,
        mediumRisk: flags.filter(f => f.severity === "medium").length,
        lowRisk: flags.filter(f => f.severity === "low").length,
      };

      // Historical comparison - compare recent 30 days to prior 30 days
      // Use MT5 trades for volume comparison, all trades for frequency
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      
      const recentTrades = allTrades.filter(t => t.closeTime >= thirtyDaysAgo);
      const priorTrades = allTrades.filter(t => t.closeTime >= sixtyDaysAgo && t.closeTime < thirtyDaysAgo);
      const recentMt5Trades = mt5OnlyTrades.filter(t => t.closeTime >= thirtyDaysAgo);
      const priorMt5Trades = mt5OnlyTrades.filter(t => t.closeTime >= sixtyDaysAgo && t.closeTime < thirtyDaysAgo);

      let historicalComparison = null;
      if (recentTrades.length >= 5 && priorTrades.length >= 5) {
        const recentAvgVolume = recentMt5Trades.length > 0 ? recentMt5Trades.reduce((a, t) => a + t.volume, 0) / recentMt5Trades.length : 0;
        const priorAvgVolume = priorMt5Trades.length > 0 ? priorMt5Trades.reduce((a, t) => a + t.volume, 0) / priorMt5Trades.length : 0;
        const recentTradesPerDay = recentTrades.length / 30;
        const priorTradesPerDay = priorTrades.length / 30;
        
        historicalComparison = {
          recentPeriod: "Last 30 days",
          priorPeriod: "30-60 days ago",
          volumeChange: priorAvgVolume > 0 ? ((recentAvgVolume - priorAvgVolume) / priorAvgVolume * 100).toFixed(1) : "N/A",
          frequencyChange: priorTradesPerDay > 0 ? ((recentTradesPerDay - priorTradesPerDay) / priorTradesPerDay * 100).toFixed(1) : "0",
          recentTradeCount: recentTrades.length,
          priorTradeCount: priorTrades.length,
        };
      }

      res.json({
        flags: flags.sort((a, b) => {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        }),
        summary,
        historicalComparison,
        analyzedTrades: allTrades.length,
      });
    } catch (error) {
      console.error("Behavioral risk analysis failure:", error);
      res.status(500).json({ message: "Behavioral risk analysis failure" });
    }
  });

  app.get("/api/ai/insights/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { timeframe = "recent" } = req.query;

      // Check for existing recent insight (cache for 1 hour)
      const existing = await storage.getAIInsights(userId, timeframe as string);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (existing.length > 0 && new Date(existing[0].createdAt!) > oneHourAgo) {
        return res.json(existing[0]);
      }

      // Generate new insight
      const intelligenceRes = await fetch(`${req.protocol}://${req.get('host')}/api/performance/intelligence/${userId}`, {
        headers: { cookie: req.headers.cookie || "" }
      });
      const intelligenceData = await intelligenceRes.json();

      if (intelligenceData.message === "No data available" || (intelligenceData.totalTrades || 0) < 5) {
        return res.json({ insightText: "Insufficient data for AI analysis. Continue trading to unlock insights." });
      }

      const prompt = `You are a Performance Analyst for a rule-based trading application. 
Analyze the following trading metrics and provide 1-3 short, factual, and non-advisory insights.
Strict Rules:
- Descriptive and factual ONLY.
- NO trade recommendations.
- NO buy/sell suggestions.
- NO entries, SL, or TP instructions.
- NO symbol or timeframe recommendations.
- NO market predictions.
- MUST label output as "PERFORMANCE INSIGHT".
- MUST include the disclaimer: "This is not financial advice."

Metrics:
- Total Trades: ${intelligenceData.totalTrades}
- Win Rate: ${intelligenceData.winRate}%
- Profit Factor: ${intelligenceData.profitFactor}
- Expectancy: ${intelligenceData.expectancy}
- Best Session: ${intelligenceData.bestSession}
- Violations: ${JSON.stringify(intelligenceData.violations)}

Output exactly 1-3 bullet points.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      });

      const insightText = response.choices[0].message.content || "Unable to generate insights at this time.";
      
      const disclaimer = "\n\nThis is not financial advice.";
      const finalInsight = insightText.includes("This is not financial advice") ? insightText : insightText + disclaimer;

      const savedInsight = await storage.saveAIInsight({
        userId,
        timeframe: timeframe as string,
        insightText: finalInsight,
        metadata: intelligenceData
      });

      await storage.logAIRequest({
        userId,
        prompt,
        response: insightText
      });

      res.json(savedInsight);
    } catch (error) {
      console.error("AI Insight Error:", error);
      res.status(500).json({ message: "AI Analysis failed" });
    }
  });

  // Get unique instruments from user's MT5 history
  app.get("/api/instruments/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Authorization: Ensure user can only access their own data
      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Get unique symbols from mt5_history
      const history = await db.select({
        symbol: schema.mt5History.symbol
      })
        .from(schema.mt5History)
        .where(eq(schema.mt5History.userId, userId))
        .groupBy(schema.mt5History.symbol);
      
      const symbols = history.map(h => h.symbol);
      res.json({ symbols });
    } catch (error) {
      console.error("Instruments Error:", error);
      res.status(500).json({ message: "Failed to fetch instruments" });
    }
  });

  // Get instrument stats (performance data for a specific symbol)
  app.get("/api/instruments/:userId/:symbol/stats", requireAuth, async (req, res) => {
    try {
      const { userId, symbol } = req.params;
      const sessionUserId = req.session.userId!;
      
      // Authorization: Ensure user can only access their own data
      if (sessionUserId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Get user's subscription tier for history filtering
      const userRole = await storage.getUserRole(sessionUserId);
      const historyDays = getHistoryDays(userRole?.subscriptionTier);
      
      const allTrades = await db.select()
        .from(schema.mt5History)
        .where(and(
          eq(schema.mt5History.userId, userId),
          eq(schema.mt5History.symbol, symbol)
        ));
      
      // Apply tier-based date filtering
      const trades = filterByTierDate(allTrades, historyDays);
      
      if (trades.length === 0) {
        return res.json({ 
          tradeCount: 0, 
          winRate: "0", 
          avgProfitLoss: "0", 
          totalProfitLoss: "0",
          trades: []
        });
      }
      
      const wins = trades.filter(t => parseFloat(t.netPl) > 0).length;
      const winRate = ((wins / trades.length) * 100).toFixed(1);
      const totalPl = trades.reduce((sum, t) => sum + parseFloat(t.netPl), 0);
      const avgPl = totalPl / trades.length;
      
      // Get recent trades (last 10) for context
      const recentTrades = trades
        .sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime())
        .slice(0, 10)
        .map(t => ({
          direction: t.direction,
          netPl: t.netPl,
          duration: t.duration,
          closeTime: t.closeTime
        }));
      
      res.json({
        tradeCount: trades.length,
        winRate,
        avgProfitLoss: avgPl.toFixed(2),
        totalProfitLoss: totalPl.toFixed(2),
        trades: recentTrades
      });
    } catch (error) {
      console.error("Instrument Stats Error:", error);
      res.status(500).json({ message: "Failed to fetch instrument stats" });
    }
  });

  // Generate AI analysis for a specific instrument (PRO only)
  app.post("/api/ai/instrument-analysis/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { symbol } = req.body;
      
      // Authorization: Ensure user can only access their own data
      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Check AI analysis access based on plan
      const userRole = await storage.getUserRole(userId);
      if (!canAccessFeature(userRole?.subscriptionTier, "aiAnalysis")) {
        return res.status(403).json({ message: "Pro or Elite subscription required for AI analysis" });
      }
      
      if (!symbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }
      
      // Check cache - only regenerate if older than 30 minutes
      const existing = await db.select()
        .from(schema.instrumentAnalyses)
        .where(and(
          eq(schema.instrumentAnalyses.userId, userId),
          eq(schema.instrumentAnalyses.symbol, symbol)
        ))
        .orderBy(desc(schema.instrumentAnalyses.createdAt))
        .limit(1);
      
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (existing.length > 0 && new Date(existing[0].createdAt!) > thirtyMinsAgo) {
        return res.json(existing[0]);
      }
      
      // Fetch instrument stats directly from database
      const trades = await db.select()
        .from(schema.mt5History)
        .where(and(
          eq(schema.mt5History.userId, userId),
          eq(schema.mt5History.symbol, symbol)
        ));
      
      if (trades.length < 1) {
        return res.json({ 
          analysisText: "No trading history available for this instrument.", 
          symbol,
          tradeCount: 0 
        });
      }
      
      // Calculate stats
      const wins = trades.filter(t => parseFloat(t.netPl) > 0).length;
      const winRate = ((wins / trades.length) * 100).toFixed(1);
      const totalPl = trades.reduce((sum, t) => sum + parseFloat(t.netPl), 0);
      const avgPl = totalPl / trades.length;
      
      // Get recent trades for AI context
      const recentTrades = trades
        .sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime())
        .slice(0, 5)
        .map(t => ({
          direction: t.direction,
          netPl: t.netPl,
          closeTime: t.closeTime
        }));
      
      // Generate AI analysis - General market context (no real-time data available)
      const prompt = `You are a Professional Market Analyst. Provide general market context for ${symbol}.

IMPORTANT: You do NOT have access to real-time prices. Do NOT mention any specific price levels, support/resistance numbers, or current prices.

ANALYSIS REQUIREMENTS:
- General characteristics of how ${symbol} typically behaves
- Key fundamental factors that influence this instrument
- What economic events/data releases typically impact it
- General trading considerations for this market

STRICT RULES:
- NO specific price levels (you don't have real-time data)
- NO "current price is X" statements
- NO specific support/resistance numbers
- NO trade recommendations
- Focus on GENERAL market dynamics and what drives this instrument

Provide a concise 3-4 sentence analysis covering:
1. What fundamentally drives ${symbol} price movements
2. Key economic factors and events traders should monitor

End with: "Check your charts for current price action."`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 250,
      });

      const analysisText = response.choices[0].message.content || "Unable to generate analysis.";
      
      // Save to database
      const [saved] = await db.insert(schema.instrumentAnalyses).values({
        userId,
        symbol,
        analysisText,
        tradeCount: trades.length,
        winRate: winRate,
        avgProfitLoss: avgPl.toFixed(2),
        totalProfitLoss: totalPl.toFixed(2)
      }).returning();
      
      res.json(saved);
    } catch (error) {
      console.error("Instrument Analysis Error:", error);
      res.status(500).json({ message: "AI Analysis failed" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    const users = await db.select().from(schema.userRole);
    res.json(users);
  });

  app.post("/api/admin/create-user", requireAdmin, async (req, res) => {
    try {
      const { email, subscriptionTier, role, tempPassword } = req.body;
      const adminId = req.session.userId!;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Normalize email to lowercase (matches login behavior)
      const normalizedEmail = email.toLowerCase().trim();

      // Validate subscription tier
      const validTiers = ["FREE", "PRO", "ELITE"];
      const tier = validTiers.includes(subscriptionTier?.toUpperCase()) 
        ? subscriptionTier.toUpperCase() 
        : "FREE";

      // Check if user already exists
      const [existing] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, normalizedEmail)).limit(1);
      if (existing) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate or use provided temporary password
      const password = tempPassword || `Tradify${Math.random().toString(36).substring(2, 8)}!`;
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create the user with hashed password
      const newUser = await storage.createUserRole({
        userId: normalizedEmail,
        password: hashedPassword,
        role: role || "USER",
        subscriptionTier: tier,
        termsAccepted: true,
        riskAcknowledged: true,
      });

      // Audit log
      await db.insert(schema.adminAuditLog).values({
        adminId,
        actionType: "CREATE_USER",
        targetUserId: normalizedEmail,
        details: { subscriptionTier: tier, role: role || "USER" }
      });

      res.json({ success: true, user: newUser, tempPassword: password });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post("/api/admin/update-user", requireAdmin, async (req, res) => {
    try {
      const { targetUserId, updates } = req.body;
      const adminId = req.session.userId!;
      
      // If subscriptionTier is being updated, use the dedicated storage method
      if (updates.subscriptionTier) {
        await storage.updateUserSubscription(targetUserId, updates.subscriptionTier);
        
        // Audit log
        await db.insert(schema.adminAuditLog).values({
          adminId,
          actionType: `SET_PLAN_${updates.subscriptionTier}`,
          targetUserId,
          details: { updates }
        });
        
        delete updates.subscriptionTier; // Remove from updates object to avoid duplicate update below
      }

      // Handle role update (Deactivation/Reactivation)
      if (updates.role) {
        await db.insert(schema.adminAuditLog).values({
          adminId,
          actionType: updates.role === "DEACTIVATED" ? "DEACTIVATE_USER" : "ACTIVATE_USER",
          targetUserId,
          details: { updates }
        });
      }

      // Handle any other role/meta updates
      if (Object.keys(updates).length > 0) {
        await db.update(schema.userRole)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(schema.userRole.userId, targetUserId));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const logs = await db.select().from(schema.adminAuditLog).orderBy(desc(schema.adminAuditLog.timestamp));
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // --- Admin Access Management ---
  app.get("/api/admin/creator-applications", requireAdmin, async (req, res) => {
    try {
      const apps = await storage.getCreatorApplications();
      res.json(apps);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.post("/api/admin/creator-applications/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const adminId = req.session.userId!;
      const id = parseInt(req.params.id);

      await storage.updateCreatorApplicationStatus(id, status);

      // Audit log
      await db.insert(schema.adminAuditLog).values({
        adminId,
        actionType: `CREATOR_APP_${status}`,
        targetUserId: "SYSTEM", // The application has its own userId
        details: { applicationId: id, status }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update application status" });
    }
  });

  app.get("/api/admin/access", requireAdmin, async (req, res) => {
    const admins = await db.select().from(schema.adminAccess);
    res.json(admins);
  });

  app.post("/api/admin/access", requireAdmin, async (req, res) => {
    const { email, label } = req.body;
    const accessKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const [newAdmin] = await db.insert(schema.adminAccess).values({
      email,
      label,
      accessKey,
    }).returning();
    
    res.json(newAdmin);
  });

  app.delete("/api/admin/access/:id", requireAdmin, async (req, res) => {
    await db.delete(schema.adminAccess).where(eq(schema.adminAccess.id, parseInt(req.params.id)));
    res.json({ success: true });
  });

  // Seed data on startup
  await seedDatabase();

  app.get("/api/user/role", async (req, res) => {
    // Check for hardcoded admin first
    const userId = req.query.userId as string || req.headers["x-user-id"] as string;
    const country = req.query.country as string;
    const phoneNumber = req.query.phoneNumber as string;
    const timezone = req.query.timezone as string;
    
    if (!userId) {
      return res.status(400).json({ message: "UserId required" });
    }
    
    // Check dynamic admin access table
    const [dynamicAdmin] = await db.select().from(schema.adminAccess).where(eq(schema.adminAccess.email, userId)).limit(1);

    if (userId === "mohammad@admin.com" || (dynamicAdmin && dynamicAdmin.isActive)) {
      const [existing] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
      if (!existing || existing.role !== 'OWNER') {
        await storage.updateUserSubscription(userId, "PRO");
        await db.update(schema.userRole).set({ role: 'OWNER' }).where(eq(schema.userRole.userId, userId));
      }
      return res.json({ userId, role: 'OWNER', subscriptionTier: 'PRO' });
    }

    let role = await storage.getUserRole(userId);
    
    // Create role if it doesn't exist
    if (!role) {
      const syncToken = Math.random().toString(36).substring(2, 15);
      role = await storage.createUserRole({
        userId,
        role: userId === "dev-user" ? "OWNER" : "TRADER",
        country: country || null,
        phoneNumber: phoneNumber || null,
        timezone: timezone || null,
        subscriptionTier: "FREE",
        syncToken
      });
      if (userId === "dev-user") {
        await storage.updateUserSubscription(userId, "FREE");
      }
    } else if (country || phoneNumber || timezone) {
      // Update existing if new info provided during login/signup sync
      await db.update(schema.userRole)
        .set({ 
          country: country || role.country, 
          phoneNumber: phoneNumber || role.phoneNumber,
          timezone: timezone || role.timezone,
          updatedAt: new Date() 
        })
        .where(eq(schema.userRole.userId, userId));
      
      // Refresh role data
      role = await storage.getUserRole(userId);
    }
    
    return res.json(role || { userId, subscriptionTier: "FREE", role: "TRADER" });
  });

  app.post("/api/user/upgrade-dev", async (req, res) => {
    const userId = req.headers["x-user-id"] as string || "dev-user";
    await storage.updateUserSubscription(userId, "PRO");
    res.json({ success: true, message: "Developer PRO access granted" });
  });

  app.post("/api/user/update-profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { country, phoneNumber, timezone } = req.body;
      
      await db.update(schema.userRole)
        .set({ 
          country, 
          phoneNumber, 
          timezone, 
          updatedAt: new Date() 
        })
        .where(eq(schema.userRole.userId, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/user/deactivate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await db.update(schema.userRole)
        .set({ role: "DEACTIVATED", updatedAt: new Date() })
        .where(eq(schema.userRole.userId, userId));
      
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Deactivation failed" });
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate account" });
    }
  });

  app.post("/api/user/reset-password-request", async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase();
    
    // For demo/emergency purposes: If it's the user's email, we'll reset it to a temporary one
    if (normalizedEmail === "scarymohd2@gmail.com") {
      const hashedPassword = await bcrypt.hash("Tradify2026!", 10);
      await db.update(schema.userRole)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(schema.userRole.userId, normalizedEmail));
      return res.json({ message: "EMERGENCY RESET: Password set to Tradify2026!" });
    }

    console.log(`Password reset requested for: ${normalizedEmail}`);
    res.json({ message: "If an account exists, a reset link has been sent." });
  });

  // ===== STRATEGY ROUTES =====

  // Get all strategies for user
  app.get("/api/strategies", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategies = await storage.getStrategies(userId);
      
      // Include rules count for each strategy
      const strategiesWithRules = await Promise.all(
        strategies.map(async (strategy) => {
          const rules = await storage.getStrategyRules(strategy.id);
          return { ...strategy, rules };
        })
      );
      
      res.json(strategiesWithRules);
    } catch (error) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({ message: "Failed to fetch strategies" });
    }
  });

  // Get active strategy for user
  app.get("/api/strategies/active", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategy = await storage.getActiveStrategy(userId);
      res.json(strategy || null);
    } catch (error) {
      console.error("Error fetching active strategy:", error);
      res.status(500).json({ message: "Failed to fetch active strategy" });
    }
  });

  // Get single strategy by ID
  app.get("/api/strategies/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      const strategy = await storage.getStrategy(strategyId);
      
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      
      // Ownership check
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const rules = await storage.getStrategyRules(strategyId);
      res.json({ ...strategy, rules });
    } catch (error) {
      console.error("Error fetching strategy:", error);
      res.status(500).json({ message: "Failed to fetch strategy" });
    }
  });

  // Create new strategy
  app.post("/api/strategies", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { name, description, isActive, rules } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Strategy name is required" });
      }
      
      // Check strategy limit based on plan
      const user = await storage.getUserRole(userId);
      const maxStrategies = getMaxStrategies(user?.subscriptionTier);
      
      if (maxStrategies !== -1) {
        const existingStrategies = await storage.getStrategies(userId);
        
        if (existingStrategies.length >= maxStrategies) {
          return res.status(403).json({ 
            message: "Strategy limit reached",
            error: "PLAN_LIMIT_REACHED",
            limit: maxStrategies,
            current: existingStrategies.length
          });
        }
      }
      
      // Create strategy
      const strategy = await storage.createStrategy({
        userId,
        name: name.trim(),
        description: description?.trim() || null,
        isActive: false, // Will set active separately if needed
      });
      
      // Create rules
      if (rules && Array.isArray(rules)) {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          await storage.createStrategyRule({
            strategyId: strategy.id,
            category: rule.definition.category,
            label: rule.customLabel || rule.definition.label,
            description: rule.definition.description || null,
            ruleType: rule.ruleType,
            options: {
              inputType: rule.definition.inputType,
              value: rule.value,
              validation: rule.definition.validation,
            },
            defaultValue: String(rule.definition.defaultValue ?? ""),
            isRequired: rule.definition.inputType === "boolean" ? rule.value === true : true,
            sortOrder: i,
          });
        }
      }
      
      // Set as active if requested
      if (isActive) {
        await storage.setActiveStrategy(userId, strategy.id);
      }
      
      const createdRules = await storage.getStrategyRules(strategy.id);
      res.status(201).json({ ...strategy, rules: createdRules, isActive });
    } catch (error) {
      console.error("Error creating strategy:", error);
      res.status(500).json({ message: "Failed to create strategy" });
    }
  });

  // Update strategy
  app.patch("/api/strategies/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      const { name, description } = req.body;
      
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateStrategy(strategyId, {
        name: name?.trim(),
        description: description?.trim(),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating strategy:", error);
      res.status(500).json({ message: "Failed to update strategy" });
    }
  });

  // Delete strategy
  app.delete("/api/strategies/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteStrategy(strategyId);
      res.json({ message: "Strategy deleted" });
    } catch (error) {
      console.error("Error deleting strategy:", error);
      res.status(500).json({ message: "Failed to delete strategy" });
    }
  });

  // Set active strategy
  app.post("/api/strategies/:id/activate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.setActiveStrategy(userId, strategyId);
      res.json({ message: "Strategy activated" });
    } catch (error) {
      console.error("Error activating strategy:", error);
      res.status(500).json({ message: "Failed to activate strategy" });
    }
  });

  // Duplicate strategy
  app.post("/api/strategies/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check strategy limit based on plan
      const user = await storage.getUserRole(userId);
      const maxStrategies = getMaxStrategies(user?.subscriptionTier);
      
      if (maxStrategies !== -1) {
        const existingStrategies = await storage.getStrategies(userId);
        
        if (existingStrategies.length >= maxStrategies) {
          return res.status(403).json({ 
            message: "Strategy limit reached",
            error: "PLAN_LIMIT_REACHED",
            limit: maxStrategies,
            current: existingStrategies.length
          });
        }
      }
      
      // Get original rules
      const rules = await storage.getStrategyRules(strategyId);
      
      // Create new strategy with copied name
      const newStrategy = await storage.createStrategy({
        userId,
        name: `${strategy.name} (Copy)`,
        description: strategy.description,
        isActive: false,
      });
      
      // Copy rules to new strategy
      for (const rule of rules) {
        await storage.createStrategyRule({
          strategyId: newStrategy.id,
          category: rule.category,
          label: rule.label,
          description: rule.description,
          ruleType: rule.ruleType,
          options: rule.options as Record<string, unknown> | null,
          defaultValue: rule.defaultValue,
          isRequired: rule.isRequired,
          sortOrder: rule.sortOrder,
        });
      }
      
      const newRules = await storage.getStrategyRules(newStrategy.id);
      res.status(201).json({ ...newStrategy, rules: newRules });
    } catch (error) {
      console.error("Error duplicating strategy:", error);
      res.status(500).json({ message: "Failed to duplicate strategy" });
    }
  });

  // ==================== COMPLIANCE EVALUATION ENDPOINTS ====================

  // Evaluate trade compliance against a strategy
  app.post("/api/compliance/evaluate", requireAuth, async (req, res) => {
    try {
      const { tradeId, strategyId, tradeInputs } = req.body;
      const userId = req.session.userId!;

      // Get the trade
      const trade = await storage.getTrade(tradeId);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Verify trade ownership
      if (trade.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to evaluate this trade" });
      }

      // Get the strategy and its rules
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }

      // Verify strategy ownership
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to use this strategy" });
      }

      const rules = await storage.getStrategyRules(strategyId);
      if (rules.length === 0) {
        return res.status(400).json({ message: "Strategy has no rules to evaluate" });
      }

      // Import and run the compliance engine
      const { evaluateTradeCompliance } = await import("./complianceEngine");
      const result = evaluateTradeCompliance(trade, rules, tradeInputs || {});

      // Save compliance result with strategy name for historical tracking
      const passedCount = result.ruleEvaluations.filter(e => e.passed).length;
      const complianceResult = await storage.saveComplianceResult({
        tradeId,
        strategyId,
        strategyName: strategy.name,
        userId,
        overallCompliant: result.overallCompliant,
        rulesEvaluated: result.ruleEvaluations.length,
        rulesPassed: passedCount,
      });

      // Save rule evaluations
      const evaluationsToSave = result.ruleEvaluations.map((ruleEval) => ({
        complianceResultId: complianceResult.id,
        ruleId: ruleEval.ruleId,
        ruleType: ruleEval.ruleType,
        ruleLabel: ruleEval.ruleLabel,
        expectedValue: ruleEval.expectedValue as Record<string, unknown> | null,
        actualValue: ruleEval.actualValue as Record<string, unknown> | null,
        passed: ruleEval.passed,
        violationReason: ruleEval.violationReason,
      }));

      await storage.saveRuleEvaluations(evaluationsToSave);

      // Update trade compliance status
      await storage.updateTrade(tradeId, {
        isRuleCompliant: result.overallCompliant,
        violationReason: result.violations.length > 0
          ? result.violations.map(v => v.violationReason).join("; ")
          : null,
      });

      res.json({
        complianceResultId: complianceResult.id,
        overallCompliant: result.overallCompliant,
        ruleEvaluations: result.ruleEvaluations,
        violations: result.violations,
      });
    } catch (error) {
      console.error("Error evaluating compliance:", error);
      res.status(500).json({ message: "Failed to evaluate compliance" });
    }
  });

  // Get compliance result for a trade
  app.get("/api/compliance/trade/:tradeId", requireAuth, async (req, res) => {
    try {
      const tradeId = parseInt(req.params.tradeId);
      const userId = req.session.userId!;
      
      const result = await storage.getTradeComplianceResult(tradeId);
      
      if (!result) {
        return res.status(404).json({ message: "No compliance evaluation found for this trade" });
      }
      
      // Verify ownership
      if (result.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this compliance result" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching compliance result:", error);
      res.status(500).json({ message: "Failed to fetch compliance result" });
    }
  });

  // Get compliance history for user (with strategy context preserved)
  app.get("/api/compliance/history", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      let limit = parseInt(req.query.limit as string) || 50;
      limit = Math.max(1, Math.min(200, isNaN(limit) ? 50 : limit));
      const strategyId = req.query.strategyId ? parseInt(req.query.strategyId as string) : undefined;
      
      const history = await storage.getTradeComplianceHistory(userId, limit, strategyId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching compliance history:", error);
      res.status(500).json({ message: "Failed to fetch compliance history" });
    }
  });

  // Get all compliance evaluations for a specific trade
  app.get("/api/compliance/trade/:tradeId/history", requireAuth, async (req, res) => {
    try {
      const tradeId = parseInt(req.params.tradeId);
      const userId = req.session.userId!;
      
      const trade = await storage.getTrade(tradeId);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      
      if (trade.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this trade's history" });
      }
      
      const history = await storage.getTradeComplianceResultsByTrade(tradeId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching trade compliance history:", error);
      res.status(500).json({ message: "Failed to fetch trade compliance history" });
    }
  });

  // AI explanation for compliance trends (read-only)
  app.get("/api/compliance/explain", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      let tradeCount = parseInt(req.query.trades as string) || 20;
      tradeCount = Math.max(1, Math.min(50, isNaN(tradeCount) ? 20 : tradeCount));
      
      // Get user's active strategy
      const activeStrategy = await storage.getActiveStrategy(userId);
      if (!activeStrategy) {
        return res.status(404).json({ message: "No active strategy found" });
      }
      
      // Get detailed violation data
      const { results, violationsByRule, patterns } = await storage.getDetailedViolations(
        userId, 
        activeStrategy.id, 
        tradeCount
      );
      
      // Check for insufficient data
      if (results.length < 3) {
        return res.json({
          explanation: "Insufficient data for meaningful analysis. At least 3 evaluated trades are needed to identify patterns. Continue trading and evaluating your compliance to build up your history.",
          insufficientData: true,
          tradesAnalyzed: results.length
        });
      }
      
      // Calculate compliance stats
      const compliantCount = results.filter(r => r.overallCompliant).length;
      const compliancePercent = Math.round((compliantCount / results.length) * 100);
      const totalViolations = Object.values(violationsByRule).reduce((sum, v) => sum + v.count, 0);
      
      // Build context for AI
      const violationSummary = Object.entries(violationsByRule)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([ruleType, data]) => `- ${data.ruleLabel}: ${data.count} violations (${data.reasons.slice(0, 3).join('; ')})`)
        .join('\n');
      
      // Build time pattern summary
      const timePatterns = Object.entries(patterns.byTimeOfDay)
        .filter(([_, data]) => data.total > 0)
        .map(([slot, data]) => {
          const rate = data.total > 0 ? Math.round((data.violations / data.total) * 100) : 0;
          return `- ${slot}: ${data.total} trades, ${rate}% violation rate`;
        })
        .join('\n');
      
      // Build day pattern summary
      const dayPatterns = Object.entries(patterns.byDayOfWeek)
        .filter(([_, data]) => data.total > 0)
        .map(([day, data]) => {
          const rate = data.total > 0 ? Math.round((data.violations / data.total) * 100) : 0;
          return `- ${day}: ${data.total} trades, ${rate}% violation rate`;
        })
        .join('\n');
      
      // Use pre-calculated values
      const recentViolationRate = patterns.riskDrift.recentViolationRate;
      const olderViolationRate = patterns.riskDrift.olderViolationRate;
      const recentCompliance = 100 - recentViolationRate;
      const olderCompliance = 100 - olderViolationRate;
      
      const prompt = `You are a trading journal assistant analyzing a trader's rule compliance data. Your role is STRICTLY READ-ONLY:
- You CANNOT create rules
- You CANNOT change scores  
- You CANNOT suggest trades
- You can ONLY explain patterns in the existing compliance data

Analyze this compliance data and provide a brief, factual summary:

Strategy: ${activeStrategy.name}
Trades Analyzed: ${results.length}
Overall Compliance: ${compliancePercent}%
Total Violations: ${totalViolations}

TREND (Risk Drift):
- Recent violation rate: ${recentViolationRate}%
- Older violation rate: ${olderViolationRate}%
- Direction: ${recentViolationRate < olderViolationRate ? 'Improving' : recentViolationRate > olderViolationRate ? 'Declining' : 'Stable'}

TIME-OF-DAY PATTERNS:
${timePatterns || 'No time data available'}

DAY-OF-WEEK PATTERNS:
${dayPatterns || 'No day data available'}

VIOLATION BREAKDOWN BY RULE:
${violationSummary || 'No violations recorded'}

Provide a 3-4 sentence factual summary that:
1. States the overall compliance rate and trend direction
2. Identifies the most frequently violated rule (if any)
3. Notes any time-of-day or day-of-week patterns where violations are concentrated
4. Describes risk drift if recent behavior differs from older behavior

IMPORTANT: Only state facts from the data above. Do not recommend trades or suggest rule changes.`;

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 300,
      });
      
      const explanation = response.choices[0]?.message?.content || "Unable to generate explanation.";
      
      res.json({
        explanation,
        insufficientData: false,
        tradesAnalyzed: results.length,
        compliancePercent,
        totalViolations,
        trendComparison: {
          recent: recentCompliance,
          older: olderCompliance
        },
        patterns: {
          byTimeOfDay: patterns.byTimeOfDay,
          byDayOfWeek: patterns.byDayOfWeek,
          riskDrift: patterns.riskDrift
        }
      });
    } catch (error) {
      console.error("Error generating compliance explanation:", error);
      res.status(500).json({ message: "Failed to generate compliance explanation" });
    }
  });

  // Get compliance score for user's active strategy
  app.get("/api/compliance/score", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      let tradeCount = parseInt(req.query.trades as string) || 10;
      tradeCount = Math.max(1, Math.min(100, isNaN(tradeCount) ? 10 : tradeCount));
      
      // Get user's active strategy
      const activeStrategy = await storage.getActiveStrategy(userId);
      if (!activeStrategy) {
        return res.status(404).json({ message: "No active strategy found" });
      }
      
      const score = await storage.getComplianceScore(userId, activeStrategy.id, tradeCount);
      
      res.json({
        strategyId: activeStrategy.id,
        strategyName: activeStrategy.name,
        ...score
      });
    } catch (error) {
      console.error("Error calculating compliance score:", error);
      res.status(500).json({ message: "Failed to calculate compliance score" });
    }
  });

  return httpServer;
}

async function seedDatabase() {
  // Ensure admin user has a password if it doesn't
  const adminEmail = "mohammad@admin.com";
  const [admin] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, adminEmail)).limit(1);
  if (admin && !admin.password) {
    const hashedPassword = await bcrypt.hash("Admin123!", 10);
    await db.update(schema.userRole).set({ password: hashedPassword }).where(eq(schema.userRole.userId, adminEmail));
    console.log("Seeded admin password");
  }

  const existingTrades = await storage.getTrades();
  if (existingTrades.length === 0) {
    await storage.createTrade({
      pair: "EURUSD",
      direction: "Short",
      timeframe: "M15",
      htfBias: "Bearish",
      structureState: "BOS",
      liquidityStatus: "Taken",
      zoneValidity: "Valid",
      htfBiasClear: true,
      zoneValid: true,
      liquidityTaken: true,
      structureConfirmed: true,
      entryConfirmed: true,
      entryPrice: "1.0850",
      stopLoss: "1.0870",
      takeProfit: "1.0800",
      riskReward: "2.5",
      outcome: "Win",
      notes: "Perfect textbook setup. Liquidity sweep of Asian high, displacement down, entered on FVG retest."
    });
  }
}
