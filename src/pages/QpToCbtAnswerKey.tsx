/**
 * QP TO CBT — Answer Key Review page. FULLY IMPLEMENTED for automatic
 * detection + manual correction. "Select Answer Key Region Manually" (the
 * spec's fallback for when auto-detection picks the wrong region) is NOT
 * built in this page — the parser already accepts a `manualRegions` option
 * (see answerKeyParser.ts) so wiring a CaptureCanvas-based region picker
 * in here is additive, not a redesign; flagged as the next increment.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Loader2, Upload, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";

import type { LocalPdfTest, SourcePdf, AnswerKeyEntry, AnswerOption } from "@/features/qp-to-cbt/types";
import * as repo from "@/features/qp-to-cbt/storage/db";
import { PdfDocumentManager } from "@/features/qp-to-cbt/pdf/pdfDocumentManager";
import { parseAnswerKeyFromPages, summarizeAnswerKeyReview } from "@/features/qp-to-cbt/answer-key/answerKeyParser";

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

export default function QpToCbtAnswerKey() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<LocalPdfTest | null>(null);
  const [needsAnswerKeyUpload, setNeedsAnswerKeyUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AnswerKeyEntry[]>([]);
  const [capturedNumbers, setCapturedNumbers] = useState<number[]>([]);
  const [progressLabel, setProgressLabel] = useState("");

  const runDetection = useCallback(async (t: LocalPdfTest, answerKeySourceId: string) => {
    setLoading(true);
    const sourcePdf = await repo.getSourcePdf(answerKeySourceId);
    if (!sourcePdf) {
      setLoading(false);
      return;
    }
    const bytes = await sourcePdf.bytes.arrayBuffer();
    const manager = await PdfDocumentManager.load(bytes);

    const layouts = [];
    for (let i = 0; i < manager.pageCount; i++) {
      setProgressLabel(`Scanning page ${i + 1} of ${manager.pageCount} for the answer key…`);
      layouts.push(await manager.getPageTextLayout(i));
    }
    manager.dispose();

    const { entries: parsed } = parseAnswerKeyFromPages(layouts);
    const withTestId = parsed.map((e) => ({ ...e, localTestId: t.id }));
    await repo.saveAnswerKeyEntries(withTestId);
    setEntries(withTestId);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!testId) return;
    (async () => {
      const t = await repo.getLocalPdfTest(testId);
      if (!t) return;
      setTest(t);

      const captures = await repo.listQuestionCaptures(testId);
      setCapturedNumbers(captures.map((c) => c.questionNumber));

      const existingEntries = await repo.listAnswerKeyEntries(testId);
      if (existingEntries.length > 0) {
        setEntries(existingEntries);
        setLoading(false);
        return;
      }

      // Same-PDF mode: the question paper PDF also holds the answer key —
      // re-scan it. Separate-PDF mode: sourcePdfIds only has the question
      // paper so far (see QpToCbt.tsx) — prompt for the answer key PDF.
      if (t.sourcePdfIds.length >= 2) {
        await runDetection(t, t.sourcePdfIds[1]);
      } else {
        const sourcePdf = await repo.getSourcePdf(t.sourcePdfIds[0]);
        if (sourcePdf?.role === "combined") {
          await runDetection(t, t.sourcePdfIds[0]);
        } else {
          setNeedsAnswerKeyUpload(true);
          setLoading(false);
        }
      }
    })();
  }, [testId, runDetection]);

  const handleAnswerKeyFile = async (file: File) => {
    if (!test) return;
    const sourcePdf: SourcePdf = {
      id: crypto.randomUUID(),
      role: "answer_key",
      fileName: file.name,
      byteLength: file.size,
      pageCount: null,
      loadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await repo.saveSourcePdf(sourcePdf, file);
    const updatedTest = { ...test, sourcePdfIds: [...test.sourcePdfIds, sourcePdf.id], updatedAt: new Date().toISOString() };
    await repo.saveLocalPdfTest(updatedTest);
    setTest(updatedTest);
    setNeedsAnswerKeyUpload(false);
    await runDetection(updatedTest, sourcePdf.id);
  };

  const handleOptionChange = async (questionNumber: number, option: AnswerOption) => {
    if (!test) return;
    const existing = entries.find((e) => e.questionNumber === questionNumber);
    const updated: AnswerKeyEntry = existing
      ? { ...existing, option, source: "manual", conflictingOptions: null, confidence: null }
      : {
          id: crypto.randomUUID(),
          localTestId: test.id,
          questionNumber,
          option,
          source: "manual",
          confidence: null,
          conflictingOptions: null,
        };
    await repo.saveAnswerKeyEntry(updated);
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.questionNumber === questionNumber);
      if (idx === -1) return [...prev, updated];
      return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
    });
  };

  const summary = summarizeAnswerKeyReview(capturedNumbers, entries);
  const entryByNumber = new Map(entries.map((e) => [e.questionNumber, e]));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-10 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{progressLabel || "Loading…"}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (needsAnswerKeyUpload) {
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-6 max-w-2xl">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">Upload Answer Key PDF</h2>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-10 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tap to choose the answer key PDF</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAnswerKeyFile(file);
                  }}
                />
              </label>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-4 max-w-3xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold">Answer Key Review</h1>
          <Button onClick={() => navigate(`/qp-to-cbt/take/${testId}`)}>
            Generate CBT Test <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Captured", value: summary.questionsCaptured },
            { label: "Detected", value: summary.answersDetected },
            { label: "Missing", value: summary.missingAnswers, warn: summary.missingAnswers > 0 },
            { label: "Conflicts", value: summary.potentialConflicts, warn: summary.potentialConflicts > 0 },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold ${stat.warn ? "text-amber-600" : ""}`}>{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {summary.missingAnswers === 0 && summary.potentialConflicts === 0 && (
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4" /> Every captured question has a detected answer.
          </div>
        )}

        <Card>
          <CardContent className="p-3 divide-y">
            {capturedNumbers
              .slice()
              .sort((a, b) => a - b)
              .map((qn) => {
                const entry = entryByNumber.get(qn);
                const hasConflict = !!entry?.conflictingOptions?.length;
                return (
                  <div key={qn} className="flex items-center justify-between py-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium w-12">Q{qn}</span>
                      {!entry || entry.option === null ? (
                        <Badge variant="destructive" className="text-[10px]">Not detected</Badge>
                      ) : hasConflict ? (
                        <Badge className="text-[10px] bg-amber-500">Conflict</Badge>
                      ) : entry.source === "manual" ? (
                        <Badge variant="secondary" className="text-[10px]">Manual</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Auto</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {OPTION_LABELS.map((label, idx) => (
                        <button
                          key={label}
                          onClick={() => handleOptionChange(qn, idx as AnswerOption)}
                          className={`h-7 w-7 rounded text-xs font-semibold border ${
                            entry?.option === idx
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {summary.warnings.length > 0 && (
          <Card className="border-amber-400/50 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-3 space-y-1 max-h-32 overflow-y-auto">
              {summary.warnings.slice(0, 10).map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

