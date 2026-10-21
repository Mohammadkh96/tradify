import { expect, test, type Page, type Route } from '@playwright/test';

const latestCoach = {
  id: 'browser-latest-coach',
  displayName: 'Newest Coach',
  headline: 'Current search result',
  bio: 'A practical process for the current marketplace search.',
  markets: ['FOREX'],
  supportedInstruments: ['FOREX'],
  specialties: ['STRATEGY'],
  languages: ['English'],
  yearsOfExperience: 7,
  hourlyRateCents: 15000,
  instantRatePerMinuteCents: 250,
  currency: 'USD',
  verificationStatus: 'FULLY_VERIFIED',
  ratingAverage: 4.9,
  ratingCount: 42,
  approved: true,
  availability: 'AVAILABLE',
};

const staleCoach = {
  ...latestCoach,
  id: 'browser-stale-coach',
  displayName: 'Older Coach',
  headline: 'Stale search result',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function fulfillPreviewApi(route: Route) {
  const pathname = new URL(route.request().url()).pathname;

  if (pathname === '/api/auth/demo') {
    await route.fulfill({ json: { previewToken: 'browser-marketplace-race-test' } });
    return;
  }

  await route.fulfill({ json: { items: [], request: null } });
}

async function setupSearchRace(
  page: Page,
  options: {
    initialResponse: 'error' | 'success';
    latestResponse: 'error' | 'success';
    recoveryResponse?: 'error' | 'success';
  },
) {
  const initialSeen = deferred();
  const latestSeen = deferred();
  const recoverySeen = deferred();
  const initialSettled = deferred();
  const latestSettled = deferred();
  const recoverySettled = deferred();
  const releaseInitial = deferred();
  const releaseLatest = deferred();
  const releaseRecovery = deferred();

  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname !== '/api/marketplace/coaches') {
      await fulfillPreviewApi(route);
      return;
    }

    const query = requestUrl.searchParams.get('q') ?? '';
    if (!query) {
      initialSeen.resolve();
      try {
        await releaseInitial.promise;
        if (options.initialResponse === 'error') {
          await route.fulfill({ status: 503, json: { message: 'stale marketplace failure' } });
        } else {
          await route.fulfill({
            json: { items: [staleCoach], total: 9, totalPages: 9 },
          });
        }
      } catch {
        // The marketplace intentionally aborts obsolete requests.
      } finally {
        initialSettled.resolve();
      }
      return;
    }

    if (query === 'newer search' || query === 'recovered search') {
      const isRecovery = query === 'recovered search';
      if (isRecovery) {
        recoverySeen.resolve();
        await releaseRecovery.promise;
      } else {
        latestSeen.resolve();
        await releaseLatest.promise;
      }
      const response = isRecovery ? (options.recoveryResponse ?? options.latestResponse) : options.latestResponse;
      if (response === 'error') {
        await route.fulfill({ status: 503, json: { message: 'current marketplace failure' } });
      } else {
        await route.fulfill({
          json: { items: [latestCoach], total: 13, totalPages: 2 },
        });
      }
      if (isRecovery) {
        recoverySettled.resolve();
      } else {
        latestSettled.resolve();
      }
      return;
    }

    await route.fulfill({ json: { items: [], total: 0, totalPages: 1 } });
  });

  return {
    initialSeen: initialSeen.promise,
    latestSeen: latestSeen.promise,
    recoverySeen: recoverySeen.promise,
    initialSettled: initialSettled.promise,
    latestSettled: latestSettled.promise,
    recoverySettled: recoverySettled.promise,
    releaseInitial: releaseInitial.resolve,
    releaseLatest: releaseLatest.resolve,
    releaseRecovery: releaseRecovery.resolve,
  };
}

async function openMarketplace(page: Page) {
  await page.goto('/preview/coaches');
  await expect(page.getByRole('heading', { name: 'Find a Coach' })).toBeVisible();
  return page.getByPlaceholder('Search by name, specialties, or bio...');
}

