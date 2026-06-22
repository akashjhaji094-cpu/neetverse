import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { Target, TrendingDown, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const SUBJECT_COLORS: Record<string, string> = {
  Physics: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  Chemistry: "text-green-600 bg-green-50 dark:bg-green-950/30",
  Biology: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
};

const WeakChapters = () => {
  const { data, isLoading } = usePerformanceData();
  const weakChapters = data?.weakChapters || [];

  const bySubject = useMemo(() => {
    const map = new Map<string, typeof weakChapters>();
    weakChapters.forEach((c) => {
      const arr = map.get(c.subjectName) || [];
      arr.push(c);
      map.set(c.subjectName, arr);
    });
    // each subject's chapters already sorted weakest-first from the hook
    return Array.from(map.entries());
  }, [weakChapters]);

  const top5Weakest = weakChapters.slice(0, 5);

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl">
            <Target className="h-7 w-7 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Weak Chapter Analyzer</h1>
            <p className="text-muted-foreground">Know exactly where you're losing marks</p>
          </div>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">Analyzing your performance...</CardContent></Card>
        ) : weakChapters.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">
            Attempt at least 3 questions per chapter to see weak-chapter analysis.
          </CardContent></Card>
        ) : (
          <>
            {/* Top 5 overall weakest */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Focus Here First
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {top5Weakest.map((c, i) => (
                  <div key={`${c.subjectName}-${c.chapterName}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-background">
                    <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{c.chapterName}</p>
                      <p className="text-xs text-muted-foreground">{c.subjectName} • {c.total} questions attempted</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">{c.accuracyPct}% accuracy</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Subject-wise ranking */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bySubject.map(([subject, chapters]) => (
                <Card key={subject}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-sm ${SUBJECT_COLORS[subject] || ""}`}>{subject}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {chapters.slice(0, 6).map((c, i) => (
                      <div key={c.chapterName} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{i + 1}. {c.chapterName}</span>
                          <span className="text-xs font-semibold ml-2">{c.accuracyPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.accuracyPct < 40 ? "bg-red-500" : c.accuracyPct < 65 ? "bg-amber-500" : "bg-green-500"
                            }`}
                            style={{ width: `${c.accuracyPct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingDown className="h-4 w-4" />
                  Practice your weakest chapters with focused Revision
                </div>
                <Link to="/revision">
                  <Button size="sm">Go to Revision</Button>
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WeakChapters;
