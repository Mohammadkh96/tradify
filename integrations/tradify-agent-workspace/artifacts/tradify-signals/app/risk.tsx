import Feather from "@expo/vector-icons/Feather";
import { PageMetadata } from "@/components/PageMetadata";
import { customFetch, getMarketQuotes, type MarketQuote } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Field, Header, Screen, SectionTitle, SecondaryButton } from "@/components/TradifyUI";
import { useTradify } from "@/lib/tradify-store";

type DisplayInstrumentSpec = { contractSize: number; pointSize: number; quoteCurrency: string };
type CustomerBrokerSpecification = {
  contractSize?: number | null;
  point?: number | null;
  quoteCurrency?: string | null;
  volumeMin?: number | null;
  volumeMax?: number | null;
  volumeStep?: number | null;
};
type CustomerCatalogItem = {
  symbol: string;
  name: string;
  assetClass: string;
  digits: number;
  riskSpec?: CustomerBrokerSpecification | null;
  sizingStatus?: string;
  currentPrice: number;
  bid: number;
  ask: number;
  quoteState: string;
  accessible: boolean;
  strategySupported: boolean;
};
type QuotesBySymbol = Record<string, MarketQuote>;
type SizingStatus = "READY" | "REVIEW_REQUIRED";

// These values are intentionally display-only. They keep the form readable
// while the broker specification is loading, but never enter the calculation.
function displayInstrumentSpec(symbol?: string): DisplayInstrumentSpec {
  if (symbol?.includes("JPY"))
    return { contractSize: 100000, pointSize: 0.01, quoteCurrency: "JPY" };
  if (symbol === "XAUUSD") return { contractSize: 100, pointSize: 0.01, quoteCurrency: "USD" };
  if (symbol === "XAGUSD") return { contractSize: 5000, pointSize: 0.001, quoteCurrency: "USD" };
  if (symbol === "USOIL") return { contractSize: 1000, pointSize: 0.01, quoteCurrency: "USD" };
  if (symbol === "BTCUSD" || symbol === "ETHUSD")
    return { contractSize: 1, pointSize: 0.01, quoteCurrency: "USD" };
  if (
    symbol &&
    ["EURUSD", "GBPUSD", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF", "EURGBP"].includes(symbol)
  ) {
    return {
      contractSize: 100000,
      pointSize: 0.0001,
      quoteCurrency: symbol === "EURGBP" ? "GBP" : symbol.slice(3),
    };
  }
  return { contractSize: 1, pointSize: 1, quoteCurrency: "USD" };
}

function isForexSymbol(symbol?: string): boolean {
  return Boolean(
    symbol &&
    [
      "EURUSD",
      "GBPUSD",
      "AUDUSD",
      "NZDUSD",
      "USDCAD",
      "USDCHF",
      "EURGBP",
      "EURJPY",
      "GBPJPY",
      "AUDJPY",
      "USDJPY",
    ].includes(symbol),
  );
}

function positive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function liveQuoteFor(symbol: string, quotes: QuotesBySymbol): MarketQuote | undefined {
  const quote = quotes[symbol];
  return quote?.dataState === "LIVE" && positive(quote.price) ? quote : undefined;
}

function currencyConversionRate(
  fromCurrency: string,
  toCurrency: string,
  catalog: CustomerCatalogItem[],
  quotes: QuotesBySymbol,
): number | null {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!from || !to) return null;
  if (from === to) return 1;

  const edges = new Map<string, Array<{ currency: string; rate: number }>>();
  const addEdge = (source: string, destination: string, rate: number) => {
    if (!positive(rate)) return;
    const list = edges.get(source) ?? [];
    list.push({ currency: destination, rate });
    edges.set(source, list);
  };

  for (const item of catalog) {
    if (item.assetClass !== "FOREX") continue;
    const quote = liveQuoteFor(item.symbol, quotes);
    if (!quote) continue;
    const baseCurrency = item.symbol.slice(0, 3);
    const quoteCurrency =
      item.riskSpec?.quoteCurrency?.trim().toUpperCase() || item.symbol.slice(3, 6);
    if (baseCurrency.length !== 3 || quoteCurrency.length !== 3) continue;
    addEdge(baseCurrency, quoteCurrency, quote.price);
    addEdge(quoteCurrency, baseCurrency, 1 / quote.price);
  }

  const pending: Array<{ currency: string; rate: number }> = [{ currency: from, rate: 1 }];
  const visited = new Set([from]);
  while (pending.length) {
    const current = pending.shift()!;
    if (current.currency === to) return current.rate;
    for (const edge of edges.get(current.currency) ?? []) {
      if (visited.has(edge.currency)) continue;
      visited.add(edge.currency);
      pending.push({ currency: edge.currency, rate: current.rate * edge.rate });
    }
  }
  return null;
}

