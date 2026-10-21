import assert from "node:assert/strict";
import { evaluateProviderQuality } from "./ProviderQuality";
import type { Candle, MarketDataContext, ProviderHealthSnapshot, QuoteData } from "./types";
import { marketCatalog } from "./MarketCatalog";
import { SeriesValidator } from "./SeriesValidator";

const nowSeconds = 2_000_000_000;
const nowMs = nowSeconds * 1000;

function candlesFor(timeframe: "M15" | "M30"): Candle[] {
  const intervalSeconds = timeframe === "M15" ? 900 : 1800;
  const gapShift = timeframe === "M15" ? 4 : 2;
  const count = 80;
  const historyBack = count + gapShift;
  const base =
    Math.floor((nowSeconds - historyBack * intervalSeconds) / intervalSeconds) * intervalSeconds;
  return Array.from({ length: count }, (_, index) => ({
    time: base + index * intervalSeconds + (index >= 30 ? gapShift * intervalSeconds : 0),
    open: 2_000 + index,
    high: 2_001 + index,
    low: 1_999 + index,
    close: 2_000.5 + index,
    volume: 1,
  }));
}

function context(
  timeframe: "M15" | "M30",
  purpose: MarketDataContext["purpose"],
): MarketDataContext {
  return {
    canonicalSymbol: "XAUUSD",
    timeframe,
    strategyId: "DGV8_FX",
    purpose,
  };
}

function providerHealth(): ProviderHealthSnapshot {
  return {
    health: "HEALTHY",
    reasons: [],
    observedAt: nowMs,
  };
}

function check(report: ReturnType<typeof evaluateProviderQuality>, name: string): boolean {
  return report.checks.find((item) => item.name === name)?.passed ?? false;
}

function strategyQuality(candles: Candle[], providerSymbol = "XAUUSD") {
  return evaluateProviderQuality({
    context: context("M15", "STRATEGY"),
    providerName: "MT5",
    providerSymbol,
    providerHealth: providerHealth(),
    candles,
    nowMs,
  });
}

function sessionScheduleForGap(
  options: {
    symbol?: string;
    providerSymbol?: string;
    receivedAt?: number;
    offsetSeconds?: number;
    shiftSeconds?: number;
    partial?: boolean;
    wrongDay?: boolean;
  } = {},
): void {
  const candles = candlesFor("M15");
  const gapStart = candles[29].time + 900;
  const gapEnd = candles[30].time;
  const localStart = (gapStart + 10_800) % 86_400;
  const localEnd = (gapEnd + 10_800) % 86_400;
  const dayNumber = Math.floor((gapStart + 10_800) / 86_400);
  const gapDay = (((dayNumber + 4) % 7) + 7) % 7;
  assert.ok(localStart < localEnd, "session test gap should stay within a broker-local day");
  const closedStart = localStart + (options.shiftSeconds ?? 0);
  const closedEnd = options.partial ? localEnd - 900 : localEnd + (options.shiftSeconds ?? 0);
  const closedDay = options.wrongDay ? (gapDay + 1) % 7 : gapDay;
  const sessions = Array.from({ length: 7 }, (_, dayOfWeek) => {
    if (dayOfWeek !== closedDay) return [{ dayOfWeek, fromSeconds: 0, toSeconds: 86_400 }];
    return [
      ...(closedStart > 0 ? [{ dayOfWeek, fromSeconds: 0, toSeconds: closedStart }] : []),
      ...(closedEnd < 86_400 ? [{ dayOfWeek, fromSeconds: closedEnd, toSeconds: 86_400 }] : []),
    ];
  }).flat();
  const receivedAt = options.receivedAt ?? nowMs;
  const utcTime = Math.floor(receivedAt / 1000);
  const offsetSeconds = options.offsetSeconds ?? 10_800;
  const symbol = options.symbol ?? "XAUUSD";
  marketCatalog.syncBrokerSpecifications([
    {
      brokerSymbol: options.providerSymbol ?? symbol,
      receivedAt,
      tradingSessions: {
        source: "MT5_SYMBOL_INFO_SESSION_TRADE",
        serverTime: utcTime + offsetSeconds,
        utcTime,
        serverUtcOffsetSeconds: offsetSeconds,
        sessions,
      },
    },
  ]);
}

