import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
  className?: string;
  variant?: 'dropdown' | 'icon' | 'segmented';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className, variant = 'icon' }) => {
  const { theme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  if (variant === 'segmented') {
    return (
      <div className={cn("flex items-center bg-secondary/80 border border-border/60 rounded-lg p-1 space-x-1", className)}>
        <button
          onClick={() => setTheme('light')}
          className={cn(
            "flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
            theme === 'light'
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40"
          )}
          title="Light Mode"
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden sm:inline">Light</span>
        </button>

        <button
          onClick={() => setTheme('dark')}
          className={cn(
            "flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
            theme === 'dark'
              ? "bg-slate-800 text-white shadow-sm border border-slate-700"
              : "text-muted-foreground hover:text-foreground hover:bg-slate-800/40"
          )}
          title="Tradigo Midnight"
        >
          <Moon className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Midnight</span>
        </button>

        <button
          onClick={() => setTheme('system')}
          className={cn(
            "flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
            theme === 'system'
              ? "bg-secondary text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          )}
          title="System Preference"
        >
          <Monitor className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">System</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        "relative p-2 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/60 text-foreground transition-all duration-200 flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      title={`Current theme: ${theme}. Click to switch.`}
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Sun className="w-4 h-4 text-amber-500 transition-transform group-hover:rotate-45" />
      ) : theme === 'dark' ? (
        <Moon className="w-4 h-4 text-indigo-400 transition-transform group-hover:-rotate-12" />
      ) : (
        <Monitor className="w-4 h-4 text-blue-400 transition-transform group-hover:scale-110" />
      )}
      <span className="sr-only">Toggle theme ({theme})</span>
    </button>
  );
};
