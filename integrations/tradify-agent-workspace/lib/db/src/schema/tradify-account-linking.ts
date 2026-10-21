import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// These records deliberately do not cascade from tradify_users. Account
// deletion must preserve an unsent revocation and its minimal tombstone.
export const tradifyLinkSubjects = pgTable(
  "tradify_link_subjects",
  {
    userId: text("user_id").primaryKey(),
    subject: text("subject").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    subjectUnique: uniqueIndex("tradify_link_subject_subject_idx").on(table.subject),
  }),
);

export const tradifyLinkAttempts = pgTable(
  "tradify_link_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    codeHash: text("code_hash").notNull(),
    journalAttemptLabel: text("journal_attempt_label").notNull(),
    signalsAttemptLabel: text("signals_attempt_label").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    state: text("state").notNull().default("PREVIEWED"),
    consentId: text("consent_id"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    claimJti: text("claim_jti"),
    claimIssuedAt: timestamp("claim_issued_at", { withTimezone: true }),
    partnerLinkId: text("partner_link_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeHashUnique: uniqueIndex("tradify_link_attempt_code_hash_idx").on(table.codeHash),
    userCreatedIdx: index("tradify_link_attempt_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export const tradifyLinkConsents = pgTable(
  "tradify_link_consents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    attemptId: text("attempt_id").notNull(),
    contractVersion: text("contract_version").notNull(),
    consentVersion: text("consent_version").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    journalAttemptLabel: text("journal_attempt_label").notNull(),
    signalsAttemptLabel: text("signals_attempt_label").notNull(),
  },
  (table) => ({
    attemptUnique: uniqueIndex("tradify_link_consent_attempt_idx").on(table.attemptId),
    userConsentIdx: index("tradify_link_consent_user_time_idx").on(table.userId, table.consentAt),
  }),
);

export const tradifyProductLinks = pgTable(
  "tradify_product_links",
  {
    linkId: text("link_id").primaryKey(),
    userId: text("user_id").notNull(),
    partnerIssuer: text("partner_issuer").notNull(),
    signalsAttemptLabel: text("signals_attempt_label").notNull(),
    journalAttemptLabel: text("journal_attempt_label").notNull(),
    state: text("state").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    oneCurrentLinkPerAccount: uniqueIndex("tradify_product_link_user_current_idx")
      .on(table.userId)
      .where(sql`${table.state} in ('awaiting_journal_confirmation', 'active', 'revocation_pending')`),
    accountStateIdx: index("tradify_product_link_user_state_idx").on(table.userId, table.state),
  }),
);

export const tradifyLinkAssertionReplays = pgTable(
  "tradify_link_assertion_replays",
  {
    issuer: text("issuer").notNull(),
    audience: text("audience").notNull(),
    jti: text("jti").notNull(),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    replayKey: uniqueIndex("tradify_link_assertion_replay_key_idx").on(
      table.issuer,
      table.audience,
      table.jti,
    ),
  }),
);

export const tradifyLinkRevocationOutbox = pgTable(
  "tradify_link_revocation_outbox",
  {
    eventId: text("event_id").primaryKey(),
    linkId: text("link_id").notNull(),
    userId: text("user_id").notNull(),
    reason: text("reason").notNull(),
    canonicalPayload: text("canonical_payload").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    acknowledgedEventId: text("acknowledged_event_id"),
    acknowledgedPayloadSha256: text("acknowledged_payload_sha256"),
    state: text("state").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dueIdx: index("tradify_link_revocation_due_idx").on(table.state, table.nextAttemptAt),
  }),
);

export const tradifyLinkRevocationInbox = pgTable(
  "tradify_link_revocation_inbox",
  {
    eventId: text("event_id").primaryKey(),
    linkId: text("link_id").notNull(),
    reason: text("reason").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const tradifyLinkRevocationMismatches = pgTable(
  "tradify_link_revocation_mismatches",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    storedPayloadSha256: text("stored_payload_sha256").notNull(),
    conflictingPayloadSha256: text("conflicting_payload_sha256").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventIdx: index("tradify_link_revocation_mismatch_event_idx").on(table.eventId, table.recordedAt),
  }),
);
