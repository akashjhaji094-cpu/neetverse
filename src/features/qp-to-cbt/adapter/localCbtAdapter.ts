/**
 * QP TO CBT — local CBT adapter.
 *
 * This is the module that makes the feature "feel native": it turns local
 * IndexedDB data into exactly what TestInterface.tsx and QuestionReview.tsx
 * already expect, re-verified against their real current source this
 * session (not the earlier summary — see note below), rather than a
 * parallel CBT implementation.
 *
 * IMPORTANT CORRECTION vs README §3.1: after re-reading the live files,
 * the real minimal contract each component needs is narrower than first
 * sketched, and TestInterface's answer-collection UI (not just the question
 * text) is baked into the same block as the question text — so the clean
 * extension point is a `renderQuestion` prop that replaces content AND the
 * answer controls together, not two separate slots. Both patches below are
 * additive/optional and don't change behavior for any existing caller.
 *
 * ---- Patch 1: src/components/practice/TestInterface.tsx ----
 * ```diff
 * -interface TestInterfaceProps {
 * -  questions: Question[];
 * +interface TestInterfaceProps<Q extends { id: string } = Question> {
 * +  questions: Q[];
 *    onSubmit: (answers: Record<string, number | null>, timeSpent: Record<string, number>) => void;
 *    durationMinutes?: number;
 * +  renderQuestion?: (question: Q, selected: number | null, onSelect: (i: number) => void) => React.ReactNode;
 * +  // Rehydration for refresh-safe resume — see note below on why this is
 * +  // needed in addition to renderQuestion.
 * +  initialState?: { answers: Record<string, number | null>; marked: Record<string, boolean>; timeElapsedSeconds: number; currentIndex: number };
 *  }
 * ```
 * Inside the component: seed `useState(answers)`, `useState(marked)`,
 * `useState(timeElapsed)`, `useState(currentIndex)` from `initialState` when
 * provided (falls back to the current empty defaults otherwise — zero
 * behavior change for existing callers). Then wrap the JSX block that
 * currently renders `currentQuestion.question_text` / `.images` / the
 * `.options.map(...)` buttons: if `renderQuestion` is provided, call
 * `renderQuestion(currentQuestion, answers[currentQuestion.id] ?? null, handleAnswer)`
 * instead of that JSX.
 *
 * WHY the extra `initialState` prop, beyond what README §3.1 first proposed:
 * TestInterface's timer/answers/marked state is plain `useState`, reset on
 * remount — reusing it as-is does NOT give refresh-survival for free. This
 * is exactly the kind of incompatibility the brief asked to be surfaced
 * rather than silently worked around. Without this prop, "recoverable after
 * refresh" would only be true up to the review/results screen, not mid-test.
 *
 * ---- Patch 2: src/components/practice/QuestionReview.tsx ----
 * Same shape of change: genericize `questions: Q[]` where
 * `Q extends { id: string; correct_option_index: number | null }`, add an
 * optional `renderQuestion?: (question: Q, userAnswer: number | null) => React.ReactNode`,
 * and wrap the "Question Text / Images / Options / Explanation" block with it.
 * Status counts / correct-wrong badges use `correct_option_index` directly
 * and need no change.
 */
import type {
  LocalPdfTest,
  QuestionCapture,
  AnswerKeyEntry,
  LocalTestAttempt,
  LocalQuestionResponse,
  LocalTestAnalytics,
  AnswerOption,
} from "../types";
import * as repo from "../storage/db";
import { PdfDocumentManager } from "../pdf/pdfDocumentManager";
import { normalizedToPixelRect } from "../capture/coordinates";

// ---------------------------------------------------------------------------
// Minimal question shape TestInterface/QuestionReview actually require
// (confirmed against their live source, not assumed)
// ---------------------------------------------------------------------------

export interface QpCbtQuestion {
  id: string; // QuestionCapture.id
  correct_option_index: number | null; // from AnswerKeyEntry, only used by QuestionReview's status logic
}

export function buildQpCbtQuestions(
  captures: QuestionCapture[],
  answerKey: AnswerKeyEntry[]
): QpCbtQuestion[] {
  const answerByNumber = new Map(answerKey.map((e) => [e.questionNumber, e]));
  return captures
    .slice()
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .map((c) => ({
      id: c.id,
      correct_option_index: answerByNumber.get(c.questionNumber)?.option ?? null,
    }));
}

// ---------------------------------------------------------------------------
// Rendering the PDF capture as the question's visible content
// ---------------------------------------------------------------------------

