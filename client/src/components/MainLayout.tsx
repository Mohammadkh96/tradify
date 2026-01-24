import { ReactNode } from "react";
import { Navigation } from "./Navigation";
import { ChatAssistant } from "./ChatAssistant";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-[#020617]">
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full min-w-0">
          <Navigation />
          <main className="flex-1 overflow-x-hidden pt-16 md:pt-0">
            <div className="md:p-0">
              {children}
            </div>
          </main>
          <ChatAssistant />
        </div>
      </div>
    </SidebarProvider>
  );
}
