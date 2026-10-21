import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import {
  brandPalette,
  chartContextPalette,
  designTokens,
  getPriceStateVisual,
  priceStatePresentation,
  resolvePriceState,
} from "@/constants/colors";
import { usePressMotion, useSystemReducedMotion } from "@/hooks/useMotion";
import { TradifyBrand } from "@/components/TradifyBrand";
import { Signal, WatchItem } from "@/lib/tradify-store";
import { TradingViewChart } from "@/components/TradingViewChart";

export function Screen({
  children,
  scroll = true,
  screenBottomSpacing = designTokens.spacing.screenBottom,
}: {
  children: ReactNode;
  scroll?: boolean;
  screenBottomSpacing?: number;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + designTokens.spacing.lg;
  const bottomPadding = insets.bottom + screenBottomSpacing;
  const content = (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors[designTokens.surface.page],
          paddingTop: Platform.OS === "web" ? Math.max(topPadding, 67) : topPadding,
          paddingBottom: Platform.OS === "web" ? Math.max(bottomPadding, 34) : bottomPadding,
          width: Platform.OS === "web" ? "100%" : undefined,
          maxWidth: Platform.OS === "web" ? 1180 : undefined,
          alignSelf: Platform.OS === "web" ? "center" : undefined,
        },
      ]}
    >
      {children}
    </View>
  );
  return scroll ? (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {content}
    </ScrollView>
  ) : (
    content
  );
}

export function Header({
  eyebrow,
  title,
  onBell,
  onProfile,
  onUpgrade,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  onBell?: () => void;
  onProfile?: () => void;
  onUpgrade?: () => void;
  compact?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TradifyBrand />
        <View style={styles.headerActions}>
          {compact && onUpgrade ? (
            <Pressable
              testID="header-upgrade"
              accessibilityRole="button"
              accessibilityLabel="Upgrade membership"
              onPress={onUpgrade}
              style={[
                styles.upgradeButton,
                { backgroundColor: `${colors.success}18`, borderColor: `${colors.success}45` },
              ]}
            >
              <Feather name="zap" size={12} color={colors.success} />
              <Text style={[styles.upgradeText, { color: colors.success }]}>Upgrade</Text>
            </Pressable>
          ) : null}
          {onBell ? (
            <IconButton icon="bell" onPress={onBell} testID="header-notifications" badge />
          ) : null}
          {onProfile ? (
            <IconButton icon="user" onPress={onProfile} testID="header-profile" />
          ) : null}
        </View>
      </View>
      {!compact && eyebrow ? (
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text>
      ) : null}
      <Text
        accessibilityRole="header"
        style={[styles.pageTitle, compact && styles.pageTitleCompact, { color: colors.foreground }]}
      >
        {title}
      </Text>
      {compact ? <View style={[styles.headerRule, { backgroundColor: colors.border }]} /> : null}
    </View>
  );
}

export function SurfaceCard({
  children,
  style,
  testID,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const cardStyle = [
    styles.surfaceCard,
    { backgroundColor: colors.card, borderColor: colors.border },
    style,
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [...cardStyle, { opacity: pressed ? 0.82 : 1 }]}
    >
      {children}
    </Pressable>
  ) : (
    <View testID={testID} style={cardStyle}>
      {children}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  testID,
  badge,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  testID: string;
  badge?: boolean;
}) {
  const colors = useColors();
  const pressMotion = usePressMotion();
  const label =
    icon === "bell"
      ? "Notifications"
      : icon === "user"
        ? "Profile"
        : icon === "x"
          ? "Close"
          : `${icon} action`;
  return (
    <Animated.View style={pressMotion.animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: false }}
        testID={testID}
        onPress={onPress}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: colors[designTokens.surface.control],
            borderColor: colors.border,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <Feather name={icon} size={18} color={colors.foreground} />
        {badge ? <View style={[styles.badgeDot, { backgroundColor: colors.primary }]} /> : null}
      </Pressable>
    </Animated.View>
  );
}

export function Chip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const colors = useColors();
  const pressMotion = usePressMotion();
  const body = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors[designTokens.surface.control],
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={13}
          color={active ? colors.primaryForeground : colors.mutedForeground}
        />
      ) : null}
      <Text
        style={[
          styles.chipText,
          { color: active ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </View>
  );
  return onPress ? (
    <Animated.View style={pressMotion.animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        onPress={onPress}
        testID={`chip-${label}`}
      >
        {body}
      </Pressable>
    </Animated.View>
  ) : (
    body
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionHeading, { color: colors.foreground }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} testID={`action-${action}`}>
          <Text style={[styles.actionText, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "positive" | "warning" | "negative" | "reference";
}) {
  const colors = useColors();
  const color = colors[designTokens.state[tone]];
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}20` }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
}

export function PriceStateBadge({
  state,
  label,
}: {
  state: "LIVE" | "REFERENCE" | "STALE" | "UNAVAILABLE";
  label?: string;
}) {
  const colors = useColors();
  const visual = getPriceStateVisual(state, colors);
  return (
    <View
      testID={`price-state-badge-${state}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label ?? visual.label}
      style={[
        styles.priceStateBadge,
        {
          backgroundColor: visual.backgroundColor,
          borderColor: visual.borderColor,
          borderStyle: visual.borderStyle,
        },
      ]}
    >
      <Feather name={visual.icon} size={10} color={visual.color} />
      <Text style={[styles.priceStateBadgeText, { color: visual.color }]}>
        {label ?? visual.label}
      </Text>
    </View>
  );
}

type FeedPriceItem = Pick<WatchItem, "price" | "dataState" | "referenceState">;
type FeedPriceState = "LIVE" | "REFERENCE" | "STALE" | "UNAVAILABLE";

export function getFeedPriceState(items: FeedPriceItem[]): FeedPriceState {
  const states = items.map((item) =>
    resolvePriceState(
      item.dataState,
      item.referenceState,
      Number.isFinite(item.price) && item.price > 0,
    ),
  );
  const priority: Record<FeedPriceState, number> = {
    LIVE: 3,
    REFERENCE: 2,
    STALE: 1,
    UNAVAILABLE: 0,
  };
  return states.reduce(
    (best, state) => (priority[state] > priority[best] ? state : best),
    "UNAVAILABLE",
  );
}

