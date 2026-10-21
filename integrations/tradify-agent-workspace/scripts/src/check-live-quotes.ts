type JsonObject = Record<string, unknown>;

export interface LiveQuote {
  brokerSymbol?: unknown;
  dataState?: unknown;
  price?: unknown;
  provider?: unknown;
  receivedAt?: unknown;
  status?: unknown;
  time?: unknown;
  timeMsc?: unknown;
}

export interface LiveQuoteResponse {
  bridge?: {
    activeSymbols?: unknown;
    connected?: unknown;
    mappings?: unknown;
  };
  quotes?: Record<string, LiveQuote>;
}

export interface LiveQuoteCheckOptions {
  maxQuoteAgeMs?: number;
}

export interface LiveQuoteCheckResult {
  checkedSamples: number;
  subscribedSymbols: string[];
  changedSymbols: string[];
  advancedSymbols: string[];
  latestQuoteAgeMs: number;
}

interface QuoteObservation {
  key: string;
  quote: LiveQuote;
}

interface FetchResponse {
  json(): Promise<unknown>;
  ok: boolean;
  status: number;
}

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<FetchResponse>;

const DEFAULT_URL = "http://localhost:80/api/market/quotes";
const DEFAULT_SAMPLES = 5;
const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 10_000;
// The bridge can deliver in short bursts while its heartbeat remains healthy.
// Allow two normal heartbeat intervals before declaring the quote stream stale.
const DEFAULT_MAX_QUOTE_AGE_MS = 30_000;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function asQuotes(value: unknown): Record<string, LiveQuote> {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, quote]) => isObject(quote))) as Record<
    string,
    LiveQuote
  >;
}

function parseResponse(value: unknown): LiveQuoteResponse {
  if (!isObject(value)) throw new Error("response body was not a JSON object");
  return {
    bridge: isObject(value.bridge) ? value.bridge : {},
    quotes: asQuotes(value.quotes),
  };
}

function normalized(value: string): string {
  return value.trim().toUpperCase();
}

function symbolVariants(value: string): string[] {
  const symbol = normalized(value);
  return symbol.endsWith("USDT") ? [symbol, `${symbol.slice(0, -4)}USD`] : [symbol];
}

function symbolsMatch(left: string, right: string): boolean {
  const rightVariants = new Set(symbolVariants(right));
  return symbolVariants(left).some((variant) => rightVariants.has(variant));
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function quoteIngestionAdvanced(previous: LiveQuote, current: LiveQuote): boolean {
  const previousReceivedAt = finiteNumber(previous.receivedAt);
  const currentReceivedAt = finiteNumber(current.receivedAt);
  if (previousReceivedAt !== undefined && currentReceivedAt !== undefined) {
    return currentReceivedAt > previousReceivedAt;
  }

  const previousSourceTime = finiteNumber(previous.timeMsc) ?? finiteNumber(previous.time);
  const currentSourceTime = finiteNumber(current.timeMsc) ?? finiteNumber(current.time);
  return (
    previousSourceTime !== undefined &&
    currentSourceTime !== undefined &&
    currentSourceTime > previousSourceTime
  );
}

function quoteIsLive(quote: LiveQuote | undefined, allowPublicCustomerPayload = false): boolean {
  return Boolean(
    quote &&
    ((typeof quote.provider === "string" && quote.provider.trim().length > 0) ||
      (allowPublicCustomerPayload && quote.provider === undefined)) &&
    quote.dataState === "LIVE" &&
    (quote.status === undefined || quote.status === "LIVE") &&
    typeof quote.price === "number" &&
    Number.isFinite(quote.price) &&
    quote.price > 0,
  );
}

function getMappings(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([canonical, broker]) => typeof canonical === "string" && typeof broker === "string",
    ),
  ) as Record<string, string>;
}

function findQuote(
  subscribedBrokerSymbol: string,
  quotes: Record<string, LiveQuote>,
  mappings: Record<string, string>,
): QuoteObservation | undefined {
  const target = normalized(subscribedBrokerSymbol);
  const direct = Object.entries(quotes).find(
    ([key, quote]) =>
      symbolsMatch(key, target) ||
      (typeof quote.brokerSymbol === "string" && symbolsMatch(quote.brokerSymbol, target)),
  );
  if (direct) return { key: direct[0], quote: direct[1] };

  const canonical = Object.entries(mappings).find(([, broker]) =>
    symbolsMatch(broker, target),
  )?.[0];
  if (!canonical) return undefined;
  const mapped = Object.entries(quotes).find(([key]) => symbolsMatch(key, canonical));
  return mapped ? { key: mapped[0], quote: mapped[1] } : undefined;
}

