import { ReactNode } from "react";
import { Navigation, MobileNav } from "./Navigation";
import { ChatAssistant } from "./ChatAssistant";
import { ThemeToggle } from "./ThemeToggle";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <Navigation />
      <MobileNav />
      <main className="flex-1 md:ml-64 relative h-screen overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        <header className="absolute top-0 right-0 p-4 z-50 flex items-center gap-2">
          <ThemeToggle />
        </header>
        {children}
      </main>
      <ChatAssistant />
    </div>
  );
}
