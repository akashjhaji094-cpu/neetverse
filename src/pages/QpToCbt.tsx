/**
 * QP TO CBT — entry page. Updated for Phase 2: detected candidates are now
 * actually saved as QuestionCapture + QuestionCaptureSegment records (Phase
 * 1 only held them in React state), and there's a real next step —
 * /qp-to-cbt/capture/:testId — instead of a dead-end preview grid.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileText, Files, Upload, Loader2, HardDrive, AlertTriangle, ArrowRight } from "lucide-react";

import type { LocalPdfTest, SourcePdf, QuestionCapture, QuestionCaptureSegment } from "@/features/qp-to-cbt/types";
import * as repo from "@/features/qp-to-cbt/storage/db";
import { PdfDocumentManager, type PageTextLayout } from "@/features/qp-to-cbt/pdf/pdfDocumentManager";
import {
  detectDocumentGutter,
  detectQuestionNumberCandidates,
  proposeCaptureBoundaries,
  type QuestionNumberCandidate,
} from "@/features/qp-to-cbt/detection/questionNumberDetector";
import { buildColumnBands, compareReadingOrder } from "@/features/qp-to-cbt/capture/coordinates";
import { OcrWorkerManager, ocrPageToTextLayout } from "@/features/qp-to-cbt/ocr/ocrWorkerManager";

type AnswerKeyFormat = "same_pdf" | "separate_pdfs";
type Stage = "choose_format" | "upload" | "detecting" | "detected" | "error";

export default function QpToCbt() {
  const navigate = useNavigate();
  const [format, setFormat] = useState<AnswerKeyFormat | null>(null);
  const [stage, setStage] = useState<Stage>("choose_format");
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedCount, setDetectedCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [localTestId, setLocalTestId] = useState<string | null>(null);

  const handleFileSelected = useCallback(
    async (file: File) => {
      setErrorMessage(null);
      setStage("detecting");
      try {
        const quota = await repo.estimateStorage();
        if (quota?.nearingLimit) {
          setErrorMessage(
            "This device's storage is nearly full. Delete old QP TO CBT tests before uploading another large PDF."
          );
        }

        const sourcePdf: SourcePdf = {
          id: crypto.randomUUID(),
          role: format === "same_pdf" ? "combined" : "question_paper",
          fileName: file.name,
          byteLength: file.size,
          pageCount: null,
          loadedAt: null,
          createdAt: new Date().toISOString(),
        };
        await repo.saveSourcePdf(sourcePdf, file);

        const test: LocalPdfTest = {
          id: crypto.randomUUID(),
          title: file.name.replace(/\.pdf$/i, ""),
          sourcePdfIds: [sourcePdf.id],
          stage: "capturing",
          sections: [],
          questionCount: 0,
          syncStatus: "local_only",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await repo.saveLocalPdfTest(test);
        setLocalTestId(test.id);

        setProgressLabel("Loading PDF…");
        const bytes = await file.arrayBuffer();
        const manager = await PdfDocumentManager.load(bytes);
        await repo.updateSourcePdfMeta(sourcePdf.id, {
          pageCount: manager.pageCount,
          loadedAt: new Date().toISOString(),
        });
        setPageCount(manager.pageCount);

        const allCandidates: QuestionNumberCandidate[] = [];
        let expectedNext: number | null = null;
        let ocrManager: OcrWorkerManager | null = null;
        let usedOcrFallback = false;

        // Pass 1: collect every page's text layout (lightweight — text +
        // positions only, not rendered bitmaps) so a document-wide gutter
        // can be computed before any page is actually processed. VERIFIED
        // necessary against a real 180-question paper: computing the
        // gutter per-page independently got 179/180 right but silently
        // misdetected one sparse page (few words to constrain the search)
        // at a wildly different gutter position than the other 20 pages,
        // which agreed with each other to within a fraction of a percent.
        const pageLayouts: PageTextLayout[] = [];
        for (let pageIndex = 0; pageIndex < manager.pageCount; pageIndex++) {
          setProgressLabel(`Reading page ${pageIndex + 1} of ${manager.pageCount}`);
          let layout = await manager.getPageTextLayout(pageIndex);
          if (!layout.hasTextLayer) {
            usedOcrFallback = true;
            setProgressLabel(`Page ${pageIndex + 1} has no text layer — running OCR (slower)…`);
            if (!ocrManager) ocrManager = new OcrWorkerManager();
            const pageCanvasForOcr = await manager.renderPageWindow(pageIndex);
            layout = await ocrPageToTextLayout(ocrManager, pageCanvasForOcr, pageIndex, (p) =>
              setProgressLabel(`OCR page ${pageIndex + 1}: ${Math.round(p.progress * 100)}%`)
            );
          }
          pageLayouts.push(layout);
        }

        const documentGutters = detectDocumentGutter(pageLayouts);
        const bands = buildColumnBands(documentGutters);

        // Pass 2: detect questions using the one consistent gutter.
        for (const layout of pageLayouts) {
          setProgressLabel(`Detecting questions on page ${layout.pageIndex + 1} of ${manager.pageCount}`);
          const pageCandidates = detectQuestionNumberCandidates(layout, bands, expectedNext);
          const ordered = pageCandidates.sort((a, b) =>
            compareReadingOrder(
              { pageIndex: a.pageIndex, xRatio: a.xRatio, yRatio: a.yRatio, widthRatio: 0, heightRatio: 0 },
              { pageIndex: b.pageIndex, xRatio: b.xRatio, yRatio: b.yRatio, widthRatio: 0, heightRatio: 0 },
              bands
            )
          );
          allCandidates.push(...ordered);
          if (ordered.length > 0) expectedNext = ordered[ordered.length - 1].questionNumber + 1;

          const regions = proposeCaptureBoundaries(ordered, bands);
          for (const region of regions) {
            const captureId = crypto.randomUUID();
            const segmentId = crypto.randomUUID();
            const capture: QuestionCapture = {
              id: captureId,
              localTestId: test.id,
              questionNumber: region.questionNumber,
              segmentIds: [segmentId],
              subjectId: null,
              chapterId: null,
              topicAssignment: null,
              reviewState: "pending_review",
              warnings: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            const segment: QuestionCaptureSegment = {
              id: segmentId,
              questionCaptureId: captureId,
              order: 0,
              rect: region.rect,
              ocrText: null,
              ocrConfidence: null,
              source: "auto_detected",
              createdAt: new Date().toISOString(),
            };
            await repo.saveQuestionCapture(capture);
            await repo.saveCaptureSegment(segment);
          }
        }

        manager.dispose();
        await ocrManager?.dispose();
        await repo.saveLocalPdfTest({ ...test, questionCount: allCandidates.length, updatedAt: new Date().toISOString() });
        setDetectedCount(allCandidates.length);
        if (usedOcrFallback) {
          setErrorMessage(
            "Some pages had no selectable text (scanned images), so OCR was used instead — double-check those question boundaries carefully on the next screen, OCR is less precise than native PDF text."
          );
        }
        setStage("detected");
      } catch (err: any) {
        console.error("QP TO CBT detection failed:", err);
        setErrorMessage(
          err?.reason === "password_protected"
            ? "This PDF is password-protected. Remove the password and try again."
            : err?.reason === "corrupted"
            ? "This PDF couldn't be read — it may be corrupted or not a valid PDF."
            : "Something went wrong reading this PDF."
        );
        setStage("error");
      }
    },
    [format]
  );

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">QP TO CBT</h1>
            <p className="text-muted-foreground">Convert any question paper PDF into a CBT mock test.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <HardDrive className="h-4 w-4 shrink-0" />
          <span>Stored on this device. If browser data is cleared, local tests may be lost.</span>
        </div>

        {stage === "choose_format" && (
          <div className="space-y-4">
            <h2 className="font-semibold">How is the answer key provided?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => { setFormat("same_pdf"); setStage("upload"); }} className="text-left">
                <Card className="h-full transition-colors hover:border-primary cursor-pointer">
                  <CardContent className="p-5 space-y-2">
                    <FileText className="h-8 w-8 text-primary" />
                    <h3 className="font-semibold">Question Paper + Answer Key in Same PDF</h3>
                    <p className="text-xs text-muted-foreground">
                      One PDF containing questions, the answer key, and possibly solutions.
                    </p>
                  </CardContent>
                </Card>
              </button>
              <button onClick={() => { setFormat("separate_pdfs"); setStage("upload"); }} className="text-left">
                <Card className="h-full transition-colors hover:border-primary cursor-pointer">
                  <CardContent className="p-5 space-y-2">
                    <Files className="h-8 w-8 text-primary" />
                    <h3 className="font-semibold">Question Paper and Answer Key in Separate PDFs</h3>
                    <p className="text-xs text-muted-foreground">
                      Two PDFs — one for the questions, one for the answer key.
                    </p>
                  </CardContent>
                </Card>
              </button>
            </div>
          </div>
        )}

        {stage === "upload" && format && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">
                {format === "same_pdf" ? "Upload PDF" : "Upload Question Paper PDF"}
              </h3>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-10 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tap to choose a PDF — any page count</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileSelected(file);
                  }}
                />
              </label>
              {format === "separate_pdfs" && (
                <p className="text-xs text-muted-foreground">
                  You'll upload the Answer Key PDF on the next screen, after the question paper is processed.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {stage === "detecting" && (
          <Card>
            <CardContent className="p-10 flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">{progressLabel || "Processing…"}</p>
              <p className="text-xs text-muted-foreground">Everything is happening on your device — nothing is uploaded.</p>
            </CardContent>
          </Card>
        )}

        {stage === "error" && errorMessage && (
          <Card className="border-destructive/40">
            <CardContent className="p-6 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm">{errorMessage}</p>
                <Button size="sm" variant="outline" onClick={() => setStage("upload")}>Try a different file</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stage === "detected" && (
          <div className="space-y-4">
            {errorMessage && (
              <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
            <Card>
              <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold">{detectedCount} questions detected</h3>
                  <p className="text-xs text-muted-foreground">Across {pageCount} pages — review and correct next.</p>
                </div>
                <Badge variant="secondary">Auto-detected, unreviewed</Badge>
              </CardContent>
            </Card>

            <Button
              className="w-full sm:w-auto"
              onClick={() => navigate(`/qp-to-cbt/capture/${localTestId}`)}
            >
              Review Captures <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
