import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import app from "../app";
import {
  capturePayPalAuthorization,
  refundPayPalCapture,
  verifyPayPalWebhook,
  voidPayPalAuthorization,
} from "../routes/tradigo";
import { pool } from "@workspace/db";

const originalEnv = {
  provider: process.env.PAYMENT_PROVIDER,
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  webhookId: process.env.PAYPAL_WEBHOOK_ID,
  adminKey: process.env.TRADIGO_ADMIN_KEY,
  sessionSecret: process.env.SESSION_SECRET,
};
const originalFetch = globalThis.fetch;
const sessionId = `paypal-contract-${Date.now()}`;
const eventId = `paypal-event-${Date.now()}`;
const retrySessionId = `paypal-retry-contract-${Date.now()}`;
const retryEventId = `failed-retry-contract-event-${Date.now()}`;
const concurrentRetrySessionId = `paypal-concurrent-retry-contract-${Date.now()}`;
const concurrentRetryEventId = `failed-concurrent-retry-contract-event-${Date.now()}`;
const failedEventId = `failed-contract-event-${Date.now()}`;
const authorizationSessionId = `paypal-authorization-contract-${randomUUID()}`;
const authorizationOrderId = `order-authorization-contract-${randomUUID()}`;
const authorizationId = `auth-authorization-contract-${randomUUID()}`;
const lostResponseSessionId = `paypal-lost-response-contract-${randomUUID()}`;
const lostResponseOrderId = `order-lost-response-contract-${randomUUID()}`;
const lostResponseAuthorizationId = `auth-lost-response-contract-${randomUUID()}`;
const lostCheckoutResponseSessionId = `paypal-lost-checkout-response-contract-${randomUUID()}`;
const lostCheckoutResponseOrderId = `order-lost-checkout-response-contract-${randomUUID()}`;
let server: Server;
let baseUrl: string;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function paypalFetch(options: {
  refund?: { status: number; body: unknown };
  verification?: "SUCCESS" | "FAILURE";
} = {}) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (!url.includes("paypal.com")) return originalFetch(input, init);
    if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "contract-token" });
    if (url.endsWith("/v1/notifications/verify-webhook-signature")) {
      return jsonResponse({ verification_status: options.verification ?? "SUCCESS" });
    }
    if (url.includes("/v2/payments/authorizations/auth-contract/capture")) {
      return jsonResponse({ id: "capture-contract", status: "COMPLETED" });
    }
    if (url.includes("/v2/payments/authorizations/auth-contract/void")) {
      return jsonResponse({ status: "VOIDED" });
    }
    if (url.includes("/v2/payments/captures/") && url.endsWith("/refund")) {
      const refund = options.refund ?? { status: 201, body: { id: "refund-contract", status: "COMPLETED" } };
      return jsonResponse(refund.body, refund.status);
    }
    throw new Error(`Unexpected PayPal request: ${url} ${init?.method ?? "GET"}`);
  };
}

async function postWebhook(event: Record<string, unknown>, signed = true) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signed) {
    Object.assign(headers, {
      "paypal-transmission-id": "transmission-contract",
      "paypal-transmission-time": "2026-08-25T12:00:00Z",
      "paypal-transmission-sig": "signature-contract",
      "paypal-cert-url": "https://api-m.sandbox.paypal.com/cert",
      "paypal-auth-algo": "SHA256withRSA",
    });
  }
  const response = await fetch(`${baseUrl}/api/webhooks/paypal`, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
  });
  return { response, body: response.json() as Promise<Record<string, unknown>> };
}

