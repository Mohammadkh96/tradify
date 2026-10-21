import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailVerificationPage } from './EmailVerificationPage';
import { PasswordResetPage } from './PasswordResetPage';

const authMocks = vi.hoisted(() => ({
  completeLocalVerification: vi.fn(),
  resendLocalVerification: vi.fn(),
  requestLocalPasswordReset: vi.fn(),
  completeLocalPasswordReset: vi.fn(),
}));

vi.mock('../../lib/localAuth', () => authMocks);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('built-in account recovery pages', () => {
  it('shows a completed verification state', async () => {
    authMocks.completeLocalVerification.mockResolvedValue({ status: 'COMPLETED', emailVerified: true });
    render(
      <MemoryRouter initialEntries={['/verify-email?token=valid-token']}>
        <EmailVerificationPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Email verified.' })).toBeInTheDocument();
  });

  it('shows an expired verification state', async () => {
    authMocks.completeLocalVerification.mockRejectedValue(Object.assign(new Error('Expired'), { status: 410 }));
    render(
      <MemoryRouter initialEntries={['/verify-email?token=expired-token']}>
        <EmailVerificationPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'This link has expired.' })).toBeInTheDocument();
  });

  it('uses a neutral password-reset request confirmation', async () => {
    authMocks.requestLocalPasswordReset.mockResolvedValue({
      message: 'If an account exists for that email, a password reset link is on its way.',
    });
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <PasswordResetPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('heading', { name: 'Check your email.' })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for that email/i)).toBeInTheDocument();
  });

  it('shows completed and expired password-reset outcomes', async () => {
    authMocks.completeLocalPasswordReset.mockResolvedValueOnce({ status: 'COMPLETED' });
    const view = render(
      <MemoryRouter initialEntries={['/reset-password?token=valid-token']}>
        <PasswordResetPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewStrongPass2' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewStrongPass2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('heading', { name: 'Password updated.' })).toBeInTheDocument();

    view.unmount();
    authMocks.completeLocalPasswordReset.mockRejectedValueOnce(Object.assign(new Error('Expired'), { status: 410 }));
    render(
      <MemoryRouter initialEntries={['/reset-password?token=expired-token']}>
        <PasswordResetPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewStrongPass2' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewStrongPass2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Reset link expired.' })).toBeInTheDocument());
  });
});