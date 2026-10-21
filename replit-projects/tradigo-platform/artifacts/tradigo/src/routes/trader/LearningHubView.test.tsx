import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { LearningHubView } from './LearningHubView';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('learning data identity isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      firebaseUser: { uid: 'firebase-user-a' } as any,
      canonicalUser: { id: 'user-a', role: 'TRADER', status: 'ACTIVE' } as any,
    });
  });
  afterEach(cleanup);

  it('does not render a previous account journal after an account switch', async () => {
    let resolveAccountA!: (value: unknown) => void;
    const accountAResponse = new Promise((resolve) => {
      resolveAccountA = resolve;
    });
    let journalRequestCount = 0;
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/journal' && journalRequestCount++ === 0) return accountAResponse as any;
      return Promise.resolve({ entries: [] });
    });

    const view = render(<LearningHubView />);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/journal'));

    await act(async () => {
      useAuthStore.setState({
        firebaseUser: { uid: 'firebase-user-b' } as any,
        canonicalUser: { id: 'user-b', role: 'TRADER', status: 'ACTIVE' } as any,
      });
    });
    view.rerender(<LearningHubView />);
    await waitFor(() => expect(screen.getByText('No journal entries yet')).toBeInTheDocument());

    await act(async () => {
      resolveAccountA({
        entries: [{
          id: 'account-a-note',
          title: 'Private account A note',
          body: 'This note belongs to account A.',
          entryType: 'GENERAL',
          visibility: 'TRADER_PRIVATE',
          entryDate: '2026-08-25T12:00:00.000Z',
          version: 1,
        }],
      });
    });
    await waitFor(() => expect(screen.queryByText('Private account A note')).not.toBeInTheDocument());
  });
});