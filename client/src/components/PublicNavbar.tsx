import { Link } from "react-router-dom";
import { TrendingUp, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function PublicNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { title: "Features", href: "/features" },
    { title: "Pricing", href: "/pricing" },
    { title: "How It Works", href: "/how-it-works" },
    { title: "Resources", href: "/resources" },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <TrendingUp size={24} strokeWidth={3} />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tighter text-foreground uppercase italic leading-none">Tradify</span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">Terminal</span>
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {item.title}
              </span>
            </Link>
          ))}
        </div>

        {/* Auth & Toggle */}
        <div className="hidden md:flex items-center gap-6">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest text-xs">
              Login
            </Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest text-xs px-6">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden flex items-center gap-4">
          <ThemeToggle />
          <button onClick={() => setIsOpen(!isOpen)} className="text-foreground">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={cn(
        "md:hidden absolute top-20 left-0 w-full bg-background border-b border-border transition-all duration-300 overflow-hidden",
        isOpen ? "max-h-96" : "max-h-0"
      )}>
        <div className="p-6 space-y-4">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {item.title}
              </span>
            </Link>
          ))}
          <div className="pt-4 flex flex-col gap-3">
            <Link to="/login">
              <Button variant="outline" className="w-full font-bold uppercase tracking-widest text-xs">
                Login
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="w-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
