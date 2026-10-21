import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../lib/apiClient';

/**
 * A public way to experience the imported application while Firebase and the
 * original server-side integrations are being connected. It uses the app's
 * normal trader shell and routes rather than a replacement UI.
 */
export function MarketplacePreview({ role = 'TRADER' }: { role?: 'TRADER' | 'COACH' }) {
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    let active = true;
    setPreviewReady(false);
    localStorage.setItem('tradigo_preview_role', role);
    // Preview authentication is cookie-only. Remove the legacy bearer token so
    // a previous demo role cannot override the role selected by this route.
    localStorage.removeItem('tradigo_dev_token');
    apiClient.post('/api/auth/demo', { role })
      .then((data) => {
        if (!active) return;
        if (data?.previewToken) {
          sessionStorage.setItem('tradigo_preview_session', data.previewToken);
        }
        useAuthStore.setState({
          loading: false,
          error: null,
          // Preview identities are not Firebase accounts and must never
          // satisfy the production protected-route contract.
          firebaseUser: null,
          canonicalUser: {
            id: role === 'COACH' ? 'demo-coach-maya' : 'demo-trader-preview',
            email: role === 'COACH' ? 'maya@demo.tradigo.app' : 'demo@tradigo.app',
            displayName: role === 'COACH' ? 'Maya Chen' : 'Demo Trader',
            role,
            status: 'ACTIVE',
            countryCode: 'US',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          traderProfile: role === 'TRADER' ? {
            userId: 'demo-trader-preview',
            experienceLevel: 'INTERMEDIATE',
            preferredMarkets: ['FOREX', 'CRYPTO'],
            instruments: ['FOREX', 'CRYPTO'],
            tradingStyles: ['Swing'],
            methodologies: ['Price action'],
            onboardingCurrentStep: 4,
            onboardingCompletedAt: new Date().toISOString(),
            totalSessionsCompleted: 0,
            totalSpentCents: 0,
            blockedCoachIds: [],
          } : null,
        });
        setPreviewReady(true);
      })
      .catch(() => {
        if (active) {
          useAuthStore.setState({ loading: false, error: 'Unable to start the secure preview session.' });
          setPreviewReady(true);
        }
      });
    return () => { active = false; };
  }, [role]);

  if (!previewReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <AppShell />;
}
