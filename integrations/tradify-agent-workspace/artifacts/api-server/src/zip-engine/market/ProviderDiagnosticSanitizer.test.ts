import assert from "node:assert/strict";
import type { AuthorityDecision, ProviderCandidate } from "./ProviderRegistry";
import {
  buildPersistedAuthorityEvidence,
  sanitizeDiagnosticEndpoint,
  sanitizeDiagnosticValue,
} from "./ProviderDiagnosticSanitizer";

const syntheticCanary = "fixture-only-not-a-credential";
const queryNames = [
  "api_key",
  "apikey",
  "apiKey",
  "key",
  "token",
  "access_token",
  "client_secret",
  "authorization",
  "signature",
  "subscription_key",
];
const credentialUrl = `https://feeds.example.invalid/quote?${queryNames
  .map((name) => `${name}=${syntheticCanary}`)
  .join("&")}&symbol=EURUSD`;

const sanitizedEndpoint = sanitizeDiagnosticEndpoint(credentialUrl);
assert.ok(sanitizedEndpoint.startsWith("/quote?"));
assert.ok(sanitizedEndpoint.includes("symbol=EURUSD"));
assert.equal(
  sanitizedEndpoint.includes(syntheticCanary),
  false,
  "sanitized endpoints must not expose credential values",
);

const sanitizedHistory = sanitizeDiagnosticValue({
  providerRequestHistory: [
    {
      url: credentialUrl,
      headers: {
        authorization: `Bearer ${syntheticCanary}`,
        "x-api-key": syntheticCanary,
      },
      query: { apiKey: syntheticCanary },
      reason: `Request failed for ${credentialUrl}`,
    },
  ],
});
const historyJson = JSON.stringify(sanitizedHistory);
assert.equal(
  historyJson.includes(syntheticCanary),
  false,
  "nested provider request history must be redacted",
);
assert.equal(sanitizedHistory.providerRequestHistory[0].headers.authorization, "[REDACTED]");
assert.equal(sanitizedHistory.providerRequestHistory[0].query.apiKey, "[REDACTED]");
assert.match(sanitizedHistory.providerRequestHistory[0].reason, /Request failed/);

const readiness = {
  providerId: "TWELVE_DATA",
  canonicalSymbol: "EURUSD",
  timeframe: "M15",
  enoughHistoryLoaded: true,
  latestRequiredClosedBarPresent: true,
  continuityValid: true,
  fullSynchronizationComplete: true,
  freshnessValid: true,
  observedAt: 1_800_000_000_000,
};
const health = {
  health: "DEGRADED",
  reasons: [
    `Provider error at ${credentialUrl}`,
    "Provider is rate limited; authority remains blocked until freshness recovers.",
  ],
  observedAt: readiness.observedAt,
  checks: [
    {
      name: "SOURCE_TIMESTAMP_PRESENT",
      passed: true,
      observedAt: readiness.observedAt,
      reason: `Upstream response referenced ${credentialUrl}`,
    },
  ],
  metrics: {
    requestCount: 1,
    cacheHitCount: 0,
    cacheMissCount: 1,
    errorCount: 1,
    rateLimitEvents: 1,
    reconnectCount: 0,
    sourceTimestampAdvances: 0,
    lastStatusCode: 429,
    lastError: `Provider error at ${credentialUrl}`,
    requestAudit: [
      {
        endpoint: credentialUrl,
        canonicalSymbol: "EURUSD",
        requestTimestamp: "2026-09-26T00:00:00.000Z",
        status: 429,
        cache: "MISS",
        caller: "readiness",
        reason: `Readiness request to ${credentialUrl}`,
      },
    ],
    unapprovedResponsePayload: { apiKey: syntheticCanary },
  },
  seriesReadiness: readiness,
  rawProviderResponse: { token: syntheticCanary },
};
const candidate = {
  providerId: "TWELVE_DATA",
  role: "ALTERNATE",
  approval: "APPROVED",
  priority: 20,
  health,
  quality: {
    ...health,
    closedCandleCount: 80,
    validationReason: `Validated response at ${credentialUrl}`,
  },
  capability: {
    providerId: "TWELVE_DATA",
    canonicalSymbol: "EURUSD",
    providerSymbol: "EUR/USD",
    instrumentClass: "SPOT",
    timeframe: "M15",
    nativeM15: true,
    entitlement: "VERIFIED",
    approval: "APPROVED",
    allowedUsages: ["SHADOW"],
    freshnessThresholdMs: 1_800_000,
    minimumHistory: 50,
    requiresFullSynchronization: true,
    qualityState: "VERIFIED",
    structuralSuitability: "NOT_REQUIRED",
    technicalCapability: true,
    authorityEligibilityReason: "Approved shadow capability.",
    unapprovedCredential: syntheticCanary,
  },
  capabilityReasons: ["Provider capability is available for shadow evaluation."],
  seriesReadiness: readiness,
  providerSymbol: "EUR/USD",
  instrumentClass: "SPOT",
  sourceTimestamp: 1_800_000_000,
  eligible: false,
  rawProviderPayload: { credential: syntheticCanary },
} as unknown as ProviderCandidate;
const decision = {
  contextKey: "EURUSD:M15:DGV8:STRATEGY",
  selectedProviderId: null,
  reason: "NO_APPROVED_HEALTHY_PROVIDER",
  candidates: [candidate],
} as AuthorityDecision;

const persistedEvidence = buildPersistedAuthorityEvidence(decision);
const persistedJson = JSON.stringify(persistedEvidence);
assert.equal(
  persistedJson.includes(syntheticCanary),
  false,
  "persisted evidence must not expose credential values",
);
assert.doesNotMatch(
  persistedJson,
  /unapprovedResponsePayload|rawProviderResponse|rawProviderPayload/,
);
assert.match(persistedJson, /SOURCE_TIMESTAMP_PRESENT/);

const persistedCandidate = persistedEvidence.candidates[0];
assert.equal(
  persistedCandidate.health.reasons[1],
  "Provider is rate limited; authority remains blocked until freshness recovers.",
);
assert.equal(persistedCandidate.health.seriesReadiness?.continuityValid, true);
assert.equal(persistedCandidate.quality?.closedCandleCount, 80);
assert.equal(
  persistedCandidate.capability?.authorityEligibilityReason,
  "Approved shadow capability.",
);
assert.ok(persistedCandidate.health.metrics?.requestAudit?.[0].endpoint.includes("[REDACTED]"));
assert.match(
  persistedCandidate.health.metrics?.requestAudit?.[0].reason ?? "",
  /Readiness request/,
);

const safeLogError = sanitizeDiagnosticValue(new Error(`Provider failure for ${credentialUrl}`));
assert.equal(
  JSON.stringify(safeLogError).includes(syntheticCanary),
  false,
  "sanitized errors must not expose credential values",
);

console.log("Provider diagnostic redaction checks passed.");
