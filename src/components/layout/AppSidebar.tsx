import { useState } from "react";
import { 
  Home, 
  Target, 
  BarChart3, 
  User, 
  Settings,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  ClipboardList,
  Trophy,
  Bell,
  RotateCcw,
  FileText,
  Send,
  BookX,
  History,
  Inbox
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import neetverseLogo from "@/assets/neetverse-logo.jpg";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
  adminOnly?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "",
    items: [
      { icon: Home, label: "Dashboard", path: "/" },
    ],
  },
  {
    title: "PRACTICE",
    items: [
      { icon: Target, label: "Practice Questions", path: "/practice" },
      { icon: RotateCcw, label: "Revision", path: "/revision", badge: "NEW" },
      { icon: FileText, label: "All PYQS", path: "/pyqs", badge: "NEW" },
      { icon: BookOpen, label: "Notes & PDFs", path: "/notes" },
      { icon: ClipboardList, label: "Mock Tests", path: "/test" },
      { icon: Inbox, label: "Pending OMR", path: "/pending-omr", badge: "NEW" },
    ],
  },
  {
    title: "ANALYSIS",
    items: [
      { icon: BookX, label: "Mistake Book", path: "/mistake-book", badge: "NEW" },
      { icon: History, label: "Test History", path: "/test-history", badge: "NEW" },
      { icon: Target, label: "Weak Chapters", path: "/weak-chapters", badge: "NEW" },
      { icon: BarChart3, label: "Reports", path: "/progress" },
      { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
      { icon: Bell, label: "Notifications", path: "/notifications" },
    ],
  },
];

const adminItem: NavItem = { icon: Shield, label: "Admin", path: "/admin", adminOnly: true };

const bottomNavItems: NavItem[] = [
  { icon: User, label: "Account", path: "/account" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();

  const { data: isAdmin } = useQuery({
    queryKey: ['user-is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["superadmin", "content_admin"]);
      return !!roles && roles.length > 0;
    },
    enabled: !!user,
  });

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    const content = (
      <NavLink
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
          isActive 
            ? "bg-primary/10 text-primary font-semibold" 
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
        )}
        <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
        {!collapsed && (
          <>
            <span className="text-sm">{item.label}</span>
            {item.badge && (
              <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-warning text-warning-foreground rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )}
        {collapsed && item.badge && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-warning rounded-full" />
        )}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-card flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <img src={neetverseLogo} alt="NEETVerse" className="w-9 h-9 rounded-xl" />
            <span className="text-lg font-bold text-primary">NEETVerse</span>
          </div>
        )}
        {collapsed && (
          <img src={neetverseLogo} alt="NEETVerse" className="w-9 h-9 rounded-xl mx-auto" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("h-7 w-7", collapsed && "absolute -right-3.5 top-5 bg-card border shadow-sm rounded-full")}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-1">
        {navGroups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-4")}>
            {group.title && !collapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.title}
              </p>
            )}
            {group.title && collapsed && gi > 0 && (
              <div className="mx-3 my-2 border-t border-border" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItemComponent key={item.path} item={item} />
              ))}
            </div>
          </div>
        ))}
        
        {isAdmin && (
          <div className="mt-4">
            {!collapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                ADMIN
              </p>
            )}
            <NavItemComponent item={adminItem} />
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-border space-y-0.5">
        {bottomNavItems.map((item) => (
          <NavItemComponent key={item.path} item={item} />
        ))}

        {/* Telegram Contact */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <a
              href="https://t.me/akaxxh"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full",
                "text-muted-foreground hover:text-[#229ED9] hover:bg-[#229ED9]/10"
              )}
            >
              <Send className="h-5 w-5 flex-shrink-0" />
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">Contact on Telegram</span>
                  <span className="text-[10px] text-muted-foreground">@akaxxh — Report issues, suggestions</span>
                </div>
              )}
            </a>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="font-medium">
              Contact on Telegram — @akaxxh
            </TooltipContent>
          )}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full",
                "text-destructive hover:bg-destructive/10"
              )}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="font-medium">
              Sign Out
            </TooltipContent>
          )}
        </Tooltip>

        {user && !collapsed && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-muted/50 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.user_metadata?.name || 'Student'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
