import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { designTokens } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { EmptyState, Header, Screen, SurfaceCard } from "@/components/TradifyUI";
import { PageMetadata } from "@/components/PageMetadata";
import { DetailedTrade, hasTradeDetails, Market, Trade, useTradify } from "@/lib/tradify-store";
import { DEFAULT_ACCESS_POLICY, hasMembershipFeature } from "@/constants/membership";

type Breakdown = { key: string; count: number; netR: number; winRate: number };
const markets: Market[] = ["FOREX", "METALS", "INDICES", "CRYPTO"];
const sessions = ["LONDON", "NEW_YORK", "ASIA", "OVERLAP"];
const grades = ["A+", "A", "B", "C", "REJECTED"];

function buildBreakdown(
  keys: string[],
  trades: DetailedTrade[],
  getKey: (trade: DetailedTrade) => string | undefined,
) {
  return keys.map((key) => {
    const items = trades.filter((trade) => getKey(trade) === key);
    const winners = items.filter((trade) => trade.r > 0).length;
    return {
      key,
      count: items.length,
      netR: items.reduce((sum, trade) => sum + trade.r, 0),
      winRate: items.length ? (winners / items.length) * 100 : 0,
    };
  });
}

function BreakdownCard({
  title,
  icon,
  color,
  items,
  wide = false,
}: {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  items: Breakdown[];
  wide?: boolean;
}) {
  const colors = useColors();
  return (
      <SurfaceCard style={[styles.breakdownCard, wide && styles.breakdownCardWide]}>
      <Text style={[styles.breakdownTitle, { color }]}>
        <Feather name={icon} size={15} color={color} /> {title}
      </Text>
      <View style={styles.breakdownList}>
        {items.map((item) => (
          <View
            key={item.key}
            style={[
              styles.breakdownRow,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.breakdownKey, { color: colors.secondaryForeground }]}>
              {title === "Performance by Grade" ? `Grade ${item.key}` : item.key}
            </Text>
            <View style={styles.breakdownValues}>
              <Text
                style={[
                  styles.breakdownNet,
                  { color: item.netR >= 0 ? colors.success : colors.destructive },
                ]}
              >
                {item.count ? `${item.netR >= 0 ? "+" : ""}${item.netR.toFixed(2)} R` : "—"}
              </Text>
              <Text style={[styles.breakdownMeta, { color: colors.mutedForeground }]}>
                {item.count
                  ? `${item.winRate.toFixed(1)}% win rate (${item.count})`
                  : "No verified setups"}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

export default function PerformanceScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { hydrated, trades, signals, profile, accessPolicy = DEFAULT_ACCESS_POLICY } = useTradify();
  const canViewPerformance = hasMembershipFeature(
    profile.membership,
    "performanceContext",
    accessPolicy,
  );
  const closed = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return trades.filter((trade): trade is DetailedTrade => {
      if (trade.status !== "CLOSED" || !hasTradeDetails(trade)) return false;
      const completedAt = Date.parse(trade.closedAt ?? trade.createdAt ?? "");
      return Number.isFinite(completedAt) && completedAt >= cutoff;
    });
  }, [trades]);
  const totalR = closed.reduce((sum, trade) => sum + trade.r, 0);
  const winners = closed.filter((trade) => trade.r > 0);
  const losers = closed.filter((trade) => trade.r < 0);
  const winRate = closed.length ? (winners.length / closed.length) * 100 : 0;
  const profitFactor = losers.length
    ? winners.reduce((sum, trade) => sum + trade.r, 0) /
      Math.abs(losers.reduce((sum, trade) => sum + trade.r, 0))
    : 0;
  const expectancy = closed.length ? totalR / closed.length : 0;
  const maxLosingStreak = useMemo(() => {
    let current = 0;
    let maximum = 0;
    for (const trade of closed) {
      current = trade.r < 0 ? current + 1 : 0;
      maximum = Math.max(maximum, current);
    }
    return maximum;
  }, [closed]);
  const maxDrawdown = useMemo(() => {
    let running = 0;
    let peak = 0;
    let drawdown = 0;
    closed.forEach((trade) => {
      running += trade.r;
      peak = Math.max(peak, running);
      drawdown = Math.min(drawdown, running - peak);
    });
    return drawdown;
  }, [closed]);
  const marketBySymbol = (trade: Trade) =>
    signals.find((signal) => signal.symbol === trade.symbol)?.market;
  const sessionBySymbol = (trade: Trade) =>
    signals.find((signal) => signal.symbol === trade.symbol)?.session;
  const gradeBySymbol = (trade: Trade) =>
    signals.find((signal) => signal.symbol === trade.symbol)?.grade;
  const marketData = buildBreakdown(markets, closed, marketBySymbol);
  const sessionData = buildBreakdown(sessions, closed, sessionBySymbol);
  const gradeData = buildBreakdown(grades, closed, gradeBySymbol);

  if (!hydrated) {
    return (
      <Screen>
        <PageMetadata
          title="Performance"
          description="Recorded performance context is available after account data loads."
        />
        <Header title="Performance" compact />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.success} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading audited performance
          </Text>
        </View>
      </Screen>
    );
  }

  if (!canViewPerformance) {
    return (
      <Screen>
        <PageMetadata
          title="Performance access"
          description="Review membership access to personal performance context."
        />
        <Header
          eyebrow={`recent outcomes · ${accessPolicy.featureMinimumTiers.performanceContext} access`}
          title="Performance"
        />
        <SurfaceCard testID="performance-locked" style={styles.lockedCard}>
          <Feather name="lock" size={22} color={colors.primary} />
          <Text
            style={[styles.lockedTitle, { color: colors.foreground }]}
          >{`30-day performance context requires ${accessPolicy.featureMinimumTiers.performanceContext} access`}</Text>
          <Text style={[styles.lockedDetail, { color: colors.mutedForeground }]}>
            Your saved trade records stay in your account. Compare plans to see which membership
            includes recent outcome and session analysis.
          </Text>
          <Pressable
            testID="performance-upgrade"
            accessibilityRole="button"
            onPress={() => router.push("/membership")}
            style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.upgradeButtonText, { color: colors.primaryForeground }]}>
              Compare plans
            </Text>
          </Pressable>
        </SurfaceCard>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageMetadata
        title="Performance"
        description="Review recorded trade outcomes, drawdown, and personal performance context."
      />
      <Header eyebrow="recorded outcomes · local journal" title="Performance" />
      <SurfaceCard style={styles.banner}>
        <View
          style={[
            styles.bannerIcon,
            { backgroundColor: `${colors.success}18`, borderColor: `${colors.success}45` },
          ]}
        >
          <Feather name="bar-chart-2" size={20} color={colors.success} />
        </View>
        <View style={styles.bannerCopy}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
            Performance analytics
          </Text>
          <Text style={[styles.bannerSubtitle, { color: colors.mutedForeground }]}>
            Recorded outcomes based on closed positions and the levels saved with each decision.
          </Text>
        </View>
      </SurfaceCard>
      {closed.length === 0 ? (
        <EmptyState
          icon="bar-chart-2"
          title="No closed positions yet"
          detail="Performance metrics will populate from recorded outcomes when positions are closed."
        />
      ) : null}

      <View style={styles.metricGrid}>
        {[
          {
            label: "Total Net R Return",
            value: closed.length ? `${totalR > 0 ? "+" : ""}${totalR.toFixed(2)} R` : "—",
            detail: `Across ${closed.length} recorded positions`,
            color: totalR >= 0 ? colors.success : colors.destructive,
          },
          {
            label: "Win Rate",
            value: closed.length ? `${winRate.toFixed(1)}%` : "—",
            detail: `${winners.length} W / ${losers.length} L`,
            color: colors.foreground,
          },
          {
            label: "Profit Factor",
            value: closed.length ? profitFactor.toFixed(2) : "—",
            detail: `Expectancy ${closed.length ? `${expectancy >= 0 ? "+" : ""}${expectancy.toFixed(2)}R` : "—"}`,
            color: colors.primary,
          },
          {
            label: "Max Drawdown",
            value: closed.length ? `${maxDrawdown.toFixed(2)} R` : "—",
            detail: closed.length ? `Max losing streak: ${maxLosingStreak}` : "No recorded outcomes",
            color: colors.destructive,
          },
        ].map((metric) => (
          <SurfaceCard
            key={metric.label}
            style={[
              styles.metric,
              { width: width >= 1100 ? "23%" : width >= 760 ? "31%" : "48%" },
            ]}
          >
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
              {metric.label}
            </Text>
            <Text style={[styles.metricValue, { color: metric.color }]}>{metric.value}</Text>
            <Text style={[styles.metricDetail, { color: colors.mutedForeground }]}>
              {metric.detail}
            </Text>
          </SurfaceCard>
        ))}
      </View>

      <View style={[styles.breakdownGrid, width >= 1100 && styles.breakdownGridWide]}>
        <BreakdownCard
          title="Performance by Market"
          icon="layers"
          color={colors.success}
          items={marketData}
          wide={width >= 1100}
        />
        <BreakdownCard
          title="Performance by Session"
          icon="clock"
          color={colors.primary}
          items={sessionData}
          wide={width >= 1100}
        />
        <BreakdownCard
          title="Performance by Grade"
          icon="award"
          color={colors.chart}
          items={gradeData}
          wide={width >= 1100}
        />
      </View>

      <SurfaceCard style={styles.historyCard}>
        <Text style={[styles.historyTitle, { color: colors.foreground }]}>Position history</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            <View
              style={[
                styles.tableRow,
                styles.tableHeader,
                { backgroundColor: colors.background, borderBottomColor: colors.border },
              ]}
            >
              {[
                "Symbol",
                "Direction",
                "Grade",
                "Session",
                "Status",
                "Official Result",
                "Action",
              ].map((heading) => (
                <Text
                  key={heading}
                  style={[styles.tableCell, styles.headerCell, { color: colors.mutedForeground }]}
                >
                  {heading}
                </Text>
              ))}
            </View>
            {signals.map((signal) => {
              const trade = closed.find((item) => item.symbol === signal.symbol);
              const status = trade
                ? trade.r >= 0
                  ? "CLOSED_WIN"
                  : "CLOSED_LOSS"
                : "RUNNING / PENDING";
              return (
                <View
                  key={signal.id}
                  style={[styles.tableRow, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.tableCell, styles.symbolCell, { color: colors.foreground }]}>
                    {signal.symbol}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { color: signal.direction === "LONG" ? colors.success : colors.destructive },
                    ]}
                  >
                    {signal.direction}
                  </Text>
                  <Text style={[styles.tableCell, { color: colors.primary }]}>{signal.grade}</Text>
                  <Text style={[styles.tableCell, { color: colors.mutedForeground }]}>
                    {signal.session}
                  </Text>
                  <Text
                    style={[
                      styles.statusCell,
                      {
                        color: colors.mutedForeground,
                        backgroundColor: colors.secondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {status.replace(/_/g, " ")}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      {
                        color: trade
                          ? trade.r >= 0
                            ? colors.success
                            : colors.destructive
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {trade
                      ? `${trade.r >= 0 ? "+" : ""}${trade.r.toFixed(2)} R`
                      : "Running / Pending"}
                  </Text>
                  <Pressable
                    testID={`audit-plan-${signal.id}`}
                    onPress={() => router.push(`/signal/${signal.id}`)}
                    style={[
                      styles.auditButton,
                      { backgroundColor: colors.secondary, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.auditText, { color: colors.secondaryForeground }]}>
                      Audit Plan
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lockedCard: {
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.section,
    alignItems: "flex-start",
    gap: designTokens.spacing.md,
  },
  lockedTitle: {
    fontSize: designTokens.typography.body,
    lineHeight: 22,
    fontWeight: designTokens.typography.strong,
  },
  lockedDetail: { fontSize: designTokens.typography.caption, lineHeight: 18 },
  upgradeButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: designTokens.radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeButtonText: {
    fontSize: designTokens.typography.caption,
    fontWeight: designTokens.typography.strong,
  },
  loading: {
    flex: 1,
    minHeight: 500,
    justifyContent: "center",
    alignItems: "center",
    gap: designTokens.spacing.lg,
  },
  loadingText: { fontSize: designTokens.typography.label },
  banner: {
    marginHorizontal: designTokens.spacing.screen,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
  },
  bannerIcon: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    justifyContent: "center",
    alignItems: "center",
  },
  bannerCopy: { flex: 1 },
  bannerTitle: {
    fontSize: designTokens.typography.body,
    fontWeight: designTokens.typography.strong,
  },
  bannerSubtitle: {
    fontSize: designTokens.typography.meta,
    lineHeight: 17,
    marginTop: designTokens.spacing.xs,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: designTokens.spacing.md,
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.section,
  },
  metric: { width: "48%", minHeight: 104, elevation: 1 },
  metricLabel: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
    textTransform: "uppercase",
  },
  metricValue: {
    fontSize: 21,
    fontWeight: designTokens.typography.strong,
    fontFamily: "monospace",
    marginTop: designTokens.spacing.md,
  },
  metricDetail: { fontSize: designTokens.typography.micro, marginTop: designTokens.spacing.xs },
  breakdownGrid: { gap: designTokens.spacing.md, marginTop: designTokens.spacing.section },
  breakdownGridWide: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  breakdownCard: { marginHorizontal: designTokens.spacing.screen, gap: designTokens.spacing.md },
  breakdownCardWide: {
    width: "30%",
    marginHorizontal: 0,
    flexGrow: 1,
  },
  breakdownTitle: {
    fontSize: designTokens.typography.meta,
    fontWeight: designTokens.typography.strong,
    textTransform: "uppercase",
  },
  breakdownList: { gap: designTokens.spacing.sm },
  breakdownRow: {
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownKey: {
    fontSize: designTokens.typography.caption,
    fontWeight: designTokens.typography.strong,
  },
  breakdownValues: { alignItems: "flex-end" },
  breakdownNet: {
    fontSize: designTokens.typography.meta,
    fontWeight: designTokens.typography.strong,
    fontFamily: "monospace",
  },
  breakdownMeta: { fontSize: designTokens.typography.micro, marginTop: 3 },
  historyCard: { margin: designTokens.spacing.screen },
  historyTitle: {
    fontSize: designTokens.typography.body,
    fontWeight: designTokens.typography.strong,
    marginBottom: designTokens.spacing.md,
  },
  table: {
    minWidth: 760,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: designTokens.radii.control,
    overflow: "hidden",
  },
  tableRow: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingHorizontal: 2,
  },
  tableHeader: { minHeight: 40 },
  tableCell: {
    width: 105,
    paddingHorizontal: 8,
    fontSize: designTokens.typography.caption,
    fontFamily: "monospace",
  },
  headerCell: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
    textTransform: "uppercase",
  },
  symbolCell: { fontWeight: designTokens.typography.strong },
  statusCell: {
    width: 125,
    marginHorizontal: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: designTokens.radii.tight,
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
  },
  auditButton: {
    width: 82,
    minHeight: 40,
    marginHorizontal: 8,
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    justifyContent: "center",
    alignItems: "center",
  },
  auditText: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
  },
});
