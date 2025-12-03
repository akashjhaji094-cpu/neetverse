import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, MinusCircle, TrendingUp, TrendingDown, AlertCircle, Eye } from "lucide-react";

interface SubjectAnalytics {
  subject: string;
  correct: number;
  wrong: number;
  unattempted: number;
  total: number;
  score: number;
  percentage: number;
}

interface MockTestAnalyticsProps {
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  subjectAnalytics: SubjectAnalytics[];
  onClose: () => void;
  onReview?: () => void;
}

export const MockTestAnalytics = ({
  score,
  totalQuestions,
  correctCount,
  wrongCount,
  unattemptedCount,
  subjectAnalytics,
  onClose,
  onReview
}: MockTestAnalyticsProps) => {
  const maxScore = totalQuestions * 4;
  const percentage = ((score / maxScore) * 100).toFixed(1);
  
  const strongestSubject = [...subjectAnalytics].sort((a, b) => b.percentage - a.percentage)[0];
  const weakestSubject = [...subjectAnalytics].sort((a, b) => a.percentage - b.percentage)[0];
  
  const needsRevision = subjectAnalytics.filter(s => s.percentage < 60);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl space-y-6">
        {/* Overall Score Card */}
        <Card className="border-primary">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-3xl">Mock Test Completed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-7xl font-bold text-primary mb-2">{score}</div>
              <p className="text-xl text-muted-foreground">out of {maxScore} marks</p>
              <div className="mt-4">
                <Progress value={parseFloat(percentage)} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">{percentage}% Score</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-green-200 dark:border-green-800">
                <CardContent className="pt-6 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold">{correctCount}</div>
                  <p className="text-sm text-muted-foreground">Correct</p>
                  <p className="text-xs text-muted-foreground mt-1">+{correctCount * 4} marks</p>
                </CardContent>
              </Card>

              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-6 text-center">
                  <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold">{wrongCount}</div>
                  <p className="text-sm text-muted-foreground">Wrong</p>
                  <p className="text-xs text-muted-foreground mt-1">{wrongCount * -1} marks</p>
                </CardContent>
              </Card>

              <Card className="border-gray-200 dark:border-gray-800">
                <CardContent className="pt-6 text-center">
                  <MinusCircle className="h-12 w-12 text-gray-500 mx-auto mb-2" />
                  <div className="text-3xl font-bold">{unattemptedCount}</div>
                  <p className="text-sm text-muted-foreground">Unattempted</p>
                  <p className="text-xs text-muted-foreground mt-1">0 marks</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Subject-wise Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Subject-wise Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subjectAnalytics.map((subject) => (
                <div key={subject.subject} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{subject.subject}</h4>
                    <div className="text-sm">
                      <span className="font-bold">{subject.score}</span>
                      <span className="text-muted-foreground">/{subject.total * 4}</span>
                      <span className="ml-2 text-muted-foreground">({subject.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <Progress value={subject.percentage} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="text-green-600">✓ {subject.correct}</span>
                    <span className="text-red-600">✗ {subject.wrong}</span>
                    <span className="text-gray-600">○ {subject.unattempted}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Insights & Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strong Area */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-5 w-5" />
                Strongest Area
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-2">{strongestSubject?.subject}</p>
              <p className="text-sm text-muted-foreground">
                You scored {strongestSubject?.percentage.toFixed(1)}% in this subject. Great job!
              </p>
            </CardContent>
          </Card>

          {/* Weak Area */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <TrendingDown className="h-5 w-5" />
                Needs Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-2">{weakestSubject?.subject}</p>
              <p className="text-sm text-muted-foreground">
                You scored {weakestSubject?.percentage.toFixed(1)}% in this subject. Focus on this area.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recommendations */}
        {needsRevision.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                Subjects to Revise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3">You scored less than 60% in the following subjects:</p>
              <div className="space-y-2">
                {needsRevision.map(subject => (
                  <div key={subject.subject} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                    <span className="font-medium">{subject.subject}</span>
                    <span className="text-sm text-muted-foreground">{subject.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Consider practicing these subjects more to improve your overall score.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4">
          {onReview && (
            <Button onClick={onReview} variant="outline" size="lg">
              <Eye className="w-4 h-4 mr-2" />
              Review Answers
            </Button>
          )}
          <Button onClick={onClose} size="lg">
            Back to Tests
          </Button>
          <Button variant="outline" size="lg" onClick={() => window.location.href = '/practice'}>
            Practice Weak Areas
          </Button>
        </div>
      </div>
    </div>
  );
};
