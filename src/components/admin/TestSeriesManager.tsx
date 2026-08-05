import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ManualQuestionForm } from "@/components/questions/ManualQuestionForm";
import {
  ArrowLeft, Plus, Loader2, Trash2, Layers, ListChecks, Shuffle, Search, FileText,
} from "lucide-react";

type View =
  | { kind: "series" }
  | { kind: "tests"; seriesId: string }
  | { kind: "questions"; seriesId: string; testId: string };

export function TestSeriesManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<View>({ kind: "series" });

  /* ---------------- series list ---------------- */
  const { data: series, isLoading: seriesLoading } = useQuery({
    queryKey: ["admin-test-series"],
    queryFn: async () => {
      const { data, error } = await supabase.from("test_series").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const [nsTitle, setNsTitle] = useState("");
  const [nsDesc, setNsDesc] = useState("");
  const [nsBanner, setNsBanner] = useState("");
  const [nsAccess, setNsAccess] = useState("free");
  const [nsStart, setNsStart] = useState("");
  const [busy, setBusy] = useState(false);

  const createSeries = async () => {
    if (!nsTitle.trim()) { toast.error("Title daalo"); return; }
    setBusy(true);
    const { error } = await supabase.from("test_series").insert({
      title: nsTitle.trim(),
      description: nsDesc.trim() || null,
      banner_url: nsBanner.trim() || null,
      access_type: nsAccess,
      starts_at: nsStart ? new Date(nsStart).toISOString() : null,
      created_by: user!.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Series ban gayi");
    setNsTitle(""); setNsDesc(""); setNsBanner(""); setNsStart("");
    qc.invalidateQueries({ queryKey: ["admin-test-series"] });
  };

  const toggleSeries = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("test_series").update({ [field]: value }).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-test-series"] });
  };

  const deleteSeries = async (id: string) => {
    if (!confirm("Poori series aur uske tests delete ho jayenge. Sure?")) return;
    const { error } = await supabase.from("test_series").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-test-series"] });
  };

  if (view.kind === "tests") {
    return <TestsPanel seriesId={view.seriesId} onBack={() => setView({ kind: "series" })}
      onOpenQuestions={(testId) => setView({ kind: "questions", seriesId: view.seriesId, testId })} />;
  }
  if (view.kind === "questions") {
    return <QuestionsPanel testId={view.testId} onBack={() => setView({ kind: "tests", seriesId: view.seriesId })} />;
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Create Test Series</h2>
            <p className="text-sm text-muted-foreground">
              Ek series banao (free ya paid), phir uske andar tests add karo.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={nsTitle} onChange={(e) => setNsTitle(e.target.value)} placeholder="NEET 2027 Target Series" />
            </div>
            <div className="space-y-1.5">
              <Label>Banner image URL (optional)</Label>
              <Input value={nsBanner} onChange={(e) => setNsBanner(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>Access</Label>
              <Select value={nsAccess} onValueChange={setNsAccess}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free — sabke liye</SelectItem>
                  <SelectItem value="paid">Paid — sirf premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Starts at (optional)</Label>
              <Input type="datetime-local" value={nsStart} onChange={(e) => setNsStart(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} value={nsDesc} onChange={(e) => setNsDesc(e.target.value)} />
            </div>
          </div>
          <Button onClick={createSeries} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create series
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <h3 className="font-semibold">All series</h3>
          {seriesLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : !series?.length ? (
            <p className="text-sm text-muted-foreground">Abhi koi series nahi hai.</p>
          ) : series.map((s: any) => (
            <div key={s.id} className="rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span className="font-semibold">{s.title}</span>
                <Badge variant={s.access_type === "paid" ? "default" : "secondary"}>{s.access_type}</Badge>
                {s.starts_at && (
                  <span className="text-xs text-muted-foreground">
                    Starts {format(new Date(s.starts_at), "d MMM yyyy, HH:mm")}
                  </span>
                )}
              </div>
              {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={s.is_published} onCheckedChange={(v) => toggleSeries(s.id, "is_published", v)} />
                  <span className="text-sm">Published</span>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setView({ kind: "tests", seriesId: s.id })}>
                  <ListChecks className="h-3.5 w-3.5" /> Manage tests
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => deleteSeries(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ================= tests inside a series ================= */
function TestsPanel({ seriesId, onBack, onOpenQuestions }: {
  seriesId: string; onBack: () => void; onOpenQuestions: (testId: string) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(180);
  const [scheduled, setScheduled] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: tests, isLoading } = useQuery({
    queryKey: ["admin-series-tests", seriesId],
    queryFn: async () => {
      const { data, error } = await supabase.from("series_tests").select("*")
        .eq("series_id", seriesId).order("position").order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const createTest = async () => {
    if (!title.trim()) { toast.error("Test ka title daalo"); return; }
    setBusy(true);
    const { error } = await supabase.from("series_tests").insert({
      series_id: seriesId,
      title: title.trim(),
      instructions: instructions.trim() || null,
      duration_minutes: duration,
      position: tests?.length || 0,
      scheduled_at: scheduled ? new Date(scheduled).toISOString() : null,
      created_by: user!.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTitle(""); setInstructions(""); setScheduled("");
    qc.invalidateQueries({ queryKey: ["admin-series-tests", seriesId] });
    toast.success("Test add ho gaya");
  };

  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("series_tests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-series-tests", seriesId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Test delete kar dein?")) return;
    const { error } = await supabase.from("series_tests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-series-tests", seriesId] });
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to series
      </Button>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold">Add a test</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Test title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Full Syllabus Mock 01" />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Schedule (optional)</Label>
              <Input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Instructions</Label>
              <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="+4 / -1, no negative for unattempted" />
            </div>
          </div>
          <Button onClick={createTest} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add test
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <h3 className="font-semibold">Tests</h3>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" />
            : !tests?.length ? <p className="text-sm text-muted-foreground">Koi test nahi hai.</p>
              : tests.map((t: any) => (
                <div key={t.id} className="rounded-xl border p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">{t.title}</span>
                    <Badge variant="secondary">{t.question_count} Q</Badge>
                    <Badge variant="outline">{t.duration_minutes} min</Badge>
                    {t.scheduled_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(t.scheduled_at), "d MMM yyyy, HH:mm")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={t.is_published} onCheckedChange={(v) => update(t.id, { is_published: v })} />
                      <span className="text-sm">Published</span>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onOpenQuestions(t.id)}>
                      <ListChecks className="h-3.5 w-3.5" /> Questions
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => remove(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ================= questions of one test ================= */
function QuestionsPanel({ testId, onBack }: { testId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [pickedChapters, setPickedChapters] = useState<string[]>([]);
  const [randomCount, setRandomCount] = useState(45);
  const [search, setSearch] = useState("");
  const [browse, setBrowse] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: attached, isLoading } = useQuery({
    queryKey: ["series-test-questions", testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("series_test_questions")
        .select("id, position, question_id, questions(question_text, chapter_id, chapters(name))")
        .eq("test_id", testId).order("position");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    supabase.from("subjects").select("id,name").order("name").then(({ data }) => setSubjects(data || []));
  }, []);
  useEffect(() => {
    if (!subjectId) { setChapters([]); return; }
    supabase.from("chapters").select("id,name").eq("subject_id", subjectId).order("name")
      .then(({ data }) => setChapters(data || []));
  }, [subjectId]);

  const attachedIds = useMemo(() => new Set((attached || []).map((a: any) => a.question_id)), [attached]);

  const attach = async (ids: string[]) => {
    const fresh = ids.filter((id) => !attachedIds.has(id));
    if (!fresh.length) { toast.error("Ye questions pehle se added hain"); return; }
    setBusy(true);
    const start = attached?.length || 0;
    const { error } = await supabase.from("series_test_questions").insert(
      fresh.map((question_id, i) => ({ test_id: testId, question_id, position: start + i })),
    );
    if (!error) {
      await supabase.from("series_tests").update({ question_count: start + fresh.length }).eq("id", testId);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${fresh.length} questions added`);
    setSelected([]);
    qc.invalidateQueries({ queryKey: ["series-test-questions", testId] });
    qc.invalidateQueries({ queryKey: ["admin-series-tests"] });
  };

  const detach = async (rowId: string) => {
    const { error } = await supabase.from("series_test_questions").delete().eq("id", rowId);
    if (error) return toast.error(error.message);
    const left = (attached?.length || 1) - 1;
    await supabase.from("series_tests").update({ question_count: left }).eq("id", testId);
    qc.invalidateQueries({ queryKey: ["series-test-questions", testId] });
    qc.invalidateQueries({ queryKey: ["admin-series-tests"] });
  };

  const pullRandom = async () => {
    if (!pickedChapters.length) { toast.error("Chapters select karo"); return; }
    setBusy(true);
    const { data, error } = await supabase
      .from("questions").select("id").in("chapter_id", pickedChapters).limit(2000);
    setBusy(false);
    if (error) return toast.error(error.message);
    const pool = (data || []).map((q) => q.id).filter((id) => !attachedIds.has(id));
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, randomCount);
    if (!shuffled.length) return toast.error("Is selection me questions nahi mile");
    attach(shuffled);
  };

  const runSearch = async () => {
    setBusy(true);
    let q = supabase.from("questions").select("id, question_text, chapters(name)").limit(50);
    if (pickedChapters.length) q = q.in("chapter_id", pickedChapters);
    else if (subjectId) q = q.eq("subject_id", subjectId);
    if (search.trim()) q = q.ilike("question_text", `%${search.trim()}%`);
    const { data, error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    setBrowse(data || []);
  };

  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to tests
      </Button>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="random">
            <TabsList className="grid grid-cols-1 sm:flex w-full sm:w-auto h-auto gap-1 sm:gap-0 p-1">
              <TabsTrigger value="random" className="gap-2"><Shuffle className="h-4 w-4" /> Random from chapters</TabsTrigger>
              <TabsTrigger value="pick" className="gap-2"><Search className="h-4 w-4" /> Pick from site</TabsTrigger>
              <TabsTrigger value="manual" className="gap-2"><Plus className="h-4 w-4" /> Manual question</TabsTrigger>
            </TabsList>

            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setPickedChapters([]); }}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {chapters.length > 0 && (
                <div className="space-y-2">
                  <Label>Chapters</Label>
                  <div className="max-h-52 overflow-y-auto rounded-xl border p-3 grid gap-2 sm:grid-cols-2">
                    {chapters.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={pickedChapters.includes(c.id)}
                          onCheckedChange={(v) =>
                            setPickedChapters(v ? [...pickedChapters, c.id] : pickedChapters.filter((x) => x !== c.id))
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <TabsContent value="random" className="m-0 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <Label>How many questions</Label>
                    <Input type="number" className="w-32" value={randomCount} onChange={(e) => setRandomCount(Number(e.target.value))} />
                  </div>
                  <Button onClick={pullRandom} disabled={busy} className="gap-2">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />} Pull random
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="pick" className="m-0 space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Search question text..." value={search} onChange={(e) => setSearch(e.target.value)} />
                  <Button onClick={runSearch} disabled={busy} variant="outline" className="gap-1.5">
                    <Search className="h-4 w-4" /> Search
                  </Button>
                </div>
                {browse.length > 0 && (
                  <>
                    <div className="max-h-80 overflow-y-auto rounded-xl border divide-y">
                      {browse.map((q: any) => (
                        <label key={q.id} className="flex items-start gap-2 p-3 text-sm">
                          <Checkbox
                            className="mt-0.5"
                            disabled={attachedIds.has(q.id)}
                            checked={selected.includes(q.id)}
                            onCheckedChange={(v) => setSelected(v ? [...selected, q.id] : selected.filter((x) => x !== q.id))}
                          />
                          <span>
                            <span className="text-muted-foreground text-xs block">{q.chapters?.name}</span>
                            {stripHtml(q.question_text).slice(0, 160)}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Button onClick={() => attach(selected)} disabled={busy || !selected.length} className="gap-2">
                      <Plus className="h-4 w-4" /> Add {selected.length} selected
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="manual" className="m-0">
                <ManualQuestionForm mode="admin" onSaved={(id) => { if (id) attach([id]); }} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-2">
          <h3 className="font-semibold">Questions in this test ({attached?.length || 0})</h3>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" />
            : !attached?.length ? <p className="text-sm text-muted-foreground">Abhi koi question nahi hai.</p>
              : (
                <div className="max-h-96 overflow-y-auto rounded-xl border divide-y">
                  {attached.map((row: any, i: number) => (
                    <div key={row.id} className="flex items-start gap-2 p-3 text-sm">
                      <span className="text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                      <span className="flex-1">
                        <span className="block text-xs text-muted-foreground">{row.questions?.chapters?.name}</span>
                        {stripHtml(row.questions?.question_text || "").slice(0, 140)}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => detach(row.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
        </CardContent>
      </Card>
    </div>
  );
}