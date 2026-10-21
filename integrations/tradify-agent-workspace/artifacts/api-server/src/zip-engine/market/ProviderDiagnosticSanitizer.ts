import type { AuthorityDecision, ProviderCandidate } from "./ProviderRegistry";
import type { ProviderCapability } from "./ProviderCapabilityPolicy";
import type { ProviderQualityReport } from "./ProviderQuality";
import type { ProviderSeriesReadinessState } from "./ProviderSeriesReadiness";
import type { ProviderHealthSnapshot, ProviderRuntimeMetrics } from "./types";

const REDACTED = "[REDACTED]";
const MAX_PERSISTED_REQUEST_AUDITS = 50;

const sensitiveNames = new Set([
  "key",
  "apikey",
  "accesskey",
  "clientkey",
  "consumerkey",
  "subscriptionkey",
  "token",
  "accesstoken",
  "refreshtoken",
  "authtoken",
  "secret",
  "clientsecret",
  "password",
  "passwd",
  "credential",
  "authorization",
  "auth",
  "signature",
  "privatekey",
  "bearer",
]);

function normalizedName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSensitiveDiagnosticName(name: string): boolean {
  const normalized = normalizedName(name);
  return (
    sensitiveNames.has(normalized) ||
    normalized.includes("apikey") ||
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("passwd") ||
    normalized.includes("credential") ||
    normalized.includes("authorization") ||
    normalized.includes("signature") ||
    normalized.includes("privatekey") ||
    normalized.endsWith("accesskey") ||
    normalized.endsWith("clientkey") ||
    normalized.endsWith("consumerkey")
  );
}

