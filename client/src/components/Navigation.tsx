import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  BookOpen, 
  PenTool, 
  History, 
  Calculator,
  TrendingUp,
  Zap,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journal", label: "Journal", icon: History },
  { href: "/new-entry", label: "New Entry", icon: PenTool },
  { href: "/mt5-bridge", label: "MT5 Bridge", icon: Zap },
  { href: "/traders-hub", label: "Traders Hub", icon: Users },
  { href: "/knowledge-base", label: "Education", icon: BookOpen },
  { href: "/risk", label: "Calculator", icon: Calculator },
];

export function Navigation() {
  const [location] = useLocation();
  const { data: mt5 } = useQuery<{ isConnected: boolean }>({
    queryKey: ["/api/mt5/status"],
    refetchInterval: 5000,
  });

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-800 bg-slate-950 text-slate-300 hidden md:flex flex-col">
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-emerald-900/50">
          <TrendingUp size={20} />
        </div>
        <span className="font-bold text-lg tracking-tight text-white">TRADIFY</span>
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
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">MT5 Status</h4>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              mt5?.isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            )} />
          </div>
          <p className="text-[11px] text-slate-300">
            {mt5?.isConnected ? "Terminal Connected" : "Terminal Offline"}
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
