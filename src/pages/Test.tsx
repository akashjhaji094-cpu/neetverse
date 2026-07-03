import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useMockLimits } from "@/hooks/useMockLimits";
import { tryCompleteReferral } from "@/hooks/useReferral";
import { TestInterface } from "@/components/practice/TestInterface";
import { MockTestConfig } from "@/components/mock/MockTestConfig";
import { MockTestAnalytics } from "@/components/mock/MockTestAnalytics";
import { LoadingQuestions } from "@/components/mock/LoadingQuestions";
import { QuestionReview } from "@/components/practice/QuestionReview";
import { AttemptModeSelector } from "@/components/mock/AttemptModeSelector";
import { OfflinePaperPreview } from "@/components/mock/OfflinePaperPreview";
import { PremiumPopup } from "@/components/PremiumPopup";
import { toast } from "sonner";
import { ListChecks, Loader2, GraduationCap, Dna, Atom, Crown, Monitor, FileText } from "lucide-react";
import { Question } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getChapterWeight, allocateWeighted, SubjectKey } from "@/data/neet2026Weights";
import { Link } from "react-router-dom";

interface SubjectAnalytics {
  subject: string;
  correct: number;
  wrong: number;
  unattempted: number;
  total: number;
  score: number;
  percentage: number;
}

type QStatus = 'wrong' | 'correct';