before(async () => {
  process.env.PAYMENT_PROVIDER = "paypal";
  process.env.PAYPAL_CLIENT_ID = "contract-client";
  process.env.PAYPAL_CLIENT_SECRET = "contract-secret";
  process.env.PAYPAL_WEBHOOK_ID = "contract-webhook";
  process.env.TRADIGO_ADMIN_KEY = "contract-admin";
  process.env.SESSION_SECRET = "contract-session-secret";
  globalThis.fetch = paypalFetch();

  await pool.query(
    `INSERT INTO tradigo_sessions
      (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,payment_status,
       paypal_order_id,paypal_authorization_id,room_name,currency,authorized_amount_cents,
       final_amount_cents,coach_net_cents,payout_status)
     VALUES ($1,'contract-trader','contract-coach','INSTANT','COMPLETED',30,3000,'PAYPAL_SETTLED',
       'order-contract','auth-contract','room-contract','USD',3000,3000,2700,'PENDING')`,
    [sessionId],
  );
  await pool.query(
    `INSERT INTO tradigo_payouts (id,session_id,coach_id,amount_cents,currency,status)
     VALUES ($1,$2,'contract-coach',2700,'USD','PENDING')`,
    [`payout-${sessionId}`, sessionId],
  );
  await pool.query(
    `INSERT INTO tradigo_payment_webhook_events
      (id,event_id,event_type,resource_id,status,error,session_id,payload)
       VALUES ($1,$2, 'PAYMENT.REFUND.FAILED', NULL, 'FAILED', 'provider unavailable', NULL, $3)`,
     [`event-failed-${sessionId}`, failedEventId, { id: failedEventId }],
  );
  await pool.query(
    `INSERT INTO tradigo_sessions
      (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,payment_status,
       paypal_order_id,paypal_authorization_id,room_name,currency,authorized_amount_cents,
       final_amount_cents,coach_net_cents,payout_status)
     VALUES ($1,'contract-retry-trader','contract-retry-coach','INSTANT','COMPLETED',30,3000,'REFUND_FAILED',
       'order-retry-contract','auth-retry-contract','room-retry-contract','USD',3000,3000,2700,'FROZEN')`,
    [retrySessionId],
  );
  await pool.query(
    `INSERT INTO tradigo_payouts (id,session_id,coach_id,amount_cents,currency,status)
     VALUES ($1,$2,'contract-retry-coach',2700,'USD','FROZEN')`,
    [`payout-${retrySessionId}`, retrySessionId],
  );
  await pool.query(
    `INSERT INTO tradigo_payment_intents
      (id,session_id,provider,provider_reference,kind,amount_cents,currency,status,idempotency_key,details)
     VALUES ($1,$2,'PAYPAL','capture-retry-contract','CAPTURE',3000,'USD','SETTLED',$3,$4)`,
    [`intent-${retrySessionId}`, retrySessionId, `capture:${retrySessionId}`, { contract: true }],
  );
  await pool.query(
    `INSERT INTO tradigo_payment_webhook_events
      (id,event_id,event_type,resource_id,status,error,session_id,payload)
     VALUES ($1,$2,'PAYMENT.REFUND.FAILED','failed-refund-retry-contract','FAILED','provider unavailable',$3,$4)`,
    [`event-${retryEventId}`, retryEventId, retrySessionId, {
      id: retryEventId,
      event_type: "PAYMENT.REFUND.FAILED",
      resource: {
        id: "failed-refund-retry-contract",
        custom_id: retrySessionId,
        supplementary_data: { related_ids: { capture_id: "capture-retry-contract" } },
      },
    }],
  );
  await pool.query(
    `INSERT INTO tradigo_sessions
      (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,payment_status,
       paypal_order_id,paypal_authorization_id,room_name,currency,authorized_amount_cents,
       final_amount_cents,coach_net_cents,payout_status)
     VALUES ($1,'contract-concurrent-trader','contract-concurrent-coach','INSTANT','COMPLETED',30,3000,'REFUND_FAILED',
       'order-concurrent-retry-contract','auth-concurrent-retry-contract','room-concurrent-retry-contract','USD',3000,3000,2700,'FROZEN')`,
    [concurrentRetrySessionId],
  );
  await pool.query(
    `INSERT INTO tradigo_payouts (id,session_id,coach_id,amount_cents,currency,status)
     VALUES ($1,$2,'contract-concurrent-coach',2700,'USD','FROZEN')`,
    [`payout-${concurrentRetrySessionId}`, concurrentRetrySessionId],
  );
  await pool.query(
    `INSERT INTO tradigo_payment_intents
      (id,session_id,provider,provider_reference,kind,amount_cents,currency,status,idempotency_key,details)
     VALUES ($1,$2,'PAYPAL','capture-concurrent-retry-contract','CAPTURE',3000,'USD','SETTLED',$3,$4)`,
    [`intent-${concurrentRetrySessionId}`, concurrentRetrySessionId, `capture:${concurrentRetrySessionId}`, { contract: true }],
  );
  await pool.query(
    `INSERT INTO tradigo_payment_webhook_events
      (id,event_id,event_type,resource_id,status,error,session_id,payload)
     VALUES ($1,$2,'PAYMENT.REFUND.FAILED','failed-concurrent-retry-contract','FAILED','provider unavailable',$3,$4)`,
    [`event-${concurrentRetryEventId}`, concurrentRetryEventId, concurrentRetrySessionId, {
      id: concurrentRetryEventId,
      event_type: "PAYMENT.REFUND.FAILED",
      resource: {
        id: "failed-concurrent-retry-contract",
        custom_id: concurrentRetrySessionId,
        supplementary_data: { related_ids: { capture_id: "capture-concurrent-retry-contract" } },
      },
    }],
  );
  await pool.query(
    `INSERT INTO tradigo_sessions
      (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,payment_status,
       paypal_order_id,room_name,currency,authorized_amount_cents,final_amount_cents,
       coach_net_cents,payout_status)
     VALUES ($1,'demo-trader-preview','demo-coach-maya','INSTANT','PAYMENT_READY',30,3000,'PAYPAL_ORDER_CREATED',
       $2,$3,'USD',3000,3000,2700,'PENDING')`,
    [authorizationSessionId, authorizationOrderId, `room-${authorizationSessionId}`],
  );
  await pool.query(
    `INSERT INTO tradigo_sessions
      (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,payment_status,
       paypal_order_id,room_name,currency,authorized_amount_cents,final_amount_cents,
       coach_net_cents,payout_status)
     VALUES ($1,'demo-trader-preview','demo-coach-maya','INSTANT','PAYMENT_READY',30,3000,'PAYPAL_ORDER_CREATED',
       $2,$3,'USD',3000,3000,2700,'PENDING')`,
    [lostResponseSessionId, lostResponseOrderId, `room-${lostResponseSessionId}`],
  );
  await pool.query(
    `INSERT INTO tradigo_sessions
      (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,payment_status,
       room_name,currency,authorized_amount_cents,final_amount_cents,coach_net_cents,payout_status)
     VALUES ($1,'demo-trader-preview','demo-coach-maya','SCHEDULED','REQUESTED',30,3000,'NOT_STARTED',
       $2,'USD',3000,3000,2700,'PENDING')`,
    [lostCheckoutResponseSessionId, `room-${lostCheckoutResponseSessionId}`],
  );

  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await pool.query("DELETE FROM tradigo_session_events WHERE session_id=$1", [concurrentRetrySessionId]);
  await pool.query("DELETE FROM tradigo_ledger_entries WHERE session_id=$1", [concurrentRetrySessionId]);
  await pool.query("DELETE FROM tradigo_payment_intents WHERE session_id=$1", [concurrentRetrySessionId]);
  await pool.query("DELETE FROM tradigo_payment_webhook_events WHERE session_id=$1 OR event_id=$2", [concurrentRetrySessionId, concurrentRetryEventId]);
  await pool.query("DELETE FROM tradigo_payouts WHERE session_id=$1", [concurrentRetrySessionId]);
  await pool.query("DELETE FROM tradigo_sessions WHERE id=$1", [concurrentRetrySessionId]);
  await pool.query("DELETE FROM tradigo_session_events WHERE session_id=$1", [authorizationSessionId]);
  await pool.query("DELETE FROM tradigo_payment_intents WHERE session_id=$1", [authorizationSessionId]);
  await pool.query("DELETE FROM tradigo_sessions WHERE id=$1", [authorizationSessionId]);
  await pool.query("DELETE FROM tradigo_session_events WHERE session_id=$1", [lostResponseSessionId]);
  await pool.query("DELETE FROM tradigo_payment_intents WHERE session_id=$1", [lostResponseSessionId]);
  await pool.query("DELETE FROM tradigo_sessions WHERE id=$1", [lostResponseSessionId]);
  await pool.query("DELETE FROM tradigo_session_events WHERE session_id=$1", [lostCheckoutResponseSessionId]);
  await pool.query("DELETE FROM tradigo_payment_intents WHERE session_id=$1", [lostCheckoutResponseSessionId]);
  await pool.query("DELETE FROM tradigo_sessions WHERE id=$1", [lostCheckoutResponseSessionId]);
  await pool.query("DELETE FROM tradigo_session_events WHERE session_id=$1", [retrySessionId]);
  await pool.query("DELETE FROM tradigo_ledger_entries WHERE session_id=$1", [retrySessionId]);
  await pool.query("DELETE FROM tradigo_payment_intents WHERE session_id=$1", [retrySessionId]);
  await pool.query("DELETE FROM tradigo_payment_webhook_events WHERE session_id=$1 OR event_id=$2", [retrySessionId, retryEventId]);
  await pool.query("DELETE FROM tradigo_payouts WHERE session_id=$1", [retrySessionId]);
  await pool.query("DELETE FROM tradigo_sessions WHERE id=$1", [retrySessionId]);
  await pool.query("DELETE FROM tradigo_ledger_entries WHERE session_id=$1", [sessionId]);
  await pool.query("DELETE FROM tradigo_payment_intents WHERE session_id=$1", [sessionId]);
  await pool.query("DELETE FROM tradigo_payment_webhook_events WHERE session_id=$1 OR event_id IN ($2,$3)", [sessionId, failedEventId, eventId]);
  await pool.query("DELETE FROM tradigo_payouts WHERE session_id=$1", [sessionId]);
  await pool.query("DELETE FROM tradigo_sessions WHERE id=$1", [sessionId]);
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries({
    PAYMENT_PROVIDER: originalEnv.provider,
    PAYPAL_CLIENT_ID: originalEnv.clientId,
    PAYPAL_CLIENT_SECRET: originalEnv.clientSecret,
    PAYPAL_WEBHOOK_ID: originalEnv.webhookId,
    TRADIGO_ADMIN_KEY: originalEnv.adminKey,
    SESSION_SECRET: originalEnv.sessionSecret,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await pool.end();
});

describe("PayPal provider contracts", { concurrency: false }, () => {
  it("maps capture, void, completed refund, pending refund, and failed refund responses", async () => {
    globalThis.fetch = paypalFetch({ refund: { status: 201, body: { id: "refund-completed", status: "COMPLETED" } } });
    assert.deepEqual(await capturePayPalAuthorization("auth-contract", "capture-key", 3000, "USD"), {
      captured: true,
      captureId: "capture-contract",
    });
    assert.equal(await voidPayPalAuthorization("auth-contract", "void-key"), true);
    assert.deepEqual(
      await refundPayPalCapture("capture-contract", "refund-completed-key"),
      { ok: true, refundId: "refund-completed", status: "COMPLETED", error: undefined },
    );

    globalThis.fetch = paypalFetch({ refund: { status: 201, body: { id: "refund-pending", status: "PENDING" } } });
    assert.deepEqual(
      await refundPayPalCapture("capture-contract", "refund-pending-key"),
      { ok: true, refundId: "refund-pending", status: "PENDING", error: undefined },
    );

    globalThis.fetch = paypalFetch({ refund: { status: 422, body: { name: "REFUND_NOT_ALLOWED", message: "Already refunded" } } });
    const failed = await refundPayPalCapture("capture-contract", "refund-failed-key");
    assert.equal(failed.ok, false);
    assert.match(failed.error ?? "", /REFUND_NOT_ALLOWED: Already refunded/);
  });

  it("accepts only signed webhook requests at the provider verification gate", async () => {
    const event = { id: "signature-contract-event", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "capture-contract" } };
    const signedHeaders = {
      "paypal-transmission-id": "transmission-contract",
      "paypal-transmission-time": "2026-08-25T12:00:00Z",
      "paypal-transmission-sig": "signature-contract",
      "paypal-cert-url": "https://api-m.sandbox.paypal.com/cert",
      "paypal-auth-algo": "SHA256withRSA",
    };
    assert.equal(await verifyPayPalWebhook(signedHeaders, event), true);
    assert.equal(await verifyPayPalWebhook({}, event), false);
    globalThis.fetch = paypalFetch({ verification: "FAILURE" });
    assert.equal(await verifyPayPalWebhook(signedHeaders, event), false);

    globalThis.fetch = paypalFetch();
    const unsigned = await postWebhook(event, false);
    assert.equal(unsigned.response.status, 400);
    const unsignedBody = await unsigned.body as { error?: { message?: string } };
    assert.match(String(unsignedBody.error?.message), /signature verification failed/i);
  });

  it("retries linked failed refunds through provider failure, pending, and completion without duplicate ledger entries", async () => {
    const expiresAt = Date.now() + 60_000;
    const payload = `contract-moderator.MODERATOR.${expiresAt}`;
    const token = `${payload}.${createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("base64url")}`;
    const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
    const retryUrl = `${baseUrl}/api/admin/paypal/reconciliation/${retryEventId}/retry`;

    globalThis.fetch = paypalFetch({ refund: { status: 422, body: { name: "REFUND_NOT_ALLOWED", message: "Provider unavailable" } } });
    const failedResponse = await fetch(retryUrl, { method: "POST", headers, body: "{}" });
    assert.equal(failedResponse.status, 502);
    assert.deepEqual((await failedResponse.json() as { retry: unknown }).retry, { attempt: 1, status: "FAILED" });
    let state = await pool.query(
      "SELECT payment_status, payout_status FROM tradigo_sessions WHERE id=$1",
      [retrySessionId],
    );
    assert.deepEqual(state.rows[0], { payment_status: "REFUND_FAILED", payout_status: "FROZEN" });

    globalThis.fetch = paypalFetch({ refund: { status: 201, body: { id: "refund-retry-pending", status: "PENDING" } } });
    const pendingResponse = await fetch(retryUrl, { method: "POST", headers, body: "{}" });
    assert.equal(pendingResponse.status, 200);
    assert.deepEqual((await pendingResponse.json() as { retry: unknown }).retry, {
      attempt: 2,
      status: "PENDING",
      providerReference: "refund-retry-pending",
    });
    state = await pool.query(
      "SELECT payment_status, payout_status FROM tradigo_sessions WHERE id=$1",
      [retrySessionId],
    );
    assert.deepEqual(state.rows[0], { payment_status: "REFUND_PENDING", payout_status: "FROZEN" });
    assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM tradigo_ledger_entries WHERE session_id=$1", [retrySessionId])).rows[0].count, 0);

    globalThis.fetch = paypalFetch({ refund: { status: 201, body: { id: "refund-retry-completed", status: "COMPLETED" } } });
    const completedResponse = await fetch(retryUrl, { method: "POST", headers, body: "{}" });
    assert.equal(completedResponse.status, 200);
    assert.deepEqual((await completedResponse.json() as { retry: unknown }).retry, {
      attempt: 3,
      status: "RECONCILED",
      providerReference: "refund-retry-completed",
    });
    state = await pool.query(
      "SELECT payment_status, payout_status FROM tradigo_sessions WHERE id=$1",
      [retrySessionId],
    );
    assert.deepEqual(state.rows[0], { payment_status: "REFUNDED", payout_status: "REFUNDED" });
    const eventState = await pool.query(
      "SELECT status, payload->'_retryHistory' AS retry_history FROM tradigo_payment_webhook_events WHERE event_id=$1",
      [retryEventId],
    );
    assert.equal(eventState.rows[0].status, "RECONCILED");
    assert.deepEqual((eventState.rows[0].retry_history as Array<{ attempt: number; status: string }>).map((entry) => [entry.attempt, entry.status]), [
      [1, "RETRYING"], [1, "FAILED"], [2, "RETRYING"], [2, "RETRY_REQUIRED"], [3, "RETRYING"], [3, "RECONCILED"],
    ]);
    assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM tradigo_ledger_entries WHERE session_id=$1 AND entry_type LIKE 'REFUND%'", [retrySessionId])).rows[0].count, 4);
    assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM tradigo_payment_intents WHERE session_id=$1 AND kind='REFUND'", [retrySessionId])).rows[0].count, 1);

    const repeatedResponse = await fetch(retryUrl, { method: "POST", headers, body: "{}" });
    assert.equal(repeatedResponse.status, 409);
    assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM tradigo_ledger_entries WHERE session_id=$1 AND entry_type LIKE 'REFUND%'", [retrySessionId])).rows[0].count, 4);
  });

  it("allows only one concurrent moderator retry to call PayPal", async () => {
    const expiresAt = Date.now() + 60_000;
    const payload = `concurrent-contract-moderator.MODERATOR.${expiresAt}`;
    const token = `${payload}.${createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("base64url")}`;
    const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
    const retryUrl = `${baseUrl}/api/admin/paypal/reconciliation/${concurrentRetryEventId}/retry`;
    let providerRefundCalls = 0;
    let releaseProvider!: () => void;
    let providerReached!: () => void;
    const providerCallReached = new Promise<void>((resolve) => { providerReached = resolve; });
    const providerRelease = new Promise<void>((resolve) => { releaseProvider = resolve; });

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (!url.includes("paypal.com")) return originalFetch(input, init);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "contract-token" });
      if (url.includes("/v2/payments/captures/") && url.endsWith("/refund")) {
        providerRefundCalls += 1;
        providerReached();
        await providerRelease;
        return jsonResponse({ id: "refund-concurrent-retry", status: "COMPLETED" }, 201);
      }
      throw new Error(`Unexpected PayPal request: ${url} ${init?.method ?? "GET"}`);
    };

    const requests = [
      fetch(retryUrl, { method: "POST", headers, body: "{}" }),
      fetch(retryUrl, { method: "POST", headers, body: "{}" }),
    ];
    await providerCallReached;
    assert.equal(providerRefundCalls, 1);
    releaseProvider();
    const responses = await Promise.all(requests);
    const states = await Promise.all(responses.map(async (response) => ({
      status: response.status,
      body: await response.json() as { error?: { status?: string }; retry?: { attempt?: number; status?: string } },
    })));
    assert.deepEqual(states.map((state) => state.status).sort((a, b) => a - b), [200, 409]);
    const successful = states.find((state) => state.status === 200);
    const rejected = states.find((state) => state.status === 409);
    assert.deepEqual(successful?.body.retry, { attempt: 1, status: "RECONCILED", providerReference: "refund-concurrent-retry" });
    assert.equal(rejected?.body.error?.status, "RETRYING");

    const eventState = await pool.query(
      "SELECT status, payload->'_retryHistory' AS retry_history FROM tradigo_payment_webhook_events WHERE event_id=$1",
      [concurrentRetryEventId],
    );
    assert.equal(eventState.rows[0].status, "RECONCILED");
    assert.deepEqual((eventState.rows[0].retry_history as Array<{ attempt: number; status: string }>).map((entry) => [entry.attempt, entry.status]), [
      [1, "RETRYING"], [1, "RECONCILED"],
    ]);
    assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM tradigo_ledger_entries WHERE session_id=$1 AND entry_type LIKE 'REFUND%'", [concurrentRetrySessionId])).rows[0].count, 4);
    assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM tradigo_payment_intents WHERE session_id=$1 AND kind='REFUND'", [concurrentRetrySessionId])).rows[0].count, 1);
  });

  it("authorizes one PayPal hold across concurrent and repeated provider-shaped retries", async () => {
    let providerAuthorizationCalls = 0;
    const requestIds: string[] = [];
    let providerReached!: () => void;
    let releaseProvider!: () => void;
    const providerCallReached = new Promise<void>((resolve) => { providerReached = resolve; });
    const providerRelease = new Promise<void>((resolve) => { releaseProvider = resolve; });

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (!url.includes("paypal.com")) return originalFetch(input, init);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "contract-token" });
      if (url.endsWith(`/v2/checkout/orders/${authorizationOrderId}`)) {
        return jsonResponse({
          id: authorizationOrderId,
          status: "APPROVED",
          purchase_units: [{
            reference_id: authorizationSessionId,
            amount: { currency_code: "USD", value: "30.00" },
          }],
        });
      }
      if (url.endsWith(`/v2/checkout/orders/${authorizationOrderId}/authorize`)) {
        providerAuthorizationCalls += 1;
        requestIds.push(new Headers(init?.headers).get("PayPal-Request-Id") ?? "");
        providerReached();
        await providerRelease;
        return jsonResponse({
          id: authorizationOrderId,
          status: "COMPLETED",
          purchase_units: [{
            reference_id: authorizationSessionId,
            amount: { currency_code: "USD", value: "30.00" },
            payments: {
              authorizations: [{
                id: authorizationId,
                status: "CREATED",
                expiration_time: "2026-09-26T12:00:00Z",
              }],
            },
          }],
        });
      }
      throw new Error(`Unexpected PayPal request: ${url} ${init?.method ?? "GET"}`);
    };

    async function authorize() {
      const auth = await fetch(`${baseUrl}/api/auth/demo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "TRADER" }),
      });
      const { previewToken } = await auth.json() as { previewToken: string };
      return fetch(`${baseUrl}/api/sessions/${authorizationSessionId}/payment/authorize`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tradigo-preview-session": previewToken,
        },
        body: "{}",
      });
    }

    const concurrentRequests = [authorize(), authorize()];
    await providerCallReached;
    assert.equal(providerAuthorizationCalls, 1);
    releaseProvider();

    const concurrentResponses = await Promise.all(concurrentRequests);
    assert.deepEqual(concurrentResponses.map((response) => response.status).sort((a, b) => a - b), [200, 200]);
    assert.equal((await Promise.all(concurrentResponses.map((response) => response.json() as Promise<Record<string, unknown>>))).filter((body) => body.idempotent === true).length, 1);

    const repeatedResponse = await authorize();
    assert.equal(repeatedResponse.status, 200);
    assert.equal((await repeatedResponse.json() as { idempotent?: boolean }).idempotent, true);
    assert.equal(providerAuthorizationCalls, 1);
    assert.deepEqual(requestIds, [`authorize:${authorizationSessionId}`]);

    const state = await pool.query(
      `SELECT status, payment_status, paypal_order_id, paypal_authorization_id,
              paypal_authorization_status, paypal_authorization_expires_at
       FROM tradigo_sessions WHERE id=$1`,
      [authorizationSessionId],
    );
    assert.deepEqual(state.rows[0], {
      status: "ROOM_READY",
      payment_status: "PAYPAL_AUTHORIZED",
      paypal_order_id: authorizationOrderId,
      paypal_authorization_id: authorizationId,
      paypal_authorization_status: "CREATED",
      paypal_authorization_expires_at: new Date("2026-09-26T12:00:00Z"),
    });

    const intents = await pool.query(
      `SELECT provider, provider_reference, kind, amount_cents, currency, status,
              idempotency_key, details
       FROM tradigo_payment_intents WHERE session_id=$1 AND kind='AUTHORIZE'`,
      [authorizationSessionId],
    );
    assert.equal(intents.rowCount, 1);
    assert.deepEqual(intents.rows[0], {
      provider: "PAYPAL",
      provider_reference: authorizationOrderId,
      kind: "AUTHORIZE",
      amount_cents: 3000,
      currency: "USD",
      status: "AUTHORIZED",
      idempotency_key: `authorize:${authorizationSessionId}`,
      details: { authorizationId },
    });
    assert.equal((await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_session_events WHERE session_id=$1 AND event_type='PAYPAL_AUTHORIZED'",
      [authorizationSessionId],
    )).rows[0].count, 1);
  });

  it("reuses one PayPal checkout order after the first create response is lost", async () => {
    let providerOrderRequests = 0;
    let providerOrderActions = 0;
    const requestIds: string[] = [];
    let storedOrderResponse: Record<string, unknown> | undefined;

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (!url.includes("paypal.com")) return originalFetch(input, init);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "contract-token" });
      if (url.endsWith("/v2/checkout/orders")) {
        providerOrderRequests += 1;
        requestIds.push(new Headers(init?.headers).get("PayPal-Request-Id") ?? "");
        if (storedOrderResponse) return jsonResponse(storedOrderResponse);

        providerOrderActions += 1;
        storedOrderResponse = {
          id: lostCheckoutResponseOrderId,
          status: "CREATED",
          links: [{
            rel: "approve",
            href: `https://paypal.test/checkout/${lostCheckoutResponseOrderId}`,
          }],
        };
        throw new Error("PayPal response lost after checkout order was created");
      }
      throw new Error(`Unexpected PayPal request: ${url} ${init?.method ?? "GET"}`);
    };

    async function accept() {
      const auth = await fetch(`${baseUrl}/api/auth/demo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "COACH" }),
      });
      const { previewToken } = await auth.json() as { previewToken: string };
      return fetch(`${baseUrl}/api/coach-now/requests/${lostCheckoutResponseSessionId}/accept`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tradigo-preview-session": previewToken,
        },
        body: "{}",
      });
    }

    const firstResponse = await accept();
    assert.equal(firstResponse.status, 502);
    assert.match(String((await firstResponse.json() as { error?: { message?: string } }).error?.message), /could not create/i);
    assert.equal(providerOrderActions, 1);

    const firstState = await pool.query(
      "SELECT status, payment_status, paypal_order_id, payment_approval_url FROM tradigo_sessions WHERE id=$1",
      [lostCheckoutResponseSessionId],
    );
    assert.deepEqual(firstState.rows[0], {
      status: "REQUESTED",
      payment_status: "NOT_STARTED",
      paypal_order_id: null,
      payment_approval_url: null,
    });

    const retryResponse = await accept();
    assert.equal(retryResponse.status, 200);
    assert.equal((await retryResponse.json() as { idempotent?: boolean }).idempotent, undefined);
    assert.equal(providerOrderRequests, 2);
    assert.equal(providerOrderActions, 1);
    assert.deepEqual(requestIds, [
      `tradigo-${lostCheckoutResponseSessionId}`,
      `tradigo-${lostCheckoutResponseSessionId}`,
    ]);

    const state = await pool.query(
      "SELECT status, payment_status, paypal_order_id, payment_approval_url FROM tradigo_sessions WHERE id=$1",
      [lostCheckoutResponseSessionId],
    );
    assert.deepEqual(state.rows[0], {
      status: "PAYMENT_READY",
      payment_status: "PAYPAL_ORDER_CREATED",
      paypal_order_id: lostCheckoutResponseOrderId,
      payment_approval_url: `https://paypal.test/checkout/${lostCheckoutResponseOrderId}`,
    });
  });

  it("recovers a PayPal hold after the first authorization response is lost", async () => {
    let providerAuthorizationRequests = 0;
    let providerAuthorizationActions = 0;
    const requestIds: string[] = [];
    let storedAuthorizationResponse: Record<string, unknown> | undefined;

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (!url.includes("paypal.com")) return originalFetch(input, init);
      if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "contract-token" });
      if (url.endsWith(`/v2/checkout/orders/${lostResponseOrderId}`)) {
        return jsonResponse({
          id: lostResponseOrderId,
          status: "APPROVED",
          purchase_units: [{
            reference_id: lostResponseSessionId,
            amount: { currency_code: "USD", value: "30.00" },
          }],
        });
      }
      if (url.endsWith(`/v2/checkout/orders/${lostResponseOrderId}/authorize`)) {
        providerAuthorizationRequests += 1;
        const requestId = new Headers(init?.headers).get("PayPal-Request-Id") ?? "";
        requestIds.push(requestId);
        if (storedAuthorizationResponse) return jsonResponse(storedAuthorizationResponse);

        providerAuthorizationActions += 1;
        storedAuthorizationResponse = {
          id: lostResponseOrderId,
          status: "COMPLETED",
          purchase_units: [{
            reference_id: lostResponseSessionId,
            amount: { currency_code: "USD", value: "30.00" },
            payments: {
              authorizations: [{
                id: lostResponseAuthorizationId,
                status: "CREATED",
                expiration_time: "2026-09-26T12:00:00Z",
              }],
            },
          }],
        };
        throw new Error("PayPal response lost after authorization was created");
      }
      throw new Error(`Unexpected PayPal request: ${url} ${init?.method ?? "GET"}`);
    };

    async function authorize() {
      const auth = await fetch(`${baseUrl}/api/auth/demo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "TRADER" }),
      });
      const { previewToken } = await auth.json() as { previewToken: string };
      return fetch(`${baseUrl}/api/sessions/${lostResponseSessionId}/payment/authorize`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tradigo-preview-session": previewToken,
        },
        body: "{}",
      });
    }

    const firstResponse = await authorize();
    assert.equal(firstResponse.status, 409);
    assert.match(String((await firstResponse.json() as { error?: { message?: string } }).error?.message), /not confirmed/i);
    assert.equal(providerAuthorizationActions, 1);

    const firstState = await pool.query(
      "SELECT status, payment_status FROM tradigo_sessions WHERE id=$1",
      [lostResponseSessionId],
    );
    assert.deepEqual(firstState.rows[0], { status: "PAYMENT_READY", payment_status: "PAYPAL_ORDER_CREATED" });
    assert.equal((await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_payment_intents WHERE session_id=$1 AND kind='AUTHORIZE'",
      [lostResponseSessionId],
    )).rows[0].count, 0);

    const retryResponse = await authorize();
    assert.equal(retryResponse.status, 200);
    assert.equal((await retryResponse.json() as { idempotent?: boolean }).idempotent, undefined);
    assert.equal(providerAuthorizationRequests, 2);
    assert.equal(providerAuthorizationActions, 1);
    assert.deepEqual(requestIds, [`authorize:${lostResponseSessionId}`, `authorize:${lostResponseSessionId}`]);

    const state = await pool.query(
      `SELECT status, payment_status, paypal_order_id, paypal_authorization_id,
              paypal_authorization_status, paypal_authorization_expires_at
       FROM tradigo_sessions WHERE id=$1`,
      [lostResponseSessionId],
    );
    assert.deepEqual(state.rows[0], {
      status: "ROOM_READY",
      payment_status: "PAYPAL_AUTHORIZED",
      paypal_order_id: lostResponseOrderId,
      paypal_authorization_id: lostResponseAuthorizationId,
      paypal_authorization_status: "CREATED",
      paypal_authorization_expires_at: new Date("2026-09-26T12:00:00Z"),
    });

    const intents = await pool.query(
      `SELECT provider, provider_reference, kind, amount_cents, currency, status,
              idempotency_key, details
       FROM tradigo_payment_intents WHERE session_id=$1 AND kind='AUTHORIZE'`,
      [lostResponseSessionId],
    );
    assert.equal(intents.rowCount, 1);
    assert.deepEqual(intents.rows[0], {
      provider: "PAYPAL",
      provider_reference: lostResponseOrderId,
      kind: "AUTHORIZE",
      amount_cents: 3000,
      currency: "USD",
      status: "AUTHORIZED",
      idempotency_key: `authorize:${lostResponseSessionId}`,
      details: { authorizationId: lostResponseAuthorizationId },
    });
    assert.equal((await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_session_events WHERE session_id=$1 AND event_type='PAYPAL_AUTHORIZED'",
      [lostResponseSessionId],
    )).rows[0].count, 1);
  });

  it("does not duplicate ledger or payout updates for duplicate webhook delivery", async () => {
    globalThis.fetch = paypalFetch();
    const event = {
      id: eventId,
      event_type: "PAYMENT.REFUNDED",
      resource: { id: "refund-duplicate", custom_id: sessionId, status: "COMPLETED", amount: { value: "30.00" } },
    };
    const first = await postWebhook(event);
    const second = await postWebhook(event);
    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);
    assert.equal((await second.body).duplicate, true);

    const counts = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM tradigo_payment_webhook_events WHERE event_id=$1) AS events,
        (SELECT COUNT(*)::int FROM tradigo_ledger_entries WHERE session_id=$2 AND entry_type LIKE 'REFUND%') AS ledger,
        (SELECT COUNT(*)::int FROM tradigo_payment_intents WHERE session_id=$2 AND idempotency_key='paypal-webhook:'||$1) AS intents`,
      [eventId, sessionId],
    );
    assert.deepEqual(counts.rows[0], { events: 1, ledger: 4, intents: 1 });
    const payout = await pool.query("SELECT status, provider_reference FROM tradigo_payouts WHERE session_id=$1", [sessionId]);
    assert.deepEqual(payout.rows[0], { status: "REFUNDED", provider_reference: "refund-duplicate" });
  });

  it("keeps failed provider reconciliation visible to moderators", async () => {
    const expiresAt = Date.now() + 60_000;
    const payload = `contract-moderator.MODERATOR.${expiresAt}`;
    const token = `${payload}.${createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("base64url")}`;
    const response = await fetch(`${baseUrl}/api/admin/paypal/reconciliation`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { items: Array<{ event_id: string; status: string; error: string }> };
    assert.equal(body.items.some((item) => item.event_id === failedEventId && item.status === "FAILED" && item.error === "provider unavailable"), true);
  });

  it("does not authorize reconciliation with the legacy shared key", async () => {
    const response = await fetch(`${baseUrl}/api/admin/paypal/reconciliation`, {
      headers: { "x-tradigo-admin-key": "contract-admin" },
    });
    assert.equal(response.status, 403);
  });
});