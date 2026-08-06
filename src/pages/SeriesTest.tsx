import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMathJax } from "@/hooks/useMathJax";
import { formatQuestionHtml, formatOptionHtml } from "@/lib/questionFormatter";
import { Clock, Loader2, ChevronLeft, ChevronRight, Send, Flag } from "lucide-react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const SeriesTest = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const forceNew = searchParams.get("reattempt") === "true";

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const submittedRef = useRef(false);

  // NEW: this attempt row is created the moment the student JOINS the test
  // (not at submit time anymore). That join insert is what the DB-side
  // trigger checks against start_at/end_at/assignment for restricted tests.
  const attemptIdRef = useRef<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const {
    data: existingAttempt,
    isLoading: checkingExisting,
  } = useQuery({
    queryKey: ["series-existing-attempt", testId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("series_attempts")
        .select("id, finished_at")
        .eq("test_id", testId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!testId && !!user && !forceNew,
  });

  useEffect(() => {
    // Only redirect away if that prior attempt was actually finished.
    // An unfinished attempt means they joined but the tab closed etc —
    // let them continue instead of losing their join.
    if (existingAttempt && existingAttempt.finished_at && !forceNew) {
      navigate(`/test-series/result/${existingAttempt.id}`, { replace: true });
    } else if (existingAttempt && !existingAttempt.finished_at && !forceNew) {
      attemptIdRef.current = existingAttempt.id;
    }
  }, [existingAttempt, forceNew, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["series-test-play", testId],
    queryFn: async () => {
      const { data: test, error } = await supabase.from("series_tests").select("*").eq("id", testId).single();
      if (error) throw error;
      const { data: rows, error: qErr } = await supabase
        .from("series_test_questions")
        .select("position, questions(id, question_text, options, images, option_images, chapter_id, subject_id)")
        .eq("test_id", testId).order("position");
      if (qErr) throw qErr;
      const questions = (rows || []).map((r: any) => r.questions).filter(Boolean);
      return { test, questions };
    },
    enabled: !!testId && (forceNew || (!checkingExisting && !(existingAttempt && existingAttempt.finished_at))),
  });

  // Join the test (create the attempt row) once questions are loaded and we
  // don't already have an attempt id from a resumed session.
  useEffect(() => {
    const join = async () => {
      if (!data?.test || !user || attemptIdRef.current) return;
      setJoining(true);
      const { data: row, error } = await supabase.from("series_attempts").insert({
        test_id: data.test.id,
        user_id: user.id,
        total_questions: data.questions.length,
      }).select("id").single();
      setJoining(false);
      if (error) {
        setJoinError(error.message);
        return;
      }
      attemptIdRef.current = row.id;
    };
    if (data?.test && data.questions.length) join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.test, data?.questions?.length, user]);

  useEffect(() => {
    if (!data?.test) return;
    setSecondsLeft(data.test.duration_minutes * 60);
  }, [data?.test]);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) { handleSubmit(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const questions = data?.questions || [];
  const current: any = questions[index];
  const { ref: containerRef } = useMathJax<HTMLDivElement>([current?.id]);

  const answeredCount = Object.keys(answers).length;

  const clock = useMemo(() => {
    if (secondsLeft === null) return "--:--";
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;
    return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [secondsLeft]);

  const handleSubmit = async (auto = false) => {
    if (submittedRef.current || !data?.test || !user) return;
    if (!attemptIdRef.current) { toast.error("Test join nahi hua tha, dobara try karo"); return; }
    if (!auto && !confirm("Test submit kar dein?")) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const ids = questions.map((q: any) => q.id);
      const sel = ids.map((id: string) => (answers[id] ?? -1));
      const { data: graded, error } = await supabase.rpc("grade_questions", {
        p_question_ids: ids,
        p_selected_options: sel,
        p_source: "questions",
      });
      if (error) throw error;

      const marksC = data.test.marks_correct ?? 4;
      const marksW = data.test.marks_wrong ?? 1;
      let correct = 0, wrong = 0, unattempted = 0;
      (graded || []).forEach((g: any) => {
        const chosen = answers[g.question_id];
        if (chosen === undefined) unattempted++;
        else if (g.is_correct) correct++;
        else wrong++;
      });
      const score = correct * marksC - wrong * marksW;
      const timeTaken = Math.round((Date.now() - startedAt.current) / 1000);

      const { error: updErr } = await supabase.from("series_attempts").update({
        answers: answers as any,
        score,
        correct_count: correct,
        wrong_count: wrong,
        unattempted_count: unattempted,
        total_questions: questions.length,
        time_taken_seconds: timeTaken,
        finished_at: new Date().toISOString(),
      }).eq("id", attemptIdRef.current);
      if (updErr) throw updErr;

      navigate(`/test-series/result/${attemptIdRef.current}`, { replace: true });
    } catch (e: any) {
      console.error(e);
      submittedRef.current = false;
      toast.error(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!forceNew && (checkingExisting || (existingAttempt && existingAttempt.finished_at))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading || joining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground">{joinError}</p>
        <Button onClick={() => navigate("/test-series")}>Back to Test Series</Button>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground">Is test me abhi koi question nahi hai.</p>
        <Button onClick={() => navigate("/test-series")}>Back to Test Series</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold truncate text-sm">{data?.test.title}</p>
            <p className="text-xs text-muted-foreground">{answeredCount}/{questions.length} answered</p>
          </div>
          <Badge variant={secondsLeft !== null && secondsLeft < 300 ? "destructive" : "secondary"} className="gap-1.5 text-sm px-3 py-1.5">
            <Clock className="h-3.5 w-3.5" /> {clock}
          </Badge>
        </div>
      </header>

      <div className="flex-1 p-4 lg:p-6 grid gap-5 lg:grid-cols-[1fr_260px] max-w-6xl w-full mx-auto">
        <div className="space-y-4" ref={containerRef}>
          <Card>
            <CardContent className="p-4 lg:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Question {index + 1}</Badge>
                <Button
                  variant={marked[current.id] ? "default" : "ghost"} size="sm" className="gap-1.5"
                  onClick={() => setMarked({ ...marked, [current.id]: !marked[current.id] })}
                >
                  <Flag className="h-3.5 w-3.5" /> Mark
                </Button>
              </div>

              <div className="leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatQuestionHtml(current.question_text) }} />
              {Array.isArray(current.images) && current.images.map((src: string, i: number) => (
                <img key={i} src={src} alt={`Figure ${i + 1}`} loading="lazy" className="max-h-72 rounded-lg border" />
              ))}

              <div className="space-y-2">
                {(current.options as string[]).map((opt, i) => {
                  const sel = answers[current.id] === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setAnswers({ ...answers, [current.id]: i })}
                      className={`w-full text-left rounded-xl border p-3 flex gap-3 transition ${sel ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <span className={`h-6 w-6 shrink-0 rounded-full grid place-items-center text-xs font-bold ${sel ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {LETTERS[i]}
                      </span>
                      <span className="flex-1">
                        <span dangerouslySetInnerHTML={{ __html: formatOptionHtml(opt) }} />
                        {current.option_images?.[i] && (
                          <img src={current.option_images[i]} alt={`Option ${LETTERS[i]}`} loading="lazy" className="mt-2 max-h-32 rounded" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" className="gap-1.5" disabled={index === 0}
                  onClick={() => setIndex(index - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button variant="ghost" size="sm"
                  onClick={() => { const a = { ...answers }; delete a[current.id]; setAnswers(a); }}>
                  Clear
                </Button>
                <Button size="sm" className="gap-1.5" disabled={index === questions.length - 1}
                  onClick={() => setIndex(index + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold">Question palette</p>
              <div className="grid grid-cols-6 lg:grid-cols-5 gap-2">
                {questions.map((q: any, i: number) => {
                  const answered = answers[q.id] !== undefined;
                  const isMarked = marked[q.id];
                  return (
                    <button
                      key={q.id}
                      onClick={() => setIndex(i)}
                      className={`h-9 rounded-lg text-xs font-semibold border transition
                        ${i === index ? "ring-2 ring-primary" : ""}
                        ${isMarked ? "bg-amber-500 text-white border-amber-500"
                          : answered ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-muted text-muted-foreground"}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <Button className="w-full gap-2" disabled={submitting} onClick={() => handleSubmit(false)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit test
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default SeriesTest;
