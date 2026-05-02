import { Link } from "react-router-dom";
import { TrendingUp, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PublicNavbarProps {
  topOffset?: number;
}

export function PublicNavbar({ topOffset = 0 }: PublicNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const navItems = [
    { title: t("nav.features"), href: "/features" },
    { title: t("nav.pricing"), href: "/pricing" },
    { title: "Free Tools", href: "/free-tools" },
    { title: "Prop Firms", href: "/prop-firms" },
    { title: t("nav.howItWorks"), href: "/how-it-works" },
    { title: t("nav.blog"), href: "/blog" },
  ];

  return (
    <nav
      className="fixed w-full z-50 border-b border-border bg-background/80 backdrop-blur-md transition-[top] duration-300"
      style={{ top: topOffset }}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <TrendingUp size={24} strokeWidth={3} />
            </div>
            <span className="font-black text-xl tracking-tighter text-foreground uppercase italic leading-none">TradifyApp</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {item.title}
              </span>
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link to="/login">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest text-xs" data-testid="link-navbar-login">
              {t("nav.login")}
            </Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest text-xs px-6" data-testid="link-navbar-signup">
              {t("nav.getStarted")}
            </Button>
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <LanguageSwitcher variant="compact" />
          <ThemeToggle />
          <button onClick={() => setIsOpen(!isOpen)} className="text-foreground" data-testid="button-mobile-menu">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

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
                {t("nav.login")}
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="w-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs">
                {t("nav.getStarted")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
