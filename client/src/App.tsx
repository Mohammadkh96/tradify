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
import TradersHubTab from "@/components/TradersHubTab";
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

  const { data: userRole, isLoading: isRoleLoading } = useQuery<any>({
    queryKey: ["/api/user/role", localStorage.getItem("user_id")],
    queryFn: async () => {
      const userId = localStorage.getItem("user_id");
      const res = await fetch(`/api/user/role${userId ? `?userId=${userId}` : ""}`);
      return res.json();
    }
  });

  const isAdmin = userRole?.role === "OWNER" || userRole?.role === "ADMIN" || userRole?.userId === "mohammad@admin.com" || localStorage.getItem("user_id") === "mohammad@admin.com";

  if (isRoleLoading) return null;

  // Role-based entry flow: Redirect mohammad@admin.com directly to admin console
  if (isAdmin && (location === "/dashboard" || location === "/journal" || location === "/new-entry")) {
    return <Redirect to="/admin/overview" />;
  }

  const isUserLoggedIn = localStorage.getItem("user_id") !== null;
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
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <TradersHubTab />}
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
