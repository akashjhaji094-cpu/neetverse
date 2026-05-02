import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Question } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useMathJax } from "@/hooks/useMathJax";
import { formatQuestionHtml } from "@/lib/questionFormatter";

interface TestInterfaceProps {
  questions: Question[];
  onSubmit: (answers: Record<string, number | null>) => void;
}

export const TestInterface = ({ questions, onSubmit }: TestInterfaceProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [timeElapsed, setTimeElapsed] = useState(0);

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

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = () => {
    onSubmit(answers);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const mathRef = useMathJax([currentIndex]);

  return (
    <div className="min-h-screen bg-background" ref={mathRef}>
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

      <div className="container-custom py-6">
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-sm">Q{currentIndex + 1}.</span>
                <div className="flex-1">
                  <div
                    className="text-base leading-relaxed neet-question"
                    dangerouslySetInnerHTML={{ __html: formatQuestionHtml(currentQuestion.question_text) }}
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
                      <span className="text-sm" dangerouslySetInnerHTML={{ __html: String(option) }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

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
      </div>
    </div>
  );
};
