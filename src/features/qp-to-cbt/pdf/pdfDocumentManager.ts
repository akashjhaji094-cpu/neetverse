/**
 * QP TO CBT — PDF document/page render manager.
 *
 * Wraps pdfjs-dist (already a repo dependency, no version change). This is
 * the module responsible for the "must not freeze on a 720-question PDF"
 * requirement: it never keeps more than a small window of rendered page
 * bitmaps in memory, every render is cancelable, and canvases/ImageBitmaps
 * are explicitly released.
 *
 * Text content extraction (getPageTextLayout) is what the question-number
 * detector and answer-key detector run against — see detection/ and
 * answer-key/ for how the (x, y, str) items returned here get turned into
 * question boundaries.
 */
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
// Vite-native worker import — resolves to a URL pdfjs-dist can load as a module worker.
// (If your bundler config resolves worker URLs differently, swap this one line.)
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Hard cap on render scale regardless of devicePixelRatio, to prevent
 * memory blowups on high-DPI phones rendering large pages. 2x is enough
 * resolution for crisp question crops without the multi-hundred-MB canvases
 * a naive dpr=3-4 render would produce on a 200-page paper. */
const MAX_RENDER_SCALE = 2;
/** How many pages on each side of the "current" page stay rendered/cached. */
const NEARBY_PAGE_WINDOW = 1;

export interface PageTextItem {
  str: string;
  /** Normalized 0..1 position, already divided by the page's unscaled viewport size. */
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  fontName: string;
}

export interface PageTextLayout {
  pageIndex: number;
  items: PageTextItem[];
  hasTextLayer: boolean; // false for scanned/image-only pages — callers fall back to OCR
}

interface CachedPage {
  canvas: HTMLCanvasElement;
  scale: number;
  renderTask: RenderTask | null;
}

export class PdfDocumentManager {
  private doc: PDFDocumentProxy | null = null;
  private pageCache = new Map<number, CachedPage>();
  private textLayoutCache = new Map<number, PageTextLayout>();
  private disposed = false;

  private constructor(doc: PDFDocumentProxy) {
    this.doc = doc;
  }

