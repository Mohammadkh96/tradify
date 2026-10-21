import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { ensureConductReportsSchema, ensureIdentitySchema, getModeratorIdentity } from "./tradigo";
import { ensureAdminAuditSchema, writeAdminAudit } from "./adminAudit";
import { ensureSchedulingSchema } from "../lib/tradigoScheduling";

const router: IRouter = Router();
const ACTIVE_CASE_STATUSES = ["OPEN", "IN_REVIEW"];
const REVIEW_ACTIONS = ["HIDE", "RESTORE", "ESCALATE", "APPROVE"] as const;
const REPORT_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const;

let schemaReady: Promise<void> | null = null;

function errorMessage(res: Response, status: number, message: string, details?: unknown): void {
  res.status(status).json({ error: { message, ...(details === undefined ? {} : { details }) } });
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function reasonInput(body: any): { code: string; text: string } | null {
  const code = cleanText(body?.reasonCode ?? body?.reason, 80).toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
  const text = cleanText(body?.reasonText ?? body?.reason, 500);
  if (!code || text.length < 3) return null;
  return { code, text };
}

function idempotencyKey(req: Request, action: string, targetId: string, reason: { code: string; text: string }): string {
  return cleanText(req.header("idempotency-key") ?? req.body?.idempotencyKey, 180)
    || `${action}:${targetId}:${reason.code}:${reason.text}`;
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = Promise.all([
      ensureIdentitySchema(),
      ensureConductReportsSchema(),
      ensureSchedulingSchema(),
      ensureAdminAuditSchema(),
      pool.query(`
        CREATE TABLE IF NOT EXISTS tradigo_compliance_cases (
          id text PRIMARY KEY,
          subject_user_id text NOT NULL,
          case_type text NOT NULL,
          priority text NOT NULL DEFAULT 'NORMAL',
          status text NOT NULL DEFAULT 'OPEN',
          summary text NOT NULL,
          created_by text NOT NULL,
          updated_by text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          resolved_at timestamptz
        );
        CREATE INDEX IF NOT EXISTS tradigo_compliance_cases_queue_idx
          ON tradigo_compliance_cases(status, priority, updated_at DESC);
        CREATE TABLE IF NOT EXISTS tradigo_compliance_case_notes (
          id text PRIMARY KEY,
          case_id text NOT NULL,
          author_id text NOT NULL,
          note_text text NOT NULL,
          idempotency_key text NOT NULL UNIQUE,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS tradigo_compliance_case_notes_case_idx
          ON tradigo_compliance_case_notes(case_id, created_at DESC);
        CREATE TABLE IF NOT EXISTS tradigo_review_flags (
          id text PRIMARY KEY,
          review_id text NOT NULL,
          reporter_id text,
          reason text NOT NULL,
          status text NOT NULL DEFAULT 'PENDING',
          resolved_by text,
          resolved_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS tradigo_review_flags_queue_idx
          ON tradigo_review_flags(status, created_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS tradigo_review_flags_open_review_idx
          ON tradigo_review_flags(review_id) WHERE status IN ('PENDING','ESCALATED');
      `),
    ]).then(() => undefined);
  }
  await schemaReady;
}

async function requireActor(req: Request, res: Response, adminOnly = false) {
  const actor = await getModeratorIdentity(req);
  if (!actor) {
    errorMessage(res, 403, "A signed moderator or admin account is required.");
    return null;
  }
  if (adminOnly && actor.role !== "ADMIN") {
    errorMessage(res, 403, "Only administrators can change user account status.");
    return null;
  }
  return actor;
}

function auditDto(row: Record<string, any>) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    reasonCode: row.reason_code,
    reason: row.reason_text,
    details: row.details ?? {},
    occurredAt: row.occurred_at,
  };
}

