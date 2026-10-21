import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';

// Layouts
import { AppShell } from '../components/layout/AppShell';

// Auth
import { LoginPage } from './auth/LoginPage';
import { SignupPage } from './auth/SignupPage';
import { EmailVerificationPage } from './auth/EmailVerificationPage';
import { PasswordResetPage } from './auth/PasswordResetPage';
import { TraderOnboarding } from './onboarding/TraderOnboarding';

// Shared
import { UnauthorizedPage } from './shared/UnauthorizedPage';
import { SuspendedPage } from './shared/SuspendedPage';
import { BannedPage } from './shared/BannedPage';
import { NotFoundPage } from './shared/NotFoundPage';
import LiveRoomPage from '../components/LiveRoomPage';
import SharedTradingChart from '../components/SharedTradingChart';
import { LiveKitDiagnosticsView } from '../components/LiveKitDiagnosticsView';

// Trader
import { TraderDashboard } from './trader/TraderDashboard';
import { MarketplaceView } from './trader/MarketplaceView';
import { CoachProfileView } from './trader/CoachProfileView';
import { FavoritesView } from './trader/FavoritesView';
import { LearningHubView } from './trader/LearningHubView';

// Coach
import { CoachDashboard } from './coach/CoachDashboard';
import { CoachEarningsView } from './coach/CoachEarningsView';

// Admin
import { AdminDashboard } from './admin/AdminDashboard';
import { AdminUsers } from './admin/AdminUsers';
import { AdminApplications } from './admin/AdminApplications';
import { AdminAnalytics } from './admin/AdminAnalytics';
import { DemoLab } from './admin/DemoLab';
import { DemoLabParticipantRoom } from './admin/DemoLabParticipantRoom';
import { CoachApplication } from './coach/apply/CoachApplication';
import { CoachApplicationStatus } from './coach/apply/CoachApplicationStatus';
import { SettingsView } from './shared/SettingsView';

// Moderator
import { ModeratorDashboard } from './moderator/ModeratorDashboard';

import { ProtectedRoute } from './guards';
import { QaEntryPage } from './qa/QaEntryPage';
import { MarketplacePreview } from './demo/MarketplacePreview';
import { AdminPreview } from './demo/AdminPreview';
import { AdminPreviewOperations } from './demo/AdminPreviewOperations';
import { SessionJourneyView } from './shared/SessionJourneyView';
import { CoachRequestsView } from './coach/CoachRequestsView';
import { SessionsListView } from './shared/SessionsListView';

const RootRedirect = () => {
  const { canonicalUser } = useAuthStore();
  if (!canonicalUser) return <Navigate to="/preview" replace />;
  if (canonicalUser.status === 'BANNED') return <Navigate to="/banned" replace />;
  if (canonicalUser.status === 'SUSPENDED') return <Navigate to="/suspended" replace />;
  
  switch (canonicalUser.role) {
    case 'TRADER': return <Navigate to="/app" replace />;
    case 'COACH': return <Navigate to="/coach" replace />;
    case 'ADMIN': return <Navigate to="/admin" replace />;
    case 'MODERATOR': return <Navigate to="/mod" replace />;
    default: return <Navigate to="/unauthorized" replace />;
  }
};

