import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface SubjectAnalysisRow {
  subjectId: string;
  subject: string;
  totalQuestions: number;
  correct: number;
  wrong: number;
  unattempted: number;
  marks: number;
  maxMarks: number;
  accuracy: number;
  attemptRate: number;
}

export interface ChapterAnalysisRow {
  chapterId: string;
  chapter: string;
  subject: string;
  subjectId: string;
  totalQuestions: number;
  correct: number;
  wrong: number;
  unattempted: number;
  marks: number;
  maxMarks: number;
  accuracy: number;
}

export interface OverallAnalysis {
  totalQuestions: number;
  correct: number;
  wrong: number;
  unattempted: number;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  attemptRate: number;
  positiveMarks: number;
  negativeMarks: number;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
}

export interface MockTestAnalysis {
  attemptId: string;
  overall: OverallAnalysis;
  subjects: SubjectAnalysisRow[];
  chapters: ChapterAnalysisRow[];
  weakChapters: ChapterAnalysisRow[];
  strongChapters: ChapterAnalysisRow[];
}

export function useMockAnalysis(attemptId: string | undefined) {
  return useQuery({
    queryKey: ["mock-analysis", attemptId],
    queryFn: async (): Promise<MockTestAnalysis> => {
      if (!attemptId) throw new Error("Missing attempt id");
      // "as any" here is temporary: it lets this compile immediately even
      // before src/integrations/supabase/types.ts has been regenerated
      // with the new RPC function signature. Safe to remove once it has.
      const { data, error } = await supabase.rpc(
        "get_mock_test_analysis" as any,
        { p_attempt_id: attemptId } as any
      );
      if (error) throw error;
      return data as unknown as MockTestAnalysis;
    },
    enabled: !!attemptId,
    staleTime: 1000 * 60 * 5,
  });
}
