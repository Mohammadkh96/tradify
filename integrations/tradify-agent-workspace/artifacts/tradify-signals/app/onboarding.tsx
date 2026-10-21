import Feather from "@expo/vector-icons/Feather";
import { PageMetadata } from "@/components/PageMetadata";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark, TradifyBrand } from "@/components/TradifyBrand";
import { authFlowPalette as palette, designTokens } from "@/constants/colors";
import { motionTokens } from "@/constants/motion";
import { usePressMotion, useStaggeredEntrance, useSystemReducedMotion } from "@/hooks/useMotion";
import { useTradify } from "@/lib/tradify-store";

const slides = [
  {
    eyebrow: "START WITH CONTEXT",
    firstLine: "Current data.",
    secondLine: "Clear status.",
    description: "A focused feed shows market setups and clearly labels their data status.",
    art: "market",
  },
  {
    eyebrow: "REVIEW RISK FIRST",
    firstLine: "Know the levels.",
    secondLine: "Before decisions.",
    description:
      "See entry, stop and target levels only after data validation, with account-risk context nearby.",
    art: "risk",
  },
  {
    eyebrow: "CHOOSE YOUR MARKETS",
    firstLine: "Stay close to",
    secondLine: "what matters.",
    description: "Build a watchlist, set price alerts and review recorded trades in one place.",
    art: "watchlist",
  },
] as const;

const sampleCandles = [26, 38, 19, 31, 24, 43, 20, 17, 35, 19, 25, 16];

function liftStyle(progress: Animated.Value, distance: number) {
  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
    ],
  };
}

function slideStyle(progress: Animated.Value, distance: number) {
  return {
    opacity: progress,
    transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
    ],
  };
}

function floatingStyle(progress: Animated.Value, distance: number, rotation: string) {
  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
      { rotate: rotation },
    ],
  };
}

