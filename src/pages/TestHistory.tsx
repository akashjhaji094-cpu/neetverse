import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { History, Clock, CheckCircle2, XCircle, MinusCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

const TestHistory = () => {
  const { data, isLoading } = usePerformanceData();
  const [typeFilter, setTypeFilter] = useState<"all" | "practice" | "mock">("all");

  const history = data?.history || [];

  const filtered = useMemo(
    () => (typeFilter === "all" ? history : history.filter((h) => h.testType === typeFilter)),
    [history, typeFilter]
  );

  const overall = useMemo(() => {
    if (history.length === 0) return null;
    const totalTests = history.length;
    const avgAccuracy = Math.round(history.reduce((s, h) => s + h.accuracy, 0) / totalTests);
    const avgScore = Math.round(
      history.filter((h) => h.score !== null).reduce((s, h) => s + (h.score || 0), 0) /
      Math.max(1, history.filter((h) => h.score !== null).length)
    );
    return { totalTests, avgAccuracy, avgScore };
  }, [history]);

  const formatTime = (sec: number | null) => {
    if (sec === null) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <History className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Test History Vault</h1>
            <p className="text-muted-foreground">Every test you've ever attempted, in one place</p>
          </div>
        </div>

        {overall && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{overall.totalTests}</div>
                <p className="text-xs text-muted-foreground">Total Tests</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{overall.avgAccuracy}%</div>
                <p className="text-xs text-muted-foreground">Avg Accuracy</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{overall.avgScore}</div>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter by type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tests</SelectItem>
            <SelectItem value="mock">Mock Tests Only</SelectItem>
            <SelectItem value="practice">Practice Sessions Only</SelectItem>
          </SelectContent>
        </Select>

        {isLoading ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">Loading history...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">
            No tests attempted yet — go take your first one!
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((h) => (
              <Card key={h.attemptId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={h.testType === "mock" ? "default" : "secondary"} className="text-[10px]">
                          {h.testType === "mock" ? "Mock" : "Practice"}
                        </Badge>
                        <span className="font-semibold text-sm">{h.testName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{format(new Date(h.date), "d MMM yyyy, h:mm a")}</p>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      {h.score !== null && (
                        <div className="text-center">
                          <div className="font-bold text-primary">{h.score}</div>
                          <div className="text-[10px] text-muted-foreground">Score</div>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="font-bold">{h.accuracy}%</div>
                        <div className="text-[10px] text-muted-foreground">Accuracy</div>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" />{h.correct}</span>
                        <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3.5 w-3.5" />{h.wrong}</span>
                        <span className="flex items-center gap-1 text-muted-foreground"><MinusCircle className="h-3.5 w-3.5" />{h.unattempted}</span>
                      </div>
                      <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />{formatTime(h.timeSpentSec)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TestHistory;
