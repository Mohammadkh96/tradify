import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import Pricing from "@/pages/Pricing";
import Journal from "@/pages/Journal";
import NewEntry from "@/pages/NewEntry";
import KnowledgeBase from "@/pages/KnowledgeBase";
import RiskCalculator from "@/pages/RiskCalculator";
import MT5Bridge from "@/pages/MT5Bridge";
import TradersHubTab from "@/components/TradersHubTab";
import Auth from "@/pages/Auth";
import { MainLayout } from "@/components/MainLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { useQuery } from "@tanstack/react-query";

function Router() {
  const [location] = useLocation();
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
  if (isAdmin && (location === "/" || location === "/dashboard" || location === "/journal" || location === "/new-entry")) {
    return <Redirect to="/admin/overview" />;
  }

  const content = (
    <Switch>
      <Route path="/login" component={Auth} />
      <Route path="/signup" component={Auth} />
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/journal" component={Journal} />
      <Route path="/new-entry" component={NewEntry} />
      <Route path="/knowledge-base" component={KnowledgeBase} />
      <Route path="/risk" component={RiskCalculator} />
      <Route path="/mt5-bridge" component={MT5Bridge} />
      <Route path="/traders-hub" component={TradersHubTab} />
      <Route path="/pricing" component={Pricing} />
      
      {/* Admin Routes */}
      <Route path="/admin/overview" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminDashboard} />
      <Route path="/admin/subscriptions" component={AdminDashboard} />
      <Route path="/admin/mt5" component={AdminDashboard} />
      <Route path="/admin/audit-logs" component={AdminDashboard} />
      
      <Route component={NotFound} />
    </Switch>
  );

  if (isAuthPage) return content;

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