function priorityRank(priority: string): number {
  return ({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as Record<string, number>)[priority] ?? 4;
}

router.get("/admin/dashboard", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  await ensureSchema();
  try {
    const [cases, applications, reviews, users, payouts, reports, disputes, exceptions] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM tradigo_compliance_cases WHERE status = ANY($1)`, [ACTIVE_CASE_STATUSES]),
      pool.query(`SELECT COUNT(*)::int AS count FROM tradigo_coach_applications WHERE status IN ('SUBMITTED','UNDER_REVIEW','PENDING')`),
      pool.query(`
        SELECT COUNT(*)::int AS count FROM tradigo_reviews r
        LEFT JOIN tradigo_review_flags f ON f.review_id=r.id
        WHERE f.status IN ('PENDING','ESCALATED') OR (f.id IS NULL AND r.rating <= 2)
      `),
      pool.query(`SELECT COUNT(*)::int AS count FROM tradigo_users WHERE status='SUSPENDED'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM tradigo_payouts WHERE status IN ('HELD','FAILED','PROCESSING')`),
      pool.query(`SELECT COUNT(*)::int AS count FROM tradigo_conduct_reports WHERE status IN ('OPEN','IN_REVIEW')`),
      pool.query(`SELECT COUNT(*)::int AS count FROM tradigo_disputes WHERE status='OPEN'`),
      pool.query(`
        SELECT (
          (SELECT COUNT(*) FROM tradigo_payment_webhook_events WHERE status IN ('FAILED','RETRY_REQUIRED')) +
          (SELECT COUNT(*) FROM tradigo_session_events WHERE event_type='NO_SHOW_RESOLUTION_FAILED')
        )::int AS count
      `),
    ]);
    const count = (result: { rows: Record<string, any>[] }) => Number(result.rows[0]?.count ?? 0);
    res.json({
      metrics: {
        openComplianceCasesCount: count(cases),
        pendingCoachApplicationsCount: count(applications),
        flaggedReviewsCount: count(reviews),
        suspendedUsersCount: count(users),
        activePayoutHoldsCount: count(payouts),
        openReportsCount: count(reports),
        activeDisputesCount: count(disputes),
        paymentExceptionsCount: count(exceptions),
      },
      actor: { id: actor.id, role: actor.role },
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load admin dashboard");
    errorMessage(res, 500, "Unable to load the operations dashboard.");
  }
});

router.get("/admin/analytics", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  await ensureSchema();
  try {
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : new Date();
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date(to.getTime() - 30 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      errorMessage(res, 400, "Analytics requires a valid time range.");
      return;
    }
    const [events, activity, users, segments, outcomes, repeatSessions] = await Promise.all([
      pool.query(`
        WITH scoped AS (
          SELECT e.*, s.mode AS session_mode
          FROM tradigo_marketplace_events e
          LEFT JOIN tradigo_sessions s ON s.id=e.session_id
          WHERE e.occurred_at >= $1::timestamptz AND e.occurred_at < $2::timestamptz
            AND (s.mode IS NULL OR s.mode IN ('INSTANT','SCHEDULED'))
        ), coach_now AS (
          SELECT * FROM scoped
          WHERE session_mode='INSTANT'
             OR event_type='MATCH_NO_LIVE_MATCH'
             OR details->>'mode' IN ('FAST','CHOOSE','FAST_MATCH')
        )
        SELECT
          (
            COUNT(DISTINCT session_id) FILTER (WHERE event_type='REQUESTED')
            + COUNT(*) FILTER (WHERE event_type='MATCH_NO_LIVE_MATCH')
          )::int AS requests,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('ACCEPTED','COACH_ACCEPTED','COACH_CLAIMED'))::int AS matched,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type='AUTHORIZED')::int AS authorized,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type='ROOM_READY')::int AS room_ready,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type='ROOM_ENTERED')::int AS room_entered,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type='SESSION_STARTED')::int AS active,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('COMPLETED','SESSION_COMPLETED'))::int AS completed,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type='PAYOUT_PAID')::int AS settled,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('TRADER_CONFIRMED_COACH','MATCH_CONFIRMED'))::int AS confirmed,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('COACH_CLAIM_EXPIRED','MATCH_CLAIM_EXPIRED'))::int AS expired,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('MATCH_REMATCHED'))::int AS rematched,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('SESSION_CANCELLED','CANCELLED'))::int AS cancelled,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type='NO_SHOW')::int AS no_show,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('REFUND_COMPLETED','REFUNDED'))::int AS refunded,
          COUNT(*) FILTER (WHERE event_type='MATCH_NO_LIVE_MATCH')::int AS no_live_match,
          (SELECT COUNT(*)::int FROM scoped) AS event_count,
          (SELECT COUNT(DISTINCT session_id)::int FROM scoped WHERE session_id IS NOT NULL) AS session_count
        FROM coach_now
      `, [from.toISOString(), to.toISOString()]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE event_type='LEARNING_GOAL_UPDATED')::int AS goals,
          COUNT(*) FILTER (WHERE event_type='LEARNING_SUMMARY_UPDATED')::int AS summaries,
          COUNT(*) FILTER (WHERE event_type='REVIEW_SUBMITTED')::int AS reviews,
          COUNT(*) FILTER (WHERE event_type LIKE 'NOTIFICATION%')::int AS notifications
        FROM tradigo_marketplace_events
        WHERE occurred_at >= $1::timestamptz AND occurred_at < $2::timestamptz
      `, [from.toISOString(), to.toISOString()]),
      pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE role='COACH')::int AS coaches FROM tradigo_users"),
      pool.query(`
        WITH scoped AS (
          SELECT e.*, s.mode AS session_mode
          FROM tradigo_marketplace_events e
          LEFT JOIN tradigo_sessions s ON s.id=e.session_id
          WHERE e.occurred_at >= $1::timestamptz AND e.occurred_at < $2::timestamptz
            AND (s.mode='INSTANT' OR e.event_type='MATCH_NO_LIVE_MATCH')
        )
        SELECT
          COALESCE(details->>'mode', 'UNKNOWN') AS mode,
          COALESCE(details->>'instrumentClass', 'GENERAL') AS instrument_class,
          COALESCE(details->>'topic', 'GENERAL') AS topic,
          COALESCE(details->>'language', 'UNKNOWN') AS language,
          COALESCE(details->>'durationBucket', 'UNKNOWN') AS duration_bucket,
          COALESCE(details->>'timezoneBucket', 'UNKNOWN') AS timezone_bucket,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type='REQUESTED')::int AS requests,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('ACCEPTED','COACH_ACCEPTED','COACH_CLAIMED'))::int AS matched,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('TRADER_CONFIRMED_COACH','MATCH_CONFIRMED'))::int AS confirmed,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type='ROOM_ENTERED')::int AS room_entered,
          COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('COMPLETED','SESSION_COMPLETED'))::int AS completed,
          COUNT(*) FILTER (WHERE event_type='MATCH_NO_LIVE_MATCH')::int AS no_live_match
        FROM scoped
        GROUP BY 1,2,3,4,5,6
        ORDER BY requests DESC, no_live_match DESC
        LIMIT 100
      `, [from.toISOString(), to.toISOString()]),
      pool.query(`
        SELECT
          COALESCE(details->>'failureClass',
            CASE
              WHEN event_type IN ('COACH_CLAIM_EXPIRED','MATCH_CLAIM_EXPIRED') THEN 'EXPIRY'
              WHEN event_type IN ('COACH_DECLINED','TRADER_DECLINED_COACH') THEN event_type
              WHEN event_type LIKE 'PAYMENT%FAILED' OR event_type IN ('REFUND_FAILED','REFUND_RETRY_FAILED') THEN 'PAYMENT_FAILURE'
              WHEN event_type='ROOM_FAILED' THEN 'ROOM_FAILURE'
              WHEN event_type='NO_SHOW' THEN 'NO_SHOW'
              WHEN event_type IN ('SESSION_CANCELLED','CANCELLED') THEN 'CANCELLATION'
              ELSE 'OTHER'
            END
          ) AS failure_class,
          COUNT(*)::int AS count
        FROM tradigo_marketplace_events e
        LEFT JOIN tradigo_sessions s ON s.id=e.session_id
        WHERE e.occurred_at >= $1::timestamptz AND e.occurred_at < $2::timestamptz
          AND (s.mode='INSTANT' OR e.event_type='MATCH_NO_LIVE_MATCH')
          AND (
            e.event_type IN ('MATCH_NO_LIVE_MATCH','COACH_CLAIM_EXPIRED','MATCH_CLAIM_EXPIRED','COACH_DECLINED','TRADER_DECLINED_COACH','NO_SHOW','SESSION_CANCELLED','CANCELLED','ROOM_FAILED','REFUND_FAILED','REFUND_RETRY_FAILED')
            OR e.event_type LIKE 'PAYMENT%FAILED'
          )
        GROUP BY 1
        ORDER BY count DESC, failure_class
      `, [from.toISOString(), to.toISOString()]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE s.mode='INSTANT' AND s.status IN ('COMPLETED','CANCELLED'))::int AS eligible,
          COUNT(*) FILTER (
            WHERE s.mode='INSTANT' AND s.status='COMPLETED'
              AND EXISTS (
                SELECT 1 FROM tradigo_sessions prior
                WHERE prior.trader_id=s.trader_id AND prior.coach_id=s.coach_id
                  AND prior.status='COMPLETED' AND prior.created_at < s.created_at
              )
          )::int AS repeats
        FROM tradigo_sessions s
        WHERE s.created_at >= $1::timestamptz AND s.created_at < $2::timestamptz
      `, [from.toISOString(), to.toISOString()]),
    ]);
    const row = events.rows[0] ?? {};
    const count = (key: string) => Number(row[key] ?? 0);
    const percentage = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;
    const requests = count("requests");
    const completed = count("completed");
    const learningGoals = Number(activity.rows[0]?.goals ?? 0);
    const learningSummaries = Number(activity.rows[0]?.summaries ?? 0);
    const reviews = Number(activity.rows[0]?.reviews ?? 0);
    const confirmed = count("confirmed");
    const roomEntered = count("room_entered");
    const noLiveMatch = count("no_live_match");
    const repeatEligible = Number(repeatSessions.rows[0]?.eligible ?? 0);
    const repeats = Number(repeatSessions.rows[0]?.repeats ?? 0);
    const averageReview = await pool.query(`
      SELECT ROUND(AVG((details->>'rating')::numeric), 2) AS average_rating
      FROM tradigo_marketplace_events e
      LEFT JOIN tradigo_sessions s ON s.id=e.session_id
      WHERE e.event_type='REVIEW_SUBMITTED'
        AND e.occurred_at >= $1::timestamptz AND e.occurred_at < $2::timestamptz
        AND s.mode='INSTANT' AND details ? 'rating'
    `, [from.toISOString(), to.toISOString()]);
    res.json({
      analytics: {
        window: { from: from.toISOString(), to: to.toISOString(), timezone: "UTC" },
        rates: {
          matchRate: percentage(count("matched"), requests),
          paymentAuthRate: percentage(count("authorized"), requests),
          roomActivationRate: percentage(count("room_ready"), requests),
          confirmationRate: percentage(confirmed, count("matched")),
          roomEntryRate: percentage(roomEntered, count("room_ready")),
          settlementRate: percentage(count("settled"), completed),
          reviewSubmissionRate: percentage(reviews, completed),
          homeworkCompletionRate: percentage(learningSummaries, learningGoals),
          repeatSessionRate: percentage(repeats, repeatEligible),
        },
        denominators: {
          matchRate: { numerator: count("matched"), denominator: requests },
          paymentAuthRate: { numerator: count("authorized"), denominator: requests },
          roomActivationRate: { numerator: count("room_ready"), denominator: requests },
          confirmationRate: { numerator: confirmed, denominator: count("matched") },
          roomEntryRate: { numerator: roomEntered, denominator: count("room_ready") },
          settlementRate: { numerator: count("settled"), denominator: completed },
          reviewSubmissionRate: { numerator: reviews, denominator: completed },
          homeworkCompletionRate: { numerator: learningSummaries, denominator: learningGoals },
          repeatSessionRate: { numerator: repeats, denominator: repeatEligible },
        },
        eventSummary: {
          totalEvents: Number(row.event_count ?? 0),
          sessionsWithEvents: Number(row.session_count ?? 0),
          taxonomyVersion: "match-quality.v1",
          taxonomy: ["REQUESTED", "MATCH_CONTACTED", "COACH_CLAIMED", "TRADER_CONFIRMED_COACH", "COACH_DECLINED", "TRADER_DECLINED_COACH", "COACH_CLAIM_EXPIRED", "MATCH_REMATCHED", "MATCH_NO_LIVE_MATCH", "AUTHORIZED", "PAYMENT_FAILED", "ROOM_READY", "ROOM_ENTERED", "SESSION_STARTED", "COMPLETED", "NO_SHOW", "REFUND_COMPLETED", "REFUND_FAILED"],
        },
        coachNowFunnel: {
          requests, matched: count("matched"), confirmed, paymentAuthorized: count("authorized"),
          roomReady: count("room_ready"), roomEntered, active: count("active"), completed, settled: count("settled"),
          expired: count("expired"), rematched: count("rematched"), cancelled: count("cancelled"),
          noShow: count("no_show"), refunded: count("refunded"), noLiveMatch,
        },
        activitySummary: {
          totalJournalEntries: learningGoals,
          totalTradeReviews: reviews,
          totalHomeworkAssigned: learningGoals,
          totalHomeworkCompleted: learningSummaries,
          totalNotificationsDelivered: Number(activity.rows[0]?.notifications ?? 0),
        },
        outcomes: outcomes.rows.map((item) => ({ failureClass: item.failure_class, count: Number(item.count) })),
        segments: segments.rows.map((item) => ({
          mode: item.mode,
          instrumentClass: item.instrument_class,
          topic: item.topic,
          language: item.language,
          durationBucket: item.duration_bucket,
          timezoneBucket: item.timezone_bucket,
          requests: Number(item.requests),
          matched: Number(item.matched),
          confirmed: Number(item.confirmed),
          roomEntered: Number(item.room_entered),
          completed: Number(item.completed),
          noLiveMatch: Number(item.no_live_match),
        })),
        matchQuality: {
          averageReviewRating: averageReview.rows[0]?.average_rating === null || averageReview.rows[0]?.average_rating === undefined
            ? null : Number(averageReview.rows[0].average_rating),
          repeatSessions: repeats,
          repeatEligible,
          evaluationGuardrail: "Educational completion, confirmed fit, review quality, and repeat learning only; never financial performance.",
        },
        users: { total: Number(users.rows[0]?.total ?? 0), coaches: Number(users.rows[0]?.coaches ?? 0) },
      },
       actor: { id: actor.id, role: actor.role },
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load admin analytics");
    errorMessage(res, 500, "Unable to load platform analytics.");
  }
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  await ensureSchema();
  const search = cleanText(req.query.search, 160);
  const result = await pool.query(
    `SELECT id, display_name, email, role, status, created_at, updated_at
     FROM tradigo_users
     WHERE ($1='' OR display_name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR id ILIKE '%' || $1 || '%')
     ORDER BY updated_at DESC LIMIT 100`,
    [search],
  );
  res.json({
    users: result.rows.map((row) => ({
      id: row.id, displayName: row.display_name, email: row.email, role: row.role, status: row.status,
      createdAt: row.created_at, updatedAt: row.updated_at,
    })),
  });
});

router.get("/admin/users/:id", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  await ensureSchema();
  const id = String(req.params.id);
  const result = await pool.query("SELECT id, display_name, email, role, status, country_code, created_at, updated_at FROM tradigo_users WHERE id=$1", [id]);
  if (!result.rows[0]) { errorMessage(res, 404, "User not found."); return; }
  const sessions = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status='COMPLETED')::int AS completed
     FROM tradigo_sessions WHERE trader_id=$1 OR coach_id=$1`,
    [id],
  );
  res.json({
    user: {
      id: result.rows[0].id, displayName: result.rows[0].display_name, email: result.rows[0].email,
      role: result.rows[0].role, status: result.rows[0].status, countryCode: result.rows[0].country_code,
      createdAt: result.rows[0].created_at, updatedAt: result.rows[0].updated_at,
    },
    activity: sessions.rows[0] ?? { total: 0, completed: 0 },
  });
});

