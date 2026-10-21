import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachApplication } from './CoachApplication';
import { CoachApplicationStatus, CoachApplicationStatusPanel, type CoachApplicationStatusData } from './CoachApplicationStatus';

const mocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  refreshProfile: vi.fn(),
  setCoachApplicationStatus: vi.fn(),
  trackEvent: vi.fn(),
  useAuthStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}));

vi.mock('../../../lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: mocks.getIdToken,
    },
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: mocks.useAuthStore,
}));

vi.mock('../../../lib/analytics', () => ({
  trackEvent: mocks.trackEvent,
}));

const traderUser = { id: 'trader-1', role: 'TRADER', status: 'ACTIVE' };

const renderPanel = (application: CoachApplicationStatusData) =>
  render(
    <MemoryRouter initialEntries={['/app/coach-application']}>
      <Routes>
        <Route path="/app/coach-application" element={<CoachApplicationStatusPanel application={application} />} />
        <Route path="/app" element={<div>Trader dashboard</div>} />
        <Route path="/coach/apply" element={<div>Coach application</div>} />
        <Route path="/coach" element={<div>Coach workspace</div>} />
      </Routes>
    </MemoryRouter>,
  );

const response = (body: unknown, ok = true) => ({
  ok,
  json: vi.fn().mockResolvedValue(body),
});

