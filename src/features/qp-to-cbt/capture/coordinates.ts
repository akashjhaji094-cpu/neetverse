/**
 * QP TO CBT — capture coordinate utilities.
 *
 * Pure functions only (no DOM/canvas access) so they're trivially unit
 * testable and reusable between the pointer-driven capture editor and the
 * auto-detector. Everything downstream of "PDF page rendered onto a canvas"
 * boils down to rectangle math against a known page pixel size, so that's
 * the only DOM-adjacent input these functions take (as plain numbers, not
 * elements).
 */
import type { NormalizedRect } from "../types";

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageSize {
  pageIndex: number;
  width: number; // pixels, at whatever scale the rect was drawn at
  height: number;
}

// ---------------------------------------------------------------------------
// Pixel <-> normalized conversion
// ---------------------------------------------------------------------------

export function pixelToNormalizedRect(pixel: PixelRect, page: PageSize): NormalizedRect {
  return {
    pageIndex: page.pageIndex,
    xRatio: clamp01(pixel.x / page.width),
    yRatio: clamp01(pixel.y / page.height),
    widthRatio: clamp01(pixel.width / page.width),
    heightRatio: clamp01(pixel.height / page.height),
  };
}

export function normalizedToPixelRect(rect: NormalizedRect, page: PageSize): PixelRect {
  return {
    x: rect.xRatio * page.width,
    y: rect.yRatio * page.height,
    width: rect.widthRatio * page.width,
    height: rect.heightRatio * page.height,
  };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ---------------------------------------------------------------------------
// Drag-to-draw / resize / move, expressed as pure reducers over PixelRect
// ---------------------------------------------------------------------------

export type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

/** Build a rect from two arbitrary drag points, normalizing negative width/height. */
export function rectFromDragPoints(start: { x: number; y: number }, current: { x: number; y: number }): PixelRect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

/** Applies a resize-handle drag, keeping the opposite edge/corner fixed. Clamps to the page bounds. */
export function resizeRect(rect: PixelRect, handle: ResizeHandle, dx: number, dy: number, page: PageSize): PixelRect {
  let { x, y, width, height } = rect;

  if (handle.includes("e")) width = clamp(width + dx, 4, page.width - x);
  if (handle.includes("s")) height = clamp(height + dy, 4, page.height - y);
  if (handle.includes("w")) {
    const newX = clamp(x + dx, 0, x + width - 4);
    width += x - newX;
    x = newX;
  }
  if (handle.includes("n")) {
    const newY = clamp(y + dy, 0, y + height - 4);
    height += y - newY;
    y = newY;
  }

  return { x, y, width, height };
}

/** Moves a rect by (dx, dy), clamped so it never leaves the page. */
export function moveRect(rect: PixelRect, dx: number, dy: number, page: PageSize): PixelRect {
  const x = clamp(rect.x + dx, 0, Math.max(0, page.width - rect.width));
  const y = clamp(rect.y + dy, 0, Math.max(0, page.height - rect.height));
  return { ...rect, x, y };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ---------------------------------------------------------------------------
// Question numbering defaults
// ---------------------------------------------------------------------------

/**
 * "Existing last question = Q38 → next manual capture defaults to Q39."
 * Falls back to 1 for the first capture in a test. Skips over gaps
 * intentionally — if the student already fixed a numbering gap, re-suggesting
 * the gap number here would fight that decision, so we always suggest
 * max+1, never "the missing number."
 */
export function nextDefaultQuestionNumber(existingNumbers: number[]): number {
  if (existingNumbers.length === 0) return 1;
  return Math.max(...existingNumbers) + 1;
}

// ---------------------------------------------------------------------------
// Segment ordering
// ---------------------------------------------------------------------------

export interface OrderableSegment {
  id: string;
  order: number;
}

/** Returns a new array with `order` renumbered 0..n-1 after a reorder/insert/delete. */
export function renumberSegments<T extends OrderableSegment>(segments: T[]): T[] {
  return segments
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((seg, i) => ({ ...seg, order: i }));
}

export function moveSegment<T extends OrderableSegment>(segments: T[], id: string, toIndex: number): T[] {
  const ordered = segments.slice().sort((a, b) => a.order - b.order);
  const fromIndex = ordered.findIndex((s) => s.id === id);
  if (fromIndex === -1) return segments;
  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(Math.max(0, Math.min(toIndex, ordered.length)), 0, moved);
  return renumberSegments(ordered);
}

// ---------------------------------------------------------------------------
// Column / reading-order geometry
// ---------------------------------------------------------------------------

export interface ColumnBand {
  index: number; // 0 = leftmost
  xStartRatio: number;
  xEndRatio: number;
}

/**
 * Given detected gutter x-positions (0..1, page-relative — see
 * detection/questionNumberDetector.ts for how these are found from text
 * block distribution), returns the column bands used to assign a rect to a
 * reading-order column. Single-column pages pass an empty gutters array.
 */
export function buildColumnBands(gutterXRatios: number[]): ColumnBand[] {
  const bounds = [0, ...gutterXRatios.slice().sort((a, b) => a - b), 1];
  const bands: ColumnBand[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    bands.push({ index: i, xStartRatio: bounds[i], xEndRatio: bounds[i + 1] });
  }
  return bands;
}

export function columnForRect(rect: NormalizedRect, bands: ColumnBand[]): number {
  const center = rect.xRatio + rect.widthRatio / 2;
  const band = bands.find((b) => center >= b.xStartRatio && center < b.xEndRatio);
  return band ? band.index : bands.length - 1;
}

/**
 * Reading order key: (pageIndex, column, yRatio). Sorting rects by this key
 * gives the probable top-to-bottom, left-column-then-right-column order for
 * a standard two-column exam layout. This is a heuristic default the student
 * always reviews and can override — see README, auto-detected order must be
 * reviewable.
 */
export function readingOrderKey(rect: NormalizedRect, bands: ColumnBand[]): [number, number, number] {
  return [rect.pageIndex, columnForRect(rect, bands), rect.yRatio];
}

export function compareReadingOrder(
  a: NormalizedRect,
  b: NormalizedRect,
  bands: ColumnBand[]
): number {
  const [pa, ca, ya] = readingOrderKey(a, bands);
  const [pb, cb, yb] = readingOrderKey(b, bands);
  if (pa !== pb) return pa - pb;
  if (ca !== cb) return ca - cb;
  return ya - yb;
}

// ---------------------------------------------------------------------------
// Incomplete-capture heuristics (geometry side — text-side heuristics are in
// answer-key/answerKeyParser.ts's sibling detector module)
// ---------------------------------------------------------------------------

/** True when a rect's bottom edge sits within `thresholdRatio` of the page/column bottom — a proxy for "content may have been cut off." */
export function isNearBottomBoundary(rect: NormalizedRect, thresholdRatio = 0.03): boolean {
  return rect.yRatio + rect.heightRatio >= 1 - thresholdRatio;
}

