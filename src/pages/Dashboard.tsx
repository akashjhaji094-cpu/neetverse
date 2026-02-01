import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StreakTracker } from "@/components/dashboard/StreakTracker";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AccuracyStats } from "@/components/dashboard/AccuracyStats";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SubjectCards } from "@/components/dashboard/SubjectCards";
import { useEffect } from "react";

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

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold">
            Welcome back{user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ''}! 👋
          </h1>
          <p className="text-muted-foreground">
            Ready to continue your NEET preparation?
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Streak & Actions */}
          <div className="lg:col-span-2 space-y-6">
            <StreakTracker />
            <SubjectCards />
          </div>

          {/* Right Column - Stats & Activity */}
          <div className="space-y-6">
            <QuickActions />
            <AccuracyStats />
            <RecentActivity />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
