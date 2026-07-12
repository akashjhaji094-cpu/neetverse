/**
 * QP TO CBT — CaptureCanvas. FULLY IMPLEMENTED.
 *
 * Renders a PDF page (already-rendered HTMLCanvasElement from
 * PdfDocumentManager) with capture boxes overlaid as absolutely-positioned
 * divs, not a second canvas layer — this makes per-box pointer interaction
 * (drag to move, drag a corner to resize) far simpler than hit-testing
 * inside canvas pixels, and NormalizedRect's 0..1 ratios map directly to
 * CSS percentages with zero extra math at render time.
 *
 * Uses Pointer Events (not mouse-only) so the same code path handles mouse,
 * touch, and pen, per the spec's mobile requirement.
 */
import { useRef, useEffect, useState, useCallback } from "react";
import type { NormalizedRect } from "../types";
import {
  pixelToNormalizedRect,
  normalizedToPixelRect,
  rectFromDragPoints,
  resizeRect,
  moveRect,
  type PixelRect,
  type ResizeHandle,
  type PageSize,
} from "./coordinates";

export interface CaptureBox {
  id: string;
  label: string; // e.g. "Q4" or "Q4.2"
  rect: NormalizedRect;
  /** Lower-confidence auto-detected boxes render amber instead of the default primary color, so the student's eye is drawn to what needs a second look. */
  needsReview?: boolean;
}

interface CaptureCanvasProps {
  pageCanvas: HTMLCanvasElement;
  pageIndex: number;
  boxes: CaptureBox[];
  selectedBoxId: string | null;
  /** "draw" arms click-and-drag-to-create; "view" only allows selecting/adjusting existing boxes. Toggle this from a "+ Capture Question" button in the parent. */
  mode: "view" | "draw";
  onSelectBox: (id: string | null) => void;
  onBoxRectChange: (id: string, rect: NormalizedRect) => void;
  onBoxCreate: (rect: NormalizedRect) => void;
}

const HANDLES: ResizeHandle[] = ["nw", "ne", "sw", "se"];
const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