function Illustration({
  type,
  width,
  height,
  active,
  reducedMotion,
  largeText,
}: {
  type: string;
  width: number;
  height: number;
  active: boolean;
  reducedMotion: boolean;
  largeText: boolean;
}) {
  const cardWidth = Math.min(width - 48, 310);
  const sceneStyle = [styles.scene, { height }];
  const detailCount = type === "market" ? sampleCandles.length : 3;
  const cardProgress = useStaggeredEntrance({
    count: 1,
    active,
    reducedMotion,
    durationMs: motionTokens.duration.enter,
  });
  const detailProgress = useStaggeredEntrance({
    count: detailCount,
    active,
    reducedMotion,
    durationMs: 280,
    staggerMs: type === "market" ? 24 : 70,
  });
  const calloutProgress = useStaggeredEntrance({
    count: 1,
    active,
    reducedMotion,
    durationMs: motionTokens.duration.enter,
    delayMs: 150,
  });

  if (largeText) {
    const example =
      type === "risk"
        ? "Example only: $10,000 account, 1% risk ($100), entry $2,400, stop $2,385, target $2,430, and 2:1 gross reward to risk before costs."
        : type === "watchlist"
          ? "Example watchlist with a sample alert. Not live market data."
          : "Example gold setup. Not live market data.";
    const exampleTitle =
      type === "risk"
        ? "Risk plan example"
        : type === "watchlist"
          ? "Watchlist example"
          : "Example gold setup";
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={example}
        testID="onboarding-illustration"
        style={[styles.scene, styles.largeTextScene]}
      >
        <View style={styles.largeTextIllustrationCard}>
          <Feather
            name={type === "risk" ? "shield" : type === "watchlist" ? "eye" : "bar-chart-2"}
            size={19}
            color={palette.gold}
          />
          <View style={styles.largeTextIllustrationCopy}>
            <Text style={styles.largeTextIllustrationTitle}>{exampleTitle}</Text>
            <Text style={styles.largeTextIllustrationDescription}>{example}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (type === "risk") {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Example risk plan, not a recommendation. Ten thousand dollar account, 1 percent risk, 100 dollars at risk. Example target 2,430, entry 2,400 and stop 2,385. Two to one gross reward to risk before costs."
        style={sceneStyle}
      >
        <View style={styles.orbitLarge} />
        <View style={styles.orbitSmall} />
        <Animated.View style={[styles.cardReveal, liftStyle(cardProgress[0], 12)]}>
          <View style={[styles.riskCard, { width: cardWidth }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Your risk plan</Text>
              <Text style={styles.exampleBadge}>EXAMPLE</Text>
            </View>
            <View style={styles.riskMain}>
              <View>
                <Text style={styles.microLabel}>Risk per trade</Text>
                <Text style={styles.riskPercent}>1%</Text>
              </View>
              <View style={styles.riskAmountWrap}>
                <Text style={styles.microLabel}>Amount at risk</Text>
                <Text style={styles.riskAmount}>$100.00</Text>
              </View>
            </View>
            <Animated.View
              style={[styles.levelRow, styles.targetRow, slideStyle(detailProgress[0], -8)]}
            >
              <Text style={[styles.levelText, styles.targetText]}>Target</Text>
              <Text style={[styles.levelText, styles.targetText]}>2,430.00</Text>
            </Animated.View>
            <Animated.View
              style={[styles.levelRow, styles.entryRow, slideStyle(detailProgress[1], -8)]}
            >
              <Text style={[styles.levelText, styles.entryText]}>Entry</Text>
              <Text style={[styles.levelText, styles.entryText]}>2,400.00</Text>
            </Animated.View>
            <Animated.View
              style={[styles.levelRow, styles.stopRow, slideStyle(detailProgress[2], -8)]}
            >
              <Text style={[styles.levelText, styles.stopText]}>Stop</Text>
              <Text style={[styles.levelText, styles.stopText]}>2,385.00</Text>
            </Animated.View>
            <Text style={styles.sampleNote}>Illustration · $10,000 account</Text>
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.floatingLabel,
            styles.riskCallout,
            floatingStyle(calloutProgress[0], 12, "-4deg"),
          ]}
        >
          <Feather name="trending-up" size={16} color={palette.ink} />
          <View>
            <Text style={styles.calloutText}>2:1 reward / risk</Text>
            <Text style={styles.calloutSubtext}>Gross · before costs</Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  if (type === "watchlist") {
    const rows = [
      ["Au", "XAU / USD", "Gold", "Watching"],
      ["€", "EUR / USD", "Euro / US Dollar", "Watching"],
      ["B", "BTC / USD", "Bitcoin", "Watching"],
    ];
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Example watchlist with gold, euro dollar and bitcoin, plus a sample gold price alert. Not live prices or an actual notification."
        style={sceneStyle}
      >
        <View style={styles.orbitLarge} />
        <View style={styles.orbitSmall} />
        <Animated.View style={[styles.cardReveal, liftStyle(cardProgress[0], 12)]}>
          <View style={[styles.watchCard, { width: cardWidth }]}>
            <View style={styles.watchHeading}>
              <Text style={styles.cardTitle}>Your watchlist</Text>
              <Text style={styles.exampleBadge}>EXAMPLE</Text>
            </View>
            {rows.map(([symbol, ticker, name, state], index) => (
              <Animated.View
                key={ticker}
                style={[styles.watchRow, slideStyle(detailProgress[index], -8)]}
              >
                <View style={styles.watchSymbol}>
                  <Text style={styles.watchSymbolText}>{symbol}</Text>
                </View>
                <View style={styles.watchCopy}>
                  <Text style={styles.watchTicker}>{ticker}</Text>
                  <Text style={styles.watchName}>{name}</Text>
                </View>
                <Text style={styles.watchState}>{state}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.floatingLabel,
            styles.watchCallout,
            floatingStyle(calloutProgress[0], 12, "3deg"),
          ]}
        >
          <View style={styles.bellTile}>
            <Feather name="bell" size={15} color={palette.gold} />
          </View>
          <View style={styles.watchCalloutCopy}>
            <Text style={styles.calloutText}>Your level. Your alert.</Text>
            <Text style={styles.calloutSubtext}>Gold · sample alert · not live</Text>
          </View>
          <Feather name="arrow-up-right" size={15} color={palette.ink} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Example gold setup card with a decorative candle chart. This is an illustration, not live market data."
      style={sceneStyle}
    >
      <View style={styles.orbitLarge} />
      <View style={styles.orbitSmall} />
      <Animated.View style={[styles.cardReveal, liftStyle(cardProgress[0], 12)]}>
        <View style={[styles.marketCard, { width: cardWidth }]}>
          <View style={styles.cardHeader}>
            <View style={styles.assetHeading}>
              <View style={styles.assetSymbol}>
                <Text style={styles.assetSymbolText}>Au</Text>
              </View>
              <View>
                <Text style={styles.assetTicker}>XAU / USD</Text>
                <Text style={styles.assetName}>Gold setup</Text>
              </View>
            </View>
            <Text style={styles.exampleBadge}>EXAMPLE</Text>
          </View>
          <View style={styles.candleChart}>
            {sampleCandles.map((candle, index) => (
              <Animated.View
                key={`${candle}-${index}`}
                style={[styles.candleSlot, liftStyle(detailProgress[index], 7)]}
              >
                <View
                  style={[
                    styles.candleWick,
                    {
                      height: candle + 14,
                      backgroundColor: index % 4 === 2 ? palette.reference : palette.teal,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.candleBody,
                    {
                      height: candle,
                      backgroundColor: index % 4 === 2 ? palette.reference : palette.teal,
                    },
                  ]}
                />
              </Animated.View>
            ))}
          </View>
          <View style={styles.marketFooter}>
            <View style={styles.marketState}>
              <View style={styles.stateDot} />
              <Text style={styles.notLive}>Illustration only</Text>
            </View>
            <Text style={styles.notLive}>Not live data</Text>
          </View>
        </View>
      </Animated.View>
      <Animated.View style={[styles.marketCallout, floatingStyle(calloutProgress[0], 12, "3deg")]}>
        <Feather name="eye" size={16} color={palette.ink} />
        <Text style={styles.calloutText}>A clearer market view</Text>
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { completeOnboarding } = useTradify();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const replay = returnTo === "profile";
  const { width, height, fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.35;
  const insets = useSafeAreaInsets();
  const reducedMotion = useSystemReducedMotion();
  const nextButtonMotion = usePressMotion();
  const pagerRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const contentWidth = Math.min(width, 520);
  const illustrationHeight = Math.min(290, Math.max(220, height * 0.34));
  const topInset = Platform.OS === "web" ? Math.max(insets.top + 10, 67) : insets.top + 10;
  const bottomInset = Platform.OS === "web" ? Math.max(insets.bottom + 8, 34) : insets.bottom + 8;

  const goToPage = (index: number) => {
    const nextPage = Math.max(0, Math.min(slides.length - 1, index));
    setPage(nextPage);
    pagerRef.current?.scrollTo({ x: nextPage * contentWidth, animated: !reducedMotion });
  };

  const openAuth = (mode: "signin" | "register") => {
    completeOnboarding(true);
    router.push({
      pathname: "/auth",
      params: { mode, returnTo: replay ? "profile" : "feed" },
    });
  };

  const skip = () => {
    if (replay) {
      completeOnboarding(true);
      router.back();
      return;
    }
    // The public feed remains directly available on launch. Skip from this
    // explicitly opened first-run intro continues to the sign-in screen.
    openAuth("signin");
  };

  const handleSwipeAccessibility = (event: { nativeEvent: { actionName: string } }) => {
    const { actionName } = event.nativeEvent;
    if (actionName === "increment") goToPage(page + 1);
    if (actionName === "decrement") goToPage(page - 1);
  };

  return (
    <View style={[styles.screen, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <PageMetadata
        title="A clear first look"
        description="A short introduction to market context, price status, and risk planning in Tradify Signals."
      />
      <View style={[styles.shell, { width: contentWidth }]}>
        <View style={styles.topbar}>
          <TradifyBrand />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip introduction"
            onPress={skip}
            style={styles.skipButton}
            testID="onboarding-skip"
          >
            <Text style={styles.skipText}>Skip</Text>
            <Feather name="arrow-up-right" size={15} color={palette.muted} />
          </Pressable>
        </View>
        <ScrollView
          ref={pagerRef}
          accessibilityRole="adjustable"
          accessibilityLabel="Introduction pages"
          accessibilityHint="Swipe between pages or use the previous and next page actions."
          accessibilityValue={{ min: 1, max: slides.length, now: page + 1 }}
          accessibilityActions={[
            { name: "decrement", label: "Previous introduction page" },
            { name: "increment", label: "Next introduction page" },
          ]}
          onAccessibilityAction={handleSwipeAccessibility}
          onMomentumScrollEnd={(event) => {
            const nextPage = Math.round(event.nativeEvent.contentOffset.x / contentWidth);
            setPage(Math.max(0, Math.min(slides.length - 1, nextPage)));
          }}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
          testID="onboarding-pager"
        >
          {slides.map((slide, index) => (
            <View key={slide.eyebrow} style={[styles.slide, { width: contentWidth }]}>
              <ScrollView
                contentContainerStyle={styles.slideContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <Illustration
                  type={slide.art}
                  width={contentWidth}
                  height={largeText ? 82 : illustrationHeight}
                  active={page === index}
                  reducedMotion={reducedMotion}
                  largeText={largeText}
                />
                <View style={styles.copy}>
                  <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
                  <Text accessibilityRole="header" style={styles.headline}>
                    {slide.firstLine}
                    {"\n"}
                    <Text style={styles.headlineAccent}>{slide.secondLine}</Text>
                  </Text>
                  <Text style={styles.description}>{slide.description}</Text>
                </View>
              </ScrollView>
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <View
            style={styles.dots}
            accessibilityLabel={`Introduction page ${page + 1} of ${slides.length}`}
          >
            {slides.map((slide, index) => (
              <Pressable
                key={slide.eyebrow}
                accessibilityRole="tab"
                accessibilityLabel={`Go to introduction page ${index + 1}`}
                accessibilityState={{ selected: index === page }}
                onPress={() => goToPage(index)}
                style={styles.dotButton}
                testID={`onboarding-dot-${index}`}
              >
                <View style={[styles.dot, index === page && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
          <Animated.View style={[styles.buttonMotion, nextButtonMotion.animatedStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                page === slides.length - 1
                  ? "Create your account"
                  : "Continue to next introduction page"
              }
              accessibilityState={{ disabled: false }}
              onPressIn={nextButtonMotion.onPressIn}
              onPressOut={nextButtonMotion.onPressOut}
              onPress={() =>
                page === slides.length - 1 ? openAuth("register") : goToPage(page + 1)
              }
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              testID="onboarding-next"
            >
              <Text style={styles.primaryButtonText}>
                {page === slides.length - 1 ? "Create your account" : "Continue"}
              </Text>
              <Feather name="arrow-right" size={19} color={palette.ink} />
            </Pressable>
          </Animated.View>
          <View style={[styles.loginPrompt, fontScale >= 2 && styles.loginPromptLarge]}>
            <Text style={styles.promptText}>Already have an account?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log in"
              onPress={() => openAuth("signin")}
              style={styles.loginLink}
              testID="onboarding-login"
            >
              <Text style={styles.linkText}>Log in</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background, paddingHorizontal: 0 },
  shell: { flex: 1, alignSelf: "center" },
  topbar: {
    minHeight: designTokens.sizes.controlHeight,
    paddingHorizontal: designTokens.spacing.spacious,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipButton: {
    minWidth: 60,
    minHeight: designTokens.sizes.touchTarget,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  skipText: {
    color: palette.muted,
    fontFamily: "Inter_500Medium",
    fontSize: designTokens.typography.body,
  },
  pager: { flex: 1 },
  slide: { flex: 1 },
  slideContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: designTokens.spacing.spacious,
    paddingTop: 4,
    paddingBottom: 8,
  },
  scene: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: designTokens.spacing.md,
    overflow: "visible",
  },
  largeTextScene: { minHeight: 82, marginBottom: 4 },
  largeTextIllustrationCard: {
    width: "100%",
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  largeTextIllustrationCopy: { flex: 1, gap: 3 },
  largeTextIllustrationTitle: { color: palette.text, fontFamily: "Inter_500Medium", fontSize: 13 },
  largeTextIllustrationDescription: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
  },
  orbitLarge: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: `${palette.teal}22`,
  },
  orbitSmall: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: `${palette.teal}18`,
  },
  cardReveal: { alignSelf: "center" },
  marketCard: {
    paddingHorizontal: designTokens.spacing.card,
    paddingTop: designTokens.spacing.card,
    paddingBottom: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    shadowColor: palette.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: designTokens.spacing.md,
  },
  assetHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  assetSymbol: {
    width: 35,
    height: 35,
    borderRadius: designTokens.radii.control,
    backgroundColor: `${palette.illustrationGold}30`,
    alignItems: "center",
    justifyContent: "center",
  },
  assetSymbolText: {
    color: palette.illustrationGold,
    fontFamily: "Inter_600SemiBold",
    fontSize: designTokens.typography.body,
  },
  assetTicker: {
    color: palette.text,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.25,
  },
  assetName: { color: palette.muted, fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 3 },
  exampleBadge: {
    color: palette.muted,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: designTokens.radii.tight,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontFamily: "Inter_600SemiBold",
    fontSize: designTokens.typography.micro,
    letterSpacing: 0.6,
    overflow: "hidden",
  },
  candleChart: {
    height: 100,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingTop: 7,
    marginTop: 14,
    marginBottom: 11,
    borderBottomWidth: 1,
    borderColor: `${palette.teal}22`,
  },
  candleSlot: {
    height: "100%",
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  candleWick: { position: "absolute", width: 1, bottom: 0, opacity: 0.8 },
  candleBody: { width: 9, borderRadius: 2, marginBottom: 9 },
  marketFooter: {
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marketState: { flexDirection: "row", alignItems: "center" },
  stateDot: {
    width: 5,
    height: 5,
    borderRadius: designTokens.radii.dot,
    backgroundColor: palette.reference,
    marginRight: 5,
  },
  notLive: { color: palette.muted, fontFamily: "Inter_400Regular", fontSize: 9 },
  marketCallout: {
    position: "absolute",
    right: 4,
    bottom: 9,
    minHeight: designTokens.sizes.touchTarget,
    paddingHorizontal: 12,
    borderRadius: designTokens.radii.control,
    backgroundColor: palette.gold,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    transform: [{ rotate: "3deg" }],
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  calloutText: { color: palette.ink, fontFamily: "Inter_600SemiBold", fontSize: 10 },
  riskCard: {
    padding: designTokens.spacing.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    shadowColor: palette.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardTitle: { color: palette.text, fontFamily: "Inter_500Medium", fontSize: 12 },
  riskMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 17,
    marginBottom: 14,
  },
  microLabel: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    marginBottom: 3,
  },
  riskPercent: {
    color: palette.text,
    fontFamily: "Inter_400Regular",
    fontSize: 34,
    letterSpacing: -1.6,
  },
  riskAmountWrap: { alignItems: "flex-end", paddingBottom: 4 },
  riskAmount: {
    color: palette.text,
    fontFamily: "Inter_500Medium",
    fontSize: designTokens.typography.body,
  },
  levelRow: {
    minHeight: 31,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: `${palette.text}0D`,
  },
  levelText: { fontFamily: "Inter_400Regular", fontSize: 10 },
  targetRow: {
    backgroundColor: `${palette.teal}12`,
    borderTopLeftRadius: designTokens.radii.chip,
    borderTopRightRadius: designTokens.radii.chip,
  },
  targetText: { color: palette.teal },
  entryRow: {},
  entryText: { color: palette.muted },
  stopRow: {
    backgroundColor: `${palette.error}08`,
    borderBottomLeftRadius: designTokens.radii.chip,
    borderBottomRightRadius: designTokens.radii.chip,
  },
  stopText: { color: palette.error },
  sampleNote: {
    color: palette.muted,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    marginTop: 10,
  },
  floatingLabel: {
    position: "absolute",
    minHeight: designTokens.sizes.touchTarget,
    paddingHorizontal: 12,
    borderRadius: designTokens.radii.control,
    backgroundColor: palette.gold,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: palette.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  riskCallout: { right: 2, bottom: 6, transform: [{ rotate: "-4deg" }] },
  calloutSubtext: {
    color: palette.ink,
    fontFamily: "Inter_400Regular",
    fontSize: designTokens.typography.micro,
    marginTop: 3,
  },
  watchCard: {
    paddingHorizontal: designTokens.spacing.card,
    paddingTop: 12,
    paddingBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    shadowColor: palette.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  watchHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginBottom: 2,
  },
  watchRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  watchSymbol: {
    width: 30,
    height: 30,
    borderRadius: designTokens.radii.control,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.raised,
  },
  watchSymbolText: {
    color: palette.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: designTokens.typography.label,
  },
  watchCopy: { flex: 1 },
  watchTicker: { color: palette.text, fontFamily: "Inter_500Medium", fontSize: 10 },
  watchName: { color: palette.muted, fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 2 },
  watchState: { color: palette.muted, fontFamily: "Inter_400Regular", fontSize: 9 },
  watchCallout: {
    right: -2,
    bottom: 3,
    minWidth: 225,
    justifyContent: "space-between",
    transform: [{ rotate: "3deg" }],
  },
  bellTile: {
    width: 30,
    height: 30,
    borderRadius: designTokens.radii.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.raised,
    borderWidth: 1,
    borderColor: palette.border,
  },
  watchCalloutCopy: { flex: 1, paddingHorizontal: 7 },
  copy: { paddingHorizontal: 1, paddingTop: 12, paddingBottom: 16 },
  eyebrow: {
    color: palette.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: designTokens.typography.caption,
    letterSpacing: 2.1,
    marginBottom: designTokens.spacing.xl,
  },
  headline: {
    color: palette.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: designTokens.typography.hero,
    lineHeight: designTokens.typography.heroLine,
    letterSpacing: -1.8,
  },
  headlineAccent: { color: palette.gold },
  description: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    marginTop: designTokens.spacing.xl,
    maxWidth: 350,
  },
  footer: { paddingHorizontal: designTokens.spacing.spacious, paddingBottom: 1 },
  dots: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dotButton: {
    minWidth: designTokens.sizes.touchTarget,
    minHeight: designTokens.sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 5,
    height: 4,
    borderRadius: designTokens.radii.dot,
    backgroundColor: palette.border,
  },
  dotActive: { width: 25, backgroundColor: palette.gold },
  buttonMotion: { width: "100%" },
  primaryButton: {
    minHeight: 56,
    borderRadius: designTokens.radii.button,
    backgroundColor: palette.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
  },
  primaryButtonText: {
    color: palette.ink,
    fontFamily: "Inter_600SemiBold",
    fontSize: designTokens.typography.body,
  },
  buttonPressed: { opacity: 0.78 },
  loginPrompt: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  loginPromptLarge: { flexDirection: "column", paddingVertical: 6 },
  promptText: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: designTokens.typography.meta,
  },
  loginLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 3 },
  linkText: {
    color: palette.gold,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    textDecorationLine: "underline",
    textDecorationColor: palette.gold,
  },
});
