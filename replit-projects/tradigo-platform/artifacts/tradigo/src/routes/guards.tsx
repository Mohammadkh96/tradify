import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { UserRole } from '../types/index.js';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

export const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { canonicalUser, firebaseUser, localSessionActive, traderProfile, coachProfile, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return null; // Should be handled by router suspense/loading
  }

  // A locally stored token is not an authentication grant. Production routes
  // require a resolved canonical profile and either a live Firebase session
  // or the server-confirmed local HttpOnly session.
  if (!canonicalUser || (!firebaseUser && !localSessionActive)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (canonicalUser.status === 'BANNED') {
    return <Navigate to="/banned" replace />;
  }

  if (canonicalUser.status === 'SUSPENDED') {
    return <Navigate to="/suspended" replace />;
  }

  // Force onboarding if trader hasn't completed it
  if (
    canonicalUser.role === 'TRADER' && 
    traderProfile && 
    !traderProfile.onboardingCompletedAt && 
    location.pathname !== '/onboarding' &&
    location.pathname !== '/coach/apply'
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(canonicalUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
