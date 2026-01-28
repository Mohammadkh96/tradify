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

const PostgresStore = connectPg(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: string;
  }
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
    await capturePaypalOrder(req, res);
  });

  app.post("/api/paypal/webhook", express.json(), async (req, res) => {
    try {
      await paypalService.handleWebhook(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error("PayPal webhook error:", error);
      res.sendStatus(500);
    }
  });

  // Traders Hub API
  app.use("/api/traders-hub", requireAuth, tradersHubRouter);
  
  app.get(api.trades.list.path, requireAuth, async (req, res) => {
    const trades = await storage.getTrades(req.session.userId);
    res.json(trades);
  });

  app.get(api.trades.get.path, requireAuth, async (req, res) => {
    const trade = await storage.getTrade(Number(req.params.id));
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
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
  app.get("/api/equity-curve/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const mt5History = await storage.getMT5History(userId);
      const manualTrades = await storage.getTrades(userId);
      
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

  app.get("/api/mt5/history/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (userId === "demo") {
        return res.json([]);
      }
      
      const history = await storage.getMT5History(userId);
      res.json(history);
    } catch (error) {
      console.error("MT5 History Error:", error);
      res.status(500).json({ message: "Failed to fetch MT5 history" });
    }
  });

  app.get("/api/performance/intelligence/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      // SINGLE SOURCE OF TRUTH: Combine MT5 history + manual trades (excluding duplicates)
      const mt5History = await storage.getMT5History(userId);
      const manualTrades = await storage.getTrades(userId);
      
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

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    const users = await db.select().from(schema.userRole);
    res.json(users);
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
