import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, ChevronLeft, ChevronRight, Loader2, ArrowLeft,
  CheckCircle2, XCircle, MinusCircle, Sparkles,
} from "lucide-react";

interface ChapterCount { chapter_id: string; chapter_name: string; subject_name: string; total: number; }
interface PyqRow {
  id: string; image_url: string; correct_option_index: number;
  paper_id: string; page_number: number;
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

export default function Pyqs() {
  const { toast } = useToast();
  const [chapters, setChapters] = useState<ChapterCount[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);

  const [activeChapter, setActiveChapter] = useState<ChapterCount | null>(null);
  const [questions, setQuestions] = useState<PyqRow[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [idx, setIdx] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // 1) Load chapter list (one trip per chapter aggregation via group query)
  useEffect(() => {
    (async () => {
      setLoadingChapters(true);
      const [{ data: rows }, { data: chs }, { data: subs }] = await Promise.all([
        supabase.from("pyq_questions").select("chapter_id"),
        supabase.from("chapters").select("id, name, subject_id"),
        supabase.from("subjects").select("id, name"),
      ]);
      const tally = new Map<string, number>();
      (rows || []).forEach((r: any) => tally.set(r.chapter_id, (tally.get(r.chapter_id) || 0) + 1));
      const subjName = new Map((subs || []).map((s: any) => [s.id, s.name]));
      const list: ChapterCount[] = [];
      (chs || []).forEach((c: any) => {
        const n = tally.get(c.id) || 0;
        if (n > 0) list.push({
          chapter_id: c.id,
          chapter_name: c.name,
          subject_name: subjName.get(c.subject_id) || "Other",
          total: n,
        });
      });
      list.sort((a, b) => a.subject_name.localeCompare(b.subject_name) || a.chapter_name.localeCompare(b.chapter_name));
      setChapters(list);
      setLoadingChapters(false);
    })();
  }, []);

  const startChapter = async (ch: ChapterCount) => {
    setActiveChapter(ch);
    setLoadingQs(true);
    setAnswers({});
    setIdx(0);
    setSubmitted(false);
    const { data, error } = await supabase
      .from("pyq_questions")
      .select("id, image_url, correct_option_index, paper_id, page_number")
      .eq("chapter_id", ch.chapter_id)
      .limit(5000);
    if (error) {
      toast({ title: "Failed to load", variant: "destructive" });
      setActiveChapter(null);
      setLoadingQs(false);
      return;
    }
    // Shuffle ACROSS papers so user doesn't get one PDF sequentially
    setQuestions(shuffle((data || []) as PyqRow[]));
    setLoadingQs(false);
  };

  const groupedChapters = useMemo(() => {
    const g: Record<string, ChapterCount[]> = {};
    chapters.forEach(c => { (g[c.subject_name] = g[c.subject_name] || []).push(c); });
    return g;
  }, [chapters]);

  // ---------- Results state ----------
  if (submitted && activeChapter) {
    let correct = 0, wrong = 0, unattempted = 0;
    questions.forEach(q => {
      const ans = answers[q.id];
      if (ans === undefined || ans === null) unattempted++;
      else if (ans === q.correct_option_index) correct++;
      else wrong++;
    });
    const score = correct * 4 - wrong;
    const total = questions.length;
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-6 max-w-3xl space-y-5">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">PYQ Result</p>
                <h2 className="text-2xl font-bold">{activeChapter.chapter_name}</h2>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-green-50 dark:bg-green-950/40 p-4">
                  <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-1" />
                  <p className="text-2xl font-bold">{correct}</p>
                  <p className="text-xs text-muted-foreground">Correct</p>
                </div>
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4">
                  <XCircle className="h-6 w-6 mx-auto text-red-600 mb-1" />
                  <p className="text-2xl font-bold">{wrong}</p>
                  <p className="text-xs text-muted-foreground">Wrong</p>
                </div>
                <div className="rounded-xl bg-muted p-4">
                  <MinusCircle className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-2xl font-bold">{unattempted}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>
              <div className="rounded-xl bg-primary/5 border border-primary/30 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-primary font-semibold">Score</p>
                <p className="text-3xl font-bold">{score} <span className="text-base font-normal text-muted-foreground">/ {total * 4}</span></p>
                <p className="text-xs text-muted-foreground mt-1">+4 correct • -1 wrong</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setActiveChapter(null); setQuestions([]); }}>
                  Back to chapters
                </Button>
                <Button className="flex-1" onClick={() => startChapter(activeChapter)}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ---------- Attempting state ----------
  if (activeChapter) {
    if (loadingQs) {
      return (
        <DashboardLayout>
          <div className="p-6 flex items-center justify-center h-[60vh]">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Loading PYQ questions...</p>
            </div>
          </div>
        </DashboardLayout>
      );
    }
    if (questions.length === 0) {
      return (
        <DashboardLayout>
          <div className="p-6">
            <p>No PYQs found.</p>
            <Button className="mt-3" onClick={() => setActiveChapter(null)}>Back</Button>
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
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveChapter(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Exit
            </Button>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{activeChapter.chapter_name}</p>
              <p className="text-sm font-semibold">Q {idx + 1} / {questions.length}</p>
            </div>
            <Badge variant="secondary">{attemptedCount} done</Badge>
          </div>

          {/* Question image */}
          <Card>
            <CardContent className="p-2 sm:p-4">
              <img
                src={q.image_url}
                alt={`Question ${idx + 1}`}
                loading="eager"
                className="w-full h-auto rounded-lg border bg-white"
              />
            </CardContent>
          </Card>

          {/* Options */}
          <div className="grid grid-cols-2 gap-2">
            {LETTERS.map((L, i) => {
              const isSel = picked === i;
              return (
                <Button
                  key={L}
                  variant={isSel ? "default" : "outline"}
                  className="h-14 text-lg font-semibold"
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: isSel ? null : i }))}
                >
                  {L}
                </Button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              disabled={idx === 0}
              onClick={() => setIdx(i => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            {idx === questions.length - 1 ? (
              <Button onClick={() => setSubmitted(true)}>Finish</Button>
            ) : (
              <Button onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>

          {/* Question palette */}
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Jump to question</p>
              <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
                {questions.map((qq, i) => {
                  const a = answers[qq.id];
                  const done = a !== undefined && a !== null;
                  return (
                    <button
                      key={qq.id}
                      onClick={() => setIdx(i)}
                      className={
                        "h-8 rounded text-xs font-semibold border transition " +
                        (i === idx ? "bg-primary text-primary-foreground border-primary " :
                         done ? "bg-primary/10 border-primary/40 text-primary " :
                         "bg-background hover:bg-muted border-border ")
                      }
                    >{i + 1}</button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ---------- Chapter list ----------
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
              Chapter-wise NEET PYQs. Original scans, shuffled across papers — koi serial pattern nahi.
            </p>
          </CardContent>
        </Card>

        {loadingChapters ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : chapters.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No PYQs uploaded yet. Admin can add via the panel.</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedChapters).map(([subj, items]) => (
            <div key={subj} className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {subj} <span className="text-xs font-normal">({items.length} chapters)</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(ch => (
                  <button
                    key={ch.chapter_id}
                    onClick={() => startChapter(ch)}
                    className="text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition p-4 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm group-hover:text-primary line-clamp-2">{ch.chapter_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{ch.total} questions</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}