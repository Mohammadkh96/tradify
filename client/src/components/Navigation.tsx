import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  BookOpen, 
  PenTool, 
  History as HistoryIcon, 
  Calculator,
  TrendingUp,
  Zap,
  Users,
  LogOut,
  ShieldCheck,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journal", label: "Journal", icon: HistoryIcon },
  { href: "/new-entry", label: "New Entry", icon: PenTool },
  { href: "/mt5-bridge", label: "MT5 Bridge", icon: Zap },
  { href: "/traders-hub", label: "Traders Hub", icon: Users },
  { href: "/knowledge-base", label: "Education", icon: BookOpen },
  { href: "/risk", label: "Calculator", icon: Calculator },
  { href: "/pricing", label: "Plans", icon: Zap },
];

export function Navigation() {
  const [location] = useLocation();
  const { toast } = useToast();

  const { data: mt5 } = useQuery<any>({
    queryKey: [`/api/mt5/status/demo_user`],
    refetchInterval: 5000,
  });

  const { data: userRole } = useQuery<any>({
    queryKey: ["/api/user/role"],
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/upgrade-dev");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/role"] });
      toast({
        title: "Developer Access",
        description: "PRO features unlocked for testing.",
      });
    },
  });

  const isConnected = mt5?.status === "CONNECTED";
  const isPro = userRole?.subscriptionTier === "PRO";
  const isAdmin = true; // Temporary force for developer visibility

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-800 bg-slate-950 text-slate-300 hidden md:flex flex-col">
      <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-800">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
          <TrendingUp size={24} strokeWidth={3} />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-xl tracking-tighter text-white uppercase italic leading-none">Tradify</span>
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">Terminal</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group",
                  isActive 
                    ? "bg-slate-900 text-emerald-500 shadow-sm border border-slate-800" 
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/50"
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

        {isAdmin && (
          <Link href="/admin">
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group mt-4",
                location === "/admin"
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/5 border border-transparent hover:border-emerald-500/10"
              )}
            >
              <Shield size={18} className={location === "/admin" ? "text-emerald-500" : "text-slate-500 group-hover:text-emerald-400"} />
              Admin Console
            </div>
          </Link>
        )}
        
        <Link href="/login">
          <div className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 mt-4 border border-transparent hover:border-rose-500/20">
            <LogOut size={18} className="text-slate-500 group-hover:text-rose-500" />
            Sign Out
          </div>
        </Link>
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        {!isPro && (
          <button
            onClick={() => upgradeMutation.mutate()}
            disabled={upgradeMutation.isPending}
            className="w-full bg-slate-900 hover:bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-lg p-3 transition-all flex items-center justify-center gap-2 group mb-2"
          >
            <ShieldCheck size={14} className="group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {upgradeMutation.isPending ? "Unlocking..." : "Developer Unlock"}
            </span>
          </button>
        )}
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">MT5 Status</h4>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            )} />
          </div>
          <p className="text-[11px] text-slate-300">
            {isConnected ? "Terminal Connected" : "Terminal Offline"}
          </p>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [location] = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 z-50 md:hidden flex justify-around p-3 pb-6">
      {navItems.slice(0, 4).map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        
        return (
          <Link key={item.href} href={item.href}>
            <div className={cn(
              "flex flex-col items-center gap-1 cursor-pointer",
              isActive ? "text-emerald-500" : "text-slate-500"
            )}>
              <Icon size={24} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
