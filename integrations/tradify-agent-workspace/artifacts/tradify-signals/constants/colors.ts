/**
 * Tradify Signals' provisional navy, gold, and teal visual language.
 * Auth, onboarding, app surfaces, and embedded charts use this palette.
 */
export const brandPalette = {
  // Signals currently aligns with the sibling Admin's dark tokens. This is
  // not a finalized parent Tradify design-system decision.
  background: "#191F29",
  surface: "#1F2732",
  raised: "#28313E",
  mutedSurface: "#28313E",
  border: "#36404E",
  input: "#28313E",
  text: "#EEEAE2",
  muted: "#9DA4AF",
  gold: "#EBB22D",
  secondaryForeground: "#CAE7DC",
  ink: "#191F29",
  teal: "#55B490",
  // Lift the dark-mode danger foreground slightly for WCAG contrast on cards.
  error: "#EB7369",
  warning: "#E4B16E",
  reference: "#8C9BB0",
  illustrationGold: "#F0D69D",
  shadow: "#0D1219",
};

// Keep the existing authFlowPalette export for screens that already consume it.
export const authFlowPalette = brandPalette;

/** Context lines keep direction separate from risk; labels/styles add non-color cues. */
export const chartContextPalette = {
  long: brandPalette.teal,
  short: brandPalette.gold,
  risk: brandPalette.error,
  entry: brandPalette.gold,
  target: brandPalette.gold,
  source: brandPalette.muted,
  pivot: brandPalette.teal,
} as const;

export type PriceDataState = "LIVE" | "FALLBACK" | "STALE" | "ERROR" | undefined;
export type ReferenceDataState = "REFERENCE" | "STALE" | "UNAVAILABLE" | undefined;
export type PriceState = "LIVE" | "REFERENCE" | "STALE" | "UNAVAILABLE";

export const priceStatePresentation: Record<
  PriceState,
  {
    label: PriceState;
    detailLabel: string;
    feedLabel: string;
    colorToken: "success" | "reference" | "warning" | "destructive";
    icon: "check-circle" | "info" | "clock" | "slash";
    borderStyle: "solid" | "dashed" | "dotted";
  }
> = {
  LIVE: {
    label: "LIVE",
    detailLabel: "LIVE PRICE",
    feedLabel: "LIVE PRICES",
    colorToken: "success",
    icon: "check-circle",
    borderStyle: "solid",
  },
  REFERENCE: {
    label: "REFERENCE",
    detailLabel: "REFERENCE PRICE",
    feedLabel: "REFERENCE PRICES",
    colorToken: "reference",
    icon: "info",
    borderStyle: "dashed",
  },
  STALE: {
    label: "STALE",
    detailLabel: "STALE PRICE",
    feedLabel: "STALE PRICES",
    colorToken: "warning",
    icon: "clock",
    borderStyle: "dotted",
  },
  UNAVAILABLE: {
    label: "UNAVAILABLE",
    detailLabel: "PRICE UNAVAILABLE",
    feedLabel: "PRICES UNAVAILABLE",
    colorToken: "destructive",
    icon: "slash",
    borderStyle: "solid",
  },
};

export function resolvePriceState(
  dataState: PriceDataState | string,
  referenceState: ReferenceDataState | string,
  hasPrice: boolean,
): PriceState {
  if (!hasPrice) return "UNAVAILABLE";
  if (dataState === "LIVE") return "LIVE";
  if (dataState === "STALE" || referenceState === "STALE") return "STALE";
  if (dataState === "FALLBACK" || referenceState === "REFERENCE") return "REFERENCE";
  return "UNAVAILABLE";
}

export function getPriceStateVisual(
  state: PriceState,
  palette: { success: string; reference: string; warning: string; destructive: string },
) {
  const presentation = priceStatePresentation[state];
  const color = palette[presentation.colorToken];
  return {
    ...presentation,
    color,
    backgroundColor: `${color}12`,
    borderColor: color,
  };
}

/**
 * Shared visual language for the Expo surfaces.
 *
 * Keep these values platform-neutral and semantic. Screen-level styles should
 * consume these names instead of introducing another spacing or radius scale.
 */
export const designTokens = {
  surface: {
    page: "background",
    raised: "card",
    subtle: "muted",
    control: "secondary",
    input: "input",
    accent: "accent",
  },
  spacing: {
    hairline: 1,
    xxs: 2,
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    section: 14,
    card: 16,
    screen: 18,
    screenBottom: 92,
    header: 16,
    shell: 22,
    spacious: 24,
  },
  tabBar: {
    inset: 12,
    bottom: 10,
    height: 68,
    webHeight: 70,
  },
  sizes: {
    touchTarget: 44,
    controlHeight: 48,
    primaryButtonHeight: 52,
    inputHeight: 52,
  },
  radii: {
    dot: 3,
    tight: 4,
    chip: 8,
    control: 12,
    input: 14,
    button: 15,
    card: 8,
    shell: 24,
    sheet: 28,
    tabBar: 24,
    tabBarItem: 17,
    pill: 999,
  },
  typography: {
    display: 33,
    hero: 38,
    heroLine: 42,
    title: 23,
    section: 19,
    price: 25,
    body: 14,
    label: 12,
    meta: 11,
    caption: 10,
    micro: 9,
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    strong: "800" as const,
    black: "900" as const,
  },
  state: {
    neutral: "mutedForeground",
    positive: "success",
    warning: "warning",
    negative: "destructive",
    reference: "reference",
  },
} as const;

const appPalette = {
  text: brandPalette.text,
  tint: brandPalette.gold,
  background: brandPalette.background,
  foreground: brandPalette.text,
  card: brandPalette.surface,
  cardForeground: brandPalette.text,
  primary: brandPalette.gold,
  primaryForeground: brandPalette.ink,
  secondary: brandPalette.raised,
  secondaryForeground: brandPalette.secondaryForeground,
  muted: brandPalette.mutedSurface,
  mutedForeground: brandPalette.muted,
  accent: brandPalette.gold,
  accentForeground: brandPalette.ink,
  destructive: brandPalette.error,
  destructiveForeground: brandPalette.ink,
  border: brandPalette.border,
  input: brandPalette.input,
  success: brandPalette.teal,
  warning: brandPalette.warning,
  reference: brandPalette.reference,
  chart: brandPalette.gold,
  chartContext: brandPalette.teal,
};

const colors = {
  // The app keeps one dark brand identity regardless of the device setting.
  light: appPalette,
  dark: appPalette,
  radius: 8,
};

export default colors;
