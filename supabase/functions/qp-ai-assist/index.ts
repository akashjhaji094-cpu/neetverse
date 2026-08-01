// QP TO CBT — AI assistant.
// Modes:
//  - "answer_key": raw answer-key text -> [{questionNumber, option}]
//  - "detect_questions": a rendered page image -> question regions (ratios)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

async function callAI(messages: unknown[]) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`AI gateway ${res.status}: ${body}`), { status: res.status });
  }
  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { mode, text, imageBase64 } = await req.json();

    let result: unknown = [];

    if (mode === "answer_key") {
      result = await callAI([
        {
          role: "system",
          content:
            "You extract answer keys from exam PDFs. Return ONLY a JSON array of " +
            '{"questionNumber": number, "option": 0|1|2|3} where 0=A/1, 1=B/2, 2=C/3, 3=D/4. ' +
            "Ignore anything that is not an answer key. No prose, no markdown.",
        },
        { role: "user", content: String(text ?? "").slice(0, 120000) },
      ]);
    } else if (mode === "detect_questions") {
      result = await callAI([
        {
          role: "system",
          content:
            "You look at one page of a printed exam question paper and locate each numbered question. " +
            'Return ONLY a JSON array of {"questionNumber": number, "x": number, "y": number, "width": number, "height": number} ' +
            "where x/y/width/height are fractions of the page (0..1) tightly bounding the full question including its options. " +
            "Handle two-column layouts. If the page has no questions return []. No prose, no markdown.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Locate every question on this page." },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ]);
    } else {
      return new Response(JSON.stringify({ error: "Unknown mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    console.error("qp-ai-assist failed:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message ?? err) }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});