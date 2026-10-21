import { logger } from "./lib/logger";

const isReplitDeployment =
  Boolean(process.env.REPLIT_DEPLOYMENT) || Boolean(process.env.REPLIT_DEPLOYMENT_ID);

export {};

if (
  process.env.NODE_ENV !== "development" ||
  isReplitDeployment ||
  process.env.TRADIFY_ALLOW_DEV_SEED !== "1"
) {
  throw new Error(
    "Development seed refused. Set NODE_ENV=development and TRADIFY_ALLOW_DEV_SEED=1 outside a Replit deployment.",
  );
}

const [{ ensureRuntimeReady }, { pool }] = await Promise.all([
  import("./tradify-runtime"),
  import("@workspace/db"),
]);

try {
  await ensureRuntimeReady();
  logger.info("Development reference data is initialized.");
} finally {
  await pool.end();
}
