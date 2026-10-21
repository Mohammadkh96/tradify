import { createHash, randomUUID } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { pool } from "@workspace/db";
import { ensureIdentitySchema, getApplicationIdentity, getModeratorIdentity } from "./tradigo";
import { processIdentityWebhookEvent } from "./identityProviderWebhook";
import { verifyApplicationUpload } from "./applicationStorage";
import { ensureSchedulingSchema } from "../lib/tradigoScheduling";

const router: IRouter = Router();
const ASSESSMENT_VERSION = "v1.0";
const PASSING_SCORE = 4;
const DOCUMENT_TYPES = ["CERTIFICATE", "TEACHING_SAMPLE", "PROFESSIONAL_PROFILE", "OTHER"] as const;

type AssessmentType = "KNOWLEDGE" | "SAFETY";
const IDENTITY_DECISIONS = ["VERIFIED", "DECLINED", "PENDING", "EXPIRED", "UNAVAILABLE"] as const;
const IDENTITY_CHECK_KEYS = ["documentNameMatch", "documentValidity", "liveness", "sanctionsScreening"] as const;
const IDENTITY_CHECK_VALUES = ["PASS", "FAIL", "REVIEW", "NOT_CHECKED"] as const;

type Question = {
  id: string;
  type?: AssessmentType;
  version?: string;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
};

const assessmentBank: Record<AssessmentType, Question[]> = {
  KNOWLEDGE: [
    { id: "knowledge-1", text: "What should a coach do when a learner asks whether they should buy or sell an instrument?", options: ["Give a direct recommendation", "Explain educational concepts and ask the learner to make their own decision", "Place the trade for them", "Share a guaranteed setup"], correctAnswer: "Explain educational concepts and ask the learner to make their own decision" },
    { id: "knowledge-2", text: "Which statement best describes sound risk education?", options: ["Risk can be eliminated with the right strategy", "A coach should promise a target return", "A learner should understand uncertainty, position sizing, and possible loss", "Only winning trades should be reviewed"], correctAnswer: "A learner should understand uncertainty, position sizing, and possible loss" },
    { id: "knowledge-3", text: "What is the most useful purpose of a trading journal?", options: ["To prove a coach is always right", "To record decisions and review process quality over time", "To guarantee future profits", "To replace a risk plan"], correctAnswer: "To record decisions and review process quality over time" },
    { id: "knowledge-4", text: "When discussing a chart during education, the coach should primarily focus on:", options: ["A guaranteed entry price", "The learner’s reasoning, assumptions, and review process", "Copying the coach’s position", "A private signal"], correctAnswer: "The learner’s reasoning, assumptions, and review process" },
    { id: "knowledge-5", text: "What should a coach say about past performance?", options: ["It proves future results", "It is irrelevant to every discussion", "It can be discussed with context and without promising future outcomes", "It should be hidden from learners"], correctAnswer: "It can be discussed with context and without promising future outcomes" },
  ],
  SAFETY: [
    { id: "safety-1", text: "A learner offers a password so you can place a trade. What is the correct response?", options: ["Accept it for convenience", "Store it in a private note", "Refuse access and explain that coaching never requires credentials", "Ask for a screenshot of the password"], correctAnswer: "Refuse access and explain that coaching never requires credentials" },
    { id: "safety-2", text: "A learner asks for a signal during a paid session. What should you do?", options: ["Send the signal privately", "Reframe the request into education about analysis and decision-making", "Promise the next trade will win", "Execute the trade yourself"], correctAnswer: "Reframe the request into education about analysis and decision-making" },
    { id: "safety-3", text: "Which activity is outside Tradigo’s coaching boundaries?", options: ["Reviewing a learner’s journal", "Explaining a chart concept", "Managing or controlling a learner’s brokerage account", "Discussing uncertainty"], correctAnswer: "Managing or controlling a learner’s brokerage account" },
    { id: "safety-4", text: "If a learner reports financial distress, a coach should:", options: ["Encourage larger trades to recover losses", "Promise a recovery plan", "Pause performance-focused discussion and encourage appropriate professional support", "Ask for account access"], correctAnswer: "Pause performance-focused discussion and encourage appropriate professional support" },
    { id: "safety-5", text: "How should off-platform payment requests be handled?", options: ["Accept them if the learner is a regular", "Move payment to a private wallet", "Decline and keep payment within the marketplace", "Hide the request from moderators"], correctAnswer: "Decline and keep payment within the marketplace" },
  ],
};

let schemaReady: Promise<void> | null = null;

