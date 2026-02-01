import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle, XCircle, Clock } from "lucide-react";
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
          config
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
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentAttempts && recentAttempts.length > 0 ? (
          <div className="space-y-3">
            {recentAttempts.map((attempt) => {
              const config = attempt.config as Record<string, unknown> | null;
              const isCompleted = !!attempt.finished_at;
              
              return (
                <div
                  key={attempt.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className={`p-2 rounded-lg ${
                    isCompleted 
                      ? attempt.score && attempt.score > 50 
                        ? 'bg-green-100 dark:bg-green-900/30' 
                        : 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-amber-100 dark:bg-amber-900/30'
                  }`}>
                    {isCompleted ? (
                      attempt.score && attempt.score > 50 
                        ? <CheckCircle className="h-4 w-4 text-green-600" />
                        : <XCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {attempt.type === 'practice' ? 'Practice Test' : 'Mock Test'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(attempt.started_at), { addSuffix: true })}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    {isCompleted ? (
                      <span className={`text-sm font-semibold ${
                        attempt.score && attempt.score > 50 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {attempt.score}%
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">In Progress</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
            <p className="text-xs">Start practicing to see your progress!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
