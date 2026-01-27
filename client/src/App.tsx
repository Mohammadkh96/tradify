import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
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
import Checkout from "@/pages/Checkout";
import TradersHub from "@/pages/TradersHub";
import Auth from "@/pages/Auth";
import { MainLayout } from "@/components/MainLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { PublicNavbar } from "@/components/PublicNavbar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import RiskDisclaimer from "@/pages/RiskDisclaimer";
import { useQuery } from "@tanstack/react-query";

function Router() {
  const [location] = useLocation();
  const isLandingPage = location === "/";
  const isPricingPage = location === "/pricing";
  const isAuthPage = location === "/login" || location === "/signup";
  const isPublicLegalPage = location === "/terms" || location === "/privacy" || location === "/risk-disclaimer";
  const isAdminRoute = location.startsWith("/admin");

  const { data: userRole, isLoading: isRoleLoading, isError: isRoleError } = useQuery<any>({
    queryKey: ["/api/user"],
    retry: false,
    staleTime: Infinity, // Prevent constant refetching during session
  });

  const isAdmin = userRole?.role === "OWNER" || userRole?.role === "ADMIN";
  const isUserLoggedIn = !!userRole;

  // Only show loading screen for protected routes or if we haven't decided if it's public yet
  const isPublicPage = isLandingPage || isPricingPage || isAuthPage || isPublicLegalPage || 
                       location === "/features" || location === "/how-it-works" || location === "/resources";

  if (isRoleLoading && !isPublicPage) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-mono tracking-widest uppercase">Initializing Secure Terminal...</div>;
  }

  if (isRoleError && !isPublicPage) {
    return <Redirect to="/login" />;
  }

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
      <Route path="/risk-disclaimer" component={RiskDisclaimer} />
      <Route path="/features" component={() => (
        <div className="min-h-screen bg-background pt-20">
          <PublicNavbar />
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic text-foreground mb-6">
                Built for Clarity, Discipline, <br /> and Long-Term Performance
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Tradify helps traders understand how they trade, why results change, and where discipline breaks down — without signals, predictions, or execution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight text-emerald-500 mb-4 italic">Trade Visualization</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-foreground">Entries & Exits on Price Charts</h4>
                      <p className="text-sm text-muted-foreground mt-1">Review every executed trade directly on price charts to evaluate timing, execution quality, and structure.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">P&L Calendar</h4>
                      <p className="text-sm text-muted-foreground mt-1">Track profit and loss by day, week, and month to uncover performance patterns and behavioral cycles.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight text-emerald-500 mb-4 italic">Performance Analytics</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-foreground">Advanced Performance Analytics</h4>
                      <p className="text-sm text-muted-foreground mt-1 italic mb-2">Analyze results across key dimensions:</p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                        <li>Win rate and expectancy</li>
                        <li>Drawdowns and volatility</li>
                        <li>Risk-to-reward consistency</li>
                        <li>Performance over time</li>
                      </ul>
                      <p className="text-[10px] uppercase tracking-widest font-black text-emerald-500/50 mt-4">Designed to reveal patterns, not promises.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Session & Context Analysis</h4>
                      <p className="text-sm text-muted-foreground mt-1">Understand how performance varies across trading sessions and market conditions.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight text-emerald-500 mb-4 italic">Behavioral Insights</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-foreground">Behavioral Pattern Detection (AI)</h4>
                      <p className="text-sm text-muted-foreground mt-1 italic mb-2">Identify behaviors that impact performance, such as:</p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                        <li>Overtrading</li>
                        <li>Risk escalation</li>
                        <li>Inconsistent position sizing</li>
                        <li>Discipline breakdowns</li>
                      </ul>
                      <p className="text-[10px] uppercase tracking-widest font-black text-emerald-500/50 mt-4">Insights are explanatory, never predictive or directive.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight text-emerald-500 mb-4 italic">Smart Journaling</h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-foreground">Automated Trading Journal</h4>
                      <p className="text-sm text-muted-foreground mt-1 italic mb-2">Trades are logged automatically, with support for:</p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                        <li>Notes and reflections</li>
                        <li>Strategy and session tags</li>
                        <li>Contextual review</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">Trade Sharing & Exports</h4>
                      <p className="text-sm text-muted-foreground mt-1">Export or share trade summaries and performance snapshots when needed.</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-muted rounded-2xl border border-border">
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-2">Market Context</h4>
                  <p className="font-bold text-foreground mb-2">Institutional Knowledge Base</p>
                  <p className="text-sm text-muted-foreground">Access clear explanations of professional trading concepts, risk frameworks, and market behavior — written to improve understanding, not encourage speculation.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )} />
      <Route path="/how-it-works" component={() => (
        <div className="min-h-screen bg-background pt-20">
          <PublicNavbar />
          <div className="max-w-4xl mx-auto px-6 py-20">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic text-foreground mb-6">
                A Simple Workflow
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg uppercase tracking-widest font-bold">
                That Fits Your Trading Process
              </p>
              <p className="text-sm text-muted-foreground mt-4 italic">
                Tradify integrates into your existing workflow without changing how you trade.
              </p>
            </div>

            <div className="space-y-16 relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border md:left-1/2" />
              
              <div className="relative flex items-center md:justify-between group">
                <div className="hidden md:block w-5/12" />
                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black z-10">1</div>
                <div className="ml-12 md:ml-0 md:w-5/12 bg-card p-6 rounded-2xl border border-border">
                  <h4 className="font-black uppercase tracking-widest text-xs text-emerald-500 mb-2">Step One</h4>
                  <h3 className="text-xl font-bold text-foreground mb-4">Connect Your Trading Account</h3>
                  <p className="text-sm text-muted-foreground">Securely connect your trading account to Tradify. Tradify is read-only. It never places trades, modifies orders, or interferes with execution.</p>
                </div>
              </div>

              <div className="relative flex items-center md:justify-between group">
                <div className="ml-12 md:ml-0 md:w-5/12 bg-card p-6 rounded-2xl border border-border order-2 md:order-1">
                  <h4 className="font-black uppercase tracking-widest text-xs text-emerald-500 mb-2">Step Two</h4>
                  <h3 className="text-xl font-bold text-foreground mb-4">Your Trading Data Is Analyzed</h3>
                  <p className="text-sm text-muted-foreground italic mb-3">Tradify processes your activity to evaluate:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc ml-4">
                    <li>Performance metrics</li>
                    <li>Risk behavior</li>
                    <li>Consistency and discipline</li>
                    <li>Session and contextual impact</li>
                  </ul>
                  <p className="text-[10px] uppercase tracking-widest font-black text-emerald-500/50 mt-4">There are no signals, recommendations, or forecasts.</p>
                </div>
                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black z-10 order-1 md:order-2">2</div>
                <div className="hidden md:block w-5/12 order-3" />
              </div>

              <div className="relative flex items-center md:justify-between group">
                <div className="hidden md:block w-5/12" />
                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black z-10">3</div>
                <div className="ml-12 md:ml-0 md:w-5/12 bg-card p-6 rounded-2xl border border-border">
                  <h4 className="font-black uppercase tracking-widest text-xs text-emerald-500 mb-2">Step Three</h4>
                  <h3 className="text-xl font-bold text-foreground mb-4">Insights Are Generated</h3>
                  <p className="text-sm text-muted-foreground">Tradify highlights what contributes positively to performance and what introduces unnecessary risk. Each insight focuses on cause and effect, not future price direction.</p>
                </div>
              </div>

              <div className="relative flex items-center md:justify-between group">
                <div className="ml-12 md:ml-0 md:w-5/12 bg-card p-6 rounded-2xl border border-border order-2 md:order-1">
                  <h4 className="font-black uppercase tracking-widest text-xs text-emerald-500 mb-2">Step Four</h4>
                  <h3 className="text-xl font-bold text-foreground mb-4">Review, Reflect, Improve</h3>
                  <p className="text-sm text-muted-foreground">Use analytics, charts, and journaling to review performance objectively and improve decision-making gradually. Progress is measured, not assumed.</p>
                </div>
                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black z-10 order-1 md:order-2">4</div>
                <div className="hidden md:block w-5/12 order-3" />
              </div>
            </div>

            <div className="mt-24 p-8 bg-emerald-500/5 rounded-3xl border border-emerald-500/20 text-center">
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-foreground mb-4">What Tradify Is Not</h3>
              <div className="flex flex-wrap justify-center gap-6">
                {['Not a signal service', 'Not copy trading', 'Not automated execution'].map(item => (
                  <div key={item} className="px-4 py-2 bg-background border border-border rounded-full text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-8 text-sm text-muted-foreground font-bold uppercase tracking-widest">Tradify is a decision-support and discipline platform.</p>
            </div>
          </div>
        </div>
      )} />
      <Route path="/resources" component={() => (
        <div className="min-h-screen bg-background pt-20">
          <PublicNavbar />
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic text-foreground mb-6">
                Intelligence & Support
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Resources designed to help traders understand markets, behavior, and risk with clarity and objectivity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-500">Knowledge Base</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground italic">Clear, structured explanations covering:</p>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Risk management principles</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Trading psychology and discipline</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Market structure concepts</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Performance evaluation methods</li>
                  </ul>
                  <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/50 pt-4">Written without hype or promises.</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-500">Discipline Guides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground italic">Practical guides focused on:</p>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Avoiding overtrading</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Managing drawdowns</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Improving consistency</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Conducting trade reviews</li>
                  </ul>
                  <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/50 pt-4">Built for long-term improvement.</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-500">FAQ & Support</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground italic">Common inquiries about:</p>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Account connections</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Data privacy and security</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> AI usage boundaries</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Plans and pricing</li>
                  </ul>
                  <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/50 pt-4">Transparency is a priority.</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-8 bg-muted rounded-2xl border border-border">
                <h3 className="text-xl font-bold text-foreground mb-4">Security & Data Transparency</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Learn how Tradify protects user data, enforces read-only integrations, handles AI responsibly, and avoids conflicts of interest. Support is focused on clarity, accuracy, and trust.
                </p>
              </div>
              <div className="p-8 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 flex flex-col justify-center">
                <div className="flex gap-4 mb-4">
                  <div className="px-3 py-1 bg-background border border-border rounded-full text-[10px] font-black uppercase tracking-widest text-rose-500">No profit guarantees</div>
                  <div className="px-3 py-1 bg-background border border-border rounded-full text-[10px] font-black uppercase tracking-widest text-rose-500">No predictive language</div>
                </div>
                <p className="text-sm text-muted-foreground italic font-medium">
                  "This content is intentionally calm, professional, and credible — aligned with Tradify’s long-term vision."
                </p>
              </div>
            </div>
          </div>
        </div>
      )} />

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
      <Route path="/calculator">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <RiskCalculator />}
      </Route>
      <Route path="/mt5-bridge">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <MT5Bridge />}
      </Route>
      <Route path="/profile">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <Profile />}
      </Route>
      <Route path="/checkout">
        {() => !isUserLoggedIn ? <Redirect to="/login" /> : <Checkout />}
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

  if (isAuthPage || isLandingPage || isPublicLegalPage) return content;

  if (isAdminRoute) {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <MainLayout>{content}</MainLayout>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="tradify-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
