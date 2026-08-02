// Generates (and caches) a step-by-step NEET explanation for one question.
// Access is limited to signed-in users with an active trial or premium key.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SYSTEM = `You are a top NEET (Physics, Chemistry, Biology) faculty in India.
Given an MCQ and its correct option, write a crisp, exam-focused explanation.

STRICT OUTPUT RULES:
- Output raw HTML only. No markdown, no code fences, no <html>/<body> wrapper.
- Allowed tags: <p> <b> <ul> <ol> <li> <br> <sub> <sup> <table> <tr> <td>.
- Write ALL math and chemistry in LaTeX using single-dollar inline delimiters: $x = \\frac{a}{b}$.
  Never use \\( \\), \\[ \\], double backslashes, or markdown $$ blocks.
  Escape nothing else. Chemical equations: use \\ce{...} (mhchem), e.g. $\\ce{H2SO4}$.
- Structure: 1) one-line "Correct answer: (X)" 2) short concept/formula 3) numbered solving steps
  4) a final <p><b>Why other options are wrong:</b></p> list.
- Be accurate. If the given correct option looks wrong, explain the truly correct science.
- Keep it under 220 words. Language: simple English.`;

function stripFences(s: string) {
  return s
    .replace(/^```(?:html)?/i, "")
    .replace(/```$/i, "")
    .replace(/\\\((.+?)\\\)/g, "$$$1$$")
    .replace(/\\\[(.+?)\\\]/gs, "$$$1$$")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, service);

    // Access gate: any active (trial or paid) key
    const { data: keys } = await admin
      .from("premium_access_keys")
      .select("id, expires_at")
      .eq("user_id", user.id)
      .eq("is_active", true);
    const hasAccess = (keys ?? []).some((k: any) => !k.expires_at || new Date(k.expires_at) > new Date());
    if (!hasAccess) return json({ error: "premium_required" }, 402);

    const body = await req.json().catch(() => ({}));
    const questionId = String(body?.questionId ?? "");
    const table = body?.source === "pyq_questions" ? "pyq_questions" : "questions";
    if (!questionId) return json({ error: "questionId required" }, 400);

    // Cache hit
    const { data: cached } = await admin
      .from("question_explanations")
      .select("content")
      .eq("question_id", questionId)
      .maybeSingle();
    if (cached?.content) return json({ explanation: cached.content, cached: true });

    const { data: q } = await admin
      .from(table)
      .select("question_text, options, correct_option_index, explanation")
      .eq("id", questionId)
      .maybeSingle();
    if (!q) return json({ error: "question not found" }, 404);

    const existing = String((q as any).explanation ?? "").trim();
    if (existing.length > 40) {
      await admin.from("question_explanations").upsert(
        { question_id: questionId, content: existing, source: "db" },
        { onConflict: "question_id" }
      );
      return json({ explanation: existing, cached: true });
    }

    const opts: string[] = Array.isArray((q as any).options) ? (q as any).options : [];
    const correct = (q as any).correct_option_index;
    const prompt =
      `QUESTION:\n${(q as any).question_text}\n\nOPTIONS:\n` +
      opts.map((o, i) => `(${String.fromCharCode(65 + i)}) ${o}`).join("\n") +
      `\n\nCORRECT OPTION: ${typeof correct === "number" ? String.fromCharCode(65 + correct) : "unknown"}`;

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI not configured" }, 500);

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (res.status === 429) return json({ error: "rate_limited" }, 429);
    if (res.status === 402) return json({ error: "ai_credits_exhausted" }, 402);
    if (!res.ok) return json({ error: `ai_error: ${await res.text()}` }, 500);

    const out = await res.json();
    const content = stripFences(String(out?.choices?.[0]?.message?.content ?? ""));
    if (!content) return json({ error: "empty_explanation" }, 500);

    await admin.from("question_explanations").upsert(
      { question_id: questionId, content, source: "ai", model: MODEL },
      { onConflict: "question_id" }
    );

    return json({ explanation: content, cached: false });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});