import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle, XCircle, Clock, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function RecentActivity() {
  const { user } = useAuth();

  const { data: recentAttempts } = useQuery({
    queryKey: ['recent-attempts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data } = await supabase
        .from('attempts')
        .select(`
          id,
          type,
          score,
          started_at,
          finished_at,
          config,
          attempt_answers (
            is_correct
          )
        `)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!user,
  });

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-full bg-primary/10">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-semibold text-base italic">Recent Activity</h3>
        </div>

        {recentAttempts && recentAttempts.length > 0 ? (
          <div className="space-y-2">
            {recentAttempts.map((attempt) => {
              const isCompleted = !!attempt.finished_at;
              const total = attempt.attempt_answers?.length || 0;
              const correct = attempt.attempt_answers?.filter(a => a.is_correct)?.length || 0;
              const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
              
              return (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${
                      !isCompleted 
                        ? 'bg-warning/10' 
                        : accuracy >= 60 
                          ? 'bg-green-100 dark:bg-green-900/20' 
                          : 'bg-destructive/10'
                    }`}>
                      {!isCompleted ? (
                        <Clock className="h-4 w-4 text-warning" />
                      ) : accuracy >= 60 ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {attempt.type === 'practice' ? 'Practice Test' : 'Mock Test'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(attempt.started_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  {isCompleted ? (
                    <span className={`text-sm font-bold ${accuracy >= 60 ? 'text-green-600' : 'text-destructive'}`}>
                      {accuracy}%
                    </span>
                  ) : (
                    <span className="text-xs text-warning font-semibold">In Progress</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground">Start practicing to track your progress!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
