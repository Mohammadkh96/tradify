import { expect, test, type Page } from '@playwright/test';

const initialCoaches = [
  {
    id: 'browser-refresh-coach-one',
    displayName: 'Initial Coach One',
  },
  {
    id: 'browser-refresh-coach-two',
    displayName: 'Initial Coach Two',
  },
];

const refreshedCoach = {
  id: 'browser-refresh-coach-three',
  displayName: 'Refreshed Coach',
};

function coachProfile(coach: { id: string; displayName: string }) {
  return {
    ...coach,
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

async function stubAuthenticatedMarketplaceApis(page: Page) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url());

    if (requestUrl.pathname === '/api/auth/demo') {
      await route.fulfill({
        json: { previewToken: 'browser-marketplace-refresh-announcement-test' },
      });
      return;
    }

    if (requestUrl.pathname === '/api/marketplace/coaches') {
      const query = requestUrl.searchParams.get('q') ?? '';
      const market = requestUrl.searchParams.get('market') ?? '';

      if (market === 'CRYPTO') {
        await route.fulfill({
          json: {
            items: [],
            total: 0,
            totalPages: 1,
          },
        });
        return;
      }

      if (query === 'risk review') {
        await route.fulfill({
          json: {
            items: [coachProfile(refreshedCoach)],
            total: 2,
            totalPages: 2,
          },
        });
        return;
      }

      await route.fulfill({
        json: {
          items: initialCoaches.map(coachProfile),
          total: 2,
          totalPages: 2,
        },
      });
      return;
    }

    await route.fulfill({ json: { items: [], request: null } });
  });
}

test.describe('marketplace refresh announcements', () => {
  test('exposes search and filter counts once without duplicating pagination status', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tradigo-learning-needs', JSON.stringify({ skipped: true }));
    });
    await stubAuthenticatedMarketplaceApis(page);
    await page.goto('/preview/coaches');

    const announcement = page.getByRole('status', { name: 'Marketplace results' });
    const pagination = page.getByRole('navigation', {
      name: 'Marketplace pagination',
    });
    const paginationStatus = pagination.getByRole('status');
    const search = page.getByPlaceholder('Search by name, specialties, or bio...');

    await expect(page.getByRole('heading', { name: 'Find a Coach' })).toBeVisible();
    await expect(page.getByText('Initial Coach One')).toBeVisible();
    await expect(announcement).toHaveAttribute('aria-live', 'polite');
    await expect(announcement).toHaveAttribute('aria-atomic', 'true');
    await expect(announcement).toBeEmpty();
    await expect(paginationStatus).toHaveText('Page 1 of 2');

    await search.fill('risk review');
    await search.press('Enter');

    await expect(page.getByText('Refreshed Coach')).toBeVisible();
    await expect(announcement).toHaveText(
      'Marketplace results updated: 2 coaches loaded.',
    );
    await expect(announcement).not.toContainText('Page');
    await expect(paginationStatus).toHaveText('Page 1 of 2');
    await expect(page.locator('[role="status"]')).toHaveCount(2);

    await page.locator('select').first().selectOption('CRYPTO');

    await expect(page.getByText('No coaches found')).toBeVisible();
    await expect(announcement).toHaveText(
      'Marketplace results updated: 0 coaches loaded.',
    );
    await expect(announcement).not.toContainText('Page');
    await expect(page.getByRole('navigation', {
      name: 'Marketplace pagination',
    })).toHaveCount(0);
    await expect(page.locator('[role="status"]')).toHaveCount(1);
  });
});