test.describe('marketplace search races', () => {
  test('records an Enter search with one marketplace request for the changed term', async ({ page }) => {
    const marketplaceQueries: string[] = [];

    await page.route('**/api/**', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname === '/api/marketplace/coaches') {
        const query = requestUrl.searchParams.get('q') ?? '';
        marketplaceQueries.push(query);
        await route.fulfill({
          json: {
            items: [],
            total: query ? 1 : 0,
            totalPages: 1,
          },
        });
        return;
      }

      await fulfillPreviewApi(route);
    });

    const search = await openMarketplace(page);
    await expect.poll(
      () => marketplaceQueries.filter((query) => query === '').length,
    ).toBeGreaterThan(0);

    await search.fill('strategy');
    await search.press('Enter');

    await expect(page.getByRole('heading', { name: 'Recent Coach Searches' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'strategy', exact: true })).toBeVisible();
    await expect.poll(
      () => marketplaceQueries.filter((query) => query === 'strategy').length,
    ).toBe(1);

    // Allow the normal typing debounce to elapse so a duplicate delayed request
    // would be observed before the assertion completes.
    await page.waitForTimeout(400);
    expect(marketplaceQueries.filter((query) => query === 'strategy')).toHaveLength(1);
  });

  test('keeps the newest results, pagination, and loading state after an older response fails', async ({
    page,
  }) => {
    const race = await setupSearchRace(page, {
      initialResponse: 'error',
      latestResponse: 'success',
    });
    const search = await openMarketplace(page);

    await race.initialSeen;
    await expect(page.getByRole('status', { name: 'Loading coaches' })).toBeVisible();

    await search.fill('newer search');
    await race.latestSeen;
    await expect(page.getByRole('status', { name: 'Loading coaches' })).toBeVisible();

    race.releaseLatest();
    await race.latestSettled;
    await expect(page.getByText('Newest Coach')).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading coaches' })).toBeHidden();

    race.releaseInitial();
    await race.initialSettled;
    await expect(page.getByText('Newest Coach')).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(page.getByText('Older Coach')).toBeHidden();
    await expect(page.getByRole('alert')).toBeHidden();
  });

  test('keeps the newest error visible after an older response succeeds', async ({ page }) => {
    const race = await setupSearchRace(page, {
      initialResponse: 'success',
      latestResponse: 'error',
    });
    const search = await openMarketplace(page);

    await race.initialSeen;
    await search.fill('newer search');
    await race.latestSeen;
    await expect(page.getByRole('status', { name: 'Loading coaches' })).toBeVisible();

    race.releaseLatest();
    await race.latestSettled;
    await expect(page.getByRole('alert')).toContainText(
      'The coach marketplace is temporarily unavailable.',
    );
    await expect(page.getByRole('status', { name: 'Loading coaches' })).toBeHidden();

    race.releaseInitial();
    await race.initialSettled;
    await expect(page.getByRole('alert')).toContainText(
      'The coach marketplace is temporarily unavailable.',
    );
    await expect(page.getByText('Older Coach')).toBeHidden();
    await expect(page.getByText('Newest Coach')).toBeHidden();
  });

  test('recovers with fresh marketplace results after a new search replaces a failed one', async ({ page }) => {
    const race = await setupSearchRace(page, {
      initialResponse: 'success',
      latestResponse: 'error',
      recoveryResponse: 'success',
    });
    const search = await openMarketplace(page);

    await race.initialSeen;
    await search.fill('newer search');
    await race.latestSeen;

    race.releaseLatest();
    await race.latestSettled;
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(
      'The coach marketplace is temporarily unavailable.',
    );
    await expect(page.getByRole('status', { name: 'Loading coaches' })).toBeHidden();

    await search.fill('recovered search');
    await race.recoverySeen;
    await expect(page.getByRole('status', { name: 'Loading coaches' })).toBeVisible();

    race.releaseRecovery();
    await race.recoverySettled;
    await expect(page.getByText('Newest Coach')).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(page.getByRole('alert')).toBeHidden();
    await expect(page.getByRole('status', { name: 'Loading coaches' })).toBeHidden();

    race.releaseInitial();
    await race.initialSettled;
  });
});