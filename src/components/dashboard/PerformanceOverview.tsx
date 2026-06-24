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

      // FIXED: previously this also joined questions->subjects to build a
      // per-subject breakdown that was NEVER rendered anywhere — dead code.
      // Worse, it had a real bug: if a question's subject failed to resolve
      // for any reason, that answer was silently dropped from the OVERALL
      // correct/incorrect/skipped totals too (not just the unused subject
      // breakdown). Removed entirely — this widget only needs the totals,
      // so we count straight from attempt_answers with no extra round trips.
      const { data: attempts } = await supabase
        .from('attempts')
        .select(`
          id,
          attempt_answers (
            is_correct,
            chosen_option_index
          )
        `)
        .eq('user_id', user.id);

      if (!attempts) return { correct: 0, incorrect: 0, skipped: 0, total: 0 };

      let correct = 0;
      let incorrect = 0;
      let skipped = 0;

      attempts.forEach(attempt => {
        attempt.attempt_answers?.forEach(answer => {
          if (answer.chosen_option_index === null || answer.chosen_option_index === undefined) {
            skipped++;
          } else if (answer.is_correct) {
            correct++;
          } else {
            incorrect++;
          }
        });
      });

      return { correct, incorrect, skipped, total: correct + incorrect + skipped };
    },
    enabled: !!user,
  });

  // Center number — standard "accuracy" definition: correct / ATTEMPTED
  // (excludes skipped from the denominator). This matches the definition
  // used everywhere else in the app (Weak Chapters, Test History).
  const attempted = (stats?.correct || 0) + (stats?.incorrect || 0);
  const accuracy = attempted ? Math.round(((stats?.correct || 0) / attempted) * 100) : 0;

  // FIXED: the two arcs previously used DIFFERENT denominators (accuracy
  // used correct/attempted, but the red "incorrect" arc used incorrect/total)
  // — so the two arcs didn't compose into a sensible donut. Both now use
  // % of TOTAL, so blue + red + the remaining gray background always add
  // up to a coherent correct/incorrect/skipped breakdown of the full circle.
  const correctOfTotalPct = stats?.total ? (stats.correct / stats.total) * 100 : 0;
  const incorrectOfTotalPct = stats?.total ? (stats.incorrect / stats.total) * 100 : 0;

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
                strokeDasharray={`${correctOfTotalPct * 3.267} 326.7`}
                strokeLinecap="round"
              />
              {stats && stats.incorrect > 0 && (
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  className="fill-none stroke-destructive transition-all duration-700"
                  strokeWidth="10"
                  strokeDasharray={`${incorrectOfTotalPct * 3.267} 326.7`}
                  strokeDashoffset={`-${correctOfTotalPct * 3.267}`}
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
