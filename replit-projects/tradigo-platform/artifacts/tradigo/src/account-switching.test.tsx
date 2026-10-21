import React, { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useAuthStore } from './stores/authStore';
import { apiClient } from './lib/apiClient';
import { ProtectedRoute } from './routes/guards';
import { FavoritesView } from './routes/trader/FavoritesView';
import { TraderOnboarding } from './routes/onboarding/TraderOnboarding';
import { NotificationBell } from './components/notifications/NotificationBell';
import { SessionsListView } from './routes/shared/SessionsListView';
import { LearningHubView } from './routes/trader/LearningHubView';

const { firebaseAuth, authStateChanged } = vi.hoisted(() => ({
  firebaseAuth: { currentUser: null as any },
  authStateChanged: vi.fn(),
}));

vi.mock('./lib/firebase', () => ({ auth: firebaseAuth }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: authStateChanged }));

type TestUser = {
  uid: string;
  getIdToken: () => Promise<string>;
};

const users = {
  first: {
    uid: 'firebase-first',
    getIdToken: vi.fn(async () => 'token-first'),
  },
  second: {
    uid: 'firebase-second',
    getIdToken: vi.fn(async () => 'token-second'),
  },
} satisfies Record<string, TestUser>;

const profiles: Record<string, any> = {
  'token-first': {
    user: {
      id: 'user-first',
      firebaseUid: 'firebase-first',
      email: 'first@example.com',
      displayName: 'First Trader',
      role: 'TRADER',
      status: 'ACTIVE',
      countryCode: 'US',
    },
    traderProfile: {
      userId: 'user-first',
      onboardingCurrentStep: 2,
      onboardingCompletedAt: '2026-08-20T12:00:00.000Z',
      instruments: ['FOREX'],
      experienceLevel: 'BEGINNER',
      timezone: 'UTC',
    },
  },
  'token-second': {
    user: {
      id: 'user-second',
      firebaseUid: 'firebase-second',
      email: 'second@example.com',
      displayName: 'Second Trader',
      role: 'TRADER',
      status: 'ACTIVE',
      countryCode: 'CA',
    },
    traderProfile: {
      userId: 'user-second',
      onboardingCurrentStep: 1,
      onboardingCompletedAt: '2026-08-21T12:00:00.000Z',
      instruments: ['CRYPTO'],
      experienceLevel: 'INTERMEDIATE',
      timezone: 'UTC',
    },
  },
};

const scopedResponses: Record<string, any> = {
  'token-first': {
    favorites: { favorites: [{ coachUserId: 'coach-first' }] },
    coaches: {
      id: 'coach-first',
      displayName: 'Coach for First Trader',
      headline: 'First-only coaching',
      bio: 'Private first-account coach',
      markets: ['FOREX'],
      specialties: ['STRATEGY'],
      languages: ['English'],
      yearsOfExperience: 5,
      hourlyRateCents: 10000,
      instantRatePerMinuteCents: 166,
      currency: 'USD',
      approved: true,
      ratingAverage: 5,
      ratingCount: 1,
    },
    notifications: {
      notifications: [{
        id: 'notification-first',
        title: 'First account notification',
        body: 'Only the first trader should see this.',
        createdAt: '2026-08-26T10:00:00.000Z',
      }],
      unreadCount: 1,
    },
    sessions: {
      items: [{
        id: 'session-first',
        mode: 'SCHEDULED',
        status: 'COMPLETED',
        topic: 'First account lesson',
        scheduledAt: '2026-08-25T12:00:00.000Z',
        durationMinutes: 30,
        amountCents: 3000,
        paymentStatus: 'CAPTURED',
        createdAt: '2026-08-25T11:00:00.000Z',
      }],
    },
    passport: {
      records: [{
        id: 'passport-first',
        sessionId: 'session-first',
        learningGoal: 'First account learning passport',
        status: 'COMPLETE',
      }],
    },
    journal: {
      entries: [{
        id: 'journal-first',
        title: 'First account journal entry',
        body: 'Only account A should see this journal entry.',
        entryType: 'GENERAL',
        visibility: 'TRADER_PRIVATE',
        entryDate: '2026-08-25T12:00:00.000Z',
        version: 1,
      }],
    },
    tradeReviews: {
      reviews: [{
        id: 'review-first',
        instrument: 'EURUSD',
        direction: 'LONG',
        tradeOutcome: 'WIN',
        thesis: 'Only account A should see this trade review.',
        pnlMinor: 15000,
        pnlCurrency: 'USD',
        visibility: 'TRADER_PRIVATE',
        reviewDate: '2026-08-25T12:00:00.000Z',
      }],
    },
  },
  'token-second': {
    favorites: { favorites: [] },
    coaches: null,
    notifications: { notifications: [], unreadCount: 0 },
    sessions: {
      items: [{
        id: 'session-second',
        mode: 'SCHEDULED',
        status: 'COMPLETED',
        topic: 'Second account lesson',
        scheduledAt: '2026-08-26T12:00:00.000Z',
        durationMinutes: 30,
        amountCents: 3000,
        paymentStatus: 'CAPTURED',
        createdAt: '2026-08-26T11:00:00.000Z',
      }],
    },
    passport: { records: [] },
    journal: { entries: [] },
    tradeReviews: { reviews: [] },
  },
};

