import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AccuracyStats } from "@/components/dashboard/AccuracyStats";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { TestSeriesWidget } from "@/components/dashboard/TestSeriesWidget";
import { PerformanceOverview } from "@/components/dashboard/PerformanceOverview";
import { useEffect } from "react";
import { Crown, Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, isGuest } = useAuth();

  useEffect(() => {
    if (!loading && !user && !isGuest) {
      navigate('/auth');
    }
  }, [user, loading, isGuest, navigate]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const userName = user?.user_metadata?.name || 'Student';

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold">
              Hello, <span className="text-primary">{userName}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Let's Continue Your Preparation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 border-warning text-warning hover:bg-warning/10"
              onClick={() => navigate('/premium')}
            >
              <Crown className="h-4 w-4" />
              Premium
            </Button>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Performance Overview */}
        <PerformanceOverview />

        {/* Quick Actions - Test Series Style */}
        <TestSeriesWidget />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AccuracyStats />
          <RecentActivity />
        </div>

        {/* Quick Actions */}
        <QuickActions />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
