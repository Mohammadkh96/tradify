import React from "react";
import { Dimensions } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

const mockUseTradify = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock("@/lib/tradify-store", () => ({ useTradify: mockUseTradify }));
jest.mock("expo-router", () => ({
  router: {
    back: mockRouterBack,
    push: mockRouterPush,
  },
  useLocalSearchParams: mockUseLocalSearchParams,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { Feather: ({ name }: { name: string }) => <Text>{name}</Text> };
});

const completeOnboarding = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  completeOnboarding.mockReset();
  mockUseLocalSearchParams.mockReturnValue({});
  mockUseTradify.mockReturnValue({ completeOnboarding });
});

function renderOnboarding(params: Record<string, string> = {}) {
  mockUseLocalSearchParams.mockReturnValue(params);
  const OnboardingScreen = require("../app/onboarding").default;
  return render(<OnboardingScreen />);
}

describe("onboarding intro", () => {
  it("keeps Continue and page indicators on the same selected page", () => {
    renderOnboarding();
    expect(screen.getByTestId("onboarding-dot-0").props.accessibilityState.selected).toBe(true);

    fireEvent.press(screen.getByTestId("onboarding-next"));
    expect(screen.getByTestId("onboarding-dot-1").props.accessibilityState.selected).toBe(true);

    fireEvent.press(screen.getByTestId("onboarding-dot-2"));
    expect(screen.getByTestId("onboarding-dot-2").props.accessibilityState.selected).toBe(true);
  });

  it("updates the selected page after a swipe settles", () => {
    renderOnboarding();
    const pager = screen.getByTestId("onboarding-pager");
    const width = Dimensions.get("window").width;

    fireEvent(pager, "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: width, y: 0 } },
    });

    expect(screen.getByTestId("onboarding-dot-1").props.accessibilityState.selected).toBe(true);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("opens registration from the last page only when its CTA is pressed", () => {
    renderOnboarding();
    fireEvent.press(screen.getByTestId("onboarding-dot-2"));

    fireEvent(screen.getByTestId("onboarding-pager"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: Dimensions.get("window").width * 2, y: 0 } },
    });
    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("onboarding-next"));

    expect(completeOnboarding).toHaveBeenCalledWith(true);
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/auth",
      params: { mode: "register", returnTo: "feed" },
    });
  });

  it("returns to Profile when a replay is skipped", () => {
    renderOnboarding({ returnTo: "profile" });
    fireEvent.press(screen.getByTestId("onboarding-skip"));

    expect(completeOnboarding).toHaveBeenCalledWith(true);
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("opens sign-in from Skip on a first-run intro", () => {
    renderOnboarding();
    fireEvent.press(screen.getByTestId("onboarding-skip"));

    expect(completeOnboarding).toHaveBeenCalledWith(true);
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/auth",
      params: { mode: "signin", returnTo: "feed" },
    });
  });

  it("marks onboarding complete and opens sign-in from every page", () => {
    renderOnboarding();
    fireEvent.press(screen.getByTestId("onboarding-login"));

    expect(completeOnboarding).toHaveBeenCalledWith(true);
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: "/auth",
      params: { mode: "signin", returnTo: "feed" },
    });
  });

  it("keeps onboarding copy readable and narration labels intact at large text sizes", () => {
    const originalWindow = Dimensions.get("window");
    const originalScreen = Dimensions.get("screen");
    Dimensions.set({
      window: { ...originalWindow, width: 360, height: 740, fontScale: 2 },
      screen: { ...originalScreen, width: 360, height: 740, fontScale: 2 },
    });

    let rendered: ReturnType<typeof render> | undefined;
    try {
      rendered = renderOnboarding();

      expect(
        screen.getAllByTestId("onboarding-illustration")[0].props.accessibilityLabel,
      ).toContain("Example gold setup");
      expect(
        screen.getByText(
          "A focused feed shows market setups and clearly labels their data status.",
        ),
      ).toBeTruthy();
      expect(screen.getByText("Risk plan example")).toBeTruthy();
      expect(
        screen.getByText(
          "Example only: $10,000 account, 1% risk ($100), entry $2,400, stop $2,385, target $2,430, and 2:1 gross reward to risk before costs.",
        ),
      ).toBeTruthy();
      expect(screen.getByTestId("onboarding-next").props.accessibilityLabel).toBe(
        "Continue to next introduction page",
      );
      expect(screen.getByTestId("onboarding-login").props.accessibilityLabel).toBe("Log in");
      expect(screen.getByTestId("onboarding-pager").props.accessibilityValue).toMatchObject({
        min: 1,
        max: 3,
        now: 1,
      });
    } finally {
      rendered?.unmount();
      Dimensions.set({ window: originalWindow, screen: originalScreen });
    }
  });
});