async function updateUserStatus(req: Request, res: Response, status: "SUSPENDED" | "BANNED" | "ACTIVE", action: string): Promise<void> {
  const actor = await requireActor(req, res, true);
  if (!actor) return;
  const reason = reasonInput(req.body);
  if (!reason) { errorMessage(res, 400, "A reason code and written reason are required."); return; }
  await ensureSchema();
  const userId = String(req.params.id);
  const key = idempotencyKey(req, action, userId, reason);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingAudit = await client.query("SELECT * FROM tradigo_admin_audit_logs WHERE idempotency_key=$1", [key]);
    if (existingAudit.rows[0]) {
      await client.query("COMMIT");
      res.json({ success: true, idempotent: true, user: (await pool.query("SELECT id, display_name, email, role, status FROM tradigo_users WHERE id=$1", [userId])).rows[0] });
      return;
    }
    const updated = await client.query(
      "UPDATE tradigo_users SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id, display_name, email, role, status",
      [status, userId],
    );
    if (!updated.rows[0]) { await client.query("ROLLBACK"); errorMessage(res, 404, "User not found."); return; }
    const audit = await writeAdminAudit(client, {
      id: randomUUID(), actorId: actor.id, actorRole: actor.role, action,
      targetType: "USER", targetId: userId, reasonCode: reason.code, reasonText: reason.text,
      idempotencyKey: key, details: { resultingStatus: status },
    });
    await client.query("COMMIT");
    res.json({
      success: true,
      idempotent: audit.idempotent,
      user: {
        id: updated.rows[0].id,
        displayName: updated.rows[0].display_name,
        email: updated.rows[0].email,
        role: updated.rows[0].role,
        status: updated.rows[0].status,
      },
      audit: auditDto(audit.row!),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to update user status");
    errorMessage(res, 500, "The account status change could not be saved.");
  } finally {
    client.release();
  }
}

router.post("/admin/users/:id/suspend", (req, res) => updateUserStatus(req, res, "SUSPENDED", "USER_SUSPENDED"));
router.post("/admin/users/:id/ban", (req, res) => updateUserStatus(req, res, "BANNED", "USER_BANNED"));
router.post("/admin/users/:id/restore", (req, res) => updateUserStatus(req, res, "ACTIVE", "USER_RESTORED"));

router.get("/admin/compliance/cases", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  await ensureSchema();
  const result = await pool.query(
    `SELECT c.*, u.display_name AS subject_name
     FROM tradigo_compliance_cases c LEFT JOIN tradigo_users u ON u.id=c.subject_user_id
     WHERE ($1='' OR c.status=$1) ORDER BY CASE c.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END, c.updated_at DESC`,
    [cleanText(req.query.status, 40)],
  );
  res.json({ cases: result.rows.map((row) => ({
    id: row.id, subjectUserId: row.subject_user_id, subjectName: row.subject_name, caseType: row.case_type,
    priority: row.priority, status: row.status, summary: row.summary, createdBy: row.created_by,
    updatedBy: row.updated_by, createdAt: row.created_at, updatedAt: row.updated_at, resolvedAt: row.resolved_at,
  })) });
});

