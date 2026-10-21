import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tradigoCoachesTable = pgTable("tradigo_coaches", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  headline: text("headline").notNull(),
  bio: text("bio").notNull(),
  markets: text("markets").array().notNull(),
  specialties: text("specialties").array().notNull(),
  languages: text("languages").array().notNull(),
  yearsOfExperience: integer("years_of_experience").notNull(),
  hourlyRateCents: integer("hourly_rate_cents").notNull(),
  instantRatePerMinuteCents: integer("instant_rate_per_minute_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  verificationStatus: text("verification_status").notNull(),
  ratingAverage: integer("rating_average_tenths").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  approved: boolean("approved").notNull().default(false),
  approvalSource: text("approval_source").notNull().default("TRADIGO_MODERATION"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  identityVerifiedAt: timestamp("identity_verified_at", { withTimezone: true }),
  identityVerificationSource: text("identity_verification_source"),
  availability: text("availability").notNull().default("OFFLINE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  teachingMethod: text("teaching_method"),
  coachingBoundaries: text("coaching_boundaries"),
  pendingHeadline: text("pending_headline"),
  pendingBio: text("pending_bio"),
  pendingTeachingMethod: text("pending_teaching_method"),
  pendingCoachingBoundaries: text("pending_coaching_boundaries"),
  profileChangeStatus: text("profile_change_status").notNull().default("CURRENT"),
});

export const tradigoSessionsTable = pgTable("tradigo_sessions", {
  id: text("id").primaryKey(),
  traderId: text("trader_id").notNull(),
  coachId: text("coach_id").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes").notNull(),
  amountCents: integer("amount_cents").notNull(),
  symbol: text("symbol"),
  paymentStatus: text("payment_status").notNull(),
  paypalOrderId: text("paypal_order_id"),
  paypalAuthorizationId: text("paypal_authorization_id"),
  paypalAuthorizationStatus: text("paypal_authorization_status"),
  paypalAuthorizationExpiresAt: timestamp("paypal_authorization_expires_at", { withTimezone: true }),
  paymentApprovalUrl: text("payment_approval_url"),
  roomName: text("room_name").notNull(),
  agenda: text("agenda"),
  topic: text("topic"),
  coachingCategory: text("coaching_category").notNull().default("GENERAL_EDUCATION"),
  instrumentClass: text("instrument_class").notNull().default("GENERAL"),
  currency: text("currency").notNull().default("USD"),
  rateSnapshotCents: integer("rate_snapshot_cents").notNull().default(0),
  authorizedAmountCents: integer("authorized_amount_cents").notNull().default(0),
  finalAmountCents: integer("final_amount_cents"),
  billableSeconds: integer("billable_seconds").notNull().default(0),
  platformFeeCents: integer("platform_fee_cents").notNull().default(0),
  coachNetCents: integer("coach_net_cents").notNull().default(0),
  attendanceFinalizedAt: timestamp("attendance_finalized_at", { withTimezone: true }),
  endRequestedAt: timestamp("end_requested_at", { withTimezone: true }),
  endRequestedBy: text("end_requested_by"),
  endReason: text("end_reason"),
  cancellationReason: text("cancellation_reason"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: text("cancelled_by"),
  noShowType: text("no_show_type"),
  rescheduledFrom: timestamp("rescheduled_from", { withTimezone: true }),
  payoutStatus: text("payout_status").notNull().default("NOT_READY"),
  disputeStatus: text("dispute_status").notNull().default("NONE"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  matchGroupId: text("match_group_id"),
  coachClaimedAt: timestamp("coach_claimed_at", { withTimezone: true }),
  coachClaimExpiresAt: timestamp("coach_claim_expires_at", { withTimezone: true }),
  traderConfirmedAt: timestamp("trader_confirmed_at", { withTimezone: true }),
  traderDeclinedAt: timestamp("trader_declined_at", { withTimezone: true }),
  bookingIdempotencyKey: text("booking_idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("tradigo_sessions_trader_created_idx").on(table.traderId, table.createdAt),
  index("tradigo_sessions_coach_status_idx").on(table.coachId, table.status),
  index("tradigo_sessions_match_group_idx").on(table.matchGroupId, table.status),
  uniqueIndex("tradigo_sessions_booking_idempotency_key_idx").on(table.bookingIdempotencyKey),
]);

export const tradigoSessionEventsTable = pgTable("tradigo_session_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  actorId: text("actor_id").notNull(),
  recipientId: text("recipient_id"),
  eventType: text("event_type").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("tradigo_session_events_session_created_idx").on(table.sessionId, table.createdAt),
]);

export const tradigoRateSnapshotsTable = pgTable("tradigo_rate_snapshots", {
  id: text("id").primaryKey(), sessionId: text("session_id").notNull(), coachId: text("coach_id").notNull(), rateCents: integer("rate_cents").notNull(), currency: text("currency").notNull(), policy: jsonb("policy").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradigoLearningRecordsTable = pgTable("tradigo_learning_records", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  traderId: text("trader_id").notNull(),
  coachId: text("coach_id").notNull(),
  learningGoal: text("learning_goal").notNull(),
  conceptsReviewed: text("concepts_reviewed"),
  evidenceDiscussed: text("evidence_discussed"),
  sharedArtifact: text("shared_artifact"),
  unresolvedQuestions: text("unresolved_questions"),
  practiceSteps: text("practice_steps"),
  traderReflection: text("trader_reflection"),
  status: text("status").notNull().default("GOAL_SET"),
  coachCompletedAt: timestamp("coach_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const tradigoPaymentIntentsTable = pgTable("tradigo_payment_intents", {
  id: text("id").primaryKey(), sessionId: text("session_id").notNull(), provider: text("provider").notNull(), providerReference: text("provider_reference"), kind: text("kind").notNull(), amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull(), status: text("status").notNull(), idempotencyKey: text("idempotency_key").notNull().unique(), details: jsonb("details").notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const tradigoAttendanceEventsTable = pgTable("tradigo_attendance_events", {
  id: text("id").primaryKey(), sessionId: text("session_id").notNull(), participantId: text("participant_id").notNull(), eventType: text("event_type").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(), source: text("source").notNull(), idempotencyKey: text("idempotency_key").notNull().unique(), details: jsonb("details").notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const tradigoLedgerEntriesTable = pgTable("tradigo_ledger_entries", {
  id: text("id").primaryKey(), sessionId: text("session_id").notNull(), entryType: text("entry_type").notNull(), account: text("account").notNull(), amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull(), idempotencyKey: text("idempotency_key").notNull().unique(), details: jsonb("details").notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const tradigoReviewsTable = pgTable("tradigo_reviews", {
  id: text("id").primaryKey(), sessionId: text("session_id").notNull().unique(), traderId: text("trader_id").notNull(), coachId: text("coach_id").notNull(), rating: integer("rating").notNull(), comment: text("comment"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const tradigoDisputesTable = pgTable("tradigo_disputes", {
  id: text("id").primaryKey(), sessionId: text("session_id").notNull(), openedBy: text("opened_by").notNull(), reason: text("reason").notNull(), status: text("status").notNull().default("OPEN"), resolution: text("resolution"), resolvedBy: text("resolved_by"), resolvedAt: timestamp("resolved_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const tradigoConductReportsTable = pgTable("tradigo_conduct_reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  subjectUserId: text("subject_user_id").notNull(),
  sessionId: text("session_id"),
  reason: text("reason").notNull(),
  details: text("details").notNull().default(""),
  evidenceReference: text("evidence_reference"),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull().default("OPEN"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tradigo_conduct_reports_idempotency_key_idx").on(table.idempotencyKey),
  index("tradigo_conduct_reports_queue_idx").on(table.status, table.createdAt),
]);
export const tradigoCoachPayoutAccountsTable = pgTable("tradigo_coach_payout_accounts", {
  coachId: text("coach_id").primaryKey(),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("NOT_STARTED"),
  providerAccountId: text("provider_account_id"),
  onboardingReference: text("onboarding_reference"),
  onboardingUrl: text("onboarding_url"),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  ownershipVerifiedAt: timestamp("ownership_verified_at", { withTimezone: true }),
  ownershipVerificationSource: text("ownership_verification_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const tradigoPayoutsTable = pgTable("tradigo_payouts", {
  id: text("id").primaryKey(), sessionId: text("session_id").notNull().unique(), coachId: text("coach_id").notNull(), amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull(), status: text("status").notNull(), providerReference: text("provider_reference"), providerBatchId: text("provider_batch_id"), providerItemId: text("provider_item_id"), holdUntil: timestamp("hold_until", { withTimezone: true }), eligibleAt: timestamp("eligible_at", { withTimezone: true }), attemptCount: integer("attempt_count").notNull().default(0), nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }), lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }), failureCode: text("failure_code"), failureMessage: text("failure_message"), retryable: boolean("retryable").notNull().default(true), reversedAt: timestamp("reversed_at", { withTimezone: true }), reversalReason: text("reversal_reason"), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const tradigoPaymentWebhookEventsTable = pgTable("tradigo_payment_webhook_events", {
  id: text("id").primaryKey(), eventId: text("event_id").notNull().unique(), eventType: text("event_type").notNull(), resourceId: text("resource_id"), sessionId: text("session_id"), status: text("status").notNull(), error: text("error"), payload: jsonb("payload").notNull().default({}), receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(), processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [
  index("tradigo_payment_webhook_events_status_idx").on(table.status, table.receivedAt),
  index("tradigo_payment_webhook_events_session_idx").on(table.sessionId, table.receivedAt),
]);

export const tradigoCoachAvailabilityRulesTable = pgTable("tradigo_coach_availability_rules", {
  id: text("id").primaryKey(), coachId: text("coach_id").notNull(), weekday: integer("weekday").notNull(),
  startMinute: integer("start_minute").notNull(), endMinute: integer("end_minute").notNull(), timezone: text("timezone").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("tradigo_coach_availability_rules_unique_idx").on(table.coachId, table.weekday, table.startMinute, table.endMinute)]);

export const tradigoCoachAvailabilityExceptionsTable = pgTable("tradigo_coach_availability_exceptions", {
  id: text("id").primaryKey(), coachId: text("coach_id").notNull(), startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(), kind: text("kind").notNull().default("BLACKOUT"), note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradigoSessionPolicyDecisionsTable = pgTable("tradigo_session_policy_decisions", {
  id: text("id").primaryKey(), sessionId: text("session_id").notNull().unique(), policyVersion: text("policy_version").notNull(),
  countryCode: text("country_code").notNull(), coachingCategory: text("coaching_category").notNull(), instrumentClass: text("instrument_class").notNull(),
  decision: text("decision").notNull(), reasonCodes: text("reason_codes").array().notNull().default([]), source: text("source").notNull(),
  recordedBy: text("recorded_by").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradigoMarketplaceEventsTable = pgTable("tradigo_marketplace_events", {
  id: text("id").primaryKey(), eventKey: text("event_key").notNull().unique(), eventType: text("event_type").notNull(),
  sessionId: text("session_id"), actorId: text("actor_id").notNull(), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  details: jsonb("details").notNull().default({}),
}, (table) => [
  index("tradigo_marketplace_events_type_time_idx").on(table.eventType, table.occurredAt),
  index("tradigo_marketplace_events_session_time_idx").on(table.sessionId, table.occurredAt),
]);