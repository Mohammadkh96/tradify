import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';

// Optional Firebase Applet Configuration
let firebaseConfig: Record<string, string> | null = null;
const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};

if (metaEnv.VITE_FIREBASE_API_KEY) {
  firebaseConfig = {
    apiKey: metaEnv.VITE_FIREBASE_API_KEY,
    authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || '',
    appId: metaEnv.VITE_FIREBASE_APP_ID || '',
  };
}

export const isFirebaseConfigured = Boolean(firebaseConfig && firebaseConfig.apiKey);

const app = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig!)
  : null;

export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

export interface CanonicalAuthSession {
  user: {
    id: string;
    firebaseUid: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
    countryCode: string;
    avatarUrl?: string;
  };
  status: 'RESOLVED';
}

export interface RegistrationAuthSession extends CanonicalAuthSession {
  firebaseUser: FirebaseUser;
  verificationSent: boolean;
}

async function resolveCanonicalSession(token: string): Promise<CanonicalAuthSession> {
  const res = await fetch('/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Failed to resolve your Tradigo account');
  }

  const data = await res.json();
  return { user: data.user, status: 'RESOLVED' };
}

/**
 * Sign in with Google Popup and resolve canonical user record on backend.
 */
export async function signInWithGoogle(): Promise<CanonicalAuthSession> {
  if (!auth) {
    throw new Error('Firebase not configured');
  }

  const credential = await signInWithPopup(auth, googleProvider);
  const fbUser: FirebaseUser = credential.user;
  const token = await fbUser.getIdToken();
  return resolveCanonicalSession(token);
}

/**
 * Create an email/password account, resolve its canonical Tradigo user, and
 * send the first email-verification message.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<RegistrationAuthSession> {
  if (!auth) {
    throw new Error('Account creation is unavailable until Firebase is configured.');
  }

  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const fbUser = credential.user;
  const cleanDisplayName = displayName.trim().slice(0, 160);

  if (cleanDisplayName) {
    await updateProfile(fbUser, { displayName: cleanDisplayName });
  }

  let verificationSent = true;
  try {
    await sendEmailVerification(fbUser);
  } catch {
    verificationSent = false;
  }

  try {
    const session = await resolveCanonicalSession(await fbUser.getIdToken());
    return { ...session, firebaseUser: fbUser, verificationSent };
  } catch (error) {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Preserve the canonical-resolution error for the user.
    }
    throw error;
  }
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth?.currentUser) {
    throw new Error('Sign in again before requesting another verification email.');
  }
  await sendEmailVerification(auth.currentUser);
}

/**
 * Logout
 */
export async function logoutUser(): Promise<void> {
  if (auth) {
    await firebaseSignOut(auth);
  }
}

/**
 * Subscribe to auth state changes and sync canonical profile
 */
export function subscribeToAuth(onSession: (session: CanonicalAuthSession | null) => void) {
  if (!auth) {
    return () => {};
  }

  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      onSession(null);
      return;
    }

    try {
      const token = await fbUser.getIdToken();
      const res = await fetch('/api/auth/me', {
        headers: { 
          'Authorization': `Bearer ${token}` 
        },
      });
      if (res.ok) {
        const data = await res.json();
        onSession({ user: data.user, status: 'RESOLVED' });
      } else {
        onSession(null);
      }
    } catch {
      onSession(null);
    }
  });
}
