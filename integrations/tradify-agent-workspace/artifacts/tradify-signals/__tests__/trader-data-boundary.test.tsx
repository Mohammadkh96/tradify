import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseTradify = jest.fn();
const mockGetMarketCandles = jest.fn();
const mockGetSignalEvaluation = jest.fn();
const mockGetMarketsCatalog = jest.fn();
const mockCustomFetch = jest.fn(() => Promise.resolve({}));
const mockNotificationPreferences = {
  newSignals: false,
  entries: false,
  takeProfits: false,
  stopLosses: false,
  breakevenAndChanges: false,
  announcements: false,
};

jest.mock("@/lib/tradify-store", () => ({
  useTradify: mockUseTradify,
  hasTradeDetails: (trade: { locked?: boolean }) => trade.locked !== true,
}));
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "signal-xau" }),
}));
jest.mock("@workspace/api-client-react", () => ({
  customFetch: mockCustomFetch,
  getGetUserNotificationPreferencesQueryKey: () => ["/api/user/notification-preferences"],
  useGetUserNotificationPreferences: () => ({
    data: mockNotificationPreferences,
    isError: false,
    queryKey: ["/api/user/notification-preferences"],
  }),
  useUpdateUserNotificationPreferences: () => ({ mutateAsync: jest.fn() }),
  getMarketCandles: mockGetMarketCandles,
  getSignalEvaluation: mockGetSignalEvaluation,
  getMarketsCatalog: mockGetMarketsCatalog,
  serializeApiRequestError: jest.fn((error: unknown) => ({
    message: String(error),
    failureType: "unknown",
    timestamp: "now",
  })),
}));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, Ionicons: Icon, MaterialCommunityIcons: Icon };
});
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    accent: "#233a43",
    accentForeground: "#c3e6dd",
    background: "#0b1117",
    card: "#121b24",
    border: "#263640",
    chart: "#8b7cff",
    destructive: "#db6e68",
    destructiveForeground: "#ffffff",
    foreground: "#e8edf2",
    input: "#0e1217",
    muted: "#1a2730",
    mutedForeground: "#8c9ba6",
    primary: "#d2a85b",
    primaryForeground: "#11161b",
    secondary: "#1a2730",
    secondaryForeground: "#e8edf2",
    success: "#72c5a8",
    warning: "#d2a85b",
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const forbiddenDetails = [
  "INTERNAL_PROVIDER_YAHOO",
  "GC=F",
  "BROKER_SYMBOL_GC_F",
  "INTERNAL_STRATEGY_DGV8",
  "DGV8",
  "DGv8",
  "INTERNAL_PROVENANCE_CONFIRMED",
  "INTERNAL_DIAGNOSTIC_HTTP_4014",
  "INTERNAL_TICK_DATA",
  "MT5",
];

function renderNotificationsScreen(Screen: React.ComponentType) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Screen />
    </QueryClientProvider>,
  );
}

const candles = [
  {
    time: 1_700_000_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 10,
  },
];

const signal = {
  id: "signal-xau",
  symbol: "XAUUSD",
  name: "Gold / US Dollar",
  market: "METALS" as const,
  direction: "LONG" as const,
  strategy: "DGv8" as const,
  grade: "A+" as const,
  action: "WAIT FOR RETEST",
  price: 100.2,
  entry: 100.5,
  stop: 98,
  tp1: 102,
  tp2: 103,
  tp3: 104,
  session: "LONDON",
  age: "06m",
  note: "Validate before entry.",
  dataState: "LIVE" as const,
  provider: "INTERNAL_PROVIDER_YAHOO",
  providerSymbol: "BROKER_SYMBOL_GC_F",
  provenance: { source: "INTERNAL_PROVENANCE_CONFIRMED" },
  strategyFacts: { strategy: "INTERNAL_STRATEGY_DGV8", tickData: "INTERNAL_TICK_DATA" },
  dgv8ChartLevels: { buyGate: 100.5, buyStop: 98, buyTargets: [102, 103, 104] },
};

