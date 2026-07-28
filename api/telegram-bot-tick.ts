// api/telegram-bot-tick.ts — Vercel serverless function.
// Called by every visitor's browser (throttled, harmless) AND does the
// actual posting. Safe because only ONE caller can ever "win" the atomic
// claim below even if 50 people load the site in the same second.
//
// Uses the SAME public/anon Supabase key your whole app already uses
// (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY) — no separate
// service-role key needed, since you manage Supabase only through Lovable
// and don't have a way to find that key. Zero new npm packages either —
// @supabase/supabase-js is already in this project, and Telegram's Bot API
// is called with plain fetch() (built into the Vercel Node runtime).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "";
const NEETVERSE_URL = process.env.NEETVERSE_URL || "https://neetverse.site";

function stripHtml(s: string): string {
  return String(s || "").replace(/<[^>]*>/g, "").trim();
}

// ---- Lightweight LaTeX -> Unicode ----
const SUP: Record<string, string> = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻","n":"ⁿ" };
const SUB: Record<string, string> = { "0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉","+":"₊","-":"₋" };
const SYM: Record<string, string> = { "\\rightarrow":"→","\\to":"→","\\times":"×","\\div":"÷","\\pm":"±","\\degree":"°","\\circ":"°","\\alpha":"α","\\beta":"β","\\gamma":"γ","\\delta":"δ","\\Delta":"Δ","\\lambda":"λ","\\mu":"μ","\\pi":"π","\\theta":"θ","\\infty":"∞","\\leq":"≤","\\geq":"≥","\\neq":"≠","\\cdot":"·","\\sqrt":"√" };

function mathToUnicode(text: string): string {
  let out = stripHtml(text).replace(/\$\$?|\\/g, "");
  out = out.replace(/\^{([^}]+)}/g, (_, g) => [...g].map((c: string) => SUP[c] ?? c).join(""));
  out = out.replace(/\^(\S)/g, (_, c) => SUP[c] ?? c);
  out = out.replace(/_{([^}]+)}/g, (_, g) => [...g].map((c: string) => SUB[c] ?? c).join(""));
  out = out.replace(/_(\S)/g, (_, c) => SUB[c] ?? c);
  for (const [tex, sym] of Object.entries(SYM)) out = out.split(tex).join(sym);
  out = out.replace(/\\[a-zA-Z]+/g, "");
  return out.trim();
}

