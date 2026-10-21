import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  initialize: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'system',
  
  setTheme: (theme) => {
    localStorage.setItem('ui-theme', theme);
    set({ theme });
    applyTheme(theme);
  },
  
  initialize: () => {
    const savedTheme = (localStorage.getItem('ui-theme') as Theme) || 'system';
    set({ theme: savedTheme });
    applyTheme(savedTheme);

    // Listen to system changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const currentTheme = useThemeStore.getState().theme;
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    });
  }
}));

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.classList.add(systemTheme);
    return;
  }

  root.classList.add(theme);
}
