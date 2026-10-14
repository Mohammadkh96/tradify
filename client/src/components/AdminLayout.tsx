import { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";

export function AdminLayout({ children }: { children: ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto relative">
          <div className="absolute top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <div
            role="status"
            data-testid="ai-features-disabled-notice"
            className="mx-4 mt-4 rounded-md border border-amber-500/25 bg-amber-500/5 px-4 py-2 text-xs text-muted-foreground md:mx-6"
          >
            AI generation tools are disabled. Saved content and manual editing remain available.
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
