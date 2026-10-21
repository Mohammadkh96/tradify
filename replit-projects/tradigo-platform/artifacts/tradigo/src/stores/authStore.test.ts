import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuth, mockOnAuthStateChanged, mockApiGet } = vi.hoisted(() => ({
  mockAuth: {
    currentUser: null as any,
    signOut: vi.fn(),
  },
  mockOnAuthStateChanged: vi.fn(),
  mockApiGet: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  auth: mockAuth,
}));

vi.mock('../lib/apiClient', () => ({
  apiClient: {
    get: mockApiGet,
  },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
}));

import { useAuthStore } from './authStore';

const account = (uid: string) => ({ uid } as any);

function resetStore() {
  useAuthStore.setState({
    firebaseUser: null,
    identityVersion: 0,
    canonicalUser: null,
    traderProfile: null,
    coachProfile: null,
    coachApplicationStatus: null,
    loading: false,
    error: null,
  });
}

describe('account identity isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    resetStore();
    mockAuth.currentUser = null;
  });

  it('clears user-scoped browser state when switching accounts', () => {
    const userA = account('firebase-user-a');
    const userB = account('firebase-user-b');

    useAuthStore.setState({
      firebaseUser: userA,
      canonicalUser: { id: 'user-a', role: 'TRADER', status: 'ACTIVE' } as any,
      traderProfile: { userId: 'user-a' } as any,
      coachProfile: { userId: 'user-a' } as any,
      coachApplicationStatus: 'PENDING',
    });
    localStorage.setItem('tradigo-learning-needs', JSON.stringify({ needs: { objective: 'trade review' } }));
    localStorage.setItem('tradigo_recent_coach_searches', JSON.stringify(['Maya']));
    localStorage.setItem('tradigo-favorite-user-a', 'true');
    localStorage.setItem('ui-theme', 'dark');
    sessionStorage.setItem('tradigo_preview_session', 'stale-preview-token');

    useAuthStore.getState().setFirebaseUser(userB);

    expect(useAuthStore.getState()).toMatchObject({
      firebaseUser: userB,
      canonicalUser: null,
      traderProfile: null,
      coachProfile: null,
      coachApplicationStatus: null,
    });
    expect(localStorage.getItem('tradigo-learning-needs')).toBeNull();
    expect(localStorage.getItem('tradigo_recent_coach_searches')).toBeNull();
    expect(localStorage.getItem('tradigo-favorite-user-a')).toBeNull();
    expect(sessionStorage.getItem('tradigo_preview_session')).toBeNull();
    expect(localStorage.getItem('ui-theme')).toBe('dark');
  });

  it('clears canonical state on sign-out even when Firebase was already null', () => {
    useAuthStore.setState({
      firebaseUser: null,
      canonicalUser: { id: 'user-a', role: 'TRADER', status: 'ACTIVE' } as any,
      traderProfile: { userId: 'user-a' } as any,
    });
    localStorage.setItem('tradigo-learning-needs', '{"needs":{}}');

    useAuthStore.getState().setFirebaseUser(null);

    expect(useAuthStore.getState()).toMatchObject({
      firebaseUser: null,
      canonicalUser: null,
      traderProfile: null,
      coachProfile: null,
      coachApplicationStatus: null,
    });
    expect(localStorage.getItem('tradigo-learning-needs')).toBeNull();
  });

  it('ignores a stale profile response after the account changes', async () => {
    const userA = account('firebase-user-a');
    const userB = account('firebase-user-b');
    let resolveProfile!: (value: unknown) => void;
    mockApiGet.mockReturnValue(new Promise((resolve) => {
      resolveProfile = resolve;
    }));
    useAuthStore.setState({ firebaseUser: userA });

    const refresh = useAuthStore.getState().refreshProfile();
    useAuthStore.getState().setFirebaseUser(userB);
    resolveProfile({
      user: { id: 'user-a', role: 'TRADER', status: 'ACTIVE' },
      traderProfile: { userId: 'user-a' },
    });
    await refresh;

    expect(useAuthStore.getState().canonicalUser).toBeNull();
    expect(useAuthStore.getState().traderProfile).toBeNull();
    expect(useAuthStore.getState().firebaseUser).toBe(userB);
  });

  it('does not let a stale profile failure clear the replacement account', async () => {
    const userA = account('firebase-user-a');
    const userB = account('firebase-user-b');
    let rejectProfile!: (reason?: unknown) => void;
    mockApiGet.mockReturnValue(new Promise((_, reject) => {
      rejectProfile = reject;
    }));
    useAuthStore.setState({
      firebaseUser: userA,
      canonicalUser: { id: 'user-b', role: 'TRADER', status: 'ACTIVE' } as any,
    });

    const refresh = useAuthStore.getState().refreshProfile();
    useAuthStore.getState().setFirebaseUser(userB);
    rejectProfile(new Error('old account request failed'));
    await refresh;

    expect(useAuthStore.getState().firebaseUser).toBe(userB);
    expect(useAuthStore.getState().canonicalUser).toBeNull();
    expect(useAuthStore.getState().error).toBeNull();
  });
});