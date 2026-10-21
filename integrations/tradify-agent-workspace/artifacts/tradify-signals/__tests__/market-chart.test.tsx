import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockGetMarketCandles = jest.fn();
const mockUseTradify = jest.fn();
const mockRouterBack = jest.fn();
const mockSearchParams = { symbol: "XAUUSD" };

jest.mock("@workspace/api-client-react", () => ({
  getMarketCandles: mockGetMarketCandles,
}));

jest.mock("expo-router", () => ({
  router: { back: mockRouterBack },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("@/lib/tradify-store", () => ({
  useTradify: () => {
    const store = mockUseTradify();
    return { ...store, profile: store.profile ?? { membership: "Pro" } };
  },
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#101714",
    border: "#354238",
    card: "#1B2520",
    foreground: "#F4F5ED",
    mutedForeground: "#ADB8AC",
    primary: "#D1F57A",
    primaryForeground: "#172012",
    secondary: "#222E27",
  }),
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Feather: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock("@/components/TradifyUI", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  return {
    Screen: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    MarketCandleChart: ({
      candles,
      dataState,
      displayOnly,
      timeframe,
    }: {
      candles: unknown[];
      dataState: string;
      displayOnly: boolean;
      timeframe: string;
    }) => (
      <View testID="market-candle-chart">
        <Text testID="chart-summary">{`${timeframe} · ${dataState} · ${displayOnly ? "reference" : "live"} · ${candles.length}`}</Text>
      </View>
    ),
  };
});

describe("standalone market chart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTradify.mockReturnValue({
      watchlist: [{ symbol: "XAUUSD", name: "Gold", price: 4128, dataState: "LIVE" }],
    });
    mockGetMarketCandles.mockImplementation(async ({ timeframe }: { timeframe: string }) => ({
      symbol: "XAUUSD",
      timeframe,
      timezone: "UTC",
      candles: [{ time: 1, open: 10, high: 11, low: 9, close: 10.5, volume: 2 }],
      dataState: "FALLBACK",
      displayOnly: true,
      validation: { valid: false, candleCount: 1 },
    }));
  });

  it("loads reference candles and requests the selected timeframe without evaluating strategies", async () => {
    const MarketChartScreen = require("../app/chart/[symbol]").default;
    render(<MarketChartScreen />);

    await waitFor(() => {
      expect(mockGetMarketCandles).toHaveBeenCalledWith({
        symbol: "XAUUSD",
        timeframe: "M15",
        limit: 250,
      });
    });
    expect(await screen.findByText("M15 · FALLBACK · reference · 1")).toBeTruthy();

    fireEvent.press(screen.getByTestId("market-chart-timeframe-H1"));
    await waitFor(() => {
      expect(mockGetMarketCandles).toHaveBeenCalledWith({
        symbol: "XAUUSD",
        timeframe: "H1",
        limit: 250,
      });
    });
  });
});
