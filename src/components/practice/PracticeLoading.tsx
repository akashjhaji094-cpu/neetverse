import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, Loader2 } from "lucide-react";

interface PracticeLoadingProps {
  totalQuestions: number;
  chapterName?: string;
  /** When provided, drives the counter from real fetch progress instead of fake animation. */
  fetched?: number;
  /** Optional title override (e.g. "Loading Practice Library") */
  title?: string;
}

/**
 * Loading screen for practice tests showing live "fetched X / Y questions"
 * with elapsed timer and dynamic ETA. The fetch is a single Supabase round-trip,
 * so we animate the counter to fill smoothly while the request resolves.
 */
export const PracticeLoading = ({ totalQuestions, chapterName, fetched: controlledFetched, title }: PracticeLoadingProps) => {
  const [fetched, setFetched] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const isControlled = controlledFetched !== undefined;
  const displayedFetched = isControlled ? Math.min(totalQuestions, controlledFetched!) : fetched;

  // Real ETA: extrapolate from current elapsed/progress when controlled; otherwise rough heuristic.
  const estimated = isControlled
    ? (displayedFetched > 0 && elapsed > 0
        ? Math.max(1, Math.round((elapsed / displayedFetched) * totalQuestions))
        : Math.min(20, Math.max(3, Math.round((totalQuestions * 0.02) + 2))))
    : Math.min(15, Math.max(3, Math.round((totalQuestions * 0.08) + 1.5)));

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isControlled) return; // skip fake animation
    if (fetched >= totalQuestions) return;
    // Curve: fast start, slow finish (asymptotic) — feels like network fetch
    const step = Math.max(1, Math.ceil((totalQuestions - fetched) / 18));
    const t = setTimeout(() => {
      setFetched((f) => Math.min(totalQuestions, f + step));
    }, 80);
    return () => clearTimeout(t);
  }, [fetched, totalQuestions, isControlled]);

  const eta = Math.max(0, estimated - elapsed);
  const pct = totalQuestions > 0 ? Math.round((displayedFetched / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-2xl">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative p-5 rounded-2xl bg-primary/10 border border-primary/20">
                <BookOpen className="h-10 w-10 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold">{title || "Preparing Your Practice"}</h3>
              {chapterName && (
                <p className="text-sm text-muted-foreground mt-1">{chapterName}</p>
              )}
            </div>
          </div>

          {/* Live counter */}
          <div className="text-center space-y-1">
            <div className="text-4xl font-black tabular-nums text-primary">
              {displayedFetched} <span className="text-muted-foreground/60 text-2xl font-bold">/ {totalQuestions || "…"}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase">
              Questions Fetched
            </p>
          </div>

          <div className="space-y-2">
            <Progress value={pct} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading questions...
              </span>
              <span className="font-semibold">{pct}%</span>
            </div>
          </div>

          {/* Time stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 border p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Clock className="h-3 w-3" />
                <span className="text-[10px] font-semibold tracking-wider uppercase">Elapsed</span>
              </div>
              <p className="text-lg font-bold tabular-nums">{elapsed}s</p>
            </div>
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-primary mb-1">
                <Clock className="h-3 w-3" />
                <span className="text-[10px] font-semibold tracking-wider uppercase">Est. Time</span>
              </div>
              <p className="text-lg font-bold tabular-nums text-primary">~{eta}s</p>
            </div>
          </div>

          {elapsed > estimated + 3 && (
            <p className="text-xs text-amber-500 text-center font-medium animate-pulse">
              Taking a bit longer... almost there
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};