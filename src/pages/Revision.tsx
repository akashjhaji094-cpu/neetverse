import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase, Question } from "@/lib/supabase";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { TestInterface } from "@/components/practice/TestInterface";
import { TestResults } from "@/components/practice/TestResults";
import { QuestionReview } from "@/components/practice/QuestionReview";
import { LoadingQuestions } from "@/components/mock/LoadingQuestions";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RotateCcw, XCircle, MinusCircle, Sparkles } from "lucide-react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FeatureLockCard } from "@/components/FeatureLockCard";
import { FeatureLockedPopup } from "@/components/FeatureLockedPopup";

const Revision = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const access = useFeatureAccess();
  const [showLockPopup, setShowLockPopup] = useState(false);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [showTest, setShowTest] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, number | null>>({});
  const [showReview, setShowReview] = useState(false);

  const { data: pendingIds, isLoading } = useQuery({
    queryKey: ["revision-pending", user?.id],
    queryFn: async () => {
      if (!user) return { wrong: [], unattempted: [] };
      const { data: rows } = await supabase
        .from("attempt_answers")
        .select("question_id, is_correct, attempt_id, attempts!inner(user_id)")
        .eq("attempts.user_id", user.id);

      const correct = new Set<string>();
      const wrong = new Set<string>();
      const unattempted = new Set<string>();
      (rows || []).forEach((r: any) => {
        if (r.is_correct === true) correct.add(r.question_id);
        else if (r.is_correct === false) wrong.add(r.question_id);
        else unattempted.add(r.question_id);
      });
      correct.forEach((id) => { wrong.delete(id); unattempted.delete(id); });
      return { wrong: Array.from(wrong), unattempted: Array.from(unattempted) };
    },
    enabled: !!user,
  });

  const startMutation = useMutation({
    mutationFn: async (mode: "wrong" | "unattempted" | "both") => {
      const ids =
        mode === "wrong" ? pendingIds?.wrong || [] :
        mode === "unattempted" ? pendingIds?.unattempted || [] :
        [...(pendingIds?.wrong || []), ...(pendingIds?.unattempted || [])];
      if (ids.length === 0) throw new Error("No questions to revise");
      const all: Question[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase
          .from("questions").select("*").in("id", ids.slice(i, i + 200));
        if (error) throw error;
        all.push(...((data || []) as Question[]));
      }
      const arr = [...all];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      await new Promise((r) => setTimeout(r, 800));
      return arr.slice(0, Math.min(arr.length, 90));
    },
    onSuccess: (qs) => { setTestQuestions(qs); setShowTest(true); },
    onError: (e: any) => toast({ title: "Cannot start", description: e.message, variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async ({ answers }: { answers: Record<string, number | null> }) => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error("Not authenticated");
      const { data: attempt, error } = await supabase
        .from("attempts")
        .insert({ user_id: u.id, type: "practice", config: { mode: "revision", question_count: testQuestions.length } })
        .select().single();
      if (error) throw error;
      let correctCount = 0, wrongCount = 0, unattemptedCount = 0;
      const inserts = testQuestions.map((q) => {
        const ci = answers[q.id];
        const ok = ci !== undefined && ci !== null ? ci === q.correct_option_index : null;
        if (ok === true) correctCount++; else if (ok === false) wrongCount++; else unattemptedCount++;
        return { attempt_id: attempt.id, question_id: q.id, chosen_option_index: ci ?? null, is_correct: ok };
      });
      await supabase.from("attempt_answers").insert(inserts);
      const score = correctCount * 4 - wrongCount;
      await supabase.from("attempts").update({
        finished_at: new Date().toISOString(), score,
        details: { correctCount, wrongCount, unattemptedCount, mode: "revision" },
      }).eq("id", attempt.id);
      return { score, correctCount, wrongCount, unattemptedCount, answers };
    },
    onSuccess: (r) => { setTestResults(r); setTestAnswers(r.answers); setShowTest(false); },
    onError: () => toast({ title: "Error", description: "Failed to submit.", variant: "destructive" }),
  });

  // Gate check moved here — AFTER every hook above, so hook count/order never changes.
  if (!access.isLoading && !access.hasAccess) {
    return (
      <DashboardLayout>
        <FeatureLockCard
          featureName="Revision"
          description="Auto-generated sessions from only your wrong and unattempted questions — the fastest way to close gaps before NEET."
          onMount={() => setShowLockPopup(true)}
        />
        <FeatureLockedPopup open={showLockPopup} onClose={() => setShowLockPopup(false)} featureName="Revision" />
      </DashboardLayout>
    );
  }

  if (startMutation.isPending) return <LoadingQuestions totalQuestions={testQuestions.length || 50} />;
  if (showReview && testQuestions.length > 0)
    return <QuestionReview questions={testQuestions} answers={testAnswers} onClose={() => setShowReview(false)} />;
  if (testResults)
    return (
      <TestResults
        score={testResults.score}
        totalQuestions={testQuestions.length}
        correctCount={testResults.correctCount}
        wrongCount={testResults.wrongCount}
        unattemptedCount={testResults.unattemptedCount}
        onClose={() => { setTestResults(null); setTestQuestions([]); setTestAnswers({}); setShowReview(false); }}
        onReview={() => setShowReview(true)}
      />
    );
  if (showTest) return <TestInterface questions={testQuestions} onSubmit={(a) => submitMutation.mutate({ answers: a })} />;

  const wrongCount = pendingIds?.wrong.length || 0;
  const unattCount = pendingIds?.unattempted.length || 0;
  const totalPending = wrongCount + unattCount;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
        <Card className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary tracking-wider uppercase">Smart Revision</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold">
              Practice Your <span className="text-primary italic">Weak Spots</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sirf wrong + unattempted questions. Sahi hote hi list se hat jayenge — permanently.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 text-center">
              <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <div className="text-3xl font-bold">{wrongCount}</div>
              <p className="text-xs text-muted-foreground">Wrong Questions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <MinusCircle className="h-8 w-8 mx-auto mb-2 text-gray-500" />
              <div className="text-3xl font-bold">{unattCount}</div>
              <p className="text-xs text-muted-foreground">Unattempted</p>
            </CardContent>
          </Card>
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-5 text-center">
              <RotateCcw className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-3xl font-bold text-primary">{totalPending}</div>
              <p className="text-xs text-muted-foreground">Total Pending</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Start Revision Session</h3>
                <p className="text-xs text-muted-foreground">Up to 90 questions per session, randomized</p>
              </div>
              <Badge variant="secondary">+4 / -1</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button variant="outline" disabled={isLoading || wrongCount === 0} onClick={() => startMutation.mutate("wrong")}>
                Wrong Only ({wrongCount})
              </Button>
              <Button variant="outline" disabled={isLoading || unattCount === 0} onClick={() => startMutation.mutate("unattempted")}>
                Unattempted ({unattCount})
              </Button>
              <Button disabled={isLoading || totalPending === 0} onClick={() => startMutation.mutate("both")}>
                Both ({totalPending})
              </Button>
            </div>
            {totalPending === 0 && !isLoading && (
              <p className="text-center text-sm text-muted-foreground py-4">
                🎉 Sab clean hai! Jaakar Practice ya Mock test do.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Revision;
