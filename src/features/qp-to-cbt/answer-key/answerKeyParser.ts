/**
 * QP TO CBT — answer-key detection and solution-section rejection.
 *
 * This is the module the spec is most emphatic about, for good reason: a
 * naive "scan every N." and treat it as an answer" approach will silently
 * ingest detailed-solution paragraphs as if they were the answer key. The
 * approach here is deliberately NOT "find all number-then-letter matches
 * and trust them" — it's:
 *
 *   1. Find candidate (questionNumber, option) matches anywhere on the page.
 *   2. Measure the TEXT GAP between consecutive matches in reading order.
 *   3. Walk the matches in order; as long as gaps stay short and free of
 *      solution-language keywords, keep extending a "compact region."
 *      The moment a gap is long/prose-like, stop — everything after that
 *      point on this page is treated as solutions, not answers.
 *
 * Why gap length instead of "are the numbers sequential": multi-column
 * answer tables (e.g. "1 A | 46 C | 91 D | 136 B" on one line) jump
 * arithmetically between entries but stay textually ADJACENT — gap length
 * is robust to that; strict sequential-number scoring is not, and would
 * incorrectly penalize a perfectly valid table layout.
 *
 * This is flagged in the README as needing real-PDF tuning — the specific
 * thresholds below are principled starting points, not calibrated against
 * your actual answer-key sources yet.
 */
import type { PageTextLayout } from "../pdf/pdfDocumentManager";
import type { AnswerKeyEntry, AnswerOption, NormalizedRect } from "../types";

const SHORT_GAP_CHARS = 12; // gap text at or below this length is "compact"
const LONG_GAP_CHARS = 45; // gap text at or above this length is confidently "prose"
// Between SHORT and LONG we fall back to keyword scoring rather than length alone.

const SOLUTION_KEYWORDS = [
  "therefore",
  "because",
  "hence",
  "since",
  "option",
  "correct",
  "incorrect",
  "explanation",
  "solution",
  "we know",
  "given that",
  "according to",
  "formula",
  "substituting",
];

const ENTRY_REGEX = /\b(?:Q\.?\s*)?(\d{1,3})\s*(?:[-.):]|\s)\s*([A-D]|[1-4])(?![0-9])\b/gi;

interface LinearizedPage {
  text: string;
  /** char offset -> normalized (x, y) on the page, for recovering match positions. */
  offsetToPosition: Array<{ offset: number; xRatio: number; yRatio: number }>;
}

function linearizePage(layout: PageTextLayout): LinearizedPage {
  const sorted = layout.items.slice().sort((a, b) => a.yRatio - b.yRatio || a.xRatio - b.xRatio);
  let text = "";
  const offsetToPosition: LinearizedPage["offsetToPosition"] = [];
  let lastY: number | null = null;

  for (const item of sorted) {
    if (lastY !== null && Math.abs(item.yRatio - lastY) > 0.006) text += "\n";
    else if (text.length > 0 && !text.endsWith("\n")) text += " ";
    offsetToPosition.push({ offset: text.length, xRatio: item.xRatio, yRatio: item.yRatio });
    text += item.str;
    lastY = item.yRatio;
  }
  return { text, offsetToPosition };
}

function positionAtOffset(linearized: LinearizedPage, offset: number): { xRatio: number; yRatio: number } {
  let best = linearized.offsetToPosition[0] ?? { xRatio: 0, yRatio: 0 };
  for (const entry of linearized.offsetToPosition) {
    if (entry.offset > offset) break;
    best = entry;
  }
  return { xRatio: best.xRatio, yRatio: best.yRatio };
}

export function normalizeAnswerToken(token: string): AnswerOption | null {
  const upper = token.toUpperCase();
  if (upper === "A" || upper === "1") return 0;
  if (upper === "B" || upper === "2") return 1;
  if (upper === "C" || upper === "3") return 2;
  if (upper === "D" || upper === "4") return 3;
  return null;
}

interface RawMatch {
  questionNumber: number;
  option: AnswerOption;
  startOffset: number;
  endOffset: number;
  xRatio: number;
  yRatio: number;
}

