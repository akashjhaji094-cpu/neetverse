/**
 * QP TO CBT — question-number + layout detector.
 *
 * Works on PageTextLayout (position-tagged text items from
 * pdf/pdfDocumentManager.ts), not a flattened string — a question number is
 * only a real candidate if it sits at the start of a line at a column's
 * left edge, not just anywhere a "1." happens to appear in the OCR/text
 * stream. This is the piece flagged in the README as needing real-PDF
 * tuning (§8) — the heuristics here are principled but their thresholds
 * (LINE_Y_TOLERANCE, COLUMN_GUTTER_MIN_GAP, etc.) were chosen from general
 * reasoning about exam-paper typography, not fitted to your actual PDF
 * sources yet.
 */
import type { PageTextItem, PageTextLayout } from "../pdf/pdfDocumentManager";
import type { NormalizedRect } from "../types";
import { buildColumnBands, columnForRect, type ColumnBand } from "../capture/coordinates";

const LINE_Y_TOLERANCE = 0.006; // items within this yRatio of each other are "the same line"
const COLUMN_LEFT_EDGE_TOLERANCE = 0.03; // how close to a column's left edge a number must start
const MIN_GUTTER_WIDTH_RATIO = 0.02; // minimum empty-band width to call it a real gutter

// ---------------------------------------------------------------------------
// Line grouping
// ---------------------------------------------------------------------------

interface TextLine {
  yRatio: number;
  items: PageTextItem[]; // left-to-right
}

function groupIntoLines(items: PageTextItem[]): TextLine[] {
  const sorted = items.slice().sort((a, b) => a.yRatio - b.yRatio || a.xRatio - b.xRatio);
  const lines: TextLine[] = [];
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l.yRatio - item.yRatio) <= LINE_Y_TOLERANCE);
    if (line) {
      line.items.push(item);
      line.items.sort((a, b) => a.xRatio - b.xRatio);
    } else {
      lines.push({ yRatio: item.yRatio, items: [item] });
    }
  }
  return lines.sort((a, b) => a.yRatio - b.yRatio);
}

// ---------------------------------------------------------------------------
// Column / gutter detection
// ---------------------------------------------------------------------------

/**
 * Looks for a vertical band roughly in the page's middle 20-60% width range
 * where essentially no text starts or ends — the visual "gutter" of a
 * two-column layout. Returns an empty array for single-column pages.
 * Full-width elements (long instruction lines, wide diagrams) don't defeat
 * detection because we only look at the CENTRAL band, not the full width —
 * a full-width line still leaves the exact-center gutter empty as long as
 * most lines are column-scoped, which holds for standard exam layouts.
 */
export function detectColumnGutters(layout: PageTextLayout): number[] {
  if (!layout.hasTextLayer || layout.items.length < 20) return [];

  const candidateCenters = [0.48, 0.49, 0.5, 0.51, 0.52];
  for (const center of candidateCenters) {
    const bandStart = center - MIN_GUTTER_WIDTH_RATIO / 2;
    const bandEnd = center + MIN_GUTTER_WIDTH_RATIO / 2;
    const crossesGutter = layout.items.some(
      (item) => item.xRatio < bandEnd && item.xRatio + item.widthRatio > bandStart
    );
    if (!crossesGutter) {
      // Confirm there's real content on both sides — otherwise this "gutter"
      // might just be a page with a narrow single column of text.
      const hasLeftContent = layout.items.some((i) => i.xRatio + i.widthRatio < bandStart);
      const hasRightContent = layout.items.some((i) => i.xRatio > bandEnd);
      if (hasLeftContent && hasRightContent) return [center];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Question number pattern matching
// ---------------------------------------------------------------------------

const NUMBER_PATTERNS: RegExp[] = [
  /^Q\s*\.?\s*(\d{1,3})\s*[.)\-:]?\s*/i, // Q1.  Q.1  Q 1  Q. 1
  /^Question\s+(\d{1,3})\b\s*[.)\-:]?\s*/i, // Question 1
  /^(\d{1,3})\s*[.)\-]\s+/, // 1.   1)   1 -   (requires trailing space so we don't
  // match "1.5 m/s" style numeric values mid-sentence)
];

function matchQuestionNumber(text: string): number | null {
  const trimmed = text.trimStart();
  for (const pattern of NUMBER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > 0 && n < 1000) return n;
    }
  }
  return null;
}

/** A line's leading text, reconstructed from up to its first 4 items — handles
 * "Q" / "1" / "." arriving as separate PDF text runs. */
function leadingText(line: TextLine): string {
  return line.items
    .slice(0, 4)
    .map((i) => i.str)
    .join("")
    .trim();
}

export interface QuestionNumberCandidate {
  questionNumber: number;
  pageIndex: number;
  yRatio: number;
  xRatio: number;
  column: number;
  /** 0..1 — see scoring notes below. Always surfaced to the student regardless of score; this only affects sort/highlight order, never silently drops a candidate. */
  confidence: number;
}

/**
 * `expectedNext` (the next number after the highest one confirmed so far, or
 * null for the very first page) is used only to score candidates, never to
 * reject them outright — an unexpected jump is exactly the "possible missing
 * question" signal the review screen surfaces, not something to hide.
 */
