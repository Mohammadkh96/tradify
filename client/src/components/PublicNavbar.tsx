import { Link } from "react-router-dom";
import { TrendingUp, Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PublicNavbarProps {
  topOffset?: number;
  showProducts?: boolean;
}

export function PublicNavbar({ topOffset = 0, showProducts = true }: PublicNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isMobileProductsOpen, setIsMobileProductsOpen] = useState(false);
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
            {showProducts ? (
              <span className="leading-none">
                <span className="block font-black text-xl tracking-tighter text-foreground uppercase italic">Tradify</span>
                <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.22em] text-emerald-500">Journal</span>
              </span>
            ) : (
              <span className="font-black text-xl tracking-tighter text-foreground uppercase italic leading-none">TradifyApp</span>
            )}
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
          {showProducts && (
            <div
              className="relative"
              onBlur={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                  setIsProductsOpen(false);
                }
              }}
            >
              <button
                type="button"
                aria-expanded={isProductsOpen}
                aria-controls={isProductsOpen ? "desktop-products-menu" : undefined}
                onClick={() => setIsProductsOpen((open) => !open)}
                className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-public-products-menu"
              >
                {t("ecosystem.products")}
                <ChevronDown size={14} className={isProductsOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              {isProductsOpen && (
                <div
                  id="desktop-products-menu"
                  className="absolute left-0 top-full z-[70] mt-4 w-80 rounded-xl border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl"
                >
                  <Link
                    to="/features"
                    onClick={() => setIsProductsOpen(false)}
                    className="block rounded-lg px-4 py-3 hover:bg-muted/60 transition-colors"
                    data-testid="link-products-journal"
                  >
                    <span className="block text-sm font-bold text-foreground">{t("ecosystem.journal")}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t("ecosystem.journalShort")}</span>
                  </Link>
                  <Link
                    to="/#signals"
                    onClick={() => setIsProductsOpen(false)}
                    className="block rounded-lg px-4 py-3 hover:bg-muted/60 transition-colors"
                    data-testid="link-products-signals"
                  >
                    <span className="block text-sm font-bold text-foreground">{t("ecosystem.signals")}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t("ecosystem.signalsPending")}</span>
                  </Link>
                </div>
              )}
            </div>
          )}
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
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-foreground"
            data-testid="button-mobile-menu"
            aria-label={t("ecosystem.toggleNavigation")}
            aria-expanded={isOpen}
            aria-controls="public-mobile-menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <div className={cn(
        "md:hidden absolute top-20 left-0 w-full bg-background border-b border-border transition-all duration-300",
        isOpen ? "max-h-[calc(100vh-5rem)] overflow-y-auto" : "max-h-0 overflow-hidden"
      )}>
        <div id="public-mobile-menu" className="p-6 space-y-4">
          {navItems.map((item) => (
            <Link key={item.href} to={item.href} onClick={() => setIsOpen(false)}>
              <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {item.title}
              </span>
            </Link>
          ))}
          {showProducts && (
            <div>
              <button
                type="button"
                onClick={() => setIsMobileProductsOpen((open) => !open)}
                className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={isMobileProductsOpen}
                aria-controls={isMobileProductsOpen ? "mobile-products-menu" : undefined}
                data-testid="button-mobile-products-menu"
              >
                {t("ecosystem.products")}
                <ChevronDown size={14} className={isMobileProductsOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
              {isMobileProductsOpen && (
                <div id="mobile-products-menu" className="mt-3 space-y-3 border-l border-border pl-4">
                  <Link
                    to="/features"
                    onClick={() => {
                      setIsOpen(false);
                      setIsMobileProductsOpen(false);
                    }}
                    className="block"
                    data-testid="link-mobile-products-journal"
                  >
                    <span className="block text-xs font-bold text-foreground">{t("ecosystem.journal")}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t("ecosystem.journalShort")}</span>
                  </Link>
                  <Link
                    to="/#signals"
                    onClick={() => {
                      setIsOpen(false);
                      setIsMobileProductsOpen(false);
                    }}
                    className="block"
                    data-testid="link-mobile-products-signals"
                  >
                    <span className="block text-xs font-bold text-foreground">{t("ecosystem.signals")}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t("ecosystem.signalsPending")}</span>
                  </Link>
                </div>
              )}
            </div>
          )}
          <div className="pt-4 flex flex-col gap-3">
            <Link to="/login" onClick={() => setIsOpen(false)}>
              <Button variant="outline" className="w-full font-bold uppercase tracking-widest text-xs">
                {t("nav.login")}
              </Button>
            </Link>
            <Link to="/signup" onClick={() => setIsOpen(false)}>
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
