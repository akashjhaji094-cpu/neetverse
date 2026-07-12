/**
 * QP TO CBT — local data model.
 *
 * Everything here lives in IndexedDB on the student's device (see storage/db.ts).
 * Nothing in this file is written to Supabase. Field naming follows the flat,
 * DB-mirroring convention already used in src/lib/supabase.ts (no camelCase
 * transform layer), even though these aren't DB rows, for consistency with the
 * rest of the codebase.
 *
 * `id` fields are client-generated (crypto.randomUUID()) — there is no server
 * assigning these.
 */

// ---------------------------------------------------------------------------
// Source PDFs
// ---------------------------------------------------------------------------

export type PdfRole = "question_paper" | "answer_key" | "combined";

/**
 * A PDF the student uploaded. The raw bytes are stored once in IndexedDB
 * (object store `source_pdfs`, keyed by id) and referenced by id everywhere
 * else — we never duplicate the PDF bytes per question.
 */
export interface SourcePdf {
  id: string;
  role: PdfRole;
  fileName: string;
  byteLength: number;
  pageCount: number | null; // null until pdf.js has loaded it at least once
  /** Set once pdf.js successfully parses the document. */
  loadedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Question capture
// ---------------------------------------------------------------------------

/**
 * Normalized crop region on a single PDF page. Ratios are 0..1 relative to
 * the page's own width/height (from pdf.js's unscaled viewport), NOT pixels —
 * this is what lets us re-render the same region at any resolution later
 * (thumbnail for review, full-res for the CBT screen) without storing
 * multiple rasterized copies.
 */
export interface NormalizedRect {
  pageIndex: number; // 0-based
  xRatio: number; // 0..1
  yRatio: number; // 0..1
  widthRatio: number; // 0..1
  heightRatio: number; // 0..1
}

/**
 * One physical region belonging to a question. A simple question has exactly
 * one segment. A question split across a column/page break has multiple,
 * ordered by `order`.
 */
export interface QuestionCaptureSegment {
  id: string;
  questionCaptureId: string;
  order: number; // 0-based, render order within the question
  rect: NormalizedRect;
  /** OCR text for THIS segment only, advisory-only — never rendered as the question. */
  ocrText: string | null;
  ocrConfidence: number | null; // 0..1
  source: "auto_detected" | "manual" | "extended"; // how this segment was created
  createdAt: string;
}

export type CaptureReviewState =
  | "pending_review" // auto-detected, not yet confirmed by student
  | "confirmed" // student reviewed and accepted
  | "needs_attention"; // has an active warning that hasn't been dismissed

export interface CaptureWarning {
  id: string;
  type:
    | "possible_incomplete_capture"
    | "possible_missing_question"
    | "duplicate_question_number"
    | "unexpected_order"
    | "no_capture_region"
    | "unreviewed_segments"
    | "no_answer_detected"
    | "multiple_answers_detected";
  message: string;
  dismissed: boolean;
}

/**
 * A single logical question. `questionNumber` is what's printed on the paper
 * (may be non-sequential or contain gaps — we don't renumber the source).
 */
export interface QuestionCapture {
  id: string;
  localTestId: string;
  questionNumber: number;
  /** Rendered as "Q4", "Q4.1", "Q4.2" in the UI; segments carry the real order. */
  segmentIds: string[];
  subjectId: string | null; // FK into the real Supabase `subjects` table (read-only reference)
  chapterId: string | null; // FK into real `chapters`
  topicAssignment: QuestionTopicAssignment | null;
  reviewState: CaptureReviewState;
  warnings: CaptureWarning[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Topic classification
// ---------------------------------------------------------------------------

/**
 * Mirrors the shape of the real `question_topics` table (topic_id + numeric
 * confidence) on purpose — if a future phase ever promotes a local question
 * into the real `questions` table, this slots in with zero remapping.
 */
export interface QuestionTopicAssignment {
  topicId: string; // FK into real `topics` table
  confidence: number; // 0..1
  method: "local_keyword" | "manual" | "remote_ai";
  needsReview: boolean; // true when confidence is below the classifier's threshold
}

// ---------------------------------------------------------------------------
// Answer key
// ---------------------------------------------------------------------------

export type AnswerOption = 0 | 1 | 2 | 3; // maps to A/B/C/D

export interface AnswerKeyEntry {
  id: string;
  localTestId: string;
  questionNumber: number;
  option: AnswerOption | null; // null = not detected / not yet resolved
  source: "auto_detected" | "manual";
  confidence: number | null; // 0..1, only set for auto_detected
  conflictingOptions: AnswerOption[] | null; // set when detector found >1 candidate for this number
}

// ---------------------------------------------------------------------------
// The generated local test
// ---------------------------------------------------------------------------

export type LocalTestStage =
  | "uploading"
  | "capturing"
  | "reviewing_answer_key"
  | "reviewing_questions"
  | "ready"
  | "in_progress"
  | "completed";

export interface LocalTestSection {
  id: string;
  name: string; // e.g. "Physics" — inferred or user-edited, not hard-coded
  questionNumbers: number[];
}

/**
 * Top-level entity for one converted paper. This is the "LocalPdfTest" from
 * the spec — named LocalPdfTest to distinguish it clearly from the existing
 * Supabase `Attempt`/`attempts` naming (see README §3.2 for why they're separate).
 */
export interface LocalPdfTest {
  id: string;
  title: string;
  sourcePdfIds: string[]; // 1 (combined) or 2 (question paper + answer key)
  stage: LocalTestStage;
  sections: LocalTestSection[];
  questionCount: number;
  /**
   * Reserved for a future premium cloud-backup phase. Not implemented now —
   * see README §4/§5. Kept here so adding sync later doesn't require a
   * schema migration of existing local tests.
   */
  syncStatus: "local_only" | "pending_sync" | "synced";
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Attempts (local — deliberately NOT the Supabase `attempts` table, see README §3.2)
// ---------------------------------------------------------------------------

export type LocalTestStatus = "in_progress" | "submitted";

export interface LocalQuestionResponse {
  questionNumber: number;
  selectedOption: AnswerOption | null;
  markedForReview: boolean;
  timeSpentSeconds: number;
  visited: boolean;
}

/**
 * Structurally parallel to `Attempt` in src/lib/supabase.ts on purpose, so
 * analytics math can be shared conceptually. `startedAt`/timer semantics
 * follow the same timestamp-based approach as the existing CBT system
 * (see adapter/localCbtAdapter.ts) rather than a countdown that resets on
 * refresh.
 */
export interface LocalTestAttempt {
  id: string;
  localTestId: string;
  status: LocalTestStatus;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number; // configured test duration
  currentQuestionNumber: number;
  responses: Record<number, LocalQuestionResponse>; // keyed by questionNumber
}

/**
 * Computed, not stored authoritatively — derived from a LocalTestAttempt +
 * the test's AnswerKeyEntry list whenever the result screen is shown, then
 * cached here so re-opening the analysis doesn't recompute. Shape mirrors
 * what MockAnalysis.tsx already renders (subject/chapter/topic rollups).
 */
export interface LocalTestAnalytics {
  attemptId: string;
  score: number;
  correct: number;
  wrong: number;
  unattempted: number;
  /** Questions with no answer key entry — excluded from score, shown separately. */
  unresolved: number;
  accuracy: number; // 0..100, excludes unresolved from the denominator
  bySubject: Array<{ subjectId: string; correct: number; wrong: number; unattempted: number }>;
  byChapter: Array<{ chapterId: string; correct: number; wrong: number; unattempted: number }>;
  byTopic: Array<{
    topicId: string | "unclassified";
    correct: number;
    wrong: number;
    unattempted: number;
  }>;
  computedAt: string;
}