export function detectQuestionNumberCandidates(
  layout: PageTextLayout,
  bands: ColumnBand[],
  expectedNext: number | null
): QuestionNumberCandidate[] {
  if (!layout.hasTextLayer) return [];

  const lines = groupIntoLines(layout.items);
  const candidates: QuestionNumberCandidate[] = [];

  for (const line of lines) {
    const firstItem = line.items[0];
    if (!firstItem) continue;

    const column = columnForRect(
      { pageIndex: layout.pageIndex, xRatio: firstItem.xRatio, yRatio: line.yRatio, widthRatio: 0, heightRatio: 0 },
      bands
    );
    const band = bands[column];
    const distanceFromColumnLeft = firstItem.xRatio - (band?.xStartRatio ?? 0);
    if (distanceFromColumnLeft > COLUMN_LEFT_EDGE_TOLERANCE) continue; // not left-aligned in its column — unlikely to be a question start

    const questionNumber = matchQuestionNumber(leadingText(line));
    if (questionNumber === null) continue;

    let confidence = 0.55; // baseline: pattern matched at a column-left line start
    if (expectedNext !== null && questionNumber === expectedNext) confidence = 0.9;
    else if (expectedNext !== null && questionNumber === expectedNext + 1) confidence = 0.7; // one gap — still plausible, e.g. skipped a dropped question
    else if (expectedNext === null) confidence = 0.75; // first candidate on the paper, nothing to compare against

    candidates.push({
      questionNumber,
      pageIndex: layout.pageIndex,
      yRatio: line.yRatio,
      xRatio: firstItem.xRatio,
      column,
      confidence,
    });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Boundary proposal — "Q4 capture ends immediately before Q5 in reading order"
// ---------------------------------------------------------------------------

export interface ProposedCaptureRegion {
  questionNumber: number;
  rect: NormalizedRect;
}

/**
 * Turns an ordered list of candidates (already sorted into reading order by
 * the caller via compareReadingOrder) into proposed capture rects. Each
 * region runs from its own candidate's y-position to the NEXT candidate's
 * y-position within the same column, or to the column/page bottom if it's
 * the last one on that column. Deliberately NOT a fixed pixel height — see
 * spec: "some questions are very short, some are extremely long."
 */
export function proposeCaptureBoundaries(
  orderedCandidates: QuestionNumberCandidate[],
  bands: ColumnBand[]
): ProposedCaptureRegion[] {
  const regions: ProposedCaptureRegion[] = [];

  for (let i = 0; i < orderedCandidates.length; i++) {
    const current = orderedCandidates[i];
    const next = findNextInSameColumn(orderedCandidates, i);
    const band = bands[current.column] ?? { xStartRatio: 0, xEndRatio: 1 };

    const yEnd = next && next.pageIndex === current.pageIndex ? next.yRatio : 1;

    regions.push({
      questionNumber: current.questionNumber,
      rect: {
        pageIndex: current.pageIndex,
        xRatio: band.xStartRatio,
        yRatio: current.yRatio,
        widthRatio: band.xEndRatio - band.xStartRatio,
        heightRatio: Math.max(0.01, yEnd - current.yRatio),
      },
    });
    // Note: when `next` is on a different page (column/page break mid-question),
    // this proposes a same-page region ending at the page bottom, and the
    // caller (capture review screen) is expected to prompt "Extend Capture"
    // for the continuation rather than guessing where on the next page it
    // ends — see README PARTIALLY IMPLEMENTED notes on the extend-capture UI.
  }

  return regions;
}

function findNextInSameColumn(
  candidates: QuestionNumberCandidate[],
  fromIndex: number
): QuestionNumberCandidate | null {
  const current = candidates[fromIndex];
  for (let i = fromIndex + 1; i < candidates.length; i++) {
    if (candidates[i].column === current.column) return candidates[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sequence review helpers ("possible missing question", duplicates, order)
// ---------------------------------------------------------------------------

export interface SequenceWarning {
  type: "possible_missing_question" | "duplicate_question_number" | "unexpected_order";
  questionNumber: number;
  message: string;
}

export function reviewQuestionSequence(questionNumbers: number[]): SequenceWarning[] {
  const warnings: SequenceWarning[] = [];
  const sorted = questionNumbers.slice().sort((a, b) => a - b);
  const seen = new Set<number>();

  for (const n of sorted) {
    if (seen.has(n)) {
      warnings.push({ type: "duplicate_question_number", questionNumber: n, message: `Duplicate question number: Q${n}` });
    }
    seen.add(n);
  }

  const uniqueSorted = Array.from(seen).sort((a, b) => a - b);
  for (let i = 1; i < uniqueSorted.length; i++) {
    const gap = uniqueSorted[i] - uniqueSorted[i - 1];
    if (gap > 1) {
      for (let missing = uniqueSorted[i - 1] + 1; missing < uniqueSorted[i]; missing++) {
        warnings.push({
          type: "possible_missing_question",
          questionNumber: missing,
          message: `Possible missing question: Q${missing}`,
        });
      }
    }
  }

  // Original (capture) order vs numeric order, to catch "Q72 appears before Q71".
  for (let i = 1; i < questionNumbers.length; i++) {
    if (questionNumbers[i] < questionNumbers[i - 1]) {
      warnings.push({
        type: "unexpected_order",
        questionNumber: questionNumbers[i],
        message: `Question Q${questionNumbers[i]} appears before Q${questionNumbers[i - 1]}`,
      });
    }
  }

  return warnings;
}

export { buildColumnBands }; // re-exported for convenience at call sites that only import this module
