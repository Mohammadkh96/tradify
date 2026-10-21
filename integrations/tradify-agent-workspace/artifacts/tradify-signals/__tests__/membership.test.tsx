import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ApiError } from "@workspace/api-client-react";
import {
  DEFAULT_ACCESS_POLICY,
  hasMembershipFeature,
  membershipMeetsTier,
  membershipMarketCounts,
  membershipPlansFor,
} from "@/constants/membership";

const mockUseTradify = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockRetryBillingRecovery = jest.fn();

jest.mock("@/lib/tradify-store", () => ({ useTradify: mockUseTradify }));
jest.mock("@/lib/revenuecat", () => ({
  useSubscription: () => ({
    available: true,
    loading: false,
    purchasing: false,
    priceFor: (tier: string) => (tier === "VIP" ? "$149" : "$49"),
    purchase: mockPurchase,
    restore: mockRestore,
  }),
}));
jest.mock("expo-router", () => ({ router: { back: mockRouterBack, push: mockRouterPush } }));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { Feather: ({ name }: { name: string }) => <Text>{name}</Text> };
});
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    accent: "#233a43",
    background: "#0b1117",
    card: "#121b24",
    border: "#263640",
    foreground: "#e8edf2",
    mutedForeground: "#8c9ba6",
    primary: "#d2a85b",
    primaryForeground: "#11161b",
    secondary: "#1a2730",
    secondaryForeground: "#c3e6dd",
    chart: "#76a8d6",
    success: "#72c5a8",
    warning: "#d2a85b",
  }),
}));
jest.mock("@/components/TradifyUI", () => {
  const React = require("react");
  const { ScrollView, Text, View } = require("react-native");
  return {
    Header: ({ title }: { title: string }) => <Text>{title}</Text>,
    Screen: ({ children }: { children: React.ReactNode }) => <ScrollView>{children}</ScrollView>,
  };
});

const billingError = (code: string) =>
  Object.assign(Object.create(ApiError.prototype), { data: { error: code } });

