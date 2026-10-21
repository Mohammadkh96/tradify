import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignupPage } from './SignupPage';

const mocks = vi.hoisted(() => ({
  signUpWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  resendVerificationEmail: vi.fn(),
  setFirebaseUser: vi.fn(),
  refreshProfile: vi.fn(),
}));

vi.mock('../../lib/firebaseAuth', () => ({
  isFirebaseConfigured: true,
  signUpWithEmail: mocks.signUpWithEmail,
  signInWithGoogle: mocks.signInWithGoogle,
  resendVerificationEmail: mocks.resendVerificationEmail,
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      setFirebaseUser: mocks.setFirebaseUser,
      refreshProfile: mocks.refreshProfile,
    }),
  },
}));

const renderSignup = () =>
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<div>Sign in page</div>} />
        <Route path="/onboarding" element={<div>Trader onboarding</div>} />
        <Route path="/coach/apply" element={<div>Coach application</div>} />
        <Route path="/preview" element={<div>Marketplace demo</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('SignupPage', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshProfile.mockResolvedValue(undefined);
  });

  it('renders the account creation fields and sign-in link', () => {
    renderSignup();

    expect(screen.getByRole('heading', { name: 'Create your account.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /already have an account/i })).toBeInTheDocument();
  });

  it('shows validation feedback before attempting Firebase signup', () => {
    renderSignup();

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Trader' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByRole('alert')).toHaveTextContent('agree to Tradigo');
    expect(mocks.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('creates the canonical account and continues to onboarding', async () => {
    mocks.signUpWithEmail.mockResolvedValue({
      firebaseUser: { uid: 'firebase-new-trader' },
      user: { id: 'tradigo-new-trader' },
      verificationSent: true,
    });

    renderSignup();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Trader' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass1' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(mocks.signUpWithEmail).toHaveBeenCalledWith('ada@example.com', 'StrongPass1', 'Ada Trader'));
    expect(mocks.setFirebaseUser).toHaveBeenCalledWith({ uid: 'firebase-new-trader' });
    expect(mocks.refreshProfile).toHaveBeenCalled();
    expect(screen.getByText('Account created')).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /apply to become a coach/i }));
    expect(screen.getByText('Coach application')).toBeInTheDocument();
  });

  it('keeps the learner setup path available after account creation', async () => {
    mocks.signUpWithEmail.mockResolvedValue({
      firebaseUser: { uid: 'firebase-new-trader' },
      user: { id: 'tradigo-new-trader' },
      verificationSent: true,
    });

    renderSignup();
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ada Trader' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'StrongPass1' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByText('Account created')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /continue to setup/i }));
    expect(screen.getByText('Trader onboarding')).toBeInTheDocument();
  });
});