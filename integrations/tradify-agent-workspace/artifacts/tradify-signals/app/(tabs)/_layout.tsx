import React from "react";
import { Platform, StyleSheet, useColorScheme, useWindowDimensions, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import Feather from "@expo/vector-icons/Feather";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { designTokens } from "@/constants/colors";

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "safari", selected: "safari.fill" }} />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="watchlist">
        <NativeTabs.Trigger.Icon sf={{ default: "eye", selected: "eye.fill" }} />
        <NativeTabs.Trigger.Label>Watchlist</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trades">
        <NativeTabs.Trigger.Icon sf={{ default: "shield", selected: "shield.fill" }} />
        <NativeTabs.Trigger.Label>Trades</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="performance">
        <NativeTabs.Trigger.Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <NativeTabs.Trigger.Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <NativeTabs.Trigger.Label>Alerts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { width } = useWindowDimensions();
  const webTabInset = width > 712 ? (width - 680) / 2 : 16;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: isWeb ? webTabInset : designTokens.tabBar.inset,
          right: isWeb ? webTabInset : designTokens.tabBar.inset,
          width: isWeb && width > 712 ? 680 : undefined,
          bottom: designTokens.tabBar.bottom,
          height: isWeb ? designTokens.tabBar.webHeight : designTokens.tabBar.height,
          borderRadius: designTokens.radii.tabBar,
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          borderWidth: isWeb ? 1 : 0,
          borderColor: colors.border,
          paddingTop: designTokens.spacing.xs,
          elevation: 0,
        },
        tabBarItemStyle: {
          borderRadius: designTokens.radii.tabBarItem,
          marginHorizontal: designTokens.spacing.xxs,
        },
        tabBarLabelStyle: {
          fontSize: designTokens.typography.meta,
          fontWeight: designTokens.typography.bold,
          marginBottom: designTokens.spacing.xxs,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.card, borderRadius: designTokens.radii.tabBar },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Explore",
          tabBarAccessibilityLabel: "Opportunities",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="safari" tintColor={color} size={24} />
            ) : (
              <Feather name="compass" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: "Watchlist",
          tabBarAccessibilityLabel: "Watchlist",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="eye" tintColor={color} size={22} />
            ) : (
              <Feather name="eye" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: "Trades",
          tabBarAccessibilityLabel: "Active trades",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="shield" tintColor={color} size={22} />
            ) : (
              <Feather name="shield" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="performance"
        options={{
          title: "Stats",
          tabBarAccessibilityLabel: "Performance",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar" tintColor={color} size={22} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarAccessibilityLabel: "Alerts",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="bell" tintColor={color} size={22} />
            ) : (
              <Feather name="bell" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen name="lab" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
