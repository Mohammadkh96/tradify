import pg from "pg";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";

const { Pool } = pg;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "../..");
const apiDir = path.join(workspaceRoot, "artifacts/api-server");
const apiEntry = path.join(apiDir, "dist/index.mjs");
const expectedDevelopmentDatabase = "heliumdb";
const virtualUsersByStage = [10, 15, 20];
const rampMs = 5_000;
const soakMs = 62_000;
const recurringEndpoints = [
  { path: "/market/quotes", intervalMs: 1_000 },
  { path: "/market/snapshot", intervalMs: 15_000 },
  { path: "/membership/status", intervalMs: 30_000 },
  { path: "/user/notifications", intervalMs: 30_000 },
];
const sessionReadEndpoints = [
  { path: "/watchlist", label: "GET /watchlist" },
  { path: "/user/alerts", label: "GET /user/alerts" },
  { path: "/user/trades", label: "GET /user/trades" },
  { path: "/markets/catalog", label: "GET /markets/catalog" },
];
const databaseSampleIntervalMs = 2_000;
const syntheticAccountCount = Math.max(...virtualUsersByStage);
const outputPath = path.join(workspaceRoot, "docs/customer-api-load-test-results.json");
const benchmarkScenarios = [
  {
    id: "all-pro",
    label: "All Pro",
    membershipForIndex: () => "Pro",
    accountMix: { Free: 0, Pro: syntheticAccountCount },
  },
  {
    id: "free-pro",
    label: "50/50 Free/Pro",
    membershipForIndex: (index) => index % 2 === 0 ? "Free" : "Pro",
    accountMix: {
      Free: Math.ceil(syntheticAccountCount / 2),
      Pro: Math.floor(syntheticAccountCount / 2),
    },
  },
];

function assertSafeTargetEnvironment() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run a load test when NODE_ENV=production.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create an isolated development test database.");
  }
  if (process.env.TRADIFY_LOAD_TEST_NON_PRODUCTION !== expectedDevelopmentDatabase) {
    throw new Error(
      `Set TRADIFY_LOAD_TEST_NON_PRODUCTION=${expectedDevelopmentDatabase} to acknowledge this development-only benchmark.`,
    );
  }
}

