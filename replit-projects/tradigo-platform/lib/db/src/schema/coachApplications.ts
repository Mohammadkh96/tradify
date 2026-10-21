import { createInsertSchema } from "drizzle-zod";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export type CoachApplicationVerification = {
  identity?: string;
  provider?: string;
  providerReference?: string;
  hostedReviewUrl?: string;
  hostedReviewUrlExpiresAt?: string;
  lastCheckedAt?: string;
  identityDecision?: {
    decision?: string;
    responsibleParty?: string;
    recordedBy?: string;
    recordedAt?: string;
    decidedAt?: string;
    providerEventId?: string;
    basis?: string;
    source?: string;
    checks?: Record<string, string>;
    reasonCodes?: string[];
  };
};

export const tradigoCoachApplicationsTable = pgTable("tradigo_coach_applications", {
  id: text("id").primaryKey(),
  applicantId: text("applicant_id").notNull(),
  applicantName: text("applicant_name"),
  applicantEmail: text("applicant_email"),
  status: text("status").notNull().default("DRAFT"),
  currentStep: integer("current_step").notNull().default(1),
  profile: jsonb("profile").notNull().default({}),
  markets: jsonb("markets").notNull().default({}),
  experience: jsonb("experience").notNull().default({}),
  compliance: jsonb("compliance").notNull().default({}),
  verification: jsonb("verification").$type<CoachApplicationVerification>().notNull().default({}),
  reviewerNote: text("reviewer_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tradigo_coach_applications_applicant_idx").on(table.applicantId),
  index("tradigo_coach_applications_status_idx").on(table.status, table.updatedAt),
]);

export const tradigoAssessmentAttemptsTable = pgTable("tradigo_assessment_attempts", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  applicantId: text("applicant_id").notNull(),
  type: text("type").notNull(),
  version: text("version").notNull(),
  status: text("status").notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  answersReviewed: integer("answers_reviewed").notNull(),
  reviewerNote: text("reviewer_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tradigo_assessment_attempts_application_type_attempt_idx").on(table.applicationId, table.type, table.attemptNumber),
  index("tradigo_assessment_attempts_application_idx").on(table.applicationId, table.submittedAt),
]);

export const tradigoAssessmentQuestionsTable = pgTable("tradigo_assessment_questions", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  version: text("version").notNull(),
  questionText: text("question_text").notNull(),
  options: jsonb("options").notNull().default([]),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation"),
  status: text("status").notNull().default("DRAFT"),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("tradigo_assessment_questions_type_status_idx").on(table.type, table.status, table.updatedAt),
]);

export const tradigoAssessmentAnswersTable = pgTable("tradigo_assessment_answers", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull(),
  questionId: text("question_id").notNull(),
  questionVersion: text("question_version"),
  questionText: text("question_text"),
  options: jsonb("options"),
  answer: text("answer").notNull(),
  isCorrect: text("is_correct").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tradigo_assessment_answers_attempt_question_idx").on(table.attemptId, table.questionId),
]);

export const tradigoApplicationDocumentsTable = pgTable("tradigo_application_documents", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  applicantId: text("applicant_id").notNull(),
  documentType: text("document_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  issuer: text("issuer"),
  objectPath: text("object_path"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  status: text("status").notNull().default("RECEIVED"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("tradigo_application_documents_application_idx").on(table.applicationId, table.submittedAt),
]);

export const tradigoApplicationAuditTable = pgTable("tradigo_application_audit", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("tradigo_application_audit_application_idx").on(table.applicationId, table.createdAt),
]);

export const tradigoApplicationClarificationsTable = pgTable("tradigo_application_clarifications", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  applicantId: text("applicant_id").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("SUBMITTED"),
  response: text("response"),
  respondedBy: text("responded_by"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  closedBy: text("closed_by"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("tradigo_application_clarifications_application_idx").on(table.applicationId, table.createdAt),
]);

export const tradigoIdentityWebhookEventsTable = pgTable("tradigo_identity_webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  applicationId: text("application_id"),
  providerReference: text("provider_reference"),
  decision: text("decision").notNull(),
  checks: jsonb("checks").notNull().default({}),
  reasonCodes: jsonb("reason_codes").notNull().default([]),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  payloadHash: text("payload_hash").notNull(),
  status: text("status").notNull().default("RECEIVED"),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastActorId: text("last_actor_id"),
}, (table) => [
  uniqueIndex("tradigo_identity_webhook_events_provider_event_idx").on(table.provider, table.eventId),
  index("tradigo_identity_webhook_events_application_idx").on(table.applicationId, table.receivedAt),
]);

export const insertCoachApplicationSchema = createInsertSchema(tradigoCoachApplicationsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertCoachApplication = typeof insertCoachApplicationSchema["_output"];
export type CoachApplication = typeof tradigoCoachApplicationsTable.$inferSelect;
export type AssessmentAttempt = typeof tradigoAssessmentAttemptsTable.$inferSelect;
export type AssessmentQuestion = typeof tradigoAssessmentQuestionsTable.$inferSelect;
export type AssessmentAnswer = typeof tradigoAssessmentAnswersTable.$inferSelect;
export type ApplicationDocument = typeof tradigoApplicationDocumentsTable.$inferSelect;
export type ApplicationAudit = typeof tradigoApplicationAuditTable.$inferSelect;