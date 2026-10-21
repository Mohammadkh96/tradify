import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockGetJournalProductLink = jest.fn();
const mockClaimJournalProductLink = jest.fn();
const mockCustomFetch = jest.fn();
const mockUseTradify = jest.fn();

jest.mock("@workspace/api-client-react", () => ({
  getJournalProductLink: mockGetJournalProductLink,
  claimJournalProductLink: mockClaimJournalProductLink,
  customFetch: mockCustomFetch,
  previewJournalProductLink: jest.fn(),
  unlinkJournalProductLink: jest.fn(),
}));

jest.mock("@/lib/tradify-store", () => ({ useTradify: mockUseTradify }));
jest.mock("@/components/PageMetadata", () => ({ PageMetadata: () => null }));
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#0b1117",
    card: "#121b24",
    border: "#263640",
    foreground: "#e8edf2",
    mutedForeground: "#8c9ba6",
    primary: "#d2a85b",
    destructive: "#e27777",
    warning: "#d2a85b",
  }),
}));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { Feather: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock("@/components/TradifyUI", () => {
  const React = require("react");
  const { Pressable, ScrollView, Text, View } = require("react-native");
  return {
    Header: ({ title }: { title: string }) => React.createElement(Text, null, title),
    PrimaryButton: ({
      label,
      testID,
      onPress,
      disabled,
    }: {
      label: string;
      testID?: string;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        Pressable,
        { testID, onPress, disabled },
        React.createElement(Text, null, label),
      ),
    Screen: ({ children }: { children: React.ReactNode }) =>
      React.createElement(ScrollView, null, children),
    SectionTitle: ({ title }: { title: string }) => React.createElement(Text, null, title),
    SurfaceCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

const validPair = {
  state: "awaiting_signals_consent",
  journalAttemptLabel: "JRN-7M4PK2D2W3QF",
  signalsAttemptLabel: "SIG-6P7TR2K5M7WX",
  expiresAt: new Date(Date.now() + 4 * 60_000).toISOString(),
  accountLabel: "private-person@example.test",
  userId: "internal-database-id",
};

describe("Journal account-link review and consent", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseTradify.mockReturnValue({ authenticated: true });
    mockGetJournalProductLink.mockResolvedValue(validPair);
    mockClaimJournalProductLink.mockResolvedValue({ state: "awaiting_journal_confirmation" });
    mockCustomFetch.mockResolvedValue({ state: "journal_link_required" });
  });

  it("renders an unlinked account and the code input before any authorization exists", async () => {
    mockGetJournalProductLink.mockResolvedValue({ state: "unlinked" });
    const JournalLinkScreen = require("../app/journal-link").default;
    render(<JournalLinkScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("journal-link-status").props.children).toBe("Status: unlinked"),
    );
    expect(screen.getByTestId("journal-link-code")).toBeTruthy();
    expect(screen.getByTestId("journal-link-preview").props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByTestId("journal-link-consent")).toBeNull();
    expect(screen.queryByTestId("journal-link-claim")).toBeNull();
    expect(mockGetJournalProductLink).toHaveBeenCalledTimes(1);
  });

  it("keeps the account-linking screen available when the status request fails", async () => {
    mockGetJournalProductLink.mockRejectedValue(new Error("isolated API unavailable"));
    const JournalLinkScreen = require("../app/journal-link").default;
    render(<JournalLinkScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("journal-link-status").props.children).toContain(
        "Account linking is not enabled",
      ),
    );
    expect(screen.getByTestId("journal-link-code")).toBeTruthy();
    expect(screen.queryByTestId("journal-link-consent")).toBeNull();
  });

  it("shows both temporary labels, the original expiry, and only the approved limited-data consent", async () => {
    const JournalLinkScreen = require("../app/journal-link").default;
    render(<JournalLinkScreen />);

    await waitFor(() => expect(screen.getByTestId("journal-pair-label")).toBeTruthy());
    expect(screen.getByTestId("journal-pair-label").props.children).toContain(
      "JRN-7M4PK2D2W3QF",
    );
    expect(screen.getByTestId("signals-pair-label").props.children).toContain(
      "SIG-6P7TR2K5M7WX",
    );
    expect(screen.getByTestId("journal-pair-deadline").props.children.join(" ")).toContain(
      "original five-minute deadline is fixed",
    );
    expect(screen.getByText(/share only the temporary pairing labels/)).toBeTruthy();
    expect(screen.queryByText("private-person@example.test")).toBeNull();
    expect(screen.queryByText("internal-database-id")).toBeNull();
    expect(screen.queryByText(/Draft:/)).toBeNull();
    expect(screen.getByTestId("journal-link-claim").props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId("journal-link-consent"));
    expect(screen.getByTestId("journal-link-claim").props.accessibilityState.disabled).toBe(false);
  });

  it.each([
    ["a malformed pairing label", { ...validPair, signalsAttemptLabel: "SIG-invalid" }],
    ["an expired original deadline", { ...validPair, expiresAt: new Date(Date.now() - 1_000).toISOString() }],
  ])("does not show consent for %s", async (_description, pair) => {
    mockGetJournalProductLink.mockResolvedValue(pair);
    const JournalLinkScreen = require("../app/journal-link").default;
    render(<JournalLinkScreen />);

    await waitFor(() => expect(screen.getByTestId("journal-pair-invalid")).toBeTruthy());
    expect(screen.queryByTestId("journal-link-consent")).toBeNull();
    expect(screen.queryByTestId("journal-link-claim")).toBeNull();
  });

  it("requests separate account-specific feed consent only after Journal confirms the account link", async () => {
    mockGetJournalProductLink.mockResolvedValue({
      state: "active",
      linkId: "c4bb7e1f-85cd-47f3-bc94-2391f6a092db",
    });
    mockCustomFetch
      .mockResolvedValueOnce({ state: "journal_link_required" })
      .mockResolvedValueOnce({
        state: "active",
        feedId: "customer-feed-id",
        bridgeToken: "one-time-customer-token",
      });

    const JournalLinkScreen = require("../app/journal-link").default;
    render(<JournalLinkScreen />);

    await waitFor(() => expect(screen.getByTestId("customer-feed-authorize")).toBeTruthy());
    expect(mockCustomFetch).toHaveBeenCalledWith("/api/user/mt5-feed", { method: "GET" });
    fireEvent.press(screen.getByTestId("customer-feed-consent"));
    fireEvent.press(screen.getByTestId("customer-feed-authorize"));

    await waitFor(() => expect(screen.getByTestId("customer-feed-token")).toBeTruthy());
    expect(mockCustomFetch).toHaveBeenLastCalledWith(
      "/api/user/mt5-feed/consent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          consent: true,
          consentVersion: "tradify-journal-mt5-feed-consent-v1",
        }),
      }),
    );
    expect(screen.getByTestId("customer-feed-token").props.children).toContain(
      "one-time-customer-token",
    );
  });
});
