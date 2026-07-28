import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";
import { BroadcastOverlay } from "@/components/BroadcastOverlay";
import { useTelegramBotTick } from "@/hooks/useTelegramBotTick";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  // Invisible — just gives the Telegram bot a chance to check if it's due
  // to post, whenever anyone visits an authenticated page. See the hook
  // for details; this line is the only thing that changed in this file.
  useTelegramBotTick();

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
