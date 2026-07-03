import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, MinusCircle, TrendingUp, TrendingDown, AlertCircle, Eye, Printer, BarChart3 } from "lucide-react";
import { Question } from "@/lib/supabase";
import { useRef } from "react";
import { Link } from "react-router-dom";
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
  questions?: Question[];
  answers?: Record<string, number | null>;
  attemptId?: string;
}

const generatePrintHtml = (
  score: number,
  totalQuestions: number,
  correctCount: number,
  wrongCount: number,
  unattemptedCount: number,
  subjectAnalytics: SubjectAnalytics[],
  questions?: Question[],
  answers?: Record<string, number | null>
) => {
  const maxScore = totalQuestions * 4;
  const percentage = ((score / maxScore) * 100).toFixed(1);
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  let questionsHtml = '';
  if (questions && answers) {
    questionsHtml = questions.map((q, idx) => {
      const userAnswer = answers[q.id];
      const isCorrect = userAnswer === q.correct_option_index;
      const isUnattempted = userAnswer === null || userAnswer === undefined;
      const options = Array.isArray(q.options) ? q.options : [];
      const status = isUnattempted ? '○ Unattempted' : isCorrect ? '✓ Correct' : '✗ Wrong';
      const statusColor = isUnattempted ? '#666' : isCorrect ? '#16a34a' : '#dc2626';

      return `
        <div style="page-break-inside:avoid;margin-bottom:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <strong>Q${idx + 1}.</strong>
            <span style="color:${statusColor};font-weight:600;font-size:12px;">${status}</span>
          </div>
          <div style="margin-bottom:8px;">${q.question_text}</div>
          <div style="padding-left:16px;">
            ${options.map((opt, i) => {
              const isUserPick = userAnswer === i;
              const isCorrectOpt = q.correct_option_index === i;
              let bg = 'transparent';
              let border = '#e5e7eb';
              if (isCorrectOpt) { bg = '#dcfce7'; border = '#16a34a'; }
              else if (isUserPick) { bg = '#fee2e2'; border = '#dc2626'; }
              return `<div style="padding:6px 10px;margin:4px 0;border:1px solid ${border};border-radius:4px;background:${bg};font-size:13px;">
                <strong>${String.fromCharCode(65 + i)}.</strong> ${String(opt)}
                ${isCorrectOpt ? ' ✓' : ''}${isUserPick && !isCorrectOpt ? ' ✗ (Your answer)' : ''}
              </div>`;
            }).join('')}
          </div>
          ${q.explanation ? `<div style="margin-top:8px;padding:8px;background:#f0f9ff;border-radius:4px;font-size:12px;"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
        </div>`;
    }).join('');
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>NEETVerse Mock Test Report</title>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:20px;color:#1a1a1a;}
      .header{text-align:center;border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:24px;}
      .header h1{color:#6366f1;margin:0;font-size:28px;}
      .header p{color:#666;margin:4px 0;font-size:13px;}
      .score-box{text-align:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:24px;border-radius:12px;margin-bottom:24px;}
      .score-box .score{font-size:48px;font-weight:800;}
      .stats{display:flex;gap:12px;margin-bottom:24px;}
      .stat{flex:1;text-align:center;padding:12px;border-radius:8px;border:1px solid #e5e7eb;}
      .subject-bar{margin-bottom:12px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;}
      .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:2px solid #e5e7eb;color:#999;font-size:11px;}
      @media print{body{padding:10px;}.score-box{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
    </style></head><body>
    <div class="header">
      <h1>🎓 NEETVerse</h1>
      <p>Mock Test Report • ${date}</p>
      <p>${totalQuestions} Questions • NEET Pattern</p>
    </div>
    <div class="score-box">
      <div class="score">${score} / ${maxScore}</div>
      <div>${percentage}% Score</div>
    </div>
    <div class="stats">
      <div class="stat" style="border-color:#16a34a;"><div style="font-size:24px;font-weight:700;color:#16a34a;">${correctCount}</div><div style="font-size:12px;color:#666;">Correct (+${correctCount * 4})</div></div>
      <div class="stat" style="border-color:#dc2626;"><div style="font-size:24px;font-weight:700;color:#dc2626;">${wrongCount}</div><div style="font-size:12px;color:#666;">Wrong (${wrongCount * -1})</div></div>
      <div class="stat" style="border-color:#999;"><div style="font-size:24px;font-weight:700;color:#999;">${unattemptedCount}</div><div style="font-size:12px;color:#666;">Unattempted</div></div>
    </div>
    <h3>Subject-wise Performance</h3>
    ${subjectAnalytics.map(s => `
      <div class="subject-bar">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <strong>${s.subject}</strong>
          <span>${s.score}/${s.total * 4} (${s.percentage.toFixed(1)}%)</span>
        </div>
        <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
          <div style="background:#6366f1;height:100%;width:${Math.max(0, s.percentage)}%;border-radius:4px;"></div>
        </div>
        <div style="display:flex;gap:16px;margin-top:4px;font-size:12px;color:#666;">
          <span style="color:#16a34a;">✓ ${s.correct}</span>
          <span style="color:#dc2626;">✗ ${s.wrong}</span>
          <span>○ ${s.unattempted}</span>
        </div>
      </div>`).join('')}
    ${questionsHtml ? `<h3 style="margin-top:32px;">Question-wise Review</h3>${questionsHtml}` : ''}
    <div class="footer">
      <p>Generated by NEETVerse • neetverse.lovable.app</p>
      <p>Keep practicing, success is near! 🚀</p>
    </div>
  </body></html>`;
};

export const MockTestAnalytics = ({
  score,
  totalQuestions,
  correctCount,
  wrongCount,
  unattemptedCount,
  subjectAnalytics,
  onClose,
  onReview,
  questions,
  answers,
  attemptId,
}: MockTestAnalyticsProps) => {
  const maxScore = totalQuestions * 4;
  const percentage = ((score / maxScore) * 100).toFixed(1);
  
  const strongestSubject = [...subjectAnalytics].sort((a, b) => b.percentage - a.percentage)[0];
  const weakestSubject = [...subjectAnalytics].sort((a, b) => a.percentage - b.percentage)[0];
  const needsRevision = subjectAnalytics.filter(s => s.percentage < 60);

  const handlePrint = () => {
    const html = generatePrintHtml(score, totalQuestions, correctCount, wrongCount, unattemptedCount, subjectAnalytics, questions, answers);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      // Wait for MathJax to load and render, then print
      setTimeout(() => {
        printWindow.print();
      }, 2000);
    }
  };

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

        {/* Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-4">
          {attemptId && (
            <Link to={`/mock-analysis/${attemptId}`}>
              <Button size="lg" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                View Detailed Analysis
              </Button>
            </Link>
          )}
          {onReview && (
            <Button onClick={onReview} variant="outline" size="lg">
              <Eye className="w-4 h-4 mr-2" />
              Review Answers
            </Button>
          )}
          <Button onClick={handlePrint} variant="outline" size="lg">
            <Printer className="w-4 h-4 mr-2" />
            Print / Save PDF
          </Button>
          <Button onClick={onClose} variant="outline" size="lg">
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
