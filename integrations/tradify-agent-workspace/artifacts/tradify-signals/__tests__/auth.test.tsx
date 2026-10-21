import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

const mockUseTradify = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterDismissAll = jest.fn();
const mockRouterCanGoBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockRequestPasswordReset = jest.fn();
const mockUseRequestPasswordReset = jest.fn();

jest.mock("@/lib/tradify-store", () => ({ useTradify: mockUseTradify }));
jest.mock("@workspace/api-client-react", () => ({
  useRequestPasswordReset: mockUseRequestPasswordReset,
}));
jest.mock("expo-router", () => ({
  router: {
    back: mockRouterBack,
    push: mockRouterPush,
    replace: mockRouterReplace,
    dismissAll: mockRouterDismissAll,
    canGoBack: mockRouterCanGoBack,
  },
  useLocalSearchParams: mockUseLocalSearchParams,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/components/KeyboardAwareScrollViewCompat", () => {
  const React = require("react");
  const { ScrollView } = require("react-native");
  return {
    KeyboardAwareScrollViewCompat: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <ScrollView {...props}>{children}</ScrollView>
    ),
  };
});
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { Feather: ({ name }: { name: string }) => <Text>{name}</Text> };
});

let currentStore: {
  hydrated: boolean;
  authenticated: boolean;
  billingRecovery: string | null;
  signIn: jest.Mock;
  register: jest.Mock;
  signOut: jest.Mock;
};

function renderAuth(params: Record<string, string> = {}) {
  mockUseLocalSearchParams.mockReturnValue(params);
  const AuthScreen = require("../app/auth").default;
  return render(<AuthScreen />);
}

function fillSignInForm() {
  fireEvent.changeText(screen.getByTestId("auth-email"), "trader@example.com");
  fireEvent.changeText(screen.getByTestId("auth-password"), "valid-pass");
}

function fillRegistrationForm() {
  fireEvent.changeText(screen.getByTestId("auth-display-name"), "Alex Trader");
  fireEvent.changeText(screen.getByTestId("auth-email"), "trader@example.com");
  fireEvent.changeText(screen.getByTestId("auth-password"), "valid-pass");
  fireEvent.press(screen.getByTestId("auth-consent"));
}

beforeEach(() => {
  jest.resetAllMocks();
  mockRequestPasswordReset.mockResolvedValue({ ok: true });
  mockUseRequestPasswordReset.mockReturnValue({ mutateAsync: mockRequestPasswordReset });
  mockRouterCanGoBack.mockReturnValue(true);
  mockUseLocalSearchParams.mockReturnValue({});
  currentStore = {
    hydrated: true,
    authenticated: false,
    billingRecovery: null,
    signIn: jest.fn().mockResolvedValue("user"),
    register: jest.fn().mockResolvedValue({ role: "user", recovery: "already-recovered" }),
    signOut: jest.fn().mockResolvedValue(undefined),
  };
  mockUseTradify.mockReturnValue(currentStore);
});

