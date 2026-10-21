import { useColorScheme } from "react-native";
import colors, { designTokens } from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius` and the shared visual tokens.
 *
 * Signals currently keeps its provisional dark navy, gold, and teal palette
 * across the app, so both system appearance settings resolve to the same
 * semantic colors. This does not define the parent Tradify design system.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, ...designTokens, radius: colors.radius };
}
