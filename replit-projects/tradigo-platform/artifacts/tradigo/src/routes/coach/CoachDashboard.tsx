import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../lib/apiClient';
import { CoachAvailabilityEditor } from '../../components/coach/CoachAvailabilityEditor';

type PresenceState = 'OFFLINE' | 'AVAILABLE' | 'AWAY' | 'BUSY' | 'IN_SESSION';

type CoachSession = {
  id: string;
  mode: string;
  status: string;
  durationMinutes: number;
  amountCents: number;
  scheduledAt: string | null;
};

type EarningsSummary = {
  completedSessionCount: number;
  monthEarningsCents: number;
  heldCents?: number;
  processingCents?: number;
  paidCents?: number;
};

type PayoutAccount = {
  status: string;
  hasProviderAccount: boolean;
  requiresIndependentVerification?: boolean;
};

export const CoachDashboard = () => {
  const { canonicalUser } = useAuthStore();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/preview/coach') ? '/preview/coach' : '/coach';
  const requestsPath = basePath === '/preview/coach' ? basePath : `${basePath}/requests`;
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  // Presence State
  const [presenceStatus, setPresenceStatus] = useState<PresenceState>('OFFLINE');
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [isLoadingPresence, setIsLoadingPresence] = useState(true);
  const [isUpdatingPresence, setIsUpdatingPresence] = useState(false);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount | null>(null);
  const [workError, setWorkError] = useState<string | null>(null);

  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProfile();
    loadPresence();
  }, [canonicalUser]);

  const loadWork = useCallback(async () => {
    try {
      const [sessionsData, earningsData] = await Promise.all([
        apiClient.get('/api/sessions'),
        apiClient.get('/api/coach/earnings'),
      ]);
      setSessions(sessionsData.items ?? []);
      setEarnings(earningsData.summary ?? null);
      setPayoutAccount(earningsData.payoutAccount ?? null);
      setWorkError(null);
    } catch (err: any) {
      setWorkError(err.message || 'Unable to load your current coaching work.');
    }
  }, []);

  useEffect(() => {
    loadWork();
    const timer = window.setInterval(loadWork, 5000);
    return () => window.clearInterval(timer);
  }, [loadWork]);

  // Handle Heartbeat loop for AVAILABLE or AWAY presence
  useEffect(() => {
    if ((presenceStatus === 'AVAILABLE' || presenceStatus === 'AWAY') && leaseId) {
      heartbeatTimerRef.current = setInterval(async () => {
        try {
          const res = await apiClient.post('/api/coaches/me/presence/heartbeat', { leaseId });
          if (!res?.success) {
            // Heartbeat failed or lease expired - fail closed to OFFLINE
            setPresenceStatus('OFFLINE');
            setLeaseId(null);
            setPresenceError('Availability lease expired. Please re-announce availability.');
          }
        } catch (err: any) {
          console.error('[CoachDashboard] Heartbeat error:', err);
          setPresenceError('Presence heartbeat failed. Please check connection.');
        }
      }, 25000); // 25 seconds interval
    } else {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    }

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [presenceStatus, leaseId]);

  const loadProfile = async () => {
    try {
      const res = await apiClient.get('/api/marketplace/coaches/me');
      setProfile(res);
      setEditForm({
        headline: res.headline || '',
        bio: res.bio || '',
        teachingMethod: res.teachingMethod || '',
        coachingBoundaries: res.coachingBoundaries || '',
        hourlyRateCents: res.hourlyRateCents || 0,
        markets: res.markets || [],
        supportedInstruments: res.supportedInstruments || [],
        specialties: res.specialties || [],
        languages: res.languages || ['en'],
      });
    } catch (err) {
      console.error('[CoachDashboard] Load profile error:', err);
    }
  };

  const loadPresence = async () => {
    setIsLoadingPresence(true);
    setPresenceError(null);
    try {
      const res = await apiClient.get('/api/coaches/me/presence');
      if (res?.status) {
        setPresenceStatus(res.status as PresenceState);
        setLeaseId(res.leaseId || null);
      }
    } catch (err: any) {
      console.error('[CoachDashboard] Load presence error:', err);
      setPresenceStatus('OFFLINE');
      setPresenceError('Failed to load presence from server.');
    } finally {
      setIsLoadingPresence(false);
    }
  };

  const handleSetPresence = async (targetStatus: 'AVAILABLE' | 'AWAY' | 'OFFLINE') => {
    setIsUpdatingPresence(true);
    setPresenceError(null);
    try {
      const res = await apiClient.post('/api/coaches/me/presence', { status: targetStatus });
      setPresenceStatus(res.status as PresenceState);
      setLeaseId(res.leaseId || null);
    } catch (err: any) {
      console.error('[CoachDashboard] Set presence error:', err);
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to update availability status.';
      setPresenceError(msg);
      // Ensure state remains server-authoritative
    } finally {
      setIsUpdatingPresence(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.put('/api/marketplace/coaches/me', editForm);
      setIsEditing(false);
      loadProfile();
    } catch (err) {
      alert('Failed to update profile');
    }
  };

  if (profile && profile.applicationStatus && profile.applicationStatus !== 'APPROVED') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-card border border-border rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold mb-2 text-destructive">Application Status: {profile.applicationStatus}</h2>
        <p className="text-muted-foreground max-w-md">Your coaching profile is not currently approved.</p>
      </div>
    );
  }

  // Render status badge helper
  const renderStatusBadge = () => {
    switch (presenceStatus) {
      case 'AVAILABLE':
        return (
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm font-semibold text-emerald-600">AVAILABLE</span>
          </div>
        );
      case 'AWAY':
        return (
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-sm font-semibold text-amber-600">AWAY</span>
          </div>
        );
      case 'BUSY':
        return (
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-sm font-semibold text-rose-600">BUSY</span>
          </div>
        );
      case 'IN_SESSION':
        return (
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            <span className="text-sm font-semibold text-indigo-600">IN SESSION</span>
          </div>
        );
      case 'OFFLINE':
      default:
        return (
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground"></span>
            <span className="text-sm font-medium text-muted-foreground">OFFLINE</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Availability Section */}
      <section className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Coach Dashboard</h2>
          {isLoadingPresence ? (
            <span className="text-sm text-muted-foreground">Loading presence status...</span>
          ) : (
            renderStatusBadge()
          )}
          
          <p className="text-xs text-muted-foreground mt-2">
            {presenceStatus === 'AVAILABLE' && 'You are available to receive coaching requests.'}
            {presenceStatus === 'AWAY' && 'You are away from Coach Now. Traders can still request a scheduled session.'}
            {presenceStatus === 'OFFLINE' && 'Coach Now is offline. Traders can still request a scheduled session.'}
            {(presenceStatus === 'BUSY' || presenceStatus === 'IN_SESSION') && 'Availability is managed automatically during active sessions.'}
          </p>

          {presenceError && (
            <p className="text-xs text-destructive mt-1 font-medium">{presenceError}</p>
          )}
        </div>

        <div className="mt-4 md:mt-0 flex flex-wrap gap-2 items-center">
          {isUpdatingPresence ? (
            <Button disabled variant="outline" className="font-medium">
              Updating availability...
            </Button>
          ) : (
            <>
              {(presenceStatus === 'OFFLINE' || presenceStatus === 'AWAY') && (
                <Button 
                  onClick={() => handleSetPresence('AVAILABLE')} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  GO AVAILABLE
                </Button>
              )}

              {presenceStatus === 'AVAILABLE' && (
                <Button 
                  onClick={() => handleSetPresence('OFFLINE')} 
                  variant="outline" 
                  className="font-medium border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  GO OFFLINE
                </Button>
              )}

              {(presenceStatus === 'AVAILABLE' || presenceStatus === 'OFFLINE') && (
                <Button 
                  onClick={() => handleSetPresence('AWAY')} 
                  variant="outline" 
                  className="font-medium"
                >
                  SET AWAY
                </Button>
              )}

              {presenceStatus === 'AWAY' && (
                <Button 
                  onClick={() => handleSetPresence('OFFLINE')} 
                  variant="outline" 
                  className="font-medium"
                >
                  GO OFFLINE
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      <CoachAvailabilityEditor />

      {/* Profile Summary & Editing */}
      <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">Coach Profile Summary</h3>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit Profile</Button>
          )}
        </div>
        
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Headline</label>
              <input 
                value={editForm.headline}
                onChange={e => setEditForm({...editForm, headline: e.target.value})}
                className="w-full p-2 border rounded bg-background" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bio</label>
              <textarea 
                value={editForm.bio}
                onChange={e => setEditForm({...editForm, bio: e.target.value})}
                className="w-full p-2 border rounded bg-background h-24" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rate ($/hr)</label>
                <input 
                  type="number"
                  value={Math.floor(editForm.hourlyRateCents / 100)}
                  onChange={e => setEditForm({...editForm, hourlyRateCents: Number(e.target.value) * 100})}
                  className="w-full p-2 border rounded bg-background" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teaching method</label>
                <textarea
                  value={editForm.teachingMethod}
                  onChange={e => setEditForm({...editForm, teachingMethod: e.target.value})}
                  placeholder="How do you teach and structure a session?"
                  className="w-full p-2 border rounded bg-background h-20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Coaching boundaries</label>
                <textarea
                  value={editForm.coachingBoundaries}
                  onChange={e => setEditForm({...editForm, coachingBoundaries: e.target.value})}
                  placeholder="What will you not provide? (For example: no signals or trade execution.)"
                  className="w-full p-2 border rounded bg-background h-20"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        ) : profile ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 border-b pb-4">
              <div>
                <span className="text-sm text-muted-foreground block">Display Name</span>
                <span className="font-medium">{profile.displayName}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground block">Verification Status</span>
                <span className="font-medium capitalize">{profile.verificationStatus}</span>
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Headline</span>
              <span className="font-medium">{profile.headline}</span>
            </div>
            {profile.profileChangeStatus === 'PENDING_REVIEW' && (
              <div role="status" className="rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 text-sm text-amber-800">
                Profile changes are awaiting moderator review. Your current approved profile remains visible to traders.
              </div>
            )}
            <div>
              <span className="text-sm text-muted-foreground block">Teaching method</span>
              <span className="font-medium">{profile.teachingMethod || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Coaching boundaries</span>
              <span className="font-medium">{profile.coachingBoundaries || 'Education only; no signals, guarantees, account access, or trade execution.'}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Rate</span>
              <span className="font-medium">${(profile.hourlyRateCents / 100).toFixed(2)}/hr</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Markets</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.markets?.length > 0 ? profile.markets.map((m: string) => (
                  <span key={m} className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-md">{m}</span>
                )) : <span className="text-muted-foreground text-sm">—</span>}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        )}
      </section>

      {/* Grid for other stuff */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Rating', value: profile?.ratingAverage > 0 ? profile.ratingAverage.toFixed(1) : null },
          { label: 'Completed Sessions', value: earnings ? earnings.completedSessionCount : null },
          { label: 'Response Rate', value: null },
          { label: 'Earnings (Month)', value: earnings ? `$${(earnings.monthEarningsCents / 100).toFixed(2)}` : null },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-sm text-muted-foreground mb-1">{stat.label}</span>
            {stat.value !== null ? (
              <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            ) : (
              <span className="text-sm text-muted-foreground italic">—</span>
            )}
          </div>
        ))}
      </div>

      {workError && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm font-medium text-destructive">{workError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">        
        <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Your live handoffs</h3>
            <Link to={requestsPath} className="text-sm font-semibold text-primary hover:underline">View all</Link>
          </div>
          {sessions.filter((session) => session.status !== 'COMPLETED' && session.status !== 'CANCELLED').length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-secondary/20 rounded-lg border border-dashed border-border">
              <p className="text-muted-foreground text-sm">No active coaching handoffs.</p>
              <p className="text-xs text-muted-foreground mt-2">New requests will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.filter((session) => session.status !== 'COMPLETED' && session.status !== 'CANCELLED').slice(0, 3).map((session) => {
                const readyToJoin = session.status === 'ROOM_READY' || session.status === 'ACTIVE';
                return (
                  <article key={session.id} className="rounded-lg border border-border bg-secondary/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{session.mode === 'SCHEDULED' ? 'Scheduled coaching' : 'Coach Now session'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{session.durationMinutes} minutes · ${(session.amountCents / 100).toFixed(2)}</p>
                      </div>
                      <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-bold tracking-wide text-muted-foreground">{session.status.replaceAll('_', ' ')}</span>
                    </div>
                    <Link
                      to={readyToJoin ? `${basePath}/sessions/${session.id}/live` : `${basePath}/sessions/${session.id}`}
                      className="mt-3 inline-flex text-sm font-bold text-primary hover:underline"
                    >
                      {readyToJoin ? (session.status === 'ACTIVE' ? 'Rejoin live room' : 'Open live room') : 'View session handoff'}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Earnings</h3>
            <Link to={`${basePath}/earnings`} className="text-sm font-semibold text-primary hover:underline">Open earnings</Link>
          </div>
          <div className="rounded-lg bg-secondary/30 p-6">
            <p className="text-sm text-muted-foreground">Completed session income this month</p>
            <p className="mt-2 text-3xl font-black">${((earnings?.monthEarningsCents ?? 0) / 100).toFixed(2)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{earnings?.completedSessionCount ?? 0} completed session{earnings?.completedSessionCount === 1 ? '' : 's'} all time</p>
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground">
                {payoutAccount?.requiresIndependentVerification
                  ? 'PayPal ownership needs independent re-verification; unpaid earnings are on hold.'
                  : payoutAccount?.status === 'READY'
                  ? 'PayPal payouts are connected.'
                  : 'Connect PayPal to receive your earnings.'}
              </p>
              {payoutAccount?.status !== 'READY' && !payoutAccount?.requiresIndependentVerification && (
                <Link to={`${basePath}/earnings`} className="mt-2 inline-flex text-sm font-bold text-primary hover:underline">
                  Set up payout account
                </Link>
              )}
              {payoutAccount?.requiresIndependentVerification && (
                <Link to={`${basePath}/earnings`} className="mt-2 inline-flex text-sm font-bold text-primary hover:underline">
                  Review payout hold
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4">Recent Students</h3>
          <div className="flex flex-col items-center justify-center p-8 text-center bg-secondary/20 rounded-lg border border-dashed border-border">
            <p className="text-muted-foreground text-sm">No students yet.</p>
          </div>
        </section>
      </div>
    </div>
  );
};
