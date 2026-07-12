/**
 * QP TO CBT — Results page. FULLY IMPLEMENTED. Mirrors the score/accuracy
 * layout style already used elsewhere in the app (see TestResults.tsx /
 * MockAnalysis.tsx) rather than inventing a new results layout, then adds
 * the subject/chapter/topic rollup tables the spec asks for, resolving
 * subject/chapter/topic ids to real names from Supabase (read-only, same
 * tables the topic classifier already reads).
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CheckCircle2, XCircle, MinusCircle, HelpCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import type { LocalTestAnalytics } from "@/features/qp-to-cbt/types";
import * as repo from "@/features/qp-to-cbt/storage/db";

interface NameMaps {
  subjects: Map<string, string>;
  chapters: Map<string, string>;
  topics: Map<string, string>;
}

async function loadNameMaps(): Promise<NameMaps> {
  const [{ data: subjects }, { data: chapters }, { data: topics }] = await Promise.all([
    supabase.from("subjects").select("id, name"),
    supabase.from("chapters").select("id, name"),
    supabase.from("topics").select("id, name"),
  ]);
  return {
    subjects: new Map((subjects ?? []).map((s: any) => [s.id, s.name])),
    chapters: new Map((chapters ?? []).map((c: any) => [c.id, c.name])),
    topics: new Map((topics ?? []).map((t: any) => [t.id, t.name])),
  };
}

function RollupTable({
  title,
  rows,
  names,
}: {
  title: string;
  rows: Array<{ id: string; correct: number; wrong: number; unattempted: number }>;
  names: Map<string, string>;
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {rows
          .map((r) => {
            const total = r.correct + r.wrong + r.unattempted;
            const accuracy = total > 0 ? Math.round((r.correct / total) * 100) : 0;
            return { ...r, accuracy, total };
          })
          .sort((a, b) => a.accuracy - b.accuracy) // weakest first — the point of this table
          .map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs py-1">
              <span>{r.id === "unclassified" ? "Unclassified" : names.get(r.id) ?? "Unknown"}</span>
              <span className={r.accuracy < 50 ? "text-red-500 font-semibold" : "text-muted-foreground"}>
                {r.accuracy}% ({r.correct}/{r.total})
              </span>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

export default function QpToCbtResults() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<LocalTestAnalytics | null>(null);
  const [names, setNames] = useState<NameMaps | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      const [a, n] = await Promise.all([repo.getLocalTestAnalytics(attemptId), loadNameMaps()]);
      setAnalytics(a ?? null);
      setNames(n);
    })();
  }, [attemptId]);

  if (!analytics || !names) {
    return (
      <DashboardLayout>
        <div className="p-10 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading results…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-4 max-w-3xl">
        <Card className="overflow-hidden">
          <CardContent className="p-6 text-center space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Score</p>
            <div className="text-4xl font-bold text-primary">{analytics.score}</div>
            <p className="text-sm text-muted-foreground">{analytics.accuracy}% accuracy</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <div className="text-xl font-bold">{analytics.correct}</div>
              <p className="text-[10px] text-muted-foreground">Correct</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
              <div className="text-xl font-bold">{analytics.wrong}</div>
              <p className="text-[10px] text-muted-foreground">Wrong</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <MinusCircle className="h-5 w-5 mx-auto mb-1 text-gray-500" />
              <div className="text-xl font-bold">{analytics.unattempted}</div>
              <p className="text-[10px] text-muted-foreground">Unattempted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <HelpCircle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <div className="text-xl font-bold">{analytics.unresolved}</div>
              <p className="text-[10px] text-muted-foreground">Unresolved</p>
            </CardContent>
          </Card>
        </div>
        {analytics.unresolved > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Unresolved = no answer key was available for that question — excluded from scoring, not counted wrong.
          </p>
        )}

        <RollupTable title="By Subject" rows={analytics.bySubject} names={names.subjects} />
        <RollupTable title="By Chapter" rows={analytics.byChapter} names={names.chapters} />
        <RollupTable title="By Topic (weakest first)" rows={analytics.byTopic} names={names.topics} />

        <Button variant="outline" className="w-full" onClick={() => navigate("/qp-to-cbt")}>
          Convert another paper
        </Button>
      </div>
    </DashboardLayout>
  );
}

