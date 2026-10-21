import { defineConfig } from "@playwright/test";

const baseURL =
  process.env.VISUAL_BASE_URL ||
  (process.env.REPLIT_EXPO_DEV_DOMAIN
    ? `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`
    : undefined);
if (!baseURL) throw new Error("Start the Expo web workflow and set VISUAL_BASE_URL to its URL.");

export default defineConfig({
  testDir: ".",
  testMatch: "routes.spec.ts",
  snapshotPathTemplate: "{testDir}/baselines/{projectName}/{arg}{ext}",
  outputDir: "../../../generated-artifacts/mobile-visual/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../../generated-artifacts/mobile-visual/report", open: "never" }],
  ],
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixels: 40, threshold: 0.1 },
  },
  use: {
    baseURL,
    browserName: "chromium",
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
    contextOptions: { reducedMotion: "reduce" },
    serviceWorkers: "block",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  projects: [
    { name: "narrow-375", use: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 } },
    { name: "mobile-430", use: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 } },
  ],
});
