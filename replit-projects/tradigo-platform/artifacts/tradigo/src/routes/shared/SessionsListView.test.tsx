import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router';
import { SessionsListView } from './SessionsListView';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const renderList = () =>
  render(
    <MemoryRouter initialEntries={['/app/sessions']}>
      <SessionsListView />
    </MemoryRouter>,
  );

describe('session list history explanations', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty('font-size');
  });

  it('labels every cancellation outcome and payment-release state', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [
        { id: 'ordinary', mode: 'SCHEDULED', status: 'CANCELLED', scheduledAt: '2026-08-25T12:00:00.000Z', durationMinutes: 30, amountCents: 3000, paymentStatus: 'VOIDED', createdAt: '2026-08-25T11:00:00.000Z' },
        { id: 'trader-no-show', mode: 'SCHEDULED', status: 'CANCELLED', noShowType: 'TRADER', scheduledAt: '2026-08-25T13:00:00.000Z', durationMinutes: 30, amountCents: 3000, paymentStatus: 'REFUNDED', createdAt: '2026-08-25T11:00:00.000Z' },
        { id: 'coach-no-show', mode: 'SCHEDULED', status: 'CANCELLED', noShowType: 'COACH', scheduledAt: '2026-08-25T14:00:00.000Z', durationMinutes: 30, amountCents: 3000, paymentStatus: 'REFUND_PENDING', createdAt: '2026-08-25T11:00:00.000Z' },
        { id: 'mutual-no-show', mode: 'SCHEDULED', status: 'CANCELLED', noShowType: 'MUTUAL', scheduledAt: '2026-08-25T15:00:00.000Z', durationMinutes: 30, amountCents: 3000, paymentStatus: 'NOT_STARTED', createdAt: '2026-08-25T11:00:00.000Z' },
      ],
    });

    renderList();

    await waitFor(() => expect(screen.getByText('History')).toBeInTheDocument());
    expect(screen.getByText('Cancelled · payment released')).toBeInTheDocument();
    expect(screen.getAllByText('No-show · trader absent')).toHaveLength(1);
    expect(screen.getAllByText('No-show · coach absent')).toHaveLength(1);
    expect(screen.getAllByText('No-show · both absent')).toHaveLength(1);
    expect(screen.getAllByText('Payment released')).toHaveLength(2);
    expect(screen.getByText('Payment release pending')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Session status: Cancelled · payment released' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /No-show · coach absent.*Payment release pending/ })).toBeInTheDocument();
  });

  it('shows the original scheduled time after a reschedule', async () => {
    const originalTime = '2026-08-25T12:00:00.000Z';
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [{
        id: 'rescheduled',
        mode: 'SCHEDULED',
        status: 'COMPLETED',
        scheduledAt: '2026-09-01T14:00:00.000Z',
        rescheduledFrom: originalTime,
        durationMinutes: 30,
        amountCents: 3000,
        paymentStatus: 'CAPTURED',
        createdAt: '2026-08-25T11:00:00.000Z',
      }],
    });

    renderList();

    await waitFor(() => expect(screen.getByText('History')).toBeInTheDocument());
    expect(screen.getByText(`Rescheduled from ${new Date(originalTime).toLocaleString()}`)).toBeInTheDocument();
    expect(screen.getByLabelText(/Session rescheduled from/)).toHaveAttribute('aria-label', expect.stringContaining('to'));
    expect(screen.queryByText(/coach-1|trader-1/)).not.toBeInTheDocument();
  });

  it('keeps session outcomes accessible without relying on status color', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [{
        id: 'accessible-outcome',
        mode: 'SCHEDULED',
        status: 'CANCELLED',
        topic: 'Risk review',
        scheduledAt: '2026-08-25T12:00:00.000Z',
        rescheduledFrom: '2026-08-24T12:00:00.000Z',
        durationMinutes: 30,
        amountCents: 3000,
        paymentStatus: 'REFUND_PENDING',
        createdAt: '2026-08-25T11:00:00.000Z',
      }],
    });

    const { container } = renderList();

    await waitFor(() => expect(screen.getByRole('main', { name: 'Your sessions' })).toBeInTheDocument());
    expect(screen.getByRole('list', { name: 'Session history list' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Cancelled · payment released');
    expect(screen.getByRole('link', {
      name: /Risk review\. Status: Cancelled · payment released\. Payment release pending/,
    })).toBeInTheDocument();
    expect(screen.getByLabelText(/Session rescheduled from/)).toHaveAttribute('aria-label', expect.stringContaining('to'));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('makes a completed lesson passport reachable from the sessions history', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        items: [{
          id: 'completed-session',
          mode: 'SCHEDULED',
          status: 'COMPLETED',
          topic: 'Structure review',
          scheduledAt: '2026-08-25T12:00:00.000Z',
          durationMinutes: 25,
          amountCents: 2500,
          paymentStatus: 'CAPTURED',
          createdAt: '2026-08-25T11:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({
        records: [{
          id: 'learning-record',
          sessionId: 'completed-session',
          learningGoal: 'Slow down before entering',
          status: 'COMPLETE',
          scheduledAt: '2026-08-25T12:00:00.000Z',
        }],
      });

    renderList();

    await waitFor(() => expect(screen.getByText('History')).toBeInTheDocument());
    expect(screen.getByRole('link', {
      name: /Slow down before entering\. Summary complete\. Open passport/,
    })).toHaveAttribute('href', '/app/sessions/completed-session');
    expect(screen.getByRole('link', {
      name: /Structure review\. Status: COMPLETED\. Open passport\./,
    })).toHaveAttribute('href', '/app/sessions/completed-session');
  });

  it('keeps session handoffs and learning records wrapped at a 200% text-size equivalent', async () => {
    document.documentElement.style.fontSize = '32px';
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        items: [{
          id: 'long-session',
          mode: 'SCHEDULED',
          status: 'ROOM_READY',
          topic: 'A long coaching handoff about reviewing evidence before entering',
          scheduledAt: '2026-08-25T12:00:00.000Z',
          durationMinutes: 45,
          amountCents: 4500,
          paymentStatus: 'PAYPAL_AUTHORIZED',
          paymentNextAction: 'Start the session or contact support before the authorization expires.',
          createdAt: '2026-08-25T11:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({
        records: [{
          id: 'long-learning-record',
          sessionId: 'long-session',
          learningGoal: 'Build a repeatable review habit before entering a position',
          status: 'COMPLETE',
          scheduledAt: '2026-08-25T12:00:00.000Z',
          practiceSteps: 'Practice the checklist on three historical examples before the next lesson.',
        }],
      });

    renderList();

    await waitFor(() => expect(screen.getByText('Open and upcoming')).toBeInTheDocument());

    const passportLink = screen.getByRole('link', {
      name: /Build a repeatable review habit before entering a position\. Summary complete\. Open passport/,
    });
    expect(passportLink).toHaveClass('min-w-0', 'flex-col');
    expect(passportLink.querySelector('span')).toHaveClass('max-w-full', 'whitespace-normal');
    expect(passportLink).toHaveTextContent('Practice the checklist on three historical examples');

    const sessionLink = screen.getByRole('link', {
      name: /A long coaching handoff about reviewing evidence before entering\. Status: ROOM READY\. Open session/,
    });
    expect(sessionLink).toHaveClass('min-w-0', 'flex-col');
    expect(sessionLink.querySelector('span:last-child')).toHaveClass('max-w-full', 'whitespace-normal');
    expect(screen.getByText(/Payment hold expires/)).toBeVisible();
  });

  it('makes a failed no-show settlement visible before payment release completes', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [{
        id: 'failed-no-show',
        mode: 'SCHEDULED',
        status: 'ROOM_READY',
        topic: 'Scheduled review',
        scheduledAt: '2026-08-25T12:00:00.000Z',
        durationMinutes: 25,
        amountCents: 2500,
        paymentStatus: 'PAYPAL_AUTHORIZED',
        createdAt: '2026-08-25T11:00:00.000Z',
        noShowResolutionFailure: {
          id: 19,
          createdAt: '2026-08-25T12:45:00.000Z',
          message: 'PayPal could not release the authorization.',
          paymentStatus: 'PAYPAL_AUTHORIZED',
          retryable: true,
          nextAction: 'Retry automatically on the next worker pass; investigate if the failure persists.',
        },
      }],
    });

    renderList();

    await waitFor(() => expect(screen.getByText('Open and upcoming')).toBeInTheDocument());
    expect(screen.getByText('No-show settlement needs attention — Tradigo is retrying the payment release.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Scheduled review\. Status: ROOM READY\. Open session\./ })).toBeInTheDocument();
  });

  it('does not render the previous account history after an account switch', async () => {
    let resolveAccountA!: (value: unknown) => void;
    const accountAResponse = new Promise((resolve) => {
      resolveAccountA = resolve;
    });
    let sessionRequestCount = 0;
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/sessions' && sessionRequestCount++ === 0) return accountAResponse as any;
      if (url === '/api/sessions') return Promise.resolve({ items: [] });
      return Promise.resolve({ records: [] });
    });
    useAuthStore.setState({
      firebaseUser: { uid: 'firebase-user-a' } as any,
      canonicalUser: { id: 'user-a', role: 'TRADER', status: 'ACTIVE' } as any,
    });

    renderList();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/sessions'));

    await act(async () => {
      useAuthStore.getState().setFirebaseUser({ uid: 'firebase-user-b' } as any);
    });
    await waitFor(() => expect(screen.getByText('No open sessions yet.')).toBeInTheDocument());

    await act(async () => {
      resolveAccountA({
        items: [{
          id: 'account-a-session',
          mode: 'SCHEDULED',
          status: 'COMPLETED',
          topic: 'Private account A history',
          scheduledAt: '2026-08-25T12:00:00.000Z',
          durationMinutes: 30,
          amountCents: 3000,
          paymentStatus: 'CAPTURED',
          createdAt: '2026-08-25T11:00:00.000Z',
        }],
      });
    });
    await waitFor(() => expect(screen.queryByText('Private account A history')).not.toBeInTheDocument());
  });
});