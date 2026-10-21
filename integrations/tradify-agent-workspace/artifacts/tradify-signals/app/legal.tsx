import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import { PageMetadata } from "@/components/PageMetadata";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { brandPalette } from "@/constants/colors";
import { Header, PrimaryButton, Screen, SectionTitle } from "@/components/TradifyUI";
import { useTradify } from "@/lib/tradify-store";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  RISK_DISCLAIMER_SECTIONS,
  RISK_DISCLAIMER_TITLE,
  RISK_DISCLAIMER_VERSION,
} from "@/constants/risk-disclaimer";

export default function LegalScreen() {
  const colors = useColors();
  const { authenticated, profile, acknowledgeRiskDisclaimer } = useTradify();
  const params = useLocalSearchParams<{ required?: string | string[] }>();
  const requiresAcknowledgement =
    authenticated && profile.riskDisclaimerVersion !== RISK_DISCLAIMER_VERSION;
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledgementMessage, setAcknowledgementMessage] = useState("");
  const [opening, setOpening] = useState("");
  const [linkStatus, setLinkStatus] = useState("");
  const legalBaseUrl = resolveApiBaseUrl({
    platform: Platform.OS,
    webOrigin: typeof window === "undefined" ? undefined : window.location.origin,
    configuredApiUrl: process.env.EXPO_PUBLIC_API_URL,
    configuredDomain: process.env.EXPO_PUBLIC_DOMAIN,
  }).replace(/\/+$/u, "");
  const configuredLegalUrls = Constants.expoConfig?.extra?.legalUrls as
    | Record<string, string>
    | undefined;
  const openExternalPage = async (url: string, label: string) => {
    if (opening) return;
    setOpening(label);
    setLinkStatus("");
    try {
      await WebBrowser.openBrowserAsync(url);
      setLinkStatus(`${label} opened in your browser.`);
    } catch {
      try {
        await Linking.openURL(url);
        setLinkStatus(`${label} opened in your browser.`);
      } catch {
        setLinkStatus(
          `Could not open ${label.toLowerCase()}. Check your connection and try again.`,
        );
      }
    } finally {
      setOpening("");
    }
  };
  const openLegalPage = (path: string, label: string) => {
    const configuredKey = path === "privacy"
      ? "privacyPolicy"
      : path === "account-deletion"
        ? "accountDeletion"
        : path;
    const configuredUrl = configuredLegalUrls?.[configuredKey];
    void openExternalPage(
      configuredUrl || `${legalBaseUrl}/api/legal/${path}`,
      label,
    );
  };

  return (
    <Screen>
      <PageMetadata
        title="Market data and boundaries"
        description="Review privacy, service terms, account deletion instructions, and market-data limitations."
        indexable
      />
      <Header eyebrow="market data & boundaries" title="Data information" />
      <View style={[styles.notice, { backgroundColor: colors.accent }]}>
        <Feather name="info" size={17} color={colors.accentForeground} />
        <Text style={[styles.noticeText, { color: colors.accentForeground }]}>
          Tradify Signals provides market information and decision support, not financial advice.
          Always validate prices and execution conditions before acting.
        </Text>
      </View>
      <SectionTitle title="How market information is handled" />
      {[
        [
          "01",
          "Current data first",
          "Opportunities are shown only when market information meets the required quality checks.",
        ],
        [
          "02",
          "Reference prices are labeled",
          "When current information is unavailable, reference prices remain clearly separate and level availability stays blocked.",
        ],
        [
          "03",
          "Levels stay disciplined",
          "Entry, stop, and target levels remain unavailable until the data is ready to review.",
        ],
        [
          "04",
          "Your data is yours",
          "Export account data or permanently delete your account from Profile.",
        ],
      ].map(([number, title, detail]) => (
        <View key={number} style={styles.item}>
          <Text style={[styles.number, { color: colors.primary }]}>{number}</Text>
          <View style={styles.itemCopy}>
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>{title}</Text>
            <Text style={[styles.itemDetail, { color: colors.mutedForeground }]}>{detail}</Text>
          </View>
        </View>
      ))}
      <View
        style={[styles.legalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.legalTitle, { color: colors.foreground }]}>{RISK_DISCLAIMER_TITLE}</Text>
        <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
          Version {RISK_DISCLAIMER_VERSION}
        </Text>
        {RISK_DISCLAIMER_SECTIONS.map((section) => (
          <View key={section.heading} style={styles.disclaimerSection}>
            <Text style={[styles.disclaimerHeading, { color: colors.foreground }]}>
              {section.heading}
            </Text>
            <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
              {section.body}
            </Text>
          </View>
        ))}
        {profile.riskDisclaimerVersion && profile.riskDisclaimerAcceptedAt ? (
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
            Acknowledged version {profile.riskDisclaimerVersion} on{" "}
            {new Date(profile.riskDisclaimerAcceptedAt).toLocaleString()}.
          </Text>
        ) : null}
        {requiresAcknowledgement ? (
          <View style={styles.acknowledgement}>
            <Text style={[styles.legalText, { color: colors.warning }]}>
              {params.required === "1"
                ? "Review and acknowledge this updated disclaimer to continue using the app."
                : "Your account needs to acknowledge the current disclaimer."}
            </Text>
            <PrimaryButton
              label={acknowledging ? "Saving acknowledgement…" : "I acknowledge"}
              icon="check"
              busy={acknowledging}
              disabled={acknowledging}
              testID="risk-disclaimer-acknowledge"
              onPress={() => {
                if (acknowledging) return;
                setAcknowledging(true);
                setAcknowledgementMessage("");
                void acknowledgeRiskDisclaimer()
                  .then(() => setAcknowledgementMessage("Acknowledgement saved to your account."))
                  .catch(() =>
                    setAcknowledgementMessage(
                      "Could not save your acknowledgement. Check your connection and try again.",
                    ),
                  )
                  .finally(() => setAcknowledging(false));
              }}
            />
            {acknowledgementMessage ? (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole={
                  acknowledgementMessage.startsWith("Could") ? "alert" : "text"
                }
                style={[styles.legalText, { color: colors.mutedForeground }]}
              >
                {acknowledgementMessage}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <View
        style={[styles.policyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.legalTitle, { color: colors.foreground }]}>
          Policies and account requests
        </Text>
        <Text style={[styles.policyText, { color: colors.mutedForeground }]}>
          Read how Tradify handles account data and subscriptions, or request account deletion,
          before using the service.
        </Text>
        <Pressable
          testID="privacy-policy-link"
          accessibilityRole="link"
          accessibilityLabel="Open Privacy Policy"
          disabled={Boolean(opening)}
          onPress={() => openLegalPage("privacy", "Privacy Policy")}
          style={[styles.policyLink, { borderColor: colors.border }]}
        >
          <Feather name="external-link" size={14} color={colors.primary} />
          <Text style={[styles.policyLinkText, { color: colors.primary }]}>Privacy Policy</Text>
        </Pressable>
        <Pressable
          testID="terms-of-service-link"
          accessibilityRole="link"
          accessibilityLabel="Open Terms of Service"
          disabled={Boolean(opening)}
          onPress={() => openLegalPage("terms", "Terms of Service")}
          style={[styles.policyLink, { borderColor: colors.border }]}
        >
          <Feather name="external-link" size={14} color={colors.primary} />
          <Text style={[styles.policyLinkText, { color: colors.primary }]}>Terms of Service</Text>
        </Pressable>
        <Pressable
          testID="support-link"
          accessibilityRole="link"
          accessibilityLabel="Open support page"
          disabled={Boolean(opening)}
          onPress={() => openLegalPage("support", "Support")}
          style={[styles.policyLink, { borderColor: colors.border }]}
        >
          <Feather name="help-circle" size={14} color={colors.primary} />
          <Text style={[styles.policyLinkText, { color: colors.primary }]}>Support</Text>
        </Pressable>
        <Pressable
          testID="account-deletion-link"
          accessibilityRole="link"
          accessibilityLabel="Open account deletion instructions"
          disabled={Boolean(opening)}
          onPress={() => openLegalPage("account-deletion", "Account deletion instructions")}
          style={[styles.policyLink, { borderColor: colors.border }]}
        >
          <Feather name="user-x" size={14} color={colors.primary} />
          <Text style={[styles.policyLinkText, { color: colors.primary }]}>Account deletion</Text>
        </Pressable>
        {opening || linkStatus ? (
          <Text
            accessibilityRole={linkStatus.startsWith("Could not") ? "alert" : "text"}
            accessibilityLiveRegion="polite"
            style={[
              styles.linkStatus,
              {
                color: linkStatus.startsWith("Could not") ? colors.warning : colors.mutedForeground,
              },
            ]}
          >
            {opening ? `Opening ${opening}…` : linkStatus}
          </Text>
        ) : null}
      </View>
      <Pressable testID="legal-back" onPress={() => router.back()} style={styles.back}>
        <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginHorizontal: 18,
    padding: 16,
    borderRadius: 20,
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: brandPalette.border,
  },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 17 },
  item: { flexDirection: "row", paddingHorizontal: 18, paddingVertical: 15, gap: 15 },
  number: { fontSize: 14, fontWeight: "900", width: 28 },
  itemCopy: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "800" },
  itemDetail: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  legalCard: { margin: 18, padding: 17, borderWidth: 1, borderRadius: 20 },
  legalTitle: { fontSize: 13, fontWeight: "800" },
  legalText: { fontSize: 11, lineHeight: 17, marginTop: 6 },
  disclaimerSection: { marginTop: 12 },
  disclaimerHeading: { fontSize: 12, fontWeight: "800" },
  acknowledgement: { marginTop: 12, gap: 8 },
  policyCard: {
    marginHorizontal: 18,
    marginBottom: 4,
    padding: 17,
    borderWidth: 1,
    borderRadius: 20,
  },
  policyText: { fontSize: 11, lineHeight: 17, marginTop: 6 },
  policyLink: {
    minHeight: 42,
    marginTop: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  policyLinkText: { fontSize: 12, fontWeight: "800" },
  back: { alignItems: "center", margin: 10 },
  backText: { fontSize: 12, fontWeight: "700" },
  linkStatus: { fontSize: 11, lineHeight: 16, marginTop: 10 },
});
