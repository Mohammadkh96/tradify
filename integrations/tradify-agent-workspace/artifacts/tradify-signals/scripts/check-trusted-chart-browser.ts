import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tradingViewChartHtml } from "../components/trading-view-chart";
import { fixtureNowSeconds, trustedM15Response } from "../__tests__/fixtures/trusted-mt5-m15";

// An isolated browser fixture, never an application route or authentication
// bypass. Runs the actual canvas renderer, not a mocked Lightweight Charts API.
const directory = fileURLToPath(new URL("../../../generated-artifacts/trusted-chart/", import.meta.url));
mkdirSync(directory, { recursive: true });
const fixture = {
  ...trustedM15Response,
  lastPrice: 106.1,
  visibleLayers: { entries: true, targets: true, stops: true, sources: true, pivots: true },
  levels: {
    direction: "LONG", entry: 106.3, buyEntry: 106.3, sellEntry: 105.1,
    buyStop: 104.8, sellStop: 107.1,
    buyTargets: [107.2, 108.1, 109.4], sellTargets: [104.2, 103.4, 102.3],
    sourceHigh: 105.8, sourceLow: 100.2, pivotResistance: 106, pivotSupport: 100.6,
  },
};
const instrumentation = `
Date.now = function () { return ${fixtureNowSeconds * 1000}; };
window.__testLines = new Map();
// The library's export object is frozen. Clone its exports only in this
// isolated fixture before wrapping the real canvas API.
window.LightweightCharts = Object.assign({}, window.LightweightCharts);
var originalCreateChart = window.LightweightCharts.createChart;
window.LightweightCharts.createChart = function () {
  var chart = originalCreateChart.apply(this, arguments);
  var originalAdd = chart.addSeries.bind(chart);
  chart.addSeries = function () {
    var series = originalAdd.apply(chart, arguments);
    var create = series.createPriceLine.bind(series);
    var remove = series.removePriceLine.bind(series);
    series.createPriceLine = function (options) {
      var line = create(options); window.__testLines.set(line, options); return line;
    };
    series.removePriceLine = function (line) {
      window.__testLines.delete(line); return remove(line);
    };
    return series;
  };
  return chart;
};
`;
const assertions = `
<script>
(async function () {
  var data = ${JSON.stringify(fixture)};
  var output = document.createElement("pre");
  output.id = "browser-test-result";
  document.body.appendChild(output);
  function check(condition, message) { if (!condition) throw new Error(message); }
  function lines() { return Array.from(window.__testLines.values()); }
  async function send(payload) {
    window.postMessage(JSON.stringify({ type: "DATA", payload: payload }), "*");
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
  try {
    await send(data);
    check(document.querySelectorAll("canvas").length > 0, "Canvas failed to mount");
    check(lines().length === 11, "Long plan/context line count");
    check(lines().some(function (line) { return line.title === "BUY ENTRY" && line.price === 106.3; }), "Buy gate missing");
    check(!lines().some(function (line) { return line.title === "SELL ENTRY"; }), "Wrong sell gate");
    check(lines().filter(function (line) { return line.title.indexOf("SOURCE") === 0; }).length === 2, "Source pair missing");
    check(lines().filter(function (line) { return line.title.indexOf("PIVOT") === 0; }).length === 2, "Pivot pair missing");
    await send(Object.assign({}, data, { visibleLayers: { entries: true, targets: true, stops: true, sources: false, pivots: false } }));
    check(lines().length === 7, "Source/pivot layer switches");
    var short = Object.assign({}, data, { levels: Object.assign({}, data.levels, { direction: "SHORT", entry: 105.1 }) });
    await send(short);
    check(lines().length === 11, "Short plan/context line count");
    check(lines().some(function (line) { return line.title === "SELL ENTRY" && line.price === 105.1; }), "Sell gate missing");
    check(!lines().some(function (line) { return line.title === "BUY ENTRY"; }), "Previous buy gate persisted");
    check(lines().some(function (line) { return line.title === "STOP" && line.price === 107.1; }), "Short stop missing");
    check(lines().some(function (line) { return line.title === "TP1" && line.price === 104.2; }), "Short target missing");
    for (var state of ["STALE", "FALLBACK", "ERROR"]) {
      await send(Object.assign({}, short, { dataState: state }));
      check(lines().length === 1 && lines()[0].title === "SPOT", state + " strategy lines leaked");
    }
    await send(Object.assign({}, short, { candles: short.candles.slice(-49), levels: undefined }));
    check(lines().length === 1, "Insufficient history overlays leaked");
    await send(data);
    output.textContent = "PASS: real canvas; long/short gates/stops/targets; source/pivot pairs and switches; stale/fallback/error/insufficient overlays withheld";
  } catch (error) {
    output.textContent = "FAIL: " + error.message;
  }
})();
</script>`;
const html = tradingViewChartHtml
  .replace('(function () {', `${instrumentation}\n(function () {`)
  .replace("</body>", `${assertions}</body>`);
const htmlPath = resolve(directory, "fixture.html");
writeFileSync(htmlPath, html);
for (const viewport of ["375,812", "812,375"]) {
  const result = spawnSync(process.env.CHROMIUM_PATH ?? "/repl/tools/bin/chromium", [
    "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-pdf-header-footer", "--virtual-time-budget=3000", `--window-size=${viewport}`,
    `--screenshot=${resolve(directory, `chart-${viewport.replace(",", "x")}.png`)}`,
    "--dump-dom", pathToFileURL(htmlPath).href,
  ], { encoding: "utf8", timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const report = result.stdout.match(/<pre id="browser-test-result">([^<]*)<\/pre>/)?.[1];
  assert.ok(report?.startsWith("PASS:"), report ?? "Browser fixture did not finish");
  console.log(`${viewport}: ${report}`);
}
console.log("Browser-only fixture checks passed; not an Expo Go iOS/Android device check.");