describe("native account entry", () => {
  it("opens directly in registration when the public registration route selects it", () => {
    const AuthScreen = require("../app/auth").default;
    render(<AuthScreen initialMode="register" />);

    expect(screen.getByTestId("auth-display-name")).toBeTruthy();
    expect(screen.getByText("Already have an account?")).toBeTruthy();
  });

  it("applies a registration URL mode that arrives after the screen first renders", () => {
    const AuthScreen = require("../app/auth").default;
    mockUseLocalSearchParams.mockReturnValue({});
    const view = render(<AuthScreen />);
    expect(screen.queryByTestId("auth-display-name")).toBeNull();

    mockUseLocalSearchParams.mockReturnValue({ mode: "register" });
    view.rerender(<AuthScreen />);

    expect(screen.getByTestId("auth-display-name")).toBeTruthy();
  });

  it("requests a password reset without revealing whether the email has an account", async () => {
    renderAuth();
    fireEvent.changeText(screen.getByTestId("auth-email"), "trader@example.com");

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-forgot-password"));
      await Promise.resolve();
    });

    expect(mockRequestPasswordReset).toHaveBeenCalledWith({
      data: { email: "trader@example.com" },
    });
    expect(screen.getByTestId("auth-reset-status").props.children).toMatch(
      /If an active account matches that email/i,
    );
  });

  it("validates the recovery email before sending a reset request", async () => {
    renderAuth();

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-forgot-password"));
    });

    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
  });

  it("routes an administrator to the customer profile after the server confirms the role", async () => {
    currentStore.signIn.mockResolvedValue("admin");
    renderAuth();
    fillSignInForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-submit"));
    });

    expect(currentStore.signIn).toHaveBeenCalledWith("trader@example.com", "valid-pass");
    expect(mockRouterDismissAll).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledWith("/profile");
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it("sends legacy Operations return targets to the customer profile", async () => {
    renderAuth({ returnTo: "admin" });
    expect(screen.getByTestId("auth-register-link")).toBeTruthy();
    expect(screen.queryByText(/Operations is reserved/)).toBeNull();
    fillSignInForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-submit"));
    });

    expect(currentStore.signOut).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith("/profile");
  });

  it("submits the display name through the existing post-registration profile flow", async () => {
    renderAuth();
    fireEvent.press(screen.getByTestId("auth-register-link"));
    fillRegistrationForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-submit"));
    });

    expect(currentStore.register).toHaveBeenCalledWith(
      "trader@example.com",
      "valid-pass",
      "Alex Trader",
    );
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("does not submit registration until the local consent control is checked", async () => {
    renderAuth({ mode: "register" });
    expect(screen.getByTestId("auth-password").props.value).toBe("");
    fireEvent.changeText(screen.getByTestId("auth-display-name"), "Alex Trader");
    fireEvent.changeText(screen.getByTestId("auth-email"), "trader@example.com");
    fireEvent.changeText(screen.getByTestId("auth-password"), "valid-pass");

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-submit"));
    });

    expect(currentStore.register).not.toHaveBeenCalled();
    expect(screen.getByText(/confirm your consent/)).toBeTruthy();
  });

  it("routes to membership when the server reports deferred billing recovery", async () => {
    currentStore.register.mockResolvedValue({ role: "user", recovery: "provider-deferred" });
    renderAuth({ mode: "register" });
    fillRegistrationForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-submit"));
    });

    expect(mockRouterReplace).toHaveBeenCalledWith("/membership");
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it("uses the role returned by the server without exposing a role picker", async () => {
    currentStore.register.mockResolvedValue({ role: "admin", recovery: "already-recovered" });
    renderAuth({ mode: "register" });
    expect(screen.queryByText(/Choose account type/)).toBeNull();
    fillRegistrationForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-submit"));
    });

    expect(mockRouterReplace).toHaveBeenCalledWith("/profile");
    expect(mockRouterDismissAll).toHaveBeenCalledTimes(1);
  });

  it("preserves the password when visibility is toggled", () => {
    renderAuth();
    fireEvent.changeText(screen.getByTestId("auth-password"), "valid-pass");
    const input = screen.getByTestId("auth-password");
    expect(input.props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId("auth-password-toggle"));
    expect(input.props.value).toBe("valid-pass");
    expect(input.props.secureTextEntry).toBe(false);

    fireEvent.press(screen.getByTestId("auth-password-toggle"));
    expect(input.props.value).toBe("valid-pass");
    expect(input.props.secureTextEntry).toBe(true);
  });

  it("shows a safe offline message instead of exposing a request error", async () => {
    currentStore.signIn.mockRejectedValue(new TypeError("Failed to fetch"));
    renderAuth();
    fillSignInForm();

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-submit"));
    });

    expect(screen.getByTestId("auth-status").props.children).toMatch(
      /could not reach the sign-in service/i,
    );
    expect(screen.queryByText("Failed to fetch")).toBeNull();
  });

  it("opens the existing legal route without inventing legal content", () => {
    renderAuth();
    fireEvent.press(screen.getByTestId("auth-footer-terms"));
    expect(mockRouterPush).toHaveBeenCalledWith("/legal");
  });
});
