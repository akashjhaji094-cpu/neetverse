import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface MockProgressPoint {
  attemptId: string;
  finishedAt: string;
  score: number;
  totalQuestions: number;
  maxScore: number;
  correct: number;
  wrong: number;
  percentage: number;
  accuracy: number;
}

export function useMockProgress(limit: number = 10) {
  return useQuery({
    queryKey: ["mock-progress", limit],
    queryFn: async (): Promise<MockProgressPoint[]> => {
      const { data, error } = await supabase.rpc(
        "get_user_mock_progress" as any,
        { p_limit: limit } as any
      );
      if (error) throw error;
      return (data as unknown as MockProgressPoint[]) || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}
