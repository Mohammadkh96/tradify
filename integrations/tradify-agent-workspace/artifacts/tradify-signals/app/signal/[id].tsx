import Feather from "@expo/vector-icons/Feather";
import {
  getMarketCandles,
  getMarketsCatalog,
  getMarketQuotes,
  getSignalEvaluation,
  type MarketCandles,
  type MarketCatalogItem,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageMetadata } from "@/components/PageMetadata";
import { mergeMarketCandleSeries, startLiveQuotePolling } from "@/lib/live-quotes";
import { Signal, useTradify, type StrategyName } from "@/lib/tradify-store";
import { useColors } from "@/hooks/useColors";
import { chartContextPalette } from "@/constants/colors";
import { DEFAULT_ACCESS_POLICY, hasMembershipFeature } from "@/constants/membership";
import {
  MarketCandleChart,
  PriceStateBadge,
  Screen,
  type MarketChartLayer,
  type MarketChartLevels,
} from "@/components/TradifyUI";
import {
  brandPalette,
  getPriceStateVisual,
  priceStatePresentation,
  resolvePriceState,
} from "@/constants/colors";

type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1" | "W1" | "MN1";
type StrategyRequestId = "DGV8" | "DGV8_FX" | "BBB" | "BBB_GOLD_3S";
type CustomerSetupLabel = "Gold setup" | "FX setup" | "BBB setup" | "BBB Gold 3S";
const compactChartReservedHeight = 234;
const setupStrategyIds: Record<string, StrategyRequestId> = {
  "Gold setup": "DGV8",
  "FX setup": "DGV8_FX",
  "BBB setup": "BBB",
  "BBB Gold 3S": "BBB_GOLD_3S",
  DGv8: "DGV8",
  "DGv8 FX": "DGV8_FX",
  BBB: "BBB",
};
const customerSetupLabels = new Set<CustomerSetupLabel>([
  "Gold setup",
  "FX setup",
  "BBB setup",
  "BBB Gold 3S",
]);

function strategyIdForSetup(value: unknown): StrategyRequestId | undefined {
  return typeof value === "string" ? setupStrategyIds[value] : undefined;
}

function displaySetupLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "DGv8") return "Gold setup";
  if (value === "DGv8 FX") return "FX setup";
  if (value === "BBB") return "BBB setup";
  return value;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function candleStateFor(result: MarketCandles): "LIVE" | "FALLBACK" | "STALE" | "ERROR" {
  if (!result.candles.length) return "ERROR";
  return result.dataState === "LIVE" ||
    result.dataState === "FALLBACK" ||
    result.dataState === "STALE"
    ? result.dataState
    : "ERROR";
}

function numberOrNull(value: unknown): number | null {
  return finite(value) ? value : null;
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter(finite) : [];
}

function chartLevelsFor(signal: Signal): MarketChartLevels | undefined {
  const levels = (signal.levels ?? {}) as Record<string, unknown>;
  const buyTargets = numberArray(levels.buyTargets ?? levels.targets);
  const sellTargets = numberArray(levels.sellTargets ?? levels.targets);
  const result: MarketChartLevels = {
    direction: signal.direction,
    entry: numberOrNull(signal.entry),
    buyEntry: numberOrNull(levels.buyEntry),
    sellEntry: numberOrNull(levels.sellEntry),
    buyStop: numberOrNull(levels.buyStop ?? levels.stop),
    sellStop: numberOrNull(levels.sellStop ?? levels.stop),
    buyTargets,
    sellTargets,
    sourceHigh: numberOrNull(levels.sourceHigh),
    sourceLow: numberOrNull(levels.sourceLow),
    pivotResistance: numberOrNull(levels.pivotResistance),
    pivotSupport: numberOrNull(levels.pivotSupport),
  };
  const hasLevels = Object.values(result).some(
    (value) => finite(value) || (Array.isArray(value) && value.length > 0),
  );
  return hasLevels ? result : undefined;
}

