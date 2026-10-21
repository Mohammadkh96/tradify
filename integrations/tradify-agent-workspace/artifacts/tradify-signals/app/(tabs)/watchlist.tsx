import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import {
  Chip,
  EmptyState,
  FeedStatus,
  Header,
  ModalSheet,
  PriceStateBadge,
  Screen,
} from "@/components/TradifyUI";
import { PageMetadata } from "@/components/PageMetadata";
import { getPriceStateVisual, resolvePriceState } from "@/constants/colors";
import {
  DEFAULT_ACCESS_POLICY,
  membershipMarketCounts,
  membershipWatchlistLimit,
  type MembershipTier,
} from "@/constants/membership";
import { WatchItem, useTradify } from "@/lib/tradify-store";

type WatchlistTab = "WATCHLIST" | "ALL_MARKETS";
const assetClasses = [
  "ALL",
  "METALS",
  "INDICES",
  "FOREX",
  "CRYPTO",
  "COMMODITIES",
  "STOCKS",
  "OTHER",
];
const membershipRank = { Free: 0, Pro: 1, VIP: 2 } as const;

function formatPrice(item: WatchItem) {
  const digits = item.symbol.includes("JPY") ? 3 : item.symbol.length === 6 ? 5 : 2;
  const state = resolvePriceState(
    item.dataState,
    item.referenceState,
    Number.isFinite(item.price) && item.price > 0,
  );
  return state !== "UNAVAILABLE"
    ? item.price.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : "—";
}

