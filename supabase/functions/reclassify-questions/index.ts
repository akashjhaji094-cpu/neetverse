// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function stripHtml(s: string) {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
}

async function classifyBatch(
  chapter: string,
  topics: { id: string; name: string }[],
  questions: { id: string; text: string }[],
): Promise<Record<string, string>> {
  const topicList = topics.map((t, i) => `${i + 1}. ${t.name}`).join("\n");
  const items = questions.map((q, i) => `[Q${i + 1}] ${q.text}`).join("\n\n");
  const prompt = `You are an expert NEET curriculum tagger for the chapter "${chapter}".

Available specific topics:
${topicList}

For each question below, output the SINGLE best matching topic NAME (exact string from list above). If truly unrelated to any specific topic, output "General".

Respond STRICTLY as compact JSON: {"Q1":"<topic>","Q2":"<topic>",...}

Questions:
${items}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    // Extract JSON from possible text
    const m = content.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { chapter_id, batch_size = 40, loop_seconds = 0 } = body as any;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth: accept either LOVABLE_API_KEY bearer (server-to-server) OR an admin user JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    let authorized = false;
    if (token && token === LOVABLE_API_KEY) {
      authorized = true;
    } else if (token) {
      const { data: userData } = await sb.auth.getUser(token);
      if (userData?.user) {
        const { data: role } = await sb
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .in("role", ["superadmin", "content_admin"])
          .maybeSingle();
        if (role) authorized = true;
      }
    }
    if (!authorized) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const deadline = loop_seconds > 0 ? Date.now() + loop_seconds * 1000 : 0;
    const aggregate = { batches: 0, processed: 0, moved: 0, fallback: 0, chapters: [] as any[] };

    // Runner: process one batch
    async function runOneBatch(): Promise<any> {
     {
      // fall-through into original logic
     }
     return await processBatch();
    }

    async function processBatch() {

    // Determine target chapter(s). If no chapter_id, pick chapter with most "General" questions.
    let targetChapter: { id: string; name: string; general_topic_id: string } | null = null;
    if (chapter_id) {
      const { data: c } = await sb.from("chapters").select("id,name").eq("id", chapter_id).maybeSingle();
      if (!c) throw new Error("Chapter not found");
      const { data: gt } = await sb.from("topics").select("id").eq("chapter_id", c.id).eq("name", "General").maybeSingle();
      if (!gt) throw new Error("No General topic in chapter");
      targetChapter = { id: c.id, name: c.name, general_topic_id: gt.id };
    } else {
      const { data: chapters } = await sb
        .from("topics")
        .select("id, chapter_id, chapters!inner(id,name)")
        .eq("name", "General");
      // Find one with pending questions
      for (const row of chapters ?? []) {
        const { count } = await sb.from("question_topics").select("question_id", { count: "exact", head: true }).eq("topic_id", row.id);
        if ((count ?? 0) > 0) {
          const chap: any = row.chapters;
          targetChapter = { id: chap.id, name: chap.name, general_topic_id: row.id };
          break;
        }
      }
      if (!targetChapter) return { done: true, message: "All chapters classified!" };
    }

    // Load available topics (exclude General)
    const { data: topics } = await sb
      .from("topics")
      .select("id, name")
      .eq("chapter_id", targetChapter.id)
      .neq("name", "General");
    if (!topics?.length) {
      return { skip: true, chapter: targetChapter.name, reason: "no specific topics" };
    }

    // Fetch batch of questions currently tagged only as General
    const { data: qtRows } = await sb
      .from("question_topics")
      .select("question_id")
      .eq("topic_id", targetChapter.general_topic_id)
      .limit(batch_size);
    if (!qtRows?.length) {
      return { chapter: targetChapter.name, processed: 0, moved: 0, fallback: 0, remaining_in_chapter: 0 };
    }

    const qIds = qtRows.map((r) => r.question_id);
    const { data: qs } = await sb.from("questions").select("id, question_text").in("id", qIds);
    const batch = (qs ?? []).map((q) => ({ id: q.id, text: stripHtml(q.question_text as string) }));

    const mapping = await classifyBatch(targetChapter.name, topics, batch);

    const topicByName = new Map(topics.map((t) => [t.name.toLowerCase(), t.id]));
    let moved = 0;
    let kept = 0;

    for (let i = 0; i < batch.length; i++) {
      const q = batch[i];
      const chosenName = (mapping[`Q${i + 1}`] || "").toString().trim();
      const topicId = topicByName.get(chosenName.toLowerCase());
      if (!topicId || chosenName.toLowerCase() === "general") {
        kept++;
        const fallbackId = topics[0].id;
        await sb.from("question_topics").insert({ question_id: q.id, topic_id: fallbackId }).select();
        await sb.from("question_topics").delete().eq("question_id", q.id).eq("topic_id", targetChapter.general_topic_id);
        continue;
      }
      await sb.from("question_topics").insert({ question_id: q.id, topic_id: topicId });
      await sb.from("question_topics").delete().eq("question_id", q.id).eq("topic_id", targetChapter.general_topic_id);
      moved++;
    }

    const { count: remaining } = await sb.from("question_topics").select("question_id", { count: "exact", head: true }).eq("topic_id", targetChapter.general_topic_id);

    return {
      chapter: targetChapter.name,
      chapter_id: targetChapter.id,
      processed: batch.length,
      moved,
      fallback: kept,
      remaining_in_chapter: remaining ?? 0,
    };
    }

    // Single batch path
    if (deadline === 0) {
      const r = await processBatch();
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Loop until deadline / done
    while (Date.now() < deadline) {
      const r = await processBatch();
      aggregate.batches++;
      if (r.done) { (aggregate as any).done = true; (aggregate as any).message = r.message; break; }
      if (r.skip) { aggregate.chapters.push(r); continue; }
      aggregate.processed += r.processed || 0;
      aggregate.moved += r.moved || 0;
      aggregate.fallback += r.fallback || 0;
      aggregate.chapters.push({ chapter: r.chapter, moved: r.moved, fallback: r.fallback, remaining: r.remaining_in_chapter });
    }
    return new Response(JSON.stringify(aggregate), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});