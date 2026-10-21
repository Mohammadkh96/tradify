import express, { type ErrorRequestHandler, type Express } from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import type { Store } from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "@workspace/config";
import router from "./routes";
import { logger, sanitizeRequestPath } from "./lib/logger";
import { databaseHealthCheck } from "./routes/health";
import { Sentry } from "./instrumentation";
import {
  PostgreSqlRateLimitStore,
  RateLimitStoreUnavailableError,
} from "./sign-in-rate-limit-store";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

function normalizeOrigin(value: string): string | undefined {
  try {
    const parsed = new URL(value.trim());
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      return undefined;
    return parsed.origin;
  } catch {
    return undefined;
  }
}

const previewCorsOrigins = env.isProduction
  ? []
  : [env.replitDevDomain, env.replitInternalAppDomain, env.replitExpoDevDomain]
      .filter((domain): domain is string => Boolean(domain?.trim()))
      .map((domain) => `https://${domain.trim()}`);

const corsOrigins = new Set(
  ["https://tradify-signals.replit.app", ...env.corsOrigins, ...previewCorsOrigins]
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin)),
);

function createRateLimiter(windowMs: number, limit: number, store?: Store) {
  return rateLimit({
    windowMs,
    limit,
    ...(store ? { store } : {}),
    passOnStoreError: false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res
        .status(429)
        .json({ error: "RATE_LIMITED", message: "Too many requests. Try again later." });
    },
  });
}

// Customer clients poll live quotes every second. A 600/minute IP-wide limit
// starts throttling ordinary groups sharing a NAT; 1,800/minute supports the
// app's recurring traffic for 20 concurrent clients. PostgreSQL keeps this
// budget shared across API processes and restarts; auth routes retain their
// stricter, dedicated limits below.
const apiRateLimit = createRateLimiter(60_000, 1_800, new PostgreSqlRateLimitStore("api"));
const signInRateLimit = createRateLimiter(15 * 60_000, 15, new PostgreSqlRateLimitStore("sign-in"));
const registrationRateLimit = createRateLimiter(
  60 * 60_000,
  40,
  new PostgreSqlRateLimitStore("registration"),
);
const passwordResetRequestRateLimit = createRateLimiter(
  15 * 60_000,
  5,
  new PostgreSqlRateLimitStore("password-reset-request"),
);
const passwordResetCompleteRateLimit = createRateLimiter(
  15 * 60_000,
  10,
  new PostgreSqlRateLimitStore("password-reset-complete"),
);
const adminPasswordResetRateLimit = createRateLimiter(
  15 * 60_000,
  10,
  new PostgreSqlRateLimitStore("admin-password-reset"),
);
const webhookRateLimit = createRateLimiter(60_000, 120);
const productLinkPreviewRateLimit = createRateLimiter(
  60_000,
  10,
  new PostgreSqlRateLimitStore("product-link-preview"),
);
const productLinkClaimRateLimit = createRateLimiter(
  60_000,
  10,
  new PostgreSqlRateLimitStore("product-link-claim"),
);
const productLinkStatusRateLimit = createRateLimiter(
  60_000,
  60,
  new PostgreSqlRateLimitStore("product-link-status"),
);
const productLinkRevokeRateLimit = createRateLimiter(
  60_000,
  10,
  new PostgreSqlRateLimitStore("product-link-revoke"),
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  if (env.isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: sanitizeRequestPath(req.url),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(compression({ threshold: 512 }));
app.use((req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    const record =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    if (
      res.statusCode < 400 &&
      typeof record.error === "string" &&
      /^[A-Z][A-Z0-9_]+$/.test(record.error)
    ) {
      const code = record.error;
      const status =
        code.includes("NOT_FOUND") || code.endsWith("_MISSING")
          ? 404
          : code.includes("CONFLICT") || code.includes("ALREADY_")
            ? 409
            : code.includes("FORBIDDEN") ||
                code.includes("SUSPENDED") ||
                code.includes("CSRF") ||
                code.includes("NOT_AUTHORIZED")
              ? 403
              : code.includes("AUTH") || code.includes("TOKEN") || code.includes("CREDENTIAL")
                ? 401
                : code.includes("RATE_LIMIT")
                  ? 429
                  : code.includes("UNAVAILABLE")
                    ? 503
                    : 400;
      res.status(status);
    }
    if (res.statusCode >= 400) {
      const errorCode = typeof record.error === "string" ? record.error : `HTTP_${res.statusCode}`;
      const message =
        typeof record.message === "string"
          ? record.message
          : res.statusCode >= 500
            ? "The request could not be completed. Try again later."
            : "The request could not be processed.";
      return sendJson({ ...record, error: errorCode, message, requestId: req.id });
    }
    if (req.originalUrl.split("?")[0].startsWith("/api/v1/"))
      return sendJson({ success: true, data: body });
    return sendJson(body);
  }) as typeof res.json;
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      callback(null, origin === undefined || corsOrigins.has(origin));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-MT5-Bridge-Secret"],
    maxAge: 600,
    optionsSuccessStatus: 204,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(cookieParser());
app.get("/health", databaseHealthCheck);
app.get("/api/health", databaseHealthCheck);

app.use("/api", apiRateLimit);
app.use("/api/auth/sign-in", signInRateLimit);
app.use("/api/auth/admin-session", signInRateLimit);
app.use("/api/auth/register", registrationRateLimit);
app.use("/api/auth/password-reset/request", passwordResetRequestRateLimit);
app.use("/api/auth/password-reset/complete", passwordResetCompleteRateLimit);
app.use("/api/admin/users/:id/password-reset", adminPasswordResetRateLimit);
app.use("/api/billing/revenuecat/webhook", webhookRateLimit);
for (const base of ["/api/v1", "/api"]) {
  app.use(`${base}/product-links/journal/preview`, productLinkPreviewRateLimit);
  app.use(`${base}/product-links/journal/claim`, productLinkClaimRateLimit);
  app.use(`${base}/product-links/journal`, productLinkStatusRateLimit);
  app.use(`${base}/product-links/journal/revocations`, productLinkRevokeRateLimit);
  app.use(`${base}/product-links/journal/:linkId`, productLinkRevokeRateLimit);
}
app.use("/api/v1", router);
app.use("/api", router);

const rateLimitStoreErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof RateLimitStoreUnavailableError) {
    const unavailable = Object.assign(new Error("Rate limit store unavailable"), {
      status: 503,
      code: "RATE_LIMIT_UNAVAILABLE",
    });
    next(unavailable);
    return;
  }
  next(error);
};

app.use(rateLimitStoreErrorHandler);

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  res.status(404).json({ error: "NOT_FOUND", message: "The requested endpoint was not found." });
});

Sentry.setupExpressErrorHandler(app);

const internalErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 600
      ? error.status
      : 500;
  const errorCode =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : status === 500
        ? "INTERNAL_SERVER_ERROR"
        : "INVALID_REQUEST";
  if (status >= 500) {
    logger.error(
      {
        requestId: req.id,
        errorType: error instanceof Error ? error.name : typeof error,
        path: sanitizeRequestPath(req.path),
        method: req.method,
      },
      "API request failed",
    );
  }
  res.status(status).json({ error: errorCode });
};

app.use(internalErrorHandler);

export default app;
