import React, { type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@workspace/api-client-react";
import { TradifyProvider, useTradify, type Notification } from "@/lib/tradify-store";

const mockSecureStorage = new Map<string, string>();
const mockUser = {
  id: "notification-user", name: "Trader", email: "trader@example.test",
  accountSize: 10000, riskPercent: 0.5, maxDailyLoss: 2, maxTrades: 3,
  aggressive: false, membership: "Pro", role: "user", status: "active", alertSymbols: [],
};

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
  getMarketSnapshot: jest.fn(() => Promise.reject(new Error("No market snapshot in notification tests"))),
  getMarketsCatalog: jest.fn(() => Promise.reject(new Error("No catalog in notification tests"))),
  getMarketQuotes: jest.fn(),
  getMembershipStatus: jest.fn(() => Promise.resolve({
    membership: "Pro", source: "UNKNOWN", entitlements: [], billingStatus: "ACTIVE",
    expiresAt: null, willRenew: false, provider: "REVENUECAT",
    accessPolicy: require("@/constants/membership").DEFAULT_ACCESS_POLICY,
  })),
  getCurrentUser: jest.fn(() => Promise.resolve({ user: mockUser })),
  getUserAlerts: jest.fn(() => Promise.resolve([])),
  getUserTrades: jest.fn(() => Promise.resolve([])),
  getWatchlist: jest.fn(() => Promise.resolve([])),
  getUserNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  signIn: jest.fn(() => Promise.resolve({ token: "notification-session", user: mockUser })),
  logout: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/live-quotes", () => ({
  mergeLiveQuotes: jest.fn(),
  startLiveQuotePolling: jest.fn(() => jest.fn()),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <TradifyProvider>{children}</TradifyProvider>
);
const fixtures: Notification[] = [
  { id: "one", timestamp: 1, timeLabel: "Just now", symbol: "XAUUSD", type: "MARKET_WARNING",
    title: "Review position", message: "Market warning", isRead: false },
  { id: "two", timestamp: 2, timeLabel: "Just now", symbol: "EURUSD", type: "NEW_SETUP",
    title: "New opportunity", message: "Validated setup", isRead: false },
  { id: "read", timestamp: 3, timeLabel: "Just now", symbol: "XAGUSD", type: "STATUS_CHANGE",
    title: "Updated opportunity", message: "Earlier update", isRead: true },
];
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("Notification synchronization in the real mobile provider", () => {
  let mounted: ReturnType<typeof renderHook<ReturnType<typeof useTradify>, unknown>> | undefined;

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSecureStorage.clear();
    jest.clearAllMocks();
    jest.mocked(getUserNotifications).mockReset().mockResolvedValue(fixtures.map((entry) => ({ ...entry })));
    jest.mocked(markNotificationRead).mockReset().mockResolvedValue({ ok: true, notification: { ...fixtures[0], isRead: true } });
    jest.mocked(markAllNotificationsRead).mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(async () => {
    // Storage clearing alone does not reset the module-scoped session cache.
    if (mounted) {
      await act(async () => { await mounted!.result.current.signOut(); });
      mounted.unmount();
      mounted = undefined;
    }
  });

  async function signedInProvider() {
    mounted = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(mounted!.result.current.hydrated).toBe(true));
    await act(async () => { await mounted!.result.current.signIn("trader@example.test", "test-password"); });
    await waitFor(() => {
      expect(mounted!.result.current.notificationSyncState).toBe("synced");
      expect(mounted!.result.current.notifications).toEqual(fixtures);
    });
    return mounted;
  }

  it("uses device-local read actions without sending unauthenticated API requests", async () => {
    mounted = renderHook(() => useTradify(), { wrapper });
    await waitFor(() => expect(mounted!.result.current.hydrated).toBe(true));
    await act(async () => {
      await mounted!.result.current.refreshNotifications();
      await mounted!.result.current.markNotificationRead("local-only");
      await mounted!.result.current.markAllNotificationsRead();
    });
    expect(mounted.result.current.notificationSyncState).toBe("local");
    expect(mounted.result.current.notifications).toEqual([]);
    expect(getUserNotifications).not.toHaveBeenCalled();
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(markAllNotificationsRead).not.toHaveBeenCalled();
  });

  it("marks only the selected alert optimistically, then applies the server response", async () => {
    const store = await signedInProvider();
    const pending = deferred<Awaited<ReturnType<typeof markNotificationRead>>>();
    jest.mocked(markNotificationRead).mockReturnValueOnce(pending.promise);
    let mutation!: Promise<void>;
    act(() => { mutation = store.result.current.markNotificationRead("one"); });
    expect(markNotificationRead).toHaveBeenCalledWith("one");
    expect(store.result.current.notifications).toEqual(fixtures.map((entry) =>
      entry.id === "one" ? { ...entry, isRead: true } : entry,
    ));
    const serverNotification = { ...fixtures[0], isRead: true, timeLabel: "1m ago" };
    await act(async () => {
      pending.resolve({ ok: true, notification: serverNotification });
      await mutation;
    });
    expect(store.result.current.notifications[0]).toEqual(serverNotification);
    expect(store.result.current.notificationSyncState).toBe("synced");
  });

  it.each(["one", "all"] as const)("rolls back an optimistic %s read when the API is offline, then recovers on refetch", async (kind) => {
    const store = await signedInProvider();
    const pending = deferred<never>();
    if (kind === "one") jest.mocked(markNotificationRead).mockReturnValueOnce(pending.promise);
    else jest.mocked(markAllNotificationsRead).mockReturnValueOnce(pending.promise);
    let mutation!: Promise<void>;
    act(() => {
      mutation = kind === "one"
        ? store.result.current.markNotificationRead("one")
        : store.result.current.markAllNotificationsRead();
    });
    expect(store.result.current.notifications).toEqual(fixtures.map((entry) =>
      kind === "all" || entry.id === "one" ? { ...entry, isRead: true } : entry,
    ));
    await act(async () => { pending.reject(new Error("Network unavailable")); await mutation; });
    expect(store.result.current.notifications).toEqual(fixtures);
    expect(store.result.current.notificationSyncState).toBe("offline");
    await act(async () => { await store.result.current.refreshNotifications(); });
    expect(store.result.current.notifications).toEqual(fixtures);
    expect(store.result.current.notificationSyncState).toBe("synced");
  });

  it("keeps every alert read after a successful optimistic read-all", async () => {
    const store = await signedInProvider();
    const pending = deferred<Awaited<ReturnType<typeof markAllNotificationsRead>>>();
    jest.mocked(markAllNotificationsRead).mockReturnValueOnce(pending.promise);
    let mutation!: Promise<void>;
    act(() => { mutation = store.result.current.markAllNotificationsRead(); });
    const allRead = fixtures.map((entry) => ({ ...entry, isRead: true }));
    expect(store.result.current.notifications).toEqual(allRead);
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ ok: true }); await mutation; });
    expect(store.result.current.notifications).toEqual(allRead);
    expect(store.result.current.notificationSyncState).toBe("synced");
  });

  it("preserves saved history on failed refetch and replaces it with another device's read state on success", async () => {
    const store = await signedInProvider();
    jest.mocked(getUserNotifications).mockRejectedValueOnce(new Error("Offline"));
    await act(async () => { await store.result.current.refreshNotifications(); });
    expect(store.result.current.notifications).toEqual(fixtures);
    expect(store.result.current.notificationSyncState).toBe("offline");
    const remoteRead = fixtures.map((entry) => ({ ...entry, isRead: true }));
    jest.mocked(getUserNotifications).mockResolvedValueOnce(remoteRead);
    await act(async () => { await store.result.current.refreshNotifications(); });
    expect(store.result.current.notifications).toEqual(remoteRead);
    expect(store.result.current.notificationSyncState).toBe("synced");

    jest.mocked(getUserNotifications).mockResolvedValueOnce([]);
    await act(async () => { await store.result.current.refreshNotifications(); });
    expect(store.result.current.notifications).toEqual([]);
    expect(store.result.current.notificationSyncState).toBe("synced");
  });
});
