import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Play, Square, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Log { chapter: string; moved: number; fallback: number; remaining: number; ts: number }

export function ReclassifyQuestions() {
  const [running, setRunning] = useState(false);
  const [totalGeneral, setTotalGeneral] = useState<number | null>(null);
  const [processedSession, setProcessedSession] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const stopRef = useRef(false);

  const loadTotal = async () => {
    const { data } = await supabase
      .from("topics")
      .select("id")
      .eq("name", "General");
    if (!data?.length) return;
    const ids = data.map((t) => t.id);
    const { count } = await supabase
      .from("question_topics")
      .select("question_id", { count: "exact", head: true })
      .in("topic_id", ids);
    setTotalGeneral(count ?? 0);
  };

  useEffect(() => { loadTotal(); }, []);

  const runOnce = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("reclassify-questions", {
      body: { batch_size: 35, loop_seconds: 30 },
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    if (res.error) throw new Error(res.error.message);
    return res.data as any;
  };

  const start = async () => {
    setRunning(true);
    stopRef.current = false;
    setProcessedSession(0);
    try {
      while (!stopRef.current) {
        const r = await runOnce();
        if (r.done) {
          toast({ title: "All done!", description: r.message });
          break;
        }
        if (r.error) throw new Error(r.error);
        const processed = r.processed || 0;
        setProcessedSession((p) => p + processed);
        const nextLogs = Array.isArray(r.chapters) && r.chapters.length > 0
          ? r.chapters.map((c: any) => ({
              chapter: c.chapter || "Chapter",
              moved: c.moved || 0,
              fallback: c.fallback || 0,
              remaining: c.remaining ?? c.remaining_in_chapter ?? 0,
              ts: Date.now(),
            }))
          : [{ chapter: r.chapter, moved: r.moved || 0, fallback: r.fallback || 0, remaining: r.remaining_in_chapter || 0, ts: Date.now() }];
        setLogs((l) => [...nextLogs, ...l].slice(0, 50));
        await loadTotal();
        // small delay
        await new Promise((res) => setTimeout(res, 1000));
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const stop = () => { stopRef.current = true; };

  const pct = totalGeneral && totalGeneral > 0
    ? Math.min(100, Math.round((processedSession / (processedSession + totalGeneral)) * 100))
    : 0;

  return (
    <Card className="card-3d">
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">AI Topic Classifier</h2>
            <p className="text-sm text-muted-foreground">
              Move questions from every chapter's "General" topic to their correct specific topic using Lovable AI.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Remaining in General</p>
            <p className="text-2xl font-bold">{totalGeneral ?? "—"}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Processed this session</p>
            <p className="text-2xl font-bold text-primary">{processedSession}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Session progress</p>
            <p className="text-2xl font-bold text-success">{pct}%</p>
          </div>
        </div>

        <Progress value={pct} className="h-2" />

        <div className="flex gap-2">
          {!running ? (
            <Button onClick={start} className="btn-gradient">
              <Play className="mr-2 h-4 w-4" />
              Start Classification
            </Button>
          ) : (
            <Button onClick={stop} variant="destructive">
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          )}
          {running && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Classifying with Gemini…
            </div>
          )}
        </div>

        {logs.length > 0 && (
          <div className="border rounded-lg divide-y max-h-72 overflow-auto">
            {logs.map((l, i) => (
              <div key={i} className="p-3 text-sm flex items-center justify-between">
                <span className="font-medium">{l.chapter}</span>
                <span className="text-xs text-muted-foreground">
                  moved <b className="text-success">{l.moved}</b> · fallback {l.fallback} · left {l.remaining}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}