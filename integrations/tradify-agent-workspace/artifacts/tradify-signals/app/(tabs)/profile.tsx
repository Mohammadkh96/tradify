import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { exportUserData } from "@workspace/api-client-react";
import { brandPalette, designTokens } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import {
  Header,
  ModalSheet,
  PrimaryButton,
  Screen,
  SectionTitle,
  SecondaryButton,
  StatusPill,
  SurfaceCard,
} from "@/components/TradifyUI";
import { PageMetadata } from "@/components/PageMetadata";
import { useTradify } from "@/lib/tradify-store";

export default function ProfileScreen() {
  const colors = useColors();
  const {
    authenticated,
    profile,
    mt5Connected,
    authTokenPersistenceState,
    retryAuthTokenPersistence,
    signOut,
    deleteAccount,
  } = useTradify();
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [retryingTokenSave, setRetryingTokenSave] = useState(false);
  const [deletionVisible, setDeletionVisible] = useState(false);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const [accountActionMessage, setAccountActionMessage] = useState("");
  const [accountActionFailed, setAccountActionFailed] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const retryTokenSave = async () => {
    if (retryingTokenSave) return;
    setRetryingTokenSave(true);
    try {
      const saved = await retryAuthTokenPersistence();
      setAccountActionFailed(!saved);
      setAccountActionMessage(
        saved
          ? "Your session is now saved securely on this device."
          : "Secure device storage is still unavailable. Keep this app open and try again.",
      );
    } catch {
      setAccountActionFailed(true);
      setAccountActionMessage("Secure device storage is unavailable. Try again shortly.");
    } finally {
      setRetryingTokenSave(false);
    }
  };
  const switchAccount = async () => {
    if (!authenticated) {
      router.push("/auth");
      return;
    }
    if (switchingAccount) return;
    setSwitchingAccount(true);
    setAccountActionMessage("");
    try {
      await signOut();
      router.replace("/auth");
    } catch {
      setAccountActionFailed(true);
      setAccountActionMessage("We could not end the session. Check your connection and try again.");
    } finally {
      setSwitchingAccount(false);
    }
  };
  const items = [
    [
      "bar-chart-2",
      "Performance analytics",
      "Win rate, expectancy and session edge",
      "/performance",
    ],
    ["bell", "Notifications & alerts", "Manage local signal notifications", "/notifications"],
    [
      "crosshair",
      "Risk preferences",
      `${profile.riskPercent}% risk · ${profile.maxTrades} max trades`,
      "/settings",
    ],
    [
      "credit-card",
      "Membership",
      `${profile.membership} plan · unlock deeper history`,
      "/membership",
    ],
    ["file-text", "Data information", "How market information is handled", "/legal"],
  ] as const;
  return (
    <Screen>
      <PageMetadata
        title="Your account"
        description="Review account connection, membership access, and personal settings."
      />
      <Header eyebrow="account & preferences" title="Profile" />
      <SurfaceCard style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
            {profile.name.slice(0, 1)}
          </Text>
        </View>
        <View style={styles.identity}>
          <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
          <Text style={[styles.email, { color: colors.mutedForeground }]}>{profile.email}</Text>
          <View style={styles.pillRow}>
            <StatusPill
              label={`${profile.membership.toUpperCase()} MEMBER`}
              tone={profile.membership === "Free" ? "warning" : "positive"}
            />
          </View>
        </View>
        <Pressable
          testID="edit-profile"
          onPress={() => router.push("/settings")}
          style={styles.editButton}
        >
          <Feather name="edit-2" size={17} color={colors.mutedForeground} />
        </Pressable>
      </SurfaceCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={authenticated ? "Log out of Tradify" : "Sign in to Tradify"}
        testID={authenticated ? "profile-logout" : "profile-sign-in"}
        disabled={switchingAccount}
        onPress={switchAccount}
        style={({ pressed }) => [
          styles.switchAccount,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            opacity: pressed || switchingAccount ? 0.7 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.switchIcon,
            { backgroundColor: authenticated ? `${colors.destructive}18` : `${colors.primary}18` },
          ]}
        >
          <Feather
            name={authenticated ? "log-out" : "log-in"}
            size={16}
            color={authenticated ? colors.destructive : colors.primary}
          />
        </View>
        <View style={styles.switchCopy}>
          <Text style={[styles.switchTitle, { color: colors.foreground }]}>
            {switchingAccount ? "Logging out…" : authenticated ? "Log out" : "Sign in"}
          </Text>
          <Text style={[styles.switchDetail, { color: colors.mutedForeground }]}>
            {authenticated
              ? "End this session on this device"
              : "Use your Tradify email and password"}
          </Text>
        </View>
        <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
      </Pressable>
      {accountActionMessage ? (
        <Text
          accessibilityRole={accountActionFailed ? "alert" : "text"}
          accessibilityLiveRegion="polite"
          style={[
            styles.accountActionMessage,
            { color: accountActionFailed ? colors.warning : colors.success },
          ]}
        >
          {accountActionMessage}
        </Text>
      ) : null}
      {authenticated && authTokenPersistenceState === "pending" ? (
        <SurfaceCard
          style={[
            styles.tokenWarning,
            { backgroundColor: `${colors.warning}16`, borderColor: `${colors.warning}55` },
          ]}
        >
          <Feather name="alert-circle" size={17} color={colors.warning} />
          <View style={styles.tokenWarningCopy}>
            <Text style={[styles.connectionTitle, { color: colors.foreground }]}>
              Session active, not saved yet
            </Text>
            <Text style={[styles.connectionDetail, { color: colors.mutedForeground }]}>
              Tradify is retrying secure device storage. If it remains unavailable when you close
              the app, you may need to sign in again.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            testID="retry-token-save"
            disabled={retryingTokenSave}
            onPress={() => void retryTokenSave()}
          >
            <Text style={[styles.retryTokenSave, { color: colors.primary }]}>
              {retryingTokenSave ? "Saving…" : "Retry"}
            </Text>
          </Pressable>
        </SurfaceCard>
      ) : null}
      {authenticated && authTokenPersistenceState === "memory-only" ? (
        <SurfaceCard
          style={[
            styles.tokenWarning,
            { backgroundColor: `${colors.warning}16`, borderColor: `${colors.warning}55` },
          ]}
        >
          <Feather name="alert-circle" size={17} color={colors.warning} />
          <View style={styles.tokenWarningCopy}>
            <Text style={[styles.connectionTitle, { color: colors.foreground }]}>
              Browser session is temporary
            </Text>
            <Text style={[styles.connectionDetail, { color: colors.mutedForeground }]}>
              For security, this browser keeps your session in memory only. You will need to sign in
              again after closing or refreshing the page.
            </Text>
          </View>
        </SurfaceCard>
      ) : null}
      <SurfaceCard style={styles.connection}>
        <View style={styles.connectionIcon}>
          <Feather
            name="activity"
            size={17}
            color={mt5Connected ? colors.success : colors.warning}
          />
        </View>
        <View style={styles.connectionCopy}>
          <Text style={[styles.connectionTitle, { color: colors.foreground }]}>
            Market connection
          </Text>
          <Text style={[styles.connectionDetail, { color: colors.mutedForeground }]}>
            {mt5Connected
              ? "Connected · live prices available"
              : "Syncing · reference prices may be shown"}
          </Text>
        </View>
        <StatusPill
          label={mt5Connected ? "LIVE FEED" : "REFERENCE"}
          tone={mt5Connected ? "positive" : "warning"}
        />
      </SurfaceCard>
      <SectionTitle title="Tradify Products" />
      <SurfaceCard testID="profile-tradify-products" style={styles.productsCard}>
        <View
          testID="profile-journal-row"
          accessibilityLabel="Tradify Journal. Destination pending confirmation."
          style={styles.productRow}
        >
          <View style={[styles.productIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="file-text" size={16} color={colors.primary} />
          </View>
          <View style={styles.productCopy}>
            <Text style={[styles.menuTitle, { color: colors.foreground }]}>Tradify Journal</Text>
            <Text style={[styles.menuDetail, { color: colors.mutedForeground }]}>
              A trading journal for recording and reviewing activity.
            </Text>
            <Text style={[styles.menuDetail, styles.productSeparation, { color: colors.mutedForeground }]}>
              Sign in to Journal and Signals separately. Accounts and subscriptions are separate.
            </Text>
          </View>
        </View>
        <View style={[styles.productStatus, { borderTopColor: colors.border }]}>
          <View style={[styles.productStatusDot, { backgroundColor: colors.primary }]} />
          <Text
            testID="profile-journal-destination-status"
            accessibilityRole="text"
            style={[styles.productStatusText, { color: colors.primary }]}
          >
            Destination pending confirmation
          </Text>
        </View>
      </SurfaceCard>
      <Pressable
        testID="profile-manage-journal-link"
        accessibilityRole="button"
        onPress={() => router.push("/journal-link" as never)}
        style={[styles.productStatus, { borderColor: colors.border, borderWidth: 1, borderRadius: 12, marginTop: 8 }]}
      >
        <Feather name="link" size={16} color={colors.primary} />
        <Text style={[styles.productStatusText, { color: colors.foreground }]}>Review consent and link status</Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </Pressable>
      <SectionTitle title="Workspace" />
      <SurfaceCard style={styles.menu}>
        {items.map(([icon, title, detail, href]) => (
          <Pressable
            key={title}
            testID={`profile-${title}`}
            onPress={() => router.push(href)}
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
              <Feather
                name={icon as keyof typeof Feather.glyphMap}
                size={16}
                color={colors.primary}
              />
            </View>
            <View style={styles.menuCopy}>
              <Text style={[styles.menuTitle, { color: colors.foreground }]}>{title}</Text>
              <Text style={[styles.menuDetail, { color: colors.mutedForeground }]}>{detail}</Text>
            </View>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </SurfaceCard>
      {authenticated ? (
        <>
        <Pressable
          testID="profile-export-data"
          accessibilityRole="button"
          disabled={exportBusy}
          onPress={async () => {
            if (exportBusy) return;
            setExportBusy(true);
            setExportMessage("");
            try {
              const data = await exportUserData();
              const json = JSON.stringify(data, null, 2);
              if (Platform.OS === "web") {
                const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = "tradify-signals-data-export.json";
                link.click();
                URL.revokeObjectURL(url);
              } else {
                await Share.share({
                  title: "Tradify Signals data export",
                  message: json,
                });
              }
              setExportMessage("Your account data export is ready.");
            } catch {
              setExportMessage("We could not export your data. Check your connection and try again.");
            } finally {
              setExportBusy(false);
            }
          }}
          style={[styles.deleteCard, { borderColor: colors.border, opacity: exportBusy ? 0.65 : 1 }]}
        >
          <View style={styles.deleteCardContent}>
            <View style={[styles.deleteIcon, { backgroundColor: `${colors.primary}18` }]}>
              <Feather name="download" size={16} color={colors.primary} />
            </View>
            <View style={styles.switchCopy}>
              <Text style={[styles.switchTitle, { color: colors.foreground }]}>
                {exportBusy ? "Preparing export…" : "Export my data"}
              </Text>
              <Text style={[styles.switchDetail, { color: colors.mutedForeground }]}>
                Download or share a JSON copy of your account data
              </Text>
            </View>
            <Feather name="chevron-right" size={17} color={colors.primary} />
          </View>
        </Pressable>
        {exportMessage ? (
          <Text
            testID="profile-export-status"
            accessibilityLiveRegion="polite"
            style={[styles.menuDetail, { color: colors.mutedForeground, marginHorizontal: 22 }]}
          >
            {exportMessage}
          </Text>
        ) : null}
        <SurfaceCard
          testID="profile-delete-account"
          onPress={() => {
            setDeletionError("");
            setDeletionVisible(true);
          }}
          style={[styles.deleteCard, { borderColor: `${colors.destructive}55` }]}
        >
          <View style={styles.deleteCardContent}>
            <View style={[styles.deleteIcon, { backgroundColor: `${colors.destructive}18` }]}>
              <Feather name="user-x" size={16} color={colors.destructive} />
            </View>
            <View style={styles.switchCopy}>
              <Text style={[styles.switchTitle, { color: colors.destructive }]}>
                Delete account
              </Text>
              <Text style={[styles.switchDetail, { color: colors.mutedForeground }]}>
                Permanently clear your Tradify account and workspace data
              </Text>
            </View>
            <Feather name="chevron-right" size={17} color={colors.destructive} />
          </View>
        </SurfaceCard>
        </>
      ) : null}
      <Pressable
        testID="open-onboarding"
        onPress={() => router.push({ pathname: "/onboarding", params: { returnTo: "profile" } })}
        style={[styles.onboardingLink, { borderColor: colors.border }]}
      >
        <Feather name="compass" size={16} color={colors.primary} />
        <Text style={[styles.onboardingText, { color: colors.foreground }]}>
          Replay the guided setup
        </Text>
      </Pressable>
      <ModalSheet
        visible={deletionVisible}
        title="Delete account permanently"
        onClose={() => {
          if (!deletionBusy) setDeletionVisible(false);
        }}
      >
        <Text style={[styles.modalLead, { color: colors.foreground }]}>This cannot be undone.</Text>
        <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
          Your profile, preferences, watchlists, alerts, notifications, trade journal, membership
          access, and active sessions will be cleared. The account identifier will be anonymized.
        </Text>
        <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
          Apple App Store and Google Play subscriptions are separate. Deleting this account does not
          cancel a store subscription; cancel it in the relevant store account settings.
        </Text>
        {deletionError ? (
          <Text
            testID="account-deletion-error"
            style={[styles.modalError, { color: colors.destructive }]}
          >
            {deletionError}
          </Text>
        ) : null}
        <SecondaryButton
          label="Keep my account"
          onPress={() => setDeletionVisible(false)}
          testID="cancel-account-deletion"
        />
        <PrimaryButton
          label={deletionBusy ? "Deleting account…" : "Confirm permanent deletion"}
          onPress={async () => {
            if (deletionBusy) return;
            setDeletionBusy(true);
            setDeletionError("");
            try {
              await deleteAccount();
              setDeletionVisible(false);
              router.replace("/auth");
            } catch {
              setDeletionError(
                "The account could not be deleted right now. Your account is unchanged; try again.",
              );
            } finally {
              setDeletionBusy(false);
            }
          }}
          testID="confirm-account-deletion"
        />
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    marginHorizontal: designTokens.spacing.screen,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: designTokens.radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 25, fontWeight: "800" },
  editButton: {
    width: designTokens.sizes.touchTarget,
    height: designTokens.sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: { flex: 1, gap: designTokens.spacing.xs },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: designTokens.spacing.sm },
  name: {
    fontSize: designTokens.typography.section,
    fontWeight: designTokens.typography.strong,
    letterSpacing: -0.3,
  },
  email: { fontSize: designTokens.typography.meta },
  connection: {
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.section,
    flexDirection: "row",
    alignItems: "center",
  },
  connectionIcon: {
    width: 38,
    height: 38,
    borderRadius: designTokens.radii.control,
    backgroundColor: `${brandPalette.teal}1F`,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionCopy: { flex: 1 },
  connectionTitle: {
    fontSize: designTokens.typography.label,
    fontWeight: designTokens.typography.strong,
  },
  connectionDetail: {
    fontSize: designTokens.typography.caption,
    lineHeight: 16,
    marginTop: designTokens.spacing.xs,
  },
  connectionAction: {
    fontSize: designTokens.typography.meta,
    fontWeight: designTokens.typography.strong,
  },
  productsCard: {
    marginHorizontal: designTokens.spacing.screen,
    padding: 0,
    overflow: "hidden",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.md,
    paddingHorizontal: designTokens.spacing.card,
    paddingVertical: designTokens.spacing.md,
    minHeight: 76,
  },
  productIcon: {
    width: 38,
    height: 38,
    borderRadius: designTokens.radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  productCopy: { flex: 1, minWidth: 0 },
  productSeparation: { marginTop: designTokens.spacing.xs },
  productStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.sm,
    borderTopWidth: 1,
    paddingHorizontal: designTokens.spacing.card,
    paddingVertical: designTokens.spacing.md,
  },
  productStatusDot: { width: 6, height: 6, borderRadius: designTokens.radii.pill },
  productStatusText: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.semibold,
  },
  tokenWarning: {
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  tokenWarningCopy: { flex: 1 },
  retryTokenSave: {
    fontSize: designTokens.typography.meta,
    fontWeight: designTokens.typography.strong,
  },
  accountActionMessage: {
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.sm,
    fontSize: designTokens.typography.caption,
    lineHeight: 16,
  },
  menu: { marginHorizontal: designTokens.spacing.screen, padding: 0, gap: 0, overflow: "hidden" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: designTokens.spacing.card,
    borderBottomWidth: 1,
    gap: designTokens.spacing.md,
    minHeight: 68,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: designTokens.radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCopy: { flex: 1 },
  menuTitle: {
    fontSize: designTokens.typography.label,
    fontWeight: designTokens.typography.strong,
  },
  menuDetail: { fontSize: designTokens.typography.caption, marginTop: 3 },
  switchAccount: {
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.section,
    borderWidth: 1,
    borderRadius: designTokens.radii.card,
    padding: designTokens.spacing.card,
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.md,
    minHeight: 68,
  },
  switchIcon: {
    width: 38,
    height: 38,
    borderRadius: designTokens.radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  switchCopy: { flex: 1 },
  switchTitle: {
    fontSize: designTokens.typography.label,
    fontWeight: designTokens.typography.bold,
  },
  switchDetail: { fontSize: designTokens.typography.caption, marginTop: 3 },
  onboardingLink: {
    margin: designTokens.spacing.screen,
    borderWidth: 1,
    borderRadius: designTokens.radii.card,
    padding: designTokens.spacing.card,
    flexDirection: "row",
    gap: designTokens.spacing.md,
    alignItems: "center",
    minHeight: designTokens.sizes.touchTarget,
  },
  onboardingText: {
    fontSize: designTokens.typography.label,
    fontWeight: designTokens.typography.bold,
  },
  deleteCard: {
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.md,
    padding: 0,
  },
  deleteCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: designTokens.spacing.md,
    minHeight: 68,
    padding: designTokens.spacing.card,
  },
  deleteIcon: {
    width: 38,
    height: 38,
    borderRadius: designTokens.radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  modalLead: {
    fontSize: designTokens.typography.body,
    fontWeight: designTokens.typography.strong,
    marginBottom: designTokens.spacing.md,
  },
  modalBody: {
    fontSize: designTokens.typography.label,
    lineHeight: 18,
    marginBottom: designTokens.spacing.md,
  },
  modalError: {
    fontSize: designTokens.typography.label,
    lineHeight: 18,
    fontWeight: designTokens.typography.bold,
    marginBottom: designTokens.spacing.md,
  },
});
