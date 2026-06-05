import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  FileText, ChevronLeft, ChevronRight, Loader2, ArrowLeft,
  CheckCircle2, XCircle, MinusCircle, Sparkles, Download, RotateCcw,
  BarChart3, BookOpen, Target, Trophy, TrendingUp, Layers,
} from "lucide-react";

/* ---------- Types ---------- */
interface Subject { id: string; name: string; }
interface Chapter { id: string; name: string; subject_id: string; }
interface Paper {
  id: string; title: string; chapter_id: string; subject_id: string;
  total_questions: number; created_at: string;
  paper_pdf_url: string | null; solution_pdf_url: string | null;
}
interface PyqRow {
  id: string; image_url: string; correct_option_index: number;
  paper_id: string; page_number: number; chapter_id: string;
}
interface Attempt {
  id: string; paper_id: string; chapter_id: string; subject_id: string | null;
  score: number; correct_count: number; wrong_count: number;
  unattempted_count: number; total_questions: number;
  answers: Record<string, number | null>;
  updated_at: string;
}

const LETTERS = ["A", "B", "C", "D"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  const rv = new Uint32Array(a.length);
  crypto.getRandomValues(rv);
  for (let i = a.length - 1; i > 0; i--) {
    const j = rv[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Component ---------- */
export default function Pyqs() {
  const { toast } = useToast();
  const { user } = useAuth();

  // catalogue
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  // navigation
  const [view, setView] = useState<"subjects" | "chapters" | "sets" | "attempt" | "result">("subjects");
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [activePaper, setActivePaper] = useState<Paper | null>(null);

  // attempt state
  const [questions, setQuestions] = useState<PyqRow[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [idx, setIdx] = useState(0);
  const [resultAttempt, setResultAttempt] = useState<Attempt | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);

  /* ---------- Bootstrap ---------- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [subRes, chRes, paperRes, attRes] = await Promise.all([
        supabase.from("subjects").select("id, name"),
        supabase.from("chapters").select("id, name, subject_id"),
        (supabase as any).from("pyq_papers")
          .select("id, title, chapter_id, subject_id, total_questions, created_at, paper_pdf_url, solution_pdf_url")
          .order("created_at", { ascending: false }),
        user
          ? (supabase as any).from("pyq_attempts")
              .select("id, paper_id, chapter_id, subject_id, score, correct_count, wrong_count, unattempted_count, total_questions, answers, updated_at")
              .eq("user_id", user.id)
              .not("paper_id", "is", null)
          : Promise.resolve({ data: [] }),
      ]);
      setSubjects((subRes.data || []) as Subject[]);
      setChapters((chRes.data || []) as Chapter[]);
      setPapers(((paperRes as any).data || []) as Paper[]);
      setAttempts(((attRes as any).data || []) as Attempt[]);
      setLoading(false);
    })();
  }, [user]);

  /* ---------- Derived ---------- */
  const subjectsWithPyqs = useMemo(() => {
    const ids = new Set(papers.map(p => p.subject_id));
    return subjects.filter(s => ids.has(s.id));
  }, [subjects, papers]);

  const chaptersForSubject = useMemo(() => {
    if (!activeSubject) return [];
    const ids = new Set(papers.filter(p => p.subject_id === activeSubject.id).map(p => p.chapter_id));
    return chapters.filter(c => ids.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [chapters, papers, activeSubject]);

  const papersForChapter = useMemo(() => {
    if (!activeChapter) return [];
    return papers.filter(p => p.chapter_id === activeChapter.id);
  }, [papers, activeChapter]);

  const attemptByPaper = useMemo(() => {
    const m = new Map<string, Attempt>();
    attempts.forEach(a => m.set(a.paper_id, a));
    return m;
  }, [attempts]);

  /* ---------- Overall analytics ---------- */
  const overallStats = useMemo(() => {
    const totalAttempts = attempts.length;
    const correct = attempts.reduce((s, a) => s + (a.correct_count || 0), 0);
    const wrong = attempts.reduce((s, a) => s + (a.wrong_count || 0), 0);
    const skipped = attempts.reduce((s, a) => s + (a.unattempted_count || 0), 0);
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const totalScore = attempts.reduce((s, a) => s + (a.score || 0), 0);
    const maxScore = attempts.reduce((s, a) => s + (a.total_questions || 0) * 4, 0);
    return { totalAttempts, correct, wrong, skipped, accuracy, totalScore, maxScore };
  }, [attempts]);

  const subjectStats = useMemo(() => {
    const map = new Map<string, { correct: number; wrong: number; skipped: number; sets: number; total: number }>();
    attempts.forEach(a => {
      const sid = a.subject_id || "";
      const cur = map.get(sid) || { correct: 0, wrong: 0, skipped: 0, sets: 0, total: 0 };
      cur.correct += a.correct_count || 0;
      cur.wrong += a.wrong_count || 0;
      cur.skipped += a.unattempted_count || 0;
      cur.sets += 1;
      cur.total += a.total_questions || 0;
      map.set(sid, cur);
    });
    return subjects.map(s => {
      const x = map.get(s.id) || { correct: 0, wrong: 0, skipped: 0, sets: 0, total: 0 };
      const att = x.correct + x.wrong;
      return { ...s, ...x, accuracy: att > 0 ? Math.round((x.correct / att) * 100) : 0 };
    }).filter(s => s.sets > 0);
  }, [attempts, subjects]);

  const chapterStatsForSubject = useMemo(() => {
    if (!activeSubject) return [];
    const subjChapters = chapters.filter(c => c.subject_id === activeSubject.id);
    return subjChapters.map(c => {
      const chAttempts = attempts.filter(a => a.chapter_id === c.id);
      const correct = chAttempts.reduce((s, a) => s + (a.correct_count || 0), 0);
      const wrong = chAttempts.reduce((s, a) => s + (a.wrong_count || 0), 0);
      const att = correct + wrong;
      return {
        chapter: c,
        sets: chAttempts.length,
        correct, wrong,
        accuracy: att > 0 ? Math.round((correct / att) * 100) : 0,
        totalAvailable: papers.filter(p => p.chapter_id === c.id).length,
      };
    }).filter(s => s.totalAvailable > 0);
  }, [activeSubject, chapters, attempts, papers]);

  /* ---------- Actions ---------- */
  const startPaper = async (paper: Paper) => {
    setActivePaper(paper);
    setView("attempt");
    setLoadingQs(true);
    setAnswers({});
    setIdx(0);
    setStartedAt(Date.now());
    const { data, error } = await supabase
      .from("pyq_questions")
      .select("id, image_url, correct_option_index, paper_id, page_number, chapter_id")
      .eq("paper_id", paper.id)
      .order("page_number", { ascending: true })
      .limit(1000);
    if (error) {
      toast({ title: "Failed to load questions", variant: "destructive" });
      setView("sets"); setLoadingQs(false); return;
    }
    // Shuffle within the set so users don't memorise order
    setQuestions(shuffle((data || []) as PyqRow[]));
    setLoadingQs(false);
  };

  const finishAttempt = async () => {
    if (!activePaper) return;
    let correct = 0, wrong = 0, unattempted = 0;
    questions.forEach(q => {
      const ans = answers[q.id];
      if (ans === undefined || ans === null) unattempted++;
      else if (ans === q.correct_option_index) correct++;
      else wrong++;
    });
    const score = correct * 4 - wrong;
    const timeSec = Math.round((Date.now() - startedAt) / 1000);
    const payload: any = {
      user_id: user?.id,
      paper_id: activePaper.id,
      chapter_id: activePaper.chapter_id,
      subject_id: activePaper.subject_id,
      score,
      correct_count: correct,
      wrong_count: wrong,
      unattempted_count: unattempted,
      total_questions: questions.length,
      answers,
      time_taken_seconds: timeSec,
      updated_at: new Date().toISOString(),
    };
    let saved: Attempt | null = null;
    if (user) {
      const { data } = await (supabase as any).from("pyq_attempts")
        .upsert(payload, { onConflict: "user_id,paper_id" })
        .select("id, paper_id, chapter_id, subject_id, score, correct_count, wrong_count, unattempted_count, total_questions, answers, updated_at")
        .maybeSingle();
      saved = data as Attempt;
      if (saved) {
        setAttempts(prev => {
          const without = prev.filter(a => a.paper_id !== saved!.paper_id);
          return [saved!, ...without];
        });
      }
    }
    setResultAttempt(saved || ({ ...payload, id: "local" } as Attempt));
    setView("result");
  };

  const exitToSets = () => {
    setActivePaper(null); setQuestions([]); setAnswers({});
    setResultAttempt(null); setView("sets");
  };
  const exitToChapters = () => { setActiveChapter(null); setView("chapters"); };
  const exitToSubjects = () => { setActiveSubject(null); setView("subjects"); };

  /* ---------- Render helpers ---------- */
  const Header = ({ crumbs }: { crumbs: { label: string; onClick?: () => void }[] }) => (
    <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {c.onClick ? (
            <button onClick={c.onClick} className="hover:text-primary underline-offset-2 hover:underline">{c.label}</button>
          ) : <span className="text-foreground font-medium">{c.label}</span>}
          {i < crumbs.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      ))}
    </div>
  );

  /* ===========================================================
     ATTEMPT VIEW
  =========================================================== */
  if (view === "attempt" && activePaper) {
    if (loadingQs) {
      return (
        <DashboardLayout>
          <div className="p-6 flex items-center justify-center h-[60vh]">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Loading set...</p>
            </div>
          </div>
        </DashboardLayout>
      );
    }
    if (questions.length === 0) {
      return (
        <DashboardLayout>
          <div className="p-6"><p>No questions in this set.</p>
            <Button className="mt-3" onClick={exitToSets}>Back</Button>
          </div>
        </DashboardLayout>
      );
    }
    const q = questions[idx];
    const picked = answers[q.id];
    const attemptedCount = questions.filter(qq => answers[qq.id] !== undefined && answers[qq.id] !== null).length;

    return (
      <DashboardLayout>
        <div className="p-3 lg:p-6 max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={exitToSets}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Exit
            </Button>
            <div className="text-center min-w-0">
              <p className="text-xs text-muted-foreground truncate">{activePaper.title}</p>
              <p className="text-sm font-semibold">Q {idx + 1} / {questions.length}</p>
            </div>
            <Badge variant="secondary">{attemptedCount} done</Badge>
          </div>

          <Card>
            <CardContent className="p-1 sm:p-3">
              <img
                src={q.image_url}
                alt={`Question ${idx + 1}`}
                loading="eager"
                className="block w-full h-auto rounded-lg border bg-white min-h-[55vh] object-contain"
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {LETTERS.map((L, i) => {
              const isSel = picked === i;
              return (
                <Button key={L} variant={isSel ? "default" : "outline"}
                  className="h-14 text-lg font-semibold"
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: isSel ? null : i }))}>
                  {L}
                </Button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(i => Math.max(0, i - 1))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            {idx === questions.length - 1 ? (
              <Button onClick={finishAttempt}>Finish</Button>
            ) : (
              <Button onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Jump to question</p>
              <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
                {questions.map((qq, i) => {
                  const a = answers[qq.id];
                  const done = a !== undefined && a !== null;
                  return (
                    <button key={qq.id} onClick={() => setIdx(i)}
                      className={"h-8 rounded text-xs font-semibold border transition " +
                        (i === idx ? "bg-primary text-primary-foreground border-primary " :
                         done ? "bg-primary/10 border-primary/40 text-primary " :
                         "bg-background hover:bg-muted border-border ")}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  /* ===========================================================
     RESULT VIEW (with per-question review)
  =========================================================== */
  if (view === "result" && activePaper && resultAttempt) {
    const a = resultAttempt;
    const totalMax = a.total_questions * 4;
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5">
          <Button variant="ghost" size="sm" onClick={exitToSets}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to sets
          </Button>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Result</p>
                <h2 className="text-2xl font-bold">{activePaper.title}</h2>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-green-50 dark:bg-green-950/40 p-4">
                  <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-1" />
                  <p className="text-2xl font-bold">{a.correct_count}</p>
                  <p className="text-xs text-muted-foreground">Correct</p>
                </div>
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4">
                  <XCircle className="h-6 w-6 mx-auto text-red-600 mb-1" />
                  <p className="text-2xl font-bold">{a.wrong_count}</p>
                  <p className="text-xs text-muted-foreground">Wrong</p>
                </div>
                <div className="rounded-xl bg-muted p-4">
                  <MinusCircle className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-2xl font-bold">{a.unattempted_count}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/30 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-primary font-semibold">Score</p>
                <p className="text-3xl font-bold">
                  {a.score} <span className="text-base font-normal text-muted-foreground">/ {totalMax}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">+4 correct • -1 wrong</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="flex-1 min-w-[120px]" onClick={exitToSets}>
                  Back to sets
                </Button>
                <Button className="flex-1 min-w-[120px]" onClick={() => startPaper(activePaper)}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Reattempt
                </Button>
                {activePaper.paper_pdf_url && (
                  <Button asChild variant="outline" size="sm">
                    <a href={activePaper.paper_pdf_url} target="_blank" rel="noreferrer">
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Paper
                    </a>
                  </Button>
                )}
                {activePaper.solution_pdf_url && (
                  <Button asChild variant="outline" size="sm">
                    <a href={activePaper.solution_pdf_url} target="_blank" rel="noreferrer">
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Solutions
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Per-question review */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Question Review
              </h3>
              <div className="space-y-4">
                {questions.map((q, i) => {
                  const userAns = answers[q.id];
                  const correct = q.correct_option_index;
                  const isCorrect = userAns === correct;
                  const isSkipped = userAns === undefined || userAns === null;
                  return (
                    <div key={q.id} className="border rounded-xl overflow-hidden">
                      <div className={"px-3 py-2 flex items-center justify-between text-sm font-semibold " +
                        (isCorrect ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300" :
                         isSkipped ? "bg-muted text-muted-foreground" :
                         "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300")}>
                        <span>Q {i + 1}</span>
                        <span className="flex items-center gap-1">
                          {isCorrect ? <CheckCircle2 className="h-4 w-4" /> :
                           isSkipped ? <MinusCircle className="h-4 w-4" /> :
                           <XCircle className="h-4 w-4" />}
                          {isCorrect ? "Correct" : isSkipped ? "Skipped" : "Wrong"}
                        </span>
                      </div>
                      <img src={q.image_url} alt={`Q${i + 1}`} loading="lazy"
                        className="block w-full h-auto bg-white" />
                      <div className="grid grid-cols-2 gap-2 p-3 text-sm">
                        <div className="rounded-lg border p-2">
                          <p className="text-xs text-muted-foreground">Your answer</p>
                          <p className="font-bold">{isSkipped ? "—" : LETTERS[userAns!]}</p>
                        </div>
                        <div className="rounded-lg border p-2 border-green-500/40 bg-green-50/40 dark:bg-green-950/20">
                          <p className="text-xs text-green-700 dark:text-green-300">Correct answer</p>
                          <p className="font-bold text-green-700 dark:text-green-300">{LETTERS[correct]}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  /* ===========================================================
     LOADING
  =========================================================== */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  /* ===========================================================
     SETS VIEW (papers for a chapter)
  =========================================================== */
  if (view === "sets" && activeChapter && activeSubject) {
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-6 max-w-5xl space-y-5">
          <Header crumbs={[
            { label: "All PYQs", onClick: exitToSubjects },
            { label: activeSubject.name, onClick: exitToChapters },
            { label: activeChapter.name },
          ]} />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{activeChapter.name}</h1>
              <p className="text-sm text-muted-foreground">
                {papersForChapter.length} set{papersForChapter.length !== 1 ? "s" : ""} available
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exitToChapters}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>

          {papersForChapter.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No sets yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {papersForChapter.map(p => {
                const att = attemptByPaper.get(p.id);
                const max = (p.total_questions || 0) * 4;
                const accuracy = att && (att.correct_count + att.wrong_count) > 0
                  ? Math.round((att.correct_count / (att.correct_count + att.wrong_count)) * 100) : 0;
                return (
                  <Card key={p.id} className="hover:border-primary transition">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{p.title}</p>
                          <p className="text-xs text-muted-foreground">{p.total_questions} questions</p>
                        </div>
                        {att ? (
                          <Badge className="bg-green-600 hover:bg-green-600">Attempted</Badge>
                        ) : (
                          <Badge variant="outline">New</Badge>
                        )}
                      </div>

                      {att && (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-lg bg-muted p-2">
                            <p className="font-bold text-base">{att.score}<span className="text-xs text-muted-foreground">/{max}</span></p>
                            <p className="text-muted-foreground">Score</p>
                          </div>
                          <div className="rounded-lg bg-muted p-2">
                            <p className="font-bold text-base">{accuracy}%</p>
                            <p className="text-muted-foreground">Accuracy</p>
                          </div>
                          <div className="rounded-lg bg-muted p-2">
                            <p className="font-bold text-base">{att.correct_count}/{att.total_questions}</p>
                            <p className="text-muted-foreground">Correct</p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button className="flex-1" onClick={() => startPaper(p)}>
                          {att ? <><RotateCcw className="h-4 w-4 mr-2" />Reattempt</> : "Start Mock"}
                        </Button>
                        {att && (
                          <Button variant="outline" onClick={async () => {
                            // Load the questions and show stored review
                            setActivePaper(p);
                            setLoadingQs(true);
                            setView("attempt");
                            const { data } = await supabase
                              .from("pyq_questions")
                              .select("id, image_url, correct_option_index, paper_id, page_number, chapter_id")
                              .eq("paper_id", p.id).limit(1000);
                            const qs = (data || []) as PyqRow[];
                            setQuestions(qs);
                            setAnswers(att.answers || {});
                            setResultAttempt(att);
                            setLoadingQs(false);
                            setView("result");
                          }}>Review</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  /* ===========================================================
     CHAPTERS VIEW (for a subject) + chapter analytics
  =========================================================== */
  if (view === "chapters" && activeSubject) {
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-6 max-w-5xl space-y-5">
          <Header crumbs={[
            { label: "All PYQs", onClick: exitToSubjects },
            { label: activeSubject.name },
          ]} />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{activeSubject.name}</h1>
              <p className="text-sm text-muted-foreground">
                {chaptersForSubject.length} chapter{chaptersForSubject.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exitToSubjects}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Subjects
            </Button>
          </div>

          {/* Chapter analytics */}
          {chapterStatsForSubject.some(s => s.sets > 0) && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Your chapter-wise performance
                </p>
                <div className="space-y-2">
                  {chapterStatsForSubject.filter(s => s.sets > 0).map(s => (
                    <div key={s.chapter.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium truncate">{s.chapter.name}</span>
                        <span className="text-muted-foreground">{s.accuracy}% • {s.sets} set{s.sets !== 1 ? "s" : ""}</span>
                      </div>
                      <Progress value={s.accuracy} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {chaptersForSubject.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No PYQs in this subject.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {chaptersForSubject.map(c => {
                const setsCount = papers.filter(p => p.chapter_id === c.id).length;
                const attemptedCount = papers.filter(p => p.chapter_id === c.id && attemptByPaper.has(p.id)).length;
                return (
                  <button key={c.id}
                    onClick={() => { setActiveChapter(c); setView("sets"); }}
                    className="text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm line-clamp-2">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {setsCount} set{setsCount !== 1 ? "s" : ""} • {attemptedCount} done
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  /* ===========================================================
     SUBJECTS VIEW (root) — with Browse / Analytics tabs
  =========================================================== */
  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 max-w-5xl space-y-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary tracking-wider uppercase">All PYQS</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold">
              Previous Year <span className="text-primary italic">Questions</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Subject → Chapter → Sets. Attempt original NEET PYQ papers, get scored and reviewed.
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="browse" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="browse"><Layers className="h-4 w-4 mr-1.5" /> Browse</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="h-4 w-4 mr-1.5" /> Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            {subjectsWithPyqs.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No PYQs uploaded yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjectsWithPyqs.map(s => {
                  const subjChCount = new Set(papers.filter(p => p.subject_id === s.id).map(p => p.chapter_id)).size;
                  const subjSetsCount = papers.filter(p => p.subject_id === s.id).length;
                  const stats = subjectStats.find(x => x.id === s.id);
                  return (
                    <button key={s.id}
                      onClick={() => { setActiveSubject(s); setView("chapters"); }}
                      className="text-left rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition p-5 group">
                      <div className="flex items-start justify-between gap-2">
                        <BookOpen className="h-7 w-7 text-primary" />
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <p className="font-bold text-lg mt-3">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {subjChCount} chapter{subjChCount !== 1 ? "s" : ""} • {subjSetsCount} set{subjSetsCount !== 1 ? "s" : ""}
                      </p>
                      {stats && (
                        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Your accuracy</span>
                          <span className="font-bold text-primary">{stats.accuracy}%</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {/* Overall dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5" />Sets Done</div>
                <p className="text-2xl font-bold mt-1">{overallStats.totalAttempts}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" />Accuracy</div>
                <p className="text-2xl font-bold mt-1">{overallStats.accuracy}%</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Correct</div>
                <p className="text-2xl font-bold mt-1 text-green-600">{overallStats.correct}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Total Score</div>
                <p className="text-2xl font-bold mt-1">{overallStats.totalScore}<span className="text-xs text-muted-foreground">/{overallStats.maxScore}</span></p>
              </CardContent></Card>
            </div>

            {/* Subject breakdown */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Subject-wise accuracy</h3>
                {subjectStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Attempt some sets to see analytics.</p>
                ) : (
                  <div className="space-y-3">
                    {subjectStats.map(s => (
                      <div key={s.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground">{s.accuracy}% • {s.sets} set{s.sets !== 1 ? "s" : ""}</span>
                        </div>
                        <Progress value={s.accuracy} className="h-2" />
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="text-green-600">✓ {s.correct}</span>
                          <span className="text-red-600">✗ {s.wrong}</span>
                          <span>— {s.skipped} skipped</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent attempts */}
            {attempts.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-bold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Recent attempts</h3>
                  <div className="space-y-2">
                    {attempts.slice(0, 8).map(a => {
                      const paper = papers.find(p => p.id === a.paper_id);
                      const att = a.correct_count + a.wrong_count;
                      const acc = att > 0 ? Math.round((a.correct_count / att) * 100) : 0;
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{paper?.title || "Set"}</p>
                            <p className="text-xs text-muted-foreground">{new Date(a.updated_at).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{a.score}/{a.total_questions * 4}</p>
                            <p className="text-xs text-muted-foreground">{acc}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}