function brokerSpecCompleteness(spec?: CustomerBrokerSpecification | null): {
  status: SizingStatus;
  reason: string;
} {
  const missing: string[] = [];
  if (!positive(spec?.contractSize)) missing.push("contract size");
  if (!spec?.quoteCurrency?.trim()) missing.push("quote currency");
  if (!positive(spec?.volumeStep)) missing.push("volume step");
  return missing.length
    ? { status: "REVIEW_REQUIRED", reason: "Complete market specifications are unavailable." }
    : { status: "READY", reason: "Complete market specifications received." };
}

export default function RiskScreen() {
  const colors = useColors();
  const { profile } = useTradify();
  const params = useLocalSearchParams<{
    symbol?: string;
    entry?: string;
    stop?: string;
    price?: string;
  }>();
  const [account, setAccount] = useState(`${profile?.accountSize ?? 10000}`);
  const [risk, setRisk] = useState(`${profile?.riskPercent ?? 0.5}`);
  const [currency, setCurrency] = useState("USD");
  const [entry, setEntry] = useState(params.entry || "");
  const [stop, setStop] = useState(params.stop || "");
  const [catalog, setCatalog] = useState<CustomerCatalogItem[]>([]);
  const [quotes, setQuotes] = useState<QuotesBySymbol>({});
  const [metadataLoading, setMetadataLoading] = useState(Boolean(params.symbol));
  const [metadataError, setMetadataError] = useState(false);
  const [metadataRetry, setMetadataRetry] = useState(0);
  const symbol = params.symbol ? String(params.symbol).toUpperCase() : undefined;
  const fallbackSpec = useMemo(() => displayInstrumentSpec(symbol), [symbol]);
  const catalogItem = catalog.find((item) => item.symbol === symbol);
  const brokerSpec = catalogItem?.riskSpec;
  const brokerCompleteness = brokerSpecCompleteness(brokerSpec);
  const brokerReady =
    brokerCompleteness.status === "READY" && catalogItem?.sizingStatus === "READY";
  const liveSpot = symbol ? liveQuoteFor(symbol, quotes)?.price : undefined;
  const currentSpot = liveSpot ?? params.price ?? "";
  const stopUnit = isForexSymbol(symbol) ? "pips" : "points";

  useEffect(() => {
    let active = true;
    setMetadataLoading(true);
    setMetadataError(false);
    Promise.all([customFetch<CustomerCatalogItem[]>("/api/markets/catalog"), getMarketQuotes()])
      .then(([nextCatalog, quoteResponse]) => {
        if (!active) return;
        setCatalog(nextCatalog.filter((item) => item.accessible && item.strategySupported));
        setQuotes(quoteResponse.quotes);
      })
      .catch(() => {
        if (active) {
          setCatalog([]);
          setQuotes({});
          setMetadataError(true);
        }
      })
      .finally(() => {
        if (active) setMetadataLoading(false);
      });
    return () => {
      active = false;
    };
  }, [symbol, metadataRetry]);

  const accountInputError =
    Number.isFinite(Number(account)) && Number(account) > 0
      ? undefined
      : "Enter a positive account balance.";
  const riskInputError =
    Number.isFinite(Number(risk)) && Number(risk) > 0
      ? undefined
      : "Enter a risk percentage greater than zero.";
  const entryInputError =
    Number.isFinite(Number(entry)) && Number(entry) > 0
      ? undefined
      : "Enter an entry price greater than zero.";
  const stopInputError =
    Number.isFinite(Number(stop)) && Number(stop) > 0
      ? Number(entry) === Number(stop)
        ? "Entry and stop must be different."
        : undefined
      : "Enter a stop price greater than zero.";

  const calculation = useMemo(() => {
    const accountValue = Number(account) || 0;
    const riskValue = Number(risk) || 0;
    const entryValue = Number(entry) || 0;
    const stopValue = Number(stop) || 0;
    const riskCash = (accountValue * riskValue) / 100;
    const priceDistance = Math.abs(entryValue - stopValue);
    const pipSize = symbol?.includes("JPY") ? 0.01 : 0.0001;
    const stopDistance =
      priceDistance /
      (isForexSymbol(symbol)
        ? pipSize
        : positive(brokerSpec?.point)
          ? brokerSpec.point
          : fallbackSpec.pointSize);
    const conversionRate = brokerSpec?.quoteCurrency
      ? currencyConversionRate(brokerSpec.quoteCurrency, currency, catalog, quotes)
      : null;
    const quoteRiskPerLot = positive(brokerSpec?.contractSize)
      ? priceDistance * brokerSpec.contractSize
      : 0;
    const accountRiskPerLot = positive(conversionRate) ? quoteRiskPerLot * conversionRate : 0;
    const rawLotSize = accountRiskPerLot > 0 ? riskCash / accountRiskPerLot : 0;
    const step = brokerSpec?.volumeStep ?? 0;
    const steppedLotSize = step > 0 ? Math.floor((rawLotSize + step * 1e-9) / step) * step : 0;
    const cappedLotSize = positive(brokerSpec?.volumeMax)
      ? Math.min(steppedLotSize, brokerSpec.volumeMax)
      : steppedLotSize;
    const belowMinimum =
      positive(cappedLotSize) &&
      positive(brokerSpec?.volumeMin) &&
      cappedLotSize < brokerSpec.volumeMin;
    const reasons: string[] = [];
    if (!brokerReady) reasons.push(brokerCompleteness.reason);
    if (brokerReady && conversionRate === null)
      reasons.push("A live currency conversion is unavailable.");
    if (belowMinimum) reasons.push("The calculated size is below the allowed minimum.");
    const status: SizingStatus =
      reasons.length || !positive(accountRiskPerLot) || !positive(priceDistance)
        ? "REVIEW_REQUIRED"
        : "READY";
    const lotSize = status === "READY" ? cappedLotSize : 0;
    return {
      riskCash,
      stopDistance,
      conversionRate,
      lotSize,
      totalRisk: lotSize * accountRiskPerLot,
      status,
      reviewReason:
        reasons[0] ?? "Enter a valid account balance, risk percentage, and stop distance.",
    };
  }, [
    account,
    risk,
    entry,
    stop,
    currency,
    symbol,
    brokerSpec,
    brokerReady,
    brokerCompleteness.reason,
    catalog,
    quotes,
    fallbackSpec.pointSize,
  ]);

  const sizingStatus = metadataLoading
    ? "SYNCING"
    : calculation.status === "READY"
      ? "READY"
      : "REVIEW";
  return (
    <Screen>
      <PageMetadata
        title="Risk calculator"
        description="Review planning inputs and market-data readiness before considering position sizing."
      />
      <Header eyebrow="protect the downside first" title="Risk calculator" />
      {symbol ? (
        <View
          style={[styles.context, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="crosshair" size={15} color={colors.success} />
          <Text style={[styles.contextText, { color: colors.foreground }]}>
            Prefilled from <Text style={{ fontWeight: "900" }}>{symbol}</Text> opportunity
          </Text>
        </View>
      ) : null}
      <View
        testID="risk-sizing-state"
        style={[
          styles.review,
          {
            backgroundColor:
              sizingStatus === "READY" ? `${colors.success}14` : `${colors.warning}16`,
            borderColor: sizingStatus === "READY" ? `${colors.success}55` : `${colors.warning}65`,
          },
        ]}
      >
        <Feather
          name={sizingStatus === "READY" ? "check-circle" : "alert-triangle"}
          size={16}
          color={sizingStatus === "READY" ? colors.success : colors.warning}
        />
        <View style={styles.reviewCopy}>
          <Text
            style={[
              styles.reviewTitle,
              { color: sizingStatus === "READY" ? colors.success : colors.warning },
            ]}
          >
            {sizingStatus === "SYNCING"
              ? "SIZING DATA SYNCING"
              : sizingStatus === "READY"
                ? "POSITION SIZE READY"
                : "POSITION SIZE REVIEW"}
          </Text>
          <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>
            {sizingStatus === "SYNCING"
              ? "Loading the market and account information needed for this estimate."
              : calculation.status === "READY"
                ? "Lots are rounded to an allowed volume increment and converted into the selected account currency."
                : `${calculation.reviewReason} No precise lot recommendation is shown.`}
          </Text>
        </View>
      </View>
      {metadataError ? (
        <View style={[styles.metadataError, { borderColor: colors.warning }]}>
          <Text
            accessibilityRole="alert"
            style={[styles.metadataErrorText, { color: colors.warning }]}
          >
            Market specifications could not be loaded. Sizing stays in review until verified data is available.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry market specification loading"
            onPress={() => setMetadataRetry((attempt) => attempt + 1)}
            style={styles.metadataRetry}
          >
            <Text style={[styles.metadataRetryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={[styles.callout, { backgroundColor: colors.accent }]}>
        <Feather name="shield" size={17} color={colors.accentForeground} />
        <Text style={[styles.calloutText, { color: colors.accentForeground }]}>
          {calculation.status === "READY"
            ? "This is a planning estimate. Confirm margin, spread and execution conditions before sending an order."
            : "Complete market information is still syncing. Review the inputs before relying on a lot size."}
        </Text>
      </View>
      <SectionTitle title="Position inputs" />
      <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Field
          label="Account balance"
          value={account}
          onChangeText={setAccount}
          keyboardType="numeric"
          error={accountInputError}
          testID="risk-account"
        />
        <Field
          label="Risk per trade %"
          value={risk}
          onChangeText={setRisk}
          keyboardType="numeric"
          error={riskInputError}
          testID="risk-percent"
        />
        <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>ACCOUNT CURRENCY</Text>
        <View style={styles.currencyRow}>
          {["USD", "EUR", "GBP"].map((item) => (
            <Pressable
              key={item}
              testID={`risk-currency-${item}`}
              accessibilityRole="radio"
              accessibilityLabel={`Account currency ${item}`}
              accessibilityState={{ selected: currency === item }}
              onPress={() => setCurrency(item)}
              style={[
                styles.currencyButton,
                {
                  backgroundColor: currency === item ? colors.primary : colors.secondary,
                  borderColor: currency === item ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.currencyText,
                  { color: currency === item ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="Entry / gate price"
          value={entry}
          onChangeText={setEntry}
          keyboardType="numeric"
          error={entryInputError}
          testID="risk-entry"
        />
        <Field
          label="Stop loss price"
          value={stop}
          onChangeText={setStop}
          keyboardType="numeric"
          error={stopInputError}
          testID="risk-stop"
        />
      </View>
      <SectionTitle title="Auto-filled signal parameters" />
      <View style={[styles.metadata, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.metadataItem}>
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>CURRENT SPOT</Text>
          <View style={styles.metadataValueWrap}>
            <Text style={[styles.metadataValue, { color: colors.foreground }]}>
              {Number(currentSpot)
                ? Number(currentSpot).toFixed(symbol?.includes("JPY") ? 3 : 2)
                : "—"}
            </Text>
            <Text
              style={[styles.sourceText, { color: liveSpot ? colors.success : colors.warning }]}
            >
              {liveSpot ? "LIVE PRICE" : params.price ? "REFERENCE PRICE" : "UNAVAILABLE"}
            </Text>
          </View>
        </View>
        <View style={styles.metadataItem}>
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>CONTRACT SIZE</Text>
          <View style={styles.metadataValueWrap}>
            <Text style={[styles.metadataValue, { color: colors.foreground }]}>
              {(brokerSpec?.contractSize ?? fallbackSpec.contractSize).toLocaleString()}{" "}
              {brokerSpec?.quoteCurrency ?? fallbackSpec.quoteCurrency}
            </Text>
            <Text
              style={[
                styles.sourceText,
                { color: brokerSpec?.contractSize ? colors.success : colors.warning },
              ]}
            >
              {brokerSpec?.contractSize ? "VERIFIED" : "ESTIMATE"}
            </Text>
          </View>
        </View>
        <View style={styles.metadataItem}>
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>STOP DISTANCE</Text>
          <Text style={[styles.metadataValue, { color: colors.foreground }]}>
            {Number.isFinite(calculation.stopDistance) ? calculation.stopDistance.toFixed(1) : "—"}{" "}
            {stopUnit}
          </Text>
        </View>
        <View style={styles.metadataItem}>
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
            CURRENCY CONVERSION
          </Text>
          <Text style={[styles.metadataValue, { color: colors.foreground }]}>
            {calculation.conversionRate
              ? `${brokerSpec?.quoteCurrency} → ${currency} · ${calculation.conversionRate.toFixed(5)}`
              : "REVIEW REQUIRED"}
          </Text>
        </View>
      </View>
      <SectionTitle title="Sizing result" />
      <View style={[styles.result, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>MAX CASH RISK</Text>
          <Text style={[styles.resultValue, { color: colors.primary }]}>
            {currency} {calculation.riskCash.toFixed(2)}
          </Text>
        </View>
        <View>
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
            RECOMMENDED LOTS
          </Text>
          <Text
            style={[
              styles.resultValue,
              { color: calculation.status === "READY" ? colors.success : colors.warning },
            ]}
          >
            {calculation.status === "READY" ? calculation.lotSize.toFixed(2) : "—"}
          </Text>
        </View>
        <View>
          <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>TOTAL AT RISK</Text>
          <Text
            style={[
              styles.resultValue,
              { color: calculation.status === "READY" ? colors.destructive : colors.warning },
            ]}
          >
            {calculation.status === "READY"
              ? `${currency} ${calculation.totalRisk.toFixed(2)}`
              : "—"}
          </Text>
        </View>
      </View>
      <View style={styles.formula}>
        <Text style={[styles.formulaTitle, { color: colors.foreground }]}>
          The math stays visible
        </Text>
        <Text style={[styles.formulaText, { color: colors.mutedForeground }]}>
          Position exposure = price move × contract size. Account exposure is converted into the
          selected currency, then rounded to an allowed lot increment.
        </Text>
      </View>
      <SecondaryButton
        label="Back to signal"
        onPress={() => router.back()}
        testID="risk-back"
        icon="arrow-left"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  context: {
    marginHorizontal: 18,
    marginBottom: 10,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contextText: { fontSize: 11 },
  review: {
    marginHorizontal: 18,
    marginBottom: 10,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
  },
  reviewCopy: { flex: 1 },
  reviewTitle: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  reviewText: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  callout: { marginHorizontal: 18, padding: 14, borderRadius: 16, flexDirection: "row", gap: 9 },
  calloutText: { flex: 1, fontSize: 11, lineHeight: 17 },
  form: { marginHorizontal: 18, borderWidth: 1, borderRadius: 18, padding: 14 },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  currencyRow: { flexDirection: "row", gap: 8, marginBottom: 13 },
  currencyButton: {
    minWidth: 58,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  currencyText: { fontSize: 11, fontWeight: "800" },
  metadata: { marginHorizontal: 18, borderWidth: 1, borderRadius: 18, padding: 14, gap: 13 },
  metadataItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  metadataValueWrap: { alignItems: "flex-end" },
  metadataValue: { fontSize: 14, fontWeight: "800", fontFamily: "monospace", textAlign: "right" },
  sourceText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.45, marginTop: 3 },
  result: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  resultValue: { fontSize: 18, fontWeight: "800", marginTop: 7 },
  formula: { marginHorizontal: 18, paddingVertical: 16 },
  formulaTitle: { fontSize: 13, fontWeight: "800" },
  formulaText: { fontSize: 11, lineHeight: 17, marginTop: 5 },
  metadataError: {
    marginHorizontal: 18,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metadataErrorText: { flex: 1, fontSize: 10, lineHeight: 15 },
  metadataRetry: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  metadataRetryText: { fontSize: 11, fontWeight: "800" },
});
