import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  EducationalPreview,
  EmptyState,
  FeedStatus,
  Header,
  LoadingState,
  Screen,
  SignalCard,
} from "@/components/TradifyUI";
import { PageMetadata } from "@/components/PageMetadata";
import { Market, useTradify } from "@/lib/tradify-store";
import { useColors } from "@/hooks/useColors";
import { DEFAULT_ACCESS_POLICY, hasMembershipFeature } from "@/constants/membership";

type MarketFilter = "ALL" | Market;
type SessionFilter = "ALL" | "LONDON" | "NEW YORK" | "ASIA";

const marketFilters: { label: string; value: MarketFilter }[] = [
  { label: "ALL", value: "ALL" },
  { label: "Gold (XAUUSD)", value: "METALS" },
  { label: "INDICES", value: "INDICES" },
  { label: "FOREX", value: "FOREX" },
];

const sessionFilters: { label: string; value: SessionFilter }[] = [
  { label: "ALL", value: "ALL" },
  { label: "LONDON", value: "LONDON" },
  { label: "NEW YORK", value: "NEW YORK" },
  { label: "ASIA", value: "ASIA" },
];

export default function OpportunitiesScreen() {
  const colors = useColors();
  const { width, fontScale } = useWindowDimensions();
  const {
    hydrated,
    signals,
    watchlist,
    toggleAlert,
    mt5Connected,
    refreshMarket,
    profile,
    accessPolicy = DEFAULT_ACCESS_POLICY,
  } = useTradify();
  const [selectedMarket, setSelectedMarket] = useState<MarketFilter>("ALL");
  const [selectedSession, setSelectedSession] = useState<SessionFilter>("ALL");
  const [selectedAlertSymbol, setSelectedAlertSymbol] = useState<string>();
  const [alertConfirmation, setAlertConfirmation] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const wide = width >= 700;
  const cardWidth = wide ? (width - 60) / 2 : undefined;
  const hasSignalContext = hasMembershipFeature(profile.membership, "signalContext", accessPolicy);

  const filteredSignals = useMemo(
    () =>
      (hasSignalContext ? signals : []).filter((signal) => {
        const session = signal.session.replace(/_/g, " ") as SessionFilter;
        return (
          (selectedMarket === "ALL" || signal.market === selectedMarket) &&
          (selectedSession === "ALL" || session === selectedSession)
        );
      }),
    [hasSignalContext, signals, selectedMarket, selectedSession],
  );

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      await refreshMarket();
    } catch {
      setRefreshError(
        "Market data could not be refreshed. Try again when your connection is available.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const clearFilters = () => {
    setSelectedMarket("ALL");
    setSelectedSession("ALL");
  };

  const alertMarkets = useMemo(() => watchlist.filter((item) => item.open), [watchlist]);
  const selectedAlertMarket =
    alertMarkets.find((item) => item.symbol === selectedAlertSymbol) ?? alertMarkets[0];

  const selectAlertMarket = (symbol: string) => {
    setSelectedAlertSymbol(symbol);
    setAlertConfirmation(undefined);
  };

  const enableSelectedAlert = () => {
    if (!hasMembershipFeature(profile.membership, "priceAlerts", accessPolicy)) {
      router.push("/membership");
      return;
    }
    if (!selectedAlertMarket || selectedAlertMarket.alerts) return;
    toggleAlert(selectedAlertMarket.symbol);
    setAlertConfirmation(selectedAlertMarket.symbol);
  };

  const emptyState = !hasSignalContext
    ? {
        icon: "lock" as const,
        title: `Live signal context requires ${accessPolicy.featureMinimumTiers.signalContext} access`,
        detail:
          "The Opportunities feed remains global and does not depend on your saved Watchlist. Membership rules determine access to validated signal details.",
        action: "Compare plans",
        onAction: () => router.push("/membership"),
      }
    : !mt5Connected
      ? {
          icon: "wifi-off" as const,
          title: "Waiting for live market data",
          detail:
            "The live market feed is reconnecting. Tradify will only show a qualified opportunity once current prices pass its validation checks.",
          action: "Open Watchlist",
          onAction: () => router.push("/watchlist"),
        }
      : signals.length > 0
        ? {
            icon: "filter" as const,
            title: "No setups match these filters",
            detail: `There ${signals.length === 1 ? "is" : "are"} ${signals.length} qualified setup${signals.length === 1 ? "" : "s"} outside this view. Widen the market or session filters to see them.`,
            action: "Clear Filters",
            onAction: clearFilters,
          }
        : {
            icon: "inbox" as const,
            title: "No qualified setup right now",
            detail:
              "No opportunity has met the required checks yet. This screen stays honest instead of filling the feed with a trade idea.",
            action: "View Data Information",
            onAction: () => router.push("/legal"),
          };

  if (!hydrated) {
    return (
      <Screen>
        <PageMetadata
          title="Market opportunities"
          description="Browse qualified Tradify Signals opportunities with clearly labeled market status and risk context."
          indexable
        />
        <Header title="Opportunities" compact />
        <LoadingState label="Loading your saved feed" />
      </Screen>
    );
  }

  return (
    <Screen>
      <PageMetadata
        title="Market opportunities"
        description="Browse qualified Tradify Signals opportunities with clearly labeled market status and risk context."
        indexable
      />
      <Header
        title="Opportunities"
        compact
        onBell={() => router.push("/notifications")}
        onProfile={() => router.push("/profile")}
        onUpgrade={() => router.push("/membership")}
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

      <View
        testID="opportunities-intro"
        style={[
          styles.feedHero,
          fontScale >= 1.4 && styles.feedHeroLarge,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.heroText}>
          <Text style={[styles.heroKicker, { color: colors.primary }]}>MARKET SETUPS</Text>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Setups with context.</Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
            Opportunities appear only after current market data passes validation.
          </Text>
        </View>
        <View style={[styles.heroActions, fontScale >= 1.4 && styles.heroActionsLarge]}>
          <View style={styles.heroScore}>
            <Text style={[styles.heroScoreValue, { color: colors.primary }]}>
              {filteredSignals.length}
            </Text>
            <Text style={[styles.heroScoreLabel, { color: colors.mutedForeground }]}>IN VIEW</Text>
          </View>
          <Pressable
            testID="refresh-live-engine"
            accessibilityRole="button"
            accessibilityLabel={refreshing ? "Refreshing opportunities" : "Refresh opportunities"}
            onPress={handleRefresh}
            style={({ pressed }) => [
              styles.refreshButton,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="refresh-cw" size={17} color={colors.primary} />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.filterStack}>
        <View
          testID="market-filter-group"
          style={[styles.filterGroup, fontScale >= 1.4 && styles.filterGroupLarge]}
        >
          <Text style={[styles.filterLabelText, { color: colors.mutedForeground }]}>MARKET</Text>
          <ScrollView
            accessibilityLabel="Market filters"
            style={styles.filterScroller}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {marketFilters.map((filter) => (
              <Pressable
                key={filter.value}
                testID={`market-filter-${filter.value}`}
                accessibilityRole="button"
                accessibilityLabel={`Market: ${filter.label}`}
                accessibilityState={{ selected: selectedMarket === filter.value }}
                onPress={() => setSelectedMarket(filter.value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      selectedMarket === filter.value ? `${colors.primary}20` : colors.background,
                    borderColor:
                      selectedMarket === filter.value ? `${colors.primary}70` : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color:
                        selectedMarket === filter.value ? colors.primary : colors.mutedForeground,
                      fontWeight: selectedMarket === filter.value ? "800" : "600",
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <View
          testID="session-filter-group"
          style={[styles.filterGroup, fontScale >= 1.4 && styles.filterGroupLarge]}
        >
          <Text style={[styles.filterLabelText, { color: colors.mutedForeground }]}>SESSION</Text>
          <ScrollView
            accessibilityLabel="Session filters"
            style={styles.filterScroller}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {sessionFilters.map((filter) => (
              <Pressable
                key={filter.value}
                testID={`session-filter-${filter.value}`}
                accessibilityRole="button"
                accessibilityLabel={`Session: ${filter.label}`}
                accessibilityState={{ selected: selectedSession === filter.value }}
                onPress={() => setSelectedSession(filter.value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      selectedSession === filter.value
                        ? `${colors.secondary}85`
                        : colors.background,
                    borderColor:
                      selectedSession === filter.value ? colors.secondary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color:
                        selectedSession === filter.value
                          ? colors.secondaryForeground
                          : colors.mutedForeground,
                      fontWeight: selectedSession === filter.value ? "800" : "600",
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      {filteredSignals.length === 0 ? (
        <>
          <EmptyState
            icon={emptyState.icon}
            title={emptyState.title}
            detail={emptyState.detail}
            action={emptyState.action}
            onAction={emptyState.onAction}
          />
          <View
            testID="quiet-alert-panel"
            style={[
              styles.quietAlertPanel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.quietAlertHeader}>
              <View
                style={[
                  styles.quietAlertIcon,
                  { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}45` },
                ]}
              >
                <Feather name="bell" size={16} color={colors.primary} />
              </View>
              <View style={styles.quietAlertCopy}>
                <Text style={[styles.quietAlertTitle, { color: colors.foreground }]}>
                  Monitor a price while you wait
                </Text>
                <Text style={[styles.quietAlertDetail, { color: colors.mutedForeground }]}>
                  Price alerts track movement; they are separate from trade setups.
                </Text>
              </View>
            </View>
            {alertMarkets.length ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quietAlertMarkets}
                >
                  {alertMarkets.map((item) => {
                    const selected = selectedAlertMarket?.symbol === item.symbol;
                    return (
                      <Pressable
                        key={item.symbol}
                        testID={`quiet-alert-market-${item.symbol}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.symbol}, ${item.alerts ? "already monitored" : "ready to monitor"}`}
                        accessibilityState={{ selected }}
                        onPress={() => selectAlertMarket(item.symbol)}
                        style={[
                          styles.quietAlertMarket,
                          {
                            backgroundColor: selected ? `${colors.primary}18` : colors.secondary,
                            borderColor: selected ? `${colors.primary}60` : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quietAlertMarketSymbol,
                            { color: selected ? colors.primary : colors.foreground },
                          ]}
                        >
                          {item.symbol}
                        </Text>
                        <Text
                          style={[
                            styles.quietAlertMarketState,
                            { color: item.alerts ? colors.success : colors.mutedForeground },
                          ]}
                        >
                          {item.alerts ? "MONITORING" : "READY"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Pressable
                  testID="quiet-enable-alert"
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedAlertMarket?.alerts
                      ? `${selectedAlertMarket.symbol} is already monitored`
                      : `Enable price monitoring for ${selectedAlertMarket?.symbol}`
                  }
                  onPress={enableSelectedAlert}
                  disabled={Boolean(selectedAlertMarket?.alerts)}
                  style={({ pressed }) => [
                    styles.quietAlertAction,
                    {
                      backgroundColor: selectedAlertMarket?.alerts
                        ? `${colors.success}18`
                        : colors.primary,
                      borderColor: selectedAlertMarket?.alerts
                        ? `${colors.success}45`
                        : colors.primary,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={selectedAlertMarket?.alerts ? "check-circle" : "bell"}
                    size={15}
                    color={selectedAlertMarket?.alerts ? colors.success : colors.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.quietAlertActionText,
                      {
                        color: selectedAlertMarket?.alerts
                          ? colors.success
                          : colors.primaryForeground,
                      },
                    ]}
                  >
                    {selectedAlertMarket?.alerts
                      ? `Monitoring ${selectedAlertMarket.symbol}`
                      : `Enable monitoring for ${selectedAlertMarket?.symbol}`}
                  </Text>
                </Pressable>
                {alertConfirmation ? (
                  <Text
                    testID="quiet-alert-confirmation"
                    style={[styles.quietAlertConfirmation, { color: colors.success }]}
                  >
                    <Feather name="check" size={12} color={colors.success} /> Monitoring enabled for{" "}
                    {alertConfirmation}. This does not signal a trade or create a recommendation.
                  </Text>
                ) : null}
              </>
            ) : (
              <Pressable
                testID="quiet-open-watchlist"
                accessibilityRole="button"
                accessibilityLabel="Choose a market from your watchlist"
                onPress={() => router.push("/watchlist")}
                style={[
                  styles.quietAlertAction,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Feather name="eye" size={15} color={colors.primary} />
                <Text style={[styles.quietAlertActionText, { color: colors.primary }]}>
                  Choose a watchlist market
                </Text>
              </Pressable>
            )}
          </View>
          <EducationalPreview onMethodology={() => router.push("/legal")} />
        </>
      ) : (
        <View style={[styles.cardGrid, wide && styles.cardGridWide]}>
          {filteredSignals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              liveQuote={watchlist.find((item) => item.symbol === signal.symbol)}
              connected={mt5Connected}
              cardWidth={cardWidth}
              onPress={() => router.push(`/signal/${signal.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, minHeight: 500, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 12 },
  feedHero: {
    marginHorizontal: 18,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feedHeroLarge: { flexDirection: "column", alignItems: "stretch" },
  heroText: { flex: 1, minWidth: 0 },
  heroKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.35 },
  heroTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.55, marginTop: 5 },
  heroSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 5, maxWidth: 290 },
  heroActions: { alignItems: "center", gap: 8 },
  heroActionsLarge: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroScore: { alignItems: "center" },
  heroScoreValue: { fontSize: 22, fontWeight: "800", lineHeight: 24 },
  heroScoreLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  filterStack: { marginHorizontal: 18, marginTop: 12, gap: 8 },
  filterGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterGroupLarge: { flexDirection: "column", alignItems: "stretch" },
  filterScroller: { flex: 1 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingRight: 18 },
  filterLabelText: { width: 52, fontSize: 9, fontWeight: "800", letterSpacing: 0.65 },
  filterChip: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    justifyContent: "center",
  },
  filterText: { fontSize: 10 },
  cardGrid: { width: "100%", marginTop: 12 },
  cardGridWide: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 18, gap: 12 },
  empty: {
    marginHorizontal: 18,
    marginTop: 14,
    minHeight: 190,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", marginTop: 10 },
  emptyBody: { fontSize: 11, marginTop: 5 },
  quietAlertPanel: {
    marginHorizontal: 18,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  quietAlertHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  quietAlertIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quietAlertCopy: { flex: 1, gap: 4 },
  quietAlertTitle: { fontSize: 13, fontWeight: "800" },
  quietAlertDetail: { fontSize: 10, lineHeight: 15 },
  quietAlertMarkets: { gap: 7 },
  quietAlertMarket: {
    minWidth: 92,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  quietAlertMarketSymbol: { fontSize: 11, fontWeight: "800" },
  quietAlertMarketState: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  quietAlertAction: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  quietAlertActionText: { fontSize: 10, fontWeight: "800" },
  quietAlertConfirmation: { fontSize: 10, lineHeight: 15 },
  refreshError: { marginHorizontal: 18, marginTop: 8, fontSize: 11, lineHeight: 16 },
});
