import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import app from "../app";

type PreviewRole = "TRADER" | "COACH";
let server: Server;
let baseUrl = "";

async function previewToken(role: PreviewRole): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/demo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role }),
  });
  assert.equal(response.status, 200);
  return (await response.json() as { previewToken: string }).previewToken;
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, init);
  const body = response.status === 204 ? {} : await response.json();
  return { response, body: body as Record<string, any> };
}

async function previewRequest(role: PreviewRole, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-tradigo-preview-session", await previewToken(role));
  return request(path, { ...init, headers });
}

describe("authenticated identity boundaries", () => {
  before(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("rejects missing and malformed production authentication", async () => {
    const missing = await request("/sessions");
    assert.equal(missing.response.status, 401);
    const malformed = await request("/sessions", { headers: { authorization: "Bearer not-a-firebase-token" } });
    assert.equal(malformed.response.status, 401);
  });

  it("enforces role ownership for preview actors without widening production access", async () => {
    const traderOnCoachRoute = await previewRequest("TRADER", "/coach/earnings");
    assert.equal(traderOnCoachRoute.response.status, 403);
    const coachOnTraderRoute = await previewRequest("COACH", "/learning/passport");
    assert.equal(coachOnTraderRoute.response.status, 403);
    const traderOnAdminRoute = await previewRequest("TRADER", "/admin/disputes");
    assert.equal(traderOnAdminRoute.response.status, 403);
    const previewAnalytics = await previewRequest("TRADER", "/admin/analytics");
    assert.equal(previewAnalytics.response.status, 403);
  });

  it("does not issue preview administrator identities", async () => {
    const response = await request("/auth/demo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "ADMIN" }),
    });
    assert.equal(response.response.status, 404);
  });

  it("does not let a preview role token override a different bearer identity", async () => {
    const token = await previewToken("TRADER");
    const response = await request("/sessions", {
      headers: {
        authorization: "Bearer not-a-firebase-token",
        "x-tradigo-preview-session": token,
      },
    });
    assert.equal(response.response.status, 401);
  });
});