import Feather from "@expo/vector-icons/Feather";
import { getMarketCandles } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PageMetadata } from "@/components/PageMetadata";
import {
  MarketCandleChart,
  Screen,
  type CandleDatum,
  type MarketChartDataState,
} from "@/components/TradifyUI";
import { useColors } from "@/hooks/useColors";
import { useTradify } from "@/lib/tradify-store";
import { DEFAULT_ACCESS_POLICY, hasMembershipFeature } from "@/constants/membership";

const chartTimeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;
type ChartTimeframe = (typeof chartTimeframes)[number];
type MarketCandleResponse = Awaited<ReturnType<typeof getMarketCandles>>;

export default function MarketChartScreen() {
  const colors = useColors();
  const { watchlist, profile, accessPolicy = DEFAULT_ACCESS_POLICY } = useTradify();
  const canViewChartHistory = hasMembershipFeature(
    profile.membership,
    "trustedSetupLevels",
    accessPolicy,
  );
  const { symbol: routeSymbol } = useLocalSearchParams<{ symbol?: string | string[] }>();
  const symbol = (Array.isArray(routeSymbol) ? routeSymbol[0] : (routeSymbol ?? ""))
    .trim()
    .toUpperCase();
  const market = watchlist.find((item) => item.symbol === symbol);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("M15");
  const [marketCandles, setMarketCandles] = useState<MarketCandleResponse | null>(null);
  const [chartState, setChartState] = useState<MarketChartDataState>("SYNCING");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!canViewChartHistory || !symbol) {
      setMarketCandles(null);
      setChartState("ERROR");
      return () => {
        active = false;
      };
    }
    setMarketCandles(null);
    setChartState("SYNCING");

    const loadCandles = async () => {
      try {
        const result = await getMarketCandles({ symbol, timeframe, limit: 250 });
        if (!active) return;
        setMarketCandles(result);
        setChartState(result.dataState);
      } catch {
        if (!active) return;
        setChartState((current) =>
          current === "LIVE" ? "STALE" : current === "SYNCING" ? "ERROR" : current,
        );
      }
    };

    void loadCandles();
    const timer = setInterval(() => {
      void loadCandles();
    }, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [canViewChartHistory, symbol, timeframe, refreshKey]);

  const livePrice =
    market?.dataState === "LIVE" && market.price > 0
      ? market.price
      : marketCandles?.candles.at(-1)?.close;
  const quoteLabel =
    market?.dataState === "LIVE"
      ? "LIVE QUOTE"
      : market?.dataState === "FALLBACK"
        ? "REFERENCE PRICE"
        : market?.price && market.price > 0
          ? "STALE REFERENCE"
          : "NO PRICE";
  const formattedPrice =
    market?.price && market.price > 0
      ? market.price.toLocaleString("en-US", {
          minimumFractionDigits: symbol.includes("JPY") ? 3 : symbol.length === 6 ? 5 : 2,
          maximumFractionDigits: symbol.includes("JPY") ? 3 : symbol.length === 6 ? 5 : 2,
        })
      : "—";

  if (!canViewChartHistory) {
    return (
      <Screen scroll={false}>
        <PageMetadata
          title="Chart access"
          description="Historical chart access follows your current membership permissions."
        />
        <View style={[styles.lockedPage, { backgroundColor: colors.background }]}>
          <Pressable
            testID="market-chart-back"
            accessibilityRole="button"
            accessibilityLabel="Back to markets"
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <Feather name="lock" size={24} color={colors.primary} />
          <Text
            style={[styles.lockedTitle, { color: colors.foreground }]}
          >{`Market chart history requires ${accessPolicy.featureMinimumTiers.trustedSetupLevels} access`}</Text>
          <Text style={[styles.lockedDetail, { color: colors.mutedForeground }]}>
            Reference prices remain available for markets included in your membership. Trusted setup
            levels and signal context follow the active membership rules.
          </Text>
          <Pressable
            testID="market-chart-upgrade"
            accessibilityRole="button"
            onPress={() => router.push("/membership")}
            style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.upgradeButtonText, { color: colors.primaryForeground }]}>
              Compare plans
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <PageMetadata
        title="Price history"
        description="Inspect available chart history and its current data status."
      />
      <View style={styles.page}>
        <View style={styles.heading}>
          <Pressable
            testID="market-chart-back"
            accessibilityRole="button"
            accessibilityLabel="Back to markets"
            onPress={() => router.back()}
            style={[
              styles.backButton,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={styles.headingCopy}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>MARKET CHART</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{symbol || "Market"}</Text>
            {market ? (
              <Text style={[styles.marketName, { color: colors.mutedForeground }]}>
                {market.name}
              </Text>
            ) : null}
          </View>
          <Pressable
            testID="market-chart-refresh"
            accessibilityRole="button"
            accessibilityLabel="Refresh chart"
            accessibilityState={{ disabled: chartState === "SYNCING", busy: chartState === "SYNCING" }}
            disabled={chartState === "SYNCING"}
            onPress={() => setRefreshKey((current) => current + 1)}
            style={[
              styles.refreshButton,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Feather name={chartState === "SYNCING" ? "loader" : "refresh-cw"} size={16} color={chartState === "SYNCING" ? colors.primary : colors.foreground} />
          </Pressable>
        </View>

        <View
          style={[styles.pricePanel, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View>
            <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>{quoteLabel}</Text>
            <Text testID="market-chart-price" style={[styles.price, { color: colors.foreground }]}>
              {formattedPrice}
            </Text>
          </View>
          <Text style={[styles.priceSource, { color: colors.mutedForeground }]}>
            {market?.dataState === "LIVE" ? "Current live quote" : "Last known reference"}
          </Text>
        </View>
        {chartState === "ERROR" || chartState === "SYNCING" ? (
          <Text
            accessibilityRole={chartState === "ERROR" ? "alert" : "text"}
            accessibilityLiveRegion="polite"
            style={[
              styles.chartMessage,
              { color: chartState === "ERROR" ? colors.warning : colors.mutedForeground },
            ]}
          >
            {chartState === "ERROR"
              ? "Price history is unavailable right now. Retry when the market source is reachable."
              : "Synchronizing price history…"}
          </Text>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeframeRow}
        >
          {chartTimeframes.map((item) => {
            const active = timeframe === item;
            return (
              <Pressable
                key={item}
                testID={`market-chart-timeframe-${item}`}
                accessibilityRole="tab"
                accessibilityLabel={`${item} timeframe`}
                accessibilityState={{ selected: active }}
                onPress={() => setTimeframe(item)}
                style={[
                  styles.timeframeButton,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.chartWrap}>
          <MarketCandleChart
            candles={(marketCandles?.candles ?? []) as CandleDatum[]}
            provider="MARKET"
            title={`${symbol || "Market"} · ${market?.name ?? "Price history"}`}
            timeframe={marketCandles?.timeframe ?? timeframe}
            timezone={marketCandles?.timezone ?? "UTC"}
            dataState={chartState}
            displayOnly={marketCandles?.displayOnly ?? true}
            lastPrice={livePrice}
            terminal
            cleanMode
            blockedReason={
              chartState === "ERROR"
                ? "No candle history is available from the configured market sources for this instrument and timeframe."
                : undefined
            }
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lockedPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  lockedTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  lockedDetail: { maxWidth: 380, fontSize: 13, lineHeight: 19, textAlign: "center" },
  upgradeButton: {
    minHeight: 42,
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 4,
  },
  upgradeButtonText: { fontSize: 12, fontWeight: "800" },
  page: { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, gap: 12 },
  heading: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 11 },
  headingCopy: { flex: 1 },
  backButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  title: { fontSize: 21, fontWeight: "800", marginTop: 2 },
  marketName: { fontSize: 11, marginTop: 1 },
  pricePanel: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  priceLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  price: { fontSize: 19, fontWeight: "800", fontVariant: ["tabular-nums"], marginTop: 2 },
  priceSource: { fontSize: 9, textAlign: "right" },
  timeframeRow: { gap: 7, paddingRight: 2 },
  timeframeButton: {
    minWidth: 47,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  timeframeText: { fontSize: 10, fontWeight: "800" },
  chartMessage: { marginHorizontal: 18, fontSize: 11, lineHeight: 16 },
  chartWrap: { flex: 1, minHeight: 340 },
});
