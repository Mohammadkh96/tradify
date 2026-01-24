import { Link, useLocation } from "wouter";
import { 
  TrendingUp,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Navigation() {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 z-50 px-4 flex items-center justify-between lg:hidden">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
          <TrendingUp size={18} strokeWidth={3} />
        </div>
        <span className="font-black text-lg tracking-tighter text-white uppercase italic leading-none">Tradify</span>
      </div>
    </header>
  );
}

export function MobileNav() {
  return null;
}