async function seedAssessmentQuestions(): Promise<void> {
  for (const type of ["KNOWLEDGE", "SAFETY"] as const) {
    for (const question of assessmentBank[type]) {
      await pool.query(
        `INSERT INTO tradigo_assessment_questions
          (id, type, version, question_text, options, correct_answer, explanation, status, created_by, updated_by)
         VALUES ($1,$2,'v1.0',$3,$4::jsonb,$5,$6,'PUBLISHED','system','system')
         ON CONFLICT (id) DO NOTHING`,
        [
          question.id,
          type,
          question.text,
          JSON.stringify(question.options),
          question.correctAnswer,
          question.explanation ?? "Standardized Tradigo education-only assessment question.",
        ],
      );
    }
  }
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS tradigo_coach_applications (
        id text PRIMARY KEY, applicant_id text NOT NULL, applicant_name text, applicant_email text,
        status text NOT NULL DEFAULT 'DRAFT', current_step integer NOT NULL DEFAULT 1,
        profile jsonb NOT NULL DEFAULT '{}'::jsonb, markets jsonb NOT NULL DEFAULT '{}'::jsonb,
        experience jsonb NOT NULL DEFAULT '{}'::jsonb, compliance jsonb NOT NULL DEFAULT '{}'::jsonb,
        verification jsonb NOT NULL DEFAULT '{}'::jsonb, reviewer_note text,
        reviewer_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
        previous_application_id text, attempt_number integer NOT NULL DEFAULT 1,
        submitted_at timestamptz, decided_at timestamptz, decided_by text,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      DROP INDEX IF EXISTS tradigo_coach_applications_applicant_idx;
      ALTER TABLE tradigo_coach_applications
        ADD COLUMN IF NOT EXISTS previous_application_id text;
      ALTER TABLE tradigo_coach_applications
        ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1;
      CREATE INDEX IF NOT EXISTS tradigo_coach_applications_applicant_created_idx
        ON tradigo_coach_applications(applicant_id, created_at DESC, updated_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_coach_applications_active_applicant_idx
        ON tradigo_coach_applications(applicant_id)
        WHERE status IN ('DRAFT','UNDER_REVIEW','SUBMITTED','PENDING');
      CREATE INDEX IF NOT EXISTS tradigo_coach_applications_status_idx ON tradigo_coach_applications(status, updated_at);
      ALTER TABLE tradigo_coach_applications
        ADD COLUMN IF NOT EXISTS reviewer_checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
      CREATE TABLE IF NOT EXISTS tradigo_assessment_attempts (
        id text PRIMARY KEY, application_id text NOT NULL, applicant_id text NOT NULL, type text NOT NULL,
        version text NOT NULL, status text NOT NULL, score integer NOT NULL, max_score integer NOT NULL,
        attempt_number integer NOT NULL, answers_reviewed integer NOT NULL, reviewer_note text,
        submitted_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_assessment_attempts_application_type_attempt_idx
        ON tradigo_assessment_attempts(application_id, type, attempt_number);
      CREATE INDEX IF NOT EXISTS tradigo_assessment_attempts_application_idx
        ON tradigo_assessment_attempts(application_id, submitted_at);
      CREATE TABLE IF NOT EXISTS tradigo_assessment_answers (
        id text PRIMARY KEY, attempt_id text NOT NULL, question_id text NOT NULL,
        answer text NOT NULL, is_correct text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_assessment_answers_attempt_question_idx
        ON tradigo_assessment_answers(attempt_id, question_id);
      CREATE TABLE IF NOT EXISTS tradigo_assessment_questions (
        id text PRIMARY KEY, type text NOT NULL, version text NOT NULL,
        question_text text NOT NULL, options jsonb NOT NULL DEFAULT '[]'::jsonb,
        correct_answer text NOT NULL, explanation text,
        status text NOT NULL DEFAULT 'DRAFT', created_by text NOT NULL, updated_by text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tradigo_assessment_questions_type_status_idx
        ON tradigo_assessment_questions(type, status, updated_at);
      ALTER TABLE tradigo_assessment_answers ADD COLUMN IF NOT EXISTS question_version text;
      ALTER TABLE tradigo_assessment_answers ADD COLUMN IF NOT EXISTS question_text text;
      ALTER TABLE tradigo_assessment_answers ADD COLUMN IF NOT EXISTS options jsonb;
      CREATE TABLE IF NOT EXISTS tradigo_application_documents (
        id text PRIMARY KEY, application_id text NOT NULL, applicant_id text NOT NULL,
        document_type text NOT NULL, name text NOT NULL, description text, issuer text,
        object_path text, mime_type text, size_bytes integer, status text NOT NULL DEFAULT 'RECEIVED',
        submitted_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tradigo_application_documents_application_idx
        ON tradigo_application_documents(application_id, submitted_at);
      CREATE TABLE IF NOT EXISTS tradigo_application_audit (
        id text PRIMARY KEY, application_id text NOT NULL, actor_id text NOT NULL,
        action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tradigo_application_audit_application_idx
        ON tradigo_application_audit(application_id, created_at);
      CREATE TABLE IF NOT EXISTS tradigo_application_clarifications (
        id text PRIMARY KEY, application_id text NOT NULL, applicant_id text NOT NULL,
        message text NOT NULL, status text NOT NULL DEFAULT 'SUBMITTED',
        response text, responded_by text, responded_at timestamptz,
        closed_by text, closed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tradigo_application_clarifications_application_idx
        ON tradigo_application_clarifications(application_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_application_clarifications_open_idx
        ON tradigo_application_clarifications(application_id)
        WHERE status = 'SUBMITTED';
      CREATE TABLE IF NOT EXISTS tradigo_identity_webhook_events (
        id text PRIMARY KEY, provider text NOT NULL, event_id text NOT NULL,
        application_id text, provider_reference text, decision text NOT NULL,
        checks jsonb NOT NULL DEFAULT '{}'::jsonb, reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
        decided_at timestamptz, payload_hash text NOT NULL,
        status text NOT NULL DEFAULT 'RECEIVED', error text,
        received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
        attempt_count integer NOT NULL DEFAULT 0, last_attempt_at timestamptz, last_actor_id text
      );
      ALTER TABLE tradigo_identity_webhook_events ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
      ALTER TABLE tradigo_identity_webhook_events ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
      ALTER TABLE tradigo_identity_webhook_events ADD COLUMN IF NOT EXISTS last_actor_id text;
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_identity_webhook_events_provider_event_idx
        ON tradigo_identity_webhook_events(provider, event_id);
      CREATE INDEX IF NOT EXISTS tradigo_identity_webhook_events_application_idx
        ON tradigo_identity_webhook_events(application_id, received_at);
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_application_audit_identity_event_idx
        ON tradigo_application_audit(application_id, action, ((details->>'providerEventId')))
        WHERE action = 'IDENTITY_VERIFICATION_DECISION' AND details->>'providerEventId' IS NOT NULL;
    `).then(() => seedAssessmentQuestions());
  }
  return schemaReady;
}

function errorMessage(res: any, status: number, message: string): void {
  res.status(status).json({ error: { message } });
}

function serializeIdentityWebhookEvent(row: Record<string, any>) {
  return {
    id: row.id,
    provider: row.provider,
    eventId: row.event_id,
    applicationId: row.application_id,
    providerReference: row.provider_reference,
    decision: row.decision,
    checks: isObject(row.checks) ? row.checks : {},
    reasonCodes: Array.isArray(row.reason_codes) ? row.reason_codes : [],
    decidedAt: row.decided_at,
    status: row.status,
    error: row.error,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    attemptCount: Number(row.attempt_count ?? 0),
    lastAttemptAt: row.last_attempt_at,
  };
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean).slice(0, 30) : [];
}

function cleanSection(data: unknown): Record<string, any> {
  if (!isObject(data)) return {};
  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(data).slice(0, 40)) {
    if (Array.isArray(value)) output[key] = cleanArray(value);
    else if (typeof value === "number" && Number.isFinite(value)) output[key] = value;
    else if (typeof value === "string") output[key] = cleanText(value);
    else if (typeof value === "boolean") output[key] = value;
  }
  return output;
}

function providerVerificationForResponse(value: unknown, includeReviewerDetails: boolean): Record<string, any> {
  const verification = isObject(value) ? value : {};
  const identity = cleanText(verification.identity, 80) || "PENDING";
  const provider = cleanText(verification.provider, 80) || "PAYPAL";
  if (!includeReviewerDetails) return { identity, provider };

  const hostedReviewUrl = [
    verification.hostedReviewUrl,
    verification.hosted_review_url,
    verification.providerReviewUrl,
    verification.provider_review_url,
    verification.reviewUrl,
  ].find(candidate => typeof candidate === "string" && candidate.trim())?.trim() ?? "";
  const providerReference = [
    verification.providerReference,
    verification.provider_reference,
    verification.reviewReference,
  ].find(candidate => typeof candidate === "string" && candidate.trim())?.trim() ?? "";
  const reviewUrlExpiresAt = [
    verification.hostedReviewUrlExpiresAt,
    verification.hosted_review_url_expires_at,
    verification.providerReviewUrlExpiresAt,
  ].find(candidate => typeof candidate === "string" && candidate.trim())?.trim() ?? null;
  const lastCheckedAt = [
    verification.lastCheckedAt,
    verification.last_checked_at,
    verification.providerVerifiedAt,
  ].find(candidate => typeof candidate === "string" && candidate.trim())?.trim() ?? null;

  let validHostedReviewUrl = "";
  try {
    const parsed = new URL(hostedReviewUrl);
    if (parsed.protocol === "https:") validHostedReviewUrl = parsed.toString();
  } catch {
    // Invalid provider URLs are intentionally omitted instead of becoming broken controls.
  }

  const expiresAt = reviewUrlExpiresAt ? Date.parse(reviewUrlExpiresAt) : NaN;
  const hasExpired = Number.isFinite(expiresAt) && expiresAt <= Date.now();
  const providerReviewStatus = hasExpired
    ? "EXPIRED"
    : validHostedReviewUrl
      ? "AVAILABLE"
      : providerReference
        ? "REFERENCE_ONLY"
        : "UNAVAILABLE";

  const identityDecision = isObject(verification.identityDecision) ? verification.identityDecision : {};
  const checks = isObject(identityDecision.checks)
    ? Object.fromEntries(IDENTITY_CHECK_KEYS.flatMap(key => {
      const check = cleanText(identityDecision.checks?.[key], 40).toUpperCase();
      return IDENTITY_CHECK_VALUES.includes(check as typeof IDENTITY_CHECK_VALUES[number]) ? [[key, check]] : [];
    }))
    : {};

  return {
    identity,
    provider,
    providerReviewStatus,
    ...(validHostedReviewUrl && !hasExpired ? { hostedReviewUrl: validHostedReviewUrl } : {}),
    ...(providerReference ? { providerReference } : {}),
    ...(reviewUrlExpiresAt ? { hostedReviewUrlExpiresAt: reviewUrlExpiresAt } : {}),
    ...(lastCheckedAt ? { lastCheckedAt } : {}),
    ...(identityDecision.decision || identityDecision.status ? {
      identityDecision: {
        decision: cleanText(identityDecision.decision ?? identityDecision.status, 40).toUpperCase(),
        responsibleParty: cleanText(identityDecision.responsibleParty, 180) || `${provider} identity verification service`,
        ...(cleanText(identityDecision.recordedBy, 180) ? { recordedBy: cleanText(identityDecision.recordedBy, 180) } : {}),
        ...(cleanText(identityDecision.recordedAt, 80) ? { recordedAt: cleanText(identityDecision.recordedAt, 80) } : {}),
        ...(cleanText(identityDecision.decidedAt, 80) ? { decidedAt: cleanText(identityDecision.decidedAt, 80) } : {}),
        ...(cleanText(identityDecision.providerEventId, 200) ? { providerEventId: cleanText(identityDecision.providerEventId, 200) } : {}),
        ...(cleanText(identityDecision.basis, 2000) ? { basis: cleanText(identityDecision.basis, 2000) } : {}),
        ...(cleanText(identityDecision.source, 80) ? { source: cleanText(identityDecision.source, 80) } : {}),
        ...(Object.keys(checks).length ? { checks } : {}),
        ...(Array.isArray(identityDecision.reasonCodes) ? { reasonCodes: identityDecision.reasonCodes.filter((code: unknown): code is string => typeof code === "string").map((code: string) => code.trim().slice(0, 120)).filter(Boolean).slice(0, 12) } : {}),
      },
    } : {}),
  };
}

async function getOrCreateApplication(identity: NonNullable<Awaited<ReturnType<typeof getApplicationIdentity>>>) {
  await ensureSchema();
  const existing = await pool.query(
    "SELECT * FROM tradigo_coach_applications WHERE applicant_id=$1 ORDER BY created_at DESC, updated_at DESC, id DESC LIMIT 1",
    [identity.id],
  );
  if (existing.rows[0]) return existing.rows[0] as Record<string, any>;
  const profile = {
    contactEmail: identity.email ?? "",
    displayName: identity.displayName ?? "",
    headline: "",
    bio: "",
    teachingMethod: "",
    coachingBoundaries: "",
    languages: [],
    hourlyRateCents: 5000,
    instantRatePerMinuteCents: 100,
  };
  const result = await pool.query(
    `INSERT INTO tradigo_coach_applications
      (id, applicant_id, applicant_name, applicant_email, profile, verification)
     VALUES ($1,$2,$3,$4,$5,'{"identity":"PENDING","provider":"PAYPAL"}'::jsonb)
     RETURNING *`,
    [randomUUID(), identity.id, identity.displayName ?? null, identity.email ?? null, profile],
  );
  return result.rows[0] as Record<string, any>;
}

async function evidenceForApplication(applicationId: string) {
  const [attempts, answers, documents, auditEntries] = await Promise.all([
    pool.query("SELECT * FROM tradigo_assessment_attempts WHERE application_id=$1 ORDER BY submitted_at DESC", [applicationId]),
    pool.query(
      `SELECT aa.* FROM tradigo_assessment_answers aa
       JOIN tradigo_assessment_attempts at ON at.id=aa.attempt_id
       WHERE at.application_id=$1 ORDER BY aa.created_at`,
      [applicationId],
    ),
    pool.query("SELECT * FROM tradigo_application_documents WHERE application_id=$1 ORDER BY submitted_at DESC", [applicationId]),
    pool.query("SELECT action, actor_id, details, created_at FROM tradigo_application_audit WHERE application_id=$1 AND action LIKE 'IDENTITY_VERIFICATION_%' ORDER BY created_at DESC", [applicationId]),
  ]);
  const answersByAttempt = new Map<string, any[]>();
  for (const answer of answers.rows) {
    const list = answersByAttempt.get(answer.attempt_id) ?? [];
     list.push({
       id: answer.id,
       questionId: answer.question_id,
       questionVersion: answer.question_version,
       questionText: answer.question_text,
       options: answer.options,
       answer: answer.answer,
       isCorrect: answer.is_correct === "true",
     });
    answersByAttempt.set(answer.attempt_id, list);
  }
  return {
    attempts: attempts.rows.map(attempt => ({
      id: attempt.id,
      type: attempt.type,
      status: attempt.status,
      score: attempt.score,
      maxScore: attempt.max_score,
      attemptNumber: attempt.attempt_number,
      version: attempt.version,
      answersReviewed: attempt.answers_reviewed,
      reviewerNote: attempt.reviewer_note,
      submittedAt: attempt.submitted_at,
      answers: (answersByAttempt.get(attempt.id) ?? []).map(answer => ({
        ...answer,
        questionText: answer.questionText
          ?? assessmentBank[attempt.type as AssessmentType]?.find(question => question.id === answer.questionId)?.text
          ?? answer.questionId,
      })),
    })),
    documents: documents.rows.map(document => ({
      id: document.id,
      name: document.name,
      type: document.document_type,
      description: document.description,
      issuer: document.issuer,
      status: document.status,
      fileAvailable: Boolean(document.object_path),
      objectPath: document.object_path,
      mimeType: document.mime_type,
      sizeBytes: document.size_bytes,
      submittedAt: document.submitted_at,
    })),
    identityHistory: auditEntries.rows.map(entry => {
      const details = isObject(entry.details) ? entry.details : {};
      return {
        action: entry.action,
        actorId: entry.actor_id,
        createdAt: entry.created_at,
        decision: cleanText(details.decision, 40).toUpperCase() || "NOT_RECORDED",
        provider: cleanText(details.provider, 80) || "Provider",
        responsibleParty: cleanText(details.responsibleParty, 180) || "Not recorded",
        basis: cleanText(details.basis, 2000) || "No decision basis recorded.",
        ...(cleanText(details.source, 80) ? { source: cleanText(details.source, 80) } : {}),
        ...(cleanText(details.providerEventId, 200) ? { providerEventId: cleanText(details.providerEventId, 200) } : {}),
        ...(cleanText(details.decidedAt, 80) ? { decidedAt: cleanText(details.decidedAt, 80) } : {}),
        ...(isObject(details.checks) ? { checks: details.checks } : {}),
        ...(Array.isArray(details.reasonCodes) ? { reasonCodes: details.reasonCodes } : {}),
      };
    }),
  };
}

function serializeQuestion(row: Record<string, any>, includeAnswer = true) {
  return {
    id: row.id,
    type: row.type,
    version: row.version,
    text: row.question_text,
    options: Array.isArray(row.options) ? row.options : [],
    ...(includeAnswer ? { correctAnswer: row.correct_answer, explanation: row.explanation } : {}),
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function questionInput(body: any): { type: AssessmentType; text: string; options: string[]; correctAnswer: string; explanation: string } | null {
  const type = body?.type as AssessmentType;
  const text = cleanText(body?.text, 600);
  const options = [...new Set(cleanArray(body?.options).map(option => option.slice(0, 300)))];
  const correctAnswer = cleanText(body?.correctAnswer, 300);
  const explanation = cleanText(body?.explanation, 1000);
  if (!["KNOWLEDGE", "SAFETY"].includes(type) || text.length < 10 || options.length < 2 || options.length > 6 || !options.includes(correctAnswer)) return null;
  return { type, text, options, correctAnswer, explanation };
}

async function nextQuestionVersion(type: AssessmentType): Promise<string> {
  const result = await pool.query("SELECT COUNT(*)::int AS count FROM tradigo_assessment_questions WHERE type=$1", [type]);
  return `v${Number(result.rows[0]?.count ?? 0) + 1}.0`;
}

function reviewFlags(application: Record<string, any>, attempts: any[], documents: any[]): string[] {
  const profile = application.profile ?? {};
  const markets = application.markets ?? {};
  const experience = application.experience ?? {};
  const compliance = application.compliance ?? {};
  const flags: string[] = [];
  if (!profile.headline || !profile.bio || !profile.teachingMethod || !profile.coachingBoundaries) flags.push("Profile and coaching boundaries are incomplete.");
  if (!cleanArray(markets.markets).length || !cleanArray(markets.coachingSpecialties).length) flags.push("Markets and coaching specialties are incomplete.");
  if (!experience.yearsExperience || !experience.background) flags.push("Experience history is incomplete.");
  for (const type of ["KNOWLEDGE", "SAFETY"]) {
    const latest = attempts.find(attempt => attempt.type === type);
    if (!latest) flags.push(`${type === "KNOWLEDGE" ? "Knowledge" : "Safety"} assessment has not been completed.`);
    else if (latest.status !== "PASSED") flags.push(`${type === "KNOWLEDGE" ? "Knowledge" : "Safety"} assessment is not passed.`);
  }
  for (const key of ["remoteControl", "credentials", "offPlatform", "jurisdiction"]) {
    if (!compliance[key]) flags.push(`Compliance declaration "${key}" is incomplete.`);
  }
  if (!documents.length) flags.push("No supporting evidence document has been added; provider verification is still separate.");
  return flags;
}

function approvalGateFlags(application: Record<string, any>, attempts: any[], documents: any[]): string[] {
  const flags = reviewFlags(application, attempts, documents).filter(flag => !flag.startsWith("No supporting evidence"));
  const verification = isObject(application.verification) ? application.verification : {};
  const identityDecision = isObject(verification.identityDecision) ? verification.identityDecision : {};
  if (cleanText(verification.identity, 40).toUpperCase() !== "VERIFIED"
    || cleanText(identityDecision.decision, 40).toUpperCase() !== "VERIFIED") {
    flags.push("Provider identity verification must be verified before approval.");
  }
  const identityCheckedAt = cleanText(verification.lastCheckedAt, 80)
    || cleanText(identityDecision.recordedAt, 80)
    || cleanText(identityDecision.decidedAt, 80);
  if (!identityCheckedAt || Number.isNaN(new Date(identityCheckedAt).getTime())
    || Date.now() - new Date(identityCheckedAt).getTime() > 365 * 24 * 60 * 60 * 1000) {
    flags.push("Provider identity verification is missing a current check timestamp.");
  }
  const hostedReviewExpiresAt = cleanText(verification.hostedReviewUrlExpiresAt, 80);
  if (cleanText(verification.providerReviewStatus, 40).toUpperCase() === "EXPIRED"
    || (hostedReviewExpiresAt && !Number.isNaN(new Date(hostedReviewExpiresAt).getTime())
      && new Date(hostedReviewExpiresAt).getTime() <= Date.now())) {
    flags.push("Provider review evidence has expired and must be refreshed.");
  }
  if (documents.some((document) => {
    const submittedAt = new Date(String(document.submitted_at ?? "")).getTime();
    return ["REJECTED", "EXPIRED"].includes(String(document.status).toUpperCase())
      || (Number.isFinite(submittedAt) && Date.now() - submittedAt > 365 * 24 * 60 * 60 * 1000);
  })) {
    flags.push("One or more supporting documents are stale or unavailable.");
  }
  for (const type of ["KNOWLEDGE", "SAFETY"]) {
    const latest = attempts.find(attempt => attempt.type === type);
    if (latest?.submitted_at && Date.now() - new Date(latest.submitted_at).getTime() > 365 * 24 * 60 * 60 * 1000) {
      flags.push(`${type === "KNOWLEDGE" ? "Knowledge" : "Safety"} assessment is stale; a new attempt is required.`);
    }
  }
  return flags;
}

function serializeApplication(
  application: Record<string, any>,
  evidence: { attempts: any[]; documents: any[]; identityHistory?: any[] },
  includeReviewerDetails = false,
  attemptHistory?: any[],
  clarificationRequests?: any[],
) {
  const flags = reviewFlags(application, evidence.attempts, evidence.documents);
  return {
    id: application.id,
    applicantId: application.applicant_id,
    applicantName: application.applicant_name,
    applicantEmail: application.applicant_email,
    attemptNumber: Number(application.attempt_number ?? 1),
    isResubmission: Boolean(application.previous_application_id),
    ...(includeReviewerDetails && application.previous_application_id
      ? { previousApplicationId: application.previous_application_id }
      : {}),
    display_name: application.applicant_name,
    email: application.applicant_email,
    status: application.status,
    currentStep: application.current_step,
    submittedAt: application.submitted_at,
    submitted_at: application.submitted_at,
    decidedAt: application.decided_at,
    decidedBy: application.decided_by,
    profile: application.profile ?? {},
    markets: application.markets ?? {},
    experience: application.experience ?? {},
    compliance: application.compliance ?? {},
    verifications: {
      ...providerVerificationForResponse(application.verification, includeReviewerDetails),
      ...(includeReviewerDetails ? { identityHistory: evidence.identityHistory ?? [] } : {}),
    },
    assessmentAttempts: evidence.attempts,
    documents: evidence.documents,
    reviewFlags: flags,
    reviewerNote: application.reviewer_note,
    reviewChecklist: application.reviewer_checklist ?? {},
    ...(includeReviewerDetails && attemptHistory ? { attemptHistory } : {}),
    ...(includeReviewerDetails ? { clarificationRequests: clarificationRequests ?? [] } : {}),
  };
}

function serializeClarification(row: Record<string, any>, includeReviewerDetails = false) {
  return {
    id: row.id,
    applicationId: row.application_id,
    status: row.status,
    message: row.message,
    submittedAt: row.created_at,
    ...(row.response ? { response: row.response } : {}),
    ...(row.responded_at ? { respondedAt: row.responded_at } : {}),
    ...(row.closed_at ? { closedAt: row.closed_at } : {}),
    ...(includeReviewerDetails ? {
      applicantId: row.applicant_id,
      respondedBy: row.responded_by,
      closedBy: row.closed_by,
      updatedAt: row.updated_at,
    } : {}),
  };
}

async function clarificationRequestsForApplication(applicationId: string, includeReviewerDetails = false) {
  const result = await pool.query(
    `SELECT * FROM tradigo_application_clarifications
     WHERE application_id=$1 ORDER BY created_at DESC, id DESC`,
    [applicationId],
  );
  return result.rows.map(row => serializeClarification(row, includeReviewerDetails));
}

async function reviewerAttemptHistory(applicationId: string) {
  const chain = await pool.query(
    `WITH RECURSIVE attempt_chain AS (
       SELECT application.*, ARRAY[application.id]::text[] AS visited_ids
       FROM tradigo_coach_applications application
       WHERE application.id=$1
       UNION ALL
       SELECT previous.*, attempt_chain.visited_ids || previous.id
       FROM tradigo_coach_applications previous
       JOIN attempt_chain ON previous.id=attempt_chain.previous_application_id
       WHERE NOT (previous.id = ANY(attempt_chain.visited_ids))
     )
     SELECT * FROM attempt_chain ORDER BY attempt_number ASC, submitted_at ASC NULLS FIRST`,
    [applicationId],
  );

  return Promise.all(chain.rows.map(async (application) => (
    serializeApplication(
      application,
      await evidenceForApplication(application.id),
      true,
      undefined,
      await clarificationRequestsForApplication(application.id, true),
    )
  )));
}

function serializeApplicationStatus(application: Record<string, any>, clarificationRequests: any[] = []) {
  return {
    id: application.id,
    status: application.status,
    attemptNumber: Number(application.attempt_number ?? 1),
    isResubmission: Boolean(application.previous_application_id),
    currentStep: application.current_step,
    submittedAt: application.submitted_at,
    decidedAt: application.decided_at,
    reviewerNote: application.reviewer_note ?? null,
    clarificationRequests,
  };
}

async function serializeApplicantAttempt(
  application: Record<string, any>,
  evidence: Awaited<ReturnType<typeof evidenceForApplication>>,
  isCurrent: boolean,
) {
  const profile = isObject(application.profile) ? application.profile : {};
  return {
    id: application.id,
    status: application.status,
    attemptNumber: Number(application.attempt_number ?? 1),
    isCurrent,
    currentStep: application.current_step,
    submittedAt: application.submitted_at,
    decidedAt: application.decided_at,
    reviewerNote: application.reviewer_note ?? null,
    profile: {
      headline: cleanText(profile.headline, 240),
      bio: cleanText(profile.bio, 4000),
      teachingMethod: cleanText(profile.teachingMethod, 4000),
      coachingBoundaries: cleanText(profile.coachingBoundaries, 4000),
      languages: cleanArray(profile.languages).map(language => language.slice(0, 80)),
      hourlyRateCents: Number.isFinite(Number(profile.hourlyRateCents)) ? Number(profile.hourlyRateCents) : null,
      instantRatePerMinuteCents: Number.isFinite(Number(profile.instantRatePerMinuteCents))
        ? Number(profile.instantRatePerMinuteCents)
        : null,
    },
    markets: isObject(application.markets) ? application.markets : {},
    experience: isObject(application.experience) ? application.experience : {},
    compliance: isObject(application.compliance) ? application.compliance : {},
    assessmentAttempts: evidence.attempts.map(attempt => ({
      id: attempt.id,
      type: attempt.type,
      status: attempt.status,
      score: attempt.score,
      maxScore: attempt.maxScore,
      attemptNumber: attempt.attemptNumber,
      version: attempt.version,
      answersReviewed: attempt.answersReviewed,
      submittedAt: attempt.submittedAt,
      answers: attempt.answers,
    })),
    documents: evidence.documents.map(document => ({
      id: document.id,
      name: document.name,
      type: document.type,
      description: document.description,
      issuer: document.issuer,
      status: document.status,
      fileAvailable: document.fileAvailable,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      submittedAt: document.submittedAt,
    })),
    clarificationRequests: await clarificationRequestsForApplication(application.id),
  };
}

async function applicantAttemptHistory(applicantId: string, currentApplicationId: string) {
  const applications = await pool.query(
    `SELECT * FROM tradigo_coach_applications
     WHERE applicant_id=$1
     ORDER BY attempt_number ASC, created_at ASC, id ASC`,
    [applicantId],
  );
  return Promise.all(applications.rows.map(async application => (
    serializeApplicantAttempt(
      application,
      await evidenceForApplication(application.id),
      application.id === currentApplicationId,
    )
  )));
}

async function audit(applicationId: string, actorId: string, action: string, details: Record<string, any> = {}) {
  await pool.query(
    "INSERT INTO tradigo_application_audit (id, application_id, actor_id, action, details) VALUES ($1,$2,$3,$4,$5)",
    [randomUUID(), applicationId, actorId, action, details],
  );
}

router.get("/coaches/application", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }
  try {
    const application = await getOrCreateApplication(identity);
    const evidence = await evidenceForApplication(application.id);
    res.json(serializeApplication(application, evidence));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load coach application");
    errorMessage(res, 500, "Unable to load the coach application.");
  }
});

router.get("/coaches/application/status", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }
  try {
    const application = await getOrCreateApplication(identity);
    res.json({
      ...serializeApplicationStatus(application, await clarificationRequestsForApplication(application.id)),
      attemptHistory: await applicantAttemptHistory(identity.id, application.id),
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load coach application status");
    errorMessage(res, 500, "Unable to load the coach application status.");
  }
});

router.post("/coaches/application/:id/clarifications", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const message = cleanText(req.body?.message, 2000);
  if (message.length < 10) { errorMessage(res, 400, "Tell us what you would like clarified in at least 10 characters."); return; }

  try {
    const currentApplication = await getOrCreateApplication(identity);
    if (id === currentApplication.id) {
      errorMessage(res, 409, "Clarification requests are available for earlier application attempts.");
      return;
    }
    await ensureSchema();
    const application = await pool.query(
      `SELECT id, applicant_id, status FROM tradigo_coach_applications
       WHERE id=$1 AND applicant_id=$2`,
      [id, identity.id],
    );
    const attempt = application.rows[0] as Record<string, any> | undefined;
    if (!attempt) { errorMessage(res, 404, "Application attempt not found."); return; }
    if (attempt.status === "DRAFT") { errorMessage(res, 409, "Clarification requests are available after an application is submitted."); return; }

    const result = await pool.query(
      `INSERT INTO tradigo_application_clarifications
       (id, application_id, applicant_id, message)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [randomUUID(), id, identity.id, message],
    );
    await audit(id, identity.id, "CLARIFICATION_REQUEST_SUBMITTED", { clarificationId: result.rows[0].id });
    res.status(201).json(serializeClarification(result.rows[0]));
  } catch (error: any) {
    if (error?.code === "23505") {
      errorMessage(res, 409, "You already have a clarification request waiting for a response on this attempt.");
      return;
    }
    req.log.error({ err: error }, "Failed to submit application clarification");
    errorMessage(res, 500, "Unable to submit your clarification request.");
  }
});

router.patch("/admin/application-clarifications/:id", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const status = String(req.body?.status ?? "").toUpperCase();
  const response = cleanText(req.body?.response, 4000);
  if (!["ANSWERED", "CLOSED"].includes(status)) {
    errorMessage(res, 400, "Choose answered or closed for a clarification request.");
    return;
  }
  if (status === "ANSWERED" && response.length < 2) {
    errorMessage(res, 400, "Add a response before marking the clarification answered.");
    return;
  }

  try {
    await ensureSchema();
    const existing = await pool.query(
      `SELECT id, application_id, status FROM tradigo_application_clarifications WHERE id=$1`,
      [id],
    );
    const request = existing.rows[0] as Record<string, any> | undefined;
    if (!request) { errorMessage(res, 404, "Clarification request not found."); return; }
    if (request.status === "CLOSED") { errorMessage(res, 409, "Closed clarification requests cannot be changed."); return; }

    const result = await pool.query(
      `UPDATE tradigo_application_clarifications
       SET status=$1,
           response=CASE WHEN $1='ANSWERED' THEN $2 ELSE response END,
           responded_by=CASE WHEN $1='ANSWERED' THEN $3 ELSE responded_by END,
           responded_at=CASE WHEN $1='ANSWERED' THEN NOW() ELSE responded_at END,
           closed_by=CASE WHEN $1='CLOSED' THEN $3 ELSE closed_by END,
           closed_at=CASE WHEN $1='CLOSED' THEN NOW() ELSE closed_at END,
           updated_at=NOW()
       WHERE id=$4
       RETURNING *`,
      [status, response || null, moderator.id, id],
    );
    await audit(
      request.application_id,
      moderator.id,
      status === "ANSWERED" ? "CLARIFICATION_ANSWERED" : "CLARIFICATION_CLOSED",
      { clarificationId: id },
    );
    res.json(serializeClarification(result.rows[0], true));
  } catch (error) {
    req.log.error({ err: error }, "Failed to update application clarification");
    errorMessage(res, 500, "Unable to update this clarification request.");
  }
});

router.post("/coaches/application/resubmit", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }

  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize attempts for one applicant so two clicks cannot create two active drafts.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [identity.id]);
    const latestResult = await client.query(
      "SELECT * FROM tradigo_coach_applications WHERE applicant_id=$1 ORDER BY created_at DESC, updated_at DESC, id DESC LIMIT 1 FOR UPDATE",
      [identity.id],
    );
    const latest = latestResult.rows[0] as Record<string, any> | undefined;
    if (!latest) {
      await client.query("ROLLBACK");
      errorMessage(res, 409, "Start the coach application before submitting it again.");
      return;
    }
    if (latest.status === "DRAFT") {
      await client.query("COMMIT");
      const evidence = await evidenceForApplication(latest.id);
      res.json(serializeApplication(latest, evidence));
      return;
    }
    if (latest.status !== "REJECTED") {
      await client.query("ROLLBACK");
      errorMessage(res, 409, "Only a rejected application can be submitted again.");
      return;
    }

    const newApplicationId = randomUUID();
    const attemptNumber = Number(latest.attempt_number ?? 1) + 1;
    const created = await client.query(
      `INSERT INTO tradigo_coach_applications
        (id, applicant_id, applicant_name, applicant_email, status, current_step,
         profile, markets, experience, compliance, verification, previous_application_id, attempt_number)
       VALUES ($1,$2,$3,$4,'DRAFT',1,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11)
       RETURNING *`,
      [
        newApplicationId,
        identity.id,
        latest.applicant_name ?? identity.displayName ?? null,
        latest.applicant_email ?? identity.email ?? null,
        JSON.stringify(isObject(latest.profile) ? latest.profile : {}),
        JSON.stringify(isObject(latest.markets) ? latest.markets : {}),
        JSON.stringify(isObject(latest.experience) ? latest.experience : {}),
        JSON.stringify(isObject(latest.compliance) ? latest.compliance : {}),
        JSON.stringify({ identity: "PENDING", provider: "PAYPAL" }),
        latest.id,
        attemptNumber,
      ],
    );
    await client.query(
      `INSERT INTO tradigo_application_audit (id, application_id, actor_id, action, details)
       VALUES ($1,$2,$3,'RESUBMITTED',$4::jsonb)`,
      [
        randomUUID(),
        newApplicationId,
        identity.id,
        JSON.stringify({ previousApplicationId: latest.id, previousStatus: latest.status }),
      ],
    );
    await client.query("COMMIT");

    const application = created.rows[0] as Record<string, any>;
    res.status(201).json(serializeApplication(application, await evidenceForApplication(application.id)));
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error?.code === "23505") {
      errorMessage(res, 409, "An active coach application already exists.");
      return;
    }
    req.log.error({ err: error }, "Failed to start coach application resubmission");
    errorMessage(res, 500, "Unable to start a new coach application.");
  } finally {
    client.release();
  }
});

