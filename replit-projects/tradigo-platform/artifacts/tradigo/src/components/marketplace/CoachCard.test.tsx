import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { CoachCard } from './CoachCard';
import type { CoachMarketplaceDTO } from '../../types';

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

describe('CoachCard', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('font-size');
  });

  it('opens the coach profile when View Profile is pressed', () => {
    render(
      <MemoryRouter initialEntries={['/app/coaches?q=momentum%20plan&market=CRYPTO&specialty=STRATEGY&sort=EXPERIENCE&page=2']}>
        <Routes>
          <Route path="/app/coaches" element={<CoachCard coach={coach} onFavoriteToggle={vi.fn()} />} />
          <Route path="/app/coaches/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: "View Maya Chen's profile" }));

    expect(screen.getByTestId('location')).toHaveTextContent('/app/coaches/demo-coach-maya?q=momentum%20plan&market=CRYPTO&specialty=STRATEGY&sort=EXPERIENCE&page=2');
  });

  it('preserves marketplace filters when opening a profile from the preview route', () => {
    render(
      <MemoryRouter initialEntries={['/preview/coaches?q=price%20action&market=FOREX&specialty=MARKET_STRUCTURE&sort=PRICE_LOW_TO_HIGH&page=3']}>
        <Routes>
          <Route path="/preview/coaches" element={<CoachCard coach={coach} onFavoriteToggle={vi.fn()} />} />
          <Route path="/preview/coaches/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: "View Maya Chen's profile" }));

    expect(screen.getByTestId('location')).toHaveTextContent('/preview/coaches/demo-coach-maya?q=price%20action&market=FOREX&specialty=MARKET_STRUCTURE&sort=PRICE_LOW_TO_HIGH&page=3');
  });

  it('wraps narrow-card content without hiding the profile action', () => {
    const longNameCoach = {
      ...coach,
      displayName: 'A Coach With A Deliberately Long Name',
    };

    render(
      <MemoryRouter initialEntries={['/app/coaches']}>
        <CoachCard coach={longNameCoach} onFavoriteToggle={vi.fn()} />
      </MemoryRouter>,
    );

    const profileAction = screen.getByRole('button', { name: "View A Coach With A Deliberately Long Name's profile" });
    const card = profileAction.closest('div.group');

    expect(card).toHaveClass('overflow-hidden');
    expect(card!.querySelector('h3')).toHaveClass('truncate');
    expect(card!.querySelector('.flex.flex-wrap.items-center.gap-3')).toBeInTheDocument();
    expect(profileAction).toHaveClass('shrink-0');
  });

  it('keeps both coach-card actions reachable at a 200% text-size equivalent', () => {
    document.documentElement.style.fontSize = '32px';
    render(
      <MemoryRouter initialEntries={['/app/coaches']}>
        <CoachCard coach={coach} onFavoriteToggle={vi.fn()} />
      </MemoryRouter>,
    );

    const card = screen.getByRole('button', { name: "View Maya Chen's profile" }).closest('div.group');
    expect(document.documentElement).toHaveStyle({ fontSize: '32px' });
    expect(card).toHaveClass('min-w-0', 'overflow-hidden');
    expect(screen.getByRole('button', { name: 'Save Maya Chen to favorites' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "View Maya Chen's profile" })).toBeInTheDocument();
    expect(card!.querySelector('.flex.flex-wrap.items-center.justify-between.gap-3')).toBeInTheDocument();
  });
});