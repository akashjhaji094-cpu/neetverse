import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMathJax } from "@/hooks/useMathJax";
import { formatQuestionHtml, formatOptionHtml } from "@/lib/questionFormatter";
import { ExplanationBlock } from "@/components/ExplanationBlock";
import {
  ArrowLeft, CheckCircle2, Loader2, MinusCircle, Trophy, XCircle, RotateCcw,
} from "lucide-react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const SeriesResult = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState("summary");

  const { data, isLoading } = useQuery({
    queryKey: ["series-result", attemptId],
    queryFn: async () => {
      const { data: attempt, error } = await supabase
        .from("series_attempts").select("*, series_tests(*)").eq("id", attemptId).single();
      if (error) throw error;

      const { data: rows } = await supabase
        .from("series_test_questions")
        .select("position, questions(id, question_text, options, images, option_images, explanation, chapter_id, chapters(name), subjects(name))")
        .eq("test_id", attempt.test_id).order("position");
      const questions = (rows || []).map((r: any) => r.questions).filter(Boolean);

      const answers = (attempt.answers || {}) as Record<string, number>;
      const { data: graded } = await supabase.rpc("grade_questions", {
        p_question_ids: questions.map((q: any) => q.id),
        p_selected_options: questions.map((q: any) => answers[q.id] ?? -1),
        p_source: "questions",
      });

      const { data: leaderboard } = await supabase.rpc("get_series_test_leaderboard", {
        p_test_id: attempt.test_id,
      });

      return { attempt, questions, graded: graded || [], leaderboard: (leaderboard as any[]) || [] };
    },
    enabled: !!attemptId,
  });

  const { ref: mathRef } = useMathJax<HTMLDivElement>([data?.attempt?.id, tab]);

  const gradedById = useMemo(() => {
    const m = new Map<string, any>();
    (data?.graded || []).forEach((g: any) => m.set(g.question_id, g));
    return m;
  }, [data?.graded]);

  const chapterStats = useMemo(() => {
    if (!data) return [];
    const answers = (data.attempt.answers || {}) as Record<string, number>;
    const map = new Map<string, { name: string; total: number; correct: number; wrong: number }>();
    data.questions.forEach((q: any) => {
      const key = q.chapters?.name || "Other";
      const e = map.get(key) || { name: key, total: 0, correct: 0, wrong: 0 };
      e.total++;
      const chosen = answers[q.id];
      if (chosen !== undefined) {
        if (gradedById.get(q.id)?.is_correct) e.correct++; else e.wrong++;
      }
      map.set(key, e);
    });
    return [...map.values()].sort((a, b) =>
      (b.correct / Math.max(1, b.total)) - (a.correct / Math.max(1, a.total)));
  }, [data, gradedById]);

  if (isLoading || !data) {
    return (
      <DashboardLayout title="Result">
        <div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  const a = data.attempt;
  const test = a.series_tests;
  const maxScore = a.total_questions * (test?.marks_correct ?? 4);
  const accuracy = a.correct_count + a.wrong_count > 0
    ? Math.round((a.correct_count / (a.correct_count + a.wrong_count)) * 100) : 0;
  const myRank = data.leaderboard.findIndex((r: any) => r.userId === user?.id) + 1;
  const answers = (a.answers || {}) as Record<string, number>;

  return (
    <DashboardLayout title="Test Result">
      <div className="p-4 lg:p-6 space-y-5 max-w-4xl" ref={mathRef}>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/test-series")}>
          <ArrowLeft className="h-4 w-4" /> Test Series
        </Button>

        <Card className="bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm text-muted-foreground">{test?.title}</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">{a.score}</span>
              <span className="text-muted-foreground mb-1">/ {maxScore}</span>
              {myRank > 0 && (
                <Badge className="ml-auto gap-1"><Trophy className="h-3 w-3" /> Rank #{myRank}</Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center pt-2">
              <div><p className="text-xl font-bold text-emerald-600">{a.correct_count}</p><p className="text-xs text-muted-foreground">Correct</p></div>
              <div><p className="text-xl font-bold text-rose-600">{a.wrong_count}</p><p className="text-xs text-muted-foreground">Wrong</p></div>
              <div><p className="text-xl font-bold text-muted-foreground">{a.unattempted_count}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
            </div>
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs"><span>Accuracy</span><span>{accuracy}%</span></div>
              <Progress value={accuracy} />
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/test-series/${a.test_id}`)}>
              <RotateCcw className="h-3.5 w-3.5" /> Reattempt
            </Button>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="summary">Analysis</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="rank">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4 space-y-2">
            {chapterStats.map((c) => {
              const pct = Math.round((c.correct / Math.max(1, c.total)) * 100);
              return (
                <Card key={c.name}><CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">{c.correct}/{c.total}</span>
                  </div>
                  <Progress value={pct} />
                </CardContent></Card>
              );
            })}
          </TabsContent>

          <TabsContent value="review" className="mt-4 space-y-3">
            {data.questions.map((q: any, i: number) => {
              const g = gradedById.get(q.id);
              const chosen = answers[q.id];
              const state = chosen === undefined ? "skipped" : g?.is_correct ? "correct" : "wrong";
              return (
                <Card key={q.id}><CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Q{i + 1}</Badge>
                    {state === "correct" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {state === "wrong" && <XCircle className="h-4 w-4 text-rose-600" />}
                    {state === "skipped" && <MinusCircle className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{q.chapters?.name}</span>
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: formatQuestionHtml(q.question_text) }} />
                  <div className="space-y-1.5">
                    {(q.options as string[]).map((opt, oi) => {
                      const isCorrect = g?.correct_option_index === oi;
                      const isChosen = chosen === oi;
                      return (
                        <div key={oi} className={`rounded-lg border p-2.5 text-sm flex gap-2
                          ${isCorrect ? "border-emerald-500 bg-emerald-500/5"
                            : isChosen ? "border-rose-500 bg-rose-500/5" : ""}`}>
                          <span className="font-semibold">{LETTERS[oi]}.</span>
                          <span dangerouslySetInnerHTML={{ __html: formatOptionHtml(opt) }} />
                        </div>
                      );
                    })}
                  </div>
                  <ExplanationBlock questionId={q.id} />
                </CardContent></Card>
              );
            })}
          </TabsContent>

          <TabsContent value="rank" className="mt-4 space-y-2">
            {!data.leaderboard.length ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">
                Abhi koi aur result nahi aaya.
              </CardContent></Card>
            ) : data.leaderboard.map((r: any, i: number) => (
              <Card key={`${r.userId}-${i}`} className={r.userId === user?.id ? "border-primary" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="w-8 text-center font-bold">{i + 1}</span>
                  <span className="flex-1 font-medium">{r.name}</span>
                  <span className="text-sm text-muted-foreground">{r.correct}✓ {r.wrong}✗</span>
                  <Badge variant="secondary">{r.score}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SeriesResult;