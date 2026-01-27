import { ReactNode } from "react";
import { Navigation, MobileNav } from "./Navigation";
import { ChatAssistant } from "./ChatAssistant";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      <Navigation />
      <MobileNav />
      <main className="flex-1 md:ml-64 relative h-screen overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {children}
      </main>
      <ChatAssistant />
    </div>
  );
}
