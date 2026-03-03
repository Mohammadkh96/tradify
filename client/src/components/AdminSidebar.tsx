import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, CreditCard, Zap, Shield, LogOut, Activity, Crown, Sparkles, MessageSquare, FileText, Megaphone, PenTool, Target, FolderOpen, Library, Palette, DollarSign, Package, ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";

const adminNavItems = [
  { href: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/early-access", label: "Early Access", icon: Sparkles },
  { href: "/admin/founding-members", label: "Founding Members", icon: Crown },
  { href: "/admin/suggestions", label: "Suggestions", icon: MessageSquare },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/access", label: "Team Access", icon: Shield },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/mt5", label: "MT5 Monitor", icon: Zap },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: Activity },
  { href: "/admin/costs", label: "Cost Intelligence", icon: DollarSign },
];

interface MarketingSubGroup {
  label: string;
  items: { href: string; label: string; icon: any }[];
}

const marketingSubGroups: MarketingSubGroup[] = [
  {
    label: "",
    items: [
      { href: "/admin/marketing", label: "Dashboard", icon: Megaphone },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/marketing/content-studio", label: "Content Studio", icon: PenTool },
      { href: "/admin/marketing/funnel", label: "Content Factory", icon: Package },
      { href: "/admin/marketing/content-library", label: "Library", icon: Library },
    ],
  },
  {
    label: "Advertising",
    items: [
      { href: "/admin/marketing/meta-ads", label: "Meta Ads", icon: Target },
      { href: "/admin/marketing/campaigns", label: "Campaigns", icon: FolderOpen },
    ],
  },
  {
    label: "",
    items: [
      { href: "/admin/marketing/brand-settings", label: "Brand Settings", icon: Palette },
    ],
  },
];

function NavItem({ item, pathname }: { item: { href: string; label: string; icon: any }; pathname: string }) {
  const isActive = pathname === item.href;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link to={item.href} data-testid={`link-admin-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <div className={cn(
            "flex items-center gap-3 w-full px-4 py-2 rounded-md transition-colors",
            isActive ? "bg-emerald-500/10 text-emerald-500" : "text-slate-400 hover:text-white hover:bg-slate-900"
          )}>
            <item.icon size={18} />
            <span className="font-medium text-sm">{item.label}</span>
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AdminSidebar() {
  const location = useLocation();
  const [marketingOpen, setMarketingOpen] = useState(true);
  const isMarketingActive = location.pathname.startsWith("/admin/marketing");

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
                <NavItem key={item.href} item={item} pathname={location.pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <button
            onClick={() => setMarketingOpen(!marketingOpen)}
            className="flex items-center justify-between w-full group cursor-pointer"
            data-testid="button-toggle-marketing"
          >
            <SidebarGroupLabel className="text-slate-500 uppercase text-[10px] font-bold tracking-widest mb-0 pointer-events-none">
              Marketing Hub
            </SidebarGroupLabel>
            <ChevronDown
              size={14}
              className={cn(
                "text-slate-500 transition-transform duration-200 mr-1",
                marketingOpen ? "rotate-0" : "-rotate-90"
              )}
            />
          </button>

          {marketingOpen && (
            <SidebarGroupContent className="mt-2">
              <SidebarMenu>
                {marketingSubGroups.map((group, gi) => (
                  <div key={gi}>
                    {group.label && (
                      <div className="px-4 pt-3 pb-1">
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em]">
                          {group.label}
                        </span>
                      </div>
                    )}
                    {group.items.map((item) => (
                      <NavItem key={item.href} item={item} pathname={location.pathname} />
                    ))}
                    {gi < marketingSubGroups.length - 1 && group.items.length > 1 && (
                      <div className="mx-4 my-1 border-b border-slate-800/50" />
                    )}
                  </div>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          )}

          {!marketingOpen && isMarketingActive && (
            <div className="mt-1 mx-4">
              <div className="h-0.5 w-6 rounded-full bg-emerald-500/40" />
            </div>
          )}
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
