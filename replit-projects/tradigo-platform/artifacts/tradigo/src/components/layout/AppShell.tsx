import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { auth } from '../../lib/firebase';
import { Menu, X, LogOut, User as UserIcon, LayoutDashboard, Search, Calendar, CheckSquare, MessageSquare, DollarSign, Settings, ShieldAlert, Users, Activity, FileText, Moon, Sun, Laptop, TrendingUp, Command, FlaskConical } from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';
import { ToastContainer } from '../ui/Toast';
import { PageTransition } from '../ui/PageTransition';
import { CommandPalette } from '../ui/CommandPalette';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { TradigoLogo } from '../trading/TradigoLogo';

const MOBILE_DRAWER_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Keep this in sync with Tailwind's `md` breakpoint. When the drawer crosses
// into desktop layout, its CSS hides it and focus must move to desktop nav.
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 768px)';

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(MOBILE_DRAWER_FOCUSABLE_SELECTOR));

export const AppShell = () => {
  const { canonicalUser, coachApplicationStatus, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const desktopNavigationRef = useRef<HTMLElement>(null);
  const mobileMenuWasOpen = useRef(false);
  const focusAfterCloseRef = useRef<'mobile-trigger' | 'desktop-navigation'>('mobile-trigger');
  const location = useLocation();
  const navigate = useNavigate();

  const closeMobileMenu = useCallback((
    focusTarget: 'mobile-trigger' | 'desktop-navigation' = 'mobile-trigger',
  ) => {
    focusAfterCloseRef.current = focusTarget;
    setMobileMenuOpen(false);
  }, []);

  const focusDesktopNavigation = useCallback(() => {
    const desktopNavigation = desktopNavigationRef.current;
    const activeDesktopLink = desktopNavigation?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    const firstDesktopLink = desktopNavigation
      ? getFocusableElements(desktopNavigation)[0]
      : undefined;
    (activeDesktopLink ?? firstDesktopLink ?? desktopNavigation)?.focus();
  }, []);

  // Register global keyboard shortcuts (Cmd+K / Ctrl+K for Command Palette)
  useKeyboardShortcut([
    {
      key: 'k',
      metaKey: true,
      handler: () => setIsCommandPaletteOpen(prev => !prev),
    },
    {
      key: 'k',
      ctrlKey: true,
      handler: () => setIsCommandPaletteOpen(prev => !prev),
    },
    {
      key: 'Escape',
      handler: () => setIsCommandPaletteOpen(false),
    },
  ]);

  useEffect(() => {
    // Close mobile menu on navigate
    closeMobileMenu();
  }, [closeMobileMenu, location.key]);

  useEffect(() => {
    const drawer = mobileDrawerRef.current;

    if (!mobileMenuOpen) {
      drawer?.setAttribute('inert', '');

      if (mobileMenuWasOpen.current) {
        mobileMenuWasOpen.current = false;
        if (focusAfterCloseRef.current === 'desktop-navigation') {
          focusDesktopNavigation();
        } else {
          mobileMenuTriggerRef.current?.focus();
        }
        focusAfterCloseRef.current = 'mobile-trigger';
      }
      return;
    }

    if (!drawer) return;

    mobileMenuWasOpen.current = true;
    drawer.removeAttribute('inert');

    const focusableElements = getFocusableElements(drawer);
    (focusableElements[0] ?? drawer).focus();

    const containFocus = (event: FocusEvent) => {
      if (!drawer.contains(event.target as Node)) {
        (getFocusableElements(drawer)[0] ?? drawer).focus();
      }
    };

    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('focusin', containFocus);
    };
  }, [focusDesktopNavigation, mobileMenuOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const desktopBreakpoint = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    const closeDrawerForDesktopLayout = (event: MediaQueryListEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const activeElementIsVisible = Boolean(
        activeElement &&
        activeElement !== document.body &&
        activeElement.getClientRects().length > 0,
      );

      if (event.matches) {
        if (mobileMenuOpen) {
          closeMobileMenu('desktop-navigation');
        } else if (
          mobileMenuTriggerRef.current === activeElement ||
          !activeElementIsVisible
        ) {
          focusDesktopNavigation();
        }
      } else if (
        !mobileMenuOpen &&
        (!activeElementIsVisible || desktopNavigationRef.current?.contains(activeElement))
      ) {
        mobileMenuTriggerRef.current?.focus();
      }
    };

    desktopBreakpoint.addEventListener('change', closeDrawerForDesktopLayout);
    if (desktopBreakpoint.matches && mobileMenuOpen) {
      closeMobileMenu('desktop-navigation');
    }
    return () => {
      desktopBreakpoint.removeEventListener('change', closeDrawerForDesktopLayout);
    };
  }, [closeMobileMenu, focusDesktopNavigation, mobileMenuOpen]);

  const handleMobileDrawerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileMenu();
      return;
    }

    if (event.key !== 'Tab') return;

    const drawer = mobileDrawerRef.current;
    if (!drawer) return;

    const focusableElements = getFocusableElements(drawer);
    if (focusableElements.length === 0) {
      event.preventDefault();
      drawer.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    await logout();
  };

  const getNavItems = () => {
    if (!canonicalUser) return [];
    
    switch (canonicalUser.role) {
      case 'TRADER':
        const traderBase = location.pathname.startsWith('/preview') ? '/preview' : '/app';
        const applicationStatus = coachApplicationStatus;
        const applicationStatusLabel = applicationStatus === 'APPROVED'
          ? 'Approved'
          : applicationStatus === 'REJECTED'
            ? 'Needs improvement'
            : applicationStatus === 'UNDER_REVIEW' || applicationStatus === 'SUBMITTED' || applicationStatus === 'PENDING'
              ? 'Under review'
              : applicationStatus === 'DRAFT'
                ? 'Draft'
                : null;
        return [
          { label: 'Dashboard', path: traderBase, icon: LayoutDashboard },
          { label: 'Find a Coach', path: `${traderBase}/coaches`, icon: Search },
          { label: 'COACH NOW', path: `${traderBase}/coach-now`, icon: Activity, highlight: true },
          { label: 'Sessions & Passport', path: `${traderBase}/sessions`, icon: Calendar },
          { label: 'Favorites', path: `${traderBase}/favorites`, icon: CheckSquare },
          { label: 'Learning Hub', path: `${traderBase}/learning`, icon: FileText },
          { label: 'Settings', path: `${traderBase}/settings`, icon: Settings },
          ...(!location.pathname.startsWith('/preview')
            ? [{ label: applicationStatus === 'REJECTED' ? 'Improve coach application' : 'Coach applications', path: `${traderBase}/coach-application`, icon: Users, badge: applicationStatusLabel }]
            : []),
        ];
      case 'COACH':
        return [
          { label: 'Dashboard', path: '/coach', icon: LayoutDashboard },
          { label: 'Requests', path: '/coach/requests', icon: MessageSquare },
          { label: 'Students', path: '/coach/students', icon: Users },
          { label: 'Calendar', path: '/coach/calendar', icon: Calendar },
          { label: 'Earnings', path: '/coach/earnings', icon: DollarSign },
          { label: 'Profile', path: '/coach/profile', icon: UserIcon },
        ];
      case 'ADMIN':
        const adminBase = location.pathname.startsWith('/preview/admin') ? '/preview/admin' : '/admin';
        return [
          { label: 'Overview', path: adminBase, icon: Activity },
          { label: 'DEMO LAB', path: `${adminBase}/demo-lab`, icon: FlaskConical, highlight: true },
          { label: 'Users', path: `${adminBase}/users`, icon: Users },
          { label: 'Applications', path: `${adminBase}/applications`, icon: FileText },
          { label: 'Analytics', path: `${adminBase}/analytics`, icon: TrendingUp },
          { label: 'Sessions', path: `${adminBase}/sessions`, icon: Calendar },
          { label: 'Payments', path: `${adminBase}/payments`, icon: DollarSign },
          { label: 'Moderation', path: `${adminBase}/moderation`, icon: ShieldAlert },
          { label: 'Settings', path: `${adminBase}/settings`, icon: Settings },
        ];
      case 'MODERATOR':
        return [
          { label: 'Overview', path: '/mod', icon: Activity },
          { label: 'Reports', path: '/mod/reports', icon: ShieldAlert },
          { label: 'Disputes', path: '/mod/disputes', icon: MessageSquare },
          { label: 'Operations', path: '/mod/operations', icon: CheckSquare },
          { label: 'Applications', path: '/mod/applications', icon: FileText },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const renderNavLinks = () => (
    navItems.map(item => (
      <NavLink
        key={item.path}
        to={item.path}
          end={item.path === '/app' || item.path === '/preview' || item.path === '/preview/admin' || item.path === '/coach' || item.path === '/admin' || item.path === '/mod'}
        className={({ isActive }) => 
          `flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
            item.highlight 
              ? 'bg-primary text-primary-foreground shadow' 
              : isActive 
                ? 'bg-accent text-accent-foreground' 
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          }`
        }
      >
        <item.icon className={`mr-3 h-5 w-5 ${item.highlight ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
        <span className="flex-1">{item.label}</span>
        {'badge' in item && item.badge && (
          <span className="ml-2 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground" data-testid="status-coach-application-nav">
            {item.badge}
          </span>
        )}
      </NavLink>
    ))
  );

  return (
    <div
      data-testid="app-shell"
      className="flex h-screen bg-background text-foreground overflow-hidden"
    >
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div 
        id="mobile-navigation-drawer"
        ref={mobileDrawerRef}
        role="dialog"
        aria-label="Mobile navigation"
        aria-modal={mobileMenuOpen}
        aria-hidden={!mobileMenuOpen}
        tabIndex={-1}
        onKeyDown={handleMobileDrawerKeyDown}
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:hidden flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
           <TradigoLogo />
           <button type="button" onClick={() => closeMobileMenu()} className="text-muted-foreground p-1 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="w-5 h-5" />
            <span className="sr-only">Close sidebar</span>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" aria-label="Mobile navigation links">
          {renderNavLinks()}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">{canonicalUser?.displayName}</span>
                <span className="text-xs text-muted-foreground mt-1">{canonicalUser?.role}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col hidden md:flex md:w-[256px]">
        <div className="h-16 flex items-center px-6 border-b border-border">
           <TradigoLogo />
        </div>
        
        <nav
          ref={desktopNavigationRef}
          aria-label="Desktop navigation"
          tabIndex={-1}
          className="flex-1 overflow-y-auto py-4 px-3 space-y-1"
        >
          {renderNavLinks()}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">{canonicalUser?.displayName}</span>
                <span className="text-xs text-muted-foreground mt-1">{canonicalUser?.role}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header
          data-testid="app-shell-header"
          className="h-16 border-b border-border bg-card flex items-center justify-between px-[16px] md:px-[16px] lg:px-6 z-10"
        >
          <div className="flex items-center md:hidden">
             <button
               type="button"
               ref={mobileMenuTriggerRef}
               onClick={() => setMobileMenuOpen(true)}
               aria-expanded={mobileMenuOpen}
               aria-controls="mobile-navigation-drawer"
                className="shrink-0 p-[8px] mr-[8px] text-muted-foreground hover:text-foreground rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
             >
                <Menu className="w-[20px] h-[20px]" />
               <span className="sr-only">Open sidebar</span>
             </button>
              <TradigoLogo compact />
          </div>
          <div className="hidden md:flex items-center space-x-2">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center space-x-3 px-3.5 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/80 text-xs font-medium transition-all shadow-sm"
            >
              <div className="flex items-center space-x-1.5">
                <Command className="w-3.5 h-3.5 text-indigo-400" />
                <span>Search workflows...</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-background text-[10px] font-semibold text-muted-foreground border border-border">
                ⌘K
              </kbd>
            </button>
          </div>
           <div className="flex shrink-0 items-center space-x-[16px]">
             <NotificationBell />
             {/* Theme Toggle */}
              <div className="flex shrink-0 bg-secondary rounded-full p-[4px] border border-border">
               <button 
                 onClick={() => setTheme('light')}
                  className={`shrink-0 p-[6px] rounded-full ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                 title="Light mode"
               >
                  <Sun className="w-[16px] h-[16px]" />
               </button>
               <button 
                 onClick={() => setTheme('dark')}
                  className={`shrink-0 p-[6px] rounded-full ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                 title="Dark mode"
               >
                  <Moon className="w-[16px] h-[16px]" />
               </button>
               <button 
                 onClick={() => setTheme('system')}
                  className={`shrink-0 p-[6px] rounded-full ${theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                 title="System theme"
               >
                  <Laptop className="w-[16px] h-[16px]" />
               </button>
             </div>
          </div>
        </header>

        {/* Page Content */}
        <main data-testid="trader-surface" className="flex-1 overflow-auto bg-secondary/20 p-4 md:p-6">
          <div className="w-full min-w-0 max-w-7xl mx-auto">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
      <ToastContainer />
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
      />
    </div>
  );
};
