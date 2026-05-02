import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  LayoutDashboard, 
  BookOpen, 
  Target,
  History as HistoryIcon, 
  TrendingUp,
  Zap,
  Users,
  LogOut,
  User,
  CreditCard,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Plus,
  ClipboardCheck,
  Sparkles,
  Trophy,
  Award,
  Flame
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TOUR_RESTART_EVENT } from "./OnboardingTour";
import { TierBadge } from "./EliteBadge";
import { FoundingMemberBadge } from "./FoundingMemberBadge";
import { usePlan } from "@/hooks/usePlan";

export function Navigation() {
  const { t } = useTranslation();
  const location = useLocation();
  const { toast } = useToast();
  const [strategiesExpanded, setStrategiesExpanded] = useState(() => location.pathname.startsWith("/strategies"));

  const navItems = [
    { href: "/dashboard", label: t("sidebar.dashboard"), testId: "dashboard", icon: LayoutDashboard },
    { href: "/journal", label: t("sidebar.journal"), testId: "journal", icon: HistoryIcon },
    { href: "/prop-firm", label: t("sidebar.propFirm"), testId: "prop-firm", icon: Trophy },
    { href: "/mt5-bridge", label: t("sidebar.mt5Bridge"), testId: "mt5-bridge", icon: Zap },
    { href: "/traders-hub", label: t("sidebar.tradersHub"), testId: "traders-hub", icon: Users },
    { href: "/knowledge-base", label: t("sidebar.education"), testId: "education", icon: BookOpen },
    { href: "/achievements", label: t("sidebar.achievements"), testId: "achievements", icon: Award },
    { href: "/pricing", label: t("sidebar.plans"), testId: "plans", icon: CreditCard },
    { href: "/profile", label: t("sidebar.profile"), testId: "profile", icon: User },
  ];

  const strategiesSubNav = [
    { href: "/strategies", label: t("sidebar.myStrategies"), testId: "my-strategies", icon: FolderOpen },
    { href: "/strategies/create", label: t("sidebar.createStrategy"), testId: "create-strategy", icon: Plus },
    { href: "/strategies/validate", label: t("sidebar.validateTrade"), testId: "validate-trade", icon: ClipboardCheck },
  ];

  useEffect(() => {
    if (location.pathname.startsWith("/strategies")) {
      setStrategiesExpanded(true);
    }
  }, [location.pathname]);

  const { data: user } = useQuery<any>({ 
    queryKey: ["/api/user"],
    staleTime: 0,
  });
  
  const userId = user?.userId;

  const { data: mt5 } = useQuery<any>({
    queryKey: [`/api/mt5/status/${userId}`],
    refetchInterval: 5000,
    staleTime: 0,
    enabled: !!userId,
  });

  const isConnected = mt5?.status === "CONNECTED";
  const { tier, isPaid } = usePlan();

  const { data: streakData } = useQuery<any>({
    queryKey: ["/api/achievements/streaks"],
    staleTime: 60000,
    enabled: !!userId,
  });
  const journalStreak = streakData?.streaks?.journaling?.currentStreak || 0;

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (response.ok) {
        localStorage.removeItem("user_id");
        queryClient.clear();
        window.location.href = "/login";
      }
    } catch (error) {
      localStorage.removeItem("user_id");
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar text-sidebar-foreground hidden md:flex flex-col">
      <div className="flex items-center gap-3 px-6 h-20 border-b border-border">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
          <TrendingUp size={24} strokeWidth={3} />
        </div>
        <span className="font-black text-xl tracking-tighter text-foreground uppercase italic leading-none">TradifyApp</span>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.slice(0, 2).map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} to={item.href}>
              <div
                data-testid={`nav-${item.testId}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-border" 
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Icon 
                  size={18} 
                  className={cn(
                    "transition-colors",
                    isActive ? "text-emerald-500" : "text-slate-500 group-hover:text-slate-300"
                  )} 
                />
                {item.label}
              </div>
            </Link>
          );
        })}

        <div className="space-y-1">
          <button
            data-testid="nav-strategies-toggle"
            onClick={() => setStrategiesExpanded(!strategiesExpanded)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group",
              location.pathname.startsWith("/strategies")
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <div className="flex items-center gap-3">
              <Target 
                size={18} 
                className={cn(
                  "transition-colors",
                  location.pathname.startsWith("/strategies") ? "text-emerald-500" : "text-slate-500 group-hover:text-slate-300"
                )} 
              />
              {t("sidebar.strategies")}
            </div>
            {strategiesExpanded ? (
              <ChevronDown size={16} className="text-slate-500" />
            ) : (
              <ChevronRight size={16} className="text-slate-500" />
            )}
          </button>

          {strategiesExpanded && (
            <div className="ml-4 space-y-1 border-l border-border pl-2">
              {strategiesSubNav.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link key={item.href} to={item.href}>
                    <div
                      data-testid={`nav-${item.testId}`}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group",
                        isActive 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <Icon 
                        size={16} 
                        className={cn(
                          "transition-colors",
                          isActive ? "text-emerald-500" : "text-slate-500 group-hover:text-slate-300"
                        )} 
                      />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {navItems.slice(2).map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} to={item.href}>
              <div
                data-testid={`nav-${item.testId}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm border border-border" 
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Icon 
                  size={18} 
                  className={cn(
                    "transition-colors",
                    isActive ? "text-emerald-500" : "text-slate-500 group-hover:text-slate-300"
                  )} 
                />
                {item.label}
              </div>
            </Link>
          );
        })}

        <button 
          onClick={handleLogout}
          data-testid="button-sign-out"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 mt-4 border border-transparent hover:border-rose-500/20"
        >
          <LogOut size={18} className="text-slate-500 group-hover:text-rose-500" />
          {t("sidebar.signOut")}
        </button>
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        {(isPaid || user?.foundingMember) && (
          <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
            {user?.foundingMember && <FoundingMemberBadge size="sm" />}
            {isPaid && <TierBadge tier={tier} size="md" />}
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1 bg-secondary rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-tight">{t("sidebar.mt5")}</h4>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-destructive"
              )} />
            </div>
            <p className="text-[10px] text-foreground font-bold">
              {isConnected ? t("sidebar.connected") : t("sidebar.offline")}
            </p>
          </div>
          {journalStreak > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 flex flex-col items-center justify-center gap-0.5" data-testid="sidebar-streak">
              <Flame size={14} className="text-orange-500" />
              <span className="text-[9px] font-bold text-orange-500">{journalStreak}</span>
            </div>
          )}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(TOUR_RESTART_EVENT))}
            data-testid="button-restart-tour"
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-lg px-3 transition-all flex flex-col items-center justify-center gap-0.5"
          >
            <Sparkles size={14} />
            <span className="text-[9px] font-bold uppercase tracking-wider">{t("sidebar.tour")}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { t } = useTranslation();
  const location = useLocation();

  const mobileNavItems = [
    { href: "/dashboard", label: t("sidebar.dashboard"), testId: "dashboard", icon: LayoutDashboard },
    { href: "/journal", label: t("sidebar.journal"), testId: "journal", icon: HistoryIcon },
    { href: "/strategies", label: t("sidebar.strategies"), testId: "strategies", icon: Target },
    { href: "/mt5-bridge", label: t("sidebar.mobileMt5"), testId: "mt5", icon: Zap },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background z-50 md:hidden flex justify-around p-3 pb-6">
      {mobileNavItems.map((item) => {
        const isActive = location.pathname === item.href || (item.href === "/strategies" && location.pathname.startsWith("/strategies"));
        const Icon = item.icon;
        
        return (
          <Link key={item.href} to={item.href}>
            <div 
              data-testid={`mobile-nav-${item.testId}`}
              className={cn(
                "flex flex-col items-center gap-1 cursor-pointer",
                isActive ? "text-emerald-500" : "text-muted-foreground"
              )}
            >
              <Icon size={24} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
