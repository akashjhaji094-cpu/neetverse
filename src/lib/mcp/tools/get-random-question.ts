import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

declare const process: { env: Record<string, string | undefined> };

export default defineTool({
  name: "get_random_question",
  title: "Get random practice question",
  description: "Fetch a random NEET practice question, optionally filtered by subject slug or chapter id.",
  inputSchema: {
    subject_slug: z.string().optional().describe("Optional subject slug (physics/chemistry/biology)."),
    chapter_id: z.string().uuid().optional().describe("Optional chapter UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ subject_slug, chapter_id }) => {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let subjectId: string | null = null;
    if (subject_slug) {
      const { data: sub } = await sb.from("subjects").select("id").eq("slug", subject_slug).maybeSingle();
      if (sub) subjectId = sub.id;
    }
    let q = sb.from("questions").select("id, question_text, options, correct_option_index, explanation, chapter_id, subject_id").limit(50);
    if (chapter_id) q = q.eq("chapter_id", chapter_id);
    else if (subjectId) q = q.eq("subject_id", subjectId);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data?.length) return { content: [{ type: "text", text: "No questions found." }], isError: true };
    const pick = data[Math.floor(Math.random() * data.length)];
    return {
      content: [{ type: "text", text: JSON.stringify(pick) }],
      structuredContent: { question: pick },
    };
  },
});