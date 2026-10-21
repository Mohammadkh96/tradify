import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { pool } from "@workspace/db";
import { attemptPayout } from "../routes/tradigo";

const suffix = `payout-${Date.now()}`;
const coachId = `${suffix}-coach`;
const traderId = `${suffix}-trader`;
const sessionId = `${suffix}-session`;
const payoutId = `${suffix}-payout`;
const originalEnv = {
  provider: process.env.PAYMENT_PROVIDER,
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
};
const originalFetch = globalThis.fetch;
let payoutCalls = 0;
let payoutMode: "SUCCESS" | "PENDING" | "FAIL_ONCE" = "SUCCESS";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

before(async () => {
  process.env.PAYMENT_PROVIDER = "paypal";
  process.env.PAYPAL_CLIENT_ID = "payout-contract-client";
  process.env.PAYPAL_CLIENT_SECRET = "payout-contract-secret";
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (!url.includes("paypal.com")) return originalFetch(input, init);
    if (url.endsWith("/v1/oauth2/token")) return jsonResponse({ access_token: "payout-contract-token" });
    if (url.endsWith("/v1/payments/payouts")) {
      payoutCalls += 1;
      if (payoutMode === "FAIL_ONCE" && payoutCalls === 1) {
        return jsonResponse({ name: "SERVICE_UNAVAILABLE", message: "PayPal is temporarily unavailable." }, 503);
      }
      if (payoutMode === "PENDING") {
        return jsonResponse({
          batch_header: { payout_batch_id: `batch-${payoutCalls}`, batch_status: "PENDING" },
          items: [{ payout_item_id: `item-${payoutCalls}`, transaction_status: "PENDING" }],
        }, 201);
      }
      return jsonResponse({
        batch_header: { payout_batch_id: `batch-${payoutCalls}`, batch_status: "SUCCESS" },
        items: [{ payout_item_id: `item-${payoutCalls}`, transaction_status: "SUCCESS" }],
      }, 201);
    }
    throw new Error(`Unexpected PayPal request: ${url} ${init?.method ?? "GET"}`);
  };
  await pool.query(
    `INSERT INTO tradigo_coaches
      (id,display_name,headline,bio,markets,specialties,languages,years_of_experience,
       hourly_rate_cents,instant_rate_per_minute_cents,currency,verification_status,approved,availability)
     VALUES ($1,'Payout Contract Coach','Trading educator','Contract fixture',
       ARRAY['FOREX'],ARRAY['RISK'],ARRAY['English'],5,6000,100,'USD','FULLY_VERIFIED',true,'AVAILABLE')`,
    [coachId],
  );
  await pool.query(
    `INSERT INTO tradigo_sessions
      (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,payment_status,
       room_name,currency,authorized_amount_cents,final_amount_cents,coach_net_cents,
       payout_status,dispute_status,completed_at)
     VALUES ($1,$2,$3,'INSTANT','COMPLETED',30,3000,'PAYPAL_SETTLED',
       $4,'USD',3000,3000,2550,'HELD','NONE',NOW())`,
    [sessionId, traderId, coachId, `room-${sessionId}`],
  );
  await pool.query(
    `INSERT INTO tradigo_coach_payout_accounts
      (coach_id,provider,status,provider_account_id,verified_at)
     VALUES ($1,'PAYPAL','READY','merchant-contract',NOW())`,
    [coachId],
  );
  await pool.query(
    `INSERT INTO tradigo_payouts
      (id,session_id,coach_id,amount_cents,currency,status,hold_until)
     VALUES ($1,$2,$3,2550,'USD','HELD',NOW() - interval '1 minute')`,
    [payoutId, sessionId, coachId],
  );
});