router.put("/coaches/application", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }
  const step = Number(req.body?.step);
  if (!Number.isInteger(step) || step < 1 || step > 7 || !isObject(req.body?.data)) {
    errorMessage(res, 400, "A valid application step and data are required."); return;
  }
  try {
    const application = await getOrCreateApplication(identity);
    const column = step === 1 ? "profile" : step === 2 ? "markets" : step === 3 ? "experience" : step === 6 || step === 7 ? "compliance" : "verification";
    const data = cleanSection(req.body.data);
    if (column === "verification") {
      delete data.identity;
      delete data.provider;
      delete data.hostedReviewUrl;
      delete data.hosted_review_url;
      delete data.providerReviewUrl;
      delete data.provider_review_url;
      delete data.reviewUrl;
      delete data.providerReference;
      delete data.provider_reference;
      delete data.reviewReference;
      delete data.hostedReviewUrlExpiresAt;
      delete data.hosted_review_url_expires_at;
      delete data.providerReviewUrlExpiresAt;
      delete data.lastCheckedAt;
      delete data.last_checked_at;
      delete data.providerVerifiedAt;
    }
    const result = await pool.query(
      `UPDATE tradigo_coach_applications
       SET ${column} = ${column} || $1::jsonb, current_step=GREATEST(current_step,$2), updated_at=NOW()
       WHERE id=$3 AND status='DRAFT' RETURNING *`,
      [JSON.stringify(data), step, application.id],
    );
    if (!result.rows[0]) { errorMessage(res, 409, "This application is no longer editable."); return; }
    await audit(application.id, identity.id, "DRAFT_UPDATED", { step });
    const evidence = await evidenceForApplication(application.id);
    res.json(serializeApplication(result.rows[0], evidence));
  } catch (error) {
    req.log.error({ err: error }, "Failed to save coach application");
    errorMessage(res, 500, "Unable to save this application step.");
  }
});

