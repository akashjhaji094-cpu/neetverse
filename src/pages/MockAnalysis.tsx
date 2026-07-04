import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMockAnalysis } from "@/hooks/useMockAnalysis";
import { useMockProgress } from "@/hooks/useMockProgress";
import {
  ArrowLeft, Target, CheckCircle2, XCircle, MinusCircle,
  Clock, TrendingUp, TrendingDown, Sparkles, BookOpen, AlertTriangle,
  Timer, Gauge, Zap, Award, Layers, Brain, HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  LineChart, Line,
} from "recharts";
import { format } from "date-fns";

const SUBJECT_ORDER = ["Physics", "Chemistry", "Biology"];
const SUBJECT_COLORS: Record<string, string> = {
  Physics: "#3b82f6",
  Chemistry: "#22c55e",
  Biology: "#a855f7",
};

function sortBySubjectOrder<T extends { subject: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ai = SUBJECT_ORDER.indexOf(a.subject);
    const bi = SUBJECT_ORDER.indexOf(b.subject);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function getRating(accuracy: number): { label: string; className: string } {
  if (accuracy >= 85) return { label: "Excellent", className: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" };
  if (accuracy >= 70) return { label: "Good", className: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" };
  if (accuracy >= 50) return { label: "Average", className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" };
  return { label: "Needs Work", className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" };
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StatCard({ icon: Icon, label, value, sublabel, tone = "default" }: {
  icon: React.ElementType; label: string; value: string | number; sublabel?: string;
  tone?: "default" | "success" | "danger" | "muted";
}) {
  const toneClasses = {
    default: "text-primary bg-primary/10",
    success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
    danger: "text-red-600 bg-red-50 dark:bg-red-950/30",
    muted: "text-muted-foreground bg-muted",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight truncate">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground/70 truncate">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MockAnalysis() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useMockAnalysis(attemptId);
  const { data: progress } = useMockProgress(10);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !data) {
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-6 max-w-2xl mx-auto">
          <Card className="border-destructive/30">
            <CardContent className="p-8 text-center space-y-4">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
              <div>
                <p className="font-semibold">Couldn't load this analysis</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : "This attempt may not exist or isn't yours."}
                </p>
              </div>
              <Button onClick={() => navigate("/test-history")} variant="outline">
                Back to Test History
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { overall, chapters, weakChapters, strongChapters, slowestQuestions, quickGuesses, weakTopics, strongTopics, mistakePatterns } = data;
  const subjects = sortBySubjectOrder(data.subjects);

  const radarData = subjects.map((s) => ({ subject: s.subject, accuracy: s.accuracy }));
  const progressData = (progress || []).map((p) => ({
    label: format(new Date(p.finishedAt), "d MMM"),
    percentage: p.percentage,
  }));

  const sortedChapters = [...chapters]
    .filter((c) => c.correct + c.wrong > 0)
    .sort((a, b) => a.accuracy - b.accuracy);

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6 pb-16">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl lg:text-2xl font-bold truncate">Mock Test Analysis</h1>
              <p className="text-sm text-muted-foreground">
                {overall.finishedAt ? format(new Date(overall.finishedAt), "d MMM yyyy, h:mm a") : ""}
              </p>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-gradient-to-r from-primary to-secondary p-6 md:p-8 text-white">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <p className="text-white/80 text-sm font-medium mb-1">Total Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl md:text-6xl font-black">{overall.score}</span>
                  <span className="text-xl text-white/70">/ {overall.maxScore}</span>
                </div>
                <p className="text-white/90 mt-2 font-semibold">{overall.percentage}% Score</p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                <div className="text-center bg-white/15 rounded-xl px-4 py-3">
                  <p className="text-2xl font-bold">{overall.accuracy}%</p>
                  <p className="text-xs text-white/75">Accuracy</p>
                </div>
                <div className="text-center bg-white/15 rounded-xl px-4 py-3">
                  <p className="text-2xl font-bold">{overall.attemptRate}%</p>
                  <p className="text-xs text-white/75">Attempt Rate</p>
                </div>
              </div>
            </div>
            <Progress value={overall.percentage} className="h-2 mt-6 bg-white/20" />
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard icon={CheckCircle2} label="Correct" value={overall.correct} sublabel={`+${overall.positiveMarks} marks`} tone="success" />
          <StatCard icon={XCircle} label="Incorrect" value={overall.wrong} sublabel={`-${overall.negativeMarks} marks`} tone="danger" />
          <StatCard icon={MinusCircle} label="Unattempted" value={overall.unattempted} tone="muted" />
          <StatCard icon={Clock} label="Time Taken" value={formatDuration(overall.durationSeconds)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Subject-wise Analysis</CardTitle>
            <CardDescription>Accuracy and marks across Physics, Chemistry and Biology</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="75%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Accuracy" dataKey="accuracy" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjects} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="marks" radius={[6, 6, 0, 0]}>
                      {subjects.map((s) => (
                        <Cell key={s.subjectId} fill={SUBJECT_COLORS[s.subject] || "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              {subjects.map((s) => (
                <div key={s.subjectId} className="space-y-2 p-4 rounded-xl border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold" style={{ color: SUBJECT_COLORS[s.subject] }}>{s.subject}</h4>
                    <span className="text-sm font-bold">{s.marks}/{s.maxMarks}</span>
                  </div>
                  <Progress value={s.accuracy} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="text-emerald-600">✓ {s.correct}</span>
                    <span className="text-red-600">✗ {s.wrong}</span>
                    <span>○ {s.unattempted}</span>
                    <span>{s.accuracy}% acc</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600"><TrendingDown className="h-5 w-5" />Weak Chapters</CardTitle>
              <CardDescription>Lowest accuracy — revise these first</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {weakChapters.length === 0 && <p className="text-sm text-muted-foreground">Not enough attempted questions yet to identify weak chapters.</p>}
              {weakChapters.map((c) => (
                <div key={c.chapterId} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.chapter}</p>
                    <p className="text-xs text-muted-foreground">{c.subject}</p>
                  </div>
                  <Badge variant="outline" className="text-red-600 border-red-300 shrink-0">{c.accuracy}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-600"><TrendingUp className="h-5 w-5" />Strong Chapters</CardTitle>
              <CardDescription>Highest accuracy — your best areas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {strongChapters.length === 0 && <p className="text-sm text-muted-foreground">Not enough attempted questions yet to identify strong chapters.</p>}
              {strongChapters.map((c) => (
                <div key={c.chapterId} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.chapter}</p>
                    <p className="text-xs text-muted-foreground">{c.subject}</p>
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300 shrink-0">{c.accuracy}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Chapter-wise Breakdown</CardTitle>
            <CardDescription>{sortedChapters.length} chapters attempted, sorted by accuracy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedChapters.length === 0 && <p className="text-sm text-muted-foreground">No chapters attempted in this mock.</p>}
            {sortedChapters.map((c) => {
              const rating = getRating(c.accuracy);
              return (
                <div key={c.chapterId} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.chapter}</p>
                      <p className="text-xs text-muted-foreground">{c.subject} • {c.marks}/{c.maxMarks} marks</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 border ${rating.className}`}>{rating.label}</Badge>
                  </div>
                  <Progress value={c.accuracy} className="h-1.5" />
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="text-emerald-600">✓ {c.correct}</span>
                    <span className="text-red-600">✗ {c.wrong}</span>
                    <span>○ {c.unattempted}</span>
                    <span className="ml-auto font-medium">{c.accuracy}%</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {overall.hasTimeData ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5 text-primary" />Time Analysis</CardTitle>
              <CardDescription>How you spent your time across subjects and questions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <StatCard icon={Clock} label="Avg Time / Question" value={overall.avgTimePerQuestionSeconds !== null ? `${overall.avgTimePerQuestionSeconds}s` : "—"} sublabel="NEET pace ≈ 60s" />
                <StatCard icon={Gauge} label="Time Efficiency" value={overall.timeEfficiencyScore !== null ? `${overall.timeEfficiencyScore}/100` : "—"} />
                <StatCard icon={Zap} label="Quick Guesses" value={quickGuesses.length} sublabel="<10s & wrong" tone={quickGuesses.length > 0 ? "danger" : "default"} />
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjects.filter(s => s.avgTimeSeconds !== null)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: 'sec/question', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="avgTimeSeconds" radius={[6, 6, 0, 0]}>
                      {subjects.map((s) => (
                        <Cell key={s.subjectId} fill={SUBJECT_COLORS[s.subject] || "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {(slowestQuestions.length > 0 || quickGuesses.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {slowestQuestions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Timer className="h-4 w-4 text-amber-600" />Took Longest</h4>
                      <div className="space-y-2">
                        {slowestQuestions.map((q) => (
                          <div key={q.questionId} className="p-2.5 rounded-lg border text-xs space-y-1">
                            <p className="text-muted-foreground line-clamp-2">{q.questionPreview}...</p>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">{q.subject} • {q.chapter}</span>
                              <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0">{q.timeSeconds}s</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {quickGuesses.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-red-600" />Possible Guesses</h4>
                      <div className="space-y-2">
                        {quickGuesses.map((q) => (
                          <div key={q.questionId} className="p-2.5 rounded-lg border text-xs space-y-1">
                            <p className="text-muted-foreground line-clamp-2">{q.questionPreview}...</p>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">{q.subject} • {q.chapter}</span>
                              <Badge variant="outline" className="text-red-600 border-red-300 shrink-0">{q.timeSeconds}s • wrong</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Timer className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Time tracking wasn't available when you took this mock. Take a new one to see your pacing, time efficiency score, and slowest questions here.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Progress Trend</CardTitle>
            <CardDescription>Your last {progressData.length} mock scores</CardDescription>
          </CardHeader>
          <CardContent>
            {progressData.length < 2 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Complete a few more mock tests to see your improvement trend here.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="percentage" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
