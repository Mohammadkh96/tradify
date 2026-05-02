/**
 * MT5 Bridge end-to-end sandbox test.
 *
 * Simulates the desktop `tradify_connector.pyw` POSTing to /api/mt5/sync
 * and verifies the wizard's verify-step preconditions are met:
 *
 *   1. Templating substitution in `MT5_CONNECTOR_PYTHON` produces a runnable
 *      .pyw with no leftover `__TRADIFY_*__` placeholders, and the populated
 *      file is syntactically valid Python (compiled with `python3 -m py_compile`).
 *   2. POSTing a realistic payload to `/api/mt5/sync` with the user's stored
 *      sync token returns 200 and persists balance/equity/history.
 *   3. GET /api/mt5/status/:userId immediately after returns
 *      `status === "CONNECTED"` — this is what flips the wizard from step 5
 *      (Verify) to step 6 (You're live) via the auto-advance effect in
 *      `client/src/pages/MT5Bridge.tsx`.
 *   4. POSTing with a tampered token returns HTTP 403.
 *
 * The script seeds a disposable test user (`mt5-bridge-test-<ts>@tradify.test`)
 * directly in the database so it can run without going through the auth flow,
 * and removes it (and its mt5_data / mt5_account rows) on exit.
 *
 * Run with: tsx scripts/test-mt5-bridge.ts
 *           tsx scripts/test-mt5-bridge.ts --base http://localhost:5000
 */

import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { eq } from "drizzle-orm";

import { db } from "../server/db";
import * as schema from "../shared/schema";
import { MT5_CONNECTOR_PYTHON } from "../client/src/lib/mt5ConnectorScript";

const args = process.argv.slice(2);
function flag(name: string, fallback: string): string {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return fallback;
}

const BASE_URL = flag("--base", process.env.MT5_TEST_BASE_URL || "http://localhost:5000");
const TEST_USER_ID = `mt5-bridge-test-${Date.now()}@tradify.test`;
const TEST_TOKEN = `test-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${name}${detail ? `\n         ${detail}` : ""}`);
}

async function seedUser() {
  await db.delete(schema.userRole).where(eq(schema.userRole.userId, TEST_USER_ID));
  await db.insert(schema.userRole).values({
    userId: TEST_USER_ID,
    role: "TRADER",
    syncToken: TEST_TOKEN,
    termsAccepted: true,
    riskAcknowledged: true,
  });
}

async function cleanupUser() {
  try {
    await db.delete(schema.mt5Data).where(eq(schema.mt5Data.userId, TEST_USER_ID));
  } catch {}
  try {
    await db.delete(schema.mt5Accounts).where(eq(schema.mt5Accounts.userId, TEST_USER_ID));
  } catch {}
  try {
    await db.delete(schema.mt5History).where(eq(schema.mt5History.userId, TEST_USER_ID));
  } catch {}
  try {
    await db.delete(schema.adminAuditLog).where(eq(schema.adminAuditLog.targetUserId, TEST_USER_ID));
  } catch {}
  await db.delete(schema.userRole).where(eq(schema.userRole.userId, TEST_USER_ID));
}

function populatedScript(): string {
  const apiUrl = `${BASE_URL}/api/mt5/sync`;
  return MT5_CONNECTOR_PYTHON
    .replace(/__TRADIFY_USER_ID__/g, TEST_USER_ID)
    .replace(/__TRADIFY_SYNC_TOKEN__/g, TEST_TOKEN)
    .replace(/__TRADIFY_API_URL__/g, apiUrl);
}

function testTemplating() {
  const populated = populatedScript();
  const stillHasPlaceholders = /__TRADIFY_(USER_ID|SYNC_TOKEN|API_URL)__/.test(populated);
  record(
    "Templating: no `__TRADIFY_*__` placeholders remain after substitution",
    !stillHasPlaceholders,
    stillHasPlaceholders ? "Found leftover placeholders in populated script" : undefined,
  );

  const hasUser = populated.includes(`USER_ID = "${TEST_USER_ID}"`);
  const hasToken = populated.includes(`SYNC_TOKEN = "${TEST_TOKEN}"`);
  const hasUrl = populated.includes(`API_URL = "${BASE_URL}/api/mt5/sync"`);
  record(
    "Templating: USER_ID, SYNC_TOKEN, API_URL constants are populated correctly",
    hasUser && hasToken && hasUrl,
    `userId=${hasUser} token=${hasToken} url=${hasUrl}`,
  );

  const tmp = mkdtempSync(join(tmpdir(), "tradify-mt5-test-"));
  const file = join(tmp, "tradify_connector.pyw");
  writeFileSync(file, populated, "utf8");
  let compiles = false;
  let detail = "";
  try {
    execFileSync("python3", ["-m", "py_compile", file], { stdio: "pipe" });
    compiles = true;
  } catch (e: any) {
    detail = (e.stderr?.toString() || e.message || "").slice(0, 500);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  record(
    "Templating: populated .pyw is syntactically valid Python (py_compile)",
    compiles,
    detail || undefined,
  );
}

function syncPayload(overrides: Partial<Record<string, any>> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    userId: TEST_USER_ID,
    token: TEST_TOKEN,
    accountNumber: "9000123",
    broker: "Tradify Test Broker",
    server: "TradifyTest-Demo",
    balance: 10247.55,
    equity: 10312.81,
    margin: 320.0,
    freeMargin: 9992.81,
    marginLevel: 3222.75,
    floatingPl: 65.26,
    leverage: 100,
    currency: "USD",
    positions: [
      { ticket: 555001, symbol: "EURUSD", type: "Buy", volume: 0.5, price: 1.0832, profit: 65.26, sl: 0, tp: 0 },
    ],
    history: [
      {
        ticket: 444001,
        symbol: "GBPUSD",
        type: 0,
        volume: 0.2,
        open_price: 1.2630,
        close_price: 1.2685,
        profit: 110.0,
        commission: -1.5,
        swap: 0,
        open_time: now - 7200,
        close_time: now - 3600,
      },
    ],
    ...overrides,
  };
}

