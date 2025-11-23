import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface TestResultsProps {
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  onClose: () => void;
}

export const TestResults = ({
  score,
  totalQuestions,
  correctCount,
  wrongCount,
  unattemptedCount,
  onClose
}: TestResultsProps) => {
  const percentage = ((correctCount / totalQuestions) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Test Completed!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-6xl font-bold text-primary mb-2">{score}</div>
            <p className="text-muted-foreground">Total Score</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{correctCount}</div>
                <p className="text-sm text-muted-foreground">Correct</p>
                <p className="text-xs text-muted-foreground mt-1">+{correctCount * 4} marks</p>
              </CardContent>
            </Card>

            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="pt-6 text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{wrongCount}</div>
                <p className="text-sm text-muted-foreground">Wrong</p>
                <p className="text-xs text-muted-foreground mt-1">{wrongCount * -1} marks</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200 dark:border-gray-800">
              <CardContent className="pt-6 text-center">
                <MinusCircle className="h-12 w-12 text-gray-500 mx-auto mb-2" />
                <div className="text-2xl font-bold">{unattemptedCount}</div>
                <p className="text-sm text-muted-foreground">Unattempted</p>
                <p className="text-xs text-muted-foreground mt-1">0 marks</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                  <p className="text-2xl font-bold">{percentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Questions</p>
                  <p className="text-2xl font-bold">{totalQuestions}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Score</p>
                  <p className="text-2xl font-bold">{totalQuestions * 4}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-4">
            <Button onClick={onClose} size="lg">
              Back to Practice
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