router.post("/admin/compliance/cases", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const reason = reasonInput(req.body);
  const subjectUserId = cleanText(req.body?.subjectUserId, 160);
  const caseType = cleanText(req.body?.caseType, 60).toUpperCase();
  const summary = cleanText(req.body?.summary ?? req.body?.reasonText, 2000);
  if (!reason || !subjectUserId || !caseType || summary.length < 3) {
    errorMessage(res, 400, "A subject, case type, summary, and written reason are required.");
    return;
  }
  await ensureSchema();
  const key = idempotencyKey(req, "CASE_OPENED", subjectUserId, reason);
  const existingAudit = await pool.query("SELECT * FROM tradigo_admin_audit_logs WHERE idempotency_key=$1", [key]);
  if (existingAudit.rows[0]) {
    const existingCase = await pool.query("SELECT * FROM tradigo_compliance_cases WHERE id=$1", [existingAudit.rows[0].target_id]);
    res.status(200).json({ case: existingCase.rows[0], idempotent: true, audit: auditDto(existingAudit.rows[0]) });
    return;
  }
  const caseId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO tradigo_compliance_cases
        (id,subject_user_id,case_type,priority,status,summary,created_by,updated_by)
       VALUES ($1,$2,$3,$4,'OPEN',$5,$6,$6) RETURNING *`,
      [caseId, subjectUserId, caseType, cleanText(req.body?.priority, 20).toUpperCase() || "NORMAL", summary, actor.id],
    );
    const audit = await writeAdminAudit(client, {
      id: randomUUID(), actorId: actor.id, actorRole: actor.role, action: "CASE_OPENED",
      targetType: "COMPLIANCE_CASE", targetId: caseId, reasonCode: reason.code, reasonText: reason.text,
      idempotencyKey: key, details: { caseType, priority: inserted.rows[0].priority },
    });
    await client.query("COMMIT");
    res.status(201).json({ case: inserted.rows[0], audit: auditDto(audit.row!) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to open compliance case");
    errorMessage(res, 500, "The compliance case could not be opened.");
  } finally {
    client.release();
  }
});

router.get("/admin/compliance/cases/:id", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  await ensureSchema();
  const id = String(req.params.id);
  const result = await pool.query("SELECT * FROM tradigo_compliance_cases WHERE id=$1", [id]);
  if (!result.rows[0]) { errorMessage(res, 404, "Compliance case not found."); return; }
  const notes = await pool.query("SELECT id, author_id, note_text, created_at FROM tradigo_compliance_case_notes WHERE case_id=$1 ORDER BY created_at DESC", [id]);
  res.json({
    case: {
      id: result.rows[0].id, subjectUserId: result.rows[0].subject_user_id, caseType: result.rows[0].case_type,
      priority: result.rows[0].priority, status: result.rows[0].status, summary: result.rows[0].summary,
      createdAt: result.rows[0].created_at, updatedAt: result.rows[0].updated_at,
    },
    notes: notes.rows.map((row) => ({ id: row.id, authorId: row.author_id, noteText: row.note_text, createdAt: row.created_at })),
  });
});

router.post("/admin/compliance/cases/:id/notes", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const reason = reasonInput({ reasonCode: "CASE_NOTE", reasonText: req.body?.noteText });
  const noteText = cleanText(req.body?.noteText, 2000);
  if (!reason || noteText.length < 3) { errorMessage(res, 400, "A non-empty case note is required."); return; }
  await ensureSchema();
  const caseId = String(req.params.id);
  const key = idempotencyKey(req, "CASE_NOTE_ADDED", caseId, reason);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query("SELECT id FROM tradigo_compliance_cases WHERE id=$1 FOR UPDATE", [caseId]);
    if (!target.rows[0]) { await client.query("ROLLBACK"); errorMessage(res, 404, "Compliance case not found."); return; }
    const existing = await client.query("SELECT * FROM tradigo_compliance_case_notes WHERE idempotency_key=$1", [key]);
    if (existing.rows[0]) { await client.query("COMMIT"); res.json({ note: existing.rows[0], idempotent: true }); return; }
    const note = await client.query(
      `INSERT INTO tradigo_compliance_case_notes (id,case_id,author_id,note_text,idempotency_key)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [randomUUID(), caseId, actor.id, noteText, key],
    );
    await client.query("UPDATE tradigo_compliance_cases SET updated_by=$1, status=CASE WHEN status='OPEN' THEN 'IN_REVIEW' ELSE status END, updated_at=NOW() WHERE id=$2", [actor.id, caseId]);
    const audit = await writeAdminAudit(client, {
      id: randomUUID(), actorId: actor.id, actorRole: actor.role, action: "CASE_NOTE_ADDED",
      targetType: "COMPLIANCE_CASE", targetId: caseId, reasonCode: reason.code, reasonText: reason.text,
      idempotencyKey: `audit:${key}`, details: { noteId: note.rows[0].id },
    });
    await client.query("COMMIT");
    res.status(201).json({ note: note.rows[0], audit: auditDto(audit.row!) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to add case note");
    errorMessage(res, 500, "The case note could not be saved.");
  } finally {
    client.release();
  }
});

