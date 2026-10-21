import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, afterEach, before, describe, it } from "node:test";
import app from "../app";
import { pool } from "@workspace/db";
import { attendanceOverlapSeconds } from "../routes/tradigo";
import { resolveDueNoShows } from "../routes/tradigo";
import { recordMarketplaceEvent } from "../lib/tradigoScheduling";

const trader = { role: "TRADER" as const, id: "demo-trader-preview" };
const coach = { role: "COACH" as const, id: "demo-coach-maya" };
const moderatorSecret = process.env.SESSION_SECRET ?? "paid-session-test-secret";
process.env.SESSION_SECRET ??= moderatorSecret;
const testSessionIds: string[] = [];
let server: Server;
let baseUrl: string;
const originalPaymentProvider = process.env.PAYMENT_PROVIDER;

type ResponseBody = Record<string, any>;

async function cleanupTestSessions() {
  await pool.query("DELETE FROM tradigo_coach_now_availability_alerts WHERE trader_id=$1", [trader.id]);
  if (!testSessionIds.length) return;
  await pool.query("DELETE FROM tradigo_reviews WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_conduct_reports WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_disputes WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_attendance_events WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_ledger_entries WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_payment_intents WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_session_events WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_marketplace_events WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_session_policy_decisions WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_rate_snapshots WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_learning_records WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_payouts WHERE session_id = ANY($1)", [testSessionIds]);
  await pool.query("DELETE FROM tradigo_sessions WHERE id = ANY($1)", [testSessionIds]);
  testSessionIds.length = 0;
}

async function request(path: string, role: typeof trader | typeof coach, init: RequestInit = {}) {
  const auth = await fetch(`${baseUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: role.role }),
  });
  const { previewToken } = await auth.json() as { previewToken: string };
  const headers = new Headers(init.headers);
  headers.set("x-tradigo-preview-session", previewToken);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}/api${path}`, { ...init, headers });
  const body = response.status === 204 ? {} : await response.json() as ResponseBody;
  return { response, body };
}

async function post(path: string, role: typeof trader | typeof coach, body: Record<string, unknown> = {}, headers?: Record<string, string>) {
  return request(path, role, { method: "POST", headers, body: JSON.stringify(body) });
}

function signedModeratorToken(): string {
  const id = "paid_session_moderator";
  const role = "MODERATOR";
  const expiresAt = Date.now() + 60_000;
  const payload = `${id}.${role}.${expiresAt}`;
  return `${payload}.${createHmac("sha256", moderatorSecret).update(payload).digest("base64url")}`;
}

async function createPaidSession(durationMinutes = 10) {
  await post("/coaches/me/presence", coach, { status: "AVAILABLE" });
  const created = await post("/coach-now/requests", trader, {
    coachId: coach.id,
    durationMinutes,
    agenda: "Lifecycle integration test",
    topic: "Risk",
  });
  assert.equal(created.response.status, 201);
  const id = created.body.session.id as string;
  testSessionIds.push(id);
  const accepted = await post(`/coach-now/requests/${id}/accept`, coach);
  assert.equal(accepted.response.status, 200);
  const authorized = await post(`/sessions/${id}/payment/authorize`, trader);
  assert.equal(authorized.response.status, 200);
  assert.equal(authorized.body.session.paymentStatus, "AUTHORIZED_SANDBOX");
  return id;
}

async function createScheduledSession() {
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const created = await post("/coach-now/requests", trader, {
    coachId: coach.id,
    mode: "scheduled",
    durationMinutes: 25,
    scheduledAt,
    agenda: "Scheduled cancellation integration test",
    topic: "Scheduling",
  });
  assert.equal(created.response.status, 201);
  const id = created.body.session.id as string;
  testSessionIds.push(id);
  return id;
}

async function createCompletedScheduledSession() {
  const scheduledAt = new Date(Date.now() + (10 + testSessionIds.length) * 24 * 60 * 60_000).toISOString();
  const created = await post("/coach-now/requests", trader, {
    coachId: coach.id,
    mode: "scheduled",
    durationMinutes: 25,
    scheduledAt,
    agenda: "Conduct notification integration test",
    topic: "Safety",
  });
  assert.equal(created.response.status, 201);
  const id = created.body.session.id as string;
  testSessionIds.push(id);
  assert.equal((await post(`/coach-now/requests/${id}/accept`, coach)).response.status, 200);
  assert.equal((await post(`/sessions/${id}/payment/authorize`, trader)).response.status, 200);
  // The production API only opens a scheduled room during its published
  // entry window. Move this fixture into that window before exercising start.
  await pool.query("UPDATE tradigo_sessions SET scheduled_at=NOW() WHERE id=$1", [id]);
  assert.equal((await post(`/sessions/${id}/start`, trader)).response.status, 200);
  assert.equal((await post(`/sessions/${id}/complete`, trader, {
    confirm: true,
    reason: "Conduct notification integration test",
  })).response.status, 200);
  return id;
}