function displayQuality(candles: Candle[]): ReturnType<typeof evaluateProviderQuality> {
  return evaluateProviderQuality({
    context: context("M15", "CANDLE"),
    providerName: "MT5",
    providerHealth: providerHealth(),
    candles,
    nowMs,
  });
}

const validQuote: QuoteData = {
  symbol: "XAUUSD",
  provider: "MT5",
  providerSymbol: "XAUUSD",
  instrumentType: "METALS",
  price: 2_000,
  timestamp: new Date(nowMs - 1_000).toISOString(),
  receivedAt: new Date(nowMs - 1_000).toISOString(),
  status: "LIVE",
  dataState: "LIVE",
};

function quoteQuality(quote: QuoteData | null): ReturnType<typeof evaluateProviderQuality> {
  return evaluateProviderQuality({
    context: context("M15", "QUOTE"),
    providerName: "MT5",
    providerHealth: providerHealth(),
    quote,
    quoteReceivedAt: quote ? Date.parse(quote.receivedAt) : Number.NaN,
    nowMs,
  });
}

assert.equal(quoteQuality(validQuote).health, "HEALTHY");
for (const [label, quote] of [
  ["null response", null],
  ["stale status", { ...validQuote, status: "STALE" as const }],
  ["non-live status", { ...validQuote, status: "DELAYED" as const }],
  ["zero price", { ...validQuote, price: 0 }],
  ["non-finite price", { ...validQuote, price: Number.NaN }],
  ["invalid received timestamp", { ...validQuote, receivedAt: "not-a-date" }],
  ["invalid source timestamp", { ...validQuote, timestamp: "not-a-date" }],
  [
    "stale received timestamp",
    { ...validQuote, receivedAt: new Date(nowMs - 31_000).toISOString() },
  ],
] as const) {
  const report = quoteQuality(quote);
  assert.equal(
    check(report, "QUOTE_RESPONSE_VALID"),
    label === "stale received timestamp" ? true : false,
    `${label} must fail the required quote response validation`,
  );
  assert.equal(
    check(report, "QUOTE_FRESHNESS"),
    ["null response", "invalid received timestamp", "stale received timestamp"].includes(label)
      ? false
      : true,
    `${label} freshness should be evaluated independently`,
  );
  assert.notEqual(report.health, "HEALTHY", `${label} must not be healthy quote authority`);
}

for (const timeframe of ["M15", "M30"] as const) {
  const display = evaluateProviderQuality({
    context: context(timeframe, "CANDLE"),
    providerName: "MT5",
    providerHealth: providerHealth(),
    candles: candlesFor(timeframe),
    nowMs,
  });
  assert.equal(
    display.health,
    "HEALTHY",
    `${timeframe} MT5 chart history gaps should be display-safe`,
  );
  assert.equal(check(display, "CANDLE_CONTINUITY"), true);
  assert.equal(display.closedCandleCount, 80, `${timeframe} should count actual closed candles`);
  assert.equal(display.seriesReadiness?.continuityValid, true);
}

const strategy = evaluateProviderQuality({
  context: context("M15", "STRATEGY"),
  providerName: "MT5",
  providerHealth: providerHealth(),
  candles: candlesFor("M15"),
  nowMs,
});
assert.equal(
  check(strategy, "CANDLE_CONTINUITY"),
  false,
  "strategy readiness must keep strict continuity",
);
assert.equal(strategy.health, "DEGRADED");
assert.equal(strategy.seriesReadiness?.continuityValid, false);

const sessionCandles = candlesFor("M15");
sessionScheduleForGap();
const sessionAwareStrategy = strategyQuality(sessionCandles);
assert.equal(
  check(sessionAwareStrategy, "CANDLE_CONTINUITY"),
  true,
  "a gap fully covered by current MT5 closed-session metadata should pass",
);
assert.equal(
  check(sessionAwareStrategy, "M15_SERIES_VALIDATION"),
  true,
  "final M15 validation should use the same session-aware rule",
);
assert.equal(
  SeriesValidator.validateM15Series("XAUUSD", "MT5", "XAUUSD", sessionCandles, nowSeconds, {
    connected: true,
    health: "HEALTHY",
  }).valid,
  true,
  "the final strategy validator should accept the explicitly scheduled closure",
);