  static async load(bytes: ArrayBuffer): Promise<PdfDocumentManager> {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const doc = await loadingTask.promise;
      return new PdfDocumentManager(doc);
    } catch (err: any) {
      if (err?.name === "PasswordException") {
        throw new PdfLoadError("password_protected", "This PDF is password-protected.");
      }
      throw new PdfLoadError("corrupted", "This PDF couldn't be read — it may be corrupted.");
    }
  }

  get pageCount(): number {
    this.assertNotDisposed();
    return this.doc!.numPages; // dynamic — never hard-coded, this IS the source of truth
  }

  /** Unscaled page size in PDF points — the reference frame all NormalizedRects are relative to. */
  async getPageSize(pageIndex: number): Promise<{ width: number; height: number }> {
    const page = await this.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1 });
    return { width: viewport.width, height: viewport.height };
  }

  private async getPage(pageIndex: number): Promise<PDFPageProxy> {
    this.assertNotDisposed();
    // pdf.js pages are 1-indexed; the rest of this module is 0-indexed to match NormalizedRect.
    return this.doc!.getPage(pageIndex + 1);
  }

  /**
   * Renders one page into an offscreen canvas, capped at MAX_RENDER_SCALE
   * regardless of devicePixelRatio, and evicts everything outside the
   * nearby-page window around `pageIndex`. Returns the canvas (caller draws
   * it or a cropped region of it — see capture/coordinates.ts for the crop
   * math). Safe to call repeatedly while scrolling; in-flight renders for
   * pages that fall outside the window get canceled automatically.
   */
  async renderPageWindow(centerPageIndex: number, requestedScale = MAX_RENDER_SCALE): Promise<HTMLCanvasElement> {
    const scale = Math.min(requestedScale, MAX_RENDER_SCALE);
    const keep = new Set<number>();
    for (let p = centerPageIndex - NEARBY_PAGE_WINDOW; p <= centerPageIndex + NEARBY_PAGE_WINDOW; p++) {
      if (p >= 0 && p < this.pageCount) keep.add(p);
    }
    // Evict + cancel anything outside the window first, so we're not holding
    // stale canvases in memory while rendering the new center page.
    for (const [pageIndex, cached] of this.pageCache) {
      if (!keep.has(pageIndex)) {
        cached.renderTask?.cancel();
        this.releaseCanvas(cached.canvas);
        this.pageCache.delete(pageIndex);
      }
    }

    return this.renderSinglePage(centerPageIndex, scale);
  }

  private async renderSinglePage(pageIndex: number, scale: number): Promise<HTMLCanvasElement> {
    const existing = this.pageCache.get(pageIndex);
    if (existing && existing.scale === scale && !existing.renderTask) {
      return existing.canvas;
    }
    existing?.renderTask?.cancel();

    const page = await this.getPage(pageIndex);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PdfLoadError("render_failed", "Canvas 2D context unavailable.");

    const renderTask = page.render({ canvasContext: ctx, viewport });
    this.pageCache.set(pageIndex, { canvas, scale, renderTask });

    try {
      await renderTask.promise;
    } catch (err: any) {
      if (err?.name === "RenderingCancelledException") {
        // Expected during fast scroll — not an error the caller needs to see.
        throw err;
      }
      throw new PdfLoadError("render_failed", `Page ${pageIndex + 1} failed to render.`);
    }

    const cached = this.pageCache.get(pageIndex);
    if (cached) cached.renderTask = null;
    return canvas;
  }

  /** Cancels an in-flight render for a page, e.g. when the user navigates away mid-render. */
  cancelPageRender(pageIndex: number): void {
    this.pageCache.get(pageIndex)?.renderTask?.cancel();
  }

  async getPageTextLayout(pageIndex: number): Promise<PageTextLayout> {
    const cached = this.textLayoutCache.get(pageIndex);
    if (cached) return cached;

    const page = await this.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const items: PageTextItem[] = textContent.items
      .filter((item): item is any => "str" in item && item.str.trim().length > 0)
      .map((item: any) => {
        // item.transform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const x = item.transform[4];
        const yFromBottom = item.transform[5];
        const yFromTop = viewport.height - yFromBottom - item.height;
        return {
          str: item.str,
          xRatio: x / viewport.width,
          yRatio: yFromTop / viewport.height,
          widthRatio: item.width / viewport.width,
          heightRatio: item.height / viewport.height,
          fontName: item.fontName ?? "",
        };
      });

    const layout: PageTextLayout = {
      pageIndex,
      items,
      hasTextLayer: items.length > 0,
    };
    this.textLayoutCache.set(pageIndex, layout);
    return layout;
  }

  private releaseCanvas(canvas: HTMLCanvasElement): void {
    // Zeroing dimensions forces the browser to release the backing bitmap
    // immediately rather than waiting for GC — meaningful on memory-constrained
    // mobile devices when working through a 700+ page PDF.
    canvas.width = 0;
    canvas.height = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    for (const cached of this.pageCache.values()) {
      cached.renderTask?.cancel();
      this.releaseCanvas(cached.canvas);
    }
    this.pageCache.clear();
    this.textLayoutCache.clear();
    this.doc?.destroy();
    this.doc = null;
    this.disposed = true;
  }

  private assertNotDisposed(): void {
    if (this.disposed || !this.doc) throw new Error("PdfDocumentManager used after dispose()");
  }
}

export type PdfLoadErrorReason = "password_protected" | "corrupted" | "render_failed";

export class PdfLoadError extends Error {
  constructor(public reason: PdfLoadErrorReason, message: string) {
    super(message);
    this.name = "PdfLoadError";
  }
  }
