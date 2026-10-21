import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  index,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export * from "./tradify-market-data";
export * from "./tradify-control-plane";
export * from "./tradify-access-policy";
export * from "./tradify-rate-limit";
export * from "./tradify-account-linking";

export const tradifyUsers = pgTable("tradify_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  accountSize: real("account_size").notNull(),
  riskPercent: real("risk_percent").notNull(),
  maxDailyLoss: real("max_daily_loss").notNull(),
  maxTrades: integer("max_trades").notNull(),
  aggressive: boolean("aggressive").notNull(),
  membership: text("membership").notNull(),
  membershipSource: text("membership_source").notNull().default("UNKNOWN"),
  subscriptionStatus: text("subscription_status"),
  billingExpiresAt: text("billing_expires_at"),
  billingWillRenew: boolean("billing_will_renew").notNull().default(false),
  billingEventId: text("billing_event_id"),
  billingEventTimestamp: text("billing_event_timestamp"),
  trialEndsAt: text("trial_ends_at"),
  overrideEndsAt: text("override_ends_at"),
  role: text("role").notNull(),
  status: text("status").notNull(),
  riskDisclaimerVersion: text("risk_disclaimer_version"),
  riskDisclaimerAcceptedAt: text("risk_disclaimer_accepted_at"),
  entitlements: jsonb("entitlements").$type<string[]>().notNull(),
  entitlementGrants: jsonb("entitlement_grants").$type<string[]>(),
  entitlementDenies: jsonb("entitlement_denies").$type<string[]>(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  authInvalidBefore: text("auth_invalid_before"),
  deletedAt: text("deleted_at"),
  adminUpdatedBy: text("admin_updated_by"),
  adminUpdatedAt: text("admin_updated_at"),
  watchlist: jsonb("watchlist")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  alertSymbols: jsonb("alert_symbols")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  alerts: jsonb("alerts")
    .$type<Array<Record<string, unknown>>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  notifications: jsonb("notifications")
    .$type<Array<Record<string, unknown>>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  trades: jsonb("trades")
    .$type<Array<Record<string, unknown>>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  version: integer("version").notNull().default(1),
});

export const tradifySignalLifecycleStates = pgTable("tradify_signal_lifecycle_states", {
  signalId: text("signal_id").primaryKey(),
  strategyVersion: text("strategy_version").notNull(),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  lastMarketDataAt: timestamp("last_market_data_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradifySignalLifecycleEvents = pgTable(
  "tradify_signal_lifecycle_events",
  {
    id: text("id").primaryKey(),
    signalId: text("signal_id")
      .notNull()
      .references(() => tradifySignalLifecycleStates.signalId, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    price: real("price"),
    strategyVersion: text("strategy_version").notNull(),
    symbol: text("symbol").notNull(),
    sourceEvaluationId: text("source_evaluation_id").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    signalTimeIdx: index("tradify_signal_lifecycle_events_signal_time_idx").on(
      table.signalId,
      table.occurredAt,
    ),
    sourceEvaluationIdx: index("tradify_signal_lifecycle_events_evaluation_idx").on(
      table.sourceEvaluationId,
    ),
  }),
);

export const tradifyNotificationPreferences = pgTable("tradify_notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => tradifyUsers.id, { onDelete: "cascade" }),
  categories: jsonb("categories")
    .$type<Record<string, boolean>>()
    .notNull()
    .default(
      sql`'{"newSignals":false,"entries":false,"takeProfits":false,"stopLosses":false,"breakevenAndChanges":false,"watchlistPriceAlerts":false,"announcements":false}'::jsonb`,
    ),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradifyUserNotifications = pgTable(
  "tradify_user_notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => tradifyUsers.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => tradifySignalLifecycleEvents.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userEventUnique: uniqueIndex("tradify_user_notifications_user_event_idx").on(
      table.userId,
      table.eventId,
    ),
    userCreatedIdx: index("tradify_user_notifications_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const tradifyWebPushSubscriptions = pgTable(
  "tradify_web_push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => tradifyUsers.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    endpointHash: text("endpoint_hash").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    expirationTime: timestamp("expiration_time", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userLookupIdx: index("tradify_web_push_subscriptions_user_idx").on(table.userId),
  }),
);

export const tradifyExpoPushSubscriptions = pgTable(
  "tradify_expo_push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => tradifyUsers.id, { onDelete: "cascade" }),
    pushToken: text("push_token").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    platform: text("platform").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userLookupIdx: index("tradify_expo_push_subscriptions_user_idx").on(table.userId),
  }),
);

