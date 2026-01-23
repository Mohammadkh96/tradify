import express, { type Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import tradersHubRouter from "./traders-hub";

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

  // MT5 Bridge Endpoints
  app.post("/api/mt5/sync", async (req, res) => {
    try {
      const { account, positions } = req.body;
      if (!account) return res.status(400).json({ message: "Account data required" });
      
      await storage.updateMT5Data({
        accountInfo: account,
        positions: positions || [],
        lastUpdate: new Date().toISOString(),
        isConnected: true
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("MT5 Sync Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/mt5/status", async (req, res) => {
    try {
      const data = await storage.getMT5Data();
      if (!data) return res.json({ isConnected: false });
      
      // Auto-disconnect if no update in 10 seconds
      const lastUpdate = new Date(data.lastUpdate).getTime();
      const now = new Date().getTime();
      if (now - lastUpdate > 10000) {
        return res.json({ ...data, isConnected: false });
      }
      
      res.json({ ...data, isConnected: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
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
