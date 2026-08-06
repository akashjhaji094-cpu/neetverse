import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MathContent } from "@/components/MathContent";
import { formatQuestionHtml, formatOptionHtml } from "@/lib/questionFormatter";
import { sanitizeLatex } from "@/lib/latexSanitize";
import { SubmitPreviewDialog } from "@/components/questions/SubmitPreviewDialog";
import { toast } from "sonner";
import { CheckCircle2, Eye, Inbox, Loader2 } from "lucide-react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface QRow {
  id: string;
  question_text: string;
  options: any;
  correct_option_index: number | null;
}

/**
 * Students pick Subject → Chapter → Topic and are shown ONLY the questions of
 * that topic which still have no explanation (neither a stored one nor an
 * AI-generated cached one). They write an explanation, preview it, and submit
 * it into the admin review queue.
 */
export function ExplanationContributeForm({ onSaved }: { onSaved?: () => void }) {
  const { user } = useAuth();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");

  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("subjects").select("id,name").order("name").then(({ data }) => setSubjects(data || []));
  }, []);

  useEffect(() => {
    setChapterId(""); setTopicId(""); setQuestions([]); setSelectedId(null);
    if (!subjectId) { setChapters([]); return; }
    supabase.from("chapters").select("id,name").eq("subject_id", subjectId).order("name")
      .then(({ data }) => setChapters(data || []));
  }, [subjectId]);

  useEffect(() => {
    setTopicId(""); setQuestions([]); setSelectedId(null);
    if (!chapterId) { setTopics([]); return; }
    supabase.from("topics").select("id,name").eq("chapter_id", chapterId).order("position")
      .then(({ data }) => setTopics(data || []));
  }, [chapterId]);

  // Load the questions of this topic that still need an explanation.
  useEffect(() => {
    if (!topicId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSelectedId(null);
      setText("");
      try {
        const { data: links } = await supabase
          .from("question_topics")
          .select("question_id")
          .eq("topic_id", topicId)
          .limit(500);
        const ids = (links || []).map((l: any) => l.question_id);
        if (!ids.length) { if (!cancelled) setQuestions([]); return; }

        const [{ data: qs }, { data: cached }, { data: pending }] = await Promise.all([
          supabase.from("questions")
            .select("id, question_text, options, correct_option_index, explanation")
            .in("id", ids)
            .limit(500),
          supabase.from("question_explanations").select("question_id").in("question_id", ids),
          supabase.from("explanation_submissions").select("question_id").in("question_id", ids).eq("status", "pending"),
        ]);

        const blocked = new Set<string>([
          ...(cached || []).map((c: any) => c.question_id),
          ...(pending || []).map((p: any) => p.question_id),
        ]);

        const list = (qs || []).filter(
          (q: any) => !blocked.has(q.id) && String(q.explanation ?? "").trim().length < 40
        ) as QRow[];
        if (!cancelled) setQuestions(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId]);

  const selected = useMemo(() => questions.find((q) => q.id === selectedId) || null, [questions, selectedId]);

  const error = !selected ? "Pehle ek question select karo" : text.trim().length < 20 ? "Explanation thoda detail me likho (min 20 characters)" : null;

  const submit = async () => {
    if (!user || !selected) return;
    setSaving(true);
    try {
      const clean = sanitizeLatex(text).html;
      const { error: err } = await supabase.from("explanation_submissions").insert({
        question_id: selected.id,
        submitted_by: user.id,
        submitter_name: (user.user_metadata as any)?.name || user.email,
        subject_id: subjectId,
        chapter_id: chapterId,
        topic_id: topicId,
        content: clean,
      });
      if (err) throw err;
      toast.success("Explanation submit ho gaya! Admin verify karega 🎉");
      setPreview(false);
      setText("");
      setQuestions((prev) => prev.filter((q) => q.id !== selected.id));
      setSelectedId(null);
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Chapter</Label>
          <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
            <SelectTrigger><SelectValue placeholder="Select chapter" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Topic</Label>
          <Select value={topicId} onValueChange={setTopicId} disabled={!chapterId || topics.length === 0}>
            <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {topics.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!topicId ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Subject → Chapter → Topic choose karo, phir bina explanation wale questions yahan aa jayenge.
        </CardContent></Card>
      ) : loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </CardContent></Card>
      ) : questions.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Inbox className="h-6 w-6 mx-auto mb-2" />
          Is topic ke saare questions ka explanation already available hai 🎉
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <Label>Questions without explanation</Label>
              <Badge variant="secondary">{questions.length}</Badge>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {questions.map((q) => {
                const active = q.id === selectedId;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => { setSelectedId(q.id); setText(""); }}
                    className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <MathContent
                      html={formatQuestionHtml(q.question_text)}
                      className="neet-question text-sm leading-relaxed"
                    />
                    {active && Array.isArray(q.options) && (
                      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                        {(q.options as string[]).map((o, i) => (
                          <li key={i} className={`rounded-lg border px-2 py-1 text-xs ${i === q.correct_option_index ? "border-primary bg-primary/10 font-medium" : ""}`}>
                            <span className="font-semibold mr-1">{LETTERS[i]}.</span>
                            <MathContent as="span" html={formatOptionHtml(o)} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selected && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="space-y-1.5">
              <Label>Your explanation</Label>
              <Textarea
                rows={7}
                value={text}
                onChange={(ev) => setText(ev.target.value)}
                placeholder={"Step by step solve karo. LaTeX supported: $v = u + at$, chemistry: $\\ce{H2SO4}$"}
              />
              <p className="text-xs text-muted-foreground">
                Math ko $ … $ ke andar likho. Galat delimiters ($$, \( \), \\frac) preview me automatically fix ho jayenge.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setPreview(true)} disabled={!!error} className="gap-2">
                <Eye className="h-4 w-4" /> Preview & submit
              </Button>
              {error && <span className="text-sm text-muted-foreground">{error}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      <SubmitPreviewDialog
        open={preview}
        onOpenChange={setPreview}
        submitting={saving}
        confirmLabel="Confirm & submit"
        payload={{
          questionHtml: selected?.question_text,
          options: Array.isArray(selected?.options) ? (selected!.options as string[]) : [],
          correctIndex: selected?.correct_option_index ?? null,
          explanationHtml: text,
          meta: "Ye explanation admin approve karega, phir 'See Explanation' me sabko dikhega.",
        }}
        onConfirm={submit}
      />
    </div>
  );
}