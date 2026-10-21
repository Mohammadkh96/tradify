import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tradigoUsersTable = pgTable("tradigo_users", {
  id: text("id").primaryKey(),
  firebaseUid: text("firebase_uid").notNull(),
  email: text("email").notNull(),
  emailNormalized: text("email_normalized"),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  localSessionVersion: integer("local_session_version").notNull().default(0),
  consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true }),
  consentVersion: text("consent_version"),
  role: text("role").notNull().default("TRADER"),
  status: text("status").notNull().default("ACTIVE"),
  countryCode: text("country_code").notNull().default("US"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tradigo_users_firebase_uid_idx").on(table.firebaseUid),
  uniqueIndex("tradigo_users_email_normalized_idx").on(table.emailNormalized),
  index("tradigo_users_role_status_idx").on(table.role, table.status),
]);

export const tradigoAuthTokensTable = pgTable("tradigo_auth_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  tokenKind: text("token_kind").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tradigo_auth_tokens_hash_idx").on(table.tokenHash),
  index("tradigo_auth_tokens_user_kind_idx").on(table.userId, table.tokenKind, table.createdAt),
  uniqueIndex("tradigo_auth_tokens_one_active_idx")
    .on(table.userId, table.tokenKind)
    .where(sql`${table.activatedAt} IS NOT NULL AND ${table.consumedAt} IS NULL`),
]);

export const tradigoAuthEmailOutboxTable = pgTable("tradigo_auth_email_outbox", {
  id: text("id").primaryKey(),
  tokenId: text("token_id").notNull(),
  userId: text("user_id").notNull(),
  emailKind: text("email_kind").notNull(),
  recipient: text("recipient").notNull(),
  recipientName: text("recipient_name").notNull(),
  encryptedToken: text("encrypted_token").notNull(),
  actionBaseUrl: text("action_base_url").notNull(),
  expiresInHours: integer("expires_in_hours").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("tradigo_auth_email_outbox_pending_idx")
    .on(table.nextAttemptAt, table.createdAt)
    .where(sql`${table.sentAt} IS NULL`),
]);

export const tradigoTraderProfilesTable = pgTable("tradigo_trader_profiles", {
  userId: text("user_id").primaryKey(),
  experienceLevel: text("experience_level").notNull().default("BEGINNER"),
  preferredMarkets: text("preferred_markets").array().notNull().default([]),
  instruments: text("instruments").array().notNull().default([]),
  tradingStyles: text("trading_styles").array().notNull().default([]),
  methodologies: text("methodologies").array().notNull().default([]),
  timezone: text("timezone"),
  onboardingCurrentStep: integer("onboarding_current_step").notNull().default(1),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  totalSessionsCompleted: integer("total_sessions_completed").notNull().default(0),
  totalSpentCents: integer("total_spent_cents").notNull().default(0),
  blockedCoachIds: text("blocked_coach_ids").array().notNull().default([]),
  preferences: jsonb("preferences").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradigoFavoritesTable = pgTable("tradigo_favorites", {
  traderId: text("trader_id").notNull(),
  coachId: text("coach_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tradigo_favorites_trader_coach_idx").on(table.traderId, table.coachId),
  index("tradigo_favorites_trader_idx").on(table.traderId, table.createdAt),
]);

export const tradigoNotificationStatesTable = pgTable("tradigo_notification_states", {
  userId: text("user_id").notNull(),
  eventId: integer("event_id").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("tradigo_notification_states_user_event_idx").on(table.userId, table.eventId),
  index("tradigo_notification_states_user_read_idx").on(table.userId, table.readAt),
]);