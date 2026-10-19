import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEffectiveLinkingTestDeadline,
  scheduleLinkingTestDeadline,
} from "./product-linking-test-session";

const NOW = Date.parse("2026-10-19T10:00:00.000Z");
const EARLIER = "2026-10-19T11:18:21.376Z";
const LATER = "2026-10-19T12:06:00.000Z";

function enableIsolatedLinkingTest(): void {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("DEV_PRODUCT_LINKING_ENABLED", "true");
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("isolated account-linking test-session deadline", () => {
  it("accepts equal unexpired session expirations", () => {
    enableIsolatedLinkingTest();

    expect(
      getEffectiveLinkingTestDeadline({
        journalExpiresAt: EARLIER,
        peerExpiresAt: EARLIER,
        now: NOW,
      }),
    ).toBe(Date.parse(EARLIER));
  });

  it("uses Journal's earlier expiry", () => {
    enableIsolatedLinkingTest();

    expect(
      getEffectiveLinkingTestDeadline({
        journalExpiresAt: EARLIER,
        peerExpiresAt: LATER,
        now: NOW,
      }),
    ).toBe(Date.parse(EARLIER));
  });

  it("uses the peer's earlier expiry", () => {
    enableIsolatedLinkingTest();

    expect(
      getEffectiveLinkingTestDeadline({
        journalExpiresAt: LATER,
        peerExpiresAt: EARLIER,
        now: NOW,
      }),
    ).toBe(Date.parse(EARLIER));
  });

  it("rejects an already-expired peer session", () => {
    enableIsolatedLinkingTest();

    expect(() =>
      getEffectiveLinkingTestDeadline({
        journalExpiresAt: LATER,
        peerExpiresAt: "2026-10-19T09:59:59.999Z",
        now: NOW,
      }),
    ).toThrow(/both linking test sessions must be unexpired/i);
  });

  it("rejects missing and malformed expiry values", () => {
    enableIsolatedLinkingTest();

    expect(() =>
      getEffectiveLinkingTestDeadline({
        journalExpiresAt: LATER,
        peerExpiresAt: undefined,
        now: NOW,
      }),
    ).toThrow(/peer expiry must be a UTC ISO-8601 timestamp/i);

    expect(() =>
      getEffectiveLinkingTestDeadline({
        journalExpiresAt: LATER,
        peerExpiresAt: "2026-02-30T11:00:00.000Z",
        now: NOW,
      }),
    ).toThrow(/valid UTC calendar timestamp/i);
  });

  it("stops the test runtime at the earlier effective deadline", async () => {
    enableIsolatedLinkingTest();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const deadline = getEffectiveLinkingTestDeadline({
      journalExpiresAt: LATER,
      peerExpiresAt: EARLIER,
    });
    const onDeadline = vi.fn();
    scheduleLinkingTestDeadline(deadline, onDeadline);

    await vi.advanceTimersByTimeAsync(deadline - NOW - 1);
    expect(onDeadline).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onDeadline).toHaveBeenCalledOnce();
  });

  it("refuses to run outside the isolated development/test gate", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DEV_PRODUCT_LINKING_ENABLED", "true");

    expect(() =>
      getEffectiveLinkingTestDeadline({
        journalExpiresAt: LATER,
        peerExpiresAt: EARLIER,
        now: NOW,
      }),
    ).toThrow(/require isolated development linking/i);
  });
});
