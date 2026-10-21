import { expect, test, type Page } from "@playwright/test";
import { installFixtures } from "./fixtures";

const routes = [
  { name: "feed", path: "/", ready: "opportunities-intro" },
  { name: "watchlist", path: "/watchlist", ready: "market-card-XAUUSD" },
  { name: "alerts", path: "/notifications", ready: "notification-visual-notification" },
  { name: "performance", path: "/performance", text: "Performance" },
  { name: "profile", path: "/profile", ready: "profile-logout" },
  { name: "signal-detail", path: "/signal/visual-gold", ready: "Close signal details" },
  { name: "auth", path: "/auth", ready: "auth-submit" },
  { name: "settings", path: "/settings", ready: "settings-name" },
];

async function settleFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const font of document.fonts) await font.load();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

for (const route of routes) {
  test(`${route.name} (${route.path}) — header, content, lower region`, async ({ page }) => {
    const unexpected = await installFixtures(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (route.name === "auth") {
      await page.goto("/auth");
      await expect(page.getByTestId("auth-submit")).toBeVisible();
    } else {
      await page.goto("/");
      await page.getByTestId("header-profile").click();
      await page.getByTestId("profile-sign-in").click();
      await expect(page.getByTestId("auth-submit")).toBeVisible();
      // Exercise normal sign-in and keep the web session in memory.
      await page.getByTestId("auth-email").fill("trader@example.test");
      await page.getByTestId("auth-password").fill("visual-fixture-password");
      await page.getByTestId("auth-submit").click();
      await expect(page.getByTestId("profile-logout")).toBeVisible();
      await page.getByRole("tab", { name: "Opportunities", exact: true }).click();
      await expect(page.getByTestId("opportunities-intro")).toBeVisible();
      if (route.name === "watchlist")
        await page.getByRole("tab", { name: "Watchlist", exact: true }).click();
      if (route.name === "alerts") await page.getByTestId("header-notifications").click();
      if (route.name === "performance")
        await page.getByRole("tab", { name: "Performance", exact: true }).click();
      if (route.name === "profile" || route.name === "settings")
        await page.getByTestId("header-profile").click();
      if (route.name === "settings") await page.getByTestId("edit-profile").click();
      if (route.name === "signal-detail")
        await page.getByRole("button", { name: /^XAUUSD\./ }).click();
    }
    await expect(page).toHaveURL(
      new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    );
    if (route.ready) {
      if (route.name === "signal-detail") {
        await expect(page.getByTestId("detail-close")).toBeVisible();
      } else {
        await expect(page.getByTestId(route.ready)).toBeVisible();
      }
    }
    if (route.text) await expect(page.getByText(route.text, { exact: true }).first()).toBeVisible();
    await settleFonts(page);
    const { width, height } = page.viewportSize()!;
    await expect(page).toHaveScreenshot(`${route.name}-header.png`, {
      clip: { x: 0, y: 0, width, height: 180 },
    });
    await expect(page).toHaveScreenshot(`${route.name}-content.png`, {
      clip: { x: 0, y: 180, width, height: height - 260 },
    });
    // Capture bottom controls, cards, and floating tabs, not only the first viewport.
    // Scrolling over the embedded signal chart activates its interactive
    // crosshair, which is pointer-state rather than page layout. Keep that
    // route at its natural viewport; other routes scroll to capture lower UI.
    if (route.name !== "signal-detail") {
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, 10000);
      await page.mouse.move(0, 0);
    }
    await expect(page).toHaveScreenshot(
      `${route.name}-lower.png`,
      route.name === "signal-detail"
        ? { clip: { x: 0, y: height - 180, width, height: 180 } }
        : undefined,
    );
    expect(unexpected, `${route.name}: every API request must have an offline fixture`).toEqual([]);
    expect(errors, `${route.name}: browser runtime errors`).toEqual([]);
  });
}
