import { expect, test, type Page } from '@playwright/test';

const coach = {
  id: 'browser-test-coach',
  displayName: 'Maya Chen',
  headline: 'Structure-first price action coach',
  bio: 'A clear and practical learning plan for reading structure and planning risk.',
  markets: ['FOREX'],
  supportedInstruments: ['FOREX'],
  specialties: ['MARKET_STRUCTURE'],
  languages: ['English'],
  yearsOfExperience: 8,
  hourlyRateCents: 14500,
  instantRatePerMinuteCents: 242,
  currency: 'USD',
  verificationStatus: 'FULLY_VERIFIED',
  ratingAverage: 4.9,
  ratingCount: 128,
  approved: true,
  availability: 'AVAILABLE',
};

const authenticatedTrader = {
  user: {
    id: 'browser-text-enlargement-trader',
    email: 'text-enlargement-trader@example.test',
    displayName: 'Browser Test Trader',
    role: 'TRADER',
    status: 'ACTIVE',
    countryCode: 'US',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  traderProfile: {
    userId: 'browser-text-enlargement-trader',
    experienceLevel: 'INTERMEDIATE',
    preferredMarkets: ['FOREX'],
    instruments: ['FOREX'],
    tradingStyles: ['Swing'],
    methodologies: ['Price action'],
    onboardingCurrentStep: 4,
    onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    totalSessionsCompleted: 0,
    totalSpentCents: 0,
    blockedCoachIds: [],
  },
  coachApplicationStatus: null,
};

const authenticatedCoach = {
  user: {
    id: 'browser-text-enlargement-coach',
    email: 'text-enlargement-coach@example.test',
    displayName: coach.displayName,
    role: 'COACH',
    status: 'ACTIVE',
    countryCode: 'US',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  coachProfile: {
    userId: 'browser-text-enlargement-coach',
    headline: coach.headline,
    bio: coach.bio,
    approved: true,
    verificationStatus: coach.verificationStatus,
  },
  traderProfile: null,
  coachApplicationStatus: 'APPROVED',
};

async function stubPreviewApis(page: Page) {
  await page.route('**/api/**', (route) =>
    route.fulfill({ json: { items: [], request: null } }),
  );
  await page.route('**/api/auth/demo', (route) =>
    route.fulfill({ json: { previewToken: 'browser-text-enlargement-test' } }),
  );
  await page.route('**/api/marketplace/coaches**', (route) =>
    route.fulfill({
      json: {
        items: [coach],
        total: 1,
        totalPages: 1,
      },
    }),
  );
  await page.route('**/api/coach-now/requests/current', (route) =>
    route.fulfill({ json: { request: null } }),
  );
}

async function stubAuthenticatedTraderApis(page: Page) {
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname === '/api/auth/me') {
      await route.fulfill({ json: authenticatedTrader });
      return;
    }

    if (pathname.startsWith('/api/marketplace/coaches')) {
      await route.fulfill({
        json: {
          items: [coach],
          total: 1,
          totalPages: 1,
        },
      });
      return;
    }

    if (pathname === '/api/coach-now/requests/current') {
      await route.fulfill({ json: { request: null } });
      return;
    }

    await route.fulfill({ json: { items: [], records: [], request: null } });
  });
}