router.get("/admin/moderation/reviews", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  await ensureSchema();
  const result = await pool.query(`
      SELECT r.id, r.trader_id, r.coach_id, r.rating, r.comment, r.created_at,
             f.id AS flag_id, f.reason AS flag_reason, f.status AS moderation_status,
           c.display_name AS coach_name
    FROM tradigo_reviews r
    LEFT JOIN tradigo_review_flags f ON f.review_id=r.id AND f.status IN ('PENDING','ESCALATED')
    LEFT JOIN tradigo_coaches c ON c.id=r.coach_id
    WHERE f.status IN ('PENDING','ESCALATED') OR (f.id IS NULL AND r.rating <= 2)
    ORDER BY CASE WHEN f.status='ESCALATED' THEN 0 ELSE 1 END, r.created_at DESC
    LIMIT 200
  `);
  res.json({ reviews: result.rows.map((row) => ({
    id: row.id, traderId: row.trader_id, coachId: row.coach_id, coachName: row.coach_name,
    overall_rating: row.rating, review_text: row.comment, moderation_status: row.moderation_status ?? "PENDING",
    flagId: row.flag_id, flagReason: row.flag_reason, createdAt: row.created_at,
  })) });
});

router.post("/admin/moderation/reviews/:id", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const action = cleanText(req.body?.action ?? req.body?.status, 20).toUpperCase() as typeof REVIEW_ACTIONS[number];
  const reason = reasonInput(req.body);
  if (!REVIEW_ACTIONS.includes(action) || !reason) { errorMessage(res, 400, "A supported moderation action and written reason are required."); return; }
  await ensureSchema();
  const reviewId = String(req.params.id);
  const target = await pool.query("SELECT id FROM tradigo_reviews WHERE id=$1", [reviewId]);
  if (!target.rows[0]) { errorMessage(res, 404, "Review not found."); return; }
  const key = idempotencyKey(req, `REVIEW_${action}`, reviewId, reason);
  const status = action === "HIDE" ? "HIDDEN" : action === "ESCALATE" ? "ESCALATED" : "RESOLVED";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM tradigo_admin_audit_logs WHERE idempotency_key=$1", [key]);
    if (existing.rows[0]) { await client.query("COMMIT"); res.json({ success: true, idempotent: true, audit: auditDto(existing.rows[0]) }); return; }
    const flag = await client.query(
      `INSERT INTO tradigo_review_flags (id,review_id,reason,status,resolved_by,resolved_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,CASE WHEN $4 IN ('RESOLVED','HIDDEN') THEN NOW() ELSE NULL END,NOW())
       ON CONFLICT (review_id) WHERE status IN ('PENDING','ESCALATED')
       DO UPDATE SET reason=EXCLUDED.reason,status=EXCLUDED.status,resolved_by=EXCLUDED.resolved_by,resolved_at=EXCLUDED.resolved_at,updated_at=NOW()
       RETURNING *`,
      [randomUUID(), reviewId, reason.text, status, actor.id],
    );
    const audit = await writeAdminAudit(client, {
      id: randomUUID(), actorId: actor.id, actorRole: actor.role, action: `REVIEW_${action}`,
      targetType: "REVIEW", targetId: reviewId, reasonCode: reason.code, reasonText: reason.text,
      idempotencyKey: key, details: { moderationStatus: status, flagId: flag.rows[0]?.id },
    });
    await client.query("COMMIT");
    res.json({ success: true, status, idempotent: audit.idempotent, review: flag.rows[0], audit: auditDto(audit.row!) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to moderate review");
    errorMessage(res, 500, "The review moderation action could not be saved.");
  } finally {
    client.release();
  }
});

