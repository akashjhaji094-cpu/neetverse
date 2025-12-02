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
import { LoadingQuestions } from "@/components/mock/LoadingQuestions";
import { Question } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const Practice = () => {
  const { toast } = useToast();
  const [selectedChapter, setSelectedChapter] = useState<{ id: string; name: string; subjectId: string; subjectSlug: string; chapterSlug: string } | null>(null);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [showTest, setShowTest] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  // Optimized single query to fetch all question counts
  const { data: questionCounts, isLoading: isLoadingCounts } = useQuery({
    queryKey: ['question-counts'],
    queryFn: async () => {
      // Fetch all data in parallel with a single efficient approach
      const [subjectsRes, chaptersRes, questionsRes] = await Promise.all([
        supabase.from('subjects').select('id, slug'),
        supabase.from('chapters').select('id, slug, subject_id'),
        supabase.from('questions').select('chapter_id, subject_id')
      ]);

      const subjects = subjectsRes.data || [];
      const chapters = chaptersRes.data || [];
      const questions = questionsRes.data || [];

      // Create lookup maps for efficiency
      const subjectSlugMap = new Map(subjects.map(s => [s.id, s.slug]));
      
      // Count questions per chapter
      const questionCountMap = new Map<string, number>();
      questions.forEach(q => {
        const key = q.chapter_id;
        questionCountMap.set(key, (questionCountMap.get(key) || 0) + 1);
      });

      // Build the counts object with subject-chapter slug keys
      const counts: Record<string, number> = {};
      chapters.forEach(chapter => {
        const subjectSlug = subjectSlugMap.get(chapter.subject_id);
        if (subjectSlug) {
          const key = `${subjectSlug}-${chapter.slug}`;
          counts[key] = questionCountMap.get(chapter.id) || 0;
        }
      });

      console.log('Question counts loaded:', Object.keys(counts).length, 'chapters');
      return counts;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const startTestMutation = useMutation({
    mutationFn: async ({ chapterId, subjectId, count }: { chapterId: string; subjectId: string; count: number }) => {
      // Fetch all available questions for the chapter
      const { data: allQuestions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', chapterId)
        .eq('subject_id', subjectId);

      if (error) throw error;
      
      if (!allQuestions || allQuestions.length === 0) {
        throw new Error('No questions available');
      }

      // Cryptographically secure shuffle using Fisher-Yates with crypto.getRandomValues
      const shuffled = [...allQuestions];
      const randomValues = new Uint32Array(shuffled.length);
      crypto.getRandomValues(randomValues);
      
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomValues[i] % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Take requested count from shuffled array
      const randomQuestions = shuffled.slice(0, count);
      
      console.log('Fetched questions:', allQuestions.length, 'Shuffled and selected:', randomQuestions.length);
      console.log('First question ID:', randomQuestions[0]?.id);
      
      // Add artificial delay to show loading screen (min 1 second)
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

      return { score, correctCount, wrongCount, unattemptedCount };
    },
    onSuccess: (results) => {
      setTestResults(results);
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
  };

  // Show loading screen while fetching questions
  if (startTestMutation.isPending) {
    return <LoadingQuestions totalQuestions={selectedChapter ? 50 : 0} />;
  }

  // Show loading screen while fetching initial question counts
  if (isLoadingCounts) {
    return (
      <main className="min-h-screen bg-background">
        <section className="section-padding">
          <div className="container-custom space-y-6">
            <header className="space-y-2 text-center md:text-left">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Practice Centre
              </p>
              <h1 className="text-3xl md:text-4xl font-bold">
                NEET Chapters for Focused Practice
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto md:mx-0">
                Loading chapters and question counts...
              </p>
            </header>

            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Fetching questions from database...</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="h-full flex flex-col">
                  <CardHeader>
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <Skeleton key={j} className="h-10 w-full" />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
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
    <main className="min-h-screen bg-background">
      <section className="section-padding">
        <div className="container-custom space-y-6">
          <header className="space-y-2 text-center md:text-left">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Practice Centre
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">
              NEET Chapters for Focused Practice
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto md:mx-0">
              Select a chapter and choose the number of questions to start your practice test.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {neetSubjects.map((subject) => (
              <Card key={subject.id} className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle>{subject.name}</CardTitle>
                  {subject.tagline && (
                    <p className="text-sm text-muted-foreground">{subject.tagline}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 overflow-y-auto max-h-[480px]">
                  {subject.chapters.map((chapter) => {
                    const count = questionCounts?.[`${subject.id}-${chapter.id}`] || 0;
                    return (
                      <Button
                        key={chapter.id}
                        variant="outline"
                        className="w-full justify-between text-left text-sm"
                        type="button"
                        onClick={() => handleChapterClick(chapter, subject.id)}
                        disabled={count === 0}
                      >
                        <span>{chapter.name}</span>
                        <Badge variant={count > 0 ? "default" : "secondary"}>
                          {count > 0 ? `${count} Q` : 'No Q'}
                        </Badge>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
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
      </section>
    </main>
  );
};

export default Practice;
