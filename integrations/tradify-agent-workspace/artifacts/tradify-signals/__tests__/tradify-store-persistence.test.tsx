import React, { type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";
import {
  deleteUserAccount,
  getCurrentUser,
  getMembershipStatus,
  getUserAlerts,
  getUserTrades,
  getWatchlist,
  logout,
  register as registerRequest,
  signIn as signInRequest,
} from "@workspace/api-client-react";
import { DEFAULT_ACCESS_POLICY } from "@/constants/membership";
import { getAuthToken, TradifyProvider, useTradify } from "@/lib/tradify-store";

const mockSecureStorage = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStorage.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStorage.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStorage.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock("@workspace/api-client-react", () => ({
  getMarketSnapshot: jest.fn(() => Promise.reject(new Error("No snapshot in persistence test"))),
  getMarketQuotes: jest.fn(),
  getMarketsCatalog: jest.fn(() => Promise.reject(new Error("No catalog in persistence test"))),
  getMembershipStatus: jest.fn(() =>
    Promise.resolve({
      membership: "Free",
      source: "UNKNOWN",
      entitlements: [],
      billingStatus: "INACTIVE",
      expiresAt: null,
      willRenew: false,
      provider: "REVENUECAT",
      accessPolicy: {
        rowVersion: 0,
        featureMinimumTiers: {
          signalContext: "Pro",
          trustedSetupLevels: "Pro",
          performanceContext: "Pro",
          priceAlerts: "Pro",
          fullDepthReview: "VIP",
        },
        marketTiers: { USOIL: "Free", BTCUSD: "Free", ETHUSD: "Free" },
        watchlistLimits: { Free: 3, Pro: 22, VIP: null },
      },
    }),
  ),
  getUserNotifications: jest.fn(() => Promise.resolve([])),
  getCurrentUser: jest.fn(() =>
    Promise.resolve({
      user: {
        id: "user-1",
        name: "Trader",
        email: "trader@example.com",
        accountSize: 10000,
        riskPercent: 0.5,
        maxDailyLoss: 2,
        maxTrades: 3,
        aggressive: false,
        membership: "Free",
        role: "user",
        status: "active",
        alertSymbols: [],
      },
    }),
  ),
  getUserAlerts: jest.fn(() => Promise.resolve([])),
  getUserTrades: jest.fn(() => Promise.resolve([])),
  getWatchlist: jest.fn(() => Promise.resolve([])),
  signIn: jest.fn(() =>
    Promise.resolve({
      token: "signed-in-token",
      user: {
        id: "signed-in-user",
        name: "Trader",
        email: "trader@example.com",
        accountSize: 10000,
        riskPercent: 0.5,
        maxDailyLoss: 2,
        maxTrades: 3,
        aggressive: false,
        membership: "Free",
        role: "user",
        status: "active",
        alertSymbols: [],
      },
    }),
  ),
  register: jest.fn(() =>
    Promise.resolve({
      token: "registered-token",
      recovery: null,
      user: {
        id: "registered-user",
        name: "Trader",
        email: "trader@example.com",
        accountSize: 10000,
        riskPercent: 0.5,
        maxDailyLoss: 2,
        maxTrades: 3,
        aggressive: false,
        membership: "Free",
        role: "user",
        status: "active",
        alertSymbols: [],
      },
    }),
  ),
  logout: jest.fn(() => Promise.resolve()),
  deleteUserAccount: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/live-quotes", () => ({
  mergeLiveQuotes: jest.fn(),
  startLiveQuotePolling: jest.fn(() => jest.fn()),
}));

const storageKey = "tradify-signals-local-v1";
const authTokenKey = "tradify-signals-auth-token-v1";
const authSessionStateKey = "tradify-signals-auth-session-state-v1";
const wrapper = ({ children }: { children: ReactNode }) => (
  <TradifyProvider>{children}</TradifyProvider>
);

function loadFreshTradifyStore() {
  jest.resetModules();
  jest.doMock("react", () => React);
  jest.doMock("@react-native-async-storage/async-storage", () => AsyncStorage);
  jest.doMock("expo-secure-store", () => SecureStore);
  return require("@/lib/tradify-store") as typeof import("@/lib/tradify-store");
}

describe("Tradify store persistence", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSecureStorage.clear();
    jest.clearAllMocks();
    (getMembershipStatus as jest.MockedFunction<typeof getMembershipStatus>).mockResolvedValue({
      membership: "Free",
      source: "UNKNOWN",
      entitlements: [],
      billingStatus: "INACTIVE",
      expiresAt: null,
      willRenew: false,
      provider: "REVENUECAT",
      accessPolicy: DEFAULT_ACCESS_POLICY,
    });
  });

  it("starts Free with no seeded trades, signals, alerts, or premium watchlist state", async () => {
    const mounted = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(mounted.result.current.hydrated).toBe(true));

    expect(mounted.result.current.profile.membership).toBe("Free");
    expect(mounted.result.current.signals).toEqual([]);
    expect(mounted.result.current.trades).toEqual([]);
    expect(mounted.result.current.alerts).toEqual([]);
    expect(mounted.result.current.notifications).toEqual([]);
    expect(
      mounted.result.current.watchlist
        .filter((item) => item.open)
        .map((item) => item.symbol)
        .sort(),
    ).toEqual(["BTCUSD", "ETHUSD", "USOIL"]);
    expect(mounted.result.current.watchlist.filter((item) => item.alerts)).toEqual([]);
    mounted.unmount();
  });

  it("persists and restores each symbol’s selected strategy after provider hydration", async () => {
    const firstMount = renderHook(() => useTradify(), { wrapper });

    await waitFor(() => expect(firstMount.result.current.hydrated).toBe(true));

    act(() => {
      firstMount.result.current.setStrategyForSymbol("xauusd", "BBB Gold 3S");
      firstMount.result.current.setStrategyForSymbol("EURUSD", "BBB");
    });

    await waitFor(async () => {
      const saved = await AsyncStorage.getItem(storageKey);
      expect(JSON.parse(saved ?? "{}").selectedStrategiesBySymbol).toEqual({
        XAUUSD: "BBB Gold 3S",
        EURUSD: "BBB",
      });
    });

    firstMount.unmount();

    const restartedMount = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(restartedMount.result.current.hydrated).toBe(true));

    expect(restartedMount.result.current.selectedStrategiesBySymbol).toEqual({
      XAUUSD: "BBB Gold 3S",
      EURUSD: "BBB",
    });

    restartedMount.unmount();
  });

  it("keeps the provider usable with defaults when saved preferences contain malformed JSON", async () => {
    await AsyncStorage.setItem(storageKey, '{"selectedStrategy":');

    const mounted = renderHook(() => useTradify(), { wrapper });

    await waitFor(() => expect(mounted.result.current.hydrated).toBe(true));
    expect(mounted.result.current.selectedStrategy).toBe("DGv8");
    expect(mounted.result.current.selectedStrategiesBySymbol).toEqual({});
    expect(mounted.result.current.watchlist.length).toBeGreaterThan(0);

    act(() => mounted.result.current.setStrategyForSymbol(" xauusd ", "BBB"));
    expect(mounted.result.current.selectedStrategiesBySymbol).toEqual({ XAUUSD: "BBB" });

    mounted.unmount();
  });

  it("continues with defaults and restores the session when reading saved preferences fails", async () => {
    await AsyncStorage.setItem(authTokenKey, "session-token");
    const getItemMock = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
    getItemMock.mockRejectedValueOnce(new Error("Local preferences are temporarily unavailable"));

    const mounted = renderHook(() => useTradify(), { wrapper });

    await waitFor(() => {
      expect(mounted.result.current.hydrated).toBe(true);
      expect(mounted.result.current.authenticated).toBe(true);
    });
    expect(await SecureStore.getItemAsync(authTokenKey)).toBe("session-token");
    expect(await AsyncStorage.getItem(authTokenKey)).toBeNull();

    expect(mounted.result.current.selectedStrategy).toBe("DGv8");
    expect(mounted.result.current.selectedStrategiesBySymbol).toEqual({});
    expect(mounted.result.current.watchlist.length).toBeGreaterThan(0);
    expect(getCurrentUser).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it("refreshes membership and access rules from the server status", async () => {
    await AsyncStorage.setItem(authTokenKey, "session-token");
    const membershipStatusRequest = getMembershipStatus as jest.MockedFunction<
      typeof getMembershipStatus
    >;
    const customAccessPolicy = {
      ...DEFAULT_ACCESS_POLICY,
      rowVersion: 9,
      featureMinimumTiers: {
        ...DEFAULT_ACCESS_POLICY.featureMinimumTiers,
        priceAlerts: "Free" as const,
      },
      marketTiers: { ...DEFAULT_ACCESS_POLICY.marketTiers, EURUSD: "Free" as const },
      watchlistLimits: { ...DEFAULT_ACCESS_POLICY.watchlistLimits, Free: 5 },
    };
    membershipStatusRequest.mockResolvedValue({
      membership: "VIP",
      source: "ADMIN_OVERRIDE",
      entitlements: [],
      billingStatus: "ACTIVE",
      expiresAt: null,
      willRenew: false,
      provider: "REVENUECAT",
      accessPolicy: customAccessPolicy,
    });

    const mounted = renderHook(() => useTradify(), { wrapper });

    await waitFor(() => expect(mounted.result.current.authenticated).toBe(true));
    await waitFor(() => expect(membershipStatusRequest).toHaveBeenCalled());
    await waitFor(() => expect(mounted.result.current.profile.membership).toBe("VIP"));
    await waitFor(() => expect(mounted.result.current.accessPolicy.rowVersion).toBe(9));
    expect(mounted.result.current.accessPolicy.marketTiers.EURUSD).toBe("Free");
    expect(mounted.result.current.accessPolicy.watchlistLimits.Free).toBe(5);

    mounted.unmount();
  });

  it("refreshes membership again when an authenticated app returns to the foreground", async () => {
    await AsyncStorage.setItem(authTokenKey, "session-token");
    const membershipStatusRequest = getMembershipStatus as jest.MockedFunction<
      typeof getMembershipStatus
    >;
    const resumeListeners: Array<(state: string) => void> = [];
    const appStateListener = jest.spyOn(AppState, "addEventListener").mockImplementation(((
      event: string,
      listener: (state: string) => void,
    ) => {
      if (event === "change") resumeListeners.push(listener);
      return { remove: jest.fn() };
    }) as typeof AppState.addEventListener);
    membershipStatusRequest.mockResolvedValue({
      membership: "Free",
      source: "UNKNOWN",
      entitlements: [],
      billingStatus: "INACTIVE",
      expiresAt: null,
      willRenew: false,
      provider: "REVENUECAT",
      accessPolicy: DEFAULT_ACCESS_POLICY,
    });

    const mounted = renderHook(() => useTradify(), { wrapper });
    try {
      await waitFor(() => expect(mounted.result.current.authenticated).toBe(true));
      await waitFor(() => expect(membershipStatusRequest).toHaveBeenCalled());
      expect(resumeListeners).toHaveLength(1);
      const previousRequestCount = membershipStatusRequest.mock.calls.length;
      membershipStatusRequest.mockResolvedValue({
        membership: "VIP",
        source: "ADMIN_OVERRIDE",
        entitlements: [],
        billingStatus: "ACTIVE",
        expiresAt: null,
        willRenew: false,
        provider: "REVENUECAT",
        accessPolicy: DEFAULT_ACCESS_POLICY,
      });

      act(() => resumeListeners[0]("active"));

      await waitFor(() => expect(mounted.result.current.profile.membership).toBe("VIP"));
      expect(membershipStatusRequest).toHaveBeenCalledTimes(previousRequestCount + 1);
    } finally {
      mounted.unmount();
      appStateListener.mockRestore();
    }
  });

  it("ignores invalid strategies and blank symbols while normalizing valid saved setups", async () => {
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        selectedStrategy: "not-a-strategy",
        selectedStrategiesBySymbol: {
          "   ": "BBB",
          " xauusd ": "BBB Gold 3S",
          eurusd: "not-a-strategy",
          " gbpusd ": "DGv8 FX",
        },
      }),
    );

    const mounted = renderHook(() => useTradify(), { wrapper });

    await waitFor(() => expect(mounted.result.current.hydrated).toBe(true));

    expect(mounted.result.current.selectedStrategy).toBe("DGv8");
    expect(mounted.result.current.selectedStrategiesBySymbol).toEqual({
      XAUUSD: "BBB Gold 3S",
      GBPUSD: "DGv8 FX",
    });

    mounted.unmount();
  });

  it("restores token persistence after storage recovers without repeating sign-in", async () => {
    const mounted = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(mounted.result.current.hydrated).toBe(true));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(storageKey, expect.any(String)),
    );
    (
      SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>
    ).mockRejectedValueOnce(new Error("Token storage unavailable"));

    let role: "user" | "admin" | undefined;
    await act(async () => {
      role = await mounted.result.current.signIn("trader@example.com", "password");
    });

    expect(role).toBe("user");
    await waitFor(() => {
      expect(mounted.result.current.authenticated).toBe(true);
      expect(mounted.result.current.profile.id).toBe("signed-in-user");
    });
    expect(await getAuthToken()).toBe("signed-in-token");
    expect(await SecureStore.getItemAsync(authTokenKey)).toBeNull();
    expect(signInRequest).toHaveBeenCalledTimes(1);
    expect(getUserAlerts).toHaveBeenCalled();
    expect(getUserTrades).toHaveBeenCalled();
    expect(getWatchlist).toHaveBeenCalled();

    let saved = false;
    await act(async () => {
      saved = await mounted.result.current.retryAuthTokenPersistence();
    });

    expect(saved).toBe(true);
    expect(await SecureStore.getItemAsync(authTokenKey)).toBe("signed-in-token");
    expect(mounted.result.current.authTokenPersistenceState).toBe("saved");
    expect(mounted.result.current.authenticated).toBe(true);
    expect(signInRequest).toHaveBeenCalledTimes(1);

    await act(async () => mounted.result.current.signOut());
    mounted.unmount();
  });

  it("restores token persistence after registration without repeating account creation", async () => {
    const mounted = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(mounted.result.current.hydrated).toBe(true));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(storageKey, expect.any(String)),
    );
    (
      SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>
    ).mockRejectedValueOnce(new Error("Token storage unavailable"));

    let registration: Awaited<ReturnType<typeof mounted.result.current.register>> | undefined;
    await act(async () => {
      registration = await mounted.result.current.register("trader@example.com", "password");
    });

    expect(registration?.role).toBe("user");
    await waitFor(() => {
      expect(mounted.result.current.authenticated).toBe(true);
      expect(mounted.result.current.profile.id).toBe("registered-user");
    });
    expect(await getAuthToken()).toBe("registered-token");
    expect(await SecureStore.getItemAsync(authTokenKey)).toBeNull();
    expect(registerRequest).toHaveBeenCalledTimes(1);
    expect(getUserAlerts).toHaveBeenCalled();

    let saved = false;
    await act(async () => {
      saved = await mounted.result.current.retryAuthTokenPersistence();
    });

    expect(saved).toBe(true);
    expect(await SecureStore.getItemAsync(authTokenKey)).toBe("registered-token");
    expect(mounted.result.current.authTokenPersistenceState).toBe("saved");
    expect(registerRequest).toHaveBeenCalledTimes(1);

    await act(async () => mounted.result.current.signOut());
    mounted.unmount();
  });

  it("keeps the active session usable and clearly pending after persistent storage failures", async () => {
    const mounted = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(mounted.result.current.hydrated).toBe(true));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(storageKey, expect.any(String)),
    );
    const setItemMock = SecureStore.setItemAsync as jest.MockedFunction<
      typeof SecureStore.setItemAsync
    >;
    setItemMock.mockRejectedValueOnce(new Error("Token storage unavailable"));

    await act(async () => {
      await mounted.result.current.signIn("trader@example.com", "password");
    });

    setItemMock.mockRejectedValueOnce(new Error("Token storage is still unavailable"));
    let saved = true;
    await act(async () => {
      saved = await mounted.result.current.retryAuthTokenPersistence();
    });

    expect(saved).toBe(false);
    expect(await getAuthToken()).toBe("signed-in-token");
    expect(await SecureStore.getItemAsync(authTokenKey)).toBeNull();
    expect(mounted.result.current.authenticated).toBe(true);
    expect(mounted.result.current.authTokenPersistenceState).toBe("pending");
    expect(signInRequest).toHaveBeenCalledTimes(1);

    await act(async () => mounted.result.current.signOut());
    mounted.unmount();
  });

  it("clears the in-memory session and resolves sign-out when token removal fails", async () => {
    const mounted = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(mounted.result.current.hydrated).toBe(true));
    await act(async () => {
      await mounted.result.current.signIn("trader@example.com", "password");
    });
    await SecureStore.setItemAsync(authTokenKey, "signed-in-token");

    (
      SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>
    ).mockRejectedValueOnce(new Error("Token storage unavailable"));

    await act(async () => mounted.result.current.signOut());

    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mounted.result.current.authenticated).toBe(false));
    expect(await getAuthToken()).toBeNull();
    expect(await SecureStore.getItemAsync(authTokenKey)).toBe("signed-in-token");
    expect(await AsyncStorage.getItem(authSessionStateKey)).toBe("signed-out");
    mounted.unmount();
  });

  it("stays signed out after server logout and token removal fail, then restores a new sign-in", async () => {
    const firstMount = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(firstMount.result.current.hydrated).toBe(true));
    await act(async () => {
      await firstMount.result.current.signIn("trader@example.com", "password");
    });
    await SecureStore.setItemAsync(authTokenKey, "signed-in-token");

    (logout as jest.MockedFunction<typeof logout>).mockRejectedValueOnce(
      new Error("Logout endpoint unavailable"),
    );
    (
      SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>
    ).mockRejectedValueOnce(new Error("Token storage unavailable"));

    await act(async () => firstMount.result.current.signOut());

    expect(firstMount.result.current.authenticated).toBe(false);
    expect(await SecureStore.getItemAsync(authTokenKey)).toBe("signed-in-token");
    expect(await AsyncStorage.getItem(authSessionStateKey)).toBe("signed-out");
    firstMount.unmount();

    const freshStore = loadFreshTradifyStore();
    const freshApi = require("@workspace/api-client-react") as {
      getCurrentUser: jest.Mock;
    };
    freshApi.getCurrentUser.mockClear();

    const freshWrapper = ({ children }: { children: ReactNode }) => (
      <freshStore.TradifyProvider>{children}</freshStore.TradifyProvider>
    );
    const restarted = renderHook(() => freshStore.useTradify(), { wrapper: freshWrapper });
    await waitFor(() => expect(restarted.result.current.hydrated).toBe(true));

    expect(restarted.result.current.authenticated).toBe(false);
    expect(restarted.result.current.profile.id).toBe("preview");
    expect(freshApi.getCurrentUser).not.toHaveBeenCalled();
    expect(await freshStore.getAuthToken()).toBeNull();
    expect(await SecureStore.getItemAsync(authTokenKey)).toBe("signed-in-token");

    await act(async () => {
      await restarted.result.current.signIn("trader@example.com", "password");
    });
    expect(restarted.result.current.authenticated).toBe(true);
    expect(await AsyncStorage.getItem(authSessionStateKey)).toBe("signed-in");
    restarted.unmount();

    const signedInStore = loadFreshTradifyStore();
    const signedInApi = require("@workspace/api-client-react") as {
      getCurrentUser: jest.Mock;
    };
    signedInApi.getCurrentUser.mockClear();
    const signedInWrapper = ({ children }: { children: ReactNode }) => (
      <signedInStore.TradifyProvider>{children}</signedInStore.TradifyProvider>
    );
    const signedInRestart = renderHook(() => signedInStore.useTradify(), {
      wrapper: signedInWrapper,
    });

    await waitFor(() => {
      expect(signedInApi.getCurrentUser).toHaveBeenCalledTimes(1);
      expect(signedInRestart.result.current.authenticated).toBe(true);
    });
    signedInRestart.unmount();
  });

  it("clears the in-memory session and resolves account deletion when token removal fails", async () => {
    const mounted = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(mounted.result.current.hydrated).toBe(true));
    await act(async () => {
      await mounted.result.current.signIn("trader@example.com", "password");
    });
    await SecureStore.setItemAsync(authTokenKey, "signed-in-token");

    (
      SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>
    ).mockRejectedValueOnce(new Error("Token storage unavailable"));

    await act(async () => mounted.result.current.deleteAccount());

    expect(deleteUserAccount).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mounted.result.current.authenticated).toBe(false);
      expect(mounted.result.current.profile.id).toBe("preview");
    });
    expect(await getAuthToken()).toBeNull();
    expect(await SecureStore.getItemAsync(authTokenKey)).toBe("signed-in-token");
    mounted.unmount();
  });

  it.each(["logout", "deletion"] as const)(
    "does not restore a %s account after restart when its stale token is rejected",
    async (ending) => {
      const firstMount = renderHook(() => useTradify(), { wrapper });
      await waitFor(() => expect(firstMount.result.current.hydrated).toBe(true));

      await act(async () => {
        await firstMount.result.current.signIn("trader@example.com", "password");
      });
      await SecureStore.setItemAsync(authTokenKey, "signed-in-token");

      (
        SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>
      ).mockRejectedValueOnce(new Error("Token storage unavailable"));
      await act(async () => {
        if (ending === "logout") {
          await firstMount.result.current.signOut();
        } else {
          await firstMount.result.current.deleteAccount();
        }
        // Exercise the previous-server-revocation path independently of the
        // new restart-safe local sign-out marker.
        await AsyncStorage.removeItem(authSessionStateKey);
      });

      expect(firstMount.result.current.authenticated).toBe(false);
      expect(await SecureStore.getItemAsync(authTokenKey)).toBe("signed-in-token");
      if (ending === "logout") {
        expect(logout).toHaveBeenCalledTimes(1);
      } else {
        expect(deleteUserAccount).toHaveBeenCalledTimes(1);
      }
      firstMount.unmount();

      // Recreate the store module as a new JS process would, while retaining
      // AsyncStorage's device data and its uncleared authentication token.
      const freshStore = loadFreshTradifyStore();
      const freshApi = require("@workspace/api-client-react") as {
        getCurrentUser: jest.Mock;
        getUserAlerts: jest.Mock;
        getUserTrades: jest.Mock;
        getWatchlist: jest.Mock;
      };
      freshApi.getCurrentUser.mockRejectedValueOnce(new Error("Session is no longer valid"));
      (
        SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>
      ).mockClear();
      (
        SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>
      ).mockRejectedValueOnce(new Error("Token storage unavailable during startup"));

      const unhandledRejections: unknown[] = [];
      const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
      process.on("unhandledRejection", onUnhandledRejection);

      try {
        const freshWrapper = ({ children }: { children: ReactNode }) => (
          <freshStore.TradifyProvider>{children}</freshStore.TradifyProvider>
        );
        const restarted = renderHook(() => freshStore.useTradify(), { wrapper: freshWrapper });

        await waitFor(() => expect(freshApi.getCurrentUser).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(authTokenKey));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(restarted.result.current.hydrated).toBe(true);
        expect(restarted.result.current.authenticated).toBe(false);
        expect(restarted.result.current.profile.id).toBe("preview");
        expect(freshApi.getUserAlerts).not.toHaveBeenCalled();
        expect(freshApi.getUserTrades).not.toHaveBeenCalled();
        expect(freshApi.getWatchlist).not.toHaveBeenCalled();
        expect(await freshStore.getAuthToken()).toBeNull();
        expect(await SecureStore.getItemAsync(authTokenKey)).toBe("signed-in-token");
        expect(unhandledRejections).toEqual([]);

        restarted.unmount();
      } finally {
        process.off("unhandledRejection", onUnhandledRejection);
      }
    },
  );
});
