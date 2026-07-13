/**
 * QP TO CBT — Capture Review page. FULLY IMPLEMENTED for single-segment
 * questions on the page they were detected on. "Extend Capture" (linking a
 * second region on another page/column to an existing question) is NOT
 * built in this page yet — the data model supports multi-segment questions
 * (see types.ts) and CaptureCanvas can show/edit any box regardless of
 * which question it belongs to, so wiring up an "Extend Capture" button
 * that creates a new segment pointing at an existing questionCaptureId is
 * the next increment here, not a redesign.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2, AlertTriangle, ArrowRight, Link2 } from "lucide-react";

import type { LocalPdfTest, QuestionCapture, QuestionCaptureSegment, NormalizedRect } from "@/features/qp-to-cbt/types";
import * as repo from "@/features/qp-to-cbt/storage/db";
import { PdfDocumentManager } from "@/features/qp-to-cbt/pdf/pdfDocumentManager";
import { CaptureCanvas, type CaptureBox } from "@/features/qp-to-cbt/capture/CaptureCanvas";
import { nextDefaultQuestionNumber } from "@/features/qp-to-cbt/capture/coordinates";
import { reviewQuestionSequence } from "@/features/qp-to-cbt/detection/questionNumberDetector";

export default function QpToCbtCapture() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<LocalPdfTest | null>(null);
  const [manager, setManager] = useState<PdfDocumentManager | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null);
  const [captures, setCaptures] = useState<QuestionCapture[]>([]);
  const [segmentsByCaptureId, setSegmentsByCaptureId] = useState<Record<string, QuestionCaptureSegment[]>>({});
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  // When true, the next box drawn becomes a NEW SEGMENT on the currently
  // selected question (Q4 -> Q4.1/Q4.2/...) instead of a brand new question.
  // This is "Extend Capture" — for a question that continues in another
  // column/page, or has a diagram elsewhere on the page.
  const [extendMode, setExtendMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // ---- Load test, PDF, and existing captures ----
  useEffect(() => {
    if (!testId) return;
    let cancelled = false;

    (async () => {
      const t = await repo.getLocalPdfTest(testId);
      if (!t || cancelled) return;
      setTest(t);

      const sourcePdf = await repo.getSourcePdf(t.sourcePdfIds[0]);
      if (!sourcePdf || cancelled) return;
      const bytes = await sourcePdf.bytes.arrayBuffer();
      const mgr = await PdfDocumentManager.load(bytes);
      if (cancelled) {
        mgr.dispose();
        return;
      }
      setManager(mgr);

      const loadedCaptures = await repo.listQuestionCaptures(testId);
      if (cancelled) return;
      setCaptures(loadedCaptures);

      const segMap: Record<string, QuestionCaptureSegment[]> = {};
      for (const c of loadedCaptures) segMap[c.id] = await repo.listCaptureSegments(c.id);
      if (!cancelled) setSegmentsByCaptureId(segMap);

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [testId]);

  useEffect(() => () => manager?.dispose(), [manager]);

  // ---- Render current page ----
  useEffect(() => {
    if (!manager) return;
    let cancelled = false;
    manager.renderPageWindow(pageIndex).then((canvas) => {
      if (!cancelled) setPageCanvas(canvas);
    });
    return () => {
      cancelled = true;
    };
  }, [manager, pageIndex]);

  const allQuestionNumbers = useMemo(() => captures.map((c) => c.questionNumber), [captures]);
  const sequenceWarnings = useMemo(() => reviewQuestionSequence(allQuestionNumbers), [allQuestionNumbers]);

  const boxesOnThisPage: CaptureBox[] = useMemo(() => {
    const boxes: CaptureBox[] = [];
    for (const capture of captures) {
      const segments = segmentsByCaptureId[capture.id] ?? [];
      segments
        .filter((s) => s.rect.pageIndex === pageIndex)
        .forEach((seg) => {
          boxes.push({
            id: seg.id,
            label: segments.length > 1 ? `Q${capture.questionNumber}.${seg.order}` : `Q${capture.questionNumber}`,
            rect: seg.rect,
            needsReview: capture.reviewState !== "confirmed",
          });
        });
    }
    return boxes;
  }, [captures, segmentsByCaptureId, pageIndex]);

  const selectedCapture = captures.find((c) => c.id === selectedCaptureId) ?? null;

  const persistSegmentRect = useCallback(
    async (segmentId: string, rect: NormalizedRect) => {
      // segment id in CaptureBox IS the real segment id (single-segment
      // questions have exactly one) — update in-memory + IndexedDB together.
      setSegmentsByCaptureId((prev) => {
        const next = { ...prev };
        for (const [captureId, segs] of Object.entries(next)) {
          const idx = segs.findIndex((s) => s.id === segmentId);
          if (idx !== -1) {
            const updated = { ...segs[idx], rect };
            next[captureId] = [...segs.slice(0, idx), updated, ...segs.slice(idx + 1)];
            void repo.saveCaptureSegment(updated);
          }
        }
        return next;
      });
    },
    []
  );

  const handleBoxRectChange = (segmentId: string, rect: NormalizedRect) => {
    void persistSegmentRect(segmentId, rect);
  };

  const handleBoxCreate = async (rect: NormalizedRect) => {
    if (!test) return;

    // ---- Extend Capture: add a segment to the currently selected question ----
    if (extendMode && selectedCaptureId) {
      const capture = captures.find((c) => c.id === selectedCaptureId);
      if (!capture) return;
      const existingSegments = segmentsByCaptureId[selectedCaptureId] ?? [];
      const segment: QuestionCaptureSegment = {
        id: crypto.randomUUID(),
        questionCaptureId: selectedCaptureId,
        order: existingSegments.length,
        rect: { ...rect, pageIndex },
        ocrText: null,
        ocrConfidence: null,
        source: "extended",
        createdAt: new Date().toISOString(),
      };
      await repo.saveCaptureSegment(segment);
      const updatedCapture = {
        ...capture,
        segmentIds: [...capture.segmentIds, segment.id],
        updatedAt: new Date().toISOString(),
      };
      await repo.saveQuestionCapture(updatedCapture);

      setSegmentsByCaptureId((prev) => ({ ...prev, [selectedCaptureId]: [...existingSegments, segment] }));
      setCaptures((prev) => prev.map((c) => (c.id === selectedCaptureId ? updatedCapture : c)));
      setExtendMode(false);
      setDrawMode(false);
      return;
    }

    // ---- Normal manual capture: a brand new question ----
    const questionNumber = nextDefaultQuestionNumber(allQuestionNumbers);
    const captureId = crypto.randomUUID();
    const segmentId = crypto.randomUUID();
    const now = new Date().toISOString();

    const capture: QuestionCapture = {
      id: captureId,
      localTestId: test.id,
      questionNumber,
      segmentIds: [segmentId],
      subjectId: null,
      chapterId: null,
      topicAssignment: null,
      reviewState: "confirmed", // manually drawn — the student placed it deliberately
      warnings: [],
      createdAt: now,
      updatedAt: now,
    };
    const segment: QuestionCaptureSegment = {
      id: segmentId,
      questionCaptureId: captureId,
      order: 0,
      rect: { ...rect, pageIndex },
      ocrText: null,
      ocrConfidence: null,
      source: "manual",
      createdAt: now,
    };

    await repo.saveQuestionCapture(capture);
    await repo.saveCaptureSegment(segment);
    setCaptures((prev) => [...prev, capture]);
    setSegmentsByCaptureId((prev) => ({ ...prev, [captureId]: [segment] }));
    setSelectedCaptureId(captureId);
    setDrawMode(false);
  };

  const handleDeleteSegment = async (captureId: string, segmentId: string) => {
    const capture = captures.find((c) => c.id === captureId);
    if (!capture) return;
    const remaining = (segmentsByCaptureId[captureId] ?? []).filter((s) => s.id !== segmentId);
    if (remaining.length === 0) {
      // Deleting the last segment deletes the whole question — a question
      // with zero regions isn't meaningful.
      await handleDelete(captureId);
      return;
    }
    await repo.deleteCaptureSegment(segmentId);
    const renumbered = remaining.map((s, i) => ({ ...s, order: i }));
    for (const s of renumbered) await repo.saveCaptureSegment(s);
    const updatedCapture = { ...capture, segmentIds: renumbered.map((s) => s.id), updatedAt: new Date().toISOString() };
    await repo.saveQuestionCapture(updatedCapture);
    setSegmentsByCaptureId((prev) => ({ ...prev, [captureId]: renumbered }));
    setCaptures((prev) => prev.map((c) => (c.id === captureId ? updatedCapture : c)));
  };

  const handleRenumber = async (captureId: string, newNumber: number) => {
    const capture = captures.find((c) => c.id === captureId);
    if (!capture || Number.isNaN(newNumber)) return;
    const updated = { ...capture, questionNumber: newNumber, updatedAt: new Date().toISOString() };
    await repo.saveQuestionCapture(updated);
    setCaptures((prev) => prev.map((c) => (c.id === captureId ? updated : c)));
  };

  const handleConfirm = async (captureId: string) => {
    const capture = captures.find((c) => c.id === captureId);
    if (!capture) return;
    const updated = { ...capture, reviewState: "confirmed" as const, updatedAt: new Date().toISOString() };
    await repo.saveQuestionCapture(updated);
    setCaptures((prev) => prev.map((c) => (c.id === captureId ? updated : c)));
  };

  const handleDelete = async (captureId: string) => {
    await repo.deleteQuestionCapture(captureId);
    setCaptures((prev) => prev.filter((c) => c.id !== captureId));
    setSegmentsByCaptureId((prev) => {
      const next = { ...prev };
      delete next[captureId];
      return next;
    });
    if (selectedCaptureId === captureId) setSelectedCaptureId(null);
  };

  const selectedSegmentId = useMemo(() => {
    if (!selectedCapture) return null;
    const segs = segmentsByCaptureId[selectedCapture.id] ?? [];
    return segs.find((s) => s.rect.pageIndex === pageIndex)?.id ?? null;
  }, [selectedCapture, segmentsByCaptureId, pageIndex]);

  if (loading || !test || !pageCanvas) {
    return (
      <DashboardLayout>
        <div className="p-10 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading capture review…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-4 max-w-6xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold">{test.title}</h1>
            <p className="text-xs text-muted-foreground">
              {captures.length} questions captured so far · Page {pageIndex + 1} of {manager?.pageCount ?? "…"}
            </p>
          </div>
          <Button onClick={() => navigate(`/qp-to-cbt/answer-key/${test.id}`)}>
            Continue to Answer Key <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {sequenceWarnings.length > 0 && (
          <Card className="border-amber-400/50 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-3 space-y-1">
              {sequenceWarnings.slice(0, 5).map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w.message}
                </div>
              ))}
              {sequenceWarnings.length > 5 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">+{sequenceWarnings.length - 5} more</p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={pageIndex === 0} onClick={() => setPageIndex((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!manager || pageIndex >= manager.pageCount - 1}
                  onClick={() => setPageIndex((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={extendMode ? "default" : "outline"}
                  disabled={!selectedCaptureId}
                  onClick={() => {
                    setExtendMode((e) => !e);
                    setDrawMode(true);
                  }}
                  title={selectedCaptureId ? "Draw the next region for this question" : "Select a question first"}
                >
                  <Link2 className="h-4 w-4 mr-1" /> Extend Capture
                </Button>
                <Button
                  size="sm"
                  variant={drawMode && !extendMode ? "default" : "outline"}
                  onClick={() => {
                    setDrawMode((d) => !d);
                    setExtendMode(false);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Capture Question
                </Button>
              </div>
            </div>
            {extendMode && (
              <p className="text-xs text-primary bg-primary/5 rounded-lg p-2">
                Draw the next region for Q{captures.find((c) => c.id === selectedCaptureId)?.questionNumber} — can be
                on this page or any other page/column.
              </p>
            )}

            <CaptureCanvas
              pageCanvas={pageCanvas}
              pageIndex={pageIndex}
              boxes={boxesOnThisPage}
              selectedBoxId={selectedSegmentId}
              mode={drawMode ? "draw" : "view"}
              onSelectBox={(segId) => {
                const capture = captures.find((c) => (segmentsByCaptureId[c.id] ?? []).some((s) => s.id === segId));
                setSelectedCaptureId(capture?.id ?? null);
              }}
              onBoxRectChange={handleBoxRectChange}
              onBoxCreate={handleBoxCreate}
            />
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Selected question</h3>
              {!selectedCapture ? (
                <p className="text-xs text-muted-foreground">
                  Tap a box on the page, or "Capture Question" to draw a new one.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Question number</label>
                    <Input
                      type="number"
                      value={selectedCapture.questionNumber}
                      onChange={(e) => handleRenumber(selectedCapture.id, parseInt(e.target.value, 10))}
                    />
                  </div>
                  <Badge variant={selectedCapture.reviewState === "confirmed" ? "default" : "secondary"}>
                    {selectedCapture.reviewState === "confirmed" ? "Confirmed" : "Pending review"}
                  </Badge>

                  {(segmentsByCaptureId[selectedCapture.id]?.length ?? 0) > 1 && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        {segmentsByCaptureId[selectedCapture.id].length} segments (rendered in this order)
                      </label>
                      {segmentsByCaptureId[selectedCapture.id]
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((seg, i) => (
                          <div key={seg.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                            <button className="text-left" onClick={() => setPageIndex(seg.rect.pageIndex)}>
                              Q{selectedCapture.questionNumber}.{i} — page {seg.rect.pageIndex + 1}
                            </button>
                            <button onClick={() => handleDeleteSegment(selectedCapture.id, seg.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {selectedCapture.reviewState !== "confirmed" && (
                      <Button size="sm" className="flex-1" onClick={() => handleConfirm(selectedCapture.id)}>
                        Confirm
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleDelete(selectedCapture.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t">
                <h4 className="text-xs font-semibold mb-2">All questions ({captures.length})</h4>
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                  {captures
                    .slice()
                    .sort((a, b) => a.questionNumber - b.questionNumber)
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCaptureId(c.id);
                          const seg = (segmentsByCaptureId[c.id] ?? [])[0];
                          if (seg) setPageIndex(seg.rect.pageIndex);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          c.id === selectedCaptureId
                            ? "border-primary bg-primary/10"
                            : c.reviewState === "confirmed"
                            ? "border-green-600/40"
                            : "border-amber-500/40"
                        }`}
                      >
                        Q{c.questionNumber}
                      </button>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