router.get("/admin/audit-logs", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  await ensureSchema();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const result = await pool.query(
    "SELECT * FROM tradigo_admin_audit_logs ORDER BY occurred_at DESC LIMIT $1",
    [limit],
  );
  res.json({ auditLogs: result.rows.map(auditDto) });
});

router.get("/admin/operations/queue", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  await ensureSchema();
  const [reports, disputes, reviews, noShows, paymentExceptions, applications, cases, payoutHolds] = await Promise.all([
    pool.query(`SELECT id, reporter_id, subject_user_id, session_id, reason, details, evidence_reference, status, created_at FROM tradigo_conduct_reports WHERE status IN ('OPEN','IN_REVIEW') ORDER BY created_at DESC LIMIT 100`),
    pool.query(`SELECT d.id, d.session_id, d.opened_by, d.reason, d.status, d.created_at, s.payment_status, s.payout_status FROM tradigo_disputes d JOIN tradigo_sessions s ON s.id=d.session_id WHERE d.status='OPEN' ORDER BY d.created_at DESC LIMIT 100`),
    pool.query(`
      SELECT r.id, r.trader_id, r.coach_id, r.rating, r.comment, r.created_at, f.status AS moderation_status, f.reason AS flag_reason
      FROM tradigo_reviews r LEFT JOIN tradigo_review_flags f ON f.review_id=r.id
      WHERE f.status IN ('PENDING','ESCALATED') OR (f.id IS NULL AND r.rating <= 2) ORDER BY r.created_at DESC LIMIT 100
    `),
    pool.query(`SELECT e.id, e.session_id, e.details, e.created_at, s.trader_id, s.coach_id, s.payment_status, s.payout_status FROM tradigo_session_events e JOIN tradigo_sessions s ON s.id=e.session_id WHERE e.event_type='NO_SHOW_RESOLUTION_FAILED' ORDER BY e.created_at DESC LIMIT 100`),
    pool.query(`SELECT e.id, e.event_id, e.session_id, e.event_type, e.status, e.error, e.received_at, s.payment_status, s.payout_status FROM tradigo_payment_webhook_events e LEFT JOIN tradigo_sessions s ON s.id=e.session_id WHERE e.status IN ('FAILED','RETRY_REQUIRED') ORDER BY e.received_at DESC LIMIT 100`),
    pool.query(`SELECT id, applicant_id, applicant_name, status, submitted_at, updated_at FROM tradigo_coach_applications WHERE status IN ('SUBMITTED','UNDER_REVIEW','PENDING') ORDER BY submitted_at DESC NULLS LAST LIMIT 100`),
    pool.query(`SELECT id, subject_user_id, case_type, priority, status, summary, created_at, updated_at FROM tradigo_compliance_cases WHERE status IN ('OPEN','IN_REVIEW') ORDER BY updated_at DESC LIMIT 100`),
    pool.query(`SELECT p.id, p.session_id, p.coach_id, p.amount_cents, p.currency, p.status, p.created_at, s.payment_status FROM tradigo_payouts p LEFT JOIN tradigo_sessions s ON s.id=p.session_id WHERE p.status IN ('HELD','PENDING','PROCESSING') ORDER BY p.created_at DESC LIMIT 100`),
  ]);
  const queue = [
    ...reports.rows.map((row) => ({ id: row.id, type: "CONDUCT_REPORT", status: row.status, priority: "HIGH", title: row.reason, summary: row.details, createdAt: row.created_at, targetId: row.subject_user_id, reporterId: row.reporter_id, sessionId: row.session_id, evidenceReference: row.evidence_reference, actions: ["RESOLVE_REPORT"] })),
    ...disputes.rows.map((row) => ({ id: row.id, type: "DISPUTE", status: row.status, priority: "HIGH", title: "Open payment dispute", summary: row.reason, createdAt: row.created_at, targetId: row.session_id, sessionId: row.session_id, actions: ["RESOLVE_DISPUTE"], paymentStatus: row.payment_status, payoutStatus: row.payout_status })),
    ...reviews.rows.map((row) => ({ id: row.id, type: "REVIEW_FLAG", status: row.moderation_status ?? "PENDING", priority: Number(row.rating) <= 1 ? "HIGH" : "NORMAL", title: "Review requires moderation", summary: row.comment, createdAt: row.created_at, targetId: row.id, actions: ["HIDE_REVIEW", "ESCALATE_REVIEW", "RESTORE_REVIEW"] })),
    ...noShows.rows.map((row) => ({ id: `no-show:${row.id}`, type: "NO_SHOW_EXCEPTION", status: "OPEN", priority: "CRITICAL", title: "No-show settlement failed", summary: row.details?.message ?? "No-show resolution failed safely.", createdAt: row.created_at, targetId: row.session_id, sessionId: row.session_id, actions: ["OPEN_CASE"], paymentStatus: row.payment_status, payoutStatus: row.payout_status })),
    ...paymentExceptions.rows.map((row) => ({ id: `payment:${row.event_id}`, type: "PAYMENT_EXCEPTION", status: row.status, priority: "CRITICAL", title: row.event_type, summary: row.error, createdAt: row.received_at, targetId: row.event_id, sessionId: row.session_id, actions: ["RETRY_PAYMENT_EXCEPTION"], paymentStatus: row.payment_status, payoutStatus: row.payout_status })),
    ...applications.rows.map((row) => ({ id: row.id, type: "COACH_APPLICATION", status: row.status, priority: "NORMAL", title: "Coach application awaiting review", summary: row.applicant_name ?? row.applicant_id, createdAt: row.submitted_at ?? row.updated_at, targetId: row.id, actions: ["REVIEW_APPLICATION"] })),
    ...cases.rows.map((row) => ({ id: row.id, type: "COMPLIANCE_CASE", status: row.status, priority: row.priority, title: row.case_type, summary: row.summary, createdAt: row.updated_at, targetId: row.subject_user_id, actions: ["ADD_CASE_NOTE"] })),
    ...payoutHolds.rows.map((row) => ({ id: row.id, type: "PAYOUT_HOLD", status: row.status, priority: "HIGH", title: "Coach payout hold", summary: `${row.amount_cents} ${row.currency} remains held for operational review.`, createdAt: row.created_at, targetId: row.coach_id, sessionId: row.session_id, actions: ["OPEN_CASE"], paymentStatus: row.payment_status, payoutStatus: row.status })),
  ].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
  res.json({ items: queue, counts: queue.reduce<Record<string, number>>((acc, item) => { acc[item.type] = (acc[item.type] ?? 0) + 1; return acc; }, {}) });
});

