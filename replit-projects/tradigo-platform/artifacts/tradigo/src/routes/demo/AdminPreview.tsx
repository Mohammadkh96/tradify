import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuthStore } from '../../stores/authStore';

export function AdminPreview() {
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    localStorage.removeItem('tradigo_preview_role');
    localStorage.removeItem('tradigo_dev_token');
    sessionStorage.removeItem('tradigo_preview_session');

    useAuthStore.setState({
      loading: false,
      error: null,
      firebaseUser: null,
      canonicalUser: {
        id: 'demo-admin-preview',
        email: 'admin@demo.tradigo.app',
        displayName: 'Tradigo Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        countryCode: 'US',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      traderProfile: null,
      coachProfile: null,
    });
    setPreviewReady(true);
  }, []);

  if (!previewReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Opening the admin control plane…</p>
        </div>
      </div>
    );
  }

  return <AppShell />;
}