function findRawMatches(linearized: LinearizedPage): RawMatch[] {
  const matches: RawMatch[] = [];
  let m: RegExpExecArray | null;
  ENTRY_REGEX.lastIndex = 0;
  while ((m = ENTRY_REGEX.exec(linearized.text)) !== null) {
    const option = normalizeAnswerToken(m[2]);
    const questionNumber = parseInt(m[1], 10);
    if (option === null || questionNumber <= 0 || questionNumber > 800) continue;
    const pos = positionAtOffset(linearized, m.index);
    matches.push({
      questionNumber,
      option,
      startOffset: m.index,
      endOffset: m.index + m[0].length,
      xRatio: pos.xRatio,
      yRatio: pos.yRatio,
    });
  }
  return matches;
}

function gapIsCompact(gapText: string): boolean {
  const trimmed = gapText.trim();
  if (trimmed.length <= SHORT_GAP_CHARS) return true;
  if (trimmed.length >= LONG_GAP_CHARS) return false;
  const lower = trimmed.toLowerCase();
  return !SOLUTION_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface AnswerKeyPageResult {
  pageIndex: number;
  entries: Array<{ questionNumber: number; option: AnswerOption; xRatio: number; yRatio: number }>;
  /** Normalized rect covering only the accepted compact region, for the manual-review UI to highlight. Null if nothing on this page passed. */
  acceptedRegion: NormalizedRect | null;
  rejectedSolutionStartYRatio: number | null;
}

/**
 * Runs the detect -> gap-score -> boundary-walk pipeline on one page.
 * Returns only the entries before the first "prose" boundary — everything
 * after is solutions and is deliberately dropped from the answer key, not
 * just down-weighted, per the spec's "stop answer-key extraction at the end
 * of the compact answer region" requirement.
 */
export function detectAnswerKeyOnPage(layout: PageTextLayout): AnswerKeyPageResult {
  if (!layout.hasTextLayer) {
    return { pageIndex: layout.pageIndex, entries: [], acceptedRegion: null, rejectedSolutionStartYRatio: null };
  }

  const linearized = linearizePage(layout);
  const raw = findRawMatches(linearized);

  const accepted: RawMatch[] = [];
  let solutionBoundaryOffset: number | null = null;

  for (let i = 0; i < raw.length; i++) {
    const current = raw[i];
    const next = raw[i + 1];
    accepted.push(current);
    if (!next) break;

    const gapText = linearized.text.slice(current.endOffset, next.startOffset);
    if (!gapIsCompact(gapText)) {
      solutionBoundaryOffset = current.endOffset;
      break; // stop here — do not include `next` or anything after it from this page
    }
  }

  // A single isolated match with nothing else compact nearby is more likely
  // noise (an incidental "2 A" inside prose) than a real one-question answer
  // key — require at least 2 entries in an accepted run before trusting it.
  const entries =
    accepted.length >= 2
      ? accepted.map((m) => ({ questionNumber: m.questionNumber, option: m.option, xRatio: m.xRatio, yRatio: m.yRatio }))
      : [];

  const acceptedRegion: NormalizedRect | null =
    entries.length > 0
      ? {
          pageIndex: layout.pageIndex,
          xRatio: 0,
          yRatio: Math.max(0, Math.min(...accepted.map((m) => m.yRatio)) - 0.01),
          widthRatio: 1,
          heightRatio: Math.min(1, Math.max(...accepted.map((m) => m.yRatio)) + 0.02),
        }
      : null;

  const rejectedSolutionStartYRatio =
    solutionBoundaryOffset !== null ? positionAtOffset(linearized, solutionBoundaryOffset).yRatio : null;

  return { pageIndex: layout.pageIndex, entries, acceptedRegion, rejectedSolutionStartYRatio };
}

// ---------------------------------------------------------------------------
// Multi-page aggregation + manual-region override
// ---------------------------------------------------------------------------

export interface AnswerKeyParseOptions {
  /** From "Select Answer Key Region Manually" — when provided, ONLY these
   * regions are parsed and the automatic per-page detection above is
   * skipped entirely for pages they cover. This is the reliable fallback
   * path the spec requires for when auto-detection gets it wrong. */
  manualRegions?: NormalizedRect[];
}

export function parseAnswerKeyFromPages(
  layouts: PageTextLayout[],
  options: AnswerKeyParseOptions = {}
): { entries: AnswerKeyEntry[]; regionsUsed: NormalizedRect[] } {
  const byQuestionNumber = new Map<number, { option: AnswerOption; confidence: number }[]>();
  const regionsUsed: NormalizedRect[] = [];

  const pagesToScan =
    options.manualRegions && options.manualRegions.length > 0
      ? layouts.filter((l) => options.manualRegions!.some((r) => r.pageIndex === l.pageIndex))
      : layouts;

  for (const layout of pagesToScan) {
    const manualRectsForPage = options.manualRegions?.filter((r) => r.pageIndex === layout.pageIndex);
    const restrictedLayout =
      manualRectsForPage && manualRectsForPage.length > 0
        ? { ...layout, items: layout.items.filter((item) => manualRectsForPage.some((r) => withinRect(item, r))) }
        : layout;

    const result = detectAnswerKeyOnPage(restrictedLayout);
    if (result.acceptedRegion) regionsUsed.push(result.acceptedRegion);
    for (const entry of result.entries) {
      const list = byQuestionNumber.get(entry.questionNumber) ?? [];
      list.push({ option: entry.option, confidence: 0.85 });
      byQuestionNumber.set(entry.questionNumber, list);
    }
  }

  const entries: AnswerKeyEntry[] = [];
  for (const [questionNumber, candidates] of byQuestionNumber) {
    const distinctOptions = Array.from(new Set(candidates.map((c) => c.option)));
    entries.push({
      id: crypto.randomUUID(),
      localTestId: "", // filled in by the caller once the LocalPdfTest id is known
      questionNumber,
      option: distinctOptions.length === 1 ? distinctOptions[0] : null,
      source: "auto_detected",
      confidence: distinctOptions.length === 1 ? candidates[0].confidence : null,
      conflictingOptions: distinctOptions.length > 1 ? distinctOptions : null,
    });
  }

  return { entries: entries.sort((a, b) => a.questionNumber - b.questionNumber), regionsUsed };
}

function withinRect(item: { xRatio: number; yRatio: number }, rect: NormalizedRect): boolean {
  return (
    item.xRatio >= rect.xRatio &&
    item.xRatio <= rect.xRatio + rect.widthRatio &&
    item.yRatio >= rect.yRatio &&
    item.yRatio <= rect.yRatio + rect.heightRatio
  );
}

// ---------------------------------------------------------------------------
// Review-screen summary metrics
// ---------------------------------------------------------------------------

export interface AnswerKeyReviewSummary {
  questionsCaptured: number;
  answersDetected: number;
  missingAnswers: number;
  potentialConflicts: number;
  warnings: string[];
}

export function summarizeAnswerKeyReview(
  capturedQuestionNumbers: number[],
  entries: AnswerKeyEntry[]
): AnswerKeyReviewSummary {
  const entryByNumber = new Map(entries.map((e) => [e.questionNumber, e]));
  const warnings: string[] = [];
  let answersDetected = 0;
  let missingAnswers = 0;
  let potentialConflicts = 0;

  for (const qn of capturedQuestionNumbers) {
    const entry = entryByNumber.get(qn);
    if (!entry || entry.option === null) {
      missingAnswers++;
      if (!entry) warnings.push(`Q${qn} exists but has no answer`);
      else warnings.push(`Answer not detected for Q${qn}`);
    } else {
      answersDetected++;
    }
    if (entry?.conflictingOptions?.length) {
      potentialConflicts++;
      warnings.push(`Multiple answers detected for Q${qn}`);
    }
  }

  const capturedSet = new Set(capturedQuestionNumbers);
  for (const entry of entries) {
    if (!capturedSet.has(entry.questionNumber)) {
      warnings.push(`Answer key contains Q${entry.questionNumber} but no Question ${entry.questionNumber} capture exists`);
    }
  }

  return {
    questionsCaptured: capturedQuestionNumbers.length,
    answersDetected,
    missingAnswers,
    potentialConflicts,
    warnings,
  };
        }

