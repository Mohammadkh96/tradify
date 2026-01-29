import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, CreditCard, Zap, Shield, LogOut, Activity } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

const adminNavItems = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/access", label: "Team Access", icon: Shield },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/mt5", label: "MT5 Monitor", icon: Zap },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: Activity },
];

export function AdminSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-slate-800 bg-slate-950">
      <SidebarHeader className="h-20 border-b border-slate-800 flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <Shield size={24} strokeWidth={3} />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tighter text-white uppercase italic leading-none">Admin</span>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">Console</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-500 uppercase text-[10px] font-bold tracking-widest mb-2">Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={location === item.href}>
                    <Link href={item.href}>
                      <div className={cn(
                        "flex items-center gap-3 w-full px-4 py-2 rounded-md transition-colors",
                        location === item.href ? "bg-emerald-500/10 text-emerald-500" : "text-slate-400 hover:text-white hover:bg-slate-900"
                      )}>
                        <item.icon size={18} />
                        <span className="font-medium text-sm">{item.label}</span>
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <div className="mt-auto pt-4 border-t border-slate-800">
          <button 
            onClick={async () => {
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
            }}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 cursor-pointer"
            data-testid="button-admin-signout"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
