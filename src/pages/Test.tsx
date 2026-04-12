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
import { QuestionReview } from "@/components/practice/QuestionReview";
import { AttemptModeSelector } from "@/components/mock/AttemptModeSelector";
import { printQuestionPaper } from "@/components/mock/generateQuestionPaper";
import { toast } from "sonner";
import { ListChecks, Loader2, GraduationCap, Dna, Atom } from "lucide-react";
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
  const [testMode, setTestMode] = useState<'select' | 'custom-config' | 'bio-config' | 'testing' | 'results' | 'review'>('select');
  const [testType, setTestType] = useState<'custom' | 'full-bio' | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [testAnswers, setTestAnswers] = useState<Record<string, number | null>>({});
  const [results, setResults] = useState<{
    score: number;
    correctCount: number;
    wrongCount: number;
    unattemptedCount: number;
    subjectAnalytics: SubjectAnalytics[];
  } | null>(null);

  const { data: questionCounts } = useQuery({
    queryKey: ['question-counts-by-subject'],
    queryFn: async () => {
      const { data: subjects } = await supabase.from('subjects').select('*').order('name');
      const counts = await Promise.all(
        subjects?.map(async (subject) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('subject_id', subject.id);
          return { subject: subject.name, count: count || 0, id: subject.id };
        }) || []
      );
      return counts;
    },
  });

  const fetchQuestionsMutation = useMutation({
    mutationFn: async (params: { type: 'custom' | 'full-bio', chapterIds?: string[] }) => {
      const { data: subjects } = await supabase.from('subjects').select('id, name, slug');
      if (!subjects) throw new Error('No subjects found');

      if (params.type === 'full-bio') {
        // Full NEET Mock: 45 Phy + 45 Chem + 90 Bio, ordered Phy → Chem → Bio
        const subjectRequirements = [
          { name: 'Physics', count: 45 },
          { name: 'Chemistry', count: 45 },
          { name: 'Biology', count: 90 },
        ];

        const allQuestions: Question[] = [];

        for (const req of subjectRequirements) {
          const subject = subjects.find(s => s.name.toLowerCase() === req.name.toLowerCase());
          if (!subject) throw new Error(`${req.name} subject not found`);

          const { data: subjectQuestions } = await supabase
            .from('questions')
            .select('*')
            .eq('subject_id', subject.id);

          if (!subjectQuestions || subjectQuestions.length < req.count) {
            throw new Error(`Not enough ${req.name} questions. Found ${subjectQuestions?.length || 0}, need ${req.count}`);
          }

          // Fisher-Yates shuffle
          const shuffled = [...subjectQuestions];
          const randomValues = new Uint32Array(shuffled.length);
          crypto.getRandomValues(randomValues);
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = randomValues[i] % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          allQuestions.push(...(shuffled.slice(0, req.count) as Question[]));
        }

        // Questions are already in order: Physics(0-44), Chemistry(45-89), Biology(90-179)
        return allQuestions;
      } else {
        // Custom mock: 45 Phy + 45 Chem + 90 Bio from selected chapters, ordered Phy → Chem → Bio
        const { data: allChapters } = await supabase
          .from('chapters')
          .select('id, subject_id')
          .in('id', params.chapterIds || []);

        if (!allChapters || allChapters.length === 0) throw new Error('No valid chapters selected');

        const chaptersBySubject = new Map<string, string[]>();
        allChapters.forEach(ch => {
          const existing = chaptersBySubject.get(ch.subject_id) || [];
          existing.push(ch.id);
          chaptersBySubject.set(ch.subject_id, existing);
        });

        const subjectRequirements = [
          { name: 'Physics', count: 45 },
          { name: 'Chemistry', count: 45 },
          { name: 'Biology', count: 90 },
        ];

        const allQuestions: Question[] = [];

        for (const req of subjectRequirements) {
          const subject = subjects.find(s => s.name.toLowerCase() === req.name.toLowerCase());
          if (!subject) throw new Error(`${req.name} subject not found`);

          const selectedChapters = chaptersBySubject.get(subject.id) || [];
          if (selectedChapters.length === 0) {
            throw new Error(`No chapters selected for ${req.name}. Please select at least one chapter from each subject.`);
          }

          const { data: subjectQuestions } = await supabase
            .from('questions')
            .select('*')
            .in('chapter_id', selectedChapters);

          if (!subjectQuestions || subjectQuestions.length < req.count) {
            throw new Error(`Not enough ${req.name} questions. Found ${subjectQuestions?.length || 0}, need ${req.count}. Select more chapters.`);
          }

          const shuffled = [...subjectQuestions];
          const randomValues = new Uint32Array(shuffled.length);
          crypto.getRandomValues(randomValues);
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = randomValues[i] % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          allQuestions.push(...(shuffled.slice(0, req.count) as Question[]));
        }

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

  // Bio-only mock from selected chapters
  const fetchBioMockMutation = useMutation({
    mutationFn: async (chapterIds: string[]) => {
      const { data: bioQuestions } = await supabase
        .from('questions')
        .select('*')
        .in('chapter_id', chapterIds);

      if (!bioQuestions || bioQuestions.length < 90) {
        throw new Error(`Not enough Biology questions. Found ${bioQuestions?.length || 0}, need 90. Select more chapters.`);
      }

      const shuffled = [...bioQuestions];
      const randomValues = new Uint32Array(shuffled.length);
      crypto.getRandomValues(randomValues);
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomValues[i] % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      return shuffled.slice(0, 90) as Question[];
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

      let correctCount = 0;
      let wrongCount = 0;
      let unattemptedCount = 0;

      const subjectScores: Record<string, SubjectAnalytics> = {};
      const { data: subjects } = await supabase.from('subjects').select('*');
      const subjectMap = subjects?.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {} as Record<string, string>) || {};

      questions.forEach((q) => {
        const subjectName = subjectMap[q.subject_id] || 'Unknown';
        if (!subjectScores[subjectName]) {
          subjectScores[subjectName] = { subject: subjectName, correct: 0, wrong: 0, unattempted: 0, total: 0, score: 0, percentage: 0 };
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
      Object.values(subjectScores).forEach(s => {
        s.score = s.correct * 4 - s.wrong * 1;
        s.percentage = (s.score / (s.total * 4)) * 100;
      });

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
        const answerRecords = questions.map((q) => ({
          attempt_id: attempt.id,
          question_id: q.id,
          chosen_option_index: answers[q.id] ?? null,
          is_correct: answers[q.id] === q.correct_option_index,
        }));
        await supabase.from('attempt_answers').insert(answerRecords);
      }

      return { score, correctCount, wrongCount, unattemptedCount, subjectAnalytics: Object.values(subjectScores), answers };
    },
    onSuccess: (data) => {
      setResults(data);
      setTestAnswers(data.answers);
      setTestMode('results');
      toast.success('Test submitted successfully!');
    },
    onError: () => { toast.error('Failed to submit test'); },
  });

  const handleReset = () => {
    setTestMode('select');
    setTestType(null);
    setQuestions([]);
    setResults(null);
    setTestAnswers({});
  };

  const handleTestSubmit = (answers: Record<string, number | null>) => {
    setTestAnswers(answers);
    submitTestMutation.mutate(answers);
  };

  // Loading states
  if ((testType === 'full-bio' && fetchQuestionsMutation.isPending)) {
    return <LoadingQuestions totalQuestions={180} />;
  }

  if (testMode === 'custom-config') {
    return (
      <MockTestConfig
        open={true}
        onClose={handleReset}
        onStart={(chapterIds) => {
          setTestType('custom');
          fetchQuestionsMutation.mutate({ type: 'custom', chapterIds });
        }}
        loading={fetchQuestionsMutation.isPending}
      />
    );
  }

  if (testMode === 'bio-config') {
    return (
      <MockTestConfig
        open={true}
        onClose={handleReset}
        onStart={(chapterIds) => {
          setTestType('full-bio');
          fetchBioMockMutation.mutate(chapterIds);
        }}
        loading={fetchBioMockMutation.isPending}
        bioOnly={true}
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
        onReview={() => setTestMode('review')}
        questions={questions}
        answers={testAnswers}
      />
    );
  }

  const totalQuestions = questionCounts?.reduce((sum, q) => sum + q.count, 0) || 0;
  const bioCount = questionCounts?.find(q => q.subject.toLowerCase() === 'biology')?.count || 0;
  const phyCount = questionCounts?.find(q => q.subject.toLowerCase() === 'physics')?.count || 0;
  const chemCount = questionCounts?.find(q => q.subject.toLowerCase() === 'chemistry')?.count || 0;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Mock Tests</h1>
              <p className="text-muted-foreground">NEET pattern mock tests — Practice makes perfect</p>
            </div>
          </div>

          {/* Full NEET Mock (180Q) */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Atom className="h-6 w-6" />
                    Full NEET Mock Test
                  </h2>
                  <p className="text-white/90 text-lg font-semibold">
                    45 Physics + 45 Chemistry + 90 Biology
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm">3 Hours</span>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm">+4 / -1 Marking</span>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm">720 Marks</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-5xl font-black">180</p>
                  <p className="text-sm text-white/80">Questions</p>
                </div>
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                  <p className="text-xl font-bold text-foreground">45</p>
                  <p className="text-xs text-muted-foreground">Physics</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl">
                  <p className="text-xl font-bold text-foreground">45</p>
                  <p className="text-xs text-muted-foreground">Chemistry</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl">
                  <p className="text-xl font-bold text-foreground">90</p>
                  <p className="text-xs text-muted-foreground">Biology</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  className="h-12 text-base font-semibold"
                  onClick={() => {
                    setTestType('full-bio');
                    fetchQuestionsMutation.mutate({ type: 'full-bio' });
                  }}
                  disabled={fetchQuestionsMutation.isPending}
                >
                  {fetchQuestionsMutation.isPending ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...</>
                  ) : '🚀 Full Syllabus Mock'}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 text-base font-semibold"
                  onClick={() => setTestMode('custom-config')}
                >
                  <ListChecks className="mr-2 h-5 w-5" />
                  Select Chapters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Biology Only Mock (90Q) */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 text-white">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Dna className="h-6 w-6" />
                    Biology Mock Test
                  </h2>
                  <p className="text-white/90 text-lg font-semibold">
                    90 questions — Full Biology syllabus
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Botany + Zoology</span>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-sm">+4 / -1 Marking</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-5xl font-black">90</p>
                  <p className="text-sm text-white/80">Questions</p>
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              <Button
                variant="outline"
                className="w-full h-12 text-base font-semibold"
                onClick={() => setTestMode('bio-config')}
              >
                <Dna className="mr-2 h-5 w-5" />
                Select Biology Chapters & Start
              </Button>
            </CardContent>
          </Card>

          {/* Question Bank Stats */}
          {questionCounts && questionCounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Question Bank</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{totalQuestions}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{phyCount}</div>
                    <div className="text-xs text-muted-foreground">Physics</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{chemCount}</div>
                    <div className="text-xs text-muted-foreground">Chemistry</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{bioCount}</div>
                    <div className="text-xs text-muted-foreground">Biology</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Test;
