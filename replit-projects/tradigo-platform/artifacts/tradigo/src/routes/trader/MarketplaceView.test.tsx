import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MarketplaceView } from './MarketplaceView';
import { MemoryRouter, useLocation } from 'react-router';

// Mock fetch
global.fetch = vi.fn();

describe('MarketplaceView', () => {
  const LocationProbe = () => {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}{location.search}</output>;
  };

  const setTextSizeEquivalent = () => {
    document.documentElement.style.fontSize = '32px';
  };

  const setViewport = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  };

  beforeEach(() => {
    localStorage.clear();
    setViewport(1024);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('font-size');
  });

  it('renders loading state', () => {
    setViewport(375);
    (fetch as any).mockImplementation(() => new Promise(() => {}));
    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);
    expect(screen.getByText(/Find a Coach/i)).toBeDefined();
    const loading = screen.getByRole('status', { name: 'Loading coaches' });
    expect(loading).toHaveClass('min-w-0', 'grid-cols-1');
    expect(loading.querySelector('.bg-card')).toHaveClass('min-w-0', 'max-w-full');
  });

  it('renders coaches list', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: '1', displayName: 'Coach A', headline: 'Pro', bio: 'Bio', markets: ['FOREX'], specialties: ['STRATEGY'], languages: ['en'], yearsOfExperience: 5, hourlyRateCents: 10000, instantRatePerMinuteCents: 166, currency: 'USD', verificationStatus: 'FULLY_VERIFIED', ratingAverage: 5, ratingCount: 1 }],
        total: 1,
        totalPages: 1
      })
    });
    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Coach A')).toBeDefined());
  });

  it('gives marketplace search and filters explicit accessible names', () => {
    (fetch as any).mockImplementation(() => new Promise(() => {}));

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    expect(screen.getByRole('textbox', { name: 'Search coaches' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Market' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Specialty' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sort coaches by' })).toBeInTheDocument();
  });

  it('keeps newer marketplace results when responses arrive out of order', async () => {
    const pendingResponses: Array<(response: Response) => void> = [];
    (fetch as any).mockImplementation(() => new Promise((resolve) => {
      pendingResponses.push(resolve);
    }));

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    fireEvent.change(search, { target: { value: 'newer search' } });
    await waitFor(() => expect(pendingResponses).toHaveLength(2));

    pendingResponses[1]({
      ok: true,
      json: async () => ({
        items: [{
          id: 'newer-coach',
          displayName: 'Newer Coach',
          headline: 'Current result',
          bio: 'Current result bio',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 5,
          hourlyRateCents: 10000,
          instantRatePerMinuteCents: 166,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 5,
          ratingCount: 1,
        }],
        total: 1,
        totalPages: 2,
      }),
    } as Response);
    await waitFor(() => expect(screen.getByText('Newer Coach')).toBeInTheDocument());
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading coaches' })).not.toBeInTheDocument();

    pendingResponses[0]({
      ok: true,
      json: async () => ({
        items: [{
          id: 'older-coach',
          displayName: 'Older Coach',
          headline: 'Stale result',
          bio: 'Stale result bio',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 5,
          hourlyRateCents: 10000,
          instantRatePerMinuteCents: 166,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 5,
          ratingCount: 1,
        }],
        total: 7,
        totalPages: 7,
      }),
    } as Response);

    await waitFor(() => expect(screen.queryByText('Older Coach')).not.toBeInTheDocument());
    expect(screen.getByText('Newer Coach')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading coaches' })).not.toBeInTheDocument();
  });

  it('keeps the latest result count in the marketplace announcement when responses arrive out of order', async () => {
    const pendingResponses: Array<(response: Response) => void> = [];
    (fetch as any).mockImplementation(() => new Promise((resolve) => {
      pendingResponses.push(resolve);
    }));

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const announcement = screen.getByRole('status', { name: 'Marketplace results' });
    pendingResponses[0]({
      ok: true,
      json: async () => ({
        items: [{
          id: 'initial-coach',
          displayName: 'Initial Coach',
          headline: 'Initial result',
          bio: 'Initial result bio',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 5,
          hourlyRateCents: 10000,
          instantRatePerMinuteCents: 166,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 5,
          ratingCount: 1,
        }],
        total: 1,
        totalPages: 1,
      }),
    } as Response);
    await waitFor(() => expect(screen.getByText('Initial Coach')).toBeInTheDocument());

    fireEvent.change(
      screen.getByPlaceholderText('Search by name, specialties, or bio...'),
      { target: { value: 'latest search' } },
    );
    await waitFor(() => expect(pendingResponses).toHaveLength(2));

    fireEvent.change(screen.getByDisplayValue('All Markets'), { target: { value: 'CRYPTO' } });
    await waitFor(() => expect(pendingResponses).toHaveLength(3));

    pendingResponses[2]({
      ok: true,
      json: async () => ({
        items: [{
          id: 'latest-coach',
          displayName: 'Latest Coach',
          headline: 'Latest result',
          bio: 'Latest result bio',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 6,
          hourlyRateCents: 11000,
          instantRatePerMinuteCents: 180,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 4.8,
          ratingCount: 2,
        }],
        total: 1,
        totalPages: 1,
      }),
    } as Response);
    await waitFor(() => {
      expect(screen.getByText('Latest Coach')).toBeInTheDocument();
      expect(announcement).toHaveTextContent('Marketplace results updated: 1 coach loaded.');
    });

    pendingResponses[1]({
      ok: true,
      json: async () => ({
        items: [{
          id: 'stale-coach',
          displayName: 'Stale Coach',
          headline: 'Stale result',
          bio: 'Stale result bio',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 4,
          hourlyRateCents: 9000,
          instantRatePerMinuteCents: 150,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 4.5,
          ratingCount: 3,
        }],
        total: 7,
        totalPages: 7,
      }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText('Latest Coach')).toBeInTheDocument();
      expect(screen.queryByText('Stale Coach')).not.toBeInTheDocument();
      expect(announcement).toHaveTextContent('Marketplace results updated: 1 coach loaded.');
      expect(announcement).not.toHaveTextContent('7 coaches loaded');
    });
  });

  it('keeps the current coach cards visible while a replacement search loads', async () => {
    const pendingResponses: Array<(response: Response) => void> = [];
    (fetch as any).mockImplementation(() => new Promise((resolve) => {
      pendingResponses.push(resolve);
    }));

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    pendingResponses[0]({
      ok: true,
      json: async () => ({
        items: [{
          id: 'current-coach',
          displayName: 'Current Coach',
          headline: 'Current result',
          bio: 'Current result bio',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 5,
          hourlyRateCents: 10000,
          instantRatePerMinuteCents: 166,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 5,
          ratingCount: 1,
        }],
        total: 1,
        totalPages: 1,
      }),
    } as Response);
    await waitFor(() => expect(screen.getByText('Current Coach')).toBeInTheDocument());

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    fireEvent.change(search, { target: { value: 'replacement search' } });
    await waitFor(() => expect(pendingResponses).toHaveLength(2));

    expect(screen.getByText('Current Coach')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Refreshing coaches' })).toHaveTextContent('Refreshing coach results');
    expect(screen.queryByRole('status', { name: 'Loading coaches' })).not.toBeInTheDocument();

    pendingResponses[1]({
      ok: true,
      json: async () => ({
        items: [{
          id: 'replacement-coach',
          displayName: 'Replacement Coach',
          headline: 'Replacement result',
          bio: 'Replacement result bio',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 6,
          hourlyRateCents: 11000,
          instantRatePerMinuteCents: 180,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 4.8,
          ratingCount: 2,
        }],
        total: 1,
        totalPages: 1,
      }),
    } as Response);

    await waitFor(() => expect(screen.getByText('Replacement Coach')).toBeInTheDocument());
    expect(screen.queryByText('Current Coach')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Refreshing coaches' })).not.toBeInTheDocument();
  });

  it('preserves the last results and offers retry when the current request fails', async () => {
    let requestCount = 0;
    (fetch as any).mockImplementation(() => {
      requestCount += 1;
      if (requestCount === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [{
              id: 'known-coach',
              displayName: 'Known Coach',
              headline: 'Known result',
              bio: 'Known result bio',
              markets: ['FOREX'],
              specialties: ['STRATEGY'],
              languages: ['English'],
              yearsOfExperience: 5,
              hourlyRateCents: 10000,
              instantRatePerMinuteCents: 166,
              currency: 'USD',
              verificationStatus: 'FULLY_VERIFIED',
              ratingAverage: 5,
              ratingCount: 1,
            }],
            total: 1,
            totalPages: 1,
          }),
        });
      }
      if (requestCount === 2) return Promise.reject(new Error('network unavailable'));
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [{
            id: 'recovered-coach',
            displayName: 'Recovered Coach',
            headline: 'Recovered result',
            bio: 'Recovered result bio',
            markets: ['FOREX'],
            specialties: ['STRATEGY'],
            languages: ['English'],
            yearsOfExperience: 6,
            hourlyRateCents: 11000,
            instantRatePerMinuteCents: 180,
            currency: 'USD',
            verificationStatus: 'FULLY_VERIFIED',
            ratingAverage: 4.8,
            ratingCount: 2,
          }],
          total: 1,
          totalPages: 1,
        }),
      });
    });

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Known Coach')).toBeInTheDocument());

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    fireEvent.change(search, { target: { value: 'failed search' } });
    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent('Your last results are still shown');
    expect(within(alert).getByRole('button', { name: 'Retry marketplace' })).toBeInTheDocument();
    expect(screen.getByText('Known Coach')).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry marketplace' }));
    await waitFor(() => expect(screen.getByText('Recovered Coach')).toBeInTheDocument());
    expect(screen.queryByText('Known Coach')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cancels the obsolete request when a newer marketplace search starts', async () => {
    const pendingRequests: Array<{
      signal?: AbortSignal;
      resolve: (response: Response) => void;
    }> = [];
    (fetch as any).mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => new Promise((resolve) => {
      pendingRequests.push({ signal: init?.signal as AbortSignal | undefined, resolve });
    }));

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    await waitFor(() => expect(pendingRequests).toHaveLength(1));
    fireEvent.change(search, { target: { value: 'newer search' } });
    await waitFor(() => expect(pendingRequests).toHaveLength(2));

    expect(pendingRequests[0].signal).toBeDefined();
    expect(pendingRequests[0].signal?.aborted).toBe(true);
    expect(pendingRequests[1].signal?.aborted).toBe(false);

    const response = {
      ok: true,
      json: async () => ({ items: [], total: 0, totalPages: 1 }),
    } as Response;
    pendingRequests[0].resolve(response);
    pendingRequests[1].resolve(response);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'No coaches found' })).toBeInTheDocument());
  });

  it('records an Enter search without issuing a duplicate marketplace request', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, totalPages: 1 }),
    });

    const requestsBeforeRender = (fetch as any).mock.calls.length;
    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(requestsBeforeRender + 1));

    fireEvent.change(search, { target: { value: 'strategy' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(requestsBeforeRender + 2));
    expect(screen.getByRole('button', { name: 'strategy' })).toBeInTheDocument();
  });

  it('waits for a pause before searching typed marketplace text', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, totalPages: 1 }),
    });

    const requestsBeforeRender = (fetch as any).mock.calls.length;
    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(requestsBeforeRender + 1));

    fireEvent.change(search, { target: { value: 's' } });
    fireEvent.change(search, { target: { value: 'st' } });
    fireEvent.change(search, { target: { value: 'strategy' } });

    expect(fetch).toHaveBeenCalledTimes(requestsBeforeRender + 1);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(requestsBeforeRender + 2), { timeout: 1000 });
  });

  it('keeps intake, filters, and coach actions reachable at a narrow viewport', async () => {
    setViewport(375);
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: '1',
          displayName: 'A Coach With A Deliberately Long Name',
          headline: 'Process coach',
          bio: 'A clear and practical learning plan.',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 5,
          hourlyRateCents: 10000,
          instantRatePerMinuteCents: 166,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 5,
          ratingCount: 1,
          approved: true,
          availability: 'AVAILABLE',
        }],
        total: 1,
        totalPages: 1,
      }),
    });

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('A Coach With A Deliberately Long Name')).toBeInTheDocument());

    const intake = screen.getByRole('heading', { name: 'Find a teaching fit' }).closest('section');
    expect(intake).toBeInTheDocument();
    expect(intake!.querySelector('div.grid')).toHaveClass('grid-cols-1');
    expect(within(intake!).getAllByRole('combobox')).toHaveLength(7);
    for (const control of within(intake!).getAllByRole('combobox')) {
      expect(control).toHaveClass('w-full');
    }
    expect(within(intake!).getByRole('button', { name: 'Show teaching matches' })).toBeInTheDocument();

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    const filterRow = search.closest('div.flex.flex-col.gap-4');
    expect(filterRow).toHaveClass('flex-col');
    const filters = filterRow!.querySelector('div.grid');
    expect(filters).toHaveClass('grid-cols-1');
    for (const control of within(filterRow!).getAllByRole('combobox')) {
      expect(control).toHaveClass('w-full');
    }

    const profileAction = screen.getByRole('button', { name: "View A Coach With A Deliberately Long Name's profile" });
    const card = profileAction.closest('div.group');
    expect(card).toHaveClass('overflow-hidden');
    expect(card!.querySelector('.flex.flex-wrap.items-center.gap-3')).toBeInTheDocument();
    expect(profileAction).toBeInTheDocument();
  });

  it('keeps intake, filters, and coach actions reachable at a 200% text-size equivalent', async () => {
    setViewport(375);
    setTextSizeEquivalent();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: '1',
          displayName: 'A Coach With A Deliberately Long Name',
          headline: 'Process coach',
          bio: 'A clear and practical learning plan.',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 5,
          hourlyRateCents: 10000,
          instantRatePerMinuteCents: 166,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 5,
          ratingCount: 1,
          approved: true,
          availability: 'AVAILABLE',
        }],
        total: 1,
        totalPages: 1,
      }),
    });

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('A Coach With A Deliberately Long Name')).toBeInTheDocument());

    expect(document.documentElement).toHaveStyle({ fontSize: '32px' });
    const intake = screen.getByRole('heading', { name: 'Find a teaching fit' }).closest('section');
    expect(intake).toBeInTheDocument();
    expect(intake!.querySelector('div.grid')).toHaveClass('grid-cols-1');
    expect(within(intake!).getAllByRole('combobox')).toHaveLength(7);
    expect(within(intake!).getByRole('button', { name: 'Show teaching matches' })).toBeVisible();
    for (const control of within(intake!).getAllByRole('combobox')) {
      expect(control).toHaveClass('w-full');
    }

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    expect(search).toBeVisible();
    const filterRow = search.closest('div.flex.flex-col.gap-4');
    expect(filterRow).toHaveClass('flex-col');
    expect(filterRow!.querySelector('div.grid')).toHaveClass('grid-cols-1');
    for (const control of within(filterRow!).getAllByRole('combobox')) {
      expect(control).toHaveClass('w-full');
    }

    const card = screen.getByRole('button', { name: "View A Coach With A Deliberately Long Name's profile" }).closest('div.group');
    expect(card).toHaveClass('min-w-0', 'overflow-hidden');
    expect(within(card!).getByRole('button', { name: 'Save A Coach With A Deliberately Long Name to favorites' })).toBeInTheDocument();
    expect(within(card!).getByRole('button', { name: "View A Coach With A Deliberately Long Name's profile" })).toBeInTheDocument();
    expect(card!.querySelector('.flex.flex-wrap.items-center.gap-3')).toBeInTheDocument();
  });

  it('keeps the empty-result clear action reachable at a narrow viewport', async () => {
    setViewport(375);
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0, totalPages: 1 }),
    });

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'No coaches found' })).toBeInTheDocument());

    const emptyState = screen.getByRole('heading', { name: 'No coaches found' }).closest('div.min-w-0');
    expect(emptyState).toBeInTheDocument();
    const clearFilters = screen.getByRole('button', { name: 'Clear all filters' });
    expect(clearFilters).toBeVisible();
    expect(clearFilters).toHaveClass('w-full', 'max-w-xs');

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    fireEvent.change(search, { target: { value: 'unmatched coach' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    await waitFor(() => {
      expect(search).toHaveValue('');
      expect(screen.getByRole('heading', { name: 'No coaches found' })).toBeInTheDocument();
    });
  });

  it('keeps the marketplace retry action reachable at a narrow viewport', async () => {
    setViewport(375);
    (fetch as any).mockRejectedValue(new Error('network unavailable'));

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveClass('min-w-0');
    expect(alert.querySelector('div.min-w-0')).toBeInTheDocument();
    const retry = within(alert).getByRole('button', { name: 'Retry marketplace' });
    expect(retry).toBeVisible();
    expect(retry).toHaveClass('inline-block');
  });

  it('keeps populated pagination visible and usable without horizontal overflow on a narrow viewport', async () => {
    setViewport(320);
    (fetch as any).mockImplementation(async (request: RequestInfo | URL) => {
      const url = new URL(String(request), 'http://localhost');
      const page = url.searchParams.get('page') || '1';

      return {
        ok: true,
        json: async () => ({
          items: [{
            id: `coach-${page}`,
            displayName: `Coach page ${page}`,
            headline: 'Process coach',
            bio: 'A clear and practical learning plan.',
            markets: ['FOREX'],
            specialties: ['STRATEGY'],
            languages: ['English'],
            yearsOfExperience: 5,
            hourlyRateCents: 10000,
            instantRatePerMinuteCents: 166,
            currency: 'USD',
            verificationStatus: 'FULLY_VERIFIED',
            ratingAverage: 5,
            ratingCount: 1,
            approved: true,
            availability: 'AVAILABLE',
          }],
          total: 3,
          totalPages: 3,
        }),
      };
    });

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const pagination = await screen.findByRole('navigation', { name: 'Marketplace pagination' });
    const previous = within(pagination).getByRole('button', { name: 'Previous' });
    const next = within(pagination).getByRole('button', { name: 'Next' });

    expect(pagination).toHaveClass('w-full', 'min-w-0', 'flex-wrap');
    expect(previous).toBeVisible();
    expect(next).toBeVisible();
    const pageStatus = within(pagination).getByRole('status');
    expect(pageStatus).toHaveAttribute('aria-live', 'polite');
    expect(pageStatus).toHaveAttribute('aria-atomic', 'true');
    expect(pageStatus).toHaveTextContent('Page 1 of 3');

    fireEvent.click(next);
    await waitFor(() => expect(pageStatus).toHaveTextContent('Page 2 of 3'));
    expect(previous).toBeEnabled();
    expect(next).toBeEnabled();

    fireEvent.click(previous);
    await waitFor(() => expect(pageStatus).toHaveTextContent('Page 1 of 3'));
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
  });

  it('returns to the first page when marketplace search or filters change', async () => {
    (fetch as any).mockImplementation(async (request: RequestInfo | URL) => {
      const url = new URL(String(request), 'http://localhost');
      const page = url.searchParams.get('page') || '1';

      return {
        ok: true,
        json: async () => ({
          items: [{
            id: `coach-${page}`,
            displayName: `Coach page ${page}`,
            headline: 'Process coach',
            bio: 'A clear and practical learning plan.',
            markets: ['FOREX'],
            specialties: ['STRATEGY'],
            languages: ['English'],
            yearsOfExperience: 5,
            hourlyRateCents: 10000,
            instantRatePerMinuteCents: 166,
            currency: 'USD',
            verificationStatus: 'FULLY_VERIFIED',
            ratingAverage: 5,
            ratingCount: 1,
            approved: true,
            availability: 'AVAILABLE',
          }],
          total: 3,
          totalPages: 3,
        }),
      };
    });

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const pagination = await screen.findByRole('navigation', { name: 'Marketplace pagination' });
    const next = within(pagination).getByRole('button', { name: 'Next' });
    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');

    const expectFirstPageAfterChange = async (change: () => void) => {
      fireEvent.click(next);
      await waitFor(() => expect(within(pagination).getByText('Page 2 of 3')).toBeVisible());
      change();
      await waitFor(() => expect(within(pagination).getByText('Page 1 of 3')).toBeVisible());
    };

    await expectFirstPageAfterChange(() => fireEvent.change(search, { target: { value: 'strategy' } }));
    await expectFirstPageAfterChange(() => fireEvent.change(screen.getByDisplayValue('All Markets'), { target: { value: 'CRYPTO' } }));
    await expectFirstPageAfterChange(() => fireEvent.change(screen.getByDisplayValue('All Specialties'), { target: { value: 'STRATEGY' } }));
    await expectFirstPageAfterChange(() => fireEvent.change(screen.getByDisplayValue('Relevance'), { target: { value: 'EXPERIENCE' } }));
  });

  it('announces the loaded count when marketplace search or filters refresh results', async () => {
    (fetch as any).mockImplementation(async (request: RequestInfo | URL) => {
      const url = new URL(String(request), 'http://localhost');
      const hasSearchOrFilter = Boolean(url.searchParams.get('q') || url.searchParams.get('market'));
      const total = url.searchParams.get('market') ? 1 : hasSearchOrFilter ? 2 : 3;

      return {
        ok: true,
        json: async () => ({
          items: [],
          total,
          totalPages: 1,
        }),
      };
    });

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const announcement = await screen.findByRole('status', { name: 'Marketplace results' });
    expect(announcement).toBeEmptyDOMElement();

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    fireEvent.change(search, { target: { value: 'strategy' } });
    await waitFor(() => expect(announcement).toHaveTextContent('Marketplace results updated: 2 coaches loaded.'));
    expect(announcement).not.toHaveTextContent('Page');

    fireEvent.change(screen.getByDisplayValue('All Markets'), { target: { value: 'CRYPTO' } });
    await waitFor(() => expect(announcement).toHaveTextContent('Marketplace results updated: 1 coach loaded.'));
  });

  it('returns to the first page when selecting a recent search or removing an active filter chip', async () => {
    localStorage.setItem('tradigo_recent_coach_searches', JSON.stringify(['saved strategy']));
    (fetch as any).mockImplementation(async (request: RequestInfo | URL) => {
      const url = new URL(String(request), 'http://localhost');
      const page = url.searchParams.get('page') || '1';

      return {
        ok: true,
        json: async () => ({
          items: [{
            id: `coach-${page}`,
            displayName: `Coach page ${page}`,
            headline: 'Process coach',
            bio: 'A clear and practical learning plan.',
            markets: ['FOREX'],
            specialties: ['STRATEGY'],
            languages: ['English'],
            yearsOfExperience: 5,
            hourlyRateCents: 10000,
            instantRatePerMinuteCents: 166,
            currency: 'USD',
            verificationStatus: 'FULLY_VERIFIED',
            ratingAverage: 5,
            ratingCount: 1,
            approved: true,
            availability: 'AVAILABLE',
          }],
          total: 3,
          totalPages: 3,
        }),
      };
    });

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const pagination = await screen.findByRole('navigation', { name: 'Marketplace pagination' });
    const pageStatus = within(pagination).getByRole('status');
    const next = within(pagination).getByRole('button', { name: 'Next' });
    const goToPageTwo = async () => {
      fireEvent.click(next);
      await waitFor(() => expect(pageStatus).toHaveTextContent('Page 2 of 3'));
    };
    const expectFirstPage = async () => {
      await waitFor(() => expect(pageStatus).toHaveTextContent('Page 1 of 3'));
    };

    await goToPageTwo();
    fireEvent.click(await screen.findByRole('button', { name: 'saved strategy' }));
    await expectFirstPage();

    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');
    fireEvent.change(search, { target: { value: 'momentum' } });
    await waitFor(() => expect(screen.getByText('Search: momentum')).toBeInTheDocument());
    await goToPageTwo();
    const searchChip = screen.getByText('Search: momentum').closest('span');
    const removeSearchFilter = within(searchChip!).getByRole('button', { name: 'Remove search filter: momentum' });
    expect(removeSearchFilter).toBeInTheDocument();
    fireEvent.click(removeSearchFilter);
    await expectFirstPage();

    fireEvent.change(screen.getByDisplayValue('All Markets'), { target: { value: 'CRYPTO' } });
    await waitFor(() => expect(screen.getByText('Market: CRYPTO')).toBeInTheDocument());
    await goToPageTwo();
    const marketChip = screen.getByText('Market: CRYPTO').closest('span');
    const removeMarketFilter = within(marketChip!).getByRole('button', { name: 'Remove market filter: CRYPTO' });
    expect(removeMarketFilter).toBeInTheDocument();
    fireEvent.click(removeMarketFilter);
    await expectFirstPage();

    fireEvent.change(screen.getByDisplayValue('All Specialties'), { target: { value: 'STRATEGY' } });
    await waitFor(() => expect(screen.getByText('Specialty: STRATEGY')).toBeInTheDocument());
    await goToPageTwo();
    const specialtyChip = screen.getByText('Specialty: STRATEGY').closest('span');
    const removeSpecialtyFilter = within(specialtyChip!).getByRole('button', { name: 'Remove specialty filter: STRATEGY' });
    expect(removeSpecialtyFilter).toBeInTheDocument();
    fireEvent.click(removeSpecialtyFilter);
    await expectFirstPage();
  });

  it('returns to page one when Clear All removes search, market, and specialty filters', async () => {
    const requests: URL[] = [];
    (fetch as any).mockImplementation(async (request: RequestInfo | URL) => {
      const url = new URL(String(request), 'http://localhost');
      requests.push(url);
      const page = url.searchParams.get('page') || '1';

      return {
        ok: true,
        json: async () => ({
          items: [{
            id: `coach-${page}`,
            displayName: `Coach page ${page}`,
            headline: 'Process coach',
            bio: 'A clear and practical learning plan.',
            markets: ['FOREX'],
            specialties: ['STRATEGY'],
            languages: ['English'],
            yearsOfExperience: 5,
            hourlyRateCents: 10000,
            instantRatePerMinuteCents: 166,
            currency: 'USD',
            verificationStatus: 'FULLY_VERIFIED',
            ratingAverage: 5,
            ratingCount: 1,
            approved: true,
            availability: 'AVAILABLE',
          }],
          total: 3,
          totalPages: 3,
        }),
      };
    });

    render(<MemoryRouter><MarketplaceView /></MemoryRouter>);

    const pagination = await screen.findByRole('navigation', { name: 'Marketplace pagination' });
    const pageStatus = within(pagination).getByRole('status');
    const next = within(pagination).getByRole('button', { name: 'Next' });
    const search = screen.getByPlaceholderText('Search by name, specialties, or bio...');

    fireEvent.change(search, { target: { value: 'momentum' } });
    fireEvent.change(screen.getByDisplayValue('All Markets'), { target: { value: 'CRYPTO' } });
    fireEvent.change(screen.getByDisplayValue('All Specialties'), { target: { value: 'STRATEGY' } });
    await waitFor(() => {
      expect(screen.getByText('Search: momentum')).toBeInTheDocument();
      expect(screen.getByText('Market: CRYPTO')).toBeInTheDocument();
      expect(screen.getByText('Specialty: STRATEGY')).toBeInTheDocument();
    });

    fireEvent.click(next);
    await waitFor(() => expect(pageStatus).toHaveTextContent('Page 2 of 3'));

    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    await waitFor(() => expect(pageStatus).toHaveTextContent('Page 1 of 3'));
    expect(screen.queryByText('Search: momentum')).not.toBeInTheDocument();
    expect(screen.queryByText('Market: CRYPTO')).not.toBeInTheDocument();
    expect(screen.queryByText('Specialty: STRATEGY')).not.toBeInTheDocument();

    await waitFor(() => {
      const clearedRequest = requests.at(-1);
      expect(clearedRequest?.searchParams.get('page')).toBe('1');
      expect(clearedRequest?.searchParams.get('q')).toBe('');
      expect(clearedRequest?.searchParams.get('market')).toBe('');
      expect(clearedRequest?.searchParams.get('specialty')).toBe('');
    });
  });

  it('restores search, filters, sort, and page from a copied marketplace URL', async () => {
    const requests: URL[] = [];
    (fetch as any).mockImplementation(async (request: RequestInfo | URL) => {
      const url = new URL(String(request), 'http://localhost');
      requests.push(url);

      return {
        ok: true,
        json: async () => ({
          items: [{
            id: 'shared-coach',
            displayName: 'Shared Coach',
            headline: 'A coach from a shared link',
            bio: 'A practical trading process.',
            markets: ['CRYPTO'],
            specialties: ['STRATEGY'],
            languages: ['English'],
            yearsOfExperience: 5,
            hourlyRateCents: 10000,
            instantRatePerMinuteCents: 166,
            currency: 'USD',
            verificationStatus: 'FULLY_VERIFIED',
            ratingAverage: 5,
            ratingCount: 1,
            approved: true,
            availability: 'AVAILABLE',
          }],
          total: 25,
          totalPages: 3,
        }),
      };
    });

    render(
      <MemoryRouter initialEntries={['/app/coaches?q=momentum%20plan&market=CRYPTO&specialty=STRATEGY&sort=EXPERIENCE&page=2']}>
        <LocationProbe />
        <MarketplaceView />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Shared Coach')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name, specialties, or bio...')).toHaveValue('momentum plan');
    expect(screen.getByDisplayValue('Crypto')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Strategy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Experience')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    const request = requests.at(-1);
    expect(request?.searchParams.get('q')).toBe('momentum plan');
    expect(request?.searchParams.get('market')).toBe('CRYPTO');
    expect(request?.searchParams.get('specialty')).toBe('STRATEGY');
    expect(request?.searchParams.get('sort')).toBe('EXPERIENCE');
    expect(request?.searchParams.get('page')).toBe('2');
  });

  it('clears marketplace URL filters back to page one without dropping unrelated query state', async () => {
    (fetch as any).mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        items: [{
          id: 'clearable-coach',
          displayName: 'Clearable Coach',
          headline: 'A marketplace coach',
          bio: 'A practical trading process.',
          markets: ['FOREX'],
          specialties: ['STRATEGY'],
          languages: ['English'],
          yearsOfExperience: 5,
          hourlyRateCents: 10000,
          instantRatePerMinuteCents: 166,
          currency: 'USD',
          verificationStatus: 'FULLY_VERIFIED',
          ratingAverage: 5,
          ratingCount: 1,
          approved: true,
          availability: 'AVAILABLE',
        }],
        total: 25,
        totalPages: 3,
      }),
    }));

    render(
      <MemoryRouter initialEntries={['/app/coaches?q=momentum&market=CRYPTO&specialty=STRATEGY&sort=EXPERIENCE&page=2&from=dashboard']}>
        <LocationProbe />
        <MarketplaceView />
      </MemoryRouter>,
    );

    const clearAll = await screen.findByRole('button', { name: 'Clear All' });
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    fireEvent.click(clearAll);

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent('/app/coaches?from=dashboard');
    });
    expect(screen.getByPlaceholderText('Search by name, specialties, or bio...')).toHaveValue('');
    expect(screen.getByDisplayValue('All Markets')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Specialties')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Relevance')).toBeInTheDocument();
  });
});
