import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";
import { BroadcastOverlay } from "@/components/BroadcastOverlay";
import { TrialBanner } from "@/components/TrialBanner";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className={cn(
        "transition-all duration-300 ml-0 lg:ml-60",
        "min-h-screen"
      )}>
        <TrialBanner />
        {children}
      </main>
      <BroadcastOverlay />
    </div>
  );
}
