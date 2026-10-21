import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Dimensions, Platform, StyleSheet } from "react-native";
import { trustedM15Response } from "./fixtures/trusted-mt5-m15";
import {
  MarketCandleChart,
  SignalCard,
  chartAxisPaddingFromDrag,
  chartZoomFromPinch,
  toHeikinAshi,
} from "@/components/TradifyUI";

const mockUseTradify = jest.fn();
const mockGetMarketCandles = jest.fn();
const mockGetMarketQuotes = jest.fn();
const mockGetSignalEvaluation = jest.fn();
const mockGetMarketsCatalog = jest.fn();
const mockRouterBack = jest.fn();

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

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, Ionicons: Icon, MaterialCommunityIcons: Icon };
});

jest.mock("@/lib/tradify-store", () => ({
  useTradify: () => {
    const store = mockUseTradify();
    return { ...store, profile: store.profile ?? { membership: "VIP" } };
  },
}));

jest.mock("expo-router", () => ({
  router: { back: mockRouterBack, push: jest.fn() },
  useLocalSearchParams: () => ({ id: "signal-xau" }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@workspace/api-client-react", () => ({
  getMarketCandles: mockGetMarketCandles,
  getMarketQuotes: mockGetMarketQuotes,
  getSignalEvaluation: mockGetSignalEvaluation,
  getMarketsCatalog: mockGetMarketsCatalog,
}));

const candles = Array.from({ length: 80 }, (_, index) => ({
  time: 1_700_000_000 + index * 900,
  open: 100 + index * 0.1,
  high: 101 + index * 0.1,
  low: 99 + index * 0.1,
  close: 100.5 + index * 0.1,
  volume: 10 + index,
}));

const levels = {
  direction: "LONG" as const,
  entry: 106.3,
  buyGate: 106.3,
  sellGate: 105.1,
  buyStop: 104.8,
  sellStop: 107.1,
  buyTargets: [107.2, 108.1, 109.4, 110.3, 111.2],
  sellTargets: [104.2, 103.4, 102.3, 101.5, 100.7],
  sourceHigh: 105.8,
  sourceLow: 100.2,
  pivotResistance: 106,
  pivotSupport: 100.6,
  activeBreakLevel: 106.3,
};

const signal = {
  id: "signal-xau",
  symbol: "XAUUSD",
  name: "Gold / US Dollar",
  market: "METALS",
  direction: "LONG",
  strategy: "DGv8",
  grade: "A+",
  action: "WAIT FOR RETEST",
  price: 106.1,
  entry: 106.3,
  stop: 104.8,
  tp1: 107.2,
  tp2: 108.1,
  tp3: 109.4,
  session: "LONDON",
  age: "06m",
  note: "Validate before entry.",
  dataState: "LIVE",
  dgv8ChartLevels: levels,
  levels: { buyEntry: 106.3, sellEntry: 105.1 },
};

describe("market candle chart", () => {
  it("mounts one local lightweight-charts WebView renderer", () => {
    const chart = render(<MarketCandleChart candles={candles} levels={levels} title="XAUUSD" />);
    const webView = screen.getByTestId("chart-webview");
    expect(webView).toBeTruthy();
    expect(webView.props.source.html).toContain("LightweightCharts");
    expect(webView.props.source.html).toContain("touch-action: none");
    expect(webView.props.source.html).toContain("priceAxisTouch");
    expect(webView.props.source.html).toContain("applyPriceAxisPadding");
    expect(webView.props.source.html).not.toContain("cdn.");
  });

  it("hands native touch ownership to the chart while it is being manipulated", () => {
    const onInteractionStart = jest.fn();
    const onInteractionEnd = jest.fn();
    render(
      <MarketCandleChart
        candles={candles}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />,
    );
    const webView = screen.getByTestId("chart-webview");
    expect(webView.props.onTouchStart).toBe(onInteractionStart);
    expect(webView.props.onTouchEnd).toBe(onInteractionEnd);
    expect(webView.props.onTouchCancel).toBe(onInteractionEnd);
  });

  it("passes chart data through the WebView bridge without rendering fake fallback series", () => {
    const chart = render(
      <MarketCandleChart
        candles={candles}
        provider="Yahoo"
        providerSymbol="GC=F"
        dataState="FALLBACK"
        displayOnly
        levels={levels}
        title="XAUUSD"
      />,
    );
    const webView = screen.getByTestId("chart-webview");
    expect(webView.props.source.html).toContain("dataState");
    expect(chart.queryByTestId("chart-scroll-to-realtime")).toBeNull();
  });

  it("transforms candles into Heikin-Ashi values without changing the source series", () => {
    const transformed = toHeikinAshi(candles.slice(0, 2));

    expect(transformed).toHaveLength(2);
    expect(transformed[0].open).toBe((candles[0].open + candles[0].close) / 2);
    expect(transformed[0].close).toBe(
      (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4,
    );
    expect(transformed[0].high).toBe(
      Math.max(candles[0].high, transformed[0].open, transformed[0].close),
    );
    expect(candles[0].open).toBe(100);
  });

  it("converts pinch distance and price-scale drag into bounded chart viewport changes", () => {
    expect(chartZoomFromPinch(1, 100, 180)).toBe(1.8);
    expect(chartZoomFromPinch(2.8, 100, 180)).toBe(3);
    expect(chartAxisPaddingFromDrag(0.06, 180)).toBeCloseTo(0.26);
    expect(chartAxisPaddingFromDrag(0.06, -180)).toBeCloseTo(0.015);
  });

  it("forwards crosshair OHLCV values from the chart to React Native", () => {
    const onCrosshairChange = jest.fn();
    render(<MarketCandleChart candles={candles} onCrosshairChange={onCrosshairChange} />);
    const webView = screen.getByTestId("chart-webview");
    fireEvent(webView, "message", {
      nativeEvent: {
        data: JSON.stringify({
          type: "CROSSHAIR",
          payload: {
            active: true,
            candle: candles[12],
            time: candles[12].time,
            value: candles[12].close,
          },
        }),
      },
    });
    expect(onCrosshairChange).toHaveBeenCalledWith(
      expect.objectContaining({ index: 12, timeframe: "M15", timezone: "UTC" }),
    );
  });

  it("forwards viewport changes and requests older history from the left edge", async () => {
    const onViewportChange = jest.fn();
    const onLoadOlderHistory = jest.fn().mockResolvedValue(undefined);
    render(
      <MarketCandleChart
        candles={candles}
        onViewportChange={onViewportChange}
        onLoadOlderHistory={onLoadOlderHistory}
      />,
    );
    const webView = screen.getByTestId("chart-webview");
    fireEvent(webView, "message", {
      nativeEvent: {
        data: JSON.stringify({
          type: "VIEWPORT",
          payload: { from: 8, to: 40, awayFromRealtime: true },
        }),
      },
    });
    expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: 1 }));
    expect(screen.getByTestId("chart-scroll-to-realtime")).toBeTruthy();
    fireEvent(webView, "message", {
      nativeEvent: { data: JSON.stringify({ type: "NEED_HISTORY", payload: {} }) },
    });
    await waitFor(() => expect(onLoadOlderHistory).toHaveBeenCalledTimes(1));
  });
});

