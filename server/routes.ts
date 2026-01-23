import express, { type Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import tradersHubRouter from "./traders-hub";
import { db } from "./db";
import { userRole } from "@shared/schema";
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
        positions 
      } = req.body;

      if (!userId || !token) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Validate token against user's stored token
      const [role] = await db.select().from(userRole).where(eq(userRole.userId, userId)).limit(1);
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
        positions: positions || [],
        syncToken: token
      });

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
              entryPrice: String(pos.price_open),
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

  app.get("/api/mt5/status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const data = await storage.getMT5Data(userId);
      
      if (!data) {
        return res.json({ status: "DISCONNECTED", metrics: null });
      }
      
      const lastUpdate = new Date(data.lastUpdate).getTime();
      const now = new Date().getTime();
      const diff = now - lastUpdate;
      
      let status = "CONNECTED";
      if (diff > 10000) status = "DISCONNECTED";
      else if (diff > 3000) status = "SYNCING";
      
      res.json({ 
        status, 
        lastUpdate: data.lastUpdate,
        metrics: status === "CONNECTED" || status === "SYNCING" ? {
          balance: data.balance,
          equity: data.equity,
          margin: data.margin,
          freeMargin: data.freeMargin,
          marginLevel: data.marginLevel,
          floatingPl: data.floatingPl,
          positions: data.positions
        } : null
      });
    } catch (error) {
      res.status(500).json({ message: "Status check failed" });
    }
  });

  // Seed data on startup
  await seedDatabase();

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
