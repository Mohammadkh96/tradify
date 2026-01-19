import { Switch, Route } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/journal" component={Journal} />
      <Route path="/new-entry" component={NewEntry} />
      <Route path="/knowledge" component={KnowledgeBase} />
      <Route path="/risk" component={RiskCalculator} />
      <Route path="/mt5" component={MT5Bridge} />
      <Route component={NotFound} />
    </Switch>
  );
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
