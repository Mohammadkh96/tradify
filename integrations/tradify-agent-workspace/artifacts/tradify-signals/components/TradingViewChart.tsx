import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/hooks/useColors";
import { tradingViewChartHtml } from "./trading-view-chart";
import type {
  CandleDatum,
  MarketCandleChartProps,
  MarketChartCrosshair,
  MarketChartViewport,
} from "./TradifyUI";

type ChartMessage = {
  type?: string;
  payload?: Record<string, unknown>;
};

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseCandle(value: unknown): CandleDatum | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candle = value as Record<string, unknown>;
  const time = asNumber(candle.time);
  const open = asNumber(candle.open);
  const high = asNumber(candle.high);
  const low = asNumber(candle.low);
  const close = asNumber(candle.close);
  const volume = asNumber(candle.volume) ?? 0;
  if ([time, open, high, low, close].some((item) => item === undefined)) return undefined;
  return { time: time!, open: open!, high: high!, low: low!, close: close!, volume };
}

export function TradingViewChart({
  candles,
  levels,
  lastPrice,
  dataState = "LIVE",
  displayOnly = false,
  provider = "MT5",
  providerSymbol,
  title = "Market chart",
  timeframe = "M15",
  timezone = "UTC",
  candleMode = "Candles",
  visibleLayers = { entries: true, targets: true, stops: true, sources: true, pivots: true },
  expanded = false,
  chartHeight = 460,
  chartType = candleMode === "Heikin-Ashi" ? "candles" : undefined,
  zoom = 1,
  historyLoading = false,
  hasOlderHistory = true,
  blockedReason,
  onLoadOlderHistory,
  onInteractionStart,
  onInteractionEnd,
  onCrosshairChange,
  onViewportChange,
  onReset,
}: MarketCandleChartProps & { chartType?: "candles" | "bars" | "line" | "area" }) {
  const colors = useColors();
  const webViewRef = useRef<WebView>(null);
  const webFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [awayFromRealtime, setAwayFromRealtime] = useState(false);
  const [historyRequested, setHistoryRequested] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const chartPayload = useMemo(
    () => ({
      candles,
      levels,
      lastPrice,
      dataState,
      displayOnly,
      provider,
      providerSymbol,
      title,
      timeframe,
      timezone,
      candleMode,
      visibleLayers,
      chartType: chartType ?? "candles",
      zoom,
      hasOlderHistory,
    }),
    [
      candles,
      levels,
      lastPrice,
      dataState,
      displayOnly,
      provider,
      providerSymbol,
      title,
      timeframe,
      timezone,
      candleMode,
      visibleLayers,
      chartType,
      zoom,
      hasOlderHistory,
    ],
  );

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const message = JSON.stringify({ type, payload });
    if (Platform.OS === "web") webFrameRef.current?.contentWindow?.postMessage(message, "*");
    else webViewRef.current?.postMessage(message);
  }, []);

  useEffect(() => {
    if (!ready) return;
    send("DATA", chartPayload as unknown as Record<string, unknown>);
  }, [chartPayload, ready, send]);

  const handleMessageData = useCallback(
    (data: string) => {
      let message: ChartMessage;
      try {
        message = JSON.parse(data) as ChartMessage;
      } catch {
        return;
      }
      const payload = message.payload ?? {};
      if (message.type === "READY") {
        setReady(true);
        send("INIT", chartPayload as unknown as Record<string, unknown>);
        return;
      }
      if (message.type === "VIEWPORT") {
        const away = payload.awayFromRealtime === true;
        setAwayFromRealtime(away);
        onViewportChange?.({
          zoom,
          scrollX: asNumber(payload.from) ?? 0,
          axisPadding: 0.06,
        } satisfies MarketChartViewport);
        return;
      }
      if (message.type === "INTERACTION") {
        const active = payload.active === true;
        setIsInteracting(active);
        if (active) onInteractionStart?.();
        else onInteractionEnd?.();
        return;
      }
      if (message.type === "NEED_HISTORY") {
        if (!historyRequested && hasOlderHistory && !historyLoading) {
          setHistoryRequested(true);
          Promise.resolve(onLoadOlderHistory?.()).finally(() => setHistoryRequested(false));
        }
        return;
      }
      if (message.type === "CROSSHAIR") {
        const candle = parseCandle(payload.candle);
        if (payload.active === true && candle) {
          onCrosshairChange?.({
            candle,
            index: candles.findIndex((item) => item.time === candle.time),
            provider,
            providerSymbol,
            timeframe,
            timezone,
          } satisfies MarketChartCrosshair);
        } else {
          onCrosshairChange?.(null);
        }
        return;
      }
      if (message.type === "RESET") {
        setAwayFromRealtime(false);
        onReset?.();
      }
    },
    [
      candles,
      chartPayload,
      hasOlderHistory,
      historyLoading,
      historyRequested,
      onCrosshairChange,
      onLoadOlderHistory,
      onReset,
      onViewportChange,
      provider,
      providerSymbol,
      send,
      timeframe,
      timezone,
      zoom,
    ],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      handleMessageData(event.nativeEvent.data);
    },
    [handleMessageData],
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onWindowMessage = (event: MessageEvent<string>) => {
      if (typeof event.data === "string") handleMessageData(event.data);
    };
    window.addEventListener("message", onWindowMessage);
    return () => window.removeEventListener("message", onWindowMessage);
  }, [handleMessageData]);

  return (
    <View
      testID="market-candle-chart"
      style={[
        styles.root,
        expanded && styles.expandedRoot,
        { height: expanded ? undefined : chartHeight, backgroundColor: colors.background },
      ]}
    >
      {Platform.OS === "web" ? (
        React.createElement("iframe", {
          ref: (node: HTMLIFrameElement | null) => {
            webFrameRef.current = node;
          },
          title: title,
          src: `data:text/html;charset=utf-8,${encodeURIComponent(tradingViewChartHtml)}`,
          onLoad: () => send("INIT", chartPayload as unknown as Record<string, unknown>),
          "data-testid": "chart-webview",
          style: {
            width: "100%",
            height: "100%",
            border: "0",
            display: "block",
            backgroundColor: "transparent",
          },
          scrolling: "no",
        })
      ) : (
        <WebView
          ref={webViewRef}
          testID="chart-webview"
          source={{ html: tradingViewChartHtml }}
          originWhitelist={["*"]}
          onMessage={handleMessage}
          onLoadEnd={() => send("INIT", chartPayload as unknown as Record<string, unknown>)}
          javaScriptEnabled
          domStorageEnabled={false}
          scrollEnabled={false}
          bounces={false}
          nestedScrollEnabled={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          setSupportMultipleWindows={false}
          onTouchStart={onInteractionStart}
          onTouchEnd={onInteractionEnd}
          onTouchCancel={onInteractionEnd}
          style={styles.webView}
          containerStyle={styles.webViewContainer}
        />
      )}
      {!ready ? (
        <View pointerEvents="none" style={[styles.loading, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.loadingIcon,
              { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}45` },
            ]}
          >
            <ActivityIndicator color={colors.primary} />
          </View>
          <Text style={[styles.loadingText, { color: colors.foreground }]}>
            Loading market chart
          </Text>
          <Text style={[styles.loadingSubtext, { color: colors.mutedForeground }]}>
            Preparing live candles and controls
          </Text>
        </View>
      ) : null}
      {ready && !historyLoading && candles.length === 0 ? (
        <View
          pointerEvents="none"
          style={[styles.emptyState, { backgroundColor: `${colors.background}e8` }]}
        >
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}35` },
            ]}
          >
            <Feather name="activity" size={17} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {dataState === "ERROR"
              ? `${timeframe} candles unavailable`
              : "Waiting for market candles"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {dataState === "ERROR"
              ? (blockedReason ?? "No verified market series is available for this timeframe.")
              : "The chart will fill in as market data syncs"}
          </Text>
        </View>
      ) : null}
      {blockedReason && ready ? (
        <View
          pointerEvents="none"
          style={[
            styles.blockedBadge,
            { backgroundColor: `${colors.warning}e8`, borderColor: `${colors.warning}66` },
          ]}
        >
          <Feather name="shield" size={12} color={colors.primaryForeground} />
          <View style={styles.blockedCopy}>
            <Text style={[styles.blockedTitle, { color: colors.primaryForeground }]}>
              REFERENCE VIEW
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.blockedText, { color: colors.primaryForeground }]}
            >
              {dataState === "STALE"
                ? "Waiting for fresh market candles"
                : "Opportunity levels are locked"}
            </Text>
          </View>
        </View>
      ) : null}
      {isInteracting ? (
        <View
          pointerEvents="none"
          style={[
            styles.interactionBadge,
            { backgroundColor: `${colors.card}ed`, borderColor: colors.border },
          ]}
        >
          <Feather name="move" size={11} color={colors.primary} />
          <Text style={[styles.interactionText, { color: colors.foreground }]}>CHART ACTIVE</Text>
        </View>
      ) : null}
      {awayFromRealtime ? (
        <Pressable
          testID="chart-scroll-to-realtime"
          accessibilityRole="button"
          accessibilityLabel="Scroll to realtime"
          onPress={() => {
            setAwayFromRealtime(false);
            send("SCROLL_TO_REALTIME");
          }}
          style={[
            styles.realtimeButton,
            { backgroundColor: colors.success, borderColor: colors.success },
          ]}
        >
          <Feather name="radio" size={11} color={colors.primaryForeground} />
          <Text style={[styles.realtimeText, { color: colors.primaryForeground }]}>LIVE</Text>
        </Pressable>
      ) : null}
      {historyLoading ? (
        <View
          pointerEvents="none"
          style={[
            styles.historyBadge,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.historyText, { color: colors.mutedForeground }]}>
            Fetching older bars
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", height: 460, overflow: "hidden", position: "relative" },
  expandedRoot: { flex: 1, height: undefined, minHeight: 0 },
  webView: { flex: 1, backgroundColor: "transparent" },
  webViewContainer: { backgroundColor: "transparent" },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 7 },
  loadingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  loadingText: { fontSize: 12, fontWeight: "800" },
  loadingSubtext: { fontSize: 10 },
  emptyState: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  emptyTitle: { fontSize: 12, fontWeight: "800" },
  emptyText: { fontSize: 10, textAlign: "center", marginTop: 4, lineHeight: 15 },
  blockedBadge: {
    position: "absolute",
    left: 12,
    top: 10,
    maxWidth: "62%",
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  blockedCopy: { flexShrink: 1 },
  blockedTitle: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  blockedText: { fontSize: 9, marginTop: 1 },
  interactionBadge: {
    position: "absolute",
    left: 12,
    bottom: 84,
    minHeight: 25,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  interactionText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  realtimeButton: {
    position: "absolute",
    right: 12,
    bottom: 94,
    minHeight: 30,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  realtimeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  historyBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  historyText: { fontSize: 9, fontWeight: "700" },
});
