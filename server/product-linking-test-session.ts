const UTC_ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

type EffectiveDeadlineInput = {
  journalExpiresAt: unknown;
  peerExpiresAt: unknown;
  now?: number;
};

function assertIsolatedDevelopmentBootstrap(): void {
  const isolatedRuntime =
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    process.env.APP_ENV !== "production" &&
    process.env.DEV_PRODUCT_LINKING_ENABLED === "true";

  if (!isolatedRuntime) {
    throw new Error("Test-session deadlines require isolated development linking.");
  }
}

function parseExpiry(value: unknown, label: string): number {
  if (typeof value !== "string" || !UTC_ISO_TIMESTAMP.test(value)) {
    throw new Error(`${label} must be a UTC ISO-8601 timestamp.`);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be a valid timestamp.`);
  }

  const canonicalTimestamp = new Date(timestamp).toISOString();
  if (
    value !== canonicalTimestamp &&
    value !== canonicalTimestamp.replace(/\.000Z$/, "Z")
  ) {
    throw new Error(`${label} must be a valid UTC calendar timestamp.`);
  }

  return timestamp;
}

export function getEffectiveLinkingTestDeadline({
  journalExpiresAt,
  peerExpiresAt,
  now = Date.now(),
}: EffectiveDeadlineInput): number {
  assertIsolatedDevelopmentBootstrap();

  if (!Number.isFinite(now)) {
    throw new Error("Current time must be a valid timestamp.");
  }

  const journalDeadline = parseExpiry(journalExpiresAt, "Journal expiry");
  const peerDeadline = parseExpiry(peerExpiresAt, "Peer expiry");

  if (journalDeadline <= now || peerDeadline <= now) {
    throw new Error("Both linking test sessions must be unexpired.");
  }

  return Math.min(journalDeadline, peerDeadline);
}

export function scheduleLinkingTestDeadline(
  deadline: number,
  onDeadline: () => void,
): () => void {
  assertIsolatedDevelopmentBootstrap();

  if (!Number.isSafeInteger(deadline) || deadline <= Date.now()) {
    throw new Error("Effective linking test deadline must be a future timestamp.");
  }

  const timer = setTimeout(onDeadline, deadline - Date.now());
  return () => clearTimeout(timer);
}
