import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";

export function PerformanceOverview() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['performance-overview', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get subjects
      const { data: subjects } = await supabase.from('subjects').select('id, name');
      const subjectMap = new Map(subjects?.map(s => [s.id, s.name]) || []);

      const { data: attempts } = await supabase
        .from('attempts')
        .select(`
          id,
          attempt_answers (
            is_correct,
            chosen_option_index,
            question_id
          )
        `)
        .eq('user_id', user.id);

      if (!attempts) return { correct: 0, incorrect: 0, skipped: 0, total: 0 };

      // Collect question IDs for subject lookup
      const allQuestionIds: string[] = [];
      attempts.forEach(a => {
        a.attempt_answers?.forEach(ans => {
          if (ans.question_id && !allQuestionIds.includes(ans.question_id)) {
            allQuestionIds.push(ans.question_id);
          }
        });
      });

      const questionSubjectMap = new Map<string, string>();
      const batchSize = 500;
      for (let i = 0; i < allQuestionIds.length; i += batchSize) {
        const batch = allQuestionIds.slice(i, i + batchSize);
        const { data: questions } = await supabase
          .from('questions')
          .select('id, subject_id')
          .in('id', batch);
        questions?.forEach(q => questionSubjectMap.set(q.id, q.subject_id));
      }

      let correct = 0;
      let incorrect = 0;
      let skipped = 0;

      // Per-subject breakdown
      const subjectData = new Map<string, { correct: number; incorrect: number; skipped: number }>();

      attempts.forEach(attempt => {
        attempt.attempt_answers?.forEach(answer => {
          const subjectId = questionSubjectMap.get(answer.question_id);
          const subjectName = subjectId ? subjectMap.get(subjectId) : 'Unknown';
          
          if (subjectName) {
            if (!subjectData.has(subjectName)) {
              subjectData.set(subjectName, { correct: 0, incorrect: 0, skipped: 0 });
            }
            const sd = subjectData.get(subjectName)!;

            if (answer.chosen_option_index === null || answer.chosen_option_index === undefined) {
              skipped++;
              sd.skipped++;
            } else if (answer.is_correct) {
              correct++;
              sd.correct++;
            } else {
              incorrect++;
              sd.incorrect++;
            }
          }
        });
      });

      return { correct, incorrect, skipped, total: correct + incorrect + skipped };
    },
    enabled: !!user,
  });

  const accuracy = stats?.total ? Math.round((stats.correct / (stats.correct + stats.incorrect || 1)) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-full bg-primary/10">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-semibold text-base italic">Performance Overview</h3>
        </div>

        <div className="flex items-center gap-6">
          {/* Stats Grid */}
          <div className="flex-1 grid grid-cols-2 gap-3">
            <StatBox label="CORRECT" value={stats?.correct || 0} />
            <StatBox label="INCORRECT" value={stats?.incorrect || 0} />
            <StatBox label="SKIPPED" value={stats?.skipped || 0} />
            <StatBox label="TOTAL" value={stats?.total || 0} />
          </div>

          {/* Accuracy Circle */}
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
              <circle
                cx="64"
                cy="64"
                r="52"
                className="fill-none stroke-muted"
                strokeWidth="10"
              />
              <circle
                cx="64"
                cy="64"
                r="52"
                className="fill-none stroke-primary transition-all duration-700"
                strokeWidth="10"
                strokeDasharray={`${accuracy * 3.267} 326.7`}
                strokeLinecap="round"
              />
              {stats && stats.incorrect > 0 && (
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  className="fill-none stroke-destructive transition-all duration-700"
                  strokeWidth="10"
                  strokeDasharray={`${((stats.incorrect / (stats.total || 1)) * 100) * 3.267} 326.7`}
                  strokeDashoffset={`-${accuracy * 3.267}`}
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{accuracy}%</span>
              <span className="text-[10px] font-semibold text-primary tracking-wider uppercase">Accuracy</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg p-3 text-center">
      <p className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value.toLocaleString()}</p>
    </div>
  );
}
