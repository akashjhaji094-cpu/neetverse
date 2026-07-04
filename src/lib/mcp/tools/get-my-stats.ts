import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

declare const process: { env: Record<string, string | undefined> };

export default defineTool({
  name: "get_my_stats",
  title: "Get my study stats",
  description: "Get the signed-in user's NEETVerse practice stats: total attempts, accuracy, current streak.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userId = ctx.getUserId();
    const [{ data: answers }, { data: streak }] = await Promise.all([
      sb.from("attempt_answers").select("is_correct").eq("user_id", userId as string).limit(10000),
      sb.from("user_streaks").select("current_streak, longest_streak, last_active_date").eq("user_id", userId as string).maybeSingle(),
    ]);
    const total = answers?.length ?? 0;
    const correct = answers?.filter((a: any) => a.is_correct).length ?? 0;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    const stats = {
      total_answers: total,
      correct_answers: correct,
      accuracy_percent: accuracy,
      current_streak: streak?.current_streak ?? 0,
      longest_streak: streak?.longest_streak ?? 0,
      last_active_date: streak?.last_active_date ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(stats) }],
      structuredContent: stats,
    };
  },
});