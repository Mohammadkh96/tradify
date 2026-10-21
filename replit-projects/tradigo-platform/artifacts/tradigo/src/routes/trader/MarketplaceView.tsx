import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, ArrowUpDown, Clock, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import { CoachCard } from '../../components/marketplace/CoachCard';
import { CoachNowMatchFlow } from '../../components/marketplace/CoachNowMatchFlow';
import { CoachCardSkeleton } from '../../components/ui/Skeleton';
import { CoachMarketplaceDTO } from '../../types';
import { useRecentSearches } from '../../hooks/useRecentSearches';
import { apiClient } from '../../lib/apiClient';
import { useLocation, useNavigate } from 'react-router';

type LearningNeeds = {
  objective: string;
  experience: string;
  language: string;
  availability: 'ANY' | 'NOW' | 'SCHEDULED';
  maxRateCents: number;
  durationMinutes: 10 | 25 | 50;
  teachingStyle: string;
};

const NEEDS_KEY = 'tradigo-learning-needs';
const MARKETPLACE_SEARCH_DEBOUNCE_MS = 300;
const defaultNeeds: LearningNeeds = { objective: '', experience: '', language: '', availability: 'ANY', maxRateCents: 0, durationMinutes: 25, teachingStyle: '' };
const objectiveLabels: Record<string, string> = {
  risk: 'Risk planning', review: 'Reviewing my process', structure: 'Market structure',
  psychology: 'Trading psychology', strategy: 'Building a strategy', timing: 'Entry timing',
};
const objectiveSpecialty: Record<string, string> = {
  risk: 'RISK_MANAGEMENT', review: 'TRADE_REVIEW', structure: 'MARKET_STRUCTURE',
  psychology: 'PSYCHOLOGY', strategy: 'STRATEGY', timing: 'ENTRY_TIMING',
};
const DEFAULT_MARKETPLACE_SORT = 'RELEVANCE';
const MARKETPLACE_SORTS = ['RELEVANCE', 'PRICE_LOW_TO_HIGH', 'PRICE_HIGH_TO_LOW', 'EXPERIENCE'] as const;
type MarketplaceSort = typeof MARKETPLACE_SORTS[number];

type MarketplaceQueryState = {
  searchQuery: string;
  market: string;
  specialty: string;
  sort: MarketplaceSort;
  page: number;
};

type MarketplaceQueryPatch = Partial<{
  q: string | null;
  market: string | null;
  specialty: string | null;
  sort: MarketplaceSort | null;
  page: number | null;
}>;

