/**
 * QP TO CBT — OCR worker manager. PARTIALLY IMPLEMENTED (see README §4):
 * the worker lifecycle, progress reporting, and cancellation here are real
 * and functional. What isn't done is PSM-mode / language-pack tuning
 * against real NEET paper scans — start with defaults, expect to adjust
 * `PSM_MODE` and possibly add a second pass for math-heavy regions once you
 * see real accuracy numbers.
 *
 * OCR output from this module is used ONLY as supporting signal — question
 * number detection assist, answer-key text, topic-classification input, and
 * incomplete-capture warnings. It is never rendered as question content
 * (see types.ts: `ocrText` lives on QuestionCaptureSegment, completely
 * separate from the `rect` the CBT renderer actually draws).
 *
 * Requires the `tesseract.js` package (see README §6).
 */
import { createWorker, type Worker as TesseractWorker, PSM } from "tesseract.js";
import type { PixelRect } from "../capture/coordinates";

export interface OcrProgressEvent {
  status: string;
  progress: number; // 0..1
}

export interface OcrResult {
  text: string;
  confidence: number; // 0..1 (tesseract reports 0..100; normalized here)
}

export class OcrCancelledError extends Error {
  constructor() {
    super("OCR job cancelled");
    this.name = "OcrCancelledError";
  }
}

export class OcrWorkerManager {
  private worker: TesseractWorker | null = null;
  private initPromise: Promise<void> | null = null;
  private currentJobCancelled = false;

  private async ensureInitialized(onProgress?: (e: OcrProgressEvent) => void): Promise<void> {
    if (this.worker) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.worker = await createWorker("eng", 1, {
          logger: (m) => {
            if (onProgress && typeof m.progress === "number") {
              onProgress({ status: m.status, progress: m.progress });
            }
          },
        });
        // PSM.SPARSE_TEXT tends to do better than the default on exam-paper
        // layouts (short, spatially separated blocks) than dense-paragraph
        // assumptions — a starting point, flagged for real-sample tuning.
        await this.worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      })();
    }
    await this.initPromise;
  }

  /** Crops `rect` out of `sourceCanvas` into a small offscreen canvas, then OCRs just that crop — used for per-segment OCR during capture review, so we never pay the cost of OCRing a whole page when only a small region is new/changed. */
  async recognizeRegion(
    sourceCanvas: HTMLCanvasElement,
    rect: PixelRect,
    onProgress?: (e: OcrProgressEvent) => void
  ): Promise<OcrResult> {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.max(1, Math.round(rect.width));
    cropCanvas.height = Math.max(1, Math.round(rect.height));
    const ctx = cropCanvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable for OCR crop");
    ctx.drawImage(
      sourceCanvas,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    );

    try {
      const result = await this.recognizeCanvas(cropCanvas, onProgress);
      return result;
    } finally {
      cropCanvas.width = 0;
      cropCanvas.height = 0; // release immediately, same rationale as pdfDocumentManager
    }
  }

  async recognizeCanvas(canvas: HTMLCanvasElement, onProgress?: (e: OcrProgressEvent) => void): Promise<OcrResult> {
    const { data } = await this.recognizeCanvasRaw(canvas, onProgress);
    return { text: data.text.trim(), confidence: Math.max(0, Math.min(1, data.confidence / 100)) };
  }

  /** Same as recognizeCanvas but returns Tesseract's full result, including
   * per-word bounding boxes — needed by ocrPageToTextLayout below to fake up
   * a PageTextLayout for pages with no real PDF text layer. */
  async recognizeCanvasRaw(canvas: HTMLCanvasElement, onProgress?: (e: OcrProgressEvent) => void) {
    this.currentJobCancelled = false;
    await this.ensureInitialized(onProgress);
    if (!this.worker) throw new Error("OCR worker failed to initialize");
    const result = await this.worker.recognize(canvas);
    if (this.currentJobCancelled) throw new OcrCancelledError();
    return result;
  }

  /** Best-effort cooperative cancellation — Tesseract.js doesn't expose
   * mid-recognition abort, so this flags the in-flight job's result to be
   * discarded when it resolves, and the caller (batch OCR loop below)
   * should stop scheduling further pages immediately rather than waiting
   * for this one to finish. True hard-abort would require re-creating the
   * worker, which is more disruptive than useful for the common "user
   * moved to the next screen" cancellation case. */
  cancel(): void {
    this.currentJobCancelled = true;
  }

  async dispose(): Promise<void> {
    await this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
  }
}

// ---------------------------------------------------------------------------
// Progressive batch OCR over many segments, with cancellation
// ---------------------------------------------------------------------------

export interface BatchOcrTarget {
  id: string; // segment id
  canvas: HTMLCanvasElement;
  rect: PixelRect;
}

export interface BatchOcrProgress {
  completed: number;
  total: number;
  currentLabel: string; // e.g. "Processing page 12 of 84" — caller supplies the label per target
}

/**
 * Runs OCR over a list of targets sequentially (Tesseract.js workers don't
 * parallelize well on mobile without a worker pool, which is genuinely
 * next-phase scope), reporting progress after each one and stopping
 * immediately if `signal` is aborted between items.
 */
export async function runBatchOcr(
  manager: OcrWorkerManager,
  targets: Array<BatchOcrTarget & { label: string }>,
  onProgress: (p: BatchOcrProgress) => void,
  signal?: AbortSignal
): Promise<Map<string, OcrResult>> {
  const results = new Map<string, OcrResult>();
  for (let i = 0; i < targets.length; i++) {
    if (signal?.aborted) break;
    const target = targets[i];
    onProgress({ completed: i, total: targets.length, currentLabel: target.label });
    try {
      const result = await manager.recognizeRegion(target.canvas, target.rect);
      results.set(target.id, result);
    } catch (err) {
      if (err instanceof OcrCancelledError) break;
      // One region failing shouldn't abort the whole batch — recorded as
      // empty/low-confidence so the review screen can flag it, per the
      // "OCR worker crash" error case in the spec.
      results.set(target.id, { text: "", confidence: 0 });
    }
  }
  onProgress({ completed: targets.length, total: targets.length, currentLabel: "Done" });
  return results;
}

// ---------------------------------------------------------------------------
// Scanned-PDF fallback: OCR a whole page and shape the result to look like
// PageTextLayout, so questionNumberDetector.ts and answerKeyParser.ts work
// completely unchanged whether their input came from pdf.js's real text
// layer or from OCR. This is the fix for "zero questions detected" on
// scanned/image-only question papers, which have no extractable text layer
// at all — the previous version silently returned [] for those pages
// instead of falling back to this.
// ---------------------------------------------------------------------------

export async function ocrPageToTextLayout(
  manager: OcrWorkerManager,
  pageCanvas: HTMLCanvasElement,
  pageIndex: number,
  onProgress?: (e: OcrProgressEvent) => void
): Promise<import("../pdf/pdfDocumentManager").PageTextLayout> {
  const raw: any = await manager.recognizeCanvasRaw(pageCanvas, onProgress);
  const words: any[] = raw?.data?.words ?? [];

  const items = words
    .filter((w) => w.text && w.text.trim().length > 0 && w.bbox)
    .map((w) => ({
      str: w.text as string,
      xRatio: w.bbox.x0 / pageCanvas.width,
      yRatio: w.bbox.y0 / pageCanvas.height,
      widthRatio: (w.bbox.x1 - w.bbox.x0) / pageCanvas.width,
      heightRatio: (w.bbox.y1 - w.bbox.y0) / pageCanvas.height,
      fontName: "",
    }));

  return { pageIndex, items, hasTextLayer: items.length > 0 };
}

