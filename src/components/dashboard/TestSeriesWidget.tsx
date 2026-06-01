import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Target, ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function TestSeriesWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: testStats } = useQuery({
    queryKey: ['test-series-stats', user?.id],
    queryFn: async () => {
      if (!user) return { attempted: 0, available: 0, total: 0 };

      const { count: totalAttempts } = await supabase
        .from('attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'mock');

      const { count: totalQuestions } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });

      // Mock test combinations: with N questions and 180-question mocks,
      // unique combinations explode quickly. Display as "1L+" once we have
      // enough question pool to generate it.
      const qPool = totalQuestions || 0;
      const hasFullPool = qPool >= 180;

      return {
        attempted: totalAttempts || 0,
        available: hasFullPool ? '1L+' : String(Math.floor(qPool / 90)),
        total: hasFullPool ? '1L+' : String(Math.floor(qPool / 90)),
      };
    },
    enabled: !!user,
  });

  const { data: recentTests } = useQuery({
    queryKey: ['recent-mock-tests', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data } = await supabase
        .from('attempts')
        .select('id, started_at, score, finished_at, config')
        .eq('user_id', user.id)
        .eq('type', 'mock')
        .order('started_at', { ascending: false })
        .limit(3);

      return data || [];
    },
    enabled: !!user,
  });

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-base italic">Mock Tests</h3>
          </div>
          <Button 
            variant="default" 
            size="sm" 
            className="rounded-full gap-1 text-xs"
            onClick={() => navigate('/test')}
          >
            View All <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="border border-border rounded-lg p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">Attempted</p>
            <p className="text-xl font-bold">{testStats?.attempted || 0}</p>
          </div>
          <div className="border border-border rounded-lg p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">Available</p>
            <p className="text-xl font-bold">{testStats?.available || 0}</p>
          </div>
          <div className="border border-border rounded-lg p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">Total</p>
            <p className="text-xl font-bold">{testStats?.total || 0}</p>
          </div>
        </div>

        {/* Recent test list */}
        <div className="space-y-2">
          {recentTests && recentTests.length > 0 ? (
            recentTests.map((test) => (
              <div key={test.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">Biology Mock Test</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(test.started_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  {test.finished_at ? (
                    <Badge variant="secondary" className="text-xs">
                      Score: {test.score}
                    </Badge>
                  ) : (
                    <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                      In Progress
                    </Badge>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No mock tests attempted yet</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => navigate('/test')}
              >
                Start First Test
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
