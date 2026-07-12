/**
 * QP TO CBT — entry page (FULLY IMPLEMENTED: format selection + upload +
 * a real, working first pass of the detection pipeline against whatever
 * PDF the student uploads).
 *
 * What happens after "Files ready" here is intentionally the simplified
 * slice: it runs the real question-number detector across every page and
 * lists what it found. The full visual bounding-box capture editor (drag,
 * resize, Extend Capture, multi-touch) is NOT built in this file — see
 * README §4, "PARTIALLY IMPLEMENTED" / "ARCHITECTED FOR NEXT PHASE". This
 * page proves the upload -> parse -> detect pipeline is real and working
 * end-to-end on an actual PDF, without pretending the polished capture UI
 * exists yet.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FileText, Files, Upload, Loader2, HardDrive, AlertTriangle } from "lucide-react";

import type { LocalPdfTest, SourcePdf } from "@/features/qp-to-cbt/types";
import * as repo from "@/features/qp-to-cbt/storage/db";
import { PdfDocumentManager } from "@/features/qp-to-cbt/pdf/pdfDocumentManager";
import {
  detectColumnGutters,
  detectQuestionNumberCandidates,
  proposeCaptureBoundaries,
  type QuestionNumberCandidate,
} from "@/features/qp-to-cbt/detection/questionNumberDetector";
import { buildColumnBands, compareReadingOrder } from "@/features/qp-to-cbt/capture/coordinates";

type AnswerKeyFormat = "same_pdf" | "separate_pdfs";
type Stage = "choose_format" | "upload" | "detecting" | "detected" | "error";

export default function QpToCbt() {
  const navigate = useNavigate();
  const [format, setFormat] = useState<AnswerKeyFormat | null>(null);
  const [stage, setStage] = useState<Stage>("choose_format");
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<QuestionNumberCandidate[]>([]);
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

        // No page cap, per spec — this loop genuinely runs across however
        // many pages pdf.js reports, whether that's 8 or 200.
        const allCandidates: QuestionNumberCandidate[] = [];
        let expectedNext: number | null = null;

        for (let pageIndex = 0; pageIndex < manager.pageCount; pageIndex++) {
          setProgressLabel(`Scanning page ${pageIndex + 1} of ${manager.pageCount}`);
          const layout = await manager.getPageTextLayout(pageIndex);
          const gutters = detectColumnGutters(layout);
          const bands = buildColumnBands(gutters);
          const pageCandidates = detectQuestionNumberCandidates(layout, bands, expectedNext);
          const ordered = pageCandidates.sort((a, b) => compareReadingOrder(
            { pageIndex: a.pageIndex, xRatio: a.xRatio, yRatio: a.yRatio, widthRatio: 0, heightRatio: 0 },
            { pageIndex: b.pageIndex, xRatio: b.xRatio, yRatio: b.yRatio, widthRatio: 0, heightRatio: 0 },
            bands
          ));
          allCandidates.push(...ordered);
          if (ordered.length > 0) expectedNext = ordered[ordered.length - 1].questionNumber + 1;
        }

        manager.dispose();
        setCandidates(allCandidates);
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
                  You'll upload the Answer Key PDF next, after the question paper is processed.
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
              <CardContent className="p-5 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold">{candidates.length} questions detected</h3>
                  <p className="text-xs text-muted-foreground">Across {pageCount} pages — review before continuing.</p>
                </div>
                <Badge variant="secondary">Auto-detected, unreviewed</Badge>
              </CardContent>
            </Card>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {candidates.map((c, i) => (
                <div
                  key={`${c.pageIndex}-${c.yRatio}-${i}`}
                  className="border rounded-lg p-2 text-center text-xs"
                  title={`Page ${c.pageIndex + 1}, column ${c.column + 1}, confidence ${Math.round(c.confidence * 100)}%`}
                >
                  <div className="font-semibold">Q{c.questionNumber}</div>
                  <div className={`h-1 rounded-full mt-1 ${c.confidence >= 0.7 ? "bg-green-500" : "bg-amber-500"}`} />
                </div>
              ))}
            </div>

            <Card className="bg-muted/30">
              <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
                <p>
                  This is the raw detection pass — the visual capture editor (drag to adjust each
                  region, Extend Capture for split questions, manual capture) is the next phase of
                  this feature and isn't wired into this screen yet. Local test id:{" "}
                  <code className="text-[10px]">{localTestId}</code>
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

