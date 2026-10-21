import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { 
  Star, MapPin, Globe, CheckCircle2, Heart, 
  ArrowLeft, BadgeCheck, ShieldCheck, Clock, 
  Target, Zap, Calendar, History, TrendingUp 
} from 'lucide-react';
import { CoachMarketplaceDTO } from '../../types';
import { CoachBookingPackages } from '../../components/marketplace/CoachBookingPackages';
import { apiClient } from '../../lib/apiClient';

export const CoachProfileView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const marketplacePath = location.pathname.startsWith('/preview') ? '/preview/coaches' : '/app/coaches';
  const marketplaceReturnPath = `${marketplacePath}${location.search}`;
  const [coach, setCoach] = useState<CoachMarketplaceDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/api/marketplace/coaches/${id}`);
      setCoach(data);
      /* apiClient throws for non-OK responses; retain the marketplace-specific
         not-found message below via the error handler. */
      if (!data) {
        setError('Coach not found or no longer eligible for marketplace.');
        return;
      }
    } catch (err) {
      setError((err as { status?: number }).status === 404
        ? 'Coach not found or no longer eligible for marketplace.'
        : 'An error occurred while loading the profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchProfile();
  }, [id]);

  const handleFavoriteToggle = async () => {
    if (!coach) return;
    const isFavorited = !coach.isFavorited;
    try {
      const method = isFavorited ? 'POST' : 'DELETE';
       await apiClient.fetch(`/api/marketplace/coaches/${id}/favorite`, { method });
       setCoach(prev => prev ? { ...prev, isFavorited } : null);
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
  };

  const formatRate = (minorUnits: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(minorUnits / 100);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground italic">Loading coach profile...</p>
      </div>
    );
  }

  if (error || !coach) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-destructive">Profile Unavailable</h2>
        <p className="mt-4 text-muted-foreground">{error || 'This coach is currently not taking new students.'}</p>
        <button 
          onClick={() => navigate(marketplaceReturnPath)}
          className="mt-8 px-6 py-2 bg-primary text-primary-foreground rounded-md font-bold"
        >
          Back to Marketplace
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <button 
        onClick={() => navigate(marketplaceReturnPath)}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Marketplace
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Summary Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col items-center text-center">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-secondary overflow-hidden border-4 border-background ring-2 ring-border">
                {coach.avatarUrl ? (
                  <img src={coach.avatarUrl} alt={coach.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground">
                    {coach.displayName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="absolute bottom-1 right-1 bg-background rounded-full p-1 border border-border shadow-sm">
                <ShieldCheck className="w-6 h-6 text-blue-500 fill-blue-500/10" />
              </div>
            </div>

            <h1 className="mt-6 text-2xl font-black tracking-tight leading-none">{coach.displayName}</h1>
            <p className="mt-3 text-muted-foreground font-medium text-sm px-4">{coach.headline}</p>

            <div className="mt-6 flex items-center space-x-1 text-amber-500 bg-amber-500/5 px-3 py-1 rounded-full border border-amber-500/10">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-bold text-sm">
                {coach.ratingCount > 0 ? coach.ratingAverage.toFixed(1) : 'New Coach'}
              </span>
              <span className="text-muted-foreground text-xs font-normal">({coach.ratingCount} reviews)</span>
            </div>

            <div className="mt-8 w-full space-y-3">
              <button 
                onClick={handleFavoriteToggle}
                className={`w-full py-3 px-4 rounded-xl border transition-all flex items-center justify-center font-bold ${
                  coach.isFavorited 
                    ? 'bg-red-500/5 border-red-200 text-red-600 hover:bg-red-500/10' 
                    : 'bg-background border-border text-foreground hover:bg-secondary'
                }`}
              >
                <Heart className={`w-4 h-4 mr-2 ${coach.isFavorited ? 'fill-current' : ''}`} />
                {coach.isFavorited ? 'Favorited' : 'Add to Favorites'}
              </button>
            </div>

            <div className="mt-8 w-full border-t border-border pt-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center"><TrendingUp className="w-4 h-4 mr-2" /> Session Rate</span>
                <span className="font-bold">{formatRate(coach.instantRatePerMinuteCents, coach.currency)} / min</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center"><Clock className="w-4 h-4 mr-2" /> Experience</span>
                <span className="font-bold">{coach.yearsOfExperience} Years</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center"><Globe className="w-4 h-4 mr-2" /> Language</span>
                <span className="font-bold">{coach.languages.join(', ') || 'Not specified'}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Availability</h3>
            <div className="flex items-center space-x-3 text-sm text-muted-foreground bg-secondary/30 p-3 rounded-lg border border-border">
              <Zap className="w-4 h-4" />
              <span>
                {coach.availability === 'AVAILABLE'
                  ? 'Available for Coach Now'
                  : coach.availability === 'AWAY'
                    ? 'Away — scheduled requests are still available'
                    : 'Offline — scheduled requests are still available'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Info */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              About {coach.displayName.split(' ')[0]}
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {coach.bio || 'This coach has not provided a detailed bio yet.'}
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-8 shadow-sm" aria-labelledby="proof-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="proof-heading" className="text-xl font-bold flex items-center">
                  <ShieldCheck className="w-6 h-6 mr-3 text-primary" /> Proof, with limits
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  These checks describe how Tradigo reviewed the coach and how much service history is available.
                  They are not a credential, signal, guarantee, or prediction of returns.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                coach.proof?.approval,
                coach.proof?.identity,
                coach.proof?.teachingScope,
                coach.proof?.serviceRecord,
              ].filter(Boolean).map((item) => (
                <div key={item!.label} className="rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold">{item!.label}</h3>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                      {item!.status === 'NEW' ? 'New' : item!.status === 'LIMITED_OR_ESTABLISHED' ? 'Limited sample' : 'Current'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-foreground">{item!.source}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item!.scope}</p>
                  {item!.sampleSize !== undefined && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item!.sampleSize === 0 ? 'No public service history yet.' : `${item!.sampleSize} concluded record${item!.sampleSize === 1 ? '' : 's'} currently summarized.`}
                    </p>
                  )}
                  {item!.asOf && <p className="mt-2 text-[11px] text-muted-foreground">Last recorded: {new Date(item!.asOf).toLocaleDateString()}</p>}
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center text-sm uppercase tracking-wider text-muted-foreground">
                <Target className="w-4 h-4 mr-2 text-primary" /> Specialties
              </h3>
              <div className="flex flex-wrap gap-2">
                {coach.specialties.map(spec => (
                  <span key={spec} className="px-3 py-1.5 bg-secondary rounded-lg text-sm font-semibold border border-border">
                    {spec.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center text-sm uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="w-4 h-4 mr-2 text-primary" /> Markets & Symbols
              </h3>
              <div className="flex flex-wrap gap-2">
                {coach.markets.map(market => (
                  <span key={market} className="px-3 py-1.5 bg-primary/5 text-primary rounded-lg text-sm font-bold border border-primary/10">
                    {market}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <section className="bg-card border border-border rounded-2xl p-8 shadow-sm">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-xl font-bold flex items-center">
                 <BadgeCheck className="w-6 h-6 mr-3 text-primary" /> Verification & Trust
               </h2>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border flex items-center space-x-4 ${coach.approved ? 'bg-blue-50/10 border-blue-200/50' : 'bg-secondary/30 border-dashed opacity-50'}`}>
                  <div className={`p-2 rounded-lg ${coach.approved ? 'bg-blue-500/20 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Marketplace Approved</h4>
                    <p className="text-xs text-muted-foreground">Approved by a Tradigo administrator</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-secondary/30 flex items-center space-x-4">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Verified session history</h4>
                    <p className="text-xs text-muted-foreground">
                      {coach.completedSessionCount
                        ? `${coach.completedSessionCount} completed paid sessions`
                        : 'No completed paid sessions yet'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-secondary/30 flex items-center space-x-4">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Session reliability</h4>
                    <p className="text-xs text-muted-foreground">
                       {coach.sessionReliabilityPercent === null || coach.sessionReliabilityPercent === undefined
                         ? 'Not enough concluded-session data'
                         : `${coach.sessionReliabilityPercent}% completed (${coach.reliabilitySampleCount ?? 0} concluded sessions)`}
                    </p>
                  </div>
                 </div>
              </div>
               <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-secondary/20 p-4">
                  <h3 className="text-sm font-bold">Teaching method</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{coach.teachingMethod || 'Structured, example-led review with a written practice step.'}</p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-4">
                  <h3 className="text-sm font-bold">Coaching boundaries</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{coach.coachingBoundaries || 'Education only. No signals, guarantees, account access, or trade execution.'}</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-secondary/20 p-4">
                <h3 className="text-sm font-bold">Response time</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {coach.averageResponseMinutes == null
                    ? 'Not enough accepted-request data yet.'
                    : `About ${coach.averageResponseMinutes} minutes on average · based on ${coach.responseSampleCount ?? 0} accepted requests`}
                </p>
              </div>
               <p className="mt-4 text-xs text-muted-foreground">Trust metrics describe service delivery and learner feedback. They do not predict returns or investment performance.</p>
          </section>

          <div className="space-y-6">
            <CoachBookingPackages coach={coach} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
