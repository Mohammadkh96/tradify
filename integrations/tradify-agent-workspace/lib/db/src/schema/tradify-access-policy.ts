import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const tradifyAccessPolicies = pgTable("tradify_access_policies", {
  key: text("key").primaryKey(),
  policy: jsonb("policy").$type<Record<string, unknown>>().notNull(),
  rowVersion: integer("row_version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

export type TradifyAccessPolicy = typeof tradifyAccessPolicies.$inferSelect;