async function stubAuthenticatedSessionsApis(
  page: Page,
  authenticatedProfile = authenticatedTrader,
) {
  const completedSession = {
    id: 'browser-text-enlargement-session',
    coachId: 'browser-test-coach',
    traderId: authenticatedTrader.user.id,
    mode: 'SCHEDULED',
    status: 'COMPLETED',
    scheduledAt: '2026-08-25T12:00:00.000Z',
    durationMinutes: 45,
    amountCents: 4500,
    finalAmountCents: 4500,
    billableSeconds: 2700,
    paymentStatus: 'CAPTURED',
    paymentApprovalUrl: null,
    roomName: null,
    createdAt: '2026-08-25T11:00:00.000Z',
    topic: 'Build a repeatable review habit before entering a position',
    coachName: coach.displayName,
    learningRecord: {
      learningGoal: 'Build a repeatable review habit before entering a position',
      conceptsReviewed: 'Market structure, confirmation, and deliberate entry review.',
      evidenceDiscussed: 'Three historical examples with clear invalidation points.',
      sharedArtifact: 'A pre-entry checklist for the next practice session.',
      unresolvedQuestions: 'How to keep the review concise during a fast market.',
      practiceSteps: 'Practice the checklist on three historical examples before the next lesson.',
      traderReflection: null,
      status: 'COMPLETE',
    },
  };

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname === '/api/auth/me') {
      await route.fulfill({ json: authenticatedProfile });
      return;
    }

    if (pathname === '/api/sessions') {
      await route.fulfill({
        json: {
          items: [completedSession],
        },
      });
      return;
    }

    if (pathname === '/api/learning/passport') {
      await route.fulfill({
        json: {
          records: [{
            id: 'browser-text-enlargement-passport',
            sessionId: completedSession.id,
            learningGoal: completedSession.learningRecord.learningGoal,
            status: 'COMPLETE',
            scheduledAt: completedSession.scheduledAt,
            practiceSteps: completedSession.learningRecord.practiceSteps,
          }],
        },
      });
      return;
    }

    if (pathname === `/api/sessions/${completedSession.id}`) {
      await route.fulfill({ json: { session: completedSession } });
      return;
    }

    if (pathname === '/api/coach-now/requests/current') {
      await route.fulfill({ json: { request: null } });
      return;
    }

    await route.fulfill({ json: { items: [], records: [], request: null } });
  });
}

async function enlargeText(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => {
    const shell = document.querySelector('[data-testid="app-shell"]');
    const surface = document.querySelector('[data-testid="trader-surface"]');
    const header = document.querySelector('[data-testid="app-shell-header"]');
    return {
      viewport: window.innerWidth,
      document: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ),
      shell: shell?.scrollWidth ?? 0,
      shellClient: shell?.clientWidth ?? 0,
      traderSurface: surface?.scrollWidth ?? 0,
      traderSurfaceClient: surface?.clientWidth ?? 0,
      header: header?.scrollWidth ?? 0,
      headerClient: header?.clientWidth ?? 0,
    };
  });

  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.shell).toBeLessThanOrEqual(widths.viewport);
  expect(widths.shell).toBeLessThanOrEqual(widths.shellClient);
  expect(widths.traderSurface).toBeLessThanOrEqual(widths.viewport);
  expect(widths.traderSurface).toBeLessThanOrEqual(widths.traderSurfaceClient);
  expect(widths.header).toBeLessThanOrEqual(widths.headerClient);
}

async function expectFocusable(page: Page, locator: ReturnType<Page['getByRole']>) {
  await expect(locator).toBeVisible();
  await locator.focus();
  await expect(locator).toBeFocused();
}

