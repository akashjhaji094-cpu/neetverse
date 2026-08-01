/**
 * QP TO CBT — AI assist client. Talks to the `qp-ai-assist` edge function.
 * Used as a fallback/booster when the deterministic detectors under-perform
 * (scanned papers, unusual layouts, image-only answer keys).
 */
import { supabase } from "@/integrations/supabase/client";
import type { AnswerKeyEntry, AnswerOption, NormalizedRect } from "@/features/qp-to-cbt/types";

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("qp-ai-assist", { body });
  if (error) throw error;
  return (data as { result?: unknown })?.result ?? [];
}

export interface AiQuestionRegion {
  questionNumber: number;
  rect: NormalizedRect;
}

/** Detect question regions on one rendered page image. */
export async function aiDetectQuestionsOnPage(
  canvas: HTMLCanvasElement,
  pageIndex: number
): Promise<AiQuestionRegion[]> {
  const imageBase64 = canvas.toDataURL("image/jpeg", 0.7);
  const raw = (await invoke({ mode: "detect_questions", imageBase64 })) as Array<Record<string, number>>;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => Number.isFinite(r?.questionNumber))
    .map((r) => ({
      questionNumber: Math.round(r.questionNumber),
      rect: {
        pageIndex,
        xRatio: clamp(r.x),
        yRatio: clamp(r.y),
        widthRatio: clamp(r.width),
        heightRatio: clamp(r.height),
      } as NormalizedRect,
    }))
    .filter((r) => r.rect.widthRatio > 0.02 && r.rect.heightRatio > 0.01);
}

/** Parse an answer key out of raw page text. */
export async function aiParseAnswerKey(text: string, localTestId: string): Promise<AnswerKeyEntry[]> {
  const raw = (await invoke({ mode: "answer_key", text })) as Array<Record<string, number>>;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => Number.isFinite(r?.questionNumber) && [0, 1, 2, 3].includes(r?.option))
    .map((r) => ({
      id: crypto.randomUUID(),
      localTestId,
      questionNumber: Math.round(r.questionNumber),
      option: r.option as AnswerOption,
      source: "auto_detected" as const,
      confidence: 0.8,
      conflictingOptions: null,
    }));
}

function clamp(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}