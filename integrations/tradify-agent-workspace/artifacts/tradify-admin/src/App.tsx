import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, FormEvent, ReactNode } from "react";
import { MutationCache, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from "wouter";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Command,
  FileSearch,
  Filter,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  Signal,
  SlidersHorizontal,
  Users,
  X,
  Boxes,
  Workflow,
  History,
  UserCog,
  Plus,
  Save,
  Archive,
  Pause,
  LockKeyhole,
  Scale,
  RotateCcw,
  Bell,
  Send,
} from "lucide-react";
import {
  getGetAdminAuditLogQueryKey,
  getGetAdminBillingTransferHandoffQueryKey,
  getGetAdminBillingTransfersQueryKey,
  getGetAdminRevenueCatPriceSummaryQueryKey,
  getGetAdminControlsQueryKey,
  getGetAdminCrmAuditLogsQueryKey,
  getGetAdminDiagnosticCandlesQueryKey,
  getGetAdminDiagnosticsQueryKey,
  getGetAdminAssignmentsQueryKey,
  getGetAdminEvaluationsQueryKey,
  getGetAdminEvaluationQueryKey,
  getGetAdminLabQueryKey,
  getGetAdminOperationsHealthQueryKey,
  getGetAdminOverviewQueryKey,
  getGetAdminSessionQueryKey,
  getGetAdminStrategiesQueryKey,
  getGetAdminSymbolsQueryKey,
  getGetAdminStaffQueryKey,
  getGetAdminUserAuditLogsQueryKey,
  getGetAdminMarketInventoryQueryKey,
  getGetAdminUserDetailQueryKey,
  getGetAdminUserNotesQueryKey,
  getGetAdminUserTradesQueryKey,
  getGetAdminUsersQueryKey,
  getGetSignalDiagnosticQueryKey,
  getGetSignalEvaluationQueryKey,
  getGetAdminAccessPolicyQueryKey,
  getGetAdminNotificationsQueryKey,
  useGetAdminAccessPolicy,
  useGetAdminNotifications,
  useRetryAdminNotification,
  useUpdateAdminAccessPolicy,
  useAddAdminUserNote,
  useCreateAdminSession,
  useGetAdminAuditLog,
  useGetAdminBillingTransferHandoff,
  useGetAdminBillingTransfers,
  useGetAdminRevenueCatPriceSummary,
  useGetAdminControls,
  useGetAdminCrmAuditLogs,
  useGetAdminCrmSummary,
  useGetAdminDiagnosticCandles,
  useGetAdminDiagnostics,
  useGetAdminLab,
  useGetAdminMarketInventory,
  useGetAdminSymbols,
  useUpdateAdminSymbol,
  useGetAdminAssignments,
  useCreateAdminAssignment,
  useUpdateAdminAssignment,
  useUpdateAdminStrategy,
  useGetAdminEvaluations,
  useGetAdminEvaluation,
  useGetAdminStaff,
  useCreateAdminStaff,
  useUpdateAdminStaff,
  useGetAdminOperationsHealth,
  useGetAdminOverview,
  useGetAdminSession,
  useGetAdminEngineStatus,
  useGetAdminStrategies,
  useGetAdminUserAuditLogs,
  useGetAdminUserDetail,
  useGetAdminUserNotes,
  useGetAdminUserTrades,
  useGetAdminUsers,
  useGetSignalDiagnostic,
  useGetSignalEvaluation,
  useLogoutAdminSession,
  usePauseAdminEngine,
  useResumeAdminEngine,
  useUpdateAdminMarket,
  useUpdateAdminMarketStrategies,
  useUpdateAdminUser,
  useUpdateAdminUserAccountState,
  useUpdateAdminUserEntitlements,
  useUpdateAdminUserMembership,
  useRequestAdminUserPasswordReset,
  useRequestPasswordReset,
  useCompletePasswordReset,
} from "@workspace/api-client-react";
import type {
  AdminAuditEntry,
  AdminMarketControl,
  AdminOverview,
  AdminStrategy,
  AdminUser,
  AdminUserDetail,
  MarketCandles,
  AdminMarketInventoryItem,
  AdminStrategyAssignment,
  AdminEvaluation,
  AdminUserNote,
  StaffAccessSummary,
  GetAdminUsersParams,
  GetSignalEvaluationParams,
  GetAdminEvaluationsParams,
  AdminAccessPolicy,
  AdminAccessPolicyUpdate,
  CustomerMembershipTier,
  AdminNotificationDelivery,
  GetAdminNotificationsParams,
} from "@workspace/api-client-react";
import { AdminActionDialogProvider, useAdminActionDialog } from "@/components/AdminActionDialog";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "sonner";

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true } },
  mutationCache: new MutationCache({
    onMutate: (_variables, mutation) => {
      toast.loading("Request in progress", {
        id: `admin-mutation-${mutation.mutationId}`,
        duration: Infinity,
      });
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      toast.success("Request completed", {
        id: `admin-mutation-${mutation.mutationId}`,
        duration: 2600,
      });
    },
    onError: (error, _variables, _context, mutation) => {
      toast.error(getError(error), {
        id: `admin-mutation-${mutation.mutationId}`,
        duration: 5000,
      });
    },
  }),
});
const NAV = [
  { href: "/", label: "Operations", icon: LayoutDashboard, group: "Workspace" },
  { href: "/users", label: "Customers", icon: Users, group: "Workspace", capability: "users.read" },
  {
    href: "/controls",
    label: "Runtime controls",
    icon: SlidersHorizontal,
    group: "Market operations",
  },
  { href: "/market-data", label: "Market data", icon: Activity, group: "Market operations" },
  { href: "/signals", label: "Signal diagnostics", icon: Signal, group: "Market operations" },
  {
    href: "/symbols",
    label: "Symbols",
    icon: Boxes,
    group: "Market operations",
    capability: "symbols.read",
  },
  {
    href: "/strategies",
    label: "Strategies",
    icon: Workflow,
    group: "Market operations",
    capability: "strategies.read",
  },
  {
    href: "/assignments",
    label: "Assignments",
    icon: SlidersHorizontal,
    group: "Market operations",
    capability: "strategies.read",
  },
  {
    href: "/evaluations",
    label: "Evaluation history",
    icon: History,
    group: "Market operations",
    capability: "signals.read",
  },
  {
    href: "/diagnostics",
    label: "Market diagnostics",
    icon: Gauge,
    group: "Market operations",
    capability: "market_data.read",
  },
  {
    href: "/billing",
    label: "Billing transfers",
    icon: Banknote,
    group: "Administration",
    capability: "payments.read",
  },
  {
    href: "/audit",
    label: "Audit history",
    icon: ClipboardList,
    group: "Administration",
    capability: "audit.read",
  },
  {
    href: "/staff",
    label: "Staff access",
    icon: UserCog,
    group: "Administration",
    capability: "staff.read",
  },
  {
    href: "/access-policy",
    label: "Access policy",
    icon: LockKeyhole,
    group: "Administration",
    capability: "memberships.read",
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Bell,
    group: "Administration",
    capability: "notifications.read",
  },
];
const fmtDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "Not reported";
const valueText = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? "Not reported"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
const statusTone = (value?: string) =>
  ["ACTIVE", "active", "HEALTHY", "LIVE", "connected", "healthy"].includes(value || "")
    ? "good"
    : [
          "PAUSED_MANUAL",
          "PAUSED_DEGRADED",
          "suspended",
          "banned",
          "STALE",
          "ERROR",
          "FALLBACK",
          "DISCONNECTED",
        ].includes(value || "")
      ? "warn"
      : "neutral";
const getError = (error: unknown) =>
  error instanceof Error ? error.message : "The request could not be completed.";
const hasCapability = (capabilities: string[] | undefined, capability: string) =>
  !!capabilities?.includes(capability) || !!capabilities?.includes("*");
type CustomerEditKind =
  "display-name" | "membership" | "status" | "entitlements" | "restore-membership";
type CustomerAccountStatus = "active" | "suspended" | "banned";

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`pill pill-${tone}`} data-testid="status-pill">
      {children}
    </span>
  );
}
function Panel({ children, className = "", ...sectionProps }: ComponentProps<"section">) {
  return (
    <section {...sectionProps} className={`panel ${className}`}>
      {children}
    </section>
  );
}
function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} · Tradify Admin`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) {
      description.content = `${title} — private Tradify Signals staff operations console.`;
    }
  }, [title]);
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 tabIndex={-1}>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}
function LoadState({
  error,
  loading,
  onRetry,
}: {
  error?: unknown;
  loading?: boolean;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <div className="stack">
        {[1, 2, 3].map((n) => (
          <div className="skeleton load-row" key={n} />
        ))}
      </div>
    );
  if (error)
    return (
      <div className="notice notice-warn" role="alert">
        <AlertTriangle size={18} />
        <div>
          <strong>Could not load this data</strong>
          <p>{getError(error)}</p>
          {onRetry && (
            <button className="text-button" onClick={onRetry}>
              Retry request
            </button>
          )}
        </div>
      </div>
    );
  return null;
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <FileSearch size={20} />
      </div>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: unknown;
  note?: string;
  icon: typeof Activity;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <strong>{valueText(value)}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="icon-button"
      aria-label="Refresh data"
      onClick={onClick}
      data-testid="button-refresh"
    >
      <RefreshCw size={16} />
    </button>
  );
}
function InventoryField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="inventory-field">
      <span>{label}</span>
      <strong>{value ?? "Not reported"}</strong>
    </div>
  );
}
const brokerWeekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const formatBrokerClock = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
};
const brokerSessionDay = (day: number) => brokerWeekdays[day] ?? `Day ${day}`;

function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} · Tradify Admin`;
    const metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (metaDescription) {
      metaDescription.content = `${description} Private staff access for Tradify Signals operations.`;
    }
  }, [description, title]);
  return (
    <main className="login-page">
      <div className="login-aside">
        <div className="brand-lockup">
          <span className="brand-symbol">
            <Activity size={19} />
          </span>
          <span>
            tradify<span className="brand-light"> / admin</span>
          </span>
        </div>
        <div className="login-story">
          <div className="eyebrow">OPERATIONS DESK · STAFF ONLY</div>
          <h1>
            Trust the feed.
            <br />
            <em>Verify the rest.</em>
          </h1>
          <p>
            A clear line of sight into the engine, market authority and account state behind Tradify
            Signals.
          </p>
        </div>
        <div className="login-foot">
          <span className="live-dot" /> Protected staff access <span className="separator">/</span>{" "}
          Session expires after 8 hours
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-card">
          <div className="eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
          {children}
        </div>
      </div>
    </main>
  );
}

function Login() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const signIn = useCreateAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    signIn.mutate(
      { data: { email, password } },
      {
        onSuccess: (response) => {
          queryClient.clear();
          queryClient.setQueryData(getGetAdminSessionQueryKey(), response);
          setLocation("/");
        },
        onError: (failure) => setError(getError(failure)),
      },
    );
  };
  return (
    <AuthLayout
      eyebrow="SECURE CONSOLE"
      title="Sign in to Tradify"
      description="Use your authorized staff account to continue."
    >
      {error && (
        <div className="notice notice-warn" role="alert">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={submit} className="form-stack">
        <label>
          Staff email
          <input
            data-testid="input-staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
              maxLength={320}
            required
          />
        </label>
        <label>
          Password
          <input
            data-testid="input-staff-password"
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button
          className="button button-primary button-wide"
          disabled={signIn.isPending}
          data-testid="button-staff-signin"
        >
          {signIn.isPending ? "Verifying access…" : "Continue securely"}
          <ChevronRight size={17} />
        </button>
      </form>
      <Link href="/forgot-password" className="text-button">
        Forgot your password?
      </Link>
      <div className="login-security">
        <Shield size={16} />
        <span>Session protected by a secure, HttpOnly cookie. No public registration.</span>
      </div>
    </AuthLayout>
  );
}

function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    requestReset.mutate(
      { data: { email } },
      {
        onSuccess: () => setSubmitted(true),
        onError: (failure) => setError(getError(failure)),
      },
    );
  };
  return (
    <AuthLayout
      eyebrow="ACCOUNT RECOVERY"
      title="Reset your password"
      description="Enter your Tradify account email address to request a secure reset link."
    >
      {submitted ? (
        <div className="notice notice-info" role="status">
          If an active account matches that email, a reset link will be sent.
        </div>
      ) : (
        <>
          {error && (
            <div className="notice notice-warn" role="alert">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={submit} className="form-stack">
            <label>
              Account email
              <input
                data-testid="input-reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                maxLength={320}
                aria-describedby="input-reset-email-help"
                required
              />
              <small id="input-reset-email-help" className="field-help">
                We will not reveal whether an account exists for this address.
              </small>
            </label>
            <button
              className="button button-primary button-wide"
              disabled={requestReset.isPending}
              data-testid="button-request-reset"
            >
              {requestReset.isPending ? "Sending request…" : "Send reset link"}
              <ChevronRight size={17} />
            </button>
          </form>
        </>
      )}
      <Link href="/login" className="text-button">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}

function ResetPasswordPage() {
  const completeReset = useCompletePasswordReset();
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const validTokenShape = /^[A-Za-z0-9_-]{43}$/.test(token);
  const passwordsMismatch = !!confirmation && password !== confirmation;

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    completeReset.mutate(
      { data: { token, password } },
      {
        onSuccess: () => {
          setPassword("");
          setConfirmation("");
          setCompleted(true);
        },
        onError: (failure) => setError(getError(failure)),
      },
    );
  };

  return (
    <AuthLayout
      eyebrow="ACCOUNT RECOVERY"
      title={completed ? "Password updated" : "Choose a new password"}
      description={
        completed
          ? "Your existing sessions have been signed out."
          : "Use a new password with at least 12 characters."
      }
    >
      {completed ? (
        <div className="notice notice-info" role="status">
          Your password was changed. Sign in with the new password to continue.
        </div>
      ) : !validTokenShape ? (
        <div className="notice notice-warn" role="alert">
          This reset link is invalid or incomplete. Request a new link to continue.
        </div>
      ) : (
        <>
          {error && (
            <div className="notice notice-warn" role="alert">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={submit} className="form-stack">
            <label>
              New password
              <input
                data-testid="input-new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                data-testid="input-confirm-password"
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                aria-invalid={passwordsMismatch}
                aria-describedby={passwordsMismatch ? "confirm-password-error" : undefined}
                required
              />
              {passwordsMismatch && (
                <small id="confirm-password-error" className="field-error" role="alert">
                  Passwords must match.
                </small>
              )}
            </label>
            <button
              className="button button-primary button-wide"
              disabled={completeReset.isPending}
              data-testid="button-complete-reset"
            >
              {completeReset.isPending ? "Updating password…" : "Update password"}
              <ChevronRight size={17} />
            </button>
          </form>
        </>
      )}
      {completed ? (
        <Link href="/login" className="text-button">
          Return to sign in
        </Link>
      ) : (
        <Link href="/forgot-password" className="text-button">
          Request a new reset link
        </Link>
      )}
    </AuthLayout>
  );
}

function AppShell({
  user,
  capabilities,
  children,
}: {
  user: Pick<AdminUser, "name" | "email"> | undefined;
  capabilities: string[];
  children: ReactNode;
}) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogoutAdminSession();
  const [, setLocation] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const mobileMenuRef = useRef<HTMLButtonElement>(null);
  const closeMobileNavigation = () => {
    setMobileNav(false);
    if (window.matchMedia("(max-width: 767px)").matches) {
      window.setTimeout(() => document.querySelector<HTMLElement>(".page-header h1")?.focus(), 0);
    }
  };
  useEffect(() => {
    if (!mobileNav) return;
    document.getElementById("admin-primary-navigation")?.querySelector<HTMLElement>("a")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNav(false);
        mobileMenuRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileNav]);
  const signOut = () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
      onError: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  return (
    <div className="app-shell">
      <aside
        id="admin-primary-navigation"
        className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}
        aria-label="Primary navigation"
      >
        <Link href="/" className="brand-lockup" onClick={closeMobileNavigation}>
          <span className="brand-symbol">
            <Activity size={18} />
          </span>
          <span>
            tradify<span className="brand-light"> / admin</span>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-dot" /> LIVE OPERATIONS
        </div>
        <nav aria-label="Console sections">
          {["Workspace", "Market operations", "Administration"].map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-heading">{group}</div>
              {NAV.filter(
                (item) =>
                  item.group === group &&
                  (!item.capability || hasCapability(capabilities, item.capability)),
              ).map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/" ? location === "/" : location === href || location.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`nav-link ${active ? "nav-active" : ""}`}
                    onClick={closeMobileNavigation}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {active && <span className="nav-marker" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-state">
            <span className="state-glyph">
              <Shield size={16} />
            </span>
            <div>
              <strong>Staff session</strong>
              <small>Server-authorized</small>
            </div>
            <span className="session-dot" />
          </div>
          <button className="nav-link signout" onClick={signOut} disabled={logout.isPending}>
            <LogOut size={17} />
            {logout.isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => {
            setMobileNav(false);
            mobileMenuRef.current?.focus();
          }}
        />
      )}
      <main className="main-area">
        <div className="topbar">
          <button
            ref={mobileMenuRef}
            className="mobile-menu"
            aria-label={mobileNav ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNav}
            aria-controls="admin-primary-navigation"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={19} />
          </button>
          <div className="crumb">
            <span>TRADIFY</span>
            <span className="crumb-slash">/</span>
            <strong>ADMIN CONSOLE</strong>
          </div>
          <div className="topbar-right">
            <span className="top-live">
              <i /> Protected workspace
            </span>
            <span className="top-user">{user?.name || user?.email || "Staff"}</span>
            <span className="avatar">
              {(user?.name || user?.email || "S").slice(0, 1).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="page-wrap page-in">{children}</div>
        <footer className="app-footer">
          <span>TRADIFY ADMIN</span>
          <span>Trusted-data controls remain authoritative on the server.</span>
          <span className="font-mono-ui">STAFF / 08H SESSION</span>
        </footer>
      </main>
    </div>
  );
}

function OverviewPage() {
  const qc = useQueryClient();
  const openActionDialog = useAdminActionDialog();
  const overview = useGetAdminOverview({
    query: { queryKey: getGetAdminOverviewQueryKey(), refetchInterval: 30000 },
  });
  const health = useGetAdminOperationsHealth({
    query: { queryKey: getGetAdminOperationsHealthQueryKey(), refetchInterval: 30000 },
  });
  const engine = useGetAdminEngineStatus({
    query: { queryKey: ["/api/admin/engine/status"], refetchInterval: 15000 },
  });
  const pause = usePauseAdminEngine();
  const resume = useResumeAdminEngine();
  const data = overview.data as AdminOverview | undefined;
  const engineData = engine.data || data?.engine;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
    qc.invalidateQueries({ queryKey: getGetAdminOperationsHealthQueryKey() });
  };
  const toggleEngine = async () => {
    if (!engineData) return;
    if (engineData.mode === "ACTIVE") {
      const values = await openActionDialog({
        title: "Pause trusted signal generation",
        description:
          "New trusted signals will stop until the engine is resumed. Provide an audit reason to confirm this change.",
        fields: [
          {
            name: "reason",
            label: "Audit reason",
            type: "textarea",
            required: true,
            placeholder: "Why is the engine being paused?",
          },
        ],
        submitLabel: "Pause engine",
        intent: "destructive",
      });
      if (!values) return;
      pause.mutate(
        { data: { reason: values.reason.trim(), version: engineData.version } },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
            qc.invalidateQueries({ queryKey: ["/api/admin/engine/status"] });
          },
        },
      );
    } else {
      const values = await openActionDialog({
        title: "Resume trusted signal generation?",
        description: "Signal generation will resume. Server-side validation gates remain in force.",
        fields: [],
        submitLabel: "Resume engine",
      });
      if (!values) return;
      resume.mutate(
        { data: { version: engineData.version } },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
            qc.invalidateQueries({ queryKey: ["/api/admin/engine/status"] });
          },
        },
      );
    }
  };
  const err = overview.error || engine.error || health.error;
  const pending = pause.isPending || resume.isPending;
  const jsonSection = (obj: unknown) =>
    obj && typeof obj === "object" ? Object.entries(obj as Record<string, unknown>) : [];
  return (
    <>
      <PageHeader
        eyebrow="OPERATIONAL OVERVIEW"
        title="System status"
        sub="A live view of the trusted signals pipeline."
        actions={
          <>
            <span className="refresh-label">Refreshes every 30 seconds</span>
            <RetryButton onClick={refresh} />
          </>
        }
      />
      <LoadState loading={overview.isLoading || engine.isLoading} error={err} onRetry={refresh} />
      {data && (
        <>
          <div className="hero-status">
            <div className="hero-status-main">
              <div className="eyebrow">ENGINE CONTROL</div>
              <div className="engine-line">
                <span className={`engine-beacon ${statusTone(engineData?.mode)}`} />
                <h2>{engineData?.mode?.replaceAll("_", " ") || "Status not reported"}</h2>
                <Pill tone={statusTone(engineData?.mode)}>{engineData?.mode || "UNKNOWN"}</Pill>
              </div>
              <p>{engineData?.reason || "No pause reason reported by the server."}</p>
              <div className="engine-meta">
                <span>
                  <Clock3 size={14} /> Updated {fmtDate(engineData?.updatedAt)}
                </span>
                <span>by {engineData?.updatedBy || "Not reported"}</span>
                <span className="font-mono-ui">REV {engineData?.version ?? "—"}</span>
              </div>
            </div>
            <button
              className={`button ${engineData?.mode === "ACTIVE" ? "button-danger" : "button-primary"}`}
              onClick={toggleEngine}
              disabled={!engineData || pending}
              data-testid="button-engine-toggle"
            >
              {pending
                ? "Applying…"
                : engineData?.mode === "ACTIVE"
                  ? "Pause engine"
                  : "Resume engine"}
            </button>
          </div>
          <div className="metric-grid">
            <Metric
              label="Bridge connection"
              value={valueText((data.bridge as Record<string, unknown>)?.connected)}
              note="Reported bridge state"
              icon={Activity}
            />
            <Metric
              label="Market catalog"
              value={data.catalogSize}
              note="Registered instruments"
              icon={BarChart3}
            />
            <Metric
              label="Health report"
              value={health.data ? "Available" : data.health ? "Partial" : "Unreported"}
              note={health.data ? "Operations health endpoint" : "No verified health payload"}
              icon={Gauge}
            />
            {jsonSection(data.stats)
              .slice(0, 1)
              .map(([key, value]) => (
                <Metric
                  key={key}
                  label={key.replace(/([A-Z])/g, " $1")}
                  value={value}
                  note="Server-reported value"
                  icon={Users}
                />
              ))}
          </div>
          <div className="section-grid">
            <Panel>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">PIPELINE SIGNAL</div>
                  <h3>Bridge & health detail</h3>
                </div>
                <Pill tone={data.health || health.data ? "neutral" : "warn"}>
                  {health.data || data.health ? "PARTIAL DATA" : "UNKNOWN"}
                </Pill>
              </div>
              <div className="detail-list">
                {[...jsonSection(data.bridge), ...jsonSection(health.data || data.health)]
                  .slice(0, 10)
                  .map(([k, v]) => (
                    <div className="detail-row" key={k}>
                      <span>{k.replace(/([A-Z])/g, " $1")}</span>
                      <strong>{valueText(v)}</strong>
                    </div>
                  ))}
              </div>
              {!health.data && !data.health && (
                <p className="inline-note">
                  <CircleHelp size={15} /> Health values are unreported, not an indication of
                  healthy operation.
                </p>
              )}
            </Panel>
            <Panel>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">OPERATOR GUARDRAIL</div>
                  <h3>Trusted-data boundaries</h3>
                </div>
                <ShieldAlert size={19} className="amber-icon" />
              </div>
              <ul className="guard-list">
                <li>Only server-authoritative data can qualify an evaluation.</li>
                <li>Fallback or stale data must not be treated as trusted.</li>
                <li>Engine pause/resume is version-guarded and audited.</li>
                <li>Health fields may be absent or placeholder values.</li>
              </ul>
            </Panel>
          </div>
        </>
      )}
      {err && data && (
        <div className="notice notice-warn compact">
          <AlertTriangle size={16} /> Some health or status endpoints did not respond; values above
          are shown only when reported.
        </div>
      )}
    </>
  );
}

