import { useNavigate } from "react-router-dom";
import { Bell, Flame } from "lucide-react";
import neetverseLogo from "@/assets/neetverse-logo.jpg";

interface MobileTopBarProps {
  title?: string;
}

export function MobileTopBar({ title }: MobileTopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/60 bg-card/90 px-4 py-2.5 backdrop-blur-xl">
      <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 tap">
        <img src={neetverseLogo} alt="NEETVerse" className="h-8 w-8 rounded-xl" />
        <span className="text-[15px] font-bold tracking-tight">{title || "NEETVerse"}</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/premium")}
          className="flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-[11px] font-semibold text-accent tap"
        >
          <Flame className="h-3.5 w-3.5" /> Pro
        </button>
        <button
          onClick={() => navigate("/notifications")}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted tap"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px] text-foreground/80" />
        </button>
      </div>
    </header>
  );
}