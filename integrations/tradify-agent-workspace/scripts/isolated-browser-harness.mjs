import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "artifacts/api-server");
const signalsRoot = path.join(root, "artifacts/tradify-signals");
const adminRoot = path.join(root, "artifacts/tradify-admin");
const screenshotsRoot = path.join(root, "generated-artifacts/isolated-browser-tests");
const tsxCli = path.join(root, "node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs");
const requireDb = createRequire(path.join(root, "lib/db/package.json"));
const requireSignals = createRequire(path.join(signalsRoot, "package.json"));
const { Pool } = requireDb("pg");
const { chromium } = requireSignals("@playwright/test");
const publicCustomerHost = "tradify-signals.replit.app";
const publicAdminHost = "signals.tradifyapp.com";
const browserExe = "/repl/tools/bin/chromium";
const historyOnly = process.argv.includes("--history-only");
const linkAuthOnly = process.argv.includes("--journal-link-only");
const riskDisclaimerSource = fs.readFileSync(
  path.join(signalsRoot, "constants/risk-disclaimer.ts"),
  "utf8",
);
const riskDisclaimerVersion = riskDisclaimerSource.match(
  /export const RISK_DISCLAIMER_VERSION\s*=\s*["']([^"']+)["']/,
)?.[1];

function pickPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function minimalEnvironment(overrides = {}) {
  const allowed = [
    "PATH",
    "HOME",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "NIX_LD",
    "NIX_LD_LIBRARY_PATH",
    "SSL_CERT_FILE",
    "NIX_SSL_CERT_FILE",
    "PNPM_HOME",
    "COREPACK_HOME",
  ];
  const env = Object.fromEntries(allowed.filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  return {
    ...env,
    CI: "1",
    NODE_ENV: "test",
    OTEL_SDK_DISABLED: "true",
    SENTRY_DSN: "",
    REPLIT_DEV_DOMAIN: publicAdminHost,
    REPLIT_EXPO_DEV_DOMAIN: publicCustomerHost,
    REPLIT_DOMAINS: `${publicAdminHost},${publicCustomerHost}`,
    ...overrides,
  };
}

function run(command, args, env, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited (code=${code ?? "null"}, signal=${signal ?? "none"}).`));
    });
  });
}

function startChild(command, args, env, cwd = root) {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const capture = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-5000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.recentOutput = () => output;
  return child;
}

async function waitForHttp(url, child, label) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited early: ${child.recentOutput()}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return response;
    } catch {
      // Poll only the explicit loopback URL until the test process is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${label} readiness timed out: ${child.recentOutput()}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("No database configuration; refusing to run.");
  if (!fs.existsSync(browserExe)) throw new Error("The local Chromium executable is unavailable; refusing to run.");
  fs.mkdirSync(screenshotsRoot, { recursive: true });

  const provisionUrl = new URL(process.env.DATABASE_URL);
  provisionUrl.pathname = "/postgres";
  provisionUrl.searchParams.set("application_name", "tradify-isolated-browser-provisioner");
  const provisioner = new Pool({ connectionString: provisionUrl.toString(), max: 1, connectionTimeoutMillis: 5000 });
  const dbName = `tradify_browser_${process.pid}_${crypto.randomBytes(5).toString("hex")}`;
  let databaseCreated = false;
  let isolatedPool;
  let apiChild;
  let adminChild;
  let browser;
  let staticServer;
  let tempApiServer;
  const blockedExternalHosts = new Set();
  const browserErrors = [];
  const browser404s = [];
  const contexts = [];

  try {
    const { rows } = await provisioner.query(
      "SELECT current_database() AS database_name, pg_is_in_recovery() AS is_replica, (SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user) AS can_create_database",
    );
    assert.equal(rows[0]?.database_name, "postgres", "Provisioning must use only the postgres maintenance database.");
    assert.equal(rows[0]?.is_replica, false, "Database provisioning cannot run against a replica.");
    assert.equal(rows[0]?.can_create_database, true, "The maintenance role must be able to create a disposable database.");
    assert.notEqual(rows[0]?.database_name, "heliumdb", "Never provision through the shared development database.");
    assert.match(dbName, /^tradify_browser_[0-9]+_[a-f0-9]+$/);
    await provisioner.query(`CREATE DATABASE "${dbName}"`);
    databaseCreated = true;

    const testUrl = new URL(process.env.DATABASE_URL);
    testUrl.pathname = `/${dbName}`;
    testUrl.searchParams.set("application_name", "tradify-isolated-browser-test");
    process.env.DATABASE_URL = testUrl.toString();
    process.env.PGDATABASE = dbName;
    const apiPort = await pickPort();
    const adminPort = await pickPort();
    const staticPort = await pickPort();
    const sessionSecret = crypto.randomBytes(48).toString("base64url");
    const bridgeSecret = crypto.randomBytes(32).toString("hex");
    const testEnv = minimalEnvironment({
      DATABASE_URL: testUrl.toString(),
      PGDATABASE: dbName,
      SESSION_SECRET: sessionSecret,
      MT5_BRIDGE_SECRET: bridgeSecret,
      PORT: String(apiPort),
      BASE_PATH: "/",
    });

    await run("pnpm", ["--filter", "@workspace/db", "run", "push-force"], testEnv);
    isolatedPool = new Pool({ connectionString: testUrl.toString(), max: 2 });
    const isolatedCheck = await isolatedPool.query("SELECT current_database() AS database_name");
    assert.equal(isolatedCheck.rows[0]?.database_name, dbName, "Test runner must use its disposable database.");

    tempApiServer = path.join(apiRoot, "src", `.isolated-browser-server-${process.pid}.ts`);
    const dbPackageImport = "@workspace/db";
    fs.writeFileSync(
      tempApiServer,
      `import app from "./app.ts";\nimport { pool } from "${dbPackageImport}";\nconst expected=process.env.PGDATABASE;\nconst result=await pool.query("SELECT current_database() AS name");\nif(result.rows[0]?.name!==expected) throw new Error("API database isolation check failed");\nconst server=app.listen(Number(process.env.PORT),"127.0.0.1",()=>console.log("ISOLATED_API_READY="+result.rows[0].name));\nprocess.once("SIGTERM",()=>server.close(()=>void pool.end()));\n`,
    );
    apiChild = startChild(process.execPath, [tsxCli, tempApiServer], testEnv, apiRoot);
    await waitForHttp(`http://127.0.0.1:${apiPort}/api/health`, apiChild, "Isolated API");
    assert.match(apiChild.recentOutput(), new RegExp(`ISOLATED_API_READY=${dbName}`));

    if (!historyOnly && !linkAuthOnly) {
      const adminEnv = minimalEnvironment({
        NODE_ENV: "production",
        PORT: String(adminPort),
        BASE_PATH: "/tradify-admin/",
      });
      await run("pnpm", ["--filter", "@workspace/tradify-admin", "run", "build"], adminEnv);
      adminChild = startChild(
        "pnpm",
        ["--filter", "@workspace/tradify-admin", "exec", "vite", "preview", "--config", "vite.config.ts", "--host", "127.0.0.1", "--port", String(adminPort), "--strictPort"],
        adminEnv,
        root,
      );
      await waitForHttp(`http://127.0.0.1:${adminPort}/tradify-admin/login`, adminChild, "Isolated Admin preview");
    }

    const { createStaticServer } = requireSignals("./server/serve.js");
    staticServer = createStaticServer({
      staticRoot: process.env.SIGNALS_BROWSER_STATIC_DIR ||
        path.join(signalsRoot, "static-build"),
      basePath: "/",
    });
    await new Promise((resolve, reject) => {
      staticServer.once("error", reject);
      staticServer.listen(staticPort, "127.0.0.1", resolve);
    });

    browser = await chromium.launch({
      executablePath: browserExe,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    async function newRoutedContext(viewport) {
      const context = await browser.newContext({ viewport, serviceWorkers: "block" });
      contexts.push(context);
      await context.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (
          requestUrl.protocol === "https:" &&
          [publicCustomerHost, publicAdminHost].includes(requestUrl.hostname)
        ) {
          const apiRequest = requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/");
          const localPort = apiRequest
            ? apiPort
            : requestUrl.hostname === publicAdminHost
              ? adminPort
              : staticPort;
          const headers = await route.request().allHeaders();
          headers.origin = `http://127.0.0.1:${localPort}`;
          headers.host = `127.0.0.1:${localPort}`;
          if (headers.referer) {
            const refererPath = new URL(headers.referer).pathname;
            headers.referer = `http://127.0.0.1:${localPort}${refererPath}`;
          }
          try {
            const response = await route.fetch({
              url: `http://127.0.0.1:${localPort}${requestUrl.pathname}${requestUrl.search}`,
              headers,
              maxRedirects: 0,
              timeout: 15_000,
            });
            await route.fulfill({ response });
          } catch {
            await route.abort("failed").catch(() => {});
          }
          return;
        }
        if (
          requestUrl.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(requestUrl.hostname)
        ) {
          await route.continue();
          return;
        }
        if (["data:", "blob:"].includes(requestUrl.protocol)) {
          await route.continue();
          return;
        }
        blockedExternalHosts.add(requestUrl.hostname);
        await route.abort("blockedbyclient");
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      const requestsById = new Map();
      await cdp.send("Network.enable");
      cdp.on("Network.requestWillBeSent", (event) => {
        const firstFrame = event.initiator?.stack?.callFrames?.[0];
        requestsById.set(event.requestId, {
          initiatorType: event.initiator?.type ?? "unknown",
          initiatorUrl: firstFrame?.url || event.initiator?.url || null,
          initiatorLine: firstFrame?.lineNumber ?? null,
          initiatorFunction: firstFrame?.functionName || null,
        });
      });
      cdp.on("Network.responseReceived", (event) => {
        if (event.response.status !== 404) return;
        browser404s.push({
          url: event.response.url,
          resourceType: event.type,
          status: event.response.status,
          frameId: event.frameId,
          ...requestsById.get(event.requestId),
        });
      });
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text().slice(0, 250));
      });
      return { context, page };
    }

    const customerEmail = `browser-customer-${crypto.randomUUID()}@example.test`;
    const customerPassword = `test-${crypto.randomBytes(18).toString("hex")}`;
    const customer = await newRoutedContext({ width: 402, height: 874 });
    if (historyOnly) {
      const bridgePost = (route, body) =>
        fetch(`http://127.0.0.1:${apiPort}/api/mt5/bridge/${route}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-bridge-secret": bridgeSecret,
          },
          body: JSON.stringify(body),
        });
      const utcNow = Math.floor(Date.now() / 1000);
      const brokerSchedule = {
        source: "MT5_SYMBOL_INFO_SESSION_TRADE",
        complete: true,
        serverTime: utcNow + 10_800,
        utcTime: utcNow,
        sessions: Array.from({ length: 5 }, (_, index) => ({
          dayOfWeek: index + 1,
          fromSeconds: 0,
          toSeconds: 86_400,
        })),
      };
      const coverageSymbols = ["EURUSD", "EURGBP", "GBPJPY"];
      const specifications = await bridgePost("specs", {
        specs: coverageSymbols.map((brokerSymbol) => ({
          brokerSymbol,
          tradingSessions: brokerSchedule,
        })),
      });
      assert.equal(specifications.status, 200, "Synthetic broker session fixture must be accepted by the disposable API.");

      const rangeStartUtc = Math.floor(Date.parse("2026-10-05T00:00:00Z") / 1000);
      const rangeEndUtc = rangeStartUtc + 10 * 86_400;
      const expectedSessionTimes = [];
      for (let time = rangeStartUtc; time < rangeEndUtc; time += 900) {
        const local = new Date((time + 10_800) * 1000);
        const localDay = local.getUTCDay();
        if (localDay >= 1 && localDay <= 5) expectedSessionTimes.push(time);
      }
      const missingUtc = expectedSessionTimes[Math.floor(expectedSessionTimes.length / 2)];
      const syntheticCandle = (time) => ({
        time: time + 10_800,
        open: 1.1,
        high: 1.101,
        low: 1.099,
        close: 1.1005,
        volume: 1,
      });
      const initialCandles = expectedSessionTimes
        .filter((time) => time !== missingUtc)
        .map(syntheticCandle);
      for (const symbol of coverageSymbols) {
        const initialBatch = await bridgePost("candles", {
          bridgeId: "synthetic-history-test",
          symbol,
          timeframe: "M15",
          syncMode: "PARTIAL",
          candles: initialCandles,
        });
        assert.equal(initialBatch.status, 200, `Synthetic initial ${symbol} M15 batch must persist only in the disposable database.`);
        const partialState = await isolatedPool.query(
          "SELECT full_sync_keys FROM tradify_mt5_bridge_state WHERE id='PRIMARY'",
        );
        assert.ok(
          !(partialState.rows[0]?.full_sync_keys ?? []).includes(`${symbol}:M15`),
          `A PARTIAL M15 batch must never mark ${symbol} as fully synchronized.`,
        );
        const coverageRequest = {
          symbol,
          startUtc: rangeStartUtc,
          endUtc: rangeEndUtc,
        };
        const incompleteFullBatch = await bridgePost("candles", {
          bridgeId: "synthetic-history-test",
          symbol,
          timeframe: "M15",
          syncMode: "FULL",
          coverageRange: { startUtc: rangeStartUtc, endUtc: rangeEndUtc },
          candles: initialCandles,
        });
        assert.equal(incompleteFullBatch.status, 200, "An incomplete FULL claim may persist its valid rows but must not establish readiness.");
        const incompleteFullState = await isolatedPool.query(
          "SELECT full_sync_keys FROM tradify_mt5_bridge_state WHERE id='PRIMARY'",
        );
        assert.ok(
          !(incompleteFullState.rows[0]?.full_sync_keys ?? []).includes(`${symbol}:M15`),
          `An incomplete ten-day batch must not mark ${symbol} FULL.`,
        );
        const firstCoverageResponse = await bridgePost("history/coverage", coverageRequest);
        const firstCoverage = await firstCoverageResponse.json();
        assert.equal(
          firstCoverageResponse.status,
          200,
          `${symbol} coverage must use the freshly supplied synthetic broker schedule: ${JSON.stringify(firstCoverage)}`,
        );
        assert.equal(firstCoverage.complete, false, `${symbol} incomplete session-open history must not be declared complete.`);
        assert.deepEqual(
          firstCoverage.missingIntervals.map(({ startUtc, endUtc }) => ({ startUtc, endUtc })),
          [{ startUtc: missingUtc, endUtc: missingUtc + 900 }],
        );
        assert.equal(firstCoverage.rangeStartServerEpoch, rangeStartUtc + 10_800);
        assert.equal(firstCoverage.rangeEndServerEpoch, rangeEndUtc + 10_800);
        assert.equal(firstCoverage.missingIntervals[0].startServerEpoch, missingUtc + 10_800);
        const repairBatch = await bridgePost("candles", {
          bridgeId: "synthetic-history-test",
          symbol,
          timeframe: "M15",
          syncMode: "INCREMENTAL",
          candles: [syntheticCandle(missingUtc)],
        });
        assert.equal(repairBatch.status, 200, `Synthetic ${symbol} broker-range retry must be accepted in the disposable database.`);
        const repairedCount = await isolatedPool.query(
          "SELECT count(*)::int AS row_count FROM tradify_mt5_candles WHERE broker_symbol=$1 AND timeframe='M15' AND time=$2",
          [symbol, missingUtc],
        );
        assert.equal(repairedCount.rows[0]?.row_count, 1, "The first repair must create one idempotent candle row.");
        const duplicateRepairBatch = await bridgePost("candles", {
          bridgeId: "synthetic-history-test",
          symbol,
          timeframe: "M15",
          syncMode: "PARTIAL",
          candles: [syntheticCandle(missingUtc)],
        });
        assert.equal(duplicateRepairBatch.status, 200, "A duplicate candle delivery must be safely accepted.");
        const duplicateCount = await isolatedPool.query(
          "SELECT count(*)::int AS row_count FROM tradify_mt5_candles WHERE broker_symbol=$1 AND timeframe='M15' AND time=$2",
          [symbol, missingUtc],
        );
        assert.equal(duplicateCount.rows[0]?.row_count, 1, "Duplicate delivery must not create another candle row.");
        const finalCoverageResponse = await bridgePost("history/coverage", coverageRequest);
        assert.equal(finalCoverageResponse.status, 200);
        const finalCoverage = await finalCoverageResponse.json();
        assert.equal(finalCoverage.complete, true, `Only repaired, complete ${symbol} broker-session history may pass coverage.`);
        assert.deepEqual(finalCoverage.missingIntervals, []);
        const verifiedFullBatch = await bridgePost("candles", {
          bridgeId: "synthetic-history-test",
          symbol,
          timeframe: "M15",
          syncMode: "FULL",
          coverageRange: { startUtc: rangeStartUtc, endUtc: rangeEndUtc },
          candles: expectedSessionTimes.map(syntheticCandle),
        });
        assert.equal(verifiedFullBatch.status, 200, "A complete ten-day FULL batch must be accepted after server-side coverage verification.");
        const verifiedFullState = await isolatedPool.query(
          "SELECT full_sync_keys FROM tradify_mt5_bridge_state WHERE id='PRIMARY'",
        );
        assert.ok(
          (verifiedFullState.rows[0]?.full_sync_keys ?? []).includes(`${symbol}:M15`),
          `Only complete verified ten-day coverage may mark ${symbol} FULL.`,
        );
      }
      const staleSchedule = await bridgePost("specs", {
        specs: [{
          brokerSymbol: "AUDUSD",
          tradingSessions: {
            ...brokerSchedule,
            utcTime: brokerSchedule.utcTime - 300,
          },
        }],
      });
      assert.equal(staleSchedule.status, 200, "A malformed test fixture may be accepted as a symbol spec without trusted sessions.");
      const unavailableSchedule = await bridgePost("history/coverage", {
        symbol: "AUDUSD",
        startUtc: rangeStartUtc,
        endUtc: rangeEndUtc,
      });
      assert.equal(
        unavailableSchedule.status,
        409,
        "Coverage must fail closed when the only supplied schedule is stale.",
      );
      assert.equal(
        (await unavailableSchedule.json()).error,
        "VERIFIED_BROKER_SESSIONS_UNAVAILABLE",
      );

      const focusedEmail = `browser-history-${crypto.randomUUID()}@example.test`;
      const focusedPassword = `test-${crypto.randomBytes(18).toString("hex")}`;
      const registration = await fetch(`http://127.0.0.1:${apiPort}/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: `https://${publicCustomerHost}` },
        body: JSON.stringify({
          email: focusedEmail,
          password: focusedPassword,
          acceptRiskDisclaimer: true,
          riskDisclaimerVersion,
        }),
      });
      assert.equal(registration.status, 201, "Focused history fixture account must register on the isolated API.");
      const registered = await registration.json();
      const focusedUserId = registered?.user?.id;
      assert.equal(typeof focusedUserId, "string", "Isolated API must return the synthetic user id.");
      await customer.page.goto(`https://${publicCustomerHost}/app/auth?mode=signin`, { waitUntil: "networkidle" });
      await customer.page.getByTestId("auth-email").fill(focusedEmail);
      await customer.page.getByTestId("auth-password").fill(focusedPassword);
      await customer.page.getByTestId("auth-submit").click();
      await customer.page.waitForFunction(async () => {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (response.status !== 200) return false;
        const body = await response.json();
        return typeof body?.user?.id === "string";
      }, null, { timeout: 20_000 });
      if (new URL(customer.page.url()).pathname === "/app/legal") {
        await customer.page.getByTestId("risk-disclaimer-acknowledge").click();
        await customer.page.getByText("Acknowledgement saved to your account.", { exact: true })
          .waitFor({ state: "visible", timeout: 15_000 });
      }

      const fixtureTrade = {
        id: `browser-history-trade-${crypto.randomUUID()}`,
        symbol: "EURUSD",
        direction: "LONG",
        status: "CLOSED",
        entry: 1.08,
        stop: 1.075,
        target: 1.09,
        progress: 2,
        r: 2,
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
        closedAt: new Date().toISOString(),
      };
      await isolatedPool.query(
        "UPDATE tradify_users SET membership='Free', membership_source='ADMIN_OVERRIDE', subscription_status=NULL, trades=$1::jsonb WHERE id=$2",
        [JSON.stringify([fixtureTrade]), focusedUserId],
      );
      const fixtureSignal = {
        id: `browser-history-signal-${crypto.randomUUID()}`,
        symbol: "EURUSD",
        name: "Euro / US Dollar",
        market: "FOREX",
        direction: "LONG",
        strategy: "FX setup",
        grade: "A",
        action: "TP1_HIT",
        lifecycleStatus: "CLOSED",
        qualified: true,
        price: 1.09,
        entry: 1.08,
        stop: 1.075,
        tp1: 1.085,
        tp2: 1.09,
        tp3: 1.095,
        session: "London",
        age: "Synthetic test fixture",
        note: "Synthetic UI fixture; not a live result.",
      };
      await customer.page.route("**/api/signals/current*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([fixtureSignal]),
        }),
      );
      const membershipResults = {};
      for (const tier of ["Free", "Pro", "VIP"]) {
        await isolatedPool.query(
          "UPDATE tradify_users SET membership=$1 WHERE id=$2",
          [tier, focusedUserId],
        );
        await customer.page.reload({ waitUntil: "networkidle" });
        await customer.page.goto(`https://${publicCustomerHost}/app/performance`, { waitUntil: "networkidle" });
        if (tier === "Free") {
          const visibleText = await customer.page.locator("body").innerText();
          if (!visibleText.includes("30-day performance context requires Pro access")) {
            const authState = await customer.page.evaluate(async () => {
              const response = await fetch("/api/auth/me", { credentials: "include" });
              const body = response.ok ? await response.json() : null;
              return {
                path: location.pathname,
                status: response.status,
                membership: body?.user?.membership ?? null,
              };
            });
            console.log(`FOCUSED_HISTORY_MISMATCH=${JSON.stringify({
              authState,
              visibleText: visibleText.slice(0, 1000),
              browser404s,
            })}`);
          }
          assert.ok(
            visibleText.includes("30-day performance context requires Pro access"),
            "Free users must see the Pro access gate on customer performance history.",
          );
          assert.equal(await customer.page.getByText("Position history", { exact: true }).count(), 0);
          membershipResults[tier] = "history correctly gated";
        } else {
          await customer.page.getByText("Position history", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
          await customer.page.getByText("EURUSD", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
          membershipResults[tier] = "synthetic closed trade visible";
          await customer.page.screenshot({
            path: path.join(screenshotsRoot, `customer-synthetic-position-history-${tier.toLowerCase()}-402.png`),
            fullPage: true,
          });
        }
      }
      const lifecycleFixtures = [
        { key: "published", eventType: "NEW_SIGNAL", title: "New validated signal", category: "newSignals", price: 1.08, details: { direction: "LONG" } },
        { key: "entry", eventType: "ENTRY_TRIGGERED", title: "Signal entry triggered", category: "entries", price: 1.08, details: { direction: "LONG" } },
        { key: "tp1", eventType: "TP1_REACHED", title: "TP1 reached", category: "takeProfits", price: 1.085, details: { targetIndex: 1 } },
        { key: "tp2", eventType: "TP2_REACHED", title: "TP2 reached", category: "takeProfits", price: 1.09, details: { targetIndex: 2 } },
        { key: "tp3", eventType: "TP3_REACHED", title: "TP3 reached", category: "takeProfits", price: 1.095, details: { targetIndex: 3 } },
        { key: "stop", eventType: "STOP_LOSS_HIT", title: "Stop-loss hit", category: "stopLosses", price: 1.075, details: {} },
        { key: "breakeven", eventType: "BREAKEVEN_ACTIVATED", title: "Stop moved to breakeven", category: "breakevenAndChanges", price: 1.08, details: {} },
        { key: "cancelled", eventType: "SIGNAL_CANCELLED", title: "Signal cancelled", category: "breakevenAndChanges", price: null, details: {} },
        { key: "invalidated", eventType: "SIGNAL_INVALIDATED", title: "Signal invalidated", category: "breakevenAndChanges", price: null, details: {} },
      ];
      for (const [index, fixture] of lifecycleFixtures.entries()) {
        const signalId = `browser-lifecycle-${fixture.key}-${crypto.randomUUID()}`;
        const eventId = `browser-event-${fixture.key}-${crypto.randomUUID()}`;
        const occurredAt = new Date(Date.now() - (lifecycleFixtures.length - index) * 60_000);
        await isolatedPool.query(
          `INSERT INTO tradify_signal_lifecycle_states
             (signal_id,strategy_version,symbol,direction,snapshot,last_market_data_at)
           VALUES ($1,'SYNTHETIC-TEST','EURUSD','LONG',$2::jsonb,$3)`,
          [signalId, JSON.stringify({ lifecycleStatus: fixture.key }), occurredAt],
        );
        await isolatedPool.query(
          `INSERT INTO tradify_signal_lifecycle_events
             (id,signal_id,event_type,occurred_at,price,strategy_version,symbol,source_evaluation_id,details)
           VALUES ($1,$2,$3,$4,$5,'SYNTHETIC-TEST','EURUSD',$6,$7::jsonb)`,
          [eventId, signalId, fixture.eventType, occurredAt, fixture.price, eventId, JSON.stringify(fixture.details)],
        );
        await isolatedPool.query(
          `INSERT INTO tradify_user_notifications (id,user_id,event_id,category,is_read)
           VALUES ($1,$2,$3,$4,false)`,
          [`browser-notification-${fixture.key}-${crypto.randomUUID()}`, focusedUserId, eventId, fixture.category],
        );
      }
      await customer.page.reload({ waitUntil: "networkidle" });
      await customer.page.goto(`https://${publicCustomerHost}/app/notifications`, { waitUntil: "networkidle" });
      for (const fixture of lifecycleFixtures) {
        await customer.page.getByText(fixture.title, { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
      }
      await customer.page.screenshot({
        path: path.join(screenshotsRoot, "customer-synthetic-lifecycle-notifications-vip-402.png"),
        fullPage: true,
      });
      console.log(JSON.stringify({
        result: "PASS",
        focusedCheck: "synthetic customer trade history and lifecycle notifications",
        mt5HistoryCoverage: "EURUSD, EURGBP, and GBPJPY remained incomplete until repaired; incomplete FULL claims were withheld; verified ten-day FULL passed; PARTIAL batches stayed out of FULL sync; duplicate deliveries were idempotent; stale AUDUSD metadata failed closed",
        membershipResults,
        lifecyclePresentation: lifecycleFixtures.map(({ eventType, title }) => ({ eventType, title })),
        lifecycleEvents: "disposable database fixtures; no signal generation or push delivery",
        brokerExecutedTradeFeed: "not used; local customer trade history fixture",
        browser404s,
        browserErrors: browserErrors.slice(0, 20),
        screenshots: [
          ...["pro", "vip"].map((tier) =>
            path.relative(root, path.join(screenshotsRoot, `customer-synthetic-position-history-${tier}-402.png`)),
          ),
          path.relative(root, path.join(screenshotsRoot, "customer-synthetic-lifecycle-notifications-vip-402.png")),
        ],
      }, null, 2));
      return;
    }
    const authResponses = [];
    customer.page.on("response", (response) => {
      if (!new URL(response.url()).pathname.includes("/api/auth/")) return;
      authResponses.push(
        response.json().then((body) => ({
          path: new URL(response.url()).pathname,
          status: response.status(),
          error: body?.error,
          message: body?.message,
          hasToken: typeof body?.token === "string",
          hasUser: Boolean(body?.user?.id),
        })).catch(() => ({
          path: new URL(response.url()).pathname,
          status: response.status(),
        })),
      );
    });
    const rootResponses = [];
    customer.page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/") rootResponses.push(response.status());
    });
    await customer.page.goto(`https://${publicCustomerHost}/`, { waitUntil: "networkidle" });
    assert.ok(rootResponses.includes(302), "Browser root must first redirect to the PWA route.");
    assert.ok(
      ["/app/", "/app/auth"].includes(new URL(customer.page.url()).pathname),
      "The PWA root must finish on its entry or sign-in route.",
    );
    await customer.page.goto(`https://${publicCustomerHost}/app/auth?mode=signin`, { waitUntil: "networkidle" });
    await customer.page.getByText("Create account", { exact: true }).click();
    await customer.page.getByTestId("auth-display-name").fill("Synthetic Browser Customer");
    await customer.page.getByTestId("auth-email").fill(customerEmail);
    await customer.page.getByTestId("auth-password").fill(customerPassword);
    await customer.page.getByTestId("auth-consent").click();
    await customer.page.getByTestId("auth-submit").click();
    await customer.page.getByTestId("auth-registration-continue").waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    const currentUser = await customer.page.evaluate(async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      return { status: response.status, body: await response.json() };
    });
    const authResponseSummary = await Promise.all(authResponses);
    if (currentUser.status !== 200) {
      const pageText = (await customer.page.locator("body").innerText()).replaceAll(customerEmail, "[synthetic email]");
      console.log(JSON.stringify({
        debug: "customer registration/session did not authenticate",
        finalPath: new URL(customer.page.url()).pathname,
        authResponses: authResponseSummary,
        visiblePageText: pageText.slice(0, 1200),
      }, null, 2));
    }
    assert.equal(currentUser.status, 200, "Customer registration must create an authenticated browser session.");
    const customerUserId = currentUser.body?.user?.id;
    assert.equal(typeof customerUserId, "string");
    console.log("Customer registration and authenticated /auth/me passed.");

    if (linkAuthOnly) {
      await customer.page.goto(`https://${publicCustomerHost}/app/profile`, { waitUntil: "networkidle" });
      await customer.page.getByTestId("profile-manage-journal-link")
        .waitFor({ state: "visible", timeout: 15_000 });
      await customer.page.getByTestId("profile-manage-journal-link").click();
      await customer.page.waitForURL((url) => url.pathname === "/app/journal-link", { timeout: 15_000 });
      await customer.page.getByTestId("journal-link-code").waitFor({ state: "visible" });
      await customer.page.getByTestId("journal-link-preview").waitFor({ state: "visible" });
      assert.equal(
        await customer.page.getByTestId("journal-link-preview").isDisabled(),
        true,
        "Without an active peer, the UI must not allow a preview or fabricate a pairing.",
      );
      assert.equal(await customer.page.getByTestId("journal-pair-label").count(), 0);
      assert.equal(await customer.page.getByTestId("journal-link-consent").count(), 0);

      const unauthenticatedStatus = await fetch(
        `http://127.0.0.1:${apiPort}/api/v1/product-links/journal`,
      );
      assert.equal(unauthenticatedStatus.status, 401, "Unauthenticated account-link status must be rejected.");

      const sessionCookie = (await customer.context.cookies(`https://${publicCustomerHost}`))
        .find(({ name }) => name === "__Host-tradify-session");
      assert.ok(sessionCookie?.value, "Browser authentication must establish the normal customer session cookie.");
      const authCookieHeader = `${sessionCookie.name}=${sessionCookie.value}`;
      const previewUrl = `http://127.0.0.1:${apiPort}/api/v1/product-links/journal/preview`;
      const previewBody = JSON.stringify({ contractVersion: "tradify-account-linking-v1" });
      const csrfRequest = (origin) => fetch(previewUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authCookieHeader,
          origin,
          host: `127.0.0.1:${apiPort}`,
        },
        body: previewBody,
      });
      const rejectedOrigin = await csrfRequest("https://attacker.example");
      assert.equal(rejectedOrigin.status, 403, "Authenticated browser-cookie mutations must reject a foreign origin.");
      const sameOrigin = await csrfRequest(`http://127.0.0.1:${apiPort}`);
      assert.equal(
        sameOrigin.status,
        503,
        "A legitimate same-origin authenticated request should pass CSRF and fail closed because no peer is active.",
      );

      await customer.page.screenshot({
        path: path.join(screenshotsRoot, "journal-link-authenticated-no-peer.png"),
        fullPage: true,
      });
      console.log(JSON.stringify({
        result: "PASS",
        authenticatedRoute: "/app/journal-link",
        syntheticCustomerSession: "PASS",
        unauthenticatedStatus: unauthenticatedStatus.status,
        sameOriginAuthenticatedMutation: sameOrigin.status,
        invalidOrigin: rejectedOrigin.status,
        pairing: "Not attempted; no genuine Journal authorization or Phase B peer.",
        screenshot: path.relative(root, path.join(screenshotsRoot, "journal-link-authenticated-no-peer.png")),
      }, null, 2));
      return;
    }

    const denial = await customer.page.evaluate(async () => {
      const response = await fetch("/api/admin/users", { credentials: "include" });
      return response.status;
    });
    assert.ok([401, 403].includes(denial), `Ordinary customer must not access Admin users (received ${denial}).`);

    await customer.page.goto(`https://${publicCustomerHost}/app/profile`, { waitUntil: "networkidle" });
    await customer.page.getByText("Tradify Journal", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
    await customer.page.getByText("Destination pending confirmation", { exact: true }).waitFor({ state: "visible" });
    for (const [width, height] of [[320, 800], [402, 874], [768, 1024], [1440, 900]]) {
      await customer.page.setViewportSize({ width, height });
      await customer.page.screenshot({
        path: path.join(screenshotsRoot, `customer-profile-products-${width}.png`),
        fullPage: true,
      });
      const dimensions = await customer.page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(dimensions.scroll <= dimensions.client + 2, `Profile horizontal overflow at ${width}px.`);
    }

    const fixtureTrade = {
      id: `browser-trade-${crypto.randomUUID()}`,
      symbol: "EURUSD",
      direction: "LONG",
      status: "CLOSED",
      entry: 1.08,
      stop: 1.075,
      target: 1.09,
      progress: 2,
      r: 2,
      createdAt: new Date(Date.now() - 86_400_000).toISOString(),
      closedAt: new Date().toISOString(),
    };
    await isolatedPool.query(
      "UPDATE tradify_users SET trades=$1::jsonb WHERE id=$2",
      [JSON.stringify([fixtureTrade]), customerUserId],
    );
    await customer.page.goto(`https://${publicCustomerHost}/app/settings`, { waitUntil: "networkidle" });
    await customer.page.screenshot({ path: path.join(screenshotsRoot, "customer-settings-402.png"), fullPage: true });
    await customer.page.goto(`https://${publicCustomerHost}/app/lab`, { waitUntil: "networkidle" });
    await customer.page.screenshot({ path: path.join(screenshotsRoot, "customer-strategies-markets-402.png"), fullPage: true });
    await customer.page.setViewportSize({ width: 1440, height: 900 });
    await customer.page.screenshot({ path: path.join(screenshotsRoot, "customer-strategies-markets-1440.png"), fullPage: true });
    await customer.page.goto(`https://${publicCustomerHost}/app/membership`, { waitUntil: "networkidle" });
    await customer.page.screenshot({ path: path.join(screenshotsRoot, "customer-membership-free-1440.png"), fullPage: true });

    for (const tier of ["Pro", "VIP", "Free"]) {
      await isolatedPool.query(
        "UPDATE tradify_users SET membership=$1, membership_source='ADMIN_OVERRIDE', subscription_status=NULL WHERE id=$2",
        [tier, customerUserId],
      );
      await customer.page.goto(`https://${publicCustomerHost}/app/profile`, { waitUntil: "networkidle" });
      await customer.page.getByText(`${tier.toUpperCase()} MEMBER`, { exact: true }).waitFor({ state: "visible" });
      if (tier !== "Free") {
        await customer.page.goto(`https://${publicCustomerHost}/app/membership`, { waitUntil: "networkidle" });
        await customer.page.screenshot({
          path: path.join(screenshotsRoot, `customer-membership-${tier.toLowerCase()}-1440.png`),
          fullPage: true,
        });
      }
    }
    console.log("Synthetic Free, Pro, and VIP membership states rendered without billing-provider activity.");

    await customer.page.goto(`https://${publicCustomerHost}/app/profile`, { waitUntil: "networkidle" });
    await customer.page.getByTestId("profile-logout").click();
    await customer.page.locator('[data-testid="profile-sign-in"], [data-testid="auth-email"]').first()
      .waitFor({ state: "visible", timeout: 15_000 });
    const loggedOutStatus = await customer.page.evaluate(async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      return response.status;
    });
    assert.equal(loggedOutStatus, 401, "The customer profile logout control must end the session.");
    await customer.page.goto(`https://${publicCustomerHost}/app/auth?mode=signin`, { waitUntil: "networkidle" });
    await customer.page.getByTestId("auth-email").fill(customerEmail);
    await customer.page.getByTestId("auth-password").fill(customerPassword);
    await customer.page.getByTestId("auth-submit").click();
    await customer.page.waitForFunction(async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      return response.status === 200;
    }, null, { timeout: 20_000 });
    console.log("Customer login and profile logout control passed.");

    const adminEmail = `browser-admin-${crypto.randomUUID()}@example.test`;
    const adminPassword = `test-${crypto.randomBytes(18).toString("hex")}`;
    const registerAdmin = await fetch(`http://127.0.0.1:${apiPort}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `https://${publicCustomerHost}` },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    assert.equal(registerAdmin.status, 201, "Synthetic staff seed account must register through the real API.");
    const adminRegistration = await registerAdmin.json();
    const adminUserId = adminRegistration?.user?.id;
    assert.equal(typeof adminUserId, "string");
    await isolatedPool.query("UPDATE tradify_users SET role='admin' WHERE id=$1", [adminUserId]);
    await isolatedPool.query(
      "INSERT INTO tradify_staff_access(user_id,role,active) VALUES ($1,'SUPER_ADMIN',true)",
      [adminUserId],
    );

    const admin = await newRoutedContext({ width: 1440, height: 900 });
    await admin.page.goto(`https://${publicAdminHost}/tradify-admin/login`, { waitUntil: "networkidle" });
    await admin.page.getByTestId("input-staff-email").fill(adminEmail);
    await admin.page.getByTestId("input-staff-password").fill(adminPassword);
    await admin.page.getByTestId("button-staff-signin").click();
    await admin.page.getByTestId("input-staff-email").waitFor({ state: "detached", timeout: 20_000 });
    await admin.page.waitForURL((url) => url.pathname === "/tradify-admin/" || url.pathname === "/tradify-admin", { timeout: 20_000 });
    await admin.page.screenshot({ path: path.join(screenshotsRoot, "admin-dashboard-1440.png"), fullPage: true });
    await admin.page.setViewportSize({ width: 402, height: 874 });
    await admin.page.screenshot({ path: path.join(screenshotsRoot, "admin-dashboard-402.png"), fullPage: true });
    await admin.page.setViewportSize({ width: 1440, height: 900 });
    for (const [label, fileName] of [["Customers", "customers"], ["Strategies", "strategies"], ["Signal diagnostics", "signals"]]) {
      const link = admin.page.getByRole("link", { name: label, exact: true }).first();
      await link.waitFor({ state: "visible", timeout: 10_000 });
      await link.click();
      await admin.page.waitForTimeout(700);
      await admin.page.screenshot({
        path: path.join(screenshotsRoot, `admin-${fileName}-1440.png`),
        fullPage: true,
      });
    }
    console.log("Synthetic Admin login and Customers, Strategies, and Signal diagnostics views passed.");

    await customer.page.goto(`https://${publicCustomerHost}/app/signal/e2e-missing-signal`, { waitUntil: "networkidle" });
    await customer.page.screenshot({ path: path.join(screenshotsRoot, "customer-signal-detail-state-1440.png"), fullPage: true });
    await customer.page.goto(`https://${publicCustomerHost}/app/profile`, { waitUntil: "networkidle" });
    await customer.page.getByTestId("profile-logout").click();
    await customer.page.locator('[data-testid="profile-sign-in"], [data-testid="auth-email"]').first()
      .waitFor({ state: "visible", timeout: 15_000 });
    const afterLogout = await customer.page.evaluate(async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      return response.status;
    });
    assert.equal(afterLogout, 401, "Logout must revoke the customer session.");
    console.log(JSON.stringify({
      result: "PASS",
      isolatedDatabase: dbName,
      customerRegistration: "PASS",
      customerProfileProductsViewports: [320, 402, 768, 1440],
      customerSettingsStrategiesMembership: "captured",
      customerTierStates: ["Free", "Pro", "VIP"],
      customerLoginAndProfileLogout: "PASS",
      ordinaryCustomerAdminDenial: denial,
      adminLogin: "PASS",
      customerLogout: "PASS",
      screenshotsDirectory: path.relative(root, screenshotsRoot),
      blockedExternalHosts: [...blockedExternalHosts],
      browserErrors: browserErrors.slice(0, 20),
      browser404s,
    }, null, 2));

  } finally {
    for (const context of contexts) {
      await context.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
      await context.close().catch(() => {});
    }
    if (browser) await browser.close().catch(() => {});
    await stopChild(adminChild);
    await stopChild(apiChild);
    if (staticServer?.listening) await new Promise((resolve) => staticServer.close(resolve));
    if (tempApiServer) fs.rmSync(tempApiServer, { force: true });
    if (isolatedPool) await isolatedPool.end().catch(() => {});
    if (databaseCreated) {
      await provisioner.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
        [dbName],
      );
      await provisioner.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      const remaining = await provisioner.query("SELECT 1 FROM pg_database WHERE datname=$1", [dbName]);
      assert.equal(remaining.rowCount, 0, "Disposable database cleanup must complete.");
      console.log(`Cleanup verified: ${dbName} was dropped through postgres maintenance DB.`);
    }
    await provisioner.end();
  }
}

main().catch((error) => {
  console.error(`Isolated browser harness failed closed: ${error.message}`);
  process.exitCode = 1;
});
