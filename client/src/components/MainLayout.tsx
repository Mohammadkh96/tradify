import { ReactNode } from "react";
import { Navigation, MobileNav } from "./Navigation";
import { ChatAssistant } from "./ChatAssistant";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-[#020617]">
      <Navigation />
      <MobileNav />
      {children}
      <ChatAssistant />
    </div>
  );
}
