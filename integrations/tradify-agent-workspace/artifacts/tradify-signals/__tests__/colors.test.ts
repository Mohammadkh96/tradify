import { renderHook } from "@testing-library/react-native";
import colors, {
  brandPalette,
  chartContextPalette,
  designTokens,
  getPriceStateVisual,
  priceStatePresentation,
  resolvePriceState,
} from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

const expectedDesignTokens = {
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
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    strong: "800",
    black: "900",
  },
  state: {
    neutral: "mutedForeground",
    positive: "success",
    warning: "warning",
    negative: "destructive",
    reference: "reference",
  },
} as const;

describe("shared signal-studio design tokens", () => {
  it("centralizes chart context colors with distinct direction and risk roles", () => {
    expect(chartContextPalette).toEqual({
      long: brandPalette.teal,
      short: brandPalette.gold,
      risk: brandPalette.error,
      entry: brandPalette.gold,
      target: brandPalette.gold,
      source: brandPalette.muted,
      pivot: brandPalette.teal,
    });
    expect(new Set([
      chartContextPalette.long, chartContextPalette.short, chartContextPalette.risk,
    ]).size).toBe(3);
  });

  it("keeps context lines and labels readable on graphite chart surfaces", () => {
    const luminance = (hex: string) => {
      const channels = [1, 3, 5].map((index) => {
        const value = parseInt(hex.slice(index, index + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    for (const color of Object.values(chartContextPalette)) {
      for (const surface of [brandPalette.background, brandPalette.surface]) {
        expect((luminance(color) + 0.05) / (luminance(surface) + 0.05))
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps every exported semantic token group and value stable", () => {
    expect(designTokens).toEqual(expectedDesignTokens);
  });

  it("exposes shared tokens alongside the active color palette", () => {
    const { result } = renderHook(() => useColors());

    expect(result.current).toEqual({
      ...colors.light,
      ...designTokens,
      radius: colors.radius,
    });
  });
});

describe("price state labels and visual treatments", () => {
  const states = ["LIVE", "REFERENCE", "STALE", "UNAVAILABLE"] as const;

  it.each([
    ["LIVE", "LIVE", "LIVE PRICE", "LIVE PRICES", "check-circle", "solid"],
    ["REFERENCE", "REFERENCE", "REFERENCE PRICE", "REFERENCE PRICES", "info", "dashed"],
    ["STALE", "STALE", "STALE PRICE", "STALE PRICES", "clock", "dotted"],
    ["UNAVAILABLE", "UNAVAILABLE", "PRICE UNAVAILABLE", "PRICES UNAVAILABLE", "slash", "solid"],
  ] as const)(
    "maps %s to its explicit text and non-color cues",
    (state, label, detailLabel, feedLabel, icon, borderStyle) => {
      expect(priceStatePresentation[state]).toMatchObject({
        label,
        detailLabel,
        feedLabel,
        icon,
        borderStyle,
      });
    },
  );

  it("resolves state only when a valid price exists and keeps stale evidence ahead of reference", () => {
    expect(resolvePriceState("LIVE", undefined, true)).toBe("LIVE");
    expect(resolvePriceState("FALLBACK", "REFERENCE", true)).toBe("REFERENCE");
    expect(resolvePriceState("FALLBACK", "STALE", true)).toBe("STALE");
    expect(resolvePriceState("STALE", undefined, true)).toBe("STALE");
    expect(resolvePriceState("ERROR", undefined, true)).toBe("UNAVAILABLE");
    expect(resolvePriceState("LIVE", undefined, false)).toBe("UNAVAILABLE");
    expect(resolvePriceState(undefined, undefined, true)).toBe("UNAVAILABLE");
  });

  it("keeps all state labels readable against dark surfaces without relying on color alone", () => {
    const contrastRatio = (foreground: string, background: string) => {
      const luminance = (hex: string) => {
        const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
        const linear = channels.map((value) =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
        );
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a,
      );
      return (lighter + 0.05) / (darker + 0.05);
    };
    const compositeBadgeBackground = (overlay: string, surface: string) => {
      const opacity = parseInt(overlay.slice(7, 9), 16) / 255;
      const overlayChannels = [1, 3, 5].map((index) =>
        parseInt(overlay.slice(index, index + 2), 16),
      );
      const surfaceChannels = [1, 3, 5].map((index) =>
        parseInt(surface.slice(index, index + 2), 16),
      );
      return `#${overlayChannels
        .map((value, index) =>
          Math.round(value * opacity + surfaceChannels[index] * (1 - opacity))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`;
    };
    const visuals = states.map((state) => getPriceStateVisual(state, colors.dark));

    expect(new Set(visuals.map((visual) => visual.label)).size).toBe(states.length);
    expect(new Set(visuals.map((visual) => visual.icon)).size).toBe(states.length);
    for (const visual of visuals) {
      expect(contrastRatio(visual.color, brandPalette.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(visual.color, brandPalette.background)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(
          visual.color,
          compositeBadgeBackground(visual.backgroundColor, brandPalette.surface),
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(
          visual.color,
          compositeBadgeBackground(visual.backgroundColor, brandPalette.background),
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(visual.backgroundColor).toBe(`${visual.color}12`);
      expect(visual.borderColor).toBe(visual.color);
    }
  });
});