export const tradifyWebPushDeliveries = pgTable(
  "tradify_web_push_deliveries",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => tradifyUserNotifications.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => tradifyWebPushSubscriptions.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("QUEUED"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '24 hours'`),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    notificationSubscriptionUnique: uniqueIndex("tradify_web_push_delivery_pair_idx").on(
      table.notificationId,
      table.subscriptionId,
    ),
    queueIdx: index("tradify_web_push_delivery_queue_idx").on(table.status, table.nextAttemptAt),
    expiryIdx: index("tradify_web_push_delivery_expiry_idx").on(table.status, table.expiresAt),
  }),
);

export const tradifyExpoPushDeliveries = pgTable(
  "tradify_expo_push_deliveries",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => tradifyUserNotifications.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => tradifyExpoPushSubscriptions.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("QUEUED"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    expoTicketId: text("expo_ticket_id"),
    receiptStatus: text("receipt_status"),
    receiptError: text("receipt_error"),
    receiptCheckedAt: timestamp("receipt_checked_at", { withTimezone: true }),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    notificationSubscriptionUnique: uniqueIndex("tradify_expo_push_delivery_pair_idx").on(
      table.notificationId,
      table.subscriptionId,
    ),
    queueIdx: index("tradify_expo_push_delivery_queue_idx").on(table.status, table.nextAttemptAt),
    receiptIdx: index("tradify_expo_push_delivery_receipt_idx").on(
      table.status,
      table.receiptCheckedAt,
    ),
  }),
);

export const tradifyPasswordResetTokens = pgTable(
  "tradify_password_reset_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => tradifyUsers.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
  },
  (table) => ({
    userIdIdx: index("tradify_password_reset_tokens_user_id_idx").on(table.userId),
    expiresAtIdx: index("tradify_password_reset_tokens_expires_at_idx").on(table.expiresAt),
  }),
);

export const tradifyAccountDeletionRequests = pgTable(
  "tradify_account_deletion_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    email: text("email"),
    status: text("status").notNull(),
    source: text("source").notNull(),
    requestedAt: text("requested_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => ({
    requestedAtIdx: index("tradify_account_deletion_requests_requested_at_idx").on(
      table.requestedAt,
    ),
    userIdIdx: index("tradify_account_deletion_requests_user_id_idx").on(table.userId),
  }),
);

export const tradifyEngineState = pgTable("tradify_engine_state", {
  key: text("key").primaryKey(),
  mode: text("mode").notNull(),
  reason: text("reason"),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
  version: integer("version").notNull().default(1),
});

export const tradifyAdminAuditEvents = pgTable(
  "tradify_admin_audit_events",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    targetUserId: text("target_user_id"),
    targetEmail: text("target_email"),
    details: jsonb("details").$type<unknown>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdAtIdx: index("tradify_admin_audit_created_at_idx").on(table.createdAt),
    transferFailureCategoryIdx: index("tradify_admin_audit_transfer_failure_category_idx").on(
      table.actorId,
      table.action,
      sql`(${table.details} ->> 'failureCategory')`,
      table.createdAt,
    ),
  }),
);

export const tradifyRevenueCatTransfers = pgTable(
  "tradify_revenuecat_transfers",
  {
    eventId: text("event_id").primaryKey(),
    eventTimestampMs: text("event_timestamp_ms"),
    previousAppUserIds: jsonb("previous_app_user_ids").$type<string[]>().notNull(),
    destinationAppUserIds: jsonb("destination_app_user_ids").$type<string[]>().notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => ({
    expiresAtIdx: index("tradify_revenuecat_transfers_expires_at_idx").on(table.expiresAt),
  }),
);

export const tradifyOperationalAlertWindows = pgTable("tradify_operational_alert_windows", {
  alertKey: text("alert_key").primaryKey(),
  lastAlertAt: text("last_alert_at").notNull(),
});

export const tradifyMarketProviders = pgTable(
  "tradify_market_providers",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    approval: text("approval").notNull(),
    priority: integer("priority").notNull().default(100),
    enabled: boolean("enabled").notNull().default(true),
    capabilities: jsonb("capabilities")
      .$type<unknown>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    roleApprovalIdx: index("tradify_market_providers_role_approval_idx").on(
      table.role,
      table.approval,
    ),
  }),
);

export const tradifyMarketProviderApprovals = pgTable(
  "tradify_market_provider_approvals",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    canonicalSymbol: text("canonical_symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    strategyId: text("strategy_id").notNull(),
    approval: text("approval").notNull(),
    reason: text("reason"),
    evidence: jsonb("evidence")
      .$type<unknown>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    contextIdx: index("tradify_market_provider_approvals_context_idx").on(
      table.providerId,
      table.canonicalSymbol,
      table.timeframe,
      table.strategyId,
    ),
  }),
);

export const tradifyMarketAuthorityDecisions = pgTable(
  "tradify_market_authority_decisions",
  {
    contextKey: text("context_key").primaryKey(),
    canonicalSymbol: text("canonical_symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    strategyId: text("strategy_id").notNull(),
    providerId: text("provider_id"),
    reason: text("reason").notNull(),
    evidence: jsonb("evidence")
      .$type<unknown>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    contextIdx: index("tradify_market_authority_decisions_context_idx").on(
      table.canonicalSymbol,
      table.timeframe,
      table.strategyId,
    ),
  }),
);

export const tradifyMarketAuthorityTransitions = pgTable(
  "tradify_market_authority_transitions",
  {
    id: text("id").primaryKey(),
    contextKey: text("context_key").notNull(),
    canonicalSymbol: text("canonical_symbol").notNull(),
    timeframe: text("timeframe").notNull(),
    strategyId: text("strategy_id").notNull(),
    previousProviderId: text("previous_provider_id"),
    nextProviderId: text("next_provider_id"),
    reason: text("reason").notNull(),
    healthEvidence: jsonb("health_evidence")
      .$type<unknown>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    contextCreatedIdx: index("tradify_market_authority_transitions_context_created_idx").on(
      table.contextKey,
      table.createdAt,
    ),
  }),
);