export default function WatchlistScreen() {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.35;
  const {
    watchlist,
    signals,
    profile,
    accessPolicy = DEFAULT_ACCESS_POLICY,
    toggleWatch,
    refreshMarket,
  } = useTradify();
  const [activeTab, setActiveTab] = useState<WatchlistTab>("WATCHLIST");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedAssetClass, setSelectedAssetClass] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [quoteOnlySymbol, setQuoteOnlySymbol] = useState<string | null>(null);

  const activeWatchlist = useMemo(() => watchlist.filter((item) => item.open), [watchlist]);
  const marketCounts = membershipMarketCounts(accessPolicy);
  const canAccessMarket = (item: WatchItem) => {
    const requiredTier =
      accessPolicy.marketTiers[item.symbol.trim().toUpperCase()] ?? item.requiredTier ?? "VIP";
    return membershipRank[profile.membership] >= membershipRank[requiredTier];
  };
  const accessibleSavedCount = activeWatchlist.filter(canAccessMarket).length;
  const filteredCatalog = useMemo(
    () =>
      watchlist.filter((item) => {
        const search = query.trim().toLowerCase();
        const matchesSearch =
          !search || `${item.symbol} ${item.name}`.toLowerCase().includes(search);
        const matchesClass = selectedAssetClass === "ALL" || item.market === selectedAssetClass;
        return matchesSearch && matchesClass;
      }),
    [query, selectedAssetClass, watchlist],
  );
  const displayedItems = activeTab === "WATCHLIST" ? activeWatchlist : filteredCatalog;
  const catalogSubtitle =
    activeTab === "WATCHLIST"
      ? profile.membership === "Free"
        ? `${accessibleSavedCount}/${membershipWatchlistLimit("Free", accessPolicy)} Free watchlist slots used. ${marketCounts.pro} markets require Pro and ${marketCounts.vip} require VIP.`
        : profile.membership === "Pro"
          ? `Monitoring ${activeWatchlist.length} saved markets. ${marketCounts.vip} markets currently require VIP.`
          : `Monitoring ${activeWatchlist.length} saved markets across all ${marketCounts.total} configured markets.`
      : `Browse ${marketCounts.total} configured markets. Locked prices stay hidden.`;

  const toggleMarket = (symbol: string) => {
    const item = watchlist.find((entry) => entry.symbol === symbol);
    if (!item) return;
    if (item.open) {
      toggleWatch(symbol);
      return;
    }
    if (!canAccessMarket(item)) {
      router.push("/membership");
      return;
    }
    const limit = membershipWatchlistLimit(profile.membership, accessPolicy);
    if (accessibleSavedCount >= limit) {
      router.push("/membership");
      return;
    }
    toggleWatch(symbol);
  };

  const openMarket = (item: WatchItem) => {
    if (!canAccessMarket(item)) {
      router.push("/membership");
      return;
    }
    if (item.strategySupported === false) {
      setQuoteOnlySymbol(item.symbol);
      return;
    }
    openSignal(item.symbol);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      await refreshMarket();
    } catch {
      setRefreshError("Markets could not be refreshed. Check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const openSignal = (symbol: string) => {
    const signal = signals.find((item) => item.symbol === symbol);
    if (signal) {
      router.push(`/signal/${signal.id}`);
      return;
    }
    router.push(`/chart/${symbol}`);
  };

  return (
    <Screen>
      <PageMetadata
        title="Market watchlist"
        description="Review saved Tradify Signals markets with distinct live, reference, stale, and unavailable price states."
      />
      <Header
        title="Watchlist"
        compact
        onBell={() => router.push("/notifications")}
        onProfile={() => router.push("/profile")}
      />
      <FeedStatus items={watchlist} />
      {refreshError ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.refreshError, { color: colors.warning }]}
        >
          {refreshError}
        </Text>
      ) : null}

      <View style={styles.banner}>
        <View style={[styles.bannerActions, largeText && styles.bannerActionsLarge]}>
          <View
            style={[
              styles.tabSwitcher,
              largeText && styles.tabSwitcherLarge,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Pressable
              testID="watchlist-tab"
              accessibilityRole="tab"
              accessibilityLabel={`My Watchlist, ${activeWatchlist.length} saved markets`}
              accessibilityState={{ selected: activeTab === "WATCHLIST" }}
              onPress={() => setActiveTab("WATCHLIST")}
              style={[
                styles.tab,
                largeText && styles.tabLarge,
                activeTab === "WATCHLIST" && {
                  backgroundColor: `${colors.primary}20`,
                  borderColor: `${colors.primary}55`,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === "WATCHLIST" ? colors.primary : colors.mutedForeground },
                ]}
              >{`My Watchlist (${activeWatchlist.length})`}</Text>
            </Pressable>
            <Pressable
              testID="all-markets-tab"
              accessibilityRole="tab"
              accessibilityLabel={`All markets, ${watchlist.length} markets`}
              accessibilityState={{ selected: activeTab === "ALL_MARKETS" }}
              onPress={() => setActiveTab("ALL_MARKETS")}
              style={[
                styles.tab,
                largeText && styles.tabLarge,
                activeTab === "ALL_MARKETS" && {
                  backgroundColor: `${colors.secondary}95`,
                  borderColor: colors.secondary,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === "ALL_MARKETS"
                        ? colors.secondaryForeground
                        : colors.mutedForeground,
                  },
                ]}
              >{`All Markets (${watchlist.length})`}</Text>
            </Pressable>
          </View>
          <Pressable
            testID="add-market"
            accessibilityRole="button"
            accessibilityLabel="Add a market to your watchlist"
            onPress={() => setIsAddModalOpen(true)}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Feather name="plus" size={15} color={colors.primaryForeground} />
            <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>Add</Text>
          </Pressable>
          <Pressable
            testID="refresh-watchlist"
            accessibilityRole="button"
            accessibilityLabel={refreshing ? "Refreshing markets" : "Refresh markets"}
            onPress={handleRefresh}
            disabled={refreshing}
            style={({ pressed }) => [
              styles.refreshButton,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                opacity: pressed || refreshing ? 0.55 : 1,
              },
            ]}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="refresh-cw" size={16} color={colors.foreground} />
            )}
          </Pressable>
        </View>
        <Text style={[styles.bannerSubtitle, { color: colors.mutedForeground }]}>
          {catalogSubtitle}
        </Text>
      </View>

      {activeTab === "ALL_MARKETS" ? (
        <View style={styles.filterPanel}>
          <View
            style={[
              styles.searchWrap,
              { backgroundColor: colors.input, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              testID="market-search"
              accessibilityLabel="Search markets by symbol or description"
              value={query}
              onChangeText={setQuery}
              placeholder="Search by symbol or description..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.search, { color: colors.foreground }]}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.classRow}
          >
            {assetClasses.map((assetClass) => (
              <Chip
                key={assetClass}
                label={assetClass}
                active={selectedAssetClass === assetClass}
                onPress={() => setSelectedAssetClass(assetClass)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {displayedItems.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No Instruments Found"
          detail={
            activeTab === "WATCHLIST"
              ? 'Your watchlist is currently empty. Click "Add Market" to select instruments.'
              : "No markets matched your search filters."
          }
          action={activeTab === "WATCHLIST" ? "Browse & Add Markets" : undefined}
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <View style={styles.grid}>
          {displayedItems.map((item) => {
            const accessible = canAccessMarket(item);
            const requiredTier: MembershipTier =
              accessPolicy.marketTiers[item.symbol.trim().toUpperCase()] ??
              item.requiredTier ??
              "VIP";
            const matchedSignal =
              accessible && item.strategySupported !== false
                ? signals.find((signal) => signal.symbol === item.symbol)
                : undefined;
            const priceState = resolvePriceState(
              item.dataState,
              item.referenceState,
              Number.isFinite(item.price) && item.price > 0,
            );
            const priceStateVisual = getPriceStateVisual(priceState, colors);
            const stateLabel = !accessible
              ? `${requiredTier.toUpperCase()} LOCKED`
              : `${priceState} PRICE`;
            const changeLabel =
              item.changeBasis === "PREVIOUS_CLOSE"
                ? "since previous close"
                : item.changeBasis === "STREAM"
                  ? "since update"
                  : "24h";
            return (
              <View
                key={item.symbol}
                testID={`market-card-${item.symbol}`}
                style={[
                  styles.marketCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: !accessible ? `${colors.warning}55` : colors.border,
                  },
                ]}
              >
                <Pressable
                  testID={`market-row-${item.symbol}`}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`${item.symbol}, ${item.name}. ${stateLabel}. ${accessible ? `Price ${formatPrice(item)}. Change ${item.change >= 0 ? "up " : ""}${item.change.toFixed(2)} percent ${changeLabel}.` : `Price locked. ${requiredTier} membership required.`}`}
                  accessibilityHint={
                    !accessible
                      ? `Opens ${requiredTier} membership options.`
                      : item.strategySupported === false
                        ? "Opens quote-only market information."
                        : "Opens market details."
                  }
                  onPress={() => openMarket(item)}
                  style={({ pressed }) => [styles.marketCardMain, { opacity: pressed ? 0.78 : 1 }]}
                >
                  <View style={[styles.cardTop, largeText && styles.cardTopLarge]}>
                    <View style={styles.identity}>
                      <View style={styles.identityRow}>
                        <Text style={[styles.symbol, { color: colors.foreground }]}>
                          {item.symbol}
                        </Text>
                        <Text
                          style={[
                            styles.assetClass,
                            {
                              color: colors.secondaryForeground,
                              backgroundColor: colors.secondary,
                            },
                          ]}
                        >
                          {item.market}
                        </Text>
                        {accessible ? (
                          <PriceStateBadge state={priceState} />
                        ) : (
                          <Text
                            style={[
                              styles.statePill,
                              {
                                color: colors.warning,
                                backgroundColor: `${colors.warning}18`,
                                borderColor: `${colors.warning}70`,
                              },
                            ]}
                          >
                            {stateLabel}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.description, { color: colors.mutedForeground }]}>
                        {item.name}
                      </Text>
                    </View>
                    <View style={[styles.quote, largeText && styles.quoteLarge]}>
                      <Text
                        style={[
                          styles.price,
                          {
                            color: accessible
                              ? priceState === "UNAVAILABLE"
                                ? colors.mutedForeground
                                : priceStateVisual.color
                              : colors.mutedForeground,
                          },
                        ]}
                      >
                        {accessible ? formatPrice(item) : "—"}
                      </Text>
                      <Text
                        style={[
                          styles.quoteMeta,
                          {
                            color: !accessible
                              ? colors.warning
                              : item.change >= 0
                                ? colors.success
                                : colors.destructive,
                          },
                        ]}
                      >
                        {!accessible ? `Unlock ${requiredTier}` : item.change >= 0 ? "+" : ""}
                        {accessible ? `${item.change.toFixed(2)}% · ${changeLabel}` : ""}
                      </Text>
                    </View>
                  </View>
                </Pressable>
                <View
                  testID={`market-actions-${item.symbol}`}
                  style={[
                    styles.cardBottom,
                    largeText && styles.cardBottomLarge,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <View style={styles.engineCopy}>
                    <Text
                      style={[
                        styles.enginePill,
                        {
                          color: !accessible
                            ? colors.warning
                            : matchedSignal
                              ? colors.success
                              : colors.mutedForeground,
                          backgroundColor: !accessible
                            ? `${colors.warning}18`
                            : matchedSignal
                              ? `${colors.success}18`
                              : colors.secondary,
                          borderColor: !accessible
                            ? `${colors.warning}45`
                            : matchedSignal
                              ? `${colors.success}45`
                              : colors.border,
                        },
                      ]}
                    >
                      {!accessible
                        ? `${requiredTier.toUpperCase()} ACCESS`
                        : item.strategySupported === false
                          ? "QUOTE ONLY"
                          : matchedSignal
                            ? "QUALIFIED SETUP"
                            : "AWAITING EVALUATION"}
                    </Text>
                    <Text
                      style={[
                        styles.actionState,
                        {
                          color: matchedSignal
                            ? colors.secondaryForeground
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      {!accessible
                        ? `Upgrade to ${requiredTier} to view live prices`
                        : item.strategySupported === false
                          ? "Display-only prices; no strategy levels or candles"
                          : matchedSignal
                            ? matchedSignal.action
                            : "Authoritative state pending"}
                    </Text>
                    <Text
                      testID={`market-setup-label-${item.symbol}`}
                      style={[
                        styles.setupLabel,
                        { color: item.setupLabel ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {!accessible
                        ? `Available with ${requiredTier}`
                        : item.strategySupported === false
                          ? "Quote-only market · no setup"
                          : item.setupLabel
                            ? `Setup · ${item.setupLabel}`
                            : item.setupLabel === null
                              ? "No setup assigned"
                              : "Setup · syncing"}
                    </Text>
                  </View>
                  <Pressable
                    testID={`toggle-watch-${item.symbol}`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      item.open
                        ? `Remove ${item.symbol} from watchlist`
                        : accessible
                          ? `Add ${item.symbol} to watchlist`
                          : `Unlock ${item.symbol} with ${requiredTier}`
                    }
                    accessibilityState={{ selected: item.open }}
                    onPress={() => toggleMarket(item.symbol)}
                    hitSlop={8}
                    style={[
                      styles.watchAction,
                      {
                        backgroundColor: item.open
                          ? `${colors.destructive}12`
                          : !accessible
                            ? `${colors.warning}12`
                            : `${colors.success}12`,
                        borderColor: item.open
                          ? `${colors.destructive}35`
                          : !accessible
                            ? `${colors.warning}35`
                            : `${colors.success}35`,
                      },
                    ]}
                  >
                    <Feather
                      name={item.open ? "trash-2" : !accessible ? "lock" : "plus"}
                      size={15}
                      color={
                        item.open
                          ? colors.destructive
                          : !accessible
                            ? colors.warning
                            : colors.success
                      }
                    />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <ModalSheet
        visible={isAddModalOpen}
        title="Add Market to Watchlist"
        onClose={() => setIsAddModalOpen(false)}
      >
        <TextInput
          testID="add-market-search"
          accessibilityLabel="Search markets by symbol or asset class"
          value={query}
          onChangeText={setQuery}
          placeholder="Search by symbol or asset class..."
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.modalSearch,
            { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border },
          ]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.classRow}
        >
          {assetClasses.map((assetClass) => (
            <Chip
              key={assetClass}
              label={assetClass}
              active={selectedAssetClass === assetClass}
              onPress={() => setSelectedAssetClass(assetClass)}
            />
          ))}
        </ScrollView>
        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
          {filteredCatalog.map((item) => (
            <View
              key={item.symbol}
              style={[
                styles.modalRow,
                largeText && styles.modalRowLarge,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <View style={styles.modalCopy}>
                <Text style={[styles.modalSymbol, { color: colors.foreground }]}>
                  {item.symbol}
                </Text>
                <Text style={[styles.modalDescription, { color: colors.mutedForeground }]}>
                  {item.name} · {item.market}
                </Text>
              </View>
              <Pressable
                testID={`modal-toggle-${item.symbol}`}
                accessibilityRole="button"
                accessibilityLabel={`${item.open ? "Remove" : !canAccessMarket(item) ? "Unlock" : "Add"} ${item.symbol}${!canAccessMarket(item) ? ` with ${item.requiredTier ?? "Pro"}` : ""}`}
                accessibilityState={{ selected: item.open }}
                onPress={() => toggleMarket(item.symbol)}
                style={[
                  styles.modalAction,
                  {
                    backgroundColor: item.open
                      ? `${colors.destructive}15`
                      : !canAccessMarket(item)
                        ? `${colors.warning}15`
                        : colors.success,
                    borderColor: item.open
                      ? `${colors.destructive}45`
                      : !canAccessMarket(item)
                        ? colors.warning
                        : colors.success,
                  },
                ]}
              >
                <Feather
                  name={item.open ? "check" : !canAccessMarket(item) ? "lock" : "plus"}
                  size={14}
                  color={
                    item.open
                      ? colors.destructive
                      : !canAccessMarket(item)
                        ? colors.warning
                        : colors.primaryForeground
                  }
                />
                <Text
                  style={[
                    styles.modalActionText,
                    {
                      color: item.open
                        ? colors.destructive
                        : !canAccessMarket(item)
                          ? colors.warning
                          : colors.primaryForeground,
                    },
                  ]}
                >
                  {item.open
                    ? "Remove"
                    : !canAccessMarket(item)
                      ? `Unlock ${item.requiredTier ?? "Pro"}`
                      : "Add"}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </ModalSheet>
      <ModalSheet
        visible={Boolean(quoteOnlySymbol)}
        title={`${quoteOnlySymbol ?? "Market"} · quote only`}
        onClose={() => setQuoteOnlySymbol(null)}
      >
        <Text style={[styles.quoteOnlyCopy, { color: colors.mutedForeground }]}>
          This symbol is available for price monitoring only. It does not provide strategy signals,
          trusted candle history, or trade execution.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save quote-only market to watchlist"
          onPress={() => {
            if (quoteOnlySymbol) toggleMarket(quoteOnlySymbol);
            setQuoteOnlySymbol(null);
          }}
          style={[styles.quoteOnlySave, { backgroundColor: colors.success }]}
        >
          <Feather name="plus" size={14} color={colors.primaryForeground} />
          <Text style={[styles.modalActionText, { color: colors.primaryForeground }]}>
            Save to watchlist
          </Text>
        </Pressable>
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: 18, marginTop: 10, gap: 10 },
  bannerSubtitle: { fontSize: 12, lineHeight: 17 },
  bannerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  bannerActionsLarge: { flexWrap: "wrap", justifyContent: "flex-start" },
  tabSwitcher: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 15,
    padding: 3,
    flexDirection: "row",
    gap: 3,
  },
  tabSwitcherLarge: { flex: 0, width: "100%", flexDirection: "column" },
  tab: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  tabLarge: { width: "100%" },
  tabText: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  addButton: {
    minHeight: 44,
    borderRadius: 13,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: { fontSize: 11, fontWeight: "800" },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  filterPanel: { marginHorizontal: 18, marginTop: 14, gap: 10 },
  searchWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  search: { flex: 1, fontSize: 13 },
  classRow: { gap: 6, paddingVertical: 1 },
  grid: { marginTop: 16, gap: 10 },
  marketCard: { marginHorizontal: 18, borderWidth: 1, borderRadius: 8, padding: 15, gap: 12 },
  marketCardMain: { minWidth: 0 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardTopLarge: { flexDirection: "column" },
  identity: { flex: 1 },
  identityRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  symbol: { fontSize: 17, fontWeight: "800", letterSpacing: 0.15 },
  assetClass: {
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statePill: {
    fontSize: 9,
    fontWeight: "800",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  description: { fontSize: 12, marginTop: 4 },
  quote: { alignItems: "flex-end" },
  quoteLarge: { alignItems: "flex-start" },
  price: { fontSize: 17, fontFamily: "monospace", fontWeight: "800" },
  quoteMeta: { fontSize: 10, fontFamily: "monospace", marginTop: 4 },
  cardBottom: {
    borderTopWidth: 1,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  cardBottomLarge: { flexDirection: "column", alignItems: "stretch" },
  engineCopy: { flex: 1, gap: 4 },
  enginePill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: "800",
  },
  actionState: { fontSize: 10, fontWeight: "700" },
  setupLabel: { fontSize: 10, fontWeight: "700" },
  watchAction: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSearch: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 10,
  },
  modalList: { maxHeight: 360, marginTop: 8 },
  modalRow: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 8,
  },
  modalCopy: { flex: 1 },
  modalSymbol: { fontSize: 13, fontWeight: "800" },
  modalDescription: { fontSize: 10, marginTop: 3 },
  modalRowLarge: { flexDirection: "column", alignItems: "stretch" },
  modalAction: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modalActionText: { fontSize: 10, fontWeight: "800" },
  quoteOnlyCopy: { fontSize: 12, lineHeight: 18 },
  refreshError: { marginHorizontal: 18, marginTop: 8, fontSize: 11, lineHeight: 16 },
  quoteOnlySave: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
