import Feather from "@expo/vector-icons/Feather";
import { Link, Stack } from "expo-router";
import { PageMetadata } from "@/components/PageMetadata";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function NotFoundScreen() {
  const colors = useColors();

  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <PageMetadata
        title="Page not found"
        description="That address does not point to a Tradify Signals screen."
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.symbol,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="compass" size={21} color={colors.primary} />
          <Text style={[styles.code, { color: colors.primary }]}>404</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
          This route has moved.
        </Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]}>
          That address does not point to a Signals screen. Your account and saved data are unchanged.
        </Text>
        <Link
          href="/"
          accessibilityRole="link"
          accessibilityLabel="Return to market opportunities"
          style={[styles.link, { backgroundColor: colors.primary }]}
        >
          <Feather name="arrow-left" size={16} color={colors.primaryForeground} />
          <Text style={[styles.linkText, { color: colors.primaryForeground }]}>
            Back to opportunities
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    minHeight: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  symbol: {
    minWidth: 78,
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  code: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: 23, fontSize: 21, fontWeight: "800", textAlign: "center" },
  detail: { maxWidth: 350, marginTop: 8, fontSize: 12, lineHeight: 18, textAlign: "center" },
  link: {
    minHeight: 46,
    marginTop: 19,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  linkText: { fontSize: 12, fontWeight: "800" },
});
