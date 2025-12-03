import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Trophy, 
  Target, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  MinusCircle,
  BookOpen,
  TestTube,
  Calendar,
  BarChart3,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

interface AttemptDetails {
  correctCount?: number;
  wrongCount?: number;
  unattemptedCount?: number;
  subjectScores?: Record<string, { correct: number; wrong: number; unattempted: number; }>;
}

const Analytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch all attempts for the user
  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ['user-attempts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch attempt answers with question details
  const { data: attemptAnswers, isLoading: answersLoading } = useQuery({
    queryKey: ['user-attempt-answers', user?.id],
    queryFn: async () => {
      if (!user || !attempts) return [];
      
      const attemptIds = attempts.map(a => a.id);
      if (attemptIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('attempt_answers')
        .select(`
          *,
          questions (
            id,
            question_text,
            subject_id,
            chapter_id
          )
        `)
        .in('attempt_id', attemptIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!attempts && attempts.length > 0,
  });

  // Fetch subjects for mapping
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('*');
      return data || [];
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <CardTitle className="mb-4">Please Sign In</CardTitle>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </Card>
      </div>
    );
  }

  if (attemptsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const mockTests = attempts?.filter(a => a.type === 'mock') || [];
  const practiceTests = attempts?.filter(a => a.type === 'practice') || [];

  // Calculate statistics
  const totalAttempts = attempts?.length || 0;
  const totalScore = attempts?.reduce((sum, a) => sum + (a.score || 0), 0) || 0;
  const avgScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;

  // Calculate subject-wise performance from all attempts
  const subjectPerformance: Record<string, { correct: number; wrong: number; total: number }> = {};
  
  attemptAnswers?.forEach(answer => {
    const question = answer.questions as any;
    if (!question) return;
    
    const subject = subjects?.find(s => s.id === question.subject_id);
    const subjectName = subject?.name || 'Unknown';
    
    if (!subjectPerformance[subjectName]) {
      subjectPerformance[subjectName] = { correct: 0, wrong: 0, total: 0 };
    }
    
    subjectPerformance[subjectName].total++;
    if (answer.is_correct === true) {
      subjectPerformance[subjectName].correct++;
    } else if (answer.is_correct === false) {
      subjectPerformance[subjectName].wrong++;
    }
  });

  // Calculate total correct/wrong/unattempted
  const totalCorrect = Object.values(subjectPerformance).reduce((sum, s) => sum + s.correct, 0);
  const totalWrong = Object.values(subjectPerformance).reduce((sum, s) => sum + s.wrong, 0);
  const totalQuestions = Object.values(subjectPerformance).reduce((sum, s) => sum + s.total, 0);
  const totalUnattempted = totalQuestions - totalCorrect - totalWrong;

  const bestScore = attempts?.reduce((max, a) => Math.max(max, a.score || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container-custom py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Student Analytics</h1>
              <p className="text-sm text-muted-foreground">Track your NEET preparation progress</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalAttempts}</p>
                  <p className="text-sm text-muted-foreground">Total Tests</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgScore}</p>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{bestScore}</p>
                  <p className="text-sm text-muted-foreground">Best Score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <BarChart3 className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalQuestions}</p>
                  <p className="text-sm text-muted-foreground">Questions Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Performance Card */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Performance</CardTitle>
            <CardDescription>Your question-wise breakdown across all tests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <div>
                  <p className="text-3xl font-bold text-green-600">{totalCorrect}</p>
                  <p className="text-sm text-muted-foreground">Correct Answers</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                <XCircle className="w-10 h-10 text-red-500" />
                <div>
                  <p className="text-3xl font-bold text-red-600">{totalWrong}</p>
                  <p className="text-sm text-muted-foreground">Wrong Answers</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted border">
                <MinusCircle className="w-10 h-10 text-muted-foreground" />
                <div>
                  <p className="text-3xl font-bold">{totalUnattempted}</p>
                  <p className="text-sm text-muted-foreground">Unattempted</p>
                </div>
              </div>
            </div>

            {totalQuestions > 0 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span>Accuracy Rate</span>
                  <span>{((totalCorrect / (totalCorrect + totalWrong || 1)) * 100).toFixed(1)}%</span>
                </div>
                <Progress value={(totalCorrect / (totalCorrect + totalWrong || 1)) * 100} className="h-3" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subject-wise Performance */}
        {Object.keys(subjectPerformance).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Subject-wise Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(subjectPerformance).map(([subject, stats]) => {
                const accuracy = stats.correct + stats.wrong > 0 
                  ? (stats.correct / (stats.correct + stats.wrong)) * 100 
                  : 0;
                return (
                  <div key={subject} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{subject}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-600">✓ {stats.correct}</span>
                        <span className="text-red-600">✗ {stats.wrong}</span>
                        <span className="text-muted-foreground">{accuracy.toFixed(1)}%</span>
                      </div>
                    </div>
                    <Progress value={accuracy} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Tabs for Mock and Practice Tests */}
        <Tabs defaultValue="mock" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="mock" className="gap-2">
              <TestTube className="w-4 h-4" /> Mock Tests ({mockTests.length})
            </TabsTrigger>
            <TabsTrigger value="practice" className="gap-2">
              <BookOpen className="w-4 h-4" /> Practice ({practiceTests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mock" className="space-y-4">
            {mockTests.length === 0 ? (
              <Card className="p-8 text-center">
                <TestTube className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No mock tests taken yet</p>
                <Button className="mt-4" onClick={() => navigate('/test')}>
                  Take a Mock Test
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {mockTests.map((attempt) => {
                  const details = attempt.details as AttemptDetails | null;
                  return (
                    <Card key={attempt.id} className="hover:border-primary/50 transition-colors">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <TestTube className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">Mock Test</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(attempt.started_at), 'MMM dd, yyyy - hh:mm a')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">{attempt.score}</p>
                              <p className="text-xs text-muted-foreground">Score</p>
                            </div>
                            {details && (
                              <div className="flex gap-3 text-sm">
                                <span className="text-green-600">✓{details.correctCount || 0}</span>
                                <span className="text-red-600">✗{details.wrongCount || 0}</span>
                                <span className="text-muted-foreground">○{details.unattemptedCount || 0}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="practice" className="space-y-4">
            {practiceTests.length === 0 ? (
              <Card className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No practice sessions yet</p>
                <Button className="mt-4" onClick={() => navigate('/practice')}>
                  Start Practicing
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {practiceTests.map((attempt) => {
                  const details = attempt.details as AttemptDetails | null;
                  return (
                    <Card key={attempt.id} className="hover:border-primary/50 transition-colors">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-secondary/50">
                              <BookOpen className="w-5 h-5 text-secondary-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">Practice Session</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(attempt.started_at), 'MMM dd, yyyy - hh:mm a')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary">{attempt.score}</p>
                              <p className="text-xs text-muted-foreground">Score</p>
                            </div>
                            {details && (
                              <div className="flex gap-3 text-sm">
                                <span className="text-green-600">✓{details.correctCount || 0}</span>
                                <span className="text-red-600">✗{details.wrongCount || 0}</span>
                                <span className="text-muted-foreground">○{details.unattemptedCount || 0}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Analytics;
