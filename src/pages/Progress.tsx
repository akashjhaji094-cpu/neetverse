import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, 
  Calendar, 
  Target, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Trophy
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const Progress = () => {
  const { user } = useAuth();

  const { data: allAttempts } = useQuery({
    queryKey: ['all-attempts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data } = await supabase
        .from('attempts')
        .select(`
          *,
          attempt_answers (
            is_correct
          )
        `)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });
      
      return data || [];
    },
    enabled: !!user,
  });

  const { data: streakData } = useQuery({
    queryKey: ['user-streak', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      return data;
    },
    enabled: !!user,
  });

  // Calculate stats
  const totalAttempts = allAttempts?.length || 0;
  const completedAttempts = allAttempts?.filter(a => a.finished_at)?.length || 0;
  const totalQuestions = allAttempts?.reduce((sum, a) => sum + (a.attempt_answers?.length || 0), 0) || 0;
  const correctAnswers = allAttempts?.reduce((sum, a) => 
    sum + (a.attempt_answers?.filter(ans => ans.is_correct)?.length || 0), 0
  ) || 0;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Your Progress
          </h1>
          <p className="text-muted-foreground">
            Track your learning journey and analyze your performance
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalAttempts}</p>
                  <p className="text-xs text-muted-foreground">Total Tests</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{accuracy}%</p>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalQuestions}</p>
                  <p className="text-xs text-muted-foreground">Questions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Trophy className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{streakData?.longest_streak || 0}</p>
                  <p className="text-xs text-muted-foreground">Best Streak</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Test History
            </TabsTrigger>
            <TabsTrigger value="subjects" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Subject Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Tests</CardTitle>
              </CardHeader>
              <CardContent>
                {allAttempts && allAttempts.length > 0 ? (
                  <div className="space-y-4">
                    {allAttempts.slice(0, 10).map((attempt) => {
                      const total = attempt.attempt_answers?.length || 0;
                      const correct = attempt.attempt_answers?.filter(a => a.is_correct)?.length || 0;
                      const attemptAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
                      
                      return (
                        <div
                          key={attempt.id}
                          className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className={`p-3 rounded-xl ${
                            attemptAccuracy >= 70 
                              ? 'bg-green-100 dark:bg-green-900/30' 
                              : attemptAccuracy >= 40 
                                ? 'bg-amber-100 dark:bg-amber-900/30'
                                : 'bg-red-100 dark:bg-red-900/30'
                          }`}>
                            {attemptAccuracy >= 70 ? (
                              <CheckCircle className="h-6 w-6 text-green-600" />
                            ) : attemptAccuracy >= 40 ? (
                              <Clock className="h-6 w-6 text-amber-600" />
                            ) : (
                              <XCircle className="h-6 w-6 text-red-600" />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">
                                {attempt.type === 'practice' ? 'Practice Test' : 'Mock Test'}
                              </p>
                              {!attempt.finished_at && (
                                <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                                  In Progress
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(attempt.started_at), 'PPp')}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${
                              attemptAccuracy >= 70 
                                ? 'text-green-600' 
                                : attemptAccuracy >= 40 
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            }`}>
                              {attemptAccuracy}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {correct}/{total} correct
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No tests yet</p>
                    <p className="text-muted-foreground">Start practicing to see your progress!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subjects" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Subject-wise Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Physics */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="font-medium">Physics</span>
                    </div>
                    <span className="text-sm text-muted-foreground">65%</span>
                  </div>
                  <ProgressBar value={65} className="h-2" />
                </div>

                {/* Chemistry */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="font-medium">Chemistry</span>
                    </div>
                    <span className="text-sm text-muted-foreground">72%</span>
                  </div>
                  <ProgressBar value={72} className="h-2" />
                </div>

                {/* Biology */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="font-medium">Biology</span>
                    </div>
                    <span className="text-sm text-muted-foreground">78%</span>
                  </div>
                  <ProgressBar value={78} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Progress;
