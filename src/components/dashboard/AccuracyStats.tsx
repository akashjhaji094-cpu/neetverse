import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Target, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SubjectStat {
  name: string;
  correct: number;
  wrong: number;
  skipped: number;
}

export function AccuracyStats() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['practice-accuracy-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get subjects
      const { data: subjects } = await supabase.from('subjects').select('id, name');
      const subjectMap = new Map(subjects?.map(s => [s.id, s.name]) || []);

      // Get all attempt answers with question subject
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

      if (!attempts || attempts.length === 0) {
        return { totalCorrect: 0, totalWrong: 0, totalSkipped: 0, accuracy: '0.00', subjects: [] as SubjectStat[] };
      }

      // Collect all question IDs to fetch their subjects
      const questionIdSet = new Set<string>();
      attempts.forEach(a => {
        a.attempt_answers?.forEach(ans => {
          if (ans.question_id) questionIdSet.add(ans.question_id);
        });
      });
      const allQuestionIds = Array.from(questionIdSet);

      // Fetch questions in batches to get subject_id
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

      // Calculate per-subject stats
      const subjectStats = new Map<string, SubjectStat>();
      
      // Initialize all subjects
      subjectMap.forEach((name) => {
        subjectStats.set(name, { name, correct: 0, wrong: 0, skipped: 0 });
      });

      let totalCorrect = 0;
      let totalWrong = 0;
      let totalSkipped = 0;

      attempts.forEach(attempt => {
        attempt.attempt_answers?.forEach(answer => {
          const subjectId = questionSubjectMap.get(answer.question_id);
          const subjectName = subjectId ? subjectMap.get(subjectId) : 'Unknown';
          if (!subjectName) return;

          let stat = subjectStats.get(subjectName);
          if (!stat) {
            stat = { name: subjectName, correct: 0, wrong: 0, skipped: 0 };
            subjectStats.set(subjectName, stat);
          }

          if (answer.chosen_option_index === null || answer.chosen_option_index === undefined) {
            totalSkipped++;
            stat.skipped++;
          } else if (answer.is_correct === true) {
            totalCorrect++;
            stat.correct++;
          } else {
            totalWrong++;
            stat.wrong++;
          }
        });
      });

      const total = totalCorrect + totalWrong;
      const accuracy = total > 0 ? ((totalCorrect / total) * 100).toFixed(2) : '0.00';

      // Filter out subjects with no data
      const subjectList = Array.from(subjectStats.values()).filter(s => s.correct + s.wrong + s.skipped > 0);

      return { totalCorrect, totalWrong, totalSkipped, accuracy, subjects: subjectList };
    },
    enabled: !!user,
  });

  const accuracyNum = parseFloat(String(stats?.accuracy || '0'));

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
          <div className="grid grid-cols-4 bg-muted/50 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
            <div className="p-2.5 text-center">Subject</div>
            <div className="p-2.5 text-center text-green-600">Correct</div>
            <div className="p-2.5 text-center text-destructive">Wrong</div>
            <div className="p-2.5 text-center text-muted-foreground">Skipped</div>
          </div>
          {stats?.subjects && stats.subjects.length > 0 ? (
            stats.subjects.map((s) => (
              <div key={s.name} className="grid grid-cols-4 border-t border-border">
                <div className="p-2.5 text-center text-sm font-medium">{s.name}</div>
                <div className="p-2.5 text-center text-sm font-bold text-green-600">{s.correct}</div>
                <div className="p-2.5 text-center text-sm font-bold text-destructive">{s.wrong}</div>
                <div className="p-2.5 text-center text-sm font-bold text-muted-foreground">{s.skipped}</div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-4 border-t border-border">
              <div className="p-2.5 text-center text-sm text-muted-foreground col-span-4">No data yet</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
