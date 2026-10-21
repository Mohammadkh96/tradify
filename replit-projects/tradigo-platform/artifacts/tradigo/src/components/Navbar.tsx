import React from 'react';
import {
  Shield,
  Users,
  FileText,
  Activity,
  Award,
  Video,
  ChevronDown,
  UserCheck,
  Scale,
} from 'lucide-react';
import { User, Session } from '../types/index.js';
import { ThemeToggle } from './ui/ThemeToggle';
import { TradigoMark } from './trading/TradigoLogo';

interface NavbarProps {
  currentUser: User | null;
  allUsers: User[];
  onSwitchUser: (userId: string) => void;
  onOpenCoachNow: () => void;
  activeSession: Session | null;
  onOpenActiveSession: () => void;
  activeView: 'directory' | 'compliance' | 'ledger';
  setActiveView: (view: 'directory' | 'compliance' | 'ledger') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onOpenCoachNow,
  activeSession,
  onOpenActiveSession,
  activeView,
  setActiveView,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Left Navigation */}
        <div className="flex items-center space-x-8">
          <div
            id="brand-logo-button"
            onClick={() => setActiveView('directory')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
              <div className="w-9 h-9 rounded-lg bg-[var(--brand-blue)] flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 group-hover:brightness-110 transition-colors">
                <TradigoMark className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                  TRADIGO
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Marketplace
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  TEST / MOCK PAYMENT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">

                Verified 1-on-1 Trading Coaching
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            <button
              id="nav-coaches-directory"
              onClick={() => setActiveView('directory')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeView === 'directory'
                  ? 'bg-slate-800 text-white text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Verified Coaches</span>
            </button>

            <button
              id="nav-compliance-policy"
              onClick={() => setActiveView('compliance')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeView === 'compliance'
                  ? 'bg-slate-800 text-white text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Compliance & Rules</span>
            </button>

            <button
              id="nav-ledger-audit"
              onClick={() => setActiveView('ledger')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1.5 ${
                activeView === 'ledger'
                  ? 'bg-slate-800 text-white text-blue-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Ledger & Audit</span>
            </button>
          </nav>
        </div>

        {/* Right Section Actions & User Switcher */}
        <div className="flex items-center space-x-4">
          {/* Active Live Session Indicator Banner */}
          {activeSession && (
            <button
              id="active-session-quick-banner"
              onClick={onOpenActiveSession}
              className="animate-pulse bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-2 hover:bg-emerald-900 transition-colors shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <Video className="w-3.5 h-3.5" />
              <span>Live Room ({activeSession.state})</span>
            </button>
          )}

          {/* Primary COACH NOW CTA */}
          <button
            id="header-coach-now-cta"
            onClick={onOpenCoachNow}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center space-x-2 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <TradigoMark className="w-4 h-4 text-[var(--brand-coral)]" />
            <span>COACH NOW</span>
          </button>

          {/* Theme Toggle Component */}
          <ThemeToggle variant="icon" />

          {/* Perspective / Role Switcher for seamless testing */}
          <div className="relative">
            <button
              id="user-perspective-dropdown-trigger"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center space-x-2.5 text-xs text-slate-200 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center font-bold text-[10px] overflow-hidden">
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.displayName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  currentUser?.displayName.substring(0, 2)
                )}
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-semibold leading-tight">{currentUser?.displayName}</div>
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <span>Role:</span>
                  <span className="text-blue-400 font-bold">{currentUser?.role}</span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-2 z-50">
                <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Testing Perspective
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {allUsers.map((u) => (
                    <button
                      key={u.id}
                      id={`switch-user-${u.id}`}
                      onClick={() => {
                        onSwitchUser(u.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition-colors ${
                        currentUser?.id === u.id ? 'bg-slate-800/80 text-blue-400 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px]">
                          {u.displayName.substring(0, 1)}
                        </div>
                        <div>
                          <div>{u.displayName}</div>
                          <div className="text-[10px] text-slate-500">{u.role}</div>
                        </div>
                      </div>
                      {currentUser?.id === u.id && <UserCheck className="w-4 h-4 text-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
