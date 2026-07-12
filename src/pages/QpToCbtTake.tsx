/**
 * QP TO CBT — Take Test page. FULLY IMPLEMENTED: this is where everything
 * from Phase 1 (adapter, storage, PDF manager) and Phase 2 (capture data)
 * comes together and actually renders inside the real TestInterface.
 *
 * Requires the TestInterface.tsx patch (renderQuestion + initialState
 * props) to already be applied in your repo — see the integration guide.
 * Refresh-recovery uses that initialState prop: if an in-progress
 * LocalTestAttempt exists for this test, its saved answers/timer/position
 * are passed in on mount instead of starting fresh.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Loader2 } from "lucide-react";

import type { LocalPdfTest, QuestionCapture, AnswerKeyEntry, LocalTestAttempt } from "@/features/qp-to-cbt/types";
import * as repo from "@/features/qp-to-cbt/storage/db";
import {
  buildQpCbtQuestions,
  QuestionImageProvider,
  startLocalAttempt,
  submitLocalAttempt,
  persistProgress,
  type QpCbtQuestion,
} from "@/features/qp-to-cbt/adapter/localCbtAdapter";
import { TestInterface } from "@/components/practice/TestInterface";

function QuestionContent({
  capture,
  imageProvider,
  selected,
  onSelect,
}: {
  capture: QuestionCapture;
  imageProvider: QuestionImageProvider;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const [urls, setUrls] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrls(null);
    imageProvider.getSegmentImageUrls(capture).then((u) => {
      if (!cancelled) setUrls(u);
    });
    return () => {
      cancelled = true;
    };
  }, [capture, imageProvider]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {urls === null ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Rendering question…
          </div>
        ) : (
          // Sequential images, not merged into one canvas — cheaper on
          // memory and matches the spec's guidance for multi-segment
          // questions (Segment 1, Segment 2, ... in order).
          urls.map((url, i) => (
            <img key={i} src={url} alt={`Q${capture.questionNumber} part ${i + 1}`} className="w-full rounded-lg border" />
          ))
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 pl-0">
        {(["A", "B", "C", "D"] as const).map((label, index) => (
          <button
            key={label}
            onClick={() => onSelect(index)}
            className={`py-3 rounded-lg border font-semibold transition-colors ${
              selected === index
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/50 hover:bg-accent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function QpToCbtTake() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<LocalPdfTest | null>(null);
  const [captures, setCaptures] = useState<QuestionCapture[]>([]);
  const [answerKey, setAnswerKey] = useState<AnswerKeyEntry[]>([]);
  const [imageProvider, setImageProvider] = useState<QuestionImageProvider | null>(null);
  const [attempt, setAttempt] = useState<LocalTestAttempt | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!testId) return;
    (async () => {
      const t = await repo.getLocalPdfTest(testId);
      if (!t) return;
      setTest(t);

      const [caps, key, provider] = await Promise.all([
        repo.listQuestionCaptures(testId),
        repo.listAnswerKeyEntries(testId),
        QuestionImageProvider.create(t.sourcePdfIds),
      ]);
      setCaptures(caps);
      setAnswerKey(key);
      setImageProvider(provider);

      const existingAttempts = await repo.listAttemptsForTest(testId);
      const inProgress = existingAttempts.find((a) => a.status === "in_progress");
      if (inProgress) {
        setAttempt(inProgress);
        setDurationMinutes(Math.round(inProgress.durationSeconds / 60));
      }

      setLoading(false);
    })();

    return () => {
      imageProvider?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const startTest = useCallback(
    async (minutes: number) => {
      if (!test) return;
      const newAttempt = await startLocalAttempt(test, minutes);
      setAttempt(newAttempt);
      setDurationMinutes(minutes);
    },
    [test]
  );

  const questions: QpCbtQuestion[] = buildQpCbtQuestions(captures, answerKey);
  const questionIdToNumber = new Map(captures.map((c) => [c.id, c.questionNumber]));
  const captureById = new Map(captures.map((c) => [c.id, c]));

  const handleSubmit = async (answers: Record<string, number | null>, timeSpent: Record<string, number>) => {
    if (!attempt || !test) return;
    const analytics = await submitLocalAttempt(attempt, test, captures, answerKey, answers, timeSpent);
    navigate(`/qp-to-cbt/results/${analytics.attemptId}`);
  };

  if (loading || !test || !imageProvider) {
    return (
      <DashboardLayout>
        <div className="p-10 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Preparing test…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (questions.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-lg mx-auto">
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No captured questions yet for this test — go back and capture some first.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!attempt || durationMinutes === null) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-lg mx-auto">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">Start "{test.title}"</h2>
              <p className="text-sm text-muted-foreground">{questions.length} questions. Choose a duration:</p>
              <div className="grid grid-cols-3 gap-2">
                {[questions.length, Math.round(questions.length * 1.5), questions.length * 2].map((m) => (
                  <Button key={m} variant="outline" onClick={() => startTest(m)}>
                    {m} min
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Rehydrate from the saved attempt (refresh-safe resume) — requires the
  // initialState prop from the TestInterface patch.
  const elapsedSinceStart = Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
  const initialAnswers: Record<string, number | null> = {};
  const initialMarked: Record<string, boolean> = {};
  for (const c of captures) {
    const r = attempt.responses[c.questionNumber];
    if (r) {
      initialAnswers[c.id] = r.selectedOption;
      initialMarked[c.id] = r.markedForReview;
    }
  }

  return (
    <TestInterface<QpCbtQuestion>
      questions={questions}
      durationMinutes={durationMinutes}
      initialState={{
        answers: initialAnswers,
        marked: initialMarked,
        timeElapsedSeconds: elapsedSinceStart,
        currentIndex: 0,
      }}
      onSubmit={handleSubmit}
      renderQuestion={(question, selected, onSelect) => {
        const capture = captureById.get(question.id);
        if (!capture) return null;
        return (
          <QuestionContent capture={capture} imageProvider={imageProvider} selected={selected} onSelect={onSelect} />
        );
      }}
    />
  );
}

