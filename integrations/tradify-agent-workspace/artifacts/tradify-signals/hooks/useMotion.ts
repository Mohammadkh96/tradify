import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { motionTokens } from "@/constants/motion";

export function useSystemReducedMotion() {
  const initialPreference = useReducedMotion();
  const [reducedMotion, setReducedMotion] = useState(initialPreference);

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia) {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
      setReducedMotion(query.matches);
      if (query.addEventListener) query.addEventListener("change", update);
      else query.addListener(update);

      return () => {
        if (query.removeEventListener) query.removeEventListener("change", update);
        else query.removeListener(update);
      };
    }

    try {
      const subscription = AccessibilityInfo.addEventListener(
        "reduceMotionChanged",
        setReducedMotion,
      );
      return () => subscription?.remove?.();
    } catch {
      return undefined;
    }
  }, []);

  return reducedMotion;
}

export function usePressMotion() {
  const reducedMotion = useSystemReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (toValue: number) => {
      scale.stopAnimation();
      if (reducedMotion) {
        scale.setValue(1);
        return;
      }
      Animated.timing(scale, {
        toValue,
        duration: motionTokens.duration.fast,
        easing: Easing.bezier(...motionTokens.easeOut),
        useNativeDriver: Platform.OS !== "web",
      }).start();
    },
    [reducedMotion, scale],
  );

  useEffect(() => {
    if (reducedMotion) {
      scale.stopAnimation();
      scale.setValue(1);
    }
  }, [reducedMotion, scale]);

  return {
    animatedStyle: { transform: [{ scale }] },
    onPressIn: () => animateTo(motionTokens.pressScale),
    onPressOut: () => animateTo(1),
  };
}

type StaggeredEntranceOptions = {
  count: number;
  active: boolean;
  reducedMotion: boolean;
  durationMs?: number;
  staggerMs?: number;
  delayMs?: number;
};

export function useStaggeredEntrance({
  count,
  active,
  reducedMotion,
  durationMs = motionTokens.duration.enter,
  staggerMs = motionTokens.stagger,
  delayMs = 0,
}: StaggeredEntranceOptions) {
  const values = useRef<Animated.Value[]>([]);
  const started = useRef(false);
  if (values.current.length !== count) {
    values.current = Array.from(
      { length: count },
      () => new Animated.Value(active && !reducedMotion ? 0 : 1),
    );
  }

  useEffect(() => {
    if (!active) return undefined;
    if (reducedMotion) {
      values.current.forEach((value) => {
        value.stopAnimation();
        value.setValue(1);
      });
      started.current = true;
      return undefined;
    }
    if (started.current) return undefined;

    started.current = true;
    values.current.forEach((value) => value.setValue(0));
    const sequence = Animated.stagger(
      staggerMs,
      values.current.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.bezier(...motionTokens.easeOut),
          useNativeDriver: Platform.OS !== "web",
        }),
      ),
    );
    const animation =
      delayMs > 0 ? Animated.sequence([Animated.delay(delayMs), sequence]) : sequence;
    let finished = false;
    animation.start(({ finished: didFinish }) => {
      finished = didFinish;
      if (!didFinish) started.current = false;
    });

    return () => {
      if (!finished) {
        started.current = false;
        animation.stop();
      }
    };
  }, [active, count, delayMs, durationMs, reducedMotion, staggerMs]);

  return values.current;
}
