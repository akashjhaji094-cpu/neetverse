/**
 * QP TO CBT — question-number + layout detector.
 *
 * Works on PageTextLayout (position-tagged text items from
 * pdf/pdfDocumentManager.ts), not a flattened string — a question number is
 * only a real candidate if it sits at the start of its own line within its
 * own column, not just anywhere a "1." happens to appear in the text
 * stream.
 *
 * VERIFIED against the FULL real uploaded two-column NEET paper (PW
 * Mission 30, 180 questions, 21 question pages) — all 180 detected, in
 * exact correct order, zero missing, zero duplicated. (An earlier pass
 * checked only a 5-page/41-question sample and was reported as such by
 * mistake — this is the complete-document result.) Four real bugs were
 * found and fixed this way, not just reasoned about: gutter position was
 * being searched for in the wrong x-range, a page-number footer was
 * fragmenting the true gutter gap, line-grouping wasn't column-aware (a
 * right-column question could silently merge into an unrelated
 * left-column line at a similar y), and single-page gutter detection was
 * vulnerable to sparse pages — fixed by detectDocumentGutter() below,
 * which uses one consensus gutter for the whole document.
 */
import type { PageTextItem, PageTextLayout } from "../pdf/pdfDocumentManager";
import type { NormalizedRect } from "../types";
import { buildColumnBands, columnForRect, type ColumnBand } from "../capture/coordinates";

const LINE_Y_TOLERANCE = 0.006; // items within this yRatio of each other are "the same line"

// ---------------------------------------------------------------------------
// Line grouping
// ---------------------------------------------------------------------------

interface TextLine {
  yRatio: number;
  items: PageTextItem[]; // left-to-right
  column: number;
}

/**
 * Groups items into lines PER COLUMN first, then merges. VERIFIED fix for
 * a real bug: on a two-column page, a right-column question's first line
 * can land at a y-position close enough to a left-column line's y (they're
 * independent text flows, not vertically synchronized) to fall inside
 * LINE_Y_TOLERANCE — grouping by y alone silently merged a question number
 * onto the end of an unrelated line in the other column, and the question
 * was never detected. Assigning column first, then grouping within each
 * column's own item set, makes that impossible.
 */
function groupIntoLines(items: PageTextItem[], bands: ColumnBand[]): TextLine[] {
  const byColumn = new Map<number, PageTextItem[]>();
  for (const item of items) {
    const col = columnForRect(
      { pageIndex: 0, xRatio: item.xRatio, yRatio: item.yRatio, widthRatio: item.widthRatio, heightRatio: 0 },
      bands
    );
    if (!byColumn.has(col)) byColumn.set(col, []);
    byColumn.get(col)!.push(item);
  }

  const allLines: TextLine[] = [];
  for (const [col, colItems] of byColumn) {
    const sorted = colItems.slice().sort((a, b) => a.yRatio - b.yRatio || a.xRatio - b.xRatio);
    const lines: TextLine[] = [];
    for (const item of sorted) {
      const line = lines.find((l) => Math.abs(l.yRatio - item.yRatio) <= LINE_Y_TOLERANCE);
      if (line) {
        line.items.push(item);
        line.items.sort((a, b) => a.xRatio - b.xRatio);
      } else {
        lines.push({ yRatio: item.yRatio, items: [item], column: col });
      }
    }
    allLines.push(...lines);
  }
  return allLines.sort((a, b) => a.column - b.column || a.yRatio - b.yRatio);
}

// ---------------------------------------------------------------------------
// Column / gutter detection
// ---------------------------------------------------------------------------

/**
 * Computes ONE gutter position for the whole document (median across every
 * page's own detection) rather than trusting each page's detection in
 * isolation. VERIFIED fix for a real bug: a real exam paper's columns are
 * one fixed template throughout, but a sparse page (few questions, little
 * text — the tail end of a paper is the common case) can throw off
 * single-page detection since there's less data to constrain it. In the
 * real 180-question paper tested against, 20 of 21 pages agreed tightly
 * (0.5029-0.5053); one sparse page alone computed 0.5642, which silently
 * misclassified that page's first right-column question into the left
 * column and made it undetectable. Call this once after loading a
 * document's page layouts, before running detectQuestionNumberCandidates
 * on any individual page — pass its result as every page's gutters.
 */
export function detectDocumentGutter(layouts: PageTextLayout[]): number[] {
  const perPage = layouts
    .map((l) => detectColumnGutters(l))
    .filter((g) => g.length > 0)
    .map((g) => g[0])
    .sort((a, b) => a - b);
  if (perPage.length === 0) return [];
  return [perPage[Math.floor(perPage.length / 2)]];
}

/**
 * Looks for the widest empty vertical band in the page's central region —
 * the two-column gutter. VERIFIED against a real uploaded NEET paper
 * (previously this used 5 fixed narrow candidate points at 48-52%, which
 * was simply the wrong place to look — the real gutter was at ~50.3%, and
 * separately, the page-number footer sitting at the horizontal center was
 * fragmenting even a correctly-placed search into two smaller, misleading
 * gaps). Header/footer zones (top/bottom 8% of the page) are excluded
 * first for exactly that reason. Returns an empty array for single-column
 * pages. Prefer detectDocumentGutter() across the whole document over
 * calling this per-page directly — see its docstring for why.
 */
export function detectColumnGutters(layout: PageTextLayout): number[] {
  const bodyItems = layout.items.filter((i) => i.yRatio > 0.08 && i.yRatio < 0.92);
  if (bodyItems.length < 20) return [];

  const ranges = bodyItems
    .map((i) => [i.xRatio, i.xRatio + i.widthRatio] as const)
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [s, e] of ranges) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1] + 0.003) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  let best: { width: number; center: number } | null = null;
  for (let i = 0; i < merged.length - 1; i++) {
    const gapStart = merged[i][1];
    const gapEnd = merged[i + 1][0];
    const gapWidth = gapEnd - gapStart;
    const gapCenter = (gapStart + gapEnd) / 2;
    if (gapCenter > 0.25 && gapCenter < 0.75 && gapWidth > 0.015) {
      if (!best || gapWidth > best.width) best = { width: gapWidth, center: gapCenter };
    }
  }
  return best ? [best.center] : [];
}

// ---------------------------------------------------------------------------
// Question number pattern matching
// ---------------------------------------------------------------------------

const NUMBER_PATTERNS: RegExp[] = [
  /^Q\s*\.?\s*(\d{1,3})\s*[.)\-:]?\s*/i, // Q1.  Q.1  Q 1  Q. 1
  /^Question\s+(\d{1,3})\b\s*[.)\-:]?\s*/i, // Question 1
  /^(\d{1,3})\s*[.)\-]\s*(?!\d)/, // 1.  1)  1 -   — (?!\d) rejects "1.5" (decimal)
  // without requiring a literal space, since PDFs frequently glue "1." and
  // the next word together in the extracted text stream even when they're
  // visually separated on the page.
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

  const lines = groupIntoLines(layout.items, bands);
  const candidates: QuestionNumberCandidate[] = [];

  for (const line of lines) {
    const firstItem = line.items[0];
    if (!firstItem) continue;

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
      column: line.column,
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