async function expectShellControlsUsable(page: Page) {
  const header = page.getByTestId('app-shell-header');
  await expect(header).toBeVisible();

  const controls = [
    page.getByRole('button', { name: 'Notifications' }),
    page.getByTitle('Light mode'),
    page.getByTitle('Dark mode'),
    page.getByTitle('System theme'),
  ];
  const mobileMenuTrigger = page.getByRole('button', { name: 'Open sidebar' });
  if (await mobileMenuTrigger.isVisible()) {
    controls.unshift(mobileMenuTrigger);
  } else {
    await expect(
      page.getByRole('navigation', { name: 'Desktop navigation' }),
    ).toBeVisible();
  }
  const controlBoxes = [];

  for (const control of controls) {
    await expectFocusable(page, control);
    const [headerBox, controlBox] = await Promise.all([
      header.boundingBox(),
      control.boundingBox(),
    ]);
    expect(headerBox).not.toBeNull();
    expect(controlBox).not.toBeNull();
    expect(controlBox!.x).toBeGreaterThanOrEqual(headerBox!.x);
    expect(controlBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
    expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(
      headerBox!.x + headerBox!.width,
    );
    expect(controlBox!.y + controlBox!.height).toBeLessThanOrEqual(
      headerBox!.y + headerBox!.height,
    );
    controlBoxes.push(controlBox!);
  }

  for (let index = 1; index < controlBoxes.length; index += 1) {
    expect(controlBoxes[index - 1].x + controlBoxes[index - 1].width).toBeLessThanOrEqual(
      controlBoxes[index].x,
    );
  }
}

test.describe('trader text enlargement', () => {
  test('keeps dashboard actions within the viewport at 200% text size', async ({
    page,
  }) => {
    await stubPreviewApis(page);
    await page.goto('/preview');
    await expect(
      page.getByRole('heading', { name: 'Keep your learning moving.' }),
    ).toBeVisible();

    await enlargeText(page);
    await expectNoHorizontalOverflow(page);
    await expectShellControlsUsable(page);

    await expectFocusable(
      page,
      page.getByRole('link', { name: 'Find a coach' }).first(),
    );
    await expectFocusable(
      page,
      page.getByRole('link', { name: 'Coach Now' }).first(),
    );
    await expectFocusable(
      page,
      page.getByRole('link', { name: 'Review sessions' }),
    );
    await expectFocusable(
      page,
      page.getByRole('link', { name: 'Choose your next coach' }),
    );
  });

  test('keeps intake, filters, and coach-card actions reachable on Find a Coach', async ({
    page,
  }) => {
    await stubPreviewApis(page);
    await page.goto('/preview/coaches');
    await expect(
      page.getByRole('heading', { name: 'Find a Coach' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Find a teaching fit' }),
    ).toBeVisible();
    await expect(page.getByText('Maya Chen')).toBeVisible();

    await enlargeText(page);
    await expectNoHorizontalOverflow(page);

    const intake = page
      .getByRole('heading', { name: 'Find a teaching fit' })
      .locator('xpath=ancestor::section[1]');
    for (const control of await intake.getByRole('combobox').all()) {
      await expectFocusable(page, control);
    }
    await expectFocusable(
      page,
      intake.getByRole('button', { name: 'Show teaching matches' }),
    );

    const search = page.getByPlaceholder(
      'Search by name, specialties, or bio...',
    );
    await expectFocusable(page, search);
    const filterRow = search.locator('..').locator('..');
    for (const control of await filterRow.getByRole('combobox').all()) {
      await expectFocusable(page, control);
    }

    const favorite = page.getByRole('button', {
      name: 'Save Maya Chen to favorites',
    });
    await expectFocusable(page, favorite);
    await expectFocusable(
      page,
      page.getByRole('button', { name: "View Maya Chen's profile" }),
    );
    await expectNoHorizontalOverflow(page);
  });

  test('keeps the authenticated dashboard actions within the viewport at 200% text size', async ({
    page,
  }) => {
    await stubAuthenticatedTraderApis(page);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole('heading', { name: 'Keep your learning moving.' }),
    ).toBeVisible();

    await enlargeText(page);
    await expectNoHorizontalOverflow(page);
    await expectShellControlsUsable(page);

    await expectFocusable(
      page,
      page.getByRole('link', { name: 'Find a coach' }).first(),
    );
    await expectFocusable(
      page,
      page.getByRole('link', { name: 'Coach Now' }).first(),
    );
    await expectFocusable(
      page,
      page.getByRole('link', { name: 'Review sessions' }),
    );
    await expectFocusable(
      page,
      page.getByRole('link', { name: 'Choose your next coach' }),
    );
  });

  test('keeps authenticated intake, filters, and coach-card actions reachable on Find a Coach', async ({
    page,
  }) => {
    await stubAuthenticatedTraderApis(page);
    await page.goto('/app/coaches');
    await expect(page).toHaveURL(/\/app\/coaches$/);
    await expect(
      page.getByRole('heading', { name: 'Find a Coach' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Find a teaching fit' }),
    ).toBeVisible();
    await expect(page.getByText('Maya Chen')).toBeVisible();

    await enlargeText(page);
    await expectNoHorizontalOverflow(page);
    await expectShellControlsUsable(page);

    const intake = page
      .getByRole('heading', { name: 'Find a teaching fit' })
      .locator('xpath=ancestor::section[1]');
    for (const control of await intake.getByRole('combobox').all()) {
      await expectFocusable(page, control);
    }
    await expectFocusable(
      page,
      intake.getByRole('button', { name: 'Show teaching matches' }),
    );

    const search = page.getByPlaceholder(
      'Search by name, specialties, or bio...',
    );
    await expectFocusable(page, search);
    const filterRow = search.locator('..').locator('..');
    for (const control of await filterRow.getByRole('combobox').all()) {
      await expectFocusable(page, control);
    }

    const favorite = page.getByRole('button', {
      name: 'Save Maya Chen to favorites',
    });
    await expectFocusable(page, favorite);
    await expectFocusable(
      page,
      page.getByRole('button', { name: "View Maya Chen's profile" }),
    );
    await expectNoHorizontalOverflow(page);
  });

  test('keeps session history and Passport actions reachable at 200% text size', async ({
    page,
  }) => {
    await stubAuthenticatedSessionsApis(page);
    await page.goto('/app/sessions');
    await expect(page).toHaveURL(/\/app\/sessions$/);
    await expect(
      page.getByRole('heading', { name: 'Your sessions' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Your learning passport' }),
    ).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Session history list' }),
    ).toBeVisible();

    await enlargeText(page);
    await expectNoHorizontalOverflow(page);
    await expectShellControlsUsable(page);

    const passportLink = page.getByRole('link', {
      name: /Build a repeatable review habit before entering a position\. Summary complete\. Open passport/,
    });
    const historyLink = page.getByRole('link', {
      name: /Build a repeatable review habit before entering a position\. Status: COMPLETED\. Open passport\./,
    });
    await expectFocusable(page, passportLink);
    await expectFocusable(page, historyLink);

    await passportLink.click();
    await expect(page).toHaveURL(/\/app\/sessions\/browser-text-enlargement-session$/);
    await expect(
      page.getByRole('heading', { name: 'Keep what you learn.' }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectShellControlsUsable(page);

    await expectFocusable(page, page.getByRole('button', { name: 'Close passport' }));
    await expectFocusable(page, page.getByRole('button', { name: 'Replay notes' }));
    await expectFocusable(page, page.getByRole('button', { name: 'Replay stamp' }));
  });

  test('keeps coach learning-record fields and actions reachable at 200% text size', async ({
    page,
  }) => {
    await stubAuthenticatedSessionsApis(page, authenticatedCoach);
    await page.goto('/coach/sessions/browser-text-enlargement-session');
    await expect(page).toHaveURL(/\/coach\/sessions\/browser-text-enlargement-session$/);
    await expect(
      page.getByRole('heading', { name: 'Consultation Completed' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Trader learning passport' }),
    ).toBeVisible();

    await enlargeText(page);
    await expectNoHorizontalOverflow(page);
    await expectShellControlsUsable(page);

    for (const label of [
      'Concepts reviewed',
      'Evidence discussed',
      'Shared learning artifact',
      'Open questions',
      'Practice plan',
    ]) {
      await expectFocusable(page, page.getByLabel(label));
    }
    await expectFocusable(
      page,
      page.getByRole('button', { name: 'Update learning summary' }),
    );
    await expectFocusable(page, page.getByTestId('button-return-dashboard'));
    await expectNoHorizontalOverflow(page);
  });
});
