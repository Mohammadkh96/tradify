import { expect, test, type Page } from '@playwright/test';

async function stubPreviewApis(page: Page) {
  await page.route('**/api/**', (route) =>
    route.fulfill({ json: { items: [], request: null } }),
  );
  await page.route('**/api/auth/demo', (route) =>
    route.fulfill({ json: { previewToken: 'browser-mobile-drawer-test' } }),
  );
}

async function expectDrawerState(
  page: Page,
  state: 'closed' | 'open',
) {
  const trigger = page.locator('button[aria-controls="mobile-navigation-drawer"]');
  const drawer = page.locator('#mobile-navigation-drawer');

  if (state === 'closed') {
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(drawer).toHaveAttribute('aria-modal', 'false');
    await expect(drawer).toHaveAttribute('inert', '');
    return;
  }

  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await expect(drawer).toHaveAttribute('aria-modal', 'true');
  await expect(drawer).not.toHaveAttribute('inert');
}

async function expectVisibleFocusOutsideDrawer(page: Page) {
  await expect(page.locator(':focus')).toBeVisible();
  await expect(
    page.locator('#mobile-navigation-drawer:focus, #mobile-navigation-drawer :focus'),
  ).toHaveCount(0);
}

const PHYSICAL_VIEWPORT = { width: 1440, height: 900 };

async function emulateBrowserZoom(page: Page, zoom: 1 | 2) {
  // Browser zoom changes the effective CSS viewport while the physical viewport
  // stays the same. Playwright's viewport emulation models that layout change
  // consistently in Chromium, Firefox, and WebKit.
  await page.setViewportSize({
    width: PHYSICAL_VIEWPORT.width / zoom,
    height: PHYSICAL_VIEWPORT.height / zoom,
  });
}

test.use({ viewport: { width: 375, height: 900 } });

