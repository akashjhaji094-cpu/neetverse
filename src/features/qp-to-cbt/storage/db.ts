/**
 * QP TO CBT — IndexedDB repository.
 *
 * All large/binary data (PDF bytes) and all structured local-test data lives
 * here. Nothing from this module ever touches localStorage — localStorage is
 * unsuitable for PDF-sized blobs and has a much smaller quota.
 *
 * Requires the `idb` package (thin Promise wrapper over IndexedDB — see
 * README §6 for why this is worth a dependency rather than hand-rolling
 * raw IndexedDB callbacks).
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  SourcePdf,
  QuestionCapture,
  QuestionCaptureSegment,
  AnswerKeyEntry,
  LocalPdfTest,
  LocalTestAttempt,
  LocalTestAnalytics,
} from "../types";

const DB_NAME = "neetverse-qp-to-cbt";
const DB_VERSION = 1;

interface QpToCbtDB extends DBSchema {
  source_pdfs: {
    key: string;
    value: SourcePdf & { bytes: Blob };
  };
  local_pdf_tests: {
    key: string;
    value: LocalPdfTest;
  };
  question_captures: {
    key: string;
    value: QuestionCapture;
    indexes: { by_local_test: string };
  };
  capture_segments: {
    key: string;
    value: QuestionCaptureSegment;
    indexes: { by_question_capture: string };
  };
  answer_key_entries: {
    key: string;
    value: AnswerKeyEntry;
    indexes: { by_local_test: string };
  };
  local_test_attempts: {
    key: string;
    value: LocalTestAttempt;
    indexes: { by_local_test: string };
  };
  local_test_analytics: {
    key: string; // attemptId
    value: LocalTestAnalytics;
  };
}

let dbPromise: Promise<IDBPDatabase<QpToCbtDB>> | null = null;

function getDb(): Promise<IDBPDatabase<QpToCbtDB>> {
  if (!dbPromise) {
    dbPromise = openDB<QpToCbtDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("source_pdfs", { keyPath: "id" });
        db.createObjectStore("local_pdf_tests", { keyPath: "id" });

        const captures = db.createObjectStore("question_captures", { keyPath: "id" });
        captures.createIndex("by_local_test", "localTestId");

        const segments = db.createObjectStore("capture_segments", { keyPath: "id" });
        segments.createIndex("by_question_capture", "questionCaptureId");

        const answers = db.createObjectStore("answer_key_entries", { keyPath: "id" });
        answers.createIndex("by_local_test", "localTestId");

        const attempts = db.createObjectStore("local_test_attempts", { keyPath: "id" });
        attempts.createIndex("by_local_test", "localTestId");

        db.createObjectStore("local_test_analytics", { keyPath: "attemptId" });
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Storage quota
// ---------------------------------------------------------------------------

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  usageRatio: number; // 0..1
  /** True once usage crosses 80% of quota — surface a warning before writes start failing. */
  nearingLimit: boolean;
}

/**
 * Call before starting a new PDF upload so the UI can warn the student
 * ("Stored on this device — nearing storage limit, consider deleting old
 * tests") rather than let a write fail mid-capture.
 */
export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (!("storage" in navigator) || !navigator.storage.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  const usageRatio = quota > 0 ? usage / quota : 0;
  return { usageBytes: usage, quotaBytes: quota, usageRatio, nearingLimit: usageRatio > 0.8 };
}

// ---------------------------------------------------------------------------
// Source PDFs
// ---------------------------------------------------------------------------

export async function saveSourcePdf(meta: SourcePdf, bytes: Blob): Promise<void> {
  const db = await getDb();
  await db.put("source_pdfs", { ...meta, bytes });
}

export async function getSourcePdf(id: string): Promise<(SourcePdf & { bytes: Blob }) | undefined> {
  const db = await getDb();
  return db.get("source_pdfs", id);
}

export async function updateSourcePdfMeta(id: string, patch: Partial<SourcePdf>): Promise<void> {
  const db = await getDb();
  const existing = await db.get("source_pdfs", id);
  if (!existing) throw new Error(`SourcePdf ${id} not found`);
  await db.put("source_pdfs", { ...existing, ...patch });
}

export async function deleteSourcePdf(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("source_pdfs", id);
}

// ---------------------------------------------------------------------------
// LocalPdfTest
// ---------------------------------------------------------------------------

export async function saveLocalPdfTest(test: LocalPdfTest): Promise<void> {
  const db = await getDb();
  await db.put("local_pdf_tests", test);
}

export async function getLocalPdfTest(id: string): Promise<LocalPdfTest | undefined> {
  const db = await getDb();
  return db.get("local_pdf_tests", id);
}