before(async () => {
  // These tests verify the server state machine without requiring an interactive
  // PayPal payer approval. The separate paypal-sandbox test covers credentials.
  process.env.PAYMENT_PROVIDER = "sandbox";
  // A killed test process can leave an intentionally open report behind. Clear
  // only the fixed demo fixtures so report-based eligibility tests remain
  // isolated from prior runs.
  await pool.query(
    "DELETE FROM tradigo_conduct_reports WHERE subject_user_id = ANY($1::text[])",
    [[coach.id, "demo-coach-omar"]],
  );
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await cleanupTestSessions();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (originalPaymentProvider === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = originalPaymentProvider;
  await pool.end();
});

afterEach(cleanupTestSessions);

describe("paid session lifecycle", { concurrency: false }, () => {
  it("replays double-clicked bookings and serializes scheduled conflicts", async () => {
    const bookingKey = `booking-replay-${Date.now()}`;
    const booking = {
      coachId: coach.id,
      mode: "instant",
      durationMinutes: 10,
      agenda: "Double-click replay test",
      topic: "Idempotency",
      learningGoal: "Avoid duplicate requests",
    };
    const replayed = await Promise.all([
      post("/coach-now/requests", trader, booking, { "Idempotency-Key": bookingKey }),
      post("/coach-now/requests", trader, booking, { "Idempotency-Key": bookingKey }),
    ]);
    assert.deepEqual(replayed.map((result) => result.response.status).sort((a, b) => a - b), [200, 201]);
    assert.equal(replayed[0].body.session.id, replayed[1].body.session.id);
    assert.equal((await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_sessions WHERE booking_idempotency_key=$1",
      [bookingKey],
    )).rows[0].count, 1);
    testSessionIds.push(replayed[0].body.session.id);

    const scheduledAt = new Date(Date.now() + 4 * 24 * 60 * 60_000).toISOString();
    const scheduleBody = {
      coachId: coach.id,
      mode: "scheduled",
      durationMinutes: 25,
      scheduledAt,
      agenda: "Concurrent schedule conflict test",
      topic: "Calendar",
      learningGoal: "Reserve one slot",
    };
    const scheduled = await Promise.all([
      post("/coach-now/requests", trader, scheduleBody, { "Idempotency-Key": `schedule-a-${Date.now()}` }),
      post("/coach-now/requests", trader, scheduleBody, { "Idempotency-Key": `schedule-b-${Date.now()}` }),
    ]);
    assert.deepEqual(scheduled.map((result) => result.response.status).sort((a, b) => a - b), [201, 409]);
    const winner = scheduled.find((result) => result.response.status === 201);
    assert.ok(winner);
    testSessionIds.push(winner.body.session.id);
  });

  it("enforces education policy, persists scheduling decisions, exposes slots, and reports event analytics", async () => {
    const forbidden = await post("/coach-now/requests", trader, {
      coachId: coach.id,
      mode: "scheduled",
      durationMinutes: 25,
      scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60_000).toISOString(),
      agenda: "Buy now signal and guaranteed profit review",
      topic: "Execution",
    });
    assert.equal(forbidden.response.status, 422);
    assert.ok(forbidden.body.error.reasonCodes.includes("PROHIBITED_ACTIVITY"));

    const bookingKey = `policy-analytics-${Date.now()}`;
    const created = await post("/coach-now/requests", trader, {
      coachId: coach.id,
      mode: "scheduled",
      durationMinutes: 25,
      scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60_000).toISOString(),
      coachingCategory: "RISK_EDUCATION",
      instrumentClass: "FOREX",
      agenda: "Review historical risk documentation",
      topic: "Risk education",
    }, { "Idempotency-Key": bookingKey });
    assert.equal(created.response.status, 201);
    const id = created.body.session.id as string;
    testSessionIds.push(id);

    const decision = await pool.query(
      "SELECT policy_version, decision, coaching_category, instrument_class, reason_codes FROM tradigo_session_policy_decisions WHERE session_id=$1",
      [id],
    );
    assert.deepEqual(decision.rows[0], {
      policy_version: "2026-08-27.education-only.v1",
      decision: "ALLOWED",
      coaching_category: "RISK_EDUCATION",
      instrument_class: "FOREX",
      reason_codes: [],
    });
    const events = await pool.query(
      "SELECT event_type, COUNT(*)::int AS count FROM tradigo_marketplace_events WHERE session_id=$1 GROUP BY event_type",
      [id],
    );
    assert.deepEqual(events.rows, [{ event_type: "REQUESTED", count: 1 }]);

    const slots = await request(`/marketplace/coaches/${coach.id}/availability?durationMinutes=25`, trader);
    assert.equal(slots.response.status, 200);
    assert.ok(slots.body.slots.some((slot: { startsAt: string }) => slot.startsAt));

    const analyticsResponse = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { authorization: `Bearer ${signedModeratorToken()}` },
    });
    assert.equal(analyticsResponse.status, 200);
    const analytics = await analyticsResponse.json() as { analytics: { eventSummary: { totalEvents: number }; window: { from: string; to: string } } };
    assert.ok(analytics.analytics.eventSummary.totalEvents >= 1);
    assert.ok(new Date(analytics.analytics.window.from) < new Date(analytics.analytics.window.to));
  });

  it("keeps match-quality events idempotent, private, aggregate-only, and timezone-bound", async () => {
    const sessionId = await createPaidSession(10);
    const eventKey = `match-quality-idempotency-${Date.now()}`;
    const dimensions = {
      mode: "FAST",
      instrumentClass: "FOREX",
      topic: "RISK_MANAGEMENT",
      language: "English",
      durationMinutes: 10,
      durationBucket: "SHORT",
      reasonCodes: ["INSTRUMENT_FIT", "TOPIC_FIT"],
      agenda: "Do not persist this private free text",
      learningGoal: "Do not persist this private free text either",
    };
    await recordMarketplaceEvent(pool, {
      eventType: "MATCH_CONTACTED",
      sessionId,
      actorId: trader.id,
      details: dimensions,
      eventKey,
    });
    await recordMarketplaceEvent(pool, {
      eventType: "MATCH_CONTACTED",
      sessionId,
      actorId: trader.id,
      details: { learningGoal: dimensions.learningGoal, agenda: dimensions.agenda, reasonCodes: dimensions.reasonCodes, language: "English", topic: "RISK_MANAGEMENT", instrumentClass: "FOREX", durationBucket: "SHORT", durationMinutes: 10, mode: "FAST" },
      eventKey,
    });
    const stored = await pool.query(
      "SELECT COUNT(*)::int AS count, details FROM tradigo_marketplace_events WHERE event_key=$1 GROUP BY details",
      [eventKey],
    );
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0].count, 1);
    assert.equal(stored.rows[0].details.agenda, undefined);
    assert.equal(stored.rows[0].details.learningGoal, undefined);
    assert.deepEqual(stored.rows[0].details.reasonCodes, ["INSTRUMENT_FIT", "TOPIC_FIT"]);

    const boundary = new Date(Date.now() + 2_000);
    await recordMarketplaceEvent(pool, {
      eventType: "ROOM_ENTERED",
      sessionId,
      actorId: trader.id,
      details: { mode: "FAST", instrumentClass: "FOREX", topic: "RISK_MANAGEMENT", language: "english", durationBucket: "SHORT" },
      eventKey: `${eventKey}:boundary`,
      occurredAt: boundary,
    });
    const analytics = async (from: Date, to: Date) => fetch(
      `${baseUrl}/api/admin/analytics?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      { headers: { authorization: `Bearer ${signedModeratorToken()}` } },
    ).then((response) => response.json()) as Promise<{ analytics: ResponseBody }>;
    const beforeBoundary = await analytics(new Date(boundary.getTime() - 1_000), boundary);
    const afterBoundary = await analytics(boundary, new Date(boundary.getTime() + 1_000));
    assert.equal(beforeBoundary.analytics.coachNowFunnel.roomEntered, 0);
    assert.equal(afterBoundary.analytics.coachNowFunnel.roomEntered, 1);
    assert.ok(afterBoundary.analytics.segments.some((segment: ResponseBody) => segment.instrumentClass === "FOREX" && segment.topic === "RISK_MANAGEMENT"));
    assert.equal(JSON.stringify(afterBoundary.analytics).includes(trader.id), false);
    assert.equal(JSON.stringify(afterBoundary.analytics).includes(coach.id), false);

    const coachFeedback = await request("/coach-now/quality", coach);
    assert.equal(coachFeedback.response.status, 200);
    assert.ok(coachFeedback.body.feedback.reliability.requestCount >= 1);
    const traderFeedback = await request("/coach-now/quality", trader);
    assert.equal(traderFeedback.response.status, 403);
  });

  it("makes acceptance and payment authorization safe to retry", async () => {
    const created = await post("/coach-now/requests", trader, {
      coachId: coach.id,
      durationMinutes: 10,
      agenda: "Acceptance replay test",
      topic: "Replay safety",
      learningGoal: "Retry safely",
    }, { "Idempotency-Key": `accept-replay-${Date.now()}` });
    assert.equal(created.response.status, 201);
    const id = created.body.session.id as string;
    testSessionIds.push(id);

    const accepts = await Promise.all([
      post(`/coach-now/requests/${id}/accept`, coach),
      post(`/coach-now/requests/${id}/accept`, coach),
    ]);
    assert.deepEqual(accepts.map((result) => result.response.status).sort((a, b) => a - b), [200, 200]);
    assert.equal(accepts.some((result) => result.body.idempotent === true), true);
    assert.equal((await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_session_events WHERE session_id=$1 AND event_type='COACH_ACCEPTED'",
      [id],
    )).rows[0].count, 1);

    const authorizations = await Promise.all([
      post(`/sessions/${id}/payment/authorize`, trader),
      post(`/sessions/${id}/payment/authorize`, trader),
    ]);
    assert.deepEqual(authorizations.map((result) => result.response.status).sort((a, b) => a - b), [200, 200]);
    assert.equal(authorizations.some((result) => result.body.idempotent === true), true);
    assert.equal((await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_payment_intents WHERE session_id=$1 AND kind='AUTHORIZE'",
      [id],
    )).rows[0].count, 1);

    const secondRequest = await post("/coach-now/requests", trader, {
      coachId: coach.id,
      durationMinutes: 10,
      agenda: "Capacity claim test",
      topic: "Coach Now capacity",
      learningGoal: "Keep active requests bounded",
    }, { "Idempotency-Key": `capacity-replay-${Date.now()}` });
    assert.equal(secondRequest.response.status, 201);
    const secondId = secondRequest.body.session.id as string;
    testSessionIds.push(secondId);
    const capacityRejected = await post(`/coach-now/requests/${secondId}/accept`, coach);
    assert.equal(capacityRejected.response.status, 409);
    assert.equal(capacityRejected.body.error.status, "COACH_NOW_CAPACITY_REACHED");
  });

  it("keeps trader and coach identities separate through request, authorization, room entry, and reconnect", async () => {
    const id = await createPaidSession();
    const traderRoom = await post(`/sessions/${id}/room/token`, trader);
    const coachRoom = await post(`/sessions/${id}/room/token`, coach);
    assert.notEqual(traderRoom.response.status, 403);
    assert.notEqual(coachRoom.response.status, 403);
    const strangerResponse = await fetch(`${baseUrl}/api/sessions/${id}`);
    assert.equal(strangerResponse.status, 404);
    await post(`/sessions/${id}/start`, trader);
    const clientAttendance = await post(`/sessions/${id}/attendance`, trader, { eventType: "JOIN" });
    assert.equal(clientAttendance.response.status, 202);
    assert.equal(clientAttendance.body.recorded, false);
    const participantEvents = await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_attendance_events WHERE session_id=$1 AND source='PARTICIPANT'",
      [id],
    );
    assert.equal(participantEvents.rows[0].count, 0);

    assert.equal(attendanceOverlapSeconds([
      { participantId: trader.id, eventType: "JOIN", occurredAt: new Date("2026-08-25T12:00:00Z") },
      { participantId: trader.id, eventType: "LEAVE", occurredAt: new Date("2026-08-25T12:01:00Z") },
      { participantId: trader.id, eventType: "JOIN", occurredAt: new Date("2026-08-25T12:01:45Z") },
      { participantId: trader.id, eventType: "LEAVE", occurredAt: new Date("2026-08-25T12:05:00Z") },
      { participantId: coach.id, eventType: "JOIN", occurredAt: new Date("2026-08-25T12:00:10Z") },
      { participantId: coach.id, eventType: "LEAVE", occurredAt: new Date("2026-08-25T12:05:00Z") },
    ], trader.id, coach.id, 600, Date.parse("2026-08-25T12:05:00Z")), 290);
  });

  it("records signed LiveKit attendance once and ignores events after completion", async () => {
    const id = await createPaidSession();
    const previousLiveKitSecret = process.env.LIVEKIT_API_SECRET;
    const liveKitSecret = "paid-session-livekit-test-secret";
    process.env.LIVEKIT_API_SECRET = liveKitSecret;
    try {
      const roomToken = await post(`/sessions/${id}/room/token`, trader);
      assert.equal(roomToken.response.status, 200);
      await post(`/sessions/${id}/start`, trader);
      const session = await pool.query("SELECT room_name FROM tradigo_sessions WHERE id=$1", [id]);
      const roomName = String(session.rows[0]?.room_name ?? "");
      assert.ok(roomName);

      const signedWebhook = (body: string): string => {
        const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
        const claims = Buffer.from(JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + 60,
          sha256: createHash("sha256").update(body).digest("hex"),
        })).toString("base64url");
        const signature = createHmac("sha256", liveKitSecret).update(`${header}.${claims}`).digest("base64url");
        return `${header}.${claims}.${signature}`;
      };
      const joinedBody = JSON.stringify({
        room: { name: roomName },
        event: "participant_joined",
        participant: { identity: trader.id },
      });
      const sendWebhook = (body: string) => fetch(`${baseUrl}/api/webhooks/livekit`, {
        method: "POST",
        headers: { authorization: `Bearer ${signedWebhook(body)}`, "content-type": "application/json" },
        body,
      });
      assert.equal((await sendWebhook(joinedBody)).status, 204);
      assert.equal((await sendWebhook(joinedBody)).status, 204);
      const joins = await pool.query(
        "SELECT COUNT(*)::int AS count FROM tradigo_attendance_events WHERE session_id=$1 AND source='LIVEKIT_VERIFIED'",
        [id],
      );
      assert.equal(joins.rows[0].count, 1);

      await post(`/sessions/${id}/complete`, trader, { confirm: true, reason: "End the verified attendance test" });
      const lateLeaveBody = JSON.stringify({
        room: { name: roomName },
        event: "participant_left",
        participant: { identity: trader.id },
      });
      assert.equal((await sendWebhook(lateLeaveBody)).status, 204);
      const finalAttendance = await pool.query(
        "SELECT COUNT(*)::int AS count FROM tradigo_attendance_events WHERE session_id=$1 AND source='LIVEKIT_VERIFIED'",
        [id],
      );
      assert.equal(finalAttendance.rows[0].count, 1);
    } finally {
      if (previousLiveKitSecret === undefined) delete process.env.LIVEKIT_API_SECRET;
      else process.env.LIVEKIT_API_SECRET = previousLiveKitSecret;
    }
  });

  it("caps metering, settles zero attendance, and makes completion idempotent", async () => {
    const cappedId = await createPaidSession(10);
    await post(`/sessions/${cappedId}/start`, coach);
    const base = Date.now() - 20 * 60_000;
    await pool.query(
      `INSERT INTO tradigo_attendance_events
       (id, session_id, participant_id, event_type, occurred_at, source, idempotency_key)
       VALUES ($1,$2,$3,'JOIN',$4,'LIVEKIT_VERIFIED',$5),($6,$2,$7,'JOIN',$4,'LIVEKIT_VERIFIED',$8)`,
      [`a-${cappedId}`, cappedId, trader.id, new Date(base), `test:${cappedId}:trader`,
        `b-${cappedId}`, coach.id, `test:${cappedId}:coach`],
    );
    const ended = await post(`/sessions/${cappedId}/complete`, coach, { confirm: true, reason: "Cap test" });
    assert.equal(ended.response.status, 200);
    assert.equal(ended.body.receipt.billableSeconds, 600);
    const repeated = await post(`/sessions/${cappedId}/complete`, trader);
    assert.equal(repeated.response.status, 200);
    assert.deepEqual(repeated.body.receipt, ended.body.receipt);

    const emptyId = await createPaidSession();
    await post(`/sessions/${emptyId}/start`, trader);
    const empty = await post(`/sessions/${emptyId}/complete`, trader, { confirm: true, reason: "No attendance" });
    assert.equal(empty.response.status, 200);
    assert.equal(empty.body.receipt.finalAmountCents, 0);
    assert.equal(empty.body.session.paymentStatus, "SETTLED_SANDBOX");
    assert.equal(empty.body.session.payoutStatus, "HELD");
  });

  it("builds a private learning passport only after attended educational completion", async () => {
    const id = await createPaidSession();
    const beforeActive = await post(`/sessions/${id}/learning-record`, coach, {
      conceptsReviewed: "Market structure",
      evidenceDiscussed: "A shared historical example",
      sharedArtifact: "A review checklist",
      practiceSteps: "Annotate one replay",
    });
    assert.equal(beforeActive.response.status, 409);

    await post(`/sessions/${id}/start`, trader);
    const base = Date.now() - 2 * 60_000;
    await pool.query(
      `INSERT INTO tradigo_attendance_events
       (id, session_id, participant_id, event_type, occurred_at, source, idempotency_key)
       VALUES ($1,$2,$3,'JOIN',$4,'LIVEKIT_VERIFIED',$5),($6,$2,$7,'JOIN',$4,'LIVEKIT_VERIFIED',$8)`,
      [`atlas-a-${id}`, id, trader.id, new Date(base), `atlas:${id}:trader`,
        `atlas-b-${id}`, coach.id, `atlas:${id}:coach`],
    );
    const completed = await post(`/sessions/${id}/complete`, trader, { confirm: true, reason: "Learning atlas test" });
    assert.equal(completed.response.status, 200);
    assert.ok(completed.body.receipt.billableSeconds > 0);

    const saved = await post(`/sessions/${id}/learning-record`, coach, {
      conceptsReviewed: "Market structure and decision context",
      evidenceDiscussed: "Two historical examples and the reasoning used to compare them",
      sharedArtifact: "A three-question review checklist kept by both participants",
      unresolvedQuestions: "How will the checklist change across different timeframes?",
      practiceSteps: "Annotate two historical examples and write the reason for each observation",
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.learningRecord.status, "COMPLETE");
    assert.equal(saved.body.learningRecord.sharedArtifact, "A three-question review checklist kept by both participants");

    const reflection = await post(`/sessions/${id}/learning-record`, trader, {
      traderReflection: "I will slow down and write the context before I review the next example.",
    });
    assert.equal(reflection.response.status, 200);
    assert.equal(reflection.body.learningRecord.traderReflection, "I will slow down and write the context before I review the next example.");

    const passport = await request("/learning/passport", trader);
    assert.equal(passport.response.status, 200);
    assert.ok(passport.body.records.some((record: any) => record.sessionId === id && record.status === "COMPLETE"));
    assert.equal((await request("/learning/passport", coach)).response.status, 403);

    const boundary = await post(`/sessions/${id}/learning-record`, trader, {
      traderReflection: "Please send a guaranteed signal and tell me when to execute.",
    });
    assert.equal(boundary.response.status, 400);
  });

  it("does not create learning completion for empty attendance, disputes, or prohibited claims", async () => {
    const emptyId = await createPaidSession();
    await post(`/sessions/${emptyId}/start`, trader);
    await post(`/sessions/${emptyId}/complete`, trader, { confirm: true, reason: "No shared attendance" });
    const emptyNotes = await post(`/sessions/${emptyId}/learning-record`, coach, {
      conceptsReviewed: "A concept",
      evidenceDiscussed: "A context example",
      sharedArtifact: "A checklist",
      practiceSteps: "Practice the checklist",
    });
    assert.equal(emptyNotes.response.status, 409);
    const passport = await request("/learning/passport", trader);
    assert.equal(passport.response.status, 200);
    assert.equal(passport.body.records.some((record: any) => record.sessionId === emptyId), false);

    const disputedId = await createPaidSession();
    const dispute = await post(`/sessions/${disputedId}/disputes`, trader, { reason: "The educational room was unavailable" });
    assert.equal(dispute.response.status, 201);
    const disputedNotes = await post(`/sessions/${disputedId}/learning-record`, coach, {
      conceptsReviewed: "A concept",
      evidenceDiscussed: "A context example",
      sharedArtifact: "A checklist",
      practiceSteps: "Practice the checklist",
    });
    assert.equal(disputedNotes.response.status, 409);

  });

  it("serializes dispute opening and resolution while keeping payouts frozen", async () => {
    const id = await createPaidSession();
    assert.equal((await post(`/sessions/${id}/payment/authorize`, coach)).response.status, 403);
    assert.equal((await fetch(`${baseUrl}/api/sessions/${id}/disputes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "unauthorized" }),
    })).status, 403);
    const openings = await Promise.all([
      post(`/sessions/${id}/disputes`, trader, { reason: "The room ended unexpectedly" }),
      post(`/sessions/${id}/disputes`, coach, { reason: "The room ended unexpectedly" }),
    ]);
    assert.deepEqual(openings.map(({ response }) => response.status).sort(), [201, 409]);
    const dispute = openings.find(({ response }) => response.status === 201)!;
    assert.equal(dispute.body.payoutStatus, "FROZEN");
    const openDisputes = await pool.query(
      "SELECT id FROM tradigo_disputes WHERE session_id=$1 AND status='OPEN'",
      [id],
    );
    assert.equal(openDisputes.rows.length, 1);
    const openedEvents = await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_session_events WHERE session_id=$1 AND event_type='DISPUTE_OPENED'",
      [id],
    );
    assert.equal(openedEvents.rows[0].count, 1);

    const disputeId = openDisputes.rows[0].id as string;
    const moderatorToken = signedModeratorToken();
    const resolutionHeaders = {
      authorization: `Bearer ${moderatorToken}`,
      "content-type": "application/json",
      "idempotency-key": `dispute-resolution-${id}`,
    };
    const resolve = () => fetch(`${baseUrl}/api/admin/disputes/${disputeId}/resolve`, {
      method: "POST",
      headers: resolutionHeaders,
      body: JSON.stringify({ resolution: "RELEASE", reasonText: "The participant evidence was reviewed.", reasonCode: "REVIEWED" }),
    });
    const resolutions = await Promise.all([resolve(), resolve()]);
    assert.deepEqual(resolutions.map(({ status }) => status), [200, 200]);
    const resolutionBodies = await Promise.all(resolutions.map((response) => response.json() as Promise<ResponseBody>));
    assert.equal(resolutionBodies.filter((body) => body.idempotent).length, 1);
    const finalEvents = await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_session_events WHERE session_id=$1 AND event_type='DISPUTE_RESOLVED'",
      [id],
    );
    assert.equal(finalEvents.rows[0].count, 1);
    const earnings = await request("/coach/earnings", coach);
    assert.equal(earnings.response.status, 200);
  });

  it("lets only the trader submit one review after completion", async () => {
    const id = await createPaidSession();
    await post(`/sessions/${id}/start`, trader);
    await post(`/sessions/${id}/complete`, trader, { confirm: true, reason: "Complete review test" });
    assert.equal((await post(`/sessions/${id}/review`, coach, { rating: 5 })).response.status, 403);
    assert.equal((await post(`/sessions/${id}/review`, trader, { rating: 5, comment: "Clear and useful." })).response.status, 201);
    assert.equal((await post(`/sessions/${id}/review`, trader, { rating: 5 })).response.status, 409);
    const coachProfile = await request(`/marketplace/coaches/${coach.id}`, trader);
    assert.equal(coachProfile.response.status, 200);
    assert.ok(Number(coachProfile.body.ratingCount) >= 1);
    assert.ok(coachProfile.body.proof?.serviceRecord);
  });

  it("lets a session participant submit one conduct report with evidence and exposes it to moderators", async () => {
    const id = await createPaidSession();
    await post(`/sessions/${id}/start`, trader);
    await post(`/sessions/${id}/complete`, trader, { confirm: true, reason: "Conduct report test" });

    const report = {
      reason: "Boundary or policy violation",
      details: "The coach asked for account credentials during the completed consultation.",
      evidenceReference: "Session minute 08:14",
    };
    const key = `conduct-report-test-${Date.now()}`;
    const submissions = await Promise.all([
      post(`/sessions/${id}/conduct-reports`, trader, report, { "Idempotency-Key": key }),
      post(`/sessions/${id}/conduct-reports`, trader, report, { "Idempotency-Key": key }),
    ]);
    assert.deepEqual(submissions.map((result) => result.response.status).sort((a, b) => a - b), [200, 201]);
    assert.equal(submissions[0].body.report.id, submissions[1].body.report.id);
    assert.equal(submissions[0].body.report.subjectUserId, coach.id);
    assert.equal(submissions[0].body.report.evidenceReference, report.evidenceReference);
    assert.equal((await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_conduct_reports WHERE session_id=$1 AND reporter_id=$2",
      [id, trader.id],
    )).rows[0].count, 1);

    const unauthenticated = await fetch(`${baseUrl}/api/sessions/${id}/conduct-reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    });
    assert.equal(unauthenticated.status, 403);

    const queueResponse = await fetch(`${baseUrl}/api/admin/operations/queue`, {
      headers: { authorization: `Bearer ${signedModeratorToken()}` },
    });
    assert.equal(queueResponse.status, 200);
    const queue = await queueResponse.json() as { items: Array<Record<string, any>> };
    const queuedReport = queue.items.find((item) => item.id === submissions[0].body.report.id);
    assert.ok(queuedReport);
    assert.equal(queuedReport.type, "CONDUCT_REPORT");
    assert.equal(queuedReport.sessionId, id);
    assert.equal(queuedReport.evidenceReference, report.evidenceReference);
  });

  it("notifies only the reporting participant when a conduct report is resolved or dismissed", async () => {
    for (const status of ["RESOLVED", "DISMISSED"] as const) {
      const id = await createCompletedScheduledSession();
      const submitted = await post(`/sessions/${id}/conduct-reports`, trader, {
        reason: "Other conduct concern",
        details: "The participant crossed a stated boundary during the consultation.",
      });
      assert.equal(submitted.response.status, 201);

      const resolved = await fetch(`${baseUrl}/api/admin/reports/${submitted.body.report.id}/resolve`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${signedModeratorToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status,
          reasonCode: `REPORT_${status}`,
          reasonText: `Moderator reviewed the report and marked it ${status.toLowerCase()}.`,
        }),
      });
      assert.equal(resolved.status, 200);

      const traderNotifications = await request("/notifications", trader);
      const notification = traderNotifications.body.notifications.find(
        (item: { type: string }) => item.type === `CONDUCT_REPORT_${status}`,
      );
      assert.ok(notification);
      assert.equal(notification.body, `Your conduct report for session ${id} was ${status === "RESOLVED" ? "resolved" : "dismissed"}.`);
      assert.deepEqual(notification.details, {
        outcome: status,
        sessionReference: id,
      });
      assert.equal(notification.body.includes("Moderator reviewed"), false);

      const coachNotifications = await request("/notifications", coach);
      assert.equal(
        coachNotifications.body.notifications.some(
          (item: { type: string }) => item.type === `CONDUCT_REPORT_${status}`,
        ),
        false,
      );
    }
  });

  it("reschedules safely, cancels idempotently, and resolves an expired mutual no-show", async () => {
    const id = await createScheduledSession();
    const nextTime = new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString();
    const rescheduled = await post(`/sessions/${id}/reschedule`, trader, { scheduledAt: nextTime });
    assert.equal(rescheduled.response.status, 200);
    assert.equal(rescheduled.body.session.scheduledAt, nextTime);
    assert.equal(rescheduled.body.session.rescheduledFrom !== null, true);

    const cancelled = await post(`/sessions/${id}/cancel`, trader, { reason: "Plans changed" });
    assert.equal(cancelled.response.status, 200);
    assert.equal(cancelled.body.session.status, "CANCELLED");
    assert.equal(cancelled.body.session.paymentStatus, "CANCELLED");
    const repeated = await post(`/sessions/${id}/cancel`, trader, { reason: "Plans changed" });
    assert.equal(repeated.response.status, 200);
    assert.equal(repeated.body.idempotent, true);

    const noShowId = await createScheduledSession();
    await pool.query("UPDATE tradigo_sessions SET scheduled_at=NOW() - interval '2 hours' WHERE id=$1", [noShowId]);
    const sessions = await request("/sessions", trader);
    assert.equal(sessions.response.status, 200);
    const noShow = sessions.body.items.find((item: { id: string }) => item.id === noShowId);
    assert.equal(noShow.status, "CANCELLED");
    assert.equal(noShow.noShowType, "MUTUAL");
    assert.equal(noShow.paymentStatus, "CANCELLED");
  });

  it("resolves due no-shows without a participant request", async () => {
    const noShowId = await createScheduledSession();
    await pool.query("UPDATE tradigo_sessions SET scheduled_at=NOW() - interval '2 hours' WHERE id=$1", [noShowId]);

    const result = await resolveDueNoShows("test:no-show-worker");
    assert.equal(result.resolved, 1);

    const session = await pool.query(
      "SELECT status, no_show_type, cancelled_by FROM tradigo_sessions WHERE id=$1",
      [noShowId],
    );
    assert.equal(session.rows[0].status, "CANCELLED");
    assert.equal(session.rows[0].no_show_type, "MUTUAL");
    assert.equal(session.rows[0].cancelled_by, "test:no-show-worker");

    const events = await pool.query(
      "SELECT event_type, actor_id FROM tradigo_session_events WHERE session_id=$1 ORDER BY created_at",
      [noShowId],
    );
    assert.equal(events.rows.at(-1).event_type, "NO_SHOW_MUTUAL");
    assert.equal(events.rows.at(-1).actor_id, "test:no-show-worker");

    const repeated = await resolveDueNoShows("test:no-show-worker");
    assert.equal(repeated.scanned, 0);
    assert.equal(repeated.resolved, 0);
  });

  it("surfaces no-show resolution failures in session list and detail responses", async () => {
    const id = await createScheduledSession();
    const nextAction = "Retry automatically on the next worker pass; investigate if the failure persists.";
    await pool.query(
      `INSERT INTO tradigo_session_events (session_id, actor_id, event_type, details)
       VALUES ($1,$2,'NO_SHOW_RESOLUTION_FAILED',$3)`,
      [id, "test:no-show-worker", {
        message: "PayPal could not release the authorization.",
        paymentStatus: "PAYPAL_AUTHORIZED",
        retryable: true,
        nextAction,
      }],
    );

    const sessions = await request("/sessions", trader);
    assert.equal(sessions.response.status, 200);
    const listItem = sessions.body.items.find((item: { id: string }) => item.id === id);
    assert.equal(listItem.noShowResolutionFailure.message, "PayPal could not release the authorization.");
    assert.equal(listItem.noShowResolutionFailure.paymentStatus, "PAYPAL_AUTHORIZED");
    assert.equal(listItem.noShowResolutionFailure.nextAction, nextAction);

    const detail = await request(`/sessions/${id}`, trader);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.session.noShowResolutionFailure.message, "PayPal could not release the authorization.");
    assert.equal(detail.body.session.noShowResolutionFailure.retryable, true);
  });

  it("creates an idempotent Coach Now match group and lets the first coach acceptance win", async () => {
    await post("/coaches/me/presence", coach, { status: "AVAILABLE" });
    const idempotencyKey = `match-group-${Date.now()}`;
    const body = {
      mode: "FAST",
      instrumentClass: "FOREX",
      symbol: "EURUSD",
      topic: "RISK_MANAGEMENT",
      language: "English",
      experienceLevel: "INTERMEDIATE",
      durationMinutes: 25,
      maxRateCents: 300,
      learningGoal: "Understand structure",
      agenda: "Talk through the current chart structure and my review process.",
    };
    const created = await post("/coach-now/match", trader, body, { "idempotency-key": idempotencyKey });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.state, "SEARCHING");
    assert.ok(created.body.matchGroupId);
    assert.equal(created.body.items.length >= 1, true);
    assert.equal(created.body.items[0].session.paymentStatus, "NOT_STARTED");
    const sessionId = created.body.items[0].sessionId as string;
    testSessionIds.push(sessionId);

    const replayed = await post("/coach-now/match", trader, body, { "idempotency-key": idempotencyKey });
    assert.equal(replayed.response.status, 200);
    assert.equal(replayed.body.matchGroupId, created.body.matchGroupId);
    assert.equal(replayed.body.items[0].sessionId, sessionId);

    const accepted = await post(`/coach-now/requests/${sessionId}/accept`, coach);
    assert.equal(accepted.response.status, 200);
    assert.equal(accepted.body.session.status, "COACH_CLAIMED");
    assert.equal(accepted.body.session.paymentStatus, "NOT_STARTED");
    assert.ok(accepted.body.session.coachClaimExpiresAt);
    const blockedPayment = await post(`/sessions/${sessionId}/payment/authorize`, trader);
    assert.equal(blockedPayment.response.status, 409);

    const group = await request(`/coach-now/match/${created.body.matchGroupId}`, trader);
    assert.equal(group.response.status, 200);
    assert.equal(group.body.state, "COACH_CLAIMED");
    assert.equal(group.body.claimedSessionId, sessionId);
    assert.equal(group.body.acceptedSessionId, null);

    const confirmed = await post(`/coach-now/match/${created.body.matchGroupId}/confirm`, trader);
    assert.equal(confirmed.response.status, 200);
    assert.equal(confirmed.body.state, "PAYMENT_READY");
    assert.equal(confirmed.body.acceptedSessionId, sessionId);
    assert.equal(["SANDBOX_TEST_AUTHORIZATION", "PAYPAL_ORDER_CREATED"].includes(confirmed.body.items[0].session.paymentStatus), true);

    const alert = await post("/coach-now/availability-alert", trader, {
      instrumentClass: "FOREX",
      topic: "RISK_MANAGEMENT",
      language: "English",
      maxRateCents: 300,
    });
    assert.equal(alert.response.status, 201);
    const savedAlert = await pool.query(
      "SELECT trader_id, instrument_class, topic, language FROM tradigo_coach_now_availability_alerts WHERE trader_id=$1",
      [trader.id],
    );
    assert.equal(savedAlert.rows.length, 1);
    assert.deepEqual(savedAlert.rows[0], {
      trader_id: trader.id,
      instrument_class: "FOREX",
      topic: "RISK_MANAGEMENT",
      language: "English",
    });
  });

  it("returns a declined Coach Now claim to a fresh matching attempt", async () => {
    await post("/coaches/me/presence", coach, { status: "AVAILABLE" });
    const created = await post("/coach-now/match", trader, {
      mode: "FAST",
      instrumentClass: "FOREX",
      symbol: "GBPUSD",
      topic: "RISK_MANAGEMENT",
      language: "English",
      experienceLevel: "BEGINNER",
      durationMinutes: 10,
      maxRateCents: 300,
      learningGoal: "Build a safer review process",
      agenda: "Review risk management fundamentals.",
    }, { "idempotency-key": `decline-${Date.now()}` });
    assert.equal(created.response.status, 201);
    const sessionId = created.body.items[0].sessionId as string;
    testSessionIds.push(sessionId);

    const accepted = await post(`/coach-now/requests/${sessionId}/accept`, coach);
    assert.equal(accepted.body.session.status, "COACH_CLAIMED");
    const declined = await post(`/coach-now/match/${created.body.matchGroupId}/decline`, trader);
    assert.equal(declined.response.status, 200);
    assert.equal(declined.body.rematchAvailable, true);
    const cancelled = await pool.query("SELECT status, trader_declined_at FROM tradigo_sessions WHERE id=$1", [sessionId]);
    assert.equal(cancelled.rows[0].status, "CANCELLED");
    assert.ok(cancelled.rows[0].trader_declined_at);
  });

  it("rematches an expired Coach Now claim in the same group and stops at the retry limit", async () => {
    const originalOmar = (await pool.query(
      "SELECT approved, availability, markets, specialties, languages, instant_rate_per_minute_cents FROM tradigo_coaches WHERE id='demo-coach-omar'",
    )).rows[0];
    try {
      await pool.query(
        `UPDATE tradigo_coaches
         SET approved=true, availability='OFFLINE',
         markets=ARRAY['FOREX'], specialties=ARRAY['MARKET_STRUCTURE','RISK_MANAGEMENT'], languages=ARRAY['English'],
             instant_rate_per_minute_cents=100
         WHERE id='demo-coach-omar'`,
      );
      await post("/coaches/me/presence", coach, { status: "AVAILABLE" });
      const created = await post("/coach-now/match", trader, {
        mode: "FAST",
        instrumentClass: "FOREX",
        symbol: "AUDUSD",
        topic: "RISK_MANAGEMENT",
        language: "English",
        experienceLevel: "INTERMEDIATE",
        durationMinutes: 10,
        maxRateCents: 300,
        learningGoal: "Practice reading structure",
        agenda: "Review market structure and entry preparation.",
      }, { "idempotency-key": `bounded-rematch-${Date.now()}` });
      assert.equal(created.response.status, 201);
      assert.equal(created.body.rematchAttempts, 0);
      assert.equal(created.body.maxRematchAttempts, 2);
      const firstSessionId = created.body.items[0].sessionId as string;
      testSessionIds.push(firstSessionId);

      const accepted = await post(`/coach-now/requests/${firstSessionId}/accept`, coach);
      assert.equal(accepted.body.session.status, "COACH_CLAIMED");
      await pool.query(
        `UPDATE tradigo_coaches
         SET availability='AVAILABLE'
         WHERE id='demo-coach-omar'`,
      );
      await pool.query("UPDATE tradigo_sessions SET coach_claim_expires_at=NOW() - interval '1 second' WHERE id=$1", [firstSessionId]);

      const expired = await request(`/coach-now/match/${created.body.matchGroupId}`, trader);
      assert.equal(expired.body.claimExpired, true);
      assert.equal(expired.body.rematchAttempts, 1);
      assert.equal(expired.body.rematchAvailable, true);

      const rematched = await post(`/coach-now/match/${created.body.matchGroupId}/rematch`, trader);
      assert.equal(rematched.response.status, 200);
      assert.equal(rematched.body.state, "SEARCHING");
      assert.equal(rematched.body.matchGroupId, created.body.matchGroupId);
      assert.equal(rematched.body.rematchAttempts, 1);
      const secondSessionId = rematched.body.items.find((item: { state: string }) => item.state === "INVITED").sessionId as string;
      assert.ok(secondSessionId);
      testSessionIds.push(secondSessionId);

      await pool.query(
        `UPDATE tradigo_sessions
         SET status='COACH_CLAIMED', coach_claim_expires_at=NOW() - interval '1 second'
         WHERE id=$1`,
        [secondSessionId],
      );
      const terminal = await request(`/coach-now/match/${created.body.matchGroupId}`, trader);
      assert.equal(terminal.body.claimExpired, true);
      assert.equal(terminal.body.rematchAttempts, 2);
      assert.equal(terminal.body.maxRematchAttempts, 2);
      assert.equal(terminal.body.rematchAvailable, false);
      assert.equal(terminal.body.state, "NO_LIVE_MATCH");
      assert.match(terminal.body.fallback.message, /maximum number of attempts/i);
    } finally {
      await pool.query(
        `UPDATE tradigo_coaches
         SET approved=$1, availability=$2, markets=$3, specialties=$4, languages=$5, instant_rate_per_minute_cents=$6
         WHERE id='demo-coach-omar'`,
        [
          originalOmar.approved,
          originalOmar.availability,
          originalOmar.markets,
          originalOmar.specialties,
          originalOmar.languages,
          originalOmar.instant_rate_per_minute_cents,
        ],
      );
    }
  });

  it("expires an unconfirmed Coach Now claim without creating payment setup", async () => {
    await post("/coaches/me/presence", coach, { status: "AVAILABLE" });
    const created = await post("/coach-now/match", trader, {
      mode: "FAST",
      instrumentClass: "FOREX",
      symbol: "USDJPY",
      topic: "RISK_MANAGEMENT",
      language: "English",
      experienceLevel: "INTERMEDIATE",
      durationMinutes: 10,
      maxRateCents: 300,
      learningGoal: "Practice entries",
      agenda: "Review market structure and entry preparation.",
    }, { "idempotency-key": `expiry-${Date.now()}` });
    assert.equal(created.response.status, 201);
    const sessionId = created.body.items[0].sessionId as string;
    testSessionIds.push(sessionId);

    const accepted = await post(`/coach-now/requests/${sessionId}/accept`, coach);
    assert.equal(accepted.body.session.status, "COACH_CLAIMED");
    await pool.query("UPDATE tradigo_sessions SET coach_claim_expires_at=NOW() - interval '1 second' WHERE id=$1", [sessionId]);
    const expired = await request(`/coach-now/match/${created.body.matchGroupId}`, trader);
    assert.equal(expired.response.status, 200);
    assert.equal(expired.body.claimExpired, true);
    assert.equal(expired.body.state, "NO_LIVE_MATCH");
    assert.equal(expired.body.rematchAttempts, 1);
    assert.equal(expired.body.rematchAvailable, true);
    const terminal = await post(`/coach-now/match/${created.body.matchGroupId}/rematch`, trader);
    assert.equal(terminal.response.status, 200);
    assert.equal(terminal.body.state, "NO_LIVE_MATCH");
    assert.equal(terminal.body.rematchAvailable, false);
    assert.match(terminal.body.fallback.message, /eligible coach is available/i);
    const expiredSession = await pool.query("SELECT status, payment_status FROM tradigo_sessions WHERE id=$1", [sessionId]);
    assert.deepEqual(expiredSession.rows[0], { status: "CANCELLED", payment_status: "CANCELLED" });
  });
});