const firstAccountNotifications = scopedResponses['token-first'].notifications;

function jsonResponse(body: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

function installScopedApiResponses() {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '');

    if (url.endsWith('/api/auth/me')) return jsonResponse(profiles[token!]);
    const response = scopedResponses[token!];
    if (url.endsWith('/api/marketplace/favorites')) return jsonResponse(response.favorites);
    if (url.includes('/api/marketplace/coaches/')) return jsonResponse(response.coaches);
    if (url.endsWith('/api/notifications?pageSize=10')) return jsonResponse(response.notifications);
    if (url.endsWith('/api/notifications/unread-count')) return jsonResponse({ unreadCount: response.notifications.unreadCount });
    if (url.endsWith('/api/sessions')) return jsonResponse(response.sessions);
    if (url.endsWith('/api/learning/passport')) return jsonResponse(response.passport);
    if (url.endsWith('/api/journal')) return jsonResponse(response.journal);
    if (url.endsWith('/api/trade-reviews')) return jsonResponse(response.tradeReviews);

    throw new Error(`Unexpected test request: ${url}`);
  });
}

function emitUser(user: TestUser) {
  firebaseAuth.currentUser = user;
  return authStateChanged.mock.calls[0][1](user);
}

function ProtectedDataProbe() {
  const { canonicalUser } = useAuthStore();
  const [sessionTopic, setSessionTopic] = useState('');

  useEffect(() => {
    let active = true;
    setSessionTopic('');
    apiClient.get('/api/sessions').then((data) => {
      if (active) setSessionTopic(data.items[0]?.topic ?? '');
    });
    return () => {
      active = false;
    };
  }, [canonicalUser?.id]);

  return (
    <div>
      <p data-testid="active-profile">{canonicalUser?.displayName}</p>
      <p data-testid="protected-session">{sessionTopic}</p>
      <TraderOnboarding />
      <FavoritesView />
      <NotificationBell />
    </div>
  );
}