function inspectSample(
  sample: LiveQuoteResponse,
  sampleNumber: number,
  maxQuoteAgeMs: number,
): { observations: Map<string, QuoteObservation>; issues: string[]; latestQuoteAgeMs: number } {
  const issues: string[] = [];
  const bridge = sample.bridge ?? {};
  const quotes = sample.quotes ?? {};
  const activeSymbols = asStringList(bridge.activeSymbols);
  const mappings = getMappings(bridge.mappings);
  const hasSubscriptionMetadata = "activeSymbols" in bridge || "mappings" in bridge;
  const isPublicCustomerPayload = !hasSubscriptionMetadata;
  let latestQuoteAgeMs = 0;

  if (!isPublicCustomerPayload && bridge.connected !== true) {
    issues.push(`sample ${sampleNumber}: market data bridge is not connected`);
  }
  if (activeSymbols.length === 0 && !isPublicCustomerPayload) {
    issues.push(`sample ${sampleNumber}: bridge reported no active market subscriptions`);
  }
  if (Object.keys(quotes).length === 0) {
    issues.push(`sample ${sampleNumber}: quote endpoint returned no live quotes`);
  }

  for (const [key, quote] of Object.entries(quotes)) {
    if (!quoteIsLive(quote, isPublicCustomerPayload)) {
      issues.push(`sample ${sampleNumber}: ${key} is not a live quote`);
    }
    if (typeof quote.receivedAt === "number" && Number.isFinite(quote.receivedAt)) {
      const ageMs = Date.now() - quote.receivedAt;
      latestQuoteAgeMs = Math.max(latestQuoteAgeMs, ageMs);
      if (ageMs > maxQuoteAgeMs) {
        issues.push(
          `sample ${sampleNumber}: ${key} is ${Math.round(ageMs / 1_000)}s old; broker data is stale`,
        );
      }
    }
  }

  const observations = new Map<string, QuoteObservation>();
  if (isPublicCustomerPayload) {
    for (const [key, quote] of Object.entries(quotes)) {
      if (quoteIsLive(quote, true)) {
        observations.set(normalized(key), { key, quote });
      }
    }
  } else {
    for (const subscribedSymbol of activeSymbols) {
      const observation = findQuote(subscribedSymbol, quotes, mappings);
      if (!observation) continue;
      if (!quoteIsLive(observation.quote)) continue;
      observations.set(normalized(subscribedSymbol), observation);
    }
  }
  if (observations.size === 0 && (activeSymbols.length > 0 || isPublicCustomerPayload)) {
    issues.push(`sample ${sampleNumber}: no live quote returned for any active subscription`);
  }

  return { observations, issues, latestQuoteAgeMs };
}

function isStartupSample(issues: string[]): boolean {
  return issues.some(
    (issue) =>
      issue.includes("market data bridge is not connected") ||
      issue.includes("no active market subscriptions") ||
      issue.includes("quote endpoint returned no live quotes"),
  );
}

export function validateLiveQuoteSamples(
  samples: LiveQuoteResponse[],
  options: LiveQuoteCheckOptions = {},
): LiveQuoteCheckResult {
  if (samples.length < 2) {
    throw new Error("at least two quote samples are required to detect a stalled price");
  }

  const maxQuoteAgeMs = options.maxQuoteAgeMs ?? DEFAULT_MAX_QUOTE_AGE_MS;
  const observationsBySample = samples.map((sample, index) =>
    inspectSample(sample, index + 1, maxQuoteAgeMs),
  );
  // The API can start before the EA's first heartbeat/quote batch arrives.
  // Ignore only the leading empty startup samples; once a complete sample is
  // observed, every later sample must remain healthy.
  const firstReadyIndex = observationsBySample.findIndex(
    ({ issues: sampleIssues }) => !isStartupSample(sampleIssues),
  );
  if (firstReadyIndex < 0) {
    const issues = observationsBySample.flatMap(({ issues: sampleIssues }) => sampleIssues);
    throw new Error(issues.join("; "));
  }
  const readySamples = observationsBySample.slice(firstReadyIndex);
  if (readySamples.length < 2) {
    throw new Error(
      `Market data became ready in sample ${firstReadyIndex + 1}, but only one healthy sample was available; increase the sampling window`,
    );
  }
  const issues = readySamples.flatMap(({ issues: sampleIssues }) => sampleIssues);
  if (issues.length > 0) throw new Error(issues.join("; "));

  const first = readySamples[0].observations;
  const changedSymbols = new Set<string>();
  const advancedSymbols = new Set<string>();
  let previous = first;
  for (const { observations } of readySamples.slice(1)) {
    for (const [symbol, observation] of observations) {
      const previousObservation = previous.get(symbol);
      if (!previousObservation) continue;
      if (observation.quote.price !== previousObservation.quote.price) {
        changedSymbols.add(symbol);
      }
      if (quoteIngestionAdvanced(previousObservation.quote, observation.quote)) {
        advancedSymbols.add(symbol);
      }
    }
    previous = observations;
  }

  if (advancedSymbols.size === 0) {
    throw new Error(
      `quote ingestion timestamps did not advance across ${readySamples.length} healthy samples; endpoint may be serving cached or stale broker data`,
    );
  }

  return {
    checkedSamples: readySamples.length,
    subscribedSymbols: [...first.keys()],
    changedSymbols: [...changedSymbols],
    advancedSymbols: [...advancedSymbols],
    latestQuoteAgeMs: Math.max(...readySamples.map(({ latestQuoteAgeMs }) => latestQuoteAgeMs)),
  };
}