router.post("/admin/reports/:id/resolve", async (req, res): Promise<void> => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const reason = reasonInput(req.body);
  const status = cleanText(req.body?.status, 20).toUpperCase();
  if (!reason || !REPORT_STATUSES.includes(status as typeof REPORT_STATUSES[number]) || status === "OPEN" || status === "IN_REVIEW") {
    errorMessage(res, 400, "A resolved or dismissed status and written reason are required."); return;
  }
  await ensureSchema();
  const reportId = String(req.params.id);
  const key = idempotencyKey(req, `REPORT_${status}`, reportId, reason);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      "UPDATE tradigo_conduct_reports SET status=$1,resolved_by=$2,resolved_at=NOW(),updated_at=NOW() WHERE id=$3 AND status IN ('OPEN','IN_REVIEW') RETURNING *",
      [status, actor.id, reportId],
    );
    if (!updated.rows[0]) {
      const prior = await client.query("SELECT * FROM tradigo_conduct_reports WHERE id=$1", [reportId]);
      if (!prior.rows[0]) { await client.query("ROLLBACK"); errorMessage(res, 404, "Conduct report not found."); return; }
      await client.query("COMMIT"); res.json({ report: prior.rows[0], idempotent: true }); return;
    }
    const audit = await writeAdminAudit(client, {
      id: randomUUID(), actorId: actor.id, actorRole: actor.role, action: `REPORT_${status}`,
      targetType: "CONDUCT_REPORT", targetId: reportId, reasonCode: reason.code, reasonText: reason.text,
      idempotencyKey: key,
    });
    const report = updated.rows[0] as Record<string, unknown>;
    const sessionId = typeof report.session_id === "string" ? report.session_id : null;
    const reporterId = typeof report.reporter_id === "string" ? report.reporter_id : null;
    if (sessionId && reporterId) {
      await client.query(
        `INSERT INTO tradigo_session_events
          (session_id, actor_id, recipient_id, event_type, details)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          sessionId,
          actor.id,
          reporterId,
          `CONDUCT_REPORT_${status}`,
          { reportId, outcome: status, sessionReference: sessionId },
        ],
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, report: updated.rows[0], audit: auditDto(audit.row!) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to resolve conduct report");
    errorMessage(res, 500, "The conduct report could not be resolved.");
  } finally {
    client.release();
  }
});

export default router;