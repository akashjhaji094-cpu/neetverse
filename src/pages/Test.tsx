import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { TestInterface } from "@/components/practice/TestInterface";
import { MockTestConfig } from "@/components/mock/MockTestConfig";
import { MockTestAnalytics } from "@/components/mock/MockTestAnalytics";
import { LoadingQuestions } from "@/components/mock/LoadingQuestions";
import { PremiumAccessDialog } from "@/components/mock/PremiumAccessDialog";
import { QuestionReview } from "@/components/practice/QuestionReview";
import { toast } from "sonner";
import { ListChecks, BookOpen, Loader2, Crown, Download, GraduationCap } from "lucide-react";
import { Question } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

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
  const [testMode, setTestMode] = useState<'select' | 'custom-config' | 'testing' | 'results' | 'review'>('select');
  const [testType, setTestType] = useState<'custom' | 'full' | 'premium' | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [testAnswers, setTestAnswers] = useState<Record<string, number | null>>({});
  const [results, setResults] = useState<{
    score: number;
    correctCount: number;
    wrongCount: number;
    unattemptedCount: number;
    subjectAnalytics: SubjectAnalytics[];
  } | null>(null);

  // Fetch available premium tests and planners
  const { data: premiumContent } = useQuery({
    queryKey: ['premium-content', user?.id],
    queryFn: async () => {
      if (!user) return { tests: [], planners: [], hasAccess: false };

      // Check if user has any active access key
      const { data: accessKeys } = await supabase
        .from('premium_access_keys')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      const hasAccess = (accessKeys?.length || 0) > 0;

      if (!hasAccess) {
        return { tests: [], planners: [], hasAccess: false };
      }

      // Fetch premium tests (available to all OR specific to user's key)
      const { data: tests } = await supabase
        .from('premium_tests')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch all planners (public)
      const { data: planners } = await supabase
        .from('premium_planners')
        .select('*')
        .order('created_at', { ascending: false });

      return { tests: tests || [], planners: planners || [], hasAccess };
    },
    enabled: !!user,
  });

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
        // Fetch exactly 45 Physics, 45 Chemistry, 90 Biology with weighted chapter selection
        const { data: subjects } = await supabase.from('subjects').select('id, name, slug');
        
        if (!subjects || subjects.length < 3) {
          throw new Error('Not enough subjects in database');
        }

        // Get chapters for weighted selection
        const { data: allChapters } = await supabase.from('chapters').select('id, subject_id, slug');
        
        if (!allChapters) {
          throw new Error('No chapters found in database');
        }

        const allQuestions: Question[] = [];
        
        // Import weightage data
        const { getWeightageForSubject, addRandomVariation } = await import('@/data/neetWeightage');
        
        // Define required question counts per subject
        const subjectRequirements = [
          { name: 'Physics', count: 45 },
          { name: 'Chemistry', count: 45 },
          { name: 'Biology', count: 90 },
        ];

        for (const requirement of subjectRequirements) {
          const subject = subjects.find(s => s.name.toLowerCase() === requirement.name.toLowerCase());
          
          if (!subject) {
            throw new Error(`${requirement.name} subject not found in database`);
          }

          // Get chapters for this subject
          const subjectChapters = allChapters.filter(c => c.subject_id === subject.id);
          
          // Get weightage configuration
          const weightageConfig = getWeightageForSubject(subject.slug);
          
          // Build chapter weights map with random variation
          const chapterWeights = new Map<string, number>();
          let totalWeight = 0;
          
          subjectChapters.forEach(chapter => {
            const config = weightageConfig.find(w => w.chapterId === chapter.slug);
            const baseWeight = config?.weight || 1;
            const randomizedWeight = addRandomVariation(baseWeight);
            chapterWeights.set(chapter.id, randomizedWeight);
            totalWeight += randomizedWeight;
          });

          // Calculate how many questions from each chapter
          const chapterQuestionCounts = new Map<string, number>();
          let remainingQuestions = requirement.count;
          
          // Distribute questions based on weights
          subjectChapters.forEach(chapter => {
            const weight = chapterWeights.get(chapter.id) || 1;
            const proportion = weight / totalWeight;
            const questionCount = Math.max(1, Math.round(proportion * requirement.count));
            chapterQuestionCounts.set(chapter.id, questionCount);
            remainingQuestions -= questionCount;
          });

          // Adjust if we over/under allocated due to rounding
          while (remainingQuestions !== 0) {
            const chapters = Array.from(chapterQuestionCounts.keys());
            const randomChapter = chapters[Math.floor(Math.random() * chapters.length)];
            const currentCount = chapterQuestionCounts.get(randomChapter) || 0;
            
            if (remainingQuestions > 0) {
              chapterQuestionCounts.set(randomChapter, currentCount + 1);
              remainingQuestions--;
            } else if (currentCount > 1) {
              chapterQuestionCounts.set(randomChapter, currentCount - 1);
              remainingQuestions++;
            }
          }

          // Fetch questions from each chapter according to calculated counts
          for (const [chapterId, count] of chapterQuestionCounts.entries()) {
            const { data: chapterQuestions } = await supabase
              .from('questions')
              .select('*')
              .eq('chapter_id', chapterId);

            if (chapterQuestions && chapterQuestions.length > 0) {
              // Shuffle and take required number
              const shuffled = chapterQuestions.sort(() => Math.random() - 0.5);
              const selected = shuffled.slice(0, Math.min(count, shuffled.length));
              allQuestions.push(...(selected as Question[]));
            }
          }
        }

        // Final shuffle to mix subjects
        const finalQuestions = allQuestions.sort(() => Math.random() - 0.5);
        
        // Ensure we have exactly 180 questions
        if (finalQuestions.length < 180) {
          throw new Error(`Not enough questions available. Found ${finalQuestions.length}, need 180`);
        }
        
        return finalQuestions.slice(0, 180) as Question[];
      } else {
        // Custom test: fetch questions from selected chapters with proper subject distribution
        // NEET ratio: 45 Physics, 45 Chemistry, 90 Biology
        const { data: subjects } = await supabase.from('subjects').select('id, name, slug');
        
        if (!subjects || subjects.length < 3) {
          throw new Error('Not enough subjects in database');
        }

        // Get chapters to identify which subject each belongs to
        const { data: allChapters } = await supabase
          .from('chapters')
          .select('id, subject_id')
          .in('id', params.chapterIds || []);

        if (!allChapters || allChapters.length === 0) {
          throw new Error('No valid chapters selected');
        }

        // Group selected chapters by subject
        const chaptersBySubject = new Map<string, string[]>();
        allChapters.forEach(chapter => {
          const existing = chaptersBySubject.get(chapter.subject_id) || [];
          existing.push(chapter.id);
          chaptersBySubject.set(chapter.subject_id, existing);
        });

        // Define required question counts per subject (NEET ratio)
        const subjectRequirements = [
          { name: 'Physics', count: 45 },
          { name: 'Chemistry', count: 45 },
          { name: 'Biology', count: 90 },
        ];

        const allQuestions: Question[] = [];

        for (const requirement of subjectRequirements) {
          const subject = subjects.find(s => s.name.toLowerCase() === requirement.name.toLowerCase());
          
          if (!subject) {
            throw new Error(`${requirement.name} subject not found in database`);
          }

          // Get selected chapters for this subject
          const selectedChaptersForSubject = chaptersBySubject.get(subject.id) || [];
          
          if (selectedChaptersForSubject.length === 0) {
            throw new Error(`No chapters selected for ${requirement.name}. Please select at least one chapter from each subject.`);
          }

          // Fetch all questions from selected chapters for this subject
          const { data: subjectQuestions } = await supabase
            .from('questions')
            .select('*')
            .in('chapter_id', selectedChaptersForSubject);

          if (!subjectQuestions || subjectQuestions.length < requirement.count) {
            throw new Error(`Not enough ${requirement.name} questions. Found ${subjectQuestions?.length || 0}, need ${requirement.count}. Please select more chapters.`);
          }

          // Cryptographically secure shuffle using Fisher-Yates
          const shuffled = [...subjectQuestions];
          const randomValues = new Uint32Array(shuffled.length);
          crypto.getRandomValues(randomValues);
          
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = randomValues[i] % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          // Take required count for this subject
          allQuestions.push(...(shuffled.slice(0, requirement.count) as Question[]));
        }

        // Final shuffle to mix all subjects together
        const finalRandomValues = new Uint32Array(allQuestions.length);
        crypto.getRandomValues(finalRandomValues);
        
        for (let i = allQuestions.length - 1; i > 0; i--) {
          const j = finalRandomValues[i] % (i + 1);
          [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
        }

        console.log('Custom mock test distribution:', {
          total: allQuestions.length,
          physics: allQuestions.filter(q => subjects.find(s => s.name === 'Physics')?.id === q.subject_id).length,
          chemistry: allQuestions.filter(q => subjects.find(s => s.name === 'Chemistry')?.id === q.subject_id).length,
          biology: allQuestions.filter(q => subjects.find(s => s.name === 'Biology')?.id === q.subject_id).length,
        });

        return allQuestions;
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
          details: { subjectScores, correctCount, wrongCount, unattemptedCount } as any,
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
        answers,
      };
    },
    onSuccess: (data) => {
      setResults(data);
      setTestAnswers(data.answers);
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

  const handleStartPremiumTest = () => {
    setShowPremiumDialog(true);
  };


  const handleCustomTestStart = (chapterIds: string[]) => {
    fetchQuestionsMutation.mutate({ type: 'custom', chapterIds });
  };

  const handleTestSubmit = (answers: Record<string, number | null>) => {
    setTestAnswers(answers);
    submitTestMutation.mutate(answers);
  };

  const handleReset = () => {
    setTestMode('select');
    setTestType(null);
    setQuestions([]);
    setResults(null);
    setTestAnswers({});
  };

  const handleReview = () => {
    setTestMode('review');
  };

  // Show loading animation for full syllabus test
  if (testType === 'full' && fetchQuestionsMutation.isPending) {
    return <LoadingQuestions totalQuestions={180} />;
  }

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

  if (testMode === 'review' && questions.length > 0) {
    return (
      <QuestionReview
        questions={questions}
        answers={testAnswers}
        onClose={() => setTestMode('results')}
      />
    );
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
        onReview={handleReview}
      />
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent/10 rounded-xl">
              <GraduationCap className="h-7 w-7 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">NEET Mock Tests</h1>
              <p className="text-muted-foreground">
                Full-length mock tests with 180 questions and 3-hour time limit
              </p>
            </div>
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

          {/* Premium Test Card */}
          <Card className="mt-6 border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-50/50 to-orange-50/50 dark:from-yellow-900/10 dark:to-orange-900/10">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-yellow-500 flex items-center justify-center mb-4">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="flex items-center gap-2">
                Premium Test Series
                <span className="px-2 py-1 text-xs bg-yellow-500 text-white rounded-full">Exclusive</span>
              </CardTitle>
              <CardDescription className="space-y-3">
                <p className="font-semibold text-foreground">
                  🎯 Based on <span className="text-yellow-600 dark:text-yellow-400 font-bold">Past 20 Years PYQs</span> + PW, Allen, Akash Test Questions
                </p>
                <p className="text-base font-bold text-primary">
                  ✨ Use this and you will <span className="underline decoration-yellow-500 decoration-2">definitely be in a GMC next year!</span>
                </p>
                <div className="pt-2 border-t border-border">
                  <p className="text-sm">Access exclusive test series with detailed planners</p>
                  <p className="text-sm mt-2">
                    💰 <span className="font-semibold text-green-600 dark:text-green-400">Only ₹399</span> | 
                    Contact: <a href="https://t.me/akaxxh" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">@akaxxh</a> on Telegram
                  </p>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {premiumContent?.hasAccess ? (
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                      ✓ Premium Access Active
                    </p>
                  </div>

                  {/* Premium Tests */}
                  {premiumContent.tests.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm">Premium Test PDFs</h3>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {premiumContent.tests.map((test: any) => (
                          <div key={test.id} className="p-3 bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-sm">{test.title}</h4>
                                {test.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{test.description}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(test.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-yellow-500 hover:bg-yellow-600 text-white shrink-0"
                                onClick={() => window.open(test.file_url, "_blank")}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Study Planners */}
                  {premiumContent.planners.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm">Study Planners</h3>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {premiumContent.planners.map((planner: any) => (
                          <div key={planner.id} className="p-3 bg-white dark:bg-gray-800 border border-border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{planner.title}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(planner.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(planner.file_url, "_blank")}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {premiumContent.tests.length === 0 && premiumContent.planners.length === 0 && (
                    <div className="bg-muted rounded-lg p-4 text-center text-sm text-muted-foreground">
                      No materials available yet. New tests coming soon!
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  onClick={handleStartPremiumTest}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Enter Access Key
                </Button>
              )}
            </CardContent>
          </Card>

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

          <PremiumAccessDialog
            open={showPremiumDialog}
            onOpenChange={setShowPremiumDialog}
            onAccessGranted={() => {}}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Test;
