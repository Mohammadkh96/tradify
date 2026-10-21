import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import {
  customFetch,
  getGetUserNotificationPreferencesQueryKey,
  useGetUserNotificationPreferences,
  useUpdateUserNotificationPreferences,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { designTokens } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { EmptyState, Header, Screen, SurfaceCard } from "@/components/TradifyUI";
import { PageMetadata } from "@/components/PageMetadata";
import { useTradify } from "@/lib/tradify-store";
import { registerNativePushToken, revokeNativePushToken } from "@/lib/native-push";

type NotificationPreferences = {
  newSignals: boolean;
  entries: boolean;
  takeProfits: boolean;
  stopLosses: boolean;
  breakevenAndChanges: boolean;
  watchlistPriceAlerts: boolean;
  announcements: boolean;
};

const defaultPreferences: NotificationPreferences = {
  newSignals: false,
  entries: false,
  takeProfits: false,
  stopLosses: false,
  breakevenAndChanges: false,
  watchlistPriceAlerts: false,
  announcements: false,
};

function decodeVapidKey(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export default function NotificationsScreen() {
  const colors = useColors();
  const {
    authenticated,
    profile,
    signals,
    notifications,
    notificationSyncState,
    markNotificationRead,
    markAllNotificationsRead,
  } = useTradify();
  const queryClient = useQueryClient();
  const preferencesQuery = useGetUserNotificationPreferences({
    query: {
      enabled: authenticated,
      queryKey: getGetUserNotificationPreferencesQueryKey(),
    },
  });
  const updatePreferencesMutation = useUpdateUserNotificationPreferences();
  const [actionNotice, setActionNotice] = useState("");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [nativePushUserId, setNativePushUserId] = useState<string | null>(null);
  const nativePushEnabled = nativePushUserId === profile.id;
  const allRead = notifications.length > 0 && notifications.every((item) => item.isRead);

  useEffect(() => {
    if (preferencesQuery.data) {
      setPreferences({ ...defaultPreferences, ...preferencesQuery.data, watchlistPriceAlerts: false });
    }
  }, [preferencesQuery.data]);

  useEffect(() => {
    if (preferencesQuery.isError) {
      setActionNotice("Notification preferences could not be loaded.");
    }
  }, [preferencesQuery.isError]);

  useEffect(() => {
    if (!authenticated || (Platform.OS !== "ios" && Platform.OS !== "android")) return;
    let cancelled = false;
    void (async () => {
      try {
        const permission = await Notifications.getPermissionsAsync();
        const projectId =
          Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
        if (!permission.granted || typeof projectId !== "string" || !projectId) {
          return;
        }
        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerNativePushToken(profile.id, token.data);
        if (!cancelled) setNativePushUserId(profile.id);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, profile.id]);

  useEffect(() => {
    if (Platform.OS === "web" && "serviceWorker" in navigator && "PushManager" in window) {
      void navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setPushEnabled(Boolean(subscription)))
        .catch(() => setPushEnabled(false));
    }
  }, [authenticated]);

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (key === "watchlistPriceAlerts" && value) return;
    const previous = preferences;
    const next = { ...previous, [key]: value };
    setPreferences(next);
    try {
      const saved = await updatePreferencesMutation.mutateAsync({
        data: { [key]: value },
      });
      const normalized = { ...defaultPreferences, ...saved, watchlistPriceAlerts: false };
      setPreferences(normalized);
      queryClient.setQueryData(preferencesQuery.queryKey, normalized);
    } catch {
      setPreferences(previous);
      setActionNotice("Preference update failed. Please try again.");
    }
  };

  const enableNativePush = async () => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    const projectId =
      Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== "string" || !projectId) {
      setActionNotice("Native push needs the real Expo project ID in app.json before this device can register.");
      return;
    }
    setPushBusy(true);
    setActionNotice("");
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("signal-alerts", {
          name: "Signal alerts",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Allow notifications in your device settings to receive signal alerts.");
      }
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerNativePushToken(profile.id, token.data);
      setNativePushUserId(profile.id);
      setActionNotice("This device is registered for signal alerts.");
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Native push registration failed.");
    } finally {
      setPushBusy(false);
    }
  };

  const disableNativePush = async () => {
    setPushBusy(true);
    setActionNotice("");
    try {
      await revokeNativePushToken(profile.id);
      setNativePushUserId(null);
      setActionNotice("Signal alerts are disabled for this device.");
    } catch {
      setActionNotice("Could not revoke this device's signal alerts. Check your connection and try again.");
    } finally {
      setPushBusy(false);
    }
  };

  const enableWebPush = async () => {
    if (Platform.OS !== "web" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setActionNotice("Web Push is not supported by this browser.");
      return;
    }
    setPushBusy(true);
    setActionNotice("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Browser notification permission was not granted.");
      const { publicKey } = await customFetch<{ publicKey: string }>("/api/user/web-push/public-key");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey) as BufferSource,
      });
      await customFetch("/api/user/web-push/subscriptions", {
        method: "PUT",
        body: JSON.stringify(subscription),
      });
      setPushEnabled(true);
      setActionNotice("This browser is registered for Tradify Web Push.");
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "Web Push registration failed.");
    } finally {
      setPushBusy(false);
    }
  };

  const disableWebPush = async () => {
    if (Platform.OS !== "web" || !("serviceWorker" in navigator)) return;
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await customFetch("/api/user/web-push/subscriptions/current", {
          method: "DELETE",
          body: JSON.stringify({ endpoint }),
        });
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
      setActionNotice("Browser push is disabled for this installation.");
    } catch {
      setActionNotice("Could not disable browser push for this installation.");
    } finally {
      setPushBusy(false);
    }
  };

  const markRead = (item: (typeof notifications)[number]) => {
    void markNotificationRead(item.id);
    const signal = signals.find(
      (candidate) => candidate.id === item.signalId || candidate.symbol === item.symbol,
    );
    if (signal) router.push(`/signal/${signal.id}`);
  };
  const markAllRead = () => {
    if (allRead) return;
    setActionNotice("");
    void markAllNotificationsRead();
    setActionNotice(
      authenticated
        ? "Read state updated. Account sync status is shown above."
        : "Read state saved on this device.",
    );
  };

  const syncColor =
    notificationSyncState === "offline"
      ? colors.warning
      : notificationSyncState === "synced"
        ? colors.success
        : colors.primary;
  const syncIcon =
    notificationSyncState === "offline"
      ? "wifi-off"
      : notificationSyncState === "local"
        ? "smartphone"
        : notificationSyncState === "synced"
          ? "check-circle"
          : "refresh-cw";
  const syncLabel =
    notificationSyncState === "offline"
      ? "Offline · showing saved alerts"
      : notificationSyncState === "local"
        ? authenticated
          ? "Saved locally · sign in to sync history"
          : "Local preview · sign in to sync history"
        : notificationSyncState === "synced"
          ? "Synced across devices"
          : "Loading notification history";

  return (
    <Screen>
      <PageMetadata
        title="Notifications"
        description="Review market alerts and their account synchronization status."
      />
      <Header eyebrow="decision inbox · actionable changes only" title="Alerts" />
      <SurfaceCard
        style={[
          styles.banner,
          { backgroundColor: colors.card, borderColor: `${colors.primary}40` },
        ]}
      >
        <View style={styles.bannerIdentity}>
          <View
            style={[
              styles.bannerIcon,
              { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}45` },
            ]}
          >
            <Feather name="bell" size={20} color={colors.primary} />
          </View>
          <View style={styles.bannerCopy}>
            <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
              Signal Notification Center
            </Text>
            <Text style={[styles.bannerSubtitle, { color: colors.mutedForeground }]}>
              Action-changing alerts only — no marketing spam or unvalidated updates.
            </Text>
          </View>
        </View>
        <Pressable
          testID="mark-all-read"
          accessibilityRole="button"
          accessibilityState={{ disabled: allRead }}
          disabled={allRead}
          onPress={markAllRead}
          style={[
            styles.markButton,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.markText, { color: colors.secondaryForeground }]}>
            {allRead ? "All Read" : "Mark All Read"}
          </Text>
        </Pressable>
      </SurfaceCard>
      {authenticated ? (
        <SurfaceCard style={[styles.preferenceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.preferenceHeading, { color: colors.foreground }]}>Notification preferences</Text>
          {([
            ["newSignals", "New validated signals"],
            ["entries", "Entry triggered"],
            ["takeProfits", "Take-profit targets"],
            ["stopLosses", "Stop-loss events"],
            ["breakevenAndChanges", "Breakeven and signal changes"],
            ["announcements", "Account announcements"],
          ] as const).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="switch"
              accessibilityState={{ checked: preferences[key] }}
              onPress={() => void updatePreference(key, !preferences[key])}
              style={styles.preferenceRow}
            >
              <Text style={[styles.preferenceLabel, { color: colors.secondaryForeground }]}>{label}</Text>
              <Feather name={preferences[key] ? "check-circle" : "circle"} size={20} color={preferences[key] ? colors.primary : colors.mutedForeground} />
            </Pressable>
          ))}
          <View style={[styles.preferenceRow, { opacity: 0.55 }]}>
            <Text style={[styles.preferenceLabel, { color: colors.mutedForeground }]}>Watchlist price alerts · not verified</Text>
            <Feather name="lock" size={16} color={colors.mutedForeground} />
          </View>
          {Platform.OS === "web" ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={pushBusy}
                onPress={() => void (pushEnabled ? disableWebPush() : enableWebPush())}
                style={[styles.pushButton, { backgroundColor: colors.primary, opacity: pushBusy || pushEnabled ? 0.65 : 1 }]}
              >
                {pushBusy ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
                <Text style={[styles.pushButtonText, { color: colors.primaryForeground }]}>
                  {pushEnabled ? "Disable browser push" : "Enable browser push"}
                </Text>
              </Pressable>
              <Text style={[styles.pushNote, { color: colors.mutedForeground }]}>
                Browser and device settings affect alert delivery; check the in-app history for saved notifications.
              </Text>
            </>
          ) : null}
          {Platform.OS === "ios" || Platform.OS === "android" ? (
            <Pressable
              testID="native-push-toggle"
              accessibilityRole="button"
              disabled={pushBusy}
              onPress={() => void (nativePushEnabled ? disableNativePush() : enableNativePush())}
              style={[
                styles.pushButton,
                { backgroundColor: colors.primary, opacity: pushBusy ? 0.65 : 1 },
              ]}
            >
              {pushBusy ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
              <Text style={[styles.pushButtonText, { color: colors.primaryForeground }]}>
                {nativePushEnabled ? "Disable device alerts" : "Enable device alerts"}
              </Text>
            </Pressable>
          ) : null}
        </SurfaceCard>
      ) : null}
      {actionNotice ? (
        <Text
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          style={[styles.actionNotice, { color: colors.success }]}
        >
          {actionNotice}
        </Text>
      ) : null}
      <View
        testID="notification-sync-status"
        style={[
          styles.syncStatus,
          { backgroundColor: `${syncColor}12`, borderColor: `${syncColor}35` },
        ]}
      >
        {notificationSyncState === "loading" ? (
          <ActivityIndicator size="small" color={syncColor} />
        ) : (
          <Feather name={syncIcon as keyof typeof Feather.glyphMap} size={13} color={syncColor} />
        )}
        <Text style={[styles.syncText, { color: syncColor }]}>{syncLabel}</Text>
      </View>

      {notificationSyncState === "loading" && notifications.length === 0 ? (
        <View testID="notifications-loading" style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading notification history
          </Text>
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell-off"
          title="No Action-Changing Notifications"
          detail="Validated setup events and status changes will appear here."
        />
      ) : (
        <View style={styles.list}>
          {notifications.map((notification) => (
            <Pressable
              key={notification.id}
              testID={`notification-${notification.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${notification.isRead ? "Read" : "Unread"} alert from ${notification.symbol}: ${notification.title}`}
              accessibilityHint="Open the related signal and mark this alert as read"
              accessibilityState={{ selected: notification.isRead }}
              onPress={() => markRead(notification)}
              style={[
                styles.notification,
                {
                  backgroundColor: notification.isRead ? colors.card : `${colors.success}12`,
                  borderColor: notification.isRead ? colors.border : `${colors.success}55`,
                  opacity: notification.isRead ? 0.82 : 1,
                },
              ]}
            >
              <View style={styles.notificationTop}>
                <View style={styles.notificationTitle}>
                  <Text style={[styles.title, { color: colors.foreground }]}>
                    {notification.title}
                  </Text>
                  <Text
                    style={[
                      styles.symbol,
                      { color: colors.secondaryForeground, backgroundColor: colors.secondary },
                    ]}
                  >
                    {notification.symbol}
                  </Text>
                </View>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>
                  <Feather name="clock" size={11} color={colors.mutedForeground} />{" "}
                  {notification.timeLabel}
                </Text>
              </View>
              <Text style={[styles.message, { color: colors.secondaryForeground }]}>
                {notification.message}
              </Text>
              {notification.actionRequired ? (
                <View
                  style={[
                    styles.action,
                    { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}45` },
                  ]}
                >
                  <Text style={[styles.actionText, { color: colors.primary }]}>
                    Action: {notification.actionRequired}
                  </Text>
                  <Feather name="arrow-right" size={14} color={colors.primary} />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preferenceCard: { marginHorizontal: designTokens.spacing.screen, marginBottom: 12, gap: 8 },
  preferenceHeading: { fontSize: designTokens.typography.body, fontWeight: designTokens.typography.strong },
  preferenceRow: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  preferenceLabel: { flex: 1, fontSize: designTokens.typography.meta },
  pushButton: { minHeight: 42, marginTop: 6, borderRadius: designTokens.radii.control, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pushButtonText: { fontSize: designTokens.typography.meta, fontWeight: designTokens.typography.strong },
  pushNote: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  banner: {
    marginHorizontal: designTokens.spacing.screen,
    gap: designTokens.spacing.section,
    elevation: 2,
  },
  bannerIdentity: { flexDirection: "row", alignItems: "center", gap: 11 },
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
  actionNotice: {
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.sm,
    fontSize: designTokens.typography.caption,
    lineHeight: 16,
  },
  markButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 11,
  },
  markText: { fontSize: designTokens.typography.caption, fontWeight: designTokens.typography.bold },
  syncStatus: {
    marginHorizontal: designTokens.spacing.screen,
    marginTop: designTokens.spacing.md,
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    minHeight: 36,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  syncText: { fontSize: designTokens.typography.caption, fontWeight: designTokens.typography.bold },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    gap: designTokens.spacing.md,
    padding: 60,
  },
  loadingText: { fontSize: designTokens.typography.label },
  list: { gap: designTokens.spacing.md, marginTop: designTokens.spacing.section },
  notification: {
    marginHorizontal: designTokens.spacing.screen,
    borderWidth: 1,
    borderRadius: designTokens.radii.card,
    padding: designTokens.spacing.card,
    gap: designTokens.spacing.md,
    elevation: 1,
  },
  notificationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  title: { fontSize: designTokens.typography.body, fontWeight: designTokens.typography.strong },
  symbol: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: designTokens.radii.tight,
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
  },
  time: { fontSize: designTokens.typography.micro },
  message: { fontSize: designTokens.typography.caption, lineHeight: 17 },
  action: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: designTokens.radii.control,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionText: {
    fontSize: designTokens.typography.micro,
    fontWeight: designTokens.typography.strong,
  },
});
