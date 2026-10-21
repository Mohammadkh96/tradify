import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, afterEach, before, describe, it } from "node:test";
import { Storage } from "@google-cloud/storage";
import app from "../app";
import { pool } from "@workspace/db";

type PreviewRole = { role: "COACH" | "TRADER" };
const coach: PreviewRole = { role: "COACH" };
const trader: PreviewRole = { role: "TRADER" };
const applicationIds: string[] = [];
const identityEventIds: string[] = [];
const questionIds: string[] = [];
const objectPaths: string[] = [];
let server: Server;
let baseUrl: string;

type ResponseBody = Record<string, any>;

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: "http://127.0.0.1:1106/token",
    type: "external_account",
    credential_source: {
      url: "http://127.0.0.1:1106/credential",
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

async function previewToken(role: PreviewRole["role"]): Promise<string> {
  const auth = await fetch(`${baseUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role }),
  });
  assert.equal(auth.status, 200);
  const { previewToken: token } = await auth.json() as { previewToken: string };
  return token;
}

async function request(path: string, role: PreviewRole, init: RequestInit = {}) {
  const token = await previewToken(role.role);
  const headers = new Headers(init.headers);
  headers.set("x-tradigo-preview-session", token);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}/api${path}`, { ...init, headers });
  const body = response.status === 204 ? {} : await response.json() as ResponseBody;
  return { response, body };
}

async function put(path: string, body: Record<string, unknown>) {
  return request(path, coach, { method: "PUT", body: JSON.stringify(body) });
}

async function post(path: string, body: Record<string, unknown> = {}, role: PreviewRole = coach) {
  return request(path, role, { method: "POST", body: JSON.stringify(body) });
}

async function adminRequest(path: string, init: RequestInit = {}) {
  const token = await previewToken("TRADER");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}/api${path}`, { ...init, headers });
  const body = response.status === 204 ? {} : await response.json() as ResponseBody;
  return { response, body };
}

function signedModeratorToken(role: "ADMIN" | "MODERATOR" = "ADMIN"): string {
  assert.ok(process.env.SESSION_SECRET);
  const id = `test-moderator-${randomUUID()}`;
  const expiresAt = Date.now() + 60_000;
  const payload = `${id}.${role}.${expiresAt}`;
  const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function signedModeratorRequest(path: string, init: RequestInit = {}, token = signedModeratorToken()) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}/api${path}`, { ...init, headers });
  const body = response.status === 204 ? {} : await response.json() as ResponseBody;
  return { response, body };
}

