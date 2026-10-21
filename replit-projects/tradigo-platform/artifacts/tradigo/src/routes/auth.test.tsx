import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import React from 'react';
import { ProtectedRoute } from './guards';
import { useAuthStore } from '../stores/authStore';

// Mock the auth store
vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const TestComponent = () => <div>Protected Content</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderRoute = (allowedRoles?: any[]) => {
    return render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <TestComponent />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/suspended" element={<div>Suspended Page</div>} />
          <Route path="/banned" element={<div>Banned Page</div>} />
          <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('redirects to login if unauthenticated', () => {
    (useAuthStore as any).mockReturnValue({
      loading: false,
      firebaseUser: null,
      canonicalUser: null,
    });
    renderRoute();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects suspended user', () => {
    (useAuthStore as any).mockReturnValue({
      loading: false,
      firebaseUser: { uid: '123' },
      canonicalUser: { id: '123', status: 'SUSPENDED', role: 'TRADER' },
    });
    renderRoute();
    expect(screen.getByText('Suspended Page')).toBeInTheDocument();
  });

  it('redirects banned user', () => {
    (useAuthStore as any).mockReturnValue({
      loading: false,
      firebaseUser: { uid: '123' },
      canonicalUser: { id: '123', status: 'BANNED', role: 'TRADER' },
    });
    renderRoute();
    expect(screen.getByText('Banned Page')).toBeInTheDocument();
  });

  it('allows access if role matches', () => {
    (useAuthStore as any).mockReturnValue({
      loading: false,
      firebaseUser: { uid: '123' },
      canonicalUser: { id: '123', status: 'ACTIVE', role: 'TRADER' },
    });
    renderRoute(['TRADER']);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('denies access if role does not match', () => {
    (useAuthStore as any).mockReturnValue({
      loading: false,
      firebaseUser: { uid: '123' },
      canonicalUser: { id: '123', status: 'ACTIVE', role: 'TRADER' },
    });
    renderRoute(['COACH']);
    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
  });
});