describe("signal card market levels", () => {
  it("keeps signal price and footer actions accessible with stacked content at large text sizes", () => {
    const originalWindow = Dimensions.get("window");
    const originalScreen = Dimensions.get("screen");
    Dimensions.set({
      window: { ...originalWindow, width: 360, height: 780, fontScale: 2 },
      screen: { ...originalScreen, width: 360, height: 780, fontScale: 2 },
    });

    const onPress = jest.fn();
    let rendered: ReturnType<typeof render> | undefined;
    try {
      rendered = render(
        <SignalCard
          signal={signal as React.ComponentProps<typeof SignalCard>["signal"]}
          connected
          onPress={onPress}
        />,
      );

      const card = screen.getByTestId("signal-card-XAUUSD");
      expect(card.props.accessibilityRole).toBe("button");
      expect(card.props.accessibilityLabel).toContain("live price 106.10");
      expect(
        StyleSheet.flatten(screen.getByTestId("signal-price-XAUUSD").props.style).flexDirection,
      ).toBe("column");
      expect(screen.getByTestId("signal-lots-XAUUSD").props.accessibilityLabel).toBe(
        "Open lot sizing details for XAUUSD",
      );
      expect(screen.getByTestId("signal-plan-XAUUSD").props.accessibilityLabel).toBe(
        "Open trade plan for XAUUSD",
      );

      fireEvent.press(screen.getByTestId("signal-plan-XAUUSD"));
      expect(onPress).toHaveBeenCalledTimes(1);
    } finally {
      rendered?.unmount();
      Dimensions.set({ window: originalWindow, screen: originalScreen });
    }
  });

  it("keeps a valid reference spot price but withholds untrusted gate levels and position", () => {
    const reviewSignal = {
      ...signal,
      price: 0,
      entry: 0,
      dataState: "ERROR" as const,
      levels: { buyEntry: 106.3, sellEntry: 105.1 },
    } as React.ComponentProps<typeof SignalCard>["signal"];
    render(
      <SignalCard
        signal={reviewSignal}
        liveQuote={{ price: 106.1, dataState: "STALE" }}
        connected={false}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText("106.10")).toBeTruthy();
    expect(screen.queryByText("106.30")).toBeNull();
    expect(screen.queryByText("105.10")).toBeNull();
    expect(screen.getByText("STALE PRICE")).toBeTruthy();
    expect(screen.getByText("DATA UNTRUSTED")).toBeTruthy();
    const gatePanel = within(screen.getByTestId("signal-gates-XAUUSD"));
    expect(gatePanel.getByText("BUY GATE")).toBeTruthy();
    expect(gatePanel.getByText("SELL GATE")).toBeTruthy();
    expect(gatePanel.getByText("POSITION UNAVAILABLE")).toBeTruthy();
    expect(gatePanel.getAllByText("—")).toHaveLength(3);
    expect(gatePanel.queryByText("CURRENT PRICE", { exact: true })).toBeTruthy();
  });

  it("shows the curated setup label and marks an untrusted setup paused without exposing its levels", () => {
    const staleSignal = {
      ...signal,
      direction: "NONE" as const,
      setupLabel: "Gold setup" as const,
      qualified: true,
      dataState: "STALE" as const,
    } as React.ComponentProps<typeof SignalCard>["signal"];
    render(
      <SignalCard
        signal={staleSignal}
        liveQuote={{ price: 106.1, dataState: "STALE" }}
        connected={false}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText("SETUP · Gold setup")).toBeTruthy();
    expect(screen.getByText("SETUP PAUSED")).toBeTruthy();
    expect(screen.getByText("DATA UNTRUSTED")).toBeTruthy();
    expect(screen.getByText("NONE")).toBeTruthy();
    expect(screen.queryByText("QUALIFIED")).toBeNull();

    const plan = within(screen.getByTestId("signal-trade-plan-XAUUSD"));
    expect(plan.getAllByText("—")).toHaveLength(3);
    const gatePanel = within(screen.getByTestId("signal-gates-XAUUSD"));
    expect(gatePanel.getByText("BUY GATE")).toBeTruthy();
    expect(gatePanel.getByText("SELL GATE")).toBeTruthy();
    expect(gatePanel.getByText("POSITION UNAVAILABLE")).toBeTruthy();
    expect(gatePanel.queryByText("106.30")).toBeNull();
    expect(gatePanel.queryByText("105.10")).toBeNull();
    expect(gatePanel.queryByText("106.10")).toBeNull();
  });

  it.each([
    ["LIVE", "LIVE", "LIVE PRICE", "106.10"],
    ["FALLBACK", "REFERENCE", "REFERENCE PRICE", "106.10"],
    ["STALE", "STALE", "STALE PRICE", "106.10"],
    ["ERROR", "UNAVAILABLE", "PRICE UNAVAILABLE", "—"],
  ] as const)("labels %s signal-card prices as %s", (dataState, state, detailLabel, price) => {
    const stateSignal = { ...signal, dataState } as React.ComponentProps<
      typeof SignalCard
    >["signal"];
    render(<SignalCard signal={stateSignal} onPress={jest.fn()} />);

    expect(screen.getAllByTestId(`price-state-badge-${state}`)).toHaveLength(2);
    const pricePanel = within(screen.getByTestId(`signal-price-${signal.symbol}`));
    expect(pricePanel.getByText(detailLabel)).toBeTruthy();
    expect(pricePanel.getByText(price)).toBeTruthy();
  });

  it("shows the curated setup and plan values for a live, qualified directional signal", () => {
    const liveSignal = {
      ...signal,
      setupLabel: "Gold setup" as const,
      qualified: true,
      dataState: "LIVE" as const,
    } as React.ComponentProps<typeof SignalCard>["signal"];
    render(<SignalCard signal={liveSignal} connected onPress={jest.fn()} />);

    expect(screen.getByText("SETUP · Gold setup")).toBeTruthy();
    expect(screen.getByText("QUALIFIED")).toBeTruthy();
    const plan = within(screen.getByTestId("signal-trade-plan-XAUUSD"));
    expect(plan.getByText("106.30")).toBeTruthy();
    expect(plan.getByText("104.80")).toBeTruthy();
    expect(plan.getByText("107.20")).toBeTruthy();
    const gatePanel = within(screen.getByTestId("signal-gates-XAUUSD"));
    expect(gatePanel.getByText("106.30")).toBeTruthy();
    expect(gatePanel.getByText("105.10")).toBeTruthy();
    expect(gatePanel.getByText("BETWEEN GATES")).toBeTruthy();
    expect(gatePanel.getByText("106.10")).toBeTruthy();
  });

  it("places a trusted live quote above or below the corresponding gate", () => {
    const liveSignal = {
      ...signal,
      setupLabel: "Gold setup" as const,
      qualified: true,
      dataState: "LIVE" as const,
    } as React.ComponentProps<typeof SignalCard>["signal"];
    const { rerender } = render(
      <SignalCard
        signal={liveSignal}
        liveQuote={{ price: 107, dataState: "LIVE" }}
        connected
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByTestId("signal-gate-position-XAUUSD").props.children).toBe("ABOVE BUY GATE");

    rerender(
      <SignalCard
        signal={liveSignal}
        liveQuote={{ price: 104, dataState: "LIVE" }}
        connected
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByTestId("signal-gate-position-XAUUSD").props.children).toBe(
      "BELOW SELL GATE",
    );
  });

  it("does not render an internal strategy identifier as a customer-facing setup name", () => {
    const internalOnlySignal = {
      ...signal,
      setupLabel: "DGv8" as const,
      dataState: "STALE" as const,
    } as React.ComponentProps<typeof SignalCard>["signal"];
    render(<SignalCard signal={internalOnlySignal} connected={false} onPress={jest.fn()} />);

    expect(screen.getByText("SETUP NAME UNAVAILABLE")).toBeTruthy();
    expect(screen.queryByText("DGv8")).toBeNull();
  });
});

