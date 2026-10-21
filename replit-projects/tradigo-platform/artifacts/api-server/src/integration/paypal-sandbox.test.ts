import assert from "node:assert/strict";
import { describe, it } from "node:test";

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYMENT_PROVIDER_SECRET;
const apiBase = process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";

describe("PayPal sandbox credentials", () => {
  it("authenticates without putting credentials in source", { skip: !clientId || !clientSecret }, async () => {
    const response = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    assert.equal(response.ok, true, `PayPal sandbox authentication failed (${response.status})`);
    const body = await response.json() as { access_token?: string };
    assert.ok(body.access_token);
  });
});