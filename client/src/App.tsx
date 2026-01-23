import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Journal from "@/pages/Journal";
import NewEntry from "@/pages/NewEntry";
import KnowledgeBase from "@/pages/KnowledgeBase";
import RiskCalculator from "@/pages/RiskCalculator";
import MT5Bridge from "@/pages/MT5Bridge";
import TradersHubTab from "@/components/TradersHubTab";
import Auth from "@/pages/Auth";
import { MainLayout } from "@/components/MainLayout";

function Router() {
  const [location] = useLocation();
  const isAuthPage = location === "/login" || location === "/signup";

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
      <Route component={NotFound} />
    </Switch>
  );

  if (isAuthPage) return content;

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
