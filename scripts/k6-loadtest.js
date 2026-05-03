/**
 * TRADIFY production load test for k6 (https://k6.io)
 *
 * Simulates a realistic trader journey at scale.
 *
 * Local dry-run (small):
 *   k6 run --vus 50 --duration 30s scripts/k6-loadtest.js
 *
 * Production load (10k VUs, distributed — paid k6 Cloud):
 *   k6 cloud --vus 10000 --duration 10m scripts/k6-loadtest.js
 *
 * Override target:
 *   BASE_URL=https://your-app.replit.app k6 run scripts/k6-loadtest.js
 *
 * IMPORTANT:
 *   - Run this against your DEPLOYED production URL, never the dev sandbox.
 *   - Provision dedicated load-test users; do NOT hammer real customer accounts.
 *   - Coordinate with Neon to ensure your branch has enough compute units.
 *   - Watch your OpenAI / SendGrid / Stripe spend during the run.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE_URL = __ENV.BASE_URL || "https://tradifyapp.com";
const TEST_EMAIL = __ENV.TEST_EMAIL || "qa-tester@tradify-test.com";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "Test1234!";

// Custom metrics
const loginLatency = new Trend("login_latency_ms");
const dashboardLatency = new Trend("dashboard_latency_ms");
const tradesLatency = new Trend("trades_latency_ms");
const coachesLatency = new Trend("coaches_latency_ms");
const errorRate = new Rate("errors");
const authFailures = new Counter("auth_failures");

export const options = {
  // Ramp pattern: warm → ramp to target → sustain → cool down.
  // Override with --vus / --duration flags.
  scenarios: {
    realistic_traders: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 500 },     // warm
        { duration: "2m", target: 2000 },    // ramp
        { duration: "5m", target: 10000 },   // peak
        { duration: "5m", target: 10000 },   // sustain at peak
        { duration: "2m", target: 0 },       // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // SLOs — fail the test if any breach
    "http_req_duration{status:200}": ["p(95)<800", "p(99)<2000"],
    "http_req_failed": ["rate<0.01"],         // <1% errors
    "errors": ["rate<0.01"],
    "login_latency_ms": ["p(95)<1500"],
    "dashboard_latency_ms": ["p(95)<1000"],
  },
  // Cap connections per VU to mimic browsers
  noConnectionReuse: false,
  userAgent: "k6-loadtest/tradify",
};

function fail(label, res) {
  errorRate.add(1);
  console.error(`[${label}] HTTP ${res.status} body=${res.body && res.body.toString().slice(0, 200)}`);
}

export default function () {
  const jar = http.cookieJar();

  // --- 1. Login ---
  let res;
  group("login", () => {
    const t0 = Date.now();
    res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      { headers: { "Content-Type": "application/json" }, jar },
    );
    loginLatency.add(Date.now() - t0);
    const ok = check(res, {
      "login 200": (r) => r.status === 200,
      "login has user": (r) => r.json("id") !== undefined || r.json("email") !== undefined,
    });
    if (!ok) {
      authFailures.add(1);
      fail("login", res);
      return;
    }
  });
  if (res.status !== 200) return;

  sleep(randomIntBetween(1, 3));

  // --- 2. Dashboard data ---
  group("dashboard", () => {
    const t0 = Date.now();
    const r = http.get(`${BASE_URL}/api/user`, { jar });
    dashboardLatency.add(Date.now() - t0);
    if (!check(r, { "user 200": (x) => x.status === 200 })) fail("user", r);
  });

  // --- 3. Trade journal fetch ---
  group("trades", () => {
    const t0 = Date.now();
    const r = http.get(`${BASE_URL}/api/trades`, { jar });
    tradesLatency.add(Date.now() - t0);
    if (!check(r, { "trades 200": (x) => x.status === 200 })) fail("trades", r);
  });

  sleep(randomIntBetween(2, 5));

  // --- 4. Coaches directory ---
  group("coaches", () => {
    const t0 = Date.now();
    const r = http.get(`${BASE_URL}/api/coaches/directory`, { jar });
    coachesLatency.add(Date.now() - t0);
    if (!check(r, { "coaches 200/304": (x) => x.status === 200 || x.status === 304 })) fail("coaches", r);
  });

  // --- 5. Heatmap / analytics (read-heavy) ---
  group("analytics", () => {
    const r = http.get(`${BASE_URL}/api/analytics/heatmap`, { jar });
    check(r, { "heatmap 200/404": (x) => x.status === 200 || x.status === 404 });
  });

  // --- 6. Occasional write — submit a trade (10% of VUs only) ---
  if (Math.random() < 0.1) {
    group("write_trade", () => {
      const r = http.post(
        `${BASE_URL}/api/trades`,
        JSON.stringify({
          symbol: "EURUSD",
          side: "BUY",
          entryPrice: 1.085 + Math.random() * 0.001,
          exitPrice: 1.086 + Math.random() * 0.001,
          quantity: 1,
          notes: "k6 load-test trade",
        }),
        { headers: { "Content-Type": "application/json" }, jar },
      );
      check(r, { "trade write 200/201": (x) => x.status === 200 || x.status === 201 });
    });
  }

  sleep(randomIntBetween(3, 8)); // think time
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        rps: data.metrics.http_reqs?.values?.rate,
        p95_ms: data.metrics.http_req_duration?.values?.["p(95)"],
        p99_ms: data.metrics.http_req_duration?.values?.["p(99)"],
        error_rate: data.metrics.http_req_failed?.values?.rate,
        login_p95: data.metrics.login_latency_ms?.values?.["p(95)"],
        dashboard_p95: data.metrics.dashboard_latency_ms?.values?.["p(95)"],
        trades_p95: data.metrics.trades_latency_ms?.values?.["p(95)"],
        coaches_p95: data.metrics.coaches_latency_ms?.values?.["p(95)"],
        thresholds_breached: Object.entries(data.metrics).filter(
          ([_, m]) => m.thresholds && Object.values(m.thresholds).some((t) => t.ok === false),
        ).map(([k]) => k),
      },
      null,
      2,
    ),
  };
}