async function fetchQuoteSample(
  url: string,
  timeoutMs: number,
  fetchImpl: FetchLike,
): Promise<LiveQuoteResponse> {
  let response: FetchResponse;
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`could not reach ${url}: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`quote endpoint returned HTTP ${response.status}`);
  }

  try {
    return parseResponse(await response.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`quote endpoint returned invalid JSON: ${message}`);
  }
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function printUsage(): void {
  console.log(`Usage: pnpm --filter @workspace/scripts run check:live-quotes [options]

Samples the fast quote endpoint and fails if market-data provenance, freshness,
or price movement is not healthy.

Options:
  --url <url>             Quote endpoint (default: ${DEFAULT_URL})
  --samples <count>       Number of samples (default: ${DEFAULT_SAMPLES})
  --interval-ms <ms>      Delay between samples (default: ${DEFAULT_INTERVAL_MS})
  --timeout-ms <ms>       Request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --max-age-ms <ms>       Maximum quote age (default: ${DEFAULT_MAX_QUOTE_AGE_MS})
`);
}

export async function runLiveQuoteCheck(
  args: string[] = process.argv.slice(2),
  dependencies: { fetchImpl?: FetchLike; sleepImpl?: (delayMs: number) => Promise<void> } = {},
): Promise<LiveQuoteCheckResult> {
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return {
      checkedSamples: 0,
      subscribedSymbols: [],
      changedSymbols: [],
      advancedSymbols: [],
      latestQuoteAgeMs: 0,
    };
  }

  const url = optionValue(args, "--url") ?? process.env.LIVE_QUOTES_URL ?? DEFAULT_URL;
  const samples = positiveInteger(
    optionValue(args, "--samples") ?? process.env.LIVE_QUOTES_SAMPLES,
    DEFAULT_SAMPLES,
    "--samples",
  );
  const intervalMs = positiveInteger(
    optionValue(args, "--interval-ms") ?? process.env.LIVE_QUOTES_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    "--interval-ms",
  );
  const timeoutMs = positiveInteger(
    optionValue(args, "--timeout-ms") ?? process.env.LIVE_QUOTES_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    "--timeout-ms",
  );
  const maxQuoteAgeMs = positiveInteger(
    optionValue(args, "--max-age-ms") ?? process.env.LIVE_QUOTES_MAX_AGE_MS,
    DEFAULT_MAX_QUOTE_AGE_MS,
    "--max-age-ms",
  );
  if (samples < 2) throw new Error("--samples must be at least 2 to detect price movement");

  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const sleepImpl = dependencies.sleepImpl ?? sleep;
  const collected: LiveQuoteResponse[] = [];
  for (let index = 0; index < samples; index += 1) {
    collected.push(await fetchQuoteSample(url, timeoutMs, fetchImpl));
    if (index < samples - 1) await sleepImpl(intervalMs);
  }

  return validateLiveQuoteSamples(collected, { maxQuoteAgeMs });
}

async function main(): Promise<void> {
  if (process.argv.slice(2).includes("--help") || process.argv.slice(2).includes("-h")) {
    printUsage();
    return;
  }

  try {
    const result = await runLiveQuoteCheck();
    console.log(
      `LIVE QUOTES OK: ${result.checkedSamples} samples, ${result.subscribedSymbols.length} live authority quote(s), ` +
        `${result.advancedSymbols.length} quote stream(s) advanced, ${result.changedSymbols.length} price(s) changed; ` +
        `newest quote age ${Math.max(0, Math.round(result.latestQuoteAgeMs))}ms.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`LIVE QUOTES FAILED: ${message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