const watchlist = [
  {
    symbol: "XAUUSD",
    name: "Gold",
    market: "METALS" as const,
    price: 100.2,
    change: 0.42,
    open: true,
    alerts: true,
    provider: "INTERNAL_PROVIDER_YAHOO",
    brokerSymbol: "BROKER_SYMBOL_GC_F",
  },
];

const notification = {
  id: "notification-xau",
  timestamp: 1,
  timeLabel: "06m",
  symbol: "XAUUSD",
  type: "RETEST_READY" as const,
  title: "XAUUSD retest window",
  message: "Price returned to the active entry area. Validate before entry.",
  actionRequired: "RETEST_READY",
  isRead: false,
  signalId: "signal-xau",
  provider: "INTERNAL_PROVIDER_YAHOO",
  brokerSymbol: "BROKER_SYMBOL_GC_F",
  strategy: "INTERNAL_STRATEGY_DGV8",
  provenance: "INTERNAL_PROVENANCE_CONFIRMED",
  diagnostics: "INTERNAL_DIAGNOSTIC_HTTP_4014",
  tickData: "INTERNAL_TICK_DATA",
};

const alert = {
  id: "alert-xau",
  symbol: "XAUUSD",
  condition: "ABOVE" as const,
  target: 102,
  label: "London continuation",
  active: true,
  provider: "INTERNAL_PROVIDER_YAHOO",
  brokerSymbol: "BROKER_SYMBOL_GC_F",
  strategy: "INTERNAL_STRATEGY_DGV8",
  provenance: "INTERNAL_PROVENANCE_CONFIRMED",
  diagnostics: "INTERNAL_DIAGNOSTIC_HTTP_4014",
  tickData: "INTERNAL_TICK_DATA",
};

const profile = {
  name: "Trader",
  email: "trader@example.test",
  accountSize: 10000,
  riskPercent: 0.5,
  maxDailyLoss: 2,
  maxTrades: 3,
  aggressive: false,
  membership: "Pro" as const,
  role: "user" as const,
  status: "active" as const,
};

function makeStore() {
  return {
    hydrated: true,
    authenticated: true,
    signals: [signal],
    watchlist: [watchlist[0]],
    mt5Connected: true,
    trades: [
      {
        id: "trade-xau",
        symbol: "XAUUSD",
        direction: "LONG" as const,
        entry: 100,
        stop: 98,
        target: 103,
        progress: 61,
        r: 1.26,
        status: "CLOSED" as const,
        provider: "INTERNAL_PROVIDER_YAHOO",
        brokerSymbol: "BROKER_SYMBOL_GC_F",
        strategy: "INTERNAL_STRATEGY_DGV8",
        provenance: "INTERNAL_PROVENANCE_CONFIRMED",
        diagnostics: "INTERNAL_DIAGNOSTIC_HTTP_4014",
        tickData: "INTERNAL_TICK_DATA",
      },
    ],
    alerts: [alert],
    notifications: [notification],
    notificationSyncState: "synced",
    profile,
    selectedStrategy: "DGv8" as const,
    selectedStrategiesBySymbol: {},
    toggleWatch: jest.fn(),
    refreshMarket: jest.fn(),
    closeTrade: jest.fn(),
    markNotificationRead: jest.fn(),
    markAllNotificationsRead: jest.fn(),
    removeAlert: jest.fn(),
    addAlert: jest.fn(),
    setStrategy: jest.fn(),
    setStrategyForSymbol: jest.fn(),
    signOut: jest.fn(),
  };
}

type RenderNode = {
  props?: { accessibilityLabel?: unknown };
  children?: Array<RenderNode | string> | null;
};

function collectSurface(node: unknown, text: string[] = [], labels: string[] = []) {
  if (typeof node === "string") {
    text.push(node);
    return { text, labels };
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectSurface(child, text, labels));
    return { text, labels };
  }
  if (!node || typeof node !== "object") return { text, labels };
  const current = node as RenderNode;
  if (typeof current.props?.accessibilityLabel === "string")
    labels.push(current.props.accessibilityLabel);
  current.children?.forEach((child) => collectSurface(child, text, labels));
  return { text, labels };
}

