import "./instrumentation";
import app from "./app";
import { logger } from "./lib/logger";
import { env } from "@workspace/config";
import { pool } from "@workspace/db";
import { stopCustomerAccessPolicyRefreshLoop } from "./access-policy";
import {
  REVENUECAT_STALE_DELIVERY_ALERT_CHECK_INTERVAL_MS,
  runRevenueCatStaleDeliveryAlertCheck,
} from "./routes/tradify";
import { twelveDataShadowProvider } from "./zip-engine/market/providers/ExternalShadowProviderAdapters";
import { startWebPushDeliveryWorker } from "./web-push-delivery";
import { startExpoPushDeliveryWorker } from "./expo-push-delivery";

const rawPort = env.port;

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
const backgroundDatabasePollingEnabled =
  env.isProduction || process.env.TRADIFY_DEV_DATABASE_POLLING === "1";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
  const twelveDataIngestion = twelveDataShadowProvider.startBackgroundIngestion();
  logger.info(
    { started: twelveDataIngestion.started, reason: twelveDataIngestion.reason },
    "Twelve Data ingestion status",
  );

  const staleDeliveryAlertCheck = backgroundDatabasePollingEnabled
    ? setInterval(() => {
        void runRevenueCatStaleDeliveryAlertCheck();
      }, REVENUECAT_STALE_DELIVERY_ALERT_CHECK_INTERVAL_MS)
    : null;
  staleDeliveryAlertCheck?.unref();
  const webPushDeliveryWorker = backgroundDatabasePollingEnabled
    ? startWebPushDeliveryWorker()
    : null;
  const expoPushDeliveryWorker = backgroundDatabasePollingEnabled
    ? startExpoPushDeliveryWorker()
    : null;
  if (!backgroundDatabasePollingEnabled) {
    logger.info(
      {
        optInVariable: "TRADIFY_DEV_DATABASE_POLLING=1",
      },
      "Development background database polling is disabled; durable delivery rows remain queued.",
    );
  }

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Graceful shutdown started");
    if (staleDeliveryAlertCheck) clearInterval(staleDeliveryAlertCheck);
    if (webPushDeliveryWorker) clearInterval(webPushDeliveryWorker);
    if (expoPushDeliveryWorker) clearInterval(expoPushDeliveryWorker);
    twelveDataShadowProvider.stopBackgroundIngestion();
    stopCustomerAccessPolicyRefreshLoop();

    const forceClose = setTimeout(() => {
      logger.warn({ signal }, "Shutdown deadline reached; closing remaining connections");
      server.closeAllConnections();
    }, 15_000);
    forceClose.unref();

    server.close((error) => {
      clearTimeout(forceClose);
      if (error) logger.error({ errorType: error.name }, "HTTP server close failed");
      void pool
        .end()
        .then(() => {
          logger.info({ signal }, "Graceful shutdown complete");
          if (error) process.exitCode = 1;
        })
        .catch((poolError: unknown) => {
          logger.error(
            { errorType: poolError instanceof Error ? poolError.name : typeof poolError },
            "Database pool shutdown failed",
          );
          process.exitCode = 1;
        });
    });
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
});
