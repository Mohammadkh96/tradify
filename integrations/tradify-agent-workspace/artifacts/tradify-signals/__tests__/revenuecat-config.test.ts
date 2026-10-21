import { selectRevenueCatApiKey } from "../lib/revenuecat-config";

describe("selectRevenueCatApiKey", () => {
  const keys = {
    ios: "ios-store-key",
    android: "android-store-key",
    testStore: "test-store-key",
  };

  it("uses the Test Store key in Expo Go, not a native store key", () => {
    expect(selectRevenueCatApiKey("ios", true, keys)).toBe("test-store-key");
    expect(selectRevenueCatApiKey("android", true, keys)).toBe("test-store-key");
  });

  it("keeps platform-specific keys for native builds", () => {
    expect(selectRevenueCatApiKey("ios", false, keys)).toBe("ios-store-key");
    expect(selectRevenueCatApiKey("android", false, keys)).toBe("android-store-key");
  });

  it("leaves billing unavailable in Expo Go when no Test Store key is configured", () => {
    expect(selectRevenueCatApiKey("ios", true, { ios: "ios-store-key" })).toBeUndefined();
  });

  it("does not configure native purchases on web or unknown platforms", () => {
    expect(selectRevenueCatApiKey("web", false, keys)).toBeUndefined();
    expect(selectRevenueCatApiKey("windows", false, keys)).toBeUndefined();
  });
});
