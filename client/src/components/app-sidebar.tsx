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
  Menu,
  Settings
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarFooter
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

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

export function AppSidebar() {
  const [location] = useLocation();
  const userId = "demo_user";

  const { data: mt5 } = useQuery<any>({
    queryKey: [`/api/mt5/status/${userId}`],
    refetchInterval: 5000,
  });

  const isConnected = mt5?.status === "CONNECTED";

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-800 bg-slate-950">
      <SidebarHeader className="h-20 border-b border-slate-800 flex flex-row items-center px-6 gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
          <TrendingUp size={24} strokeWidth={3} />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-xl tracking-tighter text-white uppercase italic leading-none">Tradify</span>
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">Terminal</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 py-4">
              {navItems.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon className={cn(isActive ? "text-emerald-500" : "text-slate-500")} />
                        <span className={cn(isActive ? "text-emerald-500" : "text-slate-400")}>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-800">
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 mb-2">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">MT5 Status</h4>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            )} />
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {isConnected ? "CONNECTED" : "OFFLINE"}
          </p>
        </div>
        
        <Link href="/login">
          <SidebarMenuButton className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10">
            <LogOut size={18} />
            <span>Sign Out</span>
          </SidebarMenuButton>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
