import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Home,
  BookOpen,
  TestTube,
  Layers,
  PenSquare,
  LayoutGrid,
  FileText,
  FileScan,
  Trophy,
  Crown,
  History,
  TrendingUp,
  Zap,
  AlertTriangle,
  ScanLine,
  Brain,
  Swords,
  User,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";

const TABS = [
  { title: "Home", href: "/dashboard", icon: Home },
  { title: "Practice", href: "/practice", icon: BookOpen },
  { title: "Test", href: "/test", icon: TestTube },
  { title: "Test Series", href: "/test-series", icon: Layers },
];

const MORE_GROUPS: { title: string; items: { title: string; href: string; icon: React.ElementType }[] }[] = [
  {
    title: "Study",
    items: [
      { title: "PYQs", href: "/pyqs", icon: FileText },
      { title: "Revision", href: "/revision", icon: BookOpen },
      { title: "Notes & Books", href: "/notes", icon: FileText },
      { title: "QP to CBT", href: "/qp-to-cbt", icon: FileScan },
      { title: "Adaptive Learning", href: "/adaptive-learning", icon: Brain },
      { title: "Battle Arena", href: "/battle-arena", icon: Swords },
    ],
  },
  {
    title: "Performance",
    items: [
      { title: "Test History", href: "/test-history", icon: History },
      { title: "Progress", href: "/progress", icon: TrendingUp },
      { title: "Weak Chapters", href: "/weak-chapters", icon: Zap },
      { title: "Mistake Book", href: "/mistake-book", icon: AlertTriangle },
      { title: "Pending OMR", href: "/pending-omr", icon: ScanLine },
      { title: "Leaderboard", href: "/leaderboard", icon: Trophy },
    ],
  },
  {
    title: "Account",
    items: [
      { title: "Premium", href: "/premium", icon: Crown },
      { title: "Contribute Question", href: "/contribute", icon: PenSquare },
      { title: "My Account", href: "/account", icon: User },
      { title: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isGuest } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const guard = (e: React.MouseEvent, href: string) => {
    if (isGuest && href !== "/practice") {
      e.preventDefault();
      toast.error("Please sign in to access this feature");
      navigate("/auth");
    }
  };

  const go = (href: string) => {
    setMoreOpen(false);
    if (isGuest && href !== "/practice") {
      toast.error("Please sign in to access this feature");
      navigate("/auth");
      return;
    }
    navigate(href);
  };

  const moreActive = !TABS.some((t) => t.href === location.pathname);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur-xl safe-bottom">
        <div className="grid grid-cols-5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = location.pathname === tab.href;
            return (
              <NavLink
                key={tab.href}
                to={tab.href}
                onClick={(e) => guard(e, tab.href)}
                className="flex flex-col items-center justify-center gap-1 py-2 tap"
              >
                <span
                  className={cn(
                    "flex items-center justify-center h-8 w-12 rounded-full transition-colors",
                    active ? "bg-primary/12 text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-none",
                    active ? "text-primary font-semibold" : "text-muted-foreground font-medium"
                  )}
                >
                  {tab.title}
                </span>
              </NavLink>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-2 tap"
          >
            <span
              className={cn(
                "flex items-center justify-center h-8 w-12 rounded-full transition-colors",
                moreActive ? "bg-primary/12 text-primary" : "text-muted-foreground"
              )}
            >
              <LayoutGrid className="h-[18px] w-[18px]" />
            </span>
            <span
              className={cn(
                "text-[10px] leading-none",
                moreActive ? "text-primary font-semibold" : "text-muted-foreground font-medium"
              )}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-0">
          <SheetHeader className="px-5 pt-5 pb-2 text-left">
            <SheetTitle className="text-base">All features</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-8 space-y-5">
            {MORE_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.href;
                    return (
                      <button
                        key={item.href}
                        onClick={() => go(item.href)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-2xl border p-3 tap",
                          active ? "border-primary/40 bg-primary/10" : "border-border/60 bg-muted/40"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            active ? "bg-primary text-primary-foreground" : "bg-card text-primary"
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="text-[11px] font-medium leading-tight text-center">{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {user && (
              <button
                onClick={() => {
                  setMoreOpen(false);
                  signOut();
                  navigate("/auth");
                }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 py-3 text-sm font-semibold text-destructive tap"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