router.post("/coaches/application/submit", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }
  try {
    const application = await getOrCreateApplication(identity);
    const evidence = await evidenceForApplication(application.id);
    const flags = reviewFlags(application, evidence.attempts, evidence.documents);
    if (flags.length) {
      res.status(400).json({ error: { message: "Complete the required application evidence before submitting.", flags } });
      return;
    }
    await pool.query(
      `INSERT INTO tradigo_application_documents
        (id, application_id, applicant_id, document_type, name, description, status)
       SELECT $1,$2,$3,'APPLICATION_RECORD','Coach application submission','Structured application data and accepted platform policies.','RECEIVED'
       WHERE NOT EXISTS (
         SELECT 1 FROM tradigo_application_documents WHERE application_id=$2 AND document_type='APPLICATION_RECORD'
       )`,
      [randomUUID(), application.id, identity.id],
    );
    const result = await pool.query(
      `UPDATE tradigo_coach_applications SET status='UNDER_REVIEW', submitted_at=NOW(), current_step=7, updated_at=NOW()
       WHERE id=$1 AND status='DRAFT' RETURNING *`,
      [application.id],
    );
    if (!result.rows[0]) { errorMessage(res, 409, "This application has already been submitted."); return; }
    await audit(application.id, identity.id, "SUBMITTED");
    const updatedEvidence = await evidenceForApplication(application.id);
    res.json(serializeApplication(result.rows[0], updatedEvidence));
  } catch (error) {
    req.log.error({ err: error }, "Failed to submit coach application");
    errorMessage(res, 500, "Unable to submit the coach application.");
  }
});

