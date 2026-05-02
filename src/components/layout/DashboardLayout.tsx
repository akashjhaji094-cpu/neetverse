import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";
import { BroadcastOverlay } from "@/components/BroadcastOverlay";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className={cn(
        "transition-all duration-300 ml-16 lg:ml-60",
        "min-h-screen"
      )}>
        {children}
      </main>
      <BroadcastOverlay />
    </div>
  );
}
