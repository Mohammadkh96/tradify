import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Search, LayoutDashboard, Calendar, CheckSquare, FileText, Settings, Users, Activity, Sparkles, Moon, Sun, LogOut, ArrowRight, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { auth } from '../../lib/firebase';
import { cn } from '../../lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCoachNow?: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  category: 'Navigation' | 'Quick Actions';
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onOpenCoachNow }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { canonicalUser, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items: CommandItem[] = [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      category: 'Navigation',
      icon: LayoutDashboard,
      shortcut: 'G D',
      action: () => {
        navigate(canonicalUser?.role === 'COACH' ? '/coach' : canonicalUser?.role === 'ADMIN' ? '/admin' : '/app');
        onClose();
      },
    },
    {
      id: 'coaches',
      label: 'Find a Verified Coach',
      category: 'Navigation',
      icon: Search,
      shortcut: 'G C',
      action: () => {
        navigate('/app/coaches');
        onClose();
      },
    },
    {
      id: 'coach-now',
      label: 'Launch COACH NOW Instant Match',
      category: 'Quick Actions',
      icon: Activity,
      shortcut: '⌘N',
      action: () => {
        if (onOpenCoachNow) onOpenCoachNow();
        onClose();
      },
    },
    {
      id: 'favorites',
      label: 'View Favorite Coaches',
      category: 'Navigation',
      icon: CheckSquare,
      action: () => {
        navigate('/app/favorites');
        onClose();
      },
    },
    {
      id: 'learning',
      label: 'Open Learning Hub & Exercises',
      category: 'Navigation',
      icon: FileText,
      action: () => {
        navigate('/app/learning');
        onClose();
      },
    },
    {
      id: 'theme',
      label: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Tradigo Midnight Theme',
      category: 'Quick Actions',
      icon: theme === 'dark' ? Sun : Moon,
      shortcut: '⌘T',
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        onClose();
      },
    },
    {
      id: 'settings',
      label: 'Account & Trading Settings',
      category: 'Navigation',
      icon: Settings,
      action: () => {
        navigate('/app/settings');
        onClose();
      },
    },
    {
      id: 'logout',
      label: 'Sign Out of Tradigo',
      category: 'Quick Actions',
      icon: LogOut,
      action: async () => {
        onClose();
        await logout();
      },
    },
  ];

  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden z-10 text-slate-100 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <Search className="w-5 h-5 text-indigo-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none outline-none text-sm text-slate-100 placeholder-slate-500 font-medium"
            placeholder="Type a command or search workflow (e.g. coaches, dashboard)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 ml-2">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              No matching commands or navigation shortcuts found.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all",
                    isSelected 
                      ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/40 shadow-sm" 
                      : "text-slate-300 hover:bg-slate-800/60 border border-transparent"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      isSelected ? "bg-indigo-500/30 text-indigo-300" : "bg-slate-800 text-slate-400"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-slate-100 font-semibold">{item.label}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">{item.category}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {item.shortcut && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        {item.shortcut}
                      </span>
                    )}
                    <ArrowRight className={cn("w-4 h-4 transition-transform", isSelected ? "text-indigo-400 translate-x-0.5" : "text-slate-600")} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <div className="flex items-center space-x-1 text-indigo-400 font-medium">
            <Sparkles className="w-3 h-3" />
            <span>Tradigo Command Center</span>
          </div>
        </div>
      </div>
    </div>
  );
};