router.get("/coaches/assessments", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }
  try {
    await ensureSchema();
    const result = await pool.query(
      "SELECT * FROM tradigo_assessment_questions WHERE status='PUBLISHED' ORDER BY type, created_at, id",
    );
    res.json({
      version: ASSESSMENT_VERSION,
      knowledge: result.rows.filter(row => row.type === "KNOWLEDGE").map(row => serializeQuestion(row, false)),
      safety: result.rows.filter(row => row.type === "SAFETY").map(row => serializeQuestion(row, false)),
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load published assessment questions");
    errorMessage(res, 500, "Unable to load assessment questions.");
  }
});

router.post("/coaches/assessments/submit", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }
  const type = req.body?.type as AssessmentType;
  const answers = req.body?.answers;
  if (!["KNOWLEDGE", "SAFETY"].includes(type) || !isObject(answers)) {
    errorMessage(res, 400, "A valid assessment type and answers are required."); return;
  }
  try {
    const application = await getOrCreateApplication(identity);
    if (application.status !== "DRAFT") { errorMessage(res, 409, "Submitted applications cannot be changed."); return; }
    await ensureSchema();
    const questionResult = await pool.query(
      "SELECT * FROM tradigo_assessment_questions WHERE type=$1 AND status='PUBLISHED' ORDER BY created_at, id",
      [type],
    );
    const questions: Question[] = questionResult.rows.map(row => ({
      id: row.id,
      type,
      version: row.version,
      text: row.question_text,
      options: Array.isArray(row.options) ? row.options : [],
      correctAnswer: row.correct_answer,
      explanation: row.explanation ?? undefined,
    }));
    if (!questions.length) { errorMessage(res, 409, "No published questions are available for this assessment."); return; }
    const missing = questions.filter(question => !cleanText(answers[question.id]));
    if (missing.length) { errorMessage(res, 400, "Answer every assessment question before submitting."); return; }
    const score = questions.reduce((sum, question) => sum + (cleanText(answers[question.id]) === question.correctAnswer ? 1 : 0), 0);
    const attemptVersion = [...new Set(questions.map(question => question.version ?? ASSESSMENT_VERSION))].join("+") || ASSESSMENT_VERSION;
    const attemptResult = await pool.query(
      "SELECT COALESCE(MAX(attempt_number),0)::int AS max_attempt FROM tradigo_assessment_attempts WHERE application_id=$1 AND type=$2",
      [application.id, type],
    );
    const attemptNumber = Number(attemptResult.rows[0]?.max_attempt ?? 0) + 1;
    const status = score >= PASSING_SCORE ? "PASSED" : "FAILED";
    const attemptId = randomUUID();
    await pool.query(
      `INSERT INTO tradigo_assessment_attempts
       (id, application_id, applicant_id, type, version, status, score, max_score, attempt_number, answers_reviewed, reviewer_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [attemptId, application.id, identity.id, type, attemptVersion, status, score, questions.length, attemptNumber, questions.length, status === "PASSED" ? "Automatically scored; moderator should review the full responses." : "Attempt did not meet the passing score."],
    );
    for (const question of questions) {
      const answer = cleanText(answers[question.id], 1000);
      await pool.query(
        `INSERT INTO tradigo_assessment_answers
          (id, attempt_id, question_id, question_version, question_text, options, answer, is_correct)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
        [randomUUID(), attemptId, question.id, question.version ?? ASSESSMENT_VERSION, question.text, JSON.stringify(question.options), answer, String(answer === question.correctAnswer)],
      );
    }
    const verificationKey = type === "KNOWLEDGE" ? "knowledge" : "safety";
    await pool.query(
      `UPDATE tradigo_coach_applications SET verification=verification || $1::jsonb, updated_at=NOW() WHERE id=$2`,
      [JSON.stringify({ [verificationKey]: status }), application.id],
    );
    await audit(application.id, identity.id, "ASSESSMENT_SUBMITTED", { type, attemptNumber, score, maxScore: questions.length, status });
    res.json({ type, status, passed: status === "PASSED", score, maxScore: questions.length, attemptNumber });
  } catch (error) {
    req.log.error({ err: error }, "Failed to submit coach assessment");
    errorMessage(res, 500, "Unable to save this assessment.");
  }
});

