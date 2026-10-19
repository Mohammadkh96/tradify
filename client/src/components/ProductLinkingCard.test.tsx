import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductLinkingCard } from "./ProductLinkingCard";

const mockState = vi.hoisted(() => ({
  queries: {} as Record<string, any>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((options: { queryKey: unknown[] }) =>
    mockState.queries[String(options.queryKey[1])] ?? {},
  ),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key.replace(/^profile\./, ""),
    i18n: { language: "en", resolvedLanguage: "en" },
  }),
}));

function renderCard(status: Record<string, unknown>, enabled = true): string {
  mockState.queries = {
    configuration: { data: { enabled }, isLoading: false },
    status: { data: status, isLoading: false, isError: false, error: null, isFetching: false },
    csrf: { data: { csrfToken: "synthetic-csrf" }, isLoading: false, isError: false, error: null },
  };
  return renderToStaticMarkup(<ProductLinkingCard />);
}

describe("ProductLinkingCard", () => {
  beforeEach(() => {
    mockState.queries = {};
  });

  it("renders no linking UI while the server configuration is disabled", () => {
    expect(renderCard({ state: "unlinked" }, false)).toBe("");
  });

  it("shows the approved disclosure and requires initiation consent before starting", () => {
    const html = renderCard({ state: "unlinked" });

    expect(html).toContain("productLinkStateNotConnected");
    expect(html).toContain("productLinkJournalAccount");
    expect(html).toContain("productLinkConsentDisclosure");
    expect(html).toContain("productLinkInitiationConsent");
    expect(html).toContain("productLinkStart");
    expect(html).toContain("disabled=\"\"");
  });

  it("shows both generic account labels, both pairing labels, and the original expiry for review", () => {
    const html = renderCard({
      state: "awaiting_journal_confirmation",
      linkId: "synthetic-link-id",
      journalAttemptLabel: "JRN-ABCDEFG2345",
      signalsAttemptLabel: "SIG-HJKLMN6789PQ",
      expiresAt: "2026-10-19T08:00:00.000Z",
    });

    expect(html).toContain("productLinkStatePending");
    expect(html).toContain("productLinkPairReviewTitle");
    expect(html).toContain("productLinkPairReviewDescription");
    expect(html).toContain("productLinkJournalAccount");
    expect(html).toContain("productLinkSignalsAccount");
    expect(html).toContain("JRN-ABCDEFG2345");
    expect(html).toContain("SIG-HJKLMN6789PQ");
    expect(html).toContain("productLinkExpiresAt");
    expect(html).toContain("disabled=\"\"");
  });

  it("shows connected and revocation-pending states accurately", () => {
    const connected = renderCard({
      state: "active",
      linkId: "synthetic-link-id",
      journalAttemptLabel: "JRN-ABCDEFG2345",
      signalsAttemptLabel: "SIG-HJKLMN6789PQ",
    });
    const revocationPending = renderCard({ state: "revocation_pending", linkId: "synthetic-link-id" });

    expect(connected).toContain("productLinkActive");
    expect(revocationPending).toContain("productLinkDisconnectPending");
  });

  it("distinguishes disconnected and expired authorization states", () => {
    const disconnected = renderCard({ state: "revoked" });
    const expired = renderCard({ state: "expired" });

    expect(disconnected).toContain("productLinkStateDisconnected");
    expect(expired).toContain("productLinkStateNotConnected");
    expect(expired).toContain("productLinkExpired");
  });
});
