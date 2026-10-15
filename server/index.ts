import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { assertDevelopmentSigningKeyNotInProduction } from "./product-linking-assertions";


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
      if (req.url?.startsWith("/api/v1/product-links") && buf.length > 8 * 1024) {
        throw Object.assign(new Error("Product-link request body is too large."), {
          status: 413,
          statusCode: 413,
        });
      }
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

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

const isProd = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";

async function initializeApp() {
  assertDevelopmentSigningKeyNotInProduction();
  // Production schema changes must be applied through reviewed migrations,
  // never with the application's runtime database role during startup.
  
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

  log("API process started without background jobs; scheduled work uses a separate worker entry point.", "startup");
}

// Start the application
initializeApp().catch((error) => {
  console.error(error instanceof Error ? error.message : "Application startup failed.");
  process.exitCode = 1;
});

export default app;