router.get("/admin/assessment-questions", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  try {
    await ensureSchema();
    const result = await pool.query("SELECT * FROM tradigo_assessment_questions ORDER BY type, created_at DESC, id");
    res.json({ questions: result.rows.map(row => serializeQuestion(row)) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load assessment question bank");
    errorMessage(res, 500, "Unable to load the assessment question bank.");
  }
});

router.post("/admin/assessment-questions", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const input = questionInput(req.body);
  if (!input) { errorMessage(res, 400, "Add a valid assessment type, question, two to six choices, and a correct answer."); return; }
  try {
    await ensureSchema();
    const id = randomUUID();
    const version = await nextQuestionVersion(input.type);
    const result = await pool.query(
      `INSERT INTO tradigo_assessment_questions
        (id, type, version, question_text, options, correct_answer, explanation, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,'DRAFT',$8,$8) RETURNING *`,
      [id, input.type, version, input.text, JSON.stringify(input.options), input.correctAnswer, input.explanation || null, moderator.id],
    );
    res.status(201).json({ question: serializeQuestion(result.rows[0]) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to create assessment question");
    errorMessage(res, 500, "Unable to create the assessment question.");
  }
});

router.patch("/admin/assessment-questions/:id", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const input = questionInput(req.body);
  if (!input) { errorMessage(res, 400, "Add a valid assessment type, question, two to six choices, and a correct answer."); return; }
  try {
    await ensureSchema();
    const existingResult = await pool.query("SELECT * FROM tradigo_assessment_questions WHERE id=$1", [id]);
    const existing = existingResult.rows[0] as Record<string, any> | undefined;
    if (!existing) { errorMessage(res, 404, "Assessment question not found."); return; }
    if (existing.status === "PUBLISHED") {
      const version = await nextQuestionVersion(input.type);
      const replacement = await pool.query(
        `INSERT INTO tradigo_assessment_questions
          (id, type, version, question_text, options, correct_answer, explanation, status, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,'DRAFT',$8,$8) RETURNING *`,
        [randomUUID(), input.type, version, input.text, JSON.stringify(input.options), input.correctAnswer, input.explanation || null, existing.created_by ?? moderator.id, moderator.id],
      );
      res.json({ question: serializeQuestion(replacement.rows[0]), note: "Published questions stay immutable; a new draft revision was created." });
      return;
    }
    const result = await pool.query(
      `UPDATE tradigo_assessment_questions
       SET type=$1, question_text=$2, options=$3::jsonb, correct_answer=$4, explanation=$5, updated_by=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [input.type, input.text, JSON.stringify(input.options), input.correctAnswer, input.explanation || null, moderator.id, id],
    );
    res.json({ question: serializeQuestion(result.rows[0]) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to update assessment question");
    errorMessage(res, 500, "Unable to update the assessment question.");
  }
});

router.post("/admin/assessment-questions/:id/publish", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    await ensureSchema();
    const result = await pool.query(
      `UPDATE tradigo_assessment_questions SET status='PUBLISHED', updated_by=$1, updated_at=NOW()
       WHERE id=$2 AND status <> 'PUBLISHED' RETURNING *`,
      [moderator.id, id],
    );
    if (!result.rows[0]) { errorMessage(res, 404, "Draft assessment question not found."); return; }
    res.json({ question: serializeQuestion(result.rows[0]) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to publish assessment question");
    errorMessage(res, 500, "Unable to publish the assessment question.");
  }
});

router.post("/admin/assessment-questions/:id/retire", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    await ensureSchema();
    const result = await pool.query(
      `UPDATE tradigo_assessment_questions SET status='RETIRED', updated_by=$1, updated_at=NOW()
       WHERE id=$2 AND status <> 'RETIRED' RETURNING *`,
      [moderator.id, id],
    );
    if (!result.rows[0]) { errorMessage(res, 404, "Assessment question not found."); return; }
    res.json({ question: serializeQuestion(result.rows[0]) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to retire assessment question");
    errorMessage(res, 500, "Unable to retire the assessment question.");
  }
});

router.post("/coaches/application/documents", async (req, res): Promise<void> => {
  const identity = await getApplicationIdentity(req);
  if (!identity) { errorMessage(res, 401, "Sign in is required."); return; }
  const documentType = req.body?.documentType as string;
  const name = cleanText(req.body?.name, 160);
  const objectPath = req.body?.objectPath == null ? null : cleanText(req.body.objectPath, 500);
  if (!DOCUMENT_TYPES.includes(documentType as any) || !name) {
    errorMessage(res, 400, "Choose a document type and provide a document name."); return;
  }
  if (objectPath && !objectPath.startsWith("/objects/")) {
    errorMessage(res, 400, "The uploaded document path is invalid."); return;
  }
  const expectedUploadPrefix = `/objects/uploads/${createHash("sha256").update(identity.id).digest("hex")}/`;
  if (objectPath && !objectPath.startsWith(expectedUploadPrefix)) {
    errorMessage(res, 403, "This upload does not belong to your account."); return;
  }
  let uploadedFile: { contentType: string; sizeBytes: number } | null = null;
  if (objectPath) {
    try {
      uploadedFile = await verifyApplicationUpload(identity.id, objectPath);
    } catch (error) {
      req.log.error({ err: error }, "Failed to verify uploaded application document");
      errorMessage(res, 400, "The uploaded document could not be verified.");
      return;
    }
    if (!uploadedFile) {
      errorMessage(res, 400, "Upload a valid PDF, PNG, or JPEG document up to 10 MB.");
      return;
    }
  }
  try {
    const application = await getOrCreateApplication(identity);
    if (application.status !== "DRAFT") { errorMessage(res, 409, "Submitted applications cannot be changed."); return; }
    const result = await pool.query(
      `INSERT INTO tradigo_application_documents
       (id, application_id, applicant_id, document_type, name, description, issuer, object_path, mime_type, size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
       [randomUUID(), application.id, identity.id, documentType, name, cleanText(req.body?.description), cleanText(req.body?.issuer, 160), objectPath, uploadedFile?.contentType ?? null, uploadedFile?.sizeBytes ?? null],
    );
    await audit(application.id, identity.id, "DOCUMENT_ADDED", { documentType, hasFile: Boolean(objectPath) });
    res.status(201).json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      type: result.rows[0].document_type,
      status: result.rows[0].status,
      fileAvailable: Boolean(result.rows[0].object_path),
      submittedAt: result.rows[0].submitted_at,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to add application document");
    errorMessage(res, 500, "Unable to add this document.");
  }
});

router.get("/admin/applications", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  try {
    await ensureSchema();
    const applications = await pool.query("SELECT * FROM tradigo_coach_applications ORDER BY submitted_at DESC NULLS LAST, updated_at DESC");
    const result = [];
    for (const application of applications.rows) {
      const history = await reviewerAttemptHistory(application.id);
      result.push(serializeApplication(
        application,
        await evidenceForApplication(application.id),
        true,
        history,
        await clarificationRequestsForApplication(application.id, true),
      ));
    }
    res.json({ applications: result });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load admin coach applications");
    errorMessage(res, 500, "Unable to load coach applications.");
  }
});

router.get("/admin/identity-webhook-events", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  try {
    await ensureSchema();
    const result = await pool.query(
      `SELECT id, provider, event_id, application_id, provider_reference, decision,
              checks, reason_codes, decided_at, status, error, received_at,
              processed_at, attempt_count, last_attempt_at
       FROM tradigo_identity_webhook_events
       ORDER BY CASE WHEN status='FAILED' THEN 0 WHEN status='RECEIVED' THEN 1 ELSE 2 END,
                received_at DESC
       LIMIT 100`,
    );
    res.json({ events: result.rows.map(row => serializeIdentityWebhookEvent(row)) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load identity webhook events");
    errorMessage(res, 500, "Unable to load identity callback events.");
  }
});

router.post("/admin/identity-webhook-events/:eventId/link", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const eventLookup = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const applicationId = cleanText(req.body?.applicationId, 200);
  if (!applicationId) { errorMessage(res, 400, "A coach application ID is required."); return; }
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const eventResult = await client.query(
      "SELECT * FROM tradigo_identity_webhook_events WHERE id=$1 OR event_id=$1 ORDER BY CASE WHEN id=$1 THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE",
      [eventLookup],
    );
    const event = eventResult.rows[0] as Record<string, any> | undefined;
    if (!event) { await client.query("ROLLBACK"); errorMessage(res, 404, "Identity callback event not found."); return; }
    if (event.status === "PROCESSED") { await client.query("ROLLBACK"); errorMessage(res, 409, "Processed identity events cannot be relinked."); return; }
    if (event.application_id && event.application_id !== applicationId) {
      const previousApplication = await client.query("SELECT id FROM tradigo_coach_applications WHERE id=$1", [event.application_id]);
      if (previousApplication.rows[0]) {
        await client.query("ROLLBACK");
        errorMessage(res, 409, "This identity event is already linked to a different application.");
        return;
      }
    }
    const applicationResult = await client.query("SELECT id FROM tradigo_coach_applications WHERE id=$1 FOR UPDATE", [applicationId]);
    if (!applicationResult.rows[0]) { await client.query("ROLLBACK"); errorMessage(res, 404, "Coach application not found."); return; }
    await client.query(
      `UPDATE tradigo_identity_webhook_events
       SET application_id=$1, status='RECEIVED', error=NULL, processed_at=NULL
       WHERE id=$2`,
      [applicationId, event.id],
    );
    await client.query(
      `INSERT INTO tradigo_application_audit (id, application_id, actor_id, action, details)
       VALUES ($1,$2,$3,'IDENTITY_CALLBACK_LINKED',$4::jsonb)`,
      [
        randomUUID(),
        applicationId,
        moderator.id,
        JSON.stringify({
          provider: event.provider,
          providerEventId: event.event_id,
          identityEventId: event.id,
          previousApplicationId: event.application_id,
          source: "MODERATOR_RECOVERY",
        }),
      ],
    );
    await client.query("COMMIT");
    const linked = await pool.query("SELECT * FROM tradigo_identity_webhook_events WHERE id=$1", [event.id]);
    res.json({ event: serializeIdentityWebhookEvent(linked.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to link identity webhook event");
    errorMessage(res, 500, "Unable to link the identity callback event.");
  } finally {
    client.release();
  }
});

router.post("/admin/identity-webhook-events/:eventId/retry", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const eventLookup = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const eventResult = await client.query(
      "SELECT * FROM tradigo_identity_webhook_events WHERE id=$1 OR event_id=$1 ORDER BY CASE WHEN id=$1 THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE",
      [eventLookup],
    );
    const event = eventResult.rows[0] as Record<string, any> | undefined;
    if (!event) { await client.query("ROLLBACK"); errorMessage(res, 404, "Identity callback event not found."); return; }
    const result = await processIdentityWebhookEvent(client, event.id, { actorId: `moderator:${moderator.id}` });
    if (result.status === "FAILED") {
      await client.query("COMMIT");
      const failed = await pool.query("SELECT * FROM tradigo_identity_webhook_events WHERE id=$1", [event.id]);
      res.status(422).json({ error: { message: result.error }, event: serializeIdentityWebhookEvent(failed.rows[0] ?? { ...event, status: "FAILED", error: result.error }) });
      return;
    }
    if (!result.alreadyProcessed && result.applicationId) {
      await client.query(
        `INSERT INTO tradigo_application_audit (id, application_id, actor_id, action, details)
         VALUES ($1,$2,$3,'IDENTITY_CALLBACK_RETRIED',$4::jsonb)`,
        [
          randomUUID(),
          result.applicationId,
          moderator.id,
          JSON.stringify({
            provider: event.provider,
            providerEventId: event.event_id,
            identityEventId: event.id,
            source: "MODERATOR_RECOVERY",
            attempt: Number(event.attempt_count ?? 0) + 1,
          }),
        ],
      );
    }
    await client.query("COMMIT");
    const updated = await pool.query("SELECT * FROM tradigo_identity_webhook_events WHERE id=$1", [event.id]);
    res.json({ event: serializeIdentityWebhookEvent(updated.rows[0]), applicationId: result.applicationId, idempotent: Boolean(result.alreadyProcessed) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to retry identity webhook event");
    errorMessage(res, 500, "Unable to retry the identity callback event.");
  } finally {
    client.release();
  }
});

router.get("/admin/applications/:id", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await ensureSchema();
  const result = await pool.query("SELECT * FROM tradigo_coach_applications WHERE id=$1", [id]);
  if (!result.rows[0]) { errorMessage(res, 404, "Application not found."); return; }
  const history = await reviewerAttemptHistory(id);
  res.json(serializeApplication(
    result.rows[0],
    await evidenceForApplication(id),
    true,
    history,
    await clarificationRequestsForApplication(id, true),
  ));
});

router.post("/admin/applications/:id/identity-decision", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const decision = cleanText(req.body?.decision, 40).toUpperCase();
  const basis = cleanText(req.body?.basis, 2000);
  const provider = cleanText(req.body?.provider, 80).toUpperCase() || "PAYPAL";
  const source = cleanText(req.body?.source, 80).toUpperCase() || "PROVIDER_PORTAL";
  if (!IDENTITY_DECISIONS.includes(decision as typeof IDENTITY_DECISIONS[number]) || !basis) {
    errorMessage(res, 400, "A valid identity decision and written basis are required.");
    return;
  }
  if (!["PROVIDER_PORTAL", "MANUAL_REVIEW"].includes(source)) {
    errorMessage(res, 400, "The identity decision source is invalid.");
    return;
  }
  const checks = isObject(req.body?.checks)
    ? Object.fromEntries(IDENTITY_CHECK_KEYS.flatMap(key => {
      const value = cleanText(req.body.checks[key], 40).toUpperCase();
      return IDENTITY_CHECK_VALUES.includes(value as typeof IDENTITY_CHECK_VALUES[number]) ? [[key, value]] : [];
    }))
    : {};
  const reasonCodes = Array.isArray(req.body?.reasonCodes)
    ? req.body.reasonCodes.filter((code: unknown): code is string => typeof code === "string").map((code: string) => code.trim().slice(0, 120)).filter(Boolean).slice(0, 12)
    : [];
  const submittedDecisionAt = cleanText(req.body?.decidedAt, 80);
  const decidedAt = submittedDecisionAt && Number.isFinite(Date.parse(submittedDecisionAt))
    ? new Date(submittedDecisionAt).toISOString()
    : new Date().toISOString();

  await ensureSchema();
  const existing = await pool.query("SELECT * FROM tradigo_coach_applications WHERE id=$1", [id]);
  if (!existing.rows[0]) { errorMessage(res, 404, "Application not found."); return; }
  const application = existing.rows[0] as Record<string, any>;
  const previousVerification = isObject(application.verification) ? application.verification : {};
  const identityDecision = {
    decision,
    responsibleParty: `${provider} identity verification service`,
    recordedBy: moderator.id,
    recordedAt: new Date().toISOString(),
    decidedAt,
    basis,
    source,
    ...(Object.keys(checks).length ? { checks } : {}),
    ...(reasonCodes.length ? { reasonCodes } : {}),
  };
  const verification = {
    ...previousVerification,
    provider,
    identity: decision,
    identityDecision,
    ...(cleanText(req.body?.providerReference, 200) ? { providerReference: cleanText(req.body.providerReference, 200) } : {}),
    ...(cleanText(req.body?.hostedReviewUrl, 1000) ? { hostedReviewUrl: cleanText(req.body.hostedReviewUrl, 1000) } : {}),
    lastCheckedAt: new Date().toISOString(),
  };
  const updated = await pool.query(
    "UPDATE tradigo_coach_applications SET verification=$1::jsonb, updated_at=NOW() WHERE id=$2 RETURNING *",
    [JSON.stringify(verification), id],
  );
  await audit(id, moderator.id, "IDENTITY_VERIFICATION_DECISION", {
    decision,
    provider,
    responsibleParty: identityDecision.responsibleParty,
    basis,
    source,
    decidedAt,
    ...(Object.keys(checks).length ? { checks } : {}),
    ...(reasonCodes.length ? { reasonCodes } : {}),
    ...(cleanText(req.body?.providerReference, 200) ? { providerReference: cleanText(req.body.providerReference, 200) } : {}),
  });
  res.json(serializeApplication(updated.rows[0], await evidenceForApplication(id), true));
});

router.post("/admin/applications/:id/decision", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { errorMessage(res, 403, "Moderator authentication is required."); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const decision = req.body?.decision as string;
  const reason = cleanText(req.body?.reason, 2000);
  if (!["APPROVE", "REJECT"].includes(decision) || !reason) { errorMessage(res, 400, "A decision and written reason are required."); return; }
  await ensureSchema();
  const result = await pool.query("SELECT * FROM tradigo_coach_applications WHERE id=$1", [id]);
  if (!result.rows[0]) { errorMessage(res, 404, "Application not found."); return; }
  const application = result.rows[0] as Record<string, any>;
  const evidence = await evidenceForApplication(id);
  if (decision === "APPROVE") {
    const flags = approvalGateFlags(application, evidence.attempts, evidence.documents);
    if (flags.length) { res.status(409).json({ error: { message: "Complete all required evidence before approval.", flags } }); return; }
    const requiredChecklist = ["profile", "experience", "knowledge", "safety", "compliance"];
    const checklist = isObject(req.body?.reviewChecklist) ? req.body.reviewChecklist : {};
    const missingChecklist = requiredChecklist.filter((key) => checklist[key] !== true);
    if (missingChecklist.length) {
      res.status(409).json({ error: { message: "Every evidence category must be acknowledged before approval.", missingChecklist } });
      return;
    }
  }
  const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const updated = await pool.query(
    `UPDATE tradigo_coach_applications SET status=$1, reviewer_note=$2, reviewer_checklist=$3::jsonb, decided_by=$4, decided_at=NOW(), updated_at=NOW()
     WHERE id=$5 RETURNING *`,
    [status, reason, JSON.stringify(req.body?.reviewChecklist ?? {}), moderator.id, id],
  );
  if (decision === "APPROVE") {
    await ensureSchedulingSchema();
    await ensureIdentitySchema();
    const profile = isObject(application.profile) ? application.profile : {};
    const markets = isObject(application.markets) ? application.markets : {};
    const experience = isObject(application.experience) ? application.experience : {};
    const verification = isObject(application.verification) ? application.verification : {};
    const displayName = cleanText(profile.displayName, 160) || cleanText(application.applicant_name, 160) || "Tradigo Coach";
    const headline = cleanText(profile.headline, 240) || "Trading education coach";
    const bio = cleanText(profile.bio, 4000) || "Education-focused coaching on trading process and risk awareness.";
    const languages = cleanArray(profile.languages);
    const coachMarkets = cleanArray(markets.markets).length ? cleanArray(markets.markets) : cleanArray(markets.instruments);
    const specialties = cleanArray(markets.coachingSpecialties);
    const years = Number.isFinite(Number(experience.yearsExperience)) ? Math.max(0, Math.min(80, Number(experience.yearsExperience))) : 0;
    const hourlyRateCents = Number.isFinite(Number(profile.hourlyRateCents)) ? Math.max(0, Math.round(Number(profile.hourlyRateCents))) : 5000;
    const instantRatePerMinuteCents = Number.isFinite(Number(profile.instantRatePerMinuteCents))
      ? Math.max(0, Math.round(Number(profile.instantRatePerMinuteCents)))
      : Math.max(1, Math.ceil(hourlyRateCents / 60));
    const providerIdentity = cleanText(verification.identity, 40).toUpperCase();
    const verificationStatus = providerIdentity === "VERIFIED" ? "FULLY_VERIFIED" : "CREDENTIALS_VERIFIED";
    await pool.query("UPDATE tradigo_users SET role='COACH', updated_at=NOW() WHERE id=$1", [application.applicant_id]);
    await pool.query(
      `INSERT INTO tradigo_coaches
         (id, display_name, headline, bio, markets, specialties, languages, years_of_experience,
          hourly_rate_cents, instant_rate_per_minute_cents, currency, verification_status, approved, availability,
          teaching_method, coaching_boundaries, approval_source, approved_at, identity_verified_at, identity_verification_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'USD',$11,true,'OFFLINE',$12,$13,'TRADIGO_MODERATION',NOW(),CASE WHEN $14='VERIFIED' THEN NOW() ELSE NULL END,$15)
       ON CONFLICT (id) DO UPDATE SET
         display_name=EXCLUDED.display_name, headline=EXCLUDED.headline, bio=EXCLUDED.bio,
         markets=EXCLUDED.markets, specialties=EXCLUDED.specialties, languages=EXCLUDED.languages,
         years_of_experience=EXCLUDED.years_of_experience, hourly_rate_cents=EXCLUDED.hourly_rate_cents,
         instant_rate_per_minute_cents=EXCLUDED.instant_rate_per_minute_cents,
         verification_status=EXCLUDED.verification_status, approved=true,
         teaching_method=EXCLUDED.teaching_method, coaching_boundaries=EXCLUDED.coaching_boundaries,
         approval_source='TRADIGO_MODERATION', approved_at=NOW(),
         identity_verified_at=CASE WHEN EXCLUDED.verification_status='FULLY_VERIFIED' THEN NOW() ELSE tradigo_coaches.identity_verified_at END,
         identity_verification_source=EXCLUDED.identity_verification_source,
         updated_at=NOW()`,
      [
        application.applicant_id,
        displayName,
        headline,
        bio,
        coachMarkets,
        specialties,
        languages,
        years,
        hourlyRateCents,
        instantRatePerMinuteCents,
        verificationStatus,
        cleanText(profile.teachingMethod, 2000) || null,
        cleanText(profile.coachingBoundaries, 2000) || "Education only: no signals, guarantees, account access, or trade execution.",
        providerIdentity,
        cleanText(verification.provider, 80) || "PAYPAL",
      ],
    );
  } else {
    await ensureIdentitySchema();
    await pool.query(
      "UPDATE tradigo_users SET role=CASE WHEN role='COACH' THEN 'TRADER' ELSE role END, updated_at=NOW() WHERE id=$1",
      [application.applicant_id],
    );
  }
  await audit(id, moderator.id, `APPLICATION_${status}`, { reason });
  res.json(serializeApplication(updated.rows[0], await evidenceForApplication(id), true));
});

export default router;