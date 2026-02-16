import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { neetSubjects } from "@/data/neetChapters";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TestConfig } from "@/components/practice/TestConfig";
import { TestInterface } from "@/components/practice/TestInterface";
import { TestResults } from "@/components/practice/TestResults";
import { QuestionReview } from "@/components/practice/QuestionReview";
import { LoadingQuestions } from "@/components/mock/LoadingQuestions";
import { Question } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Target, Atom, FlaskConical, Dna } from "lucide-react";

const subjectIcons: Record<string, React.ElementType> = {
  physics: Atom,
  chemistry: FlaskConical,
  biology: Dna,
};

const subjectGradients: Record<string, string> = {
  physics: "from-blue-500 to-blue-600",
  chemistry: "from-green-500 to-green-600",
  biology: "from-purple-500 to-purple-600",
};

const Practice = () => {
  const { toast } = useToast();
  const [selectedChapter, setSelectedChapter] = useState<{ id: string; name: string; subjectId: string; subjectSlug: string; chapterSlug: string } | null>(null);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [showTest, setShowTest] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, number | null>>({});
  const [showReview, setShowReview] = useState(false);

  const { data: questionCounts } = useQuery({
    queryKey: ['question-counts'],
    queryFn: async () => {
      const { data: subjects } = await supabase.from('subjects').select('id, slug');
      
      const counts: Record<string, number> = {};
      
      for (const subject of subjects || []) {
        const { data: chapters } = await supabase
          .from('chapters')
          .select('id, slug')
          .eq('subject_id', subject.id);
        
        for (const chapter of chapters || []) {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('subject_id', subject.id)
            .eq('chapter_id', chapter.id);
          
          counts[`${subject.slug}-${chapter.slug}`] = count || 0;
        }
      }
      
      return counts;
    }
  });

  const startTestMutation = useMutation({
    mutationFn: async ({ chapterId, subjectId, count }: { chapterId: string; subjectId: string; count: number }) => {
      const { data: allQuestions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', chapterId)
        .eq('subject_id', subjectId);

      if (error) throw error;
      
      if (!allQuestions || allQuestions.length === 0) {
        throw new Error('No questions available');
      }

      const shuffled = [...allQuestions];
      const randomValues = new Uint32Array(shuffled.length);
      crypto.getRandomValues(randomValues);
      
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomValues[i] % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      const randomQuestions = shuffled.slice(0, count);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return randomQuestions as Question[];
    },
    onSuccess: (questions) => {
      setTestQuestions(questions);
      setShowTest(true);
      setSelectedChapter(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load questions. Please try again.",
        variant: "destructive"
      });
    }
  });

  const submitTestMutation = useMutation({
    mutationFn: async ({ answers }: { answers: Record<string, number | null> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: attempt, error: attemptError } = await supabase
        .from('attempts')
        .insert({
          user_id: user.id,
          type: 'practice',
          config: { question_count: testQuestions.length }
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      let correctCount = 0;
      let wrongCount = 0;
      let unattemptedCount = 0;

      const answerInserts = testQuestions.map(question => {
        const chosenIndex = answers[question.id];
        const isCorrect = chosenIndex !== undefined && chosenIndex !== null
          ? chosenIndex === question.correct_option_index
          : null;

        if (isCorrect === true) correctCount++;
        else if (isCorrect === false) wrongCount++;
        else unattemptedCount++;

        return {
          attempt_id: attempt.id,
          question_id: question.id,
          chosen_option_index: chosenIndex ?? null,
          is_correct: isCorrect
        };
      });

      await supabase.from('attempt_answers').insert(answerInserts);

      const score = (correctCount * 4) - wrongCount;

      await supabase
        .from('attempts')
        .update({
          finished_at: new Date().toISOString(),
          score,
          details: { correctCount, wrongCount, unattemptedCount }
        })
        .eq('id', attempt.id);

      return { score, correctCount, wrongCount, unattemptedCount, answers };
    },
    onSuccess: (results) => {
      setTestResults(results);
      setTestAnswers(results.answers);
      setShowTest(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit test. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleChapterClick = async (chapter: { id: string; name: string }, subjectSlug: string) => {
    const { data: subjects } = await supabase.from('subjects').select('id').eq('slug', subjectSlug).single();
    const { data: chapters } = await supabase.from('chapters').select('id').eq('slug', chapter.id).single();

    if (subjects && chapters) {
      setSelectedChapter({
        id: chapters.id,
        name: chapter.name,
        subjectId: subjects.id,
        subjectSlug,
        chapterSlug: chapter.id,
      });
    }
  };

  const handleStartTest = (count: number) => {
    if (selectedChapter) {
      startTestMutation.mutate({
        chapterId: selectedChapter.id,
        subjectId: selectedChapter.subjectId,
        count
      });
    }
  };

  const handleSubmitTest = (answers: Record<string, number | null>) => {
    submitTestMutation.mutate({ answers });
  };

  const handleCloseResults = () => {
    setTestResults(null);
    setTestQuestions([]);
    setTestAnswers({});
    setShowReview(false);
  };

  const handleReview = () => {
    setShowReview(true);
  };

  if (startTestMutation.isPending) {
    return <LoadingQuestions totalQuestions={selectedChapter ? 50 : 0} />;
  }

  if (showReview && testQuestions.length > 0) {
    return (
      <QuestionReview
        questions={testQuestions}
        answers={testAnswers}
        onClose={() => setShowReview(false)}
      />
    );
  }

  if (testResults) {
    return (
      <TestResults
        score={testResults.score}
        totalQuestions={testQuestions.length}
        correctCount={testResults.correctCount}
        wrongCount={testResults.wrongCount}
        unattemptedCount={testResults.unattemptedCount}
        onClose={handleCloseResults}
        onReview={handleReview}
      />
    );
  }

  if (showTest) {
    return (
      <TestInterface
        questions={testQuestions}
        onSubmit={handleSubmitTest}
      />
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Target className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Practice Centre</h1>
            <p className="text-muted-foreground">
              Select a chapter and start your focused practice
            </p>
          </div>
        </div>

        {/* Subject Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {neetSubjects.map((subject) => {
            const Icon = subjectIcons[subject.id] || Atom;
            const gradient = subjectGradients[subject.id] || "from-primary to-primary-glow";
            
            return (
              <Card key={subject.id} className="overflow-hidden">
                {/* Subject Header with Gradient */}
                <div className={`bg-gradient-to-r ${gradient} p-4 text-white`}>
                  <div className="flex items-center gap-3">
                    <Icon className="h-7 w-7" />
                    <div>
                      <h2 className="text-lg font-bold">{subject.name}</h2>
                      {subject.tagline && (
                        <p className="text-sm text-white/80">{subject.tagline}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Chapter List */}
                <CardContent className="p-3 space-y-1.5 overflow-y-auto max-h-[420px]">
                  {subject.chapters.map((chapter) => {
                    const count = questionCounts?.[`${subject.id}-${chapter.id}`] || 0;
                    return (
                      <Button
                        key={chapter.id}
                        variant="ghost"
                        className="w-full justify-between text-left text-sm h-auto py-2.5 px-3 hover:bg-muted/80"
                        type="button"
                        onClick={() => handleChapterClick(chapter, subject.id)}
                        disabled={count === 0}
                      >
                        <span className="truncate mr-2">{chapter.name}</span>
                        <Badge 
                          variant={count > 0 ? "default" : "secondary"} 
                          className={count > 0 ? "bg-primary/15 text-primary hover:bg-primary/20 border-0" : ""}
                        >
                          {count > 0 ? `${count} Q` : '—'}
                        </Badge>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedChapter && (
          <TestConfig
            open={!!selectedChapter}
            onClose={() => setSelectedChapter(null)}
            chapterName={selectedChapter.name}
            totalQuestions={questionCounts?.[`${selectedChapter.subjectSlug}-${selectedChapter.chapterSlug}`] || 0}
            onStart={handleStartTest}
            loading={startTestMutation.isPending}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Practice;
