import React, { useEffect } from "react";
import { AppState, Platform, StatusBar } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  getAuthToken,
  retryPendingAuthTokenPersistence,
  TradifyProvider,
  useTradify,
} from "@/lib/tradify-store";
import { SubscriptionProvider } from "@/lib/revenuecat";
import { useFonts } from "expo-font";
import { router, Stack, usePathname } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { brandPalette } from "@/constants/colors";
import { RISK_DISCLAIMER_VERSION } from "@/constants/risk-disclaimer";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const publicRoutes = ["/auth", "/register", "/onboarding", "/legal"];

function isPublicRoute(pathname: string) {
  return publicRoutes.some((route) => pathname === route || pathname.endsWith(route));
}
const apiBaseUrl = resolveApiBaseUrl({
  platform: Platform.OS,
  webOrigin: typeof window === "undefined" ? undefined : window.location.origin,
  configuredApiUrl: process.env.EXPO_PUBLIC_API_URL,
  configuredDomain: process.env.EXPO_PUBLIC_DOMAIN,
});
setBaseUrl(apiBaseUrl);
setAuthTokenGetter(Platform.OS === "web" ? null : getAuthToken);
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function RootLayoutNav() {
  const { authSessionChecked, authTokenPersistenceState, authenticated, profile } = useTradify();
  const pathname = usePathname();
  const onPublicRoute = isPublicRoute(pathname);
  const requiresDisclaimer =
    authenticated && profile.riskDisclaimerVersion !== RISK_DISCLAIMER_VERSION;

  useEffect(() => {
    if (!authSessionChecked) return;
    if (!authenticated && !onPublicRoute) router.replace("/auth");
  }, [authSessionChecked, authenticated, onPublicRoute]);

  useEffect(() => {
    if (requiresDisclaimer && pathname !== "/legal") {
      router.replace({ pathname: "/legal", params: { required: "1" } });
    }
  }, [pathname, requiresDisclaimer]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const openSignal = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      if (!data || typeof data.signalId !== "string" || typeof data.symbol !== "string") return;
      router.push({
        pathname: "/signal/[id]",
        params: { id: data.signalId, symbol: data.symbol },
      });
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openSignal);
    void Notifications.getLastNotificationResponseAsync().then(openSignal);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (authTokenPersistenceState !== "pending") return;

    let appIsActive = AppState.currentState === "active";
    let retryDelayMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryInProgress = false;
    let disposed = false;

    const clearRetryTimer = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
    };

    const retry = async () => {
      if (disposed || !appIsActive || retryInProgress) return;
      retryInProgress = true;
      let saved = false;
      try {
        saved = await retryPendingAuthTokenPersistence();
      } finally {
        retryInProgress = false;
      }
      if (disposed || saved || !appIsActive) return;
      retryTimer = setTimeout(() => {
        retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
        void retry();
      }, retryDelayMs);
    };

    const subscription = AppState.addEventListener("change", (state) => {
      appIsActive = state === "active";
      if (!appIsActive) {
        clearRetryTimer();
        return;
      }
      clearRetryTimer();
      retryDelayMs = 1000;
      void retry();
    });

    if (appIsActive) void retry();
    return () => {
      disposed = true;
      clearRetryTimer();
      subscription.remove();
    };
  }, [authTokenPersistenceState]);

  if (!authSessionChecked || (!authenticated && !onPublicRoute)) return null;

  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" />
      <Stack.Screen name="register" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="legal" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
    Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // The web preview can render before remote font faces finish loading. Do
  // not leave the entire route blank on web; native keeps the splash gate.
  if (!fontsLoaded && !fontError && Platform.OS !== "web") return null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={brandPalette.background} />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TradifyProvider>
            <SubscriptionProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </SubscriptionProvider>
          </TradifyProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
