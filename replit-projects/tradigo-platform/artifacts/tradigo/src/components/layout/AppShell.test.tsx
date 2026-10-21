import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { useAuthStore } from '../../stores/authStore';

vi.mock('../notifications/NotificationBell', () => ({
  NotificationBell: () => <div aria-label="Notifications" />,
}));

vi.mock('../ui/CommandPalette', () => ({
  CommandPalette: () => null,
}));

vi.mock('../ui/PageTransition', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../ui/Toast', () => ({
  ToastContainer: () => null,
}));

const renderShell = () =>
  render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<div>Trader dashboard</div>} />
          <Route path="coaches" element={<div>Coach discovery</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const HistoryControls = () => {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>Browser back</button>
      <button type="button" onClick={() => navigate(1)}>Browser forward</button>
    </>
  );
};

const renderShellWithHistory = () =>
  render(
    <MemoryRouter initialEntries={['/app', '/app/coaches']} initialIndex={1}>
      <HistoryControls />
      <Routes>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<div>Trader dashboard</div>} />
          <Route path="coaches" element={<div>Coach discovery</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('AppShell coach application navigation', () => {
  const setViewport = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  };

  beforeEach(() => {
    setViewport(1024);
    useAuthStore.setState({
      canonicalUser: { id: 'trader-1', role: 'TRADER', status: 'ACTIVE' } as any,
      coachApplicationStatus: null,
      identityVersion: 0,
      firebaseUser: null,
      localSessionActive: true,
    });
  });

  it('shows the matching application badge when status data arrives or a submission completes', () => {
    renderShell();

    expect(screen.queryByTestId('status-coach-application-nav')).not.toBeInTheDocument();

    act(() => {
      useAuthStore.getState().setCoachApplicationStatus('UNDER_REVIEW');
    });
    expect(screen.getAllByTestId('status-coach-application-nav')).toHaveLength(2);
    expect(screen.getAllByTestId('status-coach-application-nav')[0]).toHaveTextContent('Under review');

    act(() => {
      useAuthStore.getState().setCoachApplicationStatus('APPROVED');
    });
    expect(screen.getAllByTestId('status-coach-application-nav')[0]).toHaveTextContent('Approved');
  });

  it('labels a rejected application as an improvement action in trader navigation', () => {
    renderShell();

    act(() => {
      useAuthStore.getState().setCoachApplicationStatus('REJECTED');
    });

    expect(screen.getAllByText('Improve coach application')).toHaveLength(2);
    expect(screen.getAllByTestId('status-coach-application-nav')[0]).toHaveTextContent('Needs improvement');
  });

  it('opens mobile navigation with separate dashboard and coach discovery destinations', () => {
    renderShell();

    const openSidebar = screen.getByRole('button', { name: 'Open sidebar' });
    const drawer = screen.getByRole('dialog', { hidden: true });
    expect(openSidebar).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('aria-modal', 'false');
    expect(drawer).toHaveAttribute('inert', '');

    fireEvent.click(openSidebar);

    expect(openSidebar).toHaveAttribute('aria-expanded', 'true');
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).not.toHaveAttribute('inert');
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]).toHaveAttribute('href', '/app');
    expect(screen.getAllByRole('link', { name: 'Find a Coach' })[0]).toHaveAttribute('href', '/app/coaches');

    fireEvent.click(screen.getByRole('button', { name: 'Close sidebar' }));

    expect(openSidebar).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('aria-modal', 'false');
    expect(drawer).toHaveAttribute('inert', '');
  });

  it('moves focus into the mobile drawer when it opens', () => {
    renderShell();

    const openSidebar = screen.getByRole('button', { name: 'Open sidebar' });
    fireEvent.click(openSidebar);

    const drawer = screen.getByRole('dialog', { name: 'Mobile navigation' });
    expect(drawer).toContainElement(document.activeElement);
    expect(screen.getByRole('button', { name: 'Close sidebar' })).toHaveFocus();
  });

  it('returns focus to the menu trigger when the drawer closes', () => {
    renderShell();

    const openSidebar = screen.getByRole('button', { name: 'Open sidebar' });
    fireEvent.click(openSidebar);

    const drawer = screen.getByRole('dialog', { name: 'Mobile navigation' });
    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(openSidebar).toHaveFocus();

    fireEvent.click(openSidebar);
    fireEvent.click(screen.getByRole('button', { name: 'Close sidebar' }));
    expect(openSidebar).toHaveFocus();
  });

  it('returns focus to the menu trigger after selecting a mobile navigation destination', () => {
    renderShell();

    const openSidebar = screen.getByRole('button', { name: 'Open sidebar' });
    fireEvent.click(openSidebar);

    const drawer = screen.getByRole('dialog', { name: 'Mobile navigation' });
    fireEvent.click(within(drawer).getByRole('link', { name: 'Find a Coach' }));

    expect(screen.getByText('Coach discovery')).toBeInTheDocument();
    expect(openSidebar).toHaveAttribute('aria-expanded', 'false');
    expect(openSidebar).toHaveFocus();
  });

  it('closes the mobile drawer and restores focus after browser back and forward navigation', async () => {
    renderShellWithHistory();

    const openSidebar = screen.getByRole('button', { name: 'Open sidebar' });
    fireEvent.click(openSidebar);
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toHaveAttribute('aria-hidden', 'false');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    });

    const drawer = screen.getByRole('dialog', { hidden: true });
    expect(screen.getByText('Trader dashboard')).toBeInTheDocument();
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('aria-modal', 'false');
    expect(drawer).toHaveAttribute('inert', '');
    expect(openSidebar).toHaveAttribute('aria-expanded', 'false');
    expect(openSidebar).toHaveFocus();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Browser forward' }));
    });

    expect(screen.getByText('Coach discovery')).toBeInTheDocument();
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('aria-modal', 'false');
    expect(drawer).toHaveAttribute('inert', '');
    expect(openSidebar).toHaveAttribute('aria-expanded', 'false');
    expect(openSidebar).toHaveFocus();
  });

  it('keeps keyboard focus inside the open mobile drawer', () => {
    renderShell();

    const openSidebar = screen.getByRole('button', { name: 'Open sidebar' });
    fireEvent.click(openSidebar);

    const closeSidebar = screen.getByRole('button', { name: 'Close sidebar' });
    const drawer = screen.getByRole('dialog', { name: 'Mobile navigation' });
    const signOut = within(drawer).getByTitle('Sign out');

    closeSidebar.focus();
    fireEvent.keyDown(closeSidebar, { key: 'Tab', shiftKey: true });
    expect(signOut).toHaveFocus();

    fireEvent.keyDown(signOut, { key: 'Tab' });
    expect(closeSidebar).toHaveFocus();
  });

  it.each([
    { roleName: 'coach', role: 'COACH', expectedLinks: ['Requests'] },
    { roleName: 'admin', role: 'ADMIN', expectedLinks: ['Applications'] },
    { roleName: 'moderator', role: 'MODERATOR', expectedLinks: ['Overview', 'Reports', 'Disputes', 'Operations', 'Applications'] },
  ] as const)('protects keyboard navigation for the $roleName mobile drawer', ({ role, expectedLinks }) => {
    useAuthStore.setState({
      canonicalUser: { id: `${role.toLowerCase()}-1`, role, status: 'ACTIVE' } as any,
    });
    renderShell();

    const openSidebar = screen.getByRole('button', { name: 'Open sidebar' });
    const drawer = screen.getByRole('dialog', { hidden: true });
    expect(openSidebar).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('aria-modal', 'false');
    expect(drawer).toHaveAttribute('inert', '');

    fireEvent.click(openSidebar);

    expect(openSidebar).toHaveAttribute('aria-expanded', 'true');
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).not.toHaveAttribute('inert');

    const closeSidebar = screen.getByRole('button', { name: 'Close sidebar' });
    const signOut = within(drawer).getByTitle('Sign out');

    expect(drawer).toContainElement(document.activeElement);
    expect(closeSidebar).toHaveFocus();
    for (const expectedLink of expectedLinks) {
      expect(within(drawer).getByRole('link', { name: expectedLink })).toBeInTheDocument();
    }

    closeSidebar.focus();
    fireEvent.keyDown(closeSidebar, { key: 'Tab', shiftKey: true });
    expect(signOut).toHaveFocus();

    fireEvent.keyDown(signOut, { key: 'Tab' });
    expect(closeSidebar).toHaveFocus();

    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(openSidebar).toHaveFocus();
    expect(openSidebar).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('aria-modal', 'false');
    expect(drawer).toHaveAttribute('inert', '');

    fireEvent.click(openSidebar);
    expect(openSidebar).toHaveAttribute('aria-expanded', 'true');
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(drawer).not.toHaveAttribute('inert');
    expect(closeSidebar).toHaveFocus();
    fireEvent.click(closeSidebar);
    expect(openSidebar).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
    expect(drawer).toHaveAttribute('aria-modal', 'false');
    expect(drawer).toHaveAttribute('inert', '');
    expect(openSidebar).toHaveFocus();
  });

  it('keeps trader navigation and page content inside a narrow viewport', () => {
    setViewport(375);
    renderShell();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('overflow-auto');
    expect(main.parentElement).toHaveClass('min-w-0');

    const openSidebar = screen.getByRole('button', { name: 'Open sidebar' });
    fireEvent.click(openSidebar);

    const drawer = screen.getByRole('dialog', { name: 'Mobile navigation' });
    expect(drawer).toHaveClass('w-64');
    expect(within(drawer).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/app');
    expect(within(drawer).getByRole('link', { name: 'Find a Coach' })).toHaveAttribute('href', '/app/coaches');
  });
});