export function FeedStatus({ items }: { items: FeedPriceItem[] }) {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.35;
  const [utcTime, setUtcTime] = useState("00:00:00 UTC");
  useEffect(() => {
    const update = () => setUtcTime(new Date().toISOString().slice(11, 19) + " UTC");
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);
  const priceState = getFeedPriceState(items);
  const priceStateVisual = getPriceStateVisual(priceState, colors);
  return (
    <View
      style={[
        styles.feedStatus,
        largeText && styles.feedStatusLarge,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <View style={styles.statusSession}>
        <View style={[styles.statusDot, { backgroundColor: colors.mutedForeground }]} />
        <Text style={[styles.statusStrong, { color: colors.mutedForeground }]}>London</Text>
        <Text style={[styles.statusDivider, { color: colors.mutedForeground }]}>·</Text>
        <Text style={[styles.statusMono, { color: colors.mutedForeground }]}>{utcTime}</Text>
      </View>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Market feed status: ${priceStateVisual.feedLabel.toLowerCase()}`}
        testID="feed-price-status"
        style={styles.statusConnection}
      >
        <PriceStateBadge state={priceState} label={priceStateVisual.feedLabel} />
      </View>
    </View>
  );
}

export interface CandleDatum {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type MarketChartLayer = "entries" | "targets" | "stops" | "sources" | "pivots";
export type MarketChartDataState = "LIVE" | "FALLBACK" | "STALE" | "SYNCING" | "ERROR";

export interface MarketChartData {
  candles: CandleDatum[];
  provider: string;
  providerSymbol?: string;
  displayOnly: boolean;
  dataState: MarketChartDataState | string;
  timeframe: string;
  timezone: string;
}

export interface MarketChartViewport {
  zoom: number;
  scrollX: number;
  axisPadding: number;
}

export interface MarketChartCrosshair {
  candle: CandleDatum;
  index: number;
  provider: string;
  providerSymbol?: string;
  timeframe: string;
  timezone: string;
}

export interface MarketCandleChartProps extends Partial<Omit<MarketChartData, "candles">> {
  candles: CandleDatum[];
  lastPrice?: number;
  chartHeight?: number;
  levels?: MarketChartLevels;
  title?: string;
  candleMode?: "Candles" | "Heikin-Ashi";
  visibleLayers?: Partial<Record<MarketChartLayer, boolean>>;
  expanded?: boolean;
  terminal?: boolean;
  cleanMode?: boolean;
  zoom?: number;
  resetSignal?: number;
  blockedReason?: string;
  historyLoading?: boolean;
  hasOlderHistory?: boolean;
  onLoadOlderHistory?: () => void | Promise<void>;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  onCrosshairChange?: (selection: MarketChartCrosshair | null) => void;
  onViewportChange?: (viewport: MarketChartViewport) => void;
  onReset?: () => void;
}

export interface MarketChartLevels {
  direction?: "LONG" | "SHORT" | "NONE";
  entry?: number | null;
  buyEntry?: number | null;
  sellEntry?: number | null;
  buyStop?: number | null;
  sellStop?: number | null;
  buyTargets?: number[];
  sellTargets?: number[];
  sourceHigh?: number | null;
  sourceLow?: number | null;
  pivotResistance?: number | null;
  pivotSupport?: number | null;
}

const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function chartZoomFromPinch(
  startZoom: number,
  startDistance: number,
  currentDistance: number,
): number {
  if (!Number.isFinite(startDistance) || startDistance <= 0 || !Number.isFinite(currentDistance))
    return clamp(startZoom, 0.5, 3);
  return clamp(startZoom * (currentDistance / startDistance), 0.5, 3);
}

export function chartAxisPaddingFromDrag(startPadding: number, verticalDistance: number): number {
  return clamp(startPadding + verticalDistance / 900, 0.015, 0.3);
}

function touchDistance(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  return Math.hypot(touches[1].pageX - touches[0].pageX, touches[1].pageY - touches[0].pageY);
}

export function toHeikinAshi(candles: CandleDatum[]): CandleDatum[] {
  let previousOpen: number | undefined;
  let previousClose: number | undefined;
  return candles.map((candle) => {
    const close = (candle.open + candle.high + candle.low + candle.close) / 4;
    const open =
      previousOpen === undefined || previousClose === undefined
        ? (candle.open + candle.close) / 2
        : (previousOpen + previousClose) / 2;
    const high = Math.max(candle.high, open, close);
    const low = Math.min(candle.low, open, close);
    previousOpen = open;
    previousClose = close;
    return { ...candle, open, high, low, close };
  });
}

function formatChartTime(timestamp: number, includeDate: boolean): string {
  const date = new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  const time = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return includeDate
    ? `${String(date.getUTCDate()).padStart(2, "0")} ${date.toLocaleString("en", { month: "short", timeZone: "UTC" })} ${time}`
    : time;
}

function LegacyMarketCandleChart({
  candles,
  provider = "MT5",
  providerSymbol,
  displayOnly = false,
  dataState = "LIVE",
  lastPrice,
  levels,
  title = "Market chart",
  timeframe = "M15",
  candleMode = "Candles",
  visibleLayers = { entries: true, targets: true, stops: true },
  expanded = false,
  terminal = false,
  cleanMode = false,
  zoom = 1,
  resetSignal = 0,
  blockedReason,
  timezone = "UTC",
  historyLoading = false,
  hasOlderHistory = true,
  onLoadOlderHistory,
  onCrosshairChange,
  onViewportChange,
  onReset,
}: MarketCandleChartProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const shouldAutoScroll = useRef(true);
  const scrollXRef = useRef(0);
  const maxScrollRef = useRef(0);
  const gestureStartScroll = useRef(0);
  const gestureStartPadding = useRef(0.06);
  const axisStartY = useRef<number | undefined>(undefined);
  const gestureMode = useRef<"pan" | "pinch" | "axis">("pan");
  const pinchStartDistance = useRef(0);
  const pinchStartZoom = useRef(1);
  const resizeStartHeight = useRef(terminal ? 460 : 360);
  const resizeStartY = useRef<number | undefined>(undefined);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const lastTapAt = useRef(0);
  const historyRequestInFlight = useRef(false);
  const leftEdgeArmed = useRef(true);
  const [gestureZoom, setGestureZoom] = useState(() => clamp(zoom, 0.5, 3));
  const [axisPadding, setAxisPadding] = useState(0.06);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [resizableHeight, setResizableHeight] = useState(() =>
    terminal ? 460 : expanded ? 500 : 360,
  );
  const chartViewportWidth = Math.max(280, width - (expanded ? 28 : 0));
  const priceRailWidth = expanded ? 108 : 104;
  const chartPlotViewportWidth = Math.max(220, chartViewportWidth - priceRailWidth);
  const chartHeight = clamp(
    resizableHeight,
    expanded ? 420 : terminal ? 360 : 300,
    expanded ? 760 : 620,
  );
  const plotTop = 18;
  const plotBottom = 26;
  const plotLeft = 10;
  const plotRight = 0;
  const volumeHeight = cleanMode ? 0 : expanded ? 70 : 56;
  const volumeGap = cleanMode ? 0 : 14;
  const priceBottom = chartHeight - plotBottom - volumeHeight - volumeGap;
  const volumeTop = priceBottom + volumeGap;
  const visible = useMemo(
    () =>
      candles.filter(
        (candle) =>
          finiteNumber(candle.open) &&
          finiteNumber(candle.high) &&
          finiteNumber(candle.low) &&
          finiteNumber(candle.close) &&
          finiteNumber(candle.volume) &&
          candle.volume >= 0 &&
          candle.high >= candle.low,
      ),
    [candles],
  );
  const renderedCandles = useMemo(
    () => (candleMode === "Heikin-Ashi" ? toHeikinAshi(visible) : visible),
    [candleMode, visible],
  );
  const effectiveZoom = clamp(gestureZoom, 0.5, 3);
  const chartWidth = Math.max(
    chartPlotViewportWidth,
    plotLeft + plotRight + renderedCandles.length * (expanded ? 9 : 8) * effectiveZoom,
  );
  // Clean view removes secondary panels and chrome, but TradingView-style
  // drawings remain part of the chart itself. Hiding strategy levels here
  // made a live chart look like an unannotated price feed.
  const chartLevels = dataState === "LIVE" && !displayOnly ? levels : undefined;
  const levelValues = Object.values(chartLevels ?? {})
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(finiteNumber);
  const livePriceValue =
    dataState === "LIVE" && !displayOnly && finiteNumber(lastPrice) ? lastPrice : undefined;
  const priceValues = livePriceValue === undefined ? levelValues : [...levelValues, livePriceValue];
  const low = renderedCandles.length
    ? Math.min(...renderedCandles.map((candle) => candle.low), ...priceValues)
    : 0;
  const high = renderedCandles.length
    ? Math.max(...renderedCandles.map((candle) => candle.high), ...priceValues)
    : 1;
  const padding = Math.max((high - low) * axisPadding, Math.abs(high) * 0.00015, 0.00001);
  const paddedLow = low - padding;
  const paddedHigh = high + padding;
  const range = Math.max(paddedHigh - paddedLow, 0.00001);
  const y = (value: number) => plotTop + ((paddedHigh - value) / range) * (priceBottom - plotTop);
  const x = (index: number) =>
    plotLeft +
    (index + 0.5) * ((chartWidth - plotLeft - plotRight) / Math.max(renderedCandles.length, 1));
  const candleWidth = Math.max(
    3,
    Math.min(
      10,
      ((chartWidth - plotLeft - plotRight) / Math.max(renderedCandles.length, 1)) * 0.62,
    ),
  );
  const maxVolume = Math.max(...visible.map((candle) => candle.volume), 1);
  const volumeBaseline = volumeTop + volumeHeight - 14;
  const volumePlotHeight = volumeHeight - 22;
  const volumeY = (volume: number) =>
    volumeBaseline - (Math.max(0, volume) / maxVolume) * volumePlotHeight;
  const side = chartLevels?.direction === "SHORT" ? "sell" : "buy";
  const directionalEntry = side === "buy" ? chartLevels?.buyEntry : chartLevels?.sellEntry;
  const directionalStop = side === "buy" ? chartLevels?.buyStop : chartLevels?.sellStop;
  const directionalTargets = side === "buy" ? chartLevels?.buyTargets : chartLevels?.sellTargets;
  const levelEntries = [
    visibleLayers.entries && finiteNumber(directionalEntry)
      ? {
          key: "entry",
          label: "ENTRY",
          value: directionalEntry,
          color: side === "buy" ? chartContextPalette.long : chartContextPalette.short,
          dash: "6,4",
          width: "1.7",
        }
      : null,
    visibleLayers.entries && finiteNumber(chartLevels?.entry)
      ? {
          key: "entry-reference",
          label: "ENTRY",
          value: chartLevels.entry,
          color: chartContextPalette.entry,
          dash: "3,3",
          width: "1.5",
        }
      : null,
    visibleLayers.stops && finiteNumber(directionalStop)
      ? {
          key: "stop",
          label: "STOP",
          value: directionalStop,
          color: chartContextPalette.risk,
          dash: "4,4",
          width: "1.3",
        }
      : null,
    ...(visibleLayers.targets
      ? (directionalTargets ?? []).map((value, index) =>
          finiteNumber(value)
            ? {
                key: `target-${index}`,
                label: `TP${index + 1}`,
                value,
                color: chartContextPalette.target,
                dash: "3,5",
                width: "1.1",
              }
            : null,
        )
      : []),
  ].filter(
    (
      item,
    ): item is {
      key: string;
      label: string;
      value: number;
      color: string;
      dash: string;
      width: string;
    } => item !== null,
  );
  const priceDigits = Math.abs(paddedHigh) < 10 ? 5 : Math.abs(paddedHigh) < 100 ? 3 : 2;
  const formatPrice = (value: number) => value.toFixed(priceDigits);
  const timeIndexes = renderedCandles.length
    ? [0, Math.floor((renderedCandles.length - 1) / 2), renderedCandles.length - 1]
    : [];
  const selectedCandle = selectedIndex === null ? undefined : renderedCandles[selectedIndex];
  const chartStatus =
    dataState === "ERROR" && visible.length
      ? "VALIDATION BLOCKED"
      : dataState === "LIVE"
        ? "LIVE"
        : dataState;
  const stateTone = dataState === "LIVE" ? "positive" : "warning";
  const railLabelEntries = [
    livePriceValue !== undefined
      ? { key: "spot", label: "SPOT", value: livePriceValue, color: colors.chart }
      : null,
    ...levelEntries
      .filter(
        (entry) =>
          entry.key.startsWith("entry") || entry.key === "stop" || entry.key.startsWith("target-"),
      )
      .slice(0, 6),
  ].filter(
    (entry): entry is { key: string; label: string; value: number; color: string } =>
      entry !== null,
  );
  const positionedRailLabels = railLabelEntries
    .sort((a, b) => y(a.value) - y(b.value))
    .reduce<Array<{ key: string; label: string; value: number; color: string; labelY: number }>>(
      (placed, entry) => {
        const desired = clamp(y(entry.value), 12, chartHeight - 12);
        const previous = placed[placed.length - 1];
        const labelY = previous ? Math.max(desired, previous.labelY + 19) : desired;
        placed.push({ ...entry, labelY: clamp(labelY, 12, chartHeight - 12) });
        return placed;
      },
      [],
    )
    .map((entry, index, entries) => {
      if (index !== entries.length - 1) return entry;
      return entry.labelY > chartHeight - 12 ? { ...entry, labelY: chartHeight - 12 } : entry;
    });

  const emitViewport = (next: Partial<MarketChartViewport> = {}) => {
    onViewportChange?.({
      zoom: next.zoom ?? effectiveZoom,
      scrollX: next.scrollX ?? scrollXRef.current,
      axisPadding: next.axisPadding ?? axisPadding,
    });
  };

  const updateScroll = (nextValue: number) => {
    const next = clamp(nextValue, 0, maxScrollRef.current);
    scrollXRef.current = next;
    scrollRef.current?.scrollTo({ x: next, animated: false });
    if (next > 36) leftEdgeArmed.current = true;
    emitViewport({ scrollX: next });
  };

  const requestOlderHistory = () => {
    if (
      !onLoadOlderHistory ||
      !hasOlderHistory ||
      historyLoading ||
      historyRequestInFlight.current ||
      !leftEdgeArmed.current
    )
      return;
    historyRequestInFlight.current = true;
    leftEdgeArmed.current = false;
    Promise.resolve(onLoadOlderHistory()).finally(() => {
      historyRequestInFlight.current = false;
    });
  };

  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const selectCandleAt = (locationX: number) => {
    if (!renderedCandles.length) return;
    const slotWidth = (chartWidth - plotLeft - plotRight) / renderedCandles.length;
    const index = clamp(
      Math.floor((locationX + scrollXRef.current - plotLeft) / Math.max(slotWidth, 1)),
      0,
      renderedCandles.length - 1,
    );
    const candle = renderedCandles[index];
    setSelectedIndex(index);
    onCrosshairChange?.({ candle, index, provider, providerSymbol, timeframe, timezone });
  };

  const resetInteractions = (notify = true) => {
    clearLongPress();
    setGestureZoom(1);
    setAxisPadding(0.06);
    setResizableHeight(terminal ? 460 : expanded ? 500 : 360);
    setSelectedIndex(null);
    scrollXRef.current = maxScrollRef.current;
    shouldAutoScroll.current = true;
    scrollRef.current?.scrollToEnd({ animated: false });
    onCrosshairChange?.(null);
    onViewportChange?.({ zoom: 1, scrollX: maxScrollRef.current, axisPadding: 0.06 });
    if (notify) onReset?.();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches;
          gestureStartScroll.current = scrollXRef.current;
          gestureStartPadding.current = axisPadding;
          pinchStartZoom.current = effectiveZoom;
          pinchStartDistance.current = touchDistance(touches);
          gestureMode.current =
            touches.length >= 2
              ? "pinch"
              : event.nativeEvent.locationX <= plotLeft
                ? "axis"
                : "pan";
          longPressTriggered.current = false;
          clearLongPress();
          if (gestureMode.current === "pan") {
            const locationX = event.nativeEvent.locationX;
            longPressTimer.current = setTimeout(() => {
              longPressTriggered.current = true;
              selectCandleAt(locationX);
            }, 480);
          }
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            clearLongPress();
            gestureMode.current = "pinch";
            const nextZoom = chartZoomFromPinch(
              pinchStartZoom.current,
              pinchStartDistance.current || touchDistance(touches),
              touchDistance(touches),
            );
            setGestureZoom(nextZoom);
            emitViewport({ zoom: nextZoom });
            return;
          }
          if (Math.abs(gesture.dx) > 7 || Math.abs(gesture.dy) > 7) clearLongPress();
          if (gestureMode.current === "axis") {
            const nextPadding = chartAxisPaddingFromDrag(gestureStartPadding.current, gesture.dy);
            setAxisPadding(nextPadding);
            emitViewport({ axisPadding: nextPadding });
            return;
          }
          updateScroll(gestureStartScroll.current - gesture.dx);
        },
        onPanResponderRelease: (_event, gesture) => {
          clearLongPress();
          if (scrollXRef.current <= 4) requestOlderHistory();
          const isTap =
            !longPressTriggered.current && Math.abs(gesture.dx) < 7 && Math.abs(gesture.dy) < 7;
          if (isTap) {
            const now = Date.now();
            if (now - lastTapAt.current < 320) {
              lastTapAt.current = 0;
              resetInteractions(true);
            } else {
              lastTapAt.current = now;
            }
          }
        },
        onPanResponderTerminate: clearLongPress,
        onPanResponderTerminationRequest: () => false,
      }),
    [
      axisPadding,
      chartWidth,
      effectiveZoom,
      hasOlderHistory,
      historyLoading,
      onCrosshairChange,
      onLoadOlderHistory,
      onReset,
      onViewportChange,
      plotLeft,
      provider,
      providerSymbol,
      renderedCandles,
      timeframe,
      timezone,
    ],
  );

  const axisPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: (event) => {
          gestureStartPadding.current = axisPadding;
          axisStartY.current = event.nativeEvent.pageY ?? event.nativeEvent.touches?.[0]?.pageY;
        },
        onPanResponderMove: (event, gesture) => {
          const currentY = event.nativeEvent.pageY ?? event.nativeEvent.touches?.[0]?.pageY;
          const startY = axisStartY.current;
          const distance =
            startY !== undefined && currentY !== undefined ? currentY - startY : gesture.dy;
          setAxisPadding(chartAxisPaddingFromDrag(gestureStartPadding.current, distance));
          emitViewport({
            axisPadding: chartAxisPaddingFromDrag(gestureStartPadding.current, distance),
          });
        },
        onPanResponderRelease: () => {
          axisStartY.current = undefined;
          emitViewport();
        },
        onPanResponderTerminate: () => {
          axisStartY.current = undefined;
        },
      }),
    [axisPadding, onViewportChange],
  );

  const resizePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 2,
        onPanResponderGrant: (event) => {
          resizeStartHeight.current = chartHeight;
          resizeStartY.current = event.nativeEvent.pageY ?? event.nativeEvent.touches?.[0]?.pageY;
        },
        onPanResponderMove: (event, gesture) => {
          const minimum = expanded ? 360 : terminal ? 360 : 300;
          const maximum = expanded ? 760 : 560;
          const currentY = event.nativeEvent.pageY ?? event.nativeEvent.touches?.[0]?.pageY;
          const distance =
            resizeStartY.current !== undefined && currentY !== undefined
              ? currentY - resizeStartY.current
              : gesture.dy;
          setResizableHeight(clamp(resizeStartHeight.current + distance, minimum, maximum));
        },
        onPanResponderRelease: () => {
          resizeStartY.current = undefined;
          emitViewport();
        },
        onPanResponderTerminate: () => {
          resizeStartY.current = undefined;
        },
      }),
    [chartHeight, expanded, terminal],
  );

  useEffect(() => {
    resetInteractions(false);
  }, [resetSignal]);

  useEffect(() => {
    setGestureZoom(clamp(zoom, 0.5, 3));
  }, [zoom]);

  useEffect(() => () => clearLongPress(), []);

  const handleContentSizeChange = (contentWidth: number) => {
    maxScrollRef.current = Math.max(0, contentWidth - chartViewportWidth);
    if (shouldAutoScroll.current) {
      scrollRef.current?.scrollToEnd({ animated: false });
      scrollXRef.current = maxScrollRef.current;
      shouldAutoScroll.current = false;
    }
  };

  return (
    <View
      testID="market-candle-chart"
      style={[
        styles.marketChart,
        expanded && styles.marketChartExpanded,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <View style={styles.marketChartHeader}>
        <View>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.chartSub, { color: colors.mutedForeground }]}>
            {timeframe} · {chartStatus}
            {displayOnly ? " · REFERENCE VIEW" : ""} · {renderedCandles.length} candles ·{" "}
            {Math.round(effectiveZoom * 100)}%
          </Text>
        </View>
        <StatusPill label={chartStatus} tone={stateTone} />
      </View>
      {!visible.length ? (
        <View style={[styles.chartEmpty, { height: chartHeight }]}>
          {dataState === "ERROR" ? (
            <Feather name="alert-triangle" size={18} color={colors.warning} />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
          <Text style={[styles.chartEmptyText, { color: colors.mutedForeground }]}>
            {dataState === "ERROR"
              ? "No valid market candle data available"
              : "Waiting for the market series"}
          </Text>
        </View>
      ) : (
        <>
          <Text
            testID="chart-volume-label"
            style={[styles.chartPaneLabel, { color: colors.mutedForeground }]}
          >
            PRICE · VOLUME HISTOGRAM
          </Text>
          {selectedCandle ? (
            <View
              testID="chart-crosshair-readout"
              style={[
                styles.chartCrosshairReadout,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.chartCrosshairTime, { color: colors.foreground }]}>
                {formatChartTime(selectedCandle.time, true)} UTC
              </Text>
              <Text style={[styles.chartCrosshairValue, { color: colors.mutedForeground }]}>
                O {formatPrice(selectedCandle.open)} H {formatPrice(selectedCandle.high)} L{" "}
                {formatPrice(selectedCandle.low)} C {formatPrice(selectedCandle.close)} V{" "}
                {Math.round(selectedCandle.volume)}
              </Text>
            </View>
          ) : null}
          <View
            testID="chart-gesture-viewport"
            style={[
              styles.chartGestureViewport,
              { width: chartViewportWidth, height: chartHeight },
            ]}
            {...panResponder.panHandlers}
          >
            <View
              style={[
                styles.chartPlotViewport,
                { width: chartPlotViewportWidth, height: chartHeight },
              ]}
            >
              <ScrollView
                ref={scrollRef}
                horizontal
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={handleContentSizeChange}
                contentContainerStyle={styles.chartScrollContent}
              >
                <Svg width={chartWidth} height={chartHeight}>
                  {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                    const value = paddedHigh - range * step;
                    return (
                      <Line
                        key={`horizontal-grid-${step}`}
                        x1={plotLeft}
                        x2={chartWidth - plotRight}
                        y1={y(value)}
                        y2={y(value)}
                        stroke={colors.border}
                        strokeWidth="1"
                        opacity={0.58}
                      />
                    );
                  })}
                  {[0, 0.25, 0.5, 0.75, 1].map((step) => (
                    <Line
                      key={`vertical-grid-${step}`}
                      x1={plotLeft + (chartWidth - plotLeft - plotRight) * step}
                      x2={plotLeft + (chartWidth - plotLeft - plotRight) * step}
                      y1={plotTop}
                      y2={volumeBaseline}
                      stroke={colors.border}
                      strokeWidth="1"
                      opacity={0.38}
                    />
                  ))}
                  {!cleanMode ? (
                    <Line
                      x1={plotLeft}
                      x2={chartWidth - plotRight}
                      y1={volumeBaseline}
                      y2={volumeBaseline}
                      stroke={colors.border}
                      strokeWidth="1"
                      opacity="0.85"
                    />
                  ) : null}
                  {levelEntries.map((entry) => (
                    <Line
                      key={`${entry.key}-line`}
                      x1={plotLeft}
                      x2={chartWidth - plotRight}
                      y1={y(entry.value)}
                      y2={y(entry.value)}
                      stroke={entry.color}
                      strokeWidth={entry.width}
                      strokeDasharray={entry.dash}
                      opacity="0.88"
                    />
                  ))}
                  {livePriceValue !== undefined ? (
                    <Line
                      testID="chart-live-price-line"
                      x1={plotLeft}
                      x2={chartWidth - plotRight}
                      y1={y(livePriceValue)}
                      y2={y(livePriceValue)}
                      stroke={colors.chart}
                      strokeWidth="1.5"
                      strokeDasharray="2,3"
                      opacity="0.95"
                    />
                  ) : null}
                  {renderedCandles.map((candle, index) => {
                    const rising = candle.close >= candle.open;
                    const color = rising ? colors.success : colors.destructive;
                    const bodyTop = y(Math.max(candle.open, candle.close));
                    const bodyBottom = y(Math.min(candle.open, candle.close));
                    return (
                      <React.Fragment key={`${candle.time}-${index}`}>
                        <Line
                          x1={x(index)}
                          x2={x(index)}
                          y1={y(candle.high)}
                          y2={y(candle.low)}
                          stroke={color}
                          strokeWidth="1"
                        />
                        <Rect
                          x={x(index) - candleWidth / 2}
                          y={bodyTop}
                          width={candleWidth}
                          height={Math.max(2, bodyBottom - bodyTop)}
                          fill={color}
                          rx="1"
                        />
                      </React.Fragment>
                    );
                  })}
                  {!cleanMode
                    ? visible.map((candle, index) => {
                        const rising = candle.close >= candle.open;
                        const color = rising ? colors.success : colors.destructive;
                        return (
                          <Rect
                            key={`volume-${candle.time}-${index}`}
                            testID={`volume-bar-${index}`}
                            x={x(index) - candleWidth / 2}
                            y={volumeY(candle.volume)}
                            width={candleWidth}
                            height={Math.max(1, volumeBaseline - volumeY(candle.volume))}
                            fill={color}
                            opacity="0.62"
                            rx="1"
                          />
                        );
                      })
                    : null}
                  {selectedCandle && selectedIndex !== null ? (
                    <>
                      <Line
                        testID="chart-crosshair-vertical"
                        x1={x(selectedIndex)}
                        x2={x(selectedIndex)}
                        y1={plotTop}
                        y2={volumeBaseline}
                        stroke={colors.foreground}
                        strokeWidth="1"
                        strokeDasharray="3,3"
                        opacity="0.72"
                      />
                      <Line
                        testID="chart-crosshair-horizontal"
                        x1={plotLeft}
                        x2={chartWidth - plotRight}
                        y1={y(selectedCandle.close)}
                        y2={y(selectedCandle.close)}
                        stroke={colors.foreground}
                        strokeWidth="1"
                        strokeDasharray="3,3"
                        opacity="0.72"
                      />
                    </>
                  ) : null}
                  {timeIndexes.map((index) => (
                    <SvgText
                      key={`time-${index}`}
                      x={x(index)}
                      y={chartHeight - 10}
                      fill={colors.mutedForeground}
                      fontSize="9"
                      textAnchor={
                        index === 0
                          ? "start"
                          : index === renderedCandles.length - 1
                            ? "end"
                            : "middle"
                      }
                    >
                      {formatChartTime(
                        renderedCandles[index].time,
                        index === 0 || index === renderedCandles.length - 1,
                      )}
                    </SvgText>
                  ))}
                </Svg>
              </ScrollView>
              <View
                testID="chart-price-scale-area"
                pointerEvents="none"
                style={[styles.chartPriceScaleArea, { width: plotLeft }]}
              />
            </View>
            <View
              testID="chart-price-rail"
              pointerEvents="box-only"
              {...axisPanResponder.panHandlers}
              style={[
                styles.chartPriceRail,
                {
                  width: priceRailWidth,
                  height: chartHeight,
                  backgroundColor: colors.background,
                  borderLeftColor: colors.border,
                },
              ]}
            >
              <Svg width={priceRailWidth} height={chartHeight}>
                {[0, 0.2, 0.4, 0.6, 0.8, 1].map((step) => {
                  const value = paddedHigh - range * step;
                  return (
                    <SvgText
                      key={`rail-scale-${step}`}
                      x={priceRailWidth - 4}
                      y={clamp(y(value) + 3, 9, chartHeight - 7)}
                      fill={colors.mutedForeground}
                      fontSize="9"
                      textAnchor="end"
                    >
                      {formatPrice(value)}
                    </SvgText>
                  );
                })}
                {positionedRailLabels.map((entry) => {
                  const isSpot = entry.key === "spot";
                  const tagWidth = isSpot ? priceRailWidth - 8 : Math.min(priceRailWidth - 8, 92);
                  const tagX = priceRailWidth - tagWidth - 4;
                  const tagHeight = isSpot ? 22 : 18;
                  const tagY = entry.labelY - tagHeight / 2;
                  const liveTagY = clamp(entry.labelY + 10, 9, chartHeight - 9);
                  const text = isSpot
                    ? `SPOT ${formatPrice(entry.value)}`
                    : `${entry.label.replace("BUY ", "B ").replace("SELL ", "S ")} ${formatPrice(entry.value)}`;
                  return (
                    <React.Fragment key={`rail-label-${entry.key}`}>
                      <Rect
                        x={tagX}
                        y={tagY}
                        width={tagWidth}
                        height={tagHeight}
                        rx="3"
                        fill={entry.color}
                        opacity={isSpot ? 0.95 : 0.84}
                      />
                      <SvgText
                        testID={isSpot ? "chart-live-price-label" : undefined}
                        x={tagX + 6}
                        y={entry.labelY + 3}
                        fill={colors.primaryForeground}
                        fontSize={isSpot ? "9" : "8"}
                        fontWeight="700"
                      >
                        {text}
                      </SvgText>
                      {isSpot && cleanMode ? (
                        <>
                          <Rect
                            x={tagX}
                            y={liveTagY}
                            width={tagWidth}
                            height="18"
                            rx="2"
                            fill={colors.success}
                            opacity="0.98"
                          />
                          <SvgText
                            x={tagX + 6}
                            y={liveTagY + 12}
                            fill={colors.primaryForeground}
                            fontSize="9"
                            fontWeight="700"
                          >
                            {formatPrice(entry.value)}
                          </SvgText>
                        </>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
          </View>
          {levelEntries.length ? (
            <View
              testID="chart-level-legend"
              style={[
                styles.chartLevelLegend,
                { borderColor: colors.border, backgroundColor: colors.background },
              ]}
            >
              <View style={styles.chartLevelLegendHeader}>
                <Text style={[styles.chartLevelLegendTitle, { color: colors.mutedForeground }]}>
                  OPPORTUNITY LEVELS
                </Text>
                <Text style={[styles.chartLevelLegendHint, { color: colors.mutedForeground }]}>
                  lines match colors
                </Text>
              </View>
              <View style={styles.chartLevelLegendGrid}>
                {levelEntries.map((entry) => {
                  const shortLabel = entry.label === "ENTRY" ? "ENTRY" : entry.label;
                  return (
                    <View
                      key={`${entry.key}-legend`}
                      style={[
                        styles.chartLevelChip,
                        { borderColor: `${entry.color}70`, backgroundColor: `${entry.color}12` },
                      ]}
                    >
                      <View style={[styles.chartLevelDot, { backgroundColor: entry.color }]} />
                      <Text style={[styles.chartLevelChipText, { color: entry.color }]}>
                        {shortLabel}
                      </Text>
                      <Text style={[styles.chartLevelChipValue, { color: colors.foreground }]}>
                        {formatPrice(entry.value)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
          <View
            testID="chart-resize-handle"
            {...resizePanResponder.panHandlers}
            style={[
              styles.chartResizeHandle,
              cleanMode && styles.chartResizeHandleHidden,
              { borderColor: colors.border },
            ]}
          >
            <View style={[styles.chartResizeGrip, { backgroundColor: colors.mutedForeground }]} />
            <Text style={[styles.chartResizeText, { color: colors.mutedForeground }]}>
              {expanded
                ? `Drag to resize · ${chartHeight}px · double tap to reset`
                : `Drag to resize · ${chartHeight}px · expand for full view`}
            </Text>
          </View>
        </>
      )}
      {blockedReason ? (
        <View
          style={[
            styles.chartBlocked,
            { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}45` },
          ]}
        >
          <Feather name="lock" size={12} color={colors.warning} />
          <Text style={[styles.chartBlockedText, { color: colors.warning }]}>{blockedReason}</Text>
        </View>
      ) : null}
      {renderedCandles.length > 0 ? (
        <Text style={[styles.chartHint, { color: colors.mutedForeground }]}>
          {candleMode === "Heikin-Ashi" ? "Heikin-Ashi view · " : `${timezone} · `}Drag horizontally
          · use − / + to zoom · pinch to zoom · hold for OHLC · drag price scale · double tap to
          reset{historyLoading ? " · loading history" : ""}
        </Text>
      ) : null}
    </View>
  );
}

