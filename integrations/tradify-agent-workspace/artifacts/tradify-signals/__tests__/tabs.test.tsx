import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dimensions, StyleSheet } from "react-native";

const mockUseTradify = jest.fn();
const mockRouterPush = jest.fn();
const mockCustomFetch = jest.fn(() =>
  Promise.resolve({
    newSignals: false,
    entries: false,
    takeProfits: false,
    stopLosses: false,
    breakevenAndChanges: false,
    watchlistPriceAlerts: false,
    announcements: false,
  }),
);
const mockNotificationPreferences = {
  newSignals: false,
  entries: false,
  takeProfits: false,
  stopLosses: false,
  breakevenAndChanges: false,
  announcements: false,
};
const mockUpdateNotificationPreferences = jest.fn(async ({ data }: { data: Record<string, boolean> }) => ({
  ...mockNotificationPreferences,
  ...data,
}));
const notificationQueryClients: QueryClient[] = [];

function renderNotificationsScreen(Screen: React.ComponentType) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  notificationQueryClients.push(queryClient);
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <Screen />
    </QueryClientProvider>
  );
  const rendered = render(tree());
  return { ...rendered, rerender: () => rendered.rerender(tree()) };
}

jest.mock("@/lib/tradify-store", () => ({
  useTradify: mockUseTradify,
  hasTradeDetails: (trade: {
    locked?: boolean;
    entry?: number;
    stop?: number;
    target?: number;
    progress?: number;
    r?: number;
  }) =>
    trade.locked !== true &&
    Number.isFinite(trade.entry) &&
    Number.isFinite(trade.stop) &&
    Number.isFinite(trade.target) &&
    Number.isFinite(trade.progress) &&
    Number.isFinite(trade.r),
}));

jest.mock("expo-router", () => ({
  router: {
    push: mockRouterPush,
  },
}));

jest.mock("@workspace/api-client-react", () => ({
  customFetch: mockCustomFetch,
  getGetUserNotificationPreferencesQueryKey: () => ["/api/user/notification-preferences"],
  useGetUserNotificationPreferences: () => ({
    data: mockNotificationPreferences,
    isError: false,
    queryKey: ["/api/user/notification-preferences"],
  }),
  useUpdateUserNotificationPreferences: () => ({
    mutateAsync: mockUpdateNotificationPreferences,
  }),
}));

jest.mock("@expo/vector-icons/Feather", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return ({ name }: { name: string }) => <Text>{name}</Text>;
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, Ionicons: Icon, MaterialCommunityIcons: Icon };
});

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#101318",
    card: "#171c23",
    border: "#2a3440",
    chart: "#8b7cff",
    destructive: "#ef5350",
    destructiveForeground: "#ffffff",
    foreground: "#f4f7fb",
    input: "#0e1217",
    muted: "#202731",
    mutedForeground: "#a7b1bd",
    primary: "#5eead4",
    primaryForeground: "#07100f",
    secondary: "#242d38",
    secondaryForeground: "#e3e9ef",
    success: "#5eea9a",
    warning: "#f5c15d",
    reference: "#7186A3",
  }),
}));