function assertSessionGapRejected(label: string): void {
  const report = strategyQuality(sessionCandles);
  assert.equal(
    check(report, "CANDLE_CONTINUITY"),
    false,
    `${label} must fail provider quality continuity`,
  );
  assert.equal(
    check(report, "M15_SERIES_VALIDATION"),
    false,
    `${label} must fail final M15 validation`,
  );
  assert.equal(
    SeriesValidator.validateM15Series("XAUUSD", "MT5", "XAUUSD", sessionCandles, nowSeconds, {
      connected: true,
      health: "HEALTHY",
    }).valid,
    false,
    `${label} must not reach strategy evaluation`,
  );
}

sessionScheduleForGap({ shiftSeconds: 900 });
assertSessionGapRejected("a shifted closure");
sessionScheduleForGap({ partial: true });
assertSessionGapRejected("a partial closure");
sessionScheduleForGap({ wrongDay: true });
assertSessionGapRejected("a closure declared for the wrong weekday");
marketCatalog.clearBrokerSpecifications();
sessionScheduleForGap({ symbol: "XAGUSD", providerSymbol: "XAGUSD" });
assertSessionGapRejected("a schedule for the wrong symbol");
marketCatalog.clearBrokerSpecifications();
assertSessionGapRejected("missing session metadata");
sessionScheduleForGap({ receivedAt: nowMs - 181_000 });
assertSessionGapRejected("stale session metadata");
sessionScheduleForGap({ offsetSeconds: 7_200 });
assertSessionGapRejected("a timezone offset inconsistent with candle normalization");
marketCatalog.clearBrokerSpecifications();

const sundayMidnight = Date.UTC(2026, 8, 27);
assert.equal(new Date(sundayMidnight).getUTCDay(), 0);
const sundayDayNumber = sundayMidnight / 1000 / 86_400;
const overnightLocalStart = sundayDayNumber * 86_400 + 23.5 * 3_600;
const overnightLocalEnd = sundayDayNumber * 86_400 + 24.5 * 3_600;
const overnightCandles: Candle[] = [
  overnightLocalStart - 10_800 - 900,
  overnightLocalEnd - 10_800,
].map((time) => ({ time, open: 2_000, high: 2_001, low: 1_999, close: 2_000 }));
const overnightUtcTime = Math.floor(nowMs / 1000);
marketCatalog.syncBrokerSpecifications([
  {
    brokerSymbol: "XAUUSD",
    receivedAt: nowMs,
    tradingSessions: {
      source: "MT5_SYMBOL_INFO_SESSION_TRADE",
      serverTime: overnightUtcTime + 10_800,
      utcTime: overnightUtcTime,
      serverUtcOffsetSeconds: 10_800,
      sessions: [
        { dayOfWeek: 0, fromSeconds: 0, toSeconds: 23 * 3_600 },
        { dayOfWeek: 1, fromSeconds: 3_600, toSeconds: 86_400 },
      ],
    },
  },
]);
assert.equal(
  SeriesValidator.validateMt5M15Continuity("XAUUSD", "XAUUSD", overnightCandles, nowMs).valid,
  true,
  "a gap crossing midnight should pass only when the adjacent weekday schedules leave the entire interval closed",
);
marketCatalog.syncBrokerSpecifications([
  {
    brokerSymbol: "XAUUSD",
    receivedAt: nowMs,
    tradingSessions: {
      source: "MT5_SYMBOL_INFO_SESSION_TRADE",
      serverTime: overnightUtcTime + 10_800,
      utcTime: overnightUtcTime,
      serverUtcOffsetSeconds: 10_800,
      sessions: [{ dayOfWeek: 0, fromSeconds: 22 * 3_600, toSeconds: 2 * 3_600 }],
    },
  },
]);
assert.equal(
  SeriesValidator.validateMt5M15Continuity("XAUUSD", "XAUUSD", overnightCandles, nowMs).valid,
  false,
  "an overnight session that overlaps any part of a gap must reject it",
);
const fullWeekGapStart = Math.floor(1_000_000_000 / 900) * 900;
const fullWeekGapCandles: Candle[] = [fullWeekGapStart, fullWeekGapStart + 14 * 86_400].map(
  (time) => ({ time, open: 2_000, high: 2_001, low: 1_999, close: 2_000 }),
);
assert.equal(
  SeriesValidator.validateMt5M15Continuity("XAUUSD", "XAUUSD", fullWeekGapCandles, nowMs).valid,
  false,
  "a gap spanning multiple weekly schedules must fail without scanning unbounded history",
);
marketCatalog.clearBrokerSpecifications();