export function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(/(\b(?:https?|wss?):\/\/)[^/@\s]+@/gi, "$1[REDACTED]@")
    .replace(/(^|[?&;,\s])([^=?&#;\s]+)=([^&#;\s]*)/g, (match, prefix: string, rawName: string) => {
      let name = rawName;
      try {
        name = decodeURIComponent(rawName.replaceAll("+", " "));
      } catch {
        // Keep the raw key name and still apply the conservative matcher.
      }
      return isSensitiveDiagnosticName(name) ? `${prefix}${rawName}=${REDACTED}` : match;
    })
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
    .replace(/\b(authorization\s*[:=]\s*)[^,\s;#&]+/gi, "$1[REDACTED]");
}

export function sanitizeDiagnosticEndpoint(value: string): string {
  try {
    const parsed = new URL(value);
    return sanitizeDiagnosticText(`${parsed.pathname}${parsed.search}`);
  } catch {
    return sanitizeDiagnosticText(value);
  }
}

function sanitizeValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (typeof value === "string") return sanitizeDiagnosticText(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date)
    return Number.isFinite(value.getTime()) ? value.toISOString() : "Invalid Date";
  if (value instanceof Error) {
    return {
      name: sanitizeDiagnosticText(value.name),
      message: sanitizeDiagnosticText(value.message),
      ...(value.stack ? { stack: sanitizeDiagnosticText(value.stack) } : {}),
    };
  }
  if (ancestors.has(value)) return "[Circular]";

  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, ancestors));
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = isSensitiveDiagnosticName(key) ? REDACTED : sanitizeValue(item, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function sanitizeDiagnosticValue<T>(value: T): T {
  return sanitizeValue(value, new WeakSet<object>()) as T;
}

function finiteNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeReadiness(
  value: ProviderSeriesReadinessState | undefined,
): ProviderSeriesReadinessState | undefined {
  if (!value) return undefined;
  return {
    providerId: sanitizeDiagnosticText(value.providerId),
    canonicalSymbol: sanitizeDiagnosticText(value.canonicalSymbol),
    timeframe: sanitizeDiagnosticText(value.timeframe),
    enoughHistoryLoaded: Boolean(value.enoughHistoryLoaded),
    latestRequiredClosedBarPresent: Boolean(value.latestRequiredClosedBarPresent),
    continuityValid: Boolean(value.continuityValid),
    fullSynchronizationComplete: Boolean(value.fullSynchronizationComplete),
    freshnessValid: Boolean(value.freshnessValid),
    observedAt: finiteNumber(value.observedAt) ?? 0,
  };
}

function safeCapability(value: ProviderCapability | undefined): ProviderCapability | undefined {
  if (!value) return undefined;
  return {
    providerId: sanitizeDiagnosticText(value.providerId),
    canonicalSymbol: sanitizeDiagnosticText(value.canonicalSymbol),
    providerSymbol: sanitizeDiagnosticText(value.providerSymbol),
    instrumentClass: sanitizeDiagnosticText(
      value.instrumentClass,
    ) as ProviderCapability["instrumentClass"],
    ...(value.priceBasis ? { priceBasis: value.priceBasis } : {}),
    timeframe: sanitizeDiagnosticText(value.timeframe),
    nativeM15: Boolean(value.nativeM15),
    entitlement: value.entitlement,
    approval: value.approval,
    allowedUsages: value.allowedUsages.filter(
      (usage) =>
        usage === "AUTHORITY" ||
        usage === "SHADOW" ||
        usage === "REFERENCE" ||
        usage === "HISTORICAL_ONLY",
    ),
    freshnessThresholdMs: finiteNumber(value.freshnessThresholdMs) ?? 0,
    minimumHistory: finiteNumber(value.minimumHistory) ?? 0,
    requiresFullSynchronization: Boolean(value.requiresFullSynchronization),
    qualityState: value.qualityState,
    structuralSuitability: value.structuralSuitability,
    technicalCapability: Boolean(value.technicalCapability),
    ...(value.authorityEligibilityReason
      ? { authorityEligibilityReason: sanitizeDiagnosticText(value.authorityEligibilityReason) }
      : {}),
  };
}

function safeMetrics(
  value: ProviderRuntimeMetrics | undefined,
): ProviderRuntimeMetrics | undefined {
  if (!value) return undefined;
  return {
    requestCount: finiteNumber(value.requestCount) ?? 0,
    cacheHitCount: finiteNumber(value.cacheHitCount) ?? 0,
    cacheMissCount: finiteNumber(value.cacheMissCount) ?? 0,
    errorCount: finiteNumber(value.errorCount) ?? 0,
    rateLimitEvents: finiteNumber(value.rateLimitEvents) ?? 0,
    reconnectCount: finiteNumber(value.reconnectCount) ?? 0,
    sourceTimestampAdvances: finiteNumber(value.sourceTimestampAdvances) ?? 0,
    ...(value.lastSourceTimestamp
      ? { lastSourceTimestamp: sanitizeDiagnosticText(value.lastSourceTimestamp) }
      : {}),
    ...(value.lastReceivedAt
      ? { lastReceivedAt: sanitizeDiagnosticText(value.lastReceivedAt) }
      : {}),
    ...(value.sourceAgeMs !== undefined ? { sourceAgeMs: finiteNumber(value.sourceAgeMs) } : {}),
    ...(value.lastStatusCode !== undefined
      ? { lastStatusCode: finiteNumber(value.lastStatusCode) }
      : {}),
    ...(value.lastError ? { lastError: sanitizeDiagnosticText(value.lastError) } : {}),
    ...(value.lastRateLimitRemaining !== undefined
      ? { lastRateLimitRemaining: finiteNumber(value.lastRateLimitRemaining) }
      : {}),
    ...(value.lastRateLimitLimit !== undefined
      ? { lastRateLimitLimit: finiteNumber(value.lastRateLimitLimit) }
      : {}),
    ...(value.lastRetryAfterMs !== undefined
      ? { lastRetryAfterMs: finiteNumber(value.lastRetryAfterMs) }
      : {}),
    ...(value.backoffUntil ? { backoffUntil: sanitizeDiagnosticText(value.backoffUntil) } : {}),
    ...(value.requestAudit
      ? {
          requestAudit: value.requestAudit.slice(-MAX_PERSISTED_REQUEST_AUDITS).map((audit) => ({
            endpoint: sanitizeDiagnosticEndpoint(audit.endpoint),
            canonicalSymbol: sanitizeDiagnosticText(audit.canonicalSymbol),
            requestTimestamp: sanitizeDiagnosticText(audit.requestTimestamp),
            ...(audit.status !== undefined ? { status: finiteNumber(audit.status) } : {}),
            ...(audit.creditsConsumed !== undefined
              ? { creditsConsumed: finiteNumber(audit.creditsConsumed) }
              : {}),
            ...(audit.creditsRemaining !== undefined
              ? { creditsRemaining: finiteNumber(audit.creditsRemaining) }
              : {}),
            cache: audit.cache,
            caller: sanitizeDiagnosticText(audit.caller),
            reason: sanitizeDiagnosticText(audit.reason),
          })),
        }
      : {}),
  };
}

function safeHealth(candidate: ProviderHealthSnapshot): ProviderHealthSnapshot {
  return {
    health: candidate.health,
    reasons: candidate.reasons
      .filter((reason): reason is string => typeof reason === "string")
      .map(sanitizeDiagnosticText),
    observedAt: finiteNumber(candidate.observedAt) ?? 0,
    ...(candidate.checks
      ? {
          checks: candidate.checks.map((check) => ({
            name: sanitizeDiagnosticText(check.name),
            passed: Boolean(check.passed),
            ...(check.reason ? { reason: sanitizeDiagnosticText(check.reason) } : {}),
            observedAt: finiteNumber(check.observedAt) ?? 0,
          })),
        }
      : {}),
    ...(candidate.metrics ? { metrics: safeMetrics(candidate.metrics) } : {}),
    ...(candidate.seriesReadiness
      ? { seriesReadiness: safeReadiness(candidate.seriesReadiness) }
      : {}),
  };
}

function safeQuality(candidate: ProviderQualityReport): ProviderQualityReport {
  return {
    ...safeHealth(candidate),
    checks: candidate.checks.map((check) => ({
      name: sanitizeDiagnosticText(check.name),
      passed: Boolean(check.passed),
      ...(check.reason ? { reason: sanitizeDiagnosticText(check.reason) } : {}),
      observedAt: finiteNumber(check.observedAt) ?? 0,
    })),
    ...(candidate.closedCandleCount !== undefined
      ? { closedCandleCount: finiteNumber(candidate.closedCandleCount) }
      : {}),
    ...(candidate.validationReason
      ? { validationReason: sanitizeDiagnosticText(candidate.validationReason) }
      : {}),
  };
}

function safeCandidate(candidate: ProviderCandidate): ProviderCandidate {
  return {
    providerId: sanitizeDiagnosticText(candidate.providerId),
    role: candidate.role,
    approval: candidate.approval,
    priority: finiteNumber(candidate.priority) ?? 0,
    health: safeHealth(candidate.health),
    quality: candidate.quality ? safeQuality(candidate.quality) : undefined,
    capability: safeCapability(candidate.capability),
    ...(candidate.capabilityReasons
      ? { capabilityReasons: candidate.capabilityReasons.map(sanitizeDiagnosticText) }
      : {}),
    ...(candidate.seriesReadiness
      ? { seriesReadiness: safeReadiness(candidate.seriesReadiness) }
      : {}),
    ...(candidate.providerSymbol
      ? { providerSymbol: sanitizeDiagnosticText(candidate.providerSymbol) }
      : {}),
    ...(candidate.instrumentClass
      ? { instrumentClass: sanitizeDiagnosticText(candidate.instrumentClass) }
      : {}),
    ...(candidate.sourceTimestamp !== undefined
      ? { sourceTimestamp: finiteNumber(candidate.sourceTimestamp) }
      : {}),
    eligible: Boolean(candidate.eligible),
  };
}

export function buildPersistedAuthorityEvidence(decision: AuthorityDecision) {
  return sanitizeDiagnosticValue({
    reason: sanitizeDiagnosticText(decision.reason),
    selected: decision.selectedProviderId,
    candidates: decision.candidates.map(safeCandidate),
  });
}
