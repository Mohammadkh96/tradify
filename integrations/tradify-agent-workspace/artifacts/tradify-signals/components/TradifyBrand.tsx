import React, { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import { brandPalette } from "@/constants/colors";
import { motionTokens } from "@/constants/motion";
import { useStaggeredEntrance, useSystemReducedMotion } from "@/hooks/useMotion";

let brandIntroClaimed = false;

export function BrandMark({ size = 32 }: { size?: number }) {
  const reducedMotion = useSystemReducedMotion();
  const [playIntro, setPlayIntro] = useState(false);
  useEffect(() => {
    if (brandIntroClaimed) return;
    brandIntroClaimed = true;
    if (!reducedMotion) setPlayIntro(true);
  }, [reducedMotion]);

  const barProgress = useStaggeredEntrance({
    count: 3,
    active: playIntro,
    reducedMotion,
    durationMs: motionTokens.duration.enter,
    staggerMs: motionTokens.stagger,
  });
  const barHeights = [0.35, 0.62, 0.46];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: brandPalette.gold,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: size * 0.065,
        transform: [{ rotate: "-6deg" }],
      }}
    >
      {barHeights.map((height, index) => (
        <Animated.View
          key={index}
          style={{
            width: size * 0.095,
            height: size * height,
            borderRadius: size * 0.06,
            backgroundColor: brandPalette.ink,
            opacity: barProgress[index],
            transform: [{ rotate: "25deg" }, { scaleY: barProgress[index] }],
          }}
        />
      ))}
    </View>
  );
}

export function TradifyBrand() {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Tradify Signals"
      style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
    >
      <BrandMark />
      <View>
        <Text
          style={{
            color: brandPalette.text,
            fontFamily: "Inter_500Medium",
            fontSize: 16,
            letterSpacing: -0.4,
            lineHeight: 19,
          }}
        >
          tradify
        </Text>
        <Text
          style={{
            color: brandPalette.muted,
            fontFamily: "Inter_600SemiBold",
            fontSize: 7,
            letterSpacing: 2.2,
            lineHeight: 10,
          }}
        >
          signals
        </Text>
      </View>
    </View>
  );
}
