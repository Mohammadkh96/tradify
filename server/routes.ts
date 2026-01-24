import express, { type Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import tradersHubRouter from "./traders-hub";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Add body parser limits for MT5 payloads
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  
  // Traders Hub API
  app.use("/api/traders-hub", tradersHubRouter);
  
  app.get(api.trades.list.path, async (req, res) => {
    const trades = await storage.getTrades();
    res.json(trades);
  });

  app.get(api.trades.get.path, async (req, res) => {
    const trade = await storage.getTrade(Number(req.params.id));
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    res.json(trade);
  });

  app.post(api.trades.create.path, async (req, res) => {
    try {
      const input = api.trades.create.input.parse(req.body);
      const trade = await storage.createTrade(input);
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

      // Validate token against user's stored token
      const [role] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
      if (!role || role.syncToken !== token) {
        return res.status(401).json({ message: "Invalid sync token" });
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

      // Session Analysis (Simple GMT based)
      const sessions = { London: 0, NY: 0, Asia: 0 };
      const days = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
      let totalPl = 0;
      let wins = 0;
      let losses = 0;
      let totalRR = 0;
      let rrCount = 0;
      let maxDrawdown = 0;
      let peak = 0;
      let currentEquity = 0;
      
      const setups: Record<string, { wins: number, total: number }> = {};

      trades.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()).forEach(t => {
        const date = new Date(t.createdAt!);
        const hour = date.getUTCHours();
        const day = dayNames[date.getUTCDay()];
        
        const pl = t.netPl;
        totalPl += pl;
        currentEquity += pl;
        
        if (currentEquity > peak) peak = currentEquity;
        const dd = peak - currentEquity;
        if (dd > maxDrawdown) maxDrawdown = dd;

        if (hour >= 8 && hour < 16) sessions.London += pl;
        else if (hour >= 13 && hour < 21) sessions.NY += pl;
        else sessions.Asia += pl;
        
        days[day as keyof typeof days] += pl;

        if (t.outcome === "Win") wins++;
        else if (t.outcome === "Loss") losses++;

        if (t.riskReward > 0) {
          totalRR += t.riskReward;
          rrCount++;
        }

        if (!setups[t.setup]) setups[t.setup] = { wins: 0, total: 0 };
        setups[t.setup].total++;
        if (t.outcome === "Win") setups[t.setup].wins++;
      });

      const bestSession = Object.entries(sessions).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      const bestDay = Object.entries(days).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      
      const setupStats = Object.entries(setups).map(([name, stat]) => ({
        name,
        winRate: (stat.wins / stat.total) * 100
      }));
      const bestSetup = setupStats.length ? setupStats.reduce((a, b) => a.winRate > b.winRate ? a : b).name : "N/A";

      const profitFactor = Math.abs(totalPl) / (Math.abs(totalPl - currentEquity) || 1); // Simplified
      const expectancy = trades.length ? totalPl / trades.length : 0;
      const recoveryFactor = maxDrawdown > 0 ? totalPl / maxDrawdown : totalPl > 0 ? 100 : 0;

      res.json({
        bestSession,
        bestDay,
        bestSetup,
        avgRR: rrCount ? (totalRR / rrCount).toFixed(2) : "0.00",
        expectancy: expectancy.toFixed(2),
        profitFactor: profitFactor.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2),
        recoveryFactor: recoveryFactor.toFixed(2)
      });
    } catch (error) {
      res.status(500).json({ message: "Intelligence failure" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    const userId = req.headers["x-user-id"] as string || req.query.userId as string || "dev-user";
    
    // Check if the requester is an authorized admin
    const [dynamicAdmin] = await db.select().from(schema.adminAccess).where(eq(schema.adminAccess.email, userId)).limit(1);
    const requesterRole = await storage.getUserRole(userId);
    
    const isAuthorized = userId === "mohammad@admin.com" || 
                       (requesterRole?.role === "OWNER" || requesterRole?.role === "ADMIN") ||
                       (dynamicAdmin && dynamicAdmin.isActive);

    if (!isAuthorized) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const users = await db.select().from(schema.userRole);
    res.json(users);
  });

  app.post("/api/admin/update-user", async (req, res) => {
    const userId = req.headers["x-user-id"] as string || "dev-user";
    const userRole = await storage.getUserRole(userId);
    if (userRole?.role !== "OWNER" && userRole?.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { targetUserId, updates } = req.body;
    await db.update(schema.userRole).set(updates).where(eq(schema.userRole.userId, targetUserId));
    res.json({ success: true });
  });

  // --- Admin Access Management ---
  app.get("/api/admin/access", async (req, res) => {
    const userId = req.headers["x-user-id"] as string || req.query.userId as string || "dev-user";
    const role = await storage.getUserRole(userId);
    if (role?.role !== "OWNER" && userId !== "mohammad@admin.com") return res.status(403).json({ message: "Forbidden" });
    
    const admins = await db.select().from(schema.adminAccess);
    res.json(admins);
  });

  app.post("/api/admin/access", async (req, res) => {
    const userId = req.headers["x-user-id"] as string || req.query.userId as string || "dev-user";
    const role = await storage.getUserRole(userId);
    if (role?.role !== "OWNER" && userId !== "mohammad@admin.com") return res.status(403).json({ message: "Forbidden" });
    
    const { email, label } = req.body;
    const accessKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const [newAdmin] = await db.insert(schema.adminAccess).values({
      email,
      label,
      accessKey,
    }).returning();
    
    res.json(newAdmin);
  });

  app.delete("/api/admin/access/:id", async (req, res) => {
    const userId = req.headers["x-user-id"] as string || req.query.userId as string || "dev-user";
    const role = await storage.getUserRole(userId);
    if (role?.role !== "OWNER" && userId !== "mohammad@admin.com") return res.status(403).json({ message: "Forbidden" });
    
    await db.delete(schema.adminAccess).where(eq(schema.adminAccess.id, parseInt(req.params.id)));
    res.json({ success: true });
  });

  // Seed data on startup
  await seedDatabase();

  app.get("/api/user/role", async (req, res) => {
    // Check for hardcoded admin first
    const userId = req.query.userId as string || req.headers["x-user-id"] as string;
    
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

    const role = await storage.getUserRole(userId);
    
    // If no role found, ensure dev-user is OWNER for testing purposes
    if (!role && userId === "dev-user") {
      await storage.updateUserSubscription(userId, "FREE");
      await db.update(schema.userRole).set({ role: "OWNER" }).where(eq(schema.userRole.userId, userId));
      const updatedRole = await storage.getUserRole(userId);
      return res.json(updatedRole);
    }
    return res.json(role || { userId, subscriptionTier: "FREE", role: "TRADER" });
  });

  app.post("/api/user/upgrade-dev", async (req, res) => {
    const userId = req.headers["x-user-id"] as string || "dev-user";
    await storage.updateUserSubscription(userId, "PRO");
    res.json({ success: true, message: "Developer PRO access granted" });
  });

  app.post("/api/user/update-profile", async (req, res) => {
    const userId = req.headers["x-user-id"] as string || req.query.userId as string;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { country, phoneNumber } = req.body;
    await db.update(schema.userRole)
      .set({ country, phoneNumber, updatedAt: new Date() })
      .where(eq(schema.userRole.userId, userId));

    res.json({ success: true });
  });

  return httpServer;
}

async function seedDatabase() {
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
