import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEffectiveTestDeadline,
  createSignalsSessionExpiry,
  enforceDeadline,
  isSupportedJournalTestKid,
  MAX_LINK_TEST_SESSION_MS,
} from "./isolated-link-test-session.mjs";

const NOW = Date.parse("2026-10-19T12:00:00.000Z");
const iso = (offset) => new Date(NOW + offset).toISOString();

test("Journal test key IDs accept both supported test prefixes only", () => {
  assert.equal(
    isSupportedJournalTestKid("journal-dev-20261020-b2735d259a7b088b3fdab2b31c0d536f"),
    true,
  );
  assert.equal(
    isSupportedJournalTestKid("journal-link-test-20261019T103948Z-4424898016c6a893"),
    true,
  );
  assert.equal(
    isSupportedJournalTestKid("jrn-dev-ac1f38ec80f33e79a3c8d0bdd27c89fc"),
    true,
  );
  assert.equal(isSupportedJournalTestKid("journal-production-key-1234567890"), false);
  assert.equal(isSupportedJournalTestKid("journal-dev-short"), false);
});

test("equal signer expirations yield the shared deadline", () => {
  assert.equal(
    calculateEffectiveTestDeadline({
      signalsExpiresAt: iso(60_000),
      journalExpiresAt: iso(60_000),
      now: NOW,
    }),
    NOW + 60_000,
  );
});

test("different signer expirations use the earlier deadline", () => {
  assert.equal(
    calculateEffectiveTestDeadline({
      signalsExpiresAt: iso(120_000),
      journalExpiresAt: iso(45_000),
      now: NOW,
    }),
    NOW + 45_000,
  );
  assert.equal(
    calculateEffectiveTestDeadline({
      signalsExpiresAt: iso(45_000),
      journalExpiresAt: iso(120_000),
      now: NOW,
    }),
    NOW + 45_000,
  );
});

test("expired, invalid, missing, and over-limit peer expirations are rejected", () => {
  for (const [field, value] of [
    ["journalExpiresAt", iso(0)],
    ["journalExpiresAt", "not-a-date"],
    ["journalExpiresAt", undefined],
    ["journalExpiresAt", iso(MAX_LINK_TEST_SESSION_MS + 1)],
    ["signalsExpiresAt", iso(0)],
    ["signalsExpiresAt", "not-a-date"],
    ["signalsExpiresAt", undefined],
    ["signalsExpiresAt", iso(MAX_LINK_TEST_SESSION_MS + 1)],
  ]) {
    const expiries = {
      signalsExpiresAt: iso(60_000),
      journalExpiresAt: iso(60_000),
      now: NOW,
      [field]: value,
    };
    assert.throws(() => calculateEffectiveTestDeadline(expiries), /Signals|Journal/);
  }
});

test("duration is configurable but capped at three hours", () => {
  assert.equal(
    createSignalsSessionExpiry(NOW, 180),
    new Date(NOW + MAX_LINK_TEST_SESSION_MS).toISOString(),
  );
  assert.throws(() => createSignalsSessionExpiry(NOW, 181), /180 minutes/);
  assert.throws(() => createSignalsSessionExpiry(NOW, 0), /180 minutes/);
});

test("deadline enforcement invokes cleanup when the actual deadline arrives", async () => {
  let fired = false;
  await new Promise((resolve) => {
    enforceDeadline(Date.now() + 30, () => {
      fired = true;
      resolve();
    });
  });
  assert.equal(fired, true);
});
