import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const tradifySignInRateLimits = pgTable(
  "tradify_sign_in_rate_limits",
  {
    rateLimitKey: text("rate_limit_key").primaryKey(),
    totalHits: integer("total_hits").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => ({
    resetAtIdx: index("tradify_sign_in_rate_limits_reset_at_idx").on(table.resetAt),
  }),
);