function objectReference(objectPath: string): { bucketName: string; objectName: string } {
  const privateParts = (process.env.PRIVATE_OBJECT_DIR ?? "").split("/").filter(Boolean);
  const relativeObjectPath = objectPath.replace(/^\/objects\//, "");
  if (privateParts.length < 2 || !relativeObjectPath) throw new Error("Private object storage is not configured.");
  return {
    bucketName: privateParts[0],
    objectName: `${privateParts.slice(1).join("/")}/${relativeObjectPath}`,
  };
}

async function deletePrivateObject(objectPath: string): Promise<void> {
  const { bucketName, objectName } = objectReference(objectPath);
  await storage.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
}

async function cleanupApplications(): Promise<void> {
  if (!applicationIds.length && !identityEventIds.length) return;
  const ids = [...applicationIds];
  if (ids.length) {
    await pool.query("DELETE FROM tradigo_identity_webhook_events WHERE application_id = ANY($1)", [ids]);
    await pool.query("DELETE FROM tradigo_application_audit WHERE application_id = ANY($1)", [ids]);
    await pool.query("DELETE FROM tradigo_assessment_answers WHERE attempt_id IN (SELECT id FROM tradigo_assessment_attempts WHERE application_id = ANY($1))", [ids]);
    await pool.query("DELETE FROM tradigo_assessment_attempts WHERE application_id = ANY($1)", [ids]);
    await pool.query("DELETE FROM tradigo_application_documents WHERE application_id = ANY($1)", [ids]);
    await pool.query("DELETE FROM tradigo_coach_applications WHERE id = ANY($1)", [ids]);
  }
  if (identityEventIds.length) await pool.query("DELETE FROM tradigo_identity_webhook_events WHERE event_id = ANY($1)", [identityEventIds]);
  applicationIds.splice(0, ids.length);
  identityEventIds.splice(0, identityEventIds.length);
}

before(async () => {
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await Promise.all(objectPaths.map(deletePrivateObject));
  await cleanupApplications();
  if (questionIds.length) {
    await pool.query("DELETE FROM tradigo_assessment_questions WHERE id = ANY($1)", [questionIds]);
  }
  await new Promise<void>(resolve => server.close(() => resolve()));
});

afterEach(cleanupApplications);

describe("coach application evidence lifecycle", () => {
  it("processes PayPal staging decisions with the exact signed callback contract", async () => {
    const previousSecret = process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
    process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET = "identity-webhook-test-secret";
    const secret = process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
    const sensitiveMarkers = {
      image: "staging-government-id-image-must-never-be-stored",
      address: "staging-home-address-must-never-be-stored",
      taxId: "staging-tax-id-must-never-be-stored",
    };

    const fixtures = [
      {
        providerStatus: "approved",
        expectedDecision: "VERIFIED",
        eventId: `paypal-identity-approved-${randomUUID()}`,
        providerReference: "PAYPAL-KYC-APPROVED-51",
        reasonCodes: ["NAME_MATCHED", "LIVENESS_PASSED"],
        checks: {
          document_name_match: "passed",
          document_validity: "PASS",
          liveness: "PASS",
          sanctions_screening: "clear",
        },
      },
      {
        providerStatus: "declined",
        expectedDecision: "DECLINED",
        eventId: `paypal-identity-declined-${randomUUID()}`,
        providerReference: "PAYPAL-KYC-DECLINED-52",
        reasonCodes: ["DOCUMENT_EXPIRED"],
        checks: {
          document_name_match: "failed",
          document_validity: "FAIL",
          liveness: "REVIEW",
          sanctions_screening: "PASS",
        },
      },
      {
        providerStatus: "pending",
        expectedDecision: "PENDING",
        eventId: `paypal-identity-pending-${randomUUID()}`,
        providerReference: "PAYPAL-KYC-PENDING-53",
        reasonCodes: ["MANUAL_REVIEW_REQUIRED"],
        checks: {
          document_name_match: "PASS",
          document_validity: "REVIEW",
          liveness: "NOT_CHECKED",
          sanctions_screening: "NOT_CHECKED",
        },
      },
    ] as const;

    const signFixture = (payload: string, timestamp: string): string =>
      `sha256=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;

    try {
      for (const fixture of fixtures) {
        const applicationId = randomUUID();
        applicationIds.push(applicationId);
        await pool.query(
          `INSERT INTO tradigo_coach_applications
            (id, applicant_id, applicant_name, applicant_email, status, verification)
           VALUES ($1,$2,$3,$4,'UNDER_REVIEW',$5::jsonb)`,
          [applicationId, `applicant-${applicationId}`, "Webhook Applicant", "webhook@example.com", JSON.stringify({ provider: "PAYPAL", providerReference: "old-reference" })],
        );

        const payload = JSON.stringify({
          id: fixture.eventId,
          event_type: "IDENTITY.REVIEW.UPDATED",
          resource: {
            id: fixture.providerReference,
            custom_id: applicationId,
            verification_status: fixture.providerStatus,
            created_at: "2026-08-26T10:15:00.000Z",
            check_results: fixture.checks,
            reason_codes: fixture.reasonCodes,
            message: `PayPal staging identity result: ${fixture.providerStatus}.`,
            documents: [{ type: "GOVERNMENT_ID", image_base64: sensitiveMarkers.image }],
            personal_data: {
              home_address: sensitiveMarkers.address,
              tax_id: sensitiveMarkers.taxId,
            },
          },
        });
        const timestamp = String(Math.floor(Date.now() / 1000));
        const headers = {
          "content-type": "application/json",
          "x-identity-provider": "PAYPAL",
          "x-paypal-identity-timestamp": timestamp,
          "x-paypal-identity-signature": signFixture(payload, timestamp),
        };
        const response = await fetch(`${baseUrl}/api/webhooks/provider-identity`, {
          method: "POST",
          headers,
          body: payload,
        });
        assert.equal(response.status, 200);
        assert.equal((await response.json() as Record<string, unknown>).status, "PROCESSED");

        const application = await pool.query("SELECT verification FROM tradigo_coach_applications WHERE id=$1", [applicationId]);
        const verification = application.rows[0].verification as Record<string, any>;
        assert.equal(verification.identity, fixture.expectedDecision);
        assert.equal(verification.providerReference, fixture.providerReference);
        assert.equal(verification.identityDecision.source, "PROVIDER_WEBHOOK");
        assert.equal(verification.identityDecision.providerEventId, fixture.eventId);
        assert.deepEqual(verification.identityDecision.reasonCodes, fixture.reasonCodes);
        assert.equal("documents" in verification, false);
        assert.equal("personal_data" in verification, false);

        const history = await pool.query(
          "SELECT details FROM tradigo_application_audit WHERE application_id=$1 AND action='IDENTITY_VERIFICATION_DECISION'",
          [applicationId],
        );
        assert.equal(history.rows.length, 1);
        const details = history.rows[0].details as Record<string, any>;
        assert.equal(details.providerEventId, fixture.eventId);
        assert.equal("documents" in details, false);
        assert.equal("personal_data" in details, false);

        const events = await pool.query(
          "SELECT status, payload_hash FROM tradigo_identity_webhook_events WHERE provider='PAYPAL' AND event_id=$1",
          [fixture.eventId],
        );
        assert.equal(events.rows.length, 1);
        assert.equal(events.rows[0].status, "PROCESSED");
        assert.equal(typeof events.rows[0].payload_hash, "string");
        assert.doesNotMatch(JSON.stringify({ verification, details, event: events.rows[0] }), new RegExp(`${sensitiveMarkers.image}|${sensitiveMarkers.address}|${sensitiveMarkers.taxId}`));
      }
    } finally {
      if (previousSecret === undefined) delete process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
      else process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET = previousSecret;
    }
  });

  it("retains unmatched signed callbacks and lets moderators link and retry them once", async () => {
    const previousSecret = process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
    process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET = "identity-webhook-test-secret";
    const secret = process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
    const eventId = `paypal-identity-unmatched-${randomUUID()}`;
    const applicationId = randomUUID();
    identityEventIds.push(eventId);
    applicationIds.push(applicationId);
    const payload = JSON.stringify({
      id: eventId,
      provider: "PAYPAL",
      verification_status: "approved",
      message: "raw provider payload must never be exposed",
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;

    try {
      const callback = await fetch(`${baseUrl}/api/webhooks/provider-identity`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-identity-provider": "PAYPAL",
          "x-paypal-identity-timestamp": timestamp,
          "x-paypal-identity-signature": signature,
        },
        body: payload,
      });
      assert.equal(callback.status, 202);
      assert.equal((await callback.json() as ResponseBody).status, "FAILED");

      const visible = await signedModeratorRequest("/admin/identity-webhook-events");
      assert.equal(visible.response.status, 200);
      const event = (visible.body.events as ResponseBody[]).find(item => item.eventId === eventId);
      assert.ok(event);
      assert.equal(event.status, "FAILED");
      assert.equal(event.applicationId, null);
      assert.equal("payload" in event, false);
      assert.doesNotMatch(JSON.stringify(event), /raw provider payload must never be exposed/);

      await pool.query(
        `INSERT INTO tradigo_coach_applications
          (id, applicant_id, applicant_name, applicant_email, status, verification)
         VALUES ($1,$2,$3,$4,'UNDER_REVIEW',$5::jsonb)`,
        [applicationId, `applicant-${applicationId}`, "Recovery Applicant", "recovery@example.com", JSON.stringify({ provider: "PAYPAL" })],
      );
      const linked = await signedModeratorRequest(`/admin/identity-webhook-events/${event.id}/link`, {
        method: "POST",
        body: JSON.stringify({ applicationId }),
      });
      assert.equal(linked.response.status, 200);
      assert.equal(linked.body.event.applicationId, applicationId);

      const retried = await signedModeratorRequest(`/admin/identity-webhook-events/${event.id}/retry`, { method: "POST" });
      assert.equal(retried.response.status, 200);
      assert.equal(retried.body.event.status, "PROCESSED");
      assert.equal(retried.body.idempotent, false);

      const repeated = await signedModeratorRequest(`/admin/identity-webhook-events/${event.id}/retry`, { method: "POST" });
      assert.equal(repeated.response.status, 200);
      assert.equal(repeated.body.idempotent, true);

      const history = await pool.query(
        `SELECT action FROM tradigo_application_audit
         WHERE application_id=$1 ORDER BY created_at`,
        [applicationId],
      );
      assert.deepEqual(history.rows.map(row => row.action), [
        "IDENTITY_CALLBACK_LINKED",
        "IDENTITY_VERIFICATION_DECISION",
        "IDENTITY_CALLBACK_RETRIED",
      ]);
    } finally {
      if (previousSecret === undefined) delete process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
      else process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET = previousSecret;
    }
  });

  it("rejects a PayPal callback with the wrong encoding, body, or timestamp", async () => {
    const previousSecret = process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
    process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET = "identity-webhook-test-secret";
    const secret = process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
    const applicationId = randomUUID();
    const eventId = `paypal-identity-signature-${randomUUID()}`;
    applicationIds.push(applicationId);
    await pool.query(
      `INSERT INTO tradigo_coach_applications
        (id, applicant_id, applicant_name, applicant_email, status, verification)
       VALUES ($1,$2,$3,$4,'UNDER_REVIEW',$5::jsonb)`,
      [applicationId, `applicant-${applicationId}`, "Signature Applicant", "signature@example.com", JSON.stringify({ provider: "PAYPAL" })],
    );
    const payload = JSON.stringify({
      id: eventId,
      provider: "PAYPAL",
      application_id: applicationId,
      verification_status: "approved",
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const baseHeaders = {
      "content-type": "application/json",
      "x-identity-provider": "PAYPAL",
      "x-paypal-identity-timestamp": timestamp,
    };

    try {
      const wrongEncoding = await fetch(`${baseUrl}/api/webhooks/provider-identity`, {
        method: "POST",
        headers: { ...baseHeaders, "x-paypal-identity-signature": Buffer.from(digest, "hex").toString("base64") },
        body: payload,
      });
      assert.equal(wrongEncoding.status, 401);

      const wrongBody = JSON.stringify({ id: eventId, provider: "PAYPAL", application_id: applicationId, verification_status: "declined" });
      const mismatchedBody = await fetch(`${baseUrl}/api/webhooks/provider-identity`, {
        method: "POST",
        headers: { ...baseHeaders, "x-paypal-identity-signature": `sha256=${digest}` },
        body: wrongBody,
      });
      assert.equal(mismatchedBody.status, 401);

      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 11 * 60);
      const stale = await fetch(`${baseUrl}/api/webhooks/provider-identity`, {
        method: "POST",
        headers: {
          ...baseHeaders,
          "x-paypal-identity-timestamp": staleTimestamp,
          "x-paypal-identity-signature": `sha256=${createHmac("sha256", secret).update(`${staleTimestamp}.${payload}`).digest("hex")}`,
        },
        body: payload,
      });
      assert.equal(stale.status, 401);

      const millisecondsTimestamp = String(Date.now());
      const nonCanonicalTimestamp = await fetch(`${baseUrl}/api/webhooks/provider-identity`, {
        method: "POST",
        headers: {
          ...baseHeaders,
          "x-paypal-identity-timestamp": millisecondsTimestamp,
          "x-paypal-identity-signature": `sha256=${createHmac("sha256", secret).update(`${millisecondsTimestamp}.${payload}`).digest("hex")}`,
        },
        body: payload,
      });
      assert.equal(nonCanonicalTimestamp.status, 401);
    } finally {
      if (previousSecret === undefined) delete process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
      else process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET = previousSecret;
    }
  });

  it("requires fresh timestamp-bound identity events with a payload-bound event ID", async () => {
    const previousSecret = process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
    const secret = "identity-webhook-generic-test-secret";
    process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET = secret;
    const applicationId = randomUUID();
    const eventId = `generic-identity-${randomUUID()}`;
    applicationIds.push(applicationId);
    identityEventIds.push(eventId);
    await pool.query(
      `INSERT INTO tradigo_coach_applications
        (id, applicant_id, applicant_name, applicant_email, status, verification)
       VALUES ($1,$2,$3,$4,'UNDER_REVIEW',$5::jsonb)`,
      [applicationId, `applicant-${applicationId}`, "Generic Webhook Applicant", "generic-webhook@example.com", JSON.stringify({ provider: "TEST_PROVIDER" })],
    );
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sign = (rawBody: Buffer, at = timestamp) => `sha256=${createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${at}.`), rawBody])).digest("hex")}`;
    const send = (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
      const rawBody = Buffer.from(JSON.stringify(body));
      return fetch(`${baseUrl}/api/webhooks/provider-identity`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-identity-provider": "TEST_PROVIDER",
          "x-tradigo-identity-timestamp": timestamp,
          "x-tradigo-identity-signature": sign(rawBody),
          ...headers,
        },
        body: rawBody,
      });
    };

    try {
      const validPayload = {
        id: eventId,
        application_id: applicationId,
        provider_reference: "TEST-IDENTITY-REFERENCE",
        verification_status: "approved",
      };
      const rawBody = Buffer.from(JSON.stringify(validPayload));
      const bodyOnly = await fetch(`${baseUrl}/api/webhooks/provider-identity`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-identity-provider": "TEST_PROVIDER",
          "x-tradigo-identity-signature": createHmac("sha256", secret).update(rawBody).digest("hex"),
        },
        body: rawBody,
      });
      assert.equal(bodyOnly.status, 401);

      const headerOnlyId = await send({
        application_id: applicationId,
        verification_status: "approved",
      }, { "x-provider-event-id": eventId });
      assert.equal(headerOnlyId.status, 400);

      const mismatchedId = await send(validPayload, { "x-provider-event-id": `${eventId}-different` });
      assert.equal(mismatchedId.status, 400);

      const accepted = await send(validPayload);
      assert.equal(accepted.status, 200);
      const duplicate = await send(validPayload);
      assert.equal(duplicate.status, 200);
      assert.equal((await duplicate.json() as ResponseBody).status, "DUPLICATE");

      const altered = await send({ ...validPayload, verification_status: "pending" });
      assert.equal(altered.status, 409);
    } finally {
      if (previousSecret === undefined) delete process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET;
      else process.env.TRADIGO_IDENTITY_WEBHOOK_SECRET = previousSecret;
    }
  });

  it("persists a draft, stores both scored attempts, and exposes review evidence", async () => {
    const loaded = await request("/coaches/application", coach);
    assert.equal(loaded.response.status, 200);
    const applicationId = loaded.body.id as string;
    applicationIds.push(applicationId);

    const draftStatus = await request("/coaches/application/status", coach);
    assert.equal(draftStatus.response.status, 200);
    assert.equal(draftStatus.body.id, applicationId);
    assert.equal(draftStatus.body.status, "DRAFT");
    assert.equal(draftStatus.body.reviewerNote, null);

    const profile = await put("/coaches/application", {
      step: 1,
      data: {
        headline: "Process-first market educator",
        bio: "I teach learners to review uncertainty and build repeatable habits.",
        teachingMethod: "Annotated review followed by a written practice step.",
        coachingBoundaries: "No signals, account access, execution, guarantees, or performance promises.",
        languages: ["English", "Arabic"],
        hourlyRateCents: 7500,
      },
    });
    assert.equal(profile.response.status, 200);

    assert.equal((await put("/coaches/application", {
      step: 2,
      data: { markets: ["FOREX"], coachingSpecialties: ["RISK_MANAGEMENT"], methodologies: ["Risk framework"] },
    })).response.status, 200);
    assert.equal((await put("/coaches/application", {
      step: 3,
      data: { yearsExperience: 6, background: "Six years studying and documenting FX market structure.", teachingExperience: "Peer mentoring and group workshops.", availability: "Weekday evenings." },
    })).response.status, 200);

    const assessments = await request("/coaches/assessments", coach);
    assert.equal(assessments.response.status, 200);
    const correctIndexes: Record<string, number[]> = { knowledge: [1, 2, 1, 1, 2], safety: [2, 1, 2, 2, 2] };
    for (const type of ["knowledge", "safety"] as const) {
      const answers = Object.fromEntries((assessments.body[type] as Array<{ id: string; options: string[] }>).map((question, index) => [question.id, question.options[correctIndexes[type][index]]]));
      const submitted = await post("/coaches/assessments/submit", { type: type.toUpperCase(), answers });
      assert.equal(submitted.response.status, 200);
      assert.equal(submitted.body.status, "PASSED");
    }

    assert.equal((await put("/coaches/application", {
      step: 6,
      data: { remoteControl: "v1.0", credentials: "v1.0", offPlatform: "v1.0", jurisdiction: "v1.0" },
    })).response.status, 200);
    const document = await post("/coaches/application/documents", {
      documentType: "TEACHING_SAMPLE",
      name: "Annotated review sample",
      description: "A sample lesson plan for risk review.",
      issuer: "Applicant",
    });
    assert.equal(document.response.status, 201);

    const submitted = await post("/coaches/application/submit");
    assert.equal(submitted.response.status, 200);
    assert.equal(submitted.body.status, "UNDER_REVIEW");
    assert.equal(submitted.body.assessmentAttempts.length, 2);
    assert.equal(submitted.body.documents.length, 2);
    assert.deepEqual(submitted.body.reviewFlags, []);

    const reviewStatus = await request("/coaches/application/status", coach);
    assert.equal(reviewStatus.response.status, 200);
    assert.equal(reviewStatus.body.status, "UNDER_REVIEW");
    assert.equal(reviewStatus.body.reviewerNote, null);

    await pool.query(
      "UPDATE tradigo_coach_applications SET verification = verification || $1::jsonb WHERE id=$2",
      [JSON.stringify({
        provider: "PAYPAL",
        hostedReviewUrl: "https://www.paypal.com/compliance/review/application-51",
        providerReference: "PAYPAL-KYC-APPLICATION-51",
        hostedReviewUrlExpiresAt: "2099-01-01T00:00:00.000Z",
        lastCheckedAt: "2026-08-26T10:00:00.000Z",
      }), applicationId],
    );
    const coachView = await request("/coaches/application", coach);
    assert.equal(coachView.response.status, 200);
    assert.equal("hostedReviewUrl" in coachView.body.verifications, false);
    assert.equal("providerReference" in coachView.body.verifications, false);

    const reviewed = await signedModeratorRequest(`/admin/applications/${applicationId}`);
    const reviewedBody = reviewed.body;
    assert.equal(reviewed.response.status, 200);
    assert.equal(reviewedBody.assessmentAttempts[0].answers.length, 5);
    assert.equal(reviewedBody.documents.some((item: any) => item.type === "TEACHING_SAMPLE"), true);
    assert.equal(reviewedBody.verifications.providerReviewStatus, "AVAILABLE");
    assert.equal(reviewedBody.verifications.hostedReviewUrl, "https://www.paypal.com/compliance/review/application-51");
    assert.equal(reviewedBody.verifications.providerReference, "PAYPAL-KYC-APPLICATION-51");

    const identityDecision = await signedModeratorRequest(`/admin/applications/${applicationId}/identity-decision`, {
      method: "POST",
      body: JSON.stringify({
        decision: "VERIFIED",
        provider: "PAYPAL",
        source: "PROVIDER_PORTAL",
        basis: "Provider matched the legal name, validated the document, completed liveness, and returned no sanctions match.",
        checks: {
          documentNameMatch: "PASS",
          documentValidity: "PASS",
          liveness: "PASS",
          sanctionsScreening: "PASS",
        },
        providerReference: "PAYPAL-KYC-APPLICATION-51",
      }),
    });
    assert.equal(identityDecision.response.status, 200);
    assert.equal(identityDecision.body.verifications.identityDecision.decision, "VERIFIED");
    assert.equal(identityDecision.body.verifications.identityDecision.responsibleParty, "PAYPAL identity verification service");
    assert.match(identityDecision.body.verifications.identityDecision.recordedBy, /^test-moderator-/);
    assert.equal(identityDecision.body.verifications.identityDecision.checks.liveness, "PASS");
    assert.equal(identityDecision.body.verifications.identityHistory.length, 1);
    assert.match(identityDecision.body.verifications.identityHistory[0].actorId, /^test-moderator-/);

    const coachAfterDecision = await request("/coaches/application", coach);
    assert.equal("identityDecision" in coachAfterDecision.body.verifications, false);
    assert.equal("identityHistory" in coachAfterDecision.body.verifications, false);

    const missingChecklist = await signedModeratorRequest(`/admin/applications/${applicationId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision: "APPROVE", reason: "Evidence reviewed without checklist acknowledgements." }),
    });
    assert.equal(missingChecklist.response.status, 409);
    assert.deepEqual(missingChecklist.body.error.missingChecklist.sort(), ["compliance", "experience", "knowledge", "profile", "safety"]);

    const approved = await signedModeratorRequest(`/admin/applications/${applicationId}/decision`, {
      method: "POST",
      body: JSON.stringify({
        decision: "APPROVE",
        reason: "Profile, scope, assessments, compliance, and provider identity evidence reviewed.",
        reviewChecklist: { profile: true, experience: true, knowledge: true, safety: true, compliance: true },
      }),
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.status, "APPROVED");
    assert.deepEqual(approved.body.reviewChecklist, { profile: true, experience: true, knowledge: true, safety: true, compliance: true });

    const approvedStatus = await request("/coaches/application/status", coach);
    assert.equal(approvedStatus.response.status, 200);
    assert.equal(approvedStatus.body.status, "APPROVED");

    await pool.query(
      "UPDATE tradigo_coach_applications SET verification = verification || $1::jsonb WHERE id=$2",
      [JSON.stringify({ hostedReviewUrlExpiresAt: "2020-01-01T00:00:00.000Z" }), applicationId],
    );
    const expired = await signedModeratorRequest(`/admin/applications/${applicationId}`);
    assert.equal(expired.response.status, 200);
    assert.equal(expired.body.verifications.providerReviewStatus, "EXPIRED");
  });

  it("returns reviewer feedback with the rejected applicant status", async () => {
    const loaded = await request("/coaches/application/status", coach);
    assert.equal(loaded.response.status, 200);
    const applicationId = loaded.body.id as string;
    applicationIds.push(applicationId);
    const reviewerNote = "Please add a clearer teaching sample and explain your risk framework.";

    await pool.query(
      `UPDATE tradigo_coach_applications
       SET status='REJECTED', submitted_at='2026-08-28T12:00:00.000Z',
           decided_at='2026-08-30T12:00:00.000Z', reviewer_note=$1
       WHERE id=$2`,
      [reviewerNote, applicationId],
    );

    const rejected = await request("/coaches/application/status", coach);
    assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.id, applicationId);
  assert.equal(rejected.body.status, "REJECTED");
  assert.equal(rejected.body.attemptNumber, 1);
  assert.equal(rejected.body.reviewerNote, reviewerNote);
  assert.deepEqual(rejected.body.attemptHistory.map((attempt: any) => attempt.id), [applicationId]);
  assert.equal(rejected.body.attemptHistory[0].isCurrent, true);
  });

  it("creates an independent draft for a rejected applicant without changing prior evidence", async () => {
    const loaded = await request("/coaches/application/status", coach);
    assert.equal(loaded.response.status, 200);
    const previousApplicationId = loaded.body.id as string;
    applicationIds.push(previousApplicationId);

    await pool.query(
      `UPDATE tradigo_coach_applications
       SET status='REJECTED', profile=$1::jsonb, markets=$2::jsonb, experience=$3::jsonb,
           compliance=$4::jsonb, submitted_at='2026-08-28T12:00:00.000Z',
           decided_at='2026-08-30T12:00:00.000Z', reviewer_note=$5
       WHERE id=$6`,
      [
        JSON.stringify({ headline: "Earlier profile", bio: "Earlier bio" }),
        JSON.stringify({ markets: ["FOREX"] }),
        JSON.stringify({ yearsExperience: 4, background: "Earlier experience" }),
        JSON.stringify({ remoteControl: "v1.0" }),
        "Please add a clearer teaching sample.",
        previousApplicationId,
      ],
    );
    await pool.query(
      `INSERT INTO tradigo_application_documents
       (id, application_id, applicant_id, document_type, name, status)
       VALUES ($1,$2,$3,'TEACHING_SAMPLE','Earlier teaching sample','RECEIVED')`,
      [randomUUID(), previousApplicationId, "demo-coach"],
    );
    await pool.query(
      `INSERT INTO tradigo_application_audit (id, application_id, actor_id, action, details)
       VALUES ($1,$2,$3,'DECISION_RECORDED',$4::jsonb)`,
      [randomUUID(), previousApplicationId, "test-moderator", JSON.stringify({ decision: "REJECTED" })],
    );

    const resubmitted = await post("/coaches/application/resubmit");
    assert.equal(resubmitted.response.status, 201);
    const newApplicationId = resubmitted.body.id as string;
    applicationIds.push(newApplicationId);
    assert.notEqual(newApplicationId, previousApplicationId);
    assert.equal(resubmitted.body.status, "DRAFT");
    assert.equal(resubmitted.body.attemptNumber, 2);
    assert.equal(resubmitted.body.isResubmission, true);
    assert.equal(resubmitted.body.profile.headline, "Earlier profile");
    assert.equal(resubmitted.body.assessmentAttempts.length, 0);
    assert.equal(resubmitted.body.documents.length, 0);
    assert.equal(resubmitted.body.reviewerNote, null);

    const reviewerView = await signedModeratorRequest(`/admin/applications/${newApplicationId}`);
    assert.equal(reviewerView.response.status, 200);
    assert.deepEqual(
      reviewerView.body.attemptHistory.map((attempt: any) => attempt.id),
      [previousApplicationId, newApplicationId],
    );
    const earlierAttempt = reviewerView.body.attemptHistory[0];
    assert.equal(earlierAttempt.status, "REJECTED");
    assert.equal(earlierAttempt.reviewerNote, "Please add a clearer teaching sample.");
    assert.equal(earlierAttempt.documents[0].name, "Earlier teaching sample");
    assert.equal(reviewerView.body.previousApplicationId, previousApplicationId);

    const previous = await pool.query(
      "SELECT status, reviewer_note, profile FROM tradigo_coach_applications WHERE id=$1",
      [previousApplicationId],
    );
    assert.equal(previous.rows[0].status, "REJECTED");
    assert.equal(previous.rows[0].reviewer_note, "Please add a clearer teaching sample.");
    assert.equal(previous.rows[0].profile.headline, "Earlier profile");
    const previousEvidence = await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_application_documents WHERE application_id=$1",
      [previousApplicationId],
    );
    assert.equal(previousEvidence.rows[0].count, 1);
    const history = await pool.query(
      "SELECT action, details FROM tradigo_application_audit WHERE application_id=$1 ORDER BY created_at",
      [newApplicationId],
    );
    assert.deepEqual(history.rows.map(row => row.action), ["RESUBMITTED"]);
    assert.equal(history.rows[0].details.previousApplicationId, previousApplicationId);

    const currentStatus = await request("/coaches/application/status", coach);
    assert.equal(currentStatus.response.status, 200);
    assert.equal(currentStatus.body.id, newApplicationId);
    assert.equal(currentStatus.body.status, "DRAFT");
    assert.equal(currentStatus.body.attemptNumber, 2);
    assert.deepEqual(
      currentStatus.body.attemptHistory.map((attempt: any) => attempt.id),
      [previousApplicationId, newApplicationId],
    );
    const applicantEarlierAttempt = currentStatus.body.attemptHistory[0];
    assert.equal(applicantEarlierAttempt.reviewerNote, "Please add a clearer teaching sample.");
    assert.equal(applicantEarlierAttempt.profile.headline, "Earlier profile");
    assert.equal(applicantEarlierAttempt.documents[0].name, "Earlier teaching sample");
    assert.equal(applicantEarlierAttempt.isCurrent, false);
    assert.equal("applicantId" in applicantEarlierAttempt, false);
    assert.equal("applicantName" in applicantEarlierAttempt, false);
    assert.equal("applicantEmail" in applicantEarlierAttempt, false);
    assert.equal("verification" in applicantEarlierAttempt, false);
    assert.equal("identityHistory" in applicantEarlierAttempt, false);
    assert.equal("reviewerChecklist" in applicantEarlierAttempt, false);
    assert.equal("decidedBy" in applicantEarlierAttempt, false);
    assert.equal("objectPath" in applicantEarlierAttempt.documents[0], false);

    const clarification = await post(`/coaches/application/${previousApplicationId}/clarifications`, {
      message: "Which part of my teaching sample should I expand?",
    });
    assert.equal(clarification.response.status, 201);
    assert.equal(clarification.body.status, "SUBMITTED");
    assert.equal(clarification.body.message, "Which part of my teaching sample should I expand?");
    assert.equal("applicantId" in clarification.body, false);
    const clarificationId = clarification.body.id as string;

    const duplicateClarification = await post(`/coaches/application/${previousApplicationId}/clarifications`, {
      message: "I have one more question about this feedback.",
    });
    assert.equal(duplicateClarification.response.status, 409);

    const pendingApplicantStatus = await request("/coaches/application/status", coach);
    const pendingEarlierAttempt = pendingApplicantStatus.body.attemptHistory.find((attempt: any) => attempt.id === previousApplicationId);
    assert.equal(pendingEarlierAttempt.clarificationRequests[0].status, "SUBMITTED");
    assert.equal("applicantId" in pendingEarlierAttempt.clarificationRequests[0], false);
    assert.equal("respondedBy" in pendingEarlierAttempt.clarificationRequests[0], false);

    const pendingReviewerView = await signedModeratorRequest(`/admin/applications/${newApplicationId}`);
    const pendingReviewerAttempt = pendingReviewerView.body.attemptHistory.find((attempt: any) => attempt.id === previousApplicationId);
    assert.equal(pendingReviewerAttempt.clarificationRequests[0].id, clarificationId);
    assert.equal(pendingReviewerAttempt.clarificationRequests[0].applicantId, "demo-coach-maya");

    const notificationModeratorToken = signedModeratorToken();
    const reviewerNotifications = await signedModeratorRequest("/notifications", {}, notificationModeratorToken);
    assert.equal(reviewerNotifications.response.status, 200);
    const clarificationNotification = reviewerNotifications.body.notifications.find(
      (notification: any) => notification.type === "APPLICATION_CLARIFICATION_SUBMITTED",
    );
    assert.ok(clarificationNotification);
    assert.equal(clarificationNotification.applicationId, previousApplicationId);
    assert.equal(clarificationNotification.actionPath, `/admin/applications?applicationId=${encodeURIComponent(previousApplicationId)}`);
    assert.match(clarificationNotification.body, /application attempt 1/);
    assert.equal(clarificationNotification.body.includes("Which part of my teaching sample should I expand?"), false);
    assert.equal(JSON.stringify(clarificationNotification.details).includes("Which part"), false);
    const unreadBeforeRead = await signedModeratorRequest("/notifications/unread-count", {}, notificationModeratorToken);
    assert.equal(unreadBeforeRead.response.status, 200);

    const applicantNotifications = await request("/notifications", coach);
    assert.equal(applicantNotifications.response.status, 200);
    assert.equal(
      applicantNotifications.body.notifications.some((notification: any) => notification.type === "APPLICATION_CLARIFICATION_SUBMITTED"),
      false,
    );

    const markedRead = await signedModeratorRequest(`/notifications/${clarificationNotification.id}/read`, { method: "POST" }, notificationModeratorToken);
    assert.equal(markedRead.response.status, 200);
    const unreadNotifications = await signedModeratorRequest("/notifications/unread-count", {}, notificationModeratorToken);
    assert.equal(unreadNotifications.response.status, 200);
    assert.equal(unreadNotifications.body.unreadCount, unreadBeforeRead.body.unreadCount - 1);

    const answered = await signedModeratorRequest(`/admin/application-clarifications/${clarificationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "ANSWERED",
        response: "Please add one concrete example of your review process.",
      }),
    });
    assert.equal(answered.response.status, 200);
    assert.equal(answered.body.status, "ANSWERED");
    assert.equal(answered.body.response, "Please add one concrete example of your review process.");

    const answeredApplicantStatus = await request("/coaches/application/status", coach);
    const answeredEarlierAttempt = answeredApplicantStatus.body.attemptHistory.find((attempt: any) => attempt.id === previousApplicationId);
    assert.equal(answeredEarlierAttempt.clarificationRequests[0].response, "Please add one concrete example of your review process.");
    assert.equal("respondedBy" in answeredEarlierAttempt.clarificationRequests[0], false);

    const repeated = await post("/coaches/application/resubmit");
    assert.equal(repeated.response.status, 200);
    assert.equal(repeated.body.id, newApplicationId);
  });

  it("keeps private image and PDF evidence available only to moderators", async () => {
    const loaded = await request("/coaches/application", coach);
    assert.equal(loaded.response.status, 200);
    const applicationId = loaded.body.id as string;
    applicationIds.push(applicationId);

    const fixtures = [
      {
        name: "Annotated review sample.png",
        contentType: "image/png",
        bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
      {
        name: "Annotated review sample.pdf",
        contentType: "application/pdf",
        bytes: Buffer.from("%PDF-1.4\nTradigo private teaching sample\n%%EOF\n"),
      },
    ];

    try {
      for (const fixture of fixtures) {
        const uploadRequest = await request("/storage/uploads/request-url", coach, {
          method: "POST",
          body: JSON.stringify({
            name: fixture.name,
            contentType: fixture.contentType,
            size: fixture.bytes.length,
            documentType: "TEACHING_SAMPLE",
          }),
        });
        assert.equal(uploadRequest.response.status, 200);
        const objectPath = uploadRequest.body.objectPath as string;
        assert.match(objectPath, /^\/objects\/.+/);
        objectPaths.push(objectPath);

        const uploaded = await fetch(uploadRequest.body.uploadURL as string, {
          method: "PUT",
          headers: { "content-type": fixture.contentType },
          body: fixture.bytes,
        });
        assert.equal(uploaded.ok, true);

        const foreignOwnerRecord = await post("/coaches/application/documents", {
          documentType: "TEACHING_SAMPLE",
          name: fixture.name,
          objectPath,
          mimeType: fixture.contentType,
          sizeBytes: fixture.bytes.length,
        }, trader);
        assert.equal(foreignOwnerRecord.response.status, 403);

        const recorded = await post("/coaches/application/documents", {
          documentType: "TEACHING_SAMPLE",
          name: fixture.name,
          objectPath,
          mimeType: fixture.contentType,
          sizeBytes: fixture.bytes.length,
        });
        assert.equal(recorded.response.status, 201);
      }

      const moderatorToken = signedModeratorToken();
      const coachToken = await previewToken("COACH");
      const traderToken = await previewToken("TRADER");

      for (const [fixtureIndex, fixture] of fixtures.entries()) {
        const objectPath = objectPaths[fixtureIndex];
        assert.ok(objectPath);
        const evidenceUrl = `${baseUrl}/api/storage${objectPath}`;

        const moderatorResponse = await fetch(evidenceUrl, {
          headers: { authorization: `Bearer ${moderatorToken}` },
        });
        assert.equal(moderatorResponse.status, 200);
        assert.equal(moderatorResponse.headers.get("content-type"), fixture.contentType);
        assert.equal(moderatorResponse.headers.get("content-length"), String(fixture.bytes.length));
        assert.match(moderatorResponse.headers.get("content-disposition") ?? "", /^attachment; filename="/);
        assert.equal(moderatorResponse.headers.get("x-content-type-options"), "nosniff");
        assert.deepEqual(Buffer.from(await moderatorResponse.arrayBuffer()), fixture.bytes);

        const coachResponse = await fetch(evidenceUrl, {
          headers: { "x-tradigo-preview-session": coachToken },
        });
        assert.equal(coachResponse.status, 403);

        const traderResponse = await fetch(evidenceUrl, {
          headers: { "x-tradigo-preview-session": traderToken },
        });
        assert.equal(traderResponse.status, 403);

        const anonymousResponse = await fetch(evidenceUrl);
        assert.equal(anonymousResponse.status, 401);
      }

      const spoofedUpload = await request("/storage/uploads/request-url", coach, {
        method: "POST",
        body: JSON.stringify({
          name: "not-a-pdf.pdf",
          contentType: "application/pdf",
          size: 20,
          documentType: "TEACHING_SAMPLE",
        }),
      });
      assert.equal(spoofedUpload.response.status, 200);
      const spoofedPath = spoofedUpload.body.objectPath as string;
      objectPaths.push(spoofedPath);
      const spoofedPut = await fetch(spoofedUpload.body.uploadURL as string, {
        method: "PUT",
        headers: { "content-type": "application/pdf" },
        body: "<script>alert(1)</script>",
      });
      assert.equal(spoofedPut.ok, true);
      const spoofedRecord = await post("/coaches/application/documents", {
        documentType: "TEACHING_SAMPLE",
        name: "not-a-pdf.pdf",
        objectPath: spoofedPath,
        mimeType: "application/pdf",
        sizeBytes: 20,
      });
      assert.equal(spoofedRecord.response.status, 400);
    } finally {
      await Promise.all(objectPaths.map(deletePrivateObject));
      for (const objectPath of objectPaths) {
        const { bucketName, objectName } = objectReference(objectPath);
        await assert.rejects(storage.bucket(bucketName).file(objectName).getMetadata());
      }
    }
  });

  it("keeps preview admins read-only while moderators publish coach-safe questions", async () => {
    const previewAttempt = await adminRequest("/admin/assessment-questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "KNOWLEDGE",
        text: "Preview admins cannot publish this question.",
        options: ["A guaranteed result", "The learner's reasoning", "A trade instruction"],
        correctAnswer: "The learner's reasoning",
        explanation: "Preview identities must not mutate the production control plane.",
      }),
    });
    assert.equal(previewAttempt.response.status, 403);
    assert.equal(previewAttempt.body.error.message, "Moderator authentication is required.");

    const created = await signedModeratorRequest("/admin/assessment-questions", {
      method: "POST",
      body: JSON.stringify({
        type: "KNOWLEDGE",
        text: "What belongs in an education-only review?",
        options: ["A guaranteed result", "The learner's reasoning", "A trade instruction"],
        correctAnswer: "The learner's reasoning",
        explanation: "The coach should teach process, not provide a directive.",
      }),
    });
    assert.equal(created.response.status, 201);
    const question = created.body.question as { id: string; status: string };
    questionIds.push(question.id);
    assert.equal(question.status, "DRAFT");

    const published = await signedModeratorRequest(`/admin/assessment-questions/${question.id}/publish`, { method: "POST" });
    assert.equal(published.response.status, 200);
    assert.equal(published.body.question.status, "PUBLISHED");

    const coachQuestions = await request("/coaches/assessments", coach);
    assert.equal(coachQuestions.response.status, 200);
    const visible = (coachQuestions.body.knowledge as Array<Record<string, any>>).find(item => item.id === question.id);
    assert.ok(visible);
    assert.equal("correctAnswer" in visible, false);
    assert.deepEqual(visible.options, ["A guaranteed result", "The learner's reasoning", "A trade instruction"]);

    const retired = await signedModeratorRequest(`/admin/assessment-questions/${question.id}/retire`, { method: "POST" });
    assert.equal(retired.response.status, 200);
    const afterRetire = await request("/coaches/assessments", coach);
    assert.equal((afterRetire.body.knowledge as Array<Record<string, any>>).some(item => item.id === question.id), false);
  });
});