const externalDisplay = evaluateProviderQuality({
  context: context("M15", "CANDLE"),
  providerName: "TWELVE_DATA",
  providerHealth: providerHealth(),
  candles: candlesFor("M15"),
  nowMs,
});
assert.equal(
  check(externalDisplay, "CANDLE_CONTINUITY"),
  false,
  "external chart providers must remain strict",
);
assert.equal(externalDisplay.health, "DEGRADED");

const malformed = candlesFor("M15");
malformed[10] = { ...malformed[10], high: Number.NaN };
const malformedDisplay = displayQuality(malformed);
assert.equal(
  check(malformedDisplay, "FINITE_PRICES"),
  false,
  "malformed chart candles must be rejected",
);
assert.equal(malformedDisplay.health, "DEGRADED");

const geometry = candlesFor("M15");
geometry[10] = { ...geometry[10], high: geometry[10].low - 1 };
assert.equal(check(displayQuality(geometry), "CANDLE_GEOMETRY"), false);

const duplicate = candlesFor("M15");
duplicate[10] = { ...duplicate[10], time: duplicate[9].time };
assert.equal(check(displayQuality(duplicate), "DUPLICATE_BARS"), false);

const outOfOrder = candlesFor("M15");
[outOfOrder[10], outOfOrder[11]] = [outOfOrder[11], outOfOrder[10]];
assert.equal(check(displayQuality(outOfOrder), "OUT_OF_ORDER_UPDATES"), false);

const misaligned = candlesFor("M15");
misaligned[10] = { ...misaligned[10], time: misaligned[10].time + 1 };
assert.equal(check(displayQuality(misaligned), "TIMESTAMP_ALIGNMENT"), false);

const staleDisplay = displayQuality(
  candlesFor("M15").map((candle) => ({ ...candle, time: candle.time - 10 * 60 * 60 })),
);
assert.equal(
  check(staleDisplay, "CANDLE_FRESHNESS"),
  false,
  "stale chart candles must be rejected",
);
assert.equal(staleDisplay.health, "DEGRADED");

const higherTimeframeAnchor = 31 * 24 * 60 * 60 * 700;
const higherTimeframeNowSeconds = higherTimeframeAnchor + 3 * 60 * 60 + 45 * 60;
const higherTimeframeIntervals = {
  H4: 4 * 60 * 60,
  D1: 24 * 60 * 60,
  W1: 7 * 24 * 60 * 60,
  MN1: 31 * 24 * 60 * 60,
} as const;
function higherTimeframeCandles(
  timeframe: keyof typeof higherTimeframeIntervals,
  barsBehindCurrent: number,
): Candle[] {
  const intervalSeconds = higherTimeframeIntervals[timeframe];
  const count = 80;
  const start = higherTimeframeAnchor - (count - 1 + barsBehindCurrent) * intervalSeconds;
  return Array.from({ length: count }, (_, index) => ({
    time: start + index * intervalSeconds,
    open: 2_000 + index,
    high: 2_001 + index,
    low: 1_999 + index,
    close: 2_000.5 + index,
    volume: 1,
  }));
}

for (const timeframe of Object.keys(higherTimeframeIntervals) as Array<
  keyof typeof higherTimeframeIntervals
>) {
  const chartContext: MarketDataContext = {
    canonicalSymbol: "XAUUSD",
    timeframe,
    strategyId: "DISPLAY",
    purpose: "CANDLE",
  };
  const current = evaluateProviderQuality({
    context: chartContext,
    providerName: "MT5",
    providerHealth: providerHealth(),
    candles: higherTimeframeCandles(timeframe, 0),
    nowMs: higherTimeframeNowSeconds * 1000,
  });
  assert.equal(
    check(current, "CANDLE_FRESHNESS"),
    true,
    `${timeframe} open chart candles should remain fresh`,
  );
  const beyondGrace = evaluateProviderQuality({
    context: chartContext,
    providerName: "MT5",
    providerHealth: providerHealth(),
    candles: higherTimeframeCandles(timeframe, 2),
    nowMs: higherTimeframeNowSeconds * 1000,
  });
  assert.equal(
    check(beyondGrace, "CANDLE_FRESHNESS"),
    false,
    `${timeframe} candles beyond the duration plus grace should be stale`,
  );
}

console.log(
  "Provider quality checks passed: MT5 display gaps, strict strategy/external validation, malformed candles, and stale chart data.",
);