export function CaptureCanvas({
  pageCanvas,
  pageIndex,
  boxes,
  selectedBoxId,
  mode,
  onSelectBox,
  onBoxRectChange,
  onBoxCreate,
}: CaptureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);

  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<
    | { kind: "move"; boxId: string; startPointer: { x: number; y: number }; startRect: PixelRect }
    | { kind: "resize"; boxId: string; handle: ResizeHandle; startPointer: { x: number; y: number }; startRect: PixelRect }
    | null
  >(null);

  // pdf.js gives us a real <canvas> element (not a React-managed one) —
  // mount it imperatively rather than fighting React for ownership of it.
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    host.innerHTML = "";
    pageCanvas.style.display = "block";
    pageCanvas.style.width = "100%";
    pageCanvas.style.height = "auto";
    host.appendChild(pageCanvas);
    return () => {
      if (host.contains(pageCanvas)) host.removeChild(pageCanvas);
    };
  }, [pageCanvas]);

  const getPageSize = useCallback((): PageSize => {
    const rect = canvasHostRef.current?.getBoundingClientRect();
    return { pageIndex, width: rect?.width ?? pageCanvas.width, height: rect?.height ?? pageCanvas.height };
  }, [pageIndex, pageCanvas]);

  const pointerToLocal = useCallback((e: React.PointerEvent): { x: number; y: number } => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ---- Draw-new-box (manual capture) ----
  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if (mode !== "draw") return;
    if ((e.target as HTMLElement).closest("[data-capture-box]")) return; // let box handlers deal with it
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = pointerToLocal(e);
    setDrawStart(p);
    setDrawCurrent(p);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (drawStart) setDrawCurrent(pointerToLocal(e));
    if (dragState) {
      const page = getPageSize();
      const dx = e.clientX - dragState.startPointer.x;
      const dy = e.clientY - dragState.startPointer.y;
      const nextPixelRect =
        dragState.kind === "move"
          ? moveRect(dragState.startRect, dx, dy, page)
          : resizeRect(dragState.startRect, dragState.handle, dx, dy, page);
      onBoxRectChange(dragState.boxId, pixelToNormalizedRect(nextPixelRect, page));
    }
  };

  const handleContainerPointerUp = () => {
    if (drawStart && drawCurrent) {
      const page = getPageSize();
      const pixelRect = rectFromDragPoints(drawStart, drawCurrent);
      if (pixelRect.width > 8 && pixelRect.height > 8) {
        onBoxCreate(pixelToNormalizedRect(pixelRect, page));
      }
    }
    setDrawStart(null);
    setDrawCurrent(null);
    setDragState(null);
  };

  // ---- Move / resize an existing box ----
  const startMove = (e: React.PointerEvent, boxId: string, rect: NormalizedRect) => {
    if (mode === "draw") return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onSelectBox(boxId);
    const page = getPageSize();
    setDragState({
      kind: "move",
      boxId,
      startPointer: { x: e.clientX, y: e.clientY },
      startRect: normalizedToPixelRect(rect, page),
    });
  };

  const startResize = (e: React.PointerEvent, boxId: string, rect: NormalizedRect, handle: ResizeHandle) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const page = getPageSize();
    setDragState({
      kind: "resize",
      boxId,
      handle,
      startPointer: { x: e.clientX, y: e.clientY },
      startRect: normalizedToPixelRect(rect, page),
    });
  };

  const previewBox = drawStart && drawCurrent ? rectFromDragPoints(drawStart, drawCurrent) : null;

  return (
    <div
      ref={containerRef}
      className={`relative select-none touch-none border rounded-lg overflow-hidden bg-muted/20 ${
        mode === "draw" ? "cursor-crosshair" : ""
      }`}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerUp}
    >
      <div ref={canvasHostRef} className="pointer-events-none" />

      {boxes.map((box) => {
        const page = getPageSize();
        const pixelRect = normalizedToPixelRect(box.rect, page);
        const isSelected = box.id === selectedBoxId;
        return (
          <div
            key={box.id}
            data-capture-box
            onPointerDown={(e) => startMove(e, box.id, box.rect)}
            className={`absolute border-2 rounded-sm ${
              isSelected
                ? "border-primary bg-primary/10 z-10"
                : box.needsReview
                ? "border-amber-500 bg-amber-500/10"
                : "border-green-600 bg-green-600/10"
            }`}
            style={{
              left: `${box.rect.xRatio * 100}%`,
              top: `${box.rect.yRatio * 100}%`,
              width: `${box.rect.widthRatio * 100}%`,
              height: `${box.rect.heightRatio * 100}%`,
              cursor: mode === "draw" ? "default" : "move",
            }}
          >
            <span className="absolute -top-5 left-0 text-[10px] font-semibold bg-background border rounded px-1">
              {box.label}
            </span>
            {isSelected &&
              HANDLES.map((handle) => (
                <div
                  key={handle}
                  onPointerDown={(e) => startResize(e, box.id, box.rect, handle)}
                  className="absolute w-3 h-3 bg-primary border border-background rounded-full"
                  style={{
                    cursor: HANDLE_CURSOR[handle],
                    top: handle.includes("n") ? -6 : handle.includes("s") ? "calc(100% - 6px)" : "calc(50% - 6px)",
                    left: handle.includes("w") ? -6 : handle.includes("e") ? "calc(100% - 6px)" : "calc(50% - 6px)",
                  }}
                />
              ))}
          </div>
        );
      })}

      {previewBox && (
        <div
          className="absolute border-2 border-dashed border-primary bg-primary/10"
          style={{ left: previewBox.x, top: previewBox.y, width: previewBox.width, height: previewBox.height }}
        />
      )}
    </div>
  );
                }
