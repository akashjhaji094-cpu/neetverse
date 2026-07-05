import { useState } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import neetverseLogo from "@/assets/neetverse-logo.jpg";
import {
  Menu,
  Home,
  BookOpen,
  TestTube,
  FileText,
  BarChart3,
  Settings,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Trophy,
  History,
  AlertTriangle,
  Crown,
  Zap,
  Swords,
  Brain,
  Send,
  TrendingUp,
} from 'lucide-react';
import { SidebarChatbot } from './SidebarChatbot';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  premium?: boolean;
  new?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const PERFORMANCE_ITEMS: NavItem[] = [
  { title: "Test History", href: "/test-history", icon: History },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Progress", href: "/progress", icon: TrendingUp },
  { title: "Revision", href: "/revision", icon: BookOpen },
  { title: "Weak Chapters", href: "/weak-chapters", icon: Zap },
];
const PERFORMANCE_PATHS = PERFORMANCE_ITEMS.map((i) => i.href);

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isGuest } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const navGroups: NavGroup[] = [
    {
      title: "Study",
      items: [
        { title: "Dashboard", href: "/dashboard", icon: Home },
        { title: "Practice", href: "/practice", icon: BookOpen },
        { title: "Mock Tests", href: "/test", icon: TestTube },
        { title: "PYQs", href: "/pyqs", icon: FileText },
        { title: "Notes & Books", href: "/notes", icon: FileText },
      ],
    },
    {
      title: "AI & Adaptive",
      items: [
        { title: "Adaptive Learning", href: "/adaptive-learning", icon: Brain, new: true },
        { title: "Battle Arena", href: "/battle-arena", icon: Swords, new: true },
      ],
    },
    {
      title: "Progress",
      items: [
        { title: "Mistake Book", href: "/mistake-book", icon: AlertTriangle },
        { title: "Leaderboard", href: "/leaderboard", icon: Trophy },
      ],
    },
    {
      title: "Premium",
      items: [
        { title: "Premium Content", href: "/premium", icon: Crown, badge: "NEW" },
      ],
    },
  ];

  const bottomNavItems: NavItem[] = [
    { title: "Account", href: "/account", icon: User },
    { title: "Settings", href: "/settings", icon: Settings },
  ];

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (isGuest && href !== '/practice' && href !== '/' && href !== '/auth') {
      e.preventDefault();
      toast.error('Please sign in to access this feature');
      navigate('/auth');
      return;
    }
    setMobileOpen(false);
  };

  const goToPerformanceItem = (href: string) => {
    if (isGuest) {
      toast.error('Please sign in to access this feature');
      navigate('/auth');
      return;
    }
    navigate(href);
    setMobileOpen(false);
  };

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = location.pathname === item.href;

    const content = (
      <NavLink
        to={item.href}
        onClick={(e) => handleNavClick(e, item.href)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium lift-3d group relative",
          active
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className={cn("w-5 h-5 flex-shrink-0 icon-3d", active && "text-primary-foreground")} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.title}</span>
            {item.badge && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {item.badge}
              </Badge>
            )}
            {item.new && (
              <Badge className="bg-green-500 text-[10px] px-1.5 py-0 h-5 text-white">
                NEW
              </Badge>
            )}
            {item.premium && <Crown className="w-3.5 h-3.5 text-amber-500" />}
          </>
        )}
        {collapsed && (item.badge || item.new) && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  const PerformanceMenuItem = () => {
    const active = PERFORMANCE_PATHS.includes(location.pathname);

    const trigger = (
      <button
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
          active
            ? "bg-primary text-primary-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <History className={cn("w-5 h-5 flex-shrink-0", active && "text-primary-foreground")} />
        {!collapsed && <span className="flex-1 text-left truncate">View Previous Performance</span>}
      </button>
    );

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>{trigger}</TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                View Previous Performance
              </TooltipContent>
            </Tooltip>
          ) : trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent side={collapsed ? "right" : "bottom"} align="start" className="w-56">
          {PERFORMANCE_ITEMS.map((pItem) => {
            const PIcon = pItem.icon;
            return (
              <DropdownMenuItem key={pItem.href} onClick={() => goToPerformanceItem(pItem.href)}>
                <PIcon className="w-4 h-4 mr-2" />
                {pItem.title}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const SidebarContent = (
    <div className={cn("flex flex-col h-full bg-card border-r border-border transition-all duration-300", collapsed ? "w-16" : "w-64")}>
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <img src={neetverseLogo} alt="NEETVerse" className="w-10 h-10 rounded-xl" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg leading-tight text-primary">NEETVerse</h1>
              <p className="text-xs text-muted-foreground">Prep Smarter</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", collapsed && "absolute -right-3.5 top-5 bg-card border shadow-sm rounded-full")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      <ScrollArea className="flex-1 py-2">
        {navGroups.map((group, gi) => (
          <div key={group.title} className={cn("px-2", gi > 0 && "mt-4")}>
            {!collapsed && (
              <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.title}
              </h3>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-auto w-8 h-px bg-border mb-2" />
            )}
            <div className="space-y-1">
              {group.title === "Progress" && <PerformanceMenuItem />}
              {group.items.map((item) => (
                <NavItemComponent key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}

        {/* Admin Section */}
        {isAdmin && (
          <div className="px-2 mt-4">
            {!collapsed && (
              <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Admin
              </h3>
            )}
            <NavItemComponent item={{ title: "Admin Panel", href: "/admin", icon: Shield }} />
          </div>
        )}

        {/* AI Chatbot Section */}
        <SidebarChatbot collapsed={collapsed} />
      </ScrollArea>

      {/* Bottom */}
      <div className="p-2 border-t border-border space-y-1">
        {bottomNavItems.map((item) => (
          <NavItemComponent key={item.href} item={item} />
        ))}

        {/* Telegram Contact */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <a
              href="https://t.me/Neetverseowner_bot?text=I%20want%20subscription"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                "text-muted-foreground hover:text-[#229ED9] hover:bg-[#229ED9]/10",
                collapsed && "justify-center px-2"
              )}
            >
              <Send className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium leading-tight">Contact on Telegram</span>
                  <span className="text-[10px] text-muted-foreground">@akaxxh — Report issues</span>
                </div>
              )}
            </a>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="font-medium">
              Contact on Telegram — @Neetverseowner_bot
            </TooltipContent>
          )}
        </Tooltip>

        {user && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  signOut();
                  navigate('/auth');
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all",
                  collapsed && "justify-center px-2"
                )}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="font-medium">
                Sign Out
              </TooltipContent>
            )}
          </Tooltip>
        )}

        {user && !collapsed && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-muted/50 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.user_metadata?.name || 'Student'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            {SidebarContent}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen z-40">
        {SidebarContent}
      </div>
    </>
  );
}
