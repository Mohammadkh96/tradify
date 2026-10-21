type RevenueCatPlatform = "ios" | "android" | "web" | string;

export function selectRevenueCatApiKey(
  platform: RevenueCatPlatform,
  isExpoGo: boolean,
  keys: {
    ios?: string;
    android?: string;
    testStore?: string;
  },
): string | undefined {
  if (platform === "web") return undefined;

  const selected = isExpoGo
    ? keys.testStore
    : platform === "ios"
      ? keys.ios
      : platform === "android"
        ? keys.android
        : undefined;

  return typeof selected === "string" && selected.trim() ? selected.trim() : undefined;
}