describe("signal chart controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMarketQuotes.mockResolvedValue({ bridge: { connected: false }, quotes: {} });
    mockUseTradify.mockReturnValue({
      signals: [signal],
      selectedStrategiesBySymbol: { XAUUSD: "DGv8" },
      setStrategyForSymbol: jest.fn(),
      mt5Connected: true,
    });
    mockGetMarketCandles.mockResolvedValue({
      symbol: "XAUUSD",
      provider: "MT5",
      providerSymbol: "XAUUSD",
      timeframe: "M15",
      timezone: "UTC",
      candles,
      dataState: "LIVE",
      validation: { valid: true },
    });
    mockGetSignalEvaluation.mockResolvedValue({
      signal,
      diagnostic: {},
      quote: null,
      candles: {
        symbol: "XAUUSD",
        provider: "MT5",
        providerSymbol: "XAUUSD",
        timeframe: "M15",
        timezone: "UTC",
        candles,
        dataState: "LIVE",
        validation: { valid: true },
      },
    });
    mockGetMarketsCatalog.mockResolvedValue([
      {
        symbol: "XAUUSD",
        availableSetups: ["Gold setup", "BBB Gold 3S"],
        defaultSetupLabel: "Gold setup",
      },
    ]);
  });

  it.each([
    ["ios", "LONG"], ["ios", "SHORT"], ["android", "LONG"], ["android", "SHORT"],
  ] as const)(
    "keeps the trusted %s %s plan and layer selections in the expanded chart",
    async (platform, direction) => {
      const platformOverride = jest.replaceProperty(Platform, "OS", platform);
      const directionalSignal = {
        ...signal,
        direction,
        entry: direction === "LONG" ? levels.buyGate : levels.sellGate,
        levels: {
          buyEntry: levels.buyGate,
          sellEntry: levels.sellGate,
          buyStop: levels.buyStop,
          sellStop: levels.sellStop,
          buyTargets: levels.buyTargets,
          sellTargets: levels.sellTargets,
          sourceHigh: levels.sourceHigh,
          sourceLow: levels.sourceLow,
          pivotResistance: levels.pivotResistance,
          pivotSupport: levels.pivotSupport,
        },
      };
      mockUseTradify.mockReturnValue({
        signals: [directionalSignal],
        selectedStrategiesBySymbol: { XAUUSD: "DGv8" },
        setStrategyForSymbol: jest.fn(),
        mt5Connected: true,
      });
      mockGetMarketCandles.mockResolvedValue(trustedM15Response);
      mockGetSignalEvaluation.mockResolvedValue({
        signal: directionalSignal,
        candles: trustedM15Response,
        quote: null,
      });
      const SignalDetailScreen = require("../app/signal/[id]").default;
      const rendered = render(<SignalDetailScreen />);
      const charts = () => rendered.UNSAFE_getAllByType(MarketCandleChart);
      try {
        await waitFor(() => expect(charts()[0].props.levels?.direction).toBe(direction));
        expect(charts()[0].props.candles).toHaveLength(80);
        expect(charts()[0].props.blockedReason).toBeUndefined();
        expect(charts()[0].props.levels).toEqual({
          direction,
          entry: directionalSignal.entry,
          ...directionalSignal.levels,
        });
        for (const layer of ["entries", "targets", "stops", "sources", "pivots"]) {
          fireEvent.press(screen.getByTestId(`chart-layer-${layer}`));
          expect(charts()[0].props.visibleLayers[layer]).toBe(false);
          fireEvent.press(screen.getByTestId(`chart-layer-${layer}`));
          expect(charts()[0].props.visibleLayers[layer]).toBe(true);
        }
        fireEvent.press(screen.getByTestId("chart-layer-targets"));
        fireEvent.press(screen.getByTestId("chart-expand"));
        const expanded = charts().find((chart) => chart.props.expanded);
        expect(expanded).toBeTruthy();
        expect(expanded!.props.levels).toEqual(charts()[0].props.levels);
        expect(expanded!.props.visibleLayers.targets).toBe(false);
        expect(expanded!.props.candles).toHaveLength(80);
        for (const layer of ["sources", "pivots"]) {
          fireEvent.press(screen.getByTestId(`expanded-chart-layer-${layer}`));
          expect(charts().find((chart) => chart.props.expanded)!.props.visibleLayers[layer])
            .toBe(false);
          expect(charts()[0].props.visibleLayers[layer]).toBe(false);
        }
        fireEvent.press(screen.getByTestId("chart-expand-close"));
        fireEvent.press(screen.getByTestId("chart-reset"));
        expect(charts()[0].props.visibleLayers).toEqual({
          entries: true, targets: true, stops: true, sources: true, pivots: true,
        });
      } finally {
        rendered.unmount();
        platformOverride.restore();
      }
    },
  );

  it.each([
    ["invalid", { dataState: "ERROR", validation: { valid: false, reason: "Invalid OHLC geometry" } }],
    ["stale", { dataState: "STALE", validation: { valid: true } }],
    ["fallback", { dataState: "FALLBACK", displayOnly: true, validation: { valid: false } }],
    ["insufficient", {
      dataState: "ERROR",
      candles: trustedM15Response.candles.slice(-49),
      validation: { valid: false, reason: "Insufficient closed M15 history: got 49 closed bars, required >= 50" },
    }],
  ])("keeps %s history candle-only in compact and expanded charts", async (_name, changes) => {
    const blocked = { ...trustedM15Response, ...changes };
    mockGetMarketCandles.mockResolvedValue(blocked);
    mockGetSignalEvaluation.mockResolvedValue({ signal, candles: blocked, quote: null });
    const SignalDetailScreen = require("../app/signal/[id]").default;
    const rendered = render(<SignalDetailScreen />);
    const charts = () => rendered.UNSAFE_getAllByType(MarketCandleChart);
    try {
      await waitFor(() => expect(charts()[0].props.dataState).toBe(blocked.dataState));
      expect(charts()[0].props.candles.length).toBeGreaterThan(0);
      expect(charts()[0].props.levels).toBeUndefined();
      expect(charts()[0].props.blockedReason).toMatch(/levels|Levels/);
      fireEvent.press(screen.getByTestId("chart-expand"));
      const expanded = charts().find((chart) => chart.props.expanded);
      expect(expanded!.props.levels).toBeUndefined();
      expect(expanded!.props.blockedReason).toBe(charts()[0].props.blockedReason);
      expect(expanded!.props.candles).toEqual(blocked.candles);
    } finally {
      rendered.unmount();
    }
  });

  it("fills the compact detail viewport and removes the AI Note action", async () => {
    const SignalDetailScreen = require("../app/signal/[id]").default;
    const originalWindow = Dimensions.get("window");
    const originalScreen = Dimensions.get("screen");
    Dimensions.set({
      window: { ...originalWindow, width: 402, height: 780 },
      screen: { ...originalScreen, width: 402, height: 780 },
    });
    const rendered = render(<SignalDetailScreen />);

    try {
      const detailPage = screen.getByTestId("signal-detail-page");
      act(() => {
        detailPage.props.onLayout({
          nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 780 } },
        });
      });

      await waitFor(() => {
        const chart = screen.getByTestId("market-candle-chart");
        expect(StyleSheet.flatten(chart.props.style).height).toBe(546);
      });
      expect(screen.queryByText("AI Note")).toBeNull();
      expect(screen.queryByTestId("bottom-commentary")).toBeNull();
      expect(screen.getByTestId("bottom-alert")).toBeTruthy();
      expect(screen.getByTestId("bottom-close")).toBeTruthy();
      expect(screen.getByTestId("bottom-calculate")).toBeTruthy();
    } finally {
      rendered.unmount();
      Dimensions.set({ window: originalWindow, screen: originalScreen });
    }
  });

  it.each([
    ["LIVE", "LIVE", "LIVE PRICE", "106.10"],
    ["FALLBACK", "REFERENCE", "REFERENCE PRICE", "106.10"],
    ["STALE", "STALE", "STALE PRICE", "106.10"],
    ["ERROR", "UNAVAILABLE", "PRICE UNAVAILABLE", "—"],
  ] as const)(
    "labels %s signal-detail prices as %s",
    async (dataState, state, detailLabel, price) => {
      const detailSignal = { ...signal, dataState } as React.ComponentProps<
        typeof SignalCard
      >["signal"];
      mockUseTradify.mockReturnValue({
        signals: [detailSignal],
        watchlist: [],
        selectedStrategiesBySymbol: {},
        setStrategyForSymbol: jest.fn(),
        mt5Connected: true,
      });
      mockGetSignalEvaluation.mockReturnValue(new Promise(() => undefined));
      const SignalDetailScreen = require("../app/signal/[id]").default;
      const rendered = render(<SignalDetailScreen />);

      try {
        await waitFor(() =>
          expect(
            screen.getByTestId("signal-detail-price-state").props.accessibilityLabel,
          ).toContain(detailLabel),
        );
        expect(screen.getByTestId(`price-state-badge-${state}`)).toBeTruthy();
        expect(screen.getByTestId("signal-detail-price-state").props.accessibilityLabel).toContain(
          price === "—" ? "Price unavailable" : `Price ${price}`,
        );
      } finally {
        rendered.unmount();
      }
    },
  );

  it("keeps signal price states and controls reachable at large text sizes", async () => {
    const originalWindow = Dimensions.get("window");
    const originalScreen = Dimensions.get("screen");
    Dimensions.set({
      window: { ...originalWindow, width: 360, height: 780, fontScale: 2 },
      screen: { ...originalScreen, width: 360, height: 780, fontScale: 2 },
    });

    let rendered: ReturnType<typeof render> | undefined;
    try {
      const SignalDetailScreen = require("../app/signal/[id]").default;
      rendered = render(<SignalDetailScreen />);

      await waitFor(() => expect(screen.getByTestId("signal-detail-price-state")).toBeTruthy());
      const priceState = screen.getByTestId("signal-detail-price-state");
      expect(priceState.props.accessibilityRole).toBe("text");
      expect(priceState.props.accessibilityLabel).toMatch(
        /(?:LIVE|REFERENCE|STALE) PRICE\. Price 106\.10\./,
      );
      expect(StyleSheet.flatten(priceState.props.style).flexWrap).toBe("wrap");
      expect(StyleSheet.flatten(screen.getByTestId("timeframe-M1").props.style).minHeight).toBe(44);
      expect(StyleSheet.flatten(screen.getByTestId("bottom-alert").props.style).minHeight).toBe(48);
      expect(screen.getByTestId("bottom-alert").props.accessibilityLabel).toBe("Set a price alert");
      expect(screen.getByTestId("bottom-calculate").props.accessibilityLabel).toBe(
        "Open risk calculator",
      );
    } finally {
      rendered?.unmount();
      Dimensions.set({ window: originalWindow, screen: originalScreen });
    }
  });

  it("opens the symbol-specific strategy switcher and selects an implemented setup", async () => {
    const setStrategyForSymbol = jest.fn();
    mockUseTradify.mockReturnValue({
      signals: [signal],
      selectedStrategiesBySymbol: { XAUUSD: "DGv8" },
      setStrategyForSymbol,
      mt5Connected: true,
    });
    const SignalDetailScreen = require("../app/signal/[id]").default;
    render(<SignalDetailScreen />);

    await waitFor(() => expect(screen.getByTestId("detail-strategy-trigger")).toBeTruthy());
    fireEvent.press(screen.getByTestId("detail-strategy-trigger"));
    expect(screen.getByTestId("strategy-option-BBB Gold 3S")).toBeTruthy();
    fireEvent.press(screen.getByTestId("strategy-option-BBB Gold 3S"));
    expect(setStrategyForSymbol).toHaveBeenCalledWith("XAUUSD", "BBB Gold 3S");
  });

  it("restores the selected setup for this symbol and evaluates that strategy", async () => {
    mockUseTradify.mockReturnValue({
      signals: [signal],
      selectedStrategiesBySymbol: { XAUUSD: "BBB Gold 3S", EURUSD: "BBB" },
      setStrategyForSymbol: jest.fn(),
      mt5Connected: true,
    });
    const SignalDetailScreen = require("../app/signal/[id]").default;
    render(<SignalDetailScreen />);

    await waitFor(() => expect(screen.getByTestId("detail-strategy-trigger")).toBeTruthy());
    expect(screen.getByText("Gold setup")).toBeTruthy();
    await waitFor(() =>
      expect(mockGetSignalEvaluation).toHaveBeenCalledWith({
        symbol: "XAUUSD",
        strategy: "BBB_GOLD_3S",
      }),
    );
  });

  it("expands the chart and cleans up the refresh timer on unmount", async () => {
    const SignalDetailScreen = require("../app/signal/[id]").default;
    const { unmount } = render(<SignalDetailScreen />);

    await waitFor(() => expect(screen.getByTestId("chart-webview")).toBeTruthy());
    expect(screen.getByTestId("validation-snapshot")).toBeTruthy();
    fireEvent.press(screen.getByTestId("chart-expand"));
    expect(screen.getByTestId("chart-expand-close")).toBeTruthy();
    fireEvent.press(screen.getByTestId("chart-expand-close"));
    expect(screen.queryByTestId("chart-expand-close")).toBeNull();
    fireEvent.press(screen.getByTestId("chart-reset"));
    expect(screen.getByText("Candles")).toBeTruthy();

    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockGetSignalEvaluation).toHaveBeenCalled();
  });

  it("zooms the chart in and out with Expo-safe controls and resets the scale", async () => {
    const SignalDetailScreen = require("../app/signal/[id]").default;
    render(<SignalDetailScreen />);
    const zoomLabel = () => screen.getByTestId("chart-zoom-value").props.children.join("");

    await waitFor(() => expect(screen.getByTestId("chart-webview")).toBeTruthy());
    expect(zoomLabel()).toBe("100%");

    fireEvent.press(screen.getByTestId("chart-zoom-in"));
    expect(zoomLabel()).toBe("125%");

    fireEvent.press(screen.getByTestId("chart-zoom-out"));
    expect(zoomLabel()).toBe("100%");

    fireEvent.press(screen.getByTestId("chart-zoom-in"));
    fireEvent.press(screen.getByTestId("chart-reset"));
    expect(zoomLabel()).toBe("100%");
  });

  it("requests every selectable timeframe through the chart data path", async () => {
    const SignalDetailScreen = require("../app/signal/[id]").default;
    const { unmount } = render(<SignalDetailScreen />);
    const timeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];

    await waitFor(() => expect(mockGetMarketCandles).toHaveBeenCalled());
    for (const item of timeframes) {
      fireEvent.press(screen.getByTestId(`timeframe-${item}`));
      await waitFor(() =>
        expect(mockGetMarketCandles).toHaveBeenCalledWith({
          symbol: "XAUUSD",
          timeframe: item,
          limit: 80,
        }),
      );
    }

    unmount();
  });

  it("shows the same-price live quote while strategy data remains untrusted", async () => {
    const erroredSignal = { ...signal, dataState: "ERROR" as const };
    mockUseTradify.mockReturnValue({
      signals: [erroredSignal],
      watchlist: [
        {
          symbol: "XAUUSD",
          price: 106.1,
          dataState: "LIVE",
        },
      ],
      selectedStrategiesBySymbol: { XAUUSD: "DGv8" },
      setStrategyForSymbol: jest.fn(),
      mt5Connected: true,
    });
    mockGetSignalEvaluation.mockReturnValue(new Promise(() => undefined));
    mockGetMarketCandles.mockResolvedValue({
      symbol: "XAUUSD",
      provider: "MT5",
      providerSymbol: "XAUUSD",
      timeframe: "M15",
      timezone: "UTC",
      candles: candles.slice(0, 2),
      dataState: "FALLBACK",
      displayOnly: true,
      validation: { valid: false },
    });

    const SignalDetailScreen = require("../app/signal/[id]").default;
    const { unmount } = render(<SignalDetailScreen />);

    await waitFor(() => expect(screen.getByText("106.10")).toBeTruthy());
    expect(screen.getByText("LIVE PRICE")).toBeTruthy();
    expect(screen.getByText("DATA UNTRUSTED")).toBeTruthy();

    unmount();
  });
});
