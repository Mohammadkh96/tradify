import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";
import { marketDataRegistry } from "../zip-engine/market/ProviderRegistry";

const router: IRouter = Router();

export async function databaseHealthCheck(_req: unknown, res: import("express").Response) {
  try {
    await db.execute(sql`SELECT 1`);
    res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch (error) {
    logger.warn(
      { errorType: error instanceof Error ? error.name : typeof error },
      "Database health check failed",
    );
    res.status(503).json({ error: "DATABASE_UNAVAILABLE" });
  }
}

router.get("/health", databaseHealthCheck);

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/market-ready", async (_req, res) => {
  const authority = await marketDataRegistry.resolveAuthority({
    canonicalSymbol: "EURUSD",
    timeframe: "M15",
    strategyId: "DGV8_FX",
    purpose: "STRATEGY",
  });
  const ready = Boolean(
    authority.selectedProviderId &&
    authority.provenance?.health === "HEALTHY" &&
    authority.provenance.approval === "APPROVED",
  );
  res.status(ready ? 200 : 503).json({
    apiStatus: "API_LIVE",
    marketStatus: ready ? "MARKET_READY" : "MARKET_UNAVAILABLE",
  });
});

export default router;
