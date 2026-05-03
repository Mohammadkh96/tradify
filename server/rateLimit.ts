/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Suitable for a SINGLE Node process. For horizontally-scaled deployments
 * you must replace the in-memory Map with Redis (or a Postgres-backed
 * store) — otherwise each instance has its own counter and an attacker
 * can hit you N times harder by load-balancing across N instances.
 *
 * Usage:
 *   app.post("/api/auth/login", rateLimit({ windowMs: 60_000, max: 10 }), handler)
 */
import type { Request, Response, NextFunction } from "express";

// Each entry is a wrapper object so identity is unique even when two requests
// arrive in the same millisecond. `pending` lets us tell whether the request
// finished successfully (and thus should be removed when skipSuccessful=true).
type Entry = { ts: number };
type Bucket = Entry[];

interface Options {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
  /** Pull a key from the request — defaults to IP. */
  key?: (req: Request) => string;
  /** Don't count successful responses (status < 400). Useful for login. */
  skipSuccessful?: boolean;
}

const stores = new Map<string, Map<string, Bucket>>();

function getStore(prefix: string): Map<string, Bucket> {
  let s = stores.get(prefix);
  if (!s) {
    s = new Map();
    stores.set(prefix, s);
  }
  return s;
}

// Periodic global janitor — bounds memory growth across all limiters.
setInterval(() => {
  const now = Date.now();
  for (const [, store] of stores) {
    for (const [k, bucket] of store) {
      const last = bucket.length ? bucket[bucket.length - 1].ts : 0;
      if (bucket.length === 0 || now - last > 60 * 60_000) {
        store.delete(k);
      }
    }
    // Hard cap to prevent runaway: drop oldest 10% if we exceed 50k keys
    if (store.size > 50_000) {
      const drop = Math.ceil(store.size * 0.1);
      const it = store.keys();
      for (let i = 0; i < drop; i++) {
        const r = it.next();
        if (r.done) break;
        store.delete(r.value);
      }
    }
  }
}, 5 * 60_000).unref();

// SECURITY: never trust raw X-Forwarded-For. Use Express's `req.ip` which
// honors the configured trust-proxy policy (set in routes.ts as `trust proxy: 1`
// in production). Behind an unknown proxy chain, an attacker can rotate spoofed
// XFF values and bypass rate limits — `req.ip` prevents that as long as
// trust-proxy is correctly configured for the deployment topology.
function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function rateLimit(opts: Options) {
  const {
    windowMs,
    max,
    keyPrefix = "default",
    message = "Too many requests. Try again later.",
    key = clientIp,
    skipSuccessful = false,
  } = opts;
  const store = getStore(keyPrefix);

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const k = key(req);
    const now = Date.now();
    const cutoff = now - windowMs;
    let bucket = store.get(k);
    if (!bucket) {
      bucket = [];
      store.set(k, bucket);
    }
    // Drop expired entries
    while (bucket.length > 0 && bucket[0].ts < cutoff) bucket.shift();

    if (bucket.length >= max) {
      const retrySec = Math.ceil((bucket[0].ts + windowMs - now) / 1000);
      res.setHeader("Retry-After", String(retrySec));
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((bucket[0].ts + windowMs) / 1000)));
      return res.status(429).json({ message, retryAfterSeconds: retrySec });
    }

    // Each entry is a unique wrapper object so we can remove THIS exact entry
    // by reference identity on finish (parallel requests share the same Date.now()
    // and would collide if we tried indexOf-by-timestamp).
    const entry: Entry = { ts: now };
    bucket.push(entry);

    if (skipSuccessful) {
      res.on("finish", () => {
        if (res.statusCode < 400) {
          const i = bucket.indexOf(entry);
          if (i !== -1) bucket.splice(i, 1);
        }
      });
    }

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.length)));
    next();
  };
}

// Pre-baked limiters used across the app.
// IP-based; tune limits per real production traffic.
export const authLimiter = rateLimit({
  keyPrefix: "auth",
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,                  // 20 attempts / IP / 15 min
  message: "Too many authentication attempts. Try again in a few minutes.",
  skipSuccessful: true,     // successful logins shouldn't count
});

export const passwordResetLimiter = rateLimit({
  keyPrefix: "pwreset",
  windowMs: 60 * 60 * 1000, // 1 hr
  max: 5,
  message: "Too many password reset attempts. Try again later.",
});

export const aiLimiter = rateLimit({
  keyPrefix: "ai",
  windowMs: 60 * 1000,
  max: 30, // 30 AI calls/min/IP — protects OpenAI spend
  message: "Too many AI requests. Pace yourself.",
});

export const uploadLimiter = rateLimit({
  keyPrefix: "upload",
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many uploads. Try again in a minute.",
});

export const earlyAccessLimiter = rateLimit({
  keyPrefix: "earlyaccess",
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many signups from this address. Try again later.",
});