function expectTraderSurfaceIsSanitized(rendered: { toJSON: () => unknown }) {
  const surface = collectSurface(rendered.toJSON());
  const visibleValues = [...surface.text, ...surface.labels].join(" ");
  forbiddenDetails.forEach((detail) => {
    expect(visibleValues).not.toContain(detail);
  });
}

async function settleAnimatedUpdates() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTradify.mockReturnValue(makeStore());
  mockGetMarketsCatalog.mockResolvedValue([
    {
      symbol: "XAUUSD",
      availableStrategies: ["DGV8", "BBB_GOLD_3S"],
      defaultStrategyId: "DGV8",
    },
  ]);
  mockGetMarketCandles.mockResolvedValue({
    symbol: "XAUUSD",
    provider: "INTERNAL_PROVIDER_YAHOO",
    providerSymbol: "BROKER_SYMBOL_GC_F",
    timeframe: "M15",
    timezone: "UTC",
    candles,
    dataState: "LIVE",
    displayOnly: false,
    validation: { valid: true },
  });
  mockGetSignalEvaluation.mockResolvedValue({
    signal,
    diagnostic: { code: "INTERNAL_DIAGNOSTIC_HTTP_4014" },
    quote: { provider: "INTERNAL_PROVIDER_YAHOO", tickData: "INTERNAL_TICK_DATA" },
    candles: {
      symbol: "XAUUSD",
      provider: "INTERNAL_PROVIDER_YAHOO",
      providerSymbol: "BROKER_SYMBOL_GC_F",
      timeframe: "M15",
      timezone: "UTC",
      candles,
      dataState: "LIVE",
      displayOnly: false,
      validation: { valid: true },
    },
  });
});

describe("trader data boundary", () => {
  it("keeps opportunity cards free of internal details", async () => {
    const OpportunitiesScreen = require("../app/(tabs)/index").default;
    const rendered = render(<OpportunitiesScreen />);
    await settleAnimatedUpdates();
    expectTraderSurfaceIsSanitized(rendered);
    rendered.unmount();
  }, 15_000);

  it("keeps signal detail free of internal details", async () => {
    const SignalDetailScreen = require("../app/signal/[id]").default;
    const rendered = render(<SignalDetailScreen />);
    await waitFor(() => expect(mockGetSignalEvaluation).toHaveBeenCalled());
    expectTraderSurfaceIsSanitized(rendered);
    rendered.unmount();
  });

  it("keeps watchlist free of internal details", async () => {
    const WatchlistScreen = require("../app/(tabs)/watchlist").default;
    const rendered = render(<WatchlistScreen />);
    await settleAnimatedUpdates();
    expectTraderSurfaceIsSanitized(rendered);
    rendered.unmount();
  });

  it("keeps performance free of internal details", () => {
    const PerformanceScreen = require("../app/(tabs)/performance").default;
    const rendered = render(<PerformanceScreen />);
    expectTraderSurfaceIsSanitized(rendered);
    rendered.unmount();
  });

  it("keeps notification alerts free of internal details", () => {
    const NotificationsScreen = require("../app/(tabs)/notifications").default;
    const rendered = renderNotificationsScreen(NotificationsScreen);
    expectTraderSurfaceIsSanitized(rendered);
    rendered.unmount();
  });

  it("keeps price alerts free of internal details", () => {
    const AlertsScreen = require("../app/alerts").default;
    const rendered = render(<AlertsScreen />);
    expectTraderSurfaceIsSanitized(rendered);
    rendered.unmount();
  });

  it("keeps the trader profile free of internal details", () => {
    const ProfileScreen = require("../app/(tabs)/profile").default;
    const rendered = render(<ProfileScreen />);
    expectTraderSurfaceIsSanitized(rendered);
    rendered.unmount();
  });
});
