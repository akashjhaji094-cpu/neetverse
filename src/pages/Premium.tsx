import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Crown, Download, FileText, BookOpen, CheckCircle, Sparkles } from "lucide-react";
import { PremiumAccessDialog } from "@/components/mock/PremiumAccessDialog";
import { useState } from "react";

const Premium = () => {
  const { user } = useAuth();
  const [showAccessDialog, setShowAccessDialog] = useState(false);

  const { data: userAccess } = useQuery({
    queryKey: ['user-premium-access', user?.id],
    queryFn: async () => {
      if (!user) return { hasAccess: false };

      const { data: accessKeys } = await supabase
        .from('premium_access_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      return { hasAccess: (accessKeys?.length || 0) > 0 };
    },
    enabled: !!user,
  });

  const { data: premiumContent } = useQuery({
    queryKey: ['premium-content'],
    queryFn: async () => {
      const { data: tests } = await supabase
        .from('premium_tests')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: planners } = await supabase
        .from('premium_planners')
        .select('*')
        .order('created_at', { ascending: false });

      return { tests: tests || [], planners: planners || [] };
    },
  });

  const features = [
    "20 Years PYQ Test Series",
    "Chapter-wise Analysis",
    "Detailed Solutions",
    "Performance Tracking",
    "Priority Support",
    "Exclusive Study Planners",
  ];

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Crown className="h-8 w-8 text-warning" />
            Premium Content
          </h1>
          <p className="text-muted-foreground">
            Exclusive test series and study materials
          </p>
        </div>

        {/* Premium Banner */}
        {!userAccess?.hasAccess && (
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-warning via-amber-500 to-orange-500 p-6 text-white">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="h-6 w-6" />
                    Unlock Premium Access
                  </h2>
                  <p className="text-white/90 mt-1">
                    Get access to exclusive test series based on 20 years of NEET PYQs
                  </p>
                  <div className="flex flex-wrap gap-3 mt-4">
                    {features.slice(0, 3).map((feature, i) => (
                      <span key={i} className="flex items-center gap-1 text-sm bg-white/20 px-3 py-1 rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-center lg:text-right">
                  <p className="text-3xl font-bold">₹399</p>
                  <p className="text-sm text-white/80">One-time payment</p>
                  <Button 
                    onClick={() => setShowAccessDialog(true)}
                    className="mt-3 bg-white text-warning hover:bg-white/90"
                  >
                    Get Access Now
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Premium Tests */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Test Series</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {premiumContent?.tests?.map((test) => (
              <Card key={test.id} className="card-hover">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-warning/20 rounded-lg">
                      <FileText className="h-5 w-5 text-warning" />
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-warning text-warning-foreground rounded-full">
                      Premium
                    </span>
                  </div>
                  <CardTitle className="text-lg">{test.title}</CardTitle>
                  {test.description && (
                    <CardDescription>{test.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (userAccess?.hasAccess) {
                        window.open(test.file_url, '_blank');
                      } else {
                        setShowAccessDialog(true);
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {userAccess?.hasAccess ? 'Download' : 'Unlock'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Study Planners */}
        {premiumContent?.planners && premiumContent.planners.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Study Planners</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {premiumContent.planners.map((planner) => (
                <Card key={planner.id} className="card-hover">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-accent/20 rounded-lg">
                        <BookOpen className="h-5 w-5 text-accent" />
                      </div>
                      <span className="px-2 py-1 text-xs font-medium bg-accent text-accent-foreground rounded-full">
                        Planner
                      </span>
                    </div>
                    <CardTitle className="text-lg">{planner.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => {
                        if (userAccess?.hasAccess) {
                          window.open(planner.file_url, '_blank');
                        } else {
                          setShowAccessDialog(true);
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {userAccess?.hasAccess ? 'Download' : 'Unlock'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <PremiumAccessDialog 
          open={showAccessDialog} 
          onOpenChange={setShowAccessDialog}
          onAccessGranted={() => setShowAccessDialog(false)}
        />
      </div>
    </DashboardLayout>
  );
};

export default Premium;
