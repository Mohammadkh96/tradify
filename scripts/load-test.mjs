#!/usr/bin/env node
/**
 * In-sandbox smoke load test using only Node built-ins.
 * NOT a substitute for a real distributed load test — see scripts/k6-loadtest.js.
 *
 * Usage:
 *   node scripts/load-test.mjs [--url=http://localhost:5000] [--vus=100] [--duration=20] [--scenario=mixed]
 *
 * Scenarios:
 *   - landing : GET /
 *   - api     : GET /api/health, /api/coaches/directory (unauth)
 *   - login   : POST /api/auth/login (qa-tester credentials)
 *   - mixed   : weighted blend of all three
 */
import { performance } from "node:perf_hooks";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const URL = args.url || "http://localhost:5000";
const VUS = Number(args.vus || 100);
const DURATION_S = Number(args.duration || 20);
const SCENARIO = args.scenario || "mixed";

const CREDS = {
  email: "qa-tester@tradify-test.com",
  password: "Test1234!",
};

const ENDPOINTS = {
  landing: [{ method: "GET", path: "/", weight: 1 }],
  api: [
    { method: "GET", path: "/api/health", weight: 1 },
    { method: "GET", path: "/api/coaches/directory", weight: 1 },
  ],
  login: [
    {
      method: "POST",
      path: "/api/auth/login",
      weight: 1,
      body: JSON.stringify(CREDS),
      headers: { "content-type": "application/json" },
    },
  ],
  mixed: [
    { method: "GET", path: "/", weight: 4 },
    { method: "GET", path: "/api/health", weight: 5 },
    { method: "GET", path: "/api/coaches/directory", weight: 3 },
    {
      method: "POST",
      path: "/api/auth/login",
      weight: 1,
      body: JSON.stringify(CREDS),
      headers: { "content-type": "application/json" },
    },
  ],
};

const reqs = ENDPOINTS[SCENARIO] || ENDPOINTS.mixed;
const totalWeight = reqs.reduce((s, r) => s + r.weight, 0);
function pick() {
  let r = Math.random() * totalWeight;
  for (const e of reqs) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return reqs[0];
}

const stats = {
  total: 0,
  ok: 0,
  fail: 0,
  byStatus: {},
  byPath: {},
  latencies: [],
  errors: [],
  startMem: process.memoryUsage().rss,
};

let stop = false;
async function vu() {
  while (!stop) {
    const ep = pick();
    const t0 = performance.now();
    try {
      const res = await fetch(URL + ep.path, {
        method: ep.method,
        headers: ep.headers,
        body: ep.body,
      });
      // Drain body so the server can release the socket
      await res.arrayBuffer();
      const dt = performance.now() - t0;
      stats.latencies.push(dt);
      stats.total++;
      stats.byStatus[res.status] = (stats.byStatus[res.status] || 0) + 1;
      const key = `${ep.method} ${ep.path}`;
      stats.byPath[key] ??= { n: 0, lat: [] };
      stats.byPath[key].n++;
      stats.byPath[key].lat.push(dt);
      if (res.status >= 200 && res.status < 400) stats.ok++;
      else stats.fail++;
    } catch (e) {
      stats.fail++;
      stats.total++;
      const m = (e && e.message) || String(e);
      stats.errors.push(m);
    }
  }
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

console.log(
  `[load-test] target=${URL} vus=${VUS} duration=${DURATION_S}s scenario=${SCENARIO}`,
);
const startMs = Date.now();
const workers = Array.from({ length: VUS }, () => vu());
setTimeout(() => {
  stop = true;
}, DURATION_S * 1000);
await Promise.all(workers);

const elapsed = (Date.now() - startMs) / 1000;
const rps = (stats.total / elapsed).toFixed(1);
const endMem = process.memoryUsage().rss;

console.log("\n=== RESULTS ===");
console.log(`Duration:    ${elapsed.toFixed(1)}s`);
console.log(
  `Total reqs:  ${stats.total}  (${rps} req/s @ ${VUS} VUs)`,
);
console.log(
  `Success:     ${stats.ok} (${((stats.ok / stats.total) * 100).toFixed(2)}%)`,
);
console.log(
  `Fail:        ${stats.fail} (${((stats.fail / stats.total) * 100).toFixed(2)}%)`,
);
console.log(`Status:      ${JSON.stringify(stats.byStatus)}`);
console.log(`Latency ms:  p50=${pct(stats.latencies, 50).toFixed(1)}  p95=${pct(stats.latencies, 95).toFixed(1)}  p99=${pct(stats.latencies, 99).toFixed(1)}  max=${Math.max(...stats.latencies, 0).toFixed(1)}`);
console.log(`Mem RSS:     ${(stats.startMem / 1024 / 1024).toFixed(1)}MB → ${(endMem / 1024 / 1024).toFixed(1)}MB`);

console.log("\nPer-endpoint:");
for (const [k, v] of Object.entries(stats.byPath)) {
  console.log(
    `  ${k.padEnd(40)} n=${String(v.n).padStart(5)}  p50=${pct(v.lat, 50).toFixed(0)}ms  p95=${pct(v.lat, 95).toFixed(0)}ms`,
  );
}

if (stats.errors.length) {
  const errCounts = {};
  for (const e of stats.errors) errCounts[e] = (errCounts[e] || 0) + 1;
  console.log("\nTop errors:");
  for (const [e, n] of Object.entries(errCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`  [${n}x] ${e}`);
  }
}