describe('CoachApplicationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIdToken.mockResolvedValue('test-token');
    mocks.refreshProfile.mockResolvedValue(undefined);
    mocks.useAuthStore.mockReturnValue({
      canonicalUser: traderUser,
      setCoachApplicationStatus: mocks.setCoachApplicationStatus,
    });
    mocks.useAuthStore.getState.mockReturnValue({
      refreshProfile: mocks.refreshProfile,
      setCoachApplicationStatus: mocks.setCoachApplicationStatus,
    });
  });

  it.each([
    ['DRAFT', 'Draft', 'Finish your coach application', 'Continue application'],
    ['UNDER_REVIEW', 'Under review', 'Your application is under review', 'Return to Tradigo'],
    ['APPROVED', 'Approved', 'You’re approved to coach', 'Open coach workspace'],
    ['REJECTED', 'Needs improvement', 'Your application needs improvement', 'Start a new application'],
  ] as const)('renders the %s state with its matching action', (status, label, title, action) => {
    renderPanel({ id: `application-${status}`, status });

    expect(screen.getByTestId('status-coach-application')).toHaveTextContent(label);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: action })).toBeInTheDocument();
  });

  it('shows reviewer feedback for a rejected application', () => {
    renderPanel({
      id: 'application-rejected',
      status: 'REJECTED',
      reviewerNote: 'Please add a clearer teaching sample and explain your risk framework.',
    });

    expect(screen.getByRole('heading', { name: 'Reviewer feedback' })).toBeInTheDocument();
    expect(screen.getByTestId('text-coach-application-feedback')).toHaveTextContent(
      'Please add a clearer teaching sample and explain your risk framework.',
    );
  });

  it('shows earlier attempts with their own feedback and evidence boundaries', () => {
    renderPanel({
      id: 'application-current',
      status: 'DRAFT',
      attemptHistory: [
        {
          id: 'application-rejected',
          status: 'REJECTED',
          attemptNumber: 1,
          isCurrent: false,
          submittedAt: '2026-08-20T12:00:00.000Z',
          decidedAt: '2026-08-22T12:00:00.000Z',
          reviewerNote: 'Please add a clearer teaching sample.',
          profile: {
            headline: 'Process-first coach',
            teachingMethod: 'Annotated review and practice.',
          },
          markets: { markets: ['FOREX'] },
          experience: { yearsExperience: 5 },
          compliance: { credentials: 'v1.0' },
          assessmentAttempts: [{
            id: 'assessment-1',
            type: 'KNOWLEDGE',
            status: 'PASSED',
            score: 5,
            maxScore: 5,
            answers: [{ questionText: 'What is risk education?', answer: 'Explain uncertainty.' }],
          }],
          documents: [{
            id: 'document-1',
            name: 'Teaching sample',
            type: 'TEACHING_SAMPLE',
            status: 'RECEIVED',
            fileAvailable: true,
          }],
        },
        {
          id: 'application-current',
          status: 'DRAFT',
          attemptNumber: 2,
          isCurrent: true,
        },
      ],
    });

    expect(screen.getByRole('heading', { name: 'Earlier applications' })).toBeInTheDocument();
    expect(screen.getByTestId('coach-application-attempt-1')).toHaveTextContent('Needs improvement');
    expect(screen.getByTestId('coach-application-attempt-1')).toHaveTextContent('Please add a clearer teaching sample.');
    expect(screen.getByTestId('coach-application-attempt-evidence-1')).toHaveTextContent('Process-first coach');
    expect(screen.getByTestId('coach-application-attempt-evidence-1')).toHaveTextContent('Teaching sample');
    expect(screen.queryByText('moderator-only investigation notes')).not.toBeInTheDocument();
    expect(screen.queryByText('application-rejected')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coach-application-attempt-2')).not.toBeInTheDocument();
  });

  it('submits a private clarification request for an earlier attempt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      id: 'clarification-1',
      applicationId: 'application-rejected',
      status: 'SUBMITTED',
      message: 'Which part of my teaching sample should I expand?',
      submittedAt: '2026-09-01T12:00:00.000Z',
    }));
    vi.stubGlobal('fetch', fetchMock);
    renderPanel({
      id: 'application-current',
      status: 'DRAFT',
      attemptHistory: [{
        id: 'application-rejected',
        status: 'REJECTED',
        attemptNumber: 1,
        isCurrent: false,
        reviewerNote: 'Please add a clearer teaching sample.',
      }, {
        id: 'application-current',
        status: 'DRAFT',
        attemptNumber: 2,
        isCurrent: true,
      }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ask for clarification' }));
    fireEvent.change(screen.getByLabelText('What would you like clarified?'), {
      target: { value: 'Which part of my teaching sample should I expand?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit clarification' }));

    await waitFor(() => expect(screen.getByTestId('clarification-request-clarification-1')).toHaveTextContent('Submitted'));
    expect(mocks.trackEvent).toHaveBeenCalledWith('clarification_request_opened', {
      surface: 'coach_application_status',
      application_attempt_state: 'REJECTED',
    });
    expect(mocks.trackEvent).toHaveBeenCalledWith('clarification_request_submitted', {
      surface: 'coach_application_status',
      application_attempt_state: 'REJECTED',
    });
    expect(mocks.trackEvent.mock.calls.flat()).not.toContain('Which part of my teaching sample should I expand?');
    expect(fetchMock).toHaveBeenCalledWith('/api/coaches/application/application-rejected/clarifications', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Which part of my teaching sample should I expand?' }),
    });
  });

  it('shows answered and closed clarification states without reviewer-only fields', () => {
    renderPanel({
      id: 'application-current',
      status: 'DRAFT',
      attemptHistory: [{
        id: 'application-rejected',
        status: 'REJECTED',
        attemptNumber: 1,
        isCurrent: false,
        clarificationRequests: [{
          id: 'clarification-answered',
          applicationId: 'application-rejected',
          status: 'ANSWERED',
          message: 'What should I expand?',
          response: 'Please add one concrete example of your review process.',
        }, {
          id: 'clarification-closed',
          applicationId: 'application-rejected',
          status: 'CLOSED',
          message: 'Can you clarify the decision?',
        }],
      }, {
        id: 'application-current',
        status: 'DRAFT',
        attemptNumber: 2,
        isCurrent: true,
      }],
    });

    expect(screen.getByText('Answered')).toBeInTheDocument();
    expect(screen.getByText('Please add one concrete example of your review process.')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(screen.getByText(/This clarification request is closed/)).toBeInTheDocument();
    expect(screen.queryByText('respondedBy')).not.toBeInTheDocument();
    expect(screen.queryByText('applicantId')).not.toBeInTheDocument();
  });

  it('loads the status and updates the navigation status store', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          id: 'application-loaded',
          status: 'REJECTED',
          submittedAt: '2026-08-28T12:00:00.000Z',
          decidedAt: '2026-08-30T12:00:00.000Z',
          reviewerNote: 'Add more evidence about your teaching experience.',
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/app/coach-application']}>
        <Routes>
          <Route path="/app/coach-application" element={<CoachApplicationStatus />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Your application needs improvement' })).toBeInTheDocument());
    expect(mocks.setCoachApplicationStatus).toHaveBeenCalledWith('REJECTED');
    expect(fetch).toHaveBeenCalledWith('/api/coaches/application/status', {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('sends an approved trader to the coach workspace', async () => {
    renderPanel({ id: 'application-approved', status: 'APPROVED' });

    fireEvent.click(screen.getByRole('button', { name: 'Open coach workspace' }));

    await waitFor(() => expect(screen.getByText('Coach workspace')).toBeInTheDocument());
    expect(mocks.refreshProfile).toHaveBeenCalled();
  });

  it('keeps a rejected applicant on the trader route', async () => {
    renderPanel({ id: 'application-rejected', status: 'REJECTED', reviewerNote: 'Please add more evidence.' });

    fireEvent.click(screen.getByTestId('button-return-to-trader-dashboard'));

    await waitFor(() => expect(screen.getByText('Trader dashboard')).toBeInTheDocument());
    expect(mocks.refreshProfile).not.toHaveBeenCalled();
  });

  it('starts a separate draft when a rejected applicant chooses to apply again', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      id: 'application-resubmission',
      status: 'DRAFT',
      attemptNumber: 2,
      isResubmission: true,
    })));
    renderPanel({ id: 'application-rejected', status: 'REJECTED', reviewerNote: 'Please add more evidence.' });

    fireEvent.click(screen.getByRole('button', { name: 'Start a new application' }));

    await waitFor(() => expect(screen.getByText('Coach application')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith('/api/coaches/application/resubmit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(mocks.setCoachApplicationStatus).toHaveBeenCalledWith('DRAFT');
  });

  it('updates the shared status after a successful submission', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        id: 'application-draft',
        status: 'DRAFT',
        currentStep: 7,
        profile: {
          headline: 'Process-first coach',
          bio: 'I teach repeatable review habits.',
          teachingMethod: 'Annotated review and practice.',
          coachingBoundaries: 'No signals, execution, or guarantees.',
        },
        markets: { markets: ['FOREX'], coachingSpecialties: ['RISK_MANAGEMENT'] },
        experience: { yearsExperience: 5, background: 'Five years of documented study.' },
        compliance: {
          remoteControl: 'v1.0',
          credentials: 'v1.0',
          offPlatform: 'v1.0',
          jurisdiction: 'v1.0',
        },
        assessmentAttempts: [
          { type: 'KNOWLEDGE', status: 'PASSED', score: 5, maxScore: 5 },
          { type: 'SAFETY', status: 'PASSED', score: 5, maxScore: 5 },
        ],
        documents: [],
      }))
      .mockResolvedValueOnce(response({ id: 'application-draft', status: 'DRAFT' }))
      .mockResolvedValueOnce(response({ id: 'application-draft', status: 'UNDER_REVIEW', submittedAt: '2026-09-01T12:00:00.000Z' }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/coach/apply']}>
        <Routes>
          <Route path="/coach/apply" element={<CoachApplication />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Review and submit' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() => expect(screen.getByTestId('status-coach-application')).toHaveTextContent('Under review'));
    expect(mocks.setCoachApplicationStatus).toHaveBeenCalledWith('UNDER_REVIEW');
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/coaches/application/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
  });
});