describe("membership plans", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseTradify.mockReturnValue({
      profile: { membership: "Free" },
      accessPolicy: DEFAULT_ACCESS_POLICY,
      billingStatus: "INACTIVE",
      billingExpiresAt: null,
      billingRecovery: null,
      retryBillingRecovery: mockRetryBillingRecovery,
      syncMembershipStatus: jest.fn().mockResolvedValue(undefined),
    });
    mockPurchase.mockResolvedValue(undefined);
    mockRestore.mockResolvedValue(undefined);
    mockRetryBillingRecovery.mockResolvedValue("recovered");
  });

  it("keeps mobile feature entitlements aligned with Free, Pro, and VIP boundaries", () => {
    expect(hasMembershipFeature("Free", "signalContext")).toBe(false);
    expect(hasMembershipFeature("Free", "priceAlerts")).toBe(false);
    expect(hasMembershipFeature("Free", "performanceContext")).toBe(false);
    expect(hasMembershipFeature("Pro", "signalContext")).toBe(true);
    expect(hasMembershipFeature("Pro", "trustedSetupLevels")).toBe(true);
    expect(membershipMeetsTier("Pro", "Free")).toBe(true);
    expect(membershipMeetsTier("Pro", "VIP")).toBe(false);
  });

  it("applies shared feature, market, and watchlist rules to mobile access and plan copy", () => {
    const policy = {
      ...DEFAULT_ACCESS_POLICY,
      rowVersion: 12,
      featureMinimumTiers: {
        ...DEFAULT_ACCESS_POLICY.featureMinimumTiers,
        priceAlerts: "Free" as const,
        performanceContext: "VIP" as const,
      },
      marketTiers: { ...DEFAULT_ACCESS_POLICY.marketTiers, EURUSD: "Free" as const },
      watchlistLimits: { Free: 5, Pro: 40, VIP: null },
    };

    expect(hasMembershipFeature("Free", "priceAlerts", policy)).toBe(true);
    expect(hasMembershipFeature("Pro", "performanceContext", policy)).toBe(false);
    expect(hasMembershipFeature("VIP", "performanceContext", policy)).toBe(true);

    const freePlan = membershipPlansFor(policy).find((plan) => plan.id === "Free");
    const vipPlan = membershipPlansFor(policy).find((plan) => plan.id === "VIP");
    expect(freePlan?.description).toContain("5-market watchlist");
    expect(
      freePlan?.benefits.some((benefit) => benefit.label === "4 configured Free-tier markets"),
    ).toBe(true);
    expect(
      vipPlan?.benefits.find((benefit) => benefit.label === "Full-depth setup review"),
    ).toMatchObject({
      included: false,
      detail: "Not available in the customer app yet",
    });
  });

  it("keeps baseline market coverage totals accurate before the shared policy loads", () => {
    expect(membershipMarketCounts(DEFAULT_ACCESS_POLICY)).toEqual({
      free: 3,
      pro: 19,
      vip: 61,
      total: 83,
    });
  });

  it("presents Free, Pro, and VIP with the selected plan details", () => {
    const MembershipScreen = require("../app/membership").default;
    render(<MembershipScreen />);

    expect(screen.getByText("Signal Studio")).toBeTruthy();
    expect(screen.getByTestId("membership-plan-free")).toBeTruthy();
    expect(screen.getByTestId("membership-plan-pro")).toBeTruthy();
    expect(screen.getByTestId("membership-plan-vip")).toBeTruthy();
    expect(screen.getByText("Trusted setup levels")).toBeTruthy();
    expect(screen.getByText("30-day performance context")).toBeTruthy();
  });

  it("lets a trader select VIP and syncs that tier", async () => {
    const MembershipScreen = require("../app/membership").default;
    render(<MembershipScreen />);

    fireEvent.press(screen.getByTestId("membership-plan-vip"));
    fireEvent.press(screen.getByTestId("upgrade-membership"));
    expect(mockPurchase).not.toHaveBeenCalled();
    expect(screen.getByTestId("membership-plan-free")).toBeTruthy();

    fireEvent.press(screen.getByTestId("confirm-membership-purchase"));
    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith("VIP"));
    expect(screen.getByTestId("membership-notice")).toBeTruthy();
    expect(screen.getByText(/VIP is active after billing confirmation/)).toBeTruthy();
  });

  it("shows provider-deferred recovery without implying paid access and offers a retry", async () => {
    const syncMembershipStatus = jest.fn().mockResolvedValue(undefined);
    mockUseTradify.mockReturnValue({
      profile: { membership: "Free" },
      billingStatus: "INACTIVE",
      billingExpiresAt: null,
      billingRecovery: "provider-deferred",
      retryBillingRecovery: mockRetryBillingRecovery,
      syncMembershipStatus,
    });
    mockRetryBillingRecovery.mockResolvedValue("provider-deferred");
    const MembershipScreen = require("../app/membership").default;
    render(<MembershipScreen />);

    expect(screen.getByTestId("billing-recovery-status")).toBeTruthy();
    expect(screen.getByText(/waiting for provider access/)).toBeTruthy();
    expect(screen.getByText(/no paid access has been added yet/)).toBeTruthy();

    fireEvent.press(screen.getByTestId("retry-billing-recovery"));
    await waitFor(() => expect(mockRetryBillingRecovery).toHaveBeenCalledTimes(1));
    expect(syncMembershipStatus).not.toHaveBeenCalled();
    expect(screen.getByText(/still unavailable/)).toBeTruthy();
  });

  it("explains that an authorization failure requires signing in again", async () => {
    mockPurchase.mockRejectedValueOnce(billingError("AUTH_REQUIRED"));
    const MembershipScreen = require("../app/membership").default;
    render(<MembershipScreen />);

    fireEvent.press(screen.getByTestId("upgrade-membership"));
    fireEvent.press(screen.getByTestId("confirm-membership-purchase"));

    await waitFor(() =>
      expect(screen.getByText(/Sign in again to verify your membership/)).toBeTruthy(),
    );
    expect(screen.getByTestId("billing-sign-in")).toBeTruthy();
    expect(screen.queryByTestId("retry-billing-sync")).toBeNull();
    fireEvent.press(screen.getByTestId("billing-sign-in"));
    expect(mockRouterPush).toHaveBeenCalledWith("/auth");
  });

  it("explains suspension without offering a retry that cannot help", async () => {
    mockPurchase.mockRejectedValueOnce(billingError("USER_SUSPENDED"));
    const MembershipScreen = require("../app/membership").default;
    render(<MembershipScreen />);

    fireEvent.press(screen.getByTestId("upgrade-membership"));
    fireEvent.press(screen.getByTestId("confirm-membership-purchase"));

    await waitFor(() => expect(screen.getByText(/account is suspended/)).toBeTruthy());
    expect(screen.queryByTestId("billing-sign-in")).toBeNull();
    expect(screen.queryByTestId("retry-billing-sync")).toBeNull();
  });

  it("offers a safe sync retry for temporary billing failures without purchasing again", async () => {
    const syncMembershipStatus = jest
      .fn()
      .mockRejectedValueOnce(billingError("BILLING_WEBHOOK_RETRY"))
      .mockResolvedValueOnce(undefined);
    mockUseTradify.mockReturnValue({
      profile: { membership: "Free" },
      billingStatus: "INACTIVE",
      billingExpiresAt: null,
      billingRecovery: null,
      retryBillingRecovery: mockRetryBillingRecovery,
      syncMembershipStatus,
    });
    mockPurchase.mockResolvedValueOnce(undefined);
    const MembershipScreen = require("../app/membership").default;
    render(<MembershipScreen />);

    fireEvent.press(screen.getByTestId("upgrade-membership"));
    fireEvent.press(screen.getByTestId("confirm-membership-purchase"));

    await waitFor(() => expect(screen.getByTestId("retry-billing-sync")).toBeTruthy());
    expect(mockPurchase).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId("retry-billing-sync"));
    await waitFor(() =>
      expect(screen.getByText(/plan now reflects server confirmation/)).toBeTruthy(),
    );
    expect(syncMembershipStatus).toHaveBeenCalledTimes(2);
    expect(mockPurchase).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["recovered", /recovery completed and your plan reflects server confirmation/],
    ["already-recovered", /recovery was already complete/],
  ] as const)("shows the %s recovery outcome", (recovery, copy) => {
    mockUseTradify.mockReturnValue({
      profile: { membership: "Free" },
      billingStatus: "INACTIVE",
      billingExpiresAt: null,
      billingRecovery: recovery,
      retryBillingRecovery: mockRetryBillingRecovery,
      syncMembershipStatus: jest.fn().mockResolvedValue(undefined),
    });
    const MembershipScreen = require("../app/membership").default;
    render(<MembershipScreen />);

    expect(screen.getByTestId("billing-recovery-status")).toBeTruthy();
    expect(screen.getByText(copy)).toBeTruthy();
  });
});