function ProximityRail({
  signal,
  levels,
  currentPrice,
  digits,
  enabled,
}: {
  signal: Signal;
  levels?: MarketChartLevels;
  currentPrice?: number;
  digits: number;
  enabled: boolean;
}) {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.35;
  const entry = signal.direction === "SHORT" ? levels?.sellEntry : levels?.buyEntry;
  const stop = signal.direction === "SHORT" ? levels?.sellStop : levels?.buyStop;
  const targets = signal.direction === "SHORT" ? levels?.sellTargets : levels?.buyTargets;
  const gate = entry;
  const referenceRange =
    finite(entry) && finite(signal.entry) ? Math.abs(entry - signal.entry) : undefined;
  const progress =
    finite(currentPrice) && finite(entry) && referenceRange && referenceRange > 0
      ? Math.min(1, Math.abs(currentPrice - entry) / referenceRange)
      : 0;
  const formatPrice = (value: number | null | undefined) =>
    finite(value) ? value.toFixed(digits) : "—";
  const directionLabel =
    signal.direction === "LONG"
      ? "BUY ENTRY"
      : signal.direction === "SHORT"
        ? "SELL ENTRY"
        : "MONITORING";
  return (
    <View
      testID="entry-proximity-rail"
      style={[styles.proximityRail, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.proximityHeading, largeText && styles.proximityHeadingLarge]}>
        <View style={styles.proximityTitleRow}>
          <Feather name="target" size={14} color={colors.warning} />
          <Text style={[styles.proximityTitle, { color: colors.foreground }]}>Entry proximity</Text>
        </View>
        <Text
          style={[styles.proximityStatus, { color: enabled ? colors.success : colors.warning }]}
        >
          {enabled ? "REAL-TIME DISTANCE" : "LEVELS REQUIRED"}
        </Text>
      </View>
      {!enabled ? (
        <View style={styles.proximityBlocked}>
          <Feather name="lock" size={15} color={colors.warning} />
          <Text style={[styles.proximityBlockedText, { color: colors.mutedForeground }]}>
            The price meter unlocks after fresh, validated market data arrives. Reference prices
            never create trusted levels.
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.proximityMain, largeText && styles.proximityMainLarge]}>
            <View style={styles.proximityMainCopy}>
              <Text style={[styles.proximityEyebrow, { color: colors.mutedForeground }]}>
                {directionLabel}
              </Text>
              <Text style={[styles.proximityGatePrice, { color: colors.foreground }]}>
                {formatPrice(gate)}
              </Text>
              <Text style={[styles.proximityDistance, { color: colors.warning }]}>ENTRY PRICE</Text>
            </View>
            <View style={styles.proximityMeterWrap}>
              <View style={[styles.proximityMeterTrack, { backgroundColor: colors.secondary }]}>
                <View
                  style={[
                    styles.proximityMeterFill,
                    {
                      backgroundColor:
                        signal.direction === "SHORT" ? colors.destructive : colors.success,
                      width: `${Math.round(progress * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.proximityMeterLabel, { color: colors.mutedForeground }]}>
                {finite(currentPrice) ? `SPOT ${currentPrice.toFixed(digits)}` : "SPOT —"}
              </Text>
            </View>
          </View>
          <View style={[styles.proximityStats, largeText && styles.proximityStatsLarge]}>
            {[
              ["STOP", stop, colors.destructive],
              ["TP1", targets?.[0], colors.chart],
              ["TP2", targets?.[1], colors.chart],
              ["TP3", targets?.[2], colors.chart],
            ].map(([label, value, color]) => (
              <View
                key={label as string}
                style={[
                  styles.proximityStat,
                  largeText && styles.proximityStatLarge,
                  { borderColor: colors.border },
                ]}
              >
                <Text style={[styles.proximityStatLabel, { color: colors.mutedForeground }]}>
                  {label}
                </Text>
                <Text style={[styles.proximityStatValue, { color: color as string }]}>
                  {formatPrice(value as number | null)}
                </Text>
                <Text style={[styles.proximityStatUnit, { color: colors.mutedForeground }]}>
                  PRICE
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function ValidationSnapshot({
  dataState,
  showStrategyLevels,
  planUnlocked,
  rrPass,
  riskPass,
  riskPercent,
}: {
  dataState: string;
  showStrategyLevels: boolean;
  planUnlocked: boolean;
  rrPass: boolean;
  riskPass: boolean;
  riskPercent: number;
}) {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.35;
  const rows = [
    {
      label: "Market data",
      value: showStrategyLevels
        ? "LIVE & VALIDATED"
        : dataState === "REFERENCE"
          ? "REFERENCE ONLY"
          : "WAITING",
      tone: showStrategyLevels ? colors.success : colors.warning,
      icon: showStrategyLevels ? "check-circle" : "clock",
    },
    {
      label: "Opportunity levels",
      value: showStrategyLevels
        ? planUnlocked
          ? "READY"
          : "AVAILABLE IN PLAN"
        : "HIDDEN UNTIL CONFIRMED",
      tone: showStrategyLevels ? colors.success : colors.warning,
      icon: showStrategyLevels ? "layers" : "lock",
    },
    {
      label: "Risk / reward",
      value: showStrategyLevels ? (rrPass ? "PASS" : "REVIEW") : "WAITING",
      tone: showStrategyLevels && rrPass ? colors.success : colors.warning,
      icon: showStrategyLevels && rrPass ? "check-circle" : "alert-triangle",
    },
    {
      label: "Account risk",
      value: riskPercent > 0 ? (riskPass ? "WITHIN LIMIT" : "REVIEW") : "NOT SET",
      tone: riskPass ? colors.success : colors.warning,
      icon: riskPass ? "shield" : "alert-triangle",
    },
  ] as const;

  return (
    <View
      testID="validation-snapshot"
      style={[styles.validationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.validationHeading, largeText && styles.validationHeadingLarge]}>
        <View style={styles.validationHeadingCopy}>
          <Feather name="check-square" size={15} color={colors.primary} />
          <View>
            <Text style={[styles.validationTitle, { color: colors.foreground }]}>
              Validation snapshot
            </Text>
            <Text style={[styles.validationSubtitle, { color: colors.mutedForeground }]}>
              Know what is confirmed before you act.
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.validationBadge,
            {
              color: showStrategyLevels ? colors.success : colors.warning,
              backgroundColor: showStrategyLevels ? `${colors.success}15` : `${colors.warning}15`,
              borderColor: showStrategyLevels ? `${colors.success}45` : `${colors.warning}45`,
            },
          ]}
        >
          {showStrategyLevels ? "TRUSTED STATE" : "REVIEW STATE"}
        </Text>
      </View>
      <View style={styles.validationRows}>
        {rows.map((row) => (
          <View
            key={row.label}
            style={[
              styles.validationRow,
              largeText && styles.validationRowLarge,
              { borderTopColor: colors.border },
            ]}
          >
            <Text style={[styles.validationLabel, { color: colors.mutedForeground }]}>
              {row.label}
            </Text>
            <View style={[styles.validationValue, largeText && styles.validationValueLarge]}>
              <Feather name={row.icon} size={12} color={row.tone} />
              <Text style={[styles.validationValueText, { color: row.tone }]}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={[styles.validationFootnote, { color: colors.mutedForeground }]}>
        Reference prices are for context only; they never create trusted levels.
      </Text>
    </View>
  );
}

export default function SignalDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const isCompact = width < 600;
  const largeText = fontScale >= 1.35;
  const { id, symbol: linkedSymbol } = useLocalSearchParams<{ id: string; symbol?: string }>();
  const {
    signals,
    watchlist = [],
    mt5Connected,
    profile,
    accessPolicy = DEFAULT_ACCESS_POLICY,
    selectedStrategiesBySymbol = {},
    setStrategyForSymbol,
  } = useTradify();
  const signal =
    signals.find((item) => item.id === id) ??
    (linkedSymbol ? signals.find((item) => item.symbol === linkedSymbol) : signals[0]);
  const [marketCatalog, setMarketCatalog] = useState<MarketCatalogItem[]>([]);
  const [marketCatalogLoaded, setMarketCatalogLoaded] = useState(false);
  const [strategyPickerOpen, setStrategyPickerOpen] = useState(false);
  const [evaluatedSignal, setEvaluatedSignal] = useState<NonNullable<typeof signal> | null>(null);
  const [marketCandles, setMarketCandles] = useState<MarketCandles | null>(null);
  const [candleState, setCandleState] = useState<
    "LIVE" | "FALLBACK" | "STALE" | "SYNCING" | "ERROR"
  >("SYNCING");
  const [timeframe, setTimeframe] = useState<Timeframe>("M15");
  const [candleMode, setCandleMode] = useState<"Candles" | "Heikin-Ashi">("Candles");
  const [chartToolsOpen, setChartToolsOpen] = useState(false);
  const [showEntries, setShowEntries] = useState(true);
  const [showTargets, setShowTargets] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [showPivots, setShowPivots] = useState(true);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [planOpen, setPlanOpen] = useState(!isCompact);
  const [chartZoom, setChartZoom] = useState(1);
  const [chartResetSignal, setChartResetSignal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasOlderHistory, setHasOlderHistory] = useState(true);
  const [chartInteracting, setChartInteracting] = useState(false);
  const [m15DataTrusted, setM15DataTrusted] = useState(false);
  const [detailQuote, setDetailQuote] = useState<{
    price: number;
    dataState: "LIVE" | "STALE";
  } | null>(null);
  const [detailPageHeight, setDetailPageHeight] = useState(0);
  const chartHeight =
    isCompact && detailPageHeight > 0
      ? Math.max(320, Math.min(620, detailPageHeight - compactChartReservedHeight))
      : 460;
  const catalogItem = signal
    ? marketCatalog.find((item) => item.symbol === signal.symbol)
    : undefined;
  const selectedSetup = signal
    ? (selectedStrategiesBySymbol[signal.symbol] ??
      catalogItem?.defaultSetupLabel ??
      signal.setupLabel ??
      signal.strategy)
    : undefined;
  const requestedStrategy = strategyIdForSetup(selectedSetup);
  const selectedSetupLabel = displaySetupLabel(selectedSetup) ?? "Choose setup";
  const defaultSetupLabel = displaySetupLabel(catalogItem?.defaultSetupLabel);
  const availableSetupLabels = (catalogItem?.availableSetups ?? []).filter(
    (label): label is CustomerSetupLabel => customerSetupLabels.has(label),
  );

  useEffect(() => {
    let active = true;
    getMarketsCatalog()
      .then((items) => {
        if (active) setMarketCatalog(items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setMarketCatalogLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!signal) return;
    let active = true;
    setEvaluatedSignal(null);
    setM15DataTrusted(false);
    setHasOlderHistory(true);
    const loadEvaluation = () =>
      getSignalEvaluation({
        symbol: signal.symbol,
        ...(requestedStrategy ? { strategy: requestedStrategy } : {}),
      })
        .then((result) => {
          const nextSignal = {
            ...(result.signal as unknown as NonNullable<typeof signal>),
          } as NonNullable<typeof signal>;
          if (active) {
            const candles = result.candles as MarketCandles;
            setEvaluatedSignal(nextSignal);
            setM15DataTrusted(
              candles.displayOnly === false &&
                candles.dataState === "LIVE" &&
                (candles.validation as { valid?: boolean } | undefined)?.valid === true,
            );
          }
        })
        .catch(() => {
          if (active) {
            setEvaluatedSignal(null);
            setM15DataTrusted(false);
          }
        });
    loadEvaluation();
    const timer = setInterval(loadEvaluation, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [signal?.symbol, requestedStrategy]);

  useEffect(() => {
    if (!signal) return;
    let active = true;
    setMarketCandles(null);
    setCandleState("SYNCING");
    setHasOlderHistory(true);
    const loadCandles = () => {
      getMarketCandles({ symbol: signal.symbol, timeframe, limit: 80 })
        .then((result) => {
          if (active) {
            setMarketCandles((current) => mergeMarketCandleSeries(current, result));
            setCandleState(candleStateFor(result));
            if (timeframe === "M15") {
              setM15DataTrusted(
                result.displayOnly === false &&
                  result.dataState === "LIVE" &&
                  (result.validation as { valid?: boolean } | undefined)?.valid === true,
              );
            }
          }
        })
        .catch(() => {
          if (active) {
            setCandleState((current) =>
              current === "LIVE" ? "STALE" : current === "SYNCING" ? "ERROR" : current,
            );
          }
        });
    };
    loadCandles();
    const timer = setInterval(loadCandles, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [signal?.symbol, timeframe]);

  useEffect(() => {
    if (!signal) return;
    return startLiveQuotePolling(
      getMarketQuotes,
      (response) => {
        const quote = response.quotes[signal.symbol];
        const price = quote?.price;
        setDetailQuote(
          quote?.dataState === "LIVE" &&
            typeof price === "number" &&
            Number.isFinite(price) &&
            price > 0
            ? { price, dataState: "LIVE" }
            : null,
        );
      },
      1000,
      () => setDetailQuote((current) => (current ? { ...current, dataState: "STALE" } : current)),
    );
  }, [signal?.symbol]);

  if (!hasMembershipFeature(profile.membership, "signalContext", accessPolicy)) {
    return (
      <Screen>
        <PageMetadata
          title="Opportunity details"
          description="Market context and quote status for an opportunity, with details gated by membership."
        />
        <View style={[styles.tierLockPage, { backgroundColor: colors.background }]}>
          <Feather name="lock" size={24} color={colors.primary} />
          <Text
            style={[styles.tierLockTitle, { color: colors.foreground }]}
          >{`Signal context requires ${accessPolicy.featureMinimumTiers.signalContext} access`}</Text>
          <Text style={[styles.tierLockDetail, { color: colors.mutedForeground }]}>
            The Opportunities feed stays global and separate from Watchlist. Membership rules
            determine access to validated signal details.
          </Text>
          <Pressable
            testID="signal-detail-upgrade"
            accessibilityRole="button"
            onPress={() => router.push("/membership")}
            style={[styles.tierLockButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.tierLockButtonText, { color: colors.primaryForeground }]}>
              Compare plans
            </Text>
          </Pressable>
          <Pressable
            testID="signal-detail-back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.tierLockBack}
          >
            <Text style={[styles.tierLockBackText, { color: colors.primary }]}>Back</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }
  if (!signal) return null;
  const liveQuote = watchlist.find((item) => item.symbol === signal.symbol);
  const livePrice =
    detailQuote?.price ??
    (liveQuote?.dataState === "LIVE" && finite(liveQuote.price) ? liveQuote.price : undefined);
  const quotePrice =
    detailQuote?.price ??
    (liveQuote &&
    ["LIVE", "STALE", "FALLBACK"].includes(liveQuote.dataState ?? "") &&
    finite(liveQuote.price) &&
    liveQuote.price > 0
      ? liveQuote.price
      : undefined);
  const quoteIsLive =
    detailQuote?.dataState === "LIVE" ||
    (liveQuote?.dataState === "LIVE" && livePrice !== undefined);
  const quoteState = detailQuote?.dataState ?? liveQuote?.dataState;
  const displaySignal = evaluatedSignal
    ? { ...evaluatedSignal, ...(livePrice === undefined ? {} : { price: livePrice }) }
    : signal;
  const signalPrice = finite(signal.price) && signal.price > 0 ? signal.price : undefined;
  const evaluatedPrice =
    finite(displaySignal.price) && displaySignal.price > 0 ? displaySignal.price : undefined;
  // Quote polling is intentionally preferred, but a valid snapshot price
  // should remain visible during the short window before the quote store
  // catches up. This must not unlock strategy levels or change trust state.
  const currentPrice = quotePrice ?? evaluatedPrice ?? signalPrice;
  const signalDataState = mt5Connected
    ? (displaySignal.dataState ?? "STALE")
    : displaySignal.dataState === "LIVE"
      ? "STALE"
      : (displaySignal.dataState ?? "STALE");
  const rawPriceDataState = quoteIsLive ? "LIVE" : (quoteState ?? displaySignal.dataState);
  const priceDataState =
    !quoteIsLive && !mt5Connected && rawPriceDataState === "LIVE" ? "STALE" : rawPriceDataState;
  const referenceState = liveQuote?.referenceState ?? displaySignal.referenceState;
  const hasNumericPrice = finite(currentPrice) && currentPrice > 0;
  const priceState = resolvePriceState(
    priceDataState,
    referenceState,
    hasNumericPrice && priceDataState !== "ERROR",
  );
  const priceStateVisual = getPriceStateVisual(priceState, colors);
  const hasUsablePrice = priceState !== "UNAVAILABLE";
  const priceStateLabel = priceStatePresentation[priceState].detailLabel;
  const digits = signal.symbol.includes("JPY")
    ? 3
    : signal.symbol.length === 6 && !signal.symbol.includes("XAU")
      ? 5
      : 2;
  const price = hasUsablePrice && currentPrice !== undefined ? currentPrice.toFixed(digits) : "—";
  const candleValidation = marketCandles?.validation as
    { valid?: boolean; reason?: string } | undefined;
  const chartDataState =
    candleState === "STALE" ? "STALE" : (marketCandles?.dataState ?? candleState);
  const chartDataLabel =
    chartDataState === "LIVE"
      ? "LIVE CANDLES"
      : chartDataState === "FALLBACK"
        ? "REFERENCE CANDLES"
        : chartDataState === "STALE"
          ? "STALE CANDLES"
          : chartDataState === "SYNCING"
            ? "SYNCING"
            : "DATA UNAVAILABLE";
  const chartDataColor =
    chartDataState === "LIVE"
      ? colors.success
      : chartDataState === "FALLBACK"
        ? colors.reference
        : colors.warning;
  const renderedTimeframe = marketCandles?.timeframe ?? timeframe;
  const showStrategyLevels = signalDataState === "LIVE" && m15DataTrusted;
  const strategyPauseNote =
    candleState === "STALE" || marketCandles?.dataState === "STALE"
      ? "Market data is stale. Levels remain unavailable until fresh data arrives."
      : marketCandles?.displayOnly
        ? mt5Connected
          ? "Live prices are connected, but fresh market history has not arrived. Reference candles remain visible; levels will appear after the history sync completes."
          : "Reference candles are display-only. Levels remain unavailable until market history is available."
        : marketCandles?.dataState === "FALLBACK"
          ? mt5Connected
            ? "Live prices are connected, but fresh market history has not arrived. Reference candles remain visible; levels will appear after the history sync completes."
            : "Reference candles are display-only. Levels remain unavailable until market history is available."
          : marketCandles?.dataState === "ERROR" && marketCandles.candles.length > 0
            ? `Market candles are visible, but levels are unavailable: ${candleValidation?.reason ?? "the series failed validation."}`
            : candleState === "ERROR" && !mt5Connected
              ? "Market data is unverified or stale. Levels are temporarily unavailable."
              : "Waiting for verified market data before showing levels.";
  const planValue = (value: number) => (showStrategyLevels ? value.toFixed(digits) : "—");
  const chartLevels = showStrategyLevels ? chartLevelsFor(displaySignal) : undefined;
  const membership = profile?.membership ?? "Free";
  const riskPercent = profile?.riskPercent ?? 0;
  const maxDailyLoss = profile?.maxDailyLoss ?? 0;
  const planUnlocked =
    hasMembershipFeature(membership, "trustedSetupLevels", accessPolicy) && showStrategyLevels;
  const planGate =
    displaySignal.direction === "SHORT" ? chartLevels?.sellEntry : chartLevels?.buyEntry;
  const planStop =
    displaySignal.direction === "SHORT" ? chartLevels?.sellStop : chartLevels?.buyStop;
  const planTargets =
    displaySignal.direction === "SHORT"
      ? (chartLevels?.sellTargets ?? [])
      : (chartLevels?.buyTargets ?? []);
  const riskDistance =
    finite(displaySignal.entry) && finite(planStop) ? Math.abs(displaySignal.entry - planStop) : 0;
  const targetRr = (target: number) =>
    riskDistance > 0 ? Math.abs(target - displaySignal.entry) / riskDistance : 0;
  const actionBias =
    displaySignal.direction === "LONG"
      ? "BUY STOP"
      : displaySignal.direction === "SHORT"
        ? "SELL STOP"
        : "MONITORING";
  const rrPass = riskDistance > 0 && targetRr(planTargets[0] ?? displaySignal.tp1) >= 1;
  const riskPass = riskPercent > 0 && riskPercent <= maxDailyLoss;
  const fallbackPrice = currentPrice ?? signal.price;
  const openAlert = (target?: number) =>
    router.push({
      pathname: "/alerts",
      params: {
        symbol: displaySignal.symbol,
        target: finite(target) ? target.toFixed(digits) : fallbackPrice.toFixed(digits),
      },
    });
  const openRiskCalculator = () =>
    router.push({
      pathname: "/risk",
      params: {
        symbol: displaySignal.symbol,
        price: finite(currentPrice) ? currentPrice.toFixed(digits) : "",
        entry: finite(displaySignal.entry) ? displaySignal.entry.toFixed(digits) : "",
        stop: finite(planStop) ? planStop.toFixed(digits) : "",
      },
    });
  const visibleLayers: Record<MarketChartLayer, boolean> = {
    entries: showEntries,
    targets: showTargets,
    stops: showStops,
    sources: showSources,
    pivots: showPivots,
  };
  const resetChart = () => {
    setCandleMode("Candles");
    setShowEntries(true);
    setShowTargets(true);
    setShowStops(true);
    setShowSources(true);
    setShowPivots(true);
    setChartZoom(1);
    setChartResetSignal((value) => value + 1);
  };
  const zoomOut = () => setChartZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))));
  const zoomIn = () => setChartZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))));
  const loadOlderHistory = async () => {
    if (historyLoading || !hasOlderHistory) return;
    setHistoryLoading(true);
    try {
      const result = await getMarketCandles({ symbol: signal.symbol, timeframe, limit: 1000 });
      setMarketCandles((current) => mergeMarketCandleSeries(current, result));
      setCandleState(candleStateFor(result));
      setHasOlderHistory(result.candles.length >= 1000);
    } catch {
      // Older history is optional; leave the action available for another attempt.
    } finally {
      setHistoryLoading(false);
    }
  };
  return (
    <Screen scroll={false} screenBottomSpacing={0}>
      <PageMetadata
        title="Opportunity details"
        description="Review current market context, verified quote status, and risk notes for an opportunity."
      />
      <View
        testID="signal-detail-page"
        onLayout={(event) => setDetailPageHeight(event.nativeEvent.layout.height)}
        style={styles.detailPage}
      >
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!chartInteracting}
          nestedScrollEnabled
          directionalLockEnabled
        >
          <View
            style={[
              styles.detailHeader,
              isCompact && styles.detailHeaderCompact,
              largeText && styles.detailHeaderLarge,
            ]}
          >
            <View style={[styles.detailIdentity, largeText && styles.detailIdentityLarge]}>
              <Text style={[styles.detailSymbol, { color: colors.foreground }]}>
                {signal.symbol}
              </Text>
              <View style={styles.setupIdentityRow}>
                {defaultSetupLabel ? (
                  <Text
                    testID="default-strategy-label"
                    accessibilityLabel={`Default setup for ${signal.symbol}: ${defaultSetupLabel}`}
                    style={[styles.defaultSetupLabel, { color: colors.mutedForeground }]}
                  >
                    {defaultSetupLabel}
                  </Text>
                ) : null}
                {marketCatalogLoaded ? (
                  <Pressable
                    testID="detail-strategy-trigger"
                    accessibilityRole="button"
                    accessibilityLabel={`Choose setup for ${signal.symbol}. Current setup: ${selectedSetupLabel}`}
                    onPress={() => setStrategyPickerOpen(true)}
                    style={[
                      styles.strategyTrigger,
                      largeText && styles.strategyTriggerLarge,
                      { backgroundColor: colors.secondary, borderColor: colors.border },
                    ]}
                  >
                    <Feather name="layers" size={12} color={colors.primary} />
                    <Text style={[styles.strategyTriggerText, { color: colors.foreground }]}>
                      {selectedSetupLabel}
                    </Text>
                    <Feather name="chevron-down" size={12} color={colors.mutedForeground} />
                  </Pressable>
                ) : (
                  <Text style={[styles.defaultSetupLabel, { color: colors.mutedForeground }]}>
                    Loading setups
                  </Text>
                )}
              </View>
            </View>
            <Pressable
              testID="detail-alert"
              accessibilityRole="button"
              accessibilityLabel="Set a price alert"
              onPress={() => openAlert(displaySignal.entry || displaySignal.price)}
              style={[
                styles.alertButton,
                isCompact && styles.alertButtonCompact,
                largeText && (isCompact ? styles.largeIconButton : styles.largeActionButton),
                { backgroundColor: `${colors.warning}15`, borderColor: `${colors.warning}70` },
              ]}
            >
              <Feather name="bell" size={15} color={colors.warning} />
              {isCompact ? null : (
                <Text style={[styles.alertText, { color: colors.warning }]}>Set Alert</Text>
              )}
            </Pressable>
            <Pressable
              testID="detail-close"
              accessibilityRole="button"
              accessibilityLabel="Close signal details"
              onPress={() => router.back()}
              style={[
                styles.closeButton,
                largeText && styles.largeIconButton,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <View
            style={[
              styles.detailSubline,
              largeText && styles.detailSublineLarge,
              { borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.detailSublineText, { color: colors.mutedForeground }]}>
              {signal.name}
            </Text>
            <View style={[styles.sublineRight, largeText && styles.sublineRightLarge]}>
              <View
                style={[
                  styles.directionBadge,
                  {
                    backgroundColor: `${displaySignal.direction === "SHORT" ? colors.destructive : displaySignal.direction === "LONG" ? colors.success : colors.warning}18`,
                    borderColor: `${displaySignal.direction === "SHORT" ? colors.destructive : displaySignal.direction === "LONG" ? colors.success : colors.warning}55`,
                  },
                ]}
              >
                <Feather
                  name={
                    displaySignal.direction === "SHORT"
                      ? "trending-down"
                      : displaySignal.direction === "LONG"
                        ? "trending-up"
                        : "eye"
                  }
                  size={10}
                  color={
                    displaySignal.direction === "SHORT"
                      ? colors.destructive
                      : displaySignal.direction === "LONG"
                        ? colors.success
                        : colors.warning
                  }
                />
                <Text
                  style={[
                    styles.directionBadgeText,
                    {
                      color:
                        displaySignal.direction === "SHORT"
                          ? colors.destructive
                          : displaySignal.direction === "LONG"
                            ? colors.success
                            : colors.warning,
                    },
                  ]}
                >
                  {displaySignal.direction === "SHORT"
                    ? "SELL"
                    : displaySignal.direction === "LONG"
                      ? "BUY"
                      : "MONITORING"}
                </Text>
              </View>
              <View
                testID="signal-detail-price-state"
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${priceStateLabel}. ${hasUsablePrice ? `Price ${price}` : "Price unavailable"}.`}
                style={[styles.livePrice, largeText && styles.livePriceLarge]}
              >
                <PriceStateBadge state={priceState} label={priceStateLabel} />
                <Text
                  style={[
                    styles.liveValue,
                    { color: hasUsablePrice ? priceStateVisual.color : colors.mutedForeground },
                  ]}
                >
                  {price}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            testID="signal-risk-warning"
            accessibilityRole="link"
            onPress={() => router.push("/legal")}
            style={{
              marginHorizontal: 16,
              marginTop: 10,
              padding: 11,
              borderWidth: 1,
              borderColor: `${colors.warning}55`,
              borderRadius: 10,
              backgroundColor: `${colors.warning}10`,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Feather name="alert-triangle" size={14} color={colors.warning} />
            <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }}>
              Signals are informational, not personal advice. Trading can cause substantial loss;
              data may be delayed or inaccurate. Review the full risk disclaimer.
            </Text>
          </Pressable>

          <View
            style={[
              styles.chartShell,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.chartToolbar,
                largeText && styles.chartToolbarLarge,
                { backgroundColor: colors.background, borderBottomColor: colors.border },
              ]}
            >
              <View style={styles.chartToolbarTitle}>
                <View
                  style={[
                    styles.chartLiveDot,
                    { backgroundColor: candleState === "LIVE" ? colors.success : colors.warning },
                  ]}
                />
                <Text style={[styles.chartToolbarText, { color: colors.mutedForeground }]}>
                  CHART
                </Text>
                <Text style={[styles.chartToolbarTimeframe, { color: colors.foreground }]}>
                  {renderedTimeframe}
                </Text>
              </View>
              <View
                style={[styles.chartToolbarActions, largeText && styles.chartToolbarActionsLarge]}
              >
                <View style={styles.chartDataState}>
                  <View style={[styles.chartDataStateDot, { backgroundColor: chartDataColor }]} />
                  <Text style={[styles.chartDataStateText, { color: chartDataColor }]}>
                    {chartDataLabel}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  testID="chart-tools-toggle"
                  accessibilityRole="button"
                  accessibilityLabel={
                    chartToolsOpen ? "Close chart settings" : "Open chart settings"
                  }
                  onPress={() => setChartToolsOpen((value) => !value)}
                  style={[
                    styles.chartToolsToggle,
                    largeText && styles.largeIconButton,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                >
                  <Feather name="sliders" size={14} color={colors.foreground} />
                </Pressable>
              </View>
            </View>
            <View
              style={[
                styles.chartTools,
                chartToolsOpen ? styles.chartToolsOpen : styles.chartToolsClosed,
                largeText && chartToolsOpen && styles.chartToolsOpenLarge,
              ]}
            >
              <View
                style={[
                  styles.controlGroup,
                  largeText && styles.controlGroupLarge,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                {(["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as Timeframe[]).map(
                  (item) => (
                    <Pressable
                      key={item}
                      testID={`timeframe-${item}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: timeframe === item }}
                      accessibilityLabel={`Show ${item} chart timeframe`}
                      onPress={() => setTimeframe(item)}
                      style={[
                        styles.timeframeButton,
                        largeText && styles.largeControlButton,
                        timeframe === item && { backgroundColor: colors.secondary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.controlText,
                          {
                            color: timeframe === item ? colors.foreground : colors.mutedForeground,
                            fontWeight: timeframe === item ? "800" : "600",
                          },
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
              <View
                style={[
                  styles.controlGroup,
                  largeText && styles.controlGroupLarge,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Pressable
                  testID="chart-mode-candles"
                  accessibilityRole="button"
                  accessibilityState={{ selected: candleMode === "Candles" }}
                  accessibilityLabel="Show candlesticks"
                  onPress={() => setCandleMode("Candles")}
                  style={[
                    styles.modeButton,
                    largeText && styles.largeControlButton,
                    candleMode === "Candles" && { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text
                    style={[
                      styles.controlText,
                      {
                        color:
                          candleMode === "Candles" ? colors.foreground : colors.mutedForeground,
                      },
                    ]}
                  >
                    Candles
                  </Text>
                </Pressable>
                <Pressable
                  testID="chart-mode-heikin-ashi"
                  accessibilityRole="button"
                  accessibilityState={{ selected: candleMode === "Heikin-Ashi" }}
                  accessibilityLabel="Show Heikin-Ashi candles"
                  onPress={() => setCandleMode("Heikin-Ashi")}
                  style={[
                    styles.modeButton,
                    largeText && styles.largeControlButton,
                    candleMode === "Heikin-Ashi" && { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text
                    style={[
                      styles.controlText,
                      {
                        color:
                          candleMode === "Heikin-Ashi" ? colors.foreground : colors.mutedForeground,
                      },
                    ]}
                  >
                    Heikin-Ashi
                  </Text>
                </Pressable>
              </View>
              <View style={styles.layerRow}>
                <Pressable
                  testID="chart-layer-entries"
                  accessibilityRole="button"
                  accessibilityLabel="Toggle entry levels"
                  accessibilityState={{ selected: showEntries }}
                  onPress={() => setShowEntries((value) => !value)}
                  style={[
                    styles.layerButton,
                    largeText && styles.largeControlButton,
                    {
                      backgroundColor: showEntries ? `${colors.success}28` : colors.secondary,
                      borderColor: showEntries ? `${colors.success}65` : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.layerText,
                      { color: showEntries ? colors.success : colors.mutedForeground },
                    ]}
                  >
                    Entries
                  </Text>
                </Pressable>
                <Pressable
                  testID="chart-layer-targets"
                  accessibilityRole="button"
                  accessibilityLabel="Toggle targets layer"
                  accessibilityState={{ selected: showTargets }}
                  onPress={() => setShowTargets((value) => !value)}
                  style={[
                    styles.layerButton,
                    largeText && styles.largeControlButton,
                    {
                      backgroundColor: showTargets ? `${colors.chart}28` : colors.secondary,
                      borderColor: showTargets ? `${colors.chart}65` : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.layerText,
                      { color: showTargets ? colors.chart : colors.mutedForeground },
                    ]}
                  >
                    Targets
                  </Text>
                </Pressable>
                <Pressable
                  testID="chart-layer-stops"
                  accessibilityRole="button"
                  accessibilityLabel="Toggle stops layer"
                  accessibilityState={{ selected: showStops }}
                  onPress={() => setShowStops((value) => !value)}
                  style={[
                    styles.layerButton,
                    largeText && styles.largeControlButton,
                    {
                      backgroundColor: showStops ? `${colors.destructive}28` : colors.secondary,
                      borderColor: showStops ? `${colors.destructive}65` : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.layerText,
                      { color: showStops ? colors.destructive : colors.mutedForeground },
                    ]}
                  >
                    Stops
                  </Text>
                </Pressable>
                {([
                  ["sources", "Sources", showSources, setShowSources],
                  ["pivots", "Pivots", showPivots, setShowPivots],
                ] as const).map(([layer, label, selected, setSelected]) => (
                  <Pressable
                    key={layer}
                    testID={`chart-layer-${layer}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Toggle ${label.toLowerCase()} layer`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelected((value) => !value)}
                    style={[
                      styles.layerButton,
                      largeText && styles.largeControlButton,
                      {
                        backgroundColor: selected ? `${colors.primary}28` : colors.secondary,
                        borderColor: selected ? `${colors.primary}65` : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.layerText, {
                      color: selected ? colors.primary : colors.mutedForeground,
                    }]}>{label}</Text>
                  </Pressable>
                ))}
                <Pressable
                  testID="chart-zoom-out"
                  accessibilityRole="button"
                  accessibilityLabel="Zoom chart out"
                  onPress={zoomOut}
                  style={[
                    styles.iconControl,
                    largeText && styles.largeIconButton,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather name="minus" size={16} color={colors.mutedForeground} />
                </Pressable>
                <Text
                  testID="chart-zoom-value"
                  style={[styles.zoomValue, { color: colors.mutedForeground }]}
                >
                  {Math.round(chartZoom * 100)}%
                </Text>
                <Pressable
                  testID="chart-zoom-in"
                  accessibilityRole="button"
                  accessibilityLabel="Zoom chart in"
                  onPress={zoomIn}
                  style={[
                    styles.iconControl,
                    largeText && styles.largeIconButton,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather name="plus" size={16} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  testID="chart-reset"
                  accessibilityRole="button"
                  accessibilityLabel="Reset chart"
                  onPress={resetChart}
                  style={[
                    styles.iconControl,
                    largeText && styles.largeIconButton,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather name="rotate-ccw" size={15} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  testID="chart-expand"
                  accessibilityRole="button"
                  accessibilityLabel="Expand chart"
                  onPress={() => setChartExpanded(true)}
                  style={[
                    styles.iconControl,
                    largeText && styles.largeIconButton,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather name="maximize-2" size={15} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>
            <MarketCandleChart
              terminal
              chartHeight={chartHeight}
              cleanMode={!chartToolsOpen}
              candles={marketCandles?.candles ?? []}
              provider="MARKET"
              providerSymbol={undefined}
              displayOnly={marketCandles?.displayOnly ?? false}
              dataState={chartDataState}
              lastPrice={hasUsablePrice ? currentPrice : undefined}
              title={`${signal.symbol} · ${renderedTimeframe}`}
              timeframe={renderedTimeframe}
              timezone={marketCandles?.timezone ?? "UTC"}
              candleMode={candleMode}
              visibleLayers={visibleLayers}
              zoom={chartZoom}
              resetSignal={chartResetSignal}
              blockedReason={!showStrategyLevels ? strategyPauseNote : undefined}
              levels={chartLevels}
              historyLoading={historyLoading}
              hasOlderHistory={hasOlderHistory}
              onLoadOlderHistory={loadOlderHistory}
              onInteractionStart={() => setChartInteracting(true)}
              onInteractionEnd={() => setChartInteracting(false)}
              onViewportChange={(viewport) => setChartZoom(viewport.zoom)}
              onReset={resetChart}
            />
          </View>
          <Modal
            visible={chartExpanded}
            animationType="slide"
            onRequestClose={() => setChartExpanded(false)}
          >
            <View
              style={[
                styles.expandedChartModal,
                {
                  backgroundColor: colors.background,
                  paddingTop: insets.top + 10,
                  paddingBottom: insets.bottom + 10,
                },
              ]}
            >
              <View style={styles.expandedChartHeader}>
                <Text style={[styles.expandedChartTitle, { color: colors.foreground }]}>
                  Expanded chart
                </Text>
                <Pressable
                  testID="chart-expand-close"
                  accessibilityRole="button"
                  accessibilityLabel="Close expanded chart"
                  onPress={() => setChartExpanded(false)}
                  style={[
                    styles.closeButton,
                    largeText && styles.largeIconButton,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <View style={styles.layerRow}>
                {([
                  ["entries", "Entries", showEntries, setShowEntries],
                  ["targets", "Targets", showTargets, setShowTargets],
                  ["stops", "Stops", showStops, setShowStops],
                  ["sources", "Sources", showSources, setShowSources],
                  ["pivots", "Pivots", showPivots, setShowPivots],
                ] as const).map(([layer, label, selected, setSelected]) => (
                  <Pressable
                    key={layer}
                    testID={`expanded-chart-layer-${layer}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Toggle ${label.toLowerCase()} layer`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelected((value) => !value)}
                    style={[
                      styles.layerButton,
                      largeText && styles.largeControlButton,
                      {
                        backgroundColor: selected ? `${colors.primary}28` : colors.secondary,
                        borderColor: selected ? `${colors.primary}65` : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.layerText, {
                      color: selected ? colors.primary : colors.mutedForeground,
                    }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <MarketCandleChart
                expanded
                terminal
                chartHeight={chartHeight}
                cleanMode={!chartToolsOpen}
                candles={marketCandles?.candles ?? []}
                provider="MARKET"
                providerSymbol={undefined}
                displayOnly={marketCandles?.displayOnly ?? false}
                dataState={chartDataState}
                lastPrice={hasUsablePrice ? currentPrice : undefined}
                title={`${signal.symbol} · ${renderedTimeframe}`}
                timeframe={renderedTimeframe}
                timezone={marketCandles?.timezone ?? "UTC"}
                candleMode={candleMode}
                visibleLayers={visibleLayers}
                zoom={chartZoom}
                resetSignal={chartResetSignal}
                blockedReason={!showStrategyLevels ? strategyPauseNote : undefined}
                levels={chartLevels}
                historyLoading={historyLoading}
                hasOlderHistory={hasOlderHistory}
                onLoadOlderHistory={loadOlderHistory}
                onInteractionStart={() => setChartInteracting(true)}
                onInteractionEnd={() => setChartInteracting(false)}
                onViewportChange={(viewport) => setChartZoom(viewport.zoom)}
                onReset={resetChart}
              />
            </View>
          </Modal>

          <Modal
            transparent
            visible={strategyPickerOpen}
            animationType="fade"
            onRequestClose={() => setStrategyPickerOpen(false)}
          >
            <View
              style={[styles.strategyModalOverlay, { backgroundColor: `${colors.background}85` }]}
            >
              <Pressable
                testID="strategy-modal-dismiss"
                accessibilityLabel="Close setup selector"
                onPress={() => setStrategyPickerOpen(false)}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  styles.strategySheet,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    paddingBottom: insets.bottom + 18,
                  },
                ]}
              >
                <View style={styles.strategySheetHeader}>
                  <View style={styles.strategySheetCopy}>
                    <Text style={[styles.strategySheetTitle, { color: colors.foreground }]}>
                      Choose a setup
                    </Text>
                    <Text
                      style={[styles.strategySheetDescription, { color: colors.mutedForeground }]}
                    >
                      {signal.symbol} · applies to this symbol only
                    </Text>
                  </View>
                  <Pressable
                    testID="strategy-modal-close"
                    accessibilityLabel="Close setup selector"
                    onPress={() => setStrategyPickerOpen(false)}
                    style={[styles.closeButton, { backgroundColor: colors.secondary }]}
                  >
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>
                {availableSetupLabels.length ? (
                  availableSetupLabels.map((label) => {
                    const selected = displaySetupLabel(selectedSetup) === label;
                    return (
                      <Pressable
                        key={label}
                        testID={`strategy-option-${label}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setStrategyForSymbol?.(signal.symbol, label);
                          setStrategyPickerOpen(false);
                        }}
                        style={[
                          styles.strategyOption,
                          {
                            backgroundColor: selected ? `${colors.primary}14` : colors.background,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.strategyOptionIcon,
                            { backgroundColor: `${colors.primary}16` },
                          ]}
                        >
                          <Feather
                            name={selected ? "check" : "layers"}
                            size={15}
                            color={colors.primary}
                          />
                        </View>
                        <Text style={[styles.strategyOptionText, { color: colors.foreground }]}>
                          {label}
                        </Text>
                        {selected ? (
                          <Text style={[styles.strategySelected, { color: colors.primary }]}>
                            SELECTED
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })
                ) : (
                  <Text
                    style={[styles.strategySheetDescription, { color: colors.mutedForeground }]}
                  >
                    No setups are currently available for this symbol.
                  </Text>
                )}
                <Text style={[styles.strategySafetyNote, { color: colors.mutedForeground }]}>
                  Trade levels still require fresh, verified market data.
                </Text>
              </View>
            </View>
          </Modal>

          <ProximityRail
            signal={displaySignal}
            levels={chartLevels}
            currentPrice={currentPrice}
            digits={digits}
            enabled={showStrategyLevels && finite(currentPrice)}
          />

          <Pressable
            testID="trade-plan-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: planOpen }}
            accessibilityLabel={planOpen ? "Collapse trade plan" : "Expand trade plan"}
            onPress={() => setPlanOpen((value) => !value)}
            style={[
              styles.planHeader,
              isCompact && styles.planHeaderCompact,
              largeText && styles.planHeaderLarge,
            ]}
          >
            <View style={styles.planTitleRow}>
              <Feather
                name={planOpen ? "chevron-down" : "chevron-right"}
                size={15}
                color={colors.mutedForeground}
              />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Trade Plan</Text>
            </View>
            <Text
              style={[
                styles.planStatus,
                { color: showStrategyLevels ? colors.success : colors.warning },
              ]}
            >
              {showStrategyLevels
                ? "READY TO REVIEW"
                : priceState === "REFERENCE"
                  ? "LIVE DATA REQUIRED"
                  : "DATA UNTRUSTED"}
            </Text>
          </Pressable>
          {planOpen ? (
            <View testID="trade-plan-content">
              {!planUnlocked ? (
                <View
                  style={[
                    styles.planLock,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.planLockIcon, { backgroundColor: `${colors.warning}18` }]}>
                    <Feather name="lock" size={20} color={colors.warning} />
                  </View>
                  <Text style={[styles.planLockTitle, { color: colors.foreground }]}>
                    Levels unavailable
                  </Text>
                  <Text style={[styles.planLockText, { color: colors.mutedForeground }]}>
                    Market data is unverified or stale. Levels are temporarily unavailable.
                  </Text>
                </View>
              ) : (
                <>
                  <View
                    style={[
                      styles.biasBanner,
                      largeText && styles.biasBannerLarge,
                      {
                        backgroundColor: `${displaySignal.direction === "SHORT" ? chartContextPalette.short : chartContextPalette.long}18`,
                        borderColor: `${displaySignal.direction === "SHORT" ? chartContextPalette.short : chartContextPalette.long}55`,
                      },
                    ]}
                  >
                    <View>
                      <Text style={[styles.biasEyebrow, { color: colors.mutedForeground }]}>
                        CURRENT BIAS
                      </Text>
                      <Text
                        style={[
                          styles.biasValue,
                          {
                            color:
                              displaySignal.direction === "SHORT"
                                ? chartContextPalette.short
                                : chartContextPalette.long,
                          },
                        ]}
                      >
                        {actionBias}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.biasAction,
                        largeText && styles.biasActionLarge,
                        { color: colors.foreground },
                      ]}
                    >
                      {displaySignal.action}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.planGrid,
                      largeText && styles.planGridLarge,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    {[
                      ["ENTRY", planValue(displaySignal.entry), chartContextPalette.entry],
                      ["STOP", planValue(planStop ?? displaySignal.stop), chartContextPalette.risk],
                      ["TP1", planValue(planTargets[0] ?? displaySignal.tp1), chartContextPalette.target],
                      ["TP2", planValue(planTargets[1] ?? displaySignal.tp2), chartContextPalette.target],
                      ["TP3", planValue(planTargets[2] ?? displaySignal.tp3), chartContextPalette.target],
                    ].map(([label, value, color]) => (
                      <View
                        key={label as string}
                        style={[styles.planCell, largeText && styles.planCellLarge]}
                      >
                        <Text style={[styles.planLabel, { color: colors.mutedForeground }]}>
                          {label}
                        </Text>
                        <Text style={[styles.planValue, { color: color as string }]}>{value}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={[styles.complianceRow, largeText && styles.complianceRowLarge]}>
                    <View
                      style={[
                        styles.complianceBadge,
                        {
                          backgroundColor: `${rrPass ? colors.success : colors.warning}18`,
                          borderColor: `${rrPass ? colors.success : colors.warning}55`,
                        },
                      ]}
                    >
                      <Feather
                        name={rrPass ? "check-circle" : "alert-triangle"}
                        size={12}
                        color={rrPass ? colors.success : colors.warning}
                      />
                      <Text
                        style={[
                          styles.complianceText,
                          { color: rrPass ? colors.success : colors.warning },
                        ]}
                      >
                        MIN R:R {rrPass ? "PASS" : "REVIEW"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.complianceBadge,
                        {
                          backgroundColor: `${riskPass ? colors.success : colors.warning}18`,
                          borderColor: `${riskPass ? colors.success : colors.warning}55`,
                        },
                      ]}
                    >
                      <Feather
                        name={riskPass ? "shield" : "alert-triangle"}
                        size={12}
                        color={riskPass ? colors.success : colors.warning}
                      />
                      <Text
                        style={[
                          styles.complianceText,
                          { color: riskPass ? colors.success : colors.warning },
                        ]}
                      >
                        RISK {riskPercent.toFixed(2)}% {riskPass ? "OK" : "REVIEW"}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          ) : null}

          <ValidationSnapshot
            dataState={signalDataState}
            showStrategyLevels={showStrategyLevels}
            planUnlocked={planUnlocked}
            rrPass={rrPass}
            riskPass={riskPass}
            riskPercent={riskPercent}
          />
        </ScrollView>
        <View
          style={[
            styles.bottomBar,
            largeText && styles.bottomBarLarge,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.monitoring,
              largeText && styles.monitoringLarge,
              { color: colors.mutedForeground },
            ]}
          >
            Monitoring{" "}
            <Text style={{ color: colors.foreground, fontWeight: "800" }}>{signal.symbol}</Text>
          </Text>
          <Pressable
            testID="bottom-alert"
            accessibilityRole="button"
            accessibilityLabel="Set a price alert"
            onPress={() => openAlert(displaySignal.entry || displaySignal.price)}
            style={[
              styles.bottomAlert,
              largeText && styles.bottomButtonLarge,
              { backgroundColor: `${colors.warning}18`, borderColor: `${colors.warning}65` },
            ]}
          >
            <Feather name="bell" size={15} color={colors.warning} />
            <Text style={[styles.bottomAlertText, { color: colors.warning }]}>Set Alert</Text>
          </Pressable>
          <Pressable
            testID="bottom-close"
            accessibilityRole="button"
            accessibilityLabel="Close signal details"
            onPress={() => router.back()}
            style={[
              styles.bottomClose,
              largeText && styles.bottomButtonLarge,
              { backgroundColor: colors.secondary },
            ]}
          >
            <Text style={[styles.bottomCloseText, { color: colors.secondaryForeground }]}>
              Close
            </Text>
          </Pressable>
          <Pressable
            testID="bottom-calculate"
            accessibilityRole="button"
            accessibilityLabel="Open risk calculator"
            onPress={openRiskCalculator}
            style={[
              styles.calculate,
              largeText && styles.bottomButtonLarge,
              { backgroundColor: colors.success },
            ]}
          >
            <Feather name="grid" size={15} color={colors.primaryForeground} />
            <Text style={[styles.calculateText, { color: colors.primaryForeground }]}>
              Calculate
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tierLockPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  tierLockTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  tierLockDetail: { maxWidth: 380, fontSize: 13, lineHeight: 19, textAlign: "center" },
  tierLockButton: {
    minHeight: 42,
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 4,
  },
  tierLockButtonText: { fontSize: 12, fontWeight: "800" },
  tierLockBack: { padding: 10 },
  tierLockBackText: { fontSize: 12, fontWeight: "700" },
  detailPage: { flex: 1 },
  detailScroll: { flex: 1 },
  detailScrollContent: { paddingBottom: 16 },
  detailHeader: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 72,
  },
  detailHeaderCompact: { minHeight: 62, gap: 8 },
  detailHeaderLarge: { flexWrap: "wrap", paddingTop: 8, paddingBottom: 8 },
  detailIdentity: { flex: 1, minWidth: 0 },
  detailIdentityLarge: { flexBasis: "100%" },
  detailSymbol: { fontSize: 25, fontWeight: "800", letterSpacing: -0.8 },
  setupIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  defaultSetupLabel: { fontSize: 10, fontWeight: "700" },
  strategyTrigger: {
    minHeight: 30,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 175,
  },
  strategyTriggerLarge: { minHeight: 44, maxWidth: "100%" },
  strategyTriggerText: { fontSize: 10, fontWeight: "800", flexShrink: 1 },
  detailName: { fontSize: 10, marginTop: 3 },
  alertButton: {
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alertButtonCompact: { width: 40, minHeight: 40, paddingHorizontal: 0, justifyContent: "center" },
  largeIconButton: { width: 44, height: 44, minWidth: 44, minHeight: 44, justifyContent: "center" },
  largeActionButton: { minHeight: 48, paddingHorizontal: 14 },
  alertText: { fontSize: 10, fontWeight: "800" },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  detailSubline: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailSublineLarge: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  detailSublineText: { fontSize: 12 },
  sublineRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  sublineRightLarge: { flexWrap: "wrap", justifyContent: "space-between" },
  directionBadge: {
    minHeight: 24,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  directionBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  livePrice: { flexDirection: "row", alignItems: "center", gap: 5 },
  livePriceLarge: { flexWrap: "wrap", alignItems: "center" },
  liveLabel: { fontSize: 10, fontWeight: "800" },
  liveValue: { fontSize: 13, fontWeight: "800", fontFamily: "monospace" },
  chartShell: {
    marginHorizontal: 0,
    marginTop: 0,
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 0,
    overflow: "hidden",
  },
  chartToolbar: {
    minHeight: 46,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  chartToolbarLarge: {
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  chartToolbarTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  chartLiveDot: { width: 6, height: 6, borderRadius: 3 },
  chartToolbarText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  chartToolbarTimeframe: { fontSize: 10, fontWeight: "800", fontFamily: "monospace" },
  chartToolbarActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  chartToolbarActionsLarge: { flexWrap: "wrap", justifyContent: "space-between" },
  chartDataState: { flexDirection: "row", alignItems: "center", gap: 4 },
  chartDataStateDot: { width: 5, height: 5, borderRadius: 3 },
  chartDataStateText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.35 },
  expandedChartModal: { flex: 1, paddingHorizontal: 14 },
  strategyModalOverlay: { flex: 1, justifyContent: "flex-end" },
  strategySheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 20,
    paddingHorizontal: 18,
    gap: 10,
    maxHeight: "78%",
  },
  strategySheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  strategySheetCopy: { flex: 1, gap: 4 },
  strategySheetTitle: { fontSize: 18, fontWeight: "800" },
  strategySheetDescription: { fontSize: 12, lineHeight: 17 },
  strategyOption: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  strategyOptionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  strategyOptionText: { flex: 1, fontSize: 13, fontWeight: "700" },
  strategySelected: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  strategySafetyNote: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  expandedChartHeader: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expandedChartTitle: { fontSize: 16, fontWeight: "800" },
  chartToolsToggle: {
    width: 38,
    height: 34,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  chartTools: { overflow: "hidden" },
  chartToolsOpen: { opacity: 1, maxHeight: 150 },
  chartToolsOpenLarge: { maxHeight: 520 },
  chartToolsClosed: { opacity: 0, height: 0, maxHeight: 0 },
  controlGroup: {
    marginHorizontal: 7,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 5,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  controlGroupLarge: { flexWrap: "wrap", minHeight: 0, paddingVertical: 4, gap: 4 },
  timeframeButton: {
    minHeight: 29,
    paddingHorizontal: 8,
    borderRadius: 4,
    justifyContent: "center",
  },
  largeControlButton: { minHeight: 44, minWidth: 48, paddingHorizontal: 8 },
  modeButton: { minHeight: 29, paddingHorizontal: 10, borderRadius: 4, justifyContent: "center" },
  controlText: { fontSize: 10, fontFamily: "monospace" },
  layerRow: {
    marginHorizontal: 7,
    marginTop: 10,
    flexDirection: "row",
    gap: 5,
    flexWrap: "wrap",
    alignItems: "center",
  },
  layerButton: {
    minHeight: 30,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  layerText: { fontSize: 10, fontWeight: "800" },
  iconControl: {
    width: 32,
    height: 30,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomValue: {
    minWidth: 38,
    textAlign: "center",
    fontSize: 9,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  planHeader: {
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 10,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planHeaderCompact: { marginTop: 12, marginBottom: 12, paddingVertical: 2 },
  planHeaderLarge: { flexDirection: "column", alignItems: "stretch", gap: 6 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  compactOnlyHidden: { display: "none" },
  planStatus: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  planGrid: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
  },
  planGridLarge: { flexDirection: "column" },
  planCell: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: `${brandPalette.border}55`,
  },
  planCellLarge: {
    flex: 0,
    alignItems: "flex-start",
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: `${brandPalette.border}55`,
    paddingVertical: 8,
  },
  planLabel: { fontSize: 9, fontWeight: "800" },
  planValue: { fontSize: 11, fontWeight: "800", fontFamily: "monospace", marginTop: 5 },
  noteBox: {
    marginHorizontal: 18,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    gap: 9,
  },
  noteCopy: { flex: 1 },
  noteHeading: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7, marginBottom: 3 },
  noteText: { flex: 1, fontSize: 11, lineHeight: 17 },
  proximityRail: {
    marginHorizontal: 18,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  proximityHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  proximityHeadingLarge: { flexDirection: "column", alignItems: "stretch" },
  proximityTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  proximityTitle: { fontSize: 13, fontWeight: "800" },
  proximityStatus: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  proximityBlocked: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 12 },
  proximityBlockedText: { flex: 1, fontSize: 10, lineHeight: 15 },
  proximityMain: { flexDirection: "row", alignItems: "center", marginTop: 13, gap: 14 },
  proximityMainLarge: { flexDirection: "column", alignItems: "stretch" },
  proximityMainCopy: { minWidth: 105 },
  proximityEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  proximityGatePrice: { fontSize: 18, fontFamily: "monospace", fontWeight: "800", marginTop: 4 },
  proximityDistance: { fontSize: 10, fontWeight: "800", marginTop: 3 },
  proximityMeterWrap: { flex: 1, gap: 6 },
  proximityMeterTrack: { height: 9, borderRadius: 5, overflow: "hidden" },
  proximityMeterFill: { height: "100%", borderRadius: 5 },
  proximityMeterLabel: { fontSize: 9, fontFamily: "monospace" },
  proximityStats: { flexDirection: "row", gap: 6, marginTop: 12 },
  proximityStatsLarge: { flexDirection: "column" },
  proximityStatLarge: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  proximityStat: { flex: 1, minHeight: 50, borderWidth: 1, borderRadius: 8, padding: 7 },
  proximityStatLabel: { fontSize: 9, fontWeight: "900" },
  proximityStatValue: { fontSize: 11, fontFamily: "monospace", fontWeight: "800", marginTop: 4 },
  proximityStatUnit: { fontSize: 9, marginTop: 1 },
  planLock: {
    marginHorizontal: 18,
    minHeight: 150,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  planLockIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  planLockTitle: { fontSize: 16, fontWeight: "800", marginTop: 10 },
  planLockText: { maxWidth: 300, textAlign: "center", fontSize: 11, lineHeight: 16, marginTop: 5 },
  upgradeButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 13,
  },
  upgradeButtonText: { fontSize: 10, fontWeight: "900" },
  biasBanner: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  biasBannerLarge: { flexDirection: "column", alignItems: "flex-start" },
  biasEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  biasValue: { fontSize: 17, fontWeight: "900", marginTop: 3 },
  biasAction: { flex: 1, textAlign: "right", fontSize: 10, fontWeight: "700" },
  biasActionLarge: { flex: 0, textAlign: "left", alignSelf: "stretch" },
  planDetails: {
    marginHorizontal: 18,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 11,
    flexDirection: "row",
    gap: 8,
  },
  planDetailItem: { flex: 1 },
  planDetailValue: { fontSize: 11, fontFamily: "monospace", fontWeight: "800", marginTop: 5 },
  rrPanel: { marginHorizontal: 18, marginTop: 10, borderWidth: 1, borderRadius: 8, padding: 11 },
  rrRow: { flexDirection: "row", gap: 8, marginTop: 7 },
  rrItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rrTarget: { fontSize: 10, fontWeight: "900" },
  rrValue: { fontSize: 10, fontFamily: "monospace", fontWeight: "800" },
  complianceRow: { marginHorizontal: 18, marginTop: 10, flexDirection: "row", gap: 7 },
  complianceRowLarge: { flexDirection: "column" },
  complianceBadge: {
    flex: 1,
    minHeight: 31,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  complianceText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.2 },
  validationCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
  },
  validationHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  validationHeadingLarge: { flexDirection: "column", alignItems: "stretch" },
  validationHeadingCopy: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  validationTitle: { fontSize: 14, fontWeight: "800" },
  validationSubtitle: { fontSize: 11, marginTop: 3 },
  validationBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  validationRows: { marginTop: 9 },
  validationRow: {
    minHeight: 38,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  validationRowLarge: { flexDirection: "column", alignItems: "stretch", paddingVertical: 8 },
  validationLabel: { fontSize: 11, fontWeight: "700" },
  validationValue: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  validationValueLarge: { alignSelf: "flex-start" },
  validationValueText: { fontSize: 10, fontWeight: "900", textAlign: "right" },
  validationFootnote: { fontSize: 10, lineHeight: 14, marginTop: 10 },
  bottomBar: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 64,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bottomBarLarge: { flexWrap: "wrap", minHeight: 100, rowGap: 8 },
  monitoring: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 14 },
  monitoringLarge: { flexBasis: "100%" },
  bottomAlert: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  bottomButtonLarge: { minHeight: 48, justifyContent: "center", flexGrow: 1 },
  bottomAlertText: { fontSize: 11, fontWeight: "800" },
  bottomClose: { minHeight: 44, borderRadius: 8, justifyContent: "center", paddingHorizontal: 12 },
  bottomCloseText: { fontSize: 11, fontWeight: "800" },
  calculate: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  calculateText: { fontSize: 11, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "center", paddingHorizontal: 14 },
  modalHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: `${brandPalette.border}44`,
  },
  modalHeadingCopy: { flexDirection: "row", gap: 9, flex: 1 },
  modalTitle: { fontSize: 16, fontWeight: "800" },
  modalSubtitle: { fontSize: 10, marginTop: 4 },
});