test.describe('mobile drawer accessibility', () => {
  test('announces trader navigation state and restores trigger focus', async ({
    page,
  }) => {
    await stubPreviewApis(page);
    await page.goto('/preview');

    const trigger = page.getByRole('button', { name: 'Open sidebar' });
    await expect(trigger).toBeVisible();
    await expectDrawerState(page, 'closed');
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await trigger.click();

    await expectDrawerState(page, 'open');
    const openDrawer = page.getByRole('dialog', { name: 'Mobile navigation' });
    await expect(openDrawer).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close sidebar' })).toBeFocused();
    await expect(
      openDrawer.getByRole('navigation', { name: 'Mobile navigation links' }),
    ).toBeVisible();
    await expect(
      openDrawer.getByRole('link', { name: 'Find a Coach', exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Close sidebar' }).click();

    await expectDrawerState(page, 'closed');
    await expect(trigger).toBeFocused();
  });

  test('announces admin navigation state and restores trigger focus', async ({
    page,
  }) => {
    await stubPreviewApis(page);
    await page.goto('/preview/admin');

    const trigger = page.getByRole('button', { name: 'Open sidebar' });
    await expect(trigger).toBeVisible();
    await expectDrawerState(page, 'closed');
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await trigger.click();

    await expectDrawerState(page, 'open');
    const openDrawer = page.getByRole('dialog', { name: 'Mobile navigation' });
    await expect(openDrawer).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close sidebar' })).toBeFocused();
    await expect(
      openDrawer.getByRole('link', { name: 'Applications', exact: true }),
    ).toBeVisible();
    await expect(
      openDrawer.getByRole('link', { name: 'DEMO LAB', exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Close sidebar' }).click();

    await expectDrawerState(page, 'closed');
    await expect(trigger).toBeFocused();
  });

  test('closes the trader drawer and focuses desktop navigation after resizing', async ({
    page,
  }) => {
    await stubPreviewApis(page);
    await page.goto('/preview/sessions');

    const trigger = page.getByRole('button', { name: 'Open sidebar' });
    await trigger.click();
    await expectDrawerState(page, 'open');

    await page.setViewportSize({ width: 1024, height: 900 });

    await expectDrawerState(page, 'closed');
    await expect(page.getByRole('navigation', { name: 'Desktop navigation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sessions & Passport', exact: true })).toBeFocused();
  });

  test('closes the admin drawer and focuses desktop navigation after resizing', async ({
    page,
  }) => {
    await stubPreviewApis(page);
    await page.goto('/preview/admin/applications');

    const trigger = page.getByRole('button', { name: 'Open sidebar' });
    await trigger.click();
    await expectDrawerState(page, 'open');

    await page.setViewportSize({ width: 1024, height: 900 });

    await expectDrawerState(page, 'closed');
    await expect(page.getByRole('navigation', { name: 'Desktop navigation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Applications', exact: true })).toBeFocused();
  });

  test('keeps focus visible across repeated mobile and desktop breakpoint crossings', async ({
    page,
  }) => {
    await stubPreviewApis(page);
    await page.goto('/preview/sessions');

    const trigger = page.getByRole('button', { name: 'Open sidebar' });
    const desktopNavigation = page.getByRole('navigation', { name: 'Desktop navigation' });
    const sessionsLink = page.getByRole('link', { name: 'Sessions & Passport', exact: true });

    await trigger.click();
    await expectDrawerState(page, 'open');

    await page.setViewportSize({ width: 1024, height: 900 });
    await expectDrawerState(page, 'closed');
    await expect(desktopNavigation).toBeVisible();
    await expect(sessionsLink).toBeFocused();
    await expectVisibleFocusOutsideDrawer(page);

    await page.setViewportSize({ width: 375, height: 900 });
    await expectDrawerState(page, 'closed');
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeFocused();
    await expectVisibleFocusOutsideDrawer(page);

    await page.setViewportSize({ width: 1024, height: 900 });
    await expectDrawerState(page, 'closed');
    await expect(desktopNavigation).toBeVisible();
    await expect(sessionsLink).toBeFocused();
    await expectVisibleFocusOutsideDrawer(page);
  });

  test('keeps drawer state and focus aligned across zoom-equivalent layout changes', async ({
    page,
  }) => {
    await stubPreviewApis(page);
    await page.setViewportSize(PHYSICAL_VIEWPORT);
    await page.goto('/preview/sessions');

    const trigger = page.getByRole('button', { name: 'Open sidebar' });
    const closeButton = page.getByRole('button', { name: 'Close sidebar' });
    const desktopNavigation = page.getByRole('navigation', { name: 'Desktop navigation' });
    const sessionsLink = page.getByRole('link', { name: 'Sessions & Passport', exact: true });

    await expect(desktopNavigation).toBeVisible();
    await sessionsLink.focus();

    // Zooming in makes the effective CSS viewport mobile-sized without
    // changing the simulated physical viewport.
    await emulateBrowserZoom(page, 2);
    await expectDrawerState(page, 'closed');
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeFocused();
    await expectVisibleFocusOutsideDrawer(page);

    await trigger.click();
    await expectDrawerState(page, 'open');
    await expect(closeButton).toBeFocused();

    // Zooming back out while the drawer is open must close the hidden drawer
    // and move focus to the active desktop navigation item.
    await emulateBrowserZoom(page, 1);
    await expectDrawerState(page, 'closed');
    await expect(desktopNavigation).toBeVisible();
    await expect(sessionsLink).toBeFocused();
    await expectVisibleFocusOutsideDrawer(page);

    // A later zoom-in/zoom-out cycle must continue handing focus between the
    // visible trigger and active desktop link after the drawer has closed.
    await emulateBrowserZoom(page, 2);
    await expectDrawerState(page, 'closed');
    await expect(trigger).toBeFocused();
    await expectVisibleFocusOutsideDrawer(page);

    await emulateBrowserZoom(page, 1);
    await expectDrawerState(page, 'closed');
    await expect(sessionsLink).toBeFocused();
    await expectVisibleFocusOutsideDrawer(page);
  });

  test.describe('with reduced motion enabled', () => {
    test.use({ reducedMotion: 'reduce' });

    test('keeps focus visible across repeated mobile and desktop breakpoint crossings', async ({
      page,
    }) => {
      await stubPreviewApis(page);
      await page.goto('/preview/sessions');

      await expect.poll(() =>
        page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      ).toBe(true);

      const trigger = page.getByRole('button', { name: 'Open sidebar' });
      const desktopNavigation = page.getByRole('navigation', { name: 'Desktop navigation' });
      const sessionsLink = page.getByRole('link', { name: 'Sessions & Passport', exact: true });

      await trigger.click();
      await expectDrawerState(page, 'open');
      await expect(page.getByRole('button', { name: 'Close sidebar' })).toBeFocused();

      await page.setViewportSize({ width: 1024, height: 900 });
      await expectDrawerState(page, 'closed');
      await expect(desktopNavigation).toBeVisible();
      await expect(sessionsLink).toBeFocused();
      await expectVisibleFocusOutsideDrawer(page);

      await page.setViewportSize({ width: 375, height: 900 });
      await expectDrawerState(page, 'closed');
      await expect(trigger).toBeVisible();
      await expect(trigger).toBeFocused();
      await expectVisibleFocusOutsideDrawer(page);

      await page.setViewportSize({ width: 1024, height: 900 });
      await expectDrawerState(page, 'closed');
      await expect(desktopNavigation).toBeVisible();
      await expect(sessionsLink).toBeFocused();
      await expectVisibleFocusOutsideDrawer(page);
    });
  });
});