function parseMarketplaceQuery(search: string): MarketplaceQueryState {
  const params = new URLSearchParams(search);
  const parsedPage = Number.parseInt(params.get('page') || '', 10);
  const requestedSort = params.get('sort');

  return {
    searchQuery: params.get('q') || '',
    market: params.get('market') || '',
    specialty: params.get('specialty') || '',
    sort: MARKETPLACE_SORTS.includes(requestedSort as MarketplaceSort)
      ? requestedSort as MarketplaceSort
      : DEFAULT_MARKETPLACE_SORT,
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

function matchCoach(coach: CoachMarketplaceDTO, needs: LearningNeeds) {
  let score = 0;
  const reasons: string[] = [];
  if (needs.objective && coach.specialties.includes(objectiveSpecialty[needs.objective])) { score += 5; reasons.push(`specializes in ${objectiveLabels[needs.objective].toLowerCase()}`); }
  if (needs.experience === 'BEGINNER' && coach.teachingMethod?.toLowerCase().includes('structured')) { score += 2; reasons.push('uses a structured approach for foundational learning'); }
  if (needs.experience === 'EXPERIENCED' && coach.specialties.some((specialty) => ['STRATEGY', 'TRADE_REVIEW', 'RISK_MANAGEMENT'].includes(specialty))) { score += 2; reasons.push('offers focused process review'); }
  if (needs.language && coach.languages.includes(needs.language)) { score += 3; reasons.push(`speaks ${needs.language}`); }
  if (needs.availability === 'NOW' && coach.availability === 'AVAILABLE') { score += 2; reasons.push('is available for Coach Now'); }
  if (needs.availability === 'SCHEDULED' && coach.availability !== 'AVAILABLE') { score += 2; reasons.push('supports scheduled sessions'); }
  if (needs.maxRateCents > 0 && coach.instantRatePerMinuteCents <= needs.maxRateCents) { score += 2; reasons.push('fits your price preference'); }
  if (needs.durationMinutes) { reasons.push(`offers your ${needs.durationMinutes}-minute format`); }
  if (needs.teachingStyle && (coach.teachingMethod ?? '').toLowerCase().includes(needs.teachingStyle)) { score += 2; reasons.push(`uses ${needs.teachingStyle} teaching`); }
  return { score, reason: reasons.slice(0, 2).join(' and ') || 'matches your visible marketplace preferences' };
}

export const MarketplaceView = ({ mode = 'directory' }: { mode?: 'directory' | 'coach-now' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const marketplaceBase = location.pathname.startsWith('/preview') ? '/preview' : '/app';
  const marketplaceQuery = useMemo(() => parseMarketplaceQuery(location.search), [location.search]);
  const [needs, setNeeds] = useState<LearningNeeds>(() => {
    try { return JSON.parse(localStorage.getItem(NEEDS_KEY) || 'null')?.needs || defaultNeeds; } catch { return defaultNeeds; }
  });
  const [intakeOpen, setIntakeOpen] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(NEEDS_KEY) || 'null'); return !saved || (!saved.skipped && !saved.needs); } catch { return true; }
  });
  const [draftNeeds, setDraftNeeds] = useState<LearningNeeds>(needs);
  const [coaches, setCoaches] = useState<CoachMarketplaceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(marketplaceQuery.searchQuery);
  const { recentSearches, addSearch, clearSearches } = useRecentSearches();
  const [pagination, setPagination] = useState({
    pageSize: 12,
    total: 0,
    totalPages: 0
  });
  const [marketplaceAnnouncement, setMarketplaceAnnouncement] = useState('');
  const latestMarketplaceRequest = useRef(0);
  const marketplaceAbortController = useRef<AbortController | null>(null);
  const lastLoadedMarketplaceCriteria = useRef<string | null>(null);
  const searchQuery = marketplaceQuery.searchQuery;
  const filters = {
    market: marketplaceQuery.market,
    specialty: marketplaceQuery.specialty,
    currency: 'USD',
    sort: marketplaceQuery.sort,
  };

  const updateMarketplaceQuery = (updates: MarketplaceQueryPatch) => {
    const params = new URLSearchParams(location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (
        value === null
        || value === ''
        || (key === 'page' && value === 1)
        || (key === 'sort' && value === DEFAULT_MARKETPLACE_SORT)
      ) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    const nextSearch = params.toString();
    const currentSearch = location.search.replace(/^\?/, '');
    if (nextSearch !== currentSearch) {
      navigate({
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      }, { replace: true });
    }
  };

  const rankedCoaches = useMemo(() => {
    const hasNeeds = needs.objective || needs.experience || needs.language || needs.availability !== 'ANY' || needs.maxRateCents || needs.teachingStyle;
    if (!hasNeeds) return coaches.map((coach) => ({ coach, reason: undefined }));
    return coaches.map((coach) => ({ coach, ...matchCoach(coach, needs) })).sort((a, b) => b.score - a.score);
  }, [coaches, needs]);

  const saveNeeds = () => {
    setNeeds(draftNeeds);
    localStorage.setItem(NEEDS_KEY, JSON.stringify({ needs: draftNeeds }));
    setIntakeOpen(false);
  };
  const skipIntake = () => {
    localStorage.setItem(NEEDS_KEY, JSON.stringify({ skipped: true }));
    setIntakeOpen(false);
  };
  const resetNeeds = () => {
    localStorage.removeItem(NEEDS_KEY);
    setNeeds(defaultNeeds);
    setDraftNeeds(defaultNeeds);
    setIntakeOpen(true);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, MARKETPLACE_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchCoaches = async () => {
    const requestId = ++latestMarketplaceRequest.current;
    const isLatestRequest = () => requestId === latestMarketplaceRequest.current;
    marketplaceAbortController.current?.abort();
    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    marketplaceAbortController.current = abortController;

    setLoading(true);
    setLoadError(null);
    try {
      const marketplaceCriteria = JSON.stringify({
        searchQuery: debouncedSearchQuery,
        market: filters.market,
        specialty: filters.specialty,
        currency: filters.currency,
        sort: filters.sort,
      });
      const params = new URLSearchParams({
        page: marketplaceQuery.page.toString(),
        pageSize: pagination.pageSize.toString(),
        q: debouncedSearchQuery,
        market: filters.market,
        specialty: filters.specialty,
        currency: filters.currency,
        sort: filters.sort
      });
      
      try {
        const data = await apiClient.get(
          `/api/marketplace/coaches?${params.toString()}`,
          abortController ? { signal: abortController.signal } : undefined,
        );
        if (!isLatestRequest()) return;
        const resultItems = Array.isArray(data.items) ? data.items : [];
        const resultCount = typeof data.total === 'number' ? data.total : resultItems.length;
        if (
          lastLoadedMarketplaceCriteria.current !== null &&
          lastLoadedMarketplaceCriteria.current !== marketplaceCriteria
        ) {
          setMarketplaceAnnouncement(
            `Marketplace results updated: ${resultCount} ${resultCount === 1 ? 'coach' : 'coaches'} loaded.`,
          );
        }
        lastLoadedMarketplaceCriteria.current = marketplaceCriteria;
        setCoaches(resultItems);
        setPagination(prev => ({
          ...prev,
          total: data.total || 0,
          totalPages: data.totalPages || 1,
        }));
      } catch (err) {
        if (!isLatestRequest()) return;
        setLoadError(
          coaches.length > 0
            ? 'The coach marketplace is temporarily unavailable. Your last results are still shown. Please retry in a moment.'
            : 'The coach marketplace is temporarily unavailable. No substitute profiles have been shown.',
        );
      }
    } catch (err) {
      if (!isLatestRequest()) return;
      console.error('Failed to fetch coaches:', err);
      setLoadError(
        coaches.length > 0
          ? 'The coach marketplace is temporarily unavailable. Your last results are still shown. Please retry in a moment.'
          : 'The coach marketplace is temporarily unavailable. Please retry in a moment.',
      );
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
        marketplaceAbortController.current = null;
      }
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, [marketplaceQuery.page, filters.market, filters.specialty, filters.sort, debouncedSearchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setDebouncedSearchQuery(searchQuery);
      addSearch(searchQuery);
    }
  };

  const handleSelectRecentSearch = (query: string) => {
    setDebouncedSearchQuery(query);
    updateMarketplaceQuery({ q: query, page: 1 });
    addSearch(query);
  };

  const handleFavoriteToggle = async (id: string, isFavorited: boolean) => {
    try {
      const method = isFavorited ? 'POST' : 'DELETE';
       await apiClient.fetch(`/api/marketplace/coaches/${id}/favorite`, { method });
       setCoaches(prev => prev.map(c => c.id === id ? { ...c, isFavorited } : c));
    } catch (err) {
      setCoaches(prev => prev.map(c => c.id === id ? { ...c, isFavorited } : c));
    }
  };

  return (
    <div className="space-y-6">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Marketplace results"
        className="sr-only"
      >
        {marketplaceAnnouncement}
      </div>
      {mode === 'coach-now' && (
        <CoachNowMatchFlow
          coaches={coaches}
          onNavigateToScheduled={() => navigate(`${marketplaceBase}/coaches`)}
          onSessionReady={(sessionId) => navigate(`${marketplaceBase}/sessions/${sessionId}`)}
        />
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{mode === 'coach-now' ? 'Book a Coach' : 'Find a Coach'}</h1>
          <p className="text-muted-foreground mt-1">
            {mode === 'coach-now' ? 'Prefer a planned conversation? Choose a time and learning format below.' : 'Professional trading mentors for every market and style.'}
          </p>
           <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary">
             <Sparkles className="h-3.5 w-3.5" />
             Admin-approved coaches · fixed-duration consultations
           </div>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex min-w-0 items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="break-words font-semibold">{loadError}</p>
            <button type="button" onClick={fetchCoaches} className="mt-2 inline-block font-bold underline underline-offset-4">
              Retry marketplace
            </button>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5" aria-labelledby="learning-needs-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="learning-needs-title" className="text-base font-bold">Find a teaching fit</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Tell us what you want to learn. This is optional, transparent, and never financial advice.</p>
          </div>
          {!intakeOpen && (
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDraftNeeds(needs); setIntakeOpen(true); }} className="text-sm font-bold text-primary underline underline-offset-4">Edit preferences</button>
              <button type="button" onClick={resetNeeds} className="text-sm font-semibold text-muted-foreground underline underline-offset-4">Reset</button>
            </div>
          )}
        </div>
        {intakeOpen && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold">Learning objective
              <select value={draftNeeds.objective} onChange={(e) => setDraftNeeds({ ...draftNeeds, objective: e.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal">
                <option value="">Choose an objective</option>
                {Object.entries(objectiveLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Experience level
              <select value={draftNeeds.experience} onChange={(e) => setDraftNeeds({ ...draftNeeds, experience: e.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal">
                <option value="">Choose your level</option><option value="BEGINNER">Building foundations</option><option value="INTERMEDIATE">Practicing consistently</option><option value="EXPERIENCED">Refining a process</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Preferred language
              <select value={draftNeeds.language} onChange={(e) => setDraftNeeds({ ...draftNeeds, language: e.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal">
                <option value="">Any language</option><option>English</option><option>Arabic</option><option>Mandarin</option><option>Italian</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Session preference
              <select value={draftNeeds.availability} onChange={(e) => setDraftNeeds({ ...draftNeeds, availability: e.target.value as LearningNeeds['availability'] })} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal">
                <option value="ANY">Either Coach Now or scheduled</option><option value="NOW">Coach Now</option><option value="SCHEDULED">Scheduled</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Session length
              <select value={draftNeeds.durationMinutes} onChange={(e) => setDraftNeeds({ ...draftNeeds, durationMinutes: Number(e.target.value) as LearningNeeds['durationMinutes'] })} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal">
                <option value={10}>10 minutes</option><option value={25}>25 minutes</option><option value={50}>50 minutes</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Max price per minute
              <select value={draftNeeds.maxRateCents} onChange={(e) => setDraftNeeds({ ...draftNeeds, maxRateCents: Number(e.target.value) })} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal">
                <option value={0}>Any price</option><option value={150}>Up to $1.50</option><option value={200}>Up to $2.00</option><option value={250}>Up to $2.50</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Teaching style
              <select value={draftNeeds.teachingStyle} onChange={(e) => setDraftNeeds({ ...draftNeeds, teachingStyle: e.target.value })} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-normal">
                <option value="">Any style</option><option value="structured">Structured</option><option value="example">Example-led</option><option value="journal">Journal-driven</option>
              </select>
            </label>
            <div className="flex items-center gap-3 md:col-span-2 lg:col-span-3">
              <button type="button" onClick={saveNeeds} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Show teaching matches</button>
              <button type="button" onClick={skipIntake} className="text-sm font-semibold text-muted-foreground underline underline-offset-4">Skip for now</button>
            </div>
          </div>
        )}
        {!intakeOpen && (needs.objective || needs.language || needs.availability !== 'ANY' || needs.maxRateCents || needs.teachingStyle) && (
          <p className="mt-3 text-xs text-muted-foreground" role="status">Recommendations use your selected objective, language, session preference, price, and teaching style. The full approved marketplace remains below.</p>
        )}
      </section>

      <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <label htmlFor="marketplace-search" className="sr-only">Search coaches</label>
            <input
              id="marketplace-search"
              type="text"
              placeholder="Search by name, specialties, or bio..."
              className="w-full bg-secondary/50 border-none rounded-md pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => updateMarketplaceQuery({ q: e.target.value, page: 1 })}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <label htmlFor="marketplace-market" className="sr-only">Market</label>
            <select 
               id="marketplace-market"
               className="w-full bg-secondary/50 border-none rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none sm:w-auto"
              value={filters.market}
              onChange={(e) => updateMarketplaceQuery({ market: e.target.value, page: 1 })}
            >
              <option value="">All Markets</option>
              <option value="FOREX">Forex</option>
              <option value="CRYPTO">Crypto</option>
              <option value="INDICES">Indices</option>
              <option value="STOCKS">Stocks</option>
            </select>

            <label htmlFor="marketplace-specialty" className="sr-only">Specialty</label>
            <select 
               id="marketplace-specialty"
               className="w-full bg-secondary/50 border-none rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none sm:w-auto"
              value={filters.specialty}
              onChange={(e) => updateMarketplaceQuery({ specialty: e.target.value, page: 1 })}
            >
              <option value="">All Specialties</option>
              <option value="RISK_MANAGEMENT">Risk Management</option>
              <option value="STRATEGY">Strategy</option>
              <option value="PSYCHOLOGY">Psychology</option>
              <option value="TECHNICAL_ANALYSIS">Technical Analysis</option>
            </select>

            <div className="h-8 w-[1px] bg-border mx-1 hidden md:block" />

             <div className="flex items-center space-x-2">
               <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <label htmlFor="marketplace-sort" className="sr-only">Sort coaches by</label>
               <select 
                  id="marketplace-sort"
                 className="w-full bg-secondary/50 border-none rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none sm:w-auto"
                value={filters.sort}
                onChange={(e) => updateMarketplaceQuery({ sort: e.target.value as MarketplaceSort, page: 1 })}
              >
                <option value="RELEVANCE">Relevance</option>
                <option value="PRICE_LOW_TO_HIGH">Price: Low to High</option>
                <option value="PRICE_HIGH_TO_LOW">Price: High to Low</option>
                <option value="EXPERIENCE">Experience</option>
              </select>
            </div>
          </div>
        </div>

        {(filters.market || filters.specialty || searchQuery) && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
            {searchQuery && (
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                Search: {searchQuery}
                <button type="button" aria-label={`Remove search filter: ${searchQuery}`} onClick={() => updateMarketplaceQuery({ q: null, page: 1 })} className="ml-1.5 hover:text-primary/70"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.market && (
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                Market: {filters.market}
                <button type="button" aria-label={`Remove market filter: ${filters.market}`} onClick={() => updateMarketplaceQuery({ market: null, page: 1 })} className="ml-1.5 hover:text-primary/70"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.specialty && (
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                Specialty: {filters.specialty}
                <button type="button" aria-label={`Remove specialty filter: ${filters.specialty}`} onClick={() => updateMarketplaceQuery({ specialty: null, page: 1 })} className="ml-1.5 hover:text-primary/70"><X className="w-3 h-3" /></button>
              </span>
            )}
            <button 
              onClick={() => updateMarketplaceQuery({ q: null, market: null, specialty: null, sort: null, page: 1 })}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Recent Searches - Tradigo Midnight Card Style */}
        {recentSearches.length > 0 && (
          <div className="bg-slate-900/90 dark:bg-slate-900/90 border border-indigo-500/30 rounded-xl p-4 shadow-lg backdrop-blur-md text-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Recent Coach Searches</h4>
                  <p className="text-[11px] text-slate-400">Quickly resume your previous coaching queries</p>
                </div>
              </div>
              <button
                onClick={clearSearches}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center space-x-1 px-2.5 py-1 rounded-md hover:bg-slate-800/80 border border-transparent hover:border-slate-700"
                title="Clear search history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {recentSearches.map((term, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectRecentSearch(term)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-indigo-950/60 text-slate-200 hover:text-indigo-200 text-xs font-medium border border-slate-700/80 hover:border-indigo-500/50 transition-all flex items-center space-x-1.5 shadow-sm group"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span>{term}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && coaches.length > 0 && (
        <div
          role="status"
          aria-label="Refreshing coaches"
          aria-live="polite"
          className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
        >
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          Refreshing coach results…
        </div>
      )}

      {loading && coaches.length === 0 ? (
        <div role="status" aria-label="Loading coaches" className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <CoachCardSkeleton key={i} />
          ))}
        </div>
      ) : coaches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {rankedCoaches.map(({ coach, reason }) => (
             <CoachCard key={coach.id} coach={coach} matchReason={reason} onFavoriteToggle={handleFavoriteToggle} />
          ))}
        </div>
      ) : !loadError ? (
        <div className="min-w-0 bg-card border border-border rounded-xl py-20 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">No coaches found</h3>
          <p className="text-muted-foreground mt-2 w-full max-w-md break-words">Try adjusting your filters or search terms to find more results.</p>
          <button 
            onClick={() => updateMarketplaceQuery({ q: null, market: null, specialty: null, sort: null, page: 1 })}
            className="mt-6 w-full max-w-xs px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors font-medium"
          >
            Clear all filters
          </button>
        </div>
      ) : null}

      {pagination.totalPages > 1 && (
        <nav aria-label="Marketplace pagination" className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 pt-8">
          <button
            disabled={marketplaceQuery.page === 1}
            onClick={() => updateMarketplaceQuery({ page: marketplaceQuery.page - 1 })}
            className="shrink-0 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Previous
          </button>
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="min-w-0 max-w-full text-center text-sm text-muted-foreground"
          >
            Page {marketplaceQuery.page} of {pagination.totalPages}
          </span>
          <button
            disabled={marketplaceQuery.page === pagination.totalPages}
            onClick={() => updateMarketplaceQuery({ page: marketplaceQuery.page + 1 })}
            className="shrink-0 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
};
