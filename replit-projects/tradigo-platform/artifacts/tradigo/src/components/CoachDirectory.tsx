import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Star,
  ShieldCheck,
  Zap,
  Globe,
  Clock,
  Award,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CoachProfile,
  MarketInstrument,
  CoachingTopic,
  User,
  VerificationBadge,
} from '../types/index.js';

interface CoachDirectoryProps {
  currentUser: User | null;
  onSelectCoachNow: (coachProfile?: CoachProfile) => void;
}

export const CoachDirectory: React.FC<CoachDirectoryProps> = ({
  currentUser,
  onSelectCoachNow,
}) => {
  const [coaches, setCoaches] = useState<Array<{ user: User; profile: CoachProfile }>>([]);
  const [instrumentFilter, setInstrumentFilter] = useState<string>('');
  const [topicFilter, setTopicFilter] = useState<string>('');
  const [presenceFilter, setPresenceFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCoach, setSelectedCoach] = useState<{ user: User; profile: CoachProfile } | null>(null);

  const fetchCoaches = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (instrumentFilter) queryParams.append('instrument', instrumentFilter);
      if (topicFilter) queryParams.append('topic', topicFilter);
      if (presenceFilter) queryParams.append('presence', presenceFilter);

      const res = await fetch(`/api/coaches?${queryParams.toString()}`);
      const data = await res.json();
      if (data.coaches) {
        setCoaches(data.coaches);
      }
    } catch (err) {
      console.error('Failed to fetch coaches:', err);
    }
  };

  useEffect(() => {
    fetchCoaches();
  }, [instrumentFilter, topicFilter, presenceFilter]);

  const filteredCoaches = coaches.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.user.displayName.toLowerCase().includes(q) ||
      c.profile.headline.toLowerCase().includes(q) ||
      c.profile.bio.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner / Marketplace Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Strict Verification & Non-Discretionary Coaching</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Verified Trading Coaches on Demand
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Connect 1-on-1 inside a dedicated trading room with synchronized charts, shared trade
            reviews, and escrow-backed metered billing.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button
            id="hero-coach-now-cta"
            onClick={() => onSelectCoachNow()}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2.5 shadow-lg shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
            <span>Instant Match (COACH NOW)</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            id="coach-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by coach name, order flow, liquidity, swing..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Instrument Filter */}
          <select
            id="filter-instrument-select"
            value={instrumentFilter}
            onChange={(e) => setInstrumentFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Markets</option>
            <option value="FOREX">Forex</option>
            <option value="CRYPTO">Crypto</option>
            <option value="INDICES">Indices</option>
            <option value="COMMODITIES">Commodities</option>
            <option value="EQUITIES">Equities</option>
            <option value="FUTURES">Futures</option>
          </select>

          {/* Topic Filter */}
          <select
            id="filter-topic-select"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Coaching Topics</option>
            <option value="MARKET_STRUCTURE">Market Structure</option>
            <option value="ENTRY_TIMING">Entry Timing</option>
            <option value="RISK_MANAGEMENT">Risk Models</option>
            <option value="TRADE_REVIEW">Trade Review</option>
            <option value="STRATEGY">Strategy Calibration</option>
            <option value="PSYCHOLOGY">Psychology</option>
          </select>

          {/* Presence Filter */}
          <select
            id="filter-presence-select"
            value={presenceFilter}
            onChange={(e) => setPresenceFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available Now</option>
            <option value="BUSY">Busy</option>
          </select>
        </div>
      </div>

      {/* Coaches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCoaches.map(({ user, profile }) => {
          const ratePerMin = (profile.hourlyRateCents / 100 / 60).toFixed(2);

          return (
            <div
              key={user.id}
              id={`coach-card-${user.id}`}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between group shadow-lg"
            >
              <div className="p-5 space-y-4">
                {/* Header: Avatar, Name, Presence */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3.5">
                    <img
                      src={user.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                      alt={user.displayName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors">
                          {user.displayName}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <div className="flex items-center text-amber-400 text-xs font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 mr-0.5" />
                          <span>{profile.ratingAverage.toFixed(2)}</span>
                          <span className="text-slate-500 font-normal text-[11px] ml-1">
                            ({profile.ratingCount} reviews)
                          </span>
                        </div>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-400">{profile.yearsOfExperience} yrs exp</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      profile.presenceState === 'AVAILABLE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {profile.presenceState}
                  </span>
                </div>

                {/* Headline & Bio */}
                <div>
                  <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{profile.headline}</h4>
                  <p className="text-xs text-slate-400 line-clamp-3 mt-1.5 leading-relaxed">
                    {profile.bio}
                  </p>
                </div>

                {/* Verification Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {profile.badges.map((b) => (
                    <span
                      key={b}
                      className="text-[9px] bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded-md flex items-center space-x-1"
                    >
                      <ShieldCheck className="w-2.5 h-2.5 text-blue-400" />
                      <span>{b.replace('_VERIFIED', '').replace('_', ' ')}</span>
                    </span>
                  ))}
                </div>

                {/* Specialties Chips */}
                <div className="flex flex-wrap gap-1">
                  {profile.specialties.slice(0, 3).map((spec) => (
                    <span
                      key={spec}
                      className="text-[10px] bg-blue-950/40 text-blue-300 border border-blue-900/40 px-2 py-0.5 rounded"
                    >
                      {spec.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer: Rate & Action */}
              <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-white">
                    ${(profile.hourlyRateCents / 100).toFixed(2)}
                    <span className="text-xs text-slate-400 font-normal">/hr</span>
                  </div>
                  <div className="text-[10px] text-slate-500">(${ratePerMin}/min metered)</div>
                </div>

                <button
                  id={`book-coach-now-${user.id}`}
                  onClick={() => onSelectCoachNow(profile)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 shadow-sm transition-all hover:scale-[1.02]"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>Coach Now</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
