import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockUseTradify = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/lib/tradify-store", () => ({ useTradify: mockUseTradify }));
jest.mock("expo-router", () => ({
  router: { push: mockRouterPush, replace: mockRouterReplace },
}));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { Feather: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#0b1117",
    card: "#121b24",
    border: "#263640",
    foreground: "#e8edf2",
    mutedForeground: "#8c9ba6",
    primary: "#d2a85b",
    primaryForeground: "#11161b",
    secondary: "#1a2730",
    destructive: "#e27777",
    warning: "#d2a85b",
    success: "#72c5a8",
  }),
}));
jest.mock("@/components/TradifyUI", () => {
  const React = require("react");
  const { Pressable, ScrollView, Text, View } = require("react-native");
  return {
    Header: ({ title }: { title: string }) => React.createElement(Text, null, title),
    ModalSheet: () => null,
    PrimaryButton: () => null,
    Screen: ({ children }: { children: React.ReactNode }) =>
      React.createElement(ScrollView, null, children),
    SectionTitle: ({ title }: { title: string }) => React.createElement(Text, null, title),
    SecondaryButton: () => null,
    StatusPill: ({ label }: { label: string }) => React.createElement(Text, null, label),
    SurfaceCard: ({
      children,
      testID,
      style,
      onPress,
    }: {
      children?: React.ReactNode;
      testID?: string;
      style?: unknown;
      onPress?: () => void;
    }) =>
      onPress
        ? React.createElement(Pressable, { testID, style, onPress }, children)
        : React.createElement(View, { testID, style }, children),
  };
});

describe("mobile profile session controls", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockUseTradify.mockReturnValue({
      authenticated: true,
      profile: {
        name: "Admin User",
        email: "admin@example.test",
        riskPercent: 0.5,
        maxTrades: 3,
        membership: "VIP",
        role: "admin",
      },
      mt5Connected: false,
      authTokenPersistenceState: "saved",
      retryAuthTokenPersistence: jest.fn(),
      signOut: mockSignOut,
      deleteAccount: jest.fn(),
    });
  });

  it("shows a direct logout action for Admin accounts and signs them out", async () => {
    const ProfileScreen = require("../app/(tabs)/profile").default;
    render(<ProfileScreen />);

    expect(screen.getByText("Log out")).toBeTruthy();
    expect(screen.queryByText("ADMINISTRATOR")).toBeNull();

    fireEvent.press(screen.getByTestId("profile-logout"));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockRouterReplace).toHaveBeenCalledWith("/auth");
  });

  it("shows Journal as a non-interactive product with separate account access", () => {
    const ProfileScreen = require("../app/(tabs)/profile").default;
    render(<ProfileScreen />);

    expect(screen.getByText("Tradify Products")).toBeTruthy();
    expect(screen.getByText("Tradify Journal")).toBeTruthy();
    expect(screen.getByText("A trading journal for recording and reviewing activity.")).toBeTruthy();
    expect(
      screen.getByText("Sign in to Journal and Signals separately. Accounts and subscriptions are separate."),
    ).toBeTruthy();
    expect(screen.getByText("Destination pending confirmation")).toBeTruthy();

    const journalRow = screen.getByTestId("profile-journal-row");
    expect(journalRow.props.onPress).toBeUndefined();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("opens the account-link review route from the pending Journal destination", () => {
    const ProfileScreen = require("../app/(tabs)/profile").default;
    render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId("profile-manage-journal-link"));

    expect(mockRouterPush).toHaveBeenCalledWith("/journal-link");
  });
});