function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [membership, setMembership] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [settledSearch, role, status, membership]);
  const params: GetAdminUsersParams = useMemo(
    () => ({
      page,
      pageSize,
      ...(settledSearch ? { search: settledSearch } : {}),
      ...(role ? { role: role as GetAdminUsersParams["role"] } : {}),
      ...(status ? { status: status as GetAdminUsersParams["status"] } : {}),
      ...(membership ? { membership: membership as GetAdminUsersParams["membership"] } : {}),
    }),
    [page, pageSize, settledSearch, role, status, membership],
  );
  const query = useGetAdminUsers(params, {
    query: { queryKey: getGetAdminUsersQueryKey(params), placeholderData: (prev) => prev },
  });
  const crm = useGetAdminCrmSummary({ query: { queryKey: ["/api/admin/crm/summary"] } });
  const users = query.data?.items || [];
  const totalUsers = query.data?.total ?? 0;
  return (
    <>
      <PageHeader
        eyebrow="CUSTOMER DIRECTORY"
        title="Customers"
        sub="Search and inspect live account, membership and entitlement state."
        actions={
          <RetryButton
            onClick={() => {
              query.refetch();
              crm.refetch();
            }}
          />
        }
      />
      <Panel className="filter-panel">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search customers"
            data-testid="input-customer-search"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-selects">
          <select aria-label="Role filter" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="user">Customer</option>
            <option value="admin">Admin</option>
          </select>
          <select
            aria-label="Status filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All states</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <select
            aria-label="Membership filter"
            value={membership}
            onChange={(e) => setMembership(e.target.value)}
          >
            <option value="">All memberships</option>
            <option value="Free">Free</option>
            <option value="Pro">Pro</option>
            <option value="VIP">VIP</option>
          </select>
          <span className="filter-count">
            <Filter size={14} /> {totalUsers} total
          </span>
        </div>
      </Panel>
      <LoadState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} />
      {!query.isLoading && !query.error && (
        <Panel className="table-panel">
          <div className="table-caption">
            <span>ACCOUNTS</span>
            <span>
              CRM summary:{" "}
              {crm.isError
                ? "unavailable"
                : crm.isLoading
                  ? "loading"
                  : crm.data
                    ? "reported"
                    : "not reported"}
            </span>
          </div>
          {!users.length ? (
            <Empty
              title="No matching accounts"
              body="Try a different search or clear one of the filters."
            />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Role / state</th>
                    <th>Membership</th>
                    <th>Subscription</th>
                    <th>Activity</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: AdminUser) => (
                    <tr key={u.id} data-testid={`row-customer-${u.id}`}>
                      <td>
                        <Link href={`/users/${encodeURIComponent(u.id)}`} className="identity-link">
                          <span className="avatar avatar-soft">
                            {u.name?.slice(0, 1)?.toUpperCase() || "?"}
                          </span>
                          <span>
                            <strong>{u.name || "Name not reported"}</strong>
                            <small>{u.email}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <div className="stack-tight">
                          <Pill>{u.role}</Pill>
                          <Pill tone={statusTone(u.status)}>{u.status}</Pill>
                        </div>
                      </td>
                      <td>
                        <strong>{u.membership}</strong>
                        <small className="block muted">
                          {u.entitlements?.length ?? 0} entitlements
                        </small>
                      </td>
                      <td>
                        {u.subscriptionStatus ? (
                          <Pill tone={statusTone(u.subscriptionStatus)}>
                            {u.subscriptionStatus}
                          </Pill>
                        ) : (
                          "Not reported"
                        )}
                      </td>
                      <td>
                        <span className="font-mono-ui">{u.tradeCount}</span> trades{" "}
                        <small className="block muted">{u.watchlistCount} watchlist</small>
                      </td>
                      <td>{fmtDate(u.createdAt)}</td>
                      <td>
                        <Link
                          className="row-arrow"
                          href={`/users/${encodeURIComponent(u.id)}`}
                          aria-label={`Open ${u.email}`}
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pagination" aria-label="Customer pages">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span>
              {totalUsers === 0 ? 0 : (page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, totalUsers)} of {totalUsers}
            </span>
            <button
              type="button"
              disabled={page * pageSize >= totalUsers}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </Panel>
      )}
      {crm.isError && (
        <div className="inline-note">
          <CircleHelp size={15} /> CRM summary could not be loaded. Directory results remain server
          responses.
        </div>
      )}
    </>
  );
}

type PolicyDraft = Pick<
  AdminAccessPolicyUpdate,
  "featureMinimumTiers" | "marketTiers" | "watchlistLimits"
>;
const membershipTiers: CustomerMembershipTier[] = ["Free", "Pro", "VIP"];
const policyFeatures: {
  key: keyof AdminAccessPolicy["featureMinimumTiers"];
  label: string;
  detail: string;
}[] = [
  { key: "signalContext", label: "Signal context", detail: "Context attached to market signals" },
  {
    key: "trustedSetupLevels",
    label: "Trusted setup levels",
    detail: "Verified entry, stop and target levels",
  },
  {
    key: "performanceContext",
    label: "Performance context",
    detail: "Historical performance information",
  },
  { key: "priceAlerts", label: "Price alerts", detail: "Customer-created market alerts" },
  {
    key: "fullDepthReview",
    label: "Full-depth review",
    detail: "Display only — customer feature is not implemented",
  },
];
const clonePolicyDraft = (policy: AdminAccessPolicy): PolicyDraft => ({
  featureMinimumTiers: {
    ...(policy.featureMinimumTiers || {}),
  } as AdminAccessPolicy["featureMinimumTiers"],
  marketTiers: { ...(policy.marketTiers || {}) },
  watchlistLimits: { ...(policy.watchlistLimits || {}) } as AdminAccessPolicy["watchlistLimits"],
});
const policyTier = (membership: string): CustomerMembershipTier | null =>
  membership === "Free" || membership === "Pro" || membership === "VIP" ? membership : null;
const formatEstimateCount = (value: number) => new Intl.NumberFormat().format(value);
function AccessImpactEstimate({
  activeTier,
  draftTier,
  counts,
  testId,
}: {
  activeTier: CustomerMembershipTier;
  draftTier: CustomerMembershipTier;
  counts?: AdminAccessPolicy["estimatedMembershipTierCounts"];
  testId: string;
}) {
  if (!counts) {
    return (
      <span
        className="policy-impact-estimate policy-impact-estimate-unavailable"
        data-testid={testId}
      >
        Estimate unavailable
      </span>
    );
  }
  const activeIndex = membershipTiers.indexOf(activeTier);
  const draftIndex = membershipTiers.indexOf(draftTier);
  const losesAccess = draftIndex > activeIndex;
  const affectedTiers = membershipTiers.filter((_, index) =>
    losesAccess
      ? index >= activeIndex && index < draftIndex
      : index >= draftIndex && index < activeIndex,
  );
  return (
    <span className="policy-impact-estimate" data-testid={testId}>
      <small>ESTIMATED</small>
      <strong>May {losesAccess ? "lose" : "gain"} access</strong>
      <span>
        {affectedTiers.map((tier) => `${formatEstimateCount(counts[tier])} ${tier}`).join(" · ")}{" "}
        customers
      </span>
    </span>
  );
}
function WatchlistLimitImpactEstimate({
  limit,
  distribution,
  testId,
}: {
  limit: number;
  distribution?: AdminAccessPolicy["estimatedWatchlistSizeDistribution"];
  testId: string;
}) {
  if (!Array.isArray(distribution)) {
    return (
      <span
        className="policy-impact-estimate policy-impact-estimate-unavailable"
        data-testid={testId}
      >
        Estimate unavailable
      </span>
    );
  }
  const counts: Record<CustomerMembershipTier, number> = { Free: 0, Pro: 0, VIP: 0 };
  for (const bucket of distribution) {
    const tier = policyTier(bucket.membershipTier);
    if (tier && bucket.savedSymbolCount > limit) counts[tier] += bucket.customerCount;
  }
  return (
    <span className="policy-impact-estimate" data-testid={testId}>
      <small>ESTIMATED</small>
      <strong>Over {formatEstimateCount(limit)} symbols</strong>
      <span>
        {membershipTiers.map((tier) => `${formatEstimateCount(counts[tier])} ${tier}`).join(" · ")}{" "}
        customers
      </span>
    </span>
  );
}
const getPolicyError = (error: unknown) => {
  const message = getError(error);
  const details = typeof error === "object" && error ? JSON.stringify(error) : "";
  return /409|conflict|row.?version|stale/i.test(`${message} ${details}`)
    ? "This policy changed in another session. Refresh the latest version before applying your changes."
    : message;
};