export const AppRouter = () => {
  const { loading, error } = useAuthStore();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground p-4">
        <h1 className="text-2xl font-bold text-destructive mb-2">Authentication Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/reset-password" element={<PasswordResetPage />} />
        <Route path="/qa" element={<QaEntryPage />} />
        <Route path="/preview" element={<MarketplacePreview />}>
          <Route index element={<TraderDashboard />} />
          <Route path="coaches" element={<MarketplaceView mode="directory" />} />
          <Route path="coach-now" element={<MarketplaceView mode="coach-now" />} />
          <Route path="coaches/:id" element={<CoachProfileView />} />
          <Route path="favorites" element={<FavoritesView />} />
          <Route path="learning" element={<LearningHubView />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="sessions" element={<SessionsListView />} />
          <Route path="sessions/:sessionId" element={<SessionJourneyView />} />
          <Route path="sessions/:sessionId/live" element={<LiveRoomPage />} />
        </Route>
        <Route path="/preview/coach" element={<MarketplacePreview role="COACH" />}>
          <Route index element={<CoachRequestsView />} />
          <Route path="dashboard" element={<CoachDashboard />} />
          <Route path="earnings" element={<CoachEarningsView />} />
          <Route path="sessions/:sessionId" element={<SessionJourneyView />} />
          <Route path="sessions/:sessionId/live" element={<LiveRoomPage />} />
        </Route>
        <Route path="/preview/admin" element={<AdminPreview />}>
          <Route index element={<AdminDashboard demoMode />} />
          <Route path="demo-lab" element={<AdminPreviewOperations section="demo-lab" />} />
          <Route path="users" element={<AdminDashboard demoMode initialTab="users" />} />
          <Route path="applications" element={<AdminApplications demoMode />} />
          <Route path="analytics" element={<AdminAnalytics demoMode />} />
          <Route path="sessions" element={<AdminPreviewOperations section="sessions" />} />
          <Route path="payments" element={<AdminPreviewOperations section="payments" />} />
          <Route path="moderation" element={<AdminDashboard demoMode initialTab="moderation" />} />
          <Route path="settings" element={<AdminPreviewOperations section="settings" />} />
        </Route>
        
        <Route 
          path="/onboarding" 
          element={
            <ProtectedRoute>
              <TraderOnboarding />
            </ProtectedRoute>
          } 
        />
        
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/suspended" element={<SuspendedPage />} />
        <Route path="/banned" element={<BannedPage />} />

        {/* TRADER ROUTES */}
        <Route 
          path="/app" 
          element={
            <ProtectedRoute allowedRoles={['TRADER']}>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<TraderDashboard />} />
          <Route path="coaches" element={<MarketplaceView mode="directory" />} />
          <Route path="coach-now" element={<MarketplaceView mode="coach-now" />} />
          <Route path="coaches/:id" element={<CoachProfileView />} />
          <Route path="favorites" element={<FavoritesView />} />
          <Route path="learning" element={<LearningHubView />} />
          <Route path="sessions" element={<SessionsListView />} />
          <Route path="sessions/:sessionId" element={<SessionJourneyView />} />

          <Route path="sessions/:sessionId/live" element={<LiveRoomPage />} />
          <Route path="sessions/:sessionId/chart" element={<SharedTradingChart />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="coach-application" element={<CoachApplicationStatus />} />
          {/* other trader routes */}
        </Route>

        <Route 
          path="/coach/apply" 
          element={
            <ProtectedRoute allowedRoles={['TRADER', 'COACH']}>
              <CoachApplication />
            </ProtectedRoute>
          }
        />

        {/* COACH ROUTES */}
        <Route 
          path="/coach" 
          element={
            <ProtectedRoute allowedRoles={['COACH']}>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<CoachDashboard />} />
          <Route path="requests" element={<CoachRequestsView />} />
          <Route path="students" element={<SessionsListView />} />
          <Route path="calendar" element={<SessionsListView />} />
          <Route path="earnings" element={<CoachEarningsView />} />
          <Route path="profile" element={<CoachDashboard />} />
          <Route path="sessions/:sessionId" element={<SessionJourneyView />} />
          <Route path="sessions/:sessionId/live" element={<LiveRoomPage />} />
          <Route path="sessions/:sessionId/chart" element={<SharedTradingChart />} />
          {/* other coach routes */}
        </Route>

        {/* MODERATOR ROUTES */}
        <Route 
          path="/mod" 
          element={
            <ProtectedRoute allowedRoles={['MODERATOR', 'ADMIN']}>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<ModeratorDashboard />} />
          <Route path="reports" element={<ModeratorDashboard />} />
          <Route path="disputes" element={<ModeratorDashboard />} />
          <Route path="operations" element={<AdminDashboard />} />
          <Route path="applications" element={<AdminApplications />} />
          {/* other mod routes */}
        </Route>

        {/* ADMIN ROUTES */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="sessions" element={<AdminAnalytics />} />
          <Route path="payments" element={<AdminAnalytics />} />
          <Route path="moderation" element={<ModeratorDashboard />} />
          <Route path="demo-lab" element={<DemoLab />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="diagnostics" element={<LiveKitDiagnosticsView />} />
          {/* other admin routes */}
        </Route>

        <Route path="/admin/demo-lab/participant/:role/:sessionId" element={<DemoLabParticipantRoom />} />
        <Route path="/demo-lab" element={<DemoLab />} />
        <Route path="/diagnostics" element={<LiveKitDiagnosticsView />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

