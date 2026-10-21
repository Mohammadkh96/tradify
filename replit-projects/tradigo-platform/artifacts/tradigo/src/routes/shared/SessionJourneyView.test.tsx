import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { SessionJourneyView } from './SessionJourneyView';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../lib/apiClient';

vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const SESSION_ID = 'session-handoff-1';

const sessionFor = (status: string, overrides: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  coachId: 'coach-1',
  traderId: 'trader-1',
  mode: 'INSTANT',
  status,
  scheduledAt: '2026-08-25T12:00:00.000Z',
  durationMinutes: 15,
  amountCents: 3630,
  paymentStatus: status === 'ROOM_READY' || status === 'ACTIVE' ? 'AUTHORIZED_SANDBOX' : 'NOT_STARTED',
  paymentApprovalUrl: status === 'PAYMENT_READY' ? null : null,
  roomName: `tradigo-${SESSION_ID}`,
  createdAt: '2026-08-25T11:00:00.000Z',
  ...overrides,
});

const setRole = (role: 'TRADER' | 'COACH') => {
  vi.mocked(useAuthStore).mockReturnValue({
    canonicalUser: { id: role === 'TRADER' ? 'trader-1' : 'coach-1', role, status: 'ACTIVE' },
  } as never);
};

const renderJourney = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path.replace(SESSION_ID, ':sessionId')} element={<SessionJourneyView />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe('coaching handoff lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty('font-size');
  });

  it('keeps both roles in sync through request, payment, room, completion, and earnings', async () => {
    let status = 'REQUESTED';
    const getSession = vi.fn(async () => ({ session: sessionFor(status) }));
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === `/api/sessions/${SESSION_ID}`) return getSession();
      if (url === '/api/coach/earnings') {
        return {
          summary: {
            completedSessionCount: status === 'COMPLETED' ? 1 : 0,
            lifetimeEarningsCents: status === 'COMPLETED' ? 3630 : 0,
            monthEarningsCents: status === 'COMPLETED' ? 3630 : 0,
          },
        };
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(apiClient.post).mockImplementation(async (url: string) => {
      if (url === `/api/coach-now/requests/${SESSION_ID}/accept`) {
        status = 'PAYMENT_READY';
        return { session: sessionFor(status) };
      }
      if (url === `/api/sessions/${SESSION_ID}/payment/authorize`) {
        status = 'ROOM_READY';
        return { session: sessionFor(status) };
      }
      if (url === `/api/sessions/${SESSION_ID}/start`) {
        status = 'ACTIVE';
        return { session: sessionFor(status) };
      }
      if (url === `/api/sessions/${SESSION_ID}/complete`) {
        status = 'COMPLETED';
        return { session: sessionFor(status) };
      }
      throw new Error(`Unexpected POST ${url}`);
    });

    // Request is visible to the trader, and the coach can accept that same request.
    setRole('TRADER');
    const trader = renderJourney(`/app/sessions/${SESSION_ID}`);
    await waitFor(() => expect(screen.getByText('Consultation Requested')).toBeInTheDocument());
    await apiClient.post(`/api/coach-now/requests/${SESSION_ID}/accept`);
    trader.unmount();

    // The trader sees the coach's update without a stale request state.
    setRole('TRADER');
    const traderAfterPayment = renderJourney(`/app/sessions/${SESSION_ID}`);
    await waitFor(() => expect(screen.getByText('Secure Your Session')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('button-authorize-payment'));
    await waitFor(() => expect(screen.getByText('Room Provisioned')).toBeInTheDocument());
    traderAfterPayment.unmount();

    // The other browser role sees payment authorization and can start the room.
    setRole('COACH');
    const coach = renderJourney(`/coach/sessions/${SESSION_ID}`);
    await waitFor(() => expect(screen.getByText('Room Provisioned')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('button-enter-room'));
    await waitFor(() => expect(screen.getByTestId('current-location')).toHaveTextContent(`/coach/sessions/${SESSION_ID}/live`));
    coach.unmount();

    const coachJourney = renderJourney(`/coach/sessions/${SESSION_ID}`);
    await waitFor(() => expect(screen.getByText('Consultation in Progress')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('button-complete-session'));
    await waitFor(() => expect(screen.getByText('Consultation Completed')).toBeInTheDocument());

    const earnings = await apiClient.get('/api/coach/earnings');
    expect(earnings.summary).toMatchObject({
      completedSessionCount: 1,
      lifetimeEarningsCents: 3630,
    });
    expect(apiClient.post).toHaveBeenCalledWith(`/api/coach-now/requests/${SESSION_ID}/accept`);
    expect(apiClient.post).toHaveBeenCalledWith(`/api/sessions/${SESSION_ID}/payment/authorize`);
    expect(apiClient.post).toHaveBeenCalledWith(`/api/sessions/${SESSION_ID}/start`);
    expect(apiClient.post).toHaveBeenCalledWith(`/api/sessions/${SESSION_ID}/complete`, {
      reason: 'Consultation concluded properly',
      confirm: true,
    });
    coachJourney.unmount();
  });

  it('explains an ambiguous checkout response and refreshes instead of starting another checkout', async () => {
    const retryingSession = sessionFor('REQUESTED', {
      paymentSetupStatus: 'RETRYING',
      paymentSetupNextAction: 'Tradigo will retry the existing payment setup. Refresh this session to check for the PayPal approval link.',
    });
    const paymentReadySession = sessionFor('PAYMENT_READY', {
      paymentStatus: 'PAYPAL_ORDER_CREATED',
      paymentApprovalUrl: 'https://paypal.test/checkout/order-1',
    });
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ session: retryingSession })
      .mockResolvedValueOnce({ session: paymentReadySession });

    setRole('TRADER');
    renderJourney(`/app/sessions/${SESSION_ID}`);

    await waitFor(() => expect(screen.getByText('Payment Setup Is Being Retried')).toBeInTheDocument());
    expect(screen.getByText(/Do not start another checkout attempt/)).toBeInTheDocument();
    expect(screen.getByText(/Refresh this session to check for the PayPal approval link/)).toBeInTheDocument();
    expect(screen.queryByTestId('button-authorize-payment')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('button-refresh-payment-setup'));

    await waitFor(() => expect(screen.getByText('Secure Your Session')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Open the PayPal sandbox checkout' })).toHaveAttribute(
      'href',
      'https://paypal.test/checkout/order-1',
    );
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('lets a participant submit a conduct report with an optional evidence reference', async () => {
    setRole('TRADER');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    vi.mocked(apiClient.get).mockResolvedValue({ session: sessionFor('COMPLETED') } as never);
    vi.mocked(apiClient.post).mockResolvedValue({} as never);

    renderJourney(`/sessions/${SESSION_ID}`);

    await screen.findByRole('button', { name: 'Report conduct' });
    fireEvent.click(screen.getByRole('button', { name: 'Report conduct' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Other conduct concern' } });
    fireEvent.change(screen.getByLabelText('What happened?'), {
      target: { value: 'The other participant made an inappropriate request during the session.' },
    });
    fireEvent.change(screen.getByLabelText(/Evidence reference/), { target: { value: 'Session minute 08:14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit conduct report' }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(`/api/sessions/${SESSION_ID}/conduct-reports`, {
      reason: 'Other conduct concern',
      details: 'The other participant made an inappropriate request during the session.',
      evidenceReference: 'Session minute 08:14',
    }));
    expect(await screen.findByText('Your conduct report was submitted to Tradigo moderators.')).toBeInTheDocument();
  });

  it('keeps trader handoff status and actions readable at a 200% text-size equivalent', async () => {
    document.documentElement.style.fontSize = '32px';
    setRole('TRADER');
    vi.mocked(apiClient.get).mockResolvedValue({
      session: sessionFor('REQUESTED', {
        paymentSetupStatus: 'RETRYING',
        paymentSetupNextAction: 'Tradigo will retry the existing payment setup after checking the provider response. Refresh this page to see the next safe action.',
      }),
    });

    renderJourney(`/app/sessions/${SESSION_ID}`);

    await waitFor(() => expect(screen.getByText('Payment Setup Is Being Retried')).toBeInTheDocument());

    const refreshButton = screen.getByTestId('button-refresh-payment-setup');
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).toHaveClass('max-w-full', 'whitespace-normal', 'sm:min-w-[240px]');
    expect(screen.getByText(/Tradigo will retry the existing payment setup after checking/)).toBeInTheDocument();

    const progressLabels = ['Requested', 'Payment', 'Ready', 'Completed'];
    for (const label of progressLabels) {
      expect(screen.getByText(label)).toHaveClass('w-full', 'whitespace-normal');
    }
  });

  it('keeps completed trader learning controls reachable at a 200% text-size equivalent', async () => {
    document.documentElement.style.fontSize = '32px';
    setRole('TRADER');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    vi.mocked(apiClient.get).mockResolvedValue({
      session: sessionFor('COMPLETED', {
        topic: 'A long-form lesson about slowing down before entering a position',
        learningRecord: {
          learningGoal: 'Build a repeatable review habit before entering a position',
          conceptsReviewed: 'Review context and evidence before making a decision.',
          evidenceDiscussed: 'We compared several examples and named the signals worth revisiting.',
          sharedArtifact: 'A private review checklist.',
          unresolvedQuestions: 'How will this process change across different market conditions?',
          practiceSteps: 'Practice the checklist on three historical examples before the next lesson.',
          traderReflection: '',
          status: 'COMPLETE',
        },
      }),
    });

    renderJourney(`/app/sessions/${SESSION_ID}`);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Keep what you learn.' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Close passport' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save private reflection' })).toBeInTheDocument();
    expect(screen.getByTestId('button-return-dashboard')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('min-w-0');
  });
});

describe('role-specific session return and rejoin paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ session: sessionFor('ACTIVE') });
  });
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty('font-size');
  });

  it.each([
    ['trader normal', 'TRADER', `/app/sessions/${SESSION_ID}`, `/app/sessions/${SESSION_ID}/live`],
    ['coach normal', 'COACH', `/coach/sessions/${SESSION_ID}`, `/coach/sessions/${SESSION_ID}/live`],
    ['trader preview', 'TRADER', `/preview/sessions/${SESSION_ID}`, `/preview/sessions/${SESSION_ID}/live`],
    ['coach preview', 'COACH', `/preview/coach/sessions/${SESSION_ID}`, `/preview/coach/sessions/${SESSION_ID}/live`],
  ])('preserves the %s links', async (_label, role, sessionPath, livePath) => {
    setRole(role as 'TRADER' | 'COACH');
    render(
      <MemoryRouter initialEntries={[sessionPath]}>
        <Routes>
          <Route
            path={sessionPath.replace(SESSION_ID, ':sessionId')}
            element={<><SessionJourneyView /><LocationProbe /></>}
          />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('button-rejoin-room')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('button-rejoin-room'));
    expect(screen.getByTestId('current-location')).toHaveTextContent(livePath);
  });
});

describe('session history explanations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole('TRADER');
  });
  afterEach(cleanup);

  it.each([
    ['ordinary cancellation', {}, 'Session cancelled', 'Cancelled · payment released'],
    ['trader no-show', { noShowType: 'TRADER' }, 'No-show · trader absent', 'No-show · trader absent'],
    ['coach no-show', { noShowType: 'COACH' }, 'No-show · coach absent', 'No-show · coach absent'],
    ['mutual no-show', { noShowType: 'MUTUAL' }, 'No-show · both participants', 'No-show · both participants'],
  ])('explains the %s without exposing actor IDs', async (_case, overrides, timelineLabel, statusLabel) => {
    vi.mocked(apiClient.get).mockResolvedValue({
      session: sessionFor('CANCELLED', {
        paymentStatus: 'VOIDED',
        cancellationReason: 'The scheduled consultation could not proceed.',
        cancelledAt: '2026-08-25T12:20:00.000Z',
        cancelledBy: 'coach-1',
        ...overrides,
      }),
    });

    renderJourney(`/app/sessions/${SESSION_ID}`);

    await waitFor(() => expect(screen.getByText('Consultation Voided')).toBeInTheDocument());
    expect(screen.getAllByText(statusLabel).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(timelineLabel).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Payment released').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('status', { name: /Session status: .*Payment released/ })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /Session status updated: .*Payment released/ })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /Coach ended this session/ })).toBeInTheDocument();
    expect(screen.queryByText(/coach-1|trader-1/)).not.toBeInTheDocument();
  });

  it.each([
    ['released', 'REFUNDED', 'Payment released', 'Authorized funds are not being held for this session.'],
    ['pending', 'REFUND_PENDING', 'Payment release pending', 'Authorized funds are not being held for this session.'],
  ])('shows the %s payment-release wording', async (_case, paymentStatus, releaseLabel, timelineDetail) => {
    vi.mocked(apiClient.get).mockResolvedValue({
      session: sessionFor('CANCELLED', {
        paymentStatus,
        cancellationReason: 'The consultation was cancelled.',
        cancelledBy: null,
      }),
    });

    renderJourney(`/app/sessions/${SESSION_ID}`);

    await waitFor(() => expect(screen.getByText('Consultation Voided')).toBeInTheDocument());
    expect(screen.getAllByText(releaseLabel).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('listitem', { name: new RegExp(releaseLabel) })).toBeInTheDocument();
    expect(screen.getByText(timelineDetail)).toBeInTheDocument();
  });

  it('surfaces a failed no-show settlement before payment release completes', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      session: sessionFor('ROOM_READY', {
        mode: 'SCHEDULED',
        paymentStatus: 'PAYPAL_AUTHORIZED',
        noShowResolutionFailure: {
          id: 17,
          createdAt: '2026-08-25T12:45:00.000Z',
          message: 'PayPal could not release the authorization.',
          paymentStatus: 'PAYPAL_AUTHORIZED',
          retryable: true,
          nextAction: 'Retry automatically on the next worker pass; investigate if the failure persists.',
        },
      }),
    });

    renderJourney(`/app/sessions/${SESSION_ID}`);

    await waitFor(() => expect(screen.getByText('Room Provisioned')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('No-show settlement needs attention');
    expect(screen.getByRole('alert')).toHaveTextContent('Tradigo could not safely finish releasing or settling');
    expect(screen.getByRole('alert')).toHaveTextContent('Retry automatically on the next worker pass');
    expect(screen.getByRole('listitem', { name: /No-show resolution needs attention/ })).toBeInTheDocument();
  });

  it('keeps the original scheduled time visible after rescheduling', async () => {
    const originalTime = '2026-08-25T12:00:00.000Z';
    const rescheduledTime = '2026-09-01T14:00:00.000Z';
    vi.mocked(apiClient.get).mockResolvedValue({
      session: sessionFor('REQUESTED', {
        mode: 'SCHEDULED',
        scheduledAt: rescheduledTime,
        updatedAt: '2026-08-25T11:30:00.000Z',
        rescheduledFrom: originalTime,
      }),
    });

    renderJourney(`/app/sessions/${SESSION_ID}`);

    await waitFor(() => expect(screen.getByText('Consultation Requested')).toBeInTheDocument());
    expect(screen.getByText(/Moved from/)).toHaveTextContent(
      `Moved from ${new Date(originalTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} to ${new Date(rescheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`,
    );
    expect(screen.queryByText(/coach-1|trader-1/)).not.toBeInTheDocument();
  });

  it('covers journey landmarks, timeline semantics, live announcements, and outcome wording', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      session: sessionFor('CANCELLED', {
        mode: 'SCHEDULED',
        noShowType: 'COACH',
        paymentStatus: 'REFUND_PENDING',
        cancellationReason: 'The scheduled consultation could not proceed.',
        rescheduledFrom: '2026-08-24T12:00:00.000Z',
        cancelledAt: '2026-08-25T12:20:00.000Z',
      }),
    });

    const { container } = renderJourney(`/app/sessions/${SESSION_ID}`);

    await waitFor(() => expect(screen.getByRole('main', { name: 'Consultation Ledger' })).toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Session timeline' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Session events' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /No-show · coach absent/ })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /Payment release pending/ })).toHaveTextContent(
      'Authorized funds are not being held for this session.',
    );
    expect(screen.getByRole('status', {
      name: /Session status: No-show · coach absent.*Payment release pending/,
    })).toBeInTheDocument();
    expect(screen.getByRole('status', {
      name: /Session status updated: No-show · coach absent.*Payment release pending/,
    })).toBeInTheDocument();
    expect(screen.getByText(/COACH no-show:/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="current-location">{location.pathname}</output>;
};