async function postSync(body: object) {
  const r = await fetch(`${BASE_URL}/api/mt5/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = undefined;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, body: json, raw: text };
}

async function getStatus() {
  const r = await fetch(`${BASE_URL}/api/mt5/status/${encodeURIComponent(TEST_USER_ID)}`);
  const text = await r.text();
  let json: any = undefined;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, body: json, raw: text };
}

async function testSyncFlow() {
  const sync = await postSync(syncPayload());
  record(
    "POST /api/mt5/sync with valid token returns 200",
    sync.status === 200,
    sync.status !== 200 ? `status=${sync.status} body=${sync.raw.slice(0, 300)}` : undefined,
  );

  const status = await getStatus();
  const isConnected = status.status === 200 && status.body?.status === "CONNECTED";
  record(
    "GET /api/mt5/status/:userId returns CONNECTED (wizard auto-advances to step 6)",
    isConnected,
    !isConnected
      ? `status=${status.status} body=${status.raw.slice(0, 300)}`
      : `lastSync=${status.body.lastSync} balance=${status.body.metrics?.balance}`,
  );

  const balanceOk =
    status.body?.metrics &&
    parseFloat(String(status.body.metrics.balance)) === 10247.55 &&
    parseFloat(String(status.body.metrics.equity)) === 10312.81;
  record(
    "Status payload reflects last sync metrics (balance/equity persisted)",
    !!balanceOk,
    balanceOk
      ? undefined
      : `metrics=${JSON.stringify(status.body?.metrics)}`,
  );

  const positionsOk = Array.isArray(status.body?.metrics?.positions)
    && status.body.metrics.positions.length === 1
    && status.body.metrics.positions[0].symbol === "EURUSD";
  record(
    "Open positions array round-trips through /sync → /status",
    !!positionsOk,
    positionsOk ? undefined : `positions=${JSON.stringify(status.body?.metrics?.positions)}`,
  );

  const bad = await postSync(syncPayload({ token: "definitely-not-the-token" }));
  record(
    "POST /api/mt5/sync with wrong token is rejected with HTTP 403",
    bad.status === 403,
    bad.status !== 403 ? `status=${bad.status} body=${bad.raw.slice(0, 200)}` : undefined,
  );

  const noAuth = await postSync({ accountNumber: "9000123", balance: 1 });
  record(
    "POST /api/mt5/sync without userId/token is rejected with HTTP 401",
    noAuth.status === 401,
    noAuth.status !== 401 ? `status=${noAuth.status} body=${noAuth.raw.slice(0, 200)}` : undefined,
  );
}

async function main() {
  console.log("MT5 Bridge sandbox e2e test");
  console.log(`  base URL: ${BASE_URL}`);
  console.log(`  test user: ${TEST_USER_ID}`);
  console.log("");

  // Make sure the server is reachable before we touch the DB.
  try {
    await fetch(`${BASE_URL}/api/mt5/status/__healthcheck__`);
  } catch (e: any) {
    console.error(`\nERROR: cannot reach ${BASE_URL}. Is the dev server running?`);
    console.error(e?.message || e);
    process.exit(2);
  }

  console.log("→ Templating substitution");
  testTemplating();

  console.log("\n→ Backend sync flow");
  await seedUser();
  try {
    await testSyncFlow();
  } finally {
    await cleanupUser();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log(`Summary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.log("Failures:");
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` :: ${f.detail}` : ""}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(async (e) => {
  console.error("\nUNCAUGHT:", e);
  try { await cleanupUser(); } catch {}
  process.exit(2);
});
