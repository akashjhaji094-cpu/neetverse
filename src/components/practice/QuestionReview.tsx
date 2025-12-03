import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, MinusCircle, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Question } from "@/lib/supabase";

interface QuestionReviewProps {
  questions: Question[];
  answers: Record<string, number | null>;
  onClose: () => void;
}

export const QuestionReview = ({ questions, answers, onClose }: QuestionReviewProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = questions[currentIndex];
  const userAnswer = answers[currentQuestion.id];
  const isCorrect = userAnswer === currentQuestion.correct_option_index;
  const isUnattempted = userAnswer === null || userAnswer === undefined;

  const getQuestionStatus = (questionId: string) => {
    const answer = answers[questionId];
    const question = questions.find(q => q.id === questionId);
    if (!question) return 'unattempted';
    if (answer === null || answer === undefined) return 'unattempted';
    return answer === question.correct_option_index ? 'correct' : 'wrong';
  };

  const statusCounts = {
    correct: questions.filter(q => getQuestionStatus(q.id) === 'correct').length,
    wrong: questions.filter(q => getQuestionStatus(q.id) === 'wrong').length,
    unattempted: questions.filter(q => getQuestionStatus(q.id) === 'unattempted').length,
  };

  const getOptionClass = (index: number) => {
    const isUserSelected = userAnswer === index;
    const isCorrectOption = currentQuestion.correct_option_index === index;

    if (isCorrectOption) {
      return "border-green-500 bg-green-50 dark:bg-green-950";
    }
    if (isUserSelected && !isCorrectOption) {
      return "border-red-500 bg-red-50 dark:bg-red-950";
    }
    return "border-border";
  };

  const options = Array.isArray(currentQuestion.options) 
    ? currentQuestion.options 
    : [];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Results
          </Button>
          <div className="flex gap-4">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {statusCounts.correct}
            </Badge>
            <Badge variant="outline" className="text-red-600 border-red-600">
              <XCircle className="w-3 h-3 mr-1" /> {statusCounts.wrong}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              <MinusCircle className="w-3 h-3 mr-1" /> {statusCounts.unattempted}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Question Navigator */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const status = getQuestionStatus(q.id);
                    return (
                      <Button
                        key={q.id}
                        variant={currentIndex === idx ? "default" : "outline"}
                        size="sm"
                        className={`w-10 h-10 p-0 ${
                          status === 'correct' ? 'border-green-500 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                          status === 'wrong' ? 'border-red-500 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' :
                          'border-muted bg-muted/50'
                        } ${currentIndex === idx ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => setCurrentIndex(idx)}
                      >
                        {idx + 1}
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Question Display */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Question {currentIndex + 1}</CardTitle>
                <div className="flex items-center gap-2">
                  {isUnattempted ? (
                    <Badge variant="secondary">
                      <MinusCircle className="w-3 h-3 mr-1" /> Unattempted
                    </Badge>
                  ) : isCorrect ? (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Correct
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="w-3 h-3 mr-1" /> Wrong
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Question Text */}
              <div 
                className="text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: currentQuestion.question_text }}
              />

              {/* Question Images */}
              {currentQuestion.images && Array.isArray(currentQuestion.images) && currentQuestion.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(currentQuestion.images as string[]).map((img, idx) => (
                    <img key={idx} src={img} alt={`Question ${idx + 1}`} className="max-h-48 rounded border" />
                  ))}
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                {options.map((option, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${getOptionClass(idx)}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-semibold text-muted-foreground">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <div 
                        className="flex-1"
                        dangerouslySetInnerHTML={{ __html: String(option) }}
                      />
                      {currentQuestion.correct_option_index === idx && (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      )}
                      {userAnswer === idx && currentQuestion.correct_option_index !== idx && (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Explanation */}
              {currentQuestion.explanation && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-primary">Explanation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="text-sm"
                      dangerouslySetInnerHTML={{ __html: currentQuestion.explanation }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
                  disabled={currentIndex === questions.length - 1}
                >
                  Next <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
