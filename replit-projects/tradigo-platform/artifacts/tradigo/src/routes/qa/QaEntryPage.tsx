import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../lib/apiClient';

export function QaEntryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnter = async (actorKey: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/api/demo-lab/actors/token', { actorKey });
      localStorage.setItem('tradigo_dev_token', res.token);
      window.dispatchEvent(new Event('storage'));
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border shadow-sm">
        <h1 className="text-2xl font-bold text-center">QA Entry Point</h1>
        {error && <div className="p-3 bg-destructive/10 text-destructive rounded text-sm">{error}</div>}
        
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <div className="font-medium">Demo Trader Alpha</div>
              <div className="text-xs text-muted-foreground">TRADER</div>
            </div>
            <Button onClick={() => handleEnter('TRADER_ALPHA')} disabled={loading}>Open Trader Experience</Button>
          </div>
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <div className="font-medium">Demo Coach Alpha</div>
              <div className="text-xs text-muted-foreground">COACH</div>
            </div>
            <Button onClick={() => handleEnter('COACH_ALPHA')} disabled={loading}>Open Coach Experience</Button>
          </div>
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <div className="font-medium">Demo Coach Bravo</div>
              <div className="text-xs text-muted-foreground">COACH</div>
            </div>
            <Button onClick={() => handleEnter('COACH_BRAVO')} disabled={loading}>Open Coach Experience</Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-center">
          Note: This page is only active in development/staging.
        </div>
      </div>
    </div>
  );
}