function safeDatabaseUrl(databaseName, applicationName) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${databaseName}`;
  url.searchParams.set("application_name", applicationName);
  return url.toString();
}

function sanitizeOutput(output, secrets) {
  let safe = output;
  for (const secret of secrets) {
    if (secret) safe = safe.split(secret).join("[redacted]");
  }
  return safe;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? workspaceRoot,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      const secrets = [
        process.env.DATABASE_URL,
        process.env.NEON_DATABASE_URL,
        options.env?.DATABASE_URL,
        options.env?.NEON_DATABASE_URL,
      ];
      const output = sanitizeOutput(`${stdout}${stderr}`, secrets).trim();
      if (code === 0) resolve(output);
      else reject(new Error(`${command} exited ${code ?? signal}: ${output.slice(-4000)}`));
    });
  });
}

async function getFreePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolve) => server.close(resolve));
    throw new Error("Could not allocate a local API port.");
  }
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startApi(testDatabaseUrl) {
  const port = await getFreePort();
  const childEnv = {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    PGDATABASE: testDatabaseUrl ? new URL(testDatabaseUrl).pathname.slice(1) : "",
    NODE_ENV: "development",
    PORT: String(port),
    LOG_LEVEL: "error",
    TWELVE_DATA_INGESTION_ENABLED: "false",
  };
  delete childEnv.NEON_DATABASE_URL;
  delete childEnv.NEON_DEVELOPMENT_DATABASE_URL;
  for (const key of [
    "AI_INTEGRATIONS_OPENAI_API_KEY",
    "AI_INTEGRATIONS_OPENAI_BASE_URL",
    "ALPHAVANTAGE_API_KEY",
    "EODHD_API_KEY",
    "MASSIVE_API_KEY",
    "MT5_BRIDGE_SECRET",
    "SESSION_SECRET",
    "TRADIFY_MARKET_DATA_UPSTREAM_URL",
    "TWELVE_DATA_API_KEY",
  ]) delete childEnv[key];
  childEnv.TRADIFY_PROFILE_MARKET_SNAPSHOT = "1";

  const child = spawn(process.execPath, [apiEntry], {
    cwd: apiDir,
    env: childEnv,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8000);
  });
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const startupDeadline = Date.now() + 30_000;
  while (Date.now() < startupDeadline) {
    if (child.exitCode !== null) {
      throw new Error(`Isolated API exited during startup: ${stderr.slice(-4000)}`);
    }
    try {
      const response = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return { child, baseUrl, stderr: () => stderr };
    } catch {
      // The API process is still starting.
    }
    await delay(200);
  }
  child.kill("SIGTERM");
  throw new Error(`Isolated API did not become ready within 30 seconds: ${stderr.slice(-4000)}`);
}

async function stopApi(api) {
  if (!api || api.child.exitCode !== null) return;
  api.child.kill("SIGTERM");
  const stopped = await Promise.race([
    once(api.child, "exit").then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (!stopped && api.child.exitCode === null) {
    api.child.kill("SIGKILL");
    await once(api.child, "exit");
  }
}

async function apiJson(baseUrl, endpoint, init) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function seedAccounts(api) {
  const accounts = [];
  const runId = `${Date.now().toString(36)}-${process.pid}`;
  for (let index = 0; index < syntheticAccountCount; index += 1) {
    const email = `load-${runId}-${index}@example.test`;
    const { response, body } = await apiJson(api.baseUrl, "/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: `load-test-${runId}-${index}` }),
    });
    if (response.status !== 201 || typeof body.token !== "string") {
      throw new Error(`Could not create synthetic test account ${index + 1} (HTTP ${response.status}, ${body.error ?? "unknown error"}).`);
    }
    accounts.push({
      token: body.token,
      userId: body.user?.id,
      notificationId: `load-${runId}-notification-${index}`,
    });
  }
  return accounts;
}

async function seedSyntheticCustomerState(pool, accounts, scenario) {
  const now = Date.now();
  for (const [index, account] of accounts.entries()) {
    if (typeof account.userId !== "string" || !account.userId) {
      throw new Error(`Registration did not return an ID for synthetic account ${index + 1}.`);
    }
    account.membership = scenario.membershipForIndex(index);
    account.alertId = `${account.notificationId}-alert`;
    const alert = [{
      id: account.alertId,
      symbol: "XAUUSD",
      target: 2_500 + index,
      condition: "ABOVE",
      label: "Seeded benchmark alert",
      active: true,
      createdAt: new Date(now - index).toISOString(),
    }];
    const notification = [{
      id: account.notificationId,
      timestamp: now - index,
      symbol: "XAUUSD",
      type: "NEW_SETUP",
      title: "Benchmark notification",
      message: "Synthetic notification used by the customer API load benchmark.",
      isRead: false,
    }];
    const updated = await pool.query(`
      UPDATE tradify_users
      SET membership = $2,
          membership_source = CASE WHEN $2 = 'Pro' THEN 'ADMIN_OVERRIDE' ELSE 'UNKNOWN' END,
          subscription_status = CASE WHEN $2 = 'Pro' THEN 'ACTIVE' ELSE 'INACTIVE' END,
          override_ends_at = CASE WHEN $2 = 'Pro' THEN $3 ELSE NULL END,
          notifications = $4::jsonb,
          alerts = $5::jsonb,
          watchlist = '[]'::jsonb,
          alert_symbols = '[]'::jsonb,
          trades = '[]'::jsonb,
          version = version + 1
      WHERE id = $1
    `, [
      account.userId,
      account.membership,
      new Date(now + 24 * 60 * 60 * 1_000).toISOString(),
      JSON.stringify(notification),
      JSON.stringify(alert),
    ]);
    if (updated.rowCount !== 1) {
      throw new Error(`Could not seed synthetic customer account ${index + 1}.`);
    }
  }
}

async function databasePressure(pool) {
  const [databaseResult, activityResult] = await Promise.all([
    pool.query(`
      SELECT numbackends, xact_commit, xact_rollback, blks_hit, blks_read,
             temp_files, temp_bytes, deadlocks
      FROM pg_stat_database
      WHERE datname = current_database()
    `),
    pool.query(`
     SELECT count(*)::integer AS api_connections,
             count(*) FILTER (WHERE state = 'active')::integer AS api_active,
             count(*) FILTER (
               WHERE state = 'active' AND wait_event_type IS NOT NULL
             )::integer AS api_waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND application_name = 'tradify-customer-api-load'
    `),
  ]);
  const database = databaseResult.rows[0];
  const activity = activityResult.rows[0];
  if (!database || !activity) throw new Error("Could not read PostgreSQL load-test statistics.");
  return {
    totalConnections: Number(database.numbackends),
    apiConnections: Number(activity.api_connections),
    apiActive: Number(activity.api_active),
    apiConnectionsWithWaitEvent: Number(activity.api_waiting),
    committedTransactions: Number(database.xact_commit),
    rolledBackTransactions: Number(database.xact_rollback),
    sharedBufferHits: Number(database.blks_hit),
    diskBlocksRead: Number(database.blks_read),
    tempFiles: Number(database.temp_files),
    tempBytes: Number(database.temp_bytes),
    deadlocks: Number(database.deadlocks),
  };
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)].toFixed(1));
}

function latencySummary(values) {
  return {
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    max: values.length ? Number(Math.max(...values).toFixed(1)) : null,
  };
}

function summarizeEndpoints(endpoints) {
  return Object.fromEntries(Object.entries(endpoints).map(([label, endpoint]) => {
    const { latenciesMs, ...counts } = endpoint;
    return [label, { ...counts, latencyMs: latencySummary(latenciesMs) }];
  }));
}

function pressureDelta(before, after) {
  return {
    committedTransactions: after.committedTransactions - before.committedTransactions,
    rolledBackTransactions: after.rolledBackTransactions - before.rolledBackTransactions,
    sharedBufferHits: after.sharedBufferHits - before.sharedBufferHits,
    diskBlocksRead: after.diskBlocksRead - before.diskBlocksRead,
    tempFiles: after.tempFiles - before.tempFiles,
    tempBytes: after.tempBytes - before.tempBytes,
    deadlocks: after.deadlocks - before.deadlocks,
  };
}

async function requestApi({
  baseUrl,
  token,
  membership = "unknown",
  path: endpoint,
  label = endpoint,
  method = "GET",
  body,
  counters,
  expectedTierRestrictionError,
  validateResponse,
}) {
  const tierCounters = counters.byMembership[membership] ??= {
    statuses: {},
    latenciesMs: [],
    endpoints: {},
  };
  const getEndpointCounters = (target) => target.endpoints[label] ??= {
    requests: 0,
    successes: 0,
    expectedTierRestrictions: 0,
    throttled: 0,
    failures: 0,
    networkFailures: 0,
    validationFailures: 0,
    latenciesMs: [],
  };
  const targets = [
    { summary: counters, endpoint: getEndpointCounters(counters) },
    { summary: tierCounters, endpoint: getEndpointCounters(tierCounters) },
  ];
  const requestStartedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    });
    const responseBody = await response.json().catch(() => undefined);
    const serverTiming = response.headers.get("server-timing");
    if (serverTiming) {
      for (const metric of serverTiming.split(",")) {
        const [name, ...parameters] = metric.trim().split(";");
        const duration = parameters.find((parameter) => parameter.trim().startsWith("dur="));
        const milliseconds = duration ? Number(duration.trim().slice(4)) : NaN;
        if (name && Number.isFinite(milliseconds) && milliseconds >= 0) {
          (counters.serverTimingMs[name] ??= []).push(milliseconds);
        }
      }
    }
    const elapsedMs = performance.now() - requestStartedAt;
    let responseIsValid = true;
    if (response.status >= 200 && response.status < 300 && validateResponse) {
      try {
        responseIsValid = validateResponse(response.status, responseBody) === true;
      } catch {
        responseIsValid = false;
      }
    }
    for (const target of targets) {
      target.summary.latenciesMs.push(elapsedMs);
      target.endpoint.latenciesMs.push(elapsedMs);
      target.summary.statuses[String(response.status)] = (target.summary.statuses[String(response.status)] ?? 0) + 1;
      target.endpoint.requests += 1;
      if (response.status === 429) target.endpoint.throttled += 1;
      else if (
        expectedTierRestrictionError
        && response.status === 403
        && responseBody?.error === expectedTierRestrictionError
      ) target.endpoint.expectedTierRestrictions += 1;
      else if (response.status >= 200 && response.status < 300 && responseIsValid) {
        target.endpoint.successes += 1;
      } else {
        target.endpoint.failures += 1;
        if (response.status >= 200 && response.status < 300 && !responseIsValid) {
          target.endpoint.validationFailures += 1;
        }
      }
    }
    return { status: response.status, body: responseBody };
  } catch {
    const elapsedMs = performance.now() - requestStartedAt;
    for (const target of targets) {
      target.endpoint.requests += 1;
      target.endpoint.networkFailures += 1;
      target.summary.latenciesMs.push(elapsedMs);
      target.endpoint.latenciesMs.push(elapsedMs);
    }
    return { status: null, body: undefined };
  }
}

async function runPeriodicEndpoint({
  baseUrl,
  token,
  membership,
  accountNotificationId,
  endpoint,
  intervalMs,
  stopAt,
  counters,
}) {
  while (performance.now() < stopAt) {
    const requestStartedAt = performance.now();
    await requestApi({
      baseUrl,
      token,
      membership,
      path: endpoint,
      counters,
      validateResponse: endpoint === "/market/quotes" && membership === "Free"
        ? (_status, responseBody) => responseBody?.quotes
          && !Object.hasOwn(responseBody.quotes, "EURUSD")
        : endpoint === "/market/snapshot"
          ? (_status, responseBody) => responseBody?.quotes
            && Array.isArray(responseBody.signals)
            && (membership !== "Free" || !Object.hasOwn(responseBody.quotes, "EURUSD"))
          : endpoint === "/user/notifications"
            ? (_status, responseBody) => Array.isArray(responseBody)
              && (membership === "Free"
                ? responseBody.length === 0
                : responseBody.some((notification) => notification?.id === accountNotificationId))
            : undefined,
    });
    const remaining = stopAt - performance.now();
    if (remaining <= 0) break;
    await delay(Math.min(remaining, Math.max(0, intervalMs - (performance.now() - requestStartedAt))));
  }
}

async function runCustomerReadJourney({ baseUrl, account, counters }) {
  const { token, membership } = account;
  await Promise.all(sessionReadEndpoints.map((endpoint) => requestApi({
    baseUrl,
    token,
    membership,
    path: endpoint.path,
    label: endpoint.label,
    counters,
    validateResponse: endpoint.label === "GET /user/alerts"
      ? (_status, responseBody) => Array.isArray(responseBody)
        && (membership === "Free"
          ? responseBody.length === 0
          : responseBody.some((alert) => alert?.id === account.alertId))
      : endpoint.label === "GET /markets/catalog"
        ? (_status, responseBody) => Array.isArray(responseBody)
          && responseBody.some((market) => market?.symbol === "USOIL"
            && market.requiredTier === "Free" && market.accessible === true)
          && responseBody.some((market) => market?.symbol === "EURUSD"
            && market.requiredTier === "Pro"
            && market.accessible === (membership !== "Free"))
        : undefined,
  })));
}

async function runCustomerWriteJourney({ baseUrl, account, index, counters }) {
  const { token, membership } = account;
  const accessibleMarket = membership === "Free" ? "USOIL" : "EURUSD";
  const restrictedMarket = membership === "Free" ? "EURUSD" : "AMD";
  const watchlistAdd = await requestApi({
    baseUrl,
    token,
    membership,
    path: "/watchlist",
    label: "POST /watchlist",
    method: "POST",
    body: { symbol: accessibleMarket },
    counters,
    validateResponse: (_status, responseBody) => responseBody?.ok === true
      && responseBody.watchlist?.includes(accessibleMarket),
  });
  if (watchlistAdd.status >= 200 && watchlistAdd.status < 300) {
    await requestApi({
      baseUrl,
      token,
      membership,
      path: `/watchlist/${accessibleMarket}`,
      label: "DELETE /watchlist/:symbol",
      method: "DELETE",
      counters,
      validateResponse: (_status, responseBody) => responseBody?.ok === true
        && !responseBody.watchlist?.includes(accessibleMarket),
    });
  }
  await requestApi({
    baseUrl,
    token,
    membership,
    path: "/watchlist",
    label: "POST /watchlist (restricted market)",
    method: "POST",
    body: { symbol: restrictedMarket },
    counters,
    expectedTierRestrictionError: "MARKET_TIER_REQUIRED",
  });

  const alertCreate = await requestApi({
    baseUrl,
    token,
    membership,
    path: "/user/alerts",
    label: "POST /user/alerts",
    method: "POST",
    body: {
      symbol: "XAUUSD",
      target: 2_500 + index,
      condition: "ABOVE",
      label: "Benchmark price alert",
    },
    counters,
    expectedTierRestrictionError: membership === "Free" ? "FEATURE_TIER_REQUIRED" : undefined,
  });
  const alertId = alertCreate.body?.alert?.id;
  if (membership !== "Free" && alertCreate.status >= 200 && alertCreate.status < 300 && typeof alertId === "string") {
    await requestApi({
      baseUrl,
      token,
      membership,
      path: `/user/alerts/${encodeURIComponent(alertId)}`,
      label: "DELETE /user/alerts/:id",
      method: "DELETE",
      counters,
    });
  }

  const tradeCreate = await requestApi({
    baseUrl,
    token,
    membership,
    path: "/user/trades",
    label: "POST /user/trades",
    method: "POST",
    body: {
      symbol: membership === "Free" ? "USOIL" : "XAUUSD",
      direction: "LONG",
      entry: 2_300 + index,
      stop: 2_290 + index,
      target: 2_320 + index,
    },
    counters,
  });
  const tradeId = tradeCreate.body?.trade?.id;
  if (tradeCreate.status >= 200 && tradeCreate.status < 300 && typeof tradeId === "string") {
    await requestApi({
      baseUrl,
      token,
      membership,
      path: `/user/trades/${encodeURIComponent(tradeId)}/actions`,
      label: "POST /user/trades/:id/actions",
      method: "POST",
      body: { action: "CLOSE" },
      counters,
    });
  }

  await requestApi({
    baseUrl,
    token,
    membership,
    path: `/user/notifications/${encodeURIComponent(account.notificationId)}/read`,
    label: "PATCH /user/notifications/:id/read",
    method: "PATCH",
    counters,
    expectedTierRestrictionError: membership === "Free" ? "FEATURE_TIER_REQUIRED" : undefined,
  });
}

async function runVirtualUser({ baseUrl, account, index, users, accounts, stopAt, counters }) {
  const { token, membership } = account;
  const userStartsAt = performance.now() + index * rampMs / users;
  await delay(Math.max(0, userStartsAt - performance.now()));

  // The app restores the saved profile once per session; it does not poll it.
  await requestApi({ baseUrl, token, membership, path: "/auth/me", counters });
  await runCustomerReadJourney({ baseUrl, account, counters });
  await runCustomerWriteJourney({ baseUrl, account: accounts[index], index, counters });
  await Promise.all(recurringEndpoints.map((endpoint) => runPeriodicEndpoint({
    baseUrl,
    token,
    membership,
    accountNotificationId: account.notificationId,
    endpoint: endpoint.path,
    intervalMs: endpoint.intervalMs,
    stopAt,
    counters,
  })));
}

function summarizeMembershipCounters(byMembership, accounts, users) {
  return Object.fromEntries(Object.entries(byMembership).map(([membership, counters]) => {
    const endpoints = Object.values(counters.endpoints);
    const measuredRequests = endpoints.reduce((total, endpoint) => total + endpoint.requests, 0);
    const successfulResponses = endpoints.reduce((total, endpoint) => total + endpoint.successes, 0);
    const expectedTierRestrictions = endpoints.reduce((total, endpoint) => total + endpoint.expectedTierRestrictions, 0);
    const failures = endpoints.reduce((total, endpoint) => total + endpoint.failures, 0);
    const networkFailures = endpoints.reduce((total, endpoint) => total + endpoint.networkFailures, 0);
    const throttledResponses = endpoints.reduce((total, endpoint) => total + endpoint.throttled, 0);
    return [membership, {
      virtualUsers: accounts.slice(0, users).filter((account) => account.membership === membership).length,
      measuredRequests,
      successfulResponses,
      expectedTierRestrictions,
      failures: failures + networkFailures,
      nonThrottleHttpFailures: failures,
      networkFailures,
      throttledResponses,
      statusCounts: counters.statuses,
      endpointCounts: summarizeEndpoints(counters.endpoints),
      latencyMs: latencySummary(counters.latenciesMs),
    }];
  }));
}

async function runStage({ users, accounts, testDatabasePool, testDatabaseUrl }) {
  let api;
  try {
    api = await startApi(testDatabaseUrl);
    const before = await databasePressure(testDatabasePool);
    const maxima = {
      totalConnections: before.totalConnections,
      apiConnections: before.apiConnections,
      apiActive: before.apiActive,
      apiConnectionsWithWaitEvent: before.apiConnectionsWithWaitEvent,
    };
    let sampleInProgress = false;
    const sample = async () => {
      if (sampleInProgress) return;
      sampleInProgress = true;
      try {
        const pressure = await databasePressure(testDatabasePool);
        for (const key of Object.keys(maxima)) maxima[key] = Math.max(maxima[key], pressure[key]);
      } finally {
        sampleInProgress = false;
      }
    };
    const monitor = setInterval(() => { void sample(); }, databaseSampleIntervalMs);
    const counters = {
      statuses: {},
      latenciesMs: [],
      endpoints: {},
      serverTimingMs: {},
      byMembership: {},
    };
    const stopAt = performance.now() + rampMs + soakMs;
    const startedAt = new Date().toISOString();
    await Promise.all(Array.from({ length: users }, (_, index) => runVirtualUser({
      baseUrl: api.baseUrl,
      account: accounts[index],
      index,
      users,
      accounts,
      stopAt,
      counters,
    })));
    clearInterval(monitor);
    await sample();
    const after = await databasePressure(testDatabasePool);
    const endpointCounts = Object.values(counters.endpoints);
    const requestCount = endpointCounts.reduce((total, endpoint) => total + endpoint.requests, 0);
    const successes = endpointCounts.reduce((total, endpoint) => total + endpoint.successes, 0);
    const throttled = endpointCounts.reduce((total, endpoint) => total + endpoint.throttled, 0);
    const failures = endpointCounts.reduce((total, endpoint) => total + endpoint.failures, 0);
    const networkFailures = endpointCounts.reduce((total, endpoint) => total + endpoint.networkFailures, 0);
    const expectedTierRestrictions = endpointCounts.reduce((total, endpoint) => total + endpoint.expectedTierRestrictions, 0);
    const membershipCounts = accounts.slice(0, users).reduce((counts, account) => {
      counts[account.membership] = (counts[account.membership] ?? 0) + 1;
      return counts;
    }, {});
    const completedAt = new Date().toISOString();
    const elapsedSeconds = (Date.parse(completedAt) - Date.parse(startedAt)) / 1_000;
    return {
      virtualUsers: users,
      membershipCounts,
      recurringQuotePollsPerUserPerSecond: 1,
      snapshotIntervalSeconds: 15,
      rampSeconds: rampMs / 1_000,
      soakSeconds: soakMs / 1_000,
      startedAt,
      completedAt,
      elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
      measuredRequests: requestCount,
      requestsPerMinute: Number((requestCount / elapsedSeconds * 60).toFixed(1)),
      successfulResponses: successes,
      expectedTierRestrictions,
      failures: failures + networkFailures,
      nonThrottleHttpFailures: failures,
      networkFailures,
      throttledResponses: throttled,
      statusCounts: counters.statuses,
      endpointCounts: summarizeEndpoints(counters.endpoints),
      membershipMetrics: summarizeMembershipCounters(counters.byMembership, accounts, users),
      snapshotProfileMs: Object.fromEntries(Object.entries(counters.serverTimingMs)
        .map(([name, values]) => [name, latencySummary(values)])),
      latencyMs: latencySummary(counters.latenciesMs),
      databasePressure: {
        peakTotalConnections: maxima.totalConnections,
        peakApiConnections: maxima.apiConnections,
        peakApiActiveConnections: maxima.apiActive,
        peakApiConnectionsWithWaitEvent: maxima.apiConnectionsWithWaitEvent,
        counterDeltas: pressureDelta(before, after),
      },
    };
  } finally {
    await stopApi(api);
  }
}

async function main() {
  assertSafeTargetEnvironment();
  const adminPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    application_name: "tradify-customer-api-load-provisioner",
  });
  let testDatabaseName;
  let testDatabasePool;

  try {
    const identity = await adminPool.query(`
      SELECT current_database() AS database_name,
             pg_is_in_recovery() AS is_replica,
             current_setting('server_version') AS postgres_version
    `);
    const databaseIdentity = identity.rows[0];
    if (
      databaseIdentity?.database_name !== expectedDevelopmentDatabase
      || databaseIdentity.is_replica
    ) {
      throw new Error(
        `Refusing to run outside the verified development database (${expectedDevelopmentDatabase}).`,
      );
    }
    if (process.env.PGDATABASE && process.env.PGDATABASE !== expectedDevelopmentDatabase) {
      throw new Error("PGDATABASE does not match the verified development database.");
    }

    testDatabaseName = `tradify_loadtest_${process.pid}_${Date.now().toString(36)}`;
    if (!/^[a-z][a-z0-9_]{0,62}$/u.test(testDatabaseName)) {
      throw new Error("Generated an invalid isolated database name.");
    }
    await adminPool.query(`CREATE DATABASE "${testDatabaseName}"`);
    const testDatabaseUrl = safeDatabaseUrl(testDatabaseName, "tradify-customer-api-load");
    const migrationEnv = {
      ...process.env,
      DATABASE_URL: safeDatabaseUrl(testDatabaseName, "tradify-customer-api-load-schema"),
      PGDATABASE: testDatabaseName,
      NODE_ENV: "development",
    };
    delete migrationEnv.NEON_DATABASE_URL;

    await runCommand("pnpm", ["--filter", "@workspace/api-server", "run", "build"]);
    await runCommand("pnpm", ["--filter", "@workspace/db", "run", "push"], {
      cwd: workspaceRoot,
      env: migrationEnv,
    });
    testDatabasePool = new Pool({
      connectionString: safeDatabaseUrl(testDatabaseName, "tradify-customer-api-load-monitor"),
      max: 2,
    });
    await testDatabasePool.query("SELECT 1");

    let seedApi;
    let accounts;
    try {
      seedApi = await startApi(testDatabaseUrl);
      accounts = await seedAccounts(seedApi);
    } finally {
      await stopApi(seedApi);
    }
    const scenarios = [];
    for (const scenario of benchmarkScenarios) {
      const stages = [];
      for (const users of virtualUsersByStage) {
        await seedSyntheticCustomerState(testDatabasePool, accounts, scenario);
        stages.push(await runStage({ users, accounts, testDatabasePool, testDatabaseUrl }));
      }
      scenarios.push({
        id: scenario.id,
        label: scenario.label,
        seededAccountMix: scenario.accountMix,
        stages,
      });
    }

    const output = {
      benchmark: "Tradify shared-IP representative customer read/write workload",
      target: "Isolated, disposable PostgreSQL database on the verified development database server; local API process only.",
      productionTrafficUsed: false,
      clientIpModel: "All virtual users shared one local source IP; no forwarding header was supplied.",
      generatedAt: new Date().toISOString(),
      developmentDatabase: databaseIdentity.database_name,
      postgresVersion: databaseIdentity.postgres_version,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      logicalCpuModel: os.cpus()[0]?.model ?? "unknown",
      totalMemoryBytes: os.totalmem(),
      syntheticAccounts: syntheticAccountCount,
      profileRefresh: "One authenticated GET /api/auth/me during session restore; the customer app does not poll profile data on a timer.",
      includedFlows: [
        "Session restore with GET /api/auth/me.",
        "One session-start read each for GET /api/watchlist, GET /api/user/alerts, GET /api/user/trades, and GET /api/markets/catalog; the catalog response is checked for tier-accessible and restricted markets.",
        "Recurring GET /api/market/quotes every second and GET /api/market/snapshot every 15 seconds; Free responses are checked not to include the Pro-only EURUSD market.",
        "Recurring GET /api/membership/status and GET /api/user/notifications every 30 seconds; Free notification reads are checked to remain empty while Pro sees its seeded notification.",
        "One synthetic customer-action journey per user per stage: add/remove an accessible watchlist market, attempt a restricted market, create/delete a Pro price alert or record the expected Free restriction, create/close an accessible-market trade, and mark a Pro notification read or record the expected Free restriction.",
      ],
      scenarios: benchmarkScenarios.map(({ id, label, accountMix }) => ({
        id,
        label,
        accountMix,
      })),
      syntheticAccountProfile: "The retained all-Pro scenario seeds all 20 temporary accounts as Pro. The mixed scenario alternates Free and Pro accounts for a 10/10 split (and stays within one account of even at the 10- and 15-user stages). Every account starts each stage with one seeded alert and one unread notification; only rows in the isolated test database are modified.",
      expectedTierRestrictions: "Free alert creation and notification-read writes return FEATURE_TIER_REQUIRED; restricted watchlist additions return MARKET_TIER_REQUIRED (Free to Pro markets, Pro to VIP-only AMD). These expected 403 responses are counted separately from failures. Response checks also confirm tier-filtered reads.",
      loadModel: `Each scenario tests ${virtualUsersByStage.join(", ")} virtual users, ramped over ${rampMs / 1_000} seconds with a ${soakMs / 1_000}-second soak. Accounts are reseeded before every stage so each cohort starts with the same unread notification, alert, watchlist, and trade state. Each user performs session reads and one bounded action journey per stage; recurring reads follow the customer app's polling cadence.`,
      outboundProviderTraffic: "The isolated API process has market-provider credentials and the development-upstream URL removed. Snapshot and catalog calls use local runtime state and do not contact external market providers.",
      databaseSampling: `Every ${databaseSampleIntervalMs / 1_000} seconds, sampling pg_stat_database and API-owned pg_stat_activity connections, active queries, and wait-event activity.`,
      apiRequestsPerIpLimitPerMinute: 1800,
      supportedConcurrency: {
        range: `${Math.min(...virtualUsersByStage)}–${Math.max(...virtualUsersByStage)} simulated concurrent customer sessions at the measured polling cadence and one bounded customer-action journey per stage, under these local single-process test conditions.`,
        rationale: "The full listed workload must complete with zero unexpected HTTP/network failures and zero 429 responses at every measured stage; expected tier restrictions are reported separately and validated against the expected response. This is not a production capacity guarantee.",
      },
      scenarioResults: scenarios,
    };

    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Benchmark completed against a disposable development database. Production traffic was not used.`);
    console.log(`Results: ${path.relative(workspaceRoot, outputPath)}`);
    console.log("Scenario | Concurrency (Free/Pro) | Requests | p50 ms | p95 ms | p99 ms | Failures | Expected tier restrictions | 429s | Peak DB | Peak API / active / wait");
    for (const scenario of scenarios) {
      for (const stage of scenario.stages) {
        console.log([
          scenario.id,
          `${stage.virtualUsers} (${stage.membershipCounts.Free ?? 0}/${stage.membershipCounts.Pro ?? 0})`,
          stage.measuredRequests,
          stage.latencyMs.p50 ?? "n/a",
          stage.latencyMs.p95 ?? "n/a",
          stage.latencyMs.p99 ?? "n/a",
          stage.failures,
          stage.expectedTierRestrictions,
          stage.throttledResponses,
          stage.databasePressure.peakTotalConnections,
          `${stage.databasePressure.peakApiConnections} / ${stage.databasePressure.peakApiActiveConnections} / ${stage.databasePressure.peakApiConnectionsWithWaitEvent}`,
        ].join(" | "));
      }
    }
  } finally {
    await testDatabasePool?.end();
    if (testDatabaseName) {
      await adminPool.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [testDatabaseName],
      );
      await adminPool.query(`DROP DATABASE IF EXISTS "${testDatabaseName}"`);
    }
    await adminPool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Customer API load test failed.");
  process.exitCode = 1;
});