export function AccessPolicyPage({ capabilities }: { capabilities: string[] }) {
  const qc = useQueryClient();
  const canManage = hasCapability(capabilities, "memberships.manage");
  const policy = useGetAdminAccessPolicy({
    query: {
      queryKey: getGetAdminAccessPolicyQueryKey(),
      refetchInterval: 60_000,
      staleTime: 15_000,
    },
  });
  const savePolicy = useUpdateAdminAccessPolicy();
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const current = policy.data;

  useEffect(() => {
    if (current && current.rowVersion !== loadedVersion) {
      setDraft(clonePolicyDraft(current));
      setLoadedVersion(current.rowVersion);
      setSubmitError("");
    }
  }, [current?.rowVersion, loadedVersion]);

  const returnedMarkets = current?.markets ?? [];
  const featureFieldsComplete =
    !!current &&
    policyFeatures.every(({ key }) => !!policyTier(current.featureMinimumTiers?.[key] || ""));
  const limitsComplete =
    !!current &&
    Number.isInteger(current.watchlistLimits?.Free) &&
    current.watchlistLimits.Free >= 1 &&
    Number.isInteger(current.watchlistLimits?.Pro) &&
    current.watchlistLimits.Pro >= 1;
  const inventoryComplete =
    !!current &&
    Array.isArray(current.markets) &&
    current.markets.every(
      (market) =>
        !!market?.symbol &&
        !!policyTier(current.marketTiers?.[market.symbol] || market.requiredTier || ""),
    );
  const coreReady =
    !!current &&
    !!draft &&
    featureFieldsComplete &&
    limitsComplete &&
    inventoryComplete &&
    Array.isArray(current.starterSymbols) &&
    Number.isFinite(current.rowVersion);
  const dirty =
    !!current && !!draft && JSON.stringify(draft) !== JSON.stringify(clonePolicyDraft(current));
  const marketCount = returnedMarkets.length;
  const featureImpact =
    current && draft
      ? policyFeatures.flatMap(({ key, label }) => {
          const activeTier = policyTier(current.featureMinimumTiers?.[key] || "");
          const draftTier = policyTier(draft.featureMinimumTiers?.[key] || "");
          return activeTier && draftTier && activeTier !== draftTier
            ? [{ key, label, activeTier, draftTier }]
            : [];
        })
      : [];
  const marketImpact =
    current && draft
      ? returnedMarkets.flatMap((market) => {
          const activeTier = policyTier(
            current.marketTiers?.[market.symbol] ?? market.requiredTier ?? "",
          );
          const draftTier = policyTier(draft.marketTiers?.[market.symbol] ?? activeTier ?? "");
          return activeTier && draftTier && activeTier !== draftTier
            ? [{ symbol: market.symbol, name: market.name || market.symbol, activeTier, draftTier }]
            : [];
        })
      : [];
  const watchlistCapacityChanged =
    !!current &&
    !!draft &&
    (current.watchlistLimits?.Free !== draft.watchlistLimits.Free ||
      current.watchlistLimits?.Pro !== draft.watchlistLimits.Pro);
  const watchlistImpact =
    current && draft
      ? (["Free", "Pro"] as const).flatMap((tier) => {
          const activeLimit = current.watchlistLimits?.[tier];
          const draftLimit = draft.watchlistLimits?.[tier];
          return Number.isInteger(activeLimit) &&
            Number.isInteger(draftLimit) &&
            activeLimit !== draftLimit
            ? [{ tier, activeLimit: activeLimit as number, draftLimit: draftLimit as number }]
            : [];
        })
      : [];
  const setFeatureTier = (
    key: keyof AdminAccessPolicy["featureMinimumTiers"],
    value: CustomerMembershipTier,
  ) => {
    setDraft((previous) =>
      previous
        ? { ...previous, featureMinimumTiers: { ...previous.featureMinimumTiers, [key]: value } }
        : previous,
    );
    setSubmitError("");
    setSaveNotice("");
  };
  const setMarketTier = (symbol: string, value: CustomerMembershipTier) => {
    setDraft((previous) =>
      previous
        ? { ...previous, marketTiers: { ...previous.marketTiers, [symbol]: value } }
        : previous,
    );
    setSubmitError("");
    setSaveNotice("");
  };
  const setWatchlistLimit = (tier: "Free" | "Pro", value: string) => {
    const parsed = value === "" ? Number.NaN : Number(value);
    setDraft((previous) =>
      previous && Number.isInteger(parsed) && parsed >= 1 && parsed <= 500
        ? { ...previous, watchlistLimits: { ...previous.watchlistLimits, [tier]: parsed } }
        : previous,
    );
    setSubmitError("");
    setSaveNotice("");
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!current || !draft || !canManage || !coreReady || !dirty || savePolicy.isPending) return;
    setSubmitError("");
    setSaveNotice("");
    const marketTiers = Object.fromEntries(
      returnedMarkets.map((market) => [
        market.symbol,
        draft.marketTiers[market.symbol] ??
          current.marketTiers?.[market.symbol] ??
          market.requiredTier,
      ]),
    ) as AdminAccessPolicy["marketTiers"];
    const data: AdminAccessPolicyUpdate = {
      rowVersion: current.rowVersion,
      featureMinimumTiers: { ...draft.featureMinimumTiers },
      marketTiers,
      watchlistLimits: {
        Free: draft.watchlistLimits.Free,
        Pro: draft.watchlistLimits.Pro,
        VIP: null,
      },
    };
    savePolicy.mutate(
      { data },
      {
        onSuccess: (returned) => {
          qc.setQueryData(getGetAdminAccessPolicyQueryKey(), returned);
          setDraft(clonePolicyDraft(returned));
          setLoadedVersion(returned.rowVersion);
          setSaveNotice(`Policy revision ${returned.rowVersion} is now active.`);
          qc.invalidateQueries({ queryKey: getGetAdminAccessPolicyQueryKey() });
        },
        onError: (failure) => setSubmitError(getPolicyError(failure)),
      },
    );
  };
  const discard = () => {
    if (current) setDraft(clonePolicyDraft(current));
    setSubmitError("");
    setSaveNotice("");
  };
  const refresh = () => {
    setSubmitError("");
    setSaveNotice("");
    policy.refetch();
  };

  return (
    <>
      <PageHeader
        eyebrow="SHARED CUSTOMER RULES"
        title="Access policy"
        sub="One versioned rule set for customer features, market access and watchlist capacity."
        actions={
          <>
            <span className="refresh-label">Checks for updates every 60 seconds</span>
            <RetryButton onClick={refresh} />
          </>
        }
      />
      <div className="policy-boundary">
        <div className="policy-boundary-mark">
          <Scale size={19} />
        </div>
        <div>
          <strong>Global rules, not a customer override</strong>
          <p>
            These shared access rules are separate from RevenueCat billing state and any individual
            membership override.
          </p>
        </div>
        <span className="policy-boundary-tag">SHARED POLICY</span>
      </div>
      <LoadState loading={policy.isLoading} error={policy.error} onRetry={refresh} />
      {!policy.isLoading && !policy.error && !current && (
        <Empty
          title="Policy not returned"
          body="The service returned no access policy. Refresh to try again; no rules can be edited without a complete current version."
        />
      )}
      {current && (
        <>
          <div className="policy-summary-strip">
            <div>
              <span>ACTIVE REVISION</span>
              <strong className="font-mono-ui">v{current.rowVersion ?? "—"}</strong>
            </div>
            <div>
              <span>MARKET INVENTORY</span>
              <strong>
                {marketCount} <small>returned</small>
              </strong>
            </div>
            <div>
              <span>STARTER SYMBOLS</span>
              <strong>
                {Array.isArray(current.starterSymbols) ? current.starterSymbols.length : "—"}{" "}
                <small>from policy</small>
              </strong>
            </div>
            <div className="policy-read-state">
              <span className="policy-live-dot" />{" "}
              {canManage ? "Read and manage access" : "Read only"}
            </div>
          </div>
          {!coreReady && (
            <div className="notice notice-warn">
              <AlertTriangle size={17} />
              <span>
                Some policy fields are missing or incomplete. Review is available where possible,
                but saving is disabled until the current policy is complete.
              </span>
            </div>
          )}
          <form onSubmit={save}>
            <Panel className="policy-panel">
              <div className="panel-head policy-section-head">
                <div>
                  <div className="eyebrow">01 / FEATURE GATES</div>
                  <h3>Minimum membership tier</h3>
                  <p>Set the lowest membership level that can use each customer feature.</p>
                </div>
                <span className="policy-count">6 rules</span>
              </div>
              <div className="policy-feature-list">
                {policyFeatures.map(({ key, label, detail }) => {
                  const value =
                    draft?.featureMinimumTiers?.[key] ?? current.featureMinimumTiers?.[key];
                  const displayOnly = key === "fullDepthReview";
                  return (
                    <div
                      className={`policy-feature-row ${displayOnly ? "policy-display-only" : ""}`}
                      key={key}
                      data-testid={`row-policy-feature-${key}`}
                    >
                      <div className="policy-feature-index">
                        {String(
                          policyFeatures.findIndex((feature) => feature.key === key) + 1,
                        ).padStart(2, "0")}
                      </div>
                      <div className="policy-feature-label">
                        <strong>{label}</strong>
                        <small>{detail}</small>
                      </div>
                      {displayOnly && <span className="policy-static-tag">DISPLAY ONLY</span>}
                      {value ? (
                        displayOnly ? (
                          <span className={`tier-chip tier-${value.toLowerCase()}`}>{value}</span>
                        ) : (
                          <select
                            aria-label={`${label} minimum tier`}
                            data-testid={`select-policy-feature-${key}`}
                            value={value}
                            disabled={!canManage || !draft || savePolicy.isPending}
                            onChange={(event) =>
                              setFeatureTier(key, event.target.value as CustomerMembershipTier)
                            }
                          >
                            {membershipTiers.map((tier) => (
                              <option key={tier} value={tier}>
                                {tier}
                              </option>
                            ))}
                          </select>
                        )
                      ) : (
                        <span className="policy-missing">Not reported</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="policy-footnote">
                <LockKeyhole size={14} /> Full-depth review remains unchanged. Its customer feature
                is not implemented.
              </p>
            </Panel>

            <Panel className="policy-panel">
              <div className="panel-head policy-section-head">
                <div>
                  <div className="eyebrow">02 / MARKET AVAILABILITY</div>
                  <h3>Market tier requirements</h3>
                  <p>
                    Only markets returned by the active policy inventory are available to update.
                  </p>
                </div>
                <span className="policy-count">{marketCount} markets</span>
              </div>
              {!marketCount ? (
                <Empty
                  title="No markets in the returned inventory"
                  body="Market rules remain unchanged until the active policy provides market inventory."
                />
              ) : (
                <div className="policy-market-table-wrap">
                  <table className="policy-market-table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Market</th>
                        <th>Type</th>
                        <th>Minimum tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnedMarkets.map((market) => {
                        const value =
                          draft?.marketTiers?.[market.symbol] ??
                          current.marketTiers?.[market.symbol] ??
                          market.requiredTier;
                        return (
                          <tr
                            key={market.symbol}
                            data-testid={`row-policy-market-${market.symbol}`}
                          >
                            <td className="font-mono-ui policy-symbol">{market.symbol}</td>
                            <td>
                              <strong>{market.name || "Name not reported"}</strong>
                            </td>
                            <td>
                              <span className="policy-market-type">
                                {market.marketType === "QUOTE_ONLY"
                                  ? "Quote only"
                                  : market.marketType === "STRATEGY"
                                    ? "Strategy"
                                    : market.marketType || "Not reported"}
                              </span>
                            </td>
                            <td>
                              {value ? (
                                <select
                                  aria-label={`${market.symbol} minimum tier`}
                                  data-testid={`select-policy-market-${market.symbol}`}
                                  value={value}
                                  disabled={!canManage || !draft || savePolicy.isPending}
                                  onChange={(event) =>
                                    setMarketTier(
                                      market.symbol,
                                      event.target.value as CustomerMembershipTier,
                                    )
                                  }
                                >
                                  {membershipTiers.map((tier) => (
                                    <option key={tier} value={tier}>
                                      {tier}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="policy-missing">Not reported</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="policy-starter-row">
                <div>
                  <strong>Starter symbols</strong>
                  <small>Returned policy reference. This list is not editable here.</small>
                </div>
                <div className="policy-symbol-chips">
                  {Array.isArray(current.starterSymbols) && current.starterSymbols.length ? (
                    current.starterSymbols.map((symbol) => (
                      <span key={symbol} className="font-mono-ui">
                        {symbol}
                      </span>
                    ))
                  ) : (
                    <span className="policy-missing">Not reported</span>
                  )}
                </div>
              </div>
            </Panel>

            <Panel className="policy-panel">
              <div className="panel-head policy-section-head">
                <div>
                  <div className="eyebrow">03 / WATCHLIST CAPACITY</div>
                  <h3>Customer watchlist limits</h3>
                  <p>Set an inclusive symbol limit by membership tier.</p>
                </div>
                <span className="policy-count">VIP fixed</span>
              </div>
              <div className="policy-limit-grid">
                {(["Free", "Pro"] as const).map((tier) => (
                  <label className="policy-limit-field" key={tier}>
                    <span className={`tier-chip tier-${tier.toLowerCase()}`}>{tier}</span>
                    <strong>Maximum symbols</strong>
                    <div>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        step="1"
                        aria-label={`${tier} watchlist limit`}
                        data-testid={`input-policy-watchlist-${tier.toLowerCase()}`}
                        value={
                          draft?.watchlistLimits?.[tier] ?? current.watchlistLimits?.[tier] ?? ""
                        }
                        disabled={!canManage || !draft || savePolicy.isPending}
                        onChange={(event) => setWatchlistLimit(tier, event.target.value)}
                      />
                      <small>symbols</small>
                    </div>
                    <small>Whole number from 1 to 500</small>
                  </label>
                ))}
                <div className="policy-limit-field policy-vip-limit">
                  <span className="tier-chip tier-vip">VIP</span>
                  <strong>Maximum symbols</strong>
                  <div>
                    <span className="policy-unlimited">Unlimited</span>
                    <LockKeyhole size={14} />
                  </div>
                  <small>Fixed capacity · not editable</small>
                </div>
              </div>
            </Panel>
            {dirty && canManage && (
              <Panel className="policy-impact-panel" data-testid="policy-impact-preview">
                <div className="policy-impact-heading">
                  <div>
                    <div className="eyebrow">BEFORE SAVE</div>
                    <h3>Access impact preview</h3>
                    <p>
                      Shared feature and market rules that differ from active revision{" "}
                      {current.rowVersion}. Watchlist estimates compare saved-symbol counts by
                      current tier with each proposed limit.
                    </p>
                  </div>
                  <span className="policy-count">
                    {featureImpact.length + marketImpact.length} access{" "}
                    {featureImpact.length + marketImpact.length === 1 ? "rule" : "rules"} changed
                  </span>
                </div>
                {featureImpact.length || marketImpact.length ? (
                  <div className="policy-impact-grid">
                    {featureImpact.length > 0 && (
                      <section className="policy-impact-group" aria-label="Changed feature rules">
                        <div className="policy-impact-group-head">
                          <strong>Features</strong>
                          <span>{featureImpact.length} changed</span>
                        </div>
                        <ul>
                          {featureImpact.map(({ key, label, activeTier, draftTier }) => (
                            <li key={key} data-testid={`impact-policy-feature-${key}`}>
                              <span>{label}</span>
                              <span
                                className="policy-impact-tiers"
                                aria-label={`Minimum tier changes from ${activeTier} to ${draftTier}`}
                              >
                                <span className={`tier-chip tier-${activeTier.toLowerCase()}`}>
                                  {activeTier}
                                </span>
                                <ChevronRight size={13} />
                                <span className={`tier-chip tier-${draftTier.toLowerCase()}`}>
                                  {draftTier}
                                </span>
                              </span>
                              <AccessImpactEstimate
                                activeTier={activeTier}
                                draftTier={draftTier}
                                counts={current.estimatedMembershipTierCounts}
                                testId={`impact-policy-feature-${key}-estimate`}
                              />
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {marketImpact.length > 0 && (
                      <section className="policy-impact-group" aria-label="Changed market rules">
                        <div className="policy-impact-group-head">
                          <strong>Markets</strong>
                          <span>{marketImpact.length} changed</span>
                        </div>
                        <ul>
                          {marketImpact.map(({ symbol, name, activeTier, draftTier }) => (
                            <li key={symbol} data-testid={`impact-policy-market-${symbol}`}>
                              <span className="policy-impact-market-name">
                                <strong className="font-mono-ui">{symbol}</strong>
                                <small>{name}</small>
                              </span>
                              <span
                                className="policy-impact-tiers"
                                aria-label={`Minimum tier changes from ${activeTier} to ${draftTier}`}
                              >
                                <span className={`tier-chip tier-${activeTier.toLowerCase()}`}>
                                  {activeTier}
                                </span>
                                <ChevronRight size={13} />
                                <span className={`tier-chip tier-${draftTier.toLowerCase()}`}>
                                  {draftTier}
                                </span>
                              </span>
                              <AccessImpactEstimate
                                activeTier={activeTier}
                                draftTier={draftTier}
                                counts={current.estimatedMembershipTierCounts}
                                testId={`impact-policy-market-${symbol}-estimate`}
                              />
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                ) : (
                  <div className="policy-impact-empty">
                    <strong>No feature or market access rules are changing.</strong>
                    {watchlistCapacityChanged && (
                      <span>Only watchlist capacity differs in this draft.</span>
                    )}
                  </div>
                )}
                {watchlistImpact.length > 0 && (
                  <section
                    className="policy-impact-group policy-impact-watchlist"
                    aria-label="Changed watchlist limits"
                  >
                    <div className="policy-impact-group-head">
                      <strong>Watchlist capacity</strong>
                      <span>
                        {watchlistImpact.length} limit{watchlistImpact.length === 1 ? "" : "s"}{" "}
                        changed
                      </span>
                    </div>
                    <ul>
                      {watchlistImpact.map(({ tier, activeLimit, draftLimit }) => (
                        <li
                          key={tier}
                          data-testid={`impact-policy-watchlist-${tier.toLowerCase()}`}
                        >
                          <span className="policy-impact-market-name">
                            <strong>{tier} maximum symbols</strong>
                            <small>
                              {activeLimit} → {draftLimit} symbols
                            </small>
                          </span>
                          <WatchlistLimitImpactEstimate
                            limit={draftLimit}
                            distribution={current.estimatedWatchlistSizeDistribution}
                            testId={`impact-policy-watchlist-${tier.toLowerCase()}-estimate`}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <p className="policy-impact-boundary">
                  Estimates are aggregate only; no customer identities are shown. The preview is
                  read-only: it does not change saved watchlists, billing, prices, or individual
                  membership overrides.
                </p>
              </Panel>
            )}
            <div className="policy-savebar">
              <div className="policy-save-copy">
                <span className="policy-save-dot" />
                <div>
                  <strong>{dirty ? "Unsaved policy changes" : "Policy is in sync"}</strong>
                  <small>
                    {canManage
                      ? `Revision ${current.rowVersion} · every write uses the active row version`
                      : "Your session has read-only access"}
                  </small>
                </div>
              </div>
              {submitError && (
                <div role="alert" className="policy-inline-error">
                  {submitError}
                </div>
              )}
              {saveNotice && (
                <div role="status" className="policy-inline-success">
                  {saveNotice}
                </div>
              )}
              <div className="policy-actions">
                {canManage && (
                  <button
                    type="button"
                    className="button button-secondary"
                    data-testid="button-discard-access-policy"
                    onClick={discard}
                    disabled={!dirty || savePolicy.isPending}
                  >
                    <RotateCcw size={14} /> Discard
                  </button>
                )}
                {canManage ? (
                  <button
                    type="submit"
                    className="button button-primary"
                    data-testid="button-save-access-policy"
                    disabled={!coreReady || !dirty || savePolicy.isPending}
                  >
                    {savePolicy.isPending ? "Saving policy…" : "Save shared policy"}
                    <Save size={15} />
                  </button>
                ) : (
                  <span className="policy-readonly-label">
                    <Shield size={14} /> Read only
                  </span>
                )}
              </div>
            </div>
          </form>
        </>
      )}
    </>
  );
}

function UserDetailPage({ capabilities }: { capabilities: string[] }) {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id || "");
  const qc = useQueryClient();
  const openActionDialog = useAdminActionDialog();
  const canManageUsers = hasCapability(capabilities, "users.manage");
  const canManageMemberships = hasCapability(capabilities, "memberships.manage");
  const canReadAudit = hasCapability(capabilities, "audit.read");
  const canReadMembershipPolicy = hasCapability(capabilities, "memberships.read");
  const detail = useGetAdminUserDetail(id, {
    query: { enabled: !!id, queryKey: getGetAdminUserDetailQueryKey(id) },
  });
  const notes = useGetAdminUserNotes(id, {
    query: { enabled: !!id, queryKey: getGetAdminUserNotesQueryKey(id) },
  });
  const trades = useGetAdminUserTrades(id, {
    query: { enabled: !!id, queryKey: getGetAdminUserTradesQueryKey(id) },
  });
  const audit = useGetAdminUserAuditLogs(id, {
    query: { enabled: !!id && canReadAudit, queryKey: getGetAdminUserAuditLogsQueryKey(id) },
  });
  const activePolicy = useGetAdminAccessPolicy({
    query: {
      enabled: canReadMembershipPolicy,
      queryKey: getGetAdminAccessPolicyQueryKey(),
      refetchInterval: 60_000,
      staleTime: 15_000,
    },
  });
  const update = useUpdateAdminUser();
  const membershipMut = useUpdateAdminUserMembership();
  const entitlementMut = useUpdateAdminUserEntitlements();
  const stateMut = useUpdateAdminUserAccountState();
  const addNote = useAddAdminUserNote();
  const requestPasswordReset = useRequestAdminUserPasswordReset();
  const [noteCategory, setNoteCategory] = useState<AdminUserNote["category"]>("GENERAL");
  const [noteBody, setNoteBody] = useState("");
  const [passwordResetNotice, setPasswordResetNotice] = useState("");
  const [editKind, setEditKind] = useState<CustomerEditKind | null>(null);
  const [editError, setEditError] = useState("");
  const [editName, setEditName] = useState("");
  const [editMembership, setEditMembership] = useState<AdminUser["membership"]>("Free");
  const [editOverrideDays, setEditOverrideDays] = useState("");
  const [editStatus, setEditStatus] = useState<CustomerAccountStatus>("active");
  const [editGrants, setEditGrants] = useState("");
  const [editDenies, setEditDenies] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editConfirmed, setEditConfirmed] = useState(false);
  const user = detail.data as AdminUserDetail | undefined;
  const membershipTier = policyTier(user?.membership || "");
  const accessibleMarketCount =
    activePolicy.data && membershipTier && Array.isArray(activePolicy.data.markets)
      ? activePolicy.data.markets.filter((market) => {
          const requiredTier = policyTier(
            activePolicy.data?.marketTiers?.[market.symbol] || market.requiredTier,
          );
          return (
            !!requiredTier &&
            membershipTiers.indexOf(requiredTier) <= membershipTiers.indexOf(membershipTier)
          );
        }).length
      : null;
  const marketAccessSummary = !canReadMembershipPolicy
    ? "Not available to this staff session"
    : activePolicy.isLoading
      ? "Loading shared policy…"
      : activePolicy.error
        ? "Shared policy unavailable"
        : accessibleMarketCount === null
          ? "Market inventory not reported"
          : `${accessibleMarketCount} of ${activePolicy.data?.markets.length ?? 0} returned markets`;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetAdminUserDetailQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
    qc.invalidateQueries({ queryKey: getGetAdminUserAuditLogsQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetAdminUserNotesQueryKey(id) });
  };
  const busy =
    update.isPending || membershipMut.isPending || entitlementMut.isPending || stateMut.isPending;
  const submitNote = (event: FormEvent) => {
    event.preventDefault();
    if (!noteBody.trim() || !id) return;
    addNote.mutate(
      { id, data: { category: noteCategory, body: noteBody.trim() } },
      {
        onSuccess: () => {
          setNoteBody("");
          invalidate();
        },
      },
    );
  };
  const sendCustomerPasswordReset = async () => {
    if (!user || !canManageUsers || user.role !== "user" || requestPasswordReset.isPending) return;
    const confirmed = await openActionDialog({
      title: "Send password reset email?",
      description: `A one-time link will be sent to ${user.email}. It expires in 20 minutes. The password stays unchanged until the customer uses it, and any earlier reset link will stop working. Account restrictions such as suspension remain in place.`,
      fields: [],
      submitLabel: "Send reset email",
    });
    if (!confirmed) return;
    setPasswordResetNotice("");
    requestPasswordReset.mutate(
      { id },
      {
        onSuccess: () => {
          setPasswordResetNotice(`A secure reset email was sent to ${user.email}.`);
          void qc.invalidateQueries({ queryKey: getGetAdminUserAuditLogsQueryKey(id) });
        },
      },
    );
  };
  const beginEdit = (kind: CustomerEditKind) => {
    if (!user) return;
    setEditKind(kind);
    setEditError("");
    setEditReason("");
    setEditConfirmed(false);
    if (kind === "display-name") setEditName(user.name);
    if (kind === "membership") {
      setEditMembership(user.membership);
      const expiry = user.overrideEndsAt ? Date.parse(user.overrideEndsAt) : Number.NaN;
      const remainingDays =
        Number.isFinite(expiry) && expiry > Date.now()
          ? Math.max(1, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)))
          : null;
      setEditOverrideDays(remainingDays === null ? "" : String(remainingDays));
    }
    if (kind === "status") {
      setEditStatus(
        user.status === "suspended" || user.status === "banned" ? user.status : "active",
      );
    }
    if (kind === "entitlements") {
      setEditGrants(user.entitlementGrants?.join(", ") || "");
      setEditDenies(user.entitlementDenies?.join(", ") || "");
    }
  };
  const closeEditor = () => {
    setEditKind(null);
    setEditError("");
    setEditConfirmed(false);
  };
  const submitCustomerEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !editKind) return;
    const reason = editReason.trim();
    const onSuccess = () => {
      closeEditor();
      setEditReason("");
      invalidate();
    };
    if (editKind === "display-name") {
      const name = editName.trim();
      if (!name) {
        setEditError("Enter a display name before saving.");
        return;
      }
      update.mutate({ id, data: { name, version: user.version } }, { onSuccess });
      return;
    }
    if (!reason) {
      setEditError("Enter a reason so this protected change can be recorded in the audit log.");
      return;
    }
    if (!editConfirmed) {
      setEditError("Confirm that you reviewed this protected account change.");
      return;
    }
    if (editKind === "membership") {
      const overrideDays = editOverrideDays.trim() ? Number(editOverrideDays) : null;
      if (
        overrideDays !== null &&
        (!Number.isInteger(overrideDays) || overrideDays < 1 || overrideDays > 3650)
      ) {
        setEditError(
          "Use a whole number from 1 to 3650 days, or leave the duration blank for no expiry.",
        );
        return;
      }
      membershipMut.mutate(
        {
          id,
          data: { membership: editMembership, overrideDays, reason, version: user.version },
        },
        { onSuccess },
      );
      return;
    }
    if (editKind === "restore-membership") {
      membershipMut.mutate(
        {
          id,
          data: { membership: user.membership, clearOverride: true, reason, version: user.version },
        },
        { onSuccess },
      );
      return;
    }
    if (editKind === "status") {
      stateMut.mutate(
        {
          id,
          data: { status: editStatus, reason, version: user.version },
        },
        { onSuccess },
      );
      return;
    }
    const grants = [
      ...new Set(
        editGrants
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const denies = [
      ...new Set(
        editDenies
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    entitlementMut.mutate(
      {
        id,
        data: { grants, denies, reason, version: user.version },
      },
      { onSuccess },
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="CUSTOMER RECORD"
        title={user?.name || "Customer profile"}
        sub={user?.email || `Account ${id}`}
        actions={
          <Link href="/users" className="button button-secondary">
            <ChevronLeft size={16} /> Directory
          </Link>
        }
      />
      <LoadState loading={detail.isLoading} error={detail.error} onRetry={() => detail.refetch()} />
      {user && (
        <>
          <div className="profile-banner">
            <div className="avatar avatar-large">
              {user.name?.slice(0, 1)?.toUpperCase() || "?"}
            </div>
            <div className="profile-main">
              <div className="profile-title">
                <h2>{user.name}</h2>
                <Pill tone={statusTone(user.status)}>{user.status}</Pill>
                <Pill>{user.role}</Pill>
              </div>
              <span>{user.email}</span>
              <small>
                Customer since {fmtDate(user.createdAt)} · Last seen {fmtDate(user.lastSeenAt)}
              </small>
            </div>
            <div className="profile-count">
              <strong>{user.tradeCount}</strong>
              <small>trades recorded</small>
            </div>
          </div>
          <div className="section-grid">
            <Panel>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">ACCESS & MEMBERSHIP</div>
                  <h3>Account state</h3>
                </div>
                <BadgeCheck size={18} />
              </div>
              <div className="detail-list">
                <div className="detail-row">
                  <span>Membership</span>
                  <strong>{user.membership}</strong>
                </div>
                <div className="detail-row" data-testid="row-market-access">
                  <span>Market access</span>
                  <strong data-testid="text-market-access">{marketAccessSummary}</strong>
                </div>
                {canReadMembershipPolicy && activePolicy.error && (
                  <div className="inline-note">
                    <CircleHelp size={15} /> Shared access rules could not be loaded.{" "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => activePolicy.refetch()}
                    >
                      Retry policy
                    </button>
                  </div>
                )}
                <div className="detail-row">
                  <span>Membership source</span>
                  <strong>{user.membershipSource || "UNKNOWN"}</strong>
                </div>
                <div className="detail-row">
                  <span>Customer role</span>
                  <strong>{user.role} · separate from staff access</strong>
                </div>
                <div className="detail-row">
                  <span>Subscription</span>
                  <strong>{user.subscriptionStatus || "Not reported"}</strong>
                </div>
                <div className="detail-row">
                  <span>Override expires</span>
                  <strong>
                    {user.overrideEndsAt
                      ? fmtDate(user.overrideEndsAt)
                      : user.membershipSource === "ADMIN_OVERRIDE"
                        ? "No expiry"
                        : "Not reported"}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Entitlements</span>
                  <strong>
                    {user.entitlements?.length ? user.entitlements.join(", ") : "None reported"}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Admin notes</span>
                  <strong>{user.adminNotesCount ?? "Not reported"}</strong>
                </div>
                <div className="detail-row">
                  <span>Decision updated</span>
                  <strong>
                    {fmtDate(user.updatedAt)} by {user.updatedBy || "Not reported"}
                  </strong>
                </div>
              </div>
              <div className="action-row">
                {canManageUsers && (
                  <>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => beginEdit("display-name")}
                    >
                      Edit display name
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => beginEdit("status")}
                    >
                      Change account state
                    </button>
                  </>
                )}
                {canManageUsers && user.role === "user" && (
                  <button
                    type="button"
                    className="button button-secondary"
                    data-testid="button-customer-password-reset"
                    disabled={busy || requestPasswordReset.isPending}
                    onClick={() => {
                      void sendCustomerPasswordReset();
                    }}
                  >
                    <LockKeyhole size={14} />
                    {requestPasswordReset.isPending
                      ? "Sending reset email…"
                      : "Send password reset email"}
                  </button>
                )}
                {canManageMemberships && (
                  <>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => beginEdit("membership")}
                    >
                      Change membership
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => beginEdit("entitlements")}
                    >
                      Edit entitlements
                    </button>
                    {user.membershipSource === "ADMIN_OVERRIDE" && (
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={busy}
                        onClick={() => beginEdit("restore-membership")}
                      >
                        Use verified RevenueCat state
                      </button>
                    )}
                  </>
                )}
              </div>
              {passwordResetNotice && (
                <div
                  className="notice notice-info compact"
                  role="status"
                  data-testid="customer-password-reset-status"
                >
                  {passwordResetNotice}
                </div>
              )}
              {requestPasswordReset.error && (
                <div
                  className="notice notice-warn compact"
                  role="alert"
                  data-testid="customer-password-reset-error"
                >
                  <AlertTriangle size={16} />
                  {/PASSWORD_RESET_UNAVAILABLE/i.test(getError(requestPasswordReset.error))
                    ? "The reset email could not be delivered. The password was not changed; check email delivery settings or try again."
                    : getError(requestPasswordReset.error)}
                </div>
              )}
              {editKind && (
                <form
                  className="admin-edit-form"
                  data-testid="customer-edit-form"
                  onSubmit={submitCustomerEdit}
                >
                  <div className="admin-edit-heading">
                    <div>
                      <div className="eyebrow">ACCOUNT UPDATE</div>
                      <h4>
                        {editKind === "display-name"
                          ? "Edit display name"
                          : editKind === "membership"
                            ? "Change membership"
                            : editKind === "status"
                              ? "Change account state"
                              : editKind === "entitlements"
                                ? "Edit entitlements"
                                : "Restore verified billing state"}
                      </h4>
                    </div>
                    <Pill>{editKind === "display-name" ? "Profile" : "Audited change"}</Pill>
                  </div>
                  {editKind === "display-name" && (
                    <label className="admin-edit-field" htmlFor="customer-edit-name">
                      Display name
                      <input
                        id="customer-edit-name"
                        data-testid="input-customer-edit-name"
                        value={editName}
                        required
                        maxLength={120}
                        aria-invalid={Boolean(editError && !editName.trim())}
                        aria-describedby={
                          editError && !editName.trim() ? "customer-edit-name-error" : undefined
                        }
                        onChange={(event) => {
                          setEditName(event.target.value);
                          setEditError("");
                        }}
                      />
                      {editError && !editName.trim() && (
                        <small id="customer-edit-name-error" className="field-error" role="alert">
                          Enter a display name before saving.
                        </small>
                      )}
                    </label>
                  )}
                  {editKind === "membership" && (
                    <>
                      <div className="admin-edit-grid">
                        <label className="admin-edit-field" htmlFor="customer-edit-membership">
                          Membership tier
                          <select
                            id="customer-edit-membership"
                            data-testid="select-customer-edit-membership"
                            value={editMembership}
                            onChange={(event) => {
                              setEditMembership(event.target.value as AdminUser["membership"]);
                              setEditError("");
                            }}
                          >
                            <option value="Free">Free — 3 starter markets</option>
                            <option value="Pro">Pro — 22 core strategy markets</option>
                            <option value="VIP">VIP — all 61 MT5 symbols + 22 core markets</option>
                          </select>
                        </label>
                        <label className="admin-edit-field" htmlFor="customer-edit-duration">
                          Override duration in days
                          <input
                            id="customer-edit-duration"
                            data-testid="input-customer-edit-duration"
                            type="number"
                            min={1}
                            max={3650}
                            step={1}
                            inputMode="numeric"
                            placeholder="No expiry"
                            value={editOverrideDays}
                            onChange={(event) => {
                              setEditOverrideDays(event.target.value);
                              setEditError("");
                            }}
                          />
                          <small className="admin-edit-hint">
                            Leave blank for no expiry. This changes the account override, not store
                            billing.
                          </small>
                        </label>
                      </div>
                      <div className="admin-edit-summary">
                        Free includes USOIL, BTCUSD and ETHUSD. Pro unlocks 22 core strategy
                        markets. VIP adds the 61-symbol MT5 quote catalog.
                      </div>
                    </>
                  )}
                  {editKind === "status" && (
                    <label className="admin-edit-field" htmlFor="customer-edit-status">
                      Account state
                      <select
                        id="customer-edit-status"
                        data-testid="select-customer-edit-status"
                        value={editStatus}
                        onChange={(event) => {
                          setEditStatus(event.target.value as CustomerAccountStatus);
                          setEditError("");
                        }}
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="banned">Banned</option>
                      </select>
                    </label>
                  )}
                  {editKind === "entitlements" && (
                    <div className="admin-edit-grid">
                      <label className="admin-edit-field" htmlFor="customer-edit-grants">
                        Entitlement grants
                        <textarea
                          id="customer-edit-grants"
                          data-testid="input-customer-edit-grants"
                          rows={3}
                          maxLength={2000}
                          placeholder="Comma-separated entitlement IDs"
                          value={editGrants}
                          onChange={(event) => {
                            setEditGrants(event.target.value);
                            setEditError("");
                          }}
                        />
                      </label>
                      <label className="admin-edit-field" htmlFor="customer-edit-denies">
                        Entitlement denies
                        <textarea
                          id="customer-edit-denies"
                          data-testid="input-customer-edit-denies"
                          rows={3}
                          maxLength={2000}
                          placeholder="Comma-separated entitlement IDs"
                          value={editDenies}
                          onChange={(event) => {
                            setEditDenies(event.target.value);
                            setEditError("");
                          }}
                        />
                      </label>
                    </div>
                  )}
                  {editKind === "restore-membership" && (
                    <div className="notice notice-warn compact">
                      <AlertTriangle size={16} />
                      <span>
                        This removes the Admin override and uses the current membership verified by
                        RevenueCat. Customer access may change immediately.
                      </span>
                    </div>
                  )}
                  {editKind !== "display-name" && (
                    <label className="admin-edit-field" htmlFor="customer-edit-reason">
                      Reason for change
                      <textarea
                        id="customer-edit-reason"
                        data-testid="input-customer-edit-reason"
                        rows={3}
                        maxLength={500}
                        required
                        aria-invalid={Boolean(editError && !editReason.trim())}
                        aria-describedby={
                          editError && !editReason.trim()
                            ? "customer-edit-reason-error"
                            : undefined
                        }
                        placeholder="Add a brief reason for the audit record"
                        value={editReason}
                        onChange={(event) => {
                          setEditReason(event.target.value);
                          setEditError("");
                        }}
                      />
                      {editError && !editReason.trim() && (
                        <small id="customer-edit-reason-error" className="field-error" role="alert">
                          A reason is required for the audit record.
                        </small>
                      )}
                    </label>
                  )}
                  {editKind !== "display-name" && (
                    <label className="admin-edit-confirm">
                      <input
                        type="checkbox"
                        data-testid="checkbox-customer-edit-confirm"
                        checked={editConfirmed}
                        onChange={(event) => {
                          setEditConfirmed(event.target.checked);
                          setEditError("");
                        }}
                      />
                      <span>
                        {editKind === "restore-membership"
                          ? "I understand this removes the Admin override and may change customer access."
                          : "I reviewed the change and confirm it should be applied."}
                      </span>
                    </label>
                  )}
                  {editError && (
                    <div className="admin-edit-error" role="alert">
                      {editError}
                    </div>
                  )}
                  <div className="admin-edit-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={closeEditor}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="button button-primary"
                      disabled={busy || (editKind !== "display-name" && !editConfirmed)}
                    >
                      {busy
                        ? "Saving…"
                        : editKind === "restore-membership"
                          ? "Restore verified state"
                          : editKind === "display-name"
                            ? "Save name"
                            : "Save change"}
                    </button>
                  </div>
                </form>
              )}
              {!canManageUsers && !canManageMemberships && (
                <p className="muted">Read-only customer access.</p>
              )}
              {busy && <p className="muted">Saving protected account change…</p>}
              {(update.error || membershipMut.error || entitlementMut.error || stateMut.error) && (
                <div className="notice notice-warn compact" role="alert">
                  <AlertTriangle size={16} />
                  {getError(
                    update.error || membershipMut.error || entitlementMut.error || stateMut.error,
                  )}
                </div>
              )}
            </Panel>
            <Panel>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">ACCOUNT CONFIGURATION</div>
                  <h3>Customer signals setup</h3>
                </div>
                <Settings2 size={18} />
              </div>
              <div className="detail-list">
                <div className="detail-row">
                  <span>Profile configuration</span>
                  <strong>Available from account API</strong>
                </div>
                <div className="detail-row">
                  <span>Trades returned</span>
                  <strong>
                    {trades.data?.trades?.length ?? user.trades?.length ?? "Not reported"}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Watchlist count</span>
                  <strong>{user.watchlistCount}</strong>
                </div>
                <div className="detail-row">
                  <span>Notifications unread</span>
                  <strong>{user.unreadNotificationCount}</strong>
                </div>
              </div>
              <p className="inline-note">
                <CircleHelp size={15} /> No account configuration fields are included in this admin
                response.
              </p>
            </Panel>
          </div>
          <div className="section-grid lower-grid">
            <Panel>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">TRADES</div>
                  <h3>Recent account activity</h3>
                </div>
              </div>
              <LoadState
                loading={trades.isLoading}
                error={trades.error}
                onRetry={() => trades.refetch()}
              />
              {trades.data?.trades?.length ? (
                <div className="detail-list">
                  {trades.data.trades.slice(0, 10).map((trade, i) => (
                    <div className="detail-row" key={String(trade.id ?? i)}>
                      <span>
                        {valueText(trade.symbol)} · {valueText(trade.direction)}
                      </span>
                      <strong>
                        {valueText(trade.status)} / {valueText(trade.createdAt)}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                !trades.isLoading &&
                !trades.error && (
                  <Empty
                    title="No trades returned"
                    body="No trade records were included for this account."
                  />
                )
              )}
            </Panel>
            <Panel>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">STAFF NOTES</div>
                  <h3>Notes & audit trail</h3>
                </div>
              </div>
              <LoadState
                loading={notes.isLoading || (canReadAudit && audit.isLoading)}
                error={notes.error || (canReadAudit ? audit.error : undefined)}
                onRetry={() => {
                  notes.refetch();
                  if (canReadAudit) audit.refetch();
                }}
              />
              {canManageUsers && (
                <form className="form-stack note-form" onSubmit={submitNote}>
                  <label>
                    Category
                    <select
                      value={noteCategory}
                      onChange={(event) =>
                        setNoteCategory(event.target.value as AdminUserNote["category"])
                      }
                    >
                      <option value="GENERAL">General</option>
                      <option value="BILLING">Billing</option>
                      <option value="COMPLIANCE">Compliance</option>
                      <option value="SUPPORT">Support</option>
                      <option value="RISK">Risk</option>
                    </select>
                  </label>
                  <label>
                    Internal note
                    <textarea
                      value={noteBody}
                      onChange={(event) => setNoteBody(event.target.value)}
                      maxLength={2000}
                      minLength={1}
                      required
                      rows={3}
                      placeholder="Record a staff-only customer note"
                    />
                  </label>
                  <div className="action-row">
                    <small className="muted">{noteBody.length}/2000</small>
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={!noteBody.trim() || addNote.isPending}
                    >
                      <Save size={15} />
                      {addNote.isPending ? "Saving…" : "Add note"}
                    </button>
                  </div>
                </form>
              )}
              {addNote.error && (
                <div className="notice notice-warn compact" role="alert">
                  <AlertTriangle size={16} />
                  {getError(addNote.error)}
                </div>
              )}
              {notes.data?.length
                ? notes.data.slice(0, 4).map((note) => (
                    <div className="timeline-item" key={note.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>{note.category}</strong>
                        <p>{note.body}</p>
                        <small>
                          {note.authorEmail} · {fmtDate(note.createdAt)}
                        </small>
                      </div>
                    </div>
                  ))
                : !notes.isLoading &&
                  !notes.error && <p className="muted">No staff notes returned.</p>}
              {canReadAudit ? (
                (audit.data || []).slice(0, 4).map((entry: AdminAuditEntry, i: number) => (
                  <div className="timeline-item" key={entry.id || i}>
                    <span className="timeline-dot audit" />
                    <div>
                      <strong>{entry.action}</strong>
                      <p>
                        {entry.actorEmail} · {fmtDate(entry.createdAt)}
                      </p>
                      {entry.details && <p className="muted">{valueText(entry.details)}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Audit history requires the audit.read capability.</p>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function ControlsPage() {
  const qc = useQueryClient();
  const openActionDialog = useAdminActionDialog();
  const controls = useGetAdminControls({ query: { queryKey: getGetAdminControlsQueryKey() } });
  const strategies = useGetAdminStrategies({
    query: { queryKey: getGetAdminStrategiesQueryKey() },
  });
  const updateMarket = useUpdateAdminMarket();
  const updateMatrix = useUpdateAdminMarketStrategies();
  const save = async (m: AdminMarketControl, key: string, value: boolean | string | null) => {
    if (key === "availableStrategies") {
      const values = await openActionDialog({
        title: `Edit strategy assignments · ${m.symbol}`,
        description:
          "Enter the strategy IDs that can be assigned to this market. Separate multiple IDs with commas.",
        fields: [
          {
            name: "strategies",
            label: "Available strategy IDs",
            type: "textarea",
            defaultValue: m.availableStrategies.join(", "),
            helperText: "Leave blank to remove all available strategy assignments.",
          },
        ],
        submitLabel: "Save assignments",
      });
      if (!values) return;
      updateMatrix.mutate(
        {
          symbol: m.symbol,
          data: {
            availableStrategies: values.strategies
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            rowVersion: m.rowVersion,
          },
        },
        { onSuccess: () => qc.invalidateQueries({ queryKey: getGetAdminControlsQueryKey() }) },
      );
      return;
    }
    updateMarket.mutate(
      { symbol: m.symbol, data: { [key]: value, rowVersion: m.rowVersion } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetAdminControlsQueryKey() }) },
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="DURABLE CONTROL PLANE"
        title="Controls"
        sub="Persisted strategy, symbol, and assignment settings used by the evaluation path."
        actions={
          <RetryButton
            onClick={() => {
              controls.refetch();
              strategies.refetch();
            }}
          />
        }
      />
      <div className="notice notice-info">
        <CircleHelp size={17} />
        <span>
          Symbol settings and strategy assignments are persisted in the shared database. Bridge and
          market diagnostics are observations; they do not by themselves establish trusted strategy
          data.
        </span>
      </div>
      <LoadState
        loading={controls.isLoading || strategies.isLoading}
        error={controls.error || strategies.error}
        onRetry={() => {
          controls.refetch();
          strategies.refetch();
        }}
      />
      {strategies.data && (
        <Panel>
          <div className="panel-head">
            <div>
              <div className="eyebrow">REGISTERED STRATEGIES</div>
              <h3>Available engines</h3>
            </div>
            <span className="font-mono-ui">{strategies.data.length} registered</span>
          </div>
          {strategies.data.length ? (
            <div className="strategy-grid">
              {(strategies.data as AdminStrategy[]).map((s) => (
                <div className="strategy-item" key={s.id}>
                  <div className="strategy-id">{s.id}</div>
                  <strong>{s.description}</strong>
                  <div className="strategy-meta">
                    <span>{s.version}</span>
                    <span>{s.timeframe}</span>
                    <span>{s.assignedMarkets ?? "—"} markets assigned</span>
                  </div>
                  <small>Asset classes: {s.assetClasses?.join(", ") || "Not reported"}</small>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No strategies registered"
              body="The server returned no registered strategies."
            />
          )}
        </Panel>
      )}
      {controls.data && (
        <Panel className="table-panel controls-table">
          <div className="panel-head">
            <div>
              <div className="eyebrow">PERSISTED MARKET MATRIX</div>
              <h3>Market and strategy assignments</h3>
            </div>
            <span className="font-mono-ui">{controls.data.markets.length} markets</span>
          </div>
          {controls.data.markets.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Enabled</th>
                    <th>User visibility</th>
                    <th>Default strategy</th>
                    <th>Available strategies</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {controls.data.markets.map((m) => (
                    <tr key={m.symbol}>
                      <td>
                        <strong>{m.symbol}</strong>
                        <small className="block muted">{m.brokerSymbol}</small>
                      </td>
                      <td>
                        <Pill tone={m.enabled ? "good" : "warn"}>
                          {m.enabled ? "Enabled" : "Disabled"}
                        </Pill>
                      </td>
                      <td>
                        <Pill>{m.visibleToUsers ? "Visible" : "Hidden"}</Pill>
                      </td>
                      <td>{m.defaultStrategyId || "None assigned"}</td>
                      <td>{m.availableStrategies?.join(", ") || "None"}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="text-button"
                            disabled={updateMarket.isPending}
                            onClick={() => save(m, "enabled", !m.enabled)}
                          >
                            {m.enabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            className="text-button"
                            disabled={updateMarket.isPending}
                            onClick={() => save(m, "visibleToUsers", !m.visibleToUsers)}
                          >
                            {m.visibleToUsers ? "Hide" : "Show"}
                          </button>
                          <button
                            className="text-button"
                            onClick={() => save(m, "availableStrategies", true)}
                          >
                            Edit assignments
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No markets returned" body="No persisted market controls were returned." />
          )}
        </Panel>
      )}
      {(updateMarket.error || updateMatrix.error) && (
        <div className="notice notice-warn" role="alert">
          <AlertTriangle size={16} />
          {getError(updateMarket.error || updateMatrix.error)}
        </div>
      )}
    </>
  );
}

function MarketDataPage() {
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState("");
  const diagnostics = useGetAdminDiagnostics({
    query: { queryKey: getGetAdminDiagnosticsQueryKey(), refetchInterval: 30000 },
  });
  const controls = useGetAdminControls({ query: { queryKey: getGetAdminControlsQueryKey() } });
  const current = symbol || controls.data?.markets[0]?.symbol || "";
  const candles = useGetAdminDiagnosticCandles(
    { symbol: current, timeframe: "M5", limit: 120 },
    {
      query: {
        enabled: !!current,
        queryKey: getGetAdminDiagnosticCandlesQueryKey({
          symbol: current,
          timeframe: "M5",
          limit: 120,
        }),
      },
    },
  );
  const candleData = candles.data as MarketCandles | undefined;
  const queryLab = useGetAdminLab(
    { symbol: current },
    { query: { enabled: !!current, queryKey: getGetAdminLabQueryKey({ symbol: current }) } },
  );
  const diagnosticRows = Array.isArray(diagnostics.data)
    ? diagnostics.data
    : diagnostics.data && typeof diagnostics.data === "object"
      ? Object.values(diagnostics.data as Record<string, unknown>)
      : [];
  return (
    <>
      <PageHeader
        eyebrow="MARKET AUTHORITY"
        title="Market data"
        sub="Inspect administrator diagnostics, bridge state and candle safety."
        actions={
          <RetryButton
            onClick={() => {
              diagnostics.refetch();
              controls.refetch();
              if (current) {
                candles.refetch();
                queryLab.refetch();
              }
            }}
          />
        }
      />
      <div className="notice notice-info">
        <Shield size={17} />
        <span>
          Diagnostic and display-only data are not automatically trusted for strategy evaluation. A
          fallback feed is never treated as authoritative.
        </span>
      </div>
      <LoadState
        loading={diagnostics.isLoading || controls.isLoading}
        error={diagnostics.error || controls.error}
        onRetry={() => {
          diagnostics.refetch();
          controls.refetch();
        }}
      />
      <Panel>
        <div className="panel-head">
          <div>
            <div className="eyebrow">BRIDGE & SYMBOL AUTHORITY</div>
            <h3>Provider and market diagnostics</h3>
          </div>
          <Pill>{diagnostics.data ? "SERVER REPORTED" : "UNKNOWN"}</Pill>
        </div>
        {diagnosticRows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Broker symbol</th>
                  <th>Enabled</th>
                  <th>Quote age</th>
                  <th>Candle buffers</th>
                  <th>Sync state</th>
                  <th>Bridge readiness blockers</th>
                </tr>
              </thead>
              <tbody>
                {diagnosticRows.map((row, i) => {
                  const d = row as Record<string, unknown>;
                  const blockers = Array.isArray(d.bridgeReadinessBlockers)
                    ? d.bridgeReadinessBlockers.filter(
                        (item): item is string => typeof item === "string",
                      )
                    : [];
                  return (
                    <tr key={String(d.symbol ?? i)}>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setSymbol(String(d.symbol || ""))}
                        >
                          {valueText(d.symbol)}
                        </button>
                      </td>
                      <td>{valueText(d.brokerSymbol)}</td>
                      <td>
                        <Pill tone={d.enabled ? "good" : "neutral"}>{valueText(d.enabled)}</Pill>
                      </td>
                      <td>
                        {d.quoteAgeMs == null ? "Not reported" : `${valueText(d.quoteAgeMs)} ms`}
                      </td>
                      <td>{valueText(d.candleBuffers)}</td>
                      <td>
                        <Pill tone={statusTone(String(d.syncState || ""))}>
                          {valueText(d.syncState)}
                        </Pill>
                      </td>
                      <td>
                        {d.requiresMt5Strategy === false
                          ? "No active MT5 strategy"
                          : blockers.length
                            ? blockers.join("; ")
                            : "No bridge blockers reported"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !diagnostics.isLoading && (
            <Empty
              title="No symbol diagnostics returned"
              body="The administrator endpoint returned no diagnostic rows."
            />
          )
        )}
      </Panel>
      <div className="section-grid lower-grid">
        <Panel>
          <div className="panel-head">
            <div>
              <div className="eyebrow">CANDLE VALIDATION</div>
              <h3>{current || "Select a symbol"}</h3>
            </div>
            <select
              aria-label="Diagnostic symbol"
              value={current}
              onChange={(e) => setSymbol(e.target.value)}
            >
              <option value="">Choose instrument</option>
              {controls.data?.markets.map((m) => (
                <option key={m.symbol} value={m.symbol}>
                  {m.symbol}
                </option>
              ))}
            </select>
          </div>
          <LoadState
            loading={candles.isLoading}
            error={candles.error}
            onRetry={() => candles.refetch()}
          />
          {candleData && (
            <>
              <div className="detail-list">
                <div className="detail-row">
                  <span>Data state</span>
                  <Pill tone={statusTone(candleData.dataState)}>{candleData.dataState}</Pill>
                </div>
                <div className="detail-row">
                  <span>Timeframe</span>
                  <strong>{candleData.timeframe}</strong>
                </div>
                <div className="detail-row">
                  <span>Validation</span>
                  <strong>
                    {candleData.validation?.valid
                      ? "Valid for chart display"
                      : "Invalid / not validated"}
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Display only</span>
                  <strong>{candleData.displayOnly ? "Yes — not strategy-safe" : "No"}</strong>
                </div>
                <div className="detail-row">
                  <span>Candles returned</span>
                  <strong>{candleData.candles?.length ?? 0}</strong>
                </div>
              </div>
              {candleData.validation?.reason && (
                <p className="inline-note">
                  <AlertTriangle size={15} />
                  {candleData.validation.reason}
                </p>
              )}
            </>
          )}
        </Panel>
        <Panel>
          <div className="panel-head">
            <div>
              <div className="eyebrow">STRATEGY CONTEXT</div>
              <h3>Lab diagnostics</h3>
            </div>
            <FileSearch size={18} />
          </div>
          <LoadState
            loading={queryLab.isLoading}
            error={queryLab.error}
            onRetry={() => queryLab.refetch()}
          />
          {queryLab.data ? (
            <pre className="json-view">{JSON.stringify(queryLab.data, null, 2)}</pre>
          ) : (
            !queryLab.isLoading &&
            !queryLab.error && (
              <p className="muted">Select a configured symbol to request diagnostic context.</p>
            )
          )}
        </Panel>
      </div>
    </>
  );
}

function SignalsPage() {
  const controls = useGetAdminControls({ query: { queryKey: getGetAdminControlsQueryKey() } });
  const strategies = useGetAdminStrategies({
    query: { queryKey: getGetAdminStrategiesQueryKey() },
  });
  const [symbol, setSymbol] = useState("");
  const [strategy, setStrategy] = useState("");
  const selected = symbol || controls.data?.markets[0]?.symbol || "";
  const params: GetSignalEvaluationParams = {
    symbol: selected,
    ...(strategy ? { strategy: strategy as GetSignalEvaluationParams["strategy"] } : {}),
  };
  const evaluation = useGetSignalEvaluation(params, {
    query: { enabled: false, queryKey: getGetSignalEvaluationQueryKey(params) },
  });
  const diagnosticParams = { symbol: selected, ...(strategy ? { strategy } : {}) };
  const diagnostic = useGetSignalDiagnostic(diagnosticParams, {
    query: { enabled: false, queryKey: getGetSignalDiagnosticQueryKey(diagnosticParams) },
  });
  const [ran, setRan] = useState(false);
  const run = async () => {
    if (!selected) return;
    setRan(true);
    await Promise.all([evaluation.refetch(), diagnostic.refetch()]);
  };
  const signal = evaluation.data?.signal;
  return (
    <>
      <PageHeader
        eyebrow="ON-DEMAND VALIDATION"
        title="Signal diagnostics"
        sub="Evaluate one selected instrument against the authoritative engine. Past outcomes are searchable in Evaluation History."
        actions={
          <button
            className="button button-primary"
            onClick={run}
            disabled={!selected || evaluation.isFetching || diagnostic.isFetching}
            data-testid="button-run-evaluation"
          >
            <Activity size={16} />
            {evaluation.isFetching || diagnostic.isFetching ? "Evaluating…" : "Run evaluation"}
          </button>
        }
      />
      <div className="notice notice-info">
        <ShieldAlert size={17} />
        <span>
          Each on-demand evaluation is durably recorded in Evaluation History, including blocked and
          no-signal outcomes. Strategy gates are unchanged; a diagnostic response alone does not
          make data trusted.
        </span>
      </div>
      <Panel className="signal-config">
        <div className="signal-config-label">
          <div className="eyebrow">EVALUATION INPUT</div>
          <h3>Choose context</h3>
        </div>
        <label>
          Symbol
          <select
            value={selected}
            onChange={(e) => {
              setSymbol(e.target.value);
              setRan(false);
            }}
          >
            <option value="">Select symbol</option>
            {controls.data?.markets.map((m) => (
              <option key={m.symbol} value={m.symbol}>
                {m.symbol}
              </option>
            ))}
          </select>
        </label>
        <label>
          Strategy
          <select
            value={strategy}
            onChange={(e) => {
              setStrategy(e.target.value);
              setRan(false);
            }}
          >
            <option value="">Server default</option>
            {strategies.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </select>
        </label>
      </Panel>
      <LoadState
        loading={controls.isLoading || strategies.isLoading}
        error={controls.error || strategies.error}
        onRetry={() => {
          controls.refetch();
          strategies.refetch();
        }}
      />
      {ran && (
        <>
          <LoadState
            loading={evaluation.isFetching || diagnostic.isFetching}
            error={evaluation.error || diagnostic.error}
            onRetry={run}
          />
          {signal && (
            <div className="signal-result">
              <div className="signal-result-top">
                <div>
                  <div className="eyebrow">CURRENT EVALUATION · NOT HISTORY</div>
                  <h2>{signal.symbol}</h2>
                </div>
                <Pill tone={signal.dataState === "LIVE" ? "good" : "warn"}>{signal.dataState}</Pill>
              </div>
              <div className="signal-decision">
                <div>
                  <span>Action</span>
                  <strong>{signal.action}</strong>
                </div>
                <div>
                  <span>Direction</span>
                  <strong>{signal.direction}</strong>
                </div>
                <div>
                  <span>Lifecycle</span>
                  <strong>{signal.lifecycleStatus}</strong>
                </div>
                <div>
                  <span>Qualified</span>
                  <strong>{signal.qualified ? "Yes" : "No"}</strong>
                </div>
              </div>
              {evaluation.data?.quote && (
                <div className="detail-list">
                  <div className="detail-row">
                    <span>Quote authority state</span>
                    <Pill tone={statusTone(evaluation.data.quote.dataState)}>
                      {evaluation.data.quote.dataState}
                    </Pill>
                  </div>
                  <div className="detail-row">
                    <span>Source age</span>
                    <strong>
                      {evaluation.data.quote.sourceAgeSeconds ?? "Not reported"} seconds
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>Provider</span>
                    <strong>{diagnostic.data?.provider || "Not reported"}</strong>
                  </div>
                </div>
              )}
              <p className="inline-note">
                <CircleHelp size={15} /> Prices and levels are rendered only when returned by the
                authoritative evaluation response.
              </p>
            </div>
          )}
          {diagnostic.data && (
            <Panel>
              <div className="panel-head">
                <div>
                  <div className="eyebrow">GATES & PROVENANCE</div>
                  <h3>
                    {diagnostic.data.strategy} · {diagnostic.data.strategyVersion}
                  </h3>
                </div>
                <Pill tone={statusTone(diagnostic.data.dataState)}>
                  {diagnostic.data.dataState}
                </Pill>
              </div>
              <div className="detail-list">
                <div className="detail-row">
                  <span>Provider</span>
                  <strong>{diagnostic.data.provider || "Not reported"}</strong>
                </div>
                <div className="detail-row">
                  <span>Provider symbol</span>
                  <strong>{diagnostic.data.providerSymbol || "Not reported"}</strong>
                </div>
                <div className="detail-row">
                  <span>Action / state</span>
                  <strong>
                    {diagnostic.data.action} / {diagnostic.data.lifecycleStatus}
                  </strong>
                </div>
              </div>
              {diagnostic.data.reasons?.length ? (
                <ul className="guard-list">
                  {diagnostic.data.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No validation reasons were returned.</p>
              )}
              <details>
                <summary>Raw validation & provenance</summary>
                <pre className="json-view">
                  {JSON.stringify(
                    {
                      validation: diagnostic.data.validation,
                      provenance: diagnostic.data.provenance,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </Panel>
          )}
          {ran && !evaluation.isFetching && !evaluation.data && !evaluation.error && (
            <Empty
              title="No evaluation returned"
              body="The endpoint returned no signal evaluation for this selection."
            />
          )}
        </>
      )}
      {!ran && (
        <Panel className="signal-empty">
          <div className="empty-mark">
            <Signal size={20} />
          </div>
          <h3>Ready when you are</h3>
          <p>
            Run one server-side evaluation. Its actual result will appear in Evaluation History
            whether or not it generates a signal.
          </p>
        </Panel>
      )}
    </>
  );
}

function revenueCatIndicativePriceLabel(
  price: { amountMicros: string; currency: string; country: string | null } | null,
) {
  if (!price) return "Not available";
  const amount = Number(price.amountMicros) / 1_000_000;
  if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(price.currency)) return "Not available";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency }).format(
      amount,
    );
  } catch {
    return `${amount.toFixed(2)} ${price.currency}`;
  }
}

function revenueCatPriceUnavailableText(reason: string | null, storeType: string) {
  if (reason === "STORE_CREDENTIALS_MISSING") {
    if (storeType === "app_store")
      return "App Store Connect credentials are missing in RevenueCat.";
    if (storeType === "play_store")
      return "Google Play service-account credentials are missing in RevenueCat.";
    return "Store credentials are missing in RevenueCat.";
  }
  return "RevenueCat did not report an indicative price.";
}

function BillingPage() {
  const [account, setAccount] = useState("");
  const [eventId, setEventId] = useState("");
  const params = account ? { accountIds: [account.trim()] } : {};
  const transfers = useGetAdminBillingTransfers(params, {
    query: { queryKey: getGetAdminBillingTransfersQueryKey(params) },
  });
  const catalog = useGetAdminRevenueCatPriceSummary({
    query: { queryKey: getGetAdminRevenueCatPriceSummaryQueryKey(), staleTime: 60_000 },
  });
  const handoffParams = { eventId, ...(account ? { accountIds: [account.trim()] } : {}) };
  const handoff = useGetAdminBillingTransferHandoff(handoffParams, {
    query: {
      enabled: !!eventId,
      queryKey: getGetAdminBillingTransferHandoffQueryKey(handoffParams),
    },
  });
  const [showHandoff, setShowHandoff] = useState(false);
  const handoffDialogRef = useRef<HTMLDivElement>(null);
  const handoffTriggerRef = useRef<HTMLButtonElement>(null);
  const handoffCloseRef = useRef<HTMLButtonElement>(null);
  const closeHandoff = () => {
    setShowHandoff(false);
    window.setTimeout(() => handoffTriggerRef.current?.focus(), 0);
  };
  useEffect(() => {
    if (!showHandoff) return;
    handoffCloseRef.current?.focus();
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHandoff();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = handoffDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeyDown);
    return () => window.removeEventListener("keydown", handleDialogKeyDown);
  }, [showHandoff]);
  const refreshBilling = () => {
    transfers.refetch();
    catalog.refetch();
  };
  return (
    <>
      <PageHeader
        eyebrow="REVENUECAT OPERATIONS"
        title="Billing and pricing"
        sub="Review the current RevenueCat offering, indicative prices, and transfer recovery context."
        actions={<RetryButton onClick={refreshBilling} />}
      />
      <div className="notice notice-info">
        <Shield size={17} />
        <span>
          Read-only transfer recovery context, not a payment transaction ledger or refund tool. No
          transaction history or amounts are shown, and this console does not initiate transfers or
          replay provider webhooks.
        </span>
      </div>
      <Panel className="table-panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">LIVE REVENUECAT CATALOG</div>
            <h3>Current offering prices</h3>
            {catalog.data?.currentOffering && (
              <p className="muted">
                {catalog.data.currentOffering.displayName} · refreshed{" "}
                {fmtDate(catalog.data.fetchedAt)}
              </p>
            )}
          </div>
          <Pill tone="good">Read-only</Pill>
        </div>
        <LoadState
          loading={catalog.isLoading}
          error={catalog.error}
          onRetry={() => catalog.refetch()}
        />
        {catalog.data &&
          (catalog.data.currentOffering ? (
            <>
              <div className="notice notice-info">
                <Shield size={16} />
                <span>
                  Prices are RevenueCat’s indicative USD/US values when available; actual store and
                  country prices may differ. This view does not edit products or prices.
                </span>
              </div>
              {catalog.data.products.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Package</th>
                        <th>Store</th>
                        <th>Store product</th>
                        <th>Indicative price (USD / US)</th>
                        <th>Catalog state</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalog.data.products.map((product) => (
                        <tr key={`${product.packageId}:${product.productId}`}>
                          <td>
                            <strong>{product.packageName}</strong>
                            <small className="block muted">{product.productDisplayName}</small>
                          </td>
                          <td>
                            <strong>{product.storeName}</strong>
                            <small className="block muted">
                              {product.storeType === "app_store"
                                ? "Apple App Store"
                                : product.storeType === "play_store"
                                  ? "Google Play"
                                  : product.storeType}
                            </small>
                          </td>
                          <td>
                            <strong className="font-mono-ui">
                              {product.storeProductIdentifier}
                            </strong>
                            <small className="block muted">
                              RevenueCat ID: {product.productId}
                            </small>
                          </td>
                          <td>
                            <strong>
                              {revenueCatIndicativePriceLabel(product.indicativePrice)}
                            </strong>
                            {product.indicativePrice ? (
                              <small className="block muted">
                                {product.indicativePrice.country || "Default country"} ·{" "}
                                {product.indicativePrice.currency}
                              </small>
                            ) : (
                              <small className="block muted">
                                {revenueCatPriceUnavailableText(
                                  product.priceUnavailableReason,
                                  product.storeType,
                                )}
                              </small>
                            )}
                          </td>
                          <td>
                            <Pill tone={statusTone(product.productState || "UNKNOWN")}>
                              {product.productState || "Unknown"}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="No products in the current offering"
                  body="RevenueCat returned a current offering without any attached store products."
                />
              )}
            </>
          ) : (
            <Empty
              title="No current RevenueCat offering"
              body="RevenueCat did not report an offering currently available to customers."
            />
          ))}
      </Panel>
      <Panel className="filter-panel">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Filter by account ID"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            aria-label="Filter billing by account ID"
          />
        </div>
        <div className="search-field">
          <Command size={16} />
          <input
            placeholder="Handoff event ID"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            aria-label="Handoff event ID"
          />
        </div>
        <button
          className="button button-secondary"
          ref={handoffTriggerRef}
          onClick={() => setShowHandoff(true)}
          disabled={!eventId.trim()}
        >
          View handoff
        </button>
      </Panel>
      <LoadState
        loading={transfers.isLoading}
        error={transfers.error}
        onRetry={() => transfers.refetch()}
      />
      {transfers.data && (
        <>
          <div className="metric-grid two">
            <Metric
              label="Pending transfers"
              value={transfers.data.pending.length}
              note="Server-reported pending items"
              icon={Clock3}
            />
            <Metric
              label="Recorded outcomes"
              value={transfers.data.outcomes.length}
              note="Audited reconciliation context"
              icon={ClipboardList}
            />
          </div>
          <Panel className="table-panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">PENDING</div>
                <h3>Transfers awaiting processing</h3>
              </div>
            </div>
            {transfers.data.pending.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Destination accounts</th>
                      <th>Received</th>
                      <th>Retention expiry</th>
                      <th>Matched sides</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.data.pending.map((t) => (
                      <tr key={t.eventId}>
                        <td>
                          <strong className="font-mono-ui">{t.eventId}</strong>
                        </td>
                        <td>{t.destinationAppUserIds.join(", ") || "Not reported"}</td>
                        <td>{fmtDate(t.receivedAt)}</td>
                        <td>{fmtDate(t.expiresAt)}</td>
                        <td>
                          {t.matchedAccounts?.map((a) => `${a.accountId} (${a.side})`).join(", ") ||
                            "No active account filter"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No pending transfers returned"
                body="The current response contains no pending transfer records."
              />
            )}
          </Panel>
          <Panel className="table-panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">AUDITED OUTCOMES</div>
                <h3>Recovery history</h3>
              </div>
            </div>
            {transfers.data.outcomes.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Outcome</th>
                      <th>Account</th>
                      <th>Recovery guidance</th>
                      <th>Retry safety</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.data.outcomes.map((o) => (
                      <tr key={o.id}>
                        <td>{fmtDate(o.createdAt)}</td>
                        <td>
                          <Pill tone={statusTone(o.details.outcome)}>{o.details.outcome}</Pill>
                          <small className="block muted">
                            {o.details.failureCategory || "No failure category"}
                          </small>
                        </td>
                        <td>{o.targetEmail || o.targetUserId || o.actorEmail}</td>
                        <td>
                          {o.details.supportGuidance || "Not reported"}
                          <small className="block muted">
                            {o.details.recoveryState} · {o.details.retentionState}
                          </small>
                        </td>
                        <td>
                          {o.details.safeToRetry
                            ? "Safe to retry"
                            : o.details.escalationRequired
                              ? "Escalation required"
                              : "No retry recommended"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No billing outcomes returned"
                body="No audited outcomes match the current account filter."
              />
            )}
          </Panel>
        </>
      )}
      {showHandoff && (
        <div className="modal-backdrop" onClick={closeHandoff}>
          <div
            className="modal-card"
            ref={handoffDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-handoff-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">SANITIZED INCIDENT HANDOFF</div>
                <h3 id="billing-handoff-title">Transfer context</h3>
              </div>
              <button
                className="icon-button"
                ref={handoffCloseRef}
                aria-label="Close transfer context"
                onClick={closeHandoff}
              >
                <X size={17} />
              </button>
            </div>
            <LoadState
              loading={handoff.isLoading}
              error={handoff.error}
              onRetry={() => handoff.refetch()}
            />
            {handoff.data && (
              <>
                <Pill>{handoff.data.status}</Pill>
                <pre className="json-view handoff-text">
                  {handoff.data.summary}
                  {"\n\n"}
                  {handoff.data.supportGuidance}
                </pre>
                <div className="detail-list">
                  <div className="detail-row">
                    <span>Recovery state</span>
                    <strong>{handoff.data.recoveryState || "Not reported"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Failure category</span>
                    <strong>{handoff.data.failureCategory || "Not reported"}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AuditPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const audit = useGetAdminCrmAuditLogs(
    { page, pageSize },
    { query: { queryKey: getGetAdminCrmAuditLogsQueryKey({ page, pageSize }) } },
  );
  const fallback = useGetAdminAuditLog(
    { limit: 100 },
    { query: { queryKey: getGetAdminAuditLogQueryKey({ limit: 100 }), enabled: audit.isError } },
  );
  const rows = audit.data || fallback.data || [];
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATOR AUDIT"
        title="Audit history"
        sub="Paginated staff activity from the protected audit endpoints."
        actions={
          <RetryButton
            onClick={() => {
              audit.refetch();
              fallback.refetch();
            }}
          />
        }
      />
      <LoadState
        loading={audit.isLoading}
        error={audit.error && !fallback.data ? audit.error : undefined}
        onRetry={() => audit.refetch()}
      />
      {(audit.data || fallback.data) && (
        <Panel className="table-panel">
          <div className="table-caption">
            <span>
              {audit.data
                ? `PAGE ${page} / ${pageSize} PER PAGE`
                : "LEGACY AUDIT RESPONSE · LIMIT 100"}
            </span>
            <span>{rows.length} entries</span>
          </div>
          {rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry: AdminAuditEntry, i: number) => (
                    <tr key={entry.id || i}>
                      <td className="nowrap">{fmtDate(entry.createdAt)}</td>
                      <td>
                        {entry.actorEmail}
                        <small className="block muted">{entry.actorId}</small>
                      </td>
                      <td>
                        <Pill>{entry.action}</Pill>
                      </td>
                      <td>{entry.targetEmail || entry.targetUserId || "—"}</td>
                      <td>
                        <details>
                          <summary>Inspect</summary>
                          <pre className="json-view">{JSON.stringify(entry.details, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No audit entries returned"
              body="No matching administrator actions were reported."
            />
          )}
          {audit.data && (
            <div className="pagination">
              <button
                className="button button-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span>Page {page}</span>
              <button
                className="button button-secondary"
                disabled={rows.length < pageSize}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </Panel>
      )}
      {audit.error && fallback.data && (
        <div className="inline-note">
          <CircleHelp size={15} /> Paginated CRM audit could not be loaded; showing the available
          limited audit response.
        </div>
      )}
    </>
  );
}

function SymbolsPage() {
  const qc = useQueryClient();
  const openActionDialog = useAdminActionDialog();
  const query = useGetAdminMarketInventory({
    query: { queryKey: getGetAdminMarketInventoryQueryKey(), refetchInterval: 30000 },
  });
  const update = useUpdateAdminSymbol();
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey() } });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AdminMarketInventoryItem["marketType"]>(
    "ALL",
  );
  const [tierFilter, setTierFilter] = useState<"ALL" | AdminMarketInventoryItem["requiredTier"]>(
    "ALL",
  );
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const canManage = hasCapability(session.data?.staff.capabilities, "symbols.manage");
  const invalidateSymbolData = () => {
    qc.invalidateQueries({ queryKey: getGetAdminMarketInventoryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetAdminSymbolsQueryKey() });
  };
  const saveSymbol = async (row: AdminMarketInventoryItem) => {
    if (
      !row.controlManaged ||
      row.rowVersion === null ||
      row.enabled === null ||
      row.visibleToUsers === null
    )
      return;
    const values = await openActionDialog({
      title: `Edit market symbol · ${row.symbol}`,
      description:
        "Update the customer-facing label and broker mapping. The change and audit reason will be saved together.",
      fields: [
        {
          name: "displaySymbol",
          label: "Display symbol",
          defaultValue: row.displaySymbol,
          required: true,
        },
        {
          name: "provider",
          label: "Broker / provider",
          defaultValue: row.provider,
          required: true,
        },
        {
          name: "providerSymbol",
          label: "Mapped broker symbol",
          defaultValue: row.providerSymbol,
          required: true,
        },
        {
          name: "digits",
          label: "Price digits",
          type: "number",
          defaultValue: String(row.digits),
          min: 0,
          max: 12,
          integer: true,
          required: true,
          helperText: "Use a whole number from 0 to 12.",
        },
        {
          name: "reason",
          label: "Audit reason",
          type: "textarea",
          required: true,
          placeholder: "Why is this market configuration changing?",
        },
      ],
      submitLabel: "Save market changes",
    });
    if (!values) return;
    update.mutate(
      {
        symbol: row.symbol,
        data: {
          displaySymbol: values.displaySymbol.trim(),
          provider: values.provider.trim(),
          providerSymbol: values.providerSymbol.trim(),
          digits: Number(values.digits),
          enabled: row.enabled,
          visibleToUsers: row.visibleToUsers,
          rowVersion: row.rowVersion,
          reason: values.reason.trim(),
        },
      },
      { onSuccess: invalidateSymbolData },
    );
  };
  const toggle = async (row: AdminMarketInventoryItem, field: "enabled" | "visibleToUsers") => {
    if (!row.controlManaged || row.archived || row.rowVersion === null || row[field] === null)
      return;
    const nextValue = !row[field];
    const action =
      field === "enabled" ? (nextValue ? "Enable" : "Disable") : nextValue ? "Show" : "Hide";
    const values = await openActionDialog({
      title: `${action} ${row.symbol}`,
      description:
        field === "enabled"
          ? `${nextValue ? "Enable" : "Disable"} this market for signal processing. Add an audit reason to confirm.`
          : `${nextValue ? "Make this market visible" : "Hide this market"} to customers. Add an audit reason to confirm.`,
      fields: [
        {
          name: "reason",
          label: "Audit reason",
          type: "textarea",
          required: true,
          placeholder: `Why ${action.toLowerCase()} this market?`,
        },
      ],
      submitLabel: `${action} market`,
      intent: nextValue ? "default" : "destructive",
    });
    if (!values) return;
    update.mutate(
      {
        symbol: row.symbol,
        data: { [field]: nextValue, rowVersion: row.rowVersion, reason: values.reason.trim() },
      },
      { onSuccess: invalidateSymbolData },
    );
  };
  const setArchived = async (row: AdminMarketInventoryItem) => {
    if (!row.controlManaged || row.rowVersion === null) return;
    const nextArchived = !row.archived;
    const action = nextArchived ? "archive" : "restore";
    const values = await openActionDialog({
      title: `${nextArchived ? "Archive" : "Restore"} ${row.symbol}?`,
      description: nextArchived
        ? "This market will be disabled and hidden from active markets. Its previous enabled and visibility settings will be retained for restoration."
        : "Restore this market using its previous enabled and customer-visibility settings.",
      fields: [
        {
          name: "reason",
          label: "Audit reason",
          type: "textarea",
          required: true,
          placeholder: `Why ${action} this market?`,
        },
      ],
      submitLabel: `${nextArchived ? "Archive" : "Restore"} market`,
      intent: nextArchived ? "destructive" : "default",
    });
    if (!values) return;
    update.mutate(
      {
        symbol: row.symbol,
        data: { archived: nextArchived, rowVersion: row.rowVersion, reason: values.reason.trim() },
      },
      { onSuccess: invalidateSymbolData },
    );
  };
  const rows = query.data ?? [];
  const filteredRows = rows
    .filter((row) => {
      const queryText = search.trim().toLowerCase();
      const matchesSearch =
        !queryText ||
        [
          row.symbol,
          row.displaySymbol,
          row.description,
          row.provider,
          row.providerSymbol,
          row.assetClass,
          row.requiredTier,
          row.marketType,
          row.archived ? "archived" : "active",
          ...row.availableStrategies,
          ...row.assignedStrategies,
        ].some((value) => value.toLowerCase().includes(queryText));
      return (
        matchesSearch &&
        (typeFilter === "ALL" || row.marketType === typeFilter) &&
        (tierFilter === "ALL" || row.requiredTier === tierFilter)
      );
    })
    .sort((left, right) => left.symbol.localeCompare(right.symbol));
  const strategyCount = rows.filter((row) => row.strategySupported).length;
  const watchlistCount = rows.filter((row) => row.requiredTier === "VIP").length;
  const brokerSpecCount = rows.filter((row) => row.brokerSpec !== null).length;
  const refreshInventory = () => query.refetch();

  return (
    <>
      <PageHeader
        eyebrow="COMPLETE MARKET INVENTORY"
        title="Symbols"
        sub="Manage core markets and all 61 MT5 watchlist symbols: mappings, status, archive/restore, and compatible M15 strategy assignments."
        actions={<RetryButton onClick={refreshInventory} />}
      />
      <div className="notice notice-info">
        <Shield size={17} />
        <span>
          MT5 watchlist symbols keep their exact identity: NDX remains separate from US100. Strategy
          choices follow the existing asset-class matrix, and all assigned strategies remain subject
          to validated M15 data and full-sync checks.
        </span>
      </div>
      <LoadState loading={query.isLoading} error={query.error} onRetry={refreshInventory} />
      {query.data && (
        <>
          <div className="metric-grid market-inventory-summary">
            <Metric
              label="Managed symbols"
              value={rows.length}
              note="Core markets and MT5 watchlist entries"
              icon={Boxes}
            />
            <Metric
              label="Strategy-assignable"
              value={strategyCount}
              note="Current library supports at least one strategy"
              icon={Workflow}
            />
            <Metric
              label="VIP MT5 symbols"
              value={watchlistCount}
              note="Exact broker watchlist identities"
              icon={BarChart3}
            />
            <Metric
              label="Broker specs reported"
              value={brokerSpecCount}
              note="Current persisted MT5 specifications"
              icon={Settings2}
            />
          </div>
          <Panel className="filter-panel market-inventory-filters">
            <label className="search-field">
              <Search size={15} />
              <input
                type="search"
                aria-label="Search market inventory"
                placeholder="Search symbol, mapping, strategy…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="filter-selects">
              <select
                aria-label="Filter by market type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
              >
                <option value="ALL">All market types</option>
                <option value="STRATEGY">Core catalog</option>
                <option value="QUOTE_ONLY">MT5 watchlist</option>
              </select>
              <select
                aria-label="Filter by membership tier"
                value={tierFilter}
                onChange={(event) => setTierFilter(event.target.value as typeof tierFilter)}
              >
                <option value="ALL">All memberships</option>
                <option value="Free">Free</option>
                <option value="Pro">Pro</option>
                <option value="VIP">VIP</option>
              </select>
              <span className="filter-count">
                {filteredRows.length} / {rows.length}
              </span>
            </div>
          </Panel>
          <Panel className="table-panel market-inventory-panel">
            <div className="table-caption">
              <span>MARKET REGISTRY · EXPAND A ROW FOR EVERY REPORTED DETAIL</span>
              <span>{filteredRows.length} symbols</span>
            </div>
            {filteredRows.length ? (
              <div className="table-scroll">
                <table className="market-inventory-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Access</th>
                      <th>Provider mapping</th>
                      <th>Asset class</th>
                      <th>Digits</th>
                      <th>Feed status</th>
                      <th>Strategies</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <Fragment key={row.symbol}>
                        <tr>
                          <td>
                            <strong>{row.symbol}</strong>
                            {row.archived && <Pill tone="warn">Archived</Pill>}
                            <small className="block muted">{row.description}</small>
                            {row.displaySymbol !== row.symbol && (
                              <small className="block font-mono-ui">{row.displaySymbol}</small>
                            )}
                          </td>
                          <td>
                            <Pill
                              tone={
                                row.requiredTier === "Free"
                                  ? "good"
                                  : row.requiredTier === "VIP"
                                    ? "warn"
                                    : "neutral"
                              }
                            >
                              {row.requiredTier}
                            </Pill>
                            <small className="block muted">
                              {row.marketType === "STRATEGY" ? "Core market" : "MT5 watchlist"}
                            </small>
                          </td>
                          <td>
                            {row.provider}
                            <small className="block font-mono-ui">{row.providerSymbol}</small>
                          </td>
                          <td>{row.assetClass}</td>
                          <td className="font-mono-ui">{row.digits}</td>
                          <td>
                            <small className="block">
                              Quote:{" "}
                              {row.quoteAvailable === null
                                ? "Not reported"
                                : row.quoteAvailable
                                  ? "Available"
                                  : "Unavailable"}
                            </small>
                            <small className="block">
                              Candles:{" "}
                              {row.candlesAvailable === null
                                ? "Not reported"
                                : row.candlesAvailable
                                  ? "Available"
                                  : "Unavailable"}
                            </small>
                          </td>
                          <td>
                            {row.strategySupported
                              ? row.assignedStrategies.length
                                ? row.assignedStrategies.join(", ")
                                : "No active assignment"
                              : "No compatible strategy"}
                          </td>
                          <td>
                            <button
                              className="text-button"
                              aria-expanded={expandedSymbol === row.symbol}
                              onClick={() =>
                                setExpandedSymbol((current) =>
                                  current === row.symbol ? null : row.symbol,
                                )
                              }
                            >
                              {expandedSymbol === row.symbol ? "Hide details" : "View all details"}
                            </button>
                          </td>
                        </tr>
                        {expandedSymbol === row.symbol && (
                          <tr className="market-inventory-expanded">
                            <td colSpan={8}>
                              <div className="market-inventory-detail">
                                <div className="market-inventory-detail-heading">
                                  <div>
                                    <div className="eyebrow">FULL SYMBOL RECORD</div>
                                    <h3>
                                      {row.symbol} · {row.description}
                                    </h3>
                                  </div>
                                  <Pill tone={row.archived ? "warn" : "neutral"}>
                                    {row.archived
                                      ? "Archived"
                                      : row.marketType === "STRATEGY"
                                        ? "Core market"
                                        : "VIP MT5 watchlist"}
                                  </Pill>
                                </div>
                                <div className="market-inventory-detail-grid">
                                  <section className="inventory-detail-group">
                                    <h4>Identity & access</h4>
                                    <InventoryField label="Catalog ID" value={row.catalogId} />
                                    <InventoryField
                                      label="Display symbol"
                                      value={row.displaySymbol}
                                    />
                                    <InventoryField label="Description" value={row.description} />
                                    <InventoryField
                                      label="Required membership"
                                      value={row.requiredTier}
                                    />
                                    <InventoryField
                                      label="Market group"
                                      value={
                                        row.marketType === "STRATEGY"
                                          ? "Core catalog"
                                          : "MT5 watchlist"
                                      }
                                    />
                                    <InventoryField
                                      label="Strategy supported"
                                      value={row.strategySupported ? "Yes" : "No"}
                                    />
                                  </section>
                                  <section className="inventory-detail-group">
                                    <h4>Provider & instrument</h4>
                                    <InventoryField label="Provider" value={row.provider} />
                                    <InventoryField
                                      label="Provider symbol"
                                      value={row.providerSymbol}
                                    />
                                    <InventoryField label="Asset class" value={row.assetClass} />
                                    <InventoryField label="Price digits" value={row.digits} />
                                    <InventoryField label="Point" value={valueText(row.point)} />
                                    <InventoryField
                                      label="Tick size"
                                      value={valueText(row.tickSize)}
                                    />
                                    <InventoryField
                                      label="Base currency"
                                      value={valueText(row.currencyBase)}
                                    />
                                    <InventoryField
                                      label="Profit currency"
                                      value={valueText(row.currencyProfit)}
                                    />
                                    <InventoryField
                                      label="Trade mode"
                                      value={valueText(row.tradeMode)}
                                    />
                                    <InventoryField
                                      label="Chart mode"
                                      value={valueText(row.chartMode)}
                                    />
                                  </section>
                                  <section className="inventory-detail-group">
                                    <h4>Catalog & runtime status</h4>
                                    <InventoryField
                                      label="Quote available"
                                      value={
                                        row.quoteAvailable === null
                                          ? "Not reported"
                                          : row.quoteAvailable
                                            ? "Yes"
                                            : "No"
                                      }
                                    />
                                    <InventoryField
                                      label="Candles available"
                                      value={
                                        row.candlesAvailable === null
                                          ? "Not reported"
                                          : row.candlesAvailable
                                            ? "Yes"
                                            : "No"
                                      }
                                    />
                                    <InventoryField
                                      label="Strategy configured"
                                      value={row.strategyConfigured ? "Yes" : "No"}
                                    />
                                    <InventoryField
                                      label="Strategy ID"
                                      value={valueText(row.strategyId)}
                                    />
                                    <InventoryField
                                      label="Available strategies"
                                      value={
                                        row.availableStrategies.length
                                          ? row.availableStrategies.join(", ")
                                          : "None reported"
                                      }
                                    />
                                    <InventoryField
                                      label="Assigned strategies"
                                      value={
                                        row.assignedStrategies.length
                                          ? row.assignedStrategies.join(", ")
                                          : "None reported"
                                      }
                                    />
                                    <InventoryField
                                      label="Default strategy"
                                      value={valueText(row.defaultStrategyId)}
                                    />
                                    <InventoryField
                                      label="Supported timeframes"
                                      value={
                                        row.supportedTimeframes.length
                                          ? row.supportedTimeframes.join(", ")
                                          : "None reported"
                                      }
                                    />
                                  </section>
                                  <section className="inventory-detail-group">
                                    <h4>Admin control state</h4>
                                    <InventoryField
                                      label="Persisted control"
                                      value={row.controlManaged ? "Managed" : "Not managed"}
                                    />
                                    <InventoryField
                                      label="Archived"
                                      value={row.archived ? "Yes" : "No"}
                                    />
                                    <InventoryField
                                      label="Strategy enabled"
                                      value={
                                        row.enabled === null
                                          ? "Not reported"
                                          : row.enabled
                                            ? "Yes"
                                            : "No"
                                      }
                                    />
                                    <InventoryField
                                      label="Customer visible"
                                      value={
                                        row.visibleToUsers === null
                                          ? "Not applicable / not reported"
                                          : row.visibleToUsers
                                            ? "Yes"
                                            : "No"
                                      }
                                    />
                                    <InventoryField
                                      label="Revision"
                                      value={valueText(row.rowVersion)}
                                    />
                                    <InventoryField
                                      label="Last updated"
                                      value={fmtDate(row.updatedAt)}
                                    />
                                  </section>
                                  <section className="inventory-detail-group inventory-broker-spec">
                                    <h4>MT5 broker specification</h4>
                                    {row.brokerSpec ? (
                                      <>
                                        <InventoryField
                                          label="Broker symbol"
                                          value={row.brokerSpec.brokerSymbol}
                                        />
                                        <InventoryField
                                          label="Contract size"
                                          value={valueText(row.brokerSpec.contractSize)}
                                        />
                                        <InventoryField
                                          label="Tick size"
                                          value={valueText(row.brokerSpec.tickSize)}
                                        />
                                        <InventoryField
                                          label="Tick value"
                                          value={valueText(row.brokerSpec.tickValue)}
                                        />
                                        <InventoryField
                                          label="Profit tick value"
                                          value={valueText(row.brokerSpec.tickValueProfit)}
                                        />
                                        <InventoryField
                                          label="Loss tick value"
                                          value={valueText(row.brokerSpec.tickValueLoss)}
                                        />
                                        <InventoryField
                                          label="Minimum volume"
                                          value={valueText(row.brokerSpec.volumeMin)}
                                        />
                                        <InventoryField
                                          label="Maximum volume"
                                          value={valueText(row.brokerSpec.volumeMax)}
                                        />
                                        <InventoryField
                                          label="Volume step"
                                          value={valueText(row.brokerSpec.volumeStep)}
                                        />
                                        <InventoryField
                                          label="Broker digits"
                                          value={valueText(row.brokerSpec.digits)}
                                        />
                                        <InventoryField
                                          label="Broker point"
                                          value={valueText(row.brokerSpec.point)}
                                        />
                                        <InventoryField
                                          label="Quote currency"
                                          value={valueText(row.brokerSpec.quoteCurrency)}
                                        />
                                        <InventoryField
                                          label="Received"
                                          value={fmtDate(
                                            new Date(row.brokerSpec.receivedAt).toISOString(),
                                          )}
                                        />
                                      </>
                                    ) : (
                                      <p className="muted">
                                        No broker specification has been reported for this exact
                                        symbol.
                                      </p>
                                    )}
                                  </section>
                                </div>
                                {row.brokerSpec?.tradingSessions && (
                                  <section className="inventory-sessions">
                                    <h4>Broker trading sessions · server time</h4>
                                    <div className="inline-note">
                                      Source: {row.brokerSpec.tradingSessions.source} · Server
                                      timestamp {row.brokerSpec.tradingSessions.serverTime} · UTC
                                      timestamp {row.brokerSpec.tradingSessions.utcTime} · Offset{" "}
                                      {row.brokerSpec.tradingSessions.serverUtcOffsetSeconds}{" "}
                                      seconds
                                    </div>
                                    {row.brokerSpec.tradingSessions.sessions.length ? (
                                      <div className="table-scroll">
                                        <table>
                                          <thead>
                                            <tr>
                                              <th>Day</th>
                                              <th>From</th>
                                              <th>To</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {row.brokerSpec.tradingSessions.sessions.map(
                                              (session, index) => (
                                                <tr
                                                  key={`${session.dayOfWeek}-${session.fromSeconds}-${index}`}
                                                >
                                                  <td>{brokerSessionDay(session.dayOfWeek)}</td>
                                                  <td className="font-mono-ui">
                                                    {formatBrokerClock(session.fromSeconds)}
                                                  </td>
                                                  <td className="font-mono-ui">
                                                    {formatBrokerClock(session.toSeconds)}
                                                  </td>
                                                </tr>
                                              ),
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p className="muted">No trading windows reported.</p>
                                    )}
                                  </section>
                                )}
                                {canManage && row.controlManaged && (
                                  <div className="table-actions market-inventory-actions">
                                    <button
                                      className="text-button"
                                      disabled={update.isPending}
                                      onClick={() => saveSymbol(row)}
                                    >
                                      Edit mapping
                                    </button>
                                    {!row.archived && (
                                      <>
                                        <button
                                          className="text-button"
                                          disabled={update.isPending}
                                          onClick={() => toggle(row, "enabled")}
                                        >
                                          {row.enabled ? "Disable" : "Enable"}
                                        </button>
                                        <button
                                          className="text-button"
                                          disabled={update.isPending}
                                          onClick={() => toggle(row, "visibleToUsers")}
                                        >
                                          {row.visibleToUsers
                                            ? "Hide from customers"
                                            : "Show to customers"}
                                        </button>
                                        {row.availableStrategies.length > 0 ? (
                                          <Link
                                            data-testid={`link-assign-strategy-${row.symbol.toLowerCase()}`}
                                            className="text-button"
                                            href={`/assignments?symbol=${encodeURIComponent(row.symbol)}`}
                                          >
                                            Assign strategy
                                          </Link>
                                        ) : (
                                          <span className="muted">
                                            No current strategy supports {row.assetClass}
                                          </span>
                                        )}
                                      </>
                                    )}
                                    <button
                                      data-testid={`${row.archived ? "button-restore" : "button-archive"}-symbol-${row.symbol.toLowerCase()}`}
                                      className="text-button"
                                      disabled={update.isPending}
                                      onClick={() => setArchived(row)}
                                    >
                                      {row.archived ? "Restore" : "Archive"}
                                    </button>
                                  </div>
                                )}
                                {!row.brokerSpec && (
                                  <p className="inline-note">
                                    Bridge specifications and trading sessions are displayed when
                                    MT5 reports them. See Market data for live quotes, candle
                                    buffers and sync diagnostics.
                                  </p>
                                )}
                                <details className="market-inventory-raw">
                                  <summary>Raw admin market record</summary>
                                  <pre className="json-view">{JSON.stringify(row, null, 2)}</pre>
                                </details>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No matching symbols"
                body={
                  rows.length
                    ? "Change the search or filters to see configured markets."
                    : "No configured markets were returned by the inventory endpoint."
                }
              />
            )}
          </Panel>
          {update.error && (
            <div className="notice notice-warn" role="alert">
              <AlertTriangle size={16} />
              {getError(update.error)}
            </div>
          )}
        </>
      )}
    </>
  );
}

function StrategiesPage() {
  const qc = useQueryClient();
  const openActionDialog = useAdminActionDialog();
  const strategies = useGetAdminStrategies({
    query: { queryKey: getGetAdminStrategiesQueryKey() },
  });
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey() } });
  const update = useUpdateAdminStrategy();
  const capabilities = session.data?.staff.capabilities;
  const canManage = hasCapability(capabilities, "strategies.manage");
  const canDeploy = hasCapability(capabilities, "strategies.deploy");
  const setLifecycle = async (
    row: AdminStrategy,
    lifecycleStatus: "ACTIVE" | "PAUSED" | "ARCHIVED",
  ) => {
    const promptLabel =
      lifecycleStatus === "ACTIVE"
        ? "Activate"
        : lifecycleStatus === "PAUSED"
          ? "Pause"
          : "Archive";
    const values = await openActionDialog({
      title: `${promptLabel} strategy · ${row.id}`,
      description: `${promptLabel} this strategy version. The action and reason will be recorded in the administrator audit log.`,
      fields: [
        {
          name: "reason",
          label: "Audit reason",
          type: "textarea",
          required: true,
          placeholder: `Why ${promptLabel.toLowerCase()} this strategy version?`,
        },
      ],
      submitLabel: `${promptLabel} strategy`,
      intent:
        lifecycleStatus === "PAUSED" || lifecycleStatus === "ARCHIVED" ? "destructive" : "default",
    });
    if (!values) return;
    update.mutate(
      {
        strategyId: row.id,
        data: { lifecycleStatus, rowVersion: row.rowVersion, reason: values.reason.trim() },
      },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetAdminStrategiesQueryKey() }) },
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="STRATEGY CATALOG"
        title="Strategies"
        sub="Review lifecycle state and version history before changing deployment posture."
        actions={<RetryButton onClick={() => strategies.refetch()} />}
      />
      <div className="notice notice-info">
        <ShieldAlert size={17} />
        <span>
          Activation is shown only when the staff session includes deployment capability.
          Server-side authorization and validation remain decisive.
        </span>
      </div>
      <LoadState
        loading={strategies.isLoading}
        error={strategies.error}
        onRetry={() => strategies.refetch()}
      />
      {strategies.data && (
        <Panel className="table-panel">
          <div className="table-caption">
            <span>LIFECYCLE & VERSION RECORDS</span>
            <span>{strategies.data.length} versions</span>
          </div>
          {strategies.data.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Strategy</th>
                    <th>Version</th>
                    <th>Timeframe</th>
                    <th>Lifecycle</th>
                    <th>Markets</th>
                    <th>Last updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.data.map((row) => (
                    <tr key={`${row.id}:${row.version}`}>
                      <td>
                        <strong>{row.id}</strong>
                        <small className="block muted">{row.description}</small>
                      </td>
                      <td className="font-mono-ui">{row.version}</td>
                      <td>{row.timeframe}</td>
                      <td>
                        <Pill tone={statusTone(row.lifecycleStatus)}>{row.lifecycleStatus}</Pill>
                      </td>
                      <td>{row.assignedMarkets ?? "Not reported"}</td>
                      <td>{fmtDate(row.updatedAt)}</td>
                      <td>
                        <div className="table-actions">
                          {canManage && row.lifecycleStatus === "ACTIVE" && (
                            <button
                              className="text-button"
                              disabled={update.isPending}
                              onClick={() => setLifecycle(row, "PAUSED")}
                            >
                              <Pause size={12} /> Pause
                            </button>
                          )}
                          {canManage && row.lifecycleStatus !== "ARCHIVED" && (
                            <button
                              className="text-button"
                              disabled={update.isPending}
                              onClick={() => setLifecycle(row, "ARCHIVED")}
                            >
                              <Archive size={12} /> Archive
                            </button>
                          )}
                          {canDeploy &&
                            row.lifecycleStatus !== "ACTIVE" &&
                            row.lifecycleStatus !== "ARCHIVED" && (
                              <button
                                className="text-button"
                                disabled={update.isPending}
                                onClick={() => setLifecycle(row, "ACTIVE")}
                              >
                                Activate
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No strategy versions returned"
              body="No lifecycle records are available from the strategy endpoint."
            />
          )}
        </Panel>
      )}
      {update.error && (
        <div className="notice notice-warn" role="alert">
          <AlertTriangle size={16} />
          {getError(update.error)}
        </div>
      )}
    </>
  );
}

function AssignmentsPage() {
  const qc = useQueryClient();
  const openActionDialog = useAdminActionDialog();
  const assignments = useGetAdminAssignments({
    query: { queryKey: getGetAdminAssignmentsQueryKey() },
  });
  const strategies = useGetAdminStrategies({
    query: { queryKey: getGetAdminStrategiesQueryKey() },
  });
  const inventory = useGetAdminMarketInventory({
    query: { queryKey: getGetAdminMarketInventoryQueryKey(), refetchInterval: 30000 },
  });
  const create = useCreateAdminAssignment();
  const update = useUpdateAdminAssignment();
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey() } });
  const [creating, setCreating] = useState(false);
  const [strategyId, setStrategyId] = useState("");
  const [strategyVersion, setStrategyVersion] = useState("");
  const [symbol, setSymbol] = useState(
    () => new URLSearchParams(window.location.search).get("symbol") ?? "",
  );
  const [enabled, setEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState("");
  const compatibleSymbols =
    inventory.data?.filter(
      (item) =>
        !item.archived && Boolean(strategyId) && item.availableStrategies.includes(strategyId),
    ) ?? [];
  const canManage = hasCapability(session.data?.staff.capabilities, "strategies.manage");
  const doCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!strategyId || !strategyVersion || !symbol) return;
    create.mutate(
      {
        data: {
          strategyId,
          strategyVersion,
          symbol,
          timeframe: "M15",
          enabled,
          isDefault,
          notes: notes.trim() || null,
          reason: "Create strategy-symbol M15 assignment",
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetAdminAssignmentsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAdminMarketInventoryQueryKey() });
          setCreating(false);
          setNotes("");
        },
      },
    );
  };
  const editAssignment = async (row: AdminStrategyAssignment) => {
    const values = await openActionDialog({
      title: `Edit assignment · ${row.symbol}`,
      description: `Update ${row.strategyId} ${row.strategyVersion} for ${row.symbol}. Blank notes clear the current note.`,
      fields: [
        {
          name: "enabled",
          label: "Assignment state",
          type: "select",
          defaultValue: String(row.enabled),
          required: true,
          options: [
            { value: "true", label: "Enabled" },
            { value: "false", label: "Disabled" },
          ],
        },
        {
          name: "notes",
          label: "Assignment notes",
          type: "textarea",
          defaultValue: row.notes || "",
          helperText: "Optional. Leave blank to clear the current note.",
        },
        {
          name: "reason",
          label: "Audit reason",
          type: "textarea",
          required: true,
          placeholder: "Why is this assignment changing?",
        },
      ],
      submitLabel: "Save assignment",
    });
    if (!values) return;
    update.mutate(
      {
        assignmentId: row.id,
        data: {
          enabled: values.enabled === "true",
          isDefault: row.isDefault,
          notes: values.notes.trim() || null,
          rowVersion: row.rowVersion,
          reason: values.reason.trim(),
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetAdminAssignmentsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAdminMarketInventoryQueryKey() });
        },
      },
    );
  };
  const toggleDefault = async (row: AdminStrategyAssignment) => {
    const values = await openActionDialog({
      title: `${row.isDefault ? "Remove" : "Set"} default assignment · ${row.symbol}`,
      description: `This will ${row.isDefault ? "remove" : "set"} the default assignment for ${row.strategyId} ${row.strategyVersion} on ${row.symbol}.`,
      fields: [
        {
          name: "reason",
          label: "Audit reason",
          type: "textarea",
          required: true,
          placeholder: "Why is the default assignment changing?",
        },
      ],
      submitLabel: row.isDefault ? "Remove default" : "Set as default",
      intent: row.isDefault ? "destructive" : "default",
    });
    if (!values) return;
    update.mutate(
      {
        assignmentId: row.id,
        data: {
          enabled: row.enabled,
          isDefault: !row.isDefault,
          notes: row.notes,
          rowVersion: row.rowVersion,
          reason: values.reason.trim(),
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetAdminAssignmentsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAdminMarketInventoryQueryKey() });
        },
      },
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="STRATEGY ROUTING"
        title="Assignments"
        sub="Maintain enabled and default strategy links for M15 market rows. Assignments are never hard-deleted."
        actions={
          <>
            <RetryButton
              onClick={() => {
                assignments.refetch();
                strategies.refetch();
                inventory.refetch();
              }}
            />
            {canManage && (
              <button className="button button-primary" onClick={() => setCreating((v) => !v)}>
                <Plus size={15} /> New assignment
              </button>
            )}
          </>
        }
      />
      <div className="notice notice-info">
        <Shield size={17} />
        <span>
          Historical assignment records are retained. The symbol selector shows only active,
          non-archived symbols supported by the selected strategy; the API validates the same
          compatibility matrix.
        </span>
      </div>
      {creating && (
        <Panel>
          <div className="panel-head">
            <div>
              <div className="eyebrow">NEW ROUTING ROW</div>
              <h3>Assign strategy to symbol</h3>
            </div>
            <button
              className="icon-button"
              onClick={() => setCreating(false)}
              aria-label="Close assignment form"
            >
              <X size={16} />
            </button>
          </div>
          <form className="form-stack" onSubmit={doCreate}>
            <div className="filter-selects">
              <label>
                Strategy version
                <select
                  data-testid="select-assignment-strategy"
                  required
                  value={strategyId && strategyVersion ? `${strategyId}|${strategyVersion}` : ""}
                  onChange={(e) => {
                    const [id, version] = e.target.value.split("|");
                    const nextId = id || "";
                    setStrategyId(nextId);
                    setStrategyVersion(version || "");
                    if (
                      symbol &&
                      !inventory.data?.some(
                        (item) =>
                          item.symbol === symbol &&
                          !item.archived &&
                          item.availableStrategies.includes(nextId),
                      )
                    )
                      setSymbol("");
                  }}
                >
                  <option value="">Select strategy version</option>
                  {strategies.data?.map((s) => (
                    <option key={`${s.id}:${s.version}`} value={`${s.id}|${s.version}`}>
                      {s.id} · {s.version} · {s.lifecycleStatus}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Symbol
                <select
                  data-testid="select-assignment-symbol"
                  required
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                >
                  <option value="">Select compatible symbol</option>
                  {compatibleSymbols.map((item) => (
                    <option key={item.symbol} value={item.symbol}>
                      {item.symbol} · {item.displaySymbol}
                    </option>
                  ))}
                  {strategyId && inventory.data && compatibleSymbols.length === 0 && (
                    <option disabled value="__none__">
                      No current symbols support this strategy
                    </option>
                  )}
                </select>
              </label>
              <label>
                Timeframe
                <input value="M15" readOnly />
              </label>
            </div>
            <label>
              Notes
              <input
                value={notes}
                maxLength={1000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional operator context"
              />
            </label>
            <div className="filter-selects">
              <label>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />{" "}
                Enabled
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />{" "}
                Default
              </label>
            </div>
            <button
              className="button button-primary"
              type="submit"
              disabled={
                create.isPending ||
                !strategyId ||
                !compatibleSymbols.some((item) => item.symbol === symbol)
              }
            >
              <Save size={15} />
              {create.isPending ? "Saving assignment…" : "Create assignment"}
            </button>
            {create.error && (
              <div className="notice notice-warn" role="alert">
                <AlertTriangle size={16} />
                {getError(create.error)}
              </div>
            )}
          </form>
        </Panel>
      )}
      <LoadState
        loading={assignments.isLoading || strategies.isLoading || inventory.isLoading}
        error={assignments.error || strategies.error || inventory.error}
        onRetry={() => {
          assignments.refetch();
          strategies.refetch();
          inventory.refetch();
        }}
      />
      {assignments.data && (
        <Panel className="table-panel">
          <div className="table-caption">
            <span>ASSIGNMENT HISTORY</span>
            <span>{assignments.data.length} rows</span>
          </div>
          {assignments.data.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Strategy version</th>
                    <th>Symbol</th>
                    <th>Timeframe</th>
                    <th>Enabled</th>
                    <th>Default</th>
                    <th>Notes</th>
                    <th>Revision</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.data.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.strategyName || row.strategyId}</strong>
                        <small className="block muted">
                          {row.strategyVersion} · {row.strategyStatus}
                        </small>
                      </td>
                      <td>
                        {row.symbol}
                        <small className="block muted">{row.symbolDisplay}</small>
                      </td>
                      <td className="font-mono-ui">{row.timeframe}</td>
                      <td>
                        <Pill tone={row.enabled ? "good" : "warn"}>
                          {row.enabled ? "Enabled" : "Disabled"}
                        </Pill>
                      </td>
                      <td>{row.isDefault ? <Pill tone="good">Default</Pill> : "—"}</td>
                      <td>{row.notes || "—"}</td>
                      <td className="font-mono-ui">{row.rowVersion}</td>
                      <td>
                        {canManage ? (
                          <div className="table-actions">
                            <button
                              className="text-button"
                              disabled={update.isPending}
                              onClick={() => editAssignment(row)}
                            >
                              Edit notes/state
                            </button>
                            <button
                              className="text-button"
                              disabled={update.isPending}
                              onClick={() => toggleDefault(row)}
                            >
                              {row.isDefault ? "Unset default" : "Set default"}
                            </button>
                          </div>
                        ) : (
                          <span className="muted">Read only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No assignments returned"
              body="There are no strategy-symbol assignments in the current server response."
            />
          )}
        </Panel>
      )}
      {update.error && (
        <div className="notice notice-warn" role="alert">
          <AlertTriangle size={16} />
          {getError(update.error)}
        </div>
      )}
    </>
  );
}

function EvaluationsPage() {
  const [draft, setDraft] = useState({
    from: "",
    to: "",
    symbol: "",
    strategy: "",
    strategyVersion: "",
    timeframe: "",
    result: "",
    generated: "",
    signalId: "",
    error: "",
  });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const pageSize = 25;
  const params: GetAdminEvaluationsParams = {
    ...(filters.from ? { from: new Date(filters.from).toISOString() } : {}),
    ...(filters.to ? { to: new Date(filters.to).toISOString() } : {}),
    ...(filters.symbol ? { symbol: filters.symbol } : {}),
    ...(filters.strategy ? { strategy: filters.strategy } : {}),
    ...(filters.strategyVersion ? { strategyVersion: filters.strategyVersion } : {}),
    ...(filters.timeframe ? { timeframe: filters.timeframe } : {}),
    ...(filters.result ? { result: filters.result } : {}),
    ...(filters.generated ? { generated: filters.generated === "true" } : {}),
    ...(filters.signalId ? { signalId: filters.signalId } : {}),
    ...(filters.error ? { error: filters.error } : {}),
    page,
    pageSize,
  };
  const query = useGetAdminEvaluations(params, {
    query: {
      queryKey: getGetAdminEvaluationsQueryKey(params),
      placeholderData: (previous) => previous,
    },
  });
  const detail = useGetAdminEvaluation(selectedId, {
    query: { enabled: !!selectedId, queryKey: getGetAdminEvaluationQueryKey(selectedId) },
  });
  const setField = (field: keyof typeof draft, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));
  const apply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draft });
  };
  return (
    <>
      <PageHeader
        eyebrow="PERSISTED EVALUATION LOG"
        title="Evaluation history"
        sub="Search server-recorded evaluations and inspect linked signal snapshots."
        actions={<RetryButton onClick={() => query.refetch()} />}
      />
      <Panel>
        <form onSubmit={apply} className="evaluation-filters">
          <label>
            From
            <input
              type="datetime-local"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setField("from", e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="datetime-local"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setField("to", e.target.value)}
            />
          </label>
          <label>
            Symbol
            <input value={draft.symbol} onChange={(e) => setField("symbol", e.target.value)} />
          </label>
          <label>
            Strategy
            <input value={draft.strategy} onChange={(e) => setField("strategy", e.target.value)} />
          </label>
          <label>
            Version
            <input
              value={draft.strategyVersion}
              onChange={(e) => setField("strategyVersion", e.target.value)}
            />
          </label>
          <label>
            Timeframe
            <input
              value={draft.timeframe}
              onChange={(e) => setField("timeframe", e.target.value)}
              placeholder="M15"
            />
          </label>
          <label>
            Result
            <input value={draft.result} onChange={(e) => setField("result", e.target.value)} />
          </label>
          <label>
            Generated
            <select value={draft.generated} onChange={(e) => setField("generated", e.target.value)}>
              <option value="">Any</option>
              <option value="true">Generated</option>
              <option value="false">Not generated</option>
            </select>
          </label>
          <label>
            Signal ID
            <input value={draft.signalId} onChange={(e) => setField("signalId", e.target.value)} />
          </label>
          <label>
            Error category
            <input value={draft.error} onChange={(e) => setField("error", e.target.value)} />
          </label>
          <div className="filter-selects">
            <button className="button button-primary" type="submit">
              <Filter size={15} /> Apply filters
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                const empty = {
                  from: "",
                  to: "",
                  symbol: "",
                  strategy: "",
                  strategyVersion: "",
                  timeframe: "",
                  result: "",
                  generated: "",
                  signalId: "",
                  error: "",
                };
                setDraft(empty);
                setFilters(empty);
                setPage(1);
              }}
            >
              Clear
            </button>
          </div>
        </form>
      </Panel>
      <LoadState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} />
      {query.data && (
        <Panel className="table-panel">
          <div className="table-caption">
            <span>SEARCH RESULTS</span>
            <span>
              {query.data.total} total · page {query.data.page}
            </span>
          </div>
          {query.data.items.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Symbol</th>
                    <th>Strategy / version</th>
                    <th>Timeframe</th>
                    <th>Result</th>
                    <th>Generated</th>
                    <th>Signal ID</th>
                    <th>Error</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((row: AdminEvaluation) => (
                    <tr key={row.id}>
                      <td>{fmtDate(row.createdAt)}</td>
                      <td>
                        <strong>{row.symbol}</strong>
                      </td>
                      <td>
                        {row.strategyId || "Not assigned"}
                        <small className="block muted">
                          {row.strategyVersion || "Version not reported"}
                        </small>
                      </td>
                      <td>{row.timeframe}</td>
                      <td>
                        <Pill tone={statusTone(row.result)}>{row.result}</Pill>
                        <small className="block muted">
                          {row.reason || row.errorCategory || ""}
                        </small>
                      </td>
                      <td>{row.signalGenerated ? <Pill tone="good">Yes</Pill> : "No"}</td>
                      <td className="font-mono-ui">{row.signalId || "—"}</td>
                      <td>{row.errorCategory || "—"}</td>
                      <td>
                        <button className="text-button" onClick={() => setSelectedId(row.id)}>
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No evaluations match"
              body="No server-recorded evaluations match the current filters."
            />
          )}
          {query.data.items.length > 0 && (
            <div className="pagination">
              <button
                className="button button-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={15} /> Previous
              </button>
              <span>
                Page {query.data.page} of{" "}
                {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))}
              </span>
              <button
                className="button button-secondary"
                disabled={page * pageSize >= query.data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}
        </Panel>
      )}
      {selectedId && (
        <div className="modal-backdrop" onClick={() => setSelectedId("")}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <div className="eyebrow">EVALUATION RECORD</div>
                <h3>Linked signal snapshot</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelectedId("")}
                aria-label="Close evaluation details"
              >
                <X size={16} />
              </button>
            </div>
            <LoadState
              loading={detail.isLoading}
              error={detail.error}
              onRetry={() => detail.refetch()}
            />
            {detail.data && (
              <>
                <div className="detail-list">
                  <div className="detail-row">
                    <span>Evaluation</span>
                    <strong className="font-mono-ui">{detail.data.id}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Result / reason</span>
                    <strong>
                      {detail.data.result} · {detail.data.reason || "No reason reported"}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>Strategy</span>
                    <strong>
                      {detail.data.strategyId || "Not reported"} /{" "}
                      {detail.data.strategyVersion || "Not reported"}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>Trusted market data</span>
                    <strong>{detail.data.marketDataTrusted ? "Yes" : "No"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Signal ID</span>
                    <strong>{detail.data.signalId || "Not generated"}</strong>
                  </div>
                </div>
                <h4>Signal snapshot returned by the server</h4>
                <pre className="json-view">
                  {detail.data.signal
                    ? JSON.stringify(detail.data.signal, null, 2)
                    : "No linked signal snapshot was returned."}
                </pre>
                <details>
                  <summary>Evaluation details</summary>
                  <pre className="json-view">{JSON.stringify(detail.data.details, null, 2)}</pre>
                </details>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MarketDiagnosticsPage() {
  const diagnostics = useGetAdminDiagnostics({
    query: { queryKey: getGetAdminDiagnosticsQueryKey(), refetchInterval: 30000 },
  });
  const symbols = useGetAdminSymbols({ query: { queryKey: getGetAdminSymbolsQueryKey() } });
  const xauLab = useGetAdminLab(
    { symbol: "XAUUSD" },
    {
      query: {
        queryKey: getGetAdminLabQueryKey({ symbol: "XAUUSD" }),
        refetchOnWindowFocus: false,
      },
    },
  );
  const xau = symbols.data?.find((item) => item.symbol === "XAUUSD");
  const diagnosticRows = Array.isArray(diagnostics.data)
    ? diagnostics.data
    : diagnostics.data && typeof diagnostics.data === "object"
      ? Object.values(diagnostics.data as Record<string, unknown>)
      : [];
  const xauDiagnostic = diagnosticRows.find(
    (item) =>
      !!item && typeof item === "object" && (item as Record<string, unknown>).symbol === "XAUUSD",
  ) as Record<string, unknown> | undefined;
  const lab = xauLab.data as Record<string, unknown> | undefined;
  const bridgeEvidence =
    lab?.bridgeEvidence && typeof lab.bridgeEvidence === "object"
      ? (lab.bridgeEvidence as Record<string, unknown>)
      : undefined;
  const findEvidence = (obj: unknown, test: RegExp, depth = 0): unknown => {
    if (depth > 5 || !obj || typeof obj !== "object") return undefined;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (test.test(key) && (typeof value !== "object" || value === null)) return value;
    }
    for (const value of Object.values(obj as Record<string, unknown>)) {
      const found = findEvidence(value, test, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const m15Count =
    bridgeEvidence?.m15CandleCount ??
    (xauDiagnostic?.candleBuffers && typeof xauDiagnostic.candleBuffers === "object"
      ? (xauDiagnostic.candleBuffers as Record<string, unknown>).M15
      : undefined);
  const heartbeat = bridgeEvidence?.lastHeartbeat;
  const heartbeatText =
    typeof heartbeat === "number"
      ? fmtDate(new Date(heartbeat).toISOString())
      : valueText(heartbeat);
  return (
    <>
      <PageHeader
        eyebrow="EVIDENCE-LED MARKET OPERATIONS"
        title="Market diagnostics"
        sub="Inspect observed bridge, quote, candle and evaluation evidence without inferring health."
        actions={
          <RetryButton
            onClick={() => {
              diagnostics.refetch();
              symbols.refetch();
              if (xauLab.data) xauLab.refetch();
            }}
          />
        }
      />
      <div className="notice notice-info">
        <ShieldAlert size={17} />
        <span>
          Only values returned by the diagnostics and lab endpoints are shown. Missing or stale
          evidence is not interpreted as a healthy feed.
        </span>
      </div>
      <LoadState
        loading={diagnostics.isLoading || symbols.isLoading}
        error={diagnostics.error || symbols.error}
        onRetry={() => {
          diagnostics.refetch();
          symbols.refetch();
        }}
      />
      <Panel>
        <div className="panel-head">
          <div>
            <div className="eyebrow">BRIDGE & CATALOG EVIDENCE</div>
            <h3>Live market diagnostics</h3>
          </div>
          <Pill>{diagnostics.data ? "RESPONSE RECEIVED" : "UNREPORTED"}</Pill>
        </div>
        {diagnosticRows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Observed bridge symbol</th>
                  <th>Configured mapping</th>
                  <th>Enabled</th>
                  <th>Quote available</th>
                  <th>Quote age</th>
                  <th>M15 buffer</th>
                  <th>Reported sync state</th>
                </tr>
              </thead>
              <tbody>
                {diagnosticRows.map((item, index) => {
                  const d = item as Record<string, unknown>;
                  const buffers = d.candleBuffers as Record<string, unknown> | undefined;
                  return (
                    <tr key={String(d.symbol || index)}>
                      <td>
                        <strong>{valueText(d.symbol)}</strong>
                      </td>
                      <td>{valueText(d.observedBrokerSymbol)}</td>
                      <td>{valueText(d.configuredBrokerSymbol || d.configuredProviderSymbol)}</td>
                      <td>{valueText(d.enabled)}</td>
                      <td>{valueText(d.quoteExists)}</td>
                      <td>
                        {d.quoteAgeMs == null ? "Not reported" : `${valueText(d.quoteAgeMs)} ms`}
                      </td>
                      <td>{valueText(buffers?.M15)}</td>
                      <td>{valueText(d.syncState)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !diagnostics.isLoading && (
            <Empty
              title="No diagnostics returned"
              body="The server response did not include market diagnostic rows."
            />
          )
        )}
      </Panel>
      <Panel>
        <div className="panel-head">
          <div>
            <div className="eyebrow">XAUUSD · REAL EVIDENCE VIEW</div>
            <h3>Gold evaluation and data path</h3>
          </div>
          <Pill tone={xauLab.data ? "neutral" : "warn"}>
            {xauLab.data ? "LAB RESPONSE RECEIVED" : "EVIDENCE NOT REPORTED"}
          </Pill>
        </div>
        <LoadState
          loading={xauLab.isLoading}
          error={xauLab.error}
          onRetry={() => xauLab.refetch()}
        />
        {lab && (
          <>
            <div className="metric-grid">
              <Metric
                label="Evaluation result"
                value={lab.evaluationResult}
                note="Lab-reported value"
                icon={Activity}
              />
              <Metric
                label="Evaluation reason"
                value={lab.rejectionReason}
                note="No inferred diagnosis"
                icon={CircleHelp}
              />
              <Metric
                label="Last bridge heartbeat"
                value={heartbeatText}
                note={
                  bridgeEvidence?.lastHeartbeatAgeSeconds == null
                    ? "Heartbeat age not reported"
                    : `Age ${valueText(bridgeEvidence.lastHeartbeatAgeSeconds)} s`
                }
                icon={Clock3}
              />
              <Metric
                label="Quote availability"
                value={bridgeEvidence?.quoteAvailable}
                note={
                  bridgeEvidence?.quoteAgeSeconds == null
                    ? "Quote age not reported"
                    : `Age ${valueText(bridgeEvidence.quoteAgeSeconds)} s`
                }
                icon={Gauge}
              />
            </div>
            <div className="detail-list">
              <div className="detail-row">
                <span>Observed bridge symbol</span>
                <strong>{valueText(xauDiagnostic?.observedBrokerSymbol)}</strong>
              </div>
              <div className="detail-row">
                <span>Configured mapping</span>
                <strong>
                  {valueText(
                    xauDiagnostic?.configuredBrokerSymbol ||
                      xauDiagnostic?.configuredProviderSymbol ||
                      xau?.providerSymbol,
                  )}
                </strong>
              </div>
              <div className="detail-row">
                <span>Evaluation symbol / strategy</span>
                <strong>
                  {valueText(lab.symbol)} / {valueText(lab.strategy)}
                </strong>
              </div>
              <div className="detail-row">
                <span>M15 candle count</span>
                <strong>{valueText(m15Count)}</strong>
              </div>
              <div className="detail-row">
                <span>Validation</span>
                <strong>{valueText(findEvidence(lab, /validation|valid/i))}</strong>
              </div>
              <div className="detail-row">
                <span>Trusted status</span>
                <strong>{valueText(bridgeEvidence?.marketDataTrusted)}</strong>
              </div>
            </div>
            <details>
              <summary>Full admin lab evidence payload</summary>
              <pre className="json-view">{JSON.stringify(lab, null, 2)}</pre>
            </details>
          </>
        )}
      </Panel>
    </>
  );
}

function StaffAccessPage() {
  const qc = useQueryClient();
  const openActionDialog = useAdminActionDialog();
  const staff = useGetAdminStaff({ query: { queryKey: getGetAdminStaffQueryKey() } });
  const create = useCreateAdminStaff();
  const update = useUpdateAdminStaff();
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey() } });
  const canManage = hasCapability(session.data?.staff.capabilities, "staff.manage");
  const roles = ["SUPER_ADMIN", "OPERATIONS", "SUPPORT", "FINANCE", "READ_ONLY"];
  const knownPermissions = [
    "users.read",
    "users.manage",
    "memberships.read",
    "memberships.manage",
    "payments.read",
    "payments.manage",
    "strategies.read",
    "strategies.manage",
    "strategies.deploy",
    "symbols.read",
    "symbols.manage",
    "signals.read",
    "market_data.read",
    "market_data.manage",
    "notifications.read",
    "notifications.manage",
    "audit.read",
    "staff.read",
    "staff.manage",
    "configuration.read",
    "configuration.manage",
  ];
  const roleOptions = roles.map((role) => ({ value: role, label: role.replaceAll("_", " ") }));
  const createStaff = async () => {
    const values = await openActionDialog({
      title: "Grant staff access",
      description:
        "Select an existing account, assign its staff role and record why access is being granted.",
      fields: [
        {
          name: "userId",
          label: "Existing user ID",
          required: true,
          placeholder: "Paste the user ID from the customer record",
        },
        {
          name: "role",
          label: "Staff role",
          type: "select",
          defaultValue: "READ_ONLY",
          required: true,
          options: roleOptions,
        },
        {
          name: "permissions",
          label: "Custom permissions",
          type: "textarea",
          helperText: `Comma-separated values. Known permissions: ${knownPermissions.join(", ")}`,
          placeholder: "Optional custom permissions",
        },
        {
          name: "reason",
          label: "Audit reason",
          type: "textarea",
          required: true,
          placeholder: "Why is staff access required?",
        },
      ],
      submitLabel: "Grant access",
      intent: "destructive",
    });
    if (!values) return;
    create.mutate(
      {
        data: {
          userId: values.userId.trim(),
          role: values.role as "SUPER_ADMIN" | "OPERATIONS" | "SUPPORT" | "FINANCE" | "READ_ONLY",
          customPermissions: values.permissions
            .split(",")
            .map((p) => p.trim())
            .filter((p) => knownPermissions.includes(p)) as never[],
          active: true,
          reason: values.reason.trim(),
        },
      },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetAdminStaffQueryKey() }) },
    );
  };
  const editStaff = async (row: StaffAccessSummary) => {
    const values = await openActionDialog({
      title: `Edit staff access · ${row.name || row.email}`,
      description: `Change the role or custom permissions for ${row.email}. Changes are recorded in the audit history.`,
      fields: [
        {
          name: "role",
          label: "Staff role",
          type: "select",
          defaultValue: row.role,
          required: true,
          options: roleOptions,
        },
        {
          name: "permissions",
          label: "Custom permissions",
          type: "textarea",
          defaultValue: row.customPermissions.join(", "),
          helperText: `Comma-separated values. Known permissions: ${knownPermissions.join(", ")}`,
        },
        {
          name: "reason",
          label: "Audit reason",
          type: "textarea",
          required: true,
          placeholder: "Why is this access changing?",
        },
      ],
      submitLabel: "Save access",
    });
    if (!values) return;
    update.mutate(
      {
        userId: row.userId,
        data: {
          role: values.role as "SUPER_ADMIN" | "OPERATIONS" | "SUPPORT" | "FINANCE" | "READ_ONLY",
          customPermissions: values.permissions
            .split(",")
            .map((p) => p.trim())
            .filter((p) => knownPermissions.includes(p)) as never[],
          active: row.active,
          rowVersion: row.rowVersion,
          reason: values.reason.trim(),
        },
      },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetAdminStaffQueryKey() }) },
    );
  };
  const toggleActive = async (row: StaffAccessSummary) => {
    const action = row.active ? "Deactivate" : "Reactivate";
    const values = await openActionDialog({
      title: `${action} staff access · ${row.name || row.email}`,
      description: `${action} ${row.email}'s staff access. This action is auditable and can be reversed later.`,
      fields: [
        {
          name: "reason",
          label: "Audit reason",
          type: "textarea",
          required: true,
          placeholder: `Why ${action.toLowerCase()} this staff account?`,
        },
      ],
      submitLabel: `${action} access`,
      intent: row.active ? "destructive" : "default",
    });
    if (!values) return;
    update.mutate(
      {
        userId: row.userId,
        data: {
          role: row.role,
          customPermissions: row.customPermissions as never[],
          active: !row.active,
          rowVersion: row.rowVersion,
          reason: values.reason.trim(),
        },
      },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetAdminStaffQueryKey() }) },
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="STAFF CONTROL PLANE"
        title="Staff access"
        sub="Manage staff roles and explicit permissions, separate from customer account roles."
        actions={
          <>
            {canManage && (
              <button className="button button-primary" onClick={createStaff}>
                <Plus size={15} /> Grant staff access
              </button>
            )}
            <RetryButton onClick={() => staff.refetch()} />
          </>
        }
      />
      <div className="notice notice-info">
        <Shield size={17} />
        <span>
          This view is gated by staff capabilities. Customer roles are not staff permissions; server
          authorization remains authoritative.
        </span>
      </div>
      <LoadState loading={staff.isLoading} error={staff.error} onRetry={() => staff.refetch()} />
      {staff.data && (
        <Panel className="table-panel">
          <div className="table-caption">
            <span>AUTHORIZED STAFF</span>
            <span>{staff.data.length} records</span>
          </div>
          {staff.data.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Staff identity</th>
                    <th>Role</th>
                    <th>Custom permissions</th>
                    <th>Active</th>
                    <th>Revision</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.data.map((row) => (
                    <tr key={row.userId}>
                      <td>
                        <strong>{row.name || row.email}</strong>
                        <small className="block muted">
                          {row.email} · {row.userId}
                        </small>
                      </td>
                      <td>
                        <Pill>{row.role}</Pill>
                      </td>
                      <td>
                        {row.customPermissions.length ? row.customPermissions.join(", ") : "None"}
                      </td>
                      <td>
                        <Pill tone={row.active ? "good" : "warn"}>
                          {row.active ? "Active" : "Inactive"}
                        </Pill>
                      </td>
                      <td className="font-mono-ui">{row.rowVersion}</td>
                      <td>
                        {fmtDate(row.updatedAt)}
                        <small className="block muted">
                          {row.updatedBy || "Updater not reported"}
                        </small>
                      </td>
                      <td>
                        {canManage ? (
                          <div className="table-actions">
                            <button
                              className="text-button"
                              disabled={update.isPending}
                              onClick={() => editStaff(row)}
                            >
                              Edit access
                            </button>
                            <button
                              className="text-button"
                              disabled={update.isPending}
                              onClick={() => toggleActive(row)}
                            >
                              {row.active ? "Deactivate" : "Reactivate"}
                            </button>
                          </div>
                        ) : (
                          <span className="muted">Read only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No staff access records"
              body="No staff access assignments were returned."
            />
          )}
        </Panel>
      )}
      {(create.error || update.error) && (
        <div className="notice notice-warn" role="alert">
          <AlertTriangle size={16} />
          {getError(create.error || update.error)}
        </div>
      )}
    </>
  );
}

function CapabilityGate({
  capabilities,
  required,
  children,
}: {
  capabilities: string[];
  required: string;
  children: ReactNode;
}) {
  return hasCapability(capabilities, required) ? (
    <>{children}</>
  ) : (
    <Panel>
      <div className="notice notice-warn">
        <ShieldAlert size={17} />
        <span>
          This staff session does not advertise the <strong>{required}</strong> capability. The
          server remains the authorization authority.
        </span>
      </div>
    </Panel>
  );
}

function NotificationsPage({ capabilities }: { capabilities: string[] }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<GetAdminNotificationsParams["status"]>();
  const [page, setPage] = useState(1);
  const [retryTarget, setRetryTarget] = useState<AdminNotificationDelivery | null>(null);
  const [reason, setReason] = useState("");
  const [retryError, setRetryError] = useState("");
  const params = useMemo<GetAdminNotificationsParams>(
    () => ({ ...(status ? { status } : {}), page, pageSize: 25 }),
    [status, page],
  );
  const deliveries = useGetAdminNotifications(params, {
    query: {
      queryKey: getGetAdminNotificationsQueryKey(params),
      refetchInterval: 15_000,
    },
  });
  const retry = useRetryAdminNotification();
  const canManage = hasCapability(capabilities, "notifications.manage");
  const totalPages = Math.max(1, Math.ceil((deliveries.data?.total ?? 0) / (deliveries.data?.pageSize ?? 25)));
  const submitRetry = (event: FormEvent) => {
    event.preventDefault();
    if (!retryTarget || reason.trim().length === 0) return;
    setRetryError("");
    retry.mutate(
      {
        channel: retryTarget.channel,
        id: retryTarget.id,
        data: { reason: reason.trim() },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminNotificationsQueryKey() });
          setRetryTarget(null);
          setReason("");
        },
        onError: (error) => setRetryError(getError(error)),
      },
    );
  };
  const openRetry = (delivery: AdminNotificationDelivery) => {
    setRetryTarget(delivery);
    setRetryError("");
    setReason("");
  };
  const statusToneForDelivery = (deliveryStatus: string) =>
    deliveryStatus === "ACCEPTED" ? "good" : deliveryStatus === "FAILED" ? "warn" : "neutral";
  const eligibilityRejection =
    /eligib|audience|entitlement|suppressed|not eligible/i.test(retryError);

  return (
    <>
      <PageHeader
        eyebrow="CUSTOMER DELIVERY · OPERATIONS"
        title="Notification center"
        sub="Inspect push delivery across web and Expo. Retries always re-check customer eligibility."
        actions={
          <>
            <span className="refresh-label">
              <span className="notification-live-dot" /> Polling every 15 seconds
            </span>
            <button
              className="button button-secondary"
              onClick={() => deliveries.refetch()}
              disabled={deliveries.isFetching}
              data-testid="button-refresh-notifications"
            >
              <RefreshCw size={15} className={deliveries.isFetching ? "notification-refreshing" : ""} />
              {deliveries.isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </>
        }
      />

      <div className="notification-boundary">
        <span className="notification-boundary-icon"><Shield size={17} /></span>
        <div>
          <strong>Entitlement checks stay authoritative</strong>
          <p>Delivery records contain operational metadata only. Provider tokens and credentials are never shown here.</p>
        </div>
        <span className="notification-boundary-tag">STAFF CONSOLE</span>
      </div>
      <p className="notification-delivery-note">
        “Accepted” means the push service accepted the request; delivery to a device is not confirmed.
      </p>

      <Panel className="notification-panel">
        <div className="notification-toolbar">
          <div>
            <div className="eyebrow">DELIVERY RECORDS</div>
            <h3>Recent push activity</h3>
            <p>Changes from other staff appear automatically.</p>
          </div>
          <label className="notification-filter">
            <Filter size={15} />
            <span>Status</span>
            <select
              value={status ?? ""}
              onChange={(event) => {
                setStatus((event.target.value || undefined) as GetAdminNotificationsParams["status"]);
                setPage(1);
              }}
              data-testid="select-notification-status"
              aria-label="Filter notification status"
            >
              <option value="">All statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="ACCEPTED">Accepted by push service</option>
              <option value="FAILED">Failed</option>
              <option value="SUPPRESSED">Suppressed</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
        </div>

        {deliveries.isLoading ? (
          <LoadState loading />
        ) : deliveries.isError && !deliveries.data ? (
          <LoadState error={deliveries.error} onRetry={() => deliveries.refetch()} />
        ) : (
          <>
            {deliveries.isError && deliveries.data && (
              <div className="notice notice-warn notification-inline-notice" role="alert">
                <AlertTriangle size={16} />
                <span>The latest refresh failed. Showing the last successfully loaded records; retry when ready.</span>
                <button className="text-button" onClick={() => deliveries.refetch()} data-testid="button-retry-notification-load">
                  Try again
                </button>
              </div>
            )}
            {deliveries.data?.partial && (
              <div className="notice notice-warn notification-inline-notice" role="status" data-testid="notice-partial-channels">
                <AlertTriangle size={16} />
                <div>
                  <strong>Some channel records are unavailable</strong>
                  <p>
                    {deliveries.data.unavailableChannels.length
                      ? `${deliveries.data.unavailableChannels.join(" and ")} channel data could not be read. Available records are still shown.`
                      : "A channel did not return complete data. Available records are still shown."}
                  </p>
                </div>
              </div>
            )}
            {deliveries.data?.items.length ? (
              <>
                <div className="notification-table-wrap">
                  <table className="notification-table">
                    <thead>
                      <tr>
                        <th>Delivery</th>
                        <th>Channel</th>
                        <th>Status</th>
                        <th>Context</th>
                        <th>Attempts / code</th>
                        <th>Updated</th>
                        {canManage && <th aria-label="Actions" />}
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.data.items.map((item) => (
                        <tr key={`${item.channel}-${item.id}`} data-testid={`row-notification-${item.channel}-${item.id}`}>
                          <td>
                            <strong className="notification-id">{item.id}</strong>
                            <small>Notification {item.notificationId}</small>
                            <small>User {item.userId}</small>
                          </td>
                          <td><span className={`notification-channel channel-${item.channel.toLowerCase()}`}>{item.channel}</span></td>
                          <td>
                            <Pill tone={statusToneForDelivery(item.status)}>
                              {item.status === "ACCEPTED" ? "Accepted" : item.status}
                            </Pill>
                          </td>
                          <td>
                            <strong>{item.symbol || "General"}</strong>
                            <small>{item.category} / {item.eventType}</small>
                          </td>
                          <td>
                            <strong>{item.attempts} {item.attempts === 1 ? "attempt" : "attempts"}</strong>
                            <small>{item.lastStatusCode === null ? "No status code" : `HTTP ${item.lastStatusCode}`}</small>
                          </td>
                          <td>
                            <strong>{fmtDate(item.updatedAt)}</strong>
                            <small>Created {fmtDate(item.createdAt)}</small>
                          </td>
                          {canManage && (
                            <td className="notification-action-cell">
                              {item.status === "FAILED" ? (
                                <button
                                  className="button button-secondary notification-retry-button"
                                  onClick={() => openRetry(item)}
                                  disabled={retry.isPending}
                                  data-testid={`button-retry-notification-${item.channel}-${item.id}`}
                                >
                                  <RotateCcw size={14} /> Retry
                                </button>
                              ) : <span className="notification-no-action">—</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="notification-pagination">
                  <span>
                    {deliveries.data.total === 0
                      ? "No records"
                      : `${(page - 1) * (deliveries.data.pageSize || 25) + 1}–${Math.min(page * (deliveries.data.pageSize || 25), deliveries.data.total)} of ${deliveries.data.total}`}
                    {deliveries.isFetching && <i className="notification-sync-mark" aria-label="Updating" />}
                  </span>
                  <div>
                    <button
                      className="button button-secondary"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1}
                      data-testid="button-notifications-previous"
                    ><ChevronLeft size={15} /> Previous</button>
                    <span className="font-mono-ui">PAGE {page} / {totalPages}</span>
                    <button
                      className="button button-secondary"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page >= totalPages}
                      data-testid="button-notifications-next"
                    >Next <ChevronRight size={15} /></button>
                  </div>
                </div>
              </>
            ) : (
              <Empty
                title={status ? `No ${status.toLowerCase()} deliveries` : "No delivery records yet"}
                body="When Tradify queues customer push notifications, delivery attempts will appear here."
              />
            )}
          </>
        )}
      </Panel>

      {retryTarget && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !retry.isPending) setRetryTarget(null);
        }}>
          <section
            className="modal-card notification-retry-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-retry-title"
            data-testid="dialog-retry-notification"
          >
            <div className="panel-head">
              <div>
                <div className="eyebrow">AUDITED ACTION</div>
                <h3 id="notification-retry-title">Retry failed delivery</h3>
              </div>
              <button
                className="icon-button"
                aria-label="Close retry dialog"
                onClick={() => setRetryTarget(null)}
                disabled={retry.isPending}
                data-testid="button-close-notification-retry"
              ><X size={16} /></button>
            </div>
            <p className="notification-modal-context">
              <span className={`notification-channel channel-${retryTarget.channel.toLowerCase()}`}>{retryTarget.channel}</span>
              <strong>{retryTarget.id}</strong>
              <span>for user {retryTarget.userId}</span>
            </p>
            <div className="notice notice-info notification-inline-notice">
              <Shield size={16} />
              <span>Retry requests re-evaluate the current audience and entitlement rules. A customer who is no longer eligible will not receive this notification.</span>
            </div>
            {retryError && (
              <div className="notice notice-warn notification-inline-notice" role="alert" data-testid="text-notification-retry-error">
                <AlertTriangle size={16} />
                <div>
                  <strong>{eligibilityRejection ? "Audience eligibility rejected this retry" : "Retry was not accepted"}</strong>
                  <p>{retryError}</p>
                  {eligibilityRejection && <p>Eligibility is enforced by the server; this action cannot override audience or entitlement checks.</p>}
                </div>
              </div>
            )}
            <form onSubmit={submitRetry} className="form-stack">
              <label>
                Audit reason
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  minLength={1}
                  required
                  rows={3}
                  placeholder="Why should this failed delivery be retried?"
                  data-testid="input-notification-retry-reason"
                />
                <small className="field-help">Required for the audit trail. {reason.length}/500</small>
              </label>
              <div className="notification-modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setRetryTarget(null)}
                  disabled={retry.isPending}
                  data-testid="button-cancel-notification-retry"
                >Cancel</button>
                <button
                  className="button button-primary"
                  disabled={retry.isPending || !reason.trim()}
                  data-testid="button-submit-notification-retry"
                >
                  <Send size={14} /> {retry.isPending ? "Submitting…" : "Submit retry"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function NotFoundPage() {
  return (
    <div className="not-found">
      <div className="eyebrow">404 / NOT FOUND</div>
      <h1>This route is not in the console.</h1>
      <Link href="/" className="button button-primary">
        Return to operations <ChevronRight size={16} />
      </Link>
    </div>
  );
}

function ProtectedRouter() {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const identityRef = useRef<string | undefined>(undefined);
  const session = useGetAdminSession({
    query: { queryKey: getGetAdminSessionQueryKey(), retry: false, staleTime: 0 },
  });
  useEffect(() => {
    if (session.data?.ok) {
      const currentId = session.data.user.id;
      if (identityRef.current && identityRef.current !== currentId) {
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== getGetAdminSessionQueryKey()[0],
        });
      }
      identityRef.current = currentId;
    } else if (session.isError || session.data?.ok === false) {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== getGetAdminSessionQueryKey()[0],
      });
      identityRef.current = undefined;
      setLocation("/login");
    }
  }, [
    session.data?.ok,
    session.data?.user.id,
    session.isError,
    location,
    queryClient,
    setLocation,
  ]);
  if (session.isLoading)
    return (
      <div className="auth-loading">
        <div className="auth-orbit">
          <Activity size={20} />
        </div>
        <span>Verifying staff session</span>
        <div className="loading-line" />
      </div>
    );
  if (session.isError || !session.data?.ok) return <Login />;
  const capabilities = session.data.staff.capabilities || [];
  return (
    <AppShell
      user={session.data.user as Pick<AdminUser, "name" | "email">}
      capabilities={capabilities}
    >
      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/users">
          <CapabilityGate capabilities={capabilities} required="users.read">
            <UsersPage />
          </CapabilityGate>
        </Route>
        <Route path="/users/:id">
          <CapabilityGate capabilities={capabilities} required="users.read">
            <UserDetailPage capabilities={capabilities} />
          </CapabilityGate>
        </Route>
        <Route path="/controls" component={ControlsPage} />
        <Route path="/market-data" component={MarketDataPage} />
        <Route path="/symbols">
          <CapabilityGate capabilities={capabilities} required="symbols.read">
            <SymbolsPage />
          </CapabilityGate>
        </Route>
        <Route path="/strategies">
          <CapabilityGate capabilities={capabilities} required="strategies.read">
            <StrategiesPage />
          </CapabilityGate>
        </Route>
        <Route path="/assignments">
          <CapabilityGate capabilities={capabilities} required="strategies.read">
            <AssignmentsPage />
          </CapabilityGate>
        </Route>
        <Route path="/evaluations">
          <CapabilityGate capabilities={capabilities} required="signals.read">
            <EvaluationsPage />
          </CapabilityGate>
        </Route>
        <Route path="/diagnostics">
          <CapabilityGate capabilities={capabilities} required="market_data.read">
            <MarketDiagnosticsPage />
          </CapabilityGate>
        </Route>
        <Route path="/staff">
          <CapabilityGate capabilities={capabilities} required="staff.read">
            <StaffAccessPage />
          </CapabilityGate>
        </Route>
        <Route path="/access-policy">
          <CapabilityGate capabilities={capabilities} required="memberships.read">
            <AccessPolicyPage capabilities={capabilities} />
          </CapabilityGate>
        </Route>
        <Route path="/notifications">
          <CapabilityGate capabilities={capabilities} required="notifications.read">
            <NotificationsPage capabilities={capabilities} />
          </CapabilityGate>
        </Route>
        <Route path="/signals" component={SignalsPage} />
        <Route path="/billing">
          <CapabilityGate capabilities={capabilities} required="payments.read">
            <BillingPage />
          </CapabilityGate>
        </Route>
        <Route path="/audit">
          <CapabilityGate capabilities={capabilities} required="audit.read">
            <AuditPage />
          </CapabilityGate>
        </Route>
        <Route component={NotFoundPage} />
      </Switch>
    </AppShell>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route component={ProtectedRouter} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={client}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AdminActionDialogProvider>
          <AppRoutes />
        </AdminActionDialogProvider>
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
export default App;
