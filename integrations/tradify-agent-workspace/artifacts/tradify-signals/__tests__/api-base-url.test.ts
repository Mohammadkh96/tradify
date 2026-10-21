import { resolveApiBaseUrl } from "../lib/api-base-url";

describe("resolveApiBaseUrl", () => {
  it("uses the current origin for web so Replit preview and custom domains use their own API", () => {
    expect(
      resolveApiBaseUrl({
        platform: "web",
        webOrigin: "https://preview.example.replit.dev",
        configuredApiUrl: "https://tradify-signals.replit.app",
      }),
    ).toBe("https://preview.example.replit.dev");
  });

  it("keeps the configured backend for native apps", () => {
    expect(
      resolveApiBaseUrl({
        platform: "ios",
        webOrigin: "https://preview.example.replit.dev",
        configuredApiUrl: "https://tradify-signals.replit.app",
      }),
    ).toBe("https://tradify-signals.replit.app");
  });

  it("uses the configured domain and final fallback when no explicit API URL exists", () => {
    expect(resolveApiBaseUrl({ platform: "android", configuredDomain: "signals.example.com" }))
      .toBe("https://signals.example.com");
    expect(resolveApiBaseUrl({ platform: "ios" })).toBe("https://tradify-signals.replit.app");
  });
});
