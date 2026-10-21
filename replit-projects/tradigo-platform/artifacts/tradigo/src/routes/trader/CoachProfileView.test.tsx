import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { CoachProfileView } from './CoachProfileView';
import { apiClient } from '../../lib/apiClient';
import type { CoachMarketplaceDTO } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const coach: CoachMarketplaceDTO = {
  id: 'demo-coach-maya',
  displayName: 'Maya Chen',
  headline: 'Structure-first price action coach',
  bio: 'A repeatable process for reading structure.',
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
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe('CoachProfileView marketplace return navigation', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue(coach);
  });

  it.each([
    [
      'standard trader',
      '/app/coaches/demo-coach-maya?q=momentum%20plan&market=CRYPTO&specialty=STRATEGY&sort=EXPERIENCE&page=2',
      '/app/coaches/:id',
      '/app/coaches?q=momentum%20plan&market=CRYPTO&specialty=STRATEGY&sort=EXPERIENCE&page=2',
    ],
    [
      'preview trader',
      '/preview/coaches/demo-coach-maya?q=price%20action&market=FOREX&specialty=MARKET_STRUCTURE&sort=PRICE_LOW_TO_HIGH&page=3',
      '/preview/coaches/:id',
      '/preview/coaches?q=price%20action&market=FOREX&specialty=MARKET_STRUCTURE&sort=PRICE_LOW_TO_HIGH&page=3',
    ],
  ])('restores filters when a %s returns with Back to Marketplace', async (_, entry, profilePath, expectedPath) => {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={profilePath} element={<CoachProfileView />} />
          <Route path="/app/coaches" element={<LocationProbe />} />
          <Route path="/preview/coaches" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Maya Chen' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Back to Marketplace' }));

    expect(screen.getByTestId('location')).toHaveTextContent(expectedPath);
  });
});