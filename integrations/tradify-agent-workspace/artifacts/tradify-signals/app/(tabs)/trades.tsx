import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { designTokens, resolvePriceState } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { EmptyState, Header, PriceStateBadge, Screen, SurfaceCard } from "@/components/TradifyUI";
import { PageMetadata } from "@/components/PageMetadata";
import { hasTradeDetails, Trade, useTradify } from "@/lib/tradify-store";

function priceDigits(symbol: string) {
  if (symbol.includes("JPY")) return 3;
  return symbol.length === 6 ? 5 : 2;
}

function formatPrice(price: number, symbol: string) {
  return price > 0 ? price.toFixed(priceDigits(symbol)) : "—";
}

export default function TradesScreen() {
  const colors = useColors();
  const { hydrated, trades, signals, watchlist, closeTrade } = useTradify();
  const [lockedPartials, setLockedPartials] = useState<string[]>([]);
  const activeTrades = trades.filter((trade) => trade.status !== "CLOSED");

  if (!hydrated) {
    return (
      <Screen>
        <PageMetadata
          title="Active trades"
          description="Review active trade plans and their current risk context in Tradify Signals."
        />
        <Header title="Active Trades" compact />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.success} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Synchronizing active positions
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageMetadata
        title="Active trades"
        description="Review active trade plans and their current risk context in Tradify Signals."
      />
      <Header
        eyebrow="execution journal · live positions"
        title="Active Trades"
        onBell={() => router.push("/notifications")}
      />
      <SurfaceCard
        style={[
          styles.banner,
          { backgroundColor: colors.card, borderColor: `${colors.success}40` },
        ]}
      >
        <View
          style={[
            styles.bannerIcon,
            { backgroundColor: `${colors.success}18`, borderColor: `${colors.success}45` },
          ]}
        >
          <Feather name="shield" size={20} color={colors.success} />
        </View>
        <View style={styles.bannerCopy}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
            Active Trade Execution Tracker
          </Text>
          <Text style={[styles.bannerSubtitle, { color: colors.mutedForeground }]}>
            Step-by-step position management directives, stop adjustments, and execution audit log.
          </Text>
        </View>
        <Text
          style={[
            styles.positionCount,
            {
              color: colors.success,
              backgroundColor: `${colors.success}18`,
              borderColor: `${colors.success}45`,
            },
          ]}
        >
          {activeTrades.length} Active Positions
        </Text>
      </SurfaceCard>

      {activeTrades.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="No Open Positions Currently Active"
          detail="All previously qualified setups have either hit their target checkpoints or completed their session cycles."
        />
      ) : (
        <View style={styles.tradeList}>
          {activeTrades.map((trade) => {
            if (!hasTradeDetails(trade)) {
              return (
                <SurfaceCard
                  key={trade.id}
                  testID={`locked-trade-${trade.id}`}
                  style={styles.tradeCard}
                >
                  <View style={styles.lockedHeading}>
                    <Feather name="lock" size={17} color={colors.primary} />
                    <Text style={[styles.symbol, { color: colors.foreground }]}>
                      {trade.symbol}
                    </Text>
                    <Text style={[styles.tradeMeta, { color: colors.mutedForeground }]}>
                      {trade.direction} · {trade.status}
                    </Text>
                  </View>
                  <Text style={[styles.lockedDetail, { color: colors.mutedForeground }]}>
                    This saved Pro-market trade is locked on your current plan. Its prices and
                    signal context stay hidden; the record is still saved.
                  </Text>
                  <View style={styles.actions}>
                    <Pressable
                      testID={`upgrade-locked-trade-${trade.id}`}
                      onPress={() => router.push("/membership")}
                      style={[
                        styles.actionButton,
                        { backgroundColor: colors.secondary, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.actionText, { color: colors.secondaryForeground }]}>
                        Compare plans
                      </Text>
                    </Pressable>
                    <Pressable
                      testID={`close-locked-trade-${trade.id}`}
                      onPress={() => closeTrade(trade.id)}
                      style={[
                        styles.actionButton,
                        { backgroundColor: colors.destructive, borderColor: colors.destructive },
                      ]}
                    >
                      <Text style={[styles.actionText, { color: colors.destructiveForeground }]}>
                        Close journal record
                      </Text>
                    </Pressable>
                  </View>
                </SurfaceCard>
              );
            }
            const quote = watchlist.find((item) => item.symbol === trade.symbol);
            const currentPrice = quote?.price ?? 0;
            const priceState = resolvePriceState(
              quote?.dataState,
              quote?.referenceState,
              Number.isFinite(currentPrice) && currentPrice > 0,
            );
            const livePrice = priceState === "LIVE" ? currentPrice : 0;
            const isLong = trade.direction === "LONG";
            const riskDistance = Math.abs(trade.entry - trade.stop);
            const unrealizedR =
              livePrice > 0 && riskDistance > 0
                ? ((livePrice - trade.entry) * (isLong ? 1 : -1)) / riskDistance
                : null;
            const signal = signals.find((item) => item.symbol === trade.symbol);
            const targets = signal ? [signal.tp1, signal.tp2, signal.tp3] : [trade.target];
            const locked = lockedPartials.includes(trade.id);
            return (
              <SurfaceCard key={trade.id} style={styles.tradeCard}>
                <View style={styles.tradeHeader}>
                  <View style={styles.tradeIdentity}>
                    <View style={styles.symbolRow}>
                      <Text style={[styles.symbol, { color: colors.foreground }]}>
                        {trade.symbol}
                      </Text>
                      <View
                        style={[
                          styles.direction,
                          {
                            backgroundColor: `${isLong ? colors.success : colors.destructive}18`,
                            borderColor: `${isLong ? colors.success : colors.destructive}45`,
                          },
                        ]}
                      >
                        <Feather
                          name={isLong ? "trending-up" : "trending-down"}
                          size={12}
                          color={isLong ? colors.success : colors.destructive}
                        />
                        <Text
                          style={[
                            styles.directionText,
                            { color: isLong ? colors.success : colors.destructive },
                          ]}
                        >
                          {trade.direction}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.tradeMeta, { color: colors.mutedForeground }]}>
                      Entry:{" "}
                      <Text style={{ color: colors.secondaryForeground }}>
                        {formatPrice(trade.entry, trade.symbol)}
                      </Text>{" "}
                      · Current:{" "}
                      <Text
                        style={[
                          styles.currentPrice,
                          {
                            color:
                              priceState === "UNAVAILABLE"
                                ? colors.mutedForeground
                                : colors.foreground,
                            backgroundColor: colors.secondary,
                          },
                        ]}
                      >
                        {priceState === "UNAVAILABLE"
                          ? "—"
                          : formatPrice(currentPrice, trade.symbol)}
                      </Text>
                    </Text>
                    <View style={styles.tradeQuoteState}>
                      <PriceStateBadge state={priceState} />
                      <Text style={[styles.quoteContext, { color: colors.mutedForeground }]}>
                        Current market price
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.resultBox,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                      UNREALIZED RESULT
                    </Text>
                    <Text
                      style={[
                        styles.resultValue,
                        {
                          color:
                            unrealizedR === null
                              ? colors.mutedForeground
                              : unrealizedR >= 0
                                ? colors.success
                                : colors.destructive,
                        },
                      ]}
                    >
                      {unrealizedR === null
                        ? "—"
                        : `${unrealizedR >= 0 ? "+" : ""}${unrealizedR.toFixed(2)} R`}
                    </Text>
                  </View>
                </View>

                <View style={styles.targetGrid}>
                  {targets.map((target, index) => {
                    const hit =
                      livePrice > 0 && (isLong ? livePrice >= target : livePrice <= target);
                    return (
                      <View
                        key={`${trade.id}-target-${index}`}
                        style={[
                          styles.targetCard,
                          {
                            backgroundColor: hit ? `${colors.success}12` : colors.background,
                            borderColor: hit ? `${colors.success}55` : colors.border,
                          },
                        ]}
                      >
                        <View style={styles.targetTop}>
                          <Text
                            style={[
                              styles.targetLabel,
                              { color: hit ? colors.success : colors.mutedForeground },
                            ]}
                          >
                            Target {index + 1}
                          </Text>
                          {hit ? (
                            <Feather name="check-circle" size={14} color={colors.success} />
                          ) : null}
                        </View>
                        <Text style={[styles.targetValue, { color: colors.foreground }]}>
                          {formatPrice(target, trade.symbol)}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View
                  style={[
                    styles.audit,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.auditCopy}>
                    <Feather name="alert-circle" size={15} color={colors.chart} />
                    <Text style={[styles.auditText, { color: colors.secondaryForeground }]}>
                      Execution Audit:{" "}
                      <Text style={{ color: colors.mutedForeground }}>{trade.status}</Text>
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    {signal ? (
                      <Pressable
                        testID={`view-plan-${trade.id}`}
                        onPress={() => router.push(`/signal/${signal.id}`)}
                        style={[
                          styles.actionButton,
                          { backgroundColor: colors.secondary, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.actionText, { color: colors.secondaryForeground }]}>
                          View Plan
                        </Text>
                      </Pressable>
                    ) : null}
                    {!locked ? (
                      <Pressable
                        testID={`lock-partials-${trade.id}`}
                        onPress={() => setLockedPartials((ids) => [...ids, trade.id])}
                        style={[
                          styles.actionButton,
                          { backgroundColor: colors.success, borderColor: colors.success },
                        ]}
                      >
                        <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
                          Lock Partials
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={[styles.lockedText, { color: colors.success }]}>
                        Partials Locked
                      </Text>
                    )}
                    <Pressable
                      testID={`close-trade-${trade.id}`}
                      onPress={() => closeTrade(trade.id)}
                      style={[
                        styles.actionButton,
                        { backgroundColor: colors.destructive, borderColor: colors.destructive },
                      ]}
                    >
                      <Text style={[styles.actionText, { color: colors.destructiveForeground }]}>
                        Close Trade
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </SurfaceCard>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    minHeight: 500,
    alignItems: "center",
    justifyContent: "center",
    gap: designTokens.spacing.lg,
  },
  loadingText: { fontSize: designTokens.typography.label },
  banner: {
    marginHorizontal: designTokens.spacing.screen,
    flexDirection: "row",
    alignItems: "center",
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: designTokens.radii.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerCopy: { flex: 1 },
  bannerTitle: {
    fontSize: designTokens.typography.body,
    fontWeight: designTokens.typography.strong,
    letterSpacing: -0.2,
  },
  bannerSubtitle: {
    fontSize: designTokens.typography.meta,
    lineHeight: 16,
    marginTop: designTokens.spacing.xs,
  },
  positionCount: {
    borderWidth: 1,
    borderRadius: designTokens.radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
    textAlign: "center",
  },
  tradeList: { gap: designTokens.spacing.section, marginTop: designTokens.spacing.section },
  tradeCard: { marginHorizontal: designTokens.spacing.screen, gap: designTokens.spacing.section },
  lockedHeading: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  lockedDetail: { fontSize: designTokens.typography.caption, lineHeight: 18 },
  tradeHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tradeIdentity: { flex: 1 },
  symbolRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  symbol: { fontSize: designTokens.typography.section, fontWeight: designTokens.typography.strong },
  direction: {
    borderWidth: 1,
    borderRadius: designTokens.radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  directionText: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
  },
  tradeMeta: { fontSize: designTokens.typography.caption, marginTop: 7 },
  tradeQuoteState: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 7 },
  quoteContext: { fontSize: designTokens.typography.micro },
  currentPrice: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: designTokens.radii.tight,
    fontWeight: designTokens.typography.bold,
  },
  resultBox: {
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    padding: 10,
    alignItems: "flex-end",
  },
  resultLabel: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
  },
  resultValue: {
    fontSize: designTokens.typography.body,
    fontWeight: designTokens.typography.strong,
    fontFamily: "monospace",
    marginTop: designTokens.spacing.xs,
  },
  targetGrid: { flexDirection: "row", gap: designTokens.spacing.sm },
  targetCard: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    padding: 10,
  },
  targetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  targetLabel: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.bold,
  },
  targetValue: {
    fontSize: designTokens.typography.label,
    fontWeight: designTokens.typography.bold,
    fontFamily: "monospace",
    marginTop: 7,
  },
  audit: {
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    padding: 11,
    gap: designTokens.spacing.md,
  },
  auditCopy: { flexDirection: "row", alignItems: "center", gap: 7 },
  auditText: {
    fontSize: designTokens.typography.caption,
    fontWeight: designTokens.typography.bold,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
    gap: designTokens.spacing.sm,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    paddingHorizontal: 11,
    minHeight: 40,
    justifyContent: "center",
  },
  actionText: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
  },
  lockedText: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
    paddingHorizontal: 4,
  },
});
