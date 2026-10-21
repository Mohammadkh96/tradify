import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, Globe, CheckCircle2, Heart, ExternalLink, Info, Clock, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { CoachMarketplaceDTO } from '../../types';

interface CoachCardProps {
  coach: CoachMarketplaceDTO;
  onFavoriteToggle: (id: string, isFavorited: boolean) => void;
  matchReason?: string;
}

export const CoachCard: React.FC<CoachCardProps> = ({ coach, onFavoriteToggle, matchReason }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const marketplacePath = location.pathname.startsWith('/preview') ? '/preview/coaches' : '/app/coaches';
  const profilePath = `${marketplacePath}/${encodeURIComponent(coach.id)}${location.search}`;

  const formatRate = (minorUnits: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(minorUnits / 100);
  };

  const durations = [10, 25, 50] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-w-0 bg-card border border-border rounded-lg overflow-hidden flex flex-col group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md relative"
    >
      <div className="p-5 flex-1">
        {matchReason && (
          <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary" role="note">
            Good fit because {matchReason}
          </div>
        )}
        <div className="flex min-w-0 items-start justify-between">
          <div className="flex min-w-0 flex-1 items-center space-x-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-secondary overflow-hidden border-2 border-border group-hover:border-primary/30 transition-colors">
                {coach.avatarUrl ? (
                  <img src={coach.avatarUrl} alt={coach.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                    {coach.displayName.charAt(0)}
                  </div>
                )}
              </div>
              {coach.approved && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 fill-blue-500/10" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="truncate font-bold text-lg leading-none group-hover:text-primary transition-colors">{coach.displayName}</h3>
                <div className="relative">
                  <button
                    type="button"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    onClick={() => setShowTooltip(!showTooltip)}
                    className="p-1 rounded-full text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                    title="View Rate Breakdown"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  {/* Fixed-duration price breakdown */}
                  {showTooltip && (
                    <div className="absolute left-0 bottom-full mb-2 w-72 bg-slate-900 border border-indigo-500/40 rounded-xl p-4 shadow-2xl text-slate-100 text-xs z-50 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-bold text-indigo-300 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1.5" /> Fixed session prices
                        </span>
                        <span className="text-[10px] text-slate-400">{coach.currency}</span>
                      </div>
                      
                      <div className="space-y-2">
                        {durations.map((minutes) => (
                          <div key={minutes} className="flex justify-between items-center bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            <span className="text-slate-400">{minutes}-minute consultation</span>
                            <span className="font-bold text-emerald-400">
                              {formatRate(coach.instantRatePerMinuteCents * minutes, coach.currency)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="text-[10px] text-slate-400 leading-normal">
                        The displayed amount is the authorization cap. Settlement uses verified shared attendance with a 60-second reconnect grace.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{coach.headline}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFavoriteToggle(coach.id, !coach.isFavorited)}
            aria-label={coach.isFavorited ? `Remove ${coach.displayName} from favorites` : `Save ${coach.displayName} to favorites`}
            className={`shrink-0 p-2 rounded-full transition-colors ${coach.isFavorited ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground hover:bg-secondary'}`}
          >
            <Heart className={`w-5 h-5 ${coach.isFavorited ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center text-sm font-medium text-amber-500">
            <Star className="w-4 h-4 fill-current mr-1" />
            {coach.ratingCount > 0 ? coach.ratingAverage.toFixed(1) : 'New'}
            <span className="text-muted-foreground font-normal ml-1">({coach.ratingCount})</span>
          </div>
          <div className="h-1 w-1 rounded-full bg-border" />
          <div className="text-sm text-muted-foreground flex items-center">
             <Globe className="w-3.5 h-3.5 mr-1" />
             {coach.languages.length > 0 ? coach.languages.join(', ') : 'English'}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {coach.specialties.slice(0, 3).map((spec) => (
            <span key={spec} className="px-2 py-0.5 bg-secondary text-[10px] font-bold uppercase tracking-wider rounded text-secondary-foreground">
              {spec.replace('_', ' ')}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Admin approved</span>
          <span>{coach.proof?.serviceRecord?.status === 'NEW' ? 'New teaching record' : 'Proof reviewed'}</span>
          <span className={coach.availability === 'AVAILABLE' ? 'text-emerald-500' : ''}>
            {coach.availability === 'AVAILABLE' ? 'Available now' : 'Schedule only'}
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-3" aria-label="Coach trust information">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Teaching record</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <span><strong className="text-foreground">{coach.completedSessionCount ?? 0}</strong><br />completed sessions</span>
            <span><strong className="text-foreground">{coach.ratingCount > 0 ? `${coach.ratingAverage.toFixed(1)}/5` : 'New'}</strong><br />learner feedback</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {coach.sessionReliabilityPercent == null
              ? 'Reliability data will appear after completed or cancelled sessions.'
              : `${coach.sessionReliabilityPercent}% completed · based on ${coach.reliabilitySampleCount ?? 0} concluded sessions`}
          </p>
        </div>

        <p className="mt-4 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {coach.bio}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-secondary/30 border-t border-border">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">Starting from</span>
          <span className="text-lg font-bold text-foreground">
            {formatRate(coach.instantRatePerMinuteCents, coach.currency)}
            <span className="text-xs font-normal text-muted-foreground">/min</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate(profilePath)}
          aria-label={`View ${coach.displayName}'s profile`}
          className="shrink-0 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md flex items-center hover:bg-primary/90 transition-colors"
        >
          View Profile
          <ExternalLink className="w-3.5 h-3.5 ml-2" />
        </button>
      </div>
    </motion.div>
  );
};
