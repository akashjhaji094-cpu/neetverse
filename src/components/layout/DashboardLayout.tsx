import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { MobileTopBar } from "./MobileTopBar";
import { cn } from "@/lib/utils";
import { BroadcastOverlay } from "@/components/BroadcastOverlay";
import { useTelegramBotTick } from "@/hooks/useTelegramBotTick";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  // Invisible — just gives the Telegram bot a chance to check if it's due
  // to post, whenever anyone visits an authenticated page. See the hook
  // for details; this line is the only thing that changed in this file.
  useTelegramBotTick();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <MobileTopBar title={title} />
      <main className={cn(
        "transition-all duration-300 lg:ml-64",
        "min-h-screen pb-24 lg:pb-0"
      )}>
        {children}
      </main>
      <BottomNav />
      <BroadcastOverlay />
    </div>
  );
}
