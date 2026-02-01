import { useState } from "react";
import { 
  Home, 
  MessageCircle, 
  Target, 
  BarChart3, 
  User, 
  Settings,
  Crown,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield
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

const navItems: NavItem[] = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: MessageCircle, label: "AI Chat", path: "/chat" },
  { icon: Target, label: "Practice", path: "/practice" },
  { icon: BookOpen, label: "Mock Tests", path: "/test" },
  { icon: BarChart3, label: "Progress", path: "/progress" },
  { icon: Crown, label: "Premium", path: "/premium", badge: "Pro" },
  { icon: Shield, label: "Admin", path: "/admin", adminOnly: true },
];

const bottomNavItems: NavItem[] = [
  { icon: User, label: "Account", path: "/account" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();

  // Check if user is admin
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

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    const content = (
      <NavLink
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
          isActive 
            ? "bg-primary text-primary-foreground shadow-md" 
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary-foreground")} />
        {!collapsed && (
          <>
            <span className="font-medium text-sm">{item.label}</span>
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
            {item.badge && <span className="ml-2 text-warning">({item.badge})</span>}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo & Toggle */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <img src={neetverseLogo} alt="NEETVerse" className="w-10 h-10 rounded-xl shadow-md" />
            <span className="text-xl font-bold text-gradient">NEETVerse</span>
          </div>
        )}
        {collapsed && (
          <img src={neetverseLogo} alt="NEETVerse" className="w-10 h-10 rounded-xl shadow-md mx-auto" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("h-8 w-8", collapsed && "absolute -right-4 top-6 bg-background border shadow-md")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <NavItemComponent key={item.path} item={item} />
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {bottomNavItems.map((item) => (
          <NavItemComponent key={item.path} item={item} />
        ))}
        
        {/* Sign Out Button */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full",
                "text-destructive hover:bg-destructive/10"
              )}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-sm">Sign Out</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="font-medium">
              Sign Out
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
