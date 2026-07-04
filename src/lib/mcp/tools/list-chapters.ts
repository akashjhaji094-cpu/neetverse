import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

declare const process: { env: Record<string, string | undefined> };

export default defineTool({
  name: "list_chapters",
  title: "List chapters",
  description: "List NEET chapters, optionally filtered by subject slug (physics, chemistry, biology).",
  inputSchema: {
    subject_slug: z.string().optional().describe("Optional subject slug filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ subject_slug }) => {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let subjectId: string | null = null;
    if (subject_slug) {
      const { data: sub } = await sb.from("subjects").select("id").eq("slug", subject_slug).maybeSingle();
      if (!sub) return { content: [{ type: "text", text: `Unknown subject: ${subject_slug}` }], isError: true };
      subjectId = sub.id;
    }
    let q = sb.from("chapters").select("id, name, slug, subject_id").order("name");
    if (subjectId) q = q.eq("subject_id", subjectId);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { chapters: data ?? [] },
    };
  },
});