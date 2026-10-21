import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { pool } from "@workspace/db";
import app from "./app";
import { updateCustomerState } from "./tradify-runtime";

const email = process.env.CUSTOMER_STATE_TEST_EMAIL ?? `customer-state-${Date.now()}@example.test`;
const password = "customer-state-pass";
const uniqueLabel = process.env.CUSTOMER_STATE_TEST_LABEL ?? `Durable alert ${Date.now()}`;
const alertRequestId = `alert-request-${Date.now()}`;
const tradeRequestId = `trade-request-${Date.now()}`;
const probeMode = process.argv.includes("--probe");

async function request(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json() as Record<string, unknown> | Array<Record<string, unknown>>;
  return { status: response.status, body };
}

async function startServer() {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}/api` };
}

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function jsonHeaders(token?: string) {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function signIn(baseUrl: string) {
  const response = await request(baseUrl, "/auth/sign-in", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return String((response.body as Record<string, unknown>).token);
}

async function runProbe() {
  const { server, baseUrl } = await startServer();
  try {
    const token = await signIn(baseUrl);
    const headers = { authorization: `Bearer ${token}` };
    const profile = await request(baseUrl, "/user/profile", { headers });
    assert.equal(profile.status, 200);
    const profileBody = profile.body as Record<string, unknown>;
    assert.ok((profileBody.watchlist as string[]).includes("XAGUSD"));
    assert.ok((profileBody.alertSymbols as string[]).includes("XAGUSD"));

    const alerts = await request(baseUrl, "/user/alerts", { headers });
    assert.equal(alerts.status, 200);
    assert.ok((alerts.body as Array<Record<string, unknown>>).some((alert) => alert.label === uniqueLabel));

    const trades = await request(baseUrl, "/user/trades", { headers });
    assert.equal(trades.status, 200);
    assert.equal((trades.body as Array<Record<string, unknown>>).length, 1);
    assert.equal((trades.body as Array<Record<string, unknown>>)[0]?.symbol, "XAGUSD");

    const notifications = await request(baseUrl, "/user/notifications", { headers });
    assert.equal(notifications.status, 200);
    assert.ok((notifications.body as Array<Record<string, unknown>>).length > 0);
    assert.ok((notifications.body as Array<Record<string, unknown>>).every((notification) => notification.isRead === true));
    console.log("Customer state survived a fresh API process.");
  } finally {
    await closeServer(server);
  }
}

async function runRegression() {
  const { server, baseUrl } = await startServer();
  try {
    const registered = await request(baseUrl, "/auth/register", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email, password }),
    });
    assert.equal(registered.status, 201);
    const token = String((registered.body as Record<string, unknown>).token);
    const userId = String(((registered.body as { user: { id: string } }).user).id);
    await updateCustomerState(userId, (candidate) => {
      candidate.profile.membership = "Pro";
      candidate.membershipSource = "REVENUECAT";
      candidate.subscriptionStatus = "ACTIVE";
      candidate.notifications = [{
        id: `notification-${userId}`,
        timestamp: Date.now(),
        timeLabel: "Just now",
        symbol: "XAUUSD",
        type: "MARKET_WARNING",
        title: "Saved notification",
        message: "Persistence regression fixture",
        isRead: false,
      }];
    });
    const headers = jsonHeaders(token);

    const notifications = await request(baseUrl, "/user/notifications", { headers });
    assert.equal(notifications.status, 200);
    const notificationId = (notifications.body as Array<Record<string, unknown>>)[0]?.id;
    assert.ok(typeof notificationId === "string");

    const watchlist = await request(baseUrl, "/watchlist", {
      method: "POST",
      headers,
      body: JSON.stringify({ symbol: "XAGUSD" }),
    });
    assert.equal(watchlist.status, 200);
    await request(baseUrl, "/user/watchlist/XAGUSD/alert", {
      method: "PUT",
      headers,
      body: JSON.stringify({ active: true }),
    });

    const alerts = await Promise.all(Array.from({ length: 2 }, () => request(baseUrl, "/user/alerts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: alertRequestId,
        symbol: "XAGUSD",
        condition: "ABOVE",
        target: 35,
        label: uniqueLabel,
        active: true,
      }),
    })));
    assert.deepEqual(alerts.map((result) => result.status).sort(), [201, 201]);
    assert.equal(
      (alerts[0]?.body as Record<string, unknown>).alert
      && ((alerts[0]?.body as Record<string, unknown>).alert as Record<string, unknown>).id,
      (alerts[1]?.body as Record<string, unknown>).alert
      && ((alerts[1]?.body as Record<string, unknown>).alert as Record<string, unknown>).id,
    );

    const trades = await Promise.all(Array.from({ length: 2 }, () => request(baseUrl, "/user/trades", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: tradeRequestId, symbol: "XAGUSD", direction: "LONG", entry: 34, stop: 33, target: 35 }),
    })));
    assert.deepEqual(trades.map((result) => result.status).sort(), [201, 201]);
    assert.equal(
      (trades[0]?.body as Record<string, unknown>).trade
      && ((trades[0]?.body as Record<string, unknown>).trade as Record<string, unknown>).id,
      (trades[1]?.body as Record<string, unknown>).trade
      && ((trades[1]?.body as Record<string, unknown>).trade as Record<string, unknown>).id,
    );

    const concurrentReads = await Promise.all(Array.from({ length: 4 }, () => request(
      baseUrl,
      `/user/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: "PATCH", headers },
    )));
    assert.deepEqual(concurrentReads.map((result) => result.status).sort(), [200, 200, 200, 200]);
    const readAll = await request(baseUrl, "/user/notifications/read-all", { method: "POST", headers });
    assert.equal(readAll.status, 200);

    const otherEmail = `customer-state-isolation-${Date.now()}@example.test`;
    const other = await request(baseUrl, "/auth/register", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: otherEmail, password }),
    });
    assert.equal(other.status, 201);
    const otherToken = String((other.body as Record<string, unknown>).token);
    const otherHeaders = { authorization: `Bearer ${otherToken}` };
    const otherProfile = await request(baseUrl, "/user/profile", { headers: otherHeaders });
    assert.equal(otherProfile.status, 200);
    assert.ok(!(otherProfile.body as Record<string, unknown>).watchlist
      || !((otherProfile.body as Record<string, unknown>).watchlist as string[]).includes("XAGUSD"));
    assert.ok(!(otherProfile.body as Record<string, unknown>).alertSymbols
      || !((otherProfile.body as Record<string, unknown>).alertSymbols as string[]).includes("XAGUSD"));
    const otherAlerts = await request(baseUrl, "/user/alerts", { headers: otherHeaders });
    assert.equal(otherAlerts.status, 200);
    assert.ok(!(otherAlerts.body as Array<Record<string, unknown>>).some((entry) => entry.label === uniqueLabel));
    const otherTrades = await request(baseUrl, "/user/trades", { headers: otherHeaders });
    assert.deepEqual(otherTrades.body, []);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          fileURLToPath(new URL("../../../node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs", import.meta.url)),
          fileURLToPath(import.meta.url),
          "--probe",
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CUSTOMER_STATE_TEST_EMAIL: email, CUSTOMER_STATE_TEST_LABEL: uniqueLabel },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      child.once("error", reject);
      child.once("close", (code) => code === 0 ? resolve() : reject(new Error(output)));
    });
    console.log("Customer state persistence, account isolation, and concurrent read updates passed.");
  } finally {
    await closeServer(server);
  }
}

try {
  if (probeMode) await runProbe();
  else await runRegression();
} finally {
  await pool.end();
}