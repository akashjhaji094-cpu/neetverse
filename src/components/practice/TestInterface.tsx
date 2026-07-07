// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Question } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, Flag, Bookmark } from "lucide-react";
import { formatQuestionHtml, formatOptionHtml } from "@/lib/questionFormatter";
import { MathContent } from "@/components/MathContent";
import { motion, AnimatePresence } from "framer-motion";

interface TestInterfaceProps {
  questions: Question[];
  onSubmit: (answers: Record<string, number | null>, timeSpent: Record<string, number>) => void;
}

export const TestInterface = ({ questions, onSubmit }: TestInterfaceProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true });
  // Per-question time spent, in whole seconds. Keyed by question id.
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<string, number>>({});
  const questionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    setVisited(prev => ({ ...prev, [currentIndex]: true }));
  }, [currentIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleAnswer = (optionIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: optionIndex
    }));
  };

  // Adds however long we've been sitting on the current question to its
  // running total, then resets the clock. Call right before the visible
  // question changes (Next / Previous / palette jump / submit), and use
  // the RETURNED map immediately — questionTimeSpent state won't be
  // updated yet in the same tick.
  const commitCurrentQuestionTime = () => {
    const q = questions[currentIndex];
    if (!q) return questionTimeSpent;
    const elapsedSec = Math.max(0, Math.round((Date.now() - questionStartRef.current) / 1000));
    const updated = {
      ...questionTimeSpent,
      [q.id]: (questionTimeSpent[q.id] || 0) + elapsedSec,
    };
    setQuestionTimeSpent(updated);
    questionStartRef.current = Date.now();
    return updated;
  };

  const goToQuestion = (idx: number) => {
    if (idx < 0 || idx >= questions.length || idx === currentIndex) return;
    commitCurrentQuestionTime();
    setCurrentIndex(idx);
  };

  const handleNext = () => goToQuestion(currentIndex + 1);
  const handlePrevious = () => goToQuestion(currentIndex - 1);

  const handleSubmit = () => {
    const finalTimeSpent = commitCurrentQuestionTime();
    onSubmit(answers, finalTimeSpent);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;

  const getStatus = (idx: number) => {
    const q = questions[idx];
    const ans = answers[q.id];
    const isMarked = marked[q.id];
    if (ans !== undefined && ans !== null && isMarked) return "answeredMarked";
    if (isMarked) return "marked";
    if (ans !== undefined && ans !== null) return "answered";
    if (visited[idx]) return "notAnswered";
    return "notVisited";
  };

  const statusClass: Record<string, string> = {
    answered: "bg-green-600 text-white border-green-600",
    notAnswered: "bg-red-500 text-white border-red-500",
    marked: "bg-purple-600 text-white border-purple-600",
    answeredMarked: "bg-purple-600 text-white border-green-400 ring-2 ring-green-400",
    notVisited: "bg-background text-foreground border-border",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </div>
            <div className="text-sm font-medium">Time: {formatTime(timeElapsed)}</div>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Answered: {answeredCount}/{questions.length}</span>
            <span>Unattempted: {questions.length - answeredCount}</span>
          </div>
        </div>
      </div>

      <div className="container-custom py-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <Card>
          <CardContent className="pt-6 space-y-6">
            <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex items-start gap-2">
                <span className="font-semibold text-sm">Q{currentIndex + 1}.</span>
                <div className="flex-1">
                  <MathContent
                    html={formatQuestionHtml(currentQuestion.question_text)}
                    className="text-base leading-relaxed neet-question"
                  />
                  {currentQuestion.images && Array.isArray(currentQuestion.images) && currentQuestion.images.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {currentQuestion.images.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Question image ${idx + 1}`}
                          className="max-w-full h-auto rounded-lg border"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 pl-6">
                {Array.isArray(currentQuestion.options) && currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      answers[currentQuestion.id] === index
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        answers[currentQuestion.id] === index
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border'
                      }`}>
                        {answers[currentQuestion.id] === index && '✓'}
                      </div>
                      <MathContent as="span" html={formatOptionHtml(String(option))} className="text-sm" />
                  </div>
                  </button>
                ))}
              </div>
            </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between pt-4 border-t">  
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMarked(prev => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }))}
                >
                  <Bookmark className={`h-4 w-4 mr-1 ${marked[currentQuestion.id] ? "fill-current" : ""}`} />
                  {marked[currentQuestion.id] ? "Unmark" : "Mark"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion.id]: null }))}
                >
                  <Flag className="h-4 w-4 mr-1" />
                  Clear
                </Button>

                {currentIndex === questions.length - 1 ? (
                  <Button onClick={handleSubmit} className="min-w-24">
                    Submit Test
                  </Button>
                ) : (
                  <Button onClick={handleNext}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Palette */}
        <Card className="lg:sticky lg:top-32 self-start max-h-[calc(100vh-9rem)] overflow-hidden flex flex-col">
          <CardContent className="pt-4 pb-4 flex flex-col h-full">
            <h3 className="text-sm font-semibold mb-3">Question Palette</h3>
            <div className="grid grid-cols-6 lg:grid-cols-5 gap-1.5 overflow-y-auto pr-1 flex-1">
              {questions.map((_, idx) => {
                const s = getStatus(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => goToQuestion(idx)}
                    className={`h-8 w-8 rounded text-xs font-semibold border transition-all ${statusClass[s]} ${
                      idx === currentIndex ? "ring-2 ring-primary ring-offset-1" : ""
                    }`}
                    title={`Q${idx + 1} • ${s}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-green-600" /> Answered</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-red-500" /> Not Answered</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-purple-600" /> Marked</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-border bg-background" /> Not Visited</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
