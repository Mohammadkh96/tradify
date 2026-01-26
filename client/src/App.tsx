import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import Pricing from "@/pages/Pricing";
import Landing from "@/pages/Landing";
import Journal from "@/pages/Journal";
import NewEntry from "@/pages/NewEntry";
import KnowledgeBase from "@/pages/KnowledgeBase";
import RiskCalculator from "@/pages/RiskCalculator";
import MT5Bridge from "@/pages/MT5Bridge";
import Profile from "@/pages/Profile";
import TradersHub from "@/pages/TradersHub";
import Auth from "@/pages/Auth";
import { MainLayout } from "@/components/MainLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { useQuery } from "@tanstack/react-query";

function Router() {
  const [location] = useLocation();
  const isLandingPage = location === "/";
  const isPricingPage = location === "/pricing";
  const isAuthPage = location === "/login" || location === "/signup";
  const isAdminRoute = location.startsWith("/admin");

  const { data: userRole, isLoading: isRoleLoading, error: authError } = useQuery<any>({
    queryKey: ["/api/user"],
    retry: false,
  });

  const isAdmin = userRole?.role === "OWNER" || userRole?.role === "ADMIN";
  const isUserLoggedIn = !!userRole;

  if (isRoleLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-mono tracking-widest uppercase">Initializing Secure Terminal...</div>;

  // Role-based entry flow: Redirect mohammad@admin.com directly to admin console
  if (isAdmin && (location === "/dashboard" || location === "/journal" || location === "/new-entry")) {
    return <Redirect to="/admin/overview" />;
  }

  if (isLandingPage && isUserLoggedIn && !isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  const content = (
    <Switch>
      <Route path="/login" component={Auth} />
      <Route path="/signup" component={Auth} />
      <Route path="/" component={Landing} />
      <Route path="/dashboard">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <Dashboard />}
      </Route>
      <Route path="/journal">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <Journal />}
      </Route>
      <Route path="/new-entry">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <NewEntry />}
      </Route>
      <Route path="/knowledge-base">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <KnowledgeBase />}
      </Route>
      <Route path="/risk">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <RiskCalculator />}
      </Route>
      <Route path="/mt5-bridge">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <MT5Bridge />}
      </Route>
      <Route path="/profile">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <Profile />}
      </Route>
      <Route path="/traders-hub">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <TradersHub />}
      </Route>
      <Route path="/pricing" component={Pricing} />
      
      {/* Admin Routes */}
      <Route path="/admin/overview" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminDashboard} />
      <Route path="/admin/access" component={AdminDashboard} />
      <Route path="/admin/subscriptions" component={AdminDashboard} />
      <Route path="/admin/mt5" component={AdminDashboard} />
      <Route path="/admin/audit-logs" component={AdminDashboard} />
      
      <Route component={NotFound} />
    </Switch>
  );

  if (isAuthPage || isLandingPage || isPricingPage) return content;

  if (isAdminRoute) {
    if (!isAdmin) return <Redirect to="/" />;
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <MainLayout>{content}</MainLayout>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
