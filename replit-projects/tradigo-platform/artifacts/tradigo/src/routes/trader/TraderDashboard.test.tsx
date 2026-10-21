import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TraderDashboard } from './TraderDashboard';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: mocks.get,
    post: mocks.post,
  },
}));

describe('TraderDashboard', () => {
  const setTextSizeEquivalent = () => {
    document.documentElement.style.fontSize = '32px';
  };

  const setViewport = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  };

  afterEach(() => {
    document.documentElement.style.removeProperty('font-size');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setViewport(1024);
    mocks.get.mockImplementation((path: string) => {
      if (path.includes('/coach-now/requests/current')) return Promise.resolve({ request: null });
      return Promise.resolve({ items: [] });
    });
  });

  it('focuses on learning progress instead of duplicating coach discovery', async () => {
    render(
      <MemoryRouter>
        <TraderDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Keep your learning moving.' })).toBeInTheDocument();
    expect(screen.queryByText('What do you need help with?')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Instrument')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Your completed learning record will appear here.')).toBeInTheDocument());
    expect(screen.getAllByRole('link', { name: /find a coach/i })[0]).toHaveAttribute('href', '/app/coaches');
    expect(screen.getAllByRole('link', { name: /coach now/i })[0]).toHaveAttribute('href', '/app/coach-now');
  });

  it('keeps an active Coach Now request visible as a handoff', async () => {
    mocks.get.mockImplementation((path: string) => {
      if (path.includes('/coach-now/requests/current')) {
        return Promise.resolve({
          request: { status: 'MATCHING', instrument: 'XAUUSD' },
        });
      }
      return Promise.resolve({ items: [] });
    });

    render(
      <MemoryRouter>
        <TraderDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Searching for your coach' })).toBeInTheDocument());
    expect(screen.getByText(/Finding a teaching fit for XAUUSD/)).toBeInTheDocument();
    expect(screen.queryByText('Your learning workspace')).not.toBeInTheDocument();

    mocks.post.mockResolvedValue({});
    fireEvent.click(screen.getByRole('button', { name: 'Cancel search' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/api/coach-now/requests/current/cancel'));
  });

  it('keeps preview dashboard actions inside the preview route', async () => {
    render(
      <MemoryRouter initialEntries={['/preview']}>
        <TraderDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Your completed learning record will appear here.')).toBeInTheDocument());
    expect(screen.getAllByRole('link', { name: /find a coach/i })[0]).toHaveAttribute('href', '/preview/coaches');
    expect(screen.getAllByRole('link', { name: /coach now/i })[0]).toHaveAttribute('href', '/preview/coach-now');
  });

  it('keeps the dashboard actions and summary stacked at a narrow viewport', async () => {
    setViewport(375);
    render(
      <MemoryRouter>
        <TraderDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Your completed learning record will appear here.')).toBeInTheDocument());

    const header = screen.getByRole('heading', { name: 'Keep your learning moving.' }).closest('header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('flex-col');

    const headerActions = header!.querySelector(':scope > div:last-child');
    expect(headerActions).toHaveClass('flex-col');
    for (const action of within(header!).getAllByRole('button')) {
      expect(action).toHaveClass('w-full');
    }

    const summary = screen.getByRole('region', { name: 'Learning summary' });
    expect(summary).toHaveClass('grid-cols-1');
    expect(within(header!).getByRole('link', { name: /find a coach/i })).toHaveAttribute('href', '/app/coaches');
    expect(within(header!).getByRole('link', { name: /coach now/i })).toHaveAttribute('href', '/app/coach-now');
  });

  it('keeps trader actions reachable at a 200% text-size equivalent', async () => {
    setViewport(375);
    setTextSizeEquivalent();
    render(
      <MemoryRouter>
        <TraderDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Your completed learning record will appear here.')).toBeInTheDocument());

    const header = screen.getByRole('heading', { name: 'Keep your learning moving.' }).closest('header');
    expect(document.documentElement).toHaveStyle({ fontSize: '32px' });
    expect(header).toHaveClass('flex-col');
    expect(header?.firstElementChild).toHaveClass('min-w-0');
    expect(within(header!).getByRole('link', { name: /find a coach/i })).toBeVisible();
    expect(within(header!).getByRole('link', { name: /coach now/i })).toBeVisible();

    const summary = screen.getByRole('region', { name: 'Learning summary' });
    expect(summary).toHaveClass('grid-cols-1');
    expect(screen.getByRole('heading', { name: 'Recent sessions' })).toBeVisible();
  });
});