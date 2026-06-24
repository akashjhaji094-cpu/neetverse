import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { neetPlanner as neetSubjects } from "@/data/neetPlanner";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TestConfig } from "@/components/practice/TestConfig";
import { TestInterface } from "@/components/practice/TestInterface";
import { TestResults } from "@/components/practice/TestResults";
import { QuestionReview } from "@/components/practice/QuestionReview";
import { PracticeLoading } from "@/components/practice/PracticeLoading";
import { Question } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Zap, CheckCircle, ChevronRight, Dna, Atom, FlaskConical, Sparkles, Loader2 } from "lucide-react";

const subjectConfig: Record<string, { 
  icon: React.ElementType; 
  gradient: string; 
  badge: string;
  tagline: string;
}> = {
  physics: { 
    icon: Atom, 
    gradient: "from-blue-600 via-blue-700 to-indigo-800", 
    badge: "CORE",
    tagline: "Mechanics, Optics, Modern Physics"
  },
  chemistry: { 
    icon: FlaskConical, 
    gradient: "from-emerald-600 via-teal-700 to-cyan-800", 
    badge: "CURATED",
    tagline: "Physical, Organic, Inorganic Chemistry"
  },
  biology: { 
    icon: Dna, 
    gradient: "from-green-600 via-emerald-700 to-teal-800", 
    badge: "CURATED",
    tagline: "Botany, Zoology, Human Physiology"
  },
};

