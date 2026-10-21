import Feather from "@expo/vector-icons/Feather";
import { PageMetadata } from "@/components/PageMetadata";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { brandPalette } from "@/constants/colors";
import {
  Field,
  Header,
  PrimaryButton,
  Screen,
  SectionTitle,
  StatusPill,
} from "@/components/TradifyUI";
import { useTradify } from "@/lib/tradify-store";

export default function SettingsScreen() {
  const colors = useColors();
  const { authenticated, profile, updateProfile } = useTradify();
  const [name, setName] = useState(profile.name);
  const [account, setAccount] = useState(`${profile.accountSize}`);
  const [risk, setRisk] = useState(`${profile.riskPercent}`);
  const [daily, setDaily] = useState(`${profile.maxDailyLoss}`);
  const [aggressive, setAggressive] = useState(profile.aggressive);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const nameError = name.trim() ? undefined : "Enter a display name.";
  const accountError =
    Number.isFinite(Number(account)) && Number(account) > 0
      ? undefined
      : "Enter a positive account size.";
  const riskError =
    Number.isFinite(Number(risk)) && Number(risk) > 0
      ? undefined
      : "Enter a risk value greater than zero.";
  const dailyError =
    Number.isFinite(Number(daily)) && Number(daily) > 0
      ? undefined
      : "Enter a daily-loss value greater than zero.";
  const save = async () => {
    if (saving) return;
    if (
      !name.trim() ||
      !Number.isFinite(Number(account)) ||
      Number(account) <= 0 ||
      !Number.isFinite(Number(risk)) ||
      Number(risk) <= 0 ||
      !Number.isFinite(Number(daily)) ||
      Number(daily) <= 0
    ) {
      setSaveFailed(true);
      setSaveMessage("Enter a name and valid positive values for each account and risk field.");
      return;
    }
    setSaving(true);
    setSaveMessage("");
    setSaveFailed(false);
    try {
      await updateProfile({
        name: name.trim(),
        accountSize: Number(account),
        riskPercent: Number(risk),
        maxDailyLoss: Number(daily),
        aggressive,
      });
      setSaveMessage(
        authenticated
          ? "Preferences saved to your account."
          : "Preferences saved on this device. Sign in to sync them to your account.",
      );
    } catch {
      setSaveFailed(true);
      setSaveMessage("Preferences could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen>
      <PageMetadata
        title="Risk preferences"
        description="Manage account preferences and personal risk-planning defaults."
      />
      <Header eyebrow="profile · guardrails" title="Risk preferences" />
      <View style={[styles.identityNote, { backgroundColor: colors.accent }]}>
        <Feather name="user" size={16} color={colors.accentForeground} />
        <Text style={[styles.noteText, { color: colors.accentForeground }]}>
          These settings shape the calculator and your risk controls. They do not change market data
          or level availability.
        </Text>
      </View>
      <SectionTitle title="Trader profile" />
      <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Field
          label="Display name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setSaveMessage("");
          }}
          error={nameError}
          testID="settings-name"
        />
        <Field
          label="Account size"
          value={account}
          onChangeText={setAccount}
          keyboardType="numeric"
          error={accountError}
          testID="settings-account"
        />
      </View>
      <SectionTitle title="Risk guardrails" />
      <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Field
          label="Risk per trade %"
          value={risk}
          onChangeText={setRisk}
          keyboardType="numeric"
          error={riskError}
          testID="settings-risk"
        />
        <Field
          label="Max daily loss %"
          value={daily}
          onChangeText={setDaily}
          keyboardType="numeric"
          error={dailyError}
          testID="settings-daily-loss"
        />
        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.switchTitle, { color: colors.foreground }]}>
              Allow aggressive setups
            </Text>
            <Text style={[styles.switchSub, { color: colors.mutedForeground }]}>
              Show extended entries marked as chasing risk
            </Text>
          </View>
          <Switch
            testID="aggressive-switch"
            accessibilityLabel="Allow aggressive setups"
            accessibilityHint="Show extended entries marked as chasing risk"
            value={aggressive}
            onValueChange={setAggressive}
            trackColor={{ false: colors.secondary, true: colors.primary }}
            thumbColor={colors.foreground}
          />
        </View>
      </View>
      <PrimaryButton
        label={saving ? "Saving…" : "Save preferences"}
        onPress={save}
        testID="save-preferences"
        icon="check"
        disabled={saving}
        busy={saving}
      />
      {saveMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole={saveFailed ? "alert" : "text"}
          style={[styles.saveMessage, { color: saveFailed ? colors.warning : colors.success }]}
        >
          {saveMessage}
        </Text>
      ) : null}
      <SectionTitle title="Legal" />
      <Pressable
        testID="settings-legal"
        accessibilityRole="button"
        accessibilityLabel="Open legal information and risk disclaimer"
        onPress={() => router.push("/legal")}
        style={[styles.auth, { borderColor: colors.border }]}
      >
        <Text style={[styles.authText, { color: colors.foreground }]}>
          Terms, policies & risk disclaimer
        </Text>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
      <Pressable
        testID="settings-auth"
        accessibilityRole="button"
        accessibilityLabel={authenticated ? "Review account sign-in status" : "Sign in to sync"}
        onPress={() => router.push("/auth")}
        style={[styles.auth, { borderColor: colors.border }]}
      >
        <Text style={[styles.authText, { color: colors.foreground }]}>Manage sign-in state</Text>
        <StatusPill
          label={authenticated ? "ACCOUNT CONNECTED" : "LOCAL ONLY"}
          tone={authenticated ? "positive" : "warning"}
        />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityNote: {
    marginHorizontal: 18,
    padding: 16,
    borderRadius: 20,
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: brandPalette.border,
  },
  noteText: { flex: 1, fontSize: 11, lineHeight: 17 },
  form: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 22,
    padding: 17,
    marginBottom: 3,
    elevation: 1,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 4,
  },
  switchTitle: { fontSize: 13, fontWeight: "800" },
  switchSub: { fontSize: 10, marginTop: 4, maxWidth: 240 },
  auth: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 17,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authText: { fontSize: 12, fontWeight: "700" },
  saveMessage: { marginHorizontal: 20, marginTop: 10, fontSize: 12, lineHeight: 18 },
});
