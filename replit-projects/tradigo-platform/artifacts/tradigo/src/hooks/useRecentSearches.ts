import { useState, useEffect } from 'react';

const RECENT_SEARCHES_KEY = 'tradigo_recent_coach_searches';
const MAX_RECENT_SEARCHES = 5;

export const useRecentSearches = () => {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load recent searches from localStorage:', err);
    }
  }, []);

  const addSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    try {
      const filtered = recentSearches.filter(
        (s) => s.toLowerCase() !== trimmed.toLowerCase()
      );
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save recent search to localStorage:', err);
    }
  };

  const clearSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (err) {
      console.error('Failed to clear recent searches from localStorage:', err);
    }
  };

  return {
    recentSearches,
    addSearch,
    clearSearches,
  };
};
