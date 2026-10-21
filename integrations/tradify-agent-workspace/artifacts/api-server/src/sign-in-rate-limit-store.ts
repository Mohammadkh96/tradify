import { createHash } from "node:crypto";
import type { Options, Store } from "express-rate-limit";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";

type RateLimitRow = {
  total_hits: number;
  reset_at: Date;
};

export type RateLimitScope =
  | "api"
  | "sign-in"
  | "registration"
  | "password-reset-request"
  | "password-reset-complete"
  | "admin-password-reset"
  | "product-link-preview"
  | "product-link-claim"
  | "product-link-status"
  | "product-link-revoke"
  | "ai-commentary";

export class RateLimitStoreUnavailableError extends Error {
  constructor() {
    super("Rate-limit store is unavailable");
    this.name = "RateLimitStoreUnavailableError";
  }
}

export class PostgreSqlRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private readonly keyNamespace: string;
  private windowMs = 15 * 60_000;
  private lastCleanupAt = 0;
  private cleanupPending: Promise<void> | undefined;

  constructor(scope: RateLimitScope) {
    this.prefix = `tradify-${scope}:`;
    this.keyNamespace =
      scope === "sign-in"
        ? "tradify-sign-in-rate-limit:v1:"
        : scope === "api"
          ? "tradify-api-rate-limit:v1:"
          : `tradify-auth-rate-limit:v1:${scope}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string) {
    const rateLimitKey = this.hashKey(key);
    let result;
    try {
      result = await pool.query<RateLimitRow>(
        `INSERT INTO tradify_sign_in_rate_limits (rate_limit_key, total_hits, reset_at)
         VALUES ($1, 1, NOW() + ($2::double precision * INTERVAL '1 millisecond'))
         ON CONFLICT (rate_limit_key) DO UPDATE
         SET total_hits = CASE
               WHEN tradify_sign_in_rate_limits.reset_at <= NOW() THEN 1
               ELSE tradify_sign_in_rate_limits.total_hits + 1
             END,
             reset_at = CASE
               WHEN tradify_sign_in_rate_limits.reset_at <= NOW()
                 THEN NOW() + ($2::double precision * INTERVAL '1 millisecond')
               ELSE tradify_sign_in_rate_limits.reset_at
             END
         RETURNING total_hits, reset_at`,
        [rateLimitKey, this.windowMs],
      );
    } catch {
      throw new RateLimitStoreUnavailableError();
    }
    const row = result.rows[0];
    if (!row) throw new RateLimitStoreUnavailableError();

    this.scheduleExpiredCounterCleanup();
    return {
      totalHits: row.total_hits,
      resetTime: row.reset_at,
    };
  }

  async get(key: string) {
    const result = await pool.query<RateLimitRow>(
      `SELECT total_hits, reset_at
       FROM tradify_sign_in_rate_limits
       WHERE rate_limit_key = $1 AND reset_at > NOW()`,
      [this.hashKey(key)],
    );
    const row = result.rows[0];
    return row ? { totalHits: row.total_hits, resetTime: row.reset_at } : undefined;
  }

  async decrement(key: string): Promise<void> {
    await pool.query(
      `UPDATE tradify_sign_in_rate_limits
       SET total_hits = GREATEST(total_hits - 1, 0)
       WHERE rate_limit_key = $1`,
      [this.hashKey(key)],
    );
  }

  async resetKey(key: string): Promise<void> {
    await pool.query("DELETE FROM tradify_sign_in_rate_limits WHERE rate_limit_key = $1", [
      this.hashKey(key),
    ]);
  }

  private hashKey(key: string): string {
    return createHash("sha256").update(`${this.keyNamespace}${key}`).digest("hex");
  }

  private scheduleExpiredCounterCleanup(): void {
    if (this.cleanupPending || Date.now() - this.lastCleanupAt < 60_000) return;
    this.lastCleanupAt = Date.now();
    this.cleanupPending = pool
      .query("DELETE FROM tradify_sign_in_rate_limits WHERE reset_at <= NOW()")
      .then(() => undefined)
      .catch((error: unknown) => {
        this.lastCleanupAt = 0;
        logger.warn({ err: error }, "Unable to prune expired sign-in rate-limit counters");
      })
      .finally(() => {
        this.cleanupPending = undefined;
      });
  }
}
