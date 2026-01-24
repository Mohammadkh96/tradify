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
              notes: `[MT5 Synced] Ticket: ${pos.ticket} | MT5_TICKET_${pos.ticket}`
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
      
      res.json({
        status: isLive ? "CONNECTED" : "DISCONNECTED",
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
    const userId = req.query.userId as string || req.headers["x-user-id"] as string || "dev-user";
    
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
