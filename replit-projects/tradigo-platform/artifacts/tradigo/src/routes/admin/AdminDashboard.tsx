import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { AdminControlPlaneTab, AdminControlPlaneView } from '../../components/admin/AdminControlPlaneView';

export const AdminDashboard = ({ demoMode = false, initialTab = 'dashboard' }: { demoMode?: boolean; initialTab?: AdminControlPlaneTab }) => {
  const { firebaseUser, canonicalUser } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (firebaseUser) {
      firebaseUser.getIdToken().then(setToken);
    } else {
      setToken(demoMode ? 'preview-only' : null);
    }
  }, [demoMode, firebaseUser]);

  if (!token) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h1 className="text-lg font-bold text-amber-950">Administrator session unavailable</h1>
        <p className="mt-2 text-sm text-amber-800">Sign in with an administrator account to open this control plane.</p>
      </div>
    );
  }

  return <AdminControlPlaneView userToken={token} currentUser={canonicalUser} demoMode={demoMode} initialTab={initialTab} />;
};
