import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Target, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AccuracyStats() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['custom-test-analytics', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: attempts } = await supabase
        .from('attempts')
        .select(`
          id,
          attempt_answers (
            is_correct,
            question_id
          )
        `)
        .eq('user_id', user.id);

      if (!attempts) return { totalCorrect: 0, totalWrong: 0, accuracy: 0, subjects: [] };

      let totalCorrect = 0;
      let totalWrong = 0;

      attempts.forEach(attempt => {
        attempt.attempt_answers?.forEach(answer => {
          if (answer.is_correct === true) totalCorrect++;
          else if (answer.is_correct === false) totalWrong++;
        });
      });

      const accuracy = totalCorrect + totalWrong > 0 
        ? ((totalCorrect / (totalCorrect + totalWrong)) * 100).toFixed(2) 
        : '0.00';

      return { totalCorrect, totalWrong, accuracy };
    },
    enabled: !!user,
  });

  const accuracyNum = parseFloat(stats?.accuracy || '0');

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-base italic">Practice Analytics</h3>
          </div>
          <Button 
            variant="default" 
            size="sm" 
            className="rounded-full gap-1 text-xs"
            onClick={() => navigate('/practice')}
          >
            Create Test <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Overall accuracy */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase mb-1">Overall Accuracy</p>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">{stats?.accuracy || '0.00'}%</span>
            {accuracyNum >= 70 && (
              <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase">Excellent</span>
            )}
            {accuracyNum >= 40 && accuracyNum < 70 && (
              <span className="text-xs font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full uppercase">Good</span>
            )}
            {accuracyNum > 0 && accuracyNum < 40 && (
              <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full uppercase">Needs Work</span>
            )}
          </div>
        </div>

        {/* Stats table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/50 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
            <div className="p-2.5 text-center">Subject</div>
            <div className="p-2.5 text-center text-green-600">Correct</div>
            <div className="p-2.5 text-center text-destructive">Wrong</div>
          </div>
          <div className="grid grid-cols-3 border-t border-border">
            <div className="p-2.5 text-center text-sm font-medium">Biology</div>
            <div className="p-2.5 text-center text-sm font-bold text-green-600">{stats?.totalCorrect || 0}</div>
            <div className="p-2.5 text-center text-sm font-bold text-destructive">{stats?.totalWrong || 0}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
