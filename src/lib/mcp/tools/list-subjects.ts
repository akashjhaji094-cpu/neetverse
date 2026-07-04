import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";

declare const process: { env: Record<string, string | undefined> };

export default defineTool({
  name: "list_subjects",
  title: "List subjects",
  description: "List all NEET subjects (Physics, Chemistry, Biology) available in NEETVerse.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.from("subjects").select("id, name, slug").order("name");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { subjects: data ?? [] },
    };
  },
});