const Practice = () => {
  const { toast } = useToast();
  const [selectedChapter, setSelectedChapter] = useState<{ id: string; name: string; subjectId: string; subjectSlug: string; chapterSlug: string } | null>(null);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [showTest, setShowTest] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, number | null>>({});
  const [showReview, setShowReview] = useState(false);

  const [questionCounts, setQuestionCounts] = useState<Record<string, number> | null>(null);
  const [libTotal, setLibTotal] = useState(0);
  const [libFetched, setLibFetched] = useState(0);

  // FIXED: previously handleChapterClick re-fetched subject/chapter IDs by
  // slug with TWO separate network round-trips on EVERY single chapter
  // click. That data is already fetched right here in this same effect —
  // we just discarded the id-by-slug maps afterwards. Now we keep them in
  // state so a chapter click resolves instantly, with zero network calls.
  const [slugMaps, setSlugMaps] = useState<{
    subjectIdBySlug: Map<string, string>;
    chapterIdBySlug: Map<string, string>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [countsRes, subjectsRes, chaptersRes] = await Promise.all([
        supabase.rpc('get_question_counts_per_chapter'),
        supabase.from('subjects').select('id, slug'),
        supabase.from('chapters').select('id, slug, subject_id'),
      ]);
      if (cancelled) return;

      const subjSlug = new Map((subjectsRes.data || []).map(s => [s.id, s.slug] as const));
      const chapSlug = new Map((chaptersRes.data || []).map(c => [c.id, c.slug] as const));
      const chapSubj = new Map((chaptersRes.data || []).map(c => [c.id, c.subject_id] as const));

      const tally: Record<string, number> = {};
      let total = 0;
      for (const row of (countsRes.data || []) as { chapter_id: string; total: number }[]) {
        const subjId = chapSubj.get(row.chapter_id);
        const ss = subjId ? subjSlug.get(subjId) : undefined;
        const cs = chapSlug.get(row.chapter_id);
        const n = Number(row.total) || 0;
        total += n;
        if (ss && cs) tally[`${ss}-${cs}`] = n;
      }
      if (cancelled) return;

      // Build the reverse maps (slug -> id) once, reused for every chapter click
      const subjectIdBySlug = new Map((subjectsRes.data || []).map(s => [s.slug, s.id] as const));
      const chapterIdBySlug = new Map((chaptersRes.data || []).map(c => [c.slug, c.id] as const));

      setLibTotal(total);
      setLibFetched(total);
      setQuestionCounts(tally);
      setSlugMaps({ subjectIdBySlug, chapterIdBySlug });
    })();
    return () => { cancelled = true; };
  }, []);

  const countsLoading = !questionCounts;

  const startTestMutation = useMutation({
    mutationFn: async ({ chapterId, subjectId, count }: { chapterId: string; subjectId: string; count: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: allQuestions, error } = await supabase
        .from('questions')
        .select('id, chapter_id, subject_id, question_text, options, correct_option_index, explanation, images, difficulty')
        .eq('chapter_id', chapterId)
        .eq('subject_id', subjectId)
        .limit(50000);
      if (error) throw error;
      if (!allQuestions || allQuestions.length === 0) throw new Error('No questions available');

      let pool = allQuestions;
      if (user) {
        const { data: correctAnswers } = await supabase
          .from('attempt_answers')
          .select('question_id, attempts!inner(user_id)')
          .eq('is_correct', true)
          .eq('attempts.user_id', user.id);
        const correctIds = new Set((correctAnswers || []).map((a: any) => a.question_id));
        const fresh = allQuestions.filter(q => !correctIds.has(q.id));
        if (fresh.length >= count) pool = fresh;
      }

      const shuffled = [...pool];
      const randomValues = new Uint32Array(shuffled.length);
      crypto.getRandomValues(randomValues);
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomValues[i] % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, count) as Question[];
    },
    onSuccess: (questions) => { setTestQuestions(questions); setShowTest(true); setSelectedChapter(null); },
    onError: () => { toast({ title: "Error", description: "Failed to load questions.", variant: "destructive" }); }
  });

  const submitTestMutation = useMutation({
    mutationFn: async ({ answers }: { answers: Record<string, number | null> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: attempt, error: attemptError } = await supabase.from('attempts').insert({ user_id: user.id, type: 'practice', config: { question_count: testQuestions.length } }).select().single();
      if (attemptError) throw attemptError;
      let correctCount = 0, wrongCount = 0, unattemptedCount = 0;
      const answerInserts = testQuestions.map(question => {
        const chosenIndex = answers[question.id];
        const isCorrect = chosenIndex !== undefined && chosenIndex !== null ? chosenIndex === question.correct_option_index : null;
        if (isCorrect === true) correctCount++;
        else if (isCorrect === false) wrongCount++;
        else unattemptedCount++;
        return { attempt_id: attempt.id, question_id: question.id, chosen_option_index: chosenIndex ?? null, is_correct: isCorrect };
      });
      await supabase.from('attempt_answers').insert(answerInserts);
      const score = (correctCount * 4) - wrongCount;
      await supabase.from('attempts').update({ finished_at: new Date().toISOString(), score, details: { correctCount, wrongCount, unattemptedCount } }).eq('id', attempt.id);
      return { score, correctCount, wrongCount, unattemptedCount, answers };
    },
    onSuccess: (results) => { setTestResults(results); setTestAnswers(results.answers); setShowTest(false); },
    onError: () => { toast({ title: "Error", description: "Failed to submit test.", variant: "destructive" }); }
  });

  const handleChapterClick = (chapter: { id: string; name: string }, subjectSlug: string) => {
    if (!slugMaps) return;
    const subjectId = slugMaps.subjectIdBySlug.get(subjectSlug);
    const chapterId = slugMaps.chapterIdBySlug.get(chapter.id);
    if (subjectId && chapterId) {
      setSelectedChapter({ id: chapterId, name: chapter.name, subjectId, subjectSlug, chapterSlug: chapter.id });
    } else {
      // Defensive — only happens if the static chapter list and the live DB
      // have drifted out of sync (e.g. a chapter was renamed in the admin
      // panel). Previously this failed completely silently.
      toast({ title: "Couldn't open this chapter", description: "Please refresh the page and try again.", variant: "destructive" });
    }
  };

  const handleStartTest = (count: number) => {
    if (selectedChapter) startTestMutation.mutate({ chapterId: selectedChapter.id, subjectId: selectedChapter.subjectId, count });
  };

  const handleSubmitTest = (answers: Record<string, number | null>) => submitTestMutation.mutate({ answers });

  const handleCloseResults = () => { setTestResults(null); setTestQuestions([]); setTestAnswers({}); setShowReview(false); };
  const handleReview = () => setShowReview(true);

  if (startTestMutation.isPending) {
    const variables = startTestMutation.variables as { count?: number } | undefined;
    return (
      <PracticeLoading
        totalQuestions={variables?.count || 30}
        chapterName={selectedChapter?.name}
      />
    );
  }

  if (countsLoading) {
    return (
      <PracticeLoading
        totalQuestions={libTotal || 1}
        fetched={libFetched}
        title="Loading Practice Library"
        chapterName="Indexing questions across all chapters…"
      />
    );
  }
  if (showReview && testQuestions.length > 0) return <QuestionReview questions={testQuestions} answers={testAnswers} onClose={() => setShowReview(false)} />;
  if (testResults) return <TestResults score={testResults.score} totalQuestions={testQuestions.length} correctCount={testResults.correctCount} wrongCount={testResults.wrongCount} unattemptedCount={testResults.unattemptedCount} onClose={handleCloseResults} onReview={handleReview} />;
  if (showTest) return <TestInterface questions={testQuestions} onSubmit={handleSubmitTest} />;

  const totalQuestions = questionCounts ? Object.values(questionCounts).reduce((sum, c) => sum + c, 0) : 0;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-primary tracking-wider uppercase">Exam Readiness</span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">
                  Master Your <span className="text-primary italic">Practice</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Targeted questions curated for top results.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <div className="text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xl font-bold">{totalQuestions > 1000 ? `${Math.floor(totalQuestions / 1000)}K+` : totalQuestions}+</p>
                  <p className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">Questions</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-xl font-bold">100%</p>
                  <p className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">Explanations</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-base font-semibold mb-1">Select Subject</h2>
          <p className="text-xs text-muted-foreground mb-4">Specialized sessions</p>
        </div>

        <div className="space-y-4">
          {neetSubjects.map((subject) => {
            const config = subjectConfig[subject.id] || subjectConfig.biology;
            const Icon = config.icon;
            
            return (
              <Card 
                key={subject.id} 
                className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all hover:-translate-y-0.5"
                onClick={() => {/* Could expand subject */}}
              >
                <div className={`bg-gradient-to-r ${config.gradient} p-5 text-white relative overflow-hidden`}>
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-2 left-10 text-6xl font-bold uppercase tracking-widest opacity-20">{subject.name}</div>
                  </div>
                  
                  <div className="relative flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-5 w-5" />
                        <Badge className="bg-white/20 text-white border-0 text-[10px] tracking-wider uppercase">{config.badge}</Badge>
                      </div>
                      <h3 className="text-xl font-bold">{subject.name}</h3>
                      <p className="text-sm text-white/70 mt-0.5">{config.tagline}</p>
                    </div>
                    <ChevronRight className="h-6 w-6 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </div>

                <CardContent className="p-3 space-y-0.5 max-h-[350px] overflow-y-auto">
                  {subject.chapters.map((chapter) => {
                    const count = questionCounts?.[`${subject.id}-${chapter.id}`] || 0;
                    return (
                      <Button
                        key={chapter.id}
                        variant="ghost"
                        className="w-full justify-between text-left text-sm h-auto py-2.5 px-3 hover:bg-muted/80 rounded-lg"
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleChapterClick(chapter, subject.id); }}
                        disabled={count === 0}
                      >
                        <span className="truncate mr-2 text-foreground">{chapter.name}</span>
                        <Badge 
                          variant={count > 0 ? "default" : "secondary"} 
                          className={count > 0 ? "bg-primary/10 text-primary hover:bg-primary/15 border-0 text-xs" : "text-xs"}
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
