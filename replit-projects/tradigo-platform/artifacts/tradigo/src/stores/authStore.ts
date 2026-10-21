import { create } from 'zustand';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { User, TraderProfile, CoachProfile } from '../types/index.js';
import { apiClient } from '../lib/apiClient';

const clearUserScopedState = () => {
  localStorage.removeItem('tradigo_dev_token');
  localStorage.removeItem('tradigo_preview_role');
  sessionStorage.removeItem('tradigo_preview_session');
  localStorage.removeItem('tradigo_recent_coach_searches');
  localStorage.removeItem('tradigo-learning-needs');
  Object.keys(localStorage)
    .filter((key) => key.startsWith('tradigo-favorite-'))
    .forEach((key) => localStorage.removeItem(key));
};

let authEpoch = 0;
interface AuthState {
  firebaseUser: FirebaseUser | null;
  localSessionActive: boolean;
  identityVersion: number;
  canonicalUser: User | null;
  traderProfile: TraderProfile | null;
  coachProfile: CoachProfile | null;
  coachApplicationStatus: string | null;
  loading: boolean;
  error: string | null;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setLocalSessionActive: (active: boolean) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCoachApplicationStatus: (status: string | null) => void;
  logout: () => Promise<void>;
  initialize: () => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  localSessionActive: false,
  identityVersion: 0,
  canonicalUser: null,
  traderProfile: null,
  coachProfile: null,
  coachApplicationStatus: null,
  loading: true,
  error: null,
  
  setFirebaseUser: (user) => {
    const previous = get().firebaseUser;
    if (previous?.uid !== user?.uid || !user) {
      authEpoch += 1;
      clearUserScopedState();
      set((state) => ({
        firebaseUser: user,
        localSessionActive: false,
        identityVersion: state.identityVersion + 1,
        canonicalUser: null,
        traderProfile: null,
        coachProfile: null,
        coachApplicationStatus: null,
      }));
      return;
    }
    set({ firebaseUser: user });
  },
  setLocalSessionActive: (active) => {
    if (active) {
      authEpoch += 1;
      clearUserScopedState();
      set((state) => ({
        firebaseUser: null,
        localSessionActive: true,
        identityVersion: state.identityVersion + 1,
        canonicalUser: null,
        traderProfile: null,
        coachProfile: null,
        coachApplicationStatus: null,
      }));
      return;
    }
    set({ localSessionActive: false });
  },
  setUser: (user) => set({ canonicalUser: user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setCoachApplicationStatus: (status) => set({ coachApplicationStatus: status }),

  logout: async () => {
    authEpoch += 1;
    localStorage.removeItem('tradigo_dev_token');
    localStorage.removeItem('tradigo_preview_role');
    sessionStorage.removeItem('tradigo_preview_session');
    clearUserScopedState();
    try {
      await fetch('/api/auth/demo/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (e) {
      // Continue clearing client state if the server session is already gone.
    }
    try {
      await fetch('/api/auth/local/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (e) {
      // Continue clearing client state if the server session is already gone.
    }
    try {
      await auth.signOut();
    } catch (e) {
      // Continue clearing client state if Firebase is unavailable.
    }
    set((state) => ({
      firebaseUser: null,
      localSessionActive: false,
      identityVersion: state.identityVersion + 1,
      canonicalUser: null,
      traderProfile: null,
      coachProfile: null,
      coachApplicationStatus: null,
      loading: false,
    }));
    window.location.href = '/login';
  },
  
  refreshProfile: async () => {
    const { firebaseUser, localSessionActive } = get();
    if (!firebaseUser && !localSessionActive) return;
    const requestedUid = firebaseUser?.uid ?? 'local-session';
    const requestedEpoch = authEpoch;
    try {
      const data = await apiClient.get('/api/auth/me');
      if (authEpoch !== requestedEpoch || (get().firebaseUser?.uid ?? (get().localSessionActive ? 'local-session' : null)) !== requestedUid) return;
      set({
        localSessionActive: !firebaseUser,
        canonicalUser: data.user || data,
        traderProfile: data.traderProfile || null,
        coachProfile: data.coachProfile || null,
        coachApplicationStatus: data.coachApplicationStatus || null,
      });
    } catch {
      if (authEpoch !== requestedEpoch || (get().firebaseUser?.uid ?? (get().localSessionActive ? 'local-session' : null)) !== requestedUid) return;
      set({ localSessionActive: false, canonicalUser: null, traderProfile: null, coachProfile: null, coachApplicationStatus: null });
    }
  },

  initialize: () => {
    const legacyDemoToken = localStorage.getItem('tradigo_dev_token');
    if (legacyDemoToken?.startsWith('tradigo-demo') || legacyDemoToken?.startsWith('demo-')) {
      localStorage.removeItem('tradigo_dev_token');
    }
    set({ error: null });
    if (localStorage.getItem('tradigo_preview_role')) {
      set({ loading: false });
      return;
    }
    // Fallback timeout in case Firebase hangs
    const timeoutId = setTimeout(() => {
      if (get().loading) {
        console.warn('Firebase auth timeout, forcing loading false');
        set({ loading: false });
      }
    }, 3000);

    onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeoutId);
      const previousUser = get().firebaseUser;
      if (previousUser?.uid !== firebaseUser?.uid) {
        authEpoch += 1;
        clearUserScopedState();
        set((state) => ({
          identityVersion: state.identityVersion + 1,
          canonicalUser: null,
          traderProfile: null,
          coachProfile: null,
          coachApplicationStatus: null,
        }));
      }
      const callbackEpoch = authEpoch;
      set({ firebaseUser, localSessionActive: firebaseUser ? false : get().localSessionActive, loading: true, error: null });
      
      if (!firebaseUser) {
        try {
          const data = await apiClient.get('/api/auth/me');
          if (authEpoch !== callbackEpoch || get().firebaseUser) return;
          set({
            localSessionActive: true,
            canonicalUser: data.user || data,
            traderProfile: data.traderProfile || null,
            coachProfile: data.coachProfile || null,
            coachApplicationStatus: data.coachApplicationStatus || null,
            loading: false,
          });
        } catch {
          if (authEpoch !== callbackEpoch || get().firebaseUser) return;
          set({ localSessionActive: false, canonicalUser: null, traderProfile: null, coachProfile: null, loading: false });
        }
        return;
      }
      
      try {
        const data = await apiClient.get('/api/auth/me');
        // A slower profile request from a previous account must not restore
        // that account after Firebase has already switched identities.
        if (authEpoch !== callbackEpoch || get().firebaseUser?.uid !== firebaseUser.uid) return;

        set({ 
          canonicalUser: data.user || data, 
          traderProfile: data.traderProfile || null,
          coachProfile: data.coachProfile || null,
          coachApplicationStatus: data.coachApplicationStatus || null,
          loading: false 
        });
      } catch (err: any) {
        if (authEpoch !== callbackEpoch || get().firebaseUser?.uid !== firebaseUser.uid) return;
        set({ 
          error: err.message || 'Authentication error', 
          canonicalUser: null,
          traderProfile: null,
          coachProfile: null,
          loading: false 
        });
      }
    });
  }
}));
