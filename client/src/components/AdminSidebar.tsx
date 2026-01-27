import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, CreditCard, Zap, Shield, LogOut, Activity } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

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
    <Sidebar className="border-r border-border bg-card">
      <SidebarHeader className="h-20 border-b border-border flex items-center px-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <Shield size={24} strokeWidth={3} />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tighter text-foreground uppercase italic leading-none">Admin</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-1">Console</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-2">Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={location === item.href}>
                    <Link href={item.href}>
                      <div className={cn(
                        "flex items-center gap-3 w-full px-4 py-2 rounded-md transition-colors",
                        location === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
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
        
        <div className="mt-auto pt-4 border-t border-border">
          <button 
            onClick={() => {
              localStorage.removeItem("user_id");
              window.location.href = "/";
            }}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 cursor-pointer"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
