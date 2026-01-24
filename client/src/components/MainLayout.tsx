import { ReactNode } from "react";
import { Navigation, MobileNav } from "./Navigation";
import { ChatAssistant } from "./ChatAssistant";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-[#020617] flex">
      <Navigation />
      <MobileNav />
      <main className="flex-1 md:ml-64 relative min-h-screen overflow-x-hidden">
        {children}
      </main>
      <ChatAssistant />
    </div>
  );
}
