import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { TestInterface } from "@/components/practice/TestInterface";
import { MockTestConfig } from "@/components/mock/MockTestConfig";
import { MockTestAnalytics } from "@/components/mock/MockTestAnalytics";
import { toast } from "sonner";
import { ListChecks, BookOpen, Loader2 } from "lucide-react";
import { Question } from "@/lib/supabase";

interface SubjectAnalytics {
  subject: string;
  correct: number;
  wrong: number;
  unattempted: number;
  total: number;
  score: number;
  percentage: number;
}

const Test = () => {
  const { user } = useAuth();
  const [testMode, setTestMode] = useState<'select' | 'custom-config' | 'testing' | 'results'>('select');
  const [testType, setTestType] = useState<'custom' | 'full' | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<{
    score: number;
    correctCount: number;
    wrongCount: number;
    unattemptedCount: number;
    subjectAnalytics: SubjectAnalytics[];
  } | null>(null);

  const { data: questionCounts, isLoading: countsLoading } = useQuery({
    queryKey: ['question-counts-by-subject'],
    queryFn: async () => {
      const { data: subjects } = await supabase.from('subjects').select('*').order('name');
      const counts = await Promise.all(
        subjects?.map(async (subject) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('subject_id', subject.id);
          return { subject: subject.name, count: count || 0 };
        }) || []
      );
      return counts;
    },
  });

  const fetchQuestionsMutation = useMutation({
    mutationFn: async (params: { type: 'custom' | 'full', chapterIds?: string[] }) => {
      if (params.type === 'full') {
        // Fetch 45 questions from each subject (Physics, Chemistry, Biology)
        const { data: subjects } = await supabase.from('subjects').select('id, name').order('name');
        
        if (!subjects || subjects.length < 3) {
          throw new Error('Not enough subjects in database');
        }

        // For Biology, we need to split between Botany and Zoology chapters
        // This is a simplified approach - in production, you'd have better chapter categorization
        const allQuestions: Question[] = [];
        
        for (const subject of subjects) {
          let questionsToFetch = 45;
          
          // If Biology, fetch roughly half for Botany and half for Zoology
          if (subject.name.toLowerCase() === 'biology') {
            questionsToFetch = 90; // 45 Botany + 45 Zoology
          }

          const { data } = await supabase
            .from('questions')
            .select('*')
            .eq('subject_id', subject.id)
            .limit(questionsToFetch);

          if (data) {
            allQuestions.push(...(data as Question[]));
          }
        }

        // Shuffle and limit to 180 total
        const shuffled = allQuestions.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 180) as Question[];
      } else {
        // Custom test: fetch questions from selected chapters
        const { data } = await supabase
          .from('questions')
          .select('*')
          .in('chapter_id', params.chapterIds || [])
          .limit(180);

        if (!data || data.length < 180) {
          throw new Error('Not enough questions available from selected chapters');
        }

        // Shuffle questions
        return data.sort(() => Math.random() - 0.5) as Question[];
      }
    },
    onSuccess: (data) => {
      setQuestions(data);
      setTestMode('testing');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to fetch questions');
    },
  });

  const submitTestMutation = useMutation({
    mutationFn: async (answers: Record<string, number | null>) => {
      if (!user) throw new Error('Not authenticated');

      // Calculate scores
      let correctCount = 0;
      let wrongCount = 0;
      let unattemptedCount = 0;

      const subjectScores: Record<string, SubjectAnalytics> = {};

      // Get subject names for questions
      const { data: subjects } = await supabase.from('subjects').select('*');
      const subjectMap = subjects?.reduce((acc, s) => {
        acc[s.id] = s.name;
        return acc;
      }, {} as Record<string, string>) || {};

      questions.forEach((q) => {
        const subjectName = subjectMap[q.subject_id] || 'Unknown';
        
        if (!subjectScores[subjectName]) {
          subjectScores[subjectName] = {
            subject: subjectName,
            correct: 0,
            wrong: 0,
            unattempted: 0,
            total: 0,
            score: 0,
            percentage: 0,
          };
        }

        subjectScores[subjectName].total++;

        const userAnswer = answers[q.id];
        if (userAnswer === null || userAnswer === undefined) {
          unattemptedCount++;
          subjectScores[subjectName].unattempted++;
        } else if (userAnswer === q.correct_option_index) {
          correctCount++;
          subjectScores[subjectName].correct++;
        } else {
          wrongCount++;
          subjectScores[subjectName].wrong++;
        }
      });

      const score = correctCount * 4 - wrongCount * 1;

      // Calculate subject percentages and scores
      Object.values(subjectScores).forEach(subject => {
        subject.score = subject.correct * 4 - subject.wrong * 1;
        subject.percentage = (subject.score / (subject.total * 4)) * 100;
      });

      // Create attempt record
      const { data: attempt } = await supabase
        .from('attempts')
        .insert([{
          user_id: user.id,
          type: 'mock' as const,
          config: { type: testType, questionCount: questions.length } as any,
          score,
          finished_at: new Date().toISOString(),
          details: { subjectScores } as any,
        }])
        .select()
        .single();

      if (attempt) {
        // Create answer records
        const answerRecords = questions.map((q) => ({
          attempt_id: attempt.id,
          question_id: q.id,
          chosen_option_index: answers[q.id] ?? null,
          is_correct: answers[q.id] === q.correct_option_index,
        }));

        await supabase.from('attempt_answers').insert(answerRecords);
      }

      return {
        score,
        correctCount,
        wrongCount,
        unattemptedCount,
        subjectAnalytics: Object.values(subjectScores),
      };
    },
    onSuccess: (data) => {
      setResults(data);
      setTestMode('results');
      toast.success('Test submitted successfully!');
    },
    onError: () => {
      toast.error('Failed to submit test');
    },
  });

  const handleStartCustomTest = () => {
    setTestType('custom');
    setTestMode('custom-config');
  };

  const handleStartFullTest = () => {
    setTestType('full');
    fetchQuestionsMutation.mutate({ type: 'full' });
  };

  const handleCustomTestStart = (chapterIds: string[]) => {
    fetchQuestionsMutation.mutate({ type: 'custom', chapterIds });
  };

  const handleTestSubmit = (answers: Record<string, number | null>) => {
    submitTestMutation.mutate(answers);
  };

  const handleReset = () => {
    setTestMode('select');
    setTestType(null);
    setQuestions([]);
    setResults(null);
  };

  if (testMode === 'custom-config') {
    return (
      <MockTestConfig
        open={true}
        onClose={handleReset}
        onStart={handleCustomTestStart}
        loading={fetchQuestionsMutation.isPending}
      />
    );
  }

  if (testMode === 'testing') {
    return <TestInterface questions={questions} onSubmit={handleTestSubmit} />;
  }

  if (testMode === 'results' && results) {
    return (
      <MockTestAnalytics
        score={results.score}
        totalQuestions={questions.length}
        correctCount={results.correctCount}
        wrongCount={results.wrongCount}
        unattemptedCount={results.unattemptedCount}
        subjectAnalytics={results.subjectAnalytics}
        onClose={handleReset}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="section-padding">
        <div className="container-custom max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3">NEET Mock Tests</h1>
            <p className="text-muted-foreground">
              Full-length mock tests with 180 questions and 3-hour time limit
            </p>
          </div>

          {countsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Custom Test */}
              <Card className="card-hover cursor-pointer" onClick={handleStartCustomTest}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
                    <ListChecks className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <CardTitle>Custom Mock Test</CardTitle>
                  <CardDescription>
                    Select chapters from each subject and attempt 180 questions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Questions:</span>
                      <span className="font-medium">180</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time Limit:</span>
                      <span className="font-medium">3 Hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Selection:</span>
                      <span className="font-medium">Choose Chapters</span>
                    </div>
                  </div>
                  <Button className="w-full mt-4">Configure & Start</Button>
                </CardContent>
              </Card>

              {/* Full Syllabus Test */}
              <Card className="card-hover cursor-pointer" onClick={handleStartFullTest}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
                    <BookOpen className="w-6 h-6 text-secondary-foreground" />
                  </div>
                  <CardTitle>Full Syllabus Test</CardTitle>
                  <CardDescription>
                    Complete NEET mock test covering all subjects
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Physics:</span>
                      <span className="font-medium">45 Questions</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chemistry:</span>
                      <span className="font-medium">45 Questions</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Biology:</span>
                      <span className="font-medium">90 Questions</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4"
                    disabled={fetchQuestionsMutation.isPending}
                  >
                    {fetchQuestionsMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Start Full Test'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Question Bank Stats */}
          {questionCounts && questionCounts.length > 0 && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Available Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {questionCounts.map((item) => (
                    <div key={item.subject} className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">{item.count}</div>
                      <div className="text-sm text-muted-foreground">{item.subject}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
};

export default Test;
