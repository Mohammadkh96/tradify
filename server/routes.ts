import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trades API
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
      
      // Validation Logic
      let valid = true;
      let reason = "";

      if (!input.htfBiasClear) {
        valid = false;
        reason = "HTF bias not clear";
      } else if (!input.zoneValid) {
        valid = false;
        reason = "Zone not valid";
      } else if (!input.liquidityTaken) {
        valid = false;
        reason = "Liquidity not taken";
      } else if (!input.structureConfirmed) {
        valid = false;
        reason = "Structure not confirmed";
      } else if (!input.entryConfirmed) {
        valid = false;
        reason = "Entry not confirmed";
      } else if (input.zoneValidity === "Invalid") {
        valid = false;
        reason = "Zone invalidated";
      }

      res.json({ valid, reason });
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

  // Seed data on startup
  await seedDatabase();

  return httpServer;
}

// Seed function to add some example data
async function seedDatabase() {
  const existingTrades = await storage.getTrades();
  if (existingTrades.length === 0) {
    await storage.createTrade({
      pair: "EURUSD",
      direction: "Short",
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
    
    await storage.createTrade({
      pair: "GBPUSD",
      direction: "Long",
      htfBias: "Bullish",
      structureState: "None",
      liquidityStatus: "Pending",
      zoneValidity: "Valid",
      htfBiasClear: true,
      zoneValid: true,
      liquidityTaken: true,
      structureConfirmed: false,
      entryConfirmed: false,
      outcome: "Pending",
      notes: "Watching for accumulation at H4 demand."
    });
  }
}
