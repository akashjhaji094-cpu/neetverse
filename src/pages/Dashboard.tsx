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
    <DashboardLayout title="Home">
      <PremiumWelcomePopup />
      <div className="p-4 lg:p-6 space-y-5 max-w-5xl">
        <div className="rounded-2xl bg-[image:var(--gradient-primary)] p-5 text-primary-foreground shadow-elegant">
          <p className="text-xs font-medium uppercase tracking-widest text-primary-foreground/70">
            Welcome back
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">Hello, {userName} 👋</h1>
          <p className="mt-1 text-sm text-primary-foreground/85">
            Let's continue your NEET preparation today.
          </p>
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
