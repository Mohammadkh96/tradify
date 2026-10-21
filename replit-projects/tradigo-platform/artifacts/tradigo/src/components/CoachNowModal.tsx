import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Star,
  ShieldCheck,
  Clock,
  Globe,
  Sliders,
  DollarSign,
  TrendingUp,
  Award,
  ChevronRight,
  Info,
  Loader2,
} from 'lucide-react';
import {
  MarketInstrument,
  CoachingTopic,
  ExperienceLevel,
  MatchCandidate,
  MatchRequest,
  Session,
} from '../types/index.js';

interface CoachNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionEstablished: (session: Session) => void;
}

export const CoachNowModal: React.FC<CoachNowModalProps> = ({
  isOpen,
  onClose,
  onSessionEstablished,
}) => {
  const [instrument, setInstrument] = useState<MarketInstrument>('FOREX');
  const [symbol, setSymbol] = useState<string>('EURUSD');
  const [topic, setTopic] = useState<CoachingTopic>('MARKET_STRUCTURE');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('INTERMEDIATE');
  const [language, setLanguage] = useState<string>('English');
  const [maxHourlyRate, setMaxHourlyRate] = useState<number>(85); // in USD
  const [specificNotes, setSpecificNotes] = useState<string>('');

  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [activeRequest, setActiveRequest] = useState<MatchRequest | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidate | null>(null);
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Suggested symbols by instrument
  const instrumentSymbols: Record<MarketInstrument, string[]> = {
    FOREX: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'],
    CRYPTO: ['BTCUSD', 'ETHUSD', 'SOLUSD'],
    INDICES: ['SPY', 'NQ', 'US30'],
    COMMODITIES: ['XAUUSD', 'USOIL', 'XAGUSD'],
    EQUITIES: ['NVDA', 'TSLA', 'AAPL', 'AMZN'],
    FUTURES: ['NQ', 'ES', 'CL', 'GC'],
    OPTIONS: ['SPY', 'QQQ', 'NVDA'],
  };

  const topics: Array<{ id: CoachingTopic; label: string; desc: string }> = [
    {
      id: 'MARKET_STRUCTURE',
      label: 'Market Structure & Liquidity',
      desc: 'Order flow imbalance, support/resistance shifts, session liquidity sweeps.',
    },
    {
      id: 'ENTRY_TIMING',
      label: 'Entry Timing & Triggers',
      desc: 'Precision confirmation candle entry rules, risk-to-reward ratio framing.',
    },
    {
      id: 'RISK_MANAGEMENT',
      label: 'Risk Models & Sizing',
      desc: 'Position sizing, stop placement, drawdown avoidance, portfolio heat.',
    },
    {
      id: 'TRADE_REVIEW',
      label: 'Live & Historical Trade Review',
      desc: 'Deconstruct past winning or losing trades with annotated chart review.',
    },
    {
      id: 'STRATEGY',
      label: 'Strategy Calibration',
      desc: 'Refine multi-timeframe rules, backtest critique, systematic execution.',
    },
    {
      id: 'PSYCHOLOGY',
      label: 'Trading Psychology & Discipline',
      desc: 'Overcoming FOMO, revenge trading, revenge bias, sticking to rules.',
    },
    {
      id: 'PLATFORM_HELP',
      label: 'Execution & Charting Help',
      desc: 'TradingView layout setup, DOM/orderbook reading, hotkeys.',
    },
    {
      id: 'GENERAL_COACHING',
      label: 'Open Strategy & Q&A',
      desc: 'General 1-on-1 mentorship session tailored to your immediate needs.',
    },
  ];

  // Auto-run candidate evaluation on parameter change
  const handleEvaluateMatches = async () => {
    setIsSearching(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/coach-now/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrument,
          symbol,
          topic,
          experienceLevel,
          language,
          maxHourlyRateCents: maxHourlyRate * 100,
          specificNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to match coaches');
      }

      setCandidates(data.candidates || []);
      setActiveRequest(data.matchRequest);
      if (data.candidates && data.candidates.length > 0) {
        const topEligible = data.candidates.find((c: MatchCandidate) => c.isEligible);
        setSelectedCandidate(topEligible || data.candidates[0]);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleEvaluateMatches();
    }
  }, [isOpen, instrument, topic, language, maxHourlyRate]);

  const handleInstantAccept = async (candidate: MatchCandidate) => {
    if (!activeRequest) return;
    setIsAccepting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/coach-now/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchRequestId: activeRequest.id,
          coachId: candidate.coachId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept coach');
      }

      onSessionEstablished(data.session);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsAccepting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Instant Coach Now Request</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Pre-Auth Escrow Protected
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Server-side verified matchmaking engine with automated candidate ranking.
              </p>
            </div>
          </div>
          <button
            id="close-coach-now-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          {/* Left Column: Request Parameters */}
          <div className="lg:col-span-5 p-6 border-b lg:border-b-0 lg:border-r border-slate-800 space-y-5 bg-slate-900/50">
            {/* 1. Market Instrument */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                1. Market Instrument & Asset
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['FOREX', 'CRYPTO', 'INDICES', 'COMMODITIES', 'EQUITIES', 'FUTURES'] as MarketInstrument[]).map(
                  (inst) => (
                    <button
                      key={inst}
                      id={`select-inst-${inst.toLowerCase()}`}
                      onClick={() => {
                        setInstrument(inst);
                        setSymbol(instrumentSymbols[inst][0]);
                      }}
                      className={`px-2.5 py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                        instrument === inst
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {inst}
                    </button>
                  )
                )}
              </div>

              {/* Symbol selector */}
              <div className="mt-2 flex items-center space-x-2">
                <span className="text-xs text-slate-400">Symbol:</span>
                <select
                  id="select-market-symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {instrumentSymbols[instrument].map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Coaching Topic */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                2. Coaching Focus Area
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {topics.map((t) => (
                  <button
                    key={t.id}
                    id={`select-topic-${t.id.toLowerCase()}`}
                    onClick={() => setTopic(t.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-all text-xs flex items-start space-x-2.5 ${
                      topic === t.id
                        ? 'bg-blue-600/15 border-blue-500 text-white'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800/80'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${
                        topic === t.id ? 'border-blue-400 bg-blue-500' : 'border-slate-600'
                      }`}
                    >
                      {topic === t.id && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200">{t.label}</div>
                      <div className="text-[11px] text-slate-400 leading-tight">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Language & Experience */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Language
                </label>
                <select
                  id="select-coach-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="English">English</option>
                  <option value="German">German</option>
                  <option value="French">French</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Russian">Russian</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Your Level
                </label>
                <select
                  id="select-experience-level"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="BEGINNER">Beginner (&lt; 1 yr)</option>
                  <option value="INTERMEDIATE">Intermediate (1-3 yrs)</option>
                  <option value="ADVANCED">Advanced (3-5 yrs)</option>
                  <option value="PROFESSIONAL">Professional (5+ yrs)</option>
                </select>
              </div>
            </div>

            {/* 4. Maximum Hourly Budget Rate */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Max Hourly Budget
                </label>
                <span className="text-xs font-bold text-emerald-400">
                  ${maxHourlyRate}.00/hr <span className="text-slate-500 font-normal">(${(maxHourlyRate / 60).toFixed(2)}/min)</span>
                </span>
              </div>
              <input
                id="input-max-hourly-rate"
                type="range"
                min="40"
                max="150"
                step="5"
                value={maxHourlyRate}
                onChange={(e) => setMaxHourlyRate(Number(e.target.value))}
                className="w-full accent-blue-500 bg-slate-700 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Right Column: Candidate Radar & Instant Match Selection */}
          <div className="lg:col-span-7 p-6 space-y-4 flex flex-col justify-between bg-slate-950/30">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-200">Eligible Coach Candidates</h3>
                  {isSearching && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                </div>
                <div className="text-xs text-slate-400">
                  Ranked by 8-factor compatibility algorithm
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center space-x-2 mb-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Candidate List or Radar Animation */}
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {isSearching ? (
                  <div className="py-16 flex flex-col items-center justify-center space-y-6 text-center">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-500/40 animate-tradigo-radar" />
                      <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 animate-tradigo-radar" style={{ animationDelay: '1s' }} />
                      <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20 animate-tradigo-radar" style={{ animationDelay: '2s' }} />
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white z-10 animate-pulse">
                        <Zap className="w-8 h-8 text-amber-300" />
                      </div>
                    </div>
                    <div className="space-y-1.5 max-w-xs">
                      <h4 className="text-sm font-bold text-white tracking-tight">Scanning Live Coach Network</h4>
                      <p className="text-xs text-slate-400">Evaluating 8-factor algorithmic compatibility across active mentors...</p>
                    </div>
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No eligible coaches found matching your criteria. Try adjusting your budget or topic.
                  </div>
                ) : (
                  candidates.map((cand) => {
                    const isSelected = selectedCandidate?.coachId === cand.coachId;
                    const ratePerMin = (cand.coachProfile.hourlyRateCents / 100 / 60).toFixed(2);

                    return (
                    <div
                      key={cand.coachId}
                      id={`candidate-card-${cand.coachId}`}
                      onClick={() => setSelectedCandidate(cand)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/90 border-blue-500 ring-1 ring-blue-500/50'
                          : cand.isEligible
                          ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/60 border-slate-800/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <img
                            src={cand.coachUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={cand.coachUser.displayName}
                            className="w-11 h-11 rounded-lg object-cover border border-slate-700"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-white">{cand.coachUser.displayName}</span>
                              <div className="flex items-center text-amber-400 text-xs font-semibold">
                                <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                                <span>{cand.coachProfile.ratingAverage.toFixed(2)}</span>
                                <span className="text-slate-500 text-[10px] ml-1">({cand.coachProfile.ratingCount})</span>
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  cand.coachProfile.presenceState === 'AVAILABLE'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {cand.coachProfile.presenceState}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                              {cand.coachProfile.headline}
                            </p>

                            {/* Verification Badges */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {cand.coachProfile.badges.slice(0, 3).map((badge) => (
                                <span
                                  key={badge}
                                  className="text-[9px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded flex items-center space-x-1"
                                >
                                  <ShieldCheck className="w-2.5 h-2.5 text-blue-400" />
                                  <span>{badge.replace('_VERIFIED', '').replace('_', ' ')}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Rate & Match Score */}
                        <div className="text-right">
                          <div className="text-sm font-extrabold text-white">
                            ${(cand.coachProfile.hourlyRateCents / 100).toFixed(2)}
                            <span className="text-[10px] text-slate-400 font-normal">/hr</span>
                          </div>
                          <div className="text-[10px] text-slate-400">(${ratePerMin}/min)</div>

                          <div className="mt-1.5 inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-700/50 text-blue-300 font-bold text-xs">
                            <span>Score: {cand.scoreBreakdown.totalScore}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Score Breakdown Bar */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-slate-700/60 text-[11px] text-slate-300 space-y-1 bg-slate-950/40 p-2.5 rounded-lg">
                          <div className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                            8-Factor Score Breakdown:
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-[10px]">
                            <div>
                              <span className="text-slate-500">Instrument:</span> {cand.scoreBreakdown.instrumentFit}/25
                            </div>
                            <div>
                              <span className="text-slate-500">Specialty:</span> {cand.scoreBreakdown.specialtyFit}/20
                            </div>
                            <div>
                              <span className="text-slate-500">Language:</span> {cand.scoreBreakdown.languageFit}/15
                            </div>
                            <div>
                              <span className="text-slate-500">Quality:</span> {cand.scoreBreakdown.coachQuality}/15
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-[10px]">
                            <div>
                              <span className="text-slate-500">Availability:</span> {cand.scoreBreakdown.availability}/10
                            </div>
                            <div>
                              <span className="text-slate-500">Price Fit:</span> {cand.scoreBreakdown.priceFit}/5
                            </div>
                            <div>
                              <span className="text-slate-500">Response:</span> {cand.scoreBreakdown.responseReliability}/5
                            </div>
                            <div>
                              <span className="text-slate-500">History:</span> {cand.scoreBreakdown.historicalCompatibility}/5
                            </div>
                          </div>

                          {!cand.isEligible && (
                            <div className="mt-2 text-rose-400 text-[10px] bg-rose-950/30 p-1.5 rounded border border-rose-900">
                              <span className="font-bold">Ineligible:</span> {cand.ineligibilityReasons.join(' ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  })
                )}
              </div>
            </div>

            {/* Bottom Action Pane */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <div className="font-medium text-slate-300 flex items-center space-x-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 inline" />
                    <span>Escrow Hold: Authorized up to 1 hr (${selectedCandidate ? (selectedCandidate.coachProfile.hourlyRateCents / 100).toFixed(2) : '0.00'})</span>
                  </div>
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    TEST / MOCK PAYMENT
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Development Sandbox: Powered by MockMarketplacePaymentProvider. No real charge occurs.
                </div>
              </div>


              <button
                id="instant-match-enter-room-button"
                disabled={!selectedCandidate || !selectedCandidate.isEligible || isAccepting}
                onClick={() => selectedCandidate && handleInstantAccept(selectedCandidate)}
                className={`px-5 py-2.5 rounded-lg font-bold text-sm flex items-center space-x-2 shadow-lg transition-all ${
                  selectedCandidate && selectedCandidate.isEligible && !isAccepting
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 hover:scale-[1.02]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Authorizing Escrow & Joining...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                    <span>Join Live Coaching Room</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
