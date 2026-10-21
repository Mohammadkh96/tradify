import { defineConfig } from '@playwright/test';

const authenticatedTextEnlargementTests =
  /authenticated|session history and Passport actions reachable|coach learning-record fields and actions reachable/;
const widerAuthenticatedTextEnlargementTests =
  /session history and Passport actions reachable at 200% text size|coach learning-record fields and actions reachable at 200% text size/;
// Keep actionable diagnostics for failed checks across every browser project,
// without creating screenshot, trace, or video artifacts for successful runs.
const failureDiagnostics = {
  screenshot: 'only-on-failure' as const,
  trace: 'retain-on-failure' as const,
  video: 'retain-on-failure' as const,
};
const playwrightTestPort = Number(process.env.PLAYWRIGHT_TEST_PORT ?? 5173);
const playwrightOutputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: playwrightOutputDir,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${playwrightTestPort}`,
    headless: true,
    viewport: { width: 375, height: 900 },
    ...failureDiagnostics,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'chromium-text-enlargement-tablet',
      testMatch: '**/text-enlargement.spec.ts',
      grep: /keeps session history and Passport actions reachable at 200% text size/,
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'chromium-text-enlargement-desktop',
      testMatch: '**/text-enlargement.spec.ts',
      grep: /keeps session history and Passport actions reachable at 200% text size/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'firefox-marketplace-refresh',
      testMatch: '**/marketplace-refresh-announcements.spec.ts',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit-marketplace-refresh',
      testMatch: '**/marketplace-refresh-announcements.spec.ts',
      use: { browserName: 'webkit' },
    },
    {
      name: 'firefox-text-enlargement',
      testMatch: '**/text-enlargement.spec.ts',
      grep: authenticatedTextEnlargementTests,
      use: {
        browserName: 'firefox',
      },
    },
    {
      name: 'webkit-text-enlargement',
      testMatch: '**/text-enlargement.spec.ts',
      grep: authenticatedTextEnlargementTests,
      use: {
        browserName: 'webkit',
      },
    },
    {
      name: 'firefox-text-enlargement-tablet',
      testMatch: '**/text-enlargement.spec.ts',
      grep: widerAuthenticatedTextEnlargementTests,
      use: {
        browserName: 'firefox',
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'firefox-text-enlargement-desktop',
      testMatch: '**/text-enlargement.spec.ts',
      grep: widerAuthenticatedTextEnlargementTests,
      use: {
        browserName: 'firefox',
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'webkit-text-enlargement-tablet',
      testMatch: '**/text-enlargement.spec.ts',
      grep: widerAuthenticatedTextEnlargementTests,
      use: {
        browserName: 'webkit',
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'webkit-text-enlargement-desktop',
      testMatch: '**/text-enlargement.spec.ts',
      grep: widerAuthenticatedTextEnlargementTests,
      use: {
        browserName: 'webkit',
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'firefox-mobile-drawer',
      testMatch: '**/mobile-drawer-accessibility.spec.ts',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit-mobile-drawer',
      testMatch: '**/mobile-drawer-accessibility.spec.ts',
      use: { browserName: 'webkit' },
    },
  ],
  webServer: {
    command: `PORT=${playwrightTestPort} BASE_PATH=/ pnpm run dev`,
    url: `http://127.0.0.1:${playwrightTestPort}/`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});