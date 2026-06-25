import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AccuracyStats } from "@/components/dashboard/AccuracyStats";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { TestSeriesWidget } from "@/components/dashboard/TestSeriesWidget";
import { PerformanceOverview } from "@/components/dashboard/PerformanceOverview";
import { NeetCountdown } from "@/components/dashboard/NeetCountdown";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumWelcomePopup } from "@/components/PremiumWelcomePopup";

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
      <PremiumWelcomePopup />
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold">
              Hello, <span className="text-primary">{userName}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Let's Continue Your Preparation.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate('/notifications')}
          >
            <Bell className="h-5 w-5" />
          </Button>
        </div>

        <NeetCountdown />
        <PerformanceOverview />
        <TestSeriesWidget />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AccuracyStats />
          <RecentActivity />
        </div>

        <QuickActions />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