export async function listLocalPdfTests(): Promise<LocalPdfTest[]> {
  const db = await getDb();
  const all = await db.getAll("local_pdf_tests");
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Deletes the test and every dependent capture/segment/answer/attempt/analytics row. Source PDFs are left (may be shared/kept for re-review) unless `deleteSourcePdfs` is passed. */
export async function deleteLocalPdfTest(id: string, opts?: { deleteSourcePdfs?: boolean }): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ["local_pdf_tests", "question_captures", "capture_segments", "answer_key_entries", "local_test_attempts", "local_test_analytics", "source_pdfs"],
    "readwrite"
  );

  const test = await tx.objectStore("local_pdf_tests").get(id);

  const captures = await tx.objectStore("question_captures").index("by_local_test").getAll(id);
  for (const capture of captures) {
    const segStore = tx.objectStore("capture_segments").index("by_question_capture");
    const segments = await segStore.getAll(capture.id);
    for (const seg of segments) await tx.objectStore("capture_segments").delete(seg.id);
    await tx.objectStore("question_captures").delete(capture.id);
  }

  const answers = await tx.objectStore("answer_key_entries").index("by_local_test").getAll(id);
  for (const a of answers) await tx.objectStore("answer_key_entries").delete(a.id);

  const attempts = await tx.objectStore("local_test_attempts").index("by_local_test").getAll(id);
  for (const attempt of attempts) {
    await tx.objectStore("local_test_analytics").delete(attempt.id);
    await tx.objectStore("local_test_attempts").delete(attempt.id);
  }

  await tx.objectStore("local_pdf_tests").delete(id);

  if (opts?.deleteSourcePdfs && test) {
    for (const pdfId of test.sourcePdfIds) await tx.objectStore("source_pdfs").delete(pdfId);
  }

  await tx.done;
}

// ---------------------------------------------------------------------------
// Question captures + segments
// ---------------------------------------------------------------------------

export async function saveQuestionCapture(capture: QuestionCapture): Promise<void> {
  const db = await getDb();
  await db.put("question_captures", capture);
}

export async function listQuestionCaptures(localTestId: string): Promise<QuestionCapture[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("question_captures", "by_local_test", localTestId);
  return all.sort((a, b) => a.questionNumber - b.questionNumber);
}

export async function deleteQuestionCapture(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["question_captures", "capture_segments"], "readwrite");
  const segments = await tx.objectStore("capture_segments").index("by_question_capture").getAll(id);
  for (const seg of segments) await tx.objectStore("capture_segments").delete(seg.id);
  await tx.objectStore("question_captures").delete(id);
  await tx.done;
}

export async function saveCaptureSegment(segment: QuestionCaptureSegment): Promise<void> {
  const db = await getDb();
  await db.put("capture_segments", segment);
}

export async function listCaptureSegments(questionCaptureId: string): Promise<QuestionCaptureSegment[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("capture_segments", "by_question_capture", questionCaptureId);
  return all.sort((a, b) => a.order - b.order);
}

export async function deleteCaptureSegment(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("capture_segments", id);
}

// ---------------------------------------------------------------------------
// Answer key
// ---------------------------------------------------------------------------

export async function saveAnswerKeyEntry(entry: AnswerKeyEntry): Promise<void> {
  const db = await getDb();
  await db.put("answer_key_entries", entry);
}

export async function saveAnswerKeyEntries(entries: AnswerKeyEntry[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("answer_key_entries", "readwrite");
  await Promise.all(entries.map((e) => tx.store.put(e)));
  await tx.done;
}

export async function listAnswerKeyEntries(localTestId: string): Promise<AnswerKeyEntry[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("answer_key_entries", "by_local_test", localTestId);
  return all.sort((a, b) => a.questionNumber - b.questionNumber);
}

// ---------------------------------------------------------------------------
// Attempts + analytics
// ---------------------------------------------------------------------------

export async function saveLocalTestAttempt(attempt: LocalTestAttempt): Promise<void> {
  const db = await getDb();
  await db.put("local_test_attempts", attempt);
}

export async function getLocalTestAttempt(id: string): Promise<LocalTestAttempt | undefined> {
  const db = await getDb();
  return db.get("local_test_attempts", id);
}

export async function listAttemptsForTest(localTestId: string): Promise<LocalTestAttempt[]> {
  const db = await getDb();
  return db.getAllFromIndex("local_test_attempts", "by_local_test", localTestId);
}

export async function saveLocalTestAnalytics(analytics: LocalTestAnalytics): Promise<void> {
  const db = await getDb();
  await db.put("local_test_analytics", analytics);
}

export async function getLocalTestAnalytics(attemptId: string): Promise<LocalTestAnalytics | undefined> {
  const db = await getDb();
  return db.get("local_test_analytics", attemptId);
}
