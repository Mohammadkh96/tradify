import React from "react";
import { Animated, View } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { useStaggeredEntrance } from "@/hooks/useMotion";

function ReducedMotionEntranceProbe() {
  const progress = useStaggeredEntrance({
    count: 3,
    active: true,
    reducedMotion: true,
  });

  return (
    <View
      testID="reduced-motion-entrances"
      accessibilityValue={{
        text: progress
          .map((value) => String((value as Animated.Value & { __getValue(): number }).__getValue()))
          .join(","),
      }}
    />
  );
}

describe("motion preferences", () => {
  it("settles onboarding entrances immediately when reduced motion is enabled", () => {
    render(<ReducedMotionEntranceProbe />);
    expect(screen.getByTestId("reduced-motion-entrances").props.accessibilityValue.text).toBe(
      "1,1,1",
    );
  });
});
