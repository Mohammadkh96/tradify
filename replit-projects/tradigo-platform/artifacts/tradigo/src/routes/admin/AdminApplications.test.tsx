import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApplications } from './AdminApplications';

vi.mock('../../lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

describe('AdminApplications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compares a linked earlier attempt with its decision evidence in read-only mode', async () => {
    render(<AdminApplications demoMode />);

    expect(await screen.findByRole('heading', { name: 'Coach Applications' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Compare attempts' }));

    const comparison = screen.getByRole('region', { name: 'Compare application attempts' });
    const currentCard = within(comparison).getByText('Current submission').closest('div.rounded-lg');
    const earlierCard = within(comparison).getByText('Earlier application').closest('div.rounded-lg');
    expect(currentCard).not.toBeNull();
    expect(earlierCard).not.toBeNull();
    const current = within(currentCard as HTMLElement);
    const earlier = within(earlierCard as HTMLElement);

    expect(current.getAllByText('New in this attempt').length).toBeGreaterThan(0);
    expect(current.getAllByText('Changed').length).toBeGreaterThan(0);
    expect(earlier.getAllByText('Missing prior evidence').length).toBeGreaterThan(0);
    expect(earlier.getByText('Attempt 1')).toBeInTheDocument();
    expect(earlier.getByText('REJECTED')).toBeInTheDocument();
    expect(earlier.getByText(
      'Please add a clearer teaching sample and explain how you keep coaching within education-only boundaries.',
    )).toBeInTheDocument();
    expect(earlier.getByText(/KNOWLEDGE 8\/10 · PASSED/)).toBeInTheDocument();
    expect(earlier.getByText('Coach application declaration')).toBeInTheDocument();

    expect(earlier.getByRole('button', { name: 'Open earlier application' })).toBeInTheDocument();
    expect(earlier.queryByRole('button', { name: /approve|reject|edit|decision/i })).not.toBeInTheDocument();
  });
});