import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Question } from "@/lib/supabase";

export function useAttemptQuestions(attemptId: string | undefined) {
  return useQuery({
    queryKey: ["attempt-questions", attemptId],
    queryFn: async (): Promise<{ questions: Question[]; answers: Record<string, number | null> }> => {
      if (!attemptId) throw new Error("Missing attempt id");

      const { data: answerRows, error } = await supabase
        .from("attempt_answers")
        .select("question_id, chosen_option_index")
        .eq("attempt_id", attemptId);
      if (error) throw error;
      if (!answerRows || answerRows.length === 0) throw new Error("No questions found for this attempt");

      const questionIds = answerRows.map((r) => r.question_id);
      const answers: Record<string, number | null> = {};
      answerRows.forEach((r) => { answers[r.question_id] = r.chosen_option_index; });

      const { data: questions, error: qError } = await supabase
        .from("questions")
        .select("id, chapter_id, subject_id, question_text, options, correct_option_index, explanation, images, difficulty")
        .in("id", questionIds);
      if (qError) throw qError;

      const qMap = new Map((questions || []).map((q) => [q.id, q]));
      const ordered = questionIds.map((id) => qMap.get(id)).filter(Boolean) as Question[];

      return { questions: ordered, answers };
    },
    enabled: !!attemptId,
    staleTime: 1000 * 60 * 10,
  });
}