// ---- Telegram Bot API — raw HTTPS calls, no SDK ----
async function tgCall(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(json)}`);
  return json.result;
}
const sendText = (html: string) => tgCall("sendMessage", { chat_id: CHANNEL_ID, text: html, parse_mode: "HTML" });
const sendPhotoWithCaption = (photoUrl: string, caption: string) =>
  tgCall("sendPhoto", { chat_id: CHANNEL_ID, photo: photoUrl, caption: caption.slice(0, 1024), parse_mode: "HTML" });
const sendQuizPoll = (question: string, options: string[], correctIndex: number, explanation?: string) =>
  tgCall("sendPoll", {
    chat_id: CHANNEL_ID, question: question.slice(0, 300), options,
    type: "quiz", correct_option_id: correctIndex, is_anonymous: true,
    ...(explanation ? { explanation: explanation.slice(0, 190) } : {}),
  });

// ---- Combinatorial promo templates — Hinglish + English mix ----
const HOOKS = [
  "NEET 2027 ki taiyari mein ek din bhi waste nahi karna chahiye.",
  "Har din jo practice ke bina jaata hai, ek mauka kam hota hai.",
  "Toppers roz practice karte hain. Aaj tera din hai.",
  "Ek chhota sa daily habit, bada result deta hai.",
  "Kya tumhe pata hai tumhara sabse weak chapter kaunsa hai?",
  "Aaj ka mock test tumhara real level dikha dega.",
  "34,000+ questions mein se tumne kitne try kiye hain?",
  "National leaderboard pe tera rank kya hai abhi?",
  "Jo students roz practice kar rahe hain, wo aage nikal rahe hain.",
  "Weekly leaderboard update ho chuka hai. Apna naam dekh liya?",
];
const BENEFITS = [
  "AI Doubt Solver se instant explanation milta hai har question ka.",
  "Weak Chapter Radar batata hai exactly kahan marks kho rahe ho.",
  "Full NEET-pattern mock tests — 180Q, +4/−1 marking, real exam jaisa.",
  "PYQs chapter-wise organized — jo chahiye wahi practice karo.",
  "National leaderboard pe real-time apna rank dekho.",
];
const CTAS = ["Abhi practice shuru karo", "Free mock test do", "Apna weak chapter check karo", "Leaderboard pe apna rank dekho"];
const EMOJIS = ["🎯", "📚", "🧠", "⚡", "🔥", "📈"];
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function generatePromoText(): string {
  const hook = pick(HOOKS), benefit = pick(BENEFITS), cta = pick(CTAS), emoji = pick(EMOJIS);
  return pick([
    `${emoji} ${hook}\n\n${benefit}\n\n👉 <b>${cta}:</b> ${NEETVERSE_URL}`,
    `${emoji} ${hook}\n\n👉 ${cta} — ${NEETVERSE_URL}`,
    `<b>${cta}</b> ${emoji}\n\n${hook}\n\n${NEETVERSE_URL}`,
  ]);
}

export default async function handler(req: any, res: any) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !BOT_TOKEN || !CHANNEL_ID) {
    return res.status(200).json({
      skipped: true,
      reason: "not_configured",
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: settings } = await supabase.from("telegram_bot_settings").select("*").eq("id", true).maybeSingle();
  
  // Directly return the settings object for testing/debugging
  return res.status(200).json(settings);

  if (!settings || !settings.is_active) {
    return res.status(200).json({ skipped: true, reason: "inactive" });
  }

  const result: Record<string, boolean> = { questionPosted: false, promotionPosted: false };

  // ---- QUESTION job ----
  const qJitterMs = (settings.question_interval_minutes + (Math.random() * 30 - 15)) * 60_000;
  const { data: claimedQ } = await supabase
    .from("telegram_bot_settings")
    .update({ next_question_due_at: new Date(now.getTime() + qJitterMs).toISOString(), updated_at: nowIso })
    .eq("id", true).eq("is_active", true).lte("next_question_due_at", nowIso)
    .select().maybeSingle();

  if (claimedQ) {
    try {
      const cooldownIso = new Date(now.getTime() - 60 * 86400_000).toISOString();
      const { data: recentlyPosted } = await supabase.from("telegram_posted_questions").select("question_id").gte("posted_at", cooldownIso);
      const excludeIds = (recentlyPosted || []).map((r: any) => r.question_id);

      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true });  
      const poolSize = Math.max(1, (count || 1) - excludeIds.length);  
      const offset = Math.floor(Math.random() * poolSize);  

      let q = supabase.from("questions")  
        .select(`id, question_text, options, correct_option_index, explanation, images, chapters(name), subjects(name)`)  
        .range(offset, offset);  
      if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);  
      const { data: rows } = await q;  
      let row: any = rows?.[0];  

      if (!row) {  
        const { data: fb } = await supabase.from("telegram_posted_questions").select("question_id").order("posted_at", { ascending: true }).limit(1);  
        if (fb?.[0]) {  
          const { data: fbQ } = await supabase.from("questions")  
            .select(`id, question_text, options, correct_option_index, explanation, images, chapters(name), subjects(name)`)  
            .eq("id", fb[0].question_id).maybeSingle();  
          row = fbQ;  
        }  
      }  

      if (row) {  
        const questionText = mathToUnicode(row.question_text);  
        const options = (row.options || []).map((o: string) => mathToUnicode(o));  
        const tag = [row.subjects?.name, row.chapters?.name].filter(Boolean).join(" • ");  
        const hasImage = row.images && row.images.length > 0;  
        const optionsShort = options.every((o: string) => o.length <= 100);  

        if (!hasImage && optionsShort) {  
          await sendQuizPoll(questionText, options, row.correct_option_index, row.explanation ? mathToUnicode(row.explanation) : undefined);  
        } else if (hasImage) {  
          await sendPhotoWithCaption(row.images[0], `🧠 <b>NEETVerse Daily Question</b>${tag ? `\n<i>${tag}</i>` : ""}\n\n${questionText}`);  
          const optMsg = options.map((o: string, i: number) => `🔘 <b>${String.fromCharCode(65 + i)}.</b> ${o}`).join("\n");  
          await sendText(`${optMsg}\n\n🔥 Practice full CBT on:\n${NEETVERSE_URL}`);  
        } else {  
          const optMsg = options.map((o: string, i: number) => `🔘 <b>${String.fromCharCode(65 + i)}.</b> ${o}`).join("\n");  
          await sendText(`🧠 <b>NEETVerse Daily Question</b>${tag ? `\n<i>${tag}</i>` : ""}\n\n${questionText}\n\n${optMsg}\n\n🔥 Practice full CBT on:\n${NEETVERSE_URL}`);  
        }  

        await supabase.from("telegram_posted_questions").insert({ question_id: row.id });  
        await supabase.from("telegram_post_log").insert({ type: "question", status: "success", detail: row.id });  
        result.questionPosted = true;  
      }  
    } catch (err: any) {  
      await supabase.from("telegram_post_log").insert({ type: "question", status: "failed", detail: String(err?.message || err) });  
    }
  }

  // ---- PROMOTION job ----
  const pJitterMs = (settings.promotion_interval_minutes + (Math.random() * 40 - 20)) * 60_000;
  const { data: claimedP } = await supabase
    .from("telegram_bot_settings")
    .update({ next_promotion_due_at: new Date(now.getTime() + pJitterMs).toISOString(), updated_at: nowIso })
    .eq("id", true).eq("is_active", true).lte("next_promotion_due_at", nowIso)
    .select().maybeSingle();

  if (claimedP) {
    try {
      await sendText(generatePromoText());
      await supabase.from("telegram_post_log").insert({ type: "promotion", status: "success" });
      result.promotionPosted = true;
    } catch (err: any) {
      await supabase.from("telegram_post_log").insert({ type: "promotion", status: "failed", detail: String(err?.message || err) });
    }
  }

  return res.status(200).json(result);
  }
