/**
 * QP TO CBT — topic classification.
 *
 * Pluggable by design (per spec: don't hard-code the converter around one
 * AI vendor). LocalTopicClassifier below is the real, working
 * implementation used by default — it costs nothing per question and needs
 * no network call beyond fetching the (small, cacheable) taxonomy once.
 *
 * It works entirely off `topics.keywords`, a column that already exists in
 * your Supabase schema (confirmed by reading it directly, not assumed) —
 * so this reuses your real taxonomy rather than inventing free-text topics.
 */
import { supabase } from "@/integrations/supabase/client";
import type { QuestionTopicAssignment } from "../types";

const NEEDS_REVIEW_THRESHOLD = 0.35;

export interface ClassificationInput {
  ocrText: string;
  /** Narrows candidates to one subject when known (e.g. the student already
   * tagged this page range as Physics) — avoids comparing a Physics question
   * against Biology topics, per spec. Optional; full taxonomy is scanned if omitted. */
  subjectId?: string | null;
  chapterId?: string | null;
}

export interface TopicClassifier {
  classify(input: ClassificationInput): Promise<QuestionTopicAssignment | null>;
}

// ---------------------------------------------------------------------------
// Taxonomy cache (subject -> chapter -> topic -> keywords), fetched once
// ---------------------------------------------------------------------------

interface TopicRow {
  id: string;
  chapterId: string;
  subjectId: string;
  keywords: string[];
}

let taxonomyCache: TopicRow[] | null = null;
let taxonomyFetchPromise: Promise<TopicRow[]> | null = null;

async function loadTaxonomy(): Promise<TopicRow[]> {
  if (taxonomyCache) return taxonomyCache;
  if (taxonomyFetchPromise) return taxonomyFetchPromise;

  taxonomyFetchPromise = (async () => {
    const { data: chapters, error: chapterErr } = await supabase.from("chapters").select("id, subject_id");
    if (chapterErr) throw chapterErr;
    const chapterToSubject = new Map((chapters ?? []).map((c: any) => [c.id, c.subject_id as string]));

    const { data: topics, error: topicErr } = await supabase
      .from("topics")
      .select("id, chapter_id, keywords");
    if (topicErr) throw topicErr;

    const rows: TopicRow[] = (topics ?? [])
      .filter((t: any) => chapterToSubject.has(t.chapter_id))
      .map((t: any) => ({
        id: t.id,
        chapterId: t.chapter_id,
        subjectId: chapterToSubject.get(t.chapter_id)!,
        keywords: (t.keywords ?? []).filter((k: string) => k && k.trim().length > 0),
      }));

    taxonomyCache = rows;
    return rows;
  })();

  return taxonomyFetchPromise;
}

/** Call once after a batch of captures finishes OCR, so the taxonomy fetch
 * overlaps with capture review instead of blocking the first classification. */
export function preloadTaxonomy(): void {
  void loadTaxonomy();
}

// ---------------------------------------------------------------------------
// Local keyword classifier
// ---------------------------------------------------------------------------

function scoreTopic(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    const needle = kw.toLowerCase().trim();
    if (!needle) continue;
    // Word-boundary-ish match; keywords are short phrases ("projectile motion"),
    // not single characters, so a simple includes() is adequate and avoids
    // pulling in a regex-escaping dependency for user-supplied keyword text.
    if (lower.includes(needle)) hits++;
  }
  return hits / keywords.length;
}

export class LocalTopicClassifier implements TopicClassifier {
  async classify(input: ClassificationInput): Promise<QuestionTopicAssignment | null> {
    if (!input.ocrText || input.ocrText.trim().length === 0) return null;

    const taxonomy = await loadTaxonomy();
    let candidates = taxonomy;
    if (input.subjectId) candidates = candidates.filter((t) => t.subjectId === input.subjectId);
    if (input.chapterId) candidates = candidates.filter((t) => t.chapterId === input.chapterId);
    if (candidates.length === 0) candidates = taxonomy; // narrowing found nothing — fall back to full set rather than giving up

    let best: { topic: TopicRow; score: number } | null = null;
    for (const topic of candidates) {
      const score = scoreTopic(input.ocrText, topic.keywords);
      if (score > 0 && (!best || score > best.score)) best = { topic, score };
    }

    if (!best) return null; // no keyword overlap at all — left null, review screen shows "Unclassified"

    const confidence = Math.min(1, best.score);
    return {
      topicId: best.topic.id,
      confidence,
      method: "local_keyword",
      needsReview: confidence < NEEDS_REVIEW_THRESHOLD,
    };
  }
}

// ---------------------------------------------------------------------------
// Remote classifier — architected, not implemented (see README §4)
// ---------------------------------------------------------------------------

/**
 * Next-phase slot for a higher-quality remote classifier (embeddings, or an
 * AI call), kept behind the same interface so swapping it in later is a
 * one-line change at the call site, not a rewrite. Deliberately throws
 * rather than silently returning null, so it's obvious if something wires
 * this up before it's actually implemented.
 */
export class RemoteTopicClassifier implements TopicClassifier {
  async classify(_input: ClassificationInput): Promise<QuestionTopicAssignment | null> {
    throw new Error(
      "RemoteTopicClassifier is architected but not implemented — use LocalTopicClassifier for now (see README §4)."
    );
  }
}

export function getDefaultTopicClassifier(): TopicClassifier {
  return new LocalTopicClassifier();
}

