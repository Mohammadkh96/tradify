import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PageMetadata } from "@/components/PageMetadata";
import { useColors } from "@/hooks/useColors";
import {
  Chip,
  EmptyState,
  Field,
  Header,
  ModalSheet,
  PrimaryButton,
  SecondaryButton,
  Screen,
  SectionTitle,
  StatusPill,
} from "@/components/TradifyUI";
import { useTradify } from "@/lib/tradify-store";
import { DEFAULT_ACCESS_POLICY, hasMembershipFeature } from "@/constants/membership";

export default function AlertsScreen() {
  const colors = useColors();
  const {
    alerts,
    addAlert,
    removeAlert,
    profile,
    authenticated,
    accessPolicy = DEFAULT_ACCESS_POLICY,
  } = useTradify();
  const canCreateAlerts = hasMembershipFeature(profile.membership, "priceAlerts", accessPolicy);
  const params = useLocalSearchParams<{ symbol?: string; target?: string }>();
  const [visible, setVisible] = useState(false);
  const [symbol, setSymbol] = useState("XAUUSD");
  const [target, setTarget] = useState("");
  const [condition, setCondition] = useState<"ABOVE" | "BELOW" | "EXACT">("ABOVE");
  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    if (!canCreateAlerts) return;
    if (!params.symbol && !params.target) return;
    if (params.symbol) setSymbol(String(params.symbol).toUpperCase());
    if (params.target) setTarget(String(params.target));
    setLabel(params.symbol ? `${String(params.symbol).toUpperCase()} key level` : "");
    setVisible(true);
  }, [canCreateAlerts, params.symbol, params.target]);
  const save = async () => {
    if (saving) return;
    if (!canCreateAlerts) {
      router.push("/membership");
      return;
    }
    const number = Number(target);
    if (!symbol.trim() || !Number.isFinite(number) || number <= 0 || !label.trim()) {
      setFormError(
        !symbol.trim()
          ? "Enter the market symbol."
          : !Number.isFinite(number) || number <= 0
            ? "Enter a target price greater than zero."
            : "Add a short label for this alert.",
      );
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    setSaveNotice("");
    setFormError("");
    try {
      await addAlert({
        symbol: symbol.trim().toUpperCase(),
        target: number,
        condition,
        label: label.trim(),
        active: true,
      });
      setTarget("");
      setLabel("");
      setVisible(false);
      setSaveNotice(authenticated ? "Alert saved to your account." : "Alert saved on this device.");
    } catch {
      setSaveFailed(true);
      setFormError("Alert sync failed. Your input is still here; check your connection and retry.");
    } finally {
      setSaving(false);
    }
  };
  const confirmRemove = async () => {
    if (!removeId || removing) return;
    setRemoving(true);
    setRemoveError("");
    try {
      await removeAlert(removeId);
      setRemoveId(null);
      setSaveFailed(false);
      setSaveNotice("Alert removed from your saved list.");
    } catch {
      setRemoveError("The alert could not be removed from your account. Retry shortly.");
    } finally {
      setRemoving(false);
    }
  };
  if (!canCreateAlerts) {
    return (
      <Screen>
        <PageMetadata
          title="Price alerts"
          description="Create threshold alerts for supported markets and review access details."
        />
        <Header
          eyebrow={`price alerts · ${accessPolicy.featureMinimumTiers.priceAlerts} access`}
          title="Price alerts"
        />
        <View
          testID="alerts-locked"
          style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="lock" size={22} color={colors.primary} />
          <Text
            style={[styles.lockedTitle, { color: colors.foreground }]}
          >{`Price alerts require ${accessPolicy.featureMinimumTiers.priceAlerts} access`}</Text>
          <Text style={[styles.lockedDetail, { color: colors.mutedForeground }]}>
            Your saved alert settings are kept if your plan changes. Compare plans to see which
            membership includes them.
          </Text>
          <PrimaryButton
            label="Compare plans"
            onPress={() => router.push("/membership")}
            testID="alerts-upgrade"
          />
        </View>
        <Pressable testID="alerts-back" onPress={() => router.back()} style={styles.back}>
          <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
        </Pressable>
      </Screen>
    );
  }
  return (
    <Screen>
      <PageMetadata
        title="Price alerts"
        description="Create and manage personal market price thresholds."
      />
      <Header eyebrow="server triggers · offline cache enabled" title="Price alerts" />
      <SectionTitle title="Active alerts" action="New alert" onAction={() => setVisible(true)} />
      {alerts.map((alert) => (
        <View
          key={alert.id}
          style={[styles.alert, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.alertIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="bell" size={16} color={colors.primary} />
          </View>
          <View style={styles.alertCopy}>
            <Text style={[styles.alertSymbol, { color: colors.foreground }]}>
              {alert.symbol}{" "}
              <Text style={[styles.alertTarget, { color: colors.primary }]}>
                {alert.condition.toLowerCase()} {alert.target}
              </Text>
            </Text>
            <Text style={[styles.alertLabel, { color: colors.mutedForeground }]}>
              {alert.label}
            </Text>
            <StatusPill
              label={alert.active ? "ACTIVE" : "PAUSED"}
              tone={alert.active ? "positive" : "neutral"}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${alert.symbol} alert: ${alert.label}`}
            testID={`delete-alert-${alert.id}`}
            onPress={() => setRemoveId(alert.id)}
          >
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}
      {alerts.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No price alerts yet"
          detail="Set a threshold for a market and we’ll keep it in your alert list."
          action="Create an alert"
          onAction={() => setVisible(true)}
        />
      ) : null}
      {saveNotice ? (
        <Text
          accessibilityRole={saveFailed ? "alert" : "text"}
          accessibilityLiveRegion="polite"
          style={[styles.formNotice, { color: saveFailed ? colors.warning : colors.success }]}
        >
          {saveNotice}
        </Text>
      ) : null}
      <View style={[styles.explainer, { backgroundColor: colors.accent }]}>
        <Feather name="radio" size={16} color={colors.accentForeground} />
        <Text style={[styles.explainerText, { color: colors.accentForeground }]}>
          Alerts use the same canonical symbol registry as signals. Live prices trigger first;
          reference prices keep your watch alive when live connectivity is unavailable.
        </Text>
      </View>
      <ModalSheet
        visible={visible}
        title="Create price alert"
        onClose={() => {
          setVisible(false);
          setFormError("");
        }}
      >
        <Field
          label="Symbol"
          value={symbol}
          onChangeText={setSymbol}
          placeholder="XAUUSD"
          error={formError.includes("symbol") ? formError : undefined}
          testID="alert-symbol"
        />
        <View style={styles.conditionRow}>
          {(["ABOVE", "BELOW", "EXACT"] as const).map((item) => (
            <Chip
              key={item}
              label={item}
              active={condition === item}
              onPress={() => setCondition(item)}
              icon={condition === item ? "check" : undefined}
            />
          ))}
        </View>
        <Field
          label="Target price"
          value={target}
          onChangeText={setTarget}
          placeholder="4380.00"
          keyboardType="numeric"
          error={formError.includes("target price") ? formError : undefined}
          testID="alert-target"
        />
        <Field
          label="Label"
          value={label}
          onChangeText={setLabel}
          placeholder="London continuation"
          error={formError.includes("label") ? formError : undefined}
          testID="alert-label"
        />
        {formError ? (
          <Text accessibilityRole="alert" style={[styles.formError, { color: colors.destructive }]}>
            {formError}
          </Text>
        ) : null}
        <PrimaryButton
          label={saving ? "Saving alert…" : "Save alert"}
          onPress={() => void save()}
          testID="save-alert"
          busy={saving}
        />
      </ModalSheet>
      <ModalSheet
        visible={Boolean(removeId)}
        title="Remove this alert?"
        onClose={() => {
          if (!removing) {
            setRemoveId(null);
            setRemoveError("");
          }
        }}
      >
        <Text style={[styles.alertLabel, { color: colors.mutedForeground }]}>
          Remove this threshold from your alerts? This change will sync automatically when signed in.
        </Text>
        <SecondaryButton
          label="Keep alert"
          onPress={() => setRemoveId(null)}
          testID="cancel-remove-alert"
          disabled={removing}
        />
        {removeError ? (
          <Text accessibilityRole="alert" style={[styles.formError, { color: colors.warning }]}>
            {removeError}
          </Text>
        ) : null}
        <PrimaryButton
          label={removing ? "Removing alert…" : "Remove alert"}
          onPress={() => void confirmRemove()}
          testID="confirm-remove-alert"
          busy={removing}
        />
      </ModalSheet>
      <Pressable testID="alerts-back" onPress={() => router.back()} style={styles.back}>
        <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lockedCard: {
    marginHorizontal: 18,
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 17,
    padding: 18,
    alignItems: "flex-start",
    gap: 12,
  },
  lockedTitle: { fontSize: 16, fontWeight: "800" },
  lockedDetail: { fontSize: 12, lineHeight: 18 },
  alert: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 17,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 9,
  },
  alertIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  alertCopy: { flex: 1, gap: 5 },
  alertSymbol: { fontSize: 13, fontWeight: "800" },
  alertTarget: { fontSize: 12, fontWeight: "700" },
  alertLabel: { fontSize: 11 },
  explainer: { margin: 18, padding: 14, borderRadius: 16, flexDirection: "row", gap: 9 },
  explainerText: { flex: 1, fontSize: 11, lineHeight: 17 },
  conditionRow: { flexDirection: "row", gap: 7, marginBottom: 14 },
  back: { alignItems: "center", margin: 15 },
  backText: { fontSize: 12, fontWeight: "700" },
  formError: { fontSize: 11, lineHeight: 16 },
  formNotice: { marginHorizontal: 18, marginTop: 8, fontSize: 11, lineHeight: 16 },
});
