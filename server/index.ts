import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { ensureSchemaColumns, pool } from "./db";
import { emailService } from "./emailService";
import bcrypt from "bcryptjs";


const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

const isProd = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";

// Seed the owner/admin account in production if it doesn't exist yet.
// Reads ADMIN_EMAIL and ADMIN_PASSWORD from environment variables.
async function ensureAdminAccount() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;

  try {
    const emailLower = adminEmail.toLowerCase();
    const hashed = await bcrypt.hash(adminPassword, 10);

    const { rows } = await pool.query(
      `SELECT user_id, password FROM user_role WHERE LOWER(user_id) = $1 LIMIT 1`,
      [emailLower]
    );

    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO user_role
           (user_id, role, password, email_verified, subscription_tier, full_name, terms_accepted, risk_acknowledged, created_at, updated_at)
         VALUES ($1, 'OWNER', $2, true, 'PRO', 'Admin', true, true, NOW(), NOW())`,
        [emailLower, hashed]
      );
      log(`Admin account seeded for ${adminEmail}`, "seed");
      return;
    }

    // Admin exists — make sure password matches the env var (source of truth)
    const currentHash: string = rows[0].password || "";
    const matches = currentHash ? await bcrypt.compare(adminPassword, currentHash) : false;
    if (!matches) {
      await pool.query(
        `UPDATE user_role
            SET password = $1, role = 'OWNER', email_verified = true, updated_at = NOW()
          WHERE LOWER(user_id) = $2`,
        [hashed, emailLower]
      );
      log(`Admin password synced from ADMIN_PASSWORD for ${adminEmail}`, "seed");
    }
  } catch (err) {
    log(`Admin seed failed: ${err}`, "seed");
  }
}

async function initializeApp() {
  // Ensure database schema is up to date before starting
  await ensureSchemaColumns();

  // Create owner account in production if none exists
  await ensureAdminAccount();
  
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    if (!isProd) {
      console.error("Express error:", err);
    }
  });

  // Setup static file serving for production, Vite dev server for development
  if (isProd) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Replit decides the port - use PORT env or fallback to 5000
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });

  // Backfill email sequences for existing users (Pro/Elite → insights newsletter, completed free_user → free_ongoing)
  setTimeout(async () => {
    log("Running email sequence backfill...", "drip");
    await emailService.backfillEmailSequences();
  }, 90 * 1000);

  // Start email drip sequence background job (runs every 30 minutes)
  const DRIP_INTERVAL_MS = 30 * 60 * 1000;
  setTimeout(async () => {
    log("Running initial drip sequence check...", "drip");
    await emailService.processDripSequences();
    setInterval(async () => {
      log("Running drip sequence check...", "drip");
      await emailService.processDripSequences();
    }, DRIP_INTERVAL_MS);
  }, 60 * 1000);

  // Start daily database backup scheduler (runs at 03:30 UTC).
  // Idempotent: subsequent calls become no-ops, and concurrent runs are
  // guarded inside backup-service.runBackup().
  try {
    const { startBackupScheduler } = await import("./backup-service");
    startBackupScheduler();
  } catch (err) {
    log(`Failed to arm backup scheduler: ${err}`, "backup");
  }
}

// Start the application
initializeApp().catch(console.error);

export default app;
