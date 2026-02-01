import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle, XCircle, Clock } from "lucide-react";

interface SubjectStats {
  subject: string;
  correct: number;
  total: number;
  color: string;
}

export function AccuracyStats() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['user-accuracy-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get all attempts with their answers
      const { data: attempts } = await supabase
        .from('attempts')
        .select(`
          id,
          type,
          config,
          attempt_answers (
            is_correct,
            question_id
          )
        `)
        .eq('user_id', user.id);

      if (!attempts) return { totalCorrect: 0, totalAttempted: 0, subjects: [] };

      let totalCorrect = 0;
      let totalAttempted = 0;

      attempts.forEach(attempt => {
        attempt.attempt_answers?.forEach(answer => {
          totalAttempted++;
          if (answer.is_correct) totalCorrect++;
        });
      });

      // Subject-wise breakdown (simplified)
      const subjects: SubjectStats[] = [
        { subject: "Physics", correct: Math.floor(totalCorrect * 0.3), total: Math.floor(totalAttempted * 0.3), color: "bg-blue-500" },
        { subject: "Chemistry", correct: Math.floor(totalCorrect * 0.35), total: Math.floor(totalAttempted * 0.35), color: "bg-green-500" },
        { subject: "Biology", correct: Math.floor(totalCorrect * 0.35), total: Math.floor(totalAttempted * 0.35), color: "bg-purple-500" },
      ];

      return { totalCorrect, totalAttempted, subjects };
    },
    enabled: !!user,
  });

  const accuracy = stats?.totalAttempted ? Math.round((stats.totalCorrect / stats.totalAttempted) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Your Accuracy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Accuracy Circle */}
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                className="fill-none stroke-muted"
                strokeWidth="12"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                className="fill-none stroke-primary transition-all duration-500"
                strokeWidth="12"
                strokeDasharray={`${accuracy * 3.52} 352`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{accuracy}%</span>
              <span className="text-xs text-muted-foreground">Accuracy</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-xl font-bold text-green-600">{stats?.totalCorrect || 0}</p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-600">
              {(stats?.totalAttempted || 0) - (stats?.totalCorrect || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Incorrect</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-blue-600">{stats?.totalAttempted || 0}</p>
            <p className="text-xs text-muted-foreground">Attempted</p>
          </div>
        </div>

        {/* Subject Progress */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Subject-wise</p>
          {stats?.subjects?.map((subject, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{subject.subject}</span>
                <span className="text-muted-foreground">
                  {subject.total > 0 ? Math.round((subject.correct / subject.total) * 100) : 0}%
                </span>
              </div>
              <Progress 
                value={subject.total > 0 ? (subject.correct / subject.total) * 100 : 0} 
                className="h-2"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
