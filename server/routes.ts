import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import tradersHubRouter from "./traders-hub";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, or, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPg from "connect-pg-simple";

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
  app.use(express.json({ limit: '1mb' }));
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
  
  // Traders Hub API
  app.use("/api/traders-hub", requireAuth, tradersHubRouter);
  
  app.get(api.trades.list.path, requireAuth, async (req, res) => {
    const trades = await storage.getTrades();
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

  // MT5 Bridge Endpoints (Authenticated & Validated)
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
        return res.status(401).json({ message: "Authentication required" });
      }

      // Log the sync attempt
      console.log(`[MT5 Sync] Connection attempt from ${userId} with token [${token}]`);
      
      // Validate token against user's stored token
      const [role] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
      
      if (!role) {
        console.error(`[MT5 Sync] User not found: ${userId}`);
        return res.status(401).json({ message: "User not found" });
      }

      const storedToken = role.syncToken?.trim();
      const providedToken = token?.trim();

      if (!storedToken) {
        console.warn(`[MT5 Sync] User ${userId} has no token generated.`);
        return res.status(401).json({ message: "Sync token not generated for this user" });
      }

      if (storedToken !== providedToken) {
        console.warn(`[MT5 Sync] Token mismatch for ${userId}. Received: [${providedToken}], Expected: [${storedToken}]`);
        
        // Log mismatch to audit trail for debugging
        await storage.createAdminAuditLog({
          adminId: 0, // System
          actionType: "MT5_SYNC_ERROR",
          targetUserId: userId,
          details: `Token mismatch. Received: ${providedToken?.substring(0, 8)}..., Expected: ${storedToken?.substring(0, 8)}...`
        });

        return res.status(401).json({ 
          message: "Invalid sync token",
          error: "TOKEN_MISMATCH",
          received: providedToken?.substring(0, 4) + "...",
          expected: storedToken?.substring(0, 4) + "..."
        });
      }

      await storage.updateMT5Data({
        userId,
        balance: String(balance || 0),
        equity: String(equity || 0),
        margin: String(margin || 0),
        freeMargin: String(freeMargin || 0),
        marginLevel: String(marginLevel || 0),
        floatingPl: String(floatingPl || 0),
        leverage: leverage,
        currency: currency,
        positions: positions || [],
        syncToken: token
      });

      // Sync History if provided
      if (history && history.length > 0) {
        await storage.syncMT5History(userId, history);
        
        // Log sync event for traceability
        await db.insert(schema.adminAuditLog).values({
          adminId: "SYSTEM_MT5",
          actionType: "MT5_HISTORY_SYNC",
          targetUserId: userId,
          details: { count: history.length, timestamp: new Date() }
        });
      }

      // Sync positions into manual trade journal if they match ticket IDs
      if (positions && positions.length > 0) {
        for (const pos of positions) {
          const existing = await storage.getTrades();
          const alreadyLogged = existing.find(t => t.notes?.includes(`MT5_TICKET_${pos.ticket}`));
          
          if (!alreadyLogged) {
            await storage.createTrade({
              pair: pos.symbol,
              direction: pos.type === "Buy" ? "Long" : "Short",
              timeframe: "MT5_SYNC",
              htfBias: "Bullish",
              structureState: "None",
              liquidityStatus: "None",
              zoneValidity: "Valid",
              htfBiasClear: true,
              zoneValid: true,
              liquidityTaken: true,
              structureConfirmed: true,
              entryConfirmed: true,
              entryPrice: String(pos.price || 0),
              stopLoss: String(pos.sl || 0),
              takeProfit: String(pos.tp || 0),
              riskReward: "0",
              outcome: "Pending",
              notes: `[MT5 Synced] Ticket: ${pos.ticket} | MT5_TICKET_${pos.ticket}`,
              userId: userId 
            });
          }
        }
      }
      
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("MT5 Sync Error:", error);
      res.status(500).json({ message: "Sync failed" });
    }
  });

  app.get("/api/mt5/history/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const history = await storage.getMT5History(userId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  app.get("/api/mt5/status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const data = await storage.getMT5Data(userId);
      if (!data) {
        return res.json({ status: "DISCONNECTED" });
      }
      
      // Check if last update was within 1 minute
      const lastUpdate = new Date(data.lastUpdate || 0);
      const now = new Date();
      const isLive = (now.getTime() - lastUpdate.getTime()) < 60000;
      
      let error = undefined;
      if (!isLive && data.lastUpdate) {
        error = "Heartbeat timeout (last update > 60s)";
      } else if (!data) {
        error = "No terminal data found";
      }

      res.json({
        status: isLive ? "CONNECTED" : "DISCONNECTED",
        lastSync: data.lastUpdate,
        isLive,
        error,
        metrics: {
          balance: data.balance,
          equity: data.equity,
          floatingPl: data.floatingPl,
          marginLevel: data.marginLevel,
          positions: data.positions
        }
      });
    } catch (error) {
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

  app.get("/api/performance/intelligence/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const manualTrades = await storage.getTrades();
      const mt5History = await storage.getMT5History(userId);
      
      const trades = [
        ...manualTrades.filter(t => t.userId === userId || t.userId === "dev-user").map(t => ({
          netPl: parseFloat(t.entryPrice || "0") > 0 ? 0 : 0, // Manual trades usually don't have P&L logic yet unless calculated
          outcome: t.outcome,
          direction: t.direction,
          createdAt: t.createdAt,
          riskReward: parseFloat(t.riskReward || "0"),
          setup: t.matchedSetup || "Unknown"
        })),
        ...mt5History.map(t => ({
          netPl: parseFloat(t.netPl),
          outcome: parseFloat(t.netPl) >= 0 ? "Win" : "Loss",
          direction: t.direction,
          createdAt: t.closeTime,
          riskReward: 0, // MT5 history doesn't inherently store RR
          setup: "MT5 Sync"
        }))
      ];

      if (trades.length === 0) {
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

      trades.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()).forEach(t => {
        const date = new Date(t.createdAt!);
        const hour = date.getUTCHours();
        const day = dayNames[date.getUTCDay()];
        const dateStr = date.toISOString().split('T')[0];
        
        dailyTrades[dateStr] = (dailyTrades[dateStr] || 0) + 1;
        if (dailyTrades[dateStr] > 5) violations.overtrading++; // Default threshold: 5 trades/day

        const pl = t.netPl;
        totalPl += pl;
        if (pl > 0) totalGrossProfit += pl;
        else totalGrossLoss += Math.abs(pl);

        currentEquity += pl;
        if (currentEquity > peak) peak = currentEquity;
        const dd = peak - currentEquity;
        if (dd > maxDrawdown) maxDrawdown = dd;

        // Session classification
        let session: "London" | "NY" | "Asia";
        if (hour >= 8 && hour < 16) session = "London";
        else if (hour >= 13 && hour < 21) session = "NY";
        else session = "Asia";

        sessions[session].pl += pl;
        sessions[session].total++;
        if (t.outcome === "Win") sessions[session].wins++;
        
        days[day as keyof typeof days] += pl;

        if (t.outcome === "Win") wins++;
        else if (t.outcome === "Loss") losses++;

        if (t.riskReward > 0) {
          totalRR += t.riskReward;
          rrCount++;
        }

        // Violations tracking
        if (hour < 8 || hour >= 21) violations.outsideSession++;
        if (!t.setup || t.setup === "Unknown") violations.noStrategy++;

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

      const profitFactor = totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : 1;
      const winRateVal = trades.length ? (wins / trades.length) * 100 : 0;
      const expectancy = trades.length ? totalPl / trades.length : 0;
      const recoveryFactor = maxDrawdown > 0 ? totalPl / maxDrawdown : totalPl > 0 ? 1 : 0;

      res.json({
        bestSession,
        bestDay,
        bestSetup,
        winRate: winRateVal.toFixed(1),
        avgRR: rrCount ? (totalRR / rrCount).toFixed(2) : "0.00",
        expectancy: expectancy.toFixed(2),
        profitFactor: profitFactor.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2),
        maxDrawdownPercent: peak > 0 ? ((maxDrawdown / peak) * 100).toFixed(2) : "0.00",
        recoveryFactor: recoveryFactor.toFixed(2),
        totalPl: totalPl.toFixed(2),
        totalTrades: trades.length,
        violations,
        sessionMetrics: sessions
      });
    } catch (error) {
      res.status(500).json({ message: "Intelligence failure" });
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
      role = await storage.createUserRole({
        userId,
        role: userId === "dev-user" ? "OWNER" : "TRADER",
        country: country || null,
        phoneNumber: phoneNumber || null,
        timezone: timezone || null,
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