const cryptoShuffle = <X,>(arr: X[]): X[] => {
  const a = [...arr];
  const rv = new Uint32Array(a.length);
  crypto.getRandomValues(rv);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rv[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Fetch every question this user has EVER answered, once, in a single
 * round-trip. 'correct' always wins over 'wrong' (mirrors Revision.tsx's
 * "once you get it right, it's done — permanently" rule). Anything NOT
 * in this map is unseen.
 */
async function fetchUserQuestionHistory(userId: string): Promise<Map<string, QStatus>> {
  const { data: rows } = await supabase
    .from('attempt_answers')
    .select('question_id, is_correct, attempts!inner(user_id)')
    .eq('attempts.user_id', userId);

  const history = new Map<string, QStatus>();
  (rows || []).forEach((r: any) => {
    if (r.is_correct === true) {
      history.set(r.question_id, 'correct');
    } else if (r.is_correct === false && history.get(r.question_id) !== 'correct') {
      history.set(r.question_id, 'wrong');
    }
  });
  return history;
}

/**
 * Test Generator Randomization — priority order so the same questions
 * don't keep repeating across mocks:
 *   70% Unseen Questions   (never attempted before)
 *   20% Previously Wrong   (got it wrong before, and never later corrected)
 *   10% Revision Questions (answered correctly before — light reinforcement)
 *
 * If a bucket runs short (e.g. a brand-new user has zero "wrong" history,
 * or a small chapter has very few unseen questions left), the shortfall is
 * redistributed across whichever buckets still have spare questions, so the
 * chapter's total allocation (`want`) is always filled when the pool allows.
 * Guest/new users naturally fall back to ~100% unseen since their history
 * map is empty — no special-casing needed.
 */
function pickWithPriority(pool: Question[], want: number, history: Map<string, QStatus>): Question[] {
  if (want <= 0 || pool.length === 0) return [];

  const unseen: Question[] = [];
  const wrong: Question[] = [];
  const revision: Question[] = [];

  pool.forEach((q) => {
    const status = history.get(q.id);
    if (status === 'wrong') wrong.push(q);
    else if (status === 'correct') revision.push(q);
    else unseen.push(q);
  });

  const wantUnseen = Math.round(want * 0.7);
  const wantWrong = Math.round(want * 0.2);
  const wantRevision = Math.max(0, want - wantUnseen - wantWrong);

  const picked: Question[] = [];
  const take = (arr: Question[], n: number) => cryptoShuffle(arr).slice(0, Math.max(0, n));

  const gotUnseen = take(unseen, wantUnseen);
  picked.push(...gotUnseen);
  let shortfall = wantUnseen - gotUnseen.length;

  const gotWrong = take(wrong, wantWrong);
  picked.push(...gotWrong);
  shortfall += wantWrong - gotWrong.length;

  const gotRevision = take(revision, wantRevision);
  picked.push(...gotRevision);
  shortfall += wantRevision - gotRevision.length;

  if (shortfall > 0) {
    const usedIds = new Set(picked.map((q) => q.id));
    for (const leftoverPool of [unseen, wrong, revision]) {
      if (shortfall <= 0) break;
      const leftover = leftoverPool.filter((q) => !usedIds.has(q.id));
      const extra = take(leftover, shortfall);
      picked.push(...extra);
      extra.forEach((q) => usedIds.add(q.id));
      shortfall -= extra.length;
    }
  }

  return cryptoShuffle(picked).slice(0, want);
}

const Test = () => {
  const { user } = useAuth();
  const { limits, refetch: refetchLimits } = useMockLimits();
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [testMode, setTestMode] = useState<'select' | 'custom-config' | 'bio-config' | 'choose-mode' | 'offline-preview' | 'testing' | 'results' | 'review'>('select');
  const [testType, setTestType] = useState<'custom' | 'full-bio' | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[] | 'all'>('all');
  const [testAnswers, setTestAnswers] = useState<Record<string, number | null>>({});
  // The attempts.id row created when an offline paper is generated — passed
  // into OfflinePaperPreview so a later scan can be persisted (score,
  // attempt_answers, omr_status) instead of being lost on page refresh.
  const [offlineAttemptId, setOfflineAttemptId] = useState<string | null>(null);
  const [results, setResults] = useState<{
    score: number;
    correctCount: number;
    wrongCount: number;
    unattemptedCount: number;
    subjectAnalytics: SubjectAnalytics[];
    attemptId: string | null;
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

      const subjectRequirements = [
        { name: 'Physics', count: 45 },
        { name: 'Chemistry', count: 45 },
        { name: 'Biology', count: 90 },
      ];

      let chaptersBySubject = new Map<string, { id: string; name: string }[]>();
      if (params.type === 'custom') {
        const { data: allChapters } = await supabase
          .from('chapters')
          .select('id, name, subject_id')
          .in('id', params.chapterIds || []);
        if (!allChapters || allChapters.length === 0) throw new Error('No valid chapters selected');
        allChapters.forEach(ch => {
          const arr = chaptersBySubject.get(ch.subject_id) || [];
          arr.push({ id: ch.id, name: ch.name });
          chaptersBySubject.set(ch.subject_id, arr);
        });
      } else {
        const { data: allChapters } = await supabase.from('chapters').select('id, name, subject_id');
        (allChapters || []).forEach(ch => {
          const arr = chaptersBySubject.get(ch.subject_id) || [];
          arr.push({ id: ch.id, name: ch.name });
          chaptersBySubject.set(ch.subject_id, arr);
        });
      }

      // Fetch the user's question history ONCE, in parallel with the
      // per-subject question fetches below — doesn't add extra wait time.
      const historyPromise = user ? fetchUserQuestionHistory(user.id) : Promise.resolve(new Map<string, QStatus>());

      const allQuestions: Question[] = [];

      const subjectFetches = subjectRequirements.map(async (req) => {
        const subject = subjects.find(s => s.name.toLowerCase() === req.name.toLowerCase());
        if (!subject) throw new Error(`${req.name} subject not found`);
        const subjChapters = chaptersBySubject.get(subject.id) || [];
        if (subjChapters.length === 0) throw new Error(`No chapters selected for ${req.name}.`);
        const subjKey = subject.slug.toLowerCase() as SubjectKey;

        const { data: subjQuestions } = await supabase
          .from('questions')
          .select('id, chapter_id, subject_id, question_text, options, correct_option_index, explanation, images, difficulty')
          .in('chapter_id', subjChapters.map(c => c.id))
          .limit(50000);
        return { req, subject, subjChapters, subjKey, subjQuestions };
      });

      const [questionHistory, ...fetched] = await Promise.all([historyPromise, ...subjectFetches]);

      for (const { req, subjChapters, subjKey, subjQuestions } of fetched) {

        if (!subjQuestions || subjQuestions.length < req.count) {
          throw new Error(`Not enough ${req.name} questions. Found ${subjQuestions?.length || 0}, need ${req.count}. Select more chapters.`);
        }

        const byChapter = new Map<string, Question[]>();
        (subjQuestions as Question[]).forEach(q => {
          const arr = byChapter.get(q.chapter_id) || [];
          arr.push(q);
          byChapter.set(q.chapter_id, arr);
        });

        const allWeighted = subjChapters.map(c => ({
          id: c.id,
          weight: getChapterWeight(subjKey, c.name),
          available: (byChapter.get(c.id) || []).length,
        }));

        const idealAlloc = allocateWeighted(
          allWeighted,
          req.count,
          { minPerChapter: 1 }
        );

    // Allocator already respects capacity & redistributes deficit fairly
        // by chapter weight. Within each chapter, pickWithPriority now also
        // respects the user's 70/20/10 unseen/wrong/revision priority.
        const picked: Question[] = [];
        for (const c of allWeighted) {
          const want = idealAlloc[c.id] || 0;
          if (want <= 0) continue;
          const pool = byChapter.get(c.id) || [];
          if (pool.length === 0) continue;
          picked.push(...pickWithPriority(pool, want, questionHistory));
        }

        // Final shuffle so chapter blocks aren't contiguous within subject
        allQuestions.push(...cryptoShuffle(picked).slice(0, req.count));
      }

      return allQuestions;
    },
    onSuccess: (data) => {
      setQuestions(data);
      setTestMode('choose-mode');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to fetch questions');
    },
  });

  // Bio-only mock from selected chapters
  const fetchBioMockMutation = useMutation({
    mutationFn: async (chapterIds: string[]) => {
      const { data: chapters } = await supabase
        .from('chapters')
        .select('id, name')
        .in('id', chapterIds);
      if (!chapters || chapters.length === 0) throw new Error('No chapters selected');

      const historyPromise = user ? fetchUserQuestionHistory(user.id) : Promise.resolve(new Map<string, QStatus>());

      const bioQuestionsPromise = supabase
        .from('questions')
        .select('id, chapter_id, subject_id, question_text, options, correct_option_index, explanation, images, difficulty')
        .in('chapter_id', chapterIds)
        .limit(50000);

      const [questionHistory, { data: bioQuestions }] = await Promise.all([historyPromise, bioQuestionsPromise]);

      if (!bioQuestions || bioQuestions.length < 90) {
        throw new Error(`Not enough Biology questions. Found ${bioQuestions?.length || 0}, need 90. Select more chapters.`);
      }

      const byChapter = new Map<string, Question[]>();
      (bioQuestions as Question[]).forEach(q => {
        const arr = byChapter.get(q.chapter_id) || [];
        arr.push(q);
        byChapter.set(q.chapter_id, arr);
      });

      const allWeighted = chapters.map(c => ({
        id: c.id,
        weight: getChapterWeight('biology', c.name),
        available: (byChapter.get(c.id) || []).length,
      }));

      const idealAlloc = allocateWeighted(allWeighted, 90, { minPerChapter: 1 });

      const picked: Question[] = [];
      for (const c of allWeighted) {
        const want = idealAlloc[c.id] || 0;
        if (want <= 0) continue;
        const pool = byChapter.get(c.id) || [];
        if (pool.length === 0) continue;
        picked.push(...pickWithPriority(pool, want, questionHistory));
      }

      return cryptoShuffle(picked).slice(0, 90);
    },
    onSuccess: (data) => {
      setQuestions(data);
      setTestMode('choose-mode');
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
          // mode: 'online' is what useMockLimits() reads to count this
          // against the weekly ONLINE mock quota.
          config: { type: testType, questionCount: questions.length, mode: 'online' } as any,
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

      return { score, correctCount, wrongCount, unattemptedCount, subjectAnalytics: Object.values(subjectScores), answers, attemptId: attempt?.id ?? null };
    },
    onSuccess: (data) => {
      setResults(data);
      setTestAnswers(data.answers);
      setTestMode('results');
      toast.success('Test submitted successfully!');
      if (user) tryCompleteReferral(user.id);
      refetchLimits();
    },
    onError: () => { toast.error('Failed to submit test'); },
  });

  const handleReset = () => {
    setTestMode('select');
    setTestType(null);
    setQuestions([]);
    setResults(null);
    setTestAnswers({});
    setOfflineAttemptId(null);
  };

  const handleTestSubmit = (answers: Record<string, number | null>) => {
    setTestAnswers(answers);
    submitTestMutation.mutate(answers);
  };

  const handleChooseOnline = () => {
  if (limits && !limits.canTakeOnline) {
  setShowPremiumPopup(true);
  return;
          }
    setTestMode('testing');
  };

  const handleChooseOffline = async () => {
    if (limits && !limits.canTakeOffline) {
  setShowPremiumPopup(true);
  return;
          }
    if (user) {
      // Store the EXACT question set so this paper can be re-opened and
      // scored correctly later from the Pending OMR Vault, even days after
      // it was generated — without this, that information would be lost
      // the moment this browser tab closes.
      const { data: inserted } = await supabase
        .from('attempts')
        .insert([{
          user_id: user.id,
          type: 'mock' as const,
          config: { type: testType, questionCount: questions.length, mode: 'offline' } as any,
          question_ids: questions.map((q) => q.id),
          omr_status: 'pending',
        } as any])
        .select()
        .single();
      if (inserted) setOfflineAttemptId(inserted.id);
      tryCompleteReferral(user.id);
      refetchLimits();
    }
    setTestMode('offline-preview');
  };

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
          setSelectedChapterIds(chapterIds);
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
          setSelectedChapterIds(chapterIds);
          fetchBioMockMutation.mutate(chapterIds);
        }}
        loading={fetchBioMockMutation.isPending}
        bioOnly={true}
      />
    );
  }

  if (testMode === 'choose-mode' && questions.length > 0) {
    const isBioOnly = testType === 'full-bio' && questions.length === 90;
    const testLabel = isBioOnly ? 'Biology Mock Test' : 'Full NEET Mock Test';
    const totalQ = questions.length;

    return (
      <AttemptModeSelector
        totalQuestions={totalQ}
        testLabel={testLabel}
        onOnline={handleChooseOnline}
        onOffline={handleChooseOffline}
        onBack={handleReset}
      />
    );
  }

  if (testMode === 'offline-preview' && questions.length > 0) {
    const isBioOnly = testType === 'full-bio' && questions.length === 90;
    const testLabel = isBioOnly ? 'Biology Mock Test' : 'Full NEET Mock Test';
    const totalQ = questions.length;
    const totalMarks = totalQ * 4;
    const dur = isBioOnly ? '60 Minutes' : '3 Hours';

    let subjectGroups: { name: string; startIdx: number; endIdx: number }[];
    if (isBioOnly) {
      subjectGroups = [{ name: 'Biology', startIdx: 0, endIdx: 90 }];
    } else {
      subjectGroups = [
        { name: 'Physics', startIdx: 0, endIdx: 45 },
        { name: 'Chemistry', startIdx: 45, endIdx: 90 },
        { name: 'Biology', startIdx: 90, endIdx: 180 },
      ];
    }

    return (
      <OfflinePaperPreview
        questions={questions}
        title={testLabel}
        totalQuestions={totalQ}
        totalMarks={totalMarks}
        duration={dur}
        subjectGroups={subjectGroups}
        selectedChapterIds={selectedChapterIds}
        attemptId={offlineAttemptId || undefined}
        onBack={() => setTestMode('choose-mode')}
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
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Mock Tests</h1>
              <p className="text-muted-foreground">NEET pattern mock tests — Practice makes perfect</p>
            </div>
          </div>

          {limits && user && (
            <Card className="border-primary/15">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-primary" />
                      <span className="text-sm">
                        <span className="font-semibold">{limits.onlineUsed}</span>
                        <span className="text-muted-foreground">
                          /{limits.onlineLimit === Infinity ? '∞' : limits.onlineLimit} online this week
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-secondary" />
                      <span className="text-sm">
                        <span className="font-semibold">{limits.offlineUsed}</span>
                        <span className="text-muted-foreground">/{limits.offlineLimit} offline this week</span>
                      </span>
                    </div>
                  </div>
                  {limits.plan === 'free' && (
                    <Link to="/account">
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Crown className="h-3.5 w-3.5 text-warning" />
                        Upgrade for more
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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
                    setSelectedChapterIds('all');
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

      <PremiumPopup
  open={showPremiumPopup}
  onClose={() => setShowPremiumPopup(false)}
/>
    </DashboardLayout>
  );
};

export default Test;
