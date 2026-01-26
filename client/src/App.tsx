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
import Billing from "@/pages/Billing";
import TradersHub from "@/pages/TradersHub";
import Auth from "@/pages/Auth";
import { MainLayout } from "@/components/MainLayout";
import { AdminLayout } from "@/components/AdminLayout";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import RiskDisclaimer from "@/pages/RiskDisclaimer";
import { useQuery } from "@tanstack/react-query";

function Router() {
  const [location] = useLocation();
  const isLandingPage = location === "/";
  const isPricingPage = location === "/pricing";
  const isAuthPage = location === "/login" || location === "/signup";
  const isPublicLegalPage = location === "/terms" || location === "/privacy" || location === "/risk";
  const isAdminRoute = location.startsWith("/admin");

  const { data: userRole, isLoading: isRoleLoading } = useQuery<any>({
    queryKey: ["/api/user"],
    retry: false,
  });

  const isAdmin = userRole?.role === "OWNER" || userRole?.role === "ADMIN";
  const isUserLoggedIn = !!userRole;

  if (isRoleLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-mono tracking-widest uppercase">Initializing Secure Terminal...</div>;

  // Security Redirects
  if (isUserLoggedIn && isAuthPage) {
    return <Redirect to="/dashboard" />;
  }

  const content = (
    <Switch>
      <Route path="/login" component={Auth} />
      <Route path="/signup" component={Auth} />
      <Route path="/register">
        <Redirect to="/signup" />
      </Route>
      <Route path="/" component={Landing} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/risk" component={RiskDisclaimer} />

      {/* Protected Routes */}
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
      <Route path="/billing">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <Billing />}
      </Route>
      <Route path="/traders-hub">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <TradersHub />}
      </Route>
      
      {/* Admin Routes */}
      <Route path="/admin/overview">
        {() => !isAdmin ? <Redirect to="/" /> : <AdminDashboard />}
      </Route>
      <Route path="/admin/users">
        {() => !isAdmin ? <Redirect to="/" /> : <AdminDashboard />}
      </Route>
      <Route path="/admin/access">
        {() => !isAdmin ? <Redirect to="/" /> : <AdminDashboard />}
      </Route>
      <Route path="/admin/subscriptions">
        {() => !isAdmin ? <Redirect to="/" /> : <AdminDashboard />}
      </Route>
      <Route path="/admin/mt5">
        {() => !isAdmin ? <Redirect to="/" /> : <AdminDashboard />}
      </Route>
      <Route path="/admin/audit-logs">
        {() => !isAdmin ? <Redirect to="/" /> : <AdminDashboard />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );

  if (isAuthPage || isLandingPage || isPricingPage || isPublicLegalPage) return content;

  if (isAdminRoute) {
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