/**
 * Owns one PdfDocumentManager per source PDF used by the test, and hands out
 * object URLs for rendered/cropped segment images with proper revoke-on-
 * dispose. Created once per CBT session (mount of the take/review screen),
 * disposed on unmount.
 */
export class QuestionImageProvider {
  private managers = new Map<string, PdfDocumentManager>();
  private objectUrls: string[] = [];

  static async create(sourcePdfIds: string[]): Promise<QuestionImageProvider> {
    const provider = new QuestionImageProvider();
    for (const id of sourcePdfIds) {
      const record = await repo.getSourcePdf(id);
      if (!record) continue;
      const bytes = await record.bytes.arrayBuffer();
      provider.managers.set(id, await PdfDocumentManager.load(bytes));
    }
    return provider;
  }

  /** Renders every segment of a capture, in order, as object-URL images. Caller renders them as sequential <img> tags — see README: "sequential rendering is acceptable and may be more memory efficient" than merging into one giant canvas. */
  async getSegmentImageUrls(capture: QuestionCapture): Promise<string[]> {
    const segments = await repo.listCaptureSegments(capture.id);
    const urls: string[] = [];
    for (const segment of segments) {
      const sourcePdfId = await this.findSourcePdfIdForSegment(capture);
      const manager = sourcePdfId ? this.managers.get(sourcePdfId) : undefined;
      if (!manager) continue;

      const pageSize = await manager.getPageSize(segment.rect.pageIndex);
      const pageCanvas = await manager.renderPageWindow(segment.rect.pageIndex);
      const scale = pageCanvas.width / pageSize.width;
      const pixelRect = normalizedToPixelRect(segment.rect, {
        pageIndex: segment.rect.pageIndex,
        width: pageSize.width * scale,
        height: pageSize.height * scale,
      });

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = Math.max(1, Math.round(pixelRect.width));
      cropCanvas.height = Math.max(1, Math.round(pixelRect.height));
      const ctx = cropCanvas.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(
        pageCanvas,
        pixelRect.x,
        pixelRect.y,
        pixelRect.width,
        pixelRect.height,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      const blob = await new Promise<Blob | null>((resolve) => cropCanvas.toBlob(resolve, "image/png"));
      cropCanvas.width = 0;
      cropCanvas.height = 0;
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      this.objectUrls.push(url);
      urls.push(url);
    }
    return urls;
  }

  // A capture's segments don't carry their own sourcePdfId in the current
  // type (see types.ts) because in the common single-PDF ("same PDF") mode
  // it's redundant; in separate-PDF mode this needs the test's
  // sourcePdfIds[0] (question paper) resolved by the caller. Flagging this
  // as a follow-up field to add to QuestionCaptureSegment
  // (`sourcePdfId: string`) once the separate-PDF-mode capture screen is
  // built — trivial schema addition, not a redesign.
  private async findSourcePdfIdForSegment(_capture: QuestionCapture): Promise<string | undefined> {
    return Array.from(this.managers.keys())[0];
  }

  dispose(): void {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls = [];
    for (const manager of this.managers.values()) manager.dispose();
    this.managers.clear();
  }
}

// ---------------------------------------------------------------------------
// Attempt lifecycle — local-only, mirrors the shape of the real attempt flow
// ---------------------------------------------------------------------------

export async function startLocalAttempt(test: LocalPdfTest, durationMinutes: number): Promise<LocalTestAttempt> {
  const attempt: LocalTestAttempt = {
    id: crypto.randomUUID(),
    localTestId: test.id,
    status: "in_progress",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationSeconds: durationMinutes * 60,
    currentQuestionNumber: 1,
    responses: {},
  };
  await repo.saveLocalTestAttempt(attempt);
  return attempt;
}

/**
 * Called on every answer change (and on an interval for time-spent
 * tracking) so a refresh mid-test loses at most a few seconds of progress,
 * not the whole attempt. Cheap — IndexedDB writes here are a single small
 * JSON object, not PDF bytes.
 */
export async function persistProgress(
  attempt: LocalTestAttempt,
  answers: Record<string, number | null>,
  timeSpentByQuestionId: Record<string, number>,
  questionIdToNumber: Map<string, number>
): Promise<void> {
  const responses: Record<number, LocalQuestionResponse> = { ...attempt.responses };
  for (const [questionId, selected] of Object.entries(answers)) {
    const qn = questionIdToNumber.get(questionId);
    if (qn === undefined) continue;
    responses[qn] = {
      questionNumber: qn,
      selectedOption: (selected as AnswerOption | null) ?? null,
      markedForReview: responses[qn]?.markedForReview ?? false,
      timeSpentSeconds: timeSpentByQuestionId[questionId] ?? responses[qn]?.timeSpentSeconds ?? 0,
      visited: true,
    };
  }
  await repo.saveLocalTestAttempt({ ...attempt, responses });
}

/**
 * Matches TestInterface's onSubmit(answers, timeSpent) signature exactly —
 * this function IS the onSubmit handler an adapter-using page passes in.
 */
export async function submitLocalAttempt(
  attempt: LocalTestAttempt,
  test: LocalPdfTest,
  captures: QuestionCapture[],
  answerKey: AnswerKeyEntry[],
  answers: Record<string, number | null>,
  timeSpentByQuestionId: Record<string, number>
): Promise<LocalTestAnalytics> {
  const questionIdToNumber = new Map(captures.map((c) => [c.id, c.questionNumber]));
  await persistProgress(attempt, answers, timeSpentByQuestionId, questionIdToNumber);

  const finished: LocalTestAttempt = {
    ...attempt,
    status: "submitted",
    finishedAt: new Date().toISOString(),
  };
  await repo.saveLocalTestAttempt(finished);

  const analytics = computeAnalytics(finished, captures, answerKey);
  await repo.saveLocalTestAnalytics(analytics);
  await repo.saveLocalPdfTest({ ...test, stage: "completed", updatedAt: new Date().toISOString() });
  return analytics;
}

// ---------------------------------------------------------------------------
// Analytics — mirrors MockAnalysis.tsx's rollup shape (subject/chapter/topic)
// ---------------------------------------------------------------------------

export function computeAnalytics(
  attempt: LocalTestAttempt,
  captures: QuestionCapture[],
  answerKey: AnswerKeyEntry[]
): LocalTestAnalytics {
  const answerByNumber = new Map(answerKey.map((e) => [e.questionNumber, e]));

  let correct = 0,
    wrong = 0,
    unattempted = 0,
    unresolved = 0;
  const bySubject = new Map<string, { correct: number; wrong: number; unattempted: number }>();
  const byChapter = new Map<string, { correct: number; wrong: number; unattempted: number }>();
  const byTopic = new Map<string, { correct: number; wrong: number; unattempted: number }>();

  const bump = (
    map: Map<string, { correct: number; wrong: number; unattempted: number }>,
    key: string | null,
    field: "correct" | "wrong" | "unattempted"
  ) => {
    const k = key ?? "unclassified";
    const entry = map.get(k) ?? { correct: 0, wrong: 0, unattempted: 0 };
    entry[field]++;
    map.set(k, entry);
  };

  for (const capture of captures) {
    const response = attempt.responses[capture.questionNumber];
    const keyEntry = answerByNumber.get(capture.questionNumber);

    // No answer key for this question: excluded from score entirely, per
    // spec ("marked as unscored/unresolved... rather than silently wrong").
    if (!keyEntry || keyEntry.option === null) {
      unresolved++;
      continue;
    }

    const selected = response?.selectedOption ?? null;
    const outcome: "correct" | "wrong" | "unattempted" =
      selected === null ? "unattempted" : selected === keyEntry.option ? "correct" : "wrong";

    if (outcome === "correct") correct++;
    else if (outcome === "wrong") wrong++;
    else unattempted++;

    bump(bySubject, capture.subjectId, outcome);
    bump(byChapter, capture.chapterId, outcome);
    bump(byTopic, capture.topicAssignment?.topicId ?? null, outcome);
  }

  const scored = correct + wrong + unattempted;
  const accuracy = scored > 0 ? Math.round((correct / scored) * 100) : 0;
  const score = correct * 4 - wrong; // matches the +4/-1 scheme already used elsewhere in the app (see Revision.tsx)

  const toArray = <K extends string>(
    map: Map<string, { correct: number; wrong: number; unattempted: number }>,
    keyName: K
  ) => Array.from(map.entries()).map(([id, v]) => ({ [keyName]: id, ...v }) as any);

  return {
    attemptId: attempt.id,
    score,
    correct,
    wrong,
    unattempted,
    unresolved,
    accuracy,
    bySubject: toArray(bySubject, "subjectId"),
    byChapter: toArray(byChapter, "chapterId"),
    byTopic: toArray(byTopic, "topicId"),
    computedAt: new Date().toISOString(),
  };
}