export function MarketCandleChart(props: MarketCandleChartProps) {
  return <TradingViewChart {...props} />;
}

export function SignalCard({
  signal,
  liveQuote,
  onPress,
  connected = true,
  cardWidth,
}: {
  signal: Signal;
  liveQuote?: { price?: number; dataState?: string; referenceState?: string };
  onPress: () => void;
  connected?: boolean;
  cardWidth?: number;
}) {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.35;
  const appear = useRef(new Animated.Value(0)).current;
  const isLong = signal.direction === "LONG";
  const isShort = signal.direction === "SHORT";
  const directionTone = isLong
    ? colors.success
    : isShort
      ? colors.destructive
      : colors.mutedForeground;
  const directionIcon = isLong ? "trending-up" : isShort ? "trending-down" : "minus";
  const quoteIsLive =
    liveQuote?.dataState === "LIVE" &&
    typeof liveQuote.price === "number" &&
    Number.isFinite(liveQuote.price) &&
    liveQuote.price > 0;
  const quoteHasPrice =
    typeof liveQuote?.price === "number" && Number.isFinite(liveQuote.price) && liveQuote.price > 0;
  const currentPrice = quoteHasPrice ? liveQuote!.price! : signal.price;
  const rawDataState = liveQuote?.dataState ?? signal.dataState;
  const dataState = rawDataState === "LIVE" && !connected && !quoteIsLive ? "STALE" : rawDataState;
  const quoteReferenceState = liveQuote?.referenceState ?? signal.referenceState;
  const hasNumericPrice =
    typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0;
  const priceState = resolvePriceState(
    dataState,
    quoteReferenceState,
    hasNumericPrice && dataState !== "ERROR",
  );
  const priceStateVisual = getPriceStateVisual(priceState, colors);
  const hasPrice = priceState !== "UNAVAILABLE";
  const trustedMarketData = signal.dataState === "LIVE" && connected;
  const signalLevels =
    signal.levels && typeof signal.levels === "object"
      ? (signal.levels as Record<string, unknown>)
      : {};
  const rawBuyGate = signalLevels.buyEntry;
  const rawSellGate = signalLevels.sellEntry;
  const buyGate =
    typeof rawBuyGate === "number" && Number.isFinite(rawBuyGate) && rawBuyGate > 0
      ? rawBuyGate
      : null;
  const sellGate =
    typeof rawSellGate === "number" && Number.isFinite(rawSellGate) && rawSellGate > 0
      ? rawSellGate
      : null;
  const trustedGates = trustedMarketData && buyGate !== null && sellGate !== null;
  const trustedCurrentPrice = quoteIsLive || (trustedMarketData && !quoteHasPrice);
  const gatePositionAvailable = trustedGates && trustedCurrentPrice && hasPrice;
  const lowerGate = buyGate !== null && sellGate !== null ? Math.min(buyGate, sellGate) : null;
  const upperGate = buyGate !== null && sellGate !== null ? Math.max(buyGate, sellGate) : null;
  const leftGateLabel =
    buyGate !== null && sellGate !== null && buyGate < sellGate ? "BUY GATE" : "SELL GATE";
  const rightGateLabel = leftGateLabel === "BUY GATE" ? "SELL GATE" : "BUY GATE";
  const leftGateValue = leftGateLabel === "BUY GATE" ? buyGate : sellGate;
  const rightGateValue = rightGateLabel === "BUY GATE" ? buyGate : sellGate;
  const gatePositionLabel = !gatePositionAvailable
    ? "POSITION UNAVAILABLE"
    : currentPrice === buyGate
      ? "AT BUY GATE"
      : currentPrice === sellGate
        ? "AT SELL GATE"
        : currentPrice! < lowerGate!
          ? `BELOW ${leftGateLabel}`
          : currentPrice! > upperGate!
            ? `ABOVE ${rightGateLabel}`
            : "BETWEEN GATES";
  const gatePositionPercent =
    gatePositionAvailable && lowerGate !== upperGate
      ? Math.min(100, Math.max(0, ((currentPrice! - lowerGate!) / (upperGate! - lowerGate!)) * 100))
      : 50;
  const setupIsQualified =
    trustedMarketData && signal.qualified === true && signal.direction !== "NONE";
  const customerSetupLabel = ["Gold setup", "FX setup", "BBB setup", "BBB Gold 3S"].find(
    (label) => label === signal.setupLabel,
  );
  const setupBadgeLabel = customerSetupLabel
    ? `SETUP · ${customerSetupLabel}`
    : "SETUP NAME UNAVAILABLE";
  const referenceCondition = (signal as Signal & { referenceCondition?: string })
    .referenceCondition;
  const stateLabel = priceState;
  const priceStateLabel = priceStatePresentation[priceState].detailLabel;
  const actionLabel = !trustedMarketData
    ? stateLabel === "REFERENCE"
      ? "REFERENCE PRICE"
      : "SETUP PAUSED"
    : signal.qualified === false
      ? "NO QUALIFIED SETUP"
      : signal.direction === "NONE"
        ? "MONITORING"
        : signal.action;
  const trustBadgeLabel = !trustedMarketData
    ? stateLabel === "REFERENCE"
      ? "REVIEW REQUIRED"
      : "DATA UNTRUSTED"
    : setupIsQualified
      ? "QUALIFIED"
      : signal.qualified === false
        ? "NOT QUALIFIED"
        : signal.direction === "NONE"
          ? "MONITORING"
          : "REVIEW REQUIRED";
  const digits = signal.symbol.includes("JPY")
    ? 3
    : signal.symbol.length === 6 && !signal.symbol.includes("XAU")
      ? 5
      : 2;
  const price = hasPrice ? currentPrice!.toFixed(digits) : "—";
  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 360,
      delay: 35,
      useNativeDriver: false,
    }).start();
    return () => appear.stopAnimation();
  }, [appear]);
  return (
    <Animated.View
      style={{
        opacity: appear,
        transform: [
          { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
        ],
      }}
    >
      <View
        style={[
          styles.signalCard,
          cardWidth ? { width: cardWidth, marginHorizontal: 0 } : null,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderLeftColor: directionTone,
          },
        ]}
      >
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${signal.symbol}. ${signal.direction === "NONE" ? "Monitoring" : `${signal.direction.toLowerCase()} setup`}. ${priceStateLabel.toLowerCase()}${hasPrice ? ` ${price}` : ""}. ${actionLabel.toLowerCase()}. ${trustBadgeLabel.toLowerCase()}.`}
          accessibilityHint="Opens the full signal details."
          onPress={onPress}
          testID={`signal-card-${signal.symbol}`}
          style={({ pressed }) => [
            styles.signalCardContent,
            { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.992 : 1 }] },
          ]}
        >
          <View style={[styles.cardTop, largeText && styles.cardTopLarge]}>
            <View style={styles.cardIdentity}>
              <Text style={[styles.symbol, { color: colors.foreground }]}>{signal.symbol}</Text>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.directionBadge,
                    { backgroundColor: `${directionTone}18`, borderColor: `${directionTone}50` },
                  ]}
                >
                  <Feather name={directionIcon} size={11} color={directionTone} />
                  <Text style={[styles.badgeText, { color: directionTone }]}>
                    {signal.direction}
                  </Text>
                </View>
                <PriceStateBadge state={priceState} />
                <Text
                  style={[
                    styles.strategyBadge,
                    {
                      color:
                        customerSetupLabel && setupIsQualified
                          ? colors.primary
                          : colors.mutedForeground,
                      backgroundColor: colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {setupBadgeLabel}
                </Text>
              </View>
              <Text style={[styles.instrument, { color: colors.mutedForeground }]}>
                {signal.name}
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text
                style={[
                  styles.grade,
                  { color: signal.grade === "A+" ? colors.success : colors.warning },
                ]}
              >
                {signal.grade}
              </Text>
              <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
            </View>
          </View>
          <View
            testID={`signal-price-${signal.symbol}`}
            style={[
              styles.spotPanel,
              largeText && styles.spotPanelLarge,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <View>
              <Text style={[styles.spotLabel, { color: colors.mutedForeground }]}>SPOT PRICE</Text>
              <Text
                style={[
                  styles.price,
                  { color: hasPrice ? priceStateVisual.color : colors.mutedForeground },
                ]}
              >
                {price}
              </Text>
            </View>
            <View style={[styles.staleCopy, largeText && styles.staleCopyLarge]}>
              <PriceStateBadge state={priceState} label={priceStateLabel} />
              <Text style={[styles.staleSub, { color: colors.mutedForeground }]}>
                {priceState === "LIVE"
                  ? "Live market price"
                  : priceState === "REFERENCE"
                    ? "Reference price; not a trusted live quote"
                    : priceState === "STALE"
                      ? referenceCondition === "MARKET_CLOSED"
                        ? "Last market-session reference; waiting for fresh data"
                        : "Last source value; waiting for fresh market data"
                      : "No current price is available"}
              </Text>
            </View>
          </View>
          <View
            testID={`signal-gates-${signal.symbol}`}
            style={[
              styles.gatePanel,
              largeText && styles.gatePanelLarge,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <View style={[styles.gateLabels, largeText && styles.gateLabelsLarge]}>
              <View>
                <Text style={[styles.gateLabel, { color: colors.mutedForeground }]}>
                  {leftGateLabel}
                </Text>
                <Text
                  style={[
                    styles.gateValue,
                    { color: trustedGates ? colors.foreground : colors.mutedForeground },
                  ]}
                >
                  {trustedGates ? leftGateValue!.toFixed(digits) : "—"}
                </Text>
              </View>
              <View style={[styles.gateRightValue, largeText && styles.gateRightValueLarge]}>
                <Text style={[styles.gateLabel, { color: colors.mutedForeground }]}>
                  {rightGateLabel}
                </Text>
                <Text
                  style={[
                    styles.gateValue,
                    { color: trustedGates ? colors.foreground : colors.mutedForeground },
                  ]}
                >
                  {trustedGates ? rightGateValue!.toFixed(digits) : "—"}
                </Text>
              </View>
            </View>
            <View style={[styles.gateTrack, { backgroundColor: colors.border }]}>
              {gatePositionAvailable ? (
                <View
                  style={[
                    styles.gateFill,
                    { width: `${gatePositionPercent}%`, backgroundColor: directionTone },
                  ]}
                />
              ) : null}
              {gatePositionAvailable ? (
                <View
                  style={[
                    styles.gatePin,
                    {
                      left: `${gatePositionPercent}%`,
                      backgroundColor: colors.card,
                      borderColor: directionTone,
                    },
                  ]}
                />
              ) : null}
            </View>
            <View style={[styles.gatePositionRow, largeText && styles.gatePositionRowLarge]}>
              <View>
                <Text
                  testID={`signal-gate-position-${signal.symbol}`}
                  style={[
                    styles.gatePositionLabel,
                    { color: gatePositionAvailable ? directionTone : colors.warning },
                  ]}
                >
                  {gatePositionLabel}
                </Text>
                <Text style={[styles.gatePositionDetail, { color: colors.mutedForeground }]}>
                  {gatePositionAvailable
                    ? "Current price relative to both gates"
                    : "Waiting for trusted live price and gate data"}
                </Text>
              </View>
              <View style={[styles.gateCurrentPrice, largeText && styles.gateCurrentPriceLarge]}>
                <Text style={[styles.gateLabel, { color: colors.mutedForeground }]}>
                  CURRENT PRICE
                </Text>
                <Text
                  style={[
                    styles.gateValue,
                    {
                      color:
                        trustedCurrentPrice && hasPrice
                          ? colors.foreground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {trustedCurrentPrice && hasPrice ? currentPrice!.toFixed(digits) : "—"}
                </Text>
              </View>
            </View>
          </View>
          <View
            style={[
              styles.actionBanner,
              largeText && styles.actionBannerLarge,
              {
                backgroundColor: setupIsQualified ? `${colors.success}12` : colors.secondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.action,
                { color: setupIsQualified ? directionTone : colors.mutedForeground },
              ]}
            >
              {actionLabel}
            </Text>
            <Text
              style={[
                styles.trustBadge,
                {
                  color: setupIsQualified ? colors.success : colors.warning,
                  borderColor: colors.border,
                },
              ]}
            >
              {trustBadgeLabel}
            </Text>
          </View>
          <View
            testID={`signal-trade-plan-${signal.symbol}`}
            style={[
              styles.tradePlan,
              largeText && styles.tradePlanLarge,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            {[
              ["ENTRY", signal.entry, colors.foreground],
              ["STOP", signal.stop, colors.destructive],
              ["TP1", signal.tp1, colors.success],
            ].map(([label, value, color]) => (
              <View
                key={label as string}
                style={[styles.planCell, largeText && styles.planCellLarge]}
              >
                <Text style={[styles.planLabel, { color: colors.mutedForeground }]}>
                  {label as string}
                </Text>
                <Text
                  style={[
                    styles.planValue,
                    { color: trustedMarketData ? (color as string) : colors.mutedForeground },
                  ]}
                >
                  {trustedMarketData && typeof value === "number" ? value.toFixed(digits) : "—"}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>
        <View
          style={[
            styles.cardFooter,
            largeText && styles.cardFooterLarge,
            { borderTopColor: colors.border },
          ]}
        >
          <View style={styles.footerLeft}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {signal.age} ago
            </Text>
          </View>
          <View style={[styles.footerActions, largeText && styles.footerActionsLarge]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open lot sizing details for ${signal.symbol}`}
              onPress={onPress}
              testID={`signal-lots-${signal.symbol}`}
              style={styles.footerAction}
            >
              <Text style={[styles.footerActionText, { color: colors.secondaryForeground }]}>
                Lots
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open trade plan for ${signal.symbol}`}
              onPress={onPress}
              testID={`signal-plan-${signal.symbol}`}
              style={[styles.planAction, styles.footerAction]}
            >
              <Text style={[styles.footerActionText, { color: colors.success }]}>Plan</Text>
              <Feather name="chevron-right" size={14} color={colors.success} />
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  detail,
  action,
  onAction,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.empty,
        { backgroundColor: colors[designTokens.surface.raised], borderColor: colors.border },
      ]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: colors[designTokens.surface.control] }]}>
        <Feather name={icon} size={21} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyDetail, { color: colors.mutedForeground }]}>{detail}</Text>
      {action ? (
        <PrimaryButton
          label={action}
          onPress={onAction ?? (() => undefined)}
          testID="empty-action"
        />
      ) : null}
    </View>
  );
}

export function EducationalPreview({ onMethodology }: { onMethodology?: () => void }) {
  const colors = useColors();
  const rows = [
    ["Entry", "The trigger price to review after validation", "educational-entry"],
    ["Stop", "The level that defines when the idea is invalidated", "educational-stop"],
    ["Target", "The planned objective for the review", "educational-target"],
  ] as const;
  return (
    <View
      testID="educational-preview"
      style={[
        styles.educationalPreview,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.educationalHeader}>
        <View
          style={[
            styles.educationalIcon,
            { backgroundColor: `${colors.chart}18`, borderColor: `${colors.chart}45` },
          ]}
        >
          <Feather name="book-open" size={16} color={colors.chart} />
        </View>
        <View style={styles.educationalHeading}>
          <Text style={[styles.educationalKicker, { color: colors.chart }]}>
            EDUCATIONAL PREVIEW
          </Text>
          <Text style={[styles.educationalTitle, { color: colors.foreground }]}>
            How a qualified opportunity is structured
          </Text>
        </View>
      </View>
      <Text style={[styles.educationalBody, { color: colors.mutedForeground }]}>
        Example only — this is not a live signal, not tradable, and not an authoritative market
        result.
      </Text>
      <View style={[styles.educationalRows, { borderColor: colors.border }]}>
        {rows.map(([label, detail, testID]) => (
          <View
            key={label}
            testID={testID}
            style={[styles.educationalRow, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.educationalLabel, { color: colors.foreground }]}>{label}</Text>
            <Text style={[styles.educationalValue, { color: colors.mutedForeground }]}>
              {detail}
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.educationalFooter, { backgroundColor: colors.muted }]}>
        <Feather name="shield" size={13} color={colors.warning} />
        <Text style={[styles.educationalFooterText, { color: colors.mutedForeground }]}>
          Numbers appear only when current market information is qualified.
        </Text>
      </View>
      {onMethodology ? (
        <Pressable testID="educational-methodology" onPress={onMethodology}>
          <Text style={[styles.educationalLink, { color: colors.primary }]}>
            Read data information <Feather name="arrow-up-right" size={12} color={colors.primary} />
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  testID,
  icon,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  busy?: boolean;
}) {
  const colors = useColors();
  const pressMotion = usePressMotion();
  return (
    <Animated.View style={pressMotion.animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        testID={testID}
        onPress={onPress}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: colors.primary,
            opacity: disabled || busy ? 0.55 : pressed ? 0.82 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : icon ? (
          <Feather name={icon} size={16} color={colors.primaryForeground} />
        ) : null}
        <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function SecondaryButton({
  label,
  onPress,
  testID,
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
}) {
  const colors = useColors();
  const pressMotion = usePressMotion();
  return (
    <Animated.View style={pressMotion.animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        testID={testID}
        onPress={onPress}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        style={({ pressed }) => [
          styles.secondaryButton,
          {
            backgroundColor: colors.secondary,
            borderColor: colors.border,
            opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
          },
        ]}
      >
        {icon ? <Feather name={icon} size={16} color={colors.foreground} /> : null}
        <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function ModalSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { backgroundColor: `${colors.background}cc` }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 18,
            },
          ]}
        >
          <View style={styles.sheetHandle}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{title}</Text>
            <IconButton icon="x" onPress={onClose} testID="close-sheet" />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  error,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  error?: string;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        accessibilityHint={error ? `Error: ${error}` : undefined}
        testID={testID}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.input,
            borderColor: error ? colors.destructive : colors.border,
          },
        ]}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.fieldError, { color: colors.destructive }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function LoadingState({ label = "Synchronizing market state" }: { label?: string }) {
  const colors = useColors();
  const reducedMotion = useSystemReducedMotion();
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View
        style={styles.loadingSkeleton}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.loadingSkeletonHeading, { backgroundColor: colors.secondary }]} />
        <View style={styles.loadingSkeletonRow}>
          <View
            style={[
              styles.loadingSkeletonCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          />
          <View
            style={[
              styles.loadingSkeletonCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          />
        </View>
        <View style={[styles.loadingSkeletonLine, { backgroundColor: colors.secondary }]} />
        <View style={[styles.loadingSkeletonLineShort, { backgroundColor: colors.secondary }]} />
      </View>
      {!reducedMotion ? <ActivityIndicator color={colors.primary} /> : null}
      <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: "100%" },
  scrollContent: { flexGrow: 1 },
  surfaceCard: {
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.card,
    padding: designTokens.spacing.card,
    gap: designTokens.spacing.md,
  },
  header: {
    paddingHorizontal: designTokens.spacing.screen,
    paddingBottom: designTokens.spacing.header,
  },
  headerTop: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: designTokens.spacing.sm },
  upgradeButton: {
    height: 34,
    borderRadius: 11,
    borderWidth: designTokens.spacing.hairline,
    paddingHorizontal: designTokens.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.xs,
  },
  upgradeText: {
    fontSize: designTokens.typography.meta,
    fontWeight: designTokens.typography.strong,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: designTokens.radii.button,
    borderWidth: designTokens.spacing.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    position: "absolute",
    right: designTokens.spacing.md,
    top: designTokens.spacing.md,
    width: 6,
    height: 6,
    borderRadius: designTokens.radii.dot,
  },
  eyebrow: {
    fontSize: designTokens.typography.meta,
    letterSpacing: 1.7,
    textTransform: "uppercase",
    marginTop: 28,
    fontWeight: designTokens.typography.bold,
  },
  pageTitle: {
    fontSize: designTokens.typography.display,
    fontWeight: designTokens.typography.strong,
    letterSpacing: -1.2,
    marginTop: designTokens.spacing.sm,
    includeFontPadding: false,
  },
  pageTitleCompact: {
    fontSize: designTokens.typography.title,
    letterSpacing: -0.6,
    marginTop: 8,
    includeFontPadding: false,
  },
  headerRule: { height: designTokens.spacing.hairline, marginTop: 12, opacity: 0.75 },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.lg,
    marginBottom: 13,
  },
  sectionHeading: {
    fontSize: designTokens.typography.section,
    fontWeight: designTokens.typography.strong,
    letterSpacing: -0.3,
  },
  actionText: {
    fontSize: designTokens.typography.body,
    fontWeight: designTokens.typography.semibold,
  },
  feedStatus: {
    minHeight: 38,
    marginHorizontal: designTokens.spacing.screen,
    paddingHorizontal: designTokens.spacing.md,
    paddingVertical: 7,
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.control,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: designTokens.spacing.md,
  },
  feedStatusLarge: { flexDirection: "column", alignItems: "flex-start", justifyContent: "center" },
  statusSession: {
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.xs,
    flexShrink: 0,
  },
  statusConnection: {
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.xs,
    flexShrink: 0,
  },
  priceStateBadge: {
    minHeight: 22,
    borderWidth: 1,
    borderRadius: designTokens.radii.tight,
    paddingHorizontal: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.xxs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: designTokens.spacing.xxs,
    flexShrink: 0,
  },
  priceStateBadgeText: {
    fontSize: designTokens.typography.caption,
    lineHeight: 13,
    fontWeight: designTokens.typography.strong,
    letterSpacing: 0.35,
  },
  statusDotSmall: { width: 5, height: 5, borderRadius: designTokens.radii.dot },
  statusStrong: {
    fontSize: designTokens.typography.meta,
    fontWeight: designTokens.typography.strong,
    letterSpacing: 0.3,
  },
  statusDivider: { fontSize: designTokens.typography.label },
  statusMono: { fontSize: designTokens.typography.caption, fontFamily: "monospace" },
  feedLabel: { flexDirection: "row", gap: designTokens.spacing.sm, alignItems: "center" },
  feedText: { fontSize: designTokens.typography.body, fontWeight: designTokens.typography.bold },
  feedSubtext: {
    fontSize: designTokens.typography.label,
    marginTop: designTokens.spacing.xs,
    marginLeft: 23,
  },
  feedLine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  chip: {
    minHeight: designTokens.sizes.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.xs,
    borderRadius: designTokens.radii.pill,
    borderWidth: designTokens.spacing.hairline,
    paddingHorizontal: designTokens.spacing.xl,
    paddingVertical: 9,
  },
  chipText: { fontSize: designTokens.typography.label, fontWeight: designTokens.typography.bold },
  signalCard: {
    marginHorizontal: designTokens.spacing.screen,
    marginBottom: designTokens.spacing.section,
    borderWidth: designTokens.spacing.hairline,
    borderLeftWidth: 3,
    borderRadius: designTokens.radii.card,
    padding: designTokens.spacing.card,
    elevation: 3,
  },
  signalCardContent: { width: "100%" },
  cardIdentity: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardTopLarge: { flexDirection: "column" },
  symbol: { fontSize: 19, fontWeight: designTokens.typography.strong, letterSpacing: 0.3 },
  instrument: { fontSize: designTokens.typography.label, marginTop: designTokens.spacing.xxs },
  cardRight: { flexDirection: "row", alignItems: "center", gap: 9 },
  grade: { fontSize: 12, fontWeight: "800" },
  gradeText: { fontSize: 12, fontWeight: "800" },
  badgeRow: { flexDirection: "row", gap: 5, alignItems: "center", marginTop: 4, flexWrap: "wrap" },
  directionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.pill,
    paddingHorizontal: designTokens.spacing.md,
    paddingVertical: designTokens.spacing.xs,
  },
  badgeText: {
    fontSize: designTokens.typography.caption,
    fontWeight: designTokens.typography.strong,
  },
  strategyBadge: {
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.pill,
    paddingHorizontal: designTokens.spacing.md,
    paddingVertical: designTokens.spacing.xs,
    fontSize: designTokens.typography.caption,
    fontFamily: "monospace",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.xs,
    borderRadius: designTokens.radii.pill,
    paddingHorizontal: designTokens.spacing.md,
    paddingVertical: 5,
  },
  statusDot: { width: 5, height: 5, borderRadius: designTokens.radii.dot },
  statusText: {
    fontSize: designTokens.typography.meta,
    fontWeight: designTokens.typography.strong,
    letterSpacing: 0.5,
  },
  metaText: { fontSize: designTokens.typography.label, fontWeight: designTokens.typography.medium },
  spotPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.button,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: designTokens.spacing.section,
  },
  spotPanelLarge: { flexDirection: "column", alignItems: "stretch", gap: 8 },
  spotLabel: {
    fontSize: designTokens.typography.caption,
    fontWeight: designTokens.typography.strong,
    letterSpacing: 0.8,
  },
  price: {
    fontSize: designTokens.typography.price,
    fontWeight: designTokens.typography.strong,
    letterSpacing: -0.6,
    marginTop: designTokens.spacing.xxs,
    fontFamily: "monospace",
  },
  action: { fontSize: 11, fontWeight: "800", marginTop: 4, letterSpacing: 0.4 },
  staleCopy: { alignItems: "flex-end" },
  staleCopyLarge: { alignItems: "flex-start" },
  staleTitle: { fontSize: 10, fontWeight: "800" },
  staleSub: { fontSize: 9, marginTop: 3 },
  actionBanner: {
    minHeight: 38,
    borderWidth: designTokens.spacing.hairline,
    borderRadius: 11,
    paddingHorizontal: designTokens.spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
  },
  actionBannerLarge: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 9,
  },
  trustBadge: {
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.pill,
    paddingHorizontal: 7,
    paddingVertical: designTokens.spacing.xs,
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
  },
  gatePanel: {
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.button,
    padding: designTokens.spacing.xl,
    marginTop: 11,
  },
  gatePanelLarge: { gap: 8 },
  tradePlan: {
    flexDirection: "row",
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.button,
    paddingVertical: 12,
    marginTop: 11,
  },
  tradePlanLarge: { flexDirection: "column", paddingHorizontal: 12 },
  planCell: {
    flex: 1,
    paddingHorizontal: 10,
    borderRightWidth: designTokens.spacing.hairline,
    borderRightColor: brandPalette.border,
  },
  planCellLarge: {
    flex: 0,
    borderRightWidth: 0,
    borderBottomWidth: designTokens.spacing.hairline,
    paddingVertical: 7,
    paddingHorizontal: 0,
    alignItems: "flex-start",
  },
  planLabel: { fontSize: 9, fontWeight: designTokens.typography.strong, letterSpacing: 0.8 },
  planValue: {
    fontSize: 13,
    fontWeight: designTokens.typography.strong,
    fontFamily: "monospace",
    marginTop: 4,
  },
  gateLabels: { flexDirection: "row", justifyContent: "space-between" },
  gateLabelsLarge: { flexDirection: "column", gap: 8 },
  gateLabel: { fontSize: 10, fontWeight: "800" },
  gateValue: { fontSize: 12, fontWeight: "800", fontFamily: "monospace", marginTop: 3 },
  gateRightValue: { alignItems: "flex-end" },
  gateRightValueLarge: { alignItems: "flex-start" },
  gateTrack: {
    height: 5,
    borderRadius: 4,
    marginTop: 10,
    position: "relative",
    overflow: "visible",
  },
  gateFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4 },
  gatePin: {
    position: "absolute",
    top: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    marginLeft: -5,
  },
  gatePositionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 11,
    gap: 8,
  },
  gatePositionRowLarge: { flexDirection: "column", alignItems: "stretch" },
  gatePositionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  gatePositionDetail: { fontSize: 9, marginTop: 3 },
  gateCurrentPrice: { alignItems: "flex-end" },
  gateCurrentPriceLarge: { alignItems: "flex-start" },
  distanceText: { fontSize: 9, fontFamily: "monospace" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  cardFooterLarge: { flexDirection: "column", alignItems: "flex-start" },
  footerText: { flex: 1, fontSize: 11, lineHeight: 16 },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  footerButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 },
  footerButtonText: { fontSize: 9, fontWeight: "800" },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  footerActionsLarge: { flexWrap: "wrap", alignItems: "flex-start" },
  footerAction: {
    minHeight: designTokens.sizes.touchTarget,
    minWidth: designTokens.sizes.touchTarget,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  footerActionText: { fontSize: 10, fontWeight: "800" },
  planAction: { flexDirection: "row", alignItems: "center", gap: 2 },
  empty: {
    marginHorizontal: designTokens.spacing.screen,
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.card,
    padding: designTokens.spacing.spacious,
    alignItems: "center",
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: designTokens.spacing.xl,
  },
  emptyTitle: { fontSize: 16, fontWeight: designTokens.typography.bold },
  emptyDetail: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: designTokens.spacing.sm,
    marginBottom: 15,
  },
  educationalPreview: {
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.section,
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.card,
    padding: designTokens.spacing.card,
  },
  educationalHeader: { flexDirection: "row", alignItems: "center", gap: designTokens.spacing.md },
  educationalIcon: {
    width: 34,
    height: 34,
    borderRadius: designTokens.radii.control,
    borderWidth: designTokens.spacing.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  educationalHeading: { flex: 1 },
  educationalKicker: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.black,
    letterSpacing: 0.8,
  },
  educationalTitle: {
    fontSize: designTokens.typography.body,
    fontWeight: designTokens.typography.strong,
    marginTop: designTokens.spacing.xs,
  },
  educationalBody: {
    fontSize: designTokens.typography.label,
    lineHeight: 17,
    marginTop: designTokens.spacing.md,
  },
  educationalRows: {
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.button,
    marginTop: designTokens.spacing.card,
    paddingHorizontal: designTokens.spacing.md,
  },
  educationalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: designTokens.spacing.md,
    paddingVertical: 10,
  },
  educationalLabel: {
    width: 54,
    fontSize: designTokens.typography.label,
    fontWeight: designTokens.typography.bold,
  },
  educationalValue: { flex: 1, fontSize: designTokens.typography.label, lineHeight: 16 },
  educationalFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: designTokens.spacing.sm,
    borderRadius: designTokens.radii.control,
    padding: designTokens.spacing.md,
    marginTop: designTokens.spacing.md,
  },
  educationalFooterText: { flex: 1, fontSize: designTokens.typography.caption, lineHeight: 14 },
  educationalLink: {
    fontSize: designTokens.typography.label,
    fontWeight: designTokens.typography.bold,
    marginTop: designTokens.spacing.card,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: designTokens.spacing.sm,
    borderRadius: designTokens.radii.button,
    paddingHorizontal: designTokens.spacing.card,
    minHeight: designTokens.sizes.primaryButtonHeight,
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: designTokens.typography.body,
    fontWeight: designTokens.typography.strong,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: designTokens.spacing.sm,
    borderRadius: designTokens.radii.button,
    borderWidth: designTokens.spacing.hairline,
    paddingHorizontal: designTokens.spacing.card,
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: designTokens.typography.body,
    fontWeight: designTokens.typography.bold,
  },
  modalBackdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: designTokens.radii.sheet,
    borderTopRightRadius: designTokens.radii.sheet,
    borderWidth: designTokens.spacing.hairline,
    padding: designTokens.spacing.screen,
  },
  sheetHandle: { alignItems: "center", marginBottom: 11 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: designTokens.spacing.section,
  },
  sheetTitle: { fontSize: 20, fontWeight: designTokens.typography.strong },
  field: { marginBottom: designTokens.spacing.section },
  fieldError: { marginTop: 5, fontSize: designTokens.typography.caption, lineHeight: 15 },
  fieldLabel: {
    fontSize: designTokens.typography.label,
    fontWeight: designTokens.typography.bold,
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: designTokens.spacing.hairline,
    borderRadius: designTokens.radii.input,
    paddingHorizontal: 13,
    paddingVertical: designTokens.spacing.xl,
    fontSize: 15,
  },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    gap: designTokens.spacing.lg,
    paddingHorizontal: designTokens.spacing.screen,
    paddingVertical: designTokens.spacing.spacious,
  },
  loadingText: { fontSize: 12 },
  loadingSkeleton: { width: "100%", gap: designTokens.spacing.md },
  loadingSkeletonHeading: { width: "44%", height: 14, borderRadius: designTokens.radii.chip },
  loadingSkeletonRow: { flexDirection: "row", gap: designTokens.spacing.md },
  loadingSkeletonCard: {
    flex: 1,
    minHeight: 112,
    borderWidth: 1,
    borderRadius: designTokens.radii.card,
  },
  loadingSkeletonLine: { width: "92%", height: 10, borderRadius: designTokens.radii.chip },
  loadingSkeletonLineShort: { width: "62%", height: 10, borderRadius: designTokens.radii.chip },
  marketChart: { borderWidth: 0, borderRadius: 0, padding: 0, overflow: "hidden" },
  marketChartExpanded: { marginHorizontal: 0, borderRadius: 0, flex: 1 },
  marketChartHeader: { opacity: 0, height: 0, overflow: "hidden" },
  chartTitle: { fontSize: 13, fontWeight: "800" },
  chartSub: { fontSize: 10, marginTop: 3 },
  chartPaneLabel: { opacity: 0, height: 0, overflow: "hidden" },
  chartScrollContent: { minWidth: "100%" },
  chartGestureViewport: { overflow: "hidden", position: "relative" },
  chartPlotViewport: { overflow: "hidden", position: "relative" },
  chartPriceScaleArea: { display: "none" },
  chartPriceRail: {
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 3,
    elevation: 2,
    borderLeftWidth: 1,
    justifyContent: "center",
  },
  chartLevelLegend: { opacity: 0, height: 0, overflow: "hidden" },
  chartLevelLegendHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  chartLevelLegendTitle: { fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  chartLevelLegendHint: { fontSize: 8, fontFamily: "monospace" },
  chartLevelLegendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chartLevelChip: {
    minHeight: 23,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chartLevelDot: { width: 5, height: 5, borderRadius: 3 },
  chartLevelChipText: { fontSize: 8, fontWeight: "900" },
  chartLevelChipValue: { fontSize: 8, fontFamily: "monospace", fontWeight: "700" },
  chartResizeHandle: {
    minHeight: 12,
    marginTop: 0,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 0,
    gap: 0,
  },
  chartResizeHandleHidden: { minHeight: 0, height: 0, overflow: "hidden" },
  chartResizeGrip: { width: 42, height: 3, borderRadius: 2, opacity: 0.7 },
  chartResizeText: { opacity: 0, height: 0, overflow: "hidden" },
  chartCrosshairReadout: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 5,
  },
  chartCrosshairTime: { fontSize: 9, fontWeight: "800", fontFamily: "monospace" },
  chartCrosshairValue: { fontSize: 8, marginTop: 2, fontFamily: "monospace" },
  chartEmpty: { height: 300, alignItems: "center", justifyContent: "center", gap: 10 },
  chartEmptyText: { fontSize: 11 },
  chartBlocked: {
    marginTop: 9,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chartBlockedText: { flex: 1, fontSize: 10, lineHeight: 14 },
  chartHint: { opacity: 0, height: 0, overflow: "hidden" },
});