describe('real-account switching isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    firebaseAuth.currentUser = null;
    useAuthStore.setState({
      firebaseUser: null,
      identityVersion: 0,
      canonicalUser: null,
      traderProfile: null,
      coachProfile: null,
      coachApplicationStatus: null,
      loading: true,
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn());
    installScopedApiResponses();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('clears favorites, notifications, onboarding, profile, and protected data when accounts switch', async () => {
    render(
      <MemoryRouter initialEntries={['/app/favorites']}>
        <Routes>
          <Route
            path="/app/favorites"
            element={
              <ProtectedRoute allowedRoles={['TRADER']}>
                <ProtectedDataProbe />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<p>Login</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      useAuthStore.getState().initialize();
    });
    await act(async () => {
      await emitUser(users.first);
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-profile')).toHaveTextContent('First Trader');
      expect(screen.getByText('Coach for First Trader')).toBeInTheDocument();
      expect(screen.getByTestId('protected-session')).toHaveTextContent('First account lesson');
      expect(screen.getByText('What do you trade?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('First account notification')).toBeInTheDocument();

    localStorage.setItem('tradigo-learning-needs', JSON.stringify({ needs: { objective: 'risk' } }));
    localStorage.setItem('tradigo-favorite-coach-first', 'true');
    localStorage.setItem('tradigo_recent_coach_searches', JSON.stringify(['first-only search']));
    localStorage.setItem('tradigo_preview_role', 'TRADER');
    sessionStorage.setItem('tradigo_preview_session', 'preview-first');

    await act(async () => {
      await emitUser(users.second);
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-profile')).toHaveTextContent('Second Trader');
      expect(screen.getByTestId('protected-session')).toHaveTextContent('Second account lesson');
       expect(screen.getByText('Welcome to Tradigo!')).toBeInTheDocument();
      expect(screen.getByText('No favorites yet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('No notifications')).toBeInTheDocument();

    expect(screen.queryByText('First Trader')).not.toBeInTheDocument();
    expect(screen.queryByText('Coach for First Trader')).not.toBeInTheDocument();
    expect(screen.queryByText('First account notification')).not.toBeInTheDocument();
    expect(screen.queryByText('First account lesson')).not.toBeInTheDocument();
    expect(screen.queryByText('What do you trade?')).not.toBeInTheDocument();
    expect(localStorage.getItem('tradigo-learning-needs')).toBeNull();
    expect(localStorage.getItem('tradigo-favorite-coach-first')).toBeNull();
    expect(localStorage.getItem('tradigo_recent_coach_searches')).toBeNull();
    expect(localStorage.getItem('tradigo_preview_role')).toBeNull();
    expect(sessionStorage.getItem('tradigo_preview_session')).toBeNull();
  });

  it('rejects a protected response that finishes after Firebase changes identity', async () => {
    const responseDeferred: { resolve: (response: any) => void } = {
      resolve: () => {},
    };
    vi.mocked(fetch).mockImplementation(async () => new Promise((resolve) => {
      responseDeferred.resolve = resolve;
    }));

    firebaseAuth.currentUser = users.first;
    const request = apiClient.get('/api/sessions');
    await new Promise((resolve) => setTimeout(resolve, 0));
    firebaseAuth.currentUser = users.second;
    responseDeferred.resolve(await jsonResponse({ items: [{ topic: 'First account lesson' }] }));

    await expect(request).rejects.toThrow('Authentication changed while receiving the response.');
  });

  it('does not render stale notification or unread-count polls after switching accounts', async () => {
    let notificationRequestCount = 0;
    let unreadCountRequestCount = 0;
    let pollStarted = false;
    const intervalCallbacks: TimerHandler[] = [];
    let releaseStaleNotifications!: (response: any) => void;
    let releaseStaleUnreadCount!: (response: any) => void;
    const staleNotifications = new Promise<any>((resolve) => {
      releaseStaleNotifications = resolve;
    });
    const staleUnreadCount = new Promise<any>((resolve) => {
      releaseStaleUnreadCount = resolve;
    });
    const intervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(((callback: TimerHandler) => {
      intervalCallbacks.push(callback);
      return 1 as any;
    }) as typeof setInterval);

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '');

      if (url.endsWith('/api/notifications?pageSize=10')) {
        notificationRequestCount += 1;
        if (token === 'token-first' && pollStarted) return staleNotifications;
        return jsonResponse(scopedResponses[token!].notifications);
      }
      if (url.endsWith('/api/notifications/unread-count')) {
        unreadCountRequestCount += 1;
        if (token === 'token-first' && pollStarted) return staleUnreadCount;
        return jsonResponse({ unreadCount: scopedResponses[token!].notifications.unreadCount });
      }

      throw new Error(`Unexpected test request: ${url}`);
    });

    firebaseAuth.currentUser = users.first;
    useAuthStore.setState({
      firebaseUser: users.first as any,
      identityVersion: 1,
      loading: false,
    });

    try {
      render(
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('1', { selector: 'span' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
      expect(screen.getByText('First account notification')).toBeInTheDocument();

      const initialNotificationRequestCount = notificationRequestCount;
      const initialUnreadCountRequestCount = unreadCountRequestCount;
      pollStarted = true;
      await act(async () => {
        (intervalCallbacks[0] as () => void)();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(notificationRequestCount).toBeGreaterThan(initialNotificationRequestCount);
        expect(unreadCountRequestCount).toBeGreaterThan(initialUnreadCountRequestCount);
      });

      firebaseAuth.currentUser = users.second;
      await act(async () => {
        useAuthStore.getState().setFirebaseUser(users.second as any);
      });

      expect(screen.queryByText('First account notification')).not.toBeInTheDocument();
      expect(screen.queryByText('1', { selector: 'span' })).not.toBeInTheDocument();

      await act(async () => {
        releaseStaleNotifications(jsonResponse(firstAccountNotifications));
        releaseStaleUnreadCount(jsonResponse({ unreadCount: 1 }));
      });

      await waitFor(() => {
        expect(screen.queryByText('First account notification')).not.toBeInTheDocument();
        expect(screen.queryByText('1', { selector: 'span' })).not.toBeInTheDocument();
      });
    } finally {
      intervalSpy.mockRestore();
    }
  });

  it('clears session history, passports, journal entries, and trade reviews across a delayed account switch', async () => {
    let journalRequestCount = 0;
    let releaseDelayedAccountAJournal!: () => void;
    const delayedAccountAJournal = new Promise<any>((resolve) => {
      releaseDelayedAccountAJournal = () => resolve(jsonResponse(scopedResponses['token-first'].journal));
    });

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '');
      if (url.endsWith('/api/auth/me')) return jsonResponse(profiles[token!]);

      const response = scopedResponses[token!];
      if (url.endsWith('/api/sessions')) return jsonResponse(response.sessions);
      if (url.endsWith('/api/learning/passport')) return jsonResponse(response.passport);
      if (url.endsWith('/api/trade-reviews')) return jsonResponse(response.tradeReviews);
      if (url.endsWith('/api/journal')) {
        if (token === 'token-first' && journalRequestCount++ === 1) return delayedAccountAJournal;
        return jsonResponse(response.journal);
      }

      throw new Error(`Unexpected test request: ${url}`);
    });

    firebaseAuth.currentUser = users.first;
    useAuthStore.setState({
      firebaseUser: users.first as any,
      canonicalUser: profiles['token-first'].user,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/app/sessions']}>
        <Routes>
          <Route
            path="/app/sessions"
            element={
              <div>
                <SessionsListView />
                <LearningHubView />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('First account lesson')).toBeInTheDocument();
      expect(screen.getByText('First account learning passport')).toBeInTheDocument();
      expect(screen.getByText('First account journal entry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trade Reviews (Self-Reported)' }));
    await waitFor(() => expect(screen.getByText('Only account A should see this trade review.')).toBeInTheDocument());

    // Start a second A-owned journal request and leave it unresolved while the
    // identity transition mounts account B's empty state.
    fireEvent.click(screen.getByRole('button', { name: 'Trading Journal' }));
    await waitFor(() => expect(journalRequestCount).toBe(2));

    await act(async () => {
      firebaseAuth.currentUser = users.second;
      useAuthStore.getState().setFirebaseUser(users.second as any);
    });

    await waitFor(() => {
      expect(screen.getByText('No open sessions yet.')).toBeInTheDocument();
      expect(screen.getByText('No journal entries yet')).toBeInTheDocument();
      expect(screen.getByText('Second account lesson')).toBeInTheDocument();
    });
    expect(screen.queryByText('First account lesson')).not.toBeInTheDocument();
    expect(screen.queryByText('First account learning passport')).not.toBeInTheDocument();
    expect(screen.queryByText('First account journal entry')).not.toBeInTheDocument();
    expect(screen.queryByText('Only account A should see this trade review.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trade Reviews (Self-Reported)' }));
    await waitFor(() => expect(screen.getByText('No trade reviews recorded')).toBeInTheDocument());
    expect(screen.queryByText('Only account A should see this trade review.')).not.toBeInTheDocument();

    await act(async () => {
      releaseDelayedAccountAJournal();
    });
    await waitFor(() => {
      expect(screen.queryByText('First account journal entry')).not.toBeInTheDocument();
      expect(screen.queryByText('First account learning passport')).not.toBeInTheDocument();
      expect(screen.queryByText('Only account A should see this trade review.')).not.toBeInTheDocument();
    });
  });

  it('does not let preview-only identities satisfy the real protected route', () => {
    useAuthStore.setState({
      loading: false,
      firebaseUser: null,
      canonicalUser: profiles['token-first'].user,
    });

    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route
            path="/app"
            element={
              <ProtectedRoute allowedRoles={['TRADER']}>
                <p>Real account content</p>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<p>Login</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.queryByText('Real account content')).not.toBeInTheDocument();
  });
});