jest.mock("@/components/TradifyUI", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  return {
    PrimaryButton: ({
      label,
      onPress,
      disabled,
      testID,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <Pressable testID={testID} onPress={onPress} disabled={disabled}>
        <Text>{label}</Text>
      </Pressable>
    ),
    SecondaryButton: ({
      label,
      onPress,
      testID,
    }: {
      label: string;
      onPress: () => void;
      testID?: string;
    }) => (
      <Pressable testID={testID} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
    StatusPill: ({ label }: { label: string }) => <Text>{label}</Text>,
    PriceStateBadge: ({ state, label }: { state: string; label?: string }) => (
      <Text testID={`price-state-badge-${state}`}>{label ?? state}</Text>
    ),
    Chip: ({ label, onPress }: { label: string; onPress?: () => void }) => (
      <Pressable testID={`chip-${label}`} onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
    EmptyState: ({
      title,
      detail,
      action,
      onAction,
    }: {
      title: string;
      detail: string;
      action?: string;
      onAction?: () => void;
    }) => (
      <View>
        <Text>{title}</Text>
        <Text>{detail}</Text>
        {action ? (
          <Pressable testID="empty-action" onPress={onAction}>
            <Text>{action}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
    EducationalPreview: ({ onMethodology }: { onMethodology?: () => void }) => (
      <View testID="educational-preview">
        <Text>EDUCATIONAL PREVIEW</Text>
        <Text>Entry</Text>
        <Text>Stop</Text>
        <Text>Target</Text>
        <Text>Thesis</Text>
        {onMethodology ? (
          <Pressable testID="educational-methodology" onPress={onMethodology}>
            <Text>Read the methodology</Text>
          </Pressable>
        ) : null}
      </View>
    ),
    FeedStatus: () => <View testID="feed-status" />,
    Header: ({ title }: { title: string }) => <Text>{title}</Text>,
    SectionTitle: ({ title }: { title: string }) => <Text>{title}</Text>,
    ModalSheet: ({
      visible,
      title,
      children,
    }: {
      visible: boolean;
      title: string;
      children: React.ReactNode;
    }) =>
      visible ? (
        <View testID="market-modal">
          <Text>{title}</Text>
          {children}
        </View>
      ) : null,
    Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    SignalCard: ({ signal }: { signal: { symbol: string } }) => (
      <Text testID={`signal-card-${signal.symbol}`}>{signal.symbol}</Text>
    ),
    SurfaceCard: ({
      children,
      testID,
      onPress,
    }: {
      children: React.ReactNode;
      testID?: string;
      onPress?: () => void;
    }) =>
      onPress ? (
        <Pressable testID={testID} onPress={onPress}>
          {children}
        </Pressable>
      ) : (
        <View testID={testID}>{children}</View>
      ),
  };
});

const signal = {
  id: "signal-xau",
  symbol: "XAUUSD",
  name: "Gold / US Dollar",
  market: "METALS",
  direction: "LONG",
  strategy: "DGv8",
  grade: "A+",
  action: "WAIT FOR RETEST",
  price: 4361.84,
  entry: 4363.72,
  stop: 4351.33,
  tp1: 4374.11,
  tp2: 4384.5,
  tp3: 4402.72,
  session: "LONDON",
  age: "06m",
  note: "Validate before entry.",
};

const baseWatchlist = [
  {
    symbol: "XAUUSD",
    name: "Gold",
    market: "METALS",
    price: 4361.84,
    change: 0.42,
    open: true,
    alerts: true,
  },
  {
    symbol: "XAGUSD",
    name: "Silver",
    market: "METALS",
    price: 31.244,
    change: -0.18,
    open: true,
    alerts: false,
  },
  {
    symbol: "EURUSD",
    name: "Euro / Dollar",
    market: "FOREX",
    price: 1.08462,
    change: -0.12,
    open: false,
    alerts: false,
  },
];

const baseTrade = {
  id: "trade-xau",
  symbol: "XAUUSD",
  direction: "LONG",
  entry: 4358.1,
  stop: 4347.2,
  target: 4384.5,
  progress: 61,
  r: 1.26,
  status: "TP1 HIT",
};

const baseNotification = {
  id: "notification-xau",
  timestamp: 1,
  timeLabel: "06m",
  symbol: "XAUUSD",
  type: "RETEST_READY",
  title: "XAUUSD retest window",
  message: "Price returned to the DGv8 buy gate. Validate before entry.",
  actionRequired: "RETEST_READY",
  isRead: false,
  signalId: "signal-xau",
};

function makeStore(overrides: Record<string, unknown> = {}) {
  return {
    hydrated: true,
    authenticated: false,
    signals: [signal],
    watchlist: baseWatchlist.map((item) => ({ ...item })),
    profile: { membership: "Pro" },
    mt5Connected: true,
    toggleWatch: jest.fn(),
    toggleAlert: jest.fn(),
    refreshMarket: jest.fn().mockResolvedValue(undefined),
    trades: [{ ...baseTrade }],
    closeTrade: jest.fn(),
    notifications: [{ ...baseNotification }],
    notificationSyncState: "local",
    markNotificationRead: jest.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function useStore(overrides: Record<string, unknown> = {}) {
  const store = makeStore(overrides);
  mockUseTradify.mockReturnValue(store);
  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  for (const queryClient of notificationQueryClients.splice(0)) queryClient.clear();
});

describe("market data status labels", () => {
  type FeedStatusItem = {
    price: number;
    dataState?: "LIVE" | "FALLBACK" | "STALE" | "ERROR";
    referenceState?: "REFERENCE" | "STALE" | "UNAVAILABLE";
  };
  const ActualFeedStatus: React.ComponentType<{ items: FeedStatusItem[] }> =
    jest.requireActual("../components/TradifyUI").FeedStatus;

  it("reflects live, reference, stale, and unavailable priced markets without fixed refresh claims", () => {
    const { rerender } = render(<ActualFeedStatus items={[{ price: 1, dataState: "LIVE" }]} />);
    expect(screen.getByText("LIVE PRICES")).toBeTruthy();
    expect(screen.queryByText("5s")).toBeNull();

    rerender(
      <ActualFeedStatus
        items={[{ price: 1, dataState: "FALLBACK", referenceState: "REFERENCE" }]}
      />,
    );
    expect(screen.getByText("REFERENCE PRICES")).toBeTruthy();

    rerender(
      <ActualFeedStatus items={[{ price: 1, dataState: "STALE", referenceState: "STALE" }]} />,
    );
    expect(screen.getByText("STALE PRICES")).toBeTruthy();

    rerender(<ActualFeedStatus items={[{ price: 0, dataState: "ERROR" }]} />);
    expect(screen.getByText("PRICES UNAVAILABLE")).toBeTruthy();
  });
});

describe("Watchlist restored actions", () => {
  it("labels live, reference, stale, and unavailable prices separately", () => {
    const store = useStore({
      watchlist: [
        { ...baseWatchlist[0], dataState: "LIVE" },
        { ...baseWatchlist[1], dataState: "FALLBACK", referenceState: "REFERENCE" },
        {
          symbol: "GBPUSD",
          name: "Pound / Dollar",
          market: "FOREX",
          price: 1.27,
          change: 0.1,
          open: true,
          alerts: false,
          dataState: "STALE",
          referenceState: "STALE",
        },
        {
          symbol: "USOIL",
          name: "WTI Crude",
          market: "COMMODITIES",
          price: 72.5,
          change: 0,
          open: true,
          alerts: false,
          dataState: "ERROR",
          referenceState: "UNAVAILABLE",
        },
      ],
    });
    const WatchlistScreen = require("../app/(tabs)/watchlist").default;
    render(<WatchlistScreen />);

    expect(screen.getByTestId("price-state-badge-LIVE")).toHaveTextContent("LIVE");
    expect(screen.getByTestId("price-state-badge-REFERENCE")).toHaveTextContent("REFERENCE");
    expect(screen.getByTestId("price-state-badge-STALE")).toHaveTextContent("STALE");
    expect(screen.getByTestId("price-state-badge-UNAVAILABLE")).toHaveTextContent("UNAVAILABLE");
    expect(screen.getByTestId("market-row-USOIL").props.accessibilityLabel).toContain(
      "UNAVAILABLE PRICE",
    );
    expect(store.watchlist).toHaveLength(4);
  });

  it("switches tabs, filters the catalog, and refreshes market data", async () => {
    const store = useStore();
    const WatchlistScreen = require("../app/(tabs)/watchlist").default;
    const { getByTestId, queryByTestId } = render(<WatchlistScreen />);

    expect(screen.getByText("My Watchlist (2)")).toBeTruthy();
    fireEvent.press(getByTestId("all-markets-tab"));
    expect(screen.getByTestId("market-search")).toBeTruthy();

    fireEvent.changeText(getByTestId("market-search"), "EUR");
    expect(getByTestId("market-row-EURUSD")).toBeTruthy();
    expect(queryByTestId("market-row-XAUUSD")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("refresh-watchlist"));
      await Promise.resolve();
    });
    expect(store.refreshMarket).toHaveBeenCalledTimes(1);
  });

  it("opens the add-market sheet and supports removing and adding a market", () => {
    const store = useStore();
    const WatchlistScreen = require("../app/(tabs)/watchlist").default;
    const { getByTestId, rerender } = render(<WatchlistScreen />);

    fireEvent.press(getByTestId("add-market"));
    expect(getByTestId("market-modal")).toBeTruthy();
    fireEvent.press(getByTestId("modal-toggle-XAUUSD"));
    expect(store.toggleWatch).toHaveBeenCalledWith("XAUUSD");

    store.watchlist[0].open = false;
    rerender(<WatchlistScreen />);
    fireEvent.press(getByTestId("modal-toggle-XAUUSD"));
    expect(store.toggleWatch).toHaveBeenCalledTimes(2);
  });

  it("opens the linked signal when a market alert is selected", () => {
    useStore();
    const WatchlistScreen = require("../app/(tabs)/watchlist").default;
    render(<WatchlistScreen />);

    fireEvent.press(screen.getByTestId("market-row-XAUUSD"));
    expect(mockRouterPush).toHaveBeenCalledWith("/signal/signal-xau");
  });

  it("opens a chart for a market without a signal", () => {
    useStore({ signals: [] });
    const WatchlistScreen = require("../app/(tabs)/watchlist").default;
    render(<WatchlistScreen />);

    fireEvent.press(screen.getByTestId("market-row-XAUUSD"));
    expect(mockRouterPush).toHaveBeenCalledWith("/chart/XAUUSD");
  });

  it("keeps watchlist controls stacked, reachable, and clearly labelled at large text sizes", () => {
    const originalWindow = Dimensions.get("window");
    const originalScreen = Dimensions.get("screen");
    Dimensions.set({
      window: { ...originalWindow, width: 360, height: 780, fontScale: 2 },
      screen: { ...originalScreen, width: 360, height: 780, fontScale: 2 },
    });

    let rendered: ReturnType<typeof render> | undefined;
    try {
      useStore({ watchlist: baseWatchlist.map((item) => ({ ...item, dataState: "LIVE" })) });
      const WatchlistScreen = require("../app/(tabs)/watchlist").default;
      rendered = render(<WatchlistScreen />);

      expect(StyleSheet.flatten(screen.getByTestId("watchlist-tab").props.style).width).toBe(
        "100%",
      );
      expect(
        StyleSheet.flatten(screen.getByTestId("market-actions-XAUUSD").props.style).flexDirection,
      ).toBe("column");
      expect(screen.getByTestId("market-row-XAUUSD").props.accessibilityRole).toBe("button");
      expect(screen.getByTestId("market-row-XAUUSD").props.accessibilityLabel).toContain(
        "LIVE PRICE. Price 4,361.84000",
      );
      expect(screen.getByTestId("toggle-watch-XAUUSD").props.accessibilityLabel).toBe(
        "Remove XAUUSD from watchlist",
      );
    } finally {
      rendered?.unmount();
      Dimensions.set({ window: originalWindow, screen: originalScreen });
    }
  });
});

describe("Opportunities empty and educational states", () => {
  it("explains when the live feed is disconnected and offers the watchlist", () => {
    useStore({ signals: [], mt5Connected: false });
    const OpportunitiesScreen = require("../app/(tabs)/index").default;
    render(<OpportunitiesScreen />);

    expect(screen.getByText("Waiting for live market data")).toBeTruthy();
    expect(screen.getByText(/only show a qualified opportunity/)).toBeTruthy();
    expect(screen.getByTestId("educational-preview")).toBeTruthy();
    fireEvent.press(screen.getByTestId("empty-action"));
    expect(mockRouterPush).toHaveBeenCalledWith("/watchlist");
  });

  it("replaces the disconnected state with setup cards when live data returns", () => {
    const store = useStore({ signals: [], mt5Connected: false });
    const OpportunitiesScreen = require("../app/(tabs)/index").default;
    const view = render(<OpportunitiesScreen />);

    expect(screen.getByText("Waiting for live market data")).toBeTruthy();
    expect(screen.getByTestId("educational-preview")).toBeTruthy();

    store.signals = [signal];
    store.mt5Connected = true;
    view.rerender(<OpportunitiesScreen />);

    expect(screen.getByText("XAUUSD")).toBeTruthy();
    expect(screen.queryByText("Waiting for live market data")).toBeNull();
    expect(screen.queryByTestId("educational-preview")).toBeNull();
  });

  it("keeps the educational preview after a refresh with no qualified setup", async () => {
    const store = useStore({ signals: [signal], mt5Connected: true });
    const OpportunitiesScreen = require("../app/(tabs)/index").default;
    const view = render(<OpportunitiesScreen />);

    expect(screen.getByText("XAUUSD")).toBeTruthy();
    store.refreshMarket.mockImplementation(async () => {
      store.signals = [];
      store.mt5Connected = true;
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("refresh-live-engine"));
      await Promise.resolve();
    });
    view.rerender(<OpportunitiesScreen />);

    expect(screen.getByText("No qualified setup right now")).toBeTruthy();
    expect(screen.queryByTestId("signal-card-XAUUSD")).toBeNull();
    expect(screen.getByTestId("educational-preview")).toBeTruthy();
    fireEvent.press(screen.getByTestId("educational-methodology"));
    expect(mockRouterPush).toHaveBeenCalledWith("/legal");
  });

  it("explains when filters hide available setups and clears them", () => {
    useStore({ signals: [signal] });
    const OpportunitiesScreen = require("../app/(tabs)/index").default;
    render(<OpportunitiesScreen />);

    fireEvent.press(screen.getByTestId("market-filter-FOREX"));
    expect(screen.getByText("No setups match these filters")).toBeTruthy();
    expect(screen.getByText(/1 qualified setup outside this view/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("empty-action"));
    expect(screen.getByText("XAUUSD")).toBeTruthy();
  });

  it("shows a non-tradable entry, stop, target, and thesis preview without a live setup", () => {
    useStore({ signals: [], mt5Connected: true });
    const OpportunitiesScreen = require("../app/(tabs)/index").default;
    render(<OpportunitiesScreen />);

    expect(screen.getByText("No qualified setup right now")).toBeTruthy();
    expect(screen.getByTestId("educational-preview")).toBeTruthy();
    expect(screen.getByText("EDUCATIONAL PREVIEW")).toBeTruthy();
    expect(screen.getByText("Entry")).toBeTruthy();
    expect(screen.getByText("Stop")).toBeTruthy();
    expect(screen.getByText("Target")).toBeTruthy();
    expect(screen.getByText("Thesis")).toBeTruthy();
    fireEvent.press(screen.getByTestId("educational-methodology"));
    expect(mockRouterPush).toHaveBeenCalledWith("/legal");
  });

  it("enables monitoring for a selected watchlist market and confirms it visibly", () => {
    const store = useStore({ signals: [], mt5Connected: true });
    const OpportunitiesScreen = require("../app/(tabs)/index").default;
    render(<OpportunitiesScreen />);

    fireEvent.press(screen.getByTestId("quiet-alert-market-XAGUSD"));
    fireEvent.press(screen.getByTestId("quiet-enable-alert"));

    expect(store.toggleAlert).toHaveBeenCalledWith("XAGUSD");
    expect(screen.getByTestId("quiet-alert-confirmation")).toBeTruthy();
    expect(screen.getByText(/Monitoring enabled for XAGUSD/)).toBeTruthy();
    expect(screen.getByText(/does not signal a trade/)).toBeTruthy();
  });

  it("stacks opportunity filters and keeps refresh and filter labels available at large text sizes", () => {
    const originalWindow = Dimensions.get("window");
    const originalScreen = Dimensions.get("screen");
    Dimensions.set({
      window: { ...originalWindow, width: 360, height: 780, fontScale: 2 },
      screen: { ...originalScreen, width: 360, height: 780, fontScale: 2 },
    });

    let rendered: ReturnType<typeof render> | undefined;
    try {
      useStore();
      const OpportunitiesScreen = require("../app/(tabs)/index").default;
      rendered = render(<OpportunitiesScreen />);

      expect(
        StyleSheet.flatten(screen.getByTestId("opportunities-intro").props.style).flexDirection,
      ).toBe("column");
      expect(
        StyleSheet.flatten(screen.getByTestId("market-filter-group").props.style).flexDirection,
      ).toBe("column");
      expect(
        StyleSheet.flatten(screen.getByTestId("market-filter-ALL").props.style).minHeight,
      ).toBe(44);
      expect(screen.getByTestId("refresh-live-engine").props.accessibilityLabel).toBe(
        "Refresh opportunities",
      );
      expect(screen.getByTestId("market-filter-ALL").props.accessibilityLabel).toBe("Market: ALL");
    } finally {
      rendered?.unmount();
      Dimensions.set({ window: originalWindow, screen: originalScreen });
    }
  });
});

describe("Trades and performance restored actions", () => {
  it("locks partials, closes a trade, and navigates to its plan", () => {
    const store = useStore();
    const TradesScreen = require("../app/(tabs)/trades").default;
    render(<TradesScreen />);

    fireEvent.press(screen.getByTestId("lock-partials-trade-xau"));
    expect(screen.getByText("Partials Locked")).toBeTruthy();
    fireEvent.press(screen.getByTestId("view-plan-trade-xau"));
    expect(mockRouterPush).toHaveBeenCalledWith("/signal/signal-xau");
    fireEvent.press(screen.getByTestId("close-trade-trade-xau"));
    expect(store.closeTrade).toHaveBeenCalledWith("trade-xau");
  });

  it("navigates from a performance history row to the audit plan", () => {
    useStore({ trades: [{ ...baseTrade, status: "CLOSED", r: 1.26 }] });
    const PerformanceScreen = require("../app/(tabs)/performance").default;
    render(<PerformanceScreen />);

    fireEvent.press(screen.getByTestId("audit-plan-signal-xau"));
    expect(mockRouterPush).toHaveBeenCalledWith("/signal/signal-xau");
  });
});

describe("Notification restored actions", () => {
  it("shows loading history without flashing the empty state", () => {
    useStore({ authenticated: true, notificationSyncState: "loading", notifications: [] });
    const NotificationsScreen = require("../app/(tabs)/notifications").default;
    renderNotificationsScreen(NotificationsScreen);
    expect(screen.getByTestId("notifications-loading")).toBeTruthy();
    expect(screen.queryByText("No Action-Changing Notifications")).toBeNull();
  });

  it.each([
    ["synced", true, "Synced across devices"],
    ["local", false, "Local preview · sign in to sync history"],
    ["local", true, "Saved locally · sign in to sync history"],
    ["offline", true, "Offline · showing saved alerts"],
  ])("renders %s notification status (authenticated=%s)", (state, authenticated, label) => {
    useStore({ authenticated, notificationSyncState: state });
    const NotificationsScreen = require("../app/(tabs)/notifications").default;
    renderNotificationsScreen(NotificationsScreen);
    expect(screen.getByText(label as string)).toBeTruthy();
    expect(screen.getByLabelText("Unread alert from XAUUSD: XAUUSD retest window")).toBeTruthy();
    expect(screen.queryByTestId("notifications-loading")).toBeNull();
  });

  it("shows the empty state after a successful empty history load", () => {
    useStore({ authenticated: true, notificationSyncState: "synced", notifications: [] });
    const NotificationsScreen = require("../app/(tabs)/notifications").default;
    renderNotificationsScreen(NotificationsScreen);
    expect(screen.getByText("No Action-Changing Notifications")).toBeTruthy();
    expect(screen.getByText("Validated setup events and status changes will appear here.")).toBeTruthy();
    expect(screen.queryByTestId("notifications-loading")).toBeNull();
  });

  it("restores unread styling and mark-all availability when a write rolls back offline", () => {
    const store = useStore({ authenticated: true, notificationSyncState: "synced" });
    const NotificationsScreen = require("../app/(tabs)/notifications").default;
    const { rerender } = renderNotificationsScreen(NotificationsScreen);
    store.notifications = [{ ...baseNotification, isRead: true }];
    rerender();
    expect(screen.getByLabelText("Read alert from XAUUSD: XAUUSD retest window")).toBeTruthy();
    expect(screen.getByTestId("mark-all-read").props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId("mark-all-read"));
    expect(store.markAllNotificationsRead).not.toHaveBeenCalled();

    store.notifications = [{ ...baseNotification }];
    store.notificationSyncState = "offline";
    rerender();
    expect(screen.getByText("Offline · showing saved alerts")).toBeTruthy();
    expect(screen.getByLabelText("Unread alert from XAUUSD: XAUUSD retest window")).toBeTruthy();
    expect(screen.getByTestId("mark-all-read").props.accessibilityState.disabled).toBe(false);
  });

  it("marks an alert read, opens its signal, and supports mark-all-read", async () => {
    const store = useStore();
    const NotificationsScreen = require("../app/(tabs)/notifications").default;
    renderNotificationsScreen(NotificationsScreen);

    fireEvent.press(screen.getByTestId("notification-notification-xau"));
    expect(store.markNotificationRead).toHaveBeenCalledWith("notification-xau");
    expect(mockRouterPush).toHaveBeenCalledWith("/signal/signal-xau");
    fireEvent.press(screen.getByTestId("mark-all-read"));
    expect(store.markAllNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it("saves event notification preferences", async () => {
    useStore({ authenticated: true, notificationSyncState: "synced", notifications: [] });
    mockUpdateNotificationPreferences.mockClear();
    const NotificationsScreen = require("../app/(tabs)/notifications").default;
    renderNotificationsScreen(NotificationsScreen);

    fireEvent.press(screen.getByText("New validated signals"));
    await waitFor(() =>
      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith({
        data: { newSignals: true },
      }),
    );
  });
});

describe("Profile account action safeguards", () => {
  it("opens the delete confirmation before any account data is removed", () => {
    useStore({
      authenticated: true,
      profile: { name: "Trader", email: "trader@example.com", membership: "Pro", role: "trader" },
      deleteAccount: jest.fn(),
    });
    const ProfileScreen = require("../app/(tabs)/profile").default;
    render(<ProfileScreen />);

    fireEvent.press(screen.getByTestId("profile-delete-account"));

    expect(screen.getByText("This cannot be undone.")).toBeTruthy();
  });
});