after(async () => {
  await pool.query("DELETE FROM tradigo_ledger_entries WHERE session_id=$1", [sessionId]);
  await pool.query("DELETE FROM tradigo_payouts WHERE id=$1", [payoutId]);
  await pool.query("DELETE FROM tradigo_coach_payout_accounts WHERE coach_id=$1", [coachId]);
  await pool.query("DELETE FROM tradigo_sessions WHERE id=$1", [sessionId]);
  await pool.query("DELETE FROM tradigo_coaches WHERE id=$1", [coachId]);
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries({
    PAYMENT_PROVIDER: originalEnv.provider,
    PAYPAL_CLIENT_ID: originalEnv.clientId,
    PAYPAL_CLIENT_SECRET: originalEnv.clientSecret,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await pool.end();
});

describe("coach payout execution", { concurrency: false }, () => {
  it("holds a legacy READY account until independent PayPal ownership proof exists", async () => {
    payoutMode = "SUCCESS";
    payoutCalls = 0;

    const result = await attemptPayout(payoutId);
    assert.equal(result.status, "VERIFICATION_HOLD");
    assert.equal(result.reason?.code, "PAYOUT_ACCOUNT_REVERIFICATION_REQUIRED");
    assert.equal(payoutCalls, 0);

    const payout = await pool.query("SELECT status,failure_code,retryable FROM tradigo_payouts WHERE id=$1", [payoutId]);
    assert.deepEqual(payout.rows[0], {
      status: "VERIFICATION_HOLD",
      failure_code: "PAYOUT_ACCOUNT_REVERIFICATION_REQUIRED",
      retryable: false,
    });
    const session = await pool.query("SELECT payout_status FROM tradigo_sessions WHERE id=$1", [sessionId]);
    assert.equal(session.rows[0].payout_status, "VERIFICATION_HOLD");

    await pool.query(
      `UPDATE tradigo_coach_payout_accounts
       SET ownership_verified_at=NOW(), ownership_verification_source='PAYPAL_PARTNER_API'
       WHERE coach_id=$1`,
      [coachId],
    );
  });

  it("releases an eligible payout once when two workers race", async () => {
    payoutMode = "SUCCESS";
    payoutCalls = 0;
    const results = await Promise.all([attemptPayout(payoutId), attemptPayout(payoutId)]);
    assert.equal(payoutCalls, 1);
    assert.ok(results.some((result) => result.status === "PAID"));
    const state = await pool.query("SELECT status,provider_batch_id,provider_item_id FROM tradigo_payouts WHERE id=$1", [payoutId]);
    assert.deepEqual(state.rows[0], { status: "PAID", provider_batch_id: "batch-1", provider_item_id: "item-1" });
    assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM tradigo_ledger_entries WHERE session_id=$1 AND entry_type='PAYOUT_PAID'", [sessionId])).rows[0].count, 2);
  });

  it("records a retryable provider failure and recovers on the next attempt", async () => {
    await pool.query("DELETE FROM tradigo_ledger_entries WHERE session_id=$1", [sessionId]);
    await pool.query("UPDATE tradigo_payouts SET status='HELD',hold_until=NOW() - interval '1 minute',provider_batch_id=NULL,provider_item_id=NULL,provider_reference=NULL,attempt_count=0 WHERE id=$1", [payoutId]);
    await pool.query("UPDATE tradigo_sessions SET payout_status='HELD' WHERE id=$1", [sessionId]);
    payoutMode = "FAIL_ONCE";
    payoutCalls = 0;
    assert.equal((await attemptPayout(payoutId)).status, "FAILED");
    let state = await pool.query("SELECT status,retryable,failure_code FROM tradigo_payouts WHERE id=$1", [payoutId]);
    assert.deepEqual(state.rows[0], { status: "FAILED", retryable: true, failure_code: "SERVICE_UNAVAILABLE" });
    await pool.query("UPDATE tradigo_payouts SET next_attempt_at=NOW() WHERE id=$1", [payoutId]);
    assert.equal((await attemptPayout(payoutId)).status, "PAID");
    state = await pool.query("SELECT status,attempt_count FROM tradigo_payouts WHERE id=$1", [payoutId]);
    assert.deepEqual(state.rows[0], { status: "PAID", attempt_count: 2 });
  });

  it("retries a stale processing row with the same provider idempotency key", async () => {
    await pool.query("DELETE FROM tradigo_ledger_entries WHERE session_id=$1", [sessionId]);
    await pool.query(
      `UPDATE tradigo_payouts
       SET status='PROCESSING',hold_until=NOW() - interval '1 minute',provider_batch_id=NULL,
           provider_item_id=NULL,provider_reference=NULL,attempt_count=1,
           last_attempt_at=NOW() - interval '11 minutes'
       WHERE id=$1`,
      [payoutId],
    );
    await pool.query("UPDATE tradigo_sessions SET payout_status='PROCESSING' WHERE id=$1", [sessionId]);
    payoutMode = "SUCCESS";
    payoutCalls = 0;
    const result = await attemptPayout(payoutId);
    assert.equal(result.status, "PAID");
    assert.equal(payoutCalls, 1);
    const state = await pool.query("SELECT status,attempt_count FROM tradigo_payouts WHERE id=$1", [payoutId]);
    assert.deepEqual(state.rows[0], { status: "PAID", attempt_count: 2 });
  });
});