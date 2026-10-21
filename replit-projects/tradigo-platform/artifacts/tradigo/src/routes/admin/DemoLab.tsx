
import React, { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient';

import { useNavigate } from 'react-router';
import { ShieldAlert, Users, Server, Database, Activity, RefreshCw } from 'lucide-react';

export function DemoLab() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [actors, setActors] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [matchmaking, setMatchmaking] = useState<any[]>([]);
  const [coachesPresence, setCoachesPresence] = useState<any[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    loadLabData();
  }, []);

  const loadLabData = async () => {
    try {
      const diagRes = await apiClient.get('/api/demo-lab/diagnostics');
      setDiagnostics(diagRes);

      const actorsRes = await apiClient.get('/api/demo-lab/actors');
      setActors(actorsRes.actors);

      const sessionsRes = await apiClient.get('/api/demo-lab/sessions');
      setSessions(sessionsRes.sessions);
      
      const mmRes = await apiClient.get('/api/demo-lab/matchmaking');
      setMatchmaking(mmRes.requests);

      const presRes = await apiClient.get('/api/demo-lab/coaches-presence');
      setCoachesPresence(presRes.coachesPresence || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeedActors = async () => {
    await apiClient.post('/api/demo-lab/actors/seed');
    loadLabData();
  };

  const handleEnterAsActor = async (actorEmail: string) => {
    const key = actorEmail.includes('trader.alpha') ? 'TRADER_ALPHA' : 
                actorEmail.includes('coach.alpha') ? 'COACH_ALPHA' : 'COACH_BRAVO';
    
    try {
      const res = await apiClient.post('/api/demo-lab/actors/token', { actorKey: key });
      localStorage.setItem('tradigo_dev_token', res.token);
      window.dispatchEvent(new Event('storage'));
      window.location.href = '/';
      return;
      if (key === 'TRADER_ALPHA') navigate('/app/trader');
      else navigate('/app/coach');
    } catch (err) {
      console.error(err);
      alert('Failed to login. Did you seed the actors?');
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset Demo Data? This will clear sessions and matchmaking for demo actors.')) return;
    await apiClient.post('/api/demo-lab/reset');
    loadLabData();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="text-red-500" /> TRADIGO DEMO LAB
          </h1>
          <p className="text-muted-foreground mt-2">Internal development/staging environment testing.</p>
        </div>
        <button onClick={loadLabData} className="px-4 py-2 border rounded-md flex items-center gap-2 hover:bg-muted">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {diagnostics && Object.entries(diagnostics).map(([key, data]: [string, any]) => (
          <div key={key} className="p-4 border rounded-lg bg-card">
            <h3 className="uppercase text-xs font-bold text-muted-foreground mb-2">{key}</h3>
            <div className={`font-medium ${data.status === 'CONNECTED' ? 'text-green-500' : 'text-red-500'}`}>
              {data.status}
            </div>
            {data.mode && <div className="text-xs mt-1 text-muted-foreground">{data.mode}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="border p-6 rounded-lg bg-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Users /> Test Actors</h2>
            <button onClick={handleSeedActors} className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded-md">Seed Actors</button>
          </div>
          <div className="space-y-4">
            {actors.map(actor => (
              <div key={actor.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                <div>
                  <div className="font-medium">{actor.display_name}</div>
                  <div className="text-sm text-muted-foreground">{actor.email} • {actor.role}</div>
                  <div className="text-xs text-muted-foreground mt-1">Presence: {actor.presence_status}</div>
                </div>
                <button onClick={() => handleEnterAsActor(actor.email)} className="px-3 py-1 bg-secondary text-secondary-foreground rounded-md text-sm">
                  Enter as {actor.role === 'TRADER' ? 'Trader' : 'Coach'}
                </button>
              </div>
            ))}
            {actors.length === 0 && <p className="text-sm text-muted-foreground">No demo actors found. Click Seed Actors.</p>}
          </div>
        </section>

        <section className="border p-6 rounded-lg bg-card">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4"><Activity /> Matchmaking Requests</h2>
          <div className="space-y-4">
            {matchmaking.map(req => (
              <div key={req.id} className="border-b pb-4 last:border-0">
                <div className="font-medium">Request {req.id.substring(0,8)}...</div>
                <div className="text-sm text-muted-foreground">{req.trader_name} • {req.instrument} • {req.specialty} • {req.status}</div>
              </div>
            ))}
            {matchmaking.length === 0 && <p className="text-sm text-muted-foreground">No active matchmaking requests.</p>}
          </div>
        </section>
      </div>

      <section className="border p-6 rounded-lg bg-card">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4"><Activity /> Real Redis Coach Presence Inspector</h2>
        <div className="space-y-4">
          {coachesPresence.map(coach => (
            <div key={coach.coachId} className="border-b pb-4 last:border-0 flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">{coach.displayName} <span className="text-xs text-muted-foreground">({coach.email})</span></div>
                <div className="text-xs text-muted-foreground font-mono mt-1">Key: {coach.redisKey}</div>
                {coach.updatedAt && <div className="text-xs text-muted-foreground mt-0.5">Updated: {new Date(coach.updatedAt).toLocaleTimeString()}</div>}
              </div>
              <div className="text-right">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  coach.presenceState === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' :
                  coach.presenceState === 'AWAY' ? 'bg-amber-100 text-amber-800' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {coach.presenceState}
                </span>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  TTL: {coach.ttlRemainingSeconds > 0 ? `${coach.ttlRemainingSeconds}s` : 'Expired / None'}
                </div>
              </div>
            </div>
          ))}
          {coachesPresence.length === 0 && <p className="text-sm text-muted-foreground">No demo coaches presence data available.</p>}
        </div>
      </section>

      <section className="border p-6 rounded-lg bg-card">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4"><Server /> Sessions</h2>
        <div className="space-y-4">
          {sessions.map(s => (
            <div key={s.id} className="border-b pb-4 last:border-0 flex justify-between">
              <div>
                <div className="font-medium">Session {s.id.substring(0,8)}...</div>
                <div className="text-sm text-muted-foreground">{s.trader_name} & {s.coach_name}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{s.state}</div>
                <div className="text-sm text-muted-foreground">{s.currency} {s.agreed_rate_minor_per_hour}/hr</div>
              </div>
            </div>
          ))}
          {sessions.length === 0 && <p className="text-sm text-muted-foreground">No active sessions.</p>}
        </div>
      </section>

      <section className="border p-6 rounded-lg bg-card">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4"><Database /> Reset Tools</h2>
        <p className="text-sm text-muted-foreground mb-4">Safely reset Demo Lab state without affecting production data.</p>
        <button onClick={handleReset} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md font-medium">
          Reset Demo State
        </button>
      </section>
    </div>
  );
}
