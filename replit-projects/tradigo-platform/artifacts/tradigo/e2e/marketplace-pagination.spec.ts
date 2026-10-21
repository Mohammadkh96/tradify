import { expect, test, type Page } from '@playwright/test';

const coachesByPage = {
  1: {
    id: 'browser-pagination-coach-one',
    displayName: 'Page One Coach',
  },
  2: {
    id: 'browser-pagination-coach-two',
    displayName: 'Page Two Coach',
  },
  3: {
    id: 'browser-pagination-coach-three',
    displayName: 'Page Three Coach',
  },
} as const;

function coachForPage(page: keyof typeof coachesByPage) {
  return {
    ...coachesByPage[page],
    headline: 'A practical trading process',
    bio: 'A clear and practical learning plan.',
    markets: ['FOREX'],
    supportedInstruments: ['FOREX'],
    specialties: ['STRATEGY'],
    languages: ['English'],
    yearsOfExperience: 5,
    hourlyRateCents: 10000,
    instantRatePerMinuteCents: 166,
    currency: 'USD',
    verificationStatus: 'FULLY_VERIFIED',
    ratingAverage: 5,
    ratingCount: 1,
    approved: true,
    availability: 'AVAILABLE',
  };
}

async function stubPreviewApis(page: Page) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url());

    if (requestUrl.pathname === '/api/auth/demo') {
      await route.fulfill({
        json: { previewToken: 'browser-marketplace-pagination-test' },
      });
      return;
    }

    if (requestUrl.pathname === '/api/marketplace/coaches') {
      const requestedPage = Number(requestUrl.searchParams.get('page') ?? '1');
      const pageNumber = (requestedPage in coachesByPage
        ? requestedPage
        : 1) as keyof typeof coachesByPage;

      await route.fulfill({
        json: {
          items: [coachForPage(pageNumber)],
          total: 3,
          totalPages: 3,
        },
      });
      return;
    }

    await route.fulfill({ json: { items: [], request: null } });
  });
}

test.describe('marketplace pagination', () => {
  test('announces page changes in the exposed live region', async ({ page }) => {
    await stubPreviewApis(page);
    await page.goto('/preview/coaches');

    const pagination = page.getByRole('navigation', {
      name: 'Marketplace pagination',
    });
    const pageStatus = pagination.getByRole('status');
    const next = pagination.getByRole('button', { name: 'Next' });
    const previous = pagination.getByRole('button', { name: 'Previous' });

    await expect(page.getByRole('heading', { name: 'Find a Coach' })).toBeVisible();
    await expect(page.getByText('Page One Coach')).toBeVisible();
    await expect(pageStatus).toHaveAttribute('aria-live', 'polite');
    await expect(pageStatus).toHaveAttribute('aria-atomic', 'true');
    await expect(pageStatus).toHaveText('Page 1 of 3');

    await next.click();
    await expect(pageStatus).toHaveText('Page 2 of 3');
    await expect(page.getByText('Page Two Coach')).toBeVisible();

    await previous.click();
    await expect(pageStatus).toHaveText('Page 1 of 3');
    await expect(page.getByText('Page One Coach')).toBeVisible();
  });
});