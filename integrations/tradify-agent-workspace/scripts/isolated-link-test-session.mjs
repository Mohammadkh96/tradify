export const MAX_LINK_TEST_SESSION_MS = 3 * 60 * 60 * 1000;
export const DEFAULT_LINK_TEST_SESSION_MINUTES = 60;

export function isSupportedJournalTestKid(value) {
  return (
    typeof value === "string" &&
    /^(?:journal-link-test|journal-dev|jrn-dev)-[A-Za-z0-9-]{8,100}$/.test(value)
  );
}

export function createSignalsSessionExpiry(
  now = Date.now(),
  durationMinutes = DEFAULT_LINK_TEST_SESSION_MINUTES,
) {
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > MAX_LINK_TEST_SESSION_MS / 60_000
  ) {
    throw new Error("Signals test-session duration must be between 1 and 180 minutes.");
  }
  return new Date(now + durationMinutes * 60_000).toISOString();
}

function parseFutureExpiry(value, name, now, maxExpiryMs) {
  if (typeof value !== "string") throw new Error(`${name} expiry is missing or invalid.`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`${name} expiry is missing or invalid.`);
  }
  if (timestamp <= now) throw new Error(`${name} signer has expired.`);
  if (timestamp > maxExpiryMs) throw new Error(`${name} expiry exceeds the three-hour limit.`);
  return timestamp;
}

export function calculateEffectiveTestDeadline({
  signalsExpiresAt,
  journalExpiresAt,
  now = Date.now(),
}) {
  const maxExpiryMs = now + MAX_LINK_TEST_SESSION_MS;
  const signalsExpiryMs = parseFutureExpiry(signalsExpiresAt, "Signals", now, maxExpiryMs);
  const journalExpiryMs = parseFutureExpiry(journalExpiresAt, "Journal", now, maxExpiryMs);
  return Math.min(signalsExpiryMs, journalExpiryMs);
}

export function enforceDeadline(deadlineMs, onDeadline, now = Date.now()) {
  if (!Number.isFinite(deadlineMs) || deadlineMs <= now) {
    throw new Error("Test-session deadline must be in the future.");
  }
  const timer = setTimeout(onDeadline, deadlineMs - now);
  timer.unref?.();
  return () => clearTimeout(timer);
}
