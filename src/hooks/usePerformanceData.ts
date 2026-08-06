import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MistakeEntry {
  id: string;
  questionId: string;
  questionText: string;
  subjectName: string;
  chapterName: string;
  testName: string;
  testType: "practice" | "mock";
  attemptId: string;
  date: string;
  status: "wrong" | "skipped";
}

export interface HistoryEntry {
  attemptId: string;
  testName: string;
  testType: "practice" | "mock" | "series";
  date: string;
  score: number | null;
  correct: number;
  wrong: number;
  unattempted: number;
  total: number;
  accuracy: number;
  timeSpentSec: number | null;
}

export interface WeakChapter {
  subjectName: string;
  chapterName: string;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracyPct: number;
  wrongPct: number;
  skipPct: number;
}

function deriveTestName(type: string, config: any): string {
  if (type === "mock") {
    if (config?.type === "full-bio" && config?.questionCount === 90) return "Biology Mock Test";
    if (config?.type === "full-bio") return "Full Syllabus Mock";
    if (config?.type === "custom") return "Custom Mock Test";
    return "Mock Test";
  }
  if (config?.mode === "revision") return "Revision Session";
  return "Practice Session";
}

/**
 * Single round-trip: every attempt_answer this user has ever submitted,
 * joined with its attempt (for test metadata) and question (for subject/
 * chapter). Three views — Mistake Book, Test History, Weak Chapters — are
 * all derived client-side from this ONE dataset so we don't hit the DB
 * three separate times.
 *
 * FIX (this version): Test Series attempts live in a separate
 * `series_attempts` table and are fetched SEPARATELY, in its own try/catch.
 * Earlier this was a `Promise.all([...]).then(...)` where EITHER query
 * failing (`if (x.error) throw x.error`) aborted the whole function — so if
 * the series_attempts call ever errored for any reason, practice/mock
 * history (which was working fine on its own) went down with it too,
 * and the page fell back to "No tests attempted yet." That's almost
 * certainly why online mock briefly stopped showing after series support
 * was added. Now a series failure only means series entries are missing
 * from the list — practice/mock/OMR history always renders regardless.
 */
export function usePerformanceData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["performance-data", user?.id],
    queryFn: async () => {
      if (!user) return { mistakes: [] as MistakeEntry[], history: [] as HistoryEntry[], weakChapters: [] as WeakChapter[] };

      // Core dataset — practice + mock + OMR/offline (they all live in
      // attempts/attempt_answers). This is the exact query that was already
      // working before Test Series support was added; if THIS throws, we
      // genuinely have nothing to show, so it's fine to let it throw here.
      const { data: rows, error } = await supabase
        .from("attempt_answers")
        .select(`
          id, question_id, is_correct,
          attempts!inner(id, user_id, type, config, started_at, finished_at, score),
          questions!inner(id, question_text, chapter_id, subject_id,
            chapters(name),
            subjects(name)
          )
        `)
        .eq("attempts.user_id", user.id);
      if (error) throw error;

      // Test Series dataset — fetched independently. A failure here is
      // logged and swallowed, NEVER thrown, so it can't take down the rest
      // of the page. Worst case: series rows are just missing from history
      // until the underlying issue (RLS, network, whatever) is fixed.
      let seriesRows: any[] = [];
      try {
        const { data, error: seriesErr } = await supabase
          .from("series_attempts")
          .select("id, score, correct_count, wrong_count, unattempted_count, total_questions, time_taken_seconds, started_at, finished_at, series_tests(title)")
          .eq("user_id", user.id);
        if (seriesErr) throw seriesErr;
        seriesRows = data || [];
      } catch (seriesErr) {
        console.error("Test Series history unavailable (practice/mock history still loaded fine):", seriesErr);
        seriesRows = [];
      }

      const mistakes: MistakeEntry[] = [];
      const attemptMap = new Map<string, { rows: any[]; meta: any }>();
      const chapterAgg = new Map<string, WeakChapter>();

      (rows || []).forEach((r: any) => {
        const attempt = r.attempts;
        const question = r.questions;
        const subjectName = question?.subjects?.name || "Unknown";
        const chapterName = question?.chapters?.name || "Unknown";

        if (!attemptMap.has(attempt.id)) {
          attemptMap.set(attempt.id, { rows: [], meta: attempt });
        }
        attemptMap.get(attempt.id)!.rows.push(r);

        if (r.is_correct === false || r.is_correct === null) {
          mistakes.push({
            id: r.id,
            questionId: r.question_id,
            questionText: question?.question_text || "",
            subjectName,
            chapterName,
            testName: deriveTestName(attempt.type, attempt.config),
            testType: attempt.type,
            attemptId: attempt.id,
            date: attempt.started_at,
            status: r.is_correct === null ? "skipped" : "wrong",
          });
        }

        const key = `${subjectName}::${chapterName}`;
        if (!chapterAgg.has(key)) {
          chapterAgg.set(key, {
            subjectName, chapterName, total: 0, correct: 0, wrong: 0, skipped: 0,
            accuracyPct: 0, wrongPct: 0, skipPct: 0,
          });
        }
        const agg = chapterAgg.get(key)!;
        agg.total++;
        if (r.is_correct === true) agg.correct++;
        else if (r.is_correct === false) agg.wrong++;
        else agg.skipped++;
      });

      const weakChapters = Array.from(chapterAgg.values())
        .map((c) => ({
          ...c,
          accuracyPct: (c.correct + c.wrong) ? Math.round((c.correct / (c.correct + c.wrong)) * 100) : 0,
          wrongPct: c.total ? Math.round((c.wrong / c.total) * 100) : 0,
          skipPct: c.total ? Math.round((c.skipped / c.total) * 100) : 0,
        }))
        .filter((c) => c.total >= 3)
        .sort((a, b) => a.accuracyPct - b.accuracyPct);

      const history: HistoryEntry[] = Array.from(attemptMap.values())
        .map(({ rows: attemptRows, meta }) => {
          const correct = attemptRows.filter((r) => r.is_correct === true).length;
          const wrong = attemptRows.filter((r) => r.is_correct === false).length;
          const unattempted = attemptRows.filter((r) => r.is_correct === null).length;
          const total = attemptRows.length;
          const timeSpentSec =
            meta.started_at && meta.finished_at
              ? Math.round((new Date(meta.finished_at).getTime() - new Date(meta.started_at).getTime()) / 1000)
              : null;
          return {
            attemptId: meta.id,
            testName: deriveTestName(meta.type, meta.config),
            testType: meta.type,
            date: meta.started_at,
            score: meta.score,
            correct, wrong, unattempted, total,
            accuracy: total ? Math.round((correct / total) * 100) : 0,
            timeSpentSec,
          };
        });

      seriesRows.forEach((s: any) => {
        const timeSpentSec = s.time_taken_seconds ?? (
          s.started_at && s.finished_at
            ? Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 1000)
            : null
        );
        const attempted = (s.correct_count || 0) + (s.wrong_count || 0);
        history.push({
          attemptId: s.id,
          testName: s.series_tests?.title || "Test Series",
          testType: "series",
          date: s.started_at,
          score: s.score,
          correct: s.correct_count || 0,
          wrong: s.wrong_count || 0,
          unattempted: s.unattempted_count || 0,
          total: s.total_questions || 0,
          accuracy: attempted ? Math.round(((s.correct_count || 0) / attempted) * 100) : 0,
          timeSpentSec,
        });
      });

      history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      mistakes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return { mistakes, history, weakChapters };
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}
